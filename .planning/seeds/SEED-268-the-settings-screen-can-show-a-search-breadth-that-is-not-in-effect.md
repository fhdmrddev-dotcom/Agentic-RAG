---
seed_id: SEED-268
title: The Settings screen can show a search breadth that is not in effect — the no-op shortcut compares against a hardcoded 40 the server may not have
created: 2026-09-10
planted_during: Phase 241 (QUEUE-06) — raised by 241-REVIEW.md WR-06, left OPEN at the phase close
status: planted
priority: medium
surface: Agentic-RAG
severity: minor    # Nothing is unsafe. A number is displayed that may not be the one in force.
folded_into: null
relates_to:
  - `backend/app/services/retrieval_tuning.py` — `_SERVER_DEFAULT_EF_SEARCH = 40` and the
    `if resolved_ef != _SERVER_DEFAULT_EF_SEARCH:` no-op shortcut.
  - `frontend/src/pages/SettingsPage.tsx` — the Retrieval card's search-breadth control.
  - `backend/app/config.py` — where the shipped default lives.
trigger_when: >
  ANY of these becomes true:
  (1) the app runs against a Postgres whose `hnsw.ef_search` is NOT 40 — a tuned cloud instance, a
      managed provider with its own defaults, a self-host where someone set it in postgresql.conf,
      or any future pgvector release that changes the default;
  (2) an operator reports that changing search breadth "did nothing", or that the value shown does
      not match the behaviour they observe;
  (3) anyone adds a THIRD landing to `retrieval_service.py` — at which point the G-5 extraction must
      be proposed first anyway, and this is cheap to fix in the same pass;
  (4) a support question needs the answer to "what is actually in force right now?".
---

# The finding

`apply_hnsw_session_knobs` skips issuing `SET LOCAL hnsw.ef_search` when the resolved value equals a
**hardcoded constant**:

```python
_SERVER_DEFAULT_EF_SEARCH = 40       # "measured live 2026-09-10 (pgvector 0.8.0 / PG 17.6)"
...
if resolved_ef != _SERVER_DEFAULT_EF_SEARCH:
    ...                              # otherwise: issue nothing
```

The optimisation is sensible — do not spend a round trip setting a GUC to the value it already has.
**But the code cannot know the server's actual default and never asks**, even though the sibling
harness demonstrates the one-line way to (`SELECT current_setting('hnsw.ef_search', true)`).

## The failure, in the operator's words

On a server whose `hnsw.ef_search` is, say, `64`:

1. The operator opens Settings → Search → Retrieval and deliberately selects **40** — a *smaller,
   faster* search, which is a legitimate thing to want.
2. The value is validated, stored, and read back. **The UI shows 40.**
3. `apply_hnsw_session_knobs` sees `40 == _SERVER_DEFAULT_EF_SEARCH` and issues **nothing**.
4. Every search runs at the server's **64**.

⭐ **The screen shows a number that is not in effect, and nothing anywhere says so.** This is the
same shape as Phase 240's *"screen that discards its own answer"* and Phase 235's finding that a
green presence assertion coexisted with a shipped defect: **the value was stored correctly, and
storage was mistaken for effect.**

⚠ It is also invisible to every existing test, because the whole test suite runs against a server
where the default genuinely IS 40 — so the shortcut is indistinguishable from correct behaviour.
**The bug only exists on a machine nobody tests on**, which is exactly why it is written down
rather than left to be rediscovered.

# Fixes, cheapest first

1. **Delete the shortcut.** `SET LOCAL` on an already-equal value costs one statement on a
   connection the request has already opened, inside a transaction it has already begun. This is
   almost certainly the right answer: it trades a negligible cost for the removal of an entire
   class of "the setting did nothing" support question.
2. **Or ask the server once** — read `current_setting('hnsw.ef_search', true)` on first use and
   cache it per pool, the way `app_settings_has_hnsw_columns()` (Phase 241 CR-01) caches its column
   probe. Slightly more code, keeps the optimisation, and makes the constant honest.

⛔ **Whichever is chosen, drive it RED on a server whose default is NOT 40** — the defect is
invisible on one where it is. A test that cannot fail on the developer's machine is the thing this
seed exists to prevent shipping twice.

⚠ **Do not fix this by widening the landing on `retrieval_service.py`.** That file's G-5 extraction
has been OWED since Phase 231 and Phase 241 was the deliberate SECOND landing; the logic belongs in
`retrieval_tuning.py`, which is where it already is.

Related: [[SEED-076]], [[SEED-267]].
