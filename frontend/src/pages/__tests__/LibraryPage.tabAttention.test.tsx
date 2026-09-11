/**
 * Phase 244 plan 04 Task 2 (SHELL-05 · BUG-260911-03) —
 * THE SHELL SAYS **THAT**, THE TAB SAYS **WHERE**.
 *
 * ── THE OPERATOR'S COMPLAINT, VERBATIM ────────────────────────────────────────────────
 *
 * *"The badge creates a question it then refuses to answer."* The rail badge names a count and
 * stops at the Library door, leaving five tabs to hunt through — and *"the cost scales the wrong
 * way"*, because the badge is most useful exactly when several things need attention.
 *
 * ── ⛔ THE THREE NEGATIVES THIS FILE EXISTS FOR ───────────────────────────────────────
 *
 * The attribution is cheap; **what is expensive is the three ways it could have been bought**,
 * and each one is a named prohibition with a measured defect behind it:
 *
 *  1. **No second producer** — `D-235-03`. Fenced in `attentionTab.test.ts` (Task 1).
 *  2. **No third `useSourceAttention()` reader** — arm 1 of the registry's own re-open trigger.
 *     The attribution travels as DATA down the props path the shell already owns; the `?raw`
 *     inventory in Task 1's suite and in `ChatLayout.badge.test.tsx` is what reds a third.
 *  3. **No second writer of `libraryTab`** — the Phase 235 plan-15 defect, verbatim: `App.tsx`
 *     set the hand-off and never cleared it, so ONE badge click permanently redefined where the
 *     Library opens. That is fenced twice below — the writer COUNT by `?raw`, and the clearing
 *     RULE exercised on the strict leaf that owns it.
 *
 * ── ⚠ WHY THE MARKS ARE ASSERTED ON WORDS AND NOT ON BLOCKS ──────────────────────────
 *
 * A `data-testid` presence assertion would pass over a badge that lit the wrong tab, or that
 * printed a zero, or that renamed the control. **This project shipped ~200 green assertions over
 * a surface the operator said was "nothing at all like what we designed"** for exactly that
 * reason. So: the five tab labels are read through their ACCESSIBLE NAMES (which is also how the
 * `aria-hidden` rule below is enforced), and the counts are read as rendered TEXT.
 *
 * ── THE `aria-hidden` RULE IS NOT DECORATION ─────────────────────────────────────────
 *
 * `IngestionTab.tsx:176-188` records this project's own measurement: an unhidden count turned a
 * tab's accessible name into *"In progress 3"* and broke six `getByRole` cases. There are 41+
 * `getByRole("tab", { name })` cases against this very control. **A badge may decorate a
 * control's name; it may not RENAME it.**
 *
 * Mocks: the harness is `LibraryPage.initialTab.test.tsx`'s, for its own recorded reason —
 * `@/lib/api` is a re-export barrel with ~12 domain modules behind it and a full replacement
 * throws at MOUNT about the export it forgot rather than about the edit under test (the Phase
 * 196-08 nine-suite, 249-case failure mode). `@/lib/api/sources` is not in that barrel (P-10).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

import { TooltipProvider } from "@/components/ui/tooltip"
import type { Document, Folder } from "@/types"
import { libraryTabAfterNavigate, LIBRARY_VIEW } from "@/lib/libraryTabHandoff"
import type { LibraryTab } from "@/pages/librarySelection"
import type { AttentionCondition } from "@/components/layout/attentionConditions"
// ⚠ `?raw` is TEXT — importing these evaluates no module, so this suite's mocks do not have to
// cover `App.tsx`'s or `ChatLayout.tsx`'s own import graphs. It is the shipped idiom here.
import appSource from "@/App.tsx?raw"
import layoutSource from "@/components/layout/ChatLayout.tsx?raw"
import pageSource from "@/pages/LibraryPage.tsx?raw"

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
  mockGetRetrievalTrend,
  mockGetNeverRetrieved,
  mockGetLowConfidenceQueries,
  mockGetStaleDocs,
  mockGetGovBroken,
  mockGetGovUnclassified,
  mockGetGovLowConfidence,
  mockListCheckedQueries,
  mockListConnectorConnections,
  mockListWatches,
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
  mockGetRetrievalTrend: vi.fn(),
  mockGetNeverRetrieved: vi.fn(),
  mockGetLowConfidenceQueries: vi.fn(),
  mockGetStaleDocs: vi.fn(),
  mockGetGovBroken: vi.fn(),
  mockGetGovUnclassified: vi.fn(),
  mockGetGovLowConfidence: vi.fn(),
  mockListCheckedQueries: vi.fn(),
  mockListConnectorConnections: vi.fn(),
  mockListWatches: vi.fn(),
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
    getRetrievalTrend: mockGetRetrievalTrend,
    getNeverRetrieved: mockGetNeverRetrieved,
    getLowConfidenceQueries: mockGetLowConfidenceQueries,
    getStaleDocs: mockGetStaleDocs,
    getGovBroken: mockGetGovBroken,
    getGovUnclassified: mockGetGovUnclassified,
    getGovLowConfidence: mockGetGovLowConfidence,
    listCheckedQueries: mockListCheckedQueries,
    listConnectorConnections: mockListConnectorConnections,
  }
})

vi.mock("@/lib/api/sources", () => ({
  listWatches: mockListWatches,
  getWatch: vi.fn().mockResolvedValue(null),
  createWatch: vi.fn(),
  updateWatch: vi.fn(),
  deleteWatch: vi.fn(),
  triggerWatchSync: vi.fn(),
  purgeWatchFiles: vi.fn(),
  listSyncRuns: vi.fn().mockResolvedValue([]),
  getSourceHealth: mockGetSourceHealth,
}))

vi.mock("@/hooks/useDocuments", () => ({ useDocuments: mockUseDocuments }))
vi.mock("@/hooks/useFolders", () => ({ useFolders: mockUseFolders }))

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

import { LibraryPage } from "@/pages/LibraryPage"
import { attentionCountByTab } from "@/components/layout/attentionConditions"

const sampleFolders: Folder[] = [
  {
    id: "folder-1",
    user_id: "user-1",
    name: "Research",
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
    folder_id: "folder-1",
    filename: "research.pdf",
    file_path: "/uploads/research.pdf",
    file_size: 1024,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 10,
    content_hash: "abc123",
    metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]

/** ⛔ THE FIVE LABELS, SPELLED OUT ONCE — and asserted EQUAL to the page's own derived control
 *  below. This is a copy on purpose: if it were imported from the page it could not detect the
 *  page re-typing its own list, which is the drift `D-217-15` forbids. */
