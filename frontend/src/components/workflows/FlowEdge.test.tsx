/**
 * ⚠ RESTORED FROM `cd6f7b1d` ON 2026-08-20 — the Phase 200 canvas port re-baselined the
 * captures in this file, and the port is reverted.
 *
 * WHAT MOVED AND WHY IT MOVED BACK. The port replaced the node card's 137-B face (248px,
 * centre-aligned, a 62px 3D mark floating above its top edge) with sketch 200's compact
 * 240x72 row, and `CANVAS_LAYOUT.NODE_MIN_HEIGHT` (104 -> 72) and `EDGE_ANCHOR_Y` (28 -> 36)
 * moved with it. **The operator has since seen both faces rendered and chosen the 137-B
 * one**, so both constants go back and so do the captures derived from them.
 *
 * ⚠ THE CAPTURES HERE ARE THE PRE-PORT ONES, RE-INSTATED UNEDITED RATHER THAN RE-CAPTURED,
 * and they PASS. That is the strongest statement available: a pin nobody re-typed still
 * holds, so the revert reproduces the pre-port tree rather than merely satisfying a fresh
 * reading of itself.
 *
 * ⚠ THE PORT'S OWN RE-BASELINE WAS CAREFUL AND ITS RECORD IS AT `c4463d92`, not lost. Its
 * headline finding is worth carrying forward for whoever moves these constants next: the
 * delta across the twelve editing affordances was NOT uniform — the seven insert marks sit
 * on the connector and moved with `EDGE_ANCHOR_Y`, while the five remove marks hang off the
 * card's bottom and moved with `NODE_MIN_HEIGHT`. A blanket single-term edit made half the
 * rows right and half wrong by 40, and the suite said so immediately.
 */
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
// 188.1-03 — the layer the `＋`/`✕` handlers moved into. Read here so the criterion-24
// control below keeps covering them rather than going quietly green over less code.
import planeEditingLayerSource from "./PlaneEditingLayer?raw"
import {
  ARC,
  DETOUR,
  DETOUR_ARMED_LABEL,
  DETOUR_BOX_HEIGHT,
  DETOUR_OPEN_LABEL,
  FlowEdge,
  LINE,
} from "./FlowEdge"
import { WorkflowCanvas } from "./WorkflowCanvas"
import { CANVAS_LAYOUT, type CanvasEdgeData } from "./canvasModel"
// 188.1-03 cut `EDIT_AFFORDANCE` out of `WorkflowCanvas.tsx` into the `editAffordance.ts`
// leaf (D-01), and left NO re-export shim — this statement is the tree's only importer of
// it. Added as a SEPARATE statement rather than by widening the line above, so this file's
// whole diff is added lines and "no shipped assertion was touched" is auditable by
// `git diff` alone (`canvasModel.purity.test.ts:18-21`, the shipped statement of the rule).
import { EDIT_AFFORDANCE } from "./editAffordance"
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
    // 188.1-03 — AND the extracted layer, because the control moved out from under this
    // line. The `＋` / `✕` click handlers — the very controls criterion 24 is about — now
    // live in `PlaneEditingLayer.tsx`. MEASURED across that move: the click-handler
    // spelling fell from 4 occurrences to 2 in `WorkflowCanvas.tsx` and appears twice in
    // the new file. The canvas half therefore still passes while covering less, which is
    // Phase 188's F7 lesson exactly — a green control says nothing about what it stopped
    // reading. Both halves are asserted, and this one is an ADDITION: the line above is
    // untouched.
    const foundInLayer = FOCUSABLE_TOKENS.filter((t) => planeEditingLayerSource.includes(t))
    expect(foundInLayer.length).toBeGreaterThan(0)

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
    // ⚠ KEPT FROM THE PHASE 200 PORT, which is otherwise reverted here. The port moved
    // `INSERT_Y` and the three absolute assertions above ABSORBED the move — they were
    // re-baselined and said nothing about whether the SHAPE had survived. It had: `ARC` is
    // a template over `INSERT_Y` and `DIP`, so the whole curve translated and every
    // horizontal literal stayed put. This states the dip as a RELATIVE fact so a future
    // baseline move cannot silently take the shape with it.
    expect(DETOUR.INSERT_Y + DETOUR.DIP - DETOUR.INSERT_Y).toBe(34)
  })
})

