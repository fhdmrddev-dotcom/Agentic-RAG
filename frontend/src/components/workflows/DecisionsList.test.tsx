/**
 * Phase 197-07 Task 2/3 — the five-row decisions surface, machine-checked.
 *
 * A NET-NEW suite. It absorbs, replaces and re-implements nothing — Phase 177's
 * coverage-loss lesson (a "net-new" file that quietly REPLACED an existing suite, so the
 * total never moved and nobody noticed) is exactly why `scripts/vitest-count-gate.cjs`
 * pins per-file counts. This file already sits inside the `src/components/workflows`
 * target glob, so `TARGETS` needs no edit.
 *
 * ── NO USER-VISIBLE STRING IS SPELLED AS A LITERAL HERE ──
 * Every expectation references an identifier imported from `decisionsVocabulary`. A
 * string literal in a test is a SECOND SPELLING of a locked string, and the whole point
 * of that module is that drift is assertable by character-identity. The ONE exception is
 * the readiness `message`, which is the fixture's own value and is compared to itself by
 * `toBe` — that is what makes the server's sentence character-identical without a
 * cross-language test.
 *
 * ── THE RED-FIRST EVIDENCE THIS FILE WAS BUILT ON (recorded in 197-07-SUMMARY.md) ──
 * The three readiness cases in section 4 were written BEFORE the component satisfied
 * them, against a scaffold whose readiness read was deliberately TWO-ARMED. Two of them
 * failed with `expected true to be false` and the third with the server's sentence
 * prefixed by a client-authored one. That is the exact defect they exist to catch, and it
 * was observed rather than assumed.
 *
 * ⚠ THE FIRST DRAFT OF THE AFFIRMATIVE DETECTOR PASSED AGAINST A COMPONENT THAT REALLY DID
 * RENDER AN AFFIRMATIVE MARK. It read `container.textContent`, which concatenates sibling
 * text nodes with NO separator, so a mark sitting immediately after a label ending in a
 * letter lost its leading word boundary. The detector now joins TEXT NODES with a
 * separator, and its positive control is planted across exactly that seam. A detector
 * whose positive control uses a clean string proves only that clean strings work.
 *
 * ⚠ Every needle in the source-fence block is ASSEMBLED FROM PARTS, so a grep of this
 * guard file can neither satisfy nor break the greps it exists to protect — the
 * D-ITEM-183-02 trap that `196-08` tripped four times, once inside the comment written to
 * explain the first three.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { DecisionsList, type DecisionsListProps } from "./DecisionsList"
import {
  DECISION_CHANGE_ACTION,
  DECISION_DELIVERABLE_CHAT,
  DECISION_DELIVERABLE_FILE,
  DECISION_EDIT_LIMIT_NOTE,
  DECISION_KB_NONE,
  DECISION_NAME_FIELD_LABEL,
  DECISION_NAME_NONE,
  DECISION_OPEN_STEP_ACTION,
  DECISION_REQUIREMENT_NONE,
  DECISION_ROW_ORDER,
  DECISION_TEMPLATE_NONE,
  decisionRowLabel,
} from "./decisionsVocabulary"

// ── fixtures ─────────────────────────────────────────────────────────────────────────

/** A populated draft. Every value is deliberately free of the affirmative vocabulary
 *  section 4 sweeps for — a fixture that smuggled one in would make the two "nothing
 *  affirmative" cases fail for a reason that has nothing to do with the component. */
const FOLDER_NAME = "Vendor contracts"
const TEMPLATE_FILENAME = "renewal-brief.docx"
const BUSINESS_REQUIREMENT =
  "Produce a cited vendor-risk brief for each vendor under review this quarter."
const WORKFLOW_NAME = "Vendor renewal brief"
const STEP_SLUG = "emit_pack"

/** The server's own sentence, as it arrives on the wire. Compared to ITSELF by `toBe`. */
const MISSING_MESSAGE =
  "This workflow has no business requirement, so it cannot be published."

/** The family of words a surface uses to say "everything is fine". Assembled from parts
 *  where the token is two words, and matched with WORD BOUNDARIES so `ok` cannot fire
 *  inside another word. */
