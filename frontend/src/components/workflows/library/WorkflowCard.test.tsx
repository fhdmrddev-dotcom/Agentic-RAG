/**
 * Phase 192-09 Task 3 (LIB-02 / LIB-03 — D-09 / D-10 / D-12 / D-13 / D-14 / D-15 / D-18) —
 * the one library card's contract.
 *
 * `192-VALIDATION.md`'s lived-experience rows are the counterpart of these assertions and
 * neither half replaces the other. This file proves the STRUCTURE a person would then judge:
 * that a draft really cannot reach a Run affordance, that the fork's explanation really is
 * text in the document rather than a hover, that the two fork paths really are still two.
 *
 * ── EVERY ABSENCE HERE CARRIES A POSITIVE CONTROL ───────────────────────────────────────
 * The Phase 187 lesson, and `GovernanceSection.test.tsx:136-142`'s fourth case: an assertion
 * that a selector finds NOTHING passes identically when the selector is broken, when the
 * component never had the thing, and when the component did not render at all. So each
 * absence is paired with a control that makes the SAME selector find the SAME shape — twice
 * on a node this file plants itself, so the control cannot be satisfied by the component
 * under test.
 *
 * ── AND EVERY `aria-describedby` IS A ROUND TRIP ────────────────────────────────────────
 * An attribute-presence check passes on an id that resolves to nothing, which is the exact
 * silent failure D-14 would produce if the sentence were dropped but the wiring left behind.
 * The id is therefore resolved through `document.getElementById` and the resolved element's
 * text compared to the imported constant.
 *
 * ── THE `title` ATTRIBUTE APPEARS IN THIS FILE ON PURPOSE ───────────────────────────────
 * F1 sweeps SEVEN NAMED SOURCE MODULES and no test file (`librarySubtree.fences.test.ts:106`
 * asserts exactly that). Spelling the forbidden attribute here is what lets the positive
 * control prove `getByTitle` can find one — without which "the fork control has no tooltip"
 * would be a claim about a selector rather than about the card.
 *
 * ⚠ NOT PINNED IN THE COUNT GATE YET — OWED, NOT WAIVED. This file lands under
 * `src/components/workflows`, which `scripts/vitest-count-gate.cjs` already RUNS through its
 * directory entry, so it is discovered and executed; it is simply not in `BASELINE`, and an
 * unpinned suite is an unguarded one (the 188-12 precedent). `192-12` owes the pin, taken
 * from the gate's own printed `actual` across two agreeing runs. No `TARGETS` entry is added:
 * the directory entry already reaches this path, and a `TARGETS` path that does not resolve
 * makes the gate ERROR (exit 2) rather than merely fail.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const { mockDeleteDraft, mockCascade, mockPreview } = vi.hoisted(() => ({
  mockDeleteDraft: vi.fn(),
  mockCascade: vi.fn(),
  mockPreview: vi.fn(),
}))

// The api seam. `deleteWorkflowDraft` is the card's own D-18 call; the other two belong to
// the Sheet and are mocked HERE so a draft path reaching either of them is visible as a
// call rather than as a network error.
vi.mock("@/lib/api", () => ({
  deleteWorkflowDraft: mockDeleteDraft,
  deleteWorkflowCascade: mockCascade,
  getWorkflowDeletePreview: mockPreview,
}))

import { WorkflowCard, type WorkflowCardProps } from "./WorkflowCard"
import type { LibraryRow, Provenance } from "./libraryRow"
import { FORK_CONSEQUENCE, FORK_CONSEQUENCE_EXISTING, FORK_VERB } from "./libraryVocabulary"

// ── fixtures ─────────────────────────────────────────────────────────────────────────

/**
 * A definition rich enough that ALL FIVE soul atoms have something real to render — a purpose
 * sentence, declared inputs, two phases for the spine, a citation policy the tier derives
 * from, and an emit phase the deliverable reads. A fixture missing any of them would let the
 * LIB-02 "five atoms" case pass on empty states.
 */
