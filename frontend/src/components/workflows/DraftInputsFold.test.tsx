/**
 * Phase 291-05 (AUTH-02, D-09 / D-10 / D-12, sketch 291-draft-removed winner A) — the inputs
 * fold leaf's own suite.
 *
 * The leaf is presentational: the fields the server read off the attached form, the draft's
 * live inputs and a filename go in; `onToggle` and `onSetSource` come out. Every case below
 * reads the RENDERED TEXT where the words are the deliverable (the switch labels, the type
 * word, the added-by sentence, the extra-input note), because a presence assertion by testid
 * cannot see content drift.
 *
 * The `?raw` spacing fence at the bottom is the one the UI-SPEC names for this leaf: it imports
 * the fold's shipped class constants by name and types none of the off-grid literals itself.
 */
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { GenerateField } from "@/lib/api/knowledge"

import * as declaredInputsVocabulary from "./declaredInputsVocabulary"
import {
  INPUTS_BODY_HEADING,
  INPUTS_FOLD_ACTION,
  INPUT_ADDED_BY_SYREL,
  INPUT_FROM_STEP,
  INPUT_SOURCE_ASK,
  INPUT_SOURCE_EXPLANATION,
  INPUT_SOURCE_LOOKUP,
  inputExtraNote,
  inputSourceGroupLabel,
  inputsFoldSummary,
} from "./declaredInputsVocabulary"
import * as decisionsVocabulary from "./decisionsVocabulary"
import {
  DraftInputsFoldBody,
  DraftInputsFoldTrigger,
  type DraftInputsFoldProps,
} from "./DraftInputsFold"
import draftInputsFoldSource from "./DraftInputsFold?raw"
import { FOLD_ACTION_CLASS, FOLD_BODY_CLASS, FOLD_LINE_CLASS } from "./surfaceClasses"
import { fieldTypeWord } from "./templateFirstVocabulary"

afterEach(cleanup)

// ── fixtures ─────────────────────────────────────────────────────────────────────────────

const FILENAME = "vendor-onboarding-form.pdf"

/** The server's field list, in the FORM's order (deliberately not alphabetical). */
const FIELDS: GenerateField[] = [
  { key: "supplier_name", label: "Supplier name", type: "text", enum_options: [], covered_by: "input" },
  { key: "country", label: "Country", type: "enum", enum_options: ["US", "CA", "MX"], covered_by: "input" },
  { key: "agree", label: "Agree", type: "enum", enum_options: ["Yes", "No"], covered_by: "input" },
  { key: "risk_score", label: "Risk score", type: "number", enum_options: [], covered_by: "step" },
  { key: "start_date", label: "Start date", type: "date", enum_options: [], covered_by: "input" },
]

type Input = DraftInputsFoldProps["inputs"][number]

const INPUTS: Input[] = [
  { key: "supplier_name", label: "Supplier name", type: "text", source: "user", origin: "ai_proposed", note: null },
  { key: "country", label: "Country", type: "enum", enum_options: ["US", "CA", "MX"], source: "kb_auto", origin: "ai_proposed", note: null },
  { key: "agree", label: "Agree", type: "enum", enum_options: ["Yes", "No"], source: "user", origin: "ai_proposed", note: null },
  // A field the draft left out — the server added it (D-12), and only the SERVER stamps this.
  { key: "start_date", label: "Start date", type: "date", source: "user", origin: "server_added", note: null },
  // An extra input the AI added beyond the form, with the server-kept reason (D-10).
  { key: "reviewer", label: "Reviewer", type: "text", source: "user", origin: "ai_proposed", note: "Your description asks who signs it off." },
  // An extra input with NO note — not a form row, and not shown here.
  { key: "silent_extra", label: "Silent extra", type: "text", source: "user", origin: null, note: null },
]

