/**
 * Phase 300-01 (D-15, D-26; BUG-261027-03) — a schedule's last outcome, in words.
 *
 * `workflow_schedules.last_status` is a WIRE value: a run's terminal status (`completed`,
 * `failed`), the launcher's own `launch_failed`, the D-26 `waiting`, the poller's
 * `cadence_error`, or a whole sentence the server recorded when it refused a launch (the
 * template refusal, the foreign-folder refusal, the workflows kill switch, and the FIX-04
 * blank-input refusal). The schedule row used to print it raw (` · launch_failed`). This module
 * is the ONE place it becomes a sentence, and the raw token never reaches the screen:
 *
 *   - a known token reads its sentence (UI-SPEC §S6a);
 *   - a value containing a space is a server sentence: "Didn't run — {sentence}", with a closing
 *     full stop added when it has none;
 *   - any other token reads a neutral sentence, never itself, so a code a later backend adds
 *     cannot leak onto the row;
 *   - nothing recorded reads `null` (no outcome line at all).
 *
 * The words for `cancelled` and `cadence_error` are Claude's-discretion wording: UI-SPEC §S6a
 * lists neither, and both are real values (`cadence_error` is the poller's repair status; a
 * schedule's run can be stopped from the run page).
 *
 * ⛔ A ZERO-IMPORT LEAF (the `decisionsVocabulary.ts` rule), asserted over this file's own text
 * by its test: words, no React, no API, so any surface can read it without a dependency.
 */

export type ScheduleOutcomeTone = "muted" | "warning" | "error"

export interface ScheduleOutcome {
  text: string
  tone: ScheduleOutcomeTone
}

const KNOWN: Readonly<Record<string, ScheduleOutcome>> = {
  completed: { text: "Finished.", tone: "muted" },
  failed: { text: "Started, but the run failed.", tone: "error" },
  launch_failed: { text: "Didn't start. Press Run now to see why.", tone: "error" },
  // D-26: the run paused to wait for a person. 300-02's run-status trigger replaces this
  // value with the run's terminal status when the run ends.
  waiting: { text: "Waiting on you — answer in the run.", tone: "warning" },
  cancelled: { text: "Started, then stopped before it finished.", tone: "muted" },
  cadence_error: {
    text: "Didn't run — the schedule's timing couldn't be read. Add a new schedule, then delete this one.",
    tone: "warning",
  },
}

const UNDESCRIBED: ScheduleOutcome = {
  text: "Last run ended in a way this version doesn't describe.",
  tone: "muted",
}

/** The one sentence for a schedule's `last_status`, or `null` when nothing is recorded. */
export function scheduleOutcomeLine(
  lastStatus: string | null | undefined,
): ScheduleOutcome | null {
  if (typeof lastStatus !== "string") return null
  const value = lastStatus.trim()
  if (value === "") return null
  if (Object.prototype.hasOwnProperty.call(KNOWN, value)) return { ...KNOWN[value] }
  if (value.includes(" ")) {
    const sentence = /[.!?]$/.test(value) ? value : `${value}.`
    return { text: `Didn't run — ${sentence}`, tone: "warning" }
  }
  // A single token this version has no sentence for (`^[a-z][a-z_]*$`, or anything else that
  // is not a sentence): neutral words, never the token itself.
  return { ...UNDESCRIBED }
}
