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
import { Circle, CircleDot, CircleDashed, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  useTodos,
  useViewingThread,
  useDerivedPanel,
  useStreamingForThread,
  useLoadingForThread,
} from "@/providers/StreamsProvider"
import type { Todo } from "@/types"
import type { DerivedPanelItem } from "@/lib/workspacePanel"
import {
  NOT_TICKED_LABEL,
  RUN_ENDED_TITLE,
  deriveTodoDisplayStatus,
  stripRunEndedMarker,
  type TodoDisplayStatus,
} from "./todoRunHonesty"

type TodoStatus = "pending" | "in_progress" | "completed"

function normalizeStatus(status: string): TodoStatus {
  if (status === "completed") return "completed"
  if (status === "in_progress" || status === "in-progress") return "in_progress"
  return "pending"
}

const STATUS_LABEL: Record<TodoDisplayStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  // Phase 250 HONEST-03/04 — the fourth value exists only for DISPLAY. `todos.status` still
  // carries three values and no migration was needed (D-250-05).
  not_ticked: NOT_TICKED_LABEL,
}

// Phase 088-05 (operator request) — per-status color for the STATUS-TEXT label.
// Color is ADDITIVE only (the word still renders → non-color-only A11Y intact).
// Panel-scoped, per-theme AA tokens (≥4.5:1 on the --panel-surface in BOTH
// themes; computed in index.css). Matches the icon hues in spirit: completed →
// green (like the check icon), in_progress → amber active accent. Pending stays
// the neutral muted-dim (not-started = no status color).
const STATUS_TEXT_COLOR: Record<TodoDisplayStatus, string> = {
  pending: "text-panel-muted-foreground-dim",
  in_progress: "text-panel-status-active",
  completed: "text-panel-status-done",
  // Phase 250 — the DIM tier of run-state-honesty.md D1 (dim → amber → red, loudness earned by
  // severity). An abandoned todo is the quiet case: usually nobody's fault, often the user's own
  // Stop. It must NOT borrow the amber the active state uses.
  not_ticked: "text-panel-muted-foreground-dim",
}

