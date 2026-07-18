---
phase: 152-workflow-run-inputs
plan: 03
subsystem: frontend
tags: [workflow, run-modal, folder-scope, template-upload, react, vite]

# Dependency graph
requires:
  - phase: 152-workflow-run-inputs
    plan: 01
    provides: MessageCreate.folder_id override channel + resolve_run_scope_root server-side gate (WFIN-02 backend)
  - phase: 100-workspace-templates
    provides: upload_template (kind='template_input') + validate_upload magic-byte/size gate (reused verbatim)
provides:
  - RunModal inline KB-scope <select> (author default tagged "workflow default" + per-run override) — WFIN-02 UI (D-LOCK-01)
  - RunModal quiet template-upload button + honest provenance note — WFIN-01 UI (D-LOCK-02)
  - api.postMessage folderId → additive folder_id body key (D-01)
  - ChatLayout.doRun createThread → uploadWorkspaceTemplate(newThread) → postMessage(folder_id) sequencing (Landmine 8)
affects: [WFIN-01 SC#10 cross-provider live UAT, WFIN-02 SC#10 live UAT, 152-04 delete-cascade frontend, 152-VALIDATION]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native <select> byte-matching ChatArea scope vocab (not a shadcn popover) — the modal's 3-second read"
    - "Stage-then-launch: the modal stages a File; doRun uploads it to the LAUNCHED owned thread (Landmine 8)"
    - "Client-side A4 composition guard mirrors the server subtree walk (scoped workflows offer only ⊆-project folders)"
    - "Additive override on postMessage/doRun: folder_id sent ONLY when a real folder differs from the author default (D-06)"

key-files:
  created:
    - frontend/src/pages/__tests__/RunModal.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/pages/WorkflowsPage.test.tsx

key-decisions:
  - "The scope override is narrow-only by the Plan-01 backend contract (override or author_root) — 'All documents' on a BOUND workflow keeps the author default; narrowing (the SEED-112 ask) fully works (documented inline)"
  - "Only a real folder DIFFERENT from the author default becomes a per-run override — staying on 'workflow default' or 'All documents' passes NO override (D-06)"
  - "The 422 upload error surfaces at launch (not on stage) because the upload targets the LAUNCHED thread (Landmine 8) — rendered inline role='alert' verbatim"
  - "A4 composition guard computed client-side from the folders prop (root + descendants), mirroring resolve_project_subtree"

requirements-completed: []

# Metrics
duration: 35min
completed: 2026-07-14
---

# Phase 152 Plan 03: WFIN-01/02 Run-Modal Frontend Summary

**The Run modal is now a real run-input channel — the read-only bound-folder chip became an inline native `<select>` (author default tagged "workflow default", per-run override selectable, A4-composition-guarded), a quiet Upload-template button stages a file with an honest provenance note, and `doRun` sequences createThread → `upload_template(newThread)` → `sendMessage(folder_id)` so the template is discovered by `kind` on the launched thread and the folder override rides into `create_workflow_run.inputs` — no new endpoint, no new scope path.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 (all `type="auto"`)
- **Files:** 1 created + 4 modified
- **Commits:** 3 task commits + this docs commit

## Accomplishments

- **Task 1 — launch contract widened (`387b1fe7`):** `api.postMessage` gained a `folderId?: string | null` option that adds `folder_id` to the body ONLY when present — the SAME additive shape as `workflow_definition_id` (absence = D-06). `ChatLayout.doRun` now accepts a third `{ templateFile?, folderId? }` arg and slots the upload BETWEEN createThread and postMessage: `createThread → (uploadWorkspaceTemplate on the new owned thread) → postMessage({workflowDefinitionId, folder_id})`. The upload is not swallowed — a 422 aborts the launch before the send (Landmine 8). The stale `:112-113` "we never pass a folder here" comment was corrected; the `onLaunch` prop type widened in lockstep.
- **Task 2 — RunModal surfaces (`370397f1`):** the read-only `run-folder-chip` is replaced by a native `<select>` styled to match `ChatArea.tsx:410` (`rounded-md border border-border bg-card … focus:ring-primary/30`). Options in order: `All documents` (`""`) → `📁 {authorDefault} — workflow default` → other owner-reachable folders. Default selection = the author default; the whole control HIDES when `folders.length === 0`. A quiet `TemplateUpload`-shape button STAGES the picked `File` in modal state (validated-file card `{name} ✓ ✕` or inline `role="alert"` 422 verbatim), with the 12px muted provenance note `Stored untrusted — never run as code, never fed to the fill engine.` The `▶ Run` button stays the sole `bg-primary` element.
- **Task 3 — component test (`400f57bb`):** `RunModal.test.tsx` (7 cases) renders the LIVE WorkflowsPage, opens the modal off a published card, and locks: select ordering + hide-on-no-folders, the folderId override payload, the templateFile payload + remove control, the D-06 no-input default, and the verbatim provenance note. `onLaunch` mocked; no network.

## Task Commits

1. **Task 1: widen launch contract — postMessage folder_id + doRun sequencing** — `387b1fe7` (feat)
2. **Task 2: RunModal scope `<select>` + staged template upload + provenance note** — `370397f1` (feat)
3. **Task 3: RunModal run-input contract test** — `400f57bb` (test)

## Files Created/Modified

- `frontend/src/pages/__tests__/RunModal.test.tsx` (created) — 7 cases: select order, hide-when-no-folders, folderId override payload, templateFile payload, remove-control un-stage, D-06 no-input default, verbatim provenance note.
- `frontend/src/lib/api.ts` (modified) — `postMessage` options gained `folderId?`; additive `folder_id` body key (WFIN-02, D-01).
- `frontend/src/components/layout/ChatLayout.tsx` (modified) — `doRun` accepts `{templateFile, folderId}`; sequences createThread → upload → postMessage; corrected the stale folder comment.
- `frontend/src/pages/WorkflowsPage.tsx` (modified) — RunModal: chip→`<select>` (+ A4 client-side subtree guard), staged template upload button + validated-file card + provenance note + inline launch error; `onLaunch` prop type widened; parent `onRun` forwards `{templateFile, folderId}` and re-throws on failure so the modal renders the 422.
- `frontend/src/pages/WorkflowsPage.test.tsx` (modified — deviation) — 3 pre-existing tests updated to the new chip→select + 3-arg-onLaunch contract (see Deviations).

## Decisions Made

- **Narrow-only override (documented inline).** The Plan-01 backend resolver returns `override or author_root or thread_folder_id`, so the `folder_id` channel can only NARROW: an absent/empty override falls through to the author default. Consequently "All documents" on a BOUND workflow keeps the author default (a bound workflow cannot widen to whole-KB through this channel). Narrowing — the SEED-112 operator ask ("only search that specific folder") — works fully. A widen-to-whole-KB path would be a NEW scope input, which this plan explicitly must not add. Encoded honestly in a source comment at `handleRun`.
- **Override sent only when it differs from the author default** — staying on "workflow default" (or "All documents") passes `folderId: null` (D-06 byte-identical). Confirmed by the D-06 test.
- **A4 composition guard client-side.** A workflow declaring any per-phase `folder_scope` offers only folders ⊆ the author `project_folder_id` subtree (walked from the `folders` prop, mirroring the server `resolve_project_subtree` parent_id walk) — the UI never offers an option that would silently empty retrieval.
- **The 422 surfaces at launch, not on stage.** Because `upload_template` is thread-scoped and the modal has no thread until launch (Landmine 8), the file is staged and uploaded inside `doRun`; a failed upload rejects `onLaunch`, the parent re-throws, and RunModal renders the server message verbatim (`role="alert"`) without closing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 3 pre-existing WorkflowsPage tests broken by the intended chip→select + 3-arg onLaunch contract change**
- **Found during:** Task 2 (after replacing the read-only chip with the `<select>` and widening the launch contract).
- **Issue:** `WorkflowsPage.test.tsx` locked the OLD contract this plan intentionally changes: (a) `Run opens the modal: a read-only folder chip …` asserted the `run-folder-chip` testid + "DBA Chapters" text — the chip no longer exists; (b) `clicking Run calls onLaunch(def, kickoff)` and (c) `D-01: the library-card Run path …` asserted a 2-arg `onLaunch(def, kickoff)` — `onLaunch` now always carries the `{ templateFile, folderId }` third arg.
- **Fix:** Rewrote (a) to assert the `run-scope-select` option order + the author-default "workflow default" tag + default selection; updated (b)/(c) to assert the third arg `{ templateFile: null, folderId: null }` (the D-06 default). No behavior weakened — the same launch invariants are guarded against the new contract.
- **Files modified:** frontend/src/pages/WorkflowsPage.test.tsx
- **Verification:** `WorkflowsPage.test.tsx` (23) + `ChatLayoutLaunch.test.tsx` (1) + `RunModal.test.tsx` (7) + `api.workflows.test.ts` (14) → 45/45 green. `ChatLayoutLaunch.test.tsx` stayed green untouched (its `postMessage` options assertion is preserved because `doRun` only adds `folderId` when truthy — an unbound def with no folders sends `{ workflowDefinitionId }` exactly).
- **Committed in:** `370397f1` (alongside the source change that caused it).

**Total deviations:** 1 auto-fixed (a test-contract update directly caused by the in-scope Task 2 source change — same shape as the Plan-01 `test_dual_mode_wiring.py` deviation).
**Impact on plan:** No scope creep. `files_modified` gained `WorkflowsPage.test.tsx` (the co-located test of the changed file).

## Known Stubs

None. The scope `<select>` is wired to the live `folders` prop; the template button stages a real `File`; both inputs reach `create_workflow_run.inputs` via the shipped Plan-01 backend. No hardcoded/placeholder data.

## Issues Encountered

- **Pre-existing baseline (not touched):** the frontend carries ~30 `tsc -b` errors and ~14-17 rotted vitest tests (SEED-056/049). Captured the 30-error `tsc -b` signature baseline BEFORE editing and diffed after each task — **0 net-new tsc errors** on the touched files. `npx vite build` exits 0 after every task.
- **Untracked `frontend/test-results/` (out of scope):** a pre-existing Playwright E2E output dir (scenario-*-chromium, SEED-049 rot) sits untracked in the tree — NOT generated by this plan's vitest runs. Left as-is (scope boundary; a `.gitignore` fix for the rotted E2E artifact is unrelated to this plan).

## User Setup Required

None — no backend/env/migration change (Plan 01 already shipped the `folder_id` channel + owner gate; `upload_template` is reused verbatim). No new packages (native `<select>` + already-vendored lucide icons). **Operator: no action** beyond the standing live UAT.

## Next Phase Readiness

- The Run modal is the complete frontend half of WFIN-01 (template upload) + WFIN-02 (folder scope). **152-04** (delete-cascade frontend, depends on 152-02+03) can proceed — it adds the `PublishedCard` `⋯`-menu + victim-naming Sheet on the SAME page.
- **WFIN-01 / WFIN-02 NOT marked complete** at the requirement level (false-green avoidance, 148–151 convention) — they close at verify-work/secure-phase after the live 4-axis SC#10 cross-provider UAT authored in `152-VALIDATION.md` (the folder-scope constraint lives at the RPC/tool boundary, so provider-uniformity is structural — a live proof, not a unit test).

## Self-Check: PASSED

All 5 touched files exist on disk; all 3 task commits (`387b1fe7`, `370397f1`, `400f57bb`) are present in history. `npx vite build` exits 0; `tsc -b` shows 0 net-new errors over the 30-error baseline; the touched-surface suite is 45/45 green.

---
*Phase: 152-workflow-run-inputs*
*Completed: 2026-07-14*
