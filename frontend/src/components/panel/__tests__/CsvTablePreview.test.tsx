/**
 * Phase 087 Plan 03 Task 1 — CsvTablePreview contract (PANEL-03, D-01).
 *
 * The one preview type with no existing renderer: a minimal in-panel <table>
 * rendered client-side from the CSV string, NO new dependency. Malformed /
 * too-large / XSS-payload CSV all fall back to the calm
 * "No preview available · Download" notice without throwing or breaking layout.
 *
 * Fixtures: mockCsvValid (incl. a quoted comma) + mockCsvMalformed.
 */
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { axe } from "vitest-axe"
import { CsvTablePreview } from "@/components/panel/CsvTablePreview"
import { mockCsvValid, mockCsvMalformed } from "./fixtures"

describe("CsvTablePreview (PANEL-03) — minimal <table>, no dependency", () => {
  it("renders a header row + one <tr> per data row from a valid CSV", () => {
    const { container } = render(<CsvTablePreview content={mockCsvValid} />)
    const table = container.querySelector("table")
    expect(table).toBeInTheDocument()

    // header row from the first CSV line
    const headerCells = container.querySelectorAll("thead th")
    expect(headerCells).toHaveLength(3)
    expect(headerCells[0]).toHaveTextContent("name")
    expect(headerCells[1]).toHaveTextContent("region")
    expect(headerCells[2]).toHaveTextContent("total")

    // 3 data rows (mockCsvValid has 3 records after the header)
    const bodyRows = container.querySelectorAll("tbody tr")
    expect(bodyRows).toHaveLength(3)
  })

  it("parses a quoted field containing a comma as a single cell ('Acme, Inc.' → one <td>)", () => {
    const { container } = render(<CsvTablePreview content={mockCsvValid} />)
    const firstBodyRow = container.querySelector("tbody tr")!
    const cells = within(firstBodyRow as HTMLElement).getAllByRole("cell")
    // 3 columns — the quoted comma must NOT split into a 4th cell
    expect(cells).toHaveLength(3)
    expect(cells[0]).toHaveTextContent("Acme, Inc.")
    expect(cells[1]).toHaveTextContent("West")
    expect(cells[2]).toHaveTextContent("1200")
  })

  it("renders cell text as plain text, never as HTML (no dangerouslySetInnerHTML)", () => {
    const xssCsv = 'col\n"<img src=x onerror=alert(1)>"\n'
    const { container } = render(<CsvTablePreview content={xssCsv} />)
    // the payload must be present as LITERAL text, not as a parsed <img>
    expect(container.querySelector("img")).toBeNull()
    expect(container).toHaveTextContent("<img src=x onerror=alert(1)>")
  })

  it("falls back to the calm 'No preview available · Download' notice on a malformed CSV (never crashes)", () => {
    const { container } = render(<CsvTablePreview content={mockCsvMalformed} />)
    expect(container.querySelector("table")).toBeNull()
    expect(screen.getByText(/No preview available/i)).toBeInTheDocument()
  })

  it("falls back to the calm notice when the CSV is too large to preview", () => {
    // >256_000 bytes short-circuits to the size fallback before building DOM
    const hugeCsv = "a,b,c\n" + "1,2,3\n".repeat(50_000)
    const { container } = render(<CsvTablePreview content={hugeCsv} />)
    expect(container.querySelector("table")).toBeNull()
    expect(screen.getByText(/File too large to preview/i)).toBeInTheDocument()
  })

  it("invokes onDownload from the fallback Download affordance", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const onDownload = (await import("vitest")).vi.fn()
    render(<CsvTablePreview content={mockCsvMalformed} onDownload={onDownload} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Download/i }))
    expect(onDownload).toHaveBeenCalledTimes(1)
  })

  // Phase 088-01 (D-13a) — structural a11y regression gate. The populated
  // <table> state AND the calm fallback. axe = STRUCTURE only (Pitfall 5 —
  // contrast is Plan 05 / Chrome MCP).
  it("has no axe violations (populated <table> state)", async () => {
    const { container } = render(<CsvTablePreview content={mockCsvValid} />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no axe violations (fallback notice state)", async () => {
    const { container } = render(<CsvTablePreview content={mockCsvMalformed} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
