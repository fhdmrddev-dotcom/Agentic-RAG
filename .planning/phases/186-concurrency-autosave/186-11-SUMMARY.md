---
phase: 186-concurrency-autosave
plan: 11
subsystem: backend-tests
tags: [test-reachability, ci, coverage-accounting, WR-06]
gap_closure: true
closes: [WR-06]
requires: ["186-02 (the -2 sentinel + draft_changed branch F6 defends)"]
provides:
  - "F6 (the draft_changed invariant) running in any environment, with or without Postgres"
  - "the two 23514 -> 409 route-mapping guards running DB-free"
  - "a per-test skip idiom for this family: _LIVE_DB_REASON + @pytest.mark.skipif"
affects:
  - backend/tests/unit/test_186_publish_race.py
  - backend/tests/unit/test_103_published_409.py
tech-stack:
  added: []
  patterns:
    - "per-test @pytest.mark.skipif bound to one module-level reason constant, replacing a module-level pytestmark"
key-files:
  created: []
  modified:
    - backend/tests/unit/test_186_publish_race.py
    - backend/tests/unit/test_103_published_409.py
    - .planning/phases/186-concurrency-autosave/186-VALIDATION.md
decisions:
  - "test_186_concurrent_patch.py left byte-unchanged — all four of its tests open a real asyncpg pool, so its module-level mark has nothing to rescue and churning it would be a change with no property behind it"
  - "the three DB-free tests carry a DELIBERATELY UNGUARDED docstring note, so a later 'consistency' tidy-up that re-adds a skipif has to argue with the reason it was removed"
metrics:
  duration: ~25 min
  completed: 2026-08-01
  tasks: 2
  commits: 2
---

# Phase 186 Plan 11: Live-Postgres Skip Moves Off The Module Summary

The skip became a property of the tests that need a database instead of a property of the
file, so this phase's headline backend invariant — a `-2` sentinel becomes a `draft_changed`
refusal rather than `{published: True, version: -2}` plus a false `publish_succeeded` receipt
— now has CI coverage in any environment without local Postgres.

## What Changed

A module-level `pytestmark = pytest.mark.skipif(not PG_AVAILABLE, ...)` in two files gated
three tests that touch no database at all. Those three are now selected and passing with the
DSN pointed at an unreachable port; the nine that genuinely need a database carry their own
per-test decorator and still skip rather than fail.

Each touched module binds ONE `_LIVE_DB_REASON` constant, byte-identical to the module-level
reason string it replaced, so the skip report reads exactly as before and the decorators
cannot drift apart.

## The Twelve-Test Classification

Produced by reading every body, not by trusting names. The single criterion: does the body
open a real database connection (an `asyncpg` pool, a `psycopg2` connect, or a fixture that
does), or does it drive the code under test through `AsyncMock()` / `patch(...)` boundaries
only?

| # | File | Test | Evidence in the body | Class |
|---|------|------|----------------------|-------|
| 1 | `test_186_publish_race.py` | `test_a_draft_that_moved_is_refused_at_the_flip` | `asyncpg.create_pool(dsn=_DSN)`; real `create_workflow_definition` + `UPDATE` | **LIVE** |
| 2 | `test_186_publish_race.py` | `test_the_two_sentinels_are_distinguishable` | `asyncpg.create_pool(dsn=_DSN)`; real `publish_definition` ×3 | **LIVE** |
| 3 | `test_186_publish_race.py` | `test_an_absent_token_keeps_todays_unguarded_flip` | `asyncpg.create_pool(dsn=_DSN)`; real flip + status re-read | **LIVE** |
| 4 | `test_186_publish_race.py` | `test_the_golden_run_receipt_survives_a_draft_changed_refusal` (**F6**) | `pool=AsyncMock()`, `redis=AsyncMock()`; `get_definition`, `write_audit`, `_drive_golden_run`, `_judge_golden_output`, `publish_definition` all patched | **DB-FREE** |
| 5 | `test_186_concurrent_patch.py` | `test_stale_patch_is_refused_and_the_winners_content_survives` | `asyncpg.create_pool`; `get_pg_pool` patched to return the **real** pool | **LIVE** |
| 6 | `test_186_concurrent_patch.py` | `test_a_stale_token_is_409_stale_token_never_404` | same — real pool behind the patch | **LIVE** |
| 7 | `test_186_concurrent_patch.py` | `test_foreign_and_unknown_ids_are_the_same_404` | same, plus `_two_owners(con)` fetching real `auth.users` rows | **LIVE** |
| 8 | `test_186_concurrent_patch.py` | `test_autosave_never_mints_a_version` | same — real pool, real `version` re-read | **LIVE** |
| 9 | `test_103_published_409.py` | `test_patch_published_row_is_immutable_via_route_409_and_no_mutation` | `asyncpg.create_pool`; real `INSERT` + re-read | **LIVE** |
| 10 | `test_103_published_409.py` | `test_delete_published_row_is_immutable_via_route_404_and_row_survives` | `asyncpg.create_pool`; real `INSERT` + `count(*)` | **LIVE** |
| 11 | `test_103_published_409.py` | `test_patch_route_maps_check_violation_to_409` | `patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=AsyncMock()))` | **DB-FREE** |
| 12 | `test_103_published_409.py` | `test_delete_route_maps_check_violation_to_409` | same mock-only shape | **DB-FREE** |

