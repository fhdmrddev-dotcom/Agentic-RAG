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
// 192.2-09 (WR-04) — the reason line's fixed parts and its words, IMPORTED. The cases below
// compare rendered text against these exports, never against a literal typed in this file.
import {
  CHIP_WORDS,
  MATCH_REASON_PREFIX,
  MATCH_REASON_SEPARATOR,
  MATCH_REASON_WORDS,
} from "./libraryVocabulary"
import type { MatchReason } from "./libraryFilter"
// ── Phase 192.1-06 (LIB-05 / D-06 / D-08 / D-09 / D-10 / D-11) — the 14th atom ──────────
// The words and the resolver are IMPORTED, never re-typed: D-14 makes a copy change a
// one-line diff in ONE file, and a test that spells `"Copy of "` inline has silently forked
// the acceptance bar exactly the way the sketch's anti-drift mechanism exists to prevent.
// ── Phase 193-06 (AUTH-03 / D-13 / D-14 / D-15 / D-21) — the template mark ──────────────
// The word and the predicate are BOTH imported. The word for the same reason as every other
// string here; the predicate because these cases must prove which ARM a fixture reaches, not
// merely that some string appeared — a fixture whose arm is assumed is the 192 CR-01 defect
// ("both failure tests pinned the correct branch without ever entering the wrong one").
import { templateAdmission } from "@/components/workflows/soulData"
import {
  CARD_TEMPLATE_MARK,
  LINEAGE_COPY_OF,
  LINEAGE_ORIGINAL,
  LINEAGE_STARTER_SUF,
  NO_PROJECT,
  OWN_SHARED,
  OWN_YOURS,
  // 192.2-05 (LIB-06 / D-01 line 2 / D-08) — the five run words, imported for the same D-14
  // reason as every other string here: a test that retypes `Never run` has forked the
  // acceptance bar, and these five are the ones that must never be confusable with each other.
  RUN_FAILED,
  RUN_NEVER,
  RUN_STOPPED,
  RUN_UNKNOWN,
  RUN_WORKED,
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

/**
 * Phase 193-06 (AUTH-03 / D-21) — THE THREE ARMS, AS REAL DEFINITION SHAPES.
 *
 * ⚠ THE HOUSE FIXTURE ABOVE ADMITS, AND THAT IS WHY EVERY GRAMMAR ARRAY IN THIS FILE CARRIES
 * THE MARK. `DEF` has an `llm_emit` phase (the deliverable atom needs one) and binds no library
 * template, which under D-21 is precisely `"admits"`. It is asserted below rather than reasoned
 * about, so a later reader never has to wonder whether an expectation gained a segment because
 * the card is right or because a fixture drifted.
 *
 * The two silent shapes are built FROM `DEF` by changing one field each, so the only difference
 * between an arm that marks and an arm that does not is the field the predicate reads.
 */
const NO_EMIT_DEF = { ...DEF, phases: [DEF.phases[0]] }
const EMPTY_PHASES_DEF = { ...DEF, phases: [] }
/** An emit phase that ALREADY binds a library template — D-21's fourth rule, the unreachable-upload arm. */
const BOUND_TEMPLATE_DEF = {
  ...DEF,
  assets: [{ kind: "template", asset_id: "tpl-0001" }],
}

const asDef = (def: unknown) => def as unknown as LibraryRow["def"]

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
  // Phase 192.2 (LIB-06 / D-08). REQUIRED for the same reason `updatedAt` is, and this builder
  // is again the site `tsc` found. ⚠ `undefined` is the *unknown* arm — "the wire did not say"
  // — and NOT the *never run* one, which is `null`. This card does not render the run truth
  // yet (Wave 4 does); `...over` lets a case pass any of the three states.
  lastRunAt: undefined,
  lastRunStatus: undefined,
  source: { id: `row-${provenance}`, slug: "vendor-risk", name: "Vendor-risk review" } as unknown as LibraryRow["source"],
  ...over,
})

const PUBLISHED = rowOf("published")
const STARTER = rowOf("starter")
const DRAFT = rowOf("draft")

/**
 * Phase 193-06 (AUTH-03 / D-15) — the same published row on each of the two SILENT arms.
 *
 * They are separate constants rather than inline `over` objects because D-15's whole claim is
 * that the two are INDISTINGUISHABLE: naming them lets the cases below assert both against ONE
 * shared expected array, so a divergence is a failure rather than an untested difference.
 */
