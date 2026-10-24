/**
 * Phase 292-02 Task 3 (D-06 · D-18 · UI-D-292-15..18) — the timeline's pure model.
 *
 * `today` is an ARGUMENT (the viewer's clock is read once, in the component), dates are parsed from
 * integer parts, day counts use UTC-noon arithmetic on both sides, and the month names come from a
 * fixed table — so the model is byte-identical on every machine, timezone and ICU build.
 */
import { describe, expect, it } from "vitest"
import { buildRail, calendarDayOf, deadlinePill, formatEventDate, parseEventDate, sortEvents, type RailRow } from "../timelineModel"
import { parseArtifactRecord, type TimelineEvent } from "../artifactSpec"
import { timelineAtlas } from "./fixtures"
import timelineModelSource from "../timelineModel.ts?raw"

const TODAY = { y: 2026, m: 10, d: 24 }

function events(): TimelineEvent[] {
  const r = parseArtifactRecord(timelineAtlas)
  if (!r.ok || !r.record.spec.timeline) throw new Error("fixture must parse")
  return r.record.spec.timeline.events
}

function ev(date: string, title = date, deadline = false): TimelineEvent {
  return { date, title, detail: null, category: null, deadline, source: null }
}

function shape(rows: RailRow[]): string[] {
  return rows.map((r) => (r.kind === "event" ? `E ${r.event.date}` : r.kind === "gap" ? `G ${r.months}` : `T ${r.placement}`))
}

