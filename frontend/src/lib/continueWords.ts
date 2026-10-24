/**
 * Phase 292.1 (BUG-261024-03, D-12 / D-13) — the client mirror of the server's continue words.
 *
 * ⚠ A RENDERING HINT ONLY. The server decides (`backend/app/services/typed_continue.py`): when a
 * typed continue word resumes a paused run, `POST /threads/{id}/messages` answers
 * `{continued: true, …}` and no message row exists. The client uses this list to skip the
 * optimistic user bubble and assistant placeholder up front, so nothing flashes; if the server
 * disagrees, `sendMessage` follows the server's reply.
 *
 * Held in lockstep with the backend by `__tests__/continueWords.lockstep.test.ts`, which parses
 * the backend set literal and replays `backend/tests/unit/fixtures/continue_words_cases.json`.
 * Same normalisation as the backend: lower-case, collapse whitespace, trim, strip trailing
 * `.` `!` `?` `…`. No model call decides intent.
 */
import type { WorkflowLock } from "@/stores/streamsStore"

export const CONTINUE_WORDS: ReadonlySet<string> = new Set([
  "continue",
  "keep going",
  "go on",
  "carry on",
  "resume",
  "proceed",
])

export function isContinueWord(text: string): boolean {
  if (typeof text !== "string") return false
  const normalised = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?…]+$/u, "")
    .trim()
  return CONTINUE_WORDS.has(normalised)
}

/** True only for a Deep cap-pause with Continues left — a harness lock keeps its own Continue. */
export function shouldTryTypedContinue(lock: WorkflowLock | undefined, content: string): boolean {
  return (
    !!lock &&
    lock.capPaused &&
    lock.mode === "cap_paused" &&
    lock.continuesRemaining > 0 &&
    isContinueWord(content)
  )
}
