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
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

import { TooltipProvider } from "@/components/ui/tooltip"
import type { Document, Folder } from "@/types"

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
    expect(await screen.findByTestId("health-coverage-ring")).toBeInTheDocument()
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
