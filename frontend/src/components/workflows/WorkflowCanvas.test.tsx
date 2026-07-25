/**
 * Phase 183-06 Task 3 (CANVAS-01, D-183-05 / D-183-07 / D-183-08 / D-183-10 /
 * D-183-11, T-183-11) — WorkflowCanvas DOM tests.
 *
 * THE DOM HALF ONLY. The projection's truth — node counts, edge sets, the phantom
 * edge that must not exist, order-independence, purity — is already pinned by plan
 * 183-05's three suites (195 tests over a 15-fixture corpus). Re-asserting any of it
 * here would be a second copy of a contract, which is exactly the drift this phase
 * exists to prevent. What follows asserts ONLY what a rendered DOM can prove and a
 * pure function cannot: that read-only survives contact with the library's defaults,
 * that the empty state mounts no canvas at all, that a click selects, that a node is
 * exactly one tab stop, and that the badges and the broken reference are visible.
 *
 * The fixtures are imported from `__fixtures__/canvasFixtures.ts` rather than
 * re-declared, so the DOM layer and the projection layer can never test different
 * shapes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { axe } from "vitest-axe"

// FILE-LOCAL, never setupTests.ts: the helper mutates HTMLElement.prototype, and a
// global install would perturb all ~205 suites and destroy this phase's
// failing-name differential. Call it before the first render.
import { mockReactFlow } from "@/test-utils/mockReactFlow"
// The component SOURCE via Vite's ?raw loader — the idiomatic vitest way to make a
// scope fence machine-checkable (the PhaseSpineGraph.test.tsx:20-22 precedent).
import workflowCanvasSource from "./WorkflowCanvas?raw"
import { WorkflowCanvas } from "./WorkflowCanvas"
import { toCanvas } from "./canvasModel"
import {
  docQaHuman,
  evalCoverage,
  emptyDraft,
  researchSummarize,
  unresolvableSkip,
} from "./__fixtures__/canvasFixtures"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"

mockReactFlow()

beforeEach(() => {
  // The reveal persists to localStorage; a leaked "true" would silently invert the
  // default-plain assertions.
  window.localStorage.clear()
})

/** The canvas needs a sized parent or the plane measures to nothing. */
function renderCanvas(
  phases: Parameters<typeof toCanvas>[0],
  opts: { selectedSlug?: string | null; onSelectNode?: (slug: string) => void; provider?: boolean } = {},
) {
  const ui = (
    <div style={{ width: 1200, height: 800 }}>
      <WorkflowCanvas
        phases={phases}
        selectedSlug={opts.selectedSlug ?? null}
        onSelectNode={opts.onSelectNode ?? vi.fn()}
      />
    </div>
  )
  return render(opts.provider ? <TechnicalNamesProvider>{ui}</TechnicalNamesProvider> : ui)
}

describe("WorkflowCanvas — read-only (SC#3)", () => {
  it("STATIC drag-free DOM: no draggable element, no connection-handle hook, no add-node control", () => {
    const { container } = renderCanvas(evalCoverage)
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(0)
    expect(container.querySelectorAll("[draggable]")).toHaveLength(0)
    expect(container.querySelectorAll("[data-connection-handle]")).toHaveLength(0)
    expect(container.querySelectorAll("[data-add-node]")).toHaveLength(0)
    for (const b of Array.from(container.querySelectorAll("button"))) {
      const label = (b.getAttribute("aria-label") ?? "") + (b.textContent ?? "")
      expect(label.toLowerCase()).not.toContain("add node")
    }
  })

  it("renders NO interactivity lock button (T-183-11 — two clicks would re-enable dragging)", () => {
    const { container } = renderCanvas(evalCoverage)
    // The control cluster IS rendered…
    expect(container.querySelector(".react-flow__controls")).not.toBeNull()
    // …but its padlock, whose handler sets nodesDraggable / nodesConnectable /
    // elementsSelectable to !isInteractive, must not exist.
    expect(container.querySelector(".react-flow__controls-interactive")).toBeNull()
  })
})

