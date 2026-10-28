/**
 * Phase 298-01 (D-29 / D-07) — a Root upload carries the active org.
 *
 * The server mints a Root upload (no folder) in the VALIDATED active org, so the document lands
 * in the org whose Root list will show it. That only works if the upload request says which org
 * is active: `uploadDocument` builds its own headers (multipart — no `getAuthHeaders`, whose
 * `Content-Type: application/json` would break the boundary), so before 298 it sent NO
 * `X-Org-Id` and the server always fell back to the trigger's guess.
 *
 * Pinned here:
 *   - the header is `getActiveOrgId()` at SEND time when one is set, and absent when it is null;
 *   - no `Content-Type` is ever set (the browser writes the multipart boundary).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("../_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_core")>()
  return {
    ...actual,
    API_BASE: "http://api.test",
    getAuthToken: async () => "tok",
  }
})

import { setActiveOrgId } from "../_core"
import { uploadDocument } from "../documents"

function okResponse() {
  return new Response(JSON.stringify({ id: "d1" }), { status: 201 })
}

function headersOf(spy: ReturnType<typeof vi.fn>): Record<string, string> {
  const init = spy.mock.calls[0][1] as RequestInit
  return init.headers as Record<string, string>
}

describe("298-01 — uploadDocument sends the active org (D-29)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchSpy)
  })

  afterEach(() => {
    setActiveOrgId(null)
    vi.unstubAllGlobals()
  })

  it("sends X-Org-Id = getActiveOrgId() when an org is active", async () => {
    setActiveOrgId("org-b")
    await uploadDocument(new File(["x"], "a.txt", { type: "text/plain" }))
    const headers = headersOf(fetchSpy)
    expect(headers["X-Org-Id"]).toBe("org-b")
    expect(headers.Authorization).toBe("Bearer tok")
  })

  it("reads the org at send time, not at module load", async () => {
    setActiveOrgId("org-a")
    setActiveOrgId("org-c")
    await uploadDocument(new File(["x"], "a.txt"), "folder-1")
    expect(headersOf(fetchSpy)["X-Org-Id"]).toBe("org-c")
  })

  it("omits the header when no org is active", async () => {
    setActiveOrgId(null)
    await uploadDocument(new File(["x"], "a.txt"))
    expect("X-Org-Id" in headersOf(fetchSpy)).toBe(false)
  })

  it("never sets a Content-Type (the multipart boundary is the browser's)", async () => {
    setActiveOrgId("org-b")
    await uploadDocument(new File(["x"], "a.txt"))
    const keys = Object.keys(headersOf(fetchSpy)).map((k) => k.toLowerCase())
    expect(keys).not.toContain("content-type")
  })
})
