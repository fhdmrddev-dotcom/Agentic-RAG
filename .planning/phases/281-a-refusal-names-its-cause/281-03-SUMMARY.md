---
phase: 281-a-refusal-names-its-cause
plan: 03
subsystem: frontend / publish gauntlet + run surfaces + workflows page wiring
tags: [publish-gauntlet, golden-run-link, run-surface, emit-failure, seed-218, prop-presence, tdd]
requires: [281-01, 281-02]
provides:
  - "PublishGauntlet onOpenRun prop: the golden-run link renders only when it is passed"
  - "BLOCKED_STEP_NEXT_NO_RUN: the next-step line used when there is no run link"
  - "EmitFailure gains template_fields_missing (copy on PhaseCard + runVocabulary clause)"
  - "WorkflowsPage onOpenConnections, passed to WorkflowDoorSwitch as onOpenSettings (SEED-218)"
affects: [PublishGauntlet, PublishBlockedStepCard, WorkflowsPage, ChatLayout, PhaseCard, runVocabulary, types/index.ts]
tech-stack:
  added: []
  patterns: ["render by prop presence (the SEED-190 RunLogPanel rule)", "every new way out of the Builder goes through canLeaveBuilderRef"]
key-files:
  created:
    - frontend/src/pages/__tests__/WorkflowsPage.navGuard.test.tsx
  modified:
    - frontend/src/components/workflows/PublishGauntlet.tsx
    - frontend/src/components/workflows/PublishGauntlet.test.tsx
    - frontend/src/components/workflows/publishBlockedStep.ts
    - frontend/src/components/workflows/publishBlockedStep.test.ts
    - frontend/src/components/workflows/PublishBlockedStepCard.tsx
    - frontend/src/components/workflows/PublishBlockedStepCard.test.tsx
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/types/index.ts
    - frontend/src/components/panel/PhaseCard.tsx
    - frontend/src/components/panel/PhaseCard.test.tsx
    - frontend/src/components/workflows/runVocabulary.ts
    - frontend/src/components/workflows/runVocabulary.test.ts
decisions:
  - "The WorkflowsPage guard cases live in a new suite (pages/__tests__/WorkflowsPage.navGuard.test.tsx), not in WorkflowsPage.test.tsx. To test the guard I have to choose what the leave check answers, which means stubbing the door shell and the gauntlet. A module-level mock in the main suite would stub them for its 100+ existing cases too."
  - "When there is no link, the run link renders null (not a disabled button). The no-run-note (golden_run_id null) is unchanged."
metrics:
  duration: "~45 min"
  completed: 2026-10-14
  tasks: 3
  commits: 6
---

# Phase 281 Plan 03: A refusal names its cause (frontend half) Summary

When a publish is refused, the gauntlet now shows a real **"▦ Open the golden run that was judged ›"** button. It hands over the verdict's exact `golden_run_id`, but only after the unsaved-work check. With the canvas layer off there is no button at all, and the old "(view coming soon)" promise is gone. The next-step line matches what is on screen, so it never points at a link that isn't there. The server's multi-line cause now displays line by line on both the gauntlet card and the run panel. The new `template_fields_missing` failure has its own wording, which never says "citation". The describe door's dead connect control (SEED-218) now opens the Connections page.

## Base

- **Base seen at spawn: `a248672f0f4d977133e781b01ac3d92bb6a9c591`.** That is the `master` merge commit, not develop, the same thing both wave-1 agents saw. `git merge-base HEAD 65a7747f7` returned `60ce3797c`. I checked HEAD first (branch `worktree-agent-ad82ed8e170de619a`, not a protected ref), then reset to **`65a7747f7fac83370d6caea9cf9cdb97bd2a04f3`**.
- I reset with `git reset --keep`, not `--hard`. The worktree had an unrelated local edit to `.claude/settings.local.json` (3 MCP permission entries). The file is identical at both commits, so `--keep` moved the branch and left that edit alone. It was not committed.
- PHASE_BASE (the tsc / diff reference) = `95c62fc83`, per 281-01.

## Tasks

