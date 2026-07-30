/**
 * Phase 185-10 Task 3 (GOVERN-03, SPEC Req 8, D-185-18, criterion 24) — FlowEdge tests.
 *
 * THE MECHANICAL HALF. The FULL visual claim is the manual row in `185-VALIDATION.md`
 * ("screenshot a 5-step unarmed workflow before and after the `FlowEdge` landing; edges
 * must be indistinguishable"), because only a rendered pixel can prove two edges look
 * the same. What a jsdom suite CAN prove is that the drawn path, its stroke and its
 * arrowhead are the same values the library's built-in renderer produced — and that is
 * what the first block below does.
 *
 * ── HOW THE "BEFORE" IS OBTAINED, and why it is not a hand-typed string ─────────
 *
 * A hand-typed baseline `d` proves nothing about what the library USED to draw: it only
 * pins whatever the author believed. So the guard renders the SAME two-node harness
 * TWICE — once with an edge carrying NO `type` (which is exactly the pre-185-10 edge, and
 * routes through `builtinEdgeTypes.default`, i.e. `BezierEdgeInternal`), and once with
 * `type: "flow"` plus the `edgeTypes` map this plan registers — and compares the rendered
 * attributes. The "before" is therefore CAPTURED FROM THE SHIPPED DEFAULT RENDERING in
 * the same run, and the assertion cannot go stale.
 *
 * The harness uses its own minimal probe node rather than `PhaseNode`, because the claim
 * is about the EDGE renderer and both renders must differ in exactly one thing. Absolute
 * coordinates under jsdom are not production coordinates; the comparison is BEFORE vs
 * AFTER, never against a literal.
 *
 * ── WHAT ELSE IS PINNED ─────────────────────────────────────────────────────────
 *
 *  1. the no-visible-change guard above (D-185-18's required criterion);
 *  2. armed vs open vs ordinary — armed draws the ARC and NO straight LINE past it;
 *     open draws the ghost ARC plus the LINE; ordinary draws neither and keeps the
 *     baseline bezier;
 *  3. criterion 24 — the mark is READ-ONLY: the canvas-level walk copied from
 *     `WorkflowCanvas.test.tsx:253-260` including its non-vacuity guard, plus a source
 *     fence over the four attribute spellings that could create a second tab stop
 *     (a React prop never reaches the DOM as an attribute, so a DOM query alone cannot
 *     see one — the fence is the part that can);
 *  4. clearance — the transcribed cubic is SAMPLED and shown never to enter the ＋'s
 *     box, with a measured minimum matching the sketch's computed 8.2px;
 *  5. the two labels, character-identical to their exported constants and clear of
 *     SPEC Req 7's banned list;
 *  6. `DETOUR` ≡ `EDIT_AFFORDANCE` — the load-bearing drift pin. `FlowEdge` derives
 *     `GAP` / `INSERT_Y` from `CANVAS_LAYOUT` in its own table instead of importing
 *     `WorkflowCanvas`'s, because a value-level import back would close an ESM cycle
 *     (`WorkflowCanvas` needs `FlowEdge` at module scope for `edgeTypes`). This pin is
 *     what makes that deviation safe, so it is not optional.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type DefaultEdgeOptions,
  type Edge,
  type Node,
} from "@xyflow/react"

// FILE-LOCAL, never setupTests.ts — the `WorkflowCanvas.test.tsx:26-29` rule: the helper
// mutates `HTMLElement.prototype` and a global install would perturb every suite.
import { mockReactFlow } from "@/test-utils/mockReactFlow"
// The component SOURCE via Vite's `?raw` loader — the `canvasModel.purity.test.ts:14-17`
// house idiom for making a scope fence machine-checkable.
import flowEdgeSource from "./FlowEdge?raw"
import workflowCanvasSource from "./WorkflowCanvas?raw"
import {
  ARC,
  DETOUR,
  DETOUR_ARMED_LABEL,
  DETOUR_BOX_HEIGHT,
  DETOUR_OPEN_LABEL,
  FlowEdge,
  LINE,
} from "./FlowEdge"
import { EDIT_AFFORDANCE, WorkflowCanvas } from "./WorkflowCanvas"
import { CANVAS_LAYOUT, type CanvasEdgeData } from "./canvasModel"
import { docQaHuman } from "./__fixtures__/canvasFixtures"
import type { PhaseSpecJSON } from "./phaseVocabulary"

mockReactFlow()

// ── The two-node probe harness ──────────────────────────────────────────────────

/** A node that renders nothing but the two handles an edge needs (assumption A1). */
function ProbeNode() {
  return (
    <div style={{ width: CANVAS_LAYOUT.NODE_WIDTH, height: CANVAS_LAYOUT.NODE_MIN_HEIGHT }}>
      <Handle type="target" position={Position.Left} style={{ top: CANVAS_LAYOUT.EDGE_ANCHOR_Y }} />
      <Handle type="source" position={Position.Right} style={{ top: CANVAS_LAYOUT.EDGE_ANCHOR_Y }} />
    </div>
  )
}

