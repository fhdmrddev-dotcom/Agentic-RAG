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
import { render, screen, within, waitFor, fireEvent, configure } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

/**
 * ⚠ 192-11 — MEASURED, THEN HARDENED. `waitFor`'s 1 s default is not enough for this file any
 * more: the 200-row cases below re-render two hundred cards on every keystroke and chip click,
 * and the FIRST wide run of `src/pages src/components/workflows/library` (22 files, four
 * workers) produced ONE `waitFor` timeout that four consecutive re-runs did not reproduce.
 *
 * A test that fails once in five is worse than no test, so the patience is raised rather than
 * the flake tolerated. This changes NOTHING about what any assertion checks: a genuinely
 * broken expectation still fails, it just reports after 15 s instead of 1 s, and a passing run
 * is not slowed at all because `waitFor` returns as soon as its callback succeeds. It is the
 * project's `GSD_VITEST_MAX_WORKERS=4` lesson one layer up — oversubscription surfaces as bare
 * timeouts in code nobody touched.
 */
configure({ asyncUtilTimeout: 15000 })

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
  mockDeletePreview,
  mockDeleteCascade,
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
  mockDeletePreview: vi.fn(),
  mockDeleteCascade: vi.fn(),
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
  // 204-03 (SCHED-01) — THE MEASURED MOCK BUDGET, SPENT IN THE COMMIT THAT ADDED THE EXPORTS.
  // A whole-module `vi.mock("@/lib/api")` factory that omits a newly-added RUNTIME export makes
  // every suite reaching it throw AT MOUNT, far from the cause: `196-08` cost 249 red tests
  // exactly this way. `WorkflowsPage` now mounts `WorkflowScheduleModal`, which imports these
  // six. They resolve to empty/no-op answers because no case here opens the schedules dialog —
  // their job is to EXIST.
  listSchedules: () => Promise.resolve([]),
  listWorkflowSchedules: () => Promise.resolve([]),
  createWorkflowSchedule: () => Promise.resolve({}),
  updateSchedule: () => Promise.resolve({}),
  deleteSchedule: () => Promise.resolve(undefined),
  triggerSchedule: () => Promise.resolve({ launched: false }),
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
  // ⚠ 192-11 (D-18): the CASCADE PAIR is listed for the opposite reason to everything else in
  // this factory — not because something reaches it, but so that "the draft path never reaches
  // it" is an ASSERTION rather than an absence nobody can observe. A `vi.fn()` that was never
  // registered cannot be checked with `not.toHaveBeenCalled`; it can only throw somewhere else.
  // The published row's heavier grade DOES reach both, which is how the two grades are proved
  // distinct here rather than merely described as distinct.
  getWorkflowDeletePreview: mockDeletePreview,
  deleteWorkflowCascade: mockDeleteCascade,
  // 196-08 (AUTH-04) — see the note in `WorkflowBuilderPage.describe.test.tsx`: this page's
  // rows reach the Builder, which reads the author model registry at mount.
  getAuthorModelRegistry: () => Promise.resolve({ models: [], run_default_model: null }),
}))

import { WorkflowsPage } from "./WorkflowsPage"
// 192-11 (D-07) — imported for ONE job: to be the POSITIVE CONTROL of the highlight
// measurement below. Nothing on the library surface renders it today, and the test that says
// so would be worthless without a demonstration that the selector it uses can find a real one.
import { HighlightTitle } from "@/lib/threadGroups"
// 192.2-05 (D-03) — the tier derivation, asked DIRECTLY now that the card no longer renders a
// chip to read it off. The claim (WR-03: strictest emit wins, order-independent) is unchanged;
// what moved is that it is now tested at the derivation rather than through one surface.
import { tierForDefinition } from "@/components/workflows/soulData"
// 192-14 (U5) — the two consequence sentences, read from their ONE home rather than re-typed.
// A test that hardcodes the copy cannot notice the card drifting off it, and the whole point
// of the sentence is that it agrees with what the verb actually does.
// 192-15 (WR-03) — `forkFailedMessage` joins them for the same reason: the notice's text is
// asserted against the vocabulary FUNCTION, never a re-typed literal, so a copy edit can make
// these cases fail loudly rather than make them vacuous.
import {
  FORK_CONSEQUENCE,
  FORK_CONSEQUENCE_EXISTING,
  // 192.1-07 (D-20): the collision WARNING, imported rather than spelled — a test that types
  // the sentence inline has forked the acceptance bar the generated contract exists to hold.
  FORK_HINT_CLASH,
  forkFailedMessage,
  // 192.2-09 (WR-04): the reason line's fixed parts and its words. Two of the three ARE the
  // chip labels, so asserting against these exports is what proves the chip a person pressed
  // and the reason the row gives back are ONE word rather than two that agree today.
  MATCH_REASON_PREFIX,
  MATCH_REASON_WORDS,
} from "@/components/workflows/library/libraryVocabulary"
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

/**
 * 192-14 (the U5 blocker) — THE DRAFT THE OPERATOR ALREADY HAS OF `vendor-risk`.
 *
 * Same slug as `strictPublished` above, at version 2. This one fixture is the entire reason
 * the U5 blocker was invisible to 3176 passing tests: every fork fixture in this file forks a
 * slug that NOTHING else in the seeded feeds shares, so the shipped suite only ever exercised
 * the FIRST fork of a workflow. In the live DB that shape is the minority — 18 slugs carry
 * more than one version and 14 of those are exactly `published v1 + draft v2` (re-measured by
 * `192-13`; the plan authorising it said 16).
 *
 * ⚠ Its phase slug is `tuneup`, deliberately unlike the published def's `pull`/`emit`, so
 * "the Builder opened THIS definition" is an assertion the DOM can carry rather than an
 * inference. Its `token` is the 186-07 concurrency guard `onOpenDraft` threads.
 */
const existingForkDraft = {
  id: "draft-vendor-risk",
  slug: "vendor-risk",
  version: 2,
  name: "Vendor-risk review",
  token: "tok-existing",
  definition: {
    slug: "vendor-risk",
    version: 2,
    phases: [{ slug: "tuneup", phase_index: 0, config: { phase_type: "llm_agent" } }],
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

/**
 * 192.1-07 (LIB-05 / D-19) — THE STEP 162-B PUT BETWEEN THE CLICK AND THE POST.
 *
 * ⚠ EVERY SHIPPED FORK CASE IN THIS FILE THAT REACHES `createWorkflowDraft` NOW CALLS THIS,
 * AND THAT IS STATED PLAINLY RATHER THAN SLIPPED IN. The plan required 192-14's cases at
 * `:886` and T-192-42's at `:1081` to stay green with their assertions unchanged, and they
 * are: **not one `expect(…)` line in this file was edited to accommodate the prompt.** What
 * changed is the INTERACTION — a fork click now opens a dialog, and a test that never types a
 * name is a test of a person who walked away. The three cases at `:886` that assert the
 * already-forked path are untouched even here, because D-23 means no prompt appears on them.
 *
 * The one assertion that DID move is `:862`'s Builder caption, and it moved because the
 * behaviour did: the header used to read the parent's SLUG and now reads the typed NAME.
 *
 * ⚠ NO `findBy` ON AN ABSENT NODE (T-4). This file sets `asyncUtilTimeout: 15000`, longer than
 * vitest's 5 s per-test budget, so a `findByTestId` for a dialog that never mounts blows the
 * TEST timeout and yields a RED indistinguishable from D-192-DEF-01's timeout class. Here the
 * node is expected to be PRESENT, which is the safe direction; the cases that assert its
 * ABSENCE wait on a node that is present on their own path first, then query synchronously.
 */
async function nameTheCopy(user: Awaited<ReturnType<typeof openOverflow>>, name: string) {
  const field = await screen.findByTestId("fork-name-input")
  await user.type(field, name)
  await user.click(screen.getByTestId("fork-name-create"))
}

/** The name typed at the prompt in the shipped fork cases, in one place so a case can read it. */
const TYPED_NAME = "My vendor-risk copy"

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

/**
 * ⚠ **THIS BLOCK READ *"card renders the shared WorkflowSoul"* AND 192.2-05's D-03 REVERSES IT.**
 * Rendering the real component (sketch 179 variant A) measured the shipped card at NINE
 * information rows deep, and the operator picked variant C, which cuts five of them — the
 * purpose hero, the needs line, the glyph-dot spine, the tier chip and the deliverable. Both
 * cases are RE-POINTED rather than deleted: what each one really guards (no ad-hoc trio came
 * back; the page still makes exactly ONE fetch) is asserted here as hard as before.
 *
 * ⚠ `WorkflowSoul` AND ITS TIER DERIVATION ARE UNTOUCHED — they are CONSUMED by this page, not
 * owned by it, and still render at `scale="run"` and `scale="pub"`. Their own coverage lives in
 * `components/workflows/soulData.test.ts` and `deriveTier.test.ts`.
 */
describe("WorkflowsPage — D-03: the card is quiet, and the page still fetches once", () => {
  it("a published card renders NO soul — and none of the pre-192 ad-hoc trio came back either", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    // ⚠ INVERTED. The card-scale soul mount left with D-03; five atoms left with it.
    expect(within(cards[0]).queryByTestId("workflow-soul")).not.toBeInTheDocument()
    expect(within(cards[0]).queryByTestId("soul-tier")).not.toBeInTheDocument()
    expect(within(cards[0]).queryByTestId("soul-spine")).not.toBeInTheDocument()
    // UNCHANGED, and still the point of the case: the OLD ad-hoc trio stays gone. A
    // subtraction that quietly re-admitted the thing 192 removed would be no subtraction.
    expect(within(cards[0]).queryByTestId("tier-badge")).not.toBeInTheDocument()
    expect(within(cards[0]).queryByTestId("phase-chain")).not.toBeInTheDocument()
    // POSITIVE CONTROL — the card really rendered. D-01's line 2 is what stands there now.
    expect(within(cards[0]).getByTestId("row-answer")).toBeInTheDocument()
  })

  it("every card's answer comes from the FEED — one list fetch, and no per-card call", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    // ⚠ RE-POINTED FROM THE TIER CHIP TO THE RUN TRUTH, and the claim is CONTEXT's constraint
    // verbatim: *"Feed-level only. Run facts arrive with the list; no per-card fetch (107+
    // rendered rows)."* The tier chip used to be this surface's window onto that rule; line 2
    // is the window now, and the rule is the same rule.
    expect(within(cards[0]).getByTestId("row-answer")).toBeInTheDocument()
    expect(within(cards[1]).getByTestId("row-answer")).toBeInTheDocument()
    expect(within(cards[0]).getByTestId("run-gutter")).toBeInTheDocument()
    expect(mockListPublished).toHaveBeenCalledTimes(1)
  })
})

