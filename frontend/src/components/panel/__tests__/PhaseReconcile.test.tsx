/**
 * Phase 094 Plan 01 Task 3 — Wave 0 RED scaffold.  owner: Plan 03.
 *
 * Seeds INV-4 (the D-v2.5-03 reconcile-is-the-floor anti-drift rule, DATA-CONTRACT
 * §3(c)/§6 LOADING): on mount the `GET /threads/{id}/workflow` reconcile seeds
 * `current_phase_index` + `total_phases`; thereafter LIVE events mutate forward
 * but NEVER move the "Phase i / N" counter backward.
 *
 * INV-4 (flipped live by Plan 03 once usePhases + the timeline counter land):
 *   - seed reconcile `{current_phase_index:1, total_phases:3}` (the
 *     fxRunRunning reconcileSeed); replay REGRESSING live events (e.g. a stale
 *     `phase_started{phase_index:0}` arriving after); assert the rendered
 *     "Phase i / N" only ever advances forward — never regresses to "Phase 1 / 3".
 *   - the full N-phase skeleton renders from `total_phases` alone (3 rows: the
 *     started ones live, the rest `pending`/locked-ahead) BEFORE any further
 *     live event — the mount spinner-killer.
 */
import { describe, it } from "vitest"

// NOTE (Wave 0): usePhases + the reconcile-floor counter (Plan 03) do NOT exist
// yet. This file COLLECTS as `it.todo`; Plan 03 imports the timeline + the
// fxRunRunning reconcileSeed/live array from "@/test-fixtures/harness094" and
// flips these live.

describe("Phase 094 — reconcile floor / forward-only counter (INV-4)  [owner: Plan 03]", () => {
  it.todo(
    "seed reconcile {current_phase_index:1,total_phases:3}; a regressing live phase_started{phase_index:0} never moves Phase i/N backward",
  )
  it.todo("the full N-phase skeleton renders from total_phases alone (3 rows) before any further live event")
})
