---
phase: 286-seams-before-features
reviewed: 2026-10-18T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - backend/app/api/workflows.py
  - backend/app/api/workflow_wire.py
  - backend/app/api/workflow_authoring_doors.py
  - backend/tests/unit/test_286_workflows_seam_pins.py
  - frontend/src/components/workflows/useBuilderNameMaps.ts
  - frontend/src/components/workflows/builderCopy.ts
  - frontend/src/hooks/useWorkflowRun.ts
  - frontend/src/components/workflows/library/WorkflowCard.tsx
  - frontend/src/components/workflows/library/WorkflowCardMenu.tsx
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowRunPage.tsx
  - frontend/src/components/workflows/toolReadOnlyMap.test.ts
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
  - frontend/src/pages/__tests__/PublishedCardDelete.test.tsx
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 286: Code Review Report

**Reviewed:** 2026-10-18
**Depth:** standard
**Status:** clean (2 info notes)

## Summary

No behaviour change found in the extractions. I checked these:

- **Routes.** The five authoring-door handlers are registered with `router.<verb>(<verbatim args>)(handler)`. Each sits at the original declaration position, with the same dependencies, `response_model` and `status_code`. The route-table, OpenAPI and AST pins pass.
- **Patch targets.** Tests that patch `get_pg_pool` for the moved handlers now target `app.api.workflow_authoring_doors`. Tests for handlers that stayed still patch `app.api.workflows`. A grep found no remaining test that patches `app.api.workflows.<name>` for a name only a moved body uses.
- **Import-time effects.** `workflow_wire` is a leaf and `workflow_authoring_doors` does not import `workflows`, so there is no cycle. `workflows.py` re-imports every moved name, so the old attribute paths still resolve. The logger name is kept as the literal `"app.api.workflows"`.
- **Frontend hooks.** `useBuilderNameMaps` is the original mount effect verbatim: same three sequential try/catch fetches, the same `cancelled` guard and an empty dependency array. `useWorkflowRun` and `useWorkflowRunPoll` keep identical effect bodies, and the poll effect's dependency list matches the base, which I diffed. The poll hook is called after `isTerminal` is derived.
- **WorkflowCardMenu.** The JSX and test ids are verbatim. `useDraftDelete` takes over the same three state hooks and the same `confirmDeleteDraft`.
- **Retargeted tests.** Each keeps or strengthens its assertions. The `?raw` reads gained non-vacuity guards. The `listFolders(`/`listSkills(` count stays at 3, now over page plus hook. `test_256`'s call-site line number was re-derived and the per-file count check is unchanged.

Verification run:

- Backend: 148 passed across the seam pins, the retargeted suites and `test_library_run_facts`.
- Frontend: 19 files and 949 tests passed.
- `tsc -p tsconfig.app.json` reports no errors in the touched files.

## Info

### IN-01: Hook depends on a component module for its type

**File:** `frontend/src/components/workflows/useBuilderNameMaps.ts:4`
**Issue:** The hook imports `IdNameMap` from `PhaseFormPanel`, a 1.5k-line hot file. The import is type-only, so it has no runtime effect, but it couples a leaf hook to a component module.
**Fix:** Use `import type`, or move `IdNameMap` to a small types module the next time `PhaseFormPanel` is touched.

### IN-02: `test_256` hard-codes a line number

**File:** `backend/tests/unit/test_256_finish_run_unchanged.py:91`
**Issue:** `api/workflows.py:1550` is another position-dependent literal. It will break on any edit above `delete_workflow_cascade`. The file already follows this convention, so this is not a regression.
**Fix:** None needed now. If this recurs, key the check on the enclosing function name instead of the line.

---

_Reviewed: 2026-10-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
