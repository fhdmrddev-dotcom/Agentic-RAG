---
phase: 298-lists-follow-the-active-org
plan: 05
subsystem: org-scope / frontend counts + move
tags: [frontend, org-scope, counts, move, victim-naming-sheet]
requires:
  - 298-01 (GET /org-items/elsewhere, useActiveOrgId)
  - 298-03 (GET /org-items/move-preview, POST /org-items/move and their refusal sentences)
  - 298-04 (orgItems.ts, orgItemsCopy.ts, useLibraryOrgSwitch, useWorkflowLibraryFeeds, org-tagged list hooks)
provides:
  - frontend/src/lib/elsewhereCounts.ts (useElsewhereCounts, invalidateElsewhereCounts, noteMoved, useOrgItemsVersion, useLastMoved, open/close/useMoveSheetRequest, moveTargets, resetElsewhereCounts)
  - frontend/src/components/org/ElsewhereLine.tsx ("N more … in <Org> · Switch", hosts the row-menu move sheet)
  - frontend/src/components/org/MoveToOrgSheet.tsx (MoveToOrgSheet + MoveToOrgSheetHost)
  - frontend/src/components/org/MoveToOrgMenuItem.tsx, MoveToOrgButton.tsx
  - orgItems.ts getElsewhereCounts / getMovePreview / moveOrgItem
affects:
  - Library folder tree, Workflows page, chat history column, run log (the elsewhere line)
  - FolderNode ⋯ menu, WorkflowCardMenu ⋯ menu (drafts), DocumentDetailPanel header (the move)
  - useFolders, useLibraryDocuments, useWorkflowLibraryFeeds (refetch on a move), useLibraryOrgSwitch (selection reset)
tech-stack:
  added: []
  patterns:
    - "one store per active org, the citationCheckStore pattern: lazy client, latest-wins request id, answers tagged with the send-time X-Org-Id"
    - "a move bumps a version every list hook keeps in its load deps: the item leaves only on the refetch's answer"
    - "a row-menu sheet is hosted outside the menu (a Radix dropdown's content unmounts on close) — by the list's own ElsewhereLine"
key-files:
  created:
    - frontend/src/lib/elsewhereCounts.ts
    - frontend/src/components/org/ElsewhereLine.tsx
    - frontend/src/components/org/MoveToOrgSheet.tsx
    - frontend/src/components/org/MoveToOrgMenuItem.tsx
    - frontend/src/components/org/MoveToOrgButton.tsx
    - frontend/src/__tests__/lib/elsewhereCounts.test.ts
    - frontend/src/components/org/__tests__/ElsewhereLine.test.tsx
    - frontend/src/components/org/__tests__/MoveToOrgSheet.test.tsx
    - frontend/src/components/org/__tests__/MoveToOrgMenuItem.test.tsx
    - frontend/src/components/org/__tests__/moveMounts.test.tsx
  modified:
    - frontend/src/lib/api/orgItems.ts
    - frontend/src/lib/api.ts
    - frontend/src/setupTests.ts
    - frontend/src/components/org/orgItemsCopy.ts
    - frontend/src/components/ingestion/FolderTree.tsx
    - frontend/src/components/ingestion/FolderNode.tsx
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/components/layout/ChatHistoryColumn.tsx
    - frontend/src/components/workflows/history/RunLogPanel.tsx
    - frontend/src/components/workflows/library/WorkflowCardMenu.tsx
    - frontend/src/components/metadata/DocumentDetailPanel.tsx
    - frontend/src/hooks/useFolders.ts
    - frontend/src/hooks/useLibraryDocuments.ts
    - frontend/src/hooks/useLibraryOrgSwitch.ts
    - frontend/src/components/workflows/library/useWorkflowLibraryFeeds.ts
    - frontend/src/__tests__/components/FolderTree.test.tsx
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.orgSwitch.test.tsx
    - frontend/src/components/workflows/history/RunLogPanel.test.tsx
    - frontend/src/pages/__tests__/WorkflowsPage.orgSwitch.test.tsx
    - frontend/src/__tests__/hooks/useFolders.test.ts
    - frontend/src/__tests__/hooks/useLibraryDocuments.test.ts
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "A row menu's 'Move to <Org>…' only writes a request to the store; the sheet is rendered by MoveToOrgSheetHost inside the list's ElsewhereLine, because a Radix dropdown's content unmounts on close and a sheet rendered in the menu item would die as it opened"
  - "useElsewhereCounts takes the active org as an argument and the store loads its client lazily, because setupTests imports the store and a static OrgProvider / _core import there would hand mocked suites the real modules"
  - "A failed elsewhere read, a solo user, no org, loading and every-zero all render nothing; the store warns once on a failure"
  - "The move sheet's failure lines and refusal box are amber, not red: the plan's no-destructive-class rule overrides the UI-SPEC states table's text-destructive on 'Couldn't check what this would move.'"
  - "Moved stays on screen with a Close button (the host outlives the moved row); a moved Root document's panel closes through the panel's own onClose when that sheet is dismissed"
  - "A folder move resets the Library to Root only when the moved subtree held the selection (computed by the menu item from the folder node)"
