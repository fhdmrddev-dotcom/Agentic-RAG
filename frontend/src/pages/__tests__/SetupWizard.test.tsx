/**
 * Phase 158 Plan 11 (DEPLOY-02 / SC#1-2, D-06/D-14) — the App pre-auth /setup branch.
 *
 * Realizes the Wave-0 it.todo scaffold as live render tests: App probes GET /setup/status
 * at startup and renders <SetupWizard/> on needs_setup (or a literal /setup path of an
 * un-finalized box); a finalized /setup visit renders the "Setup is already complete"
 * lock-out (SC#2), never a config field; and a configured, non-/setup box renders the
 * unchanged AuthPage path (byte-identical). The pre-auth branch still reads
 * window.location.pathname for the literal /setup path (D-06); since Phase 297-02 App renders under
 * the one catch-all route, so each case mounts it in a memory router at the same path (D-297-13).
 *
 * useAuth is mocked (deterministic auth state, no Supabase session); @/lib/api and
 * @/lib/supabase are PARTIAL-mocked (override only getSetupStatus + hydrate, keep every
 * other real export the App subtree imports).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

// useAuth — controlled, so the auth branch is deterministic without a real session.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    session: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  })),
}))

// Partial-mock @/lib/api: override ONLY getSetupStatus; keep every other real export
// (MaintenanceBanner + the operator/features probes import from this same module).
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getSetupStatus: vi.fn() }
})

// Partial-mock @/lib/supabase: the runtime hydrate is a resolved no-op; keep the live
// client (App calls hydrateSupabaseFromRuntime at bootstrap before the auth check).
vi.mock("@/lib/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase")>()
  return { ...actual, hydrateSupabaseFromRuntime: vi.fn().mockResolvedValue(undefined) }
})

import App from "../../App"
import { getSetupStatus } from "@/lib/api"

const mockGetSetupStatus = vi.mocked(getSetupStatus)

function setPath(path: string) {
  window.history.pushState({}, "", path)
}

// D-297-13 (Phase 297-02, D-07 / D-17): RE-TARGETED, not retired. App now reads its view from the
// router (`useAppNavigation` calls the router hooks), so it can only render under one — exactly the
// ONE catch-all route main.tsx mounts. The memory router starts at the SAME path the case set with
// `setPath`, and `setPath` stays: App's pre-auth checks still read the browser address directly.
function renderApp() {
  const path = `${window.location.pathname}${window.location.search}`
  const router = createMemoryRouter([{ path: "*", Component: App }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  mockGetSetupStatus.mockReset()
  setPath("/")
})
afterEach(() => {
  cleanup()
})

describe("App pre-auth branch — needs_setup entry (SC#1 / D-06)", () => {
  it("App renders the setup wizard when GET /api/setup/status returns needs_setup:true", async () => {
    mockGetSetupStatus.mockResolvedValue({ needs_setup: true, finalized: false, has_token: true })
    renderApp()
    // The wizard's first screen is the setup-token gate.
    expect(await screen.findByText("Let's set up your workspace")).toBeInTheDocument()
    // NOT the configured-box auth path.
    expect(screen.queryByText("Sign in to your account")).not.toBeInTheDocument()
  })

  it("a `window.location.pathname === '/setup'` visit forces the wizard even when configured", async () => {
    // Configured (needs_setup:false) but NOT finalized, visiting /setup → wizard (D-06).
    mockGetSetupStatus.mockResolvedValue({ needs_setup: false, finalized: false, has_token: true })
    setPath("/setup")
    renderApp()
    expect(await screen.findByText("Let's set up your workspace")).toBeInTheDocument()
  })

  it("a configured box (needs_setup:false, no /setup path) renders AuthPage/ChatLayout, NOT the wizard", async () => {
    mockGetSetupStatus.mockResolvedValue({ needs_setup: false, finalized: false, has_token: false })
    renderApp()
    // The unchanged !user → AuthPage path (byte-identical to today).
    expect(await screen.findByText("Sign in to your account")).toBeInTheDocument()
    // The wizard never renders on the configured, non-/setup path.
    expect(screen.queryByText("Let's set up your workspace")).not.toBeInTheDocument()
  })
})

describe("finalized lock-out — post-finalize /setup (SC#2 / D-14)", () => {
  it("post-finalize /setup renders the 'Setup is already complete' lock-out, never a config field", async () => {
    mockGetSetupStatus.mockResolvedValue({ needs_setup: false, finalized: true, has_token: true })
    setPath("/setup")
    renderApp()
    expect(await screen.findByText("Setup is already complete.")).toBeInTheDocument()
    // No config surface — the lock-out has no inputs (no re-entry, D-14).
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByText("Let's set up your workspace")).not.toBeInTheDocument()
  })

  it("the lock-out directs re-configuration to the /admin operator surface, not the public wizard", async () => {
    mockGetSetupStatus.mockResolvedValue({ needs_setup: false, finalized: true, has_token: true })
    setPath("/setup")
    renderApp()
    // The lock-out points at the Admin area + a go-to-app CTA — never a setup field.
    expect(await screen.findByText(/use the Admin/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /go to the app/i })).toBeInTheDocument()
  })
})

describe("D-17: the router never rewrites a pre-auth address", () => {
  it("at /setup the router location stays /setup (never replaced, never canonicalised)", async () => {
    mockGetSetupStatus.mockResolvedValue({ needs_setup: false, finalized: false, has_token: true })
    setPath("/setup")
    const router = renderApp()
    expect(await screen.findByText("Let's set up your workspace")).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe("/setup"))
    expect(router.state.historyAction).toBe("POP")
  })
})