describe("WorkflowsPage — the soul tier picks the STRICTEST emit policy (WR-03, order-independent)", () => {
  it("a [flag, strict, partial] multi-emit def derives STRICT regardless of phase order", async () => {
    // Old logic only overwrote on 'strict' after the first emit set the policy, so a
    // 'partial' following a 'flag' was dropped and order mattered. The shared soulData
    // derivation uses a deterministic stricter-wins comparison: the strict emit wins.
    //
    // ⚠ 192.2-05 — THE CLAIM IS UNCHANGED AND THE WINDOW ONTO IT MOVED. D-03 cut the tier chip
    // from the card, so this case can no longer read the derivation off a rendered row. It
    // asks `tierForDefinition` DIRECTLY instead, which is strictly stronger: it now tests the
    // derivation rather than one surface's rendering of it. The page half of the case is kept
    // too, and is now the D-03 assertion — this definition renders a card with no tier at all.
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
    // The derivation, asked directly. `[flag, strict, partial]` — the strict emit wins
    // whatever order the phases arrive in.
    expect(tierForDefinition(multiEmit.definition as never).id).toBe("STRICT")

    mockListPublished.mockResolvedValue([multiEmit])
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const card = await screen.findByTestId("published-card")
    // …and the card says nothing about it, on a row whose tier is unambiguously STRICT. That
    // is D-03: the tier is a real fact this surface deliberately no longer spends a slot on.
    expect(within(card).queryByTestId("soul-tier")).not.toBeInTheDocument()
    expect(card).not.toHaveTextContent("STRICT")
    expect(within(card).getByTestId("row-answer")).toBeInTheDocument()
  })

  // ══════════════════════════════════════════════════════════════════════════════════
  // 192.2-09 (WR-04) — THE AMENDMENT. IT IS AN INVERSION-IN-PLACE, NOT A REPLACEMENT.
  // ══════════════════════════════════════════════════════════════════════════════════
  //
  // The case directly above recorded a TRADE-OFF and called it intended: a STRICT row says
  // nothing about its tier. Code review measured that the trade-off had grown teeth — the
  // *Strict* chip still SELECTS on the tier D-03 cut, so filtering by it returned rows
  // carrying no visible evidence of the property that selected them, and `chipCounts`
  // published a number for a fact the surface would not show.
  //
  // ⚠ THE ORIGINAL ASSERTION IS NOT DELETED, AND ITS PROPERTY IS STILL TRUE. What changed is
  // that it is now true of the RESTING card only. This phase's re-baseline discipline is
  // INVERSION, never removal (`WorkflowCard.baseline.test.tsx`'s §6 states the rule): an
  // assertion that merely stops being checked can come back silently. So the case above keeps
  // the at-rest half verbatim, and these two add the halves it could not have had — the card
  // explaining itself once the chip IS pressed, and the same for a purpose-only search hit.

  it("with the Strict chip PRESSED, the row states the reason it was selected (WR-04)", async () => {
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
        ],
      },
    }
    expect(tierForDefinition(multiEmit.definition as never).id).toBe("STRICT")

    mockListPublished.mockResolvedValue([multiEmit])
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const restingCard = await screen.findByTestId("published-card")
    // AT REST — the original property, preserved verbatim here as well as above, so this
    // case cannot pass on a page that simply shows the tier all the time.
    expect(within(restingCard).queryByTestId("row-match-reason")).toBeNull()
    expect(restingCard).not.toHaveTextContent("STRICT")

    fireEvent.click(screen.getByTestId("library-chip-strict"))

    const card = await screen.findByTestId("published-card")
    const reason = within(card).getByTestId("row-match-reason")
    expect(reason).toHaveTextContent(MATCH_REASON_PREFIX)
    // Asserted against the EXPORT — which is `CHIP_WORDS.strict.label`, i.e. the chip's own
    // word. The row answers with the word the person pressed.
    expect(reason).toHaveTextContent(MATCH_REASON_WORDS.strict)
  })

  it("with the Makes a file chip PRESSED, the row states that reason too (WR-04)", async () => {
    const emitsFile = {
      id: "pub-file",
      slug: "emits-a-file",
      name: "Emits a file",
      definition: {
        slug: "emits-a-file",
        version: 1,
        project_folder_id: null,
        phases: [
          { slug: "e1", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "flag" } },
        ],
      },
    }
    mockListPublished.mockResolvedValue([emitsFile])
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const restingCard = await screen.findByTestId("published-card")
    expect(within(restingCard).queryByTestId("row-match-reason")).toBeNull()

    fireEvent.click(screen.getByTestId("library-chip-makes-a-file"))

    const card = await screen.findByTestId("published-card")
    expect(within(card).getByTestId("row-match-reason")).toHaveTextContent(
      MATCH_REASON_WORDS["makes-a-file"],
    )
  })

  it("a search word that lives ONLY in the purpose says so, on the returned row (WR-04)", async () => {
    // The instance `192.2-05` recorded: D-03 cut the purpose hero while the search still
    // matches inside `business_requirement`, so a hit could arrive with nothing on the card
    // to explain it. ⚠ The reason NAMES the field and never quotes the sentence (T-192.2-40).
    const purposeOnly = {
      id: "pub-purpose",
      slug: "quarterly-recap",
      name: "Quarterly recap",
      definition: {
        slug: "quarterly-recap",
        version: 1,
        project_folder_id: null,
        business_requirement: "Check every supplier against the approved register.",
        phases: [{ slug: "a", phase_index: 0, config: { phase_type: "llm_agent" } }],
      },
    }
    mockListPublished.mockResolvedValue([purposeOnly])
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const restingCard = await screen.findByTestId("published-card")
    expect(within(restingCard).queryByTestId("row-match-reason")).toBeNull()
    // The needle is in the purpose and NOT in the name — otherwise `HighlightTitle` would
    // already have answered and the reason would (correctly) stay silent.
    expect(purposeOnly.name.toLowerCase()).not.toContain("supplier")

    setSearch("supplier")

    const card = await screen.findByTestId("published-card")
    const reason = within(card).getByTestId("row-match-reason")
    expect(reason).toHaveTextContent(MATCH_REASON_WORDS.purpose)
    // The user-authored sentence itself stays off the card.
    expect(reason.textContent).not.toContain(purposeOnly.definition.business_requirement)
  })

  it("a search word in the NAME adds no reason — HighlightTitle already answered it", async () => {
    const named = {
      id: "pub-named",
      slug: "supplier-review",
      name: "Supplier review",
      definition: {
        slug: "supplier-review",
        version: 1,
        project_folder_id: null,
        business_requirement: "Check every supplier against the approved register.",
        phases: [{ slug: "a", phase_index: 0, config: { phase_type: "llm_agent" } }],
      },
    }
    mockListPublished.mockResolvedValue([named])
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await screen.findByTestId("published-card")

    setSearch("supplier")

    // The row IS in the filtered set — non-vacuity, so the silence below is not an artifact
    // of an empty list — and it still says nothing extra, because the name hit is visible.
    const card = await screen.findByTestId("published-card")
    expect(within(card).queryByTestId("row-match-reason")).toBeNull()
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
    // ⚠ 214-09 (STEP-02 / D-214-04): this line USED TO ASSERT `run-hint` PRESENT. The hint
    // became real fields, and the assertion is INVERTED rather than deleted so a
    // re-introduction reds. `strictPublished` declares only the reserved `kickoff_prompt`,
    // which the kickoff textarea already collects — so this workflow draws no extra field
    // and the "exactly one textbox" count above is unchanged, which is the point.
    expect(within(modal).queryByTestId("run-hint")).toBeNull()
    expect(within(modal).queryAllByTestId(/^run-input-/)).toHaveLength(0)
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
    // 214-09 (STEP-02 / D-214-04): a THIRD member rides every invocation — `inputs`, the
    // declared-input dict. `{}` here, and `{}` rather than `undefined` is the contract: an
    // absent key and an empty object are different facts.
    expect(onLaunch).toHaveBeenCalledWith(strictPublished, "review Acme Corp", {
      templateFile: null,
      folderId: null,
      inputs: {},
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
      inputs: {},
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
    // 192.1-07 (D-19): the copy is named before anything is written. The three slug/version/
    // status assertions below are BYTE-IDENTICAL to the ones this case has always made.
    await nameTheCopy(user, TYPED_NAME)
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
    await nameTheCopy(user, TYPED_NAME)
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
    await nameTheCopy(user, TYPED_NAME)
    await screen.findByTestId("spine-node-pull")
    // The header carries the Tweak caption with the new version.
    // ⚠ 192.1-07 — THE ONE ASSERTION IN THIS FILE THE PROMPT CHANGED, and it changed because
    // the BEHAVIOUR did. It read `/Tweak · vendor-risk v3/` — the parent's SLUG — and the
    // caption now reads the name the person just typed. Showing them the slug back would be
    // the surface disagreeing with the thing they had just told it. The version stays, because
    // it is the one fact the name cannot carry.
    // (Still a substring match, as it always was — `TYPED_NAME` carries no regex metacharacter.)
    expect(screen.getByText(new RegExp(`Tweak · ${TYPED_NAME} v3`))).toBeInTheDocument()
  })
})

