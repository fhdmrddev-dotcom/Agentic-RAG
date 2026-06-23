/**
 * Phase 123 Plan 05 Task 2a (TRIG-01) — CandidateCard (sketch 042-A).
 *
 * One card per candidate description carrying its HELD-OUT score + the per-provider
 * grid (rendered via ProviderScoreboard). "Use → confirm & save" reveals an explicit
 * diff-confirm strip (old vs new description); on confirm it writes the live
 * description via the injected onConfirm (which wraps useSkills().updateSkill →
 * PATCH /skills/{id}, re-lints) and states the skill begins firing immediately —
 * NEVER auto-applied (042-A / D-03 / T-123-05-02).
 *
 * Stub scaffolding placeholder — implemented to GREEN in Task 2a (TDD).
 */
import type { TunerCandidate } from "@/lib/api"

interface Props {
  candidate: TunerCandidate
  /** Whether this candidate is the server-picked winner (by held-out score). */
  isWinner: boolean
  /** The skill's current live description — the LEFT side of the diff-confirm strip. */
  currentDescription: string
  /** Author-confirm winner write (wraps updateSkill). Fires ONLY on explicit confirm. */
  onConfirm: (candidate: TunerCandidate) => Promise<void> | void
}

export function CandidateCard({
  candidate: _candidate,
  isWinner: _isWinner,
  currentDescription: _currentDescription,
  onConfirm: _onConfirm,
}: Props) {
  return null
}
