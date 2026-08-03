/**
 * Phase 187-13 Task 2 — Req 5's four acceptance criteria, machine-checked, plus the
 * source fence that proves the receipt's purity, its glyph discipline and its refusal to
 * stage an arrival that never happened.
 *
 * A NET-NEW suite. It does NOT absorb, replace or re-implement any shipped file — Phase
 * 177's coverage-loss lesson (a "net-new" file that quietly REPLACED an existing suite,
 * so the total never moved and nobody noticed) is exactly why `scripts/vitest-count-gate.cjs`
 * pins per-file counts. This file postdates the 415 pin, reports to the gate as `new`,
 * and must NOT be added to `BASELINE`. It already sits inside the
 * `src/components/workflows` target glob, so `TARGETS` needs no edit either.
 *
 * WHY THE COMPONENT IS TESTED DIRECTLY. `SeedReceipt` is a LEAF: a flat, total prop
 * contract in, DOM out. Driving these criteria through `WorkflowBuilderPage` would make
 * every case depend on the page's four routes, its two mount fetches and its flag
 * branches as well as on the receipt, so a red would not say which of them moved. The
 * page's own obligation — the single gated mount line (D-187-14) — belongs to plan
 * 187-15, and this file deliberately does not reach for it.
 *
 * TWO PROPERTIES ARE ASSERTED BY IDENTITY RATHER THAN BY LITERAL, and both are the point:
 *  - every sentence is compared character-for-character against its `definitionOps`
 *    export, never against a hand-typed copy, because a hand-typed copy drifts in exactly
 *    the same silence the copy module exists to break (T-187-13-05). That claim said
 *    "every" while the CARRIED sentence had no rendered assertion at all — it was true of
 *    four sentences out of five from 187-16 until 187-20; the carried paragraph joined the
 *    section-4 enumeration in that plan, which is when the word became honest;
 *  - every step face is compared against `nodeTitle(phase, ctx)` — the same call the
 *    canvas makes — so a row and the node it describes can never name one step two ways.
 *
 * THE GROUNDED LIST IS ASSERTED BY EXACT MEMBERSHIP, never by a count. A count passes on
 * the wrong steps, which is the one failure a receipt about safety must not have.
 *
 * The unshipped canvas marks and the staging-animation needles are ASSEMBLED FROM PARTS
 * (`String.fromCodePoint`, split identifiers), so a grep of this guard file can neither
 * satisfy nor break the greps it exists to protect — the D-ITEM-183-02 trap this phase
 * has hit repeatedly, and the reason plan 187-10 wrote its guards the same way.
 *
 * ── 187-16: TWO SHIPPED ASSERTIONS WERE RE-DERIVED, NOT RELAXED ──────────────────────
 * Repairing the fixtures (CR-02 — see the block above them) switched on a branch this
 * file had never crossed: the deliverable now carries the shipped default and is
 * therefore `already-set`, so THREE steps wear a seal where two did before.
 *
 *  - `lists EXACTLY the steps that read the documents, and no others` was ONE assertion
 *    over two different claims. It is now two cases: membership of the SEALED list (what
 *    the canvas marks, what the receipt must explain), and membership of the DETECTED
 *    subset (what the generation actually did, what the lead may count). Neither is
 *    weaker than what it replaced; together they are strictly stronger, because the
 *    single old assertion could not have told the two apart.
 *  - `marks the grounded count on the surface itself` now reads THREE. That is the
 *    honest number: it is exactly the count of ⛨ marks the canvas draws for this draft.
 *    A companion assertion pins the new `data-detected-count` at two, so the two numbers
 *    can never silently collapse back into one again.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import seedReceiptSource from "./SeedReceipt?raw"
// THIS FILE'S OWN SOURCE, for the testid-coverage sweep at the bottom (187-20). `?raw`
// hands back the file as a STRING and evaluates no module, so the self-reference cannot
// introduce an import cycle — it is the same proven idiom as the line above it.
import testSource from "./SeedReceipt.test?raw"
import { SeedReceipt, type SeedReceiptProps } from "./SeedReceipt"
import {
  GOVERNANCE_SEAL_LABEL,
  SEED_RECEIPT_DISMISS_GLYPH,
  SEED_RECEIPT_DISMISS_LABEL,
  SEED_RECEIPT_NOTHING_COMMITTED,
  SEED_RECEIPT_ONE_WAY_RULE,
  seedReceiptCarriedLead,
  seedReceiptGroundingLead,
  seedReceiptHeading,
  seedReceiptStepReason,
} from "./definitionOps"
import {
  groundingCauseOf,
  nodeTitle,
  type NameContext,
  type PhaseSpecJSON,
} from "./phaseVocabulary"

/** The server's list, mirrored here as a FIXTURE only — the component never owns it. */
const KB_TOOLS = [
  "search_documents",
  "query_documents",
  "read_document",
  "analyze_document",
  "get_related_documents",
]

/**
 * ── EVERY `citation_policy` BELOW IS A VALUE THE BACKEND CAN ACTUALLY PRODUCE (CR-02) ──
 *
 * The source of the member set is `LlmEmitPhaseConfig.citation_policy` in
 * `backend/app/models/harness.py` — read at live HEAD, 2026-08-02:
 *
 *     citation_policy: Literal["strict", "flag", "partial", "draft"] = "strict"
 *
 * The first draft of these fixtures gave the `llm_emit` step a value that is NOT a member
 * of that Literal (spelled `POLICY_NEVER_REPRESENTABLE` below, assembled from parts so a
 * grep of this guard file cannot satisfy the fence it exists to protect). No
 * `model_validate()`-passing row can carry it, so no `/generate` response ever did — and
 * `groundingCauseOf` therefore reported `null` for a step that in production is ALWAYS
 * `already-set`. The suite was green over a state the product cannot reach, which is not
 * coverage; it is a blind spot wearing coverage's clothes.
 *
 * A fixture that avoids the DEFAULT is a fixture avoiding the shipped shape:
 * `POST /generate` returns `wd.model_dump(mode="json")`, which emits defaults, so every
 * generated `llm_emit` phase reaches the client carrying `"strict"`. That is why the
 * grounded fixture below uses the default and not a convenient non-default member.
 */
const REPRESENTABLE_CITATION_POLICIES: readonly string[] = [
  "strict",
  "flag",
  "partial",
  "draft",
]

/** The value the first draft used. Assembled from parts — see the block above. */
const POLICY_NEVER_REPRESENTABLE = ["lo", "ose"].join("")

