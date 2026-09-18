/**
 * ⭐ THE SOURCE-COMPOSITION FENCE — Phase 235 · `LIB-10` / `SURF-02` / `SURF-03` / D-235-19.
 *
 * ── (a) IT IS SUPPOSED TO BE RED WHEN IT LANDS, AND ITS RED RUN IS THE DELIVERABLE ─────
 * `.planning/phases/235-the-source-says-what-it-did/235-BASELINE.md` records that run
 * VERBATIM. A guard nobody has seen fire is not a guard, and a guard adopted green on a
 * tree it never failed on has proved nothing about its own wiring.
 *
 * This project measured the alternative twice. Phase 217 shipped against a contract that
 * pinned WORDS and `sketchComposition.test.tsx:5-9` records the result: 200 assertions, 0
 * failing, four of five tabs carrying none of the sketch's furniture — *"a contract that
 * cannot name a MISSING BLOCK cannot tell 'built' from 'not built yet'."* The operator's
 * verdict on sketch 218 was *"nothing at all like what we designed"*. This suite is the
 * mechanism that stops that happening a third time, on sketch 233's four surfaces.
 *
 * ── (b) ⛔ IT IS IN **NEITHER** KNOB OF `scripts/vitest-count-gate.cjs` WHILE RED ───────
 * Not `TARGETS` (what RUNS) and not `BASELINE` (what is GUARDED). The gate's contract is
 * *zero failing, forever*; adopting a deliberately-red suite would redden every later
 * plan's gate for reasons it did not cause. The phase's FINAL wave (plan 12) adopts BOTH
 * knobs in ONE commit, at the gate's own printed `— N new` figure, never a guessed number
 * and never while red. ⚠ `src/components/sources` is not a TARGETS directory entry
 * (measured at 233), so this file does not even RUN in the gate until it is pinned.
 *
 * ── (c) THE HOOK CONVENTION IS `data-testid`, AND THAT DEVIATES FROM THE CONTRACT ──────
 * `data-testid="<screen>-<block-kind>"` — e.g. `sources-source-card`, `rail-badge`,
 * `health-attention-row`. ⚠ `BUILD-CONTRACT.generated.md` §2 says *"Every entry is a
 * `data-block` the React build must emit under the same name"*, and the shipped house
 * convention says the opposite: `sketchComposition.test.tsx:38` records that `data-testid`
 * is the convention at ~1500 occurrences and that **`data-block` is the SKETCH's marker and
 * must never appear in the build**. RESEARCH C-9 resolves it in favour of the shipped
 * convention: **the contract's block NAMES bind; its attribute spelling does not.** The
 * deviation is recorded here and in `235-03-SUMMARY.md` rather than left silent.
 *
 * ── (d) THE CONTRACT IS IMPORTED, NEVER TRANSCRIBED ────────────────────────────────────
 * `__generated__/sourceComposition.json` is written by
 * `node .planning/sketches/233-the-source-says-what-it-did/drive.cjs --emit-json` from the
 * sketch's OWN `data-block="…"` markers, region-scoped. Hand-listing the blocks here would
 * reintroduce exactly the staleness the emitter exists to prevent — and §2's four
 * per-screen lists in the markdown contract are an UNSCOPED-EMITTER ARTIFACT (RESEARCH
 * C-8), so transcribing them would pin twelve `source-card`s onto a Health tab that draws
 * none.
 *
 * ⚠ THE IMPORT IS THE IN-PACKAGE COPY, not a `?raw` reach across the repo boundary into
 * `.planning/sketches/` — which `/gsd:complete-milestone` ARCHIVES. §1 below is the
 * character floor that rule demands: a moved or misnamed import resolves EMPTY rather than
 * throwing, and a contract of zero blocks makes every case below pass over nothing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MessageSquare, FileText, Plug, Workflow } from "lucide-react"

import { TooltipProvider } from "@/components/ui/tooltip"
import type { Document, Folder, SavedView } from "@/types"
import type { NavItem } from "@/lib/nav-items"
import type { ConnectorWatch } from "@/lib/api/sources"

import composition from "./__generated__/sourceComposition.json"

// ── The two live sources §6 is BOUND to ────────────────────────────────────────────────
// ⚠ `?raw`, never a copy. The invariants are properties of the SHIPPED files; a suite that
// asserted them against its own transcript would stay green while the file drifted.
// Path depth from `frontend/src/components/sources/` to the repo root is FOUR `../`.
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import sourcesPySource from "../../../../backend/app/api/sources.py?raw"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import watchedFoldersSource from "./WatchedFoldersSection.tsx?raw"

// ── Mocks ──────────────────────────────────────────────────────────────────────────────
// ⚠ PARTIAL mock of `@/lib/api` via `importOriginal`. It is a re-export barrel with ~12
// domain modules behind it; a FULL replacement has to declare every symbol every child
// imports, and the one it forgets throws at MOUNT with a message about a missing export
// rather than about the missing block — the failure mode Phase 196-08 recorded across nine
// suites, and the one thing that would make this suite's RED unreadable.
const {
  mockUseDocuments,
  mockUseFolders,
  mockListViews,
  mockResolveView,
  mockResolveAdHoc,
  mockListMetadataFields,
  mockGetReembedProgress,
  mockGetIndexSummary,
  mockGetHealthOverview,
  mockListConnectorConnections,
  mockListWatches,
  mockTriggerWatchSync,
  mockUpdateWatch,
  mockDeleteWatch,
  mockPurgeWatchFiles,
  mockCreateWatch,
  mockGetWatch,
  mockListSyncRuns,
  mockGetSourceHealth,
} = vi.hoisted(() => ({
  mockUseDocuments: vi.fn(),
  mockUseFolders: vi.fn(),
  mockListViews: vi.fn(),
  mockResolveView: vi.fn(),
  mockResolveAdHoc: vi.fn(),
  mockListMetadataFields: vi.fn(),
  mockGetReembedProgress: vi.fn(),
  mockGetIndexSummary: vi.fn(),
  mockGetHealthOverview: vi.fn(),
  mockListConnectorConnections: vi.fn(),
  mockListWatches: vi.fn(),
  mockTriggerWatchSync: vi.fn(),
  mockUpdateWatch: vi.fn(),
  mockDeleteWatch: vi.fn(),
  mockPurgeWatchFiles: vi.fn(),
  mockCreateWatch: vi.fn(),
  mockGetWatch: vi.fn(),
  mockListSyncRuns: vi.fn(),
  mockGetSourceHealth: vi.fn(),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    listViews: mockListViews,
    resolveView: mockResolveView,
    resolveAdHoc: mockResolveAdHoc,
    listMetadataFields: mockListMetadataFields,
    getReembedProgress: mockGetReembedProgress,
    getIndexSummary: mockGetIndexSummary,
    getHealthOverview: mockGetHealthOverview,
    listConnectorConnections: mockListConnectorConnections,
  }
})

// ⚠ `@/lib/api/sources` is NOT re-exported by the `@/lib/api` barrel (measured, P-10) —
// it must be mocked SEPARATELY, exactly as `WatchedFoldersSection.test.tsx:20-27` does. A
// function added to `lib/api/sources.ts` and forgotten here throws at mount.
vi.mock("@/lib/api/sources", () => ({
  listWatches: mockListWatches,
  getWatch: mockGetWatch,
  createWatch: mockCreateWatch,
  updateWatch: mockUpdateWatch,
  deleteWatch: mockDeleteWatch,
  triggerWatchSync: mockTriggerWatchSync,
  purgeWatchFiles: mockPurgeWatchFiles,
  // The two Phase-235 additions. Declared here BEFORE they exist so the mount does not
  // start throwing about a missing export the day plan 10 adds them.
  listSyncRuns: mockListSyncRuns,
  getSourceHealth: mockGetSourceHealth,
}))

vi.mock("@/hooks/useDocuments", () => ({ useDocuments: mockUseDocuments }))
vi.mock("@/hooks/useFolders", () => ({ useFolders: mockUseFolders }))

// ⚠ `SUPABASE_CLIENT_REHYDRATED` is NOT optional — `useAuth.ts:3` imports it as a named
// export and passes it to `addEventListener`; a factory that omits it throws at mount.
vi.mock("@/lib/supabase", () => ({
  SUPABASE_CLIENT_REHYDRATED: "supabase:client-rehydrated",
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
    removeChannel: vi.fn(),
  },
}))

// ── The emitted contract, typed only as far as this suite reads it ─────────────────────
type Composition = {
  blocks: { kind: string; heading: string | null; atoms: string[] }[]
  buttons: string[]
}
type Contract = Record<string, Composition> & {
  counts: {
    sources: number
    sourceLine: number
    sourceCard: number
    attentionRow: number
    runCollapsed: number
    runExpanded: number
    instanceStatement: number
  }
}
const CONTRACT = composition as unknown as Contract

/** The three regions sketch 233 draws. `copy` and `counts` are DATA, never screens. */
const SCREENS = ["sources", "health", "rail"] as const

