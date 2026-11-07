/**
 * Phase 308.1-04 Task 2 (BUG-261107-01; D-03, D-19, D-21, D-24; UI-SPEC State machine + rules
 * 1-9) — the publish attempt state machine, driven with INJECTED clients and fake timers.
 *
 * No module mock: `start` and `read` are `vi.fn()`s passed straight in, which is the reason
 * they are injected rather than imported by the hook.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, renderHook } from "@testing-library/react"

import { usePublishAttempt } from "./usePublishAttempt"
import type { PublishAttempt, PublishOutcome, PublishVerdict } from "@/lib/api"

const NOW = Date.parse("2026-11-07T12:00:00Z")

function verdict(over: Partial<PublishVerdict> = {}): PublishVerdict {
  return {
    published: false,
    version: null,
    golden_run_id: "run-1",
    blocked_stage: "judge",
    named_failures: [{ criterion: "answers_business_requirement", score: 2, evidence: "thin" }],
    ...over,
  }
}

const NONE: PublishAttempt = { state: "none", golden_run_id: null, verdict: null, progress: null }

function running(over: Partial<PublishAttempt> = {}): PublishAttempt {
  return {
    state: "running",
    golden_run_id: "run-1",
    verdict: null,
    progress: {
      step_index: 2,
      step_count: 5,
      step_name: "Collect evidence",
      started_at: new Date(Date.now() - 75_000).toISOString(),
    },
    ...over,
  }
}

function done(v: PublishVerdict): PublishAttempt {
  return {
    state: "done",
    golden_run_id: v.golden_run_id,
    verdict: { ...v, state: null },
    progress: { step_index: null, step_count: 5, step_name: null, started_at: new Date(NOW - 200_000).toISOString() },
  }
}

function httpError(status: number) {
  return Object.assign(new Error(`status ${status}`), { status })
}

const HANDLE: PublishOutcome = {
  kind: "running",
  verdict: { published: false, version: null, golden_run_id: "run-1", blocked_stage: null, named_failures: [], state: "running" },
}

type Start = (id: string, goldenInput: string) => Promise<PublishOutcome>
type Read = (id: string) => Promise<PublishAttempt>

function setup(first: () => Promise<PublishAttempt>) {
  const start = vi.fn<Start>()
  const read = vi.fn<Read>().mockImplementationOnce(first)
  const onPublished = vi.fn()
  const hook = renderHook(
    ({ open }: { open: boolean }) =>
      usePublishAttempt({ definitionId: "wf-1", open, start, read, onPublished }),
    { initialProps: { open: true } },
  )
  return { start, read, onPublished, hook }
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** Mount, answer the open read with `none`, and click Publish with a POST answering `outcome`. */
async function submitFromIdle(outcome: () => Promise<PublishOutcome>, nextRead?: PublishAttempt) {
  const ctx = setup(() => Promise.resolve(NONE))
  await flush()
  expect(ctx.hook.result.current.phase).toBe("idle")
  ctx.start.mockImplementationOnce(outcome)
  if (nextRead) ctx.read.mockResolvedValue(nextRead)
  act(() => {
    void ctx.hook.result.current.submit("do the thing")
  })
  return ctx
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("usePublishAttempt — opening (D-21)", () => {
  it("open -> opening with exactly one read; none -> idle; no POST is ever sent", async () => {
    const { hook, read, start } = setup(() => Promise.resolve(NONE))
    expect(hook.result.current.phase).toBe("opening")
    expect(read).toHaveBeenCalledTimes(1)
    expect(read).toHaveBeenCalledWith("wf-1")
    await flush()
    expect(hook.result.current.phase).toBe("idle")
    expect(start).not.toHaveBeenCalled()
  })

  it("a 404 or any thrown error on open falls through to idle", async () => {
    const a = setup(() => Promise.reject(httpError(404)))
    await flush()
    expect(a.hook.result.current.phase).toBe("idle")
    a.hook.unmount()
    const b = setup(() => Promise.reject(new Error("network")))
    await flush()
    expect(b.hook.result.current.phase).toBe("idle")
    expect(b.hook.result.current.error).toBeNull()
  })

  it("a running attempt is followed again without a POST (P9)", async () => {
    const { hook, start } = setup(() => Promise.resolve(running()))
    await flush()
    expect(hook.result.current.phase).toBe("running")
    expect(hook.result.current.goldenRunId).toBe("run-1")
    expect(hook.result.current.attempt?.progress?.step_name).toBe("Collect evidence")
    expect(start).not.toHaveBeenCalled()
  })

  it("a finishing attempt opens in finishing", async () => {
    const { hook } = setup(() => Promise.resolve(running({ state: "finishing" })))
    await flush()
    expect(hook.result.current.phase).toBe("finishing")
  })

  it("a finished attempt opens on its verdict (P10)", async () => {
    const v = verdict()
    const { hook, start } = setup(() => Promise.resolve(done(v)))
    await flush()
    expect(hook.result.current.phase).toBe("done")
    expect(hook.result.current.outcome).toEqual({ kind: "verdict", verdict: { ...v, state: null } })
    expect(start).not.toHaveBeenCalled()
  })
})

describe("usePublishAttempt — submitting and terminal POST answers", () => {
  it("submit -> submitting while the POST is in flight", async () => {
    const { hook } = await submitFromIdle(() => new Promise(() => {}))
    expect(hook.result.current.phase).toBe("submitting")
  })

  it.each<[string, PublishOutcome]>([
    ["verdict", { kind: "verdict", verdict: verdict({ blocked_stage: "lint" }) }],
    ["business_requirement", { kind: "business_requirement", verdict: verdict({ blocked_stage: "business_requirement" }) }],
    ["not_found", { kind: "not_found" }],
    ["already_published", { kind: "already_published" }],
  ])("a terminal %s answer is done with that outcome exactly", async (_k, outcome) => {
    const { hook, read } = await submitFromIdle(() => Promise.resolve(outcome))
    await flush()
    expect(hook.result.current.phase).toBe("done")
    expect(hook.result.current.outcome).toEqual(outcome)
    // No follow read after a terminal answer.
    expect(read).toHaveBeenCalledTimes(1)
    await flush(10_000)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it("a verdict with no state field is done (D-08)", async () => {
    const v = verdict()
    expect("state" in v).toBe(false)
    const { hook } = await submitFromIdle(() => Promise.resolve({ kind: "verdict", verdict: v }))
    await flush()
    expect(hook.result.current.phase).toBe("done")
  })
})

describe("usePublishAttempt — following (D-19)", () => {
  it("a 202 -> running, an immediate read, then one read every 3000 ms", async () => {
    const { hook, read } = await submitFromIdle(() => Promise.resolve(HANDLE), running())
    await flush()
    expect(hook.result.current.phase).toBe("running")
    expect(hook.result.current.goldenRunId).toBe("run-1")
    expect(read).toHaveBeenCalledTimes(2) // the open read + the immediate follow read
    await flush(2_999)
    expect(read).toHaveBeenCalledTimes(2)
    await flush(1)
    expect(read).toHaveBeenCalledTimes(3)
    await flush(3_000)
    expect(read).toHaveBeenCalledTimes(4)
  })

  it("a done read maps its verdict; already_published becomes the old 409 kind", async () => {
    const a = setup(() => Promise.resolve(running()))
    await flush()
    a.read.mockResolvedValue(done(verdict({ blocked_stage: "already_published" })))
    await flush(3_000)
    expect(a.hook.result.current.phase).toBe("done")
    expect(a.hook.result.current.outcome).toEqual({ kind: "already_published" })
  })

  it("polling stops on done", async () => {
    const { hook, read } = setup(() => Promise.resolve(running()))
    await flush()
    read.mockResolvedValue(done(verdict()))
    await flush(3_000)
    expect(hook.result.current.phase).toBe("done")
    const calls = read.mock.calls.length
    await flush(15_000)
    expect(read.mock.calls.length).toBe(calls)
  })

  it("a 404 while following -> lost, and polling stops (P8)", async () => {
    const { hook, read } = setup(() => Promise.resolve(running()))
    await flush()
    read.mockRejectedValue(httpError(404))
    await flush(3_000)
    expect(hook.result.current.phase).toBe("lost")
    expect(hook.result.current.outcome).toBeNull()
    const calls = read.mock.calls.length
    await flush(15_000)
    expect(read.mock.calls.length).toBe(calls)
  })

  it("polling stops when the modal closes and on unmount — no timer left", async () => {
    const { hook, read } = setup(() => Promise.resolve(running()))
    read.mockResolvedValue(running())
    await flush()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    hook.rerender({ open: false })
    const calls = read.mock.calls.length
    await flush(15_000)
    expect(read.mock.calls.length).toBe(calls)
    expect(vi.getTimerCount()).toBe(0)

    hook.rerender({ open: true })
    await flush()
    expect(hook.result.current.phase).toBe("running")
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    hook.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("transient failures never move the phase; followError after 2 in a row, cleared by a good read (P7)", async () => {
    const { hook, read } = setup(() => Promise.resolve(running()))
    await flush()
    read.mockRejectedValue(new Error("Failed to fetch"))
    await flush(3_000)
    expect(hook.result.current.phase).toBe("running")
    expect(hook.result.current.followError).toBe(false)
    read.mockRejectedValue(httpError(502))
    await flush(3_000)
    expect(hook.result.current.phase).toBe("running")
    expect(hook.result.current.followError).toBe(true)
    expect(hook.result.current.outcome).toBeNull()
    read.mockResolvedValue(running())
    await flush(3_000)
    expect(hook.result.current.followError).toBe(false)
    expect(hook.result.current.phase).toBe("running")
  })

  it("a different golden_run_id from the server is adopted (D-UI-08)", async () => {
    const { hook, read } = setup(() => Promise.resolve(running()))
    await flush()
    read.mockResolvedValue(running({ golden_run_id: "run-2" }))
    await flush(3_000)
    expect(hook.result.current.goldenRunId).toBe("run-2")
  })

  it("a late answer to a read sent before a close/reopen is ignored (stale-response guard)", async () => {
    // 308.1 review WR-01: a poll no longer supersedes the poll before it (a slow read is waited
    // for, see below). What makes an in-flight answer stale is a close/reopen, submit or reset.
    const { hook, read } = setup(() => Promise.resolve(running()))
    await flush()
    let releaseSlow: (a: PublishAttempt) => void = () => {}
    read.mockImplementationOnce(() => new Promise<PublishAttempt>((r) => (releaseSlow = r)))
    await flush(3_000) // slow poll sent
    hook.rerender({ open: false })
    read.mockImplementationOnce(() => Promise.resolve(running({ state: "finishing" })))
    hook.rerender({ open: true })
    await flush() // the reopen read answers finishing
    expect(hook.result.current.phase).toBe("finishing")
    await act(async () => {
      releaseSlow(done(verdict()))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(hook.result.current.phase).toBe("finishing")
    expect(hook.result.current.outcome).toBeNull()
  })
})

describe("usePublishAttempt — a read slower than the poll interval (308.1 review WR-01)", () => {
  /** A read that answers (or fails) `ms` after it is sent. */
  function slow<T>(ms: number, settle: () => Promise<T>): () => Promise<T> {
    return () => new Promise<T>((resolve, reject) => {
      setTimeout(() => settle().then(resolve, reject), ms)
    })
  }

  it("a 4 s read on a 3 s poll still lands: the verdict shows", async () => {
    // Every tick used to bump the request counter, so with every GET slower than POLL_MS
    // the next tick invalidated the read in flight and NO read ever landed (the starved
    // 1-vCPU host this phase exists for).
    const { hook, read } = setup(() => Promise.resolve(running()))
    await flush()
    read.mockImplementation(slow(4_000, () => Promise.resolve(done(verdict()))))
    await flush(20_000)
    expect(hook.result.current.phase).toBe("done")
    expect(hook.result.current.outcome).toEqual({ kind: "verdict", verdict: { ...verdict(), state: null } })
  })

  it("slow FAILED reads still count: the follow-error line becomes reachable", async () => {
    const { hook, read } = setup(() => Promise.resolve(running()))
    await flush()
    read.mockImplementation(slow(4_000, () => Promise.reject(httpError(502))))
    await flush(20_000)
    expect(hook.result.current.phase).toBe("running")
    expect(hook.result.current.followError).toBe(true)
  })

  it("no second read is sent while one is still pending", async () => {
    const { read } = setup(() => Promise.resolve(running()))
    await flush()
    const before = read.mock.calls.length
    read.mockImplementation(slow(10_000, () => Promise.resolve(running())))
    await flush(9_000) // ticks at 3 s, 6 s and 9 s: only the first sends
    expect(read.mock.calls.length).toBe(before + 1)
  })
})

describe("usePublishAttempt — the clock (D-21)", () => {
  it("while following, elapsed is computed from the server's started_at", async () => {
    const { hook, read } = setup(() => Promise.resolve(running()))
    read.mockResolvedValue(running({ progress: { step_index: 2, step_count: 5, step_name: "x", started_at: new Date(NOW - 75_000).toISOString() } }))
    await flush()
    expect(hook.result.current.elapsedSec).toBe(75)
    await flush(1_000)
    expect(hook.result.current.elapsedSec).toBe(76)
  })

  it("before the first read answers it counts from the click", async () => {
    const { hook } = await submitFromIdle(() => new Promise(() => {}))
    expect(hook.result.current.elapsedSec).toBe(0)
    await flush(2_000)
    expect(hook.result.current.elapsedSec).toBe(2)
  })
})

describe("usePublishAttempt — a POST that throws (rule 6)", () => {
  it("one read: a running attempt is followed", async () => {
    const { hook } = await submitFromIdle(() => Promise.reject(new Error("Failed to fetch")), running())
    await flush()
    expect(hook.result.current.phase).toBe("running")
    expect(hook.result.current.error).toBeNull()
  })

  it("no attempt -> idle with the thrown message as error", async () => {
    const { hook, read } = await submitFromIdle(() => Promise.reject(new Error("Failed to fetch")), NONE)
    await flush()
    expect(read).toHaveBeenCalledTimes(2)
    expect(hook.result.current.phase).toBe("idle")
    expect(hook.result.current.error).toBe("Failed to fetch")
  })
})

describe("usePublishAttempt — onPublished once per golden_run_id per mount (D-UI-07)", () => {
  it("a passing POST verdict fires once; a reopen onto the same verdict does not fire again", async () => {
    const pass = verdict({ published: true, version: 4, blocked_stage: null, named_failures: [], auto_answered: [{ message: "Answered A" }] })
    const { hook, read, onPublished } = await submitFromIdle(() => Promise.resolve({ kind: "verdict", verdict: pass }))
    await flush()
    expect(onPublished).toHaveBeenCalledTimes(1)
    expect(onPublished).toHaveBeenCalledWith(4, ["Answered A"])
    hook.rerender({ open: false })
    read.mockResolvedValue(done(pass))
    hook.rerender({ open: true })
    await flush()
    expect(hook.result.current.phase).toBe("done")
    expect(onPublished).toHaveBeenCalledTimes(1)
  })

  it("a passing verdict reached by a poll fires once", async () => {
    const pass = verdict({ published: true, version: 2, blocked_stage: null, named_failures: [] })
    const { hook, read, onPublished } = setup(() => Promise.resolve(running()))
    await flush()
    read.mockResolvedValue(done(pass))
    await flush(3_000)
    expect(hook.result.current.phase).toBe("done")
    hook.rerender({ open: true })
    await flush(9_000)
    expect(onPublished).toHaveBeenCalledTimes(1)
    expect(onPublished).toHaveBeenCalledWith(2, [])
  })

  it("a block never fires onPublished", async () => {
    const { onPublished } = setup(() => Promise.resolve(done(verdict())))
    await flush()
    expect(onPublished).not.toHaveBeenCalled()
  })
})

describe("usePublishAttempt — reset (Fix & re-publish)", () => {
  it("reset -> idle and clears outcome and error", async () => {
    const { hook } = setup(() => Promise.resolve(done(verdict())))
    await flush()
    expect(hook.result.current.phase).toBe("done")
    act(() => hook.result.current.reset())
    expect(hook.result.current.phase).toBe("idle")
    expect(hook.result.current.outcome).toBeNull()
    expect(hook.result.current.error).toBeNull()
  })
})
