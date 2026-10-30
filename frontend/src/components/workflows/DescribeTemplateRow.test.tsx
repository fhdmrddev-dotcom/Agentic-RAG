/**
 * Phase 193.1-06 Task 2 — `DescribeTemplateRow`'s own suite.
 *
 * ── THE THREE PROPERTIES THAT MATTER, AND WHY EACH IS MECHANISED ─────────────────────────
 *
 * 1. **NO ARM RENDERS ANY OTHER ARM'S NODE — every ordered pair.** This is the mechanised
 *    form of the inherited rule *these sentences may never merge*, and it is the reason each
 *    arm has its own testid. Sketch 166's own audit states it the same way and for the same
 *    reason: a surface that says "we found no fields" about a document nobody opened is the
 *    defect this phase exists to remove, and prose cannot prevent it. The pair list is DERIVED
 *    from the arm table, so a new arm inherits all of it the moment it is added.
 *
 * 2. **THE STATED COUNT EQUALS THE RENDERED LIST.** Asserted against the rendered items rather
 *    than against the fixture, so a hardcoded number cannot pass no matter which literal
 *    someone picked. Driven at THREE different lengths, including a 5-field document, because a
 *    hardcoded `8` beside a list of 5 is the exact silent lie the phase removes.
 *
 * 3. **ATTACKER-CONTROLLED DOCUMENT TEXT IS RENDERED AS TEXT.** Field names, labels and the
 *    lines around a blank come out of an uploaded document. The injection cases assert the
 *    payload is VISIBLE AS TEXT and that it produced no element — both halves, because either
 *    one alone is satisfiable by a component that dropped the name entirely.
 *
 * ── 291-04 (sketch 291-describe-files winner B, UI-SPEC Surface 1) ──────────────────────
 * The row became the FORM SLOT: it reads PDF forms, Word blanks and scans as well as `{{ }}`
 * templates, and renders the server's own arm. Every shipped case below was RE-POINTED to the
 * new reading union rather than deleted (the vitest count gate forbids a per-file decrease);
 * the new arms follow, appended.
 */
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DescribeTemplateRow } from "./DescribeTemplateRow"
// 199-08: this component's own SOURCE, so the "modified no byte / added no network" verdict
// is a checked property rather than a sentence in a summary.
import describeTemplateRowSource199 from "./DescribeTemplateRow?raw"
import { DESCRIBE_ATTACH_PROMPT } from "./doorVocabulary"
import {
  ATTACH_NOTE,
  DESCRIBE_FORM_ACCEPT,
  DESCRIBE_FORM_ATTACH_LABEL,
  DESCRIBE_FORM_TYPES_NOTE,
  DESCRIBE_READING,
  FIELD_SUGGESTED_TAG,
  FOOTING_FORM_UNAVAILABLE,
  FOOTING_NOT_WORD,
  FOOTING_READING_DOCUMENT,
  FOOTING_REFERENCE_ONLY,
  FOOTING_UNAVAILABLE,
  FOOTING_WITHOUT_IT,
  FORM_BACK_FLAT,
  FORM_FIELDS_HEADING,
  FORM_PROVENANCE_EXACT,
  FORM_PROVENANCE_SUGGESTED_SCAN,
  FORM_PROVENANCE_SUGGESTED_TEXT,
  FORM_UNAVAILABLE,
  PLACES_HEADING,
  PLACES_PROVENANCE,
  PLACE_STAYS_BLANK,
  SCAN_UNREADABLE,
  SPEC_FILENAME_LEAD,
  footingAsks,
  footingFields,
  formBackLinePdf,
  formBackLineWord,
  noFieldsLine,
  showAllLabel,
} from "./templateFirstVocabulary"
import {
  TEMPLATE_FIELDS_HEADING,
  TEMPLATE_FIELDS_NOT_WORD,
  TEMPLATE_FIELDS_UNAVAILABLE,
} from "./TemplateAttachSection"

import type { DescribeReadState } from "./useTemplateFirstDraft"

afterEach(cleanup)

type ReadResult = Extract<DescribeReadState, { kind: "read" }>["result"]
type Field = ReadResult["fields"][number]

/** The eight real field names, as parsed from a real document by quick task 260814-q5r. */
const EIGHT_FIELDS = [
  "accomplishments",
  "milestones",
  "overall_rag_status",
  "planned_next",
  "project_name",
  "reporting_period",
  "risks_blockers",
  "summary",
]

const noop = () => {}

function fieldOf(key: string, over: Partial<Field> = {}): Field {
  return {
    key,
    label: key,
    type: "text",
    enum_options: [],
    origin: "exact",
    line_before: null,
    line_after: null,
    anchor_kind: null,
    anchor_label: null,
    ...over,
  }
}

