/**
 * Phase 188.1-03 Task 1 (D-01) — editAffordance.
 *
 * EVERY PLACEMENT NUMBER THE CANVAS EDITING AFFORDANCES USE, AND THE TWO PURE FUNCTIONS
 * THAT TURN THEM INTO COORDINATES. A LEAF: it imports one layout table and one geometry
 * type, renders nothing, reads no DOM, opens no request and holds no store reference.
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the future:
 * `EDIT_AFFORDANCE`, `REVEAL_ON_HOVER`, `verticalOffsetFor` and `insertPointX` were CUT
 * out of `WorkflowCanvas.tsx` (they were declared there at `:365`, `:412`, `:506` and
 * `:518` — Region A `:346-413` plus the head of Region B `:486-524` — before the 188.1-03
 * plan). It is a HARD CUT: `WorkflowCanvas.tsx` declares none of them any more, imports
 * none of them, and NO re-export shim was left behind. The values moved byte-for-byte
 * with their docblocks intact; nothing was re-typed and nothing was tidied on the way —
 * including the one-line `insertPointX` docblock that has sat in the wrong place, above
 * `verticalOffsetFor`, since 184-12. It moved misplaced (D8), because a first diff that
 * reads as a pure MOVE is the property a reviewer of this phase relies on, and a
 * correction folded into the same commit destroys it.
 *
 * ⚠ THE `:NNN` REFERENCES INSIDE THE MOVED DOCBLOCKS POINT AT THE PRE-MOVE
 * `WorkflowCanvas.tsx` (measured 1593 L at `eff79154`), not at this file and not at the
 * canvas as it now stands. They are kept exactly as shipped for the same reason the
 * misplacement is.
 *
 * This paragraph is kept honest by machine, not by habit. `WorkflowCanvas.test.tsx` and
 * `WorkflowCanvas.composition.test.tsx` read this file's SOURCE through the 188.1-01
 * subtree fence — an `import.meta.glob` `?raw` sweep whose path list already named
 * `./editAffordance.ts` before this file existed — so the twelve negative scope fences
 * that guarded the moved code inside the canvas now read it here instead of quietly
 * covering 311 fewer lines. That fence was observed RED against a deliberate violation
 * planted in the moved code, so the sentence above is a measurement rather than a claim.
 *
 * ⚠ THE ESM-CYCLE REASON `FlowEdge.tsx:97-105` GIVES IS SUPERSEDED BY THIS FILE — AND THE
 * DUPLICATION IT JUSTIFIED STAYS ANYWAY. Until 188.1 the table below was declared in
 * `WorkflowCanvas.tsx`, which imports `FlowEdge`'s component VALUE at module scope for its
 * `edgeTypes` map; a `FlowEdge` → `EDIT_AFFORDANCE` import would therefore have closed a
 * live ESM cycle, and whichever module a caller reached first would have hit a TDZ
 * `ReferenceError` (`FlowEdge.test.tsx`, which imports that file directly, reaches it
 * first). This module is a leaf, so that import would now be legal. It is still not made:
 * `DETOUR` keeps deriving `GAP` and `INSERT_Y` from `CANVAS_LAYOUT` itself and
 * `FlowEdge.test.tsx:466-470` keeps pinning the two derivations equal (D2). Deleting one
 * side of a drift pin that has been observed RED deletes the pin's meaning, and collapsing
 * a duplication is a behaviour-shaped change owed its own phase rather than a line in a
 * move.
 *
 * …AND THE CYCLE CONSTRAINT IS NOW A TEST RATHER THAN A PARAGRAPH. `WorkflowCanvas.test.tsx`
 * forbids this module and `PlaneEditingLayer.tsx` from naming a `WorkflowCanvas` specifier
 * in ANY import form — static, dynamic, or type-only — and carries an inline positive
 * control so it cannot pass vacuously. That fence exists because a cycle typechecks clean,
 * lints clean and fails only at RUNTIME: prose is not a guard for a failure mode no build
 * step can see.
 */
import type { XYPosition } from "@xyflow/react"

import { CANVAS_LAYOUT } from "@/components/workflows/canvasModel"

/**
 * MODULE SCOPE for the same Pattern-4 reason as `nodeTypes` (`:99-104`) — every
 * placement number the editing affordances use, derived from `CANVAS_LAYOUT` and from
 * nothing else, so a stray literal cannot creep in beside the table the projection and
 * the CSS both already read.
 *
 * `GAP` is the empty space between one card's right edge and the next card's left edge
 * (`PITCH_X - NODE_WIDTH`), which is exactly where the connector — and therefore the
 * `＋` — lives. `INSERT_Y` is the connector's own height: `canvasModel` anchors every
 * edge at `EDGE_ANCHOR_Y` from the node top (never 50%), so the `＋` sits ON the drawn
 * line rather than merely near it, which is sketch 138-A's whole finding.
 *
 * EXPORTED BY 185-10, for a test and for nothing else. `FlowEdge.tsx` draws the armed
 * detour inside the SAME gap and derives `GAP` / `INSERT_Y` from `CANVAS_LAYOUT` in its
 * own `DETOUR` table, because importing this one would close a value-level ESM cycle
 * (this module needs `FlowEdge` at module scope for `edgeTypes`). `FlowEdge.test.tsx`
 * therefore imports BOTH tables and pins them equal, so the two derivations of one
 * number cannot drift apart without a red test.
 */