/**
 * A drafted definition with TWO steps that read the documents, ONE deliverable that is
 * already held by its own citation policy, and two steps held to nothing.
 *
 * The two DETECTED steps deliberately intersect on DIFFERENT tools, and the second one
 * lists a non-KB tool FIRST. A component that hardcoded one tool id, or that named the
 * head of `available_tools` instead of the intersection, passes on the first row and
 * fails on the second — which is the whole reason the second row exists.
 *
 * `emit` carries the SHIPPED DEFAULT `"strict"`, so its cause is `already-set`. It wears
 * the ⛨ seal on the canvas (`canvasModel.isGrounded` is `cause !== null`), which is why
 * the receipt must name it — and why the lead must NOT count it.
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
    // The slug is deliberately NOT a substring of any fixture name: the "never prints a
    // slug" guard below would otherwise pass or fail on a coincidence of wording.
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

/**
 * The three steps that wear a seal, the two that do not, and — separately — the subset
 * the AI itself GROUNDED.
 *
 * These are two different claims and CR-01 is what happens when one list serves both.
 * SEALED is what the canvas marks and therefore what the receipt must explain; DETECTED
 * is what the generation actually did and therefore what the "so I set them" sentence may
 * count. `emit` belongs to the first and not the second.
 */
const SEALED_SLUGS = ["contracts", "policy_check", "emit"]
const DETECTED_SLUGS = ["contracts", "policy_check"]
const UNSEALED_SLUGS = ["gather", "write"]

/**
 * A draft where NOTHING is sealed at all (D-187-10's zero case).
 *
 * The `llm_emit` step CANNOT use the default here: `"strict"` is `already-set`, which
 * would seal it and make this draft non-empty. `"draft"` is the member chosen instead —
 * still a value the backend can produce, and the only honest way to reach the zero case
 * without inventing an unrepresentable one.
 */
const BARE_PHASES: PhaseSpecJSON[] = [
  { slug: "gather", phase_index: 0, name: "Collect the renewal inputs", config: { phase_type: "programmatic" } },
  { slug: "write", phase_index: 1, name: "Draft the renewal summary", config: { phase_type: "llm_single" } },
  {
    slug: "emit",
    phase_index: 2,
    name: "Produce the renewal pack",
    config: { phase_type: "llm_emit", citation_policy: "draft" },
  },
]

/** The SAME draft with the deliverable at its shipped default — zero detected, one
 *  already-set. The typical generated shape once the KB tools are switched off. */
const STRICT_EMIT_ONLY_PHASES: PhaseSpecJSON[] = [
  BARE_PHASES[0],
  BARE_PHASES[1],
  {
    slug: "emit",
    phase_index: 2,
    name: "Produce the renewal pack",
    config: { phase_type: "llm_emit", citation_policy: "strict" },
  },
]

/** An `llm_agent` the AUTHOR escalated by hand, reaching for no KB tool at all. */
const ESCALATED_PHASES: PhaseSpecJSON[] = [
  BARE_PHASES[0],
  {
    slug: "judgement",
    phase_index: 1,
    name: "Weigh the supplier options",
    config: { phase_type: "llm_agent", available_tools: ["execute_code"] },
    grounding_escalated: true,
  },
]

function phaseBySlug(phases: readonly PhaseSpecJSON[], slug: string): PhaseSpecJSON {
  const found = phases.find((phase) => phase.slug === slug)
  if (!found) throw new Error(`fixture has no phase "${slug}"`)
  return found
}

function renderReceipt(over: Partial<SeedReceiptProps> = {}) {
  const onDismiss = vi.fn()
  const props: SeedReceiptProps = {
    phases: GROUNDED_PHASES,
    kbTools: KB_TOOLS,
    open: true,
    onDismiss,
    ...over,
  }
  const result = render(<SeedReceipt {...props} />)
  return { ...result, onDismiss, props }
}

/**
 * The rendered grounded rows, in document order.
 *
 * Resolved by `[data-slug]` rather than by a testid prefix: the row's children carry
 * `seed-receipt-step-seal` / `-face` / `-reason`, so a prefix match would count the parts
 * of a row as rows. The first draft of this helper did exactly that and reported seven
 * "rows" for two steps — a membership assertion that resolves the wrong nodes is worse
 * than the count it was written to replace.
 */
function listedSlugs(): string[] {
  const list = screen.queryByTestId("seed-receipt-grounded-list")
  if (!list) return []
  return [...list.querySelectorAll("[data-slug]")].map(
    (row) => row.getAttribute("data-slug") ?? "",
  )
}

// ── 1. A DRAFT THAT READS THE KB — exact membership, and a reason per step ───────────

