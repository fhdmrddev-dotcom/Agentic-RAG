/**
 * Phase 273-02 Task 1 — the frontend guard (D-12 / SC#2 / I-1).
 *
 * `parseArtifactRecord(unknown)` never throws and maps every failure to ONE reason from the closed
 * notice catalogue; `noticeText` turns that reason into a UI-SPEC sentence that never prints the
 * spec (no JSON, no spec key, no validation path, no exception message).
 */
import { describe, expect, it } from "vitest"
import { parseArtifactRecord, ARTIFACT_COMPONENT_NAMES, type NoticeReason } from "../artifactSpec"
import { noticeText, NOTICE_TITLE, NOTICE_FOOTNOTE, kindChipLabel, kindChipLabelOf } from "../artifactCopy"
import {
  ALL_VALID,
  chartBar,
  chartLine,
  chartAreaStacked,
  chartScatter,
  chartRedrawn,
  table16,
  metricWithDelta,
  missing,
  clone,
} from "./fixtures"

type Rec = Record<string, any>

function fail(raw: unknown) {
  const r = parseArtifactRecord(raw)
  if (r.ok) throw new Error("expected a failed parse")
  return r
}

const CATALOGUE: NoticeReason[] = [
  "unknown-chart-kind",
  "unknown-component",
  "missing-column",
  "invalid-settings",
  "too-many-rows",
  "too-many-series",
  "no-rows",
  "data-missing",
  "chart-unavailable",
  "render-failed",
]

/**
 * Spec-leak tokens. ⚠ The plain English word "rows" is a legitimate part of two catalogue
 * sentences (`too-many-rows`, `no-rows`), so the KEY forms are what is banned: `"rows"`, `rows:`.
 */
const LEAK_TOKENS = ['{"', '"rows"', "rows:", "component", "columns", "spec", "[", "Error"]

function noticePageText(reason: NoticeReason, ctx?: Parameters<typeof noticeText>[1]) {
  return [NOTICE_TITLE, noticeText(reason, ctx), NOTICE_FOOTNOTE].join(" ")
}

function assertNoLeak(text: string) {
  for (const t of LEAK_TOKENS) expect(text, `leaked ${t}`).not.toContain(t)
}

describe("parseArtifactRecord — valid records", () => {
  it("accepts every fixture", () => {
    for (const rec of ALL_VALID) {
      const r = parseArtifactRecord(rec)
      expect(r.ok, rec.label).toBe(true)
      if (r.ok) {
        expect(r.record.id).toBe(rec.id)
        expect(r.record.component).toBe(rec.component)
      }
    }
  })

  it("the closed component list is exactly chart, table, metric", () => {
    expect([...ARTIFACT_COMPONENT_NAMES]).toEqual(["chart", "table", "metric"])
  })
})

