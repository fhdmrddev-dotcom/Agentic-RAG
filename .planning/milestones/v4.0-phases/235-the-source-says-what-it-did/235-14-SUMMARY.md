---
phase: 235-the-source-says-what-it-did
plan: 14
subsystem: sources / watch health
gap_closure: true
gap_closure_round: 1
closes_gap: "G2 — SC#2 'a stopped source says WHEN it last succeeded'"
tags: [sources, watches, health-verdict, sql, api, gap-closure]

requires:
  - "backend/app/services/sources/health_verdict.py::verdict_for_runs (consumed unchanged)"
  - "supabase/migrations/172_connector_sync_runs.sql (read; NO migration added)"
provides:
  - "backend/app/db/watches.py::last_success_by_watch — the newest successful tick per watch, unbounded, one query"
  - "GET /sources/health — stopped rows carry a last_good_at even when it predates the verdict window"
affects:
  - "frontend/src/components/sources/WatchedFoldersSection.tsx (byte-unchanged — it already renders a non-null last_good_at)"
  - "frontend/src/components/library/SourcesAttentionSection.tsx (byte-unchanged — same)"

tech-stack:
  added: []
  patterns:
    - "aggregate-beside-window: a second read whose ONLY differentiator is that it is unbounded, run for the rows the window could not answer for"
    - "owner predicate in the SQL, not at the call site (the asyncpg pool path is not RLS-gated)"
    - "absence over present-with-None, so a caller cannot confuse 'never succeeded' with 'was not asked about'"
    - "fail-soft enrichment: the sentence degrades, the endpoint the shell polls does not"

key-files:
  created: []
  modified:
    - backend/app/db/watches.py
    - backend/app/api/sources.py
    - backend/tests/unit/db/test_watches_db.py
    - backend/tests/unit/services/test_source_health_verdict.py
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md

decisions:
  - "D-235-14-01: the fix lands on the SERVER, not the card — D-235-05 (one verdict, decided once) means filling the instant here fixes BOTH surfaces with no client derivation and no second verdict that could disagree."
  - "D-235-14-02: the polled window was NOT widened. `_HEALTH_RUN_WINDOW` is byte-identical and now pinned by a test. Widening it multiplies rows on every poll for every healthy source to answer a question only stopped sources ask — and a wider window is still a window."
  - "D-235-14-03: the enrichment is guarded on `s.last_good_at is None`, which is stronger than 'only when something is stopped' — a window that already answered is never re-asked, so the two values can never be seen to disagree."
  - "D-235-14-04: the shipped `_HEALTH_RUN_WINDOW` caveat was rewritten rather than left. It documented this exact gap and would have become a false statement about live behaviour."

metrics:
  duration: "~55 min"
  completed: 2026-09-06
  commits: 2
  tasks: 2
---

# Phase 235 Plan 14: The Source Says When It Last Read Summary

`GET /sources/health` now fills a stopped source's `last_good_at` from an unbounded
`MAX(started_at) WHERE status = 'success'` aggregate — for the stopped rows only — so a source
that died before the five-row verdict window says **when** it last read, on screen, instead of
rendering nothing.

## The gap, precisely

`235-VERIFICATION.md` scored SC#2 (*"a stopped source says WHEN it last succeeded"*) **partial /
WARNING**, and the finding it recorded is subtle enough to be worth restating:

- ⭐ **The overclaim risk was REFUTED, not confirmed.** `WatchedFoldersSection.tsx:872-876` renders
  `COPY.neverRead` only when `provenNeverRead` is true — i.e. only after the **unbounded** run list
  has been fetched and holds no success. `SourcesAttentionSection.tsx:134` renders nothing on null.
  **A long-dead source was never libelled as "never read".** That gating is correct and this plan
  left the frontend byte-unchanged, so it survives untouched.
- ⛔ **The residual defect was SILENCE.** `_HEALTH_RUN_WINDOW = max(5, SOFT_FAILURE_THRESHOLD + 1)`
  means `last_good_at` is *"the newest success within five rows"*. A source that has failed more
  ticks than that reports `None`, and both surfaces render **neither** *"last read successfully on
  X"* **nor** anything else. The answer sat one click away in the History expansion.

## What was built

### Task 1 — `last_success_by_watch` (commit `be7608094`)

`backend/app/db/watches.py` gains the third read on `connector_sync_runs`, and the only unbounded
one:

```sql
SELECT watch_id, MAX(started_at) AS last_success_at
FROM connector_sync_runs
WHERE watch_id = ANY($1::uuid[])
  AND user_id = $2
  AND status = 'success'
GROUP BY watch_id
```

- **Owner predicate in the SQL.** `user_id = $2` now appears in all three sync-run reads. This pool
  path is not RLS-gated (migration 172's policies protect PostgREST, not this connection), so a
  guessed `watch_id` returns zero rows rather than another tenant's history (T-235c-04). Asserted
  over the executed statement text, not over the call site.
- **Absence, never `None` in a value slot.** A watch with no successful tick is simply missing from
  the mapping. The api-layer fill is `verdict_value or found.get(id)` — a present-with-`None` would
  turn that into a silent no-op that reads exactly like a fix.
- **Empty input issues no query at all**, asserted by a mock that fails if the pool is acquired.
- **`_SYNC_RUN_COLUMNS` deliberately NOT reused** — this selects an aggregate; pulling seventeen
  columns to read one instant is the amplification the sibling docblock warns about.
- **Non-vacuity pin without coupling:** the SQL's `'success'` literal is asserted equal to
  `health_verdict.SUCCESS_STATUS` from the test, so the DAL does not import a service, yet a move of
  that constant cannot leave this aggregate silently answering about a status nothing writes.

### Task 2 — the route answers it, and the docblock stops saying it cannot (commit `cc9572961`)

`backend/app/api/sources.py`, beside the existing connection-name enrichment:

```python
unanswered = [s.watch_id for s in stopped if s.last_good_at is None]
if unanswered:
    try:
        found = await last_success_by_watch(pool, unanswered, user_id=user_id)
        stopped = [ ... s.model_copy(update={"last_good_at": found.get(str(s.watch_id))}) ... ]
    except Exception:
        logger.exception(...)
```

The `is None` guard is what makes three properties hold simultaneously — none of them is asserted
by inspection, all three by a spy:

| Property | Test |
|---|---|
| A healthy instance pays **nothing** (zero stopped ⇒ never awaited) | `test_health_does_not_ask_the_unbounded_lookup_when_nothing_is_stopped` |
| A success **inside** the window still wins, and is not re-asked | `test_health_keeps_the_windows_last_good_at_when_the_window_had_one` |
| A **genuinely** never-succeeded source still reports `None` | `test_health_still_reports_no_last_good_at_when_it_has_genuinely_never_succeeded` |
| Scoped to the stopped ids, never the roster (T-235c-05) | `test_health_asks_the_unbounded_lookup_only_about_the_stopped_watch` |
| A raised lookup degrades the sentence, not the endpoint (T-235c-06) | `test_health_survives_a_failed_last_good_lookup` |

The `_HEALTH_RUN_WINDOW` caveat paragraph — which documented this very gap — was **rewritten**, and
a test greps the live module to keep the stale claim gone. A docblock that survives the fix it
described is a false statement about live behaviour, and the next reader believes it over the code.

## The cost of the chosen seam — stated and measured

Both candidate fixes were available; the plan named one and measurement did not overturn it.

| | Widen `_HEALTH_RUN_WINDOW` (rejected) | Unbounded aggregate for stopped rows (taken) |
|---|---|---|
| Rows read per poll, healthy source | `per_watch` × N watches, **on every poll by every signed-in user** | unchanged (5 × N) |
| Extra queries, healthy instance | 0 (but every row is fatter) | **0** — the list is empty, so no query is issued |
| Extra queries, K stopped sources | 0 | **1**, over K ids |
| Does it remove the edge? | **No** — it moves the edge further out and still has one | **Yes** — no window at all |

- **The polled query shape is byte-identical.** `grep -n "_HEALTH_RUN_WINDOW = "` returns
  `504:_HEALTH_RUN_WINDOW = max(5, SOFT_FAILURE_THRESHOLD + 1)`, and
  `test_the_polled_window_is_unchanged_by_the_gap_fix` pins both the expression and its value (`5`).
  Without that pin a later *"just make the window bigger"* would satisfy every other case in the
  section.
- **The index still serves it.** `idx_connector_sync_runs_watch_time` is
  `(watch_id, started_at DESC)` (migration 172:90-91). `MAX(started_at)` grouped by `watch_id`,
  filtered to a bounded id array, is a bounded scan of that index — the same index the history route
  and the streak derivation already read. **No migration, no schema change, no `full-schema.sql`
  regeneration.**
- **One call site**, pinned two ways: `grep -c last_success_by_watch backend/app/api/sources.py` is
  exactly `2` (line 40 import, line 654 call), and
  `test_the_unbounded_lookup_has_exactly_one_call_site` asserts the same count over the live source.

## The RED drives

Both were performed and both are recorded, because a guard nobody has seen fire is not a guard.

1. **Task 1, RED by absence.** The four DAL cases were written first and run before the function
   existed:
   `ImportError: cannot import name 'last_success_by_watch' from 'app.db.watches'` — collection
   error, 0 collected. GREEN after implementation: `18 passed`.
2. **Task 2, RED by absence, then RED by deliberate defect.**
   - Adding the route cases (and the `_wire_health` patch of a not-yet-existing symbol) before the
     import produced **`16 failed, 22 passed`** — the nine new cases plus seven shipped ones, which
     failed on the `AttributeError` from patching a symbol `app.api.sources` did not have.
   - After GREEN, the acceptance criterion's explicit drive was performed: the call
     `found = await last_success_by_watch(...)` was replaced with `found = {}` and the suite re-run.
     Result — **`3 failed, 36 passed`**, and the three are exactly the ones that should be:
     `test_health_says_when_a_source_last_read_even_from_outside_the_window` (the G2 case),
     `test_health_asks_the_unbounded_lookup_only_about_the_stopped_watch`, and
     `test_the_unbounded_lookup_has_exactly_one_call_site`.
     ⚠ **The two negative-preservation cases stayed green under the defect, as they should** —
     `..._genuinely_never_succeeded` and `..._survives_a_failed_last_good_lookup` both assert
     `last_good_at is None`, so neither can distinguish the fix from its absence. That is recorded
     rather than glossed: they guard the meaning of `None`, they do **not** prove the gap is closed.
   - The call was then restored and the three suites re-run: **`67 passed`**.

## Gates

**Backend — verbatim tail line:**

```
71 failed, 3901 passed, 2 xfailed, 2 xpassed, 45 warnings in 418.48s (0:06:58)
```

- `71 failed` — **exactly the v4.0 ceiling, zero headroom consumed.** 0 collection errors.
- `3901 passed` against the measured base of `3888` = **`+13`**, which reconciles with no residual:
  `+4` in `test_watches_db.py`, `+9` in `test_source_health_verdict.py`.

**Per-suite before / after:**

| Suite | before | after |
|---|---|---|
| `backend/tests/unit/db/test_watches_db.py` | 14 passed | **18 passed** |
| `backend/tests/unit/services/test_source_health_verdict.py` | 30 passed | **39 passed** |
| `backend/tests/unit/api/test_sources_watches_api.py` | 10 passed | **10 passed** (byte-unchanged) |

**Frontend.** No frontend file was modified, and `scripts/vitest-count-gate.cjs` was **not** edited —
no new suite file was created, every new case landed in an already-pinned backend suite.

⚠ **"Frontend untouched ⇒ frontend gate unaffected" is UNSOUND in this repo, so it was checked
rather than assumed.** `frontend/src/components/sources/sourceComposition.test.tsx` imports
`backend/app/api/sources.py?raw` — one of the two files this plan edits. It was run:

```
Test Files  1 failed (1)
     Tests  16 failed | 33 passed (49)
```

**Identical to the stated baseline `16 failed | 33 passed (49)` — not worse.** All six §6 fences that
read `sources.py` PASS, confirmed from the run's own JSON report rather than from the totals:
non-vacuity (`length > 5000`), `"scheduled"` absent, `"instantly"` absent, `"on change"` absent, and
`--color-danger` never on a source state. The 16 reds are the inherited harness finding already
recorded in the ledger (`RunHistoryList` mounts behind a click), untouched by this plan.

**CLAUDE.md size gate:** `117755` then `117800 chars · 78.5% of limit · headroom 32200 · [OK]`.
Total growth **+58 chars** against a plan budget of ≤ 300. Two disposition cells updated in place
(both ≤ 200 chars) with the narrative in `docs/HOT-FILE-LEDGER.md` in the **same commit**, per the
same-commit sync rule.

## Ledger

Both rows re-derived from git rather than copied forward, and both were stale:

| File | row said | re-derived | G-5 |
|---|---|---|---|
| `backend/app/db/watches.py` | `2 / 2 / 634` | **`2 / 2 / 696`** | no (2 phases) |
| `backend/app/api/sources.py` | `5 / 1 / 643` | **`5 / 1 / 677`** | no (1 phase) |

Neither fires G-5. Detail sections added to `docs/HOT-FILE-LEDGER.md` under
`### ⚠ Re-derived 2026-09-06`, with the prior header triples **kept, not overwritten**.

## Deviations from Plan

**1. [Rule 3 — Blocking] The plan's `last_success_by_watch` grep criterion could not be met with the
cross-reference as first drafted**

- **Found during:** Task 2, running the acceptance greps.
- **Issue:** The rewritten `_HEALTH_RUN_WINDOW` docblock named `last_success_by_watch` as a pointer
  to the enrichment site, so `grep -c` returned **3**, not the criterion's **2** (import + one call).
- **Fix:** The docblock now points at *"the single enrichment site in `get_source_health` below"*
  without repeating the symbol, and says explicitly that the symbol is named there and nowhere else
  **so that the grep stays checkable**. The criterion's real property — one call site — was then made
  executable rather than left to a manual grep: `test_the_unbounded_lookup_has_exactly_one_call_site`
  asserts `src.count("last_success_by_watch") == 2` over the live module source.
- **Files modified:** `backend/app/api/sources.py`, `backend/tests/unit/services/test_source_health_verdict.py`
- **Commit:** `cc9572961`

**2. [Rule 2 — Missing critical functionality] `_wire_health` returns the spy**

- **Found during:** Task 2.
- **Issue:** The shipped helper patched two symbols and returned `None`. The plan's `<behavior>`
  requires asserting the lookup is **not** called, which is unassertable without a handle on it — and
  worse, any stopped-source case that did not patch the new symbol would reach a real pool through
  the `AsyncMock` and would be measuring the double instead of the route.
- **Fix:** `_wire_health` now also patches `app.api.sources.last_success_by_watch` (defaulting to
  `{}`) and **returns** that mock. Existing call sites ignore the return value and are otherwise
  byte-unchanged.
- **Files modified:** `backend/tests/unit/services/test_source_health_verdict.py`
- **Commit:** `cc9572961`

**3. Commit message length**

The `commit-msg` hook refused a 20-line body (cap 12) on Task 2. The message was shortened and the
detail moved here, which is where the hook says it belongs. No `GSD_LONG_COMMIT` override was used.

## G-7 posture

This is gap-closure **round 1** of a 2-round cap. It closes exactly the named gap and adds **no new
user-facing capability**: no new route, no new response field, no new frontend surface, no schema
change. The one new function is a private DAL read behind an existing endpoint, and the two consuming
components are byte-unchanged.

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired data source was introduced. The one
`None` this plan can still produce — `last_good_at` for a source with no stored success — is the
honest answer, is asserted to be reachable, and is the value the client's `provenNeverRead` arm is
built on.

## Threat Flags

None. No new endpoint, auth path, file access pattern or trust-boundary schema change. The single new
read carries the owner predicate its two shipped siblings carry, asserted over the statement text.

## Owed / Not Done

- **G-4 lived-experience UAT is OWED for this fix.** Every claim above is unit-level. The property a
  user would recognise — *the card, at rest, shows "Last read successfully 40 days ago" instead of
  nothing* — needs a real stopped watch whose only success predates five ticks. The composition
  fence cannot see it: it asserts block presence by testid, and `sources-last-good` was already
  present (rendering the third, empty arm).

## Self-Check: PASSED

- `backend/app/db/watches.py::last_success_by_watch` — FOUND (`grep` line 491)
- `backend/app/api/sources.py` import + single call — FOUND (lines 40, 654)
- `backend/tests/unit/db/test_watches_db.py` — 4 new cases FOUND, 18 passed
- `backend/tests/unit/services/test_source_health_verdict.py` — 9 new cases FOUND, 39 passed
- `docs/HOT-FILE-LEDGER.md` re-derived sections — FOUND (both files)
- commit `be7608094` — FOUND in `git log`
- commit `cc9572961` — FOUND in `git log`
- ⛔ NOT touched, verified by `git diff --name-only`: `.planning/STATE.md`, `.planning/ROADMAP.md`,
  `scripts/vitest-count-gate.cjs`, `backend/app/services/sources/health_verdict.py`,
  `backend/app/services/sources/failure_cause.py`, `backend/app/services/watch_service.py`,
  `frontend/src/components/sources/sourceHealthVocabulary.ts`, and every frontend source file.
