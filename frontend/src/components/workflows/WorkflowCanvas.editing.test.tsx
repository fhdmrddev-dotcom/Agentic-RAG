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
import { createElement, useMemo } from "react"
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, type MockInstance } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { useStore } from "zustand"

// FILE-LOCAL, never setupTests.ts — the helper mutates HTMLElement.prototype and a
// global install would perturb all ~205 suites (WorkflowCanvas.test.tsx:26-28).
import { mockReactFlow } from "@/test-utils/mockReactFlow"
import { WorkflowCanvas } from "./WorkflowCanvas"
import type { CanvasNode } from "./canvasModel"
// Plan 184-12, on their OWN lines so this file's diff stays 0-deletion: the notice
// union the appended block renders, and the ONE stranding sentence, so the R10b
// assertion is character-identical to the pure module's constant rather than a copy.
import type { CanvasNotice } from "./WorkflowCanvas"
import { STRANDING_REASON, type PhaseTypeId } from "./definitionOps"
import { VERDICT_DESTRUCTIVE_TOKEN, VERDICT_MARK } from "./nodePresentation"
// Plan 188.2-02 (D-11), on their OWN line so this file's diff stays 0-deletion: the
// affordance stacking tier and the library elevation it has to beat — IMPORTED, never
// retyped, so lowering either constant turns the guard red instead of the guard agreeing
// with whatever the source now says.
import { AFFORDANCE_Z, SELECTED_NODE_Z_FROM_LIBRARY } from "./editAffordance"
import { evalCoverage, unresolvableSkip } from "./__fixtures__/canvasFixtures"
// Plan 186-07 (F12), on their OWN lines so this file's diff stays 0-deletion: the write
// loop, the store it watches, the browser-local nudge module the gesture really writes to,
// and the debounce constant — IMPORTED, never retyped, so the fence tracks the loop.
import { createBuilderStore, selectDefinition } from "./builderStore"
import { readNudges, writeNudge } from "./canvasNudge"
import { useDraftPersistence, AUTOSAVE_DEBOUNCE_MS } from "@/hooks/useDraftPersistence"
import { createWorkflowDraft, updateWorkflowDraft } from "@/lib/api"
import type { BuilderDefinition } from "@/pages/WorkflowBuilderPage"

/**
 * F12's OTHER half. `fetchSpy` alone cannot falsify the claim in this environment: the api
 * client's auth-header step rejects before it ever reaches `fetch` when no session exists,
 * so a nudge wrongly routed into the write path would raise no fetch and the fence would
 * stay green while the property was false. Spying on the two draft mutations closes that,
 * and the REAL module is spread so every other symbol the composed tree touches is the
 * genuine article (the mock-completeness idiom this file's own docblock states).
 */
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, createWorkflowDraft: vi.fn(), updateWorkflowDraft: vi.fn() }
})
const mockedCreate = vi.mocked(createWorkflowDraft)
const mockedUpdate = vi.mocked(updateWorkflowDraft)

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

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 184-12 — THE `＋` AND THE `✕`. Appended; nothing above this line was edited.
//
// WHAT THIS BLOCK MEASURES, AND WHAT IT DELIBERATELY DOES NOT.
//
// It measures the AFFORDANCES: where they live in the DOM, when they exist, what they
// open, which choices the menu declines and with what sentence, what the two notice
// treatments look like, and that the empty draft invites rather than showing a bare
// control. All of that is this component's own job and is decidable here.
//
// It does NOT measure what a delete does to `phase_index`, what the message's moved
// count is, or whether Undo restores. Those are not this component's behaviours —
// `WorkflowCanvas` holds no store, runs no predicate and computes no message; it asks
// the page and renders what comes back. Asserting them here would mean re-implementing
// the page's handlers inside a test and then measuring the copy, which is the "a gate
// that lies" failure this phase keeps naming. They are asserted where they actually
// live, in `WorkflowBuilderPage.canvas.test.tsx`, against the real store.
//
// The driver rule from the top of this file still applies: `fireEvent` only.
//
// ⚠ ONE STALE TITLE ABOVE, LEFT DELIBERATELY. The 184-10 block is named "editable is
// the switch, and it flips exactly one thing", and as of this plan that count is FOUR
// (per-node drag, this ＋/✕ layer, the notice region, the empty-draft invitation — the
// component's own docblock enumerates them). Its ASSERTIONS are all still exactly true
// and still measure what they were written to measure, so rewording it would spend an
// edit on a pre-existing file for a comment rather than a behaviour. Recorded here so
// the next reader is not misled by it, and so nobody "discovers" the drift and quietly
// widens that block instead of appending to this one.
// ═══════════════════════════════════════════════════════════════════════════════

/** A definition that ENDS with a deliverable — R10b needs one, and no shipped fixture
 *  carries an `llm_emit` (`__fixtures__/canvasFixtures.ts` stays untouched, D-184-17).
 *  The emit sits at render position 2, so 184-02's corrected STRICTLY-AFTER boundary is
 *  observable on both sides: index 2 is offered, index 3 is refused. */
const withDeliverable = [
  { slug: "zx-gather", phase_index: 0, config: { phase_type: "llm_agent" } },
  { slug: "zx-review", phase_index: 1, config: { phase_type: "llm_human_input" } },
  { slug: "zx-emit", phase_index: 2, config: { phase_type: "llm_emit" } },
] as unknown as typeof evalCoverage

/** The empty draft, hand-authored here for the same reason. */
const noPhases = [] as unknown as typeof evalCoverage

/** A SECOND render helper rather than widening the 184-10 one: this block needs three
 *  props that one does not take, and growing a shared helper is how a file's older
 *  assertions quietly start exercising a different component than they were written
 *  for. Purely additive. */
function renderEditable(
  phases: typeof evalCoverage,
  opts: {
    editable?: boolean
    onInsertAt?: (index: number, type: PhaseTypeId) => void
    onRequestRemove?: (slug: string) => void
    notice?: CanvasNotice | null
    width?: number
  } = {},
) {
  return render(
    <div style={{ width: opts.width ?? 1200, height: 800 }}>
      <WorkflowCanvas
        phases={phases}
        selectedSlug={null}
        onSelectNode={vi.fn()}
        onClearSelection={vi.fn()}
        editable={opts.editable ?? true}
        onInsertAt={opts.onInsertAt}
        onRequestRemove={opts.onRequestRemove}
        notice={opts.notice}
      />
    </div>,
  )
}

// ── 12. The affordances exist only when editable, and live OUTSIDE the node DOM ──

