/**
 * Phase 094 Plan 01 Task 3 — Wave 0 RED scaffold.  owner: Plan 03.
 *
 * Seeds INV-3b (the FRONTEND half of the RC-4 honesty contract — DATA-CONTRACT
 * §6 FAILED): the timeline keys failure off `run_failed.reason` / terminal
 * `gate_failed.error`, NEVER the terminal `done` sentinel (which is wrongly
 * `done` on a failed harness run).
 *
 * INV-3b (flipped live by Plan 03 once the failure-card render lands):
 *   - a `run_failed` fixture (`fxRunFailed` — ends with the RC-4 wrong terminal
 *     `done`) renders FAILED, not done: the failing phase row goes red /
 *     auto-expands / surfaces the reason inline — despite the `done` sentinel.
 *   - `run_failed{reason:""}` (`fxRunFailedReasonUnknown`) renders the explicit
 *     `reason_unknown` sentinel copy "Failure reason not captured by the backend"
 *     — NEVER an empty red card (DATA-CONTRACT §6 `reason_unknown` fallback).
 */
import { describe, it } from "vitest"

// NOTE (Wave 0): the failure-card render (PhaseTimeline / PhaseCard, Plan 03)
// does NOT exist yet. This file COLLECTS as `it.todo`; Plan 03 imports the
// component + fxRunFailed / fxRunFailedReasonUnknown from
// "@/test-fixtures/harness094" and flips these to live assertions.

describe("Phase 094 — failure honesty (INV-3b / RC-4 frontend)  [owner: Plan 03]", () => {
  it.todo("fxRunFailed renders FAILED (not done) despite the RC-4 terminal `done` sentinel")
  it.todo(
    'fxRunFailedReasonUnknown (run_failed{reason:""}) renders the reason_unknown sentinel "Failure reason not captured by the backend", never an empty red card',
  )
})
