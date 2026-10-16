/**
 * Phase 284-03 Task 2 (FIX-11 / D-07 / D-09 / D-11 / D-12 / SEED-248) — the Library says what it
 * KNOWS: loading, failed and empty are three different states, and every number is the server's.
 *
 * UI-SPEC §S1-§S4 and §S8, asserted by RENDERED WORDS (a presence assertion cannot see content
 * drift). The fake server (`fakeLibraryApi`) answers from one fixture; a case that needs a request
 * to stay in flight, or to fail, replaces ONE answer with a controllable deferred.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import type { Dispatch, SetStateAction } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CitationNavProvider, useCitationNav } from "@/lib/citationNav"
import type { Document, DocumentListResponse, Folder, LibrarySummary, SavedView } from "@/types"
import { installFakeLibraryApi, summarizeDocuments } from "@/test-utils/fakeLibraryApi"

const {
  mockUseDocuments,
  mockUseFolders,
  mockListViews,
  mockResolveView,
  mockResolveAdHoc,
  mockListMetadataFields,
  mockGetReembedProgress,
} = vi.hoisted(() => ({
  mockUseDocuments: vi.fn(),
  mockUseFolders: vi.fn(),
  mockListViews: vi.fn(),
  mockResolveView: vi.fn(),
  mockResolveAdHoc: vi.fn(),
  mockListMetadataFields: vi.fn(),
  mockGetReembedProgress: vi.fn(),
}))
const libraryApi = vi.hoisted(() => ({
  listDocumentsPage: vi.fn(),
  getLibrarySummary: vi.fn(),
  getDocument: vi.fn(),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    ...libraryApi,
    listViews: mockListViews,
    resolveView: mockResolveView,
    resolveAdHoc: mockResolveAdHoc,
    listMetadataFields: mockListMetadataFields,
    getReembedProgress: mockGetReembedProgress,
  }
})
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
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
    removeChannel: vi.fn(),
  },
}))

import { DocumentListError } from "@/lib/api/documents"

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

function doc(id: string, over: Partial<Document> = {}): Document {
  return {
    id,
    user_id: "user-1",
    folder_id: null,
    filename: `${id}.pdf`,
    file_path: `/uploads/${id}.pdf`,
    file_size: 100,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 1,
    content_hash: null,
    metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  } as Document
}

const DOCS = [
  doc("root-a", { filename: "alpha.pdf" }),
  doc("root-b", { filename: "bravo.pdf" }),
  doc("in-f", { folder_id: "folder-1", filename: "foldered.pdf" }),
  doc("off-page", { folder_id: "folder-1", filename: "elsewhere.pdf" }),
]

const VIEW: SavedView = {
  id: "view-1",
  user_id: "user-1",
  name: "Invoices",
  filter_expr: { op: "and", conditions: [{ field: "document_type", op: "eq", value: "Invoice" }] },
  is_system_global: false,
}

let wired: { setRows: Dispatch<SetStateAction<Document[]>>; onChange: () => void }

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function summaryWith(over: Partial<LibrarySummary>): LibrarySummary {
  return { ...summarizeDocuments([]), ...over }
}

function renderPage(extra?: React.ReactNode) {
  return render(
    <CitationNavProvider>
      <TooltipProvider>
        {extra}
        <LibraryPageUnderTest />
      </TooltipProvider>
    </CitationNavProvider>,
  )
}

let LibraryPageUnderTest: () => React.ReactElement
beforeAll(async () => {
  const { LibraryPage } = await import("@/pages/LibraryPage")
  LibraryPageUnderTest = () => <LibraryPage />
}, 30_000)

beforeEach(() => {
  vi.clearAllMocks()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  installFakeLibraryApi({ ...libraryApi, resolveView: mockResolveView, resolveAdHoc: mockResolveAdHoc }, DOCS)
  mockUseDocuments.mockImplementation((args: typeof wired) => {
    wired = args
    return {
      uploading: false,
      uploadingCount: 0,
      upload: vi.fn().mockResolvedValue({ isDuplicate: false }),
      deleteDoc: vi.fn().mockResolvedValue(undefined),
    }
  })
  mockUseFolders.mockReturnValue({
    folders: FOLDERS,
    createFolder: vi.fn(),
    renameFolder: vi.fn(),
    deleteFolder: vi.fn(),
    toggleOrgShared: vi.fn(),
  })
  mockListViews.mockResolvedValue([])
  mockListMetadataFields.mockResolvedValue([])
  mockGetReembedProgress.mockResolvedValue({
    status: "idle", total: 0, re_embedded: 0, remaining: 0, model: "m", updated_at: null,
  })
})

const doclist = () => screen.getByTestId("documents-doclist")

describe("S1 — the documents list: loading, failed and empty are three states", () => {
  it("before the page answers: the cold skeleton and NOTHING that claims an answer", async () => {
    const gate = deferred<DocumentListResponse>()
    libraryApi.listDocumentsPage.mockReturnValueOnce(gate.promise)
    renderPage()
    const status = within(doclist()).getByRole("status")
    expect(status).toHaveTextContent("Loading documents")
    expect(status.querySelectorAll(".animate-pulse")).toHaveLength(6)
    expect(screen.queryByText("No root documents yet.")).toBeNull()
    expect(screen.queryByText("No documents in this folder")).toBeNull()
    expect(screen.queryByText("Upload files above to add them here.")).toBeNull()
    expect(screen.queryByTestId("documents-tfoot")).toBeNull()
    await act(async () => gate.resolve({ documents: [DOCS[0]], total: 1, offset: 0, limit: 25 }))
    expect(await screen.findByText("alpha.pdf")).toBeInTheDocument()
    expect(within(doclist()).queryByText("Loading documents")).toBeNull()
  })

  it("the empty sentence renders only AFTER a successful answer with total 0", async () => {
    libraryApi.listDocumentsPage.mockResolvedValueOnce({ documents: [], total: 0, offset: 0, limit: 25 })
    renderPage()
    expect(await screen.findByText("No root documents yet.")).toBeInTheDocument()
    expect(within(doclist()).queryByRole("status")).toBeNull()
  })

  it("a failed cold load says it is a loading error — never the empty folder — and Try again re-asks", async () => {
    libraryApi.listDocumentsPage.mockRejectedValueOnce(new DocumentListError(500, "x"))
    renderPage()
    const alert = await within(doclist()).findByRole("alert")
    expect(alert).toHaveTextContent("Couldn’t load documents. This is a loading error, not an empty folder.")
    expect(screen.queryByText("No root documents yet.")).toBeNull()
    expect(screen.queryByTestId("documents-tfoot")).toBeNull()
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("alpha.pdf")).toBeInTheDocument()
    expect(libraryApi.listDocumentsPage).toHaveBeenCalledTimes(2)
    expect(within(doclist()).queryByRole("alert")).toBeNull()
  })

  it("a saved view that fails cold says 'not an empty view'", async () => {
    mockListViews.mockResolvedValue([VIEW])
    mockResolveView.mockRejectedValue(new Error("Failed to resolve view"))
    renderPage()
    const sidebar = await screen.findByTestId("library-sidebar")
    fireEvent.click(await within(sidebar).findByRole("button", { name: "Invoices" }))
    const alert = await within(doclist()).findByRole("alert")
    expect(alert).toHaveTextContent("Couldn’t load documents. This is a loading error, not an empty view.")
  })

  it("a page change is WARM — the rows stay, the wrapper is aria-busy until the answer lands", async () => {
    const thirty = Array.from({ length: 30 }, (_, i) => doc(`d${String(i).padStart(2, "0")}`))
    installFakeLibraryApi(libraryApi, thirty)
    renderPage()
    await screen.findByText("d29.pdf")
    const gate = deferred<DocumentListResponse>()
    libraryApi.listDocumentsPage.mockReturnValueOnce(gate.promise)
    fireEvent.click(within(screen.getByTestId("documents-tfoot")).getByRole("button", { name: /Next/ }))
    expect(doclist()).toHaveAttribute("aria-busy", "true")
    expect(screen.getByText("d29.pdf")).toBeInTheDocument()
    await act(async () => gate.resolve({ documents: [thirty[0]], total: 30, offset: 25, limit: 25 }))
    expect(await screen.findByText("d00.pdf")).toBeInTheDocument()
    expect(doclist()).not.toHaveAttribute("aria-busy")
  })

  it("a failed reload KEEPS the rows and says they may be out of date", async () => {
    const thirty = Array.from({ length: 30 }, (_, i) => doc(`d${String(i).padStart(2, "0")}`))
    installFakeLibraryApi(libraryApi, thirty)
    renderPage()
    await screen.findByText("d29.pdf")
    libraryApi.listDocumentsPage.mockRejectedValueOnce(new DocumentListError(null, "x"))
    fireEvent.click(within(screen.getByTestId("documents-tfoot")).getByRole("button", { name: /Next/ }))
    const alert = await screen.findByText("Couldn’t refresh this list. The rows shown may be out of date.")
    expect(alert.closest("[role='alert']")).not.toBeNull()
    expect(screen.getByText("d29.pdf")).toBeInTheDocument()
    expect(screen.queryByText(/not an empty folder/)).toBeNull()
  })

  it("a Realtime-triggered refetch is SILENT — no aria-busy, no skeleton, rows stay", async () => {
    renderPage()
    await screen.findByText("alpha.pdf")
    const gate = deferred<DocumentListResponse>()
    libraryApi.listDocumentsPage.mockReturnValueOnce(gate.promise)
    act(() => wired.onChange())
    await waitFor(() => expect(libraryApi.listDocumentsPage).toHaveBeenCalledTimes(2), { timeout: 2000 })
    expect(doclist()).not.toHaveAttribute("aria-busy")
    expect(within(doclist()).queryByRole("status")).toBeNull()
    expect(screen.getByText("alpha.pdf")).toBeInTheDocument()
    await act(async () => gate.resolve({ documents: [DOCS[1]], total: 1, offset: 0, limit: 25 }))
    expect(await screen.findByText("bravo.pdf")).toBeInTheDocument()
  })
})

describe("S2 — the pager is exact", () => {
  it("a 10,000-document Root reads '1–25 of 10,000' — no '+', no 'may be larger' line", async () => {
    const page = Array.from({ length: 25 }, (_, i) => doc(`p${i}`))
    libraryApi.listDocumentsPage.mockResolvedValue({ documents: page, total: 10_000, offset: 0, limit: 25 })
    renderPage()
    const tfoot = await screen.findByTestId("documents-tfoot")
    expect(tfoot).toHaveTextContent("1–25 of 10,000")
    expect(tfoot.textContent).not.toContain("+")
    expect(screen.queryByText(/The list may be larger than shown/)).toBeNull()
  })
})

describe("S3 — the header pill", () => {
  it("'Counting…' while the summary loads, then the server's total, grouped", async () => {
    const gate = deferred<LibrarySummary>()
    libraryApi.getLibrarySummary.mockReturnValueOnce(gate.promise)
    renderPage()
    const pill = screen.getByTestId("library-queue-pill")
    expect(pill).toHaveTextContent("Counting…")
    expect(pill.textContent).not.toMatch(/\d/)
    await act(async () => gate.resolve(summaryWith({ total: 10_000 })))
    await waitFor(() => expect(pill).toHaveTextContent("10,000 documents"))
  })

  it("'Count not known yet' when the summary fails — never '0 documents'", async () => {
    libraryApi.getLibrarySummary.mockRejectedValueOnce(new DocumentListError(500, "x"))
    renderPage()
    const pill = screen.getByTestId("library-queue-pill")
    await waitFor(() => expect(pill).toHaveTextContent("Count not known yet"))
    expect(pill.textContent).not.toContain("0 documents")
  })

  it("'Reading N files' counts the summary's pending + processing (R-04)", async () => {
    libraryApi.getLibrarySummary.mockResolvedValueOnce(
      summaryWith({ total: 9, status: { pending: 2, processing: 3, paused: 0, completed: 4, failed: 0 } }),
    )
    renderPage()
    await waitFor(() => expect(screen.getByTestId("library-queue-pill")).toHaveTextContent("Reading 5 files"))
  })
})

describe("S4 — Root and folder counts are the summary's, omitted until it answers", () => {
  it("no count (and never a 0) while loading; the summary's numbers when ready", async () => {
    const gate = deferred<LibrarySummary>()
    libraryApi.getLibrarySummary.mockReturnValueOnce(gate.promise)
    renderPage()
    const sidebar = screen.getByTestId("library-sidebar")
    const root = within(sidebar).getByRole("button", { name: /^Root/ })
    const research = within(sidebar).getByRole("button", { name: /^Research/ })
    expect(root.textContent).not.toMatch(/\d/)
    expect(research.textContent).not.toMatch(/\d/)
    await act(async () => gate.resolve(summarizeDocuments(DOCS)))
    await waitFor(() => expect(root.textContent).toContain("2"))
    expect(research.textContent).toContain("2")
  })
})

describe("S8 — opening a document that is on neither the page nor Find's rows", () => {
  function Opener() {
    const nav = useCitationNav()
    return (
      <button type="button" onClick={() => nav.openDocument("off-page")}>
        open-off-page
      </button>
    )
  }

  it("reads it ONCE by id and opens the panel", async () => {
    renderPage(<Opener />)
    await screen.findByText("alpha.pdf")
    fireEvent.click(screen.getByText("open-off-page"))
    expect(await screen.findByLabelText("Document details")).toHaveTextContent("panel:elsewhere.pdf")
    expect(libraryApi.getDocument).toHaveBeenCalledTimes(1)
    expect(libraryApi.getDocument).toHaveBeenCalledWith("off-page")
  })

  it("a 404 leaves the panel closed, with no copy", async () => {
    libraryApi.getDocument.mockRejectedValueOnce(new DocumentListError(404, "x"))
    renderPage(<Opener />)
    await screen.findByText("alpha.pdf")
    fireEvent.click(screen.getByText("open-off-page"))
    await waitFor(() => expect(libraryApi.getDocument).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(screen.queryByLabelText("Document details")).toBeNull()
    expect(screen.queryByText("Couldn’t open that document.")).toBeNull()
  })

  it("any other failure says so above the list, and Try again opens it", async () => {
    libraryApi.getDocument.mockRejectedValueOnce(new DocumentListError(500, "x"))
    renderPage(<Opener />)
    await screen.findByText("alpha.pdf")
    fireEvent.click(screen.getByText("open-off-page"))
    const line = await screen.findByText("Couldn’t open that document.")
    const alert = line.closest("[role='alert']") as HTMLElement
    expect(alert).not.toBeNull()
    expect(screen.queryByLabelText("Document details")).toBeNull()
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(await screen.findByLabelText("Document details")).toHaveTextContent("panel:elsewhere.pdf")
  })
})
