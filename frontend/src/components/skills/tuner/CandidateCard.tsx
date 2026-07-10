/**
 * Phase 123 Plan 05 Task 2a (TRIG-01) — CandidateCard (sketch 042-A).
 * Phase 139 Plan 05 (SI-02, D-08) — the one-click "apply" is replaced by the honest
 * PROPOSE door.
 *
 * One card per candidate description carrying its HELD-OUT score + the per-provider
 * grid (rendered via ProviderScoreboard). The ACTIONABLE winner (a rewrite that beat
 * the current description) offers "Propose this description" — it opens a review
 * proposal (the DescriptionProposalCard the page mounts below owns the diff +
 * per-provider scoreboard + Approve/Reject) instead of the old one-click PATCH /skills
 * write. There is ONE review door now (the inline diff-confirm strip is gone). A
 * baseline winner shows NO propose affordance — the honest "keeping it" path
 * (isActionableWinner, D-02). The author picks BY HELD-OUT score (40% never used to
 * generate the candidates).
 */
import { useState } from "react"
import { Crown, Star, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ProviderScoreboard } from "./ProviderScoreboard"
import type { TunerCandidate } from "@/lib/api"

interface Props {
  candidate: TunerCandidate
  /** Whether this candidate is the server-picked winner (by held-out score). */
  isWinner: boolean
  /** Open the propose door for the winning description (proposeDescription →
   *  DescriptionProposalCard). Fires ONLY on an explicit click — never auto-applied
   *  (D-08 / T-123-05-02). */
  onConfirm: () => Promise<void> | void
}

export function CandidateCard({ candidate, isWinner, onConfirm }: Props) {
  // The propose click can fail (network / server) — surface it inline, never silent (WR-04).
  const [proposing, setProposing] = useState(false)
  const [proposed, setProposed] = useState(false)
  const [proposeError, setProposeError] = useState<string | null>(null)
  // D-11: a ~1500-char description (e.g. the `docx` skill) clamps to ~3 lines by default so it
  // never buries the held-out score or the propose action. A "Show more"/"Show less" toggle
  // reveals/re-clamps the full text — purely presentational, no text is removed.
  const [expanded, setExpanded] = useState(false)
  const clampClass = expanded ? "" : "line-clamp-3"

  // 123.1-rev "make the winner pop": the loud green "★ best held-out" treatment AND the propose
  // door fire ONLY for an ACTIONABLE winner — a REWRITE that beat the current description
  // (something to propose). When the server-picked winner IS the baseline (the all-tied /
  // nothing-beat-current case), this card stays calm: the page's winner-verdict banner already
  // says "keeping it", and offering "propose" on the description you ALREADY run would be
  // dishonest. So a baseline winner keeps the quiet crown and NO propose affordance (D-02).
  const isActionableWinner = isWinner && !candidate.is_baseline

  const handlePropose = async () => {
    if (proposing) return
    setProposing(true)
    setProposeError(null)
    try {
      await onConfirm()
      setProposed(true)
    } catch (e) {
      setProposeError(
        e instanceof Error ? e.message : "Couldn't propose the description. Please try again.",
      )
    } finally {
      setProposing(false)
    }
  }

  return (
    <div
      data-testid="candidate-card"
      className={cn(
        "rounded-xl ghost-border bg-card/50 p-4 shadow-sm flex flex-col gap-3",
        // Actionable rewrite winner → loud green ring; a baseline winner stays the quiet violet ring.
        isActionableWinner
          ? "ring-2 ring-[hsl(var(--panel-status-done))]/55 shadow-[0_0_0_1px_hsl(var(--panel-status-done)/0.18)]"
          : isWinner && "ring-1 ring-primary/40",
      )}
    >
      {/* Header: held-out score (the number the author picks by) + the winner signal. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            {isActionableWinner ? (
              // The unmistakable "this is the one to propose" badge (sketch 042-A "★ best held-out").
              <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--panel-status-done))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--background))]">
                <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                best held-out
              </span>
            ) : (
              <>
                {isWinner && <Crown className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />}
                <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
                  {candidate.is_baseline ? "current (baseline)" : isWinner ? "winner" : "candidate"}
                </span>
              </>
            )}
          </div>
          <p
            data-testid="candidate-description"
            className={cn("text-sm text-foreground whitespace-pre-wrap break-words", clampClass)}
          >
            {candidate.description}
          </p>
          <ShowMoreToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">held-out</span>
          <span
            className={cn(
              "font-mono font-bold tabular-nums",
              isActionableWinner ? "text-xl text-[hsl(var(--panel-status-done))]" : "text-lg text-foreground",
            )}
          >
            {candidate.held_out_score.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Per-provider grid — every cell shows both fires + no-false (042-A). */}
      <ProviderScoreboard cells={candidate.cells} />

      {/* Propose door — ONLY the actionable winner offers it (D-02/D-08). The review diff +
          scoreboard + Approve/Reject live in the DescriptionProposalCard the page mounts
          below; this button just opens that door — no direct write. */}
      {isActionableWinner &&
        (proposed ? (
          <p
            data-testid="candidate-proposed"
            className="text-xs text-[hsl(var(--panel-status-done))] font-mono"
          >
            Proposed · review the diff & per-provider scoreboard below.
          </p>
        ) : (
          <div className="flex flex-col items-end gap-1">
            {proposeError && (
              <p
                role="alert"
                data-testid="candidate-propose-error"
                className="text-xs text-destructive font-mono self-stretch text-right"
              >
                {proposeError}
              </p>
            )}
            <Button size="sm" onClick={handlePropose} disabled={proposing}>
              <Sparkles className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              {proposing ? "Proposing…" : "Propose this description"}
            </Button>
          </div>
        ))}
    </div>
  )
}

/** D-11: a small accessible Show more / Show less control that flips the shared clamp
 *  state. A real <button> (not a clickable span) so it stays keyboard-operable and out of
 *  the tab-order trap. Purely presentational — it never removes or transforms text. */
function ShowMoreToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="self-start text-[11px] font-mono text-primary hover:underline focus-visible:underline"
    >
      {expanded ? "Show less" : "Show more"}
    </button>
  )
}