/** `data-testid="<screen>-<kind>"` — the one hook convention, stated once. */
const hook = (screenName: string, kind: string) => `${screenName}-${kind}`

/** The Library tab that hosts each composed screen. The rail is not a tab at all. */
const TAB_BY_SCREEN: Record<string, string> = {
  sources: "Ingestion",
  health: "Health",
}

// ── Fixture — the SKETCH's numbers, so §5 asserts a design and not an invention ────────
//
// Twelve sources: 9 healthy, 2 stopped (one `token_revoked`, one `folder_gone`), 1
// degraded/unreadable. ⚠ The count is load-bearing: the question the sketch asks — how
// much a HEALTHY source says — does not exist at four rows.
//
// ⚠ ONLY THE MEASURED `last_status` SET IS USED: {running, success, failed, paused}. The
// SHIPPED `WatchedFoldersSection.test.tsx` fixture uses `"completed"` and `"disconnected"`,
// which production NEVER writes (RESEARCH C-6) — so that suite exercises statuses that
// cannot exist. This one does not repeat that.
const HEALTHY_NAMES = [
  "Finance Drive",
  "HR Drive",
  "Bids SharePoint",
  "QA Drive",
  "Board SharePoint",
  "Design Drive",
  "Procurement Drive",
  "Site SharePoint",
  "Safety Drive",
]

