---
phase: 143-starter-workflow-library-stretch
plan: 01
subsystem: testing
tags: [pydantic, fastapi, asyncpg, vitest, workflows, harness, schema-lock]

# Dependency graph
requires:
  - phase: 098-project-binding-server-side-kb-scope-governance
    provides: the additive-optional schema-lock precedent (project_folder_id/assets/business_requirement) that category mirrors
  - phase: 103-workflows-page-authoring-api
    provides: create_workflow_definition + create_draft (the fork INSERT path), list_published_workflows, the WorkflowsPage two-shelf layout + test scaffolding
provides:
  - "WorkflowDefinition.category (str | None = None) — the D-143-2 Starters-shelf curation marker; additive-optional, zero-migration, extra=forbid intact"
  - "backend RED backstops: list_starter_workflows scaffold-exclusion (SC-a) + list_published_workflows owned_only symmetry (SC-b)"
  - "backend RED backstops: GET /workflows/starters + GET /workflows/published?scope=mine narrowing, plus a green create-collision 409 fork backstop"
  - "frontend RED backstops: Starters shelf render + onUseStarter fresh-copy fork (new slug + v1) + section-order fold (BUG-260628-01)"
affects: [143-02 (list_starter_workflows + owned_only + routes), 143-04 (Starters shelf + onUseStarter fork), 143-03 (seed migration carrying category=starter)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-optional schema lock (098 precedent) extended: one str|None field on a extra=forbid model, no migration, old JSONB rows validate to None"
    - "Wave 0 RED backstops: imports inside test bodies (Phase 102 posture) so --collect-only stays clean and RED surfaces at runtime on the absent symbol"

key-files:
  created:
    - backend/tests/unit/test_starter_workflows.py
    - backend/tests/integration/test_workflows_routes.py
  modified:
    - backend/app/models/harness.py
    - frontend/src/pages/WorkflowsPage.test.tsx

key-decisions:
  - "category lives on the top-level WorkflowDefinition only (not any inner phase-config) — that is where D-143-2's definition->>'category' predicate reads it"
  - "The fork-collision 409 test is a GREEN regression backstop (create_draft already maps UniqueViolationError → 409), not a RED target — only starters/scope/owned_only are the absent Plan 02 symbols"
  - "requirements-completed left empty: WF-01 is a phase-spanning requirement satisfied only when all 5 plans land; Wave 0 does not complete it"

patterns-established:
  - "Pattern 1: category-vs-extra=forbid schema lock — mirror the 098 additive-optional block so both the seed model_validate and the fork round-trip stop 422ing on the curation key"
  - "Pattern 2: RED backstop authoring — seed a real :54322 row, assert the intended behavior, and let the absent Plan 02 symbol (ImportError/AttributeError/TypeError) be the RED, never a test bug"

requirements-completed: []  # WF-01 is phase-spanning (5 plans); Wave 0 lands the schema contract + RED targets only

# Metrics
duration: 8min
completed: 2026-07-10
---

# Phase 143 Plan 01: Wave 0 Schema Contract + RED Backstops Summary

**Added the load-bearing additive-optional `category` field to WorkflowDefinition (the Starters-shelf curation marker) and landed the three Wave 0 RED test files that encode SC-a/SC-b/SC-c/SC-e as failing targets for Plans 02/04.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-10T05:45:43Z
- **Completed:** 2026-07-10T05:54Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `WorkflowDefinition.category: str | None = None` — mirrors the 098 additive-optional lock: a starter definition carrying `category:'starter'` round-trips through `create_draft` without a 422, while every OTHER unknown key still 422s (extra=forbid intact) and old JSONB rows validate to `category=None`.
- Backend RED backstops (`test_starter_workflows.py`): SC-a (`list_starter_workflows` excludes the 5 mig-061 scaffolds) + SC-b (`owned_only` narrows to mine while the DEFAULT keeps globals — the Pitfall-3 symmetry guard for the composer picker / WorkspacePanel / threads.py).
- Backend RED backstops (`test_workflows_routes.py`): `GET /workflows/starters` + `GET /workflows/published?scope=mine` narrowing (RED) plus a GREEN fork-collision 409 backstop.
- Frontend RED backstops (`WorkflowsPage.test.tsx`): Starters shelf render (card + Starter/Official chip + `use-starter`), `onUseStarter` fresh-copy fork (new suffixed slug + v1 + draft, INSERT never UPDATE), section-order fold (Starters → Published → Drafts, BUG-260628-01).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add additive-optional `category` field to WorkflowDefinition** - `3225f3c4` (feat)
2. **Task 2: Backend Wave 0 RED backstops — starters query + scope symmetry + route round-trips** - `bb21580e` (test)
3. **Task 3: Frontend Wave 0 RED backstops — Starters shelf render, fork, section order** - `906f2a73` (test)

**Plan metadata:** (this commit) `docs(143-01): complete Wave 0 schema + RED backstops plan`

## Files Created/Modified
- `backend/app/models/harness.py` - Added `category: str | None = None` to `WorkflowDefinition` alongside the 098 additive-optional lock block; did NOT touch either `@model_validator` or relax `extra="forbid"`.
- `backend/tests/unit/test_starter_workflows.py` - NEW: SC-a scaffold-exclusion + SC-b owned_only/default symmetry, live :54322 with a psycopg2 skip-guard, seeded rows cleaned up in `finally`.
- `backend/tests/integration/test_workflows_routes.py` - NEW: `get_starter_workflows` + `scope="mine"` narrowing (RED) + create-collision 409 (green), patched `get_pg_pool` route-fn calls.
- `frontend/src/pages/WorkflowsPage.test.tsx` - EXTENDED: `listStarterWorkflows` mock seam + `starterRow` fixture + 3 RED blocks.

## Verification

- **Task 1:** `category` present with default `None`; `category:'starter'` validates and round-trips; a def with any other unknown key still raises `ValidationError` — `OK: category accepted + round-trips, bogus still rejected`.
- **Task 2:** `--collect-only` clean (5 tests). Running the files RED-fails exactly on the absent Plan 02 symbols: `ImportError: cannot import name 'list_starter_workflows'` (SC-a), `TypeError: ... unexpected keyword argument 'owned_only'` (SC-b), `AttributeError: ... no attribute 'get_starter_workflows'` (endpoint), `TypeError: get_published_workflows() got an unexpected keyword argument 'scope'` (scope). The fork-collision 409 test passes green. Result: 4 failed (RED as designed) / 1 passed.
- **Task 3:** `npx vitest run src/pages/WorkflowsPage.test.tsx` → 3 failed (the new RED blocks, all on the absent `starters-shelf`) / 20 passed (every pre-existing WorkflowsPage test intact).

## Decisions Made
- Placed `category` on the top-level `WorkflowDefinition` only (not any inner phase-config) — the `definition->>'category'` shelf predicate reads it there (D-143-2).
- Left `requirements-completed` empty: WF-01 spans all 5 plans; Wave 0 delivers the enabling schema contract + RED targets, not the shipped feature. Marking WF-01 complete now would be dishonest.
- Treated the fork-collision 409 test as a GREEN regression backstop (the `create_draft` 409 mapping already exists) rather than a RED target — the plan's RED set is exactly `list_starter_workflows` / `owned_only` / `get_starter_workflows` / `scope`.

## Deviations from Plan

None - plan executed exactly as written. No auto-fixes (Rules 1-3) were needed; no architectural decisions (Rule 4) arose. No package installs. No CLAUDE.md-driven adjustments.

## Issues Encountered
None. Git emitted cosmetic `LF will be replaced by CRLF` warnings on the new/edited files (Windows autocrlf) — expected, no action needed.

## Threat Flags
None. The one plan-level trust boundary (client → API fork body carrying `category`) is mitigated exactly as the threat register (T-143-02) prescribes: `category` is the ONLY field added; `extra="forbid"` stays, and Task 1's verify asserts both halves. No new network endpoint, auth path, file-access pattern, or schema-at-trust-boundary surface was introduced beyond the planned additive field.

## Known Stubs
None. This plan adds one schema field and three test files; no UI data-source stubs, placeholders, or hardcoded empty values that flow to rendering.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 has a green schema contract (`category`) and RED targets to turn green: `list_starter_workflows` (SC-a), the `owned_only` param on `list_published_workflows` (SC-b), `GET /workflows/starters` (`get_starter_workflows`), and `scope=mine` on `GET /workflows/published`.
- Plan 04 has RED frontend targets: the `starters-shelf` / `starter-card` / `use-starter` contract, the `onUseStarter` fresh-copy fork slug shape `/^risk-register-[a-z0-9]{6}$/` + v1, and the Starters → Published → Drafts section order. NOTE: the pre-existing "Drafts shelf renders ABOVE the Published shelf" test (green today) will need updating in Plan 04 when the sections are reordered — the two are intentionally contradictory (current vs target order).
- Plan 03 seed migration must emit `category:"starter"` inside each starter's definition JSONB (now schema-valid) and apply the D-143-4b transforms (strip project_folder_id/folder_scope, re-home template asset_id).

## Self-Check: PASSED

All 5 claimed files exist on disk (harness.py, both new backend test files, WorkflowsPage.test.tsx, this SUMMARY) and all 3 task commits (`3225f3c4`, `bb21580e`, `906f2a73`) are present in the git log.

---
*Phase: 143-starter-workflow-library-stretch*
*Completed: 2026-07-10*
