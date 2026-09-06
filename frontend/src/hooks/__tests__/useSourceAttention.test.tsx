/**
 * Phase 235 plan 04 Task 2 (SURF-02 / SURF-03 · D-235-05 / D-v2.5-03) —
 * THE ONE CLIENT-SIDE READER OF THE SOURCE VERDICT.
 *
 * ── ⛔ THE MODULE UNDER MOCK IS NOT IN THE BARREL ─────────────────────────────────────
 * `frontend/src/lib/api/sources.ts` is NOT re-exported by `@/lib/api` (235-RESEARCH P-10),
 * so `vi.mock("@/lib/api")` alone would intercept nothing here. It is mocked SEPARATELY, by
 * its own path — the same thing `WatchedFoldersSection.test.tsx:20-31` already does.
 *
 * ── ⚠ NON-VACUITY FIRST ──────────────────────────────────────────────────────────────
 * A mock that is never called makes every assertion below pass over nothing. The first case
 * therefore proves the hook actually reaches `getSourceHealth` before any property rests on
 * what it returned.
 *
 * ── WHAT THIS SUITE IS FOR ───────────────────────────────────────────────────────────
 * D-235-05 puts the stopped/not-stopped threshold on the SERVER so the rail badge, the
 * Health row and the source card cannot disagree. That only holds if the client has exactly
 * ONE reader that derives NOTHING — so the last case reads the hook's own source and refuses
 * a `filter` / `consecutive` / `threshold` appearing in it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, cleanup } from "@testing-library/react"

import * as sourcesApi from "@/lib/api/sources"
import type { SourceHealth, StoppedSource } from "@/lib/api/sources"

import { useSourceAttention } from "../useSourceAttention"
// The hook's own source, read as text for the "derives nothing" fence below.
import hookSource from "../useSourceAttention.ts?raw"

vi.mock("@/lib/api/sources", () => ({
  getSourceHealth: vi.fn(),
  listSyncRuns: vi.fn(),
}))

const mockGetSourceHealth = vi.mocked(sourcesApi.getSourceHealth)

// ── FIXTURES ──────────────────────────────────────────────────────────────────────────

const STOPPED_ROW: StoppedSource = {
  watch_id: "watch-1",
  source_folder_name: "Incident Reports",
  connection_name: "Safety Drive",
  cause: "token_revoked",
  hard: true,
  stopped_since: "2026-09-04T09:14:00Z",
  last_good_at: "2026-09-02T09:14:00Z",
}

function health(over: Partial<SourceHealth> = {}): SourceHealth {
  return {
    stopped: [STOPPED_ROW],
    reader_running: true,
    poll_interval_seconds: 15,
    ...over,
  }
}

/** Advance fake timers AND drain the microtask queue the fetch promise settles on. */
async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  mockGetSourceHealth.mockReset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ── §1 NON-VACUITY ────────────────────────────────────────────────────────────────────

describe("§1 non-vacuity — the hook really reaches the endpoint", () => {
  it("calls getSourceHealth exactly once on mount, before any claim rests on its result", async () => {
    mockGetSourceHealth.mockResolvedValue(health())

    renderHook(() => useSourceAttention())
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(1)

    await flush()
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(1)
  })
})

// ── §2 THE CONTRACT ───────────────────────────────────────────────────────────────────

describe("§2 what the hook exposes", () => {
  it("reports loading until the first response settles (SEED-248)", async () => {
    mockGetSourceHealth.mockResolvedValue(health())

    const { result } = renderHook(() => useSourceAttention())
    expect(result.current.loading).toBe(true)

    await flush()
    expect(result.current.loading).toBe(false)
  })

  it("passes stopped, readerRunning and pollIntervalSeconds through VERBATIM", async () => {
    mockGetSourceHealth.mockResolvedValue(health({ reader_running: false, poll_interval_seconds: 42 }))

    const { result } = renderHook(() => useSourceAttention())
    await flush()

    expect(result.current.stopped).toEqual([STOPPED_ROW])
    expect(result.current.readerRunning).toBe(false)
    expect(result.current.pollIntervalSeconds).toBe(42)
  })

  it("reports nothing needing attention when the server's stopped array is empty", async () => {
    // ⛔ D-235-05 — the SERVER has already applied the debounce. An empty array means
    //   "nothing is stopped", even with the reader off and a failure visible elsewhere.
    mockGetSourceHealth.mockResolvedValue(health({ stopped: [], reader_running: false }))

    const { result } = renderHook(() => useSourceAttention())
    await flush()

    expect(result.current.stopped).toEqual([])
    expect(result.current.readerRunning).toBe(false)
  })
})

