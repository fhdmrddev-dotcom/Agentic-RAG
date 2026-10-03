/**
 * Phase 273-02 Task 1 — the chart's pure model (D-05 / SC#1 / UI-D-07).
 *
 * Every number the chart draws or the tooltip prints comes from here, so this is where SC#1's
 * "hover shows the values" and UI-D-07's "colour follows the entity" are pinned without jsdom
 * having to lay out an SVG.
 */
import { describe, expect, it } from "vitest"
import { parseArtifactRecord, type ArtifactRecord } from "../artifactSpec"
import {
  ariaLabel,
  chartData,
  decollide,
  formatTick,
  formatValue,
  isStacked,
  niceTicks,
  seriesColor,
  seriesNames,
  seriesSlots,
  srSummary,
  tooltipRows,
  visibleDomain,
} from "../chartModel"
import { chartBar, chartLine, chartAreaStacked, chartScatter, chartRedrawn, chartFromFilter, clone } from "./fixtures"

function rec(raw: unknown): ArtifactRecord {
  const r = parseArtifactRecord(raw)
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.reason}`)
  return r.record
}

const none = new Set<number>()

describe("series slots and colour (UI-D-07)", () => {
  it("returns spec.chart.slots verbatim and never re-indexes after hiding", () => {
    const r = rec(chartBar)
    expect(seriesSlots(r)).toEqual([0, 1, 2, 3])
    // A by-reference chart that inherited slot 2 for its only series keeps slot 2.
    const inherited: any = clone(chartFromFilter)
    inherited.spec.chart.slots = [2]
    expect(seriesSlots(rec(inherited))).toEqual([2])
    expect(seriesColor(2)).toBe("var(--chart-3)")
    expect(seriesNames(r)).toEqual(["Americas", "EMEA", "APAC", "LATAM"])
  })

  it("stacking: area is always stacked, bar only when asked with 2+ series", () => {
    expect(isStacked(rec(chartAreaStacked))).toBe(true)
    expect(isStacked(rec(chartBar))).toBe(false)
    expect(isStacked(rec(chartRedrawn))).toBe(true)
    expect(isStacked(rec(chartLine))).toBe(false)
  })

  it("chartData uses synthetic keys, so a column name with a dot is never read as a path", () => {
    const d = chartData(rec(chartBar))
    expect(d).toHaveLength(4)
    expect(d[2]).toEqual({ __i: 2, x: "Q3", s0: 1402, s1: 948, s2: 731, s3: 251 })
  })
})

describe("visibleDomain", () => {
  it("bar and area start at 0", () => {
    const [lo, hi] = visibleDomain(rec(chartBar), none)
    expect(lo).toBe(0)
    expect(hi).toBeGreaterThanOrEqual(1656)
  })

  it("recomputes from the visible series only", () => {
    const r = rec(chartBar)
    const all = visibleDomain(r, none)
    const onlyLatam = visibleDomain(r, new Set([0, 1, 2]))
    expect(onlyLatam[0]).toBe(0)
    expect(onlyLatam[1]).toBeLessThan(all[1])
    expect(onlyLatam[1]).toBeGreaterThanOrEqual(274)
  })

  it("a stacked domain covers the visible SUM", () => {
    const r = rec(chartAreaStacked)
    const [, hi] = visibleDomain(r, none)
    expect(hi).toBeGreaterThanOrEqual(191 + 131 + 44)
    const [, hiTwo] = visibleDomain(r, new Set([2]))
    expect(hiTwo).toBeGreaterThanOrEqual(191 + 131)
    expect(hiTwo).toBeLessThan(hi + 1)
  })

  it("line takes a nice auto domain that need not start at 0", () => {
    const [lo, hi] = visibleDomain(rec(chartLine), new Set([1]))
    expect(lo).toBeGreaterThan(0)
    expect(lo).toBeLessThanOrEqual(4120)
    expect(hi).toBeGreaterThanOrEqual(5290)
  })

  it("every series hidden still returns a finite domain", () => {
    const d = visibleDomain(rec(chartBar), new Set([0, 1, 2, 3]))
    expect(Number.isFinite(d[0]) && Number.isFinite(d[1])).toBe(true)
    expect(d[1]).toBeGreaterThan(d[0])
  })

  it("niceTicks spans the domain in about four steps", () => {
    const ticks = niceTicks([0, 2000])
    expect(ticks[0]).toBe(0)
    expect(ticks[ticks.length - 1]).toBe(2000)
    expect(ticks.length).toBeGreaterThanOrEqual(3)
    expect(ticks.length).toBeLessThanOrEqual(6)
  })
})

describe("tooltipRows", () => {
  it("lists the visible series at that x, high first", () => {
    const t = tooltipRows(rec(chartBar), 2, none)
    expect(t.header).toBe("Q3")
    expect(t.rows.map((r) => r.name)).toEqual(["Americas", "EMEA", "APAC", "LATAM"])
    expect(t.rows.map((r) => r.text)).toEqual(["1,402", "948", "731", "251"])
    expect(t.rows.map((r) => r.slot)).toEqual([0, 1, 2, 3])
    expect(t.total).toBeNull()
  })

  it("hiding a series drops it and keeps every survivor's slot", () => {
    const t = tooltipRows(rec(chartBar), 2, new Set([1]))
    expect(t.rows.map((r) => r.name)).toEqual(["Americas", "APAC", "LATAM"])
    expect(t.rows.map((r) => r.slot)).toEqual([0, 2, 3])
  })

  it("stacked forms append a Total equal to the visible sum", () => {
    const t = tooltipRows(rec(chartAreaStacked), 2, none)
    expect(t.rows.map((r) => r.name)).toEqual(["Email", "Chat", "Phone"])
    expect(t.total?.value).toBe(191 + 131 + 44)
    expect(t.total?.text).toBe("366")
    const two = tooltipRows(rec(chartAreaStacked), 2, new Set([0]))
    expect(two.total?.value).toBe(131 + 44)
    const stackedBar = tooltipRows(rec(chartRedrawn), 3, none)
    expect(stackedBar.total?.text).toBe("3,740")
  })

  it("a null value sorts last and prints a dash", () => {
    const r: any = clone(chartBar)
    r.spec.rows[2][2] = null
    const t = tooltipRows(rec(r), 2, none)
    expect(t.rows[t.rows.length - 1]).toMatchObject({ name: "EMEA", text: "—" })
  })
})

describe("formatting", () => {
  it("ticks use compact notation; values group thousands", () => {
    expect(formatTick(1500)).toBe("1.5K")
    expect(formatTick(2_000_000)).toBe("2M")
    expect(formatTick(250)).toBe("250")
    expect(formatValue(1656)).toBe("1,656")
    expect(formatValue(1234567.891)).toBe("1,234,567.89")
    expect(formatValue(null)).toBe("—")
  })
})

describe("accessible names", () => {
  it("ariaLabel = {chip}: {title}, {N} rows", () => {
    expect(ariaLabel(rec(chartBar))).toBe("Bar chart: FY25 revenue by region · $K, 4 rows")
    expect(ariaLabel(rec(chartAreaStacked))).toBe("Stacked area chart: Support tickets by channel, 4 rows")
  })

  it("srSummary names the series and the x range", () => {
    expect(srSummary(rec(chartBar))).toBe("Series: Americas, EMEA, APAC, LATAM. Q1 to Q4.")
    expect(srSummary(rec(chartScatter))).toBe("Series: Mid-market, Enterprise. cycle days 21 to 88.")
  })
})

describe("decollide (direct labels ≥ 16px apart)", () => {
  it("leaves well-separated labels alone", () => {
    expect(decollide([20, 80, 140], 16, 0, 200)).toEqual([20, 80, 140])
  })

  it("pushes colliding labels apart, preserving order, inside the bounds", () => {
    const out = decollide([100, 104, 108], 16, 0, 200)
    for (let i = 1; i < out.length; i++) expect(out[i] - out[i - 1]).toBeGreaterThanOrEqual(16)
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...out)).toBeLessThanOrEqual(200)
  })

  it("keeps the input index order when inputs arrive unsorted", () => {
    const out = decollide([150, 10, 148], 16, 0, 200)
    expect(out[1]).toBe(10)
    expect(Math.abs(out[0] - out[2])).toBeGreaterThanOrEqual(16)
  })
})
