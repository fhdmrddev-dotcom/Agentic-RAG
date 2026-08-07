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
// 188.1-03 — the two modules the extraction created, read the same way and for the same
// reason: the ESM-cycle fence below is about their IMPORT GRAPH, which no rendered DOM
// can show and neither `tsc` nor eslint can fail on.
import planeEditingLayerSource from "./PlaneEditingLayer?raw"
import editAffordanceSource from "./editAffordance?raw"
import { WorkflowCanvas } from "./WorkflowCanvas"
import { toCanvas } from "./canvasModel"
import {
  docQaHuman,
  evalCoverage,
  emptyDraft,
  researchSummarize,
  unresolvableSkip,
} from "./__fixtures__/canvasFixtures"
import { runReadingLabel, type NodeRunState } from "./runVocabulary"
import type { CanvasReading } from "@/lib/phaseState"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"

// ── 188.1-01 — THE SUBTREE SOURCE, and why it names files that do not exist yet ──────
//
// The house `?raw` / `import.meta.glob` directory sweep (`PhaseFormPanel.rails.test.tsx:422-426`,
// cited by `governanceVocabulary.test.ts:65` as "the house idiom"), narrowed to the canvas
// subtree by an explicit path list. Every NEGATIVE fence in this file reads this instead of
// `workflowCanvasSource`; every POSITIVE assertion, and the per-file count pin, does not.
//
// ⚠ TWO OF THE THREE PATHS DO NOT EXIST AT THIS COMMIT, AND THAT IS THE POINT.
// `PlaneEditingLayer.tsx` and `editAffordance.ts` arrive in plan 188.1-03, which cuts 311
// lines (`WorkflowCanvas.tsx:346-413` and `:486-728`) out of the canvas into them. A fence
// anchored on `WorkflowCanvas?raw` alone would stay GREEN across that move while covering
// 311 fewer lines — Phase 188's F7 lesson in a new dress: an invariance fence says nothing
// about what it no longer covers, and neither the count gate nor `tsc` can see the loss.
// Naming the two files BEFORE they exist means the extraction cannot narrow a fence.
// `import.meta.glob` expands at build time over files that EXIST, so a path with no file
// simply has no key in the record and contributes the empty string — it never throws.
const CANVAS_SUBTREE_PATHS = [
  "./WorkflowCanvas.tsx",
  "./PlaneEditingLayer.tsx",
  "./editAffordance.ts",
] as const
const CANVAS_MODULES = import.meta.glob("./*.{ts,tsx}", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>
const canvasSubtreeSource = CANVAS_SUBTREE_PATHS.map((path) => CANVAS_MODULES[path] ?? "").join(
  "\n",
)

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
    /** 185-09: the server's KB-reading tool names. OMITTED on every shipped call above,
     *  and omitting it marks NOTHING — `toCanvas` defaults it to a frozen empty list — so
     *  passing `undefined` here leaves every pre-185 assertion projecting exactly as it
     *  did. Only the grounded-node walk below supplies one. */
    kbTools?: readonly string[]
    /** 188-07: the page-owned run-state lookup. OMITTED on every shipped call above and
     *  on every shipped caller in the app, and omitting it puts NO node in run mode — so
     *  passing `undefined` here leaves every pre-188 assertion rendering exactly as it
     *  did. Only the RUNVIZ-01 block at the foot of this file supplies one. */
    runState?: (slug: string) => NodeRunState | undefined
    /** 188.1-01: the editing switch. OMITTED on every shipped call above, and omitting it
     *  mounts NO `PlaneEditingLayer` at all — so passing `undefined` here leaves every
     *  pre-188.1 assertion rendering exactly as it did. Only the SC#4 editable walk in the
     *  tab-stop block supplies one, and it exists because that block's two shipped
     *  assertions render read-only and therefore never reached the layer. */
    editable?: boolean
  } = {},
) {
  const ui = (
    <div style={{ width: 1200, height: 800 }}>
      <WorkflowCanvas
        phases={phases}
        selectedSlug={opts.selectedSlug ?? null}
        onSelectNode={opts.onSelectNode ?? vi.fn()}
        onClearSelection={opts.onClearSelection ?? vi.fn()}
        kbTools={opts.kbTools}
        runState={opts.runState}
        editable={opts.editable}
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

/**
 * 185-09 — the same canvas with a step that must PROVE ITSELF.
 *
 * `docQaHuman` with its agent step switched on to read the knowledge base. That is the
 * `detected` grounding cause, the one an author cannot undo (sketch 142-B), and it is
 * driven the way the live surface drives it: the tool is on the phase, the KB list comes
 * from the SERVER through `kbTools`, and the client only intersects the two. The other
 * two steps stay open, so the walk below sees both kinds of node in one render.
 */
const KB_TOOL = "search_documents"
const docQaHumanGrounded: typeof docQaHuman = docQaHuman.map((phase) =>
  phase.slug === "draft"
    ? { ...phase, config: { ...phase.config, available_tools: [KB_TOOL] } }
    : phase,
)

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

  it("BOTH halves still hold when a node wears the governance seal (185-09, criterion 24)", () => {
    // T-185-09-01: a focusable seal would be a SECOND tab stop per node — ten tab presses
    // to cross five steps, and a screen reader announcing every step twice. That is the
    // whole reason the ✕ and ＋ live on the lane rather than in the card, so the seal is
    // walked here, at the canvas level, and not only in the card's isolated suite.
    const { container } = renderCanvas(docQaHumanGrounded, { kbTools: [KB_TOOL] })

    // NON-VACUITY, twice over. The shipped guard (nodes exist) is kept verbatim — it is
    // the reason the loop means anything — and a second one is added: the seal this test
    // exists for is really on the canvas. Without it, a `grounded` prop that silently
    // stopped being threaded would leave this test green while testing nothing.
    const nodes = Array.from(container.querySelectorAll(".react-flow__node"))
    expect(nodes.length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-testid="canvas-node-seal"]')).toHaveLength(1)
    expect(
      screen.getByTestId("canvas-node-draft").querySelectorAll('[data-testid="canvas-node-seal"]'),
    ).toHaveLength(1)

    // …and the two shipped assertions, re-run over this canvas.
    expect(container.querySelectorAll('.react-flow__node[tabindex="0"]')).toHaveLength(
      docQaHumanGrounded.length,
    )
    for (const node of nodes) {
      expect(node.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
    }
  })

  it("no focusable control exists inside a node WHEN THE EDITING LAYER IS MOUNTED (188.1-01)", () => {
    // ⚠ A MEASURED CORRECTION, not a new invariant. SC#4's two shipped assertions above
    // both render READ-ONLY (`renderCanvas(evalCoverage)` / `renderCanvas(docQaHumanGrounded,
    // { kbTools })`), and `PlaneEditingLayer` — the only thing on this surface that renders
    // `<button>`s near a card at all — mounts ONLY under `editable`. So before this commit
    // the walk never saw the `＋` or the `✕`, and the invariant "the affordances live on the
    // LANE, never inside a card" was enforced against a render that had no affordances in
    // it. That is vacuity with respect to exactly the code 188.1-03 moves out.
    const { container } = renderCanvas(evalCoverage, { editable: true })

    // NON-VACUITY CONTROL FIRST (the `FlowEdge.test.tsx:294-301` house shape), so an empty
    // result below is evidence rather than a broken matcher: the affordances really ARE in
    // this DOM. Proven by inversion — `toHaveLength(0)` here fails.
    expect(
      container.querySelectorAll('[data-testid^="canvas-insert-"]').length,
    ).toBeGreaterThan(0)
    expect(
      container.querySelectorAll('[data-testid^="canvas-remove-"]').length,
    ).toBeGreaterThan(0)

    // The invariant under test is WHERE they live, not whether they exist — so the tab-stop
    // count is asserted too. One stop per node, with the layer mounted.
    expect(container.querySelectorAll('.react-flow__node[tabindex="0"]')).toHaveLength(
      evalCoverage.length,
    )

    const nodes = Array.from(container.querySelectorAll(".react-flow__node"))
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(node.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
    }
  })

  it("the seal is threaded from the DEFINITION, not painted on every node", () => {
    // The negative half of the same wiring: switch the KB list off and the identical
    // definition marks nothing. This is what makes the assertion above evidence about
    // `grounded` rather than about a seal that renders unconditionally.
    const { container } = renderCanvas(docQaHumanGrounded)
    expect(container.querySelectorAll('[data-testid="canvas-node-seal"]')).toHaveLength(0)
  })
})

describe("WorkflowCanvas — the ⌥ Technical-names reveal (D-183-08)", () => {
  it("shows plain-language titles by default and no slug on any node face", () => {
    renderCanvas(evalCoverage, { provider: true })
    expect(screen.getByText("Prepare the inputs")).toBeInTheDocument()
    // 187-04: the `llm_human_input` face is now `derivedFace` tier 4, not the
    // `PHASE_TYPE_SENTENCES` fallback — that tier reads no id→name lookup, so it
    // resolves even with the name context omitted (D-187-04). The assertion this
    // test makes is unchanged: a plain-language title, and no slug on any face.
    expect(screen.getByText("Wait for your approval")).toBeInTheDocument()
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
    expect(canvasSubtreeSource).not.toMatch(/MiniMap/)
    expect(canvasSubtreeSource).not.toMatch(/hideAttribution/)
  })

  it("makes no network call and reads no Phase-185 authoring field", () => {
    expect(canvasSubtreeSource).not.toMatch(/workflows\/validate/)
    expect(canvasSubtreeSource).not.toMatch(/grounding_mode/)
  })

  it("the subtree fence covers the code 188.1-03 moves, wherever that code lives", () => {
    // MOVE-INVARIANT CONTROL. Both literals are true TODAY — `EDIT_AFFORDANCE` is declared
    // at `WorkflowCanvas.tsx:365` and `PlaneEditingLayer` at `:569` — and stay true AFTER
    // 188.1-03 moves them into `editAffordance.ts` / `PlaneEditingLayer.tsx`, because the
    // path list above already names those files. So this proves the fenced source really
    // reaches the moved code at BOTH ends of the refactor, and it goes red the moment a
    // later edit narrows `CANVAS_SUBTREE_PATHS` past one of the two homes.
    expect(canvasSubtreeSource).toContain("EDIT_AFFORDANCE = {")
    expect(canvasSubtreeSource).toContain("function PlaneEditingLayer(")
    // NON-VACUITY: a truncated list or a glob that resolved to nothing cannot satisfy the
    // two lines above by accident, because both the list's length and the record's
    // non-emptiness are pinned here (the `PhaseFormPanel.rails.test.tsx:440` control shape).
    expect(CANVAS_SUBTREE_PATHS).toHaveLength(3)
    expect(Object.keys(CANVAS_MODULES).length).toBeGreaterThan(5)
    // …and the two DESTINATIONS are named individually, because a length pin catches a
    // TRUNCATION but not a SUBSTITUTION: swapping `./PlaneEditingLayer.tsx` for any other
    // path keeps the length at 3 and — while the code still sits in the canvas — keeps both
    // `toContain`s green too. Measured RED under exactly that edit before this line existed.
    for (const path of ["./PlaneEditingLayer.tsx", "./editAffordance.ts"] as const) {
      expect(CANVAS_SUBTREE_PATHS).toContain(path)
      // And once 188.1-03 creates the file, the sweep must really resolve it — a fence that
      // names a module the glob pattern no longer matches reads an empty string in silence.
      if (path in CANVAS_MODULES) expect(CANVAS_MODULES[path].length).toBeGreaterThan(0)
    }
  })
})

// ── 188.1-03 — THE ESM-CYCLE FENCE (SC#3, T-188.1-05) ────────────────────────────────
//
// WHY A TEST AND NOT A DOCBLOCK. `WorkflowCanvas.tsx` imports `FlowEdge`'s component
// VALUE at module scope for its `edgeTypes` map, so the canvas subtree already contains a
// live value-level edge. If either module 188.1-03 extracted imported `WorkflowCanvas`
// back, the cycle would typecheck clean and lint clean and fail only at RUNTIME — a TDZ
// `ReferenceError` in whichever module a caller reached first, which under Vitest is
// whichever suite happens to import first. Nothing in the build can see that, so the
// constraint is spelled as an assertion over the two files' own source.
//
// The forbidden shape is stated ONCE and covers every import form deliberately: a static
// import, a re-export, and `import type` all end in `from "<specifier>"`, and a type-only
// import back is forbidden too even though it is erased at build — `verbatimModuleSyntax`
// makes the value/type distinction easy to get wrong under a later edit, and a fence that
// permits the cheap mistake is not worth the line it costs. Dynamic `import()` is its own
// regex because it has no `from`.
//
// ⚠ `(\.[jt]sx?)?` IS LOAD-BEARING AND WAS ADDED AT `/gsd:secure-phase 188.2`. This fence is
// 188.1-03's, and it shipped with the SAME hole its 188.2 sibling did — the quote was anchored
// to close immediately after `WorkflowCanvas`, so `from "./WorkflowCanvas.tsx"` evaded it in
// every form. `frontend/tsconfig.app.json:13-14` sets `"moduleResolution": "bundler"` WITH
// `"allowImportingTsExtensions": true`, so that specifier compiles and resolves and would build
// a real TDZ cycle under a green fence. Fixed here in the same commit as
// `PhaseNodeCard.test.tsx:592-593` because one file's fix leaves the identical hole next door.
const IMPORT_FROM_CANVAS = /from\s+["'][^"']*WorkflowCanvas(\.[jt]sx?)?["']/
const DYNAMIC_IMPORT_CANVAS = /import\s*\(\s*["'][^"']*WorkflowCanvas(\.[jt]sx?)?["']\s*\)/

describe("WorkflowCanvas 188.1-03 — the extracted modules cannot import back (SC#3)", () => {
  it("the two regexes match the shapes they forbid, and both sources are really loaded", () => {
    // POSITIVE CONTROLS, inline and first: a fence whose matcher is broken passes
    // vacuously and looks exactly like a fence that holds.
    expect('import { WorkflowCanvas } from "./WorkflowCanvas"').toMatch(IMPORT_FROM_CANVAS)
    expect('import type { CanvasNotice } from "@/components/workflows/WorkflowCanvas"').toMatch(
      IMPORT_FROM_CANVAS,
    )
    expect('export { EDIT_AFFORDANCE } from "./WorkflowCanvas"').toMatch(IMPORT_FROM_CANVAS)
    expect('const m = await import("@/components/workflows/WorkflowCanvas")').toMatch(
      DYNAMIC_IMPORT_CANVAS,
    )
    // …and the SUFFIXED spelling of each, legal under `allowImportingTsExtensions: true` and
    // admitted by this fence's anchor until `/gsd:secure-phase 188.2`. One per form: an
    // optional group is only proven by exercising the branch that takes it.
    expect('import { WorkflowCanvas } from "./WorkflowCanvas.tsx"').toMatch(IMPORT_FROM_CANVAS)
    expect('import type { CanvasNotice } from "./WorkflowCanvas.tsx"').toMatch(IMPORT_FROM_CANVAS)
    expect('export { EDIT_AFFORDANCE } from "./WorkflowCanvas.tsx"').toMatch(IMPORT_FROM_CANVAS)
    expect('const m = await import("./WorkflowCanvas.tsx")').toMatch(DYNAMIC_IMPORT_CANVAS)
    // NEGATIVE CONTROLS — absent before `/gsd:secure-phase 188.2`, which is why widening the
    // anchor needed them written first. `?raw` is this very file's own spelling at line 32, and
    // it must keep missing under BOTH branches of the new optional group.
    for (const legal of [
      'import workflowCanvasSource from "./WorkflowCanvas?raw"',
      'import src from "./WorkflowCanvas.tsx?raw"',
    ]) {
      expect(legal).not.toMatch(IMPORT_FROM_CANVAS)
      expect(legal).not.toMatch(DYNAMIC_IMPORT_CANVAS)
    }
    // …and the subjects are non-empty, so the negatives below are about real files.
    expect(planeEditingLayerSource.length).toBeGreaterThan(0)
    expect(editAffordanceSource.length).toBeGreaterThan(0)
  })

  it("neither extracted module names a WorkflowCanvas specifier in ANY import form", () => {
    for (const source of [planeEditingLayerSource, editAffordanceSource]) {
      expect(source).not.toMatch(IMPORT_FROM_CANVAS)
      expect(source).not.toMatch(DYNAMIC_IMPORT_CANVAS)
    }
  })

  it("editAffordance is a LEAF — no react import, and no component module at all", () => {
    // The house naming rule in this directory is the mechanism: a PascalCase sibling is a
    // component module, a camelCase one is a plain module (10 of 10, measured by 188.1's
    // pattern map). So "imports no component" is checkable without listing every file.
    const COMPONENT_SIBLING = /from\s+["']@\/components\/workflows\/[A-Z]/
    const REACT_IMPORT = /from\s+["']react["']/
    // POSITIVE CONTROLS first.
    expect('import { StepTypePicker } from "@/components/workflows/StepTypePicker"').toMatch(
      COMPONENT_SIBLING,
    )
    expect('import { useMemo } from "react"').toMatch(REACT_IMPORT)

    expect(editAffordanceSource).not.toMatch(COMPONENT_SIBLING)
    expect(editAffordanceSource).not.toMatch(REACT_IMPORT)
    // Non-vacuity for the leaf claim: it DOES import the one thing it is allowed to, so
    // the two negatives above describe a wired module rather than an empty file.
    expect(editAffordanceSource).toMatch(/from\s+["']@\/components\/workflows\/canvasModel["']/)
  })

  it("the canvas imports the layer rather than declaring it — the cut has one direction", () => {
    // The other half of "no cycle": the edge exists, and it points one way. Without this
    // the three negatives above are also satisfied by two modules nobody uses.
    expect(workflowCanvasSource).toMatch(
      /import \{ PlaneEditingLayer \} from ["']@\/components\/workflows\/PlaneEditingLayer["']/,
    )
    expect(workflowCanvasSource).not.toContain("function PlaneEditingLayer(")
    // …and no re-export shim was left behind, which is what would quietly preserve the
    // coupling this phase exists to remove while every other assertion here stayed green.
    expect(workflowCanvasSource).not.toContain("EDIT_AFFORDANCE")
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

// ═══════════════════════════════════════════════════════════════════════════════
// 188-07 · RUNVIZ-01 — the capped run-state pass-through
// ═══════════════════════════════════════════════════════════════════════════════
//
// ⚠ A NOTE ON THE COUNT GATE, so the next author does not read a stale number. MEASURED at
// this commit, from the gate script's own printed `actual` column across two agreeing runs:
// this file is pinned at 48 in `scripts/vitest-count-gate.cjs` and RUNS 48 — ZERO slack.
// The gate fails on a DECREASE, so with the slack gone any case deleted from this file reds
// it immediately rather than being quietly absorbed. That is the point, but it also means a
// legitimate removal must ride a deliberate LOWERING of the pin in the same commit, per the
// LOWERED / EXTENDED doctrine in the script's own header. Re-pin the same way this number
// was arrived at — the script's `actual` column, twice, and never by hand-counting `it(`
// literals (`definitionOps.test.ts` declares ~122 and runs 232 under `it.each`).
//
// ⚠ REWRITTEN BY 188.1-02 — this note previously put the pin at thirty-one against a run of
// thirty-five and told the reader there were four spare cases of slack to sit in. Both
// figures were true when 188-07 wrote them and neither survived the year: 185-08 (`30cb77f9`)
// was the last commit at which the pin was thirty-one, 188-12 (`37b8cb49`) re-pinned this
// file to 46 in the pass that pinned every suite the gate executes at its measured actual,
// and 188.1-01 (`262543ae`) extended it to 48 when the editable SC#4 walk landed. All three
// read back out of `git show <sha>:scripts/vitest-count-gate.cjs` rather than inherited from
// any document. The note's METHOD was right all along and is exactly why the arithmetic
// could be corrected at all; only its numbers rotted, which is the default fate of a figure
// in a comment that no machine checks. Its warning about slack is now the OPPOSITE of the
// truth — there is none — which is the one kind of staleness worth spending an edit on.
//
// THE PROPERTY THIS BLOCK EXISTS TO PIN. `WorkflowCanvas.tsx` is a G-5 hot file — nine
// plans across three phases — and this phase honours the guardrail by SCOPE: the run
// state crosses it as an opaque value it neither derives, words nor inspects, inside a
// diff capped at 15 insertions / 4 deletions and measured with `git diff --numstat`
// (13/2 as shipped). Everything below is what makes that cap structural rather than a
// promise: if the canvas ever learned to derive a reading, the fences would go red.

/** A run state in the shape the PAGE builds one. The label is worded by the single
 *  vocabulary function, never hand-typed — the canvas must receive it already worded. */
function mkRun(reading: CanvasReading): NodeRunState {
  return { reading, label: runReadingLabel(reading) }
}

/** Needles assembled from parts, so this suite's own source cannot satisfy a grep later
 *  run over a file set that includes it (the 187-24 lesson). Positive controls below. */
const READING_WORDS = [
  ["Not ", "started"].join(""),
  ["Runn", "ing"].join(""),
  ["Comp", "lete"].join(""),
  ["Fai", "led"].join(""),
  ["Skip", "ped"].join(""),
  ["Paused for ", "your answer"].join(""),
  ["State ", "unknown"].join(""),
] as const
const ORDINAL_FIELD = ["phase", "_index"].join("")
const ORDINAL_CAMEL = ["phase", "Index"].join("")

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
}

describe("WorkflowCanvas 188-07 — the prop mirror (run state passes through)", () => {
  it("hands each node exactly what the lookup returned for ITS slug, and nothing to the rest", () => {
    const run = mkRun("running")
    const { container } = renderCanvas(researchSummarize, {
      runState: (slug) => (slug === "summarize" ? run : undefined),
    })

    const marked = screen.getByTestId("canvas-node-summarize")
    const line = marked.querySelector('[data-testid="canvas-node-run-line"]')
    expect(line).not.toBeNull()
    expect(line!.getAttribute("data-reading")).toBe("running")
    expect(line!.textContent).toBe(run.label)

    // The OTHER node got `undefined` and is therefore not in run mode at all — which is
    // what makes the assertion above evidence about the lookup rather than about a canvas
    // that paints a reading on everything.
    expect(
      screen
        .getByTestId("canvas-node-research")
        .querySelectorAll('[data-testid="canvas-node-run-line"]'),
    ).toHaveLength(0)
    expect(container.querySelectorAll('[data-testid="canvas-node-run-line"]')).toHaveLength(1)
  })

  it("distinct readings reach distinct nodes — the lookup is per-slug, not per-canvas", () => {
    const byslug: Record<string, CanvasReading> = { research: "done", summarize: "waiting-for-you" }
    renderCanvas(researchSummarize, {
      runState: (slug) => (byslug[slug] ? mkRun(byslug[slug]) : undefined),
    })
    for (const [slug, reading] of Object.entries(byslug)) {
      const line = screen
        .getByTestId(`canvas-node-${slug}`)
        .querySelector('[data-testid="canvas-node-run-line"]')
      expect(line?.getAttribute("data-reading")).toBe(reading)
    }
  })

  it("OMITTING the prop renders the shipped read-only Builder canvas — no run mode anywhere", () => {
    const { container } = renderCanvas(researchSummarize)
    expect(container.querySelectorAll('[data-testid="canvas-node-run-line"]')).toHaveLength(0)
    expect(container.querySelectorAll("[data-reading]")).toHaveLength(0)
    // Non-vacuity: the nodes really are on the canvas, so "no run line" is a statement
    // about rendered cards rather than about an empty plane.
    expect(screen.getAllByTestId(/^canvas-node-/).length).toBe(researchSummarize.length)
  })
})

describe("WorkflowCanvas 188-07 — the canvas DERIVES nothing (Req 2 · the G-5 cap)", () => {
  it("the stripper strips and every needle really matches (positive controls)", () => {
    expect(stripComments(workflowCanvasSource).length).toBeLessThan(workflowCanvasSource.length)
    for (const word of READING_WORDS) expect(`the step reads ${word}.`).toContain(word)
    expect(`{ ${ORDINAL_FIELD}: 3 }`).toContain(ORDINAL_FIELD)
    expect(`{ ${ORDINAL_CAMEL}: 3 }`).toContain(ORDINAL_CAMEL)
    expect(stripComments(`/* ${ORDINAL_FIELD} */`)).not.toContain(ORDINAL_FIELD)
  })

  it("spells NONE of the seven reading words — the vocabulary never entered this file", () => {
    // Asserted over the WHOLE source, comments included: unlike the ordinal below, no
    // shipped comment here names a reading, so the stronger claim is the true one.
    for (const word of READING_WORDS) expect(canvasSubtreeSource).not.toContain(word)
  })

  it("imports the run type TYPE-ONLY, and imports no derivation module at all", () => {
    // A type-only import contributes nothing to the runtime graph, which is what keeps
    // the live ESM cycle (`edgeTypes` holds `FlowEdge`'s VALUE at module scope) safe.
    expect(workflowCanvasSource).toMatch(
      /import type \{[^}]*NodeRunState[^}]*\} from ["']@\/components\/workflows\/runVocabulary["']/,
    )
    // …and NOT as a value import, which is how a vocabulary table would arrive.
    expect(canvasSubtreeSource).not.toMatch(
      /^import \{[^}]*\} from ["']@\/components\/workflows\/runVocabulary["']/m,
    )
    // The derivation module is not imported in ANY form — the reading is decided by the
    // page, once (D-188-01 / D-188-02). D-14 relevant, so it reads the whole subtree: an
    // extracted module that grew this import would otherwise be invisible here.
    expect(canvasSubtreeSource).not.toMatch(/from\s+["']@\/lib\/phaseState["']/)
    // POSITIVE CONTROLS — both regexes match the shapes they forbid.
    expect(
      'import { runReadingWord } from "@/components/workflows/runVocabulary"',
    ).toMatch(/^import \{[^}]*\} from ["']@\/components\/workflows\/runVocabulary["']/m)
    expect('import { canvasReading } from "@/lib/phaseState"').toMatch(
      /from\s+["']@\/lib\/phaseState["']/,
    )
  })

  it("reads no step ordinal in CODE — and its PROSE names it exactly once", () => {
    // A measured correction to the plan's acceptance grep, which asked for zero
    // occurrences in the file. That was already false at HEAD: the `onInsertAt` docblock
    // has named the ordinal since 184-12, explaining what the page renumbers. So the
    // fence is anchored on CODE, and the prose count is PINNED at one — which makes the
    // explanation exactly as hard to delete as the field is to introduce.
    const code = stripComments(canvasSubtreeSource)
    expect(code).not.toContain(ORDINAL_FIELD)
    expect(code).not.toContain(ORDINAL_CAMEL)
    // ⚠ THE COUNT PIN IS DELIBERATELY NOT WIDENED (188.1-01, T-188.1-04b). It is a
    // PER-FILE count: exactly one prose mention, in `WorkflowCanvas.tsx:845`'s `onInsertAt`
    // docblock, which stays put across 188.1-03. Pointing a count at three files changes
    // what the number means, so this line keeps reading `workflowCanvasSource` while the
    // two negatives above read the whole subtree.
    expect(workflowCanvasSource.match(new RegExp(ORDINAL_FIELD, "g")) ?? []).toHaveLength(1)
  })

  it("merges the run inside the SETTLED memo, never in the drag overlay (the anti-blink split)", () => {
    // The split is load-bearing: `handleNodesChange` fires on every pointer frame, and
    // when the overlay was a dependency of the ONE memo a drag rebuilt every node's
    // `data` ~60x/s and the cards visibly flickered. A run lookup in the overlay memo
    // would reintroduce exactly that, so the dependency list is pinned here.
    expect(workflowCanvasSource).toMatch(/const settledNodes = useMemo/)
    const settled = workflowCanvasSource.slice(
      workflowCanvasSource.indexOf("const settledNodes = useMemo"),
      workflowCanvasSource.indexOf("const nodes = useMemo"),
    )
    expect(settled).toMatch(/const run = runState\?\.\(node\.id\)/)
    expect(settled).toMatch(/\[projection\.nodes,[^\]]*runState[^\]]*\]/)
    // The overlay memo, taken as its own slice, names the lookup nowhere.
    const overlay = workflowCanvasSource.slice(workflowCanvasSource.indexOf("const nodes = useMemo"))
    expect(overlay).not.toContain("runState")
    // POSITIVE CONTROL — the slice really is the overlay memo and really is non-empty.
    expect(overlay).toContain("dragOverlay[node.id]")
  })
})

describe("WorkflowCanvas 188-07 — the run reading joins the node's ACCESSIBLE NAME", () => {
  /** The wrapper React Flow renders for a node — the element that owns the tab stop and
   *  the accessible name. The card's inner text is NOT part of that name, which is the
   *  whole reason this append exists. */
  function nodeLabel(container: HTMLElement, slug: string): string {
    const wrapper = container.querySelector(`.react-flow__node[data-id="${slug}"]`)
    expect(wrapper).not.toBeNull()
    return wrapper!.getAttribute("aria-label") ?? ""
  }

  it("appends the page's sentence to the shipped label, and leaves other nodes untouched", () => {
    const plain = renderCanvas(researchSummarize)
    const before = nodeLabel(plain.container, "summarize")
    const otherBefore = nodeLabel(plain.container, "research")
    expect(before.length).toBeGreaterThan(0)
    plain.unmount()

    const run = mkRun("failed")
    const withRun = renderCanvas(researchSummarize, {
      runState: (slug) => (slug === "summarize" ? run : undefined),
    })
    expect(nodeLabel(withRun.container, "summarize")).toBe(`${before} — ${run.label}`)
    // The node the lookup said nothing about keeps its shipped name, byte for byte.
    expect(nodeLabel(withRun.container, "research")).toBe(otherBefore)
  })

  it("the announced sentence IS the visible one — one function, so they cannot drift", () => {
    const run = mkRun("waiting-for-you")
    const { container } = renderCanvas(researchSummarize, { runState: () => run })
    const visible =
      screen
        .getByTestId("canvas-node-summarize")
        .querySelector('[data-testid="canvas-node-run-line"]')?.textContent ?? ""
    expect(visible.length).toBeGreaterThan(0)
    expect(nodeLabel(container, "summarize").endsWith(` — ${visible}`)).toBe(true)
  })

  it("no reading ⇒ the accessible name is byte-identical to the shipped one", () => {
    const a = renderCanvas(researchSummarize)
    const shipped = researchSummarize.map((p) => nodeLabel(a.container, p.slug))
    a.unmount()
    const b = renderCanvas(researchSummarize, { runState: () => undefined })
    expect(researchSummarize.map((p) => nodeLabel(b.container, p.slug))).toEqual(shipped)
    // Non-vacuity: the labels are real strings, not a list of empties.
    for (const label of shipped) expect(label.length).toBeGreaterThan(0)
  })
})
