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
    const folders = [{ id: "f1", name: "Docs", parent_id: null, is_global: false }]
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

  it("makes POST /folders with name, parent_id, is_global", async () => {
    const folder = { id: "f1", name: "Reports", parent_id: null, is_global: false }
    const fetchMock = mockFetch(folder, 201)
    vi.stubGlobal("fetch", fetchMock)

    await createFolder("Reports", null, false)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/folders")
    expect(options?.method).toBe("POST")
    const body = JSON.parse(options?.body as string) as Record<string, unknown>
    expect(body.name).toBe("Reports")
    expect(body.parent_id).toBeNull()
    expect(body.is_global).toBe(false)
  })

  it("defaults is_global to false when not provided", async () => {
    const folder = { id: "f2", name: "Notes", parent_id: null, is_global: false }
    const fetchMock = mockFetch(folder, 201)
    vi.stubGlobal("fetch", fetchMock)

    await createFolder("Notes", null)

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options?.body as string) as Record<string, unknown>
    expect(body.is_global).toBe(false)
  })

  it("returns the created folder", async () => {
    const folder = { id: "f3", name: "Archive", parent_id: "p1", is_global: true }
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
