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
} from "@/lib/api"

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

  it("returns parsed message array", async () => {
    const messages = [{ id: "m1", role: "user", content: "Hello" }]
    vi.stubGlobal("fetch", mockFetch(messages))
    const result = await getMessages("thread-42")
    expect(result).toEqual(messages)
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