requirements-completed: [ORG-06]
duration: ~65 min
completed: 2026-10-28
---

# Phase 298 Plan 05: Elsewhere counts and the per-item org move Summary

Every list that now shows only the active org says how many of your own items live in each of
your other orgs, in one quiet line ("2 more folders and 5 more Root documents in Acme Legal ·
Switch"), and Switch takes you there without leaving the view. An owner at 2+ orgs can move one
folder, one Root document or one draft from the item itself. The confirm sheet reads the server's
preview before it offers the button, names what moves, shows every refusal in the server's words,
and the item leaves its list only when the list's refetch says it has gone.

## Performance

- Started ~2026-10-28T09:31Z · Completed ~2026-10-28T10:35Z (~65 min, including one full count-gate run of ~15 min)
- Tasks: 3/3, 7 commits (3 RED, 3 GREEN, 1 fix)
- Files: 34 changed (10 created, 24 modified)

## Task Commits

| Task | Gate | Commit | Message |
|---|---|---|---|
| 1 | RED | `155697b81` | test(298-05): elsewhere counts line |
| 1 | GREEN | `dd219d3e0` | feat(298-05): N more … in <org> · Switch under every narrowed list (D-16, D-17) |
| 2 | RED | `724ac9194` | test(298-05): move sheet lifecycle + eligibility |
| 2 | GREEN | `1470eb25d` | feat(298-05): Move to <org> sheet and its menu/button leaves (D-19, D-21, D-31, D-33) |
| 3 | RED | `5d837490f` | test(298-05): move homes + after-move refresh |
| 3 | GREEN | `a4aa8f8a9` | feat(298-05): Move to <org> on folders, Root documents and drafts; lists refresh on the server's answer (D-19, D-21) |
| 3 | fix | `a0b9c42ec` | fix(298-05): type the eligibility table's arrange functions (tsc TS7024) |

## What was built

- **Elsewhere counts (D-16).**
  - `orgItems.ts` gains `getElsewhereCounts`, `getMovePreview` and `moveOrgItem`. Both move calls throw `ApiRefusal` with the server's sentence on any non-OK answer, so the sheet tells "the server said no" (4xx) from "we could not ask" (5xx, network) by status.
  - `elsewhereCounts.ts` holds one answer per active org. The first mount asks and every other mount under that org reads the same answer: four lists, one GET. An answer is written only if no later request was made and the `X-Org-Id` it was sent under is the org asked for. After a move it asks again and keeps the last answer on screen meanwhile.
- **The line (D-17, UI-D4..UI-D7).** `ElsewhereLine` renders one line per other org whose count for its list is above 0, in the server's order, with exact plurals. It renders nothing while loading, for a solo user, with no org, at 0 or on a failed read; no state reads "0 more". Switch is a real button named "Switch to <Org>"; it focuses the always-mounted `aria-live` wrapper first, then calls `switchOrg`. Mounted once each in FolderTree (above Root), WorkflowsPage (top of the list region), ChatHistoryColumn (top of the list, also under a title filter) and RunLogPanel (whole log only).
- **The sheet (D-21, D-33, UI-D16..UI-D18).** `MoveToOrgSheet` uses the bottom-sheet arrangement from `WorkflowDeleteSheet` without its red. Its states: picking a target (4+ orgs), checking, clean, refused, preview failed, moving, moved, failed.
  - The count sentence and "What changes" come from the server's counts.
  - Refusals show in one amber `role="alert"` box with only Close.
  - Moving ignores every dismissal.
  - `noteMoved` runs once, on the 200.
- **The homes (D-19, D-31, UI-D15).**
  - The FolderNode ⋯ menu shows it for an owned folder; the menu widens by a CSS `has-[…]` class.
  - The WorkflowCardMenu shows it for a draft only.
  - The DocumentDetailPanel header shows it beside Download for an owned latest Root document.
  - It is absent, never disabled, below 2 orgs or for a non-owner. At 4+ orgs the items collapse into "Move to another organization…".
- **After a move (UI-D19).**
  - `useFolders`, `useLibraryDocuments` (page and summary) and `useWorkflowLibraryFeeds` (drafts) refetch in the background on the move version. The moved item stays until that answer removes it.
  - `useLibraryOrgSwitch` returns the Library to Root (and closes the panel) only when the moved subtree held the selection.

## Verification (gate lines verbatim)

- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, repo root, exit 0):
  `count gate OK — 548/548 pinned files present, no per-file decrease, 0 failing.`
  `total 12764  ·  failed 0  ·  pinned total 11615`
  - Per-file results for every suite this plan created or grew (pin / actual / delta), all at their pins:
    - New: `MoveToOrgSheet.test.tsx` 22/22/0, `ElsewhereLine.test.tsx` 21/21/0, `MoveToOrgMenuItem.test.tsx` 16/16/0, `elsewhereCounts.test.ts` 13/13/0, `moveMounts.test.tsx` 12/12/0.
    - Raised: `useLibraryDocuments.test.ts` 30/30/0 (was 28), `RunLogPanel.test.tsx` 25/25/0 (was 23), `useFolders.test.ts` 18/18/0 (was 17), `FolderTree.test.tsx` 15/15/0 (was 14), `ChatHistoryColumn.orgSwitch.test.tsx` 6/6/0 (was 4), `WorkflowsPage.orgSwitch.test.tsx` 6/6/0 (was 4).
  - One load flake seen in a targeted run, not in the gate: `WorkflowBuilderPage.canvas.test.tsx` "POSITIVE CONTROL" timed out at 1045 ms during a 29-file run, then passed alone (164/164). This plan did not touch that file or WorkflowBuilderPage.tsx.