function watch(over: Partial<ConnectorWatch> & { id: string }): ConnectorWatch {
  return {
    user_id: "user-1",
    connection_id: "conn-1",
    connection_name: "Finance Drive",
    service_id: "google",
    source_folder_id: "src-1",
    source_folder_name: "Suppliers / Invoices 2026",
    library_folder_id: "lib-folder-1",
    interval_minutes: 30,
    is_active: true,
    last_run_at: "2026-09-06T10:00:00Z",
    last_status: "success",
    last_error: null,
    item_count: 6,
    ...over,
  }
}

const SAMPLE_WATCHES: ConnectorWatch[] = [
  ...HEALTHY_NAMES.map((name, i) =>
    watch({
      id: `watch-ok-${i + 1}`,
      connection_id: `conn-ok-${i + 1}`,
      connection_name: name,
      source_folder_name: `${name} folder`,
      last_status: "success",
    }),
  ),
  watch({
    id: "watch-stopped-token",
    connection_id: "conn-legal",
    connection_name: "Legal SharePoint",
    source_folder_name: "Contracts / Executed",
    interval_minutes: 360,
    last_status: "failed",
    last_error: "Source access unauthorized: token_revoked",
  }),
  watch({
    id: "watch-stopped-folder",
    connection_id: "conn-ops",
    connection_name: "Ops Drive",
    source_folder_name: "Site Photos / Tower B",
    interval_minutes: 60,
    last_status: "failed",
    last_error: "folder_gone",
  }),
  watch({
    id: "watch-degraded",
    connection_id: "conn-archive",
    connection_name: "Archive (legacy)",
    source_folder_name: "Archive",
    last_status: "paused",
    is_active: false,
    // ⚠ THE FIXTURE NAMED THIS ROW `watch-degraded` AND NEVER MARKED IT ONE.
    // `classifyWatch` reads `watch.degraded` (WatchedFoldersSection.tsx:159) and nothing
    // else; `last_status: "paused"` is a different field with a different meaning. So the
    // `degraded` branch never rendered and §4 could not find `sources-report-source` — a
    // block that IS built, gated on a flag no fixture ever set. Set here rather than by
    // adding a 13th watch, because §5 pins the roster at 12 / 9 lines / 3 cards.
    degraded: true,
  }),
]

/** 17 ticks, 14 of them quiet — the sketch's own run fixture, so §5's collapsed-3 /
 *  expanded-17 pair is the design's number rather than a remembered one. */
// ⚠ THE `quiet` / `added` / `updated` / `removed` FIELDS WERE INVENTED AND READ BY NOTHING.
// `isQuiet` (runHistoryFold.ts:77) asks three questions and none of them touched this
// fixture: `status === "success"`, `listing_complete`, and all SIX `count_*` keys zero.
// Every run therefore answered "not quiet", nothing folded, `sources-quiet-fold` never
// rendered, and §5 saw 17 rows where the contract says a collapsed history shows 3.
// ⛔ THE FOLDING CODE WAS CORRECT THROUGHOUT — it was never given a quiet tick to fold.
// The descriptive fields are kept so the intent of each row is still readable.
const ZERO_COUNTS = {
  count_new: 0,
  count_modified: 0,
  count_renamed: 0,
  count_missing: 0,
  count_restored: 0,
  count_errors: 0,
}
const SAMPLE_RUNS = [
  {
    id: "run-1",
    quiet: false,
    added: 3,
    updated: 1,
    started_at: "2026-09-06T14:32:00Z",
    status: "success",
    listing_complete: true,
    ...ZERO_COUNTS,
    count_new: 3,
    count_modified: 1,
  },
  ...Array.from({ length: 14 }, (_, i) => ({
    id: `run-quiet-${i + 1}`,
    quiet: true,
    added: 0,
    updated: 0,
    started_at: `2026-09-06T${String(13 - Math.floor(i / 2)).padStart(2, "0")}:02:00Z`,
    status: "success" as const,
    listing_complete: true,
    ...ZERO_COUNTS,
  })),
  {
    id: "run-16",
    quiet: false,
    added: 1,
    failed: 1,
    fail_name: "Invoice_8841.pdf",
    fail_kind: "password",
    started_at: "2026-09-05T09:14:00Z",
    // ⛔ `failed` IS `status !== "success"` (RunHistoryList.tsx:166), nothing else. This
    // row was passing only because `status` was ABSENT and `undefined !== "success"` is
    // true — the right answer for the wrong reason. The contract draws a `fail-reason`
    // block, so the fixture owes it one genuinely failed tick.
    status: "failed",
    listing_complete: true,
    ...ZERO_COUNTS,
    count_new: 1,
    count_errors: 1,
  },
  {
    id: "run-17",
    quiet: false,
    added: 12,
    removed: 2,
    started_at: "2026-09-05T08:44:00Z",
    status: "success",
    listing_complete: true,
    ...ZERO_COUNTS,
    count_new: 12,
    count_missing: 2,
  },
]

