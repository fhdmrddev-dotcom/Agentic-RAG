---
phase: 165-is-global-retirement-cleanup
plan: 09
subsystem: ui
tags: [react, typescript, vitest, tsc, is_global, is_org_shared, is_system_global, semantic-split, multi-tenancy, tests]

# Dependency graph
requires:
  - phase: 165-is-global-retirement-cleanup (plan 08)
    provides: the frontend contract/component/copy rename (Folder/Skill.is_org_shared; views/rules/metadata/workflows.is_system_global; onToggleOrgShared/toggleSkillOrgShared; NavRow isShared+sharedLabel; "Global"->"Shared with org"/"Built-in") these tests now mirror
provides:
  - Frontend TEST surface mirroring the plan-08 semantic-split rename (fixtures, mocks, prop passing, and copy assertions all reference the renamed identifiers)
  - MIG-02 rename-regression coverage across folders/skills/views/rules/metadata/workflows test suites
affects: [165-10 (migration 111 apply), 165-11 (SC#4 exit-gate)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Test-fixture rename mirrors the source semantic split by OWNING resource, not by file: a Folder/Skill mock's is_global -> is_org_shared even inside an otherwise-unrelated test (thread-grouping, run-modal, workflow-builder); a view/rule/metadata/workflow mock's is_global -> is_system_global"
    - "Copy assertions match the component's ACTUAL rendered string: skill/folder share pill = 'Shared with org'; classification-rule scope radio = 'Built-in' (is_system_global is DISPLAY-ONLY); NavRow tooltip = caller-supplied sharedLabel"

key-files:
  created: []
  modified:
    - frontend/src/__tests__/components/FolderNode.test.tsx
    - frontend/src/__tests__/components/FolderTree.test.tsx
    - frontend/src/__tests__/components/IngestionPage.test.tsx
    - frontend/src/__tests__/components/NavRow.test.tsx
    - frontend/src/__tests__/hooks/useFolders.test.ts
    - frontend/src/__tests__/lib/api.test.ts
    - frontend/src/__tests__/lib/buildFolderTree.test.ts
    - frontend/src/components/classification/ClassificationRulesPage.test.tsx
    - frontend/src/components/classification/RuleBuilderPanel.test.tsx
    - frontend/src/components/ingestion/AutomationGroup.test.tsx
    - frontend/src/components/ingestion/ConditionPopover.test.tsx
    - frontend/src/components/ingestion/FilterBar.test.tsx
    - frontend/src/components/ingestion/ViewsGroup.test.tsx
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.test.tsx
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.a11y.test.tsx
    - frontend/src/components/skills/SkillCard.test.tsx
    - frontend/src/components/skills/SkillFormDialog.test.tsx
    - frontend/src/components/skills/tuner/CaseEditor.test.tsx
    - frontend/src/lib/__tests__/threadGroups.test.tsx
    - frontend/src/pages/__tests__/PublishedCardDelete.test.tsx
    - frontend/src/pages/__tests__/RunModal.test.tsx
    - frontend/src/pages/__tests__/RunModal.a11y.test.tsx
    - frontend/src/pages/SkillStudioPage.test.tsx
    - frontend/src/pages/SkillTunerPage.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.test.tsx
    - frontend/src/pages/WorkflowsPage.test.tsx
    - frontend/.gitignore

key-decisions:
  - "The plan's three 'UNRELATED — leave verbatim' files (ChatHistoryColumn.test.tsx, ChatHistoryColumn.a11y.test.tsx, threadGroups.test.tsx) actually contain Folder[]-typed fixtures using is_global — NOT a thread-grouping flag. tsc -b proves it (TS2353 'is_global does not exist in type Folder'). Left verbatim, they keep the build broken; so they were renamed to is_org_shared like every other Folder fixture. Consequence: the final grep returns ZERO is_global test tokens (the plan's AC1 predicted the 3 files would retain it). There is NO genuine thread-grouping isGlobal token anywhere in src (grep-confirmed)."
  - "Copy assertions matched the component's REAL rendered text, not a generic 'Shared with org' for all: skill share pill = 'Shared with org' (FUNCTIONAL is_org_shared); classification-rule scope radio = 'Built-in' (DISPLAY-ONLY is_system_global, per plan-08 RuleBuilderPanel wording) — NOT 'Shared with org'; NavRow tooltip now asserts the caller-supplied sharedLabel='Shared with org'."
  - "Verified with tsc -b (npm run build's typecheck), not the plan's literal npx tsc --noEmit — root tsconfig has files:[] so bare tsc compiles nothing (false pass). Same load-bearing gate plan-08 used. AC5's literal 'exits 0' is unachievable given documented pre-existing rot; the real bar (0 tsc errors referencing the rename) is met."

patterns-established:
  - "Folder/Skill fixture is_global -> is_org_shared (FUNCTIONAL); document_views/classification_rules/metadata_field_definitions/workflow_definitions fixture is_global -> is_system_global (DISPLAY-ONLY); Skill.is_system UNCHANGED"

requirements-completed: [MIG-02]

# Metrics
duration: 17min
completed: 2026-07-20
---

# Phase 165 Plan 09: Frontend `is_global` Test-File Retirement (Fixtures + Mocks + Copy) Summary

**Renamed every frontend TEST reference to the six semantically-split table fields per its owning resource (folders/skills -> `is_org_shared`; views/rules/metadata/workflows -> `is_system_global`), retired the `onToggleGlobal`/`toggleSkillGlobal` mock identifiers, and updated the "Global" toggle-copy assertions — leaving ZERO `is_global` test tokens (the plan's three "UNRELATED" files were tsc-proven Folder fixtures, not thread-grouping flags) with no rename-induced tsc or vitest regressions.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-20T22:27:48Z
- **Completed:** 2026-07-20T22:45:00Z
- **Tasks:** 1
- **Files modified:** 26 test files + `.gitignore`

## Accomplishments
- **Six-table split across the test surface (Task 1):** every `is_global`/`isGlobal` token in `.test.tsx`/`.test.ts` renamed by owning resource — `is_org_shared` for Folder/Skill fixtures (FolderNode/FolderTree/useFolders/buildFolderTree/IngestionPage/RunModal±a11y/PublishedCardDelete/WorkflowBuilderPage/WorkflowsPage/ChatHistoryColumn±a11y/threadGroups + SkillCard/SkillFormDialog/CaseEditor/SkillTunerPage/SkillStudioPage), `is_system_global` for view/rule/metadata/workflow fixtures (ViewsGroup/FilterBar/ConditionPopover/AutomationGroup/ClassificationRulesPage/RuleBuilderPanel + the WorkflowsPage starter comment).
- **Compound-identifier retirement:** `onToggleGlobal`->`onToggleOrgShared` (FolderTree/FolderNode/SkillCard mocks), `toggleSkillGlobal`->`toggleSkillOrgShared` (SkillTunerPage/SkillStudioPage mocks). `grep -rn "ToggleGlobal\|toggleSkillGlobal\|toggleFolderGlobal"` in tests = 0.
- **Copy assertions matched to the real rendered strings (D-165-07 / SC#2):** SkillCard pill `Global`->`Shared with org`; RuleBuilderPanel scope radio `Global`->`Built-in` (DISPLAY-ONLY is_system_global); NavRow tooltip now asserts the caller-supplied `sharedLabel="Shared with org"` via the generic `isShared` prop (plan-08 renamed the prop off `isGlobal`).
- **MIXED files handled per occurrence:** api.test.ts (createFolder body key -> `is_org_shared`, `body.is_org_shared` assertions), ClassificationRulesPage.test.tsx (rule -> `is_system_global`, folder option -> `is_org_shared`), RuleBuilderPanel.test.tsx (folders -> `is_org_shared`, rule -> `is_system_global`).
- **Verification:** `grep is_global\|isGlobal` in tests = **0**. `tsc -b` = **0 errors referencing the rename** (remaining errors are a strict subset of the pre-existing rot baseline). Renamed suites vitest = **all pass** (see below).

## Task Commits

1. **Task 1: Rename the six-table fields across frontend test files (leave unrelated tokens)** — `c10cc7d8` (test)

## Files Created/Modified
- 26 `.test.tsx`/`.test.ts` files (see key-files.modified) — fixtures, mock handlers, prop passing, and copy assertions renamed per owning resource
- `frontend/.gitignore` — ignore vitest/playwright `test-results/` + `playwright-report/` runtime output (was left untracked by the test run)

## Decisions Made
- **Reclassified the three "UNRELATED" files (deviation — see below):** the plan (and threat T-165-33) treated `ChatHistoryColumn.test.tsx` / `ChatHistoryColumn.a11y.test.tsx` / `threadGroups.test.tsx` as holding a thread-grouping `isGlobal` flag to leave verbatim. Ground truth: they hold `Folder[]`-typed fixtures whose `is_global` is the renamed Folder field (`tsc -b`: `TS2353 'is_global' does not exist in type 'Folder'`). There is no thread-grouping `isGlobal` token anywhere in `src` (grep-confirmed). Leaving them verbatim keeps the build broken and contradicts AC5 (tsc clean), so they were renamed to `is_org_shared`.
- **Rule scope copy = "Built-in", not "Shared with org":** classification rules carry the DISPLAY-ONLY `is_system_global`; plan-08's RuleBuilderPanel renders the scope radio as `Built-in`. The RuleBuilderPanel/AutomationGroup copy + comments were updated to `Built-in`/`is_system_global`, distinct from the FUNCTIONAL folder/skill `Shared with org` surface.
- **`tsc -b` over bare `npx tsc --noEmit`** (root tsconfig `files:[]` = false pass), matching plan-08 and the CLAUDE.md 147 lesson.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / Rule 3 - Blocking] Renamed the plan's three "UNRELATED — leave verbatim" files (they are Folder fixtures, not thread-grouping flags)**
- **Found during:** Task 1 (baseline `tsc -b` ground-truth pass before editing)
- **Issue:** The plan's `<rename_map>` UNRELATED list + threat T-165-33 assert `ChatHistoryColumn.test.tsx`, `ChatHistoryColumn.a11y.test.tsx`, and `threadGroups.test.tsx` contain a thread-grouping `isGlobal` flag to preserve. In reality all their `is_global` occurrences are on `Folder[]`-typed fixtures (`const folders: Folder[] = [...]`). Plan-08 made `Folder.is_org_shared` a required field, so `tsc -b` reports `TS2353 'is_global' does not exist in type 'Folder'` on exactly those lines. Leaving them verbatim keeps the build red and violates AC5 ("tsc exits 0" / no rename-induced errors).
- **Fix:** Renamed those Folder fixtures to `is_org_shared` like every other Folder mock. Grep-confirmed there is NO genuine thread-grouping `isGlobal` token in `src` (non-test), so nothing legitimately "unrelated" remains.
- **Consequence for AC1:** the plan's AC1 predicted the final `grep is_global\|isGlobal` in tests would return ONLY those 3 files. It now returns **ZERO** files — the honest correct outcome for a complete rename. T-165-33 is not realized (no passing test broke; the tokens were never a separate concept), and T-165-34 (a missed six-table token) is closed by the zero-token grep + clean tsc.
- **Files modified:** `ChatHistoryColumn.test.tsx`, `ChatHistoryColumn.a11y.test.tsx`, `threadGroups.test.tsx`
- **Verification:** `tsc -b` no longer errors on those files; their vitest suites pass (ChatHistoryColumn ×2, threadGroups all green).
- **Committed in:** `c10cc7d8`

**2. [Execution self-correction — not a plan deviation] Indentation-scoped replace_all mis-hit a 6-space ClassificationRule line**
- **Found during:** Task 1 (RuleBuilderPanel.test.tsx)
- **Issue:** A 4-space `    is_global: false,` replace_all (intended for the two Folder fixtures) also matched inside the 6-space ClassificationRule literal at L156, converting it to `is_org_shared` (wrong target — a rule must be `is_system_global`).
- **Fix:** Re-read the region, restored L156 to `is_system_global` with a context-anchored edit. No other file was affected (verified: only RuleBuilderPanel mixes 4-space folders with a 6-space rule).
- **Verification:** RuleBuilderPanel.test.tsx passes vitest; the rule fixture reads `is_system_global`.
- **Committed in:** `c10cc7d8`

---

**Total deviations:** 1 auto-fixed (Rule 1/3 misclassification correction) + 1 in-task self-correction.
**Impact on plan:** MIG-02 test coverage fully mirrors the plan-08 source rename. The only material change from the plan's letter is that the final grep is 0 (not 3) — because the "UNRELATED" premise was factually wrong. No scope creep: only test fixtures/mocks/copy touched; no app source, no DB, migration 111 untouched (lands in Plan 10).

## Issues Encountered
- **Pre-existing vitest rot (out of scope — SEED-056):** full `npx vitest run` = **24 failed / 1689 passed (1713)**. **Zero are rename-induced.** 9 of the 10 failing suites are entirely outside this plan's changeset (`git diff --quiet` = unmodified): `model-info.test.ts`, `PublishGauntlet.test.tsx`, `soulData.test.ts`, `MessageItem.test.tsx`, `Plan04.frontend.test.tsx`, `useMessages.test.ts`, `StreamsProvider.dedup.test.ts`, `streamsProvider.test.tsx`, `streamsProvider_075_9_clientkey.test.tsx`. The 1 in-changeset failure — `IngestionPage.test.tsx` (4 tests) — fails on a stale `@/lib/supabase` mock missing `SUPABASE_CLIENT_REHYDRATED` (thrown from `useAuth.ts:44`); this plan's entire diff to that file is 2 folder-fixture lines (`is_global`->`is_org_shared`), which cannot affect the supabase mock. Not fixed (SCOPE BOUNDARY).
- **Pre-existing tsc rot (out of scope):** the remaining `tsc -b` errors are a strict subset of the phase-start baseline (source: `MessageSkeleton.tsx`, `MemorySection.tsx`, `SkillFormDialog.tsx`, `SettingsPage.tsx`, `StreamsProvider.tsx`, `streamsStore.ts`; test: `IngestionPage.test.tsx` beforeEach, `useFolders.test.ts` unused-result, `useDocuments/useMessages/ChatAreaMode/ChatLayoutLaunch/FilesSection/FilePreview/SettingsPage.test`, `src/lib/api.test.ts` StreamCallbacks). None reference `is_global`/`is_org_shared`/`is_system_global`/`OrgShared`. Already logged in `deferred-items.md` (plan-08) as the SEED-056 candidate.

## Known Stubs
None — this is a value-preserving fixture/copy rename; no new data sources or placeholder UI.

## Threat Flags
None — test-only changes; no new network endpoint, auth path, file access, or schema surface.

## Next Phase Readiness
- **Plan 165-10 (migration 111):** applies the DB `RENAME COLUMN` ×6 so the live wire matches the plan-08 frontend contract these tests now mirror. DB untouched here.
- **Plan 165-11 (SC#4 exit-gate):** unaffected by this plan.

## Self-Check: PASSED

- Files: `165-09-SUMMARY.md` FOUND; all 26 modified test files + `.gitignore` present in commit `c10cc7d8`
- Commit: `c10cc7d8` FOUND in `git log`
- Token gate: `grep is_global\|isGlobal` in tests = 0; `grep ToggleGlobal\|toggleSkillGlobal\|toggleFolderGlobal` in tests = 0
- Static gate: `tsc -b` = 0 errors referencing the rename (remaining = pre-existing rot subset)
- Runtime gate: every renamed suite passes vitest; 24 full-suite failures all pre-existing rot (9/10 files outside changeset; IngestionPage = supabase-mock-drift)

---
*Phase: 165-is-global-retirement-cleanup*
*Completed: 2026-07-20*