const DEF = {
  slug: "vendor-risk",
  version: 3,
  business_requirement: "Review a vendor contract and flag the clauses that need sign-off.",
  inputs: [{ key: "contract_file" }],
  phases: [
    { slug: "read", phase_index: 0, config: { phase_type: "llm_agent", citation_policy: "must_cite" } },
    {
      slug: "emit",
      phase_index: 1,
      config: { phase_type: "llm_emit", citation_policy: "must_cite", output_filename: "review.docx" },
    },
  ],
}

const rowOf = (provenance: Provenance, over: Partial<LibraryRow> = {}): LibraryRow => ({
  id: `row-${provenance}`,
  slug: "vendor-risk",
  name: "Vendor-risk review",
  version: 3,
  def: DEF as unknown as LibraryRow["def"],
  provenance,
  // The wire's ownership bit. A starter is not yours; the other two are.
  isMine: provenance === "starter" ? false : true,
  source: { id: `row-${provenance}`, slug: "vendor-risk", name: "Vendor-risk review" } as unknown as LibraryRow["source"],
  ...over,
})

const PUBLISHED = rowOf("published")
const STARTER = rowOf("starter")
const DRAFT = rowOf("draft")

function renderCard(row: LibraryRow, over: Partial<WorkflowCardProps> = {}) {
  const props: WorkflowCardProps = {
    row,
    folderName: null,
    onRun: vi.fn(),
    onOpen: vi.fn(),
    onForkNewVersion: vi.fn(),
    onForkStarter: vi.fn(),
    onDeleted: vi.fn(),
    ...over,
  }
  const utils = render(<WorkflowCard {...props} />)
  const card = screen.getByTestId(
    row.provenance === "published"
      ? "published-card"
      : row.provenance === "starter"
        ? "starter-card"
        : "draft-card",
  )
  return { ...utils, props, card }
}

/** Open the `⋯` overflow on a rendered card and return the menu's items. */
async function openOverflow(card: HTMLElement) {
  const user = userEvent.setup()
  await user.click(within(card).getByRole("button", { name: /workflow actions/i }))
  await screen.findByRole("menu")
  return user
}

/**
 * Every focusable control the card renders EXCEPT the `⋯` trigger. D-09's "exactly one
 * primary verb" is a claim about this set, so it is computed rather than assumed from the
 * queries this file happens to write.
 */
const primaryVerbs = (card: HTMLElement): HTMLElement[] =>
  Array.from(card.querySelectorAll("button")).filter(
    (b) => b.getAttribute("aria-label") !== "Workflow actions",
  )

beforeEach(() => {
  vi.clearAllMocks()
  // Radix DropdownMenu uses pointer-capture + scrollIntoView APIs jsdom does not implement;
  // the standard shim, copied from `PublishedCardDelete.test.tsx:90-95`.
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  mockDeleteDraft.mockResolvedValue(undefined)
})

// ── 1 · THE VERB TABLE (D-09) ────────────────────────────────────────────────────────

