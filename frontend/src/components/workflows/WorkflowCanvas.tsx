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
 * ⚠ WHAT 185-10 CHANGED, and a G-5 flag with it. This file now registers a module-scope
 * `edgeTypes` map (`{ flow: FlowEdge }`) beside `nodeTypes`, and the `DEFAULT_EDGE_OPTIONS`
 * docblock below was REWRITTEN because it asserted the opposite of the new truth
 * (D-185-18). Both changes are additive to the read-only surface: `edgeTypes` is passed in
 * BOTH modes, and an edge whose target step declares no action-risk checkpoint renders
 * exactly as the library's built-in bezier renderer drew it.
 *
 * ⚑ G-5 DISCHARGED BY 188.1-03 (CLAUDE.md hot-file ledger). This block used to FLAG the
 * extraction rather than record it — it named `PlaneEditingLayer` and the editing-geometry
 * table as "the natural extraction … already self-contained", noted that 185-10 had had to
 * export the table for a cross-module drift pin, and flagged the seam for Phase 188. Phase
 * 188.1 performed it, and the paragraph is restated rather than deleted because the flag's
 * REASONING is what makes the result auditable. Both went out: the component to
 * `PlaneEditingLayer.tsx`, and the geometry table with `REVEAL_ON_HOVER`, `insertPointX`
 * and `verticalOffsetFor` to the `editAffordance.ts` leaf — two modules rather than one,
 * per D-01, because a component module may not export a shared runtime value
 * (`react-refresh/only-export-components`, which this file errored under at its old `:365`).
 * It was a VERBATIM move of 311 lines out of `:346-413` and `:486-728`, and a HARD CUT:
 * this file now declares none of them, re-exports none of them and imports only the
 * component, rendered at the byte-identical JSX site inside `<ReactFlow>`. MEASURED,
 * 1593 L before → 1292 L after. The scope fences listed below did not narrow when the code
 * left, because 188.1-01 had already re-pointed them at a three-file subtree source that
 * named both destinations before either existed.
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
  type DefaultEdgeOptions,
  type NodeChange,
  type OnNodeDrag,
  type XYPosition,
} from "@xyflow/react"