| # | Task | RED | GREEN |
|---|------|-----|-------|
| 1 | Golden-run link by prop presence, next line depends on the link, cause keeps its line breaks, link goes through the leave check (FIX-10) | `770cee61e` | `db9fa3cbd` |
| 2 | `template_fields_missing` on every surface (FIX-09 frontend half) | `d2b9241f8` | `0b9841e55` |
| 3 | Describe door's connect control → Connections (SEED-218 / D-27) | `b39d53a88` | `2510ffdb7` |

### RED evidence

- **Task 1:** 4 files, **13 failed / 107 passed**. Every failure was a new case:
  - `BLOCKED_STEP_NEXT_NO_RUN` was undefined.
  - The cause paragraph lacked `whitespace-pre-line`.
  - `run-link` rendered without the prop, and when it rendered it was disabled.
  - `onOpenRun` was never called.
  - WorkflowsPage passed no `onOpenRun` to the gauntlet.
  - Summary line saved to `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-281/red_281-03_t1.txt`.
- **Task 2:** 3 files, **3 failed / 132 passed**:
  - The reason fell to the "reason not captured" fallback: `expected 'Why it stoppedFailure reason not capt…' to match /template/i`.
  - The reason span lacked `whitespace-pre-line`.
  - `failureClause` returned `'— this step did not finish'` (the default arm).
- **Task 3:** **2 failed / 5 passed**: `onOpenSettings` was `undefined`. On the first run the refusing-guard case passed vacuously, because a control that doesn't exist trivially "does not navigate". I added a check that the control exists first, re-ran (2 red), then committed RED.
- Cases that pass at RED **on purpose** are regression guards, not RED drives:
  - "onOpenRun absent ⇒ gauntlet receives undefined"
  - "onOpenConnections absent ⇒ onOpenSettings undefined"
  - "pre-run block keeps the no-run note"
  - "citation_gate_rejected copy unchanged"

### Tests I changed on purpose (with reasons)

1. Two existing run-link cases in `PublishGauntlet.test.tsx` (the success case, ~:200, and the draft-changed Commit block, ~:836) now pass `onOpenRun={vi.fn()}`. Each carries the comment "Phase 281 (D-28): the run link now renders only when onOpenRun is present — the flag-off arm renders none; re-pinned on purpose, not quietly edited".
2. In `PhaseCard.test.tsx`, `FAILURES` gained `template_fields_missing`, since the array is meant to cover the whole union, like `SUBSTEPS`. The distinct-reason check changed from the literal `toBe(5)` to `toBe(FAILURES.length)`. What it checks (one distinct reason per member) is unchanged.
3. `runVocabulary.test.ts`: the 194-04 "every failure flavour" check now also covers the sixth member.

No test was deleted or weakened. Per-file counts only went up:

| File | Change |
|------|--------|
| PublishGauntlet | +6 |
| publishBlockedStep | +3 |
| PublishBlockedStepCard | +3 |
| PhaseCard | +3, plus one new `it.each` row |
| runVocabulary | +1 |
| WorkflowsPage.navGuard | new, 7 |

## Acceptance results

- `grep -ci "coming soon" PublishGauntlet.tsx` = **0**.
- `grep -c "Open the golden run that was judged ›" PublishGauntlet.tsx` = **1**.
- `slice(0, 8)` count: **1 → 0**.
- `git diff 95c62fc83 -- WorkflowRunPage.tsx` is **empty** (D-29).
- `git diff 95c62fc83 -- PublishGauntlet.tsx | grep -i "hardwall\|no-override"` has **no changed line**.
- `grep -c '"template_fields_missing"' types/index.ts` = **1**; `grep -c template_fields_missing runVocabulary.ts` = **1**.
- The new copy entry contains no "citation" (case-insensitive). This is checked by the new PhaseCard case on the rendered alert, which holds both the reason and the where-line.
- ChatLayout: exactly **one** added non-comment line, `onOpenConnections={() => onNavigate("connections")}`, placed after the pinned `onOpenRun={canvasEnabled ? openRunSurface : undefined}` line (the `ChatLayout.launch.test.tsx:482` raw pin still matches).
  - Hook count `grep -c "useState\|useEffect\|useCallback"`: **27 → 27**.
  - `onNavigate("connections")`: **2 → 3**.
  - `onNavigate("settings")`: **0 → 0**.
