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
  APPLIED_FILLS_LABEL,
  APPLIED_HEADING,
  APPLIED_MODEL_LABEL,
  APPLIED_READS_LABEL,
  ARRIVAL_BADGE,
  ARRIVAL_SOURCE_ACTION,
  ARRIVAL_SOURCE_LEAD,
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

/**
 * ── SKETCH 200 — THE APPLIED PAIRS, AND THE ONE THE WIRE USUALLY CANNOT SUPPORT ───────
 *
 * The sheet's third region is a two-column grid of `label / value` pairs under `What I
 * applied`. Two of its pairs are facts this card already holds; the third has to be EARNED.
 *
 * ⚠ `Model` IS RENDERED ONLY WHERE EVERY STEP AGREES, AND THAT IS NOT FUSSINESS. A workflow
 * declares a model PER STEP. The sheet draws one value, so printing "the model" over a
 * definition whose steps declare two different ones would be stating something false about
 * every step but one — and a step that declared NOTHING is not evidence of agreement either,
 * it is a step that will use the run's model. So the pair appears exactly when the set of
 * DECLARED models has size one, and the value is the one every declaring step named.
 *
 * ⚠ NOTHING IS DEFAULTED, ANYWHERE. An absent value yields no pair rather than a plausible
 * one; with no pairs at all the whole region does not render. That is also, exactly, what the
 * sheet's own closing annotation says should happen — see the component for why that
 * annotation is honoured rather than printed.
 */
function declaredModel(phases: readonly PhaseSpecJSON[]): string | null {
  const declared = new Set<string>()
  for (const phase of phases) {
    // The shape is CHECKED rather than trusted: `config` is loose wire data, and a non-string
    // model would otherwise reach the DOM as `[object Object]`.
    const raw = phase.config.model
    if (typeof raw !== "string") continue
    const trimmed = raw.trim()
    if (trimmed.length === 0) continue
    declared.add(trimmed)
  }
  if (declared.size !== 1) return null
  const [only] = declared
  return only
}

