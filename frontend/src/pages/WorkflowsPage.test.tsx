/**
 * Phase 103-06 (REQ-7 / WFAUTH-04) — WorkflowsPage tests.
 *
 * The project-filtered browse + launch home. These tests pin the locked contracts:
 *  - selecting a project re-queries listPublishedWorkflows with that
 *    project_folder_id; "All projects" calls it with no project filter.
 *  - NO draft row exposes a Run affordance; runnable rows DO.
 *  - the tier badge is CLIENT-derived (a draft-policy def renders a different tier
 *    than a strict-policy def) with no extra fetch for the badge.
 *  - the create affordance switches the page view to the Builder.
 *  - Run opens a modal (read-only folder chip + one textarea + hint; enabled on
 *    empty) and clicking Run calls onLaunch(def, kickoff).
 *  - Tweak calls createWorkflowDraft with version = def.version + 1, same slug,
 *    status 'draft' (INSERT — never an UPDATE of the published row), then opens the
 *    Builder.
 *
 * ── Phase 192-10 (D-02) — WHAT THIS FILE'S RESTRUCTURE DID, AND WHAT IT DELIBERATELY
 *    DID NOT DO ──────────────────────────────────────────────────────────────────────
 * 157-B replaced three labelled shelves with ONE flat list under ONE persistent toolbar,
 * so the page's DOM changed underneath every case here. The classification applied was
 * RESEARCH's, and it is worth stating because the distinction is the difference between
 * a real regression and a plan task:
 *
 *   • TWO tests were DELETED, and only two: the pair that asserted the DOM ORDER OF THE
 *     THREE SECTIONS (the published-above-drafts case, and the full
 *     Starters → Published → Drafts case). Both pin a contract D-02 deliberately removes,
 *     and there are no sections left to order. A deletion here is an AUTHORIZED ACT — it
 *     rides in the same commit as the count-gate pin lowering that permits it, with the
 *     reason named there too. (Their old titles are quoted in that commit's message rather
 *     than here: the deletion's own mechanical check is a raw source count of the word
 *     those titles are built on, so quoting them would satisfy the grep that proves them
 *     gone — the trap 192-06, 192-08 and 192-09 each hit once in three other files.)
 *   • FOUR tests were REWRITTEN in the way RESEARCH predicted (the project re-query, the
 *     create affordance, the draft-has-no-Run contract, the starter row).
 *   • ⚠ SEVEN MORE NEEDED THEIR INTERACTION REWRITTEN TOO, and RESEARCH's table did not
 *     predict that — it classified by CONTRACT and those seven contracts are all intact.
 *     What moved was the click target: the fork verb is now ONE WORD inside the card's
 *     `⋯` overflow (D-09/D-12) rather than two differently-labelled buttons on two
 *     different card faces, and the fresh-build entry is the toolbar's. Every assertion
 *     in those seven is unchanged; only the route to it is. Measured, not assumed: the
 *     restructure turned 13 of 23 red, against a predicted 6.
 *   • ONE test was ADDED — the `allSettled` partial-failure path, and it is the most
 *     important row in this file. See its own comment.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const {
  mockListPublished,
  mockListDrafts,
  mockCreateDraft,
  mockGenerate,
  mockUpdate,
  mockPublish,
  mockListFolders,
  mockListSkills,
  mockListStarters,
  mockDeleteDraft,
} = vi.hoisted(() => ({
  mockListPublished: vi.fn(),
  mockListDrafts: vi.fn(),
  mockCreateDraft: vi.fn(),
  mockGenerate: vi.fn(),
  mockUpdate: vi.fn(),
  mockPublish: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
  mockListStarters: vi.fn(),
  mockDeleteDraft: vi.fn(),
}))

// Mock the api seam. The page consumes listPublishedWorkflows + listDraftWorkflows
// + createWorkflowDraft; the hosted Builder consumes generate/create/update +
// listFolders/listSkills (103-ux folder/skill name maps); the Gauntlet consumes publish.
// Phase 143 (WF-01): the curated starters feed consumes listStarterWorkflows.
//
// ⚠ 192-10 (D-18): `deleteWorkflowDraft` is listed because THIS FACTORY IS EXHAUSTIVE — it
// replaces the whole module, so every api symbol the page or anything it mounts imports has
// to appear or the reference throws. `WorkflowCard` is mounted by this page now and reaches
// that client for the draft delete grade. The other five suites that mount this page were
// each RE-RUN rather than pre-emptively edited, and all five stayed green, so none of them
// gained a line it did not need.
vi.mock("@/lib/api", () => ({
  listPublishedWorkflows: mockListPublished,
  listDraftWorkflows: mockListDrafts,
  createWorkflowDraft: mockCreateDraft,
  generateWorkflow: mockGenerate,
  updateWorkflowDraft: mockUpdate,
  publishWorkflow: mockPublish,
  listFolders: mockListFolders,
  listSkills: mockListSkills,
  listStarterWorkflows: mockListStarters,
  deleteWorkflowDraft: mockDeleteDraft,
}))

import { WorkflowsPage } from "./WorkflowsPage"
// 192-11 (D-07) — imported for ONE job: to be the POSITIVE CONTROL of the highlight
// measurement below. Nothing on the library surface renders it today, and the test that says
// so would be worthless without a demonstration that the selector it uses can find a real one.
import { HighlightTitle } from "@/lib/threadGroups"
import type { Folder } from "@/types"

const folders: Folder[] = [
  {
    id: "folder-aaa",
    user_id: "u1",
    name: "DBA Chapters",
    parent_id: null,
    is_org_shared: false,
    created_at: "",
    updated_at: "",
  },
]

/** A strict published def (llm_emit citation_policy 'strict' + the full gate set). */
const strictPublished = {
  id: "pub-1",
  slug: "vendor-risk",
  name: "Vendor-risk review",
  definition: {
    slug: "vendor-risk",
    version: 2,
    project_folder_id: "folder-aaa",
    inputs: [{ key: "kickoff_prompt" }],
    phases: [
      { slug: "pull", phase_index: 0, name: "Pull", config: { phase_type: "programmatic" } },
      {
        slug: "emit",
        phase_index: 1,
        name: "Render report",
        config: { phase_type: "llm_emit", citation_policy: "strict" },
        validators: [
          { kind: "citations_required" },
          { kind: "output_file_valid" },
          { kind: "structure_check" },
          { kind: "freshness" },
          { kind: "llm_judge_rubric" },
        ],
      },
    ],
  },
}

