// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 04 (PANEL-01, D-08) — the Studio-re-skinned self-improvement
// proposal card.
//
// This is the 135 propose → diff → approve/reject → auto-re-eval → promote/
// not-promote lifecycle card, RE-SKINNED for the Skill Studio's Evals tab. It is
// RENDER-ONLY: every handler is injected as a prop (EvalsTab, Plan 05, lifts the
// battle-tested SkillEvalSection handlers and passes them in). No `@/lib/api`
// call lives in this file — the card cannot mutate state, only display it.
//
// Every 135 honesty lock is preserved verbatim (D-08 "lightly re-skinned"):
//   • proposer rationale + evidence always shown;
//   • the base→proposed diff renders via the SAME `lineDiff` util the Versions tab
//     uses (one renderer, two homes) — add=emerald / remove=destructive /
//     context=foreground/70;
//   • `renderGateCounts` is LIFTED VERBATIM from SkillEvalSection :97-112 — a null
//     gate renders NOTHING (never a fabricated pass), and the honest with-skill
//     tallies are shown on BOTH the promoted and not_promoted branches;
//   • `override_forced` is echoed un-softened on the promoted branch;
//   • an `interrupted` proposal reads "not promoted" + a Re-run affordance, never a
//     silent success.
//
// The card renders the RECONCILED server proposal row only (T-137-04): a card can
// never show "promoted" unless the server reconciled it — there is no optimistic
// path in this file. Copy/diff/rationale/evidence/instruction text all render as
// React text nodes; no raw-HTML injection sink is used (T-137-05).
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from "react"
import { Check, X, Loader2, RotateCw, ArrowUpCircle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { lineDiff } from "@/lib/lineDiff"
import type { SkillProposal, PromotionGate } from "@/types"

export interface ProposalCardProps {
  /** The reconciled server proposal row (never optimistic). `null` → no active
   *  proposal; the card offers "Propose improvement" when `onPropose` is wired. */
  proposal: SkillProposal | null
  /** Optional live re-eval progress node (the shared eval readout, injected by
   *  EvalsTab) rendered inside the re_evaling / approved branches. */
  reEvalLive?: ReactNode
  /** Kick off a fresh proposal from the current eval evidence (null-proposal
   *  affordance). Omitted → no propose button. */
  onPropose?: () => void
  onApprove: () => void
  onReject: () => void
  onRerun: () => void
  onForcePromote: () => void
}

// LIFTED VERBATIM from SkillEvalSection :97-112 (D-08). The honest case-matched
// promotion-gate counts (D-13): the SAME renderer is called from BOTH the
// `promoted` and `not_promoted` branches so the counts are always displayed
// alongside the verdict. A null gate (interrupted / not-yet-reconciled) renders
// nothing — never a fabricated pass.
function renderGateCounts(gate: PromotionGate | null | undefined) {
  if (!gate) return null
  return (
    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">
        {gate.passed ? "Gate passed" : "Gate not passed"} — no-regression:{" "}
        {gate.no_regression ? "yes" : "no"} · improved: {gate.improved ? "yes" : "no"}
      </p>
      <p>
        prev pass {gate.prev_pass} · prev fail {gate.prev_fail} · still pass{" "}
        {gate.still_pass} · newly pass {gate.newly_pass} · not measured{" "}
        {gate.excluded_not_measured}
      </p>
    </div>
  )
}

// Studio chrome (055 chips/tokens/honesty language) — a status chip: glyph + word
// + color, never color alone (WCAG). Honest wording only; the chip re-skins the
// state, it does NOT alter the lifecycle. `rejected` never reaches here (the card
// short-circuits to null for a dismissed proposal) but is kept for exhaustiveness.
const STATUS_CHIP: Record<
  SkillProposal["status"],
  { label: string; glyph: string; cls: string }
> = {
  proposed: {
    label: "Proposed",
    glyph: "•",
    cls: "border-primary/30 bg-primary/10 text-primary",
  },
  approved: {
    label: "Approved — re-evaluating",
    glyph: "…",
    cls: "border-primary/30 bg-primary/10 text-primary",
  },
  re_evaling: {
    label: "Re-evaluating",
    glyph: "…",
    cls: "border-primary/30 bg-primary/10 text-primary",
  },
  promoted: {
    label: "Promoted",
    glyph: "✓",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  },
  not_promoted: {
    label: "Not promoted",
    glyph: "⚠",
    cls: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  interrupted: {
    label: "Interrupted",
    glyph: "⏸",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  rejected: {
    label: "Rejected",
    glyph: "✕",
    cls: "border-border/40 bg-muted/30 text-muted-foreground",
  },
}

function StatusChip({ status }: { status: SkillProposal["status"] }) {
  const c = STATUS_CHIP[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium ${c.cls}`}
    >
      <span aria-hidden="true">{c.glyph}</span>
      {c.label}
    </span>
  )
}

export function ProposalCard({
  proposal,
  reEvalLive,
  onPropose,
  onApprove,
  onReject,
  onRerun,
  onForcePromote,
}: ProposalCardProps) {
  // No active proposal → offer the propose affordance (when wired). A `rejected`
  // latest proposal is a dismissed card (EvalsTab passes `null`), which also
  // re-enables a fresh propose attempt.
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
          Propose improvement
        </Button>
      </div>
    )
  }

  // The base→proposed diff via the SAME shared util the Versions tab renders (D-08).
  const diffRows = lineDiff(proposal.base_instructions, proposal.proposed_instructions)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/30 bg-surface/40 p-3">
      {/* Header: Studio chip + honest section label. */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Proposed instructions change</p>
        <StatusChip status={proposal.status} />
      </div>

      {/* Unified line diff (D-09) — one renderer, two homes. Text nodes only. */}
      <pre
        data-testid="proposal-diff"
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

      {/* Proposer rationale + which evidence drove it (D-10) — always shown. */}
      {proposal.rationale && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Why this change</p>
          <p className="whitespace-pre-wrap text-xs text-foreground/80">{proposal.rationale}</p>
        </div>
      )}
      {proposal.evidence_summary && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Evidence</p>
          <p className="whitespace-pre-wrap text-xs text-foreground/80">
            {proposal.evidence_summary}
          </p>
        </div>
      )}

      {/* Status-driven action row + honest terminal verdict (D-06/D-13/D-14).
          State is always the reconciled DB row (refetch-not-optimistic). */}
      {proposal.status === "proposed" && (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" className="gap-1 text-xs" onClick={onApprove}>
            <Check className="h-3 w-3" /> Approve &amp; re-eval
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

      {proposal.status === "re_evaling" && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Re-evaluating the proposed skill — live progress shows below.
          </p>
          {reEvalLive}
          <div>
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
        </div>
      )}

      {/* CR-03 (135) — `approved` is transient in the happy path (it flips to
          `re_evaling` in the same approve response); a persistent `approved` on
          refetch means the re-eval launch failed and the loop is wedged. Offer a
          Reject escape so the human stays in the loop. */}
      {proposal.status === "approved" && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Re-evaluating the proposed skill — live progress shows below.
          </p>
          {reEvalLive}
          <div>
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
        </div>
      )}

      {proposal.status === "promoted" && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-emerald-500">
            Promoted to the live skill
            {proposal.override_forced ? " (forced override)" : ""}.
          </p>
          {renderGateCounts(proposal.gate)}
        </div>
      )}

      {proposal.status === "not_promoted" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-destructive">
            Not promoted — the re-eval gate did not pass (failing cases in the results
            above).
          </p>
          {renderGateCounts(proposal.gate)}
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1 text-xs"
              onClick={onForcePromote}
            >
              <ArrowUpCircle className="h-3 w-3" /> Force promote anyway
            </Button>
          </div>
        </div>
      )}

      {proposal.status === "interrupted" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Interrupted — not promoted. The re-eval did not finish.
          </p>
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1 text-xs"
              onClick={onRerun}
            >
              <RotateCw className="h-3 w-3" /> Re-run re-eval
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
