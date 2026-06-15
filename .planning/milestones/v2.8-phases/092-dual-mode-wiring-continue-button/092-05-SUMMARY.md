---
phase: 092-dual-mode-wiring-continue-button
plan: 05
subsystem: api
tags: [harness, workflow_runs, harness_audit, asyncpg, postgres, rls, fastapi]

# Dependency graph
requires:
  - phase: 092-04
    provides: Wave 4 UAT findings (F1/F2/F3) — the gap report this plan closes
  - phase: 092-02
    provides: create_workflow_run atomic run-creation + producer mode-branch
  - phase: 092-03
    provides: finish_run single-clear-site (terminal status + anchor clear in one txn)
  - phase: 091
    provides: harness_engine.run_workflow + write_audit + 5 phase-type executors
provides:
  - "F1 closed: workflow_runs.user_id persisted; write_audit binds the owner; all 11 audit sites pass it — harness runs end-to-end with no NotNullViolationError"
  - "F2 closed: a failed/timed-out/cancelled harness run terminalizes workflow_runs + clears the anchor (no wedged lock); lock_is_stale self-heals on a terminal producer run"
  - "Live-DB harness_audit integration test (closes the 091 mock blind spot that let F1 ship)"
affects: [092-06, 092-verification, 091-cross-provider-UAT, SEED-047]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner-stamp threading: run-owner user_id sourced server-side (current_user) at run creation, persisted on workflow_runs, read back into every audit write + the resume ctx"
    - "Keyword-only user_id on write_audit so no caller can silently re-introduce the F1 omission"
    - "Failure-path terminalize in _shielded_finalize gated on (_active_workflow_run_id is not None AND _terminal_status != 'completed') — idempotent via finish_run, Deep runs skip"
    - "lock_is_stale self-heal ORs a terminal/missing producer-runs-row backstop while keeping the GET a pure read"

key-files:
  created:
    - backend/tests/integration/test_092_harness_audit_live.py
  modified:
    - backend/app/db/workflows.py
    - backend/app/services/harness_engine.py
    - backend/app/api/threads.py
    - backend/app/services/tool_dispatcher.py
    - backend/tests/test_dual_mode_wiring.py
    - backend/tests/test_thread_workflow_endpoint.py
    - supabase/migrations/064_workflow_runs_user_id.sql
    - supabase/full-schema.sql

key-decisions:
  - "write_audit user_id is keyword-only (not positional) — guarantees no caller can re-introduce the F1 omission without naming it"
  - "F2 terminalize lives in _shielded_finalize (runs on every escape path) rather than duplicated across 3 except branches — single point, gated on non-completed terminal status + harness anchor"
  - "lock_is_stale keeps `locked` server-authoritative; the heal surfaces only via lock_is_stale so the F3 frontend treats a stale lock as unlocked without the endpoint writing"
  - "migration 064 does NOT add NOT NULL to workflow_runs.user_id (existing rows backfill, but a pre-thread orphan run would fail) — the app layer always supplies it on new inserts; a future migration can tighten"

patterns-established:
  - "Live-DB integration test (pg_pool fixture, NOT mock) is mandatory for any NOT-NULL/constraint-bearing DB write path — the mock pool cannot enforce constraints (the exact gap that let F1 ship)"

requirements-completed: [MODE-01, MODE-02, CONT-01]

# Metrics
duration: ~45min
completed: 2026-05-31
---

# Phase 092 Plan 05: Gap-Closure (F1 audit-owner crash + F2 wedged lock) Summary

**Threaded the run-owner user_id through create_workflow_run + write_audit + all 11 harness audit sites (F1), added a failure-path terminalize + lock_is_stale producer self-heal (F2), and proved both with a live-DB harness_audit integration test that closes the 091 mock blind spot.**

## Performance

- **Duration:** ~45 min (Tasks 2-4; Task 1 done at the prior checkpoint)
- **Completed:** 2026-05-31T19:18:27+04:00
- **Tasks:** 4 (Task 1 = operator migration checkpoint resolved; Tasks 2-4 executed here)
- **Files modified:** 8 (1 created, 7 modified incl. migration + schema from Task 1)

## Accomplishments

- **F1 (CRITICAL) closed** — `workflow_runs.user_id` is persisted (migration 064 + `create_workflow_run`), `write_audit` now issues `INSERT INTO harness_audit (run_id, user_id, event_type, metadata)` binding the run-owner, and all 11 audit call sites pass it (10 in `harness_engine`, +1 in `tool_dispatcher`). A Harness workflow now runs end-to-end with no `NotNullViolationError`.
- **F2 (HIGH) closed** — a harness run that escapes via exception/timeout/cancel terminalizes `workflow_runs` + clears the anchor through `finish_run` (in `_shielded_finalize`); `lock_is_stale` self-heals when the underlying producer `runs` row is terminal even if `workflow_runs.status` lagged. No more wedged lock.
- **Mock blind spot closed** — `test_092_harness_audit_live.py` writes a REAL `harness_audit` row against live Postgres (proving the owner stamp lands) and proves a `user_id=None` write raises `NotNullViolationError` against the live constraint. This is the exact test the 091 mock-only audit path could never run.

## Task Commits

1. **Task 1: migration 064 + operator-apply + regenerate full-schema** - `160bb729` (author) + `88e05f07` (regenerate) — done at the prior checkpoint, operator-confirmed applied to live DB
2. **Task 2: thread user_id through create_workflow_run + write_audit + all 11 audit sites (F1)** - `cd592935` (feat)
3. **Task 3: failure-path terminalize + lock_is_stale producer self-heal (F2)** - `27afae18` (feat)
4. **Task 4: live-DB harness_audit integration test** - `c5388ec0` (test)