const EXPECTED_LABELS: ReadonlyArray<readonly [LibraryTab, string]> = [
  ["documents", "Documents"],
  ["views", "Views"],
  ["ingestion", "Ingestion"],
  ["indexing", "Indexing"],
  ["health", "Health"],
]

/** Conditions shaped exactly as the one registered producer emits them. */
function stoppedConditions(n: number, tab: LibraryTab | undefined = "health"): AttentionCondition[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `watch-${i + 1}`,
    title: `Rate sheets ${i + 1}`,
    detail: "The watched folder is no longer shared with this connection.",
    onOpen: vi.fn(),
    ...(tab ? { tab } : {}),
  }))
}

function renderPage(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

/** The mark on ONE tab, as rendered text. `null` when the tab carries no mark at all. */
function markOn(tab: LibraryTab): string | null {
  const el = screen.queryByTestId(`library-tab-attention-${tab}`)
  return el ? (el.textContent ?? "") : null
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseDocuments.mockReturnValue({
    documents: sampleDocuments,
    uploading: false,
    uploadingCount: 0,
    upload: vi.fn().mockResolvedValue({ isDuplicate: false }),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    loadDocuments: vi.fn().mockResolvedValue(undefined),
  })
  mockUseFolders.mockReturnValue({
    folders: sampleFolders,
    createFolder: vi.fn().mockResolvedValue({}),
    renameFolder: vi.fn().mockResolvedValue(undefined),
    deleteFolder: vi.fn().mockResolvedValue(undefined),
    toggleOrgShared: vi.fn().mockResolvedValue(undefined),
  })
  mockListViews.mockResolvedValue([])
  mockListMetadataFields.mockResolvedValue([])
  mockResolveView.mockResolvedValue({ documents: [], total: 0 })
  mockResolveAdHoc.mockResolvedValue({ documents: [], total: 0 })
  mockGetReembedProgress.mockResolvedValue({
    status: "idle",
    total: 0,
    re_embedded: 0,
    remaining: 0,
    model: "text-embedding-3-small",
    updated_at: null,
  })
  mockGetIndexSummary.mockResolvedValue({
    vectors: 0,
    chunks_total: 0,
    documents_without_vectors: 0,
    last_indexed: null,
    model: "text-embedding-3-small",
    dimensions: 1536,
    provider: "openai",
    folders: [],
  })
  mockGetHealthOverview.mockResolvedValue({
    total_documents: 1,
    retrieved_this_month: 1,
    never_retrieved_count: 0,
    high_confidence_rate: 0.9,
  })
  mockGetRetrievalTrend.mockResolvedValue([])
  mockGetNeverRetrieved.mockResolvedValue([])
  mockGetLowConfidenceQueries.mockResolvedValue([])
  mockGetStaleDocs.mockResolvedValue([])
  mockGetGovBroken.mockResolvedValue([])
  mockGetGovUnclassified.mockResolvedValue([])
  mockGetGovLowConfidence.mockResolvedValue([])
  mockListCheckedQueries.mockResolvedValue([])
  mockListConnectorConnections.mockResolvedValue([])
  mockListWatches.mockResolvedValue([])
  mockGetSourceHealth.mockResolvedValue({
    stopped: [],
    reader_running: true,
    poll_interval_seconds: 60,
  })
})

