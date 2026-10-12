# Phase 274 — frontend baselines (captured by plan 274-03, before its first source edit)

**PHASE_BASE:** `75cd73782d8651d7d976d287e40d6c6802a2dc95` (develop HEAD at dispatch, `docs(274): state — begin execution`)

## 1. Frontend typecheck — `npx tsc -p tsconfig.app.json --noEmit` (run in `frontend/`)

Never bare `npx tsc --noEmit`: `frontend/tsconfig.json` is a solution-style config that checks zero files.

Exit 2, **66 errors** at base. SET, sorted, as `file:line:code`:

```
src/__tests__/hooks/useDocuments.test.ts:130:TS2322
src/__tests__/hooks/useFolders.test.ts:217:TS6133
src/__tests__/hooks/useMessages.test.ts:161:TS2353
src/__tests__/hooks/useMessages.test.ts:227:TS2554
src/__tests__/hooks/useMessages.test.ts:289:TS2554
src/__tests__/hooks/useMessages.test.ts:377:TS2554
src/__tests__/hooks/useMessages.test.ts:423:TS2554
src/__tests__/providers/streamsProvider_state01b_403.test.tsx:23:TS6133
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

## 2. Vitest count gate — `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root)

Verdict lines, verbatim:

```
  total                                      9078    9834    +756
  total 9834  ·  failed 1  ·  pinned total 9078
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 1 test(s) failed — the gate requires 0.
```

**The one failure is NOT inherited — it is this plan's own RED case, and that is stated rather than
left to read as a base red.** Captured from the gate's persisted JSON
(`vitest-count-gate-16596-1791175042595.json`) BEFORE any re-run:

```
src/components/chat/__tests__/ComposerAttach.composition.test.tsx
  :: Composer attach — the ordered blocks sketch 236 draws
     10c — Phase 274 (D-05 / D-21): the composer opts its upload into THREAD-LIFE with "thread"
  :: AssertionError: expected "vi.fn()" to be called with arguments: [ 't-1', Any<File>, 'thread' ]
```

The base gate ran ~11 minutes in the background; `274-03` Task 1's RED commit (`9f4daa567`) added
case `10c` to that suite while the run was in flight, and vitest collected the edited file. So the
gate measured RED-at-RED, exactly as intended for that case. Every other gated case passed:
**at the true base the gate is `failed 0`.** Recorded honestly as a measurement that was
contaminated by a concurrent edit from the same plan, not as a clean base reading.

Other base facts read from the same run:

- `ComposerAttach.composition.test.tsx` pinned **19**, measured **22** (`+3`): 21 at the base commit
  plus `10c`. The pin may grow, never shrink.
- Five suites ran unpinned at base (`— new`): `PromptVariableChips.test.tsx` (3), `RunHero.test.tsx`
  (18), `automationFacts.test.ts` (11), `nodeEffectBanner.test.ts` (8), `toolReadOnlyMap.test.ts` (7).
  Not this phase's; left untouched.
- `TARGETS` has no `src/lib` directory entry (it lists `src/lib/__tests__/*` files individually) and
  no `src/components/attachments` entry.
