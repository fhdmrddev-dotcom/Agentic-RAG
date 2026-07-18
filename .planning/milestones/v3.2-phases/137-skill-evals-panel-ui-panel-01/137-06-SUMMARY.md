---
phase: 137-skill-evals-panel-ui-panel-01
plan: 06
subsystem: frontend-skills
tags: [panel-01, skill-studio, shell, ia, active-view, tuner-absorption, live-version, tdd]
requires:
  - "137-01: LifecycleStepper (strip variant + required caseCount prop)"
  - "137-02: VersionsTab (skillId + liveVersionNumber props)"
  - "137-05: EvalsTab (skillId + skillVersion props)"
  - "123-05: SkillTunerPage + skill-tuner ActiveView precedent (now absorbed)"
provides:
  - "SkillStudioPage — focused full-surface Studio shell (persistent header + condensed gate strip + Evals/Triggering/Versions tabs)"
  - "deriveLiveVersion(skill, versions) — the shared W1 live-version rule (imported by this shell AND Plan 07's panel)"
  - "TriggeringTab — thin wrapper mounting SkillTunerPage embedded"
  - "skill-studio ActiveView + studioSkillId/studioTab state + onOpenStudio/onReviewEvals/onStudioTabChange navigators (App→ChatLayout→SkillsPage)"
  - "legacy skill-tuner absorption: handleTuneSkill redirects to Studio·Triggering (no orphan surface)"
affects:
  - "137-07: imports deriveLiveVersion from @/lib/skillVersion; destructures onOpenStudio/onReviewEvals in SkillsPage to drill to the slim detail panel (sole 'Open studio' button)"
tech-stack:
  added: []
  patterns:
    - "ActiveView focused full-surface (no router), mirroring the shipped SkillTunerPage precedent"
    - "single-source shell derivation (live version + caseCount) threaded down; no consumer re-derives"
    - "additive one-line render guard (embedded prop) to absorb a shipped surface without touching its internals"
key-files:
  created:
    - frontend/src/lib/skillVersion.ts
    - frontend/src/pages/SkillStudioPage.tsx
    - frontend/src/pages/SkillStudioPage.test.tsx
    - frontend/src/components/skills/studio/TriggeringTab.tsx
  modified:
    - frontend/src/pages/SkillTunerPage.tsx
    - frontend/src/App.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/pages/SkillsPage.tsx
decisions:
  - "Strip caseCount source: the shell fetches listTestCases once per skill switch; the optional onCasesChanged→shell-refetch bubble was NOT wired (executor discretion). Transient drift is possible only if the operator adds/removes a case inside the Evals tab before the shell re-reads — acceptable per the plan."
  - "Legacy Tuner absorption: the standalone skill-tuner ActiveView value + its ChatLayout mount branch + the tunerSkillId state were REMOVED (not left dead), fully realizing D-01 'no orphan Tuner surface'. Required because the D-01 redirect makes handleTuneSkill stop calling setTunerSkillId → keeping the state would trip noUnusedLocals."
metrics:
  duration_minutes: 20
  tasks_completed: 2
  files_created: 4
  files_modified: 4
  tests: "10 new (SkillStudioPage.test.tsx) + 70 sibling (studio/tuner/form-dialog) = 80 green"
  completed: 2026-07-03
---

# Phase 137 Plan 06: Skill Studio Shell + Reachability Triad Summary

Assembled the unified Skill Studio shell (`SkillStudioPage` — a focused full-surface with a persistent header, a condensed publish-gate strip, and Evals/Triggering/Versions deep-linkable tabs), created the shared `deriveLiveVersion` live-version rule, absorbed the shipped Trigger Tuner as the Triggering tab via a one-line `embedded` header guard, and wired the `skill-studio` ActiveView + navigators + legacy `skill-tuner` redirect so the Studio is reachable in-phase.

## What was built

**Task 1 (TDD) — the shell, the shared helper, the tuner absorption:**
- `frontend/src/lib/skillVersion.ts` — the pure `deriveLiveVersion(skill, versions)` content-equality rule (instructions match → that `version_number`; else MAX; no versions → 1). One rule, one implementation (W1); Plan 07's panel imports the SAME helper.
- `frontend/src/pages/SkillStudioPage.tsx` — the shell: `useSkills` identity → a persistent header (‹ Skills · name · v{N} · LIVE badge · `LifecycleStepper variant="strip"`) over three tabs. The shell fetches `getPublishGate` + `listSkillVersions` + `listTestCases` ONCE per skill switch (skill-switch-guarded); derives `liveVersionNumber` via the shared helper and `caseCount = cases.length`, threading both down. The strip condenses the SAME server `getPublishGate` the EvalsTab stepper renders (never a second truth-teller); its `caseCount` is the shell's `listTestCases` length (never a hardcoded 0). Null skillId → a calm centered guard with a ‹ Skills back.
- `frontend/src/components/skills/studio/TriggeringTab.tsx` — a thin wrapper mounting `<SkillTunerPage … embedded />`; imports none of the tuner internals.
- `frontend/src/pages/SkillTunerPage.tsx` — ONE additive optional `embedded?: boolean` prop guarding the focused-surface header block (`{!embedded && (…)}`). No behavior/internals changed (D-02); standalone renders exactly as before when unset.
- `frontend/src/pages/SkillStudioPage.test.tsx` — 10 specs: deriveLiveVersion (match/max/none→1) + shell landing=Evals, header name/vN/LIVE, listTestCases-sourced strip caseCount, tab switch → onTabChange + stub render, null-skill guard, ‹ Skills back.

