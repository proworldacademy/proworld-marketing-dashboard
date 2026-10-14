/* PROWORLD — shared memory on GitHub (store.js)
   The site is a static GitHub Pages site. Its memory is the set of JSON documents under /data in the
   same repository, every one of them encrypted with the team passcode (AES-256-GCM, key derived with
   PBKDF2-SHA256). The page asks for the passcode once per device, decrypts in the browser, and shows the
   record. Anyone with the passcode can read. Saving needs a GitHub sign-in: an editor pastes a
   fine-grained token once, and every change becomes a commit through the GitHub Contents API, pinned to
   the file's sha so two editors never overwrite each other blindly. Viewers without a token read the
   files straight from GitHub Pages (a save appears there one to a few minutes after the commit);
   editors read through the API, which is immediate.

   Layout in the repository:
     data/index.json                 plaintext — {kdf, check, docs:{"<col>/<id>": {rev, at}}, updatedAt}
     data/<col>/<id>.json            encrypted — {alg, iter, salt, iv, ct}; the plaintext is the document body {v, at, ...}
     assets/fonts.css.enc            encrypted — the brand fonts and wordmark, injected after unlock

   The app talks to this through PWGit.db(), an object shaped like the artifact database the page was
   written for: collection(c).get() / onSnapshot(cb), doc(path).set(body) / delete() / acquire(). */
