/**
 * Phase 123 Plan 05 Task 2b (TRIG-01) — LiveRunCard (sketch 043-A).
 *
 * Per-provider live progress lanes over the SSE stream
 * (tuner_progress/tuner_provider_done/tuner_complete), a NEVER-VANISHING elapsed
 * timer derived from a STABLE start-ts (the 095 lesson — never reset on transient
 * stream-ends), an explicit "runs in the background — reconciles on return", and
 * Cancel. A QUEUED provider shows queued, NEVER a fake percent (queued ≠ running —
 * T-123-05-03).
 *
 * Stub scaffolding placeholder — implemented to GREEN in Task 2b (TDD).
 */

/** One provider lane in the live run. `status` carries the honest queued≠running
 *  distinction (043-A): a queued lane never shows a fabricated percent. */
export interface ProviderLane {
  provider: string
  model: string
  status: "queued" | "running" | "done"
  score?: number
}

interface Props {
  lanes: ProviderLane[]
  /** The STABLE run start-ts (ms epoch) — the elapsed timer derives from this and
   *  never resets on a transient stream-end (the 095 never-vanishes lesson). */
  startTs: number | null
  phase: "running" | "error"
  error: string | null
  onCancel: () => void
}

export function LiveRunCard({
  lanes: _lanes,
  startTs: _startTs,
  phase: _phase,
  error: _error,
  onCancel: _onCancel,
}: Props) {
  return null
}