**Task 2 — the reachability triad + legacy redirect:**
- `App.tsx` — `skill-studio` ActiveView (replaces `skill-tuner`); `studioSkillId`/`studioTab` state; `handleOpenStudio(skillId, tab="evals")` / `handleReviewEvals` / `handleStudioTabChange`; `handleTuneSkill` REDIRECTS to `handleOpenStudio(skillId, "triggering")` (D-01 no orphan Tuner surface / D-06 lint re-point). All threaded to ChatLayout.
- `ChatLayout.tsx` — mounts `<SkillStudioPage>` on `activeView === "skill-studio"` (absorbs the old skill-tuner branch); passes `onOpenStudio` + `onReviewEvals` through to `<SkillsPage>`.
- `SkillsPage.tsx` — Props gain optional `onOpenStudio` / `onReviewEvals` (interface only, undestructured — no duplicate "Open studio" button; Plan 07 owns the sole entry button in the slim detail panel). The existing "Tune triggers" `onTuneSkill` button is unchanged; it now auto-lands in Studio · Triggering via App's redirect.

## Verification

- `npx vitest run src/pages/SkillStudioPage.test.tsx` → **10/10 green**.
- Broader sweep (SkillStudioPage + SkillTunerPage + SkillFormDialog + all 8 `studio/*`) → **80/80 green** (no regressions from the `embedded` prop or the onTuneSkill redirect).
- `npx tsc -p tsconfig.app.json --noEmit` → **no errors in any file this plan touched**. The remaining tsc errors are pre-existing SEED-056 rot in untouched files (MessageSkeleton JSX namespace, NavPanel unused import, SkillFormDialog RefObject types, SettingsPage/MemorySection/StreamsProvider/streamsStore, and the ChatLayoutLaunch.test.tsx rot that never passed ChatLayout's full required-prop set) — none reference `ActiveView`/`skill-tuner`/`skill-studio` or any type this plan changed.
- All Task 1 + Task 2 acceptance greps pass (embedded ≥2 in SkillTunerPage; 3 tab components + `variant="strip"` + `listSkillVersions` + `deriveLiveVersion` + `listTestCases` in the shell, `caseCount={0}` == 0; TriggeringTab has SkillTunerPage + embedded, no `skills/tuner` import; `skill-studio` ≥2 in App + ≥1 in ChatLayout; `setActiveView("skill-tuner")` == 0; SkillsPage navigators ≥2 with no "Open studio" button; onTuneSkill preserved).

## TDD Gate Compliance

- RED: `test(137-06)` `fec1b346` — spec authored first; failed to resolve `@/lib/skillVersion` + `./SkillStudioPage` (missing modules).
- GREEN: `feat(137-06)` `92cd08e9` — helper + shell + TriggeringTab + embedded prop; 10/10 green. (One test refinement during GREEN: the tab controls carry `role="tab"` for proper tablist a11y, so the two tab-click queries were corrected from `getByRole("button")` to `getByRole("tab")` — a wrong role assumption in the RED spec, not a behavior change.)

## Deviations from Plan

**1. [Rule 3 — blocking issue] Full removal of the legacy `skill-tuner` ActiveView + branch (not left dead).**
- **Found during:** Task 2.
- **Issue:** The plan's D-01 redirect repoints `handleTuneSkill` to `handleOpenStudio(…, "triggering")`, so it no longer calls `setTunerSkillId`. Leaving the `tunerSkillId` state in place would trip `noUnusedLocals` (the setter becomes unread); leaving the ChatLayout `skill-tuner` branch would then reference an un-threaded prop.
- **Fix:** Removed the `skill-tuner` union value, the ChatLayout skill-tuner mount branch, the `SkillTunerPage` import in ChatLayout, and the `tunerSkillId` state — fully realizing D-01 "no orphan Tuner surface remains after absorption." SkillTunerPage is now mounted ONLY via `TriggeringTab`. The plan's Task 2 wording said "add" the skill-studio branch without explicitly saying "remove skill-tuner"; the removal is the correct structural consequence of the redirect.
- **Files modified:** App.tsx, ChatLayout.tsx.
- **Commit:** 472394e6.

## Known Stubs

None. The three tab bodies are real shipped components (EvalsTab / VersionsTab from Plans 05/02, SkillTunerPage via TriggeringTab); the shell self-fetches real owner-scoped data. The single "Open studio" entry button is intentionally deferred to Plan 07 (the slim detail panel owns the sole control per the 057 MAP) — the navigators are defined and threaded here, ready for Plan 07 to destructure and drill.

## Notes for Plan 07

- Import the live-version rule from `@/lib/skillVersion` (`deriveLiveVersion`) — do NOT re-derive inline (W1: one rule, two homes).
- `SkillsPage` Props already carry optional `onOpenStudio` / `onReviewEvals`; destructure them and drill to the slim detail panel, where the sole "Open studio" button lives. `onOpenStudio(skillId)` lands on Studio · Evals (landing); `onReviewEvals(skillId)` is the PublishGateDialog "Review evals →" seam.

## Self-Check: PASSED

- All 9 created/modified files verified present on disk.
- All 3 commits verified in git history: `fec1b346` (RED test), `92cd08e9` (GREEN impl), `472394e6` (Task 2 wiring).
