---
phase: 298-lists-follow-the-active-org
plan: 04
subsystem: org-scope / frontend lists
tags: [frontend, org-switch, lists, refetch, pickers]
requires:
  - 298-01 (useActiveOrgId, the narrowed list routes, GET /org-items/folder-labels)
  - 298-02 (the ORG-05 save/launch refusal the marker warns about)
  - 298-03 (nothing consumed; the move UI is 298-05's)
provides:
  - frontend/src/hooks/useLibraryOrgSwitch.ts (fields, views, Expert provenance per org; Root + panel reset on a switch)
  - frontend/src/components/workflows/library/useWorkflowLibraryFeeds.ts (three org-tagged feeds, onOrgSwitch)
  - frontend/src/lib/api/orgItems.ts (getFolderLabels)
  - frontend/src/components/workflows/folderLabel.ts (optionLabel / chipLabel)
  - frontend/src/components/org/orgItemsCopy.ts (LOADING_FOLDERS, LOADING_CHATS, LIVES_IN)
  - useFolders().loading, useThreads().switching
affects:
  - Library (folder tree, documents list + summary, fields/views/provenance), Workflows page, run log,
    chat history column, chat folder picker (useFolders), Builder bound-folder select + chip,
    per-phase folder chips (through folderNames), DescribeKbPicker
tech-stack:
  added: []
  patterns:
    - "org-tagged list state: answer tagged with getActiveOrgId() at SEND time, rendered only while the tag is the active org, latest-wins request ids"
    - "switch side effects (selection reset) DURING RENDER, so no effect ever pairs an old-org id with the new org's header"
    - "move-only extraction from a FIRING page in its own commit, then one expression on the page"
key-files:
  created:
    - frontend/src/hooks/useLibraryOrgSwitch.ts
    - frontend/src/components/workflows/library/useWorkflowLibraryFeeds.ts
    - frontend/src/lib/api/orgItems.ts
    - frontend/src/components/workflows/folderLabel.ts
    - frontend/src/components/org/orgItemsCopy.ts
    - frontend/src/pages/__tests__/LibraryPage.orgSwitch.test.tsx
    - frontend/src/pages/__tests__/WorkflowsPage.orgSwitch.test.tsx
    - frontend/src/__tests__/hooks/useThreads.orgSwitch.test.ts
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.orgSwitch.test.tsx
    - frontend/src/components/workflows/__tests__/folderLabel.test.ts
    - frontend/src/components/workflows/__tests__/useBuilderNameMaps.orgLabels.test.tsx
    - .planning/phases/298-lists-follow-the-active-org/deferred-items.md
  modified:
    - frontend/src/hooks/useFolders.ts
    - frontend/src/hooks/useLibraryDocuments.ts
    - frontend/src/hooks/useThreads.ts
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/components/ingestion/FolderTree.tsx
    - frontend/src/components/workflows/history/RunLogPanel.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/ChatHistoryColumn.tsx
    - frontend/src/components/workflows/useBuilderNameMaps.ts
    - frontend/src/components/workflows/DescribeKbPicker.tsx
    - frontend/src/lib/api.ts
    - frontend/src/__tests__/hooks/useFolders.test.ts
    - frontend/src/__tests__/hooks/useLibraryDocuments.test.ts
    - frontend/src/__tests__/components/FolderTree.test.tsx
    - frontend/src/components/workflows/history/RunLogPanel.test.tsx
    - frontend/src/components/workflows/DescribeKbPicker.test.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
    - frontend/src/components/workflows/toolReadOnlyMap.test.ts
    - frontend/src/components/workflows/library/librarySubtree.fences.test.ts
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "Answers are tagged with the header (getActiveOrgId) at send time and compared with useActiveOrgId(); every list hook also keeps a latest-wins request id, because a tag alone let a late old-org answer overwrite the new org's"
  - "The Library Root/panel reset and the Workflows project-filter reset run DURING RENDER: as effects they ran after useLibraryDocuments' own effect, which had already asked for the old org's folder under the new org's header (measured in the RED test)"
  - "All three workflow feeds are org-tagged, starters included, so the page always shows 'Loading your workflows…' after a switch even when the new org has no starters"
  - "DescribeKbPicker keeps an unoffered held id while the label read is pending or FAILED (shown as UNNAMED_KB_OPTION), and drops it only when the read answers without it"
  - "useThreads changed by more than one expression, as the plan designed it (org-tagged state + switching); recorded in its ledger section with the named seam (a shared org-tagged-list hook)"
  - "Fence ids D-298-02/03 named by the plan were already used by 298-01, so this plan's amendments are D-298-06, D-298-07 and D-298-08"
requirements-completed: [ORG-01, ORG-02, ORG-03, ORG-04, ORG-05]
duration: ~85 min
completed: 2026-10-28
---

# Phase 298 Plan 04: Lists follow an org switch in the browser Summary

Switching org now clears every narrowed list at once and shows that list's own loading line instead
of an empty sentence. A slow answer for the old org is thrown away, and each list then shows the new
org's items. In the Builder, a folder the workflow binds in another org reads by name with where it
lives ("Q3 Contracts — lives in Acme Legal"). A picker no longer unbinds a folder just because the
list narrowed.

## Performance

- Started ~2026-10-28T08:05Z · Completed 2026-10-28T09:27Z (~85 min, including one full count-gate run of ~9 min)
- Tasks: 3/3, 8 commits (2 move-only, 3 RED, 3 GREEN)
- Files: 35 changed (12 created, 23 modified) across the plan

## Task Commits

| Task | Gate | Commit | Message |
|---|---|---|---|
| 1 | MOVE-ONLY | `5a0b7640e` | refactor(298-04): move LibraryPage's mount reads into useLibraryOrgSwitch (move-only, G-5) |
| 1 | RED | `2afb65142` | test(298-04): Library follows an org switch |
| 1 | GREEN | `9bc73e280` | feat(298-04): Library lists drop and refetch on an org switch (D-08, D-09, D-10, D-12) |
| 2 | MOVE-ONLY | `2e686c0cb` | refactor(298-04): move WorkflowsPage's feeds into useWorkflowLibraryFeeds (move-only, G-5) |
| 2 | RED | `1cd67c22d` | test(298-04): workflows, run log and chats follow an org switch |
| 2 | GREEN | `b942ff756` | feat(298-04): workflows, run log and chats drop and refetch on an org switch (D-08, D-09, D-11) |
| 3 | RED | `a2aadfa4c` | test(298-04): out-of-org folder marker |
| 3 | GREEN | `408b80bc2` | feat(298-04): out-of-org folder marker in the Builder pickers (D-15) |

## What was built

- **The two move-only extractions (G-5).**
  - `5a0b7640e` moved LibraryPage's two `[]` effects into `useLibraryOrgSwitch`: fields + views, and the Expert-install provenance read. Lines went 1373 → 1345. 253 page tests were green before and after.
  - `2e686c0cb` moved WorkflowsPage's three feeds, `sourceState`, the latest-wins tickets and the refetch callbacks into `useWorkflowLibraryFeeds`. Lines went 1496 → 1390. 28 suites were green before and after; the count went 1133 → 1138, the +5 being the subtree fence's sweeps over the new path.
  - After those commits, each page got one more touch: `loading={foldersLoading}` on LibraryPage, and the `onOrgSwitch` argument on WorkflowsPage.
- **Library.**
  - `useFolders` tags its rows with the org they were asked under and exposes `loading`. Realtime ignores an INSERT from another org and removes a row on an UPDATE that carries another org's id. With no active org it filters nothing.
  - `useLibraryDocuments` puts the org in its source key, so a switch is a cold switch. Its summary reads `null` (counts omitted, never 0) until the new org answers.
  - `useLibraryOrgSwitch` re-reads fields, views and provenance for each org (SEED-317 folded in). It also returns the selection to Root and closes the detail panel.
  - `FolderTree` shows "Loading folders…" in place of the tree, never "No folders yet".
- **Workflows, run log, chats.**
  - Each feed reads `[]` and `pending` until the new org answers, so the page shows "Loading your workflows…". The project filter goes back to All.
  - `RunLogPanel` shows `LOG_LOADING` with no count. A failure there is still never shown as an empty log.
  - `useThreads.switching` drives "Loading your chats…" in the history column. It is false on first paint, so BUG-261027-02 is left for 299 (UI-D9).
  - ChatLayout also clears the mobile new-chat folder pick inside its existing org effect.
  - `StreamsProvider.tsx` is not touched.
- **Builder marker (D-15).**
  - `getFolderLabels` is the client for the 298-01 route (no request for an empty list, chunks of 50).
  - `folderLabel.ts` decides the picker text: the name, "{name} — lives in {Org}" or "· lives in {Org}", or `UNNAMED_KB_OPTION`.
  - `useBuilderNameMaps({ meta, phases })` makes one label read for the bound ids the list lacks.
  - The bound-folder `<option>` and the flag-off chip both show the marker as words.
  - `DescribeKbPicker` looks a held id up before it would drop it.

## Verification (gate lines verbatim)

- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, repo root, final tree before the Task 3 GREEN commit, which changed docs only after the run):
  `count gate OK — 543/543 pinned files present, no per-file decrease, 0 failing.`
  `total 12670  ·  failed 0  ·  pinned total 11521`
  - Per-file results for this plan's suites, all at their pins with delta 0:
    - New or adopted pins: `useFolders.test.ts` 17 (ADOPTED), `FolderTree.test.tsx` 14 (ADOPTED), `LibraryPage.orgSwitch.test.tsx` 5, `WorkflowsPage.orgSwitch.test.tsx` 4, `useThreads.orgSwitch.test.ts` 4, `ChatHistoryColumn.orgSwitch.test.tsx` 4, `folderLabel.test.ts` 8, `useBuilderNameMaps.orgLabels.test.tsx` 8.
    - Raised pins: `useLibraryDocuments.test.ts` 28 (25 → 28), `RunLogPanel.test.tsx` 23 (20 → 23), `librarySubtree.fences.test.ts` 148 (143 → 148), `DescribeKbPicker.test.tsx` 48 (37 → 48).
    - Unchanged: `toolReadOnlyMap.test.ts` 7.
    - `WorkflowDoorSwitch.test.tsx` reads `44 82 +38`. That pin was already 38 behind its own suite. This plan added no case there, so the pin was left alone.
