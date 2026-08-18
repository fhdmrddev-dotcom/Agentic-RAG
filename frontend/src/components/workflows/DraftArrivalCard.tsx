/**
 * Phase 197-08 (AUTH-02 / ROADMAP SC#1, sketch 174, D-01 / D-02 / D-04) —
 * DraftArrivalCard.
 *
 * THE ARRIVAL MOMENT AS **ONE CARD**, ABOUT FOUR LINES TALL. A drafted workflow lands and
 * two different things want to be said about it: what safety the generation applied
 * (`SeedReceipt`) and what ordinary decisions it made on the author's behalf
 * (`DecisionsList`). Sketch 174 measured what happens when each says it in its own frame,
 * on a 780 px screen: one card is 149 px of chrome leaving the workflow 507 px (65%); two
 * cards are 284/363 (47%); two cards opened are 478/169 (22%). MERGING HALVES THE ARRIVAL
 * CHROME. And it is not only a preference — the page's graph column is a three-row grid
 * pinned with a last-child row placement, so a FOURTH child strands the graph at 0 px. One
 * card is what keeps that layout valid.
 *
 * ── THIS IS A COMPOSITION CHANGE, NOT A CHARTER CHANGE (D-02) ──
 * Nothing here widens the governance receipt. It stays the fenced leaf it is — it authors
 * no sentence of its own, it declares no predicate of its own, and it names no route. This
 * file is the PARENT that composes its output with the decisions list: ONE CARD IN THE UI,
 * TWO COMPONENTS UNDERNEATH. The receipt's own file is under a zero-insertion,
 * zero-deletion diff criterion for this whole phase, and this component is written so that
 * criterion never comes under pressure.
 *
 * The receipt renders its own frame, its own heading, its own dismiss control and its own
 * closing line. The one-card shape needs each of those ONCE, at the card level, with the
 * receipt's grounding paragraphs and sealed rows behind a fold. Since the receipt may not
 * be edited, this parent:
 *
 *   • OWNS the frame, the heading, the dismiss control and the closing line — rendering the
 *     receipt's OWN shipped constants and formatter from `definitionOps`
 *     (`seedReceiptHeading`, `SEED_RECEIPT_DISMISS_LABEL`, `SEED_RECEIPT_DISMISS_GLYPH`,
 *     `SEED_RECEIPT_NOTHING_COMMITTED`). COMPOSED, NEVER RE-TYPED: a second spelling of a
 *     locked string is how a locked string stops being locked.
 *   • RENDERS the receipt inside the first fold's body, wrapped in a div whose arbitrary
 *     child variants neutralise the receipt's own frame and hide its now-duplicate heading,
 *     dismiss control and closing line — each targeted by the receipt's shipped testid
 *     handles, listed in `RECEIPT_SUPPRESSION_CLASS` below.
 *
 * ⚠ TWO CONSEQUENCES, STATED RATHER THAN LEFT IMPLIED, AND BOTH ACCEPTED DELIBERATELY.
 *  1. The duplicate dismiss control is hidden with `display`, not with opacity, because
 *     `display` removes it from the TAB ORDER. There is therefore no hidden focusable
 *     control inside the card — the failure an opacity-based suppression would have shipped.
 *  2. The receipt's own section loses its accessible name once its heading is hidden. It
 *     becomes a generic unnamed region inside a named parent section, which is benign: an
 *     unnamed `section` is not exposed as a landmark.
 *
 * ⚠ jsdom APPLIES NO CSS, so the suppression is proved here by a SOURCE assertion plus the
 * phase's G-4 row U1. This project's own hardest-won lesson governs: geometry proves
 * composition; only LOOKING proves appearance. Three pages of green assertions did not
 * notice that every sketch page rendered in light mode. U1 IS OWED.
 *
 * ── THE GROUNDED COUNT IS DERIVED FROM THE ONE HOME, AND IS NOT A SECOND PREDICATE ──
 * `groundingCauseOf` moved to `phaseVocabulary` at 187-24 precisely so no surface could
 * hold a second copy of the rule. This component is its SECOND CONSUMER, exactly as the
 * receipt is its first. It declares no cause table, it does not read the receipt's own
 * count attribute back out of the DOM, and it asks the receipt for nothing.
 *
 * ── FOLD STATE IS LOCAL, AND THAT IS THE CORRECT SHAPE FOR A PARENT ──
 * Two booleans, BOTH FALSE ON MOUNT, so the arrival state is the four-line card sketch 174
 * measured at 149 px. ⚠ `DecisionsList`'s "holds no cache" fence forbids `useState` in THAT
 * component, and that fence is about ITS purity as a leaf projection — it does not travel
 * here. A composing parent owning its own disclosure state is the correct shape; what would
 * be wrong is caching a PROP, and no prop is cached here.
 *
 * ── DISMISSAL IS THE CALLER'S, AND IS NOT REMEMBERED ACROSS A RELOAD ──
 * `open` is owned by the caller — the shipped receipt contract, inherited verbatim, with
 * `open === false` rendering `null` so there is no hidden DOM and no stale focus trap.
 * CONTEXT.md leaves persistence to Claude's discretion; it is DECLINED here, because the
 * page already resets `open` per generation and persistence would be a new concern
 * (storage, scoping to a draft, and a stale key when a second generation lands) for no
 * stated benefit. Re-open trigger: an author reporting that the card returns after a reload
 * they had dismissed it on.
 *
 * ── D-01 — THE GUIDANCE IS ON THE DRAFT, AFTER ──
 * This card exists only once a draft has landed, so nothing is added to the generation's
 * critical path and the fast door stays fast (the D-05 red line).
 *
 * XSS (T-197-19): this parent renders no server- or model-authored string of its own. It
 * renders imported constants and one count formatter; both children render plain React text
 * children, which React escapes. The raw-HTML prop is never used here.
 *
 * ⚠ NAME IDENTIFIERS, NEVER FORBIDDEN SPELLINGS, IN EVERY COMMENT HERE. The suite's fences
 * read this file's RAW source, so the governance seal glyph, the cause tokens and the
 * receipt's per-row content handles are described rather than written out — `196-08` tripped
 * that trap four times, once inside the comment written to explain the first three.
 */