// ══ NON-VACUITY FIRST ═════════════════════════════════════════════════════════════════
//
// Every negative below ("the other four render nothing") is vacuously green on a page that
// rendered no tabs at all. The control asks for the five controls the marks attach TO.
describe("Library tab attention — the harness itself", () => {
  it("renders the five tab controls the marks attach to, named exactly", async () => {
    renderPage(<LibraryPage />)
    await waitFor(() => expect(screen.getAllByRole("tab").length).toBe(5))
    for (const [, label] of EXPECTED_LABELS) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument()
    }
  })
})

// ══ 1 · THE OWNING TAB IS MARKED, AND ONLY IT ═════════════════════════════════════════
describe("Library tab attention — the tab says WHERE", () => {
  it("⛔ RED BEFORE THE EDIT: one health condition marks Health with 1 and the other four with nothing", async () => {
    renderPage(<LibraryPage attentionConditions={stoppedConditions(1)} />)
    await waitFor(() => expect(screen.getAllByRole("tab").length).toBe(5))

    expect(markOn("health")).toBe("1")
    // ⛔ S-2: empty ⇒ render NOTHING. No zero badges, no reserved space, no dimmed dot.
    for (const tab of ["documents", "views", "ingestion", "indexing"] as LibraryTab[]) {
      expect(markOn(tab)).toBeNull()
    }
  })

  it("THREE conditions render 3 — the badge is most useful when several things are wrong", async () => {
    // The operator's own point: *"the cost scales the wrong way"*. A dot would have thrown away
    // the one number the shell had already earned.
    renderPage(<LibraryPage attentionConditions={stoppedConditions(3)} />)
    await waitFor(() => expect(screen.getAllByRole("tab").length).toBe(5))
    expect(markOn("health")).toBe("3")
    expect(markOn("documents")).toBeNull()
  })

  it("a condition with NO tab marks nothing and does not crash — the field is optional", async () => {
    renderPage(<LibraryPage attentionConditions={stoppedConditions(2, undefined)} />)
    await waitFor(() => expect(screen.getAllByRole("tab").length).toBe(5))
    for (const [tab] of EXPECTED_LABELS) {
      expect(markOn(tab)).toBeNull()
    }
  })

  it("no conditions at all renders no mark anywhere — the resting state is untouched", async () => {
    renderPage(<LibraryPage attentionConditions={[]} />)
    await waitFor(() => expect(screen.getAllByRole("tab").length).toBe(5))
    for (const [tab] of EXPECTED_LABELS) {
      expect(markOn(tab)).toBeNull()
    }
  })
})

// ══ 2 · A BADGE MAY DECORATE A NAME; IT MAY NOT RENAME IT ═════════════════════════════
describe("Library tab attention — the mark renames nothing", () => {
  it("⛔ the five accessible names are still exactly TAB_LABELS' values, mark or no mark", async () => {
    renderPage(<LibraryPage attentionConditions={stoppedConditions(2)} />)
    await waitFor(() => expect(screen.getAllByRole("tab").length).toBe(5))

    // ⚠ Read through the ACCESSIBLE NAME, which is what `aria-hidden` acts on and what the 41+
    // shipped `getByRole("tab", { name })` cases use. `IngestionTab.tsx:176-188` measured six of
    // them breaking when a count was left unhidden.
    for (const [, label] of EXPECTED_LABELS) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument()
    }
    // …and the marked one is genuinely marked, or the loop above proves nothing new.
    expect(markOn("health")).toBe("2")
    expect(screen.getByTestId("library-tab-attention-health")).toHaveAttribute(
      "aria-hidden",
      "true",
    )
  })

  it("the labels are DERIVED, never re-typed — the control's order and words match TAB_LABELS", async () => {
    renderPage(<LibraryPage />)
    await waitFor(() => expect(screen.getAllByRole("tab").length).toBe(5))
    const rendered = screen.getAllByRole("tab").map((t) => t.getAttribute("data-tab"))
    expect(rendered).toEqual(EXPECTED_LABELS.map(([tab]) => tab))
    const names = screen.getAllByRole("tab").map((t) => t.textContent)
    expect(names).toEqual(EXPECTED_LABELS.map(([, label]) => label))
  })
})

