/**
 * Phase 188.2-05 Task 2 (D-04) — NodeRunOverlay.
 *
 * PHASE 188'S RUN STATE, DRAWN AROUND THE CARD. The status ring that turns the 62px icon
 * well into a dial, the five geometry constants that place it, the arc pattern it paints,
 * and the pause chip that sits in the ring's 12-o'clock gap for the one reading that needs
 * a person to act. That is ONE reason to change — 188's run vocabulary — which is why it
 * is one module. 184's verdict mark and 185's governance seal are a DIFFERENT reason and
 * live in `NodeCornerMarks.tsx`; the card's own top-edge geometry is a third and lives in
 * `NodeIconWell.tsx`. D-04 forbids the omnibus module that would have mixed all three
 * phases' ownership behind one import.
 *
 * PURELY PRESENTATIONAL, LIKE THE CARD IT CAME OUT OF. One prop in, no callback out, no
 * context read, no state owned, nothing fetched, nothing closed over at module scope —
 * and, per D-184-06, NOTHING imported from the canvas graph library.
 *
 * WHAT 188 FILLED, in the same voice, because a docblock that still names a slot the
 * component now fills is the same defect as a false one: plan 188-06 filled `status` (with
 * a new `emitFailure` companion) and it is the first slot that puts the card into a MODE —
 * supplying a reading adds THE STATUS RING ABOVE THE CARD, which is this module. (Arrived
 * from `PhaseNodeCard.tsx:34-41` in the 188.2-06 cut, and SPLIT rather than moved whole:
 * the same slot also adds the run line inside the card, a run-state branch on its border
 * and a raised minimum height, and all three of those STAYED. Half-true is the worst state
 * a docblock can be in, so each half now sits in the file that owns what it describes.)
 *
 * MOTION KEYS OFF RUN STATE, NEVER OFF SELECTION — the defect found in the sketch 137
 * review, and 188-06 is where that sentence stopped being hypothetical: the ONE animation
 * on the card is the running arc's spin, guarded behind `prefers-reduced-motion`, and it
 * lives here. A card with no reading is still completely still, and any ambient drift
 * still belongs to the canvas backdrop. The colour budget 137-B banked is spent here too —
 * the arc's stroke, and the run border on the three loud readings. (From
 * `PhaseNodeCard.tsx:89-95`, whose opening clause about the per-type tint behind the icon
 * went to `NodeIconWell.tsx` with the well it describes.)
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the future.
 * **AT THIS COMMIT THE CARD STILL DECLARES ITS OWN COPIES OF ALL FIVE RANGES AND IMPORTS
 * NONE OF THEM.** 188.2-05 is ADDITIVE by design — create additively, then cut, the split
 * 188.1 proved. `PhaseNodeCard.tsx:287` (the ring separator), `:312-355` (the five
 * constants), `:440-443` (the arc derivation), `:658-739` (the ring) and `:741-762` (the
 * pause chip), measured against 797 L at HEAD `42b42cb7`, were moved here VERBATIM —
 * docblocks, inline comments and `⚠` paragraphs and all — so every span `diff` against
 * the pre-move card is EMPTY and the phase reads as a MOVE under `git diff --numstat`
 * rather than as a rewrite a reviewer would have to re-derive. `188.2-06` owns the HARD
 * CUT: it deletes the card's copies, leaves NO re-export shim, and renders
 * `<NodeRunOverlay>` at the byte-identical JSX sites.
 *
 * ⚠ THE SEPARATOR ABOVE THE CONSTANTS TRAVELS WITH THE RING, NOT WITH THE OWN-GUARD.
 * `PhaseNodeCard.tsx:287` names the status ring, and it sat immediately above a helper
 * that 188.2-04 moved elsewhere. RESEARCH's cut table folds it into that helper's range;
 * that is the one place the table is imprecise, and it is corrected here rather than
 * silently followed.
 *
 * ⚠ ALL FIVE `RING_*` CONSTANTS ARE MODULE-PRIVATE, EXACTLY AS THEY WERE IN THE CARD.
 * The trap is exporting one "so a test can read it": the tests read `?raw` SOURCE and
 * rendered DOM instead, and one `export const` in a `.tsx` file re-fires
 * `react-refresh/only-export-components`.
 *
 * ⚠ THE `:NNN` REFERENCES INSIDE THE MOVED COMMENTS POINT AT THE PRE-MOVE
 * `PhaseNodeCard.tsx` (797 L at `42b42cb7`), never at this file. Kept stale ON PURPOSE —
 * a move that renumbered its own prose would stop being a move.
 *
 * THIS FILE EXPORTS THE COMPONENT AND ITS PROPS TYPE AND NO RUNTIME VALUE OF ANY KIND.
 * `react-refresh/only-export-components` errors for exactly that: it is what
 * `FlowEdge.tsx:147` and `BuilderStoreProvider.tsx:45, 53, 78` error for today, and those
 * four errors are the whole of this directory's lint count. One `export const` here takes
 * `eslint src/components/workflows/` from 5 back to 6 and silently undoes 188.1's only
 * measurable lint win. Type-only exports are exempt (measured: `PhaseNodeCard.tsx`
 * exports six types and contributes zero errors), which is why the props interface below
 * is exported and the five constants beside it are not.
 *
 * NOT WRAPPED IN A RE-RENDER CACHE, DELIBERATELY. An extraction is only worth trusting if
 * it changed nothing, and a render-skipping wrapper changes WHEN this subtree renders —
 * an unmeasured behaviour change on the surface whose whole promise is "renders
 * identically". That matters more here than anywhere else in the phase: this is the ONE
 * module that animates, and a skipped render is exactly the class of change nobody would
 * notice until a live run looked wrong. `PlaneEditingLayer.tsx`, 188.1's own output and
 * the shape this file copies, is unwrapped for the same recorded reason.
 * `FlowEdge.tsx:134`'s import of the render-skipping wrapper is explicitly NOT the analog
 * to copy.
 *
 * These paragraphs are kept honest by machine, not by habit. `PhaseNodeCard.test.tsx`
 * reads this file's SOURCE through the 188.2-01 subtree fence — an `import.meta.glob`
 * `?raw` sweep whose path list already named `./NodeRunOverlay.tsx` before this file
 * existed — so the SEVENTEEN negative scope fences that guarded this code inside the card
 * now read it here rather than quietly covering fewer lines than they did yesterday.
 * FOUR of them land squarely on this file: the ring's computed decimals must appear in
 * NEITHER module that produces them, the SVG attribute and the CSS function that would
 * place a gap by pivoting the circle are both banned outright, and the positive fence on
 * the spin class name now finds it here. A further fence forbids this module from naming
 * a `PhaseNodeCard` specifier in ANY import form (static, dynamic or type-only), because
 * after the cut the card references this component as a VALUE at module scope: an import
 * back would close a live ESM cycle, which typechecks clean, lints clean, and fails only
 * at RUNTIME as a TDZ `ReferenceError` in whichever module a caller reaches first.
 */