// ── §3 THE POLL ───────────────────────────────────────────────────────────────────────

describe("§3 the poll — the server owns its own cadence", () => {
  it("re-polls on the interval the SERVER named, not one of ours", async () => {
    mockGetSourceHealth.mockResolvedValue(health({ poll_interval_seconds: 15 }))

    renderHook(() => useSourceAttention())
    await flush()
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(1)

    await flush(14_999)
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(1)

    await flush(1)
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(2)
  })

  it("falls back to 60s before the first response has named an interval", async () => {
    mockGetSourceHealth.mockReturnValue(new Promise<SourceHealth>(() => {}))

    renderHook(() => useSourceAttention())
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(1)

    await flush(59_999)
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(1)

    await flush(1)
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(2)
  })

  it("clears the interval on unmount — no timer survives the hook", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval")
    mockGetSourceHealth.mockResolvedValue(health())

    const { unmount } = renderHook(() => useSourceAttention())
    await flush()
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    unmount()

    expect(clearSpy).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    clearSpy.mockRestore()
  })
})

// ── §4 FAILURE AND REFRESH ────────────────────────────────────────────────────────────

describe("§4 a failing probe must not blank the app shell", () => {
  it("keeps the previous verdict, settles loading, and never throws when a fetch rejects", async () => {
    mockGetSourceHealth.mockResolvedValueOnce(health())
    const { result } = renderHook(() => useSourceAttention())
    await flush()
    expect(result.current.stopped).toEqual([STOPPED_ROW])

    mockGetSourceHealth.mockRejectedValueOnce(new Error("network down"))
    act(() => {
      result.current.refresh()
    })
    await flush()

    expect(result.current.stopped).toEqual([STOPPED_ROW])
    expect(result.current.loading).toBe(false)
  })
})

describe("§5 refresh", () => {
  it("re-fetches immediately", async () => {
    mockGetSourceHealth.mockResolvedValue(health())
    const { result } = renderHook(() => useSourceAttention())
    await flush()
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.refresh()
    })
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(2)
  })

  it("aborts the in-flight fetch it replaces", async () => {
    mockGetSourceHealth.mockReturnValue(new Promise<SourceHealth>(() => {}))
    const { result } = renderHook(() => useSourceAttention())

    const firstSignal = mockGetSourceHealth.mock.calls[0][0] as AbortSignal
    expect(firstSignal).toBeInstanceOf(AbortSignal)
    expect(firstSignal.aborted).toBe(false)

    act(() => {
      result.current.refresh()
    })

    expect(firstSignal.aborted).toBe(true)
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(2)
  })
})

// ── §6 THE FENCE — D-235-05, ASSERTED OVER THE SOURCE RATHER THAN IN PROSE ────────────

describe("§6 the hook derives NOTHING", () => {
  it("carries its live source (non-vacuity for the fence below)", () => {
    expect(hookSource.length).toBeGreaterThan(400)
    expect(hookSource).toContain("useSourceAttention")
  })

  it("⛔ applies no threshold of its own — the server's verdict is the whole truth", () => {
    // Comments are stripped first: the docblock EXPLAINS the prohibition and naming it there
    // must not trip the fence that enforces it (the Pitfall-8 shape, one directory over).
    const code = hookSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")

    expect(code).not.toMatch(/stopped\s*\.\s*filter/)
    expect(code).not.toMatch(/consecutive/i)
    expect(code).not.toMatch(/threshold/i)
  })

  it("⛔ and the RAW file carries none of the three tokens either — comments included", () => {
    // ⚠ The plan's acceptance criterion is a grep over the UNSTRIPPED file, so the docblock
    //   deliberately explains the prohibition without spelling the words that enforce it.
    //   Pitfall 8: a literal inside a docblock is still a literal. Making the criterion
    //   EXECUTABLE here means it survives the next edit rather than being a one-off grep.
    expect(hookSource).not.toMatch(/stopped\.filter/)
    expect(hookSource).not.toMatch(/consecutive/)
    expect(hookSource).not.toMatch(/threshold/)
  })
})
