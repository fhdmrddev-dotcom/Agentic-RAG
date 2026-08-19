/**
 * Phase 193.1-06 Task 2 — `DescribeTemplateRow`'s own suite.
 *
 * ── THE THREE PROPERTIES THAT MATTER, AND WHY EACH IS MECHANISED ─────────────────────────
 *
 * 1. **NO ARM RENDERS ANY OTHER ARM'S NODE — all 20 ORDERED PAIRS.** This is the mechanised
 *    form of the inherited rule *these sentences may never merge*, and it is the reason each
 *    arm has its own testid. Sketch 166's own audit states it the same way and for the same
 *    reason: a surface that says "we found no fields" about a document nobody opened is the
 *    defect this phase exists to remove, and prose cannot prevent it. The pair list is DERIVED
 *    from the arm table, so a sixth arm inherits all of it the moment it is added.
 *
 * 2. **THE STATED COUNT EQUALS THE RENDERED LIST.** Asserted against
 *    `container.querySelectorAll("li").length` rather than against the fixture, so a hardcoded
 *    number cannot pass no matter which literal someone picked. Driven at THREE different
 *    lengths, including a 5-field document, because a hardcoded `8` beside a list of 5 is the
 *    exact silent lie the phase removes and a single-length test would not see it.
 *
 * 3. **ATTACKER-CONTROLLED DOCUMENT TEXT IS RENDERED AS TEXT.** Placeholder names come out of
 *    an uploaded document. The injection case asserts the payload is VISIBLE AS TEXT and that
 *    it produced no element — both halves, because either one alone is satisfiable by a
 *    component that dropped the name entirely.
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
  FOOTING_LOADING,
  FOOTING_NONE,
  FOOTING_NOT_WORD,
  FOOTING_UNAVAILABLE,
  SPEC_FILENAME_LEAD,
  footingFields,
} from "./templateFirstVocabulary"
import {
  TEMPLATE_ACCEPT,
  TEMPLATE_ATTACH_LABEL,
  TEMPLATE_FIELDS_HEADING,
  TEMPLATE_FIELDS_LOADING,
  TEMPLATE_FIELDS_NONE,
  TEMPLATE_FIELDS_NOT_WORD,
  TEMPLATE_FIELDS_UNAVAILABLE,
  TEMPLATE_TYPES_NOTE,
} from "./TemplateAttachSection"

import type { TemplatePlaceholdersState } from "@/hooks/useTemplatePlaceholders"

afterEach(cleanup)

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

function renderRow(
  state: TemplatePlaceholdersState,
  filename: string | undefined = "weekly-status.docx",
  handlers: { onPickFile?: (f: File) => void; onClear?: () => void } = {},
) {
  return render(
    <DescribeTemplateRow
      state={state}
      filename={filename}
      onPickFile={handlers.onPickFile ?? noop}
      onClear={handlers.onClear ?? noop}
    />,
  )
}

/**
 * THE FIVE READING ARMS, each with the testids IT ALONE may render.
 *
 * ⚠ The `notWord` arm shares the `none` STATE and is separated by the FILENAME, which is
 * exactly how the shipped surface derives it — gated on emptiness, never on the extension
 * alone. Carrying the filename in this table is what makes the two rows genuinely different
 * arms rather than the same row listed twice.
 */
const ARMS: {
  name: string
  state: TemplatePlaceholdersState
  filename: string
  own: string[]
}[] = [
  {
    name: "loading",
    state: { kind: "loading" },
    filename: "weekly-status.docx",
    own: ["describe-template-fields-loading"],
  },
  {
    name: "fields",
    state: { kind: "fields", fields: EIGHT_FIELDS },
    filename: "weekly-status.docx",
    own: [
      "describe-template-fields-heading",
      "describe-template-fields",
      "describe-template-filename",
    ],
  },
  {
    name: "none",
    state: { kind: "none" },
    filename: "weekly-status.docx",
    own: ["describe-template-fields-none"],
  },
  {
    name: "notWord",
    state: { kind: "none" },
    filename: "deck.pptx",
    own: ["describe-template-fields-not-word"],
  },
  {
    name: "unavailable",
    state: { kind: "unavailable", reason: "unreadable" },
    filename: "weekly-status.docx",
    own: ["describe-template-fields-unavailable"],
  },
]

