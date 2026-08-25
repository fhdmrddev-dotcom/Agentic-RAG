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
import { render, screen, within, waitFor } from "@testing-library/react"

// Mock the authoring client fns the page consumes (Plan 03 seams + the 103-ux
// folder/skill name fetch the form panel + project picker read).
const { mockGenerate, mockCreate, mockUpdate, mockListFolders, mockListSkills } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
}))
vi.mock("@/lib/api", () => ({
  generateWorkflow: mockGenerate,
  createWorkflowDraft: mockCreate,
  updateWorkflowDraft: mockUpdate,
  listFolders: mockListFolders,
  listSkills: mockListSkills,
  // Phase 200 (FE-WIRING) — the page's mount effect now reads the connector connections too,
  // so an `external_action` step's face can name where it sends. DECLARED HERE rather than
  // left undefined, for the reason `196-08` measured the hard way: a whole-module factory mock
  // that omits a symbol the composed tree can reach fails far from its cause. An empty list is
  // the SHIPPED absence — every external face renders its destination-free sentence.
  listConnectorConnections: () => Promise.resolve([]),
  // ⚠ 206.2-04 — THE MOCK BUDGET, SPENT IN THE SAME COMMIT AS THE IMPORT THAT MAKES
  // IT LIVE. This factory passes today only because the list above resolves `[]`, so
  // `McpToolPicker` never mounts and its two api functions are never reached. DO NOT
  // RELY ON A MOUNT NEVER HAPPENING: 196-08 measured 249 red tests from one added
  // export, because an inert factory fails at MOUNT and does so loudly.
  discoverConnectorTools: () => Promise.resolve([]),
  updateConnectorGrants: () => Promise.resolve({}),
  // 196-08 (AUTH-04) — see the note in `WorkflowBuilderPage.describe.test.tsx`: the page
  // reads the author model registry at mount and this factory must declare it.
  getAuthorModelRegistry: () => Promise.resolve({ models: [], run_default_model: null }),
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
  // Default: no folders/skills (keeps the empty-screen tests calm + deterministic).
  mockListFolders.mockResolvedValue([])
  mockListSkills.mockResolvedValue([])
})

describe("WorkflowBuilderPage — describe-first empty Builder", () => {
  it("empty DOM = exactly 1 textarea + 1 hint + 1 disabled submit button (no folders)", () => {
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

  it("the empty screen has NO grounding chip / strictness dial / phase node / left rail", () => {
    render(<WorkflowBuilderPage />)
    expect(screen.queryByTestId("grounding-chip")).not.toBeInTheDocument()
    expect(screen.queryByTestId("strictness-dial")).not.toBeInTheDocument()
    expect(screen.queryByTestId("phase-form-rail")).not.toBeInTheDocument()
    // No spine node (the graph only appears post-draft).
    // ⚠ RE-POINTED BY 200-05 (BS-MNR-01). This probed `queryByText(/READ-ONLY GRAPH/i)` — the
    // legend, which that plan SUBTRACTS as *"the noisiest string in the product"*. A negative
    // probe against a string that no longer exists anywhere would have kept passing while
    // measuring nothing, which is the worst outcome available here. The graph's presence is
    // now detected by its own landmark `aria-label`, which is stabler than a body of copy.
    expect(screen.queryByRole("region", { name: /workflow phase spine/i })).not.toBeInTheDocument()
    // No left nav rail inside the page.
    expect(screen.queryByTestId("builder-left-rail")).not.toBeInTheDocument()
  })

  it("shows ONE calm project-folder picker once folders load (the only added control)", async () => {
    mockListFolders.mockResolvedValue([
      { id: "f1", user_id: "u", name: "Project Meridian", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
    ])
    render(<WorkflowBuilderPage />)
    const picker = await screen.findByTestId("project-folder-picker")
    expect(picker).toBeInTheDocument()
    // It lists the real folder NAME (never a UUID).
    expect(within(picker).getByText("Project Meridian")).toBeInTheDocument()
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
    // The graph is present — the draft rendered as a whole.
    // ⚠ RE-POINTED BY 200-05 (BS-MNR-01): this read `getByText(/READ-ONLY GRAPH/i)`, and the
    // legend is subtracted. This is the POSITIVE half of the pair above, so it is the probe
    // that proves the new landmark needle can actually find a mounted spine.
    expect(screen.getByRole("region", { name: /workflow phase spine/i })).toBeInTheDocument()
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

  it("forwards the chosen project_folder_id to generate + shows the bound NAME in the header", async () => {
    mockListFolders.mockResolvedValue([
      { id: "f1", user_id: "u", name: "Project Meridian", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
    ])
    mockGenerate.mockResolvedValue({ ok: true, definition: draft3 })
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<WorkflowBuilderPage />)
    // Pick the project, then describe + draft.
    const picker = await screen.findByTestId("project-folder-picker")
    await user.selectOptions(picker, "f1")
    await user.type(screen.getByRole("textbox"), "summarize vendor risk")
    await user.click(screen.getByRole("button", { name: /draft/i }))
    await screen.findByTestId("spine-node-gather")
    // generate received the bound folder id.
    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ project_folder_id: "f1" }))
    // The draft header shows the bound folder NAME (not the UUID).
    const bound = await screen.findByTestId("builder-bound-folder")
    expect(bound.textContent).toContain("Project Meridian")
    expect(bound.textContent).not.toContain("f1")
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
    // ⚠ RE-POINTED BY 200-05 (BS-MNR-01) — same reason as the two probes above.
    expect(screen.queryByRole("region", { name: /workflow phase spine/i })).not.toBeInTheDocument()
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

describe("WorkflowBuilderPage — OPEN existing (initial) boots into the editing view", () => {
  it("with `initial` it starts DIRECTLY in drafted: spine nodes render, NO describe box", async () => {
    render(<WorkflowBuilderPage initial={{ definition: draft3, draftId: "draft-77" }} />)
    // The describe-first screen is SKIPPED — no describe box / no generate call.
    expect(screen.queryByTestId("describe-hint")).not.toBeInTheDocument()
    expect(mockGenerate).not.toHaveBeenCalled()
    // The loaded definition's phases render as spine nodes immediately.
    expect(await screen.findByTestId("spine-node-gather")).toBeInTheDocument()
    expect(screen.getByTestId("spine-node-emit")).toBeInTheDocument()
  })

  it("seeds the bound-folder NAME in the header from the loaded definition", async () => {
    mockListFolders.mockResolvedValue([
      { id: "f9", user_id: "u", name: "Risk KB", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
    ])
    const bound = { ...draft3, project_folder_id: "f9" }
    render(<WorkflowBuilderPage initial={{ definition: bound, draftId: "draft-77" }} />)
    const chip = await screen.findByTestId("builder-bound-folder")
    expect(chip.textContent).toContain("Risk KB")
    expect(chip.textContent).not.toContain("f9")
  })

  it("an edit on an opened draft PATCHes the SAME row (updateWorkflowDraft), never a duplicate create", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<WorkflowBuilderPage initial={{ definition: draft3, draftId: "draft-77" }} />)
    await user.click(screen.getByTestId("builder-save-draft"))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    // PATCH targets the pre-seeded draft id — and createWorkflowDraft is NEVER called.
    expect(mockUpdate.mock.calls[0][0]).toBe("draft-77")
    expect(mockCreate).not.toHaveBeenCalled()
  })

  /**
   * Phase 184-11 (R6) — THE ONE FORCED ASSERTION EDIT OF THIS PLAN, recorded here as
   * well as in the SUMMARY so a reader of the test does not have to go looking.
   *
   * The expected LITERAL moved from `Saved ✓` to `Saved · still a draft`, and nothing
   * else did. The wording is operator-locked in 184-CONTEXT `<specifics>` — *"the save
   * state says 'Saved · still a draft' — no word implying published, ever"* — because
   * Phase 184 makes this header the place an author decides whether their work is safe,
   * and a bare "Saved ✓" beside a `◆ Publish…` button is exactly the ambiguity the
   * locked wording exists to remove. The assertion's PURPOSE is unchanged and still
   * measured: an explicit save produces a transient, visible, honest confirmation.
   *
   * The alternatives were considered and rejected. `Saved ✓ · still a draft` would have
   * kept this literal green as a substring (`toHaveTextContent` matches substrings) and
   * would have shipped a wording nobody locked; asserting only the qualifier would have
   * stopped pinning the confirmation itself.
   */
  it("Save draft shows a transient 'Saved · still a draft' confirmation on success", async () => {
    mockUpdate.mockResolvedValue({})
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<WorkflowBuilderPage initial={{ definition: draft3, draftId: "draft-77" }} />)
    await user.click(screen.getByTestId("builder-save-draft"))
    expect(await screen.findByTestId("builder-save-confirm")).toHaveTextContent(
      "Saved · still a draft",
    )
  })

  it("Save draft shows an honest error state when the persist fails", async () => {
    mockUpdate.mockRejectedValue(new Error("409 published"))
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<WorkflowBuilderPage initial={{ definition: draft3, draftId: "draft-77" }} />)
    await user.click(screen.getByTestId("builder-save-draft"))
    expect(await screen.findByTestId("builder-save-error")).toBeInTheDocument()
    expect(screen.queryByTestId("builder-save-confirm")).not.toBeInTheDocument()
  })
})

describe("WorkflowBuilderPage — fresh build Save (no initial) creates ONCE then PATCHes", () => {
  it("first Save on a freshly-generated draft calls createWorkflowDraft, second Save PATCHes", async () => {
    mockGenerate.mockResolvedValue({ ok: true, definition: draft3 })
    // 186-07: the create response carries the row's OPAQUE concurrency token, and the
    // second save must echo THAT value — not the one the session started with (there
    // was none) and not a re-derived one.
    mockCreate.mockResolvedValue({ id: "created-1", version: 1, token: "tok-from-create" })
    mockUpdate.mockResolvedValue({ id: "created-1", version: 1, token: "tok-from-patch" })
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<WorkflowBuilderPage />)
    await user.type(screen.getByRole("textbox"), "summarize vendor risk")
    await user.click(screen.getByRole("button", { name: /draft/i }))
    await screen.findByTestId("spine-node-gather")
    // First explicit Save → create exactly once.
    await user.click(screen.getByTestId("builder-save-draft"))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(await screen.findByTestId("builder-save-confirm")).toBeInTheDocument()
    // Second Save → PATCH the now-known id, no second create.
    //
    // 186-07 RETARGET, not a relaxation: the call now carries a THIRD argument, so the
    // shipped two-argument matcher could no longer describe a correct call. The assertion
    // is STRENGTHENED rather than widened — the id is still pinned, and the token the
    // create minted is pinned alongside it, which is the guard that the write is
    // concurrency-checked at all.
    await user.click(screen.getByTestId("builder-save-draft"))
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith("created-1", expect.anything(), "tok-from-create"),
    )
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })
})