/** A draft-policy published def (citation_policy 'draft', no floor-raising gate). */
const loosePublished = {
  id: "pub-2",
  slug: "quick-notes",
  name: "Quick notes",
  definition: {
    slug: "quick-notes",
    version: 1,
    project_folder_id: null,
    phases: [{ slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft" } }],
  },
}

const draftRow = {
  id: "draft-1",
  slug: "contract-clause",
  version: 1,
  name: "Contract clause review",
  definition: {
    slug: "contract-clause",
    version: 1,
    phases: [{ slug: "draft", phase_index: 0, config: { phase_type: "llm_agent" } }],
  },
}

/**
 * Phase 143 (WF-01) — a curated starter (is_system_global published, category='starter').
 * A two-phase KB→document def: retrieve (llm_agent) → emit (llm_emit strict). The
 * fresh-copy fork (D-143-1) mints a NEW suffixed slug + v1 off this seeded slug.
 */
const starterRow = {
  id: "starter-1",
  slug: "risk-register",
  name: "Risk Register",
  definition: {
    slug: "risk-register",
    version: 1,
    name: "Risk Register",
    status: "published",
    category: "starter",
    phases: [
      { slug: "retrieve", phase_index: 0, config: { phase_type: "llm_agent" } },
      {
        slug: "emit",
        phase_index: 1,
        config: { phase_type: "llm_emit", citation_policy: "strict" },
      },
    ],
  },
}

// ══ 192-11 — THE 200-ROW FIXTURE, AND THE HELPERS THE SCALE SUITE READS THE DOM WITH ══
//
// ⚠ JUDGE EVERY FINDABILITY AND DENSITY CLAIM AT 200 WORKFLOWS. That is the 045 real-scale
// lesson and it is why all three of this phase's sketches ship a 12/54/200 scale selector: a
// suite that only ever renders four fixtures proves the feature works on a demo. The four
// literal fixtures above stay — they are the shipped contracts' fixtures and every case that
// asserts a CONTRACT still uses them. What follows is for the cases that assert a PROPERTY AT
// SCALE, which is a different question.
//
// GENERATED IN THIS FILE, NOT IN A SHARED FIXTURES MODULE. Nothing else needs these rows, and
// a shared module for one consumer is this phase's rot to own. The house precedent for an
// in-file typed bulk generator is `PhaseReconcile.test.tsx:117` (`Array.from({length: n}, …)`);
// there is no factory module and no MSW anywhere in this repo — re-verified at this commit —
// so there is no third pattern to avoid inventing.

/** 120 published + 20 starters + 60 drafts = the 200 rows the merged library renders. */
const BULK_PUBLISHED = 120
const BULK_STARTERS = 20
const BULK_DRAFTS = 60
const BULK_TOTAL = BULK_PUBLISHED + BULK_STARTERS + BULK_DRAFTS

const pad3 = (n: number) => String(n).padStart(3, "0")

/** Every row's name. A 3-digit tail makes any three characters of ONE name globally unique. */
const bulkName = (i: number) => `Workflow ${pad3(i)}`

/**
 * The ONE row whose search word lives ONLY in its purpose sentence — the case that makes D-07
 * measurably wider than SC#1's literal wording ("part of its name"). It is a PUBLISHED index on
 * purpose: the widened scope has to work on the feed a reader spends most of their time in.
 */
const PURPOSE_ONLY_INDEX = 42
const PURPOSE_ONLY_WORD = "porcupine"

/** A word a third of the rows carry — the SECOND live query the chip audit runs under. */
const SHARED_PURPOSE_WORD = "contracts"

/**
 * The purpose sentence (`business_requirement`) — the card's hero atom, and half of D-07's
 * search scope. Deliberately DIGIT-FREE so a name search can never be answered by a purpose.
 */
function bulkPurpose(i: number): string {
  if (i === PURPOSE_ONLY_INDEX) {
    return `Reviews the annual ${PURPOSE_ONLY_WORD} sanctuary budget before sign-off.`
  }
  return i % 3 === 0
    ? `Checks supplier ${SHARED_PURPOSE_WORD} for renewal risk.`
    : "Summarises the quarterly operating review."
}

/**
 * Real spread across the two DERIVED chips, so neither is satisfied by a uniform block:
 * every even row emits a FILE (`soulDeliverable` → `kind: "file"`), and every fourth row emits
 * STRICTLY (`tierForDefinition` → `TIERS.STRICT`). An odd row is programmatic-only: no file,
 * and LOOSE.
 */
function bulkPhases(i: number) {
  if (i % 2 !== 0) {
    return [{ slug: `step-${i}`, phase_index: 0, config: { phase_type: "programmatic" } }]
  }
  return [
    { slug: `pull-${i}`, phase_index: 0, config: { phase_type: "programmatic" } },
    {
      slug: `emit-${i}`,
      phase_index: 1,
      config: {
        phase_type: "llm_emit",
        citation_policy: i % 4 === 0 ? "strict" : "draft",
      },
    },
  ]
}

/** Every fifth row is bound to the one folder the toolbar can select. */
const bulkProject = (i: number) => (i % 5 === 0 ? "folder-aaa" : null)

/** A `/workflows/published` row. `is_mine: true` — the feed is `?scope=mine`. */
function makePublishedRow(i: number, overrides: Record<string, unknown> = {}) {
  const base = {
    id: `bulk-pub-${i}`,
    slug: `bulk-pub-${i}`,
    name: bulkName(i),
    is_mine: true,
    is_system_global: false,
    definition: {
      slug: `bulk-pub-${i}`,
      version: 1,
      name: bulkName(i),
      business_requirement: bulkPurpose(i),
      project_folder_id: bulkProject(i),
      phases: bulkPhases(i),
    },
  }
  return { ...base, ...overrides } as typeof base
}

/**
 * A `/workflows/starters` row. `is_mine: false`, and NO `project_folder_id` at all — that is
 * what the three seeded starters actually look like (`094_starter_workflows.sql`), and it is
 * the data property D-17's toolbar note states rather than apologises for.
 */
function makeStarterRow(i: number, overrides: Record<string, unknown> = {}) {
  const base = {
    id: `bulk-star-${i}`,
    slug: `bulk-star-${i}`,
    name: bulkName(i),
    is_mine: false,
    is_system_global: true,
    definition: {
      slug: `bulk-star-${i}`,
      version: 1,
      name: bulkName(i),
      status: "published",
      category: "starter",
      business_requirement: bulkPurpose(i),
      phases: bulkPhases(i),
    },
  }
  return { ...base, ...overrides } as typeof base
}

/** A `/workflows/drafts` row. It carries NO `is_mine`: the feed is already owner-scoped. */
function makeDraftRow(i: number, overrides: Record<string, unknown> = {}) {
  const base = {
    id: `bulk-draft-${i}`,
    slug: `bulk-draft-${i}`,
    version: 1,
    name: bulkName(i),
    definition: {
      slug: `bulk-draft-${i}`,
      version: 1,
      name: bulkName(i),
      business_requirement: bulkPurpose(i),
      project_folder_id: bulkProject(i),
      phases: bulkPhases(i),
    },
  }
  return { ...base, ...overrides } as typeof base
}

/** ONE array of 200 indices, PARTITIONED three ways — so the three feeds cannot overlap. */
const BULK_INDICES = Array.from({ length: 200 }, (_, i) => i)
const bulkPublished = BULK_INDICES.slice(0, BULK_PUBLISHED).map((i) => makePublishedRow(i))
const bulkStarters = BULK_INDICES.slice(BULK_PUBLISHED, BULK_PUBLISHED + BULK_STARTERS).map((i) =>
  makeStarterRow(i),
)
const bulkDrafts = BULK_INDICES.slice(BULK_PUBLISHED + BULK_STARTERS).map((i) => makeDraftRow(i))

/**
 * Remove `is_mine` ENTIRELY — not set it to `undefined`. The degraded state D-04 names is a
 * frontend deployed AHEAD of its backend, where the key was never in the payload at all.
 */
function stripIsMine<T extends object>(row: T): T {
  const clone = { ...(row as Record<string, unknown>) }
  delete clone.is_mine
  return clone as T
}

/** The rendered rows, read from the DOM — never from the fixture array (that would be circular). */
const renderedCards = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-card="workflow-card"]'))

/** The rendered rows of ONE provenance, read off the card's own machine-readable mark. */
const renderedOfKind = (provenance: string): HTMLElement[] =>
  renderedCards().filter((card) => card.getAttribute("data-provenance") === provenance)

/**
 * The six chips, SPELLED OUT rather than imported from `libraryVocabulary`. A test that reads
 * the order from the module under test cannot notice a renamed chip; six literals can. The
 * count of rendered chips is asserted against this list's length, so a SEVENTH chip is a
 * failure here too rather than a silently unaudited one.
 */
const CHIPS = [
  "ready-to-run",
  "yours",
  "still-building",
  "starters",
  "makes-a-file",
  "strict",
] as const

/** The number a chip PROMISES, read off the chip itself. */
const chipCount = (chip: string): number =>
  Number(screen.getByTestId(`library-chip-count-${chip}`).textContent)

/** Type into the always-on search field. One `change` = one re-render, at 200 rows. */
function setSearch(text: string) {
  fireEvent.change(screen.getByTestId("library-search"), { target: { value: text } })
}

/** Mount the page over the 200-row fixture (any feed replaceable per case). */
function mountBulk(
  opts: { published?: unknown[]; starters?: unknown[]; drafts?: unknown[] } = {},
) {
  mockListPublished.mockResolvedValue(opts.published ?? bulkPublished)
  mockListStarters.mockResolvedValue(opts.starters ?? bulkStarters)
  mockListDrafts.mockResolvedValue(opts.drafts ?? bulkDrafts)
  return render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
}

/**
 * 192-10 (D-05) — pick a project through the TOOLBAR'S SELECT.
 *
 * The 200px rail is gone and its `FilterItem` toggles with it, so `click(getByText(name))`
 * now lands on an `<option>` — which fires no `change` event in jsdom and would leave the
 * selection silently unmoved. Driving the `<select>` is the honest equivalent of what the
 * rail click used to do, and every assertion built on it is unchanged.
 */
function selectProject(value: string) {
  fireEvent.change(screen.getByTestId("library-project-select"), { target: { value } })
}

/**
 * 192-10 (D-09 / D-12) — reach the fork verb.
 *
 * The fork is no longer a button on a card face: D-09 gives each row ONE primary verb and
 * puts everything else behind a quiet `⋯`, and D-12 keeps the two fork HANDLERS separate
 * behind ONE shared word. So the route to `published-tweak` / `use-starter` is now: open the
 * row's overflow, then pick the item. The shim below is the shipped one — Radix's menu uses
 * pointer-capture and `scrollIntoView`, neither of which jsdom implements.
 */
async function openOverflow(card: HTMLElement) {
  const user = userEvent.setup()
  await user.click(within(card).getByRole("button", { name: /workflow actions/i }))
  await screen.findByRole("menu")
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  mockListPublished.mockResolvedValue([strictPublished, loosePublished])
  mockListDrafts.mockResolvedValue([draftRow])
  mockListStarters.mockResolvedValue([starterRow])
  mockCreateDraft.mockResolvedValue({ id: "new-draft", version: 3 })
  // The hosted Builder fetches folders + skills on mount (103-ux name maps).
  mockListFolders.mockResolvedValue(folders)
  mockListSkills.mockResolvedValue([])
})

