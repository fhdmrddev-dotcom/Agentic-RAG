---
phase: 165-is-global-retirement-cleanup
plan: 08
subsystem: ui
tags: [react, typescript, tsc, is_global, is_org_shared, is_system_global, semantic-split, multi-tenancy]

# Dependency graph
requires:
  - phase: 165-is-global-retirement-cleanup (plan 03/04)
    provides: the backend/API wire rename (is_global -> is_org_shared for folders/skills; -> is_system_global for the four write-locked platform tables) this frontend contract mirrors
provides:
  - Frontend type contract mirroring the renamed wire (Folder/Skill/SkillCreate.is_org_shared; MetadataFieldDef/SavedView/ClassificationRule.is_system_global)
  - api.ts toggleFolderOrgShared / toggleSkillOrgShared exports + createFolder is_org_shared body key
  - Fully-retired toggle*Global compound identifiers (onToggleOrgShared / handleToggleOrgShared / toggleOrgShared) across hooks, components, and page call sites
  - Folder + skill share toggles relabeled "Global" -> "Shared with org" (D-165-07, still functional)
  - NavRow generic isShared + caller-supplied sharedLabel (folders="Shared with org", platform views/rules=built-in wording)
affects: [165-09 (frontend test-file rename), 165-10 (migration 111 apply), 165-11 (SC#4 exit-gate)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Semantic-split wire rename mirrored client-side: same source token (is_global) maps to two different field names by owning table (is_org_shared FUNCTIONAL vs is_system_global DISPLAY-ONLY)"
    - "Shared presentational primitive stays table-agnostic: NavRow exposes a generic isShared flag + caller-supplied sharedLabel rather than a table-specific prop"

key-files:
  created:
    - .planning/phases/165-is-global-retirement-cleanup/deferred-items.md
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useFolders.ts
    - frontend/src/hooks/useSkills.ts
    - frontend/src/components/ingestion/NavRow.tsx
    - frontend/src/components/ingestion/FolderNode.tsx
    - frontend/src/components/ingestion/FolderTree.tsx
    - frontend/src/components/skills/SkillCard.tsx
    - frontend/src/components/classification/RuleBuilderPanel.tsx

key-decisions:
  - "NavRow (MIXED shared primitive): renamed the single isGlobal prop to a generic isShared + added an optional sharedLabel so folders read 'Shared with org' and platform-seeded views/rules read built-in wording — one component, two semantics, no table coupling"
  - "Relabeled two skill-share copy sites the plan file-list omitted (PublishGateDialog, LifecycleStepper) under D-165-07 / Rule 2 — leaving user-facing 'global' on the skill-share flow would contradict SC#2"
  - "Verified via `tsc -b` (npm run build's typecheck), not the plan's literal `npx tsc --noEmit` — the root tsconfig has files:[] so a bare non-build tsc compiles nothing (false pass); tsc -b is the real static gate"

patterns-established:
  - "is_org_shared = FUNCTIONAL org-share toggle (folders/skills); is_system_global = DISPLAY-ONLY platform-seed badge (write-locked server-side); Skill.is_system UNCHANGED (D-165-02)"

requirements-completed: [MIG-02]

# Metrics
duration: 19min
completed: 2026-07-20
---

# Phase 165 Plan 08: Frontend `is_global` Retirement (Contract + Components + Copy) Summary

**Mirrored the semantic-split wire rename across the frontend contract, retired every `toggle*Global` compound identifier with all call sites, and relabeled the folder + skill share toggles "Global" → "Shared with org" — all 22 edited app files type-clean under `tsc -b`.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-07-20T22:06:27Z
- **Completed:** 2026-07-20T22:25:30Z
- **Tasks:** 2
- **Files modified:** 22 app files + 1 planning doc (deferred-items.md)

## Accomplishments
- **Contract layer (Task 1):** `types/index.ts` split the 6 `is_global` fields per owning table (Folder/Skill/SkillCreate → `is_org_shared`; MetadataFieldDef/SavedView/ClassificationRule → `is_system_global`; `Skill.is_system` preserved). `api.ts` renamed `toggleFolderGlobal`→`toggleFolderOrgShared`, `toggleSkillGlobal`→`toggleSkillOrgShared`, `createFolder` body key/param → `is_org_shared`. Hooks renamed import aliases + the `toggleGlobal`→`toggleOrgShared` callbacks.
- **Components/pages + copy (Task 2):** field/prop renames per the FUNCTIONAL vs DISPLAY-ONLY split; W2 compound-identifier retirement (`onToggleGlobal`→`onToggleOrgShared`, `handleToggleGlobal`→`handleToggleOrgShared`, page `toggleGlobal` destructure/pass-through) across FolderNode/FolderTree/SkillCard + IngestionPage/SkillsPage; folder + skill share toggles relabeled "Global" → "Shared with org" / "Share with org".
- **Static proof:** `tsc -b --force` — every one of the 22 edited app files is type-clean; **zero** non-test errors reference the renamed symbols. The only new type errors are the expected `.test.tsx` `is_global`/`onToggleOrgShared` mock failures that Plan 165-09 owns (its `<context>` NOTE explicitly assigns them).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename the contract layer (types + api + hooks) + api/hook toggle identifiers** — `7dea74fa` (refactor)
2. **Task 2: Rename components + pages + relabel toggles "Global" → "Shared with org"** — `82d7e77e` (refactor)

## Files Created/Modified
- `frontend/src/types/index.ts` — 6-field semantic split (is_org_shared × is_system_global); is_system preserved
- `frontend/src/lib/api.ts` — toggleFolderOrgShared / toggleSkillOrgShared; createFolder is_org_shared; server-owned comments
- `frontend/src/hooks/useFolders.ts`, `useSkills.ts` — import aliases + toggleOrgShared callbacks
- `frontend/src/components/ingestion/NavRow.tsx` — MIXED shared primitive: isGlobal→isShared + sharedLabel
- `frontend/src/components/ingestion/{FolderCreateInput,FolderDetail,FolderNode,FolderTree,ViewsGroup,AutomationGroup}.tsx` — folder=is_org_shared, view/rule=is_system_global, compound-identifier renames, copy
- `frontend/src/components/skills/SkillCard.tsx` — onToggleOrgShared/handleToggleOrgShared, is_org_shared, "Shared with org" pill + share button
- `frontend/src/components/skills/PublishGateDialog.tsx`, `studio/LifecycleStepper.tsx` — skill-share copy relabel (deviation, see below)
- `frontend/src/components/classification/RuleBuilderPanel.tsx` — MIXED: rule=is_system_global, folder option=is_org_shared, "Built-in" scope wording
- `frontend/src/components/chat/tool-bodies/{TreeBody,LsBody}.tsx` — folder is_org_shared on ls/tree cards ("global" pill → "shared")
- `frontend/src/pages/{IngestionPage,SkillsPage,WorkflowsPage}.tsx` — page wiring + workflow comment refs
- `.planning/phases/165-is-global-retirement-cleanup/deferred-items.md` — pre-existing tsc rot + Plan-09 test-file log

## Decisions Made
- **NavRow generic-pill design (MIXED):** rather than couple the shared row primitive to one table, its single `isGlobal` prop became a generic `isShared` + optional `sharedLabel`; each caller supplies the honest tooltip (folders "Shared with org"; platform views/rules "Built-in — shared with everyone"). Keeps the shared row semantic-neutral while satisfying the per-table split.
- **`Skill.is_system` kept** as the physical marker + "Built-in" pill (D-165-02) — only the FUNCTIONAL `is_global`→`is_org_shared` toggle changed on skills.
- **Verification method:** used `tsc -b` (what `npm run build` runs). A bare `npx tsc --noEmit` at the frontend root compiles nothing (root tsconfig `files:[]`, references only followed in build mode) — a false pass — so `tsc -b` is the load-bearing gate per the CLAUDE.md rule ("`npm run build`, NOT just `tsc --noEmit`").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical / D-165-07] Relabeled two skill-share copy sites the plan file-list omitted**
- **Found during:** Task 2 (final "Global" copy sweep across folder/skill surfaces)
- **Issue:** SC#2 requires no lingering user-facing "Global" on the folder/skill share flow, but the plan's `files_modified` omitted `PublishGateDialog.tsx` (the confirm dialog opened by the SkillCard share toggle — title "Share this skill globally?") and `LifecycleStepper.tsx` (skill publish-gate message "...before this skill can go global"). Leaving these would contradict the SkillCard button now reading "Share with org".
- **Fix:** PublishGateDialog title → "Share this skill with your org?" + body "...available to everyone in your org."; LifecycleStepper → "...can be shared with your org."; plus the dialog's doc-comment. Copy-only, no behavior/type change.
- **Files modified:** `frontend/src/components/skills/PublishGateDialog.tsx`, `frontend/src/components/skills/studio/LifecycleStepper.tsx`
- **Verification:** post-edit grep shows no lingering user-facing "Global"/"global" toggle copy on folder/skill surfaces; `tsc -b` unaffected (copy-only)
- **Committed in:** `82d7e77e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 D-165-07 copy-completeness, Rule 2)
**Impact on plan:** Necessary for SC#2 (the phase's whole point is retiring the "global" vocabulary). No scope creep — copy-only, no new behavior, no type surface change. W3 expected no-ops confirmed: `SkillFormDialog.tsx` + `tuner/CaseEditor.tsx` had zero `is_global` tokens and were not edited.

## Issues Encountered
- **Pre-existing frontend `tsc -b` rot (out of scope):** `tsc -b --force` reports 8 pre-existing type errors in 6 files this plan never touched (`MessageSkeleton.tsx`, `MemorySection.tsx`, `SkillFormDialog.tsx`, `SettingsPage.tsx`, `StreamsProvider.tsx`, `streamsStore.ts`) — none reference the rename; they look like an `@types/react` 19 / dep-types drift. Confirmed pre-existing (`git status` shows those files unmodified by Plan 08). Logged to `deferred-items.md`, NOT fixed (SCOPE BOUNDARY).
- **Plan verify command mismatch (resolved):** the plan's literal `npx tsc --noEmit` is a false-pass here (root tsconfig `files:[]`); switched to `tsc -b` per CLAUDE.md and the 147 lesson. The load-bearing intent ("a missed compound-identifier call site fails the build") is fully satisfied — every edited app file type-checks and 0 non-test errors reference the rename.

## Known Stubs
None — this is a value-preserving rename + copy relabel; no new data sources or placeholder UI introduced.

## User Setup Required
None — no external service configuration. NOTE (from the plan's W1 dev-server note): this frontend now reads the renamed wire fields; a running vite dev server against a still-old backend (pre-migration-111) will show broken folder/skill/view data until Plan 165-10 applies migration 111. Operator should restart dev servers after 165-10. DB migration 111 is NOT touched by this plan.

## Next Phase Readiness
- **Plan 165-09 (frontend tests):** the 102 `.test.tsx` errors are exactly the `is_global`/`onToggleOrgShared` mock references Plan 09 renames — this plan's completion is what surfaces them (proof the app-side rename is consistent).
- **Plan 165-10 (migration 111):** applies the DB rename so the live wire matches this frontend contract; until then dev-server reads are expected to break (W1).
- **Plan 165-11 (SC#4):** unaffected by this plan.

## Self-Check: PASSED

- Files: `165-08-SUMMARY.md` FOUND, `deferred-items.md` FOUND
- Commits: `7dea74fa` FOUND, `82d7e77e` FOUND, `527598cb` FOUND
- Static gate: all 22 edited app files type-clean (`tsc -b`); 0 non-test errors reference the rename

---
*Phase: 165-is-global-retirement-cleanup*
*Completed: 2026-07-20*
