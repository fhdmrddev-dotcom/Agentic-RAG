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
// Phase 299-03: the return-target store the resume cases write and read.
import { rememberReturnTarget, takeReturnTarget } from "@/lib/returnTo"

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

  // 297-REVIEW IN-01 (2026-10-28): the formatter's guarantee is two-sided now — a navigator never
  // pushes an id the parser would refuse, which would land the person on S1.
  it("IN-01: openRun / handleOpenStudio with a non-UUID id push nothing", async () => {
    const router = mount("/app/workflows")
    const key = router.state.location.key
    act(() => nav().openRun("not-a-uuid"))
    act(() => nav().handleOpenStudio("../settings"))
    await act(async () => {})
    expect(router.state.location.key).toBe(key)
    expect(where(router)).toBe("/app/workflows")
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

// ── Phase 299-02 (LINK-02 / D-01, D-02, D-32) — the entity addresses and the ONE `entityLink` object.
// New cases only. History entries are counted EXACTLY: every PUSH the router commits is recorded by
// its location key, so a navigator that writes two entries (or one where none is owed) reds here.
const THREAD_A = "5d0c2a9e-3b1f-4c6d-8e7a-1f2b3c4d5e61"
const THREAD_B = "5d0c2a9e-3b1f-4c6d-8e7a-1f2b3c4d5e62"
const DEFINITION = "7e1d3b0f-4c2a-4d7e-9f8b-2a3b4c5d6e7f"
const BUNDLE = "9f2e4c1a-5d3b-4e8f-a09c-3b4c5d6e7f80"

function pushCounter(router: ReturnType<typeof mount>) {
  const pushed = new Set<string>()
  const unsubscribe = router.subscribe((state) => {
    if (state.historyAction === "PUSH") pushed.add(state.location.key)
  })
  return { pushed: () => pushed.size, unsubscribe }
}

describe("useAppNavigation — entityLink.target reads the address (299-02 / D-01)", () => {
  it("/app/chat/<A> is the chat view with target {kind: thread, id: A}", () => {
    mount(`/app/chat/${THREAD_A}`)
    expect(nav().activeView).toBe("chat")
    expect(nav().addressNotFound).toBe(false)
    expect(nav().entityLink.target).toEqual({ kind: "thread", id: THREAD_A })
    expect(nav().entityLink.route).toEqual({ view: "chat", threadId: THREAD_A })
  })

  it("an uppercase thread id is lowercased in the target", () => {
    mount(`/app/chat/${THREAD_A.toUpperCase()}`)
    expect(nav().entityLink.target).toEqual({ kind: "thread", id: THREAD_A })
  })

  it("/app/workflows/<D> is the workflows view with a workflow target", () => {
    mount(`/app/workflows/${DEFINITION}`)
    expect(nav().activeView).toBe("workflows")
    expect(nav().entityLink.target).toEqual({ kind: "workflow", id: DEFINITION })
    expect(nav().entityLink.route).toEqual({ view: "workflows", definitionId: DEFINITION })
  })

  it("/app/experts/<E> is the experts view with an expert target", () => {
    mount(`/app/experts/${BUNDLE}`)
    expect(nav().activeView).toBe("experts")
    expect(nav().entityLink.target).toEqual({ kind: "expert", id: BUNDLE })
  })

  it("/app/runs/<R> is the run view with a run target (297's address, now also an entity)", () => {
    mount(`/app/runs/${RUN_ID}`)
    expect(nav().activeView).toBe("workflow-run")
    expect(nav().runId).toBe(RUN_ID)
    expect(nav().entityLink.target).toEqual({ kind: "run", id: RUN_ID })
    expect(nav().entityLink.route).toEqual({ view: "workflow-run", runId: RUN_ID })
  })

  it.each(["/app", "/app/library", "/app/workflows", "/app/experts", "/app/nonsense", "/setup"])(
    "%s has no entity target",
    (entry) => {
      mount(entry)
      expect(nav().entityLink.target).toBeNull()
      expect(nav().entityLink.route).toBeNull()
    },
  )

  it("entityLink keeps ONE identity while the address is unchanged (effects keyed on it do not churn)", async () => {
    mount(`/app/chat/${THREAD_A}`)
    await act(async () => {})
    const first = nav().entityLink
    act(() => nav().handleStudioTabChange("versions"))
    expect(nav().entityLink).toBe(first)
  })
})

describe("useAppNavigation — the entityLink navigators write exactly one entry (299-02 / D-02, D-32)", () => {
  it("openThread(A) from /app/library pushes /app/chat/A — one entry", async () => {
    const router = mount("/app/library")
    const counter = pushCounter(router)
    act(() => nav().entityLink.openThread(THREAD_A))
    await waitFor(() => expect(where(router)).toBe(`/app/chat/${THREAD_A}`))
    expect(counter.pushed()).toBe(1)
    expect(nav().activeView).toBe("chat")
    counter.unsubscribe()
  })

  it("openThread(A) while /app/chat/A is on screen is a no-op", async () => {
    const router = mount(`/app/chat/${THREAD_A}`)
    await act(async () => {})
    const key = router.state.location.key
    act(() => nav().entityLink.openThread(THREAD_A))
    act(() => nav().entityLink.openThread(THREAD_A.toUpperCase()))
    await act(async () => {})
    expect(router.state.location.key).toBe(key)
  })

  it("openThread(B) from /app/chat/A pushes /app/chat/B and Back returns to /app/chat/A", async () => {
    const router = mount(`/app/chat/${THREAD_A}`)
    const counter = pushCounter(router)
    act(() => nav().entityLink.openThread(THREAD_B))
    await waitFor(() => expect(where(router)).toBe(`/app/chat/${THREAD_B}`))
    expect(counter.pushed()).toBe(1)
    await act(() => router.navigate(-1))
    await waitFor(() => expect(where(router)).toBe(`/app/chat/${THREAD_A}`))
    expect(nav().entityLink.target).toEqual({ kind: "thread", id: THREAD_A })
    counter.unsubscribe()
  })

  it("openThread(B, {replace: true}) REPLACES the entry", async () => {
    const router = mount(`/app/chat/${THREAD_A}`)
    act(() => nav().entityLink.openThread(THREAD_B, { replace: true }))
    await waitFor(() => expect(where(router)).toBe(`/app/chat/${THREAD_B}`))
    expect(router.state.historyAction).toBe("REPLACE")
  })

  it("leaveThread() at /app/chat/A REPLACES the entry with /app", async () => {
    const router = mount(`/app/chat/${THREAD_A}`)
    const counter = pushCounter(router)
    act(() => nav().entityLink.leaveThread())
    await waitFor(() => expect(where(router)).toBe("/app"))
    expect(router.state.historyAction).toBe("REPLACE")
    expect(counter.pushed()).toBe(0)
    counter.unsubscribe()
  })

  it("leaveThread() off a thread address writes nothing", async () => {
    const router = mount("/app/library")
    const key = router.state.location.key
    act(() => nav().entityLink.leaveThread())
    await act(async () => {})
    expect(router.state.location.key).toBe(key)
    expect(where(router)).toBe("/app/library")
  })

  it("openWorkflow(D) pushes /app/workflows/D; openExpert(E) pushes /app/experts/E", async () => {
    const router = mount("/app")
    const counter = pushCounter(router)
    act(() => nav().entityLink.openWorkflow(DEFINITION))
    await waitFor(() => expect(where(router)).toBe(`/app/workflows/${DEFINITION}`))
    expect(nav().activeView).toBe("workflows")
    act(() => nav().entityLink.openExpert(BUNDLE))
    await waitFor(() => expect(where(router)).toBe(`/app/experts/${BUNDLE}`))
    expect(nav().activeView).toBe("experts")
    expect(counter.pushed()).toBe(2)
    counter.unsubscribe()
  })

  it("T-299-18: a non-UUID id pushes nothing, for every id variant", async () => {
    const router = mount("/app/library")
    const key = router.state.location.key
    act(() => nav().entityLink.openThread("not-a-uuid"))
    act(() => nav().entityLink.openWorkflow("../settings"))
    act(() => nav().entityLink.openExpert(`${BUNDLE}x`))
    act(() => nav().entityLink.openThread(""))
    await act(async () => {})
    expect(router.state.location.key).toBe(key)
    expect(where(router)).toBe("/app/library")
  })
})

describe("useAppNavigation — Chat returns to the last thread (299-02 / D-02, the workflow-run arm's mirror)", () => {
  it("before any thread, onNavigate('chat') goes to /app", async () => {
    const router = mount("/app/library")
    act(() => nav().onNavigate("chat"))
    await waitFor(() => expect(where(router)).toBe("/app"))
  })

  it("after visiting /app/chat/A, onNavigate('chat') from the Library goes to /app/chat/A", async () => {
    const router = mount(`/app/chat/${THREAD_A}`)
    await act(async () => {})
    act(() => nav().onNavigate("documents"))
    await waitFor(() => expect(where(router)).toBe("/app/library"))
    const counter = pushCounter(router)
    act(() => nav().onNavigate("chat"))
    await waitFor(() => expect(where(router)).toBe(`/app/chat/${THREAD_A}`))
    expect(counter.pushed()).toBe(1)
    counter.unsubscribe()
  })

  it("after the chat home is seen again, onNavigate('chat') goes to /app (a left thread is not re-opened)", async () => {
    const router = mount(`/app/chat/${THREAD_A}`)
    await act(async () => {})
    act(() => nav().entityLink.leaveThread())
    await waitFor(() => expect(where(router)).toBe("/app"))
    act(() => nav().onNavigate("documents"))
    await waitFor(() => expect(where(router)).toBe("/app/library"))
    act(() => nav().onNavigate("chat"))
    await waitFor(() => expect(where(router)).toBe("/app"))
  })

  it("onNavigate('chat') on a thread address is a no-op (the chat view is already on screen)", async () => {
    const router = mount(`/app/chat/${THREAD_A}`)
    await act(async () => {})
    const key = router.state.location.key
    act(() => nav().onNavigate("chat"))
    await act(async () => {})
    expect(router.state.location.key).toBe(key)
  })

  it("openThread(A) then onNavigate('chat') in ONE handler writes one entry, onto A", async () => {
    // The palette / launch shape: a navigator call followed by the legacy Chat call. The last-thread
    // memory must move with `go`, not one commit later, or the second call pushes a stale thread.
    const router = mount("/app/library")
    const counter = pushCounter(router)
    act(() => {
      nav().entityLink.openThread(THREAD_A)
      nav().onNavigate("chat")
    })
    await waitFor(() => expect(where(router)).toBe(`/app/chat/${THREAD_A}`))
    await act(async () => {})
    expect(counter.pushed()).toBe(1)
    counter.unsubscribe()
  })

  it("bounceHome from a thread address still REPLACES with /app (the 403 home is the thread-less home)", async () => {
    const router = mount(`/app/chat/${THREAD_A}`)
    act(() => nav().bounceHome())
    await waitFor(() => expect(where(router)).toBe("/app"))
    expect(router.state.historyAction).toBe("REPLACE")
  })
})

describe("useAppNavigation — a bare entity address keeps its token hash (299-02 / Pitfall 10)", () => {
  it("cold /chat/<id>#access_token=x is REPLACED by /app/chat/<id>#access_token=x", async () => {
    const router = mount(`/chat/${THREAD_A}#access_token=x`)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/app/chat/${THREAD_A}`))
    expect(router.state.location.hash).toBe("#access_token=x")
    expect(router.state.historyAction).toBe("REPLACE")
    expect(nav().entityLink.target).toEqual({ kind: "thread", id: THREAD_A })
  })

  it("an uppercase /app/workflows/<ID> is replaced by its lowercase address", async () => {
    const router = mount(`/app/workflows/${DEFINITION.toUpperCase()}`)
    await waitFor(() => expect(where(router)).toBe(`/app/workflows/${DEFINITION}`))
    expect(router.state.historyAction).toBe("REPLACE")
  })
})

// ── Phase 299-03 (D-15 / D-17 / D-24) — the gate's navigators: address, leave, openRoute, resume ──
describe("useAppNavigation — entityLink.address, leave, openRoute (299-03)", () => {
  it("address is the canonical path on screen (lowercase id, rebuilt)", async () => {
    mount(`/app/chat/${THREAD_A.toUpperCase()}`)
    await waitFor(() => expect(nav().entityLink.address).toBe(`/app/chat/${THREAD_A}`))
    cleanup()
    mount("/app/library")
    expect(nav().entityLink.address).toBe("/app/library")
  })

  it("leave() REPLACES the entity address with the last non-entity place in this tab", async () => {
    const router = mount("/app/library")
    act(() => nav().openRun(RUN_ID))
    await waitFor(() => expect(where(router)).toBe(`/app/runs/${RUN_ID}`))
    act(() => nav().entityLink.leave())
    await waitFor(() => expect(where(router)).toBe("/app/library"))
    expect(router.state.historyAction).toBe("REPLACE")
  })

  it("leave() on a cold entity address (no earlier place) REPLACES it with /app", async () => {
    const router = mount(`/app/workflows/${DEFINITION}`)
    await act(async () => {})
    act(() => nav().entityLink.leave())
    await waitFor(() => expect(where(router)).toBe("/app"))
    expect(router.state.historyAction).toBe("REPLACE")
  })

  it("leave(route) REPLACES with that route (Back to it lands on the answering chat)", async () => {
    const router = mount(`/app/runs/${RUN_ID}`)
    await act(async () => {})
    act(() => nav().entityLink.leave({ view: "chat", threadId: THREAD_B }))
    await waitFor(() => expect(where(router)).toBe(`/app/chat/${THREAD_B}`))
    expect(router.state.historyAction).toBe("REPLACE")
  })

  it("openRoute(route) PUSHES one entry, so Back returns to the card (D-15)", async () => {
    const router = mount(`/app/runs/${RUN_ID}`)
    const counter = pushCounter(router)
    act(() => nav().entityLink.openRoute({ view: "workflows" }))
    await waitFor(() => expect(where(router)).toBe("/app/workflows"))
    expect(counter.pushed()).toBe(1)
    await act(() => router.navigate(-1))
    await waitFor(() => expect(where(router)).toBe(`/app/runs/${RUN_ID}`))
    counter.unsubscribe()
  })
})

describe("useAppNavigation — entityLink.resume (299-03 / D-24, Pitfall 7)", () => {
  afterEach(() => window.sessionStorage.clear())

  it("on /app, a remembered target REPLACES the address (no new entry) and is consumed", async () => {
    rememberReturnTarget(`/app/runs/${RUN_ID}`)
    const router = mount("/app")
    const counter = pushCounter(router)
    act(() => nav().entityLink.resume())
    await waitFor(() => expect(where(router)).toBe(`/app/runs/${RUN_ID}`))
    expect(router.state.historyAction).toBe("REPLACE")
    expect(counter.pushed()).toBe(0)
    expect(takeReturnTarget()).toBeNull()
    counter.unsubscribe()
  })

  it("on bare / it is replaced too", async () => {
    rememberReturnTarget(`/app/chat/${THREAD_A}`)
    const router = mount("/")
    act(() => nav().entityLink.resume())
    await waitFor(() => expect(where(router)).toBe(`/app/chat/${THREAD_A}`))
    expect(router.state.historyAction).toBe("REPLACE")
  })

  it("anywhere else the address is left alone — and the stored value is still consumed", async () => {
    rememberReturnTarget(`/app/runs/${RUN_ID}`)
    const router = mount("/app/library")
    const key = router.state.location.key
    act(() => nav().entityLink.resume())
    await act(async () => {})
    expect(where(router)).toBe("/app/library")
    expect(router.state.location.key).toBe(key)
    expect(takeReturnTarget()).toBeNull()
  })

  it("with nothing remembered it writes nothing", async () => {
    const router = mount("/app")
    const key = router.state.location.key
    act(() => nav().entityLink.resume())
    await act(async () => {})
    expect(router.state.location.key).toBe(key)
  })
})
