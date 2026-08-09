/**
 * Phase 087 — WorkspacePanel composition tests (PANEL-01).
 *
 * Plan 06 re-architecture: WorkspacePanel is CONTROLLED. The state machine, the
 * ⌘./Ctrl+. key listener, and the subscribeOpenPanel effect live in ChatLayout.
 *
 * Plan 08 (operator directive 2026-05-29): consolidated to a NAV-STYLE 2-state
 * machine — state="open" | "rail" (the "hidden" state is gone). These tests
 * assert the controlled contract:
 *   - state="open" → body/header (four sections + pinned PendingAskStack); the
 *     in-panel header control ("Collapse workspace") calls onToggle (→rail)
 *   - state="rail" → PanelRail with an ALWAYS-PRESENT "Expand workspace" control
 *     (rendered even with 0 todos / 0 files) calling onExpand; no section bodies
 *   - the empty short-circuit (ONE PanelEmpty, never four headers)
 *   - the <768px bottom-sheet (Sheet primitive)
 *   - the reactive useViewingThread + four-hook consumption
 *
 * The four Phase 086 hooks + useViewingThread are mocked. The heavy section
 * bodies (FilesSection / VersionDiff / TodosSection / PendingAskStack) are mocked
 * to thin sentinels — their own behavior is covered by their own test files; here
 * we assert COMPOSITION against the controlled props.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
// Phase 124-03 Task 1 (WUX-01, G-5): read the WorkspacePanel SOURCE via Vite's
// ?raw loader to assert the new run-soul wiring is a pure additive SIBLING — it
// must NOT import PhaseCard nor thread any soul atom into the live timeline.
import workspacePanelSource from "@/components/panel/WorkspacePanel?raw"
import type { Todo, WorkspaceFile, PendingAsk, Phase, TaskRunIndexItem } from "@/types"
import type { DerivedPanelItem } from "@/lib/workspacePanel"
import type { ThreadWorkflowState, PublishedWorkflow } from "@/lib/api"
import { mockTodos, mockWorkspaceFiles, mockPendingAskWithRunId } from "./fixtures"

// Phase 124-03 Task 1 (WUX-01, A2): the run soul sources the published definition
// ADDITIVELY by id — getThreadWorkflow gives the run frame's definition_slug, then
// listPublishedWorkflows recovers the SAME owner-scoped PublishedWorkflow.definition
// the library card reads. Mock both so the run-soul effect resolves deterministically
// (default: no slug / empty list → the soul renders its honest empty-states).
const getThreadWorkflow = vi.fn()
const listPublishedWorkflows = vi.fn()
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    getThreadWorkflow: (...a: unknown[]) => getThreadWorkflow(...a),
    listPublishedWorkflows: (...a: unknown[]) => listPublishedWorkflows(...a),
  }
})

const useTodos = vi.fn()
const useWorkspaceFiles = vi.fn()
const useAskUserPrompt = vi.fn()
const useViewingThread = vi.fn()
// Phase 094 (PANEL-08): WorkspacePanel now also reads usePhases + the workflow
// lock to gate the Workflow timeline section. Default to no harness activity
// (empty phases, null lock) so the existing Todos/Files/Versions assertions are
// unaffected; a dedicated test sets them to exercise the timeline mount.
const usePhases = vi.fn()
// Phase 094 WR-01: WorkspacePanel now also reads useTasks to gate the batch
// Sub-results section. Default to no tasks (empty) so existing assertions are
// unaffected; a dedicated test sets them to exercise the BatchResultList mount.
const useTasks = vi.fn()
const useWorkflowLockForThread = vi.fn()
// Phase 095.1 Plan 06 (GAP-1): WorkspacePanel now also reads useDerivedPanel to
// gate the derived-panel signal in hasActivity. Default to [] (no derived panel)
// so the existing PanelEmpty short-circuit + populated assertions are unaffected;
// the gate→derived render path is exercised in WorkspacePanel.derived.test.tsx
// (which renders the REAL TodosSection — this file sentinel-mocks it).
const useDerivedPanel = vi.fn()
vi.mock("@/providers/StreamsProvider", () => ({
  useTodos: (...a: unknown[]) => useTodos(...a),
  useWorkspaceFiles: (...a: unknown[]) => useWorkspaceFiles(...a),
  useAskUserPrompt: (...a: unknown[]) => useAskUserPrompt(...a),
  useViewingThread: (...a: unknown[]) => useViewingThread(...a),
  usePhases: (...a: unknown[]) => usePhases(...a),
  useTasks: (...a: unknown[]) => useTasks(...a),
  useWorkflowLockForThread: (...a: unknown[]) => useWorkflowLockForThread(...a),
  useDerivedPanel: (...a: unknown[]) => useDerivedPanel(...a),
}))

// Stub the heavy timeline child (it reads the real provider hooks); the panel
// only mounts it when a harness run is active. A test that exercises the mount
// asserts on this stub's presence.
vi.mock("@/components/panel/PhaseTimeline", () => ({
  PhaseTimeline: () => <div data-testid="phase-timeline">timeline</div>,
}))

// Stub the batch sub-results list (it reads the real useTasks hook); the panel
// mounts it only when the timeline shows AND tasks exist (WR-01). A dedicated
// test asserts on this stub's presence/absence.
vi.mock("@/components/panel/BatchResultList", () => ({
  BatchResultList: () => <div data-testid="batch-result-list">sub-results</div>,
}))

// Phase 100 (D-01): WorkspacePanel renders the REAL TemplateUpload inside the
// empty short-circuit (it reads useStreamActions, which this file's
// StreamsProvider mock omits) — sentinel-mock it like the other section bodies.
vi.mock("@/components/panel/TemplateUpload", () => ({
  TemplateUpload: () => <div data-testid="template-upload">upload</div>,
}))

vi.mock("@/components/panel/TodosSection", () => ({
  TodosSection: () => <div data-testid="todos-section">todos</div>,
}))
vi.mock("@/components/panel/FilesSection", () => ({
  FilesSection: ({ onSelectFile }: { onSelectFile?: (f: WorkspaceFile) => void }) => (
    <div data-testid="files-section">
      <button onClick={() => onSelectFile?.(mockWorkspaceFiles[0])}>pick-file</button>
    </div>
  ),
}))
vi.mock("@/components/panel/VersionDiff", () => ({
  VersionDiff: ({ file }: { file: { path: string } }) => (
    <div data-testid="version-diff">diff:{file.path}</div>
  ),
}))
vi.mock("@/components/panel/PendingAskCard", () => ({
  PendingAskStack: () => <div data-testid="pending-ask-stack">asks</div>,
}))

// eslint-disable-next-line import/first
import { WorkspacePanel, type PanelState } from "@/components/panel/WorkspacePanel"

const thread = { id: "thread-1", title: "T" } as never

function setHooks({
  todos = mockTodos,
  files = mockWorkspaceFiles,
  asks = [] as PendingAsk[],
  viewing = "thread-1" as string | null,
  phases = [] as Phase[],
  tasks = [] as TaskRunIndexItem[],
  lock = null as { runId: string; mode: "harness"; capPaused: boolean; continuesRemaining: number } | null,
  derived = [] as DerivedPanelItem[],
}: {
  todos?: Todo[]
  files?: WorkspaceFile[]
  asks?: PendingAsk[]
  viewing?: string | null
  phases?: Phase[]
  tasks?: TaskRunIndexItem[]
  lock?: { runId: string; mode: "harness"; capPaused: boolean; continuesRemaining: number } | null
  derived?: DerivedPanelItem[]
}) {
  useTodos.mockReturnValue({ data: todos, isLoading: false, error: null, reconcile: vi.fn() })
  useWorkspaceFiles.mockReturnValue({ data: files, isLoading: false, error: null, reconcile: vi.fn() })
  useAskUserPrompt.mockReturnValue({ data: asks, isLoading: false, error: null, reconcile: vi.fn() })
  useViewingThread.mockReturnValue(viewing)
  usePhases.mockReturnValue({ data: phases, isLoading: false, error: null, reconcile: vi.fn() })
  useTasks.mockReturnValue({ data: tasks, isLoading: false, error: null, reconcile: vi.fn() })
  useWorkflowLockForThread.mockReturnValue(lock)
  useDerivedPanel.mockReturnValue(derived)
}

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width })
}

interface RenderOpts {
  state?: PanelState
  onToggle?: () => void
  onExpand?: () => void
  /** Phase 188 Plan 10 — OPTIONAL by design. Left undefined here so every case above
   *  renders exactly the panel it rendered before the run receipt existed. */
  onOpenRun?: (runId: string) => void
}
function renderPanel({
  state = "open",
  onToggle = vi.fn(),
  onExpand = vi.fn(),
  onOpenRun,
}: RenderOpts = {}) {
  return render(
    <WorkspacePanel
      selectedThread={thread}
      state={state}
      onToggle={onToggle}
      onExpand={onExpand}
      onOpenRun={onOpenRun}
    />,
  )
}

