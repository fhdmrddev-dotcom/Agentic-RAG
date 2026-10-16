/**
 * Phase 284-01 Task 1 (FIX-11 / D-01, D-02, D-11, D-16, D-17, R-03..R-06, R-08) — the paged
 * wire contract, client side.
 *
 * Every wave-2 consumer calls one of these functions, so they are pinned here before any of
 * them exists. Each one must survive EITHER server shape for one release (RESEARCH Pitfall 3):
 * the frontend and the backend deploy separately, and a client that only understood the new
 * envelope would blank the Library during the window between them.
 *
 * The names are imported from the `@/lib/api` barrel on purpose, so a symbol forgotten there
 * reds here (D-207-06) rather than typechecking and being invisible.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("../_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_core")>()
  return {
    ...actual,
    API_BASE: "http://api.test",
    getAuthHeaders: async () => ({ Authorization: "Bearer tok", "Content-Type": "application/json" }),
    getAuthToken: async () => "tok",
  }
})

import type { Document, ViewFilter } from "@/types"
import {
  listDocumentsPage,
  getDocument,
  DocumentListError,
  getLibrarySummary,
  listDocumentChunksPage,
  listDocumentTablesPage,
  listDocumentImagesPage,
  fetchDocumentVersionsPage,
  resolveView,
  resolveAdHoc,
} from "@/lib/api"

function doc(id: string): Document {
  return {
    id,
    user_id: "u1",
    folder_id: null,
    filename: `${id}.pdf`,
    file_path: `u1/${id}.pdf`,
    file_size: 10,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 1,
    content_hash: null,
    metadata: null,
    created_at: "2026-10-16T00:00:00Z",
    updated_at: "2026-10-16T00:00:00Z",
  }
}

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}
function notOk(status: number) {
  return { ok: false, status, json: async () => ({ detail: "nope" }) }
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal("fetch", fetchSpy)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function calledUrl(i = 0): string {
  return fetchSpy.mock.calls[i][0] as string
}
function calledInit(i = 0): RequestInit {
  return (fetchSpy.mock.calls[i][1] ?? {}) as RequestInit
}

describe("listDocumentsPage (D-01 / D-16)", () => {
  it("serialises every given key, in a fixed order, and returns the envelope unchanged", async () => {
    const envelope = { documents: [doc("a")], total: 120, offset: 50, limit: 25 }
    fetchSpy.mockResolvedValue(ok(envelope))
    const res = await listDocumentsPage({
      offset: 50,
      limit: 25,
      folder_id: "root",
      include_archived: true,
      status: "done",
      order: "updated_desc",
      kind: "spreadsheet",
    })
    expect(calledUrl()).toBe(
      "http://api.test/documents?offset=50&limit=25&folder_id=root&include_archived=true&status=done&order=updated_desc&kind=spreadsheet",
    )
    expect(res).toEqual(envelope)
  })

  it("leaves omitted optional keys off the URL entirely", async () => {
    fetchSpy.mockResolvedValue(ok({ documents: [], total: 0, offset: 0, limit: 25 }))
    await listDocumentsPage({ offset: 0, limit: 25 })
    const url = new URL(calledUrl())
    expect([...url.searchParams.keys()]).toEqual(["offset", "limit"])
  })

  it("accepts a legacy array body for one release (Pitfall 3)", async () => {
    const a = doc("a")
    const b = doc("b")
    fetchSpy.mockResolvedValue(ok([a, b]))
    const res = await listDocumentsPage({ offset: 0, limit: 25 })
    expect(res).toEqual({ documents: [a, b], total: 2, offset: 0, limit: 2 })
  })

  it("rejects a non-ok answer with a status-carrying DocumentListError", async () => {
    fetchSpy.mockResolvedValue(notOk(500))
    const err = await listDocumentsPage({ offset: 0, limit: 25 }).catch((e) => e)
    expect(err).toBeInstanceOf(DocumentListError)
    expect((err as InstanceType<typeof DocumentListError>).status).toBe(500)
  })

  it("rejects a network failure with status null", async () => {
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"))
    const err = await listDocumentsPage({ offset: 0, limit: 25 }).catch((e) => e)
    expect(err).toBeInstanceOf(DocumentListError)
    expect((err as InstanceType<typeof DocumentListError>).status).toBeNull()
  })
})

describe("getDocument (D-11)", () => {
  it("GETs the single document", async () => {
    const d = doc("d1")
    fetchSpy.mockResolvedValue(ok(d))
    const res = await getDocument("d1")
    expect(calledUrl()).toBe("http://api.test/documents/d1")
    expect(res).toEqual(d)
  })

  it("rejects a 404 with DocumentListError status 404", async () => {
    fetchSpy.mockResolvedValue(notOk(404))
    const err = await getDocument("d1").catch((e) => e)
    expect(err).toBeInstanceOf(DocumentListError)
    expect((err as InstanceType<typeof DocumentListError>).status).toBe(404)
  })
})

describe("getLibrarySummary (D-02 / D-07)", () => {
  it("GETs /library/summary uncached", async () => {
    const summary = {
      total: 3,
      archived: 0,
      chunks: 9,
      root: { count: 3, size_bytes: 30, archived: 0 },
      folders: {},
      status: { pending: 0, processing: 0, paused: 0, completed: 3, failed: 0 },
      steps: {},
      rate_limited_in_flight: 0,
      connections: [],
      document_types: [],
      document_types_truncated: false,
    }
    fetchSpy.mockResolvedValue(ok(summary))
    const res = await getLibrarySummary()
    expect(calledUrl()).toBe("http://api.test/library/summary")
    expect(calledInit().cache).toBe("no-store")
    expect(res).toEqual(summary)
  })

  it("throws a named failure when the summary cannot load", async () => {
    fetchSpy.mockResolvedValue(notOk(500))
    await expect(getLibrarySummary()).rejects.toThrow("Failed to load library summary")
  })
})

describe("the per-document page clients (D-17)", () => {
  it("listDocumentChunksPage sends offset/limit and returns the envelope", async () => {
    const envelope = { chunks: [{ id: "c1", chunk_index: 200, content: "x" }], total: 401, offset: 200, limit: 200 }
    fetchSpy.mockResolvedValue(ok(envelope))
    const res = await listDocumentChunksPage("d1", { offset: 200, limit: 200 })
    expect(calledUrl()).toBe("http://api.test/documents/d1/chunks?offset=200&limit=200")
    expect(res).toEqual(envelope)
  })

  it("listDocumentChunksPage wraps a legacy array body", async () => {
    const rows = [
      { id: "c1", chunk_index: 0, content: "x" },
      { id: "c2", chunk_index: 1, content: "y" },
    ]
    fetchSpy.mockResolvedValue(ok(rows))
    const res = await listDocumentChunksPage("d1")
    expect(calledUrl()).toBe("http://api.test/documents/d1/chunks")
    expect(res).toEqual({ chunks: rows, total: 2, offset: 0, limit: 2 })
  })

  it("listDocumentTablesPage — envelope and legacy array", async () => {
    const table = { id: "t1", table_index: 0, headers: ["a"], rows: [["1"]] }
    fetchSpy.mockResolvedValueOnce(ok({ tables: [table], total: 60, offset: 50, limit: 50 }))
    fetchSpy.mockResolvedValueOnce(ok([table]))
    const paged = await listDocumentTablesPage("d1", { offset: 50, limit: 50 })
    expect(calledUrl(0)).toBe("http://api.test/documents/d1/tables?offset=50&limit=50")
    expect(paged.total).toBe(60)
    const legacy = await listDocumentTablesPage("d1")
    expect(legacy).toEqual({ tables: [table], total: 1, offset: 0, limit: 1 })
  })

  it("listDocumentImagesPage — envelope and legacy array", async () => {
    const image = { id: "i1", image_index: 0, description: "a chart" }
    fetchSpy.mockResolvedValueOnce(ok({ images: [image], total: 101, offset: 100, limit: 100 }))
    fetchSpy.mockResolvedValueOnce(ok([image]))
    const paged = await listDocumentImagesPage("d1", { offset: 100, limit: 100 })
    expect(calledUrl(0)).toBe("http://api.test/documents/d1/images?offset=100&limit=100")
    expect(paged.images).toEqual([image])
    const legacy = await listDocumentImagesPage("d1")
    expect(legacy).toEqual({ images: [image], total: 1, offset: 0, limit: 1 })
  })

  it("fetchDocumentVersionsPage — envelope and legacy array", async () => {
    const v = doc("v1")
    fetchSpy.mockResolvedValueOnce(ok({ versions: [v], total: 51, offset: 50, limit: 50 }))
    fetchSpy.mockResolvedValueOnce(ok([v]))
    const paged = await fetchDocumentVersionsPage("d1", { offset: 50, limit: 50 })
    expect(calledUrl(0)).toBe("http://api.test/documents/d1/versions?offset=50&limit=50")
    expect(paged.total).toBe(51)
    const legacy = await fetchDocumentVersionsPage("d1")
    expect(legacy).toEqual({ versions: [v], total: 1, offset: 0, limit: 1 })
  })

  it("a non-ok page answer rejects with a status-carrying DocumentListError", async () => {
    fetchSpy.mockResolvedValue(notOk(404))
    const err = await listDocumentChunksPage("d1").catch((e) => e)
    expect(err).toBeInstanceOf(DocumentListError)
    expect((err as InstanceType<typeof DocumentListError>).status).toBe(404)
  })
})

describe("paged view resolve (D-01 / R-06)", () => {
  const filter: ViewFilter = { op: "and", conditions: [] }

  it("resolveView sends offset, limit and include_archived when given", async () => {
    fetchSpy.mockResolvedValue(ok({ documents: [], total: 0, offset: 25, limit: 25 }))
    await resolveView("v1", { offset: 25, limit: 25, include_archived: false })
    expect(calledUrl()).toBe(
      "http://api.test/document-views/v1/resolve?offset=25&limit=25&include_archived=false",
    )
  })

  it("resolveView with only count_only is byte-identical to today (the badges)", async () => {
    fetchSpy.mockResolvedValue(ok({ total: 4 }))
    const res = await resolveView("v1", { count_only: true })
    expect(calledUrl()).toBe("http://api.test/document-views/v1/resolve?count_only=true")
    expect(res.total).toBe(4)
  })

  it("resolveAdHoc POSTs the paged body when given", async () => {
    fetchSpy.mockResolvedValue(ok({ documents: [], total: 0, offset: 0, limit: 25 }))
    await resolveAdHoc(filter, { offset: 0, limit: 25, include_archived: true })
    expect(calledUrl()).toBe("http://api.test/document-views/resolve")
    expect(calledInit().body).toBe(
      JSON.stringify({ filter_expr: filter, count_only: false, offset: 0, limit: 25, include_archived: true }),
    )
  })

  it("resolveAdHoc with only count_only keeps today's exact body", async () => {
    fetchSpy.mockResolvedValue(ok({ total: 2 }))
    await resolveAdHoc(filter, { count_only: true })
    expect(calledInit().body).toBe(JSON.stringify({ filter_expr: filter, count_only: true }))
  })
})

// 284-05 (D-16): the five whole-list array clients are DELETED. These three cases moved IN PLACE
// to what replaced them: the one-release deploy-window tolerance now lives ONLY inside the page
// clients (kept until one release after the production deploy — see lib/api/documents.ts).
describe("the deploy window lives in the page clients (the legacy array clients are gone)", () => {
  it("listDocumentsPage yields the same rows from either shape", async () => {
    const a = doc("a")
    fetchSpy.mockResolvedValueOnce(ok([a]))
    fetchSpy.mockResolvedValueOnce(ok({ documents: [a], total: 1, offset: 0, limit: 25 }))
    expect((await listDocumentsPage({ offset: 0, limit: 25 })).documents).toEqual([a])
    expect((await listDocumentsPage({ offset: 0, limit: 25 })).documents).toEqual([a])
  })

  it("the chunk, table, image and version page clients keep the server's exact total", async () => {
    const chunk = { id: "c1", chunk_index: 0, content: "x" }
    const table = { id: "t1", table_index: 0, headers: [], rows: [] }
    const image = { id: "i1", image_index: 0, description: "d" }
    const v = doc("v1")
    fetchSpy.mockResolvedValueOnce(ok({ chunks: [chunk], total: 2500, offset: 0, limit: 200 }))
    fetchSpy.mockResolvedValueOnce(ok({ tables: [table], total: 1200, offset: 0, limit: 50 }))
    fetchSpy.mockResolvedValueOnce(ok({ images: [image], total: 1100, offset: 0, limit: 100 }))
    fetchSpy.mockResolvedValueOnce(ok({ versions: [v], total: 1001, offset: 0, limit: 50 }))
    expect(await listDocumentChunksPage("d1")).toMatchObject({ chunks: [chunk], total: 2500 })
    expect(await listDocumentTablesPage("d1")).toMatchObject({ tables: [table], total: 1200 })
    expect(await listDocumentImagesPage("d1")).toMatchObject({ images: [image], total: 1100 })
    expect(await fetchDocumentVersionsPage("d1")).toMatchObject({ versions: [v], total: 1001 })
  })

  it("a legacy array body claims no more than its own length", async () => {
    const chunk = { id: "c1", chunk_index: 0, content: "x" }
    fetchSpy.mockResolvedValue(ok([chunk]))
    expect(await listDocumentChunksPage("d1")).toEqual({ chunks: [chunk], total: 1, offset: 0, limit: 1 })
  })
})