import { own } from "@/components/workflows/ownProperty"
import { ringDash, ringSpecFor } from "@/components/workflows/runVocabulary"
import type { CanvasReading } from "@/lib/phaseState"
import { cn } from "@/lib/utils"

// ── The status ring's constants (188-06 · sketch 153-A) ─────────────────────────

/** The arc's radius on the ring's own 72×72 viewBox. `d = 68px` inside a 72px box
 *  leaves the stroke 3px clear of the shipped 62px icon well on every side, so the ring
 *  never touches the 3D mark or its tint gradient. */
const RING_RADIUS = 34

/** Computed, never pasted. Every dasharray and dashoffset the ring emits is derived
 *  from this one number by `ringDash`, so moving the radius moves the whole pattern
 *  rather than leaving hand-written decimals describing a circle that no longer exists. */
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/** The ring's own box, concentric with the 62px well: `(72 − 62) / 2 = 5`, and the well
 *  floats at `−26`, so the ring floats at `−31`. Not a spacing choice and not roundable. */
const RING_BOX_CLASSES =
  "pointer-events-none absolute left-1/2 top-[-31px] z-[5] h-[72px] w-[72px] -translate-x-1/2"

/**
 * The arc's stroke per reading. **Colour REINFORCES; it never carries.**
 *
 * This table lives HERE, next to the one element it paints, rather than in
 * `runVocabulary` beside the word and geometry tables — and the split is deliberate.
 * The vocabulary module holds what a reading MEANS (its word, its clause, its arc
 * shape), all of which survive colour being switched off, which is sketch 153-A's whole
 * acceptance test and a build criterion rather than a preference. A stroke is a paint
 * detail of this SVG. The border table is the one colour value that does live in the
 * vocabulary module, because what needs a documented home there is not the three tokens
 * but the FOUR ABSENCES beside them — *Complete* declining to recolour the border is an
 * editorial decision, not a paint one.
 *
 * `unknown` is on the muted token ON PURPOSE. Spending an alarm colour on "we can't
 * tell" would make it look like a warning the run has not actually raised — the same
 * reasoning that keeps the degraded verdict mark off the destructive token.
 */