- **tsc set-diff** (`npx tsc -p tsconfig.app.json --noEmit`): the base was measured in a throwaway worktree at `fc531d3d4`, bootstrapped, then torn down by script (source venv and node_modules intact). Base had 61 errors (53 unique); now 61 (53 unique). **New: 0. Gone: 0.**
- **Backend baseline:** not run. `git diff --stat fc531d3d4 -- backend` is empty; no backend file changed.
- **Ledger gate:** `node scripts/check-hot-file-ledger.cjs .planning/phases/298-lists-follow-the-active-org` → `ledger gate OK — every watched file has a row.` (scan list 719 rows, subject 94 files, watched 50).
- **CLAUDE.md size gate:** `node scripts/check-claude-md-size.cjs` → `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.`
- **Acceptance greps (all as specified):**
  - DescribeKbPicker: `@/lib/api"` appears 1 time, and that line names `getFolderLabels`.
  - `listFolders(` / `listSkills(` across the page and the hook: 3, same as base.
  - `optionLabel(` in the page: 1. `useLibraryOrgSwitch(` in LibraryPage: 1. `listExpertInstalls(` in LibraryPage: 0.
  - `useFolders.ts`: `useActiveOrgId()` 1, `getActiveOrgId()` 1.
  - WorkflowsPage: `useWorkflowLibraryFeeds(` 1, `Promise.allSettled(` 1, `useLeaveGuard(` 1, `approveNextLeave()` 3, `clearLeaveApproval()` 1, `const refetchPublished = useCallback` 0.
  - `setSelectedThread(thread)` still present.
  - `StreamsProvider.tsx`, `useDocuments.ts` and `PhaseFormPanel.tsx` are unchanged since base.