describe("WorkflowsPage — project filter (live ?project_folder_id= re-query)", () => {
  it("'All projects' calls listPublishedWorkflows with no project filter on mount", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await waitFor(() => expect(mockListPublished).toHaveBeenCalled())
    // First call (All projects, the default) is invoked with a null/undefined project arg.
    const firstArg = mockListPublished.mock.calls[0][0]
    expect(firstArg == null).toBe(true)
  })

  it("selecting a project re-queries listPublishedWorkflows with that project_folder_id", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await waitFor(() => expect(mockListPublished).toHaveBeenCalled())
    mockListPublished.mockClear()
    // 192-10 (D-05): the instrument changed from a rail toggle to one toolbar select. The
    // CONTRACT below — which arguments the re-query is made with — is byte-for-byte the one
    // this case has always asserted.
    selectProject("folder-aaa")
    // Phase 143 (D-143-2a): the Workflows-page published feed opts into scope:"mine"
    // (mine-only de-dupe). The project folder id stays the FIRST arg; scope rides in the
    // 3rd options arg so the composer picker / WorkspacePanel (no scope) stay unchanged.
    await waitFor(() =>
      expect(mockListPublished).toHaveBeenCalledWith("folder-aaa", undefined, { scope: "mine" }),
    )
  })

  it("latest-wins: a STALE earlier response never paints over the current selection", async () => {
    // The "All projects" (mount) fetch resolves SLOWLY; the project fetch resolves
    // FIRST. The rendered list must match the LATER selection, not the stale mount one.
    let releaseAll: (rows: unknown[]) => void = () => {}
    const slowAll = new Promise<unknown[]>((r) => (releaseAll = r))
    // First call (All projects, mount) → the slow promise; second (project) → fast.
    mockListPublished.mockReset()
    mockListPublished
      .mockReturnValueOnce(slowAll) // mount: All projects (7 imaginary rows) — stale
      .mockResolvedValueOnce([strictPublished]) // project filter: exactly 1 row

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    // Switch to the project BEFORE the mount fetch resolves.
    //
    // ⚠ 192-10: THIS ROW IS WHY THE TOOLBAR MOUNTS DURING THE FIRST LOAD RATHER THAN AFTER
    // IT. The state under test is precisely "the mount fetch has not returned and the
    // selection moves anyway", so a toolbar withheld until the first settle would make the
    // project control unreachable in the one state this guard exists to cover. RESEARCH
    // classified this case as "must stay green" WITHOUT a rewrite; measured, its interaction
    // had to change for the same reason the case above it did.
    selectProject("folder-aaa")
    // The project (later) fetch resolves first → 1 published row.
    await waitFor(() => expect(screen.getAllByTestId("published-card")).toHaveLength(1))
    // Now the stale mount fetch finally resolves with a DIFFERENT (larger) list.
    releaseAll([strictPublished, loosePublished])
    // It must be DROPPED — the rendered list stays at the current selection (1 row).
    await waitFor(() => expect(mockListPublished).toHaveBeenCalledTimes(2))
    expect(screen.getAllByTestId("published-card")).toHaveLength(1)
  })
})

// ── 192-10 (D-16, T-192-03) — THE MERGE TRAP, PROVED RATHER THAN ARGUED ────────────────