export const EDIT_AFFORDANCE = {
  /** The `＋` circle, `canvas-184.css` `.conn .ins`. */
  INSERT_SIZE: 26,
  /** The `✕` square, `canvas-184.css` `.acts button`. */
  REMOVE_SIZE: 24,
  /** Horizontal room between two cards — the connector's span. */
  GAP: CANVAS_LAYOUT.PITCH_X - CANVAS_LAYOUT.NODE_WIDTH,
  /** The line's height off the node top, so the `＋` lands on it. */
  INSERT_Y: CANVAS_LAYOUT.LANE_Y + CANVAS_LAYOUT.EDGE_ANCHOR_Y,
  /** How far below the `＋` the menu's top edge opens. */
  PICKER_DROP: 22,
  /** The picker's own width (`StepTypePicker.tsx` `w-[300px]`), halved to centre it. */
  PICKER_WIDTH: 300,
} as const

/**
 * VISIBILITY, and why it is spelled as two states rather than one hover rule.
 *
 * Above 1024px the `＋` is hover-revealed, so a canvas at rest is the flow and not a
 * row of controls. At or below 1024px — and on ANY device whose pointer cannot hover,
 * at any width — it is permanently visible, because a hover-only affordance on a touch
 * device is an affordance that does not exist. The base class is the VISIBLE one and
 * the hiding is scoped under `lg:`, which is what makes "present without a hover event"
 * assertable from the class list alone in a renderer that applies no CSS.
 *
 * ⚠ TWO CORRECTIONS, both found in live UAT and neither visible to a class-list assertion.
 *
 * 1. `pointer-events-auto` is REQUIRED, not decoration. These buttons render through
 *    `<ViewportPortal>`, and the library sets `pointer-events: none` on BOTH
 *    `.react-flow__viewport-portal` and `.react-flow__viewport` so the pane underneath
 *    stays draggable. Without re-enabling it here the buttons are not hit-testable:
 *    `document.elementFromPoint` at a button's own centre returns the CARD, so the
 *    affordance can be neither clicked nor hovered.
 *
 * 2. The reveal hangs off `group-hover/canvas`, NOT the button's own `:hover`. The
 *    original `lg:hover:opacity-100` was self-defeating twice over — an element at
 *    `pointer-events: none` can never receive the hover that is supposed to reveal it,
 *    and even once hit-testable, an `opacity: 0` control that only appears when the
 *    pointer is already on top of it has to be found blind. Hovering anywhere on the
 *    plane now reveals the whole affordance set, which is what "a canvas at rest is the
 *    flow" was always describing.
 *
 * Net effect of the bug: at >=1024px with a mouse, add-step and delete-step were
 * unreachable — CANVAS-02 was false for the primary desktop path while every unit test
 * passed, because jsdom applies no CSS and the suite asserted the CLASS LIST, which
 * cannot see a `pointer-events: none` inherited from a library ancestor.
 */
export const REVEAL_ON_HOVER =
  "pointer-events-auto opacity-100 lg:opacity-0 lg:group-hover/canvas:opacity-100 lg:focus-visible:opacity-100 [@media(hover:none)]:opacity-100"