describe("WorkflowCanvas — the empty state (D-183-11)", () => {
  it("mounts NO canvas chrome at all on a zero-phase definition", () => {
    const { container } = renderCanvas(emptyDraft)
    expect(screen.getByTestId("canvas-empty")).toBeInTheDocument()
    expect(container.querySelector(".react-flow")).toBeNull()
    expect(container.querySelector(".react-flow__controls")).toBeNull()
    expect(container.querySelector(".react-flow__background")).toBeNull()
    expect(container.querySelector(".react-flow__minimap")).toBeNull()
  })

  it("renders no ghost or placeholder first node", () => {
    renderCanvas(emptyDraft)
    expect(screen.queryAllByTestId(/^canvas-node-/)).toHaveLength(0)
    expect(screen.queryByTestId("canvas-end-cap")).toBeNull()
  })

  it("names the state honestly instead of showing an empty plane", () => {
    renderCanvas(emptyDraft)
    expect(screen.getByText(/no steps yet/i)).toBeInTheDocument()
  })
})

/**
 * A note on the click driver. The shipped spine's suite drives selection with
 * `user-event`, but a `user-event` click INSIDE the canvas plane also dispatches a
 * real `mousedown`, which reaches d3-zoom's pan handler; d3-drag then dereferences
 * `event.view.document` and jsdom's synthetic MouseEvent carries a null `view`. The
 * result is the failure mode plan 183-01 named "a gate that lies": every assertion
 * passes, three unhandled `TypeError`s fire from outside the test body, and vitest
 * still exits 1. `fireEvent.click` dispatches only the click — which is precisely
 * the event `onNodeClick` listens to — so the selection contract is tested without
 * driving the pan gesture. The ⌥ control below sits OUTSIDE the plane and keeps
 * using `user-event`.
 */
describe("WorkflowCanvas — selection (D-183-05)", () => {
  it("clicking a phase node fires onSelectNode with exactly that phase's slug", () => {
    const onSelectNode = vi.fn()
    renderCanvas(researchSummarize, { onSelectNode })
    fireEvent.click(screen.getByTestId("canvas-node-summarize"))
    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith("summarize")
  })

  it("clicking the end cap does NOT fire onSelectNode (its id is not a phase slug)", () => {
    const onSelectNode = vi.fn()
    renderCanvas(researchSummarize, { onSelectNode })
    fireEvent.click(screen.getByTestId("canvas-end-cap"))
    expect(onSelectNode).not.toHaveBeenCalled()
  })

  it("clicking an unresolved-skip stub does NOT fire onSelectNode", () => {
    const onSelectNode = vi.fn()
    renderCanvas(unresolvableSkip, { onSelectNode })
    fireEvent.click(screen.getByTestId("canvas-unresolved-skip"))
    expect(onSelectNode).not.toHaveBeenCalled()
  })

  it("marks the selected node and never moves or reorders anything", () => {
    renderCanvas(researchSummarize, { selectedSlug: "research" })
    expect(screen.getByTestId("canvas-node-research").getAttribute("data-selected")).toBe("true")
    expect(screen.getByTestId("canvas-node-summarize").getAttribute("data-selected")).toBe("false")
  })
})

describe("WorkflowCanvas — one tab stop per node (Pattern 3 Option A)", () => {
  it("the tabbable node count equals the phase count", () => {
    const { container } = renderCanvas(evalCoverage)
    const tabbable = container.querySelectorAll('.react-flow__node[tabindex="0"]')
    expect(tabbable).toHaveLength(evalCoverage.length)
  })

  it("no focusable control exists INSIDE any node (the double-tab-stop mistake)", () => {
    const { container } = renderCanvas(evalCoverage)
    const nodes = Array.from(container.querySelectorAll(".react-flow__node"))
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(node.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
    }
  })
})

describe("WorkflowCanvas — the ⌥ Technical-names reveal (D-183-08)", () => {
  it("shows plain-language titles by default and no slug on any node face", () => {
    renderCanvas(evalCoverage, { provider: true })
    expect(screen.getByText("Prepare the inputs")).toBeInTheDocument()
    expect(screen.getByText("Check with you")).toBeInTheDocument()
    for (const phase of evalCoverage) {
      const node = screen.getByTestId(`canvas-node-${phase.slug}`)
      expect(node.textContent ?? "").not.toContain(phase.slug)
    }
  })

  it("one click on the canvas control flips EVERY node to the technical form at once", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    renderCanvas(evalCoverage, { provider: true })

    await user.click(screen.getByRole("button", { name: /technical names/i }))

    // Asserted on more than one node, so "flips every node" is actually tested.
    expect(
      within(screen.getByTestId("canvas-node-split")).getByText("Server step · split"),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId("canvas-node-confirm")).getByText("Needs you · confirm"),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId("canvas-node-summarize")).getByText("AI write step · summarize"),
    ).toBeInTheDocument()
  })

  it("renders plain titles, shows no control, and does not throw outside a provider", () => {
    expect(() => renderCanvas(evalCoverage)).not.toThrow()
    expect(screen.getByText("Prepare the inputs")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /technical names/i })).toBeNull()
  })
})

