/**
 * Phase 297 plan 01 (REG-09 / D-01 / D-29 wave 1) — CHARACTERIZATION of App's view/tab state
 * and its navigators, written BEFORE they move out of `App.tsx` into `useAppNavigation`.
 *
 * ── WHAT THIS SUITE IS FOR ───────────────────────────────────────────────────────────
 * The move is behaviour-neutral by contract: the initializer, the studio navigators, the
 * Library hand-off and `handleNavigate` travel byte-for-byte. Nothing mounted App's state
 * directly before this phase — App's own render path needs auth, the setup probe and the
 * provider stack — so the only proof the behaviour survived the move is a suite that pins
 * it on the hook itself. Plan 297-02 re-targets these cases to the URL; it never deletes
 * them, because every bullet here is a behaviour a shipped link or button depends on.
 *
 * ── HOW THE BOOT ADDRESS IS SET ──────────────────────────────────────────────────────
 * The initializer reads the browser address once, on mount. Each case writes the address
 * test-side with `window.history.replaceState` BEFORE `renderHook` (the `runDeepLink.test.ts`
 * idiom; test files are allowed raw History writes), and `afterEach` resets it to `/`.
 */
import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"

import { useAppNavigation } from "../useAppNavigation"
// The hook's own source, read as text for the D-01 "no router in Plan 1" fence below.
import hookSource from "../useAppNavigation.ts?raw"

const RUN_ID = "229f45ae-c85e-4707-a46c-bf4787541547"

function setUrl(path: string) {
  window.history.replaceState(null, "", path)
}

afterEach(() => {
  cleanup()
  setUrl("/")
})

describe("useAppNavigation — the boot initializer (moved verbatim from App.tsx)", () => {
  it("/admin/spend opens the spend view", () => {
    setUrl("/admin/spend")
    const { result } = renderHook(() => useAppNavigation())
    expect(result.current.activeView).toBe("admin-spend")
  })

  it("/admin/spend/<anything> opens the spend view too — the prefix rule", () => {
    setUrl("/admin/spend/x")
    const { result } = renderHook(() => useAppNavigation())
    expect(result.current.activeView).toBe("admin-spend")
  })

  it("/app?run=<uuid> opens the run page and KEEPS the query (a reload stays on the run)", () => {
    setUrl(`/app?run=${RUN_ID}`)
    const { result } = renderHook(() => useAppNavigation())
    expect(result.current.activeView).toBe("workflow-run")
    expect(window.location.search).toBe(`?run=${RUN_ID}`)
  })

  it("/app?connections=1&… opens Connections and DROPS the query, keeping the path", () => {
    setUrl("/app?connections=1&oauth_error=x")
    const { result } = renderHook(() => useAppNavigation())
    expect(result.current.activeView).toBe("connections")
    expect(window.location.search).toBe("")
    expect(window.location.pathname).toBe("/app")
  })

  it("/app opens chat — the home", () => {
    setUrl("/app")
    const { result } = renderHook(() => useAppNavigation())
    expect(result.current.activeView).toBe("chat")
  })
})

describe("useAppNavigation — the Skill Studio navigators", () => {
  it("handleOpenStudio(id) selects the skill, defaults the tab to evals and opens the studio", () => {
    setUrl("/app")
    const { result } = renderHook(() => useAppNavigation())
    act(() => result.current.handleOpenStudio("skill-1"))
    expect(result.current.studioSkillId).toBe("skill-1")
    expect(result.current.studioTab).toBe("evals")
    expect(result.current.activeView).toBe("skill-studio")
  })

  it("handleTuneSkill lands on Triggering; handleReviewEvals lands on Evals", () => {
    setUrl("/app")
    const { result } = renderHook(() => useAppNavigation())
    act(() => result.current.handleTuneSkill("skill-2"))
    expect(result.current.studioSkillId).toBe("skill-2")
    expect(result.current.studioTab).toBe("triggering")
    expect(result.current.activeView).toBe("skill-studio")
    act(() => result.current.handleReviewEvals("skill-3"))
    expect(result.current.studioSkillId).toBe("skill-3")
    expect(result.current.studioTab).toBe("evals")
  })

  it("handleStudioTabChange changes ONLY the tab", () => {
    setUrl("/app")
    const { result } = renderHook(() => useAppNavigation())
    act(() => result.current.handleOpenStudio("skill-4"))
    act(() => result.current.handleStudioTabChange("versions"))
    expect(result.current.studioTab).toBe("versions")
    expect(result.current.studioSkillId).toBe("skill-4")
    expect(result.current.activeView).toBe("skill-studio")
  })
})

describe("useAppNavigation — the Library hand-off is one-shot", () => {
  it("handleOpenLibraryHealth sets the Health hand-off and opens the Library", () => {
    setUrl("/app")
    const { result } = renderHook(() => useAppNavigation())
    act(() => result.current.handleOpenLibraryHealth())
    expect(result.current.libraryTab).toBe("health")
    expect(result.current.activeView).toBe("documents")
  })

  it("the next onNavigate anywhere else SPENDS it", () => {
    setUrl("/app")
    const { result } = renderHook(() => useAppNavigation())
    act(() => result.current.handleOpenLibraryHealth())
    act(() => result.current.onNavigate("chat"))
    expect(result.current.activeView).toBe("chat")
    expect(result.current.libraryTab).toBeUndefined()
  })

  it("bounceHome routes to chat and does NOT spend the hand-off (today's 403 setter)", () => {
    setUrl("/app")
    const { result } = renderHook(() => useAppNavigation())
    act(() => result.current.handleOpenLibraryHealth())
    act(() => result.current.bounceHome())
    expect(result.current.activeView).toBe("chat")
    expect(result.current.libraryTab).toBe("health")
  })

  it("bounceHome keeps ONE identity across renders, so App's 403 effect deps do not churn", () => {
    setUrl("/app")
    const { result } = renderHook(() => useAppNavigation())
    const first = result.current.bounceHome
    act(() => result.current.onNavigate("skills"))
    expect(result.current.bounceHome).toBe(first)
  })
})

describe("useAppNavigation — D-01: no router lands in Plan 1", () => {
  it("the hook's source imports no router package", () => {
    const src = hookSource.replace(/\r\n/g, "\n")
    // Non-vacuity: the ?raw import is the real module.
    expect(src).toContain("export function useAppNavigation")
    expect(src).not.toContain("react-router")
  })
})
