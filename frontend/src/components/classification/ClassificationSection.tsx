/**
 * Phase 118 Plan 05 Task 1 — ClassificationSection (CLASS-03 / UX-01, the in-panel
 * classification surface). Locked G-2 sketch = sketches/036-classification-suggestion
 * (Winner A: on the doc — row chip + panel card).
 *
 * This is ONE section rendered inside the EXISTING Phase 112 DocumentDetailPanel —
 * NOT a new surface (the 117 RelationshipsSection precedent). Unlike Relationships it
 * owns NO independent GET: the on-upload rule-eval pass stamped the suggestion into
 * `metadata._classification` (D-118-5), so the section reads it straight off the
 * `suggestion` prop (zero new fetch — the same object the DocumentList row chip uses).
 *
 * Load-bearing honesty (carried from 028/112/116/117):
 *  - A rule match is DETERMINISTIC → the card shows the matched rule + condition_summary
 *    as provenance, NEVER a fabricated confidence % (the 028/036 honesty principle).
 *  - "Suggested" ≠ "moved": the suggested state reads instantly as NOT yet moved — the
 *    file is still where it was uploaded until you Accept.
 *  - Mutations re-fetch (no optimistic splice): Accept/Dismiss/Undo claim success only
 *    after a 200, then call onChanged() (the parent's loadDocuments reconcile). The
 *    section re-renders from the freshly-resolved `suggestion` prop — never a local
 *    optimistic mutation.
 *  - The accepted state renders the audit receipt + a reversible Undo (D-118-6 — Undo
 *    reuses the existing moveDocument(id, prior_folder_id), no new endpoint).
 *  - Honest state set: suggested ≠ accepted ≠ calm no-match; a transient re-fetch beat
 *    is role=status, a mutation failure is role=alert.
 *
 * a11y (NON-negotiable — UX-01 / WCAG 2.1 AA):
 *  - Accept/Dismiss/Undo are keyboard-operable (:focus-visible) AND always visible on
 *    coarse-pointer / touch (the bottom-sheet has no hover) — the .rel-x-touch pattern.
 *  - Icon-bearing controls carry an aria-label naming the full action + target.
 *  - All meaningful copy uses the panel-scoped AA token (text-panel-muted-foreground[-dim]),
 *    NEVER the global muted (3.59:1).
 */
import { useEffect, useState } from "react"
import { ShieldCheck, Undo2, RefreshCw } from "lucide-react"
import { acceptClassification, dismissClassification, moveDocument } from "@/lib/api"
import type { ClassificationSuggestion } from "@/types"
import { cn } from "@/lib/utils"

export interface ClassificationSectionProps {
  /** The open document — the subject the suggestion is attached to. */
  docId: string
  /** The on-upload suggestion stamped into metadata._classification (D-118-5). Absent
   *  when no rule matched OR after a dismiss. Re-derived from the doc on every render —
   *  there is no independent GET (the row chip reads the same object). */
  suggestion?: ClassificationSuggestion
  /** Re-fetch after a mutation (Accept/Dismiss/Undo) — the parent's loadDocuments
   *  reconcile. Re-fetch-NOT-optimistic: we call this on a 200, never splice locally. */
  onChanged?: () => void
  /** Lift the pending-suggestion count up so the parent PanelSection can show a badge:
   *  1 when a "suggested" exists, else 0. An accepted/absent suggestion lifts 0. */
  onTotalChange?: (total: number) => void
}

