/**
 * Phase 235-08 (SURF-03 / D-235-04 / D-235-17) — the Library opens on a tab a CALLER chose.
 *
 * ── WHY THIS SUITE EXISTS, MEASURED RATHER THAN ASSUMED ────────────────────────────────
 * Before this plan, `LibraryPage`'s entire signature was `({ onNavigate })`. The tab lived
 * in `useReducer(pageReducer, initialLibraryState)` — page-internal state whose initial
 * value hardcodes `{ tab: "documents" }` — and the only writes were three `SELECT_TAB`
 * dispatches, ALL inside `LibraryPage`. So **no caller outside the Library could open the
 * Health tab**, and SURF-03's whole route (rail badge → popover → Health → source card) was
 * impossible. That is the cost this suite prices.
 *
 * ── ⛔ NO SEVENTH REDUCER ACTION, AND NO ROUTER ────────────────────────────────────────
 * `librarySelection.test.ts` asserts the action set is EXACTLY SIX, and `LibraryPage.tsx`'s
 * own `pageReducer` docblock records why a page-level need is composed at the BOUNDARY
 * instead of by editing the leaf (`SET_FOLDER_SHEET` is the shipped precedent). The initial
 * tab is seeded the same way — a spread of `initialLibraryState` at the `useReducer` call.
 * And there is no URL in any of it: this app has no router (`SEED-185`); navigation is a
 * `useState<ActiveView>` switch in `App.tsx`, so the prop is the ONLY door.
 *
 * ── THE SEED IS NOT A PIN ─────────────────────────────────────────────────────────────
 * The last case is the one that matters most: an initial tab that could not afterwards be
 * left would be a worse defect than the one being fixed. It mounts on Health and clicks
 * back to Documents.
 *
 * Mocks: `@/lib/api` is mocked PARTIALLY via `importOriginal` — it is a re-export barrel
 * with ~12 domain modules behind it, and a full replacement throws at MOUNT about the one
 * export it forgot rather than about the edit under test (the Phase 196-08 nine-suite
 * failure mode). `@/lib/api/sources` is NOT in that barrel (measured, P-10) and is mocked
 * separately, exactly as `sourceComposition.test.tsx:133-147` does.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useState } from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

import { TooltipProvider } from "@/components/ui/tooltip"
import type { Document, Folder } from "@/types"
// Phase 235 plan 15 (gap-closure round 1 · G5) — the clearing rule under test, and the
// App wiring that has to actually USE it. `?raw` is TEXT: importing App this way evaluates
// no module, so none of this suite's mocks have to cover App's own import graph.
import { libraryTabAfterNavigate, LIBRARY_VIEW } from "@/lib/libraryTabHandoff"
import type { LibraryTab } from "@/pages/librarySelection"
import appSource from "@/App.tsx?raw"

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
  // Phase 235 plan 11 — hoisted so ONE case can hand the Health tab a stopped source.
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

// ⚠ Phase 235 plan 10 — `listSyncRuns` and `getSourceHealth` are NOT optional here.
//   `IngestionTab` now mounts `useSourceAttention`, which imports `getSourceHealth` from this
//   module, and `WatchedFoldersSection` imports `listSyncRuns`. A factory that omits an export
//   makes this suite throw AT MOUNT about a missing export rather than about the thing under
//   test — Phase 196-08's nine-suite, 249-case failure mode, verbatim.
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

function renderPage(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

/** The active tab, read from the ONE tablist (`LibraryHeaderBar`, which owns role="tab"). */
function selectedTabName(): string | null {
  const active = screen.getAllByRole("tab").find((t) => t.getAttribute("aria-selected") === "true")
  return active ? active.textContent : null
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

describe("LibraryPage — initialTab", () => {
  // ── THE CONTROL. Everything below is worthless if the default moved. ────────────────
  it("lands on Documents with NO prop — the default is unchanged and the prop is optional", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)

    expect(selectedTabName()).toBe("Documents")
    expect(screen.getByRole("tab", { name: "Health" })).toHaveAttribute("aria-selected", "false")
  })

  it("⭐ lands on Health when the CALLER asks for it — SURF-03's route exists at all", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage initialTab="health" />)

    expect(screen.getByRole("tab", { name: "Health" })).toHaveAttribute("aria-selected", "true")
    expect(selectedTabName()).toBe("Health")
    // …and the Health BODY is mounted, not merely the trigger painted. Radix unmounts an
    // inactive TabsContent, so an unseeded reducer would leave this absent.
    /**
     * ⚠ WAS `health-coverage-ring`, which no longer exists. The "found by a search" ring was
     * REMOVED on 2026-09-06 (operator decision) because it drew DEMAND on a red-to-green health
     * scale. `SourcesAttentionSection.test.tsx` re-anchored for the same reason; this suite was
     * missed in that pass and sat RED from `4e0b0323b` — found at the Phase 236 reviewer baseline.
     *
     * The case's PROPERTY is unchanged and is the whole point — the Health tab BODY must be
     * mounted, not merely its trigger painted. `health-freshness-donut` is HealthTab's own
     * unconditional wrapper (`HealthTab.tsx:121`; only its INNER content is data-gated), so this
     * still goes red if the tab stops rendering. Re-anchoring, not weakening.
     */
    expect(await screen.findByTestId("health-freshness-donut")).toBeInTheDocument()
  })

  it("lands on Ingestion too — the prop is GENERAL, not a health special case", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage initialTab="ingestion" />)

    expect(screen.getByRole("tab", { name: "Ingestion" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(await screen.findByTestId("ingestion-tab")).toBeInTheDocument()
    // NON-VACUITY: the tab it did NOT ask for is not selected.
    expect(screen.getByRole("tab", { name: "Health" })).toHaveAttribute("aria-selected", "false")
  })

  it("⛔ SEEDS the tab, never PINS it — Documents is still reachable after mounting on Health", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage initialTab="health" />)
    expect(selectedTabName()).toBe("Health")

    fireEvent.click(screen.getByRole("tab", { name: "Documents" }))

    await waitFor(() => expect(selectedTabName()).toBe("Documents"))
    expect(screen.getByRole("tab", { name: "Health" })).toHaveAttribute("aria-selected", "false")
  })

  /**
   * ⭐ SURF-03's LAST HOP, EXERCISED RATHER THAN ASSUMED (Phase 235 plan 11 · D-235-17).
   *
   * The route is: rail badge → popover → Library Health → the source card that can fix it.
   * Plans 08 and 09 built the first three legs; this case drives the fourth. The Health row
   * carries NO repair — its one control is a door, and the door has to actually open.
   *
   * ⛔ There is no URL in any of this (SEED-185): the hop is a `SELECT_TAB` dispatch, so the
   * assertion is on the selected tab, never on a location.
   */
  it("⭐ `Go to source` on a Health attention row lands on the Ingestion tab", async () => {
    mockGetSourceHealth.mockResolvedValue({
      stopped: [
        {
          watch_id: "watch-legal",
          source_folder_name: "Contracts / Executed",
          connection_name: "Legal SharePoint",
          cause: "token_revoked",
          hard: true,
          stopped_since: new Date(Date.now() - 3 * 3_600_000).toISOString(),
          last_good_at: null,
        },
      ],
      reader_running: true,
      poll_interval_seconds: 60,
    })

    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage initialTab="health" />)

    // Non-vacuity: we really are on Health, and the row really did render.
    expect(selectedTabName()).toBe("Health")
    const goToSource = await screen.findByTestId("health-go-to-source")

    fireEvent.click(goToSource)

    await waitFor(() => expect(selectedTabName()).toBe("Ingestion"))
    expect(await screen.findByTestId("ingestion-tab")).toBeInTheDocument()
  })

  it("still accepts `onNavigate` alongside — the new prop is additive", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    const onNavigate = vi.fn()
    renderPage(<LibraryPage onNavigate={onNavigate} initialTab="indexing" />)

    expect(screen.getByRole("tab", { name: "Indexing" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// ⭐ THE HAND-OFF IS ONE-SHOT — Phase 235 plan 15 (gap-closure round 1 · verification G5)
// ══════════════════════════════════════════════════════════════════════════════════════════
/**
 * ── THE DEFECT, MEASURED RATHER THAN SUSPECTED ────────────────────────────────────────────
 *
 * `App.tsx` set `libraryTab = "health"` in `handleOpenLibraryHealth` and NEVER cleared it —
 * `grep setLibraryTab frontend/src/App.tsx` returned exactly ONE write. `ChatLayout` renders
 * `<LibraryPage>` inside a ternary, so the page UNMOUNTS on navigation away and re-seeds its
 * reducer from `initialTab` on EVERY return. After ONE badge-popover click, every subsequent
 * entry into the Library opened on Health — directly contradicting `App.tsx`'s own comment
 * (*"`undefined` means 'the page decides', so the Library keeps its own default on every
 * other entry into it"*).
 *
 * ── ⛔ WHY THE SHIPPED "SEEDS, NEVER PINS" CASE ABOVE COULD NOT CATCH THIS ────────────────
 *
 * That case mounts ONCE and clicks a tab. It proves a WITHIN-mount transition still works,
 * which was never in doubt — the reducer was untouched. **The defect lives BETWEEN mounts**:
 * `initialTab` is read by a LAZY reducer initializer, which runs only at mount, so a suite
 * that never unmounts cannot observe a stale hand-off at all. The case below UNMOUNTS the
 * page and brings it back, which is the only shape that can see it.
 */

describe("libraryTabAfterNavigate — the clearing rule, as a pure function", () => {
  it("KEEPS the pending tab when the destination IS the Library", () => {
    // ⛔ Non-negotiable: clearing on the way IN would clear the hand-off before the page
    //    that consumes it ever mounted, and the badge route would silently do nothing.
    expect(libraryTabAfterNavigate("health", LIBRARY_VIEW)).toBe("health")
    expect(libraryTabAfterNavigate("health", "documents")).toBe("health")
  })

  it("CLEARS it on every other destination — the hand-off is an intent, never a mode", () => {
    for (const view of [
      "chat",
      "skills",
      "settings",
      "workflows",
      "classification-rules",
      "connections",
      "skill-studio",
      "control-room",
      "org-admin",
      "workflow-run",
    ]) {
      expect(libraryTabAfterNavigate("health", view)).toBeUndefined()
    }
  })

  it("is idempotent — an empty hand-off is never resurrected", () => {
    expect(libraryTabAfterNavigate(undefined, "documents")).toBeUndefined()
    expect(libraryTabAfterNavigate(undefined, "chat")).toBeUndefined()
  })

  it("carries ANY tab — the rule is about the hand-off, not about Health", () => {
    expect(libraryTabAfterNavigate("ingestion", "documents")).toBe("ingestion")
    expect(libraryTabAfterNavigate("ingestion", "chat")).toBeUndefined()
  })
})

describe("LibraryPage — the hand-off survives ONE entry and no more", () => {
  it("⭐ REMOUNTS on the page's OWN default after the Health hand-off was used once", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")

    /** The shape `App.tsx` now ships: ONE writer (the badge route) and ONE navigator that
     *  applies the clearing rule. Reverting the navigator to the bare view setter — which is
     *  exactly what shipped — makes step 3 below read "Health" and this case red. */
    function AppHandoffHarness() {
      const [view, setView] = useState<"chat" | "documents">("chat")
      const [pendingTab, setPendingTab] = useState<LibraryTab | undefined>(undefined)
      const navigate = (next: "chat" | "documents") => {
        setView(next)
        setPendingTab((pending) => libraryTabAfterNavigate(pending, next))
      }
      const openLibraryHealth = () => {
        setPendingTab("health")
        setView("documents")
      }
      return (
        <div>
          <button onClick={openLibraryHealth}>open-health</button>
          <button onClick={() => navigate("chat")}>go-chat</button>
          <button onClick={() => navigate("documents")}>go-library</button>
          {view === "documents" ? (
            <LibraryPage initialTab={pendingTab} />
          ) : (
            <div data-testid="not-the-library" />
          )}
        </div>
      )
    }

    renderPage(<AppHandoffHarness />)

    // 1 · NON-VACUITY. The badge route really does land on Health, or steps 2-3 prove nothing.
    fireEvent.click(screen.getByText("open-health"))
    await waitFor(() => expect(selectedTabName()).toBe("Health"))

    // 2 · Navigate AWAY, and prove the page really UNMOUNTED. `ChatLayout`'s ternary is not a
    //     hidden div — if the tablist were merely hidden, step 3 would test nothing.
    fireEvent.click(screen.getByText("go-chat"))
    await waitFor(() => expect(screen.queryAllByRole("tab")).toHaveLength(0))
    expect(screen.getByTestId("not-the-library")).toBeInTheDocument()

    // 3 · …and BACK. ⛔ THE ASSERTION THE OLD WIRING FAILS: it re-seeded from a `libraryTab`
    //     that was still "health", so the Library opened on Health on this entry and forever.
    fireEvent.click(screen.getByText("go-library"))
    await waitFor(() => expect(selectedTabName()).toBe("Documents"))
    expect(screen.getByRole("tab", { name: "Health" })).toHaveAttribute("aria-selected", "false")

    // 4 · …and the door still WORKS a second time. A clear that also broke the hand-off would
    //     pass step 3 while un-shipping SURF-03's route entirely — this is the non-vacuity
    //     that separates "cleared" from "broken".
    //
    //     ⚠ IT LEAVES THE LIBRARY FIRST, AND THAT IS NOT INCIDENTAL. Clicking the popover
    //     while the Library is ALREADY open changes nothing on screen — `initialTab` is read
    //     by a lazy reducer initializer, so with no unmount there is no re-seed. That is a
    //     PRE-EXISTING limitation of SURF-03's route (measured at plan 15, unchanged by it:
    //     before this plan the same click did nothing visible either, and merely left a stale
    //     hand-off that ambushed the NEXT entry). Fixing it means giving the page a way to
    //     consume a hand-off after mount, which is a behaviour change this closure round is
    //     not entitled to make — recorded in `235-15-SUMMARY.md` instead of built here.
    fireEvent.click(screen.getByText("go-chat"))
    await waitFor(() => expect(screen.queryAllByRole("tab")).toHaveLength(0))
    fireEvent.click(screen.getByText("open-health"))
    await waitFor(() => expect(selectedTabName()).toBe("Health"))
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// THE APP-LEVEL WIRING — pinned as TEXT, because the rule existing is not the rule being USED
// ══════════════════════════════════════════════════════════════════════════════════════════
describe("App.tsx — the clearing rule is wired, not merely available", () => {
  const APP = appSource.replace(/\r\n/g, "\n")
  /** The LINE-ANCHORED comment stripper (`renameFence.test.ts:89`). ⚠ The `^\s*` is
   *  load-bearing: the unanchored variant eats live code and turns every absence arm green. */
  const APP_CODE = APP.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

  it("self-guard: the ?raw import is the real file AND the stripper did not eat it", () => {
    expect(APP.length).toBeGreaterThan(4000)
    expect(APP_CODE).toContain("handleOpenLibraryHealth")
    // The stripper non-vacuity pair: a token that exists ONLY in prose. A `codeOf` returning
    // "" would make every `not.toContain` below pass; this pair is what reds when it does.
    expect(APP).toContain("NO TWELFTH")
    expect(APP_CODE).not.toContain("NO TWELFTH")
  })

  it("imports and USES the clearing rule", () => {
    expect(APP_CODE).toContain("libraryTabAfterNavigate")
  })

  it("⛔ the ChatLayout mount no longer hands over the RAW view setter as its navigator", () => {
    expect(APP_CODE).not.toContain("onNavigate={setActiveView}")
  })

  it("has TWO real `setLibraryTab` calls — the write, and the clear", () => {
    const writes = APP_CODE.match(/setLibraryTab\s*\(/g) ?? []
    expect(writes.length).toBeGreaterThanOrEqual(2)
  })
})
