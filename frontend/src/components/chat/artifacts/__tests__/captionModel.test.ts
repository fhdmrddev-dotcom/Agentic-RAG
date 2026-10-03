/**
 * Phase 273-02 Task 1 — the provenance caption (D-04 / sketch 3A / UI-D-05).
 *
 * The caption is composed ONLY from the server's structured caption facts; the wording lives in
 * artifactCopy.ts. These tests assert the JOINED TEXT a person reads, not segment presence.
 */
import { describe, expect, it } from "vitest"
import { parseArtifactRecord, type ArtifactRecord } from "../artifactSpec"
import { captionSegments } from "../captionModel"
import { operationPhrase } from "../artifactCopy"
import {
  chartBar,
  chartAreaStacked,
  chartFromFilter,
  chartRedrawn,
  table16,
  noSource,
  metricWithDelta,
  clone,
} from "./fixtures"

function rec(raw: unknown): ArtifactRecord {
  const r = parseArtifactRecord(raw)
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.reason}`)
  return r.record
}

function text(raw: unknown) {
  return captionSegments(rec(raw)).parts.join(" · ")
}

describe("captionSegments", () => {
  it("first emission with one source", () => {
    const c = captionSegments(rec(table16))
    expect(c.icon).toBe("file")
    expect(c.parts.join(" · ")).toBe("Data: query_tables · Quarterly_Report_FY25.pdf p.4 · 16 rows")
    expect(text(chartBar)).toBe("Data: query_tables · Quarterly_Report_FY25.pdf p.4 · 4 rows")
  })

  it("several sources, in call order, joined with an arrow", () => {
    expect(text(chartAreaStacked)).toBe("Data: query_documents · tickets_FY25.xlsx → execute_code · 4 rows")
  })

  it("at most 3 sources named, then +N more counted from source_count", () => {
    const r: any = clone(chartAreaStacked)
    r.caption.sources = [
      { tool: "query_documents", document: "tickets_FY25.xlsx", page: null },
      { tool: "query_tables", document: "Quarterly_Report_FY25.pdf", page: 7 },
      { tool: "execute_code", document: null, page: null },
      { tool: "search_documents", document: "board_pack.pdf", page: 2 },
    ]
    r.caption.source_count = 12
    expect(text(r)).toBe(
      "Data: query_documents · tickets_FY25.xlsx → query_tables · Quarterly_Report_FY25.pdf p.7 → execute_code +9 more · 4 rows",
    )
  })

  it("no source: the agent provided the values, with the Info icon", () => {
    const c = captionSegments(rec(noSource))
    expect(c.icon).toBe("info")
    expect(c.parts.join(" · ")).toBe(
      "Values provided by the agent · no source document in this turn · 5 rows",
    )
  })

  it("a re-encode with the same rows states it", () => {
    expect(text(chartRedrawn)).toBe(
      "Redrawn from chart 1 · same 4 rows · Data: query_tables · Quarterly_Report_FY25.pdf p.4 · 4 rows",
    )
  })

  it("a narrowed follow-up states which rows survived, of how many", () => {
    expect(text(chartFromFilter)).toBe(
      "From table 1 · filtered to quarter = Q3 · 4 of 16 rows · Data: query_tables · Quarterly_Report_FY25.pdf p.4 · 4 rows",
    )
  })

  it("operations render in the order filter → top-N → sort → columns", () => {
    const r: any = clone(chartFromFilter)
    r.caption.lineage.operations = [
      { op: "select", columns: ["quarter", "revenue"] },
      { op: "sort", column: "revenue", direction: "desc" },
      { op: "top_n", n: 5, column: "revenue" },
      { op: "filter_eq", column: "quarter", value: "Q3" },
    ]
    expect(captionSegments(rec(r)).parts.slice(0, 5)).toEqual([
      "From table 1",
      "filtered to quarter = Q3",
      "top 5 by revenue",
      "sorted by revenue, high to low",
      "columns: quarter, revenue",
    ])
  })

  it("a metric omits the row-count segment", () => {
    const parts = captionSegments(rec(metricWithDelta)).parts
    expect(parts.join(" · ")).toBe("Data: query_tables · Quarterly_Report_FY25.pdf p.4")
    expect(parts.some((p) => /rows?$/.test(p))).toBe(false)
  })
})

describe("operationPhrase", () => {
  it("filter_in caps at three values then +N more", () => {
    expect(
      operationPhrase({ op: "filter_in", column: "region", values: ["A", "B", "C", "D", "E"] }),
    ).toBe("filtered to region in A, B, C +2 more")
    expect(operationPhrase({ op: "filter_in", column: "region", values: ["EMEA", "APAC"] })).toBe(
      "filtered to region in EMEA, APAC",
    )
  })

  it("range, top-N, sort and select", () => {
    expect(operationPhrase({ op: "filter_range", column: "revenue", min: 10, max: 20 })).toBe(
      "filtered to revenue 10–20",
    )
    expect(operationPhrase({ op: "filter_range", column: "revenue", min: 1000, max: null })).toBe(
      "filtered to revenue ≥ 1,000",
    )
    expect(operationPhrase({ op: "top_n", n: 5, column: "revenue" })).toBe("top 5 by revenue")
    expect(operationPhrase({ op: "sort", column: "revenue", direction: "desc" })).toBe(
      "sorted by revenue, high to low",
    )
    expect(operationPhrase({ op: "sort", column: "revenue", direction: "asc" })).toBe(
      "sorted by revenue, low to high",
    )
    expect(operationPhrase({ op: "select", columns: ["quarter", "revenue"] })).toBe(
      "columns: quarter, revenue",
    )
  })

  it("a data value longer than 40 characters is truncated with an ellipsis", () => {
    const long = "Northwind Logistics International Holdings Limited (EMEA)"
    const phrase = operationPhrase({ op: "filter_eq", column: "vendor", value: long })
    expect(phrase).toBe(`filtered to vendor = ${long.slice(0, 39)}…`)
    const longCol = "x".repeat(60)
    expect(operationPhrase({ op: "top_n", n: 3, column: longCol })).toBe(`top 3 by ${"x".repeat(39)}…`)
  })

  it("a null filter value reads as empty, never as the word null", () => {
    expect(operationPhrase({ op: "filter_eq", column: "region", value: null })).toBe(
      "filtered to region = (empty)",
    )
  })
})
