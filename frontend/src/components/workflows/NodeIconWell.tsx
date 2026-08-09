/**
 * Phase 188.2-05 Task 1 (D-04) — NodeIconWell.
 *
 * THE 3D MARK THAT FLOATS ABOVE THE CARD'S TOP EDGE. Four nested `<span>`s — a soft light
 * disc, the per-type tint inside it, its own contact shadow, and the mark itself — and
 * nothing else. It is its own module rather than a third block inside a corner-marks file
 * because D-04 groups by ONE REASON TO CHANGE and this well has its own: it is 137-B's
 * top-edge geometry, owned by the card's own design lineage, whereas the corner marks
 * belong to 184's verdict and 185's governance and the ring belongs to 188's run state.
 * Three phases' ownership in one omnibus module is exactly what D-04 forbids.
 *
 * THIS DOCBLOCK IS LONGER THAN THE BODY, AND THAT IS CORRECT. `editAffordance.ts` — the
 * other leaf 188.1 cut — wraps a 13-line table in a 52-line header for the same reason:
 * the code is short because the decisions are already made, and the decisions are what a
 * later editor needs. Trimming the prose to improve the ratio would delete the only part
 * of this file that is hard to reconstruct.
 *
 * THE 3D MARK FLOATS ABOVE THE CARD'S TOP EDGE OVER ITS OWN CONTACT SHADOW — sketch 137-B,
 * the locked acceptance bar, whose card is a 248px frosted-glass block centred inside the
 * 260px node box with this mark floating above it and the title, supporting line and
 * word-badges centred beneath. (185-01 rebuilt that shape from 137-D, where the mark sat at
 * the LEFT edge of a full-width card pushed 24px right by a left margin, its body padded to
 * clear the icon. The move is not decoration: SPEC Req 6 CLAIMS top-right for the governance
 * seal and relocates the verdict mark to the left, and on 137-D a left verdict overlapped
 * the left-edge icon well by 14×8px — no left placement was reachable at all. D-185-17
 * sequences that rebuild ahead of every governance mark, as its own separately-committed
 * plan, and raises the card's top padding 34 → 42 so this mark clears the title by 11px.)
 *
 * PER-STEP-TYPE COLOUR IS A TINT BEHIND THE ICON ONLY — this element and nowhere else. The
 * card banked its whole colour budget for exactly that, and Phase 188 is what spends the
 * rest of it, one file away in `NodeRunOverlay.tsx`.
 *
 * ⚠ THE TWO PARAGRAPHS ABOVE ARRIVED FROM `PhaseNodeCard.tsx:72-87` AND `:89-95` IN THE
 * 188.2-06 CUT (D-01 — the prose travels WITH its code). Both were MIXED and both were
 * SPLIT rather than moved whole: the card's own padding and min-height CONSTANTS stayed
 * with the card div that spends them, and the run-state motion clause went to
 * `NodeRunOverlay.tsx`.
 *
 * IT PERFORMS NO LOOKUP — THAT IS THE TOTALITY CONTRACT, AND IT IS FENCED. Both props
 * arrive ALREADY RESOLVED at the card (`PhaseNodeCard.tsx:220-222`, `:232-234`): the
 * ADAPTER resolves the per-type tint, falling back to `nodePresentation.DEFAULT_TINT`,
 * and resolves the mark, before either reaches this component. So an unrecognised phase
 * type is a data attribute one level up and never a table read here, and the card — now
 * this module — cannot crash on a forward-compat discriminator. `PhaseNodeCard.test.tsx`
 * pins it at `:334-351` and a `?raw` fence forbids this file from importing either tint
 * table or indexing one; the fence is anchored on the TWO TINT IDENTIFIERS rather than on
 * the module path, which is the 184-08 narrowing.
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the future.
 * **AT THIS COMMIT THE CARD STILL DECLARES ITS OWN COPY OF THIS BLOCK AND IMPORTS
 * NOTHING FROM HERE.** 188.2-05 is ADDITIVE by design — create additively, then cut, the
 * split 188.1 proved. `PhaseNodeCard.tsx:764-794` (measured 797 L at HEAD `42b42cb7`)
 * was moved here VERBATIM, its JSX comment intact, so the span `diff` against the
 * pre-move card is EMPTY. `188.2-06` owns the HARD CUT: it deletes the card's copy,
 * leaves NO re-export shim, and renders `<NodeIconWell>` at the byte-identical JSX site.
 *
 * ⚠ THE ONE SENTENCE IN THE MOVED COMMENT THAT MAY NOT BE RE-WORDED. It names the
 * layout utility this whole subtree is forbidden to take, and it is the TREE'S ONLY
 * mention of it: `PhaseNodeCard.test.tsx` counts the occurrences across the six-file card
 * subtree and pins the total at EXACTLY ONE, so the rule cannot be deleted as easily as
 * the utility cannot be added. Do not re-word it, do not paraphrase it, and do not add a
 * second mention anywhere in this subtree — including in this header, which is why the
 * paragraph you are reading refers to it obliquely.
 *
 * ⚠ THE `:NNN` REFERENCES INSIDE THE MOVED COMMENT POINT AT THE PRE-MOVE
 * `PhaseNodeCard.tsx` (797 L at `42b42cb7`), never at this file. Kept stale ON PURPOSE —
 * a move that renumbered its own prose would stop being a move.
 *
 * THIS FILE EXPORTS THE COMPONENT AND ITS PROPS TYPE AND NO RUNTIME VALUE OF ANY KIND.
 * `react-refresh/only-export-components` errors for exactly that: it is what
 * `FlowEdge.tsx:147` and `BuilderStoreProvider.tsx:45, 53, 78` error for today, and those
 * four errors are the whole of this directory's lint count. One `export const` here takes
 * `eslint src/components/workflows/` from 5 back to 6 and silently undoes 188.1's only
 * measurable lint win. Type-only exports are exempt, which is why the props interface
 * below is exported and nothing else is.
 *
 * NOT WRAPPED IN A RE-RENDER CACHE, DELIBERATELY. An extraction is only worth trusting if
 * it changed nothing, and a render-skipping wrapper changes WHEN this subtree renders —
 * an unmeasured behaviour change on the surface whose whole promise is "renders
 * identically". `PlaneEditingLayer.tsx`, 188.1's own output and the shape this file
 * copies, is unwrapped for the same recorded reason. `FlowEdge.tsx:134`'s import of the
 * render-skipping wrapper is explicitly NOT the analog to copy.
 *
 * These paragraphs are kept honest by machine, not by habit. `PhaseNodeCard.test.tsx`
 * reads this file's SOURCE through the 188.2-01 subtree fence — an `import.meta.glob`
 * `?raw` sweep whose path list already named `./NodeIconWell.tsx` before this file
 * existed — so the SEVENTEEN negative scope fences that guarded this code inside the card
 * now read it here, including the zero-graph-library property D-184-06 exists for. A
 * second fence forbids this module from naming a `PhaseNodeCard` specifier in ANY import
 * form (static, dynamic or type-only), because after the cut the card references this
 * component as a VALUE at module scope: an import back would close a live ESM cycle,
 * which typechecks clean, lints clean, and fails only at RUNTIME as a TDZ
 * `ReferenceError` in whichever module a caller reaches first.
 */
