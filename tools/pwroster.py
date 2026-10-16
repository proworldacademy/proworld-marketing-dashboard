#!/usr/bin/env python3
"""pwroster.py — the daily Monday → portal roster sync for the PROWORLD Coach Portal.

Monday is the single source of truth for who is enrolled, their status, coaches and schedule. Every morning a scheduled
run copies it into the portal, and carries the portal's own changes back to Monday:

  python3 tools/pwroster.py pull    --login-file login.txt --work work      read the portal (players, outbox, board, settings)
  python3 tools/pwroster.py prepare --work work                             print the `vars` for the monday call
      → the run calls monday's execute_code with tools/monday_sync.py and those vars; the harness saves the result as a file
  python3 tools/pwroster.py plan    --work work --monday <that file>        compare, decide, write work/plan.json, print it
  python3 tools/pwroster.py apply   --work work --login-file login.txt      write the plan (preview: only the board + log)
  python3 tools/pwroster.py note    --login-file login.txt --why "…"         a run that stopped says so in the change log

Settings live in the database (syncCfg/main, owners only): mode "preview" (default — nothing on the roster changes, the
log shows what would) or "live". Database paths written: players/<id> (Monday fields only), players/<id>/private/contact
(parent name, email, phone — opened behind a button in the portal), board/current (the Coach Board), syncLog/<run>
(the change log everyone sees), outbox/<id> (state of the portal's queued changes). Never deletes anything.
Standard library only; signs in with the runs account through pwfs.py.
"""
import argparse, base64, datetime, hashlib, json, os, re, sys, time, unicodedata, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pwfs  # noqa: E402  (same folder: sign-in + HTTP helpers)

SCHEMA = "pw-monday-sync/1"
FULL_GROUPS = ("active", "new", "notOnAccounting", "tryouts")
ON_ROSTER = ("active", "new", "notOnAccounting")          # attending: become portal players
GROUP_RANK = {"active": 0, "new": 1, "notOnAccounting": 2, "tryouts": 3, "away": 4, "finished": 5}
PORTAL_GROUPS = {"ft": "Full Time", "as": "Afterschool 4PM", "u10": "10 & Under", "tour": "Tour Team", "camp": "Campers"}
LEADS_PLAYER_GROUP = {"u10": "U8", "as": "U12"}
LEADS_PROGRAM = {"ft": "Full Time", "as": "12 & Under", "u10": "10 & Under", "tour": "Pro Team", "camp": "Training Camps"}
STATUS_LABEL = {"away": "AWAY", "finished": "FINISHED", "active": "ACTIVE"}
GROUP_WORDS = {"active": "Active", "new": "New players", "notOnAccounting": "not on the accounting board", "tryouts": "Try-outs", "away": "Away", "finished": "Finished"}
MAX_NEW = 25
REF = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class Fail(Exception):
    pass


# ───────────── Firestore REST (typed values ↔ plain Python) ─────────────
def enc(v):
    if v is None:
        return {"nullValue": None}
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int):
        return {"integerValue": str(v)}
    if isinstance(v, float):
        return {"doubleValue": v}
    if isinstance(v, str):
        return {"stringValue": v}
    if isinstance(v, (list, tuple)):
        return {"arrayValue": {"values": [enc(x) for x in v]}}
    if isinstance(v, dict):
        return {"mapValue": {"fields": {str(k): enc(x) for k, x in v.items()}}}
    raise Fail(f"can't store a {type(v).__name__} in the database")


def dec(v):
    if "nullValue" in v:
        return None
    for k in ("stringValue", "booleanValue", "timestampValue", "referenceValue", "bytesValue"):
        if k in v:
            return v[k]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return float(v["doubleValue"])
    if "mapValue" in v:
        return {k: dec(x) for k, x in (v["mapValue"].get("fields") or {}).items()}
    if "arrayValue" in v:
        return [dec(x) for x in (v["arrayValue"].get("values") or [])]
    if "geoPointValue" in v:
        return v["geoPointValue"]
    return None


def fields_of(doc):
    return {k: dec(x) for k, x in (doc.get("fields") or {}).items()}


ROOT = f"projects/{pwfs.PROJECT}/databases/(default)/documents"


def doc_name(path):
    return f"{ROOT}/" + "/".join(urllib.parse.quote(p, safe="") for p in path.split("/"))


def fs_list(token, col):
    out, page = {}, None
    while True:
        q = {"pageSize": "300"}
        if page:
            q["pageToken"] = page
        st, j = pwfs.http("GET", f"{pwfs.DOCS}/{col}?" + urllib.parse.urlencode(q), token=token)
        if st == 403:
            raise Fail(f"permission denied reading {col} — the database rules don't let the runs account read it yet")
        if st != 200:
            raise Fail(f"reading {col} failed: HTTP {st} {(j.get('error') or {}).get('message', '')}")
        for d in j.get("documents", []):
            out[urllib.parse.unquote(d["name"].rsplit("/", 1)[-1])] = {"data": fields_of(d), "updateTime": d.get("updateTime")}
        page = j.get("nextPageToken")
        if not page:
            return out


