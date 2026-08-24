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
 * `192.2-02` is a pure refactor, so Wave 4 — and only Wave 4 — is where this pin is deliberately
 * re-baselined.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * ── 192.2-05 (WAVE 4) — THE RE-BASELINE. IT IS AN INVERSION, NOT A LOOSENING. ────────────
 * ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * This is the wave the paragraph above nominated, and this is the ONE edit to this file that
 * the phase sanctions. It lands in its own commit, with its own message, BEFORE the source
 * change it describes — so it is observed RED first and the source is what turns it green.
 *
 * ⚠ **NO ASSERTION WAS DELETED.** Each of D-03's six CUT atoms flips from *asserted present* to
 * **asserted ABSENT**, because an atom that merely stops being checked can come back silently
 * while an atom asserted absent cannot. §6 below then sweeps all six across all three
 * provenances in one place, so the subtraction is a property of the card rather than six
 * scattered observations.
 *
 * THE DELTA, STATED AS COUNTS SO IT CAN BE AUDITED RATHER THAN BELIEVED:
 *
 *   atoms asserted PRESENT before → after   17 → 11      (the eleven KEEP atoms)
 *   atoms asserted ABSENT  before → after    0 →  6      (D-03's six, exactly)
 *   atoms ADDED by D-01                          +2      (the gutter, and line 2's run truth)
 *
 * ⚠ THREE SURVIVING ATOMS CHANGE THEIR LITERAL, AND NONE OF THEM DISAPPEARS. D-06 is folded
 * into this wave, so atom 1's mark stops being an emoji and becomes the house icon component,
 * atom 8's folder chip loses its leading emoji while keeping its name, and atom 10's state
 * stops spelling the SYSTEM word (`published` / `draft`) and spells the BUSINESS word
 * `cardFace` already returns. The atoms are all three still on the card and still asserted
 * here; what moved is what they SAY. A reader auditing "exactly six atoms left" must count
 * departures, not edits — and the departures are exactly §6's six.
 *
 * ⚠ ONE PLACEMENT MOVED AND IT IS RECORDED RATHER THAN ABSORBED. D-01 numbers the slots and
 * puts the run truth on LINE 2; 179-C is silent on where the shipped identity line then sits,
 * because that sketch did not render one at all. Line 2 therefore takes DOM position 2 in the
 * name column and the identity line moves to position 3. `WorkflowCard.test.tsx`'s child-order
 * assertions are updated in the same wave — which is exactly what asserting placement by child
 * order was for: a move is visible instead of silent.
 *
 * ── THE FOUR ROWS, AND WHY THE FOURTH IS THE IMPORTANT ONE ───────────────────────────────
 * A published row, a draft and a starter cover the three provenance faces. The FOURTH is a row
 * whose `name` is the EMPTY STRING — `WR-01` was a shipped bug in which an empty name blanked
 * the library title, so "what does this card do with a nameless row" is a question with a
 * measured history rather than a hypothetical. The pin records TODAY's answer (the title node
 * renders, carrying no text) so that a later wave changing it is making a visible decision
 * instead of an accident.
 *
 * ⚠ EVERY FIXTURE ROW CARRIES NEITHER RUN KEY, so all four resolve to D-08's **unknown** arm
 * and say `Not recorded`. That is the honest reading of a fixture built before the feed existed
 * (`libraryScale.ts:765-772` says so in its own words), and it makes this pin the place the
 * stale-deploy arm is characterised. The other four arms are driven in `WorkflowCard.test.tsx`,
 * which owns the run-arm matrix.
 *
 * ⚠ THE ROWS COME FROM `libraryRowOf`, THE SHIPPED FIXTURE SEAM (`__fixtures__/libraryScale.ts`
 * :785), and the identity line from the REAL `buildIdentityIndex` / `resolveIdentity`. A
 * hand-built identity would pin what this file believes the resolver says; the real resolver
 * pins what the card is really handed. Rows are located by `data-testid` and by visible text —
 * NEVER by `getElementById` (D-27).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

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
  RUN_UNKNOWN,
  STATE_DRAFT,
  STATE_RUNNABLE,
  STATE_STARTER,
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

/**
 * D-03's six CUT atoms, by the `data-testid` each one owned on the resting card at the phase
 * base. Five are the soul's; the sixth is the fork-consequence paragraph.
 *
 * ⚠ THE SIXTH IS CUT FROM THE RESTING CARD, NOT FROM THE PRODUCT — it explains a real
 * consequence before a real act, and §1's relocation case proves it still arrives beside the
 * fork verb. An id that stopped resolving ANYWHERE would be T-21, not the subtraction.
 */
const CUT_TESTIDS = [
  "soul-purpose",
  "soul-needs",
  "soul-spine",
  "soul-tier",
  "soul-output",
  "fork-consequence",
] as const

/** The literal strings the five soul atoms put on screen at the base (`192.2-01-SUMMARY.md` §3). */
const CUT_STRINGS = [
  "Assess a vendor against our security requirements before renewal.",
  "needs kickoff_prompt",
  "produces: Vendor Risk Review · file",
] as const

/** The emoji plane D-06 evicts. A card whose text matches this anywhere has an emoji on it. */
const EMOJI = /[\u{1F300}-\u{1FAFF}]/u

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
    now: FIXTURE_NOW,
    ...over,
  }
  render(<WorkflowCard {...props} />)
  return screen.getByTestId(ROOT_TESTID[row.provenance])
}

