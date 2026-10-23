/**
 * Phase 295-05 (RUN-04 / D-22 / UI-SPEC C.1) — why a stopped run stopped, beside its band.
 *
 * A LEAF, the `WaitingOnLine` shape: no hook, no API import, no sentence of its own. The server
 * resolved `end_reason` from what was RECORDED (the failed step's reason, else the run's audit
 * reason, else a cancel reason); this joins it to `evidenceVocabulary.ts`'s words:
 *
 *   failed    + reason → "Why it stopped: <reason>"
 *   failed    + none   → NO_REASON_RECORDED (the sentence lives in ONE home, the vocabulary)
 *   cancelled + reason → "Why it stopped: <reason>"
 *   cancelled + none   → nothing (the band's Cancelled is the reading)
 *   any other status   → nothing
 *
 * The reason can carry vendor text, so it renders as a text child only (T-214-11-01). Muted, and
 * NOT a live region: the band's own announcement for a failed run already covers it.
 */
import { NO_REASON_RECORDED, whyItStopped } from "@/components/workflows/evidenceVocabulary"

export function RunEndReasonLine({
  status,
  endReason,
}: {
  status?: string | null
  endReason?: string | null
}) {
  const reason = typeof endReason === "string" && endReason.trim() ? endReason.trim() : null
  let text: string | null = null
  if (status === "failed") text = reason ? whyItStopped(reason) : NO_REASON_RECORDED
  else if (status === "cancelled" && reason) text = whyItStopped(reason)
  if (text === null) return null
  return (
    <span className="text-xs text-muted-foreground" data-testid="run-end-reason">
      {text}
    </span>
  )
}
