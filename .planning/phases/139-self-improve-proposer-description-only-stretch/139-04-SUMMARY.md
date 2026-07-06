---
phase: 139-self-improve-proposer-description-only-stretch
plan: 04
subsystem: api
tags: [typescript, react, skill-proposal, trigger-tuner, si-02, wire-functions]

# Dependency graph
requires:
  - phase: 135
    provides: "SI-01 SkillProposal type + proposeImprovement/approveProposal/rejectProposal wires + proposalError helper (mirrored here additively)"
  - phase: 139-02
    provides: "backend /skills/{id}/description-proposals routes + the {winner, baseline, run_id} scoreboard_snapshot writer these frontend contracts consume"
provides:
  - "Extended SkillProposal type carrying kind + description fields (proposed_description, base_description, source_tuner_run_id, scoreboard_snapshot)"
  - "Dedicated DescriptionScoreboardSnapshot type ({winner, baseline, run_id}) matching 139-02's writer (NOT TunerScoreboard)"
  - "Four description-proposal wire functions: proposeDescription, approveDescriptionProposal, rejectDescriptionProposal, getLatestDescriptionProposal"
affects: [139-05, description-proposal-card, ProviderScoreboard, Skill-Studio-Triggering-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Type-only circular reference (types/index.ts imports TunerCandidate from api.ts) is safe under verbatimModuleSyntax — fully elided, no runtime import cycle"
    - "Writer/consumer contract pinned on both ends: the client type declares the EXACT top-level keys the backend persists ({winner, baseline, run_id}), not a differently-shaped superset"

key-files:
  created: []
  modified:
    - "frontend/src/types/index.ts"
    - "frontend/src/lib/api.ts"

key-decisions:
  - "Typed scoreboard_snapshot as a dedicated DescriptionScoreboardSnapshot ({winner, baseline, run_id}), NOT TunerScoreboard — TunerScoreboard's candidates[]/winner_index shape has no top-level .winner/.baseline, so the card could not read them off it (the false-green/runtime-undefined trap the checker caught)"
  - "Extended the existing SkillProposal interface with a kind discriminator rather than forking a new proposal type (D-11/D-13 additive)"
  - "approveDescriptionProposal returns a PLAIN SkillProposal (no ProposalApproveResult / re_eval_run_id) — SI-02 has no post-approval re-eval (D-07)"
  - "Reused TunerCandidate/TunerCell (type-only import from api.ts) as the snapshot's winner/baseline members so the card can feed their cells straight into ProviderScoreboard"

patterns-established:
  - "Description-proposal wires mirror the SI-01 proposal wires 1:1 but target /description-proposals; all reuse getAuthHeaders() + proposalError (no hand-rolled auth/error handling)"

requirements-completed: [SI-02]

# Metrics
duration: 12min
completed: 2026-07-06
---

# Phase 139 Plan 04: SI-02 Frontend Contracts Summary

**Extended SkillProposal with a kind discriminator + description fields (typed by a dedicated DescriptionScoreboardSnapshot {winner, baseline, run_id} matching 139-02's writer) and added the four /description-proposals wire functions (propose/approve/reject/getLatest) the Wave-2 card builds against.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-06T14:34Z
- **Completed:** 2026-07-06T14:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `SkillProposal` now carries `kind: "instruction" | "description"`, `proposed_description`, `base_description`, `source_tuner_run_id`, and `scoreboard_snapshot` — everything the description card renders (lineDiff base/proposed + a per-provider ProviderScoreboard).
- New dedicated `DescriptionScoreboardSnapshot` type with EXACTLY the literal top-level keys `{ winner, baseline, run_id }` — the same keys 139-02's writer persists (writer/consumer contract pinned on both ends), reusing the tuner's cell-bearing `TunerCandidate` for the winner/baseline members. Explicitly NOT aliased to `TunerScoreboard`.
- Four description-proposal wire functions added additively to `api.ts`, all targeting `/skills/{id}/description-proposals` and reusing `getAuthHeaders()` + `proposalError`. `approveDescriptionProposal` returns a plain `SkillProposal` (no re-eval, D-07).
- Status union left unchanged; zero TypeScript errors across the whole frontend project after each task.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend SkillProposal + add DescriptionScoreboardSnapshot** - `80830436` (feat)
2. **Task 2: Add description-proposal wires (propose/approve/reject/getLatest)** - `87eaff21` (feat)

## Files Created/Modified
- `frontend/src/types/index.ts` - Added type-only import of `TunerCandidate`; added `DescriptionScoreboardSnapshot` interface; extended `SkillProposal` with `kind` + the four description fields (status union unchanged).
- `frontend/src/lib/api.ts` - Added `proposeDescription`, `getLatestDescriptionProposal`, `approveDescriptionProposal`, `rejectDescriptionProposal` after the SI-01 proposal wires block.

## Decisions Made
- **Dedicated snapshot type, not TunerScoreboard.** `scoreboard_snapshot` is typed as `DescriptionScoreboardSnapshot | null` (`{ winner, baseline, run_id }`), matching what 139-02 Task 2 writes. Aliasing it to `TunerScoreboard` (`{ skill_id, candidates[], winner_index, winner_description }`) would have left the card unable to read `.winner`/`.baseline` — the writer/consumer mismatch the plan calls out.
- **Type-only circular reference is intentional and safe.** `api.ts` already imports `SkillProposal` from `../types`; this plan adds a reverse `import type { TunerCandidate } from "@/lib/api"`. Under `verbatimModuleSyntax: true` both are pure type imports, fully elided at compile — no runtime import cycle. Full-project `tsc` confirms 0 errors.
- **Included the optional `getLatestDescriptionProposal`** for rehydration-on-open (newest-first, returns first row or null), per the plan's optional-fourth-wire note.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The initial Edit was attempted against the shared-checkout path and was correctly rejected by the worktree isolation guard; re-applied against the worktree copy. No content impact.

## Known Stubs
None — this plan delivers interface/type + wire-function contracts only. No hardcoded empty values flow to UI rendering; the placeholders/consumers (card, ProviderScoreboard) are the explicit deliverable of Wave-2 Plan 139-05.

## Next Phase Readiness
- `SkillProposal` + `DescriptionScoreboardSnapshot` + the four wires are ready for 139-05 (the DescriptionProposalCard + Skill Studio Triggering-tab wiring).
- No blockers. Backend routes are contracted by 139-02 (same wave); frontend contracts here mirror the backend response shape byte-for-byte.

---
*Phase: 139-self-improve-proposer-description-only-stretch*
*Completed: 2026-07-06*
