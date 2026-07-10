---
phase: 135-self-improvement-loop-si-01
plan: 07
subsystem: ui
tags: [react, typescript, self-improvement, proposal-card, line-diff, promotion-gate, sse-reuse]

# Dependency graph
requires:
  - phase: 135 (Plan 06 — frontend contracts)
    provides: lineDiff.ts + SkillProposal/PromotionGate/ProposalApproveResult types + the seven proposal api helpers
  - phase: 135 (Plans 04/05 — backend proposal lifecycle)
    provides: LOCKED /skills/{id}/proposals* endpoints + reconcile-on-read gate counts
provides:
  - "The full self-improvement loop wired into ONE thin card inside SkillEvalSection: propose (D-01) -> line-diff review (D-09) + rationale/evidence (D-10) -> approve/reject -> live re-eval readout (Pattern 3) -> honest promoted/not-promoted/interrupted verdict with always-displayed gate counts (D-06/D-13/D-14)"
affects: [137 (Skill Evals Panel — supersedes this thin surface), self-improvement UX]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Re-eval progress reuses the existing eval companion-run SSE via the shared attach()/subscribeToRun machinery (Pattern 3) — zero new stream code; loadReadout reconciles the proposal (status + gate) on every readout when reEvalProposalIdRef is set"
    - "DB-is-source-of-truth proposal card: every action (propose/approve/reject/rerun/force-promote) re-fetches the proposal from the DB — no optimistic client state (T-135-04)"

key-files:
  created: []
  modified:
    - frontend/src/components/skills/SkillEvalSection.tsx

key-decisions:
  - "D-08: the loop is one thin, undesigned card inside SkillEvalSection (137 design fence honored — no design-system chrome, matches the file's --skip-ui header)"
  - "D-13: a single renderGateCounts(gate) helper is called from BOTH the promoted and not_promoted branches so the case-matched honest counts are always displayed alongside the verdict, not only on failure; a null gate (interrupted/unreconciled) renders nothing"
  - "D-14: an interrupted/stuck re-eval surfaces an honest 'interrupted — not promoted' state with a Re-run re-eval affordance (rerunProposalReeval + reattach) — never a frozen 're-evaling' spinner"
  - "The card wrapper renders on (evalHasResults OR an active proposal) so it stays mounted through the re-eval (when running flips evalHasResults false); the Propose button alone is gated on evalHasResults"

requirements-completed: [SI-01]

# Metrics
duration: 19min
completed: 2026-07-02
---

# Phase 135 Plan 07: SkillEvalSection Proposal Card Summary

**The entire self-improvement loop wired into one thin card inside `SkillEvalSection` under the eval readout (D-08): "Propose improvement" (D-01) -> a unified red/green line diff (D-09) of base vs proposed instructions with rationale + which-evidence-drove-it (D-10) -> approve/reject -> the existing eval live readout reattached to the companion re-eval run (Pattern 3) -> an honest terminal verdict (promoted / not-promoted+force-promote / interrupted+re-run) with the case-matched gate counts always displayed (D-06/D-13/D-14) — all DB-sourced, never optimistic.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-07-02T03:21Z
- **Completed:** 2026-07-02T03:40Z
- **Tasks:** 2
- **Files modified:** 1 (0 created, 1 modified)

## Accomplishments

- **Task 1 — Propose button + proposal card + line diff (D-01/D-08/D-09/D-10):** added `proposal`/`proposalLoading`/`proposalError` state (reset in the `[skillId]` effect exactly like the eval state — skill-switch safe); hydrate the latest non-rejected proposal from the DB on mount via `listProposals` (module-level `pickActiveProposal` picks the most-recently-updated, `rejected` -> no card); a `Sparkles` "Propose improvement" button mirroring `handleRun`, enabled only once the eval run has durable results (D-01); a thin card rendering `lineDiff(base_instructions, proposed_instructions)` (removed red / added green / unchanged neutral, `+ `/`- ` prefixes in the existing `<pre>`/`<span>` idiom, scrollable for long bodies) plus `rationale` + `evidence_summary` (D-10).
- **Task 2 — lifecycle handlers + live re-eval + gate counts + interrupted (D-06/D-13/D-14):** four owner-gated handlers (`handleApprove`/`handleReject`/`handleRerun`/`handleForcePromote`), each awaits the api call THEN re-fetches the proposal from the DB via `refetchProposal` (never optimistic — T-135-04); approve/rerun reattach the shared eval live readout to `re_eval_run_id` through the existing `attach()`/`subscribeToRun` machinery (Pattern 3 — no new EventSource) and set `reEvalProposalIdRef` so `loadReadout` reconciles the proposal (status + gate) on the run's terminal; a status-driven action row (`proposed` -> Approve/Reject, `re_evaling` -> the reused live readout, `promoted` -> gate counts, `not_promoted` -> gate counts + Force promote, `interrupted` -> Re-run re-eval); a shared `renderGateCounts(gate)` called from BOTH the `promoted` and `not_promoted` branches (D-13 always displayed).

## Task Commits

Each task committed atomically:

1. **Task 1: propose button + proposal card with unified line diff** - `8b091a81` (feat)
2. **Task 2: approve/reject/rerun/force-promote + honest gate counts + interrupted** - `2b514480` (feat)

## Files Created/Modified