## Deviations from Plan

**1. [Rule 1 - Bug] Latest-wins request ids in useFolders and useThreads.** The tag-only pattern from RESEARCH let an old-org answer that landed after the new org's answer *overwrite* it. The rows then mismatched and stayed empty. Caught by the RED case "an A answer resolving AFTER the switch is discarded". (`9bc73e280`, `b942ff756`)

**2. [Rule 1 - Bug] The selection resets run during render, not in an effect.** As an effect, the Library's Root reset ran after `useLibraryDocuments`' effect. That effect had already asked for the old org's folder under the new org's header, and a single-folder read is not narrowed by org. The RED test caught it (`folder_id` was `fa`, expected `root`). The Workflows `onOrgSwitch` uses the same pattern. (`9bc73e280`, `b942ff756`)

**3. [Rule 2] Starters are org-tagged too.** The plan said "starters may stay". But with the starters feed settled, `loading = !anySettled` would read false, and an org with no starters would show "You have no workflows yet." during the switch. All three feeds are now tagged. (`b942ff756`)

**4. [Rule 2] A failed label read keeps the held id in DescribeKbPicker.** It is shown as `UNNAMED_KB_OPTION`. The plan only covered pending / answered-with / answered-without; a failure is not an answer, so the id is not dropped. The chosen row is now computed before the empty/unavailable states, so a held id is always visible. (`408b80bc2`)

