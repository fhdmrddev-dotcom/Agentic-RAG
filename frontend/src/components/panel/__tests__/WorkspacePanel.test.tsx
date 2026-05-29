/**
 * Phase 087 — WorkspacePanel composition tests (PANEL-01).
 *
 * Plan 06 re-architecture: WorkspacePanel is now CONTROLLED. The open/rail/hidden
 * state machine, the ⌘./Ctrl+. key listener, and the subscribeOpenPanel effect
 * were lifted to ChatLayout. These tests assert the CONTROLLED contract:
 *   - state="open"   → body/header (four sections + pinned PendingAskStack)
 *   - state="rail"   → PanelRail icons, no section bodies
 *   - state="hidden" → opacity-0 + pointer-events-none container, no body/rail
 *   - the in-panel header chevron calls onCycle; a rail icon calls onExpand
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
  onCycle?: () => void
  onExpand?: () => void
  onHide?: () => void
}
function renderPanel({ state = "open", onCycle = vi.fn(), onExpand = vi.fn(), onHide = vi.fn() }: RenderOpts = {}) {
  return render(
    <WorkspacePanel
      selectedThread={thread}
      state={state}
      onCycle={onCycle}
      onExpand={onExpand}
      onHide={onHide}
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

  it("state='hidden' renders an opacity-0 / pointer-events-none container with no body or rail", () => {
    renderPanel({ state: "hidden" })
    const panel = screen.getByRole("complementary", { name: /Agent workspace/i })
    expect(panel.className).toContain("opacity-0")
    expect(panel.className).toContain("pointer-events-none")
    expect(screen.queryByTestId("todos-section")).toBeNull()
    expect(screen.queryByRole("button", { name: /Todos —/i })).toBeNull()
  })

  it("the in-panel header chevron calls onCycle (open → rail → hidden → open is owned by ChatLayout)", async () => {
    const onCycle = vi.fn()
    const user = userEvent.setup()
    renderPanel({ state: "open", onCycle })
    await user.click(screen.getByRole("button", { name: /collapse workspace/i }))
    expect(onCycle).toHaveBeenCalledTimes(1)
  })

  it("a rail icon click calls onExpand", async () => {
    const onExpand = vi.fn()
    const user = userEvent.setup()
    renderPanel({ state: "rail", onExpand })
    await user.click(screen.getByRole("button", { name: /Files — 5/i }))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it("does NOT respond to ⌘./Ctrl+. (listener lifted to ChatLayout)", async () => {
    const onCycle = vi.fn()
    const onHide = vi.fn()
    const onExpand = vi.fn()
    const user = userEvent.setup()
    renderPanel({ state: "open", onCycle, onHide, onExpand })
    await user.keyboard("{Control>}.{/Control}")
    expect(onCycle).not.toHaveBeenCalled()
    expect(onHide).not.toHaveBeenCalled()
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

  it("mobile sheet onOpenChange(false) / X calls onHide", async () => {
    setViewport(375)
    const onHide = vi.fn()
    const user = userEvent.setup()
    renderPanel({ state: "open", onHide })
    await user.click(screen.getByRole("button", { name: /close workspace/i }))
    expect(onHide).toHaveBeenCalledTimes(1)
  })

  it("reads useViewingThread + the four Phase 086 hooks reactively (no page refresh)", () => {
    renderPanel({ state: "open" })
    expect(useViewingThread).toHaveBeenCalled()
    expect(useTodos).toHaveBeenCalledWith("thread-1")
    expect(useWorkspaceFiles).toHaveBeenCalledWith("thread-1")
    expect(useAskUserPrompt).toHaveBeenCalledWith("thread-1")
  })
})