/**
 * Phase 188.2-02 (D-10 · D-11 · `BUG-260806-01`) — THE STACKING TIER THE AFFORDANCES SIT AT.
 *
 * NOT A KEY OF `EDIT_AFFORDANCE`, deliberately. That table's docblock (`:57-61`) defines
 * itself as *"every placement number the editing affordances use, derived from
 * `CANVAS_LAYOUT` and from nothing else"*. This number is derived from `@xyflow`, so putting
 * it there would make that sentence false. It sits beside `REVEAL_ON_HOVER` instead, which is
 * the closest analog in every other way: a standalone const whose whole value is the
 * numbered list of corrections below it — corrections found in live UAT, none of which a
 * class-list assertion could ever have seen.
 *
 * ⚠ CORRECTION 3, and it is the same defect class as the two `REVEAL_ON_HOVER` records: an
 *    enabled, fully-revealed control that silently receives no pointer, found by hitting it
 *    with `document.elementFromPoint` and getting back the CARD.
 *
 * 3. A SELECTED card painted over its own `✕` (`BUG-260806-01`, found by hand during 188.1's
 *    operator UAT; the mechanism is older than that phase — the pre-extraction tree set no
 *    `zIndex` either). Traced end to end from the installed packages rather than guessed:
 *
 *      · `@xyflow/system/dist/esm/index.js:1547` declares `SELECTED_NODE_Z = 1000`, and
 *        `@xyflow/react/dist/esm/index.js:2343` applies it to the node wrapper as an INLINE
 *        STYLE (`zIndex: internals.z`). Inline, so no stylesheet of ours can outrank it.
 *      · `.react-flow__nodes` carries neither `position` nor `z-index` (`base.css:174-177`),
 *        so it opens NO stacking context — every `.react-flow__node` therefore competes
 *        directly inside the viewport's context at its own inline z.
 *      · `.react-flow__viewport-portal` has no `z-index` at all (`base.css:301-310`) and is
 *        the LAST sibling, so it is not a stacking context either and a POSITIONED child of
 *        it escapes into the viewport's context, where it can be ranked against the nodes.
 *        That is why one property on the child fixes this and nothing has to change about
 *        the portal, the DOM order, or the card.
 *      · Deselected, a node is `0` and the affordance is `auto`: a tie on z, later in DOM
 *        order wins, and the `✕` is reachable. Selected, the node is `1000` and beats
 *        `auto` outright — which is exactly the report's measured flip of reachable
 *        false → true on deselection with nothing else changed.
 *
 *    1002 RATHER THAN 1001, because `svg.react-flow__connectionline` is pinned at
 *    `z-index: 1001` (`@xyflow/react/dist/base.css:170`). This canvas draws no connection
 *    line today; colliding with a library layer for no benefit is free to avoid.
 *
 *    ALL THREE AFFORDANCE GROUPS CARRY IT — the `＋`, the `✕` and the picker wrapper. The
 *    report shows the `＋` reachable only because no node adjacent to one happened to be
 *    selected; a selected card occludes a nearby `＋` by the identical mechanism, so fixing
 *    the `✕` alone would have been fixing the symptom.
 *
 *    MEASURED PACKAGE VERSIONS: `@xyflow/react 12.11.2`, `@xyflow/system 0.0.79`. Recorded so
 *    an upgrade has something to check against — and checked by machine, not by this
 *    paragraph: `WorkflowCanvas.editing.test.tsx` asserts the relation below AND asserts the
 *    library's own elevation off a really-rendered selected node, so a version that changes
 *    `SELECTED_NODE_Z` turns a test red instead of silently re-opening the bug.
 */
export const AFFORDANCE_Z = 1002

/**
 * `@xyflow`'s number, mirrored here so the relation can be ASSERTED rather than implied.
 *
 * IT IS NOT OURS TO CHOOSE. `SELECTED_NODE_Z = 1000` is declared in
 * `@xyflow/system/dist/esm/index.js:1547` and applied as an inline style by
 * `@xyflow/react/dist/esm/index.js:2343`; this constant only records it. Changing it does not
 * change the library — it only breaks the guard that notices when the library changed.
 *
 * It exists because `AFFORDANCE_Z > SELECTED_NODE_Z_FROM_LIBRARY` is the property that makes
 * the `✕` reachable, and a property nobody names is a property nothing can re-check. jsdom
 * applies no CSS and computes no stacking contexts, so no unit test in this estate can
 * observe the occlusion itself — the relation, and a positive control that reads the
 * library's live elevation off a rendered selected node, are what re-run on every build.
 */
export const SELECTED_NODE_Z_FROM_LIBRARY = 1000

/** The flow x of insertion boundary `index`: 0 = before the first card, `lanes.length`
 *  = after the last one, anything between = the midpoint of that connector. */
/**
 * THE VERTICAL OFFSET AN AFFORDANCE MUST INHERIT FROM THE CARD IT BELONGS TO.
 *
 * `EDIT_AFFORDANCE.INSERT_Y` is a LANE constant — it describes where the connector sits
 * when every card is at its computed lane position. But a card can leave that line two
 * ways: the cosmetic `dy` nudge (D-184-10), and a drag in flight. Positioning the
 * affordances from the lane alone stranded them in empty space the moment either
 * happened — a `✕` floating where its card used to be, which is what the operator
 * screenshotted.
 *
 * The `✕` belongs to exactly one card, so it takes that card's whole offset. The `＋`
 * sits ON the connector BETWEEN two cards, and the drawn edge slants when they differ,
 * so it takes the midpoint — which keeps it on the line rather than merely near it,
 * preserving sketch 138-A's finding under nudge.
 *
 * Reads the live overlay first so the affordances track the card DURING a drag, not
 * only after it lands.
 */
export function verticalOffsetFor(
  slug: string | undefined,
  nudges: Record<string, number> | undefined,
  overlay: Record<string, XYPosition>,
  laneY: number,
): number {
  if (slug === undefined) return 0
  const live = overlay[slug]
  if (live !== undefined) return live.y - laneY
  return nudges?.[slug] ?? 0
}

export function insertPointX(lanes: readonly number[], index: number): number {
  if (lanes.length === 0) return 0
  const half = EDIT_AFFORDANCE.GAP / 2
  if (index <= 0) return lanes[0] - half
  if (index >= lanes.length) return lanes[lanes.length - 1] + CANVAS_LAYOUT.NODE_WIDTH + half
  return (lanes[index - 1] + CANVAS_LAYOUT.NODE_WIDTH + lanes[index]) / 2
}