- **tsc set-diff** (`cd frontend && npx tsc -p tsconfig.app.json --noEmit`): **61 errors, 53 unique** after the fix commit, which matches the base figures. New: 0. Gone: 0.
  - Before `a0b9c42ec` there were 63. The 2 extra were TS7024 errors in this plan's `MoveToOrgMenuItem.test.tsx`, now fixed.
  - Only two of the error-bearing files are in this plan's diff, and both errors pre-date it (the line text matches at `720b8e82c`): `useFolders.test.ts:259` (TS6133) and `lib/api.ts:280-281` (TS2724/TS2305).
- **Backend baseline:** not run. `git diff --stat 720b8e82c HEAD -- backend supabase` is empty. `node scripts/build-public-openapi.cjs --check` → `build-public-openapi --check OK — docs/public/api/openapi.public.json is current (225/267 paths, 310 schemas, version 4.5).`
- **Phase-wide ledger gate:**
  - `node scripts/check-hot-file-ledger.cjs .planning/phases/298-lists-follow-the-active-org` → `ledger gate OK — every watched file has a row.` (scan list 719 rows · subject 94 files · watched 50; exit 0)
  - `node scripts/check-hot-file-ledger.cjs 298` gives the same result.
- **CLAUDE.md size gate:** `node scripts/check-claude-md-size.cjs` → `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.`
- **Acceptance greps:**
  - `<ElsewhereLine`: 1 in each of FolderTree, WorkflowsPage, ChatHistoryColumn and RunLogPanel.
  - `<MoveToOrgMenuItem`: 1 in FolderNode and 1 in WorkflowCardMenu. `<MoveToOrgButton`: 1 in DocumentDetailPanel.
  - `useOrgItemsVersion()`: 1 in each of useFolders, useLibraryDocuments and useWorkflowLibraryFeeds.
  - `text-destructive|bg-destructive`: 0 in all three move files. `dangerouslySetInnerHTML` in `components/org`: 0. `DropdownMenuItem` in MoveToOrgMenuItem: 6.
  - `resetElsewhereCounts` in setupTests: 2 (see deviation 7).