// ══ 3 · THE COUNT MAP IS A STRICT LEAF ════════════════════════════════════════════════
describe("attentionCountByTab — the derivation, with nothing mounted", () => {
  it("counts per tab and omits tabs with nothing", () => {
    expect(attentionCountByTab(stoppedConditions(3))).toEqual({ health: 3 })
  })

  it("ignores conditions with no tab rather than bucketing them under a default", () => {
    // ⛔ A tab-less condition belongs to no Library tab. Bucketing it anywhere would make the
    // shell's count and the tab's count disagree about the same thing.
    expect(attentionCountByTab(stoppedConditions(2, undefined))).toEqual({})
  })

  it("an empty registry derives an empty map, never a map of zeroes", () => {
    expect(attentionCountByTab([])).toEqual({})
  })

  it("buckets by tab, not by producer — two tabs, two counts", () => {
    const mixed: AttentionCondition[] = [
      ...stoppedConditions(2, "health"),
      { id: "x", title: "t", detail: "d", onOpen: vi.fn(), tab: "ingestion" },
    ]
    expect(attentionCountByTab(mixed)).toEqual({ health: 2, ingestion: 1 })
  })
})

// ══ 4 · THE ONE-SHOT HAND-OFF SURVIVES ════════════════════════════════════════════════
describe("Library tab attention — the hand-off is still spent on navigate", () => {
  it("⛔ the Phase 235 plan-15 defect stays closed: away-and-back opens on the page's own default", () => {
    // Exercised on the strict leaf that OWNS the rule — it needs no mount, and the shipped
    // "seeds, never pins" case could not see this defect precisely because it lived BETWEEN
    // mounts rather than inside one.
    expect(libraryTabAfterNavigate("health", LIBRARY_VIEW)).toBe("health")
    expect(libraryTabAfterNavigate("health", "chat")).toBeUndefined()
    expect(libraryTabAfterNavigate("health", "settings")).toBeUndefined()
    expect(libraryTabAfterNavigate(undefined, LIBRARY_VIEW)).toBeUndefined()
  })

  it("⛔ `setLibraryTab` has EXACTLY the two writers it shipped with — a third is a second author", () => {
    // ⚠ Counted in CODE, not in raw text: `App.tsx` carries a long comment block about this very
    // hand-off, and a measurement a comment can satisfy is the 187-24 lesson this repository has
    // now paid for four times.
    const code = appSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
    expect((code.match(/setLibraryTab\s*\(/g) ?? []).length).toBe(2)
    // Non-vacuity: the stripper did not return "" and this really is App.
    expect(code).toContain("export type ActiveView")
    expect(code).toContain("libraryTabAfterNavigate")
  })
})

// ══ 5 · THE KEY LINK — THE SHELL HANDS THE PAGE ITS DATA ══════════════════════════════
describe("Library tab attention — the shell threads conditions DOWN, it does not re-poll", () => {
  it("⛔ ChatLayout passes its ONE resolved condition list into the Library mount", () => {
    // The 120-character proximity window `renameFence.test.ts` guards is deliberately NOT
    // re-asserted here — that fence is about the Documents→Library rename. This one is about
    // the data reaching the page at all, which is the link the attribution rides.
    expect(
      /<LibraryPage[\s\S]{0,200}attentionConditions=\{attentionConditions\}/.test(layoutSource),
    ).toBe(true)
    // …and it still resolves the registry exactly ONCE.
    expect((layoutSource.match(/ATTENTION_PRODUCERS\.flatMap/g) ?? []).length).toBe(1)
  })

  it("⛔ the page never calls the hook — it receives a verdict, it does not fetch one", () => {
    // Arm 1 of `attentionConditions.ts`'s re-open trigger is a THIRD concurrent reader. This is
    // the same property Task 1's `?raw` inventory pins, asserted from the page's own side.
    const code = pageSourceCode()
    expect(code).not.toContain("useSourceAttention")
    expect(code).toContain("export function LibraryPage")
  })
})

/** The page's CODE (comments stripped), read as text. */
function pageSourceCode(): string {
  return pageSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}