const RING_STROKE: Record<CanvasReading, string> = {
  "not-started": "",
  running: "hsl(var(--primary))",
  done: "hsl(var(--success))",
  failed: "hsl(var(--destructive))",
  skipped: "hsl(var(--muted-foreground))",
  "waiting-for-you": "hsl(var(--warning))",
  unknown: "hsl(var(--muted-foreground))",
  // 189 / D-16 — the calm terminal token, DUPLICATED from `skipped` and `unknown` on
  // purpose. Every other token would claim something untrue: success (the confusion this
  // reading exists to prevent), destructive (nothing failed), warning (the person has
  // already answered), primary (the run has moved on). Precedent, not laziness — the
  // SHAPE carries it, and this is the only ring drawn in four arcs.
  "recorded-not-sent": "hsl(var(--muted-foreground))",
}

/** The track every reading shares — the path the arc has or has not travelled. */
const RING_TRACK_STROKE = "hsl(var(--muted-foreground) / 0.35)"

export interface NodeRunOverlayProps {
  /** The step's run reading, ALREADY DERIVED. `null` means no reading was supplied at
   *  all — the Builder's case — and the whole overlay renders nothing, which is what
   *  keeps the 185 card unchanged wherever 188 is not in play.
   *
   *  ⚠ This is a READING, not a raw server status, and the difference is the point. The
   *  one derivation that answers "what state is this step in" lives in
   *  `frontend/src/lib/phaseState.ts`, is fenced by `phaseState.test.ts`, and is called
   *  by the ADAPTER (D-188-02 — one derivation, two vocabularies). This module is handed
   *  the answer and paints it. */
  reading: CanvasReading | null
}

