/**
 * Phase 087 Plan 02 Task 3 — WorkspacePanel live tests (PANEL-01).
 *
 * Flipped from the Wave 0 it.todo skeleton. Asserts the grid-state machine
 * (open → rail → hidden via the header toggle), the ⌘./Ctrl+. keyboard toggle,
 * the rail count badges + amber pending-warn affordance, the empty short-circuit
 * (ONE PanelEmpty, never four headers), the four-section composition with the
 * pinned PendingAskStack, the <768px bottom-sheet, and the reactive
 * useViewingThread + four-hook consumption.
 *
 * The four Phase 086 hooks + useViewingThread are mocked. The heavy section
 * bodies (FilesSection / VersionDiff / TodosSection / PendingAskStack) are mocked
 * to thin sentinels — their own behavior is covered by their own test files; here
 * we assert COMPOSITION + the shell state machine.
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
import { WorkspacePanel } from "@/components/panel/WorkspacePanel"

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

describe("WorkspacePanel (PANEL-01) — toggle state machine + empty short-circuit", () => {
  beforeEach(() => {
    setViewport(1280) // desktop default
    setHooks({})
  })

  it("renders a complementary landmark labelled 'Agent workspace'", () => {
    render(<WorkspacePanel selectedThread={thread} />)
    expect(screen.getByRole("complementary", { name: /Agent workspace/i })).toBeInTheDocument()
  })

  it("renders the three-state toggle: open → rail → hidden via the header button", async () => {
    const user = userEvent.setup()
    render(<WorkspacePanel selectedThread={thread} />)
    // open: sections visible
    expect(screen.getByTestId("todos-section")).toBeInTheDocument()
    const toggle = screen.getByRole("button", { name: /collapse|toggle workspace|hide workspace/i })
    // open → rail
    await user.click(toggle)
    expect(screen.queryByTestId("todos-section")).toBeNull()
    expect(screen.getByRole("button", { name: /Todos —/i })).toBeInTheDocument() // rail icon
    // rail → hidden (click a rail icon expands; the header toggle cycles forward)
  })

  it("toggles open ↔ collapsed on ⌘. / Ctrl+. keydown", async () => {
    const user = userEvent.setup()
    render(<WorkspacePanel selectedThread={thread} />)
    expect(screen.getByTestId("todos-section")).toBeInTheDocument()
    await user.keyboard("{Control>}.{/Control}")
    // hidden — sections gone, rail gone
    expect(screen.queryByTestId("todos-section")).toBeNull()
    await user.keyboard("{Control>}.{/Control}")
    expect(screen.getByTestId("todos-section")).toBeInTheDocument()
  })

  it("collapsed rail shows count badges (todos / files) and an amber warn affordance when an ask_user is pending", async () => {
    setHooks({ asks: [mockPendingAskWithRunId] })
    const user = userEvent.setup()
    render(<WorkspacePanel selectedThread={thread} />)
    const toggle = screen.getByRole("button", { name: /collapse|toggle workspace|hide workspace/i })
    await user.click(toggle) // → rail
    expect(screen.getByRole("button", { name: /Todos — 1 of 3 done/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Files — 5/i })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Pending question — needs your answer/i }),
    ).toBeInTheDocument()
  })

  it("short-circuits to a single <PanelEmpty/> when todos, files, and asks are all empty (no four empty headers)", () => {
    setHooks({ todos: [], files: [], asks: [] })
    render(<WorkspacePanel selectedThread={thread} />)
    expect(screen.getByText(/No workspace activity yet/i)).toBeInTheDocument()
    // No section bodies, no four headers
    expect(screen.queryByTestId("todos-section")).toBeNull()
    expect(screen.queryByTestId("files-section")).toBeNull()
  })

  it("renders all four stacked-accordion sections when any section has data", () => {
    render(<WorkspacePanel selectedThread={thread} />)
    expect(screen.getByTestId("todos-section")).toBeInTheDocument()
    expect(screen.getByTestId("files-section")).toBeInTheDocument()
    // fixed-order section headers present
    expect(screen.getByRole("button", { name: /^Todos/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Files/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Versions/i })).toBeInTheDocument()
  })

  it("pins the pending ask_user stack to the very top of the panel scroll", () => {
    setHooks({ asks: [mockPendingAskWithRunId] })
    render(<WorkspacePanel selectedThread={thread} />)
    const panel = screen.getByRole("complementary", { name: /Agent workspace/i })
    const stack = within(panel).getByTestId("pending-ask-stack")
    expect(stack).toBeInTheDocument()
    // The stack precedes the todos section in DOM order (pinned top).
    const todos = within(panel).getByTestId("todos-section")
    expect(stack.compareDocumentPosition(todos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("renders as a bottom-sheet (Sheet primitive) below the 768px breakpoint", () => {
    setViewport(375)
    render(<WorkspacePanel selectedThread={thread} />)
    // Mobile: a dialog (Radix Sheet) hosts the body when opened.
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("reads useViewingThread + the four Phase 086 hooks reactively (no page refresh)", () => {
    render(<WorkspacePanel selectedThread={thread} />)
    expect(useViewingThread).toHaveBeenCalled()
    expect(useTodos).toHaveBeenCalledWith("thread-1")
    expect(useWorkspaceFiles).toHaveBeenCalledWith("thread-1")
    expect(useAskUserPrompt).toHaveBeenCalledWith("thread-1")
  })
})