describe("WorkflowsPage — a refused feed subtracts ONLY itself (D-16, the RUN CARVE-OUT)", () => {
  it("a REJECTED /workflows/drafts still renders the published rows and the starter", async () => {
    // ⚠ THE SINGLE HIGHEST-RISK DEFECT THE D-16 MERGE CAN SHIP, and the only mechanical
    // guard against it.
    //
    // `GET /workflows/drafts` carries `require_visible("workflow_authoring")`. `GET
    // /workflows/published` and `GET /workflows/starters` carry NO dependency at all —
    // they are the Phase-148 RUN CARVE-OUT, the feeds that keep Run working for EVERY user,
    // and the backend says so verbatim at the route. A `Promise.all` plus one shared error
    // path therefore turns a 403 on the gated feed into an EMPTY LIBRARY: the gate
    // re-introduced client-side, on exactly the two feeds the carve-out withheld it from.
    //
    // A test in which all three feeds resolve does not test this AT ALL — it is green
    // against `all` and against `allSettled` alike. This one is not.
    mockListDrafts.mockRejectedValue(new Error("403 Forbidden"))

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)

    // The two carve-out feeds render in full…
    await waitFor(() => expect(screen.getAllByTestId("published-card")).toHaveLength(2))
    expect(screen.getByTestId("starter-card")).toBeInTheDocument()
    // …the refused one degrades to ZERO DRAFTS, not to zero library…
    expect(screen.queryByTestId("draft-card")).toBeNull()
    // …and the failure is NAMED rather than folded into a page-wide error, so a partial
    // library is never presented as a complete one.
    expect(screen.getByTestId("library-source-failed-draft")).toBeInTheDocument()
    // The two feeds that succeeded say nothing, because nothing went wrong with them.
    expect(screen.queryByTestId("library-source-failed-published")).toBeNull()
    expect(screen.queryByTestId("library-source-failed-starter")).toBeNull()

    // ── ⚠ AND THE SHAPE, BECAUSE THE BEHAVIOURAL HALF ABOVE CANNOT SEE IT ──────────────
    // This was MEASURED, not assumed. Swapping the aggregate to `Promise.all` and driving
    // the case above leaves it GREEN — because the isolation that actually saves the
    // library is the PER-SOURCE try/catch inside each refetch, and the aggregate's only
    // remaining job is to settle without throwing. (The plant that DOES redden the case
    // above is the real defect: gating the list on "no source failed", which is the single
    // shared error path RESEARCH names. It was driven RED and restored md5-identical.)
    //
    // So the keyword is pinned separately, on the source, rather than claimed by a
    // behavioural assertion that cannot distinguish it. `Promise.all` must never reappear
    // here: the day the aggregate acquires a consumer again — a settle-gated spinner, a
    // telemetry hook — `all` would silently re-introduce exactly the coupling the carve-out
    // exists to prevent, and no behavioural test would notice.
    const pageSource = (await import("./WorkflowsPage?raw")).default as string
    expect(pageSource.length).toBeGreaterThan(10000) // non-vacuity: an empty `?raw` proves nothing
    expect(pageSource).toContain("Promise.allSettled(")
    expect(pageSource).not.toContain("Promise.all(")
  })
})

/**
 * ⚠ TWO TESTS WERE DELETED HERE, AND THE DELETION IS THE POINT OF THE COMMENT.
 *
 *   1. the published-above-drafts DOM-order case (BUG-260628-01 fold, D-143-5), which lived
 *      in this block;
 *   2. the full Starters → Published → Drafts order case (SC-e), which lived in the starter
 *      block below.
 *
 * Both asserted an ORDER OF SECTIONS, and D-02 deletes the sections. There is no ordering
 * left to be right or wrong about — one flat list has one order — and the taxonomy those
 * three sections carried survives as three of the toolbar's six chips.
 *
 * The BUG they folded is NOT un-fixed by removing them. BUG-260628-01 was "runnable work is
 * buried under drafts"; 157-B's answer is stronger than re-ordering three sections, because a
 * user who wants runnable rows now says so with the *Ready to run* chip and gets exactly the
 * count that chip promised — which `libraryFilter.test.ts` proves as arithmetic, per chip.
 *
 * These two deletions are the ONLY ones in this file, and they are what authorizes the ONE
 * count-gate pin lowering this phase makes. The lowering rides in the same commit, at a
 * number read from the gate's own `actual` column — never to make a red gate go quiet.
 */
describe("WorkflowsPage — the create affordance and the draft-cannot-Run contract", () => {
  it("the toolbar create affordance opens the two-door chooser (WUX-02)", async () => {
    // 192-10 (D-02): the dashed build-card was the first cell of the THIRD grid and died
    // with the shelves; SC#4's fix is structural, not a promotion — create now LEADS a
    // persistent toolbar and cannot drift back down a grid because there is no grid above
    // it. The half of this case that matters is the seam to Phase 193, and it is untouched:
    // a fresh build still lands at the two-door chooser, not at the describe screen.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const create = await screen.findByTestId("library-create")
    expect(create).toBeInTheDocument()
    fireEvent.click(create)
    expect(await screen.findByTestId("workflow-doors")).toBeInTheDocument()
    expect(screen.getByTestId("door-card-describe")).toBeInTheDocument()
    expect(screen.getByTestId("door-card-govern")).toBeInTheDocument()
  })

  it("NO draft row exposes a Run affordance, in its face OR its menu; runnable rows DO", async () => {
    // ⚠ THE LOAD-BEARING HALF, REWRITTEN RATHER THAN DELETED. "A draft cannot be Run
    // (publish is the test)" is stated in the page's own docblock and this is the only
    // page-level mechanical guard on it. D-09 keeps the invariant exactly; what changed is
    // that `Publish…` is GONE (D-10 — it was a button that opened the editor, so its label
    // lied), and the draft's one verb is `✎ Open`.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const draftCard = await screen.findByTestId("draft-card")
    expect(within(draftCard).queryByTestId("published-run")).not.toBeInTheDocument()
    expect(within(draftCard).getByTestId("draft-open")).toBeInTheDocument()
    // D-10: the button that lied is gone from the row entirely.
    expect(within(draftCard).queryByTestId("draft-publish")).not.toBeInTheDocument()
    // …and it is not hiding in the overflow either — an absence proved only on the face
    // would be satisfied by a Run that merely moved behind the `⋯`.
    await openOverflow(draftCard)
    const menu = screen.getByRole("menu")
    expect(within(menu).queryByTestId("published-run")).not.toBeInTheDocument()
    expect(within(menu).queryByTestId("draft-publish")).not.toBeInTheDocument()

    // The runnable rows carry Run.
    const published = await screen.findAllByTestId("published-card")
    expect(within(published[0]).getByTestId("published-run")).toBeInTheDocument()
  })
})

describe("WorkflowsPage — card renders the shared WorkflowSoul (WUX-01, D10, no extra fetch)", () => {
  it("a published card renders a WorkflowSoul (the card-scale soul + its derived tier chip)", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    // The shared soul mounts at card scale (replacing the old TierBadge/PhaseChain trio).
    const soul = within(cards[0]).getByTestId("workflow-soul")
    expect(soul.getAttribute("data-scale")).toBe("card")
    // And it carries the soul's derived tier chip + glyph-dot spine.
    expect(within(cards[0]).getByTestId("soul-tier")).toBeInTheDocument()
    expect(within(cards[0]).getByTestId("soul-spine")).toBeInTheDocument()
    // The OLD ad-hoc trio is gone from the card body.
    expect(within(cards[0]).queryByTestId("tier-badge")).not.toBeInTheDocument()
    expect(within(cards[0]).queryByTestId("phase-chain")).not.toBeInTheDocument()
  })

  it("a strict-policy def renders a different soul tier chip than a draft-policy def (derived, no per-card fetch)", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    const strictTier = within(cards[0]).getByTestId("soul-tier")
    const looseTier = within(cards[1]).getByTestId("soul-tier")
    expect(strictTier.getAttribute("data-tier")).toBe("STRICT")
    expect(looseTier.getAttribute("data-tier")).toBe("LOOSE")
    expect(strictTier.getAttribute("data-tier")).not.toBe(looseTier.getAttribute("data-tier"))
    // The tier is derived: listPublishedWorkflows was the ONLY fetch (no per-card call).
    expect(mockListPublished).toHaveBeenCalledTimes(1)
  })
})

