---
phase: 286-seams-before-features
plan: 01
subsystem: backend/api/workflows
tags: [g5-extraction, pure-move, pin-first, backend]
requires: []
provides:
  - backend/app/api/workflow_wire.py (leaf: 20 wire models + pure helpers)
  - backend/app/api/workflow_authoring_doors.py (GenerateRequest + 4 undecorated authoring-door handlers)
  - backend/tests/unit/test_286_workflows_seam_pins.py (OpenAPI / route-table / AST / re-export / logger pins)
affects:
  - phase 287 (edits workflows.py)
  - phase 291 (AUTH-02 edits the authoring doors, now in their own ~400-line module)
  - plan 286-05 (ledger row for workflows.py + the two new modules; full gates)
tech-stack:
  added: []
  patterns:
    - "Same-router registration: router.<verb>(<verbatim decorator args>)(handler) at the def's original position"
    - "Characterisation pins captured on the unmoved tree (PIN286_CAPTURE=1, once), numstat empty after"
key-files:
  created:
    - backend/app/api/workflow_wire.py
    - backend/app/api/workflow_authoring_doors.py
    - backend/tests/unit/test_286_workflows_seam_pins.py
    - backend/tests/fixtures/phase286/workflows_openapi.json
    - backend/tests/fixtures/phase286/workflows_routes.json
    - backend/tests/fixtures/phase286/workflows_moved_ast.json
    - .planning/phases/286-seams-before-features/286-01-BASE.md
  modified:
    - backend/app/api/workflows.py
    - backend/tests/unit/test_256_finish_run_unchanged.py
    - backend/tests/unit/test_103_nl_generate.py
    - backend/tests/unit/test_193_workflow_template_upload.py
    - backend/tests/unit/test_q5r_template_placeholders.py
    - backend/tests/unit/test_214_describe_vocabulary.py
decisions:
  - "Task 1 answered option-b by the operator (\"Option B (Recommended)\", 2026-10-18): the three patched authoring doors and GenerateRequest moved too"
  - "Moved handlers register on the SAME router via router.<verb>(...)(handler); no second APIRouter, no include_router"
  - "workflow_authoring_doors binds logging.getLogger(\"app.api.workflows\") so log records keep their logger name"
  - "Full backend unit gate + DB-mutating wholesale suites deferred to plan 286-05 per the orchestrator's parallel-wave directive"
metrics:
  duration: "~40 min"
  completed: 2026-10-18
  tasks: 3
  files: 13
requirements: [REG-07]
---

# Phase 286 Plan 01: workflows.py seam (wire models + authoring doors) Summary

`backend/app/api/workflows.py` went from 2,273 to 1,647 lines. The 20 wire models and pure helpers
moved to a leaf module, `workflow_wire.py`. `GenerateRequest` and the four authoring-door handlers
moved, without their decorators, to `workflow_authoring_doors.py`. Those handlers are still
registered on the same `/workflows` router, at their original positions, with the decorator
arguments copied verbatim. A pin suite committed before the move shows the OpenAPI document,
the route table and every moved AST are unchanged.

## Task 1 answer (operator decision)

`Task 1 answer: option-b`. The operator answered "Option B (Recommended)" in the orchestrator's
AskUserQuestion on 2026-10-18 (recorded verbatim in `286-01-BASE.md`). Under that answer,
`generate_workflow`, `GenerateRequest`, `upload_workflow_template` and
`get_workflow_template_placeholders` moved too. The four affected test files were retargeted in a
separate commit that contains only test changes.

## Final move set (25 symbols, derived from the inventories in BASE.md)

- **`workflow_wire.py` (20):** `_coerce_definition`, `_caller_uuid`, `_iso_or_none`, `DraftCreateResponse`, `Verdict`, `ValidateResponse`, `PaletteFolder`, `PaletteSkill`, `GroundingBundleResponse`, `PublishRequest`, `BlockedStep`, `PublishVerdict`, `_coerce_user_id`, `_ALREADY_PUBLISHED_DETAIL`, `DeletePreview`, `_owned_slug_or_404`, `_TEMPLATE_MIME_BY_EXT`, `TemplateAssetRef`, `TemplatePlaceholdersResponse`, `_TEMPLATE_MAX_UNCOMPRESSED_BYTES`.
- **`workflow_authoring_doors.py` (5):** `GenerateRequest`, `generate_workflow`, `read_template_placeholders`, `upload_workflow_template`, `get_workflow_template_placeholders`.
- **What stayed in `workflows.py`, and the test that keeps each piece there:**
  - `PublishedWorkflow` and `DraftRow`: `test_library_run_facts` counts 2 `has_any_run` declarations in this file's text.
  - The severity block and `_severity`: a `test_187` pin reads this file's text.
  - `validate_workflow`: a test checks its `__module__`.
  - `get_grounding_bundle` and every draft, publish and delete handler: tests patch `app.api.workflows.get_pg_pool` and similar names for them.
  - Every import, including the ones no staying handler uses any more.