describe("D-09 — exactly one primary verb per row state", () => {
  it("a published row leads with Run, and with nothing else", () => {
    const { card } = renderCard(PUBLISHED)
    const verbs = primaryVerbs(card)
    expect(verbs).toHaveLength(1)
    expect(verbs[0]).toHaveAttribute("data-testid", "published-run")
    expect(verbs[0].textContent).toBe("▶ Run")
  })

  it("a starter row leads with the SAME verb — one vocabulary for one list", () => {
    const { card } = renderCard(STARTER)
    const verbs = primaryVerbs(card)
    expect(verbs).toHaveLength(1)
    expect(verbs[0]).toHaveAttribute("data-testid", "published-run")
  })

  it("a draft row leads with Open, and with nothing else", () => {
    const { card } = renderCard(DRAFT)
    const verbs = primaryVerbs(card)
    expect(verbs).toHaveLength(1)
    expect(verbs[0]).toHaveAttribute("data-testid", "draft-open")
    expect(verbs[0].textContent).toBe("✎ Open")
  })

  it("the primary verb calls the handler for its row state", async () => {
    const user = userEvent.setup()
    const { card, props } = renderCard(PUBLISHED)
    await user.click(primaryVerbs(card)[0])
    expect(props.onRun).toHaveBeenCalledWith(PUBLISHED)

    const draft = renderCard(DRAFT)
    await user.click(primaryVerbs(draft.card)[0])
    expect(draft.props.onOpen).toHaveBeenCalledWith(DRAFT)
  })

  it("a DRAFT reaches NO Run affordance — not on its face, not inside the opened ⋯ menu", async () => {
    const { card } = renderCard(DRAFT)
    await openOverflow(card)
    // The whole document, because the menu renders in a portal outside the card.
    expect(screen.queryByTestId("published-run")).toBeNull()
    expect(screen.queryByText(/^▶?\s*Run$/)).toBeNull()
  })

  it("POSITIVE CONTROL — the same two Run queries DO find one on a published row", async () => {
    // Without this, the case above passes on a card that renders nothing at all, or on a
    // selector that never matched the shipped Run control in the first place.
    const { card } = renderCard(PUBLISHED)
    await openOverflow(card)
    expect(screen.getByTestId("published-run")).toBeInTheDocument()
    expect(screen.getByText(/^▶?\s*Run$/)).toBeInTheDocument()
  })
})

// ── 2 · THE BUTTON THAT LIED IS GONE (D-10) ──────────────────────────────────────────

/** Assembled from parts so this file does not itself contain the removed label. */
const REMOVED_LABEL = ["Publi", "sh…"].join("")
const REMOVED_LABEL_RE = /^Publish…?$/

describe("D-10 — the second draft button does not exist in any row state", () => {
  it.each<[Provenance, LibraryRow]>([
    ["published", PUBLISHED],
    ["starter", STARTER],
    ["draft", DRAFT],
  ])("a %s row renders no such control, open menu included", async (_p, row) => {
    const { card } = renderCard(row)
    await openOverflow(card)
    expect(screen.queryByText(REMOVED_LABEL_RE)).toBeNull()
    expect(screen.queryByTestId("draft-publish")).toBeNull()
  })

  it("POSITIVE CONTROL — the same selector finds a locally planted one", () => {
    // The absence above is about the CARD, not about the query. This plants the exact label
    // on a node of this test's own making and proves the matcher would have caught it.
    render(<button type="button">{REMOVED_LABEL}</button>)
    expect(screen.getByText(REMOVED_LABEL_RE)).toBeInTheDocument()
  })
})

// ── 3 · ONE WORD, TWO FUNCTIONS (D-12) ───────────────────────────────────────────────

describe("D-12 — the fork is one word branching to two intact handlers", () => {
  it("a STARTER row's fork calls the fresh-copy handler and never the other", async () => {
    const { card, props } = renderCard(STARTER)
    const user = await openOverflow(card)
    const fork = screen.getByTestId("use-starter")
    expect(fork.textContent).toBe(FORK_VERB)
    await user.click(fork)
    expect(props.onForkStarter).toHaveBeenCalledWith(STARTER)
    expect(props.onForkNewVersion).not.toHaveBeenCalled()
  })

  it("a PUBLISHED row's fork calls the same-slug handler and never the other", async () => {
    const { card, props } = renderCard(PUBLISHED)
    const user = await openOverflow(card)
    const fork = screen.getByTestId("published-tweak")
    expect(fork.textContent).toBe(FORK_VERB)
    await user.click(fork)
    expect(props.onForkNewVersion).toHaveBeenCalledWith(PUBLISHED)
    expect(props.onForkStarter).not.toHaveBeenCalled()
  })

  it("the two fork testids are on DIFFERENT controls, each reachable only for its own row", async () => {
    // Collapsing them to one id would erase the only mechanical evidence that the two fork
    // PATHS are still two paths — which is the whole of D-12.
    const published = renderCard(PUBLISHED)
    await openOverflow(published.card)
    expect(screen.getByTestId("published-tweak")).toBeInTheDocument()
    expect(screen.queryByTestId("use-starter")).toBeNull()
    published.unmount()

    const starter = renderCard(STARTER)
    await openOverflow(starter.card)
    expect(screen.getByTestId("use-starter")).toBeInTheDocument()
    expect(screen.queryByTestId("published-tweak")).toBeNull()
  })

  it("a DRAFT row offers no fork at all — there is nothing yet to fork from", async () => {
    const { card } = renderCard(DRAFT)
    await openOverflow(card)
    expect(screen.queryByTestId("published-tweak")).toBeNull()
    expect(screen.queryByTestId("use-starter")).toBeNull()
  })
})

