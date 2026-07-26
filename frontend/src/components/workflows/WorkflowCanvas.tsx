/**
 * Phase 183-06 Task 2 (CANVAS-01, D-183-05 / D-183-08 / D-183-11, sketch 134/137-D) —
 * WorkflowCanvas.
 *
 * THE READ-ONLY SHELL. It mounts `canvasModel.toCanvas`'s projection inside
 * `@xyflow/react`, and its whole job beyond that is to make read-only TRUE rather
 * than assumed.
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
 * projection is mapped to a COPY carrying `selected` and the ⌥ boolean; nothing is
 * ever written back onto `phases` or onto any definition object, so no layout key
 * can leak into `workflow_definitions.definition`.
 *
 * SCOPE FENCES, all machine-checked by the source guard in this file's suite: 183
 * calls no validation endpoint and no other endpoint, renders no per-node server
 * verdict badge, imports no undo/redo or auto-layout library, reads and writes no
 * authored grounding field, adds no run state and no run colour, and persists no
 * view preference. Those are Phases 184, 185, 186 and 188.
 *
 * XSS (T-124-01): every authored string (phase names) is rendered as a plain React
 * text child / `title=` attribute value — never `dangerouslySetInnerHTML`.
 */
import { useCallback, useMemo, type CSSProperties, type KeyboardEvent } from "react"
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type DefaultEdgeOptions,
} from "@xyflow/react"

import { TechnicalNamesToggle } from "@/components/admin/TechnicalNamesToggle"
import {
  CANVAS_EDGE_KINDS,
  CANVAS_NODE_TYPES,
  toCanvas,
  type CanvasEdge,
  type CanvasNode,
} from "@/components/workflows/canvasModel"
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
  /** Selection only — NEVER reorders, NEVER moves a node. Fires the clicked slug. */
  onSelectNode: (slug: string) => void
  /** Release the selection (a click on empty space). REQUIRED — the deselect half of
   *  the same contract; a canvas that can only select is a panel with no way out. */
  onClearSelection: () => void
}

export function WorkflowCanvas({
  phases,
  selectedSlug,
  onSelectNode,
  onClearSelection,
}: WorkflowCanvasProps) {
  // The app-wide reveal, READ (never owned) here. Null outside a provider.
  const technicalNames = useTechnicalNamesOptional()
  const showTechnical = technicalNames?.showTechnical ?? false

  const projection = useMemo(() => toCanvas(phases), [phases])

  // A COPY. Selection and the ⌥ boolean are view state; the model output and the
  // definition behind it are never touched.
  const nodes = useMemo<CanvasNode[]>(
    () =>
      projection.nodes.map((node) =>
        node.type === CANVAS_NODE_TYPES.phase
          ? {
              ...node,
              selected: node.id === selectedSlug,
              data: { ...node.data, technical: showTechnical },
            }
          : node,
      ),
    [projection.nodes, selectedSlug, showTechnical],
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
   * The keyboard half of D-183-05. The library's own per-node key handler neither
   * stops propagation nor prevents the default on Enter/Space, so the event reaches
   * the plane wrapper; `.react-flow__node` carries `data-id`, which for a phase node
   * IS the slug. The id is checked against the memoized projection rather than
   * re-derived, so the end cap and the broken-reference stub — neither of which is a
   * phase — stay exactly as inert here as they are under the mouse.
   */
  const activateFromKeyboard = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return

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

  // The header is shared by both branches — read-only is told as a deliberate MODE
  // in the shipped `👁 View only` vocabulary, never invented a second time.
  const header = (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2">
      <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
        👁 View only
      </span>
      <span className="text-[11px] text-muted-foreground">the plane pans · steps stay put</span>
      <span className="flex-1" />
      {technicalNames ? (
        <TechnicalNamesToggle enabled={showTechnical} onToggle={technicalNames.toggle} />
      ) : null}
    </div>
  )

  // D-183-11 — EARLY RETURN. Nothing below this line mounts on an empty definition.
  if (nodes.length === 0) {
    return (
      <section
        aria-label="Workflow canvas (read-only)"
        className="flex h-full min-w-0 flex-col bg-background"
      >
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
    <section
      aria-label="Workflow canvas (read-only)"
      className="flex h-full min-w-0 flex-col bg-background"
    >
      {header}
      {/* The parent MUST have a width and a height or the plane measures to zero. */}
      <div className="h-full w-full min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          // ── read-only, stated explicitly (every one of these defaults to true) ──
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
          ariaLabelConfig={ARIA_LABELS}
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
