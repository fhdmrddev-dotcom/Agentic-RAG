/**
 * Phase 197-08 Task 2/3 — the ONE-CARD arrival composition, machine-checked.
 *
 * A NET-NEW suite. It absorbs, replaces and re-implements nothing — Phase 177's
 * coverage-loss lesson (a "net-new" file that quietly REPLACED an existing suite, so the
 * total never moved and nobody noticed) is exactly why `scripts/vitest-count-gate.cjs`
 * pins per-file counts. This file already sits inside the `src/components/workflows`
 * target glob, so `TARGETS` needs no edit.
 *
 * ── NO USER-VISIBLE STRING IS SPELLED AS A LITERAL HERE ──
 * Every expectation references an identifier imported from `decisionsVocabulary` or from
 * `definitionOps`. A string literal in a test is a SECOND SPELLING of a locked string, and
 * the whole point of those modules is that drift is assertable by character-identity. The
 * fixture values below (a folder name, a filename, a requirement) are this file's own data
 * and are compared to themselves.
 *
 * ── ⚠ WHAT jsdom CANNOT PROVE HERE, STATED UP FRONT ──
 * The composition hides the receipt's now-duplicate heading, dismiss control and closing
 * line with `display`, applied by Tailwind arbitrary child variants. **jsdom applies no
 * CSS**, so those nodes are PRESENT in every assertion below. This suite therefore proves
 * the STRUCTURE the CSS then hides — exactly one of each handle INSIDE the suppression
 * wrapper and exactly one of each OUTSIDE it — which is the strongest deterministic
 * statement jsdom permits. THE APPEARANCE IS OWED TO G-4 ROW U1, and the case that carries
 * that structure names U1 in its title so the debt cannot go quiet. This project's own
 * lesson governs: geometry proves composition; only LOOKING proves appearance.
 *
 * ⚠ Every needle in the source-fence block is ASSEMBLED FROM PARTS, so a grep of this
 * guard file can neither satisfy nor break the greps it exists to protect — the
 * D-ITEM-183-02 trap that `196-08` tripped four times, once inside the comment written to
 * explain the first three.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import draftArrivalCardSource from "./DraftArrivalCard?raw"
// THIS FILE'S OWN SOURCE, for the testid-coverage sweep at the bottom (the 187-20 idiom).
// `?raw` hands back the file as a STRING and evaluates no module, so the self-reference
// cannot introduce an import cycle — the same proven idiom as the line above it.
import testSource from "./DraftArrivalCard.test?raw"
import { DraftArrivalCard, type DraftArrivalCardProps } from "./DraftArrivalCard"
import type { DecisionsListProps } from "./DecisionsList"
import {
  DECISIONS_FOLD_ACTION,
  DECISION_CHANGE_ACTION,
  DECISION_EDIT_LIMIT_NOTE,
  DECISION_ROW_ORDER,
  GROUNDING_FOLD_ACTION,
  decisionRowLabel,
  decisionsFoldSummary,
  groundingFoldSummary,
} from "./decisionsVocabulary"
import {
  SEED_RECEIPT_DISMISS_GLYPH,
  SEED_RECEIPT_DISMISS_LABEL,
  SEED_RECEIPT_NOTHING_COMMITTED,
  seedReceiptHeading,
} from "./definitionOps"
import type { PhaseSpecJSON } from "./phaseVocabulary"

// ── fixtures ─────────────────────────────────────────────────────────────────────────

/** The SERVER's list, mirrored here as a FIXTURE only — no component owns it. The same
 *  five names `SeedReceipt.test.tsx` uses, so the two suites agree about what "grounded"
 *  means rather than each having a private definition. */
const KB_TOOLS = [
  "search_documents",
  "query_documents",
  "read_document",
  "analyze_document",
  "get_related_documents",
]

/**
 * A drafted definition with TWO steps that reach for the documents and ONE deliverable
 * already held by its own citation policy — THREE sealed steps in total.
 *
 * ⚠ The deliverable carries the SHIPPED DEFAULT. The generation endpoint returns a full
 * model dump, which emits defaults, so every generated deliverable reaches the client
 * carrying it. A fixture that avoided it would be a fixture avoiding the shipped shape —
 * the CR-02 blind spot `SeedReceipt.test.tsx` records at length.
 */
const GROUNDED_PHASES: PhaseSpecJSON[] = [
  { slug: "gather", phase_index: 0, name: "Collect the renewal inputs", config: { phase_type: "programmatic" } },
  {
    slug: "contracts",
    phase_index: 1,
    name: "Search Supplier Contracts",
    config: { phase_type: "llm_agent", available_tools: ["search_documents", "execute_code"] },
  },
  {
    slug: "policy_check",
    phase_index: 2,
    name: "Run the pricing policy check",
    config: { phase_type: "llm_agent", available_tools: ["execute_code", "read_document"] },
  },
  { slug: "write", phase_index: 3, name: "Draft the renewal summary", config: { phase_type: "llm_single" } },
  {
    slug: "emit",
    phase_index: 4,
    name: "Produce the renewal pack",
    config: { phase_type: "llm_emit", citation_policy: "strict" },
  },
]

/** The number of sealed steps in the fixture above — asserted rather than assumed by the
 *  first case, so a fixture drift shows up as its own failure. */
const GROUNDED_COUNT = 3

/**
 * A draft where NOTHING is sealed at all.
 *
 * The deliverable CANNOT use the default here: the default is already-held, which would
 * seal it and make this draft non-empty. The member chosen instead is still a value the
 * backend can produce — the only honest way to reach the zero case without inventing an
 * unrepresentable one.
 */
const UNGROUNDED_PHASES: PhaseSpecJSON[] = [
  { slug: "gather", phase_index: 0, name: "Collect the renewal inputs", config: { phase_type: "programmatic" } },
  { slug: "write", phase_index: 1, name: "Draft the renewal summary", config: { phase_type: "llm_single" } },
  {
    slug: "emit",
    phase_index: 2,
    name: "Produce the renewal pack",
    config: { phase_type: "llm_emit", citation_policy: "draft" },
  },
]

const FOLDER_NAME = "Vendor contracts"
const TEMPLATE_FILENAME = "renewal-brief.docx"
const BUSINESS_REQUIREMENT =
  "Produce a cited vendor-risk brief for each vendor under review this quarter."
const WORKFLOW_NAME = "Vendor renewal brief"
const STEP_SLUG = "emit"