- **Targeted runs:** each task's verify list passed. A final sweep of `src/pages src/components/{layout,workflows,org,metadata,ingestion,library} src/__tests__ src/hooks` read `340 passed (340) · 9008 passed | 1 skipped`.

## Deviations from Plan

**1. [Rule 1 - Bug] The row menus' sheet is hosted outside the menu.** The plan said each leaf renders its own sheet. A Radix `DropdownMenuContent` unmounts when the menu closes, which happens the moment an item is chosen, so a sheet rendered inside `MoveToOrgMenuItem` would unmount as it opened. The menu item now only writes a request to the store (`openMoveSheet`), and `MoveToOrgSheetHost` renders it. The host is mounted by the list's own `ElsewhereLine` (Library → folders, Workflows → drafts), which every home's list already mounts once, so no FIRING file gained a second mount or any state. The Root-document button is not in a menu, so it owns its sheet. (`1470eb25d`, `a4aa8f8a9`)

**2. [Rule 3] `useElsewhereCounts(activeOrgId, enabled)` takes the org as an argument.** The plan's interface was `useElsewhereCounts()`. `setupTests.ts` imports the store to register its reset, and a module imported there is cached before any suite's `vi.mock`. A static `OrgProvider` import would pull in the `@/lib/api` barrel, and `_core` would pull in Supabase, so suites that mock those would silently get the real modules (measured at 294-05). So the store imports only react, zustand and types; its client loads lazily, and `ElsewhereLine` passes the org from `useOrgOptional`. (`dd219d3e0`)

**3. UI-SPEC conflict resolved toward the plan: no red in the sheet.** The UI-SPEC states table gives "Couldn't check what this would move." `text-destructive`, but its Color section, the plan's behavior line and the acceptance grep all say no destructive class in any move file. Both failure lines and the refusal box use the `HoldRefusalNotice` amber. (`1470eb25d`)

**4. Moved shows a Close button and stays until dismissed.** UI-SPEC says the moved state "stays until the list re-fetch removes the item". With the sheet hosted outside the row (deviation 1), the row's removal does not unmount it. So the terminal shows "Moved to <Org> · recorded" plus Close, and the list behind it drops the row on its refetch. For a Root document the panel closes through its own `onClose` when that sheet is dismissed (`onMoved`). It does not close at `noteMoved`, which would unmount the sheet before its receipt was seen. `useLibraryOrgSwitch` therefore resets only a folder selection. (`1470eb25d`, `a4aa8f8a9`)

**5. Selection reset only when the moved subtree held the selection.** The hook cannot see the page's selection without a new LibraryPage argument, and LibraryPage is FIRING and not in this plan. So `MoveToOrgMenuItem` computes `holdsSelection` from the folder node and `selectedFolderId`, both of which FolderNode already has. The flag travels with the move into `lastMoved`. (`a4aa8f8a9`)

**6. The menu widens by CSS, not by an org read.** Each move item carries `data-move-item`, and FolderNode's menu class is `w-40 has-[[data-move-item]]:w-56` (Tailwind 3.4.19). Without this, FolderNode would have needed an org hook. (`a4aa8f8a9`)

**7. Two count-gate corrections.**
- The Task 2 RED commit pinned `MoveToOrgSheet.test.tsx` at 21, but the suite holds 22 (the confirm describe has 5 cases, not 4). It was raised to 22 at GREEN, with the ledger section saying so. (`1470eb25d`)
- The plan's acceptance grep `grep -c "resetElsewhereCounts" setupTests.ts = 1` reads **2**: one import line and one `afterEach` line. The shipped `resetCitationChecks` precedent reads 2 the same way. The registration is single, and the grep cannot be 1 with a named import.

**8. [Rule 1 - own test bug] TS7024 in `MoveToOrgMenuItem.test.tsx`.** The tsc set-diff caught two errors from this plan's own `it.each` table. The arrange closures are now typed `(): void`. (`a0b9c42ec`)