describe("SeedReceipt — the grounded steps and their reasons", () => {
  it("lists EXACTLY the steps that wear the seal, and no others", () => {
    // The SEALED list — `groundingCauseOf(...) !== null`, the same predicate
    // `canvasModel.isGrounded` uses. Every step the canvas marks is named here, which is
    // the sketch's "never let the seal arrive unexplained" rule.
    renderReceipt()
    expect(listedSlugs()).toEqual(SEALED_SLUGS)
  })

  it("the DETECTED subset is exactly the two steps that read the documents", () => {
    // The other half of the claim the old single assertion conflated. Read off the rows'
    // own `data-cause`, so it cannot pass by counting the right number of wrong steps.
    renderReceipt()
    const list = screen.getByTestId("seed-receipt-grounded-list")
    const detected = [...list.querySelectorAll('[data-cause="detected"]')].map(
      (row) => row.getAttribute("data-slug") ?? "",
    )
    expect(detected).toEqual(DETECTED_SLUGS)
  })

  it("each listed row carries the cause the ONE derivation returns for its phase", () => {
    renderReceipt()
    const list = screen.getByTestId("seed-receipt-grounded-list")
    const causes = [...list.querySelectorAll("[data-slug]")].map((row) => [
      row.getAttribute("data-slug") ?? "",
      row.getAttribute("data-cause"),
    ])
    // Computed from the imported derivation, never hand-typed: a row that disagreed with
    // `groundingCauseOf` would be a second classifier, which D-187-08 forbids.
    expect(causes).toEqual(
      SEALED_SLUGS.map((slug) => [
        slug,
        groundingCauseOf(phaseBySlug(GROUNDED_PHASES, slug), KB_TOOLS),
      ]),
    )
  })

  it("never names a step that is held to nothing", () => {
    renderReceipt()
    const list = screen.getByTestId("seed-receipt-grounded-list")
    for (const slug of UNSEALED_SLUGS) {
      const phase = phaseBySlug(GROUNDED_PHASES, slug)
      expect(list.textContent ?? "").not.toContain(nodeTitle(phase))
    }
  })

  it("every fixture policy in this file is a value the backend can produce (CR-02)", () => {
    // The guard that keeps this suite representable. A fixture the product cannot reach
    // makes a green run mean nothing — see the block above the fixtures.
    const policies = [...GROUNDED_PHASES, ...BARE_PHASES, ...STRICT_EMIT_ONLY_PHASES]
      .map((phase) => phase.config.citation_policy)
      .filter((value): value is string => typeof value === "string")
    expect(policies.length).toBeGreaterThan(0)
    for (const policy of policies) {
      expect(REPRESENTABLE_CITATION_POLICIES).toContain(policy)
    }
    expect(REPRESENTABLE_CITATION_POLICIES).not.toContain(POLICY_NEVER_REPRESENTABLE)
    // …and the SHIPPED DEFAULT is exercised, not merely permitted.
    expect(policies).toContain("strict")
  })

  it("names the ACTUAL intersecting tool per step, not one hardcoded id", () => {
    renderReceipt()
    // Row 1 intersects on the first entry of its tool list; row 2 on the SECOND, behind
    // a non-KB tool. Both reasons are compared against the copy module's own formatter.
    expect(screen.getByTestId("seed-receipt-step-contracts").textContent).toContain(
      seedReceiptStepReason("detected", "search_documents"),
    )
    expect(screen.getByTestId("seed-receipt-step-policy_check").textContent).toContain(
      seedReceiptStepReason("detected", "read_document"),
    )
  })

  it("picks up a KB tool this file never mentions — the list is the server's", () => {
    // A tool id that appears in NO fixture above and in no shipped copy constant. If the
    // component carried its own KB table, this step could not be grounded at all.
    const invented = "consult_the_archive"
    const phases: PhaseSpecJSON[] = [
      {
        slug: "archive",
        phase_index: 0,
        name: "Look through the archive",
        config: { phase_type: "llm_agent", available_tools: [invented] },
      },
    ]
    renderReceipt({ phases, kbTools: [invented] })
    expect(listedSlugs()).toEqual(["archive"])
    expect(screen.getByTestId("seed-receipt-step-archive").textContent).toContain(
      seedReceiptStepReason("detected", invented),
    )
  })

  it("wears the governance seal on every listed row, announced by its shipped label", () => {
    renderReceipt()
    const list = screen.getByTestId("seed-receipt-grounded-list")
    const seals = within(list).getAllByTestId("seed-receipt-step-seal")
    expect(seals).toHaveLength(SEALED_SLUGS.length)
    for (const seal of seals) expect(seal).toHaveAttribute("aria-hidden", "true")
    expect(within(list).getAllByText(GOVERNANCE_SEAL_LABEL)).toHaveLength(
      SEALED_SLUGS.length,
    )
  })

  it("marks the SEALED count on the surface — the number of marks the canvas draws", () => {
    renderReceipt()
    expect(screen.getByTestId("seed-receipt")).toHaveAttribute(
      "data-grounded-count",
      String(SEALED_SLUGS.length),
    )
  })

  it("marks the DETECTED count separately — the number the AI itself grounded", () => {
    // Two numbers, because there are two facts. Collapsing them is CR-01.
    renderReceipt()
    expect(screen.getByTestId("seed-receipt")).toHaveAttribute(
      "data-detected-count",
      String(DETECTED_SLUGS.length),
    )
    expect(SEALED_SLUGS.length).not.toBe(DETECTED_SLUGS.length)
  })

  it("marks the CARRIED count too — the seals this generation did NOT apply", () => {
    // The third fact, exposed like its two siblings (187-20). It is the number the carried
    // paragraph reports, so an attribute and a sentence that disagreed would be visible.
    renderReceipt()
    expect(screen.getByTestId("seed-receipt")).toHaveAttribute(
      "data-carried-count",
      String(SEALED_SLUGS.length - DETECTED_SLUGS.length),
    )
  })

  it("the carried count reads 0 on a draft the AI grounded entirely by itself", () => {
    renderReceipt({ phases: [phaseBySlug(GROUNDED_PHASES, "contracts")] })
    expect(screen.getByTestId("seed-receipt")).toHaveAttribute("data-carried-count", "0")
  })
})

// ── 1b. THE CARRIED CAUSES — listed, explained, and NOT claimed as the AI's doing ─────

describe("SeedReceipt — an already-set deliverable", () => {
  it("LISTS the already-set step with its own reason", () => {
    renderReceipt()
    const row = screen.getByTestId("seed-receipt-step-emit")
    expect(row).toHaveAttribute("data-cause", "already-set")
    expect(row.textContent ?? "").toContain(seedReceiptStepReason("already-set"))
  })

  it("does NOT count the already-set step under the detected lead", () => {
    renderReceipt()
    expect(screen.getByTestId("seed-receipt-lead").textContent).toBe(
      seedReceiptGroundingLead(DETECTED_SLUGS.length),
    )
  })
})

describe("SeedReceipt — an escalated step", () => {
  it("LISTS the hand-escalated step with its own reason", () => {
    renderReceipt({ phases: ESCALATED_PHASES })
    const row = screen.getByTestId("seed-receipt-step-judgement")
    expect(row).toHaveAttribute("data-cause", "escalated")
    expect(row.textContent ?? "").toContain(seedReceiptStepReason("escalated"))
  })

  it("renders NO detected lead and NO one-way rule for it — the author did that", () => {
    renderReceipt({ phases: ESCALATED_PHASES })
    expect(screen.queryByTestId("seed-receipt-lead")).toBeNull()
    expect(screen.queryByTestId("seed-receipt-one-way")).toBeNull()
    expect(screen.getByTestId("seed-receipt")).toHaveAttribute("data-detected-count", "0")
    expect(screen.getByTestId("seed-receipt")).toHaveAttribute("data-grounded-count", "1")
  })
})

describe("SeedReceipt — zero detected, one already-set (the typical non-KB draft)", () => {
  it("still names the sealed step and its reason", () => {
    renderReceipt({ phases: STRICT_EMIT_ONLY_PHASES })
    expect(listedSlugs()).toEqual(["emit"])
    expect(screen.getByTestId("seed-receipt-step-emit").textContent ?? "").toContain(
      seedReceiptStepReason("already-set"),
    )
  })

  it("renders NEITHER the detected lead NOR the one-way rule", () => {
    // CR-01 in one case: the AI applied nothing here, and "you can't turn that off" is
    // the DETECTED lock (D-185-07). Rendering either over this draft is a false claim.
    renderReceipt({ phases: STRICT_EMIT_ONLY_PHASES })
    expect(screen.queryByTestId("seed-receipt-lead")).toBeNull()
    expect(screen.queryByTestId("seed-receipt-one-way")).toBeNull()
    expect(screen.queryByTestId("seed-receipt-grounding")).toBeNull()
  })
})

// ── 1c. THE AUTHORSHIP WORD-CLASS FENCE (CR-01 as a permanent regression class) ───────

describe("SeedReceipt — it never claims an application it did not make", () => {
  // Assembled from parts, the idiom this file already uses: a grep of this guard must not
  // be able to satisfy the fence it protects.
  const APPLICATION_CLAIM = ["so", "I", "set"].join(" ")

  it("POSITIVE CONTROL — the claim IS present when the AI really did apply it", () => {
    // Without this half the fence below could pass by asserting the absence of a string
    // that never existed anywhere.
    renderReceipt()
    expect(screen.getByTestId("seed-receipt").textContent ?? "").toContain(
      APPLICATION_CLAIM,
    )
  })

  it("says nothing of the sort over a draft the AI grounded nothing in", () => {
    renderReceipt({ phases: STRICT_EMIT_ONLY_PHASES })
    expect(screen.getByTestId("seed-receipt").textContent ?? "").not.toContain(
      APPLICATION_CLAIM,
    )
  })

  it("nor over a draft whose only seal the AUTHOR put there", () => {
    renderReceipt({ phases: ESCALATED_PHASES })
    expect(screen.getByTestId("seed-receipt").textContent ?? "").not.toContain(
      APPLICATION_CLAIM,
    )
  })
})

