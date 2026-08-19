/**
 * Phase 200-04 Task 2 (DES-02) — THE STEP PANEL'S CARD SHELL.
 *
 * Sheet c4 draws the step form as named cards rather than as one flat column of fields. This
 * is that shell, and it is deliberately nothing else: a titled `<section>` that frames
 * children the panel already renders.
 *
 * ── ⚠ THE SHAPE IS PORTED FROM THE SHEET'S MARKUP, NOT DERIVED FROM A CHECKLIST ─────────
 *
 * ⚠ CORRECTED at Phase 200 (the step-panel port), in the commit that falsified it, and the
 * original reasoning above is kept rather than overwritten. The first pass at this shell
 * built a card whose SHAPE came from a change-log — a `bg-muted/40` strip with an 11px
 * medium title on the same baseline as its mark. The operator's verdict on the result was
 * that it is not what was designed, and the reason is measurable: the reference
 * (`.planning/sketches/200-journey-interactive/screens/step-panel.html`) draws every group
 * as **two nested elements**, not one —
 *
 *     <section class="flex flex-col gap-3">
 *       <h3 class="text-[11px] font-semibold tracking-widest uppercase text-dim">Title</h3>
 *       <div class="p-4 border border-line rounded bg-bg"> …the controls… </div>
 *     </section>
 *
 * — an OUTSIDE label in small caps, and an INSET panel that is DARKER than the panel around
 * it (`bg-deep-midnight-bg` inside a `bg-deep-midnight-card` aside). Those two facts are the
 * whole difference between "a form with headings" and "a column of cards", and the shipped
 * shell had neither. Token mapping, once, here: `bg-card`→`bg-card` · `border-line`→
 * `border-border` · `text-dim`/`text-muted`→`text-muted-foreground` · `bg-bg`→`bg-background`.
 *
 * ── ⚠ IT HOLDS NO STATE, AND THAT IS A SHIPPED FENCE RATHER THAN A PREFERENCE ───────────
 *
 * `PhaseFormPanel.test.tsx` pins `useState` / `useMemo` / `useEffect` at an **ABSOLUTE ZERO**
 * over the panel's own `?raw` source — *"not 'no increase' — zero, because all three measured
 * zero before this phase, and a non-decrease criterion on a file that already reads 0 is a
 * criterion that permits the first one."* So a card that needed a collapse switch would have to
 * keep that switch HERE, exactly as `FieldGuidance.tsx` keeps the guidance switch's
 * (`199-06`'s precedent, created for this same reason and whose pin then passed untouched).
 *
 * ⚠ THESE CARDS DO NOT COLLAPSE, AND THE REASON IS SEED-184's rule 3 rather than economy.
 * A person may never be asked to click in order to discover a DECISION — whether the step is
 * governed, which side of the door it is on, whether it is armed, or what it delivers. Two of
 * the cards this shell frames carry exactly those facts (`What it can reach`, `What it
 * changes outside this workflow`), and both are already enumerated in `FENCED_IN` in the
 * panel's suite. A disclosure here would fold a refusal behind a click, which is how a person
 * meets a refusal by being surprised. So: no state, no switch, nothing to hold. The ONE
 * reveal this port introduces is inside `ToolChoiceSet.tsx`, over UNCHOSEN options only, and
 * its docblock argues that boundary on its own terms.
 *
 * ── THE MARK IS A WORD, NOT A GLYPH ────────────────────────────────────────────────────
 *
 * The sketch draws its marks as Material Symbols LIGATURE NAMES — `lock`, `shield`, `bolt`,
 * `check_circle` — and every one of them is forbidden as visible text: the product's icon
 * authority is `icon-convention.md` §1 (`@lobehub/icons` for provider/model marks), §2 (the
 * shared 3D `PHASE_GLYPHS` map for phase types) and §4 (the canvas mark table).
 * **No net-new mark is invented here.** `NEEDS ARMING` renders as the words it is.
 */
import type { ReactNode } from "react"

