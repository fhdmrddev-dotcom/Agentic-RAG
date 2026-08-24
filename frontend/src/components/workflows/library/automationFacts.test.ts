/**
 * Phase 204.1 — the automation resolver's contract.
 *
 * ⚠ THE POINT OF THIS SUITE IS THE THREE ABSENCES, not the happy path. `runFacts.ts` shipped a
 * defect exactly here (CR-01: a ROW-level claim built from a CALLER-level fact, so the library
 * printed "Never run" about workflows that had really run), and `DecisionsList` shipped the same
 * shape again (D-20). Both were "two different facts folded into one branch".
 */
import { describe, expect, it } from "vitest"

import { automationFacts } from "./automationFacts"
import { AUTOMATION_CADENCE, AUTOMATION_RUNS_ITSELF } from "./libraryVocabulary"

const AT = "2026-09-01T06:00:00Z"

describe("automationFacts", () => {
  it("says nothing when the feed never mentioned schedules (undefined)", () => {
    // An older client, or a `response_model` that dropped the key. We know NOTHING.
    expect(automationFacts({})).toEqual({ phrase: null, more: null })
  })

  it("says nothing when the feed answered that none is active (null)", () => {
    // A DIFFERENT fact from the one above — the answer arrived and it was "none".
    expect(automationFacts({ nextScheduleAt: null })).toEqual({ phrase: null, more: null })
  })

  it("says nothing for a PAUSED schedule, because the lateral filters is_active", () => {
    // The modal's Pause exists to stop a schedule without deleting it. A card still claiming
    // "runs on its own" would contradict the button its author just pressed. The paused row
    // never reaches this function — it arrives as the `null` above — and this test pins the
    // consequence so a future widening of the SQL predicate breaks HERE rather than in the UI.
    expect(automationFacts({ nextScheduleAt: null, nextScheduleCount: 0 }).phrase).toBeNull()
  })

  it("names the cadence when the cron is one of the offered presets", () => {
    const cron = "0 8 * * 1"
    expect(AUTOMATION_CADENCE[cron]).toBeTruthy() // the preset really is offered
    expect(automationFacts({ nextScheduleAt: AT, nextScheduleCron: cron }).phrase).toBe(
      AUTOMATION_CADENCE[cron],
    )
  })

  it("falls back to the generic sentence for a CUSTOM cron rather than printing it", () => {
    // A stepped expression is not parseable at a glance on an 11px line.
    const custom = "17 */3 * * 2"
    expect(AUTOMATION_CADENCE[custom]).toBeUndefined()
    const f = automationFacts({ nextScheduleAt: AT, nextScheduleCron: custom })
    expect(f.phrase).toBe(AUTOMATION_RUNS_ITSELF)
    expect(f.phrase).not.toContain("*") // the cron itself never reaches the card
  })

  it("falls back to the generic sentence for an INTERVAL schedule", () => {
    const f = automationFacts({ nextScheduleAt: AT, nextScheduleIntervalSeconds: 900 })
    expect(f.phrase).toBe(AUTOMATION_RUNS_ITSELF)
    expect(f.phrase).not.toContain("900")
  })

  it("stays silent about a single schedule and counts only the EXTRA ones", () => {
    expect(automationFacts({ nextScheduleAt: AT, nextScheduleCount: 1 }).more).toBeNull()
    expect(automationFacts({ nextScheduleAt: AT, nextScheduleCount: 3 }).more).toBe("+2 more")
  })

  it("does not resolve an INHERITED key through the cadence table", () => {
    // ⚠ The WR-04 sink, pinned. `AUTOMATION_CADENCE["constructor"] ?? fallback` returns a
    // FUNCTION and the fallback provably never fires — React then refuses the child and the
    // label renders as NOTHING AT ALL (`200-04`, the eighth live occurrence in this repo).
    const f = automationFacts({ nextScheduleAt: AT, nextScheduleCron: "constructor" })
    expect(typeof f.phrase).toBe("string")
    expect(f.phrase).toBe(AUTOMATION_RUNS_ITSELF)
  })

  it("spells no string of its own — every word comes from the vocabulary", () => {
    const all = Object.values(AUTOMATION_CADENCE).concat(AUTOMATION_RUNS_ITSELF)
    for (const cron of Object.keys(AUTOMATION_CADENCE)) {
      const p = automationFacts({ nextScheduleAt: AT, nextScheduleCron: cron }).phrase
      expect(all).toContain(p)
    }
  })
})