// ── 4 · THE CONSEQUENCE IS AN A11Y CONTRACT, NOT A TOOLTIP (D-13 / D-14) ─────────────

describe("D-13 / D-14 — one sentence, as real DOM text, wired by aria-describedby", () => {
  it("the fork control's describedby RESOLVES to an element whose text is the sentence", async () => {
    const { card } = renderCard(PUBLISHED)
    await openOverflow(card)
    const describedBy = screen.getByTestId("published-tweak").getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    // The load-bearing half: an id pointing at nothing passes a presence check.
    const sentence = document.getElementById(describedBy as string)
    expect(sentence).not.toBeNull()
    expect(sentence?.textContent).toBe(FORK_CONSEQUENCE)
  })

  it("the starter row's fork is described by the same sentence", async () => {
    const { card } = renderCard(STARTER)
    await openOverflow(card)
    const describedBy = screen.getByTestId("use-starter").getAttribute("aria-describedby")
    expect(document.getElementById(describedBy as string)?.textContent).toBe(FORK_CONSEQUENCE)
  })

  it("the sentence names BOTH halves — what you get AND what stays true", () => {
    // Naming only the first half reproduces the exact surprise LIB-03 exists to end, so a
    // shortened rewrite is a regression even though it would read fine.
    renderCard(PUBLISHED)
    const sentence = screen.getByTestId("fork-consequence").textContent ?? ""
    expect(sentence).toBe(FORK_CONSEQUENCE)
    expect(sentence).toMatch(/new private copy/i)
    expect(sentence).toMatch(/stays live and unchanged/i)
  })

  it("the sentence is visible WITHOUT opening the menu (it is not menu chrome)", () => {
    renderCard(PUBLISHED)
    expect(screen.getByTestId("fork-consequence")).toBeInTheDocument()
  })

  it("no control on the card carries a hover-only tooltip of that sentence", async () => {
    const { card } = renderCard(PUBLISHED)
    await openOverflow(card)
    expect(screen.getByTestId("published-tweak")).not.toHaveAttribute("title")
    expect(() => screen.getByTitle(FORK_CONSEQUENCE)).toThrow()
  })

  it("POSITIVE CONTROL — getByTitle DOES find a planted tooltip carrying that same text", () => {
    // Without this, the throw above would pass on a broken selector rather than on a card
    // that genuinely paints no tooltip.
    render(
      <button type="button" title={FORK_CONSEQUENCE}>
        planted
      </button>,
    )
    expect(screen.getByTitle(FORK_CONSEQUENCE)).toBeInTheDocument()
  })

  it("a DRAFT row spends no sentence — the surface pays for it once, on the fork", () => {
    renderCard(DRAFT)
    expect(screen.queryByTestId("fork-consequence")).toBeNull()
  })
})

// ── 4b · THE SENTENCE IS STATE-AWARE (192-13 — the U5 blocker) ───────────────────────

/**
 * Phase 192-13, gap-closure round 1. `192-UAT.md` test 11: the operator clicked the fork on a
 * published row and **nothing happened, twice** — a deterministic 409 with no user-visible
 * signal at all. Under the operator's 2026-08-11 decision the verb OPENS THE EXISTING DRAFT on
 * such a row, which makes the shipped sentence's promise of *a new private copy* FALSE there.
 *
 * ⚠ These four cases were driven RED against the UNEDITED card before the prop existed. A and
 * B failed on the sentence text (received: the shipped `FORK_CONSEQUENCE`) — NOT on an unknown
 * prop, because React simply ignores one, which is what makes that RED mean something. C and D
 * were GREEN before the change and are regression pins, not new claims.
 */
