# PROWORLD site — Dashboard + Marketing Command Center

The team's internal site, served by GitHub Pages from this repository.

- `/` — **PROWORLD Dashboard** (the motherboard): every page the team uses, with per-person access.
- `/marketing/` — **Marketing Command Center**: weekly coach briefs, production list, content banks, archive, cadence, KPIs, the content engine's memory.

## How it works

Everything on the site opens with **one team passcode**. The site's memory is the set of JSON documents under `data/`, each encrypted with that passcode (AES-256-GCM, key derived with PBKDF2-SHA256), so the repository can be public without exposing briefs, numbers or the watchlist. The browser decrypts after the passcode is entered (`shared/store.js`); the brand fonts live in `assets/fonts.css.enc` the same way.

- **Viewing** needs only the passcode. Pages reads the files straight from GitHub Pages; a save shows up there a minute or a few after the commit.
- **Saving** needs a GitHub sign-in: an editor pastes a fine-grained personal access token once per device (header button *Sign in to edit*). Every change becomes a commit through the GitHub Contents API, pinned to the file's sha. Editors read through the API, so they always see the latest commit.
- **The engine** (the Sunday and Monday Claude runs) clones the repository, decrypts with `tools/pwdata.py`, edits the plaintext documents, re-encrypts and pushes.

### Layout

```
index.html              Dashboard
marketing/index.html    Command Center (+ app.js, engine.js, data.js seeds, pillars.js seeds)
shared/store.js         passcode gate, crypto, GitHub read/write, GitHub sign-in
assets/fonts.css.enc    brand fonts + wordmark, encrypted
data/index.json         plaintext: kdf parameters, passcode check, list of documents {rev, at}
data/<col>/<id>.json    encrypted documents — collections: state, ideaBank, weeks, archive, reports, dash
tools/pwdata.py         decrypt / encrypt / check / init / rekey from a checkout
```

Document bodies are `{v: <value>, at: <ISO time>}` (ideaBank documents also carry `coach`). The shapes are the ones the Command Center page defines: `state/<key>` for every small key (cadence, usedIdeas, usedProd, prodBank, kpi, priorities, ads, pillars, cadencePlan, daily, requests, team, engineLog, watchlist, market, reminders, recipe, strategy), `ideaBank/<coach slug>`, `weeks/<sunday YYYY-MM-DD>`, `archive/<year>`, `reports/<date>_<by>`, `dash/users` and `dash/access`.

### Giving someone access

1. Send them the site link and the team passcode (it is in the private Drive file *PROWORLD site passcode*, owner operations@).
2. If they must **save** (Manu, Antonio): add their GitHub account as a collaborator with *Write* on this repository, then they create a fine-grained token (Resource owner: proworldacademy · only this repository · Contents: Read and write) and paste it into *Sign in to edit*.
3. Coaches and anyone who only reads need nothing beyond the passcode.

### Changing the passcode

Dashboard → *This site* → *Change the team passcode* (signed-in editors only). It re-encrypts every document and the fonts; update the Drive file and tell the team. From a checkout: `python3 tools/pwdata.py rekey --repo . --passcode-file old.txt --new-passcode-file new.txt`.

### Engine runs

```
git clone https://github.com/proworldacademy/proworld-marketing-dashboard repo
python3 repo/tools/pwdata.py decrypt --repo repo --out work --passcode-file pass.txt
# edit work/<col>/<id>.json
python3 repo/tools/pwdata.py encrypt --repo repo --src work --passcode-file pass.txt
git -C repo add -A data && git -C repo commit -m "engine: …" && git -C repo push
```

`encrypt` rewrites only the documents whose plaintext changed and updates `data/index.json`. Never commit the passcode.

### History

Built in April–May 2026 as a browser-only dashboard (localStorage), rebuilt in October 2026 as a Claude artifact with shared storage, and moved back here on October 13, 2026 so that everything lives on one site behind one passcode.
