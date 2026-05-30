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
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import type { Todo, WorkspaceFile, PendingAsk } from "@/types"
import { mockTodos, mockWorkspaceFiles, mockPendingAskWithRunId } from "./fixtures"

const useTodos = vi.fn()
const useWorkspaceFiles = vi.fn()
const useAskUserPrompt = vi.fn()
const useViewingThread = vi.fn()
vi.mock("@/providers/StreamsProvider", () => ({
  useTodos: (...a: unknown[]) => useTodos(...a),
  useWorkspaceFiles: (...a: unknown[]) => useWorkspaceFiles(...a),
  useAskUserPrompt: (...a: unknown[]) => useAskUserPrompt(...a),
  useViewingThread: (...a: unknown[]) => useViewingThread(...a),
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
}: { todos?: Todo[]; files?: WorkspaceFile[]; asks?: PendingAsk[]; viewing?: string | null }) {
  useTodos.mockReturnValue({ data: todos, isLoading: false, error: null, reconcile: vi.fn() })
  useWorkspaceFiles.mockReturnValue({ data: files, isLoading: false, error: null, reconcile: vi.fn() })
  useAskUserPrompt.mockReturnValue({ data: asks, isLoading: false, error: null, reconcile: vi.fn() })
  useViewingThread.mockReturnValue(viewing)
}

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width })
}

interface RenderOpts {
  state?: PanelState
  onToggle?: () => void
  onExpand?: () => void
}
function renderPanel({ state = "open", onToggle = vi.fn(), onExpand = vi.fn() }: RenderOpts = {}) {
  return render(
    <WorkspacePanel
      selectedThread={thread}
      state={state}
      onToggle={onToggle}
      onExpand={onExpand}
    />,
  )
}

describe("WorkspacePanel (PANEL-01) — controlled composition", () => {
  beforeEach(() => {
    setViewport(1280) // desktop default
    setHooks({})
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