function renderBody(over: Partial<DraftInputsFoldProps> = {}) {
  const onSetSource = vi.fn()
  const onToggle = vi.fn()
  const props: DraftInputsFoldProps = {
    fields: FIELDS,
    inputs: INPUTS,
    filename: FILENAME,
    bodyId: "inputs-body",
    open: true,
    onToggle,
    onSetSource,
    ...over,
  }
  const result = render(<DraftInputsFoldBody {...props} />)
  return { ...result, onSetSource, onToggle, props }
}

function renderTrigger(over: Partial<DraftInputsFoldProps> = {}) {
  const onSetSource = vi.fn()
  const onToggle = vi.fn()
  const props: DraftInputsFoldProps = {
    fields: FIELDS,
    inputs: INPUTS,
    filename: FILENAME,
    bodyId: "inputs-body",
    open: false,
    onToggle,
    onSetSource,
    ...over,
  }
  const result = render(<DraftInputsFoldTrigger {...props} />)
  return { ...result, onSetSource, onToggle, props }
}

function rowLabels(): string[] {
  return screen
    .getAllByTestId("draft-arrival-input-row")
    .map((row) => row.querySelector("[data-input-label]")?.textContent ?? "")
}

// ── 1. the vocabulary, verbatim (UI-SPEC Surface 3b copy table) ───────────────────────────

describe("declaredInputsVocabulary — the inputs fold words (UI-SPEC 3b, verbatim)", () => {
  it("the constants read exactly as the UI-SPEC locks them", () => {
    expect(INPUTS_FOLD_ACTION).toBe("review")
    expect(INPUTS_BODY_HEADING).toBe("Where each answer comes from")
    // 296-07 (291-WR-06) — AMENDED DELIBERATELY: the engine has no look-up yet, so the second
    // sentence no longer promises one (UI-SPEC E row 184).
    expect(INPUT_SOURCE_EXPLANATION).toBe(
      "Ask the person: it's a box on the form that starts this workflow. Looking answers up in your documents isn't available yet.",
    )
    expect(INPUT_SOURCE_ASK).toBe("Ask the person")
    expect(INPUT_SOURCE_LOOKUP).toBe("Look it up")
    expect(INPUT_FROM_STEP).toBe("Written by a step")
    expect(INPUT_ADDED_BY_SYREL).toBe(
      "Added by Syrel, not the AI: the draft left this field out, so it's asked when the workflow runs.",
    )
  })

  it("the formatters interpolate their data and keep the singular arm", () => {
    expect(inputsFoldSummary(1, "w9.pdf")).toBe("1 input from w9.pdf")
    expect(inputsFoldSummary(7, "w9.pdf")).toBe("7 inputs from w9.pdf")
    expect(inputSourceGroupLabel("Country")).toBe("Where the answer to Country comes from")
    expect(inputExtraNote("w9.pdf", "Your description asks for it.")).toBe(
      "Not in w9.pdf. Your description asks for it.",
    )
  })

  it("the summary is total over hostile counts — empty at zero, never 'NaN inputs'", () => {
    for (const n of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(inputsFoldSummary(n, "w9.pdf"), `count ${n}`).toBe("")
    }
    expect(inputsFoldSummary(2.7, "w9.pdf")).toBe("2 inputs from w9.pdf")
  })
})

// ── 2. the trigger ───────────────────────────────────────────────────────────────────────

describe("DraftInputsFoldTrigger — one more muted footer line", () => {
  it("reads the summary and the action, in that order, with the shipped fold classes", () => {
    renderTrigger()
    const trigger = screen.getByTestId("draft-arrival-fold-inputs")
    expect(trigger.tagName).toBe("BUTTON")
    expect(trigger.className).toBe(FOLD_LINE_CLASS)
    expect(screen.getByTestId("draft-arrival-fold-inputs-summary").textContent).toBe(
      inputsFoldSummary(FIELDS.length, FILENAME),
    )
    const action = within(trigger).getByText(INPUTS_FOLD_ACTION)
    expect(action.className).toBe(FOLD_ACTION_CLASS)
  })

  it("carries aria-expanded and aria-controls, and toggles through the caller", async () => {
    const user = userEvent.setup()
    const { onToggle } = renderTrigger({ open: false })
    const trigger = screen.getByTestId("draft-arrival-fold-inputs")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(trigger.getAttribute("aria-controls")).toBe("inputs-body")
    await user.click(trigger)
    expect(onToggle).toHaveBeenCalledTimes(1)
    cleanup()
    renderTrigger({ open: true })
    expect(screen.getByTestId("draft-arrival-fold-inputs").getAttribute("aria-expanded")).toBe("true")
  })

  it("counts the FORM's fields, singular at one", () => {
    renderTrigger({ fields: FIELDS.slice(0, 1) })
    expect(screen.getByTestId("draft-arrival-fold-inputs-summary").textContent).toBe(
      "1 input from vendor-onboarding-form.pdf",
    )
  })
})