**5. Fence ids renumbered.** The plan named D-298-02 and D-298-03, but 298-01 already used them, and 298-03 used D-298-04/05. This plan used:
- **D-298-06**: `librarySubtree.fences` path list 17 → 18, because the new library module must be listed (`2e686c0cb`).
- **D-298-07**: DescribeKbPicker's three surrender cases now also assert that the label read was asked. `WorkflowDoorSwitch.test.tsx`'s failed-refetch case now waits for that read to settle (`a2aadfa4c`, `408b80bc2`).
- **D-298-08**: `toolReadOnlyMap.test.ts` now matches `useBuilderNameMaps(`, since the page passes an argument (`408b80bc2`).

**6. [Rule 3] A test mock gained `getFolderLabels`.** `WorkflowDoorSwitch.test.tsx`'s whole-module `@/lib/api` mock now includes it, following the barrel's "add the export to the mock budget" rule. Both callers also wrap the read so a missing export degrades instead of crashing. (`408b80bc2`)

**7. Count-gate pins corrected along the way.**
- `DescribeKbPicker` was pinned at 37 but measured 42 before this plan, so it went to 48, not 43.
- The Task 1 RED ledger row recorded the count gate's own triple from a `--follow` log that under-read its history. Task 2 fixed the row and says so in the row.

**8. My own test bugs fixed during GREEN.**
- `getByText("Root")` matched two elements; it now uses `getByRole("button", {name: "Root"})`.
- A useFolders case leaked `*Once` mock answers into the next case; that describe now calls `mockReset`.

**9. UI-SPEC parts not built here.** The chat composer's folder-scope reset (UI-D10, third bullet) needs `ChatArea.tsx` (FIRING, not in this plan). An active saved view surviving a switch needs a LibraryPage argument. Both are in `deferred-items.md` with re-open triggers.

**10. TDD order (Task 3).** The GREEN drafts of `orgItems.ts` and `folderLabel.ts` were written first. They were moved out of the tree before the RED run (folderLabel.test failed at collection: module absent), then restored for GREEN.

## TDD Gate Compliance

RED commits precede GREEN for every task: `2afb65142` → `9bc73e280`, `1cd67c22d` → `b942ff756`, `a2aadfa4c` → `408b80bc2`. The two move-only commits precede their tasks' RED commits.

## G-5 / FIRING files touched

| File | Touch | Ledger |
|---|---|---|
| `LibraryPage.tsx` | move-only extraction + `loading={foldersLoading}` | row + section, seam TAKEN |
| `WorkflowsPage.tsx` | move-only extraction + `onOrgSwitch` argument | row + section, seam TAKEN |
| `WorkflowBuilderPage.tsx` | hook argument + destructure, one `optionLabel(...)` option, unused import removed | row + section |
| `useThreads.ts` | org-tagged state + `switching` (plan-designed; more than one expression, recorded) | row + section |
| `useFolders.ts` | org-tagged state, `loading`, Realtime filter (new CLAUDE.md FIRING row, 4/4) | row + section |
| `ChatLayout.tsx` | 3 one-line touches inside existing code | row + section |
| `ChatHistoryColumn.tsx` | optional `loading` line (now FIRES, 8/3) | row + section |
| `FolderTree.tsx` | optional `loading` line | row + section |
| `lib/api.ts` | one barrel block | row + section |
| `scripts/vitest-count-gate.cjs` | pins, every commit that touched it | row + section each time |

Not FIRING, rows replaced with measured triples: `useLibraryDocuments.ts`, `RunLogPanel.tsx`, `DescribeKbPicker.tsx`, `useBuilderNameMaps.ts` and the five created modules.

## Known Stubs

None. Every new line has its data source wired. The loading lines are real states.

## Threat Flags

None beyond the plan's register.
- T-298-25 (org-tagged state, late answers dropped, out-of-order tests) and T-298-27 (Realtime org filter) are mitigated as planned.
- T-298-26: old rows unmount on a switch, and the selection resets happen during render.
- T-298-28 / 29 accepted as planned: one batched label read per set of misses, chunked at 50.

## Notes for later plans

- **298-05:** `orgItemsCopy.ts` and `lib/api/orgItems.ts` exist for the elsewhere line and the move clients to join. `useFolders` already removes a folder on a foreign-org Realtime UPDATE, which is how a moved folder leaves the list in another tab.
- STATE.md and ROADMAP.md are untouched (the orchestrator owns them). `graphify update .` was not run.

## Self-Check: PASSED

- All 12 created files exist on disk. All 8 commits are in `git log`.
- No local-DB lock was taken: no DB-touching test ran and no backend changed.
- No Supabase MCP call was made.
- The unrelated dirty files were left uncommitted: `.claude/settings.local.json`, `.mcp.json`, `.planning/config.json`, three `seam286` snapshots, `graphify-out/GRAPH_REPORT.md`, plus three line-ending-only snapshot rewrites from test runs.