/**
 * ══ 192-14 (the U5 BLOCKER) — THE BRANCH 3176 PASSING TESTS COULD NOT REACH ══════════════
 *
 * The three cases above prove the FIRST fork of a workflow, and they are correct. What they
 * cannot see is the second one: every fixture they run against forks a slug no other seeded
 * row shares, so the create always succeeds. On a slug that already carries the version the
 * create tries to mint, `UNIQUE(slug, version)` is GLOBAL and the insert 409s — deterministically,
 * forever, with the shipped `catch` swallowing it into `console.error`. An operator hit exactly
 * that on the live surface (`192-UAT.md` test 11): two clicks, two 409s, nothing on screen and
 * `workflow_definitions` unmoved at 222.
 *
 * ⚠ THE ONLY DIFFERENCE BETWEEN THIS BLOCK AND THE ONE ABOVE IS ONE EXTRA ROW IN THE DRAFTS
 * FEED. That is the whole lesson, and it is the same shape as this phase's CR-01: the suite
 * pinned the branch it expected and never entered the wrong one. The seeding is per-test rather
 * than in the shared `beforeEach`, on purpose — changing the shared fixture would alter what the
 * two shipped fork cases run against, and those two must keep proving the first fork unchanged.
 *
 * The operator's 2026-08-11 decision: on such a row the verb OPENS THE DRAFT YOU ALREADY HAVE.
 * It creates nothing, so it cannot collide — the failure class is removed rather than made rarer.
 */
