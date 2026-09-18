/**
 * Phase 250 (`HONEST-03` / `HONEST-04`) — the ONE home for "what does this todo row honestly say
 * once the run is over?".
 *
 * ── TWO REPORTS, ONE ROW ─────────────────────────────────────────────────────────────
 *
 * `BUG-260902-01` — a run ended seven minutes ago and its todo still read `IN PROGRESS`, with the
 * spinner-dot still bouncing. *"A person reading the panel alone waits for something that will
 * never happen."*
 *
 * `BUG-260913-02` — the job finished perfectly and the row read
 * `Translate document (run ended — not completed)`. The surface adjudicated work it cannot see.
 *
 * ⭐ `SEED-105` planted this exact design on 2026-07-06, at a live operator UAT, and all three of
 * its `re_open_triggers` had fired by the time this shipped. Items 1-3 are built here: stop the
 * animation, dim the row, and say the honest thing in the STATUS slot instead of inside the task
 * text. Item 4 (delete the backend marker) is declined — it is the only record of *why* a
 * specific row stopped.
 *
 * ── WHY RUN STATE AND NOT THE MARKER ─────────────────────────────────────────────────
 *
 * The marker only exists on rows the reconciler reached. Measured 2026-09-15
 * (`250-MEASUREMENT.md`): of **78** open todos across **26** threads, **53 carry no marker** — 49
 * predate the reconciler and 4 were excluded by its gate. Deriving "not ticked" from the marker
 * would leave every one of those 53 rows still claiming `IN PROGRESS`.
 *
 * So the display status is derived from **whether a run is live on this thread**, and the marker
 * is used only to decide whether we may state the *reason*. That makes all 78 rows honest without
 * rewriting a single stored row — which is why this phase ships **no migration and no backfill**.
 *
 * ⛔ Nothing here flips `status`. Phase 138's D-01 honesty guardrail holds: an open item is never
 * silently auto-completed, and auto-completing on a clean run end was rejected in 2026-06-26 and
 * again at this phase's scoping.
 */

/**
 * The exact suffix `reconcile_open_todos_on_run_end` appends to a still-open todo's `content`.
 *
 * ⛔ SOURCE OF TRUTH: `backend/app/services/todos_service.py::_RUN_ENDED_MARKER`. The dash is an
 * EM-DASH (U+2014) and the LEADING SPACE is part of the constant.
 *
 * ⚠ This is a copy, and a copy that drifts is worse than no copy at all: the strip silently
 * becomes a no-op, the raw parenthetical reappears in the task text, AND the row is labelled
 * `NOT TICKED` at the same time — two contradictory statements on one line. It is therefore bound
 * to the backend source by a `?raw` lockstep fence
 * (`__tests__/todoRunHonesty.lockstep.test.ts`), the shipped idiom in this repo.
 */
export const RUN_ENDED_MARKER = " (run ended — not completed)"

/** The four values a todo row may DISPLAY. Only the first three exist in the database. */
export type TodoDisplayStatus = "pending" | "in_progress" | "completed" | "not_ticked"

/**
 * What the row says when the agent never closed an item and the run is over.
 *
 * ⭐ `NOT TICKED` is the operator's own vocabulary — their report reads *"the to dos is not up to
 * date and ticked as completed"*. It is a statement about the **agent's bookkeeping**, which is
 * what the system actually knows, and NOT about whether the person's job got done — which is
 * exactly what `(run ended — not completed)` got wrong.
 */
export const NOT_TICKED_LABEL = "Not ticked"

/**
 * The reason, stated only when the reconciler actually left its mark.
 *
 * ⛔ Without the marker we know the run is not live and the item is open; we do NOT know that a
 * run ever ended on this thread. Saying so anyway would be the same class of overclaim this phase
 * exists to remove.
 */
export const RUN_ENDED_TITLE = "The run ended before the agent marked this complete."

/** Strip the honesty marker out of a todo's content, reporting whether it was there. */
export function stripRunEndedMarker(content: string): {
  label: string
  wasMarked: boolean
} {
  const trimmedEnd = content.replace(/\s+$/, "")
  if (trimmedEnd.endsWith(RUN_ENDED_MARKER.trim())) {
    return {
      label: trimmedEnd.slice(0, trimmedEnd.length - RUN_ENDED_MARKER.trim().length).replace(/\s+$/, ""),
      wasMarked: true,
    }
  }
  return { label: content, wasMarked: false }
}

/**
 * The display status for one row.
 *
 * @param status      the stored status (`pending` | `in_progress` | `completed`)
 * @param isRunLive   is a run streaming (or loading) on the thread being viewed
 *
 * ⛔ A COMPLETED ITEM IS NEVER RESTATED. Only an open item can read `not_ticked`, and only while
 * nothing is running — the failure mode of this whole change is its own mirror image, a row
 * saying "not ticked" while the agent is still working.
 */
export function deriveTodoDisplayStatus(
  status: "pending" | "in_progress" | "completed",
  isRunLive: boolean,
): TodoDisplayStatus {
  if (status === "completed") return "completed"
  if (isRunLive) return status
  return "not_ticked"
}
