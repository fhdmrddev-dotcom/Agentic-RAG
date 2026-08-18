/**
 * Phase 192.2-02 Task 1 (LIB-06 — CONTEXT D-05, threat T-04) — THE CHARACTERIZATION PIN.
 *
 * ── WHAT THIS FILE IS FOR, AND WHY IT IS A SEPARATE SUITE ────────────────────────────────
 * `192.2-02` extracts the card's lead/defer decision into `cardFace.ts` and must change NO
 * PIXEL doing it. This suite is the proof of that claim, and it is the ONLY artifact of this
 * plan that is allowed to have been written BEFORE the extraction:
 *
 *   RUN IT AT THE PHASE BASE → GREEN.   RUN IT AFTER THE EXTRACTION → GREEN, UNEDITED.
 *
 * ⚠ **A CHARACTERIZATION TEST AUTHORED AFTER THE REFACTOR PINS THE REFACTOR'S OUTPUT, NOT THE
 * ORIGINAL'S.** That is the 188.1 lesson — *a baseline only proves something if it PREDATES the
 * change* — and it is the exact trap this file exists to stay out of. Its commit is therefore
 * the commit BEFORE `cardFace.ts` exists, and its green verdict at that commit is recorded
 * verbatim in `192.2-02-SUMMARY.md`. If a later task needs a line of this file changed to pass,
 * **the refactor changed behaviour and the SOURCE is what is wrong.**
 *
 * ── IT PINS THE 17-ATOM INVENTORY, NOT A SELECTION FROM IT ───────────────────────────────
 * `192.2-01-SUMMARY.md` §3 inventories every resting-visible atom the card renders, in DOM
 * order, as literal on-screen strings. This suite asserts that inventory by VISIBLE TEXT, so a
 * refactor that keeps a `data-testid` alive while emptying the node it names still reds here.
 * The six atoms D-03 will CUT in Wave 4 are pinned exactly as hard as the eleven that stay:
 * this plan is a pure refactor, so Wave 4 — and only Wave 4 — is where this pin is deliberately
 * re-baselined.
 *
 * ── THE FOUR ROWS, AND WHY THE FOURTH IS THE IMPORTANT ONE ───────────────────────────────
 * A published row, a draft and a starter cover the three provenance faces. The FOURTH is a row
 * whose `name` is the EMPTY STRING — `WR-01` was a shipped bug in which an empty name blanked
 * the library title, so "what does this card do with a nameless row" is a question with a
 * measured history rather than a hypothetical. The pin records TODAY's answer (the title node
 * renders, carrying no text) so that a later wave changing it is making a visible decision
 * instead of an accident.
 *
 * ⚠ THE ROWS COME FROM `libraryRowOf`, THE SHIPPED FIXTURE SEAM (`__fixtures__/libraryScale.ts`
 * :785), and the identity line from the REAL `buildIdentityIndex` / `resolveIdentity`. A
 * hand-built identity would pin what this file believes the resolver says; the real resolver
 * pins what the card is really handed. Rows are located by `data-testid` and by visible text —
 * NEVER by `getElementById` (D-27).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"

const { mockDeleteDraft, mockCascade, mockPreview } = vi.hoisted(() => ({
  mockDeleteDraft: vi.fn(),
  mockCascade: vi.fn(),
  mockPreview: vi.fn(),
}))

// The api seam — the card's own D-18 call plus the two the mounted delete Sheet owns. Mocked
// so a render never reaches the network, exactly as `WorkflowCard.test.tsx:52-57` does.
vi.mock("@/lib/api", () => ({
  deleteWorkflowDraft: mockDeleteDraft,
  deleteWorkflowCascade: mockCascade,
  getWorkflowDeletePreview: mockPreview,
}))

import { templateAdmission } from "@/components/workflows/soulData"

import { WorkflowCard, type WorkflowCardProps } from "./WorkflowCard"
import type { LibraryRow } from "./libraryRow"
import {
  CARD_TEMPLATE_MARK,
  CHANGED_PREFIX,
  FORK_CONSEQUENCE,
  OWN_SHARED,
  OWN_YOURS,
  oneOfLabel,
} from "./libraryVocabulary"
import { buildIdentityIndex, resolveIdentity, type RowIdentity } from "./rowIdentity"
import { FIXTURE_NOW, libraryRowOf } from "./__fixtures__/libraryScale"

// ── the four rows ────────────────────────────────────────────────────────────────────

/**
 * THREE ROWS SHARE ONE NAME ON PURPOSE. The library's measured shape is 43 rows called
 * *Compliance Gap Report* (CONTEXT `<measurements>`), so a fixture of four distinct names could
 * not reach the collision counter — atom 6 — at all, and the pin would silently omit it.
 * The slugs are distinct, so the three rows are three workflows rather than three versions.
 */
