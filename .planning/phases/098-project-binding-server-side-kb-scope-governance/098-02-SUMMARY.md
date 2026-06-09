---
phase: 098-project-binding-server-side-kb-scope-governance
plan: 02
subsystem: api
tags: [fastapi, asyncpg, jsonb, workflows, project-binding, postgres]

# Dependency graph
requires:
  - phase: 092
    provides: "list_published_workflows db helper + GET /workflows/published route (the picker feed this plan extends)"
provides:
  - "GET /workflows/published?project_folder_id=<uuid> — published-workflows library is now queryable per project"
  - "list_published_workflows(pool, *, user_id, project_folder_id=None) — optional JSONB-path filter on definition->>'project_folder_id' (zero-migration)"
  - "Offline filter unit tests proving the predicate + TEXT-bound param appear only when filtered, and user-scope is preserved"
affects: [phase-103-workflows-library-page, project-binding, kb-scope-governance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSONB-path predicate filter on an existing jsonb column (definition->>'key' = $N, bound as TEXT) — zero-migration queryability at current scale"
    - "Additive-only AND-appended WHERE clause: user-scope clause stays first and untouched so a filter can only narrow, never widen, visibility"

key-files:
  created: []
  modified:
    - backend/app/db/workflows.py
    - backend/app/api/workflows.py
    - backend/tests/test_thread_workflow_endpoint.py

key-decisions:
  - "Zero-migration: filter via definition->>'project_folder_id' JSONB-path predicate on the existing jsonb column — no new column, no expression index (RESEARCH §5/§6, sufficient at current scale)"
  - "Bind the folder id as str (TEXT) because definition->>'key' returns TEXT; only the placeholder INDEX $N is f-string-built (a code-derived int), never the value — no SQL injection surface (T-098-10)"
  - "User-scope clause (is_global OR created_by=$1) stays first and unchanged; project filter is AND-appended so it cannot widen visibility (T-098-09 / V4)"

patterns-established:
  - "Optional narrowing filter on a list helper: append the predicate only when the kwarg is provided; omitting it keeps the query byte-identical to the pre-filter version (backward compatible)"

requirements-completed: [PROJ-01]

# Metrics
duration: ~12min
completed: 2026-06-09
---

# Phase 098 Plan 02: Project-Queryable Published Workflows Library Summary

**`GET /workflows/published?project_folder_id=<uuid>` now returns only published definitions bound to that project folder, via an additive JSONB-path predicate on the existing `definition` column — zero-migration, user-scope preserved.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-09T13:58Z (approx)
- **Completed:** 2026-06-09T14:10:02Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `list_published_workflows` gained an optional `project_folder_id: UUID | None = None` kwarg that AND-appends `definition->>'project_folder_id' = $N` (bound as TEXT) only when supplied — the queryable half of PROJ-01 / D-03 ("a project owns a library of workflows").
- `GET /workflows/published` gained a `project_folder_id: UUID | None = Query(None)` param, threaded through to the db helper; FastAPI coerces the raw query string to `UUID` (422 on malformed) before it reaches the DB layer.
- Two offline filter unit tests prove the JSONB-path predicate + the `str(P)` TEXT-bound param appear only when filtered (and that user-scope stays first), and that omitting the param leaves the query backward-compatible.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the project_folder_id JSONB-path filter + the route query param** - `569cb2f9` (feat)
2. **Task 2: Offline filter test (mock pool asserts the JSONB predicate + bound param)** - `0ae0ce90` (test)

_Note: Task 2 is marked `tdd="true"` in the plan, but the plan orders implementation (Task 1) before the test (Task 2), so the test was authored GREEN against the already-shipped filter — there was no separate RED commit. See TDD Gate Compliance below._

## Files Created/Modified
- `backend/app/db/workflows.py` - `list_published_workflows` now accepts `project_folder_id`; builds the SQL conditionally, appending the JSONB-path predicate (TEXT-bound positional param) only when provided. User-scope WHERE clause untouched.
- `backend/app/api/workflows.py` - `get_published_workflows` accepts `project_folder_id: UUID | None = Query(None)` and passes it through; imports `Query`.
- `backend/tests/test_thread_workflow_endpoint.py` - added `test_list_published_workflows_project_filter` and `test_list_published_workflows_no_filter_omits_predicate` (offline, introspect `mock_asyncpg_pool.calls`).

## Decisions Made
- **Zero-migration filter** via `definition->>'project_folder_id'` on the existing `jsonb` column — no new column/index (RESEARCH §5/§6; sufficient at current scale). Avoids the conditional `067_*` migration entirely.
- **TEXT-bind the value** (`str(project_folder_id)`) because `definition->>'key'` yields TEXT; the value rides a positional `$N` param. Only the placeholder index `$N` (a code-derived int via `len(params)`) is f-string-built — no value interpolation, so no SQL-injection surface (T-098-10 / V5).
- **Narrow-only semantics:** the `is_global = true OR created_by = $1` user-scope clause stays first and unchanged; the project filter is AND-appended (T-098-09 / V4 — a caller cannot see another user's private workflow by guessing a `project_folder_id`). A test asserts the user-scope clause precedes the JSONB predicate in the emitted SQL.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The worktree has no `venv` and no `backend/.env` (both gitignored), so the import smoke-test and pytest run used the shared-checkout venv interpreter (`backend/venv/Scripts/python.exe`) with the worktree backend as cwd. `Settings()` requires two env fields at module import; supplied dummy `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` values inline (import-only smoke-test — no network, no secrets exposed). Resolved; not a code issue.

## TDD Gate Compliance
Task 2 carries `tdd="true"`, but the plan deliberately orders implementation (Task 1) ahead of the test (Task 2). The test therefore landed GREEN against the already-shipped filter — there is a `feat(...)` commit (`569cb2f9`) followed by a `test(...)` commit (`0ae0ce90`), rather than a RED `test` → GREEN `feat` sequence. This matches the plan's task ordering and is not a strict RED/GREEN cycle. No plan-level `type: tdd` gate applies (plan `type: execute`). The offline tests pass (7/7 in the file; the plan's `-k project_filter -x` selector is green).

## Verification
- `cd backend && python -m pytest tests/test_thread_workflow_endpoint.py -k project_filter -x` — green (1 passed, 6 deselected).
- Full file: 7 passed (5 pre-existing + 2 new) — no regressions.
- Import smoke-test: `import app.api.workflows, app.db.workflows` exits 0.
- No SQL file added under `supabase/migrations/` (confirmed via `git diff --name-only` — empty).
- No file deletions in either commit.

## Acceptance Criteria (plan)
- [x] `db/workflows.py` `list_published_workflows` signature contains `project_folder_id: UUID | None = None`
- [x] `db/workflows.py` contains the literal `definition->>'project_folder_id'`
- [x] `db/workflows.py` still contains `is_global = true OR created_by = $1` (user-scope preserved)
- [x] `api/workflows.py` contains `project_folder_id: UUID | None = Query(None)` and passes `project_folder_id=project_folder_id`
- [x] No SQL file added under `supabase/migrations/`
- [x] Import check exits 0
- [x] `test_list_published_workflows_project_filter` + `test_list_published_workflows_no_filter_omits_predicate` defined; filter test asserts `str(P)` text-bound; no-filter test asserts predicate absent

## Next Phase Readiness
- The library is now filterable to a project at the API/data layer (SC#1 — the library-filter half of PROJ-01). Phase 103 builds the Workflows library *page* UI on top of this queryable capability.
- No blockers. The optional `067_*` migration was correctly NOT created (zero-migration path).

## Self-Check: PASSED
- FOUND: backend/app/db/workflows.py
- FOUND: backend/app/api/workflows.py
- FOUND: backend/tests/test_thread_workflow_endpoint.py
- FOUND: .planning/phases/098-.../098-02-SUMMARY.md
- FOUND commit: 569cb2f9 (Task 1, feat)
- FOUND commit: 0ae0ce90 (Task 2, test)

_Note (worktree mode): per the plan objective, STATE.md and ROADMAP.md are NOT updated here — the orchestrator owns those writes after all wave agents complete. PROJ-01 is only partially addressed by this plan (SC#1 = the library-filter half); requirement completion is left to the orchestrator's post-wave reconciliation. `requirements-completed` frontmatter copies the plan's `requirements` field per the template convention._

---
*Phase: 098-project-binding-server-side-kb-scope-governance*
*Completed: 2026-06-09*
