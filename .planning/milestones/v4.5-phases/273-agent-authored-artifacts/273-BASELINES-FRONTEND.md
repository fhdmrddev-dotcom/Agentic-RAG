# Phase 273 — Frontend baselines (captured by 273-02, before its first edit)

**PHASE_BASE:** `f764734979c25696544b2408232f4fbdc779ae5f` (`develop`, "docs(273): create phase plan")
**Captured:** 2026-10-03, in worktree `agent-a42c4afb31cedfbe6` (bootstrapped; junctioned venv + node_modules).

## 1. TypeScript — `npx tsc -p tsconfig.app.json --noEmit` (never bare `tsc --noEmit`, which checks zero files)

**70 errors at base.** The SET, as `file:line:code`, sorted (column dropped so a moved column is not a new error):

```
src/__tests__/hooks/useDocuments.test.ts:130:TS2322
src/__tests__/hooks/useFolders.test.ts:217:TS6133
src/__tests__/hooks/useMessages.test.ts:161:TS2353
src/__tests__/hooks/useMessages.test.ts:227:TS2554
src/__tests__/hooks/useMessages.test.ts:289:TS2554
src/__tests__/hooks/useMessages.test.ts:377:TS2554
src/__tests__/hooks/useMessages.test.ts:423:TS2554
src/__tests__/providers/streamsProvider_state01b_403.test.tsx:23:TS6133
src/__tests__/routing/vercelRouting.test.ts:13:TS2307
src/__tests__/routing/vercelRouting.test.ts:14:TS2307
src/__tests__/routing/vercelRouting.test.ts:43:TS2304
src/components/chat/__tests__/ChatAreaMode.test.tsx:104:TS2322
src/components/chat/__tests__/ChatAreaMode.test.tsx:140:TS2322
src/components/chat/__tests__/ChatAreaMode.test.tsx:162:TS2322
src/components/chat/__tests__/ChatAreaMode.test.tsx:44:TS2322
src/components/chat/__tests__/MessageInput.connectors.test.tsx:1:TS6133
src/components/chat/MessageSkeleton.tsx:14:TS2503
src/components/experts/ExpertAuthoringStudio.tsx:1:TS6133
src/components/experts/ExpertAuthoringStudio.tsx:12:TS6133
src/components/experts/ExpertAuthoringStudio.tsx:41:TS6133
src/components/layout/__tests__/ChatLayoutLaunch.test.tsx:173:TS2740
src/components/layout/NavPanel.test.tsx:87:TS2352
src/components/library/__tests__/IngestionTab.test.tsx:133:TS6133
src/components/library/__tests__/IngestionTab.test.tsx:210:TS6133
src/components/library/__tests__/IngestionTab.test.tsx:228:TS6133
src/components/library/__tests__/IngestionTab.test.tsx:42:TS2741
src/components/library/__tests__/IngestionTab.test.tsx:43:TS2741
src/components/library/__tests__/IngestionTab.test.tsx:506:TS6133
src/components/library/__tests__/IngestionTab.test.tsx:512:TS2345
src/components/library/__tests__/sketchComposition.test.tsx:338:TS2739
src/components/library/__tests__/ViewCardGrid.test.tsx:21:TS2554
src/components/library/__tests__/ViewCardGrid.test.tsx:22:TS2554
src/components/library/__tests__/ViewCardGrid.test.tsx:82:TS2345
src/components/library/indexing/FoldersIndexTable.tsx:22:TS6133
src/components/metadata/__tests__/CR01.reset.test.tsx:2:TS2307
src/components/org/OrgExpertsTab.tsx:20:TS6133
src/components/org/OrgExpertsTab.tsx:4:TS6133
src/components/org/OrgExpertsTab.tsx:6:TS6133
src/components/panel/__tests__/FilesSection.test.tsx:149:TS2304
src/components/panel/__tests__/FilesSection.test.tsx:159:TS2304
src/components/panel/__tests__/FilesSection.test.tsx:168:TS2304
src/components/panel/FilePreview.test.tsx:33:TS2783
src/components/panel/FilePreview.test.tsx:34:TS2783
src/components/panel/FilePreview.test.tsx:35:TS2783
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx:106:TS2322
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx:13:TS6133
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx:136:TS2322
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx:185:TS2322
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx:232:TS2322
src/components/settings/__tests__/ConnectionFormPanel.sourceTools.test.tsx:47:TS6133
src/components/settings/ConnectionFormPanel.tsx:1036:TS2339
src/components/settings/ConnectionFormPanel.tsx:1037:TS2339
src/components/settings/ConnectionFormPanel.tsx:1067:TS2339
src/components/settings/ConnectionFormPanel.tsx:1163:TS2322
src/components/settings/ConnectionFormPanel.tsx:987:TS2353
src/components/settings/MemorySection.tsx:52:TS2339
src/components/skills/SkillFormDialog.tsx:418:TS2322
src/components/skills/SkillFormDialog.tsx:608:TS2322
src/components/workflows/WorkflowDoorSwitch.tsx:399:TS2322
src/lib/api.test.ts:131:TS2322
src/lib/api.ts:267:TS2724
src/lib/api.ts:268:TS2305
src/pages/LibraryPage.tsx:58:TS6133
src/pages/LibraryPage.tsx:58:TS6133
src/pages/SettingsPage.test.tsx:83:TS2322
src/pages/SettingsPage.tsx:1349:TS2322
src/pages/SettingsPage.tsx:998:TS2561
src/providers/OrgProvider.test.tsx:23:TS6133
src/providers/OrgProvider.test.tsx:71:TS2741
src/stores/streamsStore.ts:475:TS2345
```

⚠ The CLAUDE.md figure (`67 errors at base`, 2026-09-08) is stale; **70** is the measured set at this base. Compare SETS, never counts.

## 2. Vitest count gate — `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root)

Verdict lines, verbatim:

```
  total                                      8714    9469    +755
  total 9469  ·  failed 1  ·  pinned total 8714
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 1 test(s) failed — the gate requires 0.
```

**Failing filename, read from the gate's OWN persisted JSON report BEFORE any re-run**
(`%TEMP%\vitest-count-gate-62400-1791042123603.json`):

- `src/pages/WorkflowsPage.test.tsx` — *"D-17's companion rule — a PENDING project re-query never zeroes
  a count, and the updating marker appears then disappears"* — `Error: STACK_TRACE_ERROR`.

**Triage:** the tree was the unmodified PHASE_BASE for every gated file (273-02 had created only new,
ungated files under `src/components/chat/artifacts/` when this ran). `WorkflowsPage.test.tsx` is one of
SEED-171's named cap-independent flaky suites. Recorded as an observation: **provably unmodified, inherited
red** — not "fine".

The `+755` gap is UNPINNED suites (the grand total exceeds the pinned total by the suites nobody has
adopted), including five printed as `new` by the gate (`PromptVariableChips`, `RunHero`,
`automationFacts`, `nodeEffectBanner`, `toolReadOnlyMap`). Not this plan's to adopt.