// ── 1d. THE CARRIED PARAGRAPH ITSELF (187-20, review CR-03 + WR-09) ──────────────────
//
// WHY THIS BLOCK EXISTS. 187-16 repaired CR-01 by SPLITTING the counts and adding a
// second paragraph — and shipped that paragraph with no rendered assertion of any kind.
// Measured at HEAD before this plan: `grep -rn "seed-receipt-carried" frontend/src/`
// returned exactly ONE hit, the component's own attribute. The paragraph could have been
// deleted, could have printed the sealed total instead of the carried one, or could have
// drifted from its formatter, and all 452 tests stayed green. A fix that ships its own
// new sentence unguarded reintroduces the bug class it was written to close.
//
// So this block gives the carried paragraph exactly the rigor its sibling already has —
// presence, COUNT, character-identity against the export, and both zero cases — plus the
// WR-09 cause fence the sentence itself needed.

describe("SeedReceipt — the carried paragraph", () => {
  // Assembled from parts, the idiom this file already uses: a grep of this guard file
  // must not be able to satisfy the fence it exists to protect.
  const CAUSE_CLAIMS = [
    ["by", "its", "own", "settings"].join(" "),
    ["by", "their", "own", "settings"].join(" "),
  ]

  it("renders it, character for character, over the CARRIED count", () => {
    // The count is DERIVED from the shipped fixture constants — sealed minus detected —
    // so a hand-typed `1` can never hide a component that reported the wrong number.
    renderReceipt()
    expect(screen.getByTestId("seed-receipt-carried").textContent).toBe(
      seedReceiptCarriedLead(SEALED_SLUGS.length - DETECTED_SLUGS.length),
    )
  })

  it("renders ALONE on the typical non-KB draft — no detected paragraph above it", () => {
    // The case that proves the sentence must be self-contained: its sibling is absent
    // entirely here, so any antecedent word would point at nothing on screen.
    renderReceipt({ phases: STRICT_EMIT_ONLY_PHASES })
    expect(screen.queryByTestId("seed-receipt-grounding")).toBeNull()
    expect(screen.getByTestId("seed-receipt-carried").textContent).toBe(
      seedReceiptCarriedLead(1),
    )
  })

  it("renders on the draft whose only seal the AUTHOR escalated by hand", () => {
    renderReceipt({ phases: ESCALATED_PHASES })
    expect(screen.getByTestId("seed-receipt-carried").textContent).toBe(
      seedReceiptCarriedLead(1),
    )
  })

  it("is ABSENT — no node at all — when every seal is one the AI detected", () => {
    // A single detected step: sealed 1, detected 1, carried 0. Built from the shipped
    // fixture rather than a new one, so it cannot drift away from what the others assert.
    renderReceipt({ phases: [phaseBySlug(GROUNDED_PHASES, "contracts")] })
    expect(screen.getByTestId("seed-receipt")).toHaveAttribute("data-detected-count", "1")
    expect(screen.queryByTestId("seed-receipt-carried")).toBeNull()
    // …because the formatter returns the empty string, which is the ONE conditional shape
    // both paragraphs share (D-187-10). Not an empty paragraph — no paragraph.
    expect(seedReceiptCarriedLead(0)).toBe("")
  })

  it("is ABSENT on a draft where nothing is sealed at all", () => {
    renderReceipt({ phases: BARE_PHASES })
    expect(screen.queryByTestId("seed-receipt-carried")).toBeNull()
    expect(seedReceiptCarriedLead(0)).toBe("")
  })

  // ── WR-09: ONE PARAGRAPH, TWO CAUSES, NO CONTRADICTION ────────────────────────────
  //
  // The carried count sums `already-set` AND `escalated`. A paragraph that attributes the
  // seal to the step's own settings is therefore false of half of what it counts — and on
  // an escalated-only draft it contradicts that step's own reason two lines below it on
  // the SAME CARD ("you turned this on by hand"). The repair is that the paragraph names
  // no cause and the ROW names the real one: one card, two statements, no contradiction.

  it("attributes the seal to NO CAUSE on the mixed draft", () => {
    renderReceipt()
    const carried = screen.getByTestId("seed-receipt-carried").textContent ?? ""
    for (const claim of CAUSE_CLAIMS) expect(carried).not.toContain(claim)
  })

  it("nor on the already-set-only draft", () => {
    renderReceipt({ phases: STRICT_EMIT_ONLY_PHASES })
    const carried = screen.getByTestId("seed-receipt-carried").textContent ?? ""
    for (const claim of CAUSE_CLAIMS) expect(carried).not.toContain(claim)
  })

  it("nor on the escalated-only draft, whose row says the opposite", () => {
    renderReceipt({ phases: ESCALATED_PHASES })
    const carried = screen.getByTestId("seed-receipt-carried").textContent ?? ""
    for (const claim of CAUSE_CLAIMS) expect(carried).not.toContain(claim)
  })

  it("POSITIVE CONTROL — the ROW still names the cause the paragraph withholds", () => {
    // Without this half the fence above could pass over a card that had stopped saying
    // anything about cause at all. The cause is not deleted from the surface; it moved to
    // the one place that knows it per step.
    renderReceipt({ phases: ESCALATED_PHASES })
    expect(screen.getByTestId("seed-receipt-step-judgement").textContent ?? "").toContain(
      seedReceiptStepReason("escalated"),
    )
  })

  it("the one-way lock never travels with it (D-185-07)", () => {
    // `SEED_RECEIPT_ONE_WAY_RULE` is the DETECTED lock. A carried step is undone by
    // whatever set it, so "you can't turn that off" over one of these is a false claim.
    for (const phases of [STRICT_EMIT_ONLY_PHASES, ESCALATED_PHASES]) {
      const { unmount } = renderReceipt({ phases })
      expect(screen.getByTestId("seed-receipt-carried")).toBeInTheDocument()
      expect(screen.queryByTestId("seed-receipt-one-way")).toBeNull()
      expect(
        screen.getByTestId("seed-receipt-carried").textContent ?? "",
      ).not.toContain(SEED_RECEIPT_ONE_WAY_RULE)
      unmount()
    }
  })
})

// ── 1e. NO SEAL MAY ARRIVE UNEXPLAINED (187-23, review WR-15) ────────────────────────
//
// `seedReceiptStepReason`'s `default:` arm returned `""` for any future `GroundingCause`
// member, and `GroundedRow.cause` is `Exclude<GroundingCause, null>` — so a 4th member is
// admitted to a row, and the row renders its reason UNCONDITIONALLY after an em-dash
// (`SeedReceipt.tsx:342-353`). The result a person would SEE is "Weigh the supplier
// options — " with nothing after the dash, on the one surface whose entire job is that a
// seal never arrives unexplained (Req 5).
//
// 187-23 closed the type hole with a `never` guard. This block fences the CONSEQUENCE in
// the DOM, because a type guard is invisible to a reader and the reader is who the rule
// protects.

