/**
 * Phase 299-05 (LINK-06 / D-26 / S6 / SEED-312 / T-299-15) — the boot screen gives up with words.
 *
 * One clock from mount:
 *   0-8 s   today's splash, verbatim (role=status, aria-label "Loading Syrel", the thinking Iris);
 *   8-20 s  plus "Still connecting…" inside the same status wrapper;
 *   > 20 s  "Can't reach Syrel" + "Check your connection and try again." (+ the kept sentence only
 *           on an entity address) + a focused "Try again" that reloads — keeping the URL, so the
 *           link survives, and never a History write.
 * BootScreen never decides auth: a slow session read stays on this screen and is never shown the
 * sign-in form because of a timeout (Pitfall 6).
 *
 * The address is positioned with `history.replaceState` IN THIS TEST ONLY.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    session: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithSSO: vi.fn(),
    signOut: vi.fn(),
  })),
}))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getSetupStatus: vi.fn() }
})
vi.mock("@/lib/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase")>()
  return { ...actual, hydrateSupabaseFromRuntime: vi.fn().mockResolvedValue(undefined) }
})

import { BootScreen, BOOT_COPY } from "@/components/layout/BootScreen"
import App from "@/App"
import { getSetupStatus } from "@/lib/api"

const RUN_ID = "229f45ae-c85e-4707-a46c-bf4787541547"

function at(path: string) {
  window.history.replaceState(null, "", path)
}
function iris(): HTMLElement | null {
  return document.querySelector("[data-state]")
}

const realLocation = window.location
let reload: ReturnType<typeof vi.fn>

beforeEach(() => {
  at("/")
  vi.useFakeTimers()
  reload = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  if (window.location !== realLocation) {
    Object.defineProperty(window, "location", { configurable: true, value: realLocation })
  }
  at("/")
})

function stubReload() {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...realLocation,
      pathname: realLocation.pathname,
      search: realLocation.search,
      hash: realLocation.hash,
      href: realLocation.href,
      origin: realLocation.origin,
      reload,
    },
  })
}

describe("BootScreen — three stages on one clock (S6)", () => {
  it("0 s and 7.9 s: today's splash, verbatim, with no words", () => {
    const { container } = render(<BootScreen />)
    const status = screen.getByRole("status", { name: "Loading Syrel" })
    expect(status.parentElement?.className).toBe("flex h-screen items-center justify-center")
    expect(iris()?.getAttribute("data-state")).toBe("thinking")
    expect(container.textContent).toBe("")
    act(() => {
      vi.advanceTimersByTime(7_900)
    })
    expect(screen.getByRole("status", { name: "Loading Syrel" })).toBeInTheDocument()
    expect(screen.queryByText(BOOT_COPY.still)).toBeNull()
    expect(container.textContent).toBe("")
  })

  it("8 s: 'Still connecting…' appears inside the same status wrapper", () => {
    render(<BootScreen />)
    act(() => {
      vi.advanceTimersByTime(8_000)
    })
    const status = screen.getByRole("status", { name: "Loading Syrel" })
    const still = screen.getByText("Still connecting…")
    expect(status.contains(still)).toBe(true)
    expect(still.className).toContain("text-sm")
    expect(still.className).toContain("text-muted-foreground")
    expect(iris()?.getAttribute("data-state")).toBe("thinking")
  })

  it("20 s: gives up with a heading, a body and a focused Try again; the Iris rests", () => {
    render(<BootScreen />)
    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    const heading = screen.getByRole("heading", { level: 1, name: "Can't reach Syrel" })
    expect(heading).toBeInTheDocument()
    expect(screen.getByText("Check your connection and try again.")).toBeInTheDocument()
    expect(screen.queryByText(/Your link is kept/)).toBeNull()
    const retry = screen.getByRole("button", { name: "Try again" })
    expect(document.activeElement).toBe(retry)
    expect(iris()?.getAttribute("data-state")).toBe("idle")
    expect(screen.queryByText("Still connecting…")).toBeNull()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("on an entity address the give-up body also says the link is kept", () => {
    at(`/app/runs/${RUN_ID}`)
    render(<BootScreen />)
    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    expect(
      screen.getByText("Check your connection and try again. Your link is kept, so you'll still land on it."),
    ).toBeInTheDocument()
  })

  it("on plain /app the kept sentence is never promised", () => {
    at("/app")
    render(<BootScreen />)
    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    expect(screen.queryByText(/Your link is kept/)).toBeNull()
  })

  it("Try again reloads exactly once and writes no History entry", () => {
    const push = vi.spyOn(window.history, "pushState")
    const replace = vi.spyOn(window.history, "replaceState")
    render(<BootScreen />)
    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    stubReload()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it("unmounting before 8 s clears both timers (no update after unmount)", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    const clear = vi.spyOn(window, "clearTimeout")
    const { unmount } = render(<BootScreen />)
    expect(vi.getTimerCount()).toBe(2)
    unmount()
    expect(clear).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(errors).not.toHaveBeenCalled()
  })
})

describe("App — the splash branch is BootScreen (D-26)", () => {
  function renderApp() {
    const router = createMemoryRouter([{ path: "*", Component: App }], { initialEntries: ["/"] })
    render(<RouterProvider router={router} />)
  }

  it("while the setup probe has not answered, App shows the boot screen and it gives up at 20 s", () => {
    vi.mocked(getSetupStatus).mockReturnValue(new Promise(() => {}))
    renderApp()
    expect(screen.getByRole("status", { name: "Loading Syrel" })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    expect(screen.getByRole("heading", { level: 1, name: "Can't reach Syrel" })).toBeInTheDocument()
    // Never the sign-in form because of a timeout (Pitfall 6).
    expect(screen.queryByText("Sign in to your account")).toBeNull()
  })

  it("once auth and the probe have answered, App renders the sign-in card as today", async () => {
    vi.useRealTimers()
    vi.mocked(getSetupStatus).mockResolvedValue({ needs_setup: false, finalized: false, has_token: false })
    renderApp()
    expect(await screen.findByText("Sign in to your account")).toBeInTheDocument()
    expect(screen.queryByRole("status", { name: "Loading Syrel" })).toBeNull()
  })
})
