/**
 * Phase 276-06 (D-24 / D-27) — the Iris avatar's state, derived from the message alone.
 *
 * The ONE home of the precedence order. Source of truth:
 * `.planning/sketches/276-iris-avatar/README.md` §"State → motion":
 *
 *   error > cancelled > waiting > (idle when not streaming) > tool > thinking > streaming
 *
 * CORRECTED (276-REVIEW B-WR-01): waiting splits in two. A cap pause (last row, not exhausted)
 * is waiting on any row; an ask_user / undecided approval is waiting only while STREAMING:
 *
 *   error > cancelled > cap-pause waiting > (idle when not streaming) > ask/approval waiting
 *     > tool > thinking > streaming
 *
 * ⛔ WAITING BEATS TOOL. `ask_user` is itself a tool whose status is `running` while it waits,
 * so a tool-first order would show a paused question as "working" — a false claim about who
 * has the next move (`pending-question.md` D2: waiting is amber and still).
 *
 * ⛔ There is no `"stopped"` arm: `Message.runStatus` has five values and none is "stopped"
 * (the sketch's pseudo-code wrote one; tsc rejects it). Cancelled is the only dim state.
 *
 * Pure: no imports beyond types, no store reads. MessageItem is `React.memo`'d and not
 * virtualised, so this runs once per row per render and must stay a plain expression.
 */
import type { Message, ToolCall } from "@/types"

export type IrisState = "idle" | "thinking" | "tool" | "streaming" | "waiting" | "error" | "cancelled"

/** A paused run is one with an ask_user tool still awaiting the user (D2). */
export function hasPendingAsk(toolCalls: ToolCall[] | undefined): boolean {
  return (
    toolCalls?.some(
      (tc) => tc.name === "ask_user" && (tc.status === "running" || tc.status === "interrupted"),
    ) ?? false
  )
}

/**
 * @param capPaused the thread's cap-pause, passed ONLY for the last assistant row (the turn the
 *   Continue card renders on) and ONLY while a Continue is still possible (not exhausted) —
 *   earlier rows of a paused thread, and an exhausted pause, stay idle.
 *
 * 276-REVIEW B-WR-01: ~~waiting was checked before the not-streaming → idle arm~~, so a FINISHED
 * row still carrying a pause signal sat amber for as long as it was on screen — and those
 * signals are not reliable after the run ends (Stop marks every running tool `interrupted`,
 * including an `ask_user`; an approval's `decision` is not always written back). The ask and
 * approval arms now count only on a LIVE (streaming) row; the cap pause is the one out-of-band
 * waiting signal a terminal row may carry.
 */
export function irisStateFor(m: Message, capPaused?: boolean): IrisState {
  if (m.runStatus === "failed" || m.runStatus === "timed_out") return "error"
  if (m.runStatus === "cancelled") return "cancelled"
  if (capPaused) return "waiting"
  if (m.runStatus !== "streaming") return "idle"
  if (hasPendingAsk(m.tool_calls) || (m.toolApproval && !m.toolApproval.decision)) return "waiting"
  if (m.tool_calls?.some((t) => t.status === "running" || t.status === "preparing")) return "tool"
  if (!m.content || m.isPlanning) return "thinking"
  return "streaming"
}
