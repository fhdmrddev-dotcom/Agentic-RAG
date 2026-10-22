/**
 * Phase 291-04 — `DescribeReferencesSection`'s own suite (sketch 291-describe-files winner B,
 * UI-SPEC Surface 2).
 *
 * The references section is the template row's PEER: one question per section. It is
 * presentational — props in, callbacks out, no fetch — so every reading the hook can produce
 * is driven here without a server.
 *
 * The `?raw` spacing fence at the bottom is the one the UI-SPEC names: the section imports the
 * shipped row constants by name and types none of the off-grid literals itself.
 */
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DescribeReferencesSection, type DescribeReferencesSectionProps } from "./DescribeReferencesSection"
import referencesSectionSource from "./DescribeReferencesSection?raw"
import { NOTE_CLASSES, ROW_CLASSES } from "./surfaceClasses"
import {
  REFS_ACCEPT,
  REFS_FOOTING_READING,
  REFS_FULL,
  REFS_KEEP,
  REFS_LABEL,
  REFS_NOTE,
  REFS_POWERS,
  REFS_PROMPT,
  REFS_READING,
  REFS_READ_FULL,
  REFS_REMOVE,
  REFS_TYPES,
  SCAN_UNREADABLE,
  refsCount,
  refsRemoveLabel,
  refsSendFailed,
} from "./templateFirstVocabulary"

import type { DescribeReadState } from "./useTemplateFirstDraft"

afterEach(cleanup)

type ReadResult = Extract<DescribeReadState, { kind: "read" }>["result"]

function fileNamed(name: string): File {
  return new File(["bytes"], name, { type: "text/plain" })
}

function readOf(filename: string, over: Partial<ReadResult> = {}): DescribeReadState {
  return {
    kind: "read",
    result: {
      role: "reference",
      arm: "reference",
      suggested_from: null,
      filename,
      fields: [],
      unplaced: [],
      text: `text of ${filename}`,
      cut_short: null,
      refused: null,
      ...over,
    },
  }
}

const CUT = "Only the first 20,000 of 48,500 characters were read."

function renderSection(over: Partial<DescribeReferencesSectionProps> = {}) {
  const props: DescribeReferencesSectionProps = {
    references: [],
    notice: null,
    anyFileHeld: false,
    anyReading: false,
    onAddFiles: vi.fn(),
    onRemove: vi.fn(),
    ...over,
  }
  return { ...render(<DescribeReferencesSection {...props} />), props }
}

function five() {
  return ["a.md", "b.md", "c.md", "d.md", "e.md"].map((n) => ({ file: fileNamed(n), state: readOf(n) }))
}

describe("DescribeReferencesSection — the section at rest", () => {
  it("is ROW_CLASSES exactly, with the prompt, the note, the picker and the types", () => {
    renderSection()
    const row = screen.getByTestId("describe-reference-row")
    expect(row.className).toBe(ROW_CLASSES)
    expect(screen.getByTestId("describe-reference-prompt")).toHaveTextContent(REFS_PROMPT)
    expect(screen.getByTestId("describe-reference-note")).toHaveTextContent(REFS_NOTE)
    expect(screen.getByTestId("describe-reference-note").className).toBe(NOTE_CLASSES)
    expect(screen.getByTestId("describe-reference-types")).toHaveTextContent(REFS_TYPES)
  })

  it("the picker is a NATIVE multiple input with the reference types, labelled with the count", () => {
    renderSection()
    const input = screen.getByTestId("describe-reference-input") as HTMLInputElement
    expect(input.type).toBe("file")
    expect(input.multiple).toBe(true)
    expect(input).toHaveAttribute("accept", REFS_ACCEPT)
    expect(input).not.toBeDisabled()
    const label = screen.getByTestId("describe-reference-label")
    expect(label).toHaveTextContent(REFS_LABEL)
    expect(label).toHaveTextContent(refsCount(0))
    expect(screen.getByLabelText(new RegExp(REFS_LABEL))).toBe(input)
  })

  it("at rest it is QUIET: no footing, no powers line, no keep line (the 3-second read)", () => {
    renderSection()
    expect(screen.queryByTestId("describe-reference-footing")).toBeNull()
    expect(screen.queryByTestId("describe-reference-powers")).toBeNull()
    expect(screen.queryByTestId("describe-reference-keep")).toBeNull()
    expect(screen.queryByTestId("describe-reference-notice")).toBeNull()
  })

  it("ONE live region wraps the whole list, and nothing is an alert", () => {
    renderSection({ references: five().slice(0, 2), anyFileHeld: true })
    const regions = screen.getAllByRole("status")
    expect(regions).toHaveLength(1)
    expect(within(regions[0]).getByTestId("describe-reference-list")).toBeInTheDocument()
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })
})