function decisionsProps(over: Partial<DecisionsListProps> = {}): DecisionsListProps {
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

function renderCard(over: Partial<DraftArrivalCardProps> = {}) {
  const onDismiss = vi.fn()
  const decisions = decisionsProps()
  const props: DraftArrivalCardProps = {
    phases: GROUNDED_PHASES,
    kbTools: KB_TOOLS,
    open: true,
    onDismiss,
    decisions,
    ...over,
  }
  const result = render(<DraftArrivalCard {...props} />)
  return { ...result, onDismiss, decisions, props }
}

/** Occurrences of `needle` in `haystack` — a count, never a boolean, because "appears at
 *  least once" is exactly the assertion a duplicated sentence would satisfy. */
function countOccurrences(haystack: string, needle: string): number {
  if (needle === "") return 0
  let found = 0
  let at = haystack.indexOf(needle)
  while (at !== -1) {
    found += 1
    at = haystack.indexOf(needle, at + needle.length)
  }
  return found
}

/**
 * Everything an author READS on the card, with the suppression wrapper's subtree removed.
 *
 * ⚠ THIS IS THE HONEST READ IN jsdom, and the reason is worth stating rather than hiding
 * behind a helper name. The composed receipt really does render its own copy of the
 * closing sentence and its own heading; the shipped CSS hides both, and jsdom applies no
 * CSS. Reading `textContent` of the whole card would therefore count nodes the author
 * cannot see. Removing the wrapper's subtree measures exactly what the card OWNS, which is
 * the claim the one-card shape actually makes. The suppressed nodes are counted separately,
 * by testid, in the U1 case below.
 */
function textOutsideTheWrapper(): string {
  const card = screen.getByTestId("draft-arrival-card").cloneNode(true) as HTMLElement
  for (const wrapper of card.querySelectorAll("[data-testid=draft-arrival-grounding-body]")) {
    wrapper.remove()
  }
  return card.textContent ?? ""
}

// ── 1. ONE CARD, AND NOTHING AT ALL WHEN CLOSED ──────────────────────────────────────

describe("DraftArrivalCard — one card", () => {
  it("renders exactly ONE arrival card", () => {
    const { container } = renderCard()
    expect(screen.getAllByTestId("draft-arrival-card")).toHaveLength(1)
    // …and it is the container's only element child, so the page's three-row graph grid
    // keeps exactly three children when this replaces the receipt in place.
    expect(container.childElementCount).toBe(1)
  })

  it("renders NOTHING when the caller closes it — no hidden DOM, no stale focus trap", () => {
    const { container } = renderCard({ open: false })
    expect(container.innerHTML).toBe("")
  })
})

// ── 2. THE COLLAPSED ARRIVAL STATE — sketch 174's four lines ─────────────────────────

describe("DraftArrivalCard — the four-line arrival state", () => {
  it("mounts with BOTH folds closed — neither child is in the DOM", () => {
    renderCard()
    expect(screen.queryByTestId("seed-receipt")).toBeNull()
    expect(screen.queryByTestId("decisions-list")).toBeNull()
    expect(screen.queryByTestId("draft-arrival-grounding-body")).toBeNull()
    expect(screen.queryByTestId("draft-arrival-decisions-body")).toBeNull()
  })

  it("takes its heading from the receipt's OWN formatter, never a spelled literal", () => {
    renderCard()
    expect(screen.getByTestId("draft-arrival-heading").textContent).toBe(
      seedReceiptHeading(GROUNDED_PHASES.length),
    )
  })

  it("derives the grounded count from the ONE home — the summary is the vocabulary's", () => {
    renderCard()
    // The count is the fixture's three sealed steps, and the SENTENCE is the vocabulary's.
    // Asserting the formatter's output rather than a number is what makes this a claim
    // about the rendered card rather than about arithmetic.
    expect(screen.getByTestId("draft-arrival-fold-grounding-summary").textContent).toBe(
      groundingFoldSummary(GROUNDED_COUNT),
    )
  })

  it("takes the decisions summary from the exported row order, never from a literal", () => {
    renderCard()
    expect(screen.getByTestId("draft-arrival-fold-decisions-summary").textContent).toBe(
      decisionsFoldSummary(DECISION_ROW_ORDER.length),
    )
  })

  it("gives each fold line its own action word, and reports both as collapsed", () => {
    renderCard()
    const grounding = screen.getByTestId("draft-arrival-fold-grounding")
    const decisions = screen.getByTestId("draft-arrival-fold-decisions")
    expect(within(grounding).getByText(GROUNDING_FOLD_ACTION)).toBeTruthy()
    expect(within(decisions).getByText(DECISIONS_FOLD_ACTION)).toBeTruthy()
    expect(grounding.getAttribute("aria-expanded")).toBe("false")
    expect(decisions.getAttribute("aria-expanded")).toBe("false")
  })

  it("closes with the receipt's own sentence, and says it EXACTLY ONCE", () => {
    // ⚠ WHAT THIS CATCHES, STATED NARROWLY. In the collapsed state the receipt is not
    // mounted at all, so a SECOND occurrence here could only come from the parent saying
    // the sentence twice itself. It does NOT prove the suppression list is right — that is
    // fence 5's job, and the fold-open sibling below says so rather than implying more.
    renderCard()
    expect(screen.getByTestId("draft-arrival-close").textContent).toBe(
      SEED_RECEIPT_NOTHING_COMMITTED,
    )
    expect(countOccurrences(textOutsideTheWrapper(), SEED_RECEIPT_NOTHING_COMMITTED)).toBe(1)
  })
})

// ── 3. THE FOLDS GENUINELY FOLD ──────────────────────────────────────────────────────

describe("DraftArrivalCard — the folds", () => {
  it("fold 1 mounts exactly ONE receipt, and reveals the REAL receipt's content", async () => {
    const user = userEvent.setup()
    renderCard()
    expect(screen.queryAllByTestId("seed-receipt")).toHaveLength(0)

    await user.click(screen.getByTestId("draft-arrival-fold-grounding"))

    expect(screen.getAllByTestId("seed-receipt")).toHaveLength(1)
    expect(screen.getByTestId("draft-arrival-fold-grounding").getAttribute("aria-expanded")).toBe(
      "true",
    )
    // …and it is the composed receipt rather than a redrawn copy: its own grounded list is
    // present, and so is a row for a step the fixture grounds.
    const body = screen.getByTestId("draft-arrival-grounding-body")
    expect(within(body).getByTestId("seed-receipt-grounded-list")).toBeTruthy()
    expect(
      body.querySelectorAll("[data-testid=seed-receipt-grounded-list] [data-slug]"),
    ).toHaveLength(GROUNDED_COUNT)
  })

  it("fold 1 open — ONE heading, dismiss and close inside the wrapper, ONE of each outside (appearance owed to G-4 row U1)", async () => {
    // ⚠ jsdom APPLIES NO CSS, so the three suppressed nodes are present here. This case
    // pins the STRUCTURE the shipped `display` rules then hide; that the author cannot SEE
    // them is U1's obligation and is not claimed by this suite.
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByTestId("draft-arrival-fold-grounding"))

    const card = screen.getByTestId("draft-arrival-card")
    const wrapper = screen.getByTestId("draft-arrival-grounding-body")

    for (const handle of ["seed-receipt-heading", "seed-receipt-dismiss", "seed-receipt-close"]) {
      expect(
        wrapper.querySelectorAll(`[data-testid=${handle}]`),
        `${handle} must appear exactly once inside the wrapper`,
      ).toHaveLength(1)
      expect(
        card.querySelectorAll(`[data-testid=${handle}]`),
        `${handle} must exist ONLY inside the wrapper`,
      ).toHaveLength(1)
    }

    // …and the card's OWN heading and closing line are outside the wrapper, once each.
    expect(wrapper.querySelectorAll("[data-testid=draft-arrival-heading]")).toHaveLength(0)
    expect(wrapper.querySelectorAll("[data-testid=draft-arrival-close]")).toHaveLength(0)
    expect(card.querySelectorAll("[data-testid=draft-arrival-heading]")).toHaveLength(1)
    expect(card.querySelectorAll("[data-testid=draft-arrival-close]")).toHaveLength(1)
  })

  it("fold 1 open — the card still says the closing sentence exactly once in its OWN text", async () => {
    // ⚠ AND WHAT IT DOES NOT PROVE. The wrapper's subtree is removed before counting, so
    // this case is BLIND to the suppression list by construction — it measures what the
    // card owns, not what the CSS hides. The suppression list is fenced at the SOURCE
    // (fence 5) and its appearance is owed to G-4 row U1. Saying so here is cheaper than
    // discovering later that a green case meant less than its name suggested.
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByTestId("draft-arrival-fold-grounding"))
    expect(countOccurrences(textOutsideTheWrapper(), SEED_RECEIPT_NOTHING_COMMITTED)).toBe(1)
    expect(
      countOccurrences(textOutsideTheWrapper(), seedReceiptHeading(GROUNDED_PHASES.length)),
    ).toBe(1)
  })

  it("fold 2 mounts exactly ONE decisions list, carrying the module's row count", async () => {
    const user = userEvent.setup()
    renderCard()
    expect(screen.queryAllByTestId("decisions-list")).toHaveLength(0)

    await user.click(screen.getByTestId("draft-arrival-fold-decisions"))

    const lists = screen.getAllByTestId("decisions-list")
    expect(lists).toHaveLength(1)
    expect(lists[0].getAttribute("data-row-count")).toBe(String(DECISION_ROW_ORDER.length))
    expect(screen.getByTestId("draft-arrival-decisions-body")).toBeTruthy()
  })

  it("both folds open at once, and closing either unmounts ONLY its own body", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByTestId("draft-arrival-fold-grounding"))
    await user.click(screen.getByTestId("draft-arrival-fold-decisions"))
    expect(screen.getAllByTestId("seed-receipt")).toHaveLength(1)
    expect(screen.getAllByTestId("decisions-list")).toHaveLength(1)

    await user.click(screen.getByTestId("draft-arrival-fold-grounding"))
    expect(screen.queryByTestId("seed-receipt")).toBeNull()
    expect(screen.getAllByTestId("decisions-list")).toHaveLength(1)

    await user.click(screen.getByTestId("draft-arrival-fold-decisions"))
    expect(screen.queryByTestId("decisions-list")).toBeNull()
    expect(screen.getByTestId("draft-arrival-card")).toBeTruthy()
  })

  it("a draft with NO grounded step drops fold line 1 entirely — fold line 2 stays", () => {
    // The zero arm of the copy formatter, rendered as ONE conditional line rather than a
    // sentence claiming zero of something.
    expect(groundingFoldSummary(0)).toBe("")
    renderCard({ phases: UNGROUNDED_PHASES })
    expect(screen.queryByTestId("draft-arrival-fold-grounding")).toBeNull()
    expect(screen.queryByTestId("draft-arrival-fold-grounding-summary")).toBeNull()
    expect(screen.getByTestId("draft-arrival-fold-decisions")).toBeTruthy()
    expect(screen.getByTestId("draft-arrival-fold-decisions-summary").textContent).toBe(
      decisionsFoldSummary(DECISION_ROW_ORDER.length),
    )
    // …and the card still closes with its own sentence, so the arrival shape is unchanged.
    expect(screen.getByTestId("draft-arrival-close").textContent).toBe(
      SEED_RECEIPT_NOTHING_COMMITTED,
    )
  })
})

