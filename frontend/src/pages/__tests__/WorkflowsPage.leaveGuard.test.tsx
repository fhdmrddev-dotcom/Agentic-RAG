/**
 * Phase 297 plan 03 (LINK-07 / D-23, D-30, D-31, D-32) — WorkflowsPage is the leave guard's ONE
 * tenant, and a dirty Builder is asked EXACTLY ONCE per leave attempt.
 *
 * The page forwards the Builder's own prompting predicate (`canLeaveBuilderRef`) to the app's ONE
 * blocker (`useAppNavigation`). Two outbound controls already ask in-page before they leave — the
 * describe door's connect control and the gauntlet's golden-run link — so each sets the one-shot
 * latch after a passing check, and the app blocker does not ask a second time (Pitfall 7). Test
 * Run never asks (D-32: today's behaviour) and clears the latch in a `finally`, so a launch that
 * did not navigate leaves nothing armed.
 *
 * ── THE HARNESS ───────────────────────────────────────────────────────────────────────
 * The `WorkflowsPage.navGuard.test.tsx` stubs (door + gauntlet record the props the page handed
 * them; the API list calls resolve empty), inside a memory router whose `Shell` is what App and
 * AppViewSwitch do: call `useAppNavigation`, provide its registry, mount WorkflowsPage only while
 * the view is `workflows`, and wire `onOpenConnections` / `onOpenRun` / `onLaunch` to the hook's
 * navigators (`onLaunch` stands in for ChatLayout's `doRun`, which ends in `openRun`).
 * `window.confirm` is spied and every case asserts its call count EXACTLY.
 */
import { StrictMode, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

configure({ asyncUtilTimeout: 15000 })

type DoorProps = {
  registerCanLeave?: (canLeave: (() => boolean) | null) => void
  onOpenSettings?: () => void
  onTestRun?: (def: Record<string, unknown>, draftId?: string | null) => Promise<void>
  renderPublish?: (
    def: Record<string, unknown>,
    draftId: string | null,
    blockedReason: string | null,
    onPublishRunning: (running: boolean) => void,
  ) => ReactNode
}
type GauntletProps = { onOpenRun?: (runId: string) => void }

const { seen } = vi.hoisted(() => ({
  seen: {
    door: null as DoorProps | null,
    gauntlet: null as GauntletProps | null,
  },
}))

vi.mock("@/components/workflows/WorkflowDoorSwitch", () => ({
  WorkflowDoorSwitch: (props: DoorProps) => {
    seen.door = props
    return (
      <div data-testid="door-stub">
        {props.renderPublish?.({ slug: "contract-clause" }, "draft-297", null, () => {})}
      </div>
    )
  },
}))

vi.mock("@/components/workflows/PublishGauntlet", () => ({
  PublishGauntlet: (props: GauntletProps) => {
    seen.gauntlet = props
    return <div data-testid="gauntlet-stub" />
  },
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    listPublishedWorkflows: () => Promise.resolve([]),
    listDraftWorkflows: () => Promise.resolve([]),
    listStarterWorkflows: () => Promise.resolve([]),
    listSchedules: () => Promise.resolve([]),
    listWorkflowSchedules: () => Promise.resolve([]),
    listFolders: () => Promise.resolve([]),
    listSkills: () => Promise.resolve([]),
  }
})

import { WorkflowsPage } from "@/pages/WorkflowsPage"
import { useAppNavigation, type AppNavigation } from "@/hooks/useAppNavigation"
import { LeaveGuardContext } from "@/lib/leaveGuard"
import { UNSAVED_LEAVE_PROMPT } from "@/components/workflows/builderCopy"

const RUN_ID = "5d3f1a2b-7c4e-4f6a-9a8b-1c2d3e4f5a97"

const box: { nav: AppNavigation | null; launchNavigates: boolean } = {
  nav: null,
  launchNavigates: true,
}

function Shell() {
  const nav = useAppNavigation()
  box.nav = nav
  return (
    <LeaveGuardContext.Provider value={nav.leaveGuards}>
      {nav.activeView === "workflows" ? (
        <WorkflowsPage
          folders={[]}
          onOpenConnections={() => nav.onNavigate("connections")}
          onOpenRun={nav.openRun}
          onLaunch={async () => {
            if (box.launchNavigates) nav.openRun(RUN_ID)
          }}
        />
      ) : (
        <div data-testid="elsewhere" />
      )}
    </LeaveGuardContext.Provider>
  )
}

function mount(entries: string[] = ["/app/settings", "/app/workflows"]) {
  const router = createMemoryRouter([{ path: "*", Component: Shell }], {
    initialEntries: entries,
    initialIndex: entries.length - 1,
  })
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
  return router
}

const where = (router: ReturnType<typeof mount>) =>
  `${router.state.location.pathname}${router.state.location.search}`
const door = (): DoorProps => {
  if (!seen.door) throw new Error("the door has not rendered")
  return seen.door
}
const gauntlet = (): GauntletProps => {
  if (!seen.gauntlet) throw new Error("the gauntlet has not rendered")
  return seen.gauntlet
}
const nav = (): AppNavigation => {
  if (!box.nav) throw new Error("the hook has not rendered")
  return box.nav
}

/** Walk into the Builder host via the library's fresh-build entry. */
async function openBuilder() {
  fireEvent.click(await screen.findByTestId("library-create"))
  await screen.findByTestId("door-stub")
  expect(seen.door).not.toBeNull()
  expect(seen.gauntlet).not.toBeNull()
}

/** The Builder's own shape: dirty ⇒ ask (WorkflowBuilderPage.tsx registers exactly this). */
function makeDirty() {
  act(() => door().registerCanLeave?.(() => window.confirm(UNSAVED_LEAVE_PROMPT)))
}

async function back(router: ReturnType<typeof mount>) {
  await act(async () => {
    await router.navigate(-1)
  })
}

let confirmSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  seen.door = null
  seen.gauntlet = null
  box.launchNavigates = true
  confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false)
})