- No other symbol from the planned option-B list had to be left behind.
- Section-header comments that describe a route (for example "Phase 103 NL one-shot generation route" and "Phase 193 author-time template binding") stayed in `workflows.py` above the matching registration. Comments that describe a moved symbol moved with it.

## Landing line count vs D-05

`wc -l backend/app/api/workflows.py` reads **1,647**, down from 2,273 (626 fewer lines, about 28%).
**D-05's target was 1,200-1,400 lines, and this misses it by about 250 lines.** The plan expected
option B to land near 1,550. It came out about 100 lines higher because the plan's estimate did not
count the new 20-line module-docblock paragraph, the 33-line re-import block, or the four
registration statements.

The deferred re-open trigger in CONTEXT reads "still > 1,500 lines after this phase and a later
phase must edit it". That trigger fires: phase 287 edits this file. Plan 05's ledger row should
record it. Phase 291's AUTH-02 work now lands in `workflow_authoring_doors.py` (403 lines), not
in the big file.

## Tests edited (D-13), every one with its reason

| Test file | Commit | Edit | Reason |
|---|---|---|---|
| `test_256_finish_run_unchanged.py` | `b519c4b13` | `"api/workflows.py:1812"` → `"api/workflows.py:1550"`, with a dated RE-DERIVED comment and the old value kept beside the new one | Line shift only. Check (a), the per-file count, stayed green. That count says `api/workflows.py` still calls `finish_run` once, so no caller was added or lost. |
| `test_193_workflow_template_upload.py` | `232bfa7bc` | patch target `app.api.workflows.get_pg_pool` → `app.api.workflow_authoring_doors.get_pg_pool` | `upload_workflow_template` now looks up `get_pg_pool` in its new module. Measured before the retarget: 14 cases went red with `404: workflow not found`, because the unpatched handler read the real local pool. |
| `test_q5r_template_placeholders.py` | `232bfa7bc` | same patch-path change | Same reason, for `get_workflow_template_placeholders`. 7 cases went red before the retarget. |
| `test_103_nl_generate.py` | `232bfa7bc` | the `get_pg_pool` setattr and the never-called `create_workflow_definition` trap (`raising=False`) both now target `app.api.workflow_authoring_doors` | ⚠ This test stayed GREEN without the retarget, because the unpatched `generate_workflow` reached the real `get_pg_pool` and the faked service never used the pool. A guarded case had quietly become an unguarded one, which is exactly threat T-286-07. The never-persist trap was moved to the handler's own module so it still covers the handler. Its assertion `persisted == []` is unchanged. |
| `test_214_describe_vocabulary.py` | `232bfa7bc` | the route sweep now reads `app.api.workflow_authoring_doors.__file__` | The two needles (`allowed_connection_ids=body.allowed_connection_ids,` in `generate_workflow`, and `allowed_connection_ids: list[str] \| None = None` in `GenerateRequest`) both live in that file now. The needles and the collapse checks are byte-identical. |

All other tests are unedited. Each edit changes only a module path and adds a dated comment.
Assertions, needles, fixtures and counts are byte-identical. No test file appears in the move
commit `315e2f211`.

## Empty-numstat proof

```
$ git diff --numstat 9c3b548de HEAD -- backend/tests/unit/test_286_workflows_seam_pins.py backend/tests/fixtures/phase286/
(no output)
```

`9c3b548de` is the commit that added the pins. They did not exist at the plan base `d45bef9e2`, so
the diff starts from their own commit. The fixture md5s are unchanged since capture
(`0a6959af…`, `67a53bff…`, `1f5a9863…`). All 6 pin cases are green on the moved tree, including the
byte-identical OpenAPI sub-document and the ordered route table.

## Gate set diffs (base vs after)

