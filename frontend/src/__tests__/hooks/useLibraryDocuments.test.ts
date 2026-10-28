/**
 * Phase 284-01 Task 2 → 284-03 Task 1 (FIX-11 / D-07 / D-08 / D-11 / D-12 / D-24 / R-04) — the
 * Library data hook.
 *
 * `useLibraryDocuments` is the D-24 seam: every row and number `LibraryPage` renders comes from
 * here. 284-01 built it over the in-memory array; 284-03 swapped its BODY for server reads —
 * `GET /documents` (one page), `GET /library/summary` (the numbers) and `GET /documents/{id}` (a
 * selected document on neither the page nor Find's rows) — with the return shape unchanged.
 *
 * Every wave-1 case is kept, re-expressed against `fakeLibraryApi`, which answers the way the
 * server does over ONE fixture — so a case cannot pass by mocking a number.
 *
 * `summarizeDocuments` moved with the array: it is the fake's summary now, not the hook's.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { Dispatch, SetStateAction } from "react"
import type { Document, DocumentListResponse, LibrarySummary } from "@/types"
import { fakeLibraryApi, installFakeLibraryApi, summarizeDocuments } from "@/test-utils/fakeLibraryApi"

const {
  useDocumentsMock,
  mockListDocumentsPage,
  mockGetLibrarySummary,
  mockGetDocument,
  mockResolveView,
  mockResolveAdHoc,
} = vi.hoisted(() => ({
  useDocumentsMock: vi.fn(),
  mockListDocumentsPage: vi.fn(),
  mockGetLibrarySummary: vi.fn(),
  mockGetDocument: vi.fn(),
  mockResolveView: vi.fn(),
  mockResolveAdHoc: vi.fn(),
}))
vi.mock("@/hooks/useDocuments", () => ({ useDocuments: useDocumentsMock }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    listDocumentsPage: mockListDocumentsPage,
    getLibrarySummary: mockGetLibrarySummary,
    getDocument: mockGetDocument,
    resolveView: mockResolveView,
    resolveAdHoc: mockResolveAdHoc,
  }
})

// Phase 298-04 (D-08 / D-09) — a flippable active org standing in for OrgProvider.
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

import { DocumentListError } from "@/lib/api/documents"
import { setActiveOrgId } from "@/lib/api/_core"
import { useLibraryDocuments, type UseLibraryDocumentsArgs } from "@/hooks/useLibraryDocuments"

function switchOrg(next: string | null) {
  setActiveOrgId(next)
  orgStore.set(next)
}

function doc(id: string, over: Partial<Document> = {}): Document {
  return {
    id,
    user_id: "u1",
    folder_id: null,
    filename: `${id}.pdf`,
    file_path: `u1/${id}.pdf`,
    file_size: 100,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 2,
    content_hash: null,
    metadata: null,
    created_at: "2026-10-16T00:00:00Z",
    updated_at: "2026-10-16T00:00:00Z",
    ...over,
  }
}

// 3 root (1 archived), 2 in folder F, 1 processing in folder G at the chunking step.
// Equal timestamps on purpose: the server's tiebreak (`id` descending) decides the order.
const r1 = doc("r1")
const r2 = doc("r2", { archived_at: "2026-10-01T00:00:00Z", file_size: 50 })
const r3 = doc("r3", { chunk_count: null })
const f1 = doc("f1", { folder_id: "F", file_size: 10 })
const f2 = doc("f2", { folder_id: "F", file_size: 20 })
const g1 = doc("g1", { folder_id: "G", status: "processing", ingestion_step: "chunking", chunk_count: null })
const FIXTURE = [r1, r2, r3, f1, f2, g1]

const upload = vi.fn()
const deleteDoc = vi.fn()
/** What the hook handed `useDocuments` — the on-page setter and the change hint. */
let wired: { setRows: Dispatch<SetStateAction<Document[]>>; onChange: () => void }

const MOCKS = {
  listDocumentsPage: mockListDocumentsPage,
  getLibrarySummary: mockGetLibrarySummary,
  getDocument: mockGetDocument,
  resolveView: mockResolveView,
  resolveAdHoc: mockResolveAdHoc,
}

function serve(docs: readonly Document[], options?: Parameters<typeof fakeLibraryApi>[1]) {
  return installFakeLibraryApi(MOCKS, docs, options)
}