export function ClassificationSection({
  docId,
  suggestion,
  onChanged,
  onTotalChange,
}: ClassificationSectionProps) {
  // A transient post-mutation re-fetch beat (role=status) — distinct from the calm
  // states so an Accept doesn't blank the card before the reconcile lands.
  const [refreshing, setRefreshing] = useState(false)
  // A transient mutation-failure beat (role=alert). A failed Accept/Dismiss/Undo used
  // to be silent; we surface it so the user gets a signal. The parent re-fetch still
  // shows server truth on the next pass.
  const [actionError, setActionError] = useState(false)

  const isSuggested = suggestion?.status === "suggested"
  const isAccepted = suggestion?.status === "accepted"

  // Lift the pending-suggestion count to the parent PanelSection badge. 1 only while a
  // suggestion is actually pending (suggested) — an accepted receipt is not a to-do.
  useEffect(() => {
    onTotalChange?.(isSuggested ? 1 : 0)
  }, [isSuggested, onTotalChange])

  // Clear any stale action-error beat when the open document changes (it belonged to
  // the previous document).
  useEffect(() => {
    setActionError(false)
  }, [docId])

  /** Run a mutation, then RE-FETCH via onChanged (no optimistic splice). The parent's
   *  loadDocuments reconcile re-derives this section's `suggestion` prop from server
   *  truth — we never mutate it locally. */
  async function runMutation(fn: () => Promise<unknown>) {
    setActionError(false)
    setRefreshing(true)
    try {
      await fn()
      // Re-fetch the authoritative documents list — the section re-renders from the
      // freshly-resolved suggestion prop (re-fetch-not-optimistic).
      onChanged?.()
    } catch {
      // Honest failure beat — not silent. The parent re-fetch (when it runs) still
      // shows server truth; this explains a mutation that didn't take.
      setActionError(true)
    } finally {
      setRefreshing(false)
    }
  }

  const target = suggestion?.suggested_folder_name ?? "(deleted folder)"

  return (
    <div className="flex flex-col gap-3 px-4 pt-1">
      {/* The transient post-mutation re-fetch beat (NOT a layout jump). */}
      {refreshing && (
        <span
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-1.5 text-xs text-panel-muted-foreground-dim"
        >
          <RefreshCw aria-hidden="true" className="h-3 w-3 motion-safe:animate-spin" />
          updating…
        </span>
      )}

      {/* A failed mutation — a brief honest beat (role=alert). Distinct from the calm
          no-match state: a rule matched (or was accepted), but the action didn't take. */}
      {actionError && (
        <p role="alert" className="text-xs text-[hsl(0_80%_80%)]">
          Couldn&rsquo;t apply that change &mdash; please try again.
        </p>
      )}

      {/* SUGGESTED — the matched-rule provenance card. Reads instantly as NOT yet
          moved (the 028/036 honesty principle); provenance only, never a %. */}
      {isSuggested && suggestion && (
        <div
          className={cn(
            "flex flex-col gap-2 rounded-md border border-l-[3px] border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.08)] px-3 py-2.5",
          )}
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <span aria-hidden="true">💡</span>
            <span>
              Suggested: move to{" "}
              <span className="font-mono text-foreground">{target}</span>
            </span>
          </div>

          {/* Provenance — the matched rule + the frozen condition_summary. NEVER a %. */}
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-panel-muted-foreground">
            <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] text-panel-muted-foreground">
              rule · {suggestion.rule_name}
            </span>
            <span>matched because</span>
            <code className="font-mono text-foreground">{suggestion.condition_summary}</code>
          </p>

          {/* "Not moved yet" — the file is still where it was uploaded (honesty). */}
          <p className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--warning))]">
            <span aria-hidden="true">⚠</span>
            Not moved yet — this is a suggestion until you accept.
          </p>

          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => void runMutation(() => acceptClassification(docId))}
              disabled={refreshing}
              aria-label={`Accept and move to ${target}`}
              className={cn(
                "rounded-md bg-[hsl(var(--panel-status-done))] px-3 py-1.5 text-sm font-semibold text-[hsl(var(--panel-surface))]",
                "transition-[filter] hover:brightness-110 disabled:opacity-60",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              ✓ Accept &amp; move
            </button>
            <button
              type="button"
              onClick={() => void runMutation(() => dismissClassification(docId))}
              disabled={refreshing}
              aria-label="Dismiss classification suggestion"
              className={cn(
                "rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-panel-muted-foreground",
                "transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ACCEPTED — the audit receipt + a reversible Undo (D-118-6). */}
      {isAccepted && suggestion && (
        <div
          className={cn(
            "flex flex-col gap-2 rounded-md border border-l-[3px] border-[hsl(var(--panel-status-done))] bg-[hsl(var(--panel-status-done)/0.1)] px-3 py-2.5",
          )}
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--panel-status-done))]">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            <span>
              Filed in <span className="font-mono">{target}</span>
            </span>
          </div>
          <span
            role="status"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-panel-muted-foreground"
          >
            <span aria-hidden="true">🛡</span>
            classification.apply · audit logged
          </span>
          <div className="flex items-center gap-3 pt-0.5">
            <button
              type="button"
              onClick={() =>
                void runMutation(() => moveDocument(docId, suggestion.prior_folder_id ?? null))
              }
              disabled={refreshing}
              aria-label="Undo classification and move the document back"
              className={cn(
                "inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline disabled:opacity-60",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              <Undo2 aria-hidden="true" className="h-3 w-3" />
              Undo / move back
            </button>
            <span className="text-[10px] text-panel-muted-foreground-dim">
              reversible
            </span>
          </div>
        </div>
      )}

      {/* NO MATCH — calm empty (NOT role=alert). No rule matched this document. */}
      {!suggestion && (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-panel-muted-foreground">
          <span aria-hidden="true">○</span>
          No rule matched this document — nothing to file.
        </div>
      )}
    </div>
  )
}

export default ClassificationSection