describe("192-14 (U5 blocker) — forking a slug you ALREADY have a draft of opens that draft", () => {
  /** The unrelated draft the whole file seeds, PLUS an existing v2 fork of `vendor-risk`. */
  function seedExistingFork() {
    mockListDrafts.mockResolvedValue([draftRow, existingForkDraft])
  }

  /**
   * The published `vendor-risk` card, located by the NAME it renders rather than by its index
   * in the list. The extra draft this block seeds changes what the merged list contains, and a
   * positional lookup would quietly start asserting about a different row.
   */
  async function publishedCardNamed(name: string): Promise<HTMLElement> {
    const cards = await screen.findAllByTestId("published-card")
    const card = cards.find((c) => within(c).queryByText(name) !== null)
    expect(card, `no published card renders the name "${name}"`).toBeTruthy()
    return card as HTMLElement
  }

  it("the fork verb creates NOTHING and opens the copy you already started", async () => {
    seedExistingFork()
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const user = await openOverflow(await publishedCardNamed("Vendor-risk review"))
    await user.click(screen.getByTestId("published-tweak"))

    // ⚠ THE LOAD-BEARING ASSERTION, AND IT IS FIRST ON PURPOSE. The shipped code reaches
    // `createWorkflowDraft` here with `{slug: "vendor-risk", version: 3}` — a write that 409s
    // on any slug already carrying that version. Nothing is written on this path at all, so
    // there is no request to fail and nothing to report.
    expect(mockCreateDraft).not.toHaveBeenCalled()
    // Nor is the published row edited — the frozen-published contract is untouched either way.
    expect(mockUpdate).not.toHaveBeenCalled()

    // The Builder opened on the EXISTING draft's OWN definition: `tuneup` is that draft's
    // phase and appears in neither the published def (`pull`/`emit`) nor `draftRow`.
    expect(await screen.findByTestId("spine-node-tuneup")).toBeInTheDocument()
    expect(screen.queryByTestId("spine-node-pull")).not.toBeInTheDocument()
    // And the caption is `onOpenDraft`'s edit-in-place one, never `onTweak`'s fork caption.
    expect(screen.getByText(/Edit · Vendor-risk review v2/)).toBeInTheDocument()
    expect(screen.queryByText(/Tweak · vendor-risk/)).not.toBeInTheDocument()
  })

  it("the publish gauntlet mounts on the EXISTING draft, not on a fork that was never created", async () => {
    // The mirror of the shipped "gauntlet mounts on the NEW forked draft id" case. The gauntlet
    // is gated on a non-null draftId in `renderPublish`, so its trigger mounts on BOTH paths —
    // which is exactly why this case waits on it and then asserts WHICH draft the Builder is
    // holding. A wait that succeeds on both paths cannot fail as a bare timeout and so cannot
    // be confused with the D-192-DEF-01 timeout class this file already carries.
    // (`gauntlet-spine` lives inside the modal the trigger opens, not in the resting view.)
    seedExistingFork()
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const user = await openOverflow(await publishedCardNamed("Vendor-risk review"))
    await user.click(screen.getByTestId("published-tweak"))

    expect(await screen.findByTestId("publish-trigger")).toBeInTheDocument()
    expect(screen.getByText(/Edit · Vendor-risk review v2/)).toBeInTheDocument()
    expect(screen.queryByText(/Tweak · vendor-risk v3/)).not.toBeInTheDocument()
    expect(mockCreateDraft).not.toHaveBeenCalled()
  })

  it("the card SAID so before the click — and only on the row where the behaviour differs", async () => {
    // D-14, mechanically: the sentence and the verb agree in the SAME render. `vendor-risk` has
    // an existing draft, `quick-notes` does not, and both are published rows on one screen.
    //
    // ⚠ 192.2-05 (D-03) — *before the click* now means *in the menu, beside the verb*. The
    // sentence was cut from the RESTING card and relocated to the moment it is needed; the
    // claim is untouched, and the two rows are still read on ONE screen rather than in two
    // renders, which is what makes "only on the row where the behaviour differs" mean anything.
    seedExistingFork()
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const forked = await publishedCardNamed("Vendor-risk review")
    const unforked = await publishedCardNamed("Quick notes")

    // Neither row spends the sentence at rest — the subtraction, asserted on the real page.
    expect(within(forked).queryByTestId("fork-consequence")).not.toBeInTheDocument()
    expect(within(unforked).queryByTestId("fork-consequence")).not.toBeInTheDocument()

    const user = await openOverflow(forked)
    expect(screen.getByTestId("fork-consequence")).toHaveTextContent(FORK_CONSEQUENCE_EXISTING)
    await user.keyboard("{Escape}")

    await openOverflow(unforked)
    expect(screen.getByTestId("fork-consequence")).toHaveTextContent(FORK_CONSEQUENCE)
  })

  it("a STARTER is untouched: it still mints a fresh suffixed slug at v1 even when a draft shares its slug", async () => {
    // ⚠ D-12 FROM THE THIRD SIDE. The two fork handlers are siblings and are NEVER merged, so
    // the new lookup must not leak across: a starter's fork ALWAYS makes a genuinely new copy
    // (fresh auto-suffixed slug at v1), so "you already have one" is false on a starter row
    // even when a draft happens to share its slug — which is why the page's `hasExistingFork`
    // is gated on `provenance === "published"` rather than on the slug alone.
    mockListDrafts.mockResolvedValue([
      draftRow,
      { ...existingForkDraft, id: "draft-risk-register", slug: "risk-register" },
    ])
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const card = await screen.findByTestId("starter-card")
    // ⚠ 192.2-05 (D-03): the sentence is no longer resting chrome, so it is read where it now
    // lives — in the menu, in the SAME open that then clicks the verb. The claim is unchanged:
    // the sentence on a starter row is the ordinary one, same-slug draft or not.
    expect(within(card).queryByTestId("fork-consequence")).not.toBeInTheDocument()

    const user = await openOverflow(card)
    expect(screen.getByTestId("fork-consequence")).toHaveTextContent(FORK_CONSEQUENCE)
    await user.click(screen.getByTestId("use-starter"))
    // 192.1-07 (D-19 / D-12): a starter fork ALWAYS creates, so it ALWAYS asks — there is no
    // "the copy you already started" on a fresh auto-suffixed slug. The three assertions
    // below are unchanged, which is the point of this case: the prompt did not merge the two
    // handlers behind the one word they share.
    await nameTheCopy(user, "My risk register")
    await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(1))
    const forked = mockCreateDraft.mock.calls[0][0]
    expect(forked.slug).toMatch(/^risk-register-[a-z0-9]{6}$/)
    expect(forked.version).toBe(1)
    expect(forked.status).toBe("draft")
  })

  /**
   * ⚠ 192.1-07 (D-23) — THE BLOCKER'S OWN GUARD, RESTATED AGAINST THE NEW STEP.
   *
   * The three cases above prove the already-forked path still opens the draft. What they
   * cannot see is the prompt: a `pendingFork` set BEFORE the existing-draft lookup would leave
   * every one of them green (the dialog does not create anything, so `createWorkflowDraft`
   * stays at zero and the Builder still opens once the person cancels) while the surface asked
   * a person to name a copy it was never going to make. That is the U5 blocker's own shape — a
   * click that does something other than what it said — and it is worth its own case.
   */
  it("no NAME PROMPT appears on that path either, because nothing is being named", async () => {
    seedExistingFork()
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const user = await openOverflow(await publishedCardNamed("Vendor-risk review"))
    await user.click(screen.getByTestId("published-tweak"))

    // ⚠ WAIT ON A NODE PRESENT ON THIS PATH FIRST (T-4). `spine-node-tuneup` is the EXISTING
    // draft's own phase — it appears in neither the published def nor `draftRow` — so it is
    // both the proof the right branch ran and a wait that cannot be satisfied by the wrong one.
    // Only then is the absence queried, synchronously, so it can never read as a timeout.
    expect(await screen.findByTestId("spine-node-tuneup")).toBeInTheDocument()
    expect(screen.queryByTestId("fork-name-dialog")).toBeNull()
    expect(mockCreateDraft).not.toHaveBeenCalled()
  })

  it("POSITIVE CONTROL — the same verb on a row with NO existing draft DOES ask", async () => {
    // Without this, the case above is satisfied by a dialog that never mounts anywhere, by a
    // renamed testid, and by a page that failed to render at all. `Quick notes` is the second
    // published row in the shared fixture and no draft shares its slug.
    seedExistingFork()
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const user = await openOverflow(await publishedCardNamed("Quick notes"))
    await user.click(screen.getByTestId("published-tweak"))

    expect(await screen.findByTestId("fork-name-dialog")).toBeInTheDocument()
    // …and STILL nothing written: the prompt is the pause, not the write.
    expect(mockCreateDraft).not.toHaveBeenCalled()
  })

  it("the copy ARRIVES under the typed name — `definition.name` is what the row is called", async () => {
    // LIB-05's whole measurement in one assertion. 43 of the operator's 104 workflows share a
    // name because a fork inherits its parent's; the server writes `definition.name` into the
    // row's `name` COLUMN (`db/workflows.py:508-513`), which is the field every library feed
    // renders. A caption-only change would have left the library exactly as unreadable.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const user = await openOverflow(await publishedCardNamed("Vendor-risk review"))
    await user.click(screen.getByTestId("published-tweak"))
    await nameTheCopy(user, "Q3 EU gap review")

    await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(1))
    expect(mockCreateDraft.mock.calls[0][0].name).toBe("Q3 EU gap review")
    // The parent's name is NOT what was sent — which is the defect this phase exists to end.
    expect(mockCreateDraft.mock.calls[0][0].name).not.toBe("Vendor-risk review")
  })

  it("a colliding name WARNS and still creates — the library's problem is not the user's fault", async () => {
    // D-20 driven END TO END, over the REAL pre-flight rather than a stubbed `isClash`: the
    // typed name is the display name of a row already in the merged feed (`draftRow` renders
    // as "Contract clause review"), so the page's own predicate must classify it as a
    // clash — and the create must happen anyway.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const user = await openOverflow(await publishedCardNamed("Vendor-risk review"))
    await user.click(screen.getByTestId("published-tweak"))

    const field = await screen.findByTestId("fork-name-input")
    await user.type(field, "Contract clause review")
    expect(screen.getByTestId("fork-name-hint")).toHaveTextContent(FORK_HINT_CLASH)
    expect(screen.getByTestId("fork-name-create")).toBeEnabled()

    await user.click(screen.getByTestId("fork-name-create"))
    await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(1))
    expect(mockCreateDraft.mock.calls[0][0].name).toBe("Contract clause review")
  })
})

/**
 * ══ 192-15 (WR-03) — A FORK CLICK THAT FAILS MUST SAY SO ═════════════════════════════════
 *
 * `192-14` above REMOVES the collision on every row that has a draft to open. It does not
 * remove it everywhere, and the residual was measured rather than estimated: of the 18 slugs
 * in the live DB carrying more than one version, **2 are `published + published` with no draft
 * at all** (`meridian-risk-summary-good-07aedc33`, `readonly_refusal_098uat`). Their fork still
 * reaches `createWorkflowDraft` and still 409s, deterministically, forever.
 *
 * ⚠ THE FIXTURE BELOW IS THAT SHAPE. `strictPublished` is a published `vendor-risk` and the
 * drafts feed carries NO `vendor-risk` row — so 192-14's open-the-existing-draft branch cannot
 * fire and the create path runs. That is deliberate: the notice these cases pin is the ONLY
 * thing standing between a person and the residual, so it has to be proved on the residual's
 * own path rather than on a convenient one.
 *
 * The shipped behaviour on that path is `catch (e) { console.error(…) }` and nothing else — no
 * message, no state change, no retry. The operator's report was *"nothing happened, even the
 * card's still the same"*, and it was literally accurate.
 *
 * BOTH handlers are pinned, because they share ONE WORD on the card face (D-12) and a person
 * cannot tell which one they clicked. `onUseStarter`'s single 409 retry is asserted from the
 * inside — TWO calls, no more — so this repair cannot quietly delete the behaviour it exists
 * to report.
 *
 * ⚠ ON THE WAITS. This file sets `asyncUtilTimeout: 15000`, which is LONGER than vitest's 5 s
 * per-test budget — so a bare `findByTestId` on a node that does not exist would blow the test
 * timeout before Testing Library ever reported what it could not find, and a bare
 * `Test timed out in 5000ms` in THIS file is indistinguishable from the `D-192-DEF-01` timeout
 * class it already carries (192-14's recorded lesson). Every case here therefore waits FIRST on
 * something true on BOTH the pre-fix and the post-fix path (the call count), and then asserts
 * the notice under an explicit 2 s budget, so a RED is a real assertion error naming the missing
 * node rather than a timeout that proves nothing.
 */
