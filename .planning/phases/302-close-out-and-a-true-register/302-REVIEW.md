---
phase: 302-close-out-and-a-true-register
reviewed: 2026-10-30T00:00:00Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - backend/app/services/harness/live_connectors.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/harness/publish_service.py
  - backend/app/services/harness/validator_kinds.py
  - backend/app/services/provider_gateway/schema_moonshot.py
  - backend/tests/unit/test_196_judge_model_db_backed.py
  - backend/tests/unit/test_296_golden_inputs_and_lint.py
  - backend/tests/unit/test_296_judge_note_and_tasks.py
  - backend/tests/unit/test_296_moonshot_schema.py
  - frontend/src/__tests__/providers/streamsProvider.test.tsx
  - frontend/src/components/chat/OutputFileCard.tsx
  - frontend/src/components/chat/ThreadWorkflowPicker.tsx
  - frontend/src/components/chat/__tests__/StopControl.baseline.test.tsx
  - frontend/src/components/chat/__tests__/ThreadWorkflowPicker.test.tsx
  - frontend/src/components/chat/__tests__/useStartWorkflowInThread.test.tsx
  - frontend/src/components/chat/composerCopy.ts
  - frontend/src/components/chat/useStartWorkflowInThread.ts
  - frontend/src/components/files/__tests__/useSandboxDownload.test.tsx
  - frontend/src/components/files/useSandboxDownload.ts
  - frontend/src/components/panel/FilesSection.tsx
  - frontend/src/components/panel/GeneratedFilesGroup.tsx
  - frontend/src/components/panel/WorkspacePanel.tsx
  - frontend/src/components/panel/__tests__/FilesSection.test.tsx
  - frontend/src/components/panel/__tests__/GeneratedFilesGroup.test.tsx
  - frontend/src/components/panel/__tests__/WorkspacePanel.derived.test.tsx
  - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx
  - frontend/src/components/panel/__tests__/generatedFiles.test.ts
  - frontend/src/components/panel/generatedFiles.ts
  - frontend/src/components/panel/useThreadFiles.ts
  - frontend/src/components/workflows/DescribeTemplateRow.test.tsx
  - frontend/src/components/workflows/DescribeTemplateRow.tsx
  - frontend/src/components/workflows/TeamPicture.test.tsx
  - frontend/src/components/workflows/TeamPicture.tsx
  - frontend/src/components/workflows/WorkflowScheduleModal.tsx
  - frontend/src/components/workflows/__tests__/WorkflowScheduleModal.test.tsx
  - frontend/src/components/workflows/__tests__/teamAndVocab296.test.ts
  - frontend/src/components/workflows/teamVocabulary.test.ts
  - frontend/src/components/workflows/teamVocabulary.ts
  - frontend/src/providers/StreamsProvider.tsx
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 302: Code Review Report

**Reviewed:** 2026-10-30
**Depth:** standard (hot files reviewed by hunk against `cf5a463d4`)
**Files Reviewed:** 39
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

The FIX-06, FE-IN-01 and F-1 changes hold up when traced. BE-IN-01 now reads liveness through one shared predicate: the executor passes its own module names, the judge resolves the same functions at call time, and both test `== "everyone"` only after `ensure_settings_fresh`. FE-IN-01 was traced end to end. The provider's lock arm stamps `code: "workflow_locked"`. A paused 409 matches the server's `workflow_kickoff.py:181` prefix. Any other 409 reaches `reconcileErrors` through the generic `ApiError` arm and is shown as text. Retry is hidden for `refused`. F-1 (`outcome && !runResult`) is correct. FE-IN-04 and FE-IN-06 give each element its own accessible name. FIX-01 counts files the same way in all three `WorkspacePanel` places. It downloads only through `useSandboxDownload`, fetches nothing extra (`useThreadMessages` and `useWorkspaceFiles` are store selectors), and renders file names as React text, so there is no XSS path.

One blocker: the BE-IN-04 `$ref` unrolling caps depth but not breadth. One warning: the generated-file de-dup compares base names only, so it can hide a real output.

## Critical Issues

### CR-01: The Moonshot `$ref` unrolling caps depth but not breadth, so output grows factorially and can exhaust a worker's memory

**File:** `backend/app/services/provider_gateway/schema_moonshot.py:72-85` (`walk`), `_MAX_DEPTH = 8` at `:40`
**Issue:** `walk` cuts a reference only when that name is already on the current path (`name in stack`) or when the path holds 8 names. Nothing limits how many branches get expanded. Each branch re-inlines every definition that is not on its own path, so a schema with `n` mutually-referencing definitions expands once per simple path of length ≤ 8 (roughly n!/(n-8)! paths). Measured with the shipped code in the venv, one definition per node, each referencing all the others:

| defs | inlined JSON size |
|---|---|
| 4 | 2,259 B |
| 6 | 75,063 B |
| 8 | **4,438,883 B** |

