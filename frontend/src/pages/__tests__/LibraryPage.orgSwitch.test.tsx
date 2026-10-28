/**
 * Phase 298-04 (ORG-01 / D-08 / D-09 / D-12 / UI-D8 / UI-D10) — the Library follows an org switch.
 *
 * Driven through the REAL `useFolders` and `useLibraryDocuments` (only the network is faked), with
 * a flippable active org standing in for OrgProvider. Asserted by RENDERED WORDS: the old org's
 * folder and document never show after the switch, "Loading folders…" shows instead of
 * "No folders yet", and then the new org's items land. The header seam (`setActiveOrgId`) flips
 * first and the state second, exactly as `switchOrg` does.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest"
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CitationNavProvider } from "@/lib/citationNav"
import type { Document, DocumentListResponse, Folder, LibrarySummary } from "@/types"
import { summarizeDocuments } from "@/test-utils/fakeLibraryApi"

const orgStore = vi.hoisted(() => {
  let current: string | null = null
  const subs = new Set<() => void>()
  return {
    get: () => current,
    set: (v: string | null) => {
      current = v
      subs.forEach((f) => f())
    },
    subscribe: (f: () => void) => {
      subs.add(f)
      return () => {
        subs.delete(f)
      }
    },
  }
})
vi.mock("@/providers/OrgProvider", async () => {
  const { useSyncExternalStore } = await import("react")
  return {
    useOrgOptional: () => ({ activeOrgId: useSyncExternalStore(orgStore.subscribe, orgStore.get) }),
  }
})

const api = vi.hoisted(() => ({
  listFolders: vi.fn(),
  listDocumentsPage: vi.fn(),
  getLibrarySummary: vi.fn(),
  getDocument: vi.fn(),
  listViews: vi.fn(),
  listMetadataFields: vi.fn(),
  resolveView: vi.fn(),
  resolveAdHoc: vi.fn(),
  getReembedProgress: vi.fn(),
}))
const experts = vi.hoisted(() => ({ listExpertInstalls: vi.fn() }))
const mockUseDocuments = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, ...api }
})
vi.mock("@/lib/api/experts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/experts")>()
  return { ...actual, ...experts }
})
vi.mock("@/hooks/useDocuments", () => ({ useDocuments: mockUseDocuments }))
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

import { setActiveOrgId, getActiveOrgId } from "@/lib/api/_core"

function folder(id: string, name: string): Folder {
  return {
    id,
    user_id: "user-1",
    name,
    parent_id: null,
    is_org_shared: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }
}

function doc(id: string, filename: string, folderId: string | null = null): Document {
  return {
    id,
    user_id: "user-1",
    folder_id: folderId,
    filename,
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
  } as Document
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const ORG_A = { folders: [folder("fa", "Research A")], docs: [doc("da", "alpha-a.pdf")] }
const ORG_B = { folders: [folder("fb", "Contracts B")], docs: [doc("db", "bravo-b.pdf")] }
const BY_ORG: Record<string, typeof ORG_A> = { "org-a": ORG_A, "org-b": ORG_B }

/** Each read answers for the org its request was SENT under (the header). */
function answerFor() {
  return BY_ORG[getActiveOrgId() ?? ""] ?? { folders: [], docs: [] }
}
function page(docs: Document[]): DocumentListResponse {
  return { documents: docs, total: docs.length, offset: 0, limit: 25 }
}

function switchOrg(next: string | null) {
  setActiveOrgId(next)
  orgStore.set(next)
}

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
  for (const fn of Object.values(api)) fn.mockReset()
  experts.listExpertInstalls.mockReset()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  switchOrg("org-a")
  api.listFolders.mockImplementation(async () => answerFor().folders)
  api.listDocumentsPage.mockImplementation(async (params: { folder_id: string }) => {
    const docs = answerFor().docs.filter((d) => (d.folder_id ?? "root") === params.folder_id)
    return page(docs)
  })
  api.getLibrarySummary.mockImplementation(async (): Promise<LibrarySummary> => summarizeDocuments(answerFor().docs))
  api.getDocument.mockRejectedValue(Object.assign(new Error("not visible"), { status: 404 }))
  api.listViews.mockResolvedValue([])
  api.listMetadataFields.mockResolvedValue([])
  api.getReembedProgress.mockResolvedValue({
    status: "idle", total: 0, re_embedded: 0, remaining: 0, model: "m", updated_at: null,
  })
  experts.listExpertInstalls.mockResolvedValue([])
  mockUseDocuments.mockImplementation(() => ({
    uploading: false,
    uploadingCount: 0,
    upload: vi.fn().mockResolvedValue({ isDuplicate: false }),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
  }))
})

