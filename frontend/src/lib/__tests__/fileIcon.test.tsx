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

/**
 * ── Phase 195 Plan 03 Task 1 — the WIDENING's own coverage ──────────────────
 *
 * ADDITIONS ONLY. Every one of the 11 cases above is untouched: they are the
 * proof that the third parameter defaults to today's behaviour and that the
 * shipped chat call site (`OutputFileCard.tsx:83`, `fileIcon(file.filename, 30)`)
 * cannot have moved.
 *
 * ⚠ COLOUR-ADJACENT ASSERTIONS ARE ON THE INLINE `style` ATTRIBUTE'S PRESENCE,
 * never on a resolved `rgb()`. jsdom renders the DARK theme, where
 * `--muted-foreground` and `--panel-muted-foreground` are IDENTICAL
 * (`index.css:105`/`:151`, both `220 16% 65%`) and only DIVERGE in light
 * (`:30` `220 9% 46%` vs `:59` `220 12% 40%`). A resolved-colour fence would
 * therefore pass green in jsdom while a light-theme AA regression shipped.
 * `tone: "inherit"` is asserted as "no inline colour at all", which is a
 * property of the markup and is theme-independent.
 */
describe("fileIcon — Phase 195 widening (ribbon / tone / className / mimeType)", () => {
  const wrapperOf = (c: HTMLElement) => c.firstElementChild as HTMLElement
  const glyphOf = (c: HTMLElement) => c.querySelector("svg")

  describe("ribbon", () => {
    it("renders the .EXT ribbon by DEFAULT (positive control for the opt-out below)", () => {
      const { getByText } = render(fileIcon("deck.pptx", 30))
      expect(getByText(".PPTX")).toBeTruthy()
    })

    it("ribbon:false omits the .EXT label span entirely (the 16px monochrome panel/run glyph)", () => {
      const { container, queryByText } = render(fileIcon("deck.pptx", 16, { ribbon: false }))
      expect(queryByText(".PPTX")).toBeNull()
      // the glyph itself must survive — only the label span goes
      expect(glyphOf(container)).toBeTruthy()
      // and the wrapper must hold exactly ONE child (the glyph), no empty span
      expect(wrapperOf(container).children).toHaveLength(1)
    })
  })

  describe("tone", () => {
    it('tone defaults to "category" — an inline colour IS painted on the wrapper (positive control)', () => {
      const { container } = render(fileIcon("deck.pptx", 30))
      // assert PRESENCE of an inline colour, not its resolved value
      expect(wrapperOf(container).style.color).not.toBe("")
    })

    it('tone:"inherit" paints NO inline colour on the wrapper — the caller\'s token class wins', () => {
      const { container } = render(fileIcon("deck.pptx", 16, { tone: "inherit" }))
      expect(wrapperOf(container).style.color).toBe("")
    })

    it('tone:"inherit" paints NO inline colour on the RIBBON either (both sites, not just the wrapper)', () => {
      const { getByText } = render(fileIcon("deck.pptx", 16, { tone: "inherit", ribbon: true }))
      const label = getByText(".PPTX") as HTMLElement
      expect(label.style.color).toBe("")
      // the ribbon keeps its computed font-size — only the colour is dropped
      expect(label.style.fontSize).not.toBe("")
    })

    it('tone:"category" paints an inline colour on the ribbon (the inherit case\'s positive control)', () => {
      const { getByText } = render(fileIcon("deck.pptx", 30))
      expect((getByText(".PPTX") as HTMLElement).style.color).not.toBe("")
    })
  })

  describe("className", () => {
    it("className reaches the wrapper span and does not displace the built-in layout classes", () => {
      const { container } = render(
        fileIcon("deck.pptx", 16, { className: "text-panel-muted-foreground" }),
      )
      const wrapper = wrapperOf(container)
      expect(wrapper.className).toContain("text-panel-muted-foreground")
      expect(wrapper.className).toContain("inline-flex")
    })
  })

  describe("the NINE added code extensions (the measured regression fix)", () => {
    // `195-02-SUMMARY.md` recorded these resolving to `FileCode` in the panel
    // TODAY and falling to `FileText` under the un-widened `fileIcon`.
    const ADDED = ["sh", "bash", "sql", "yml", "yaml", "css", "jsx", "mjs", "tsx"]
    for (const ext of ADDED) {
      it(`.${ext} resolves to the Code glyph, not the FileText default`, () => {
        const { container } = render(fileIcon(`script.${ext}`, 16, { ribbon: false }))
        const svg = glyphOf(container)
        expect(svg?.classList.contains("lucide-code")).toBe(true)
        expect(svg?.classList.contains("lucide-file-text")).toBe(false)
      })
    }

    it("NEGATIVE CONTROL: an extension still absent from the map falls to the FileText default", () => {
      // Proves the nine cases above are measuring the MAP and not a default that
      // happens to be Code — without this, dropping all nine rows could still
      // read green if the fallback ever changed.
      const { container } = render(fileIcon("archive.zzz", 16, { ribbon: false }))
      const svg = glyphOf(container)
      expect(svg?.classList.contains("lucide-file-text")).toBe(true)
      expect(svg?.classList.contains("lucide-code")).toBe(false)
    })
  })

  describe("mimeType — mime-first resolution (mirrors FilesSection.tsx:52-71)", () => {
    it('{mimeType:"text/csv"} on a name with NO extension resolves to the table glyph', () => {
      const { container } = render(fileIcon("export", 16, { ribbon: false, mimeType: "text/csv" }))
      expect(glyphOf(container)?.classList.contains("lucide-table")).toBe(true)
    })

    it('{mimeType:"image/png"} on a name with NO extension resolves to the image glyph', () => {
      const { container } = render(fileIcon("capture", 16, { ribbon: false, mimeType: "image/png" }))
      expect(glyphOf(container)?.classList.contains("lucide-image")).toBe(true)
    })

    it("NEGATIVE CONTROL: the SAME extensionless names with no mimeType fall to the default glyph", () => {
      const csv = render(fileIcon("export", 16, { ribbon: false }))
      expect(glyphOf(csv.container)?.classList.contains("lucide-file-text")).toBe(true)
      const png = render(fileIcon("capture", 16, { ribbon: false }))
      expect(glyphOf(png.container)?.classList.contains("lucide-file-text")).toBe(true)
    })

    it("the OOXML docx mime resolves to the document glyph on an extensionless name", () => {
      const { container } = render(
        fileIcon("attachment", 16, {
          ribbon: false,
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      )
      expect(glyphOf(container)?.classList.contains("lucide-file-text")).toBe(true)
    })

    it("the OOXML pptx mime resolves to the slides glyph on an extensionless name", () => {
      const { container } = render(
        fileIcon("attachment", 16, {
          ribbon: false,
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }),
      )
      expect(glyphOf(container)?.classList.contains("lucide-presentation")).toBe(true)
    })

    it("the OOXML xlsx mime resolves to the table glyph on an extensionless name", () => {
      const { container } = render(
        fileIcon("attachment", 16, {
          ribbon: false,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      )
      expect(glyphOf(container)?.classList.contains("lucide-table")).toBe(true)
    })

    it('"text/x-python" resolves to the code glyph; a bare "text/plain" falls through to document', () => {
      const code = render(fileIcon("script", 16, { ribbon: false, mimeType: "text/x-python" }))
      expect(glyphOf(code.container)?.classList.contains("lucide-code")).toBe(true)
      const doc = render(fileIcon("notes", 16, { ribbon: false, mimeType: "text/plain" }))
      expect(glyphOf(doc.container)?.classList.contains("lucide-file-text")).toBe(true)
    })

    it('⚠ the bare "text/" fallthrough must NOT outrank the extension map — script.py + text/plain is CODE', () => {
      // This is the regression a literally-mime-first ordering would have shipped.
      // The panel checks `codeExts.includes(ext)` BEFORE its bare `text/` arm
      // (`FilesSection.tsx:62-69`), so a python file served as text/plain is a
      // CODE glyph there and must stay one here.
      const { container } = render(fileIcon("script.py", 16, { ribbon: false, mimeType: "text/plain" }))
      expect(glyphOf(container)?.classList.contains("lucide-code")).toBe(true)
      expect(glyphOf(container)?.classList.contains("lucide-file-text")).toBe(false)
    })

    it("an unknown mime with a known extension still resolves by extension", () => {
      const { container } = render(
        fileIcon("data.csv", 16, { ribbon: false, mimeType: "application/octet-stream" }),
      )
      expect(glyphOf(container)?.classList.contains("lucide-table")).toBe(true)
    })
  })

  describe("prototype-pollution guard (T-195-03-03)", () => {
    it("a file named x.constructor renders without throwing and yields the DEFAULT glyph", () => {
      // Without the own-property guard, `EXT_MAP["constructor"]` is the `Object`
      // FUNCTION — never nullish, so `?? DEFAULT_SPEC` does not fire and the
      // destructured `Glyph` is `undefined`: a hard render crash of the row.
      // `phaseGlyph.tsx:107-122` records this exact crash on a sibling map.
      expect(() => render(fileIcon("x.constructor", 16, { ribbon: false }))).not.toThrow()
      const { container } = render(fileIcon("x.constructor", 16, { ribbon: false }))
      expect(glyphOf(container)?.classList.contains("lucide-file-text")).toBe(true)
    })

    it("x.toString and x.__proto__ are likewise inert (the guard is total, not constructor-special)", () => {
      for (const name of ["x.toString", "x.__proto__", "x.hasOwnProperty"]) {
        expect(() => render(fileIcon(name, 16, { ribbon: false }))).not.toThrow()
      }
    })
  })

  describe("XSS (T-195-03-02) — the widening must not add a raw-filename path", () => {
    it("a hostile filename renders the ribbon as the PARSED extension only", () => {
      const { container, getByText } = render(fileIcon("<b>x</b>.docx", 30))
      expect(getByText(".DOCX")).toBeTruthy()
      expect(container.querySelector("b")).toBeNull()
      expect(container.textContent ?? "").not.toContain("<b>")
    })

    it("className is a class attribute, never markup — a hostile className cannot inject an element", () => {
      const { container } = render(
        fileIcon("deck.pptx", 16, { className: '"><img src=x onerror=alert(1)>' }),
      )
      expect(container.querySelector("img")).toBeNull()
    })
  })
})
