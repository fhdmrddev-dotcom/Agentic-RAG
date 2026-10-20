import { Play } from "lucide-react"
import { ChatLaunchForm } from "@/components/layout/ChatLaunchForm"
import { launchInputFields, type DefShape } from "@/components/workflows/soulData"
import type { Thread } from "@/types"
import { useStartWorkflowInThread } from "./useStartWorkflowInThread"

/**
 * Phase 287-03 (START-01 / A-02, A-03) - "Run a workflow" from inside an open thread.
 *
 * ── AN ACTION BUTTON, NOT A MODE ──
 *
 * Sketch 011 removed a workflow door from the composer because a mode pill holds state the
 * composer then has to honour. This is not that: it is a plain action button (no `aria-pressed`,
 * no composer state), every launch posts `workflow_definition_id`, and the server lock stays the
 * authority. It is mounted ONCE, by `ChatArea`, above the composer - `ChatLayout`, `MessageInput`
 * and `doRun` are untouched.
 *
 * ── ⛔ THE PERSON FILLS THE FORM. NOTHING ELSE MAY. ──
 *
 * Its own `ChatLaunchForm` instance collects the declared inputs; nothing is read from the
 * conversation (D-07). Props are exactly the thread and the lock.
 */
export function ThreadWorkflowPicker({ thread, locked, busy = false }: { thread: Thread; locked: boolean; busy?: boolean }) {
  const s = useStartWorkflowInThread(thread.id)
  const disabled = locked || busy || s.starting

  return (
    <div className="relative mx-4 mb-1 flex flex-wrap items-center gap-2" data-testid="thread-workflow-picker">
      <button
        type="button"
        data-testid="thread-workflow-trigger"
        disabled={disabled}
        onClick={() => (s.open ? s.closePicker() : s.openPicker())}
        className="flex min-h-6 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Play className="h-3 w-3" aria-hidden="true" />
        Run a workflow
      </button>
      {locked && (
        <span data-testid="thread-workflow-locked-reason" className="text-[11px] text-muted-foreground">
          A workflow is already running in this thread
        </span>
      )}

      {s.open && !disabled && (
        <div
          data-testid="thread-workflow-list"
          className="absolute bottom-full left-0 z-20 mb-2 max-h-72 w-[380px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {s.loading && <p className="px-3 py-2 text-xs text-muted-foreground">Loading your workflows...</p>}
          {s.error && (
            <p role="alert" className="px-3 py-2 text-xs text-destructive">
              {s.error}
            </p>
          )}
          {!s.loading && !s.error && s.workflows.length === 0 && (
            <p data-testid="thread-workflow-empty" className="px-3 py-2 text-xs text-muted-foreground">
              You have no published workflows yet. Build and publish one on the Workflows page.
            </p>
          )}
          {s.workflows.map((wf) => {
            const requirement = (wf.definition as Record<string, unknown> | null | undefined)?.business_requirement
            return (
              <button
                key={wf.id}
                type="button"
                data-testid={`thread-workflow-item-${wf.id}`}
                onClick={() => s.pick(wf)}
                className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-muted"
              >
                <span className="w-full truncate text-[13px] font-medium text-foreground">{wf.name}</span>
                {typeof requirement === "string" && requirement.trim() !== "" && (
                  <span className="line-clamp-1 w-full text-[11px] text-muted-foreground">{requirement}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {s.pending && (
        <ChatLaunchForm
          workflowName={s.pending.name}
          fields={launchInputFields(s.pending.definition as DefShape | undefined)}
          onConfirm={(values) => s.start(s.pending!, values)}
          onCancel={s.cancelForm}
        />
      )}
    </div>
  )
}