const PUBLISHED_NO_TEMPLATE = rowOf("published", { def: asDef(NO_EMIT_DEF) })
const PUBLISHED_UNKNOWN_DEF = rowOf("published", { def: asDef(EMPTY_PHASES_DEF) })
const PUBLISHED_BOUND_TEMPLATE = rowOf("published", { def: asDef(BOUND_TEMPLATE_DEF) })

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

  it("the sentence names BOTH halves — what you get AND what stays true", async () => {
    // Naming only the first half reproduces the exact surprise LIB-03 exists to end, so a
    // shortened rewrite is a regression even though it would read fine.
    const { card } = renderCard(PUBLISHED)
    await openOverflow(card)
    const sentence = screen.getByTestId("fork-consequence").textContent ?? ""
    expect(sentence).toBe(FORK_CONSEQUENCE)
    expect(sentence).toMatch(/new private copy/i)
    expect(sentence).toMatch(/stays live and unchanged/i)
  })

  it("the sentence is NOT resting chrome — it arrives WITH the verb it describes (192.2-05)", async () => {
    // ⚠ THIS CASE'S CLAIM IS INVERTED, NOT RELAXED, AND THE INVERSION IS THE DECISION.
    // It read *"the sentence is visible WITHOUT opening the menu (it is not menu chrome)"* —
    // true of 192, and reversed by 192.2's D-03: a two-line paragraph on every runnable row is
    // most of what made the resting card nine information rows deep. It is CUT FROM THE
    // RESTING CARD AND RELOCATED, never deleted (T-21) — so both halves are asserted here, and
    // an implementation that simply dropped it fails the second half.
    const { card } = renderCard(PUBLISHED)
    expect(screen.queryByTestId("fork-consequence")).toBeNull()
    await openOverflow(card)
    expect(screen.getByTestId("fork-consequence")).toHaveTextContent(FORK_CONSEQUENCE)
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
  it("a published row the user has ALREADY forked says so, before the click", async () => {
    // ⚠ 192.2-05: *before the click* now means *in the menu, above the verb* — D-03 cut the
    // sentence from the resting card, so it is read where the person is when it matters. The
    // claim is unchanged: the row states the true consequence BEFORE the fork is committed.
    const { card } = renderCard(PUBLISHED, { hasExistingFork: true })
    await openOverflow(card)
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

  it("with the prop ABSENT the shipped sentence is byte-identical — the default did not drift", async () => {
    // The regression pin. Every ordinary row must read exactly as it shipped; a state-aware
    // sentence that quietly became state-aware for EVERYONE is the same defect in a new coat.
    const { card } = renderCard(PUBLISHED)
    await openOverflow(card)
    expect(screen.getByTestId("fork-consequence").textContent).toBe(FORK_CONSEQUENCE)
  })

  it("the new sentence arrives as ONE node of real text, and not as a tooltip", async () => {
    const { card } = renderCard(PUBLISHED, { hasExistingFork: true })
    await openOverflow(card)
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

// ── 7 · THE SOUL HAS LEFT THE RESTING CARD (192.2-05 / D-03) ─────────────────────────

/**
 * ⚠ THIS BLOCK READ *"LIB-02 — every row renders the shared soul, all five atoms"* AND IT IS
 * INVERTED RATHER THAN DELETED. That was true of 192 and D-03 reverses it: rendering the real
 * component measured the shipped card at NINE information rows deep, and the operator picked
 * sketch 179 variant C, which cuts five of them. **The subtraction IS the feature** — a wave
 * that added the gutter and kept these rows delivered the opposite of what was approved (T-18).
 *
 * ⚠ `WorkflowSoul` ITSELF IS UNTOUCHED. It is CONSUMED, not owned, and still renders at
 * `scale="run"` and `scale="pub"` on two surfaces outside this phase. What left is the CARD'S
 * MOUNT of it, which is why the assertion below is about this card and names no component.
 */
describe("D-03 — no row renders the card-scale soul, and none of its five atoms", () => {
  it.each<[Provenance, LibraryRow]>([
    ["published", PUBLISHED],
    ["starter", STARTER],
    ["draft", DRAFT],
  ])("a %s row shows no purpose, needs, spine, tier or produces", (_p, row) => {
    const { card } = renderCard(row)
    expect(within(card).queryByTestId("workflow-soul")).toBeNull()
    for (const atom of ["soul-purpose", "soul-needs", "soul-spine", "soul-tier", "soul-output"]) {
      expect(within(card).queryByTestId(atom)).toBeNull()
    }
    // ⚠ BY TEXT AS WELL AS BY ID. The authored purpose sentence is what the hero carried; a
    // node that survived under a different id would still red here.
    expect(card).not.toHaveTextContent(DEF.business_requirement as string)
    // POSITIVE CONTROL — the card really rendered, so the five nulls are absences rather than
    // a query pointed at nothing. D-01's line 2 is what stands in their place.
    expect(within(card).getByTestId("row-answer")).toBeInTheDocument()
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
 *
 * ⚠ **192.2-05 — THE INDEX MOVED BY ONE, DELIBERATELY, AND THIS IS WHY CHILD ORDER WAS THE
 * RIGHT THING TO ASSERT.** D-01 numbers the card's slots and puts the run truth on LINE 2, so
 * `row-answer` now sits at index 1 and the identity line at index **2**. Sketch 179-C is SILENT
 * on the relative order — it rendered no identity line at all — so what governs is D-01, and
 * burying the answer to *"does this one work?"* beneath a five-part identity line would make
 * LIB-06's whole point the card's fourth line. D-08's sentence is amended with it: the line now
 * sits *immediately after LINE 2 and BEFORE the folder chip*, still inside the `min-w-0` column,
 * still exactly one per card. Every index below is updated in the same wave the source moved,
 * and NOT ONE of these cases was deleted — a move that is visible is the whole return on having
 * asserted the position at all.
 */
describe("D-08 / D-11 — one identity line per card, at DOM position 3", () => {
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
  ])("on a %s row the line is child index 2 — after LINE 2, before the folder chip", (_p, row) => {
    const { card } = renderCard(row, { folderName: "Risk & Compliance" })
    // The length check first, so the RED for an absent line is an AssertionError rather than
    // a `getBy*` throw — an uninformative failure is a failure that teaches nothing.
    expect(within(card).queryAllByTestId("row-identity")).toHaveLength(1)
    const line = within(card).getByTestId("row-identity")
    const column = line.parentElement as HTMLElement
    expect(column).not.toBeNull()

    expect(column.children).toHaveLength(4)
    // 0 — the name/version row, which really carries the name (so index 0 is not an accident)
    expect(column.children[0].textContent).toContain(row.name)
    // 1 — D-01's line 2, asserted as the SAME NODE the answer testid resolves to, so this
    //     index cannot be satisfied by any node that merely happens to sit there.
    expect(column.children[1]).toBe(within(card).getByTestId("row-answer"))
    // 2 — D-08's position, one lower than it was and still above the chip
    expect(column.children[2]).toBe(line)
    // 3 — the folder chip, still BELOW the line
    expect(column.children[3].textContent).toContain("Risk & Compliance")
  })

  it("with no folder chip the line is STILL child index 2, and is the column's last child", () => {
    // The chip is conditional (`folderName && …`). Without this case, "before the folder chip"
    // would be untested on the majority of the operator's rows — measured in the fixture,
    // most rows carry no project at all.
    const { card } = renderCard(PUBLISHED, { folderName: null })
    const line = within(card).getByTestId("row-identity")
    const column = line.parentElement as HTMLElement
    expect(column.children).toHaveLength(3)
    expect(column.children[2]).toBe(line)
  })
})

describe("D-03 / D-06 — the line's grammar, in order", () => {
  /**
   * ⚠ EVERY EXPECTATION IN THIS BLOCK GAINED ONE SEGMENT IN PHASE 193-06, AND IT GAINED IT
   * BECAUSE THE HOUSE FIXTURE GENUINELY ADMITS — never to make a red go away. `DEF` carries an
   * `llm_emit` phase and binds no library template, which is D-21's `"admits"` exactly; the
   * non-vacuity case below asserts that rather than assuming it. The mark's SLOT is asserted by
   * its ARRAY INDEX in these `toEqual`s and never by a class name — a class assertion passes on
   * a node in the wrong column and fails on a Tailwind tidy-up.
   *
   * Read the arrays against `identityParts()`, which keeps the own PILL at index 0 and strips
   * the separators. So the mark sits at index **1** of what this helper returns, which is index
   * **0** of the card's own `identityParts` array — D-14's slot, *after provenance*.
   */
  it("NON-VACUITY — the house fixture really reaches the admitting arm (D-21)", () => {
    // Without this, every array below could have gained a segment for a reason nobody checked.
    expect(templateAdmission(asDef(DEF))).toBe("admits")
    expect(templateAdmission(asDef(NO_EMIT_DEF))).toBe("does-not-admit")
    expect(templateAdmission(asDef(BOUND_TEMPLATE_DEF))).toBe("does-not-admit")
    expect(templateAdmission(asDef(EMPTY_PHASES_DEF))).toBe("unknown")
  })

  it("a COLLIDING row renders own · mark · segs · 1 of N · changed, in that order", () => {
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
      // D-14 — after provenance, before everything else. Recency stays last where 192.1 put it.
      CARD_TEMPLATE_MARK,
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
    expect(identityParts(line)).toEqual([OWN_SHARED, CARD_TEMPLATE_MARK, "changed 5 months ago"])
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
      CARD_TEMPLATE_MARK,
      "Copy of Access Review Attestation",
      "changed just now",
    ])
  })

  it("the separator is spent BETWEEN present parts only — never a dangling one", () => {
    // An own word alone. A card that renders `Yours ·` has told the reader something follows
    // and then not said it, which is the same class of defect as an empty state that lies.
    //
    // ⚠ 193-06 changed the ROW here, not the expectation. This case is about a line with
    // NOTHING after the own word, and the house fixture admits — so keeping `PUBLISHED` and
    // appending the mark to the expectation would have quietly deleted the only case that
    // renders a one-part line. The row now carries a definition with no emit phase, which is a
    // positive `does-not-admit`, and both assertions survive VERBATIM.
    const { card } = renderCard(PUBLISHED_NO_TEMPLATE, {
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
    // own + THE MARK + 2 segs + `1 of N` + changed. The cap belongs to the resolver; what the
    // CARD owes is that it renders every segment it is handed and invents none of its own —
    // and the 193-06 mark is NOT a resolver segment, which is why the length moved by exactly
    // one and the slice moved with it rather than the claim itself changing.
    expect(parts).toHaveLength(6)
    expect(parts[1]).toBe(CARD_TEMPLATE_MARK)
    expect(parts.slice(2, 4)).toEqual([NO_PROJECT, STATE_STARTER])
  })
})

/**
 * ── Phase 193-06 (AUTH-03 — D-13 / D-14 / D-15 / D-21) — THE TEMPLATE MARK ────────────────
 *
 * SC#3 is *a user with a template to fill can find where to supply it*, and the search starts
 * at the row. What this block owes is three things a green suite could otherwise fake:
 *
 *  1. THE THIRD ARM IS GENUINELY ENTERED. `unknown` is 110 of 145 published rows (a `phases: []`
 *     stub nobody authored) — the arm the library ACTUALLY takes. A suite covering only `admits`
 *     and a trivial no-emit case is the 192 CR-01 defect verbatim: *"both failure tests pinned
 *     the correct branch without ever entering the wrong one."*
 *  2. THE TWO SILENT ARMS ARE INDISTINGUISHABLE BY CONSTRUCTION. They are asserted against ONE
 *     shared `SILENT_LINE` value, so a divergence is a FAILURE rather than a difference nobody
 *     wrote a case for. Absence of the mark must never become readable as a positive claim that
 *     no template is needed.
 *  3. D-13 IS PROVED STRUCTURALLY, NOT BY INTENTION. ⚠ And the reason it needs proving is that
 *     the inherited justification is FALSE: D-13 cites 188.2's `@ts-expect-error` two-badge
 *     ceiling, which guards the CANVAS `PhaseNodeCard`. There is NO badge ceiling of any kind
 *     under `library/`, and nothing here claims a typecheck enforces one. What does enforce it
 *     is arithmetic over the rendered DOM: the line's direct child count is exactly
 *     `1 + 2 × parts.length`, so a mark that arrived as a chip, a badge or any other node type
 *     reds — on the count, not on a class name.
 */
describe("AUTH-03 — the template mark, and the silence on either side of it", () => {
  /** The line every NON-admitting row renders, spelled ONCE so the two arms cannot diverge. */
  const SILENT_LINE = [OWN_YOURS, LINEAGE_ORIGINAL, "changed 2 months ago"]
  const SILENT_IDENTITY = identityOf({ segs: [LINEAGE_ORIGINAL], ofN: null })

  it("ADMITS — an emit phase with no bound template renders the mark at the D-14 slot", () => {
    // Non-vacuity first: the arm is measured, not assumed.
    expect(templateAdmission(PUBLISHED.def)).toBe("admits")

    const { card } = renderCard(PUBLISHED, { identity: SILENT_IDENTITY })
    const parts = identityParts(within(card).getByTestId("row-identity"))
    expect(parts).toEqual([OWN_YOURS, CARD_TEMPLATE_MARK, LINEAGE_ORIGINAL, "changed 2 months ago"])
    // D-14 — index 1 of this helper's output is index 0 of the card's own `identityParts`,
    // i.e. immediately AFTER provenance. Asserted by position in the array; never by a class.
    expect(parts[1]).toBe(CARD_TEMPLATE_MARK)
    expect(parts[0]).toBe(OWN_YOURS)
  })

  it("DOES-NOT-ADMIT — a definition with no emit phase renders no mark", () => {
    expect(templateAdmission(PUBLISHED_NO_TEMPLATE.def)).toBe("does-not-admit")
    const { card } = renderCard(PUBLISHED_NO_TEMPLATE, { identity: SILENT_IDENTITY })
    expect(identityParts(within(card).getByTestId("row-identity"))).toEqual(SILENT_LINE)
  })

  it("DOES-NOT-ADMIT — a row that already BINDS a library template renders no mark (D-21)", () => {
    // The measured half of D-21: on these rows `_exec_llm_emit` resolves the bound asset first
    // and the run-time upload is unreachable code, so the mark would be simply FALSE. 16 of the
    // 17 emit-phase published rows are this shape.
    expect(templateAdmission(PUBLISHED_BOUND_TEMPLATE.def)).toBe("does-not-admit")
    const { card } = renderCard(PUBLISHED_BOUND_TEMPLATE, { identity: SILENT_IDENTITY })
    expect(identityParts(within(card).getByTestId("row-identity"))).toEqual(SILENT_LINE)
  })

  it("UNKNOWN — `phases: []`, the shape 110 of 145 published rows carry, renders no mark", () => {
    expect(templateAdmission(PUBLISHED_UNKNOWN_DEF.def)).toBe("unknown")
    const { card } = renderCard(PUBLISHED_UNKNOWN_DEF, { identity: SILENT_IDENTITY })
    // ⚠ THE SAME `SILENT_LINE` VALUE AS THE TWO CASES ABOVE, ON PURPOSE. D-15 makes *does not*
    // and *we do not know* indistinguishable on the card; asserting them against one shared
    // expectation is what makes that a mechanical property instead of a coincidence.
    expect(identityParts(within(card).getByTestId("row-identity"))).toEqual(SILENT_LINE)
  })

  it("the three silent arms agree with each other, node for node", () => {
    // The pairwise statement of the same claim, so a future edit that changes ONE arm's
    // rendering reds even if it changes the shared constant to match itself.
    const rows = [PUBLISHED_NO_TEMPLATE, PUBLISHED_BOUND_TEMPLATE, PUBLISHED_UNKNOWN_DEF]
    const rendered = rows.map((row) => {
      const { card, unmount } = renderCard(row, { identity: SILENT_IDENTITY })
      const parts = identityParts(within(card).getByTestId("row-identity"))
      unmount()
      return parts
    })
    expect(rendered[1]).toEqual(rendered[0])
    expect(rendered[2]).toEqual(rendered[0])
    // …and the corpus really contains both silent verdicts, so the agreement is not vacuous.
    expect(new Set(rows.map((row) => templateAdmission(row.def)))).toEqual(
      new Set(["does-not-admit", "unknown"]),
    )
  })

  it("D-13 — the mark arrives as a PART, not as a new node type", () => {
    // The structural proof. `row-identity`'s direct children are the own PILL plus, per composed
    // part, a separator span and a text span — so `1 + 2 × segments` holds if and only if the
    // mark joined the existing composition. A chip, a badge or an icon wrapper breaks it.
    //
    // ⚠ THE `− 1` IS LOAD-BEARING AND WAS FOUND BY A RED, not reasoned out: `identityParts()`
    // reads the line's CHILDREN, so its first entry is the own pill itself. The card's own
    // `identityParts` array is therefore this one MINUS that first entry. The plan's wording
    // (`1 + 2 × parts.length`) counts the pill twice; corrected here on measurement — observed
    // `expected … to have a length of 11 but got 9` before the fix.
    const { card } = renderCard(PUBLISHED, {
      identity: identityOf({ segs: [LINEAGE_ORIGINAL], ofN: oneOfLabel(43) }),
    })
    const line = within(card).getByTestId("row-identity")
    const parts = identityParts(line)
    expect(parts).toContain(CARD_TEMPLATE_MARK)
    const segments = parts.length - 1
    expect(line.children).toHaveLength(1 + 2 * segments)
  })

  it("POSITIVE CONTROL — the child-count arithmetic really reds on an extra node", () => {
    // Without this, the case above passes on a helper that miscounts and on a line that renders
    // nothing at all. A node this file plants itself breaks the identity by exactly one, so the
    // control cannot be satisfied by the component under test.
    const planted = document.createElement("div")
    planted.innerHTML =
      `<span>${OWN_YOURS}</span>` +
      `<span aria-hidden="true">·</span><span>${CARD_TEMPLATE_MARK}</span>` +
      `<span class="chip">extra</span>`
    const parts = identityParts(planted).filter((text) => text !== "extra")
    // Legal shape without the plant: 1 pill + 1 separator + 1 text = 3. With it: 4.
    expect(1 + 2 * (parts.length - 1)).toBe(3)
    expect(planted.children).toHaveLength(4)
    expect(planted.children).not.toHaveLength(1 + 2 * (parts.length - 1))
  })

  it("the mark does not disturb the provenance node's DOM position (D-08)", () => {
    // 192.1 asserts the identity line's position BY CHILD ORDER, and the point of asserting by
    // child order is that a move is VISIBLE — 192.2-05's D-01 line 2 moved it from index 1 to
    // index 2, and this case moved with it in the same wave. What is still asserted, and is
    // what this case is actually about, is that the AUTH-03 mark changes NOTHING about it.
    // Driven on an ADMITTING row, because the shipped `it.each` above would still pass on a
    // card that rendered the mark outside the line entirely.
    expect(templateAdmission(PUBLISHED.def)).toBe("admits")
    const { card } = renderCard(PUBLISHED, { folderName: "Risk & Compliance" })
    // Length first, so an absent line reds as an AssertionError rather than a `getBy*` throw.
    expect(within(card).queryAllByTestId("row-identity")).toHaveLength(1)
    const line = within(card).getByTestId("row-identity")
    const column = line.parentElement as HTMLElement
    expect(column.children).toHaveLength(4)
    expect(column.children[0].textContent).toContain(PUBLISHED.name)
    expect(column.children[1]).toBe(within(card).getByTestId("row-answer"))
    expect(column.children[2]).toBe(line)
    expect(column.children[3].textContent).toContain("Risk & Compliance")
    // …and the mark really is inside the line rather than beside it.
    expect(identityParts(line)).toContain(CARD_TEMPLATE_MARK)
  })

  it("the mark is spelled in ONE place — this file imports it and never retypes it", () => {
    // The same D-14 one-home rule every other string in this suite follows. If this ever fails,
    // the copy has forked and a change in `libraryVocabulary.ts` no longer reaches the card.
    expect(CARD_TEMPLATE_MARK).toBe("needs a template")
  })
})

describe("D-18 / SC#3 — recency renders when the wire said, and goes silent when it did not", () => {
  it("a NULL `when` still renders the line, carrying no changed text", () => {
    const { card } = renderCard(PUBLISHED, {
      identity: identityOf({ segs: [LINEAGE_ORIGINAL], ofN: oneOfLabel(2), when: null }),
    })
    const line = within(card).getByTestId("row-identity")
    expect(line).toBeInTheDocument()
    expect(identityParts(line)).toEqual([
      OWN_YOURS,
      CARD_TEMPLATE_MARK,
      LINEAGE_ORIGINAL,
      "2 share this name",
    ])
    expect(line.textContent ?? "").not.toContain("changed")
  })

  it("POSITIVE CONTROL — the same selector DOES find a present recency value", () => {
    // Without this, the absence above passes identically on a card that renders no line at
    // all, and on a `when` slot that is broken for every row rather than for the null one.
    const { card } = renderCard(PUBLISHED, {
      identity: identityOf({ segs: [LINEAGE_ORIGINAL], ofN: oneOfLabel(2), when: "changed yesterday" }),
    })
    const line = within(card).getByTestId("row-identity")
    expect(identityParts(line)).toEqual([
      OWN_YOURS,
      CARD_TEMPLATE_MARK,
      LINEAGE_ORIGINAL,
      "2 share this name",
      "changed yesterday",
    ])
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
      // A DRAFT is marked on exactly the same rule as a published row — the predicate reads the
      // definition, never the provenance (D-15 has no per-provenance arm).
      CARD_TEMPLATE_MARK,
      "v2 of v1",
      STATE_DRAFT,
      "43 share this name",
      "changed 2 months ago",
    ])
    expect(screen.queryByTestId("fork-consequence")).toBeNull()
  })

  it("POSITIVE CONTROL — both selectors resolve on a PUBLISHED row", async () => {
    // The absence above is about the DRAFT, not about either query: on a runnable row the
    // same two selectors find the same two shapes. ⚠ 192.2-05 — the sentence's shape is now
    // *in the menu*, so the control opens it; a control that stopped looking where the thing
    // lives would stop controlling for anything.
    const { card } = renderCard(PUBLISHED)
    expect(within(card).queryAllByTestId("row-identity")).toHaveLength(1)
    await openOverflow(card)
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

  /**
   * The card's own chrome — which, since 192.2-05, is the WHOLE card.
   *
   * ⚠ THE EXCLUSION IS DISSOLVED, NOT WIDENED. It read *"the card minus the soul it consumes
   * unchanged"* and filtered out three tooltip-bearing nodes the soul inherited from elsewhere.
   * D-03 cut the card's soul mount, so there is nothing left to carve around and the honest
   * shape is no filter at all — which makes this fence STRICTER than it was, never looser.
   */
  const ownChromeTooltips = (card: HTMLElement): Element[] =>
    Array.from(card.querySelectorAll(TOOLTIP_SELECTOR))

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

  it("NON-VACUITY — the three INHERITED tooltips left with the soul, and nothing replaced them", () => {
    // ⚠ THIS CASE PINNED THE SIZE OF THE EXCLUSION (`3` inherited nodes, all inside the soul),
    // and 192.2-05 removed the thing being excluded. It is re-pointed rather than deleted,
    // because what it guards is unchanged: that the block above is a claim about a REAL card
    // and not about a filter that quietly swallowed everything.
    const { card } = renderCard(PUBLISHED)
    // The soul — and with it the only three tooltip-bearing nodes on this card — is gone.
    expect(within(card).queryByTestId("workflow-soul")).toBeNull()
    expect(card.querySelectorAll(TOOLTIP_SELECTOR)).toHaveLength(0)
    // …and the card genuinely rendered, so the zero above is an absence rather than an
    // empty query. Both of D-01's net-new nodes are here.
    expect(within(card).getByTestId("row-answer")).toBeInTheDocument()
    expect(within(card).getByTestId("run-gutter")).toBeInTheDocument()
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
    await openOverflow(card)
    // ⚠ 192.2-05 — the id SURVIVES, which is what this block is about; what changed is where
    // it resolves. D-03 moved the sentence into the menu, so it is read after the open.
    expect(screen.getByTestId("fork-consequence")).toBeInTheDocument()
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
          // 192.2-05 (P-1) — the ONE hoisted instant, exactly as the page hands it down. A
          // fixed one here also means these cases need no clock mock.
          now={FIXTURE_NOW}
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
    //
    // ⚠ 193-06 raised this cap BY ONE, PER ROW, AND ONLY ON THE ROWS THAT EARN IT — a blanket
    // `<= 6` would have weakened the fence for every row in the corpus, including the ones that
    // render no mark at all. The allowance is computed from the same predicate the card calls,
    // so a mark on a row that does not admit still reds here.
    const lines = allLines()
    // ⚠ 193 REVIEW IN-03 — PIN THE PAIRING BEFORE TRUSTING THE INDEX. The per-row cap below is
    // only meaningful if `lines[index]` really is `SCALE_ROWS[index]`'s line. That holds because
    // `renderLibrary` maps in order, but nothing asserted it — and a mis-pairing here would be
    // SILENTLY WRONG (a `does-not-admit` row scored against an `admits` row's cap of 6) rather
    // than throwing, which is the one shape this file's other assertions do not have.
    expect(lines).toHaveLength(SCALE_ROWS.length)
    // …and a non-vacuity guard, so the raise from 5 to 6 is not a no-op on a corpus where
    // nothing admits: if no row admits, every cap is 5 and the `admits` branch never runs.
    expect(SCALE_ROWS.some((r) => templateAdmission(r.def) === "admits")).toBe(true)
    SCALE_ROWS.forEach((row, index) => {
      const cap = templateAdmission(row.def) === "admits" ? 6 : 5
      expect(identityParts(lines[index]).length).toBeLessThanOrEqual(cap)
    })
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
  it("one identity line per card, at DOM position 3, on every one of them", () => {
    renderLibrary()
    const cards = screen.getAllByTestId(/^(published|starter|draft)-card$/)
    expect(cards).toHaveLength(DERIVED.cards)
    expect(allLines()).toHaveLength(DERIVED.cards)
    for (const card of cards) {
      const lines = within(card).getAllByTestId("row-identity")
      expect(lines).toHaveLength(1)
      // ⚠ index 2, not 1 — D-01's line 2 takes position 2 on every one of the 106 rows, not
      // only on the four the unit cases drive. See the block-level ⚠ at D-08 / D-11.
      expect((lines[0].parentElement as HTMLElement).children[2]).toBe(lines[0])
    }
  })

  it("D-03's six atoms are gone from all 106 rows, and D-01's two are on all of them", () => {
    // ⚠ INVERTED FROM *"all five soul atoms survive, and the sentence is spent exactly once per
    // runnable row"*. **THE SUBTRACTION IS THE FEATURE (D-03 / T-18)** — and asserting it AT
    // SCALE is what makes it a property of the card rather than of four fixture rows. A wave
    // that cut the atoms on the unit fixtures and left them on the real page would pass every
    // case above this one.
    renderLibrary()
    expect(screen.queryAllByTestId("workflow-soul")).toHaveLength(0)
    for (const atom of ["soul-purpose", "soul-needs", "soul-spine", "soul-tier", "soul-output"]) {
      expect(screen.queryAllByTestId(atom)).toHaveLength(0)
    }
    // The sixth left the RESTING card only — no row shows it until its menu is opened, which
    // the unit block above drives on a single card.
    expect(screen.queryAllByTestId("fork-consequence")).toHaveLength(0)
    // …and the two D-01 added are on EVERY row, drafts included: the gutter and line 2.
    expect(screen.getAllByTestId("run-gutter")).toHaveLength(DERIVED.cards)
    expect(screen.getAllByTestId("row-answer")).toHaveLength(DERIVED.cards)
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

// ══════════════════════════════════════════════════════════════════════════════════════
// 192.2-05 Task 4 (LIB-06 / D-01 / D-08 — threats T-19, T-20, T-22) — DOES THIS ONE WORK?
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Everything above proves the card is QUIETER. This block proves it now ANSWERS SOMETHING —
// at the shape the operator's real library actually has, which is the whole reason LIB-06
// exists rather than LIB-05 being extended.
//
// ⚠ THE MEASURED WORST CASE IS THE FIXTURE, NOT A CONVENIENT ONE. CONTEXT `<measurements>`:
// **43 rows named `Compliance Gap Report`, across 41 DISTINCT slugs** — 41 separate workflows,
// not 41 versions, so collapsing versions does not help (117 → 96). D-04 settles that the
// identity line already tells them APART; LIB-06 is the different question — *which one is
// worth running* — and three rows that differ ONLY by their last run is exactly that question
// with everything else held constant.
//
// ⚠ EVERY ASSERTION BELOW IS ON VISIBLE TEXT (D-27). Rows are reached through the card's
// shipped root testid and read by what they SAY; nothing here uses `getElementById`, which is
// the rule Phase 192's own re-drive broke — the reason its UAT proved the code and not the task.

/** The five arms as ROWS: same name, same version, same everything but the run. */
const runRowOf = (
  id: string,
  lastRunStatus: string | null | undefined,
  lastRunAt: string | null | undefined,
): LibraryRow =>
  rowOf("published", {
    id,
    slug: `compliance-gap-${id}`,
    name: "Compliance Gap Report",
    lastRunStatus,
    lastRunAt,
    source: {
      id,
      slug: `compliance-gap-${id}`,
      name: "Compliance Gap Report",
    } as unknown as LibraryRow["source"],
  })

const DAY_MS = 86_400_000
const iso = (msAgo: number) => new Date(FIXTURE_NOW - msAgo).toISOString()

/** The three rows the operator would be triaging: one worked, one failed, one never ran. */
const WORKED = runRowOf("gap-worked", "completed", iso(2 * DAY_MS))
const FAILED = runRowOf("gap-failed", "failed", iso(40 * DAY_MS))
const NEVER = runRowOf("gap-never", null, null)

/** Line 2's text for one rendered card — the SLOT, read as a person reads it. */
const answerText = (card: HTMLElement): string =>
  within(card).getByTestId("row-answer").textContent ?? ""

/**
 * Render an ARBITRARY set of rows as one shelf.
 *
 * ⚠ NOT `renderLibrary`, and the reason was measured rather than foreseen: that helper resolves
 * each card's identity through a Map built over `SCALE_ROWS` alone, so a row this block
 * constructs comes back `undefined` and the card throws on `identity.segs`. Read out of this
 * block's own RED. The index here is built over the rows ACTUALLY rendered, by the REAL
 * `buildIdentityIndex` / `resolveIdentity` — a hand-built identity would pin what this file
 * believes the resolver says instead of what the card is really handed.
 */
function renderRows(rows: readonly LibraryRow[]) {
  const index = buildIdentityIndex(rows)
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
          identity={resolveIdentity(index, row, FIXTURE_NOW)}
          now={FIXTURE_NOW}
          onDeleted={noop}
        />
      ))}
    </>,
  )
}

describe("LIB-06 — three same-named rows are told apart by their run, in words alone", () => {
  it("the corpus really is the hard case: one name, three slugs, three different runs", () => {
    // The control. Three DISTINCT names would make every case below pass for the wrong reason.
    expect(new Set([WORKED.name, FAILED.name, NEVER.name]).size).toBe(1)
    expect(new Set([WORKED.slug, FAILED.slug, NEVER.slug]).size).toBe(3)
    expect([WORKED.version, FAILED.version, NEVER.version]).toEqual([3, 3, 3])
    // …and they really do reach three different arms of `RunFact`, rather than three spellings
    // of one. `undefined` / `null` / a terminal status are three inputs, not one.
    expect(WORKED.lastRunStatus).toBe("completed")
    expect(FAILED.lastRunStatus).toBe("failed")
    expect(NEVER.lastRunStatus).toBeNull()
  })

  it("SC — the three cards are MUTUALLY DISTINGUISHABLE by their visible text", () => {
    renderRows([WORKED, FAILED, NEVER])
    const cards = screen.getAllByTestId("published-card")
    expect(cards).toHaveLength(3)

    const said = cards.map(answerText)
    // The load-bearing assertion of this whole plan: three rows carrying ONE name say three
    // different things. A card that rendered the same sentence three times would pass every
    // presence check in this file and fail here.
    expect(new Set(said).size).toBe(3)

    expect(said[0]).toContain(RUN_WORKED)
    expect(said[1]).toContain(RUN_FAILED)
    expect(said[2]).toContain(RUN_NEVER)
    // …and each one still says its state too, so line 2 is never half-empty.
    for (const text of said) expect(text).toContain(STATE_RUNNABLE)
  })

  it("T-20 — the WORD carries it, not the colour: strip every class and they still differ", () => {
    // The standing project rule is *colour is never the only carrier*. Asserting the class
    // would satisfy a card that painted three bars and said one sentence, which is the defect.
    renderRows([WORKED, FAILED, NEVER])
    const cards = screen.getAllByTestId("published-card")
    for (const card of cards) {
      for (const node of Array.from(card.querySelectorAll("*"))) node.removeAttribute("class")
    }
    expect(new Set(cards.map(answerText)).size).toBe(3)
  })

  it("the gutter tracks the sentence — one derivation, never two switches", () => {
    renderRows([WORKED, FAILED, NEVER])
    const cards = screen.getAllByTestId("published-card")
    const arms = cards.map((card) =>
      within(card).getByTestId("run-gutter").getAttribute("data-run"),
    )
    expect(arms).toEqual(["worked", "failed", "never"])
    // The gutter is decoration over the sentence: it is hidden from assistive tech precisely
    // BECAUSE the sentence already says everything it encodes.
    for (const card of cards) {
      expect(within(card).getByTestId("run-gutter")).toHaveAttribute("aria-hidden", "true")
    }
  })

  it("T-19 — the NAME still leads: it is the first text the card renders (D-02)", () => {
    // Sketches 177 and 178 argued the name cannot be the differentiator; the operator chose C,
    // which KEPT it as the lead and moved only the ENCODING. A card that demoted the name to
    // line two has rebuilt variant B, which was not chosen — and would pass every case above.
    renderRows([WORKED])
    const card = screen.getByTestId("published-card")
    const text = card.textContent ?? ""
    expect(text.indexOf("Compliance Gap Report")).toBe(0)
    expect(text.indexOf("Compliance Gap Report")).toBeLessThan(text.indexOf(RUN_WORKED))
  })
})

describe("D-08 — the three arms on the card, and `unknown` is not `never` (T-22)", () => {
  it("a NEVER-RUN DRAFT says so — the most common row on a shelf that is 69% drafts", () => {
    // CONTEXT `<measurements>`: 81 of 117 rows are drafts, and a draft has by definition never
    // been run (a draft cannot be Run at all — the page's own contract). This is the sentence
    // the majority of the operator's library will carry.
    const draft = rowOf("draft", { id: "d-never", lastRunStatus: null, lastRunAt: null })
    const { card } = renderCard(draft, { now: FIXTURE_NOW })
    expect(answerText(card)).toContain(RUN_NEVER)
    expect(answerText(card)).toContain(STATE_DRAFT)
    // ⚠ NOT BLANK AND NOT A TICK — D-08's words. An absence rendered as nothing reads as fine.
    expect(answerText(card)).not.toBe("")
    expect(answerText(card)).not.toContain(RUN_WORKED)
    expect(within(card).getByTestId("run-gutter")).toHaveAttribute("data-run", "never")
  })

  it("an UNKNOWN-ARM row says `Not recorded` — never `Never run`, and never a time", () => {
    // ⚠ THE STALE-DEPLOY ROW: a frontend ahead of its backend receives rows with NO run keys.
    // Claiming *"never run"* about a workflow that has run a hundred times is the product
    // asserting something false, which is worse than admitting a gap.
    const row = runRowOf("gap-unknown", undefined, undefined)
    const { card } = renderCard(row, { now: FIXTURE_NOW })
    expect(answerText(card)).toContain(RUN_UNKNOWN)
    expect(answerText(card)).not.toContain(RUN_NEVER)
    expect(answerText(card)).not.toContain("ago")
    expect(within(card).getByTestId("run-gutter")).toHaveAttribute("data-run", "unknown")
  })

  it("T-22 — `unknown` and `never` render DIFFERENT sentences and different gutters", () => {
    // The pair, side by side in ONE render, because "they differ" is a claim about two rows
    // and a suite that rendered them separately could pass on a card that said one thing.
    renderRows([runRowOf("u", undefined, undefined), NEVER])
    const [unknownCard, neverCard] = screen.getAllByTestId("published-card")
    expect(answerText(unknownCard)).not.toBe(answerText(neverCard))
    expect(within(unknownCard).getByTestId("run-gutter").getAttribute("data-run")).not.toBe(
      within(neverCard).getByTestId("run-gutter").getAttribute("data-run"),
    )
  })

  it("a STOPPED run is neither success nor failure, and says so in its own word", () => {
    const row = runRowOf("gap-stopped", "cancelled", iso(1 * DAY_MS))
    const { card } = renderCard(row, { now: FIXTURE_NOW })
    expect(answerText(card)).toContain(RUN_STOPPED)
    expect(answerText(card)).not.toContain(RUN_WORKED)
    expect(answerText(card)).not.toContain(RUN_FAILED)
  })

  it("an UNRECOGNISED status is never read as success — the default is honest, not optimistic", () => {
    // `succeeded` is a plausible spelling this build does not map. It must land on `unknown`.
    const row = runRowOf("gap-odd", "succeeded", iso(1 * DAY_MS))
    const { card } = renderCard(row, { now: FIXTURE_NOW })
    expect(answerText(card)).toContain(RUN_UNKNOWN)
    expect(answerText(card)).not.toContain(RUN_WORKED)
    expect(within(card).getByTestId("run-gutter")).toHaveAttribute("data-run", "unknown")
  })
})

describe("WR-01 — a row with NO NAME still answers the question", () => {
  it("the nameless row is carried by line 2 alone, and says two real things", () => {
    // WR-01 was a shipped bug: an empty name blanked the library title. The card is quieter
    // now, so a nameless row has LESS to fall back on — which makes line 2's totality the
    // thing that keeps it readable rather than a nicety.
    const nameless = rowOf("published", {
      id: "p-nameless",
      name: "",
      lastRunStatus: "completed",
      lastRunAt: iso(2 * DAY_MS),
    })
    const { card } = renderCard(nameless, { now: FIXTURE_NOW })
    expect(answerText(card)).toContain(RUN_WORKED)
    expect(answerText(card)).toContain(STATE_RUNNABLE)
    // Still identifiable, still actionable: the version defers to the right of the empty lead,
    // and the row keeps its one verb.
    expect(within(card).getByText("v3")).toBeInTheDocument()
    expect(within(card).getByTestId("published-run")).toBeInTheDocument()
  })

  it("an empty name renders NO placeholder — the card does not invent a title", () => {
    const nameless = rowOf("published", { id: "p-nameless-2", name: "" })
    const { card } = renderCard(nameless, { now: FIXTURE_NOW })
    // The house rule for absence across this subtree: render nothing, never a stand-in. A
    // fabricated `Untitled` is a value that compares like a presence.
    expect(card).not.toHaveTextContent(/untitled/i)
    expect(card).not.toHaveTextContent(/unnamed/i)
  })
})

describe("D-06 — no emoji and no system vocabulary reach the user, at scale", () => {
  it("not one of the 106 rendered cards carries an emoji", () => {
    // The card's own emoji were four; the sweep is over the RENDERED DOM rather than the
    // source, so a glyph arriving from any consumed component would red here too.
    renderLibrary()
    const cards = screen.getAllByTestId(/^(published|starter|draft)-card$/)
    expect(cards).toHaveLength(DERIVED.cards)
    for (const card of cards) {
      expect(card.textContent ?? "").not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
    }
  })

  it("POSITIVE CONTROL — the same sweep DOES catch a planted emoji", () => {
    // Without this, the 106 clean cards above would pass on a broken regular expression.
    const { container } = render(<div>{"\u{1F4C4} planted"}</div>)
    expect(container.textContent ?? "").toMatch(/[\u{1F300}-\u{1FAFF}]/u)
  })

  it("the three business words are what the shelf says — and no lifecycle token appears", () => {
    renderLibrary()
    const said = screen
      .getAllByTestId("row-answer")
      .map((node) => node.textContent ?? "")
      .join(" ")
    // Every rendered row's state is one of the three shipped business words…
    for (const word of [STATE_RUNNABLE, STATE_DRAFT, STATE_STARTER]) {
      expect(said).toContain(word)
    }
    // …and the system's own spellings reach nobody. `Starter` alone is a substring of
    // `Shared starter`, so it is deliberately NOT swept here — the two lifecycle tokens
    // D-06 names by name are.
    expect(said).not.toMatch(/\bpublished\b/)
    expect(said).not.toMatch(/\bdraft\b/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// Phase 192.2-09 (LIB-06 — gap-closure round 1, WR-04) — THE MATCH-REASON LINE
// ══════════════════════════════════════════════════════════════════════════════════════
//
// The card can now explain why a FILTERED row is in the list. The half of that which
// actually needed proving is the other one: that it says nothing at all when nothing was
// asked. D-03's subtraction is this phase's whole thesis, and a line that could appear at
// rest would be a back door for the six atoms it removed (T-192.2-39).

describe("192.2-09 (WR-04) — the reason line CANNOT appear on a resting card", () => {
  it.each<[Provenance, LibraryRow]>([
    ["published", PUBLISHED],
    ["starter", STARTER],
    ["draft", DRAFT],
  ])("on a %s row with the prop OMITTED there is no reason node at all", (_p, row) => {
    const { card } = renderCard(row)
    // `queryBy…` returning null, never a truthiness check: a truthiness check passes on an
    // empty node that IS in the DOM, which is precisely the failure this asserts against.
    expect(within(card).queryByTestId("row-match-reason")).toBeNull()
    expect(within(card).queryAllByTestId("row-match-reason")).toHaveLength(0)
  })

  it("an EMPTY ARRAY renders nothing either — not an empty node, not a wrapper", () => {
    const { card } = renderCard(PUBLISHED, { matchReasons: [] })
    expect(within(card).queryByTestId("row-match-reason")).toBeNull()
  })

  it("the resting card's column child count is UNCHANGED by this prop", () => {
    // The mechanical form of "byte-identical at rest". `WorkflowCard.baseline.test.tsx`
    // makes the same claim by visible text and must come through this wave UNEDITED; this
    // makes it by DOM shape, in the suite that owns child-order assertions.
    const { card } = renderCard(PUBLISHED, { folderName: "Risk & Compliance" })
    const column = within(card).getByTestId("row-identity").parentElement as HTMLElement
    expect(column.children).toHaveLength(4)
  })
})

describe("192.2-09 (WR-04) — with reasons, it says exactly what put the row here", () => {
  /** The line's parts in DOM order, separators dropped — the `identityParts` idiom. */
  const reasonParts = (card: HTMLElement): string[] =>
    Array.from(within(card).getByTestId("row-match-reason").children)
      .map((child) => child.textContent ?? "")
      .filter((text) => text !== MATCH_REASON_SEPARATOR)

  it.each<[MatchReason]>([["makes-a-file"], ["strict"], ["purpose"]])(
    "a single %s reason renders the prefix and that one word",
    (reason) => {
      const { card } = renderCard(PUBLISHED, { matchReasons: [reason] })
      // Asserted against the EXPORTS, so a literal typed into the card would red here.
      expect(reasonParts(card)).toEqual([MATCH_REASON_PREFIX, MATCH_REASON_WORDS[reason]])
    },
  )

  it("two reasons render ONE prefix, both words, and ONE separator between them", () => {
    const { card } = renderCard(PUBLISHED, { matchReasons: ["makes-a-file", "strict"] })
    expect(reasonParts(card)).toEqual([
      MATCH_REASON_PREFIX,
      MATCH_REASON_WORDS["makes-a-file"],
      MATCH_REASON_WORDS.strict,
    ])
    // The separator is spent BETWEEN the words only — never leading, never doubled. Three
    // parts + one separator = four children; a leading one would make five.
    const line = within(card).getByTestId("row-match-reason")
    expect(line.children).toHaveLength(4)
    expect(line.children[0].textContent).toBe(MATCH_REASON_PREFIX)
  })

  it("all three reasons render in the order given, with two separators", () => {
    const { card } = renderCard(PUBLISHED, {
      matchReasons: ["makes-a-file", "strict", "purpose"],
    })
    expect(reasonParts(card)).toEqual([
      MATCH_REASON_PREFIX,
      MATCH_REASON_WORDS["makes-a-file"],
      MATCH_REASON_WORDS.strict,
      MATCH_REASON_WORDS.purpose,
    ])
    expect(within(card).getByTestId("row-match-reason").children).toHaveLength(6)
  })

  it("the line is the column's LAST child, below the identity line AND the folder chip", () => {
    // BY CHILD ORDER, never by a class name — the rule this suite already follows. The
    // reason is subordinate to the run truth (D-01 line 2) and to the identity line, so it
    // must not push either down.
    const { card } = renderCard(PUBLISHED, {
      folderName: "Risk & Compliance",
      matchReasons: ["strict"],
    })
    const line = within(card).getByTestId("row-match-reason")
    const column = line.parentElement as HTMLElement
    expect(column.children).toHaveLength(5)
    expect(column.children[0].textContent).toContain(PUBLISHED.name)
    expect(column.children[1]).toBe(within(card).getByTestId("row-answer"))
    expect(column.children[2]).toBe(within(card).getByTestId("row-identity"))
    expect(column.children[3].textContent).toContain("Risk & Compliance")
    expect(column.children[4]).toBe(line)
  })

  it("with no folder chip it is STILL last — child index 3, not 4", () => {
    const { card } = renderCard(PUBLISHED, { folderName: null, matchReasons: ["purpose"] })
    const line = within(card).getByTestId("row-match-reason")
    const column = line.parentElement as HTMLElement
    expect(column.children).toHaveLength(4)
    expect(column.children[3]).toBe(line)
  })

  it.each<[Provenance, LibraryRow]>([
    ["published", PUBLISHED],
    ["starter", STARTER],
    ["draft", DRAFT],
  ])("a %s row can carry a reason too — the line is not published-only", (_p, row) => {
    const { card } = renderCard(row, { matchReasons: ["makes-a-file"] })
    expect(within(card).getByTestId("row-match-reason")).toBeInTheDocument()
    expect(reasonParts(card)).toEqual([
      MATCH_REASON_PREFIX,
      MATCH_REASON_WORDS["makes-a-file"],
    ])
  })

  it("the words are spelled in ONE place — this file imports them and never retypes them", () => {
    // The same D-14 one-home rule `CARD_TEMPLATE_MARK`'s case above follows, and the reason
    // it matters more here: two of the three reason words ARE the chip labels, read from
    // `CHIP_WORDS`. If the chip and the reason ever forked, a person would press one word
    // and be answered with another.
    expect(MATCH_REASON_WORDS["makes-a-file"]).toBe(CHIP_WORDS["makes-a-file"].label)
    expect(MATCH_REASON_WORDS.strict).toBe(CHIP_WORDS.strict.label)
  })

  it("the reason NAMES the purpose field and never quotes it (T-192.2-40)", () => {
    // The purpose sentence is user-authored text. This line says WHERE the hit was; putting
    // the snippet on the card would open a new rendering path for user content and re-add,
    // one row at a time, the purpose hero D-03 cut.
    const purposeText = String(PUBLISHED.def?.business_requirement ?? "")
    expect(purposeText.length).toBeGreaterThan(0) // non-vacuity — there IS a sentence to leak
    const { card } = renderCard(PUBLISHED, { matchReasons: ["purpose"] })
    expect(within(card).getByTestId("row-match-reason").textContent).not.toContain(purposeText)
  })
})
