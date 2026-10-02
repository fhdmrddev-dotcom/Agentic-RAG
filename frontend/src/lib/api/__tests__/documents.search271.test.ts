/**
 * Phase 271-03 Task 1 (FIND-01 / D-03) — the Find client call.
 *
 * `searchDocuments` POSTs the Find body to `/document-search` and fails with a
 * STATUS-CARRYING error, so a 422 (a refused condition) can be told apart from a network
 * failure. `_core` is stubbed so the auth headers are a known value and nothing touches the
 * real Supabase session.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("../_core", () => ({
  API_BASE: "http://api.test",
  getAuthHeaders: async () => ({ Authorization: "Bearer tok", "Content-Type": "application/json" }),
  getAuthToken: async () => "tok",
}))

import type { DocumentSearchRequest, DocumentSearchResponse } from "@/types"
import { DocumentSearchError, searchDocuments } from "../documents"

const body: DocumentSearchRequest = {
  filter_expr: { op: "and", conditions: [] },
  name: "acme",
  folder: null,
  added_by: null,
  dates: [],
  relationship: null,
  version: "latest",
  sort: "added_desc",
  offset: 0,
  limit: 25,
}

const response: DocumentSearchResponse = {
  documents: [],
  total: 0,
  older_matches: 0,
  sort: "added_desc",
  offset: 0,
  limit: 25,
}

describe("searchDocuments", () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("POSTs the body as JSON to /document-search with the auth headers", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))
    const out = await searchDocuments(body)
    expect(out).toEqual(response)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://api.test/document-search")
    expect(init.method).toBe("POST")
    expect(init.headers).toEqual({ Authorization: "Bearer tok", "Content-Type": "application/json" })
    expect(JSON.parse(init.body as string)).toEqual(body)
  })

  it("rejects a 422 with a DocumentSearchError carrying status 422", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ detail: "bad" }), { status: 422 }))
    const err = await searchDocuments(body).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DocumentSearchError)
    expect((err as DocumentSearchError).status).toBe(422)
    expect((err as DocumentSearchError).message).toBe("Couldn't run this search.")
  })

  it("rejects a network failure with status 'network'", async () => {
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"))
    const err = await searchDocuments(body).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DocumentSearchError)
    expect((err as DocumentSearchError).status).toBe("network")
  })
})