describe("192-15 (WR-03) — a fork click that fails says so", () => {
  /** A 409 exactly as `createWorkflowDraft` throws it — a bare `Error` carrying the status. */
  const conflict409 = () => new Error("Failed to create workflow draft (status 409)")

  /** The published card, located by the NAME it renders rather than by its index in the list. */
  async function publishedCardNamed(name: string): Promise<HTMLElement> {
    const cards = await screen.findAllByTestId("published-card")
    const card = cards.find((c) => within(c).queryByText(name) !== null)
    expect(card, `no published card renders the name "${name}"`).toBeTruthy()
    return card as HTMLElement
  }

  /** The notice: present, and carrying EXACTLY the vocabulary's sentence for this outcome. */
  async function expectForkFailureNotice(name: string, conflict: boolean) {
    await waitFor(
      () => {
        expect(
          screen.queryByTestId("library-fork-failed"),
          "the fork failed and the surface said NOTHING — the error reached console.error and nowhere else (WR-03)",
        ).not.toBeNull()
      },
      { timeout: 2000 },
    )
    expect(screen.getByTestId("library-fork-failed").textContent).toBe(
      forkFailedMessage(name, conflict),
    )
  }

  /** Still on the library — a failed fork must not strand anyone half-way into a Builder. */
  function expectStillOnTheLibrary() {
    expect(screen.getByTestId("library-list")).toBeInTheDocument()
    expect(screen.queryByTestId("builder-back")).not.toBeInTheDocument()
  }

  it("A — the 409 on the residual published+published shape refuses OUT LOUD, and writes nothing", async () => {
    mockListDrafts.mockResolvedValue([draftRow]) // slug `contract-clause` — no `vendor-risk`
    mockCreateDraft.mockRejectedValue(conflict409())

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const user = await openOverflow(await publishedCardNamed("Vendor-risk review"))
    await user.click(screen.getByTestId("published-tweak"))
    // 192.1-07 (D-19 / D-22): the copy is named FIRST, and it changes nothing about this
    // case's subject. WR-08's 409 is a `UNIQUE(slug, version)` violation on SLUGS; the
    // pre-flight reads DISPLAY NAMES. No name a person can type prevents this refusal, which
    // is exactly why the notice below is still the only thing standing between them and a
    // dead button. Every assertion in this case is unchanged.
    await nameTheCopy(user, TYPED_NAME)

    await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(1))
    await expectForkFailureNotice("Vendor-risk review", true)
    // Tweak has no retry and gains none here — the repair reports the failure, it does not
    // paper over it with a second attempt at the same deterministic collision.
    expect(mockCreateDraft).toHaveBeenCalledTimes(1)
    expectStillOnTheLibrary()
  })

  it("B — a NON-conflict failure says the other true thing: nothing was created", async () => {
    mockListDrafts.mockResolvedValue([draftRow])
    mockCreateDraft.mockRejectedValue(new Error("Failed to create workflow draft (status 500)"))

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const user = await openOverflow(await publishedCardNamed("Vendor-risk review"))
    await user.click(screen.getByTestId("published-tweak"))
    await nameTheCopy(user, TYPED_NAME)

    await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(1))
    await expectForkFailureNotice("Vendor-risk review", false)
    expect(mockCreateDraft).toHaveBeenCalledTimes(1)
    expectStillOnTheLibrary()
  })

  it("C — the STARTER fork's TERMINAL failure is visible, and its single 409 retry is still there", async () => {
    // ⚠ TWO CALLS, ASSERTED FROM BOTH SIDES OF THE FIX. The retry is deliberate (a slug-hash
    // clash on a shared starter) and pre-dates this plan — it is measured RED-side too, which
    // is what makes "the retry was not introduced here, and cannot be deleted under cover of
    // this repair" an observation rather than a claim.
    mockCreateDraft.mockRejectedValue(conflict409())

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const user = await openOverflow(await screen.findByTestId("starter-card"))
    await user.click(screen.getByTestId("use-starter"))
    // ⚠ T-192-42's PIN IS ASSERTED THROUGH THE PROMPT, AND THE COUNT IS UNCHANGED AT TWO.
    // One name typed once, one retry on the 409, two `createWorkflowDraft` calls — the prompt
    // did not become a second attempt and the retry was not restructured under cover of it.
    await nameTheCopy(user, "My risk register")

    await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(2))
    await expectForkFailureNotice("Risk Register", true)
    expect(mockCreateDraft).toHaveBeenCalledTimes(2)
    expectStillOnTheLibrary()
  })

  it("D — a later SUCCESSFUL fork clears the notice: a stale failure over a success is its own lie", async () => {
    mockListDrafts.mockResolvedValue([draftRow])
    // The first attempt 409s; the second uses `beforeEach`'s resolving default.
    mockCreateDraft.mockRejectedValueOnce(conflict409())

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const first = await openOverflow(await publishedCardNamed("Vendor-risk review"))
    await first.click(screen.getByTestId("published-tweak"))
    await nameTheCopy(first, TYPED_NAME)
    await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(1))
    await expectForkFailureNotice("Vendor-risk review", true)

    const second = await openOverflow(await publishedCardNamed("Vendor-risk review"))
    await second.click(screen.getByTestId("published-tweak"))
    // ⚠ THE SECOND PROMPT OPENS EMPTY, which is reset-on-open proved on the live page rather
    // than only on the component: a field still holding the first attempt's name would make
    // "the notice cleared" true while the surface quietly re-offered a failed answer.
    await nameTheCopy(second, "My second attempt")

    // The Builder opened on the forked definition's own phases…
    expect(await screen.findByTestId("spine-node-pull")).toBeInTheDocument()
    // …and the notice did NOT ride along into the success.
    expect(screen.queryByTestId("library-fork-failed")).toBeNull()
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
    await nameTheCopy(user, "My risk register")
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
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL))
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
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL))

    setSearch(PURPOSE_ONLY_WORD)
    await waitFor(() => expect(renderedCards()).toHaveLength(1))
    const card = renderedCards()[0]
    expect(within(card).getByText(bulkName(PURPOSE_ONLY_INDEX))).toBeInTheDocument()
    // THE HALF SC#1'S WORDING DOES NOT REACH: the word is absent from the name, and the search
    // found the row anyway — so the filter really does read wider than the title.
    expect(bulkName(PURPOSE_ONLY_INDEX)).not.toContain(PURPOSE_ONLY_WORD)

    // ⚠ 192.2-05 (D-03) — AND HERE IS THE CONSEQUENCE, ASSERTED RATHER THAN LEFT IMPLICIT.
    // This line read `getByTestId("soul-purpose").textContent).toContain(PURPOSE_ONLY_WORD)`:
    // the reader could see WHY the row matched, because the purpose hero was on the card.
    // D-03 cut that atom, so the match is now made on a field the resting card does not show.
    // The search is unchanged and still correct; what changed is that the hit is no longer
    // self-explaining. Pinned in this direction so the trade is a recorded decision — the
    // phase accepted it knowingly (`business_requirement` is populated on 14% of rows and
    // CONTEXT D-03 rules it cannot lead) — and so a later wave restoring a why-it-matched
    // affordance reds here and reads this note rather than rediscovering the reason.
    expect(within(card).queryByTestId("soul-purpose")).not.toBeInTheDocument()
    expect(card).not.toHaveTextContent(PURPOSE_ONLY_WORD)
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
    await waitFor(() => expect(renderedCards().length).toBeGreaterThan(0))
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
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL))

    setSearch("the thing that checks vendors")
    await waitFor(() => expect(renderedCards()).toHaveLength(0))
    // "none match what you asked for" is a DIFFERENT FACT from "you have none", and the page
    // holds them apart rather than collapsing both into one blank surface.
    expect(screen.getByTestId("library-filtered-empty")).toBeInTheDocument()
    expect(screen.queryByTestId("library-empty")).toBeNull()
    // …and the way out is one click, and it really works.
    fireEvent.click(screen.getByTestId("library-clear-all"))
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL))
  })
})

