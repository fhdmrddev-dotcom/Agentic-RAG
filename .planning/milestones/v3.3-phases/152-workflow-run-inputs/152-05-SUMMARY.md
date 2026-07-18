---
phase: 152-workflow-run-inputs
plan: 05
subsystem: api
tags: [workflow, delete-cascade, run-lifecycle, cancel-first, asyncpg, httpx, security]

# Dependency graph
requires:
  - phase: 152-02
    provides: delete_published_workflow_cascade + delete_workflow_cascade_preview db helpers + the cascade/preview routes
  - phase: 152-04
    provides: in_flight preview field + the frontend victim-naming delete Sheet the amber cancel-first banner gates on
provides:
  - Producer-identity cancel-first in delete_workflow_cascade (cancel through the live runs.run_id, not workflow_runs.id — CR-01/D-LOCK-05)
  - publish_cancel_sentinel(wf_id) + finish_run(wf_id,"cancelled") before the delete (paused + cross-worker WORKER_COUNT=2 backstop)
  - count_foreign_runs_on_global helper + 409 refuse for is_global cross-user cascades (WR-01)
  - Route-level cascade backstop tests (producer cancel identity, 404-collapse both routes, in_flight preview, WR-01 refuse)
affects: [152-verify-work, 152-secure-phase, workflow-delete, run-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cancel-first through the PRODUCER runs.run_id (the RUN_TASKS key) — mirror the admin.py Kill discipline, never the workflow_runs id"
    - "Fail-closed 409 guard for is_global cross-user destructive paths (count-other-users-runs → refuse)"
    - "httpx ASGITransport + dependency_overrides route harness against the live pool with a seeded current-user identity"

key-files:
  created: []
  modified:
    - backend/app/api/workflows.py
    - backend/app/db/workflows.py
    - backend/tests/test_152_delete_cascade.py

key-decisions:
  - "Cancel the live producer via a LEFT JOIN to runs (status='streaming') resolving r.run_id AS producer_id; producer_id IS NULL (already-terminal / cross-worker) skips the task cancel but still runs the durable finish_run backstop"
  - "finish_run imported at module top (pure DB helper, no RUN_TASKS cycle); _cancel_run_internals + publish_cancel_sentinel stay late-imported (admin.py:479 discipline)"
  - "WR-01 mitigation = fail-closed 409 refuse (option a), not split preview counts (option b) — the destructive path is the risk; the read counts stay owner-definition-scoped and are documented honestly"
  - "Route tests patch app.dependencies.is_operator=False so require_visible('workflow_authoring') passes via its 'everyone' audience carve-out (no operator seed needed)"

patterns-established:
  - "Producer-identity resolution for any run-lifecycle action on a workflow_run: JOIN the live runs row, act on runs.run_id"
  - "is_global destructive-path guard: count_foreign_runs_on_global before any side effect"

requirements-completed: [WFIN-03]

# Metrics
duration: 21min
completed: 2026-07-14
---

# Phase 152 Plan 05: Gap Closure — Producer-Identity Cancel-First + WR-01 Refuse Summary

**The workflow "Delete forever" now truly stops a live run before its rows vanish (cancel through the producer runs.run_id, not the workflow_runs id) and can no longer silently blast another user's runs on a shared workflow.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-14T19:12:xxZ
- **Completed:** 2026-07-14T19:33:37Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- **CR-01 / D-LOCK-05 closed:** `delete_workflow_cascade` resolves the live producer identity via `LEFT JOIN runs r ON r.thread_id = wr.thread_id AND r.status = 'streaming'` and cancels through `r["producer_id"]` (the `RUN_TASKS` key registered at threads.py:2011) — never the `workflow_runs.id`. Adds `publish_cancel_sentinel(wf_id)` (wakes paused ask_user harness prompts on the workflow-run channel) and `finish_run(wf_id, "cancelled")` (durable terminalize covering the paused + cross-worker `WORKER_COUNT=2` cases), all cancel-first and outside the delete txn.
- **WR-01 closed:** new `count_foreign_runs_on_global` db helper counts OTHER users' runs on the caller's `is_global` definitions; the cascade route now raises **409** before any cancel/delete side effect when that count is > 0. The misleading `delete_workflow_cascade_preview` docstring is corrected to state the run/thread/in_flight counts aggregate across all runners for global defs (the 409 guard — not run-level owner-scoping — protects the destructive path).
- **IN-02 closed:** 4 route-level tests (httpx ASGITransport + dependency overrides against live PG) prove the producer-identity cancel-first (spy asserts `run_id == producer_run` and `!= workflow_run_id`, awaited once), 404-collapse on both `/cascade` and `/delete-preview`, `in_flight == 1` on an active run, and the WR-01 409 refuse leaving cross-user rows untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: CR-01 producer-identity cancel-first + sentinel + finish_run** - `cb7cb1e4` (fix)
2. **Task 2: WR-01 is_global cross-user 409 refuse + corrected preview docstring** - `c5575789` (fix)
3. **Task 3: IN-02 route-level cascade backstop tests** - `9b2e71be` (test)

## Files Created/Modified
- `backend/app/api/workflows.py` — `delete_workflow_cascade`: LEFT-JOIN producer-identity cancel loop (`producer_id`), `publish_cancel_sentinel(wf_id)` + `finish_run(wf_id,"cancelled")` before the delete; WR-01 `count_foreign_runs_on_global` → 409 guard after `_owned_slug_or_404`; added `count_foreign_runs_on_global` + `finish_run` imports.
- `backend/app/db/workflows.py` — new `count_foreign_runs_on_global(pool, *, slug, user_id)` helper (`is_global = true`, `user_id <> $2`, `ANY($1::uuid[])` binding); corrected `delete_workflow_cascade_preview` docstring (removed the false "no cross-user count leak" claim).
- `backend/tests/test_152_delete_cascade.py` — `route_owner` fixture + `_seed_producer_run` helper + `is_global` kwarg on `_seed_definition`; 4 route-level tests.

## Decisions Made
- Cancel via a `LEFT JOIN` to the live `runs` row so a run with no live producer (already-terminal or on the other worker) has `producer_id = None` — it skips the task cancel but still gets the durable `finish_run` backstop. This exactly matches the review's CR-01 Fix block.
- `finish_run` promoted to a module-top import (it is a pure DB helper in `db/workflows.py`, no `RUN_TASKS` import-cycle concern), while `_cancel_run_internals` and `publish_cancel_sentinel` stay late-imported to keep the registry off this module's load path (the admin.py:479 discipline).
- Chose the WR-01 fail-closed **409 refuse** over splitting preview counts — the destructive path is the actual blast-radius risk; the read counts remain owner-definition-scoped and low-sensitivity, and the docstring now names that honestly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Route tests exercise `require_visible("workflow_authoring")`, which calls `is_operator` (a live `get_pg_pool` read). Resolved by patching `app.dependencies.is_operator` to `False` — the gate then passes via `workflow_authoring`'s "everyone" audience carve-out with no operator seed, keeping the tests hermetic against the mock/live pool split.

## User Setup Required
None - no external service configuration required. **Operator: restart uvicorn** to load the changed `api/workflows.py` + `db/workflows.py` before the live SC#10 destructive-delete UAT (152-VALIDATION.md row 5).

## Next Phase Readiness
- CR-01 blocker + WR-01 warning are code+test closed; the route test is the automated backstop for CR-01. The manual live SC#10 destructive-delete UAT (152-VALIDATION.md row 5, mid-run delete actually stops the stream) remains the human gate at `/gsd:verify-work 152`.
- Sibling gap plans 152-06 (WR-03 backend) and 152-07 (WR-05/WR-03-fe/WR-04) are disjoint and independent (`wave: 1, depends_on: []`).
- Red lines held: no `threads.py` edit (D-08/G-5), no migration, `run_lifecycle.py` read-only, no new packages.

## Self-Check: PASSED
- FOUND: backend/app/api/workflows.py (producer_id cancel + 409 guard)
- FOUND: backend/app/db/workflows.py (count_foreign_runs_on_global + corrected docstring)
- FOUND: backend/tests/test_152_delete_cascade.py (4 route tests, 8/8 green)
- FOUND commit: cb7cb1e4 (Task 1)
- FOUND commit: c5575789 (Task 2)
- FOUND commit: 9b2e71be (Task 3)
- threads.py ABSENT from plan diff; no supabase/migrations added

---
*Phase: 152-workflow-run-inputs*
*Completed: 2026-07-14*
