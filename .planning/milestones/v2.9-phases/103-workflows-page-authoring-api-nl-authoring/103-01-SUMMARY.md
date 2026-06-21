---
phase: 103-workflows-page-authoring-api-nl-authoring
plan: 01
subsystem: api
tags: [fastapi, asyncpg, pydantic, workflows, draft-crud, rls, postgres, immutability-trigger]

# Dependency graph
requires:
  - phase: 102-reusable-validation-gate-library-output-quality-gate
    provides: the publish_service.publish gauntlet + PublishVerdict this plan's lint-block confirms; the get_definition owner-scoped read + publish_definition flip the CRUD fns mirror
  - phase: 098-project-folder-binding
    provides: the additive-optional JSONB schema-lock precedent PhaseSpec.name follows
provides:
  - additive-optional PhaseSpec.name field (REQ-3, zero migration — serializes into the definition JSONB)
  - Settings.harness_authoring_model config knob (D-103-2 / WFAUTH-02) for Plan 02 NL-gen
  - 4 draft-CRUD DB fns (create/list/update/delete_workflow_definition) — owner-scoped, $N-only
  - 4 draft-CRUD routes on the existing /workflows router (POST create / GET drafts / PATCH / DELETE) with 23514->409 mapping
  - the 8 Wave-0 backend test_103_*.py files (some GREEN, the NL-gen/grounding stubs xfail for Plan 02)
