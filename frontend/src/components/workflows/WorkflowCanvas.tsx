/**
 * Phase 183-06 Task 2 (CANVAS-01, D-183-05 / D-183-08 / D-183-11, sketch 134/137-D) —
 * WorkflowCanvas.
 *
 * THE SHELL. It mounts `canvasModel.toCanvas`'s projection inside `@xyflow/react`.
 *
 * ⚠ WHAT PLANS 184-10, 184-12 AND 184-13 CHANGED, stated first so this docblock cannot
 * drift (the D-ITEM-183-02 trap). Until 184-10 this file was the READ-ONLY shell and its
 * whole job beyond mounting the projection was to make read-only TRUE rather than
 * assumed. It now has TWO modes, and `editable` is the switch. `editable={false}` —
 * the default, and what every shipped read-only caller passes — renders exactly the
 * surface described below, unchanged, down to the empty state.
 *
 * `editable` flips FIVE things, and the count is written out because it used to be one,
 * then four, and a stale count here would be the lie this phase keeps catching:
 *   1. per-node `draggable`, on phase nodes only (184-10);
 *   2. the `＋` / `✕` plane layer and the step-type menu it opens (184-12);
 *   3. the structural-notice region — the delete message with its inline Undo, and
 *      R10a's refusal (184-12);
 *   4. the empty draft's named "Add your first step" invitation, in place of the
 *      read-only "No steps yet" state (184-12);
 *   5. the ONE bottom-edge region — the toolbar row and the problems-tray row — which
 *      additionally requires the caller to supply a `session` (184-13, see R12 below).
 * Everything in the read-only opt-out block stays off in BOTH modes.
 *
 * ── D-184-12 — DELETE IS IMMEDIATE, AND THE REFUSAL IS NOT A CONFIRM ──────────────
 *
 * The `✕` does not open a modal. It asks the page, the page asks
 * `definitionOps.canRemovePhase`, and the answer is one of two DIFFERENT acts: the
 * step goes and the message says what moved with an inline Undo behind it, or the edit
 * is declined with the reason stated and no way to proceed. A modal on the most-used
 * destructive act on this surface would cost every author a click on every delete to
 * protect the rare one, and the sketch build rule is that the gate must never become
 * the thing that stops someone building. Undo is the safety net that makes that
 * affordable, so it is on the message rather than one keystroke away.
 *
 * NEITHER REFUSAL CONSULTS THE SERVER, and that is a boundary rather than an
 * optimisation. Both are decidable from the phases already in hand — a shape rule. A
 * verdict is a server judgement (VALID-03), and the two must stay separately sourced or
 * the client grows a second opinion about validity. This file names the validation seam
 * nowhere and its suite greps for that.
 *
 * ── D-184-10 — ONE FREE DRAG, THE AXES CARRY TWO DIFFERENT MEANINGS ───────────────
 *
 * On drop, `definitionOps.resolveDrop` reads the gesture twice. The X component
 * resolves to a lane slot and is a REAL DEFINITION EDIT — undoable, validated, marks
 * the draft dirty — and the card then snaps to its computed lane x because positions
 * re-derive from the projection. The Y component is kept verbatim as the cosmetic,
 * browser-local `dy`: no history entry, no network call, never serialized.
 *
 * THERE IS NO MODIFIER TO LEARN, AND THE SEPARATION IS STRUCTURAL. Which op runs is
 * decided by WHICH COMPONENT CHANGED, not by a flag a caller could misconfigure:
 * `resolveDrop` computes `reorderTo` from the x inputs alone and returns `null` for a
 * drag that never crossed half a pitch, so the definition branch of `onNodeDragStop`
 * is unreachable for a purely vertical drag. A conditional could be got wrong; an
 * argument that is never supplied cannot be.
 *
 * ── D-184-09 — TWO GESTURE PATHS, ONE OP BEHIND BOTH ─────────────────────────────
 *
 * The pointer drags along the lane; the keyboard presses `⌥←` / `⌥→` on the selected
 * node. Both build the reordered node array and call the SAME `onCommitNodes`, which
 * the page routes into `builderStore.commitCanvasNodes` → `reorderPhase`. The
 * keyboard path is not a grudging fallback: 183 made every node keyboard-activatable
 * and shipped a real screen-reader pass, so a drag-only reorder would REGRESS a
 * shipped promise, and at the five-step maximum it is genuinely competitive. Alt is
 * required so the binding cannot collide with the library's own arrow-key node
 * navigation or with field navigation in the panel one toggle away.
 *
 * VERDICT MARKS ARRIVE AS DATA, AND THIS FILE STILL FETCHES NOTHING (VALID-03). The
 * `marks` lookup is a PROP, supplied by the page from `verdictModel.markFor`, and its
 * result is merged onto the node's data copy exactly as the ⌥ reveal already is
 * (D-183-08). `PhaseNode` therefore stays a context-free leaf and a second source of
 * truth for a verdict is structurally impossible. This file's own suite forbids the
 * string that names the server validation seam, which is what keeps that boundary
 * honest rather than merely intended.
 *
 * THE COSMETIC `dy` IS READ AND WRITTEN THROUGH PROPS, NOT THROUGH STORAGE. Browser
 * storage for the nudge lives in `canvasNudge.ts` and nowhere else — this file names
 * no storage API at all, and its suite asserts that.
 *
 * READ-ONLY IS OPT-OUT, NOT OPT-IN. Every interaction flag the library ships
 * defaults to `true`: `nodesDraggable`, `nodesConnectable`, `edgesReconnectable`,
 * `connectOnClick`, `edgesFocusable`, and a `deleteKeyCode` of Backspace. Each one
 * is turned OFF explicitly below. `elementsSelectable`, `nodesFocusable` and
 * `panOnDrag` deliberately stay at their `true` defaults — selection is the whole
 * point (D-183-05), `nodesFocusable={false}` would strip the node's tab index AND
 * its role and kill keyboard reachability, and sketch 134-C's cursor contract is
 * that the PLANE pans while the nodes do not move.
 *
 * REACHABILITY IS NOT OPERABILITY, AND THE GAP WAS A BROKEN PROMISE. Keeping
 * `nodesFocusable` at its default gives every node a tab stop and a button role, but
 * for one shipped revision pressing that button did nothing: the surface's ONLY
 * affordance was mouse-only, which is WCAG 2.1.1 on the one thing this canvas does.
 * `activateFromKeyboard` below closes it — Enter and Space run the SAME
 * `onSelectNode(slug)` contract a click runs (D-183-05), guarded by the SAME
 * `CANVAS_NODE_TYPES.phase` check, so there is one selection rule with two input
 * devices rather than two rules that can drift. It reads the memoized projection to
 * filter and calls nothing else: no write, no fetch, no node mutation.
 *
 * THE ANNOUNCED AFFORDANCE MUST BE TRUE. React Flow's default node description
 * promises two things this surface does not do — that the arrow keys move a node and
 * that delete removes it — and a screen reader hears it on every node. `ARIA_LABELS`
 * overrides it with what actually happens. BOTH description keys are overridden
 * because the library picks between them off its keyboard-a11y opt-out flag, whose
 * `false` default — the one this canvas keeps — renders the counter-intuitively named
 * `keyboardDisabled` key rather than the `default` one.
 *
 * …AND IT MUST STAY TRUE IN BOTH MODES (184-10). An editable canvas DOES move a node
 * from the keyboard, so a single table would have to either omit the binding a screen
 * reader user needs or promise it on a surface that does not have it. There are
 * therefore two tables, chosen by `editable`. The read-only one is byte-unchanged, so
 * the shipped WR-06 assertion still measures exactly what it was written to measure —
 * which is why 184-10 edited NO pinned assertion here.
 *
 * SUPPRESSING THE INTERACTIVITY LOCK ON `<Controls>` IS NOT POLISH. The cluster
 * defaults that prop to true and renders an interactivity padlock whose handler
 * sets `nodesDraggable`, `nodesConnectable` and `elementsSelectable` all to
 * `!isInteractive`. With this file's prop set that is two clicks from a shipped
 * read-only canvas to a draggable, connectable one: the first click kills
 * selection, the second turns dragging and connecting back ON. The DOM assertion in
 * `WorkflowCanvas.test.tsx` (`.react-flow__controls-interactive` must not exist) is
 * the tripwire.
 *
 * D-183-08 — ONE ⌥ TECHNICAL-NAMES STATE, THE APP-WIDE ONE. The reveal is read from
 * the shipped `TechnicalNamesProvider`, which is already mounted at `App.tsx`
 * wrapping the layout that renders the workflows view, so the Builder is already
 * inside it. A canvas-local reveal state would reintroduce the exact "two toggles
 * disagree" failure that provider's own docblock says it exists to prevent, and the
 * vertical spine one toggle away already reads the SAME state with the SAME
 * fallback ordering. The control is rendered only when the context is present, so
 * no dead control ships; a provider-less render (unit tests, isolated renders)
 * falls back to plain language, shows no control, and does not crash.
 *
 * D-183-11 — THE EMPTY STATE RETURNS EARLY, ABOVE THE CANVAS. 40 of 95 live
 * definitions have zero phases, making the empty projection the single most common
 * canvas state. Suppression is STRUCTURAL rather than five separate `false` props:
 * no plane, no dot grid, no zoom controls, no minimap, and no ghost or placeholder
 * first node (a ghost node on a read-only canvas implies an affordance that does not
 * exist). It also sidesteps the "parent container needs a width and a height"
 * warning path, and it makes the D-183-11 assertion the same one-liner as the
 * D-183-03 flag-off assertion: no `.react-flow` element in the container.
 *
 * SELECTION IS APPLIED IN THE VIEW, NEVER IN THE MODEL (T-183-04). The memoized
 * projection is mapped to a COPY carrying `selected` and the ⌥ boolean — and, since
 * 184-10, the cosmetic `dy`, the per-node `draggable` flag and the server verdict
 * mark. Nothing is ever written back onto `phases` or onto any definition object, so
 * no layout key can leak into `workflow_definitions.definition`. That is why the
 * nudge is safe to merge here and would not be safe anywhere else.
 *
 * SCOPE FENCES, all machine-checked by the source guard in this file's suite: this
 * canvas calls no validation endpoint and no other endpoint (the verdict arrives as a
 * PROP, already derived by the server), imports no undo/redo or auto-layout library,
 * reads and writes no authored grounding field, adds no run state and no run colour,
 * and persists no view preference of its own. Those are Phases 185, 186 and 188. What
 * 184 added on this surface is listed at the top of this docblock.
 *
 * MOTION KEYS OFF RUN STATE, NEVER OFF SELECTION — and 184 has no run state, so
 * neither the selected node nor the dragged one is the thing that animates.
 *
 * XSS (T-124-01): every authored string (phase names) is rendered as a plain React
 * text child / `title=` attribute value — never `dangerouslySetInnerHTML`.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react"
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ViewportPortal,
  useStore as useFlowStore,
  type DefaultEdgeOptions,
  type NodeChange,
  type OnNodeDrag,
  type XYPosition,
} from "@xyflow/react"

import { TechnicalNamesToggle } from "@/components/admin/TechnicalNamesToggle"
import {
  CANVAS_EDGE_KINDS,
  CANVAS_LAYOUT,
  CANVAS_NODE_TYPES,
  toCanvas,
  type CanvasEdge,
  type CanvasNode,
} from "@/components/workflows/canvasModel"
import { CanvasToolbar, type ToolbarSaveState } from "@/components/workflows/CanvasToolbar"
import { resolveDrop, type PhaseTypeId } from "@/components/workflows/definitionOps"
import type { VerdictMarkKind } from "@/components/workflows/nodePresentation"
import { EndCapNode, PhaseNode, UnresolvedSkipNode } from "@/components/workflows/PhaseNode"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
import { ProblemsTray } from "@/components/workflows/ProblemsTray"
import { StepTypePicker } from "@/components/workflows/StepTypePicker"
import type { VerdictGroups } from "@/components/workflows/verdictModel"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"
// Type-only: the live loop owns the degraded-cause union and this file declares no
// second spelling of it, so a rename there is a typecheck error here rather than a
// branch that quietly stops matching. Erased at build — no runtime edge to the hook.
import type { DegradedValidationCause } from "@/hooks/useLiveValidation"

/**
 * MODULE SCOPE, never inside the component (Pattern 4). Declared in the render body
 * this object is new on every parent render, which makes React Flow warn ("It looks
 * like you have created a new nodeTypes object") and re-render every node. The keys
 * are exactly `CANVAS_NODE_TYPES`.
 */