| Gate | Base (BASE.md) | After | Diff |
|---|---|---|---|
| Targeted workflows set (31 non-DB-mutating files) | 2 failed / 649 passed / 1 skipped | 2 failed / 651 passed / 1 skipped (+2 `test_222` cases for the two new modules) | failing set **identical** |
| Closed core (`test_259` + `test_261`) | 12 passed: 7 / 1 / 30 | 12 passed: 7 / 1 / 30 | none |
| Failing set | `test_182_validate::test_interactive_phase_verdict_is_incomplete_and_per_node`, `test_published_workflow_ownership::test_published_workflow_field_set_excludes_created_by` | same two | a subset of base (equal) |

Both failures were already red at base and have nothing to do with this move. One comes from the
`next_schedule_*` fields added in Phase 204.1, which the closed field-set fence predates. The other
is `/validate` returning no `interactive_phase` verdict, and `validate_workflow` did not move.

## Deviations from Plan

### Orchestrator directive overrode a plan step

**1. The full backend unit gate and the wholesale run were not executed here**
- **Found during:** Task 2 (base captures)
- **Issue:** The plan asks for the full `pytest tests/unit` run and the wholesale list outside `tests/unit`. The orchestrator's directive for this parallel wave says: "run TARGETED suites per task (full gates are plan 05's job, G-8). Do not run anything that mutates the local database." Both runs include suites that INSERT into the local Supabase (`test_103_draft_crud`, `test_186_concurrent_patch`, `test_103_published_409`, `tests/test_152_delete_cascade`, `tests/test_dual_mode_wiring`, `tests/integration/test_workflows_routes`), and executor 286-02 was running at the same time.
- **What was done instead:** The base-vs-after set diff was taken over every workflows-referencing suite that does not mutate the database (31 files), plus the closed core. The six excluded suites only exercise handlers that stayed in `workflows.py`, and their patch targets were not touched.
- **Owed:** Plan 05 runs the full unit gate (<= 71 failed, 0 collection errors) and the wholesale suites.

### Other notes

- **Worktree base:** The worktree started on `master` (`be7f4177a`). It was reset to the develop tip `d45bef9e2` before any work, as the orchestrator's branch check instructs. The reset also discarded the worktree's pre-existing modification to `.claude/settings.local.json` (a harness-local file in this worktree, not the operator's checkout).
- **Test file not in `files_modified`:** none. The patch inventory mapped no other test to a moved handler.
- **graphify:** I did not run `graphify update .` in this worktree. The orchestrator can run it once after merging the wave, which avoids churning `graphify-out/` alongside a concurrent executor.

## Threat surface

There are no new endpoints, auth paths or schema changes. Every T-286-01..07 mitigation holds:

- The decorator arguments are verbatim, and their AST digests match base.
- The dependency qualnames and closure strings match base for every route.
- `read_template_placeholders` still has no client and no pool. `test_193_1_stateless_placeholders` is green and unedited.
- The owner-gate, the owner-prefix check and the `..` checks are AST-identical to base.
- `PublishedWorkflow` and `DraftRow` did not move, and the OpenAPI schemas are byte-identical.
- The route order is unchanged for both the router and `app.routes`.
- The logger name is pinned.
- The patch retargets are in a test-only commit with no assertion changes.

## Known Stubs

None.

## Commits

- `f4865b811` docs(286-01): record the operator's move-set decision (option-b)
- `9c3b548de` test(286-01): pin workflows.py routes, OpenAPI and moved-symbol ASTs before the move
- `315e2f211` refactor(286-01): move wire models, pure helpers and the authoring doors out of workflows.py (routes unchanged)
- `b519c4b13` test(286-01): re-derive finish_run call-site line after the move (counts unchanged)
- `232bfa7bc` test(286-01): retarget patch/source paths to workflow_authoring_doors (assertions unchanged)

## Self-Check: PASSED

- FOUND: backend/app/api/workflow_wire.py, backend/app/api/workflow_authoring_doors.py, backend/tests/unit/test_286_workflows_seam_pins.py, the three fixtures, 286-01-BASE.md
- FOUND commits: f4865b811, 9c3b548de, 315e2f211, b519c4b13, 232bfa7bc
- Acceptance greps: `include_router` in workflows.py = 0. There is a single `router = APIRouter` at line 175. Neither sibling imports `app.api.workflows`. There is exactly one `getLogger("app.api.workflows")` line in the doors module.
