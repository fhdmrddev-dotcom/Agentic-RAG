/**
 * Phase 087 Wave 0 — TodosSection contract (PANEL-02).
 *
 * GREEN-only scaffolding: TodosSection is not built yet (Plan 02). The
 * `it.todo(...)` strings are the concrete assertions Plan 02 MUST flip to live
 * tests. Fixtures anchor the Todo wire shape + the useTodos hook-return contract.
 */
import { describe, it } from "vitest"
import { mockTodos, mockUseTodos } from "./fixtures"

void mockTodos
void mockUseTodos

describe("TodosSection (PANEL-02) — live todo list with status", () => {
  it.todo("renders every todo from useTodos(threadId).data in order_index order")
  it.todo("shows a distinct status indicator per status (pending / in_progress / completed)")
  it.todo("re-renders with the new full list when useTodos data changes (full-state-replace, no refresh)")
  it.todo("keys rows by todo.id (stable identity across write_todos updates)")
  it.todo("renders nothing / collapses cleanly when the todo list is empty")
})
