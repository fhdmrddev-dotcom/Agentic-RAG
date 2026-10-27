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
import {
  AUTOMATION_CADENCE,
  AUTOMATION_NEXT,
  AUTOMATION_NEXT_PAST,
  AUTOMATION_RUNS_ITSELF,
} from "./libraryVocabulary"

const AT = "2026-09-01T06:00:00Z"

describe("automationFacts", () => {
  it("says nothing when the feed never mentioned schedules (undefined)", () => {
    // An older client, or a `response_model` that dropped the key. We know NOTHING.
    // 293-03: the silent arm also carries no next-run fragment.
    expect(automationFacts({})).toEqual({ phrase: null, more: null, next: null })
  })

  it("says nothing when the feed answered that none is active (null)", () => {
    // A DIFFERENT fact from the one above — the answer arrived and it was "none".
    expect(automationFacts({ nextScheduleAt: null })).toEqual({ phrase: null, more: null, next: null })
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

describe("where the automation fact renders (204.1 — the operator move)", () => {
  /**
   * ⚠ THIS SUITE PINS A PLACEMENT, WHICH IS UNUSUAL AND IS THE POINT. The fact first shipped
   * as a segment on the 11px uppercase identity line. That honoured the line's no-colour,
   * no-glyph rule exactly — and the operator scanned the card and asked where it was. A fact
   * that satisfies the style guide and fails the glance has not indicated anything.
   *
   * So the pin is not "a string exists somewhere on the card"; it is that the string is on the
   * STATUS line (`Worked 4 days ago | Ready to run | …`), which is the line a reader already
   * uses to answer *does this one work*. A future tidy-up that moves it back down to the meta
   * line would pass every existing assertion and silently re-create the invisible version.
   */
  it("is pinned to the status line by test id, not merely present on the card", async () => {
    const src = await import("./WorkflowCard?raw").then((m) => m.default as string)

    const statusIdx = src.indexOf('data-testid="row-answer-dot"')
    const identityIdx = src.indexOf('data-testid="row-identity"')
    const automationIdx = src.indexOf('data-testid="row-automation"')

    expect(statusIdx).toBeGreaterThan(-1)
    expect(identityIdx).toBeGreaterThan(-1)
    expect(automationIdx).toBeGreaterThan(-1)

    // The automation atom sits between the status-line dot and the identity line — i.e. it is
    // a child of the status row, not of the meta row beneath it.
    expect(automationIdx).toBeGreaterThan(statusIdx)
    expect(automationIdx).toBeLessThan(identityIdx)
  })

  it("does not put the automation words back into identityParts", async () => {
    const src = await import("./WorkflowCard?raw").then((m) => m.default as string)
    const arrStart = src.indexOf("const identityParts: string[] = [")
    const arrEnd = src.indexOf("\n  ]", arrStart)
    const arr = src.slice(arrStart, arrEnd)
    expect(arr).not.toContain("automation.phrase")
    expect(arr).not.toContain("automation.more")
  })
})

// ── 293-03 (START-04 / D-25) — the next run time, formatted from the SERVER's instant ──────
//
// Instants are built from LOCAL wall-clock parts so the expected words hold in any time zone
// the suite runs in: the browser only formats, it never computes when a schedule fires.
describe("automationFacts — the next run time (293-03)", () => {
  const local = (y: number, m: number, d: number, h: number, min: number) =>
    new Date(y, m - 1, d, h, min).toISOString()
  const NOW = new Date(2026, 9, 25, 12, 0).getTime() // Sun 25 Oct 2026, 12:00 local

  it("a future instant reads `next Mon 26 Oct, 09:00` beside the cadence", () => {
    const f = automationFacts(
      { nextScheduleAt: local(2026, 10, 26, 9, 0), nextScheduleCron: "0 8 * * 1" },
      NOW,
    )
    expect(f.phrase).toBe(AUTOMATION_CADENCE["0 8 * * 1"])
    expect(f.next).toBe(`${AUTOMATION_NEXT} Mon 26 Oct, 09:00`)
    expect(f.next).toBe("next Mon 26 Oct, 09:00")
  })

  it("adds the year when it differs from now's", () => {
    const f = automationFacts({ nextScheduleAt: local(2027, 1, 4, 9, 0) }, NOW)
    expect(f.next).toBe("next Mon 4 Jan 2027, 09:00")
  })

  it("a past instant reads `next was due …`, never hidden and never recomputed", () => {
    const f = automationFacts({ nextScheduleAt: local(2026, 10, 19, 9, 0) }, NOW)
    expect(f.next).toBe(`${AUTOMATION_NEXT_PAST} Mon 19 Oct, 09:00`)
    expect(f.phrase).toBe(AUTOMATION_RUNS_ITSELF)
  })

  it("24-hour time: an evening instant reads 18:30, never 6:30 pm", () => {
    const f = automationFacts({ nextScheduleAt: local(2026, 10, 27, 18, 30) }, NOW)
    expect(f.next).toBe("next Tue 27 Oct, 18:30")
  })

  it("silent rows stay silent: no schedule, a paused one, a feed that never sent it", () => {
    expect(automationFacts({}, NOW).next).toBeNull()
    expect(automationFacts({ nextScheduleAt: null }, NOW).next).toBeNull()
    expect(automationFacts({ nextScheduleAt: null, nextScheduleCount: 0 }, NOW).next).toBeNull()
  })

  it("an unreadable instant keeps the cadence and adds no time", () => {
    const f = automationFacts({ nextScheduleAt: "not a date" }, NOW)
    expect(f.phrase).toBe(AUTOMATION_RUNS_ITSELF)
    expect(f.next).toBeNull()
  })

  it("the card renders ONE next span after the cadence and before +N more, with no state", async () => {
    const src = await import("./WorkflowCard?raw").then((m) => m.default as string)
    const automationIdx = src.indexOf('data-testid="row-automation"')
    const nextIdx = src.indexOf('data-testid="row-automation-next"')
    const moreIdx = src.indexOf('data-testid="row-automation-more"')
    expect(src.split('data-testid="row-automation-next"').length - 1).toBe(1)
    expect(nextIdx).toBeGreaterThan(automationIdx)
    expect(nextIdx).toBeLessThan(moreIdx)
    expect(src.slice(nextIdx - 400, nextIdx)).toContain("automation.next !== null")
    // ⚠ NO `title`: the library subtree's F1 fence (D-14 — touch has no hover) forbids it, so
    // the fragment carries the whole fact in visible text (the year appears when it differs).
    expect(src.split("useState(").length - 1).toBe(0)
  })

  it("the leaf computes no schedule: it reads the server's instant and nothing else", async () => {
    const src = await import("./automationFacts?raw").then((m) => m.default as string)
    expect(src.split("new Date()").length - 1).toBe(0)
    expect(src).not.toMatch(/setDate|setHours|getDay\(/)
  })
})