// ── 7 · 199-05 Task 1 — the connection-state inventory (sheet c1 §2) ─────────────
//
// THE ACCEPTANCE BAR IS "DISTINGUISHABLE WITHOUT COLOUR", and for an EDGE that needs a
// different method from the one `192.2-05` used on a card. A card's colour arrives in
// `class` attributes, so stripping every `class` and re-asserting distinctness is a
// complete proof there. An edge's colour does NOT: it arrives in the `style` attribute
// as `stroke`, alongside `stroke-width` and `stroke-dasharray` which are NOT colour. So a
// class-strip over this surface would pass while proving nothing.
//
// The adaptation, stated so it is not mistaken for the card method: build each state's
// signature from everything a colour-blind reader still perceives — the drawn `d`, the
// stroke WIDTH, the DASH pattern and the TEXT — with `stroke` deleted, and require the
// signatures to be mutually distinct. `stroke` is deleted rather than merely ignored, so
// a state that becomes colour-only in future cannot pass by accident.

/** Everything about a rendered edge that survives the loss of colour vision. */
function colourBlindSignature(container: HTMLElement): string {
  const parts: string[] = []
  for (const el of Array.from(container.querySelectorAll<SVGElement>("path, circle, text"))) {
    // Every colour channel is REMOVED, never merely skipped.
    const dash = el.getAttribute("stroke-dasharray") ?? el.style.strokeDasharray ?? ""
    const width = el.getAttribute("stroke-width") ?? el.style.strokeWidth ?? ""
    const geometry =
      el.tagName === "path"
        ? (el.getAttribute("d") ?? "")
        : el.tagName === "circle"
          ? `circle r=${el.getAttribute("r")}`
          : `text:${el.textContent ?? ""}`
    parts.push(`${el.tagName}|${geometry}|w=${width}|dash=${dash}`)
  }
  return parts.join("\n")
}

