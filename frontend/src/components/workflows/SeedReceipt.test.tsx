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
 *    the same silence the copy module exists to break (T-187-13-05);
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
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import seedReceiptSource from "./SeedReceipt?raw"
import { SeedReceipt, type SeedReceiptProps } from "./SeedReceipt"
import {
  GOVERNANCE_SEAL_LABEL,
  SEED_RECEIPT_DISMISS_GLYPH,
  SEED_RECEIPT_DISMISS_LABEL,
  SEED_RECEIPT_NOTHING_COMMITTED,
  SEED_RECEIPT_ONE_WAY_RULE,
  seedReceiptGroundingLead,
  seedReceiptHeading,
  seedReceiptStepReason,
} from "./definitionOps"
import { nodeTitle, type NameContext, type PhaseSpecJSON } from "./phaseVocabulary"

/** The server's list, mirrored here as a FIXTURE only — the component never owns it. */
const KB_TOOLS = [
  "search_documents",
  "query_documents",
  "read_document",
  "analyze_document",
  "get_related_documents",
]

/**
 * A drafted definition with TWO steps that read the documents and three that do not.
 *
 * The two grounded steps deliberately intersect on DIFFERENT tools, and the second one
 * lists a non-KB tool FIRST. A component that hardcoded one tool id, or that named the
 * head of `available_tools` instead of the intersection, passes on the first row and
 * fails on the second — which is the whole reason the second row exists.
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
    config: { phase_type: "llm_emit", citation_policy: "loose" },
  },
]

/** The two steps that must be listed, and the three that must not. */
const GROUNDED_SLUGS = ["contracts", "policy_check"]
const UNGROUNDED_SLUGS = ["gather", "write", "emit"]

/** A draft where NOTHING reads the documents (D-187-10's zero case). */
const BARE_PHASES: PhaseSpecJSON[] = [
  { slug: "gather", phase_index: 0, name: "Collect the renewal inputs", config: { phase_type: "programmatic" } },
  { slug: "write", phase_index: 1, name: "Draft the renewal summary", config: { phase_type: "llm_single" } },
  {
    slug: "emit",
    phase_index: 2,
    name: "Produce the renewal pack",
    config: { phase_type: "llm_emit", citation_policy: "loose" },
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
  it("lists EXACTLY the steps that read the documents, and no others", () => {
    renderReceipt()
    expect(listedSlugs()).toEqual(GROUNDED_SLUGS)
  })

  it("never names a step that does not read the documents", () => {
    renderReceipt()
    const list = screen.getByTestId("seed-receipt-grounded-list")
    for (const slug of UNGROUNDED_SLUGS) {
      const phase = phaseBySlug(GROUNDED_PHASES, slug)
      expect(list.textContent ?? "").not.toContain(nodeTitle(phase))
    }
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
    expect(seals).toHaveLength(GROUNDED_SLUGS.length)
    for (const seal of seals) expect(seal).toHaveAttribute("aria-hidden", "true")
    expect(within(list).getAllByText(GOVERNANCE_SEAL_LABEL)).toHaveLength(
      GROUNDED_SLUGS.length,
    )
  })

  it("marks the grounded count on the surface itself, from the same derivation", () => {
    renderReceipt()
    expect(screen.getByTestId("seed-receipt")).toHaveAttribute(
      "data-grounded-count",
      String(GROUNDED_SLUGS.length),
    )
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
      seedReceiptGroundingLead(GROUNDED_SLUGS.length),
    )
    expect(screen.getByTestId("seed-receipt-one-way").textContent).toBe(
      SEED_RECEIPT_ONE_WAY_RULE,
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
    ])
  })

  it("the lead tracks the grounded count, not the step count", () => {
    // One grounded step out of three: the singular form, and it must not report 3.
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
      GROUNDED_SLUGS.map((slug) => nodeTitle(phaseBySlug(GROUNDED_PHASES, slug))),
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
    for (const slug of [...GROUNDED_SLUGS, ...UNGROUNDED_SLUGS]) {
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

  it("renders with an EMPTY server tool list — an unread palette marks nothing", () => {
    renderReceipt({ kbTools: [] })
    expect(screen.getByTestId("seed-receipt")).toBeInTheDocument()
    expect(screen.queryByTestId("seed-receipt-grounded-list")).toBeNull()
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
  })
})