**3 DB-free, 9 live.** Note the `get_pg_pool` patch in rows 5–8 does NOT make them mock-only —
the mock *returns a real asyncpg pool*, so the body still talks to Postgres. Classifying by
the presence of `patch(...)` rather than by what the patch hands back would have mis-labelled
four tests as rescuable.

## Was `test_186_concurrent_patch.py` Touched?

**No — byte-unchanged, deliberately.** All four of its tests open a real pool (rows 5–8
above), so its module-level `pytestmark` gates nothing that could run without a database.
The plan's instruction was explicit: a file with no DB-free test has nothing to rescue, and
churning it would be a change with no property behind it. Its docblock sentence — "this file
SKIPS cleanly when the local stack is down" — remains literally true for that file, so it was
not reworded either.

## Run A / Run B

Both runs cover the same three files. Real pytest output lines:

| Run | Command | Result |
|-----|---------|--------|
| **A — DB unreachable** (`POSTGRES_DSN=…@127.0.0.1:1/postgres`) | `pytest tests/unit/test_186_publish_race.py tests/unit/test_186_concurrent_patch.py tests/unit/test_103_published_409.py -q` | `3 passed, 9 skipped, 1 warning in 6.34s` — exit 0 |
| **B — DB reachable** (default DSN, local Supabase up on :54322) | same command, no DSN override | `12 passed, 1 warning in 1.40s` — exit 0 |

The RED/GREEN pair for Run A, same command against the pre-task tree and the post-task tree:

```
RED   (pre-change):  12 skipped, 1 warning in 6.73s          # 0 passed
GREEN (post-change):  3 passed, 9 skipped, 1 warning in 6.34s
```

The three that now run without a database, by name (`-v`):

```
tests/unit/test_186_publish_race.py::test_the_golden_run_receipt_survives_a_draft_changed_refusal PASSED
tests/unit/test_103_published_409.py::test_patch_route_maps_check_violation_to_409 PASSED
tests/unit/test_103_published_409.py::test_delete_route_maps_check_violation_to_409 PASSED
```

Exactly the three the plan named. The nine skips report the same sentences as before, e.g.
`SKIPPED [1] tests\unit\test_186_publish_race.py:108: Local Postgres on postgresql://…:1/postgres
not reachable; skipping live publish-race tests`.

## Counts — Nothing Deleted, Nothing Renamed

| Measurement | Before | After |
|---|---|---|
| The three files, `--collect-only -q` (DB reachable) | **12** | **12** |
| The three files, full run (DB reachable) | 12 passed | 12 passed |
| Backend suite, `--collect-only -q` | 3457 (`186-VALIDATION.md` baseline) | **3465** |
| Backend suite, failures | 211 (recorded by 186-01 / 186-02) | **211** |

Full-suite line: `211 failed, 3228 passed, 11 skipped, 5 xfailed, 9 xpassed, 265 warnings,
1 error in 380.41s`. The failure count is byte-identical to the pre-existing rot band both
earlier plans in this phase measured — this plan adds no failure and removes no test. The
+8 against 3457 came from 186-01 and 186-02; **186-11 added zero tests**, which is the point:
it changed reachability, not coverage.

## Acceptance Greps

