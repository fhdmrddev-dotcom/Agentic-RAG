/**
 * Phase 284-01 Task 2 (FIX-11 / D-07 / D-11 / D-12 / D-24 / R-04) — the Library data hook.
 *
 * `useLibraryDocuments` is the D-24 seam: every row and number `LibraryPage` used to derive
 * from the whole documents array now comes from here. In wave 1 it is built on `useDocuments`
 * and must answer EXACTLY what the page computed before (the screen is byte-identical); 284-03
 * swaps its body for server reads without the return shape changing.
 *
 * `summarizeDocuments` is the client mirror of `GET /library/summary` — the same field names,
 * the same semantics — so the children that only count can take the server's numbers later
 * without noticing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import type { Document } from "@/types"

const { useDocumentsMock } = vi.hoisted(() => ({ useDocumentsMock: vi.fn() }))
vi.mock("@/hooks/useDocuments", () => ({ useDocuments: useDocumentsMock }))

import { summarizeDocuments, useLibraryDocuments } from "@/hooks/useLibraryDocuments"

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
const r1 = doc("r1")
const r2 = doc("r2", { archived_at: "2026-10-01T00:00:00Z", file_size: 50 })
const r3 = doc("r3", { chunk_count: null })
const f1 = doc("f1", { folder_id: "F", file_size: 10 })
const f2 = doc("f2", { folder_id: "F", file_size: 20 })
const g1 = doc("g1", { folder_id: "G", status: "processing", ingestion_step: "chunking", chunk_count: null })
const FIXTURE = [r1, r2, r3, f1, f2, g1]

const upload = vi.fn()
const deleteDoc = vi.fn()
const loadDocuments = vi.fn()

function mockDocuments(documents: Document[]) {
  useDocumentsMock.mockReturnValue({
    documents,
    uploading: false,
    uploadingCount: 0,
    upload,
    deleteDoc,
    loadDocuments,
  })
}

const BASE_ARGS = {
  folderId: null as string | null,
  filteredDocs: null as Document[] | null,
  includeArchived: false,
  offset: 0,
  limit: 25,
  selectedDocId: null as string | null,
  findRows: [] as readonly Document[],
}

beforeEach(() => {
  useDocumentsMock.mockReset()
})

describe("summarizeDocuments — the client mirror of GET /library/summary", () => {
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

describe("useLibraryDocuments — wave 1 answers what the page computed before", () => {
  it("Root browse, one page, archived hidden", () => {
    mockDocuments(FIXTURE)
    const { result } = renderHook(() => useLibraryDocuments({ ...BASE_ARGS, limit: 2 }))
    expect(result.current.rows.map((d) => d.id)).toEqual(["r1", "r3"])
    expect(result.current.total).toBe(2)
    expect(result.current.archivedHidden).toBe(1)
    expect(result.current.summary).toEqual(summarizeDocuments(FIXTURE))
    expect(result.current.summaryState).toBe("ready")
    expect(result.current.listState).toBe("ready")
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("the offset pages through the shown root rows", () => {
    mockDocuments(FIXTURE)
    const { result } = renderHook(() => useLibraryDocuments({ ...BASE_ARGS, offset: 1, limit: 1 }))
    expect(result.current.rows.map((d) => d.id)).toEqual(["r3"])
    expect(result.current.total).toBe(2)
  })

  it("a folder browse scopes to that folder; include archived shows the archived rows", () => {
    mockDocuments(FIXTURE)
    const folder = renderHook(() => useLibraryDocuments({ ...BASE_ARGS, folderId: "F" }))
    expect(folder.result.current.rows.map((d) => d.id)).toEqual(["f1", "f2"])
    expect(folder.result.current.archivedHidden).toBe(0)
    const withArchived = renderHook(() => useLibraryDocuments({ ...BASE_ARGS, includeArchived: true }))
    expect(withArchived.result.current.rows.map((d) => d.id)).toEqual(["r1", "r2", "r3"])
    expect(withArchived.result.current.total).toBe(3)
  })

  it("inFlight keeps today's predicate — pending, processing AND paused", () => {
    mockDocuments([
      ...FIXTURE,
      doc("p1", { status: "paused" }),
      doc("q1", { status: "pending" }),
      doc("x1", { status: "failed" }),
    ])
    const { result } = renderHook(() => useLibraryDocuments(BASE_ARGS))
    expect(result.current.inFlight).toBe(3)
  })

  it("selectedDoc resolves from the documents, then the Find rows, else null", () => {
    mockDocuments(FIXTURE)
    const older = doc("old-v1", { is_latest: false })
    const fromDocs = renderHook(() =>
      useLibraryDocuments({ ...BASE_ARGS, selectedDocId: "f2", findRows: [older] }),
    )
    expect(fromDocs.result.current.selectedDoc).toBe(f2)
    const fromFind = renderHook(() =>
      useLibraryDocuments({ ...BASE_ARGS, selectedDocId: "old-v1", findRows: [older] }),
    )
    expect(fromFind.result.current.selectedDoc).toBe(older)
    const gone = renderHook(() => useLibraryDocuments({ ...BASE_ARGS, selectedDocId: "nope" }))
    expect(gone.result.current.selectedDoc).toBeNull()
  })

  it("with a resolved filter, rows are the unsliced shown filtered list (the view rule)", () => {
    mockDocuments(FIXTURE)
    const filtered = [f1, r2, f2, r1]
    const { result } = renderHook(() =>
      useLibraryDocuments({ ...BASE_ARGS, filteredDocs: filtered, limit: 1 }),
    )
    expect(result.current.rows.map((d) => d.id)).toEqual(["f1", "f2", "r1"])
    expect(result.current.total).toBe(3)
    expect(result.current.archivedHidden).toBe(1)
  })

  it("passes the upload / delete / refresh doors and the raw array through untouched", () => {
    mockDocuments(FIXTURE)
    const { result } = renderHook(() => useLibraryDocuments(BASE_ARGS))
    expect(result.current.upload).toBe(upload)
    expect(result.current.deleteDoc).toBe(deleteDoc)
    expect(result.current.refresh).toBe(loadDocuments)
    expect(result.current.uploading).toBe(false)
    expect(result.current.uploadingCount).toBe(0)
    expect(result.current.documentsForIngestion).toBe(FIXTURE)
  })
})