describe("WorkflowsPage — soul tier picks the STRICTEST emit policy (WR-03, order-independent)", () => {
  it("a [flag, strict, partial] multi-emit def derives STRICT regardless of phase order", async () => {
    // Old logic only overwrote on 'strict' after the first emit set the policy, so a
    // 'partial' following a 'flag' was dropped and order mattered. The shared soulData
    // derivation uses a deterministic stricter-wins comparison: the strict emit wins.
    const multiEmit = {
      id: "pub-multi",
      slug: "multi-emit",
      name: "Multi emit",
      definition: {
        slug: "multi-emit",
        version: 1,
        project_folder_id: null,
        phases: [
          { slug: "e1", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "flag" } },
          { slug: "e2", phase_index: 1, config: { phase_type: "llm_emit", citation_policy: "strict" } },
          { slug: "e3", phase_index: 2, config: { phase_type: "llm_emit", citation_policy: "partial" } },
        ],
      },
    }
    mockListPublished.mockResolvedValue([multiEmit])
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const card = await screen.findByTestId("published-card")
    expect(within(card).getByTestId("soul-tier").getAttribute("data-tier")).toBe("STRICT")
  })
})

describe("WorkflowsPage — Run launch (D-103-1) reuses onLaunch", () => {
  it("Run opens the modal: an editable KB-scope <select> (author default tagged) + one textarea + a hint line", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const modal = await screen.findByTestId("run-modal")
    // Phase 152 (WFIN-02 / D-LOCK-01 + WR-05): the read-only chip is now an inline native
    // <select>. For a BOUND workflow (folder-aaa = "DBA Chapters") the leading "" option
    // is the truthful "Workflow default — 📁 {folder}" and is the resting selection —
    // never the dishonest "All documents" (which is unbound-only). NAME, never a path.
    const scope = within(modal).getByTestId("run-scope-select") as HTMLSelectElement
    expect(scope.value).toBe("")
    const optionText = Array.from(scope.options).map((o) => o.textContent)
    expect(optionText[0]).toContain("Workflow default")
    expect(optionText[0]).toContain("DBA Chapters")
    expect(optionText.some((t) => t === "All documents")).toBe(false)
    expect(scope.textContent).not.toMatch(/[/\\]/)
    // Exactly one textbox: the kickoff textarea (the <select> + file input aren't textboxes).
    expect(within(modal).getAllByRole("textbox")).toHaveLength(1)
    expect(within(modal).getByTestId("run-hint")).toBeInTheDocument()
  })

  it("the Run button is ENABLED even on empty input", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const confirm = await screen.findByTestId("run-confirm")
    expect(confirm).not.toBeDisabled()
  })

  it("clicking Run calls onLaunch(def, kickoff)", async () => {
    const onLaunch = vi.fn().mockResolvedValue(undefined)
    render(<WorkflowsPage folders={folders} onLaunch={onLaunch} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const textarea = await screen.findByTestId("run-kickoff")
    fireEvent.change(textarea, { target: { value: "review Acme Corp" } })
    fireEvent.click(screen.getByTestId("run-confirm"))
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
    // Phase 152: onLaunch now carries the two run inputs. Default state = no template +
    // the folder on the "workflow default" (author default) → NO override (D-06).
    expect(onLaunch).toHaveBeenCalledWith(strictPublished, "review Acme Corp", {
      templateFile: null,
      folderId: null,
    })
  })

  it("D-01: the library-card Run path stays the Phase-121 launch (onLaunch), NOT wrapped by the door fork", async () => {
    // The two-door fork lives at the Studio authoring ENTRY only. The published-card
    // Run must reach onLaunch (doRun → createThread → postMessage → create_workflow_run)
    // directly — it is never routed through WorkflowDoorSwitch. Asserting Run still
    // opens the run modal + calls onLaunch (and does NOT mount the door chooser) pins it.
    const onLaunch = vi.fn().mockResolvedValue(undefined)
    render(<WorkflowsPage folders={folders} onLaunch={onLaunch} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    // The run modal opens (the Phase-121 launch surface), NOT the two-door chooser.
    expect(await screen.findByTestId("run-modal")).toBeInTheDocument()
    expect(screen.queryByTestId("workflow-doors")).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId("run-confirm"))
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
    // Phase 152: still onLaunch (never the door fork); the third arg is the default
    // no-input state (D-06 — no template, folder on the workflow default).
    expect(onLaunch).toHaveBeenCalledWith(strictPublished, "", {
      templateFile: null,
      folderId: null,
    })
  })

  it("WR-05: a double-tap of Run creates ONLY ONE launch (in-flight guard)", async () => {
    // onLaunch resolves only when we release it — the second click while in flight
    // must be ignored (one click = one thread).
    let release: () => void = () => {}
    const onLaunch = vi.fn().mockReturnValue(new Promise<void>((r) => (release = r)))
    render(<WorkflowsPage folders={folders} onLaunch={onLaunch} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const confirm = await screen.findByTestId("run-confirm")
    fireEvent.click(confirm) // first click → launch starts (still pending)
    fireEvent.click(confirm) // second tap while in flight → must be ignored
    fireEvent.click(confirm)
    expect(onLaunch).toHaveBeenCalledTimes(1)
    expect(confirm).toBeDisabled()
    release()
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
  })
})

/**
 * 192-10 (D-09 / D-12) — the three cases below keep EVERY assertion they have always made.
 * Only the route changed: the fork is one word inside the row's `⋯` overflow now, shared
 * with the starter fork, and the two HANDLERS behind that one word stay separate siblings —
 * which is what the starter block below proves from the other side.
 */
describe("WorkflowsPage — Tweak forks a v(N+1) draft (INSERT, never UPDATE)", () => {
  it("Tweak calls createWorkflowDraft with version = def.version + 1, same slug, status 'draft'", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    const user = await openOverflow(cards[0])
    await user.click(screen.getByTestId("published-tweak"))
    await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(1))
    const forked = mockCreateDraft.mock.calls[0][0]
    expect(forked.slug).toBe("vendor-risk")
    expect(forked.version).toBe(3) // published def.version (2) + 1
    expect(forked.status).toBe("draft")
    // It is an INSERT (createWorkflowDraft), never updateWorkflowDraft on the published row.
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("Tweak opens the FORKED copy's existing steps in the Builder (NOT the describe screen)", async () => {
    // The fork mints draft id "new-draft" (beforeEach mock). The Builder must boot
    // straight into the editing view on the forked definition's existing phases —
    // never the empty describe box.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    const user = await openOverflow(cards[0])
    await user.click(screen.getByTestId("published-tweak"))
    // The forked strict def's phases render as spine nodes (pull + emit).
    expect(await screen.findByTestId("spine-node-pull")).toBeInTheDocument()
    expect(screen.getByTestId("spine-node-emit")).toBeInTheDocument()
    // And NOT the describe-first empty screen.
    expect(screen.queryByTestId("describe-hint")).not.toBeInTheDocument()
  })

  it("Tweak seeds the Builder with the NEW forked draft id → its publish gauntlet mounts on that id", async () => {
    // draftId is pre-seeded from the fork ("new-draft"), so the publish gauntlet (gated
    // on a non-null draftId in renderPublish) renders immediately in the edit view.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    const user = await openOverflow(cards[0])
    await user.click(screen.getByTestId("published-tweak"))
    await screen.findByTestId("spine-node-pull")
    // The header carries the Tweak caption with the new version.
    expect(screen.getByText(/Tweak · vendor-risk v3/)).toBeInTheDocument()
  })
})