const AFFIRMATIVE_WORDS = [
  ["all", "set"].join(" "),
  ["looks", "good"].join(" "),
  "ready",
  "ok",
  ["pass", "ed"].join(""),
  "fine",
  "complete",
  "valid",
  "yes",
  "done",
  "correct",
  "satisfied",
]
/** The glyph half of the same family — a tick is an affirmative mark with no words. */
const AFFIRMATIVE_GLYPHS = [
  String.fromCodePoint(0x2713),
  String.fromCodePoint(0x2714),
  String.fromCodePoint(0x2705),
  String.fromCodePoint(0x2611),
]
const affirmativeRx = () => new RegExp(`\\b(${AFFIRMATIVE_WORDS.join("|")})\\b`, "i")

/**
 * Everything an author can actually READ inside `root`.
 *
 * TEXT NODES ARE JOINED WITH A SEPARATOR, and that is the whole point — see the ⚠ note in
 * the header. Placeholder / label / title values are included too, because a placeholder
 * is a visible affordance and an affirmative one would otherwise slip past.
 */
function readableText(root: HTMLElement): string {
  const parts: string[] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    parts.push(n.textContent ?? "")
  }
  for (const el of root.querySelectorAll("[placeholder],[aria-label],[title]")) {
    parts.push(
      el.getAttribute("placeholder") ?? "",
      el.getAttribute("aria-label") ?? "",
      el.getAttribute("title") ?? "",
    )
  }
  return parts.join(" ")
}

function saysSomethingAffirmative(container: HTMLElement): boolean {
  if (affirmativeRx().test(readableText(container))) return true
  return AFFIRMATIVE_GLYPHS.some((g) => container.innerHTML.includes(g))
}

function baseProps(over: Partial<DecisionsListProps> = {}): DecisionsListProps {
  return {
    folderName: FOLDER_NAME,
    templateFilename: TEMPLATE_FILENAME,
    businessRequirement: BUSINESS_REQUIREMENT,
    name: WORKFLOW_NAME,
    deliverableStepSlug: STEP_SLUG,
    onChangeKb: vi.fn(),
    onChangeRequirement: vi.fn(),
    onOpenStep: vi.fn(),
    onChangeName: vi.fn(),
    ...over,
  }
}

function renderList(over: Partial<DecisionsListProps> = {}) {
  const props = baseProps(over)
  const result = render(<DecisionsList {...props} />)
  return { ...result, props }
}

/** Every answer absent at once: no binding, no template, no requirement, no name, no
 *  step. `businessRequirement` and `name` are `""` — never `null`, per the contract. */
const ALL_ABSENT: Partial<DecisionsListProps> = {
  folderName: null,
  templateFilename: null,
  businessRequirement: "",
  name: "",
  deliverableStepSlug: null,
}

/** The rendered rows, in DOCUMENT order, read off the row key each `li` carries. */
function renderedRowTestIds(): string[] {
  const list = screen.getByTestId("decisions-list")
  return [...list.querySelectorAll("[data-row-key]")].map(
    (row) => row.getAttribute("data-testid") ?? "",
  )
}

function answerText(key: string): string {
  return screen.getByTestId(`decision-answer-${key}`).textContent ?? ""
}

function nameField(): HTMLInputElement {
  return screen.getByTestId("decision-name-input") as HTMLInputElement
}

// ── 1. ALWAYS FIVE, ALWAYS THE SAME ORDER (D-07) ─────────────────────────────────────

describe("DecisionsList — the row set is fixed", () => {
  it("renders five rows on a fully-populated draft", () => {
    renderList()
    expect(renderedRowTestIds()).toHaveLength(5)
    expect(screen.getByTestId("decisions-list").getAttribute("data-row-count")).toBe("5")
  })

  it("renders five rows when EVERY answer is absent — no row silently disappears", () => {
    // The case D-07 exists for. A surface that hid the rows with nothing to say would be
    // the "only rows needing attention" shape the decision rejected, and would need the
    // per-row predicate that for the requirement row does not exist (`SEED-163`).
    renderList(ALL_ABSENT)
    expect(renderedRowTestIds()).toHaveLength(5)
    expect(screen.getByTestId("decisions-list").getAttribute("data-row-count")).toBe("5")
  })

  it("renders the rows in exactly the exported order — compared as an ORDERED array", () => {
    // An ORDERED array, never a set and never five separate presence assertions: those
    // pass on a surface that renders the right rows in the wrong sequence, which is the
    // one thing "always the same order" is about.
    renderList()
    expect(renderedRowTestIds()).toEqual(
      DECISION_ROW_ORDER.map((key) => `decision-row-${key}`),
    )
  })

  it("labels every row from the vocabulary, never from a literal here", () => {
    renderList()
    for (const key of DECISION_ROW_ORDER) {
      const row = screen.getByTestId(`decision-row-${key}`)
      expect(within(row).getByText(decisionRowLabel(key))).toBeTruthy()
    }
  })

  it("states D-03's limit once, at the foot", () => {
    renderList()
    expect(screen.getByTestId("decisions-limit-note").textContent).toBe(
      DECISION_EDIT_LIMIT_NOTE,
    )
  })
})

