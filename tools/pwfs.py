#!/usr/bin/env python3
"""pwfs.py — read and write the PROWORLD marketing record in the team database, for the scheduled runs.

The Marketing Command Center (https://proworld-coach-portal.web.app/marketing/) keeps its record in Firestore
(project proworld-coach-portal) under apps/marketing/<collection>/<id>. Each document holds the page's body as
JSON text: { json: "<body>", at: "<ISO time>", by: "<who saved it>" }, where <body> is {v: <value>, at, ...}
(ideaBank bodies also carry "coach").

The runs sign in as one dedicated account (email + password, made by the owner in Firebase Authentication).
The database rules let that account read and write the marketing record and nothing else.

  python3 pwfs.py check --login-file login.txt                      sign in, count the documents
  python3 pwfs.py pull  --out work --login-file login.txt           every document → work/<collection>/<id>.json
  python3 pwfs.py push  --src work --login-file login.txt --by "PROWORLD engine"
                                                                    write back only what changed or is new

login.txt: the first non-empty line is the email, the second the password (the Drive doc "PROWORLD runs login").
push never deletes, and guards every write with the version it pulled, so a teammate's newer edit is never
overwritten: such a document is reported as CONFLICT (exit code 3) and left alone. Standard library only.
"""
import argparse, hashlib, json, os, sys, time, urllib.error, urllib.parse, urllib.request

API_KEY = "AIzaSyBauu-JZZKCzex-PpTjBpD4QuTSWIkVEs4"          # public identifier of the web app, not a secret
PROJECT = "proworld-coach-portal"
BASE = "apps/marketing"
COLLECTIONS = ["state", "ideaBank", "weeks", "archive", "reports", "numbers"]
AUTH_URL = os.environ.get("PWFS_AUTH_URL", "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword")
FS_URL = os.environ.get("PWFS_FS_URL", "https://firestore.googleapis.com/v1")
DOCS = f"{FS_URL}/projects/{PROJECT}/databases/(default)/documents"
MANIFEST = ".pulled.json"
MAX_JSON = 900_000


class Fail(Exception):
    pass


def canon(body):
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(body):
    return hashlib.sha256(canon(body).encode("utf-8")).hexdigest()


def read_login(path):
    try:
        lines = [l.strip() for l in open(path, encoding="utf-8").read().splitlines() if l.strip()]
    except OSError as e:
        raise Fail(f"can't read the login file: {e.strerror}")
    if len(lines) < 2 or "@" not in lines[0]:
        raise Fail("the login file needs two lines: the runs account's email, then its password")
    return lines[0], lines[1]