const probeNodeTypes = { probe: ProbeNode }
const probeEdgeTypes = { flow: FlowEdge }

/** The two cards a flow edge runs between, on the lane, exactly one PITCH_X apart. */
const PROBE_NODES: Node[] = [
  {
    id: "a",
    type: "probe",
    position: { x: 0, y: CANVAS_LAYOUT.LANE_Y },
    data: {},
    style: { width: CANVAS_LAYOUT.NODE_WIDTH, height: CANVAS_LAYOUT.NODE_MIN_HEIGHT },
  },
  {
    id: "b",
    type: "probe",
    position: { x: CANVAS_LAYOUT.PITCH_X, y: CANVAS_LAYOUT.LANE_Y },
    data: {},
    style: { width: CANVAS_LAYOUT.NODE_WIDTH, height: CANVAS_LAYOUT.NODE_MIN_HEIGHT },
  },
]

/** `WorkflowCanvas`'s own `EDGE_STYLE[flow]`, so the comparison uses the real stroke. */
const FLOW_STYLE = { stroke: "hsl(var(--border))", strokeWidth: 2 }

/** `WorkflowCanvas`'s own `DEFAULT_EDGE_OPTIONS`, so the comparison uses the real marker. */
const PROBE_EDGE_OPTIONS: DefaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "hsl(var(--border))" },
}

/**
 * Render one edge in the probe harness.
 *
 * `armed: "none"` omits the key entirely — the ORDINARY state, and the one every
 * shipped canvas is in. Passing `type: undefined` reproduces the pre-185-10 edge.
 */
async function renderEdge(opts: { typed: boolean; armed?: boolean }) {
  const data: CanvasEdgeData = { kind: "flow", ...(opts.armed === undefined ? {} : { armed: opts.armed }) }
  const edge: Edge = {
    id: "seq:a->b",
    source: "a",
    target: "b",
    style: FLOW_STYLE,
    data,
    ...(opts.typed ? { type: "flow" } : {}),
  }
  const view = render(
    <div style={{ width: 1200, height: 800 }}>
      <ReactFlow
        nodes={PROBE_NODES}
        edges={[edge]}
        nodeTypes={probeNodeTypes}
        edgeTypes={probeEdgeTypes}
        defaultEdgeOptions={PROBE_EDGE_OPTIONS}
        fitView={false}
      />
    </div>,
  )
  // The mocked ResizeObserver fires on a `setTimeout(…, 0)`, so a synchronous read runs
  // before the observer callback and is unreliable (`mockReactFlow.ts:22-24`).
  await waitFor(() => {
    expect(view.container.querySelectorAll(".react-flow__edge-path").length).toBeGreaterThan(0)
  })
  return view
}

/** The one drawn edge path — the element the library's own `BaseEdge` classes. */
function edgePath(container: HTMLElement): SVGPathElement {
  const paths = container.querySelectorAll<SVGPathElement>(".react-flow__edge-path")
  expect(paths).toHaveLength(1)
  return paths[0]
}

/** Every `d` drawn anywhere inside the rendered edge, marks included. */
function allPathDs(container: HTMLElement): (string | null)[] {
  return Array.from(container.querySelectorAll("path")).map((p) => p.getAttribute("d"))
}

// ── 1 · The no-visible-change guard (D-185-18's required criterion) ─────────────