const nodeTypes = {
  [CANVAS_NODE_TYPES.phase]: PhaseNode,
  [CANVAS_NODE_TYPES.unresolvedSkip]: UnresolvedSkipNode,
  [CANVAS_NODE_TYPES.endCap]: EndCapNode,
}

/**
 * MODULE SCOPE for the same Pattern-4 reason as `nodeTypes`. The two description
 * keys are the library's own; both are mapped to one honest sentence, because the
 * key this canvas actually renders depends on a flag whose naming is inverted (see
 * the docblock). Static string literals — no definition data is interpolated, so no
 * authored string can reach an announcement.
 */
const ARIA_LABELS = {
  "node.a11yDescription.default": "Press enter or space to open this step's details.",
  "node.a11yDescription.keyboardDisabled": "Press enter or space to open this step's details.",
}

/**
 * The SAME override for the editing mode (184-10 / D-184-09), and the reason there are
 * two tables rather than one edited one.
 *
 * The table above is a promise, and on the read-only surface it is complete: enter or
 * space opens the details and nothing else happens. On the editable surface that
 * sentence alone would be TRUE BUT INCOMPLETE — the node really does move under
 * `⌥←` / `⌥→`, and a screen-reader user who is never told the binding cannot reach the
 * only structural affordance this canvas has. Widening the one table instead would have
 * announced a movement affordance on a surface that provably does not have it, which is
 * the WR-06 defect in reverse.
 *
 * Alt is named in WORDS ("hold alt"), not as a glyph, because a screen reader reads this
 * aloud. Both description keys are overridden for the same inverted-flag reason as above.
 */