describe("WorkflowCanvas 184-12 — the ＋ / ✕ layer is on the plane, never in a node", () => {
  it("editable=false renders NEITHER affordance and no notice region", () => {
    const { container } = renderEditable(evalCoverage, {
      editable: false,
      // Supplied on purpose: a read-only canvas that rendered this would be a surface
      // change on the flag-off path, which D-181-01 forbids outright.
      notice: {
        kind: "action",
        lead: "Removed",
        subject: "Write it up",
        detail: "1 step renumbered",
      },
    })

    expect(container.querySelectorAll('[data-canvas-affordance="insert"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-canvas-affordance="remove"]')).toHaveLength(0)
    expect(screen.queryByTestId("canvas-notice-action")).toBeNull()
    expect(screen.queryByTestId("canvas-notice-refusal")).toBeNull()
    // …and the shipped read-only promise is still the one on screen.
    expect(screen.getByText(/view only/i)).toBeInTheDocument()
  })

  it("editable=true renders one ＋ per boundary and one ✕ per phase", () => {
    const { container } = renderEditable(evalCoverage)

    // Five phases ⇒ six boundaries: before the first, four connectors, after the last.
    expect(container.querySelectorAll('[data-canvas-affordance="insert"]')).toHaveLength(
      evalCoverage.length + 1,
    )
    expect(container.querySelectorAll('[data-canvas-affordance="remove"]')).toHaveLength(
      evalCoverage.length,
    )
    for (const phase of evalCoverage) {
      expect(screen.getByTestId(`canvas-remove-${phase.slug}`)).toBeInTheDocument()
    }
  })

  it("every ＋ and every ✕ has a NULL `.react-flow__node` ancestor", () => {
    renderEditable(evalCoverage)

    for (let index = 0; index <= evalCoverage.length; index += 1) {
      const insert = screen.getByTestId(`canvas-insert-${index}`)
      expect(insert.closest(".react-flow__node")).toBeNull()
    }
    for (const phase of evalCoverage) {
      const remove = screen.getByTestId(`canvas-remove-${phase.slug}`)
      expect(remove.closest(".react-flow__node")).toBeNull()
    }
    // POSITIVE CONTROL for the query itself. `closest` returning null is the assertion,
    // and it would also return null if the selector were misspelled or if the library
    // stopped emitting that class — in which case every line above would pass while
    // measuring nothing. Something in this render MUST report a non-null ancestor.
    expect(screen.getByTestId("canvas-node-split").closest(".react-flow__node")).not.toBeNull()
  })

  it("the shipped no-focusable-control-inside-a-node invariant holds WITH both affordances mounted", () => {
    // `WorkflowCanvas.test.tsx:231-238`, re-asserted here because that suite never
    // renders the editable surface — the invariant it pins is exactly the constraint
    // that decides where this plan's controls had to go.
    const { container } = renderEditable(evalCoverage)

    const nodes = Array.from(container.querySelectorAll(".react-flow__node"))
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(node.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
    }
    // POSITIVE CONTROL: the buttons DO exist — the loop above is not passing because
    // nothing was rendered.
    expect(container.querySelectorAll("[data-canvas-affordance]").length).toBeGreaterThan(0)
  })

  it("the ✕ is the delete path — Backspace still is not", () => {
    renderEditable(evalCoverage)
    expect(flow.props?.deleteKeyCode).toBeNull()
  })

  it("the ＋ is present WITHOUT a hover event and is not hidden behind a bare hover class", () => {
    // Narrow / touch (Claude's discretion, recorded in CONTEXT): a hover-only affordance
    // on a device that cannot hover is an affordance that does not exist. The renderer
    // applies no CSS, so the claim is made against the class list: the VISIBLE state is
    // the base one and every hiding class is scoped under a min-width breakpoint.
    renderEditable(evalCoverage, { width: 720 })

    const insert = screen.getByTestId("canvas-insert-1")
    const classes = insert.className.split(/\s+/)
    expect(classes).toContain("opacity-100")
    expect(classes).not.toContain("opacity-0")
    expect(classes).toContain("lg:opacity-0")
    expect(classes).toContain("[@media(hover:none)]:opacity-100")
  })
})

// ── 12b. The affordances outrank a SELECTED card (188.2-02 · D-11 · BUG-260806-01) ──

// WHY THIS BLOCK ASSERTS A RELATION AND NOT A HIT TEST, written out so nobody later
// "improves" it into something that cannot work. jsdom applies no CSS, computes no
// stacking contexts, and lays nothing out; `.click()` and `fireEvent.click()` dispatch
// straight to the element and bypass hit-testing entirely. So NO UNIT TEST IN THIS ESTATE
// CAN SEE OCCLUSION — this file included, and that is exactly why `BUG-260806-01` survived
// from 184-12 until an operator found it by hand during 188.1's UAT with all 58 of these
// tests green.
//
// The defect is therefore guarded BOTH ways, and neither half is sufficient alone:
//
//   · A DRIVEN `document.elementFromPoint` row with the card SELECTED — the only thing
//     that can observe the real failure. It is owed to Board B and driven in Plan 07.
//     But a driven row is a ONE-TIME PHOTOGRAPH: it says the pixel was right on the day
//     somebody looked, and says nothing on any day after.
//   · THIS BLOCK, which re-runs on every build. It cannot see the pixel, so instead it
//     pins the three things the pixel depends on: the relation between our tier and the
//     library's, the library's elevation still being what we think it is, and our tier
//     actually reaching the DOM.
//
// D-11 requires BOTH NUMBERS NAMED AS LITERALS here rather than derived from each other.
// A test that only asserted `AFFORDANCE_Z > SELECTED_NODE_Z_FROM_LIBRARY` would stay green
// if both constants were edited together, which is the one edit most likely to happen.
describe("WorkflowCanvas 188.2-02 — the ＋ / ✕ / picker outrank a selected card", () => {
  it("AFFORDANCE_Z sits above the library's selected-node elevation, both numbers named", () => {
    expect(AFFORDANCE_Z).toBeGreaterThan(SELECTED_NODE_Z_FROM_LIBRARY)
    // Named, not derived — see the block header.
    expect(AFFORDANCE_Z).toBe(1002)
    expect(SELECTED_NODE_Z_FROM_LIBRARY).toBe(1000)
  })

  it("the LIBRARY still elevates a selected node to exactly that number", () => {
    // THE POSITIVE CONTROL, against `@xyflow` changing its own constant on an upgrade.
    // `SELECTED_NODE_Z` is declared in `@xyflow/system` and applied as an INLINE style by
    // `@xyflow/react`, so it is readable off a really-rendered selected node — which is
    // what this does, rather than reading a number out of `node_modules` (a form with no
    // precedent anywhere in this repo). Measured before it was written: this wrapper
    // reports `"1000"` and an unselected sibling reports `"0"`.
    const { container } = renderCanvas(evalCoverage, { editable: true, selectedSlug: "fanout" })

    const selected = container.querySelector<HTMLElement>('.react-flow__node[data-id="fanout"]')
    expect(selected).not.toBeNull()
    expect(selected!.style.zIndex).toBe(String(SELECTED_NODE_Z_FROM_LIBRARY))

    // …and it is the SELECTION that elevates, not the renderer stamping 1000 on every
    // node. Without this, the assertion above would still pass in a world where the
    // mechanism recorded in `AFFORDANCE_Z`'s docblock was wrong.
    const unselected = container.querySelector<HTMLElement>('.react-flow__node[data-id="split"]')
    expect(unselected).not.toBeNull()
    expect(unselected!.style.zIndex).toBe("0")
  })

  it("all THREE affordance groups carry that tier in the rendered DOM", () => {
    // Without this, the two assertions above are two true statements about constants that
    // never reach a single element. All three groups, because the report shows the ＋
    // reachable only because no node beside one happened to be selected — a selected card
    // occludes a nearby ＋ and the open picker by the identical mechanism.
    const { container } = renderEditable(evalCoverage)
    fireEvent.click(screen.getByTestId("canvas-insert-2"))

    const groups = [
      '[data-testid^="canvas-insert-"]',
      '[data-testid^="canvas-remove-"]',
      '[data-testid="canvas-insert-picker"]',
    ]
    for (const selector of groups) {
      const els = Array.from(container.querySelectorAll<HTMLElement>(selector))
      expect(els.length).toBeGreaterThan(0)
      for (const el of els) {
        expect(el.style.zIndex).toBe("1002")
      }
    }
  })
})