import { useId, useMemo, useState } from "react"

import { DecisionsList, type DecisionsListProps } from "@/components/workflows/DecisionsList"
import {
  DECISIONS_FOLD_ACTION,
  DECISION_ROW_ORDER,
  GROUNDING_FOLD_ACTION,
  decisionsFoldSummary,
  groundingFoldSummary,
} from "@/components/workflows/decisionsVocabulary"
import {
  SEED_RECEIPT_DISMISS_GLYPH,
  SEED_RECEIPT_DISMISS_LABEL,
  SEED_RECEIPT_NOTHING_COMMITTED,
  seedReceiptHeading,
} from "@/components/workflows/definitionOps"
import {
  groundingCauseOf,
  type NameContext,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"
import { SeedReceipt } from "@/components/workflows/SeedReceipt"
import { cn } from "@/lib/utils"

export interface DraftArrivalCardProps {
  /** ── The receipt's own props, passed straight through. SNAPSHOT semantics: these
   *  describe ONE generation result and are replaced on every generation. The receipt's
   *  own docblock states why the word is load-bearing; this parent adds no caching that
   *  could break it. ── */
  phases: readonly PhaseSpecJSON[]
  /** The SERVER's KB-reading tool list, passed straight through. This component declares
   *  no tool-name table of its own and writes no tool id anywhere. */
  kbTools: readonly string[]
  /** The page-owned id→name maps, passed straight through to the receipt. */
  nameContext?: NameContext
  /** Owned by the CALLER. This component never opens or closes itself — the shipped
   *  receipt `open` contract, inherited verbatim. */
  open: boolean
  /** The card's dismiss control was activated. */
  onDismiss: () => void

  /** ── The decisions half, as ONE object so the page's wiring is explicit at the call
   *  site rather than spread across eleven sibling props. ── */
  decisions: DecisionsListProps
}

/**
 * ── THE SUPPRESSION LIST, DECLARED RATHER THAN BURIED IN A CLASS SOUP ──
 *
 * Each entry targets ONE of the receipt's shipped testid handles from this wrapper, and
 * every handle named here is one the one-card shape renders ONCE at the card level:
 *
 *   `seed-receipt`           the receipt's own card frame — its rounding, border,
 *                            background, padding, shadow, width cap and entrance animation
 *                            are neutralised so the fold body reads as part of THIS card
 *                            rather than as a second card nested inside it.
 *   `seed-receipt-heading`   the parent renders the same heading, from the same formatter.
 *   `seed-receipt-dismiss`   the parent renders the same control, with the same label and
 *                            glyph. Hidden with `display`, so it leaves the tab order.
 *   `seed-receipt-close`     the parent renders the same closing sentence, from the same
 *                            constant.
 *
 * ⚠ NOTHING THE FOLD EXISTS TO REVEAL IS TOUCHED — the receipt's two paragraph handles, its
 * grounded-list handle and its per-step row handles are all absent from this list, and a
 * fence in the suite sweeps every targeted handle in this file and asserts the set is
 * exactly the four above. That fence is what stops a future edit quietly blanking the
 * fold's own content.
 *
 * ⚠ EMISSION CONFIRMED, NOT ASSUMED. Tailwind 3.4 arbitrary variants containing an
 * attribute selector were verified by running the Tailwind CLI over a probe carrying these
 * exact ten candidates: all ten rules were emitted, each as
 * `.<escaped-candidate> [data-testid=<handle>]`. The attribute match is EXACT, so the frame
 * rules cannot reach a handle whose name merely starts with the frame's.
 */
const RECEIPT_SUPPRESSION_CLASS = [
  "[&_[data-testid=seed-receipt]]:max-w-none",
  "[&_[data-testid=seed-receipt]]:rounded-none",
  "[&_[data-testid=seed-receipt]]:border-0",
  "[&_[data-testid=seed-receipt]]:bg-transparent",
  "[&_[data-testid=seed-receipt]]:p-0",
  "[&_[data-testid=seed-receipt]]:shadow-none",
  "[&_[data-testid=seed-receipt]]:animate-none",
  "[&_[data-testid=seed-receipt-heading]]:hidden",
  "[&_[data-testid=seed-receipt-dismiss]]:hidden",
  "[&_[data-testid=seed-receipt-close]]:hidden",
].join(" ")

/** The disclosure mark, `aria-hidden` so the announcement is carried by the button's own
 *  text and its expanded state rather than by a glyph. Sketch 174 draws it. */
const FOLD_GLYPH = "▸"

const FOLD_LINE_CLASS = cn(
  "mt-1 flex w-full items-baseline gap-2 rounded px-1 py-[3px] text-left text-[12.5px]",
  "text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary",
)

const FOLD_ACTION_CLASS =
  "shrink-0 underline decoration-dotted underline-offset-2"

export function DraftArrivalCard({
  phases,
  kbTools,
  nameContext,
  open,
  onDismiss,
  decisions,
}: DraftArrivalCardProps) {
  const headingId = useId()
  const groundingBodyId = useId()
  const decisionsBodyId = useId()

  // BOTH FALSE ON MOUNT — the four-line arrival card sketch 174 measured at 149 px.
  const [groundingOpen, setGroundingOpen] = useState(false)
  const [decisionsOpen, setDecisionsOpen] = useState(false)

  // DERIVED from the ONE home (187-24), never re-implemented and never read back out of
  // the DOM. A second consumer of one predicate is not a second predicate.
  const groundedCount = useMemo(
    () =>
      phases.reduce(
        (total, phase) => (groundingCauseOf(phase, kbTools) !== null ? total + 1 : total),
        0,
      ),
    [phases, kbTools],
  )

  const heading = seedReceiptHeading(phases.length)
  // Each summary formatter returns the empty string at zero, so each fold line is asked
  // about exactly once and the card keeps ONE arrival shape either way.
  const groundingSummary = groundingFoldSummary(groundedCount)
  const decisionsSummary = decisionsFoldSummary(DECISION_ROW_ORDER.length)

  if (!open) return null

  return (
    <section
      data-testid="draft-arrival-card"
      aria-labelledby={headingId}
      className={cn(
        "w-full max-w-[720px] rounded-[14px] border border-border bg-card px-[18px] py-4 shadow-lg",
        "animate-in fade-in-0 slide-in-from-bottom-1 duration-100 motion-reduce:animate-none",
      )}
    >
      <div className="flex items-start gap-3">
        <h2
          id={headingId}
          data-testid="draft-arrival-heading"
          className="min-w-0 flex-1 text-[13.5px] font-semibold text-foreground"
        >
          {heading}
        </h2>

        {/* The glyph is hidden from the a11y tree so the announcement is the label. */}
        <button
          type="button"
          data-testid="draft-arrival-dismiss"
          aria-label={SEED_RECEIPT_DISMISS_LABEL}
          onClick={onDismiss}
          className={cn(
            "inline-grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] text-muted-foreground",
            "hover:bg-accent/40 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary",
          )}
        >
          <span aria-hidden="true">{SEED_RECEIPT_DISMISS_GLYPH}</span>
        </button>
      </div>

      {groundingSummary ? (
        <div className="mt-2">
          <button
            type="button"
            data-testid="draft-arrival-fold-grounding"
            aria-expanded={groundingOpen}
            aria-controls={groundingBodyId}
            onClick={() => setGroundingOpen((wasOpen) => !wasOpen)}
            className={FOLD_LINE_CLASS}
          >
            <span aria-hidden="true" className="shrink-0">
              {FOLD_GLYPH}
            </span>
            <span
              data-testid="draft-arrival-fold-grounding-summary"
              className="min-w-0 flex-1 truncate"
            >
              {groundingSummary}
            </span>
            <span className={FOLD_ACTION_CLASS}>{GROUNDING_FOLD_ACTION}</span>
          </button>

          {groundingOpen ? (
            <div
              id={groundingBodyId}
              data-testid="draft-arrival-grounding-body"
              className={cn("mt-1", RECEIPT_SUPPRESSION_CLASS)}
            >
              {/* COMPOSED, NEVER REDRAWN. `onDismiss` is passed through rather than a
                  no-op: the control is suppressed, and if suppression ever failed the
                  behaviour would still be correct. */}
              <SeedReceipt
                phases={phases}
                kbTools={kbTools}
                nameContext={nameContext}
                open={true}
                onDismiss={onDismiss}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {decisionsSummary ? (
        <div className="mt-1">
          <button
            type="button"
            data-testid="draft-arrival-fold-decisions"
            aria-expanded={decisionsOpen}
            aria-controls={decisionsBodyId}
            onClick={() => setDecisionsOpen((wasOpen) => !wasOpen)}
            className={FOLD_LINE_CLASS}
          >
            <span aria-hidden="true" className="shrink-0">
              {FOLD_GLYPH}
            </span>
            <span
              data-testid="draft-arrival-fold-decisions-summary"
              className="min-w-0 flex-1 truncate"
            >
              {decisionsSummary}
            </span>
            <span className={FOLD_ACTION_CLASS}>{DECISIONS_FOLD_ACTION}</span>
          </button>

          {decisionsOpen ? (
            <div
              id={decisionsBodyId}
              data-testid="draft-arrival-decisions-body"
              className="mt-1"
            >
              <DecisionsList {...decisions} />
            </div>
          ) : null}
        </div>
      ) : null}

      <p
        data-testid="draft-arrival-close"
        className="mt-3 text-[12.5px] leading-[1.5] text-muted-foreground"
      >
        {SEED_RECEIPT_NOTHING_COMMITTED}
      </p>
    </section>
  )
}