affects: [103-02 (NL-gen consumes harness_authoring_model + fills nl_generate/grounding stubs), 103-04 (Builder PATCHes drafts), 103-06 (Workflows page lists/forks drafts + launches)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner-scoped RLS-mirroring draft reads ($N-only, status='draft' AND created_by=$1)"
    - "Published-row freeze proven two ways: status='draft' WHERE guard -> 404 (no mutation) + route try/except CheckViolationError (23514) -> 409"
    - "Server-forced draft invariants (status='draft'/is_global=false/created_by) — never trust the client body"
    - "Tweak fork = create v(N+1) INSERT, never UPDATE the frozen published row"

key-files:
  created:
    - backend/tests/unit/test_103_phasespec_name.py
    - backend/tests/unit/test_103_draft_crud.py
    - backend/tests/unit/test_103_published_409.py
    - backend/tests/unit/test_103_lint_block.py
    - backend/tests/unit/test_103_tweak_fork.py
    - backend/tests/unit/test_103_nl_generate.py
    - backend/tests/unit/test_103_grounding_fidelity.py
  modified:
    - backend/app/models/harness.py
    - backend/app/config.py
    - backend/app/db/workflows.py
    - backend/app/api/workflows.py

key-decisions:
  - "Published-row freeze is the status='draft' WHERE guard FIRST (owner's published-row PATCH/DELETE -> 0 rows -> 404, row unchanged); the route try/except CheckViolationError -> 409 is the second backstop for the TOCTOU-race path the guard can't catch. Both are live-proven against :54322."
  - "delete_draft carries NO -> None return annotation (the delete_folder 204 precedent) — a 204 route must not declare a response body."
  - "Bare asyncpg test pool returns definition JSONB as a string (the live app pool has a codec); tests normalize with json.loads when needed."

patterns-established:
  - "Pattern 1: draft-CRUD DB fns mirror the in-file owner-scoped $N-only precedent (get_definition / list_published_workflows / create_workflow_run); no f-string-built SQL beyond the existing ${len(params)} index."
  - "Pattern 2: the 23514->409 mapping mirrors the already_published->409 line in publish_workflow; the trigger is the source of truth, the route maps the exception."

requirements-completed: [WFAUTH-01]

# Metrics
duration: 38min
completed: 2026-06-14
---

# Phase 103 Plan 01: Draft-CRUD API + additive PhaseSpec.name + authoring-model knob Summary

**Owner-scoped draft-CRUD (4 DB fns + 4 routes on the existing /workflows router) with the published-row freeze proven two ways (status='draft' guard -> 404 + CheckViolationError 23514 -> 409), plus the additive-optional PhaseSpec.name field and the harness_authoring_model config knob, on the 8 Wave-0 backend test scaffolds.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-06-14 (Phase 103 execution start)
- **Completed:** 2026-06-14
- **Tasks:** 3
- **Files modified:** 11 (4 source + 7 new test files)

## Accomplishments
- **REQ-3 additive PhaseSpec.name** — `name: str | None = None` on `PhaseSpec`; serializes into the existing `definition` JSONB, pre-103 rows `model_validate()` with it absent, ZERO migration. Live-proven: pre-103 compat + round-trip + `extra='forbid'` strict floor.
- **D-103-2 harness_authoring_model knob** — `Settings.harness_authoring_model: str | None = None` added immediately after `harness_judge_model`; the NL-gen authoring model Plan 02 resolves.
- **REQ-1 draft CRUD** — 4 DB fns (`create_workflow_definition` / `list_draft_workflows` / `update_workflow_definition` / `delete_workflow_definition`) mirror the in-file owner-scoped `$N`-only precedent; 4 routes on the EXISTING `/workflows` router (POST `""` create 201, GET `/drafts`, PATCH/DELETE `/{id}`); status forced server-side; the published-row freeze proven LIVE (404 + no mutation) and the 23514->409 mapping proven (genuine CheckViolationError).
- **REQ-7 Tweak fork** — `create_workflow_definition` with `version=N+1` (INSERT, never UPDATE the frozen row); two published rows for the same slug proven live (UNIQUE(slug,version) satisfied).
- **REQ-1 lint-block** — confirmed the EXISTING `publish_service.publish` path blocks a lint-failing draft with `published=false`, `blocked_stage='lint'`, lowercase codes (no new lint path).
- **8 Wave-0 test files** — `test_103_*.py` authored; phasespec_name/draft_crud/published_409/lint_block/tweak_fork GREEN; nl_generate (5 cases) + grounding_fidelity (2 cases) xfail for Plan 02 to fill.

## Task Commits

Each task was committed atomically:

1. **Task 1: additive PhaseSpec.name + harness_authoring_model knob + 8 Wave-0 test files** - `a9ccc7f6` (feat)
2. **Task 2: draft-CRUD DB fns (create/list/update/delete) + Tweak-fork v(N+1)** - `c96456f6` (feat, TDD GREEN)
3. **Task 3: draft-CRUD routes (POST/GET-drafts/PATCH/DELETE) + 23514->409** - `f7e8c653` (feat, TDD GREEN)

_Note: TDD tasks 2/3 reused the Task-1 RED scaffolds (xfail) and un-xfailed them to GREEN in their own feat commits, so each is a single atomic commit rather than separate test/feat commits._

## Files Created/Modified
- `backend/app/models/harness.py` - added `PhaseSpec.name: str | None = None` (REQ-3 additive-optional)
- `backend/app/config.py` - added `Settings.harness_authoring_model: str | None = None` (D-103-2) after `harness_judge_model`
- `backend/app/db/workflows.py` - added 4 owner-scoped draft-CRUD fns ($N-only, status='draft' freeze guard, trigger-propagation docstrings)
- `backend/app/api/workflows.py` - added `DraftCreateResponse`/`DraftRow` models + 4 routes on the existing router; PATCH/DELETE catch `CheckViolationError`->409
- `backend/tests/unit/test_103_phasespec_name.py` - GREEN: pre-103 compat + JSONB round-trip + strict extra-forbid
- `backend/tests/unit/test_103_draft_crud.py` - GREEN (live :54322): DB-fn CRUD + owner-scope + route round-trip (status forced)
- `backend/tests/unit/test_103_published_409.py` - GREEN (live :54322): published-row freeze (404 + no mutation) + route 23514->409 mapping
- `backend/tests/unit/test_103_lint_block.py` - GREEN: confirms the existing publish lint-block path (lowercase codes)
- `backend/tests/unit/test_103_tweak_fork.py` - GREEN (live :54322): create v(N+1) -> two published rows
- `backend/tests/unit/test_103_nl_generate.py` - xfail stubs (Plan 02): one-call/retry-once/no-strict/honest-fail/route-delegation
- `backend/tests/unit/test_103_grounding_fidelity.py` - xfail stubs (Plan 02): folder ⊆ subtree + tools/skills ∈ registry

## Decisions Made
- **Published-row freeze layering:** The DB fn's `status='draft'` WHERE guard makes an owner's already-published-row PATCH/DELETE a 0-row no-op -> `None`/`False` -> the route raises **404** (the row is verifiably unchanged — the security-meaningful outcome). The route's `try/except CheckViolationError -> 409` is the second backstop for the TOCTOU-race path the guard can't pre-empt (a draft flips to published between WHERE-eval and write). Both are required by the plan (Task 2 docstrings + the key_links/threat-model) and both are live-proven.
- **204 route annotation:** `delete_draft` carries no `-> None` annotation (matches the `delete_folder` 204 precedent) — FastAPI's "Status code 204 must not have a response body" assertion fires on a `-> None` annotation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 204 DELETE route rejected by FastAPI's response-body assertion**
- **Found during:** Task 3 (draft routes)
- **Issue:** `delete_draft` with `-> None` + `status_code=204` raised `AssertionError: Status code 204 must not have a response body` at import time, wedging the whole app import (and the test collection).
- **Fix:** Removed the `-> None` return annotation (matching the in-repo `delete_folder` 204 precedent); the function still `return None`.
- **Files modified:** backend/app/api/workflows.py
- **Verification:** App imports; all 6 /workflows routes register; the route round-trip test asserts `delete_draft(...) is None`.
- **Committed in:** `f7e8c653` (Task 3 commit)

**2. [Rule 1 - Bug] published_409 test expected 409 where the live behavior is 404**
- **Found during:** Task 3 (published_409 tests)
- **Issue:** The Task-1 stub asserted an owner's published-row PATCH/DELETE -> 409. But the `status='draft'` WHERE guard (mandated by the Task-2 docstrings) makes that a 0-row no-op -> 404; the 23514 trigger only fires WITHOUT the guard (proven by a direct DB probe). The stub's expectation contradicted the plan's own fn contract.
- **Fix:** Restructured the test to prove BOTH real outcomes: (a) LIVE — the owner's published row is immutable via the routes (404 + re-read unchanged / row survives); (b) the route's 23514->409 mapping is correct (driven by patching the DB fn to raise the genuine `CheckViolationError`). This satisfies the T-103-01-02 / key_links contract honestly.
- **Files modified:** backend/tests/unit/test_103_published_409.py
- **Verification:** 4 cases GREEN against :54322; direct DB probe confirmed CASE A (with guard) -> None, CASE B (no guard) -> CheckViolationError 23514.
- **Committed in:** `f7e8c653` (Task 3 commit)

**3. [Rule 1 - Bug] draft_crud round-trip read assumed a dict from a bare asyncpg pool**
- **Found during:** Task 2 (draft_crud update test)
- **Issue:** `get_definition`'s docstring says asyncpg decodes the `definition` JSONB to a dict, but a bare `asyncpg.create_pool` (the test harness) has no JSONB codec and returns it as a JSON STRING -> `TypeError: string indices must be integers`. The live app pool decodes it; the test harness does not.
- **Fix:** Normalized the test read with `json.loads` when `definition` is a string (and additionally asserted the top-level `name` column round-tripped).
- **Files modified:** backend/tests/unit/test_103_draft_crud.py
- **Verification:** draft_crud + tweak_fork 4 GREEN against :54322.
- **Committed in:** `c96456f6` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 test-correctness bugs)
**Impact on plan:** All three are test-harness / framework realities, not scope changes. The production fns + routes match the plan's specified contracts exactly (the `status='draft'` guard + the 23514->409 try/except are both present). No scope creep; threads.py + anthropic_service.py byte-identical to base.

