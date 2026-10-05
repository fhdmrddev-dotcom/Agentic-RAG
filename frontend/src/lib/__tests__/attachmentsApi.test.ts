/**
 * Phase 274 plan 03 Task 1 (D-05 / D-21 / SC#1 / D-12) — the attachment wire layer.
 *
 * Three facts, each a request shape:
 *   1. The composer's upload opts into thread-life with `?lifetime=thread`; the panel and the
 *      workflow-launch doors call with no third argument and send a BYTE-IDENTICAL request (D-21).
 *   2. The cloud attach carries `X-Org-Id` — it sent only a bearer, and `get_active_org_id`
 *      answers 400 to a caller in two orgs with no header (dependencies.py:908).
 *   3. The promote / preview / library-links clients speak 274-02's contract verbatim, and a
 *      refusal surfaces the SERVER's sentence plus its status, never a paraphrase.
 *
 * `_core` is stubbed so the auth headers are a known value (including the org hint) and nothing
 * touches a real Supabase session.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: "Bearer tok",
  "X-Org-Id": "org-active",
}

vi.mock("../api/_core", () => ({
  API_BASE: "http://api.test",
  getAuthHeaders: async () => ({ ...AUTH_HEADERS }),
  getAuthToken: async () => "tok",
}))

import { attachConnectionFileToThread, uploadWorkspaceTemplate } from "../api/documents"
import {
  PromoteError,
  getLibraryLinks,
  getPromotePreview,
  promoteAttachment,
} from "../api/attachments"

const ROW = { file_id: "wf-1", path: "1a2b3c4d-a.xlsx", size_bytes: 10, mime_type: "x" }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe("uploadWorkspaceTemplate — the thread-life opt-in (D-05 / D-21)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(json(ROW, 201))
    vi.stubGlobal("fetch", fetchSpy)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("with no lifetime argument posts to /workspace/files with NO query string (the 24h doors)", async () => {
    const out = await uploadWorkspaceTemplate("t", new File(["x"], "a.xlsx"))
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://api.test/threads/t/workspace/files")
    expect(url).not.toContain("?")
    expect(init.headers).toEqual({ Authorization: "Bearer tok" })
    expect(out.id).toBe("wf-1")
  })

  it('with "thread" posts to /workspace/files?lifetime=thread, still with NO Content-Type', async () => {
    const out = await uploadWorkspaceTemplate("t", new File(["x"], "a.xlsx"), "thread")
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://api.test/threads/t/workspace/files?lifetime=thread")
    expect(init.headers).toEqual({ Authorization: "Bearer tok" })
    expect(init.body).toBeInstanceOf(FormData)
    expect(out.id).toBe("wf-1")
  })
})

describe("attachConnectionFileToThread — the org header (SC#1 cloud half)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("sends X-Org-Id (the active org), the bearer and JSON content type", async () => {
    fetchSpy.mockResolvedValue(json(ROW, 201))
    const out = await attachConnectionFileToThread("t", "conn-1", "drive-file-1")
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://api.test/threads/t/workspace/files/from-connection")
    expect(init.headers).toEqual(AUTH_HEADERS)
    expect(JSON.parse(init.body as string)).toEqual({ connection_id: "conn-1", file_id: "drive-file-1" })
    expect(out.id).toBe("wf-1")
  })

  it("still unwraps a plain string detail verbatim", async () => {
    fetchSpy.mockResolvedValue(json({ detail: "This connection is disabled" }, 409))
    await expect(attachConnectionFileToThread("t", "c", "f")).rejects.toThrow(
      "This connection is disabled",
    )
  })

  it("still unwraps a {reason_code, message} detail", async () => {
    fetchSpy.mockResolvedValue(json({ detail: { reason_code: "x", message: "Turned off" } }, 409))
    await expect(attachConnectionFileToThread("t", "c", "f")).rejects.toThrow("Turned off")
  })
})

describe("promoteAttachment — POST .../promote (D-12 / D-13)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
  })
  afterEach(() => vi.unstubAllGlobals())

  const SAVED = {
    outcome: "saved",
    document_id: "doc-1",
    folder_id: "f7",
    document_status: "pending",
    filename: "Meridian-Q4-pricing.xlsx",
    version_number: 2,
  }

  it("posts exactly {folder_id} with the auth headers (X-Org-Id present)", async () => {
    fetchSpy.mockResolvedValue(json(SAVED, 201))
    await promoteAttachment("t", "wf-1", "f7")
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://api.test/threads/t/workspace/files/wf-1/promote")
    expect(init.method).toBe("POST")
    expect(init.headers).toEqual(AUTH_HEADERS)
    expect(init.body).toBe(JSON.stringify({ folder_id: "f7" }))
  })

  it('201 → outcome "saved"', async () => {
    fetchSpy.mockResolvedValue(json(SAVED, 201))
    const out = await promoteAttachment("t", "wf-1", "f7")
    expect(out.outcome).toBe("saved")
    expect(out.document_id).toBe("doc-1")
  })

  it('200 → outcome "already", carrying the EXISTING copy\'s folder', async () => {
    fetchSpy.mockResolvedValue(json({ ...SAVED, outcome: "already", folder_id: "f4" }, 200))
    const out = await promoteAttachment("t", "wf-1", "f6")
    expect(out.outcome).toBe("already")
    expect(out.folder_id).toBe("f4")
  })

  it("403 → PromoteError with status 403 and the server sentence VERBATIM", async () => {
    fetchSpy.mockResolvedValue(json({ detail: "Cannot upload to a folder you do not own" }, 403))
    const err = await promoteAttachment("t", "wf-1", "f8").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PromoteError)
    expect((err as PromoteError).status).toBe(403)
    expect((err as PromoteError).message).toBe("Cannot upload to a folder you do not own")
  })

  it("a {detail:{message}} body is unwrapped", async () => {
    fetchSpy.mockResolvedValue(json({ detail: { reason_code: "x", message: "Folder not found" } }, 404))
    const err = await promoteAttachment("t", "wf-1", "gone").catch((e: unknown) => e)
    expect((err as PromoteError).status).toBe(404)
    expect((err as PromoteError).message).toBe("Folder not found")
  })

  it("a non-JSON error body falls back to a generic sentence, still carrying the status", async () => {
    fetchSpy.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }))
    const err = await promoteAttachment("t", "wf-1", "f7").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PromoteError)
    expect((err as PromoteError).status).toBe(502)
    expect((err as PromoteError).message.length).toBeGreaterThan(0)
    expect((err as PromoteError).message).not.toContain("<html>")
  })
})

describe("getPromotePreview — GET .../promote-preview?folder_id=", () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("GETs with the folder id as a query parameter and returns the parsed body", async () => {
    const preview = {
      promotable: true,
      refusal: null,
      filename: "Meridian-Q4-pricing.xlsx",
      duplicate_of: null,
      next_version: 2,
    }
    fetchSpy.mockResolvedValue(json(preview))
    const out = await getPromotePreview("t", "wf-1", "f7")
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://api.test/threads/t/workspace/files/wf-1/promote-preview?folder_id=f7")
    expect(init.headers).toEqual(AUTH_HEADERS)
    expect(out).toEqual(preview)
  })

  it("non-ok → PromoteError with the status", async () => {
    fetchSpy.mockResolvedValue(json({ detail: "File not found" }, 404))
    const err = await getPromotePreview("t", "wf-1", "f7").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PromoteError)
    expect((err as PromoteError).status).toBe(404)
    expect((err as PromoteError).message).toBe("File not found")
  })
})

describe("getLibraryLinks — GET .../library-links", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("returns {files: [...]}", async () => {
    const body = {
      files: [
        {
          workspace_file_id: "wf-1",
          promotable: true,
          link: {
            document_id: "doc-1",
            outcome: "saved",
            folder_id: "f7",
            document_status: "completed",
            filename: "Meridian-Q4-pricing.xlsx",
          },
        },
        { workspace_file_id: "wf-2", promotable: false, link: null },
      ],
    }
    const fetchSpy = vi.fn().mockResolvedValue(json(body))
    vi.stubGlobal("fetch", fetchSpy)
    const out = await getLibraryLinks("t")
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://api.test/threads/t/workspace/library-links")
    expect(init.headers).toEqual(AUTH_HEADERS)
    expect(out).toEqual(body)
  })
})