const sampleFolders: Folder[] = [
  {
    id: "lib-folder-1",
    user_id: "user-1",
    name: "Finance",
    parent_id: null,
    is_org_shared: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]

const sampleDocuments: Document[] = [
  {
    id: "doc-1",
    user_id: "user-1",
    folder_id: "lib-folder-1",
    filename: "supplier_terms_2026.pdf",
    file_path: "/uploads/supplier_terms_2026.pdf",
    file_size: 840000,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 12,
    content_hash: "abc123",
    metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]

const sampleViews: SavedView[] = [
  {
    id: "view-1",
    user_id: "user-1",
    name: "Needs review",
    filter_expr: { op: "and", conditions: [] },
    is_system_global: false,
  },
]

/** The rail's nav list, shaped like `NAV_ITEMS` — `documents` is labelled "Library". */
const railNavItems: NavItem[] = [
  { view: "chat", icon: MessageSquare, label: "Chat" },
  { view: "workflows", icon: Workflow, label: "Workflows" },
  { view: "documents", icon: FileText, label: "Library" },
  { view: "connections", icon: Plug, label: "Connections" },
]

function renderUI(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

function primeMocks() {
  vi.clearAllMocks()
  mockUseDocuments.mockReturnValue({
    documents: sampleDocuments,
    uploading: false,
    uploadingCount: 0,
    upload: vi.fn().mockResolvedValue({ isDuplicate: false }),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
  })
  mockUseFolders.mockReturnValue({
    folders: sampleFolders,
    createFolder: vi.fn().mockResolvedValue({}),
    renameFolder: vi.fn().mockResolvedValue(undefined),
    deleteFolder: vi.fn().mockResolvedValue(undefined),
  })
  mockListViews.mockResolvedValue(sampleViews)
  mockListMetadataFields.mockResolvedValue([])
  mockResolveView.mockResolvedValue({ documents: [], total: 0 })
  mockResolveAdHoc.mockResolvedValue({ documents: [], total: 0 })
  mockGetReembedProgress.mockResolvedValue({
    status: "idle",
    total: 12,
    re_embedded: 12,
    remaining: 0,
    model: "text-embedding-3-small",
    updated_at: null,
  })
  mockGetIndexSummary.mockResolvedValue({
    vectors: 12,
    chunks_total: 12,
    documents_without_vectors: 0,
    last_indexed: "2026-09-06T00:00:00Z",
    model: "text-embedding-3-small",
    dimensions: 1536,
    provider: "openai",
    folders: [],
  })
  mockGetHealthOverview.mockResolvedValue({
    health_score: 0.87,
    high_confidence_rate: 0.9,
    total_documents: 1,
    retrieved_this_month: 3,
    never_retrieved_count: 0,
    stale_count: 0,
    low_confidence_queries_count: 0,
    coverage_percent: 1,
    avg_confidence: 0.9,
  })
  mockListConnectorConnections.mockResolvedValue([])
  mockListWatches.mockResolvedValue(SAMPLE_WATCHES)
  mockListSyncRuns.mockResolvedValue(SAMPLE_RUNS)
  mockGetSourceHealth.mockResolvedValue({
    // ⚠ READER-OFF IS THE ONLY FIXTURE THIS CONTRACT CAN BE CHECKED AGAINST, and it read
    // `true` until 2026-09-18. §3 demands the `instance-statement` block and §5 demands it
    // appear EXACTLY ONCE — but `SourceReaderStatement` renders NOTHING while the reader is
    // running, so the fixture was asserting the presence of a block it had switched off.
    // Measured: flipping it fixes those two cases and breaks none.
    reader_running: false,
    stopped: [
      { watch_id: "watch-stopped-token", connection_name: "Legal SharePoint", cause: "token_revoked" },
      { watch_id: "watch-stopped-folder", connection_name: "Ops Drive", cause: "folder_gone" },
    ],
  })
  mockTriggerWatchSync.mockResolvedValue({ status: "ok", message: "Checked now." })
  mockUpdateWatch.mockResolvedValue(SAMPLE_WATCHES[0])
  mockDeleteWatch.mockResolvedValue(undefined)
  mockPurgeWatchFiles.mockResolvedValue({ status: "ok", purged_count: 0, message: "" })
  mockGetWatch.mockResolvedValue({ ...SAMPLE_WATCHES[0], items: [] })
}

/**
 * ⚠ EVERY SOURCE BLOCK LIVES IN THE `add-files` SUB-TAB. `WatchedFoldersSection` mounts
 * there (`IngestionTab.tsx:196`, `:228-230`), so the harness activates the Library tab and
 * THEN the sub-tab. Radix Tabs needs pointer events — `userEvent.click`, never
 * `fireEvent.click` (measured).
 */
// ⭐ THE SKETCH DRAWS A SURFACE IN MORE THAN ONE STATE, AND §3 MOUNTS ONE STATE.
//
// Ten of this file’s cases failed for that reason alone, not because a block was missing:
// `history`, `run`, `quiet-fold`, `fail-reason` and `toggle-quiet` live in
// `RunHistoryList`, which mounts only once a watch card’s history is EXPANDED;
// `rail-popover`, `rail-pop-item` and `rail-open-health` live in `AttentionPopover`,
// which mounts only once the rail badge is OPENED. A default render can never show them.
//
// ⛔ THE SURFACE WAS NOT DEFORMED TO SATISFY THE QUERY — the same rule the §3 docblock
// states about its own `>= 1` relaxation. Nothing was made to render eagerly; the harness
// performs the interaction the design says reveals the block, then asserts.
const REVEAL: Record<string, (u: ReturnType<typeof userEvent.setup>) => Promise<void>> = {
  // Expand the first watch card’s run history.
  "sources-history": async (u) => u.click(screen.getAllByTestId("sources-toggle-history")[0]),
  // Open the rail’s attention popover.
  "rail-popover": async (u) => u.click(screen.getByTestId("rail-attention-trigger")),
}
REVEAL["sources-run"] = REVEAL["sources-history"]
REVEAL["sources-quiet-fold"] = REVEAL["sources-history"]
REVEAL["sources-fail-reason"] = REVEAL["sources-history"]
REVEAL["sources-toggle-quiet"] = REVEAL["sources-history"]
REVEAL["rail-pop-item"] = REVEAL["rail-popover"]
REVEAL["rail-open-health"] = REVEAL["rail-popover"]
REVEAL["rail-badge"] = async () => {}

// ⚠ TWO BLOCKS ARE BUILT BUT NOT ADDRESSABLE AS `${screen}-${kind}`.
//
// The sources screen’s Ingestion and Health tabs are real, and §2 already CLICKS them by
// role and name to navigate. They live in `LibraryHeaderBar`, a control shared by all five
// Library tabs, where a `sources-` prefixed hook would be wrong for the other three — so
// they carry `data-tab` instead. ⛔ The product is not renamed to satisfy a naming
// convention: what was wrong is the fence’s assumption that EVERY block is reachable by a
// screen-prefixed testid. `LibraryHeaderBar.tsx` also records that a duplicate hook on this
// exact control broke 41 cases, so adding a second addressable copy is the wrong direction.
const SELECTOR: Record<string, string> = {
  "sources-tab-ingestion": '[role="tab"][data-tab="ingestion"]',
  "sources-tab-health": '[role="tab"][data-tab="health"]',
}

/** How many times a block appears, by testid or by its documented selector. */
function countBlocks(testId: string): number {
  const sel = SELECTOR[testId]
  if (sel) return document.querySelectorAll(sel).length
  return screen.queryAllByTestId(testId).length
}

/** Runs the reveal step for a hook, if that block is state-gated. */
async function reveal(testId: string) {
  const step = REVEAL[testId]
  if (!step) return
  const u = userEvent.setup()
  await step(u)
}

// The rail’s attention list. Two entries so `rail-pop-item` is plural in the popover,
// matching the two stopped sources the `getSourceHealth` fixture above already reports.
const RAIL_ATTENTION = [
  {
    id: "watch-stopped-token",
    title: "Legal SharePoint stopped",
    detail: "Sign-in expired.",
    onOpen: vi.fn(),
  },
  {
    id: "watch-stopped-folder",
    title: "Ops Drive stopped",
    detail: "The folder is gone.",
    onOpen: vi.fn(),
  },
] as const

async function mountScreen(screenName: string) {
  if (screenName === "rail") {
    const { NavPanel } = await import("@/components/layout/NavPanel")
    renderUI(
      <NavPanel
        activeView="documents"
        onNavigate={vi.fn()}
        navItems={railNavItems}
        isOperator={false}
        onNewThread={vi.fn()}
        onSignOut={vi.fn()}
        theme="dark"
        onToggleTheme={vi.fn()}
        expanded={false}
        onToggleExpanded={vi.fn()}
        // ⚠ BOTH OF THESE ARE REQUIRED OR THE RAIL HAS NO BADGE.
        // `showAttention = attention.length > 0 && Boolean(onOpenLibraryHealth)`
        // (NavPanel.tsx:166), and this harness passed NEITHER — so §3 demanded
        // `rail-badge`, `rail-popover`, `rail-pop-item` and `rail-open-health` from a rail
        // mounted in its no-attention state, where the contract says they do not appear.
        // The blocks were built; the HARNESS could not reach them.
        attentionConditions={RAIL_ATTENTION}
        onOpenLibraryHealth={vi.fn()}
      />,
    )
    return
  }
  const { LibraryPage } = await import("@/pages/LibraryPage")
  renderUI(<LibraryPage />)
  const user = userEvent.setup()
  await user.click(screen.getByRole("tab", { name: TAB_BY_SCREEN[screenName] }))
  if (screenName === "sources") {
    await user.click(screen.getByRole("tab", { name: "Add files" }))
  }
}

// ══ §1 THE CONTRACT ITSELF — the non-vacuity floor ═════════════════════════════════════
describe("source-composition fence — §1 the contract itself", () => {
  // ⚠ THE NON-VACUITY CONTROL. A moved or misnamed JSON import can resolve to an empty
  // object rather than throwing, and an empty contract makes every case below vacuously
  // green — a fence that fires on nothing, which is the exact failure this phase exists to
  // stop happening a second time.
  it("resolves to a non-empty object", () => {
    expect(CONTRACT).toBeTypeOf("object")
    expect(Object.keys(CONTRACT).length).toBeGreaterThan(0)
  })

  it("carries all three screens", () => {
    for (const screenName of SCREENS) expect(Object.keys(CONTRACT)).toContain(screenName)
  })

  it("carries a character floor of real content", () => {
    expect(JSON.stringify(CONTRACT).length).toBeGreaterThan(1200)
  })

  it("names at least 15 DISTINCT block kinds across the three screens", () => {
    const kinds = new Set(SCREENS.flatMap((s) => CONTRACT[s].blocks.map((b) => b.kind)))
    expect(kinds.size).toBeGreaterThanOrEqual(15)
  })

  it("was emitted from variant B — the operator's winner, not the rejected A", () => {
    // ⭐ `source-line` exists ONLY in B: A renders every source as a full card. Its presence
    // is the marker that the approved variant was emitted.
    const kinds = SCREENS.flatMap((s) => CONTRACT[s].blocks.map((b) => b.kind))
    expect(kinds).toContain("source-line")
  })
})

// ══ §2 POSITIVE CONTROLS — green in the red baseline, or the baseline proves nothing ═══
describe("source-composition fence — §2 positive controls", () => {
  beforeEach(primeMocks)
  afterEach(cleanup)

  // ⭐ THE SUITE MUST FAIL ON MISSING COMPOSITION, NEVER ON A BROKEN MOUNT HARNESS. A run
  // in which EVERY case is red is indistinguishable from one whose harness is wrong, so
  // these must be GREEN in the RED baseline or the baseline proves nothing.
  it("LibraryPage renders its heading — the page harness works", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderUI(<LibraryPage />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Library")
  })

  it("IngestionTab mounts and carries its shipped hook — `data-testid` is the convention", async () => {
    const { IngestionTab } = await import("@/components/library/IngestionTab")
    renderUI(
      <IngestionTab
        documents={sampleDocuments}
        upload={vi.fn().mockResolvedValue({ isDuplicate: false })}
        uploading={false}
        uploadingCount={0}
      />,
    )
    expect(screen.getByTestId("ingestion-tab")).toBeInTheDocument()
  })

  it("the rail renders a Library nav control — the rail harness works", async () => {
    await mountScreen("rail")
    expect(screen.getByRole("button", { name: "Library" })).toBeInTheDocument()
  })
})

// ══ §3 EVERY BLOCK THE SKETCH DRAWS ════════════════════════════════════════════════════
//
// ⭐ REPAIRED AT PLAN 11 — THIS SECTION USED `getByTestId`, A SINGLE-MATCH QUERY, AND THAT
//   CONTRADICTED §5 OF THIS SAME FILE.
//
// §5 asserts that several of these block KINDS appear 9, 3, 17 and 2 times — because the
// sketch draws them that many times. `getByTestId` THROWS on more than one match, so six
// cases here failed with `Found multiple elements`, which is the OPPOSITE verdict from
// `Unable to find an element`: it means the block IS built, at the contract's own count, and
// the ASSERTION is what was wrong. The affected kinds were `sources-source-line`,
// `sources-source-card`, `sources-outcome`, `sources-stopped-sentence`, `rail-rail-item` and
// `health-attention-row`; plans 09 and 10 both measured this and neither could safely edit
// the file while a sibling executor was live in it.
//
// ⛔ THE SURFACE WAS NOT DEFORMED TO SATISFY THE OLD QUERY. Rendering one `source-line` would
//   have turned this section green and broken §5, the variant-B fork the operator chose, and
//   the whole point of the 9-vs-3 fixture.
//
// ⚠ THE RELAXATION IS EXACTLY ONE STEP, AND NO MORE. `>= 1` still fails by NAME when a block
//   is missing — driven RED against a planted absence before being accepted, because a fence
//   nobody has seen fire is not a fence (that is what sketch 218 shipped). ⛔ It deliberately
//   does NOT assert a count: §5 owns the counts, from the contract's own numbers, and
//   duplicating them here would give two places to disagree about one design.
//   `getAllByTestId(...).length` is the shape §4 of this file already uses.
describe("source-composition fence — §3 every block the sketch draws", () => {
  beforeEach(primeMocks)
  afterEach(cleanup)

  for (const screenName of SCREENS) {
    describe(`${screenName}`, () => {
      const blocks = CONTRACT[screenName]?.blocks ?? []
      for (const block of blocks) {
        it(`renders the \`${block.kind}\` block as [data-testid="${hook(screenName, block.kind)}"]`, async () => {
          await mountScreen(screenName)
          // State-gated blocks are revealed by the interaction the design names; the rest
          // are no-ops. See REVEAL above for why this is not a relaxation.
          await reveal(hook(screenName, block.kind))
          expect(countBlocks(hook(screenName, block.kind))).toBeGreaterThanOrEqual(1)
        })
      }
    })
  }
})

// ══ §4 EVERY NAMED CONTROL ═════════════════════════════════════════════════════════════
//
// `badge · open-health · fix · sync-now · toggle-history · toggle-quiet · report-source ·
//  go-to-source` — the contract's own `buttons` arrays, never a re-typed list.
//
// ⚠ The control is matched by its ACCESSIBLE NAME, and the sketch's `data-action` value is
// the control's IDENTITY rather than its label. The build gives each one a `data-testid`
// hook of the same name, so the fence names the missing control precisely.
describe("source-composition fence — §4 every named control", () => {
  beforeEach(primeMocks)
  afterEach(cleanup)

  for (const screenName of SCREENS) {
    const buttons = CONTRACT[screenName]?.buttons ?? []
    for (const action of buttons) {
      it(`${screenName} · offers the \`${action}\` control as [data-testid="${hook(screenName, action)}"]`, async () => {
        await mountScreen(screenName)
        // §4 needs the SAME reveal §3 does: a control inside a fold or a popover is not
        // reachable in the default render either.
        await reveal(hook(screenName, action))
        expect(screen.getAllByTestId(hook(screenName, action)).length).toBeGreaterThan(0)
      })
    }
  }
})

// ══ §5 THE COUNTS THAT MUST HOLD — variant B ═══════════════════════════════════════════
//
// ⚠ The numbers are READ FROM the contract, not typed here. `drive.cjs --emit-json` writes
// the "Counts that must hold" block as data precisely so a test author cannot remember one
// wrong. The expected values at the time of writing: 9 `source-line` + 3 `source-card`
// (every source accounted for exactly once), 2 `attention-row`, 3 `run` collapsed vs 17
// expanded, and `instance-statement` exactly once.
describe("source-composition fence — §5 the counts that must hold", () => {
  beforeEach(primeMocks)
  afterEach(cleanup)

  it("the contract's own counts are the sketch's numbers", () => {
    expect(CONTRACT.counts.sourceLine).toBe(9)
    expect(CONTRACT.counts.sourceCard).toBe(3)
    expect(CONTRACT.counts.sourceLine + CONTRACT.counts.sourceCard).toBe(CONTRACT.counts.sources)
    expect(CONTRACT.counts.attentionRow).toBe(2)
    expect(CONTRACT.counts.runCollapsed).toBe(3)
    expect(CONTRACT.counts.runExpanded).toBe(17)
    expect(CONTRACT.counts.instanceStatement).toBe(1)
  })

  it(`collapses every healthy source to a line — ${9} \`source-line\``, async () => {
    await mountScreen("sources")
    expect(screen.getAllByTestId(hook("sources", "source-line"))).toHaveLength(
      CONTRACT.counts.sourceLine,
    )
  })

  it("⛔ NEVER collapses a stopped or unreadable source — 3 `source-card`", async () => {
    await mountScreen("sources")
    expect(screen.getAllByTestId(hook("sources", "source-card"))).toHaveLength(
      CONTRACT.counts.sourceCard,
    )
  })

  it("accounts for every source exactly once — as a line or as a card, never neither", async () => {
    await mountScreen("sources")
    const lines = screen.queryAllByTestId(hook("sources", "source-line")).length
    const cards = screen.queryAllByTestId(hook("sources", "source-card")).length
    expect(lines + cards).toBe(CONTRACT.counts.sources)
  })

  it("Health lists one `attention-row` per stopped source — 2, never all 12", async () => {
    await mountScreen("health")
    expect(screen.getAllByTestId(hook("health", "attention-row"))).toHaveLength(
      CONTRACT.counts.attentionRow,
    )
    expect(screen.queryAllByTestId(hook("health", "source-card"))).toHaveLength(0)
  })

  it("a collapsed history shows 3 `run` rows; expanded shows all 17", async () => {
    await mountScreen("sources")
    const user = userEvent.setup()
    await user.click(screen.getAllByTestId(hook("sources", "toggle-history"))[0])
    expect(screen.getAllByTestId(hook("sources", "run"))).toHaveLength(
      CONTRACT.counts.runCollapsed,
    )
    await user.click(screen.getAllByTestId(hook("sources", "toggle-quiet"))[0])
    expect(screen.getAllByTestId(hook("sources", "run"))).toHaveLength(
      CONTRACT.counts.runExpanded,
    )
  })

  it("⭐ the reader-off statement appears EXACTLY ONCE, never per row (D-235-12)", async () => {
    await mountScreen("sources")
    expect(screen.getAllByTestId(hook("sources", "instance-statement"))).toHaveLength(
      CONTRACT.counts.instanceStatement,
    )
  })
})

// ══ §6 THE §4 INVARIANTS, AS SOURCE FENCES OVER THE LIVE FILES ═════════════════════════
//
// ⚠ EVERY `?raw` FENCE CARRIES ITS OWN NON-VACUITY ASSERTION FIRST. An import that resolved
// empty, or a regex that matched nothing, yields "" — and "" satisfies every `not.toContain`
// below while looking green. That is the same defect §1 guards for the JSON contract.
describe("source-composition fence — §6 the invariants a later edit must not break", () => {
  it("non-vacuity — both `?raw` imports carry their live source", () => {
    expect(sourcesPySource.length).toBeGreaterThan(5000)
    expect(sourcesPySource).toContain("watches")
    expect(watchedFoldersSource.length).toBeGreaterThan(5000)
    expect(watchedFoldersSource).toContain("WatchedFoldersSection")
  })

  // ⛔ BUG-260906-02 — "scheduled" described the REQUEST, never the outcome. ⚠ RESEARCH C-7:
  // the word lives in the FRONTEND too (`WatchedFoldersSection.tsx:78`), not only in
  // `api/sources.py:293-294`. A fence over one file leaves the invariant broken on screen.
  it('⛔ the word "scheduled" appears in NEITHER `api/sources.py`…', () => {
    expect(sourcesPySource.toLowerCase()).not.toContain("scheduled")
  })

  it('⛔ …NOR `WatchedFoldersSection.tsx` — the frontend half (RESEARCH C-7)', () => {
    expect(watchedFoldersSource.toLowerCase()).not.toContain("scheduled")
  })

  // ⛔ SURF-01, pinned by 234 — there is no webhook, so nothing may claim there is one.
  for (const forbidden of ["instantly", "on change"]) {
    it(`⛔ "${forbidden}" appears in neither file — there is no webhook`, () => {
      expect(sourcesPySource.toLowerCase()).not.toContain(forbidden)
      expect(watchedFoldersSource.toLowerCase()).not.toContain(forbidden)
    })
  }

  // ⛔ The stopped mark uses the WARNING token. `--color-danger` (`destructive` in this
  // codebase's token vocabulary) is never applied to a SOURCE STATE — the sketch's §9
  // posture: no red, no alarm. A destructive Delete button or an error banner is a
  // different thing and stays legal, so the fence is scoped to the state expression itself.
  it("⛔ `--color-danger` is never applied to a source state", () => {
    expect(watchedFoldersSource).toContain("last_status") // the anchor the regex needs
    expect(watchedFoldersSource).not.toMatch(
      /last_status\s*===\s*"failed"[\s\S]{0,200}?destructive/,
    )
  })
})