// 199 CR WR-03 — the ground table lives in its own leaf: a component file may not export a
// shared OBJECT constant (`react-refresh/only-export-components`). The bare-string
// `BRANCH_CONNECTOR_WORD` below is exempt under the same rule and deliberately stays here.
import { BACKGROUND_GROUND } from "./canvasGround"
// Phase 200 (FE-WIRING) — the zoom readout, in its own leaf so this G-5 hot file gains a JSX
// child and no new hook. It subscribes to the viewport, which nothing in this body does.
import { CanvasZoomReadout } from "@/components/workflows/CanvasZoomReadout"
import { TechnicalNamesToggle } from "@/components/admin/TechnicalNamesToggle"
import {
  CANVAS_EDGE_KINDS,
  CANVAS_NODE_TYPES,
  toCanvas,
  type CanvasEdge,
  type CanvasNode,
  type EdgePayload,
} from "@/components/workflows/canvasModel"
import { CanvasToolbar, type ToolbarSaveState } from "@/components/workflows/CanvasToolbar"
// 200-06 (BC-MR-02) — the four connection states have ONE home, and it is a leaf that
// imports nothing but a React type. This shell owns the pointer and the selection, so it
// resolves the state; it does not decide what the four ARE.
import {
  CONNECTION_STATE_DELTA,
  CONNECTION_STATE_WORD,
  CONNECTION_STATES,
  connectionStateOf,
} from "@/components/workflows/connectionState"
import { resolveDrop, type PhaseTypeId } from "@/components/workflows/definitionOps"
import { FlowEdge } from "@/components/workflows/FlowEdge"
import type { VerdictMarkKind } from "@/components/workflows/nodePresentation"
import { own } from "@/components/workflows/ownProperty"
import { EndCapNode, PhaseNode, UnresolvedSkipNode } from "@/components/workflows/PhaseNode"
import type { NameContext, PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
import { PlaneEditingLayer } from "@/components/workflows/PlaneEditingLayer"
import { ProblemsTray } from "@/components/workflows/ProblemsTray"
import type { NodeRunState } from "@/components/workflows/runVocabulary"
import { StepTypePicker } from "@/components/workflows/StepTypePicker"
import type { VerdictGroups } from "@/components/workflows/verdictModel"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"
// 200-06 (BUG-260813-01) — the NON-THROWING accessor, deliberately. The throwing
// `useTheme` belongs to writers; this canvas only reads, and its four suites mount it with
// no provider.
import { useThemeOptional } from "@/providers/ThemeProvider"
// Type-only: the check-state union has ONE owner and this file declares no second
// spelling of it, so a rename there is a typecheck error here rather than a branch that
// quietly stops matching. Erased at build — no runtime edge. 187-27 moved the owner from
// the loop to `verdictModel`, which widens the loop's two emitted causes with the
// never-ran member the loop cannot emit; this canvas passes the value through untouched.
import type { TrayCheckCause } from "@/components/workflows/verdictModel"

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
 * MODULE SCOPE for the same Pattern-4 reason as `nodeTypes` above — declared in the
 * render body this object is new on every parent render, which makes React Flow warn
 * ("It looks like you have created a new edgeTypes object") and re-render every edge.
 * The keys are exactly `CANVAS_EDGE_KINDS`, as `nodeTypes`' keys are exactly
 * `CANVAS_NODE_TYPES`.
 *
 * ONLY `flow` IS REGISTERED, and that is the whole blast radius of 185-10 (D-185-18):
 * `canvasModel` sets `edge.type` on the sequential push alone, so `skip`, the
 * unresolvable-skip stub edge and the `end` cap keep the library's built-in `default`
 * renderer and `DEFAULT_EDGE_OPTIONS` below. A `skip`/`end` entry here would be dead
 * code — worse, it would look like a promise the projection does not make.
 */
const edgeTypes = {
  [CANVAS_EDGE_KINDS.flow]: FlowEdge,
} as const

/**
 * The arrow marker every edge wears.
 *
 * ⚠ REWRITTEN BY 185-10 — this docblock previously claimed that setting `edge.type` would
 * make the library look up a `flow` entry, find nothing registered by 183, and fall back
 * with a warning. That is no longer true, and the correction is the point of D-185-18:
 * `flow` edges now DO carry `edge.type` and render through
 * `FlowEdge`, which re-renders `markerEnd` itself, because the library hands a custom
 * edge the resolved `url('#…')` and draws nothing unless the component passes it
 * through. `skip` and `end` set no `type`, keep the default renderer, and are the
 * edges these options still reach on their own.
 *
 * Edge CLASSIFICATION still rides on `data.kind` — that is what `EDGE_STYLE` below is
 * keyed on, for all three kinds, and `FlowEdge` receives the resolved `style` as a prop
 * rather than deciding it.
 */
const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
    color: "hsl(var(--border))",
  },
}

/**
 * Phase 200 (canvas port) — how long the reorder-refusal acknowledgement stays on the node.
 *
 * 320ms against a 220ms animation: long enough that the nudge completes and the outline is
 * seen to rest for a moment, short enough that it cannot read as a persistent STATE of the
 * step. A refusal is an answer to one keypress, not a property of the first card.
 *
 * MODULE SCOPE, never a literal at the use site — the frozen-table rule this file already
 * applies to `CANVAS_LAYOUT`, `EDGE_STYLE` and `BACKGROUND_GROUND`.
 */
const REFUSAL_NUDGE_MS = 320

/**
 * The class the refusing node's WRAPPER wears for `REFUSAL_NUDGE_MS`. Spelled once here and
 * consumed by the `nodes` memo; its keyframe, its reduced-motion guard and the outline that
 * carries the reading when motion is suppressed all live in `index.css` beside the ring's.
 */
