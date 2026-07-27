/**
 * Phase 184-10 Task 3 (CANVAS-02 · D-184-09 · D-184-10 · VALID-03) — the editing
 * surface's proof suite.
 *
 * NET-NEW, AND IT ABSORBS NOTHING. `WorkflowCanvas.test.tsx` keeps all 31 of its
 * assertions and is not touched by this plan: it pins the READ-ONLY surface, which
 * still exists and is still the default. This file pins the second mode. Two files,
 * two modes — a "consolidation" that folded one into the other would be exactly the
 * coverage loss the D-184-08 count gate exists to catch.
 *
 * ⚠ THE DRIVER RULE, written out so nobody has to re-discover it. Every interaction
 * INSIDE the plane is driven with `fireEvent` and with NOTHING ELSE — in particular
 * never with `@testing-library`'s user-simulation driver, the one the shipped spine
 * suite uses. That driver's click also dispatches a real `mousedown`, which reaches
 * d3-zoom's pan handler; d3-drag then dereferences `event.view.document`, and jsdom's
 * synthetic `MouseEvent` carries a null `view`. The result is the failure mode plan
 * 183-01 named "a gate that lies": every assertion passes, three unhandled
 * `TypeError`s fire from OUTSIDE the test body, and vitest still exits 1. So the EXIT
 * CODE is what this suite is checked against, not the pass count.
 *
 * (That driver is named by description rather than by its package identifier on
 * purpose. The acceptance check for this rule is a grep for the identifier expecting
 * ZERO — so writing it here, in the paragraph that forbids it, is the self-match trap
 * this phase has now hit six times. The concept is what a reader needs; the literal is
 * what the grep must not find.)
 *
 * ⚠ AND THE COROLLARY: d3-drag is unusable in jsdom, so THE REAL POINTER GESTURE IS
 * NOT TESTED HERE. It is live-only UAT row U-2 (a G-4 row). What is tested is the
 * RESOLVER WIRING — `onNodeDragStop` invoked directly on the prop the component hands
 * the library, with the axis split's two outcomes asserted separately. The axis split
 * ITSELF is a pure-function proof in `definitionOps.test.ts` (184-02). Faking a drag
 * and calling it evidence of the gesture is the one thing this file must not do, and
 * the reason it does not is written here rather than left to be inferred.
 *
 * HOW THE PROP IS REACHED. `@xyflow/react` is partially mocked: `ReactFlow` is wrapped
 * so its props are captured, and then the REAL `ReactFlow` is rendered with those same
 * props. Everything else in the module — `Handle`, `Background`, `Controls`, the
 * provider — is the genuine article, so every other assertion in this file runs against
 * a really-rendered plane rather than against a stub.
 */
import { createElement } from "react"
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, type MockInstance } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

// FILE-LOCAL, never setupTests.ts — the helper mutates HTMLElement.prototype and a
// global install would perturb all ~205 suites (WorkflowCanvas.test.tsx:26-28).
import { mockReactFlow } from "@/test-utils/mockReactFlow"
import { WorkflowCanvas } from "./WorkflowCanvas"
import type { CanvasNode } from "./canvasModel"
import { VERDICT_DESTRUCTIVE_TOKEN, VERDICT_MARK } from "./nodePresentation"
import { evalCoverage, unresolvableSkip } from "./__fixtures__/canvasFixtures"

/** The captured `ReactFlow` props. `vi.hoisted` because `vi.mock` is hoisted above
 *  every other statement in this file. */
const flow = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }))

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>()
  return {
    ...actual,
    ReactFlow: (props: Record<string, unknown>) => {
      flow.props = props
      return createElement(actual.ReactFlow as never, props as never)
    },
  }
})

mockReactFlow()

/** R3's tripwire: a cosmetic nudge must reach the network zero times. Whole-suite, so
 *  the claim covers every path this file drives, not only the one that names it. */
let fetchSpy: MockInstance

beforeAll(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch")
})

afterAll(() => {
  fetchSpy.mockRestore()
})

beforeEach(() => {
  flow.props = null
  window.localStorage.clear()
})

type Marks = (slug: string) => "error" | "incomplete" | "unknown" | undefined