function StatusIndicator({ status }: { status: TodoDisplayStatus }) {
  if (status === "not_ticked") {
    // ⛔ NO `animate-` CLASS. The bouncing dot on a dead run is the loudest lie on this
    // surface — BUG-260902-01 describes a person waiting for something that stopped seven
    // minutes earlier.
    return (
      <CircleDashed
        className="h-4 w-4 flex-none text-panel-muted-foreground-dim"
        aria-hidden="true"
      />
    )
  }
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

/**
 * ⚠ Phase 224-05 (SEED-240) — THE BADGE NO LONGER DICTATES THE WRAP POINT.
 *
 * Measured by the operator at 1536x639: the panel column is `clamp(300px,30%,420px)`
 * (`ChatLayout.tsx:727`) and resolved to **308px** — essentially its FLOOR — inside which a
 * todo label was allotted ~186px before the status badge, so *"Search knowledge base for
 * report data"* broke mid-phrase while the badge aligned to the first line only.
 *
 * ⚠ **Widening the panel is NOT available**: 308px means the clamp is already at its
 * minimum on an ordinary laptop, so the fix has to be the row's layout.
 *
 * The row now wraps: the label takes the width it needs (floor `9rem`, so a short label
 * keeps its badge inline exactly as before) and the badge drops to its own line only when
 * the sentence genuinely needs the room. Nothing is truncated and nothing is hidden — the
 * status word stays in the accessible tree, which the 088-05 colour rule requires.
 */
function TodoRow({ todo, isRunLive }: { todo: Todo; isRunLive: boolean }) {
  // Phase 250 HONEST-03/04 — ONE derivation, in ONE module, used by BOTH row renderers.
  // The marker never reaches the screen: it becomes the row's title, and the STATUS slot
  // carries the honesty instead of the task text (SEED-105 item 3).
  const { label, wasMarked } = stripRunEndedMarker(todo.content)
  const status = deriveTodoDisplayStatus(normalizeStatus(todo.status), isRunLive)
  return (
    <li
      className="flex flex-wrap items-start gap-x-2 gap-y-0.5 px-3 py-1.5 text-[0.82rem] leading-relaxed"
      title={wasMarked && status === "not_ticked" ? RUN_ENDED_TITLE : undefined}
    >
      <span className="mt-0.5">
        <StatusIndicator status={status} />
      </span>
      <span
        className={cn(
          "min-w-[9rem] flex-1 text-foreground/90",
          // Phase 088-05 (UAT SC#2): completed-todo text is meaningful content →
          // panel-scoped AA muted (light --muted-foreground was 4.01:1 on panel).
          status === "completed" && "text-panel-muted-foreground line-through",
          status === "not_ticked" && "text-panel-muted-foreground",
        )}
      >
        {label}
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

// Phase 095.1 Plan 02 (D-095.1-01/02) — a single DERIVED, READ-ONLY row. Reuses
// the EXACT real-todo row layout (StatusIndicator + text + status-text label) so
// derived items look like first-class panel items, but renders NO interactive
// control: a derived item mirrors a tool's status and the user cannot tick it.
// The label is a model/sandbox-derived string → rendered as React text children
// ONLY, never as raw/innerHTML markup (T-095.1-02-01 / Pattern E).
function DerivedRow({ item, isRunLive }: { item: DerivedPanelItem; isRunLive: boolean }) {
  // DerivedPanelItem.status is already the panel vocabulary
  // ("pending" | "in_progress" | "completed") — normalize defensively anyway.
  // ⛔ Phase 250: the IDENTICAL derivation as TodoRow, from the SAME module. A derived
  // in_progress row on a dead run is the identical lie, and two copies of the rule is the
  // drift this phase exists to close.
  const status = deriveTodoDisplayStatus(normalizeStatus(item.status), isRunLive)
  return (
    <li className="flex flex-wrap items-start gap-x-2 gap-y-0.5 px-3 py-1.5 text-[0.82rem] leading-relaxed">
      <span className="mt-0.5">
        <StatusIndicator status={status} />
      </span>
      <span
        className={cn(
          "min-w-[9rem] flex-1 text-foreground/90",
          status === "completed" && "text-panel-muted-foreground line-through",
          status === "not_ticked" && "text-panel-muted-foreground",
        )}
      >
        {item.label}
      </span>
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
  // Phase 095.1 (D-095.1-01/02): the activity-derived fallback panel. Precedence:
  //   1. real write_todos (todos non-empty) → render those (today's behavior).
  //   2. real todos empty + derived non-empty → derived read-only rows + marker.
  //   3. both empty → null (clean). A real plan is NEVER overwritten (Pitfall 2).
  const derived = useDerivedPanel(threadId)
  // Phase 250 HONEST-03 (D-250-04) — is anything actually running on this thread?
  // ⛔ `useLoadingForThread` is OR-ed in DELIBERATELY: during a reconnect/fetch window
  // `streamingThreads` can read empty for a live run, and a row must never flash
  // "not ticked" while the agent is working. Realtime is a hint, not truth (D-v2.5-03).
  // ⛔ Both selectors already ship (Phase 075.4) — StreamsProvider.tsx is NOT modified.
  //
  // ⛔⛔ THE TWO HOOKS ARE CALLED ON THEIR OWN LINES AND THE `||` COMBINES THEIR VALUES.
  // NEVER write `useStreamingForThread(threadId) || useLoadingForThread(threadId)`.
  // `||` SHORT-CIRCUITS: the moment the first selector returns true — i.e. the moment a
  // run actually starts — the second hook is never called, React counts fewer hooks than
  // the previous render, throws "Rendered fewer hooks than expected", and THE WHOLE PAGE
  // GOES BLANK. Shipped that way for one commit in Phase 250 and found by DRIVING the app,
  // not by a test: every unit fence passed, because a `vi.fn()` standing in for a hook
  // consumes no hook slot, so the violation is structurally invisible to them.
  // Pinned by `__tests__/TodosSection.test.tsx` → "hooks are never short-circuited".
  const isStreaming = useStreamingForThread(threadId)
  const isLoading = useLoadingForThread(threadId)
  const isRunLive = isStreaming || isLoading

  // PRECEDENCE 2 + 3: no real write_todos plan for this thread.
  if (todos.length === 0) {
    if (derived.length === 0) return null
    return (
      <>
        {/* Subtle, non-interactive marker — the derived items are honest about
            being synthesized from tool activity (D-095.1-01, Claude's discretion
            on placement: once, at the section top). */}
        <span className="block px-3 pb-1 text-[0.62rem] font-mono uppercase tracking-wider text-panel-muted-foreground-dim">
          derived from activity
        </span>
        <ul className="flex flex-col gap-0.5">
          {derived.map((item, i) => (
            <DerivedRow key={i} item={item} isRunLive={isRunLive} />
          ))}
        </ul>
      </>
    )
  }

  // PRECEDENCE 1: a real write_todos plan exists — render it verbatim (unchanged).
  const ordered = [...todos].sort((a, b) => a.order_index - b.order_index)

  // Phase 088-01 (A11Y-01 / D-12, RESEARCH Pattern 7) — SR announce of todo
  // completion progress. `polite` (not assertive): status flips are informational,
  // and a multi-step run would interrupt the SR mid-read on every todo change if
  // assertive. The region is visually-hidden (sr-only) and renders text only
  // (never raw/innerHTML markup — Phase 087 no-raw-HTML invariant, T-088-01-01).
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
          <TodoRow key={todo.id} todo={todo} isRunLive={isRunLive} />
        ))}
      </ul>
    </>
  )
}

export default TodosSection