- `frontend/src/components/skills/SkillEvalSection.tsx` — the whole self-improvement loop added under the eval readout: proposal state + skill-switch reset + DB hydration; `handlePropose`; module-level `pickActiveProposal` + `renderGateCounts`; `reEvalProposalIdRef` + `refetchProposal` + `reattachProposalReeval`; the `loadReadout` proposal-reconcile hook; four lifecycle handlers; and the status-driven proposal card (line diff + rationale + evidence + action row + terminal verdicts).

## Verification

- **Task 1 tsc gate:** `! ( npx tsc --noEmit -p tsconfig.json | grep -Ei "SkillEvalSection" )` → exit 0 (no SkillEvalSection type errors); full project tsc emitted **0** errors.
- **Task 2 tsc gate + test:** same inverted tsc gate → exit 0 (0 project errors) AND `npx vitest run src/lib/lineDiff.test.ts` → **7/7 green** (the diff the card renders).
- **Acceptance tokens:** `lineDiff` + `proposeImprovement` present; all four of `approveProposal`/`rejectProposal`/`rerunProposalReeval`/`forcePromoteProposal` wired; `renderGateCounts(proposal.gate)` called at exactly two sites (promoted + not_promoted — D-13); `attach(re_eval_run_id)` in both approve + rerun (subscribeToRun reuse); proposal state + `reEvalProposalIdRef` reset in the `[skillId]` effect.
- **Environment note:** run in the worktree `frontend/` against a temporary `node_modules` directory junction to the main checkout's `node_modules` (gitignored, not committed); the junction was REMOVED before returning (main `node_modules` intact).

## Decisions Made

- **137 design fence honored (D-08):** no design-system chrome — plain buttons, `<pre>`/`<span>`, muted text; matches the file's `--skip-ui` header. Phase 137 supersedes this surface.
- **DB is the only source of truth (T-135-04):** no optimistic mutation of the card status anywhere. `refetchProposal` re-reads after every action; the re-eval's terminal reconciles status + gate via `loadReadout`; a `rejected` re-fetch clears the card (which also re-enables "Propose improvement").
- **Card persists across the re-eval:** the wrapper renders on `evalHasResults || an active proposal` (not `evalHasResults` alone) — because `evalHasResults` gates on `!running` and would otherwise hide the whole card the moment the re-eval starts streaming. The Propose button alone stays gated on `evalHasResults`.
- **Re-eval reconcile hook:** `reEvalProposalIdRef` marks that the currently-attached eval readout belongs to a proposal; `loadReadout` then also re-fetches the proposal (status + gate) on every readout. Reset on a fresh eval run (`handleRun`) and on skill switch so it never leaks across runs/skills.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Proposal card would vanish mid-re-eval**
- **Found during:** Task 2 (self-caught during implementation, before commit)
- **Issue:** The Task-1 wrapper `{evalHasResults && (...)}` gates on `!running`; once approve starts the re-eval (`running` true) the entire card — including the live "re-evaluating…" state — would unmount, contradicting D-14's "no frozen/vanished mid-run".
- **Fix:** Wrapper now renders on `(evalHasResults || (proposal && proposal.status !== "rejected"))`; the Propose button is independently gated on `evalHasResults`. The card stays mounted through the whole re-eval.
- **Files modified:** `frontend/src/components/skills/SkillEvalSection.tsx`
- **Commit:** `2b514480`

### Placement note (not a deviation)

D-08's "under the eval readout" is honored: the card sits inside `SkillEvalSection` directly below the run-status line, the per-run honest verdict line, and the live per-arm progress (the eval readout summary). The detailed per-case with/without list renders immediately after the card. Relocating the ~70-line card block strictly below the per-case list was declined as unnecessary churn (no automated check tests placement, and the card is unambiguously "under the eval readout").

## Authentication Gates

None — no auth gates encountered. All proposal endpoints carry `getAuthHeaders()` (owner-gated server-side; the card never trusts its own state for authorization — T-135-01 accepted).

## Known Stubs

None — every branch renders real DB-sourced data. The `not_promoted` "failing cases" evidence is the re-eval's per-case readout (loaded into the shared readout on terminal), not a placeholder; the gate counts come from the server reconcile (D-13), not a client guess.

## Threat Flags

None — the card introduces no new security surface. It calls only the LOCKED owner-gated proposal routes and re-fetches from the DB after every action (T-135-04 mitigation satisfied: no optimistic promote/not-promote; the card cannot show "promoted" unless the server reconciled it). Client-side gating is UX-only (T-135-01 accepted — server owns authorization + the promotion decision).

## Next Phase Readiness

- The full SI-01 loop is now usable end-to-end on the skill's eval surface. Phase 137 (PANEL-01, sketch-gated) will supersede this thin surface with the designed Skill Evals panel — it can lift the same handlers/state and re-skin the render.
- Live SC#10 4-axis UAT (U1–U11, incl. cross-provider proposer + re-eval, interrupted honesty, force-promote) runs at `/gsd:verify-work` per `135-VALIDATION.md` — not a plan task.
- No blockers. If a backend field name drifts at integration it is a one-line touch in Plan 06's types/helpers.

## Self-Check: PASSED

- File verified present: `frontend/src/components/skills/SkillEvalSection.tsx` (modified) and this SUMMARY.
- Commits verified in git log: `8b091a81` (Task 1), `2b514480` (Task 2).
- Verification re-run green: tsc no SkillEvalSection errors + 0 project errors; lineDiff 7/7.
- Working tree clean; node_modules junction removed.

---
*Phase: 135-self-improvement-loop-si-01*
*Completed: 2026-07-02*
