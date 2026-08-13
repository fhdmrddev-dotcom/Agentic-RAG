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
    generateWorkflow: mockGenerate,
    createWorkflowDraft: mockCreate,
    updateWorkflowDraft: mockUpdate,
    listFolders: mockListFolders,
    listSkills: mockListSkills,
    validateWorkflow: mockValidate,
    getGroundingBundle: mockBundle,
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
// Phase 193-08: the two governed words this suite names, READ off their one home rather than
// re-typed. A page suite that spells a governed door string is a second home (D-11) and goes
// stale silently at the next reword — which is precisely what happened to every literal this
// plan had to re-capture.
import { STRIP_BACK, STRIP_LABEL_GOVERN } from "@/components/workflows/doorVocabulary"

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
 */
const FLAG_OFF_HEADER_MARKUP = [
  `<div class="flex items-center gap-3 border-b border-border px-4 py-2"><button type="button" data-testid="builder-back" class="rounded-md border border-border px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground">← Workflows</button><span class="text-[13px] font-medium text-foreground">Edit · Vendor brief v1</span><span data-testid="net-new-flag" title="Net-new surface — only GET /workflows/published + POST /workflows/{id}/publish are live today" class="rounded-full border border-accent-violet/40 bg-accent-violet/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase text-accent-violet">net-new</span></div>`,
  `<div class="flex items-center gap-3 border-b border-border px-4 py-2"><button type="button" data-testid="both-doors" class="rounded-md border border-border px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground">‹ Change how I start</button><span class="text-[13px] font-medium text-foreground">Build it myself</span><span data-testid="judge-locked" title="The llm_judge_rubric output-quality judge is the publish gauntlet's hard wall — it runs on EVERY tier and cannot be switched off (TIERS.judgeAlwaysOn)." class="ml-auto inline-flex items-center gap-1 rounded-full border border-accent-violet/40 bg-accent-violet/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-accent-violet"><span aria-hidden="true">🔒</span> judge always-on</span></div>`,
  `<header class="flex items-center justify-between border-b border-border px-4 py-2.5"><div class="flex min-w-0 items-center gap-2"><span class="min-w-0 truncate text-[14px] font-semibold text-foreground">vendor-brief</span><span class="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">draft</span></div><div class="flex shrink-0 items-center gap-2"><div data-testid="builder-save-state" class="flex items-center gap-2"><button type="button" data-testid="builder-save-draft" class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-opacity hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60">Save draft</button></div><div><button type="button" data-testid="publish-trigger" class="rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90">◆ Publish…</button></div></div></header>`,
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
    expect(bar).toHaveTextContent(STRIP_LABEL_GOVERN)
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
    const planted = workflowsPageSource.replace(
      "export function WorkflowsPage({ folders, onLaunch }: WorkflowsPageProps) {",
      'export function WorkflowsPage({ folders, onLaunch }: WorkflowsPageProps) {\n  const leak = useEffectiveFeatures("planted")',
    )
    expect(planted).not.toBe(workflowsPageSource) // the plant actually landed
    expect(callSites(planted)).toBe(1)
  })
})