const REFUSAL_NUDGE_CLASS = "canvas-reorder-refused"

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
 * 199-05 — THE BRANCH CONNECTOR'S WORD, and the one row sheet `c1-canvas-plane` asked
 * for that this surface could honestly answer.
 *
 * ⚠ THE MEASURED GAP. Until this constant the resolved on-fail branch was the ONLY
 * connector on the plane that means something other than "then", and it said so in
 * NOTHING but a dash and an amber stroke. The same concept carries its word on both
 * sibling surfaces — `PhaseSpineGraph.tsx` prints `on fail → skip to <slug>`, and this
 * canvas's own broken-target stub prints `on fail → goes to <slug> — no such step` — so
 * a reader who cannot see the amber got the branch from the shipped canvas and from
 * nowhere else. The acceptance bar is that every state the plane can express is
 * distinguishable WITHOUT colour and carries its word where a word exists. The word
 * existed; the connector did not carry it.
 *
 * WHY THE WORD AND NOT THE GLYPH. The `⤳` mark is the shipped on-fail glyph
 * (`icon-convention.md` §4) and both sibling homes draw it — but both wrap it in
 * `aria-hidden`, because it is decoration beside a sentence that already carries the
 * meaning. An SVG edge label is ONE text node with no room for that split, so shipping
 * the glyph here would put an unlabelled mark into an accessible name. The dash already
 * carries the shape; this carries the meaning. The card's own rule, stated in
 * `PhaseNodeCard`'s docblock: **the WORD carries the meaning; tone is decoration.**
 *
 * WHY IT IS NOT THE SHEET'S LABEL. Sheet c1's connectors carry `312 contracts` →
 * `48 extracted` → `12 flagged`: a per-edge PAYLOAD COUNT. Nothing in this system emits
 * one, and drawing an approximation would be a fabricated business figure on the surface
 * a business reader trusts most. That is reported as CANNOT-EXPRESS, in full, in this
 * plan's summary. What ships here is the branch's own authored CONDITION, which the
 * definition already holds and two other surfaces already print.
 *
 * NOT ON THE BROKEN BRANCH. An unresolvable `skip_to_phase` already terminates in a stub
 * node that prints the whole sentence; a second `on fail` on its connector would be the
 * same fact twice, three centimetres apart.
 */
export const BRANCH_CONNECTOR_WORD = "on fail"

/**
 * The label's own presentation, in the SAME raw hsl the branch stroke above already
 * spends — deliberately not a Tailwind token. 15 of sheet 178's 18 colour tokens compile
 * to nothing against this repo's config, and an unpainted class is indistinguishable from
 * a deliberately unpainted arm (the `bg-warning` silent no-op that shipped unguarded
 * until 192.2). A raw literal beside an identical raw literal cannot acquire that failure.
 */
