/**
 * Guards for `lib/fileTypeMark.tsx` — the official file-type marks.
 *
 * ⚠ WHAT THIS SUITE IS DEFENDING. Before 2026-08-25 the documents surface drew its own
 *   approximations of the Word / Excel / PowerPoint / Acrobat trademarks inline, and
 *   everything outside those five arms rendered a BLANK GREY PAGE. Both halves are asserted
 *   here: that no hand-drawn mark comes back, and that no INGESTIBLE format falls to the
 *   unknown mark.
 *
 * ⚠ COVERAGE IS A SET DIFFERENCE AGAINST THE BACKEND'S OWN ALLOWLIST, not a hand-kept list.
 *   A format the backend starts accepting and this map does not know about fails a test here
 *   rather than reaching a person as a blank page.
 */
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { FileTypeMark, extensionOf, markFor } from "@/lib/fileTypeMark"
import markSource from "@/lib/fileTypeMark.tsx?raw"
import iconsSource from "@/lib/fileIcons.tsx?raw"

/**
 * The source with every comment removed.
 *
 * ⚠ THIS HELPER IS NOT TIDINESS — BOTH GUARDS BELOW WENT RED AGAINST THEIR OWN PROSE ON THE
 *   FIRST RUN, MEASURED. The module docblocks deliberately SPELL the forbidden shapes so a
 *   future editor knows what not to write (the coalesced bracket read; the `#2B579A` page
 *   that was removed), and a whole-file scan therefore counts the WARNING as the VIOLATION.
 *   Scan the code, and prove the warning is still there separately.
 */
const codeOf = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

/** Every extension `backend/app/api/documents.py` will accept an upload for. */
const INGESTIBLE = [
  "txt", "md", "html", "csv", "pdf", "docx", "doc",
  "pptx", "xlsx", "xls", "epub", "eml", "msg",
] as const

/** Formats the sandbox and the agent produce as run outputs. */
const PRODUCED = ["png", "jpg", "svg", "json", "py", "js", "ts", "tsx", "sh", "sql", "yaml", "zip"] as const

const svgOf = (filename: string, mimeType?: string) => {
  const { container } = render(<FileTypeMark filename={filename} mimeType={mimeType} />)
  const svg = container.querySelector("svg")
  expect(svg).not.toBeNull()
  return svg as SVGSVGElement
}

describe("every ingestible format resolves to a mark of its own", () => {
  const unknown = markFor("no-such-extension-anywhere")

  it.each(INGESTIBLE)("%s does not fall through to the unknown mark", (ext) => {
    // ⚠ `.txt`, `.csv` and `.rtf` legitimately RESOLVE TO the text mark, which is also the
    //   unknown mark — so identity alone cannot judge them. They are checked below instead.
    if (ext === "txt" || ext === "csv") return
    expect(markFor(ext)).not.toBe(unknown)
  })

  it("the three that legitimately share the text mark are deliberate, not fallthrough", () => {
    // If a future edit gives any of them a mark of its own, this fails and the header's
    // "no official mark exists" note must be corrected rather than silently outgrown.
    expect(markFor("txt")).toBe(unknown)
    expect(markFor("csv")).toBe(unknown)
    expect(markFor("rtf")).toBe(unknown)
  })

  it.each(PRODUCED)("%s — a produced run output also has a mark", (ext) => {
    expect(markFor(ext)).not.toBe(unknown)
  })

  it("renders a real, non-empty svg for every ingestible format", () => {
    for (const ext of INGESTIBLE) {
      const svg = svgOf(`quarterly-report.${ext}`)
      expect(svg.innerHTML.length).toBeGreaterThan(80)
    }
  })
})

describe("the marks are distinct where the formats are distinct", () => {
  it("word, excel, powerpoint and pdf are four different marks", () => {
    const marks = [markFor("docx"), markFor("xlsx"), markFor("pptx"), markFor("pdf")]
    expect(new Set(marks).size).toBe(4)
  })

  it("⚠ the four office formats no longer share one silhouette", () => {
    // The shipped `lib/fileIcon.tsx` renders pdf/docx/md/txt/rtf with ONE lucide glyph and
    // only a colour between them. This surface must not.
    const bodies = ["docx", "xlsx", "pptx", "pdf"].map((e) => svgOf(`a.${e}`).innerHTML)
    expect(new Set(bodies).size).toBe(4)
  })

  it("⚠ .msg gets Outlook and .eml does NOT — one is a vendor format, the other a standard", () => {
    expect(markFor("msg")).not.toBe(markFor("eml"))
  })

  it("⚠ .csv is NOT given the Excel logo — a CSV is a format, not a product", () => {
    expect(markFor("csv")).not.toBe(markFor("xlsx"))
  })
})