// ── 4. DISMISSAL IS THE CALLER'S ─────────────────────────────────────────────────────

describe("DraftArrivalCard — dismissal", () => {
  it("calls onDismiss exactly once, and does NOT close itself", async () => {
    const user = userEvent.setup()
    const { onDismiss } = renderCard()
    const dismiss = screen.getByTestId("draft-arrival-dismiss")
    expect(dismiss.getAttribute("aria-label")).toBe(SEED_RECEIPT_DISMISS_LABEL)

    await user.click(dismiss)

    expect(onDismiss).toHaveBeenCalledTimes(1)
    // `open` is still true, so the card is still here. A component that closed itself
    // would pass a "calls the handler" assertion and break the shipped contract.
    expect(screen.getByTestId("draft-arrival-card")).toBeTruthy()
  })
})

// ── 5. THE DECISIONS OBJECT REACHES ITS CHILD INTACT ─────────────────────────────────

describe("DraftArrivalCard — pass-through", () => {
  it("forwards the decisions object — an ANSWER renders and an ACTION fires", async () => {
    // Driven rather than shallow-compared: a props object that reached the child but was
    // never rendered would satisfy a comparison and fail an author.
    const user = userEvent.setup()
    const { decisions } = renderCard()
    await user.click(screen.getByTestId("draft-arrival-fold-decisions"))

    expect(screen.getByTestId("decision-answer-knowledge-base").textContent).toBe(FOLDER_NAME)
    expect((screen.getByTestId("decision-name-input") as HTMLInputElement).value).toBe(
      WORKFLOW_NAME,
    )

    const changeKb = screen.getByTestId("decision-action-knowledge-base")
    expect(changeKb.textContent).toBe(DECISION_CHANGE_ACTION)
    await user.click(changeKb)
    expect(decisions.onChangeKb).toHaveBeenCalledTimes(1)

    await user.click(screen.getByTestId("decision-action-deliverable"))
    expect(decisions.onOpenStep).toHaveBeenCalledWith(STEP_SLUG)
  })
})

// ── 6. THE CHARTER FENCES (the shipped `?raw` house idiom, adopted from SeedReceipt) ──

