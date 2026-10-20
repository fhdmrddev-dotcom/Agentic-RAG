/**
 * Phase 289-04 Task 1 — the evidence client. Every refusal is a 404 server-side (D-05), and
 * the report words a 404 differently from any other failure, so the status must survive.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/_core", () => {
  class ApiError extends Error {
    readonly status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
      this.name = "ApiError"
    }
  }
  return {
    API_BASE: "http://api.test",
    ApiError,
    getAuthHeaders: () => Promise.resolve({ Authorization: "Bearer t" }),
  }
})

import { getRunEvidence } from "./runEvidence"
import { ApiError } from "./_core"

const fetchMock = vi.fn()

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe("getRunEvidence", () => {
  it("fetches the encoded evidence path with auth headers and returns the body", async () => {
    const body = { run: { id: "r" } }
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) })
    vi.stubGlobal("fetch", fetchMock)
    const ctl = new AbortController()
    const out = await getRunEvidence("a/b", ctl.signal)
    expect(out).toBe(body)
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/workflow-runs/a%2Fb/evidence", {
      headers: { Authorization: "Bearer t" },
      signal: ctl.signal,
    })
  })

  it.each([404, 500])("throws ApiError carrying status %s", async (status) => {
    fetchMock.mockResolvedValue({ ok: false, status, json: () => Promise.resolve({ detail: "Run not found" }) })
    vi.stubGlobal("fetch", fetchMock)
    const err = await getRunEvidence("r").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as InstanceType<typeof ApiError>).status).toBe(status)
  })
})
