/**
 * Phase 094 Plan 05 Task 3 (PANEL-09 / D-06) — BatchResultList: per-subtopic
 * sub-agent summaries, readable BEFORE merge (run-honesty winner 010-C).
 *
 * A batch (llm_batch_agents) phase fans out N sub-agents, one per sub-question;
 * each finishes with a `sub_agent_done.summary` (the only real per-subtopic
 * result text on the producer wire — DATA-CONTRACT §2 / §4.4). This list surfaces
 * those summaries so the operator can read each child's result progressively,
 * instead of waiting for the merged final answer (which is the only thing the
 * chat shows today). Sketch 010-C: "Batch sub-results readable before merge."
 *
 * DATA SOURCE — PANEL-09 isolation (the binding constraint): reads
 * `useTasks(threadId)` (the panel-only `tasksByThread` slice the demux routes
 * sub_agent rows into, per 094-02/03) — NEVER a chat selector (`useThreadMessages`
 * / `bucketsBySurface`). A batch summary arriving therefore triggers ZERO chat
 * re-renders (T-094-05-04). `TaskRunIndexItem` already carries `description` (the
 * sub-question) + `summary` (the result on done) + `status`.
 *
 * Progressive disclosure: each row is collapsed by default (description + status
 * only); clicking expands to read the full `summary`. The running children show a
 * live status; the summary appears on done.
 *
 * SUPPRESSED COUNTS (D-03 / DATA-CONTRACT §8): NO per-item source/tool/search
 * count chip — those events fire on the invisible sub stream (`run:{sub_run_id}`),
 * never the producer; rendering them would be INVENTED. Only the description, the
 * status, and the real `summary` render.
 *
 * XSS (T-094-05-02 / T-087-11): `description` + `summary` are agent-influenced
 * strings rendered as plain React text children — NEVER dangerouslySetInnerHTML.
 */
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useTasks } from "@/providers/StreamsProvider"
import type { TaskRunIndexItem } from "@/types"

/** The "Overall topic… / Sub-question…" prefix the engine stamps onto a batch
 *  child's description (phase_types.py:295/361) is presentational noise here —
 *  trim it so the row reads as the clean sub-question. Falls back to the raw
 *  description (or a generic label) when no prefix is present. */
function cleanDescription(description: string | undefined): string {
  if (!description) return "Sub-task"
  // Drop a leading "Overall topic: …\n" / "Sub-question: " style prefix when one
  // is present; otherwise return the description as-is.
  const subQuestionMatch = description.match(/sub[-\s]?question\s*[:\-]\s*(.+)/is)
  if (subQuestionMatch) return subQuestionMatch[1].trim()
  return description.trim()
}

function BatchResultRow({ task }: { task: TaskRunIndexItem }) {
  const done = task.status === "completed" || task.status === "done"
  const failed = task.status === "failed"
  const [open, setOpen] = useState(false)
  // Only terminal rows with a real summary are expandable (nothing to disclose
  // while running / when no summary landed).
  const hasSummary = Boolean(task.summary && task.summary.trim().length > 0)
  const canToggle = hasSummary

  const statusText = failed ? "Failed" : done ? "Done" : "Running"
  const statusClass = done
    ? "text-[hsl(var(--panel-status-done))]"
    : failed
      ? "text-[hsl(0_80%_80%)]"
      : "text-[hsl(var(--panel-status-active))]"

  return (
    <li className="flex flex-col gap-1 rounded-md border border-border/50 bg-card/40 px-2.5 py-2 text-[13px]">
      <button
        type="button"
        aria-expanded={canToggle ? open : undefined}
        disabled={!canToggle}
        onClick={() => canToggle && setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-1.5 text-left",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          canToggle ? "cursor-pointer" : "cursor-default",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "h-[6px] w-[6px] flex-none rounded-full",
            failed
              ? "bg-[hsl(var(--destructive))]"
              : done
                ? "bg-[hsl(var(--panel-status-done))]"
                : "bg-[hsl(var(--panel-status-active))]",
          )}
        />
        {/* The sub-question (plain text children — XSS guard). */}
        <span className="min-w-0 flex-1 truncate text-foreground">
          {cleanDescription(task.description)}
        </span>
        <span className={cn("flex-none text-[11px] font-medium", statusClass)}>
          {statusText}
        </span>
        {canToggle && (
          <span aria-hidden="true" className="flex-none text-[10px] text-panel-muted-foreground">
            {open ? "▴" : "▾"}
          </span>
        )}
      </button>

      {/* The real per-subtopic result — progressive disclosure, plain text. */}
      {canToggle && open && (
        <p className="whitespace-pre-wrap pl-3 text-[12px] leading-relaxed text-panel-muted-foreground">
          {task.summary}
        </p>
      )}
    </li>
  )
}

export interface BatchResultListProps {
  /** The owning thread — keys the panel-only useTasks read. */
  threadId: string | null
  /** Optional: restrict to one parent phase's children (sub_run_id ⊂ this
   *  phase's batch). When omitted, renders all task rows for the thread. */
  parentRunId?: string
}

/**
 * Renders per-subtopic summary rows from the panel-only task store. Empty state:
 * no children ⇒ renders nothing (the consuming section omits it — never an empty
 * box). Consumed either as the shared summary-row component for a batch
 * PhaseCard, or mounted as a sibling panel block where a batch phase has children.
 */
export function BatchResultList({ threadId, parentRunId }: BatchResultListProps) {
  const { data: tasks } = useTasks(threadId)

  const rows = parentRunId
    ? tasks.filter((t) => t.parent_run_id === parentRunId)
    : tasks

  // Empty ⇒ render nothing (DATA-CONTRACT §6 — never an empty box).
  if (rows.length === 0) return null

  return (
    <ol aria-label="Batch sub-results" className="flex flex-col gap-1.5">
      {rows.map((task) => (
        <BatchResultRow key={task.sub_run_id} task={task} />
      ))}
    </ol>
  )
}

export default BatchResultList