def fs_get_many(token, paths):
    out = {}
    for i in range(0, len(paths), 100):
        chunk = paths[i:i + 100]
        if not chunk:
            continue
        st, j = pwfs.http("POST", f"{pwfs.FS_URL}/{ROOT}:batchGet", {"documents": [doc_name(p) for p in chunk]}, token=token)
        if st == 403:
            raise Fail("permission denied reading " + chunk[0].split("/")[0] + " — the database rules don't let the runs account read it yet")
        if st != 200:
            raise Fail(f"reading {len(chunk)} documents failed: HTTP {st} {(j.get('error') or {}).get('message', '') if isinstance(j, dict) else ''}")
        for r in (j if isinstance(j, list) else [j]):
            if "found" in r:
                path = urllib.parse.unquote(r["found"]["name"].split("/documents/", 1)[1])
                out[path] = {"data": fields_of(r["found"]), "updateTime": r["found"].get("updateTime")}
    return out


def fs_commit(token, writes):
    """writes: dicts {path, data, mask?: [fields], exists?: bool, updateTime?: str}. One commit is all-or-nothing."""
    body = {"writes": []}
    for w in writes:
        x = {"update": {"name": doc_name(w["path"]), "fields": {k: enc(v) for k, v in w["data"].items()}}}
        if w.get("mask") is not None:
            x["updateMask"] = {"fieldPaths": list(w["mask"])}
        if w.get("updateTime"):
            x["currentDocument"] = {"updateTime": w["updateTime"]}
        elif "exists" in w:
            x["currentDocument"] = {"exists": bool(w["exists"])}
        body["writes"].append(x)
    st, j = pwfs.http("POST", f"{pwfs.FS_URL}/{ROOT}:commit", body, token=token)
    if st == 200:
        return True, ""
    msg = (j.get("error") or {}).get("message", "") if isinstance(j, dict) else ""
    if st in (400, 409) and re.search(r"FAILED_PRECONDITION|ALREADY_EXISTS|NOT_FOUND|stored version|does not match|already exists|no entity", json.dumps(j), re.I):
        return False, "changed in the portal while the sync ran"
    if st == 403:
        raise Fail(f"permission denied writing {writes[0]['path']} — the database rules don't let the runs account write there")
    raise Fail(f"writing {len(writes)} document(s) failed: HTTP {st} {msg}")


# ───────────── names, coaches, placement ─────────────
def fold(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z]+", " ", s).strip()