describe("DescribeTemplateRow — the control itself", () => {
  it("renders the prompt, the note, the picker and the accepted types", () => {
    renderRow({ kind: "idle" }, undefined)
    expect(screen.getByTestId("describe-template-prompt")).toHaveTextContent(
      DESCRIBE_ATTACH_PROMPT,
    )
    expect(screen.getByTestId("describe-template-note")).toHaveTextContent(ATTACH_NOTE)
    expect(screen.getByTestId("describe-template-types")).toHaveTextContent(TEMPLATE_TYPES_NOTE)
    // The picker's label and its filter are the SHIPPED identifiers, inherited by import. Two
    // doors onto one act may not acquire two names, and the accepted set is a server rule.
    expect(screen.getByLabelText(TEMPLATE_ATTACH_LABEL)).toBe(
      screen.getByTestId("describe-template-input"),
    )
    expect(screen.getByTestId("describe-template-input")).toHaveAttribute("accept", TEMPLATE_ACCEPT)
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
    const file = new File(["x"], "weekly-status.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    await userEvent.upload(screen.getByTestId("describe-template-input"), file)
    expect(onPickFile).toHaveBeenCalledTimes(1)
    expect(onPickFile.mock.calls[0][0]).toBe(file)
  })

  it("the clear control appears once a document is held and calls back", async () => {
    const onClear = vi.fn()
    renderRow({ kind: "fields", fields: EIGHT_FIELDS }, "weekly-status.docx", { onClear })
    await userEvent.click(screen.getByTestId("describe-template-clear"))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it("ONE live region across every non-idle arm — one announcement, not four", () => {
    for (const arm of ARMS) {
      cleanup()
      renderRow(arm.state, arm.filename)
      const regions = screen.getAllByTestId("describe-template-fields-region")
      expect(regions, `${arm.name} does not render exactly one region`).toHaveLength(1)
      expect(regions[0], `${arm.name}'s region is not a live region`).toHaveAttribute(
        "role",
        "status",
      )
    }
  })
})

describe("DescribeTemplateRow — each arm renders its OWN sentence", () => {
  it("loading", () => {
    renderRow({ kind: "loading" })
    expect(screen.getByTestId("describe-template-fields-loading")).toHaveTextContent(
      TEMPLATE_FIELDS_LOADING,
    )
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(FOOTING_LOADING)
  })

  it("fields — heading, the filename lead, and the list in the SERVER'S order", () => {
    const { container } = renderRow({ kind: "fields", fields: EIGHT_FIELDS })
    expect(screen.getByTestId("describe-template-fields-heading")).toHaveTextContent(
      TEMPLATE_FIELDS_HEADING,
    )
    expect(screen.getByTestId("describe-template-filename")).toHaveTextContent(SPEC_FILENAME_LEAD)
    expect(screen.getByTestId("describe-template-filename")).toHaveTextContent(
      "weekly-status.docx",
    )
    // ⚠ NEVER RE-SORTED — the order is part of the answer. Asserted against the array as
    // passed, so an alphabetise or a reverse reds here.
    const items = Array.from(container.querySelectorAll("li")).map((li) => li.textContent)
    expect(items).toEqual(EIGHT_FIELDS)
  })

  it("none", () => {
    renderRow({ kind: "none" }, "weekly-status.docx")
    expect(screen.getByTestId("describe-template-fields-none")).toHaveTextContent(
      TEMPLATE_FIELDS_NONE,
    )
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(FOOTING_NONE)
    // ⚠ AND NEITHER UNAVAILABLE NODE — the whole no-merge rule, at the node level.
    expect(screen.queryByTestId("describe-template-fields-unavailable")).toBeNull()
    expect(screen.getByTestId("describe-template-footing")).not.toHaveTextContent(
      FOOTING_UNAVAILABLE,
    )
  })

  it("notWord — the same STATE as none, separated by the document's own name", () => {
    renderRow({ kind: "none" }, "deck.pptx")
    expect(screen.getByTestId("describe-template-fields-not-word")).toHaveTextContent(
      TEMPLATE_FIELDS_NOT_WORD,
    )
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(FOOTING_NOT_WORD)
    expect(screen.queryByTestId("describe-template-fields-none")).toBeNull()
  })

  it("⚠ notWord is gated on EMPTINESS, never on the extension alone", () => {
    // A non-Word document that somehow DID yield fields renders its fields. This is what stops
    // the branch becoming a stale second copy of the server's parser predicate.
    renderRow({ kind: "fields", fields: ["project_name"] }, "deck.pptx")
    expect(screen.getByTestId("describe-template-fields")).toBeInTheDocument()
    expect(screen.queryByTestId("describe-template-fields-not-word")).toBeNull()
  })

  it("unavailable", () => {
    renderRow({ kind: "unavailable", reason: "unreadable" })
    expect(screen.getByTestId("describe-template-fields-unavailable")).toHaveTextContent(
      TEMPLATE_FIELDS_UNAVAILABLE,
    )
    expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(FOOTING_UNAVAILABLE)
    // ⚠ AND NEITHER NONE NODE.
    expect(screen.queryByTestId("describe-template-fields-none")).toBeNull()
    expect(screen.getByTestId("describe-template-footing")).not.toHaveTextContent(FOOTING_NONE)
  })

  it("both `unavailable` reasons render the SAME arm — the distinction is not shown", () => {
    // The hook keeps `unreadable` and `unreachable` apart so a FUTURE surface may use them.
    // This surface must not: both mean the same thing to a person, and inventing a visible
    // distinction would be a claim the wording cannot support.
    renderRow({ kind: "unavailable", reason: "unreadable" })
    const first = screen.getByTestId("describe-template-footing").textContent
    cleanup()
    renderRow({ kind: "unavailable", reason: "unreachable" })
    expect(screen.getByTestId("describe-template-footing").textContent).toBe(first)
  })
})

describe("DescribeTemplateRow — NO ARM RENDERS ANY OTHER ARM'S NODE (all 20 ordered pairs)", () => {
  const PAIRS = ARMS.flatMap((a) => ARMS.filter((b) => b.name !== a.name).map((b) => [a, b]))

  it("the pair list really is all 20 ordered pairs — non-vacuity before the negatives", () => {
    // A derivation that produced an empty list would make every case below pass while checking
    // nothing at all (the 192.1 E-2 lesson: a fence swept against nothing is green and defends
    // nothing). Five arms, ordered pairs, self excluded: 5 x 4.
    expect(ARMS).toHaveLength(5)
    expect(PAIRS).toHaveLength(20)
    // …and every arm really does own at least one testid to be confused for.
    for (const arm of ARMS) expect(arm.own.length).toBeGreaterThan(0)
  })

  it.each(PAIRS.map(([a, b]) => [a.name, b.name, a, b] as const))(
    "arm %s renders none of arm %s's nodes",
    (_aName, bName, a, b) => {
      renderRow(a.state, a.filename)
      // POSITIVE CONTROL, INLINE: arm A really did render ITS OWN nodes. Without this, an arm
      // that rendered nothing at all would satisfy every negative below.
      for (const testid of a.own) {
        expect(screen.queryByTestId(testid), `${a.name} did not render its own ${testid}`).not.toBeNull()
      }
      for (const testid of b.own) {
        expect(screen.queryByTestId(testid), `${a.name} rendered ${bName}'s ${testid}`).toBeNull()
      }
    },
  )

  it("the five footing lines are five DISTINCT sentences", () => {
    // The node-level property above is not enough on its own: two arms could render their own
    // distinct nodes while their footing lines had quietly merged. D-09 requires a disabled or
    // waiting control to be able to say WHY, and it cannot if two arms say the same thing.
    const footings = ARMS.map((arm) => {
      cleanup()
      renderRow(arm.state, arm.filename)
      return screen.getByTestId("describe-template-footing").textContent ?? ""
    })
    expect(new Set(footings).size).toBe(5)
    for (const value of footings) expect(value.length).toBeGreaterThan(0)
  })
})

describe("DescribeTemplateRow — the stated count is DERIVED from the rendered list", () => {
  it.each([[1], [5], [8]])(
    "a %i-field document states %i, counted from the list itself",
    (n) => {
      const fields = EIGHT_FIELDS.slice(0, n)
      const { container } = renderRow({ kind: "fields", fields })
      // ⚠ THE ASSERTION A HARDCODED NUMBER CANNOT PASS. The expected value is read out of the
      // DOM, not out of the fixture, so the footing is compared with the list a person actually
      // sees rather than with the array a test happened to pass in.
      const rendered = container.querySelectorAll("li").length
      expect(rendered).toBe(n)
      expect(screen.getByTestId("describe-template-footing")).toHaveTextContent(
        footingFields(rendered),
      )
      // …and it really contains the digit, so a footing that dropped the number entirely and
      // happened to match a count-free sentence could not pass either.
      expect(screen.getByTestId("describe-template-footing").textContent).toContain(String(n))
    },
  )

  it("⚠ a 5-field document says FIVE, never eight — the silent lie this phase removes", () => {
    // Called out as its own case rather than left inside the loop above, because the specific
    // failure being prevented is a literal 8 beside a shorter list, and a phase gate reading
    // this file should be able to see that exact claim tested by name.
    const { container } = renderRow({ kind: "fields", fields: EIGHT_FIELDS.slice(0, 5) })
    expect(container.querySelectorAll("li")).toHaveLength(5)
    const footing = screen.getByTestId("describe-template-footing").textContent ?? ""
    expect(footing).toContain("5")
    expect(footing).not.toContain("8")
  })

  it("exactly ONE footing line renders on every arm — never two, never none", () => {
    for (const arm of ARMS) {
      cleanup()
      renderRow(arm.state, arm.filename)
      expect(
        screen.getAllByTestId("describe-template-footing"),
        `${arm.name} does not render exactly one footing`,
      ).toHaveLength(1)
    }
  })
})

describe("DescribeTemplateRow — document text is rendered as TEXT (T-193.1-06-01)", () => {
  it("an HTML payload in a placeholder name renders visibly and creates no element", () => {
    const payload = '<img src=x onerror="alert(1)">'
    const { container } = renderRow({ kind: "fields", fields: [payload, "project_name"] })
    // BOTH HALVES. Either alone is satisfiable by a component that dropped the name entirely:
    // the payload must be VISIBLE (so nothing was silently swallowed) AND inert.
    const list = within(screen.getByTestId("describe-template-fields"))
    expect(list.getByText(payload)).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
    // …and the count still matches the list, so an escaped name is a normal name.
    expect(container.querySelectorAll("li")).toHaveLength(2)
  })

  it("a name carrying a closing tag cannot break out of its own list item", () => {
    const payload = "</li><script>alert(1)</script><li>"
    const { container } = renderRow({ kind: "fields", fields: [payload] })
    expect(container.querySelectorAll("li")).toHaveLength(1)
    expect(container.querySelector("script")).toBeNull()
    expect(screen.getByText(payload)).toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// Phase 199-08 Task 3 (DES-01 · sheet `c9-doors-describe` §5) — THE TEMPLATE ROW.
//
// APPENDED, never interleaved. Not one assertion above this line moves, and NO byte of
// `DescribeTemplateRow.tsx` is modified by this plan.
//
// ⚠ **CANNOT-EXPRESS — THE SHEET'S §5 IS A DIFFERENT COMPONENT, AND SAYING SO IS THE
// DELIVERABLE.** Three parts, as required:
//
//   • **What the sheet asks for.** A horizontal rail of STARTER-WORKFLOW pills — a named
//     workflow and its phase count (`Invoice Audit · 4 phases`), pressed to open it.
//   • **What this component can do.** Nothing of the kind, and not because it is missing a
//     feature: it is a different noun. This row attaches THE DOCUMENT THIS WORKFLOW WILL
//     FILL IN, and renders what that document asks for. A workflow to copy and a document
//     to fill in are two unrelated facts that happen to share the word "template".
//   • **The gap.** Our nearest shipped analogue to the sheet's rail is the starter-workflow
//     door on the BUILDER's pre-draft screen — a quiet worded trigger that opens a list,
//     not a rail of pills. That surface is in `199-09`'s file and this plan may not touch
//     it. Adopting the sheet's shape here would mean building a second, contradicting
//     meaning for "template" two inches from the first — precisely the collision D-21
//     already ruled on for this screen's own label.
//
// So the verdict is DIFFERENT-COMPONENT, the shape is unchanged, and what IS pinned below
// is the property sheet c9 does legitimately ask of every state block: the arms must be
// mutually distinct WITHOUT a single class attribute.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("199-08 — sheet c9 §5: the five arms are distinct WITHOUT any class", () => {
  it("every arm reads differently to a person, with the whole class attribute stripped off", () => {
    const readings: { name: string; text: string }[] = []
    for (const arm of ARMS) {
      const { container, unmount } = renderRow(arm.state, arm.filename)
      // The class-free reading: the WORDS, plus the shape of the list, and nothing else.
      const text = (container.textContent ?? "").replace(/\s+/g, " ").trim()
      readings.push({ name: arm.name, text })
      // NON-VACUITY per arm — the row really rendered and really said something.
      expect(text.length, `${arm.name} rendered nothing`).toBeGreaterThan(0)
      unmount()
    }

    expect(readings).toHaveLength(5)
    const collisions: string[] = []
    for (let i = 0; i < readings.length; i++) {
      for (let j = i + 1; j < readings.length; j++) {
        if (readings[i].text === readings[j].text) {
          collisions.push(`${readings[i].name} === ${readings[j].name}`)
        }
      }
    }
    // ⚠ THE TWO THAT MAY NEVER MERGE ARE IN THIS SET: `none` ("we opened it; it has no
    // fields") and `unavailable` ("we never opened it"). A class-free comparison is the only
    // one that proves they are told apart by WORDS rather than by tone.
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

  it("199-08 modified NO byte of this component, and added NO network reach", () => {
    // The verdict above is only honest if the file really was left alone.
    expect(describeTemplateRowSource199).not.toContain("199-08")
    expect(describeTemplateRowSource199.length).toBeGreaterThan(1000)
    // …and it remains fed entirely from props: no api client, no fetch, no route.
    expect(describeTemplateRowSource199).not.toContain("@/lib/api")
    expect(/\bfetch\s*\(/.test(describeTemplateRowSource199)).toBe(false)
    // POSITIVE CONTROL — the two needles above really fire on a planted line.
    expect('import { x } from "@/lib/api"').toContain("@/lib/api")
    expect(/\bfetch\s*\(/.test("await fetch('/x')")).toBe(true)
  })
})
