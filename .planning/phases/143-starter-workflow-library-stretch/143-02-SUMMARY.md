---
phase: 143-starter-workflow-library-stretch
plan: 02
subsystem: api
tags: [asyncpg, fastapi, workflows, harness, jsonb-predicate, rls-mirroring, pydantic]

# Dependency graph
requires:
  - phase: 143-01
    provides: "the WorkflowDefinition.category schema field + the RED backstops (list_starter_workflows scaffold-exclusion, owned_only symmetry, GET /workflows/starters, scope=mine) this plan turns GREEN"
  - phase: 103-workflows-page-authoring-api
    provides: "list_published_workflows (the is_global OR mine RLS-mirroring predicate + the definition->>'project_folder_id' JSONB-path precedent), get_published_workflows route, PublishedWorkflow + _coerce_definition, create_draft (fork INSERT + 409 mapping)"
  - phase: 098-project-binding-server-side-kb-scope-governance
    provides: "the additive default-off param precedent (project_folder_id) owned_only mirrors"
provides:
  - "list_starter_workflows(pool): curated-globals query WHERE status='published' AND is_global=true AND definition->>'category'='starter' — the Starters shelf feed, excludes the 5 mig-061 dev scaffolds"
  - "additive keyword-only owned_only param on list_published_workflows: True narrows to created_by=$1 (Workflows-page Published shelf), False keeps the byte-identical (is_global OR mine) default for the composer picker / WorkspacePanel / threads.py"
  - "GET /workflows/starters (get_starter_workflows): unscoped curated-globals route, static segment"
  - "scope query param on GET /workflows/published threading owned_only=(scope=='mine')"