// ── 3. the body ──────────────────────────────────────────────────────────────────────────

describe("DraftInputsFoldBody — where each answer comes from", () => {
  it("renders the heading, then the explanation, with the shipped fold-body class", () => {
    renderBody()
    const body = screen.getByTestId("draft-arrival-inputs-body")
    expect(body.id).toBe("inputs-body")
    expect(body.className).toBe(FOLD_BODY_CLASS)
    const heading = within(body).getByRole("heading", { level: 3 })
    expect(heading.textContent).toBe(INPUTS_BODY_HEADING)
    expect(within(body).getByText(INPUT_SOURCE_EXPLANATION)).toBeTruthy()
    // The heading precedes the explanation in document order.
    const explanation = within(body).getByText(INPUT_SOURCE_EXPLANATION)
    expect(heading.compareDocumentPosition(explanation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("one row per field IN THE FORM'S ORDER, then the extra inputs that carry a note", () => {
    renderBody()
    expect(rowLabels()).toEqual(["Supplier name", "Country", "Agree", "Risk score", "Start date", "Reviewer"])
  })

  it("each field row reads its label and its type word from the ONE formatter", () => {
    renderBody()
    const rows = screen.getAllByTestId("draft-arrival-input-row")
    FIELDS.forEach((field, i) => {
      const word = rows[i].querySelector("[data-input-type]")?.textContent
      expect(word, field.key).toBe(fieldTypeWord(field))
    })
    // The rendered words themselves, so a formatter drift is a red test here too.
    expect(rows[0].querySelector("[data-input-type]")?.textContent).toBe("text")
    expect(rows[1].querySelector("[data-input-type]")?.textContent).toBe("choice of 3")
    expect(rows[2].querySelector("[data-input-type]")?.textContent).toBe("yes / no")
    expect(rows[4].querySelector("[data-input-type]")?.textContent).toBe("date")
  })

  it("an asked field has a named radiogroup of two NATIVE radios reflecting its live source", () => {
    renderBody()
    const country = screen.getByRole("radiogroup", { name: inputSourceGroupLabel("Country") })
    const radios = within(country).getAllByRole("radio") as HTMLInputElement[]
    expect(radios).toHaveLength(2)
    expect(radios.map((r) => r.type)).toEqual(["radio", "radio"])
    const ask = within(country).getByLabelText(INPUT_SOURCE_ASK) as HTMLInputElement
    const look = within(country).getByLabelText(INPUT_SOURCE_LOOKUP) as HTMLInputElement
    // Country's live source is kb_auto.
    expect(look.checked).toBe(true)
    expect(ask.checked).toBe(false)
    const supplier = screen.getByRole("radiogroup", { name: inputSourceGroupLabel("Supplier name") })
    expect((within(supplier).getByLabelText(INPUT_SOURCE_ASK) as HTMLInputElement).checked).toBe(true)
    // The radio dot is visually hidden; the label is the target.
    expect(ask.className).toContain("sr-only")
  })

  it("the selected segment carries the accent wash; the other does not", () => {
    renderBody()
    const country = screen.getByRole("radiogroup", { name: inputSourceGroupLabel("Country") })
    const lookLabel = within(country).getByText(INPUT_SOURCE_LOOKUP).closest("label")
    const askLabel = within(country).getByText(INPUT_SOURCE_ASK).closest("label")
    expect(lookLabel?.className).toContain("bg-primary/15")
    expect(lookLabel?.className).toContain("font-medium")
    expect(askLabel?.className).not.toContain("bg-primary/15")
    expect(askLabel?.className).toContain("min-h-6")
  })

  // 296-07 (291-WR-06) — AMENDED DELIBERATELY: `Look it up` is disabled until the engine can look
  // answers up (SEED), so choosing it writes nothing; choosing Ask the person still writes user.
  it("choosing Look it up writes nothing (not available yet); choosing Ask the person writes user", async () => {
    const user = userEvent.setup()
    const { onSetSource } = renderBody()
    const supplier = screen.getByRole("radiogroup", { name: inputSourceGroupLabel("Supplier name") })
    await user.click(within(supplier).getByText(INPUT_SOURCE_LOOKUP))
    expect(onSetSource).not.toHaveBeenCalled()
    const country = screen.getByRole("radiogroup", { name: inputSourceGroupLabel("Country") })
    await user.click(within(country).getByText(INPUT_SOURCE_ASK))
    expect(onSetSource).toHaveBeenLastCalledWith("country", "user")
    expect(onSetSource).toHaveBeenCalledTimes(1)
  })

  it("a field written by a step says so instead of offering the switch", () => {
    renderBody()
    const row = screen.getAllByTestId("draft-arrival-input-row")[3]
    expect(row.textContent).toContain(INPUT_FROM_STEP)
    expect(within(row).queryByRole("radiogroup")).toBeNull()
    expect(within(row).queryByRole("radio")).toBeNull()
  })

  it("a SERVER-ADDED input says it was added by Syrel, not the AI — in those exact words", () => {
    renderBody()
    const marks = screen.getAllByTestId("draft-arrival-input-added-by-syrel")
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe(INPUT_ADDED_BY_SYREL)
    expect(marks[0].textContent).toBe(
      "Added by Syrel, not the AI: the draft left this field out, so it's asked when the workflow runs.",
    )
    const row = marks[0].closest("[data-testid=draft-arrival-input-row]")
    expect(row?.querySelector("[data-input-label]")?.textContent).toBe("Start date")
  })

  it("the added-by mark comes ONLY from origin === server_added — an ai_proposed input never carries it", () => {
    renderBody({
      inputs: INPUTS.map((i) => ({ ...i, origin: "ai_proposed" })),
    })
    expect(screen.queryByTestId("draft-arrival-input-added-by-syrel")).toBeNull()
  })

  it("an extra input reads 'Not in {file}. {note}' in place of the type word, and keeps the switch", () => {
    renderBody()
    const rows = screen.getAllByTestId("draft-arrival-input-row")
    const extra = rows[rows.length - 1]
    expect(extra.querySelector("[data-input-type]")?.textContent).toBe(
      inputExtraNote(FILENAME, "Your description asks who signs it off."),
    )
    expect(extra.querySelector("[data-input-type]")?.textContent).toBe(
      "Not in vendor-onboarding-form.pdf. Your description asks who signs it off.",
    )
    expect(within(extra).getByRole("radiogroup", { name: inputSourceGroupLabel("Reviewer") })).toBeTruthy()
  })

  it("an extra input WITHOUT a note is not a row here", () => {
    renderBody()
    expect(rowLabels()).not.toContain("Silent extra")
  })

  it("each radiogroup's radios share one name, and no two groups share it", () => {
    renderBody()
    const names = screen
      .getAllByRole("radiogroup")
      .map((g) => (within(g).getAllByRole("radio") as HTMLInputElement[]).map((r) => r.name))
    for (const pair of names) {
      expect(pair[0]).not.toBe("")
      expect(pair[0]).toBe(pair[1])
    }
    const first = names.map((pair) => pair[0])
    expect(new Set(first).size).toBe(first.length)
  })

  it("file-derived labels and notes render as TEXT, never as markup (T-291-40)", () => {
    const payload = '<img src=x onerror="alert(1)">'
    const { container } = renderBody({
      fields: [{ key: "x", label: payload, type: "text", enum_options: [], covered_by: "input" }],
      inputs: [
        { key: "x", label: payload, type: "text", source: "user", origin: null, note: null },
        { key: "y", label: payload, type: "text", source: "user", origin: null, note: payload },
      ],
    })
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getAllByText(payload).length).toBeGreaterThan(0)
  })
})

// ── 4. source fences ─────────────────────────────────────────────────────────────────────

describe("DraftInputsFold — source fences", () => {
  it("NON-VACUITY — the ?raw source really loaded", () => {
    expect(draftInputsFoldSource.length).toBeGreaterThan(1000)
    expect(draftInputsFoldSource).toContain("export function DraftInputsFoldTrigger")
    expect(draftInputsFoldSource).toContain("export function DraftInputsFoldBody")
  })

  it("imports FOLD_LINE_CLASS, FOLD_ACTION_CLASS and FOLD_BODY_CLASS BY NAME from the one module", () => {
    const importLine = draftInputsFoldSource.match(
      /import\s*\{([^}]*)\}\s*from\s*"(?:\.\/|@\/components\/workflows\/)surfaceClasses"/,
    )
    expect(importLine).not.toBeNull()
    for (const name of ["FOLD_LINE_CLASS", "FOLD_ACTION_CLASS", "FOLD_BODY_CLASS"]) {
      expect(importLine?.[1] ?? "").toMatch(new RegExp(`\\b${name}\\b`))
    }
  })

  it("types NONE of the off-grid literals itself, and no 12px", () => {
    for (const token of [
      "mt-1.5",
      "px-2.5",
      "py-[3px]",
      "pl-3",
      "px-3",
      "py-5",
      "text-[10.5px]",
      "text-[12px]",
    ]) {
      expect(draftInputsFoldSource.includes(token), `the leaf types ${token}`).toBe(false)
    }
    // POSITIVE CONTROL — the containment check really fires on a planted literal.
    expect('className="py-5 pl-8"'.includes("py-5")).toBe(true)
  })

  it("exports components only — no runtime constant, no lowercase function (react-refresh)", () => {
    expect(draftInputsFoldSource).not.toMatch(/^export const/m)
    expect(draftInputsFoldSource).not.toMatch(/^export function [a-z]/m)
  })

  it("no raw-HTML escape hatch, no alert role, and NO network reach", () => {
    expect(draftInputsFoldSource).not.toMatch(/dangerously/i)
    expect(draftInputsFoldSource).not.toContain('role="alert"')
    expect(/\bfetch\s*\(/.test(draftInputsFoldSource)).toBe(false)
  })
})

// ── 5. the banned words (D-17, UI-SPEC "Banned on every surface") ─────────────────────────

describe("291-05 vocabulary — no banned word, no machine code", () => {
  const BANNED = /\b(safe|safely|scanned|checked|verified|trusted|clean|malicious|suspicious|injection)\b/i
  const MACHINE = /grounding_failed|external_action/
  /** A claim that a step DOES read a reference at run time — the negated sentence is allowed. */
  const RUN_TIME_READ_CLAIM =
    /\bsteps?\b(?![^.]*\b(?:don't|do not|never)\b)[^.]*\b(reads?|reading|uses?)\b[^.]*\b(when (the|this) workflow runs|at run time|each run)\b/i

  const NEW_VALUES = (): [string, string][] => [
    ["INPUTS_FOLD_ACTION", INPUTS_FOLD_ACTION],
    ["INPUTS_BODY_HEADING", INPUTS_BODY_HEADING],
    ["INPUT_SOURCE_EXPLANATION", INPUT_SOURCE_EXPLANATION],
    ["INPUT_SOURCE_ASK", INPUT_SOURCE_ASK],
    ["INPUT_SOURCE_LOOKUP", INPUT_SOURCE_LOOKUP],
    ["INPUT_FROM_STEP", INPUT_FROM_STEP],
    ["INPUT_ADDED_BY_SYREL", INPUT_ADDED_BY_SYREL],
    ["inputsFoldSummary", inputsFoldSummary(3, "terms.pdf")],
    ["inputSourceGroupLabel", inputSourceGroupLabel("Country")],
    ["inputExtraNote", inputExtraNote("terms.pdf", "Your description asks for it.")],
    ["REMOVED_GLYPH", String(decisionsVocabulary.REMOVED_GLYPH)],
    // 291-05 Task 2 — the launch label's options hint and the references sub-line.
    ["inputOptionsHint(yes/no)", declaredInputsVocabulary.inputOptionsHint(["Yes", "No"])],
    ["inputOptionsHint(list)", declaredInputsVocabulary.inputOptionsHint(["US", "CA", "MX"])],
    [
      "templateRowReferencesLine",
      decisionsVocabulary.templateRowReferencesLine(["vendor-terms.pdf", "policy.md"]),
    ],
    // Every string the declared-inputs module exports, so a later addition is swept too.
    ...Object.entries(declaredInputsVocabulary)
      .filter(([, v]) => typeof v === "string")
      .map(([id, v]) => [id, v as string] as [string, string]),
  ]

  it("POSITIVE CONTROLS — each pattern really fires on the thing it forbids", () => {
    expect(BANNED.test("This file is safe.")).toBe(true)
    expect(MACHINE.test("external_action")).toBe(true)
    expect(RUN_TIME_READ_CLAIM.test("Each step reads your references when the workflow runs.")).toBe(true)
    expect(RUN_TIME_READ_CLAIM.test("steps don't read them when the workflow runs.")).toBe(false)
  })

  it("no new value carries a banned word, a machine code or a run-time reading claim", () => {
    const values = NEW_VALUES()
    expect(values.length).toBeGreaterThan(15)
    for (const [id, value] of values) {
      expect(typeof value, id).toBe("string")
      expect(value, `${id} is empty`).not.toBe("")
      expect(BANNED.test(value), `${id} carries a banned word: ${value}`).toBe(false)
      expect(MACHINE.test(value), `${id} carries a machine code: ${value}`).toBe(false)
      expect(RUN_TIME_READ_CLAIM.test(value), `${id} claims run-time reading: ${value}`).toBe(false)
    }
  })
})

// ── 291 UAT S3-F1 — an input that fills several fields is ONE row, under its own label ────

describe("an input that fills fields by name (291 UAT S3-F1)", () => {
  const W9_FIELDS: GenerateField[] = [
    { key: "c1_1[0]", label: "on", type: "enum", enum_options: ["Off", "1"], covered_by: "input", input_key: "classification" },
    { key: "c1_1[1]", label: ".", type: "enum", enum_options: ["Off", "2"], covered_by: "input", input_key: "classification" },
    { key: "f1_01[0]", label: "3.", type: "text", enum_options: [], covered_by: "input", input_key: "legal_name" },
  ]
  const W9_INPUTS: Input[] = [
    { key: "classification", label: "Federal tax classification", type: "enum", source: "user", origin: null, note: null },
    { key: "legal_name", label: "Vendor legal name", type: "text", source: "kb_auto", origin: null, note: null },
  ]

  it("shows one row per question, with the input's label, never the page-text guess", () => {
    renderBody({ fields: W9_FIELDS, inputs: W9_INPUTS })
    expect(rowLabels()).toEqual(["Federal tax classification", "Vendor legal name"])
  })

  it("counts the questions asked, not the form fields", () => {
    renderTrigger({ fields: W9_FIELDS, inputs: W9_INPUTS })
    expect(screen.getByTestId("draft-arrival-fold-inputs-summary").textContent).toBe(
      inputsFoldSummary(2, FILENAME),
    )
  })

  it("the switch flips the input that fills the field", async () => {
    const { onSetSource } = renderBody({ fields: W9_FIELDS, inputs: W9_INPUTS })
    const row = screen.getAllByTestId("draft-arrival-input-row")[1]
    await userEvent.click(within(row).getByText(INPUT_SOURCE_ASK))
    expect(onSetSource).toHaveBeenCalledWith("legal_name", "user")
  })
})