function read(over: Partial<ReadResult>): DescribeReadState {
  return {
    kind: "read",
    result: {
      role: "form",
      arm: "template_fields",
      suggested_from: null,
      filename: "weekly-status.docx",
      fields: [],
      unplaced: [],
      text: "",
      cut_short: null,
      refused: null,
      ...over,
    },
  }
}

/** Today's `{{ }}` template reading: the keys ARE the names. */
function templateRead(keys: string[]): DescribeReadState {
  return read({ arm: "template_fields", fields: keys.map((k) => fieldOf(k)) })
}

/** A fillable PDF form, read exactly: labels from `/TU`, raw qualified names behind them. */
const W9_FIELDS: Field[] = [
  fieldOf("topmostSubform[0].Page1[0].f1_01[0]", { label: "Name" }),
  fieldOf("topmostSubform[0].Page1[0].f1_02[0]", { label: "Business name" }),
  fieldOf("topmostSubform[0].Page1[0].c1_1[0]", { label: "Individual", type: "enum", enum_options: ["/1", "/Off"] }),
  fieldOf("topmostSubform[0].Page1[0].c1_2[0]", { label: "Exempt", type: "enum", enum_options: ["yes", "no"] }),
]
const formRead = (fields: Field[] = W9_FIELDS) =>
  read({ arm: "form_fields", filename: "w9.pdf", fields, text: "W-9" })

const CUT_SHORT = "Only the first 3 of 9 pages of this scan were read."
const suggestedRead = (from: "text" | "scan") =>
  read({
    arm: "suggested_fields",
    suggested_from: from,
    filename: "flat.pdf",
    fields: [
      fieldOf("vendor", { label: "Vendor", origin: "ai_proposed" }),
      fieldOf("amount", { label: "Amount", origin: "ai_proposed", type: "number" }),
    ],
    cut_short: from === "scan" ? CUT_SHORT : null,
  })

const UNPLACED_SENTENCE =
  "Couldn't place “Signature”: that label appears twice in the document. It stays blank in the filled copy."
const blanksRead = () =>
  read({
    arm: "blanks",
    filename: "supplier.docx",
    fields: [
      fieldOf("supplier_name", {
        label: "Supplier name",
        origin: "ai_proposed",
        line_before: "Supplier name: ",
        line_after: "",
        anchor_kind: "line",
        anchor_label: "Supplier name",
      }),
      fieldOf("vat_number", {
        label: "VAT number",
        origin: "ai_proposed",
        line_before: "VAT number: ",
        line_after: " (EU only)",
        anchor_kind: "line",
        anchor_label: "VAT number",
      }),
      fieldOf("start_date", {
        label: "Start date",
        origin: "ai_proposed",
        type: "date",
        anchor_kind: "cell",
        anchor_label: "Start date",
      }),
    ],
    unplaced: [{ label: "Signature", sentence: UNPLACED_SENTENCE }],
  })

const COPY_REFUSED_SENTENCE =
  "This document already contains {{ }} or {% %} marks that aren't fields, so a fillable copy can't be made from it. Remove them and attach it again."

function renderRow(
  state: DescribeReadState,
  filename: string | undefined = "weekly-status.docx",
  handlers: {
    onPickFile?: (f: File) => void
    onClear?: () => void
    untickedKeys?: readonly string[]
    onToggleBlank?: (key: string) => void
  } = {},
) {
  return render(
    <DescribeTemplateRow
      state={state}
      filename={filename}
      onPickFile={handlers.onPickFile ?? noop}
      onClear={handlers.onClear ?? noop}
      untickedKeys={handlers.untickedKeys}
      onToggleBlank={handlers.onToggleBlank}
    />,
  )
}

/**
 * EVERY READING ARM, each with the testids IT ALONE may render.
 *
 * ⚠ Testids two arms legitimately SHARE (the `📄 Drafting to` filename line, the form heading
 * line, the field grid) are not listed as either arm's own: an "own" testid is one whose
 * presence on another arm would be the merge this table exists to catch.
 */