describe("FlowEdge — an ordinary flow edge renders identically to today (D-185-18)", () => {
  it("draws the SAME path, stroke and arrowhead as the library's default renderer", async () => {
    // BEFORE — captured from the shipped default rendering, in this run: an edge with no
    // `type` is exactly the pre-185-10 edge and routes through `builtinEdgeTypes.default`.
    const before = await renderEdge({ typed: false })
    const beforePath = edgePath(before.container)
    const beforeD = beforePath.getAttribute("d")
    const beforeStroke = beforePath.getAttribute("style")
    const beforeMarker = beforePath.getAttribute("marker-end")
    before.unmount()

    // Non-vacuity: a null `d` would make every comparison below trivially true.
    expect(beforeD).toBeTruthy()
    expect(beforeMarker).toBeTruthy()

    // AFTER — the same harness, one thing changed: the edge now carries `type: "flow"`
    // and therefore renders through `FlowEdge`.
    const after = await renderEdge({ typed: true })
    const afterPath = edgePath(after.container)

    expect(afterPath.getAttribute("d")).toBe(beforeD)
    expect(afterPath.getAttribute("style")).toBe(beforeStroke)
    expect(afterPath.getAttribute("marker-end")).toBe(beforeMarker)
  })

  it("keeps the library's invisible interaction path, so hit-testing is unchanged", async () => {
    const before = await renderEdge({ typed: false })
    const beforeCount = before.container.querySelectorAll(".react-flow__edge-interaction").length
    before.unmount()
    expect(beforeCount).toBe(1)

    const after = await renderEdge({ typed: true })
    expect(after.container.querySelectorAll(".react-flow__edge-interaction")).toHaveLength(1)
  })

  it("adds NO detour to an ordinary connector — the state every shipped canvas is in", async () => {
    const { container } = await renderEdge({ typed: true })
    expect(container.querySelectorAll('[data-testid="canvas-detour"]')).toHaveLength(0)
    expect(allPathDs(container)).not.toContain(ARC)
    expect(allPathDs(container)).not.toContain(LINE)
  })
})

// ── 2 · Armed vs open ───────────────────────────────────────────────────────────

describe("FlowEdge — the armed detour", () => {
  it("makes the ARC the path and lets NO straight line run past it", async () => {
    const { container } = await renderEdge({ typed: true, armed: true })

    // The arc IS the path — the library's own edge-path element carries it.
    expect(edgePath(container).getAttribute("d")).toBe(ARC)

    // …and nothing anywhere in this edge draws the straight line through the gap. If a
    // line ran past the arc the flow would appear to bypass the person, which is the one
    // reading the shape exists to deny.
    expect(allPathDs(container)).not.toContain(LINE)

    // The person-point, and the box it lives in.
    const detour = screen.getByTestId("canvas-detour")
    expect(detour.getAttribute("data-armed")).toBe("true")
    expect(detour.getAttribute("data-detour-box")).toBe(`${DETOUR.GAP}x${DETOUR_BOX_HEIGHT}`)
    expect(screen.getByTestId("canvas-detour-point")).toBeTruthy()
  })

  it("draws the armed arc with the SOLID stroke, not the ghost's", async () => {
    await renderEdge({ typed: true, armed: true })
    const arc = screen.getByTestId("canvas-detour-arc")
    expect(arc.getAttribute("stroke")).toBe("hsl(220 30% 100% / .62)")
    expect(arc.getAttribute("stroke-width")).toBe("2")
    expect(arc.getAttribute("stroke-dasharray")).toBeNull()
  })
})

describe("FlowEdge — the open checkpoint is present, never absent", () => {
  it("draws the ghost ARC and the LINE straight through it", async () => {
    const { container } = await renderEdge({ typed: true, armed: false })

    // Both are present: the checkpoint is visibly there and visibly open.
    expect(allPathDs(container)).toContain(ARC)
    expect(edgePath(container).getAttribute("d")).toBe(LINE)
    expect(screen.getByTestId("canvas-detour").getAttribute("data-armed")).toBe("false")
  })

  it("draws the ghost arc and point DASHED and faint", async () => {
    await renderEdge({ typed: true, armed: false })
    const arc = screen.getByTestId("canvas-detour-arc")
    expect(arc.getAttribute("stroke")).toBe("hsl(220 30% 100% / .17)")
    expect(arc.getAttribute("stroke-dasharray")).toBe("3 3")

    const point = screen.getByTestId("canvas-detour-point")
    expect(point.getAttribute("stroke")).toBe("hsl(220 30% 100% / .2)")
    expect(point.getAttribute("stroke-dasharray")).toBe("2 2")
  })

  it("keeps the arrowhead on the owned line, so an open checkpoint still points at the step", async () => {
    const { container } = await renderEdge({ typed: true, armed: false })
    expect(edgePath(container).getAttribute("marker-end")).toBeTruthy()
  })
})

// ── 3 · Criterion 24 — the mark is a signal, never a control ────────────────────

/**
 * The four attribute spellings that could turn the mark into a second tab stop,
 * ASSEMBLED FROM FRAGMENTS. Spelling them whole here would put them in a file a future
 * whole-tree grep reads, and — worse — would tempt someone to satisfy the fence by
 * editing prose rather than code (the D-ITEM-183-02 trap).
 */
const FOCUSABLE_TOKENS = [
  ["role", "="].join(""),
  ["tab", "Index"].join(""),
  ["on", "Click"].join(""),
  ["on", "Pointer"].join(""),
]

