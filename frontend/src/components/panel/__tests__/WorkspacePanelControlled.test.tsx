/**
 * Phase 087 Plan 06 Task 2 (TDD RED) — WorkspacePanel controlled-API contract.
 *
 * The state machine is lifted to ChatLayout; WorkspacePanel becomes controlled
 * (state / onCycle / onExpand / onHide props, NO internal useState<PanelState>,
 * NO ⌘. listener, NO subscribeOpenPanel effect, NO self-referential aside grid).
 * These assertions fail against the pre-Plan-06 internal-state implementation and
 * pass once Task 2's controlled rewrite lands (RED → GREEN). Task 4 folds the full
 * coverage back into WorkspacePanel.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
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

describe("WorkspacePanel (controlled API — Plan 06)", () => {
  beforeEach(() => {
    setViewport(1280)
    setHooks({})
  })

  it("renders body/header when state='open' (controlled)", () => {
    render(
      <WorkspacePanel
        selectedThread={thread}
        state="open"
        onCycle={vi.fn()}
        onExpand={vi.fn()}
        onHide={vi.fn()}
      />,
    )
    expect(screen.getByTestId("todos-section")).toBeInTheDocument()
  })

  it("renders the rail when state='rail' and no body sections", () => {
    render(
      <WorkspacePanel
        selectedThread={thread}
        state="rail"
        onCycle={vi.fn()}
        onExpand={vi.fn()}
        onHide={vi.fn()}
      />,
    )
    expect(screen.queryByTestId("todos-section")).toBeNull()
    expect(screen.getByRole("button", { name: /Todos —/i })).toBeInTheDocument()
  })

  it("renders nothing (hidden container) when state='hidden'", () => {
    render(
      <WorkspacePanel
        selectedThread={thread}
        state="hidden"
        onCycle={vi.fn()}
        onExpand={vi.fn()}
        onHide={vi.fn()}
      />,
    )
    expect(screen.queryByTestId("todos-section")).toBeNull()
    expect(screen.queryByRole("button", { name: /Todos —/i })).toBeNull()
  })

  it("calls onCycle when the in-panel header chevron is clicked", async () => {
    const onCycle = vi.fn()
    const user = userEvent.setup()
    render(
      <WorkspacePanel
        selectedThread={thread}
        state="open"
        onCycle={onCycle}
        onExpand={vi.fn()}
        onHide={vi.fn()}
      />,
    )
    await user.click(screen.getByRole("button", { name: /collapse workspace/i }))
    expect(onCycle).toHaveBeenCalledTimes(1)
  })

  it("calls onExpand when a rail icon is clicked", async () => {
    const onExpand = vi.fn()
    const user = userEvent.setup()
    render(
      <WorkspacePanel
        selectedThread={thread}
        state="rail"
        onCycle={vi.fn()}
        onExpand={onExpand}
        onHide={vi.fn()}
      />,
    )
    await user.click(screen.getByRole("button", { name: /Todos —/i }))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it("does NOT toggle on ⌘./Ctrl+. (listener moved to ChatLayout)", async () => {
    const user = userEvent.setup()
    render(
      <WorkspacePanel
        selectedThread={thread}
        state="open"
        onCycle={vi.fn()}
        onExpand={vi.fn()}
        onHide={vi.fn()}
      />,
    )
    await user.keyboard("{Control>}.{/Control}")
    // Controlled: state is owned by the parent; the panel ignores the key.
    expect(screen.getByTestId("todos-section")).toBeInTheDocument()
  })

  it("mobile (<768px): hosts the body in a Sheet dialog when state='open'", () => {
    setViewport(375)
    render(
      <WorkspacePanel
        selectedThread={thread}
        state="open"
        onCycle={vi.fn()}
        onExpand={vi.fn()}
        onHide={vi.fn()}
      />,
    )
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })
})