/**
 * The identity line's parts in DOM order, separators dropped (the `WorkflowCard.test.tsx:190`
 * idiom).
 *
 * ⚠ THE SEPARATOR READ `·` UNTIL THE 200-PORT AND IS NOW `•`, the glyph sketch 200 draws on
 * this line. A helper left on the old glyph does not fail loudly — it stops FILTERING, and
 * every separator silently becomes a "part", which is why this one-character constant is
 * called out rather than quietly swapped. See the same note in the sibling suite.
 */
const identityParts = (card: HTMLElement): string[] =>
  Array.from(within(card).getByTestId("row-identity").children)
    .map((child) => child.textContent ?? "")
    .filter((text) => text !== "•")

/**
 * D-01 line 2, as its own scope.
 *
 * ⚠ THE STATE WORD IS ASSERTED *IN ITS SLOT*, NEVER *SOMEWHERE ON THE CARD*, AND THE REASON WAS
 * MEASURED RATHER THAN FORESEEN: on a row that collides on its name, `resolveIdentity` picks the
 * STATE AXIS as the discriminator, so `Ready to run` legitimately appears twice — once here and
 * once as a seg of the identity line. A card-wide `getByText` threw *"Found multiple elements"*.
 * That duplication is a real observation about the shipped surface and is recorded in this
 * plan's SUMMARY; it is NOT this suite's to hide, and scoping the query is how the suite asserts
 * a SLOT rather than a coincidence.
 */
const answer = (card: HTMLElement): HTMLElement => within(card).getByTestId("row-answer")

/** Open the `⋯` menu — the only place the relocated consequence sentence can be read. */
const openOverflow = async (card: HTMLElement) => {
  await userEvent.click(within(card).getByRole("button", { name: "Workflow actions" }))
}

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

  it("every fixture row ADMITS a template and carries NEITHER run key", () => {
    // ⚠ Also read out of the failing diff. The mark is a SEGMENT of the identity line
    // (`WorkflowCard.tsx:568`), so a pin that omitted it would be asserting a line the card
    // does not render. Which ARM the fixture reaches is proved, not assumed (the 192 CR-01
    // defect: *both failure tests pinned the correct branch without entering the wrong one*).
    for (const row of ROWS) expect(templateAdmission(row.def)).toBe("admits")
    // ⚠ 192.2-05 — and the run arm is proved the same way rather than assumed. `undefined` is
    // D-08's *unknown*; `null` would be *never run*, a different arm and a different sentence.
    for (const row of ROWS) {
      expect(row.lastRunStatus).toBeUndefined()
      expect(row.lastRunAt).toBeUndefined()
    }
  })
})

