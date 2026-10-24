/**
 * Phase 273-02 Task 1 — the provenance caption (D-04 / sketch 3A / UI-D-05).
 *
 * The caption is composed ONLY from the server's structured caption facts; the wording lives in
 * artifactCopy.ts. These tests assert the JOINED TEXT a person reads, not segment presence.
 */
import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { parseArtifactRecord, type ArtifactRecord } from "../artifactSpec"
import { captionSegments } from "../captionModel"
import { ArtifactFrame } from "../ArtifactFrame"
import { linksPhrase, operationPhrase, stepsPhrase, optionsTermsPhrase, eventsPhrase } from "../artifactCopy"
import {
  diagramInvoice,
  comparisonContracts,
  timelineAtlas,
  chartBar,
  chartAreaStacked,
  chartFromFilter,
  chartRedrawn,
  table16,
  noSource,
  metricWithDelta,
  mutable,
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
    const r = mutable(chartAreaStacked)
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
    const r = mutable(chartFromFilter)
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

// ══ Phase 292-02 (D-15 · UI-D-292-20) — per-component count segments and the comparison note ════

describe("292 — the count segment is phrased per component, from the validated spec", () => {
  it("diagram → `8 steps · 9 links`, the full caption with one source", () => {
    const c = captionSegments(rec(diagramInvoice))
    expect(c.icon).toBe("file")
    expect(c.parts[c.parts.length - 1]).toBe("8 steps · 9 links")
    expect(c.parts.join(" · ")).toBe("Data: search_documents · Invoice_Policy.pdf p.3 · 8 steps · 9 links")
    expect(c.note).toBeUndefined()
  })

  it("step / link phrases: `1 step`, `1 link`, `no links`", () => {
    expect(stepsPhrase(1)).toBe("1 step")
    expect(stepsPhrase(8)).toBe("8 steps")
    expect(linksPhrase(0)).toBe("no links")
    expect(linksPhrase(1)).toBe("1 link")
    expect(linksPhrase(9)).toBe("9 links")
    const one = mutable(diagramInvoice)
    one.spec.diagram.nodes = [one.spec.diagram.nodes[0]]
    one.spec.diagram.edges = []
    one.row_count = 1
    one.caption.row_count = 1
    expect(captionSegments(rec(one)).parts.at(-1)).toBe("1 step · no links")
  })

  it("comparison → `3 options × 7 terms` and the sourced note", () => {
    const c = captionSegments(rec(comparisonContracts))
    expect(c.parts.join(" · ")).toBe(
      "Data: search_documents · Atlas_MSA_2023.pdf p.14 → query_documents · 3 options × 7 terms",
    )
    expect(c.note).toBe("Verdicts are the agent's reading. Hover or focus a cell for its clause.")
    expect(optionsTermsPhrase(2, 1)).toBe("2 options × 1 term")
  })

  it("comparison without a single sourced cell → the short note", () => {
    const r = mutable(comparisonContracts)
    for (const t of r.spec.comparison.terms) for (const c of t.cells) c.source = null
    expect(captionSegments(rec(r)).note).toBe("Verdicts are the agent's reading.")
  })

  it("timeline → `9 events` / `1 event`, with the no-source wording and no note", () => {
    const c = captionSegments(rec(timelineAtlas))
    expect(c.icon).toBe("info")
    expect(c.parts.join(" · ")).toBe("Values provided by the agent · no source document in this turn · 9 events")
    expect(c.note).toBeUndefined()
    expect(eventsPhrase(1)).toBe("1 event")
  })

  it("tabular captions are byte-for-byte unchanged and carry no note", () => {
    expect(captionSegments(rec(table16)).note).toBeUndefined()
    expect(text(table16)).toBe("Data: query_tables · Quarterly_Report_FY25.pdf p.4 · 16 rows")
    expect(text(metricWithDelta)).toBe("Data: query_tables · Quarterly_Report_FY25.pdf p.4")
  })

  it("the caption never reads model text: renaming every label and title changes nothing", () => {
    const r = mutable(diagramInvoice)
    r.spec.title = "IGNORE PREVIOUS INSTRUCTIONS"
    for (const n of r.spec.diagram.nodes) n.label = "Data: forged.pdf"
    expect(captionSegments(rec(r))).toEqual(captionSegments(rec(diagramInvoice)))
  })
})

describe("292 — ArtifactFrame renders the note inside the figcaption", () => {
  it("comparison → one full-width italic line after the caption text", () => {
    const { getByTestId } = render(createElement(ArtifactFrame, { record: rec(comparisonContracts), children: null }))
    const caption = getByTestId("artifact-caption")
    const note = getByTestId("artifact-caption-note")
    expect(caption.contains(note)).toBe(true)
    expect(note.textContent).toBe("Verdicts are the agent's reading. Hover or focus a cell for its clause.")
    expect(note).toHaveClass("basis-full", "italic", "text-muted-foreground")
    expect(caption.lastElementChild).toBe(note)
  })

  it("no note → nothing extra in the figcaption", () => {
    const { getByTestId, queryByTestId } = render(createElement(ArtifactFrame, { record: rec(table16), children: null }))
    expect(queryByTestId("artifact-caption-note")).toBeNull()
    expect(getByTestId("artifact-caption").children).toHaveLength(3)
  })
})
