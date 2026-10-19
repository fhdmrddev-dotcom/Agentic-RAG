/**
 * Phase 288 (AUTH-01, D-09 / D-10 / D-11): the one sentence that says who a paused run is
 * waiting on.
 *
 * A LEAF. The server composes `sentence` from the durable unanswered-prompt row, the
 * owner's display name and the viewer's relationship to it, so the wording is identical
 * after a reload and never contains an id. This component renders that string verbatim as
 * a text child (never HTML) and builds nothing: no id formatting, no sentence logic, no
 * API import, no hook - so the page that mounts it gains none (G-5).
 *
 * The tone is the run band's own `waiting` token, not a new colour.
 */
import type { WorkflowRunWaitingOn } from "@/lib/api/workflows"

export function WaitingOnLine({ waitingOn }: { waitingOn?: WorkflowRunWaitingOn | null }) {
  if (!waitingOn?.sentence) return null
  return (
    <span
      className="text-xs font-medium text-[hsl(var(--warning))]"
      data-testid="run-waiting-on"
      data-window-passed={waitingOn.window_passed ? "true" : "false"}
    >
      {waitingOn.sentence}
    </span>
  )
}
