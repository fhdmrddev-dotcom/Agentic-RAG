/**
 * Phase 185-10 (GOVERN-03, SPEC Req 8, D-185-18, sketch 147 §5) — FlowEdge.
 *
 * THE ARMED ACTION-RISK CHECKPOINT, DRAWN AS A DETOUR. The connector INTO a step
 * carrying an armed checkpoint leaves the flow and comes back through a point that
 * represents the person. It is the only one of sketch 147's three finalists that says
 * what the engine actually does — the run stops, hands out to a human, and resumes —
 * rather than "blocked", which is what both rejected rounds of barrier shapes said.
 *
 * ⚠ WHY THIS FILE IS NET-NEW CANVAS INFRASTRUCTURE, STATED FIRST (D-185-18).
 *
 * `185-SPEC.md` Req 8's build note says the detour "rides the `edgeTypes` entry named
 * `flow` that `WorkflowCanvas.tsx:279` already registers — no net-new canvas
 * infrastructure." **That entry did not exist.** Before this plan `grep -rn edgeTypes
 * frontend/src` returned exactly one hit, and it was a COMMENT stating the opposite: it
 * warned that setting `edge.type` would make the library look for a `flow` entry, find
 * that 183 had registered none, and fall back with a warning. There was no custom
 * `@xyflow/react` edge anywhere in `frontend/src` — zero matches for `BaseEdge`,
 * `getBezierPath`, `getSmoothStepPath`, `EdgeProps` or `EdgeLabelRenderer`.
 *
 * So four things are new, and the fourth is the one that makes this risky rather than
 * merely additive: `canvasModel.toCanvas` now sets `type: "flow"`, which moves EVERY
 * flow edge on the canvas off the library's built-in renderer and onto this component.
 * Getting the baseline half wrong changes the appearance of every connector in the app.
 *
 * ── HOW THE BASELINE IS REPRODUCED, AND WHY IT IS A TRANSCRIPTION ────────────────
 *
 * Read from the installed `@xyflow/react` v12 source rather than from memory
 * (`node_modules/@xyflow/react/dist/esm/index.mjs`):
 *
 *   const builtinEdgeTypes = { default: BezierEdgeInternal, straight: …, … }
 *   let edgeType = edge.type || 'default'
 *   let EdgeComponent = edgeTypes?.[edgeType] || builtinEdgeTypes[edgeType]
 *
 * so an edge with no `type` rendered through `BezierEdgeInternal`, which is exactly:
 *
 *   const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition,
 *     targetX, targetY, targetPosition, curvature: pathOptions?.curvature })
 *   return <BaseEdge id={undefined} path={path} labelX={labelX} labelY={labelY}
 *     label={label} … style={style} markerEnd={markerEnd} markerStart={markerStart}
 *     interactionWidth={interactionWidth} />
 *
 * The ordinary branch below is that call, with `id` omitted for the same reason the
 * internal variant omits it (`params.isInternal ? undefined : id`) — passing it would
 * add an `id` attribute to the drawn `<path>` that today's rendering does not have.
 *
 * THE ARROWHEAD IS RE-RENDERED HERE, and it has to be. `defaultEdgeOptions` still
 * MERGES onto the edge object (`edge = defaultEdgeOptions ? { …defaultEdgeOptions,
 * …edge } : edge`), so the marker is still DEFINED — but the library only hands its
 * resolved `url('#…')` to the edge component as the `markerEnd` prop. Nothing draws it
 * unless this component passes it through. A custom edge that ignores `markerEnd`
 * silently loses every arrowhead on the canvas.
 *
 * ── THE THREE STATES, AND WHY THERE ARE THREE ────────────────────────────────────
 *
 * `data.armed` is `boolean | undefined`, and the third state is what keeps two shipped
 * promises from contradicting each other (`canvasModel.CanvasEdgeData.armed` carries
 * the same table; sketch 147 `index.html:459` gates the whole mark on `step.risky` and
 * `:539` suppresses the default line when the detour owns it):
 *
 *   ABSENT   the step declares no checkpoint — an ORDINARY connector. Only the
 *            baseline bezier is drawn, so `185-VALIDATION.md`'s manual row ("screenshot
 *            a 5-step unarmed workflow before and after; edges must be
 *            indistinguishable") passes, and it passes for every canvas shipped today.
 *   false    the checkpoint is declared and OPEN. A faint dashed ghost arc and ghost
 *            circle, PLUS a solid line running straight through. Visibly present and
 *            open, never absent — drawing nothing here would make a step that emails a
 *            report with nobody watching look identical to one that reads a file.
 *   true     ARMED. The solid arc IS the path and NO straight line runs past it, or the
 *            flow would appear to bypass the person.
 *
 * In both non-absent states the detour OWNS the line: the baseline bezier is not drawn,
 * because layering it under the arc would double the ink and, when armed, would draw
 * the very bypass the shape exists to deny.
 *
 * ── 200-06: THE PAYLOAD LABEL, AND THE STATE THIS FILE DOES NOT DECIDE ──────────
 *
 * `200-CHECKLIST.md` §3 `BC-MR-01` — a connection carries the UPSTREAM step's own
 * DECLARED count. D-08's rule is that the label and the live per-step column are ONE
 * mechanism: the number rides the `runState` seam the PAGE already owns, this component
 * counts nothing, opens no request, joins nothing to nothing and words no noun. It is
 * handed `data.payload` and it draws what `payloadLabel` composes, or it draws nothing.
 *
 * ⚠ NOTHING AND `0` ARE DIFFERENT FACTS, AND THE DIFFERENCE IS THE WHOLE ATOM
 * (`BC-MNR-01`). A step whose type declares no count at all renders NO ELEMENT — not a
 * `0`, not a dash, not an empty pill. A step that searched and found nothing declared a
 * real `0` and MUST render it. That is why the absence arrives as an ABSENT `data.payload`
 * rather than as a zero, and why `payloadLabel` returns `null` rather than `""`.
 *
 * THE FOUR CONNECTION STATES (`BC-MR-02`) are resolved by `connectionState.ts` and chosen
 * by the SHELL, which owns the pointer and the pick. This file renders the state it is
 * handed onto the drawn path, and nothing more: the shell's suite drives all four, and the
 * criterion-24 fence below is why the pointer state could not live here even if it wanted
 * to — this file may name none of the four attribute spellings that could create a second
 * tab stop, and a state tracked locally would have needed one of them.
 *
 * ── READ-ONLY, WITHOUT EXCEPTION (T-185-10-01, sketch 147 §4) ────────────────────
 *
 * Every mark carries `pointer-events: none` and declares no ARIA role, no tab index and
 * no handler of any kind. The canvas has exactly one tab stop per node
 * (`PhaseNodeCard.tsx:37-48`, asserted in `WorkflowCanvas.test.tsx`), which is why the ✕
 * and ＋ live on the lane; a pressable armed mark would be a second stop. **The panel is
 * where you SET, the canvas is where you SEE** — arming happens in the governance
 * section of the step's side panel.
 *
 * That absence is a MECHANICAL guard, not a promise: `FlowEdge.test.tsx` greps this
 * file's own source for the four attribute spellings that could create a second stop and
 * requires zero hits, so the prose above is deliberately written WITHOUT them — a
 * docblock that spells the banned token defeats the grep that protects it, which is the
 * D-ITEM-183-02 trap this tree keeps catching.
 *
 * ── GEOMETRY: TRANSCRIBED, NOT RE-DERIVED ───────────────────────────────────────
 *
 * `ARC` and `LINE` are lifted verbatim from `.planning/sketches/147-the-armed-mark/
 * index.html:481-499`, the operator-locked round-3 acceptance bar. They are exported so
 * a test asserts the drawn `d` against the constant rather than a re-typed string.
 *
 * `DETOUR` derives `GAP` and `INSERT_Y` from `CANVAS_LAYOUT` — the ONE frozen table
 * `WorkflowCanvas`'s own `EDIT_AFFORDANCE` derives them from — rather than importing
 * `EDIT_AFFORDANCE` itself, and that is a cycle constraint rather than a preference:
 * `WorkflowCanvas` imports this module's component VALUE at module scope for its
 * `edgeTypes` map, so a value-level import back would be a live ESM cycle and whichever
 * module a caller reached first would hit a TDZ `ReferenceError` (`FlowEdge.test.tsx`,
 * which imports this file directly, reaches it first). `FlowEdge.test.tsx` pins
 * `DETOUR.GAP === EDIT_AFFORDANCE.GAP` and `DETOUR.INSERT_Y === EDIT_AFFORDANCE.INSERT_Y`
 * so the two derivations cannot drift apart silently.
 *
 * ⚠ THE CYCLE REASON ABOVE WAS SUPERSEDED BY 188.1-03, AND THE DUPLICATION STAYS ANYWAY.
 * `EDIT_AFFORDANCE` no longer lives in `WorkflowCanvas.tsx`: that plan cut it, with
 * `REVEAL_ON_HOVER`, `insertPointX` and `verticalOffsetFor`, into the leaf module
 * `editAffordance.ts`, which imports nothing but `canvasModel` and a type. Importing it
 * from here would therefore close NO cycle today, and the paragraph above must be read as
 * the history of why this table exists rather than as a live constraint (the `＋` layer
 * itself moved out too, into `PlaneEditingLayer.tsx`, so the `WorkflowCanvas.tsx:NNN`
 * pointers below address the PRE-MOVE file). The duplication is nevertheless KEPT
 * DELIBERATELY (D2): the drift pin is the whole value of having two derivations written
 * down, it has been observed RED, and deleting one side of a pin deletes the pin's
 * meaning. Collapsing it is a behaviour-shaped change owed its own phase, not a line
 * inside a refactor whose entire promise is that nothing changed.
 * CLEARANCE, computed by the sketch and re-computed by the suite rather than asserted:
 * the ＋ is `INSERT_SIZE` 26 centred in the 60px gap at `INSERT_Y` 28, i.e. x 17…43,
 * y 15…41. The arc's tightest point inside that x-range sits **8.2px BELOW** the ＋'s
 * bottom edge and the curve never enters the box. The ✕ is card-centred at
 * y = H−12…H+12 (`WorkflowCanvas.tsx:618-627`) — ON the card, not in the gap — so the
 * detour, living entirely in the gap, is clear of both. The rejected *countersign*
 * would have landed exactly on the ✕; the rejected *waiting card* grazes it by ~5px.
 *
 * KNOWN TRANSIENT, recorded rather than fixed: mid-DRAG the detour is anchored to the
 * live source handle, so a card dragged more than a few pixels horizontally separates
 * from the arc's far end until it snaps back to its computed lane on drop. That is the
 * same transient the shipped `＋` already has — `insertPointX` reads the COMPUTED
 * `lanes`, never the live drag x (`WorkflowCanvas.tsx:466-472`) — so it is consistent
 * with the surface rather than a new defect, and every settled state is exact.
 */
