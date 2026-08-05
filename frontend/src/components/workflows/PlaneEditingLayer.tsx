/**
 * Phase 188.1-03 Task 1 (D-01) — PlaneEditingLayer.
 *
 * THE `＋` / `✕` PLANE LAYER, AND THE MENU IT OPENS. Ten props in, four callbacks out,
 * two React Flow context reads: it owns no state, fetches nothing, and closes over
 * nothing at module scope — which is why it could be lifted out of the canvas shell at
 * all, and the property the next author has to keep true.
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the future:
 * `PlaneEditingLayerProps` and `PlaneEditingLayer` were CUT out of `WorkflowCanvas.tsx`
 * (they were declared there at `:526` and `:569` — the tail of Region B, `:526-728` —
 * before the 188.1-03 plan). It is a HARD CUT: `WorkflowCanvas.tsx` declares neither any
 * more and NO re-export shim was left behind; it imports the component from here and
 * renders it at the byte-identical JSX site inside `<ReactFlow>`. The body moved
 * byte-for-byte with its docblock and every inline comment intact — nothing re-typed,
 * nothing tidied, nothing re-ordered — so the phase's first diff reads as a MOVE under
 * `git diff --numstat` rather than as a rewrite a reviewer would have to re-derive.
 *
 * ⚠ THE `:NNN` REFERENCES INSIDE THE MOVED DOCBLOCK POINT AT THE PRE-MOVE
 * `WorkflowCanvas.tsx` (measured 1593 L at `eff79154`), not at this file. Kept as
 * shipped, for the same reason.
 *
 * THE GEOMETRY LIVES ONE FILE AWAY, AND THAT SPLIT IS MECHANICAL RATHER THAN TIDY (D-01).
 * `EDIT_AFFORDANCE`, `REVEAL_ON_HOVER`, `insertPointX` and `verticalOffsetFor` went to
 * `editAffordance.ts` — a `.ts` leaf — because a component module may not export a shared
 * runtime value: `react-refresh/only-export-components` errors for exactly that, which is
 * what `WorkflowCanvas.tsx:365` errored for before this move and what `FlowEdge.tsx:135`
 * errors for still. So THIS FILE EXPORTS THE COMPONENT AND ITS PROPS TYPE AND NO RUNTIME
 * VALUE OF ANY KIND. Adding one puts the directory's lint count back where it started and
 * silently undoes D-01's only measurable win (`eslint src/components/workflows/`: 6 → 5).
 *
 * NOT WRAPPED IN A RE-RENDER CACHE, DELIBERATELY. An extraction is only worth trusting if
 * it changed nothing, and a render-skipping wrapper changes WHEN this subtree renders —
 * an unmeasured behaviour change under SC#2, on the surface whose whole promise this
 * phase is "renders identically". `StepTypePicker`, the closest analog and this
 * component's own child, is unwrapped too. `FlowEdge.tsx` is not the analog to copy.
 *
 * These paragraphs are kept honest by machine, not by habit. `WorkflowCanvas.test.tsx`
 * and `WorkflowCanvas.composition.test.tsx` read this file's SOURCE through the 188.1-01
 * subtree fence — an `import.meta.glob` `?raw` sweep whose path list already named
 * `./PlaneEditingLayer.tsx` before this file existed — so the twelve negative scope fences
 * that guarded this code inside the canvas now read it here rather than quietly covering
 * 311 fewer lines; that fence was observed RED against a violation planted in this file.
 * A second fence in the same suite forbids this module from naming a `WorkflowCanvas`
 * specifier in ANY import form (static, dynamic or type-only), because `WorkflowCanvas`
 * imports `FlowEdge`'s component VALUE at module scope for its `edgeTypes` map: an import
 * back would close a live ESM cycle, and a cycle typechecks clean, lints clean and fails
 * only at RUNTIME as a TDZ `ReferenceError` in whichever module a caller reaches first.
 * And `FlowEdge.test.tsx`'s focusable-token control now reads this file alongside the
 * canvas, because the `＋` and `✕` click handlers — the very controls SC#4's "no focusable
 * control lives inside a node" walk is about — moved here with the component.
 */
import { ViewportPortal, useStore as useFlowStore, type XYPosition } from "@xyflow/react"

import { CANVAS_LAYOUT } from "@/components/workflows/canvasModel"
import type { PhaseTypeId } from "@/components/workflows/definitionOps"
import {
  EDIT_AFFORDANCE,
  REVEAL_ON_HOVER,
  insertPointX,
  verticalOffsetFor,
} from "@/components/workflows/editAffordance"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
import { StepTypePicker } from "@/components/workflows/StepTypePicker"

