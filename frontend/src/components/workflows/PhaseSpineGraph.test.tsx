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
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, within } from "@testing-library/react"
import {
  TechnicalNamesProvider,
  useTechnicalNames,
} from "@/providers/TechnicalNamesProvider"
// Read the component SOURCE via Vite's ?raw loader (the idiomatic vitest way —
// typechecks under `vite/client`, no node:fs/process needed) for the G-5 grep.
import phaseSpineGraphSource from "./PhaseSpineGraph?raw"
import { PhaseSpineGraph } from "./PhaseSpineGraph"
import type { PhaseSpecJSON } from "./phaseVocabulary"

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
    // name intentionally ABSENT → the fallback must render. Since D-183-06 that
    // fallback is the plain-language sentence ("Produce the deliverable") with NO
    // slug in it; the old "<type label> · <slug>" form is still reachable behind the
    // ⌥ reveal (D-183-08) — covered by the "technical names" block at the bottom.
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
    // …and with the reveal OFF that fallback carries no slug (D-183-06).
    expect(title.textContent).not.toContain("emit")
  })

  it("renders the 3D phase-type mark on each node card (data-phase-type + svg hooks)", () => {
    // Migrated from literal unicode assertions to the durable hooks the 127-01
    // migration established (PhaseSpine.test.tsx:38-55): the flat text glyphs this
    // file used to assert no longer render — the spine draws the bundled 3D marks.
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    // Scope to each node card so the bullet + card duplication doesn't skew counts.
    const gather = screen.getByTestId("spine-node-gather")
    const review = screen.getByTestId("spine-node-review")
    const emit = screen.getByTestId("spine-node-emit")
    expect(gather.getAttribute("data-phase-type")).toBe("llm_agent")
    expect(review.getAttribute("data-phase-type")).toBe("llm_agent")
    expect(emit.getAttribute("data-phase-type")).toBe("llm_emit")
    expect(gather.querySelector("svg")).not.toBeNull()
    expect(review.querySelector("svg")).not.toBeNull()
    expect(emit.querySelector("svg")).not.toBeNull()
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
    // The target is resolved by slicing off the literal `skip_to_phase:` prefix BY
    // LENGTH — the backend's semantics (reachability.py:89-98), which the shared
    // parseSkipTarget now matches (correction C-1). This fixture's on_failure has no
    // extra colon, so the expected value is unchanged by that correction.
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
    // No graph lib import either — the spine is plain HTML/CSS, and it must never
    // reach for the canvas library (@xyflow/react) that lands beside it in 183.
    expect(src).not.toMatch(/react-flow|reactflow|xyflow|\bd3\b|dagre/)
  })

  it("the SOURCE declares no second copy of the shared vocabulary (D-183-13, G-6)", () => {
    // The machine-checkable form of "no third copy exists at phase end". The glyph
    // map lives in soulData, the on-fail parse and the read shapes in
    // phaseVocabulary — this file imports all of them and declares none.
    const src = phaseSpineGraphSource
    expect(src).not.toMatch(/const PHASE_GLYPHS/)
    expect(src).not.toMatch(/const PHASE_TYPE_LABELS/)
    expect(src).not.toMatch(/(function|const)\s+parseSkipTarget/)
    expect(src).not.toMatch(/interface (PhaseSpecJSON|PhaseConfigJSON|ValidatorJSON)/)
    // The retired last-colon split is gone with it (correction C-1).
    expect(src).not.toMatch(/lastIndexOf/)
    // …and it really does import from the one shared home.
    expect(src).toMatch(/phaseVocabulary/)
    expect(src).toMatch(/soulData/)
  })
})

/**
 * Phase 183-04 Task 1 (D-183-06 / D-183-08) — the ⌥ technical names reveal.
 *
 * The spine's DEFAULT face is now the plain-language business sentence, so the slug
 * it used to always show must stay REACHABLE. It is — through the SAME app-wide
 * `TechnicalNamesProvider` state the canvas reads (183-06), with the same fallback
 * ordering, so the two views name every phase identically in BOTH modes. That
 * symmetry is what stops the G-6 tripwire "Spine and Canvas disagree on a step's
 * icon, title, or order" firing from a one-sided reveal.
 */
describe("PhaseSpineGraph — ⌥ technical names reveal (D-183-06 / D-183-08)", () => {
  /** Two UNNAMED phases — the dominant live shape (only 10 of 119 phases are named),
   *  and two of them so "flips every node at once" is actually exercised. */
  const unnamedPhases: PhaseSpecJSON[] = [
    { slug: "retrieve", phase_index: 0, config: { phase_type: "llm_agent", prompt: "r" } },
    { slug: "m1", phase_index: 1, config: { phase_type: "llm_emit", prompt: "e" } },
  ]

  /** The shipped provider-driven harness idiom (lib/__tests__/termMap.test.tsx:138-164):
   *  a "flip" button calling the context's own toggle — never a second copy of the state. */
  function Harness() {
    const { toggle } = useTechnicalNames()
    return (
      <div>
        <PhaseSpineGraph phases={unnamedPhases} selectedSlug={null} onSelectNode={vi.fn()} />
        <button type="button" onClick={toggle}>
          flip
        </button>
      </div>
    )
  }

  function titleOf(slug: string): string {
    return within(screen.getByTestId(`spine-node-${slug}`))
      .getByTestId("node-title")
      .textContent!.trim()
  }

  beforeEach(() => {
    // The provider persists to localStorage; start every case from the plain default.
    window.localStorage.clear()
  })

  it("with the reveal OFF shows the plain-language sentence — no slug, no · separator", () => {
    render(
      <TechnicalNamesProvider>
        <Harness />
      </TechnicalNamesProvider>,
    )
    expect(titleOf("retrieve")).toBe("Work out how to do it")
    expect(titleOf("retrieve")).not.toContain("retrieve")
    expect(titleOf("retrieve")).not.toContain("·")
    expect(titleOf("m1")).toBe("Produce the deliverable")
    expect(titleOf("m1")).not.toContain("m1")
    expect(titleOf("m1")).not.toContain("·")
  })

  it("flipping the reveal ON shows '<type label> · <slug>' on EVERY node at once", () => {
    render(
      <TechnicalNamesProvider>
        <Harness />
      </TechnicalNamesProvider>,
    )
    act(() => {
      screen.getByRole("button", { name: "flip" }).click()
    })
    expect(titleOf("retrieve")).toBe("AI agent step · retrieve")
    expect(titleOf("m1")).toBe("Deliverable · m1")
    // The accessible name tracks the visible one (WCAG 2.5.3 label-in-name).
    expect(screen.getByTestId("spine-node-m1").getAttribute("aria-label")).toBe(
      "Phase 2: Deliverable · m1 (llm_emit)",
    )
  })

  it("renders plain language and does NOT throw with no provider mounted at all", () => {
    expect(() =>
      render(
        <PhaseSpineGraph phases={unnamedPhases} selectedSlug={null} onSelectNode={vi.fn()} />,
      ),
    ).not.toThrow()
    expect(titleOf("retrieve")).toBe("Work out how to do it")
    expect(titleOf("retrieve")).not.toContain("·")
  })
})
