/**
 * Phase 294-05 Task 1 (DEC-03, D-15) — the citation-check client and its wire contract.
 *
 * The backend's own result fixture (`backend/tests/unit/fixtures/citation_check_result_v1.json`,
 * the copy the backend suites validate against) is read from SOURCE via `?raw`. A JSON import
 * would widen `verdict` to `string`, so `satisfies` cannot pin it at the type level; instead a
 * TYPED sample (checked by tsc against `CitationCheckResult`) and the backend fixture must carry
 * exactly the same keys at every level, and every fixture verdict must be a declared verdict.
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

import fixtureRaw from "../../../../../backend/tests/unit/fixtures/citation_check_result_v1.json?raw"
import {
  getCitationChecks,
  runCitationCheck,
  CitationCheckApiError,
  type CitationCheckResult,
} from "@/lib/api/citationChecks"
import { ApiError } from "@/lib/api/_core"
import { VERDICT_META } from "../citationVerdicts"

const FIXTURE = JSON.parse(fixtureRaw) as Record<string, unknown>

const SAMPLE: CitationCheckResult = {
  version: 1,
  engine: "openai_decisions",
  model: "gpt-6-luna",
  checked_at: "2026-10-20T12:00:00Z",
  claims: [{ ordinal: 0, n: 1, sentence: "s", verdict: "supported", confidence: 0.9 }],
  counts: { supported: 1, partly_supported: 0, not_supported: 0, contradicted: 0, couldnt_check: 0 },
  usage: { input_tokens: 10, cost_usd: 0.000001 },
}

const keys = (o: unknown) => Object.keys(o as Record<string, unknown>).sort()

const fetchMock = vi.fn()

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe("the result wire shape — the backend fixture and the typed sample agree", () => {
  it("NON-VACUITY — the fixture is version 1 with claims", () => {
    expect(FIXTURE.version).toBe(1)
    expect((FIXTURE.claims as unknown[]).length).toBeGreaterThanOrEqual(5)
  })

  it("top-level, claim, counts and usage keys are identical", () => {
    expect(keys(FIXTURE)).toEqual(keys(SAMPLE))
    for (const c of FIXTURE.claims as unknown[]) expect(keys(c)).toEqual(keys(SAMPLE.claims[0]))
    expect(keys(FIXTURE.counts)).toEqual(keys(SAMPLE.counts))
    expect(keys(FIXTURE.usage)).toEqual(keys(SAMPLE.usage))
  })

  it("every fixture verdict is a declared verdict, and the counts keys are the verdicts", () => {
    for (const c of FIXTURE.claims as { verdict: string }[]) {
      expect(Object.prototype.hasOwnProperty.call(VERDICT_META, c.verdict)).toBe(true)
    }
    expect(keys(FIXTURE.counts)).toEqual(keys(VERDICT_META))
  })
})

describe("getCitationChecks", () => {
  it("GETs one comma-joined list, each id encoded, with auth headers and the signal", async () => {
    const body = { availability: { available: true, engine: "jev", reason: null }, checks: {} }
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) })
    vi.stubGlobal("fetch", fetchMock)
    const ctl = new AbortController()
    const out = await getCitationChecks(["a", "b/c"], ctl.signal)
    expect(out).toBe(body)
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/citation-checks?message_ids=a,b%2Fc", {
      headers: { Authorization: "Bearer t" },
      signal: ctl.signal,
    })
  })

  it("throws a status-carrying ApiError on a non-ok answer", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, json: () => Promise.resolve({ detail: "bad" }) })
    vi.stubGlobal("fetch", fetchMock)
    const err = await getCitationChecks(["a"]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as InstanceType<typeof ApiError>).status).toBe(422)
  })
})

describe("runCitationCheck", () => {
  it("POSTs the encoded message path with auth headers and returns the result", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(SAMPLE) })
    vi.stubGlobal("fetch", fetchMock)
    const out = await runCitationCheck("x/y")
    expect(out).toBe(SAMPLE)
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/citation-checks/x%2Fy", {
      method: "POST",
      headers: { Authorization: "Bearer t" },
    })
  })

  it("a 409 carries the server reason and the detail object", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ detail: { reason: "in_flight" } }),
    })
    vi.stubGlobal("fetch", fetchMock)
    const err = await runCitationCheck("m").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toBeInstanceOf(CitationCheckApiError)
    const e = err as CitationCheckApiError
    expect(e.status).toBe(409)
    expect(e.reason).toBe("in_flight")
    expect(e.detail).toEqual({ reason: "in_flight" })
  })

  it("a 422 string detail has no reason; an unreadable body still throws with the status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ detail: "Only an assistant answer can be checked" }),
    })
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.reject(new Error("x")) })
    vi.stubGlobal("fetch", fetchMock)
    const a = (await runCitationCheck("m").catch((e: unknown) => e)) as CitationCheckApiError
    expect(a.status).toBe(422)
    expect(a.reason).toBeNull()
    expect(a.detail).toBe("Only an assistant answer can be checked")
    const b = (await runCitationCheck("m").catch((e: unknown) => e)) as CitationCheckApiError
    expect(b).toBeInstanceOf(ApiError)
    expect(b.status).toBe(500)
    expect(b.reason).toBeNull()
  })
})
