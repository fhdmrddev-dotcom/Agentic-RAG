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
 *
 * Phase 183-08 gap closure (CR-01 / WR-06) added the keyboard-activation block and
 * the announced-affordance block below. Both were installed as a RED gate and
 * observed failing on unmodified source before the fix landed.
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
  opts: {
    selectedSlug?: string | null
    onSelectNode?: (slug: string) => void
    onClearSelection?: () => void
    provider?: boolean
  } = {},
) {
  const ui = (
    <div style={{ width: 1200, height: 800 }}>
      <WorkflowCanvas
        phases={phases}
        selectedSlug={opts.selectedSlug ?? null}
        onSelectNode={opts.onSelectNode ?? vi.fn()}
        onClearSelection={opts.onClearSelection ?? vi.fn()}
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
 *
 * The same driver rule governs the keyboard block that follows, and that block
 * exists because of what this one did NOT cover: the shipped suite asserted node
 * REACHABILITY (`.react-flow__node[tabindex="0"]` counted once per phase) but never
 * ACTIVATION, so it stayed green over a Critical defect — every focusable node
 * advertised a button role and did nothing at all when pressed.
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

/**
 * The keyboard half of the SAME D-183-05 contract. The node wrapper React Flow
 * renders carries `data-id` and the `react-flow__node` class, and it is the element
 * that owns the tab stop — so it is the element a keyboard user actually presses,
 * and the element these tests dispatch on. The inner `canvas-node-*` card is a
 * presentational child with no handlers of its own by design (one tab stop per node).
 */
describe("WorkflowCanvas — keyboard activation (CR-01, SC#3)", () => {
  it("Enter on a focused phase node fires onSelectNode with exactly that phase's slug", () => {
    const onSelectNode = vi.fn()
    const { container } = renderCanvas(researchSummarize, { onSelectNode })
    const node = container.querySelector('.react-flow__node[data-id="summarize"]')
    expect(node).not.toBeNull()
    fireEvent.keyDown(node!, { key: "Enter" })
    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith("summarize")
  })

  it("Space on a focused phase node fires onSelectNode with exactly that phase's slug", () => {
    const onSelectNode = vi.fn()
    const { container } = renderCanvas(researchSummarize, { onSelectNode })
    const node = container.querySelector('.react-flow__node[data-id="research"]')
    expect(node).not.toBeNull()
    // The single space character — what KeyboardEvent.key reports for the space bar.
    fireEvent.keyDown(node!, { key: " " })
    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith("research")
  })

  it("Enter on the end cap and on the unresolved-skip stub fires nothing (mirrors the mouse path)", () => {
    const onSelectNode = vi.fn()
    renderCanvas(unresolvableSkip, { onSelectNode })
    fireEvent.keyDown(screen.getByTestId("canvas-end-cap"), { key: "Enter" })
    fireEvent.keyDown(screen.getByTestId("canvas-unresolved-skip"), { key: "Enter" })
    expect(onSelectNode).not.toHaveBeenCalled()
  })

  it("a HELD Enter activates exactly once — auto-repeat cannot rapid-toggle (WR-08-01)", () => {
    // `repeat: true` is the entire point: synthetic events never set it implicitly,
    // which is exactly why the shipped 183-08 keyboard tests could not see this defect.
    // The consumer is a TOGGLE, so an unguarded repeat leaves the panel's terminal
    // state decided by the parity of the repeat count.
    const onSelectNode = vi.fn()
    const { container } = renderCanvas(researchSummarize, { onSelectNode })
    const node = container.querySelector('.react-flow__node[data-id="summarize"]')
    expect(node).not.toBeNull()

    fireEvent.keyDown(node!, { key: "Enter" })
    fireEvent.keyDown(node!, { key: "Enter", repeat: true })
    fireEvent.keyDown(node!, { key: "Enter", repeat: true })

    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith("summarize")
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

describe("WorkflowCanvas — the badge slots (D-183-07, Phase 185 frees slot 1)", () => {
  it("NO phase node carries a grounding chip — slot 1 is empty and reserved", () => {
    // Phase 185 / SPEC Req 6: the three-face word-badge is DELETED, not moved.
    // Governance renders as shape (the corner seal, 185-09); the freed slot belongs
    // to 188/189. Asserted as an absence on every node, so a resurrected chip fails
    // here rather than being noticed in a screenshot.
    renderCanvas(docQaHuman)
    const nodes = screen.getAllByTestId(/^canvas-node-/)
    expect(nodes).toHaveLength(docQaHuman.length)
    for (const node of nodes) {
      expect(node.querySelectorAll("[data-grounding]")).toHaveLength(0)
      expect(node.querySelectorAll('[data-testid="canvas-grounding"]')).toHaveLength(0)
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

  it("the badge that SURVIVES still says its meaning in WORDS (WCAG 1.4.1)", () => {
    // The never-colour-alone rule did not go away with the grounding chip — it moved
    // to the one badge still rendered. Slot 2 carries a readable sentence, and the
    // step that has no badge at all renders none rather than a wordless mark.
    renderCanvas(docQaHuman)
    const waiting = within(screen.getByTestId("canvas-node-confirm")).getByTestId(
      "canvas-waits-for-you",
    )
    expect(waiting.textContent).toContain("Waits for you")
    // …and the ordinary step now carries NO badge at all — neither of the two the
    // card can render. A wordless mark is not what replaced the chip; nothing did.
    const draft = screen.getByTestId("canvas-node-draft")
    expect(draft.querySelectorAll("[data-waits-for-you], [data-grounding]")).toHaveLength(0)
    expect(
      draft.querySelectorAll('[data-testid="canvas-waits-for-you"], [data-testid="canvas-grounding"]'),
    ).toHaveLength(0)
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

/**
 * WR-06 — what the screen reader is TOLD must be what the surface DOES. React Flow
 * ships a single description element that every node points at via
 * `aria-describedby`, and its default text promises node deletion and arrow-key
 * movement. Neither exists on a read-only canvas, so the default is a lie told once
 * per node.
 */
describe("WorkflowCanvas — the announced affordance (WR-06)", () => {
  it("describes only what this surface does — no delete, no arrow-key movement", () => {
    const { container } = renderCanvas(evalCoverage)
    const desc = container.querySelector('[id^="react-flow__node-desc"]')
    expect(desc).not.toBeNull()

    const text = desc!.textContent ?? ""
    expect(text).toMatch(/open this step's details/i)
    expect(text).not.toMatch(/delete/i)
    expect(text).not.toMatch(/arrow keys/i)
    expect(text).not.toMatch(/remove it/i)

    // …and it is the description a screen reader actually reaches from a node.
    const described = container.querySelector(
      `.react-flow__node[aria-describedby="${desc!.id}"]`,
    )
    expect(described).not.toBeNull()
  })

  it("the two INERT nodes do not inherit the activation description (WR-08-04)", () => {
    // The library points EVERY node at its single description element unconditionally
    // on focusability. The end cap and the broken-reference stub are the two nodes the
    // CR-01 guard keeps inert, so the promise is one they provably cannot honour.
    const { container } = renderCanvas(unresolvableSkip)
    const desc = container.querySelector('[id^="react-flow__node-desc"]')
    expect(desc).not.toBeNull()

    // POSITIVE CONTROL FIRST — a real phase node still carries the description, so a
    // blanket suppression (or a mis-resolved selector) cannot make this vacuously green.
    const phaseWrapper = container.querySelector('.react-flow__node[data-id="start"]')
    expect(phaseWrapper).not.toBeNull()
    expect(phaseWrapper!.getAttribute("aria-describedby")).toBe(desc!.id)

    for (const testId of ["canvas-end-cap", "canvas-unresolved-skip"]) {
      const wrapper = screen.getByTestId(testId).closest(".react-flow__node")
      // A null `closest` must FAIL, never silently satisfy the negative assertion.
      expect(wrapper).not.toBeNull()
      expect(wrapper!.getAttribute("aria-describedby")).not.toBe(desc!.id)
    }
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

// ── Measurements survive a node rebuild ─────────────────────────────────────────
//
// The operator reported a dragged card "blinks out and back". Cause, from
// @xyflow/system's adoptUserNodes: when the node object handed to the library is a NEW
// reference it rebuilds its internal node and reads `measured` from OUR object; if that
// is undefined it sets nodesInitialized = false and the node renders HIDDEN until it is
// measured again. 184 hands back a new object for the dragged node on every pointer
// frame, so the card was hidden ~60x/s. 183 never hit this because a read-only canvas
// hands back the SAME references, taking the equality branch that preserves measurement.
//
// jsdom measures everything as 0, so this cannot assert a rendered height. It asserts the
// ECHO — the mechanism the library actually needs.
describe("WorkflowCanvas 184-12 — the library's measurement is echoed back", () => {
  it("consumes dimensions changes, not only position changes", () => {
    expect(workflowCanvasSource).toMatch(/change\.type !== "position"/)
    expect(workflowCanvasSource).toMatch(/change\.type !== "dimensions"/)
  })

  it("threads a measured field back onto the node objects", () => {
    // Not merely READ for layout (heightAt does that) — spread onto the node we hand back.
    expect(workflowCanvasSource).toMatch(/\{ measured \}/)
  })
})
