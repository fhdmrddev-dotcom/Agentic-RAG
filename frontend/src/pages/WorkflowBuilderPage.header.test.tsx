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
 *     WorkflowDoorSwitch `‹ both doors` · `🔧 Author & govern` · `JUDGE ALWAYS-ON`
 *       WorkflowBuilder  `<slug>` · `draft` · `Save draft` · `◆ Publish…`
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
      expect(bothDoors.textContent).toContain("‹ both doors")
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
 * The three bands' normalised `outerHTML`, outermost first, captured from the UNMODIFIED
 * page. It is deliberately verbatim rather than a shape assertion: the promise D-181-01
 * makes is about the markup a shipped user receives, and a "looks about right" matcher
 * cannot break when a wrapper is introduced or a band is re-parented.
 */
const FLAG_OFF_HEADER_MARKUP = [
  `<div class="flex items-center gap-3 border-b border-border px-4 py-2"><button type="button" data-testid="builder-back" class="rounded-md border border-border px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground">← Workflows</button><span class="text-[13px] font-medium text-foreground">Edit · Vendor brief v1</span><span data-testid="net-new-flag" title="Net-new surface — only GET /workflows/published + POST /workflows/{id}/publish are live today" class="rounded-full border border-accent-violet/40 bg-accent-violet/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase text-accent-violet">net-new</span></div>`,
  `<div class="flex items-center gap-3 border-b border-border px-4 py-2"><button type="button" data-testid="both-doors" class="rounded-md border border-border px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground">‹ both doors</button><span class="text-[13px] font-medium text-foreground">🔧 Author &amp; govern</span><span data-testid="judge-locked" title="The llm_judge_rubric output-quality judge is the publish gauntlet's hard wall — it runs on EVERY tier and cannot be switched off (TIERS.judgeAlwaysOn)." class="ml-auto inline-flex items-center gap-1 rounded-full border border-accent-violet/40 bg-accent-violet/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-accent-violet"><span aria-hidden="true">🔒</span> judge always-on</span></div>`,
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
