---
phase: 279-the-expert-scope-seam
plan: 03
status: in-progress
---

# Phase 279 Plan 03: SEED-328 copy + client half — IN PROGRESS

## Worktree base

- Landed on `8764137fe` (master merge, NOT the expected base). `git merge-base HEAD 10596004b` was
  `e8964257e` ≠ `10596004b`, so ran `git reset --hard 10596004b`; HEAD = `10596004bb5e61eeaf1b2b8bbcd8a7b68e2074aa`.
- `bash scripts/bootstrap-worktree.sh` → BOOTSTRAP OK (venv + node_modules junctioned, both .env copied).

## Base frontend typecheck error set (`npx tsc -p tsconfig.app.json --noEmit`, at 10596004b)

66 errors, 30 files, exit 2. `file code xCount` (line/col stripped). **None in any file this plan modifies.**

```
src/__tests__/hooks/useDocuments.test.ts TS2322 x1
src/__tests__/hooks/useFolders.test.ts TS6133 x1
src/__tests__/hooks/useMessages.test.ts TS2353 x1
src/__tests__/hooks/useMessages.test.ts TS2554 x4
src/__tests__/providers/streamsProvider_state01b_403.test.tsx TS6133 x1
src/components/chat/__tests__/ChatAreaMode.test.tsx TS2322 x4
src/components/chat/__tests__/MessageInput.connectors.test.tsx TS6133 x1
src/components/chat/MessageSkeleton.tsx TS2503 x1
src/components/experts/ExpertAuthoringStudio.tsx TS6133 x3
src/components/layout/__tests__/ChatLayoutLaunch.test.tsx TS2740 x1
src/components/layout/NavPanel.test.tsx TS2352 x1
src/components/library/__tests__/IngestionTab.test.tsx TS2345 x1
src/components/library/__tests__/IngestionTab.test.tsx TS2741 x2
src/components/library/__tests__/IngestionTab.test.tsx TS6133 x4
src/components/library/__tests__/sketchComposition.test.tsx TS2739 x1
src/components/library/__tests__/ViewCardGrid.test.tsx TS2345 x1
src/components/library/__tests__/ViewCardGrid.test.tsx TS2554 x2
src/components/library/indexing/FoldersIndexTable.tsx TS6133 x1
src/components/org/OrgExpertsTab.tsx TS6133 x3
src/components/panel/__tests__/FilesSection.test.tsx TS2304 x3
src/components/panel/FilePreview.test.tsx TS2783 x3
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx TS2322 x4
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx TS6133 x1
src/components/settings/__tests__/ConnectionFormPanel.sourceTools.test.tsx TS6133 x1
src/components/settings/ConnectionFormPanel.tsx TS2322 x1
src/components/settings/ConnectionFormPanel.tsx TS2339 x3
src/components/settings/ConnectionFormPanel.tsx TS2353 x1
src/components/settings/MemorySection.tsx TS2339 x1
src/components/skills/SkillFormDialog.tsx TS2322 x2
src/components/workflows/WorkflowDoorSwitch.tsx TS2322 x1
src/lib/api.test.ts TS2322 x1
src/lib/api.ts TS2305 x1
src/lib/api.ts TS2724 x1
src/pages/LibraryPage.tsx TS6133 x2
src/pages/SettingsPage.test.tsx TS2322 x1
src/pages/SettingsPage.tsx TS2322 x1
src/pages/SettingsPage.tsx TS2561 x1
src/providers/OrgProvider.test.tsx TS2741 x1
src/providers/OrgProvider.test.tsx TS6133 x1
src/stores/streamsStore.ts TS2345 x1
```

## Commit log

| Letter | Item | Commit SHA | RED test (file + case) + RED line | GREEN result |
|---|---|---|---|---|
