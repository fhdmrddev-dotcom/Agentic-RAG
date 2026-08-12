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
// ── Phase 192.1-06 (LIB-05 / D-06 / D-08 / D-09 / D-10 / D-11) — the 14th atom ──────────
// The words and the resolver are IMPORTED, never re-typed: D-14 makes a copy change a
// one-line diff in ONE file, and a test that spells `"Copy of "` inline has silently forked
// the acceptance bar exactly the way the sketch's anti-drift mechanism exists to prevent.
import {
  LINEAGE_COPY_OF,
  LINEAGE_ORIGINAL,
  LINEAGE_STARTER_SUF,
  NO_PROJECT,
  OWN_SHARED,
  OWN_YOURS,
  STATE_DRAFT,
  STATE_RUNNABLE,
  STATE_STARTER,
  oneOfLabel,
} from "./libraryVocabulary"
import { buildIdentityIndex, lineageOf, resolveIdentity, type RowIdentity } from "./rowIdentity"
import { FIXTURE_NOW, INHERENT_ORPHANS, makeLibraryFixture } from "./__fixtures__/libraryScale"

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
  // Phase 192.1 (LIB-05 / D-15). REQUIRED on `LibraryRow`, not optional, and that is the
  // point: the identity line is unconditional (D-06), so `tsc` enumerates every construction
  // site rather than letting one silently default. This builder is the site it found. The
  // card does not render the field yet — Plan 05 does — and `...over` lets a case pass
  // `undefined` to exercise the "the wire did not say" path.
  updatedAt: "2026-06-12T09:30:15.123456+00:00",
  source: { id: `row-${provenance}`, slug: "vendor-risk", name: "Vendor-risk review" } as unknown as LibraryRow["source"],
  ...over,
})

const PUBLISHED = rowOf("published")
const STARTER = rowOf("starter")
const DRAFT = rowOf("draft")

/**
 * A resolved identity, built by hand.
 *
 * ⚠ THE CARD'S CONTRACT IS THE `RowIdentity` VALUE, NOT THE RESOLVER — and the split is the
 * whole of D-12's discipline applied one level up. `rowIdentity.test.ts` already proves the
 * four-state lineage, the D-31 ranker and the `1 of N` scope as arithmetic (72 cases, no DOM);
 * re-driving them through a render would prove them again, expensively and less completely.
 * These cases prove the OTHER half: that whatever the resolver answers is painted in the right
 * place, in the right order, exactly once. Block 9 then closes the loop by feeding the REAL
 * resolver's output to the REAL component at the fixture's 100+ row scale.
 */
const identityOf = (over: Partial<RowIdentity> = {}): RowIdentity => ({
  own: OWN_YOURS,
  segs: [],
  ofN: null,
  when: "changed 2 months ago",
  ...over,
})

/** The separator glyph, spelled ONCE so the helper below and the cases cannot disagree. */
const IDENTITY_SEPARATOR = "·"

/**
 * The identity line's parts, IN DOM ORDER, with the separators removed.
 *
 * The separators are the card's own (the resolver hands over discrete parts), so a test that
 * read `textContent` could not tell a missing separator from a doubled one — and "never a
 * dangling separator when a part is absent" is an assertion about exactly that.
 */
const identityParts = (line: HTMLElement): string[] =>
  Array.from(line.children)
    .map((child) => child.textContent ?? "")
    .filter((text) => text !== IDENTITY_SEPARATOR)

