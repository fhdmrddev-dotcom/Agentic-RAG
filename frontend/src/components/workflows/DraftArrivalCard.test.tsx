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

import { DraftArrivalCard, type DraftArrivalCardProps } from "./DraftArrivalCard"
import type { DecisionsListProps } from "./DecisionsList"
import {
  DECISIONS_FOLD_ACTION,
  DECISION_CHANGE_ACTION,
  DECISION_ROW_ORDER,
  GROUNDING_FOLD_ACTION,
  decisionsFoldSummary,
  groundingFoldSummary,
} from "./decisionsVocabulary"
import {
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