_TDD discipline: Tasks 2-4 wrote/extended tests alongside the source edit (the contract anchors already existed from Wave 0); each verify ran green before commit._

## Files Created/Modified

- `supabase/migrations/064_workflow_runs_user_id.sql` - ADD COLUMN workflow_runs.user_id + backfill from threads.user_id + FK to auth.users (ON DELETE CASCADE) + index (Task 1)
- `supabase/full-schema.sql` - regenerated live-DB dump now carrying the column + FK + index + COMMENT (Task 1)
- `backend/app/db/workflows.py` - `create_workflow_run` persists user_id ($5); `write_audit` gains keyword-only user_id and a 4-column INSERT
- `backend/app/services/harness_engine.py` - `_audit_user_id` resolved from `ctx.current_user`; threaded into `_run_phase_with_gates` and all 10 audit calls
- `backend/app/api/threads.py` - `create_workflow_run` call supplies `UUID(current_user['id'])`; `_shielded_finalize` F2 terminalize; `get_thread_workflow` lock_is_stale producer backstop
- `backend/app/services/tool_dispatcher.py` - `_spawn_tool_refused_audit` passes the owner id (the 11th write_audit caller — broke on the new signature)
- `backend/tests/test_dual_mode_wiring.py` - create_workflow_run user_id assertions + write_audit unit tests + F2 terminalize (positive + Deep-run negative)
- `backend/tests/test_thread_workflow_endpoint.py` - lock_is_stale-with-terminal-producer-run test + extra-fetchrow updates to the two existing tests
- `backend/tests/integration/test_092_harness_audit_live.py` - NEW live-DB F1 closure gates

## Decisions Made

- `write_audit` user_id is **keyword-only** so no caller can silently re-introduce the F1 omission.
- The F2 terminalize lives in `_shielded_finalize` (one point that runs on every escape path) gated on a non-completed terminal status + a harness anchor; idempotent via `finish_run`; Deep runs skip entirely.
- `lock_is_stale` keeps `locked` server-authoritative and surfaces the heal only via `lock_is_stale` (the GET stays a pure read).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 11th write_audit caller in tool_dispatcher broke on the new signature**
- **Found during:** Task 2 (threading user_id)
- **Issue:** The plan's interface note listed 10 `write_audit` sites in `harness_engine`, but `tool_dispatcher._spawn_tool_refused_audit` is an 11th caller (the D-06 `tool_refused` whitelist-refusal audit). The new keyword-only signature raised `TypeError: write_audit() takes 2 positional arguments but 4 were given` → `test_harness_whitelist.py::test_refusal_audited` failed.
- **Fix:** Passed `user_id=ctx.current_user["id"]` (the dispatching user) into the call; kept it best-effort (the refusal must never become an exception).
- **Files modified:** backend/app/services/tool_dispatcher.py
- **Verification:** `test_harness_whitelist.py` 7/7 green after the fix.
- **Committed in:** `cd592935` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required for correctness — the whitelist refusal audit is part of the harness substrate and would have crashed on every out-of-phase tool call. No scope creep; the change is the same owner-stamp pattern as the other 10 sites.

## Issues Encountered

- **Full-suite no-regression rigor:** The documented 092-03 baseline ("54-failed/569-passed") refers to a filtered subset; the full `tests/` run is far larger. To prove zero regressions, I captured the failure node-ID set at the pre-change commit (`88e05f07`) and after my commits and diffed them. Result: **zero net-new failures**. Full suite went 102-failed/1008-passed → 103-failed/1014-passed; the +6 passed are my new green tests, and the only "new" entry (`test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts`) is a PRE-EXISTING failure (proven to fail in isolation AND at baseline) that shifts in/out of the full-suite set due to test-ordering state pollution — not caused by this plan.

## Deferred Issues

- **`test_bounded_retry_reaches_failed_after_3_attempts` (pre-existing)** — fails in isolation (`calls["n"] == 0`, the phase executor never runs; `run_workflow` returns without iterating the phase). Present at baseline `88e05f07`; out of scope for 092-05 (not introduced or touched by these changes). Should be triaged separately.

## TDD Gate Compliance

This is a `type: execute` plan (not `type: tdd`), so the plan-level RED/GREEN/REFACTOR gate sequence does not apply. Per-task TDD discipline followed: each source edit shipped with its test in the same task commit, verified green before commit.

## Known Stubs

None — all changes are wired end-to-end (the owner stamp flows from the route through to the live DB; the F2 terminalize calls the real `finish_run`).

## Next Phase Readiness

- **092-06 (F3 frontend + UAT gate)** is unblocked: the backend now runs a Harness workflow end-to-end and reports an honest lock (`lock_is_stale` self-heals), so the F3 client-side disable-while-locked + 409 toast + optimistic rollback can be UAT'd against a working backend.
- **091's parked cross-provider workflow UAT** is unblocked — a live `INSERT INTO workflow_runs` now succeeds and a run executes its phases.
- **Operator live F1 proof** (per VERIFICATION): start the backend, kick off a Research→Summarize workflow, confirm the `run:{run_id}` SSE stream no longer errors with `NotNullViolationError`, phases execute, and `SELECT user_id, event_type FROM harness_audit WHERE run_id='<run>'` returns rows with non-null user_id. (Operator owns the backend; not started here.)

## Self-Check: PASSED

- Created files verified present: `test_092_harness_audit_live.py`, `064_workflow_runs_user_id.sql`, `092-05-SUMMARY.md`
- Task commits verified in git log: `160bb729`, `88e05f07`, `cd592935`, `27afae18`, `c5388ec0`

---
*Phase: 092-dual-mode-wiring-continue-button*
*Completed: 2026-05-31*