The growth from 6 to 8 is about 59×. At 10 to 12 definitions this becomes hundreds of MB to GB of Python dicts, built synchronously on the request path. These tool schemas come from outside the app (MCP connector tools), so one connector with an AST-, GraphQL- or JSON-Schema-like tool can take down a uvicorn worker on every Moonshot turn. Before this change the same schema raised `ValueError` immediately. The new tests only assert depth (`test_a_deep_chain_beyond_the_cap_ends_in_a_typed_leaf`), and nothing exercises fan-out, so the docstring's "bounded" claim is unverified. That matches focus item (7): tests that could pass vacuously.
**Fix:** Add a global expansion budget alongside the depth cap, and add a fan-out test that pins the output size:
```python
_MAX_EXPANSIONS = 64  # total definitions inlined per schema

def inline_refs(schema, *, cut=None):
    ...
    budget = [_MAX_EXPANSIONS]
    def walk(node, stack):
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/"):
                name = ref.rsplit("/", 1)[-1]
                if name in defs:
                    if name in stack or len(stack) >= _MAX_DEPTH or budget[0] <= 0:
                        ...  # typed leaf, record in cut
                    budget[0] -= 1
                    ...
```
Test: the 8-definition all-to-all schema above must come back under a fixed byte ceiling (for example < 64 KB), with `cut` non-empty.

## Warnings

### WR-01: De-dup matches on base name only, so a workspace file in a subfolder hides a different generated file with the same name

**File:** `frontend/src/components/panel/generatedFiles.ts:35-40` (`inWorkspace`), used at `:56`
**Issue:** `f.path === filename || f.path.endsWith("/" + filename)` treats any workspace file whose base name matches as the same file. The cause measured in 302-RESEARCH F1 is that sandbox outputs never enter `workspace_files`, so the two are separate storage with separate bytes. Scenario: the agent writes the workspace file `drafts/chart.png`, and a later `execute_code` produces a sandbox `chart.png`. The generated row is dropped, the FILES count drops by one, and the only `chart.png` row left previews and downloads the workspace draft rather than the chart the turn produced. That is the "files missing from the panel" defect FIX-01 set out to remove, back for a subset of threads. No test covers a subfolder collision; `generatedFiles.test.ts` only exercises exact names.
**Fix:** De-dup only on an exact path match. If a root-level match is also intended, compare against `f.path` with any leading `/` stripped, never with `endsWith`:
```ts
const norm = (p: string) => p.replace(/^\/+/, "")
return workspace.some((f) => norm(f.path) === norm(filename))
```
Add a test where workspace `drafts/chart.png` and generated `chart.png` both appear.

### WR-02: A cut definition becomes a leaf with the wrong type and loses the keys written beside its `$ref`

**File:** `backend/app/services/provider_gateway/schema_moonshot.py:79-83`
**Issue:** The leaf is `{"type": target.get("type", "object"), "description": ...}`. If the definition has no top-level `type` (a pure `enum`, `anyOf`/`oneOf`, `const`, or a `$ref` alias), the leaf says `object`. For example, a cut definition `{"enum": ["asc","desc"]}` reaches the model as `type: object`, so the model sends an object where the connector expects a string, and the tool call fails downstream. The cut branch also returns before `rest` is merged, so a `description` or `default` written beside the `$ref` is dropped. The non-cut arm keeps them (`{**walk(defs[name]), **walk(rest)}`), so the two arms behave differently.
**Fix:** When the definition has no `type`, keep its `enum`/`const` (or fall back to an untyped `{}` plus the description), and merge the walked `rest` siblings into the leaf the same way the non-cut arm does.

## Info

### IN-01: The shared download hook's 3 s auto-clear timer is never cancelled

**File:** `frontend/src/components/files/useSandboxDownload.ts:66`
**Issue:** `setTimeout(() => setDownloadError(null), 3000)` is not tracked. If a second failed click lands within 3 s, the first timer clears the second error early. A panel row that unmounts on a thread switch also takes a late setState. This behaviour was lifted unchanged from `OutputFileCard`, but it now runs on two surfaces.
**Fix:** Keep the timer in a ref, clear it before arming a new one, and clear it in an unmount effect.

### IN-02: The recursive-schema warning is logged on every Moonshot turn

**File:** `backend/app/services/provider_gateway/schema_moonshot.py:110-116`
**Issue:** `moonshot_tools` runs on every request, so one recursive connector tool writes a warning each turn of every chat that has it bound. The real signal gets buried in noise.
**Fix:** Log once per tool name and definition set (a module-level `set` of logged keys), or log at `debug` after the first time.

### IN-03: A paused 409 is reported as kind `locked`

**File:** `frontend/src/components/chat/useStartWorkflowInThread.ts:44-46`
**Issue:** The paused arm returns `kind: "locked"`, so anything keyed on `failure.kind` treats a pause exactly like a running lock. The wording is correct (`startPaused`), but the kind is less specific than the cause D-09 asks for, and the test pins this conflation.
**Fix:** Optional: add a `"paused"` kind and hide Retry for it as well, or note in the hook header that the kind is shared on purpose.

---

_Reviewed: 2026-10-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
