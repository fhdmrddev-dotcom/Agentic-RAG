// ─────────────────────────────────────────────────────────────────────────────
// Phase 139 Plan 05 (SI-02, D-04/D-05/D-08/D-09/D-10) — the description-proposal
// review card.
//
// This is the WHOLE user-visible SI-02 door: a Trigger Tuner run produced a
// held-out per-provider winner that beat the current description → this card shows
// the base→proposed diff + the per-provider scoreboard as PRE-approval evidence,
// and offers Approve / Reject only. Approving writes `skills.description` (the 079
// trigger versions it); there is NO re-eval gate (D-07) — the tuner's held-out
// scoreboard IS the measurement, so the SI-01 async re_evaling/not_promoted/
// interrupted/force-promote branches do NOT exist here.
//
// It is a thin RENDER-ONLY sibling of `ProposalCard` (RESEARCH Open-Q2 → "sibling":
// keeps SI-01's card honesty-locks untouched). Every handler is an injected prop —
// there is NO `@/lib/api` call in this file, so the card cannot mutate state, only
// display it. Diff/description/scoreboard all render as React text nodes; no raw-HTML
// injection sink is used (T-139-14 / T-137-05). The Deep/agent path is untouched.
//
// It reuses the design-locked surfaces (D-15, no fresh sketch): the SI-01 ProposalCard
// tokens/chip idiom + `lineDiff` red/green diff + the Trigger Tuner `ProviderScoreboard`.
// ─────────────────────────────────────────────────────────────────────────────
import { Check, X, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { lineDiff } from "@/lib/lineDiff"
import { ProviderScoreboard } from "@/components/skills/tuner/ProviderScoreboard"
import type { SkillProposal } from "@/types"

export interface DescriptionProposalCardProps {
  /** The reconciled server proposal row (`kind='description'`), or `null` → no active
   *  proposal (the card offers "Propose this description" when `onPropose` is wired). */
  proposal: SkillProposal | null
  /** Accept the proposal → writes `skills.description` (079 trigger versions it). */
  onApprove: () => void
  /** Dismiss the proposal (pure audit — nothing is written to the live skill). */
  onReject: () => void
  /** Kick off a fresh proposal from the tuner's held-out winner (null-proposal
   *  affordance). Omitted → no propose button when there is no active proposal. */
  onPropose?: () => void
}

// Studio chrome (055 chips/tokens/honesty language) — a status chip: glyph + word +
// color, never color alone (WCAG). SI-02 only ever reaches proposed / rejected /
// promoted (there is no async re-eval), so the chip is the honest subset of the
// SI-01 STATUS_CHIP.
const STATUS_CHIP: Partial<
  Record<SkillProposal["status"], { label: string; glyph: string; cls: string }>
> = {
  proposed: {
    label: "Proposed",
    glyph: "•",
    cls: "border-primary/30 bg-primary/10 text-primary",
  },
  promoted: {
    label: "Applied",
    glyph: "✓",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  },
  rejected: {
    label: "Rejected",
    glyph: "✕",
    cls: "border-border/40 bg-muted/30 text-muted-foreground",
  },
}

function StatusChip({ status }: { status: SkillProposal["status"] }) {
  const c = STATUS_CHIP[status]
  if (!c) return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium ${c.cls}`}
    >
      <span aria-hidden="true">{c.glyph}</span>
      {c.label}
    </span>
  )
}

export function DescriptionProposalCard({
  proposal,
  onApprove,
  onReject,
  onPropose,
}: DescriptionProposalCardProps) {
  // No active proposal (or a dismissed `rejected` one) → offer the propose affordance
  // when wired; otherwise render nothing. This is the honest "one door" (D-08): the
  // card never fabricates a proposal.
  if (!proposal || proposal.status === "rejected") {
    if (!onPropose) return null
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1 text-xs"
          onClick={onPropose}
        >
          <Sparkles className="h-3 w-3" />
          Propose this description
        </Button>
      </div>
    )
  }

  const base = proposal.base_description ?? ""
  const proposed = proposal.proposed_description ?? ""

  // Honesty lock (D-02): never fabricate a diff. The card is only mounted for an
  // actionable (non-baseline) winner, but if the proposed description somehow equals
  // the current one there is genuinely nothing to change — say so, offer no Approve.
  if (base === proposed) {
    return (
      <div className="rounded-lg border border-border/30 bg-surface/40 p-3">
        <p className="text-xs text-muted-foreground">
          The proposed description matches your current one — nothing to change.
        </p>
      </div>
    )
  }

  // The base→proposed diff via the SAME shared util the SI-01 card + Versions tab use
  // (D-10). The description is short, so the diff is small — text nodes only (T-139-14).
  const diffRows = lineDiff(base, proposed)
  const snapshot = proposal.scoreboard_snapshot

  return (
    <div
      data-testid="description-proposal-card"
      className="flex flex-col gap-3 rounded-lg border border-border/30 bg-surface/40 p-3"
    >
      {/* Header: Studio chip + honest section label. */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Proposed trigger description</p>
        <StatusChip status={proposal.status} />
      </div>

      {/* Unified line diff (D-09) — one renderer, three homes. Text nodes only. */}
      <pre
        data-testid="description-proposal-diff"
        className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-2 font-mono text-xs"
      >
        {diffRows.map((row, i) => (
          <span
            key={i}
            className={
              row.type === "add"
                ? "block bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : row.type === "remove"
                  ? "block bg-destructive/10 text-destructive"
                  : "block text-foreground/70"
            }
          >
            {row.type === "add" ? "+ " : row.type === "remove" ? "- " : "  "}
            {row.text || " "}
          </span>
        ))}
      </pre>

      {/* Per-provider scoreboard as PRE-approval evidence (D-04) — the tuner's held-out
          measurement IS the native cross-provider (SC#10) signal. Read off the
          {winner, baseline, run_id} snapshot: winner.cells = the proposed description's
          per-provider scores; baseline.cells = the current description's (proposed-vs-
          current head-to-head). NOT a TunerScoreboard — there is no top-level
          .candidates/.winner_index; the candidates ARE .winner/.baseline (D-05). */}
      {snapshot && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Per-provider held-out scores
          </p>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider font-mono text-[hsl(var(--panel-status-done))]">
              proposed
            </span>
            <ProviderScoreboard cells={snapshot.winner.cells} />
          </div>
          {snapshot.baseline && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
                current
              </span>
              <ProviderScoreboard cells={snapshot.baseline.cells} />
            </div>
          )}
        </div>
      )}

      {/* Action row — the ONLY honest human-in-the-loop door (D-06/D-08). `proposed`
          shows Approve (writes the live description) + Reject; `promoted` is the
          terminal applied state with NO buttons. No re-eval gate (D-07). */}
      {proposal.status === "proposed" && (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" className="gap-1 text-xs" onClick={onApprove}>
            <Check className="h-3 w-3" /> Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 text-xs"
            onClick={onReject}
          >
            <X className="h-3 w-3" /> Reject
          </Button>
        </div>
      )}

      {proposal.status === "promoted" && (
        <p className="text-xs font-semibold text-emerald-500">
          Promoted to the live skill — this description now drives triggering.
        </p>
      )}
    </div>
  )
}