/**
 * The ring, the arc and the chip — and the one line that had to be argued for.
 *
 * THE DESIGN ARGUMENT IS NOT REPEATED HERE — IT MOVED WITH THE CODE. The two JSX comments
 * below carry it unedited, and they ARE the argument: why the 62px well becomes the dial,
 * why the arc SHAPE is the state and colour only ever reinforces it, why all seven
 * readings differ in a property a machine can assert, the geometric derivation that makes
 * the ring concentric with the well, the `z-[5]` ordering against the seal and the verdict
 * mark, the `⚠` rule that a gap is placed with a dash offset and never by pivoting the
 * circle, the extension of the no-clipping rule to this element, and why the pause chip is
 * two rectangles and a SIBLING of the ring rather than a child of it. D-01 says a comment
 * moves with the code it explains; lifting those paragraphs up here would have made the
 * span `diff` non-empty and turned a move into a rewrite for no gain.
 *
 * WHAT THIS DOCBLOCK ADDS is the paragraph the card never needed, because inside the card
 * nobody could mistake this computation for a derivation:
 *
 * **MOVING THE `arc` DERIVATION HERE IS NOT A D-14 BREACH, AND THIS IS SAID OUT LOUD SO A
 * REVIEWER DOES NOT READ IT AS ONE.** `ringDash(ringSpecFor(reading), RING_CIRCUMFERENCE)`
 * is PURE GEOMETRY over a reading that arrived already derived — it turns a state that has
 * already been decided into a dash pattern on a circle of known circumference, and it can
 * answer no question about what a step is doing. D-14's red line forbids a presentational
 * module from deriving WHAT STATE A STEP IS IN, because a second answer to that question
 * is a second source of truth and the divergence surfaces as two surfaces disagreeing at
 * runtime. The single derivation that does answer it lives in
 * `frontend/src/lib/phaseState.ts` and is fenced there. THE WARNING SIGN TO STAY CLEAR OF
 * is therefore precise rather than vague: an import of that module's FUNCTIONS — as
 * opposed to its `CanvasReading` TYPE, which is all this file takes — would be the breach.
 * Adding a raw-status-to-reading mapping here, or a severity derivation, would be the same
 * breach wearing different clothes.
 *
 * AND ONE MEASUREMENT ABOUT THE LOOKUP. The own-guard on the arc's stroke table is WR-04
 * sink 5, and it is not ceremony: unguarded, an unowned reading handed back the inherited
 * member typed as a colour string, React OMITTED the function-valued attribute, and the
 * arc painted nothing at all. Observed RED before the guard was written. That
 * falsification drives through the CARD, whose copy still exists at this commit;
 * `188.2-06` re-verifies it keeps passing AND keeps reaching the moved code.
 *
 * IT IS `aria-hidden` AND CARRIES NO CONTROL. No role, no tab index, no handler: the
 * visible run line already states the reading as real text and the node's own accessible
 * name repeats it for focus, so a third announcement would make one step speak three
 * times. One tab stop per node is a canvas-level invariant, and the suite's
 * no-focusable-control walk reads this file.
 */
