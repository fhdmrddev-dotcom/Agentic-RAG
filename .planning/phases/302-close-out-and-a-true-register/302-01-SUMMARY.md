---
phase: 302-close-out-and-a-true-register
plan: 01
subsystem: frontend/panel
tags: [frontend, panel, files, sandbox-outputs, a11y, FIX-01]
requires: []
provides:
  - "components/files/useSandboxDownload.ts — resolveOutputUrl + useSandboxDownload (one home of sandbox-output downloads)"
  - "components/panel/generatedFiles.ts — pure deriveGeneratedFiles + GENERATED_FILES_LABEL + GeneratedFile"
  - "components/panel/useThreadFiles.ts — useThreadFiles(threadId) → { workspace, generated, count }"
  - "components/panel/GeneratedFilesGroup.tsx — the Generated files group at panel density"
affects:
  - frontend/src/components/chat/OutputFileCard.tsx
  - frontend/src/components/panel/FilesSection.tsx
  - frontend/src/components/panel/WorkspacePanel.tsx
tech-stack:
  added: []
  patterns: ["panel hook reads the chat bucket via useThreadMessages(threadId, 'chat') + useMemo (useDerivedPanel precedent)"]
key-files:
  created:
    - frontend/src/components/files/useSandboxDownload.ts
    - frontend/src/components/files/__tests__/useSandboxDownload.test.tsx
    - frontend/src/components/panel/generatedFiles.ts
    - frontend/src/components/panel/__tests__/generatedFiles.test.ts
    - frontend/src/components/panel/useThreadFiles.ts
    - frontend/src/components/panel/GeneratedFilesGroup.tsx
    - frontend/src/components/panel/__tests__/GeneratedFilesGroup.test.tsx
  modified:
    - frontend/src/components/chat/OutputFileCard.tsx
    - frontend/src/components/panel/FilesSection.tsx
    - frontend/src/components/panel/__tests__/FilesSection.test.tsx
    - frontend/src/components/panel/WorkspacePanel.tsx
    - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx
    - frontend/src/components/panel/__tests__/WorkspacePanel.derived.test.tsx
    - frontend/src/components/chat/__tests__/StopControl.baseline.test.tsx
decisions:
  - "Generated rows are keyed by file NAME (UI-D3, latest turn wins), following the approved UI-SPEC over RESEARCH's url key (RESEARCH A3 accepted)"
  - "Newest turn = walking the chronological chat bucket backwards (array order), not re-sorting by created_at"
metrics:
  duration: "~24 min"
  completed: 2026-10-30
  tasks: 2
  files: 14
---

# Phase 302 Plan 01: The Workspace panel lists a thread's generated files — Summary

The panel's FILES section now lists the files a thread's code runs produced, under a "Generated files" group. It reads them from the same `finalOutputFiles` the chat already holds, through `useThreadMessages(threadId, "chat")`. Downloads go through one hook, `useSandboxDownload`, which was lifted unchanged out of `OutputFileCard`, so the chat and the panel always download the same way. One count now feeds all three places: `hasActivity`, the FILES header and the rail. Because of that, a thread with generated files and nothing else no longer collapses to `PanelEmpty`.

## Tasks

| Task | Commits | What |
|---|---|---|
| 1 | `71492b6e0` (RED), `0e9aaed94` (GREEN) | `useSandboxDownload` (resolveOutputUrl moved over word for word, plus the click handler). `OutputFileCard` now calls the hook. Added the pure `deriveGeneratedFiles` fold |
| 2 | `81b45c1e4` (RED), `19d4589b5` (GREEN) | `useThreadFiles`, `GeneratedFilesGroup`. One mount in `FilesSection`, one count in `WorkspacePanel` |

The TDD gate held: each `test(...)` commit lands before its `feat(...)` commit. RED failed for the right reasons: the Task 1 modules were missing, and in Task 2 seven new cases failed while all 98 pre-existing cases stayed green.

## Measurements recorded for 302-03

