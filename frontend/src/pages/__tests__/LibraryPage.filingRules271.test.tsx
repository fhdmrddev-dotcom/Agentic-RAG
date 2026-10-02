/**
 * Phase 271 plan 02 (FIND-06 / D-08 / D-09 / P-07) — Filing rules opens INSIDE the Library.
 *
 * The rules surface used to be its own rail home (`ActiveView`, retired in this plan). It now
 * opens from a link in the Library header, as Library-local state: not a sixth tab, not a
 * `librarySelection` action, not an app view. The lived-experience failure this suite prices
 * (G-4 scenario 3): start on Ingestion, open Filing rules, press back — and land on DOCUMENTS
 * instead of Ingestion. Back needs no stored origin because the tab never changed underneath.
 *
 * Mocks mirror `LibraryPage.initialTab.test.tsx` (a PARTIAL `@/lib/api` mock via
 * `importOriginal`, plus `@/lib/api/sources` separately) so a missing export fails at the edit,
 * not at mount. `LibraryPage` is imported STATICALLY: the dynamic import in the sibling suite
 * pays a cold transform inside its first case and times out under load.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

import { TooltipProvider } from "@/components/ui/tooltip"
import type { ClassificationRule, Document, Folder } from "@/types"

const {
  mockUseDocuments,
  mockUseFolders,
  mockListRules,
  mockListFolders,
  mockListMetadataFields,
  mockListConnectorConnections,
  mockListWatches,
  mockGetSourceHealth,
} = vi.hoisted(() => ({
  mockUseDocuments: vi.fn(),
  mockUseFolders: vi.fn(),
  mockListRules: vi.fn(),
  mockListFolders: vi.fn(),
  mockListMetadataFields: vi.fn(),
  mockListConnectorConnections: vi.fn(),
  mockListWatches: vi.fn(),
  mockGetSourceHealth: vi.fn(),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    listRules: mockListRules,
    listFolders: mockListFolders,
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
    listViews: vi.fn().mockResolvedValue([]),
    resolveView: vi.fn().mockResolvedValue({ documents: [], total: 0 }),
    resolveAdHoc: vi.fn().mockResolvedValue({ documents: [], total: 0 }),
    listMetadataFields: mockListMetadataFields,
    getReembedProgress: vi.fn().mockResolvedValue({
      status: "idle",
      total: 0,
      re_embedded: 0,
      remaining: 0,
      model: "text-embedding-3-small",
      updated_at: null,
    }),
    getIndexSummary: vi.fn().mockResolvedValue({
      vectors: 0,
      chunks_total: 0,
      documents_without_vectors: 0,
      last_indexed: null,
      model: "text-embedding-3-small",
      dimensions: 1536,
      provider: "openai",
      folders: [],
    }),
    getHealthOverview: vi.fn().mockResolvedValue({
      total_documents: 1,
      retrieved_this_month: 1,
      never_retrieved_count: 0,
      high_confidence_rate: 0.9,
    }),
    getRetrievalTrend: vi.fn().mockResolvedValue([]),
    getNeverRetrieved: vi.fn().mockResolvedValue([]),
    getLowConfidenceQueries: vi.fn().mockResolvedValue([]),
    getStaleDocs: vi.fn().mockResolvedValue([]),
    getGovBroken: vi.fn().mockResolvedValue([]),
    getGovUnclassified: vi.fn().mockResolvedValue([]),
    getGovLowConfidence: vi.fn().mockResolvedValue([]),
    listCheckedQueries: vi.fn().mockResolvedValue([]),
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

const existingRule: ClassificationRule = {
  id: "rule-1",
  user_id: "user-1",
  name: "Acme Invoices",
  rule_scope: "classification",
  match_expr: { op: "and", conditions: [{ field: "document_type", op: "eq", value: "invoice" }] },
  suggest_folder_id: "folder-1",
  is_system_global: false,
  enabled: true,
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
  mockListRules.mockResolvedValue([existingRule])
  mockListFolders.mockResolvedValue(sampleFolders)
  mockListMetadataFields.mockResolvedValue([])
  mockListConnectorConnections.mockResolvedValue([])
  mockListWatches.mockResolvedValue([])
  mockGetSourceHealth.mockResolvedValue({
    stopped: [],
    reader_running: true,
    poll_interval_seconds: 60,
  })
})

function renderPage() {
  return render(
    <TooltipProvider>
      <LibraryPage />
    </TooltipProvider>,
  )
}

describe("LibraryPage — Filing rules is a Library sub-view (Phase 271, D-09)", () => {
  it(
    "opens from the header on Ingestion, keeps every rule, and Back returns to INGESTION",
    async () => {
      renderPage()

      // Start where G-4 scenario 3 starts: the Ingestion tab, not the default.
      fireEvent.click(screen.getByRole("tab", { name: "Ingestion" }))
      expect(screen.getByRole("tab", { name: "Ingestion" })).toHaveAttribute("aria-selected", "true")

      fireEvent.click(screen.getByRole("button", { name: "Filing rules" }))

      // The sub-view: its own title, and the Library tablist is out of the way.
      expect(
        await screen.findByRole("heading", { level: 1, name: "Filing rules" }),
      ).toBeInTheDocument()
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
      // Every existing rule still loads, through the unchanged listRules path (FIND-06).
      expect(await screen.findByText("Acme Invoices")).toBeInTheDocument()
      expect(mockListRules).toHaveBeenCalled()

      // Back.
      fireEvent.click(screen.getByRole("button", { name: "Library" }))

      await waitFor(() =>
        expect(
          screen.queryByRole("heading", { level: 1, name: "Filing rules" }),
        ).not.toBeInTheDocument(),
      )
      // ⛔ The tab the person came from — NOT Documents.
      expect(screen.getByRole("tab", { name: "Ingestion" })).toHaveAttribute("aria-selected", "true")
      expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute("aria-selected", "false")
    },
    30_000,
  )

  it(
    "the link is on every tab and is never one of them",
    async () => {
      renderPage()
      for (const name of ["Documents", "Views", "Ingestion", "Indexing", "Health"]) {
        fireEvent.click(screen.getByRole("tab", { name }))
        expect(screen.getByRole("button", { name: "Filing rules" })).toBeInTheDocument()
        expect(screen.getAllByRole("tab")).toHaveLength(5)
      }
    },
    30_000,
  )
})
