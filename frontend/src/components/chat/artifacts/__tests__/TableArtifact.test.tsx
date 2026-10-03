/**
 * Phase 273-02 Task 2 — TableArtifact (D-13): click-to-sort with aria-sort, numbers numeric, text by
 * localeCompare, empty cells last in BOTH directions, sticky header, 512px scroll.
 */
import { describe, expect, it } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { TableArtifact } from "../TableArtifact"
import { parseArtifactRecord, type ArtifactRecord } from "../artifactSpec"
import { table16, noSource, clone } from "./fixtures"

function rec(raw: unknown): ArtifactRecord {
  const r = parseArtifactRecord(raw)
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.reason}`)
  return r.record
}

function columnText(colIndex: number): string[] {
  const body = screen.getByTestId("artifact-table").querySelector("tbody")!
  return within(body)
    .getAllByRole("row")
    .map((tr) => within(tr).getAllByRole("cell")[colIndex].textContent ?? "")
}

function header(name: RegExp) {
  return screen.getByRole("columnheader", { name })
}

describe("TableArtifact", () => {
  it("renders the spec's row order first, with every header unsorted", () => {
    render(<TableArtifact record={rec(table16)} />)
    expect(columnText(0).slice(0, 4)).toEqual(["Q1", "Q1", "Q1", "Q1"])
    expect(columnText(1).slice(0, 4)).toEqual(["Americas", "EMEA", "APAC", "LATAM"])
    for (const h of screen.getAllByRole("columnheader")) expect(h).toHaveAttribute("aria-sort", "none")
    expect(header(/revenue/)).toHaveTextContent("↕")
  })

  it("first click ascends, second descends, another column starts ascending", () => {
    render(<TableArtifact record={rec(table16)} />)
    const revenueBtn = within(header(/revenue/)).getByRole("button")
    fireEvent.click(revenueBtn)
    expect(header(/revenue/)).toHaveAttribute("aria-sort", "ascending")
    const up = within(header(/revenue/)).getByText("▲")
    expect(up).toHaveClass("text-primary")
    expect(columnText(2).slice(0, 3)).toEqual(["210", "238", "251"])

    fireEvent.click(revenueBtn)
    expect(header(/revenue/)).toHaveAttribute("aria-sort", "descending")
    expect(within(header(/revenue/)).getByText("▼")).toHaveClass("text-primary")
    expect(columnText(2).slice(0, 3)).toEqual(["1,656", "1,402", "1,325"])

    fireEvent.click(within(header(/region/)).getByRole("button"))
    expect(header(/region/)).toHaveAttribute("aria-sort", "ascending")
    expect(header(/revenue/)).toHaveAttribute("aria-sort", "none")
    expect(columnText(1).slice(0, 5)).toEqual(["Americas", "Americas", "Americas", "Americas", "APAC"])
  })

  it("numbers sort numerically, never as text (2 < 10)", () => {
    const r: any = clone(noSource)
    r.spec.rows = [
      ["A", 10],
      ["B", 2],
      ["C", 33],
    ]
    r.row_count = 3
    r.caption.row_count = 3
    render(<TableArtifact record={rec(r)} />)
    fireEvent.click(within(header(/annual cost/)).getByRole("button"))
    expect(columnText(1)).toEqual(["2", "10", "33"])
  })

  it("empty cells sort last in BOTH directions and render a muted dash", () => {
    render(<TableArtifact record={rec(noSource)} />)
    const btn = within(header(/annual cost/)).getByRole("button")
    fireEvent.click(btn)
    expect(columnText(1)).toEqual(["167", "184", "199", "212", "—"])
    fireEvent.click(btn)
    expect(columnText(1)).toEqual(["212", "199", "184", "167", "—"])
    const dash = screen.getByText("—")
    expect(dash).toHaveClass("text-muted-foreground")
  })

  it("numeric cells are right-aligned, tabular and grouped; the header is sticky and the body scrolls at 512px", () => {
    render(<TableArtifact record={rec(table16)} />)
    const cell = screen.getAllByText("1,656")[0].closest("td")!
    expect(cell).toHaveClass("text-right")
    expect(cell).toHaveClass("tabular-nums")
    expect(header(/revenue/)).toHaveClass("sticky", "top-0")
    expect(header(/revenue/)).toHaveClass("text-right")
    const scroller = screen.getByTestId("artifact-table")
    expect(scroller).toHaveClass("max-h-[512px]", "overflow-auto")
  })

  it("long text truncates with the full value in title, rendered as text", () => {
    const r: any = clone(noSource)
    const long = "<b>Northwind Logistics International Holdings Limited</b> — EMEA consolidated"
    r.spec.rows[0][0] = long
    render(<TableArtifact record={rec(r)} />)
    const cell = screen.getByTitle(long)
    expect(cell).toHaveTextContent(long)
    expect(cell).toHaveClass("truncate")
    expect(cell.querySelector("b")).toBeNull()
  })
})
