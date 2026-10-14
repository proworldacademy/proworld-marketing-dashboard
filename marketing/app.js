/* PROWORLD Marketing Command Center — app logic
   Recovered from proworldacademy/proworld-marketing-dashboard (May 2026) and rebuilt as a
   Claude artifact; since Oct 13, 2026 it lives on GitHub Pages. Its memory is the set of encrypted
   documents under /data in this repository (see shared/store.js): every change becomes a commit the
   moment it is made, everyone with the passcode sees the same record, and the engine runs read and
   write the same documents from outside. */
(function () {
  "use strict";
  const D = window.PW_DATA;
  const { COACHES, PILLARS, PLATFORMS, PRELOADED, IDEA_BANK_SEED, PRODUCTION_BANK_SEED, ALREADY_POSTED_IDS, COACH_WEEKLY_COUNT } = D;
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const SM = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  // ───────────────────────── toast ─────────────────────────
  let toastT;
  function toast(msg, err) {
    const t = $("toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
    clearTimeout(toastT); toastT = setTimeout(() => (t.className = "toast"), 2600);
  }
  window.toast = toast;

  // ───────────────────────── in-page dialogs ─────────────────────────
  // The artifact sandbox blocks window.prompt/confirm/alert, so every edit or
  // confirmation goes through this small modal instead.
  function openModal(html) {
    const root = $("modal-root"); root.innerHTML = '<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true">' + html + "</div></div>"; root.hidden = false;
    const first = root.querySelector("input,textarea,select,button"); if (first) first.focus();
    return root;
  }
  function closeModal() { const root = $("modal-root"); root.hidden = true; root.innerHTML = ""; }
  function askConfirm(title, message, okLabel, danger) {
    return new Promise((resolve) => {
      const root = openModal("<h3>" + esc(title) + "</h3><p>" + esc(message) + '</p><div class="btn-row"><button class="btn ghost muted" id="m-cancel">Cancel</button><button class="btn' + (danger ? " orchid" : "") + '" id="m-ok">' + esc(okLabel || "Confirm") + "</button></div>");
      root.querySelector("#m-cancel").onclick = () => { closeModal(); resolve(false); };
      root.querySelector("#m-ok").onclick = () => { closeModal(); resolve(true); };
      root.querySelector(".modal-bg").addEventListener("click", (e) => { if (e.target.classList.contains("modal-bg")) { closeModal(); resolve(false); } });
    });
  }
  function askForm(title, fields, okLabel, intro) {
    return new Promise((resolve) => {
      let html = "<h3>" + esc(title) + "</h3>" + (intro ? "<p>" + esc(intro) + "</p>" : "");
      fields.forEach((f) => {
        const id = "m-f-" + f.key; html += '<div class="field"><label for="' + id + '">' + esc(f.label) + "</label>";
        if (f.type === "textarea") html += '<textarea id="' + id + '" rows="' + (f.rows || 3) + '">' + esc(f.value || "") + "</textarea>";
        else if (f.type === "select") html += '<select id="' + id + '">' + f.options.map((o) => "<option" + (o === f.value ? " selected" : "") + ">" + esc(o) + "</option>").join("") + "</select>";
        else html += '<input type="text" id="' + id + '" value="' + esc(f.value || "") + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "") + ">";
        html += "</div>";
      });
      html += '<div class="btn-row"><button class="btn ghost muted" id="m-cancel">Cancel</button><button class="btn" id="m-ok">' + esc(okLabel || "Save") + "</button></div>";
      const root = openModal(html);
      const done = (ok) => { if (!ok) { closeModal(); resolve(null); return; } const out = {}; fields.forEach((f) => (out[f.key] = root.querySelector("#m-f-" + f.key).value.trim())); closeModal(); resolve(out); };
      root.querySelector("#m-cancel").onclick = () => done(false);
      root.querySelector("#m-ok").onclick = () => done(true);
      root.querySelector(".modal-bg").addEventListener("click", (e) => { if (e.target.classList.contains("modal-bg")) done(false); });
      root.querySelector(".modal").addEventListener("keydown", (e) => { if (e.key === "Escape") done(false); if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") { e.preventDefault(); done(true); } });
    });
  }
  const IDEA_FORMATS = ["Reel", "Carousel", "Talking Head", "Story", "Static Post"];
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Daily"];
  function ideaFields(i) {
    return [
      { key: "title", label: "Title", value: i.title },
      { key: "format", label: "Format", type: "select", options: IDEA_FORMATS.includes(i.format) ? IDEA_FORMATS : [i.format].concat(IDEA_FORMATS), value: i.format },
      { key: "day", label: "Post day", type: "select", options: DAYS.includes(i.day) ? DAYS : [i.day].concat(DAYS), value: i.day },
      { key: "desc", label: "Filming notes", type: "textarea", value: i.desc },
      { key: "hook", label: "Hook", value: i.hook || "" }
    ];
  }

  // ───────────────────────── shared store ─────────────────────────
  const DEFAULT_PRIORITIES = [
    { t: "Deploy coach assignments", d: "Approve the week and send the brief to all coaches Sunday night" },
    { t: "Daily Academy Vibes", d: "2–3 iPhone clips from court every single day as a story" },
    { t: "Tournament promo", d: "Mon · Wed · Fri — upcoming events, dates, registration link" },
    { t: "Players in Action recap", d: "Weekly compilation of ProWorld players competing — tag every player" }
  ];
  const DEFAULTS = {
    archive: PRELOADED.slice(),
    cadence: {},
    usedIdeas: [],
    usedProd: [],
    ideaBank: IDEA_BANK_SEED,
    prodBank: PRODUCTION_BANK_SEED,
    kpi: [],
    priorities: DEFAULT_PRIORITIES,
    ads: { account: "act_294537641553384", budget: "$100/day", top: "Soccer Static", campaign: "Summer 2026", status: "LIVE" },
    // the schedule: every week's brief, keyed by its Sunday (YYYY-MM-DD) — drafts and approved weeks alike
    weeks: {},
    // content engine (Oct 2026)
    pillars: window.PW_PILLARS || [],
    cadencePlan: { start: "2026-10-04", posts0: 1, stories0: 2, postsStep: 1, storiesStep: 2, postsCap: 3, storiesCap: 6 },
    daily: {},
    requests: [],
    team: { manager: "Manu", editor: "Khang Dinh Nhu", photographer: "", photographerCadence: "Weekly", shootDay: "Wed" },
    engineLog: [],
    // market intelligence: accounts the engine watches, what it read, and the standing to-dos
    watchlist: window.PW_WATCHLIST || [],
    market: [],
    reminders: window.PW_REMINDERS || [],
    // the weekly recipe (see buildWeek): 5 coach videos + 1 ad video + 2 carousels = 7 posts + 1 spare
    recipe: null,
    // the strategy brief the engine runs follow (edited on the Content Database tab)
    strategy: { focus: [], mix: [], avoid: [], facts: [] },
    // reports posted by the Monday review and the Sunday engine, keyed by "<date>_<by>"
    reports: {}
  };
  const S = {};
  // ── Memory. The record lives in the artifact's shared database (db capability): one document per
  // piece of state, the big ones sharded — a document per coach bank, per week, per archive year.
  // Everyone who opens the page reads the same documents live; writers (owner, editors, contributors)
  // save straight into them; the Sunday and Monday engine runs read and write the same documents from
  // outside. The <script id="pw-state"> snapshot in the page is only a fallback for a view that cannot
  // reach the database (signed out, local preview) and the seed for an empty database.
  //   state/<key>            { v, at }            every small key (priorities, kpi, requests, pillars …)
  //   ideaBank/<coach slug>  { coach, v: [ideas], at }
  //   weeks/<sunday>         { v: week, at }
  //   archive/<year>         { v: [posts], at }
  const SHARDED = { ideaBank: true, weeks: true, archive: true, reports: true };
  const slug = (s) => String(s).replace(/[^A-Za-z0-9_\-.~:@+]/g, "_");
  const yearOf = (p) => (/^\d{4}/.test(String(p && p.date || "")) ? String(p.date).slice(0, 4) : "misc");
  // canonical JSON (sorted keys) so a document echoed back by the store with its keys in another order still reads as unchanged
  const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === "object" && !Array.isArray(v)) ? Object.keys(v).sort().reduce((o, kk) => { o[kk] = v[kk]; return o; }, {}) : v);
  let db = null, usr = null, readOnly = false, dbReady = false, loadedAt = null;
  const dirty = new Set(); let flushTimer = null, flushing = false, flushingKeys = new Set(), retries = 0;
  const written = {};                                          // doc path → JSON of the value last read from / written to the database
  const known = { ideaBank: {}, weeks: {}, archive: {}, reports: {} };      // sharded key → { docPath: shard id } (so a removed shard gets deleted)
  function readEmbedded() {
    try { const el = document.getElementById("pw-state"); if (!el) return null; const j = JSON.parse(el.textContent || "null"); return j && j.v ? j : null; } catch (e) { return null; }
  }
  function initLocal() {
    const emb = readEmbedded(); loadedAt = emb ? emb.savedAt : null;
    Object.keys(DEFAULTS).forEach((k) => { const v = emb && emb.v && emb.v[k] !== undefined ? emb.v[k] : undefined; S[k] = v === undefined ? clone(DEFAULTS[k]) : v; });
    if (!S.weeks || typeof S.weeks !== "object" || Array.isArray(S.weeks)) S.weeks = {};
    recomputeUsed();
  }
  // the documents that represent one state key right now
  function docsFor(key) {
    const at = new Date().toISOString();
    if (key === "ideaBank") return Object.keys(S.ideaBank || {}).map((c) => ({ path: "ideaBank/" + slug(c), shard: c, body: { coach: c, v: S.ideaBank[c] || [], at } }));
    if (key === "weeks") return Object.keys(S.weeks || {}).map((ws) => ({ path: "weeks/" + slug(ws), shard: ws, body: { v: S.weeks[ws], at } }));
    if (key === "archive") { const by = {}; (S.archive || []).forEach((p) => { const y = yearOf(p); (by[y] = by[y] || []).push(p); }); return Object.keys(by).map((y) => ({ path: "archive/" + y, shard: y, body: { v: by[y], at } })); }
    if (key === "reports") return Object.keys(S.reports || {}).map((id) => ({ path: "reports/" + slug(id), shard: id, body: { v: S.reports[id], at } }));
    return [{ path: "state/" + key, shard: null, body: { v: S[key], at } }];
  }
  // one document from the database → S; returns the state key it touched
  function applyDoc(col, id, body) {
    if (!body || body.v === undefined) return null;
    if (col === "state") { if (!(id in DEFAULTS)) return null; S[id] = clone(body.v); return id; }
    if (col === "ideaBank") { const c = body.coach || id; S.ideaBank[c] = clone(body.v); known.ideaBank["ideaBank/" + id] = c; return "ideaBank"; }
    if (col === "weeks") { const ws = (body.v && body.v.weekStart) || id; S.weeks[ws] = clone(body.v); known.weeks["weeks/" + id] = ws; return "weeks"; }
    if (col === "archive") { known.archive["archive/" + id] = id; S.archive = (S.archive || []).filter((p) => yearOf(p) !== id).concat(clone(body.v || [])); S.archive.sort((a, b) => String(b.date).localeCompare(String(a.date))); return "archive"; }
    if (col === "reports") { S.reports = S.reports || {}; S.reports[id] = Object.assign({ id }, clone(body.v)); known.reports["reports/" + id] = id; return "reports"; }
    return null;
  }
  function removeDoc(col, id) {
    if (col === "ideaBank") { const c = known.ideaBank["ideaBank/" + id]; if (c) delete S.ideaBank[c]; delete known.ideaBank["ideaBank/" + id]; return "ideaBank"; }
    if (col === "weeks") { const ws = known.weeks["weeks/" + id] || id; delete S.weeks[ws]; delete known.weeks["weeks/" + id]; return "weeks"; }
    if (col === "archive") { S.archive = (S.archive || []).filter((p) => yearOf(p) !== id); delete known.archive["archive/" + id]; return "archive"; }
    if (col === "reports") { if (S.reports) delete S.reports[id]; delete known.reports["reports/" + id]; return "reports"; }
    return null;
  }
  const COLS = ["state", "ideaBank", "weeks", "archive", "reports"];
  async function loadDb() {
    const snaps = await Promise.all(COLS.map((c) => db.collection(c).get()));
    const docs = []; snaps.forEach((s, i) => s.docs.forEach((d) => { if (d.exists) docs.push({ col: COLS[i], id: d.id, body: d.data() }); }));
    if (!docs.some((d) => d.body && d.body.v !== undefined)) return false;
    S.ideaBank = {}; S.weeks = {}; S.archive = []; S.reports = {};     // the database is the record for the sharded keys
    let latest = "";
    docs.forEach((d) => { if (!d.body || d.body.v === undefined) return; applyDoc(d.col, d.id, d.body); written[d.col + "/" + d.id] = canon(d.body.v); if (d.body.at > latest) latest = d.body.at; });
    if (!S.weeks || typeof S.weeks !== "object" || Array.isArray(S.weeks)) S.weeks = {};
    recomputeUsed(); loadedAt = latest || loadedAt;
    return true;
  }
  function subscribe() {
    COLS.forEach((col) => {
      db.collection(col).onSnapshot((snap) => {
        const touched = new Set();
        snap.docChanges().forEach((ch) => {
          const d = ch.doc, path = col + "/" + d.id;
          if (ch.type === "removed") { if (written[path] !== undefined) { delete written[path]; const k = removeDoc(col, d.id); if (k) touched.add(k); } return; }
          const body = d.data(); if (!body || body.v === undefined) return;
          const j = canon(body.v); if (written[path] === j) return;             // our own write echoed back, or nothing new
          const key = col === "state" ? d.id : col; if (dirty.has(key) || flushingKeys.has(key)) return;   // a local change is on its way — it wins
          written[path] = j; const k = applyDoc(col, d.id, body); if (k) touched.add(k);
        });
        if (touched.size) { if (touched.has("weeks")) recomputeUsed(); loadedAt = new Date().toISOString(); renderAll(); }
      }, (e) => { console.error("memory subscription", e); if (e && e.code === "revoked") { readOnly = true; setLive("readonly"); } });
    });
  }
  function save(key) {
    if (!key || key === "all") Object.keys(DEFAULTS).forEach((k) => dirty.add(k)); else dirty.add(key);
    if (readOnly) { setLive("readonly"); return; }
    if (!db) { setLive(dbReady ? "local" : "connecting"); return; }
    setLive("saving"); clearTimeout(flushTimer); flushTimer = setTimeout(flush, 600);
  }
  async function flush() {
    if (!db || readOnly) return;
    if (flushing) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 600); return; }
    flushing = true; flushingKeys = new Set(dirty); dirty.clear(); let failed = null, stop = false;
    try {
      for (const key of flushingKeys) {
        if (stop) { dirty.add(key); continue; }
        const docs = docsFor(key);
        for (const d of docs) {
          const j = canon(d.body.v); if (written[d.path] === j) continue;
          if (j.length > 240000) { toast("One record is too big to save (" + d.path + ") — tell Antonio", true); continue; }
          const prev = written[d.path]; written[d.path] = j;
          try { await db.doc(d.path).set(d.body); if (d.shard !== null) known[key][d.path] = d.shard; }
          catch (e) {
            if (prev === undefined) delete written[d.path]; else written[d.path] = prev;
            const code = (e && e.code) || "error";
            if (code === "invalid_argument" || code === "not_granted" || code === "capability_disabled" || code === "capability_removed" || code === "revoked") { readOnly = true; stop = true; failed = code; toast("Not saved — sign in with GitHub (header button) to save changes.", true); break; }
            if (code === "quota_exceeded") { stop = true; failed = code; toast("The shared memory is full — tell Antonio (" + (e.message || "") + ")", true); break; }
            failed = code; dirty.add(key); break;                       // transient: keep it dirty and retry below
          }
        }
        if (SHARDED[key] && !stop) {                                      // shards that no longer exist: a deleted week, a removed bank, an emptied year
          const now = new Set(docs.map((d) => d.path));
          for (const p of Object.keys(known[key])) { if (now.has(p)) continue; try { await db.doc(p).delete(); delete known[key][p]; delete written[p]; } catch (e) { failed = (e && e.code) || "error"; dirty.add(key); } }
        }
      }
    } finally { flushing = false; flushingKeys = new Set(); }
    if (readOnly) { setLive("readonly"); return; }
    if (dirty.size) {
      if (failed && failed !== "quota_exceeded") { retries++; setLive("error"); if (retries <= 6) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, Math.min(15000, 1500 * retries)); } else toast("Couldn't save — check your connection and change something again to retry", true); }
      else { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 300); }
      return;
    }
    retries = 0; setLive(failed ? "error" : "shared");
  }
  window.addEventListener("beforeunload", (e) => { if ((dirty.size || flushing) && !readOnly && db) { e.preventDefault(); e.returnValue = ""; } });
  function setLive(mode) {
    const p = $("live-pill"); if (!p) return;
    p.className = "live" + (mode === "shared" ? "" : mode === "saving" || mode === "connecting" ? " saving" : " local");
    $("live-txt").textContent = mode === "shared" ? "LIVE · SAVED" : mode === "saving" ? "SAVING…" : mode === "connecting" ? "CONNECTING" : mode === "readonly" ? "VIEWING" : mode === "error" ? "NOT SAVED" : mode === "local" ? "OFFLINE" : "LIVE";
    p.title = mode === "shared" ? "Every change is committed to the team's GitHub repository the moment you make it" : mode === "readonly" ? "Viewing — sign in with GitHub (header) to save changes" : mode === "local" ? "Not connected to the shared memory" : mode === "error" ? "A save failed — retrying" : "";
  }
  async function initDb() {
    // GitHub edition: PWGit asks for the team passcode, decrypts the documents in the browser and hands
    // back an adapter shaped like the artifact database. Saving needs a GitHub sign-in (header button).
    let opened = null;
    try { opened = window.PWGit ? await window.PWGit.open() : null; } catch (e) { console.error("memory open", e); opened = null; }
    dbReady = true;
    if (!opened) { readOnly = true; setLive("local"); return; }
    db = opened.db; if (!opened.canWrite) readOnly = true;
    let loaded = false;
    try { loaded = await loadDb(); } catch (e) { console.error("memory load", e); setLive("error"); toast("Couldn't read the shared memory from GitHub — " + (e.message || e), true); return; }
    if (!loaded) {
      if (readOnly) { setLive("readonly"); subscribe(); return; }
      toast("The repository has no memory yet — saving the page's defaults as the first record"); save("all");
    }
    subscribe();
    showWeek(curWS); renderAll();
    setLive(readOnly ? "readonly" : "shared");
  }

  // ───────────────────────── tabs ─────────────────────────
  document.querySelectorAll(".tab-btn").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    b.classList.add("active"); $("tab-" + b.dataset.tab).classList.add("active");
  }));
  (function () { const d = new Date(); $("today-date").textContent = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); })();

  // ───────────────────────── season / theme ─────────────────────────
  function detectWeekTheme(d) {
    const m = (d || new Date()).getMonth();
    if (m >= 4 && m <= 7) return { theme: "Summer Camp Push", pillar: "promo", when: "Jun 1 – Aug 7" };
    if (m === 8) return { theme: "Fall Enrollment + Tournament Season", pillar: "promo", when: "September" };
    if (m === 9 || m === 10) return { theme: "Thanksgiving Camp + Tournament Season", pillar: "promo", when: "Oct – Nov · camp week Nov 23–27" };
    if (m === 11) return { theme: "Holiday Camp + Year-End Reflection", pillar: "promo", when: "December" };
    if (m === 0) return { theme: "New Year Goals + Mental Performance", pillar: "mental", when: "January" };
    if (m === 1 || m === 2) return { theme: "Spring Camp + Development", pillar: "tennis", when: "Feb – Mar" };
    if (m === 3) return { theme: "Summer Camp Enrollment Opens + Spring Tournaments", pillar: "promo", when: "April" };
    return { theme: "", pillar: "", when: "" };
  }
  function pillarFromTheme(theme) {
    const lc = theme.toLowerCase();
    if (/camp|summer|trial|enrollment/.test(lc)) return "promo";
    if (/mental|mindset|ritual/.test(lc)) return "mental";
    if (/tournament|compete/.test(lc)) return "tournament";
    if (/fitness|recover|nutrition/.test(lc)) return "fitness";
    if (/parent/.test(lc)) return "parents";
    if (/tour|travel|itf/.test(lc)) return "tour";
    if (/soccer/.test(lc)) return "soccer";
    return "";
  }

  // ───────────────────────── overview ─────────────────────────
  const PILLAR_MIX = [
    ["Tennis — HP & Competitive", 25], ["Tennis — Developmental U12/U10/U8", 20], ["Tennis — Tips, Drills & Tournament", 12],
    ["Tennis — On Tour / Mental", 13], ["Soccer", 10], ["Parents Corner", 8], ["Culture & Community", 8],
    ["Fitness & Recovery", 5], ["Programs & Promos", 5]
  ];
  function renderOverview() {
    const season = detectWeekTheme(new Date());
    $("ov-season").textContent = season.theme.split(" + ")[0] || "—";
    $("ov-season-sub").textContent = season.theme.includes(" + ") ? season.theme.split(" + ")[1] + " · " + season.when : season.when;
    const d = thisWeek(), nxt = (S.weeks || {})[shiftWS(wsOf(new Date()), 1)];
    if (d) {
      const tot = d.coaches.reduce((s, c) => s + c.ideas.length, 0), done = d.coaches.reduce((s, c) => s + c.ideas.filter((i) => i.delivered).length, 0);
      $("ov-videos").textContent = done + "/" + tot; $("ov-videos-sub").textContent = "Delivered · week of " + d.weekDates + (d.locked ? " · approved" : " · draft");
      const pt = (d.production || []).length, pd = (d.production || []).filter((i) => i.delivered).length;
      $("ov-prod").textContent = pd + "/" + pt; $("ov-prod-sub").textContent = "Done · ad video + carousels" + (nxt ? " · next week " + (nxt.locked ? "approved" : "drafted") : "");
    } else { $("ov-videos").textContent = "—"; $("ov-videos-sub").textContent = "No brief for this week yet — Coach Assignments"; $("ov-prod").textContent = "—"; $("ov-prod-sub").textContent = nxt ? "Next week is " + (nxt.locked ? "approved" : "drafted") : "Ad video + carousels"; }
    $("priorities").innerHTML = S.priorities.map((p, i) => '<div class="pri"><div class="pri-n">' + (i + 1) + '</div><div><div class="pri-t">' + esc(p.t) + '</div><div class="pri-d">' + esc(p.d) + '</div></div></div>').join("");
    const mix = (S.pillars && S.pillars.length ? S.pillars.map((p) => [p.name, p.share]) : PILLAR_MIX);
    $("pillar-mix").innerHTML = mix.map((p) => '<div class="pillar-row"><div class="pillar-name">' + esc(p[0]) + '</div><div class="bar"><i style="width:' + Math.min(100, p[1] * 3) + '%"></i></div><div class="pillar-pct">' + p[1] + '%</div></div>').join("");
    updateCadenceStats();
  }
  window.editPriorities = async function () {
    const cur = S.priorities.map((p) => p.t + " — " + p.d).join("\n");
    const r = await askForm("Edit priorities", [{ key: "v", label: "One per line — Title — detail", type: "textarea", rows: 7, value: cur }], "Save priorities");
    if (!r) return; const v = r.v;
    S.priorities = v.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf("—"); return i > 0 ? { t: l.slice(0, i).trim(), d: l.slice(i + 1).trim() } : { t: l, d: "" }; });
    save("priorities"); renderOverview(); toast("Priorities updated");
  };

  // ───────────────────────── KPI ─────────────────────────
  const IG_FIELDS = [["foll", "Followers"], ["reach", "Reach"], ["pv", "Profile views"], ["likes", "Likes"], ["comments", "Comments"], ["shares", "Shares"]];
  const AD_FIELDS = [["leads", "Leads"], ["reach", "Reach"], ["clicks", "Link clicks"], ["spend", "Spend ($)"], ["male", "Male %"], ["female", "Female %"]];
  function kpiInputs(prefix, fields, when) {
    return fields.map((f) => '<div class="field"><label for="' + prefix + "-" + f[0] + "-" + when + '">' + f[1] + '</label><input type="number" inputmode="decimal" id="' + prefix + "-" + f[0] + "-" + when + '" placeholder="0"></div>').join("");
  }
  $("ig-now").innerHTML = kpiInputs("ig", IG_FIELDS, "now"); $("ig-prev").innerHTML = kpiInputs("ig", IG_FIELDS, "prev");
  $("ad-now").innerHTML = kpiInputs("ad", AD_FIELDS, "now"); $("ad-prev").innerHTML = kpiInputs("ad", AD_FIELDS.slice(0, 4), "prev");
  function pctChange(now, prev) {
    const n = parseFloat(now) || 0, p = parseFloat(prev) || 0;
    if (p === 0) return n > 0 ? "new" : "0%";
    const pct = (n - p) / p * 100; return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
  }
  window.calcGrowth = function () {
    const rows = IG_FIELDS.map((f) => ["IG " + f[1], "ig-" + f[0]]).concat(AD_FIELDS.slice(0, 4).map((f) => ["Ads " + f[1], "ad-" + f[0]]));
    let html = '<div class="card"><div class="card-label">Growth snapshot</div><div class="grid-3">';
    rows.forEach((r) => {
      const now = $(r[1] + "-now").value || "0", prev = $(r[1] + "-prev").value || "0", ch = pctChange(now, prev);
      html += '<div class="stat' + (ch.startsWith("-") ? " orchid" : " mint") + '"><div class="stat-num" style="font-size:32px">' + esc(now) + '</div><div class="stat-label">' + esc(r[0]) + '</div><div class="stat-delta' + (ch.startsWith("-") ? " down" : "") + '">' + ch + ' vs last week</div></div>';
    });
    $("growth-results").innerHTML = html + "</div></div>";
  };
  window.saveKPIs = function () {
    const snap = { date: new Date().toISOString(), data: {} };
    document.querySelectorAll("#tab-kpi input").forEach((i) => { if (i.value !== "") snap.data[i.id] = i.value; });
    if (!Object.keys(snap.data).length) { toast("Enter some numbers first", true); return; }
    S.kpi.unshift(snap); if (S.kpi.length > 60) S.kpi.length = 60;
    save("kpi"); renderKpiHistory(); toast("KPI snapshot saved");
  };
  function renderKpiHistory() {
    const card = $("kpi-history-card"); card.hidden = S.kpi.length === 0;
    $("kpi-history").innerHTML = S.kpi.slice(0, 12).map((s, i) => {
      const d = new Date(s.date); const g = s.data;
      const bits = [["Followers", g["ig-foll-now"]], ["Reach", g["ig-reach-now"]], ["Leads", g["ad-leads-now"]], ["Spend", g["ad-spend-now"] ? "$" + g["ad-spend-now"] : ""]].filter((b) => b[1]);
      return '<div class="approved-row"><div><strong>' + SM[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() + '</strong><div class="small">' + bits.map((b) => b[0] + " " + esc(b[1])).join(" · ") + '</div></div><div class="btn-row"><button class="btn ghost xs" onclick="loadKpi(' + i + ')">Load</button><button class="btn ghost xs muted" onclick="deleteKpi(' + i + ')">×</button></div></div>';
    }).join("");
  }
  window.loadKpi = function (i) { const g = S.kpi[i].data; Object.keys(g).forEach((id) => { if ($(id)) $(id).value = g[id]; }); toast("Snapshot loaded"); };
  window.deleteKpi = async function (i) { if (!(await askConfirm("Delete snapshot", "Remove this KPI snapshot? This can't be undone.", "Delete", true))) return; S.kpi.splice(i, 1); save("kpi"); renderKpiHistory(); };

  // ───────────────────────── calendar ─────────────────────────
  const calTags = { 0: "Approve coach assignments", 1: "Tournament promo · Vibes", 2: "Vibes", 3: "Tournament promo · Vibes", 4: "Vibes", 5: "Tournament promo · Vibes", 6: "Players in Action · Vibes" };
  let calRef = new Date();
  function sundayOf(d) { const s = new Date(d); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - s.getDay()); return s; }
  function renderCal() {
    $("cal-month-label").textContent = MONTHS[calRef.getMonth()] + " " + calRef.getFullYear();
    const y = calRef.getFullYear(), m = calRef.getMonth();
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0), today = new Date();
    let html = "";
    for (let i = 0; i < first.getDay(); i++) html += '<div class="cal-day empty"></div>';
    for (let d = 1; d <= last.getDate(); d++) {
      const dt = new Date(y, m, d), dow = dt.getDay();
      const isToday = dt.toDateString() === today.toDateString();
      const wk = wsOf(dt), w = (S.weeks || {})[wk];
      html += '<div class="cal-day' + (isToday ? " today" : "") + (w ? (w.locked ? " has-brief" : " has-draft") : "") + '" role="button" tabindex="0" title="Open the week of ' + esc(weekLabel(wk)) + '" onclick="openWeek(\'' + wk + '\')" onkeydown="if(event.key===\'Enter\'){this.click()}"><div class="cal-n">' + d + '</div><div class="cal-tag">' + calTags[dow] + '</div>' + (w ? '<div class="cal-tag ' + (w.locked ? "approved" : "draft") + '">' + (w.locked ? "✓ Brief approved" : "Draft brief") + "</div>" : "") + '</div>';
    }
    $("cal-days").innerHTML = html;
  }
  window.calNav = function (dir) { calRef = dir === 0 ? new Date() : new Date(calRef.getFullYear(), calRef.getMonth() + dir, 1); renderCal(); };

  // ───────────────────────── cadence ─────────────────────────
  function renderCadence() {
    const days = ["M", "T", "W", "T", "F", "S", "S"]; let html = "";
    PLATFORMS.forEach((p) => {
      const arr = S.cadence[p.name] || [false, false, false, false, false, false, false];
      html += '<div class="cad-row"><div class="cad-name">' + esc(p.name) + '</div>';
      for (let i = 0; i < 7; i++) html += '<div class="chk' + (arr[i] ? " done" : "") + '" role="checkbox" aria-checked="' + !!arr[i] + '" tabindex="0" onclick="toggleCad(\'' + esc(p.name) + "'," + i + ')" onkeydown="if(event.key===\' \'||event.key===\'Enter\'){event.preventDefault();this.click()}">' + (arr[i] ? "✓" : days[i]) + '</div>';
      html += '<div class="cad-target">/' + p.target + ' wk</div></div>';
    });
    $("cadence-rows").innerHTML = html; updateCadenceStats();
  }
  function updateCadenceStats() {
    let total = 0, done = 0;
    PLATFORMS.forEach((p) => { (S.cadence[p.name] || [0, 0, 0, 0, 0, 0, 0]).forEach((v) => { total++; if (v) done++; }); });
    const pct = total ? Math.round(done / total * 100) : 0;
    $("cad-progress").style.width = pct + "%"; $("cad-progress-label").textContent = pct + "%"; $("ov-cadence").textContent = pct + "%";
  }
  window.toggleCad = function (platform, i) {
    if (!S.cadence[platform]) S.cadence[platform] = [false, false, false, false, false, false, false];
    S.cadence[platform][i] = !S.cadence[platform][i]; save("cadence"); renderCadence();
  };
  window.resetCadence = async function () { if (!(await askConfirm("Reset week", "Clear every cadence checkbox for this week?", "Reset"))) return; S.cadence = {}; save("cadence"); renderCadence(); };

  // ───────────────────────── content ideas ─────────────────────────
  $("idea-pillar").innerHTML = Object.keys(PILLARS).map((p) => "<option>" + esc(p) + "</option>").join("");
  window.genIdeas = function () {
    const pillar = $("idea-pillar").value, platform = $("idea-platform").value, data = PILLARS[pillar];
    if (!data) { $("ideas-output").innerHTML = '<div class="empty">No ideas for this pillar yet.</div>'; return; }
    const coaches = data.coaches.length ? data.coaches.join(" · ") : "Unassigned";
    $("ideas-output").innerHTML = (data.ideas[platform] || []).map((idea) => '<div class="idea"><span class="tag">' + esc(pillar) + '</span><span class="tag cyan">' + esc(platform) + '</span><span class="tag mint">' + esc(coaches) + '</span><div class="idea-title">' + esc(idea) + '</div></div>').join("") || '<div class="empty">Nothing for this combination yet.</div>';
  };

  // ───────────────────────── coach assignments — the schedule ─────────────────────────
  // Every week lives in S.weeks, keyed by its Sunday (YYYY-MM-DD). A week is a draft until it is
  // approved & locked, and both are kept — go back to any week and it shows exactly what was assigned.
  // Ideas sitting in any saved week are reserved, so the next week never repeats them.
  $("new-idea-coach").innerHTML = COACHES.map((c) => "<option>" + esc(c.name) + "</option>").join("");
  const isoLocal = (d) => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const wsOf = (d) => isoLocal(sundayOf(d));
  const wsDate = (ws) => new Date(ws + "T12:00:00");
  const shiftWS = (ws, n) => { const d = wsDate(ws); d.setDate(d.getDate() + n * 7); return isoLocal(d); };
  function weekLabel(ws) { const sun = wsDate(ws), sat = new Date(sun); sat.setDate(sun.getDate() + 6); return SM[sun.getMonth()] + " " + sun.getDate() + "–" + SM[sat.getMonth()] + " " + sat.getDate() + ", " + sat.getFullYear(); }
  let curWS = wsOf(new Date());
  try { const w = sessionStorage.getItem("pw-week"); if (w && /^\d{4}-\d{2}-\d{2}$/.test(w)) curWS = w; } catch (e) {}
  const cur = () => (S.weeks && S.weeks[curWS]) || null;
  const thisWeek = () => (S.weeks && S.weeks[wsOf(new Date())]) || null;
  const weekList = () => Object.keys(S.weeks || {}).sort().reverse().map((k) => S.weeks[k]);
  function weekIds(w) { const ideas = [], prod = []; (w.coaches || []).forEach((c) => (c.ideas || []).forEach((i) => { if (!i.custom) ideas.push(i.id); })); (w.production || []).forEach((p) => { if (!p.custom) prod.push(p.id); }); return { ideas, prod }; }
  // usedIdeas / usedProd = everything consumed by approved (locked) weeks — derived, never edited by hand
  function recomputeUsed() { const ui = new Set(), up = new Set(); weekList().forEach((w) => { if (!w.locked) return; const ids = weekIds(w); ids.ideas.forEach((x) => ui.add(x)); ids.prod.forEach((x) => up.add(x)); }); S.usedIdeas = Array.from(ui); S.usedProd = Array.from(up); }
  // reserved = already posted + sitting in any saved week (draft or locked), except the week given
  function reserved(exceptWS) { const ri = new Set(ALREADY_POSTED_IDS), rp = new Set(); Object.keys(S.weeks || {}).forEach((k) => { if (k === exceptWS) return; const ids = weekIds(S.weeks[k]); ids.ideas.forEach((x) => ri.add(x)); ids.prod.forEach((x) => rp.add(x)); }); return { ideas: ri, prod: rp }; }
  function availableIdeas(coach, exceptWS) { const r = reserved(exceptWS || null).ideas; return (S.ideaBank[coach] || []).filter((i) => !r.has(i.id)); }
  function postedCount(coach) { return (S.ideaBank[coach] || []).filter((i) => ALREADY_POSTED_IDS.includes(i.id)).length; }
  function availableProd(exceptWS) { const r = reserved(exceptWS || null).prod; return S.prodBank.filter((i) => !r.has(i.id)); }
  const pick = (p, extra) => Object.assign({ id: p.id, title: p.title, format: p.format, day: p.day, desc: p.desc, hook: p.hook || "", delivered: false, approved: false, custom: false }, extra || {});
  function runHooks() { (window.PW && window.PW.hooks || []).forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
  function renderWeekViews() { renderAssignments(); renderProduction(); renderWeeks(); renderBankStatus(); renderCal(); renderOverview(); renderFortnight(); runHooks(); }

  // navigation — per viewer; the saved weeks are shared
  window.showWeek = function (ws) {
    curWS = ws; try { sessionStorage.setItem("pw-week", ws); } catch (e) {}
    const w = cur(); $("week-dates").value = weekLabel(ws); $("week-dates").dataset.start = ws;
    $("week-theme").value = w ? (w.theme || "") : ""; $("week-theme").placeholder = w ? "Weekly theme" : "Theme — blank = " + (detectWeekTheme(wsDate(ws)).theme || "none");
    renderWeekViews();
  };
  window.shiftWeek = function (n) { showWeek(shiftWS(curWS, n)); };
  window.goThisWeek = function () { showWeek(wsOf(new Date())); };
  window.setWeek = function (offset) { showWeek(shiftWS(wsOf(new Date()), offset)); };
  window.openWeek = function (ws) { const b = document.querySelector('.tab-btn[data-tab="assignments"]'); if (b) b.click(); showWeek(ws); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // ── The recipe: what one week of content is. 7 posts a week (one a day) plus one spare = 14 every
  // two weeks plus two in hand. Coach videos: Tonio every week, the rest of the roster in rotation.
  // One ad video and two carousels/statics come from the production bank. The photographer's shot
  // list, the editor brief and the posting plan are all built from the week this produces.
  const RECIPE_DEFAULT = { coachVideos: 5, adVideos: 1, production: 2, always: ["Tonio"], rotation: ["Tara", "Flo", "Nico", "Eric", "Mauri", "Kam", "Robby", "Coach ET", "Quinnton", "Lukas"], anchor: "2026-10-04" };
  const recipe = () => { const r = Object.assign({}, RECIPE_DEFAULT, S.recipe || {}); r.always = (r.always || []).filter((n) => COACHES.some((c) => c.name === n)); r.rotation = (r.rotation || []).filter((n) => COACHES.some((c) => c.name === n) && !r.always.includes(n)); return r; };
  const POST_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  // who films in a given week: the always-on coaches, then the next names in the rotation (deterministic per week, so two people building the same week get the same answer)
  function weekCoaches(ws) {
    const r = recipe(), slots = Math.max(0, r.coachVideos - r.always.length), out = r.always.slice();
    if (!r.rotation.length || !slots) return out;
    const idx = Math.round((wsDate(ws) - wsDate(r.anchor)) / (7 * 864e5)), n = r.rotation.length, start = (((idx * slots) % n) + n) % n;
    for (let i = 0; i < slots && i < n; i++) out.push(r.rotation[(start + i) % n]);
    return out;
  }
  const isAdItem = (p) => /^ad\b|^ad /i.test(String(p.format || "")) || /\bad video\b/i.test(String(p.format || ""));
  const isPostItem = (p) => /Carousel|Static/i.test(String(p.format || ""));
  function recipeLine() { const r = recipe(); return r.coachVideos + " coach video" + (r.coachVideos === 1 ? "" : "s") + " (" + (r.always.length ? r.always.join(" + ") + " every week, " : "") + (r.coachVideos - r.always.length) + " in rotation) · " + r.adVideos + " ad video" + (r.adVideos === 1 ? "" : "s") + " · " + r.production + " carousel" + (r.production === 1 ? "" : "s") + "/statics = " + (r.coachVideos + r.adVideos + r.production) + " a week (7 posts + " + Math.max(0, r.coachVideos + r.adVideos + r.production - 7) + " spare)"; }
  window.editRecipe = async function () {
    const r = recipe();
    const f = await askForm("The weekly recipe", [
      { key: "coachVideos", label: "Coach videos a week", value: String(r.coachVideos) }, { key: "adVideos", label: "Ad videos a week", value: String(r.adVideos) }, { key: "production", label: "Carousels / statics a week", value: String(r.production) },
      { key: "always", label: "Every week (names, comma-separated)", value: r.always.join(", ") }, { key: "rotation", label: "Rotation order (names, comma-separated)", value: r.rotation.join(", ") }
    ], "Save recipe", "7 posts a week = 14 every two weeks. Anything above 7 is the spare. Names must match the roster exactly.");
    if (!f) return;
    const names = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
    S.recipe = { coachVideos: Math.max(0, parseInt(f.coachVideos, 10) || 0), adVideos: Math.max(0, parseInt(f.adVideos, 10) || 0), production: Math.max(0, parseInt(f.production, 10) || 0), always: names(f.always), rotation: names(f.rotation), anchor: r.anchor };
    save("recipe"); renderWeekViews(); toast("Recipe saved — it applies to the next week you generate");
  };
  function buildWeek(ws, theme, pillar) {
    const r = recipe(), warnings = [], label = weekLabel(ws);
    const coaches = [], used = new Set();
    const take = (n) => { const c = COACHES.find((x) => x.name === n); if (!c || used.has(n)) return false; const avail = availableIdeas(n, ws); if (!avail.length) return false; used.add(n); coaches.push({ name: n, role: c.role, ideas: [pick(avail[0])] }); return true; };
    weekCoaches(ws).forEach((n) => { if (!take(n)) warnings.push(n + " — bank empty, skipped this week"); });
    r.rotation.concat(r.always).forEach((n) => { if (coaches.length < r.coachVideos) take(n); });       // fill a skipped slot with the next coach who has ideas
    const prodAvail = availableProd(ws), prefer = (list) => (pillar ? list.filter((p) => p.pillar === pillar) : []).concat(list.filter((p) => !pillar || p.pillar !== pillar));
    const adPicks = prefer(prodAvail.filter(isAdItem)).slice(0, r.adVideos), postPicks = prefer(prodAvail.filter(isPostItem)).slice(0, r.production);
    if (adPicks.length < r.adVideos) warnings.push("Ad videos — " + adPicks.length + " of " + r.adVideos + " in the bank");
    if (postPicks.length < r.production) warnings.push("Carousels/statics — " + postPicks.length + " of " + r.production + " in the bank");
    const production = adPicks.concat(postPicks).map((p) => pick(p, { pillar: p.pillar }));
    // one post a day: Mon video · Tue carousel · Wed video · Thu ad · Fri video · Sat video · Sun carousel · anything left is the spare
    const vids = coaches.map((c) => c.ideas[0]), ad = adPicks.length ? production.find((x) => x.id === adPicks[0].id) : null, posts = postPicks.map((p) => production.find((x) => x.id === p.id));
    const order = []; [vids[0], posts[0], vids[1], ad, vids[2], vids[3], posts[1]].forEach((it) => { if (it) order.push(it); }); vids.slice(4).forEach((v) => order.push(v)); production.forEach((p) => { if (!order.includes(p)) order.push(p); });
    order.forEach((it, i) => { it.day = i < POST_DAYS.length ? POST_DAYS[i] : "Spare"; });
    return { weekStart: ws, weekDates: label, theme, themePillar: pillar, locked: false, createdAt: new Date().toISOString(), coaches, production, warnings };
  }
  window.genAssignments = async function () {
    const ws = curWS, existing = cur(), label = weekLabel(ws);
    if (existing && existing.locked) { if (!(await askConfirm("This week is approved", "The week of " + label + " is approved and locked. Unlock it and build a fresh draft? Delivered check-offs on the current brief are lost; its ideas go back in the banks.", "Unlock & regenerate", true))) return; }
    else if (existing) { if (!(await askConfirm("Replace this draft", "A draft already exists for the week of " + label + ". Replace it with a fresh set of ideas? Your swaps and edits on this draft are lost.", "Replace draft", true))) return; }
    let theme = $("week-theme").value.trim(); let pillar;
    if (!theme) { const t = detectWeekTheme(wsDate(ws)); theme = t.theme; pillar = t.pillar; $("week-theme").value = theme; } else pillar = pillarFromTheme(theme);
    S.weeks[ws] = buildWeek(ws, theme, pillar);
    recomputeUsed(); save("weeks"); renderWeekViews();
    toast("Draft built for " + label + " — swap, edit or skip, then approve & lock");
  };

  function renderAssignments() {
    const d = cur(), out = $("assignments-output"), ab = $("approve-btn"), note = $("draft-note");
    $("recurring-card").hidden = !d;
    if (!$("week-dates").value) { $("week-dates").value = weekLabel(curWS); $("week-dates").dataset.start = curWS; }
    if ($("recipe-note")) $("recipe-note").innerHTML = '<span><strong>Recipe:</strong> ' + esc(recipeLine()) + ' · this week films: ' + esc(weekCoaches(curWS).join(", ")) + '</span> <button class="btn ghost xs" onclick="editRecipe()">✎ Edit recipe</button>';
    if (!d) {
      const others = weekList();
      out.innerHTML = '<div class="card"><div class="empty">No brief for the week of ' + esc(weekLabel(curWS)) + ' yet. Generate assignments — every coach gets their videos and the production list is built from the banks.' + (others.length ? '<br><span class="small">' + others.length + ' saved week' + (others.length > 1 ? "s" : "") + ' below — open any of them, or use ‹ › to move between weeks.</span>' : "") + "</div></div>";
      note.innerHTML = ""; ab.disabled = true; ab.textContent = "✓ Approve & lock"; return;
    }
    ab.disabled = !!d.locked; ab.textContent = d.locked ? "✓ Approved & locked" : "✓ Approve & lock";
    note.innerHTML = d.locked
      ? '<span class="tag mint" style="margin:0 8px 0 0">Approved</span>Week of ' + esc(d.weekDates) + " locked" + (d.approvedAt ? " on " + esc(new Date(d.approvedAt).toLocaleDateString()) : "") + ". Check-offs still save. <button class=\"btn ghost xs muted\" onclick=\"unlockWeek()\">Unlock to edit</button>"
      : '<span class="tag cyan" style="margin:0 8px 0 0">Draft</span>Week of ' + esc(d.weekDates) + " — swap, edit or skip, then approve to lock these ideas out of future weeks.";
    let html = "";
    if (!d.locked && d.warnings && d.warnings.length) html += '<div class="notice warn">Idea bank running low for: ' + esc(d.warnings.join(", ")) + '. <button class="btn orchid xs" onclick="document.getElementById(\'add-idea-section\').scrollIntoView({behavior:\'smooth\'})">Add ideas →</button></div>';
    const total = d.coaches.reduce((s, c) => s + c.ideas.length, 0), delivered = d.coaches.reduce((s, c) => s + c.ideas.filter((i) => i.delivered).length, 0);
    html += '<div class="card"><div class="card-label">Week of ' + esc(d.weekDates) + (d.theme ? " · " + esc(d.theme) : "") + '</div>';
    html += '<div class="progress"><div class="bar"><i style="width:' + (total ? Math.round(delivered / total * 100) : 0) + '%"></i></div><div class="pillar-pct">' + delivered + "/" + total + ' delivered</div></div><div class="grid-3">';
    d.coaches.forEach((c, ci) => {
      html += '<div class="coach"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><div class="coach-name">' + esc(c.name) + '</div><div class="coach-role">' + esc(c.role) + '</div></div><div class="coach-count">' + c.ideas.filter((i) => i.delivered).length + "/" + c.ideas.length + '</div></div>';
      c.ideas.forEach((idea, ii) => {
        html += '<div class="item' + (idea.delivered ? " done" : "") + '"><div class="chk' + (idea.delivered ? " done" : "") + '" role="checkbox" aria-checked="' + !!idea.delivered + '" tabindex="0" style="width:24px;height:24px;flex-shrink:0" onclick="toggleDelivered(' + ci + "," + ii + ')">' + (idea.delivered ? "✓" : "") + '</div><div class="item-body"><div class="item-title">' + esc(idea.title) + '</div><div class="item-meta">' + esc(idea.format) + " · Post " + esc(idea.day) + '</div><div class="item-desc">' + esc(idea.desc) + '</div>' + (idea.hook ? '<div class="item-hook">' + esc(idea.hook) + '</div>' : "") +
          '<div class="item-actions"><button class="btn ghost xs" onclick="swapIdea(' + ci + "," + ii + ')">↻ Swap</button><button class="btn ghost xs" onclick="editIdea(' + ci + "," + ii + ')">✎ Edit</button><button class="btn ghost xs orchid" onclick="skipIdea(' + ci + "," + ii + ')">✕ Skip</button></div></div></div>';
      });
      html += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)"><button class="btn ghost xs" onclick="addExtraIdea(' + ci + ')">+ Add another for ' + esc(c.name) + '</button></div></div>';
    });
    out.innerHTML = html + "</div></div>";
  }
  function syncWeek() { recomputeUsed(); save("weeks"); renderWeeks(); renderBankStatus(); renderOverview(); runHooks(); }
  window.toggleDelivered = function (ci, ii) { const d = cur(); if (!d) return; const i = d.coaches[ci].ideas[ii]; i.delivered = !i.delivered; syncWeek(); renderAssignments(); };
  window.swapIdea = function (ci, ii) {
    const d = cur(); if (!d) return; const c = d.coaches[ci], curIdea = c.ideas[ii];
    const avail = availableIdeas(c.name).filter((i) => i.id !== curIdea.id && !c.ideas.some((x) => x.id === i.id));
    if (!avail.length) { toast("No more ideas in " + c.name + "'s bank — add new ones below", true); return; }
    c.ideas[ii] = pick(avail[0]); syncWeek(); renderAssignments();
  };
  window.editIdea = async function (ci, ii) {
    const d = cur(); if (!d) return; const c = d.coaches[ci], i = c.ideas[ii];
    const r = await askForm("Edit — " + c.name, ideaFields(i), "Save changes");
    if (!r || !r.title) return;
    Object.assign(i, { title: r.title, desc: r.desc, day: r.day, format: r.format, hook: r.hook, custom: true }); syncWeek(); renderAssignments(); toast("Updated");
  };
  window.skipIdea = async function (ci, ii) { const d = cur(); if (!d) return; if (!(await askConfirm("Skip this video", "Skip it for this week? The idea goes back in the bank for a future week.", "Skip", true))) return; d.coaches[ci].ideas.splice(ii, 1); syncWeek(); renderAssignments(); };
  window.addExtraIdea = async function (ci) {
    const d = cur(); if (!d) return; const c = d.coaches[ci], avail = availableIdeas(c.name).filter((i) => !c.ideas.some((x) => x.id === i.id));
    if (!avail.length) {
      const r = await askForm("Custom video for " + c.name, ideaFields({ title: "", format: "Reel", day: "Wed", desc: "", hook: "" }), "Add video", "No more ideas in " + c.name + "'s bank — write one here. It's also saved to the bank.");
      if (!r || !r.title) return;
      const item = { id: "u_" + Date.now(), title: r.title, format: r.format, day: r.day, desc: r.desc, hook: r.hook };
      (S.ideaBank[c.name] = S.ideaBank[c.name] || []).push(item); save("ideaBank");
      c.ideas.push(Object.assign(pick(item), { custom: true }));
    } else c.ideas.push(pick(avail[0]));
    syncWeek(); renderAssignments();
  };

  // production list
  function renderProduction() {
    const d = cur(), out = $("production-output");
    if (!d || !d.production) { out.innerHTML = ""; return; }
    const items = d.production, done = items.filter((i) => i.delivered).length;
    let html = '<div class="card"><div class="card-label orchid">Production list — non-video content</div><div class="small muted" style="margin-bottom:12px">Everything that isn\'t a coach video: the ad video the photographer shoots, and the carousels and statics designed from the brand template. The photographer\'s shot list, the editor brief and the posting plan on the Workflow tab are built from this week.</div>';
    html += '<div class="progress"><div class="bar"><i style="width:' + (items.length ? Math.round(done / items.length * 100) : 0) + '%;background:var(--orchid)"></i></div><div class="pillar-pct">' + done + "/" + items.length + ' done</div></div><div class="grid-3">';
    items.forEach((it, idx) => {
      html += '<div class="coach orchid"><div class="item' + (it.delivered ? " done" : "") + '" style="margin:0;padding:0;border:0"><div class="chk orchid' + (it.delivered ? " done" : "") + '" role="checkbox" aria-checked="' + !!it.delivered + '" tabindex="0" style="width:24px;height:24px;flex-shrink:0" onclick="toggleProd(' + idx + ')">' + (it.delivered ? "✓" : "") + '</div><div class="item-body"><div class="item-title">' + esc(it.title) + '</div><div class="item-meta">' + esc(it.format) + " · " + esc(it.day) + (it.pillar ? " · " + esc(it.pillar) : "") + '</div><div class="item-desc">' + esc(it.desc) + '</div>' + (it.hook ? '<div class="item-hook">' + esc(it.hook) + '</div>' : "") +
        '<div class="item-actions"><button class="btn ghost xs" onclick="swapProd(' + idx + ')">↻ Swap</button><button class="btn ghost xs" onclick="editProd(' + idx + ')">✎ Edit</button><button class="btn ghost xs orchid" onclick="skipProd(' + idx + ')">✕ Skip</button></div></div></div></div>';
    });
    out.innerHTML = html + '</div><div style="margin-top:14px"><button class="btn ghost xs" onclick="addExtraProd()">+ Add another production item</button></div></div>';
  }
  window.toggleProd = function (i) { const d = cur(); if (!d) return; d.production[i].delivered = !d.production[i].delivered; syncWeek(); renderProduction(); };
  window.swapProd = function (i) {
    const d = cur(); if (!d) return; const curItem = d.production[i], avail = availableProd().filter((x) => x.id !== curItem.id && !d.production.some((p) => p.id === x.id));
    if (!avail.length) { toast("Production bank is empty — edit this item instead", true); return; }
    d.production[i] = pick(avail[0], { pillar: avail[0].pillar }); syncWeek(); renderProduction();
  };
  window.editProd = async function (i) {
    const d = cur(); if (!d) return; const it = d.production[i];
    const r = await askForm("Edit production item", ideaFields(it), "Save changes");
    if (!r || !r.title) return;
    Object.assign(it, { title: r.title, desc: r.desc, day: r.day, format: r.format, hook: r.hook, custom: true }); syncWeek(); renderProduction(); toast("Updated");
  };
  window.skipProd = async function (i) { const d = cur(); if (!d) return; if (!(await askConfirm("Skip this item", "Skip it for this week? It goes back in the production bank.", "Skip", true))) return; d.production.splice(i, 1); syncWeek(); renderProduction(); };
  window.addExtraProd = async function () {
    const d = cur(); if (!d) return; const avail = availableProd().filter((x) => !d.production.some((p) => p.id === x.id));
    if (!avail.length) {
      const r = await askForm("Custom production item", ideaFields({ title: "", format: "Carousel", day: "Wed", desc: "", hook: "" }), "Add item", "The production bank is empty — write one here. It's also saved to the bank.");
      if (!r || !r.title) return;
      const item = { id: "up_" + Date.now(), title: r.title, format: r.format, day: r.day, desc: r.desc, hook: r.hook, pillar: "custom" };
      S.prodBank.push(item); save("prodBank");
      d.production.push(Object.assign(pick(item, { pillar: "custom" }), { custom: true }));
    } else d.production.push(pick(avail[0], { pillar: avail[0].pillar }));
    syncWeek(); renderProduction();
  };

  // approve / unlock / history
  window.approveWeek = async function () {
    const d = cur(); if (!d) { toast("Generate assignments first", true); return; }
    if (d.locked) return;
    if (!(await askConfirm("Approve & lock " + d.weekDates, "Lock this week's assignments? The ideas used won't repeat in future weeks. You can still check off deliveries after locking, and unlock later if something changes.", "Approve & lock"))) return;
    d.locked = true; d.approvedAt = new Date().toISOString(); delete d.warnings;
    recomputeUsed(); save("weeks"); renderWeekViews();
    toast("Week approved & locked — send the briefs from the Workflow tab");
  };
  window.unlockWeek = async function () {
    const d = cur(); if (!d || !d.locked) return;
    if (!(await askConfirm("Unlock " + d.weekDates, "Unlock this week so you can swap, edit or regenerate? Lock it again when you're done.", "Unlock"))) return;
    d.locked = false; recomputeUsed(); save("weeks"); renderWeekViews(); toast("Week unlocked");
  };
  function renderWeeks() {
    const list = weekList(), card = $("approved-card"); card.hidden = list.length === 0;
    $("approved-list").innerHTML = list.map((w) => {
      const tc = w.coaches.reduce((s, c) => s + (c.ideas || []).length, 0), dc = w.coaches.reduce((s, c) => s + (c.ideas || []).filter((i) => i.delivered).length, 0);
      const tp = (w.production || []).length, dp = (w.production || []).filter((i) => i.delivered).length;
      const isCur = w.weekStart === curWS, isThis = w.weekStart === wsOf(new Date());
      return '<div class="approved-row' + (w.locked ? "" : " draft") + (isCur ? " current" : "") + '"><div><strong>' + esc(w.weekDates) + "</strong>" + (isThis ? ' <span class="tag dim" style="margin:0 0 0 6px">this week</span>' : "") + (w.theme ? ' <span class="small muted">· ' + esc(w.theme) + "</span>" : "") + '<div class="small">' + (w.locked ? "Approved " + new Date(w.approvedAt || w.createdAt).toLocaleDateString() : "Draft — not approved yet") + " · " + (dc + dp) + "/" + (tc + tp) + " delivered (" + dc + "/" + tc + " video · " + dp + "/" + tp + ' production)</div></div><div class="btn-row"><span class="tag ' + (w.locked ? "mint" : "cyan") + '" style="margin:0">' + (w.locked ? "Locked" : "Draft") + '</span>' + (isCur ? '<span class="small muted">open</span>' : '<button class="btn ghost xs" onclick="showWeek(\'' + w.weekStart + '\')">Open</button>') + '<button class="btn ghost xs" onclick="pdfWeek(\'' + w.weekStart + '\')">PDF</button><button class="btn ghost xs muted" onclick="deleteWeek(\'' + w.weekStart + '\')">×</button></div></div>';
    }).join("");
  }
  window.deleteWeek = async function (ws) {
    const w = S.weeks[ws]; if (!w) return;
    if (!(await askConfirm("Delete " + w.weekDates, "Remove this week" + (w.locked ? " (it is approved)" : "") + "? Its ideas go back into the banks. This can't be undone.", "Delete", true))) return;
    delete S.weeks[ws]; recomputeUsed(); save("weeks"); renderWeekViews();
  };
  window.pdfWeek = function (ws) { if (S.weeks[ws]) generatePDF(S.weeks[ws]); };
  // Kept for older links/buttons
  window.loadApproved = function (idx) { const w = weekList().filter((x) => x.locked)[idx]; if (w) showWeek(w.weekStart); };
  window.pdfApproved = function (idx) { const w = weekList().filter((x) => x.locked)[idx]; if (w) generatePDF(w); };

  function renderBankStatus() {
    $("bank-status").innerHTML = COACHES.map((c) => {
      const avail = availableIdeas(c.name).length, posted = postedCount(c.name), need = 1, r = recipe(), turn = r.always.includes(c.name) ? "every week" : "in rotation";
      let color = "var(--mint)", label = "OK";
      if (avail === 0) { color = "var(--orchid)"; label = "EMPTY"; } else if (avail < need * 2) { color = "var(--warn)"; label = "LOW"; }
      return '<div class="bank-row"><div style="font-weight:700;cursor:pointer" title="Open ' + esc(c.name) + '\'s bank" onclick="manageBank(\'' + esc(c.name) + '\')">' + esc(c.name) + ' <span class="muted small">· ' + turn + ' · <u>open</u></span></div><div class="btn-row" style="gap:6px"><span class="pill" style="background:' + color + '">' + label + ' · ' + avail + '</span>' + (posted ? '<span class="pill gray" title="Already posted (locked)">' + posted + ' ✓</span>' : "") + '</div></div>';
    }).join("");
  }
  // Bank manager — view, edit, remove a coach's ideas
  window.manageBank = function (coach) {
    const ideas = S.ideaBank[coach] || [], rs = reserved(null).ideas;
    let html = "<h3>" + esc(coach) + "'s idea bank</h3><p>" + ideas.length + " ideas · gray = already posted or assigned in a saved week. Click a title to edit.</p>";
    ideas.forEach((i, idx) => {
      const locked = rs.has(i.id);
      html += '<div class="bank-row" style="align-items:flex-start;gap:10px' + (locked ? ";opacity:.45" : "") + '"><div style="flex:1;min-width:0"><div style="font-weight:700;cursor:pointer" onclick="editBankIdea(\'' + esc(coach) + "'," + idx + ')">' + esc(i.title) + '</div><div class="small muted">' + esc(i.format) + " · " + esc(i.day) + (locked ? " · used" : "") + '</div></div><div class="btn-row" style="gap:4px;flex-shrink:0"><button class="btn ghost xs" onclick="editBankIdea(\'' + esc(coach) + "'," + idx + ')">✎</button><button class="btn ghost xs orchid" onclick="removeBankIdea(\'' + esc(coach) + "'," + idx + ')">✕</button></div></div>';
    });
    html += '<div class="btn-row"><button class="btn ghost muted" onclick="closeModal()">Close</button><button class="btn" onclick="newBankIdea(\'' + esc(coach) + '\')">+ New idea</button></div>';
    openModal(html);
  };
  window.closeModal = closeModal;
  window.editBankIdea = async function (coach, idx) {
    const i = S.ideaBank[coach][idx];
    const r = await askForm("Edit — " + coach, ideaFields(i), "Save changes");
    if (r && r.title) { Object.assign(i, { title: r.title, format: r.format, day: r.day, desc: r.desc, hook: r.hook }); save("ideaBank"); renderBankStatus(); toast("Saved to " + coach + "'s bank"); }
    manageBank(coach);
  };
  window.removeBankIdea = async function (coach, idx) {
    const i = S.ideaBank[coach][idx];
    if (await askConfirm("Remove idea", "Remove \"" + i.title + "\" from " + coach + "'s bank?", "Remove", true)) { S.ideaBank[coach].splice(idx, 1); save("ideaBank"); renderBankStatus(); toast("Removed"); }
    manageBank(coach);
  };
  window.newBankIdea = async function (coach) {
    const r = await askForm("New idea for " + coach, ideaFields({ title: "", format: "Reel", day: "Wed", desc: "", hook: "" }), "Add to bank");
    if (r && r.title) { (S.ideaBank[coach] = S.ideaBank[coach] || []).push({ id: "u_" + Date.now(), title: r.title, format: r.format, day: r.day, desc: r.desc, hook: r.hook }); save("ideaBank"); renderBankStatus(); toast("Added to " + coach + "'s bank"); }
    manageBank(coach);
  };
  window.addIdeaToBank = function () {
    const coach = $("new-idea-coach").value, title = $("new-idea-title").value.trim();
    if (!title) { toast("Title is required", true); return; }
    if (!S.ideaBank[coach]) S.ideaBank[coach] = [];
    S.ideaBank[coach].push({ id: "u_" + Date.now(), title, format: $("new-idea-format").value, day: $("new-idea-day").value, desc: $("new-idea-desc").value.trim(), hook: $("new-idea-hook").value.trim() });
    save("ideaBank"); renderBankStatus();
    ["new-idea-title", "new-idea-desc", "new-idea-hook"].forEach((id) => ($(id).value = ""));
    toast("Added to " + coach + "'s idea bank");
  };

  // Slack-ready text brief
  window.copyBrief = function () {
    const d = cur(); if (!d) { toast("Generate assignments first", true); return; }
    const lines = ["PROWORLD — COACH VIDEO BRIEF · Week of " + d.weekDates + (d.theme ? " · Theme: " + d.theme : ""), ""];
    d.coaches.forEach((c) => { if (!c.ideas.length) return; lines.push("• " + c.name.toUpperCase() + " (" + c.role + ")"); c.ideas.forEach((i) => { lines.push("   – " + i.title + " — " + i.format + ", post " + i.day); if (i.desc) lines.push("     " + i.desc.replace(/⏱\s*/, "")); if (i.hook) lines.push("     Hook: " + i.hook); }); lines.push(""); });
    lines.push("Recurring: Mon/Wed/Fri tournament promo · weekly Players in Action recap · daily Academy Vibes story (2–3 iPhone clips).");
    const txt = lines.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast("Brief copied — paste it into Slack"), () => fallbackCopy(txt)); else fallbackCopy(txt);
  };
  function fallbackCopy(txt) { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("Brief copied — paste it into Slack"); } catch (e) { toast("Couldn't copy — select the text manually", true); } ta.remove(); }

  // ───────────────────────── PDF (jsPDF, landscape A4) ─────────────────────────
  window.downloadPDF = function () { const d = cur(); if (!d) { toast("Generate assignments first", true); return; } generatePDF(d); };
  function stripForPDF(t) { return String(t || "").replace(/⏱/g, "").replace(/[\u{1F300}-\u{1FAFF}]/gu, "").replace(/[\u{2600}-\u{27BF}]/gu, "").replace(/\s+/g, " ").trim(); }
  function generatePDF(data) {
    if (!window.jspdf) { toast("PDF library didn't load — try again in a moment", true); return; }
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, H = 210, LIME = [226, 254, 120];
    function header(sub) {
      doc.setFillColor(0, 0, 0); doc.rect(0, 0, W, 26, "F");
      doc.setTextColor.apply(doc, LIME); doc.setFont("helvetica", "bolditalic"); doc.setFontSize(22); doc.text("PROWORLD", 10, 15);
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(sub, 10, 21);
      doc.setFontSize(11); doc.text("Week of " + data.weekDates, W - 10, 13, { align: "right" });
      if (data.theme) { doc.setTextColor.apply(doc, LIME); doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.text("Theme: " + data.theme, W - 10, 19, { align: "right" }); }
    }
    function footer(label) { doc.setFillColor(0, 0, 0); doc.rect(0, H - 8, W, 8, "F"); doc.setTextColor.apply(doc, LIME); doc.setFontSize(7); doc.setFont("helvetica", "italic"); doc.text("PROWORLD ACADEMY · DELRAY BEACH, FLORIDA · HIGH PERFORMANCE ACADEMY" + (label ? " · " + label : ""), W / 2, H - 3, { align: "center" }); }
    header("COACH VIDEO BRIEF — THIS WEEK'S VIDEOS");
    doc.setFillColor(242, 242, 242); doc.rect(0, 28, W, 12, "F"); doc.setTextColor(0, 0, 0); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("RECURRING WEEKLY:", 10, 33); doc.setFont("helvetica", "normal"); doc.text("Mon · Wed · Fri Tournament Promo  |  Weekly Players in Action Recap  |  Daily Academy Vibes Story (2-3 iPhone clips)", 10, 37.5);
    const colW = (W - 30) / 3, rowH = 52, startY = 46; let col = 0, row = 0, page = 1;
    data.coaches.forEach((c) => {
      if (!c.ideas.length) return;
      if (row >= 3) { footer("Page " + page); doc.addPage(); page++; header("COACH VIDEO BRIEF — THIS WEEK'S VIDEOS"); row = 0; col = 0; }
      const x = 10 + col * (colW + 5), y = startY + row * rowH;
      doc.setDrawColor.apply(doc, LIME); doc.setLineWidth(1); doc.line(x, y, x, y + rowH - 3);
      doc.setFontSize(11); doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bolditalic"); doc.text(c.name.toUpperCase(), x + 3, y + 4);
      doc.setFontSize(7); doc.setTextColor(120, 120, 120); doc.setFont("helvetica", "italic"); doc.text(stripForPDF(c.role), x + 3, y + 8);
      let ty = y + 12;
      c.ideas.forEach((idea) => {
        doc.setFontSize(8); doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold");
        doc.splitTextToSize("• " + stripForPDF(idea.title), colW - 6).forEach((l) => { if (ty < y + rowH - 3) { doc.text(l, x + 3, ty); ty += 3.2; } });
        if (ty < y + rowH - 3) { doc.setFontSize(6.5); doc.setTextColor(40, 130, 80); doc.text("  " + idea.format + " · Post " + idea.day, x + 3, ty); ty += 3; }
        if (idea.desc) { doc.setFontSize(6.5); doc.setTextColor(80, 80, 80); doc.setFont("helvetica", "normal"); doc.splitTextToSize("  " + stripForPDF(idea.desc), colW - 6).forEach((l) => { if (ty < y + rowH - 3) { doc.text(l, x + 3, ty); ty += 2.8; } }); }
        ty += 1.5;
      });
      col++; if (col >= 3) { col = 0; row++; }
    });
    footer("Page " + page);
    if (data.production && data.production.length) {
      doc.addPage(); header("PRODUCTION LIST — NON-VIDEO CONTENT");
      const pColW = (W - 30) / 3, pRowH = 42; let pc = 0, pr = 0;
      data.production.forEach((it) => {
        const x = 10 + pc * (pColW + 5), y = 34 + pr * pRowH;
        doc.setDrawColor(226, 134, 228); doc.setLineWidth(1); doc.line(x, y, x, y + pRowH - 3);
        let ty = y + 5; doc.setFontSize(9); doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold");
        doc.splitTextToSize("• " + stripForPDF(it.title), pColW - 6).forEach((l) => { if (ty < y + pRowH - 3) { doc.text(l, x + 3, ty); ty += 3.5; } });
        if (ty < y + pRowH - 3) { doc.setFontSize(7); doc.setTextColor(180, 50, 180); doc.text("  " + it.format + " · " + it.day, x + 3, ty); ty += 3.5; }
        if (it.desc) { doc.setFontSize(6.5); doc.setTextColor(80, 80, 80); doc.setFont("helvetica", "normal"); doc.splitTextToSize("  " + stripForPDF(it.desc), pColW - 6).forEach((l) => { if (ty < y + pRowH - 3) { doc.text(l, x + 3, ty); ty += 2.8; } }); }
        pc++; if (pc >= 3) { pc = 0; pr++; }
      });
      footer("Production list");
    }
    const filename = "ProWorld_WeeklyBrief_" + data.weekDates.replace(/[^\w]/g, "_") + ".pdf";
    deliverFile(filename, doc.output("blob"), () => doc.save(filename));
  }
  // Downloads: the artifact sandbox blocks page-started downloads, so hand the file to the
  // viewer through the downloads capability; outside the sandbox fall back to a direct save.
  async function deliverFile(filename, blob, fallback) {
    let dl = null;
    dl = null; // GitHub Pages: a page-started download works directly
    if (!dl) { try { fallback(); } catch (e) { toast("Couldn't start the download here", true); } return; }
    try { await dl.save({ filename, data: blob }); toast("Saved " + filename); }
    catch (e) {
      const code = e && e.code;
      if (code === "declined") return;
      if (code === "rate_limited") toast("A download prompt is already open — answer it first", true);
      else toast("Download unavailable in this view (" + (code || "error") + ")", true);
    }
  }

  // ───────────────────────── archive ─────────────────────────
  window.renderArchive = function () {
    const q = ($("arch-search").value || "").toLowerCase();
    const list = S.archive.filter((p) => !q || (p.title + " " + p.coach + " " + p.pillar + " " + p.platform + " " + p.desc).toLowerCase().includes(q)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    $("archive-list").innerHTML = list.length ? list.map((p) => { const d = new Date(p.date + "T12:00:00"); return '<div class="arch"><div><div class="arch-date">' + SM[d.getMonth()] + " " + d.getDate() + '</div><div class="arch-tags">' + esc(p.platform) + '</div></div><div><div class="arch-tags">' + esc(p.pillar) + " · " + esc(p.coach) + " · " + esc(p.format) + '</div><div class="arch-title">' + esc(p.title) + '</div><div class="arch-desc">' + esc(p.desc) + '</div></div><div><button class="btn ghost xs muted" onclick="deletePost(\'' + esc(p.id) + '\')">×</button></div></div>'; }).join("") : '<div class="empty">No posts found. Try a different search or log a new post.</div>';
    $("arch-count").textContent = S.archive.length;
    $("arch-weeks").textContent = new Set(S.archive.map((p) => sundayOf(new Date(p.date + "T12:00:00")).toISOString().slice(0, 10))).size;
    $("arch-coaches").textContent = new Set(S.archive.map((p) => p.coach)).size;
  };
  window.addPost = function () {
    const title = $("new-title").value.trim(); if (!title) { toast("Give the post a title", true); return; }
    S.archive.unshift({ id: "user_" + Date.now(), date: $("new-date").value || new Date().toISOString().slice(0, 10), coach: $("new-coach").value.trim() || "—", platform: $("new-platform").value, format: $("new-format").value, pillar: $("new-pillar").value.trim() || "—", title, desc: $("new-desc").value.trim() });
    save("archive"); renderArchive(); ["new-date", "new-coach", "new-pillar", "new-title", "new-desc"].forEach((id) => ($(id).value = "")); toast("Post logged");
  };
  window.deletePost = async function (id) { if (!(await askConfirm("Delete post", "Remove this post from the archive?", "Delete", true))) return; S.archive = S.archive.filter((p) => p.id !== id); save("archive"); renderArchive(); };

  // ───────────────────────── meta ads ─────────────────────────
  function renderAds() {
    const a = S.ads; $("ads-account").textContent = a.account; $("ads-budget").textContent = a.budget; $("ads-top").textContent = a.top;
    $("ads-stats").innerHTML = '<div class="stat"><div class="stat-label">Daily budget</div><div class="stat-num sm">' + esc(a.budget) + '</div></div><div class="stat mint"><div class="stat-label">Top format</div><div class="stat-num sm">' + esc(a.top) + '</div></div><div class="stat cyan"><div class="stat-label">Campaign</div><div class="stat-num sm">' + esc(a.campaign) + '</div></div><div class="stat orchid"><div class="stat-label">Status</div><div class="stat-num sm"><span class="hl mint">' + esc(a.status) + '</span></div></div>';
  }
  window.editAds = async function () {
    const a = S.ads;
    const r = await askForm("Campaign facts", [{ key: "campaign", label: "Campaign", value: a.campaign }, { key: "budget", label: "Daily budget", value: a.budget }, { key: "top", label: "Top performing creative", value: a.top }, { key: "status", label: "Status", type: "select", options: ["LIVE", "PAUSED", "ENDED"], value: a.status }], "Save");
    if (!r) return;
    S.ads = { account: a.account, campaign: r.campaign, budget: r.budget, top: r.top, status: r.status }; save("ads"); renderAds(); toast("Campaign facts updated");
  };

  // ───────────────────────── the two-week plan ─────────────────────────
  // The 14 posts the team approves one by one (this week + next week, one a day), plus the extras (the
  // spares) that can take a day when a post falls through. "Set the two weeks" locks both weeks at once.
  const fnWeeks = () => { const a = wsOf(new Date()); return [a, shiftWS(a, 1)]; };
  function fnItems(ws) {
    const w = (S.weeks || {})[ws]; if (!w) return [];
    const out = [];
    (w.coaches || []).forEach((c, ci) => (c.ideas || []).forEach((i, ii) => out.push({ ws, kind: "idea", ci, ii, who: c.name, role: c.role, it: i })));
    (w.production || []).forEach((p, pi) => out.push({ ws, kind: "prod", pi, who: /^ad/i.test(p.format || "") ? "Ad video" : "Production", role: p.pillar || "", it: p }));
    const rank = (d) => { const k = POST_DAYS.indexOf(d); return k < 0 ? 99 : k; };
    return out.sort((a, b) => rank(a.it.day) - rank(b.it.day));
  }
  const isExtra = (it) => !POST_DAYS.includes(it.day);
  function fnCounts() {
    let planned = 0, approved = 0, extras = 0, weeks = 0;
    fnWeeks().forEach((ws) => { if (!S.weeks[ws]) return; weeks++; fnItems(ws).forEach((x) => { if (isExtra(x.it)) extras++; else { planned++; if (x.it.approved) approved++; } }); });
    return { planned, approved, extras, weeks };
  }
  function renderFortnight() {
    const el = $("fortnight"); if (!el) return;
    const [w1, w2] = fnWeeks(), c = fnCounts(), allLocked = [w1, w2].every((ws) => S.weeks[ws] && S.weeks[ws].locked);
    let h = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><div class="card-label" style="margin-bottom:4px">' + c.approved + " of " + c.planned + ' approved</div><div class="small muted">' + c.planned + " posts planned over the two weeks · " + c.extras + " extra" + (c.extras === 1 ? "" : "s") + ' in hand · tick each post, swap what you don\'t like, then set both weeks.</div></div>' +
      '<div class="btn-row">' + (c.weeks < 2 ? '<button class="btn" onclick="genMissingFortnight()">⚡ Generate the missing week' + (c.weeks === 0 ? "s" : "") + '</button>' : "") + '<button class="btn ghost sm" onclick="approveAllFortnight()"' + (c.planned && c.approved < c.planned ? "" : " disabled") + '>✓ Approve all</button><button class="btn mint" onclick="setFortnight()"' + (c.weeks === 2 && !allLocked ? "" : " disabled") + '>' + (allLocked ? "✓ Both weeks set" : "Set the two weeks") + '</button></div></div>';
    h += '<div class="progress" style="margin-top:14px"><div class="bar"><i style="width:' + (c.planned ? Math.round(c.approved / c.planned * 100) : 0) + '%"></i></div><div class="pillar-pct">' + c.approved + "/" + c.planned + '</div></div></div>';
    [w1, w2].forEach((ws, wi) => {
      const w = S.weeks[ws];
      h += '<div class="card"><div class="card-label' + (wi ? " cyan" : "") + '">Week ' + (wi + 1) + " · " + esc(weekLabel(ws)) + (w && w.theme ? " · " + esc(w.theme) : "") + (w ? (w.locked ? ' <span class="tag mint" style="margin-left:8px">Locked</span>' : ' <span class="tag cyan" style="margin-left:8px">Draft</span>') : "") + "</div>";
      if (!w) { h += '<div class="empty">No brief for this week yet — generate it above.</div></div>'; return; }
      fnItems(ws).forEach((x) => {
        const it = x.it, ex = isExtra(it), ref = "'" + ws + "','" + x.kind + "'," + (x.kind === "idea" ? x.ci + "," + x.ii : x.pi);
        h += '<div class="fn-row' + (it.approved ? " ok" : "") + (ex ? " extra" : "") + '"><div class="chk' + (it.approved ? " done" : "") + '" role="checkbox" aria-checked="' + !!it.approved + '" tabindex="0" title="' + (it.approved ? "Approved" : "Approve") + '" onclick="toggleApprove(' + ref + ')" onkeydown="if(event.key===\' \'||event.key===\'Enter\'){event.preventDefault();this.click()}">' + (it.approved ? "✓" : "") + '</div>' +
          '<div class="fn-day">' + (ex ? '<span class="tag orchid" style="margin:0">Extra</span>' : esc(it.day)) + '</div>' +
          '<div class="fn-body"><div class="item-title">' + esc(it.title) + '</div><div class="small muted">' + esc(x.who) + (x.role ? " · " + esc(x.role) : "") + " · " + esc(it.format) + (it.delivered ? ' · <span class="tag mint" style="margin:0">delivered</span>' : "") + '</div>' + (it.hook ? '<div class="item-hook">' + esc(it.hook) + '</div>' : "") + '</div>' +
          '<div class="item-actions" style="margin:0">' + (ex ? '<button class="btn ghost xs orchid" onclick="useExtra(' + ref + ')">↑ Use instead of…</button>' : '<button class="btn ghost xs" onclick="fnSwap(' + ref + ')">↻ Swap</button>') + '<button class="btn ghost xs" onclick="fnEdit(' + ref + ')">✎</button><button class="btn ghost xs muted" onclick="fnSkip(' + ref + ')">✕</button></div></div>';
      });
      h += "</div>";
    });
    el.innerHTML = h;
  }
  const fnGet = (ws, kind, a, b) => { const w = S.weeks[ws]; if (!w) return null; return kind === "idea" ? (w.coaches[a] && w.coaches[a].ideas[b]) : w.production[a]; };
  function fnSync(ws) { recomputeUsed(); save("weeks"); renderWeekViews(); renderFortnight(); }
  window.toggleApprove = function (ws, kind, a, b) { const it = fnGet(ws, kind, a, b); if (!it) return; it.approved = !it.approved; fnSync(ws); };
  window.approveAllFortnight = function () { fnWeeks().forEach((ws) => fnItems(ws).forEach((x) => { if (!isExtra(x.it)) x.it.approved = true; })); save("weeks"); renderFortnight(); toast("All planned posts approved — now set the two weeks"); };
  window.setFortnight = async function () {
    const c = fnCounts(); if (c.weeks < 2) { toast("Generate both weeks first", true); return; }
    const msg = c.approved < c.planned ? c.approved + " of " + c.planned + " posts are approved. Set both weeks anyway? Everything in them is locked out of future weeks." : "All " + c.planned + " posts approved. Lock both weeks? Their ideas never get assigned again.";
    if (!(await askConfirm("Set the two weeks", msg, "Set both weeks"))) return;
    fnWeeks().forEach((ws) => { const w = S.weeks[ws]; if (!w) return; w.locked = true; w.approvedAt = new Date().toISOString(); delete w.warnings; });
    recomputeUsed(); save("weeks"); renderWeekViews(); renderFortnight(); toast("Both weeks set — send the briefs from the Workflow tab");
  };
  window.genMissingFortnight = function () {
    let n = 0; fnWeeks().forEach((ws) => { if (S.weeks[ws]) return; const t = detectWeekTheme(wsDate(ws)); S.weeks[ws] = buildWeek(ws, t.theme, t.pillar); n++; });
    if (!n) { toast("Both weeks already exist"); return; }
    recomputeUsed(); save("weeks"); renderWeekViews(); renderFortnight(); toast(n + " week" + (n > 1 ? "s" : "") + " built on the recipe — approve the posts one by one");
  };
  window.fnSwap = function (ws, kind, a, b) { const w = S.weeks[ws]; if (!w) return; const it = fnGet(ws, kind, a, b); if (!it) return;
    if (kind === "idea") { const c = w.coaches[a], avail = availableIdeas(c.name, ws).filter((i) => i.id !== it.id && !c.ideas.some((x) => x.id === i.id)); if (!avail.length) { toast("No more ideas in " + c.name + "'s bank — add one on Coach Assignments", true); return; } const np = pick(avail[0]); np.day = it.day; c.ideas[b] = np; }
    else { const avail = availableProd(ws).filter((x) => x.id !== it.id && !w.production.some((p) => p.id === x.id) && (/^ad/i.test(it.format || "") ? /^ad/i.test(x.format || "") : isPostItem(x))); if (!avail.length) { toast("Nothing else of that kind in the production bank", true); return; } const np = pick(avail[0], { pillar: avail[0].pillar }); np.day = it.day; w.production[a] = np; }
    fnSync(ws); toast("Swapped — approve it when it's right");
  };
  window.fnEdit = async function (ws, kind, a, b) { const it = fnGet(ws, kind, a, b); if (!it) return; const r = await askForm("Edit", ideaFields(it), "Save changes"); if (!r || !r.title) return; Object.assign(it, { title: r.title, desc: r.desc, day: r.day, format: r.format, hook: r.hook, custom: true }); fnSync(ws); };
  window.fnSkip = async function (ws, kind, a, b) { const w = S.weeks[ws]; const it = fnGet(ws, kind, a, b); if (!w || !it) return; if (!(await askConfirm("Drop this post", "Take it out of the plan? It goes back in the bank for a future week.", "Drop", true))) return; if (kind === "idea") w.coaches[a].ideas.splice(b, 1); else w.production.splice(a, 1); fnSync(ws); };
  window.useExtra = function (ws, kind, a, b) {
    const ex = fnGet(ws, kind, a, b); if (!ex) return;
    const planned = fnItems(ws).filter((x) => !isExtra(x.it));
    if (!planned.length) { toast("Nothing to replace this week", true); return; }
    let html = "<h3>Use this extra instead of…</h3><p>" + esc(ex.title) + " takes that post's day; the other one becomes the extra.</p>";
    planned.forEach((x) => { html += '<div class="bank-row" style="cursor:pointer" onclick="swapExtraWith(\'' + ws + "','" + kind + "'," + (kind === "idea" ? a + "," + b : a + ",-1") + ",'" + x.kind + "'," + (x.kind === "idea" ? x.ci + "," + x.ii : x.pi + ",-1") + ')"><div><strong>' + esc(x.it.day) + "</strong> · " + esc(x.it.title) + ' <span class="small muted">' + esc(x.who) + "</span></div><span class=\"btn ghost xs\">Replace</span></div>"; });
    html += '<div class="btn-row"><button class="btn ghost muted" onclick="closeModal()">Cancel</button></div>';
    openModal(html);
  };
  window.swapExtraWith = function (ws, k1, a1, b1, k2, a2, b2) {
    const ex = fnGet(ws, k1, a1, b1 < 0 ? undefined : b1), it = fnGet(ws, k2, a2, b2 < 0 ? undefined : b2); if (!ex || !it) { closeModal(); return; }
    const d = it.day; it.day = ex.day; ex.day = d; it.approved = false; closeModal(); fnSync(ws); toast(ex.title + " is now " + ex.day);
  };

  // ───────────────────────── boot ─────────────────────────
  function renderAll() { renderOverview(); renderAssignments(); renderProduction(); renderWeeks(); renderBankStatus(); renderCadence(); renderCal(); renderArchive(); renderKpiHistory(); renderAds(); renderFortnight(); (window.PW.hooks || []).forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
  window.renderAll = renderAll;
  // Bridge for the engine modules (content database, cadence ramp, workflow briefs)
  window.PW = { S, save, askForm, askConfirm, openModal, closeModal, esc, $, toast, sundayOf, SM, MONTHS, COACHES, PILLARS, ALREADY_POSTED_IDS, COACH_WEEKLY_COUNT, availableIdeas, availableProd, detectWeekTheme, stripForPDF, deliverFile, cur, thisWeek, curWS: () => curWS, weekList, weekLabel, wsOf, reserved, showWeek, hooks: [], isLive: () => !!db && !readOnly, loadedAt: () => loadedAt, recipe, weekCoaches, buildWeek };
  initLocal();
  showWeek(curWS);
  renderAll();
  initDb();
})();
