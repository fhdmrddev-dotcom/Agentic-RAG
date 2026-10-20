/**
 * Phase 294-05 Task 1 (D-15, T-294-28) — the citation-check store.
 *
 * One GET per thread view: every `ensure(id)` in the same tick joins ONE request (chunked at the
 * server's 100-id cap), and an id already loaded or queued never asks again. `run(id)` is the only
 * POST, and it never hides a stored result when it fails.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"

const api = vi.hoisted(() => ({ getCitationChecks: vi.fn(), runCitationCheck: vi.fn() }))
vi.mock("@/lib/api/citationChecks", () => api)

import {
  useCitationCheckStore,
  useCitationCheck,
  resetCitationChecks,
} from "@/stores/citationCheckStore"
import type { CitationCheckResult } from "@/lib/api/citationChecks"

const RESULT: CitationCheckResult = {
  version: 1,
  engine: "jev",
  model: "typesafe/jev-1.14",
  checked_at: "2026-10-20T12:00:00Z",
  claims: [{ ordinal: 0, n: 1, sentence: "s", verdict: "contradicted", confidence: 0.87 }],
  counts: { supported: 0, partly_supported: 0, not_supported: 0, contradicted: 1, couldnt_check: 0 },
  usage: { input_tokens: 10, cost_usd: 0.00001 },
}
const AVAILABLE = { available: true, engine: "jev", reason: null } as const

/** Let the queued microtask flush and the mocked request settle (a few macrotasks: the store
 *  loads its client with a dynamic import, which beforeAll pre-warms). */
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}

beforeAll(async () => {
  await import("@/lib/api/citationChecks")
})

afterEach(() => {
  api.getCitationChecks.mockReset()
  api.runCitationCheck.mockReset()
  resetCitationChecks()
})

describe("ensure — microtask-batched GET", () => {
  it("three ensure() calls in one tick make exactly one GET with the three ids", async () => {
    api.getCitationChecks.mockResolvedValue({ availability: AVAILABLE, checks: { b: RESULT } })
    const { ensure } = useCitationCheckStore.getState()
    ensure("a")
    ensure("b")
    ensure("c")
    expect(api.getCitationChecks).not.toHaveBeenCalled()
    await settle()
    expect(api.getCitationChecks).toHaveBeenCalledTimes(1)
    expect(api.getCitationChecks.mock.calls[0][0]).toEqual(["a", "b", "c"])
    const s = useCitationCheckStore.getState()
    expect(s.byMessage.b).toEqual(RESULT)
    expect(s.availability).toEqual(AVAILABLE)
  })

  it("an id already loaded or already queued asks nothing more", async () => {
    api.getCitationChecks.mockResolvedValue({ availability: AVAILABLE, checks: {} })
    const { ensure } = useCitationCheckStore.getState()
    ensure("a")
    ensure("a")
    await settle()
    expect(api.getCitationChecks).toHaveBeenCalledTimes(1)
    expect(api.getCitationChecks.mock.calls[0][0]).toEqual(["a"])
    ensure("a")
    await settle()
    expect(api.getCitationChecks).toHaveBeenCalledTimes(1)
  })

  it("more than 100 ids are split into requests of at most 100", async () => {
    api.getCitationChecks.mockResolvedValue({ availability: AVAILABLE, checks: {} })
    const { ensure } = useCitationCheckStore.getState()
    for (let i = 0; i < 150; i++) ensure(`id-${i}`)
    await settle()
    expect(api.getCitationChecks).toHaveBeenCalledTimes(2)
    expect(api.getCitationChecks.mock.calls[0][0]).toHaveLength(100)
    expect(api.getCitationChecks.mock.calls[1][0]).toHaveLength(50)
  })

  it("a failed GET lets a later ensure() ask again", async () => {
    api.getCitationChecks.mockRejectedValueOnce(new Error("down"))
    api.getCitationChecks.mockResolvedValueOnce({ availability: AVAILABLE, checks: {} })
    useCitationCheckStore.getState().ensure("a")
    await settle()
    expect(useCitationCheckStore.getState().availability).toBeNull()
    useCitationCheckStore.getState().ensure("a")
    await settle()
    expect(api.getCitationChecks).toHaveBeenCalledTimes(2)
    expect(useCitationCheckStore.getState().availability).toEqual(AVAILABLE)
  })
})