import { memo } from "react"

import { BaseEdge, getBezierPath, Position, type EdgeProps } from "@xyflow/react"

import { CANVAS_LAYOUT, type CanvasEdge } from "@/components/workflows/canvasModel"
import { payloadLabel } from "@/components/workflows/runVocabulary"

// ── The geometry table (S5 — one frozen table, never a literal at a use site) ────

/**
 * Every placement number the detour uses, derived from `CANVAS_LAYOUT` and from
 * nothing else — the same derivation `WorkflowCanvas`'s `EDIT_AFFORDANCE` makes, pinned
 * equal to it by this module's suite (see the docblock for why it is not imported).
 */
export const DETOUR = {
  /** Horizontal room between two cards — the connector's span, and the detour's box. */
  GAP: CANVAS_LAYOUT.PITCH_X - CANVAS_LAYOUT.NODE_WIDTH,
  /** The connector line's height off the node top, so the arc starts ON the line. */
  INSERT_Y: CANVAS_LAYOUT.LANE_Y + CANVAS_LAYOUT.EDGE_ANCHOR_Y,
  /** How far the arc dips below the line — the person-point's own offset. */
  DIP: 34,
  /** How far below the line the label sits. */
  LABEL_DROP: 44,
  /** The person-point circle's radius. */
  POINT_R: 4.5,
  /**
   * How far below the NODE TOP the detour's box reaches. Deliberately NOT `GAP`: the
   * two happen to share the value 60, and conflating them is exactly the stray-literal
   * confusion the frozen-table idiom exists to prevent. The box is `GAP` wide and
   * `INSERT_Y + BOX_DROP` tall (sketch 147 `index.html:495-496`).
   */
  BOX_DROP: 60,
} as const satisfies Record<string, number>