- `git diff 95c62fc83 -- WorkflowDoorSwitch.tsx doorVocabulary.ts` is **empty**.
- SEED-218's check, `grep -rn "onOpenSettings" frontend/src | grep -v "\.test\."`, now finds `WorkflowsPage.tsx:935  onOpenSettings={` passing a guarded function.

## Gates

- **Targeted suites on the final tree** (`GSD_VITEST_MAX_WORKERS=2`): 18 files, **713 passed / 0 failed**. This covers every Task 1-3 `<verify>` file plus `describeRefusalVocabulary.test.ts` and the new navGuard suite.
- **Frontend typecheck** (`npx tsc -p tsconfig.app.json --noEmit`): 103 lines. `sort -u` then `comm -13` against `tsc_base_95c62fc83.txt` is **empty, so 0 new errors**. It was also empty after Task 2, so no other `Record<EmitFailure,…>` consumer (e.g. `phaseNodeCardContract.ts`) needed an edit. Output: `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-281/tsc_281-03_final.txt`.
- **Vitest count gate: NOT RUN**, as the orchestrator instructed ("281-04 runs it on the merged tree"). This replaces the plan's Task 3 count-gate step, so no verdict line is recorded here.
- **`node scripts/check-hot-file-ledger.cjs 281`: `ledger gate OK`** (scan list 537 rows · 43 subject files · 17 watched).
- No local-DB work, so the DB lock was not taken.

## G-5 hot files: each change kept small and additive

- **PublishGauntlet.tsx:** one prop, forwarded wrapper → `GauntletContent` → `RunLink` and `PublishBlockedStepCard`. The `RunLink` run arm gained one `if (!onOpenRun) return null`. `HardWall` and every no-override guard are untouched.
- **WorkflowsPage.tsx:** one new prop (`onOpenConnections`) and two pass-throughs, each wrapped in the existing `canLeaveBuilderRef` guard. No new state, ref or hook.
- **ChatLayout.tsx:** one prop, zero hooks, zero branches.
- **PhaseCard.tsx:** one copy entry and one className.
- **runVocabulary.ts:** one case.
- **types/index.ts:** one union member.

## Deviations from Plan

1. **[Rule 3 - Blocking] The WorkflowsPage guard cases are in a new suite.** The plan placed them in `WorkflowsPage.test.tsx`. Created `frontend/src/pages/__tests__/WorkflowsPage.navGuard.test.tsx` instead.
   - Why: the main suite mounts the real door shell, Builder and gauntlet, and the real Builder registers `dirty ? window.confirm(...) : true`. To test "the guard refuses, so nothing navigates", I have to choose the leave check's answer, which needs stubs for the two children. A module-level `vi.mock` in the main suite would replace them for every existing case there.
   - `WorkflowsPage.test.tsx` itself was re-run green, unmodified.
   - Commits: `770cee61e`, `b39d53a88`.
2. **[Orchestrator instruction] The vitest count gate was skipped** (see Gates); 281-04 owns it.

## Known residual (not fixed here, by plan)

- **DOOR_REFUSAL wording vs. destination.** `doorVocabulary.ts:535` still says *"`${service}` is not connected — connect it in Settings, or describe this step without it."*, but the control now opens the **Connections** page. `doorVocabulary.ts` is a locked contract mirror and is not edited in 281; 281-04 writes this into SEED-218's answer note.

## Known Stubs

None. Both new props are wired end to end (ChatLayout → WorkflowsPage → WorkflowDoorSwitch, and ChatLayout's existing `openRunSurface` → WorkflowsPage → PublishGauntlet).

## Threat Flags

None. No new endpoint, no `dangerouslySetInnerHTML`, no client parsing of the server string. The mitigations T-281-12..16 apply as planned:
- The link passes the verdict's own id to the existing owner-scoped run fetch.
- Both new navigations go through `canLeaveBuilderRef`.
- The connect control goes to `connections`, never `settings`.
- HardWall is untouched.

## Self-Check: PASSED

- FOUND: `frontend/src/pages/__tests__/WorkflowsPage.navGuard.test.tsx`
- FOUND commits: `770cee61e`, `db9fa3cbd`, `d2b9241f8`, `0b9841e55`, `b39d53a88`, `2510ffdb7`
- STATE.md / ROADMAP.md not modified (owned by the orchestrator).
