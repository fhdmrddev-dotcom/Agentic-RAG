/**
 * Phase 292-02 Task 3 (D-05 · D-17 · I-3 · sketch 3A · UI-D-292-10..14) — the comparison matrix.
 *
 * A real <table> with scope headers; ONE verdict glyph badge per option cell, whose sr-only word
 * carries the verdict for screen readers; a `q` cell always reads italic `Not stated`; no cell is
 * ever blank; "Only terms that differ" removes exactly the identical rows. Assertions are about the
 * TEXT a person reads, not element presence.
 */
import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { ComparisonArtifact } from "../ComparisonArtifact"
import { parseArtifactRecord, type ArtifactRecord } from "../artifactSpec"
import { comparisonContracts, mutable } from "./fixtures"

afterEach(() => cleanup())

function rec(raw: unknown): ArtifactRecord {
  const r = parseArtifactRecord(raw)
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.reason}`)
  return r.record
}

/** The sketch data with two identical terms: every vendor caps liability the same, none states residency. */
function withIdentical() {
  const m = mutable(comparisonContracts)
  m.spec.comparison.terms[3].cells = [0, 1, 2].map(() => ({ verdict: "y", text: "12 months’ fees", source: null }))
  m.spec.comparison.terms[5].cells = [0, 1, 2].map(() => ({ verdict: "q", text: null, source: null }))
  return m
}

function bodyRows() {
  return within(screen.getByRole("table")).getAllByRole("row").slice(1)
}

function optionCells() {
  return screen.getAllByTestId("comparison-cell")
}

describe("ComparisonArtifact — the matrix", () => {
  it("a table with a Term column and one column per option, all with scope", () => {
    render(<ComparisonArtifact record={rec(comparisonContracts)} />)
    const headers = screen.getAllByRole("columnheader")
    expect(headers.map((h) => h.textContent)).toEqual(["Term", "Atlas Logistics", "Northwind Freight", "Kestrel Cargo"])
    for (const h of headers) expect(h).toHaveAttribute("scope", "col")
    expect(headers[1].className).toContain("font-headline")
    const rowHeaders = screen.getAllByRole("rowheader")
    expect(rowHeaders.map((h) => h.textContent)).toEqual([
      "Initial term",
      "Auto-renewal",
      "Termination notice",
      "Liability cap",
      "SLA credits",
      "EU data residency",
      "Price escalation",
    ])
    for (const h of rowHeaders) expect(h).toHaveAttribute("scope", "row")
  })

  it("exactly one glyph badge per option cell, with the verdict word for screen readers", () => {
    render(<ComparisonArtifact record={rec(comparisonContracts)} />)
    const cells = optionCells()
    expect(cells).toHaveLength(21)
    for (const cell of cells) {
      const badges = within(cell).getAllByTestId("verdict-badge")
      expect(badges).toHaveLength(1)
      expect(["Favourable", "Unfavourable", "Neutral", "Not stated"]).toContain(
        within(badges[0]).getByTestId("verdict-word").textContent,
      )
    }
    // Termination notice: Atlas n (90 days), Northwind y (30 days), Kestrel m (60 days).
    const termination = cells.slice(6, 9)
    expect(termination.map((c) => within(c).getByTestId("verdict-word").textContent)).toEqual([
      "Unfavourable",
      "Favourable",
      "Neutral",
    ])
    expect(termination.map((c) => within(c).getByTestId("verdict-badge").getAttribute("data-verdict"))).toEqual(["n", "y", "m"])
  })

  it("a q cell reads italic Not stated even when the model sent text; no td is ever blank", () => {
    const m = mutable(comparisonContracts)
    m.spec.comparison.terms[4].cells[1].text = "Up to 50% of everything"
    render(<ComparisonArtifact record={rec(m)} />)
    const sla = optionCells()[13] // SLA credits × Northwind (q)
    const text = within(sla).getByTestId("cell-text")
    expect(text.textContent).toBe("Not stated")
    expect(text.className).toContain("italic")
    expect(sla.textContent).not.toContain("50%")
    for (const td of screen.getByRole("table").querySelectorAll("td")) {
      expect((td.textContent ?? "").trim().length).toBeGreaterThan(0)
    }
  })

  it("a y / n / m cell with no text reads its verdict word", () => {
    const m = mutable(comparisonContracts)
    m.spec.comparison.terms[0].cells[0].text = null
    render(<ComparisonArtifact record={rec(m)} />)
    expect(within(optionCells()[0]).getByTestId("cell-text").textContent).toBe("Neutral")
  })

  it("model text renders as text", () => {
    const m = mutable(comparisonContracts)
    m.spec.comparison.terms[0].cells[1].text = "<b>x</b>"
    m.spec.comparison.options[0] = "<img src=x onerror=alert(1)>"
    const { container } = render(<ComparisonArtifact record={rec(m)} />)
    expect(container.querySelector("b")).toBeNull()
    expect(container.querySelector("img")).toBeNull()
    expect(container.textContent).toContain("<b>x</b>")
  })

  it("the legend names the four verdicts in the sketch's words", () => {
    render(<ComparisonArtifact record={rec(comparisonContracts)} />)
    // The `?` is the not-stated badge's glyph mark (lucide draws the other three).
    expect(screen.getByTestId("comparison-legend").textContent).toBe("FavourableUnfavourableNeutral?Not stated")
  })

  it("the term column is sticky", () => {
    render(<ComparisonArtifact record={rec(comparisonContracts)} />)
    const first = screen.getAllByRole("rowheader")[0]
    expect(first.className).toContain("sticky")
    expect(first.className).toContain("left-0")
    expect(first.className).toContain("bg-card")
  })
})

describe("ComparisonArtifact — Only terms that differ", () => {
  it("with no identical term the toggle is disabled and says why", () => {
    render(<ComparisonArtifact record={rec(comparisonContracts)} />)
    const toggle = screen.getByRole("button", { name: "Only terms that differ" })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute("title", "No term is the same across every option.")
    expect(toggle).toHaveAttribute("aria-pressed", "false")
  })

  it("identical rows are dimmed at rest; the toggle removes exactly them and counts them", () => {
    render(<ComparisonArtifact record={rec(withIdentical())} />)
    expect(bodyRows()).toHaveLength(7)
    const dimmed = bodyRows().filter((r) => r.getAttribute("data-identical") === "true")
    expect(dimmed.map((r) => within(r).getByRole("rowheader").textContent)).toEqual(["Liability cap", "EU data residency"])
    const toggle = screen.getByRole("button", { name: "Only terms that differ" })
    expect(toggle).toBeEnabled()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-pressed", "true")
    expect(bodyRows()).toHaveLength(5)
    expect(screen.getAllByRole("rowheader").map((h) => h.textContent)).not.toContain("Liability cap")
    expect(screen.getByRole("status").textContent).toBe("2 identical terms hidden")
    fireEvent.click(toggle)
    expect(bodyRows()).toHaveLength(7)
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("one identical term reads `1 identical term hidden`", () => {
    const m = mutable(comparisonContracts)
    m.spec.comparison.terms[3].cells = [0, 1, 2].map(() => ({ verdict: "y", text: "12 months’ fees", source: null }))
    render(<ComparisonArtifact record={rec(m)} />)
    fireEvent.click(screen.getByRole("button", { name: "Only terms that differ" }))
    expect(screen.getByRole("status").textContent).toBe("1 identical term hidden")
  })

  it("every term identical, toggle on → one colSpan row says so", () => {
    const m = mutable(comparisonContracts)
    m.spec.comparison.terms = m.spec.comparison.terms.slice(0, 2).map((t: { name: string }) => ({
      name: t.name,
      cells: [0, 1, 2].map(() => ({ verdict: "m", text: "Same", source: null })),
    }))
    m.row_count = 2
    m.caption.row_count = 2
    render(<ComparisonArtifact record={rec(m)} />)
    fireEvent.click(screen.getByRole("button", { name: "Only terms that differ" }))
    const rows = bodyRows()
    expect(rows).toHaveLength(1)
    const td = within(rows[0]).getByRole("cell")
    expect(td).toHaveAttribute("colspan", "4")
    expect(td.textContent).toBe("Every term is the same across these options.")
    expect(screen.getAllByRole("columnheader")).toHaveLength(4)
  })
})

describe("ComparisonArtifact — keyboard and the source tooltip", () => {
  it("the matrix is one tab stop; arrows move in 2-D skipping the term column; Home / End; Ctrl+Home / End", () => {
    render(<ComparisonArtifact record={rec(comparisonContracts)} />)
    const cells = optionCells()
    expect(cells.filter((c) => c.tabIndex === 0)).toEqual([cells[0]])
    act(() => cells[0].focus())
    fireEvent.keyDown(cells[0], { key: "ArrowRight" })
    expect(document.activeElement).toBe(cells[1])
    fireEvent.keyDown(cells[1], { key: "ArrowDown" })
    expect(document.activeElement).toBe(cells[4])
    fireEvent.keyDown(cells[4], { key: "ArrowLeft" })
    expect(document.activeElement).toBe(cells[3])
    fireEvent.keyDown(cells[3], { key: "ArrowLeft" })
    expect(document.activeElement).toBe(cells[3]) // never onto the term column
    fireEvent.keyDown(cells[3], { key: "End" })
    expect(document.activeElement).toBe(cells[5])
    fireEvent.keyDown(cells[5], { key: "Home" })
    expect(document.activeElement).toBe(cells[3])
    fireEvent.keyDown(cells[3], { key: "End", ctrlKey: true })
    expect(document.activeElement).toBe(cells[20])
    fireEvent.keyDown(cells[20], { key: "ArrowUp" })
    expect(document.activeElement).toBe(cells[17])
    fireEvent.keyDown(cells[17], { key: "Home", ctrlKey: true })
    expect(document.activeElement).toBe(cells[0])
    expect(optionCells().filter((c) => c.tabIndex === 0)).toEqual([cells[0]])
  })

  it("a sourced cell shows its clause on focus and on hover; Escape hides it", () => {
    render(<ComparisonArtifact record={rec(comparisonContracts)} />)
    const cells = optionCells()
    const atlasTermination = cells[6]
    act(() => atlasTermination.focus())
    const tip = screen.getByRole("tooltip")
    expect(tip.id).toBe("a_cmp7x2k9q1-tip")
    expect(atlasTermination).toHaveAttribute("aria-describedby", "a_cmp7x2k9q1-tip")
    expect(tip.textContent).toContain("Atlas_MSA_2023.pdf")
    expect(tip.textContent).toContain("“…by written notice at least ninety (90) days before the end of the then-current term.”")
    fireEvent.keyDown(atlasTermination, { key: "Escape" })
    expect(screen.queryByRole("tooltip")).toBeNull()
    act(() => atlasTermination.blur())
    fireEvent.pointerEnter(cells[7])
    expect(screen.getByRole("tooltip").textContent).toContain("Northwind_MSA_2024.pdf")
    fireEvent.pointerLeave(cells[7])
    expect(screen.queryByRole("tooltip")).toBeNull()
  })

  it("a cell with no source shows no tooltip", () => {
    render(<ComparisonArtifact record={rec(comparisonContracts)} />)
    fireEvent.pointerEnter(optionCells()[1])
    expect(screen.queryByRole("tooltip")).toBeNull()
  })
})
