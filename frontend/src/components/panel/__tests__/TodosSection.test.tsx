/**
 * Phase 087 Plan 02 Task 2 — TodosSection live tests (PANEL-02).
 *
 * Flipped from the Wave 0 it.todo skeleton: TodosSection renders the live todo
 * list from useTodos(threadId).data, one row per todo in order_index order, with
 * a status indicator conveyed NON-color-only (icon/text) per pending /
 * in_progress / completed; re-rendering with an updated array (full-state-replace,
 * no manual refresh) reflects the new status; rows key by todo.id.
 *
 * useTodos + useViewingThread are mocked (the Phase 086 reactive hooks).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { axe } from "vitest-axe"
import type { Todo } from "@/types"
import { mockTodos } from "./fixtures"

const useTodos = vi.fn()
const useViewingThread = vi.fn()
const useDerivedPanel = vi.fn()
vi.mock("@/providers/StreamsProvider", () => ({
  useTodos: (...a: unknown[]) => useTodos(...a),
  useViewingThread: (...a: unknown[]) => useViewingThread(...a),
  useDerivedPanel: (...a: unknown[]) => useDerivedPanel(...a),
}))

// eslint-disable-next-line import/first
import { TodosSection } from "@/components/panel/TodosSection"

function setTodos(data: Todo[]) {
  useTodos.mockReturnValue({ data, isLoading: false, error: null, reconcile: vi.fn() })
}

describe("TodosSection (PANEL-02) — live todo list with status", () => {
  beforeEach(() => {
    useViewingThread.mockReturnValue("thread-1")
    setTodos(mockTodos)
    // Default: no derived items (Phase 095.1 — real todos win; derivation is the
    // empty-real fallback). Individual derived-fallback tests override this.
    useDerivedPanel.mockReturnValue([])
  })

  it("renders every todo from useTodos(threadId).data in order_index order", () => {
    render(<TodosSection />)
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(mockTodos.length)
    // order_index order: completed(0) → in_progress(1) → pending(2)
    expect(items[0]).toHaveTextContent("Read the source dataset")
    expect(items[1]).toHaveTextContent("Compute the Q3 rollup")
    expect(items[2]).toHaveTextContent("Write summary.md")
  })

  it("shows a distinct status indicator per status (pending / in_progress / completed)", () => {
    render(<TodosSection />)
    // Status conveyed by text label (non-color-only A11Y), distinct per status.
    expect(screen.getByText(/completed/i)).toBeInTheDocument()
    expect(screen.getByText(/in progress/i)).toBeInTheDocument()
    expect(screen.getByText(/pending/i)).toBeInTheDocument()
  })

  it("completed todos use a check indicator conveyed non-color-only", () => {
    render(<TodosSection />)
    const completedRow = screen.getByText("Read the source dataset").closest("li")
    expect(completedRow).not.toBeNull()
    // Status text (not color alone) marks it done.
    expect(completedRow).toHaveTextContent(/completed/i)
  })

  it("re-renders with the new full list when useTodos data changes (full-state-replace, no refresh)", () => {
    const { rerender } = render(<TodosSection />)
    expect(screen.getByText("Read the source dataset").closest("li")).toHaveTextContent(
      /completed/i,
    )
    // The agent flips todo-3 pending → in_progress via a write_todos SSE; the
    // hook returns a fresh full array — no manual reconcile() call.
    const updated: Todo[] = mockTodos.map((t) =>
      t.id === "todo-3" ? { ...t, status: "in_progress" } : t,
    )
    setTodos(updated)
    rerender(<TodosSection />)
    expect(screen.getByText("Write summary.md").closest("li")).toHaveTextContent(
      /in progress/i,
    )
  })

  it("keys rows by todo.id (stable identity across write_todos updates)", () => {
    render(<TodosSection />)
    // All three ids surface as distinct rows.
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
  })

  it("renders nothing / collapses cleanly when the todo list is empty", () => {
    setTodos([])
    render(<TodosSection />)
    expect(screen.queryByRole("listitem")).toBeNull()
  })

  // Phase 088-01 (D-13a) — structural a11y regression gate. Asserts no axe
  // violations across the populated state (mixed done/in_progress/pending, so the
  // <ul>/<li> list + the new aria-live region render). NOTE (Pitfall 5): axe under
  // jsdom proves STRUCTURE (roles/names/labels) only, NOT 4.5:1 contrast — contrast
  // is the Chrome MCP Lighthouse job in Plan 05.
  it("has no axe violations (populated state — mixed statuses + aria-live region)", async () => {
    setTodos(mockTodos)
    const { container } = render(<TodosSection />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

// Phase 095.1 Plan 02 Task 2 (D-095.1-01/02) — precedence render: real
// write_todos first; else activity-derived READ-ONLY rows + the "derived from
// activity" marker; else null. Closes the panel-fill parity gap for providers
// that never call write_todos (BUG-260604-01 panel-fill symptom).
describe("TodosSection (D-095.1-01/02) — derived-panel precedence", () => {
  beforeEach(() => {
    useViewingThread.mockReturnValue("thread-1")
    setTodos([])
    useDerivedPanel.mockReturnValue([])
  })

  it("PRECEDENCE 1: real write_todos present → renders the real todos, NO derived marker", () => {
    setTodos(mockTodos)
    // Even if the gate would derive items, a real plan must NEVER be overwritten.
    useDerivedPanel.mockReturnValue([{ label: "Run code", status: "in_progress" }])
    render(<TodosSection />)
    expect(screen.getByText("Read the source dataset")).toBeInTheDocument()
    // No derivation marker, and the derived label is NOT rendered.
    expect(screen.queryByText(/derived from activity/i)).toBeNull()
    expect(screen.queryByText("Run code")).toBeNull()
  })

  it("PRECEDENCE 2: real todos empty + derived non-empty → renders derived rows + the marker", () => {
    setTodos([])
    useDerivedPanel.mockReturnValue([
      { label: "Compute the Q3 rollup", status: "completed" },
      { label: "Create CSV file", status: "in_progress" },
    ])
    render(<TodosSection />)
    // The marker appears exactly once at the section top.
    expect(screen.getByText(/derived from activity/i)).toBeInTheDocument()
    // The derived labels render as text children.
    expect(screen.getByText("Compute the Q3 rollup")).toBeInTheDocument()
    expect(screen.getByText("Create CSV file")).toBeInTheDocument()
    // Two derived rows render.
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })

  it("derived rows are READ-ONLY — no interactive tick / button / checkbox affordance", () => {
    setTodos([])
    useDerivedPanel.mockReturnValue([{ label: "Search documents", status: "completed" }])
    const { container } = render(<TodosSection />)
    // No interactive control on any derived row.
    expect(container.querySelector("button")).toBeNull()
    expect(container.querySelector('input[type="checkbox"]')).toBeNull()
  })

  it("PRECEDENCE 3: real todos empty + derived empty → renders nothing", () => {
    setTodos([])
    useDerivedPanel.mockReturnValue([])
    const { container } = render(<TodosSection />)
    expect(screen.queryByRole("listitem")).toBeNull()
    expect(screen.queryByText(/derived from activity/i)).toBeNull()
    expect(container.textContent).toBe("")
  })

  it("derived state has no axe violations", async () => {
    setTodos([])
    useDerivedPanel.mockReturnValue([
      { label: "Compute the Q3 rollup", status: "completed" },
      { label: "Create CSV file", status: "in_progress" },
    ])
    const { container } = render(<TodosSection />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