def toks(s):
    return fold(re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", str(s or ""))).split()   # "(4PM)", "(Tryout)": notes, never part of a name


def titled(s):
    s = re.sub(r"\s+", " ", str(s or "").strip())
    if s and (s.isupper() or s.islower()) and len(s) > 1:   # ALL CAPS or all lower → Title Case; mixed case (McName) is left alone
        return " ".join(w[:1].upper() + w[1:].lower() if w.isalpha() or "-" in w or "'" in w else w for w in s.split(" "))
    return s


def lev(a, b):
    if abs(len(a) - len(b)) > 1:
        return 9
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def coach_namer(known, overrides):
    """Monday's coach labels (ALL CAPS first names) → the names the portal already uses. Nothing about who the coaches are
    lives in this file: a label maps to a name the portal knows when they clearly match (same, starts the same, or one
    letter apart), otherwise it is simply written in normal case. syncCfg/main.coachNames can pin any label."""
    known = sorted({str(k).strip() for k in known if str(k or "").strip()})
    pinned = {str(k).strip().upper(): str(v).strip() for k, v in (overrides or {}).items() if str(k).strip()}

    def name(label):
        lab = re.sub(r"\s+", " ", str(label or "")).strip()
        if not lab or "?" in lab or lab.upper().startswith("TBC") or lab.upper() in ("TBD", "NONE", "N/A", "-"):
            return ""
        if lab.upper() in pinned:
            return pinned[lab.upper()]
        n = fold(lab)
        for test in (lambda k: fold(k) == n,
                     lambda k: len(n) >= 3 and fold(k).startswith(n),
                     lambda k: len(n) >= 4 and lev(fold(k), n) <= 1):
            hits = [k for k in known if test(k)]
            if len(hits) == 1:
                return hits[0]
            if len(hits) > 1:
                break
        return lab if len(lab) <= 2 else titled(lab)
    return name


def morning(schedule):
    return any(t in str(schedule or "") for t in ("7:45", "9:30", "2:00"))


def place(age, schedule):
    """portal group for a player new from Monday — how the portal's groups line up with Monday today:
    U8 → 10 & Under · U12 → Afterschool 4PM · BOYS / GIRLS / 13+ → Full Time, or Afterschool when they only come at 4:00 ·
    no age group → by schedule (mornings → Full Time, 4:00 → Afterschool). '' = not placed (pick the group in the portal);
    None = not a tennis-group player (soccer), shown on the Coach Board only."""
    a, s = str(age or "").upper().strip(), str(schedule or "")
    if a == "SOCCER":
        return None
    if a in ("U8", "U10"):
        return "u10"
    if a == "U12":
        return "as"
    if a in ("BOYS", "GIRLS", "13+"):
        return "as" if ("4:00" in s and not morning(s)) else "ft"
    if morning(s):
        return "ft"
    if "4:00" in s:
        return "as"
    return ""


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", fold(s)).strip("-")[:40] or "player"


# ───────────── the monday export ─────────────
def read_monday(path):
    raw = open(path, encoding="utf-8").read()
    text, summary = raw, None
    try:
        j = json.loads(raw)
    except ValueError:
        j = None
    if isinstance(j, dict) and j.get("schema") == SCHEMA:
        return j
    if isinstance(j, dict) and isinstance(j.get("response"), str):
        if j.get("exit_code") not in (0, None):
            raise Fail(f"monday's code run failed (exit code {j.get('exit_code')}): {str(j.get('stderr', ''))[:400]}")
        text = j["response"]
    data = None
    for line in text.splitlines():
        if line.startswith("PW-MONDAY-EXPORT "):
            data = line[len("PW-MONDAY-EXPORT "):]
        elif line.startswith("{") and '"schema"' in line and summary is None:
            try:
                summary = json.loads(line)
            except ValueError:
                pass
    if data is None:
        raise Fail("no PW-MONDAY-EXPORT line in that file — pass the saved result of the monday execute_code call")
    if summary and summary.get("sha256") and hashlib.sha256(data.encode("utf-8")).hexdigest() != summary["sha256"]:
        raise Fail("the monday export is damaged (its checksum doesn't match) — run the monday step again")
    exp = json.loads(data)
    if exp.get("schema") != SCHEMA:
        raise Fail(f"unexpected export version {exp.get('schema')!r}")
    return exp


def monday_rows(exp):
    rows = []
    for it in exp.get("items", []):
        c = it.get("c") or {}
        first = re.sub(r"\s+", " ", str(it.get("name") or "")).strip()
        last = re.sub(r"\s+", " ", str(c.get("text") or "")).strip()
        col = str(c.get("color_mm3mzpq1") or "").strip().upper()
        g = it.get("g")
        if g == "tryouts":
            status = "tryout"
        elif g in ("away", "finished"):
            status = g
        elif col in ("AWAY", "FINISHED"):
            status = col.lower()
        else:
            status = "active"
        ft = toks(first)
        rows.append({
            "id": str(it["id"]), "g": g, "first": titled(first), "last": titled(last), "status": status, "statusCol": col,
            "lead": str(c.get("status152") or "").strip(), "asst": str(c.get("color_mkqayh29") or "").strip(),
            "age": str(c.get("group0") or "").strip(), "sch": str(c.get("status70") or "").strip(),
            "tryDate": str(c.get("date_mkswwmxr") or "")[:10], "tryTime": str(c.get("color_mkswq54a") or "")[:5],
            "enrollDate": str(c.get("date_mm1z1npj") or "")[:10], "enroll": str(c.get("enrollment") or "").strip(),
            "guardian": str(c.get("parent_contact") or "").strip(), "email": str(c.get("customer_email") or "").strip(),
            "phone": str(c.get("phone2") or "").strip(), "u": it.get("u") or "",
            "k1": " ".join(toks(first + " " + last)), "k2": " ".join(ft[:1] + toks(last)),
            "k3": (ft[0] + " " + (toks(last) or [""])[0][:1]).strip() if ft else "",
            "kl": ((toks(last) or [""])[-1] + " " + (ft[0][:1] if ft else "")).strip() if last else "",
        })
    return rows


# ───────────── the plan ─────────────
def nice_date(ms_or_iso):
    try:
        d = datetime.datetime.fromtimestamp(ms_or_iso / 1000, datetime.timezone.utc) if isinstance(ms_or_iso, (int, float)) else datetime.date.fromisoformat(str(ms_or_iso)[:10])
        return d.strftime("%b %-d")
    except Exception:
        return str(ms_or_iso or "")


def full_name(r):
    return (r["first"] + " " + r["last"]).strip()


def player_keys(p):
    t = toks(p.get("name"))
    s = toks(p.get("shortName"))
    k1 = " ".join(t)
    k3 = (t[0] + " " + t[-1][:1]) if len(t) >= 2 else ((s[0] + " " + s[-1][:1]) if len(s) >= 2 else "")
    kl = (t[-1] + " " + t[0][:1]) if len(t) >= 2 and len(t[-1]) > 1 else ""
    return k1, k3, kl


def build_plan(state, exp, now_ms=None):
    now_ms = int(now_ms if now_ms is not None else time.time() * 1000)
    now_iso = datetime.datetime.fromtimestamp(now_ms / 1000, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    cfg = state.get("cfg") or {}
    mode = "live" if cfg.get("mode") == "live" else "preview"
    players = {pid: x["data"] for pid, x in (state.get("players") or {}).items()}
    ptime = {pid: x.get("updateTime") for pid, x in (state.get("players") or {}).items()}
    outbox = {oid: x["data"] for oid, x in (state.get("outbox") or {}).items()}
    contacts = state.get("contacts") or {}
    prev_board = state.get("board") or {}
    rows = monday_rows(exp)
    by_id = {r["id"]: r for r in rows}
    counts = exp.get("counts") or {}
    log, errors, w_players, w_contacts, w_outbox, adds = [], [], [], [], [], []

    def say(kind, text, pid=None):
        e = {"k": kind, "t": text}
        if pid:
            e["pid"] = pid
        log.append(e)

    # a run that sees far fewer players than the last one stops before changing anything
    prev_active = sum(1 for x in (prev_board.get("items") or []) if x.get("g") == "active")
    if counts.get("active", 0) == 0 or (prev_active >= 40 and counts.get("active", 0) < prev_active * 0.5):
        raise Fail(f"monday's Active group came back with {counts.get('active', 0)} players (last run {prev_active}) — that looks wrong, nothing was changed")

    namer = coach_namer([p.get("coach") for p in players.values()] + [p.get("coach2") for p in players.values()], cfg.get("coachNames"))

    # what the portal asked for, and how monday answered (only when the hand-off matched what `prepare` produced)
    sent = {}
    applied_ok = exp.get("actionsAccepted") is True and bool(state.get("actionsSha")) and exp.get("actionsSha") == state.get("actionsSha")
    if state.get("actionsSha") and not applied_ok:
        errors.append("the portal's queued changes didn't reach Monday this time (the hand-off didn't match) — they go with the next run")
    for a in (exp.get("applied") or []) if applied_ok else []:
        sent[str(a.get("ref"))] = a
    # a status a coach set in the portal that monday hasn't taken yet: monday must not undo it in the meantime
    hold = {o.get("pid") for oid, o in outbox.items() if o.get("type") == "status" and o.get("state") == "queued" and not (sent.get(oid) or {}).get("ok")}
    waiting_add = {o.get("pid") for o in outbox.values() if o.get("type") == "add" and o.get("state") in ("queued", "sent")}

    # 1 · link every portal player to its Monday row: the saved id first, then the full name, then weaker keys (unique only)
    def rank(r):
        return (GROUP_RANK.get(r["g"], 9), 0 if r["status"] == "active" else 1, "".join(chr(255 - ord(ch)) for ch in r["u"]))
    index = {"k1": {}, "k2": {}, "k3": {}, "kl": {}}
    for r in rows:
        for k in index:
            if r[k]:
                index[k].setdefault(r[k], []).append(r)
    used, link, how = {}, {}, {}
    for pid in sorted(players, key=lambda pid: (0 if players[pid].get("mondayId") else 1, pid)):
        p = players[pid]
        mid = str(p.get("mondayId") or "")
        if mid and mid in by_id and mid not in used:
            link[pid], how[pid], used[mid] = by_id[mid], "id", pid
            continue
        k1, k3, kl = player_keys(p)
        found, strength = None, ""
        for key, idx, strength in ((k1, "k1", "name"), (k1, "k2", "name"), (k3, "k3", "initial"), (kl, "kl", "initial")):
            cands = [r for r in index[idx].get(key, []) if r["id"] not in used] if key else []
            if strength != "name":
                cands = [r for r in cands if r["g"] in ON_ROSTER]
                if len(cands) != 1:
                    continue
            if cands:
                found = sorted(cands, key=rank)[0]
                break
        if found:
            link[pid], how[pid], used[found["id"]] = found, ("relinked" if mid else strength), pid
        elif mid:
            how[pid] = "gone"

    # 2 · players already in the portal: Monday's status, coaches and full name win
    newly, weak = 0, []
    for pid in sorted(link):
        p, r = players[pid], link[pid]
        nm = p.get("name") or full_name(r)
        upd = {}

        def setf(k, v):
            if p.get(k) != v:
                upd[k] = v
        if how[pid] != "id":
            setf("mondayId", r["id"])
            newly += 1
            if how[pid] == "initial":
                weak.append(f"{nm} → {full_name(r)}")
        to = r["status"] if r["status"] in ("active", "away", "finished") else None
        cur = p.get("status") or "active"
        if to and to != cur and pid not in hold:
            setf("status", to)
            if to == "active":
                say("back", f"Back to active (Monday): {nm}", pid)
            elif cur == "active":
                say(to, f"{'Now away' if to == 'away' else 'Finished'} (Monday): {nm}", pid)
            else:
                say("status", f"Not active → {to} (Monday): {nm}", pid)
        lead, asst = namer(r["lead"]), namer(r["asst"])
        if lead and lead != (p.get("coach") or ""):
            say("coach", f"Coach (Monday): {nm} — {p.get('coach') or 'none'} → {lead}", pid)
            setf("coach", lead)
        if asst and asst != lead and asst != (p.get("coach2") or ""):
            say("coach", f"Second coach (Monday): {nm} — {p.get('coach2') or 'none'} → {asst}", pid)
            setf("coach2", asst)
        t = toks(nm)
        if r["last"] and (how[pid] == "initial" or len(t) < 2 or len(t[-1]) == 1):
            mname = full_name(r)
            if mname and mname != nm:
                say("name", f"Full name from Monday: {nm} → {mname}", pid)
                setf("name", mname)
                if not p.get("shortName"):
                    setf("shortName", nm)
        mon = {"id": r["id"], "group": r["g"], "status": r["status"], "lead": r["lead"], "assistant": r["asst"], "age": r["age"],
               "schedule": r["sch"], "enrollDate": r["enrollDate"]}
        if {k: (p.get("monday") or {}).get(k, "") for k in mon} != mon:
            upd["monday"] = dict(mon, syncedAt=now_iso)
        if upd:
            upd["updatedAt"] = now_ms
            w_players.append({"path": f"players/{pid}", "data": upd, "mask": sorted(upd), "updateTime": ptime.get(pid), "pid": pid, "name": nm})
        if r["g"] in FULL_GROUPS:
            c = {"guardian": r["guardian"], "email": r["email"], "phone": r["phone"], "mondayId": r["id"]}
            have = (contacts.get(pid) or {}).get("data") or {}
            if {k: have.get(k, "") for k in c} != c:
                w_contacts.append({"path": f"players/{pid}/private/contact", "data": dict(c, syncedAt=now_iso), "pid": pid})
    if newly:
        say("linked", f"Linked {newly} portal player{'s' if newly != 1 else ''} to {'their Monday rows' if newly != 1 else 'a Monday row'}")
    for w in weak:
        say("check", f"Linked by first name + initial — please check: {w}")
    for pid, h in sorted(how.items()):
        if h == "relinked":
            say("check", f"Linked again (its Monday row changed): {players[pid].get('name', pid)} → {full_name(link[pid])}", pid)

    # 3 · attending on Monday but not in the portal yet → new players (soccer stays off the tennis groups)
    taken, one_each = set(players), {}
    for r in sorted((r for r in rows if r["g"] in ON_ROSTER and r["status"] == "active" and r["id"] not in used), key=rank):
        one_each.setdefault(r["k1"] or r["id"], r)          # the same child twice on Monday → one portal player (the copy is in Clean-up)
    for r in sorted(one_each.values(), key=lambda r: full_name(r).lower()):
        gid = place(r["age"], r["sch"])
        if gid is None:
            continue
        ft, lt = toks(r["first"]), toks(r["last"])
        base = f"{gid or 'new'}-{slug(ft[0] if ft else r['first'])}" + (f"-{lt[0][0]}" if lt else "")
        pid = base if base not in taken else f"{base}-{r['id'][-4:]}"
        taken.add(pid)
        lead, asst = namer(r["lead"]), namer(r["asst"])
        doc = {"name": full_name(r), "shortName": (r["first"] + (" " + r["last"][0] if r["last"] else "")).strip(), "group": gid, "tier": "",
               "coach": lead, "coach2": asst if asst != lead else "", "fitness": "", "status": "active", "source": "monday", "mondayId": r["id"],
               "monday": {"id": r["id"], "group": r["g"], "status": r["status"], "lead": r["lead"], "assistant": r["asst"], "age": r["age"],
                          "schedule": r["sch"], "enrollDate": r["enrollDate"], "syncedAt": now_iso},
               "createdAt": now_ms, "updatedAt": now_ms, "createdBy": "Monday sync"}
        adds.append({"path": f"players/{pid}", "data": doc, "exists": False, "pid": pid, "name": doc["name"], "item": r["id"]})
        w_contacts.append({"path": f"players/{pid}/private/contact", "data": {"guardian": r["guardian"], "email": r["email"], "phone": r["phone"],
                                                                                "mondayId": r["id"], "syncedAt": now_iso}, "pid": pid})
        if gid:
            say("added", f"Added from Monday: {doc['name']} → {PORTAL_GROUPS.get(gid, gid)}" + (f" · Coach {lead}" if lead else " · no coach yet"), pid)
        else:
            say("notPlaced", f"Added from Monday, not placed: {doc['name']} — no program on Monday ({r['age'] or 'no age group'}, "
                             f"{r['sch'] or 'no schedule'}). Pick a group in the portal.", pid)
    max_new = int(cfg.get("maxNew") or MAX_NEW)
    unlimited = prev_board.get("mode") != "live"   # a preview writes nothing, and the first live run follows a reviewed preview: no limit
    if len(adds) > max_new and not unlimited:
        errors.append(f"{len(adds)} new players at once (the limit is {max_new}) — none added; check Monday. An owner can raise the limit.")
        gone = {a["pid"] for a in adds}
        log[:] = [e for e in log if e["k"] not in ("added", "notPlaced")]
        w_contacts[:] = [w for w in w_contacts if w["pid"] not in gone]
        adds = []
    for a in adds:
        used[a["item"]] = a["pid"]

    # 4 · the portal's queued changes: sent, failed, placed, still waiting
    leads = {str(x["id"]): x for x in exp.get("leads") or []}
    for oid in sorted(outbox, key=lambda o: outbox[o].get("at") or 0):
        o = outbox[oid]
        st, typ, pid = o.get("state"), o.get("type"), o.get("pid")
        who, by = o.get("name") or "a player", o.get("byName") or o.get("by") or "a coach"
        a = sent.get(oid)
        if st == "queued":
            if a is not None and a.get("ok"):
                res = {k: a[k] for k in ("itemId", "existing", "changed") if k in a}
                w_outbox.append({"path": f"outbox/{oid}", "data": {"state": "sent", "result": res, "sentAt": now_ms}, "mask": ["result", "sentAt", "state"]})
                say("sent", f"Sent to the front desk on Monday (LEADS · New Requests): {who}, added by {by}" if typ == "add"
                    else f"Sent to Monday: {who} marked {o.get('to')} (by {by})", pid)
            elif a is not None:
                w_outbox.append({"path": f"outbox/{oid}", "data": {"state": "error", "result": {"error": str(a.get("error", ""))[:300]}, "doneAt": now_ms},
                                 "mask": ["doneAt", "result", "state"]})
                say("error", f"Couldn't send to Monday: {who} — {str(a.get('error', ''))[:160]}", pid)
            elif typ == "status" and not (o.get("mondayId") or (players.get(pid) or {}).get("mondayId")) and pid not in link:
                w_outbox.append({"path": f"outbox/{oid}", "data": {"state": "skipped", "note": "not on Monday", "doneAt": now_ms}, "mask": ["doneAt", "note", "state"]})
                say("skipped", f"{who} marked {o.get('to')} in the portal — not on Monday, nothing to change there", pid)
            elif mode == "live":
                say("queued", f"Goes to Monday with the next run: {who} ({'new player' if typ == 'add' else 'marked ' + str(o.get('to'))})", pid)
            else:
                say("wouldSend", f"Would send to Monday: {who} — " + ("new player from a coach, to the front desk's New Requests" if typ == "add"
                                                                      else f"marked {o.get('to')}"), pid)
        elif st == "sent" and typ == "add":
            item = str((o.get("result") or {}).get("itemId") or "")
            if pid in link:
                w_outbox.append({"path": f"outbox/{oid}", "data": {"state": "placed", "placedAt": now_ms}, "mask": ["placedAt", "state"]})
                say("placed", f"Placed: {who} is on the General Attendance board now", pid)
            elif item in leads and (leads[item]["state"] != "active" or re.search(r"lost|away", leads[item]["group"] or "", re.I)):
                where = leads[item]["group"] or leads[item]["state"]
                w_outbox.append({"path": f"outbox/{oid}", "data": {"state": "closed", "note": f"{where} on LEADS", "doneAt": now_ms}, "mask": ["doneAt", "note", "state"]})
                say("closed", f"The front desk closed {who} on LEADS ({where})", pid)
            else:
                where = f" — on LEADS in {leads[item]['group']}" if item in leads and leads[item]["group"] else ""
                say("waiting", f"Waiting for the front desk: {who}, added by {by} on {nice_date(o.get('at'))}{where}", pid)

    # 5 · what moved on Monday since the last run (try-outs, schedules)
    prev = {x["id"]: x for x in prev_board.get("items") or []}
    if prev:
        for r in rows:
            if r["g"] == "tryouts" and r["id"] not in prev:
                say("tryout", f"New try-out on Monday: {full_name(r)}" + (f" · {nice_date(r['tryDate'])}" if r["tryDate"] else "")
                    + (f" {r['tryTime']}" if r["tryTime"] else ""))
            elif r["g"] in ON_ROSTER and r["id"] in prev and (prev[r["id"]].get("sch") or "") != r["sch"]:
                say("schedule", f"Schedule (Monday): {full_name(r)} — {prev[r['id']].get('sch') or 'none'} → {r['sch'] or 'none'}", used.get(r["id"]))
        for x in prev.values():
            r = by_id.get(x["id"])
            if x.get("g") == "tryouts" and (not r or r["g"] != "tryouts"):
                nm = f"{x.get('f', '')} {x.get('l', '')}".strip()
                say("tryoutDone", f"Try-out moved on: {nm}" + (f" → {GROUP_WORDS.get(r['g'], r['g'])}" if r else " (no longer on the board)"))

    # 6 · the Coach Board: one document everyone with the Coach Portal reads
    real = set(players) | ({a["pid"] for a in adds} if mode == "live" else set())
    items = []
    for r in rows:
        if r["g"] not in FULL_GROUPS:
            continue
        x = {"id": r["id"], "f": r["first"], "l": r["last"], "g": r["g"], "st": r["status"], "lead": namer(r["lead"]), "asst": namer(r["asst"]),
             "age": r["age"], "sch": r["sch"], "td": r["tryDate"], "tt": r["tryTime"], "pid": used.get(r["id"]) if used.get(r["id"]) in real else ""}
        items.append({k: v for k, v in x.items() if v not in ("", None)})
    same = {}
    for r in rows:
        if r["g"] in ON_ROSTER and r["k1"]:
            same.setdefault(r["k1"], []).append(r)
    cleanup = {
        "dupes": sorted({full_name(v[0]) for v in same.values() if len(v) > 1}),
        "noLast": sorted(r["first"] for r in rows if r["g"] in ON_ROSTER and not r["last"]),
        "noSchedule": sorted(full_name(r) for r in rows if r["g"] == "active" and r["status"] == "active" and not r["sch"]),
        "notOnAccounting": sorted(full_name(r) for r in rows if r["g"] == "notOnAccounting"),
        "portalOnly": sorted(({"pid": pid, "name": players[pid].get("name") or pid} for pid in players
                              if pid not in link and pid not in waiting_add and (players[pid].get("status") or "active") == "active"
                              and players[pid].get("group") != "camp"), key=lambda x: x["name"]),
        "gone": sorted(players[pid].get("name") or pid for pid, h in how.items() if h == "gone"),
    }
    board = {"at": now_ms, "syncedAt": now_iso, "mode": mode, "source": "monday", "counts": counts, "items": items, "cleanup": cleanup}

    kinds = {}
    for e in log:
        kinds[e["k"]] = kinds.get(e["k"], 0) + 1
    would = {"players": len(w_players), "adds": len(adds), "contacts": len(w_contacts), "outbox": len(w_outbox)}
    if mode == "preview":
        w_players, adds, w_contacts, w_outbox = [], [], [], []
    return {"mode": mode, "now": now_ms, "nowIso": now_iso, "log": log, "errors": errors, "counts": kinds, "would": would,
            "players": w_players, "adds": adds, "contacts": w_contacts, "outbox": w_outbox, "board": board}


# ───────────── commands ─────────────
def load(path, default=None):
    try:
        return json.load(open(path, encoding="utf-8"))
    except FileNotFoundError:
        if default is not None:
            return default
        raise Fail(f"{path} is missing — run the earlier step first")


def save(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def cmd_pull(a):
    token, _ = pwfs.sign_in(a.login_file)
    os.makedirs(a.work, exist_ok=True)
    players = fs_list(token, "players")
    outbox = fs_list(token, "outbox")
    one = fs_get_many(token, ["board/current", "syncCfg/main"])
    linked = [f"players/{pid}/private/contact" for pid in players]
    contacts = {p.split("/")[1]: v for p, v in fs_get_many(token, linked).items()}
    state = {"pulledAt": int(time.time() * 1000), "players": players, "outbox": outbox, "contacts": contacts,
             "board": (one.get("board/current") or {}).get("data") or {}, "cfg": (one.get("syncCfg/main") or {}).get("data") or {}}
    save(os.path.join(a.work, "state.json"), state)
    q = sum(1 for o in outbox.values() if o["data"].get("state") == "queued")
    print(f"pulled {len(players)} players, {len(outbox)} queued-change records ({q} waiting to go to Monday), mode {state['cfg'].get('mode') or 'preview'}")


def actions_for(state):
    """the portal's queued changes as monday actions (live mode only). Several status changes for one player → the latest."""
    if (state.get("cfg") or {}).get("mode") != "live":
        return []
    outbox = {oid: x["data"] for oid, x in (state.get("outbox") or {}).items()}
    players = {pid: x["data"] for pid, x in (state.get("players") or {}).items()}
    acts, last_status = [], {}
    for oid in sorted(outbox, key=lambda o: outbox[o].get("at") or 0):
        o = outbox[oid]
        if o.get("state") != "queued" or not REF.match(oid):
            continue
        by, when = o.get("byName") or o.get("by") or "a coach", nice_date(o.get("at"))
        if o.get("type") == "add":
            first = str(o.get("first") or "").strip() or (toks(o.get("name")) and str(o.get("name")).split()[0]) or "New player"
            last = str(o.get("last") or "").strip() or " ".join(str(o.get("name") or "").split()[1:])
            g = o.get("group") or ""
            text = (f"A coach added this player in the PROWORLD portal ({by}, {when}). Where should they go? "
                    f"Portal group: {PORTAL_GROUPS.get(g, g or 'none')}." + (f" Coach: {o['coach']}." if o.get("coach") else "")
                    + (f" Note: {str(o['note'])[:400]}" if o.get("note") else ""))
            acts.append({"ref": oid, "type": "add", "first": first[:120], "last": last[:120], "playerGroup": LEADS_PLAYER_GROUP.get(g, ""),
                         "program": LEADS_PROGRAM.get(g, ""), "note": text, "update": text})
        elif o.get("type") == "status" and o.get("to") in STATUS_LABEL:
            mid = str(o.get("mondayId") or (players.get(o.get("pid")) or {}).get("mondayId") or "")
            if mid:
                last_status[o.get("pid")] = {"ref": oid, "type": "status", "itemId": mid, "label": STATUS_LABEL[o["to"]],
                                             "update": f"Marked {o['to'].title()} in the PROWORLD portal by {by} on {when}."}
    return acts + list(last_status.values())


def cmd_prepare(a):
    state = load(os.path.join(a.work, "state.json"))
    acts = actions_for(state)
    raw = json.dumps(acts, ensure_ascii=False, separators=(",", ":"))
    sha = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    outbox = {oid: x["data"] for oid, x in (state.get("outbox") or {}).items()}
    watch = sorted({str((o.get("result") or {}).get("itemId")) for o in outbox.values() if o.get("type") == "add" and o.get("state") == "sent" and (o.get("result") or {}).get("itemId")})
    v = {"ACTIONS_B64": base64.b64encode(raw.encode("utf-8")).decode("ascii"), "ACTIONS_SHA": sha, "LEADS_WATCH": ",".join(watch)}
    state["actionsSha"] = sha
    save(os.path.join(a.work, "state.json"), state)
    save(os.path.join(a.work, "vars.json"), v)
    print(f"{len(acts)} change(s) for monday" + (" (preview mode: none are sent)" if (state.get('cfg') or {}).get('mode') != 'live' else ""))
    print("VARS " + json.dumps(v, separators=(",", ":")))


def cmd_plan(a):
    state = load(os.path.join(a.work, "state.json"))
    exp = read_monday(a.monday)
    plan = build_plan(state, exp)
    save(os.path.join(a.work, "plan.json"), plan)
    print(f"mode {plan['mode']} · {len(plan['players'])} player updates · {len(plan['adds'])} new · {len(plan['contacts'])} parent-info updates · "
          f"{len(plan['outbox'])} queued-change updates · {len(plan['board']['items'])} on the board")
    for e in plan["log"][:60]:
        print("  - " + e["t"])
    if len(plan["log"]) > 60:
        print(f"  … and {len(plan['log']) - 60} more")
    for e in plan["errors"]:
        print("  ! " + e)


def cmd_apply(a):
    plan = load(os.path.join(a.work, "plan.json"))
    token, _ = pwfs.sign_in(a.login_file)
    done, skipped, errors = 0, [], list(plan.get("errors") or [])
    for w in plan["adds"]:
        ok, why = fs_commit(token, [w])
        if ok:
            done += 1
        else:
            skipped.append(f"{w['name']}: already in the portal under that id")
    for w in plan["players"]:
        ok, why = fs_commit(token, [w])
        if ok:
            done += 1
        else:
            skipped.append(f"{w['name']}: {why} — left for the next run")
    rest = [dict(w, mask=None) if w["path"].endswith("/private/contact") else w for w in plan["contacts"]] + plan["outbox"]
    for i in range(0, len(rest), 200):
        fs_commit(token, rest[i:i + 200])
        done += len(rest[i:i + 200])
    log = list(plan["log"]) + [{"k": "skippedWrite", "t": s} for s in skipped]
    run_id = datetime.datetime.fromtimestamp(plan["now"] / 1000, datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
    counts = dict(plan["counts"])
    if skipped:
        counts["skippedWrite"] = len(skipped)
    entry = {"at": plan["now"], "mode": plan["mode"], "ok": not errors, "counts": counts, "entries": log[:400], "more": max(0, len(log) - 400),
             "errors": errors, "by": "Monday sync", "board": len(plan["board"]["items"])}
    fs_commit(token, [{"path": "board/current", "data": plan["board"]}, {"path": f"syncLog/{run_id}", "data": entry}])
    print(f"{plan['mode']}: wrote {done} roster record(s), the Coach Board and the change log syncLog/{run_id}"
          + (f"; {len(skipped)} left for the next run" if skipped else "") + (f"; {len(errors)} warning(s)" if errors else ""))


def cmd_note(a):
    """a run that could not finish says so in the change log, so nobody trusts a stale board"""
    token, _ = pwfs.sign_in(a.login_file)
    now = int(time.time() * 1000)
    run_id = datetime.datetime.fromtimestamp(now / 1000, datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
    why = re.sub(r"\s+", " ", a.why).strip()[:500] or "the run stopped"
    fs_commit(token, [{"path": f"syncLog/{run_id}", "data": {"at": now, "mode": "", "ok": False, "counts": {}, "entries": [],
                                                              "errors": [why], "by": "Monday sync"}}])
    print(f"recorded in the change log: {why}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("pull"); p.add_argument("--login-file", required=True); p.add_argument("--work", required=True); p.set_defaults(fn=cmd_pull)
    p = sub.add_parser("prepare"); p.add_argument("--work", required=True); p.set_defaults(fn=cmd_prepare)
    p = sub.add_parser("plan"); p.add_argument("--work", required=True); p.add_argument("--monday", required=True); p.set_defaults(fn=cmd_plan)
    p = sub.add_parser("apply"); p.add_argument("--work", required=True); p.add_argument("--login-file", required=True); p.set_defaults(fn=cmd_apply)
    p = sub.add_parser("note"); p.add_argument("--login-file", required=True); p.add_argument("--why", required=True); p.set_defaults(fn=cmd_note)
    a = ap.parse_args()
    try:
        a.fn(a)
    except (Fail, pwfs.Fail) as e:
        print("pwroster: " + str(e), file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