describe("WorkflowCanvas — the badge slots (D-183-07)", () => {
  it("every phase node carries EXACTLY ONE grounding chip", () => {
    renderCanvas(docQaHuman)
    const nodes = screen.getAllByTestId(/^canvas-node-/)
    expect(nodes).toHaveLength(docQaHuman.length)
    for (const node of nodes) {
      expect(node.querySelectorAll("[data-grounding]")).toHaveLength(1)
    }
  })

  it("shows 'Waits for you' on the llm_human_input phase and on NO other phase type", () => {
    renderCanvas(docQaHuman)
    const waiting = screen.getByTestId("canvas-node-confirm")
    expect(within(waiting).getByText("Waits for you")).toBeInTheDocument()
    expect(screen.getAllByText("Waits for you")).toHaveLength(1)
    for (const slug of ["draft", "finalize"]) {
      expect(
        screen.getByTestId(`canvas-node-${slug}`).querySelectorAll("[data-waits-for-you]"),
      ).toHaveLength(0)
    }
  })

  it("says grounding in WORDS, never colour alone (WCAG 1.4.1)", () => {
    renderCanvas(docQaHuman)
    const chip = within(screen.getByTestId("canvas-node-draft")).getByTestId("canvas-grounding")
    expect(chip.textContent).toContain("No sources needed")
  })
})

describe("WorkflowCanvas — the broken reference (D-183-10)", () => {
  it("renders a visibly broken marker naming the declared target", () => {
    renderCanvas(unresolvableSkip)
    const marker = screen.getByTestId("canvas-unresolved-skip")
    expect(marker.getAttribute("data-from-slug")).toBe("check")
    expect(marker.getAttribute("data-target-slug")).toBe("nonexistent")
    expect(marker.textContent).toContain("nonexistent")
    expect(marker.textContent).toMatch(/no such step/i)
  })

  it("no rendered edge terminates on a node id that is not in the DOM", async () => {
    const { container } = renderCanvas(unresolvableSkip)
    const model = toCanvas(unresolvableSkip)
    const byId = new Map(model.edges.map((e) => [e.id, e]))

    await waitFor(() => {
      expect(container.querySelectorAll(".react-flow__edge").length).toBeGreaterThan(0)
    })

    for (const el of Array.from(container.querySelectorAll(".react-flow__edge"))) {
      const edge = byId.get(el.getAttribute("data-id") ?? "")
      expect(edge).toBeDefined()
      for (const endpoint of [edge!.source, edge!.target]) {
        expect(
          container.querySelector(`.react-flow__node[data-id="${CSS.escape(endpoint)}"]`),
        ).not.toBeNull()
      }
    }
  })
})

describe("WorkflowCanvas — edges actually paint (assumption A1)", () => {
  it("renders one DOM edge per model edge", async () => {
    const { container } = renderCanvas(researchSummarize)
    const expected = toCanvas(researchSummarize).edges.length
    expect(expected).toBeGreaterThan(0)
    // The mocked ResizeObserver fires on a setTimeout(…, 0), so a synchronous count
    // runs before the observer callback and is unreliable.
    await waitFor(() => {
      expect(container.querySelectorAll(".react-flow__edge")).toHaveLength(expected)
    })
  })
})

describe("WorkflowCanvas — accessibility", () => {
  it("has no axe violations on a rendered canvas", async () => {
    const { container } = renderCanvas(evalCoverage)
    await waitFor(() => {
      expect(container.querySelectorAll(".react-flow__edge").length).toBeGreaterThan(0)
    })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no axe violations on the empty state", async () => {
    const { container } = renderCanvas(emptyDraft)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("WorkflowCanvas — the scope fences (source guard)", () => {
  it("suppresses the interactivity lock in source", () => {
    expect(workflowCanvasSource).toContain("showInteractive={false}")
  })

  it("ships no minimap and no attribution removal", () => {
    expect(workflowCanvasSource).not.toMatch(/MiniMap/)
    expect(workflowCanvasSource).not.toMatch(/hideAttribution/)
  })

  it("makes no network call and reads no Phase-185 authoring field", () => {
    expect(workflowCanvasSource).not.toMatch(/workflows\/validate/)
    expect(workflowCanvasSource).not.toMatch(/grounding_mode/)
  })
})