describe("parseArtifactRecord — the closed failure catalogue", () => {
  it("non-object, null and array → invalid-settings", () => {
    for (const raw of [null, undefined, 42, "chart", true, [], [chartBar]]) {
      expect(fail(raw).reason).toBe("invalid-settings")
    }
  })

  it("the reload placeholder → data-missing, carrying its id", () => {
    const r = fail(missing)
    expect(r.reason).toBe("data-missing")
    expect(r.id).toBe(missing.id)
  })

  it("an unknown component → unknown-component", () => {
    const rec: Rec = clone(chartBar)
    rec.component = "gauge_widget"
    expect(fail(rec).reason).toBe("unknown-component")
  })

  it("__proto__ and constructor never resolve to a component", () => {
    for (const key of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      const rec: Rec = clone(chartBar)
      rec.component = key
      expect(fail(rec).reason, key).toBe("unknown-component")
    }
  })

  it("pie → unknown-chart-kind with the alias label", () => {
    const rec: Rec = clone(chartBar)
    rec.spec.chart.kind = "pie"
    const r = fail(rec)
    expect(r.reason).toBe("unknown-chart-kind")
    expect(r.ctx?.alias).toBe("pie chart")
    expect(noticeText(r.reason, r.ctx)).toBe(
      "it asked for a pie chart, which isn't one of the chart kinds we can draw.",
    )
  })

  it("sunburst → unknown-chart-kind with NO alias, and the word never reaches the page", () => {
    const rec: Rec = clone(chartBar)
    rec.spec.chart.kind = "sunburst"
    const r = fail(rec)
    expect(r.reason).toBe("unknown-chart-kind")
    expect(r.ctx?.alias).toBeUndefined()
    const text = noticePageText(r.reason, r.ctx)
    expect(text).not.toContain("sunburst")
    expect(noticeText(r.reason, r.ctx)).toBe("it asked for a chart kind we can't draw.")
  })

  it("chart.y naming an absent column → missing-column with that column, truncated at 40", () => {
    const rec: Rec = clone(chartBar)
    rec.spec.chart.y = ["Americas", "Middle East & Africa (excluding sanctioned territories)"]
    rec.spec.chart.slots = [0, 1]
    const r = fail(rec)
    expect(r.reason).toBe("missing-column")
    expect(r.ctx?.column).toHaveLength(40)
    expect(r.ctx?.column?.endsWith("…")).toBe(true)
    expect(noticeText(r.reason, r.ctx)).toContain("its saved data is missing a column the chart needs (Middle East")
  })

  it("an absent x column → missing-column", () => {
    const rec: Rec = clone(chartLine)
    rec.spec.chart.x = "week"
    const r = fail(rec)
    expect(r.reason).toBe("missing-column")
    expect(r.ctx?.column).toBe("week")
  })

  it("501 rows → too-many-rows; 0 rows → no-rows", () => {
    const big: Rec = clone(table16)
    big.spec.rows = Array.from({ length: 501 }, (_, i) => ["Q1", `region ${i}`, i])
    expect(fail(big).reason).toBe("too-many-rows")
    const none: Rec = clone(table16)
    none.spec.rows = []
    expect(fail(none).reason).toBe("no-rows")
  })

  it("5 bar series → too-many-series (max 4); 4 scatter series → too-many-series (max 3)", () => {
    const bar: Rec = clone(chartBar)
    bar.spec.columns.push({ name: "ANZ", type: "number", unit: "$K" })
    bar.spec.rows = bar.spec.rows.map((r: unknown[]) => [...r, 120])
    bar.spec.chart.y = ["Americas", "EMEA", "APAC", "LATAM", "ANZ"]
    bar.spec.chart.slots = [0, 1, 2, 3, 0]
    const rb = fail(bar)
    expect(rb.reason).toBe("too-many-series")
    expect(rb.ctx?.max).toBe(4)
    expect(noticeText(rb.reason, rb.ctx)).toBe("it has more series than a chart can show (max 4).")

    const sc: Rec = clone(chartScatter)
    sc.spec.columns.push({ name: "SMB", type: "number", unit: "$K" }, { name: "Public", type: "number", unit: "$K" })
    sc.spec.rows = sc.spec.rows.map((r: unknown[]) => [...r, 12, 30])
    sc.spec.chart.y = ["Mid-market", "Enterprise", "SMB", "Public"]
    sc.spec.chart.slots = [0, 1, 2, 3]
    const rs = fail(sc)
    expect(rs.reason).toBe("too-many-series")
    expect(rs.ctx?.max).toBe(3)
  })

  it("a ragged row → invalid-settings", () => {
    const rec: Rec = clone(table16)
    rec.spec.rows[3] = ["Q1", "APAC"]
    expect(fail(rec).reason).toBe("invalid-settings")
  })

  it("a metric with 2 rows → invalid-settings", () => {
    const rec: Rec = clone(metricWithDelta)
    rec.spec.rows.push([1700, 1656])
    expect(fail(rec).reason).toBe("invalid-settings")
  })

  it("slots outside 0..3, duplicated, or the wrong length → invalid-settings", () => {
    for (const slots of [[0, 1, 2, 4], [0, 1, 1, 2], [-1, 0, 1, 2], [0, 1, 2], [0, 1.5, 2, 3]]) {
      const rec: Rec = clone(chartBar)
      rec.spec.chart.slots = slots
      expect(fail(rec).reason, JSON.stringify(slots)).toBe("invalid-settings")
    }
  })

  it("a missing caption → invalid-settings", () => {
    const rec: Rec = clone(chartBar)
    delete rec.caption
    expect(fail(rec).reason).toBe("invalid-settings")
  })

  it("a number column holding a string → invalid-settings", () => {
    const rec: Rec = clone(chartBar)
    rec.spec.rows[1][2] = "905"
    expect(fail(rec).reason).toBe("invalid-settings")
  })

  it("the wrong encoding for the component → invalid-settings", () => {
    const tbl: Rec = clone(table16)
    tbl.spec.chart = clone(chartBar.spec.chart)
    expect(fail(tbl).reason).toBe("invalid-settings")
    const chart: Rec = clone(chartBar)
    chart.spec.chart = null
    expect(fail(chart).reason).toBe("invalid-settings")
  })

  it("an unknown lineage operation → invalid-settings", () => {
    const rec: Rec = clone(chartRedrawn)
    rec.caption.lineage.operations = [{ op: "aggregate_sum", column: "revenue" }]
    expect(fail(rec).reason).toBe("invalid-settings")
  })

  it("a label that does not match its component, or a bad id → invalid-settings", () => {
    const a: Rec = clone(chartBar)
    a.label = "table 1"
    expect(fail(a).reason).toBe("invalid-settings")
    const b: Rec = clone(chartBar)
    b.id = "<script>"
    expect(fail(b).reason).toBe("invalid-settings")
  })

  it("an unsupported spec_version → invalid-settings", () => {
    const rec: Rec = clone(chartBar)
    rec.spec_version = 2
    expect(fail(rec).reason).toBe("invalid-settings")
  })

  it("the noun follows the component", () => {
    const rec: Rec = clone(metricWithDelta)
    rec.spec.metric.value_column = "Q4 bookings"
    const r = fail(rec)
    expect(r.reason).toBe("missing-column")
    expect(noticeText(r.reason, r.ctx)).toBe(
      "its saved data is missing a column the metric needs (Q4 bookings). Ask the agent to draw it again.",
    )
  })
})

