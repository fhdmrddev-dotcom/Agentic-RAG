/**
 * Phase 301 plan 02 Task 1 (NOTE-01 / NOTE-05 · D-15, D-17, D-18, D-33) —
 * THE WAITING LIST IS LEARNED FROM THE SERVER, AND ONLY FROM THE SERVER.
 *
 * ── ⛔ THE MODULE UNDER MOCK IS NOT IN THE BARREL ─────────────────────────────────────
 * `@/lib/api/notifications` is NOT re-exported by `@/lib/api`, so it is mocked by its own path
 * (the `@/lib/api/sources` precedent, `useSourceAttention.test.tsx`).
 *
 * ── ⚠ NON-VACUITY FIRST ──────────────────────────────────────────────────────────────
 * The first case proves the hook really reaches `getWaitingNotices` before any claim rests on
 * what it returned.
 *
 * ── WHAT THIS SUITE IS FOR ───────────────────────────────────────────────────────────
 * D-v2.5-03: Realtime is a hint, never truth. Every freshness trigger (mount, a Realtime event,
 * a SUBSCRIBED (re)join, focus, a visible tab, an org or membership change, the 60 s poll) must
 * REFETCH, and a forged event body must never become the list. A broken socket must not take
 * the shell down, and a failed fetch must never print an all-clear it did not receive.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, cleanup } from "@testing-library/react"

import * as notificationsApi from "@/lib/api/notifications"
import type { WaitingNotice, WaitingNotices } from "@/lib/api/notifications"

import { useWaitingNotices, REFETCH_COALESCE_MS } from "../useWaitingNotices"
// The hook's own source, read as text for the fence below.
import hookSource from "../useWaitingNotices.ts?raw"

vi.mock("@/lib/api/notifications", () => ({
  getWaitingNotices: vi.fn(),
}))

// ── A mutable Supabase double: every callback the hook hands it is captured ───────────
const sb = vi.hoisted(() => {
  const channelObj = { on: vi.fn(), subscribe: vi.fn() }
  channelObj.on.mockReturnValue(channelObj)
  channelObj.subscribe.mockReturnValue(channelObj)
  return {
    channelObj,
    supabase: {
      auth: {
        getSession: vi.fn() as unknown,
      } as Record<string, unknown>,
      channel: vi.fn(),
      removeChannel: vi.fn(),
    },
  }
})

vi.mock("@/lib/supabase", () => ({ supabase: sb.supabase }))

// ── A flippable OrgProvider (the useFolders.test.ts shape) ────────────────────────────
const orgStore = vi.hoisted(() => {
  let current: { activeOrgId: string | null; orgs: { org_id: string; name: string; role: string }[] } = {
    activeOrgId: "org-a",
    orgs: [{ org_id: "org-a", name: "Acme", role: "member" }],
  }
  const subs = new Set<() => void>()
  return {
    get: () => current,
    set: (v: typeof current) => {
      current = v
      subs.forEach((f) => f())
    },
    subscribe: (f: () => void) => {
      subs.add(f)
      return () => {
        subs.delete(f)
      }
    },
  }
})
vi.mock("@/providers/OrgProvider", async () => {
  const { useSyncExternalStore } = await import("react")
  return {
    useOrgOptional: () => useSyncExternalStore(orgStore.subscribe, orgStore.get),
  }
})

const mockGet = vi.mocked(notificationsApi.getWaitingNotices)

// ── FIXTURES ──────────────────────────────────────────────────────────────────────────

function notice(over: Partial<WaitingNotice> = {}): WaitingNotice {
  return {
    id: "n-1",
    run_id: "run-1",
    org_id: "org-a",
    org_name: "Acme",
    workflow_name: "Quarterly review",
    kind: "question",
    origin: "app",
    created_at: "2026-10-30T09:00:00Z",
    ...over,
  }
}

const TWO: WaitingNotices = {
  notices: [notice(), notice({ id: "n-2", run_id: "run-2", kind: "approval", origin: "schedule" })],
  total: 7,
}

const ONE: WaitingNotices = { notices: [notice({ id: "n-9", run_id: "run-9" })], total: 1 }

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Advance fake timers AND drain the microtask queue the fetch promise settles on. */
async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/**
 * 301 WR-01: every freshness trigger is coalesced over a short trailing window before it asks,
 * so a burst of triggers is one GET. `settle()` lets that window close and the answer land.
 */
async function settle(): Promise<void> {
  await flush(REFETCH_COALESCE_MS)
}

