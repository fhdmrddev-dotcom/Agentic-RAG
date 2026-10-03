/**
 * Phase 271-04 (FIND-01 / FIND-02 / FIND-03 / D-01 / D-02 / D-03 / D-06 / T-271-14 / T-271-17)
 * — Find composed on the Library's Documents tab, driven through the real page.
 *
 * What this suite prices, each as a lived failure:
 *   - a resting Documents tab that costs a request (zero calls at rest);
 *   - a search error that swaps the result list for the UNFILTERED folder list (T-271-14);
 *   - Ask rendering anything list-shaped in the Library, or its text leaking into Find (D-02);
 *   - an older-version result that cannot be opened (the panel resolved only from `documents`);
 *   - the Views tab growing a mode switch or chips (one builder, D-114-1);
 *   - Save as view offered for a search a view cannot store (Pitfall 9).
 *
 * Mocks mirror `LibraryPage.filingRules271.test.tsx` (a PARTIAL `@/lib/api` mock and a separate
 * `@/lib/api/sources`). `@/lib/api/documents` is ALSO mocked partially: Find's hook imports
 * `searchDocuments` from that module directly, never through the barrel. `LibraryPage` is
 * imported STATICALLY (a dynamic import pays a cold transform inside the first case and times
 * out under load — the 271-02 finding). The detail panel is stubbed to the document it was
 * handed, which is the only fact these cases need from it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TooltipProvider } from "@/components/ui/tooltip"
import type { Document, DocumentSearchRow, Folder } from "@/types"

const {
  mockUseDocuments,
  mockUseFolders,
  mockSearchDocuments,
  mockListMetadataFields,
  mockListConnectorConnections,
  mockListWatches,
  mockGetSourceHealth,
  mockResolveAdHoc,
} = vi.hoisted(() => ({
  mockUseDocuments: vi.fn(),
  mockUseFolders: vi.fn(),
  mockSearchDocuments: vi.fn(),
  mockListMetadataFields: vi.fn(),
  mockListConnectorConnections: vi.fn(),
  mockListWatches: vi.fn(),
  mockGetSourceHealth: vi.fn(),
  mockResolveAdHoc: vi.fn(),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    listViews: vi.fn().mockResolvedValue([]),
    resolveView: vi.fn().mockResolvedValue({ documents: [], total: 0 }),
    resolveAdHoc: mockResolveAdHoc,
    resolveFilterCount: vi.fn().mockResolvedValue(0),
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

vi.mock("@/lib/api/documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/documents")>()
  return { ...actual, searchDocuments: mockSearchDocuments }
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

vi.mock("@/components/metadata/DocumentDetailPanel", () => ({
  DocumentDetailPanel: ({ doc }: { doc: Document }) => (
    <aside aria-label="Document details">{`panel:${doc.filename}`}</aside>
  ),
}))

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
import { DocumentSearchError } from "@/lib/api/documents"

// Radix Select (the sort control) needs the standard jsdom shims to open.
beforeEach(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

const FOLDERS: Folder[] = [
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

function doc(over: Partial<Document>): Document {
  return {
    id: "doc-1",
    user_id: "user-1",
    folder_id: null,
    filename: "browse-only.pdf",
    file_path: "/uploads/x.pdf",
    file_size: 1024,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 10,
    content_hash: "abc",
    metadata: { document_type: "Contract" },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  } as Document
}

// The browse list (Root): ONE document, whose name never appears in a Find answer — so its
// presence on screen is proof the unfiltered folder list is showing.
const DOCUMENTS: Document[] = [doc({ id: "doc-1", filename: "browse-only.pdf" })]

function hit(id: string, filename: string, over: Partial<DocumentSearchRow> = {}): DocumentSearchRow {
  return { ...doc({ id, filename }), version_count: 1, has_earlier: false, ...over } as DocumentSearchRow
}

// Server order is deliberately NOT alphabetical: the page must keep it.
const ANSWER = {
  documents: [hit("r-b", "Acme B.pdf"), hit("r-a", "Acme A.pdf")],
  total: 2,
  older_matches: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseDocuments.mockReturnValue({
    documents: DOCUMENTS,
    uploading: false,
    uploadingCount: 0,
    upload: vi.fn().mockResolvedValue({ isDuplicate: false }),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    loadDocuments: vi.fn().mockResolvedValue(undefined),
  })
  mockUseFolders.mockReturnValue({
    folders: FOLDERS,
    createFolder: vi.fn().mockResolvedValue({}),
    renameFolder: vi.fn().mockResolvedValue(undefined),
    deleteFolder: vi.fn().mockResolvedValue(undefined),
    toggleOrgShared: vi.fn().mockResolvedValue(undefined),
  })
  mockSearchDocuments.mockResolvedValue(ANSWER)
  mockResolveAdHoc.mockResolvedValue({ documents: [], total: 0 })
  mockListMetadataFields.mockResolvedValue([])
  mockListConnectorConnections.mockResolvedValue([])
  mockListWatches.mockResolvedValue([])
  mockGetSourceHealth.mockResolvedValue({ stopped: [], reader_running: true, poll_interval_seconds: 60 })
})

function renderPage(onAskInChat = vi.fn()) {
  render(
    <TooltipProvider>
      <LibraryPage onAskInChat={onAskInChat} />
    </TooltipProvider>,
  )
  return { onAskInChat }
}

const nameInput = () => screen.getByPlaceholderText("Filter by file name…")
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function search(text: string) {
  fireEvent.change(nameInput(), { target: { value: text } })
  await waitFor(() => expect(screen.getByText("Acme A.pdf")).toBeInTheDocument())
}

describe("LibraryPage — Find at rest costs nothing (D-01 / T-271-17)", () => {
  it("shows the mode switch, the name input, the Version chip and the shipped folder list — and makes ZERO search requests", async () => {
    renderPage()
    const group = screen.getByRole("radiogroup", { name: "Search mode" })
    expect(within(group).getByRole("radio", { name: "Find documents" })).toHaveAttribute("aria-checked", "true")
    expect(nameInput()).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Version: Latest" })).toBeInTheDocument()
    expect(screen.getByText("browse-only.pdf")).toBeInTheDocument()
    expect(screen.getByText(/Documents not assigned to a folder/)).toBeInTheDocument()
    await sleep(500)
    expect(mockSearchDocuments).not.toHaveBeenCalled()
  })
})

describe("LibraryPage — an active search (D-03)", () => {
  it("typing a name issues ONE debounced request with the exact body, hides the lead, and keeps the server's order", async () => {
    renderPage()
    fireEvent.change(nameInput(), { target: { value: "a" } })
    fireEvent.change(nameInput(), { target: { value: "ac" } })
    fireEvent.change(nameInput(), { target: { value: "acme" } })
    await waitFor(() => expect(screen.getByText("Acme A.pdf")).toBeInTheDocument())
    expect(mockSearchDocuments).toHaveBeenCalledTimes(1)
    expect(mockSearchDocuments.mock.calls[0][0]).toMatchObject({
      name: "acme",
      version: "latest",
      sort: "added_desc",
      offset: 0,
      limit: 25,
      folder: null,
      relationship: null,
    })
    expect(screen.queryByText(/Documents not assigned to a folder/)).toBeNull()
    expect(screen.queryByText("browse-only.pdf")).toBeNull()
    expect(screen.getByText("2 documents")).toBeInTheDocument()
    const order = screen.getAllByText(/^Acme [AB]\.pdf$/).map((el) => el.textContent)
    expect(order).toEqual(["Acme B.pdf", "Acme A.pdf"])
  })

  it("with a sidebar folder selected, the first search is scoped to it (subfolders on) and shows a removable Folder chip", async () => {
    renderPage()
    fireEvent.click(within(screen.getByTestId("library-sidebar")).getByText("Research"))
    await search("acme")
    await waitFor(() =>
      expect(mockSearchDocuments).toHaveBeenLastCalledWith(
        expect.objectContaining({ folder: { folder_id: "folder-1", include_subfolders: true } }),
      ),
    )
    expect(screen.getByRole("button", { name: "Folder /Research + subfolders" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove Folder condition" })).toBeInTheDocument()
  })

  it("changing Sorted by re-requests with the new sort, and the Date column header follows it", async () => {
    const user = userEvent.setup()
    renderPage()
    await search("acme")
    await user.click(screen.getByRole("combobox", { name: "Sort results" }))
    await user.click(await screen.findByRole("option", { name: "Created in the file (newest)" }))
    await waitFor(() =>
      expect(mockSearchDocuments).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: "source_created_desc" }),
      ),
    )
    expect(screen.getByRole("columnheader", { name: "Created in the file" })).toBeInTheDocument()
  })

  it("a 422 keeps the chips and the previous rows, shows the error — and never brings back the folder list (T-271-14)", async () => {
    renderPage()
    await search("acme")
    mockSearchDocuments.mockRejectedValueOnce(new DocumentSearchError(422, "bad"))
    fireEvent.change(nameInput(), { target: { value: "acmex" } })
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't run this search. Your filters are kept."))
    expect(screen.getByText("Acme A.pdf")).toBeInTheDocument()
    expect(screen.getByText("Acme B.pdf")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Version: Latest" })).toBeInTheDocument()
    expect((nameInput() as HTMLInputElement).value).toBe("acmex")
    expect(screen.queryByText("browse-only.pdf")).toBeNull()
  })

  it("Clear search resets the name, the chips, the version and the filter — and the shipped lead returns", async () => {
    renderPage()
    await search("acme")
    fireEvent.click(screen.getByRole("button", { name: "Version: Latest" }))
    fireEvent.click(screen.getByRole("radio", { name: "Has earlier versions" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(screen.getByRole("button", { name: "Version: Has earlier versions" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect((nameInput() as HTMLInputElement).value).toBe("")
    expect(screen.getByRole("button", { name: "Version: Latest" })).toBeInTheDocument()
    expect(screen.getByText(/Documents not assigned to a folder/)).toBeInTheDocument()
    expect(screen.getByText("browse-only.pdf")).toBeInTheDocument()
  })

  it("clicking a sidebar folder while a search is active ends the search and browses that folder", async () => {
    renderPage()
    await search("acme")
    fireEvent.click(within(screen.getByTestId("library-sidebar")).getByText("Research"))
    expect((nameInput() as HTMLInputElement).value).toBe("")
    expect(screen.queryByText("Acme A.pdf")).toBeNull()
    expect(screen.queryByText("Exact match on fields. No AI ranking.")).toBeNull()
    expect(screen.getByTestId("documents-doclist")).toBeInTheDocument()
  })

  it("a row click opens the detail panel for THAT row — including an older version not in `documents`", async () => {
    mockSearchDocuments.mockResolvedValue({
      documents: [hit("old-1", "Acme A.pdf", { is_latest: false, version_number: 1 }), hit("r-b", "Acme B.pdf")],
      total: 2,
      older_matches: 0,
    })
    renderPage()
    await search("acme")
    // The filename cell's button (the row also carries a Download control naming the file).
    fireEvent.click(screen.getByText("Acme A.pdf").closest("button")!)
    expect(await screen.findByLabelText("Document details")).toHaveTextContent("panel:Acme A.pdf")
  })
})

describe("LibraryPage — Ask leaves the Library (D-02)", () => {
  it("Ask hides the strip, meta line, lead and list; Enter hands the question to chat once; Find keeps its own text", async () => {
    const { onAskInChat } = renderPage()
    await search("acme")
    fireEvent.click(screen.getByRole("radio", { name: "Ask" }))
    expect(screen.queryByRole("button", { name: "Version: Latest" })).toBeNull()
    expect(screen.queryByText("Exact match on fields. No AI ranking.")).toBeNull()
    expect(screen.queryByText(/Documents not assigned to a folder/)).toBeNull()
    expect(screen.queryByText("Acme A.pdf")).toBeNull()
    expect(screen.queryByText("browse-only.pdf")).toBeNull()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.getByText("Ask is answered in chat")).toBeInTheDocument()

    const ask = screen.getByPlaceholderText("Ask a question about your documents") as HTMLInputElement
    expect(ask.value).toBe("")
    fireEvent.change(ask, { target: { value: "What changed?" } })
    fireEvent.keyDown(ask, { key: "Enter" })
    expect(onAskInChat).toHaveBeenCalledTimes(1)
    expect(onAskInChat).toHaveBeenCalledWith("What changed?")

    fireEvent.click(screen.getByRole("radio", { name: "Find documents" }))
    expect((nameInput() as HTMLInputElement).value).toBe("acme")
  })

  it("Open in chat calls the same handler", () => {
    const { onAskInChat } = renderPage()
    fireEvent.click(screen.getByRole("radio", { name: "Ask" }))
    fireEvent.change(screen.getByPlaceholderText("Ask a question about your documents"), {
      target: { value: "Who signed it?" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Open in chat/ }))
    expect(onAskInChat).toHaveBeenCalledWith("Who signed it?")
  })
})

describe("LibraryPage — Save as view and the Views tab (Pitfall 9 / D-114-1)", () => {
  it("a typed name replaces Save as view with the reason", async () => {
    renderPage()
    await search("acme")
    expect(screen.getByText("This search can't be saved as a view yet.")).toBeInTheDocument()
    expect(screen.queryByText("Save as view")).toBeNull()
  })

  it("with only a metadata condition the shipped Save as view stays", async () => {
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: "＋ Document type" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Contract" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    await waitFor(() =>
      expect(mockSearchDocuments).toHaveBeenLastCalledWith(
        expect.objectContaining({
          filter_expr: { op: "and", conditions: [{ field: "document_type", op: "eq", value: "Contract" }] },
        }),
      ),
    )
    expect(screen.getByText("Save as view")).toBeInTheDocument()
    expect(screen.queryByText("This search can't be saved as a view yet.")).toBeNull()
    // The Find path never runs the browse resolver (whose catch swaps in the folder list).
    expect(mockResolveAdHoc).not.toHaveBeenCalled()
  })

  it("the Views tab renders no mode switch and no quick-add chips", async () => {
    renderPage()
    fireEvent.click(screen.getByRole("tab", { name: /Views/ }))
    // Positive control: the Views body really mounted, so the absences below are about it.
    expect(await screen.findByTestId("views-tab")).toBeInTheDocument()
    expect(screen.queryByRole("radiogroup", { name: "Search mode" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Version: Latest" })).toBeNull()
    expect(screen.queryByRole("button", { name: "＋ Document type" })).toBeNull()
    expect(screen.queryByPlaceholderText("Filter by file name…")).toBeNull()
  })
})

// ── 271-REVIEW fixes, each driven RED against the shipped page before its fix landed. ──
describe("LibraryPage — 271 review fixes", () => {
  it("CR-01: a metadata condition set in Find is resolved when the Views tab opens — its list matches the chip, never the unfiltered folder list", async () => {
    mockResolveAdHoc.mockResolvedValue({
      documents: [doc({ id: "c-1", filename: "contract-hit.pdf" })],
      total: 1,
    })
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: "＋ Document type" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Contract" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    await waitFor(() => expect(mockSearchDocuments).toHaveBeenCalled())
    // The Find path itself still never runs the browse resolver.
    expect(mockResolveAdHoc).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("tab", { name: /Views/ }))
    expect(await screen.findByTestId("views-tab")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText("contract-hit.pdf")).toBeInTheDocument())
    expect(screen.queryByText("browse-only.pdf")).toBeNull()
    expect(mockResolveAdHoc).toHaveBeenCalledTimes(1)
    expect(mockResolveAdHoc).toHaveBeenCalledWith({
      op: "and",
      conditions: [{ field: "document_type", op: "eq", value: "Contract" }],
    })
  })

  it("CR-01: opening the Views tab with no filter change since the last resolve costs no request", async () => {
    renderPage()
    fireEvent.click(screen.getByRole("tab", { name: /Views/ }))
    expect(await screen.findByTestId("views-tab")).toBeInTheDocument()
    await sleep(50)
    expect(mockResolveAdHoc).not.toHaveBeenCalled()
  })

  it("CR-02: a failed delete from Find keeps the dialog open with its error and does not re-ask", async () => {
    const deleteDoc = vi.fn().mockRejectedValue(new Error("boom"))
    mockUseDocuments.mockReturnValue({ ...mockUseDocuments(), deleteDoc })
    renderPage()
    await search("acme")
    const callsBefore = mockSearchDocuments.mock.calls.length
    fireEvent.click(screen.getAllByRole("button", { name: "Delete document" })[0])
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }))
    await waitFor(() =>
      expect(within(dialog).getByText("Delete failed. Please try again.")).toBeInTheDocument(),
    )
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(deleteDoc).toHaveBeenCalledWith("r-b", undefined)
    await sleep(50)
    expect(mockSearchDocuments.mock.calls.length).toBe(callsBefore)
  })

  it("CR-02: a successful delete from Find closes the dialog only after the delete, then re-asks the server", async () => {
    let finish: () => void = () => {}
    const deleteDoc = vi.fn(() => new Promise<void>((r) => (finish = r)))
    mockUseDocuments.mockReturnValue({ ...mockUseDocuments(), deleteDoc })
    renderPage()
    await search("acme")
    const callsBefore = mockSearchDocuments.mock.calls.length
    fireEvent.click(screen.getAllByRole("button", { name: "Delete document" })[0])
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }))
    await sleep(20)
    // Still deleting: the dialog has not closed ahead of the request.
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    finish()
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await waitFor(() => expect(mockSearchDocuments.mock.calls.length).toBeGreaterThan(callsBefore))
  })
})