describe("run — the one POST", () => {
  it("sets inFlight, stores the result and clears inFlight", async () => {
    let resolve: (r: CitationCheckResult) => void = () => {}
    api.runCitationCheck.mockReturnValue(new Promise<CitationCheckResult>((r) => (resolve = r)))
    const p = useCitationCheckStore.getState().run("m")
    await Promise.resolve()
    expect(useCitationCheckStore.getState().inFlight.m).toBe(true)
    resolve(RESULT)
    await p
    const s = useCitationCheckStore.getState()
    expect(api.runCitationCheck).toHaveBeenCalledWith("m")
    expect(s.byMessage.m).toEqual(RESULT)
    expect(s.inFlight.m).toBeUndefined()
    expect(s.errors.m).toBeUndefined()
  })

  it("an error records a code, clears inFlight and keeps the stored result", async () => {
    useCitationCheckStore.setState({ byMessage: { m: RESULT } })
    api.runCitationCheck.mockRejectedValue(Object.assign(new Error("409"), { status: 409, reason: "in_flight" }))
    await useCitationCheckStore.getState().run("m")
    const s = useCitationCheckStore.getState()
    expect(s.errors.m).toBe("in_flight")
    expect(s.inFlight.m).toBeUndefined()
    expect(s.byMessage.m).toEqual(RESULT)
  })

  it("294-REVIEW CR-01 — a 503 engine_failed records that code and keeps the stored result", async () => {
    useCitationCheckStore.setState({ byMessage: { m: RESULT } })
    api.runCitationCheck.mockRejectedValue(Object.assign(new Error("503"), { status: 503, reason: "engine_failed" }))
    await useCitationCheckStore.getState().run("m")
    const s = useCitationCheckStore.getState()
    expect(s.errors.m).toBe("engine_failed")
    expect(s.inFlight.m).toBeUndefined()
    expect(s.byMessage.m).toBe(RESULT)
  })

  it("error codes: 404 → not_found, 422 → rejected, anything else → failed", async () => {
    api.runCitationCheck.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 404, reason: null }))
    await useCitationCheckStore.getState().run("a")
    api.runCitationCheck.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 422, reason: null }))
    await useCitationCheckStore.getState().run("b")
    api.runCitationCheck.mockRejectedValueOnce(new Error("network"))
    await useCitationCheckStore.getState().run("c")
    expect(useCitationCheckStore.getState().errors).toEqual({ a: "not_found", b: "rejected", c: "failed" })
  })
})

describe("useCitationCheck and reset", () => {
  it("returns the same null across renders when nothing is stored, and null for no id", () => {
    const { result, rerender } = renderHook(({ id }: { id: string | undefined }) => useCitationCheck(id), {
      initialProps: { id: "zz" as string | undefined },
    })
    const first = result.current
    rerender({ id: "zz" })
    expect(first).toBeNull()
    expect(result.current).toBe(first)
    rerender({ id: undefined })
    expect(result.current).toBeNull()
  })

  it("returns the stored result", () => {
    useCitationCheckStore.setState({ byMessage: { m: RESULT } })
    const { result } = renderHook(() => useCitationCheck("m"))
    expect(result.current).toEqual(RESULT)
  })

  it("reset empties the state and forgets what was requested", async () => {
    api.getCitationChecks.mockResolvedValue({ availability: AVAILABLE, checks: { a: RESULT } })
    useCitationCheckStore.getState().ensure("a")
    await settle()
    resetCitationChecks()
    const s = useCitationCheckStore.getState()
    expect(s.byMessage).toEqual({})
    expect(s.availability).toBeNull()
    useCitationCheckStore.getState().ensure("a")
    await settle()
    expect(api.getCitationChecks).toHaveBeenCalledTimes(2)
  })

  it("a saved Settings change forgets the old availability, so the next view asks again", async () => {
    const OFF = { available: false, engine: null, reason: "rerank_off" } as const
    api.getCitationChecks.mockResolvedValueOnce({ availability: AVAILABLE, checks: { a: RESULT } })
    api.getCitationChecks.mockResolvedValueOnce({ availability: OFF, checks: { a: RESULT } })
    useCitationCheckStore.getState().ensure("a")
    await settle()
    window.dispatchEvent(new Event("agentic:settings-saved"))
    expect(useCitationCheckStore.getState().availability).toBeNull()
    useCitationCheckStore.getState().ensure("a")
    await settle()
    expect(api.getCitationChecks).toHaveBeenCalledTimes(2)
    expect(useCitationCheckStore.getState().availability).toEqual(OFF)
    expect(useCitationCheckStore.getState().byMessage.a).toEqual(RESULT)
  })
})
