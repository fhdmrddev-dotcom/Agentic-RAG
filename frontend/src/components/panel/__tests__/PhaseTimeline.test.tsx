/**
 * Phase 094 Plan 01 Task 3 — Wave 0 RED scaffold.  owner: Plan 03.
 *
 * Seeds INV-2 (the A11Y-03 axe gate) for the `PhaseTimeline` component Plan 03
 * builds. Mirrors `PendingAskCard.test.tsx`: import `axe` from "vitest-axe"
 * (`toHaveNoViolations` is registered globally in setupTests.ts) and feed the
 * component a controlled hook state via `vi.mock("@/providers/StreamsProvider")`
 * (mocking `usePhases`/`useTasks`) using the Task-2 DATA-CONTRACT §7 fixtures.
 *
 * INV-2 (flipped live by Plan 03 once PhaseTimeline lands):
 *   - render against each run-state fixture — fxRunRunning / fxRunFailed /
 *     fxRunDone / fxRunAskuserPaused / fxRunGatefailRetry — plus the 1-phase and
 *     N-phase shapes, asserting `expect(await axe(container)).toHaveNoViolations()`
 *     for every state (UI-SPEC §A11Y test gate).
 *   - announcer-fires-once: the sr-only `role="status"` announcer emits exactly
 *     one sentence per phase-transition edge (throttled), not per render.
 *   - aria-expanded-toggle: each PhaseCard's `<button aria-expanded>` flips on
 *     open/close (APG accordion).
 *   - aria-busy-flips: the running phase row sets `aria-busy="true"`, cleared on
 *     done/failed.
 */
import { describe, it } from "vitest"

// NOTE (Wave 0): `PhaseTimeline` / `PhaseCard` (Plan 03) do NOT exist yet, so
// importing them here would break collection. This file COLLECTS as `it.todo`
// placeholders; Plan 03 imports the components + `axe` from "vitest-axe" +
// the fxRun* fixtures from "@/test-fixtures/harness094" and flips these live.

describe("Phase 094 — PhaseTimeline a11y + render states (INV-2)  [owner: Plan 03]", () => {
  it.todo("axe has no violations: fxRunRunning")
  it.todo("axe has no violations: fxRunFailed")
  it.todo("axe has no violations: fxRunDone")
  it.todo("axe has no violations: fxRunAskuserPaused")
  it.todo("axe has no violations: fxRunGatefailRetry + 1-phase + N-phase")
  it.todo("sr-only role=status announcer fires once per phase-transition edge (throttled)")
  it.todo("each PhaseCard button aria-expanded flips on open/close (APG accordion)")
  it.todo("running phase row sets aria-busy=true, cleared on done/failed")
})