export interface PlaneEditingLayerProps {
  phases: PhaseSpecJSON[]
  /** Lane centres in render order — the x of every phase column. */
  lanes: readonly number[]
  /** Phase slugs in render order, the same array the keyboard reorder indexes. */
  phaseOrder: readonly string[]
  /** The cosmetic offsets, so an affordance can follow the card it belongs to. */
  nudges?: Record<string, number>
  /** Live drag positions, so it follows DURING the gesture and not only after it. */
  dragOverlay: Record<string, XYPosition>
  /** Which insertion boundary the picker is open at, or null. */
  pickerAt: number | null
  onOpenPicker: (index: number) => void
  onDismissPicker: () => void
  onChooseType: (index: number, type: PhaseTypeId) => void
  onRequestRemove?: (slug: string) => void
}

/**
 * The `＋` / `✕` layer, and the one structural reason it looks the way it does.
 *
 * `WorkflowCanvas.test.tsx:231-238` asserts that for EVERY `.react-flow__node`,
 * `querySelectorAll("button, a, [tabindex]")` is empty — one tab stop per node, no
 * double stop. So a per-node action cannot be a child of the node, and this layer is
 * not a workaround for that: the affordances are positioned against the LANE, in flow
 * coordinates, through the library's own `<ViewportPortal>`, so they pan and zoom with
 * the cards they belong to while living outside every node's DOM subtree.
 *
 * Under 137-B (`themes/canvas-184.css` `body.card-b`, built by 185-01) every other edge
 * of the card is already spoken for: the TOP edge belongs to the floating 3D icon, the
 * LEFT edge carries the verdict mark (184-08, moved left by 185-01), and the TOP-RIGHT
 * corner is CLAIMED for the governance seal (SPEC Req 6 / D-185-17). So the `✕` sits on
 * the BOTTOM edge — `body.card-b .acts { bottom: -12px }`, i.e. straddling the card's
 * lower border. The card's height is READ from the library's measurement rather
 * than assumed, because a card grows downward from `NODE_MIN_HEIGHT` and a fixed offset
 * would drift up into the body of a two-line title.
 *
 * IT AUTHORS NO REFUSAL AND CONSULTS NO SERVER. Every disabled row and every reason in
 * the menu comes from `definitionOps.allowedTypesAt` by way of `StepTypePicker`; the
 * removal predicate is the caller's `canRemovePhase`. A refusal is a SHAPE rule decided
 * from the phases already in hand, a verdict is a server judgement, and this file names
 * the validation seam nowhere (its suite greps for that).
 */
