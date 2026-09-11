/**
 * Phase 244 plan 06 Task 2 (SHELL-04 / D-244-06 / D-244-07 / BUG-260905-01) —
 * THE LIBRARY GETS THE DOOR, AND THE DOOR ASKS WHERE THE FILE GOES.
 *
 * ── THE OPERATOR'S COMPLAINT, VERBATIM ────────────────────────────────────────────────
 *
 * *"The door is not where intended — the import should be from the Library, not from the chat."*
 * and *"it ingested into a folder I did not want — the root."*
 *
 * ⛔ **A SILENT REFUSAL IS THE SAME FAILURE WEARING A DIFFERENT HAT.** D-244-06's ruling is that
 * silently rooting is the defect; a control that greys out with no words replaces one thing the
 * person cannot act on with another. Case 2 therefore asserts a RENDERED REASON, not a
 * `disabled` attribute.
 *
 * ⛔ **NO SECOND PERMISSION RULE.** `canUploadToFolder` is the page's shipped predicate
 * (`LibraryPage.tsx:379` — `!selectedFolderId || !selectedFolder || selectedFolder.user_id ===
 * user?.id`). The door READS it. A second expression would drift from the upload button's on the
 * first edit, and the two doors write to the same place.
 *
 * ⛔ **AND THE CONFIRM WORD IS THE LIBRARY'S.** `Attach` is the composer's word for a file that
 * lives in one conversation for 24 hours; `Import` is this door's word for a permanent KB write
 * (D-244-23, read in the direction the composer's fence reads it backwards).
 *
 * Mocks: the harness is `LibraryPage.tabAttention.test.tsx`'s, for its own recorded reason — a
 * full replacement of the `@/lib/api` barrel throws at MOUNT about the export it forgot rather
 * than about the edit under test (the 196-08 nine-suite, 249-case failure mode).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TooltipProvider } from "@/components/ui/tooltip"
import type { Document, Folder } from "@/types"
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
  mockListCloudFiles,
  mockImportCloudFile,
  mockListWatches,
  mockGetSourceHealth,
  mockUseAuth,
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
  mockListCloudFiles: vi.fn(),
  mockImportCloudFile: vi.fn(),
  mockListWatches: vi.fn(),
  mockGetSourceHealth: vi.fn(),
  mockUseAuth: vi.fn(),
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
    listCloudFiles: mockListCloudFiles,
    importCloudFile: mockImportCloudFile,
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
vi.mock("@/hooks/useAuth", () => ({ useAuth: mockUseAuth }))

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
import { LIBRARY_CLOUD_COPY } from "@/components/library/LibraryCloudImport"

const OWNER = "user-1"
const STRANGER = "user-9"

const ownFolder: Folder = {
  id: "folder-1",
  user_id: OWNER,
  name: "Research",
  parent_id: null,
  is_org_shared: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

const sampleDocuments: Document[] = [
  {
    id: "doc-1",
    user_id: OWNER,
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

const CLOUD_CONN = {
  id: "conn-cloud",
  org_id: "org-1",
  name: "Meridian Supply",
  service_id: "google_workspace",
  capability: null,
  is_enabled: true,
  config: {},
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
}

const CLOUD_FILES = [
  { id: "cf-1", name: "Rate-sheet-Q4.xlsx", size: 44_032, modified_at: "2026-09-01T00:00:00Z" },
  { id: "cf-2", name: "Terms.pdf", size: 91_000, modified_at: "2026-09-02T00:00:00Z" },
]

function renderPage(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

/** Select the Library folder the door takes its destination from. */
async function selectResearchFolder(user: ReturnType<typeof userEvent.setup>) {
  const rows = await screen.findAllByText("Research")
  await user.click(rows[0])
}