(function () {
  "use strict";
  const CFG = {
    owner: "proworldacademy", repo: "proworld-marketing-dashboard", branch: "main",
    dataDir: "data", fontsPath: "assets/fonts.css.enc", pollMs: 60000
  };
  // The site may be served from a project path (/<repo>/) or from a custom domain; compute the site root from this script's own URL.
  const SCRIPT_URL = (document.currentScript && document.currentScript.src) || location.href;
  const ROOT = SCRIPT_URL.replace(/shared\/store\.js(\?.*)?$/, "");
  const API = "https://api.github.com/repos/" + CFG.owner + "/" + CFG.repo;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const b64utf8 = (s) => btoa(unescape(encodeURIComponent(s)));
  const unb64utf8 = (s) => decodeURIComponent(escape(atob(s.replace(/\n/g, ""))));
  const LS = { pass: "pw_passcode", token: "pw_gh_token", who: "pw_gh_login" };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };

  // ── crypto ──
  let key = null, kdf = null, passcode = null;
  async function deriveKey(pass, saltB64, iter) {
    const base = await crypto.subtle.importKey("raw", enc.encode(pass.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: unb64(saltB64), iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function decryptDoc(obj) {
    if (!key) throw Object.assign(new Error("locked"), { code: "locked" });
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(obj.iv) }, key, unb64(obj.ct));
    return dec.decode(pt);
  }
  async function encryptDoc(text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
    return { alg: "A256GCM", kdf: "PBKDF2-SHA256", iter: kdf.iter, salt: kdf.salt, iv: b64(iv), ct: b64(ct) };
  }
  async function sha256hex(text) { const h = await crypto.subtle.digest("SHA-256", enc.encode(text)); return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join(""); }

  // ── transport ──
  let token = lsGet(LS.token) || null, login = lsGet(LS.who) || null;
  const shas = {};                                  // repo path → blob sha (API reads and writes keep it current)
  const seenSha = {};                               // "col/id" → sha as last listed (poll compares against it)
  function gh(path, opts) {
    const o = Object.assign({ headers: {} }, opts || {});
    o.headers = Object.assign({ Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, o.headers);
    if (token) o.headers.Authorization = "Bearer " + token;
    return fetch(API + path, o);
  }
  async function pagesText(path) {
    const r = await fetch(ROOT + path + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw Object.assign(new Error(path + " " + r.status), { status: r.status });
    return r.text();
  }
  // read one repository file as text (API when signed in — fresh — else from GitHub Pages)
  async function readFile(path) {
    if (token) {
      const r = await gh("/contents/" + path + "?ref=" + CFG.branch, { cache: "no-store" });
      if (r.status === 404) return null;
      if (r.status === 401) { throw Object.assign(new Error("token rejected"), { code: "not_writer" }); }
      if (!r.ok) throw new Error("GitHub " + r.status + " reading " + path);
      const j = await r.json(); shas[path] = j.sha;
      if (j.content != null && j.encoding === "base64") return unb64utf8(j.content);
      const raw = await gh("/contents/" + path + "?ref=" + CFG.branch, { headers: { Accept: "application/vnd.github.raw+json" } });
      return raw.text();
    }
    try { return await pagesText(path); } catch (e) { if (e.status === 404) return null; throw e; }
  }
  async function listDir(dir) {                     // API only: [{name, sha}]
    const r = await gh("/contents/" + dir + "?ref=" + CFG.branch, { cache: "no-store" });
    if (r.status === 404) return [];
    if (!r.ok) throw new Error("GitHub " + r.status + " listing " + dir);
    const j = await r.json(); return (Array.isArray(j) ? j : []).filter((f) => f.type === "file" && /\.json$/.test(f.name)).map((f) => { shas[dir + "/" + f.name] = f.sha; const id = f.name.replace(/\.json$/, ""); seenSha[dir.replace(CFG.dataDir + "/", "") + "/" + id] = f.sha; return { name: id, sha: f.sha }; });
  }
  async function writeFile(path, text, message) {
    if (!token) throw Object.assign(new Error("sign in to save"), { code: "not_writer" });
    const body = { message, content: b64utf8(text), branch: CFG.branch, committer: { name: login || "PROWORLD site", email: (login || "site") + "@users.noreply.github.com" } };
    if (shas[path]) body.sha = shas[path];
    let r = await gh("/contents/" + path, { method: "PUT", body: JSON.stringify(body) });
    if (r.status === 409 || r.status === 422) {   // sha out of date — someone saved first: re-read the sha and let the caller decide
      const cur = await gh("/contents/" + path + "?ref=" + CFG.branch, { cache: "no-store" });
      if (cur.ok) { const j = await cur.json(); shas[path] = j.sha; }
      else if (cur.status === 404) delete shas[path];
      throw Object.assign(new Error("conflict on " + path), { code: "conflict" });
    }
    if (r.status === 401 || r.status === 403 || r.status === 404) throw Object.assign(new Error("GitHub " + r.status + " writing " + path), { code: r.status === 401 ? "not_writer" : "not_granted" });
    if (!r.ok) throw new Error("GitHub " + r.status + " writing " + path);
    const j = await r.json(); shas[path] = j.content.sha; return j;
  }
  async function deleteFile(path, message) {
    if (!token) throw Object.assign(new Error("sign in to save"), { code: "not_writer" });
    if (!shas[path]) { const cur = await gh("/contents/" + path + "?ref=" + CFG.branch, { cache: "no-store" }); if (cur.status === 404) return; if (cur.ok) { const j = await cur.json(); shas[path] = j.sha; } }
    const r = await gh("/contents/" + path, { method: "DELETE", body: JSON.stringify({ message, sha: shas[path], branch: CFG.branch }) });
    if (r.status === 404) { delete shas[path]; return; }
    if (!r.ok) throw Object.assign(new Error("GitHub " + r.status + " deleting " + path), { code: r.status === 401 ? "not_writer" : "error" });
    delete shas[path];
  }

  // ── index ──
  let index = null;                                 // {kdf:{salt,iter}, check:{iv,ct}, docs:{"col/id":{rev,at}}, updatedAt}
  async function loadIndex() {
    const t = await readFile(CFG.dataDir + "/index.json");
    if (!t) throw Object.assign(new Error("data/index.json is missing — the site has no memory yet"), { code: "no_index" });
    index = JSON.parse(t); kdf = index.kdf; return index;
  }
  async function unlock(pass, remember) {
    if (!index) await loadIndex();
    const k = await deriveKey(pass, kdf.salt, kdf.iter);
    try { const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(index.check.iv) }, k, unb64(index.check.ct)); if (dec.decode(pt) !== "PROWORLD") throw 0; }
    catch (e) { throw Object.assign(new Error("wrong passcode"), { code: "bad_passcode" }); }
    key = k; passcode = pass; if (remember) lsSet(LS.pass, pass);
    injectFonts();
    return true;
  }
  async function injectFonts() {
    if (document.getElementById("pw-fonts")) return;
    try { const t = await readFile(CFG.fontsPath); if (!t) return; const css = await decryptDoc(JSON.parse(t)); const st = document.createElement("style"); st.id = "pw-fonts"; st.textContent = css; document.head.appendChild(st); } catch (e) { console.warn("fonts", e); }
  }

  // ── the database adapter ──
  const docPath = (col, id) => CFG.dataDir + "/" + col + "/" + id + ".json";
  const cache = {};                                 // "col/id" → {rev, body}
  async function fetchDoc(col, id) {
    const t = await readFile(docPath(col, id)); if (!t) return null;
    const body = JSON.parse(await decryptDoc(JSON.parse(t)));
    cache[col + "/" + id] = { rev: await sha256hex(t), body }; return body;
  }
  async function collectionGet(col) {
    let ids;
    if (token) ids = (await listDir(CFG.dataDir + "/" + col)).map((f) => f.name);
    else { if (!index) await loadIndex(); ids = Object.keys(index.docs || {}).filter((k) => k.indexOf(col + "/") === 0).map((k) => k.slice(col.length + 1)); }
    const docs = [];
    for (const id of ids) { const body = await fetchDoc(col, id); if (body) docs.push({ id, exists: true, data: () => body }); }
    return { docs };
  }
  const listeners = [];                             // {col, cb}
  let pollTimer = null, polling = false;
  async function poll() {
    if (polling || !key) return; polling = true;
    try {
      let changed = [];                             // {col,id,type}
      if (token) {
        const cols = Array.from(new Set(listeners.map((l) => l.col)));
        for (const col of cols) {
          const before = {}; Object.keys(seenSha).forEach((k) => { if (k.indexOf(col + "/") === 0) before[k] = seenSha[k]; });
          const files = await listDir(CFG.dataDir + "/" + col); const now = new Set();
          files.forEach((f) => { const k = col + "/" + f.name; now.add(k); if (before[k] === undefined) { if (!cache[k]) changed.push({ col, id: f.name, type: "added" }); } else if (before[k] !== f.sha) changed.push({ col, id: f.name, type: "modified" }); });
          Object.keys(before).forEach((k) => { if (!now.has(k)) { changed.push({ col, id: k.slice(col.length + 1), type: "removed" }); delete cache[k]; delete seenSha[k]; } });
        }
      } else {
        const old = index; await loadIndex();
        const now = index.docs || {}, before = (old && old.docs) || {};
        Object.keys(now).forEach((k) => { if (!before[k] || before[k].rev !== now[k].rev) { const [col, id] = k.split("/"); changed.push({ col, id, type: before[k] ? "modified" : "added" }); } });
        Object.keys(before).forEach((k) => { if (!now[k]) { const [col, id] = k.split("/"); changed.push({ col, id, type: "removed" }); delete cache[k]; } });
      }
      if (!changed.length) return;
      const byCol = {};
      for (const ch of changed) {
        let body = null; if (ch.type !== "removed") { body = await fetchDoc(ch.col, ch.id); if (!body) continue; }
        (byCol[ch.col] = byCol[ch.col] || []).push({ type: ch.type, doc: { id: ch.id, exists: ch.type !== "removed", data: () => body } });
      }
      listeners.forEach((l) => { if (byCol[l.col]) { try { l.cb({ docChanges: () => byCol[l.col] }); } catch (e) { console.error(e); } } });
    } catch (e) { console.warn("poll", e); }
    finally { polling = false; }
  }
  function startPolling() { if (pollTimer) return; pollTimer = setInterval(poll, CFG.pollMs); document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); }); }

  // writes: queue them so index.json is updated once per burst
  let indexDirty = false, indexTimer = null;
  async function bumpIndex(changes) {              // changes: [{key:"col/id", rev|null, at}]
    if (!token) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const t = await readFile(CFG.dataDir + "/index.json"); index = JSON.parse(t); kdf = index.kdf; index.docs = index.docs || {};
        changes.forEach((c) => { if (c.rev == null) delete index.docs[c.key]; else index.docs[c.key] = { rev: c.rev, at: c.at }; });
        index.updatedAt = new Date().toISOString();
        await writeFile(CFG.dataDir + "/index.json", JSON.stringify(index, null, 1), "index: " + changes.map((c) => c.key).join(", ").slice(0, 60));
        return;
      } catch (e) { if (e.code !== "conflict") throw e; }
    }
  }
  const pendingIndex = [];
  function queueIndex(ch) { pendingIndex.push(ch); clearTimeout(indexTimer); indexTimer = setTimeout(async () => { const batch = pendingIndex.splice(0); try { await bumpIndex(batch); } catch (e) { console.error("index", e); pendingIndex.push.apply(pendingIndex, batch); } }, 1200); }
  async function docSet(path, body) {
    const [col, id] = path.split("/");
    if (!key) throw Object.assign(new Error("locked"), { code: "locked" });
    const text = JSON.stringify(await encryptDoc(JSON.stringify(body)));
    const who = login ? " (" + login + ")" : "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try { await writeFile(docPath(col, id), text, path + who); break; }
      catch (e) { if (e.code === "conflict" && attempt === 0) continue; throw e; }   // sha refreshed by writeFile; the app's dirty-tracking already merged the newest value it knows
    }
    const rev = await sha256hex(text); cache[path] = { rev, body }; seenSha[path] = shas[docPath(col, id)];
    queueIndex({ key: path, rev, at: body.at || new Date().toISOString() });
  }
  async function docDelete(path) {
    const [col, id] = path.split("/");
    await deleteFile(docPath(col, id), "remove " + path + (login ? " (" + login + ")" : ""));
    delete cache[path]; delete seenSha[path]; queueIndex({ key: path, rev: null });
  }
  function db() {
    return {
      collection: (col) => ({ get: () => collectionGet(col), onSnapshot: (cb) => { listeners.push({ col, cb }); startPolling(); return () => { const i = listeners.findIndex((l) => l.cb === cb); if (i >= 0) listeners.splice(i, 1); }; } }),
      doc: (path) => ({ set: (body) => docSet(path, body), delete: () => docDelete(path), acquire: async () => ({ acquired: !!token }), get: async () => { const [c, i] = path.split("/"); const b = await fetchDoc(c, i); return { exists: !!b, id: i, data: () => b }; } })
    };
  }

  // ── sign-in ──
  async function verifyToken(t) {
    const r = await fetch(API, { headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + t, "X-GitHub-Api-Version": "2022-11-28" } });
    if (!r.ok) return null;
    const j = await r.json(); const perm = j.permissions || {};
    let who = null; try { const u = await fetch("https://api.github.com/user", { headers: { Authorization: "Bearer " + t } }); if (u.ok) who = (await u.json()).login; } catch (e) {}
    return { canWrite: !!(perm.push || perm.admin || perm.maintain), login: who };
  }
  async function signIn(t) {
    const v = await verifyToken(t.trim()); if (!v) throw new Error("GitHub did not accept that token");
    if (!v.canWrite) throw new Error("That token can read the repository but not write to it — it needs Contents: Read and write");
    token = t.trim(); login = v.login; lsSet(LS.token, token); lsSet(LS.who, login); updateAuthBtn(); return v;
  }
  function signOut() { token = null; login = null; lsSet(LS.token, null); lsSet(LS.who, null); updateAuthBtn(); }
  function updateAuthBtn() { const b = document.getElementById("pw-auth-btn"); if (!b) return; b.textContent = token ? ("Editing as " + (login || "signed in") + " · sign out") : "Sign in to edit"; b.onclick = token ? () => { if (confirm("Sign out of GitHub on this device? You can keep viewing; saving stops.")) { signOut(); location.reload(); } } : authDialog; }

  // ── UI: gate + dialogs (self-contained styles so both pages can use them) ──
  const CSS = `
  .pwg-bg{position:fixed;inset:0;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;font-family:"Aeonik Pro","Helvetica Neue",Arial,sans-serif}
  .pwg{width:100%;max-width:420px;background:#0e0e0e;border:1px solid #272727;border-top:4px solid #E2FE78;border-radius:8px;padding:28px}
  .pwg h1{font-family:"Review Condensed","Barlow Condensed","Arial Narrow",Impact,sans-serif;font-style:italic;font-weight:800;text-transform:uppercase;font-size:34px;line-height:.95;margin:0 0 6px}
  .pwg h1 em{font-style:inherit;color:#E2FE78}
  .pwg p{color:#8f9288;font-size:13px;margin:0 0 16px;line-height:1.5}
  .pwg label{display:block;font-size:10px;color:#8f9288;text-transform:uppercase;letter-spacing:1.5px;margin:12px 0 6px;font-weight:700}
  .pwg input{width:100%;background:#161616;border:1px solid #333;color:#fff;padding:11px 12px;border-radius:5px;font:inherit;font-size:15px;box-sizing:border-box}
  .pwg input:focus{outline:none;border-color:#E2FE78}
  .pwg .row{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:16px;flex-wrap:wrap}
  .pwg .chk{display:flex;align-items:center;gap:8px;font-size:12px;color:#c9cbc2}
  .pwg button{background:#E2FE78;color:#000;border:1px solid #E2FE78;padding:11px 20px;font-family:"Review Condensed","Barlow Condensed","Arial Narrow",Impact,sans-serif;font-style:italic;font-weight:800;font-size:16px;letter-spacing:1px;text-transform:uppercase;border-radius:5px;cursor:pointer}
  .pwg button.ghost{background:transparent;color:#c9cbc2;border-color:#333}
  .pwg .err{color:#E286E4;font-size:12px;margin-top:10px;min-height:16px}
  .pwg .brand{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8f9288;font-weight:700;margin-bottom:18px}
  .pwg ol{color:#c9cbc2;font-size:12.5px;padding-left:18px;line-height:1.55;margin:0 0 6px}
  .pwg a{color:#E2FE78}`;
  function ensureCss() { if (document.getElementById("pwg-css")) return; const s = document.createElement("style"); s.id = "pwg-css"; s.textContent = CSS; document.head.appendChild(s); }
  function gate() {
    return new Promise((resolve) => {
      ensureCss();
      const el = document.createElement("div"); el.className = "pwg-bg"; el.id = "pwg-gate";
      el.innerHTML = '<div class="pwg" role="dialog" aria-modal="true"><div class="brand">PROWORLD · Delray Beach</div><h1>Team <em>access</em></h1><p>This page is for the PROWORLD team. Enter the team passcode to open it.</p><label for="pwg-pass">Passcode</label><input id="pwg-pass" type="password" autocomplete="current-password" autofocus><div class="row"><label class="chk" style="margin:0;text-transform:none;letter-spacing:0;font-size:12px"><input type="checkbox" id="pwg-remember" checked style="width:auto"> Remember on this device</label><button id="pwg-go">Open</button></div><div class="err" id="pwg-err"></div></div>';
      document.body.appendChild(el);
      const go = async () => {
        const pass = el.querySelector("#pwg-pass").value; if (!pass) return;
        el.querySelector("#pwg-err").textContent = "Checking…";
        try { await unlock(pass, el.querySelector("#pwg-remember").checked); el.remove(); resolve(true); }
        catch (e) { el.querySelector("#pwg-err").textContent = e.code === "bad_passcode" ? "That passcode is not right." : e.code === "no_index" ? "The site has no memory yet — ask Antonio." : "Couldn't open: " + (e.message || e); }
      };
      el.querySelector("#pwg-go").onclick = go;
      el.querySelector("#pwg-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    });
  }
  function authDialog() {
    ensureCss();
    const el = document.createElement("div"); el.className = "pwg-bg"; el.style.background = "rgba(0,0,0,.6)";
    el.innerHTML = '<div class="pwg" role="dialog" aria-modal="true"><div class="brand">PROWORLD · GitHub</div><h1>Sign in <em>to edit</em></h1><p>Saving writes to the team\'s GitHub repository, so it needs a GitHub token from an account that can write to <strong style="color:#fff">' + CFG.owner + "/" + CFG.repo + '</strong>. You do this once per device.</p><ol><li>GitHub → your photo → <em>Settings</em> → <em>Developer settings</em> → <em>Personal access tokens</em> → <em>Fine-grained tokens</em> → <em>Generate new token</em>.</li><li>Resource owner: <strong>' + CFG.owner + '</strong>. Repository access: <em>Only select repositories</em> → <strong>' + CFG.repo + '</strong>.</li><li>Permissions → Repository → <strong>Contents: Read and write</strong>. Expiration: up to one year. Generate, copy.</li></ol><label for="pwg-token">Token</label><input id="pwg-token" type="password" autocomplete="off" placeholder="github_pat_…"><div class="row"><button class="ghost" id="pwg-cancel">Cancel</button><button id="pwg-save">Sign in</button></div><div class="err" id="pwg-err2"></div></div>';
    document.body.appendChild(el);
    el.querySelector("#pwg-cancel").onclick = () => el.remove();
    el.querySelector("#pwg-save").onclick = async () => {
      const t = el.querySelector("#pwg-token").value.trim(); if (!t) return;
      el.querySelector("#pwg-err2").textContent = "Checking with GitHub…";
      try { const v = await signIn(t); el.remove(); if (window.toast) window.toast("Signed in as " + (v.login || "editor") + " — reloading"); setTimeout(() => location.reload(), 600); }
      catch (e) { el.querySelector("#pwg-err2").textContent = e.message || String(e); }
    };
  }

  // ── boot helper: unlock (remembered passcode or the gate), then hand the adapter to the app ──
  async function open() {
    try { await loadIndex(); } catch (e) { if (e.code !== "no_index") console.warn(e); }
    const remembered = lsGet(LS.pass);
    if (remembered) { try { await unlock(remembered, true); } catch (e) { lsSet(LS.pass, null); } }
    if (!key) await gate();
    updateAuthBtn();
    return { db: db(), canWrite: !!token, login };
  }
  function lock() { lsSet(LS.pass, null); key = null; passcode = null; location.reload(); }

  // change the passcode for everyone: re-encrypt every document and the fonts, then the index (editor only)
  async function rekey(newPass) {
    if (!token) throw new Error("sign in first");
    if (!index) await loadIndex();
    const salt = b64(crypto.getRandomValues(new Uint8Array(16))), iter = kdf.iter || 250000;
    const nk = await deriveKey(newPass, salt, iter);
    const encWith = async (k, text, saltB64) => { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(text)); return { alg: "A256GCM", kdf: "PBKDF2-SHA256", iter, salt: saltB64, iv: b64(iv), ct: b64(ct) }; };
    const docs = {};
    for (const k of Object.keys(index.docs || {})) { const [col, id] = k.split("/"); const t = await readFile(docPath(col, id)); if (!t) continue; const plain = await decryptDoc(JSON.parse(t)); const out = JSON.stringify(await encWith(nk, plain, salt)); await writeFile(docPath(col, id), out, "rekey " + k); docs[k] = { rev: await sha256hex(out), at: (index.docs[k] || {}).at || new Date().toISOString() }; }
    const ft = await readFile(CFG.fontsPath); if (ft) { const plain = await decryptDoc(JSON.parse(ft)); await writeFile(CFG.fontsPath, JSON.stringify(await encWith(nk, plain, salt)), "rekey fonts"); }
    const check = await encWith(nk, "PROWORLD", salt);
    index = { kdf: { salt, iter }, check: { iv: check.iv, ct: check.ct }, docs, updatedAt: new Date().toISOString() };
    await writeFile(CFG.dataDir + "/index.json", JSON.stringify(index, null, 1), "rekey index");
    key = nk; kdf = index.kdf; passcode = newPass; if (lsGet(LS.pass)) lsSet(LS.pass, newPass);
    return Object.keys(docs).length;
  }

  window.PWGit = { CFG, ROOT, open, gate, unlock, lock, db, authDialog, signIn, signOut, rekey, isSignedIn: () => !!token, login: () => login, readFile, writeFile, poll };
})();
