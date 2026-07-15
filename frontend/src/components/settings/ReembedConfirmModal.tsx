import { useEffect, useRef } from "react"
import { AlertTriangle, TriangleAlert, RefreshCw, ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Phase 111.1 Plan 06 — D-03 destructive re-embed confirm gate (sketch 025
 * winner: C's weight-not-friction frame + A's 4-fact grid).
 *
 * Fired by confirm-on-save (D-02) when the embedding model OR dimensions changed.
 * A SERIOUS, attention-demanding gate (danger rail, alert icon, forceful copy,
 * deliberate two-step) — NOT a toast, NOT type-to-confirm theatre. The act is
 * rare, deliberate, reversible, resumable, and non-destructive, so friction is
 * proportional: weight, not friction.
 *
 * It MUST name all FIVE D-03 facts unmissably:
 *   1. how many chunks will re-embed (the LIVE count)
 *   2. the target model
 *   3. that search quality dips until the job finishes (the recall dip)
 *   4. a rough ETA
 *   5. that it's reversible only by switching back + re-embedding
 *
 * Cancel = no change. Confirm = the save proceeds (which the Plan 05 backend
 * turns into the re-embed job kickoff). Deep Midnight danger/warning tokens.
 */

interface ReembedConfirmModalProps {
  open: boolean
  /** Live chunk count to re-embed (null while still loading — shows a fallback). */
  chunkCount: number | null
  /** The target model the operator is switching TO. */
  targetModel: string
  /** Target dimensions (shown beside the model in the fact grid). */
  targetDims: number
  onCancel: () => void
  onConfirm: () => void
  /** Disables Confirm while the save is in flight. */
  busy?: boolean
}

// Rough ETA: the Plan 05 job batches at ~64 chunks/pass; a small-corpus estimate
// of ~700 chunks/min is honest enough for "a rough ETA" (D-03 asks for rough,
// not exact). Floors at "< 1 min" for tiny corpora.
function estimateEta(chunks: number | null): string {
  if (chunks == null || chunks <= 0) return "a few minutes"
  const minutes = Math.max(1, Math.round(chunks / 700))
  return minutes <= 1 ? "~1 min" : `~${minutes} min`
}

export function ReembedConfirmModal({
  open,
  chunkCount,
  targetModel,
  targetDims,
  onCancel,
  onConfirm,
  busy = false,
}: ReembedConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  // UX-01 (WCAG): Escape cancels; focus the primary action on open so the gate
  // is keyboard-operable and the focus order is sane.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKey)
    confirmRef.current?.focus()
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null

  const countLabel = chunkCount == null ? "your library" : chunkCount.toLocaleString()
  const eta = estimateEta(chunkCount)

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-5 bg-background/80 backdrop-blur-sm animate-[fadeSlideUp_0.3s_ease-out]">
      {/* Backdrop-dismiss — click outside the card closes; Escape also closes (the
          keydown effect above). Kept out of the tab order (tabIndex=-1) so it never
          steals focus from the card's controls; the aria-label names the action. */}
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reembed-modal-title"
        aria-describedby="reembed-modal-desc"
        className="relative w-full max-w-md overflow-hidden rounded-xl bg-card border border-border shadow-2xl"
      >
        {/* Danger rail — Deep Midnight danger→warning gradient (not generic red) */}
        <div className="h-[3px] bg-gradient-to-r from-destructive to-amber-400" />

        <div className="p-6">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-md bg-destructive/15 border border-destructive/30">
            <TriangleAlert className="h-5 w-5 text-destructive" />
          </div>

          <h2 id="reembed-modal-title" className="font-headline text-lg font-bold text-foreground mb-1.5">
            This will re-embed your library
          </h2>
          <p id="reembed-modal-desc" className="text-sm text-muted-foreground mb-5">
            Switching to <b className="text-foreground font-mono">{targetModel}</b> rebuilds the search
            vectors for every document in your knowledge base.
          </p>

          {/* A's 4-fact grid — chunks · ETA · target model · runs-in-background */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-md bg-muted/30 ghost-border px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Chunks to re-embed</div>
              <div className="text-lg font-mono font-bold text-foreground">{countLabel}</div>
            </div>
            <div className="rounded-md bg-muted/30 ghost-border px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Estimated time</div>
              <div className="text-lg font-mono font-bold text-foreground">{eta}</div>
            </div>
            <div className="rounded-md bg-muted/30 ghost-border px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Target model</div>
              <div className="text-sm font-mono text-foreground truncate" title={targetModel}>
                {targetModel}{targetDims ? ` · ${targetDims}d` : ""}
              </div>
            </div>
            <div className="rounded-md bg-muted/30 ghost-border px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Runs</div>
              <div className="text-sm font-mono text-foreground">in background</div>
            </div>
          </div>

          {/* Consequence list — the recall dip + non-destructive + irreversibility */}
          <ul className="mb-5 space-y-0 text-sm">
            <li className="flex items-start gap-3 border-t border-border/50 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              <span className="text-muted-foreground">
                <b className="text-foreground">Search quality dips</b> until the job finishes — chunks not yet
                re-embedded drop out of results, then recover.
              </span>
            </li>
            <li className="flex items-start gap-3 border-t border-border/50 py-3">
              <RefreshCw className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <span className="text-muted-foreground">
                <b className="text-foreground">Resumable &amp; non-destructive.</b> Old vectors are kept until each
                replacement is written; an interrupted run picks up where it stopped.
              </span>
            </li>
            <li className="flex items-start gap-3 border-t border-border/50 py-3">
              <ArrowLeftRight className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                <b className="text-foreground">Reversible only by switching back</b> + re-embedding again — there is no
                instant undo.
              </span>
            </li>
          </ul>

          <div className="flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button
              ref={confirmRef}
              size="sm"
              onClick={onConfirm}
              disabled={busy}
              className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 border-none font-semibold"
            >
              {busy ? "Starting…" : "Re-embed now →"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