// ── 1 · the published row — every atom, by visible text ──────────────────────────────

describe("BASELINE — the resting PUBLISHED card", () => {
  it("atoms 1-3 · the mark, the name, the version — and the mark is NO LONGER AN EMOJI", () => {
    const card = renderCard(PUBLISHED)
    // The atom SURVIVES: there is still exactly one provenance mark, at the head of line 1.
    expect(within(card).getByTestId("row-mark")).toBeInTheDocument()
    // ⚠ WAS `expect(card).toHaveTextContent("📄")`. D-06: the mark is now the house icon
    // component, so it contributes no text at all — which is what this asserts.
    expect(card.textContent ?? "").not.toMatch(EMOJI)
    expect(within(card).getByText("Vendor Risk Review")).toBeInTheDocument()
    expect(within(card).getByText("v1")).toBeInTheDocument()
  })

  it("atoms 4-7 · the identity line — ownership, discriminators, collision counter, recency", () => {
    const card = renderCard(PUBLISHED)
    const identity = identityFor(PUBLISHED)
    // The WHOLE line, in order: the card paints exactly what the resolver said and invents
    // nothing. Asserting the array rather than a substring is what pins the ORDER too.
    //
    // ⚠ RE-BASELINED FOR `BUG-260819-01`, AND THIS CASE IS THE ONE THAT CAUGHT THE BUG.
    // It read `...identity.segs` — the resolver's segments, spread WHOLE — and on this
    // fixture that array is exactly `["Ready to run"]` (asserted three cases up, read out of
    // this suite's own failing diff when it was written). The card ALSO renders the state
    // unconditionally on line 2. So the pin was faithfully recording a card that said
    // `Ready to run` twice, about forty pixels apart, on every name-colliding row — which is
    // what the operator saw live as `… Shared starter | SHARED • Shared starter • …`.
    //
    // ⚠ THIS IS NOT A LOOSENING, AND THE `.filter` IS DELIBERATELY *NOT* A COPY OF THE CARD'S
    // OWN EXPRESSION. It is a re-statement of the RULE — *the identity line does not repeat
    // what line 2 already said* — driven from the resolver's real output and the real state
    // word, so a card that dropped the WRONG segment, dropped ALL of them, or stopped
    // dropping any still reds here. Every other part of the assertion is untouched: the
    // order, the own pill at index 0, the AUTH-03 mark at index 1, the counter and the
    // recency are all pinned exactly as hard as they were.
    //
    // ⚠ AND THE STATE IS STILL ASSERTED PRESENT ON THE CARD — one screen down, `atom 10`
    // asserts `STATE_RUNNABLE` inside `answer(card)`. So this edit moves the word's HOME to
    // exactly one place; it does not stop checking that the card says it.
    expect(identityParts(card)).toEqual([
      OWN_YOURS,
      CARD_TEMPLATE_MARK,
      ...identity.segs.filter((seg) => seg !== STATE_RUNNABLE),
      oneOfLabel(3),
      CHANGED_PREFIX + "5 days ago",
    ])
    // NON-VACUITY — the filter above really removed something on this fixture, so the case
    // cannot pass by filtering nothing out of a line that never carried the duplicate.
    expect(identity.segs).toContain(STATE_RUNNABLE)
    expect(identityParts(card)).not.toContain(STATE_RUNNABLE)
    expect(identity.own).toBe(OWN_YOURS)
  })

  it("atom 8 · the folder chip — the name survives, the emoji does not", () => {
    const card = renderCard(PUBLISHED)
    // ⚠ WAS `toHaveTextContent("📁 " + FOLDER_NAME)`. The chip is a KEEP atom; only its glyph
    // changed, and D-06's rule is *no emoji on the card* rather than *no folder chip*.
    expect(card).toHaveTextContent(FOLDER_NAME)
    expect(card.textContent ?? "").not.toContain("\u{1F4C1}")
  })

  it("atom 9 · the overflow trigger", () => {
    const card = renderCard(PUBLISHED)
    expect(within(card).getByRole("button", { name: "Workflow actions" })).toBeInTheDocument()
  })

  it("atom 10 · the state, IN BUSINESS WORDS — the system spelling reaches nobody", () => {
    const card = renderCard(PUBLISHED)
    // ⚠ WAS `getByText("published")`. D-06: `published` and `draft` are the system's words, in
    // the system's data. The atom is still here; it finally says something a person means.
    expect(within(answer(card)).getByText(STATE_RUNNABLE)).toBeInTheDocument()
    expect(within(card).queryByText("published")).toBeNull()
  })

  it("NEW · D-01 line 2 — the run truth first, then the state, in that order", () => {
    const card = renderCard(PUBLISHED)
    const line = within(card).getByTestId("row-answer")
    // The fixture carries no run keys, so the honest arm is *unknown* — never a tick and never
    // a fabricated time. THE WORD is what carries it (T-20: assert the word, not the class).
    expect(line).toHaveTextContent(RUN_UNKNOWN)
    expect(line).toHaveTextContent(STATE_RUNNABLE)
    const text = line.textContent ?? ""
    expect(text.indexOf(RUN_UNKNOWN)).toBeLessThan(text.indexOf(STATE_RUNNABLE))
  })

  it("NEW · D-01 slot 1 — the 3px gutter exists and is keyed to the row's run arm", () => {
    const card = renderCard(PUBLISHED)
    const gutter = within(card).getByTestId("run-gutter")
    // The gutter is DECORATION over a fact stated in words one line down — it carries the arm
    // as data so a later wave cannot let colour drift away from the sentence.
    expect(gutter).toHaveAttribute("data-run", "unknown")
    expect(gutter).toHaveAttribute("aria-hidden", "true")
    expect(gutter.textContent).toBe("")
  })

  it("atoms 11-15 · CUT (D-03) — the five soul atoms have LEFT the resting card", () => {
    const card = renderCard(PUBLISHED)
    // ⚠ INVERTED, NOT DELETED. Each of the five was asserted PRESENT here at the phase base.
    expect(within(card).queryByTestId("workflow-soul")).toBeNull()
    for (const id of ["soul-purpose", "soul-needs", "soul-spine", "soul-tier", "soul-output"]) {
      expect(within(card).queryByTestId(id)).toBeNull()
    }
    // …and by TEXT too, so a node that survived under a new id still reds here.
    for (const literal of CUT_STRINGS) expect(card).not.toHaveTextContent(literal)
    expect(card).not.toHaveTextContent("STRICT")
    expect(card).not.toHaveTextContent("Strict")
  })

  it("atom 16 · CUT from the resting card — and RELOCATED beside the verb it explains (T-21)", async () => {
    const card = renderCard(PUBLISHED)
    // ⚠ WAS asserted present at rest. D-03 cuts it from the RESTING card.
    expect(within(card).queryByTestId("fork-consequence")).toBeNull()
    // ⚠ AND THIS HALF IS THE ONE THAT MATTERS. The sentence warns about a real consequence
    // before a real act; deleting it from the product would be T-21. It now arrives at the
    // moment it is needed, still wired to the control by `aria-describedby`.
    await openOverflow(card)
    const sentence = screen.getByTestId("fork-consequence")
    expect(sentence).toHaveTextContent(FORK_CONSEQUENCE)
    expect(screen.getByTestId("published-tweak")).toHaveAttribute(
      "aria-describedby",
      sentence.getAttribute("id"),
    )
  })

  it("atom 17 · the one primary verb", () => {
    const card = renderCard(PUBLISHED)
    // 200-PORT: the glyph left the label string and is now an aria-hidden icon node (Play /
    // ExternalLink, the sheet own play_arrow / open_in_new). The word is the whole text.
    expect(within(card).getByTestId("published-run")).toHaveTextContent("Run")
    expect(within(card).queryByTestId("draft-open")).toBeNull()
  })
})

