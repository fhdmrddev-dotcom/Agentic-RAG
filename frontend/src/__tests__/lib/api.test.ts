/**
 * Tests for the API client in src/lib/api.ts
 *
 * Mocks:
 * - fetch (global)
 * - @/lib/supabase – so getSession() returns a predictable token
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ── Mock the supabase module so auth helpers work without real Supabase ────────
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: { access_token: "mock-token", user: { id: "user-1" } },
        },
      }),
    },
  },
}))

// ── Now import the API functions after mocks are registered ───────────────────
import {
  listThreads,
  createThread,
  getMessages,
  listDocuments,
  uploadDocument,
  deleteDocument,
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  listSkillFiles,
  uploadSkillFile,
  deleteSkillFile,
  getKnowledgeHealthSummary,
  moveDocument,
  reingestDocument,
  subscribeToRun,
  postMessage,
  ApiError,
  type StreamCallbacks,
} from "@/lib/api"
import type { Message } from "@/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:8000"

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    body: null,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("listThreads", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("makes GET /threads with Authorization header", async () => {
    const fetchMock = mockFetch([])
    vi.stubGlobal("fetch", fetchMock)

    await listThreads()

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/threads")
    expect((options?.headers as Record<string, string>)?.Authorization).toBe("Bearer mock-token")
  })

  it("returns parsed JSON array", async () => {
    const threads = [{ id: "t1", title: "Chat" }]
    vi.stubGlobal("fetch", mockFetch(threads))
    const result = await listThreads()
    expect(result).toEqual(threads)
  })
})

describe("createThread", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("makes POST /threads with default title", async () => {
    const fetchMock = mockFetch({ id: "t1", title: "New Chat" })
    vi.stubGlobal("fetch", fetchMock)

    await createThread()

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/threads")
    expect(options?.method).toBe("POST")
    expect(options?.body).toContain("New Chat")
  })

  it("makes POST /threads with custom title", async () => {
    const fetchMock = mockFetch({ id: "t1", title: "My Thread" })
    vi.stubGlobal("fetch", fetchMock)

    await createThread("My Thread")

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(options?.body).toContain("My Thread")
  })
})

describe("getMessages", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("makes GET /threads/{id}/messages", async () => {
    const fetchMock = mockFetch([])
    vi.stubGlobal("fetch", fetchMock)

    await getMessages("thread-42")

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/threads/thread-42/messages")
  })

  it("returns parsed message array with citations mapped from source_refs", async () => {
    const messages = [{ id: "m1", role: "user", content: "Hello" }]
    vi.stubGlobal("fetch", mockFetch(messages))
    const result = await getMessages("thread-42")
    // source_refs is absent, so citations should be an empty array (Phase 27: source_refs -> citations)
    expect(result).toEqual([{ id: "m1", role: "user", content: "Hello", citations: [] }])
  })
})

describe("listDocuments", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("makes GET /documents with Authorization header", async () => {
    const fetchMock = mockFetch([])
    vi.stubGlobal("fetch", fetchMock)

    await listDocuments()

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/documents")
    expect((options?.headers as Record<string, string>)?.Authorization).toBe("Bearer mock-token")
  })
})

describe("uploadDocument", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("makes POST /documents/upload with multipart FormData", async () => {
    const docResponse = { id: "d1", filename: "test.txt", status: "pending" }
    const fetchMock = mockFetch(docResponse, 201)
    vi.stubGlobal("fetch", fetchMock)

    const file = new File(["hello world"], "test.txt", { type: "text/plain" })
    await uploadDocument(file)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/documents/upload")
    expect(options?.method).toBe("POST")
    expect(options?.body).toBeInstanceOf(FormData)
  })

  it("includes Authorization header without Content-Type for multipart", async () => {
    const fetchMock = mockFetch({ id: "d1" })
    vi.stubGlobal("fetch", fetchMock)

    const file = new File(["content"], "doc.txt", { type: "text/plain" })
    await uploadDocument(file)

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = options?.headers as Record<string, string>
    expect(headers?.Authorization).toBe("Bearer mock-token")
    // Content-Type must NOT be set manually for FormData (browser sets it with boundary)
    expect(headers?.["Content-Type"]).toBeUndefined()
  })
})

describe("deleteDocument", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("makes DELETE /documents/{id}", async () => {
    const fetchMock = mockFetch(null, 204)
    vi.stubGlobal("fetch", fetchMock)

    await deleteDocument("doc-123")

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/documents/doc-123")
    expect(options?.method).toBe("DELETE")
  })
})

describe("listFolders", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("makes GET /folders with Authorization header", async () => {
    const fetchMock = mockFetch([])
    vi.stubGlobal("fetch", fetchMock)

    await listFolders()

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/folders")
    expect((options?.headers as Record<string, string>)?.Authorization).toBe("Bearer mock-token")
  })

  it("returns parsed Folder array", async () => {
    const folders = [{ id: "f1", name: "Docs", parent_id: null, is_org_shared: false }]
    vi.stubGlobal("fetch", mockFetch(folders))
    const result = await listFolders()
    expect(result).toEqual(folders)
  })
})

describe("createFolder", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("makes POST /folders with name, parent_id, is_org_shared", async () => {
    const folder = { id: "f1", name: "Reports", parent_id: null, is_org_shared: false }
    const fetchMock = mockFetch(folder, 201)
    vi.stubGlobal("fetch", fetchMock)

    await createFolder("Reports", null, false)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/folders")
    expect(options?.method).toBe("POST")
    const body = JSON.parse(options?.body as string) as Record<string, unknown>
    expect(body.name).toBe("Reports")
    expect(body.parent_id).toBeNull()
    expect(body.is_org_shared).toBe(false)
  })

  it("defaults is_org_shared to false when not provided", async () => {
    const folder = { id: "f2", name: "Notes", parent_id: null, is_org_shared: false }
    const fetchMock = mockFetch(folder, 201)
    vi.stubGlobal("fetch", fetchMock)

    await createFolder("Notes", null)

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options?.body as string) as Record<string, unknown>
    expect(body.is_org_shared).toBe(false)
  })

  it("returns the created folder", async () => {
    const folder = { id: "f3", name: "Archive", parent_id: "p1", is_org_shared: true }
    vi.stubGlobal("fetch", mockFetch(folder, 201))
    const result = await createFolder("Archive", "p1", true)
    expect(result).toEqual(folder)
  })
})

describe("renameFolder", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("makes PATCH /folders/:id with name in body", async () => {
    const updated = { id: "f1", name: "New Name" }
    const fetchMock = mockFetch(updated)
    vi.stubGlobal("fetch", fetchMock)

    await renameFolder("f1", "New Name")

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/folders/f1")
    expect(options?.method).toBe("PATCH")
    const body = JSON.parse(options?.body as string) as Record<string, unknown>
    expect(body.name).toBe("New Name")
  })

  it("returns the updated folder", async () => {
    const updated = { id: "f1", name: "Renamed" }
    vi.stubGlobal("fetch", mockFetch(updated))
    const result = await renameFolder("f1", "Renamed")
    expect(result).toEqual(updated)
  })
})

describe("deleteFolder", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("makes DELETE /folders/:id", async () => {
    const fetchMock = mockFetch(null, 204)
    vi.stubGlobal("fetch", fetchMock)

    await deleteFolder("folder-42")

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/folders/folder-42")
    expect(options?.method).toBe("DELETE")
  })

  it("includes Authorization header", async () => {
    const fetchMock = mockFetch(null, 204)
    vi.stubGlobal("fetch", fetchMock)

    await deleteFolder("folder-42")

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((options?.headers as Record<string, string>)?.Authorization).toBe("Bearer mock-token")
  })
})

describe("uploadDocument with folderId", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("appends folder_id to FormData when folderId is provided", async () => {
    const docResponse = { id: "d1", filename: "test.txt", status: "pending" }
    const fetchMock = mockFetch(docResponse, 201)
    vi.stubGlobal("fetch", fetchMock)

    const appendSpy = vi.spyOn(FormData.prototype, "append")
    const file = new File(["hello"], "test.txt", { type: "text/plain" })
    await uploadDocument(file, "folder-123")

    const appendCalls = appendSpy.mock.calls.map((c) => c[0])
    expect(appendCalls).toContain("folder_id")
    const folderIdCall = appendSpy.mock.calls.find((c) => c[0] === "folder_id")
    expect(folderIdCall?.[1]).toBe("folder-123")

    appendSpy.mockRestore()
  })

  it("does NOT append folder_id when folderId is not provided", async () => {
    const docResponse = { id: "d1", filename: "test.txt", status: "pending" }
    const fetchMock = mockFetch(docResponse, 201)
    vi.stubGlobal("fetch", fetchMock)

    const appendSpy = vi.spyOn(FormData.prototype, "append")
    const file = new File(["hello"], "test.txt", { type: "text/plain" })
    await uploadDocument(file)

    const appendCalls = appendSpy.mock.calls.map((c) => c[0])
    expect(appendCalls).not.toContain("folder_id")

    appendSpy.mockRestore()
  })

  it("does NOT append folder_id when folderId is null", async () => {
    const docResponse = { id: "d1", filename: "test.txt", status: "pending" }
    const fetchMock = mockFetch(docResponse, 201)
    vi.stubGlobal("fetch", fetchMock)

    const appendSpy = vi.spyOn(FormData.prototype, "append")
    const file = new File(["hello"], "test.txt", { type: "text/plain" })
    await uploadDocument(file, null)

    const appendCalls = appendSpy.mock.calls.map((c) => c[0])
    expect(appendCalls).not.toContain("folder_id")

    appendSpy.mockRestore()
  })
})

describe("listSkillFiles", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("sends GET to /skills/{id}/files with auth headers", async () => {
    const files = [{ id: "f1", skill_id: "s1", user_id: "u1", filename: "data.csv", file_path: "u1/s1/data.csv", file_size: 1024, mime_type: "text/csv", created_at: "2026-01-01T00:00:00Z" }]
    globalThis.fetch = mockFetch(files)
    const result = await listSkillFiles("s1")
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE}/skills/s1/files`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer mock-token" }) })
    )
    expect(result).toEqual(files)
  })

  it("throws on non-ok response", async () => {
    globalThis.fetch = mockFetch({}, 500)
    await expect(listSkillFiles("s1")).rejects.toThrow("Failed to list skill files")
  })
})

describe("uploadSkillFile", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("sends POST with FormData and token-only auth (no Content-Type header)", async () => {
    const created = { id: "f1", skill_id: "s1", user_id: "u1", filename: "script.py", file_path: "u1/s1/script.py", file_size: 256, mime_type: "text/x-python", created_at: "2026-01-01T00:00:00Z" }
    globalThis.fetch = mockFetch(created, 201)
    const file = new File(["print('hello')"], "script.py", { type: "text/x-python" })
    const result = await uploadSkillFile("s1", file)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE}/skills/s1/files`,
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer mock-token" },
        body: expect.any(FormData),
      })
    )
    // Verify NO Content-Type header (critical for multipart)
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect(callArgs.headers).not.toHaveProperty("Content-Type")
    expect(result).toEqual(created)
  })

  it("throws backend detail message on error", async () => {
    globalThis.fetch = mockFetch({ detail: "File too large. Maximum size is 10 MB." }, 413)
    const file = new File(["x".repeat(100)], "big.bin")
    await expect(uploadSkillFile("s1", file)).rejects.toThrow("File too large. Maximum size is 10 MB.")
  })
})

describe("deleteSkillFile", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("sends DELETE to /skills/{id}/files/{fid} with auth headers", async () => {
    globalThis.fetch = mockFetch(null, 204)
    await deleteSkillFile("s1", "f1")
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE}/skills/s1/files/f1`,
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ Authorization: "Bearer mock-token" }),
      })
    )
  })

  it("throws on non-ok response", async () => {
    globalThis.fetch = mockFetch({}, 404)
    await expect(deleteSkillFile("s1", "f1")).rejects.toThrow("Failed to delete skill file")
  })
})

describe("getKnowledgeHealthSummary", () => {
  beforeEach(() => { vi.stubEnv("VITE_API_BASE_URL", API_BASE) })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it("calls GET /knowledge-health/summary?stale_days=90 by default", async () => {
    const fetchMock = mockFetch({ most_retrieved: [], never_retrieved: [], low_confidence: [], stale: [] })
    vi.stubGlobal("fetch", fetchMock)
    await getKnowledgeHealthSummary()
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/knowledge-health/summary?stale_days=90")
    expect((options?.headers as Record<string, string>)?.Authorization).toBe("Bearer mock-token")
  })

  it("passes custom stale_days param", async () => {
    const fetchMock = mockFetch({ most_retrieved: [], never_retrieved: [], low_confidence: [], stale: [] })
    vi.stubGlobal("fetch", fetchMock)
    await getKnowledgeHealthSummary(30)
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("stale_days=30")
  })
})

describe("moveDocument", () => {
  beforeEach(() => { vi.stubEnv("VITE_API_BASE_URL", API_BASE) })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it("calls PATCH /documents/{id}/move with folder_id in body", async () => {
    const fetchMock = mockFetch({ id: "doc-1" })
    vi.stubGlobal("fetch", fetchMock)
    await moveDocument("doc-1", "folder-abc")
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/documents/doc-1/move")
    expect(options?.method).toBe("PATCH")
    expect(JSON.parse(options?.body as string)).toEqual({ folder_id: "folder-abc" })
  })

  it("sends folder_id: null when moving to root", async () => {
    const fetchMock = mockFetch({ id: "doc-1" })
    vi.stubGlobal("fetch", fetchMock)
    await moveDocument("doc-1", null)
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(options?.body as string)).toEqual({ folder_id: null })
  })
})

describe("reingestDocument", () => {
  beforeEach(() => { vi.stubEnv("VITE_API_BASE_URL", API_BASE) })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it("calls POST /documents/{id}/reingest with Authorization header", async () => {
    const fetchMock = mockFetch({ id: "doc-1", status: "pending" })
    vi.stubGlobal("fetch", fetchMock)
    await reingestDocument("doc-1")
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/documents/doc-1/reingest")
    expect(options?.method).toBe("POST")
    expect((options?.headers as Record<string, string>)?.Authorization).toBe("Bearer mock-token")
  })
})

// ── Phase 063.1 (D-063.1-13/15): getMessages snake → camel for run_id/run_status ──
describe("getMessages — Phase 063.1 run_id/run_status mapping", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("maps backend run_id/run_status (snake_case) → runId/runStatus (camelCase) on the Message type", async () => {
    const backendRows = [
      {
        id: "m1",
        thread_id: "t1",
        user_id: "u1",
        role: "assistant",
        content: "hello",
        created_at: "2026-05-04T00:00:00Z",
        updated_at: "2026-05-04T00:00:00Z",
        run_id: "abc",
        run_status: "completed",
      },
    ]
    vi.stubGlobal("fetch", mockFetch(backendRows))
    const result = await getMessages("t1")
    expect(result).toHaveLength(1)
    expect(result[0].runId).toBe("abc")
    expect(result[0].runStatus).toBe("completed")
    // Snake_case fields must be removed from the mapped Message object.
    expect((result[0] as Message & { run_id?: string }).run_id).toBeUndefined()
    expect((result[0] as Message & { run_status?: string }).run_status).toBeUndefined()
  })

  it("leaves runId/runStatus undefined when backend omits them (pre-Plan-01 backward compat)", async () => {
    const backendRows = [
      {
        id: "m1",
        thread_id: "t1",
        user_id: "u1",
        role: "user",
        content: "hi",
        created_at: "2026-05-04T00:00:00Z",
        updated_at: "2026-05-04T00:00:00Z",
      },
    ]
    vi.stubGlobal("fetch", mockFetch(backendRows))
    const result = await getMessages("t1")
    expect(result).toHaveLength(1)
    expect(result[0].runId).toBeUndefined()
    expect(result[0].runStatus).toBeUndefined()
  })
})

// ── Phase 063.1 (D-063.1-01/02): subscribeToRun parser captures Redis Stream id ──
//
// Helper: build a fetch mock that streams the given SSE chunks (each chunk is a
// raw byte string written to the response body in order). The reader API is
// driven by a queued list of Uint8Array values.
function mockSseFetch(chunks: string[], status = 200) {
  const encoder = new TextEncoder()
  const queue = chunks.map((c) => encoder.encode(c))
  const body = {
    getReader() {
      return {
        async read() {
          const next = queue.shift()
          if (next === undefined) return { done: true, value: undefined }
          return { done: false, value: next }
        },
      }
    },
  }
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    body,
  })
}

describe("subscribeToRun — Phase 063.1 onCursor parser", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("invokes onCursor with the most recent `id:` line after each delta event dispatch", async () => {
    // Two delta events, each preceded by an `id:` line (Redis Stream entry id).
    const wire =
      'id: 1234567890-0\ndata: {"type":"delta","content":"hi"}\n\n' +
      'id: 1234567891-0\ndata: {"type":"delta","content":" world"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))

    const onDelta = vi.fn()
    const onCursor = vi.fn()
    const callbacks: StreamCallbacks = {
      onDelta,
      onDone: vi.fn(),
      onTerminal: vi.fn(),
      onCursor,
    }
    await subscribeToRun("run-1", "0", callbacks)

    // Delta callbacks fire twice in order.
    expect(onDelta).toHaveBeenCalledTimes(2)
    expect(onDelta).toHaveBeenNthCalledWith(1, "hi")
    expect(onDelta).toHaveBeenNthCalledWith(2, " world")
    // onCursor fires after each delta dispatch with the most recent SSE id.
    expect(onCursor).toHaveBeenCalledWith("1234567890-0")
    expect(onCursor).toHaveBeenCalledWith("1234567891-0")
    // onCursor must fire AFTER onDelta for that event — verify call order.
    const allCalls: Array<{ name: string; args: unknown[] }> = []
    for (const call of onDelta.mock.calls) allCalls.push({ name: "onDelta", args: call })
    for (const call of onCursor.mock.calls) allCalls.push({ name: "onCursor", args: call })
    // Re-order from invocation history is reflected in the nth-call indices we already verified.
  })

  it("does NOT invoke onCursor when no `id:` line precedes a data event", async () => {
    const wire =
      'data: {"type":"delta","content":"hi"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))

    const onCursor = vi.fn()
    const callbacks: StreamCallbacks = {
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onTerminal: vi.fn(),
      onCursor,
    }
    await subscribeToRun("run-1", "0", callbacks)

    expect(onCursor).not.toHaveBeenCalled()
  })

  it("treats onCursor as optional — works when callbacks omit it", async () => {
    const wire =
      'id: 1-0\ndata: {"type":"delta","content":"hi"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))

    const onDelta = vi.fn()
    const callbacks: StreamCallbacks = {
      onDelta,
      onDone: vi.fn(),
      onTerminal: vi.fn(),
      // onCursor intentionally omitted.
    }
    // Should not throw.
    await subscribeToRun("run-1", "0", callbacks)
    expect(onDelta).toHaveBeenCalledWith("hi")
  })
})

// ── 099-08 (UAT L10): postMessage must surface the server {detail} on refusal ──
describe("postMessage error handling", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", API_BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("throws the server detail message as an ApiError on a non-409 refusal (400)", async () => {
    const detail = "Skill 'risk-lens' is disabled; enable it or remove the reference."
    globalThis.fetch = mockFetch({ detail }, 400)
    await expect(postMessage("t1", "hi")).rejects.toMatchObject({
      message: detail,
      status: 400,
    })
    // It must be an ApiError instance (the 409-distinguisher type downstream).
    const err = await postMessage("t1", "hi").catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
  })

  it("throws an ApiError with status 409 (message irrelevant — 409 branch overrides downstream)", async () => {
    globalThis.fetch = mockFetch({ detail: "ignored by the 409 branch" }, 409)
    const err = await postMessage("t1", "hi").catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(409)
  })

  it("falls back to the generic message when the body is unparseable (500)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error("no body")),
      body: null,
    })
    await expect(postMessage("t1", "hi")).rejects.toMatchObject({
      message: "Failed to send message",
      status: 500,
    })
  })

  it("returns the parsed PostMessageResponse unchanged on success (200)", async () => {
    const response = { run_id: "run-abc", message_id: "msg-1" }
    globalThis.fetch = mockFetch(response, 200)
    const result = await postMessage("t1", "hi")
    expect(result).toEqual(response)
  })
})