const ORIGINAL_GET_SESSION = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  mockGet.mockReset()
  sb.channelObj.on.mockReset().mockReturnValue(sb.channelObj)
  sb.channelObj.subscribe.mockReset().mockReturnValue(sb.channelObj)
  sb.supabase.channel.mockReset().mockReturnValue(sb.channelObj)
  sb.supabase.removeChannel.mockReset()
  ORIGINAL_GET_SESSION.mockReset().mockResolvedValue({
    data: { session: { user: { id: "user-1" }, access_token: "t" } },
  })
  sb.supabase.auth.getSession = ORIGINAL_GET_SESSION
  orgStore.set({ activeOrgId: "org-a", orgs: [{ org_id: "org-a", name: "Acme", role: "member" }] })
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ── §1 NON-VACUITY ────────────────────────────────────────────────────────────────────

describe("§1 non-vacuity — the hook really reaches the endpoint", () => {
  it("calls getWaitingNotices exactly once on mount, with an AbortSignal", async () => {
    mockGet.mockResolvedValue(TWO)
    renderHook(() => useWaitingNotices())
    await settle()
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet.mock.calls[0][0]).toBeInstanceOf(AbortSignal)
    await flush(5_000)
    expect(mockGet).toHaveBeenCalledTimes(1)
  })
})

// ── §2 THE CONTRACT ───────────────────────────────────────────────────────────────────

describe("§2 what the hook exposes", () => {
  it("before the first answer: loading, no verdict, nothing listed", () => {
    mockGet.mockReturnValue(new Promise<WaitingNotices>(() => {}))
    const { result } = renderHook(() => useWaitingNotices())
    expect(result.current.loading).toBe(true)
    expect(result.current.verdictKnown).toBe(false)
    expect(result.current.notices).toEqual([])
    expect(result.current.total).toBe(0)
  })

  it("passes the server's notices and total through verbatim", async () => {
    mockGet.mockResolvedValue(TWO)
    const { result } = renderHook(() => useWaitingNotices())
    await settle()
    expect(result.current.notices).toEqual(TWO.notices)
    expect(result.current.total).toBe(7)
    expect(result.current.loading).toBe(false)
    expect(result.current.verdictKnown).toBe(true)
    expect(result.current.failedSinceLast).toBe(false)
  })

  it("a first fetch that rejects settles loading but never fabricates an empty answer", async () => {
    mockGet.mockRejectedValue(new Error("network down"))
    const { result } = renderHook(() => useWaitingNotices())
    await settle()
    expect(result.current.loading).toBe(false)
    expect(result.current.verdictKnown).toBe(false)
    expect(result.current.failedSinceLast).toBe(false)
  })

  it("a later failure keeps the last answer and says so; the next success clears it", async () => {
    mockGet.mockResolvedValueOnce(TWO)
    const { result } = renderHook(() => useWaitingNotices())
    await settle()

    mockGet.mockRejectedValueOnce(new Error("network down"))
    act(() => result.current.refresh())
    await flush()
    expect(result.current.notices).toEqual(TWO.notices)
    expect(result.current.total).toBe(7)
    expect(result.current.verdictKnown).toBe(true)
    expect(result.current.failedSinceLast).toBe(true)

    mockGet.mockResolvedValueOnce(ONE)
    act(() => result.current.refresh())
    await flush()
    expect(result.current.notices).toEqual(ONE.notices)
    expect(result.current.failedSinceLast).toBe(false)
  })

  it("a newer refresh aborts the in-flight one, and the aborted late answer is ignored", async () => {
    const first = deferred<WaitingNotices>()
    const second = deferred<WaitingNotices>()
    mockGet.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useWaitingNotices())
    await flush(REFETCH_COALESCE_MS)
    const firstSignal = mockGet.mock.calls[0][0] as AbortSignal

    act(() => result.current.refresh())
    expect(firstSignal.aborted).toBe(true)

    second.resolve(ONE)
    await flush()
    first.resolve(TWO)
    await flush()
    expect(result.current.notices).toEqual(ONE.notices)
    expect(result.current.total).toBe(1)
  })
})

// ── §3 EVERY FRESHNESS TRIGGER REFETCHES ──────────────────────────────────────────────