| Grep | Required | Measured |
|---|---|---|
| `grep -c "^pytestmark" test_186_publish_race.py` | 0 | **0** |
| `grep -c "^pytestmark" test_103_published_409.py` | 0 | **0** |
| `grep -c 'reason=_LIVE_DB_REASON' test_186_publish_race.py` | = live tests (3) | **3** |
| `grep -c 'reason=_LIVE_DB_REASON' test_103_published_409.py` | = live tests (2) | **2** |
| `git diff --stat backend/requirements.txt` (T-186-11-SC) | empty | **empty** |
| `grep -c "^pytestmark" test_186_concurrent_patch.py` | 1 (untouched) | **1** |

## Deviations from Plan

### Corrected Plan Facts

**1. [Rule 1 - Measurement] The plan says "seven live-DB tests"; there are NINE.**
- **Found during:** Task 1, while classifying the twelve bodies.
- **Issue:** The plan's third truth and its `key_links` both say seven. Twelve tests minus
  three DB-free is nine, and the observed run confirms it: `3 passed, 9 skipped`. The
  arithmetic that produced "seven" appears to have counted only the two files being edited
  (3 + 2 = 5) or otherwise dropped `test_186_concurrent_patch.py`'s four.
- **Resolution:** No code consequence — the plan's *acceptance criteria* are stated in the
  correct terms ("at least 3 PASSED … the remaining tests SKIPPED", "0 passed and 12 skipped"
  pre-task) and all are met. The property the truth asserts — the live tests skip rather than
  fail, and the run exits 0 — holds for all nine. Recorded here so re-verification measures
  nine and does not read the correct result as a shortfall.

### Additions Beyond the Letter of the Plan

**2. [Rule 2 - Durability] A `DELIBERATELY UNGUARDED` note on each of the three DB-free tests.**
- **Why:** The plan changes three tests into the only un-decorated functions among twelve
  siblings that all carry a `skipif`. That asymmetry reads as an oversight to the next person,
  and "adding the missing decorator" would silently restore the exact defect WR-06 recorded —
  with a green suite either way. The note states the reason at the site where the mistake
  would be made.
- **Files:** both edited test files (docstrings only; no assertion touched).

**3. [Rule 2 - Honesty] The Run B row also records the backend failure count, not just the count of collected tests.**
- **Why:** A collected-count comparison alone cannot distinguish "no test was removed" from
  "a test was removed and another added". Pairing 3465 collected with 211 failed —
  byte-identical to the two prior plans' measurement — closes that gap.

## Notes for Later Plans

**The `get_pg_pool` patch is not a DB-free signal.** Rows 5–8 patch
`app.api.workflows.get_pg_pool` and are nonetheless fully live, because the mock returns a
real `asyncpg` pool created in the test body. Any future sweep that tries to widen this
rescue by grepping for `patch(` or `AsyncMock` will mis-classify them. The criterion is what
the body ultimately *connects to*, and it can only be established by reading the body.

**Waves 7–8 are unaffected.** This plan touched no source file, no route, no migration
(head stays 114) and no frontend file — 186-12 and 186-13 open `useDraftPersistence.ts`
exactly as 186-09 left it.

**Counters and requirement status deliberately NOT advanced by this executor.** `CONCUR-02`
stays as it is: WR-06 is one of three blockers plus four warnings, and 186-12 / 186-13 are
still owed. ROADMAP plan-progress left to the orchestrator.

## Threat Model Outcomes

| Threat | Disposition | Outcome |
|---|---|---|
| T-186-11-01 (Repudiation — the module-level `pytestmark`) | mitigate | **Closed.** An unreachable-DSN run now reports 3 passes where it reported 0; F6 executes the `-2` → `draft_changed` proof with no database. |
| T-186-11-02 (Tampering — the live tests) | accept | Unchanged posture. The nine live tests still skip rather than fail; the risk is not widened. |
| T-186-11-03 (Repudiation — coverage accounting) | mitigate | **Closed.** Three-file collected count 12 → 12; suite 3457 → 3465 (non-decreasing) with the failure band unmoved at 211. |
| T-186-11-SC (Tampering — pip installs) | accept | No package installed; `git diff --stat backend/requirements.txt` empty. |

No new threat surface: this plan adds no endpoint, no auth path, no file access and no schema
change. No stubs were introduced.

## Commits

| Task | Commit | Description |
|---|---|---|
| 1 | `4de772c3` | `test(186-11): move the live-Postgres skip off the module onto the tests that need a DB` |
| 2 | `c2c79c3b` | `docs(186-11): record F6 as DB-free and re-measure the backend collected count` |
</content>
</invoke>