/** The component's source with COMMENTS REMOVED. Block comments go entirely; a line is cut
 *  at the first `//` that begins the line or follows whitespace, which leaves regex
 *  literals (whose `//` follows a backslash) and `://` intact.
 *
 *  ⚠ THIS IS WHAT MAKES THE PROSE FENCE HONEST. A component is allowed — required, even —
 *  to EXPLAIN its own rules in a docblock, and a file-wide grep flags every such
 *  explanation. That is the D-ITEM-183-02 trap that cost plans 185-09 and 185-10 three
 *  false positives each. Over-stripping is the safe direction: removing a live literal
 *  turns a fence red and is seen immediately, while leaving a commented one in place is a
 *  silent pass. */
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

describe("DraftArrivalCard — the five charter clauses, each fenced", () => {
  /** Built fresh per use: a `/g` regex carries `lastIndex` across calls, and a stateful
   *  guard is a guard that reports different answers to the same question. */
  const stringLiteralRx = () =>
    /"([^"\\\n]*(?:\\.[^"\\\n]*)*)"|'([^'\\\n]*(?:\\.[^'\\\n]*)*)'/g
  /**
   * JSX text — whatever sits between a closing `>` and the next `<`, with no brace in it
   * (a brace means it is an expression, which the literal sweep already covers).
   *
   * ⚠ THE SIBLING SUITE'S TAIL IS `[^<>{}]*`, WHICH ADMITS NEWLINES, AND THAT WAS MEASURED
   * WRONG ON THIS FILE RATHER THAN REASONED ABOUT. It made the arm run from the `>` of an
   * arrow function, across several lines of ordinary code, to the next `<` — capturing
   * `(groundingCauseOf(phase, kbTools) !== null ? total + 1 : total), 0, ), [phases,
   * kbTools], )`. Two adjacent lowercase words are trivially present in code, and the
   * TERNARY'S `?` followed by a space satisfies the prose mark, so the fence fired on the
   * correct code it sits beside — the failure mode that gets a fence deleted instead of
   * fixed. Pinning the tail to a SINGLE LINE is a strict tightening: real JSX text is a
   * short run of words on one line, and both planted controls below still fire.
   */
  const jsxTextRx = () => />([^<>{}\n]*[A-Za-z]{2,}[^<>{}\n]*)</g

  /**
   * PROSE, not length. Two adjacent lowercase words AND a mark that only prose carries.
   *
   * ⚠ THE "MORE THAN N WORDS" HALF WAS TRIED AND REJECTED by the sibling suite, for a
   * measured reason this file inherits rather than re-derives: a tailwind class string is
   * many space-separated words, so a word-count arm fires on every `className` in the file
   * — which is the correct code the fence sits beside. The punctuation arm does not: a
   * class string carries no sentence-ending mark and no em dash, and the decimal inside an
   * arbitrary size is followed by a digit rather than by whitespace or end-of-string. A
   * control below plants a real class string LIFTED OUT OF THIS COMPONENT and proves the
   * detector stays quiet on it.
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
  const API_SPECIFIER = ["@/lib", "/api"].join("")
  const VOCABULARY_SPECIFIER = ["@/components/workflows", "/decisionsVocabulary"].join("")
  const COPY_SPECIFIER = ["@/components/workflows", "/definitionOps"].join("")
  const RAW_HTML_PROP = ["dangerously", "SetInnerHTML"].join("")
  /** The three values the ONE grounding derivation can return. A file that named any of
   *  them would be a file deciding a cause rather than counting one. */
  const CAUSE_TOKENS = [
    ["de", "tected"].join(""),
    ["already", "-", "set"].join(""),
    ["esc", "alated"].join(""),
  ]
  /** The governance seal, by codepoint — never written out, so this guard's own source
   *  cannot satisfy the fence it exists to protect. */
  const SEAL_GLYPH = String.fromCodePoint(0x26e8)
  /** The receipt's per-row handle PREFIX. A file constructing one would be redrawing the
   *  receipt's list instead of composing it. */
  const STEP_HANDLE_PREFIX = ["seed-receipt", "-step"].join("")
  /** A module-scope function declaration. The component is the ONLY one this file may
   *  declare — a predicate has to live SOMEWHERE, and this is the property that says there
   *  is nowhere for it to live. */
  const declarationRx = () => /^\s*(export\s+)?function\s+\w+/gm
  /** Every handle this component targets with an arbitrary child variant. Assembled, and
   *  it is what fence 5 reads instead of eyeballing a class soup. */
  const suppressionTargetRx = () =>
    new RegExp(`\\[&_\\[data-${"testid"}=([a-z-]+)\\]\\]`, "g")
  const suppressedHandles = () => [
    ...new Set([...draftArrivalCardSource.matchAll(suppressionTargetRx())].map((m) => m[1])),
  ]

  // ── FENCE 1 — it authors no sentence of its own ──────────────────────────────────

  it("authors NO sentence of its own — every word an author reads is imported", () => {
    expect(authoredSentences(draftArrivalCardSource)).toEqual([])
  })

  it("POSITIVE CONTROL — it takes its words from BOTH copy homes", () => {
    // The half that makes the fence above mean something. An absent-sentence fence proves
    // nothing on a file that renders nothing.
    expect(draftArrivalCardSource).toContain(COPY_SPECIFIER)
    expect(draftArrivalCardSource).toContain(VOCABULARY_SPECIFIER)
    for (const identifier of [
      "seedReceiptHeading",
      "SEED_RECEIPT_NOTHING_COMMITTED",
      "SEED_RECEIPT_DISMISS_LABEL",
      "SEED_RECEIPT_DISMISS_GLYPH",
      "groundingFoldSummary",
      "decisionsFoldSummary",
      "GROUNDING_FOLD_ACTION",
      "DECISIONS_FOLD_ACTION",
    ]) {
      expect(draftArrivalCardSource).toContain(identifier)
    }
  })

  it("POSITIVE CONTROL — the prose detector fires on a planted sentence, and is QUIET on this component's own class strings", () => {
    // Both halves, because a detector that never fires and a detector that always fires
    // are indistinguishable from a green run.
    const planted = `const copy = ${JSON.stringify(SEED_RECEIPT_NOTHING_COMMITTED)}`
    expect(authoredSentences(planted)).toEqual([SEED_RECEIPT_NOTHING_COMMITTED])
    // …and a JSX text node, the other spelling a sentence can take.
    const jsxPlanted = `<p>${SEED_RECEIPT_NOTHING_COMMITTED}</p>`
    expect(authoredSentences(jsxPlanted)).toEqual([SEED_RECEIPT_NOTHING_COMMITTED])
    // ⚠ AND THE REJECTION, planted with class strings LIFTED VERBATIM OUT OF THE
    // COMPONENT rather than invented for the control — a control that uses a clean string
    // proves only that clean strings work.
    const frameClass =
      '"w-full max-w-[720px] rounded-[14px] border border-border bg-card px-[18px] py-4 shadow-lg"'
    const foldClass =
      '"mt-1 flex w-full items-baseline gap-2 rounded px-1 py-[3px] text-left text-[12.5px]"'
    expect(authoredSentences(frameClass)).toEqual([])
    expect(authoredSentences(foldClass)).toEqual([])
    // …and prose living in a COMMENT is not copy, and must not be flagged.
    expect(authoredSentences("// one card, two components underneath.")).toEqual([])
    expect(authoredSentences("/* Merging halves the arrival chrome. */")).toEqual([])
    // ⚠ THE KNOWN NARROWING, ASSERTED RATHER THAN LEFT AS A HOPE. Pinning the JSX arm to a
    // single line means a sentence WRAPPED across two JSX lines is not seen by that arm.
    // It is stated here so a later reader finds the limit in the guard rather than in a
    // defect. It costs little: the string-literal arm is unaffected and still catches the
    // same sentence the moment it is assigned to anything.
    expect(authoredSentences("<p>\n  Nothing is saved yet.\n</p>")).toEqual([])
    expect(
      authoredSentences('const copy = "Nothing is saved yet."'),
    ).toEqual(["Nothing is saved yet."])
  })

  // ── FENCE 2 — it declares no predicate of its own ────────────────────────────────

  it("declares NO predicate of its own — the component is the only declaration, and no cause is named", () => {
    // THE PROPERTY, not a deny-list. The Phase-185 lesson says a deny-list cannot be made
    // fail-closed by extension, so rather than naming the shapes a predicate could take
    // this asserts there is nowhere for one to live.
    const declared = draftArrivalCardSource.match(declarationRx()) ?? []
    expect(declared).toHaveLength(1)
    expect(declared[0]).toContain("DraftArrivalCard")
    // …and no cause-token table, which is the other shape a second derivation takes.
    for (const token of CAUSE_TOKENS) {
      expect(draftArrivalCardSource, `${token} must not be named here`).not.toContain(token)
    }
  })

  it("POSITIVE CONTROL — it CONSUMES the one grounding home rather than recomputing it", () => {
    // Without this the fence above passes on a file that simply never mentions grounding.
    expect(draftArrivalCardSource).toContain("groundingCauseOf")
    expect(draftArrivalCardSource).toContain(["@/components/workflows", "/phaseVocabulary"].join(""))
    // …and it does not read the receipt's own published count back out of the DOM either.
    expect(draftArrivalCardSource).not.toMatch(/data-grounded-count|querySelector/)
  })

  it("those two fences are real — each pattern matches its planted literal", () => {
    const PLANTED_PREDICATE = [
      "function stepReadsTheDocuments(",
      "  phase: PhaseSpecJSON,",
      "): boolean {",
      "  return phase.config.phase_type === 'llm_agent'",
      "}",
    ].join("\n")
    expect(PLANTED_PREDICATE.match(declarationRx()) ?? []).toHaveLength(1)
    const two = `${PLANTED_PREDICATE}\n\nexport function DraftArrivalCard({`
    expect(two.match(declarationRx()) ?? []).toHaveLength(2)
    // …and it must NOT fire on the component's own arrow callbacks, which are correct.
    expect("onClick={() => setGroundingOpen((wasOpen) => !wasOpen)}").not.toMatch(
      declarationRx(),
    )
    // …and the cause sweep really does see a planted table.
    const plantedTable = `const REASONS = { ${CAUSE_TOKENS[0]}: 1 }`
    expect(plantedTable).toContain(CAUSE_TOKENS[0])
  })

  // ── FENCE 3 — it opens no request and names no route ─────────────────────────────

  it("opens NO request, names NO route, and touches the API client in NO form", () => {
    expect(draftArrivalCardSource).not.toMatch(/fetch\(/)
    expect(draftArrivalCardSource).not.toMatch(
      /XMLHttpRequest|EventSource|navigator\.sendBeacon/,
    )
    // A string literal that STARTS with a path separator — the shape every route takes.
    // Asserted as a property rather than as a list of route names.
    expect(draftArrivalCardSource).not.toMatch(/["']\/[a-z]/)
    // ⚠ STRICTER THAN ITS SIBLING, AND DELIBERATELY SO. `DecisionsList` needs one
    // type-only import for the readiness shape; this parent needs NONE, because the
    // readiness rides inside the decisions prop object. So the assertion is ABSENCE in
    // any form — value import, type import or bare mention.
    expect(draftArrivalCardSource).not.toContain(API_SPECIFIER)
  })

  it("POSITIVE CONTROL — the fence is not passing on a file that imports nothing", () => {
    expect(draftArrivalCardSource).toContain(COPY_SPECIFIER)
    expect(draftArrivalCardSource).toContain(VOCABULARY_SPECIFIER)
    expect(draftArrivalCardSource).toContain("import")
  })

  it("renders every authored string as a text child (T-197-19)", () => {
    expect(draftArrivalCardSource).not.toContain(RAW_HTML_PROP)
  })

  it("those fences are real — each pattern matches its planted literal", () => {
    expect('const r = await fetch("/x")').toMatch(/fetch\(/)
    expect("new EventSource(url)").toMatch(
      /XMLHttpRequest|EventSource|navigator\.sendBeacon/,
    )
    expect('const route = "/workflows/generate"').toMatch(/["']\/[a-z]/)
    // …and the route needle must NOT fire on a tailwind opacity, which carries a slash
    // inside the string rather than at its head — a real class from this component.
    expect('className="hover:bg-accent/40 hover:text-foreground"').not.toMatch(/["']\/[a-z]/)
    expect(`<p dangerouslySetInnerHTML={{ __html: m }} />`).toContain(RAW_HTML_PROP)
    expect(`import type { GenerateReadiness } from "${API_SPECIFIER}"`).toContain(
      API_SPECIFIER,
    )
  })

  // ── FENCE 4 — D-02: the receipt is COMPOSED, never redrawn ───────────────────────

  it("composes the receipt EXACTLY ONCE, and re-implements none of its content", () => {
    const mounts = draftArrivalCardSource.match(/<SeedReceipt/g) ?? []
    expect(mounts).toHaveLength(1)
    // The three shapes a redrawn copy would take, each a SOURCE property.
    expect(draftArrivalCardSource).not.toContain(SEAL_GLYPH)
    expect(draftArrivalCardSource).not.toContain(STEP_HANDLE_PREFIX)
    // It maps NOTHING: the receipt owns its own row list and the decisions list owns its
    // own row order. A second mapping here is a second copy of one of those.
    expect(draftArrivalCardSource).not.toContain(".map(")
  })

  it("POSITIVE CONTROL — the fence reads a file that really does compose the receipt", () => {
    // Without this, fence 4 passes on a file that never mentions the receipt at all.
    expect(draftArrivalCardSource).toContain("SeedReceipt")
    expect(draftArrivalCardSource).toContain(["@/components/workflows", "/SeedReceipt"].join(""))
    expect(draftArrivalCardSource).toContain("DecisionsList")
  })

  it("that fence is real — each pattern matches its planted literal", () => {
    expect(`<span>${SEAL_GLYPH}</span>`).toContain(SEAL_GLYPH)
    expect(`data-testid={\`${STEP_HANDLE_PREFIX}-\${row.slug}\`}`).toContain(
      STEP_HANDLE_PREFIX,
    )
    expect("rows.map((row) => null)").toContain(".map(")
    expect("<SeedReceipt a /><SeedReceipt b />".match(/<SeedReceipt/g) ?? []).toHaveLength(2)
  })

  // ── FENCE 5 — the suppression list is EXACTLY right, in BOTH directions ──────────

  it("suppresses EXACTLY the four frame and duplicate handles — no more", () => {
    const FRAME_HANDLE = ["seed", "receipt"].join("-")
    const EXPECTED = [
      FRAME_HANDLE,
      `${FRAME_HANDLE}-heading`,
      `${FRAME_HANDLE}-dismiss`,
      `${FRAME_HANDLE}-close`,
    ]
    expect([...suppressedHandles()].sort()).toEqual([...EXPECTED].sort())
  })

  it("suppresses NONE of the handles the fold exists to reveal", () => {
    // The other direction, stated separately rather than left implied by the equality
    // above: THIS is the assertion that catches a future edit quietly blanking the fold's
    // own content, and it names each handle it protects.
    const FRAME_HANDLE = ["seed", "receipt"].join("-")
    const CONTENT_HANDLES = [
      `${FRAME_HANDLE}-grounding`,
      `${FRAME_HANDLE}-carried`,
      `${FRAME_HANDLE}-grounded-list`,
      STEP_HANDLE_PREFIX,
    ]
    const suppressed = suppressedHandles()
    for (const handle of CONTENT_HANDLES) {
      expect(suppressed, `${handle} is the fold's own content and must stay visible`)
        .not.toContain(handle)
    }
  })

  it("POSITIVE CONTROL — the sweep really does find the targets, and would see a content handle if one were added", () => {
    // Without this the two fences above pass on a regex that matches nothing.
    expect(suppressedHandles().length).toBe(4)
    const FRAME_HANDLE = ["seed", "receipt"].join("-")
    const planted = `"[&_[data-${"testid"}=${FRAME_HANDLE}-grounded-list]]:hidden"`
    const seen = [...planted.matchAll(suppressionTargetRx())].map((m) => m[1])
    expect(seen).toEqual([`${FRAME_HANDLE}-grounded-list`])
  })

  it("POSITIVE CONTROL — the occurrence counter really counts, it does not merely detect", () => {
    // The helper section 2 leans on. `toBe(1)` on a boolean-shaped helper would pass on a
    // duplicated sentence, which is the exact failure that section exists to catch.
    const twice = `${SEED_RECEIPT_NOTHING_COMMITTED} ${SEED_RECEIPT_NOTHING_COMMITTED}`
    expect(countOccurrences(twice, SEED_RECEIPT_NOTHING_COMMITTED)).toBe(2)
    expect(countOccurrences(SEED_RECEIPT_NOTHING_COMMITTED, SEED_RECEIPT_NOTHING_COMMITTED)).toBe(
      1,
    )
    expect(countOccurrences("", SEED_RECEIPT_NOTHING_COMMITTED)).toBe(0)
  })
})

// ── 7. NO HANDLE SHIPS UNEXERCISED (the 187-20 / WR-13 sweep) ────────────────────────

describe("DraftArrivalCard — every rendered handle is queried by this suite", () => {
  /** Every spelling JSX admits for a STATIC `data-testid`. The character class excludes
   *  `$`, `{` and `}` deliberately, so a template-shaped testid can never be extracted as
   *  though it were static and then demanded as a literal query. */
  const staticTestIdRx = () =>
    /data-testid=(?:"([^"'{}$]+)"|\{\s*["']([^"'{}$]+)["']\s*\})/g

  it("every STATIC testid the component renders is QUERIED by this suite", () => {
    // IT MEASURES COVERAGE, NOT A MENTION: the suite's source is comment-stripped first,
    // so a query sitting inside a comment or a discarded block cannot satisfy it. The
    // needle is ASSEMBLED at runtime from each extracted name, so this guard's own source
    // contains no literal call it could satisfy itself with.
    const queried = withoutComments(testSource)
    const ids = [...draftArrivalCardSource.matchAll(staticTestIdRx())].map(
      (m) => m[1] ?? m[2],
    )
    const unique = [...new Set(ids)]
    // A regex that matched nothing would make every assertion below vacuous.
    expect(unique.length).toBeGreaterThan(0)
    expect(unique).toContain("draft-arrival-card")
    expect(unique).toContain("draft-arrival-close")
    for (const id of unique) expect(id).not.toContain("${")
    for (const id of unique) {
      expect(queried, `data-testid="${id}" is rendered but never queried`).toContain(
        `ByTestId("${id}")`,
      )
    }
  })

  it("publishes NO derived state attribute — the count is used, never exported to the DOM", () => {
    // The sibling suites sweep brace-valued `data-*` attributes because those ARE state.
    // This component deliberately publishes none: the grounded count is spent on one
    // sentence, and a surface that also wrote it into the DOM would invite the read-back
    // fence 2 forbids.
    const stateAttrs = [...draftArrivalCardSource.matchAll(/\sdata-([a-z][a-z-]*)=\{/g)].map(
      (m) => m[1],
    )
    expect(stateAttrs).toEqual([])
    // POSITIVE CONTROL — the sweep is not simply broken.
    expect([...' data-grounded-count={rows.length}'.matchAll(/\sdata-([a-z][a-z-]*)=\{/g)]).toHaveLength(
      1,
    )
  })
})

// ── 8. THE 199-04 RESTING INVENTORY, AND THE SHEET-c5 RECONCILIATION ─────────────────
//
// Phase 199-04 Task 1 (DES-01, sketch 178 sheet `c5-draft-arrival`).
//
// ⚠ THESE ARE CHARACTERIZATION PINS, NOT PREFERENCES. Every atom the card paints at rest
// and behind each fold is pinned PRESENT as an identifier, so that a later REMOVAL is
// proved by INVERTING the assertion rather than by deleting it (the `192.2-05` method). A
// pin deleted to turn a suite green proves nothing; a pin inverted states the change out
// loud and keeps the arithmetic closable.
//
// ⚠ WHAT "HEIGHT" MEANS HERE, STATED RATHER THAN IMPLIED — AND IT IS NOT A PIXEL.
// `SEED-184` measured this card at 147 px collapsed and 398 px with both folds open, in a
// browser. jsdom applies no CSS and reports `clientHeight` 0 — the same fact
// `editAffordance.test.ts` records at length — so those numbers are NOT reproducible here
// and asserting them would be a fabricated measurement.
//
// What IS deterministic is the card's DECLARED vertical box: the spacing utilities it
// emits, plus the type it declares on each text-bearing element. `declaredBox` below sums
// exactly that. It is a SURROGATE — its absolute value is not a pixel and must never be
// compared with `SEED-184`'s figures — but it MOVES whenever spacing or type changes,
// which is the property that makes "the card got quieter" falsifiable instead of a
// feeling. The real px reading stays OWED to a G-4 row, exactly as the suppression's
// appearance does.

/** The card's own private disclosure mark, read out of its source rather than spelled a
 *  second time here. A private constant has no vocabulary module to be locked in, and a
 *  literal copy would be exactly the second spelling this file exists to avoid. */
const FOLD_GLYPH_ATOM = (/const FOLD_GLYPH = "([^"]+)"/.exec(draftArrivalCardSource) ?? [])[1] ?? ""

/** Every atom an author READS inside `root`, trimmed, empty ones dropped, in DOCUMENT
 *  order. An ORDERED array rather than a set: two atoms swapping places is a presentation
 *  change and must fail rather than pass. */
function atomsOf(root: HTMLElement): string[] {
  const out: string[] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    const text = (n.textContent ?? "").trim()
    if (text !== "") out.push(text)
  }
  return out
}

function cardAtoms(): string[] {
  return atomsOf(screen.getByTestId("draft-arrival-card"))
}

/**
 * The DECLARED vertical box of `root`, in the units the class strings declare.
 *
 *   `boxPx`   the sum of every vertical padding and margin utility on the subtree.
 *             Arbitrary values are read verbatim; scale values use Tailwind's default 4px
 *             step. `py-*` / `my-*` count twice, because they declare two edges.
 *   `linePx`  the sum over every text-BEARING element of its declared font size times its
 *             declared line height (1.5 when none is declared — Tailwind's `normal`).
 *
 * ⚠ NON-VACUITY IS ASSERTED BY ITS OWN CASE, NEVER ASSUMED. A helper that silently
 * returned zero for everything would make every comparison below trivially stable, which
 * is exactly the failure mode a surrogate metric invites.
 */
function declaredBox(root: HTMLElement): { boxPx: number; linePx: number; totalPx: number } {
  let boxPx = 0
  let linePx = 0
  const all: HTMLElement[] = [root, ...root.querySelectorAll<HTMLElement>("*")]
  for (const el of all) {
    const cls = el.className
    if (typeof cls !== "string") continue
    for (const m of cls.matchAll(
      /(?:^|\s)(m[tby]|p[tby])-(?:\[(\d+(?:\.\d+)?)px\]|(\d+(?:\.\d+)?))/g,
    )) {
      const raw = m[2] !== undefined ? Number(m[2]) : Number(m[3]) * 4
      boxPx += m[1].endsWith("y") ? raw * 2 : raw
    }
    // Only elements that DIRECTLY own text declare a line — a wrapper's type is inherited
    // by its children and would otherwise be counted twice.
    const ownsText = [...el.childNodes].some(
      (n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "",
    )
    if (!ownsText) continue
    const size = /(?:^|\s)text-\[(\d+(?:\.\d+)?)px\]/.exec(cls)
    if (size === null) continue
    const lead = /(?:^|\s)leading-\[(\d+(?:\.\d+)?)\]/.exec(cls)
    linePx += Number(size[1]) * (lead === null ? 1.5 : Number(lead[1]))
  }
  return { boxPx, linePx, totalPx: boxPx + linePx }
}

describe("DraftArrivalCard — the 199-04 resting inventory", () => {
  it("reads the card's own disclosure mark out of its source, not out of a second spelling", () => {
    expect(FOLD_GLYPH_ATOM.length).toBeGreaterThan(0)
  })

  it("AT REST the card paints exactly these atoms, in this order", () => {
    renderCard()
    // Nine atoms and not one more. Every one is an identifier, never a spelled literal.
    expect(cardAtoms()).toEqual([
      seedReceiptHeading(GROUNDED_PHASES.length),
      SEED_RECEIPT_DISMISS_GLYPH,
      FOLD_GLYPH_ATOM,
      groundingFoldSummary(GROUNDED_COUNT),
      GROUNDING_FOLD_ACTION,
      FOLD_GLYPH_ATOM,
      decisionsFoldSummary(DECISION_ROW_ORDER.length),
      DECISIONS_FOLD_ACTION,
      SEED_RECEIPT_NOTHING_COMMITTED,
    ])
  })

  it("AT REST neither fold body exists at all — the atoms above are the WHOLE card", () => {
    renderCard()
    expect(screen.queryByTestId("draft-arrival-grounding-body")).toBeNull()
    expect(screen.queryByTestId("draft-arrival-decisions-body")).toBeNull()
    expect(screen.queryByTestId("seed-receipt")).toBeNull()
    expect(screen.queryByTestId("decisions-list")).toBeNull()
  })

  it("FOLD 1 OPEN — the body is NON-EMPTY first, and only then is its shape asserted", async () => {
    // ⚠ THE ORDER OF THESE TWO ASSERTIONS IS LOAD-BEARING. The suppression list neutralises
    // the receipt's frame from the OUTSIDE; a future entry naming a CONTENT handle would
    // blank the fold, and a blank fold satisfies every geometry assertion ever written
    // about it. Non-vacuity is therefore asserted BEFORE shape, never after.
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByTestId("draft-arrival-fold-grounding"))
    const body = screen.getByTestId("draft-arrival-grounding-body")
    expect(atomsOf(body).length).toBeGreaterThan(0)
    expect(within(body).getAllByTestId("seed-receipt")).toHaveLength(1)
    // The card's OWN opening atoms are unchanged by opening a fold — a fold ADDS, it never
    // rewrites what the card already said.
    expect(cardAtoms().slice(0, 2)).toEqual([
      seedReceiptHeading(GROUNDED_PHASES.length),
      SEED_RECEIPT_DISMISS_GLYPH,
    ])
  })

  it("FOLD 2 OPEN — the body is NON-EMPTY first, and carries all five decision labels", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByTestId("draft-arrival-fold-decisions"))
    const body = screen.getByTestId("draft-arrival-decisions-body")
    const atoms = atomsOf(body)
    expect(atoms.length).toBeGreaterThan(0)
    for (const key of DECISION_ROW_ORDER) expect(atoms).toContain(decisionRowLabel(key))
    expect(atoms).toContain(DECISION_EDIT_LIMIT_NOTE)
  })

  it("BOTH FOLDS OPEN — both bodies are non-empty at the same time", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByTestId("draft-arrival-fold-grounding"))
    await user.click(screen.getByTestId("draft-arrival-fold-decisions"))
    expect(atomsOf(screen.getByTestId("draft-arrival-grounding-body")).length).toBeGreaterThan(0)
    expect(atomsOf(screen.getByTestId("draft-arrival-decisions-body")).length).toBeGreaterThan(0)
  })

  it("the RECEIPT IS ABSENT when there is nothing to report (sheet c5 section 3, state B)", () => {
    // `groundingFoldSummary(0)` is the empty string, so fold line 1 is not rendered at
    // all — and with no fold line there is no way to reach a receipt. The sheet draws this
    // as a dashed placeholder box that says so; the shipped card renders NOTHING, which is
    // the stronger reading of the same idea. Asserted as an absence, never as a caption.
    renderCard({ phases: UNGROUNDED_PHASES })
    expect(groundingFoldSummary(0)).toBe("")
    expect(screen.queryByTestId("draft-arrival-fold-grounding")).toBeNull()
    expect(screen.queryByTestId("seed-receipt")).toBeNull()
    // …and it is still a card: fold 2 and the closing line survive.
    expect(screen.getByTestId("draft-arrival-fold-decisions")).toBeTruthy()
    expect(screen.getByTestId("draft-arrival-close")).toBeTruthy()
  })
})

describe("DraftArrivalCard — the declared vertical box (a SURROGATE, never a pixel)", () => {
  /**
   * The pre-change reading, MEASURED 2026-08-19 at the head of Phase 199-04.
   *
   * ⚠ `linePx` DELIBERATELY UNDER-COUNTS, and saying so is the difference between a
   * surrogate and a lie. A text-bearing element that inherits its type from an ancestor
   * contributes nothing here — the two fold lines declare `text-[12.5px]` on the BUTTON
   * and paint their words in child spans, so neither is counted. Attributing an ancestor's
   * type to each of its descendants instead would double-count every nested span, which is
   * the worse error. The figure is a consistent yardstick, never a page height.
   */
  const COLLAPSED = { boxPx: 76, linePx: 39, totalPx: 115 }

  /** The same reading with BOTH folds open — the composed receipt and the five-row list
   *  included, since both are children of the card and the card is what an author sees. */
  const FULLY_OPEN = { boxPx: 217, linePx: 231.925, totalPx: 448.925 }

  it("the helper is NOT vacuous — it reads a real box and a real line off a plant", () => {
    // Without this, every figure below could be zero and every comparison would still hold.
    const plant = document.createElement("div")
    plant.className = "py-4 mt-1"
    const line = document.createElement("p")
    line.className = "text-[10px] leading-[2]"
    line.textContent = "x"
    plant.appendChild(line)
    // py-4 is 16 on two edges = 32, mt-1 is 4, so boxPx 36. 10px at a leading of 2 is 20.
    expect(declaredBox(plant)).toEqual({ boxPx: 36, linePx: 20, totalPx: 56 })
  })

  it("AT REST the card declares this vertical box", () => {
    renderCard()
    expect(declaredBox(screen.getByTestId("draft-arrival-card"))).toEqual(COLLAPSED)
  })

  it("OPENING BOTH FOLDS only ADDS to the box — the resting figure is never rewritten", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByTestId("draft-arrival-fold-grounding"))
    await user.click(screen.getByTestId("draft-arrival-fold-decisions"))
    const open = declaredBox(screen.getByTestId("draft-arrival-card"))
    expect(open.boxPx).toBeGreaterThan(COLLAPSED.boxPx)
    expect(open.linePx).toBeGreaterThan(COLLAPSED.linePx)
    // Pinned as a NUMBER as well as a relation, so a later change is published as a DELTA
    // rather than absorbed by an inequality that a grown card would still satisfy.
    expect(open).toEqual(FULLY_OPEN)
  })
})

describe("DraftArrivalCard — sheet c5 asks for a vocabulary this surface does not speak", () => {
  /**
   * ⚠ THE ONE PLACE THIS FILE SPELLS STRINGS AS LITERALS, AND THE REASON IS THE POINT.
   * These are SKETCH 178's words, not this application's. They are needles asserted ABSENT
   * from the rendered DOM, so a literal here can neither satisfy nor break anything — the
   * D-ITEM-183-02 trap applies to source greps, and nothing below greps a source.
   *
   * Sheet `c5-draft-arrival` draws the arrival card with a lifecycle chip, a describe-text
   * echo with its own control, and a two-button door pair. Every one of those either
   * PRINTS THE MECHANISM to the reader — the rule sketch 178's own `designMd` added — or
   * puts a door on this card that already has exactly one home elsewhere. The verdicts are
   * in `199-04-SUMMARY.md`; this case is what makes them checkable rather than asserted.
   */
  const SHEET_C5_WORDS = [
    "Freshly Arrived",
    "Returned-to",
    "View full",
    "Open in builder",
    "Applied Decisions",
  ]

  const SHEET_C5_ROW_SUBJECTS = [
    "Data Source",
    "Vendor Identification",
    "Contract Duration",
    "Knowledge-Grounding",
    "Risk Assessment Logic",
  ]

  it("the card renders NONE of sheet c5's lifecycle or door vocabulary", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByTestId("draft-arrival-fold-grounding"))
    await user.click(screen.getByTestId("draft-arrival-fold-decisions"))
    const read = cardAtoms().join("   ")
    // Non-vacuity BEFORE the negatives: an empty read passes every `not.toContain`.
    expect(read.length).toBeGreaterThan(0)
    for (const word of SHEET_C5_WORDS) {
      expect(read, `sheet c5's "${word}" reached the shipped card`).not.toContain(word)
    }
  })

  it("POSITIVE CONTROL — the sweep really would see one of those words if it appeared", () => {
    // Driven RED once against this plant during Task 1, then kept permanently: a fence
    // whose positive control is removed after one green run is a fence nobody can re-verify.
    const plant = document.createElement("div")
    plant.textContent = `Vendor renewal brief ${SHEET_C5_WORDS[0]}`
    const read = atomsOf(plant).join("   ")
    expect(SHEET_C5_WORDS.some((w) => read.includes(w))).toBe(true)
  })

  it("the DECISIONS half speaks its own five subjects, not the sheet's", async () => {
    // Sheet c5's five rows are model-invented subjects, none of which is one of the app's
    // five decisions. The shipped labels are the module's, asserted by identity; the
    // sheet's subjects are asserted absent.
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByTestId("draft-arrival-fold-decisions"))
    const read = atomsOf(screen.getByTestId("draft-arrival-decisions-body")).join("   ")
    for (const key of DECISION_ROW_ORDER) expect(read).toContain(decisionRowLabel(key))
    for (const subject of SHEET_C5_ROW_SUBJECTS) {
      expect(read, `sheet c5's row subject "${subject}" reached the shipped list`).not.toContain(
        subject,
      )
    }
  })
})