const BRANCH_CONNECTOR_LABEL = {
  label: BRANCH_CONNECTOR_WORD,
  labelShowBg: true,
  labelBgPadding: [6, 2] as [number, number],
  labelBgBorderRadius: 4,
  labelStyle: { fill: "hsl(38 92% 60% / 0.95)", fontSize: 10, fontWeight: 500 },
  labelBgStyle: { fill: "hsl(var(--card))", stroke: "hsl(38 92% 60% / 0.35)" },
} as const

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
  /**
   * The toolbar stepped the history (either direction). Optional — absent is today's
   * behaviour. The caller uses it to retire a notice that has stopped being true; this
   * component neither knows nor decides that (UAT-found; see `WorkflowBuilderPage`'s
   * `canvasNotice` docblock).
   */
  onHistoryStep?: () => void
  /** The server's findings, grouped by `verdictModel`. Nothing is classified here. */
  groups: VerdictGroups
  /** Why the last check produced no verdict, or null when it answered. Includes
   *  `"not-run"` — no request has been issued yet (187-27). */
  degraded: TrayCheckCause | null
  /** A check is in flight: the tray dims its rows, it never clears them. */
  checking: boolean
  /** The tray's disclosure state — owned by the CALLER, which is what makes
   *  "it never auto-opens on a new error" true by construction (184-08). */
  trayOpen: boolean
  onToggleTray: () => void
  /** A tray row was activated: take the author to that step. */
  onJumpToStep: (slug: string) => void
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
  /**
   * Phase 185 (D-185-09) — the server's KB-reading tool names, handed straight to
   * `toCanvas` so the canvas and the panel's governance dial read ONE value. This
   * component fetches it no more than it fetches anything else: the PAGE reads it
   * off `useGroundingBundle` and hands the answer down, exactly as it does for
   * `marks` and `nudges`.
   *
   * OPTIONAL, and absent marks NOTHING. That is the safe direction rather than a
   * convenience: the run-time gate is server-side and unconditional, so a canvas
   * rendered before the palette lands under-marks for one frame instead of making
   * a claim it cannot support. Every shipped caller that omits it renders exactly
   * as it did before this plan.
   */
  kbTools?: readonly string[]
  /** Phase 187 (D-187-05) — the PAGE-owned id→name maps, handed to `toCanvas` AND to the tray
   *  below so one step is never named two ways. Absent ⇒ the derived tier misses, never an id. */
  nameContext?: NameContext

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
   * One node's live run state, `undefined` when the run says nothing about it. The PAGE
   * owns all of it — the join onto the definition (D-188-01), the reading and the words —
   * so **this canvas derives no run state, reads no step ordinal and imports no
   * vocabulary**; its own suite greps for all three. Optional and inert when absent.
   */
  runState?: (slug: string) => NodeRunState | undefined
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
  kbTools,
  nameContext,
  editable = false,
  marks,
  runState,
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
  // 200-06 (BUG-260813-01) — the app's ONE theme, read the same way the ⌥ reveal above is:
  // a non-throwing context read, so this component still renders with no provider mounted.
  // Because it is a CONTEXT and not a per-consumer hook, a toggle made anywhere — the chat
  // shell owns the only one — re-renders this canvas. That is the property a second
  // `useTheme()` call could not have had, and it is the reason this fix is a provider.
  const themeCtx = useThemeOptional()
  const showTechnical = technicalNames?.showTechnical ?? false

  const projection = useMemo(() => toCanvas(phases, { kbTools, nameContext }), [phases, kbTools, nameContext])

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

  // ⚠ DECLARED HERE, ABOVE THE `nodes` MEMO THAT READS IT, AND NOT BESIDE THE KEY
  // HANDLER THAT WRITES IT. A `const` is in its temporal dead zone until its own line
  // runs, so declaring it next to the handler further down threw
  // `ReferenceError: Cannot access 'refusedSlug' before initialization` from inside the
  // memo — 83 tests red on one hoisting mistake, which is what this note is here to
  // stop the next reader repeating.
  /**
   * Phase 200 (canvas port) — WHICH STEP JUST REFUSED TO MOVE, if any.
   *
   * ⚠ IT EXISTS BECAUSE THE REFUSAL WAS SILENT. Operator finding, in their words: *"nodes
   * cannot move to the left or to the right — the first node to the left cannot move beyond
   * a certain boundary, same as to the right."* The REFUSAL is correct — order is derived
   * from run order and there is no position −1 — but the handler's early `return` told
   * nobody, so a person pressed a key, nothing happened, and nothing said why. That is the
   * same defect class as a control that declines without saying so.
   *
   * A SLUG AND NOT A BOOLEAN, so the acknowledgement lands on the node the person actually
   * selected rather than on the plane. It is transient by design and clears itself on a
   * timer; nothing downstream persists it, and it never reaches the definition.
   */
  const [refusedSlug, setRefusedSlug] = useState<string | null>(null)
  const refusalTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The timer is cleared on unmount so a refusal fired just before navigation cannot call
  // `setState` on a dead component. `useEffect` with an empty dep list is the right shape:
  // the ref survives every render, so there is nothing to re-subscribe.
  useEffect(
    () => () => {
      if (refusalTimer.current !== null) clearTimeout(refusalTimer.current)
    },
    [],
  )


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

  // ── 200-06 (BC-MR-02) — the two VIEW facts a connection's state is read from ─────
  //
  // Both live here rather than on the projection: they are where the pointer is and what
  // the person picked, neither of which belongs in a pure function of the definition.
  // Neither participates in the node memos, so a hover cannot re-render a card.
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  /**
   * 200-06 (BC-MR-01 · D-08) — slug → THE STEP'S OWN DECLARED COUNT, ready to render.
   *
   * ⚠ **PLACED ABOVE `settledNodes` ON PURPOSE, AND THE PLACEMENT IS FENCED.** This
   * file's own suite slices its source at the drag-overlay memo's declaration and asserts
   * that the whole REMAINDER names the run lookup nowhere — the anti-blink split, which
   * exists because a run lookup in the overlay memo rebuilt every node's `data` ~60×/s and
   * visibly flickered the cards. The edges memo lives below that line, so it may not name
   * the lookup either; this memo does the read once, up here, and the edges memo reads it.
   *
   * ⚠ AND THE SLICE ANCHOR IS A LITERAL STRING, SO THIS DOCBLOCK MAY NOT SPELL IT. Writing
   * the anchor out here — even inside a comment, even to explain the rule — moves the
   * suite's `indexOf` to this line and hands it an EMPTY slice, which then matches nothing.
   * Measured RED exactly that way while this memo was being written, which is the whole
   * reason the sentence above describes the anchor instead of quoting it.
   *
   * ⚠ **THE CANVAS STILL DERIVES NOTHING.** It calls the page-supplied function and keeps
   * what came back. It computes no count, opens no fetch, reads no step ordinal and
   * imports no vocabulary — the three properties its suite greps for. D-08's whole point
   * is that the connection's label and the live per-step column are ONE mechanism; a
   * second counting path here is what would let the two drift apart (BC-MNR-05).
   *
   * `typeof count === "number"` — never `count ?? …`, never `if (count)`. A step that
   * searched and found nothing declared a real `0` and it must survive to the render;
   * a type that declares no count at all must produce NO entry, so the edge can omit the
   * label element rather than draw an empty one (BC-MNR-01).
   */
  const edgePayloads = useMemo<Record<string, EdgePayload>>(() => {
    const out: Record<string, EdgePayload> = Object.create(null) as Record<string, EdgePayload>
    if (runState === undefined) return out
    for (const node of projection.nodes) {
      if (node.type !== CANVAS_NODE_TYPES.phase) continue
      const state = runState(node.id)
      if (state === undefined) continue
      const { count, noun } = state
      if (typeof count !== "number" || Number.isNaN(count)) continue
      if (typeof noun !== "string" || noun.length === 0) continue
      out[node.id] = { count, noun }
    }
    return out
  }, [projection.nodes, runState])

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
        // WR-04 — `own()`, not a bare index. A slug naming an `Object.prototype` member
        // (`constructor`, `toString`, …) otherwise resolves the INHERITED value, which is
        // a function: never nullish, so `?? 0` passes and the offset poisons the position.
        // BUG-260808-01.
        const dy = own(nudges ?? {}, node.id) ?? 0
        const position = dy === 0 ? node.position : { x: node.position.x, y: node.position.y + dy }

        const measured = measuredById[node.id]
        const run = runState?.(node.id)

        return {
          ...node,
          position,
          ariaLabel: run === undefined ? node.ariaLabel : `${node.ariaLabel} — ${run.label}`,
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
          data: { ...node.data, technical: showTechnical, verdict: marks?.(node.id), run },
        }
      }),
    [projection.nodes, selectedSlug, showTechnical, editable, marks, runState, nudges, measuredById],
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
      // WR-04 — THE SINK BUG-260808-01 MEASURED. A bare index on a slug named
      // `constructor` resolves the inherited function, which is `!== undefined`, so the
      // node's `position` became a Function with no `.x`/`.y` — and the library then
      // wrote NO transform at all, painting the card at the origin on top of phase 1.
      const overlay = own(dragOverlay, node.id)
      // Phase 200 — the reorder-refusal acknowledgement rides HERE rather than in
      // `settledNodes`, and the placement is load-bearing. This memo copies the node but
      // hands `data` straight through BY REFERENCE, so `PhaseNode`'s memo still
      // short-circuits and the card is not re-rendered to show a wrapper class. Adding it
      // one memo up would have rebuilt every node's `data` object — the exact identity the
      // drag-flicker fix depends on.
      const refused = refusedSlug !== null && node.id === refusedSlug
      if (overlay === undefined && !refused) return node
      touched = true
      return {
        ...node,
        ...(overlay === undefined ? {} : { position: overlay }),
        // Composed, never replaced: the projection may already have given this node a
        // class, and a refusal must not silently drop it.
        ...(refused
          ? { className: [node.className, REFUSAL_NUDGE_CLASS].filter(Boolean).join(" ") }
          : {}),
      }
    })
    return touched ? next : settledNodes
  }, [settledNodes, dragOverlay, refusedSlug])

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

  const edges = useMemo<CanvasEdge[]>(() => {
    // 199-05 — the stubs a BROKEN branch terminates in. Read off the node TYPE rather
    // than off the reserved id prefix, so renaming the namespace cannot silently start
    // labelling the broken branch twice.
    const brokenTargets = new Set(
      projection.nodes
        .filter((node) => node.type === CANVAS_NODE_TYPES.unresolvedSkip)
        .map((node) => node.id),
    )
    return projection.edges.map((edge) => {
      const kind = edge.data?.kind ?? CANVAS_EDGE_KINDS.flow
      // 200-06 (BC-MR-02) — the four states, resolved by the ONE leaf that defines them.
      //
      // `not taken` is the CONDITIONAL BRANCH and nothing else. It is a fact about the
      // DEFINITION — this line is only followed when a check fails — never a claim that a
      // run did not follow it, which would need rows this canvas does not read.
      const connection = connectionStateOf({
        selected: edge.id === selectedEdgeId,
        hovered: edge.id === hoveredEdgeId,
        conditional: kind === CANVAS_EDGE_KINDS.skip,
      })
      // ⚠ `own()`, not a bare index (WR-04 · BUG-260807-01 / BUG-260808-01). An edge's
      // `source` IS a phase slug, `workflow_phases.slug` is unconstrained `text`, and a
      // slug named `constructor` resolves an INHERITED FUNCTION through a bare index —
      // never nullish, so every downstream guard passes and a function reaches the render.
      // The map is null-prototype as well, so the write side cannot be poisoned either.
      const payload = own(edgePayloads, edge.source)
      return {
        ...edge,
        // At rest and not-taken contribute an EMPTY delta, so the shipped run-order
        // connector and the shipped dashed branch are byte-identical to before this plan.
        style: { ...EDGE_STYLE[kind], ...CONNECTION_STATE_DELTA[connection] },
        // The branch's word, on the RESOLVED branch only — see `BRANCH_CONNECTOR_WORD`.
        // Spread CONDITIONALLY (the shipped D-14 idiom), so a run-order connector's object
        // is byte-identical to what it was before this plan.
        ...(kind === CANVAS_EDGE_KINDS.skip && !brokenTargets.has(edge.target)
          ? BRANCH_CONNECTOR_LABEL
          : {}),
        data: {
          ...(edge.data ?? { kind }),
          connection,
          // CONDITIONAL, for the same D-14 reason: an upstream step that declared nothing
          // leaves the key absent, and `FlowEdge` then renders NO label element at all —
          // never a `0`, never a dash, never an empty pill (BC-MNR-01).
          ...(payload === undefined ? {} : { payload }),
        },
      }
    })
  }, [projection.edges, projection.nodes, edgePayloads, hoveredEdgeId, selectedEdgeId])

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
      if (dy !== 0) onNudge?.(node.id, (own(nudges ?? {}, node.id) ?? 0) + dy)
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
      // At either end there is nowhere to go. Nothing is committed, and NOTHING NEW IS SAID
      // — a live region that repeats itself on a no-op teaches the user to ignore it. That
      // sentence is unchanged and still governs the ANNOUNCEMENT.
      //
      // ⚠ WHAT CHANGED IS THAT SILENCE IS NO LONGER THE WHOLE ANSWER (Phase 200 — operator
      // finding). The reasoning above is correct about the screen reader and was being
      // applied to the eye as well, so a sighted person pressed a key and got nothing at
      // all. The visual acknowledgement below is the other half: it fires on the selected
      // node, it is bounded, and it says "this direction is the end" without claiming
      // anything moved.
      //
      // IT DOES NOT SPAM, and the mechanism is not a string comparison. `event.repeat` is
      // already discarded above, so a HELD key nudges once. A repeatedly TAPPED key is a
      // repeated deliberate act and gets a repeated answer — which is the honest behaviour;
      // what the comment above forbids is re-announcing the same words into a live region,
      // and the live region is untouched here. `setAnnouncement` is deliberately NOT called.
      //
      // The state is re-set before the timer so a second tap restarts the acknowledgement
      // rather than being swallowed by the tail of the first.
      if (to < 0 || to >= phaseOrder.length) {
        event.preventDefault()
        if (refusalTimer.current !== null) clearTimeout(refusalTimer.current)
        setRefusedSlug(null)
        // A frame's gap, so React really removes and re-adds the class and the animation
        // restarts. Setting the same value twice in one tick would be a no-op render.
        refusalTimer.current = setTimeout(() => {
          setRefusedSlug(selectedSlug)
          refusalTimer.current = setTimeout(() => setRefusedSlug(null), REFUSAL_NUDGE_MS)
        }, 0)
        return
      }

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
   * bottom bands stacked on each other, on a column that at 900px already has a
   * `clamp(480px, 38%, 640px)` panel beside 248px cards (D-214-22 widened that panel; the
   * arithmetic is worst-case at the clamp's 480px minimum, leaving 420px of column). The
   * recorded fix is this: fold the tray's SUMMARY LINE into
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
          onHistoryStep={session.onHistoryStep}
        />
        <ProblemsTray
          groups={session.groups}
          phases={phases}
          nameContext={nameContext}
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
          `REVEAL_ON_HOVER`, which 188.1-03 moved OUT of this file and into
          `editAffordance.ts` (it was declared here at `:412` until then, so read this as
          a pointer across a module boundary rather than at a local const). It is named
          rather than bare so a future nested `group` cannot capture it by accident.
          `relative` anchors the floated notice below. */}
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
          // 185-10 — the module-scope map above, beside `nodeTypes` and for the same
          // Pattern-4 reason. `flow` edges render through `FlowEdge`; `skip` and `end`
          // carry no `type` and keep the built-in renderer.
          edgeTypes={edgeTypes}
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
          // ── 200-06 (BUG-260813-01 · BC-MNR-03) — THE PLANE FOLLOWS THE APP ─────────
          //
          // This read `colorMode="dark"`, hardcoded, and it was the whole bug: the canvas
          // was the only dark island in a light page. ⚠ AND IT DARKENED MORE THAN THE
          // PLANE. React Flow puts this value on its wrapper as a CLASS — the literal
          // string `"dark"` — and `tailwind.config.js` is `darkMode: ["class"]`, which
          // Tailwind scopes by the NEAREST ANCESTOR. So one prop wrapped the whole subtree
          // in a `.dark` ancestor and took the dot grid, the controls, the attribution and
          // our own node cards with it — cards that hardcode nothing and use theme tokens
          // throughout. That is why no per-card work was owed, and why the fence for this
          // asserts the PLANE and a CARD rather than the prop: the completeness is a
          // coincidence of two unrelated systems agreeing on one spelling, and if they ever
          // diverge the canvas half-fixes and reads as a fresh bug.
          //
          // NON-THROWING, and required: this canvas's four suites mount it with no provider
          // at all. `"dark"` is the fallback because it is what `getInitialTheme` returns
          // with no window and no stored preference — so a provider-less render is
          // byte-identical to the pre-fix rendering rather than newly light.
          colorMode={themeCtx?.theme ?? "dark"}
          // D-183-05 — the EXISTING selection contract. The callback fires outside
          // the library's selectability guard, and `node.id === phase.slug` is what
          // carries the identity end to end. The cap and the broken-reference stub
          // are not phase slugs, so they must never fire it.
          onNodeClick={(_, node) => {
            if (node.type === CANVAS_NODE_TYPES.phase) onSelectNode(node.id)
          }}
          // ── 200-06 (BC-MR-02) — the two states the plane could not express ────────
          //
          // FIRST-CLASS PROPS ON AN ALREADY-INTERACTIVE PLANE, exactly as `onPaneClick`
          // below is, and for the same reason: the alternative was a handler bolted onto
          // the edge component, and `FlowEdge`'s own suite forbids that outright — it
          // greps that file for four attribute spellings and requires zero hits, because
          // one tab stop per node is a canvas-level invariant and a pressable mark on a
          // line would be a second. The pointer and the pick therefore live HERE, and the
          // edge renders the state it is handed.
          //
          // Selection is tracked locally rather than through the library's own edge
          // selection: `edges` is a CONTROLLED prop with no `onEdgesChange`, so a
          // library-managed `selected` flag could never be applied back and the state
          // would be unreachable. This mirrors the node contract two lines below, where
          // `selectedSlug` is the page's and the click is the library's.
          onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
          onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
          onEdgeMouseLeave={() => setHoveredEdgeId(null)}
          // …and the deselect half, read straight off the library's own pane element.
          // A first-class prop on an already-interactive plane — not a DOM handler
          // bolted onto a non-interactive element — so the a11y gate stays clean.
          //
          // 200-06 — it clears the CONNECTION pick too. A click on empty plane means "I am
          // done with what I had picked", and leaving a line lit while the node selection
          // cleared would leave two selections disagreeing on one surface.
          onPaneClick={() => {
            setSelectedEdgeId(null)
            onClearSelection()
          }}
          // …and the same contract from the keyboard (CR-01). One rule, two devices.
          onKeyDown={activateFromKeyboard}
          // …and the announced affordance, which has to match the MODE (see the two
          // tables at module scope). The read-only table is byte-unchanged.
          ariaLabelConfig={editable ? ARIA_LABELS_EDITABLE : ARIA_LABELS}
        >
          {/* 199-05 — THE GROUND, COMMITTED. Sheet `c1-canvas-plane`'s one structural
              claim about the plane is that it *commits* to a ground rather than leaving
              one to happen: "a quiet dot grid, quiet enough that a step at rest is still
              the loudest thing on the plane."

              Until this line the ground was whatever `@xyflow/react` defaults to. The
              three values below are the ones it was ALREADY producing — MEASURED off the
              shipped rendering, not copied from the sheet — so this changes no pixel and
              buys one thing: a library upgrade that moves a default can no longer move
              this surface's ground without a diff. `BACKGROUND_GROUND` is the frozen
              table (S5 — never a literal at a use site).

              ⚠ THE COLOUR IS DELIBERATELY NOT COMMITTED. `color` would emit an inline
              fill and take the dots OFF the theme's own variables, so the ground would
              stop following light/dark. Geometry is ours to state; the palette belongs to
              the theme. The sheet's own `#212631` on `#090e18` is declined for the same
              reason 15 of its 18 colour tokens are: they are that sheet's palette, and
              this repo's config does not carry them. */}
          <Background
            variant={BACKGROUND_GROUND.variant}
            gap={BACKGROUND_GROUND.gap}
            size={BACKGROUND_GROUND.size}
          />
          {/* The prop below removes the interactivity padlock — see the docblock;
              without it read-only is two clicks deep.

              ── ⚠ Phase 200 (FE-WIRING) — SKETCH 200's `Lock canvas` IS DECLINED, AND THE
                 NARROWING THAT WOULD HAVE ALLOWED IT WAS BUILT, MEASURED AND WITHDRAWN.

              `builder-canvas.html:391` draws a `title="Lock canvas"` padlock in this cluster,
              and the 200 audit correctly notes the library ships one — so this reads as a
              one-word prop flip. It is not, and the reasoning is recorded because the
              attractive version of it is wrong for a reason a reader cannot see from here.

              THE NARROWING THAT WAS TRIED: `showInteractive={editable}`, so the read-only
              canvas keeps `false` — every word of the argument above is stated about the
              read-only surface and still holds — while the Builder's editable plane, which is
              ALREADY draggable and connectable, gains a control whose only transition is
              editable → LOCKED. That framing is sound as far as it goes: on an editable plane
              the padlock cannot GRANT a capability, only withhold one.

              ⚠ WHY IT WAS WITHDRAWN ANYWAY, and this is the fact the audit flagged as *"the
              sheet's separate lock semantics would need a decision"*: xyflow's handler sets
              `nodesDraggable`, `nodesConnectable` AND `elementsSelectable` — all three. The
              third is not a layout concern. On THIS surface selecting a node is what opens the
              step panel, so the library's "lock" would also remove the author's ability to
              INSPECT a step. The sheet's padlock protects an arrangement; this one would
              additionally make the workflow unreadable while engaged, which is a different
              control wearing the same glyph. Choosing what a locked canvas should still permit
              is a product decision, not a wiring one.

              ⚠ RE-OPEN TRIGGER, dated rather than permanent: a phase that scopes canvas view
              controls as a feature and decides what `Lock canvas` means here. The likely shape
              is a lock that suppresses drag and connect while LEAVING selection alive — which
              is not `showInteractive` at all, but the three underlying props set
              independently. That is a build, and it is why this is not one. */}
          <Controls showInteractive={false}>
            {/* Phase 200 (FE-WIRING) — the sheet's `100%`. It renders INSIDE the shipped
                cluster rather than as a second floating panel, so the plane still has exactly
                one control affordance in its bottom-left corner.

                ⚠ THE SHEET PUTS IT BETWEEN `−` AND `+` AND THIS APPENDS IT AFTER THE
                BUTTONS, because `<Controls>` renders its children after its own and
                interleaving them means rebuilding the cluster by hand — trading a real
                dependency on the library's zoom handlers for a pixel match. The atom the sheet
                is asking for is *"the plane says how far in it is"*, and it now does. */}
            <CanvasZoomReadout />
          </Controls>
          {/* 200-06 (BC-MR-02) — THE LEGEND STRIP, the sketch's own bottom-right panel.
              It is what makes the four states legible rather than merely distinct: a line
              that changes weight under the pointer says nothing until the plane has said
              what its line weights MEAN. The words are the leaf's, so the legend and the
              lines can never end up naming the same state differently.

              Decorative and inert: `aria-hidden`, no control, no tab stop — one tab stop
              per node is a canvas-level invariant and a legend is not an exception to it.
              The swatches carry SHAPE (weight and dash), never colour alone. */}
          <div
            aria-hidden="true"
            data-testid="canvas-connection-legend"
            className="pointer-events-none absolute bottom-2 right-2 z-10 flex items-center gap-3 rounded-md border border-border/60 bg-card/85 px-3 py-1.5 backdrop-blur-sm"
          >
            {CONNECTION_STATES.map((state) => (
              <span key={state} className="flex items-center gap-1.5" data-legend-state={state}>
                <svg width="16" height="4" viewBox="0 0 16 4" className="block">
                  <line
                    x1="0"
                    y1="2"
                    x2="16"
                    y2="2"
                    strokeWidth={CONNECTION_STATE_DELTA[state].strokeWidth ?? 2}
                    stroke={CONNECTION_STATE_DELTA[state].stroke ?? "hsl(var(--border))"}
                    strokeDasharray={state === "not-taken" ? "3 2" : undefined}
                  />
                </svg>
                <span className="text-[11px] leading-none text-muted-foreground">
                  {CONNECTION_STATE_WORD[state]}
                </span>
              </span>
            ))}
          </div>
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
