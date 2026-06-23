/**
 * Phase 123 Plan 05 Task 2a (TRIG-01) — CandidateCard (sketch 042-A).
 *
 * One card per candidate description carrying its HELD-OUT score + the per-provider
 * grid (rendered via ProviderScoreboard). "Use → confirm & save" reveals an explicit
 * diff-confirm strip (old vs new description); on confirm it writes the live
 * description via the injected onConfirm (which wraps useSkills().updateSkill →
 * PATCH /skills/{id}, re-lints) and states the skill begins firing immediately —
 * NEVER auto-applied (042-A / D-03 / T-123-05-02). The author picks BY HELD-OUT score
 * (40% never used to generate the candidates).
 */
import { useState } from "react"
import { Crown, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ProviderScoreboard } from "./ProviderScoreboard"
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

export function CandidateCard({ candidate, isWinner, currentDescription, onConfirm }: Props) {
  // The diff-confirm strip is hidden until the author selects "Use" — revealing it is
  // NOT the write; confirming inside it is (no auto-apply, T-123-05-02).
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const handleConfirm = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onConfirm(candidate)
      setDone(true)
      setConfirming(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      data-testid="candidate-card"
      className={cn(
        "rounded-xl ghost-border bg-card/50 p-4 shadow-sm flex flex-col gap-3",
        isWinner && "ring-1 ring-primary/40",
      )}
    >
      {/* Header: held-out score (the number the author picks by) + winner crown. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            {isWinner && <Crown className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />}
            <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
              {candidate.is_baseline ? "current (baseline)" : isWinner ? "winner" : "candidate"}
            </span>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{candidate.description}</p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">held-out</span>
          <span className="text-lg font-mono font-bold tabular-nums text-foreground">
            {candidate.held_out_score.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Per-provider grid — every cell shows both fires + no-false (042-A). */}
      <ProviderScoreboard cells={candidate.cells} />

      {/* Author-confirm flow: Use → reveal diff strip → confirm (the only write). */}
      {done ? (
        <p className="text-xs text-[hsl(var(--panel-status-done))] font-mono">
          Saved · this description now drives firing.
        </p>
      ) : confirming ? (
        <div data-testid="candidate-diff-confirm" className="rounded-lg ghost-border bg-card/40 p-3 flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            confirm · writes the live description (re-lints)
          </p>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider font-mono text-[hsl(0_70%_72%)]">current</span>
              <span className="text-muted-foreground line-through whitespace-pre-wrap break-words">
                {currentDescription || "(empty)"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider font-mono text-[hsl(var(--panel-status-done))]">new</span>
              <span className="text-foreground whitespace-pre-wrap break-words">{candidate.description}</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The skill begins firing on this description immediately. Nothing is applied until you confirm.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={saving}>
              {saving ? "Saving…" : "Confirm & save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
            Use
          </Button>
        </div>
      )}
    </div>
  )
}