const PUBLISHED = libraryRowOf({ id: "row-published", slug: "vendor-risk-published" })
const DRAFT = libraryRowOf({
  id: "row-draft",
  slug: "vendor-risk-drafted",
  provenance: "draft",
  // The shipped normalizer leaves a draft's ownership bit UNSAID (`libraryFilter.ts:97`); the
  // feed-derived fallback answers it. Pinning `true` here would hide that path.
  isMine: undefined,
})
const STARTER = libraryRowOf({
  id: "row-starter",
  slug: "vendor-risk-starter-shape",
  provenance: "starter",
  isMine: false,
})
/** ⚠ WR-01's row. The name is the empty string, not a placeholder and not whitespace. */
const NAMELESS = libraryRowOf({ id: "row-nameless", slug: "vendor-risk-nameless", name: "" })

const ROWS: readonly LibraryRow[] = [PUBLISHED, DRAFT, STARTER, NAMELESS]

/** The REAL index over the REAL four rows — see this file's header. */
const INDEX = buildIdentityIndex(ROWS)
const identityFor = (row: LibraryRow): RowIdentity => resolveIdentity(INDEX, row, FIXTURE_NOW)

const FOLDER_NAME = "Client Reports"

const ROOT_TESTID = {
  published: "published-card",
  starter: "starter-card",
  draft: "draft-card",
} as const

function renderCard(row: LibraryRow, over: Partial<WorkflowCardProps> = {}) {
  const props: WorkflowCardProps = {
    row,
    folderName: FOLDER_NAME,
    onRun: vi.fn(),
    onOpen: vi.fn(),
    onForkNewVersion: vi.fn(),
    onForkStarter: vi.fn(),
    onDeleted: vi.fn(),
    identity: identityFor(row),
    ...over,
  }
  render(<WorkflowCard {...props} />)
  return screen.getByTestId(ROOT_TESTID[row.provenance])
}

/** The identity line's parts in DOM order, separators dropped (the `WorkflowCard.test.tsx:190` idiom). */
const identityParts = (card: HTMLElement): string[] =>
  Array.from(within(card).getByTestId("row-identity").children)
    .map((child) => child.textContent ?? "")
    .filter((text) => text !== "·")

beforeEach(() => {
  vi.clearAllMocks()
  mockDeleteDraft.mockResolvedValue(undefined)
})

// ── 0 · the fixture really is the shape this pin claims ──────────────────────────────

describe("the corpus is what the atoms below are asserted against", () => {
  it("three rows collide on one name and the fourth is nameless", () => {
    expect([PUBLISHED.name, DRAFT.name, STARTER.name]).toEqual([
      "Vendor Risk Review",
      "Vendor Risk Review",
      "Vendor Risk Review",
    ])
    expect(NAMELESS.name).toBe("")
    expect(new Set(ROWS.map((r) => r.slug)).size).toBe(4)
  })

  it("the resolver — not this file — is what supplies the identity line", () => {
    // A pin whose identity came from a literal would prove the card paints a literal.
    expect(identityFor(PUBLISHED).ofN).toBe(oneOfLabel(3))
    expect(identityFor(NAMELESS).ofN).toBeNull()
    expect(identityFor(PUBLISHED).when).toBe(CHANGED_PREFIX + "5 days ago")
    // ⚠ READ OUT OF THIS SUITE'S OWN FAILING DIFF, never predicted: the state axis is what
    // narrows three same-named rows of three different provenances.
    expect(identityFor(PUBLISHED).segs).toEqual(["Ready to run"])
  })

  it("every fixture row ADMITS a template, so the AUTH-03 mark is on the line", () => {
    // ⚠ Also read out of the failing diff. The mark is a SEGMENT of the identity line
    // (`WorkflowCard.tsx:568`), so a pin that omitted it would be asserting a line the card
    // does not render. Which ARM the fixture reaches is proved, not assumed (the 192 CR-01
    // defect: *both failure tests pinned the correct branch without entering the wrong one*).
    for (const row of ROWS) expect(templateAdmission(row.def)).toBe("admits")
  })
})