## Issues Encountered
- None beyond the deviations above. The local Supabase :54322 stack was reachable, so the live-DB tests run GREEN (not merely skip).

## TDD Gate Compliance
Tasks 2/3 are `tdd="true"`. The RED scaffolds landed in Task 1's commit (`a9ccc7f6`, the 8 xfail test files); Tasks 2/3 implemented the fns/routes and un-xfailed the relevant files to GREEN in their own `feat` commits. The RED -> GREEN gate is satisfied across commits (RED = the xfail scaffolds in `a9ccc7f6`; GREEN = `c96456f6` / `f7e8c653`). No separate `test(...)` commit because the plan front-loads all 8 test files into Task 1 (the Wave-0 scaffold task), per the VALIDATION.md Wave-0 design.

## Test Results
- **Plan target suite** (`test_103_phasespec_name / draft_crud / published_409 / lint_block / tweak_fork / nl_generate / grounding_fidelity`): **13 passed, 7 xfailed** (the 7 xfails = Plan-02-filled nl_generate(5) + grounding_fidelity(2)). Exit 0.
- **Wider slice** (publish_service / publish_flip / harness_reachability / thread_workflow_endpoint / audit / 098_schema_lock / harness_engine): **88 passed, 0 failed**.
- **Net-new failures = 0 (base-checkout proven):** the full `tests/unit/` slice shows 15 unrelated rot files failing IDENTICALLY at HEAD and at base `0cfae5a3` (sql_service, streaming_reliability, sandbox, retrieval, extraction, db_runs, etc. — documented SEED-056 rot). At base, my `test_103_*` files additionally FAIL (source absent); at HEAD they PASS. No file I touched introduces a new failure.
- **G-5 byte-identical:** `git diff a131f05a -- backend/app/api/threads.py backend/app/services/anthropic_service.py` = 0 lines.
- **No new *.sql:** `git status --porcelain "backend/**/*.sql"` = none (REQ-3 zero-migration).

## Next Phase Readiness
- **Plan 02 (NL-gen)** can consume `Settings.harness_authoring_model` and fill the 7 xfail cases in `test_103_nl_generate.py` + `test_103_grounding_fidelity.py`. The strict-mode override (Pitfall 1) is its first task.
- **Plan 04 (Builder)** can PATCH drafts via `PATCH /workflows/{id}`; **Plan 06 (Workflows page)** can list drafts via `GET /workflows/drafts`, fork via the v(N+1) create, and launch via the existing kickoff path.
- No blockers.

## Self-Check: PASSED

- All 7 `test_103_*.py` files + the SUMMARY exist on disk (verified).
- All 3 task commits exist in git history: `a9ccc7f6`, `c96456f6`, `f7e8c653` (verified).
- Plan target suite GREEN (13 passed, 7 xfailed); G-5 byte-identical; no new *.sql; net-new failures = 0 (base-checkout proven).

---
*Phase: 103-workflows-page-authoring-api-nl-authoring*
*Completed: 2026-06-14*
