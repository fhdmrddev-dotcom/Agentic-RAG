/**
 * Phase 299-03 (D-06 / T-299-25) — the link resolver client.
 *
 * A 404 is the ONE answer for "you cannot open this" (missing and forbidden alike, 299-01), so it
 * becomes `{status: "cant"}`. Every other failure — a 500, a 401, a network error — THROWS, so the
 * gate can tell a missing item from an outage and never tells someone a working link is broken.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("../_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_core")>()
  return {
    ...actual,
    API_BASE: "http://api.test",
    getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer tok-299", "X-Org-Id": "org-a" }),
  }
})

import { resolveLink } from "../links"
import { ApiError } from "../_core"

const RUN = "c41d8e2a-1b2c-4d3e-8f9a-9e2d5b7f0a63"
const TARGET = {
  kind: "run",
  id: RUN,
  org_id: "org-b",
  org_name: "Acme Legal",
  title: "Contract review",
  state: null,
  audience: "only_you",
}

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe("resolveLink", () => {
  it("GETs /links/<kind>/<id> with the auth headers", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(TARGET), { status: 200 }))
    await resolveLink("run", RUN)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`http://api.test/links/run/${RUN}`)
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok-299" })
  })

  it("200 → {status: 'ok', target} with the server's fields", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(TARGET), { status: 200 }))
    await expect(resolveLink("run", RUN)).resolves.toEqual({ status: "ok", target: TARGET })
  })

  it("404 → {status: 'cant'} (missing and forbidden are one answer)", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: "Not found" }), { status: 404 }))
    await expect(resolveLink("workflow", RUN)).resolves.toEqual({ status: "cant" })
  })

  it.each([500, 503, 401, 403])("%i → throws ApiError (an outage is never 'can't be opened')", async (status) => {
    fetchMock.mockResolvedValue(new Response("{}", { status }))
    const err = await resolveLink("thread", RUN).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(status)
  })

  it("a network error throws ApiError too", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(resolveLink("expert", RUN)).rejects.toBeInstanceOf(ApiError)
  })

  it("the kind and id are URL-encoded path segments", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(TARGET), { status: 200 }))
    await resolveLink("expert", "a/b")
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/links/expert/a%2Fb")
  })
})