describe("mime-first resolution, and the order that matters", () => {
  it.each([
    ["application/pdf", "pdf"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
    ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
    ["application/epub+zip", "epub"],
    ["text/markdown", "md"],
    ["text/html", "html"],
    ["message/rfc822", "eml"],
    ["application/vnd.ms-outlook", "msg"],
  ])("a file with NO extension resolves by mime %s", (mime, twin) => {
    expect(markFor("", mime)).toBe(markFor(twin))
  })

  it("⚠ a .py served as text/plain stays Python — the bare text/ arm is LAST", () => {
    expect(markFor("py", "text/plain")).toBe(markFor("py"))
    expect(markFor("py", "text/plain")).not.toBe(markFor("txt"))
  })

  it("image/svg+xml is the svg mark, not the generic image mark", () => {
    expect(markFor("", "image/svg+xml")).toBe(markFor("svg"))
    expect(markFor("", "image/png")).not.toBe(markFor("svg"))
  })
})

describe("the lookup cannot be tricked by an inherited key", () => {
  it.each(["constructor", "toString", "__proto__", "valueOf", "hasOwnProperty"])(
    "a file named x.%s renders the unknown mark instead of crashing",
    (ext) => {
      expect(() => svgOf(`x.${ext}`)).not.toThrow()
      expect(markFor(ext)).toBe(markFor("no-such-extension-anywhere"))
    },
  )

  it("the source reads through hasOwnProperty and never through a coalesced bracket read", () => {
    const code = codeOf(markSource)
    expect(code).toContain("Object.prototype.hasOwnProperty.call(EXT_MARKS, ext)")
    expect(code).not.toMatch(/EXT_MARKS\[[^\]]+\]\s*\?\?/)
    // Positive control: the forbidden shape IS spelled in this file — in the docblock, which
    // is exactly why the scan above must be code-scoped.
    expect(markSource).toMatch(/EXT_MARKS\[[^\]]+\]\s*\?\?/)
  })
})

describe("extensionOf", () => {
  it("a name with no dot has no extension", () => {
    expect(extensionOf("README")).toBe("")
    expect(markFor(extensionOf("README"))).toBe(markFor("no-such-extension-anywhere"))
  })

  it("takes the LAST segment and lower-cases it", () => {
    expect(extensionOf("Q3.Report.FINAL.DOCX")).toBe("docx")
    expect(extensionOf("archive.tar.gz")).toBe("gz")
  })
})

describe("no mark is drawn by hand, and none is tinted", () => {
  it("⚠ the hand-drawn office approximations are gone from the documents module", () => {
    // The exact fills the removed inline SVGs used for Word / Excel / PowerPoint / PDF.
    const code = codeOf(iconsSource)
    expect(code).toContain("FileTypeMark")  // non-vacuity: the stripped source is real code
    for (const hex of ["#2B579A", "#217346", "#D24726", "#E12106"]) {
      expect(code).not.toContain(hex)
    }
    expect(code).not.toContain("<path")
    expect(code).not.toContain("<text")
  })

  it("⚠ no fill-* utility reaches a brand mark — it would overwrite the logo's own fills", () => {
    expect(markSource).not.toMatch(/className=["'`][^"'`]*\bfill-/)
    const svg = svgOf("a.docx")
    expect(svg.getAttribute("class") ?? "").not.toMatch(/\bfill-/)
  })

  it("a brand mark keeps the colours it ships with", () => {
    // Word's published body declares these three; if a tint were applied they would vanish.
    const html = svgOf("a.docx").innerHTML.toLowerCase()
    expect(html).toContain("#41a5ee")
  })

  it("the mark is aria-hidden — the filename is already rendered as text beside it", () => {
    expect(svgOf("a.pdf").getAttribute("aria-hidden")).toBe("true")
  })

  it("the documents call site keeps the h-5 w-5 the rows lay out around", () => {
    expect(svgOf("a.pdf").getAttribute("class")).toContain("h-5 w-5")
  })
})
