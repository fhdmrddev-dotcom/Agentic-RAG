/**
 * Phase 200-04 Task 2 (DES-02, `200-CHECKLIST.md` §1 `SP-MR-02` / `SP-MR-03` / `SP-MR-04`) —
 * THE STEP PANEL'S CARD SHELL.
 *
 * Sheet c4 draws the step form as named cards rather than as one flat column of fields. This
 * is that shell, and it is deliberately nothing else: a titled `<section>` that frames
 * children the panel already renders.
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
 * the three cards this shell frames carry exactly those facts (`What it can reach`, `What it
 * changes outside this workflow`), and both are already enumerated in `FENCED_IN` in the
 * panel's suite. A disclosure here would fold a refusal behind a click, which is how a person
 * meets a refusal by being surprised. So: no state, no switch, nothing to hold.
 *
 * ── THE MARK IS A WORD, NOT A GLYPH (N-5 / `SP-MNR-03`) ─────────────────────────────────
 *
 * The sketch draws its marks as Material Symbols LIGATURE NAMES — `lock`, `shield`, `bolt`,
 * `check_circle` — and `200-CHECKLIST.md` N-5 forbids every one of them as visible text: the
 * product's icon authority is `icon-convention.md` §1 (`@lobehub/icons` for provider/model
 * marks), §2 (the shared 3D `PHASE_GLYPHS` map for phase types) and §4 (the canvas mark table).
 * **No net-new mark is invented here.** `NEEDS ARMING` renders as the words it is.
 */
import type { ReactNode } from "react"

export interface StepCardSectionProps {
  /** The card's heading — always from `stepCardSectionContext.ts`, never a literal. */
  title: string
  /** The `data-testid` a fence can find the card by. */
  testId: string
  /**
   * A short standing mark rendered beside the title (`NEEDS ARMING`).
   *
   * ⚠ ABSENT ⇒ NOTHING RENDERS, never an empty pill. A blank mark is byte-indistinguishable
   * from a mark that failed to resolve, and on a governance card the two readings are opposite.
   */
  mark?: string
  /** The card's one standing sentence, when it has one. Absent ⇒ nothing renders. */
  note?: string
  /** The shipped controls this card frames. The card composes; it never rebuilds. */
  children: ReactNode
}

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
export function StepCardSection({ title, testId, mark, note, children }: StepCardSectionProps) {
  return (
    <section
      data-card="step"
      data-testid={testId}
      className="col-span-2 rounded border border-border bg-muted/40 px-2.5 py-2"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-medium text-foreground">{title}</h3>
        {mark !== undefined && (
          <span
            data-testid={`${testId}-mark`}
            className="shrink-0 rounded border border-border bg-card px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-foreground"
          >
            {mark}
          </span>
        )}
      </div>
      {note !== undefined && (
        <p data-testid={`${testId}-note`} className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {note}
        </p>
      )}
      <div className="mt-1.5 grid grid-cols-2 gap-3">{children}</div>
    </section>
  )
}

export default StepCardSection