// ── 2. EACH ROW SHOWS THE ANSWER THE DEFINITION HOLDS NOW ────────────────────────────

describe("DecisionsList — live answers", () => {
  it("row 1 shows the bound knowledge base's name", () => {
    renderList()
    expect(answerText("knowledge-base")).toBe(FOLDER_NAME)
  })

  it("row 2 shows the bound template's filename", () => {
    renderList()
    expect(answerText("template")).toBe(TEMPLATE_FILENAME)
  })

  it("row 3 shows the durable business requirement", () => {
    renderList()
    expect(answerText("requirement")).toBe(BUSINESS_REQUIREMENT)
  })

  it("row 4's field carries the workflow's name as its value", () => {
    renderList()
    expect(nameField().value).toBe(WORKFLOW_NAME)
    expect(nameField().getAttribute("aria-label")).toBe(DECISION_NAME_FIELD_LABEL)
  })

  it("row 5 says a file is produced when there is a step that produces one", () => {
    renderList()
    expect(answerText("deliverable")).toBe(DECISION_DELIVERABLE_FILE)
  })

  it("a re-render with a CHANGED answer follows it — there is no cached first copy", () => {
    // What "no mirrored copy" buys, and what a cache would break. The same property
    // `SeedReceipt`'s replaceability case pins: a SECOND generation must replace the
    // first one's card rather than sit underneath it.
    const { rerender } = renderList()
    expect(answerText("knowledge-base")).toBe(FOLDER_NAME)
    rerender(<DecisionsList {...baseProps({ folderName: "Supplier master" })} />)
    expect(answerText("knowledge-base")).toBe("Supplier master")
  })

  it("a re-render with a CHANGED name follows it in the field too", () => {
    const { rerender } = renderList()
    expect(nameField().value).toBe(WORKFLOW_NAME)
    rerender(<DecisionsList {...baseProps({ name: "Renewal pack" })} />)
    expect(nameField().value).toBe("Renewal pack")
  })
})

// ── 3. ABSENCE IS STATED AS ABSENCE (vocabulary rule 4) ──────────────────────────────

describe("DecisionsList — honest absence", () => {
  it("row 1 with no binding says so", () => {
    renderList(ALL_ABSENT)
    expect(answerText("knowledge-base")).toBe(DECISION_KB_NONE)
  })

  it("row 2 with no template says so", () => {
    renderList(ALL_ABSENT)
    expect(answerText("template")).toBe(DECISION_TEMPLATE_NONE)
  })

  it("row 3 with no requirement says so, and claims nothing about the cost", () => {
    renderList(ALL_ABSENT)
    expect(answerText("requirement")).toBe(DECISION_REQUIREMENT_NONE)
  })

  it("row 4 with no name shows the honest-absence sentence as the field's PLACEHOLDER", () => {
    // D-17 — the field IS the row, so absence cannot be a sentence in place of a control.
    renderList(ALL_ABSENT)
    expect(nameField().value).toBe("")
    expect(nameField().getAttribute("placeholder")).toBe(DECISION_NAME_NONE)
  })

  it("row 5 with no producing step names the absence of a file", () => {
    renderList(ALL_ABSENT)
    expect(answerText("deliverable")).toBe(DECISION_DELIVERABLE_CHAT)
  })
})

// ── 4. THE THREE READINESS ARMS (D-20 / T-197-03) — WRITTEN RED-FIRST ────────────────