/** The detour box: `DETOUR.GAP` wide by this tall, and `pointer-events: none` throughout. */
export const DETOUR_BOX_HEIGHT = DETOUR.INSERT_Y + DETOUR.BOX_DROP

/**
 * THE ARC — the connector leaving the flow and coming back through the person.
 *
 * Transcribed verbatim from `.planning/sketches/147-the-armed-mark/index.html:481-483`.
 * Local coordinates: origin at the gap's LEFT edge, `y = INSERT_Y` on the connector
 * line, the dip at `INSERT_Y + DIP`. Do not re-derive it — the numbers are the
 * operator-locked round-3 shape and its clearance was computed against them.
 */
export const ARC = `M0,${DETOUR.INSERT_Y} C14,${DETOUR.INSERT_Y} 16,${
  DETOUR.INSERT_Y + DETOUR.DIP
} 30,${DETOUR.INSERT_Y + DETOUR.DIP} C44,${DETOUR.INSERT_Y + DETOUR.DIP} 46,${
  DETOUR.INSERT_Y
} ${DETOUR.GAP},${DETOUR.INSERT_Y}`

/** THE LINE — the solid connector running straight through an OPEN checkpoint. */
export const LINE = `M0,${DETOUR.INSERT_Y} L${DETOUR.GAP},${DETOUR.INSERT_Y}`

