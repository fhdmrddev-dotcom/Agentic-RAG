/**
 * Phase 194.1 Plan 06 (RUN-01 / R4 / D-13) — how far a run actually got, derived
 * from the WIRE's `workflow_phases` rows.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS FOR
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 194 **D-13**: a stop must NOT read as though nothing survived. A stopped
 * run's `completed` phases stay `completed` in the database, and collapsing the
 * reading to a bare `cancelled` "discards evidence the database still holds".
 * So the stopped receipt carries the step count IN THE SAME SENTENCE as the word.
 * This is that count.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ THE TOTALITY IS STRUCTURAL, NOT ENUMERATED — AND THAT IS THE POINT
 * ─────────────────────────────────────────────────────────────────────────────
 * Since migration 119 the `workflow_phases.status` vocabulary has SEVEN literals:
 * `pending`, `active`, `completed`, `failed`, `skipped`, `recorded_not_sent`,
 * `cancelled`. `194.1-RESEARCH.md` names a five-literal derivation as a pitfall by
 * name, because two of the seven were added in Phase 189 and Phase 194 and a
 * `switch` written before either would still typecheck, still run, and still be
 * quietly wrong about a real run.
 *
 * So there is NO `switch` here and there is no literal set here. The numerator is
 * `filter(status === "completed")` — which is TOTAL over every string that exists
 * or will ever exist, by construction rather than by enumeration. An eighth literal
 * added tomorrow counts as not-completed, which is the correct answer for every
 * plausible eighth literal and is arrived at without anyone editing this file.
 *
 * `lib/__tests__/runStepCount.test.ts` proves that property by PARSING migration
 * 119's `ARRAY[…]` out of the `.sql` file and driving the derivation once per
 * literal it finds — never against a hand-typed set. A hand-typed set tests the
 * typing, which is precisely the drift `backend/app/db/workflow_runs.py:87-95`'s
 * docstring already suffered.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ THIS IS THE **WIRE** VOCABULARY, NEVER THE CLIENT ONE
 * ─────────────────────────────────────────────────────────────────────────────
 * The input is `ThreadWorkflowState["phases"]` exactly as
 * `GET /threads/{id}/workflow` sends it: `status` is DB-NATIVE. It is NOT the
 * client `Phase["status"]` union, where the same state is spelled `done`
 * (`lib/phaseState.ts:59-72` maps `completed → done`). Passing a client `Phase[]`
 * here typechecks under a structural `{ status: string }` and then silently reports
 * `0 of N`, which is exactly the "nothing survived" lie D-13 forbids.
 *
 * The live arm of the run line therefore does NOT call this — it uses the shipped
 * `harnessBannerProgress` (`lib/toolMeta.ts:102`) over the client vocabulary. Two
 * vocabularies, two SHIPPED derivations, zero hand-rolled mappings.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ `0 of 0` IS REFUSED, NOT PRINTED
 * ─────────────────────────────────────────────────────────────────────────────
 * A zero denominator means the wire carried no phase rows — a Deep thread, a run
 * that never wrote one, or a frame this client could not read. `null` is returned
 * and the caller OMITS the segment entirely. "0 of 0 steps" claims a measurement
 * that was never taken, which is the same class of dishonesty as
 * `WorkflowRunPage.tsx:751-757`'s refusal to render a "0s" elapsed.
 *
 * Pure logic — no React, no hooks, no JSX, and ZERO imports beyond a type-only one.
 */
import type { WorkflowPhaseState } from "@/lib/api"

/** `{ done, total }` — both are counts of PHASE ROWS, never percentages. */
export interface RunStepCount {
  done: number
  total: number
}

/**
 * Count how many of a run's phases completed.
 *
 * @param phases the wire's `workflow_phases` rows (DB-native `status`), or
 *               `null`/`undefined` when the frame carried none.
 * @returns `{ done, total }`, or `null` when there is nothing honest to say.
 */
export function stepsFrom(
  phases: readonly WorkflowPhaseState[] | null | undefined,
): RunStepCount | null {
  if (!phases || phases.length === 0) return null
  const done = phases.filter((p) => p.status === "completed").length
  return { done, total: phases.length }
}
