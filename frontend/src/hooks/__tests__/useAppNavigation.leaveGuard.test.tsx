/**
 * Phase 297 plan 03 (LINK-07 / D-21, D-22, D-24, D-31, D-32, D-42) — the ONE app-level leave
 * guard: a `useBlocker` in `useAppNavigation` over a leave-guard registry.
 *
 * ── WIRING (A), D-31 ──────────────────────────────────────────────────────────────────
 * The tenant's predicate IS the prompt: `() => dirty ? window.confirm(PROMPT) : true` — the exact
 * shape `WorkflowBuilderPage.tsx` registers. So "OK" means "not blocked" (the navigation simply
 * proceeds, no `proceed()`), and "Cancel" means blocked → the hook calls `reset()` and the edits
 * stay. The user-visible contract of D-22 is what is asserted: asked once, OK leaves, Cancel stays.
 *
 * ── THE HARD GATE ─────────────────────────────────────────────────────────────────────
 * Because the confirm runs inside the blocker callback, a callback evaluated twice per attempt
 * would ask twice. Every dirty case therefore asserts `toHaveBeenCalledTimes(N)` EXACTLY, under
 * `<StrictMode>` — never `toHaveBeenCalled()`.
 *
 * ── THE HARNESS ───────────────────────────────────────────────────────────────────────
 * `createMemoryRouter([{ path: "*", Component: Shell }])` under `<StrictMode>` — the tree shape
 * `main.tsx` mounts. `Shell` calls the hook and provides its registry; `Tenant` registers the
 * prompting predicate through `useLeaveGuard`, reading the test's `box.dirty` at call time.
 */
import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, waitFor } from "@testing-library/react"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

import { useAppNavigation, type AppNavigation } from "../useAppNavigation"
import {
  LeaveGuardContext,
  createLeaveGuardRegistry,
  useLeaveGuard,
  useLeaveGuardRegistry,
} from "@/lib/leaveGuard"
import { UNSAVED_LEAVE_PROMPT } from "@/components/workflows/builderCopy"

const box: { nav: AppNavigation | null; dirty: boolean; provide: boolean; tenant: boolean } = {
  nav: null,
  dirty: false,
  provide: true,
  tenant: true,
}

function Tenant() {
  useLeaveGuard(() => (box.dirty ? window.confirm(UNSAVED_LEAVE_PROMPT) : true))
  return null
}

function Shell() {
  const nav = useAppNavigation()
  box.nav = nav
  const child = box.tenant ? <Tenant /> : null
  return box.provide ? (
    <LeaveGuardContext.Provider value={nav.leaveGuards}>{child}</LeaveGuardContext.Provider>
  ) : (
    child
  )
}

function mount(entries: string[], initialIndex = entries.length - 1) {
  const router = createMemoryRouter([{ path: "*", Component: Shell }], {
    initialEntries: entries,
    initialIndex,
  })
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
  return router
}

const nav = (): AppNavigation => {
  if (!box.nav) throw new Error("the hook has not rendered")
  return box.nav
}
const where = (router: ReturnType<typeof mount>) =>
  `${router.state.location.pathname}${router.state.location.search}`
/** Every registered blocker is idle — and at least one exists (non-vacuity: it really blocked). */
const blockerResetAfterBlock = (router: ReturnType<typeof mount>) => {
  const all = [...router.state.blockers.values()]
  return all.length === 1 && all.every((b) => b.state === "unblocked")
}

let confirmSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  box.dirty = false
  box.provide = true
  box.tenant = true
  confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false)
})

afterEach(() => {
  cleanup()
  box.nav = null
  vi.restoreAllMocks()
})

async function back(router: ReturnType<typeof mount>) {
  await act(async () => {
    await router.navigate(-1)
  })
}
async function forward(router: ReturnType<typeof mount>) {
  await act(async () => {
    await router.navigate(1)
  })
}

