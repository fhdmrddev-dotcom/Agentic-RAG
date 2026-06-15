/**
 * Phase 095 Plan 01 Task 2 — tests for the D-07 single per-extension
 * file-icon module.
 *
 * `fileIcon(filename, sizePx?)` is THE one shared icon every output-file card
 * reuses (no second icon system — resolves SKETCH-CONSISTENCY G1). It maps an
 * extension to a Lucide glyph + a colored `.{EXT}` ribbon label, rendered as
 * PLAIN TEXT only (the filename is model/user-derived — XSS guard T-095-01-01:
 * never `dangerouslySetInnerHTML`, never interpolated into markup).
 *
 * Coverage (095-VALIDATION.md D-07 hero file row):
 *  - .pptx → Presentation glyph + ".PPTX" label
 *  - .pdf  → text/file glyph + ".PDF" label
 *  - .png  → Image glyph + ".PNG" label
 *  - .csv  → Table glyph + ".CSV" label
 *  - no extension → default + ".FILE" label
 *  - uppercase / mixed-case extension is normalised
 *  - children are plain text — no raw HTML injected (XSS guard)
 */
import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { fileIcon } from "../fileIcon"

describe("fileIcon", () => {
  it("renders the .PPTX ribbon label for a pptx file", () => {
    const { getByText } = render(fileIcon("deck.pptx"))
    expect(getByText(".PPTX")).toBeTruthy()
  })

  it("renders the .PDF ribbon label for a pdf file", () => {
    const { getByText } = render(fileIcon("report.pdf"))
    expect(getByText(".PDF")).toBeTruthy()
  })

  it("renders the .PNG ribbon label for a png file", () => {
    const { getByText } = render(fileIcon("chart.png"))
    expect(getByText(".PNG")).toBeTruthy()
  })

  it("renders the .CSV ribbon label for a csv file", () => {
    const { getByText } = render(fileIcon("data.csv"))
    expect(getByText(".CSV")).toBeTruthy()
  })

  it("renders the .DOCX ribbon label for a docx file", () => {
    const { getByText } = render(fileIcon("memo.docx"))
    expect(getByText(".DOCX")).toBeTruthy()
  })

  it("renders the .JSON ribbon label for a json file", () => {
    const { getByText } = render(fileIcon("payload.json"))
    expect(getByText(".JSON")).toBeTruthy()
  })

  it("falls back to .FILE for a name with no extension", () => {
    const { getByText } = render(fileIcon("notes"))
    expect(getByText(".FILE")).toBeTruthy()
  })

  it("normalises a mixed/upper-case extension", () => {
    const { getByText } = render(fileIcon("DECK.PPTX"))
    expect(getByText(".PPTX")).toBeTruthy()
  })

  it("renders an svg glyph element (Lucide icon, not a raw string)", () => {
    const { container } = render(fileIcon("report.pdf"))
    expect(container.querySelector("svg")).toBeTruthy()
  })

  it("renders the filename only as a parsed extension label — never injects raw HTML (XSS guard)", () => {
    // A hostile filename must NOT produce a live <img> / <script> node; only
    // the parsed extension label (".PNG") may appear, as text.
    const hostile = `evil<img src=x onerror=alert(1)>.png`
    const { container, getByText } = render(fileIcon(hostile))
    // no injected hostile elements
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("script")).toBeNull()
    // the only rendered text is the parsed ext ribbon
    expect(getByText(".PNG")).toBeTruthy()
    // the raw filename text must not be rendered anywhere
    expect(container.textContent ?? "").not.toContain("evil<img")
  })

  it("honors a custom size when provided", () => {
    const { container } = render(fileIcon("report.pdf", 48))
    const svg = container.querySelector("svg")
    expect(svg?.getAttribute("width")).toBe("48")
    expect(svg?.getAttribute("height")).toBe("48")
  })
})