afterEach(() => {
  cleanup()
  box.nav = null
  vi.restoreAllMocks()
})

describe("WorkflowsPage 297-03 — the in-page controls that already ask are asked ONCE (D-32 latch)", () => {
  it("connect control + OK: exactly 1 confirm across the in-page check and the app blocker, lands on /app/connections", async () => {
    const router = mount()
    await openBuilder()
    makeDirty()
    confirmSpy.mockReturnValue(true)
    act(() => door().onOpenSettings?.())
    await waitFor(() => expect(where(router)).toBe("/app/connections"))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy).toHaveBeenCalledWith(UNSAVED_LEAVE_PROMPT)
  })

  it("connect control + Cancel: exactly 1 confirm, no navigation, the Builder stays mounted", async () => {
    const router = mount()
    await openBuilder()
    makeDirty()
    act(() => door().onOpenSettings?.())
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(where(router)).toBe("/app/workflows")
    expect(screen.getByTestId("door-stub")).toBeTruthy()
  })

  it("golden-run link + OK: exactly 1 confirm, lands on /app/runs/<id>", async () => {
    const router = mount()
    await openBuilder()
    makeDirty()
    confirmSpy.mockReturnValue(true)
    act(() => gauntlet().onOpenRun?.(RUN_ID))
    await waitFor(() => expect(where(router)).toBe(`/app/runs/${RUN_ID}`))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
  })

  it("golden-run link + Cancel: exactly 1 confirm, no navigation", async () => {
    const router = mount()
    await openBuilder()
    makeDirty()
    act(() => gauntlet().onOpenRun?.(RUN_ID))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(where(router)).toBe("/app/workflows")
    expect(screen.getByTestId("door-stub")).toBeTruthy()
  })
})

describe("WorkflowsPage 297-03 — Test Run never asks, and leaves no armed latch (D-32)", () => {
  it("Test Run while dirty: 0 confirm calls, the launch's navigation to /app/runs/<id> completes", async () => {
    const router = mount()
    await openBuilder()
    makeDirty()
    expect(typeof door().onTestRun).toBe("function")
    await act(async () => {
      await door().onTestRun?.({ slug: "contract-clause", name: "Contract clause", version: 1 }, "draft-297")
    })
    await waitFor(() => expect(where(router)).toBe(`/app/runs/${RUN_ID}`))
    expect(confirmSpy).toHaveBeenCalledTimes(0)
  })

  it("a Test Run whose launch does NOT navigate clears the latch: the next dirty Back asks exactly once", async () => {
    box.launchNavigates = false
    const router = mount()
    await openBuilder()
    makeDirty()
    await act(async () => {
      await door().onTestRun?.({ slug: "contract-clause", name: "Contract clause", version: 1 }, "draft-297")
    })
    expect(where(router)).toBe("/app/workflows")
    expect(confirmSpy).toHaveBeenCalledTimes(0)

    await back(router)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(where(router)).toBe("/app/workflows")
  })
})

describe("WorkflowsPage 297-03 — browser Back from the Builder (D-21, D-22, D-24)", () => {
  it("dirty Back + Cancel: 1 confirm, the Builder stays mounted, the address stays on /app/workflows", async () => {
    const router = mount()
    await openBuilder()
    makeDirty()
    await back(router)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(where(router)).toBe("/app/workflows"))
    expect(screen.getByTestId("door-stub")).toBeTruthy()
    expect(screen.queryByTestId("elsewhere")).toBeNull()
  })

  it("dirty Back + OK: 1 confirm, leaves to the previous entry", async () => {
    const router = mount()
    await openBuilder()
    makeDirty()
    confirmSpy.mockReturnValue(true)
    await back(router)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(where(router)).toBe("/app/settings"))
    expect(screen.getByTestId("elsewhere")).toBeTruthy()
  })

  it("dirty rail click + Cancel: 1 confirm, no navigation", async () => {
    const router = mount()
    await openBuilder()
    makeDirty()
    act(() => nav().onNavigate("documents"))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(where(router)).toBe("/app/workflows")
    expect(screen.getByTestId("door-stub")).toBeTruthy()
  })

  it("a CLEAN Builder (predicate answers true): 0 confirm calls on a rail click", async () => {
    const router = mount(["/app/settings", "/app/workflows", "/app/library"])
    await back(router)
    await waitFor(() => expect(where(router)).toBe("/app/workflows"))
    await openBuilder()
    act(() => door().registerCanLeave?.(() => true))
    act(() => nav().onNavigate("documents"))
    await waitFor(() => expect(where(router)).toBe("/app/library"))
    expect(confirmSpy).toHaveBeenCalledTimes(0)
  })

  it("a CLEAN Builder: 0 confirm calls on Back", async () => {
    const router = mount()
    await openBuilder()
    act(() => door().registerCanLeave?.(() => true))
    await back(router)
    await waitFor(() => expect(where(router)).toBe("/app/settings"))
    expect(confirmSpy).toHaveBeenCalledTimes(0)
  })

  it("no Builder mounted (the library): 0 confirm calls on Back and on a rail click", async () => {
    const router = mount()
    await screen.findByTestId("library-create")
    await back(router)
    await waitFor(() => expect(where(router)).toBe("/app/settings"))
    await act(async () => {
      await router.navigate(1)
    })
    await waitFor(() => expect(where(router)).toBe("/app/workflows"))
    act(() => nav().onNavigate("documents"))
    await waitFor(() => expect(where(router)).toBe("/app/library"))
    expect(confirmSpy).toHaveBeenCalledTimes(0)
  })
})