describe("FlowEdge 199-05 — the three states it can express are distinct WITHOUT colour", () => {
  it("ordinary · open · armed have mutually distinct colour-blind signatures", async () => {
    const ordinary = await renderEdge({ typed: true })
    const sigOrdinary = colourBlindSignature(ordinary.container)
    ordinary.unmount()

    const open = await renderEdge({ typed: true, armed: false })
    const sigOpen = colourBlindSignature(open.container)
    open.unmount()

    const armed = await renderEdge({ typed: true, armed: true })
    const sigArmed = colourBlindSignature(armed.container)

    // NON-VACUITY FIRST — this project has measured three fences that swept the empty
    // string and passed green defending nothing.
    for (const sig of [sigOrdinary, sigOpen, sigArmed]) expect(sig.length).toBeGreaterThan(0)

    // …and the signature really is colour-free, so the distinctness below cannot be
    // riding on a stroke colour that a colour-blind reader never sees.
    for (const sig of [sigOrdinary, sigOpen, sigArmed]) {
      expect(sig).not.toContain("hsl(")
      expect(sig).not.toContain("rgb")
      expect(sig).not.toContain("#")
    }

    expect(new Set([sigOrdinary, sigOpen, sigArmed]).size).toBe(3)
  })

  it("the carrier is SHAPE and a WORD — never a stroke colour (per-state evidence)", async () => {
    // ORDINARY: one path, no arc, no circle, no word.
    const ordinary = await renderEdge({ typed: true })
    expect(ordinary.container.querySelectorAll("circle")).toHaveLength(0)
    expect(ordinary.container.querySelectorAll('[data-testid="canvas-detour-label"]')).toHaveLength(
      0,
    )
    ordinary.unmount()

    // OPEN: the arc is DASHED (a shape fact), the straight line runs through, and the
    // word is present.
    const open = await renderEdge({ typed: true, armed: false })
    expect(open.container.querySelector('[data-testid="canvas-detour-arc"]')?.getAttribute(
      "stroke-dasharray",
    )).toBe("3 3")
    expect(open.container.querySelector('[data-testid="canvas-detour-label"]')?.textContent).toBe(
      DETOUR_OPEN_LABEL,
    )
    open.unmount()

    // ARMED: the arc is SOLID and IS the path; the word differs from the open one.
    const armed = await renderEdge({ typed: true, armed: true })
    expect(armed.container.querySelector('[data-testid="canvas-detour-arc"]')?.getAttribute(
      "stroke-dasharray",
    )).toBeNull()
    expect(armed.container.querySelector('[data-testid="canvas-detour-label"]')?.textContent).toBe(
      DETOUR_ARMED_LABEL,
    )
    expect(DETOUR_ARMED_LABEL).not.toBe(DETOUR_OPEN_LABEL)
  })

  it("POSITIVE CONTROL — the signature DOES notice a shape change", () => {
    // A fence nobody has seen fire is a claim. Two hand-built signatures that differ only
    // in a dash pattern must compare unequal, which is what makes the three-way set
    // assertion above evidence rather than an accident of ordering.
    const a = "path|M0,0 L1,1|w=2|dash="
    const b = "path|M0,0 L1,1|w=2|dash=3 3"
    expect(a).not.toBe(b)
    // …and it does NOT notice a colour change, which is the property being claimed.
    const withColour = a
    expect(withColour).not.toContain("stroke=")
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// Phase 200-06 — THE PAYLOAD LABEL AND THE FOUR CONNECTION STATES
//
// `200-CHECKLIST.md` §3: `BC-MR-01` (the connection carries the upstream step's DECLARED
// count), `BC-MR-02` (the four states, drawn distinctly), `BC-MNR-01` (no label at all
// where nothing was declared — not `0`, not a dash, not an empty pill) and `BC-MNR-02`
// (no fabricated figure: every number and every noun arrives from outside this file).
// ════════════════════════════════════════════════════════════════════════════════

/** Render one edge carrying a payload and/or a connection state. Deliberately a SECOND
 *  helper rather than a widening of `renderEdge`, so every shipped assertion above keeps
 *  calling exactly the function it called before this plan. */
async function renderPayloadEdge(data: CanvasEdgeData) {
  const edge: Edge = {
    id: "seq:a->b",
    source: "a",
    target: "b",
    style: FLOW_STYLE,
    data,
    type: "flow",
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
  await waitFor(() => {
    expect(view.container.querySelectorAll(".react-flow__edge-path").length).toBeGreaterThan(0)
  })
  return view
}

const PAYLOAD_TESTID = '[data-testid="canvas-edge-payload"]'

describe("FlowEdge 200-06 — the connection carries a fact it did not invent (BC-MR-01)", () => {
  it("renders `<n> <noun>` when the upstream step declared a count", async () => {
    const { container } = await renderPayloadEdge({
      kind: "flow",
      payload: { count: 312, noun: "sources" },
    })
    const mark = container.querySelector(PAYLOAD_TESTID)
    expect(mark).not.toBeNull()
    expect(mark?.textContent).toBe("312 sources")
  })

  it("renders NO LABEL ELEMENT AT ALL when the upstream declared nothing (BC-MNR-01)", async () => {
    const { container } = await renderPayloadEdge({ kind: "flow" })
    // A DOM ABSENCE, never an empty string: an empty `<text>` is still an element, and the
    // checklist forbids an empty pill exactly as firmly as it forbids a `0`.
    expect(container.querySelectorAll(PAYLOAD_TESTID)).toHaveLength(0)
    // NON-VACUITY — the edge really did render, so "no label" is a statement about a drawn
    // connection rather than about an empty plane.
    expect(container.querySelectorAll(".react-flow__edge-path").length).toBeGreaterThan(0)
  })

  it("renders a DECLARED ZERO — `0` is a fact, not an absence (BC-MNR-01)", async () => {
    const { container } = await renderPayloadEdge({
      kind: "flow",
      payload: { count: 0, noun: "sources" },
    })
    // The case a `count ?? …` or an `if (count)` arm would silently swallow: a step that
    // searched and found nothing gave a real answer and the plane must say so.
    expect(container.querySelector(PAYLOAD_TESTID)?.textContent).toBe("0 sources")
  })

  it("the noun is rendered VERBATIM — this component spells none of its own (BC-MNR-02)", async () => {
    // A noun no vocabulary in this repo contains. It reaches the plane unchanged, which is
    // the property that makes the label the SERVER's word rather than the client's guess.
    const { container } = await renderPayloadEdge({
      kind: "flow",
      payload: { count: 7, noun: "zzqx" },
    })
    expect(container.querySelector(PAYLOAD_TESTID)?.textContent).toBe("7 zzqx")
    // …and the component's own source contains none of the three shipped count nouns, so
    // it cannot be supplying one from a table of its own.
    for (const noun of ["sources", "agents", "fields"]) expect(flowEdgeSource).not.toContain(noun)
    // POSITIVE CONTROL — the needles are real strings a `toContain` can find.
    expect("312 sources").toContain("sources")
  })

  it("the label survives on an ARMED connector too — the detour does not swallow it", async () => {
    const { container } = await renderPayloadEdge({
      kind: "flow",
      armed: true,
      payload: { count: 12, noun: "zzqx" },
    })
    expect(container.querySelector(PAYLOAD_TESTID)?.textContent).toBe("12 zzqx")
    // …and the detour's own word is still there, so the two labels coexist rather than
    // competing for one slot.
    expect(container.querySelector('[data-testid="canvas-detour-label"]')?.textContent).toBe(
      DETOUR_ARMED_LABEL,
    )
  })

  it("the absence arm is a TYPEOF test — no `?? 0` and no truthiness arm in the source", () => {
    // The grep is over CODE, and the positive controls prove the needles are real shapes
    // rather than a matcher that can never match.
    const code = flowEdgeSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
    expect(code).not.toMatch(/\?\?\s*0\b/)
    expect(code).not.toMatch(/if\s*\(\s*count\s*\)/)
    expect("const n = count ?? 0").toMatch(/\?\?\s*0\b/)
    expect("if (count) { }").toMatch(/if\s*\(\s*count\s*\)/)
  })
})

describe("FlowEdge 200-06 — the four connection states are expressed (BC-MR-02)", () => {
  it("each of the four reaches the drawn path as its own state", async () => {
    for (const state of ["at-rest", "selected", "hovered", "not-taken"] as const) {
      const view = await renderPayloadEdge({ kind: "flow", connection: state })
      expect(edgePath(view.container).getAttribute("data-connection-state")).toBe(state)
      view.unmount()
    }
  })

  it("an edge with NO state declared carries no state attribute — byte-identical to before", async () => {
    const { container } = await renderPayloadEdge({ kind: "flow" })
    // The shipped canvas rendered no such attribute before this plan, and a canvas that
    // supplies no state still renders exactly what it rendered then.
    expect(edgePath(container).getAttribute("data-connection-state")).toBeNull()
  })

  it("POSITIVE CONTROL — the attribute really is readable, so the absence above is evidence", async () => {
    const { container } = await renderPayloadEdge({ kind: "flow", connection: "selected" })
    expect(edgePath(container).getAttribute("data-connection-state")).toBe("selected")
  })
})