/** A published-definition fixture for the run-soul by-id read (A2). */
const SOUL_SLUG = "weekly-status"
const soulPublished: PublishedWorkflow = {
  id: "pub-1",
  slug: SOUL_SLUG,
  name: "Weekly Status",
  definition: {
    name: "Weekly Status",
    slug: SOUL_SLUG,
    business_requirement: "Summarize the week's progress for stakeholders.",
    phases: [
      { slug: "gather", phase_index: 0, name: "Gather", config: { phase_type: "llm_agent" } },
      { slug: "emit", phase_index: 1, name: "Emit", config: { phase_type: "llm_emit", citation_policy: "strict" } },
    ],
  } as unknown as PublishedWorkflow["definition"],
}

/** Point the run-soul reads at a definition (slug match) or at an empty source. */
function setRunSoulSource(opts: { slug?: string | null; published?: PublishedWorkflow[] } = {}) {
  getThreadWorkflow.mockResolvedValue({
    thread_id: "thread-1",
    mode: "harness",
    locked: true,
    active_workflow_run_id: "wr-1",
    run_status: "running",
    definition_slug: opts.slug ?? SOUL_SLUG,
    definition_name: "Weekly Status",
    current_phase_slug: null,
    current_phase_index: null,
    total_phases: 2,
    lock_is_stale: false,
    cap_paused: false,
    continues_used: 0,
    continues_remaining: 3,
  } as ThreadWorkflowState)
  listPublishedWorkflows.mockResolvedValue(opts.published ?? [soulPublished])
}

