/**
 * Phase 103-04 Task 1 (REQ-4 / WFAUTH-03, sketch 019-D) — PhaseSpineGraph tests.
 *
 * The read-only VERTICAL phase-spine graph. These tests pin the locked contract:
 *  - nodes appear in strict phase_index order (DOM order asserted).
 *  - a `skip_to_phase:<slug>` validator renders EXACTLY ONE dashed edge landing on
 *    the resolved target node (the only non-linear edge).
 *  - STATIC drag-free check: ZERO draggable=true / drag handlers / connection-handle
 *    / add-node control anywhere in the DOM (the REQ-4 acceptance-c bar).
 *  - the "View only" badge + the legend + phase-type glyphs render; phase.name uses
 *    a non-empty fallback when absent.
 *  - the module never imports PhaseTimeline/PhaseCard (G-5 — source-grep assertion).
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
// Read the component SOURCE via Vite's ?raw loader (the idiomatic vitest way —
// typechecks under `vite/client`, no node:fs/process needed) for the G-5 grep.
import phaseSpineGraphSource from "./PhaseSpineGraph?raw"
import { PhaseSpineGraph, type PhaseSpecJSON } from "./PhaseSpineGraph"

/** A 3-phase draft (intentionally OUT of phase_index order in the array to prove
 *  the component sorts; the rendered order must be 0,1,2 regardless of input order). */
const threePhases: PhaseSpecJSON[] = [
  {
    slug: "review",
    phase_index: 2,
    name: "Review the findings",
    config: { phase_type: "llm_agent", prompt: "review", available_tools: ["search_documents"] },
  },
  {
    slug: "gather",
    phase_index: 0,
    name: "Gather sources",
    config: { phase_type: "llm_agent", prompt: "gather", available_tools: ["search_documents"] },
  },
  {
    slug: "emit",
    phase_index: 1,
    // name intentionally ABSENT → the fallback (type label / slug) must render.
    config: { phase_type: "llm_emit", prompt: "emit", emitter: "render_template", citation_policy: "strict" },
  },
]

/** A draft whose phase 0 carries a `skip_to_phase:<slug>` on-fail validator → one
 *  dashed edge to the matched target node. */
const skipPhases: PhaseSpecJSON[] = [
  {
    slug: "gather",
    phase_index: 0,
    name: "Gather",
    config: { phase_type: "llm_agent", prompt: "g", available_tools: ["search_documents"] },
    validators: [{ kind: "freshness", on_failure: "skip_to_phase:human-confirm" }],
  },
  {
    slug: "draft",
    phase_index: 1,
    name: "Draft",
    config: { phase_type: "llm_single", prompt: "d" },
  },
  {
    slug: "human-confirm",
    phase_index: 2,
    name: "Confirm",
    config: { phase_type: "llm_human_input", prompt: "ok?" },
  },
]

describe("PhaseSpineGraph — read-only vertical spine", () => {
  it("renders one node per phase in strict phase_index order", () => {
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    const nodes = screen.getAllByRole("button", { name: /phase/i })
    expect(nodes).toHaveLength(3)
    // DOM order must be phase_index 0,1,2 → slugs gather, emit, review.
    const order = nodes.map((n) => n.getAttribute("data-slug"))
    expect(order).toEqual(["gather", "emit", "review"])
  })

  it("renders phase.name when present and a non-empty fallback when absent", () => {
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText("Gather sources")).toBeInTheDocument()
    expect(screen.getByText("Review the findings")).toBeInTheDocument()
    // The emit phase has no name → the fallback node still has a non-empty title.
    const emitNode = screen.getByTestId("spine-node-emit")
    const title = within(emitNode).getByTestId("node-title")
    expect(title.textContent?.trim().length ?? 0).toBeGreaterThan(0)
  })

  it("renders the phase-type glyphs (each node card carries its type glyph)", () => {
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    // Scope to each node card so the bullet + card duplication doesn't skew counts.
    const gather = screen.getByTestId("spine-node-gather")
    const review = screen.getByTestId("spine-node-review")
    const emit = screen.getByTestId("spine-node-emit")
    expect(within(gather).getByText("🤖")).toBeInTheDocument() // llm_agent
    expect(within(review).getByText("🤖")).toBeInTheDocument() // llm_agent
    expect(within(emit).getByText("◆")).toBeInTheDocument() // llm_emit
  })

  it("renders a 'View only' badge and the read-only legend", () => {
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText(/view only/i)).toBeInTheDocument()
    expect(screen.getByText(/READ-ONLY GRAPH/i)).toBeInTheDocument()
    expect(screen.getByText(/inspect, don't drag/i)).toBeInTheDocument()
  })

  it("renders EXACTLY ONE dashed skip edge landing on the resolved target node", () => {
    render(<PhaseSpineGraph phases={skipPhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    const skipEdges = screen.getAllByTestId("skip-edge")
    expect(skipEdges).toHaveLength(1)
    // The edge resolves its target the parse_skip_target way (split on the last ":")
    // → "human-confirm". The edge declares its target slug for assertion.
    expect(skipEdges[0].getAttribute("data-target-slug")).toBe("human-confirm")
  })

  it("renders NO skip edge when no validator carries skip_to_phase", () => {
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    expect(screen.queryAllByTestId("skip-edge")).toHaveLength(0)
  })

  it("calls onSelectNode with the phase slug on node click (selection only)", async () => {
    const onSelect = vi.fn()
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={onSelect} />)
    await user.click(screen.getByTestId("spine-node-gather"))
    expect(onSelect).toHaveBeenCalledWith("gather")
  })

  it("STATIC drag-free DOM: no draggable=true, no drag handler attrs, no connection-handle, no add-node control", () => {
    const { container } = render(
      <PhaseSpineGraph phases={skipPhases} selectedSlug={null} onSelectNode={vi.fn()} />,
    )
    // No draggable element.
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(0)
    expect(container.querySelectorAll("[draggable]")).toHaveLength(0)
    // No connection handles / add-node controls (by data hook).
    expect(container.querySelectorAll('[data-connection-handle]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-add-node]')).toHaveLength(0)
    // No "add" / "+" build affordance buttons (the graph is inspect-only).
    const buttons = Array.from(container.querySelectorAll("button"))
    for (const b of buttons) {
      const label = (b.getAttribute("aria-label") ?? "") + (b.textContent ?? "")
      expect(label.toLowerCase()).not.toContain("add node")
    }
  })

  it("the selected node carries an open/selected affordance (selection anchor)", () => {
    render(<PhaseSpineGraph phases={threePhases} selectedSlug="gather" onSelectNode={vi.fn()} />)
    expect(screen.getByTestId("spine-node-gather").getAttribute("data-selected")).toBe("true")
    expect(screen.getByTestId("spine-node-review").getAttribute("data-selected")).toBe("false")
  })

  it("the SOURCE never imports PhaseTimeline or PhaseCard (G-5)", () => {
    const src = phaseSpineGraphSource
    expect(src).not.toMatch(/PhaseTimeline/)
    expect(src).not.toMatch(/PhaseCard/)
    // No graph lib import either.
    expect(src).not.toMatch(/react-flow|reactflow|\bd3\b|dagre/)
  })
})