afterEach(() => switchOrg(null))

describe("LibraryPage — switching org (298-04)", () => {
  it("drops the old org's folder and document AT ONCE, says 'Loading folders…', then shows the new org's", async () => {
    renderPage()
    expect(await screen.findByText("Research A")).toBeInTheDocument()
    expect(await screen.findByText("alpha-a.pdf")).toBeInTheDocument()

    const foldersB = deferred<Folder[]>()
    api.listFolders.mockImplementationOnce(() => foldersB.promise)
    act(() => switchOrg("org-b"))

    expect(screen.queryByText("Research A")).toBeNull()
    expect(screen.queryByText("alpha-a.pdf")).toBeNull()
    expect(screen.getByText("Loading folders…")).toBeInTheDocument()
    expect(screen.queryByText("No folders yet")).toBeNull()
    expect(screen.getByRole("button", { name: "Root" })).toBeInTheDocument()

    await act(async () => foldersB.resolve(ORG_B.folders))
    expect(await screen.findByText("Contracts B")).toBeInTheDocument()
    expect(await screen.findByText("bravo-b.pdf")).toBeInTheDocument()
    expect(screen.queryByText("Loading folders…")).toBeNull()
    expect(screen.queryByText("Research A")).toBeNull()
  })

  it("a slow old-org folder answer landing after the switch never repaints", async () => {
    const foldersA = deferred<Folder[]>()
    api.listFolders.mockImplementationOnce(() => foldersA.promise)
    renderPage()
    act(() => switchOrg("org-b"))
    expect(await screen.findByText("Contracts B")).toBeInTheDocument()
    await act(async () => foldersA.resolve(ORG_A.folders))
    expect(screen.queryByText("Research A")).toBeNull()
    expect(screen.getByText("Contracts B")).toBeInTheDocument()
  })

  it("selection returns to Root and the open document closes (UI-D10)", async () => {
    api.listDocumentsPage.mockImplementation(async (params: { folder_id: string }) => {
      const docs = [...answerFor().docs, doc("da-in", "inside-a.pdf", "fa")].filter(
        (d) => (d.folder_id ?? "root") === params.folder_id && (getActiveOrgId() === "org-a" || d.id !== "da-in"),
      )
      return page(docs)
    })
    renderPage()
    fireEvent.click(await screen.findByText("Research A"))
    expect(await screen.findByText("inside-a.pdf")).toBeInTheDocument()
    fireEvent.click(screen.getByText("inside-a.pdf"))
    expect(await screen.findByLabelText("Document details")).toHaveTextContent("panel:inside-a.pdf")

    api.listDocumentsPage.mockClear()
    act(() => switchOrg("org-b"))
    expect(screen.queryByLabelText("Document details")).toBeNull()
    expect(await screen.findByText("bravo-b.pdf")).toBeInTheDocument()
    // Every documents read after the switch is the Root browse, never the old org's folder id.
    for (const [params] of api.listDocumentsPage.mock.calls) expect(params.folder_id).toBe("root")
  })

  it("re-reads the fields, views and Expert provenance for the new org (D-08, SEED-317)", async () => {
    renderPage()
    expect(await screen.findByText("Research A")).toBeInTheDocument()
    await waitFor(() => expect(experts.listExpertInstalls).toHaveBeenCalledTimes(1))
    expect(api.listViews).toHaveBeenCalledTimes(1)
    expect(api.listMetadataFields).toHaveBeenCalledTimes(1)
    act(() => switchOrg("org-b"))
    await waitFor(() => expect(experts.listExpertInstalls).toHaveBeenCalledTimes(2))
    expect(api.listViews).toHaveBeenCalledTimes(2)
    expect(api.listMetadataFields).toHaveBeenCalledTimes(2)
  })

  it("the Root count is omitted while the new org's summary is unanswered — never 0", async () => {
    renderPage()
    const rootRow = () => screen.getByRole("button", { name: "Root" })
    await waitFor(() => expect(rootRow().textContent).toMatch(/1/))
    const sumB = deferred<LibrarySummary>()
    api.getLibrarySummary.mockImplementationOnce(() => sumB.promise)
    act(() => switchOrg("org-b"))
    expect(rootRow().textContent).not.toMatch(/\d/)
    await act(async () => sumB.resolve(summarizeDocuments(ORG_B.docs)))
    await waitFor(() => expect(rootRow().textContent).toMatch(/1/))
  })
})