// ── 2 · the draft — the OTHER face of every atom that varies ─────────────────────────

describe("BASELINE — the resting DRAFT card", () => {
  it("leads with its own mark and says STILL BUILDING, never `draft`", () => {
    const card = renderCard(DRAFT)
    expect(within(card).getByTestId("row-mark")).toBeInTheDocument()
    expect(card.textContent ?? "").not.toMatch(EMOJI)
    expect(within(answer(card)).getByText(STATE_DRAFT)).toBeInTheDocument()
    expect(within(card).queryByText("draft")).toBeNull()
  })

  it("says Yours through the feed-derived fallback, the wire having said nothing", () => {
    expect(DRAFT.isMine).toBeUndefined()
    const card = renderCard(DRAFT)
    expect(identityParts(card)[0]).toBe(OWN_YOURS)
  })

  it("leads with Open, reaches NO Run affordance, and spends no consequence sentence", () => {
    const card = renderCard(DRAFT)
    // 200-PORT: the glyph left the label string and is now an aria-hidden icon node (Play /
    // ExternalLink, the sheet own play_arrow / open_in_new). The word is the whole text.
    expect(within(card).getByTestId("draft-open")).toHaveTextContent("Open")
    expect(within(card).queryByTestId("published-run")).toBeNull()
    expect(within(card).queryByTestId("fork-consequence")).toBeNull()
  })

  it("renders NONE of the five soul atoms — the draft is quiet too (D-03)", () => {
    const card = renderCard(DRAFT)
    // ⚠ INVERTED from *"still renders all five soul atoms"*. A subtraction that only reached
    // the published face would leave 69% of this library — the drafts — exactly as loud.
    for (const id of ["soul-purpose", "soul-needs", "soul-spine", "soul-tier", "soul-output"]) {
      expect(within(card).queryByTestId(id)).toBeNull()
    }
    expect(within(card).queryByTestId("workflow-soul")).toBeNull()
  })
})