describe("leave guard — a DIRTY tenant asks exactly once (D-21, D-22, StrictMode hard gate)", () => {
  it("Back + Cancel: asked once with the Builder's prompt, the address stays, the blocker is reset", async () => {
    const router = mount(["/app/settings", "/app/workflows"])
    box.dirty = true
    await back(router)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy).toHaveBeenCalledWith(UNSAVED_LEAVE_PROMPT)
    await waitFor(() => expect(blockerResetAfterBlock(router)).toBe(true))
    expect(where(router)).toBe("/app/workflows")
    expect(nav().activeView).toBe("workflows")
  })

  it("Back + OK: asked once, leaves to the previous entry", async () => {
    const router = mount(["/app/settings", "/app/workflows"])
    box.dirty = true
    confirmSpy.mockReturnValue(true)
    await back(router)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(where(router)).toBe("/app/settings"))
  })

  it("Forward + Cancel: asked once, stays; Forward + OK: asked once more, leaves", async () => {
    const router = mount(["/app/workflows", "/app/settings"], 0)
    box.dirty = true
    await forward(router)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(blockerResetAfterBlock(router)).toBe(true))
    expect(where(router)).toBe("/app/workflows")

    confirmSpy.mockReturnValue(true)
    await forward(router)
    expect(confirmSpy).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(where(router)).toBe("/app/settings"))
  })

  it("a rail click (onNavigate) + Cancel: asked once, no navigation", async () => {
    const router = mount(["/app/workflows"])
    box.dirty = true
    act(() => nav().onNavigate("settings"))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(blockerResetAfterBlock(router)).toBe(true))
    expect(where(router)).toBe("/app/workflows")
  })

  it("a rail click (onNavigate) + OK: asked once, lands on /app/settings", async () => {
    const router = mount(["/app/workflows"])
    box.dirty = true
    confirmSpy.mockReturnValue(true)
    act(() => nav().onNavigate("settings"))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(where(router)).toBe("/app/settings"))
  })

  it("a rail click cancelled, then the SAME rail click again asks again (the navigator is not wedged by a stale `here`)", async () => {
    const router = mount(["/app/workflows"])
    box.dirty = true
    act(() => nav().onNavigate("settings"))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(blockerResetAfterBlock(router)).toBe(true))
    confirmSpy.mockReturnValue(true)
    act(() => nav().onNavigate("settings"))
    expect(confirmSpy).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(where(router)).toBe("/app/settings"))
  })

  it("a reverted POP neither wedges nor doubles the guard: Cancel, Cancel, OK = 1, 2, 3 calls", async () => {
    const router = mount(["/app/settings", "/app/workflows"])
    box.dirty = true

    await back(router)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(blockerResetAfterBlock(router)).toBe(true))
    expect(where(router)).toBe("/app/workflows")

    await back(router)
    expect(confirmSpy).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(blockerResetAfterBlock(router)).toBe(true))
    expect(where(router)).toBe("/app/workflows")

    confirmSpy.mockReturnValue(true)
    await back(router)
    expect(confirmSpy).toHaveBeenCalledTimes(3)
    await waitFor(() => expect(where(router)).toBe("/app/settings"))
  })
})

describe("leave guard — a CLEAN tenant is never asked (D-24)", () => {
  it("Back, Forward and a rail click each navigate with 0 confirm calls", async () => {
    const router = mount(["/app/settings", "/app/workflows"])
    await back(router)
    await waitFor(() => expect(where(router)).toBe("/app/settings"))
    await forward(router)
    await waitFor(() => expect(where(router)).toBe("/app/workflows"))
    act(() => nav().onNavigate("documents"))
    await waitFor(() => expect(where(router)).toBe("/app/library"))
    expect(confirmSpy).toHaveBeenCalledTimes(0)
  })

  it("no provider at all: the default registry is a no-op — a DIRTY tenant is never consulted", async () => {
    box.provide = false
    const router = mount(["/app/settings", "/app/workflows"])
    box.dirty = true
    await back(router)
    await waitFor(() => expect(where(router)).toBe("/app/settings"))
    act(() => nav().onNavigate("documents"))
    await waitFor(() => expect(where(router)).toBe("/app/library"))
    expect(confirmSpy).toHaveBeenCalledTimes(0)
  })

  it("no tenant registered: navigations consult nothing", async () => {
    box.tenant = false
    const router = mount(["/app/settings", "/app/workflows"])
    box.dirty = true
    await back(router)
    await waitFor(() => expect(where(router)).toBe("/app/settings"))
    expect(confirmSpy).toHaveBeenCalledTimes(0)
  })

  it("a search-only change on the same pathname never consults the tenant", async () => {
    const router = mount(["/app/workflows"])
    box.dirty = true
    await act(async () => {
      await router.navigate("/app/workflows?probe=1")
    })
    await waitFor(() => expect(where(router)).toBe("/app/workflows?probe=1"))
    expect(confirmSpy).toHaveBeenCalledTimes(0)
  })
})

