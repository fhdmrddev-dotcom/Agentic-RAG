/**
 * Phase 184.1-01 Task 1 — THE FIRST PIN THE BUILDER HEADER HAS EVER HAD.
 *
 * WHY THIS FILE EXISTS. D-181-01 requires the `visual_workflow_canvas`-OFF surface to be
 * byte-identical for EVERYONE, operators included. For the Builder's header that promise
 * was, until this file, entirely untested: `revertByteIdentical.test.tsx` pins `NAV_ITEMS`
 * and the Control-Room radio, and `WorkflowBuilderPage.canvas.test.tsx` pins flag-off
 * BEHAVIOURS (no editing affordance, `rails` absent, panel dismissal, the empty-draft
 * publish trigger) — nothing anywhere pinned the header's STRUCTURE. A regression there
 * would have shipped green.
 *
 * IT IS WRITTEN BEFORE THE REFACTOR, ON PURPOSE. Plan 184.1-01 collapses the three stacked
 * bands into one row behind the canvas flag. Writing this pin afterwards would only prove
 * the new shape; written first, against the UNMODIFIED page, its later failure means a
 * real regression rather than a new test finding its feet.
 *
 * ── WHAT A "BAND" IS, AND HOW IT IS COUNTED ────────────────────────────────────────
 *
 * The operator's complaint is about STACKED CHROME above the flow: three bordered rows,
 * each contributed by a different component, that between them ate 146 px. Those three
 * are not siblings in the DOM — they are contributed at three nesting levels:
 *
 *   WorkflowsPage        `← Workflows` · `Edit · <title>` · `NET-NEW`
 *     WorkflowDoorSwitch STRIP_BACK · STRIP_LABEL_GOVERN · `JUDGE ALWAYS-ON`
 *       WorkflowBuilder  `<slug>` · `draft` · `Save draft` · `◆ Publish…`
 *
 * ⚠ The middle row's two words are named by their `doorVocabulary` ids rather than quoted,
 * as of `193-08`: they are governed COPY and were re-worded to variant D in that plan, so a
 * quotation here would be a fourth home for a string with one owner. The other rows' labels
 * are NOT governed copy and stay quoted.
 *
 * So `headerBandsAbove()` walks up from `builder-grid` to the render root and collects
 * every PRECEDING SIBLING at each level. In a column layout that set is exactly the rows
 * stacked above the flow, at whatever depth they were contributed — which is the thing a
 * person actually sees, rather than a selector that happens to match today's classes.
 *
 * jsdom REPORTS EVERY ELEMENT AS ZERO-HEIGHT, so nothing here asserts a pixel value. The
 * band COUNT and the band STRUCTURE are what this file measures; the real height win is
 * an operator observation at the ~900 px width that prompted the phase, and that row
 * belongs in the phase's UAT, not in a jsdom suite.
 *
 * ── THE OUTERHTML LITERAL ──────────────────────────────────────────────────────────
 *
 * One normalised literal, asserted for the absent-key map, and then the operator-like map
 * is asserted to produce the IDENTICAL string. That is the D-181-01 sentence stated as an
 * equality rather than as a second copied literal that could drift from the first.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

// The whole api surface the three composed components reach. A factory mock that omits
// one symbol hands back `undefined` and the failure surfaces far from its cause — the
// enumeration discipline `WorkflowBuilderPage.session.test.tsx` states and follows.
const {
  mockGenerate,
  mockCreate,
  mockUpdate,
  mockListFolders,
  mockListSkills,
  mockValidate,
  mockBundle,
  mockPublish,
  mockListPublished,
  mockListStarters,
  mockListDrafts,
  mockDeletePreview,
  mockDeleteCascade,
} = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
  mockValidate: vi.fn(),
  mockBundle: vi.fn(),
  mockPublish: vi.fn(),
  mockListPublished: vi.fn(),
  mockListStarters: vi.fn(),
  mockListDrafts: vi.fn(),
  mockDeletePreview: vi.fn(),
  mockDeleteCascade: vi.fn(),
}))

vi.mock("@/lib/api", () => {
  class WorkflowConflictError extends Error {
    constructor(message = "workflow is published and cannot be modified") {
      super(message)
      this.name = "WorkflowConflictError"
    }
  }
  class WorkflowNotFoundError extends Error {
    constructor(message = "workflow not found") {
      super(message)
      this.name = "WorkflowNotFoundError"
    }
  }
  return {
    // 204-03 (SCHED-01) — the measured mock budget (see `WorkflowsPage.test.tsx`'s copy of
    // this note): a whole-module factory missing a new RUNTIME export throws AT MOUNT.
    listSchedules: () => Promise.resolve([]),
    listWorkflowSchedules: () => Promise.resolve([]),
    createWorkflowSchedule: () => Promise.resolve({}),
    updateSchedule: () => Promise.resolve({}),
    deleteSchedule: () => Promise.resolve(undefined),
    triggerSchedule: () => Promise.resolve({ launched: false }),
    generateWorkflow: mockGenerate,
    createWorkflowDraft: mockCreate,
    updateWorkflowDraft: mockUpdate,
    listFolders: mockListFolders,
    listSkills: mockListSkills,
    // Phase 200 (FE-WIRING) — the page's mount effect now reads the connector connections
    // too. DECLARED rather than left undefined (`196-08`: a whole-module factory mock that
    // omits a reachable symbol fails far from its cause). An empty list is the SHIPPED
    // absence — every external face renders its destination-free sentence.
    listConnectorConnections: () => Promise.resolve([]),
    validateWorkflow: mockValidate,
    getGroundingBundle: mockBundle,
    // 196-08 (AUTH-04) — see the note in `WorkflowBuilderPage.describe.test.tsx`: the page
    // reads the author model registry at mount and this factory must declare it.
    getAuthorModelRegistry: () => Promise.resolve({ models: [], run_default_model: null }),
    publishWorkflow: mockPublish,
    listPublishedWorkflows: mockListPublished,
    listStarterWorkflows: mockListStarters,
    listDraftWorkflows: mockListDrafts,
    getWorkflowDeletePreview: mockDeletePreview,
    deleteWorkflowCascade: mockDeleteCascade,
    WorkflowConflictError,
    WorkflowNotFoundError,
  }
})

import { WorkflowsPage } from "./WorkflowsPage"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import type { EffectiveFeatures } from "@/lib/api"

// The three band owners' SOURCE via Vite's ?raw loader — the idiom this phase's suites
// already use (`PhaseSpineGraph.test.tsx`, `WorkflowDoorSwitch.test.tsx`) to make a scope
// fence machine-checkable rather than merely intended.
import builderSource from "./WorkflowBuilderPage?raw"
import workflowsPageSource from "./WorkflowsPage?raw"
import doorSwitchSource from "@/components/workflows/WorkflowDoorSwitch?raw"
// 199-09 (DES-01 · sheet `c10-builder-chrome`) — the six chrome sources this plan reconciles,
// read through the same `?raw` loader the three above use. Every sheet element this plan
// REFUSES is refused against one of these, with NON-VACUITY asserted first and a positive
// control beside it: a sweep over an empty string passes silently and proves nothing (the
// `?raw`-returns-"" trap that `gutterTokens.fences.test.ts` records for CSS).
import saveRegionSource from "@/components/workflows/BuilderSaveRegion?raw"
import headerBarSource from "@/components/workflows/BuilderHeaderBar?raw"
import publishGauntletSource from "@/components/workflows/PublishGauntlet?raw"
import problemsTraySource from "@/components/workflows/ProblemsTray?raw"
import stepPickerSource from "@/components/workflows/StepTypePicker?raw"
import templateFirstDraftSource from "@/components/workflows/useTemplateFirstDraft?raw"
// Phase 193-08: the two governed words this suite names, READ off their one home rather than
// re-typed. A page suite that spells a governed door string is a second home (D-11) and goes
// stale silently at the next reword — which is precisely what happened to every literal this
// plan had to re-capture.
// 199-09: two more governed ids, on the same terms. `DESCRIBE_REFUSAL` is `199-08`'s new
// 23rd id and is asserted through its IMPORTED value, never re-typed — a suite that spells
// it would be the fourth home for a string with one owner, and would go green against a
// re-worded constant.
import {
  DESCRIBE_CTA,
  DESCRIBE_REFUSAL,
  STRIP_BACK,
  STRIP_LABEL_GOVERN,
} from "@/components/workflows/doorVocabulary"
import { WorkflowBuilderPage } from "./WorkflowBuilderPage"
import { BuilderHeaderBar } from "@/components/workflows/BuilderHeaderBar"

/** Two steps, hand-authored so `__fixtures__/canvasFixtures.ts` stays untouched
 *  (D-184-17 — that corpus belongs to the snapshot + round-trip suites). */
const definition = {
  slug: "vendor-brief",
  version: 1,
  status: "draft",
  business_requirement: "summarize vendor risk",
  phases: [
    { slug: "research", phase_index: 0, name: "Research", config: { phase_type: "llm_agent", prompt: "" } },
    { slug: "summarize", phase_index: 1, name: "Summarize", config: { phase_type: "llm_single", prompt: "" } },
  ],
}

const draftRow = {
  id: "draft-1",
  slug: "vendor-brief",
  version: 1,
  name: "Vendor brief",
  definition,
}

/** The canvas flag is OFF in every one of these. Three ways of being off, because
 *  D-181-01 is a statement about all of them and "operators too" is the one that
 *  a careless gate breaks first. */
