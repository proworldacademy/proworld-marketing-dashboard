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
  The runs sign in as the dedicated runs account (Drive doc *PROWORLD runs login*). `push` never deletes and never
  overwrites a newer edit.
- `tools/pwroster.py` + `tools/monday_sync.py` — the morning **Monday → Coach Portal roster sync** (Oct 2026). Monday is
  the single source of truth for who is enrolled, their status (Away / Finished = not active), coaches and schedule.
  `pwroster.py pull → prepare → plan → apply` reads the portal, hands the portal's queued changes to monday
  (`monday_sync.py` runs inside monday's own code sandbox: a coach-added player goes to the LEADS board's New Requests
  with "A coach added this player. Where should they go?", and a status change goes to General Attendance), then
  writes Monday's roster back: Monday's fields on each player, the parent details (in a private document opened behind
  a button), the Coach Board and the change log. It starts in preview (only the board and the log are written) until
  an owner turns it on from the Coach Board. Standard library only; it never deletes anything.
  The database rules let the runs account read and write the Marketing record and, for the sync, read the players and
  write only Monday's fields, the parent details, the board and the log — nothing else.
- `tools/pwdata.py`, `shared/`, `assets/` — the old passcode site's code, kept for the record.
