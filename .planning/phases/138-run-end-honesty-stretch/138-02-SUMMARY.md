---
phase: 138-run-end-honesty-stretch
plan: 02
subsystem: api
tags: [todos, sse, finalizer, agent-loop, asyncpg, run-end-honesty]

# Dependency graph
requires:
  - phase: 085-write-todos
    provides: "replace_todos() full-state-replace service + todo_updated emit shape"
provides:
  - "reconcile_open_todos_on_run_end() — run-end honesty reconciler in todos_service.py"
  - "two guarded reconciler call sites in threads.py (clean-completion finalizers)"
  - "RUN-01b: open todos get '(run ended — not completed)' marker on a genuinely-clean run end"
affects: [138-03, run-end-honesty, workspace-todos-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Run-end reconciler as a net-new service function (kept OUT of the G-5 threads.py) called via one guarded line per finalizer"
    - "Honesty marker rides on the existing content text field — zero schema/enum/frontend change"

key-files:
  created: []
  modified:
    - "backend/app/services/todos_service.py"
    - "backend/app/api/threads.py"
    - "backend/tests/unit/test_085_todos_service.py"

key-decisions:
  - "D-01: honesty signal rides on content text (no new status enum, no migration, no frontend)"
  - "D-02/D-03: identical ' (run ended — not completed)' suffix for both pending and in_progress"
  - "D-04: marker never stacks — already-marked items detected via rstrip().endswith and skipped"
  - "LOCK-1: reconciler fires at BOTH clean-completion finalizers (_shielded_finalize AND spawn_continuation_run._finalize)"
  - "LOCK-2/S6: SITE-1 two-clause gate (completed AND cap_disposition != cap_paused) — the cap clause is load-bearing"
  - "D-14: no open todos → NO replace_todos, NO emit; finalizer step order byte-locked; reconciler best-effort (never raises)"

patterns-established:
  - "Pattern 1: single-source marker constant (_RUN_ENDED_MARKER) drives BOTH append and no-stack detection"
  - "Pattern 2: per-site finalizer gate — two-clause cap gate where cap_disposition isn't read, plain gate where cap_paused is already set"

requirements-completed: [RUN-01]

# Metrics
duration: ~11min
completed: 2026-07-06
---

# Phase 138 Plan 02: Run-End Todo Honesty Reconciler Summary

**A run-end reconciler appends a plain-text "(run ended — not completed)" honesty marker to still-open todos on a genuinely-clean run end (both first-turn and Continue-completed), never flipping status to completed — wired best-effort into both clean-completion finalizers with per-site cap gates.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-07-06T03:11:00Z (approx)
- **Completed:** 2026-07-06T03:22:47Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Net-new `reconcile_open_todos_on_run_end()` in `todos_service.py` — appends the exact D-03 marker (`" (run ended — not completed)"`, leading space + em-dash U+2014) to every pending/in_progress todo's `content` via the existing `replace_todos` full-state-replace path (S1), leaving completed items and ALL status values byte-unchanged (honesty guardrail).
- No-stack (D-04): already-marked items are detected (`content.rstrip().endswith(marker)`) and skipped; the byte-clean no-op path (D-14) does NO `replace_todos` call and NO emit when nothing is open.
- `todo_updated` re-emit mirrors `_handle_write_todos` exactly (S2) so the live SSE consumer's `TodosSection` re-renders honestly with zero frontend change.
- Wired at BOTH clean-completion finalizers in `threads.py` (LOCK-1): `_shielded_finalize` behind the load-bearing two-clause cap gate (LOCK-2/S6), `spawn_continuation_run._finalize` behind the plain `== "completed"` gate — each best-effort (`try/except BaseException` + `logger.exception`), positioned after step-1 persist and before step-2 `finalize_run` so the emit precedes the terminal sentinel and survives EXPIRE (S5 — no step reordered).
- 6 new unit tests locking every contract; full suite `test_085_todos_service.py` green (13 passed).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add reconcile_open_todos_on_run_end() + unit tests** - `14913653` (feat)
2. **Task 2: Wire the reconciler into both clean-completion finalizers** - `18cb617e` (feat)

## Files Created/Modified
- `backend/app/services/todos_service.py` - Added `_RUN_ENDED_MARKER` constant + `reconcile_open_todos_on_run_end()` beside `replace_todos`.
- `backend/app/api/threads.py` - Two guarded reconciler call sites (SITE 1 two-clause gate in `_shielded_finalize`; SITE 2 plain gate in `spawn_continuation_run._finalize`); pure-additive (50 insertions, 0 deletions).
- `backend/tests/unit/test_085_todos_service.py` - 6 new tests: exact-marker constant, marks both open statuses + leaves completed untouched, no-stack skip, all-completed early return, empty-list early return, emit-once-on-change.

## Decisions Made
None beyond the plan — followed the locked D-01..D-06 / LOCK-1 / LOCK-2 / D-14 decisions exactly. SITE 2 (LOCK-1) reuses the same `reconcile_open_todos_on_run_end` function per the plan's parallel-completion-path directive, sharing `redis`/`run_id`/`thread_id`/`get_pg_pool()`/`_emit` from the `_finalize` closure.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Initial Edit calls targeted the shared-checkout path and were redirected to the worktree copy (worktree isolation guard) — corrected immediately with no content change.

## Threat Model Compliance
All `mitigate` dispositions honored: the reconciler has NO new API route (invoked only from the run's own finalizer with that run's `thread_id`; `replace_todos` scopes every statement by `thread_id`); the two call sites are mutually exclusive per run and the marker is idempotent (T-138-04/05); the SITE-1 two-clause gate blocks the cap-paused false-terminal (T-138-06); each call is best-effort inside the byte-locked finalize sequence (T-138-07); zero new packages (T-138-SC).

## User Setup Required
None - no external service configuration required. No migration, no frontend, no new packages.

## Next Phase Readiness
- Plan 138-03 (checkpoint) provides the LIVE confirmation of both call sites firing (first-turn + Continue-completed) and the cap_paused negative — code surface is in place for that verification.
- Forward-only (D-06): the 14 pre-existing stuck threads observed 2026-07-05 are intentionally left untouched.

## Self-Check: PASSED

- Files verified present: `138-02-SUMMARY.md`, `todos_service.py`, `threads.py`, `test_085_todos_service.py`.
- Commits verified in git log: `14913653` (Task 1), `18cb617e` (Task 2), `e84ba524` (SUMMARY).
- No accidental file deletions across the plan's commits.
- Verifications green: marker exact-text assert OK; `pytest test_085_todos_service.py` 13 passed; `py_compile threads.py` OK; exactly 2 non-comment reconciler call sites + the two-clause cap gate present (VERIFIED).

---
*Phase: 138-run-end-honesty-stretch*
*Completed: 2026-07-06*
