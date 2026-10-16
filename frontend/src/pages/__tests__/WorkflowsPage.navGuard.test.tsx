/**
 * Phase 281-03 — WorkflowsPage's two NEW navigations away from the Builder both pass the
 * existing unsaved-work guard (`canLeaveBuilderRef`, D-184-16) before they leave.
 *
 *   - FIX-10 (D-10 / D-28): the publish gauntlet's golden-run link → the page's `onOpenRun`
 *     (`ChatLayout.openRunSurface`, app-level navigation that bypasses the Builder's own leave
 *     prompt).
 *   - D-27 / SEED-218: the describe door's connect control → the page's `onOpenConnections`
 *     (the members' Connections door, never operator-only `settings`), handed to the door shell
 *     as its `onOpenSettings`.
 *
 * ⚠ WHY THIS IS ITS OWN FILE AND NOT MORE CASES IN `WorkflowsPage.test.tsx`. That suite mounts
 * the REAL door shell, Builder and gauntlet, and the real Builder registers its own leave
 * predicate (`dirty ? window.confirm(...) : true`). Proving "the guard refuses ⇒ nothing
 * navigates" needs to CHOOSE the predicate's answer, which means standing in for the two
 * children — a module-level `vi.mock` that would replace them for every one of that file's
 * existing cases. The children are stubbed here instead, and only here; each stub records the
 * props the page handed it, which is exactly the seam under test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, configure } from "@testing-library/react"
import type { ReactNode } from "react"

configure({ asyncUtilTimeout: 15000 })

type DoorProps = {
  registerCanLeave?: (canLeave: (() => boolean) | null) => void
  onOpenSettings?: () => void
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
        {props.renderPublish?.({ slug: "contract-clause" }, "draft-281", null, () => {})}
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

beforeEach(() => {
  seen.door = null
  seen.gauntlet = null
})

/** Mount the page and walk into the Builder host via the toolbar's fresh-build entry. */
async function openBuilder(props: Partial<Parameters<typeof WorkflowsPage>[0]> = {}) {
  render(<WorkflowsPage folders={[]} onLaunch={vi.fn()} {...props} />)
  fireEvent.click(await screen.findByTestId("library-create"))
  await screen.findByTestId("door-stub")
  expect(seen.door).not.toBeNull()
  expect(seen.gauntlet).not.toBeNull()
  return { door: seen.door!, gauntlet: () => seen.gauntlet! }
}

describe("WorkflowsPage 281-03 — the golden-run link passes the unsaved-work guard (D-10 / D-28)", () => {
  it("with the guard REFUSING, the gauntlet's onOpenRun does NOT reach the page's onOpenRun", async () => {
    const onOpenRun = vi.fn()
    const { door, gauntlet } = await openBuilder({ onOpenRun })
    door.registerCanLeave?.(() => false)

    expect(typeof gauntlet().onOpenRun).toBe("function")
    gauntlet().onOpenRun?.("run-281")
    expect(onOpenRun).not.toHaveBeenCalled()
  })

  it("with the guard ALLOWING, it is called once with the exact id", async () => {
    const onOpenRun = vi.fn()
    const { door, gauntlet } = await openBuilder({ onOpenRun })
    door.registerCanLeave?.(() => true)

    gauntlet().onOpenRun?.("run-281")
    expect(onOpenRun).toHaveBeenCalledTimes(1)
    expect(onOpenRun).toHaveBeenCalledWith("run-281")
  })

  it("with NO predicate registered (no Builder mounted), it is called through", async () => {
    const onOpenRun = vi.fn()
    const { door, gauntlet } = await openBuilder({ onOpenRun })
    door.registerCanLeave?.(null)

    gauntlet().onOpenRun?.("run-281")
    expect(onOpenRun).toHaveBeenCalledWith("run-281")
  })

  it("with onOpenRun ABSENT (canvas layer off), the gauntlet receives undefined — no link renders", async () => {
    const { gauntlet } = await openBuilder()
    expect(gauntlet().onOpenRun).toBeUndefined()
  })
})

describe("WorkflowsPage 281-03 — the describe door's connect control has a destination (D-27 / SEED-218)", () => {
  it("the door's onOpenSettings calls the page's onOpenConnections, once", async () => {
    const onOpenConnections = vi.fn()
    const { door } = await openBuilder({ onOpenConnections })

    expect(typeof door.onOpenSettings).toBe("function")
    door.onOpenSettings?.()
    expect(onOpenConnections).toHaveBeenCalledTimes(1)
  })

  it("with the unsaved-work guard REFUSING, it does not navigate", async () => {
    const onOpenConnections = vi.fn()
    const { door } = await openBuilder({ onOpenConnections })
    door.registerCanLeave?.(() => false)

    // NON-VACUITY: a control that does not exist trivially "does not navigate".
    expect(typeof door.onOpenSettings).toBe("function")
    door.onOpenSettings?.()
    expect(onOpenConnections).not.toHaveBeenCalled()
  })

  it("with onOpenConnections ABSENT, the door receives onOpenSettings === undefined (today's non-control span)", async () => {
    const { door } = await openBuilder()
    expect(door.onOpenSettings).toBeUndefined()
  })
})