affects: [143-04 (Starters shelf + onUseStarter fork consumes GET /workflows/starters + ?scope=mine), 143-03 (seed migration whose category='starter' rows this query surfaces)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSONB-path curation predicate: definition->>'category'='starter' as a $-free constant literal (mirrors the 098 definition->>'project_folder_id' precedent) — no new column, no expression index, zero migration"
    - "Scoped narrowing via additive default-off keyword param (owned_only=False): a shared helper narrows for ONE caller while every other caller stays byte-identical (Pitfall 3 / D-143-2b)"
    - "FastAPI optional-query defaults as bare `= None` (not Query(None)) so direct-call route tests resolve real None, not the truthy Query sentinel"

key-files:
  created: []
  modified:
    - backend/app/db/workflows.py
    - backend/app/api/workflows.py

key-decisions:
  - "owned_only is keyword-only with default False (mirrors the is_golden_run precedent) — the DEFAULT path is provably unchanged, so the composer Harness picker / WorkspacePanel run-soul / threads.py kickoff still see globals (D-143-2b / Pitfall 3)"
  - "the 'starter' category predicate is a constant SQL literal (no $N binding) — no user input reaches the SQL; scope is compared in Python (== 'mine'), never interpolated (V5 / no injection surface)"
  - "changed project_folder_id + scope route defaults from Query(None) to bare None — the Plan-01 RED tests call the route fns directly, where Query(None) is a truthy sentinel that broke the is-not-None branch; bare None preserves the identical FastAPI query-param wire contract (validation + 422-on-malformed)"

patterns-established:
  - "Pattern 1: curated-shelf read = a sibling query (list_starter_workflows) with a constant JSONB-path predicate, NOT a param on the shared list_published_workflows — keeps the shelf feed and the picker feed independently evolvable"
  - "Pattern 2: de-dupe a shared shelf via scoped narrowing (owned_only), never a blanket predicate change — the default stays byte-identical and a Wave-0 symmetry test guards it"

requirements-completed: []  # WF-01 is phase-spanning (5 plans); Plan 02 delivers the read side only

# Metrics
duration: 9min
completed: 2026-07-10
---

# Phase 143 Plan 02: Starters Shelf Read Side (list_starter_workflows + scoped Published de-dupe) Summary

**Shipped the read side of the Starters shelf — a curated-globals query (`list_starter_workflows`) plus a scoped Published-shelf de-dupe (`owned_only`/`?scope=mine`), exposed as `GET /workflows/starters` and a `scope` param — turning all four Plan-01 backend RED backstops GREEN while keeping the shared `list_published_workflows` default byte-identical for the picker / run-soul / threads.py.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-10T05:57:57Z
- **Completed:** 2026-07-10T06:07:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `list_starter_workflows(pool)` — the Starters shelf feed: `status='published' AND is_global=true AND definition->>'category'='starter'`, ORDER BY name. Returns the seeded curated starters and EXCLUDES the 5 mig-061 dev scaffolds (they lack the `category` marker — D-143-2a). The `'starter'` literal is a `$`-free constant (T-143-01 / V5 — no injection surface).
- Additive keyword-only `owned_only: bool = False` on `list_published_workflows`: `True` narrows to `created_by=$1` (dropping the bare `is_global`) for the Workflows-page Published shelf; `False` (the DEFAULT) keeps the exact `(is_global=true OR created_by=$1)` predicate the composer picker / `WorkspacePanel` run-soul / `threads.py` kickoff rely on (D-143-2b / Pitfall 3). The `project_folder_id` AND-append + `ORDER BY name` apply to both branches.
- `GET /workflows/starters` (`get_starter_workflows`): a thin, unscoped delegate mapping rows through the existing `PublishedWorkflow` + `_coerce_definition` shape; declared as a static segment.
- `scope` query param on `GET /workflows/published` threading `owned_only=(scope == "mine")` — the Workflows-page shelf passes `?scope=mine`; every other caller omits it and keeps globals.

## Task Commits

Each task was committed atomically:

1. **Task 1: list_starter_workflows + additive owned_only param** - `85f616b5` (feat)
2. **Task 2: GET /workflows/starters + scope=mine on GET /workflows/published** - `01577474` (feat)

**Plan metadata:** (this commit) `docs(143-02): complete Starters shelf read-side plan`

## Files Created/Modified
- `backend/app/db/workflows.py` - Added `list_starter_workflows` (curated-globals JSONB-path query) + the keyword-only `owned_only` param on `list_published_workflows` (default-off scoped narrowing). `create_workflow_definition` and every other helper untouched.
- `backend/app/api/workflows.py` - Added `GET /workflows/starters` (`get_starter_workflows`) + the `scope` param on `get_published_workflows` (threaded to `owned_only`); imported `list_starter_workflows`; changed `project_folder_id`/`scope` defaults from `Query(None)` to bare `None` and dropped the now-unused `Query` import. `create_draft` / fork route untouched.

## Decisions Made
- Placed the Starters feed in its OWN query (`list_starter_workflows`) rather than as a mode of `list_published_workflows` — the shelf feed (curated globals, no user scope) and the picker feed (owner-scoped) evolve independently, and the curated predicate stays a constant literal.
- Kept `owned_only` default `False` (keyword-only, `is_golden_run` precedent) so the de-dupe is SCOPED — the Wave-0 symmetry test (`test_published_owned_only_and_default`) proves the default path still returns globals for the three shared consumers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Query(None)` route defaults broke the Plan-01 direct-call tests**
- **Found during:** Task 2 (GET /workflows/published?scope=mine)
- **Issue:** The Plan-01 RED backstop `test_published_scope_mine_narrows` calls the route fn directly (`wf_api.get_published_workflows(scope="mine", current_user=...)`) — the RESEARCH/Plan-01 route-testing pattern. On a direct call, the un-injected `project_folder_id` default is the `Query(None)` **sentinel object** (a `fastapi.params.Query` instance), for which `is not None` is `True`. That fired the `list_published_workflows` project-filter branch with `str(Query_object)` as the bound value, matching zero rows → the route returned an empty list → the test asserted `own_slug in set()` and failed. This blocked Task 2's acceptance criterion (`?scope=mine` test GREEN).
- **Fix:** Changed the `project_folder_id` and `scope` route defaults from `Query(None)` to bare `= None`. FastAPI treats a singular-type param (`UUID | None` / `str | None`) with a bare `None` default as an optional query parameter with the identical wire contract (still parsed from the query string, still 422 on a malformed UUID, same OpenAPI). Direct calls now get real `None`. Dropped the now-unused `Query` import (its only two uses were these params) to avoid an unused-import lint my change would otherwise introduce.
- **Files modified:** backend/app/api/workflows.py
- **Verification:** `test_published_scope_mine_narrows` + all 3 integration route tests GREEN; confirmed `Query(None) is not None` → `True` empirically and reproduced the empty-result via a scratch script before/after the fix.
- **Committed in:** `01577474` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required to satisfy the plan's own acceptance criteria (the Plan-01 direct-call RED test). It is a minimal, idiomatic FastAPI change that preserves the existing HTTP behavior of `get_published_workflows` (verified the `definition` response shape and query-param semantics are unchanged). No scope creep — `create_draft` / `create_workflow_definition` / the fork route all diff-clean.

## Issues Encountered
- **Pre-existing test rot (out of scope, NOT fixed):** the wave-merge regression check (`pytest backend/tests -k workflows`) surfaced one failure, `tests/test_dual_mode_wiring.py::test_published_workflows_list_endpoint`. It asserts the `/workflows/published` body has no `definition` key, but the endpoint returns `definition: None` — the additive `definition` field added in **Phase 103-06**, present at HEAD before this plan (`git show HEAD:backend/app/api/workflows.py` line 136 / line 79). Plan 02 does not alter the `get_published_workflows` response shape, so this failure predates and is unrelated to this work. Logged to `.planning/phases/143-starter-workflow-library-stretch/deferred-items.md` for a later `/gsd:quick`-scale test-rot fix. Git emitted cosmetic `LF will be replaced by CRLF` warnings (Windows autocrlf) — expected, no action.

## Threat Flags
None. The two plan-level trust boundaries are mitigated exactly as the threat register prescribes: T-143-01 — `list_starter_workflows` returns ONLY `is_global=true` published rows (world-readable by the mig-056 SELECT policy) filtered to `category='starter'`, so no private row can appear; T-143-04 — `owned_only` is additive default-OFF and the default path is byte-identical (asserted by `test_published_owned_only_and_default`); V5 — the `category='starter'` predicate is a constant literal and `scope` is compared in Python (`== "mine"`), never interpolated (`user_id`/`project_folder_id` remain the only `$N` bindings). No new network surface, auth path, file access, or schema-at-trust-boundary was introduced beyond the two planned read routes.

## Known Stubs
None. This plan adds one read query, one additive param, and two thin read routes — no UI data-source stubs, placeholders, or hardcoded empty values that flow to rendering. (The frontend that consumes these — the Starters shelf + `onUseStarter` fork — is Plan 04.)

## User Setup Required
None - no external service configuration required. (The seed migration 094 + storage-seed that populate the `category='starter'` rows this query surfaces is Plan 03; until then `GET /workflows/starters` returns an empty list against a fresh DB — the query and routes are correct and tested.)

## Next Phase Readiness
- Plan 04 (frontend) has its backend contract: `GET /workflows/starters` (curated globals) and `GET /workflows/published?scope=mine` (mine-only de-dupe). The `frontend/src/lib/api.ts` `listStarterWorkflows()` client + the `scope` option on `listPublishedWorkflows` can now be wired against real routes; the `onUseStarter` fresh-copy fork reuses `createWorkflowDraft` → `POST /workflows` (the 409-collision path is pinned GREEN by `test_fork_slug_version_collision_maps_409`).
- Plan 03 (seed migration 094 + storage-seed) will emit the `category='starter'` rows this query filters on; once applied via the Supabase SQL editor, `GET /workflows/starters` returns the 3 curated starters.

## Self-Check: PASSED

## Task Commits Reference
- Task 1: `85f616b5` — feat(143-02): list_starter_workflows + additive owned_only param
- Task 2: `01577474` — feat(143-02): GET /workflows/starters + scope=mine on GET /workflows/published

---
*Phase: 143-starter-workflow-library-stretch*
*Completed: 2026-07-10*