describe("parseEventDate — from integer parts", () => {
  it("day and month precision; garbage is null", () => {
    expect(parseEventDate("2026-10-24")).toEqual({ y: 2026, m: 10, d: 24 })
    expect(parseEventDate("2026-03")).toEqual({ y: 2026, m: 3, d: null })
    for (const bad of ["2026-13-01", "2026-02-30", "24 Oct 2026", "", "2026", "2026-1-1"]) {
      expect(parseEventDate(bad), bad).toBeNull()
    }
  })

  it("the model source never builds a Date from a string and never reads the clock", () => {
    expect(timelineModelSource.length).toBeGreaterThan(200)
    expect(timelineModelSource).toContain("export function buildRail")
    expect(timelineModelSource).not.toMatch(/Date\.now\(/)
    expect(timelineModelSource).not.toMatch(/new Date\(\s*[^)\s]/)
    expect(timelineModelSource).not.toContain("Intl")
  })
})

describe("sortEvents — stable, (year, month, day ?? 0)", () => {
  it("a month-only event sorts before a day in the same month; equal dates keep spec order", () => {
    const sorted = sortEvents([ev("2026-03-14", "a"), ev("2026-03", "b"), ev("2026-03-14", "c"), ev("2025-12-01", "d")])
    expect(sorted.map((s) => s.event.title)).toEqual(["d", "b", "a", "c"])
    expect(sorted.map((s) => s.index)).toEqual([3, 1, 0, 2])
  })
})

describe("buildRail", () => {
  it("the 9 sketch events: ascending, 3 same-side gap rows, one Today row between past and upcoming", () => {
    const rows = buildRail(events(), TODAY)
    expect(shape(rows)).toEqual([
      "E 2023-03-14",
      "E 2023-04-01",
      "G 10",
      "E 2024-02-09",
      "G 9",
      "E 2024-11-20",
      "E 2025-01-15",
      "E 2025-04-01",
      "G 12",
      "E 2026-04-01",
      "T between",
      "E 2026-12-31",
      "E 2027-03-31",
    ])
    expect(rows.filter((r) => r.kind === "today")).toHaveLength(1)
  })

  it("gives the same rail whatever order the events arrive in", () => {
    const shuffled = [...events()].reverse()
    expect(shape(buildRail(shuffled, TODAY))).toEqual(shape(buildRail(events(), TODAY)))
  })

  it("never draws a gap across the Today row", () => {
    const rows = buildRail([ev("2025-01-10"), ev("2027-06-01")], TODAY)
    expect(shape(rows)).toEqual(["E 2025-01-10", "T between", "E 2027-06-01"])
  })

  it("all upcoming → Today first; all past → Today last", () => {
    expect(shape(buildRail([ev("2027-01-01"), ev("2027-02-01")], TODAY))).toEqual(["T top", "E 2027-01-01", "E 2027-02-01"])
    expect(shape(buildRail([ev("2024-01-01"), ev("2024-02-01")], TODAY))).toEqual(["E 2024-01-01", "E 2024-02-01", "T bottom"])
  })

  it("an event dated today, and a month event in the current month, are on the past side", () => {
    const rows = buildRail([ev("2026-10-24", "due", true), ev("2026-10", "month"), ev("2026-10-25", "tomorrow")], TODAY)
    expect(shape(rows)).toEqual(["E 2026-10", "E 2026-10-24", "T between", "E 2026-10-25"])
    const due = rows.find((r) => r.kind === "event" && r.event.title === "due")
    expect(due?.kind === "event" && due.past).toBe(true)
    expect(due?.kind === "event" && due.pill?.text).toBe("due today")
  })

  it("a single event gets the Today row above or below it and no gap", () => {
    expect(shape(buildRail([ev("2020-01-01")], TODAY))).toEqual(["E 2020-01-01", "T bottom"])
    expect(shape(buildRail([ev("2030-01-01")], TODAY))).toEqual(["T top", "E 2030-01-01"])
  })
})

describe("deadlinePill", () => {
  it("upcoming, day precision: `in N days` / `in 1 day`", () => {
    expect(deadlinePill(parseEventDate("2026-12-15")!, TODAY)).toEqual({ text: "in 52 days", tone: "amber" })
    expect(deadlinePill(parseEventDate("2026-10-25")!, TODAY)).toEqual({ text: "in 1 day", tone: "amber" })
    expect(deadlinePill(parseEventDate("2026-12-31")!, TODAY).text).toBe("in 68 days")
  })

  it("today → `due today`; past → `passed N days ago` / `passed 1 day ago` (muted)", () => {
    expect(deadlinePill(parseEventDate("2026-10-24")!, TODAY)).toEqual({ text: "due today", tone: "amber" })
    expect(deadlinePill(parseEventDate("2026-10-21")!, TODAY)).toEqual({ text: "passed 3 days ago", tone: "muted" })
    expect(deadlinePill(parseEventDate("2026-10-23")!, TODAY)).toEqual({ text: "passed 1 day ago", tone: "muted" })
  })

  it("month precision: `in 2 months` / `in 1 month` / `this month` / `passed 2 months ago`", () => {
    expect(deadlinePill(parseEventDate("2026-12")!, TODAY)).toEqual({ text: "in 2 months", tone: "amber" })
    expect(deadlinePill(parseEventDate("2026-11")!, TODAY)).toEqual({ text: "in 1 month", tone: "amber" })
    expect(deadlinePill(parseEventDate("2026-10")!, TODAY)).toEqual({ text: "this month", tone: "amber" })
    expect(deadlinePill(parseEventDate("2026-08")!, TODAY)).toEqual({ text: "passed 2 months ago", tone: "muted" })
    expect(deadlinePill(parseEventDate("2026-09")!, TODAY)).toEqual({ text: "passed 1 month ago", tone: "muted" })
  })

  it("DST-adjacent todays give whole-day counts (UTC-noon on both sides)", () => {
    // US spring-forward (8 Mar 2026) and EU fall-back (25 Oct 2026).
    expect(deadlinePill(parseEventDate("2026-03-09")!, { y: 2026, m: 3, d: 8 }).text).toBe("in 1 day")
    expect(deadlinePill(parseEventDate("2026-10-26")!, { y: 2026, m: 10, d: 25 }).text).toBe("in 1 day")
    expect(deadlinePill(parseEventDate("2026-04-01")!, { y: 2026, m: 3, d: 1 }).text).toBe("in 31 days")
  })

  it("counts of 1,000 and more are grouped en-US", () => {
    expect(deadlinePill(parseEventDate("2030-01-01")!, TODAY).text).toBe("in 1,165 days")
  })
})

describe("formatEventDate — the fixed month table", () => {
  it("`14 Mar 2023`, `Mar 2023`, `14 Sep 2023` (never `Sept`)", () => {
    expect(formatEventDate(parseEventDate("2023-03-14")!)).toBe("14 Mar 2023")
    expect(formatEventDate(parseEventDate("2023-03")!)).toBe("Mar 2023")
    expect(formatEventDate(parseEventDate("2023-09-14")!)).toBe("14 Sep 2023")
    expect(formatEventDate(parseEventDate("2026-10-04")!)).toBe("4 Oct 2026")
  })
})

describe("calendarDayOf — the one clock read, from LOCAL fields", () => {
  it("reads the local year, month and day of a Date it is handed", () => {
    const local = new Date(2026, 9, 24, 23, 30)
    expect(calendarDayOf(local)).toEqual({ y: 2026, m: 10, d: 24 })
  })
})