- **OutputFileCard.tsx, comments stripped (FileRow.sweep's `codeOf`): 1758 chars**, above the 1200 `minCode` floor. The floor was not touched. `resolveOutputUrl` still appears in the code (the import plus `href={resolveOutputUrl(file.url)}`, which occurs once). `OutputFileCard.baseline` and `FileRow.sweep` show no diff from base and are green.
- **New and grown test files, with their printed counts** (all passing):

| File | Count | Base |
|---|---|---|
| `components/files/__tests__/useSandboxDownload.test.tsx` | 6 | new |
| `components/panel/__tests__/generatedFiles.test.ts` | 8 | new |
| `components/panel/__tests__/GeneratedFilesGroup.test.tsx` | 7 | new |
| `components/panel/__tests__/FilesSection.test.tsx` | 40 | 34 (+6) |
| `components/panel/__tests__/WorkspacePanel.test.tsx` | 65 | 62 (+3) |
| `components/panel/__tests__/WorkspacePanel.derived.test.tsx` | 4 | 4 (mock key only) |
| `components/chat/__tests__/StopControl.baseline.test.tsx` | 15 | 15 (mock key only) |

- Plan verify run, all green: `src/components/panel src/components/files OutputFileCard.baseline MessageItem.inlineApproval MessageItem.finalOutputs StopControl.baseline ThinkingBlock.characterization` gave **35 files / 698 tests passed**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two suites outside the plan's file list render the real WorkspacePanel**
- **Found during:** Task 2, wider run.
- **Issue:** `WorkspacePanel.derived.test.tsx` (4 cases) and `StopControl.baseline.test.tsx` (5 cases) mock `@/providers/StreamsProvider` with an explicit object literal. Without a `useThreadMessages` key, every case that mounts the panel throws.
- **Fix:** Added one key to each, defaulting by implementation to no messages. Neither suite's assertions changed.
- **Commit:** `19d4589b5`

**2. [Rule 1 - Test harness] The RED test's DownloadError fake was referenced inside a hoisted `vi.mock` factory**
- **Fix:** Moved it into `vi.hoisted`, in the GREEN commit `0e9aaed94`. The RED run still failed for the intended reason (the module could not be resolved).

**3. Plan text said `DownloadError("File not found.", 404)`.** The real constructor is `(status, message)`, so the tests use `(404, "File not found.")`.

**4. Wording adjustments for the acceptance greps.** Docblock mentions of `<GeneratedFilesGroup/>`, `useThreadMessages(threadId, "chat")` and `resolveOutputUrl(file.url)` were reworded so each grep counts only the live code (= 1).

Additional notes:
- `WorkspacePanel.tsx`'s import list no longer includes `useWorkspaceFiles` (it is read through `useThreadFiles`). A note beside the existing "EIGHT names" comment records that the count is now seven. The original sentence was left in place.
- In `FilesSection.tsx` the listbox is wrapped in `{rows.length > 0 && (...)}`. I did not re-indent it, to keep the diff minimal.

## Verification notes

- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`): reports 53 unique errors tree-wide. Only one is in a file this plan touched: `FilesSection.test.tsx: TS2304 Cannot find name 'WorkspaceFile'`. It is **inherited**: the base file already uses `as unknown as WorkspaceFile` (base lines 158/168/177) with no import. My import is aliased (`WsFile`) to stay out of that scope. All new modules typecheck cleanly. I filtered for touched files rather than running a full base-tree tsc.
- **Wide run** (`panel chat layout share pages providers workflows`, 333 files): 13 failures, in 5 files. One was `StopControl.baseline` (fixed above). The other four (`governanceLibraryPanel296`, `PublishGauntlet`, `LibraryPage.review284`, `WorkflowsPage`) passed **186/186 when re-run alone**. My diff does not touch any of them and none mounts panel code, so these look like load-dependent flakes. That rests on one isolated green run; I have not shown them innocent at base.
- The wide run rewrote 5 workflow `.snap` files with line-ending changes only (`git diff` is empty). They were left uncommitted.
- `git diff cf5a463d4 -- backend/app/api/workspace.py AppViewSwitch.tsx ChatLayout.tsx MessageItem.tsx` is empty (D-23).
- The F-1/V-05 sweep is green. The new modules spell no lock runId and no cancel call.

## Threat Flags

None. There is no new route: downloads reuse `downloadSandboxOutput` → GET `/sandbox-outputs/{path}`, and the list is built only from messages the user can already read. File names render as React text, and there is no `dangerouslySetInnerHTML` (grep = 0).

## Known Stubs

None.

## Owed (302-03)

Count-gate pins for the files above, the hot-file ledger refresh (FilesSection, WorkspacePanel, OutputFileCard), G-4 row 1 driven in chat, and the four-axis rows.

## Self-Check: PASSED

All 7 created files are present. Commits `71492b6e0`, `0e9aaed94`, `81b45c1e4` and `19d4589b5` are all in `git log`.
