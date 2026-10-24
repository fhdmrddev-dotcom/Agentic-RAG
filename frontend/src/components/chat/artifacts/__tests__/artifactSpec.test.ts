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
  diagramInvoice,
  comparisonContracts,
  timelineAtlas,
  mutable,
  type Mutable,
} from "./fixtures"

type Rec = Mutable

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
  // 292-02 (D-20): the six new codes.
  "too-many-items",
  "wrong-option-count",
  "no-items",
  "broken-link",
  "ragged-term",
  "bad-date",
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

  it("the closed component list is exactly the six, in backend order (292-02 · D-01)", () => {
    expect([...ARTIFACT_COMPONENT_NAMES]).toEqual(["chart", "table", "metric", "diagram", "comparison", "timeline"])
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
    expect(noticeText("unknown-component")).toBe(
      "it asked for something other than a chart, table, metric, diagram, comparison or timeline.",
    )
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
  let node: Mutable = root
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

// ══ Phase 292-02 (D-03..D-07 · D-13 · D-20 · I-1 · I-3) — the three encoded arms ══════════════
//
// Each arm mirrors plan 01's STORED contract rule for rule, with ONE documented asymmetry: the
// backend refuses < 2 nodes and 0 edges, this guard RENDERS 1-25 nodes and 0-40 edges (a crafted or
// legacy row draws, never errors). A failure is one closed reason whose context carries only a
// closed noun, a closed item word, a count, a closed alias or a ≤ 40-char data value.

/**
 * The NEW spec-leak tokens (D-20). ⚠ `events` is ALSO the closed item word the catalogue sentences
 * use ("it has no events to show"), exactly as `rows` is for 273 — so its KEY forms are what is
 * banned; `nodes`, `edges`, `verdict` and `component` are never words a sentence needs, so they are
 * banned bare.
 */
const NEW_LEAK_TOKENS = ["{", "}", "nodes", "edges", "verdict", '"events"', "events:", "component"]

function assertNoNewLeak(text: string) {
  for (const t of NEW_LEAK_TOKENS) expect(text, `leaked ${t}`).not.toContain(t)
}

function okRecord(raw: unknown) {
  const r = parseArtifactRecord(raw)
  if (!r.ok) throw new Error(`expected a parse, got ${r.reason}`)
  return r.record
}

function cell3(verdict: string) {
  return { verdict, text: null, source: null }
}

describe("292 — the encoded arms accept the stored shapes", () => {
  it("the invoice diagram (8 nodes, 9 edges, a back edge, a labelled self-loop) parses", () => {
    const r = okRecord(diagramInvoice)
    expect(r.component).toBe("diagram")
    expect(r.spec.diagram?.nodes).toHaveLength(8)
    expect(r.spec.diagram?.edges).toHaveLength(9)
    expect(r.spec.diagram?.nodes.map((n) => n.kind)).toEqual([
      "start", "decision", "step", "end", "step", "step", "step", "end",
    ])
    expect(r.spec.diagram?.nodes[0].source).toEqual({
      document: "Invoice_Policy.pdf",
      page: 3,
      excerpt: "Every supplier invoice is logged in the AP inbox on the day it arrives.",
    })
    expect(r.spec.diagram?.edges[5]).toEqual({ from: "approve", to: "approve", label: "Reminder after 3 days" })
    expect(r.spec.comparison).toBeNull()
    expect(r.spec.timeline).toBeNull()
    expect(r.spec.chart).toBeNull()
    expect(r.spec.metric).toBeNull()
    expect(r.spec.columns).toEqual([])
    expect(r.spec.rows).toEqual([])
  })

  it("the 3 × 7 comparison (with q cells) parses", () => {
    const r = okRecord(comparisonContracts)
    expect(r.spec.comparison?.options).toEqual(["Atlas Logistics", "Northwind Freight", "Kestrel Cargo"])
    expect(r.spec.comparison?.terms).toHaveLength(7)
    expect(r.spec.comparison?.terms[4].cells[1]).toEqual({ verdict: "q", text: "Not stated", source: null })
    expect(r.spec.diagram).toBeNull()
    expect(r.spec.timeline).toBeNull()
    expect(r.spec.columns).toEqual([])
    expect(r.spec.rows).toEqual([])
  })

  it("the 9-event timeline parses, in the stored order (the guard never re-sorts)", () => {
    const shuffled = mutable(timelineAtlas)
    shuffled.spec.timeline.events.reverse()
    expect(okRecord(shuffled).spec.timeline?.events[0].date).toBe("2027-03-31")
    const plain = okRecord(timelineAtlas)
    expect(plain.spec.timeline?.events).toHaveLength(9)
    expect(plain.spec.timeline?.events[7].deadline).toBe(true)
    expect(plain.spec.diagram).toBeNull()
    expect(plain.spec.comparison).toBeNull()
  })

  it("the asymmetry: a 1-node, 0-edge diagram RENDERS (the backend refuses it; a crafted row draws)", () => {
    const one = mutable(diagramInvoice)
    one.spec.diagram.nodes = [one.spec.diagram.nodes[0]]
    one.spec.diagram.edges = []
    one.row_count = 1
    one.caption.row_count = 1
    expect(okRecord(one).spec.diagram?.nodes).toHaveLength(1)
  })

  it("a month-precision date parses beside day-precision ones", () => {
    const rec = mutable(timelineAtlas)
    rec.spec.timeline.events[1].date = "2023-04"
    expect(okRecord(rec).spec.timeline?.events[1].date).toBe("2023-04")
  })
})

describe("292 — diagram refusals", () => {
  it("26 nodes → too-many-items {diagram, steps, max 25}", () => {
    const rec = mutable(diagramInvoice)
    rec.spec.diagram.nodes = Array.from({ length: 26 }, (_, i) => ({ id: `n${i}`, label: `Step ${i}`, kind: "step", source: null }))
    rec.spec.diagram.edges = [{ from: "n0", to: "n1", label: null }]
    rec.row_count = 26
    rec.caption.row_count = 26
    const r = fail(rec)
    expect(r.reason).toBe("too-many-items")
    expect(r.ctx).toEqual({ noun: "diagram", items: "steps", max: 25 })
    expect(noticeText(r.reason, r.ctx)).toBe("it has more steps than a diagram can show (max 25).")
  })

  it("41 edges → too-many-items {links, max 40}", () => {
    const rec = mutable(diagramInvoice)
    rec.spec.diagram.edges = Array.from({ length: 41 }, (_, i) => ({ from: "log", to: "match", label: `l${i}` }))
    const r = fail(rec)
    expect(r.reason).toBe("too-many-items")
    expect(r.ctx).toEqual({ noun: "diagram", items: "links", max: 40 })
  })

  it("0 nodes → no-items {steps}", () => {
    const rec = mutable(diagramInvoice)
    rec.spec.diagram.nodes = []
    rec.spec.diagram.edges = []
    const r = fail(rec)
    expect(r.reason).toBe("no-items")
    expect(r.ctx?.items).toBe("steps")
    expect(noticeText(r.reason, r.ctx)).toBe("it has no steps to show.")
  })

  it("an edge to a missing node → broken-link with that id", () => {
    const rec = mutable(diagramInvoice)
    rec.spec.diagram.edges[2].to = "zz"
    const r = fail(rec)
    expect(r.reason).toBe("broken-link")
    expect(r.ctx?.value).toBe("zz")
    expect(noticeText(r.reason, r.ctx)).toBe(
      "its saved data links to a step that isn't in it (zz). Ask the agent to draw it again.",
    )
  })

  it("duplicate id, duplicate from→to, unlabelled self-loop, kind actor, id `a b`, a 49-unit label → invalid-settings", () => {
    const cases: Array<(r: Rec) => void> = [
      (r) => (r.spec.diagram.nodes[2].id = "log"),
      (r) => r.spec.diagram.edges.push({ from: "log", to: "match", label: "again" }),
      (r) => (r.spec.diagram.edges[5].label = null),
      (r) => (r.spec.diagram.nodes[2].kind = "actor"),
      (r) => (r.spec.diagram.nodes[2].kind = "Decision"),
      (r) => (r.spec.diagram.nodes[2].id = "a b"),
      // 47 letters + one emoji (2 UTF-16 units) = 49 units, over the 48 cap.
      (r) => (r.spec.diagram.nodes[2].label = `${"x".repeat(47)}😀`),
      (r) => (r.spec.diagram.edges[1].label = "y".repeat(25)),
    ]
    for (const [i, corrupt] of cases.entries()) {
      const rec = mutable(diagramInvoice)
      corrupt(rec)
      const r = fail(rec)
      expect(r.reason, `case ${i}`).toBe("invalid-settings")
      expect(r.ctx?.noun, `case ${i}`).toBe("diagram")
    }
  })

  it("a 48-unit label (emoji at the boundary) still parses", () => {
    const rec = mutable(diagramInvoice)
    rec.spec.diagram.nodes[2].label = `${"x".repeat(46)}😀`
    expect(okRecord(rec).spec.diagram?.nodes[2].label).toHaveLength(48)
  })
})

describe("292 — comparison refusals", () => {
  it("1 or 6 options → wrong-option-count {count}", () => {
    for (const n of [1, 6]) {
      const rec = mutable(comparisonContracts)
      rec.spec.comparison.options = Array.from({ length: n }, (_, i) => `Vendor ${i}`)
      const r = fail(rec)
      expect(r.reason, String(n)).toBe("wrong-option-count")
      expect(r.ctx?.count).toBe(n)
    }
    const six = mutable(comparisonContracts)
    six.spec.comparison.options = Array.from({ length: 6 }, (_, i) => `Vendor ${i}`)
    const r = fail(six)
    expect(noticeText(r.reason, r.ctx)).toBe("it has 6 options; a comparison shows 2 to 5.")
  })

  it("a duplicate option → invalid-settings", () => {
    const rec = mutable(comparisonContracts)
    rec.spec.comparison.options[2] = "Atlas Logistics"
    expect(fail(rec).reason).toBe("invalid-settings")
  })

  it("21 terms → too-many-items {terms, max 20}; 0 terms → no-items {terms}", () => {
    const big = mutable(comparisonContracts)
    big.spec.comparison.terms = Array.from({ length: 21 }, (_, i) => ({
      name: `Term ${i}`,
      cells: [cell3("y"), cell3("n"), cell3("m")],
    }))
    big.row_count = 21
    big.caption.row_count = 21
    const r = fail(big)
    expect(r.reason).toBe("too-many-items")
    expect(r.ctx).toEqual({ noun: "comparison", items: "terms", max: 20 })
    const none = mutable(comparisonContracts)
    none.spec.comparison.terms = []
    const r0 = fail(none)
    expect(r0.reason).toBe("no-items")
    expect(r0.ctx?.items).toBe("terms")
  })

  it("a ragged term → ragged-term with the term name truncated at 40", () => {
    const rec = mutable(comparisonContracts)
    const long = "Limitation of liability for indirect and consequential loss"
    rec.spec.comparison.terms[3].name = long
    rec.spec.comparison.terms[3].cells.pop()
    const r = fail(rec)
    expect(r.reason).toBe("ragged-term")
    expect(r.ctx?.value).toBe(`${long.slice(0, 39)}…`)
    expect(noticeText(r.reason, r.ctx)).toBe(
      `its saved data has a term with the wrong number of cells (${long.slice(0, 39)}…). Ask the agent to draw it again.`,
    )
  })

  it('verdict "x" or "Y" → invalid-settings (stored verdicts are lower-case)', () => {
    for (const v of ["x", "Y", "", null]) {
      const rec = mutable(comparisonContracts)
      rec.spec.comparison.terms[0].cells[0].verdict = v
      expect(fail(rec).reason, String(v)).toBe("invalid-settings")
    }
  })

  it("cell text over 200 units, an option over 40 or a term over 60 → invalid-settings", () => {
    const cases: Array<(r: Rec) => void> = [
      (r) => (r.spec.comparison.terms[0].cells[0].text = "t".repeat(201)),
      (r) => (r.spec.comparison.options[0] = "o".repeat(41)),
      (r) => (r.spec.comparison.terms[0].name = "n".repeat(61)),
    ]
    for (const [i, corrupt] of cases.entries()) {
      const rec = mutable(comparisonContracts)
      corrupt(rec)
      expect(fail(rec).reason, `case ${i}`).toBe("invalid-settings")
    }
  })
})

describe("292 — timeline refusals", () => {
  it('"2026-13-01", "2026-02-30", "24 Oct 2026" → bad-date with the value', () => {
    for (const d of ["2026-13-01", "2026-02-30", "24 Oct 2026", "2026-1-05", "2026-00"]) {
      const rec = mutable(timelineAtlas)
      rec.spec.timeline.events[2].date = d
      const r = fail(rec)
      expect(r.reason, d).toBe("bad-date")
      expect(r.ctx?.value).toBe(d)
    }
    const rec = mutable(timelineAtlas)
    rec.spec.timeline.events[2].date = "24 Oct 2026"
    const r = fail(rec)
    expect(noticeText(r.reason, r.ctx)).toBe(
      "its saved data has a date we can't read (24 Oct 2026). Ask the agent to draw it again.",
    )
  })

  it("29 February parses only in a leap year", () => {
    const leap = mutable(timelineAtlas)
    leap.spec.timeline.events[2].date = "2024-02-29"
    expect(parseArtifactRecord(leap).ok).toBe(true)
    const plain = mutable(timelineAtlas)
    plain.spec.timeline.events[2].date = "2025-02-29"
    expect(fail(plain).reason).toBe("bad-date")
  })

  it('deadline "yes" → invalid-settings; 41 events → too-many-items {events, max 40}', () => {
    const yes = mutable(timelineAtlas)
    yes.spec.timeline.events[7].deadline = "yes"
    expect(fail(yes).reason).toBe("invalid-settings")
    const big = mutable(timelineAtlas)
    big.spec.timeline.events = Array.from({ length: 41 }, (_, i) => ({
      date: "2026-01-01",
      title: `Event ${i}`,
      detail: null,
      category: null,
      deadline: false,
      source: null,
    }))
    big.row_count = 41
    big.caption.row_count = 41
    const r = fail(big)
    expect(r.reason).toBe("too-many-items")
    expect(r.ctx).toEqual({ noun: "timeline", items: "events", max: 40 })
    expect(noticeText(r.reason, r.ctx)).toBe("it has more events than a timeline can show (max 40).")
  })

  it("a title over 80, a detail over 200 or a category over 24 → invalid-settings", () => {
    const cases: Array<(r: Rec) => void> = [
      (r) => (r.spec.timeline.events[0].title = "t".repeat(81)),
      (r) => (r.spec.timeline.events[0].detail = "d".repeat(201)),
      (r) => (r.spec.timeline.events[0].category = "c".repeat(25)),
    ]
    for (const [i, corrupt] of cases.entries()) {
      const rec = mutable(timelineAtlas)
      corrupt(rec)
      expect(fail(rec).reason, `case ${i}`).toBe("invalid-settings")
    }
  })

  it("0 events → no-items {events}", () => {
    const rec = mutable(timelineAtlas)
    rec.spec.timeline.events = []
    const r = fail(rec)
    expect(r.reason).toBe("no-items")
    expect(noticeText(r.reason, r.ctx)).toBe("it has no events to show.")
  })
})

describe("292 — shared refusals across the three arms", () => {
  it("a malformed source → invalid-settings", () => {
    const bad: unknown[] = [
      true,
      3,
      "Invoice_Policy.pdf",
      { document: 5, page: null, excerpt: null },
      { document: null, page: 0, excerpt: null },
      { document: null, page: 1.5, excerpt: null },
      { document: null, page: null, excerpt: "e".repeat(281) },
      { document: "d".repeat(201), page: null, excerpt: null },
    ]
    for (const [i, s] of bad.entries()) {
      const rec = mutable(diagramInvoice)
      rec.spec.diagram.nodes[0].source = s
      expect(fail(rec).reason, `node ${i}`).toBe("invalid-settings")
      const c = mutable(comparisonContracts)
      c.spec.comparison.terms[0].cells[0].source = s
      expect(fail(c).reason, `cell ${i}`).toBe("invalid-settings")
      const t = mutable(timelineAtlas)
      t.spec.timeline.events[0].source = s
      expect(fail(t).reason, `event ${i}`).toBe("invalid-settings")
    }
  })

  it("a new-type spec carrying rows, columns, chart, metric or another type's encoding → invalid-settings", () => {
    const extras: Array<[string, unknown]> = [
      ["rows", [["x"]]],
      ["columns", [{ name: "x", type: "string", unit: null }]],
      ["chart", clone(chartBar.spec.chart)],
      ["metric", clone(metricWithDelta.spec.metric)],
      ["comparison", clone(comparisonContracts.spec.comparison)],
      ["timeline", clone(timelineAtlas.spec.timeline)],
    ]
    for (const [key, value] of extras) {
      const rec = mutable(diagramInvoice)
      rec.spec[key] = value
      expect(fail(rec).reason, key).toBe("invalid-settings")
    }
    const t = mutable(timelineAtlas)
    t.spec.diagram = clone(diagramInvoice.spec.diagram)
    expect(fail(t).reason).toBe("invalid-settings")
  })

  it("a tabular spec carrying a new encoding → invalid-settings", () => {
    const rec = mutable(table16)
    rec.spec.diagram = clone(diagramInvoice.spec.diagram)
    expect(fail(rec).reason).toBe("invalid-settings")
  })

  it("row_count or caption.row_count ≠ the item count → invalid-settings; a lineage → invalid-settings", () => {
    const a = mutable(diagramInvoice)
    a.row_count = 9
    expect(fail(a).reason).toBe("invalid-settings")
    const b = mutable(comparisonContracts)
    b.caption.row_count = 3
    expect(fail(b).reason).toBe("invalid-settings")
    const c = mutable(timelineAtlas)
    c.caption.lineage = { parent_label: "timeline 1", parent_row_count: 9, same_rows: true, operations: [] }
    expect(fail(c).reason).toBe("invalid-settings")
  })

  it("an encoding that is not an object → invalid-settings, with its own noun", () => {
    const rec = mutable(comparisonContracts)
    rec.spec.comparison = "[]"
    const r = fail(rec)
    expect(r.reason).toBe("invalid-settings")
    expect(noticeText(r.reason, r.ctx)).toBe(
      "its saved settings don't match what a comparison needs. Ask the agent to draw it again.",
    )
  })

  it("label chips accept `diagram N` / `comparison N` / `timeline N` only for their own component (D-13)", () => {
    const a = mutable(diagramInvoice)
    a.label = "timeline 1"
    expect(fail(a).reason).toBe("invalid-settings")
    const b = mutable(timelineAtlas)
    b.label = "steps 1"
    expect(fail(b).reason).toBe("invalid-settings")
    const c = mutable(comparisonContracts)
    c.label = "comparison 0"
    expect(fail(c).reason).toBe("invalid-settings")
    const d = mutable(comparisonContracts)
    d.label = "comparison 12"
    expect(parseArtifactRecord(d).ok).toBe(true)
  })

  it("a tabular lineage may name a new-type label (LABEL_RE is the six)", () => {
    const rec = mutable(chartRedrawn)
    rec.caption.lineage.parent_label = "diagram 3"
    expect(parseArtifactRecord(rec).ok).toBe(true)
  })
})

describe("292 — the widened unknown-component sentence and the alias table", () => {
  it('"mindmap" → the alias sentence', () => {
    for (const raw of ["mindmap", " MindMap ", "mind_map"]) {
      const rec = mutable(diagramInvoice)
      rec.component = raw
      const r = fail(rec)
      expect(r.reason, raw).toBe("unknown-component")
      expect(noticeText(r.reason, r.ctx)).toBe(
        "it asked for a mind map, which isn't one of the artifact types we can show.",
      )
    }
  })

  it("an alias that starts with a vowel reads `an` (image)", () => {
    const rec = mutable(diagramInvoice)
    rec.component = "image"
    const r = fail(rec)
    expect(noticeText(r.reason, r.ctx)).toBe(
      "it asked for an image, which isn't one of the artifact types we can show.",
    )
  })

  it('"flowchart", "graph", "gantt_chart" and "__proto__" → the generic sentence, the word never echoed', () => {
    for (const raw of ["flowchart", "graph", "gantt_chart", "__proto__", "constructor", "toString"]) {
      const rec = mutable(diagramInvoice)
      rec.component = raw
      const r = fail(rec)
      expect(r.reason, raw).toBe("unknown-component")
      const text = noticeText(r.reason, r.ctx)
      expect(text).toBe(
        "it asked for something other than a chart, table, metric, diagram, comparison or timeline.",
      )
      expect(text).not.toContain(raw)
    }
  })
})

describe("292 — the new notice sentences never print the spec", () => {
  it("every new code returns its UI-SPEC sentence", () => {
    expect(noticeText("too-many-items", { noun: "comparison", items: "terms", max: 20 })).toBe(
      "it has more terms than a comparison can show (max 20).",
    )
    expect(noticeText("too-many-items", { noun: "diagram", items: "links", max: 40 })).toBe(
      "it has more links than a diagram can show (max 40).",
    )
    expect(noticeText("wrong-option-count", { noun: "comparison", count: 6 })).toBe(
      "it has 6 options; a comparison shows 2 to 5.",
    )
    expect(noticeText("no-items", { noun: "comparison", items: "terms" })).toBe("it has no terms to show.")
    expect(noticeText("broken-link", { noun: "diagram", value: "zz" })).toBe(
      "its saved data links to a step that isn't in it (zz). Ask the agent to draw it again.",
    )
    expect(noticeText("ragged-term", { noun: "comparison", value: "Liability cap" })).toBe(
      "its saved data has a term with the wrong number of cells (Liability cap). Ask the agent to draw it again.",
    )
    expect(noticeText("bad-date", { noun: "timeline", value: "2026-13-01" })).toBe(
      "its saved data has a date we can't read (2026-13-01). Ask the agent to draw it again.",
    )
    expect(noticeText("invalid-settings", { noun: "timeline" })).toBe(
      "its saved settings don't match what a timeline needs. Ask the agent to draw it again.",
    )
  })

  it("no code — old or new — leaks a spec key, with or without context", () => {
    for (const code of CATALOGUE) {
      assertNoNewLeak(noticePageText(code))
      for (const noun of ["diagram", "comparison", "timeline"] as const) {
        for (const items of ["steps", "links", "terms", "options", "events"] as const) {
          const text = noticePageText(code, { noun, items, max: 25, count: 6, value: "zz", alias: "mind map" })
          assertNoNewLeak(text)
          assertNoLeak(text)
        }
      }
    }
  })

  it("kind chips: Flow diagram / Comparison / Timeline; the old chips are unchanged", () => {
    expect(kindChipLabel("diagram", null, false, 0)).toBe("Flow diagram")
    expect(kindChipLabel("comparison", null, false, 0)).toBe("Comparison")
    expect(kindChipLabel("timeline", null, false, 0)).toBe("Timeline")
    for (const [raw, label] of [
      [diagramInvoice, "Flow diagram"],
      [comparisonContracts, "Comparison"],
      [timelineAtlas, "Timeline"],
    ] as const) {
      expect(kindChipLabelOf(okRecord(raw))).toBe(label)
    }
    expect(kindChipLabel("table", null, false, 0)).toBe("Table")
  })
})

describe("292 — the encoded arms never throw", () => {
  it("survives 60 seeded mutations of the three new fixtures; every failure is a clean notice", () => {
    const r = rng(292)
    const NEW = [diagramInvoice, comparisonContracts, timelineAtlas]
    for (let i = 0; i < 60; i++) {
      const rec = mutate(mutate(clone(NEW[i % NEW.length]) as Rec, r), r)
      let res: ReturnType<typeof parseArtifactRecord> | undefined
      expect(() => {
        res = parseArtifactRecord(rec)
      }).not.toThrow()
      if (res && !res.ok) {
        expect(CATALOGUE).toContain(res.reason)
        assertNoNewLeak(noticePageText(res.reason, res.ctx))
      }
    }
  })
})