function setFolders(folders: Folder[]) {
  mockUseFolders.mockReturnValue({
    folders,
    createFolder: vi.fn().mockResolvedValue({}),
    renameFolder: vi.fn().mockResolvedValue(undefined),
    deleteFolder: vi.fn().mockResolvedValue(undefined),
    toggleOrgShared: vi.fn().mockResolvedValue(undefined),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  mockUseAuth.mockReturnValue({ user: { id: OWNER } })
  mockUseDocuments.mockReturnValue({
    documents: sampleDocuments,
    uploading: false,
    uploadingCount: 0,
    upload: vi.fn().mockResolvedValue({ isDuplicate: false }),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    loadDocuments: vi.fn().mockResolvedValue(undefined),
  })
  setFolders([ownFolder])
  mockListViews.mockResolvedValue([])
  mockListMetadataFields.mockResolvedValue([])
  mockResolveView.mockResolvedValue({ documents: [], total: 0 })
  mockResolveAdHoc.mockResolvedValue({ documents: [], total: 0 })
  mockGetReembedProgress.mockResolvedValue({
    status: "idle", total: 0, re_embedded: 0, remaining: 0,
    model: "text-embedding-3-small", updated_at: null,
  })
  mockGetIndexSummary.mockResolvedValue({
    vectors: 0, chunks_total: 0, documents_without_vectors: 0, last_indexed: null,
    model: "text-embedding-3-small", dimensions: 1536, provider: "openai", folders: [],
  })
  mockGetHealthOverview.mockResolvedValue({
    total_documents: 1, retrieved_this_month: 1, never_retrieved_count: 0,
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
  mockListConnectorConnections.mockResolvedValue([CLOUD_CONN])
  mockListCloudFiles.mockResolvedValue({ files: CLOUD_FILES })
  mockImportCloudFile.mockResolvedValue({
    id: "doc-new", filename: "Rate-sheet-Q4.xlsx", mime_type: "x", file_size: 1, status: "processing",
  })
  mockListWatches.mockResolvedValue([])
  mockGetSourceHealth.mockResolvedValue({ stopped: [], reader_running: true, poll_interval_seconds: 60 })
})

// ══ NON-VACUITY ═══════════════════════════════════════════════════════════════════════
// Every negative below is vacuously green on a page that rendered no door at all.
describe("the Library's cloud door — the harness", () => {
  it("the door is MOUNTED beside the Library's existing upload control", async () => {
    renderPage(<LibraryPage />)
    expect(await screen.findByTestId("library-cloud-import")).toBeInTheDocument()
  })
})

describe("the Library's cloud door — where the file goes", () => {
  // ── 1 · the destination is the page's OWN selection ──────────────────────────────────
  it("1 — with a folder selected, the door posts THAT folder_id", async () => {
    const user = userEvent.setup()
    renderPage(<LibraryPage />)
    await screen.findByTestId("library-cloud-import")
    await selectResearchFolder(user)

    await user.click(screen.getByTestId("library-cloud-import-btn"))
    const modal = await screen.findByTestId("cloud-file-picker")
    await within(modal).findByText(CLOUD_FILES[0].name)
    await user.click(within(modal).getByText(CLOUD_FILES[0].name))
    await user.click(within(modal).getByTestId("cloud-confirm"))

    await waitFor(() =>
      expect(mockImportCloudFile).toHaveBeenCalledWith("conn-cloud", "cf-1", {
        folder_id: "folder-1",
      }),
    )
  })

  // ── 2 · no destination ⇒ a REASON, never a silent post ───────────────────────────────
  it("2 — with NO folder selected, the door SAYS a destination is needed and posts nothing", async () => {
    const user = userEvent.setup()
    renderPage(<LibraryPage />)
    const door = await screen.findByTestId("library-cloud-import")

    // ⛔ THE RENDERED REASON, not the `disabled` attribute. A silently greyed control replaces
    // one thing the person cannot act on with another.
    expect(within(door).getByTestId("library-cloud-import-reason").textContent).toBe(
      LIBRARY_CLOUD_COPY.needsDestination,
    )
    await user.click(screen.getByTestId("library-cloud-import-btn"))
    expect(screen.queryByTestId("cloud-file-picker")).toBeNull()
    expect(mockImportCloudFile).not.toHaveBeenCalled()
  })

  // ── 3 · the SHIPPED permission predicate, not a second one ───────────────────────────
  it("3 — a folder owned by someone else disables the door, with the reason rendered", async () => {
    setFolders([{ ...ownFolder, user_id: STRANGER }])
    const user = userEvent.setup()
    renderPage(<LibraryPage />)
    const door = await screen.findByTestId("library-cloud-import")
    await selectResearchFolder(user)

    await waitFor(() =>
      expect(within(door).getByTestId("library-cloud-import-reason").textContent).toBe(
        LIBRARY_CLOUD_COPY.notYourFolder,
      ),
    )
    await user.click(screen.getByTestId("library-cloud-import-btn"))
    expect(mockImportCloudFile).not.toHaveBeenCalled()
  })

  // ── 4 · the SERVER's sentence, verbatim (S-4) ────────────────────────────────────────
  it("4 — a 422 renders the server's own sentence, not a paraphrase", async () => {
    const SERVER_422 = "Choose a folder before importing — this import has no destination."
    mockImportCloudFile.mockRejectedValue(new Error(SERVER_422))
    const user = userEvent.setup()
    renderPage(<LibraryPage />)
    await screen.findByTestId("library-cloud-import")
    await selectResearchFolder(user)

    await user.click(screen.getByTestId("library-cloud-import-btn"))
    const modal = await screen.findByTestId("cloud-file-picker")
    await within(modal).findByText(CLOUD_FILES[0].name)
    await user.click(within(modal).getByText(CLOUD_FILES[0].name))
    await user.click(within(modal).getByTestId("cloud-confirm"))

    const alert = await screen.findByTestId("library-cloud-import-refusal")
    expect(alert.getAttribute("role")).toBe("alert")
    expect(alert.textContent).toContain(SERVER_422)
  })

  // ── 5 · the Library's word, and NOT the composer's ───────────────────────────────────
  it("5 — the confirm reads the Library's word; `Attach` belongs to the chat", async () => {
    const user = userEvent.setup()
    renderPage(<LibraryPage />)
    await screen.findByTestId("library-cloud-import")
    await selectResearchFolder(user)

    await user.click(screen.getByTestId("library-cloud-import-btn"))
    const modal = await screen.findByTestId("cloud-file-picker")
    const confirm = within(modal).getByTestId("cloud-confirm")
    expect(confirm.textContent).toBe(LIBRARY_CLOUD_COPY.confirm)
    // ⛔ D-244-23 read in the mirror: two consequences must not share one word.
    expect(confirm.textContent).not.toBe("Attach")
    expect(modal.textContent).not.toContain("Attach")
  })
})

// ══ SOURCE FENCES ═════════════════════════════════════════════════════════════════════
describe("the Library's cloud door — what the page must NOT grow", () => {
  it("no wire-shape literal is inlined on the page", () => {
    // ⛔ The request type lives in `lib/api/connectors.ts` beside `SourcePreviewRequest`. The
    // ledger records THREE wire-type drifts in `lib/api/org.ts` alone, all from inline shapes.
    //
    // ⚠ MEASURED, AND THE PLAN'S OWN CRITERION WAS UNSATISFIABLE AS WRITTEN. `244-06-PLAN.md`
    // asks that `grep -rn 'folder_id' LibraryPage.tsx` show no inline wire shape — but
    // `folder_id` is a `Document` FIELD, read **five** times on this page at base
    // (`d.folder_id === selectedFolderId`, the null counts, the per-folder tally). A bare
    // `not.toContain` therefore could not pass on an untouched tree.
    //
    // The property MEANT is: no request-body OBJECT LITERAL is typed here. A body key is
    // `folder_id:`; a field read is `.folder_id`. The fence measures the first.
    expect(pageSource).toContain("LibraryCloudImport") // non-vacuity
    expect(pageSource).not.toMatch(/\bfolder_id\s*:/)
    // ⚠ SEVEN reads, not five — the first count here was taken from `grep -n`, which prints
    // five LINES, and one of them (`counts[d.folder_id] = (counts[d.folder_id] ?? 0) + 1`)
    // carries three occurrences. ⛔ A LINE count is not an OCCURRENCE count, and the fence
    // needs the second. Pinned so an EIGHTH is a diff a reviewer sees.
    expect(pageSource.match(/\.folder_id\b/g)?.length).toBe(7)
  })

  it("the door reads the SHIPPED permission predicate, and no second one is introduced", () => {
    const occurrences = pageSource.split("canUploadToFolder").length - 1
    // One declaration + three consumers (DocumentUpload, IngestionTab, the new door).
    expect(occurrences).toBe(4)
    // ⛔ Exactly ONE expression computes it.
    expect(pageSource.split("const canUploadToFolder =").length - 1).toBe(1)
  })
})