// ── 3 · the starter ──────────────────────────────────────────────────────────────────

describe("BASELINE — the resting STARTER card", () => {
  it("leads with its own mark and says SHARED STARTER — the full business word", () => {
    const card = renderCard(STARTER)
    expect(within(card).getByTestId("row-mark")).toBeInTheDocument()
    expect(card.textContent ?? "").not.toMatch(EMOJI)
    // ⚠ WAS `getByText("Starter")`. The shipped vocabulary's word is `Shared starter`, and
    // `cardFace` has returned it since 192.2-02 — the pill was simply not rendering it.
    expect(within(answer(card)).getByText(STATE_STARTER)).toBeInTheDocument()
  })

  it("says Shared — it is not this reader's row", () => {
    const card = renderCard(STARTER)
    expect(identityParts(card)[0]).toBe(OWN_SHARED)
  })

  it("is runnable: it leads with Run, and its consequence sentence lives in the menu", async () => {
    const card = renderCard(STARTER)
    // 200-PORT: the glyph left the label string and is now an aria-hidden icon node (Play /
    // ExternalLink, the sheet own play_arrow / open_in_new). The word is the whole text.
    expect(within(card).getByTestId("published-run")).toHaveTextContent("Run")
    expect(within(card).queryByTestId("fork-consequence")).toBeNull()
    await openOverflow(card)
    expect(screen.getByTestId("fork-consequence")).toHaveTextContent(FORK_CONSEQUENCE)
  })
})

// ── 4 · WR-01's row — the empty name ─────────────────────────────────────────────────