/** The x of the person-point and of the label: the gap's centre, where the ＋ also is. */
const POINT_X = DETOUR.GAP / 2

/**
 * Phase 200-06 (`BC-MR-01`) — how far ABOVE the line's own midpoint the payload label
 * sits, in plane pixels.
 *
 * ABOVE, and that is a clearance fact rather than a taste. The detour's own word already
 * owns the space BELOW the line (`DETOUR.LABEL_DROP` = 44), so putting the payload there
 * would stack two strings on an armed connector. Above the line the gap is empty in every
 * one of the three shipped edge states.
 */
const PAYLOAD_LIFT = 10

// ── The two labels (ONE home each, asserted character-identical by the suite) ────

/**
 * ARMED. Reads as a state of the run, not as a judgement: the flow goes through you.
 * Sketch 147's own wording, kept verbatim.
 */
export const DETOUR_ARMED_LABEL = "you say yes"

/**
 * OPEN. The sketch wrote *"nobody asked"*, which reads as a verdict on the author.
 * Reworded to the same fact stated as a STATE of this point in the run, per the plan's
 * instruction to prefer a state over a judgement. Neither string contains any of SPEC
 * Req 7's banned terms, and the suite greps both for that.
 */
export const DETOUR_OPEN_LABEL = "nobody is asked"

// ── The marks ───────────────────────────────────────────────────────────────────

/**
 * The ghost, drawn when a checkpoint is declared and OPEN. Faint enough to read as a
 * possibility rather than as a warning — governance spends no colour (SPEC Req 6), so
 * both strokes are the same neutral white at low alpha the sketch used.
 */
function GhostMarks() {
  return (
    <>
      <path
        data-testid="canvas-detour-arc"
        d={ARC}
        fill="none"
        stroke="hsl(220 30% 100% / .17)"
        strokeWidth={1.5}
        strokeDasharray="3 3"
        pointerEvents="none"
      />
      <circle
        data-testid="canvas-detour-point"
        cx={POINT_X}
        cy={DETOUR.INSERT_Y + DETOUR.DIP}
        r={DETOUR.POINT_R}
        fill="none"
        stroke="hsl(220 30% 100% / .2)"
        strokeWidth={1.4}
        strokeDasharray="2 2"
        pointerEvents="none"
      />
    </>
  )
}

/** The armed arc's own solid stroke and its person-point. */
function ArmedMarks() {
  return (
    <>
      <path
        data-testid="canvas-detour-arc"
        d={ARC}
        fill="none"
        stroke="hsl(220 30% 100% / .62)"
        strokeWidth={2}
        pointerEvents="none"
      />
      <circle
        data-testid="canvas-detour-point"
        cx={POINT_X}
        cy={DETOUR.INSERT_Y + DETOUR.DIP}
        r={DETOUR.POINT_R}
        fill="none"
        stroke="hsl(220 30% 100% / .85)"
        strokeWidth={1.6}
        pointerEvents="none"
      />
    </>
  )
}

// ── The component ───────────────────────────────────────────────────────────────