describe("WorkflowsPage — the starter row and its fresh-copy fork (WF-01, D-143-1/2/8)", () => {
  it("a starter row renders in the ONE list with its provenance mark and the fork verb", async () => {
    // 192-10 (D-02 / D-09): there is no curated section to render it in. What survives — and
    // what actually mattered in the deleted assertion — is that a curated row is
    // DISTINGUISHABLE from a user's own at a glance, and that the fork affordance is on it.
    // The distinction is now the row's own provenance mark plus a machine-readable
    // `data-provenance`, and the fork is the shared verb behind the `⋯`.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const card = await screen.findByTestId("starter-card")
    // It sits in the one flat list, not in a section of its own.
    expect(within(screen.getByTestId("library-list")).getByTestId("starter-card")).toBe(card)
    expect(within(card).getByText("Risk Register")).toBeInTheDocument()
    // The curated-vs-mine distinction (D-143-8, Glean verified-badge analog), now carried by
    // the row itself rather than by the section it used to sit under.
    expect(card.getAttribute("data-provenance")).toBe("starter")
    expect(within(card).getByText(/starter|official/i)).toBeInTheDocument()
    // The fork affordance, reached the way D-09 puts it.
    await openOverflow(card)
    expect(screen.getByTestId("use-starter")).toBeInTheDocument()
  })

  it("onUseStarter forks a FRESH copy: new suffixed slug + v1 + draft (INSERT, never UPDATE the frozen starter)", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const card = await screen.findByTestId("starter-card")
    const user = await openOverflow(card)
    await user.click(screen.getByTestId("use-starter"))
    await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(1))
    const forked = mockCreateDraft.mock.calls[0][0]
    // D-143-1: a brand-new owned identity — a NEW auto-suffixed slug off "risk-register".
    expect(forked.slug).toMatch(/^risk-register-[a-z0-9]{6}$/)
    expect(forked.version).toBe(1) // v1, NOT the same-slug Tweak's N+1
    expect(forked.status).toBe("draft")
    // It is an INSERT (createWorkflowDraft) — the frozen published starter is NEVER UPDATEd.
    expect(mockUpdate).not.toHaveBeenCalled()
    // ⚠ D-12, from the OTHER side, and this is the assertion the shared word makes
    // necessary: a starter's fork reached `onUseStarter`, so it minted a NEW slug at v1
    // rather than this slug at v(N+1). Merging the two handlers behind one label breaks the
    // GLOBAL `UNIQUE(slug, version)` constraint the moment two people fork one starter.
    expect(forked.slug).not.toBe("risk-register")
  })

  // ⚠ The section-order case that lived here was DELETED — see the block comment above the
  // create-affordance describe for the authorization and the reason.
})

describe("WorkflowsPage — Open a draft loads it in the Builder (edit-in-place)", () => {
  it("Open passes the draft's definition + id → the Builder shows its steps, not the describe box", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const draftCard = await screen.findByTestId("draft-card")
    fireEvent.click(within(draftCard).getByTestId("draft-open"))
    // The draftRow's existing phase ("draft" slug) renders as a spine node.
    expect(await screen.findByTestId("spine-node-draft")).toBeInTheDocument()
    // NOT the describe-first empty screen.
    expect(screen.queryByTestId("describe-hint")).not.toBeInTheDocument()
    // Edit-in-place: no fork (createWorkflowDraft) on Open.
    expect(mockCreateDraft).not.toHaveBeenCalled()
  })

  it("the create affordance opens a TRUE fresh build (the 'both' door chooser, no initial)", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    // 192-10 (D-02): same seam, new click target. `openBuilderFresh` →
    // `setBuilderInitial(null)` + `setPageView("builder")` is UNCHANGED — 192 must not move
    // Phase 193's authoring doors, only the affordance that reaches them.
    fireEvent.click(await screen.findByTestId("library-create"))
    // Fresh build → the chooser, NOT an already-loaded definition's spine nodes.
    expect(await screen.findByTestId("workflow-doors")).toBeInTheDocument()
    expect(screen.queryByTestId("spine-node-draft")).not.toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 192-11 — WHERE THE REQUIREMENTS ACQUIRE EVIDENCE
//
// Everything above this line proves a MECHANISM. Everything below proves a REQUIREMENT, at
// the surface a user actually touches and at the scale the operator chose. The distinction
// is the whole point of this plan: five earlier plans each showed that a part works; none of
// them showed that LIB-01…04 are TRUE.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("WorkflowsPage — LIB-01 / SC#1: search finds a row among 200 (D-07 scope)", () => {
  it("SC#1 — three characters of ONE workflow's name narrow 200 rendered rows to that one row", async () => {
    mountBulk()
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL), { timeout: 8000 })
    // The scale is REAL: 200 rows through the real merge, the real filter and the real DOM.
    expect(BULK_INDICES).toHaveLength(BULK_TOTAL)

    setSearch(pad3(PURPOSE_ONLY_INDEX + 1)) // "043" — three characters of ONE name
    await waitFor(() => expect(renderedCards()).toHaveLength(1))
    expect(within(renderedCards()[0]).getByText(bulkName(43))).toBeInTheDocument()
    // …and the other 199 are NOT rendered. Asserting the survivor alone would pass on a list
    // that never narrowed at all.
    expect(screen.queryByText(bulkName(44))).toBeNull()
    expect(screen.queryByText(bulkName(143))).toBeNull()
  })

  it("D-07 — a word that appears ONLY in the purpose sentence finds the row too (wider than SC#1's literal bar)", async () => {
    mountBulk()
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL), { timeout: 8000 })

    setSearch(PURPOSE_ONLY_WORD)
    await waitFor(() => expect(renderedCards()).toHaveLength(1))
    const card = renderedCards()[0]
    expect(within(card).getByText(bulkName(PURPOSE_ONLY_INDEX))).toBeInTheDocument()
    // THE HALF SC#1'S WORDING DOES NOT REACH: the word is absent from the name and present in
    // the purpose the reader can already see on the card (`soul-purpose`, the hero atom).
    expect(bulkName(PURPOSE_ONLY_INDEX)).not.toContain(PURPOSE_ONLY_WORD)
    expect(within(card).getByTestId("soul-purpose").textContent).toContain(PURPOSE_ONLY_WORD)
  })

  it("⚠ MEASURED, NOT ASSUMED: the search hit is NOT highlighted today — D-07's second half is unshipped", async () => {
    // This case asserts a GAP, deliberately, and it is named so the intent survives reading.
    //
    // D-07 reads "…with the hit highlighted". The highlight is NOT shipped: `WorkflowCard`
    // renders `row.name` and the purpose atom as plain text and takes no query prop at all, so
    // no module on the library surface consumes the shared highlight component. 192-09's own
    // SUMMARY records the same fact from the other side ("this card renders no highlight at
    // all"). Wiring it is a SOURCE change across two files this plan is not allowed to touch —
    // it is recorded as owed rather than quietly asserted as present.
    mountBulk()
    await waitFor(() => expect(renderedCards().length).toBeGreaterThan(0), { timeout: 8000 })
    setSearch(pad3(PURPOSE_ONLY_INDEX))
    await waitFor(() => expect(renderedCards()).toHaveLength(1))

    expect(document.querySelector("mark")).toBeNull()

    // POSITIVE CONTROL — the selector above is not vacuous: it finds a highlight the instant a
    // real one renders, so the null result is a fact about the surface and not about the query.
    const control = render(<HighlightTitle title={bulkName(PURPOSE_ONLY_INDEX)} query="042" />)
    expect(control.container.querySelector("mark")?.textContent).toBe("042")
    // And the shipped behaviour a future wiring must match: the FIRST match only.
    const twice = render(<HighlightTitle title="risk risk" query="risk" />)
    expect(twice.container.querySelectorAll("mark")).toHaveLength(1)
  })

  it("D-08 — the paraphrase \"the thing that checks vendors\" returns ZERO rows, honestly, with one click out (a LIMITATION, asserted on purpose)", async () => {
    // The search is SUBSTRING matching, not meaning. This case exists to keep that true: if a
    // later phase quietly upgrades the engine, this test is what fails first and asks whether
    // the copy, the placeholder and this decision were all revisited together.
    mountBulk()
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL), { timeout: 8000 })

    setSearch("the thing that checks vendors")
    await waitFor(() => expect(renderedCards()).toHaveLength(0))
    // "none match what you asked for" is a DIFFERENT FACT from "you have none", and the page
    // holds them apart rather than collapsing both into one blank surface.
    expect(screen.getByTestId("library-filtered-empty")).toBeInTheDocument()
    expect(screen.queryByTestId("library-empty")).toBeNull()
    // …and the way out is one click, and it really works.
    fireEvent.click(screen.getByTestId("library-clear-all"))
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL), { timeout: 8000 })
  })
})

