/**
 * Phase 297 plan 01 (REG-09 / D-01 / D-29 wave 1) — CHARACTERIZATION of App's view/tab state
 * and its navigators, written BEFORE they moved out of `App.tsx` into `useAppNavigation`.
 *
 * Phase 297 plan 02 (LINK-01 / D-07, D-08, D-15, D-16, D-17) — RE-TARGETED TO THE ADDRESS.
 * The view is now derived from the router's location, so every 297-01 case is written in its URL
 * form (the same behaviour, observed through `router.state.location` as well as the hook), and the
 * router's own behaviours are added beside them: refresh, Back/Forward, push vs replace, the
 * same-address no-op, the legacy aliases, the pre-auth addresses and the unknown address. No 297-01
 * case was deleted. ONE was revised on purpose — see "bounceHome … SPENDS the hand-off" below.
 *
 * ── THE HARNESS ──────────────────────────────────────────────────────────────────────
 * `createMemoryRouter([{ path: "*", Component: Shell }])` under `<StrictMode>` — the exact tree
 * shape `main.tsx` mounts (one catch-all route, no children). `Shell` calls the hook and parks
 * its return value where the cases can read it. Navigation the hook does not own (Back, Forward,
 * a refresh) is driven through `router.navigate` / a fresh router at the same entry.
 */
import { StrictMode } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, render, waitFor } from "@testing-library/react"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

import { useAppNavigation, type AppNavigation } from "../useAppNavigation"
// The hook's own source, read as text for the D-05 import fence below.
import hookSource from "../useAppNavigation.ts?raw"

const RUN_ID = "229f45ae-c85e-4707-a46c-bf4787541547"
const SKILL_1 = "0b9c3a51-7d2e-4f6a-9a8b-1c2d3e4f5a61"
const SKILL_2 = "0b9c3a51-7d2e-4f6a-9a8b-1c2d3e4f5a62"
const SKILL_3 = "0b9c3a51-7d2e-4f6a-9a8b-1c2d3e4f5a63"
const SKILL_4 = "0b9c3a51-7d2e-4f6a-9a8b-1c2d3e4f5a64"

const box: { nav: AppNavigation | null } = { nav: null }

function Shell() {
  box.nav = useAppNavigation()
  return null
}

