/**
 * Phase 298-04 (ORG-03 / D-08 / D-09 / D-11 / UI-D9) — the thread list follows an org switch.
 *
 * `ChatLayout` already calls `loadThreads()` on an org change (Phase 166). What this pins is the
 * hook's half: the old org's threads drop AT ONCE, `switching` is true only while an answer for
 * ANOTHER org is held (so first paint is unchanged — BUG-261027-02 stays for Phase 299), a late
 * old-org answer never repaints, and writes land in the active org's list.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, renderHook } from "@testing-library/react"

const orgStore = vi.hoisted(() => {
  let current: string | null = null
  const subs = new Set<() => void>()
  return {
    get: () => current,
    set: (v: string | null) => {
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
    useOrgOptional: () => ({ activeOrgId: useSyncExternalStore(orgStore.subscribe, orgStore.get) }),
  }
})

const api = vi.hoisted(() => ({
  listThreads: vi.fn(),
  createThread: vi.fn(),
  deleteThread: vi.fn(),
  renameThread: vi.fn(),
}))
vi.mock("@/lib/api", () => api)

import { useThreads } from "@/hooks/useThreads"
import { setActiveOrgId } from "@/lib/api/_core"
import type { Thread } from "@/types"

function thread(id: string, title: string): Thread {
  return { id, user_id: "u", title, folder_id: null, created_at: "2026-10-28T00:00:00Z", updated_at: "2026-10-28T00:00:00Z" }
}
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}
function switchOrg(next: string | null) {
  setActiveOrgId(next)
  orgStore.set(next)
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
  switchOrg("org-a")
})
afterEach(() => switchOrg(null))

describe("useThreads — follows the active org (298-04)", () => {
  it("first render: switching is FALSE (first paint unchanged, UI-D9)", () => {
    const { result } = renderHook(() => useThreads())
    expect(result.current.switching).toBe(false)
    expect(result.current.threads).toEqual([])
  })

  it("a switch drops the old org's threads AT ONCE and reads switching until the new org answers", async () => {
    api.listThreads.mockResolvedValueOnce([thread("ta", "Alpha chat")])
    const { result } = renderHook(() => useThreads())
    await act(async () => {
      await result.current.loadThreads()
    })
    expect(result.current.threads.map((t) => t.id)).toEqual(["ta"])
    expect(result.current.switching).toBe(false)

    act(() => switchOrg("org-b"))
    expect(result.current.threads).toEqual([])
    expect(result.current.switching).toBe(true)

    const gateB = deferred<Thread[]>()
    api.listThreads.mockReturnValueOnce(gateB.promise)
    let loading!: Promise<void>
    act(() => {
      loading = result.current.loadThreads()
    })
    expect(result.current.switching).toBe(true)
    await act(async () => {
      gateB.resolve([thread("tb", "Bravo chat")])
      await loading
    })
    expect(result.current.threads.map((t) => t.id)).toEqual(["tb"])
    expect(result.current.switching).toBe(false)
  })

  it("a late answer for the old org never repaints", async () => {
    const gateA = deferred<Thread[]>()
    api.listThreads.mockReturnValueOnce(gateA.promise).mockResolvedValueOnce([thread("tb", "Bravo chat")])
    const { result } = renderHook(() => useThreads())
    let first!: Promise<void>
    act(() => {
      first = result.current.loadThreads()
    })
    act(() => switchOrg("org-b"))
    await act(async () => {
      await result.current.loadThreads()
    })
    await act(async () => {
      gateA.resolve([thread("ta", "Alpha chat")])
      await first
    })
    expect(result.current.threads.map((t) => t.id)).toEqual(["tb"])
    expect(result.current.switching).toBe(false)
  })

  it("newThread after a switch lands in the NEW org's list, and selectThread still selects", async () => {
    api.listThreads.mockResolvedValueOnce([thread("ta", "Alpha chat")]).mockResolvedValueOnce([thread("tb", "Bravo chat")])
    const { result } = renderHook(() => useThreads())
    await act(async () => {
      await result.current.loadThreads()
    })
    act(() => switchOrg("org-b"))
    await act(async () => {
      await result.current.loadThreads()
    })
    api.createThread.mockResolvedValueOnce(thread("tb2", "New Chat"))
    await act(async () => {
      await result.current.newThread()
    })
    expect(result.current.threads.map((t) => t.id)).toEqual(["tb2", "tb"])
    act(() => result.current.selectThread(result.current.threads[1]))
    expect(result.current.selectedThread?.id).toBe("tb")
  })

  it("298-review WR-03: a FAILED refetch after a switch ends switching (never loading forever)", async () => {
    api.listThreads.mockResolvedValueOnce([thread("ta", "Alpha chat")])
    const { result } = renderHook(() => useThreads())
    await act(async () => {
      await result.current.loadThreads()
    })
    act(() => switchOrg("org-b"))
    expect(result.current.switching).toBe(true)
    api.listThreads.mockRejectedValueOnce(new Error("502"))
    await act(async () => {
      await expect(result.current.loadThreads()).rejects.toThrow("502")
    })
    expect(result.current.switching).toBe(false)
    expect(result.current.loading).toBe(false)
    expect(result.current.threads).toEqual([])
  })
})