export function PlaneEditingLayer({
  phases,
  lanes,
  phaseOrder,
  nudges,
  dragOverlay,
  pickerAt,
  onOpenPicker,
  onDismissPicker,
  onChooseType,
  onRequestRemove,
}: PlaneEditingLayerProps) {
  // The live viewport zoom. The menu is COUNTER-SCALED by it so a person reading six
  // sentences at 0.3× is not handed 4px type; the ＋ and ✕ deliberately do scale, since
  // they are glued to the cards and read as part of the drawing.
  const zoom = useFlowStore((state) => state.transform[2])

  // Measured card heights, joined into ONE primitive so the selector's result is
  // reference-stable and zustand does not re-render on every unrelated store write. A
  // node the library has not measured yet (and every node under jsdom) reports 0 and
  // falls back to the layout table's floor.
  const heightKey = useFlowStore((state) =>
    phaseOrder
      .map((id) => Math.round(state.nodeLookup.get(id)?.measured?.height ?? 0))
      .join(","),
  )
  const heights = heightKey.split(",")
  const heightAt = (position: number) => {
    const measured = Number(heights[position])
    return Number.isFinite(measured) && measured > 0 ? measured : CANVAS_LAYOUT.NODE_MIN_HEIGHT
  }

  const boundaries = lanes.length + 1

  return (
    <ViewportPortal>
      {Array.from({ length: boundaries }, (_, index) => (
        <button
          key={`canvas-insert-${index}`}
          type="button"
          data-testid={`canvas-insert-${index}`}
          data-canvas-affordance="insert"
          aria-haspopup="menu"
          aria-expanded={pickerAt === index}
          aria-label={
            index >= lanes.length ? "Add a step at the end" : `Add a step before step ${index + 1}`
          }
          onClick={() => onOpenPicker(index)}
          className={[
            "absolute grid place-items-center rounded-full border border-dashed border-border",
            "bg-card text-[15px] leading-none text-muted-foreground transition-opacity",
            "hover:border-solid hover:border-primary hover:text-primary",
            "motion-reduce:transition-none",
            REVEAL_ON_HOVER,
          ].join(" ")}
          style={{
            left: 0,
            top: 0,
            width: EDIT_AFFORDANCE.INSERT_SIZE,
            height: EDIT_AFFORDANCE.INSERT_SIZE,
            transform: `translate(${insertPointX(lanes, index) - EDIT_AFFORDANCE.INSERT_SIZE / 2}px, ${
              EDIT_AFFORDANCE.INSERT_Y -
              EDIT_AFFORDANCE.INSERT_SIZE / 2 +
              // The connector's own slant: the mean of the two cards this boundary sits
              // between, so the `＋` stays ON the drawn line when either is nudged. At
              // the two ends there is only one neighbour, so it simply follows that one.
              (verticalOffsetFor(phaseOrder[index - 1], nudges, dragOverlay, CANVAS_LAYOUT.LANE_Y) +
                verticalOffsetFor(phaseOrder[index], nudges, dragOverlay, CANVAS_LAYOUT.LANE_Y)) /
                (index > 0 && index < phaseOrder.length ? 2 : 1)
            }px)`,
          }}
        >
          <span aria-hidden="true">＋</span>
        </button>
      ))}

      {phaseOrder.map((slug, position) => (
        <button
          key={`canvas-remove-${slug}`}
          type="button"
          data-testid={`canvas-remove-${slug}`}
          data-canvas-affordance="remove"
          aria-label={`Remove step ${position + 1}`}
          onClick={() => onRequestRemove?.(slug)}
          className={[
            "absolute grid place-items-center rounded-[7px] border border-border",
            "bg-card text-[11px] leading-none text-muted-foreground transition-opacity",
            // ⚠ THE HOVER RED IS A RAW LITERAL, NOT THE `destructive` DESIGN TOKEN, and
            // that is deliberate. R9 reserves that token for the `error` verdict mark and
            // proves it by SCANNING the emitted HTML for the token's name: a draft that
            // is all "not finished yet" must spend it zero times. Dressing this button in
            // it would make that shipped scan report a colour it was never written to
            // measure — a guard passing (or failing) for the wrong reason. The values are
            // `canvas-184.css`'s own `.acts button.danger:hover`.
            "hover:border-[hsl(0_72%_51%/0.6)] hover:text-[hsl(0_85%_74%)]",
            "motion-reduce:transition-none",
            REVEAL_ON_HOVER,
          ].join(" ")}
          style={{
            left: 0,
            top: 0,
            width: EDIT_AFFORDANCE.REMOVE_SIZE,
            height: EDIT_AFFORDANCE.REMOVE_SIZE,
            transform: `translate(${
              lanes[position] + CANVAS_LAYOUT.NODE_WIDTH / 2 - EDIT_AFFORDANCE.REMOVE_SIZE / 2
            }px, ${
              heightAt(position) -
              EDIT_AFFORDANCE.REMOVE_SIZE / 2 +
              // This button belongs to exactly one card, so it takes that card's whole
              // offset — nudged or mid-drag. Without it the `✕` stays on the lane while
              // its card walks away, which is the stranded control in the screenshots.
              verticalOffsetFor(slug, nudges, dragOverlay, CANVAS_LAYOUT.LANE_Y)
            }px)`,
          }}
        >
          <span aria-hidden="true">✕</span>
        </button>
      ))}

      {pickerAt !== null ? (
        <div
          data-testid="canvas-insert-picker"
          // `pointer-events-auto` for the SAME reason the affordances carry it: this
          // wrapper renders through `<ViewportPortal>`, whose ancestors the library
          // pins to `pointer-events: none`. Without it the menu opens, reads correctly,
          // and every row silently ignores the click — the failure the operator hit.
          className="pointer-events-auto absolute"
          style={{
            left: 0,
            top: 0,
            transformOrigin: "top left",
            transform: `translate(${
              insertPointX(lanes, pickerAt) - EDIT_AFFORDANCE.PICKER_WIDTH / 2
            }px, ${
              EDIT_AFFORDANCE.INSERT_Y +
              EDIT_AFFORDANCE.PICKER_DROP +
              // Opens under the `＋` it belongs to, so it tracks the same slant.
              (verticalOffsetFor(
                phaseOrder[pickerAt - 1],
                nudges,
                dragOverlay,
                CANVAS_LAYOUT.LANE_Y,
              ) +
                verticalOffsetFor(phaseOrder[pickerAt], nudges, dragOverlay, CANVAS_LAYOUT.LANE_Y)) /
                (pickerAt > 0 && pickerAt < phaseOrder.length ? 2 : 1)
            }px) scale(${1 / (zoom || 1)})`,
          }}
        >
          <StepTypePicker
            phases={phases}
            index={pickerAt}
            open
            onChoose={(type) => onChooseType(pickerAt, type)}
            onDismiss={onDismissPicker}
          />
        </div>
      ) : null}
    </ViewportPortal>
  )
}