function mount(entry: string) {
  const router = createMemoryRouter([{ path: "*", Component: Shell }], { initialEntries: [entry] })
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

afterEach(() => {
  cleanup()
  box.nav = null
})

describe("useAppNavigation — the boot address (297-01's initializer, now the route table)", () => {
  it("/admin/spend opens the spend view and is replaced by /app/admin/spend", async () => {
    const router = mount("/admin/spend")
    expect(nav().activeView).toBe("admin-spend")
    await waitFor(() => expect(where(router)).toBe("/app/admin/spend"))
    expect(router.state.historyAction).toBe("REPLACE")
  })

  it("/admin/spend/<anything> opens the spend view too — the prefix rule", async () => {
    const router = mount("/admin/spend/x")
    expect(nav().activeView).toBe("admin-spend")
    await waitFor(() => expect(where(router)).toBe("/app/admin/spend"))
  })

  it("/app?run=<uuid> opens the run page and lands on its own address /app/runs/<uuid> (D-16)", async () => {
    // 297-01 asserted the query was KEPT so a reload stayed on the run. The run now HAS an
    // address, so the same property — a reload stays on the run — is the replaced path.
    const router = mount(`/app?run=${RUN_ID}`)
    expect(nav().activeView).toBe("workflow-run")
    expect(nav().runId).toBe(RUN_ID)
    await waitFor(() => expect(where(router)).toBe(`/app/runs/${RUN_ID}`))
    expect(router.state.historyAction).toBe("REPLACE")
  })

  it("/app?connections=1&… opens Connections and DROPS the query (D-16)", async () => {
    const router = mount("/app?connections=1&oauth_error=x")
    expect(nav().activeView).toBe("connections")
    await waitFor(() => expect(router.state.location.pathname).toBe("/app/connections"))
    expect(router.state.location.search).toBe("")
  })

  it("/app opens chat — the home, and the address is left alone", () => {
    const router = mount("/app")
    expect(nav().activeView).toBe("chat")
    expect(where(router)).toBe("/app")
    expect(router.state.historyAction).toBe("POP")
  })
})

describe("useAppNavigation — the Skill Studio navigators", () => {
  it("handleOpenStudio(id) selects the skill, defaults the tab to evals and opens the studio", async () => {
    const router = mount("/app")
    act(() => nav().handleOpenStudio(SKILL_1))
    await waitFor(() => expect(nav().activeView).toBe("skill-studio"))
    expect(nav().studioSkillId).toBe(SKILL_1)
    expect(nav().studioTab).toBe("evals")
    expect(where(router)).toBe(`/app/skills/${SKILL_1}`)
  })

  it("handleTuneSkill lands on Triggering; handleReviewEvals lands on Evals", async () => {
    mount("/app")
    act(() => nav().handleTuneSkill(SKILL_2))
    await waitFor(() => expect(nav().studioSkillId).toBe(SKILL_2))
    expect(nav().studioTab).toBe("triggering")
    expect(nav().activeView).toBe("skill-studio")
    act(() => nav().handleReviewEvals(SKILL_3))
    await waitFor(() => expect(nav().studioSkillId).toBe(SKILL_3))
    expect(nav().studioTab).toBe("evals")
  })

  it("handleStudioTabChange changes ONLY the tab", async () => {
    const router = mount("/app")
    act(() => nav().handleOpenStudio(SKILL_4))
    await waitFor(() => expect(nav().activeView).toBe("skill-studio"))
    const key = router.state.location.key
    act(() => nav().handleStudioTabChange("versions"))
    expect(nav().studioTab).toBe("versions")
    expect(nav().studioSkillId).toBe(SKILL_4)
    expect(nav().activeView).toBe("skill-studio")
    // Tab addresses are Phase 299: a tab change writes no history entry.
    expect(router.state.location.key).toBe(key)
  })

  it("handleOpenStudio(id, 'triggering') pushes /app/skills/<id> with the Triggering tab", async () => {
    const router = mount("/app")
    act(() => nav().handleOpenStudio(SKILL_1, "triggering"))
    await waitFor(() => expect(where(router)).toBe(`/app/skills/${SKILL_1}`))
    expect(router.state.historyAction).toBe("PUSH")
    expect(nav().studioTab).toBe("triggering")
  })
})

describe("useAppNavigation — the Library hand-off is one-shot", () => {
  it("handleOpenLibraryHealth sets the Health hand-off and opens the Library", async () => {
    const router = mount("/app")
    act(() => nav().handleOpenLibraryHealth())
    await waitFor(() => expect(nav().activeView).toBe("documents"))
    expect(nav().libraryTab).toBe("health")
    expect(where(router)).toBe("/app/library")
  })

  it("the next onNavigate anywhere else SPENDS it", async () => {
    mount("/app")
    act(() => nav().handleOpenLibraryHealth())
    await waitFor(() => expect(nav().activeView).toBe("documents"))
    act(() => nav().onNavigate("chat"))
    await waitFor(() => expect(nav().activeView).toBe("chat"))
    expect(nav().libraryTab).toBeUndefined()
  })

  it("Back (a POP) spends it too, and Back to /app/library does not re-open Health (Pitfall 5)", async () => {
    const router = mount("/app")
    act(() => nav().handleOpenLibraryHealth())
    await waitFor(() => expect(nav().activeView).toBe("documents"))
    act(() => nav().onNavigate("chat"))
    await waitFor(() => expect(nav().activeView).toBe("chat"))
    await act(() => router.navigate(-1))
    await waitFor(() => expect(where(router)).toBe("/app/library"))
    expect(nav().activeView).toBe("documents")
    expect(nav().libraryTab).toBeUndefined()
  })

  it("a POP away from the Library spends it (Back from Health to chat)", async () => {
    const router = mount("/app")
    act(() => nav().handleOpenLibraryHealth())
    await waitFor(() => expect(nav().libraryTab).toBe("health"))
    await act(() => router.navigate(-1))
    await waitFor(() => expect(nav().activeView).toBe("chat"))
    expect(nav().libraryTab).toBeUndefined()
    await act(() => router.navigate(1))
    await waitFor(() => expect(nav().activeView).toBe("documents"))
    expect(nav().libraryTab).toBeUndefined()
  })

  it("bounceHome routes to /app with a REPLACE and SPENDS the hand-off (INTENTIONAL 297-02 revision)", async () => {
    // ⚠ REVISED 2026-10-27 (Phase 297-02) — NOT WEAKENED. The 297-01 case read:
    //   "bounceHome routes to chat and does NOT spend the hand-off (today's 403 setter)"
    //   expect(result.current.libraryTab).toBe("health")
    // That was a characterization of a side effect, never a contract: the old 403 setter
    // bypassed handleNavigate, so it skipped the clear. The clear must now run on POP (Pitfall 5:
    // Back to /app/library would otherwise re-open the Health tab the person already left), so
    // it lives in an effect keyed on the derived view — and that effect cannot tell a forced
    // bounce from any other move to chat. A stale hand-off surviving a 403 bounce helps nobody.
    const router = mount("/app")
    act(() => nav().handleOpenLibraryHealth())
    await waitFor(() => expect(nav().libraryTab).toBe("health"))
    act(() => nav().bounceHome())
    await waitFor(() => expect(nav().activeView).toBe("chat"))
    expect(where(router)).toBe("/app")
    expect(router.state.historyAction).toBe("REPLACE")
    expect(nav().libraryTab).toBeUndefined()
  })

  it("bounceHome keeps ONE identity across renders, so App's 403 effect deps do not churn", async () => {
    mount("/app")
    const first = nav().bounceHome
    act(() => nav().onNavigate("skills"))
    await waitFor(() => expect(nav().activeView).toBe("skills"))
    expect(nav().bounceHome).toBe(first)
  })

  it("bounceHome from /app/workflows replaces the entry with /app", async () => {
    const router = mount("/app/workflows")
    act(() => nav().bounceHome())
    await waitFor(() => expect(where(router)).toBe("/app"))
    expect(router.state.historyAction).toBe("REPLACE")
  })
})

describe("useAppNavigation — the address is the view (D-07, D-15)", () => {
  it("a cold /app/workflows opens Workflows, and a refresh (a fresh router at the same entry) still does", () => {
    mount("/app/workflows")
    expect(nav().activeView).toBe("workflows")
    cleanup()
    mount("/app/workflows")
    expect(nav().activeView).toBe("workflows")
  })

  it("onNavigate PUSHES the view's address; Back and Forward step between views", async () => {
    const router = mount("/app")
    act(() => nav().onNavigate("documents"))
    await waitFor(() => expect(where(router)).toBe("/app/library"))
    expect(router.state.historyAction).toBe("PUSH")
    expect(nav().activeView).toBe("documents")
    await act(() => router.navigate(-1))
    await waitFor(() => expect(nav().activeView).toBe("chat"))
    await act(() => router.navigate(1))
    await waitFor(() => expect(nav().activeView).toBe("documents"))
  })

  it("onNavigate to the view already on screen adds NO history entry", () => {
    const router = mount("/app")
    const key = router.state.location.key
    act(() => nav().onNavigate("chat"))
    expect(router.state.location.key).toBe(key)
    expect(router.state.historyAction).toBe("POP")
  })

  // 297-REVIEW IN-02 (2026-10-28): `/` and `/app?code=…` are chat without being spelled `/app`.
  it.each(["/", "/app?code=x"])("onNavigate('chat') at %s adds NO history entry — chat is already on screen", async (entry) => {
    const router = mount(entry)
    await act(async () => {})
    const key = router.state.location.key
    act(() => nav().onNavigate("chat"))
    await act(async () => {})
    expect(router.state.location.key).toBe(key)
    expect(where(router)).toBe(entry)
  })

  it("IN-02: bounceHome at bare / leaves the clean root alone and arms no leave latch", async () => {
    const router = mount("/")
    await act(async () => {})
    nav().leaveGuards.register(() => false)
    act(() => nav().bounceHome())
    await act(async () => {})
    expect(where(router)).toBe("/")
    expect(nav().leaveGuards.canLeaveAll()).toBe(false) // a stale armed latch would answer true
  })

  it("openRun(id) pushes /app/runs/<id>", async () => {
    const router = mount("/app/workflows")
    act(() => nav().openRun(RUN_ID))
    await waitFor(() => expect(where(router)).toBe(`/app/runs/${RUN_ID}`))
    expect(router.state.historyAction).toBe("PUSH")
    expect(nav().activeView).toBe("workflow-run")
    expect(nav().runId).toBe(RUN_ID)
  })
})

describe("useAppNavigation — legacy and bare addresses are normalised by REPLACE (D-13, D-16)", () => {
  it("an uppercase ?run= id is the run, lowercased", async () => {
    const router = mount(`/app?run=${RUN_ID.toUpperCase()}`)
    expect(nav().runId).toBe(RUN_ID)
    await waitFor(() => expect(where(router)).toBe(`/app/runs/${RUN_ID}`))
    expect(router.state.historyAction).toBe("REPLACE")
  })

  it("a bare /workflows opens Workflows and is replaced by /app/workflows", async () => {
    const router = mount("/workflows")
    expect(nav().activeView).toBe("workflows")
    await waitFor(() => expect(where(router)).toBe("/app/workflows"))
    expect(router.state.historyAction).toBe("REPLACE")
  })
})

describe("useAppNavigation — addresses the router must never touch (D-13, D-17, Pitfall 10)", () => {
  it.each(["/setup", "/invite?token=x", "/", "/app?code=x"])("%s is left exactly as it is", async (entry) => {
    const router = mount(entry)
    // Give any normalising effect its chance to run before asserting it did not.
    await act(async () => {})
    expect(where(router)).toBe(entry)
    expect(router.state.historyAction).toBe("POP")
  })

  // 297-REVIEW IN-03 (2026-10-28): the POSITIVE CONTROL for the single flush above. The same
  // one `await act(async () => {})` is enough for a replace that SHOULD land to land, so the
  // "left exactly as it is" cases cannot pass merely because the router had not run yet.
  it("control: a bare /workflows IS replaced within that same single flush", async () => {
    const router = mount("/workflows")
    await act(async () => {})
    expect(where(router)).toBe("/app/workflows")
    expect(router.state.historyAction).toBe("REPLACE")
  })

  it("/ is chat", () => {
    mount("/")
    expect(nav().activeView).toBe("chat")
    expect(nav().addressNotFound).toBe(false)
  })
})

describe("useAppNavigation — an unknown address (D-14)", () => {
  it("/app/nonsense is addressNotFound, the view reads chat, and the address is left alone", async () => {
    const router = mount("/app/nonsense")
    await act(async () => {})
    expect(nav().addressNotFound).toBe(true)
    expect(nav().activeView).toBe("chat")
    expect(where(router)).toBe("/app/nonsense")
  })

  it("a known address is never addressNotFound", () => {
    mount("/app/library")
    expect(nav().addressNotFound).toBe(false)
  })
})

describe("useAppNavigation — D-05 / D-08: the router hooks live here, from react-router only", () => {
  it("imports come from react-router (never react-router-dom), and the hooks are called here", () => {
    const src = hookSource.replace(/\r\n/g, "\n")
    // Non-vacuity: the ?raw import is the real module.
    expect(src).toContain("export function useAppNavigation")
    expect(src).toMatch(/from "react-router"/)
    expect(src).not.toContain("react-router-dom")
    expect(src).toContain("useLocation()")
    expect(src).toContain("useNavigate()")
  })
})
