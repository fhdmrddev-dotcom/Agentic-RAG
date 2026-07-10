---
phase: 137-skill-evals-panel-ui-panel-01
plan: 04
subsystem: ui
tags: [react, skills, evals, self-improvement, proposal, lineDiff, studio, vitest]

# Dependency graph
requires:
  - phase: 135-self-improvement-loop-si-01
    provides: "SkillEvalSection proposal block (propose->diff->approve->re-eval->promote/not-promote lifecycle), renderGateCounts, the SkillProposal/PromotionGate types, and the shared lineDiff util"
  - phase: 134-eval-results-honest-verdict-ratings
    provides: "eval readout + honest verdict conventions the proposal card reconciles against"
provides:
  - "ProposalCard.tsx — the Studio-re-skinned, render-only self-improvement proposal lifecycle card (handlers injected as props)"
  - "ProposalCard.test.tsx — fresh unit coverage of all six statuses + the two honesty locks"
affects: [137-05, EvalsTab, PANEL-01, skill-studio]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render-only lifecycle component: all mutation handlers injected as props (no @/lib/api import); the stateful EvalsTab (Plan 05) lifts the battle-tested SkillEvalSection handlers and passes them in"
    - "One renderer, two homes: the base->proposed diff renders via the SAME shared lineDiff util the Versions tab uses"
    - "renderGateCounts lifted VERBATIM (null gate renders nothing — never a fabricated pass)"
    - "Studio status chip: glyph + word + color, never color alone (WCAG); honest wording only, re-skins chrome without altering the lifecycle"

key-files:
  created:
    - frontend/src/components/skills/studio/ProposalCard.tsx
    - frontend/src/components/skills/studio/ProposalCard.test.tsx
  modified: []

key-decisions:
  - "Kept the card render-only: no @/lib/api call lives in this file so it cannot mutate state, only display the reconciled server row (T-137-04)"
  - "reEvalLive is an optional ReactNode prop rendered inside the re_evaling/approved branches — EvalsTab owns the live progress list, the card just slots it in"
  - "onPropose is an optional prop: a null/dismissed proposal offers 'Propose improvement' only when wired; otherwise the card renders nothing"
  - "Used a data-testid='proposal-diff' on the diff container for robust unit assertions"

patterns-established:
  - "Studio proposal chrome: rounded surface card + header status chip + diff/rationale/evidence/status-row stack, aligned to the 055 chips/tokens/honesty language (D-08 'lightly re-skinned')"

requirements-completed: [PANEL-01]

# Metrics
duration: 25min
completed: 2026-07-03
---

# Phase 137 Plan 04: Studio ProposalCard Summary

**The 135 propose→diff→approve/reject→auto-re-eval→promote/not-promote card, re-skinned render-only for the Skill Studio Evals tab — every honesty lock (rationale/evidence, gate counts, override_forced, honest interrupted) intact and the diff via the shared lineDiff util.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-03T17:24Z
- **Completed:** 2026-07-03T17:49Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `ProposalCard.tsx` — a render-only lifecycle card that renders all six `SkillProposal` statuses (proposed / approved / re_evaling / promoted / not_promoted / interrupted) with the 135 honesty locks preserved: proposer rationale + evidence always shown, `renderGateCounts` lifted verbatim (null gate → nothing), `override_forced` echoed un-softened on the promoted branch, and the honest "interrupted — not promoted" + Re-run copy.
- The base→proposed diff renders via the SAME `lineDiff` util the Versions tab uses (one renderer, two homes) with add=emerald / remove=destructive / context=foreground/70 rows.
- Handlers (`onPropose`/`onApprove`/`onReject`/`onRerun`/`onForcePromote`) are injected props — no `@/lib/api` call in the file, so the card cannot show an optimistic "promoted" (T-137-04); it renders the reconciled server row only.
- `ProposalCard.test.tsx` — a fresh spec (not leaning on rotted siblings) with 7 passing cases: one per status + the diff add/remove row assertion + the gate=null "no fabricated pass" honesty lock.
- Studio chrome: a glyph+word status chip (never color alone, WCAG) re-skins the state per the 055 chips/tokens/honesty language (D-08) without touching the lifecycle flow or copy semantics.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the re-skinned ProposalCard** - `d50a68a4` (feat)
2. **Task 2: Author the ProposalCard spec (fresh)** - `af357d96` (test)

_Task 1 is a `tdd="true"` task whose plan-declared automated gate is `tsc --noEmit` (the completed component compiles clean under `noUnusedLocals`/`noUnusedParameters`); Task 2's 7 vitest cases are the real green gate — so this plan intentionally ships as feat→test rather than the strict RED→GREEN order._

## Files Created/Modified
- `frontend/src/components/skills/studio/ProposalCard.tsx` - The Studio-re-skinned, render-only proposal lifecycle card (324 lines).
- `frontend/src/components/skills/studio/ProposalCard.test.tsx` - Fresh unit spec: 7 cases across the six statuses + honesty locks (171 lines).

## Decisions Made
- **Render-only by construction** — no `@/lib/api` import; the card is handed the reconciled `SkillProposal` row and injected handlers. This is what preserves T-137-04 (no optimistic promote) structurally.
- **`reEvalLive` as an injected ReactNode** — the re_evaling/approved branches slot in EvalsTab's live progress element rather than the card owning any streaming state.
- **`data-testid="proposal-diff"`** on the diff container for a robust, whitespace-immune diff assertion.

## Deviations from Plan

None - plan executed exactly as written.

The plan's Task 1 note explicitly overrides the strict TDD RED→GREEN order (the automated gate is `tsc`, Task 2 authors the spec fresh), so shipping Task 1 as a `feat` commit before the Task 2 `test` commit follows the plan's stated intent — not a deviation.

## Issues Encountered
- The worktree had no `frontend/node_modules` (gitignored, not copied into a fresh worktree). Resolved by creating a Windows directory **junction** from the worktree's `frontend/node_modules` to the main repo's `frontend/node_modules` so `tsc`/`vitest` resolve dependencies — no tracked files affected, no contamination of either tree.
- The word `dangerouslySetInnerHTML` initially appeared inside a code comment (describing the T-137-05 mitigation), which would false-trip the acceptance grep gate. Reworded the comment to "no raw-HTML injection sink is used" — the grep gate now reads 0.

## Verification
- `npx vitest run src/components/skills/studio/ProposalCard.test.tsx` → **7/7 passed**.
- `npx tsc -p tsconfig.json --noEmit` → **clean** (exit 0), whole frontend including the new files.
- Grep gates: `lineDiff` present; `override_forced|gate` = 15 (≥2); `from "@/lib/api"` = 0; `dangerouslySetInnerHTML` = 0.

## Known Stubs
None — the card is render-only by design (handlers are props wired by Plan 05's EvalsTab); this is the intended seam, documented in the plan, not an unwired stub.

## Next Phase Readiness
- `ProposalCard` is ready for Plan 05 (`EvalsTab`) to mount and inject the lifted `SkillEvalSection` handlers (`onPropose`/`onApprove`/`onReject`/`onRerun`/`onForcePromote`) + the shared eval live-progress node as `reEvalLive`.
- No backend, migration, or API surface touched; no cross-provider path involved (pure render component).

## Self-Check: PASSED
- FOUND: frontend/src/components/skills/studio/ProposalCard.tsx
- FOUND: frontend/src/components/skills/studio/ProposalCard.test.tsx
- FOUND commit: d50a68a4 (feat — ProposalCard component)
- FOUND commit: af357d96 (test — ProposalCard spec)

---
*Phase: 137-skill-evals-panel-ui-panel-01*
*Completed: 2026-07-03*