/** An armed 3-step canvas: `docQaHuman` with a checkpoint on the middle step. */
const docQaHumanArmed: PhaseSpecJSON[] = docQaHuman.map((phase) =>
  phase.slug === "confirm" ? { ...phase, action_risk_armed: true } : phase,
)

describe("FlowEdge — the mark carries no control (criterion 24, T-185-10-01)", () => {
  it("names none of the focusable attribute spellings in its own source", () => {
    // POSITIVE CONTROL first: the tokens are real, findable strings in this tree's source,
    // so an empty result below is evidence rather than a broken matcher.
    const foundInCanvas = FOCUSABLE_TOKENS.filter((t) => workflowCanvasSource.includes(t))
    expect(foundInCanvas.length).toBeGreaterThan(0)

    expect(FOCUSABLE_TOKENS.filter((t) => flowEdgeSource.includes(t))).toEqual([])
  })

  it("renders no role, no tab index and no click handler anywhere in the detour", async () => {
    await renderEdge({ typed: true, armed: true })
    const detour = screen.getByTestId("canvas-detour")

    // Non-vacuity: the subtree really has marks in it to walk.
    expect(detour.querySelectorAll("path, circle, text").length).toBeGreaterThan(0)

    expect(detour.querySelectorAll("[role], [tabindex], [onclick], button, a")).toHaveLength(0)
    expect(detour.getAttribute("role")).toBeNull()
    expect(detour.getAttribute("tabindex")).toBeNull()
  })

  it("makes every drawn mark inert to the pointer", async () => {
    await renderEdge({ typed: true, armed: true })
    for (const testId of ["canvas-detour-arc", "canvas-detour-point", "canvas-detour-label"]) {
      expect(screen.getByTestId(testId).getAttribute("pointer-events")).toBe("none")
    }
  })

  it("leaves exactly one tab stop per node on a canvas carrying an armed step", async () => {
    // The container-query walk copied from `WorkflowCanvas.test.tsx:253-260`, non-vacuity
    // guard included — that guard is the reason the loop means anything.
    const { container } = render(
      <div style={{ width: 1200, height: 800 }}>
        <WorkflowCanvas
          phases={docQaHumanArmed}
          selectedSlug={null}
          onSelectNode={vi.fn()}
          onClearSelection={vi.fn()}
        />
      </div>,
    )

    await waitFor(() => {
      expect(container.querySelectorAll(".react-flow__edge").length).toBeGreaterThan(0)
    })

    // NON-VACUITY, twice: the nodes exist, AND the detour this test exists for is really
    // on the canvas. Without the second guard an `armed` that stopped being threaded
    // would leave this test green while testing nothing.
    const nodes = Array.from(container.querySelectorAll(".react-flow__node"))
    expect(nodes.length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-testid="canvas-detour"]')).toHaveLength(1)

    expect(container.querySelectorAll('.react-flow__node[tabindex="0"]')).toHaveLength(
      docQaHumanArmed.length,
    )
    for (const node of nodes) {
      expect(node.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
    }
  })

  it("marks the connector INTO the armed step and no other", async () => {
    // The negative half: the same definition with nothing armed marks nothing, which is
    // what makes the assertion above evidence about `armed` rather than about a detour
    // that renders on every connector.
    const { container } = render(
      <div style={{ width: 1200, height: 800 }}>
        <WorkflowCanvas
          phases={docQaHuman}
          selectedSlug={null}
          onSelectNode={vi.fn()}
          onClearSelection={vi.fn()}
        />
      </div>,
    )
    await waitFor(() => {
      expect(container.querySelectorAll(".react-flow__edge").length).toBeGreaterThan(0)
    })
    expect(container.querySelectorAll('[data-testid="canvas-detour"]')).toHaveLength(0)
  })
})

// ── 4 · Clearance — computed from the transcribed curve, not asserted ───────────

/** Sample a cubic Bézier at `t`. */
function cubicAt(p: number[][], t: number): [number, number] {
  const u = 1 - t
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
  return [
    w[0] * p[0][0] + w[1] * p[1][0] + w[2] * p[2][0] + w[3] * p[3][0],
    w[0] * p[0][1] + w[1] * p[1][1] + w[2] * p[2][1] + w[3] * p[3][1],
  ]
}

/**
 * Sample the ARC by PARSING the exported constant rather than by re-typing its numbers,
 * so an edit to the transcription is re-measured here instead of silently escaping.
 */
function sampleArc(steps = 2000): [number, number][] {
  const n = (ARC.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  expect(n).toHaveLength(14) // M + two cubics = 7 points
  const pts: number[][] = []
  for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]])
  const cubics = [pts.slice(0, 4), [pts[3], pts[4], pts[5], pts[6]]]
  const out: [number, number][] = []
  for (const c of cubics) {
    for (let i = 0; i <= steps; i++) out.push(cubicAt(c, i / steps))
  }
  return out
}

