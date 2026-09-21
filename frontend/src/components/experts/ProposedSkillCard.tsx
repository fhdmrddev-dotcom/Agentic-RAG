import type { SuggestedNewSkill } from "@/lib/api/experts"

/**
 * Phase 263-04 (PACK-14 / D-263-01, sketch 263 variant A) — one capability the draft
 * named that the library does not have.
 *
 * ⛔ THE ONE HOME OF THE "does not exist" MARK. The dashed border and the violet accent
 * are the ONLY things carrying it: a proposal is an opportunity, not a failure, so there
 * is no red, no error styling and no `border-destructive` anywhere on this card. A second
 * styling for the same idea makes a proposal read as a defect.
 *
 * ⭐ The token string is COPIED VERBATIM from `components/org/OrgIdentity.tsx`'s
 * `AVATAR_PENDING` — this design system already expresses "real, but not yet" exactly
 * this way, and inventing a second expression of it is the drift the copy prevents.
 *
 * ⛔ Plain string concatenation, NOT `cn()`. The class list is asserted token-by-token by
 * a fence with a negative arm; running it through tailwind-merge would let a future
 * conflicting class silently drop one of the four tokens that carry the whole meaning.
 *
 * Render-only: it fetches nothing and it creates nothing. `onCreate` hands the proposal
 * back to the studio, which drafts the body and opens the EXISTING `SkillFormDialog`.
 */

/** Verbatim `OrgIdentity.tsx`'s `AVATAR_PENDING` — dashed + violet, never red. */
export const PROPOSED_SKILL_TOKENS =
  "border border-dashed border-primary/40 bg-primary/[0.06] text-primary"

export interface ProposedSkillCardProps {
  proposal: SuggestedNewSkill
  /** True while `draftSkillBody` is in flight for THIS proposal. The busy state renders
   *  IN PLACE on the card — ⛔ never as an empty dialog that fills in later. */
  isGenerating?: boolean
  onCreate: (proposal: SuggestedNewSkill) => void
  onRemove: (name: string) => void
}

export function ProposedSkillCard({
  proposal,
  isGenerating = false,
  onCreate,
  onRemove,
}: ProposedSkillCardProps) {
  return (
    <div
      data-testid="proposed-skill-card"
      className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-xs ${PROPOSED_SKILL_TOKENS}`}
    >
      <span aria-hidden="true" className="mt-0.5 font-mono leading-none">
        ⬡
      </span>

      <div className="min-w-0 flex-1">
        {/* Model-supplied text, rendered as React children so it is auto-escaped
            (T-263-20). ⛔ No raw-HTML injection prop anywhere on this surface — the
            prop is not named here on purpose, so `grep -c` on it stays a usable
            fence rather than matching this comment. */}
        <div className="font-mono text-xs font-medium text-primary">{proposal.name}</div>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {proposal.description}
        </p>
        {isGenerating && (
          <p className="mt-1 text-[11px] font-medium text-primary/80">
            Drafting instructions…
          </p>
        )}
      </div>

      <div className="flex flex-none items-center gap-1 self-center">
        <button
          type="button"
          onClick={() => onRemove(proposal.name)}
          disabled={isGenerating}
          className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
        >
          Remove
        </button>
        <button
          type="button"
          onClick={() => onCreate(proposal)}
          disabled={isGenerating}
          className="rounded-md bg-primary/20 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/30 disabled:opacity-50"
        >
          {isGenerating ? "Drafting…" : "Create this skill →"}
        </button>
      </div>
    </div>
  )
}
