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

import decisionsListSource from "./DecisionsList?raw"
// THIS FILE'S OWN SOURCE, for the testid-coverage sweep in section 8 (the 187-20 idiom).
// `?raw` hands back the file as a STRING and evaluates no module, so the self-reference
// cannot introduce an import cycle — the same proven idiom as the line above it.
import testSource from "./DecisionsList.test?raw"
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
    // …and the same claim read off the row KEY each `li` carries, so the order cannot
    // pass by a testid that agrees with the tuple while the key underneath disagrees.
    const list = screen.getByTestId("decisions-list")
    const keys = [...list.querySelectorAll("[data-row-key]")].map((row) =>
      row.getAttribute("data-row-key"),
    )
    expect(keys).toEqual([...DECISION_ROW_ORDER])
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
    // ⚠ RE-SCOPED BY CR-01 (2026-08-18), on the commit that makes the new property true.
    // `businessRequirement: ""` is now passed EXPLICITLY. It was inheriting `baseProps`'
    // non-empty value, which meant this case rendered a `missing` verdict beside a written
    // requirement and pinned that combination as correct — it asserted the incoherent
    // state instead of detecting it. Nothing it proved is dropped: the server's sentence
    // is still compared character for character. It is now proved in the state the verdict
    // actually describes.
    renderList({
      businessRequirement: "",
      readiness: { business_requirement: { status: "missing", message: MISSING_MESSAGE } },
    })
    expect(screen.getByTestId("decision-verdict-requirement").textContent).toBe(
      MISSING_MESSAGE,
    )
  })

  it("the missing verdict sits on ROW 3 and on no other row (D-20)", () => {
    // Only one row may borrow the gate's register, because stage 1's predicate is the
    // only definition-level one there is.
    // ⚠ RE-SCOPED BY CR-01 — same reason as the case above; the D-20 placement claim is
    // unchanged and is now made in a coherent state.
    renderList({
      businessRequirement: "",
      readiness: { business_requirement: { status: "missing", message: MISSING_MESSAGE } },
    })
    const row = screen.getByTestId("decision-row-requirement")
    expect(within(row).getByTestId("decision-verdict-requirement")).toBeTruthy()
    expect(screen.getAllByTestId("decision-verdict-requirement")).toHaveLength(1)
  })

  // ── CR-01 (2026-08-18) — THE VERDICT MUST NOT OUTLIVE ITS OWN PREMISE ──────────────
  //
  // Found by the phase-197 code review, AFTER all eleven plans closed. The verdict is a
  // SNAPSHOT of one `POST /generate`; the answer rendered directly above it in the same
  // `<li>` is LIVE. `setReadiness` is written at exactly one site
  // (`WorkflowBuilderPage.tsx:886`, inside `onDrafted`) and never recomputed — so the two
  // halves of ONE row ran on two different clocks.
  //
  // ⚠ THE THREE CASES ABOVE COULD NOT CATCH THIS, AND THE REASON IS IN THE FIXTURE, NOT IN
  // THE ASSERTIONS. `baseProps` supplies a NON-EMPTY `businessRequirement`, so the two
  // "MISSING verdict" cases rendered a `missing` verdict beside a written requirement and
  // pinned that combination as correct. They asserted the incoherent state rather than
  // detecting it. Both are re-scoped below to the state a `missing` verdict actually
  // describes — an empty requirement — and this block covers what they left uncovered.
  //
  // ⚠ THIS IS NOT A SECOND PREDICATE, and clause 2 of the charter still holds. The
  // component does not decide whether a requirement is durable, sufficient or publishable;
  // it does not re-implement `business_requirement_missing`. It withholds the SERVER's
  // sentence once the input that sentence was computed over is visibly no longer what it
  // was. That is a staleness guard on a snapshot, not a judgement about the content.

  it("a MISSING verdict is WITHHELD once the author has written a requirement (CR-01)", () => {
    // The three-click reproduction, at component scope: the snapshot still says `missing`
    // because nothing re-runs it, but the live answer above now carries real text. Showing
    // the gate's imperative here tells the author to add something they can SEE they added.
    renderList({
      businessRequirement: BUSINESS_REQUIREMENT,
      readiness: { business_requirement: { status: "missing", message: MISSING_MESSAGE } },
    })
    expect(screen.getByTestId("decision-answer-requirement").textContent).toBe(
      BUSINESS_REQUIREMENT,
    )
    expect(screen.queryByTestId("decision-verdict-requirement")).toBeNull()
  })

  it("POSITIVE CONTROL — the SAME snapshot still renders its sentence while the premise holds", () => {
    // Without this, the case above would pass on a component that had simply stopped
    // rendering the verdict at all. Same readiness object, same message, only the live
    // answer differs — so the pair isolates the staleness guard and nothing else.
    renderList({
      businessRequirement: "",
      readiness: { business_requirement: { status: "missing", message: MISSING_MESSAGE } },
    })
    expect(screen.getByTestId("decision-verdict-requirement").textContent).toBe(
      MISSING_MESSAGE,
    )
  })

  it("the INVERSE arm is SILENT, and the silence is deliberate rather than a fix (CR-01)", () => {
    // ⚠ A KNOWN AND ACCEPTED LIMITATION, PINNED SO IT CANNOT DRIFT INTO A CLAIM.
    // Snapshot says `present`; the author then CLEARS the requirement. The card says
    // nothing about a gate that is now about to refuse. That silence is the `undefined`
    // arm's own semantics — *the server did not say* — and it is NOT a pass: absence and
    // green already render identically here, which is the property the arm above exists
    // for. Manufacturing a warning would require this component to decide publishability,
    // which is exactly the predicate clause 2 forbids and which lives in `grounding.py`.
    // RE-OPEN TRIGGER: the first surface that needs the card to WARN rather than fall
    // silent — at which point the verdict must be re-fetched or recomputed server-side,
    // never derived here.
    renderList({
      businessRequirement: "",
      readiness: { business_requirement: { status: "present" } },
    })
    expect(screen.queryByTestId("decision-verdict-requirement")).toBeNull()
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
    // ⚠ RE-SCOPED BY CR-01 — the escaping claim is the point of this case and is untouched;
    // it just needs the verdict to actually RENDER, which now requires the empty premise.
    const { container } = renderList({
      businessRequirement: "",
      readiness: { business_requirement: { status: "missing", message: payload } },
    })
    expect(container.querySelector("b")).toBeNull()
    expect(screen.getByTestId("decision-verdict-requirement").textContent).toBe(payload)
  })
})

