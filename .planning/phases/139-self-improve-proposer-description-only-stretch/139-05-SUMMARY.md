---
phase: 139-self-improve-proposer-description-only-stretch
plan: 05
subsystem: ui
tags: [react, skill-studio, trigger-tuner, self-improve, proposal, lineDiff, provider-scoreboard, tdd]

# Dependency graph
requires:
  - phase: 139-04
    provides: "api.ts proposeDescription/approveDescriptionProposal/rejectDescriptionProposal + SkillProposal.kind='description' + DescriptionScoreboardSnapshot type"
  - phase: 137 (Skill Studio)
    provides: "ProposalCard render-only idiom + lineDiff util"
  - phase: 123/123.1 (Trigger Tuner)
    provides: "ProviderScoreboard + CandidateCard + SkillTunerPage handleConfirmWinner"
provides:
  - "DescriptionProposalCard — render-only diff + per-provider scoreboard + Approve/Reject review card (the SI-02 human-in-the-loop door)"
  - "SkillTunerPage repointed: one-click apply -> proposeDescription propose door (D-08)"
  - "CandidateCard 'Propose this description' affordance gated on isActionableWinner"
affects: [139-verify-work, SI-02, skill-studio-triggering-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render-only sibling card (handlers injected as props; no @/lib/api call) reusing the SI-01 ProposalCard idiom"
    - "PRE-approval evidence: per-provider ProviderScoreboard read off the {winner, baseline, run_id} DescriptionScoreboardSnapshot (NOT a TunerScoreboard candidates[]/winner_index blob)"
    - "One honest human-in-the-loop door: replace one-click PATCH /skills with propose -> review-diff -> approve"

key-files:
  created:
    - frontend/src/components/skills/studio/DescriptionProposalCard.tsx
    - frontend/src/components/skills/studio/DescriptionProposalCard.test.tsx
  modified:
    - frontend/src/pages/SkillTunerPage.tsx
    - frontend/src/components/skills/tuner/CandidateCard.tsx
    - frontend/src/components/skills/tuner/CandidateCard.test.tsx
    - frontend/src/pages/SkillTunerPage.test.tsx

key-decisions:
  - "Thin DescriptionProposalCard SIBLING of ProposalCard (RESEARCH Open-Q2) — keeps SI-01's card honesty-locks untouched; no re-eval/force-promote/rerun branches (D-07)"
  - "CandidateCard CTA gated on isActionableWinner: only the non-baseline winner offers 'Propose this description'; baseline winner keeps the honest 'keeping it' path (D-02)"
  - "Removed CandidateCard's inline diff-confirm strip — the DescriptionProposalCard owns the review-diff surface (ONE review door)"
  - "run_id for proposeDescription = in-session runId ?? durable latestRun.run_id"

patterns-established:
  - "Render-only review card: injected onApprove/onReject/onPropose, text-node-only diff/scoreboard (no dangerouslySetInnerHTML, no @/lib/api)"
  - "Scoreboard evidence sourced from an INLINE immutable snapshot ({winner, baseline, run_id}), not a live FK re-read"

requirements-completed: [SI-02]

# Metrics
duration: ~25min
completed: 2026-07-06
---

# Phase 139 Plan 05: Description-Proposal Review Surface + Propose Door Summary

**The Trigger Tuner's one-click "apply winning description" is replaced by an honest propose door: a render-only `DescriptionProposalCard` shows the base→proposed `lineDiff` + the per-provider `ProviderScoreboard` (PRE-approval evidence) with Approve/Reject only, wired through `proposeDescription`/`approveDescriptionProposal`/`rejectDescriptionProposal`.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-06T14:50:00Z (approx)
- **Completed:** 2026-07-06T15:14:41Z
- **Tasks:** 3 (Task 1 TDD RED, Task 2 GREEN, Task 3 wiring)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- **DescriptionProposalCard** (render-only): base→proposed `lineDiff` (emerald add / destructive remove, text nodes only) + the per-provider `ProviderScoreboard` read off `scoreboard_snapshot.winner.cells` / `.baseline.cells` (the `{winner, baseline, run_id}` shape — NOT a `TunerScoreboard` `.candidates`/`.winner_index`) + Approve/Reject only. NO `@/lib/api` call, NO async re_evaling/not_promoted/interrupted/force-promote/rerun branches (D-07), NO raw-HTML sink (T-139-14).
- **SkillTunerPage.handleConfirmWinner repointed** from `updateSkill(skillId, {description})` (one-click PATCH /skills, unaudited `source='manual'` version) to `proposeDescription(skillId, runId)` → holds the `SkillProposal` in state → mounts `<DescriptionProposalCard>` under the winner area wired to `approveDescriptionProposal`/`rejectDescriptionProposal` (D-08). Winner-banner copy updated "press Use to apply" → "Propose this description". Baseline honest "keeping it" path preserved (D-02). `updateSkill`/PATCH still available via `useSkills` for the SkillsPage manual-edit path.
- **CandidateCard** CTA re-labeled "Use"/"Use this →" → "Propose this description", gated on `isActionableWinner` (baseline/non-winner cards show no propose affordance); inline diff-confirm strip removed so there is ONE review door; show-more clamp + held-out score preserved; inline propose-error surfaced (WR-04 honesty).

## Task Commits

Each task committed atomically:

1. **Task 1: DescriptionProposalCard.test.tsx (RED)** - `27c5f943` (test)
2. **Task 2: DescriptionProposalCard.tsx (GREEN)** - `6ea9d039` (feat)
3. **Task 3: Repoint SkillTunerPage → propose door + re-label CandidateCard (+ test updates)** - `bbfe0581` (feat)

_TDD note: Task 1 (RED) and Task 2 (GREEN) are separate commits per the tdd="true" flow._

## Files Created/Modified
- `frontend/src/components/skills/studio/DescriptionProposalCard.tsx` - Render-only description-proposal card: lineDiff + ProviderScoreboard (proposed vs current) + Approve/Reject, honesty-gated, no `@/lib/api`.
- `frontend/src/components/skills/studio/DescriptionProposalCard.test.tsx` - 4 vitest cases: diff (remove+add) + ≥2 scoreboard cells, Approve/Reject fire, promoted hides actions, text-node-only render. Fixture uses the literal `{winner, baseline, run_id}` snapshot.
- `frontend/src/pages/SkillTunerPage.tsx` - `handleConfirmWinner` → `proposeDescription`; new `descProposal`/`descError` state + `handleApproveDescription`/`handleRejectDescription`; `DescriptionProposalCard` mounted under the winner area; winner-banner copy; dropped `updateSkill`/`TunerCandidate` imports (now unused here).
- `frontend/src/components/skills/tuner/CandidateCard.tsx` - Propose door (label + gating), removed diff-confirm strip, `onConfirm: () => Promise<void> | void`, dropped `currentDescription` prop.
- `frontend/src/components/skills/tuner/CandidateCard.test.tsx` - Rewritten for the propose flow (propose click → onConfirm, WR-04 inline error, baseline/non-winner no affordance, D-11 clamp).
- `frontend/src/pages/SkillTunerPage.test.tsx` - Added `proposeDescription`/`approve`/`reject` to the `@/lib/api` mock + `DESC_PROPOSAL` fixture; rewrote the apply test to the propose→review→approve flow.

## Decisions Made
- **DescriptionProposalCard as a thin sibling** of ProposalCard (RESEARCH Open-Q2 resolved to "sibling") rather than a variant branch inside ProposalCard — keeps SI-01's honesty-locks untouched and drops every async branch SI-02 doesn't have.
- **CandidateCard CTA gated on `isActionableWinner`** — only the non-baseline winner card shows the propose button. `proposeDescription(skillId, runId)` derives the winner server-side, so proposing a non-winner is meaningless; this also preserves the D-02 baseline honesty path.
- **Removed the CandidateCard inline diff-confirm strip** (the plan offered remove-or-repurpose) so the DescriptionProposalCard is the single review-diff door.
- **`onConfirm` signature simplified to `() => Promise<void> | void`** — the candidate arg was unused for the propose flow; simplifying it also cleared the `TunerCandidate`/`currentDescription` unused-symbol errors under `noUnusedLocals`/`noUnusedParameters`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dropped now-unused symbols to satisfy `noUnusedLocals`/`noUnusedParameters`**
- **Found during:** Task 3 (repoint SkillTunerPage)
- **Issue:** Repointing `handleConfirmWinner` off `updateSkill` and removing the CandidateCard diff-confirm strip left `updateSkill`, `TunerCandidate` (SkillTunerPage) and `currentDescription` (CandidateCard) unused. The app tsconfig enables `noUnusedLocals` + `noUnusedParameters`, so leaving them would break the build.
- **Fix:** Removed `updateSkill` from the `useSkills()` destructure, removed `type TunerCandidate` from the api import, and dropped `currentDescription` from `CandidateCard` Props + the SkillTunerPage wiring. `updateSkill`/PATCH /skills remains intact in `api.ts` + `useSkills` for the SkillsPage manual-edit path (plan constraint honored).
- **Files modified:** frontend/src/pages/SkillTunerPage.tsx, frontend/src/components/skills/tuner/CandidateCard.tsx
- **Verification:** `npx tsc --noEmit -p tsconfig.app.json` reports no errors in any of the four touched files.
- **Committed in:** `bbfe0581` (Task 3 commit)

**2. [Rule 1 - Bug] Updated co-located tests that asserted the removed one-click behavior**
- **Found during:** Task 3
- **Issue:** `CandidateCard.test.tsx` and one `SkillTunerPage.test.tsx` case asserted the old diff-confirm strip / "Use" / `updateSkill` flow that this plan removes — they would fail at HEAD.
- **Fix:** Rewrote `CandidateCard.test.tsx` for the propose door (propose click → onConfirm, WR-04 inline error, baseline/non-winner no affordance, D-11 clamp) and rewrote the SkillTunerPage apply case to the propose→review→approve flow (+ added the description-proposal mocks). No production behavior changed by the test edits.
- **Files modified:** frontend/src/components/skills/tuner/CandidateCard.test.tsx, frontend/src/pages/SkillTunerPage.test.tsx
- **Verification:** 122/122 tests green across the studio + tuner suites.
- **Committed in:** `bbfe0581` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 test-maintenance bug)
**Impact on plan:** Both are direct consequences of the planned refactor (co-located symbol/test maintenance). No scope creep; no production behavior beyond the plan.

