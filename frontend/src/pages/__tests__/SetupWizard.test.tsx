/**
 * Phase 158 Plan 11 (DEPLOY-02 / SC#1-2, D-06/D-14) — the App pre-auth /setup branch.
 *
 * Realizes the Wave-0 it.todo scaffold as live render tests: App probes GET /setup/status
 * at startup and renders <SetupWizard/> on needs_setup (or a literal /setup path of an
 * un-finalized box); a finalized /setup visit renders the "Setup is already complete"
 * lock-out (SC#2), never a config field; and a configured, non-/setup box renders the
 * unchanged AuthPage path (byte-identical). No react-router — a window.location.pathname
 * check honours the literal /setup path (D-06).
 *
 * useAuth is mocked (deterministic auth state, no Supabase session); @/lib/api and
 * @/lib/supabase are PARTIAL-mocked (override only getSetupStatus + hydrate, keep every
 * other real export the App subtree imports).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

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
    render(<App />)
    // The wizard's first screen is the setup-token gate.
    expect(await screen.findByText("Let's set up your workspace")).toBeInTheDocument()
    // NOT the configured-box auth path.
    expect(screen.queryByText("Sign in to your account")).not.toBeInTheDocument()
  })

  it("a `window.location.pathname === '/setup'` visit forces the wizard even when configured", async () => {
    // Configured (needs_setup:false) but NOT finalized, visiting /setup → wizard (D-06).
    mockGetSetupStatus.mockResolvedValue({ needs_setup: false, finalized: false, has_token: true })
    setPath("/setup")
    render(<App />)
    expect(await screen.findByText("Let's set up your workspace")).toBeInTheDocument()
  })

  it("a configured box (needs_setup:false, no /setup path) renders AuthPage/ChatLayout, NOT the wizard", async () => {
    mockGetSetupStatus.mockResolvedValue({ needs_setup: false, finalized: false, has_token: false })
    render(<App />)
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
    render(<App />)
    expect(await screen.findByText("Setup is already complete.")).toBeInTheDocument()
    // No config surface — the lock-out has no inputs (no re-entry, D-14).
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByText("Let's set up your workspace")).not.toBeInTheDocument()
  })

  it("the lock-out directs re-configuration to the /admin operator surface, not the public wizard", async () => {
    mockGetSetupStatus.mockResolvedValue({ needs_setup: false, finalized: true, has_token: true })
    setPath("/setup")
    render(<App />)
    // The lock-out points at the Admin area + a go-to-app CTA — never a setup field.
    expect(await screen.findByText(/use the Admin/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /go to the app/i })).toBeInTheDocument()
  })
})