describe("192-13 — the consequence sentence is chosen by the row's real state", () => {
  it("a published row the user has ALREADY forked says so, before the click", () => {
    renderCard(PUBLISHED, { hasExistingFork: true })
    expect(screen.getByTestId("fork-consequence").textContent).toBe(FORK_CONSEQUENCE_EXISTING)
  })

  it("the aria-describedby round trip holds on the NEW variant too", async () => {
    // Driven on this variant rather than inherited from the case above: a PASS from another
    // row's evidence is not a driven row, and 192-09's plant 5 proved this exact contract can
    // break while every presence/text check stays green.
    const { card } = renderCard(PUBLISHED, { hasExistingFork: true })
    await openOverflow(card)
    const describedBy = screen.getByTestId("published-tweak").getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    const sentence = document.getElementById(describedBy as string)
    expect(sentence).not.toBeNull()
    expect(sentence?.textContent).toBe(FORK_CONSEQUENCE_EXISTING)
  })

  it("with the prop ABSENT the shipped sentence is byte-identical — the default did not drift", () => {
    // The regression pin. Every ordinary row must read exactly as it shipped; a state-aware
    // sentence that quietly became state-aware for EVERYONE is the same defect in a new coat.
    renderCard(PUBLISHED)
    expect(screen.getByTestId("fork-consequence").textContent).toBe(FORK_CONSEQUENCE)
  })

  it("the new sentence arrives as ONE node of real text, and not as a tooltip", () => {
    renderCard(PUBLISHED, { hasExistingFork: true })
    // Still exactly one sentence on the card — the surface spends it once (D-13), and U5-b
    // (card density) is explicitly out of this round: no atom is added.
    expect(screen.queryAllByTestId("fork-consequence")).toHaveLength(1)
    // D-14: touch has no hover. The positive control for this selector lives in block 4.
    expect(() => screen.getByTitle(FORK_CONSEQUENCE_EXISTING)).toThrow()
  })
})

// ── 5 · THE FORK IS A DIRECT FLIP (D-15) ─────────────────────────────────────────────