const ARMS: {
  name: string
  state: DescribeReadState
  filename: string
  own: string[]
}[] = [
  { name: "loading", state: { kind: "loading" }, filename: "weekly-status.docx", own: ["describe-template-fields-loading"] },
  {
    name: "fields",
    state: templateRead(EIGHT_FIELDS),
    filename: "weekly-status.docx",
    own: ["describe-template-fields-heading", "describe-template-fields"],
  },
  { name: "form", state: formRead(), filename: "w9.pdf", own: ["describe-form-back"] },
  { name: "suggested", state: suggestedRead("scan"), filename: "flat.pdf", own: ["describe-form-back-flat", "describe-form-cut-short"] },
  {
    name: "blanks",
    state: blanksRead(),
    filename: "supplier.docx",
    own: ["describe-form-places", "describe-form-unplaced", "describe-form-back-word"],
  },
  { name: "none", state: read({ arm: "none" }), filename: "weekly-status.docx", own: ["describe-form-no-fields"] },
  { name: "notWord", state: read({ arm: "not_word", filename: "deck.pptx" }), filename: "deck.pptx", own: ["describe-template-fields-not-word"] },
  { name: "scan", state: read({ arm: "scan_unreadable", filename: "scan.pdf" }), filename: "scan.pdf", own: ["describe-form-scan-unreadable"] },
  {
    name: "copyRefused",
    state: read({ arm: "copy_refused", refused: COPY_REFUSED_SENTENCE }),
    filename: "weekly-status.docx",
    own: ["describe-form-copy-refused"],
  },
  {
    name: "unavailable",
    state: { kind: "unavailable", reason: "unreadable", detail: null },
    filename: "weekly-status.docx",
    own: ["describe-template-fields-unavailable"],
  },
  {
    name: "formUnavailable",
    state: { kind: "unavailable", reason: "unreadable", detail: "The document could not be read." },
    filename: "w9.pdf",
    own: ["describe-form-unavailable"],
  },
]

