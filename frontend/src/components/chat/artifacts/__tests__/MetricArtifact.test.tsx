/**
 * Phase 273-02 Task 2 — MetricArtifact (D-13 · sketch 2A · UI-D-04): ONE value, its label and unit,
 * and an optional delta whose glyph + words carry the meaning (colour is secondary).
 */
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MetricArtifact } from "../MetricArtifact"
import { parseArtifactRecord, type ArtifactRecord } from "../artifactSpec"
import { metricWithDelta, metricZeroCompare, mutable } from "./fixtures"

function rec(raw: unknown): ArtifactRecord {
  const r = parseArtifactRecord(raw)
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.reason}`)
  return r.record
}

describe("MetricArtifact", () => {
  it("shows label, value with its unit, and a higher delta", () => {
    render(<MetricArtifact record={rec(metricWithDelta)} />)
    expect(screen.getByTestId("metric-label")).toHaveTextContent("Q4 revenue")
    const value = screen.getByTestId("metric-value")
    expect(value).toHaveTextContent("$1,656K")
    expect(value).toHaveClass("font-headline", "text-[28px]", "tabular-nums")
    expect(screen.getByTestId("metric-unit")).toHaveTextContent("K")
    const delta = screen.getByTestId("metric-delta")
    expect(delta).toHaveTextContent("▲ 8.1% vs Q3 ($1,532K)")
    const coloured = screen.getByTestId("metric-delta-change")
    expect(coloured).toHaveTextContent(/^▲ 8\.1%$/)
    expect(coloured.className).toMatch(/emerald/)
    // Only the glyph + percent is coloured; the comparison words stay muted.
    expect(delta).toHaveClass("text-muted-foreground")
  })

  it("a lower value reads ▼ in rose", () => {
    const r = mutable(metricWithDelta)
    r.spec.rows = [[1400, 1532]]
    render(<MetricArtifact record={rec(r)} />)
    expect(screen.getByTestId("metric-delta")).toHaveTextContent("▼ 8.6% vs Q3 ($1,532K)")
    expect(screen.getByTestId("metric-delta-change").className).toMatch(/rose/)
  })

  it("an equal value reads = no change, muted", () => {
    const r = mutable(metricWithDelta)
    r.spec.rows = [[1532, 1532]]
    render(<MetricArtifact record={rec(r)} />)
    expect(screen.getByTestId("metric-delta")).toHaveTextContent("= no change vs Q3 ($1,532K)")
    expect(screen.getByTestId("metric-delta-change").className).not.toMatch(/emerald|rose/)
  })

  it("a zero comparison shows the absolute difference and no percent", () => {
    render(<MetricArtifact record={rec(metricZeroCompare)} />)
    const delta = screen.getByTestId("metric-delta")
    expect(delta).toHaveTextContent("▲ +$274K vs FY24 ($0K)")
    expect(delta.textContent).not.toContain("%")
    expect(screen.getByTestId("metric-label")).toHaveTextContent("LATAM revenue")
  })

  it("no comparison column → no delta line", () => {
    const r = mutable(metricWithDelta)
    r.spec.metric.compare_column = null
    render(<MetricArtifact record={rec(r)} />)
    expect(screen.queryByTestId("metric-delta")).toBeNull()
  })

  it("renders straight in the card body — no inner bordered tile (UI-D-04)", () => {
    render(<MetricArtifact record={rec(metricWithDelta)} />)
    const root = screen.getByTestId("artifact-metric")
    expect(root.className).not.toMatch(/\bborder\b|rounded/)
    for (const el of Array.from(root.querySelectorAll("*"))) {
      expect((el as HTMLElement).className || "").not.toMatch(/\bborder\b/)
    }
  })
})
