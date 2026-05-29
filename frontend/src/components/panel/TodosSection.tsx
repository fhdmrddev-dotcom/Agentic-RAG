/**
 * Phase 087 Plan 02 Task 2 — TodosSection (PANEL-02, sketch 004 / UI-SPEC).
 *
 * The live todo list. Consumes useTodos(threadId) (Phase 086 reactive hook —
 * full-state-replace identity, `data` never undefined, updates on write_todos
 * SSE with NO page refresh). Renders one row per todo in order_index order,
 * keyed by todo.id (stable identity across updates).
 *
 * Status is conveyed NON-color-only (A11Y): each row carries a status icon AND a
 * visible text label (pending / in progress / completed) — never color alone:
 *   - pending     → muted circle
 *   - in_progress → primary spinner-dot (dotBounce, reduced-motion-guarded)
 *   - completed   → green check (checkPop one-shot), strikethrough text
 *
 * No fetch logic here — the hook is reactive. Exported for WorkspacePanel to
 * place in the fixed-order accordion (Todos · Files · Pending · Versions).
 */
import { Circle, CircleDot, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTodos, useViewingThread } from "@/providers/StreamsProvider"
import type { Todo } from "@/types"

type TodoStatus = "pending" | "in_progress" | "completed"

function normalizeStatus(status: string): TodoStatus {
  if (status === "completed") return "completed"
  if (status === "in_progress" || status === "in-progress") return "in_progress"
  return "pending"
}

const STATUS_LABEL: Record<TodoStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
}

function StatusIndicator({ status }: { status: TodoStatus }) {
  if (status === "completed") {
    return (
      <CheckCircle2
        className="h-4 w-4 flex-none text-[hsl(var(--success))] motion-safe:animate-checkPop"
        aria-hidden="true"
      />
    )
  }
  if (status === "in_progress") {
    return (
      <CircleDot
        className="h-4 w-4 flex-none text-primary motion-safe:animate-dotBounce"
        aria-hidden="true"
      />
    )
  }
  return <Circle className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
}

function TodoRow({ todo }: { todo: Todo }) {
  const status = normalizeStatus(todo.status)
  return (
    <li className="flex items-start gap-2 px-3 py-1.5 text-[0.82rem] leading-relaxed">
      <span className="mt-0.5">
        <StatusIndicator status={status} />
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 text-foreground/90",
          status === "completed" && "text-muted-foreground line-through",
        )}
      >
        {todo.content}
      </span>
      {/* Status text — non-color-only A11Y; in the accessible tree (NOT
          aria-hidden) so the status is conveyed by text, not color alone. */}
      <span className="ml-auto flex-none font-mono text-[0.62rem] uppercase tracking-wider text-[hsl(var(--muted-foreground-dim))]">
        {STATUS_LABEL[status]}
      </span>
    </li>
  )
}

export function TodosSection() {
  const threadId = useViewingThread()
  const { data: todos } = useTodos(threadId)

  if (todos.length === 0) return null

  const ordered = [...todos].sort((a, b) => a.order_index - b.order_index)

  return (
    <ul className="flex flex-col gap-0.5">
      {ordered.map((todo) => (
        <TodoRow key={todo.id} todo={todo} />
      ))}
    </ul>
  )
}

export default TodosSection