const ARIA_LABELS_EDITABLE = {
  "node.a11yDescription.default":
    "Press enter or space to open this step's details. Hold alt and press the left or right arrow key to move this step one position.",
  "node.a11yDescription.keyboardDisabled":
    "Press enter or space to open this step's details. Hold alt and press the left or right arrow key to move this step one position.",
  /**
   * SILENCED, and the silence is the point.
   *
   * The library's default here is `Moved selected node ${direction}. New position,
   * x: ${x}, y: ${y}` and it renders into the library's own **assertive** live region
   * (`#react-flow__aria-live-1`). This canvas already announces the move itself, in the
   * only vocabulary that means anything here — "Step moved to position 2 of 5" — from a
   * POLITE `sr-only` region. Leaving both in place made a screen reader hear the two
   * back to back, with the assertive one interrupting and therefore WINNING.
   *
   * Raw x/y is not merely redundant on this surface, it is misleading: x snaps to a
   * computed lane slot and y is the browser-local `dy` nudge that is never serialized
   * (D-184-10), so neither coordinate is a fact the author can act on. Reporting them as
   * "the new position" describes a position the definition does not have.
   *
   * Returns a constant empty string — it interpolates nothing, so the module keeps the
   * property its siblings above are documented for: no authored string can reach an
   * announcement. Found by live screen-reader-region inspection during phase-184
   * verification; a jsdom test sees both regions but cannot model which one a screen
   * reader speaks.
   */
  "node.a11yDescription.ariaLiveMessage": () => "",
}

/**
 * The arrow marker every edge wears. Edge CLASSIFICATION rides on `data.kind`, not
 * on `edge.type` — setting `edge.type` would make the library look up an
 * `edgeTypes` entry named `flow` and fall back with a warning, since 183 registers
 * none. Per-kind styling is applied below, off that same `data.kind`.
 */
const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
    color: "hsl(var(--border))",
  },
}

/** Solid for run order and for the terminal cap; dashed for a conditional branch. */
const EDGE_STYLE: Record<string, CSSProperties> = {
  [CANVAS_EDGE_KINDS.flow]: { stroke: "hsl(var(--border))", strokeWidth: 2 },
  [CANVAS_EDGE_KINDS.end]: { stroke: "hsl(var(--border))", strokeWidth: 2 },
  [CANVAS_EDGE_KINDS.skip]: {
    stroke: "hsl(38 92% 60% / 0.8)",
    strokeWidth: 2,
    strokeDasharray: "5 4",
  },
}

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
 */
