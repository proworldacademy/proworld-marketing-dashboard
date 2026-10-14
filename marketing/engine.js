/* PROWORLD Marketing Command Center — content engine modules
   Content Database (pillars), cadence ramp, workflow briefs. Uses the bridge app.js exposes as window.PW. */
(function () {
  "use strict";
  const PW = window.PW; if (!PW) return;
  const { S, save, askForm, askConfirm, openModal, closeModal, esc, $, toast, sundayOf, SM, MONTHS, COACHES } = PW;
  const ROSTER = new Set(COACHES.map((c) => c.name)); // only coaches on the filming roster count toward the banks
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const iso = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x.toISOString().slice(0, 10); };
  const today = () => iso(new Date());
  const fmtD = (s) => { const d = new Date(s + "T12:00:00"); return SM[d.getMonth()] + " " + d.getDate(); };

  // ───────────────────────── pillar mapping ─────────────────────────
  const COACH_PILLAR = { Tonio: "mental", Flo: "tour", Tara: "fitness", Lukas: "soccer", Kam: "dev", Robby: "dev", "Coach ET": "dev", Nico: "hp", Eric: "hp", Mauri: "hp", Quinnton: "hp" };
  function ideaPillar(coach, idea) {
    const t = ((idea.title || "") + " " + (idea.desc || "")).toLowerCase();
    if (!COACH_PILLAR[coach]) { if (/camp|program|enroll|trial|open house/.test(t)) return "promo"; if (/parent|kid|child|famil|invest|path|your young/.test(t)) return "parents"; return "culture"; }
    if ((coach === "Eric" || coach === "Nico" || coach === "Mauri") && /tournament|match day|scout|debrief|week before|long match|big point|practice match/.test(t)) return "tips";
    if (coach === "Tonio" && /tournament|match day/.test(t)) return "mental";
    return COACH_PILLAR[coach] || "culture";
  }
  function prodPillar(item) { const map = { tennis: "hp", tournament: "tips", recap: "culture", custom: "culture" }; return map[item.pillar] || item.pillar || "culture"; }
  function archivePillar(post) {
    const t = ((post.pillar || "") + " " + (post.title || "")).toLowerCase();
    for (const p of S.pillars) { if ((p.archiveKeys || []).some((k) => t.includes(k))) return p.id; }
    if (/tennis/.test(t)) return "hp";
    return "culture";
  }
  const pillarById = (id) => S.pillars.find((p) => p.id === id);
  function pillarStats(p) {
    const rs = PW.reserved(null);
    let avail = 0, taken = 0, items = [];
    Object.keys(S.ideaBank).forEach((coach) => { if (!ROSTER.has(coach)) return; (S.ideaBank[coach] || []).forEach((i) => { if (ideaPillar(coach, i) !== p.id) return; const u = rs.ideas.has(i.id); if (u) taken++; else avail++; items.push({ coach, idea: i, used: u }); }); });
    const prod = S.prodBank.filter((x) => prodPillar(x) === p.id); const prodAvail = prod.filter((x) => !rs.prod.has(x.id)).length;
    const posts = S.archive.filter((a) => archivePillar(a) === p.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const t = new Date(); const d30 = iso(new Date(t.getTime() - 30 * 864e5)), d90 = iso(new Date(t.getTime() - 90 * 864e5));
    const last30 = posts.filter((a) => a.date >= d30).length, last90 = posts.filter((a) => a.date >= d90).length;
    return { avail, taken, items, prod: prod.length, prodAvail, posts, last30, last90, last: posts[0] ? posts[0].date : null };
  }
  function archiveShare90() { const t = new Date(); const d90 = iso(new Date(t.getTime() - 90 * 864e5)); const recent = S.archive.filter((a) => a.date >= d90); const by = {}; recent.forEach((a) => { const id = archivePillar(a); by[id] = (by[id] || 0) + 1; }); return { by, total: recent.length }; }
  function pillarFlags(p, st, share) {
    const f = [];
    if (!st.last) f.push({ t: "Never posted", c: "orchid" }); else if (st.last30 === 0) f.push({ t: "Nothing in 30 days", c: "orchid" });
    if (share.total >= 8) { const actual = ((share.by[p.id] || 0) / share.total) * 100; if (actual < p.share / 2) f.push({ t: "Under target share", c: "warn" }); }
    if (st.avail + st.prodAvail === 0) f.push({ t: "Bank empty", c: "orchid" }); else if (st.avail + st.prodAvail < 3) f.push({ t: "Bank low", c: "warn" });
    if (!p.owners || !p.owners.length) f.push({ t: "No owner", c: "warn" });
    return f;
  }

  // ───────────────────────── content database ─────────────────────────
  let openPillar = null;
  function renderDatabase() {
    if (!$("pillar-grid")) return;
    const share = archiveShare90();
    const gaps = [];
    S.pillars.forEach((p) => { const st = pillarStats(p); pillarFlags(p, st, share).forEach((f) => gaps.push({ p, f })); });
    const openReq = (S.requests || []).filter((r) => r.status === "open");
    $("gaps").innerHTML = '<div class="card"><div class="card-label orchid">What\'s missing</div>' +
      (gaps.length ? '<div class="btn-row" style="gap:6px">' + gaps.map((g) => '<button class="btn ghost xs" style="background:var(--' + (g.f.c === "warn" ? "warn" : "orchid") + ');border-color:var(--' + (g.f.c === "warn" ? "warn" : "orchid") + ');color:#000" onclick="openPillarDetail(\'' + g.p.id + '\')">' + esc(g.p.name) + " · " + esc(g.f.t) + "</button>").join("") + "</div>" : '<div class="small muted">Every pillar has a recent post, a healthy bank and an owner.</div>') +
      (openReq.length ? '<div class="divider"></div><div class="small" style="font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px"><span class="hl cyan">Engine queue · ' + openReq.length + ' request' + (openReq.length > 1 ? "s" : "") + ' waiting for the Sunday run</span></div>' + openReq.map((r) => '<div class="recur">→ ' + esc((pillarById(r.pillar) || {}).name || r.pillar) + (r.angle ? " · " + esc(r.angle) : "") + (r.note ? " — " + esc(r.note) : "") + ' <button class="btn ghost xs muted" onclick="dropRequest(\'' + esc(r.id) + '\')">×</button></div>').join("") : "") + "</div>";
    $("pillar-grid").innerHTML = S.pillars.map((p) => {
      const st = pillarStats(p); const actual = share.total ? Math.round(((share.by[p.id] || 0) / share.total) * 100) : 0; const flags = pillarFlags(p, st, share);
      return '<div class="coach" style="border-left-color:var(--' + (p.color || "lime") + ');cursor:pointer" onclick="openPillarDetail(\'' + p.id + '\')">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><div class="coach-name"><span class="hl ' + (p.color || "lime") + '">' + esc(p.name) + '</span></div><div class="coach-role">' + (p.owners && p.owners.length ? esc(p.owners.join(" · ")) : "Unassigned") + '</div></div><div class="coach-count" style="background:var(--' + (p.color || "lime") + ')">' + p.share + '%</div></div>' +
        '<div class="grid-3" style="gap:8px;margin-top:12px"><div><div class="stat-label">In bank</div><div class="stat-num" style="font-size:24px;margin-top:2px">' + (st.avail + st.prodAvail) + '</div></div><div><div class="stat-label">Used</div><div class="stat-num" style="font-size:24px;margin-top:2px">' + (st.taken + (st.prod - st.prodAvail)) + '</div></div><div><div class="stat-label">Posted 90d</div><div class="stat-num" style="font-size:24px;margin-top:2px">' + st.last90 + '</div></div></div>' +
        '<div style="margin-top:10px"><div class="small muted" style="display:flex;justify-content:space-between"><span>Share of posts (90d)</span><span>' + actual + '% of ' + p.share + '% target</span></div><div class="bar" style="margin-top:4px"><i style="width:' + Math.min(100, actual * 3) + '%;background:var(--' + (p.color || "lime") + ')"></i></div></div>' +
        '<div class="small muted" style="margin-top:8px">Last posted: ' + (st.last ? fmtD(st.last) : "—") + '</div>' +
        (flags.length ? '<div class="btn-row" style="gap:6px;margin-top:8px">' + flags.map((f) => '<span class="tag" style="background:var(--' + (f.c === "warn" ? "warn" : "orchid") + ');margin:0">' + esc(f.t) + "</span>").join("") + "</div>" : "") + "</div>";
    }).join("");
    renderPillarDetail();
  }
  function renderPillarDetail() {
    const el = $("pillar-detail"); if (!el) return;
    const p = pillarById(openPillar); if (!p) { el.innerHTML = ""; return; }
    const st = pillarStats(p);
    let h = '<div class="card" style="border-top:3px solid var(--' + (p.color || "lime") + ')"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap"><div><h2 class="h-display" style="font-size:34px"><span class="hl ' + (p.color || "lime") + '">' + esc(p.name) + '</span></h2><div class="coach-role">' + p.share + '% of posts · ' + (p.owners && p.owners.length ? esc(p.owners.join(" · ")) : "no owner yet") + '</div></div><div class="btn-row"><button class="btn ghost sm" onclick="editPillar(\'' + p.id + '\')">✎ Edit pillar</button><button class="btn sm" onclick="requestIdeas(\'' + p.id + '\')">⚡ Request ideas</button><button class="btn ghost sm muted" onclick="closePillar()">Close</button></div></div>';
    h += '<div class="grid-3" style="margin-top:16px"><div><div class="card-label" style="font-size:14px">Why it matters</div><div class="item-desc">' + esc(p.why) + '</div></div><div><div class="card-label" style="font-size:14px">Who it\'s for</div><div class="item-desc">' + esc(p.audience) + '</div><div class="card-label" style="font-size:14px;margin-top:12px">Formats that work</div><div class="item-desc">' + (p.formats || []).map(esc).join("<br>") + '</div></div><div><div class="card-label" style="font-size:14px">Where to learn</div><div class="item-desc">' + esc(p.watch || "") + '</div>' + (p.notes ? '<div class="card-label" style="font-size:14px;margin-top:12px">Rules</div><div class="item-desc">' + esc(p.notes) + "</div>" : "") + "</div></div>";
    // angles
    h += '<div class="divider"></div><div class="card-label" style="font-size:14px">Angles to build on <span class="small muted" style="letter-spacing:0;text-transform:none;font-family:var(--body);font-style:normal;font-weight:400">— click the status to cycle open → queued → posted</span></div>';
    const angles = (p.angles || []).map((a) => (typeof a === "string" ? { text: a, status: "open" } : a));
    h += '<div class="grid-2" style="gap:6px 16px">' + angles.map((a, i) => { const col = a.status === "posted" ? "mint" : a.status === "queued" ? "cyan" : "line-2"; const lbl = a.status === "posted" ? "posted" : a.status === "queued" ? "queued" : "open"; return '<div class="recur" style="display:flex;align-items:center;gap:8px;justify-content:space-between"><span>' + esc(a.text) + '</span><span class="btn-row" style="gap:4px;flex-shrink:0"><button class="btn ghost xs" style="' + (col === "line-2" ? "color:var(--muted)" : "background:var(--" + col + ");border-color:var(--" + col + ");color:#000") + '" onclick="cycleAngle(\'' + p.id + "'," + i + ')">' + lbl + '</button><button class="btn ghost xs" title="Ask the engine for ideas on this angle" onclick="requestIdeas(\'' + p.id + "'," + i + ')">⚡</button><button class="btn ghost xs muted" onclick="removeAngle(\'' + p.id + "'," + i + ')">×</button></span></div>'; }).join("") + "</div>";
    h += '<div class="btn-row" style="margin-top:10px"><button class="btn ghost xs" onclick="addAngle(\'' + p.id + '\')">+ Add angle</button></div>';
    // bank + archive
    h += '<div class="divider"></div><div class="grid-2"><div><div class="card-label" style="font-size:14px">In the bank · ' + (st.avail + st.prodAvail) + ' ready</div>' +
      (st.items.length || st.prod ? '<div style="max-height:320px;overflow:auto">' + st.items.map((x) => '<div class="recur" style="' + (x.used ? "opacity:.45" : "") + '"><strong style="color:var(--text-2)">' + esc(x.coach) + '</strong> — ' + esc(x.idea.title) + ' <span class="small muted">' + esc(x.idea.format) + (x.used ? " · used" : "") + '</span></div>').join("") + S.prodBank.filter((x) => prodPillar(x) === p.id).map((x) => { const u = PW.reserved(null).prod.has(x.id); return '<div class="recur" style="' + (u ? "opacity:.45" : "") + '"><strong><span class="hl orchid">Production</span></strong> — ' + esc(x.title) + ' <span class="small muted">' + esc(x.format) + (u ? " · used" : "") + '</span></div>'; }).join("") + "</div>" : '<div class="small muted">Nothing in the bank for this pillar yet.</div>') + "</div>" +
      '<div><div class="card-label" style="font-size:14px">Posted · ' + st.posts.length + '</div>' + (st.posts.length ? '<div style="max-height:320px;overflow:auto">' + st.posts.slice(0, 40).map((a) => '<div class="recur"><strong style="color:var(--text-2)">' + fmtD(a.date) + '</strong> — ' + esc(a.title) + ' <span class="small muted">' + esc(a.coach || "") + " · " + esc(a.format || "") + '</span></div>').join("") + "</div>" : '<div class="small muted">No posts logged in this pillar.</div>') + "</div></div></div>";
    el.innerHTML = h;
  }
  window.openPillarDetail = function (id) { openPillar = id; renderPillarDetail(); const el = $("pillar-detail"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  window.closePillar = function () { openPillar = null; renderPillarDetail(); };
  window.cycleAngle = function (pid, i) { const p = pillarById(pid); const a = p.angles[i]; const obj = typeof a === "string" ? { text: a, status: "open" } : a; obj.status = obj.status === "open" ? "queued" : obj.status === "queued" ? "posted" : "open"; p.angles[i] = obj; save("pillars"); renderDatabase(); };
  window.removeAngle = async function (pid, i) { const p = pillarById(pid); const a = p.angles[i]; if (!(await askConfirm("Remove angle", 'Remove "' + (a.text || a) + '" from ' + p.name + "?", "Remove", true))) return; p.angles.splice(i, 1); save("pillars"); renderDatabase(); };
  window.addAngle = async function (pid) { const p = pillarById(pid); const r = await askForm("New angle — " + p.name, [{ key: "text", label: "Angle (a topic we can make several pieces from)", value: "" }], "Add angle"); if (!r || !r.text) return; p.angles.push({ text: r.text, status: "open" }); save("pillars"); renderDatabase(); toast("Angle added"); };
  window.editPillar = async function (pid) {
    const p = pillarById(pid);
    const r = await askForm("Edit — " + p.name, [{ key: "name", label: "Name", value: p.name }, { key: "share", label: "Target share of posts (%)", value: String(p.share) }, { key: "owners", label: "Owners (comma separated)", value: (p.owners || []).join(", ") }, { key: "why", label: "Why it matters", type: "textarea", value: p.why }, { key: "audience", label: "Who it's for", type: "textarea", rows: 2, value: p.audience }, { key: "formats", label: "Formats that work (one per line)", type: "textarea", value: (p.formats || []).join("\n") }, { key: "watch", label: "Where to learn / who to watch", type: "textarea", rows: 2, value: p.watch || "" }, { key: "notes", label: "Rules / notes", type: "textarea", rows: 2, value: p.notes || "" }], "Save pillar");
    if (!r) return;
    Object.assign(p, { name: r.name || p.name, share: parseInt(r.share, 10) || p.share, owners: r.owners.split(",").map((x) => x.trim()).filter(Boolean), why: r.why, audience: r.audience, formats: r.formats.split("\n").map((x) => x.trim()).filter(Boolean), watch: r.watch, notes: r.notes });
    save("pillars"); renderDatabase(); toast("Pillar saved");
  };
  window.requestIdeas = async function (pid, angleIdx) {
    const p = pillarById(pid); const angle = angleIdx != null ? (p.angles[angleIdx].text || p.angles[angleIdx]) : "";
    const r = await askForm("Request ideas — " + p.name, [{ key: "angle", label: "Angle (optional)", value: angle }, { key: "count", label: "How many", type: "select", options: ["5", "10", "15"], value: "10" }, { key: "note", label: "Anything specific? (format, coach, event, tone)", type: "textarea", rows: 2, value: "" }], "Send to the engine", "The engine runs every Sunday. It writes the ideas into the bank in the owners' voice, checking the archive so nothing repeats, and marks the request done.");
    if (!r) return;
    S.requests = S.requests || []; S.requests.push({ id: "rq_" + Date.now(), pillar: pid, angle: r.angle, count: parseInt(r.count, 10) || 10, note: r.note, by: "dashboard", at: new Date().toISOString(), status: "open" });
    save("requests"); renderDatabase(); renderEngineCard(); toast("Queued for the Sunday run");
  };
  window.dropRequest = function (id) { S.requests = (S.requests || []).filter((r) => r.id !== id); save("requests"); renderDatabase(); renderEngineCard(); };

  // ───────────────────────── cadence ramp ─────────────────────────
  function rampTarget(dateStr) {
    const c = S.cadencePlan; const start = new Date(c.start + "T12:00:00"), d = new Date(dateStr + "T12:00:00");
    if (d < start) return { posts: 0, stories: 0, month: 0 };
    const idx = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth()) - (d.getDate() < start.getDate() ? 1 : 0);
    return { posts: Math.min(c.postsCap, c.posts0 + Math.max(0, idx) * c.postsStep), stories: Math.min(c.storiesCap, c.stories0 + Math.max(0, idx) * c.storiesStep), month: Math.max(0, idx) + 1 };
  }
  function dayLog(ds) { return S.daily[ds] || { p: 0, s: 0 }; }
  function monthSummary() {
    const t = new Date(), ds = today(), tgt = rampTarget(ds); const start = new Date(S.cadencePlan.start + "T12:00:00");
    // period = ramp month: from start day of this ramp month to today
    let periodStart = new Date(start); periodStart.setMonth(start.getMonth() + (tgt.month - 1)); if (periodStart > t) periodStart = start;
    let days = 0, hit = 0, posts = 0, stories = 0;
    for (let d = new Date(periodStart); iso(d) <= ds; d.setDate(d.getDate() + 1)) { const l = dayLog(iso(d)); days++; posts += l.p; stories += l.s; if (l.p >= tgt.posts && l.s >= tgt.stories) hit++; }
    return { tgt, days, hit, posts, stories };
  }
  function renderRamp() {
    if (!$("ramp-days")) return;
    const ds = today(), tgt = rampTarget(ds), ms = monthSummary(), tl = dayLog(ds);
    $("ramp-head").innerHTML = '<div class="stat"><div class="stat-label">Ramp month ' + tgt.month + ' target</div><div class="stat-num" style="font-size:30px">' + tgt.posts + ' post' + (tgt.posts === 1 ? "" : "s") + ' · ' + tgt.stories + ' stories</div><div class="stat-sub">every day · next step up on ' + nextStepDate() + '</div></div>' +
      '<div class="stat mint"><div class="stat-label">Today</div><div class="stat-num" style="font-size:30px">' + tl.p + '/' + tgt.posts + ' · ' + tl.s + '/' + tgt.stories + '</div><div class="stat-sub">posts · stories</div></div>' +
      '<div class="stat cyan"><div class="stat-label">Days on target</div><div class="stat-num" style="font-size:30px">' + ms.hit + '/' + ms.days + '</div><div class="stat-sub">this ramp month</div></div>' +
      '<div class="stat orchid"><div class="stat-label">Published this month</div><div class="stat-num" style="font-size:30px">' + ms.posts + ' · ' + ms.stories + '</div><div class="stat-sub">posts · stories</div></div>';
    const sun = sundayOf(new Date()); let h = '<div class="grid-4" style="grid-template-columns:repeat(7,1fr);gap:6px">';
    for (let i = 0; i < 7; i++) { const d = new Date(sun); d.setDate(sun.getDate() + i); const k = iso(d), l = dayLog(k), t = rampTarget(k), isT = k === ds, future = k > ds; const ok = l.p >= t.posts && l.s >= t.stories && t.posts > 0;
      h += '<div class="stat' + (ok ? " mint" : "") + '" style="padding:10px;' + (isT ? "outline:2px solid #000" : "") + (future ? ";opacity:.45" : "") + '"><div class="stat-label">' + DAYS[d.getDay()] + ' ' + d.getDate() + '</div>' +
        counter(k, "p", l.p, t.posts, "posts") + counter(k, "s", l.s, t.stories, "stories") + "</div>"; }
    $("ramp-days").innerHTML = h + "</div>";
    // Overview override
    if ($("ov-cadence")) { $("ov-cadence").textContent = tl.p + "/" + tgt.posts + " · " + tl.s + "/" + tgt.stories; const sub = $("ov-cadence").nextElementSibling; if (sub) sub.textContent = "Today's posts · stories — " + ms.hit + " of " + ms.days + " days on target"; }
  }
  function counter(k, f, v, t, label) { return '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px"><span class="small muted">' + label + ' <span style="color:var(--text)">' + v + '</span>/' + t + '</span><span class="btn-row" style="gap:3px"><button class="btn ghost xs muted" onclick="bump(\'' + k + "','" + f + "',-1)\">−</button><button class=\"btn xs\" onclick=\"bump('" + k + "','" + f + "',1)\">+</button></span></div>"; }
  function nextStepDate() { const c = S.cadencePlan, t = rampTarget(today()); if (t.posts >= c.postsCap && t.stories >= c.storiesCap) return "— at full cadence"; const s = new Date(c.start + "T12:00:00"); s.setMonth(s.getMonth() + t.month); return SM[s.getMonth()] + " " + s.getDate(); }
  window.bump = function (k, f, d) { const l = Object.assign({ p: 0, s: 0 }, S.daily[k] || {}); l[f] = Math.max(0, (l[f] || 0) + d); S.daily[k] = l; save("daily"); renderRamp(); };
  window.editRamp = async function () {
    const c = S.cadencePlan;
    const r = await askForm("Edit the ramp", [{ key: "start", label: "Start date (YYYY-MM-DD)", value: c.start }, { key: "posts0", label: "Posts per day — month 1", value: String(c.posts0) }, { key: "stories0", label: "Stories per day — month 1", value: String(c.stories0) }, { key: "postsStep", label: "Posts added each month", value: String(c.postsStep) }, { key: "storiesStep", label: "Stories added each month", value: String(c.storiesStep) }, { key: "postsCap", label: "Posts per day — full cadence", value: String(c.postsCap) }, { key: "storiesCap", label: "Stories per day — full cadence", value: String(c.storiesCap) }], "Save ramp");
    if (!r) return; const n = (x, d) => { const v = parseInt(x, 10); return isNaN(v) ? d : v; };
    S.cadencePlan = { start: /^\d{4}-\d{2}-\d{2}$/.test(r.start) ? r.start : c.start, posts0: n(r.posts0, c.posts0), stories0: n(r.stories0, c.stories0), postsStep: n(r.postsStep, c.postsStep), storiesStep: n(r.storiesStep, c.storiesStep), postsCap: n(r.postsCap, c.postsCap), storiesCap: n(r.storiesCap, c.storiesCap) };
    save("cadencePlan"); renderRamp(); toast("Ramp saved");
  };

  // ───────────────────────── workflow ─────────────────────────
  function renderWorkflow() {
    if (!$("pipeline")) return;
    const T = S.team;
    const stages = [
      { n: "1", t: "The engine (AI)", c: "lime", lines: ["Studies the market: our Instagram results, competitor and inspiration accounts, the season", "Keeps every pillar fed — new ideas in each coach's voice, never repeating the archive or the banks", "Generates the week: 5 coach videos, 1 ad video, 2 carousels — 7 posts + 1 spare — then the shot list, edit brief and posting plan", "Reads results weekly: doubles down on what worked, drops what didn't, tries one new thing"] },
      { n: "2", t: "Coaches + photographer", c: "mint", lines: ["Coaches film their tip or talking head from the brief (phone is fine)", (T.photographer || "Photographer") + " shoots the shot list on " + (T.shootDay || "shoot day") + " · " + (T.photographerCadence || "weekly"), "Carousels and statics are designed from the production list", "Flo sends tour clips the day they happen"] },
      { n: "3", t: (T.editor || "Editor") + " — edit", c: "cyan", lines: ["Edits every video to the brief: hook, captions, titles in brand type, end card", "High-end grade for photographer footage; clean and natural for coach tips", "Turnaround: 48 hours from receiving footage", "Delivers 9:16 MP4s + carousel exports in the shared folder"] },
      { n: "4", t: (T.manager || "Manager") + " — post & manage", c: "orchid", lines: ["Posts to the daily cadence from the posting plan", "Daily Academy Vibes stories (2–3 clips) and reshares", "Logs each post in the archive and ticks the cadence tracker", "Replies to comments and DMs; flags questions for the team"] }
    ];
    $("pipeline").innerHTML = stages.map((s) => '<div class="coach" style="border-left-color:var(--' + s.c + ')"><div class="coach-name"><span class="hl ' + s.c + '">' + esc(s.n + " · " + s.t) + '</span></div>' + s.lines.map((l) => '<div class="item-desc" style="margin-top:8px">· ' + esc(l) + "</div>").join("") + "</div>").join("");
    $("rhythm").innerHTML = [["Sunday", "Engine generates the week · owner approves & locks · briefs go out (coaches, photographer, " + (T.editor || "editor") + ", " + (T.manager || "manager") + ")"], ["Monday", "Coaches start filming their piece · production items designed"], [(T.shootDay || "Wed"), "Photographer shoot day — shot list from this page"], ["Within 48h of footage", (T.editor || "Editor") + " delivers edits"], ["Every day", (T.manager || "Manager") + " posts to cadence · Academy Vibes stories · logs posts · replies"], ["Friday", "Delivery check: what's still unfilmed goes to next week or gets swapped"], ["Saturday", "Players in Action recap from the weekend tournaments"], ["Monthly", "Performance review: best and worst posts, saves, comments, growth → the mix and the banks adjust"]].map((r) => '<div class="recur"><strong>' + esc(r[0]) + "</strong> — " + esc(r[1]) + "</div>").join("");
    $("team").innerHTML = [["Marketing manager", T.manager], ["Editor", T.editor], ["Photographer", T.photographer || "— not set"], ["Shoot cadence", (T.photographerCadence || "Weekly") + " · " + (T.shootDay || "Wed")], ["Owner / approver", "Antonio"]].map((r) => '<div class="recur"><strong>' + esc(r[0]) + "</strong> — " + esc(r[1]) + "</div>").join("");
    const w = PW.cur(), has = !!w;
    $("brief-buttons").innerHTML = [["Coach brief", "downloadPDF()", "copyBrief()"], ["Photographer shot list", "briefPDF('shots')", "briefCopy('shots')"], ["Editor brief — " + (T.editor || "editor").split(" ")[0], "briefPDF('edit')", "briefCopy('edit')"], ["Posting plan — " + (T.manager || "manager"), "briefPDF('post')", "briefCopy('post')"]].map((b) => '<span class="btn-row" style="gap:4px;margin-right:10px"><button class="btn sm"' + (has ? "" : " disabled") + ' onclick="' + b[1] + '">' + esc(b[0]) + ' PDF</button><button class="btn ghost sm"' + (has ? "" : " disabled") + ' onclick="' + b[2] + '">Copy</button></span>').join("") + (has ? '<div class="small muted" style="margin-top:8px;flex-basis:100%">Built from the week of <strong>' + esc(w.weekDates) + '</strong> (' + (w.locked ? "approved" : "draft — approve it before sending") + ') — the week selected on Coach Assignments.</div>' : '<div class="small muted" style="margin-top:8px">Generate a week on Coach Assignments first.</div>');
    renderReminders();
  }
  // ── standing to-dos (shared): what still has to happen around the engine
  function renderReminders() {
    const el = $("reminders"); if (!el) return;
    const list = S.reminders || [];
    el.innerHTML = (list.length ? list.map((r, i) => '<div class="recur" style="display:flex;gap:10px;align-items:flex-start"><div class="chk' + (r.status === "done" ? " done" : "") + '" role="checkbox" aria-checked="' + (r.status === "done") + '" tabindex="0" style="width:22px;height:22px;flex-shrink:0;margin-top:1px" onclick="toggleReminder(' + i + ')">' + (r.status === "done" ? "✓" : "") + '</div><div style="flex:1;min-width:0' + (r.status === "done" ? ";opacity:.5;text-decoration:line-through" : "") + '"><div style="font-weight:700;color:var(--text)">' + esc(r.text) + '</div>' + (r.note ? '<div class="small muted">' + esc(r.note) + "</div>" : "") + '</div><button class="btn ghost xs muted" onclick="removeReminder(' + i + ')">×</button></div>').join("") : '<div class="small muted">Nothing pending.</div>') +
      '<div class="btn-row" style="margin-top:10px"><button class="btn ghost xs" onclick="addReminder()">+ Add a reminder</button></div>';
  }
  window.toggleReminder = function (i) { const r = S.reminders[i]; if (!r) return; r.status = r.status === "done" ? "open" : "done"; r.doneAt = r.status === "done" ? new Date().toISOString() : undefined; save("reminders"); renderReminders(); };
  window.removeReminder = async function (i) { const r = S.reminders[i]; if (!r) return; if (!(await askConfirm("Remove reminder", 'Remove "' + r.text + '"?', "Remove", true))) return; S.reminders.splice(i, 1); save("reminders"); renderReminders(); };
  window.addReminder = async function () { const r = await askForm("New reminder", [{ key: "text", label: "What has to happen", value: "" }, { key: "note", label: "Detail (optional)", type: "textarea", rows: 2, value: "" }], "Add"); if (!r || !r.text) return; (S.reminders = S.reminders || []).push({ id: "rm_" + Date.now(), text: r.text, note: r.note, status: "open", at: new Date().toISOString() }); save("reminders"); renderReminders(); };
  window.editTeam = async function () {
    const T = S.team;
    const r = await askForm("Team", [{ key: "manager", label: "Marketing manager (posts & manages)", value: T.manager }, { key: "editor", label: "Editor", value: T.editor }, { key: "photographer", label: "Photographer", value: T.photographer || "" }, { key: "photographerCadence", label: "Shoot cadence", type: "select", options: ["Weekly", "Twice a week", "Every 2 weeks"], value: T.photographerCadence || "Weekly" }, { key: "shootDay", label: "Shoot day", type: "select", options: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], value: T.shootDay || "Wed" }], "Save team");
    if (!r) return; S.team = Object.assign({}, T, r); save("team"); renderWorkflow(); toast("Team saved");
  };

  // ── brief builders (text model shared by PDF and copy)
  const secs = (txt) => { const m = String(txt || "").match(/⏱\s*([^·]+)/); return m ? m[1].trim() : ""; };
  function videoItems(d) { const out = []; d.coaches.forEach((c) => c.ideas.forEach((i) => { if (/Reel|Talking Head|Story/i.test(i.format)) out.push({ who: c.name, role: c.role, idea: i, self: c.name === "Flo" || /Story/i.test(i.format) }); })); (d.production || []).forEach((p) => { if (/^ad\b|ad video/i.test(p.format)) out.push({ who: "Ad video", role: "paid promo — photographer shoots, " + ((S.team && S.team.editor) || "editor").split(" ")[0] + " cuts a 15–30s version too", idea: p, self: false }); else if (/Reel|Story/i.test(p.format)) out.push({ who: "Production", role: "non-video", idea: p, self: /Story/i.test(p.format) }); }); return out; }
  function photoItems(d) { return (d.production || []).filter((p) => /Carousel|Static/i.test(p.format)); }
  function buildBrief(kind) {
    const d = PW.cur(), T = S.team, wk = d.weekDates, theme = d.theme ? " · Theme: " + d.theme : "";
    const doc = { title: "", sub: "Week of " + wk + theme, wk, sections: [] };
    if (kind === "shots") {
      doc.title = "PHOTOGRAPHER SHOT LIST"; const vids = videoItems(d).filter((v) => !v.self), self = videoItems(d).filter((v) => v.self);
      doc.sections.push({ h: "Shoot day: " + (T.shootDay || "TBD") + " · " + (T.photographerCadence || "Weekly") + " · Delray Beach", lines: ["Look: high-end — natural light, steady camera, clean backgrounds, real players. Horizontal safe for 9:16 crop. Capture 10–15s of B-roll per setup for the editor.", "Hand footage to " + (T.editor || "the editor") + " the same day."] });
      const byCoach = {}; vids.forEach((v) => (byCoach[v.who] = byCoach[v.who] || []).push(v));
      Object.keys(byCoach).forEach((who) => doc.sections.push({ h: "Film with " + who + (byCoach[who][0].role !== "non-video" ? " — " + byCoach[who][0].role : ""), lines: byCoach[who].map((v) => "• " + v.idea.title + " — " + v.idea.format + (secs(v.idea.desc) ? ", " + secs(v.idea.desc) : "") + "\n   " + PW.stripForPDF(v.idea.desc) + (v.idea.hook ? "\n   Opening line: " + v.idea.hook : "")) }));
      const photos = photoItems(d); if (photos.length) doc.sections.push({ h: "Photos for carousels and statics", lines: photos.map((p) => "• " + p.title + " — " + PW.stripForPDF(p.desc)) });
      doc.sections.push({ h: "Always", lines: ["• 20+ frames of Academy Vibes: courts, players mid-rally, coaches coaching, the clubhouse, golden hour on the courts.", "• Portraits of any coach on this week's list who doesn't have a current headshot."] });
      if (self.length) doc.sections.push({ h: "Self-shot this week (not the photographer)", lines: self.map((v) => "• " + v.who + " — " + v.idea.title + " (" + v.idea.format + ")") });
    } else if (kind === "edit") {
      doc.title = "EDITOR BRIEF — " + (T.editor || "EDITOR").toUpperCase(); const vids = videoItems(d);
      doc.sections.push({ h: "Standards for every video", lines: ["• Deliver 9:16 MP4, 1080×1920, captions burned in, music under the voice.", "• Hook in the first 2 seconds: the opening line as an on-screen title in Review Condensed, uppercase italic, lime #E2FE78 on black or white.", "• Lower-third with the coach's name and role; end card with the PROWORLD wordmark and proworldacademy.com (Tonio's videos end: More at toniofernandez.com).", "• Grade: clean and natural for coach tips; cinematic, high-end for photographer footage. No heavy filters, no stock.", "• Turnaround 48 hours from receiving footage. Name files PW_" + wk.replace(/[^\w]/g, "") + "_Coach_Title.mp4."] });
      doc.sections.push({ h: "Videos this week (" + vids.length + ")", lines: vids.map((v) => "• " + v.idea.title + " — " + v.who + " · " + v.idea.format + (v.idea.day ? " · post " + v.idea.day : "") + (secs(v.idea.desc) ? " · target " + secs(v.idea.desc) : "") + (v.idea.hook ? "\n   Opening title: " + v.idea.hook : "") + "\n   Notes: " + PW.stripForPDF(v.idea.desc)) });
      const ads = vids.filter((v) => v.who === "Ad video"); if (ads.length) doc.sections.push({ h: "Ad versions", lines: ["• For each ad video also deliver a 15s and a 30s cut, 9:16 and 4:5, with the offer and the call to action on screen in the last 3 seconds (program, dates, proworldacademy.com). No price on screen unless the brief gives one."] });
      const photos = photoItems(d); if (photos.length) doc.sections.push({ h: "Carousels and statics (design in the brand template)", lines: photos.map((p) => "• " + p.title + " — " + p.format + " · " + PW.stripForPDF(p.desc)) });
    } else if (kind === "post") {
      doc.title = "POSTING PLAN — " + (T.manager || "MANAGER").toUpperCase();
      const sun = new Date((d.weekStart || today()) + "T12:00:00"); const items = []; d.coaches.forEach((c) => c.ideas.forEach((i) => items.push({ day: i.day, label: c.name + " — " + i.title + " (" + i.format + ")" }))); (d.production || []).forEach((p) => items.push({ day: p.day, label: "Production — " + p.title + " (" + p.format + ")" }));
      const slots = {}; for (let i = 0; i < 7; i++) { const dd = new Date(sun); dd.setDate(sun.getDate() + i); const k = iso(dd); slots[DAYS[dd.getDay()]] = { k, items: [], tgt: rampTarget(k) }; }
      const overflow = [];
      items.sort((a, b) => (slots[a.day] ? 0 : 1) - (slots[b.day] ? 0 : 1));   // planned days first; the spare only takes a day nobody else has
      items.forEach((it) => { const s = slots[it.day] || null; if (s && s.items.length < Math.max(1, s.tgt.posts)) s.items.push(it.label); else { let placed = false; for (const dn of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) { if (slots[dn].items.length < Math.max(1, slots[dn].tgt.posts)) { slots[dn].items.push(it.label); placed = true; break; } } if (!placed) overflow.push(it.label); } });
      const t0 = rampTarget(iso(sun));
      doc.sections.push({ h: "Cadence this week: " + t0.posts + " post" + (t0.posts === 1 ? "" : "s") + " + " + t0.stories + " stories every day", lines: ["• Posts go out in the 7–9 AM or 6–8 PM window. Stories through the day: Academy Vibes clips, reshares of players and families, a poll or question most days.", "• Log every post in the Content Archive the same day and tick the cadence tracker.", "• Reply to every comment and DM within 2 hours during the day; note questions parents ask — they become content."] });
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((dn) => { const s = slots[dn]; doc.sections.push({ h: dn + " " + fmtD(s.k) + " — " + s.tgt.posts + " post" + (s.tgt.posts === 1 ? "" : "s") + " · " + s.tgt.stories + " stories", lines: (s.items.length ? s.items.map((x) => "• Post: " + x) : ["• Post: pick from the backlog / Academy Vibes reel"]).concat(["• Stories: Academy Vibes (2–3 clips)" + (s.tgt.stories > 2 ? " + " + (s.tgt.stories - 2) + " more (BTS, reshare, poll, countdown)" : ""), dn === "Mon" || dn === "Wed" || dn === "Fri" ? "• Tournament promo (Mon/Wed/Fri rule)" : "", dn === "Sat" ? "• Players in Action recap" : ""].filter(Boolean)) }); });
      if (overflow.length) doc.sections.push({ h: "Spare — use it the day a post falls through, else it rolls to next week", lines: overflow.map((x) => "• " + x) });
      doc.sections.push({ h: "Weekly review (Friday, 20 minutes)", lines: ["• Instagram Insights: reach, new followers, saves and comments per post this week — note the top and bottom post in the KPI Tracker.", "• Tell the engine what worked in the Content Database (Request ideas with a note) so next week leans into it."] });
    }
    return doc;
  }
  function briefText(doc) { return [doc.title, doc.sub, ""].concat(doc.sections.map((s) => s.h.toUpperCase() + "\n" + s.lines.join("\n") + "\n")).join("\n"); }
  function briefPDFDoc(doc) {
    if (!window.jspdf) { toast("PDF library didn't load — try again in a moment", true); return; }
    const { jsPDF } = window.jspdf; const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }); const W = 210, H = 297, LIME = [226, 254, 120]; let y = 0, page = 1;
    const header = () => { pdf.setFillColor(0, 0, 0); pdf.rect(0, 0, W, 24, "F"); pdf.setTextColor.apply(pdf, LIME); pdf.setFont("helvetica", "bolditalic"); pdf.setFontSize(20); pdf.text("PROWORLD", 12, 13); pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text(doc.title, 12, 19); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.text(doc.sub, W - 12, 13, { align: "right" }); y = 32; };
    const footer = () => { pdf.setFillColor(0, 0, 0); pdf.rect(0, H - 8, W, 8, "F"); pdf.setTextColor.apply(pdf, LIME); pdf.setFontSize(7); pdf.setFont("helvetica", "italic"); pdf.text("PROWORLD ACADEMY · DELRAY BEACH, FLORIDA · HIGH PERFORMANCE ACADEMY · PAGE " + page, W / 2, H - 3, { align: "center" }); };
    const need = (h) => { if (y + h > H - 14) { footer(); pdf.addPage(); page++; header(); } };
    header();
    doc.sections.forEach((s) => { need(12); pdf.setFillColor(242, 242, 242); pdf.rect(12, y - 4.5, W - 24, 7, "F"); pdf.setTextColor(0, 0, 0); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9.5); pdf.text(PW.stripForPDF(s.h).toUpperCase(), 14, y); y += 7;
      s.lines.forEach((ln) => { const parts = String(ln).split("\n"); parts.forEach((pt, i) => { const clean = PW.stripForPDF(pt); const bold = i === 0 && clean.startsWith("•"); pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(bold ? 8.8 : 8); pdf.setTextColor(bold ? 0 : 70, bold ? 0 : 70, bold ? 0 : 70); const wrapped = pdf.splitTextToSize(clean, W - 28 - (i ? 4 : 0)); wrapped.forEach((w) => { need(5); pdf.text(w, 14 + (i ? 4 : 0), y); y += 3.9; }); }); y += 1.6; }); y += 3; });
    footer();
    const fname = "ProWorld_" + doc.title.split(" ")[0].replace(/[^\w]/g, "") + "_" + String(doc.wk || "").replace(/[^\w]/g, "_") + ".pdf";
    PW.deliverFile(fname, pdf.output("blob"), () => pdf.save(fname));
  }
  window.briefPDF = function (kind) { if (!PW.cur()) { toast("Generate a week first", true); return; } briefPDFDoc(buildBrief(kind)); };
  window.briefCopy = function (kind) { if (!PW.cur()) { toast("Generate a week first", true); return; } const txt = briefText(buildBrief(kind)); const done = () => toast("Copied — paste it into Slack or an email"); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => fallback(txt, done)); else fallback(txt, done); };
  function fallback(txt, done) { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { toast("Couldn't copy", true); } ta.remove(); }

  // ───────────────────────── market intelligence ─────────────────────────
  // Watchlist: the accounts the engine reviews every week. Market read: what it learned (and what the team adds by hand).
  function renderWatchlist() {
    const el = $("watchlist"); if (!el) return;
    const list = S.watchlist || [];
    const group = (type, label, color) => { const items = list.map((a, i) => ({ a, i })).filter((x) => x.a.type === type); return '<div><div class="card-label ' + color + '" style="font-size:14px">' + label + ' · ' + items.length + '</div>' + (items.length ? items.map((x) => '<div class="recur" style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div style="min-width:0"><strong style="color:var(--text)">' + (x.a.handle ? '<a href="https://www.instagram.com/' + esc(x.a.handle) + '/" target="_blank" rel="noopener">@' + esc(x.a.handle) + '</a>' : esc(x.a.name)) + '</strong>' + (x.a.handle && x.a.name ? ' <span class="small muted">' + esc(x.a.name) + '</span>' : "") + (x.a.where ? ' <span class="small muted">· ' + esc(x.a.where) + '</span>' : "") + '<div class="small" style="color:var(--text-2)">' + esc(x.a.why || "") + '</div></div><span class="btn-row" style="gap:4px;flex-shrink:0"><button class="btn ghost xs" onclick="editWatch(' + x.i + ')">✎</button><button class="btn ghost xs muted" onclick="removeWatch(' + x.i + ')">×</button></span></div>').join("") : '<div class="small muted">None yet.</div>') + "</div>"; };
    el.innerHTML = '<div class="grid-2">' + group("competitor", "Competitors we watch", "orchid") + group("inspiration", "Inspiration — the standard", "cyan") + '</div><div class="btn-row" style="margin-top:12px"><button class="btn ghost xs" onclick="addWatch()">+ Add account</button><span class="small muted">Every Monday the engine opens each account on Instagram and logs what they posted and what got traction; the Sunday run reads that before it writes ideas.</span></div>';
  }
  const watchFields = (a) => [{ key: "handle", label: "Instagram handle (without @)", value: a.handle || "" }, { key: "name", label: "Name", value: a.name || "" }, { key: "type", label: "Type", type: "select", options: ["competitor", "inspiration"], value: a.type || "competitor" }, { key: "where", label: "Where", value: a.where || "" }, { key: "why", label: "What to learn from them", type: "textarea", rows: 2, value: a.why || "" }];
  window.addWatch = async function () { const r = await askForm("Watch an account", watchFields({}), "Add"); if (!r || (!r.handle && !r.name)) return; (S.watchlist = S.watchlist || []).push({ handle: r.handle.replace(/^@/, ""), name: r.name, type: r.type, where: r.where, why: r.why, addedAt: new Date().toISOString() }); save("watchlist"); renderWatchlist(); toast("Added to the watchlist"); };
  window.editWatch = async function (i) { const a = S.watchlist[i]; if (!a) return; const r = await askForm("Edit — " + (a.handle ? "@" + a.handle : a.name), watchFields(a), "Save"); if (!r) return; Object.assign(a, { handle: r.handle.replace(/^@/, ""), name: r.name, type: r.type, where: r.where, why: r.why }); save("watchlist"); renderWatchlist(); };
  window.removeWatch = async function (i) { const a = S.watchlist[i]; if (!a) return; if (!(await askConfirm("Stop watching", "Remove " + (a.handle ? "@" + a.handle : a.name) + " from the watchlist?", "Remove", true))) return; S.watchlist.splice(i, 1); save("watchlist"); renderWatchlist(); };
  function renderMarket() {
    const el = $("market"); if (!el) return;
    const log = S.market || [];
    el.innerHTML = (log.length ? log.slice(0, 4).map((m, i) => '<div class="recur" style="padding:8px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px"><strong style="color:var(--text)">' + esc(fmtD(m.date)) + (m.headline ? " — " + esc(m.headline) : "") + '</strong><span class="btn-row" style="gap:6px"><span class="small muted">' + esc(m.by || "") + '</span><button class="btn ghost xs muted" onclick="dropMarket(' + i + ')">×</button></span></div>' + (m.findings || []).map((f) => '<div class="small" style="color:var(--text-2);margin-top:4px">· ' + esc(f) + "</div>").join("") + "</div>").join("") + (log.length > 4 ? '<div class="small muted" style="margin-top:6px">' + (log.length - 4) + " older reads kept in memory</div>" : "") : '<div class="small muted">Nothing read yet. The Monday run writes what the watchlist posted and what performed; the Sunday run adds trending formats, the local calendar and parent questions. Add your own observations below — the engine reads them too.</div>') +
      '<div class="btn-row" style="margin-top:10px"><button class="btn ghost xs" onclick="addMarket()">+ Add an observation</button></div>';
  }
  window.addMarket = async function () { const r = await askForm("Market observation", [{ key: "headline", label: "Headline", value: "" }, { key: "findings", label: "What you saw (one per line)", type: "textarea", rows: 4, value: "" }], "Save", "Something you noticed on Instagram, a competitor move, a question parents keep asking — the Sunday run reads this before writing ideas."); if (!r || !(r.headline || r.findings)) return; (S.market = S.market || []).unshift({ date: today(), by: "team", headline: r.headline, findings: r.findings.split("\n").map((x) => x.trim()).filter(Boolean) }); save("market"); renderMarket(); };
  window.dropMarket = async function (i) { if (!(await askConfirm("Remove", "Remove this market read?", "Remove", true))) return; S.market.splice(i, 1); save("market"); renderMarket(); };

  // ───────────────────────── engine card (overview) ─────────────────────────
  function renderEngineCard() {
    const el = $("engine-summary"); if (!el) return;
    const log = S.engineLog || []; const last = log[0]; const openReq = (S.requests || []).filter((r) => r.status === "open").length;
    const share = archiveShare90(); let gaps = 0; S.pillars.forEach((p) => { gaps += pillarFlags(p, pillarStats(p), share).length; });
    const lastSync = S.archive.filter((a) => a.source === "instagram-sync").map((a) => a.date).sort().pop();
    const ready = S.pillars.reduce((n, p) => { const st = pillarStats(p); return n + st.avail + st.prodAvail; }, 0);
    el.innerHTML = '<div class="stat"><div class="stat-label">Ideas ready</div><div class="stat-num" style="font-size:30px">' + ready + '</div><div class="stat-sub">across ' + S.pillars.length + ' pillars</div></div>' +
      '<div class="stat orchid"><div class="stat-label">Gaps flagged</div><div class="stat-num" style="font-size:30px">' + gaps + '</div><div class="stat-sub">see Content Database · watching ' + (S.watchlist || []).length + ' accounts</div></div>' +
      '<div class="stat cyan"><div class="stat-label">Requests queued</div><div class="stat-num" style="font-size:30px">' + openReq + '</div><div class="stat-sub">for the Sunday run</div></div>' +
      '<div class="stat mint"><div class="stat-label">Last engine run</div><div class="stat-num" style="font-size:22px;text-transform:uppercase">' + (last ? fmtD(last.date) : "—") + '</div><div class="stat-sub">' + (last ? esc(last.note || "") : "Instagram last synced " + (lastSync ? fmtD(lastSync) : "—")) + "</div></div>";
  }

  // ───────────────────────── the strategy brief ─────────────────────────
  // What we push, the mix, what we avoid and the facts to use — edited here, read by the Sunday engine
  // (it writes to this brief) and the Monday review (it judges the week against it).
  const STRAT_FIELDS = [["focus", "What we push (one per line, in order)"], ["mix", "The mix — how the 14 posts split (one rule per line)"], ["avoid", "What we never do (one per line)"], ["facts", "Facts and lines to use, in the website's words (one per line)"]];
  function renderStrategy() {
    const el = $("strategy"); if (!el) return;
    const st = S.strategy || {};
    const block = (key, label, color) => { const lines = Array.isArray(st[key]) ? st[key] : []; return '<div><div class="card-label ' + color + '" style="font-size:14px">' + label + "</div>" + (lines.length ? lines.map((l, i) => '<div class="recur" style="display:flex;gap:8px"><span class="pri-n" style="font-size:14px;width:22px;line-height:1.4">' + (i + 1) + "</span><span>" + esc(l) + "</span></div>").join("") : '<div class="small muted">Nothing yet.</div>') + "</div>"; };
    el.innerHTML = '<div class="grid-2">' + block("focus", "What we push", "lime") + block("mix", "The mix", "cyan") + block("avoid", "Never", "orchid") + block("facts", "Facts and lines to use", "mint") + '</div><div class="btn-row" style="margin-top:12px"><button class="btn ghost sm" onclick="editStrategy()">✎ Edit the brief</button><span class="small muted">' + (st.updatedAt ? "Updated " + esc(fmtD(String(st.updatedAt).slice(0, 10))) + (st.by ? " by " + esc(st.by) : "") + " · " : "") + "The Sunday engine writes to this brief; the Monday review judges the week against it.</span></div>";
  }
  window.editStrategy = async function () {
    const st = S.strategy || {};
    const r = await askForm("The strategy brief", STRAT_FIELDS.map(([k, label]) => ({ key: k, label, type: "textarea", rows: k === "focus" ? 8 : 5, value: (Array.isArray(st[k]) ? st[k] : []).join("\n") })), "Save brief", "This is the engine's marching order. Keep it in plain words; the runs read it every week.");
    if (!r) return;
    const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
    S.strategy = Object.assign({}, st, { focus: lines(r.focus), mix: lines(r.mix), avoid: lines(r.avoid), facts: lines(r.facts), updatedAt: new Date().toISOString(), by: "team" });
    save("strategy"); renderStrategy(); toast("Brief saved — the next runs follow it");
  };

  // ───────────────────────── reports ─────────────────────────
  // The Monday review and the Sunday engine post their reports here, newest first — nothing to forward by hand.
  function renderReports() {
    const el = $("reports-list"); if (!el) return;
    const list = Object.keys(S.reports || {}).map((k) => S.reports[k]).filter((r) => r && (r.date || r.title)).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.at || "").localeCompare(String(a.at || "")));
    if (!list.length) { el.innerHTML = '<div class="empty">No reports yet. The Monday review posts the weekly report here (scoreboard, what we posted, what was missing, competitors, parents\' questions, the week\'s moves); the Sunday engine posts what it researched and built.</div>'; return; }
    el.innerHTML = list.slice(0, 20).map((r, i) => {
      const id = r.id || (r.date + "_" + r.by);
      const secs = Array.isArray(r.sections) ? r.sections : [];
      const body = secs.length ? secs.map((s) => '<div class="fhead" style="margin-top:12px"><b>' + esc(s.h || "") + "</b></div>" + (Array.isArray(s.lines) ? s.lines : String(s.text || "").split("\n")).map((l) => renderLine(l)).join("")).join("") : String(r.text || "").split("\n").map((l) => renderLine(l)).join("");
      return '<div class="card" style="border-top:3px solid var(--' + (r.by === "instagram-review" ? "orchid" : r.by === "engine" ? "cyan" : "lime") + ')"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><div class="card-label" style="margin-bottom:2px">' + esc(r.title || (r.by === "instagram-review" ? "Weekly review" : r.by === "engine" ? "Engine run" : "Report")) + '</div><div class="small muted">' + esc(fmtD(String(r.date || "").slice(0, 10))) + " · " + esc(r.by || "") + "</div></div>" + (i === 0 ? '<span class="tag mint" style="margin:0">Latest</span>' : "") + '</div><div style="margin-top:8px">' + body + "</div></div>";
    }).join("");
  }
  function renderLine(l) {
    l = String(l || ""); if (!l.trim()) return "";
    if (/^\|/.test(l)) { const cells = l.split("|").slice(1, -1).map((c) => c.trim()); if (cells.every((c) => /^:?-+:?$/.test(c))) return ""; return '<div class="small" style="display:grid;grid-template-columns:repeat(' + cells.length + ',minmax(0,1fr));gap:8px;padding:4px 0;border-bottom:1px solid var(--line)">' + cells.map((c) => "<span>" + esc(c) + "</span>").join("") + "</div>"; }
    if (/^#{1,4}\s/.test(l)) return '<div class="fhead" style="margin-top:12px"><b>' + esc(l.replace(/^#+\s*/, "")) + "</b></div>";
    if (/^\d+\.\s+[A-Z][A-Z' ]{3,}/.test(l)) return '<div class="fhead" style="margin-top:12px"><b>' + esc(l) + "</b></div>";
    if (/^\s*[-•*]\s+/.test(l)) return '<div class="recur" style="padding-left:14px">· ' + esc(l.replace(/^\s*[-•*]\s+/, "")) + "</div>";
    return '<div class="recur">' + esc(l) + "</div>";
  }
  window.dropReport = async function (id) { if (!(await askConfirm("Remove report", "Remove this report from the page?", "Remove", true))) return; delete S.reports[id]; save("reports"); renderReports(); };
  PW.hooks.push(renderStrategy); PW.hooks.push(renderReports);
  renderStrategy(); renderReports();

  PW.buildBrief = buildBrief; PW.briefText = briefText; PW.rampTarget = rampTarget;
  function renderEngine() { renderDatabase(); renderWatchlist(); renderMarket(); renderRamp(); renderWorkflow(); renderEngineCard(); }
  PW.hooks.push(renderEngine);
  renderEngine();
})();