describe("WorkflowsPage — LIB-02 / SC#2: every chip's number is the number it delivers (D-03)", () => {
  it("at 200 rows, and under TWO different live searches, chipCount(c) === the rows clicking c renders", async () => {
    // ⚠ THE EXPECTED VALUE IS COMPUTED FROM THE DOM, NEVER FROM THE FIXTURE ARRAY. Deriving it
    // from the fixtures would re-implement the six predicates in the test and prove only that
    // the test agrees with itself. The rule asserted here is the mechanical form of D-03's
    // promise: the number on the chip is the number clicking it gives you.
    mountBulk()
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL), { timeout: 8000 })

    // A seventh chip would be unaudited by a fixed loop, so the chip COUNT is pinned too.
    expect(within(screen.getByTestId("library-chips")).getAllByRole("button")).toHaveLength(
      CHIPS.length,
    )

    for (const query of ["", SHARED_PURPOSE_WORD]) {
      setSearch(query)
      for (const chip of CHIPS) {
        const promised = chipCount(chip)
        fireEvent.click(screen.getByTestId(`library-chip-${chip}`))
        // Six assertions per query, ONE PER ChipId, each named so a failure says which chip
        // broke its promise rather than only that some number disagreed.
        await waitFor(() =>
          expect(
            renderedCards(),
            `chip "${chip}" promised ${promised} rows under query "${query}"`,
          ).toHaveLength(promised),
        )
        fireEvent.click(screen.getByTestId(`library-chip-${chip}`)) // release it again
      }
    }
  }, 60000)

  it("a chip whose count is ZERO still renders — the question stays askable (the honest-empty-state rule)", async () => {
    mountBulk()
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL), { timeout: 8000 })
    // A name search that can only match ONE published row leaves three chips at zero.
    setSearch(pad3(PURPOSE_ONLY_INDEX))
    await waitFor(() => expect(renderedCards()).toHaveLength(1))

    for (const chip of ["still-building", "starters"]) {
      expect(screen.getByTestId(`library-chip-${chip}`)).toBeInTheDocument()
      expect(chipCount(chip)).toBe(0)
    }
    // …and a zero is a real zero: clicking it renders nothing and says so, rather than hiding.
    fireEvent.click(screen.getByTestId("library-chip-starters"))
    await waitFor(() => expect(renderedCards()).toHaveLength(0))
    expect(screen.getByTestId("library-filtered-empty")).toBeInTheDocument()
  })
})

describe("WorkflowsPage — the RUN CARVE-OUT at scale (D-16, T-192-03)", () => {
  it("a refused /workflows/drafts subtracts EXACTLY itself out of 200 rows, and the carve-out counts say so", async () => {
    // The case above (192-10's) proves the PROPERTY at four rows: a rejected gated feed
    // renders the two ungated ones. This one proves the same property is ARITHMETICALLY EXACT
    // at 200 — the refusal removes the 60 drafts and nothing else — and it adds the half no
    // earlier case covers: THE CHIP COUNTS STAY HONEST UNDER A FAILED SOURCE. A count is the
    // one thing a partial library could fabricate without anybody noticing, because a number
    // that describes rows nobody can reach looks exactly like a number that describes rows
    // they can.
    mockListPublished.mockResolvedValue(bulkPublished)
    mockListStarters.mockResolvedValue(bulkStarters)
    mockListDrafts.mockRejectedValue(new Error("403 Forbidden"))

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await waitFor(
      () => expect(renderedCards()).toHaveLength(BULK_PUBLISHED + BULK_STARTERS),
      { timeout: 8000 },
    )

    // Exactly the refused feed is missing — and it is missing ENTIRELY, not partially.
    expect(renderedOfKind("draft")).toHaveLength(0)
    expect(renderedOfKind("published")).toHaveLength(BULK_PUBLISHED)
    expect(renderedOfKind("starter")).toHaveLength(BULK_STARTERS)

    // The counts describe what is reachable, and the refused feed's chip reads a true zero
    // rather than the number it would have had.
    expect(chipCount("ready-to-run")).toBe(BULK_PUBLISHED + BULK_STARTERS)
    expect(chipCount("still-building")).toBe(0)
    expect(chipCount("starters")).toBe(BULK_STARTERS)

    // The refusal is NAMED — a partial library is never presented as a complete one — and
    // the two feeds that answered say nothing, because nothing went wrong with them.
    expect(screen.getByTestId("library-source-failed-draft").textContent).toContain("your drafts")
    expect(screen.queryByTestId("library-source-failed-published")).toBeNull()
    expect(screen.queryByTestId("library-source-failed-starter")).toBeNull()
    // …and "you have none" is never shown over a library that has 140 rows.
    expect(screen.queryByTestId("library-empty")).toBeNull()
  })
})