function FlowEdgeImpl({
  data,
  style,
  markerEnd,
  markerStart,
  interactionWidth,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  pathOptions,
}: EdgeProps<CanvasEdge>) {
  const armed = data?.armed

  // ── THE PAYLOAD LABEL (200-06 · BC-MR-01 · D-08) ──────────────────────────────
  //
  // The UPSTREAM step's own DECLARED count, handed down on `data.payload` by the shell,
  // which read it off the `runState` seam the PAGE owns. This component counts nothing,
  // joins nothing and words no noun: it renders the string the vocabulary composes from
  // the two halves the wire carried, or it renders NOTHING.
  //
  // ⚠ `null` MEANS "NO ELEMENT", NOT "AN EMPTY ONE" (BC-MNR-01). A step whose type
  // declares no count is a different fact from a step that declared `0`, and the second
  // one MUST render — a search that found nothing is a real answer. `payloadLabel` is the
  // one place that distinction is made, and it returns `null` rather than "" precisely so
  // this file can omit the element rather than draw an empty pill.
  const payload = data?.payload
  const payloadText = payload === undefined ? null : payloadLabel(payload.count, payload.noun)

  // The state's own machine-readable handle. Rendered on the drawn path in every branch,
  // so the four states are distinguishable to a test without reading a stroke colour.
  const connection = data?.connection

  // The library's own default path, byte-for-byte. Computed unconditionally so the
  // label anchors stay exactly where the built-in renderer put them.
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: pathOptions?.curvature,
  })

  // Placed in PLANE coordinates, so it sits identically on an ordinary connector and on a
  // detour — the detour's box is translated and this deliberately is not. Inert to the
  // pointer, like every other mark this file draws.
  const payloadMark =
    payloadText === null ? null : (
      <text
        data-testid="canvas-edge-payload"
        x={labelX}
        y={labelY - PAYLOAD_LIFT}
        textAnchor="middle"
        fontSize={10}
        fill="hsl(var(--muted-foreground))"
        pointerEvents="none"
      >
        {payloadText}
      </text>
    )

  // THE ORDINARY CONNECTOR — no checkpoint declared, so nothing about this edge changed
  // when `edge.type` did. This is the branch every shipped canvas renders.
  //
  // ⚠ THE FRAGMENT ADDS NO DOM. `payloadMark` is `null` on every canvas that supplies no
  // run state — which is every Builder canvas shipped today — and a fragment wrapping one
  // child and a `null` produces exactly the child. So `185-VALIDATION.md`'s manual row
  // ("an ordinary unarmed flow edge renders identically to today") still passes, and it
  // passes for the same reason it did before: nothing was added to the no-payload path.
  if (armed === undefined) {
    return (
      <>
        <BaseEdge
          path={path}
          labelX={labelX}
          labelY={labelY}
          label={label}
          labelStyle={labelStyle}
          labelShowBg={labelShowBg}
          labelBgStyle={labelBgStyle}
          labelBgPadding={labelBgPadding}
          labelBgBorderRadius={labelBgBorderRadius}
          style={style}
          markerEnd={markerEnd}
          markerStart={markerStart}
          interactionWidth={interactionWidth}
          {...(connection === undefined ? {} : { "data-connection-state": connection })}
        />
        {payloadMark}
      </>
    )
  }

  // The detour's box: anchored at the gap's LEFT edge (the source handle's x) and on the
  // connector line, whose y is the MEAN of the two handles — the same slant rule the ＋
  // follows, so a nudged card keeps the arc ON the line rather than merely near it.
  const boxX = sourceX
  const boxY = (sourceY + targetY) / 2 - DETOUR.INSERT_Y

  // The path the edge IS. Armed: the arc, so the flow visibly goes through the person
  // and no straight line runs past it. Open: the straight line, with the ghost arc drawn
  // behind it. Either way the DETOUR owns the line and the baseline bezier is not drawn,
  // which is `detourOwnsLine` in sketch 147 `index.html:539`.
  const owned = armed ? ARC : LINE

  return (
    <>
    <g
      data-testid="canvas-detour"
      data-armed={armed ? "true" : "false"}
      data-detour-box={`${DETOUR.GAP}x${DETOUR_BOX_HEIGHT}`}
      transform={`translate(${boxX}, ${boxY})`}
    >
      {armed ? <ArmedMarks /> : <GhostMarks />}
      {/* `BaseEdge` so the owned path keeps the library's own `react-flow__edge-path`
          class, its invisible interaction path, the per-kind `EDGE_STYLE` stroke AND the
          arrowhead — the marker rides the path's final point, whose tangent is
          horizontal-right in both shapes, exactly as it was before this plan. */}
      <BaseEdge
        path={owned}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={interactionWidth}
        {...(connection === undefined ? {} : { "data-connection-state": connection })}
      />
      {/* A signal, never a control — see the read-only section of the docblock. */}
      <text
        data-testid="canvas-detour-label"
        x={POINT_X}
        y={DETOUR.INSERT_Y + DETOUR.LABEL_DROP}
        textAnchor="middle"
        fontSize={9.5}
        fill="hsl(var(--muted-foreground))"
        pointerEvents="none"
      >
        {armed ? DETOUR_ARMED_LABEL : DETOUR_OPEN_LABEL}
      </text>
    </g>
    {payloadMark}
    </>
  )
}

/**
 * MEMOIZED, for the measured reason `PhaseNode.tsx:274-289` records rather than as a
 * habit: a drag rewrites the plane's transform every pointer frame and re-renders this
 * subtree ~60×/s. An unmemoized SVG rebuild per frame is the shipped "blinking while I
 * drag" defect the node components were memoized to fix.
 */
export const FlowEdge = memo(FlowEdgeImpl)
FlowEdge.displayName = "FlowEdge"