// ── 1 · the published row — every atom, by visible text ──────────────────────────────

describe("BASELINE — the resting PUBLISHED card", () => {
  it("atoms 1-3 · the mark, the name, the version", () => {
    const card = renderCard(PUBLISHED)
    expect(card).toHaveTextContent("📄")
    expect(within(card).getByText("Vendor Risk Review")).toBeInTheDocument()
    expect(within(card).getByText("v1")).toBeInTheDocument()
  })

  it("atoms 4-7 · the identity line — ownership, discriminators, collision counter, recency", () => {
    const card = renderCard(PUBLISHED)
    const identity = identityFor(PUBLISHED)
    // The WHOLE line, in order: the card paints exactly what the resolver said and invents
    // nothing. Asserting the array rather than a substring is what pins the ORDER too.
    expect(identityParts(card)).toEqual([
      OWN_YOURS,
      CARD_TEMPLATE_MARK,
      ...identity.segs,
      oneOfLabel(3),
      CHANGED_PREFIX + "5 days ago",
    ])
    expect(identity.own).toBe(OWN_YOURS)
  })

  it("atom 8 · the folder chip", () => {
    const card = renderCard(PUBLISHED)
    expect(card).toHaveTextContent("📁 " + FOLDER_NAME)
  })

  it("atom 9 · the overflow trigger", () => {
    const card = renderCard(PUBLISHED)
    expect(within(card).getByRole("button", { name: "Workflow actions" })).toBeInTheDocument()
  })

  it("atom 10 · the state pill", () => {
    const card = renderCard(PUBLISHED)
    expect(within(card).getByText("published")).toBeInTheDocument()
  })

  it("atoms 11-15 · the five soul atoms", () => {
    const card = renderCard(PUBLISHED)
    expect(within(card).getByTestId("soul-purpose")).toHaveTextContent(
      "Assess a vendor against our security requirements before renewal.",
    )
    expect(within(card).getByTestId("soul-needs")).toHaveTextContent("needs kickoff_prompt")
    expect(within(card).getByTestId("soul-spine")).toBeInTheDocument()
    expect(within(card).getByTestId("soul-tier")).toHaveTextContent("Strict")
    expect(within(card).getByTestId("soul-tier")).toHaveAttribute("data-tier", "STRICT")
    // ⚠ Read out of this suite's own failing diff too. The fixture's chain ends in an
    // `llm_emit` phase, so the deliverable is a FILE and the label is the workflow's name.
    expect(within(card).getByTestId("soul-output")).toHaveTextContent(
      "produces: Vendor Risk Review · file",
    )
  })

  it("atom 16 · the fork consequence sentence", () => {
    const card = renderCard(PUBLISHED)
    expect(within(card).getByTestId("fork-consequence")).toHaveTextContent(FORK_CONSEQUENCE)
  })

  it("atom 17 · the one primary verb", () => {
    const card = renderCard(PUBLISHED)
    expect(within(card).getByTestId("published-run")).toHaveTextContent("▶ Run")
    expect(within(card).queryByTestId("draft-open")).toBeNull()
  })
})

// ── 2 · the draft — the OTHER face of every atom that varies ─────────────────────────