describe("leave guard — the forced 403 bounce passes (D-42) and the latch is one-shot (D-32)", () => {
  it("bounceHome() while DIRTY on /app/workflows: 0 confirm calls, lands on /app by REPLACE", async () => {
    const router = mount(["/app/workflows"])
    box.dirty = true
    act(() => nav().bounceHome())
    await waitFor(() => expect(where(router)).toBe("/app"))
    expect(router.state.historyAction).toBe("REPLACE")
    expect(confirmSpy).toHaveBeenCalledTimes(0)
  })

  it("bounceHome() while already at /app does nothing and leaves NO armed latch: the next dirty leave asks once", async () => {
    const router = mount(["/app"])
    box.dirty = true
    act(() => nav().bounceHome())
    expect(where(router)).toBe("/app")
    act(() => nav().onNavigate("settings"))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(blockerResetAfterBlock(router)).toBe(true))
    expect(where(router)).toBe("/app")
  })

  it("approveNextLeave(): the next dirty leave asks 0 times, the one after asks once (one-shot)", async () => {
    const router = mount(["/app/workflows"])
    box.dirty = true
    act(() => {
      nav().leaveGuards.approveNextLeave()
      nav().onNavigate("settings")
    })
    await waitFor(() => expect(where(router)).toBe("/app/settings"))
    expect(confirmSpy).toHaveBeenCalledTimes(0)

    act(() => nav().onNavigate("documents"))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(blockerResetAfterBlock(router)).toBe(true))
    expect(where(router)).toBe("/app/settings")
  })

  it("a latch armed before a navigation that does NOT consult the tenant is cleared on commit — a later dirty leave still asks", async () => {
    const router = mount(["/app/workflows"])
    box.dirty = true
    act(() => nav().leaveGuards.approveNextLeave())
    await act(async () => {
      await router.navigate("/app/workflows?probe=1")
    })
    await waitFor(() => expect(where(router)).toBe("/app/workflows?probe=1"))
    act(() => nav().onNavigate("settings"))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
  })

  it("clearLeaveApproval() disarms the latch before it is spent", async () => {
    const router = mount(["/app/workflows"])
    box.dirty = true
    act(() => {
      nav().leaveGuards.approveNextLeave()
      nav().leaveGuards.clearLeaveApproval()
      nav().onNavigate("settings")
    })
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(blockerResetAfterBlock(router)).toBe(true))
    expect(where(router)).toBe("/app/workflows")
  })

  it("the registry keeps ONE identity across renders (the Provider value never changes, nothing remounts)", async () => {
    const router = mount(["/app/workflows"])
    const first = nav().leaveGuards
    act(() => nav().onNavigate("settings"))
    await waitFor(() => expect(where(router)).toBe("/app/settings"))
    expect(nav().leaveGuards).toBe(first)
  })
})

describe("leave-guard registry — unit", () => {
  it("register / unregister drives hasTenants", () => {
    const r = createLeaveGuardRegistry()
    expect(r.hasTenants()).toBe(false)
    const off = r.register(() => true)
    expect(r.hasTenants()).toBe(true)
    off()
    expect(r.hasTenants()).toBe(false)
  })

  it("canLeaveAll asks every predicate in order and short-circuits on the first false", () => {
    const r = createLeaveGuardRegistry()
    const calls: string[] = []
    r.register(() => (calls.push("a"), true))
    r.register(() => (calls.push("b"), false))
    r.register(() => (calls.push("c"), true))
    expect(r.canLeaveAll()).toBe(false)
    expect(calls).toEqual(["a", "b"])
  })

  it("the latch is consumed once, without consulting any predicate", () => {
    const r = createLeaveGuardRegistry()
    const pred = vi.fn(() => false)
    r.register(pred)
    r.approveNextLeave()
    expect(r.canLeaveAll()).toBe(true)
    expect(pred).toHaveBeenCalledTimes(0)
    expect(r.canLeaveAll()).toBe(false)
    expect(pred).toHaveBeenCalledTimes(1)
  })

  it("clearLeaveApproval disarms the latch", () => {
    const r = createLeaveGuardRegistry()
    r.register(() => false)
    r.approveNextLeave()
    r.clearLeaveApproval()
    expect(r.canLeaveAll()).toBe(false)
  })

  it("the same predicate registered twice is two tenants; each unregister removes its own", () => {
    const r = createLeaveGuardRegistry()
    const p = () => true
    const off1 = r.register(p)
    const off2 = r.register(p)
    off1()
    expect(r.hasTenants()).toBe(true)
    off2()
    expect(r.hasTenants()).toBe(false)
  })

  it("outside any provider useLeaveGuardRegistry() is the no-op default (never throws)", () => {
    let seen: ReturnType<typeof useLeaveGuardRegistry> | null = null
    function Probe() {
      seen = useLeaveGuardRegistry()
      return null
    }
    render(<Probe />)
    expect(seen).not.toBeNull()
    const r = seen!
    const off = r.register(() => false)
    expect(r.hasTenants()).toBe(false)
    expect(r.canLeaveAll()).toBe(true)
    off()
    r.approveNextLeave()
    r.clearLeaveApproval()
  })
})