function renderCard(row: LibraryRow, over: Partial<WorkflowCardProps> = {}) {
  const props: WorkflowCardProps = {
    row,
    folderName: null,
    onRun: vi.fn(),
    onOpen: vi.fn(),
    onForkNewVersion: vi.fn(),
    onForkStarter: vi.fn(),
    onDeleted: vi.fn(),
    // Phase 192.1-06 (D-06): REQUIRED, never optional-with-a-default. The identity line is
    // UNCONDITIONAL, so an optional prop defaulting to "no line" would let a call site render
    // a card the phase says cannot exist — `hasExistingFork`'s trick deliberately does not
    // transfer. This builder is the default every case inherits; `...over` replaces it.
    identity: identityOf(),
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

// ── 8 · THE 14TH ATOM — THE IDENTITY LINE (D-06 / D-08 / D-09 / D-10 / D-11) ──────────

/**
 * Phase 192.1-06. One node, one place, on every card.
 *
 * ⚠ PLACEMENT IS ASSERTED BY CHILD ORDER, NEVER BY A CLASS NAME (D-08). A class assertion
 * passes on a node rendered in the wrong column, in the wrong order, or twice — and it fails
 * on a Tailwind tidy-up that changes nothing a reader sees. What D-08 actually says is
 * *"inside the header's `min-w-0` column, immediately after the name/version row and BEFORE
 * the folder chip"*, and that is a statement about indices.
 *
 * ⚠ THE COLUMN IS REACHED THROUGH THE LINE'S OWN `parentElement`, deliberately. Querying it
 * by `.min-w-0` would smuggle the class-name assertion back in through the selector.
 */
describe("D-08 / D-11 — one identity line per card, at DOM position 2", () => {
  it.each<[Provenance, LibraryRow]>([
    ["published", PUBLISHED],
    ["starter", STARTER],
    ["draft", DRAFT],
  ])("a %s row renders EXACTLY ONE row-identity node", (_p, row) => {
    const { card } = renderCard(row)
    expect(within(card).queryAllByTestId("row-identity")).toHaveLength(1)
  })

  it.each<[Provenance, LibraryRow]>([
    ["published", PUBLISHED],
    ["starter", STARTER],
    ["draft", DRAFT],
  ])("on a %s row the line is child index 1 — after the name row, before the folder chip", (_p, row) => {
    const { card } = renderCard(row, { folderName: "Risk & Compliance" })
    // The length check first, so the RED for an absent line is an AssertionError rather than
    // a `getBy*` throw — an uninformative failure is a failure that teaches nothing.
    expect(within(card).queryAllByTestId("row-identity")).toHaveLength(1)
    const line = within(card).getByTestId("row-identity")
    const column = line.parentElement as HTMLElement
    expect(column).not.toBeNull()

    expect(column.children).toHaveLength(3)
    // 0 — the name/version row, which really carries the name (so index 0 is not an accident)
    expect(column.children[0].textContent).toContain(row.name)
    // 1 — D-08's position
    expect(column.children[1]).toBe(line)
    // 2 — the folder chip, still BELOW the line
    expect(column.children[2].textContent).toContain("Risk & Compliance")
  })

  it("with no folder chip the line is STILL child index 1, and is the column's last child", () => {
    // The chip is conditional (`folderName && …`). Without this case, "before the folder chip"
    // would be untested on the majority of the operator's rows — measured in the fixture,
    // most rows carry no project at all.
    const { card } = renderCard(PUBLISHED, { folderName: null })
    const line = within(card).getByTestId("row-identity")
    const column = line.parentElement as HTMLElement
    expect(column.children).toHaveLength(2)
    expect(column.children[1]).toBe(line)
  })
})

describe("D-03 / D-06 — the line's grammar, in order", () => {
  it("a COLLIDING row renders own · segs · 1 of N · changed, in that order", () => {
    const { card } = renderCard(PUBLISHED, {
      identity: identityOf({
        own: OWN_SHARED,
        segs: [LINEAGE_COPY_OF + "Compliance Gap Report" + LINEAGE_STARTER_SUF, STATE_DRAFT],
        ofN: oneOfLabel(43),
        when: "changed 2 months ago",
      }),
    })
    expect(identityParts(within(card).getByTestId("row-identity"))).toEqual([
      OWN_SHARED,
      "Copy of Compliance Gap Report starter",
      STATE_DRAFT,
      "43 share this name",
      "changed 2 months ago",
    ])
  })

  it("a UNIQUE-name non-fork row renders own and changed ONLY — no segment, no 1 of N (D-06 quiet)", () => {
    // The operator's own 2026-08-12 decision at the one edge 160-B and 161-A disagreed about:
    // the LINE is unconditional (161-A's consistent placement), its CONTENT is not (160-B's
    // restraint). A row nothing collides with spends no discriminator.
    const { card } = renderCard(PUBLISHED, {
      identity: identityOf({ own: OWN_SHARED, segs: [], ofN: null, when: "changed 5 months ago" }),
    })
    const line = within(card).getByTestId("row-identity")
    expect(identityParts(line)).toEqual([OWN_SHARED, "changed 5 months ago"])
    expect(line.textContent ?? "").not.toMatch(/\b1 of \d/)
  })

  it("a UNIQUE-name FORK row still names what it came from — identity, not disambiguation", () => {
    const { card } = renderCard(PUBLISHED, {
      identity: identityOf({
        segs: [LINEAGE_COPY_OF + "Access Review Attestation"],
        ofN: null,
        when: "changed just now",
      }),
    })
    expect(identityParts(within(card).getByTestId("row-identity"))).toEqual([
      OWN_YOURS,
      "Copy of Access Review Attestation",
      "changed just now",
    ])
  })

  it("the separator is spent BETWEEN present parts only — never a dangling one", () => {
    // An own word alone. A card that renders `Yours ·` has told the reader something follows
    // and then not said it, which is the same class of defect as an empty state that lies.
    const { card } = renderCard(PUBLISHED, {
      identity: identityOf({ segs: [], ofN: null, when: null }),
    })
    const line = within(card).getByTestId("row-identity")
    expect(identityParts(line)).toEqual([OWN_YOURS])
    expect(line.textContent).toBe(OWN_YOURS)
  })

  it("never more than the two computed segments the resolver may spend (D-04)", () => {
    const { card } = renderCard(PUBLISHED, {
      identity: identityOf({ segs: [NO_PROJECT, STATE_STARTER], ofN: oneOfLabel(43) }),
    })
    const parts = identityParts(within(card).getByTestId("row-identity"))
    // own + 2 segs + `1 of N` + changed. The cap belongs to the resolver; what the CARD owes
    // is that it renders every segment it is handed and invents none of its own.
    expect(parts).toHaveLength(5)
    expect(parts.slice(1, 3)).toEqual([NO_PROJECT, STATE_STARTER])
  })
})

describe("D-18 / SC#3 — recency renders when the wire said, and goes silent when it did not", () => {
  it("a NULL `when` still renders the line, carrying no changed text", () => {
    const { card } = renderCard(PUBLISHED, {
      identity: identityOf({ segs: [LINEAGE_ORIGINAL], ofN: oneOfLabel(2), when: null }),
    })
    const line = within(card).getByTestId("row-identity")
    expect(line).toBeInTheDocument()
    expect(identityParts(line)).toEqual([OWN_YOURS, LINEAGE_ORIGINAL, "2 share this name"])
    expect(line.textContent ?? "").not.toContain("changed")
  })

  it("POSITIVE CONTROL — the same selector DOES find a present recency value", () => {
    // Without this, the absence above passes identically on a card that renders no line at
    // all, and on a `when` slot that is broken for every row rather than for the null one.
    const { card } = renderCard(PUBLISHED, {
      identity: identityOf({ segs: [LINEAGE_ORIGINAL], ofN: oneOfLabel(2), when: "changed yesterday" }),
    })
    const line = within(card).getByTestId("row-identity")
    expect(identityParts(line)).toEqual([OWN_YOURS, LINEAGE_ORIGINAL, "2 share this name", "changed yesterday"])
    expect(line.textContent ?? "").toContain("changed")
  })
})

describe("D-10 — a DRAFT gains lineage for the first time, and gains no sentence", () => {
  it("a draft renders the identity line AND no fork-consequence — the two are independent", () => {
    // THIS IS THE POINT OF D-10. The consequence sentence is gated on `runnable`, so every
    // draft's sentence slot is empty today — and drafts are precisely the rows most likely to
    // be a person's own half-finished forks, i.e. the rows that most need to say what they
    // came from. The line sits OUTSIDE that guard.
    const { card } = renderCard(DRAFT, {
      identity: identityOf({ segs: ["v2 of v1", STATE_DRAFT], ofN: oneOfLabel(43) }),
    })
    expect(within(card).queryAllByTestId("row-identity")).toHaveLength(1)
    expect(identityParts(within(card).getByTestId("row-identity"))).toEqual([
      OWN_YOURS,
      "v2 of v1",
      STATE_DRAFT,
      "43 share this name",
      "changed 2 months ago",
    ])
    expect(screen.queryByTestId("fork-consequence")).toBeNull()
  })

  it("POSITIVE CONTROL — both selectors resolve on a PUBLISHED row", () => {
    // The absence above is about the DRAFT, not about either query: on a runnable row the
    // same two selectors find the same two shapes.
    const { card } = renderCard(PUBLISHED)
    expect(within(card).queryAllByTestId("row-identity")).toHaveLength(1)
    expect(screen.getByTestId("fork-consequence")).toBeInTheDocument()
  })
})

describe("D-09 — Yours / Shared is the ceiling, read from the ONE shipped predicate", () => {
  it.each<[string, string]>([
    ["Yours", OWN_YOURS],
    ["Shared", OWN_SHARED],
  ])("the owner word is rendered verbatim as %s", (_label, word) => {
    const { card } = renderCard(PUBLISHED, { identity: identityOf({ own: word }) })
    expect(identityParts(within(card).getByTestId("row-identity"))[0]).toBe(word)
  })

  it("the two owner words are the ONLY ones the vocabulary offers", () => {
    // Plan 05's fence F7 guards the SOURCE half (no `created_by`, no display name reachable
    // anywhere in the subtree). This is the RENDERED half: the honest ceiling is two words,
    // and they are the two the build contract emitted from the approved mockup.
    expect(new Set([OWN_YOURS, OWN_SHARED])).toEqual(new Set(["Yours", "Shared"]))
  })
})

/**
 * ⚠ THIS BLOCK'S SCOPE IS NARROWER THAN THE PLAN'S WORDING, AND IT IS NARROWER BECAUSE A
 * MEASUREMENT SAID SO RATHER THAN BECAUSE IT WAS CONVENIENT.
 *
 * `192.1-06-PLAN.md`'s behavior list says *"No `title` attribute appears anywhere in the
 * rendered card"*. Driven against the UNEDITED card that is FALSE, and the RED that proved it
 * is quoted in the SUMMARY: `expected … to have a length of +0 but got 3` — on all three
 * provenances, BEFORE one line of this phase's markup existed. All three hits belong to the
 * shared soul this card consumes unchanged: `WorkflowSoul.tsx:99` (`title={tier.description}`
 * on the tier chip) and `PhaseSpine.tsx:77` (`title={name || undefined}`, once per phase glyph
 * — the fixture definition carries two phases, so 1 + 2 = 3).
 *
 * That is not a defect and it is not this phase's to fix: `CLAUDE.md`'s Phase-192 ledger row
 * records both by name as INHERITED and out of scope by D-01, and F1 — the fence that actually
 * binds — sweeps SOURCE modules under `library/`, where the count is genuinely zero. So the
 * rendered assertion is scoped to the card's OWN chrome, the soul subtree is excluded BY ITS
 * SHIPPED TESTID rather than by a class guess, and the exclusion is made non-vacuous below so
 * it can never quietly become a loophole that hides a real one.
 */
describe("D-14 — the card's own chrome paints no hover-only explanation", () => {
  /** The attribute, assembled so this file does not itself answer a raw grep of the rule. */
  const TOOLTIP_SELECTOR = `[${["tit", "le"].join("")}]`

  /** The card minus the soul it consumes unchanged — i.e. the markup this phase owns. */
  const ownChromeTooltips = (card: HTMLElement): Element[] => {
    const soul = within(card).getByTestId("workflow-soul")
    return Array.from(card.querySelectorAll(TOOLTIP_SELECTOR)).filter((node) => !soul.contains(node))
  }

  it.each<[Provenance, LibraryRow]>([
    ["published", PUBLISHED],
    ["starter", STARTER],
    ["draft", DRAFT],
  ])("a %s card's own chrome — the identity line included — carries none", (_p, row) => {
    const { card } = renderCard(row, {
      folderName: "Legal",
      identity: identityOf({ segs: [LINEAGE_ORIGINAL, STATE_RUNNABLE], ofN: oneOfLabel(9) }),
    })
    // TOUCH HAS NO HOVER. A tooltip is a disclosure some readers can never reach, which is
    // why the identity line spends real DOM text on every fact it states.
    expect(ownChromeTooltips(card)).toEqual([])
  })

  it("NON-VACUITY — the exclusion really is carved around three INHERITED nodes, not around zero", () => {
    // Without this, the filter above would keep passing if it silently excluded the whole
    // card, and "the identity line paints no tooltip" would be a claim about a no-op.
    const { card } = renderCard(PUBLISHED)
    const soul = within(card).getByTestId("workflow-soul")
    expect(card.querySelectorAll(TOOLTIP_SELECTOR)).toHaveLength(3)
    expect(soul.querySelectorAll(TOOLTIP_SELECTOR)).toHaveLength(3)
  })

  it("POSITIVE CONTROL — the same selector and the same filter DO find a planted one", () => {
    // Planted on a node of this test's own making, so the control cannot be satisfied by the
    // component under test.
    const { container } = render(
      <div>
        <span title="planted">x</span>
      </div>,
    )
    expect(container.querySelectorAll(TOOLTIP_SELECTOR)).toHaveLength(1)
  })
})

describe("D-11 — every shipped testid survives the 14th atom, verbatim", () => {
  it("a PUBLISHED row still emits all five of its shipped ids", async () => {
    const { card } = renderCard(PUBLISHED)
    expect(card).toHaveAttribute("data-testid", "published-card")
    expect(within(card).getByTestId("published-run")).toBeInTheDocument()
    expect(screen.getByTestId("fork-consequence")).toBeInTheDocument()
    await openOverflow(card)
    expect(screen.getByTestId("published-tweak")).toBeInTheDocument()
    expect(screen.getByTestId("published-delete")).toBeInTheDocument()
  })

  it("a STARTER row still emits its own three", async () => {
    const { card } = renderCard(STARTER)
    expect(card).toHaveAttribute("data-testid", "starter-card")
    expect(within(card).getByTestId("published-run")).toBeInTheDocument()
    await openOverflow(card)
    // The two fork ids stay DISTINCT CONTROLS — D-12's only mechanical evidence.
    expect(screen.getByTestId("use-starter")).toBeInTheDocument()
    expect(screen.queryByTestId("published-tweak")).toBeNull()
  })

  it("a DRAFT row still emits its own three", async () => {
    const { card } = renderCard(DRAFT)
    expect(card).toHaveAttribute("data-testid", "draft-card")
    expect(within(card).getByTestId("draft-open")).toBeInTheDocument()
    await openOverflow(card)
    expect(screen.getByTestId("draft-delete")).toBeInTheDocument()
  })
})

// ── 9 · THE LINE AT THE OPERATOR'S REAL SHAPE (SC#1 / SC#2 / SC#3 — D-30 / D-31) ──────

/**
 * Blocks 1-8 prove the card's contract one row at a time. THIS block proves the thing those
 * cases structurally cannot: that the REAL resolver's output, painted by the REAL component,
 * still obeys the sketch's measured invariants **at 100+ rows carrying 14 duplicated names**.
 *
 * ⚠ THAT IS THE WHOLE REASON PHASE 192.1 EXISTS. Phase 192 tested this surface at 12 rows AND
 * at 107 and shipped a library the operator could not read, because every fixture it used
 * carried DISTINCT NAMES — *"volume was real, shape was not."* A block that re-proved the card
 * at three hand-built rows would repeat that miss exactly.
 *
 * ⚠ AND THE NUMBERS BELOW ARE RE-DERIVED, NEVER PINNED FROM THE SKETCH.
 * `BUILD-CONTRACT.generated.md` reports `cards rendered: 108` and `lines carrying '1 of N': 94`.
 * **Neither is this fixture's number, and the contract itself says so honestly**: the 108 is 107
 * plus the row the 162-B drive really created, and the 94 was measured at those 108 cards. Every
 * figure here is computed from `makeLibraryFixture()` and READ OUT of its own failing diff.
 *
 * ⚠ NOTHING IN THIS BLOCK IS ASYNC, AND THAT IS DELIBERATE (T-4). The identity line is
 * synchronous markup, so there is no `findBy*` on an expected-absent node anywhere here — the
 * trap where `asyncUtilTimeout` (15 s) outlives vitest's per-test budget (5 s) and turns a real
 * RED into an uninformative timeout cannot arise. Every assertion runs against a settled tree.
 */

/**
 * ONE fixture and ONE index for the whole block — built at module scope, exactly as the page
 * builds its index once per `rows` change rather than once per card (D-34).
 */
const SCALE_ROWS = makeLibraryFixture()
const SCALE_INDEX = buildIdentityIndex(SCALE_ROWS)

/** How many rows share each name — the collision fact `1 of N` reports, derived not declared. */
const NAMESAKES = SCALE_ROWS.reduce<Map<string, number>>(
  (acc, row) => acc.set(row.name, (acc.get(row.name) ?? 0) + 1),
  new Map(),
)
const isColliding = (row: LibraryRow): boolean => (NAMESAKES.get(row.name) ?? 1) > 1

/** The resolved line for every row, without a DOM — the expectation the render must match. */
const SCALE_IDENTITIES = new Map(
  SCALE_ROWS.map((row) => [row.id, resolveIdentity(SCALE_INDEX, row, FIXTURE_NOW)] as const),
)
const identityFor = (row: LibraryRow): RowIdentity => SCALE_IDENTITIES.get(row.id) as RowIdentity

/**
 * THE DERIVATION, computed from the fixture rather than transcribed from the contract. Both
 * headline figures are read out of a failing diff the first time and then pinned, which is this
 * repository's habit for any number a later reader might be tempted to "correct".
 */
const DERIVED = {
  /** Every row becomes a card — the line is UNCONDITIONAL (D-06), so this is also the line count. */
  cards: SCALE_ROWS.length,
  /** `1 of N` renders on a colliding name and nowhere else (D-04). */
  linesWithOneOfN: SCALE_ROWS.filter(isColliding).length,
  /** Names carried by more than one row — SC#1's "at least 14 duplicated names". */
  duplicatedNames: [...NAMESAKES.values()].filter((n) => n > 1).length,
}

const noop = () => {}

/** The whole library, rendered through the REAL card with the REAL resolver's output. */
function renderLibrary(rows: readonly LibraryRow[] = SCALE_ROWS) {
  return render(
    <>
      {rows.map((row) => (
        <WorkflowCard
          key={row.id}
          row={row}
          folderName={null}
          onRun={noop}
          onOpen={noop}
          onForkNewVersion={noop}
          onForkStarter={noop}
          identity={identityFor(row)}
          onDeleted={noop}
        />
      ))}
    </>,
  )
}

/** Every rendered identity line, in document order. */
const allLines = (): HTMLElement[] => screen.getAllByTestId("row-identity")

describe("SC#1 — at 100+ rows with 14 duplicated names, a colliding row can be told apart", () => {
  it("the fixture really carries the shape this criterion is judged on", () => {
    // The control. A corpus of 106 distinct names would make every case below pass for the
    // wrong reason — which is precisely how Phase 192 passed and still shipped the defect.
    expect(DERIVED.cards).toBeGreaterThanOrEqual(100)
    expect(DERIVED.duplicatedNames).toBeGreaterThanOrEqual(14)
  })

  it("every colliding row's line carries a discriminator AND its 1 of N", () => {
    renderLibrary()
    expect(allLines()).toHaveLength(DERIVED.cards)

    const withoutDiscriminator: string[] = []
    const withoutCount: string[] = []
    for (const row of SCALE_ROWS.filter(isColliding)) {
      const identity = identityFor(row)
      if (identity.segs.length === 0) withoutDiscriminator.push(row.slug)
      if (identity.ofN === null) withoutCount.push(row.slug)
    }
    // Named rather than counted, so a failure says WHICH row cannot be told apart.
    expect(withoutDiscriminator).toEqual([])
    expect(withoutCount).toEqual([])
  })

  it("the collision counter renders IF AND ONLY IF the name collides, over every rendered line", () => {
    renderLibrary()
    // U4 (driven 2026-08-13): the operator read `1 of 43` as an INDEX, so the counter now reads
    // `43 share this name`. The SHAPE is pinned, not the prose — and it stays anchored with a
    // mandatory `\d+`, so a counter that silently lost its number still fails here.
    const oneOfN = /^\d+ share this name$/
    const lines = allLines()
    let rendered = 0
    SCALE_ROWS.forEach((row, index) => {
      const has = identityParts(lines[index]).some((part) => oneOfN.test(part))
      expect(has).toBe(isColliding(row))
      if (has) rendered += 1
    })
    expect(rendered).toBe(DERIVED.linesWithOneOfN)
  })

  it("never more than 2 computed segments, over EVERY rendered line (D-04)", () => {
    renderLibrary()
    const overspent = SCALE_ROWS.filter((row) => identityFor(row).segs.length > 2)
    expect(overspent.map((row) => row.slug)).toEqual([])
    // …and the DOM agrees: own + at most 2 segs + at most 1 count + at most 1 recency.
    for (const line of allLines()) expect(identityParts(line).length).toBeLessThanOrEqual(5)
  })
})

describe("SC#2 — a row says how it relates to what it came from", () => {
  it("a COPY fork names its parent, and a version fork names the version it came from", () => {
    const kinds = new Set(SCALE_ROWS.map((row) => lineageOf(SCALE_INDEX, row).kind))
    // Non-vacuity: the corpus really exercises all four states, so the claims below are not
    // about a branch no fixture row reaches.
    expect(kinds).toEqual(new Set(["original", "copy", "version", "unknown"]))

    renderLibrary()
    const copy = SCALE_ROWS.find((row) => lineageOf(SCALE_INDEX, row).kind === "copy") as LibraryRow
    const version = SCALE_ROWS.find(
      (row) => lineageOf(SCALE_INDEX, row).kind === "version",
    ) as LibraryRow
    const lineOf = (row: LibraryRow) => identityParts(allLines()[SCALE_ROWS.indexOf(row)])
    expect(lineOf(copy).join(" ")).toContain(LINEAGE_COPY_OF)
    expect(lineOf(version).some((part) => /^v\d+ of v\d+$/.test(part))).toBe(true)
  })

  it("the ORPHAN compliance-gap-report renders NO lineage segment (D-13's silence)", () => {
    // ⚠ THE FAMILY'S OWN ORIGINAL IS AN ORPHAN, and it will read as a bug at UAT unless it is
    // written down: `compliance-gap-report` matches `^(.*)-[a-z0-9]{6}$` because `report` is
    // six legal base-36 characters, and `compliance-gap` does not exist. Labelling it
    // `Original` would fabricate a fact about a row that may be a genuine copy whose parent is
    // deleted or invisible to this reader — 57 resolve · 12 go quiet · 0 lie.
    expect(INHERENT_ORPHANS).toContain("compliance-gap-report")

    const orphan = SCALE_ROWS.find(
      (row) => row.slug === "compliance-gap-report" && row.version === 1,
    ) as LibraryRow
    expect(orphan).toBeDefined()
    expect(lineageOf(SCALE_INDEX, orphan).kind).toBe("unknown")

    renderLibrary()
    const rendered = identityParts(allLines()[SCALE_ROWS.indexOf(orphan)]).join(" ")
    expect(rendered).not.toContain(LINEAGE_COPY_OF)
    expect(rendered).not.toContain(LINEAGE_ORIGINAL)
    expect(rendered).not.toMatch(/v\d+ of v\d+/)
  })

  it("POSITIVE CONTROL — a RESOLVING sibling of that very slug DOES name its parent", () => {
    // Without this, the silence above passes identically on a resolver that never emits a
    // lineage phrase at all, and on a family whose parent lookup is simply broken.
    const child = SCALE_ROWS.find(
      (row) =>
        row.slug.startsWith("compliance-gap-report-") && lineageOf(SCALE_INDEX, row).kind === "copy",
    ) as LibraryRow
    expect(child).toBeDefined()

    renderLibrary()
    expect(identityParts(allLines()[SCALE_ROWS.indexOf(child)])).toContain(
      LINEAGE_COPY_OF + "Compliance Gap Report" + LINEAGE_STARTER_SUF,
    )
  })

  it("no rendered line leaks a slug, an id or a hash-shaped token", () => {
    // D-31's residual is answered by 162-B's rename, never by inventing a machine-readable
    // discriminator — that is the vocabulary drift the 187 node-face ladder forbids.
    renderLibrary()
    const lines = allLines()
    const leaks: string[] = []
    SCALE_ROWS.forEach((row, index) => {
      const text = lines[index].textContent ?? ""
      if (text.includes(row.slug) || text.includes(row.id)) leaks.push(row.slug)
    })
    expect(leaks).toEqual([])
  })
})

describe("SC#3 — a user can tell which workflow changed most recently", () => {
  it("changed <rel> renders on all three provenances, on every row the wire dated", () => {
    renderLibrary()
    const lines = allLines()
    const seen = new Set<Provenance>()
    const missing: string[] = []
    SCALE_ROWS.forEach((row, index) => {
      seen.add(row.provenance)
      if (!identityParts(lines[index]).some((part) => part.startsWith("changed "))) {
        missing.push(row.slug)
      }
    })
    // All three feeds are represented, so "on all three provenances" is a measurement.
    expect(seen).toEqual(new Set<Provenance>(["published", "starter", "draft"]))
    expect(missing).toEqual([])
  })

  it("the recency band VARIES across the library — it is computed, not templated", () => {
    // `seedRecent` puts four rows inside the sub-3-day bands on purpose; without variation
    // `changed <rel>` would be decoration rather than information.
    const bands = new Set(SCALE_ROWS.map((row) => identityFor(row).when))
    expect(bands.size).toBeGreaterThan(5)
  })
})

describe("the shipped surface survives the 14th atom at scale", () => {
  it("one identity line per card, at DOM position 2, on every one of them", () => {
    renderLibrary()
    const cards = screen.getAllByTestId(/^(published|starter|draft)-card$/)
    expect(cards).toHaveLength(DERIVED.cards)
    expect(allLines()).toHaveLength(DERIVED.cards)
    for (const card of cards) {
      const lines = within(card).getAllByTestId("row-identity")
      expect(lines).toHaveLength(1)
      expect((lines[0].parentElement as HTMLElement).children[1]).toBe(lines[0])
    }
  })

  it("all five soul atoms survive, and the sentence is spent exactly once per runnable row", () => {
    renderLibrary()
    expect(screen.getAllByTestId("workflow-soul")).toHaveLength(DERIVED.cards)
    for (const atom of ["soul-purpose", "soul-needs", "soul-spine", "soul-tier", "soul-output"]) {
      expect(screen.getAllByTestId(atom)).toHaveLength(DERIVED.cards)
    }
    const runnable = SCALE_ROWS.filter((row) => row.provenance !== "draft").length
    const sentences = screen.getAllByTestId("fork-consequence")
    expect(sentences).toHaveLength(runnable)
    // …and every one of them is the SHIPPED sentence, imported rather than retyped (D-14).
    for (const node of sentences) expect(node.textContent).toBe(FORK_CONSEQUENCE)
  })

  it("the owner word is one of exactly two, on every line — no owner display name (D-09)", () => {
    renderLibrary()
    expect(new Set(allLines().map((line) => identityParts(line)[0]))).toEqual(
      new Set([OWN_YOURS, OWN_SHARED]),
    )
  })

  it("the derived card count and 1-of-N line count, pinned with their derivation", () => {
    // ⚠ READ OUT OF THIS ASSERTION'S OWN FAILING DIFF, never copied from the sketch. The
    // contract's 108 / 94 were measured on a DIFFERENT corpus (107 rows plus the row the
    // 162-B drive really created) and are recorded in this block's docblock so they cannot be
    // mistaken for these. Re-derive: `makeLibraryFixture().length`, and the number of rows
    // whose name is shared by at least one other row.
    expect(DERIVED.cards).toBe(106)
    expect(DERIVED.linesWithOneOfN).toBe(93)
    expect(DERIVED.duplicatedNames).toBe(14)
  })
})