// ── 7. THE CHARTER FENCES (the shipped `?raw` house idiom, adopted from SeedReceipt) ──

describe("DecisionsList — the four charter clauses, each fenced", () => {
  /** The component's source with COMMENTS REMOVED. Block comments go entirely; a line is
   *  cut at the first `//` that begins the line or follows whitespace, which leaves regex
   *  literals (whose `//` follows a backslash) and `://` intact.
   *
   *  ⚠ THIS IS WHAT MAKES THE PROSE FENCE HONEST. A component is allowed — required, even
   *  — to EXPLAIN its own rules in a docblock, and a file-wide grep flags every such
   *  explanation. That is the D-ITEM-183-02 trap that cost plans 185-09 and 185-10 three
   *  false positives each. Over-stripping is the safe direction: removing a live literal
   *  turns a fence red and is seen immediately, while leaving a commented one in place is
   *  a silent pass. */
  function withoutComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .map((line) => {
        const m = /(^|\s)\/\//.exec(line)
        return m ? line.slice(0, m.index) : line
      })
      .join("\n")
  }

  /** Built fresh per use: a `/g` regex carries `lastIndex` across calls, and a stateful
   *  guard is a guard that reports different answers to the same question. */
  const stringLiteralRx = () =>
    /"([^"\\\n]*(?:\\.[^"\\\n]*)*)"|'([^'\\\n]*(?:\\.[^'\\\n]*)*)'/g
  /** JSX text — whatever sits between a closing `>` and the next `<`, with no brace in it
   *  (a brace means it is an expression, which the literal sweep already covers). */
  const jsxTextRx = () => />([^<>{}\n]*[A-Za-z]{2,}[^<>{}]*)</g

  /**
   * PROSE, not length. Two adjacent lowercase words AND a mark that only prose carries.
   *
   * ⚠ THE "MORE THAN N WORDS" HALF WAS TRIED AND REJECTED. A tailwind class string is
   * many space-separated words — `min-w-0 flex-1 truncate font-medium text-foreground` is
   * five — so a word-count arm fires on every `className` in the file, which is the
   * correct code the fence sits beside. The punctuation arm does not: a class string
   * carries no sentence-ending mark and no em dash, and the decimal inside
   * `text-[12.5px]` is followed by a digit rather than by whitespace or end-of-string.
   * A control below plants a real class string and proves the detector stays quiet on it.
   */
  const proseRx = () => /[.?!](\s|$)|—/
  const isSentenceLike = (s: string) =>
    /[a-z]{2,}\s+[a-z]{2,}/.test(s) && proseRx().test(s)

  function authoredSentences(src: string): string[] {
    const stripped = withoutComments(src)
    const found: string[] = []
    for (const m of stripped.matchAll(stringLiteralRx())) {
      const value = m[1] ?? m[2] ?? ""
      if (isSentenceLike(value)) found.push(value)
    }
    for (const m of stripped.matchAll(jsxTextRx())) {
      const value = (m[1] ?? "").trim()
      if (isSentenceLike(value)) found.push(value)
    }
    return found
  }

  // Needles assembled from parts so a grep of THIS guard file can neither satisfy nor
  // break the greps it exists to protect.
  const CACHE_HOOKS = [["use", "State"].join(""), ["use", "Ref"].join("")]
  const API_SPECIFIER = ["@/lib", "/api"].join("")
  const VOCABULARY_SPECIFIER = ["@/components/workflows", "/decisionsVocabulary"].join("")
  const EMIT_PHASE_TYPE = ["llm", "_", "emit"].join("")
  const RAW_HTML_PROP = ["dangerously", "SetInnerHTML"].join("")
  /** A module-scope function declaration. The component is the ONLY one this file may
   *  declare — a predicate has to live SOMEWHERE, and this is the property that says
   *  there is nowhere for it to live. */
  const declarationRx = () => /^\s*(export\s+)?function\s+\w+/gm

  // ── FENCE 1 — it authors no sentence of its own ──────────────────────────────────

  it("authors NO sentence of its own — every word an author reads is imported", () => {
    expect(authoredSentences(decisionsListSource)).toEqual([])
  })

  it("POSITIVE CONTROL — it takes its sentences from the one copy home", () => {
    // The half that makes the fence above mean something. An absent-sentence fence proves
    // nothing on a file that renders nothing.
    expect(decisionsListSource).toContain(VOCABULARY_SPECIFIER)
    for (const identifier of [
      "DECISION_ROW_ORDER",
      "decisionRowLabel",
      "DECISION_EDIT_LIMIT_NOTE",
      "DECISION_KB_NONE",
      "DECISION_DELIVERABLE_CHAT",
    ]) {
      expect(decisionsListSource).toContain(identifier)
    }
  })

  it("POSITIVE CONTROL — the prose detector fires on a planted sentence, and is QUIET on a class string", () => {
    // Both halves, because a detector that never fires and a detector that always fires
    // are indistinguishable from a green run.
    const planted = `const copy = ${JSON.stringify(DECISION_KB_NONE)}`
    expect(authoredSentences(planted)).toEqual([DECISION_KB_NONE])
    // …and the em-dash arm, which is the one that catches this surface's house style.
    const emDashed = `const copy = ${JSON.stringify(DECISION_NAME_NONE)}`
    expect(authoredSentences(emDashed)).toHaveLength(1)
    // …and a JSX text node, the other spelling a sentence can take.
    const jsxPlanted = `<p>${DECISION_TEMPLATE_NONE}</p>`
    expect(authoredSentences(jsxPlanted)).toEqual([DECISION_TEMPLATE_NONE])
    // ⚠ AND THE REJECTION. A real class string lifted out of the component: five
    // space-separated words, a decimal, a slash and a colon. The detector must stay quiet
    // on it, or it fires on the correct code it sits beside and gets deleted, not fixed.
    const classString =
      'className="min-w-0 flex-1 truncate font-medium text-[12.5px] placeholder:text-muted-foreground/70"'
    expect(authoredSentences(classString)).toEqual([])
    // …and prose living in a COMMENT is not copy, and must not be flagged.
    expect(authoredSentences("// it says the documents it can read. plainly.")).toEqual([])
    expect(authoredSentences("/* No documents — it reads nothing. */")).toEqual([])
  })

  // ── FENCE 2 — it declares no predicate of its own ────────────────────────────────

  it("declares NO predicate of its own — the component is the only declaration", () => {
    // THE PROPERTY, not a deny-list. The Phase-185 lesson says a deny-list cannot be made
    // fail-closed by extension, so rather than naming the shapes a predicate could take
    // this asserts there is nowhere for one to live.
    const declared = decisionsListSource.match(declarationRx()) ?? []
    expect(declared).toHaveLength(1)
    expect(declared[0]).toContain("DecisionsList")
    expect(decisionsListSource).not.toMatch(/^function\s+\w+/m)
  })

  it("POSITIVE CONTROL — it CONSUMES the shipped derivations rather than recomputing them", () => {
    // It receives the producing step as a prop instead of deriving one, so the phase-type
    // token that a client-side derivation would have to name appears nowhere.
    expect(decisionsListSource).not.toContain(EMIT_PHASE_TYPE)
    expect(decisionsListSource).toContain("deliverableStepSlug")
    // …and it does not classify the readiness verdict either: it reads the discriminant
    // the server sent and renders the server's own field.
    expect(decisionsListSource).toContain("business_requirement")
  })

  it("those two fences are real — each pattern matches its planted literal", () => {
    const PLANTED_PREDICATE = [
      "function requirementIsDurable(",
      "  requirement: string,",
      "): boolean {",
      "  return requirement.length > 40",
      "}",
    ].join("\n")
    expect(PLANTED_PREDICATE).toMatch(/^function\s+\w+/m)
    expect(PLANTED_PREDICATE.match(declarationRx()) ?? []).toHaveLength(1)
    // …and the sweep really does see a SECOND declaration when one exists, which is the
    // half that makes "no predicate can live here" a property rather than a hope.
    const two = `${PLANTED_PREDICATE}\n\nexport function DecisionsList({`
    expect(two.match(declarationRx()) ?? []).toHaveLength(2)
    // …and it must NOT fire on the component's own arrow callbacks, which are correct.
    expect("onChange={(e) => onChangeName(e.target.value)}").not.toMatch(declarationRx())
  })

  // ── FENCE 3 — it opens no request and names no route ─────────────────────────────

  it("opens NO request and names NO route", () => {
    expect(decisionsListSource).not.toMatch(/fetch\(/)
    expect(decisionsListSource).not.toMatch(
      /XMLHttpRequest|EventSource|navigator\.sendBeacon/,
    )
    // A string literal that STARTS with a path separator — the shape every route takes.
    // Asserted as a property rather than as a list of route names.
    expect(decisionsListSource).not.toMatch(/["']\/[a-z]/)
  })

  // ── FENCE 4 — the API contact is TYPE-ONLY, and it EXISTS ────────────────────────

  it("its ONE contact with the API client is TYPE-ONLY", () => {
    const apiLines = decisionsListSource
      .split("\n")
      .filter((line) => line.includes(API_SPECIFIER))
    // POSITIVE CONTROL, and it is the half that matters most here: without it this fence
    // passes because the import was DELETED rather than because it was type-only.
    expect(apiLines.length).toBeGreaterThan(0)
    for (const line of apiLines) {
      expect(line.trimStart().startsWith("import type")).toBe(true)
    }
  })

  it("those fences are real — each pattern matches its planted literal", () => {
    expect('const r = await fetch("/x")').toMatch(/fetch\(/)
    expect("new EventSource(url)").toMatch(
      /XMLHttpRequest|EventSource|navigator\.sendBeacon/,
    )
    expect('const route = "/workflows/generate"').toMatch(/["']\/[a-z]/)
    // …and the route needle must NOT fire on a tailwind opacity or a divide colour, both
    // of which carry a slash inside the string rather than at its head.
    expect('className="placeholder:text-muted-foreground/70"').not.toMatch(/["']\/[a-z]/)
    expect('className="divide-y divide-border/50"').not.toMatch(/["']\/[a-z]/)
    // …and a VALUE import of the API client is not an `import type` line.
    const valueImport = `import { generateWorkflow } from "${API_SPECIFIER}"`
    expect(valueImport.includes(API_SPECIFIER)).toBe(true)
    expect(valueImport.trimStart().startsWith("import type")).toBe(false)
  })

  // ── FENCE 5 — no cache, and every authored string is a text child ────────────────

  it("holds NO cache of its first props — a pure projection, fenced at the source", () => {
    // A cache can only be built out of one of these two hooks, and neither is written
    // here — which is what makes a SECOND generation replace the first one's card.
    for (const hook of CACHE_HOOKS) expect(decisionsListSource).not.toContain(hook)
  })

  it("POSITIVE CONTROL — it is not simply hook-free; it reads every one of its props", () => {
    // Without this the fence above passes on an empty file.
    for (const prop of [
      "folderName",
      "templateFilename",
      "businessRequirement",
      "deliverableStepSlug",
      "readiness",
      "onChangeKb",
      "onChangeRequirement",
      "onOpenStep",
      "onChangeName",
    ]) {
      expect(decisionsListSource).toContain(prop)
    }
  })

  it("renders every authored string as a text child (T-197-19)", () => {
    expect(decisionsListSource).not.toContain(RAW_HTML_PROP)
  })

  it("never turns an ABSENT verdict into an object it can read a pass out of", () => {
    // The two shapes that collapse the third arm. Both are SOURCE properties, which is a
    // far cheaper and far stronger proof than observing a negative about rendering.
    expect(decisionsListSource).not.toMatch(/readiness\s*(\?\?|\|\|)\s*\{\}/)
    expect(decisionsListSource).not.toMatch(/!!\s*readiness/)
  })

  it("does not trim or empty-check the name on its way out (D-17 / D-182-06)", () => {
    expect(decisionsListSource).not.toMatch(/\.trim\(\)/)
  })

  it("those fences are real — each pattern matches its planted literal", () => {
    expect("const [seeded, setSeeded] = useState(name)").toContain(CACHE_HOOKS[0])
    expect("const firstName = useRef(name)").toContain(CACHE_HOOKS[1])
    expect('<p dangerouslySetInnerHTML={{ __html: m }} />').toContain(RAW_HTML_PROP)
    expect("const r = readiness ?? {}").toMatch(/readiness\s*(\?\?|\|\|)\s*\{\}/)
    expect("const r = readiness || {}").toMatch(/readiness\s*(\?\?|\|\|)\s*\{\}/)
    expect("const ok = !!readiness").toMatch(/!!\s*readiness/)
    expect("onChangeName(e.target.value.trim())").toMatch(/\.trim\(\)/)
  })
})

// ── 8. NO HANDLE SHIPS UNEXERCISED (the 187-20 / WR-13 sweep) ────────────────────────

describe("DecisionsList — every rendered handle is queried by this suite", () => {
  function withoutComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .map((line) => {
        const m = /(^|\s)\/\//.exec(line)
        return m ? line.slice(0, m.index) : line
      })
      .join("\n")
  }

  /** Every spelling JSX admits for a STATIC `data-testid`. The character class excludes
   *  `$`, `{` and `}` deliberately: a backtick-admitting variant extracts the TEMPLATE row
   *  testid as though it were static and then demands a query for a literal string that
   *  cannot exist. The template forms keep their own explicit acknowledgement below. */
  const staticTestIdRx = () =>
    /data-testid=(?:"([^"'{}$]+)"|\{\s*["']([^"'{}$]+)["']\s*\})/g
  /** The `data-*` STATE attributes — always brace-valued, because state is an expression. */
  const stateAttrRx = () => /\sdata-([a-z][a-z-]*)=\{/g

  it("every STATIC testid the component renders is QUERIED by this suite", () => {
    // IT MEASURES COVERAGE, NOT A MENTION: the suite's source is comment-stripped first,
    // so a query sitting inside a comment or a discarded block cannot satisfy it. The
    // needle is ASSEMBLED at runtime from each extracted name, so this guard's own source
    // contains no literal call it could satisfy itself with.
    const queried = withoutComments(testSource)
    const ids = [...decisionsListSource.matchAll(staticTestIdRx())].map(
      (m) => m[1] ?? m[2],
    )
    const unique = [...new Set(ids)]
    // A regex that matched nothing would make every assertion below vacuous.
    expect(unique.length).toBeGreaterThan(0)
    expect(unique).toContain("decision-verdict-requirement")
    expect(unique).toContain("decisions-limit-note")
    // …and it must NOT have swallowed a template testid as though it were static.
    for (const id of unique) expect(id).not.toContain("${")
    for (const id of unique) {
      expect(queried, `data-testid="${id}" is rendered but never queried`).toContain(
        `ByTestId("${id}")`,
      )
    }
  })

  it("the TEMPLATE testids are not unguarded either — each is queried per row key", () => {
    // A static extraction correctly cannot see `decision-row-${key}` or
    // `decision-answer-${key}`. They are covered by name, once per key, by the helpers at
    // the top of this file and by section 1's ordered-array case.
    expect(decisionsListSource).toMatch(/data-testid=\{`decision-row-\$\{/)
    expect(decisionsListSource).toMatch(/data-testid=\{`decision-answer-\$\{/)
    const queried = withoutComments(testSource)
    expect(queried).toContain("`decision-answer-${key}`")
    expect(queried).toContain("`decision-row-${key}`")
  })

  it("every `data-*` STATE attribute it renders is QUERIED by this suite too", () => {
    // The sibling class a `data-testid`-only extraction is blind to — and the exact class
    // of surface hook `data-row-count` belongs to. Its own case, its own non-vacuity: a
    // guard folded into its sibling can be deleted without the suite's count moving,
    // which is the Phase-177 coverage-loss shape.
    const queried = withoutComments(testSource)
    const attrs = [
      ...new Set(
        [...decisionsListSource.matchAll(stateAttrRx())].map((m) => `data-${m[1]}`),
      ),
      // `data-testid` is excluded so the two halves cannot double-count: the case above
      // owns it, and it is the only `data-*` here that is an IDENTIFIER, not state.
    ].filter((a) => a !== "data-testid")
    expect(attrs.length).toBeGreaterThan(0)
    expect(attrs).toContain("data-row-count")
    expect(attrs).toContain("data-row-key")
    for (const attr of attrs) {
      expect(queried, `${attr} is rendered but never queried`).toContain(`"${attr}"`)
    }
  })
})

// ── 9. THE 199-04 RESTING INVENTORY, AND THE SHEET-c5 RECONCILIATION ─────────────────
//
// Phase 199-04 Task 1 (DES-01, sketch 178 sheet `c5-draft-arrival`).
//
// ⚠ CHARACTERIZATION PINS, NOT PREFERENCES. Every atom each of the five rows paints, in
// each of the readiness read's THREE arms, is pinned PRESENT — so a later REMOVAL is
// proved by INVERTING an assertion rather than by deleting it (the `192.2-05` method).
//
// ⚠ WHAT THE SHEET ASKS FOR AND WHY MOST OF IT IS REFUSED, IN ONE PLACE. Sheet
// `c5-draft-arrival` draws this list with a per-row STATUS BADGE — a green tick and the
// word for "everything is fine" on two rows, a red mark and a "we need you" word on two
// more, and a grey "we do not know" badge on the fifth. **That is the exact shape the
// shipped three-arm contract exists to forbid.** An affirmative badge on a PRESENT
// readiness makes the present arm distinguishable from the ABSENT arm, and the whole
// argument for the third arm is that the two are indistinguishable to the author, so an
// absence can never be read as a pass. The verdicts are in `199-04-SUMMARY.md`; the cases
// below are what make them checkable rather than asserted.

/** The atoms a single row paints, trimmed and in document order — the same ordered-array
 *  read the sibling card suite uses, scoped to one `li`. */
function rowAtoms(key: string): string[] {
  const row = screen.getByTestId(`decision-row-${key}`)
  const out: string[] = []
  const walker = row.ownerDocument.createTreeWalker(row, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    const text = (n.textContent ?? "").trim()
    if (text !== "") out.push(text)
  }
  // A field paints nothing into a text node, so its VALUE is appended explicitly — row 4
  // would otherwise read as an empty row and every comparison over it would be vacuous.
  for (const field of row.querySelectorAll<HTMLInputElement>("input")) {
    out.push(field.value === "" ? (field.placeholder ?? "") : field.value)
  }
  return out
}

/** Every row's atoms, keyed by row, in the module's declared order. */
function allRowAtoms(): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const key of DECISION_ROW_ORDER) out[key] = rowAtoms(key)
  return out
}

const READINESS_PRESENT = {
  business_requirement: { status: "present" as const },
}
const READINESS_MISSING = {
  business_requirement: { status: "missing" as const, message: MISSING_MESSAGE },
}

describe("DecisionsList — the 199-04 resting inventory, all five rows", () => {
  it("a POPULATED draft with an ABSENT readiness paints exactly these atoms", () => {
    renderList()
    expect(allRowAtoms()).toEqual({
      "knowledge-base": [decisionRowLabel("knowledge-base"), FOLDER_NAME, DECISION_CHANGE_ACTION],
      template: [decisionRowLabel("template"), TEMPLATE_FILENAME, DECISION_OPEN_STEP_ACTION],
      requirement: [
        decisionRowLabel("requirement"),
        BUSINESS_REQUIREMENT,
        DECISION_CHANGE_ACTION,
      ],
      name: [decisionRowLabel("name"), WORKFLOW_NAME],
      deliverable: [
        decisionRowLabel("deliverable"),
        DECISION_DELIVERABLE_FILE,
        DECISION_OPEN_STEP_ACTION,
      ],
    })
  })

  it("an EMPTY draft paints the four absence sentences and no row vanishes", () => {
    renderList(ALL_ABSENT)
    expect(allRowAtoms()).toEqual({
      "knowledge-base": [
        decisionRowLabel("knowledge-base"),
        DECISION_KB_NONE,
        DECISION_CHANGE_ACTION,
      ],
      // No producing step, so rows 2 and 5 render NO jump — one mechanism, one absence.
      template: [decisionRowLabel("template"), DECISION_TEMPLATE_NONE],
      requirement: [
        decisionRowLabel("requirement"),
        DECISION_REQUIREMENT_NONE,
        DECISION_CHANGE_ACTION,
      ],
      name: [decisionRowLabel("name"), DECISION_NAME_NONE],
      deliverable: [decisionRowLabel("deliverable"), DECISION_DELIVERABLE_CHAT],
    })
  })

  it("ARM 1 (absent) and ARM 2 (present) are ATOM-FOR-ATOM identical on ALL FIVE rows", () => {
    // ⚠ THIS IS THE D-20 / T-197-03 INVARIANT AT ITS FULL WIDTH. The shipped suite asserts
    // that neither arm says anything affirmative; this asserts the stronger property the
    // charter actually claims — that the two are INDISTINGUISHABLE, on every row, not only
    // on the one that carries a verdict. A badge, a tick or a grey "not reported" caption
    // on any row would break this and nothing else in the suite would see it.
    const { unmount } = renderList({ readiness: undefined })
    const absentArm = allRowAtoms()
    unmount()
    renderList({ readiness: READINESS_PRESENT })
    expect(allRowAtoms()).toEqual(absentArm)
  })

  it("ARM 3 (missing) differs from the other two on ROW 3 ALONE — the other four are untouched", () => {
    const { unmount } = renderList({ businessRequirement: "", readiness: undefined })
    const absentArm = allRowAtoms()
    unmount()
    renderList({ businessRequirement: "", readiness: READINESS_MISSING })
    const missingArm = allRowAtoms()
    for (const key of DECISION_ROW_ORDER) {
      if (key === "requirement") {
        expect(missingArm[key]).not.toEqual(absentArm[key])
        expect(missingArm[key]).toEqual([...absentArm[key], MISSING_MESSAGE])
      } else {
        expect(missingArm[key], `row "${key}" moved when only row 3 may`).toEqual(
          absentArm[key],
        )
      }
    }
  })

  it("POSITIVE CONTROL — the arm comparison really would see a one-atom difference", () => {
    // Driven RED once during Task 1 against a planted extra atom, then kept permanently.
    // Without it, a `rowAtoms` that returned `[]` for everything would make both cases
    // above pass against any component at all.
    const absentArm = { requirement: ["a", "b"] }
    const planted = { requirement: ["a", "b", MISSING_MESSAGE] }
    expect(planted.requirement).not.toEqual(absentArm.requirement)
    expect(planted.requirement).toEqual([...absentArm.requirement, MISSING_MESSAGE])
  })
})

describe("DecisionsList — sheet c5 asks for a status vocabulary this contract forbids", () => {
  /**
   * ⚠ SKETCH 178'S WORDS, NOT THIS APPLICATION'S — the one place this file spells strings
   * as literals, and the reason is that they are needles asserted ABSENT from the rendered
   * DOM. Nothing below greps a source, so the D-ITEM-183-02 trap cannot apply.
   *
   * ⚠ THE SKETCH README CLAIMS THIS SHEET *"reproduces our shipped `decisionsVocabulary`
   * contract: three arms per row, an explicit not reported, and only the grounding row
   * claiming a publish requirement."* **A `key_links`-style claim in a document is a claim
   * to VERIFY, not a fact** — and measured against the sheet's own markup it does not hold.
   * The full reconciliation is in `199-04-SUMMARY.md`; this case pins the consequence.
   */
  const SHEET_C5_STATUS_WORDS = [
    "Satisfied",
    "Needs You",
    "Not reported",
    "Unknown",
    "Correction control",
  ]

  it("no row renders any of the sheet's status-badge words, in ANY of the three arms", () => {
    for (const readiness of [undefined, READINESS_PRESENT, READINESS_MISSING]) {
      const { unmount } = renderList({ businessRequirement: "", readiness })
      const read = readableText(screen.getByTestId("decisions-list"))
      // Non-vacuity BEFORE the negatives: an empty read passes every `not.toContain`.
      expect(read.length).toBeGreaterThan(0)
      for (const word of SHEET_C5_STATUS_WORDS) {
        expect(read, `sheet c5's "${word}" reached the shipped list`).not.toContain(word)
      }
      unmount()
    }
  })

  it("POSITIVE CONTROL — the sweep really would see one of those words if it appeared", () => {
    const plant = document.createElement("div")
    plant.textContent = `${decisionRowLabel("knowledge-base")} ${SHEET_C5_STATUS_WORDS[0]}`
    const read = readableText(plant)
    expect(SHEET_C5_STATUS_WORDS.some((w) => read.includes(w))).toBe(true)
  })
})

describe("DecisionsList — the label column and the verdict indent may not drift apart", () => {
  /**
   * A latent defect found by the 199-04 inventory rather than by a failure.
   *
   * The label cell declares a FIXED width and the row declares a gap; the verdict
   * paragraph on row 3 is indented by a SEPARATE hard-coded figure that has to equal the
   * two added together, or the server's sentence stops lining up under the answer it is
   * about. Nothing connected the three numbers, so any future spacing change would have
   * silently misaligned the one sentence on this surface that is not ours.
   *
   * Tailwind's JIT needs each arbitrary value as a static literal, so the three cannot be
   * computed from one constant at runtime. They are therefore tied together HERE, by
   * reading them back out of the component's own source and checking the arithmetic. That
   * is the strongest available statement, and it is stronger than a comment.
   */
  const gapScaleToPx = (n: number) => n * 4

  it("the verdict indent EQUALS the label width plus the row gap", () => {
    const label = /w-\[(\d+)px\]\s+shrink-0\s+text-muted-foreground/.exec(decisionsListSource)
    const gap = /flex\s+items-baseline\s+gap-(\d+)/.exec(decisionsListSource)
    const indent = /mt-1\s+pl-\[(\d+)px\]/.exec(decisionsListSource)
    // Non-vacuity FIRST: three regexes that matched nothing would make the sum trivially
    // comparable to itself and this fence would pass on any file at all.
    expect(label, "the label cell's fixed width is no longer where this fence looks").not.toBeNull()
    expect(gap, "the row's gap utility is no longer where this fence looks").not.toBeNull()
    expect(indent, "the verdict's indent is no longer where this fence looks").not.toBeNull()
    const labelPx = Number(label?.[1])
    const gapPx = gapScaleToPx(Number(gap?.[1]))
    const indentPx = Number(indent?.[1])
    expect(labelPx).toBeGreaterThan(0)
    expect(gapPx).toBeGreaterThan(0)
    expect(indentPx).toBe(labelPx + gapPx)
  })

  it("POSITIVE CONTROL — the arithmetic really fails when the three drift apart", () => {
    // Driven RED once during Task 1 by planting a fourth figure, then kept permanently.
    expect(136).toBe(128 + gapScaleToPx(2))
    expect(140).not.toBe(128 + gapScaleToPx(2))
  })
})
