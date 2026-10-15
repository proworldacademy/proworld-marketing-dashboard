# PROWORLD — moved

The Dashboard and the Marketing Command Center moved on Oct 15, 2026 to **https://proworld-coach-portal.web.app**
(repository `proworldacademy/coach-portal`, Firebase project `proworld-coach-portal`): one site, one Google sign-in per
person, and the owner ticks which pages each person gets on the Dashboard. The Marketing record now lives in the
team database (Firestore, `apps/marketing/<collection>/<id>`), not in this repository.

What stays here:

- `index.html`, `marketing/index.html` — forward old links and bookmarks to the new site.
- `data/` — the encrypted record from before the move (passcode-protected). The new Marketing page copied it into the
  database once ("Import" on the Marketing page, owner only). Kept for the record; nothing writes here any more.
- `tools/pwfs.py` — what the scheduled runs (Sunday engine, Monday review, morning numbers) use to read and write the
  Marketing record in the database: `check`, `pull --out work`, `push --src work --by "…"`. Standard library only.
  The runs sign in as the dedicated runs account (Drive doc *PROWORLD runs login*); the database rules let that
  account touch the Marketing record and nothing else. `push` never deletes and never overwrites a newer edit.
- `tools/pwdata.py`, `shared/`, `assets/` — the old passcode site's code, kept for the record.