describe("DecisionsList — the three readiness arms", () => {
  it("an ABSENT verdict renders nothing affirmative anywhere", () => {
    const { container } = renderList({ readiness: undefined })
    expect(screen.queryByTestId("decision-verdict-requirement")).toBeNull()
    expect(saysSomethingAffirmative(container)).toBe(false)
  })

  it("a PRESENT verdict renders exactly what absence renders — nothing affirmative", () => {
    // THE CASE THAT MAKES ABSENCE SAFE. Absence and green are rendered the SAME way —
    // nothing — so a response carrying no verdict is indistinguishable from one carrying
    // a green, and an absent field can never be READ as a pass.
    const { container } = renderList({
      readiness: { business_requirement: { status: "present" } },
    })
    expect(screen.queryByTestId("decision-verdict-requirement")).toBeNull()
    expect(saysSomethingAffirmative(container)).toBe(false)
  })

  it("a MISSING verdict renders the server's own sentence, character for character", () => {
    renderList({
      readiness: { business_requirement: { status: "missing", message: MISSING_MESSAGE } },
    })
    expect(screen.getByTestId("decision-verdict-requirement").textContent).toBe(
      MISSING_MESSAGE,
    )
  })

  it("the missing verdict sits on ROW 3 and on no other row (D-20)", () => {
    // Only one row may borrow the gate's register, because stage 1's predicate is the
    // only definition-level one there is.
    renderList({
      readiness: { business_requirement: { status: "missing", message: MISSING_MESSAGE } },
    })
    const row = screen.getByTestId("decision-row-requirement")
    expect(within(row).getByTestId("decision-verdict-requirement")).toBeTruthy()
    expect(screen.getAllByTestId("decision-verdict-requirement")).toHaveLength(1)
  })

  it("POSITIVE CONTROL — the affirmative detector fires across a SIBLING SEAM", () => {
    // The first draft of this detector read `container.textContent`, which concatenates
    // sibling text nodes with NO separator — so a planted mark sitting immediately after
    // a label ending in a letter lost its leading word boundary and went UNDETECTED. It
    // was measured passing against a component that really did render one. The control is
    // therefore planted the way the defect actually appears: its own element, no
    // whitespace between it and the node before it. The first expectation below is the
    // proof of that failure mode, kept as a live assertion rather than as prose.
    const planted = document.createElement("div")
    const before = document.createElement("span")
    before.textContent = decisionRowLabel("deliverable")
    const mark = document.createElement("span")
    mark.textContent = AFFIRMATIVE_WORDS[0]
    planted.append(before, mark)
    expect(planted.textContent).not.toMatch(affirmativeRx())
    expect(saysSomethingAffirmative(planted)).toBe(true)
  })

  it("POSITIVE CONTROL — the detector fires on a tick glyph too", () => {
    for (const glyph of AFFIRMATIVE_GLYPHS) {
      const planted = document.createElement("div")
      const mark = document.createElement("span")
      mark.textContent = glyph
      planted.append(mark)
      expect(saysSomethingAffirmative(planted)).toBe(true)
    }
  })

  it("POSITIVE CONTROL — the detector does NOT fire on the surface's own vocabulary", () => {
    // The other half. A detector that fired on the copy it sits beside would make the two
    // absence cases pass for the wrong reason and would get deleted rather than fixed.
    const planted = document.createElement("div")
    for (const sentence of [
      DECISION_KB_NONE,
      DECISION_TEMPLATE_NONE,
      DECISION_REQUIREMENT_NONE,
      DECISION_NAME_NONE,
      DECISION_DELIVERABLE_CHAT,
      DECISION_DELIVERABLE_FILE,
      DECISION_EDIT_LIMIT_NOTE,
      DECISION_CHANGE_ACTION,
      DECISION_OPEN_STEP_ACTION,
    ]) {
      const span = document.createElement("span")
      span.textContent = sentence
      planted.append(span)
    }
    expect(saysSomethingAffirmative(planted)).toBe(false)
  })
})

// ── 5. ANSWERING A ROW HANDS THE AUTHOR TO THE CONTROL THAT ALREADY EXISTS ───────────