describe("SeedReceipt — every sealed row states a reason", () => {
  /** Every shipped fixture that produces at least one sealed row. */
  const SEALED_FIXTURES = [
    ["the mixed grounded draft", GROUNDED_PHASES],
    ["the already-set-only draft", STRICT_EMIT_ONLY_PHASES],
    ["the escalated-only draft", ESCALATED_PHASES],
  ] as const

  it("no rendered reason is empty or blank, across every sealed fixture", () => {
    for (const [label, phases] of SEALED_FIXTURES) {
      const { unmount } = renderReceipt({ phases })
      const reasons = screen.getAllByTestId("seed-receipt-step-reason")
      // VACUITY GUARD — a fixture that rendered no rows would make the loop below a
      // statement about nothing.
      expect(reasons.length, label).toBeGreaterThan(0)
      for (const reason of reasons) {
        expect((reason.textContent ?? "").trim(), label).not.toBe("")
      }
      unmount()
    }
  })

  it("no row's text ends at the em-dash — the consequence, in what a reader sees", () => {
    for (const [label, phases] of SEALED_FIXTURES) {
      const { unmount } = renderReceipt({ phases })
      const list = screen.getByTestId("seed-receipt-grounded-list")
      const rows = [...list.querySelectorAll("[data-slug]")]
      expect(rows.length, label).toBeGreaterThan(0)
      for (const row of rows) {
        const text = (row.textContent ?? "").trim()
        expect(text, `${label} / ${row.getAttribute("data-slug")}`).not.toMatch(/—\s*$/)
      }
      unmount()
    }
  })

  it("POSITIVE CONTROL — the formatter really can return the empty string, and that row WOULD dangle", () => {
    // Without this half both cases above could be passing over an invariant nothing is
    // capable of breaking. The formatter's empty answer is real…
    expect(seedReceiptStepReason(null)).toBe("")
    // …and a row assembled the way the component assembles one — face, em-dash, reason —
    // does end at the dash when the reason is empty, which is exactly the pattern the case
    // above asserts against. So the invariant is known to be falsifiable.
    const face = nodeTitle(phaseBySlug(ESCALATED_PHASES, "judgement"))
    const wouldRender = `${face} — ${seedReceiptStepReason(null)}`.trim()
    expect(wouldRender).toMatch(/—\s*$/)
    // …and the same row with a real reason does NOT, so the pattern discriminates.
    expect(`${face} — ${seedReceiptStepReason("escalated")}`.trim()).not.toMatch(/—\s*$/)
  })
})

// ── 2. ZERO GROUNDED STEPS — the receipt still arrives (D-187-10) ─────────────────────

describe("SeedReceipt — the zero-grounded draft", () => {
  it("still renders, with its heading and its closing line", () => {
    renderReceipt({ phases: BARE_PHASES })
    expect(screen.getByTestId("seed-receipt")).toBeInTheDocument()
    expect(screen.getByTestId("seed-receipt-heading").textContent).toBe(
      seedReceiptHeading(BARE_PHASES.length),
    )
    expect(screen.getByTestId("seed-receipt-close").textContent).toBe(
      SEED_RECEIPT_NOTHING_COMMITTED,
    )
  })

  it("renders NO grounded-step list node — not an empty one, not a fabricated one", () => {
    renderReceipt({ phases: BARE_PHASES })
    expect(screen.queryByTestId("seed-receipt-grounded-list")).toBeNull()
    expect(screen.queryAllByTestId(/^seed-receipt-step-/)).toHaveLength(0)
  })

  it("says nothing about grounding at all when nothing is grounded", () => {
    renderReceipt({ phases: BARE_PHASES })
    expect(screen.queryByTestId("seed-receipt-grounding")).toBeNull()
    expect(screen.queryByTestId("seed-receipt-one-way")).toBeNull()
    // The receipt is still the same component with the same arrival behaviour: it just
    // has one fewer thing to say. A surface that vanished here would leave the author
    // with no orientation and no "nothing is saved yet".
    expect(screen.getByTestId("seed-receipt")).toHaveAttribute("data-grounded-count", "0")
  })

  it("an empty definition is a receipt too — the heading is a formatter, not a branch", () => {
    renderReceipt({ phases: [] })
    expect(screen.getByTestId("seed-receipt-heading").textContent).toBe(
      seedReceiptHeading(0),
    )
    expect(screen.queryByTestId("seed-receipt-grounded-list")).toBeNull()
  })
})

// ── 3. DISMISSAL AND THE CLOSED STATE ────────────────────────────────────────────────