describe("WorkflowsPage — LIB-02 / SC#2: every chip's number is the number it delivers (D-03)", () => {
  it("at 200 rows, and under TWO different live searches, chipCount(c) === the rows clicking c renders", async () => {
    // ⚠ THE EXPECTED VALUE IS COMPUTED FROM THE DOM, NEVER FROM THE FIXTURE ARRAY. Deriving it
    // from the fixtures would re-implement the six predicates in the test and prove only that
    // the test agrees with itself. The rule asserted here is the mechanical form of D-03's
    // promise: the number on the chip is the number clicking it gives you.
    mountBulk()
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL))

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
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL))
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
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_PUBLISHED + BULK_STARTERS))

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

  it("when ALL THREE feeds fail, the page says the list is incomplete — never that the user has none", async () => {
    // CR-01, found by the 192 code review and reproduced independently at verification.
    //
    // WHY THE TWO CASES ABOVE COULD NOT SEE THIS: both reject `/drafts` and let the other two
    // return rows, so both leave `rows.length > 0` and never reach the empty-state branch at
    // all. They pin the CORRECT branch without ever entering the WRONG one — which is exactly
    // how a defect survives a suite that looks thorough. The distinguishing input is not "a
    // feed failed", it is "a feed failed AND nothing else answered".
    //
    // The claim under test is about EPISTEMICS, not layout: "You have no workflows yet" is an
    // affirmative statement about the user's own data, and when every source refused we have no
    // evidence for it. `loading` is `!anySettled`, and a FAILED source counts as settled, so
    // this path renders — it does not hang on a spinner.
    mockListPublished.mockRejectedValue(new Error("503 Service Unavailable"))
    mockListStarters.mockRejectedValue(new Error("503 Service Unavailable"))
    mockListDrafts.mockRejectedValue(new Error("403 Forbidden"))

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)

    // Every source is named — the page never folds three refusals into one page-wide error.
    await waitFor(() =>
      expect(screen.getByTestId("library-source-failed-published")).toBeInTheDocument(),
    )
    expect(screen.getByTestId("library-source-failed-starter")).toBeInTheDocument()
    expect(screen.getByTestId("library-source-failed-draft")).toBeInTheDocument()

    // THE ASSERTION THAT WOULD HAVE CAUGHT CR-01: the false claim is absent…
    expect(screen.queryByTestId("library-empty")).toBeNull()
    // …and the honest one is present, wired to the vocabulary entry authored for this state
    // in 192-05 that had no consumer until the fix.
    expect(screen.getByTestId("library-empty-source-failed").textContent).toContain("incomplete")

    // No rows are claimed, and the list is not stuck pretending to still be loading.
    expect(renderedCards()).toHaveLength(0)
    expect(screen.queryByTestId("library-loading")).toBeNull()
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
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL))
    // THE NEGATIVE CASE FIRST: with "All projects" there is nothing to explain, so the note
    // is ABSENT. A note that is always present states nothing.
    expect(screen.queryByTestId("library-project-note")).toBeNull()

    selectProject("folder-aaa")
    await waitFor(() => expect(renderedOfKind("published")).toHaveLength(boundPublished.length))
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
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL))
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
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL))
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
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL))

    expect(chipCount("yours")).toBe(BULK_PUBLISHED + BULK_DRAFTS)
    expect(chipCount("yours")).toBeGreaterThan(0)
    fireEvent.click(screen.getByTestId("library-chip-yours"))
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_PUBLISHED + BULK_DRAFTS))
    expect(renderedOfKind("starter")).toHaveLength(0)
    expect(renderedOfKind("published")).toHaveLength(BULK_PUBLISHED)
    expect(renderedOfKind("draft")).toHaveLength(BULK_DRAFTS)
  })
})

// ══ 192-11 — THE TWO **DOM** FENCES (F2, F3) ══════════════════════════════════════════
//
// F1, F4 and F5 are SOURCE fences and live in `library/librarySubtree.fences.test.ts`. F2 and
// F3 ask a different question — what a person actually SEES — so they belong here, on the
// rendered page. Both carry a POSITIVE CONTROL, because the Phase-187 lesson is that a
// selector which matches nothing anywhere passes every absence test ever written against it.

/** F2 (D-11) — the developer route vocabulary, as a person would read it. */
const ROUTE_PATTERN = /GET \/workflows\//

/** F3 (D-10) — the button that lied. Both the plain and the elided spelling. */
const PUBLISH_LABEL_PATTERN = /^Publish…?$/

/** Every TEXT NODE under `root` whose content matches — the walker both fences share. */
function textNodesMatching(root: Node, pattern: RegExp): string[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const hits: string[] = []
  let node = walker.nextNode()
  while (node !== null) {
    const text = node.textContent ?? ""
    if (pattern.test(text)) hits.push(text)
    node = walker.nextNode()
  }
  return hits
}

/** Every ELEMENT under `root` whose whole trimmed text matches. */
function elementsWithText(root: ParentNode, pattern: RegExp): string[] {
  return Array.from(root.querySelectorAll("*"))
    .filter((el) => pattern.test((el.textContent ?? "").trim()))
    .map((el) => (el.textContent ?? "").trim())
}

describe("WorkflowsPage — F2 (D-11): no route literal reaches a reader of the library", () => {
  it("no user-visible node renders a GET /workflows/… string, and the SAME walker finds one when planted", async () => {
    // The D14 honesty banner and the Published shelf's chip both rendered this literal as real
    // DOM text before 192-10 deleted them. The fence is what keeps it deleted: developer
    // vocabulary on a user surface is the thing D-11 removes, and prose cannot enforce it.
    const { container } = render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    // All three provenances on screen, so the fence covers every card the library can draw.
    await screen.findByTestId("draft-card")
    await screen.findByTestId("starter-card")
    expect(await screen.findAllByTestId("published-card")).toHaveLength(2)

    const surface = container.firstElementChild as HTMLElement
    expect(textNodesMatching(surface, ROUTE_PATTERN)).toEqual([])
    // NON-VACUITY: the walker really is walking a populated surface rather than an empty node.
    expect(textNodesMatching(surface, /./).length).toBeGreaterThan(20)

    // POSITIVE CONTROL — the same walker, the same surface, one planted node.
    const planted = document.createElement("p")
    planted.textContent = "GET /workflows/published"
    surface.appendChild(planted)
    expect(textNodesMatching(surface, ROUTE_PATTERN)).toEqual(["GET /workflows/published"])
    planted.remove()
    expect(textNodesMatching(surface, ROUTE_PATTERN)).toEqual([])
  })
})

describe("WorkflowsPage — F3 (D-10): the button that lied does not render anywhere", () => {
  it("no element labelled Publish… renders on any row FACE, and the selector proves itself on a plant", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await screen.findByTestId("draft-card")
    await screen.findByTestId("starter-card")
    await screen.findAllByTestId("published-card")

    expect(elementsWithText(document.body, PUBLISH_LABEL_PATTERN)).toEqual([])

    // POSITIVE CONTROL — without it this assertion is satisfied by a selector that matches
    // nothing anywhere, which is the Phase-187 finding applied where it binds.
    const planted = document.createElement("button")
    planted.textContent = "Publish…"
    document.body.appendChild(planted)
    expect(elementsWithText(document.body, PUBLISH_LABEL_PATTERN)).toEqual(["Publish…"])
    planted.remove()
    expect(elementsWithText(document.body, PUBLISH_LABEL_PATTERN)).toEqual([])
  })

  it("…and it is not hiding inside ANY of the three overflow menus either", async () => {
    // An absence proved only on the face would be satisfied by a control that merely moved
    // behind the `⋯`. Each row state's menu is opened and read in turn.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const draftCard = await screen.findByTestId("draft-card")
    const starterCard = await screen.findByTestId("starter-card")
    const publishedCard = (await screen.findAllByTestId("published-card"))[0]

    for (const card of [draftCard, publishedCard, starterCard]) {
      const user = await openOverflow(card)
      const menu = screen.getByRole("menu")
      // The menu really has items — an empty menu would pass any absence check.
      expect(within(menu).getAllByRole("menuitem").length).toBeGreaterThan(0)
      expect(elementsWithText(menu, PUBLISH_LABEL_PATTERN)).toEqual([])
      await user.keyboard("{Escape}")
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
    }
  })
})