describe("FlowEdge — the arc clears the ＋ and lives in the gap", () => {
  // The ＋'s box, read from the SAME table `WorkflowCanvas` positions it with.
  const half = EDIT_AFFORDANCE.INSERT_SIZE / 2
  const boxLeft = DETOUR.GAP / 2 - half
  const boxRight = DETOUR.GAP / 2 + half
  const boxBottom = DETOUR.INSERT_Y + half

  it("never enters the ＋'s box, with a measured minimum clearance of at least 8px", () => {
    const inRange = sampleArc().filter(([x]) => x >= boxLeft && x <= boxRight)
    expect(inRange.length).toBeGreaterThan(0) // non-vacuity

    const minY = Math.min(...inRange.map(([, y]) => y))
    // Every sample under the ＋ is BELOW its bottom edge — the curve never enters the box.
    for (const [, y] of inRange) expect(y).toBeGreaterThan(boxBottom)

    const clearance = minY - boxBottom
    expect(clearance).toBeGreaterThanOrEqual(8)
    // The sketch computed 8.2px; anything materially different means the shape moved.
    expect(clearance).toBeLessThan(9)
  })

  it("lives entirely inside the 60×88 detour box", () => {
    for (const [x, y] of sampleArc()) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(DETOUR.GAP)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(DETOUR_BOX_HEIGHT)
    }
  })

  it("starts and ends ON the connector line, so the arc can BE the path", () => {
    const samples = sampleArc()
    expect(samples[0]).toEqual([0, DETOUR.INSERT_Y])
    expect(samples[samples.length - 1]).toEqual([DETOUR.GAP, DETOUR.INSERT_Y])
  })
})

// ── 5 · The labels ──────────────────────────────────────────────────────────────

describe("FlowEdge — the two labels", () => {
  it("renders the armed label character-identically to its exported constant", async () => {
    await renderEdge({ typed: true, armed: true })
    expect(screen.getByTestId("canvas-detour-label").textContent).toBe(DETOUR_ARMED_LABEL)
  })

  it("renders the open label character-identically to its exported constant", async () => {
    await renderEdge({ typed: true, armed: false })
    expect(screen.getByTestId("canvas-detour-label").textContent).toBe(DETOUR_OPEN_LABEL)
  })

  it("uses none of SPEC Req 7's banned terms", () => {
    const banned = /\b(Proven|Ungoverned|Unchecked|Not applicable|N\/A)\b/i
    expect(DETOUR_ARMED_LABEL).not.toMatch(banned)
    expect(DETOUR_OPEN_LABEL).not.toMatch(banned)
    // Positive control: the matcher really does catch a banned term.
    expect("Proven").toMatch(banned)
  })
})

// ── 6 · The geometry drift pin (load-bearing — see the suite header) ────────────

describe("FlowEdge — DETOUR is the same gap EDIT_AFFORDANCE describes", () => {
  it("derives GAP and INSERT_Y to the same numbers WorkflowCanvas does", () => {
    expect(DETOUR.GAP).toBe(EDIT_AFFORDANCE.GAP)
    expect(DETOUR.INSERT_Y).toBe(EDIT_AFFORDANCE.INSERT_Y)
  })

  it("agrees with the ONE frozen layout table both derive from", () => {
    expect(DETOUR.GAP).toBe(CANVAS_LAYOUT.PITCH_X - CANVAS_LAYOUT.NODE_WIDTH)
    expect(DETOUR.INSERT_Y).toBe(CANVAS_LAYOUT.LANE_Y + CANVAS_LAYOUT.EDGE_ANCHOR_Y)
  })

  it("holds the box size the verbatim transcription is only valid at", () => {
    // ARC's interior control points (14, 16, 30, 44, 46) are the sketch's literals, so
    // the transcription is correct ONLY while the box is 60 wide with the line at 28.
    // Pinning that here is what makes "transcribed, not re-derived" a safe instruction.
    expect(DETOUR.GAP).toBe(60)
    expect(DETOUR.INSERT_Y).toBe(28)
    expect(ARC).toBe("M0,28 C14,28 16,62 30,62 C44,62 46,28 60,28")
    expect(LINE).toBe("M0,28 L60,28")
  })
})