function renderCanvas(
  phases: typeof evalCoverage,
  opts: {
    editable?: boolean
    selectedSlug?: string | null
    marks?: Marks
    nudges?: Record<string, number>
    onNudge?: (slug: string, dy: number) => void
    onCommitNodes?: (nodes: readonly CanvasNode[]) => void
  } = {},
) {
  return render(
    <div style={{ width: 1200, height: 800 }}>
      <WorkflowCanvas
        phases={phases}
        selectedSlug={opts.selectedSlug ?? null}
        onSelectNode={vi.fn()}
        onClearSelection={vi.fn()}
        editable={opts.editable}
        marks={opts.marks}
        nudges={opts.nudges}
        onNudge={opts.onNudge}
        onCommitNodes={opts.onCommitNodes}
      />
    </div>,
  )
}

/** The lane centres `toCanvas` lays `evalCoverage` out on — 5 phases at a 320 pitch. */
const LANE_X = [0, 320, 640, 960, 1280]

/** A minimal drag payload. `onNodeDragStop` reads exactly these three fields. */
function draggedNode(id: string, position: { x: number; y: number }) {
  return { id, type: "phase", position, data: {} } as unknown as CanvasNode
}

/** Invoke the drag lifecycle on the props the component handed the library. */
function drag(from: { x: number; y: number }, to: { x: number; y: number }, id = "fanout") {
  const onDragStart = flow.props?.onNodeDragStart as
    | ((e: unknown, n: CanvasNode, ns: CanvasNode[]) => void)
    | undefined
  const onDragStop = flow.props?.onNodeDragStop as
    | ((e: unknown, n: CanvasNode, ns: CanvasNode[]) => void)
    | undefined
  expect(onDragStart).toBeTypeOf("function")
  expect(onDragStop).toBeTypeOf("function")

  const start = draggedNode(id, from)
  const stop = draggedNode(id, to)
  act(() => {
    onDragStart!({}, start, [start])
    onDragStop!({}, stop, [stop])
  })
}

const slugsOf = (nodes: readonly CanvasNode[]) =>
  nodes.filter((n) => n.type === "phase").map((n) => n.id)

const destructiveCount = (html: string) => html.split(VERDICT_DESTRUCTIVE_TOKEN).length - 1

// ── 1-2. The editable switch, and what it flips ────────────────────────────────