describe("noticeText — the catalogue sentences never print the spec", () => {
  it("every code returns its UI-SPEC sentence", () => {
    expect(noticeText("unknown-component")).toBe("it asked for something other than a chart, table or metric.")
    expect(noticeText("invalid-settings", { noun: "table" })).toBe(
      "its saved settings don't match what a table needs. Ask the agent to draw it again.",
    )
    expect(noticeText("too-many-rows")).toBe("it holds more rows than an artifact can show (max 500).")
    expect(noticeText("no-rows")).toBe("it has no rows to show.")
    expect(noticeText("data-missing")).toBe("its saved data could not be found. Ask the agent to draw it again.")
    expect(noticeText("chart-unavailable")).toBe("the chart viewer didn't load. Reload the page to try again.")
    expect(noticeText("render-failed")).toBe(
      "something went wrong while drawing it. Reload the page to try again.",
    )
  })

  it("no code leaks a spec token, with or without context", () => {
    for (const code of CATALOGUE) {
      assertNoLeak(noticePageText(code))
      assertNoLeak(noticePageText(code, { noun: "chart", column: "revenue", alias: "pie chart", max: 4 }))
    }
  })
})

describe("kindChipLabel", () => {
  it("names the component in plain words", () => {
    expect(kindChipLabel("chart", "line", false, 2)).toBe("Line chart")
    expect(kindChipLabel("chart", "bar", false, 1)).toBe("Bar chart")
    expect(kindChipLabel("chart", "bar", false, 4)).toBe("Bar chart")
    expect(kindChipLabel("chart", "bar", true, 1)).toBe("Bar chart")
    expect(kindChipLabel("chart", "bar", true, 4)).toBe("Stacked bar chart")
    expect(kindChipLabel("chart", "area", true, 1)).toBe("Area chart")
    expect(kindChipLabel("chart", "area", true, 3)).toBe("Stacked area chart")
    expect(kindChipLabel("chart", "scatter", false, 2)).toBe("Scatter chart")
    expect(kindChipLabel("table", null, false, 0)).toBe("Table")
    expect(kindChipLabel("metric", null, false, 0)).toBe("Metric")
  })

  it("reads a record", () => {
    for (const [rec, label] of [
      [chartBar, "Bar chart"],
      [chartRedrawn, "Stacked bar chart"],
      [chartAreaStacked, "Stacked area chart"],
      [table16, "Table"],
      [metricWithDelta, "Metric"],
    ] as const) {
      const r = parseArtifactRecord(rec)
      if (!r.ok) throw new Error("fixture must parse")
      expect(kindChipLabelOf(r.record)).toBe(label)
    }
  })
})

/** mulberry32 — a tiny seeded PRNG so the fuzz loop is reproducible. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const JUNK: unknown[] = [null, undefined, 0, -1, 1e9, NaN, "", "x", "__proto__", "constructor", [], {}, [[]], true, { __proto__: { evil: 1 } }]

function mutate(root: Rec, r: () => number): Rec {
  // Walk to a random container and replace / delete one key.
  let node: any = root
  for (let depth = 0; depth < 4; depth++) {
    if (node === null || typeof node !== "object") break
    const keys = Object.keys(node)
    if (keys.length === 0) break
    const k = keys[Math.floor(r() * keys.length)]
    const child = node[k]
    if (child !== null && typeof child === "object" && r() < 0.6) {
      node = child
      continue
    }
    if (r() < 0.3) delete node[k]
    else node[k] = JUNK[Math.floor(r() * JUNK.length)]
    return root
  }
  return root
}

describe("parseArtifactRecord — never throws", () => {
  it("survives 50 seeded mutations of the fixtures, and every failure is a clean notice", () => {
    const r = rng(273)
    for (let i = 0; i < 50; i++) {
      const src = ALL_VALID[i % ALL_VALID.length]
      const rec = mutate(clone(src) as Rec, r)
      const again = mutate(rec, r)
      let res: ReturnType<typeof parseArtifactRecord> | undefined
      expect(() => {
        res = parseArtifactRecord(again)
      }).not.toThrow()
      if (res && !res.ok) {
        expect(CATALOGUE).toContain(res.reason)
        assertNoLeak(noticePageText(res.reason, res.ctx))
      }
    }
  })

  it("survives a getter that throws", () => {
    const evil = clone(chartBar) as Rec
    Object.defineProperty(evil, "spec", {
      get() {
        throw new Error("boom")
      },
    })
    const res = parseArtifactRecord(evil)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe("invalid-settings")
  })
})