export function DraftArrivalCard({
  phases,
  kbTools,
  nameContext,
  open,
  onDismiss,
  decisions,
}: DraftArrivalCardProps) {
  /**
   * ⚠ READ OFF `decisions`, NEVER MIRRORED INTO STATE. These three are LIVE off the definition
   * — the caller re-reads them on every render — and sketch 200 puts two of them on the card's
   * own face and a third in the applied block. Copying them into `useState` here would be
   * caching a PROP, which is the one thing this component's docblock forbids its local state
   * from doing.
   */
  const { name, businessRequirement, folderName, templateFilename } = decisions
  const headingId = useId()
  const groundingBodyId = useId()
  const decisionsBodyId = useId()
  const sourceTextId = useId()

  // BOTH FALSE ON MOUNT — the four-line arrival card sketch 174 measured at 149 px.
  const [groundingOpen, setGroundingOpen] = useState(false)
  const [decisionsOpen, setDecisionsOpen] = useState(false)
  /**
   * Sketch 200's source line is clamped, and this is the way to the rest of it. A THIRD
   * disclosure boolean, owned exactly as the two above are: a composing parent owning its own
   * disclosure state is the correct shape, and no PROP is cached by it.
   */
  const [sourceOpen, setSourceOpen] = useState(false)

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

  /** ── SKETCH 200's `What I applied` PAIRS — ONLY WHAT IS REALLY THERE ────────────────
   *  Built in the sheet's own order. Every arm is an ABSENCE CHECK rather than a fallback:
   *  a pair with nothing behind it is not added, so the block can never print a default, a
   *  placeholder or a dash. With none of the three known the block does not render at all.
   *
   *  ⚠ NO `TABLE[key] ?? fallback` ANYWHERE — this is a built list, not a lookup, precisely
   *  so there is no key whose miss could resolve to something inherited.
   */
  const appliedPairs = useMemo(() => {
    const pairs: { label: string; value: string }[] = []
    const model = declaredModel(phases)
    if (model !== null) pairs.push({ label: APPLIED_MODEL_LABEL, value: model })
    if (folderName !== null && folderName !== "") {
      pairs.push({ label: APPLIED_READS_LABEL, value: folderName })
    }
    if (templateFilename !== null && templateFilename !== "") {
      pairs.push({ label: APPLIED_FILLS_LABEL, value: templateFilename })
    }
    return pairs
  }, [phases, folderName, templateFilename])

  const heading = seedReceiptHeading(phases.length)
  // Each summary formatter returns the empty string at zero, so each fold line is asked
  // about exactly once and the card keeps ONE arrival shape either way.
  const groundingSummary = groundingFoldSummary(groundedCount)
  const decisionsSummary = decisionsFoldSummary(DECISION_ROW_ORDER.length)

  if (!open) return null

  return (
    /* ── SKETCH 200 (`draft-arrival.html`) — THE CARD'S FRAME ──────────────────────────
       The sheet gives the arrival card a 4px accent rule down its left edge and pulls the
       body in behind it (`p-6 pl-8`), so the card reads as something that just landed rather
       than as another panel. `overflow-hidden` is what keeps the rule inside the radius.

       ⚠ THE SHEET'S PULSING BORDER IS NOT PORTED, DELIBERATELY. It animates a border colour
       forever, with no terminating condition and no state change behind it — an indefinite
       animation that means nothing is the "pacing dressed as progress" `SeedReceipt`'s own
       docblock refuses, and this card reports a COMPLETED generation. The accent rule carries
       the same emphasis and makes no claim about anything still happening. */
    <section
      data-testid="draft-arrival-card"
      aria-labelledby={headingId}
      className={cn(
        "relative w-full max-w-[720px] overflow-hidden rounded border border-border bg-card shadow-lg",
        "animate-in fade-in-0 slide-in-from-bottom-1 duration-100 motion-reduce:animate-none",
      )}
    >
      <span aria-hidden="true" className="absolute bottom-0 left-0 top-0 w-[4px] bg-primary" />

      <div className="flex flex-col gap-4 p-6 pl-8">
        {/* The state chip and the dismiss control share the sheet's header row. */}
        <div className="flex items-start justify-between gap-3">
          <span
            data-testid="draft-arrival-badge"
            className="rounded-sm border border-border bg-muted px-2 py-1 font-mono text-[12px] uppercase tracking-wide text-muted-foreground"
          >
            {ARRIVAL_BADGE}
          </span>

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

        {/* ── THE TITLE — THE WORKFLOW'S NAME, AND NOTHING AT ALL WHEN IT HAS NONE ──────
            Sketch 200 titles the card with the workflow's name. It is LIVE off the definition
            (the caller reads it on every render), and `""` is a real state: a generation that
            named nothing renders no title rather than a placeholder, an id, or the sheet's
            example. The step-count heading below keeps the card's accessible name either way,
            which is why dropping the title costs nothing structural. */}
        {name !== "" && (
          <h2
            data-testid="draft-arrival-title"
            className="text-[18px] font-semibold leading-[1.4] text-foreground"
          >
            {name}
          </h2>
        )}

        <p
          id={headingId}
          data-testid="draft-arrival-heading"
          className="text-[13.5px] font-semibold text-foreground"
        >
          {heading}
        </p>

        {/* ── THE SOURCE LINE — WHAT THE AUTHOR ASKED FOR, ECHOED BACK ──────────────────
            The sheet quotes the request behind a 2px rule and puts a control beside it. The
            echo is CLAMPED at rest, because a requirement can be a page long and this card's
            measured property is that it arrives about four lines tall; the control is how the
            rest of it is reached, so nothing the author wrote is unreachable.

            ⚠ THE TEXT IS THE AUTHOR'S AND IS RENDERED AS A PLAIN REACT TEXT CHILD. React
            escapes it; the raw-HTML prop is never used on this surface (T-197-19).

            ⚠ ABSENT ⇒ THE WHOLE LINE IS ABSENT. There is no "no requirement" sentence here:
            that fact already has exactly one home, in the decisions fold's third row, and a
            second spelling of it on the card's face would be two places saying one thing. */}
        {businessRequirement !== "" && (
          <div
            data-testid="draft-arrival-source"
            className="flex flex-col gap-2 border-l-2 border-muted py-1 pl-3 sm:flex-row sm:items-baseline sm:gap-3"
          >
            <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-muted-foreground">
              <span className="text-muted-foreground/70">{ARRIVAL_SOURCE_LEAD}</span>{" "}
              <span
                data-testid="draft-arrival-source-text"
                className={cn("whitespace-pre-wrap", !sourceOpen && "line-clamp-2")}
              >
                {businessRequirement}
              </span>
            </p>
            <button
              type="button"
              data-testid="draft-arrival-source-toggle"
              aria-expanded={sourceOpen}
              aria-controls={sourceTextId}
              onClick={() => setSourceOpen((wasOpen) => !wasOpen)}
              className={cn(
                "shrink-0 whitespace-nowrap text-[13px] text-primary underline decoration-primary/30 underline-offset-4",
                "hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary",
              )}
            >
              {ARRIVAL_SOURCE_ACTION}
            </button>
          </div>
        )}
      </div>

      {/* ── THE FOOTER BAR — THE SHEET'S ACTION STRIP ─────────────────────────────────
          Sketch 200 draws a tinted, top-ruled strip holding the card's controls: secondary
          actions on the left, a primary one on the right. The two fold controls are this
          card's secondary actions, so they move into it.

          ⚠ THE SHEET'S PRIMARY (RIGHT-HAND) ACTION IS NOT BUILT, ON THREE INDEPENDENT
          GROUNDS, and it is recorded rather than quietly omitted:
            1. THERE IS NO WIRE FOR IT. This component has no such handler and its caller
               passes none; the flow it names has exactly one home elsewhere, and putting a
               second door on this card is what `199-04` refused about an earlier sheet.
            2. ITS WORD IS BANNED FROM THIS SURFACE'S VOCABULARY. D-20's fence forbids the
               gate-claim token in every value `decisionsVocabulary` exports, because nothing
               in the gauntlet refuses on four of this card's five subjects. A control whose
               only possible label is unsayable here is a control that belongs elsewhere.
            3. ITS OWNER IS NOT THIS FILE. The gauntlet component is a separate module and is
               under concurrent edit; adding a caller for it from here would be reaching into
               someone else's surface.
          So the strip's right slot renders nothing. The dismiss control already sits in the
          header where the sheet puts it, so no action is lost. */}
      <div className="flex items-center justify-between gap-3 border-t border-border bg-background/50 px-6 py-4 pl-8">
        <div className="flex min-w-0 flex-wrap items-center gap-3">

          {groundingSummary ? (
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
          ) : null}

          {decisionsSummary ? (
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
          ) : null}
        </div>
      </div>

      {/* ── SKETCH 200's SECOND AND THIRD REGIONS, BEHIND THIS CARD'S OWN DISCLOSURES ────
          The sheet stacks three blocks down the page: the arrival card, a `What I decided for
          you` list, and a `What I applied` block. THEY MAY NOT BE THREE SIBLINGS HERE, and the
          reason is structural rather than aesthetic: the page's graph column is a three-row
          grid with a last-child row placement, so a FOURTH child strands the graph at 0 px
          (sketch 172 measured it; a case counts the children). So the sheet's three blocks are
          three REGIONS inside this one card, and the two that are not the arrival moment sit
          behind the folds sketch 174 measured — which is also what keeps the resting card the
          four lines this file exists to preserve. */}
      {groundingOpen ? (
        <div
          id={groundingBodyId}
          data-testid="draft-arrival-grounding-body"
          className="flex flex-col gap-4 border-t border-border px-6 py-5 pl-8"
        >
          {appliedPairs.length > 0 ? (
            /* ── THE `What I applied` BLOCK ────────────────────────────────────────────
               The sheet's bordered block: a ruled heading over a two-column grid of
               label/value pairs.

               ⚠ THE SHEET'S CLOSING LINE — *"This block is absent when nothing was applied"* —
               IS NOT RENDERED, BECAUSE IT IS AN INSTRUCTION TO THE IMPLEMENTER RATHER THAN
               COPY FOR AN AUTHOR. Printing it would be printing the mechanism, which is the
               rule this surface already follows. It is HONOURED instead: with no pair to show,
               this block does not render at all. */
            <div
              data-testid="draft-arrival-applied"
              className="rounded border border-border bg-card p-5"
            >
              <h3 className="mb-4 border-b border-border pb-2 font-mono text-[14px] uppercase tracking-wider text-foreground">
                {APPLIED_HEADING}
              </h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {appliedPairs.map((pair) => (
                  <div key={pair.label} className="flex min-w-0 flex-col">
                    <dt className="mb-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      {pair.label}
                    </dt>
                    <dd className="min-w-0 truncate font-mono text-[14px] text-foreground">
                      {pair.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className={RECEIPT_SUPPRESSION_CLASS}>
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
        </div>
      ) : null}

      {decisionsOpen ? (
        <div
          id={decisionsBodyId}
          data-testid="draft-arrival-decisions-body"
          className="flex flex-col gap-4 border-t border-border px-6 py-5 pl-8"
        >
          {/* The sheet's own heading over the list, in its `data-md` uppercase register.
              The rows themselves belong to `DecisionsList` and are untouched here. */}
          <h3 className="font-mono text-[12px] uppercase tracking-widest text-muted-foreground">
            {decisionsSummary}
          </h3>
          <div className="rounded border border-border bg-accent/20 p-2">
            <DecisionsList {...decisions} />
          </div>
        </div>
      ) : null}

      <p
        data-testid="draft-arrival-close"
        className="px-6 pb-4 pl-8 text-[12.5px] leading-[1.5] text-muted-foreground"
      >
        {SEED_RECEIPT_NOTHING_COMMITTED}
      </p>
    </section>
  )
}