describe("§3 the triggers", () => {
  it("polls every 60 s, and no timer survives unmount", async () => {
    mockGet.mockResolvedValue(TWO)
    const { unmount } = renderHook(() => useWaitingNotices())
    await settle()
    expect(mockGet).toHaveBeenCalledTimes(1)

    // Now at t = REFETCH_COALESCE_MS. The interval fires at 60 s; its ask lands one window later.
    await flush(60_000 - REFETCH_COALESCE_MS - 1)
    expect(mockGet).toHaveBeenCalledTimes(1)
    await flush(1 + REFETCH_COALESCE_MS)
    expect(mockGet).toHaveBeenCalledTimes(2)

    unmount()
    await flush(120_000)
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it("window focus refetches", async () => {
    mockGet.mockResolvedValue(TWO)
    renderHook(() => useWaitingNotices())
    await settle()
    act(() => {
      window.dispatchEvent(new Event("focus"))
    })
    await settle()
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it("a tab becoming visible refetches; becoming hidden does not", async () => {
    mockGet.mockResolvedValue(TWO)
    renderHook(() => useWaitingNotices())
    await settle()

    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" })
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await settle()
    expect(mockGet).toHaveBeenCalledTimes(1)

    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" })
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await settle()
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it("an active-org change refetches", async () => {
    mockGet.mockResolvedValue(TWO)
    renderHook(() => useWaitingNotices())
    await settle()
    act(() => {
      orgStore.set({ ...orgStore.get(), activeOrgId: "org-b" })
    })
    await settle()
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it("a membership change refetches", async () => {
    mockGet.mockResolvedValue(TWO)
    renderHook(() => useWaitingNotices())
    await settle()
    act(() => {
      orgStore.set({
        ...orgStore.get(),
        orgs: [...orgStore.get().orgs, { org_id: "org-z", name: "Zed", role: "member" }],
      })
    })
    await settle()
    expect(mockGet).toHaveBeenCalledTimes(2)
  })
})

// ── §3b 301 WR-01 — A BURST OF TRIGGERS IS ONE ASK, AND NONE IS LOST ─────────────
//
// The review measured a mount at up to three GETs (mount, the membership probe landing, the
// channel's SUBSCRIBED), a tab return at two (visibilitychange + focus) and an org switch at three
// (the probe's transient empty list read as a membership change, then its recovery). Each case
// below drives the REAL trigger pair, not one trigger alone.

describe("§3b coalescing (WR-01)", () => {
  it("mount + the membership probe landing + SUBSCRIBED, together, are ONE GET", async () => {
    // The probe has not answered yet: OrgProvider's fail-closed default carries no memberships.
    orgStore.set({ activeOrgId: "org-a", orgs: [] })
    mockGet.mockResolvedValue(TWO)
    renderHook(() => useWaitingNotices())
    await flush(0) // getSession resolves → the channel is attached (no timer advanced)
    expect(sb.channelObj.subscribe).toHaveBeenCalledTimes(1)

    act(() => {
      orgStore.set({ activeOrgId: "org-a", orgs: [{ org_id: "org-a", name: "Acme", role: "member" }] })
    })
    const onStatus = sb.channelObj.subscribe.mock.calls[0][0] as (status: string) => void
    act(() => onStatus("SUBSCRIBED"))

    await settle()
    expect(mockGet).toHaveBeenCalledTimes(1)
    await flush(5_000)
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it("a tab return (visibilitychange then focus) is ONE GET", async () => {
    mockGet.mockResolvedValue(TWO)
    renderHook(() => useWaitingNotices())
    await settle()
    expect(mockGet).toHaveBeenCalledTimes(1)

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new Event("focus"))
    })
    await settle()
    expect(mockGet).toHaveBeenCalledTimes(2)
    await flush(5_000)
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it("an event arriving DURING a fetch is not lost: the fetch is kept, and one follow-up asks after it", async () => {
    const first = deferred<WaitingNotices>()
    mockGet.mockReturnValueOnce(first.promise).mockResolvedValueOnce(ONE)
    const { result } = renderHook(() => useWaitingNotices())
    await settle()
    expect(mockGet).toHaveBeenCalledTimes(1)
    const firstSignal = mockGet.mock.calls[0][0] as AbortSignal

    const onEvent = sb.channelObj.on.mock.calls[0][2] as (msg: unknown) => void
    act(() => {
      onEvent({})
      window.dispatchEvent(new Event("focus"))
    })
    await settle()
    // Still the one request: it was neither aborted nor raced by a second one.
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(firstSignal.aborted).toBe(false)

    first.resolve(TWO)
    await settle()
    // The answer that may predate the event lands, then exactly ONE follow-up asks again.
    expect(mockGet).toHaveBeenCalledTimes(2)
    expect(result.current.notices).toEqual(ONE.notices)
    await flush(5_000)
    expect(mockGet).toHaveBeenCalledTimes(2)
  })
})

// ── §4 REALTIME IS A HINT ─────────────────────────────────────────────────────────────

describe("§4 Realtime only asks for a refetch", () => {
  it("subscribes user-scoped: one channel naming the user, filter recipient_id=eq.<uid>", async () => {
    mockGet.mockResolvedValue(TWO)
    renderHook(() => useWaitingNotices())
    await settle()

    expect(sb.supabase.channel).toHaveBeenCalledTimes(1)
    expect(String(sb.supabase.channel.mock.calls[0][0])).toContain("user-1")
    expect(sb.channelObj.on).toHaveBeenCalledTimes(1)
    const [event, filter] = sb.channelObj.on.mock.calls[0]
    expect(event).toBe("postgres_changes")
    expect(filter).toEqual({
      event: "*",
      schema: "public",
      table: "notifications",
      filter: "recipient_id=eq.user-1",
    })
  })

  it("an event refetches, and the list is the FETCHED one, never the event's", async () => {
    mockGet.mockResolvedValueOnce(TWO)
    const { result } = renderHook(() => useWaitingNotices())
    await settle()

    const onEvent = sb.channelObj.on.mock.calls[0][2] as (msg: unknown) => void
    mockGet.mockResolvedValueOnce(ONE)
    act(() => {
      onEvent({
        eventType: "INSERT",
        new: { id: "forged", run_id: "forged-run", workflow_name: "Forged" },
        old: {},
      })
    })
    await settle()
    expect(mockGet).toHaveBeenCalledTimes(2)
    expect(result.current.notices).toEqual(ONE.notices)
    expect(result.current.notices.some((n) => n.id === "forged")).toBe(false)
  })

  it("SUBSCRIBED (a join or a rejoin) refetches; CHANNEL_ERROR does not", async () => {
    mockGet.mockResolvedValue(TWO)
    renderHook(() => useWaitingNotices())
    await settle()

    const onStatus = sb.channelObj.subscribe.mock.calls[0][0] as (status: string) => void
    act(() => onStatus("CHANNEL_ERROR"))
    await settle()
    expect(mockGet).toHaveBeenCalledTimes(1)
    act(() => onStatus("SUBSCRIBED"))
    await settle()
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it("unmount removes the channel it created", async () => {
    mockGet.mockResolvedValue(TWO)
    const { unmount } = renderHook(() => useWaitingNotices())
    await settle()
    unmount()
    expect(sb.supabase.removeChannel).toHaveBeenCalledWith(sb.channelObj)
  })

  it("a throwing channel does not take the hook down, and the poll continues", async () => {
    sb.supabase.channel.mockImplementation(() => {
      throw new Error("realtime is broken")
    })
    mockGet.mockResolvedValue(TWO)
    const { result } = renderHook(() => useWaitingNotices())
    await settle()
    expect(result.current.total).toBe(7)
    await flush(60_000)
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it("an undefined channel does not take the hook down, and the poll continues", async () => {
    sb.supabase.channel.mockReturnValue(undefined)
    mockGet.mockResolvedValue(TWO)
    const { result, unmount } = renderHook(() => useWaitingNotices())
    await settle()
    expect(result.current.total).toBe(7)
    await flush(60_000)
    expect(mockGet).toHaveBeenCalledTimes(2)
    unmount()
  })

  it("a missing getSession does not take the hook down, and the poll continues", async () => {
    delete sb.supabase.auth.getSession
    mockGet.mockResolvedValue(TWO)
    const { result } = renderHook(() => useWaitingNotices())
    await settle()
    expect(result.current.total).toBe(7)
    expect(sb.supabase.channel).not.toHaveBeenCalled()
    await flush(60_000)
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it("a getSession that is not a promise, or that rejects, does not take the hook down", async () => {
    sb.supabase.auth.getSession = vi.fn().mockReturnValue(undefined)
    mockGet.mockResolvedValue(TWO)
    const first = renderHook(() => useWaitingNotices())
    await settle()
    expect(first.result.current.total).toBe(7)
    first.unmount()

    sb.supabase.auth.getSession = vi.fn().mockRejectedValue(new Error("no session"))
    const second = renderHook(() => useWaitingNotices())
    await settle()
    expect(second.result.current.total).toBe(7)
  })
})

// ── §5 THE FENCE — ASSERTED OVER THE SOURCE ───────────────────────────────────────────

describe("§5 the hook can only learn the list from the server", () => {
  const code = hookSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

  it("carries its live source (non-vacuity for the fence below)", () => {
    expect(hookSource.length).toBeGreaterThan(400)
    expect(code).toContain("useWaitingNotices")
    expect(code).toContain("getWaitingNotices")
  })

  it("⛔ never reads an event body (T-301-11)", () => {
    expect(code).not.toMatch(/payload\.new/)
    expect(code).not.toMatch(/payload\.old/)
  })

  it("is user-scoped and refetches on SUBSCRIBED (D-17, D-18)", () => {
    expect(code).toContain("recipient_id=eq.")
    expect(code).toContain("SUBSCRIBED")
  })

  it("⛔ lives outside StreamsProvider (D-18)", () => {
    expect(code).not.toMatch(/StreamsProvider/)
    expect(code).not.toMatch(/streamsStore/)
  })
})