const OFF_VARIANTS: Array<{ name: string; value: { features: EffectiveFeatures; loading: boolean } | null }> = [
  { name: "an ABSENT canvas key", value: { features: {}, loading: false } },
  { name: "an EXPLICIT false", value: { features: { visual_workflow_canvas: false }, loading: false } },
  {
    name: "an OPERATOR-LIKE map (every other governed key true, canvas absent)",
    value: {
      features: {
        skill_studio: true,
        model_management: true,
        workflow_authoring: true,
        governance_health: true,
      },
      loading: false,
    },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockListFolders.mockResolvedValue([])
  mockListSkills.mockResolvedValue([])
  mockListPublished.mockResolvedValue([])
  mockListStarters.mockResolvedValue([])
  mockListDrafts.mockResolvedValue([draftRow])
  mockBundle.mockResolvedValue({ tools: [], folders: [], skills: [], degraded: [] })
  mockValidate.mockResolvedValue({ ok: true, verdicts: [] })
  // The ⌥ Technical-names reveal persists; a leaked value would change the node titles
  // under us and, with them, the pinned markup.
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

/**
 * Open a real draft through the real host, so all THREE band owners are composed exactly
 * as they are in the app: `WorkflowsPage` (breadcrumb) → `WorkflowDoorSwitch` govern door
 * → `WorkflowBuilderPage`. Opening a draft — rather than the fresh-build chooser — is what
 * puts a Builder on screen at all.
 */
async function openDraftBuilder(
  value: { features: EffectiveFeatures; loading: boolean } | null,
) {
  const page = (
    <div style={{ width: 1200, height: 800 }}>
      <WorkflowsPage folders={[]} onLaunch={vi.fn()} />
    </div>
  )
  const utils = render(
    value ? (
      <EffectiveFeaturesProvider value={{ ...value, refetch: vi.fn() }}>{page}</EffectiveFeaturesProvider>
    ) : (
      page
    ),
  )
  fireEvent.click(await screen.findByTestId("draft-open"))
  await screen.findByTestId("door-govern")
  await waitFor(() => expect(screen.getByTestId("builder-grid")).toBeInTheDocument())
  return utils
}

/**
 * Every row stacked ABOVE the flow, nearest first, at whatever nesting depth it was
 * contributed. See the docblock: this is the count the operator's 146 px complaint is
 * about, and it is the only height-shaped thing jsdom can honestly measure.
 */
function headerBandsAbove(grid: Element, root: Element): Element[] {
  const bands: Element[] = []
  let node: Element | null = grid
  while (node !== null && node !== root) {
    let sib = node.previousElementSibling
    while (sib !== null) {
      bands.push(sib)
      sib = sib.previousElementSibling
    }
    node = node.parentElement
  }
  return bands
}

/** Collapse whitespace runs so the literal is diffable and indentation-independent. */
const normalise = (html: string) => html.replace(/\s+/g, " ").trim()

/** The three bands, outermost first, as ONE normalised string. */
function headerMarkup(grid: Element, root: Element): string {
  return headerBandsAbove(grid, root)
    .reverse()
    .map((band) => normalise(band.outerHTML))
    .join("\n")
}

// ── STRUCTURE: three separate bands, each owning its own controls ──────────────────

describe("Builder header, canvas flag OFF — three separate bands (D-181-01)", () => {
  for (const variant of OFF_VARIANTS) {
    it(`${variant.name} renders the breadcrumb, the door control and the save cluster in THREE distinct bands`, async () => {
      const { container } = await openDraftBuilder(variant.value)

      // Every control the three bands carry is present and reachable.
      const back = screen.getByTestId("builder-back")
      expect(back.textContent).toContain("← Workflows")
      const bothDoors = screen.getByTestId("both-doors")
      // Phase 193-08 RE-CAPTURE (2026-08-13, words only): the expectation was a literal until
      // variant D landed. It now READS the word off `doorVocabulary` and compares the WHOLE
      // string — a governed word re-typed in a page suite is a second home (D-11), and a
      // fragment check could not tell this control's label from the strip's.
      expect(bothDoors.textContent).toBe(STRIP_BACK)
      expect(screen.getByTestId("door-govern")).toBeInTheDocument()
      expect(screen.getByTestId("judge-locked")).toBeInTheDocument()
      const saveCluster = screen.getByTestId("builder-save-state")
      expect(saveCluster.textContent).toContain("Save draft")
      expect(screen.getByTestId("publish-trigger").textContent).toContain("Publish")

      // …and they sit in three SEPARATE bordered rows, not one merged one.
      const grid = screen.getByTestId("builder-grid")
      const bands = headerBandsAbove(grid, container)
      expect(bands).toHaveLength(3)

      const [builderBand, doorBand, breadcrumbBand] = bands
      expect(builderBand.contains(saveCluster)).toBe(true)
      expect(doorBand.contains(bothDoors)).toBe(true)
      expect(breadcrumbBand.contains(back)).toBe(true)

      // Three distinct elements, and none of them nests another — genuinely stacked.
      expect(new Set(bands).size).toBe(3)
      for (const a of bands) {
        for (const b of bands) {
          if (a !== b) expect(a.contains(b)).toBe(false)
        }
      }
    })
  }

  it("the save cluster and the publish trigger share ONE header — 141-B's operator correction", async () => {
    await openDraftBuilder(OFF_VARIANTS[0].value)
    const header = screen.getByTestId("publish-trigger").closest("header")
    expect(header).not.toBeNull()
    expect(header!.contains(screen.getByTestId("builder-save-state"))).toBe(true)
    expect(screen.getAllByRole("banner")).toHaveLength(1)
  })

  it("NO PROVIDER at all is fail-closed and behaves exactly the same", async () => {
    // A null context must read exactly like `{}` (plan 183-03's one net-new code path).
    const { container } = await openDraftBuilder(null)
    expect(headerBandsAbove(screen.getByTestId("builder-grid"), container)).toHaveLength(3)
    expect(screen.getByTestId("builder-back")).toBeInTheDocument()
    expect(screen.getByTestId("both-doors")).toBeInTheDocument()
    expect(screen.getByTestId("builder-save-state")).toBeInTheDocument()
  })
})

// ── MARKUP: the exact flag-off header, so ANY structural change reds with a diff ────

/**
 * The three bands' normalised `outerHTML`, outermost first, captured from the page. It is
 * deliberately verbatim rather than a shape assertion: the promise D-181-01 makes is about
 * the markup a shipped user receives, and a "looks about right" matcher cannot break when a
 * wrapper is introduced or a band is re-parented.
 *
 * ── ⚠ RE-CAPTURED ONCE, DELIBERATELY, BY PLAN `193-08` ON 2026-08-13 ────────────────────
 *
 * This literal was captured in Phase 184.1 and had stood unedited for NINE phases, which is
 * exactly what made it the strongest instrument Phase 193 had. It is re-captured here, from
 * the rendered tree via the same `headerMarkup()` driver (twice, agreeing byte for byte), and
 * NOT hand-edited. The reasons, stated rather than absorbed:
 *
 *  • WHY IT IS LEGITIMATE NOW. `193-03` (the `DoorHeaderStrip` extraction) and `193-05` (the
 *    copy move into `doorVocabulary.ts`) BOTH passed with this literal GREEN AND UNEDITED.
 *    That is the proof both were verbatim moves, and it could only be collected before a word
 *    changed. `193-08` is the first plan in the phase that intentionally changes a RENDERED
 *    WORD (variant D, D-01), so the literal has already discharged its purpose.
 *
 *  • WHAT CHANGED: THE WORDS ONLY, measured rather than asserted. Old vs new was compared with
 *    tags and text separated. ALL THREE BANDS: `structure identical: true` — every tag, class
 *    list, `data-testid`, the judge badge's `title`, and the `ml-auto` byte-for-byte unchanged.
 *    TEXT NODES: band 1 → 3/3 with ZERO differences, band 3 → 4/4 with ZERO differences, and
 *    band 2 → 4/4 with exactly TWO differing nodes:
 *        "‹ both doors"          ->  "‹ Change how I start"     (`strip.back`)
 *        "🔧 Author &amp; govern" ->  "Build it myself"          (`strip.labelGovern`, D-23)
 *    The 🔧 leaving is a CONSEQUENCE of D-23 (the label becomes the door's own name, which
 *    carries no glyph), not a discretionary choice, and it is routed to UAT row U6.
 *
 *  • ⚠ THIS IS RE-CAPTURE **ONE OF TWO**. `193-09`'s D-04/D-22 restack will red this literal
 *    again — on STRUCTURE rather than on words, which is precisely the distinction this note
 *    makes checkable for the next author. Both are legitimate; both must be stated. Any
 *    further re-capture whose diff shows a TAG difference the plan did not name is a
 *    behaviour change to explain, not a test to update.
 *
 * ── ⚠ RE-CAPTURED A SECOND AND FINAL TIME BY PLAN `193-09` ON 2026-08-13 ────────────────
 *
 * The note above predicted this one and named exactly what it would be, which is the whole
 * value of having written it down. Re-captured from the rendered tree by the same
 * `headerMarkup()` driver, run twice and agreeing byte for byte, and substituted by an ENCODER
 * VALIDATED FIRST — re-encoding all three OLD bands had to reproduce this file's own bytes
 * before one new byte was written. Nothing was hand-edited.
 *
 *  • WHAT CHANGED: THE STRUCTURE ONLY — the exact complement of the words-only note above.
 *
 *      | band            | tag deltas                            | non-empty text nodes |
 *      |-----------------|---------------------------------------|----------------------|
 *      | 1 (breadcrumb)  | NONE — line byte-identical            | 3 → 3, identical     |
 *      | 2 (door band)   | 1 class list + 1 INSERTED rule span   | 4 → 4, identical     |
 *      | 3 (save cluster)| NONE — line byte-identical            | 4 → 4, identical     |
 *
 *    `git diff --numstat` on this file for the substitution: **1 changed line, not 3**.
 *
 *  • THE TWO DELTAS IN BAND 2, IN FULL, AND THEY ARE THE ONLY TWO:
 *      - the `both-doors` control's class list loses its rounding and its 1px outline (D-04's
 *        demotion, applied to the govern strip and mirrored on the describe band by D-22);
 *      - ONE `<span aria-hidden="true">` rule is INSERTED between that control and the door
 *        label. Decorative, no testid, empty — `DoorHeaderStrip.test.tsx` asserts it adds not
 *        one character to the strip's text.
 *    Every other tag, class list, `data-testid`, the judge badge's `title`, and the `ml-auto`
 *    conditional are byte-for-byte unchanged, in all three bands.
 *
 *  • ⚠ NOT ONE RENDERED WORD MOVED, and it is measured as a SEQUENCE rather than by position.
 *    Inserting a node shifts every later slot of a naive `split(/<[^>]*>/)` diff, which reports
 *    8 "changed" text nodes in band 2 — all of them that artefact. Compared as an ordered
 *    sequence of non-empty text nodes, all three bands are identical element for element.
 *
 *  • ⚠ THIS IS RE-CAPTURE **TWO OF TWO**, AND THE PHASE EXPECTS NO THIRD. `193-08` changed the
 *    words; `193-09` changed the structure. This literal stood unedited for nine phases before
 *    Phase 193 and is expected to stand again — any further re-capture is a behaviour change
 *    to explain in its own plan, not a test to update.
 *
 * ── ✅ NO THIRD RE-CAPTURE: TESTED AGAINST `197-10` ON 2026-08-18 AND THE PIN DID NOT MOVE ──
 *
 * `197-10` (D-19) was PLANNED as the third re-capture. Its own plan priced one, `197-CONTEXT.md`
 * D-19 priced one, and `197-09` deliberately declined to touch the identity span so that this
 * plan could pay for it in isolation. **It was not owed.** The disposition is recorded here in
 * the same detail a re-capture would have been given, because "nothing happened" is a
 * measurement and is worth exactly as much as a diff — and because the next author must be able
 * to tell a pin that was TESTED against a change from one that was merely left alone.
 *
 *  • WHAT `197-10` CHANGED. The identity `<span>`'s child expression, and nothing else on the
 *    surface: it now renders the workflow's NAME when the definition binds a non-empty one,
 *    falling back to `meta.slug` and then to `"Untitled workflow"`. Before it, `meta.name`
 *    appeared in no render position anywhere on the page.
 *
 *  • WHY BAND 3 IS UNMOVED, AND IT IS A FACT ABOUT THE FIXTURE. `openDraftBuilder` drives the
 *    hand-authored `definition` above, which binds **no `name`** — so the slot still resolves
 *    to `meta.slug`, still renders `vendor-brief`, and the captured literal is still the bytes
 *    a flag-off user receives. ⚠ `draftRow.name` IS `"Vendor brief"`, but that is the ROW's
 *    name and it feeds band 1's breadcrumb; only the DEFINITION reaches `meta`. Conflating the
 *    two would predict a moved band 3 and be wrong.
 *
 *      | band            | tag deltas | non-empty text nodes |
 *      |-----------------|------------|----------------------|
 *      | 1 (breadcrumb)  | NONE       | 3 → 3, identical     |
 *      | 2 (door band)   | NONE       | 4 → 4, identical     |
 *      | 3 (save cluster)| NONE       | 4 → 4, identical     |
 *
 *    `git diff --numstat` on this file for `197-10`: **0 deletions.** The literal is untouched
 *    and every band is byte-identical — measured by running this suite's own two byte-pin cases
 *    against the changed page, not by inspection.
 *
 *  • ⚠ AND THE GREEN IS NOT VACUOUS, WHICH IS THE ONLY WAY THIS ENTRY IS WORTH ANYTHING. A pin
 *    over a DEAD expression stays green too and proves nothing. `197-10 / D-19 — the drafted
 *    header's identity slot` drives the SAME flag-off surface with a definition that DOES bind
 *    a name and reads the name back out of the slot; it FAILS against the pre-change page
 *    (`expected 'vendor-brief' to be 'Northwind QBR'`) and passes after. So the slot is live,
 *    and this entry says "the fixture binds no name", never "the change did nothing".
 *
 *  • THE `TWO OF TWO` NOTE ABOVE IS VINDICATED, NOT SUPERSEDED. It predicted no third and there
 *    was none; the literal now stands into a TENTH phase. The prediction keeps its force for the
 *    next author: a further re-capture is still a behaviour change to explain in its own plan.
 *    ⚠ It is also now known to be reachable — a definition that binds a name WILL move band 3's
 *    text node. Whoever gives this suite's fixture a `name` owes the re-capture, and owes it
 *    under the four-part procedure above (encoder validated first, capture driven twice, ONE
 *    changed line, per-band delta table), not as a paste.
 *
 * ── ⚠ RE-CAPTURE **THREE**, TAKEN DELIBERATELY BY `199-09` (DES-01 · sheet c10 §1 case 4) ──
 *
 * The `TWO OF TWO` note above is NOT overwritten and its force is NOT waived. It says a further
 * re-capture is *"a behaviour change to explain in its own plan, not a test to update"* — so this
 * is the explanation, and `199-09` is that plan. It is also NOT the trigger that note predicted:
 * the fixture still binds no `name`, and nobody gave it one. What moved is the TONE the fallback
 * arm is painted in.
 *
 *  • WHAT CHANGED, AND WHY IT IS A CHANGE AT ALL. `identityLabel` resolves `name → slug →
 *    "Untitled workflow"`, and until now painted all three arms identically. So a header
 *    reading `vendor-brief` in the same weight and colour as an authored name ASSERTED that the
 *    workflow was called `vendor-brief`, about a workflow nobody had named. Sheet c10 §1 case 4
 *    draws the empty-name case as a DIMMED stand-in; that is the finding, and this is it applied
 *    where it is true. The AUTHORED arm is untouched — measured, both arms, in one case.
 *
 *  • ⚠ IT IS **ONE CHANGED LINE AND ONE CHANGED TOKEN**, which is the whole reason it is
 *    auditable. `text-foreground` → `text-muted-foreground` inside band 3's identity span. The
 *    source side is spelled as a CONCATENATION precisely so the authored arm stays
 *    character-identical to what shipped, and so this diff could not be anything larger.
 *
 *      | band            | tag deltas | attribute deltas | non-empty text nodes |
 *      |-----------------|------------|------------------|----------------------|
 *      | 1 (breadcrumb)  | NONE       | NONE             | 3 → 3, identical     |
 *      | 2 (door band)   | NONE       | NONE             | 4 → 4, identical     |
 *      | 3 (save cluster)| NONE       | ONE class token  | 4 → 4, identical     |
 *
 *  • ⚠ THE PROOF THAT NO WORD MOVED IS NOT THIS TABLE — IT IS A SEPARATE, CLASS-FREE PIN.
 *    `199-09`'s `sheet c10 §1 — the header's RESTING atoms` captures both surfaces as text-node
 *    literals with every class discarded, was committed BEFORE this change, and passed UNEDITED
 *    after it. A byte pin cannot tell a colour change from a content change; that atom list can,
 *    and it is why this re-capture can be asserted to be presentation rather than merely claimed.
 *
 *  • THE PREDICTION THE `TWO OF TWO` NOTE MADE IS STILL LIVE FOR THE NEXT AUTHOR. Giving this
 *    fixture a `name` still owes a re-capture, and it would move the same span BACK to
 *    `text-foreground` while also moving its text node. That is a DIFFERENT re-capture from this
 *    one and still owes the four-part procedure.
 */
const FLAG_OFF_HEADER_MARKUP = [
  `<div class="flex items-center gap-3 border-b border-border px-4 py-2"><button type="button" data-testid="builder-back" class="rounded-md border border-border px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground">← Workflows</button><span class="text-[13px] font-medium text-foreground">Edit · Vendor brief v1</span><span data-testid="net-new-flag" title="Net-new surface — only GET /workflows/published + POST /workflows/{id}/publish are live today" class="rounded-full border border-accent-violet/40 bg-accent-violet/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase text-accent-violet">net-new</span></div>`,
  `<div class="flex items-center gap-3 border-b border-border px-4 py-2"><button type="button" data-testid="both-doors" class="px-1 py-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none">‹ Change how I start</button><span aria-hidden="true" class="mx-0.5 h-4 w-px bg-border"></span><span class="text-[13px] font-medium text-foreground">Build it myself</span><span data-testid="judge-locked" title="The llm_judge_rubric output-quality judge is the publish gauntlet's hard wall — it runs on EVERY tier and cannot be switched off (TIERS.judgeAlwaysOn)." class="ml-auto inline-flex items-center gap-1 rounded-full border border-accent-violet/40 bg-accent-violet/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-accent-violet"><span aria-hidden="true">🔒</span> judge always-on</span></div>`,
  `<header class="flex items-center justify-between border-b border-border px-4 py-2.5"><div class="flex min-w-0 items-center gap-2"><span class="min-w-0 truncate text-[14px] font-semibold text-muted-foreground">vendor-brief</span><span class="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">draft</span></div><div class="flex shrink-0 items-center gap-2"><div data-testid="builder-save-state" class="flex items-center gap-2"><button type="button" data-testid="builder-save-draft" class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-opacity hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60">Save draft</button></div><div><button type="button" data-testid="publish-trigger" class="rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90">◆ Publish…</button></div></div></header>`,
].join("\n")

describe("Builder header, canvas flag OFF — the markup itself is pinned", () => {
  it("matches the captured flag-off header byte for byte", async () => {
    const { container } = await openDraftBuilder(OFF_VARIANTS[0].value)
    expect(headerMarkup(screen.getByTestId("builder-grid"), container)).toBe(
      FLAG_OFF_HEADER_MARKUP,
    )
  })

  it("an OPERATOR-LIKE map produces the IDENTICAL markup (D-181-01, everyone included)", async () => {
    // Asserted as an equality against the same literal rather than as a second copied
    // literal — two literals can drift apart, and the sentence being proved is that
    // these two audiences receive the same bytes.
    const { container } = await openDraftBuilder(OFF_VARIANTS[2].value)
    expect(headerMarkup(screen.getByTestId("builder-grid"), container)).toBe(
      FLAG_OFF_HEADER_MARKUP,
    )
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Task 3 — THE FLAG-ON SIDE: one row, nothing lost, and it cannot silently regrow.
//
// Appended; nothing above this line was edited when the merge landed, which is itself
// the evidence that the flag gate held (D-184.1-01).
// ══════════════════════════════════════════════════════════════════════════════════

const FLAG_ON = { features: { visual_workflow_canvas: true }, loading: false } as const

describe("Builder header, canvas flag ON — ONE row (D-184.1-01)", () => {
  it("renders EXACTLY ONE header band where the flag-off surface renders three", async () => {
    const { container } = await openDraftBuilder(FLAG_ON)
    const bands = headerBandsAbove(screen.getByTestId("builder-grid"), container)
    expect(bands).toHaveLength(1)
    expect(bands[0].getAttribute("data-testid")).toBe("builder-header-bar")
  })

  it("every control from all three bands survives, reachable BY ACCESSIBLE NAME (D-184.1-02)", async () => {
    // The merge is a RE-FLOW, not a cull. Queried by ROLE + NAME rather than by testid on
    // purpose: a testid survives a control being turned into an unreachable div, and the
    // thing being promised here is that each of these is still an operable control a person
    // (or a screen reader) can find by the words on it.
    await openDraftBuilder(FLAG_ON)

    expect(screen.getByRole("button", { name: "← Workflows" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: STRIP_BACK })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save draft" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "◆ Publish…" })).toBeInTheDocument()

    // …and every badge and label rides along with them — nothing was dropped to make the
    // row fit, including the govern-door label (`strip.labelGovern`) the plan's row sketch
    // omitted. ⚠ Phase 193-08 RE-CAPTURE (2026-08-13, words only): that label was a glyph plus
    // the old door name and is now variant D's door name with NO glyph (D-23). The assertion
    // READS it off `doorVocabulary` and is NOT softened — it still names the exact shipped
    // label, which is the whole point of the row.
    const bar = screen.getByTestId("builder-header-bar")
    expect(bar).toHaveTextContent("Edit · Vendor brief v1")
    expect(bar).toHaveTextContent("vendor-brief")
    expect(bar).toHaveTextContent("draft")
    // ⚠ 193 REVIEW WR-06 — COMPARED WHOLE, NOT CONTAINED. This read
    // `expect(bar).toHaveTextContent(STRIP_LABEL_GOVERN)`, and `toHaveTextContent(string)` is a
    // SUBSTRING match. `doorVocabulary.ts` singles out this exact string: `STRIP_LABEL_GOVERN`
    // IS `DOOR_B_NAME` and is a strict PREFIX of `SWITCH_CTA`, so a containment check on it is
    // true of all three and "cannot identify a row at all". It passed only because this bar
    // happens to host neither of the other two — i.e. it was correct by accident, and would
    // have gone on passing if a door-B card or the switch CTA ever rendered into the bar. Its
    // sibling at `:260` was strengthened to `.toBe(STRIP_BACK)` in the same commit; this one
    // was missed. Now it finds the label's OWN node and compares the whole textContent.
    const governLabel = Array.from(bar.querySelectorAll("span")).find(
      (n) => n.textContent === STRIP_LABEL_GOVERN,
    )
    expect(governLabel, "the merged row no longer carries the govern-door label").toBeDefined()
    expect(bar.contains(screen.getByTestId("net-new-flag"))).toBe(true)
    expect(bar.contains(screen.getByTestId("judge-locked"))).toBe(true)
    expect(bar.contains(screen.getByTestId("builder-save-state"))).toBe(true)
    expect(bar.contains(screen.getByTestId("publish-trigger"))).toBe(true)
  })

  it("the ancestors stop drawing their own bands — the controls are IN the merged row", async () => {
    // The half a band count alone cannot see: `builder-back` and `both-doors` could both
    // still exist in their old bands while a fourth, merged row appeared beside them.
    await openDraftBuilder(FLAG_ON)
    const bar = screen.getByTestId("builder-header-bar")
    expect(bar.contains(screen.getByTestId("builder-back"))).toBe(true)
    expect(bar.contains(screen.getByTestId("both-doors"))).toBe(true)
    // One header element, still — 141-B's operator correction survives the merge.
    expect(screen.getAllByRole("banner")).toHaveLength(1)
  })

  it("the breadcrumb NEVER vanishes on a fresh build, where no draft header exists", async () => {
    // The regression this branch exists to prevent: with the flag on both ancestors stop
    // drawing their bands, and the describe/chooser screens have no header of their own —
    // so `← Workflows` would simply disappear and strand the author with no way back.
    render(
      <EffectiveFeaturesProvider value={{ ...FLAG_ON, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowsPage folders={[]} onLaunch={vi.fn()} />
        </div>
      </EffectiveFeaturesProvider>,
    )
    // 192-10 (D-02): the fresh-build entry is the TOOLBAR's create control now — the dashed
    // build-card was the first cell of the third grid and died with the shelves. The seam
    // this case actually guards (a fresh build must still reach the two-door chooser with a
    // breadcrumb back) is unchanged; only the affordance that opens it moved.
    fireEvent.click(await screen.findByTestId("library-create"))
    await screen.findByTestId("workflow-doors")
    expect(screen.getByRole("button", { name: "← Workflows" })).toBeInTheDocument()
  })
})

describe("Builder header — the band-count BUDGET (it cannot silently regrow)", () => {
  it("flag-on bands are strictly FEWER than flag-off bands, measured in one run", async () => {
    /**
     * jsdom REPORTS EVERY ELEMENT AS ZERO-HEIGHT — `getBoundingClientRect()` and
     * `offsetHeight` are 0 for everything here — so this budget is expressed in BANDS, not
     * pixels. That is the honest proxy: the reclaimed height is the sum of the rows that
     * stopped being drawn, and a row that is gone is gone at any viewport. The actual
     * ~90 px win at the ~900 px width that prompted the phase is an operator observation
     * and belongs in the phase's UAT, not in a jsdom suite.
     *
     * BOTH SIDES ARE MEASURED IN THE SAME RUN rather than compared against a hardcoded 3,
     * so the budget stays meaningful if the flag-off surface itself ever legitimately
     * changes — it is a relationship, not two numbers that can drift apart.
     */
    const off = await openDraftBuilder(OFF_VARIANTS[0].value)
    const flagOffBands = headerBandsAbove(
      screen.getByTestId("builder-grid"),
      off.container,
    ).length
    cleanup()

    const on = await openDraftBuilder(FLAG_ON)
    const flagOnBands = headerBandsAbove(screen.getByTestId("builder-grid"), on.container).length

    expect(flagOnBands).toBeLessThan(flagOffBands)
    expect(flagOffBands - flagOnBands).toBe(2)
  })
})

// ── THE GATE RULE HAS EXACTLY ONE DEFINITION (D-184.1-04) ─────────────────────────

/**
 * Three components now need the canvas gate, and three components each re-deriving a
 * three-part predicate is precisely the drift this project keeps getting bitten by. These
 * guards are what make three CALL SITES safe rather than merely allowed: one definition,
 * and the two ancestors reach it by import rather than by copy.
 */
describe("Builder header — the canvas gate is defined ONCE (D-184.1-04)", () => {
  const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1

  it("only WorkflowBuilderPage spells the rule out; the other two import it", () => {
    // The comparison literal is the rule's load-bearing half (the strict `=== true` that
    // makes an absent key HIDE). It must exist in exactly one source file.
    expect(occurrences(builderSource, "visual_workflow_canvas === true")).toBe(1)
    expect(workflowsPageSource).not.toMatch(/visual_workflow_canvas/)
    expect(doorSwitchSource).not.toMatch(/visual_workflow_canvas/)

    // …and the accessor itself is reached only through that one rule.
    expect(workflowsPageSource).not.toMatch(/useEffectiveFeaturesOptional/)
    expect(doorSwitchSource).not.toMatch(/useEffectiveFeaturesOptional/)
  })

  it("useCanvasGate is DEFINED once and IMPORTED where it is needed", () => {
    expect(occurrences(builderSource, "export function useCanvasGate")).toBe(1)
    expect(workflowsPageSource).not.toMatch(/function useCanvasGate/)
    expect(doorSwitchSource).not.toMatch(/function useCanvasGate/)
    // WorkflowsPage is the ancestor that had to start asking; the door shell deliberately
    // does NOT read the flag at all — it is handed the answer as `inline`, which is one
    // fewer place the gate can drift.
    expect(workflowsPageSource).toMatch(/useCanvasGate/)
    expect(doorSwitchSource).not.toMatch(/useCanvasGate/)
  })

  it("the merged row is reached ONLY through that gate — no second condition guards it", () => {
    expect(builderSource).toMatch(/const canvasEnabled = useCanvasGate\(\)/)
    // The spread-conditional that keeps the flag-off props genuinely ABSENT, on all three
    // sides. `rails` is the shipped precedent (D-14); the two header slots follow it.
    // Phase 185-08 widened the payload — `onGovernanceChange` rides the SAME conditional
    // rather than arriving as a second, unconditional prop — so the guard is anchored on
    // the CONDITIONAL and on `rails` leading it, not on the object being one key wide.
    // A governance prop that escaped the gate would still fail here.
    expect(builderSource).toMatch(/canvasEnabled \? \{ rails[,\s}]/)
    expect(builderSource).not.toMatch(/^\s*onGovernanceChange=\{/m)
    expect(workflowsPageSource).toMatch(/canvasEnabled \? \{ inline: true, headerLead/)
    expect(doorSwitchSource).toMatch(/inline \? \{ headerLead, headerTrail/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// 186-08 / F16 — THE BINDING IS A CONTROL, AND WHAT IT SAYS IS NEVER A VERDICT.
//
// BUG-260731-03 (severity `blocking`): a workflow's knowledge base could be chosen ONLY
// on the pre-draft describe screen. Two of the three creation paths never offered the
// choice at all, the default is whole-KB retrieval, and the only in-product repair was
// regeneration — which discards the authored canvas. D-186-15 promotes the shipped
// display-only `📁 <folder>` header chip into the picker that already exists.
//
// WHAT THIS BLOCK IS ACTUALLY GUARDING. The control half is the easy half. The dangerous
// half is D-186-16: the unbound state must state a CONSEQUENCE and claim NOTHING. A
// client-authored sentence that leaks into `blockedReason` makes an unbound workflow
// unpublishable — which is Phase 187's call under D-186-14, not this phase's — and a
// client that computes a severity or a code is the D-182-06 red line. So every case
// below measures the chip AGAINST A CONTROL RENDER rather than against a hardcoded
// expectation, and the source fence is proved in both directions before it is trusted.
//
// Appended; nothing above this line was edited when 186-08 landed. The flag-off markup
// pin at the top of this file therefore still passes UNEDITED, which is the evidence
// that the promoted control is gated (see the SUMMARY's D-181-01 note).
// ══════════════════════════════════════════════════════════════════════════════════

import { UNBOUND_KB_INVITATION } from "./WorkflowBuilderPage"
import phaseFormPanelSource from "@/components/workflows/PhaseFormPanel?raw"
import apiSource from "@/lib/api?raw"
import nodePresentationSource from "@/components/workflows/nodePresentation?raw"

const FOLDER_ID = "75755ec9-5ba7-495b-ad93-7500011cf6f2"
const FOLDER_NAME = "Project Meridian — Risks"

/** The same draft, BOUND — the control every neutrality case is measured against. */
const boundDraftRow = {
  ...draftRow,
  definition: { ...definition, project_folder_id: FOLDER_ID },
}

/** A draft with NO steps — the shipped `EMPTY_DRAFT_INVITATION` path, used purely as a
 *  SENSITIVITY CONTROL: it proves `publishReading()` below can actually detect a reason
 *  reaching the publish seam, so "the two readings are equal" means something. */
const emptyDraftRow = { ...draftRow, definition: { ...definition, phases: [] } }

/** What the promoted chip actually SAYS — the SELECTED option's words.
 *  Not `textContent`: a `<select>` carries every choice it offers in its text, so the
 *  whole-chip reading would claim the surface says "No knowledge base · searches
 *  everything" even while a folder is bound. */
function chipReading(): string {
  const sel = screen.getByTestId("project-folder-picker") as HTMLSelectElement
  return sel.options[sel.selectedIndex]?.textContent ?? ""
}

/** Every element whose OWN text is the invitation. Used to prove the sentence renders in
 *  exactly ONE place on the whole surface — the assertion "it is not in the tray" cannot
 *  make on its own, because it would pass for a tray that simply is not mounted. */
function invitationSites(container: Element): Element[] {
  return Array.from(container.querySelectorAll("*")).filter(
    (el) => el.children.length === 0 && (el.textContent ?? "").includes(UNBOUND_KB_INVITATION),
  )
}

/** The publish seam's rendered state, as one comparable string. `blockedReason` reaches
 *  the DOM as `disabled` + `aria-describedby` on the trigger and as a sibling reason
 *  element, so this reading changes the moment anything joins it. */
function publishReading(): string {
  const trigger = screen.getByTestId("publish-trigger")
  const reasons = screen.queryAllByTestId("publish-blocked-reason")
  return [
    normalise(trigger.outerHTML).replace(/aria-describedby="[^"]*"/, 'aria-describedby="«id»"'),
    `reasons=${reasons.length}`,
    reasons.map((r) => normalise(r.textContent ?? "")).join("|"),
    `tray=${screen.queryAllByTestId("problems-tray-message").length}`,
  ].join(" · ")
}

/** Comments stripped, so a fence over CODE cannot be tripped by the prose that explains
 *  it. The `useGroundingBundle.test.ts:294-316` warning, applied: a blanket grep would
 *  forbid the constant's own docblock from naming the very seams it exists to stay out
 *  of. Line comments are matched only at line start, so a `//` inside a string survives. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ")
}

/** TRUE when the invitation has escaped the chip into the verdict surface — inside the
 *  `blockedReason` memo, or on a line of code that also names the verdict vocabulary. */
function invitationEscapes(src: string): boolean {
  const code = stripComments(src)
  const anchor = code.indexOf("const blockedReason = useMemo")
  if (anchor === -1) return true // the anchor moved: fail CLOSED rather than pass blind
  const memoBody = code.slice(anchor, anchor + code.slice(anchor).indexOf("}, ["))
  if (memoBody.includes("UNBOUND_KB_INVITATION")) return true
  return code
    .split("\n")
    .some(
      (line) =>
        line.includes("UNBOUND_KB_INVITATION") &&
        /verdicts|groupVerdicts|blockedReason|severity/.test(line),
    )
}

describe("186-08 / F16 — the KB binding is a CONTROL on the built canvas (D-186-15)", () => {
  it("an UNBOUND drafted workflow says what unbound MEANS", async () => {
    await openDraftBuilder(FLAG_ON)
    expect(chipReading()).toContain(UNBOUND_KB_INVITATION)
    // The consequence, not the state — pinned as a literal exactly ONCE, here, so a
    // re-wording has to be deliberate. "Unbound" sounds harmless; this is what happens.
    expect(UNBOUND_KB_INVITATION).toBe("No knowledge base · searches everything")
  })

  it("the chip IS the picker — one control, and the author can reach it after drafting", async () => {
    mockListFolders.mockResolvedValue([{ id: FOLDER_ID, name: FOLDER_NAME }])
    await openDraftBuilder(FLAG_ON)
    const picker = (await screen.findByTestId("project-folder-picker")) as HTMLSelectElement
    expect(picker.tagName).toBe("SELECT")
    expect(picker.value).toBe("")
    // Every folder the author can reach is offered, and so is "none".
    await waitFor(() =>
      expect(Array.from(picker.options).map((o) => o.value)).toEqual(["", FOLDER_ID]),
    )
  })

  it("a BOUND workflow reads its folder NAME, never a UUID, and stops inviting", async () => {
    mockListFolders.mockResolvedValue([{ id: FOLDER_ID, name: FOLDER_NAME }])
    mockListDrafts.mockResolvedValue([boundDraftRow])
    const { container } = await openDraftBuilder(FLAG_ON)
    await waitFor(() => expect(chipReading()).toBe(FOLDER_NAME))
    expect(chipReading()).not.toContain(FOLDER_ID)
    expect(invitationSites(container)).toHaveLength(1) // the offered option, unselected
    expect(chipReading()).not.toContain(UNBOUND_KB_INVITATION)
  })

  it("choosing a knowledge base WRITES the binding and ARMS the guard (F14, page level)", async () => {
    // The whole chain in one assertion: the call site reaches `setProjectFolder` (which
    // writes `meta.project_folder_id` AND `dirty` in one act, 186-04), the armed `dirty`
    // opens the autosave loop's gate (186-06), and the binding lands on the wire through
    // the very save path this phase rebuilt. A binding that did not arm `dirty` would
    // never be written and this would time out.
    mockListFolders.mockResolvedValue([{ id: FOLDER_ID, name: FOLDER_NAME }])
    mockUpdate.mockResolvedValue({ id: "draft-1", version: 1, token: "tok-2" })
    await openDraftBuilder(FLAG_ON)
    fireEvent.change(await screen.findByTestId("project-folder-picker"), {
      target: { value: FOLDER_ID },
    })
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled(), { timeout: 5000 })
    const body = mockUpdate.mock.calls[0][1] as { project_folder_id?: string }
    expect(body.project_folder_id).toBe(FOLDER_ID)
  })
})

describe("186-08 / F16 — the invitation is an INVITATION, never a verdict (D-186-16)", () => {
  it("renders in exactly ONE place on the whole surface — the chip", async () => {
    const { container } = await openDraftBuilder(FLAG_ON)
    const sites = invitationSites(container)
    expect(sites).toHaveLength(1)
    expect(sites[0].tagName).toBe("OPTION")
    expect(sites[0].closest("select")?.getAttribute("data-testid")).toBe("project-folder-picker")
  })

  it("leaves the verdict surface BYTE-IDENTICAL to a bound control render", async () => {
    // Measured against a control render rather than against a hardcoded expectation: the
    // question is not "is the publish seam blocked" (it is not, in either) but "does being
    // unbound CHANGE anything the verdict surface says". The tray count rides along; in
    // the spine view it is 0 on both sides, and the load-bearing half of this comparison
    // is the publish seam, which is where an escaped sentence would actually surface.
    mockListFolders.mockResolvedValue([{ id: FOLDER_ID, name: FOLDER_NAME }])
    mockListDrafts.mockResolvedValue([boundDraftRow])
    await openDraftBuilder(FLAG_ON)
    const bound = publishReading()
    cleanup()

    mockListDrafts.mockResolvedValue([draftRow])
    await openDraftBuilder(FLAG_ON)
    expect(publishReading()).toBe(bound)
    expect(publishReading()).not.toContain(UNBOUND_KB_INVITATION)
  })

  it("that comparison is a REAL measurement — a shipped reason DOES change the reading", async () => {
    // The positive control for the case above. `EMPTY_DRAFT_INVITATION` is the shipped
    // path that legitimately reaches `blockedReason`, so if the reading could not tell
    // these two apart it would be measuring nothing.
    mockListDrafts.mockResolvedValue([draftRow])
    await openDraftBuilder(FLAG_ON)
    const normal = publishReading()
    cleanup()

    mockListDrafts.mockResolvedValue([emptyDraftRow])
    await openDraftBuilder(FLAG_ON)
    const blocked = publishReading()
    expect(blocked).not.toBe(normal)
    expect(blocked).toContain("Add a step to get started")
  })

  it("carries NO severity word and NO severity tone — read out of the shipped sources", async () => {
    // The vocabulary is EXTRACTED, never retyped: a token renamed in the product renames
    // it here in the same commit, and a fence that has drifted from the thing it fences
    // is worse than none.
    // The WORDS: the wire union, from the `Verdict` type in the API client.
    const union = /severity:\s*((?:"[a-z_]+"\s*\|\s*)*"[a-z_]+")/.exec(apiSource)?.[1] ?? ""
    const severityWords = [...union.matchAll(/"([a-z_]+)"/g)].map((m) => m[1])
    // The TONES: the paint the HARD severity wears, from `VERDICT_MARK.error`. Only the
    // hard mark — the soft one is deliberately painted in the neutral tokens this chip
    // also uses, so asserting against those would forbid the chip from being quiet.
    const errorMark = nodePresentationSource.slice(
      nodePresentationSource.indexOf("  error: {"),
      nodePresentationSource.indexOf("  incomplete: {"),
    )
    const severityTones = (/className:\s*"([^"]+)"/.exec(errorMark)?.[1] ?? "")
      .split(/\s+/)
      .filter((t) => t.includes("-") && t !== "border-border")
    // The extraction itself is controlled — an empty vocabulary would make every
    // assertion below vacuously true.
    expect(severityWords.length).toBeGreaterThan(0)
    expect(severityTones.length).toBeGreaterThan(0)

    await openDraftBuilder(FLAG_ON)
    const chip = screen.getByTestId("builder-bound-folder")
    const said = chipReading()
    const painted = chip.outerHTML
    for (const word of severityWords) expect(said).not.toContain(word)
    for (const tone of severityTones) expect(painted).not.toContain(tone)
  })
})

describe("186-08 / F16 — the source fence, proved in BOTH directions", () => {
  it("the invitation never enters blockedReason, verdicts or groupVerdicts", () => {
    expect(invitationEscapes(builderSource)).toBe(false)
  })

  it("the fence FINDS a planted escape (the positive control)", () => {
    const planted = builderSource.replace(
      "if (phases.length === 0) return EMPTY_DRAFT_INVITATION",
      "if (phases.length === 0) return UNBOUND_KB_INVITATION",
    )
    expect(planted).not.toBe(builderSource) // the plant actually landed
    expect(invitationEscapes(planted)).toBe(true)
  })

  it("and LEAVES the constant's own docblock alone (the negative control)", () => {
    // The real source already contains a docblock line naming BOTH the constant and
    // `blockedReason` — that line is why this fence strips comments, and the case above
    // passing on the real source is the proof. Restated synthetically so the control is
    // legible even if the docblock is later reworded.
    const proseOnly = [
      "/**",
      " * `UNBOUND_KB_INVITATION` must never join `blockedReason`, enter `verdicts`,",
      " * reach `groupVerdicts` or carry a `severity`. It is a fact, not a finding.",
      " */",
      'export const UNBOUND_KB_INVITATION = "No knowledge base · searches everything"',
      "const blockedReason = useMemo(() => {",
      "  if (phases.length === 0) return EMPTY_DRAFT_INVITATION",
      "  return null",
      "}, [phases])",
    ].join("\n")
    expect(invitationEscapes(proseOnly)).toBe(false)
  })
})

describe("186-08 — the UNBIND premise: no authoring control writes folder_scope", () => {
  it("PhaseFormPanel renders folder_scope, and writes it nowhere (D-186-17, unbind half)", () => {
    // The whole unbind decision rests on this. A phase declaring `folder_scope` on a
    // workflow with no `project_folder_id` raises a raw 422 at the shape tier
    // (`_folder_scope_requires_project`), which under D-186-04's hold-the-write rule
    // would leave a permanently unsaveable draft. Unbinding is therefore allowed and
    // proven UNREACHABLE-to-harm rather than refused client-side — a client-side refusal
    // would be the client computing a validation rule, which D-182-06 forbids.
    const code = stripComments(phaseFormPanelSource)
    // It is genuinely there, as a READ — otherwise this test would pass on a file that
    // had simply stopped mentioning the field.
    expect(code).toMatch(/cfg\.folder_scope/)
    // …and nowhere as a WRITE, in any of the three shapes this panel spells a write in.
    expect(code).not.toMatch(/set\(\s*["']folder_scope["']\s*\)/)
    expect(code).not.toMatch(/onChange\(\s*\{[^}]*folder_scope/)
    expect(code).not.toMatch(/folder_scope\s*:/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Nyquist gap-closure round — two D-184.1 claims recorded in prose only, now asserted.
//
// Appended; nothing above this line was edited.
// ══════════════════════════════════════════════════════════════════════════════════

// GAP-2 (D-184.1-04's non-breach half): the fetching hook's source and the ONE
// docblock that legitimately NAMES its call without making it (the negative control).
import appSource from "@/App?raw"
import effectiveFeaturesProviderSource from "@/providers/EffectiveFeaturesProvider?raw"

// ── GAP-1 — D-184.1-03: the merged row also appears on the SPINE view ──────────────
//
// The decision reads: "with the flag ON the merged header also appears in the Spine
// view; permitted because D-181-01 constrains flag-OFF only, and recorded as a
// decision rather than discovered." Nothing above asserted it — every flag-ON case
// earlier in this file opens a draft and reads the header without ever driving the
// [≣ Spine] / [⬡ Canvas] tablist, so a regression that made the merged row
// TAB-CONDITIONAL (rendered on Canvas but silently dropped back to three bands on
// Spine) would ship green through every one of them.

describe("Builder header, canvas flag ON — the merged row also appears on Spine (D-184.1-03)", () => {
  it("driving the Spine tab explicitly still renders ONE merged band with every control", async () => {
    const { container } = await openDraftBuilder(FLAG_ON)

    // Spine is ALREADY the default landing view — `graphView` cold-starts at "spine"
    // (D-183-02), so every flag-on case earlier in this file already exercises it
    // INCIDENTALLY, never by driving the tab. Driven here EXPLICITLY instead, through
    // the real tab control, so this case keeps its meaning if that default ever flips.
    const spineTab = screen.getByTestId("builder-view-spine")
    expect(spineTab.getAttribute("aria-selected")).toBe("true")
    fireEvent.click(spineTab)
    expect(screen.getByTestId("builder-view-spine").getAttribute("aria-selected")).toBe("true")
    expect(screen.getByTestId("builder-view-canvas").getAttribute("aria-selected")).toBe("false")

    const bands = headerBandsAbove(screen.getByTestId("builder-grid"), container)
    expect(bands).toHaveLength(1)
    expect(bands[0].getAttribute("data-testid")).toBe("builder-header-bar")

    // Every control from all three original bands is still reachable, on the Spine view.
    const bar = screen.getByTestId("builder-header-bar")
    expect(bar.contains(screen.getByTestId("builder-back"))).toBe(true)
    expect(bar.contains(screen.getByTestId("both-doors"))).toBe(true)
    expect(bar.contains(screen.getByTestId("builder-save-state"))).toBe(true)
    expect(bar.contains(screen.getByTestId("publish-trigger"))).toBe(true)
    expect(bar.contains(screen.getByTestId("net-new-flag"))).toBe(true)
    expect(bar.contains(screen.getByTestId("judge-locked"))).toBe(true)
    expect(screen.getByRole("button", { name: "← Workflows" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: STRIP_BACK })).toBeInTheDocument()
  })
})

// ── GAP-2 — D-184.1-04's non-breach half: the fetching hook has ONE call site ──────
//
// The decision's load-bearing claim: "the fetching `useEffectiveFeatures()` has ZERO
// non-test call sites — the single FETCH in `App.tsx` is unchanged." True on
// measurement today, but nothing above pinned it — a future component adding its OWN
// fetch is the exact flash-then-shift D-183-03 forbids, and it would ship green
// through every case above.

describe("Builder header — useEffectiveFeatures() has ZERO non-test call sites beyond App.tsx (D-184.1-04)", () => {
  /** Call-EXPRESSION occurrences, comments stripped — reusing this file's own
   *  `stripComments` (already used above for the KB-invitation source fence) so a
   *  docblock that merely NAMES the hook is never mistaken for a second call site. */
  const callSites = (src: string) => (stripComments(src).match(/useEffectiveFeatures\(/g) ?? []).length

  it("App.tsx is the fetch's ONLY call site", () => {
    expect(callSites(appSource)).toBe(1)
  })

  it("the three band owners never call the fetching hook — they read the broadcast context instead", () => {
    expect(callSites(workflowsPageSource)).toBe(0)
    expect(callSites(doorSwitchSource)).toBe(0)
    // `WorkflowBuilderPage.tsx`'s OWN docblock spells `useEffectiveFeatures()` (empty
    // parens) while crediting App.tsx with the one fetch — the same trap as the
    // provider's negative control below, caught here on the file this suite already
    // imports as `builderSource` for the D-184.1-04 gate-defined-once guards above.
    expect(callSites(builderSource)).toBe(0)
  })

  it("NEGATIVE CONTROL — the provider's own docblock spells the call and must NOT be counted", () => {
    // `EffectiveFeaturesProvider.tsx`'s docblock literally contains the substring
    // `useEffectiveFeatures(user?.id ?? null)` while explaining why App owns the one
    // call — proof the fence is measured against real prose, not a synthetic stand-in.
    expect(effectiveFeaturesProviderSource).toMatch(/useEffectiveFeatures\(user\?\.id/)
    expect(callSites(effectiveFeaturesProviderSource)).toBe(0)
    // Its TYPE-ONLY import of the hook's return-shape interface is not a call either —
    // read directly rather than assumed, per the gap's instruction.
    expect(effectiveFeaturesProviderSource).toMatch(/import type \{ UseEffectiveFeatures \}/)
  })

  it("POSITIVE CONTROL — a planted second call site is actually found", () => {
    // ⚠ THE ANCHOR IS THE DECLARATION, NOT ITS PARAMETER LIST, AND THAT WAS LEARNED THE
    // useful way. It used to be the whole signature spelled out verbatim
    // (`({ folders, onLaunch }: WorkflowsPageProps)`), and SEED-190 added a third prop to that
    // page — so the plant stopped landing, the control could no longer prove anything, and
    // this case went RED. That is the `not.toBe` line below doing exactly its job: a positive
    // control whose plant silently misses is a fence that has quietly stopped being one.
    //
    // Re-anchored on `export function WorkflowsPage(`, which is what this control is really
    // about — a call site planted INSIDE that component — and which cannot move without the
    // component being renamed.
    const anchor = "export function WorkflowsPage("
    expect(workflowsPageSource).toContain(anchor)
    const bodyStart =
      workflowsPageSource.indexOf(") {", workflowsPageSource.indexOf(anchor)) + ") {".length
    const planted =
      workflowsPageSource.slice(0, bodyStart) +
      '\n  const leak = useEffectiveFeatures("planted")' +
      workflowsPageSource.slice(bodyStart)
    expect(planted).not.toBe(workflowsPageSource) // the plant actually landed
    expect(callSites(planted)).toBe(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// 197-10 (D-19) — THE IDENTITY SLOT: the NAME when there is one, the SLUG when there
// is not, and the SLUG again when the name is empty.
//
// WHY THESE CASES EXIST. Before `197-10` the header rendered `meta.slug` and the
// workflow's name was displayed NOWHERE on this page, so shipping the arrival card's
// editable name row would have put `northwind-qbr-fa65a43c` in the header against
// `Northwind QBR` in the card, on one screen. The slot now prefers the name.
//
// ⚠ THE FIRST CASE IS ALSO THE POSITIVE CONTROL FOR THE BYTE PIN'S DISPOSITION. The
// re-capture note below records that `FLAG_OFF_HEADER_MARKUP` band 3 did NOT move
// under this change. That claim is only worth anything if the slot is LIVE — a dead
// expression would leave the pin green too, and say nothing. This case drives the
// same flag-off surface with a definition that DOES bind a name and reads the name
// back out of the slot, so the unmoved pin is provably a fact about the FIXTURE and
// not about a code path that never runs.
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * The identity slot itself — the first `<span>` of the flag-off `<header>` band, read
 * positionally off the rendered tree rather than by a testid, because this plan is
 * forbidden from adding a node or an attribute to that span (the byte pin sees it).
 */
function identitySlot(grid: Element, root: Element): Element {
  const header = headerBandsAbove(grid, root).find((band) => band.tagName === "HEADER")
  if (header === undefined) throw new Error("no <header> band above the grid")
  const slot = header.querySelector("span")
  if (slot === null) throw new Error("the <header> band carries no identity span")
  return slot
}

/**
 * Open the Builder over a definition of the caller's choosing. `beforeEach` re-arms
 * `mockListDrafts` with the shared `draftRow` on every case, so overriding it here is
 * scoped to one test and cannot leak into the byte pin.
 *
 * ⚠ The ROW's `name` ("Vendor brief") and the DEFINITION's `name` are different things
 * and only the second one reaches `meta`. The row's name feeds the breadcrumb; the
 * definition is what the store loads. Conflating them is the trap this helper avoids.
 */
async function openDraftWithDefinition(
  overrides: Record<string, unknown>,
  // `| null` mirrors `openDraftBuilder`'s own signature — `OFF_VARIANTS[].value` is
  // declared nullable (the "no provider at all" variant), so narrowing it here would
  // reject this function's own default argument.
  value: { features: EffectiveFeatures; loading: boolean } | null = OFF_VARIANTS[0].value,
) {
  mockListDrafts.mockResolvedValue([{ ...draftRow, definition: { ...definition, ...overrides } }])
  return openDraftBuilder(value)
}

describe("197-10 / D-19 — the drafted header's identity slot", () => {
  it("renders the NAME, not the slug, when the definition binds one (flag OFF)", async () => {
    const { container } = await openDraftWithDefinition({ name: "Northwind QBR" })
    const slot = identitySlot(screen.getByTestId("builder-grid"), container)
    expect(slot.textContent).toBe("Northwind QBR")
    // Stated in both directions: the name is not merely PRESENT, the slug is GONE from
    // the slot. A containment-only assertion would pass on a slot rendering both.
    expect(slot.textContent).not.toContain("vendor-brief")
  })

  it("renders the SLUG when the definition binds no name at all (flag OFF)", async () => {
    // This is the byte pin's own fixture, driven through the same door — which is why
    // band 3 below is unmoved.
    const { container } = await openDraftWithDefinition({})
    expect(identitySlot(screen.getByTestId("builder-grid"), container).textContent).toBe(
      "vendor-brief",
    )
  })

  it("renders the SLUG when the name is the EMPTY STRING — 197-10's declared display fallback", async () => {
    // ⚠ A NAMED DEVIATION from D-19's literal `meta.name ?? meta.slug`, pinned here so it
    // cannot be "tidied" back into a coalesce by a later author. The arrival card's name
    // row neither trims nor rejects the empty string (the server owns emptiness), so a
    // coalesce would show an author who cleared the field a BLANK identity slot. This is
    // a display fallback and nothing else: no store action, no request and no predicate
    // reads it.
    const { container } = await openDraftWithDefinition({ name: "" })
    expect(identitySlot(screen.getByTestId("builder-grid"), container).textContent).toBe(
      "vendor-brief",
    )
  })

  it("D-15 — the slug is STILL in the definition the store would persist, at the same beat the header shows the name", async () => {
    // The point of D-15 is that the slug — the key identity forks and versioning use —
    // is UNTOUCHED by naming. A DOM assertion cannot prove that: once the slot prefers
    // the name, the slug appears nowhere on screen, so its absence from the DOM is
    // exactly what this change is supposed to cause. So it is read off the store instead,
    // through the store's one observable export path — the definition the save loop puts
    // on the wire (`selectDefinition`), driven by the shipped folder-binding write that
    // `186-04`'s case next door already uses.
    mockListFolders.mockResolvedValue([{ id: FOLDER_ID, name: FOLDER_NAME }])
    mockUpdate.mockResolvedValue({ id: "draft-1", version: 1, token: "tok-2" })
    await openDraftWithDefinition({ name: "Northwind QBR" }, FLAG_ON)

    // The header is showing the NAME on this same render.
    expect(screen.getByTestId("builder-header-bar").textContent ?? "").toContain("Northwind QBR")

    fireEvent.change(await screen.findByTestId("project-folder-picker"), {
      target: { value: FOLDER_ID },
    })
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled(), { timeout: 5000 })
    const body = mockUpdate.mock.calls[0][1] as { slug?: string; name?: unknown }
    expect(body.slug).toBe("vendor-brief")
    // And the name rode along unchanged — the display reads the store, it does not
    // rewrite it.
    expect(body.name).toBe("Northwind QBR")
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// 199-09 Task 1 (DES-01 · sheet `c10-builder-chrome`) — THE PRE-CHANGE RESTING
// INVENTORY OF THE BUILDER CHROME, AND THE SHEET RECONCILIATION.
//
// ⚠ WHY AN ATOM LIST BESIDE A BYTE PIN THAT ALREADY EXISTS. `FLAG_OFF_HEADER_MARKUP`
// above proves the BYTES; it cannot tell a class change apart from a word change, so it
// answers "did anything move?" and never "did what a PERSON reads move?". Task 2 makes a
// deliberate, stated presentation change to band 3's identity span — and the only thing
// that can prove that change is PRESENTATION rather than content is a class-free reading
// of the same surface, captured BEFORE it. That is what these atom lists are for, and it
// is why they are the control the re-baseline is judged against rather than a duplicate
// of the pin.
//
// ⚠ EVERYTHING HERE IS PINNED **PRESENT**, INCLUDING THE THINGS THIS PLAN CHANGES. Where
// the sheet takes an atom away, Task 2/3 INVERTS the assertion (present → absent) rather
// than deleting the query. Zero assertion deletions is the target; a deleted query proves
// nothing and leaves no evidence that the surface ever carried the atom.
//
// ⚠ jsdom RUNS NO LAYOUT. `clientHeight` and `getBoundingClientRect()` return 0, so a
// "the controls did not get pushed off the row" measurement here would read `0 − 0` and
// pass on any markup at all. Sheet §1 case 5 is therefore measured through a STATED
// STRUCTURAL SURROGATE (the shrink/wrap/min-w contract), and the real check is an owed
// G-4 row named in this plan's SUMMARY.
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Every non-empty text node under `root`, whitespace-collapsed, in document order — what a
 * person READS, with every class, testid and attribute discarded. The 199-08 "class-free
 * reading" idiom: a comparison that cannot be satisfied by a colour and cannot be broken
 * by one.
 */
function restingAtoms(root: Element): string[] {
  const out: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node !== null) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim()
    if (text !== "") out.push(text)
    node = walker.nextNode()
  }
  return out
}

/** The atoms of every band stacked above the flow, outermost band first. */
function headerAtoms(grid: Element, root: Element): string[] {
  return headerBandsAbove(grid, root)
    .reverse()
    .flatMap((band) => restingAtoms(band))
}

/**
 * Every source this reconciliation sweeps, with the NON-VACUITY floor asserted before any
 * absence claim is made against it. A `?raw` import that silently resolved to `""` would
 * make every absence assertion below pass while measuring nothing.
 */
const C10_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ["WorkflowBuilderPage.tsx", builderSource],
  ["BuilderHeaderBar.tsx", headerBarSource],
  ["BuilderSaveRegion.tsx", saveRegionSource],
  ["PublishGauntlet.tsx", publishGauntletSource],
  ["ProblemsTray.tsx", problemsTraySource],
  ["StepTypePicker.tsx", stepPickerSource],
  ["useTemplateFirstDraft.ts", templateFirstDraftSource],
]

/** The detector every sweep below uses, so the positive controls exercise the REAL one. */
const carries = (source: string, needle: string) => source.includes(needle)

describe("199-09 / sheet c10 — the sources are readable before anything is claimed absent", () => {
  it.each(C10_SOURCES)("%s loaded with real content through ?raw", (_name, source) => {
    expect(source.length).toBeGreaterThan(500)
    // Shape, not just length: a stub that happened to be long would still be wrong.
    expect(source).toMatch(/\/\*\*/)
  })

  it("POSITIVE CONTROL — the detector actually fires on a needle that IS present", () => {
    // Driven against a string this test owns, so the control cannot be broken by an edit
    // to a shipped file and cannot be satisfied by one either.
    expect(carries("nothing here but a Save failed — Check connection line", "Save failed")).toBe(true)
    expect(carries("nothing here at all", "Save failed")).toBe(false)
  })
})

// ── §1 THE HEADER BAR — the five sheet cases ──────────────────────────────────────

describe("199-09 / sheet c10 §1 — the header's RESTING atoms, pinned as literals", () => {
  it("flag OFF: the three bands read exactly these words, in this order", async () => {
    const { container } = await openDraftBuilder(OFF_VARIANTS[0].value)
    expect(headerAtoms(screen.getByTestId("builder-grid"), container)).toEqual([
      "← Workflows",
      "Edit · Vendor brief v1",
      "net-new",
      STRIP_BACK,
      STRIP_LABEL_GOVERN,
      "🔒",
      "judge always-on",
      // ⚠ THE IDENTITY SLOT, AND IT IS A FALLBACK: this fixture's definition binds no
      // `name`, so what a person reads here is the SLUG. Task 2 changes how that reads,
      // not what it says — this line is what proves the second half of that sentence.
      "vendor-brief",
      "draft",
      "Save draft",
      "◆ Publish…",
    ])
  })

  it("flag ON: the merged row reads exactly these words, in this order", async () => {
    const { container } = await openDraftBuilder(FLAG_ON)
    // ⚠ SETTLE THE FIRST VALIDATION BEFORE CAPTURING, and the reason is a real finding
    // rather than test hygiene: on the flag-ON surface the publish refusal is LIVE in the
    // merged row, and before the first check answers `blockedReason` is the never-ran
    // sentence — so an unsettled capture pins a transient. `publish-blocked-reason` going
    // absent is the check having answered `ok`. §3's refusal reading is driven
    // DELIBERATELY in its own case below rather than caught in a race here.
    await waitFor(() => expect(screen.queryByTestId("publish-blocked-reason")).toBeNull(), {
      timeout: 4000,
    })
    expect(headerAtoms(screen.getByTestId("builder-grid"), container)).toEqual([
      "← Workflows",
      "Edit · Vendor brief v1",
      "net-new",
      "vendor-brief",
      "draft",
      // ⚠ The merged row says MORE than the flag-off one, and the extra readings are
      // all INSIDE `identityGroup` (D-186-15's KB chip, 197's requirement field, and 205's Living Register toggle),
      // not extra bands — `headerBandsAbove` still returns exactly one. That distinction is
      // the whole of D-184.1-01 and is asserted separately above.
      "📁",
      "No knowledge base · searches everything",
      "✎",
      "○",
      "Living Register",
      STRIP_BACK,
      STRIP_LABEL_GOVERN,
      "🔒",
      "judge always-on",
      "Save draft",
      "Test Run",
      "◆ Publish…",
    ])
  })
})

describe("199-09 / sheet c10 §1 — the identity slot's three arms (197-10 / D-19 is ALREADY-SHIPPED)", () => {
  // The NAME arm and the SLUG arm are covered by `197-10 / D-19` above and are NOT
  // rebuilt here. What this block adds is the THIRD arm — no name AND no slug — which
  // nothing covered, and which is the arm sheet §1 case 4 is actually about.
  it("no name AND no slug reaches the shipped terminal fallback", async () => {
    const { container } = await openDraftWithDefinition({ slug: undefined })
    expect(identitySlot(screen.getByTestId("builder-grid"), container).textContent).toBe(
      "Untitled workflow",
    )
  })

  it("✅ INVERTED BY TASK 2 — a fallback now READS as a fallback, and an authored name does not", async () => {
    // ⚠ THE POLARITY OF THESE TWO LINES IS FLIPPED, NOT DELETED. Task 1 captured this
    // surface asserting `text-foreground` PRESENT and `text-muted-foreground` ABSENT; the
    // queries are the same queries. That is what makes the removal provable — a deleted
    // assertion would leave no evidence the surface ever painted a stand-in like a name.
    //
    // Sheet §1 case 4's finding: the empty-name case must degrade to a DIMMED fallback,
    // never to blank. Ours already degraded to a fallback rather than to blank; what it
    // did NOT do was let a person tell the two apart, so the header asserted "this
    // workflow is called vendor-brief" about a workflow nobody had named.
    const fallback = await openDraftWithDefinition({})
    const fallbackSlot = identitySlot(screen.getByTestId("builder-grid"), fallback.container)
    expect(fallbackSlot.textContent).toBe("vendor-brief")
    expect(fallbackSlot.className).toContain("text-muted-foreground")
    expect(fallbackSlot.className).not.toContain(" text-foreground")
    cleanup()

    // …and the AUTHORED arm is untouched, which is the half that makes the change mean
    // anything. Both arms in one case: a dimmed-everything header would satisfy the first
    // assertion alone and would say strictly less than the one that shipped.
    const named = await openDraftWithDefinition({ name: "Northwind QBR" })
    const namedSlot = identitySlot(screen.getByTestId("builder-grid"), named.container)
    expect(namedSlot.textContent).toBe("Northwind QBR")
    expect(namedSlot.className).toContain("text-foreground")
    expect(namedSlot.className).not.toContain("text-muted-foreground")
  })

  it("the terminal fallback is dimmed too — it names the workflow least of all three", async () => {
    const { container } = await openDraftWithDefinition({ slug: undefined })
    const slot = identitySlot(screen.getByTestId("builder-grid"), container)
    expect(slot.textContent).toBe("Untitled workflow")
    expect(slot.className).toContain("text-muted-foreground")
  })

  it("⚠ THE TONE IS NOT THE CARRIER — the fallback is still legible as TEXT (WCAG 1.4.1)", async () => {
    // Colour may never be the only thing that distinguishes two readings. Here it is the
    // SECOND carrier: the first is that a fallback is a slug or the literal words
    // "Untitled workflow", neither of which is a name anybody typed. Asserted class-free
    // so a person reading with no colour at all still receives the whole distinction.
    const { container } = await openDraftWithDefinition({})
    expect(restingAtoms(identitySlot(screen.getByTestId("builder-grid"), container))).toEqual([
      "vendor-brief",
    ])
  })

  it("the tone reads a DISPLAY answer and no rule learns anything from it (D-19 preserved)", () => {
    // 197-10's binding constraint: the non-empty check is a display fallback, not a
    // validation rule. This plan hoists that check into `authoredName` and spends it in a
    // second render position — so the thing to guard is that it is still spent NOWHERE
    // else. No store action, no request and no predicate may consult it.
    // ⚠ COMMENT LINES ARE EXCLUDED, AND THAT IS DELIBERATE. The docblock above the
    // expression names `authoredName` twice while explaining why it may not spread; a
    // counter that included prose would go red against the very paragraph that states the
    // rule, and `199-08`'s lesson is that a fence which forbids explaining itself is a
    // fence somebody deletes.
    const codeUses = builderSource
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\/)/.test(line))
      .filter((line) => line.includes("authoredName"))
    // The declaration, the label chain, and the tone. Three, and no fourth.
    expect(codeUses).toHaveLength(3)
    expect(carries(builderSource, 'authoredName ?? meta.slug ?? "Untitled workflow"')).toBe(true)
    expect(carries(builderSource, "authoredName === null ?")).toBe(true)
    // POSITIVE CONTROL — the line filter really does drop prose and really does keep code.
    const control = ["  * authoredName is a display answer", "  const x = authoredName"]
      .filter((line) => !/^\s*(\*|\/\/)/.test(line))
      .filter((line) => line.includes("authoredName"))
    expect(control).toHaveLength(1)
  })
})

describe("199-09 / sheet c10 §1 case 5 — the long-name contract (STRUCTURAL SURROGATE)", () => {
  it("the identity may shrink and elide while the trailing group may not shrink at all", async () => {
    // ⚠ THIS IS NOT A LAYOUT MEASUREMENT AND MUST NOT BE READ AS ONE. jsdom performs no
    // layout, so every box here is 0×0 and a width comparison would read `0 > 0` — false
    // for the right reason and true for none. What IS honestly checkable is the contract
    // that produces the behaviour: the identity may shrink (`min-w-0`) and elides
    // (`truncate`), the trailing group refuses to shrink (`shrink-0`), and the bar WRAPS
    // rather than eliding a control (`flex-wrap`, `BuilderHeaderBar`'s own stated answer
    // to the operator's ~900 px complaint). The real check is an owed G-4 row.
    const LONG = "Enterprise Q3 Comprehensive Compliance and Vendor Risk Assessment 2026"
    const { container } = await openDraftWithDefinition({ name: LONG })

    // ⚠ MEASURED FLAG-OFF, and that is not a shortcut. `identitySlot` resolves the FIRST
    // `<span>` of the `<header>` band, which is the identity only on the flag-off surface
    // — with the flag ON the merged bar is itself a `<header>` whose first span belongs to
    // the breadcrumb LEAD. Reusing the helper there silently measured the wrong element
    // (it read "Edit · Vendor brief v1"), which is exactly the class of false green this
    // file's own docblock warns about. The bar's contract is measured on its own terms in
    // the case below.
    const slot = identitySlot(screen.getByTestId("builder-grid"), container)
    expect(slot.textContent).toBe(LONG)
    expect(slot.className).toContain("min-w-0")
    expect(slot.className).toContain("truncate")

    // NOTHING WAS LOST TO THE LONG NAME: every control is still mounted.
    expect(screen.getByTestId("builder-save-draft")).toBeInTheDocument()
    expect(screen.getByTestId("publish-trigger")).toBeInTheDocument()
  })

  it("the merged row WRAPS rather than eliding a control, and its trailing group never shrinks", async () => {
    await openDraftWithDefinition(
      { name: "Enterprise Q3 Comprehensive Compliance and Vendor Risk Assessment 2026" },
      FLAG_ON,
    )
    const bar = screen.getByTestId("builder-header-bar")
    expect(bar.className).toContain("flex-wrap")
    // The bar's SECOND child is the trailing group — `trail` + `actions`. It is the one
    // that must never give up width, because that is where every control lives. The
    // two-child shape is `WorkflowBuilderPage.canvas.test.tsx`'s 184-13 pin, re-measured
    // here because this plan edits the bar.
    expect(bar.children).toHaveLength(2)
    expect(bar.children[1].className).toContain("shrink-0")
    expect(bar.textContent ?? "").toContain("Assessment 2026")
  })
})

describe("199-09 / sheet c10 §1 — the hairline between WHERE-YOU-ARE and WHAT-THIS-IS", () => {
  it("the merged row marks the seam, and the mark adds NO band and NO word", async () => {
    const { container } = await openDraftBuilder(FLAG_ON)
    const bar = screen.getByTestId("builder-header-bar")
    const seam = screen.getByTestId("builder-header-seam")

    // It is a child of the EXISTING lead/identity group, never a third child of the bar —
    // `canvas.test.tsx`'s 184-13 pin says the bar has exactly two children and it still does.
    expect(bar.children).toHaveLength(2)
    expect(bar.children[0].contains(seam)).toBe(true)

    // POSITIONAL, not by class: it sits AFTER the breadcrumb and BEFORE the identity.
    const lead = screen.getByTestId("builder-back")
    // Resolved BY ITS WORDS rather than by a testid or a position, because the identity
    // slot deliberately carries neither (the byte pin sees that span).
    const identity = screen.getByText("vendor-brief")
    expect(lead.compareDocumentPosition(seam) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(seam.compareDocumentPosition(identity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // It spends no words and no accessible name — decoration, and the class-free atom pin
    // above is the mechanical proof that the merged row still READS exactly as it did.
    expect(seam.getAttribute("aria-hidden")).toBe("true")
    expect(restingAtoms(seam)).toEqual([])
    expect(headerBandsAbove(screen.getByTestId("builder-grid"), container)).toHaveLength(1)
  })

  it("with no identity to separate, there is no seam — so the pre-draft capture cannot see it", () => {
    // ⚠ THE GUARD IS THE POINT. `WorkflowDoorSwitch.baseline.test.tsx`'s `GOVERN_INLINE`
    // pins the PRE-DRAFT mount of this bar byte for byte, and that mount passes `lead` and
    // `trail` only. Asserted here on the component's own terms so the claim is a property
    // of the guard rather than a fact about one capture that happens to still pass.
    const { container } = render(<BuilderHeaderBar lead={<nav>‹ Workflows</nav>} trail={<span>t</span>} />)
    expect(container.querySelector('[data-testid="builder-header-seam"]')).toBeNull()
    cleanup()

    // …and the seam appears the moment there IS a seam — the positive control, so the
    // absence above is a decision and not a component that never draws one.
    render(<BuilderHeaderBar lead={<nav>‹ Workflows</nav>} identity={<span>Northwind QBR</span>} />)
    expect(screen.getByTestId("builder-header-seam")).toBeInTheDocument()
  })
})

describe("199-09 / sheet c10 §1 — the sheet's ICON and MOTION language is REFUSED", () => {
  it("no chrome source names a Material Symbol, and none carries the sheet's activity underline", () => {
    for (const [name, source] of C10_SOURCES) {
      expect(`${name}:${carries(source, "material-symbols")}`).toBe(`${name}:false`)
      expect(`${name}:${carries(source, "shaping-indicator")}`).toBe(`${name}:false`)
    }
    // POSITIVE CONTROL — both needles are real and the detector finds them.
    expect(carries('<span class="material-symbols-outlined">lock</span>', "material-symbols")).toBe(true)
    expect(carries('<div class="shaping-indicator pb-1">', "shaping-indicator")).toBe(true)
  })
})

// ── §2 THE SAVE REGION — four arms in the sheet, and the one we do not have ────────

describe("199-09 / sheet c10 §2 — the save region's shipped vocabulary, and the sheet's REFUSED one", () => {
  it("the sheet's own failure sentence is authored NOWHERE — the loop owns that sentence", () => {
    // D-186-03 / D-186-08: the refusal sentence is the write loop's, verbatim. A component
    // that authored "Save failed — Check connection" would be re-wording a refusal it did
    // not make, and would say "check connection" about a 409 that has nothing to do with
    // the network.
    expect(carries(saveRegionSource, "Save failed")).toBe(false)
    expect(carries(saveRegionSource, "Check connection")).toBe(false)
    expect(carries(saveRegionSource, "cloud_off")).toBe(false)
    expect(carries("Save failed — Check connection", "Check connection")).toBe(true)
  })

  it("⚠ THE COST OF THE REFUSED FOURTH ARM, PINNED RATHER THAN DESCRIBED", () => {
    // Sheet §2 has FOUR arms and this component reaches three of them: `saving`, `saved`
    // and `error`. There is no `unsaved changes` reading anywhere, on either surface —
    // asserted here so that a later plan which closes the gap FLIPS this line instead of
    // rediscovering it. See the SUMMARY's CE-2 for why this plan does not close it: the
    // only element that could carry it is `builder-autosave-status`, and
    // `WorkflowBuilderPage.canvas.test.tsx` asserts that element ABSENT after an edit made
    // on the flag-off surface — the mechanical form of D-181-01's promise.
    expect(carries(saveRegionSource, "Unsaved")).toBe(false)
    expect(carries(saveRegionSource, "unsaved changes")).toBe(false)
    expect(carries("nothing but Unsaved changes here", "Unsaved")).toBe(true)
  })
})

// ── §3 THE PUBLISH GATE — the refusal is RENDERED, not merely disabling ────────────

describe("199-09 / sheet c10 §3 — publish states its refusal in words (ALREADY-SHIPPED)", () => {
  it("the trigger renders the reason as a DOM node, not only as a `disabled` attribute", () => {
    // The plan's question for §3 was: does the shipped `blockedReason` seam RENDER the
    // refusal, or only grey the control? It renders it — `publish-blocked-reason` is a
    // real element wired to the trigger through `aria-describedby`, which is the whole
    // difference between a refusal and a dead button.
    expect(carries(publishGauntletSource, 'data-testid="publish-blocked-reason"')).toBe(true)
    expect(carries(publishGauntletSource, "aria-describedby")).toBe(true)
    expect(carries(publishGauntletSource, "{blockedReason}")).toBe(true)
  })

  it("no client-side refusal SENTENCE is authored in the publish surface", () => {
    // The sheet's `Needs 2 grounded phases` is a lint code wearing a sentence, and it
    // names a threshold nothing in this product computes. Every reason that reaches the
    // trigger comes from the Builder's `blockedReason`, whose five branches are either the
    // server's verbatim message or one of two locally-authored NON-verdicts.
    expect(carries(publishGauntletSource, "grounded phases")).toBe(false)
    expect(carries("Needs 2 grounded phases", "grounded phases")).toBe(true)
  })

  it("DRIVEN: a real server refusal reaches the header as WORDS, and the words are the server's", async () => {
    // The source sweep above proves the seam exists; this proves it is LIVE, end to end,
    // and that the sentence a person reads is the one the server sent rather than anything
    // this client composed. Driven deliberately rather than caught in the first-load race
    // the atom pin above waits out.
    const SERVER_SENTENCE = "Give the second step something to work from."
    mockValidate.mockResolvedValue({
      ok: false,
      verdicts: [{ code: "phase_missing_input", severity: "error", phase: "summarize", message: SERVER_SENTENCE }],
    })
    await openDraftBuilder(FLAG_ON)

    // ⚠ WAIT ON THE SENTENCE, NEVER ON THE ELEMENT. `publish-blocked-reason` is already
    // mounted before the first check answers — carrying the never-ran sentence — so a
    // `findByTestId` resolves instantly against the WRONG reading and the case would
    // have measured the fail-closed default while claiming to measure a server verdict.
    await waitFor(
      () => expect(screen.getByTestId("publish-blocked-reason").textContent).toBe(SERVER_SENTENCE),
      { timeout: 4000 },
    )
    const reason = screen.getByTestId("publish-blocked-reason")
    // A refusal, not a dead control: the trigger is disabled AND it points at the reason.
    const trigger = screen.getByTestId("publish-trigger")
    expect(trigger).toBeDisabled()
    expect(trigger.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"))
  })
})

// ── §4 THE PROBLEMS TRAY — business-plain BY DEFAULT, and the sheet's rows REFUSED ─

describe("199-09 / sheet c10 §4 — the tray carries none of the sheet's engineer language", () => {
  it("not one of the sheet's four row sentences appears in the shipped tray", () => {
    for (const needle of [
      "Output schema invalid",
      "JSON schema definition contains syntax errors",
      "Retrieve step requires at least one connected datastore",
      "A generation model must be selected",
    ]) {
      expect(`${needle}:${carries(problemsTraySource, needle)}`).toBe(`${needle}:false`)
    }
    expect(carries("Phase 5: Output schema invalid", "Output schema invalid")).toBe(true)
  })

  it("and it carries no friendly-message map to rewrite them with either (D-182-06)", () => {
    // The obvious fix for the sheet's language is the one thing this component may not
    // grow. Phase 185 ships new findings as new identifiers in the module that owns them;
    // a client-side rewrite table is exactly what D-182-06 removed, and re-introducing one
    // would put a SECOND home under every finding identifier.
    for (const needle of [
      "FRIENDLY",
      "MESSAGE_FOR",
      "CODE_TO_MESSAGE",
      "MESSAGES[",
      "messageFor",
    ]) {
      expect(`${needle}:${carries(problemsTraySource, needle)}`).toBe(`${needle}:false`)
    }
    // …and the server's own message is what reaches the row, unedited.
    expect(carries(problemsTraySource, "{verdict.message}")).toBe(true)
    expect(carries("const FRIENDLY = {}", "FRIENDLY")).toBe(true)
  })
})

// ── §5 THE STEP PICKER — one title resolver, and the sheet's verbs REFUSED ─────────

describe("199-09 / sheet c10 §5 — the picker's rows resolve through THE one resolver", () => {
  it("not one of the sheet's six verbs is spelled in this file", () => {
    // WR-03: the row title asks `nodeTitle` over the very phase the click will build. The
    // sheet's verbs are a DRAWING of that vocabulary, not a source for it — transcribing
    // them would re-create the exact defect WR-03 fixed ("Check with you" in the menu,
    // "Wait for your approval" on the card, one click apart), and it would survive every
    // lexical fence because the drift is SEMANTIC.
    for (const verb of [
      "Find documents",
      "Pull out specific details",
      "Weigh against policy",
      "Decide which way to go",
      "Write a document",
      "Send or file result",
    ]) {
      expect(`${verb}:${carries(stepPickerSource, verb)}`).toBe(`${verb}:false`)
    }
    expect(carries(stepPickerSource, "nodeTitle(minimalPhaseFor(")).toBe(true)
    expect(carries("<p>Find documents</p>", "Find documents")).toBe(true)
  })

  it("the sheet's search field is REFUSED — it is a filter, not a presentation", () => {
    // A search box over six rows is a behaviour (it decides which rows exist), and this
    // phase's fence is presentation only. Recorded as an absence so the refusal is
    // mechanical rather than a paragraph.
    expect(carries(stepPickerSource, "Search actions")).toBe(false)
    expect(carries(stepPickerSource, 'type="search"')).toBe(false)
    expect(carries('<input placeholder="Search actions..." />', "Search actions")).toBe(true)
  })
})

// ── THE MEASUREMENT THE WAVE-2 HAND-OFF ASKED FOR ─────────────────────────────────

describe("199-09 — the Builder's pre-draft CTA predicate, MEASURED not assumed", () => {
  it("carries the SAME trimmed-length term the door's gate carries", () => {
    // ⚠ THE QUESTION `199-08` DELIBERATELY LEFT OPEN, and the answer decides whether
    // saying the refusal out loud on this screen is PRESENTATION (in scope) or BEHAVIOUR
    // (a report). The door's `canDraft` reads `describe.trim().length > 0`; the Builder's
    // pre-draft CTA is `disabled={!canDraft}`, and ITS `canDraft` lives in
    // `useTemplateFirstDraft`. They are the same predicate, so the sentence is
    // presentation on both screens and NO new rule is added by rendering it.
    expect(carries(templateFirstDraftSource, "describe.trim().length > 0")).toBe(true)
    expect(carries(doorSwitchSource, "describe.trim().length > 0")).toBe(true)
    // ⚠ THE PAGE AUTHORS NO GATE OF ITS OWN — it spends the hook's. Stated as the absence
    // of a `canDraft` DECLARATION rather than of the substring `describe.trim()`, because
    // Task 2 legitimately adds a trimmed READ here (the refusal expression) and a fence
    // that cannot tell a read from a rule would have to be deleted the moment one landed.
    expect(carries(builderSource, "const canDraft")).toBe(false)
    expect(carries(builderSource, "disabled={!canDraft}")).toBe(true)
    expect(carries("const canDraft = describe.trim().length > 0", "const canDraft")).toBe(true)
  })

  it("✅ INVERTED BY TASK 2 — the pre-draft box now refuses OUT LOUD, in the door's own words", async () => {
    // ⚠ POLARITY FLIPPED, QUERY UNCHANGED. Task 1 asserted `DESCRIBE_REFUSAL` ABSENT from
    // this file; the same needle is now asserted PRESENT, and the sentence is asserted to
    // arrive by IMPORT rather than by spelling — `WorkflowBuilderPage.tsx` is a swept
    // source of the D-24(a) copy fence, so a re-spelling would turn that fence red.
    expect(carries(builderSource, "DESCRIBE_REFUSAL")).toBe(true)
    expect(carries(builderSource, '} from "@/components/workflows/doorVocabulary"')).toBe(true)
    expect(carries(builderSource, DESCRIBE_REFUSAL)).toBe(false)

    // DRIVEN, not merely swept: the real pre-draft screen, refusing real whitespace.
    const { container } = render(<WorkflowBuilderPage />)
    const box = await screen.findByLabelText("business requirement")

    // It never greets anyone — an untouched empty box is refused by the SAME rule and says
    // nothing, which is what keeps the resting DOM the one `GOVERN_INLINE` pins.
    expect(screen.queryByTestId("describe-refusal")).toBeNull()
    expect(box.getAttribute("aria-invalid")).toBeNull()

    fireEvent.change(box, { target: { value: "   \n\t  " } })
    expect(screen.getByTestId("describe-refusal").textContent).toBe(DESCRIBE_REFUSAL)
    expect(box.getAttribute("aria-invalid")).toBe("true")

    // Real text retires it, and the CTA agrees — the sentence reads the gate, it is not a
    // second gate. Both readings taken off ONE render.
    fireEvent.change(box, { target: { value: "summarise every vendor contract each quarter" } })
    expect(screen.queryByTestId("describe-refusal")).toBeNull()
    expect(container.querySelector("button[disabled]")).toBeNull()
  })

  it("the refusal changes NO enablement — the CTA refuses exactly what it refused before", async () => {
    // The whole of the "presentation, not behaviour" claim, driven rather than argued. The
    // CTA's disabled state is read across all three inputs; only the SENTENCE is new.
    render(<WorkflowBuilderPage />)
    const box = await screen.findByLabelText("business requirement")
    const cta = screen.getByRole("button", { name: DESCRIBE_CTA })

    expect(cta).toBeDisabled()
    fireEvent.change(box, { target: { value: "   \n\t  " } })
    expect(cta).toBeDisabled()
    fireEvent.change(box, { target: { value: "a real sentence" } })
    expect(cta).not.toBeDisabled()
    // …and back, so the case cannot pass on a control that simply never re-disables.
    fireEvent.change(box, { target: { value: "  " } })
    expect(cta).toBeDisabled()
  })
})

describe("Phase 200.3 (SEED-164 / D-03) — Builder header Test Run action", () => {
  it("flag ON: renders Test Run button and clicking it launches the draft", async () => {
    const onLaunch = vi.fn().mockResolvedValue(undefined)
    render(
      <EffectiveFeaturesProvider value={{ ...FLAG_ON, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowsPage folders={[]} onLaunch={onLaunch} />
        </div>
      </EffectiveFeaturesProvider>,
    )
    fireEvent.click(await screen.findByTestId("draft-open"))
    await screen.findByTestId("door-govern")
    await waitFor(() => expect(screen.getByTestId("builder-grid")).toBeInTheDocument())

    const testRunBtn = await screen.findByTestId("builder-test-run")
    expect(testRunBtn).toBeInTheDocument()
    expect(testRunBtn.textContent).toContain("Test Run")

    fireEvent.click(testRunBtn)
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
    expect(onLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "draft-1",
        slug: "vendor-brief",
        status: "draft",
      }),
      "",
    )
  })

  it("flag OFF: Test Run button is absent to preserve byte-identical flag-off surface", async () => {
    await openDraftBuilder(OFF_VARIANTS[0].value)
    expect(screen.queryByTestId("builder-test-run")).toBeNull()
  })

  /**
   * ⚠ THE REGRESSION THIS PINS SHIPPED ONCE AND NO TEST SAW IT.
   *
   * `handleTestRun` originally flushed behind `if (persistence.dirty)`. That member does not
   * exist on `DraftPersistence` — the flag lives on the STORE (`store.getState().dirty`) — so
   * the read was `undefined`, the guard was permanently false, and the flush NEVER RAN. A
   * Test Run launched the last SAVED definition while the canvas showed newer work. Only
   * `tsc -p tsconfig.app.json` caught it; the two behavioural tests above passed throughout,
   * because neither asserts the flush.
   *
   * ⚠ THE SWEEP IS OVER STRIPPED CODE, NOT RAW SOURCE (187-24, and it would have fired here):
   * the shipped fix carries a docblock that SPELLS the forbidden member by name so the next
   * reader knows why the guard is gone. A raw-source grep expecting zero reds on that prose.
   * NON-VACUITY is asserted first — a `?raw` import that resolved to "" passes every
   * absence clause silently.
   */
  it("the flush is UNCONDITIONAL — no `persistence.dirty` read survives in the builder", () => {
    const code = stripComments(builderSource)
    expect(code.length).toBeGreaterThan(20000) // non-vacuity: the ?raw import really resolved
    expect(code).toContain("await persistence.saveNow()")
    expect(code).not.toContain("persistence.dirty")
    // POSITIVE CONTROL — the needle really matches the shape it claims to forbid.
    expect("if (persistence.dirty) {").toContain("persistence.dirty")
  })
})