describe("DescribeTemplateRow — the control itself", () => {
  it("renders the prompt, the note, the picker and the accepted types", () => {
    renderRow({ kind: "idle" }, undefined)
    expect(screen.getByTestId("describe-template-prompt")).toHaveTextContent(DESCRIBE_ATTACH_PROMPT)
    expect(screen.getByTestId("describe-template-note")).toHaveTextContent(ATTACH_NOTE)
    // 291-04: the slot takes forms too, so its label, its types note and its filter are the
    // door's own — the rail keeps the shipped ones (UI-SPEC decision 3).
    expect(screen.getByTestId("describe-template-types")).toHaveTextContent(DESCRIBE_FORM_TYPES_NOTE)
    expect(screen.getByLabelText(DESCRIBE_FORM_ATTACH_LABEL)).toBe(screen.getByTestId("describe-template-input"))
    expect(screen.getByTestId("describe-template-input")).toHaveAttribute("accept", DESCRIBE_FORM_ACCEPT)
  })

  it("idle renders NO fields region and NO footing — silence when nothing is held", () => {
    renderRow({ kind: "idle" }, undefined)
    expect(screen.queryByTestId("describe-template-fields-region")).toBeNull()
    expect(screen.queryByTestId("describe-template-footing")).toBeNull()
    // …and no arm's node either, so idle cannot be mistaken for an answer.
    for (const arm of ARMS) {
      for (const testid of arm.own) expect(screen.queryByTestId(testid)).toBeNull()
    }
  })

  it("idle offers no clear control — there is nothing to remove", () => {
    renderRow({ kind: "idle" }, undefined)
    expect(screen.queryByTestId("describe-template-clear")).toBeNull()
  })

  it("hands the picked File straight up and performs no work of its own", async () => {
    const onPickFile = vi.fn()
    renderRow({ kind: "idle" }, undefined, { onPickFile })
    const file = new File(["x"], "w9.pdf", { type: "application/pdf" })
    await userEvent.upload(screen.getByTestId("describe-template-input"), file)
    expect(onPickFile).toHaveBeenCalledTimes(1)
    expect(onPickFile.mock.calls[0][0]).toBe(file)
  })

  it("the clear control appears once a document is held and calls back", async () => {
    const onClear = vi.fn()
    renderRow(templateRead(EIGHT_FIELDS), "weekly-status.docx", { onClear })
    await userEvent.click(screen.getByTestId("describe-template-clear"))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it("ONE live region across every non-idle arm — one announcement, not several", () => {
    for (const arm of ARMS) {
      cleanup()
      renderRow(arm.state, arm.filename)
      const regions = screen.getAllByTestId("describe-template-fields-region")
      expect(regions, `${arm.name} does not render exactly one region`).toHaveLength(1)
      expect(regions[0], `${arm.name}'s region is not a live region`).toHaveAttribute("role", "status")
      // …and never an alert: nothing on the door is an emergency.
      expect(document.querySelector('[role="alert"]'), `${arm.name} raised an alert`).toBeNull()
    }
  })
})

describe("DescribeTemplateRow — each arm renders its OWN sentence", () => {
  it("loading", () => {
    renderRow({ kind: "loading" })
    expect(screen.getByTestId("describe-template-fields-loading")).toHaveTextContent(DESCRIBE_READING)
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(FOOTING_READING_DOCUMENT)
  })

  it("fields — heading, the filename lead, and the list in the SERVER'S order", () => {
    renderRow(templateRead(EIGHT_FIELDS))
    expect(screen.getByTestId("describe-template-fields-heading")).toHaveTextContent(TEMPLATE_FIELDS_HEADING)
    expect(screen.getByTestId("describe-template-filename")).toHaveTextContent(SPEC_FILENAME_LEAD)
    expect(screen.getByTestId("describe-template-filename")).toHaveTextContent("weekly-status.docx")
    // ⚠ NEVER RE-SORTED — the order is part of the answer.
    const items = Array.from(screen.getByTestId("describe-template-fields").querySelectorAll("li")).map(
      (li) => li.textContent,
    )
    expect(items).toEqual(EIGHT_FIELDS)
  })

  it("none — the D-02 line names the file and the footing says it is a reference", () => {
    renderRow(read({ arm: "none" }), "weekly-status.docx")
    expect(screen.getByTestId("describe-form-no-fields")).toHaveTextContent(noFieldsLine("weekly-status.docx"))
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(FOOTING_REFERENCE_ONLY)
    // ⚠ AND NEITHER UNAVAILABLE NODE — the whole no-merge rule, at the node level.
    expect(screen.queryByTestId("describe-template-fields-unavailable")).toBeNull()
    expect(screen.getByTestId("describe-template-footing")).not.toHaveTextContent(FOOTING_UNAVAILABLE)
  })

  it("notWord — the server's arm, shown for a deck", () => {
    renderRow(read({ arm: "not_word", filename: "deck.pptx" }), "deck.pptx")
    expect(screen.getByTestId("describe-template-fields-not-word")).toHaveTextContent(TEMPLATE_FIELDS_NOT_WORD)
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(FOOTING_NOT_WORD)
    expect(screen.queryByTestId("describe-form-no-fields")).toBeNull()
  })

  it("⚠ notWord is gated on a DECK EXTENSION — a field-less PDF is never told only Word can be read", () => {
    // A deck that somehow DID yield fields renders its fields…
    renderRow(templateRead(["project_name"]), "deck.pptx")
    expect(screen.getByTestId("describe-template-fields")).toBeInTheDocument()
    expect(screen.queryByTestId("describe-template-fields-not-word")).toBeNull()
    cleanup()
    // …and a PDF with nothing in it gets the D-02 line, never the Word-only sentence.
    renderRow(read({ arm: "none", filename: "plain.pdf" }), "plain.pdf")
    expect(screen.getByTestId("describe-form-no-fields")).toBeInTheDocument()
    expect(screen.queryByTestId("describe-template-fields-not-word")).toBeNull()
  })

  it("unavailable", () => {
    renderRow({ kind: "unavailable", reason: "unreadable", detail: null })
    expect(screen.getByTestId("describe-template-fields-unavailable")).toHaveTextContent(TEMPLATE_FIELDS_UNAVAILABLE)
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(FOOTING_UNAVAILABLE)
    // ⚠ AND NEITHER NONE NODE.
    expect(screen.queryByTestId("describe-form-no-fields")).toBeNull()
    expect(screen.getByTestId("describe-template-footing")).not.toHaveTextContent(FOOTING_REFERENCE_ONLY)
  })

  it("both `unavailable` reasons render the SAME arm — the distinction is not shown", () => {
    renderRow({ kind: "unavailable", reason: "unreadable", detail: "The document could not be read." })
    const first = screen.getByTestId("describe-template-footing").textContent
    cleanup()
    renderRow({ kind: "unavailable", reason: "unreachable", detail: null })
    expect(screen.getByTestId("describe-template-footing").textContent).toBe(first)
  })
})

describe("DescribeTemplateRow — NO ARM RENDERS ANY OTHER ARM'S NODE (every ordered pair)", () => {
  const PAIRS = ARMS.flatMap((a) => ARMS.filter((b) => b.name !== a.name).map((b) => [a, b]))

  it("the pair list really is every ordered pair — non-vacuity before the negatives", () => {
    expect(ARMS).toHaveLength(11)
    expect(PAIRS).toHaveLength(11 * 10)
    for (const arm of ARMS) expect(arm.own.length).toBeGreaterThan(0)
  })

  it.each(PAIRS.map(([a, b]) => [a.name, b.name, a, b] as const))(
    "arm %s renders none of arm %s's nodes",
    (_aName, bName, a, b) => {
      renderRow(a.state, a.filename)
      // POSITIVE CONTROL, INLINE: arm A really did render ITS OWN nodes.
      for (const testid of a.own) {
        expect(screen.queryByTestId(testid), `${a.name} did not render its own ${testid}`).not.toBeNull()
      }
      for (const testid of b.own) {
        expect(screen.queryByTestId(testid), `${a.name} rendered ${bName}'s ${testid}`).toBeNull()
      }
    },
  )

  it("the footing lines are DISTINCT sentences across every arm", () => {
    const footings = ARMS.map((arm) => {
      cleanup()
      renderRow(arm.state, arm.filename)
      return screen.getByTestId("describe-template-footing").textContent ?? ""
    })
    // Three arms legitimately end on the SAME fact (the draft is written without the file):
    // a scan we could not read, and a Word file no copy can be made of. Everything else differs.
    expect(new Set(footings).size).toBe(ARMS.length - 1)
    for (const value of footings) expect(value.length).toBeGreaterThan(0)
  })
})

describe("DescribeTemplateRow — the stated count is DERIVED from the rendered list", () => {
  it.each([[1], [5], [8]])("a %i-field document states %i, counted from the list itself", (n) => {
    renderRow(templateRead(EIGHT_FIELDS.slice(0, n)))
    const rendered = screen.getByTestId("describe-template-fields").querySelectorAll("li").length
    expect(rendered).toBe(n)
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(footingFields(rendered))
    expect(screen.getByTestId("describe-template-footing").textContent).toContain(String(n))
  })

  it("⚠ a 5-field document says FIVE, never eight — the silent lie this phase removes", () => {
    renderRow(templateRead(EIGHT_FIELDS.slice(0, 5)))
    expect(screen.getByTestId("describe-template-fields").querySelectorAll("li")).toHaveLength(5)
    const footing = screen.getByTestId("describe-template-footing").textContent ?? ""
    expect(footing).toContain("5")
    expect(footing).not.toContain("8")
  })

  it("exactly ONE footing line renders on every arm — never two, never none", () => {
    for (const arm of ARMS) {
      cleanup()
      renderRow(arm.state, arm.filename)
      expect(screen.getAllByTestId("describe-template-footing"), `${arm.name} does not render exactly one footing`).toHaveLength(1)
    }
  })
})

describe("DescribeTemplateRow — document text is rendered as TEXT (T-193.1-06-01 / T-291-30)", () => {
  it("an HTML payload in a placeholder name renders visibly and creates no element", () => {
    const payload = '<img src=x onerror="alert(1)">'
    const { container } = renderRow(templateRead([payload, "project_name"]))
    const list = within(screen.getByTestId("describe-template-fields"))
    expect(list.getByText(payload)).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByTestId("describe-template-fields").querySelectorAll("li")).toHaveLength(2)
  })

  it("a name carrying a closing tag cannot break out of its own list item", () => {
    const payload = "</li><script>alert(1)</script><li>"
    const { container } = renderRow(templateRead([payload]))
    expect(screen.getByTestId("describe-template-fields").querySelectorAll("li")).toHaveLength(1)
    expect(container.querySelector("script")).toBeNull()
    expect(screen.getByText(payload)).toBeInTheDocument()
  })

  it("a form label and a Word line carrying markup render as text too", () => {
    const payload = "<b onmouseover=alert(1)>x</b>"
    const { container } = renderRow(
      read({
        arm: "blanks",
        filename: "x.docx",
        fields: [fieldOf("k", { label: payload, line_before: payload, anchor_kind: "line", anchor_label: payload })],
      }),
      "x.docx",
    )
    expect(container.querySelector("b")).toBeNull()
    expect(screen.getByTestId("describe-form-places").textContent).toContain(payload)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// Phase 199-08 Task 3 (DES-01 · sheet `c9-doors-describe` §5) — THE TEMPLATE ROW.
//
// ⚠ **CANNOT-EXPRESS — THE SHEET'S §5 IS A DIFFERENT COMPONENT, AND SAYING SO IS THE
// DELIVERABLE.** The sheet asks for a rail of STARTER-WORKFLOW pills; this row attaches THE
// DOCUMENT THIS WORKFLOW WILL FILL IN. What IS pinned below is the property sheet c9 does
// legitimately ask of every state block: the arms must be mutually distinct WITHOUT a single
// class attribute.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("199-08 — sheet c9 §5: the arms are distinct WITHOUT any class", () => {
  it("every arm reads differently to a person, with the whole class attribute stripped off", () => {
    const readings: { name: string; text: string }[] = []
    for (const arm of ARMS) {
      const { container, unmount } = renderRow(arm.state, arm.filename)
      const text = (container.textContent ?? "").replace(/\s+/g, " ").trim()
      readings.push({ name: arm.name, text })
      expect(text.length, `${arm.name} rendered nothing`).toBeGreaterThan(0)
      unmount()
    }

    expect(readings).toHaveLength(ARMS.length)
    const collisions: string[] = []
    for (let i = 0; i < readings.length; i++) {
      for (let j = i + 1; j < readings.length; j++) {
        if (readings[i].text === readings[j].text) collisions.push(`${readings[i].name} === ${readings[j].name}`)
      }
    }
    expect(collisions).toEqual([])
  })

  it("POSITIVE CONTROL — the class-free comparison really catches two identical readings", () => {
    const same = [
      { name: "a", text: "one" },
      { name: "b", text: "one" },
    ]
    const found: string[] = []
    for (let i = 0; i < same.length; i++) {
      for (let j = i + 1; j < same.length; j++) {
        if (same[i].text === same[j].text) found.push(`${same[i].name} === ${same[j].name}`)
      }
    }
    expect(found).toEqual(["a === b"])
  })

  it("the component stays fed from props: NO network reach", () => {
    expect(describeTemplateRowSource199).not.toContain("199-08")
    expect(describeTemplateRowSource199.length).toBeGreaterThan(1000)
    expect(describeTemplateRowSource199).not.toContain("@/lib/api")
    expect(/\bfetch\s*\(/.test(describeTemplateRowSource199)).toBe(false)
    expect('import { x } from "@/lib/api"').toContain("@/lib/api")
    expect(/\bfetch\s*\(/.test("await fetch('/x')")).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 291-04 — THE NEW ARMS (UI-SPEC Surface 1), appended
// ══════════════════════════════════════════════════════════════════════════════════════

describe("DescribeTemplateRow — a PDF form read exactly (form-fields, D-04 / D-11)", () => {
  it("📄 Drafting to, the heading with its provenance, the grid of LABELS in server order, the back line and the count", () => {
    renderRow(formRead(), "w9.pdf")
    expect(screen.getByTestId("describe-template-filename")).toHaveTextContent(`${SPEC_FILENAME_LEAD} w9.pdf`)
    expect(screen.getByTestId("describe-form-heading")).toHaveTextContent(`${FORM_FIELDS_HEADING} · ${FORM_PROVENANCE_EXACT}`)
    const grid = screen.getByTestId("describe-form-fields")
    expect(grid).toHaveAttribute("role", "list")
    const names = within(grid).getAllByRole("listitem").map((el) => el.textContent)
    expect(names).toEqual(["Name", "Business name", "Individual", "Exempt"])
    // ⚠ The raw qualified field name is NEVER shown when a label exists.
    expect(grid.textContent).not.toContain("topmostSubform")
    // Type words, from the one formatter.
    expect(grid.textContent).toContain("choice of 2")
    expect(grid.textContent).toContain("yes / no")
    // Read exactly ⇒ no suggested tag anywhere.
    expect(screen.queryByText(FIELD_SUGGESTED_TAG)).toBeNull()
    expect(screen.getByTestId("describe-form-back")).toHaveTextContent(formBackLinePdf("w9.pdf"))
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(footingFields(4))
  })

  it("over 8 fields: 8 show, `Show all n` expands IN PLACE, and the footing states the FULL count throughout", async () => {
    const many = Array.from({ length: 27 }, (_, i) => fieldOf(`f_${i}`, { label: `Field ${i + 1}` }))
    renderRow(formRead(many), "big.pdf")
    const grid = screen.getByTestId("describe-form-fields")
    expect(within(grid).getAllByRole("listitem")).toHaveLength(8)
    const more = screen.getByTestId("describe-form-show-all")
    expect(more).toHaveTextContent(showAllLabel(27))
    expect(more).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(footingFields(27))
    await userEvent.click(more)
    expect(within(screen.getByTestId("describe-form-fields")).getAllByRole("listitem")).toHaveLength(27)
    expect(screen.getByTestId("describe-form-show-all")).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(footingFields(27))
  })

  it("8 or fewer fields carry no Show all control", () => {
    renderRow(formRead(), "w9.pdf")
    expect(screen.queryByTestId("describe-form-show-all")).toBeNull()
  })
})

describe("DescribeTemplateRow — AI-suggested fields (flat PDF or a readable scan)", () => {
  it("text: every name is tagged suggested, the provenance says so, the flat line and the ASKS footing", () => {
    renderRow(suggestedRead("text"), "flat.pdf")
    expect(screen.getByTestId("describe-form-heading")).toHaveTextContent(
      `${FORM_FIELDS_HEADING} · ${FORM_PROVENANCE_SUGGESTED_TEXT}`,
    )
    expect(screen.getAllByTestId("describe-form-suggested-tag")).toHaveLength(2)
    for (const tag of screen.getAllByTestId("describe-form-suggested-tag")) expect(tag).toHaveTextContent(FIELD_SUGGESTED_TAG)
    expect(screen.getByTestId("describe-form-back-flat")).toHaveTextContent(FORM_BACK_FLAT)
    expect(screen.queryByTestId("describe-form-cut-short")).toBeNull()
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(footingAsks(2))
  })

  it("scan: the scan provenance and the server's cut-short sentence, VERBATIM, in its own node", () => {
    renderRow(suggestedRead("scan"), "flat.pdf")
    expect(screen.getByTestId("describe-form-heading")).toHaveTextContent(FORM_PROVENANCE_SUGGESTED_SCAN)
    expect(screen.getByTestId("describe-form-cut-short")).toHaveTextContent(CUT_SHORT)
  })
})

describe("DescribeTemplateRow — Word blanks: where each answer goes (D-26 / D-27 / D-28)", () => {
  it("one native checkbox per PLACED blank, ticked by default, with the document's own line and the marked label", () => {
    renderRow(blanksRead(), "supplier.docx")
    expect(screen.getByTestId("describe-form-heading")).toHaveTextContent(`${PLACES_HEADING} · ${PLACES_PROVENANCE}`)
    const list = screen.getByTestId("describe-form-places")
    const boxes = within(list).getAllByRole("checkbox")
    expect(boxes).toHaveLength(3)
    for (const box of boxes) expect(box).toBeChecked()
    expect(list.textContent).toContain("VAT number:")
    expect(list.textContent).toContain("(EU only)")
    const marks = screen.getAllByTestId("describe-form-place-mark")
    expect(marks.map((m) => m.textContent)).toEqual(["Supplier name", "VAT number", "Start date"])
    // The type word sits on the line.
    expect(list.textContent).toContain("date")
    expect(screen.queryAllByTestId("describe-form-place-stays-blank")).toHaveLength(0)
    expect(screen.getByTestId("describe-form-back-word")).toHaveTextContent(formBackLineWord("supplier.docx"))
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(footingFields(3))
  })

  it("a couldn't-place row shows the SERVER'S sentence, carries no checkbox, and is not counted", () => {
    renderRow(blanksRead(), "supplier.docx")
    const unplaced = screen.getByTestId("describe-form-unplaced")
    expect(unplaced).toHaveTextContent(UNPLACED_SENTENCE)
    expect(within(unplaced).queryByRole("checkbox")).toBeNull()
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(footingFields(3))
  })

  it("an UNTICKED blank keeps its question, says ` · stays blank` in REAL DOM text, and the footing drops", () => {
    renderRow(blanksRead(), "supplier.docx", { untickedKeys: ["vat_number"] })
    const boxes = within(screen.getByTestId("describe-form-places")).getAllByRole("checkbox")
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([true, false, true])
    const stays = screen.getAllByTestId("describe-form-place-stays-blank")
    expect(stays).toHaveLength(1)
    expect(stays[0].textContent).toBe(` ${PLACE_STAYS_BLANK}`)
    // The question is still there, in the same row as the marker.
    expect(stays[0].closest("li")?.textContent).toContain("VAT number")
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(footingFields(2))
  })

  it("pressing a tick calls back with that blank's key — the row holds no state of its own", async () => {
    const onToggleBlank = vi.fn()
    renderRow(blanksRead(), "supplier.docx", { onToggleBlank })
    await userEvent.click(within(screen.getByTestId("describe-form-places")).getAllByRole("checkbox")[1])
    expect(onToggleBlank).toHaveBeenCalledWith("vat_number")
  })

  it("every placed row is a label with a 24px hit area (min-h-6)", () => {
    renderRow(blanksRead(), "supplier.docx")
    for (const box of within(screen.getByTestId("describe-form-places")).getAllByRole("checkbox")) {
      expect(box.closest("label")?.className).toContain("min-h-6")
    }
  })
})

describe("DescribeTemplateRow — the fact lines (D-02 / D-08 / Pitfall 13)", () => {
  it("scan unreadable: SCAN_UNREADABLE, and the draft is written without it", () => {
    renderRow(read({ arm: "scan_unreadable", filename: "scan.pdf" }), "scan.pdf")
    expect(screen.getByTestId("describe-form-scan-unreadable")).toHaveTextContent(SCAN_UNREADABLE)
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(FOOTING_WITHOUT_IT)
  })

  it("copy refused: the server's sentence VERBATIM, and the draft is written without it", () => {
    renderRow(read({ arm: "copy_refused", refused: COPY_REFUSED_SENTENCE }))
    expect(screen.getByTestId("describe-form-copy-refused")).toHaveTextContent(COPY_REFUSED_SENTENCE)
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(FOOTING_WITHOUT_IT)
  })

  it("a PDF that could not be read says FORM_UNAVAILABLE and its own footing; a Word file keeps the shipped pair", () => {
    renderRow({ kind: "unavailable", reason: "unreachable", detail: null }, "w9.pdf")
    expect(screen.getByTestId("describe-form-unavailable")).toHaveTextContent(FORM_UNAVAILABLE)
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(FOOTING_FORM_UNAVAILABLE)
    cleanup()
    renderRow({ kind: "unavailable", reason: "unreachable", detail: null }, "status.docx")
    expect(screen.getByTestId("describe-template-fields-unavailable")).toHaveTextContent(TEMPLATE_FIELDS_UNAVAILABLE)
  })

  it("the fact lines are FOREGROUND text with no colour — never amber, red or green (D-17)", () => {
    for (const [state, filename, testid] of [
      [read({ arm: "scan_unreadable", filename: "scan.pdf" }), "scan.pdf", "describe-form-scan-unreadable"],
      [read({ arm: "none" }), "a.docx", "describe-form-no-fields"],
      [read({ arm: "copy_refused", refused: COPY_REFUSED_SENTENCE }), "a.docx", "describe-form-copy-refused"],
      [suggestedRead("scan"), "flat.pdf", "describe-form-cut-short"],
    ] as const) {
      cleanup()
      renderRow(state, filename)
      const cls = screen.getByTestId(testid).className
      expect(cls, testid).toContain("text-foreground")
      expect(cls, testid).not.toMatch(/warning|destructive|amber|red-|green-/)
    }
  })
})

describe("DescribeTemplateRow — 291 source fences (T-291-30 and the ?raw spacing fence)", () => {
  it("carries NO raw-HTML escape hatch and NO alert role", () => {
    expect(describeTemplateRowSource199).not.toMatch(/dangerously/i)
    expect(describeTemplateRowSource199).not.toContain('role="alert"')
  })

  it("imports the shared row classes from the one module, by name", () => {
    expect(describeTemplateRowSource199).toMatch(/from "\.\/surfaceClasses"/)
    for (const name of ["ROW_CLASSES", "NOTE_CLASSES", "FOOTING_CLASSES", "FILENAME_CLASSES"]) {
      expect(describeTemplateRowSource199).toContain(name)
    }
  })

  it("the off-grid literals appear ONLY on the one shipped line that carried them", () => {
    const FORBIDDEN = ["mt-1.5", "px-2.5", "py-[3px]", "pl-3", "px-3", "py-5", "text-[10.5px]"]
    const hits = describeTemplateRowSource199
      .split(/\r?\n/)
      .filter((line) => FORBIDDEN.some((token) => line.includes(token)))
      .map((line) => line.trim())
    // The shipped Remove button's class line, which predates 291 and is left untouched.
    expect(hits).toEqual([
      'className="mt-1.5 text-[10.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground"',
    ])
    // POSITIVE CONTROL — the filter really catches a typed literal.
    expect(["  <p className=\"mt-1.5 x\">"].filter((l) => FORBIDDEN.some((t) => l.includes(t)))).toHaveLength(1)
  })

  it("every glyph is aria-hidden", () => {
    renderRow(formRead(), "w9.pdf")
    const glyph = screen.getByText("📄")
    expect(glyph).toHaveAttribute("aria-hidden", "true")
  })
})

describe("DescribeTemplateRow — 302-02 (FE-IN-04 / D-10): a disabled Word-blank tick says why", () => {
  it("while composing, every blank checkbox points at the files-locked note", () => {
    render(
      <DescribeTemplateRow
        state={blanksRead()}
        filename="supplier.docx"
        onPickFile={noop}
        onClear={noop}
        disabled
        disabledNoteId="describe-files-locked"
      />,
    )
    const ticks = screen.getAllByRole("checkbox")
    expect(ticks.length).toBeGreaterThan(0)
    for (const t of ticks) expect(t).toHaveAttribute("aria-describedby", "describe-files-locked")
  })

  it("not composing, no blank checkbox carries aria-describedby", () => {
    renderRow(blanksRead(), "supplier.docx")
    const ticks = screen.getAllByRole("checkbox")
    expect(ticks.length).toBeGreaterThan(0)
    for (const t of ticks) expect(t).not.toHaveAttribute("aria-describedby")
  })
})