describe("WorkflowsPage — D-17: the project filter holds STARTERS out, and says so", () => {
  /** The server's own contract, simulated: `?project_folder_id=` narrows `/published` only. */
  function serveNarrowedPublished() {
    mockListPublished.mockImplementation(async (projectArg: string | null) =>
      projectArg == null
        ? bulkPublished
        : bulkPublished.filter((row) => row.definition.project_folder_id === projectArg),
    )
    mockListStarters.mockResolvedValue(bulkStarters)
    mockListDrafts.mockResolvedValue(bulkDrafts)
  }

  it("selecting a project narrows published (server) and drafts (client) while EVERY starter stays, with the reason as real text", async () => {
    const boundPublished = bulkPublished.filter(
      (row) => row.definition.project_folder_id === "folder-aaa",
    )
    const boundDrafts = bulkDrafts.filter(
      (row) => row.definition.project_folder_id === "folder-aaa",
    )
    // The fixture has to actually exercise a NARROW; a filter that removes nothing proves
    // nothing about a filter.
    expect(boundPublished.length).toBeGreaterThan(0)
    expect(boundPublished.length).toBeLessThan(BULK_PUBLISHED)
    expect(boundDrafts.length).toBeGreaterThan(0)
    expect(boundDrafts.length).toBeLessThan(BULK_DRAFTS)

    serveNarrowedPublished()
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL), { timeout: 8000 })
    // THE NEGATIVE CASE FIRST: with "All projects" there is nothing to explain, so the note
    // is ABSENT. A note that is always present states nothing.
    expect(screen.queryByTestId("library-project-note")).toBeNull()

    selectProject("folder-aaa")
    await waitFor(() => expect(renderedOfKind("published")).toHaveLength(boundPublished.length), {
      timeout: 8000,
    })
    // Drafts narrow CLIENT-side on their own project binding…
    expect(renderedOfKind("draft")).toHaveLength(boundDrafts.length)
    // …and every starter is still on screen. This is the row that would read as a broken
    // filter if the surface said nothing about it.
    expect(renderedOfKind("starter")).toHaveLength(BULK_STARTERS)
    expect(renderedCards()).toHaveLength(
      boundPublished.length + boundDrafts.length + BULK_STARTERS,
    )

    // D-17: SILENCE HERE IS A UAT FAILURE (row U6), NOT A NEUTRAL DEFAULT. The note is
    // asserted by its TEXT — a present-but-blank node must not pass — and by the literal
    // sentence rather than by the constant, so emptying the constant would fail this too.
    const note = screen.getByTestId("library-project-note")
    expect(note.textContent).toBe("Starters aren't tied to a project.")
    // It reaches a screen reader on the control it explains, as real DOM text.
    const select = screen.getByTestId("library-project-select")
    expect(select.getAttribute("aria-describedby")).toBe(note.getAttribute("id"))
  })

  it("D-17's companion rule — a PENDING project re-query never zeroes a count, and the updating marker appears then disappears", async () => {
    // PATTERNS "No Analog Found" G-B: no shipped surface in this codebase holds
    // previously-committed rows with correct counts while a re-query is in flight. This is
    // that pattern's only mechanical guard.
    let release: (rows: unknown[]) => void = () => {}
    const held = new Promise<unknown[]>((r) => (release = r))
    mockListPublished.mockReset()
    mockListPublished
      .mockResolvedValueOnce(bulkPublished) // the mount fetch
      .mockReturnValueOnce(held) // the project re-query — held open
    mockListStarters.mockResolvedValue(bulkStarters)
    mockListDrafts.mockResolvedValue(bulkDrafts)

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL), { timeout: 8000 })
    // Settled: the marker is ABSENT. A marker that is always present distinguishes nothing.
    await waitFor(() => expect(screen.queryByTestId("library-updating")).toBeNull())

    selectProject("folder-aaa")
    const boundDrafts = bulkDrafts.filter(
      (row) => row.definition.project_folder_id === "folder-aaa",
    )
    const stillOnScreen = BULK_PUBLISHED + BULK_STARTERS + boundDrafts.length

    // IN FLIGHT: the marker is up, machine-readably…
    expect(screen.getByTestId("library-updating").getAttribute("data-state")).toBe("updating")
    // …the previously-committed published rows are ALL still rendered (blanking a settled
    // source to signal motion is the count-zeroing this rule forbids by name)…
    expect(renderedOfKind("published")).toHaveLength(BULK_PUBLISHED)
    expect(renderedCards()).toHaveLength(stillOnScreen)
    // …NO count has been zeroed…
    for (const chip of CHIPS) expect(chipCount(chip)).toBeGreaterThan(0)
    // …and the counts still describe exactly the rows on screen: the three provenances
    // partition the list, so their two chips must sum to it.
    expect(chipCount("ready-to-run") + chipCount("still-building")).toBe(stillOnScreen)

    // SETTLED: the answer lands, the list narrows, and the marker goes away again.
    const boundPublished = bulkPublished.filter(
      (row) => row.definition.project_folder_id === "folder-aaa",
    )
    release(boundPublished)
    await waitFor(() =>
      expect(renderedCards()).toHaveLength(
        boundPublished.length + boundDrafts.length + BULK_STARTERS,
      ),
    )
    await waitFor(() => expect(screen.queryByTestId("library-updating")).toBeNull())
  })
})

describe("WorkflowsPage — D-04: is_mine agrees with feed-derived provenance (the cross-check 192-02 raised)", () => {
  it("over the merged list, is_mine === (provenance !== \"starter\") for every row the wire supplies it on", async () => {
    // ⚠ THE CROSS-CHECK OWED SINCE 192-02, AND THE REASON IT IS A CROSS-CHECK RATHER THAN A
    // SOURCE OF TRUTH: `mergeLibrary` assigns provenance from FEED ORIGIN, and `is_mine` is
    // computed independently server-side. Two independent answers to "is this mine?" that are
    // never compared is how a disagreement ships unnoticed — the *Yours* chip would then
    // promise one set and the list deliver another, which is exactly what LIB-02 forbids.
    const merged = [
      ...bulkPublished.map((row) => ({ is_mine: row.is_mine, provenance: "published" as const })),
      ...bulkStarters.map((row) => ({ is_mine: row.is_mine, provenance: "starter" as const })),
    ]
    expect(merged).toHaveLength(BULK_PUBLISHED + BULK_STARTERS)
    for (const row of merged) expect(row.is_mine).toBe(row.provenance !== "starter")

    // POSITIVE CONTROL — the check is not vacuous. A starter the backend called ours FAILS it.
    expect(() => {
      const contradiction = { is_mine: true, provenance: "starter" as const }
      expect(contradiction.is_mine).toBe(contradiction.provenance !== "starter")
    }).toThrow()

    // And the same agreement, observed THROUGH THE SURFACE: the *Yours* chip promises, and
    // then delivers, exactly the non-starter rows of the rendered list.
    mountBulk()
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL), { timeout: 8000 })
    const notStarters = BULK_TOTAL - renderedOfKind("starter").length
    expect(chipCount("yours")).toBe(notStarters)
    fireEvent.click(screen.getByTestId("library-chip-yours"))
    await waitFor(() => expect(renderedCards()).toHaveLength(notStarters))
    expect(renderedOfKind("starter")).toHaveLength(0)
  })

  it("with is_mine ABSENT from the wire, the Yours chip is still CORRECT — not merely non-fatal", async () => {
    // A frontend deployed ahead of its backend. Reading a missing bit as `false` would render
    // an EMPTY *Yours* chip — the failure shape that looks like lost data — so the contract is
    // to fall back to feed origin instead. "Degraded" has to mean slower or plainer, never
    // wrong.
    mountBulk({
      published: bulkPublished.map(stripIsMine),
      starters: bulkStarters.map(stripIsMine),
    })
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL), { timeout: 8000 })

    expect(chipCount("yours")).toBe(BULK_PUBLISHED + BULK_DRAFTS)
    expect(chipCount("yours")).toBeGreaterThan(0)
    fireEvent.click(screen.getByTestId("library-chip-yours"))
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_PUBLISHED + BULK_DRAFTS))
    expect(renderedOfKind("starter")).toHaveLength(0)
    expect(renderedOfKind("published")).toHaveLength(BULK_PUBLISHED)
    expect(renderedOfKind("draft")).toHaveLength(BULK_DRAFTS)
  })
})

describe("WorkflowsPage — back-nav refreshes the library lists", () => {
  it("the ← Workflows back button refetches drafts + published", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    // Enter the Builder host via a fresh build (does not itself refetch). The fresh
    // build opens the two-door chooser.
    fireEvent.click(await screen.findByTestId("library-create"))
    await screen.findByTestId("workflow-doors")
    mockListDrafts.mockClear()
    mockListPublished.mockClear()
    // Back to the library → both lists refresh (newly-created drafts appear w/o F5).
    fireEvent.click(screen.getByTestId("builder-back"))
    await waitFor(() => expect(mockListDrafts).toHaveBeenCalledTimes(1))
    expect(mockListPublished).toHaveBeenCalledTimes(1)
    // The library is back — witnessed by its persistent toolbar, which is what 157-B put in
    // the place three shelves used to occupy.
    expect(await screen.findByTestId("library-toolbar")).toBeInTheDocument()
  })
})