describe("WorkflowCanvas — editable is the switch, and it flips exactly one thing", () => {
  it("editable=false renders NO draggable node and no announcer (the shipped surface)", () => {
    const { container } = renderCanvas(evalCoverage)

    expect(container.querySelectorAll(".react-flow__node.draggable")).toHaveLength(0)
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(0)
    expect(screen.queryByTestId("canvas-announcer")).toBeNull()
    // …and the read-only promise is still on screen, unchanged.
    expect(screen.getByText(/view only/i)).toBeInTheDocument()
  })

  it("editable=true marks every PHASE node draggable and leaves the cap and stub inert", () => {
    const { container } = renderCanvas(unresolvableSkip, { editable: true })

    const draggables = Array.from(container.querySelectorAll(".react-flow__node.draggable"))
    const draggableIds = draggables.map((el) => el.getAttribute("data-id"))
    expect(draggableIds.sort()).toEqual(unresolvableSkip.map((p) => p.slug).sort())

    // POSITIVE CONTROL: both reserved-id nodes are present in this fixture, and neither
    // of them got the flag — so the assertion above is a real filter, not a count.
    const cap = screen.getByTestId("canvas-end-cap").closest(".react-flow__node")
    const stub = screen.getByTestId("canvas-unresolved-skip").closest(".react-flow__node")
    expect(cap).not.toBeNull()
    expect(stub).not.toBeNull()
    expect(cap!.classList.contains("draggable")).toBe(false)
    expect(stub!.classList.contains("draggable")).toBe(false)
  })

  it("the five other read-only opt-outs are still off WHILE editable", () => {
    renderCanvas(evalCoverage, { editable: true })

    expect(flow.props?.nodesConnectable).toBe(false)
    expect(flow.props?.edgesReconnectable).toBe(false)
    expect(flow.props?.connectOnClick).toBe(false)
    expect(flow.props?.edgesFocusable).toBe(false)
    expect(flow.props?.deleteKeyCode).toBeNull()
    // …and the shell default too: the flip is per-node, on the node objects.
    expect(flow.props?.nodesDraggable).toBe(false)
  })

  it("the announced affordance names the alt-arrow binding ONLY on the editable surface", () => {
    const { container: readOnly } = renderCanvas(evalCoverage)
    const readOnlyDesc = readOnly.querySelector('[id^="react-flow__node-desc"]')
    expect(readOnlyDesc?.textContent ?? "").toMatch(/open this step's details/i)
    expect(readOnlyDesc?.textContent ?? "").not.toMatch(/arrow key/i)

    const { container: editing } = renderCanvas(evalCoverage, { editable: true })
    const editingDesc = editing.querySelector('[id^="react-flow__node-desc"]')
    expect(editingDesc?.textContent ?? "").toMatch(/open this step's details/i)
    expect(editingDesc?.textContent ?? "").toMatch(/alt/i)
    expect(editingDesc?.textContent ?? "").toMatch(/arrow key/i)
  })
})

// ── 3-7. The keyboard path (D-184-09) ──────────────────────────────────────────

describe("WorkflowCanvas — ⌥← / ⌥→ reorder the selected step", () => {
  it("⌥→ on a selected middle step commits ONCE with the expected order and SAYS so", () => {
    const onCommitNodes = vi.fn()
    const { container } = renderCanvas(evalCoverage, {
      editable: true,
      selectedSlug: "fanout",
      onCommitNodes,
    })

    const node = container.querySelector('.react-flow__node[data-id="fanout"]')!
    fireEvent.keyDown(node, { key: "ArrowRight", altKey: true })

    expect(onCommitNodes).toHaveBeenCalledTimes(1)
    expect(slugsOf(onCommitNodes.mock.calls[0][0])).toEqual([
      "split",
      "deep_dive",
      "fanout",
      "confirm",
      "summarize",
    ])
    expect(screen.getByTestId("canvas-announcer").textContent).toBe(
      "Step moved to position 3 of 5.",
    )
  })

  it("⌥← moves the other way, and the sentence follows the position", () => {
    const onCommitNodes = vi.fn()
    const { container } = renderCanvas(evalCoverage, {
      editable: true,
      selectedSlug: "confirm",
      onCommitNodes,
    })

    fireEvent.keyDown(container.querySelector('.react-flow__node[data-id="confirm"]')!, {
      key: "ArrowLeft",
      altKey: true,
    })

    expect(slugsOf(onCommitNodes.mock.calls[0][0])).toEqual([
      "split",
      "fanout",
      "confirm",
      "deep_dive",
      "summarize",
    ])
    expect(screen.getByTestId("canvas-announcer").textContent).toBe(
      "Step moved to position 3 of 5.",
    )
  })

  it("⌥← at position 0 commits nothing and announces nothing new", () => {
    const onCommitNodes = vi.fn()
    const { container } = renderCanvas(evalCoverage, {
      editable: true,
      selectedSlug: "split",
      onCommitNodes,
    })

    fireEvent.keyDown(container.querySelector('.react-flow__node[data-id="split"]')!, {
      key: "ArrowLeft",
      altKey: true,
    })

    expect(onCommitNodes).not.toHaveBeenCalled()
    expect(screen.getByTestId("canvas-announcer").textContent).toBe("")
  })

  it("⌥→ at the last position commits nothing and announces nothing new", () => {
    const onCommitNodes = vi.fn()
    const { container } = renderCanvas(evalCoverage, {
      editable: true,
      selectedSlug: "summarize",
      onCommitNodes,
    })

    fireEvent.keyDown(container.querySelector('.react-flow__node[data-id="summarize"]')!, {
      key: "ArrowRight",
      altKey: true,
    })

    expect(onCommitNodes).not.toHaveBeenCalled()
    expect(screen.getByTestId("canvas-announcer").textContent).toBe("")
  })

  it("ALT IS REQUIRED — a bare ArrowRight moves nothing", () => {
    const onCommitNodes = vi.fn()
    const { container } = renderCanvas(evalCoverage, {
      editable: true,
      selectedSlug: "fanout",
      onCommitNodes,
    })

    fireEvent.keyDown(container.querySelector('.react-flow__node[data-id="fanout"]')!, {
      key: "ArrowRight",
    })

    expect(onCommitNodes).not.toHaveBeenCalled()
    expect(screen.getByTestId("canvas-announcer").textContent).toBe("")
  })

  it("AUTO-REPEAT is one move, not thirty — a repeat keydown moves nothing", () => {
    const onCommitNodes = vi.fn()
    const { container } = renderCanvas(evalCoverage, {
      editable: true,
      selectedSlug: "fanout",
      onCommitNodes,
    })
    const node = container.querySelector('.react-flow__node[data-id="fanout"]')!

    fireEvent.keyDown(node, { key: "ArrowRight", altKey: true })
    fireEvent.keyDown(node, { key: "ArrowRight", altKey: true, repeat: true })
    fireEvent.keyDown(node, { key: "ArrowRight", altKey: true, repeat: true })

    expect(onCommitNodes).toHaveBeenCalledTimes(1)
  })

  it("YIELDS TO A TEXT FIELD — ⌥→ inside an input moves nothing", () => {
    const onCommitNodes = vi.fn()
    renderCanvas(evalCoverage, { editable: true, selectedSlug: "fanout", onCommitNodes })

    const field = document.createElement("input")
    document.body.appendChild(field)
    fireEvent.keyDown(field, { key: "ArrowRight", altKey: true })
    field.remove()

    expect(onCommitNodes).not.toHaveBeenCalled()
  })

  it("NO LISTENER AT REST — ⌥→ with nothing selected moves nothing", () => {
    const onCommitNodes = vi.fn()
    const { container } = renderCanvas(evalCoverage, { editable: true, onCommitNodes })

    fireEvent.keyDown(container.querySelector('.react-flow__node[data-id="fanout"]')!, {
      key: "ArrowRight",
      altKey: true,
    })

    expect(onCommitNodes).not.toHaveBeenCalled()
  })

  it("NO LISTENER WHILE READ-ONLY — ⌥→ on a selected node moves nothing", () => {
    const onCommitNodes = vi.fn()
    const { container } = renderCanvas(evalCoverage, {
      selectedSlug: "fanout",
      onCommitNodes,
    })

    fireEvent.keyDown(container.querySelector('.react-flow__node[data-id="fanout"]')!, {
      key: "ArrowRight",
      altKey: true,
    })

    expect(onCommitNodes).not.toHaveBeenCalled()
  })
})

// ── 8-9. The drag half, at the component level (D-184-10) ──────────────────────

describe("WorkflowCanvas — the drag axes carry two different meanings", () => {
  it("a PURELY VERTICAL drop nudges and does NOT touch the definition", () => {
    const onNudge = vi.fn()
    const onCommitNodes = vi.fn()
    renderCanvas(evalCoverage, { editable: true, onNudge, onCommitNodes })

    drag({ x: LANE_X[1], y: 0 }, { x: LANE_X[1], y: 64 })

    expect(onNudge).toHaveBeenCalledTimes(1)
    expect(onNudge).toHaveBeenCalledWith("fanout", 64)
    expect(onCommitNodes).not.toHaveBeenCalled()
  })

  it("a HORIZONTAL drop past half a pitch commits a reorder", () => {
    const onNudge = vi.fn()
    const onCommitNodes = vi.fn()
    renderCanvas(evalCoverage, { editable: true, onNudge, onCommitNodes })

    drag({ x: LANE_X[1], y: 0 }, { x: LANE_X[2], y: 0 })

    expect(onCommitNodes).toHaveBeenCalledTimes(1)
    expect(slugsOf(onCommitNodes.mock.calls[0][0])).toEqual([
      "split",
      "deep_dive",
      "fanout",
      "confirm",
      "summarize",
    ])
    // A flat drop has no vertical component at all, so nothing cosmetic is written.
    expect(onNudge).not.toHaveBeenCalled()
  })

  it("a drop SHORT of half a pitch is cosmetic only — the near-miss is not a reorder", () => {
    const onNudge = vi.fn()
    const onCommitNodes = vi.fn()
    renderCanvas(evalCoverage, { editable: true, onNudge, onCommitNodes })

    // 159px of a 320px pitch: one pixel short of the boundary.
    drag({ x: LANE_X[1], y: 0 }, { x: LANE_X[1] + 159, y: 12 })

    expect(onCommitNodes).not.toHaveBeenCalled()
    expect(onNudge).toHaveBeenCalledWith("fanout", 12)
  })

  it("the RESULTING offset is handed over, not this drag's delta (a nudge accumulates)", () => {
    const onNudge = vi.fn()
    renderCanvas(evalCoverage, { editable: true, nudges: { fanout: 40 }, onNudge })

    // The card is already 40px down, so the library reports the drag starting there.
    drag({ x: LANE_X[1], y: 40 }, { x: LANE_X[1], y: 90 })

    expect(onNudge).toHaveBeenCalledWith("fanout", 90)
  })

  it("R3 — a nudge-only drag issues ZERO network requests", () => {
    const onNudge = vi.fn()
    renderCanvas(evalCoverage, { editable: true, onNudge })

    drag({ x: LANE_X[1], y: 0 }, { x: LANE_X[1], y: 120 })

    expect(onNudge).toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ── 10. The verdict marks arrive as threaded data (VALID-03) ───────────────────

describe("WorkflowCanvas — verdict marks are threaded, never derived", () => {
  it("an `incomplete` mark renders the dashed grey ○ and spends ZERO destructive tokens", () => {
    const { container } = renderCanvas(evalCoverage, {
      editable: true,
      marks: (slug) => (slug === "fanout" ? "incomplete" : undefined),
    })

    const mark = screen.getByTestId("canvas-node-verdict")
    expect(mark.getAttribute("data-verdict")).toBe("incomplete")
    expect(mark.className).toContain("border-dashed")
    expect(mark.textContent).toContain(VERDICT_MARK.incomplete.glyph)
    expect(destructiveCount(container.innerHTML)).toBe(0)
  })

  it("POSITIVE CONTROL — an `error` mark puts the destructive token back", () => {
    const { container } = renderCanvas(evalCoverage, {
      editable: true,
      marks: (slug) => (slug === "fanout" ? "error" : undefined),
    })

    expect(screen.getByTestId("canvas-node-verdict").getAttribute("data-verdict")).toBe("error")
    expect(destructiveCount(container.innerHTML)).toBeGreaterThanOrEqual(1)
  })

  it("NO marks prop ⇒ no verdict element anywhere (the pre-check resting state)", () => {
    renderCanvas(evalCoverage, { editable: true })
    expect(screen.queryByTestId("canvas-node-verdict")).toBeNull()
  })

  it("the mark adds no focusable control — one tab stop per node still holds", () => {
    const { container } = renderCanvas(evalCoverage, {
      editable: true,
      marks: () => "error",
    })

    const nodes = Array.from(container.querySelectorAll(".react-flow__node"))
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(node.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
    }
  })
})

// ── 11. The nudge moves the card and nothing else ──────────────────────────────

describe("WorkflowCanvas — the cosmetic dy moves the card without touching the model", () => {
  it("the rendered card carries the offset while the input phases are UNMUTATED", () => {
    const before = structuredClone(evalCoverage)

    const { container } = renderCanvas(evalCoverage, {
      editable: true,
      nudges: { fanout: 48 },
    })

    const nudged = container.querySelector('.react-flow__node[data-id="fanout"]') as HTMLElement
    const still = container.querySelector('.react-flow__node[data-id="deep_dive"]') as HTMLElement
    expect(nudged.style.transform).toContain("48px")
    expect(still.style.transform).not.toContain("48px")

    // The projection's input is the definition. If a layout value could reach it, this
    // is where it would show up.
    expect(evalCoverage).toStrictEqual(before)
  })

  it("no node object handed to the library carries a nudge key of any kind", () => {
    renderCanvas(evalCoverage, { editable: true, nudges: { fanout: 48 } })

    const nodes = flow.props?.nodes as CanvasNode[]
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      const offending = Object.keys(node.data ?? {}).filter((k) => /dy|nudge|offset/i.test(k))
      expect(offending).toEqual([])
    }
  })
})