import type { ReactNode } from "react"

export interface NodeIconWellProps {
  /** The already-resolved 3D mark for this phase type. A plain `ReactNode`, handed over
   *  by the adapter — this module looks nothing up. */
  icon: ReactNode
  /** The already-resolved per-type tint, as a plain CSS colour string. It reaches an
   *  inline style object and NEVER markup, which is why this module renders no authored
   *  string into the HTML sink and the XSS fence has no site here to protect. */
  tint: string
}

/**
 * The floating well, and the one rule that governs everything around it.
 *
 * THE DESIGN ARGUMENT IS NOT REPEATED HERE — IT MOVED WITH THE CODE. The JSX comment
 * below carries it unedited: the theme rule the geometry comes from, the canvas-local
 * lightening behind the mark, the per-type tint inside the disc, the contact shadow, and
 * the upward 26px overhang together with the constraint that overhang imposes on every
 * ancestor. D-01 says a comment moves with the code it explains; lifting that paragraph
 * up here would have made the span `diff` non-empty — and, worse, would have moved the
 * one sentence a shipped count fence pins, turning a verbatim move into an edit of the
 * exact prose the phase was scoped around.
 *
 * WHAT THIS DOCBLOCK ADDS is the sentence the card never had to say. The overhang is not
 * decoration: the mark clears the node box upward by 26px and the status ring by 31px, so
 * the ban on clipping is a property of the WHOLE ancestor chain — this wrapper, the card,
 * the node box, and the node wrapper the graph library puts around it — not of the one
 * element that overhangs. `NodeRunOverlay`'s ring block states the same rule for its own
 * element and deliberately does not spell the utility a second time.
 *
 * IT IS `aria-hidden` AND CARRIES NO CONTROL. No role, no tab index, no handler: one tab
 * stop per node is a canvas-level invariant, and the node's own accessible name already
 * states the phase type as real text. The suite's no-focusable-control walk reads this
 * file.
 */
export function NodeIconWell({ icon, tint }: NodeIconWellProps) {
  return (
    <>
      {/* The 3D mark FLOATING ABOVE THE CARD'S TOP EDGE, horizontally centred on it
          (`themes/canvas-184.css` `body.card-b .node .icowrap`: `left:50%; top:-26px;
          62×62`): a soft light disc behind it (the D-183-14 canvas-local icon-well
          lightening, applied uniformly), the per-type tint inside that disc, and its
          own contact shadow beneath.

          It overflows the node box upward by 26px. That is the SAME overflow the
          verdict mark already relies on, and it is why nothing in this subtree — or in
          the node wrapper around it — may ever take `overflow-hidden`. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-26px] grid h-[62px] w-[62px] -translate-x-1/2 place-items-center"
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${tint}, transparent 68%)`,
          }}
        />
        <span
          className="absolute inset-1 rounded-full bg-foreground/10"
          style={{ filter: "blur(2px)" }}
        />
        <span
          className="absolute bottom-0 left-1/2 h-2 w-9 -translate-x-1/2 rounded-[50%] bg-black/50"
          style={{ filter: "blur(5px)" }}
        />
        <span className="relative grid place-items-center text-[20px] leading-none text-foreground drop-shadow-[0_9px_13px_rgba(0,0,0,0.8)]">
          {icon}
        </span>
      </span>
    </>
  )
}