**9. `WorkflowCardMenu.tsx` now FIRES.** This plan's touch is its third phase (286, 293, 298). A CLAUDE.md FIRING row was added in the same commit, and a named seam is recorded in its ledger section. (`a4aa8f8a9`)

**10. `graphify update .` was not run.** The orchestrator's instruction overrides the plan's line.

## TDD Gate Compliance

RED precedes GREEN for every task: `155697b81` → `dd219d3e0`, `724ac9194` → `1470eb25d`, `5d837490f` → `a4aa8f8a9`. Each RED run was observed failing before its GREEN code existed:
- Task 1: 2 suites failed at collection and 6 mount probes failed.
- Task 2: both suites failed at collection.
- Task 3: 10 cases failed.

## G-5 / FIRING files touched

| File | Touch | Ledger |
|---|---|---|
| `lib/api.ts` | the orgItems export block names 3 more clients + 3 types (2 lines) | CLAUDE.md row + scan row + section |
| `pages/WorkflowsPage.tsx` | one `<ElsewhereLine>` + its import | CLAUDE.md row + scan row + section |
| `components/layout/ChatHistoryColumn.tsx` | one `<ElsewhereLine>` + its import | CLAUDE.md row + scan row + section |
| `components/ingestion/FolderTree.tsx` | one `<ElsewhereLine>` + its import | CLAUDE.md row + scan row + section |
| `components/ingestion/FolderNode.tsx` | one `<MoveToOrgMenuItem>` + its import + the menu class | CLAUDE.md row + scan row + section |
| `components/metadata/DocumentDetailPanel.tsx` | one `<MoveToOrgButton>` + its import | CLAUDE.md row + scan row + section |
| `hooks/useFolders.ts` | `useOrgItemsVersion()` in the load deps | CLAUDE.md row + scan row + section |
| `components/workflows/library/WorkflowCardMenu.tsx` | one draft-gated mount + its import (**now FIRES**, 3 phases) | CLAUDE.md row ADDED + scan row + section |
| `scripts/vitest-count-gate.cjs` | pins in four commits | CLAUDE.md row + scan row + section each time |

Not FIRING, rows re-derived: `RunLogPanel.tsx`, `setupTests.ts`, `orgItems.ts`, `orgItemsCopy.ts`, `useLibraryDocuments.ts`, `useLibraryOrgSwitch.ts`, `useWorkflowLibraryFeeds.ts`. The five new modules' AT-PLANNING rows (`0 / 0 / 0`) were replaced with measured triples. `LibraryPage.tsx` and `WorkflowBuilderPage.tsx` were not touched by this plan.

## Known Stubs

None. Every line, item and button reads live data; the absent states are deliberate (UI-D6, D3).

## Threat Flags

None beyond the plan's register.
- **T-298-31:** every server sentence and org name is React text. `dangerouslySetInnerHTML` appears 0 times in `components/org`, and a test renders `<b>bold</b> & co` as literal text.
- **T-298-32:** a request opened under another org closes on a switch, because the host compares `openedIn` with the active org. The server re-checks at confirm.
- **T-298-34:** "· recorded" appears only after a 200.
- **T-298-30 / T-298-33:** accepted as planned.

## Deferred items (phase file) — status

- **1. Chat composer folder scope across an org switch.** Still open. This plan does not touch `ChatArea.tsx` or the composer; the re-open trigger stands.
- **2. A Library saved view / ad-hoc filter surviving an org switch.** Still open. LibraryPage was not touched.
- **3. The DescribeKbPicker one-round-trip surrender.** Still open, as recorded (by design).
- **4. Line-ending-only snapshot rewrites.** Still present and left uncommitted (six `.snap` files, none changed in content by this plan).

## Notes for the orchestrator

- STATE.md and ROADMAP.md were not touched. No Supabase MCP call was made, and no local-DB lock was needed (no DB-touching test ran and no backend file changed).
- G-4 rows 5 and 6 (298-VALIDATION.md) are where the operator sees this plan: the true count and Switch, then a folder move with its sheet, the list update and one audit row.

## Self-Check: PASSED