const EDIT_AFFORDANCE = {
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
const REVEAL_ON_HOVER =
  "pointer-events-auto opacity-100 lg:opacity-0 lg:group-hover/canvas:opacity-100 lg:focus-visible:opacity-100 [@media(hover:none)]:opacity-100"

/**
 * WHAT THE SURFACE SAYS AFTER A STRUCTURAL EDIT — and the two acts are DIFFERENT acts,
 * so they are different members of a union rather than one string with a flag.
 *
 * `action` is something that HAPPENED: the step is gone (or the new one is in), and the
 * message names it, says how many steps were renumbered, and carries the inline Undo
 * that makes an immediate delete safe without a modal (D-184-12).
 *
 * `refusal` is something that DID NOT happen and will not: R10a's orphaning delete. It
 * offers no way to proceed, because it is not a confirm — a confirm asks, a refusal
 * states. Both render in the same region and both are announced, but they must never
 * read alike, so they carry different testids and different roles.
 *
 * The sentence is authored by the CALLER, from `definitionOps`' own predicates. This
 * component composes no reason of its own and asks no server for one.
 */
export type CanvasNotice =
  | { kind: "action"; lead: string; subject: string; detail: string; onUndo?: () => void }
  | { kind: "refusal"; text: string }

/**
 * 184-13 / R12 — EVERYTHING THE ONE BOTTOM REGION NEEDS, as a single optional prop.
 *
 * It is one object rather than nine loose props for a structural reason, not a tidiness
 * one: the region is *"one region, TWO rows maximum"*, and both rows are always present
 * together or not at all. A shape where each row appeared independently could render a
 * region with one row, or three, and R12 would then be a thing tests check rather than a
 * thing the type system makes true.
 *
 * ABSENT is the shipped read-only/unit-test surface. `WorkflowCanvas.test.tsx` (31) and
 * `WorkflowCanvas.editing.test.tsx` (49) render this component with no
 * `BuilderStoreProvider` above it, and `CanvasToolbar` legitimately THROWS outside one —
 * so the region must be genuinely absent there rather than half-rendered. The page is the
 * one caller that supplies it, and the page is the one place a store exists.
 *
 * EVERY FIELD IS THE CALLER'S ANSWER, NEVER THIS FILE'S OPINION. The verdict groups are
 * the server's, grouped by the pure module; `degraded` and `checking` are the live loop's;
 * the save reading is the page's persistence state. This canvas still derives no severity
 * and opens no request.
 */
export interface CanvasSession {
  /** What the toolbar may say about the save right now (R6). */
  saveState: ToolbarSaveState
  /** The caller's failure sentence for `saveState: "error"`, or null. */
  saveErrorMessage?: string | null
  /** The explicit save. There is no autosave in this phase. */
  onSaveDraft: () => void
  /** Clear this draft's cosmetic nudges — the current workflow's key ONLY. */
  onTidyUp: () => void
  /** The server's findings, grouped by `verdictModel`. Nothing is classified here. */
  groups: VerdictGroups
  /** Why the last check produced no verdict, or null when it answered. */
  degraded: DegradedValidationCause | null
  /** A check is in flight: the tray dims its rows, it never clears them. */
  checking: boolean
  /** The tray's disclosure state — owned by the CALLER, which is what makes
   *  "it never auto-opens on a new error" true by construction (184-08). */
  trayOpen: boolean
  onToggleTray: () => void
  /** A tray row was activated: take the author to that step. */
  onJumpToStep: (slug: string) => void
}

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
function verticalOffsetFor(
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

function insertPointX(lanes: readonly number[], index: number): number {
  if (lanes.length === 0) return 0
  const half = EDIT_AFFORDANCE.GAP / 2
  if (index <= 0) return lanes[0] - half
  if (index >= lanes.length) return lanes[lanes.length - 1] + CANVAS_LAYOUT.NODE_WIDTH + half
  return (lanes[index - 1] + CANVAS_LAYOUT.NODE_WIDTH + lanes[index]) / 2
}

interface PlaneEditingLayerProps {
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
 * Under 137-B (`themes/canvas-184.css` `body.card-b`) the card's TOP edge belongs to
 * the floating icon and its RIGHT edge carries the verdict mark (184-08), so the `✕`
 * sits on the BOTTOM edge — `body.card-b .acts { bottom: -12px }`, i.e. straddling the
 * card's lower border. The card's height is READ from the library's measurement rather
 * than assumed, because a card grows downward from `NODE_MIN_HEIGHT` and a fixed offset
 * would drift up into the body of a two-line title.
 *
 * IT AUTHORS NO REFUSAL AND CONSULTS NO SERVER. Every disabled row and every reason in
 * the menu comes from `definitionOps.allowedTypesAt` by way of `StepTypePicker`; the
 * removal predicate is the caller's `canRemovePhase`. A refusal is a SHAPE rule decided
 * from the phases already in hand, a verdict is a server judgement, and this file names
 * the validation seam nowhere (its suite greps for that).
 */
function PlaneEditingLayer({
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

/**
 * `phases` / `selectedSlug` / `onSelectNode` are shared VERBATIM with
 * `PhaseSpineGraphProps` (`PhaseSpineGraph.tsx:55-61`), so the D-183-05 selection
 * contract is genuinely one rule for both views and the page keeps owning the
 * toggle-off-on-reclick semantics.
 *
 * `onClearSelection` is the ONE divergence, and it exists only here: React Flow
 * exposes a distinct pane element, so "the user clicked empty space" is unambiguous
 * and free. The Spine has no pane — a correct click-outside there would have to
 * positively EXCLUDE every interactive child of its scroll list plus the page
 * header's Save/Publish controls, which is ref + containment logic landing in a
 * hot-file the next authoring phase is about to reopen. Deferred on cost and blast
 * radius, NOT because it is impossible. The Spine's dismissal paths are therefore the
 * shared header ✕ and Escape, both of which work identically in both views.
 */
export interface WorkflowCanvasProps {
  phases: PhaseSpecJSON[]
  /** The currently-selected phase slug (the open form anchor), or null at rest. */
  selectedSlug: string | null
  /**
   * Selection, and ONLY selection. Fires the clicked (or activated) slug.
   *
   * ⚠ 184-10 rewrote this line rather than leaving it. Until this plan it denied, in
   * capitals, that this surface could re-order or move a node at all — a claim about the
   * whole SURFACE, which became false the moment the canvas learned to do both. (The
   * superseded wording is described here rather than quoted, so the acceptance grep that
   * proves it is gone can return zero without this paragraph having to omit its own
   * subject — the same self-match trap this phase has now hit half a dozen times.) What
   * is still true, and is the part worth promising, is narrower and about this
   * CALLBACK: reordering travels on
   * `onCommitNodes` and the cosmetic offset on `onNudge`, never on this one — so a page
   * that wires only selection cannot be surprised by a structural edit arriving through
   * it.
   */
  onSelectNode: (slug: string) => void
  /** Release the selection (a click on empty space). REQUIRED — the deselect half of
   *  the same contract; a canvas that can only select is a panel with no way out. */
  onClearSelection: () => void

  // ── 184-10, the editing half. Every one of these is OPTIONAL and every one is
  //    inert while `editable` is false, so the shipped read-only callers compile and
  //    render exactly as they did before this plan. ──

  /**
   * The editing switch. `false` (the default) renders the pre-184 read-only canvas
   * exactly: no per-node drag, no keyboard reorder, no editing copy in the header, no
   * `＋` / `✕` layer, no notice region, no bottom-edge region (even when a `session` is
   * supplied), and the shipped "No steps yet" empty state. The page passes the canvas
   * feature flag, so a flag-off surface is byte-identical.
   *
   * It is OPTIONAL rather than required on purpose: the shipped page and the shipped
   * 31-assertion suite both render this component without it, and making it required
   * would have forced an edit to both to land a prop that defaults to "behave as before".
   */
  editable?: boolean
  /**
   * The server-derived verdict mark for one node, or `undefined` when the server said
   * nothing about it. Supplied by the page from `verdictModel.markFor` — **this canvas
   * derives no severity and asks no server for one**; its own suite forbids the string
   * that names the validation seam, which is what keeps that boundary structural.
   */
  marks?: (slug: string) => VerdictMarkKind | undefined
  /**
   * slug → the cosmetic vertical offset, in canvas pixels. Read from `canvasNudge.ts`
   * by the PAGE and handed down; browser storage never appears in this file, so the
   * `dy` has exactly one home and cannot acquire a second.
   */
  nudges?: Record<string, number>
  /**
   * A drag's y-component landed. `dy` is the RESULTING offset for that slug (the
   * previous offset plus this drag's vertical delta), so the handler is a plain write
   * rather than an accumulation the page has to get right. Cosmetic: no history entry,
   * no network call, never serialized into the definition.
   */
  onNudge?: (slug: string, dy: number) => void
  /**
   * A drag's x-component, or a `⌥←` / `⌥→` press, resolved to a new ORDER. The page
   * routes this into `builderStore.commitCanvasNodes`, which is the one op both gesture
   * paths end in (D-184-09). A real definition edit: undoable, validated, marks dirty.
   */
  onCommitNodes?: (nodes: readonly CanvasNode[]) => void

  // ── 184-12, the grow-the-flow half. Optional and inert while `editable` is false,
  //    for the same reason the 184-10 block above is. ──

  /**
   * A `＋` on the line was activated and a type was chosen there. `index` is
   * `insertPhaseAt`'s render position, so `0` prepends and `phases.length` appends.
   *
   * The page routes this into `builderStore.insertPhaseOfTypeAt`, which derives the
   * slug (`slugForType`), builds the phase (`minimalPhaseFor`) and renumbers — so
   * `phase_index` is contiguous `[0..n-1]` the instant the handler returns, and the
   * insert is never cosmetic. **This canvas creates no phase and invents no slug.**
   */
  onInsertAt?: (index: number, type: PhaseTypeId) => void
  /**
   * The `✕` on a card's bottom edge was activated. A REQUEST, not a command: the page
   * asks `definitionOps.canRemovePhase` first, and R10a's orphaning case comes back as
   * a refusal rather than a deletion. Everything this canvas knows is that the user
   * pressed the control.
   */
  onRequestRemove?: (slug: string) => void
  /**
   * What to say about the last structural act — or the reason the last one did not
   * happen. Supplied by the page, which is where both predicates live; rendered here,
   * where the act took place. `null` at rest.
   */
  notice?: CanvasNotice | null

  // ── 184-13, the session half. Optional and inert while `editable` is false. ──

  /**
   * The ONE bottom-edge region's contents — the toolbar row and the problems-tray row.
   * Absent (the shipped read-only callers and both existing canvas suites) means no
   * region at all. See `CanvasSession`.
   */
  session?: CanvasSession
}

export function WorkflowCanvas({
  phases,
  selectedSlug,
  onSelectNode,
  onClearSelection,
  editable = false,
  marks,
  nudges,
  onNudge,
  onCommitNodes,
  onInsertAt,
  onRequestRemove,
  notice,
  session,
}: WorkflowCanvasProps) {
  // The app-wide reveal, READ (never owned) here. Null outside a provider.
  const technicalNames = useTechnicalNamesOptional()
  const showTechnical = technicalNames?.showTechnical ?? false

  const projection = useMemo(() => toCanvas(phases), [phases])

  /**
   * The IN-FLIGHT drag position, per node id — pure view state that exists for exactly
   * as long as a finger is down.
   *
   * It is REQUIRED, not an optimisation. With the controlled `nodes` prop the library's
   * `hasDefaultNodes` is false, so it computes position changes and then DISCARDS them:
   * without applying them here a drag would not move the card at all. On drop the entry
   * is cleared and the position re-derives from the projection, which is what makes the
   * card "snap to its computed lane x" fall out of the data flow rather than out of an
   * animation.
   */
  const [dragOverlay, setDragOverlay] = useState<Record<string, XYPosition>>({})

  /**
   * The library's own measurement, echoed back so it survives our node rebuilds.
   * See `handleNodesChange` for why dropping it makes a dragged card blink.
   */
  const [measuredById, setMeasuredById] = useState<
    Record<string, { width: number; height: number }>
  >({})

  /** Where the dragged card started. Captured on drag start; the axis split is read
   *  against it, never against the lane it happens to be nearest. */
  const dragOriginRef = useRef<XYPosition | null>(null)

  // A COPY. Selection, the ⌥ boolean, the cosmetic `dy`, the per-node drag flag and the
  // server verdict mark are all view state; the model output and the definition behind
  // it are never touched, which is why no layout key can reach the payload.
  /**
   * The settled node array — everything EXCEPT the in-flight drag position.
   *
   * Split from the overlay deliberately. `handleNodesChange` fires `setDragOverlay` on
   * every pointer frame; when the overlay was a dependency of the ONE memo, a drag
   * rebuilt every node object AND a fresh `data` object for each, so React Flow
   * re-rendered all of them ~60×/s and the cards visibly flickered. Now a drag frame
   * only invalidates the memo below, and only the dragged node gets a new identity —
   * every other card keeps its reference and does not re-render at all.
   */
  const settledNodes = useMemo<CanvasNode[]>(
    () =>
      projection.nodes.map((node) => {
        if (node.type !== CANVAS_NODE_TYPES.phase) return node

        // The cosmetic offset is merged into a COPY of the position. A zero offset
        // reuses the model's own object, so an idle canvas hands the library a stable
        // reference and does not re-measure on every parent render.
        const dy = nudges?.[node.id] ?? 0
        const position = dy === 0 ? node.position : { x: node.position.x, y: node.position.y + dy }

        const measured = measuredById[node.id]

        return {
          ...node,
          position,
          // Carried so `adoptUserNodes`'s else-branch finds a measurement on the object
          // we hand it. Without this every rebuilt node is briefly `hidden`.
          ...(measured === undefined ? {} : { measured }),
          // THE ONE READ-ONLY OPT-OUT THAT FLIPS, and it flips PER NODE: the end cap and
          // the broken-reference stub keep the `false` the model gave them.
          draggable: editable,
          selected: node.id === selectedSlug,
          // The verdict is threaded exactly as the ⌥ reveal is (D-183-08 / D-184-06), so
          // `PhaseNode` stays a context-free leaf and cannot grow a second source of
          // truth for a value only the server owns.
          data: { ...node.data, technical: showTechnical, verdict: marks?.(node.id) },
        }
      }),
    [projection.nodes, selectedSlug, showTechnical, editable, marks, nudges, measuredById],
  )

  /**
   * The drag overlay applied on top — the ONLY thing a pointer frame invalidates.
   *
   * Returns `settledNodes` by reference when nothing is being dragged, so an idle
   * canvas is byte-identical to the memo above and costs nothing.
   */
  const nodes = useMemo<CanvasNode[]>(() => {
    let touched = false
    const next = settledNodes.map((node) => {
      const overlay = dragOverlay[node.id]
      if (overlay === undefined) return node
      touched = true
      return { ...node, position: overlay }
    })
    return touched ? next : settledNodes
  }, [settledNodes, dragOverlay])

  /**
   * The lane centres, in render order — the x-coordinate of every phase column, read
   * off the projection rather than recomputed from `CANVAS_LAYOUT`. `resolveDrop` reads
   * the pitch out of this array, which is how a pure module with no canvas import still
   * agrees with the drawn layout exactly.
   */
  const lanes = useMemo(
    () =>
      projection.nodes
        .filter((node) => node.type === CANVAS_NODE_TYPES.phase)
        .map((node) => node.position.x),
    [projection.nodes],
  )

  /** The phase slugs in render order — the keyboard path's index space, and the same
   *  order the lanes above are drawn in, read from the one projection so the two
   *  cannot disagree about which step is third. */
  const phaseOrder = useMemo(
    () =>
      projection.nodes
        .filter((node) => node.type === CANVAS_NODE_TYPES.phase)
        .map((node) => node.id),
    [projection.nodes],
  )

  /**
   * WHICH insertion boundary the step-type menu is open at, or `null` for closed.
   *
   * It lives on the component rather than inside the plane layer because the EMPTY
   * draft has no plane at all (D-183-11 returns early, above the canvas) and still
   * needs the same menu at index 0. One state, one menu, two places it can be drawn —
   * rather than two states that could both be open at once.
   */
  const [pickerAt, setPickerAt] = useState<number | null>(null)

  const dismissPicker = useCallback(() => setPickerAt(null), [])

  /** Choosing a type closes the menu and hands the decision up. The canvas performs
   *  no insert of its own — `onInsertAt`'s owner does, through the one store op. */
  const chooseType = useCallback(
    (index: number, type: PhaseTypeId) => {
      setPickerAt(null)
      onInsertAt?.(index, type)
    },
    [onInsertAt],
  )

  /**
   * Build the node array for a reorder: the phase node carrying `slug` moved to render
   * position `toIndex`, the non-phase nodes carried along untouched.
   *
   * Splice-out-then-insert, in that order — the same shape `definitionOps.movePhase`
   * uses — so the index the canvas means and the index the op applies cannot disagree.
   * BOTH gesture paths call this; there is one array-building rule, not two.
   */
  const nodesWithMove = useCallback(
    (slug: string, toIndex: number): CanvasNode[] => {
      const phaseNodes = nodes.filter((node) => node.type === CANVAS_NODE_TYPES.phase)
      const moved = phaseNodes.find((node) => node.id === slug)
      if (moved === undefined) return nodes

      const without = phaseNodes.filter((node) => node.id !== slug)
      const at = Math.max(0, Math.min(toIndex, without.length))
      return [
        ...without.slice(0, at),
        moved,
        ...without.slice(at),
        ...nodes.filter((node) => node.type !== CANVAS_NODE_TYPES.phase),
      ]
    },
    [nodes],
  )

  const edges = useMemo<CanvasEdge[]>(
    () =>
      projection.edges.map((edge) => ({
        ...edge,
        style: EDGE_STYLE[edge.data?.kind ?? CANVAS_EDGE_KINDS.flow],
      })),
    [projection.edges],
  )

  /**
   * REQUIRED with a controlled `nodes` prop — see `dragOverlay`. Only `position`
   * changes are applied.
   *
   * `select` belongs to the page's `selectedSlug`, and `remove` / `add` / `replace`
   * belong to `definitionOps`. Applying those here would put a second, silent editing
   * path beside the one this plan is chartered to build.
   *
   * ⚠ `dimensions` IS echoed, and the comment that used to say it needed no echo was
   * true only for the READ-ONLY canvas 183 shipped. Read `adoptUserNodes` in
   * `@xyflow/system`:
   *
   *     if (checkEquality && userNode === internalNode?.internals.userNode) {
   *       nodeLookup.set(userNode.id, internalNode)        // same ref -> keeps measured
   *     } else {
   *       internalNode = { ...userNode, measured: { width: userNode.measured?.width, … } }
   *     }
   *     if ((measured.width === undefined || measured.height === undefined) && !hidden) {
   *       nodesInitialized = false                          // -> the node renders HIDDEN
   *     }
   *
   * 183 always handed back the SAME node objects, so the equality branch hit and the
   * measurement survived. 184 hands back a NEW object for the dragged node on every
   * pointer frame, so the else-branch runs, `measured` is read from OUR object — which
   * carried none — and the node is hidden until it is measured again. At ~60fps that is
   * a card blinking out and back, which is exactly what the operator reported and what
   * memoizing the card could not fix: the flicker is on the library's WRAPPER, not in
   * our subtree.
   *
   * So the measurement is stored and threaded back on. It changes on mount and on
   * resize, never per frame, so this costs one render per node per lifetime.
   */
  const handleNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    setDragOverlay((previous) => {
      let next = previous
      for (const change of changes) {
        if (change.type !== "position" || change.position === undefined) continue
        if (next === previous) next = { ...previous }
        next[change.id] = change.position
      }
      return next
    })

    setMeasuredById((previous) => {
      let next = previous
      for (const change of changes) {
        if (change.type !== "dimensions" || change.dimensions === undefined) continue
        const seen = previous[change.id]
        if (
          seen !== undefined &&
          seen.width === change.dimensions.width &&
          seen.height === change.dimensions.height
        ) {
          continue
        }
        if (next === previous) next = { ...previous }
        next[change.id] = { width: change.dimensions.width, height: change.dimensions.height }
      }
      return next
    })
  }, [])

  /** The origin of the axis split. Captured here rather than derived on drop, because
   *  after the drop the only thing that knows where the card started is this ref. */
  const handleNodeDragStart = useCallback<OnNodeDrag<CanvasNode>>((_event, node) => {
    dragOriginRef.current = { ...node.position }
  }, [])

  /**
   * D-184-10, the whole decision, in one place.
   *
   * `resolveDrop` reads the gesture; this handler routes each axis to its own home and
   * never mixes them. The x branch is entered only when `reorderTo` is non-null, which
   * `resolveDrop` computes from the x inputs ALONE — so the definition edit is
   * unreachable for a purely vertical drag by construction, not by the condition below
   * being written correctly.
   */
  const handleNodeDragStop = useCallback<OnNodeDrag<CanvasNode>>(
    (_event, node) => {
      const origin = dragOriginRef.current
      dragOriginRef.current = null

      // Clear the in-flight overlay whatever happened, so the card's position goes back
      // to being a function of the projection plus the cosmetic offset.
      setDragOverlay((previous) => {
        if (previous[node.id] === undefined) return previous
        const next = { ...previous }
        delete next[node.id]
        return next
      })

      if (origin === null || node.type !== CANVAS_NODE_TYPES.phase) return

      const { reorderTo, dy } = resolveDrop(origin, node.position, lanes)

      // X — a definition edit. Undoable, validated, marks the draft dirty.
      if (reorderTo !== null) onCommitNodes?.(nodesWithMove(node.id, reorderTo))

      // Y — cosmetic, always, and independent of whether the card also moved lane. The
      // RESULTING offset is handed over rather than this drag's delta, so a second nudge
      // does not silently discard the first (the previous offset is already inside
      // `origin.y`, which is why the two are added rather than one replacing the other).
      if (dy !== 0) onNudge?.(node.id, (nudges?.[node.id] ?? 0) + dy)
    },
    [lanes, nudges, onCommitNodes, onNudge, nodesWithMove],
  )

  /**
   * D-184-09 — THE KEYBOARD REORDER, and the sentence a screen reader hears.
   *
   * WHY THERE IS A KEYBOARD PATH AT ALL. Phase 183 made every node keyboard-activatable
   * and shipped a real screen-reader pass; a drag-only reorder would have handed the
   * canvas's ONE structural affordance to the mouse and regressed that. At the five-step
   * maximum this is not a grudging fallback — it is arguably the faster path.
   *
   * `⌥` IS PART OF THE BINDING, NOT DECORATION. Bare arrow keys are the library's own
   * node-navigation binding and are also how a person moves through the fields of the
   * panel one toggle away. An unmodified ArrowRight therefore has to keep doing what it
   * already does, or this plan would break two shipped behaviours to add one.
   *
   * THE LISTENER IS GATED, so it costs nothing at rest: none exists unless the canvas is
   * editable AND a node is selected. It cannot accumulate across renders either — the
   * effect removes exactly the handler it added.
   *
   * ONE PRESS IS ONE MOVE. The same auto-repeat guard as `activateFromKeyboard`, for a
   * sharper reason: a held key would walk a card across the whole spine at ~31 moves a
   * second and push one undo entry per move.
   *
   * IT ENDS IN THE SAME OP AS THE DRAG. `nodesWithMove` + `onCommitNodes` — there is one
   * reorder rule with two input devices, which is the whole of D-184-09.
   */
  const [announcement, setAnnouncement] = useState("")

  useEffect(() => {
    if (!editable || selectedSlug === null) return

    const handler = (event: globalThis.KeyboardEvent) => {
      if (!event.altKey) return
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      if (event.repeat) return

      // Native field editing is untouched: a person typing into a text box owns their
      // own arrow keys, alt or no alt.
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable === true) return

      const from = phaseOrder.indexOf(selectedSlug)
      if (from === -1) return

      const to = from + (event.key === "ArrowLeft" ? -1 : 1)
      // At either end there is nowhere to go. Nothing is committed and nothing new is
      // said — a live region that repeats itself on a no-op teaches the user to ignore it.
      if (to < 0 || to >= phaseOrder.length) return

      event.preventDefault()
      onCommitNodes?.(nodesWithMove(selectedSlug, to))
      setAnnouncement(`Step moved to position ${to + 1} of ${phaseOrder.length}.`)
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [editable, selectedSlug, phaseOrder, nodesWithMove, onCommitNodes])

  /**
   * The keyboard half of D-183-05 — the rule IS shared with the mouse, and the
   * keyboard device additionally carries auto-repeat semantics the mouse does not,
   * which the guard below normalises so both devices deliver one activation per
   * intent. The library's own per-node key handler neither
   * stops propagation nor prevents the default on Enter/Space, so the event reaches
   * the plane wrapper; `.react-flow__node` carries `data-id`, which for a phase node
   * IS the slug. The id is checked against the memoized projection rather than
   * re-derived, so the end cap and the broken-reference stub — neither of which is a
   * phase — stay exactly as inert here as they are under the mouse.
   */
  const activateFromKeyboard = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return

      // ONE PRESS IS ONE ACTIVATION. `keydown` auto-repeats while a key is held
      // (Windows default ≈ 500 ms, then up to ~31 events/sec) and the consumer is a
      // TOGGLE, so an unguarded repeat turns one intentional press into ~15 open/close
      // flips whose terminal state is decided by the parity of the repeat count — the
      // panel can settle CLOSED on a press that promised to open it. The mouse path is
      // structurally immune (a held button produces one click), so this is the keyboard
      // device's own repeat semantics being normalised, not a shared-rule bug.
      if (event.repeat) return

      const wrapper = (event.target as HTMLElement).closest<HTMLElement>(".react-flow__node")
      const id = wrapper?.dataset.id
      if (!id) return

      const isPhase = projection.nodes.some(
        (node) => node.id === id && node.type === CANVAS_NODE_TYPES.phase,
      )
      if (!isPhase) return

      // Space would otherwise scroll the pane (the library also reserves it as the
      // pan activation key), and selection is the whole intent of the press.
      event.preventDefault()
      onSelectNode(id)
    },
    [projection.nodes, onSelectNode],
  )

  // The header is shared by both branches. Read-only is told as a deliberate MODE in
  // the shipped `👁 View only` vocabulary, never invented a second time.
  //
  // ⚠ AND IT IS SWAPPED WHEN EDITING, because "the plane pans · steps stay put" is a
  // PROMISE TO THE USER, not decoration — leaving it up on a canvas whose steps now move
  // is the same defect as a docblock that lies, in the one place a person actually reads.
  // The editing line names both gesture paths, so the keyboard one is discoverable
  // without a tooltip.
  const header = (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2">
      {editable ? (
        <>
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
            ✎ Editing
          </span>
          <span className="text-[11px] text-muted-foreground">
            drag a step along the lane to reorder · or select one and press ⌥← / ⌥→
          </span>
        </>
      ) : (
        <>
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
            👁 View only
          </span>
          <span className="text-[11px] text-muted-foreground">
            the plane pans · steps stay put
          </span>
        </>
      )}
      <span className="flex-1" />
      {technicalNames ? (
        <TechnicalNamesToggle enabled={showTechnical} onToggle={technicalNames.toggle} />
      ) : null}
    </div>
  )

  /** The section's accessible name has to move with the mode for the same reason the
   *  badge does — it is the first thing a screen reader hears about this surface. */
  const sectionLabel = editable ? "Workflow canvas" : "Workflow canvas (read-only)"

  /**
   * The one region both structural messages render in — shared, so a person learns
   * where to look once, and EDITING-ONLY, because a read-only canvas can produce
   * neither act and reserved space for a message that cannot arrive is dead chrome.
   *
   * The two treatments are deliberately not interchangeable. The `action` line is a
   * `status` — something happened, here is the way back. The `refusal` is an `alert`
   * with no way forward at all, because R10a declines an edit rather than asking about
   * one, and a refusal that looks like a confirm invites a person to hunt for the
   * button that says "do it anyway". There isn't one.
   */
  const noticeRegion =
    editable && notice ? (
      notice.kind === "refusal" ? (
        <div
          data-testid="canvas-notice-refusal"
          role="alert"
          className="flex items-start gap-2 border-b border-border/60 bg-[hsl(38_92%_60%/0.08)] px-4 py-2 text-[12px] text-foreground"
        >
          <span aria-hidden="true" className="text-[hsl(38_92%_66%)]">
            ⚠
          </span>
          <span>{notice.text}</span>
        </div>
      ) : (
        <div
          data-testid="canvas-notice-action"
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-[12px] text-muted-foreground"
        >
          <span>
            {notice.lead} <strong className="font-medium text-foreground">{notice.subject}</strong>{" "}
            · {notice.detail}
          </span>
          {notice.onUndo ? (
            <button
              type="button"
              data-testid="canvas-notice-undo"
              onClick={notice.onUndo}
              className="rounded px-1.5 py-0.5 font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              Undo
            </button>
          ) : null}
        </div>
      )
    ) : null

  /**
   * R12 — ONE BOTTOM-EDGE REGION, TWO ROWS MAXIMUM. This is the whole rule.
   *
   * THE COMPOSITION RISK THIS RESOLVES. Sketch 141-B put the editing controls on the
   * canvas; sketch 139-A put the problems tray at the bottom. Built naively that is TWO
   * bottom bands stacked on each other, on a column that at 900px already has a 400px
   * panel beside 248px cards. The recorded fix is this: fold the tray's SUMMARY LINE into
   * the same bottom edge and let the tray expand upward from it. Publish stays in the page
   * header it already had (141-B's operator correction), so this plan adds no band at all.
   *
   * WHY THE REGION IS `flex-col-reverse`. Source order is [toolbar, tray] — row 1 and row
   * 2 as the plan numbers them — but the REVERSED main axis puts the toolbar at the very
   * bottom, where the hands are, with the tray's summary line directly above it and the
   * tray's list expanding upward from there. That is what makes "expands upward" and "does
   * not push the toolbar" both literally true: opening the tray grows the region upward
   * into the canvas and the toolbar does not move.
   *
   * TWO ROWS, ALWAYS, AND STRUCTURALLY. The region has exactly two direct children, open
   * or closed, because both rows come from ONE optional prop object (`session`) — there is
   * no state in which one row exists without the other, and none in which a third appears.
   *
   * IT DOES NOT AUTO-OPEN. `trayOpen` belongs to the caller (184-08), so a new `error`
   * arriving mid-build updates the summary line and nothing else. A tray that springs open
   * while a person is placing a step fights the person using it.
   */
  const bottomRegion =
    editable && session ? (
      <div
        data-testid="canvas-bottom-region"
        className="flex flex-col-reverse"
        aria-label="Canvas controls and problems"
      >
        <CanvasToolbar
          saveState={session.saveState}
          errorMessage={session.saveErrorMessage}
          onSave={session.onSaveDraft}
          onTidyUp={session.onTidyUp}
        />
        <ProblemsTray
          groups={session.groups}
          phases={phases}
          degraded={session.degraded}
          checking={session.checking}
          open={session.trayOpen}
          onToggle={session.onToggleTray}
          onJumpToStep={session.onJumpToStep}
        />
      </div>
    ) : null

  // D-183-11 — EARLY RETURN. Nothing below this line mounts on an empty definition.
  if (nodes.length === 0) {
    return (
      <section aria-label={sectionLabel} className="flex h-full min-w-0 flex-col bg-background">
        {header}
        {noticeRegion}
        {/*
          U-1 — THE EMPTY DRAFT IS A FIRST-CLASS SCREEN, NOT AN EDGE CASE. 40 of 95 live
          definitions have zero phases, so this is the single most common canvas state,
          and sketch 141's first question is whether the first move reads as an
          invitation or as a broken screen. An editable draft therefore opens with a
          NAMED invitation rather than a bare `＋`: the control says what pressing it
          will do. Read-only keeps the shipped state byte-for-byte — there is nothing to
          invite there, and a ghost affordance on a surface that cannot act is the
          D-183-11 rule in miniature.
        */}
        <div
          data-testid="canvas-empty"
          className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
        >
          {editable ? (
            <>
              <button
                type="button"
                data-testid="canvas-add-first-step"
                aria-haspopup="menu"
                aria-expanded={pickerAt !== null}
                onClick={() => setPickerAt(0)}
                className="rounded-[10px] border border-dashed border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <span aria-hidden="true" className="mr-1.5">
                  ＋
                </span>
                Add your first step
              </button>
              <p className="text-[12px] text-muted-foreground">
                Pick what it should do — you can change the details afterwards.
              </p>
              {pickerAt !== null ? (
                <div data-testid="canvas-empty-picker" className="mt-1">
                  <StepTypePicker
                    phases={phases}
                    index={0}
                    open
                    onChoose={(type) => chooseType(0, type)}
                    onDismiss={dismissPicker}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">No steps yet</p>
              <p className="text-[12px] text-muted-foreground">
                Add a step to this workflow and it will appear here.
              </p>
            </>
          )}
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label={sectionLabel}
      className="relative flex h-full min-w-0 flex-col bg-background"
    >
      {header}
      {/* The polite announcer, in the shipped `PhaseTimeline.tsx:172` shape: PRESENT at
          load (empty) so the assistive tech has already picked the region up, written
          only on a real move. Editing-only — a read-only canvas has nothing to announce
          and dead chrome is its own kind of lie. */}
      {editable ? (
        <div data-testid="canvas-announcer" role="status" aria-live="polite" className="sr-only">
          {announcement}
        </div>
      ) : null}
      {/* The parent MUST have a width and a height or the plane measures to zero.
          `group/canvas` is the hover root the edit affordances reveal from — see
          REVEAL_ON_HOVER. It is named rather than bare so a future nested `group`
          cannot capture it by accident. `relative` anchors the floated notice below. */}
      <div className="group/canvas relative h-full w-full min-w-0 flex-1">
        {/* FLOATED OVER THE PLANE, not stacked above it. The notice is TRANSIENT — it
            appears after a delete or an add and then goes — but as a layout band it spent
            its height permanently, on a surface where the chrome above the canvas already
            costs 275px of a 639px viewport and leaves the flow 45% of the screen. It is
            anchored to the PLANE rather than the section so it never covers the header's
            own controls (the ⌥ reveal sits up there). Markup, testids, roles and copy are
            byte-identical; only where it sits changed. */}
        {noticeRegion ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-4 pt-2">
            <div className="pointer-events-auto w-full max-w-3xl overflow-hidden rounded-lg border border-border/60 bg-card/95 shadow-lg backdrop-blur-sm">
              {noticeRegion}
            </div>
          </div>
        ) : null}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          // 184-10 — REQUIRED with a controlled `nodes` prop, and deliberately narrow:
          // only `position` changes are applied (see `handleNodesChange`).
          onNodesChange={handleNodesChange}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          // ── read-only, stated explicitly (every one of these defaults to true) ──
          // 184-10 flips exactly ONE of these, and it flips it PER NODE on the node
          // objects above rather than here: the shell default stays `false`, so a node
          // that does not opt in cannot be dragged. Every other line below stays off in
          // BOTH modes — they are what make "no free wiring" true rather than assumed.
          nodesDraggable={false}
          nodesConnectable={false}
          edgesReconnectable={false}
          connectOnClick={false}
          edgesFocusable={false}
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
          // elementsSelectable / nodesFocusable / panOnDrag stay at their defaults.
          fitView
          fitViewOptions={{ padding: 0.1, minZoom: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          colorMode="dark"
          // D-183-05 — the EXISTING selection contract. The callback fires outside
          // the library's selectability guard, and `node.id === phase.slug` is what
          // carries the identity end to end. The cap and the broken-reference stub
          // are not phase slugs, so they must never fire it.
          onNodeClick={(_, node) => {
            if (node.type === CANVAS_NODE_TYPES.phase) onSelectNode(node.id)
          }}
          // …and the deselect half, read straight off the library's own pane element.
          // A first-class prop on an already-interactive plane — not a DOM handler
          // bolted onto a non-interactive element — so the a11y gate stays clean.
          onPaneClick={onClearSelection}
          // …and the same contract from the keyboard (CR-01). One rule, two devices.
          onKeyDown={activateFromKeyboard}
          // …and the announced affordance, which has to match the MODE (see the two
          // tables at module scope). The read-only table is byte-unchanged.
          ariaLabelConfig={editable ? ARIA_LABELS_EDITABLE : ARIA_LABELS}
        >
          <Background />
          {/* The prop below removes the interactivity padlock — see the docblock;
              without it read-only is two clicks deep. */}
          <Controls showInteractive={false} />
          {/* 184-12 — the `＋` / `✕` layer. A CHILD of `<ReactFlow>` so it can read the
              viewport, and drawn through `<ViewportPortal>` so it lives on the plane
              beside the nodes rather than inside any of them. Editing-only. */}
          {editable ? (
            <PlaneEditingLayer
              phases={phases}
              lanes={lanes}
              phaseOrder={phaseOrder}
              nudges={nudges}
              dragOverlay={dragOverlay}
              pickerAt={pickerAt}
              onOpenPicker={setPickerAt}
              onDismissPicker={dismissPicker}
              onChooseType={chooseType}
              onRequestRemove={onRequestRemove}
            />
          ) : null}
        </ReactFlow>
      </div>
      {/* R12 — the ONE bottom-edge region: the toolbar row and the problems-tray row,
          in that source order, reversed so the toolbar owns the actual bottom edge.
          Deliberately NOT rendered on the empty draft above: U-1's first screen is an
          invitation, and a save state plus a problems tray on a workflow with no steps
          is chrome about nothing (D-184-15 — the server has not been asked either). */}
      {bottomRegion}
    </section>
  )
}

export default WorkflowCanvas
