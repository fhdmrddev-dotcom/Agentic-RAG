/**
 * Phase 103-04 Task 3 (REQ-5 / WFAUTH-01/02, sketch 018-A) — WorkflowBuilderPage tests.
 *
 * The describe-first Builder. These tests pin the locked contract:
 *  - the EMPTY Builder DOM = EXACTLY one describe textarea + one hint line + one
 *    DISABLED submit button — and NOTHING else (no grounding chip, strictness dial,
 *    folder picker, phase node, or left rail).
 *  - the draft button is disabled on empty/whitespace, enabled on non-empty.
 *  - SINGLE state transition: after "Composing..." clears, the WHOLE draft renders
 *    in one DOM snapshot (all phase nodes present at once — no per-node stagger).
 *  - an ok:false generate response surfaces an honest error and renders NO phase
 *    nodes (never a broken/partial draft — the G-6 silent-invalid-draft guard).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"

// Mock the authoring client fns the page consumes (Plan 03 seams).
const { mockGenerate, mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}))
vi.mock("@/lib/api", () => ({
  generateWorkflow: mockGenerate,
  createWorkflowDraft: mockCreate,
  updateWorkflowDraft: mockUpdate,
}))

import { WorkflowBuilderPage } from "./WorkflowBuilderPage"

/** A 3-phase definition the mocked generate returns. */
const draft3 = {
  slug: "vendor-brief",
  version: 1,
  status: "draft",
  business_requirement: "summarize vendor risk",
  phases: [
    { slug: "gather", phase_index: 0, name: "Gather sources", config: { phase_type: "llm_agent", prompt: "g", available_tools: ["search_documents"] } },
    { slug: "review", phase_index: 1, name: "Review", config: { phase_type: "llm_single", prompt: "r" } },
    { slug: "emit", phase_index: 2, name: "Render the brief", config: { phase_type: "llm_emit", prompt: "e", emitter: "render_template", citation_policy: "strict" } },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("WorkflowBuilderPage — describe-first empty Builder", () => {
  it("empty DOM = exactly 1 textarea + 1 hint + 1 disabled submit button", () => {
    const { container } = render(<WorkflowBuilderPage />)
    // Exactly one textarea.
    expect(container.querySelectorAll("textarea")).toHaveLength(1)
    // Exactly one button (the disabled submit).
    const buttons = container.querySelectorAll("button")
    expect(buttons).toHaveLength(1)
    const submit = buttons[0] as HTMLButtonElement
    expect(submit).toBeDisabled()
    // One hint line.
    expect(screen.getByTestId("describe-hint")).toBeInTheDocument()
  })

  it("the empty screen has NO grounding chip / strictness dial / folder picker / phase node / left rail", () => {
    render(<WorkflowBuilderPage />)
    expect(screen.queryByTestId("grounding-chip")).not.toBeInTheDocument()
    expect(screen.queryByTestId("strictness-dial")).not.toBeInTheDocument()
    expect(screen.queryByTestId("folder-picker")).not.toBeInTheDocument()
    expect(screen.queryByTestId("phase-form-rail")).not.toBeInTheDocument()
    // No spine node (the graph only appears post-draft).
    expect(screen.queryByText(/READ-ONLY GRAPH/i)).not.toBeInTheDocument()
    // No left nav rail inside the page.
    expect(screen.queryByTestId("builder-left-rail")).not.toBeInTheDocument()
  })

  it("the draft button is disabled on empty/whitespace, enabled on non-empty", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<WorkflowBuilderPage />)
    const textarea = screen.getByRole("textbox")
    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
    // Whitespace only → still disabled.
    await user.type(textarea, "   ")
    expect(button).toBeDisabled()
    // Real content → enabled.
    await user.type(textarea, "summarize vendor risk")
    expect(button).toBeEnabled()
  })
})

describe("WorkflowBuilderPage — single state transition + honest failure", () => {
  it("renders the WHOLE draft in one DOM batch after composing (all nodes at once, no stagger)", async () => {
    mockGenerate.mockResolvedValue({ ok: true, definition: draft3 })
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<WorkflowBuilderPage />)
    await user.type(screen.getByRole("textbox"), "summarize vendor risk")
    await user.click(screen.getByRole("button", { name: /draft/i }))

    // After the resolve, ALL three nodes are present in one snapshot.
    const gather = await screen.findByTestId("spine-node-gather")
    expect(gather).toBeInTheDocument()
    expect(screen.getByTestId("spine-node-review")).toBeInTheDocument()
    expect(screen.getByTestId("spine-node-emit")).toBeInTheDocument()
    // The graph (read-only legend) is present — the draft rendered as a whole.
    expect(screen.getByText(/READ-ONLY GRAPH/i)).toBeInTheDocument()
    expect(mockGenerate).toHaveBeenCalledTimes(1)
  })

  it("selecting a node opens the push panel (panelOpen) — graph column shrinks", async () => {
    mockGenerate.mockResolvedValue({ ok: true, definition: draft3 })
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<WorkflowBuilderPage />)
    await user.type(screen.getByRole("textbox"), "summarize vendor risk")
    await user.click(screen.getByRole("button", { name: /draft/i }))
    await screen.findByTestId("spine-node-gather")

    // Before selection: the form panel is the resting rail.
    expect(screen.getByTestId("phase-form-rail")).toBeInTheDocument()
    // Select a node → the form opens (the rail is replaced by the form).
    await user.click(screen.getByTestId("spine-node-gather"))
    expect(screen.queryByTestId("phase-form-rail")).not.toBeInTheDocument()
    // The grid track reflects panelOpen (400px column).
    const grid = screen.getByTestId("builder-grid")
    expect(grid.getAttribute("style") ?? "").toContain("400px")
  })

  it("ok:false generate → honest error surface, NO phase nodes (no broken draft)", async () => {
    mockGenerate.mockResolvedValue({ ok: false, error: "could not generate", detail: "model failed twice" })
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<WorkflowBuilderPage />)
    await user.type(screen.getByRole("textbox"), "do something impossible")
    await user.click(screen.getByRole("button", { name: /draft/i }))

    // The error surface renders.
    const err = await screen.findByTestId("generate-error")
    expect(err).toBeInTheDocument()
    expect(within(err).getByText(/could not generate/i)).toBeInTheDocument()
    // And NO phase nodes / graph render (never a partial draft).
    expect(screen.queryByTestId("spine-node-gather")).not.toBeInTheDocument()
    expect(screen.queryByText(/READ-ONLY GRAPH/i)).not.toBeInTheDocument()
  })

  it("a thrown generate error also surfaces the honest failure, no nodes", async () => {
    mockGenerate.mockRejectedValue(new Error("network down"))
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<WorkflowBuilderPage />)
    await user.type(screen.getByRole("textbox"), "anything")
    await user.click(screen.getByRole("button", { name: /draft/i }))
    expect(await screen.findByTestId("generate-error")).toBeInTheDocument()
    expect(screen.queryByTestId("spine-node-gather")).not.toBeInTheDocument()
  })
})