const BASE_ARGS: UseLibraryDocumentsArgs = {
  source: { kind: "browse", folderId: null },
  includeArchived: false,
  offset: 0,
  limit: 25,
  selectedDocId: null,
  findRows: [],
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  useDocumentsMock.mockReset()
  useDocumentsMock.mockImplementation((args: typeof wired) => {
    wired = args
    return { uploading: false, uploadingCount: 0, upload, deleteDoc }
  })
  serve(FIXTURE)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("summarizeDocuments — the fake's GET /library/summary (moved from the hook by 284-03)", () => {
  it("counts root, folders, archived, steps and the total", () => {
    const s = summarizeDocuments(FIXTURE)
    expect(s.total).toBe(6)
    expect(s.archived).toBe(1)
    expect(s.root).toEqual({ count: 3, size_bytes: 250, archived: 1 })
    expect(s.folders.F).toEqual({ count: 2, size_bytes: 30, archived: 0 })
    expect(s.folders.G.count).toBe(1)
    expect(s.steps).toEqual({ chunking: 1 })
  })

  it("sums chunk_count with null as 0, and counts statuses with paused always 0 (R-04)", () => {
    const s = summarizeDocuments([
      ...FIXTURE,
      doc("p1", { status: "paused" }),
      doc("q1", { status: "pending", chunk_count: null }),
      doc("x1", { status: "failed", chunk_count: null }),
    ])
    // r1 2 + r2 2 + f1 2 + f2 2 + p1 2 = 10
    expect(s.chunks).toBe(10)
    expect(s.status).toEqual({ pending: 1, processing: 1, paused: 0, completed: 5, failed: 1 })
  })

  it("counts rate-limited in-flight documents with IngestionTab's predicate", () => {
    const s = summarizeDocuments([
      doc("a", { status: "processing", error_message: "OpenAI Rate Limit reached" }),
      doc("b", { status: "pending", error_message: "HTTP 429 from provider" }),
      doc("c", { status: "paused", error_message: "insufficient QUOTA" }),
      doc("d", { status: "failed", error_message: "rate limit" }), // not in flight
      doc("e", { status: "processing", error_message: null }),
    ])
    expect(s.rate_limited_in_flight).toBe(3)
  })

  it("lists connections in first-seen order with names and counts", () => {
    const s = summarizeDocuments([
      doc("a", { source_connection_id: "c2", source_connection_name: "Drive" }),
      doc("b"),
      doc("c", { source_connection_id: "c1", source_connection_name: null }),
      doc("d", { source_connection_id: "c2", source_connection_name: "Drive" }),
    ])
    expect(s.connections).toEqual([
      { id: "c2", name: "Drive", count: 2 },
      { id: "c1", name: null, count: 1 },
    ])
  })

  it("lists distinct non-empty document types, sorted as the Find editor offers them", () => {
    const s = summarizeDocuments([
      doc("a", { metadata: { document_type: "invoice" } }),
      doc("b", { metadata: { document_type: "contract" } }),
      doc("c", { metadata: { document_type: "  " } }),
      doc("d", { metadata: { document_type: "invoice" } }),
      doc("e", { metadata: null }),
    ])
    expect(s.document_types).toEqual([
      { value: "contract", count: 1 },
      { value: "invoice", count: 2 },
    ])
    expect(s.document_types_truncated).toBe(false)
  })

  it("answers an empty library with zeros, never missing keys", () => {
    const s = summarizeDocuments([])
    expect(s).toEqual({
      total: 0,
      archived: 0,
      chunks: 0,
      root: { count: 0, size_bytes: 0, archived: 0 },
      folders: {},
      status: { pending: 0, processing: 0, paused: 0, completed: 0, failed: 0 },
      steps: {},
      rate_limited_in_flight: 0,
      connections: [],
      document_types: [],
      document_types_truncated: false,
    })
  })
})

describe("useLibraryDocuments — the server body (284-03)", () => {
  it("Root browse: ONE page request and ONE summary request; null and cold until answered", async () => {
    const { result } = renderHook(() => useLibraryDocuments({ ...BASE_ARGS, limit: 2 }))
    // Before the answer: nothing is claimed (D-12 / SEED-248).
    expect(result.current.total).toBeNull()
    expect(result.current.summary).toBeNull()
    expect(result.current.listState).toBe("cold")
    expect(result.current.summaryState).toBe("loading")
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    expect(mockListDocumentsPage).toHaveBeenCalledTimes(1)
    expect(mockListDocumentsPage).toHaveBeenCalledWith({
      folder_id: "root",
      include_archived: false,
      offset: 0,
      limit: 2,
    })
    expect(mockGetLibrarySummary).toHaveBeenCalledTimes(1)
    // The server's order (equal timestamps → id descending), archived hidden.
    expect(result.current.rows.map((d) => d.id)).toEqual(["r3", "r1"])
    expect(result.current.total).toBe(2)
    await waitFor(() => expect(result.current.summaryState).toBe("ready"))
    expect(result.current.archivedHidden).toBe(1)
    expect(result.current.summary).toEqual(summarizeDocuments(FIXTURE))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("the offset pages through the shown root rows", async () => {
    const { result } = renderHook(() => useLibraryDocuments({ ...BASE_ARGS, offset: 1, limit: 1 }))
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    expect(result.current.rows.map((d) => d.id)).toEqual(["r1"])
    expect(result.current.total).toBe(2)
  })

  it("a folder browse scopes to that folder; include archived shows the archived rows", async () => {
    const folder = renderHook(() =>
      useLibraryDocuments({ ...BASE_ARGS, source: { kind: "browse", folderId: "F" } }),
    )
    await waitFor(() => expect(folder.result.current.listState).toBe("ready"))
    expect(mockListDocumentsPage).toHaveBeenCalledWith(expect.objectContaining({ folder_id: "F" }))
    expect(folder.result.current.rows.map((d) => d.id)).toEqual(["f2", "f1"])
    await waitFor(() => expect(folder.result.current.summaryState).toBe("ready"))
    expect(folder.result.current.archivedHidden).toBe(0)
    const withArchived = renderHook(() => useLibraryDocuments({ ...BASE_ARGS, includeArchived: true }))
    await waitFor(() => expect(withArchived.result.current.listState).toBe("ready"))
    expect(withArchived.result.current.rows.map((d) => d.id)).toEqual(["r3", "r2", "r1"])
    expect(withArchived.result.current.total).toBe(3)
    // The hidden line still counts them, so it can read "Showing 1 archived · Hide".
    await waitFor(() => expect(withArchived.result.current.archivedHidden).toBe(1))
  })

  // 284-03 (R-04): the server's in-flight is pending + processing. `paused` is not a stored
  // status, so the summary counts it nowhere — the wave-1 client predicate is retired with it.
  it("inFlight is the summary's pending + processing (R-04)", async () => {
    serve([
      ...FIXTURE,
      doc("p1", { status: "paused" }),
      doc("q1", { status: "pending" }),
      doc("x1", { status: "failed" }),
    ])
    const { result } = renderHook(() => useLibraryDocuments(BASE_ARGS))
    expect(result.current.inFlight).toBeNull()
    await waitFor(() => expect(result.current.inFlight).toBe(2))
  })

  it("selectedDoc resolves from the page, then the Find rows, else ONE GET /documents/{id}", async () => {
    const older = doc("old-v1", { is_latest: false })
    const fromPage = renderHook(() =>
      useLibraryDocuments({ ...BASE_ARGS, selectedDocId: "r1", findRows: [older] }),
    )
    await waitFor(() => expect(fromPage.result.current.selectedDoc?.id).toBe("r1"))
    const fromFind = renderHook(() =>
      useLibraryDocuments({ ...BASE_ARGS, selectedDocId: "old-v1", findRows: [older] }),
    )
    expect(fromFind.result.current.selectedDoc).toBe(older)
    expect(mockGetDocument).not.toHaveBeenCalled()
    // f2 is in folder F — on neither Root's page nor Find's rows.
    const offPage = renderHook(() => useLibraryDocuments({ ...BASE_ARGS, selectedDocId: "f2" }))
    await waitFor(() => expect(offPage.result.current.selectedDoc).toEqual(f2))
    expect(mockGetDocument).toHaveBeenCalledTimes(1)
    expect(mockGetDocument).toHaveBeenCalledWith("f2")
  })

  it("a selected id the server answers 404 for stays closed, with no error (T-284-19)", async () => {
    const { result } = renderHook(() => useLibraryDocuments({ ...BASE_ARGS, selectedDocId: "nope" }))
    await waitFor(() => expect(mockGetDocument).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    expect(result.current.selectedDoc).toBeNull()
    expect(result.current.selectedDocError).toBeNull()
  })

  it("any other failure opening a document says so, and Try again re-asks once", async () => {
    mockGetDocument.mockRejectedValueOnce(new DocumentListError(500, "boom"))
    const { result } = renderHook(() => useLibraryDocuments({ ...BASE_ARGS, selectedDocId: "f2" }))
    await waitFor(() => expect(result.current.selectedDocError).not.toBeNull())
    expect(result.current.selectedDoc).toBeNull()
    act(() => result.current.retrySelectedDoc())
    await waitFor(() => expect(result.current.selectedDoc?.id).toBe("f2"))
    expect(result.current.selectedDocError).toBeNull()
    expect(mockGetDocument).toHaveBeenCalledTimes(2)
  })

  it("a saved view resolves ONE page on the server, with the archived count from ONE count read", async () => {
    serve(FIXTURE, { views: { v1: [f1, r2, f2, r1] } })
    const { result } = renderHook(() =>
      useLibraryDocuments({ ...BASE_ARGS, source: { kind: "view", viewId: "v1" }, limit: 2 }),
    )
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    expect(mockResolveView).toHaveBeenCalledWith("v1", { offset: 0, limit: 2, include_archived: false })
    expect(mockResolveView).toHaveBeenCalledWith("v1", { count_only: true, include_archived: true })
    expect(mockResolveView).toHaveBeenCalledTimes(2)
    expect(mockListDocumentsPage).not.toHaveBeenCalled()
    // No client slice: the rows are the server's page; the total is the server's count.
    expect(result.current.rows.map((d) => d.id)).toEqual(["f1", "f2"])
    expect(result.current.total).toBe(3)
    expect(result.current.archivedHidden).toBe(1)
  })

  it("an ad-hoc filter resolves through resolveAdHoc the same way", async () => {
    const filter = { op: "and" as const, conditions: [{ field: "document_type", op: "eq" as const, value: "x" }] }
    serve(FIXTURE, { adHoc: () => [r2, r3] })
    const { result } = renderHook(() =>
      useLibraryDocuments({ ...BASE_ARGS, source: { kind: "filter", filter }, includeArchived: true }),
    )
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    expect(mockResolveAdHoc).toHaveBeenCalledWith(filter, { offset: 0, limit: 25, include_archived: true })
    expect(result.current.rows.map((d) => d.id)).toEqual(["r2", "r3"])
    expect(result.current.archivedHidden).toBe(1)
  })

  it("a page change keeps the rows (warm); a folder switch clears them (cold)", async () => {
    const { result, rerender } = renderHook((args: UseLibraryDocumentsArgs) => useLibraryDocuments(args), {
      initialProps: { ...BASE_ARGS, limit: 1 },
    })
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    const gate = deferred<DocumentListResponse>()
    mockListDocumentsPage.mockReturnValueOnce(gate.promise)
    rerender({ ...BASE_ARGS, limit: 1, offset: 1 })
    expect(result.current.listState).toBe("warm")
    expect(result.current.rows.map((d) => d.id)).toEqual(["r3"])
    expect(result.current.total).toBe(2)
    await act(async () => gate.resolve(await fakeLibraryApi(FIXTURE).listDocumentsPage({ folder_id: "root", offset: 1, limit: 1 })))
    expect(result.current.rows.map((d) => d.id)).toEqual(["r1"])
    expect(result.current.listState).toBe("ready")

    const gate2 = deferred<DocumentListResponse>()
    mockListDocumentsPage.mockReturnValueOnce(gate2.promise)
    rerender({ ...BASE_ARGS, limit: 1, source: { kind: "browse", folderId: "F" } })
    expect(result.current.listState).toBe("cold")
    expect(result.current.rows).toEqual([])
    expect(result.current.total).toBeNull()
  })

  it("a failed cold load is an error with no rows; a failed reload KEEPS the rows", async () => {
    mockListDocumentsPage.mockRejectedValueOnce(new DocumentListError(500, "Couldn't load documents."))
    const { result, rerender } = renderHook((args: UseLibraryDocumentsArgs) => useLibraryDocuments(args), {
      initialProps: BASE_ARGS,
    })
    await waitFor(() => expect(result.current.listState).toBe("error"))
    expect(result.current.rows).toEqual([])
    expect(result.current.total).toBeNull()
    expect(result.current.error).toBeInstanceOf(DocumentListError)
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    expect(result.current.error).toBeNull()

    mockListDocumentsPage.mockRejectedValueOnce(new DocumentListError(null, "Couldn't load documents."))
    rerender({ ...BASE_ARGS, limit: 1 })
    await waitFor(() => expect(result.current.listState).toBe("error"))
    expect(result.current.rows.map((d) => d.id)).toEqual(["r3", "r1"])
    expect(result.current.total).toBe(2)
  })

  it("a stale answer — an earlier request resolving after a later one — is dropped", async () => {
    const slow = deferred<DocumentListResponse>()
    mockListDocumentsPage.mockReturnValueOnce(slow.promise)
    const { result, rerender } = renderHook((args: UseLibraryDocumentsArgs) => useLibraryDocuments(args), {
      initialProps: BASE_ARGS,
    })
    rerender({ ...BASE_ARGS, source: { kind: "browse", folderId: "F" } })
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    expect(result.current.rows.map((d) => d.id)).toEqual(["f2", "f1"])
    await act(async () => slow.resolve({ documents: [r1], total: 1, offset: 0, limit: 25 }))
    expect(result.current.rows.map((d) => d.id)).toEqual(["f2", "f1"])
  })

  it("Realtime INSERT / DELETE hints coalesce: three inside 500 ms → ONE page + ONE summary refetch, silently", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { result } = renderHook(() => useLibraryDocuments(BASE_ARGS))
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    await waitFor(() => expect(result.current.summaryState).toBe("ready"))
    expect(mockListDocumentsPage).toHaveBeenCalledTimes(1)
    expect(mockGetLibrarySummary).toHaveBeenCalledTimes(1)
    const states: string[] = []
    act(() => {
      wired.onChange()
      wired.onChange()
      wired.onChange()
    })
    await act(async () => {
      vi.advanceTimersByTime(499)
    })
    expect(mockListDocumentsPage).toHaveBeenCalledTimes(1)
    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    states.push(result.current.listState)
    await waitFor(() => expect(mockListDocumentsPage).toHaveBeenCalledTimes(2))
    expect(mockGetLibrarySummary).toHaveBeenCalledTimes(2)
    // Background refetches are silent: never "warm" (no dim, no aria-busy).
    expect(states).not.toContain("warm")
    expect(result.current.listState).toBe("ready")
  })

  it("a Realtime UPDATE merges into an on-page row only — the merge keeps server-derived fields", async () => {
    const withFlags = doc("r9", { tables_stage_applies: true, status: "processing" })
    serve([withFlags])
    const { result } = renderHook(() => useLibraryDocuments(BASE_ARGS))
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    act(() => {
      wired.setRows((prev) => prev.map((d) => (d.id === "r9" ? { ...d, ...{ ingestion_step: "embedding" } } : d)))
    })
    expect(result.current.rows[0].ingestion_step).toBe("embedding")
    expect(result.current.rows[0].tables_stage_applies).toBe(true)
  })

  it("284-REVIEW WR-01: hands useDocuments the ON-PAGE rows, so a membership UPDATE can be told from a cosmetic one", async () => {
    const { result } = renderHook(() => useLibraryDocuments(BASE_ARGS))
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    const last = useDocumentsMock.mock.calls.at(-1)?.[0] as { rows?: Document[] }
    expect(last.rows?.map((d) => d.id)).toEqual(result.current.rows.map((d) => d.id))
    expect(last.rows?.length).toBeGreaterThan(0)
  })

  it("an upload shows its document as the first row of page 1 of its folder until the refetch lands", async () => {
    const fresh = doc("new-1", { status: "pending", created_at: "2026-10-17T00:00:00Z" })
    upload.mockResolvedValue({ isDuplicate: false, doc: fresh })
    const { result } = renderHook(() => useLibraryDocuments(BASE_ARGS))
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    let answer: unknown
    await act(async () => {
      answer = await result.current.upload(new File(["x"], "new-1.pdf"), null)
    })
    expect(answer).toEqual({ isDuplicate: false })
    expect(result.current.rows.map((d) => d.id)).toEqual(["new-1", "r3", "r1"])
    // Totals move with the summary refetch, never optimistically.
    expect(result.current.total).toBe(2)
  })

  it("an upload to a different folder is not shown on this page", async () => {
    upload.mockResolvedValue({ isDuplicate: false, doc: doc("elsewhere", { folder_id: "F" }) })
    const { result } = renderHook(() => useLibraryDocuments(BASE_ARGS))
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    await act(async () => {
      await result.current.upload(new File(["x"], "elsewhere.pdf"), "F")
    })
    expect(result.current.rows.map((d) => d.id)).toEqual(["r3", "r1"])
  })

  it("the summary failing cold reads error, and retrySummary re-asks", async () => {
    mockGetLibrarySummary.mockRejectedValueOnce(new DocumentListError(500, "x"))
    const { result } = renderHook(() => useLibraryDocuments(BASE_ARGS))
    await waitFor(() => expect(result.current.summaryState).toBe("error"))
    expect(result.current.summary).toBeNull()
    expect(result.current.inFlight).toBeNull()
    act(() => result.current.retrySummary())
    await waitFor(() => expect(result.current.summaryState).toBe("ready"))
    expect((result.current.summary as LibrarySummary).total).toBe(6)
  })

  it("passes the upload door, the delete door and the uploading state through", async () => {
    const { result } = renderHook(() => useLibraryDocuments(BASE_ARGS))
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    expect(typeof result.current.upload).toBe("function")
    deleteDoc.mockResolvedValue(undefined)
    await act(async () => {
      await result.current.deleteDoc("r1", "version")
    })
    expect(deleteDoc).toHaveBeenCalledWith("r1", "version")
    expect(typeof result.current.refresh).toBe("function")
    expect(result.current.uploading).toBe(false)
    expect(result.current.uploadingCount).toBe(0)
  })
})

// ── Phase 298-04 (D-08 / D-09) — an org switch is a COLD source switch ─────────────────────
describe("useLibraryDocuments — follows the active org (298-04)", () => {
  beforeEach(() => switchOrg("org-a"))
  afterEach(() => switchOrg(null))

  it("a switch clears the rows AT ONCE (cold) and drops a late answer for the old org", async () => {
    const { result } = renderHook(() => useLibraryDocuments(BASE_ARGS))
    await waitFor(() => expect(result.current.listState).toBe("ready"))
    expect(result.current.rows.map((d) => d.id)).toEqual(["r3", "r1"])

    const slowA = deferred<DocumentListResponse>()
    const pageB = deferred<DocumentListResponse>()
    // An A refetch is still in flight when the person switches; B answers first.
    mockListDocumentsPage.mockReturnValueOnce(slowA.promise)
    act(() => result.current.retry())
    mockListDocumentsPage.mockReturnValueOnce(pageB.promise)
    act(() => switchOrg("org-b"))
    expect(result.current.rows).toEqual([])
    expect(result.current.listState).toBe("cold")
    expect(result.current.total).toBeNull()

    const b1 = doc("b1")
    await act(async () => pageB.resolve({ documents: [b1], total: 1, offset: 0, limit: 25 }))
    await act(async () => slowA.resolve({ documents: [r1], total: 1, offset: 0, limit: 25 }))
    expect(result.current.rows.map((d) => d.id)).toEqual(["b1"])
    expect(result.current.listState).toBe("ready")
  })

  it("the summary reads null (never the old org's numbers) until the new org answers", async () => {
    const { result } = renderHook(() => useLibraryDocuments(BASE_ARGS))
    await waitFor(() => expect(result.current.summaryState).toBe("ready"))
    expect(result.current.summary).not.toBeNull()

    const sumB = deferred<LibrarySummary>()
    mockGetLibrarySummary.mockReturnValueOnce(sumB.promise)
    act(() => switchOrg("org-b"))
    expect(result.current.summary).toBeNull()
    expect(result.current.summaryState).toBe("loading")
    expect(result.current.archivedHidden).toBeNull()
    expect(result.current.inFlight).toBeNull()

    const answer = summarizeDocuments([doc("b1")])
    await act(async () => sumB.resolve(answer))
    expect(result.current.summary).toEqual(answer)
    expect(result.current.summaryState).toBe("ready")
  })

  it("a failed FIRST summary in the new org reads error (the old org's answer does not count as known)", async () => {
    const { result } = renderHook(() => useLibraryDocuments(BASE_ARGS))
    await waitFor(() => expect(result.current.summaryState).toBe("ready"))
    mockGetLibrarySummary.mockRejectedValueOnce(new DocumentListError(500, "x"))
    act(() => switchOrg("org-b"))
    await waitFor(() => expect(result.current.summaryState).toBe("error"))
    expect(result.current.summary).toBeNull()
  })
})