// ── 13. The ＋ opens the plain-language menu AT the insertion point ─────────────

describe("WorkflowCanvas 184-12 — the ＋ opens the step-type menu where the step will land", () => {
  it("no menu is open at rest", () => {
    renderEditable(evalCoverage)
    expect(screen.queryByTestId("step-type-picker")).toBeNull()
    expect(screen.getByTestId("canvas-insert-2")).toHaveAttribute("aria-expanded", "false")
  })

  it("activating a ＋ opens the menu AT that boundary and says so in words", () => {
    renderEditable(evalCoverage)

    fireEvent.click(screen.getByTestId("canvas-insert-2"))

    const picker = screen.getByTestId("step-type-picker")
    expect(picker).toBeInTheDocument()
    // The menu names the slot the way a person reads the flow — 1-based.
    expect(picker.textContent).toContain("Add a step before step 3")
    expect(screen.getByTestId("canvas-insert-2")).toHaveAttribute("aria-expanded", "true")
  })

  it("the LAST ＋ opens the menu as an append", () => {
    renderEditable(evalCoverage)
    fireEvent.click(screen.getByTestId(`canvas-insert-${evalCoverage.length}`))
    expect(screen.getByTestId("step-type-picker").textContent).toContain("Add a step at the end")
  })

  it("choosing a type calls onInsertAt with THAT index and THAT type, and closes the menu", () => {
    const onInsertAt = vi.fn()
    renderEditable(evalCoverage, { onInsertAt })

    fireEvent.click(screen.getByTestId("canvas-insert-2"))
    fireEvent.click(screen.getByTestId("step-type-choice-llm_single"))

    expect(onInsertAt).toHaveBeenCalledTimes(1)
    expect(onInsertAt).toHaveBeenCalledWith(2, "llm_single")
    expect(screen.queryByTestId("step-type-picker")).toBeNull()
  })

  it("the canvas creates no phase and invents no slug — it only reports the choice", () => {
    const before = structuredClone(evalCoverage)
    const onInsertAt = vi.fn()
    renderEditable(evalCoverage, { onInsertAt })

    fireEvent.click(screen.getByTestId("canvas-insert-0"))
    fireEvent.click(screen.getByTestId("step-type-choice-llm_agent"))

    expect(onInsertAt).toHaveBeenCalledWith(0, "llm_agent")
    expect(evalCoverage).toStrictEqual(before)
  })
})

// ── 14. R10b in the UI — refused, visibly, with a reason this file did not write ──