export interface StepCardSectionProps {
  /** The card's heading — always from `stepCardSectionContext.ts`, never a literal. */
  title: string
  /** The `data-testid` a fence can find the card by. */
  testId: string
  /**
   * The DOM `id` the readiness checklist's jump rows scroll to.
   *
   * ⚠ OPTIONAL, AND ABSENT MEANS NO `id` ATTRIBUTE AT ALL — never an empty string. An
   * `id=""` is a valid attribute that no selector can reach, so a dropped wiring would look
   * like a jump row that silently does nothing rather than like a typecheck error.
   */
  anchorId?: string
  /**
   * A short standing mark rendered beside the card's first line (`NEEDS ARMING`).
   *
   * ⚠ ABSENT ⇒ NOTHING RENDERS, never an empty pill. A blank mark is byte-indistinguishable
   * from a mark that failed to resolve, and on a governance card the two readings are opposite.
   */
  mark?: string
  /** The card's one standing sentence, when it has one. Absent ⇒ nothing renders. */
  note?: string
  /**
   * `"consequence"` draws the sheet's amber left edge — the treatment it reserves for the two
   * places a person is being told something happens OUTSIDE the run (`border-l-2
   * border-l-[#F5A524]` on the outside-changes card and on the closing checklist).
   *
   * ⚠ IT IS A TONE, NOT A STATE. Nothing here computes whether a consequence is armed; the
   * caller states which card it is drawing, and the arming fact stays where D-04 put it.
   */
  accent?: "consequence"
  /** The shipped controls this card frames. The card composes; it never rebuilds. */
  children: ReactNode
}

/** The sheet's outside label: small caps, wide tracking, the dim ink. */
const CARD_TITLE_CLASSES =
  "text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"

/** The sheet's inset panel — DARKER than the aside around it, which is what reads as a card. */
const CARD_BODY_BASE = "rounded border border-border bg-background p-3"

/** The amber left edge, mapped off the sheet's `#F5A524` onto the shipped `--warning` token.
 *  ⚠ `warning` is a real Tailwind key here (192.2 WR-01 added the declaration `bg-warning`
 *  had been silently compiling to nothing without); it is not a raw hex, and not a new colour. */
const CARD_BODY_CONSEQUENCE = "border-l-2 border-l-warning"

/**
 * A titled card around controls the panel already renders.
 *
 * ⚠ `col-span-2` BY CONSTRUCTION. The panel's field area is a two-column grid and every card
 * spans it, so a card can never end up as a half-width cell beside an unrelated field — which
 * is the layout the sheet is replacing, not the one it draws.
 *
 * ⚠ `data-card`, NOT `data-rail`. `PhaseFormPanel.rails.test.tsx`'s D-14 assertion counts
 * `[data-rail]` elements and requires **zero** in a rails-absent render, because the rails are
 * the flagged Canvas surface and a flag-off author must see today's panel. These cards render
 * on BOTH surfaces, so borrowing the rails' attribute would turn a passing byte-identity guard
 * red for a reason that has nothing to do with rails.
 */
export function StepCardSection({
  title,
  testId,
  anchorId,
  mark,
  note,
  accent,
  children,
}: StepCardSectionProps) {
  return (
    <section
      id={anchorId}
      data-card="step"
      data-testid={testId}
      className="col-span-2 flex flex-col gap-1.5 scroll-mt-3"
    >
      <h3 className={CARD_TITLE_CLASSES}>{title}</h3>
      <div
        className={[CARD_BODY_BASE, accent === "consequence" ? CARD_BODY_CONSEQUENCE : ""].join(
          " ",
        )}
      >
        {/* The sheet puts the mark on the card's FIRST line, hard right, above the sentence
            it qualifies — so it is read before the consequence, not after it. */}
        {mark !== undefined && (
          <div className="mb-2 flex items-baseline justify-end">
            <span
              data-testid={`${testId}-mark`}
              className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-foreground"
            >
              {mark}
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">{children}</div>
        {/* ⚠ BELOW the children, not above them. On the one card that carries a note, the
            child is the CHOSEN consequence (`Sends an email`) and the note is the standing
            sentence about the whole class of them — the sheet's own reading order, specific
            fact first. A note printed above would put the general claim where the person is
            looking for the particular one. */}
        {note !== undefined && (
          <p
            data-testid={`${testId}-note`}
            className="mt-2 text-[11px] leading-snug text-muted-foreground"
          >
            {note}
          </p>
        )}
      </div>
    </section>
  )
}

export default StepCardSection