describe("SeedReceipt — dismissal", () => {
  it("calls onDismiss exactly once when the control is activated", async () => {
    const user = userEvent.setup()
    const { onDismiss } = renderReceipt()
    await user.click(screen.getByTestId("seed-receipt-dismiss"))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("announces the dismiss control by its label, never by its glyph", () => {
    renderReceipt()
    const button = screen.getByTestId("seed-receipt-dismiss")
    expect(button).toHaveAttribute("aria-label", SEED_RECEIPT_DISMISS_LABEL)
    expect(button.textContent).toBe(SEED_RECEIPT_DISMISS_GLYPH)
    expect(within(button).getByText(SEED_RECEIPT_DISMISS_GLYPH)).toHaveAttribute(
      "aria-hidden",
      "true",
    )
  })

  it("never dismisses itself — it is closed by the caller, never by its own state", async () => {
    const user = userEvent.setup()
    const { onDismiss } = renderReceipt()
    await user.click(screen.getByTestId("seed-receipt-dismiss"))
    // `open` is still true, because the caller owns it. The card is still on screen.
    expect(screen.getByTestId("seed-receipt")).toBeInTheDocument()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("open={false} produces NO DOM at all — no hidden node, no stale focus trap", () => {
    const { container } = renderReceipt({ open: false })
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId("seed-receipt")).toBeNull()
  })
})

// ── 4. EVERY SENTENCE IS AN IMPORTED IDENTIFIER, CHARACTER FOR CHARACTER ─────────────

describe("SeedReceipt — the copy is the copy module's", () => {
  it("renders each sentence identically to its definitionOps export", () => {
    renderReceipt()
    expect(screen.getByTestId("seed-receipt-heading").textContent).toBe(
      seedReceiptHeading(GROUNDED_PHASES.length),
    )
    expect(screen.getByTestId("seed-receipt-lead").textContent).toBe(
      // The DETECTED count, not the sealed one — the sentence begins "so I set", and the
      // AI set only the steps it detected. This is CR-01's falsifying assertion.
      seedReceiptGroundingLead(DETECTED_SLUGS.length),
    )
    expect(screen.getByTestId("seed-receipt-one-way").textContent).toBe(
      SEED_RECEIPT_ONE_WAY_RULE,
    )
    expect(screen.getByTestId("seed-receipt-carried").textContent).toBe(
      // The CARRIED count — sealed minus detected. Enumerated here from 187-20 onward, so
      // the docblock's "every sentence" is a claim over five sentences and not four.
      seedReceiptCarriedLead(SEALED_SLUGS.length - DETECTED_SLUGS.length),
    )
    expect(screen.getByTestId("seed-receipt-close").textContent).toBe(
      SEED_RECEIPT_NOTHING_COMMITTED,
    )
  })

  it("each per-step reason is the formatter's output, verbatim", () => {
    renderReceipt()
    const reasons = screen
      .getAllByTestId("seed-receipt-step-reason")
      .map((node) => node.textContent)
    expect(reasons).toEqual([
      seedReceiptStepReason("detected", "search_documents"),
      seedReceiptStepReason("detected", "read_document"),
      seedReceiptStepReason("already-set"),
    ])
  })

  it("the lead tracks the DETECTED count, not the step count", () => {
    // One detected step out of three: the singular form, and it must not report 3.
    const phases: PhaseSpecJSON[] = [
      BARE_PHASES[0],
      phaseBySlug(GROUNDED_PHASES, "contracts"),
      BARE_PHASES[1],
    ]
    renderReceipt({ phases })
    expect(screen.getByTestId("seed-receipt-lead").textContent).toBe(
      seedReceiptGroundingLead(1),
    )
    expect(screen.getByTestId("seed-receipt-heading").textContent).toBe(
      seedReceiptHeading(3),
    )
  })
})

// ── 5. THE STEP FACES AGREE WITH THE CANVAS ──────────────────────────────────────────

describe("SeedReceipt — the step faces", () => {
  it("names each listed step exactly as nodeTitle does, with the same context", () => {
    renderReceipt()
    const faces = screen
      .getAllByTestId("seed-receipt-step-face")
      .map((node) => node.textContent)
    expect(faces).toEqual(
      SEALED_SLUGS.map((slug) => nodeTitle(phaseBySlug(GROUNDED_PHASES, slug))),
    )
  })

  it("threads the injected name context through — a bound skill names its step", () => {
    const phases: PhaseSpecJSON[] = [
      {
        slug: "policy",
        phase_index: 0,
        config: {
          phase_type: "llm_agent",
          skill_ref: "6f1d-skill",
          available_tools: ["search_documents"],
        },
      },
    ]
    const nameContext: NameContext = { skillNames: { "6f1d-skill": "pricing policy check" } }
    renderReceipt({ phases, nameContext })
    expect(screen.getByTestId("seed-receipt-step-face").textContent).toBe(
      nodeTitle(phases[0], nameContext),
    )
  })

  it("falls through to the plain type sentence when the context is omitted", () => {
    // The SAME phase with NO context: the derived tier misses and the honest floor
    // renders. A raw id-shaped face here would be worse than a generic one.
    const phases: PhaseSpecJSON[] = [
      {
        slug: "policy",
        phase_index: 0,
        config: {
          phase_type: "llm_agent",
          skill_ref: "6f1d-skill",
          available_tools: ["search_documents"],
        },
      },
    ]
    renderReceipt({ phases })
    const face = screen.getByTestId("seed-receipt-step-face").textContent ?? ""
    expect(face).toBe(nodeTitle(phases[0]))
    expect(face).not.toContain("6f1d-skill")
  })

  it("never prints a slug on the surface — that lives behind the technical reveal", () => {
    renderReceipt()
    const text = screen.getByTestId("seed-receipt").textContent ?? ""
    for (const slug of [...SEALED_SLUGS, ...UNSEALED_SLUGS]) {
      expect(text).not.toContain(slug)
    }
  })
})

// ── 6. TOTALITY — an author-supplied row must never crash a projection ───────────────

describe("SeedReceipt — malformed rows resolve rather than throw", () => {
  it("renders a phase whose available_tools is not an array", () => {
    const phases = [
      {
        slug: "odd",
        phase_index: 0,
        name: "A hand-edited step",
        config: { phase_type: "llm_agent", available_tools: "search_documents" },
      } as unknown as PhaseSpecJSON,
    ]
    expect(() => renderReceipt({ phases })).not.toThrow()
    // A string is not a tool list, so nothing is detected and nothing is claimed.
    expect(screen.queryByTestId("seed-receipt-grounded-list")).toBeNull()
  })

  it("an EMPTY server tool list DETECTS nothing — and un-marks nothing either", () => {
    // RE-DERIVED, not relaxed. The old form asserted no list at all, which was only true
    // while the fixture's deliverable carried an unrepresentable policy. An unread palette
    // must not INVENT a detected step — and equally it must not UN-MARK a step the
    // author's own `citation_policy` dial holds (`phaseVocabulary.GroundingInputs.kbTools`
    // says exactly this). So: zero detected, and the deliverable still explained.
    renderReceipt({ kbTools: [] })
    expect(screen.getByTestId("seed-receipt")).toBeInTheDocument()
    expect(screen.getByTestId("seed-receipt")).toHaveAttribute("data-detected-count", "0")
    expect(screen.queryByTestId("seed-receipt-lead")).toBeNull()
    expect(listedSlugs()).toEqual(["emit"])
  })

  it("an empty palette over a draft with no deliverable lists nothing at all", () => {
    renderReceipt({ phases: BARE_PHASES, kbTools: [] })
    expect(screen.getByTestId("seed-receipt")).toBeInTheDocument()
    expect(screen.queryByTestId("seed-receipt-grounded-list")).toBeNull()
  })
})

// ── 6b. THE PROP CONTRACT: `phases` IS A SNAPSHOT, AND THIS LEAF PROJECTS IT ─────────
//
// Phase 187-22 Task 3 (CR-04). Added because `rerender(` appeared ZERO times in this file
// — measured with `grep -c` at HEAD before this plan — which is precisely why no test in
// it could ever have seen CR-04: every case rendered once and asked what was on screen.
//
// WHY THE CR-04 FALSIFICATION IS NOT HERE, AND MUST NOT BE MOVED HERE. The defect was
// that `WorkflowBuilderPage` handed this card the LIVE store selector, so an edit the
// author made in the inspector after the receipt arrived rewrote a sentence the AI is
// credited with. That is a CALLER bug, and its end-to-end fence lives in
// `WorkflowBuilderPage.canvas.test.tsx` — three real post-arrival edits driven through
// the shipped panel and lane, red before the fix and green after.
//
// A component-level "the card must not change when `phases` changes" case CANNOT be
// written honestly: this component is a PURE PROJECTION by construction (`:206-241` —
// every row, count and sentence is recomputed from the prop on every render), so hand it
// a mutated array and it will recompute, correctly, forever. The only way to make such a
// case green would be to give the leaf a hidden cache of its first props — which would
// break D-187-09's "a fresh generation gets a fresh receipt", hide the caller bug instead
// of fixing it, and contradict the prop contract this block exists to pin.
//
// So what belongs here is the two properties the component genuinely owns, and the second
// one is the fence that FORBIDS that wrong fix.

describe("SeedReceipt — `phases` is a snapshot the caller keeps, and this leaf only projects it", () => {
  /** One card over one snapshot. Written as an element factory so `rerender` hands the
   *  component a SECOND generation the way the page would, rather than mutating one. */
  function receiptFor(phases: readonly PhaseSpecJSON[], over: Partial<SeedReceiptProps> = {}) {
    return (
      <SeedReceipt
        phases={phases}
        kbTools={KB_TOOLS}
        open
        onDismiss={vi.fn()}
        {...over}
      />
    )
  }

  const cardText = () => screen.getByTestId("seed-receipt").textContent ?? ""
  const counts = () => {
    const card = screen.getByTestId("seed-receipt")
    return {
      grounded: card.getAttribute("data-grounded-count"),
      detected: card.getAttribute("data-detected-count"),
      carried: card.getAttribute("data-carried-count"),
    }
  }

  it("PURE PROJECTION — handed a new snapshot, every sentence and all three counts describe THAT one", () => {
    const { rerender } = render(receiptFor(GROUNDED_PHASES))
    // The first generation: 5 steps, 3 sealed, 2 of them this generation's own doing.
    const first = cardText()
    expect(counts()).toEqual({ grounded: "3", detected: "2", carried: "1" })

    // A SECOND generation arrives — one escalated agent step, nothing detected.
    rerender(receiptFor(ESCALATED_PHASES))

    // POSITIVE CONTROL — the two snapshots are demonstrably different, so this case
    // cannot pass by both projections happening to read the same.
    expect(cardText()).not.toBe(first)

    // Compared by IDENTITY against the copy home, never against hand-typed text.
    expect(screen.getByTestId("seed-receipt-heading").textContent).toBe(
      seedReceiptHeading(ESCALATED_PHASES.length),
    )
    expect(counts()).toEqual({ grounded: "1", detected: "0", carried: "1" })
    // Zero detected, so the paragraph that makes an authorship claim is ABSENT — and the
    // one-way rule travels with it, never with the carried sentence (D-185-07).
    expect(screen.queryByTestId("seed-receipt-grounding")).toBeNull()
    expect(screen.queryByTestId("seed-receipt-one-way")).toBeNull()
    expect(screen.getByTestId("seed-receipt-carried").textContent).toBe(
      seedReceiptCarriedLead(1),
    )
    // …and the list is the second snapshot's membership, with the second snapshot's cause.
    expect(listedSlugs()).toEqual(["judgement"])
    expect(screen.getByTestId("seed-receipt-step-reason").textContent).toBe(
      seedReceiptStepReason("escalated"),
    )
    expect(screen.getByTestId("seed-receipt-step-face").textContent).toBe(
      nodeTitle(phaseBySlug(ESCALATED_PHASES, "judgement")),
    )
  })

  it("A NEW SNAPSHOT REPLACES THE OLD ONE — this leaf holds no cache of its first props", () => {
    /**
     * THE FENCE AGAINST THE TEMPTING WRONG FIX FOR CR-04. Freezing the first `phases`
     * inside this component would make a page-level "the card did not move" case green
     * while leaving the caller reading the live store — and it would break D-187-09: the
     * author's SECOND draft would be narrated by their first draft's numbers.
     *
     * Asserted in BOTH directions, so a cache cannot hide in either: a second snapshot
     * takes over, and going back to the first restores it exactly.
     */
    const { rerender } = render(receiptFor(GROUNDED_PHASES))
    const asFirst = cardText()
    const countsFirst = counts()

    rerender(receiptFor(STRICT_EMIT_ONLY_PHASES))
    // POSITIVE CONTROL — the projection genuinely moved, so "restored" below is a claim
    // about coming back rather than about never having left.
    expect(cardText()).not.toBe(asFirst)
    expect(counts()).toEqual({ grounded: "1", detected: "0", carried: "1" })
    expect(listedSlugs()).toEqual(["emit"])

    rerender(receiptFor(GROUNDED_PHASES))
    expect(cardText()).toBe(asFirst)
    expect(counts()).toEqual(countsFirst)
    expect(listedSlugs()).toEqual(SEALED_SLUGS)
  })
})

// ── 7. THE SOURCE FENCE (the shipped `?raw` house idiom, S7) ─────────────────────────

describe("SeedReceipt — source purity, glyph discipline and no staged arrival", () => {
  // Assembled from parts so a grep of THIS guard file can neither satisfy nor break the
  // greps it protects. The two marks are sketch 150-C's unshipped review-state proposals.
  const UNSHIPPED_MARKS = [String.fromCodePoint(0x2726), String.fromCodePoint(0x2713)]
  const SEAL_MARK = String.fromCodePoint(0x26e8)
  const STAGING_NEEDLES = [
    ["set", "Timeout"].join(""),
    ["set", "Interval"].join(""),
    ["request", "AnimationFrame"].join(""),
    ["animation", "Delay"].join(""),
    ["transition", "Delay"].join(""),
  ]
  /** 187-22 — the two hooks that could give this leaf a hidden cache of its first
   *  `phases`. Assembled from parts for the same reason every needle above is: a grep of
   *  this guard file must not be able to satisfy the grep it protects. `useMemo` is
   *  deliberately NOT among them — the shipped derivation uses it, and a fence that fired
   *  on the code it sits beside gets deleted rather than fixed. */
  const CACHE_HOOKS = [["use", "State"].join(""), ["use", "Ref"].join("")]

  it("imports nothing from the API client and opens no request", () => {
    expect(seedReceiptSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    expect(seedReceiptSource).not.toMatch(/fetch\(/)
    expect(seedReceiptSource).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
  })

  it("POSITIVE CONTROL — it takes its sentences from the one copy home", () => {
    // The half that makes the fence above mean something. An absent API import proves
    // nothing on a file that imports nothing at all.
    expect(seedReceiptSource).toMatch(
      /from\s+["']@\/components\/workflows\/definitionOps["']/,
    )
    expect(seedReceiptSource).toMatch(/SEED_RECEIPT_NOTHING_COMMITTED/)
    expect(seedReceiptSource).toMatch(/SEED_RECEIPT_ONE_WAY_RULE/)
  })

  it("POSITIVE CONTROL — the reason comes from the ONE client grounding derivation", () => {
    expect(seedReceiptSource).toMatch(/groundingCauseOf/)
    expect(seedReceiptSource).toMatch(/seedReceiptStepReason/)
  })

  it("keeps the KB list on the server — it declares no tool-name table of its own", () => {
    // Two-or-more tool ids in one array literal would be a second home for the rule
    // D-182-06 puts on the server. The fixture in THIS file is not the component.
    expect(seedReceiptSource).not.toMatch(
      /\[\s*["'][a-z_]+_documents?["']\s*,\s*["'][a-z_]+["']/,
    )
    // Not even ONE KB tool id, spelled anywhere, in code or in prose.
    for (const tool of KB_TOOLS) expect(seedReceiptSource).not.toContain(tool)
  })

  it("stages NOTHING — generation is single-shot, so no reveal may imply otherwise", () => {
    // Req 5's "no node-by-node staging animation", proved as a SOURCE property. A timing
    // test would have to observe a negative; this cannot be satisfied by luck.
    for (const needle of STAGING_NEEDLES) {
      expect(seedReceiptSource).not.toContain(needle)
    }
    // A per-row stagger reaches for the map index. Nothing here does.
    expect(seedReceiptSource).not.toMatch(/\.map\(\s*\([^)]*,\s*(index|i)\b/)
    // The word for a timing offset is forbidden OUTRIGHT — in code and in prose alike.
    // A comment is where "we could stagger this later" is written down, and the point of
    // this fence is that nobody re-opens the question by accident.
    expect(seedReceiptSource).not.toMatch(/delay/i)
  })

  it("spends at most ONE entrance idiom, and it is motion-reduce disabled", () => {
    const entrances = seedReceiptSource.match(/animate-in/g) ?? []
    // The card's entrance and the seal's single arrival pulse — sketch 150-B's one
    // moment of attention. Both one-shot, neither repeating, neither delayed.
    expect(entrances.length).toBeLessThanOrEqual(2)
    const reduced = seedReceiptSource.match(/motion-reduce:animate-none/g) ?? []
    expect(reduced.length).toBe(entrances.length)
    expect(seedReceiptSource).not.toMatch(/animate-(pulse|ping|bounce|spin)/)
  })

  it("draws only shipped canvas marks — the unshipped proposals appear nowhere", () => {
    for (const mark of UNSHIPPED_MARKS) expect(seedReceiptSource).not.toContain(mark)
    // And the one canvas mark it DOES draw traces to the governance seal.
    expect(seedReceiptSource).toContain(SEAL_MARK)
    expect(seedReceiptSource).toMatch(/GOVERNANCE_SEAL_LABEL/)
  })

  it("holds NO cache of its first props — the CR-04 wrong fix, fenced at the source", () => {
    // 187-22. The render-level half is section 6b's replaceability case; this is the
    // structural half, and it is the cheaper of the two to keep honest: a cache can only
    // be built out of one of these two hooks, and neither is written here.
    for (const hook of CACHE_HOOKS) expect(seedReceiptSource).not.toContain(hook)
    // POSITIVE CONTROL — the file is not simply hook-free. It DOES memoise its derivation,
    // which is what makes the two absences above a statement about caching rather than
    // about React.
    expect(seedReceiptSource).toMatch(/useMemo</)
    // …and the prop contract that names the caller's obligation is actually written down.
    expect(seedReceiptSource).toMatch(/snapshot/i)
  })

  it("renders every authored string as a text child (T-187-13-04)", () => {
    expect(seedReceiptSource).not.toMatch(/dangerouslySetInnerHTML/)
  })

  it("closes by returning null rather than by hiding DOM", () => {
    expect(seedReceiptSource).toMatch(/if \(!open\) return null/)
    // `\shidden=` rather than `\bhidden\b=`: the latter matches INSIDE `aria-hidden=`,
    // which this file uses correctly twice. A fence that fires on its own good practice
    // gets deleted rather than fixed.
    expect(seedReceiptSource).not.toMatch(/\shidden=|display:\s*none/)
  })

  it("every STATIC testid the component renders is queried by this suite (187-20)", () => {
    // WHY THIS IS A TEST AND NOT A REVIEW HABIT. `seed-receipt-carried` shipped in 187-16
    // with ZERO queries against it — measured with a shell grep at HEAD before this plan,
    // which returned exactly one hit in all of `frontend/src/`: the component's own
    // attribute. A paragraph nothing queries can be deleted, can print the wrong number,
    // or can drift from its formatter with the whole suite green. A one-off grep finds
    // that once; this finds it every run, including for the NEXT testid somebody adds.
    //
    // The needle is ASSEMBLED at runtime from each extracted id, so this guard's own
    // source contains no literal `ByTestId("seed-receipt-…")` call and therefore cannot
    // satisfy itself — the same self-satisfaction trap the fences above avoid.
    const ids = [...seedReceiptSource.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1])
    const unique = [...new Set(ids)]
    // A regex that matched nothing would make every assertion below vacuous.
    expect(unique.length).toBeGreaterThan(0)
    // …and it must reach the id whose absence WAS the blocker, named explicitly so this
    // guard cannot pass by sweeping a set that quietly stopped containing it.
    expect(unique).toContain("seed-receipt-carried")
    for (const id of unique) {
      expect(testSource).toContain(`ByTestId("${id}")`)
    }
    // The row testid is a TEMPLATE literal (`seed-receipt-step-${row.slug}`), so a static
    // extraction correctly does not see it. It is not unguarded: section 1 queries every
    // fixture slug by name — `seed-receipt-step-emit`, `-contracts`, `-judgement`.
    expect(seedReceiptSource).toMatch(/data-testid=\{`seed-receipt-step-\$\{/)
  })

  it("those fences are real — each pattern matches its planted literal", () => {
    expect('import { x } from "@/lib/api"').toMatch(/from\s+["']@\/lib\/api["']/)
    expect('const r = await fetch("/x")').toMatch(/fetch\(/)
    expect("new EventSource(url)").toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
    expect('const KB = ["search_documents", "read_document"]').toMatch(
      /\[\s*["'][a-z_]+_documents?["']\s*,\s*["'][a-z_]+["']/,
    )
    expect("rows.map((row, index) => (").toMatch(/\.map\(\s*\([^)]*,\s*(index|i)\b/)
    expect("style={{ animationDelay: `${i * 60}ms` }}").toContain(STAGING_NEEDLES[3])
    expect("style={{ animationDelay: `${i * 60}ms` }}").toMatch(/delay/i)
    expect("// stagger each row by a small delay").toMatch(/delay/i)
    expect("<section hidden={!open}>").toMatch(/\shidden=|display:\s*none/)
    expect('<span style={{ display: none }}>').toMatch(/\shidden=|display:\s*none/)
    // …and the fence must NOT fire on the correct treatment it sits beside.
    expect('<span aria-hidden="true">').not.toMatch(/\shidden=|display:\s*none/)
    expect(`<span>${UNSHIPPED_MARKS[0]}</span>`).toContain(UNSHIPPED_MARKS[0])
    expect('<div dangerouslySetInnerHTML={{ __html: m }} />').toMatch(
      /dangerouslySetInnerHTML/,
    )
    expect('className="animate-pulse"').toMatch(/animate-(pulse|ping|bounce|spin)/)
    // 187-22 — the two cache hooks, each planted in the exact shape the wrong fix for
    // CR-04 would take, so their absence above is falsifiable rather than merely true.
    expect("const [seeded, setSeeded] = useState(phases)").toContain(CACHE_HOOKS[0])
    expect("const firstPhases = useRef(phases)").toContain(CACHE_HOOKS[1])
    // …and the control must NOT fire on the memo the component legitimately uses.
    expect("const rows = useMemo<GroundedRow[]>(() => {").not.toContain(CACHE_HOOKS[0])
    expect("const rows = useMemo<GroundedRow[]>(() => {").not.toContain(CACHE_HOOKS[1])
  })
})