describe("WorkspacePanel (PANEL-01) — controlled composition", () => {
  beforeEach(() => {
    setViewport(1280) // desktop default
    setHooks({})
    // Default the run-soul reads to a no-slug frame so the soul effect resolves to
    // its honest empty-state and never leaks an unhandled rejection in tests that
    // don't exercise the timeline. Run-soul-specific tests override via setRunSoulSource.
    getThreadWorkflow.mockResolvedValue({ definition_slug: null } as unknown as ThreadWorkflowState)
    listPublishedWorkflows.mockResolvedValue([])
  })

  it("renders a complementary landmark labelled 'Agent workspace'", () => {
    renderPanel({ state: "open" })
    expect(screen.getByRole("complementary", { name: /Agent workspace/i })).toBeInTheDocument()
  })

  it("state='open' renders the four-section body (controlled)", () => {
    renderPanel({ state: "open" })
    expect(screen.getByTestId("todos-section")).toBeInTheDocument()
    expect(screen.getByTestId("files-section")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Todos/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Files/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Versions/i })).toBeInTheDocument()
  })

  it("state='rail' renders the rail icons and hides the section bodies", () => {
    setHooks({ asks: [mockPendingAskWithRunId] })
    renderPanel({ state: "rail" })
    expect(screen.queryByTestId("todos-section")).toBeNull()
    expect(screen.getByRole("button", { name: /Todos — 1 of 3 done/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Files — 5/i })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Pending question — needs your answer/i }),
    ).toBeInTheDocument()
  })

  it("state='rail' renders an ALWAYS-PRESENT 'Expand workspace' control, even with zero todos and zero files (welcome-screen reopen host — gap-d)", () => {
    setHooks({ todos: [], files: [], asks: [] })
    renderPanel({ state: "rail" })
    // The reopen-by-mouse affordance must exist with no workspace activity.
    expect(screen.getByRole("button", { name: /expand workspace/i })).toBeInTheDocument()
    // Count-badge icon buttons render no badge but the Expand control still leads.
    expect(screen.queryByTestId("todos-section")).toBeNull()
  })

  it("the in-panel header control calls onToggle (open → rail; nav-style toggle owned by ChatLayout)", async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    renderPanel({ state: "open", onToggle })
    await user.click(screen.getByRole("button", { name: /collapse workspace/i }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it("the rail 'Expand workspace' control calls onExpand (rail → open)", async () => {
    const onExpand = vi.fn()
    const user = userEvent.setup()
    renderPanel({ state: "rail", onExpand })
    await user.click(screen.getByRole("button", { name: /expand workspace/i }))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it("a rail count-badge icon click also calls onExpand", async () => {
    const onExpand = vi.fn()
    const user = userEvent.setup()
    renderPanel({ state: "rail", onExpand })
    await user.click(screen.getByRole("button", { name: /Files — 5/i }))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it("exposes ONLY the nav-style toggle controls — no 'Toggle workspace' affordance (that chat-header button was removed in 087-08)", () => {
    // Open state owns "Collapse workspace"; rail owns "Expand workspace". The
    // ambiguous chat-header "Toggle workspace" control no longer exists anywhere.
    renderPanel({ state: "open" })
    expect(screen.getByRole("button", { name: /collapse workspace/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /toggle workspace/i })).toBeNull()
  })

  it("does NOT respond to ⌘./Ctrl+. (listener lifted to ChatLayout)", async () => {
    const onToggle = vi.fn()
    const onExpand = vi.fn()
    const user = userEvent.setup()
    renderPanel({ state: "open", onToggle, onExpand })
    await user.keyboard("{Control>}.{/Control}")
    expect(onToggle).not.toHaveBeenCalled()
    expect(onExpand).not.toHaveBeenCalled()
    expect(screen.getByTestId("todos-section")).toBeInTheDocument()
  })

  it("short-circuits to a single <PanelEmpty/> when todos, files, and asks are all empty (no four empty headers)", () => {
    setHooks({ todos: [], files: [], asks: [] })
    renderPanel({ state: "open" })
    expect(screen.getByText(/No workspace activity yet/i)).toBeInTheDocument()
    expect(screen.queryByTestId("todos-section")).toBeNull()
    expect(screen.queryByTestId("files-section")).toBeNull()
  })

  // Phase 100 (D-01) reachability: the empty short-circuit must still carry the
  // template-upload affordance when a thread is open — otherwise the first
  // template upload on a fresh thread is structurally impossible (G-4 UAT gap).
  it("keeps the template-upload affordance reachable inside the empty state when a thread is open (Phase 100 D-01)", () => {
    setHooks({ todos: [], files: [], asks: [] })
    renderPanel({ state: "open" })
    expect(screen.getByText(/No workspace activity yet/i)).toBeInTheDocument()
    expect(screen.getByTestId("template-upload")).toBeInTheDocument()
  })

  it("omits the template-upload affordance in the empty state when no thread is viewed", () => {
    setHooks({ todos: [], files: [], asks: [], viewing: null })
    renderPanel({ state: "open" })
    expect(screen.queryByTestId("template-upload")).toBeNull()
  })

  it("pins the pending ask_user stack to the very top of the panel scroll", () => {
    setHooks({ asks: [mockPendingAskWithRunId] })
    renderPanel({ state: "open" })
    const panel = screen.getByRole("complementary", { name: /Agent workspace/i })
    const stack = within(panel).getByTestId("pending-ask-stack")
    expect(stack).toBeInTheDocument()
    const todos = within(panel).getByTestId("todos-section")
    expect(stack.compareDocumentPosition(todos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("renders as a bottom-sheet (Sheet primitive) below the 768px breakpoint when state='open'", () => {
    setViewport(375)
    renderPanel({ state: "open" })
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("mobile sheet onOpenChange(false) / X calls onToggle (open → rail dismisses the sheet)", async () => {
    setViewport(375)
    const onToggle = vi.fn()
    const user = userEvent.setup()
    renderPanel({ state: "open", onToggle })
    await user.click(screen.getByRole("button", { name: /close workspace/i }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it("reads useViewingThread + the four Phase 086 hooks reactively (no page refresh)", () => {
    renderPanel({ state: "open" })
    expect(useViewingThread).toHaveBeenCalled()
    expect(useTodos).toHaveBeenCalledWith("thread-1")
    expect(useWorkspaceFiles).toHaveBeenCalledWith("thread-1")
    expect(useAskUserPrompt).toHaveBeenCalledWith("thread-1")
  })

  // Phase 094 (PANEL-08) — the Workflow timeline section mounts only for a harness
  // run (server-truth lock) OR when phases exist; a Deep / no-run thread never
  // sees it (the empty short-circuit / PanelEmpty stays the calm default).
  it("mounts the Workflow timeline section when a harness run holds the lock", () => {
    setHooks({
      lock: { runId: "wr-1", mode: "harness", capPaused: false, continuesRemaining: 3 },
    })
    renderPanel({ state: "open" })
    expect(screen.getByTestId("phase-timeline")).toBeInTheDocument()
  })

  it("mounts the Workflow timeline section when phases exist even without a lock", () => {
    setHooks({
      phases: [
        { slug: "p0", phaseIndex: 0, phaseType: "programmatic", status: "running", subAgents: [], pendingAsk: null },
      ],
    })
    renderPanel({ state: "open" })
    expect(screen.getByTestId("phase-timeline")).toBeInTheDocument()
  })

  it("does NOT mount the Workflow timeline for a Deep / no-run thread", () => {
    setHooks({ todos: mockTodos, phases: [], lock: null })
    renderPanel({ state: "open" })
    expect(screen.queryByTestId("phase-timeline")).not.toBeInTheDocument()
  })

  // ── Phase 124-03 Task 1 (WUX-01, D-07/D-08, sketch 046-A ②) — the run soul
  //    header. An ADDITIVE SIBLING section ABOVE the live Workflow timeline; it
  //    reads the DEFINITION only (sourced by-id, A2) and is gated to harness runs
  //    so Deep / no-run threads never see it (D-08). PhaseTimeline / PhaseCard stay
  //    byte-identical (the G-5 red line, asserted by git diff + the source-grep). ──
  it("mounts the run soul header (WorkflowSoul scale=run) as a sibling when a harness run holds the lock", async () => {
    setRunSoulSource({})
    setHooks({
      lock: { runId: "wr-1", mode: "harness", capPaused: false, continuesRemaining: 3 },
    })
    renderPanel({ state: "open" })
    // The soul mounts; once the by-id read resolves it shows the workflow's purpose.
    const soul = await screen.findByTestId("workflow-soul")
    expect(soul).toHaveAttribute("data-scale", "run")
    await waitFor(() =>
      expect(screen.getByText(/Summarize the week's progress/i)).toBeInTheDocument(),
    )
  })

  it("renders the run soul section ABOVE the live Workflow timeline (DOM order — additive sibling)", async () => {
    setRunSoulSource({})
    setHooks({
      lock: { runId: "wr-1", mode: "harness", capPaused: false, continuesRemaining: 3 },
    })
    renderPanel({ state: "open" })
    const soul = await screen.findByTestId("workflow-soul")
    const timeline = screen.getByTestId("phase-timeline")
    // The soul section precedes the timeline section in document order.
    expect(soul.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("sources the run soul definition via the additive by-id read (getThreadWorkflow → listPublishedWorkflows), NOT live run-state phases", async () => {
    setRunSoulSource({})
    setHooks({
      lock: { runId: "wr-1", mode: "harness", capPaused: false, continuesRemaining: 3 },
    })
    renderPanel({ state: "open" })
    await screen.findByTestId("workflow-soul")
    // The sibling-only read fires; the soul derives from the published definition.
    expect(getThreadWorkflow).toHaveBeenCalledWith("thread-1", expect.anything())
    await waitFor(() => expect(listPublishedWorkflows).toHaveBeenCalled())
  })

  it("does NOT mount the run soul header for a Deep / no-run thread (gated to showTimeline — D-08)", () => {
    setHooks({ todos: mockTodos, phases: [], lock: null })
    renderPanel({ state: "open" })
    expect(screen.queryByTestId("workflow-soul")).not.toBeInTheDocument()
  })

  it("the run soul falls back to its honest draft empty-state when no published definition matches the run slug", async () => {
    // A draft test-run: the slug exists but the published list has no match.
    setRunSoulSource({ slug: "unpublished-draft", published: [] })
    setHooks({
      lock: { runId: "wr-1", mode: "harness", capPaused: false, continuesRemaining: 3 },
    })
    renderPanel({ state: "open" })
    const soul = await screen.findByTestId("workflow-soul")
    expect(soul).toBeInTheDocument()
    // The purpose atom is always rendered — honest empty-state, never hidden (D-03).
    await waitFor(() =>
      expect(screen.getByText(/draft · purpose not declared yet/i)).toBeInTheDocument(),
    )
  })

  // G-5 SOURCE-GREP (the additive-sibling discipline survives refactors): the
  // WorkspacePanel's run-soul wiring must NOT import PhaseCard and must NOT thread a
  // soul atom into the live PhaseTimeline. The ONLY PhaseTimeline reference allowed
  // is the existing unchanged <PhaseTimeline threadId={threadId} /> mount.
  it("the WorkspacePanel SOURCE does not import or thread the run soul into PhaseCard (G-5)", () => {
    // No import of the live PhaseCard component anywhere (it is a PhaseTimeline internal).
    expect(workspacePanelSource).not.toMatch(/from\s+["']\.\/PhaseCard["']/)
    // The run soul is wired through WorkflowSoul (the additive sibling), not via a
    // new PhaseTimeline prop — PhaseTimeline is still mounted with ONLY threadId.
    expect(workspacePanelSource).toMatch(/<WorkflowSoul\s+def=/)
    expect(workspacePanelSource).toMatch(/<PhaseTimeline threadId=\{threadId\} \/>/)
  })

  // Phase 094 WR-01 (D-06 / SC#6) — the batch Sub-results section surfaces the
  // honest per-subtopic sub_agent_done.summary rows. It mounts beneath the
  // timeline ONLY when the timeline shows (harness/phases) AND tasks exist; a
  // Deep / no-run thread or a harness run with zero sub-agents never sees it
  // (never an empty box).
  const mockTask = {
    sub_run_id: "sub-1",
    parent_run_id: "wr-1",
    status: "completed",
    model: "m",
    provider: "p",
    description: "Sub-question: topic A",
    summary: "Result A",
  } as TaskRunIndexItem

  it("mounts the batch Sub-results section when a harness run has tasks", () => {
    setHooks({
      lock: { runId: "wr-1", mode: "harness", capPaused: false, continuesRemaining: 3 },
      tasks: [mockTask],
    })
    renderPanel({ state: "open" })
    expect(screen.getByTestId("batch-result-list")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Sub-results/i })).toBeInTheDocument()
  })

  it("does NOT mount the batch Sub-results section when the harness run has no tasks", () => {
    setHooks({
      lock: { runId: "wr-1", mode: "harness", capPaused: false, continuesRemaining: 3 },
      tasks: [],
    })
    renderPanel({ state: "open" })
    expect(screen.queryByTestId("batch-result-list")).not.toBeInTheDocument()
  })

  it("does NOT mount the batch Sub-results section for a Deep / no-run thread even if tasks somehow exist", () => {
    setHooks({ todos: mockTodos, phases: [], lock: null, tasks: [mockTask] })
    renderPanel({ state: "open" })
    expect(screen.queryByTestId("batch-result-list")).not.toBeInTheDocument()
  })

  // Phase 088-01 (D-13a) — structural a11y regression gate on the panel
  // composition: the role=complementary landmark + section accordion buttons in
  // the populated open state, AND the empty short-circuit (single PanelEmpty).
  // Section bodies are mocked to sentinels here (their own a11y is gated in their
  // own files). axe = STRUCTURE only (Pitfall 5 — contrast is Plan 05 / Chrome MCP).
  it("has no axe violations (open, populated — landmark + section accordion)", async () => {
    setHooks({ asks: [mockPendingAskWithRunId] })
    const { container } = renderPanel({ state: "open" })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no axe violations (open, empty short-circuit — single PanelEmpty)", async () => {
    setHooks({ todos: [], files: [], asks: [] })
    const { container } = renderPanel({ state: "open" })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no axe violations (rail state — count-badge rail + Expand control)", async () => {
    setHooks({ asks: [mockPendingAskWithRunId] })
    const { container } = renderPanel({ state: "rail" })
    expect(await axe(container)).toHaveNoViolations()
  })
})

// ── Phase 188 Plan 10 (RUNVIZ-03 / D-188-13) — the run receipt: the THREAD side of
//    the bidirectional seam.
//
// WHY THIS IS LOAD-BEARING RATHER THAN DECORATIVE. `GET /runs` and the cross-workflow
// runs home are deferred by the SPEC and the app has no router, so there are no links
// and no list of runs. Chat history IS the index, because a launch mints one thread per
// run. Delete this line and a launched run becomes unreachable the moment the user
// navigates away from it — "a finished run re-opens" would then be true of the endpoint
// and false of the product.
//
// The id is resolved from the THREAD ANCHOR and never from the panel's workflow lock:
// that lock field is overwritten with a producer run id at kickoff and again on a
// Continue re-subscribe, and it is cleared outright once a run goes terminal, which is
// the very case this line serves. Both ids are bare uuids, so a swap typechecks and then
// resolves nothing.
describe("WorkspacePanel — the run receipt (D-188-13, the thread → run direction)", () => {
  const HARNESS_LOCK = {
    runId: "producer-run-DO-NOT-USE",
    mode: "harness" as const,
    capPaused: false,
    continuesRemaining: 3,
  }
  /** The anchor id, DELIBERATELY DIFFERENT from the lock's id above — in production both
   *  are bare uuids, so the wrong one has to be detectable to be measured. */
  const ANCHOR_RUN_ID = "workflow-run-anchor-1"

  /** The anchor-survives-termination id (CR-03). `finish_run` NULLs the LIVE anchor in the
   *  same transaction as the terminal status, so a finished run has only this one. Also
   *  deliberately different from both ids above. */
  const LAST_RUN_ID = "workflow-run-last-1"

  function setAnchor(activeWorkflowRunId: string | null, lastWorkflowRunId?: string | null) {
    getThreadWorkflow.mockResolvedValue({
      thread_id: "thread-1",
      mode: "harness",
      locked: true,
      active_workflow_run_id: activeWorkflowRunId,
      last_workflow_run_id: lastWorkflowRunId ?? null,
      run_status: "completed",
      definition_slug: null,
      definition_name: null,
      current_phase_slug: null,
      current_phase_index: null,
      total_phases: 2,
      lock_is_stale: false,
      cap_paused: false,
      continues_used: 0,
      continues_remaining: 3,
    } as ThreadWorkflowState)
  }

  it("renders the receipt when a run id resolves for the thread", async () => {
    setAnchor(ANCHOR_RUN_ID)
    setHooks({ lock: HARNESS_LOCK })
    renderPanel({ state: "open", onOpenRun: vi.fn() })
    expect(await screen.findByText("Open the run")).toBeInTheDocument()
  })

  it("opens the run with the THREAD ANCHOR id, never the lock's producer id", async () => {
    setAnchor(ANCHOR_RUN_ID)
    setHooks({ lock: HARNESS_LOCK })
    const onOpenRun = vi.fn()
    const user = userEvent.setup()
    renderPanel({ state: "open", onOpenRun })
    await user.click(await screen.findByText("Open the run"))
    expect(onOpenRun).toHaveBeenCalledWith(ANCHOR_RUN_ID)
    expect(onOpenRun).not.toHaveBeenCalledWith(HARNESS_LOCK.runId)
  })

  it("renders NOTHING when no callback is supplied — every existing caller is unchanged", async () => {
    setAnchor(ANCHOR_RUN_ID)
    setHooks({ lock: HARNESS_LOCK })
    renderPanel({ state: "open" })
    // The harness gate is open (the timeline is mounted), so the absence below is a
    // measurement of the callback and not of the gate.
    expect(screen.getByTestId("phase-timeline")).toBeInTheDocument()
    await waitFor(() => expect(getThreadWorkflow).toHaveBeenCalled())
    expect(screen.queryByText("Open the run")).not.toBeInTheDocument()
  })

  it("renders NOTHING on a Deep / no-run thread, even with the callback supplied", async () => {
    setAnchor(ANCHOR_RUN_ID)
    setHooks({ todos: mockTodos, phases: [], lock: null })
    renderPanel({ state: "open", onOpenRun: vi.fn() })
    // POSITIVE CONTROL for the gate: no timeline either, which is what "Deep" means here.
    expect(screen.queryByTestId("phase-timeline")).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId("todos-section")).toBeInTheDocument())
    expect(screen.queryByText("Open the run")).not.toBeInTheDocument()
  })

  it("renders NOTHING when the thread has NEITHER id to open", async () => {
    setAnchor(null, null)
    setHooks({ lock: HARNESS_LOCK })
    renderPanel({ state: "open", onOpenRun: vi.fn() })
    await waitFor(() => expect(getThreadWorkflow).toHaveBeenCalled())
    expect(screen.queryByText("Open the run")).not.toBeInTheDocument()
  })

  // ── CR-03 (Phase 188 review) — the case this receipt EXISTS for ────────────────
  //
  // The receipt's own docblock used to justify reading only the live anchor with "the
  // thread frame's anchor survives termination ... and is the only honest source." That
  // is FALSE, and the falseness is in the DB: `finish_run` runs
  //   UPDATE threads SET active_workflow_run_id = NULL WHERE active_workflow_run_id = $1
  // in the SAME transaction as the terminal status (it is Phase 092's SC#2 — no dangling
  // lock survives a terminal run, and other surfaces depend on it, so it is NOT undone).
  //
  // Consequence before the fix: the receipt rendered ONLY while the run was live, and was
  // absent for exactly the case it was built for. With `GET /runs` deferred, no router, no
  // nav item claiming the run home and `activeRunId` held in volatile React state, a
  // finished run then had ZERO entry points once the user navigated away — "a finished run
  // re-opens" true of the endpoint and false of the product.
  //
  // The fix reuses the resolution `GET /threads/{id}/workflow` ALREADY performs for the
  // phase spine (`phases_source_run_id` = anchor, else the thread's latest `workflow_runs`
  // row) and simply puts it on the wire. Zero migrations, zero new queries, and no change
  // to `finish_run`.
  it("renders the receipt for a TERMINAL run whose live anchor has been cleared", async () => {
    setAnchor(null, LAST_RUN_ID)
    setHooks({ lock: HARNESS_LOCK })
    const onOpenRun = vi.fn()
    const user = userEvent.setup()
    renderPanel({ state: "open", onOpenRun })
    await user.click(await screen.findByText("Open the run"))
    expect(onOpenRun).toHaveBeenCalledWith(LAST_RUN_ID)
  })

  it("prefers the LIVE anchor over the last-run fallback while a run is under way", async () => {
    // The two ids differ on purpose: mid-run they are the same row in production, so a
    // fallback that silently won would be invisible without a discriminating fixture.
    setAnchor(ANCHOR_RUN_ID, LAST_RUN_ID)
    setHooks({ lock: HARNESS_LOCK })
    const onOpenRun = vi.fn()
    const user = userEvent.setup()
    renderPanel({ state: "open", onOpenRun })
    await user.click(await screen.findByText("Open the run"))
    expect(onOpenRun).toHaveBeenCalledWith(ANCHOR_RUN_ID)
    expect(onOpenRun).not.toHaveBeenCalledWith(LAST_RUN_ID)
  })

  it("renders NOTHING when the anchor read fails — it never throws into the panel", async () => {
    getThreadWorkflow.mockRejectedValue(new Error("network"))
    setHooks({ lock: HARNESS_LOCK })
    renderPanel({ state: "open", onOpenRun: vi.fn() })
    await waitFor(() => expect(getThreadWorkflow).toHaveBeenCalled())
    expect(screen.getByTestId("phase-timeline")).toBeInTheDocument()
    expect(screen.queryByText("Open the run")).not.toBeInTheDocument()
  })

  it("does not read PhaseTimeline or PhaseCard internals for the receipt (the G-5 red line)", () => {
    // The receipt is an ADDITIVE SIBLING. The panel's own docblock forbids this section
    // reading either component's internals or adding a prop to either; the source below
    // is the mechanical half of that promise.
    //
    // ⚠ ANCHORED ON STRIPPED-COMMENT CODE, and MEASURED: this file's own docblocks state
    // the red line in prose and therefore SPELL the very component names the fence
    // forbids. Indexing the raw source would make a code rule satisfiable — and in this
    // case unsatisfiable — by a paragraph. The stripper is tested first, below, because a
    // fence anchored on a broken stripper is a fence that silently passes.
    const code = codeOf(workspacePanelSource)
    expect(code).toMatch(/function RunSeam\(/)
    // The card is never even imported for this; only the prose explaining the rule names it.
    expect(workspacePanelSource).toMatch(/PhaseCard/)
    expect(code).not.toMatch(/PhaseCard/)
    // No prop was added to either neighbour.
    expect(code).not.toMatch(/<PhaseTimeline[^>]*onOpenRun/)
    expect(code).not.toMatch(/<PhaseCard/)
    // The id source is the thread anchor field.
    expect(code).toMatch(/active_workflow_run_id/)
  })

  it("the comment stripper works — and this file really does carry the names in prose", () => {
    const sample = codeOf("/** PhaseCard in prose */\n// PhaseCard in a line\nconst x = 1\n")
    expect(sample).not.toMatch(/PhaseCard/)
    expect(sample).toMatch(/const x = 1/)
  })
})

/** The panel source with its comments removed — see the G-5 fence above for why. */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}
