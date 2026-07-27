/**
 * Phase 183-06 Task 2 (CANVAS-01, D-183-05 / D-183-08 / D-183-11, sketch 134/137-D) —
 * WorkflowCanvas.
 *
 * THE SHELL. It mounts `canvasModel.toCanvas`'s projection inside `@xyflow/react`.
 *
 * ⚠ WHAT PLAN 184-10 CHANGED, stated first so this docblock cannot drift (the
 * D-ITEM-183-02 trap). Until 184-10 this file was the READ-ONLY shell and its whole
 * job beyond mounting the projection was to make read-only TRUE rather than assumed.
 * It now has TWO modes, and `editable` is the switch. `editable={false}` — the
 * default, and what every shipped caller passes today — renders exactly the surface
 * described below, unchanged. `editable` flips ONE thing and only one: per-node
 * `draggable`, on phase nodes. Everything in the opt-out block stays off in both
 * modes.
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

import { TechnicalNamesToggle } from "@/components/admin/TechnicalNamesToggle"
import {
  CANVAS_EDGE_KINDS,
  CANVAS_NODE_TYPES,
  toCanvas,
  type CanvasEdge,
  type CanvasNode,
} from "@/components/workflows/canvasModel"
import { resolveDrop } from "@/components/workflows/definitionOps"
import type { VerdictMarkKind } from "@/components/workflows/nodePresentation"
import { EndCapNode, PhaseNode, UnresolvedSkipNode } from "@/components/workflows/PhaseNode"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"

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
   * The editing switch. `false` (the default) renders the pre-184-10 read-only canvas
   * exactly: no per-node drag, no keyboard reorder, no editing copy in the header. The
   * page passes the canvas feature flag, so a flag-off surface is byte-identical.
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

  /** Where the dragged card started. Captured on drag start; the axis split is read
   *  against it, never against the lane it happens to be nearest. */
  const dragOriginRef = useRef<XYPosition | null>(null)

  // A COPY. Selection, the ⌥ boolean, the cosmetic `dy`, the per-node drag flag and the
  // server verdict mark are all view state; the model output and the definition behind
  // it are never touched, which is why no layout key can reach the payload.
  const nodes = useMemo<CanvasNode[]>(
    () =>
      projection.nodes.map((node) => {
        if (node.type !== CANVAS_NODE_TYPES.phase) return node

        // The cosmetic offset is merged into a COPY of the position. A zero offset with
        // no drag in flight reuses the model's own object, so an idle canvas hands the
        // library a stable reference and does not re-measure on every parent render.
        const dy = nudges?.[node.id] ?? 0
        const overlay = dragOverlay[node.id]
        const position =
          overlay ?? (dy === 0 ? node.position : { x: node.position.x, y: node.position.y + dy })

        return {
          ...node,
          position,
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
    [projection.nodes, selectedSlug, showTechnical, editable, marks, nudges, dragOverlay],
  )

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
   * Everything else the library computes is deliberately DROPPED: `dimensions` is
   * measured into its internal lookup and needs no echo (183 proved that empirically by
   * painting every edge with no handler at all), `select` belongs to the page's
   * `selectedSlug`, and `remove` / `add` / `replace` belong to `definitionOps`. Applying
   * them here would put a second, silent editing path beside the one this plan is
   * chartered to build.
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

  // D-183-11 — EARLY RETURN. Nothing below this line mounts on an empty definition.
  if (nodes.length === 0) {
    return (
      <section aria-label={sectionLabel} className="flex h-full min-w-0 flex-col bg-background">
        {header}
        <div
          data-testid="canvas-empty"
          className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center"
        >
          <p className="text-sm font-medium text-foreground">No steps yet</p>
          <p className="text-[12px] text-muted-foreground">
            Add a step to this workflow and it will appear here.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section aria-label={sectionLabel} className="flex h-full min-w-0 flex-col bg-background">
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
      {/* The parent MUST have a width and a height or the plane measures to zero. */}
      <div className="h-full w-full min-w-0 flex-1">
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
        </ReactFlow>
      </div>
    </section>
  )
}

export default WorkflowCanvas