describe("D-15 — forking opens no confirm sheet and no dialog", () => {
  it("clicking the fork fires the handler AND opens no dialog", async () => {
    const { card, props } = renderCard(PUBLISHED)
    const user = await openOverflow(card)
    await user.click(screen.getByTestId("published-tweak"))
    // The negative alone would pass on a card whose fork does nothing at all, so the
    // callback is asserted in the same case.
    expect(props.onForkNewVersion).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("POSITIVE CONTROL — the dialog query finds a planted one", () => {
    render(<div role="dialog">planted</div>)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })
})

// ── 6 · THE DRAFT DELETE — RIGHT ENDPOINT, RIGHT GRADE (D-18) ────────────────────────

describe("D-18 — the draft delete arms first, then calls the single-draft endpoint", () => {
  it("one click on Delete ARMS and deletes nothing", async () => {
    const { card } = renderCard(DRAFT)
    const user = await openOverflow(card)
    await user.click(screen.getByTestId("draft-delete"))
    expect(await screen.findByTestId("draft-delete-prompt")).toBeInTheDocument()
    expect(mockDeleteDraft).not.toHaveBeenCalled()
  })

  it("Confirm calls deleteWorkflowDraft with THIS row's id, then re-fetches", async () => {
    const { card, props } = renderCard(DRAFT)
    const user = await openOverflow(card)
    await user.click(screen.getByTestId("draft-delete"))
    await user.click(await screen.findByTestId("draft-delete-confirm"))
    await waitFor(() => expect(mockDeleteDraft).toHaveBeenCalledWith(DRAFT.id))
    // The row leaves the list only on server confirmation — no optimistic vanish.
    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledTimes(1))
  })

  it("Cancel disarms and still deletes nothing", async () => {
    const { card } = renderCard(DRAFT)
    const user = await openOverflow(card)
    await user.click(screen.getByTestId("draft-delete"))
    await user.click(await screen.findByTestId("draft-delete-cancel"))
    await waitFor(() => expect(screen.queryByTestId("draft-delete-prompt")).toBeNull())
    expect(mockDeleteDraft).not.toHaveBeenCalled()
  })

  it("NO draft path ever reaches deleteWorkflowCascade or the preview client", async () => {
    // T-192-23: the cascade resolves a SLUG and destroys every version under it. The risk is
    // entirely the client calling the wrong endpoint, so it is asserted as a call, not read.
    const { card } = renderCard(DRAFT)
    const user = await openOverflow(card)
    await user.click(screen.getByTestId("draft-delete"))
    await user.click(await screen.findByTestId("draft-delete-confirm"))
    await waitFor(() => expect(mockDeleteDraft).toHaveBeenCalled())
    expect(mockCascade).not.toHaveBeenCalled()
    expect(mockPreview).not.toHaveBeenCalled()
  })

  it("the armed prompt fabricates NO count — no preview is fetched, so no number is shown", async () => {
    const { card } = renderCard(DRAFT)
    const user = await openOverflow(card)
    await user.click(screen.getByTestId("draft-delete"))
    const prompt = await screen.findByTestId("draft-delete-prompt")
    expect(prompt.textContent ?? "").not.toMatch(/\d/)
  })

  it("a failed delete is said out loud, and the row does not leave the list", async () => {
    mockDeleteDraft.mockRejectedValueOnce(new Error("boom"))
    const { card, props } = renderCard(DRAFT)
    const user = await openOverflow(card)
    await user.click(screen.getByTestId("draft-delete"))
    await user.click(await screen.findByTestId("draft-delete-confirm"))
    expect(await screen.findByTestId("draft-delete-error")).toBeInTheDocument()
    expect(props.onDeleted).not.toHaveBeenCalled()
  })

  it("the heavier guard is the OTHER grade — a draft's Delete opens no sheet", async () => {
    const { card } = renderCard(DRAFT)
    const user = await openOverflow(card)
    await user.click(screen.getByTestId("draft-delete"))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByTestId("published-delete")).toBeNull()
  })

  it("a STARTER offers no delete at all — it is not yours, and the endpoint would refuse", async () => {
    const { card } = renderCard(STARTER)
    await openOverflow(card)
    expect(screen.queryByTestId("published-delete")).toBeNull()
    expect(screen.queryByTestId("draft-delete")).toBeNull()
  })

  it("a PUBLISHED row keeps the heavy guard's trigger, with the destructive weight", async () => {
    const { card } = renderCard(PUBLISHED)
    await openOverflow(card)
    const item = screen.getByTestId("published-delete")
    expect(item).toBeInTheDocument()
    expect(item.className).toContain("text-destructive")
  })
})

// ── 7 · THE SOUL IS CONSUMED UNCHANGED (LIB-02) ──────────────────────────────────────

describe("LIB-02 — every row renders the shared soul, all five atoms", () => {
  it.each<[Provenance, LibraryRow]>([
    ["published", PUBLISHED],
    ["starter", STARTER],
    ["draft", DRAFT],
  ])("a %s row shows purpose, needs, spine, tier and produces", (_p, row) => {
    const { card } = renderCard(row)
    const soul = within(card).getByTestId("workflow-soul")
    expect(soul).toHaveAttribute("data-scale", "card")
    for (const atom of ["soul-purpose", "soul-needs", "soul-spine", "soul-tier", "soul-output"]) {
      expect(within(soul).getByTestId(atom)).toBeInTheDocument()
    }
    // The hero really carries the authored sentence, not an empty state.
    expect(within(soul).getByTestId("soul-purpose").textContent).toBe(DEF.business_requirement)
  })
})