describe("BASELINE — the resting DRAFT card", () => {
  it("leads with the draft mark and carries the draft pill", () => {
    const card = renderCard(DRAFT)
    expect(card).toHaveTextContent("📝")
    expect(within(card).getByText("draft")).toBeInTheDocument()
  })

  it("says Yours through the feed-derived fallback, the wire having said nothing", () => {
    expect(DRAFT.isMine).toBeUndefined()
    const card = renderCard(DRAFT)
    expect(identityParts(card)[0]).toBe(OWN_YOURS)
  })

  it("leads with Open, reaches NO Run affordance, and spends no consequence sentence", () => {
    const card = renderCard(DRAFT)
    expect(within(card).getByTestId("draft-open")).toHaveTextContent("✎ Open")
    expect(within(card).queryByTestId("published-run")).toBeNull()
    expect(within(card).queryByTestId("fork-consequence")).toBeNull()
  })

  it("still renders all five soul atoms", () => {
    const card = renderCard(DRAFT)
    for (const id of ["soul-purpose", "soul-needs", "soul-spine", "soul-tier", "soul-output"]) {
      expect(within(card).getByTestId(id)).toBeInTheDocument()
    }
  })
})

// ── 3 · the starter ──────────────────────────────────────────────────────────────────

describe("BASELINE — the resting STARTER card", () => {
  it("leads with the starter mark and carries the Starter pill", () => {
    const card = renderCard(STARTER)
    expect(card).toHaveTextContent("✨")
    expect(within(card).getByText("Starter")).toBeInTheDocument()
  })

  it("says Shared — it is not this reader's row", () => {
    const card = renderCard(STARTER)
    expect(identityParts(card)[0]).toBe(OWN_SHARED)
  })

  it("is runnable: it leads with Run and spends the consequence sentence", () => {
    const card = renderCard(STARTER)
    expect(within(card).getByTestId("published-run")).toHaveTextContent("▶ Run")
    expect(within(card).getByTestId("fork-consequence")).toHaveTextContent(FORK_CONSEQUENCE)
  })
})

// ── 4 · WR-01's row — the empty name ─────────────────────────────────────────────────

describe("BASELINE — a row whose name is the empty string (WR-01)", () => {
  it("renders the title node, carrying no text — TODAY'S answer, pinned", () => {
    const card = renderCard(NAMELESS)
    // Located by the mark's sibling position rather than by a testid: the title carries no
    // test hook of its own, and inventing one here would change the file this plan refactors.
    const header = within(card).getByText("v1").parentElement
    expect(header).not.toBeNull()
    const title = Array.from(header!.children).find((child) =>
      child.className.includes("truncate"),
    )
    expect(title).toBeDefined()
    expect(title!.textContent).toBe("")
  })

  it("degrades readably: the row is still identifiable, still runnable, still complete", () => {
    const card = renderCard(NAMELESS)
    expect(card).toHaveTextContent("📄")
    expect(within(card).getByText("v1")).toBeInTheDocument()
    expect(identityParts(card)[0]).toBe(OWN_YOURS)
    expect(within(card).getByText("published")).toBeInTheDocument()
    expect(within(card).getByTestId("published-run")).toHaveTextContent("▶ Run")
    expect(within(card).getByTestId("soul-purpose")).toBeInTheDocument()
  })

  it("collides with nobody, so it spends no counter and no dangling separator", () => {
    const card = renderCard(NAMELESS)
    const parts = identityParts(card)
    expect(parts).not.toContain(oneOfLabel(3))
    expect(parts.every((part) => part !== "")).toBe(true)
  })
})

// ── 5 · the whole inventory, as ONE assertion per row ────────────────────────────────

describe("BASELINE — every resting atom, per provenance, in one place", () => {
  it.each([
    ["published", PUBLISHED, "📄", "published", true] as const,
    ["draft", DRAFT, "📝", "draft", false] as const,
    ["starter", STARTER, "✨", "Starter", true] as const,
  ])("%s renders its mark, its pill and its verb", (_label, row, mark, pill, runnable) => {
    const card = renderCard(row)
    expect(card).toHaveTextContent(mark)
    expect(within(card).getByText(pill)).toBeInTheDocument()
    expect(within(card).getByTestId(runnable ? "published-run" : "draft-open")).toBeInTheDocument()
    // The five soul atoms and the folder chip are unconditional across all three faces.
    expect(within(card).getByTestId("workflow-soul")).toBeInTheDocument()
    expect(card).toHaveTextContent("📁 " + FOLDER_NAME)
  })
})
