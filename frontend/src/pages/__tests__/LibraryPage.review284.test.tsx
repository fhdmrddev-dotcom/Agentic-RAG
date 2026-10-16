/**
 * 284-REVIEW CR-01 (frontend half) and IN-07 — the browse pager can never strand the person on a
 * page that does not exist, and never describes a page whose rows are not on screen.
 *
 * CR-01: a past-the-end page used to be a 500 on the server (fixed there: an empty page with the
 * exact total). The page must still get OFF that impossible page, or "Try again" re-asks it
 * forever:
 *   · turning Include archived off resets to page 1 (the set it pages over changed);
 *   · a list that shrank under an open page (a Realtime hint) clamps to the last real page.
 * IN-07: a failed page change keeps the previous rows; the pager describes THOSE rows, not the
 * page that failed — and Next re-asks the failed page.
 *
 * The fake server (`fakeLibraryApi`) answers like the fixed server: past the end is
 * `{documents: [], total}`. Asserted by RENDERED WORDS.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import type { Dispatch, SetStateAction } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CitationNavProvider } from "@/lib/citationNav"
import type { Document, Folder } from "@/types"
import { installFakeLibraryApi } from "@/test-utils/fakeLibraryApi"

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

const FOLDERS: Folder[] = []

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

/** `n` Root documents d00..d(n-1); the server orders them by id descending (equal timestamps). */
function many(n: number, archived: (i: number) => boolean = () => false): Document[] {
  return Array.from({ length: n }, (_, i) =>
    doc(`d${String(i).padStart(2, "0")}`, archived(i) ? { archived_at: "2026-02-01T00:00:00Z" } : {}),
  )
}

let wired: { setRows: Dispatch<SetStateAction<Document[]>>; onChange: () => void }

let LibraryPageUnderTest: () => React.ReactElement
beforeAll(async () => {
  const { LibraryPage } = await import("@/pages/LibraryPage")
  LibraryPageUnderTest = () => <LibraryPage />
}, 30_000)

function renderPage() {
  return render(
    <CitationNavProvider>
      <TooltipProvider>
        <LibraryPageUnderTest />
      </TooltipProvider>
    </CitationNavProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
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

const tfoot = () => screen.getByTestId("documents-tfoot")
const next = () => fireEvent.click(within(tfoot()).getByRole("button", { name: /Next/ }))
const archivedToggle = () =>
  fireEvent.click(within(screen.getByTestId("archived-hidden-line")).getByRole("button"))

describe("CR-01 — the browse list never sits on a page past the end", () => {
  it("turning Include archived OFF on a deep page goes back to page 1 of the smaller set", async () => {
    // 60 Root documents, the 20 newest-by-id archived: 40 when archived are hidden, 60 when shown.
    installFakeLibraryApi({ ...libraryApi }, many(60, (i) => i >= 40))
    renderPage()
    await waitFor(() => expect(tfoot()).toHaveTextContent("1–25 of 40"))
    archivedToggle() // show archived → 60
    await waitFor(() => expect(tfoot()).toHaveTextContent("1–25 of 60"))
    next()
    await waitFor(() => expect(tfoot()).toHaveTextContent("26–50 of 60"))
    next()
    await waitFor(() => expect(tfoot()).toHaveTextContent("51–60 of 60"))
    archivedToggle() // hide archived → 40: page 3 no longer exists
    await waitFor(() => expect(tfoot()).toHaveTextContent("1–25 of 40"))
    expect(screen.getByText("d39.pdf")).toBeInTheDocument()
    expect(screen.queryByText("No root documents yet.")).toBeNull()
    const last = libraryApi.listDocumentsPage.mock.calls.at(-1)?.[0]
    expect(last).toMatchObject({ offset: 0, include_archived: false })
  })

  it("a list that shrank under an open page (a Realtime hint) lands on the last real page", async () => {
    const docs = many(52)
    installFakeLibraryApi({ ...libraryApi }, docs)
    renderPage()
    await waitFor(() => expect(tfoot()).toHaveTextContent("1–25 of 52"))
    next()
    await waitFor(() => expect(tfoot()).toHaveTextContent("26–50 of 52"))
    next()
    await waitFor(() => expect(tfoot()).toHaveTextContent("51–52 of 52"))
    // Another tab deletes the three oldest: 49 remain, so offset 50 is past the end.
    docs.splice(0, 3)
    act(() => wired.onChange())
    await waitFor(() => expect(tfoot()).toHaveTextContent("26–49 of 49"), { timeout: 2000 })
    // d51 … d03 remain, newest id first: page 2 is d26 … d03.
    expect(await screen.findByText("d26.pdf")).toBeInTheDocument()
    expect(screen.getByText("d03.pdf")).toBeInTheDocument()
    expect(screen.queryByText("No root documents yet.")).toBeNull()
  })

  it("a list that emptied under an open page goes back to the first page and says it is empty", async () => {
    const docs = many(30)
    installFakeLibraryApi({ ...libraryApi }, docs)
    renderPage()
    await waitFor(() => expect(tfoot()).toHaveTextContent("1–25 of 30"))
    next()
    await waitFor(() => expect(tfoot()).toHaveTextContent("26–30 of 30"))
    docs.splice(0, docs.length)
    act(() => wired.onChange())
    expect(await screen.findByText("No root documents yet.", {}, { timeout: 2000 })).toBeInTheDocument()
    await waitFor(() =>
      expect(libraryApi.listDocumentsPage.mock.calls.at(-1)?.[0]).toMatchObject({ offset: 0 }),
    )
  })
})