export function NodeRunOverlay({ reading }: NodeRunOverlayProps) {
  // `null` from `ringDash` means "paint NO arc", which is *Not started*'s whole reading:
  // the track exists and nothing has travelled it. It is a different thing from the
  // unbroken circle *Complete* paints, and the two must never collapse into each other.
  const arc = reading === null ? null : ringDash(ringSpecFor(reading), RING_CIRCUMFERENCE)

  return (
    <>
      {/* ── THE STATUS RING (RUNVIZ-01 · sketch 153-A · D-188-07) ──────────────────
          THE 62px ICON WELL BECOMES THE STATUS DIAL. **The arc SHAPE is the state;
          colour only ever reinforces it.** That is why this sketch won: it spends no
          badge slot, no step number, no technical line and no glyph — and it survives
          colour being switched off, which is its whole acceptance test and a BUILD
          criterion rather than a preference. All seven readings differ in a shape
          property a machine can assert: no arc / one short arc / a closed circle / one
          wide gap at 12 o'clock / two arcs / coarse dashes / fine dots.

          IT IS A SIBLING OF THE 3D MARK, RENDERED IMMEDIATELY BEFORE IT, so the mark
          always paints above the arc. Concentric with the well by construction: the
          well is 62px at `top-[-26px]`, this is 72px, and `(72 − 62) / 2 = 5` gives
          `−31`. Those two numbers are a geometric derivation, not spacing — rounding
          either to the 4px grid breaks the concentricity.

          `z-[5]` sits below the ⛨ seal (`z-[6]`) and the verdict mark (`z-[8]`). None
          of the three overlap geometrically, so the z-order is hygiene rather than
          arbitration.

          ⚠ **A GAP IS PLACED WITH `stroke-dashoffset`, NEVER BY ROTATING THE CIRCLE.**
          Giving an SVG circle a rotation attribute *and* the CSS `transform-box` /
          `transform-origin` pair composes the two and pivots the arc about a DOUBLED
          offset — that bug shipped in the sketch's own first two drafts and put the
          waiting gap in the wrong quadrant. Every offset here comes out of `ringDash`,
          and the only transform anywhere in this subtree is the spin utility class.

          ⚠ **THE CLIPPING BAN EXTENDS TO THIS ELEMENT** — the rule stated on the 3D
          mark well below (which spells the forbidden utility once, and is the only
          place in this file that may) now covers one more element and one more
          overhang: the mark clears the node box upward by 26px and this ring by 31px.
          Neither this wrapper, nor the `<svg>`, nor the card, nor the node box, nor the
          node wrapper around it may clip. `overflow-visible` on the `<svg>` is
          belt-and-braces on top of that.

          (The utility is deliberately NOT named a second time here. The suite fences
          it, and a comment that spelled it would make the fence match its own
          prohibition — the 187-24 lesson, which this phase has now met four times.
          The fence is therefore anchored on the CLASS-ATTRIBUTE form and the one
          surviving prose mention is asserted to be exactly one.)

          It is `aria-hidden` and carries no role, no tab index and no handler. The
          visible run line already states the reading as real text and the node's own
          accessible name repeats it for focus; a third announcement would make one step
          speak three times. */}
      {reading !== null ? (
        <span
          aria-hidden="true"
          data-testid="canvas-node-ring"
          data-reading={reading}
          className={RING_BOX_CLASSES}
        >
          <svg viewBox="0 0 72 72" className="block h-full w-full overflow-visible">
            <circle
              cx="36"
              cy="36"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="2.5"
              stroke={RING_TRACK_STROKE}
            />
            {arc ? (
              <circle
                data-testid="canvas-node-ring-arc"
                cx="36"
                cy="36"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                // WR-04 site 5 (188.1-04): an unowned reading paints the `unknown`
                // token, never an inherited member. See `own()`'s docblock — React
                // OMITS a function-valued attribute, so the unguarded form left this
                // arc with no stroke at all. Observed RED first.
                stroke={own(RING_STROKE, reading) ?? RING_STROKE.unknown}
                {...(arc.dasharray === null ? {} : { strokeDasharray: arc.dasharray })}
                strokeDashoffset={arc.dashoffset}
                className={arc.spinning ? "canvas-ring-spin" : undefined}
              />
            ) : null}
          </svg>
        </span>
      ) : null}

      {/* THE PAUSE CHIP, in the ring's 12-o'clock gap, for the waiting reading only.
          It is TWO `<span>` RECTANGLES of 3×9px — never the double-bar character. That
          is exactly how D-188-06's zero-net-new-glyph rule survives while the one
          reading that needs a person to act still gets a mark of its own. The phase
          ships no new mark anywhere, canvas or chrome.

          A SIBLING of the ring rather than a child of it: these coordinates are measured
          against the node box, and nesting them inside the ring's own absolute wrapper
          would re-anchor them to it. */}
      {reading === "waiting-for-you" ? (
        <span
          aria-hidden="true"
          data-testid="canvas-node-pause-chip"
          className={cn(
            "pointer-events-none absolute left-1/2 top-[-37px] z-[9] flex -translate-x-1/2",
            "gap-[3px] rounded border border-[hsl(var(--warning))] bg-background px-[5px] py-[3px]",
          )}
        >
          <span className="block h-[9px] w-[3px] bg-[hsl(var(--warning))]" />
          <span className="block h-[9px] w-[3px] bg-[hsl(var(--warning))]" />
        </span>
      ) : null}
    </>
  )
}