## Issues Encountered
- **Pre-existing tsc debt (out of scope):** `npx tsc --noEmit -p tsconfig.app.json` reports errors in ~16 files never touched by this plan (StreamsProvider, streamsStore, MessageSkeleton, SettingsPage, NavPanel, and several `__tests__` files) — the known SEED-056 vitest rot + pre-existing type debt. None are in the four files this plan touched. Not fixed (SCOPE BOUNDARY); logged here for the verifier.

## User Setup Required
None - no external service configuration required. (Backend routes + migration 090 were landed by Plans 139-01..04; live UAT is driven at `/gsd:verify-work 139`.)

## Next Phase Readiness
- The whole user-visible SI-02 loop is now wired: run Tuner → a non-baseline candidate wins on held-out → "Propose this description" → review diff + per-provider scoreboard → Approve → new version.
- **Deferred to `/gsd:verify-work 139`:** live 4-axis + G-4 UAT (cross-provider scoreboard on the card, honest baseline-wins → no propose, parallel-thread isolation, snapshot immutability on Tuner re-run, one-version-on-approve) — SC#10 / D-12 / D-15.
- Note: after Approve, the local `skill.description` in `useSkills` is not refetched in-session (the promoted card states the description now drives triggering; the durable write + 079 version land server-side). A refetch-on-approve is a possible polish item, not a blocker.

## Self-Check: PASSED
- Files verified present: DescriptionProposalCard.tsx, DescriptionProposalCard.test.tsx, SkillTunerPage.tsx, CandidateCard.tsx (all FOUND).
- Commits verified present: `27c5f943`, `6ea9d039`, `bbfe0581` (all FOUND).
- Tests: 28/28 across the three affected files; 122/122 across the full studio + tuner suites.

---
*Phase: 139-self-improve-proposer-description-only-stretch*
*Completed: 2026-07-06*