describe("DecisionsList — the writes", () => {
  it("row 1's action asks the caller to change the binding, exactly once", async () => {
    const user = userEvent.setup()
    const { props } = renderList()
    await user.click(screen.getByTestId("decision-action-knowledge-base"))
    expect(props.onChangeKb).toHaveBeenCalledTimes(1)
  })

  it("row 1's action carries the vocabulary's word", () => {
    renderList()
    expect(screen.getByTestId("decision-action-knowledge-base").textContent).toBe(
      DECISION_CHANGE_ACTION,
    )
  })

  it("row 3's action asks the caller to change the requirement, exactly once", async () => {
    const user = userEvent.setup()
    const { props } = renderList()
    await user.click(screen.getByTestId("decision-action-requirement"))
    expect(props.onChangeRequirement).toHaveBeenCalledTimes(1)
  })

  it("row 2 jumps to the step that produces the deliverable", async () => {
    const user = userEvent.setup()
    const { props } = renderList()
    expect(screen.getByTestId("decision-action-template").textContent).toBe(
      DECISION_OPEN_STEP_ACTION,
    )
    await user.click(screen.getByTestId("decision-action-template"))
    expect(props.onOpenStep).toHaveBeenCalledTimes(1)
    expect(props.onOpenStep).toHaveBeenCalledWith(STEP_SLUG)
  })

  it("row 5 jumps to the SAME step — rows 2 and 5 are one mechanism (D-18)", async () => {
    const user = userEvent.setup()
    const { props } = renderList()
    await user.click(screen.getByTestId("decision-action-deliverable"))
    expect(props.onOpenStep).toHaveBeenCalledWith(STEP_SLUG)
  })

  it("with NO producing step neither jump renders, and none is ever called", async () => {
    // An action that selects nothing is worse than no action.
    const { props } = renderList(ALL_ABSENT)
    expect(screen.queryByTestId("decision-action-template")).toBeNull()
    expect(screen.queryByTestId("decision-action-deliverable")).toBeNull()
    await Promise.resolve()
    expect(props.onOpenStep).not.toHaveBeenCalled()
  })

  it("row 4 forwards the RAW value — leading and trailing spaces survive", () => {
    // D-17 / D-182-06. The store owns the write and the server owns emptiness; a trim or
    // an empty-check here would be the second copy of a rule that lives elsewhere. Driven
    // with a direct change event so the asserted value is EXACT rather than the tail of a
    // keystroke sequence.
    const raw = "  Vendor renewal brief  "
    const { props } = renderList()
    fireEvent.change(nameField(), { target: { value: raw } })
    expect(props.onChangeName).toHaveBeenCalledTimes(1)
    expect(props.onChangeName).toHaveBeenCalledWith(raw)
  })

  it("row 4 forwards an EMPTY value rather than swallowing it", () => {
    const { props } = renderList()
    fireEvent.change(nameField(), { target: { value: "" } })
    expect(props.onChangeName).toHaveBeenCalledWith("")
  })

  it("row 4 forwards every keystroke as typed", async () => {
    const user = userEvent.setup()
    const { props } = renderList({ name: "" })
    await user.type(nameField(), "abc")
    expect(props.onChangeName).toHaveBeenCalledTimes(3)
  })

  it("row 4 has no sibling action control — the field IS the action (D-17)", () => {
    renderList()
    const row = screen.getByTestId("decision-row-name")
    expect(within(row).queryAllByRole("button")).toHaveLength(0)
  })
})

// ── 6. EVERY AUTHORED STRING IS A PLAIN TEXT CHILD (T-197-19) ────────────────────────

describe("DecisionsList — model- and user-authored strings are escaped", () => {
  it("an HTML-looking requirement, filename and name render as TEXT, not as markup", () => {
    // Assembled at runtime so this file's own source carries no markup a scanner would
    // read as an element.
    const payload = ["<", "img src=x onerror=boom", ">"].join("")
    const { container } = renderList({
      businessRequirement: payload,
      templateFilename: payload,
      name: payload,
    })
    // No element node was created for it — the property that actually matters.
    expect(container.querySelector("img")).toBeNull()
    // …and every TEXT-CHILD cell carries it escaped rather than parsed.
    //
    // ⚠ A WHOLE-CONTAINER `not.toContain("<img")` WAS TRIED AND REJECTED. It fires on the
    // name field, whose `value` ATTRIBUTE jsdom serialises verbatim — an attribute value
    // is not markup and React set it as a DOM property, so the needle reported the
    // correct treatment sitting one row away as a defect. A fence that does that gets
    // narrowed, not forced. The scoped form below is strictly the stronger claim anyway:
    // it names WHICH nodes must be escaped instead of sweeping a haystack.
    for (const key of ["requirement", "template"]) {
      const cell = screen.getByTestId(`decision-answer-${key}`)
      expect(cell.innerHTML).not.toContain(["<", "img"].join(""))
      expect(cell.innerHTML).toContain("&lt;")
      expect(cell.querySelector("img")).toBeNull()
    }
    // …and the literal text is what the author reads.
    expect(answerText("requirement")).toBe(payload)
    expect(answerText("template")).toBe(payload)
    expect(nameField().value).toBe(payload)
  })

  it("an HTML-looking SERVER verdict renders as text too", () => {
    const payload = ["<", "b", ">", "escalate", "<", "/b", ">"].join("")
    const { container } = renderList({
      readiness: { business_requirement: { status: "missing", message: payload } },
    })
    expect(container.querySelector("b")).toBeNull()
    expect(screen.getByTestId("decision-verdict-requirement").textContent).toBe(payload)
  })
})