describe("DescribeReferencesSection — one row per held file", () => {
  it("each row: 📎 (aria-hidden), the filename, and a Remove file button named for its file", async () => {
    const onRemove = vi.fn()
    renderSection({ references: five().slice(0, 2), anyFileHeld: true, onRemove })
    const rows = within(screen.getByTestId("describe-reference-list")).getAllByRole("listitem")
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent("a.md")
    expect(within(rows[0]).getByText("📎")).toHaveAttribute("aria-hidden", "true")
    const remove = within(rows[1]).getByRole("button", { name: refsRemoveLabel("b.md") })
    expect(remove).toHaveTextContent(REFS_REMOVE)
    expect(remove.className).toContain("min-h-6")
    await userEvent.click(remove)
    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it("the label counts the held files", () => {
    renderSection({ references: five().slice(0, 3), anyFileHeld: true })
    expect(screen.getByTestId("describe-reference-label")).toHaveTextContent(refsCount(3))
  })

  it.each([
    ["in flight", { kind: "loading" } as DescribeReadState, REFS_READING, "muted"],
    ["read whole", readOf("a.md"), REFS_READ_FULL, "muted"],
    ["cut short", readOf("a.md", { cut_short: CUT }), CUT, "foreground"],
    ["scan unreadable", readOf("a.md", { arm: "scan_unreadable", text: "" }), SCAN_UNREADABLE, "foreground"],
    ["could not be sent", { kind: "unavailable", reason: "unreachable", detail: null } as DescribeReadState, refsSendFailed("a.md"), "foreground"],
  ] as const)("reading — %s", (_name, state, text, tone) => {
    renderSection({ references: [{ file: fileNamed("a.md"), state }], anyFileHeld: true })
    const line = screen.getByTestId("describe-reference-reading")
    expect(line).toHaveTextContent(text)
    expect(line.className).toContain("pl-4")
    expect(line.className).toContain(tone === "muted" ? "text-muted-foreground" : "text-foreground")
    if (tone === "foreground") expect(line.className).not.toContain("text-muted-foreground")
    expect(line.className).not.toMatch(/warning|destructive|amber|red-|green-/)
  })
})

describe("DescribeReferencesSection — the rules (D-03, Pitfall 11)", () => {
  it("at 5 the picker is DISABLED and says why through aria-describedby", () => {
    renderSection({ references: five(), anyFileHeld: true })
    const input = screen.getByTestId("describe-reference-input")
    expect(input).toBeDisabled()
    expect(input.className).toContain("opacity-50")
    expect(input.className).toContain("pointer-events-none")
    const describedBy = input.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy ?? "")).toHaveTextContent(REFS_FULL)
    expect(screen.queryByText(REFS_TYPES)).toBeNull()
  })

  it("the notice line renders the hook's sentence as text, in the foreground, never as an alert", () => {
    renderSection({ notice: { kind: "overflow", text: "Only 5 references fit, so these weren't added: f.md." } })
    const notice = screen.getByTestId("describe-reference-notice")
    expect(notice).toHaveTextContent("Only 5 references fit, so these weren't added: f.md.")
    expect(notice.className).toContain("text-foreground")
    expect(notice).not.toHaveAttribute("role")
  })

  it("while ANY file reads the footing says the draft waits for them", () => {
    renderSection({ references: [{ file: fileNamed("a.md"), state: { kind: "loading" } }], anyFileHeld: true, anyReading: true })
    expect(screen.getByTestId("describe-reference-footing")).toHaveTextContent(REFS_FOOTING_READING)
  })

  it("the powers line, then the keep line, show only while a file is held anywhere on the door", () => {
    renderSection({ anyFileHeld: true })
    const powers = screen.getByTestId("describe-reference-powers")
    const keep = screen.getByTestId("describe-reference-keep")
    expect(powers).toHaveTextContent(REFS_POWERS)
    expect(keep).toHaveTextContent(REFS_KEEP)
    expect(powers.compareDocumentPosition(keep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("a multi-pick hands EVERY file up in one call and resets the native control first", async () => {
    const onAddFiles = vi.fn()
    renderSection({ onAddFiles })
    const input = screen.getByTestId("describe-reference-input") as HTMLInputElement
    const a = fileNamed("a.md")
    const b = fileNamed("b.txt")
    await userEvent.upload(input, [a, b])
    expect(onAddFiles).toHaveBeenCalledTimes(1)
    expect(onAddFiles.mock.calls[0][0]).toEqual([a, b])
    expect(input.value).toBe("")
  })
})

describe("DescribeReferencesSection — file-derived text is TEXT (T-291-30)", () => {
  it("a filename carrying markup renders visibly and creates no element", () => {
    const payload = '<img src=x onerror="alert(1)">.md'
    const { container } = renderSection({ references: [{ file: fileNamed(payload), state: readOf(payload) }], anyFileHeld: true })
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByText(payload)).toBeInTheDocument()
  })
})

describe("DescribeReferencesSection — source fences", () => {
  it("NON-VACUITY — the ?raw source really loaded", () => {
    expect(referencesSectionSource.length).toBeGreaterThan(1000)
    expect(referencesSectionSource).toContain("export function DescribeReferencesSection")
  })

  it("imports ROW_CLASSES, NOTE_CLASSES and FOOTING_CLASSES BY NAME from the one module", () => {
    const importLine = referencesSectionSource.match(/import\s*\{([^}]*)\}\s*from\s*"\.\/surfaceClasses"/)
    expect(importLine).not.toBeNull()
    for (const name of ["ROW_CLASSES", "NOTE_CLASSES", "FOOTING_CLASSES"]) {
      expect(importLine?.[1] ?? "").toMatch(new RegExp(`\\b${name}\\b`))
    }
  })

  it("types NONE of the off-grid literals itself", () => {
    for (const token of ["mt-1.5", "px-2.5", "py-[3px]", "pl-3", "px-3", "py-5", "text-[10.5px]"]) {
      expect(referencesSectionSource.includes(token), `the section types ${token}`).toBe(false)
    }
    // POSITIVE CONTROL — the containment check really fires on a planted literal.
    expect('className="mt-1.5"'.includes("mt-1.5")).toBe(true)
  })

  it("no raw-HTML escape hatch, no alert role, and NO network reach", () => {
    expect(referencesSectionSource).not.toMatch(/dangerously/i)
    expect(referencesSectionSource).not.toContain('role="alert"')
    expect(referencesSectionSource).not.toContain("@/lib/api")
    expect(/\bfetch\s*\(/.test(referencesSectionSource)).toBe(false)
  })
})