describe("BASELINE — a row whose name is the empty string (WR-01)", () => {
  it("renders the title node, carrying no text — TODAY'S answer, pinned", () => {
    const card = renderCard(NAMELESS)
    // Located by the version's sibling position rather than by a testid: the title carries no
    // test hook of its own, and inventing one here would change the file this plan refactors.
    const header = within(card).getByText("v1").parentElement
    expect(header).not.toBeNull()
    // ⚠ `getAttribute("class")`, NOT `.className` — the mark at index 0 is an SVG element since
    // D-06, and `SVGElement.className` is an `SVGAnimatedString` rather than a string, so the
    // shipped `.includes` threw a `TypeError` rather than failing an assertion. Read out of the
    // suite's own RED, not predicted.
    const title = Array.from(header!.children).find((child) =>
      (child.getAttribute("class") ?? "").includes("truncate"),
    )
    expect(title).toBeDefined()
    expect(title!.textContent).toBe("")
  })

  it("degrades readably: the row is still identifiable, still runnable, still complete", () => {
    const card = renderCard(NAMELESS)
    expect(within(card).getByTestId("row-mark")).toBeInTheDocument()
    expect(within(card).getByText("v1")).toBeInTheDocument()
    expect(identityParts(card)[0]).toBe(OWN_YOURS)
    expect(within(answer(card)).getByText(STATE_RUNNABLE)).toBeInTheDocument()
    // 200-PORT: the glyph left the label string and is now an aria-hidden icon node (Play /
    // ExternalLink, the sheet own play_arrow / open_in_new). The word is the whole text.
    expect(within(card).getByTestId("published-run")).toHaveTextContent("Run")
    // ⚠ WAS `getByTestId("soul-purpose")`. A nameless row is now carried by line 2 alone —
    // which is precisely why line 2 has to be TOTAL over the arms (D-08).
    expect(within(card).getByTestId("row-answer")).toHaveTextContent(RUN_UNKNOWN)
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
    ["published", PUBLISHED, STATE_RUNNABLE, true] as const,
    ["draft", DRAFT, STATE_DRAFT, false] as const,
    ["starter", STARTER, STATE_STARTER, true] as const,
  ])("%s renders its mark, its business word and its verb", (_label, row, state, runnable) => {
    const card = renderCard(row)
    expect(within(card).getByTestId("row-mark")).toBeInTheDocument()
    expect(within(answer(card)).getByText(state)).toBeInTheDocument()
    expect(within(card).getByTestId(runnable ? "published-run" : "draft-open")).toBeInTheDocument()
    // ⚠ WAS the five soul atoms and an emoji folder chip, asserted unconditional across all
    // three faces. What is unconditional NOW is the gutter, line 2 and the chip's name.
    expect(within(card).getByTestId("run-gutter")).toBeInTheDocument()
    expect(within(card).getByTestId("row-answer")).toHaveTextContent(RUN_UNKNOWN)
    expect(card).toHaveTextContent(FOLDER_NAME)
    expect(card.textContent ?? "").not.toMatch(EMOJI)
  })
})

// ── 6 · THE SUBTRACTION, AS ONE PROPERTY — D-03's six atoms, all three faces ─────────

/**
 * ⚠ THIS BLOCK IS THE POINT OF THE RE-BASELINE, AND IT IS WHY THE ASSERTIONS WERE INVERTED
 * RATHER THAN REMOVED. T-18 is *"the gutter is added and nothing is cut"* — a card that got
 * LOUDER, which is the exact opposite of what the operator approved. Six scattered `queryBy`
 * nulls could each be quietly relaxed; one sweep over the named six, on every face, cannot.
 */
describe("D-03 — the six CUT atoms are absent from the resting card, on every face", () => {
  it.each([
    ["published", PUBLISHED] as const,
    ["draft", DRAFT] as const,
    ["starter", STARTER] as const,
  ])("a resting %s card renders none of the six", (_label, row) => {
    const card = renderCard(row)
    for (const id of CUT_TESTIDS) expect(within(card).queryByTestId(id)).toBeNull()
    for (const literal of CUT_STRINGS) expect(card).not.toHaveTextContent(literal)
    // The tier chip renders UPPERCASE through CSS; both readings are excluded so a change of
    // casing cannot smuggle it back.
    expect(card).not.toHaveTextContent("STRICT")
    expect(card).not.toHaveTextContent("Strict")
    // POSITIVE CONTROL — the sweep is looking at a card that really did render, so the six
    // nulls above are absences rather than a query pointed at nothing.
    expect(within(card).getByTestId("row-answer")).toBeInTheDocument()
  })
})