def http(method, url, body=None, token=None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            j = json.loads(raw)
        except Exception:
            j = {"error": {"message": raw.decode("utf-8", "replace")[:300]}}
        return e.code, j
    except urllib.error.URLError as e:
        raise Fail(f"no connection to {urllib.parse.urlsplit(url).netloc} ({e.reason}) — is the host allowed in the environment's network settings?")


def sign_in(login_file):
    email, password = read_login(login_file)
    st, j = http("POST", f"{AUTH_URL}?key={API_KEY}", {"email": email, "password": password, "returnSecureToken": True})
    if st != 200:
        msg = (j.get("error") or {}).get("message", f"HTTP {st}")
        hint = {"INVALID_LOGIN_CREDENTIALS": "the email or password in the login file is wrong",
                "EMAIL_NOT_FOUND": "there is no such account in Firebase Authentication",
                "INVALID_PASSWORD": "the password in the login file is wrong",
                "USER_DISABLED": "the runs account is disabled in Firebase Authentication",
                "OPERATION_NOT_ALLOWED": "Email/Password sign-in is switched off in Firebase Authentication"}.get(msg.split(" ")[0], "")
        raise Fail(f"sign-in refused: {msg}" + (f" — {hint}" if hint else ""))
    return j["idToken"], j.get("localId", "")


def list_collection(token, col):
    out, page = [], None
    while True:
        q = {"pageSize": "300"}
        if page:
            q["pageToken"] = page
        st, j = http("GET", f"{DOCS}/{BASE}/{col}?" + urllib.parse.urlencode(q), token=token)
        if st == 403:
            raise Fail(f"permission denied reading {BASE}/{col} — the database rules don't recognise this account yet (RUNS_UID)")
        if st != 200:
            raise Fail(f"reading {BASE}/{col} failed: HTTP {st} {(j.get('error') or {}).get('message', '')}")
        out.extend(j.get("documents", []))
        page = j.get("nextPageToken")
        if not page:
            return out


def field(doc, name):
    f = (doc.get("fields") or {}).get(name) or {}
    return f.get("stringValue")


def cmd_check(a):
    token, uid = sign_in(a.login_file)
    total = 0
    for col in COLLECTIONS:
        n = len(list_collection(token, col))
        total += n
        print(f"  {col:9s} {n}")
    print(f"ok: signed in as the runs account ({uid[:6]}…), {total} documents readable")


def cmd_pull(a):
    token, _ = sign_in(a.login_file)
    os.makedirs(a.out, exist_ok=True)
    manifest, total = {}, 0
    for col in COLLECTIONS:
        os.makedirs(os.path.join(a.out, col), exist_ok=True)
        for d in list_collection(token, col):
            doc_id = urllib.parse.unquote(d["name"].rsplit("/", 1)[-1])
            text = field(d, "json")
            if text is None:
                print(f"  skipped {col}/{doc_id}: no json field", file=sys.stderr)
                continue
            body = json.loads(text)
            with open(os.path.join(a.out, col, doc_id + ".json"), "w", encoding="utf-8") as f:
                json.dump(body, f, ensure_ascii=False, indent=1)
            manifest[f"{col}/{doc_id}"] = {"updateTime": d.get("updateTime"), "hash": digest(body)}
            total += 1
    with open(os.path.join(a.out, MANIFEST), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1)
    print(f"pulled {total} documents into {a.out}/")


def cmd_push(a):
    mpath = os.path.join(a.src, MANIFEST)
    manifest = json.load(open(mpath, encoding="utf-8")) if os.path.exists(mpath) else {}
    changed = []
    for col in COLLECTIONS:
        folder = os.path.join(a.src, col)
        if not os.path.isdir(folder):
            continue
        for name in sorted(os.listdir(folder)):
            if not name.endswith(".json"):
                continue
            doc_id = name[:-5]
            body = json.load(open(os.path.join(folder, name), encoding="utf-8"))
            if not isinstance(body, dict) or "v" not in body:
                raise Fail(f"{col}/{name} is not a document body (it needs a top-level \"v\")")
            key = f"{col}/{doc_id}"
            if key in manifest and manifest[key]["hash"] == digest(body):
                continue
            changed.append((col, doc_id, body))
    if not changed:
        print("nothing changed — no writes")
        return
    token, _ = sign_in(a.login_file)
    conflicts, written = [], []
    for col, doc_id, body in changed:
        key = f"{col}/{doc_id}"
        text = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
        if len(text) > MAX_JSON:
            raise Fail(f"{key} is too big for one document ({len(text)} characters)")
        at = str(body.get("at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        q = {"currentDocument.updateTime": manifest[key]["updateTime"]} if key in manifest and manifest[key].get("updateTime") else {"currentDocument.exists": "false"}
        url = f"{DOCS}/{BASE}/{col}/{urllib.parse.quote(doc_id, safe='')}?" + urllib.parse.urlencode(q)
        st, j = http("PATCH", url, {"fields": {"json": {"stringValue": text}, "at": {"stringValue": at}, "by": {"stringValue": a.by}}}, token=token)
        if st == 200:
            manifest[key] = {"updateTime": j.get("updateTime"), "hash": digest(body)}
            written.append(key)
        elif st in (400, 409) and ("FAILED_PRECONDITION" in json.dumps(j) or "ALREADY_EXISTS" in json.dumps(j) or st == 409):
            conflicts.append(key)
        elif st == 403:
            raise Fail(f"permission denied writing {key} — the database rules don't let this account write there")
        else:
            raise Fail(f"writing {key} failed: HTTP {st} {(j.get('error') or {}).get('message', '')}")
    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1)
    for k in written:
        print(f"  wrote {k}")
    print(f"pushed {len(written)} document(s)")
    if conflicts:
        for k in conflicts:
            print(f"  CONFLICT {k} — changed in the database after the pull; pull again, reapply your change, push again")
        sys.exit(3)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check"); c.add_argument("--login-file", required=True); c.set_defaults(fn=cmd_check)
    p = sub.add_parser("pull"); p.add_argument("--out", required=True); p.add_argument("--login-file", required=True); p.set_defaults(fn=cmd_pull)
    s = sub.add_parser("push"); s.add_argument("--src", required=True); s.add_argument("--login-file", required=True); s.add_argument("--by", default="PROWORLD run"); s.set_defaults(fn=cmd_push)
    a = ap.parse_args()
    try:
        a.fn(a)
    except Fail as e:
        print("pwfs: " + str(e), file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