describe("WorkflowCanvas 184-12 — R10b: a stranding choice is offered DISABLED with its reason", () => {
  it("AT the deliverable's own position every choice is still offered (the strictly-after boundary)", () => {
    // 184-02 Deviation 1: inserting AT the emit's position puts the new step BEFORE it,
    // so the deliverable shifts down one and stays terminal. Refusing this slot would
    // decline the most natural authoring act while stating a reason that is false about
    // the edit refused.
    renderEditable(withDeliverable)

    fireEvent.click(screen.getByTestId("canvas-insert-2"))

    const rows = screen.getAllByRole("menuitem")
    expect(rows).toHaveLength(6)
    for (const row of rows) expect(row).not.toBeDisabled()
    expect(screen.queryAllByTestId(/^step-type-reason-/)).toHaveLength(0)
  })

  it("PAST the deliverable every choice is disabled and its reason is real DOM text", () => {
    renderEditable(withDeliverable)

    fireEvent.click(screen.getByTestId("canvas-insert-3"))

    const rows = screen.getAllByRole("menuitem")
    // Never fewer than six: a refusal that hides the option teaches nothing (139-C).
    expect(rows).toHaveLength(6)
    for (const row of rows) {
      expect(row).toBeDisabled()
      expect(row).toHaveAttribute("aria-disabled", "true")
    }
    // CHARACTER-IDENTICAL to the pure module's constant — which is what proves the
    // canvas authored no reason of its own.
    const reasons = screen.getAllByTestId(/^step-type-reason-/)
    expect(reasons).toHaveLength(6)
    for (const reason of reasons) expect(reason.textContent).toBe(STRANDING_REASON)
  })

  it("activating a refused row inserts NOTHING", () => {
    const onInsertAt = vi.fn()
    renderEditable(withDeliverable, { onInsertAt })

    fireEvent.click(screen.getByTestId("canvas-insert-3"))
    fireEvent.click(screen.getByTestId("step-type-choice-llm_single"))

    expect(onInsertAt).not.toHaveBeenCalled()
    // The menu stays open, so the person can read why and pick a different slot.
    expect(screen.getByTestId("step-type-picker")).toBeInTheDocument()
  })

  it("the refusal reaches the network ZERO times", () => {
    // R10: both refusals are SHAPE rules, decidable from the phases in hand. A verdict
    // is a server judgement; the two must stay separately sourced.
    renderEditable(withDeliverable, { onInsertAt: vi.fn() })

    fireEvent.click(screen.getByTestId("canvas-insert-3"))
    fireEvent.click(screen.getByTestId("step-type-choice-programmatic"))
    fireEvent.click(screen.getByTestId("step-type-choice-llm_emit"))

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ── 15. The ✕ asks; it never decides ───────────────────────────────────────────

describe("WorkflowCanvas 184-12 — the ✕ requests a removal and opens no dialog", () => {
  it("activating a ✕ calls onRequestRemove with THAT slug", () => {
    const onRequestRemove = vi.fn()
    renderEditable(evalCoverage, { onRequestRemove })

    fireEvent.click(screen.getByTestId("canvas-remove-deep_dive"))

    expect(onRequestRemove).toHaveBeenCalledTimes(1)
    expect(onRequestRemove).toHaveBeenCalledWith("deep_dive")
  })

  it("NO confirm dialog is rendered at any point (D-184-12)", () => {
    renderEditable(evalCoverage, { onRequestRemove: vi.fn() })

    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByTestId("canvas-remove-deep_dive"))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("the ✕ reaches the network ZERO times", () => {
    renderEditable(evalCoverage, { onRequestRemove: vi.fn() })
    fireEvent.click(screen.getByTestId("canvas-remove-split"))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ── 16. The two notices are two DIFFERENT acts ─────────────────────────────────

describe("WorkflowCanvas 184-12 — the delete message and the refusal read differently", () => {
  const removed = {
    kind: "action",
    lead: "Removed",
    subject: "Write a section",
    detail: "2 steps renumbered",
  } as const

  it("the delete message names the step and the renumber count, with Undo inline", () => {
    const onUndo = vi.fn()
    renderEditable(evalCoverage, { notice: { ...removed, onUndo } })

    const message = screen.getByTestId("canvas-notice-action")
    expect(message).toHaveAttribute("role", "status")
    expect(message).toHaveAttribute("aria-live", "polite")
    // The locked sentence, as a person reads it.
    expect(message.textContent).toContain("Removed Write a section · 2 steps renumbered")

    const undo = screen.getByTestId("canvas-notice-undo")
    expect(undo).toBeInTheDocument()
    fireEvent.click(undo)
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it("the refusal states its reason and offers NO way to proceed", () => {
    renderEditable(evalCoverage, {
      notice: {
        kind: "refusal",
        text: '"Write it up" sends failures to this step. Remove that fallback first.',
      },
    })

    const refusal = screen.getByTestId("canvas-notice-refusal")
    expect(refusal).toHaveAttribute("role", "alert")
    expect(refusal.textContent).toContain("Remove that fallback first.")
    // A refusal is not a confirm: there is no delete-anyway control, and no Undo either
    // (nothing happened to undo).
    expect(refusal.querySelectorAll("button")).toHaveLength(0)
    expect(screen.queryByTestId("canvas-notice-undo")).toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("the two use DIFFERENT testids and DIFFERENT roles — they can never be conflated", () => {
    const { unmount } = renderEditable(evalCoverage, { notice: removed })
    const actionRole = screen.getByTestId("canvas-notice-action").getAttribute("role")
    expect(screen.queryByTestId("canvas-notice-refusal")).toBeNull()
    unmount()

    renderEditable(evalCoverage, { notice: { kind: "refusal", text: "no" } })
    const refusal = screen.getByTestId("canvas-notice-refusal")
    expect(screen.queryByTestId("canvas-notice-action")).toBeNull()
    expect(refusal.getAttribute("role")).not.toBe(actionRole)
  })
})

// ── 17. U-1 — the empty draft invites, it does not look broken ─────────────────

describe("WorkflowCanvas 184-12 — the empty draft is a first-class screen", () => {
  it("an EDITABLE empty draft offers the invitation BY NAME, not a bare ＋", () => {
    renderEditable(noPhases)

    const invitation = screen.getByTestId("canvas-add-first-step")
    expect(invitation).toBeInTheDocument()
    expect(invitation.textContent).toContain("Add your first step")
    // Not the read-only "nothing here" line.
    expect(screen.queryByText(/no steps yet/i)).toBeNull()
  })

  it("activating it opens the menu at index 0", () => {
    const onInsertAt = vi.fn()
    renderEditable(noPhases, { onInsertAt })

    fireEvent.click(screen.getByTestId("canvas-add-first-step"))
    expect(screen.getByTestId("step-type-picker")).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("step-type-choice-llm_agent"))
    expect(onInsertAt).toHaveBeenCalledWith(0, "llm_agent")
  })

  it("a READ-ONLY empty draft renders the shipped state and no invitation (D-183-11)", () => {
    const { container } = renderEditable(noPhases, { editable: false })

    expect(screen.getByTestId("canvas-empty")).toBeInTheDocument()
    expect(screen.getByText(/no steps yet/i)).toBeInTheDocument()
    expect(screen.queryByTestId("canvas-add-first-step")).toBeNull()
    // …and still no plane, no controls, no ghost node.
    expect(container.querySelector(".react-flow")).toBeNull()
    expect(screen.queryAllByTestId(/^canvas-node-/)).toHaveLength(0)
  })

  it("the empty draft asks the server nothing either", () => {
    renderEditable(noPhases, { onInsertAt: vi.fn() })
    fireEvent.click(screen.getByTestId("canvas-add-first-step"))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ── 13. The affordances are REACHABLE, not merely present ────────────────────────
//
// Added after live UAT found both `＋` and `✕` unclickable at >=1024px with a mouse:
// they render through `<ViewportPortal>`, whose ancestors the library sets to
// `pointer-events: none`, and the class list alone could not see it. Every assertion
// in section 12 above passed while CANVAS-02 was false for the primary desktop path.
//
// jsdom applies no stylesheet, so these cannot test COMPUTED reachability. They pin the
// two class-level facts that were missing instead, each one falsifiable by deleting the
// token it names — which is exactly what the previous suite could not do, because it
// never asserted these tokens at all.
describe("WorkflowCanvas 184-12 — the ＋ / ✕ layer is hit-testable and reveals from the plane", () => {
  it("every edit affordance re-enables pointer events, which ViewportPortal's ancestors disable", () => {
    const { container } = renderEditable(evalCoverage, { onInsertAt: vi.fn(), onRequestRemove: vi.fn() })
    const affordances = [...container.querySelectorAll("[data-canvas-affordance]")]
    expect(affordances.length).toBeGreaterThan(0)
    for (const el of affordances) {
      expect(el.className).toMatch(/\bpointer-events-auto\b/)
    }
  })

  it("the reveal hangs off the canvas group, never the affordance's own :hover", () => {
    const { container } = renderEditable(evalCoverage, { onInsertAt: vi.fn(), onRequestRemove: vi.fn() })
    const affordances = [...container.querySelectorAll("[data-canvas-affordance]")]
    for (const el of affordances) {
      // The reveal must come from an ancestor's hover...
      expect(el.className).toMatch(/\blg:group-hover\/canvas:opacity-100\b/)
      // ...and never from the element's own, which a pointer-events:none element
      // can never receive, and which would otherwise have to be found blind.
      expect(el.className).not.toMatch(/\blg:hover:opacity-100\b/)
    }
  })

  it("the group root the reveal names actually exists in the rendered tree", () => {
    const { container } = renderEditable(evalCoverage, { onInsertAt: vi.fn() })
    // Attribute-matched, not an escaped class selector — jsdom's selector engine
    // rejects `.group\/canvas` outright ("Invalid selector"). A jsdom limit, not a
    // bug in the class itself.
    const root = container.querySelector('[class~="group/canvas"]')
    expect(root).not.toBeNull()
    // and it must be an ANCESTOR of the affordances, or group-hover cannot reach them
    const affordance = container.querySelector("[data-canvas-affordance]")
    expect(affordance).not.toBeNull()
    expect(root!.contains(affordance!)).toBe(true)
  })
})

// ── 14. The PICKER is hit-testable too ───────────────────────────────────────────
//
// Section 13 fixed the ＋/✕ and I verified the menu OPENED — then stopped there. The
// operator clicked a row and nothing happened: the picker wrapper is a third child of
// <ViewportPortal> and had inherited the same pointer-events:none. "It renders" is not
// "it works", and an open menu whose rows silently ignore clicks is worse than no menu,
// because it looks functional.
describe("WorkflowCanvas 184-12 — the insert menu is clickable, not merely visible", () => {
  it("the picker wrapper re-enables pointer events", () => {
    const { container } = renderEditable(evalCoverage, { onInsertAt: vi.fn() })
    fireEvent.click(screen.getByTestId("canvas-insert-0"))
    const wrapper = container.querySelector('[data-testid="canvas-insert-picker"]')
    expect(wrapper).not.toBeNull()
    expect((wrapper as HTMLElement).className).toMatch(/\bpointer-events-auto\b/)
  })

  it("choosing a row actually reaches the handler", () => {
    const onInsertAt = vi.fn()
    renderEditable(evalCoverage, { onInsertAt })
    fireEvent.click(screen.getByTestId("canvas-insert-0"))
    const rows = screen.getAllByRole("menuitem").filter((r) => r.getAttribute("aria-disabled") !== "true")
    expect(rows.length).toBeGreaterThan(0)
    fireEvent.click(rows[0])
    // index 0 — the boundary the ＋ above was opened at.
    expect(onInsertAt).toHaveBeenCalledWith(0, expect.any(String))
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 186-07 (CONCUR-01 · D-186-02) — F12, EXTENDED FOR THE AUTOSAVE ERA.
//
// Appended; not one assertion above this line was edited or removed.
//
// WHAT THE 184-07 SPY PROVED, AND WHY IT IS NO LONGER ENOUGH. The whole-suite `fetchSpy`
// showed that a cosmetic nudge issues no request — at a time when the Builder issued no
// requests at all without a button press. Phase 186 adds a loop that writes ON ITS OWN a
// second after any definition change, so the property worth pinning now is stronger: a
// nudge issues nothing WHILE AN AUTOSAVE LOOP IS LIVE AND WATCHING.
//
// D-186-02 is what makes that true, and it is true BY CONSTRUCTION rather than by a rule
// someone has to defend: `canvasNudge.ts` imports neither the builder store, the canvas
// model, nor the API client, so a nudge has no path to a definition change. Neither that
// module NOR `WorkflowCanvas.tsx` is opened by this plan — the evidence is added here, in
// the test file. If a nudge ever did reach the write path, that is D-186-02 broken and the
// fix belongs in the wiring, never in this fence.
// ═══════════════════════════════════════════════════════════════════════════════

describe("WorkflowCanvas 186-07 — F12: a cosmetic nudge writes nothing WITH autosave live", () => {
  /** The page's own composition, reduced to the two parts this claim is about: the write
   *  loop watching a real store, and the editable canvas that emits the nudge. The
   *  `definition` memo mirrors `WorkflowBuilderPage`'s — identity changes once per EDIT —
   *  because that identity IS the loop's change signal. */
  function NudgeHarness({
    store,
    onNudge,
  }: {
    store: ReturnType<typeof createBuilderStore>
    onNudge: (slug: string, dy: number) => void
  }) {
    const phases = useStore(store, (s) => s.phases)
    const meta = useStore(store, (s) => s.meta)
    const definition = useMemo(() => selectDefinition({ meta, phases }), [meta, phases])

    useDraftPersistence({
      definition: definition as unknown as BuilderDefinition,
      enabled: true,
      initialDraftId: "draft-1",
      initialToken: "tok-1",
      store,
      publishInFlight: false,
      validationCause: null,
      onDraftCreated: () => {},
    })

    return (
      <div style={{ width: 1200, height: 800 }}>
        <WorkflowCanvas
          phases={phases}
          selectedSlug={null}
          onSelectNode={vi.fn()}
          onClearSelection={vi.fn()}
          editable
          onNudge={onNudge}
          onCommitNodes={vi.fn()}
        />
      </div>
    )
  }

  /** Past the loop's own window, so "zero" is not "not yet". The constant is IMPORTED from
   *  the hook rather than retyped: a fence that hard-codes the number it is testing stops
   *  being a fence the first time the number moves. */
  const PAST_THE_WINDOW = AUTOSAVE_DEBOUNCE_MS + 400

  it("a nudge-only drag issues ZERO requests and ZERO draft writes across the whole window", async () => {
    const store = createBuilderStore({
      slug: "nudge-harness",
      version: 1,
      status: "draft",
      phases: evalCoverage,
    } as unknown as BuilderDefinition)

    // The page's real nudge handler: `canvasNudge.ts` and nothing else.
    const onNudge = (slug: string, dy: number) => writeNudge("draft-1", slug, dy)

    render(<NudgeHarness store={store} onNudge={onNudge} />)
    drag({ x: LANE_X[1], y: 0 }, { x: LANE_X[1], y: 120 })

    // The offset really was recorded — so the "zero writes" below is measured against a
    // nudge that HAPPENED, not against a gesture that silently did nothing.
    expect(readNudges("draft-1").fanout).toBe(120)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, PAST_THE_WINDOW))
    })

    expect(mockedCreate).not.toHaveBeenCalled()
    expect(mockedUpdate).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    // …and the definition is untouched: a nudge is not an edit, so nothing arms `dirty`.
    expect(store.getState().dirty).toBe(false)
  })

  it("the loop in that harness IS live — a real edit does write (the positive control)", async () => {
    // Without this row the one above is compatible with a harness whose loop never runs at
    // all, which would make "zero writes" a statement about nothing.
    const store = createBuilderStore({
      slug: "nudge-harness-control",
      version: 1,
      status: "draft",
      phases: evalCoverage,
    } as unknown as BuilderDefinition)

    render(<NudgeHarness store={store} onNudge={vi.fn()} />)
    act(() => store.getState().patchConfig("fanout", { prompt: "a real edit" }))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, PAST_THE_WINDOW))
    })

    expect(mockedUpdate).toHaveBeenCalledTimes(1)
    // The nudge row's silence is therefore about the NUDGE, not about a dead loop.
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 188.1-02 — THE PRE-MOVE AFFORDANCE SHAPE CAPTURE (SC#2).
//
// Inserted ABOVE the accumulated belt on purpose, so that block keeps the property its
// own comment claims: declared last, therefore run last, therefore its total covers
// every path this file drives — including this one. Nothing above was edited, renamed
// or re-described; this is a pure insertion.
//
// WHY A CAPTURE AND NOT AN EXPECTATION. Phase 188.1 lifts `PlaneEditingLayer`,
// `EDIT_AFFORDANCE`, `REVEAL_ON_HOVER`, `insertPointX` and `verticalOffsetFor` out of
// `WorkflowCanvas.tsx` into two modules of their own, and SC#2 promises the canvas
// renders identically before and after. The cheap wrong way to check that is to
// hand-type the attributes the affordances OUGHT to carry — which proves only what the
// author believed the geometry was, and would ratify a move that changed it whenever
// the change happened to match the belief. So this block CAPTURES the rendered
// attributes from the tree AS IT SHIPS and pins the literal it observed. A baseline
// taken after the move proves nothing, which is why this plan runs before it.
//
// `style` IS THE LOAD-BEARING ATTRIBUTE, and the reason one capture fences almost the
// whole moved surface. Every number the moved helpers produce reaches the DOM through
// it: the six `EDIT_AFFORDANCE` members as widths, heights and translate terms;
// `insertPointX`'s three branches (before-first, between, after-last) as the `＋` x;
// `verticalOffsetFor`'s nudge branch as the y — which is why the render below carries a
// NON-ZERO nudge, since with every offset at 0 that helper contributes the same number
// everywhere and the capture could not fail on it; and `PICKER_WIDTH` / `PICKER_DROP`
// as the open menu's own transform, which is why the render OPENS the picker rather
// than merely declaring those two constants exist.
//
// The driver rule from the top of this file still applies: `fireEvent` only.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The captured shape of one affordance element.
 *
 * ORDER-INDEPENDENT BY CONSTRUCTION. The result is sorted by `data-testid` before it is
 * returned, so jsdom's DOM traversal order cannot leak into the baseline. Research
 * assumption A6 held that jsdom's ordering is stable in practice but did not prove it;
 * sorting retires the assumption outright rather than betting on it, and costs a line.
 *
 * `aria-*` are captured alongside `class` and `style` because the `＋` is a menu button:
 * a move that kept the geometry and dropped `aria-expanded` would still be a change to
 * what ships. A missing attribute captures as `null`, which is a value the deep-equal
 * compares — an attribute that disappears is a diff, not a silent pass.
 */
function AFFORDANCE_SHAPE(container: HTMLElement) {
  const els = Array.from(
    container.querySelectorAll(
      '[data-testid^="canvas-insert-"], [data-testid^="canvas-remove-"], [data-testid="canvas-insert-picker"]',
    ),
  )
  return els
    .map((el) => ({
      testid: el.getAttribute("data-testid"),
      class: el.getAttribute("class"),
      style: el.getAttribute("style"),
      ariaLabel: el.getAttribute("aria-label"),
      ariaExpanded: el.getAttribute("aria-expanded"),
      ariaHaspopup: el.getAttribute("aria-haspopup"),
    }))
    .sort((a, b) => (a.testid! < b.testid! ? -1 : a.testid! > b.testid! ? 1 : 0))
}

/**
 * ⚠ THIS LITERAL IS A CAPTURE, NOT AN EXPECTATION. Every character below was READ OUT of
 * the rendered DOM of the tree as it stands at this commit — the tree Phase 188 closed at
 * `7e1bff34` — by running `AFFORDANCE_SHAPE` above and pasting what it printed. Not one
 * number here was typed from the source, computed by hand, or reasoned about. That is the
 * whole point: an expectation records what its author believed the geometry to be, and a
 * move that changed the geometry to match that belief would pass it.
 *
 * OBSERVED TWICE on the unchanged tree before it was committed, and the two runs agreed —
 * so it is a baseline rather than one sample of something that might vary. It was also
 * observed to go RED against a deliberate one-pixel change to `EDIT_AFFORDANCE.INSERT_SIZE`
 * (26 → 27) and to `PICKER_WIDTH` (300 → 320), which is what makes it a fence around
 * GEOMETRY and not merely around presence.
 *
 * A DIFF AGAINST THIS ARRAY AFTER PLAN 188.1-03 IS A BEHAVIOUR CHANGE — SC#2 broken — AND
 * NOT A TEST TO UPDATE. The extraction is supposed to move code, not move pixels. If this
 * goes red during the move, the move is wrong; re-capturing it to make it green would
 * delete the only evidence anybody has that the canvas still renders what it rendered.
 *
 * WHAT THE NUMBERS BELOW REACH BACK TO, so a reader can see the fence is not decorative:
 *   · `width` / `height` 26 → `EDIT_AFFORDANCE.INSERT_SIZE`, 24 → `REMOVE_SIZE`
 *   · the `＋` x −43 / 277 / 597 / 917 / 1237 / 1557 → `insertPointX`'s three branches over
 *     a 320 pitch (`GAP` = 60, so a half-gap of 30 either side of the run)
 *   · the `＋` y 15 → `INSERT_Y` (28) − `INSERT_SIZE`/2, and 39 → the same plus the 24px
 *     mean slant either side of the one nudged card — `verticalOffsetFor`'s nudge branch
 *   · the ✕ y 92 → `NODE_MIN_HEIGHT` − `REMOVE_SIZE`/2, and 140 → that plus the full 48px
 *     nudge, because a ✕ belongs to exactly one card and takes its WHOLE offset
 *   · the picker's `translate(460px, 74px)` → `insertPointX(lanes, 2)` (610) −
 *     `PICKER_WIDTH`/2 (150), and `INSERT_Y` + `PICKER_DROP` + the 24px slant. `PICKER_WIDTH`
 *     reaches the DOM only through that halved centring term — the literal 300 appears
 *     nowhere in the attribute — which is why it is proven fenced by the RED observation
 *     rather than by reading the string.
 *
 * ── RE-CAPTURED ONCE, ON AUTHORITY, IN PHASE 188.2-02 (D-10 · D-11) ────────────────────
 *
 * The rule above says, in its own words: *"A DIFF AGAINST THIS ARRAY … IS A BEHAVIOUR
 * CHANGE … AND NOT A TEST TO UPDATE"*. It was read before one character below it was
 * touched, and it is being deliberately overridden EXACTLY ONCE. This paragraph exists so
 * a reviewer can see the rule was consulted rather than quietly stepped around.
 *
 * WHY THE RULE DOES NOT APPLY HERE. It forbids re-capturing to hide an UNINTENDED
 * behaviour change. This diff IS the intended behaviour change — the one the phase's
 * second contract exists for. Phase 188.2 splits in two, and D-10 requires both halves
 * stated up front rather than an exception discovered at verification:
 *
 *   · PROVE UNCHANGED — `PhaseNodeCard.tsx` and the modules carved out of it. Every fence
 *     around that subtree stays green with zero production edits.
 *   · PROVE FIXED — `PlaneEditingLayer` stacking. `BUG-260806-01`: a SELECTED card was
 *     painted over its own `✕`, so the natural flow (click the step, then click its `✕`)
 *     was not completable with a real pointer. All three affordance groups now carry
 *     `zIndex: AFFORDANCE_Z` (1002), above `@xyflow`'s `SELECTED_NODE_Z` (1000).
 *
 * WHAT ACTUALLY MOVED, measured rather than asserted. The old literal was parsed out of
 * `HEAD` and compared to the capture field by field across all 12 entries and all 6
 * captured attributes: **12 fields differ, all of them `style`, and every one differs by
 * exactly the appended term `z-index: 1002;` and by nothing else.** No `class`, no
 * `aria-*`, no `transform`, no `width`/`height`, no entry added or lost. The re-capture
 * therefore cannot have smuggled an unrelated geometry change past this fence, which is
 * the specific risk the rule protects against.
 *
 * HOW IT WAS CAPTURED. From `AFFORDANCE_SHAPE`'s own printed output, dumped to a file at
 * the capture site and run TWICE — the two dumps were compared byte-for-byte and were
 * identical before anything was written here. NOT ONE `style` STRING WAS HAND-EDITED to
 * insert `z-index` by eye. Hand-editing would turn this literal back into an EXPECTATION
 * recording what its author believed the change did, which is exactly what the rule is
 * for, and it would silently mask any other attribute the edit had disturbed.
 *
 * THE COUNT-GATE PIN DOES NOT MOVE. `scripts/vitest-count-gate.cjs:411` pins this file at
 * 58 and 188.2-02 does not touch it: the test COUNT is unchanged by this task — only the
 * literal is. (The separate 188.2-02 z-index block adds 3 `it(`s, which the gate prints as
 * an increase over the pin and passes; the upward pin move stays with Plan 07.) Nobody
 * should later read a pin move as evidence a test was added or removed here.
 *
 * AND THE RULE IS RE-ARMED, UNCHANGED, FOR EVERY FUTURE DIFF. This authorisation covers
 * this one re-capture in this one phase and nothing else. The next diff against this array
 * is a behaviour change and not a test to update.
 */
const AFFORDANCE_SHAPE_BASELINE: ReturnType<typeof AFFORDANCE_SHAPE> = [
  {
    testid: "canvas-insert-0",
    class:
      "absolute grid place-items-center rounded-full border border-dashed border-border bg-card text-[15px] leading-none text-muted-foreground transition-opacity hover:border-solid hover:border-primary hover:text-primary motion-reduce:transition-none pointer-events-auto opacity-100 lg:opacity-0 lg:group-hover/canvas:opacity-100 lg:focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
    style: "left: 0px; top: 0px; width: 26px; height: 26px; transform: translate(-43px, 15px); z-index: 1002;",
    ariaLabel: "Add a step before step 1",
    ariaExpanded: "false",
    ariaHaspopup: "menu",
  },
  {
    testid: "canvas-insert-1",
    class:
      "absolute grid place-items-center rounded-full border border-dashed border-border bg-card text-[15px] leading-none text-muted-foreground transition-opacity hover:border-solid hover:border-primary hover:text-primary motion-reduce:transition-none pointer-events-auto opacity-100 lg:opacity-0 lg:group-hover/canvas:opacity-100 lg:focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
    style: "left: 0px; top: 0px; width: 26px; height: 26px; transform: translate(277px, 39px); z-index: 1002;",
    ariaLabel: "Add a step before step 2",
    ariaExpanded: "false",
    ariaHaspopup: "menu",
  },
  {
    testid: "canvas-insert-2",
    class:
      "absolute grid place-items-center rounded-full border border-dashed border-border bg-card text-[15px] leading-none text-muted-foreground transition-opacity hover:border-solid hover:border-primary hover:text-primary motion-reduce:transition-none pointer-events-auto opacity-100 lg:opacity-0 lg:group-hover/canvas:opacity-100 lg:focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
    style: "left: 0px; top: 0px; width: 26px; height: 26px; transform: translate(597px, 39px); z-index: 1002;",
    ariaLabel: "Add a step before step 3",
    ariaExpanded: "true",
    ariaHaspopup: "menu",
  },
  {
    testid: "canvas-insert-3",
    class:
      "absolute grid place-items-center rounded-full border border-dashed border-border bg-card text-[15px] leading-none text-muted-foreground transition-opacity hover:border-solid hover:border-primary hover:text-primary motion-reduce:transition-none pointer-events-auto opacity-100 lg:opacity-0 lg:group-hover/canvas:opacity-100 lg:focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
    style: "left: 0px; top: 0px; width: 26px; height: 26px; transform: translate(917px, 15px); z-index: 1002;",
    ariaLabel: "Add a step before step 4",
    ariaExpanded: "false",
    ariaHaspopup: "menu",
  },
  {
    testid: "canvas-insert-4",
    class:
      "absolute grid place-items-center rounded-full border border-dashed border-border bg-card text-[15px] leading-none text-muted-foreground transition-opacity hover:border-solid hover:border-primary hover:text-primary motion-reduce:transition-none pointer-events-auto opacity-100 lg:opacity-0 lg:group-hover/canvas:opacity-100 lg:focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
    style: "left: 0px; top: 0px; width: 26px; height: 26px; transform: translate(1237px, 15px); z-index: 1002;",
    ariaLabel: "Add a step before step 5",
    ariaExpanded: "false",
    ariaHaspopup: "menu",
  },
  {
    testid: "canvas-insert-5",
    class:
      "absolute grid place-items-center rounded-full border border-dashed border-border bg-card text-[15px] leading-none text-muted-foreground transition-opacity hover:border-solid hover:border-primary hover:text-primary motion-reduce:transition-none pointer-events-auto opacity-100 lg:opacity-0 lg:group-hover/canvas:opacity-100 lg:focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
    style: "left: 0px; top: 0px; width: 26px; height: 26px; transform: translate(1557px, 15px); z-index: 1002;",
    ariaLabel: "Add a step at the end",
    ariaExpanded: "false",
    ariaHaspopup: "menu",
  },
  {
    testid: "canvas-insert-picker",
    class: "pointer-events-auto absolute",
    style:
      "left: 0px; top: 0px; transform-origin: top left; transform: translate(460px, 74px) scale(1); z-index: 1002;",
    ariaLabel: null,
    ariaExpanded: null,
    ariaHaspopup: null,
  },
  {
    testid: "canvas-remove-confirm",
    class:
      "absolute grid place-items-center rounded-[7px] border border-border bg-card text-[11px] leading-none text-muted-foreground transition-opacity hover:border-[hsl(0_72%_51%/0.6)] hover:text-[hsl(0_85%_74%)] motion-reduce:transition-none pointer-events-auto opacity-100 lg:opacity-0 lg:group-hover/canvas:opacity-100 lg:focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
    style: "left: 0px; top: 0px; width: 24px; height: 24px; transform: translate(1078px, 92px); z-index: 1002;",
    ariaLabel: "Remove step 4",
    ariaExpanded: null,
    ariaHaspopup: null,
  },
  {
    testid: "canvas-remove-deep_dive",
    class:
      "absolute grid place-items-center rounded-[7px] border border-border bg-card text-[11px] leading-none text-muted-foreground transition-opacity hover:border-[hsl(0_72%_51%/0.6)] hover:text-[hsl(0_85%_74%)] motion-reduce:transition-none pointer-events-auto opacity-100 lg:opacity-0 lg:group-hover/canvas:opacity-100 lg:focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
    style: "left: 0px; top: 0px; width: 24px; height: 24px; transform: translate(758px, 92px); z-index: 1002;",
    ariaLabel: "Remove step 3",
    ariaExpanded: null,
    ariaHaspopup: null,
  },
  {
    testid: "canvas-remove-fanout",
    class:
      "absolute grid place-items-center rounded-[7px] border border-border bg-card text-[11px] leading-none text-muted-foreground transition-opacity hover:border-[hsl(0_72%_51%/0.6)] hover:text-[hsl(0_85%_74%)] motion-reduce:transition-none pointer-events-auto opacity-100 lg:opacity-0 lg:group-hover/canvas:opacity-100 lg:focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
    style: "left: 0px; top: 0px; width: 24px; height: 24px; transform: translate(438px, 140px); z-index: 1002;",
    ariaLabel: "Remove step 2",
    ariaExpanded: null,
    ariaHaspopup: null,
  },
  {
    testid: "canvas-remove-split",
    class:
      "absolute grid place-items-center rounded-[7px] border border-border bg-card text-[11px] leading-none text-muted-foreground transition-opacity hover:border-[hsl(0_72%_51%/0.6)] hover:text-[hsl(0_85%_74%)] motion-reduce:transition-none pointer-events-auto opacity-100 lg:opacity-0 lg:group-hover/canvas:opacity-100 lg:focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
    style: "left: 0px; top: 0px; width: 24px; height: 24px; transform: translate(118px, 92px); z-index: 1002;",
    ariaLabel: "Remove step 1",
    ariaExpanded: null,
    ariaHaspopup: null,
  },
  {
    testid: "canvas-remove-summarize",
    class:
      "absolute grid place-items-center rounded-[7px] border border-border bg-card text-[11px] leading-none text-muted-foreground transition-opacity hover:border-[hsl(0_72%_51%/0.6)] hover:text-[hsl(0_85%_74%)] motion-reduce:transition-none pointer-events-auto opacity-100 lg:opacity-0 lg:group-hover/canvas:opacity-100 lg:focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
    style: "left: 0px; top: 0px; width: 24px; height: 24px; transform: translate(1398px, 92px); z-index: 1002;",
    ariaLabel: "Remove step 5",
    ariaExpanded: null,
    ariaHaspopup: null,
  },
]

describe("WorkflowCanvas 188.1-02 — the editing affordances' pre-move rendered shape", () => {
  it("reproduces the shape CAPTURED from the shipped tree, attribute for attribute", () => {
    const { container } = renderCanvas(evalCoverage, {
      editable: true,
      // A non-zero cosmetic offset on exactly ONE card, so `verticalOffsetFor` returns
      // three different numbers across this render (48 for that card's ✕, 24 for the two
      // ＋ that straddle it and for the picker, 0 everywhere else) instead of one.
      nudges: { fanout: 48 },
    })

    // The picker OPEN, driven the way this suite's driver rule requires — a real event on
    // a real `＋`, never a prop poke. Boundary 2 is a MIDDLE boundary, so the mean branch
    // of the slant term is the one exercised.
    fireEvent.click(screen.getByTestId("canvas-insert-2"))

    const captured = AFFORDANCE_SHAPE(container)

    // NON-VACUITY CONTROL, first: a deep-equal against an empty array passes forever, and
    // a capture that lost the picker would still deep-equal a baseline captured without it.
    expect(captured.length).toBeGreaterThan(0)
    expect(captured.filter((e) => /^canvas-insert-\d+$/.test(e.testid ?? "")).length).toBeGreaterThan(0)
    expect(captured.filter((e) => (e.testid ?? "").startsWith("canvas-remove-")).length).toBeGreaterThan(0)
    expect(captured.filter((e) => e.testid === "canvas-insert-picker")).toHaveLength(1)

    expect(captured).toEqual(AFFORDANCE_SHAPE_BASELINE)
  })
})

// ── The accumulated belt, declared LAST so it runs LAST (the `canvasNudge.test.ts:391-394`
//    shape). Every assertion site above checks the spy at its own moment; this one checks
//    the total across every path this file drives, including the ones that never mention
//    the network at all.
describe("WorkflowCanvas — the whole file reached the network zero times", () => {
  it("accumulated fetch call count is 0", () => {
    expect(fetchSpy).toHaveBeenCalledTimes(0)
  })
})
