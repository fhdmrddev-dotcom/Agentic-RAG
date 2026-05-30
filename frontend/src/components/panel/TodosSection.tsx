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

// Phase 088-05 (operator request) — per-status color for the STATUS-TEXT label.
// Color is ADDITIVE only (the word still renders → non-color-only A11Y intact).
// Panel-scoped, per-theme AA tokens (≥4.5:1 on the --panel-surface in BOTH
// themes; computed in index.css). Matches the icon hues in spirit: completed →
// green (like the check icon), in_progress → amber active accent. Pending stays
// the neutral muted-dim (not-started = no status color).
const STATUS_TEXT_COLOR: Record<TodoStatus, string> = {
  pending: "text-panel-muted-foreground-dim",
  in_progress: "text-panel-status-active",
  completed: "text-panel-status-done",
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
  return <Circle className="h-4 w-4 flex-none text-panel-muted-foreground" aria-hidden="true" />
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
          // Phase 088-05 (UAT SC#2): completed-todo text is meaningful content →
          // panel-scoped AA muted (light --muted-foreground was 4.01:1 on panel).
          status === "completed" && "text-panel-muted-foreground line-through",
        )}
      >
        {todo.content}
      </span>
      {/* Status text — non-color-only A11Y; in the accessible tree (NOT
          aria-hidden) so the status is conveyed by text, not color alone. The
          per-status color (088-05) is ADDITIVE — the word is the source of
          truth; color just reinforces it (green=done, amber=active, muted=pending). */}
      <span
        className={cn(
          "ml-auto flex-none font-mono text-[0.62rem] uppercase tracking-wider",
          STATUS_TEXT_COLOR[status],
        )}
      >
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

  // Phase 088-01 (A11Y-01 / D-12, RESEARCH Pattern 7) — SR announce of todo
  // completion progress. `polite` (not assertive): status flips are informational,
  // and a multi-step run would interrupt the SR mid-read on every todo change if
  // assertive. The region is visually-hidden (sr-only) and renders text only
  // (never dangerouslySetInnerHTML — Phase 087 no-raw-HTML invariant, T-088-01-01).
  const total = ordered.length
  const doneCount = ordered.filter(
    (t) => normalizeStatus(t.status) === "completed",
  ).length

  return (
    <>
      <span className="sr-only" aria-live="polite">
        {`${doneCount} of ${total} todos complete`}
      </span>
      <ul className="flex flex-col gap-0.5">
        {ordered.map((todo) => (
          <TodoRow key={todo.id} todo={todo} />
        ))}
      </ul>
    </>
  )
}

export default TodosSection