describe("WorkflowsPage — LIB-04 / SC#4: create LEADS, at 200 workflows", () => {
  it("the create affordance precedes EVERY one of 200 rendered rows in document order", async () => {
    // ⚠ ORDER, NEVER GEOMETRY. jsdom applies no CSS and paints nothing, so a coordinate
    // assertion here would be fiction; and a structural test that also asserts layout starts
    // failing for layout reasons. The VISUAL half — "findable without scrolling past two
    // shelves" as a person experiences it — is UAT's (rows U2 / U3 / U7) and is deliberately
    // NOT claimed here. What IS proved is the structural property D-02 bought: create leads a
    // persistent toolbar, so it cannot drift back down a grid, because there is no grid above
    // it to drift below.
    const { container } = mountBulk()
    await waitFor(() => expect(renderedCards()).toHaveLength(BULK_TOTAL))

    const create = screen.getByTestId("library-create")
    const cards = renderedCards()
    expect(cards).toHaveLength(200)
    for (const card of cards) {
      expect(
        create.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING,
        `a row rendered BEFORE the create affordance: ${card.textContent?.slice(0, 40)}`,
      ).toBeTruthy()
    }
    // POSITIVE CONTROL — the bit-mask really discriminates: the first row precedes the last.
    expect(
      cards[0].compareDocumentPosition(cards[cards.length - 1]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      cards[cards.length - 1].compareDocumentPosition(cards[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeFalsy()

    // …and keyboard order agrees with the DOM order asserted above.
    //
    // ⚠ THIS CLAUSE WAS AMENDED BY SEED-190, AND ITS ORIGINAL IS QUOTED RATHER THAN QUIETLY
    // LOOSENED. It read `expect(focusables[0]).toBe(create)` over the WHOLE container, with
    // the comment "it is the FIRST interactive element on the surface". That was true when
    // written and it is STRICTER than the contract it restates: `LibraryToolbar.tsx`'s own
    // D-02 paragraph says this control "is index 0 of every focusable node IN THE TOOLBAR",
    // and `LibraryToolbar.test.tsx:127` asserts exactly that, unedited and still green.
    //
    // SEED-190 put ONE page-level navigation control in the header — the door to the run log
    // — which precedes the toolbar in document order because the header does. That is the
    // ordinary shape of a page (nav before content; this app's own nav rail precedes every
    // page), and it costs a keyboard user one tab.
    //
    // ⚠ THE GUARD KEEPS ITS TEETH: the exception is a NAMED ALLOW-LIST of one, so any OTHER
    // control appearing before create still fails here — which is the drift D-02 exists to
    // catch. Falsified below by asserting the list is exhausted, so an allow-list that
    // silently grew a second member cannot pass unnoticed.
    const focusables = Array.from(
      container.querySelectorAll(
        "button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      ),
    )
    const before = focusables.slice(0, focusables.indexOf(create))
    expect(before.map((el) => el.getAttribute("data-testid"))).toEqual(["open-run-log"])
    // …and create still leads everything from the toolbar onward, which is the half of the
    // original claim that was never about page-level navigation.
    const toolbar = screen.getByTestId("library-toolbar")
    const fromToolbarOn = focusables.filter(
      (el) =>
        el === toolbar ||
        toolbar.contains(el) ||
        Boolean(toolbar.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING),
    )
    expect(fromToolbarOn[0]).toBe(create)
  }, 60000)
})

describe("WorkflowsPage — D-18: the two delete grades are DIFFERENT, and provably so", () => {
  it("a draft delete arms first, then calls deleteWorkflowDraft — and NEVER the cascade pair", async () => {
    // The cascade client and its preview client resolve a SLUG and destroy every version under
    // it. For ONE draft that destroys far more than the person asked for, which is why D-18
    // gives the draft the middle guard grade and its own single-row endpoint.
    mockDeleteDraft.mockResolvedValue(undefined)
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const draftCard = await screen.findByTestId("draft-card")

    const user = await openOverflow(draftCard)
    await user.click(screen.getByTestId("draft-delete"))
    // THE FIRST CLICK ARMS AND DOES NOT DELETE — a single stray click never reaches the wire.
    expect(await screen.findByTestId("draft-delete-prompt")).toBeInTheDocument()
    expect(mockDeleteDraft).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId("draft-delete-confirm"))
    await waitFor(() => expect(mockDeleteDraft).toHaveBeenCalledWith("draft-1"))
    expect(mockDeleteCascade).not.toHaveBeenCalled()
    expect(mockDeletePreview).not.toHaveBeenCalled()
  })

  it("a published delete is the HEAVIER grade: the victim-naming Sheet, server counts, then the cascade", async () => {
    // The counterpart, so "demonstrably lighter" is a MEASUREMENT rather than a claim: this
    // path fetches exact server counts and names its victim before offering the action; the
    // draft path above does neither. The Sheet's full lifecycle is `PublishedCardDelete.test.tsx`'s
    // job and is not duplicated — what this row adds is that the two grades take DIFFERENT
    // endpoints from the same one card.
    mockDeletePreview.mockResolvedValue({
      name: "Vendor-risk review",
      versions: 2,
      runs: 3,
      threads: 0,
      in_flight: 0,
    })
    mockDeleteCascade.mockResolvedValue(undefined)
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const publishedCard = (await screen.findAllByTestId("published-card"))[0]

    const user = await openOverflow(publishedCard)
    await user.click(screen.getByTestId("published-delete"))
    await waitFor(() => expect(mockDeletePreview).toHaveBeenCalledWith("pub-1"))
    // The victim is NAMED, with the server's own counts. Scoped to the Sheet: the card behind
    // it carries the same name, and a page-wide text query would find that one and pass on a
    // Sheet that named nothing.
    const sheet = await screen.findByRole("dialog")
    expect(within(sheet).getByText("Delete this workflow?")).toBeInTheDocument()
    expect(within(sheet).getByText("Vendor-risk review")).toBeInTheDocument()
    expect(sheet.textContent).toContain("2 versions")
    expect(sheet.textContent).toContain("3 run records")

    fireEvent.click(await screen.findByTestId("delete-forever"))
    await waitFor(() => expect(mockDeleteCascade).toHaveBeenCalledWith("pub-1"))
    // …and the heavy path never touches the single-draft endpoint, which is the other half of
    // "the grades are distinct".
    expect(mockDeleteDraft).not.toHaveBeenCalled()
  })
})

/**
 * ── 193.2-02 (D-19) — THE POST-PUBLISH RUN CTA, ITS FIRST AUTOMATED COVERAGE ─────────────
 *
 * ⚠ BEFORE THIS BLOCK, THIS SURFACE HAD **ZERO** TESTS. Measured at HEAD `fa83585e`, not
 * assumed: `grep -rn "run-cta\|runCta\|Ready to run it" frontend/src --include=*.test.tsx`
 * returned NO MATCHES, and `grep -c "run-cta"` on this very file returned **0**. WR-04 had
 * already fixed one way the banner silently dropped (a hardcoded `"workflow"` slug literal
 * that found nothing in `published`) and **no test would have caught the next one.**
 *
 * The surface — `WorkflowsPage.tsx:721-729`, `:861-863`, `:897-917`:
 *
 *   onGauntletPublished → setPageView("library") · setRunCta({slug, version})
 *                       · refetchPublished() · refetchDrafts()
 *   runCtaRow = rows.find(r => r.slug === runCta.slug && r.provenance !== "draft")
 *   {runCtaWf && <div data-testid="run-cta">Published <b>{name}</b> v{version}. Ready to run it.</div>}
 *
 * ⚠ THE RACE IS THE WHOLE POINT AND IT IS WHY THIS IS HELD-PROMISE SHAPED. On the first
 * render after publish, `published` still holds the PRE-publish list and the row is still in
 * `drafts` — excluded by `provenance !== "draft"` — so `runCtaRow` is `undefined` and the
 * banner does not render. It appears only when `refetchPublished()` lands. `runCta` is NOT
 * cleared by the refetch (only by the ▶ Run now button), so the banner is DELAYED, NOT LOST.
 * A test that mounts the page with the row already published proves none of that.
 *
 * ⚠ NO `findBy` ON AN ABSENT NODE (T-4) — the file-level rule this block obeys literally.
 * `asyncUtilTimeout` is 15 s here, longer than vitest's 5 s per-test budget, so a
 * `findByTestId("run-cta")` on the IN-FLIGHT state would blow the TEST timeout and yield a RED
 * indistinguishable from a real failure. Every ABSENCE assertion below therefore waits on a
 * node that IS present on its own path first (the library toolbar, which `onGauntletPublished`
 * returns to), then queries `run-cta` SYNCHRONOUSLY.
 *
 * ⚠ THIS BLOCK ADDS COVERAGE, NOT BEHAVIOUR. `WorkflowsPage.tsx` is byte-unchanged by the plan
 * that wrote this. D-19 resolves as *"it fires; SC#3 is met by the sort plus one pin"* and
 * NO navigate-to-row / scroll-to-row / highlight behaviour is built: the page carries an
 * inherited G-5 obligation (re-derived at HEAD: 34 commits / 12 phases / 1176 lines) and
 * CONTEXT names a second hand-off surface a genuine SECOND concern. The ruling and its
 * evidence live in `193.2-D10-D19-CONFIRMATION.md` §4.
 */
describe("193.2 / D-19 — the post-publish Run CTA, its first automated coverage", () => {
  /**
   * The version the gauntlet's verdict carries, in ONE place. The banner renders
   * `v{runCta.version}` from the value `onPublished(result.verdict.version ?? 0)` hands up, so
   * the assertion reads this constant rather than a re-typed "v2" — a hardcoded literal cannot
   * notice the version being dropped on the way through.
   */
  const PUBLISHED_VERSION = 2

  /**
   * The published row the refetch is going to deliver. Its slug MATCHES `draftRow`'s
   * (`contract-clause`) because that is the draft this block publishes — and its `name`
   * deliberately differs from nothing else on screen, so `toContain(name)` cannot pass off
   * another card's text.
   *
   * ⚠ Note what it is NOT: it is absent from the mount-time published feed
   * (`strictPublished` / `loosePublished`) and from the starters feed (`starterRow`). If the
   * slug were already published at mount, `runCtaRow` would resolve on the very first render
   * and the race this block exists to observe would not happen.
   */
  const publishedContractClause = {
    id: "pub-cc",
    slug: "contract-clause",
    name: "Contract clause review",
    definition: {
      slug: "contract-clause",
      version: PUBLISHED_VERSION,
      project_folder_id: null,
      phases: [{ slug: "draft", phase_index: 0, config: { phase_type: "llm_agent" } }],
    },
  }

  /**
   * Drive a real gauntlet PASS from the hosted Builder, on the draft the file already seeds.
   *
   * Open (never Tweak) is used deliberately: `onOpenDraft` is edit-in-place, so it reaches the
   * Builder with a non-null `draftId` — which is what `renderPublish` gates the gauntlet on —
   * WITHOUT calling `createWorkflowDraft` and without the 192.1-07 fork-name dialog standing
   * between the click and the publish.
   */
  async function publishTheOpenDraft() {
    const draftCard = await screen.findByTestId("draft-card")
    fireEvent.click(within(draftCard).getByTestId("draft-open"))

    const trigger = await screen.findByTestId("publish-trigger")
    // The trigger is greyed while a save is in flight (`SAVING_PUBLISH_WAIT`). Waiting on the
    // ENABLED state rather than on mere presence keeps a transient block from reading as a
    // publish that silently did not happen.
    await waitFor(() => expect(trigger).not.toBeDisabled())
    fireEvent.click(trigger)

    // `canPublish` requires a non-empty golden_input, so the gauntlet cannot run without it.
    const golden = await screen.findByLabelText(/golden_input/i)
    fireEvent.change(golden, { target: { value: "a representative kickoff prompt" } })
    // ⚠ NEEDLE MOVED BY THE SKETCH-200 PORT (2026-08-20); the previous one is kept here
    // rather than overwritten: it read `/run the gauntlet/i`. Sketch 200's `publish.html`
    // labels this control *"Publish — run the checks"*, dropping the mechanism's name from
    // the sentence a person reads. ⚠ THE `findByLabelText(/golden_input/i)` ABOVE IS
    // DELIBERATELY UNCHANGED and still resolves: the wire key was DEMOTED to a quiet token
    // inside the same <label>, not removed — which is exactly the property this line proves.
    fireEvent.click(screen.getByRole("button", { name: /run the checks/i }))

    // The publish call is what `onPublished` — and therefore `onGauntletPublished` — hangs off.
    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1))
    // We are back on the library, which is the node every absence assertion below waits on.
    return screen.findByTestId("library-toolbar")
  }

  /** A gauntlet verdict that PASSES. `published === true` is the ONLY thing that fires the CTA. */
  function seedPassingPublish() {
    mockPublish.mockResolvedValue({
      kind: "verdict",
      verdict: { published: true, version: PUBLISHED_VERSION },
    })
  }

  it("the CTA is ABSENT until the published refetch lands, then appears NAMING the workflow", async () => {
    seedPassingPublish()
    let release: (rows: unknown[]) => void = () => {}
    const held = new Promise<unknown[]>((r) => (release = r))
    mockListPublished.mockReset()
    mockListPublished
      .mockResolvedValueOnce([strictPublished, loosePublished]) // the mount fetch
      .mockReturnValueOnce(held) // the POST-PUBLISH refetch — held open

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await screen.findByTestId("library-toolbar")
    await publishTheOpenDraft()

    // ── IN FLIGHT ─────────────────────────────────────────────────────────────────────
    // T-4: the toolbar is awaited by `publishTheOpenDraft`; `run-cta` is queried SYNCHRONOUSLY.
    expect(screen.queryByTestId("run-cta")).toBeNull()

    // ── SETTLED ───────────────────────────────────────────────────────────────────────
    // The safe direction — the node is expected PRESENT, so `findBy` is correct here.
    release([strictPublished, loosePublished, publishedContractClause])
    const banner = await screen.findByTestId("run-cta")

    // It NAMES the workflow, and both halves are read off the fixture rather than re-typed.
    expect(banner.textContent).toContain(publishedContractClause.name)
    expect(banner.textContent).toContain(`v${PUBLISHED_VERSION}`)
    // …and it offers the run. (Clicking it would `setRunCta(null)` — the self-dismissal R3
    // measured — which is why this asserts the control exists rather than pressing it.)
    expect(within(banner).getByRole("button", { name: /run now/i })).toBeInTheDocument()
  })

  it("POSITIVE CONTROL — a published list WITHOUT the slug keeps it absent; one WITH it makes it appear", async () => {
    // ⚠ THIS IS THE FOUR-PART TEMPLATE'S PART 2, AND IT IS WHY THE CASE ABOVE MEANS ANYTHING.
    // An absence assertion whose corpus can never contain the thing is the commonest way a
    // fence stops seeing (`rowIdentity.test.ts:167-179`). Here the SAME drive, the SAME
    // selector and the SAME settled state produce absence and presence purely from what the
    // refetch delivers — so `queryByTestId("run-cta") === null` above is a measurement, not a
    // property of the harness.
    seedPassingPublish()
    let release: (rows: unknown[]) => void = () => {}
    const held = new Promise<unknown[]>((r) => (release = r))
    mockListPublished.mockReset()
    mockListPublished
      .mockResolvedValueOnce([strictPublished, loosePublished]) // the mount fetch
      .mockReturnValueOnce(held) // the post-publish refetch — held
      .mockResolvedValue([strictPublished, loosePublished, publishedContractClause]) // every later call

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await screen.findByTestId("library-toolbar")
    await publishTheOpenDraft()

    // SETTLED, but the slug is NOT in the answer — the banner stays away. The list has
    // genuinely narrowed to the released rows, which is how we know the release landed and
    // this is not merely the in-flight state again.
    release([strictPublished, loosePublished])
    await waitFor(() => expect(screen.getAllByTestId("published-card")).toHaveLength(2))
    expect(screen.queryByTestId("run-cta")).toBeNull()

    // Now a refetch that DOES carry it — the project re-query is the shipped seam that fires
    // one. `runCta` survives a refetch by design (only ▶ Run now clears it), so the banner
    // appears now on the strength of the row alone.
    selectProject("folder-aaa")
    const banner = await screen.findByTestId("run-cta")
    expect(banner.textContent).toContain(publishedContractClause.name)
  })

  it("the DRAFT EXCLUSION holds — a row with the SAME slug on the drafts feed does not raise it", async () => {
    // ⚠ THE WR-04 CLASS OF SILENT DROP, AND THE HALF THAT HAS NEVER BEEN COVERED. `draftRow`
    // IS `contract-clause` and it is on screen throughout, so `rows` contains a row whose slug
    // matches `runCta.slug` for the entire in-flight window. The banner still must not render,
    // because a CTA offering to Run a draft offers something the product refuses by design —
    // and because a Tweak fork carries the SAME slug as the published row it forked, so a slug
    // match alone can land on a draft (`WorkflowsPage.tsx:858-860`).
    seedPassingPublish()
    let release: (rows: unknown[]) => void = () => {}
    const held = new Promise<unknown[]>((r) => (release = r))
    mockListPublished.mockReset()
    mockListPublished
      .mockResolvedValueOnce([strictPublished, loosePublished])
      .mockReturnValueOnce(held)
    // The drafts feed keeps carrying `contract-clause` across the post-publish refetch.
    mockListDrafts.mockResolvedValue([draftRow])

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await screen.findByTestId("library-toolbar")
    await publishTheOpenDraft()

    // NON-VACUITY: the matching-slug DRAFT is genuinely present in `rows`. Without this, the
    // absence below would be satisfied by a list that simply has no such row at all.
    const draftCard = await screen.findByTestId("draft-card")
    expect(draftCard.textContent).toContain(draftRow.name)
    expect(draftRow.slug).toBe(publishedContractClause.slug)
    // …and the banner is still absent, with the slug matching on a draft-provenance row.
    expect(screen.queryByTestId("run-cta")).toBeNull()

    // The published row is what raises it — same slug, different provenance.
    release([strictPublished, loosePublished, publishedContractClause])
    const banner = await screen.findByTestId("run-cta")
    expect(banner.textContent).toContain(publishedContractClause.name)
    // The draft never left; the banner is reading the published row, not the draft.
    expect(screen.getByTestId("draft-card")).toBeInTheDocument()
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
