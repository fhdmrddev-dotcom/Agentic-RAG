/**
 * Phase 167 Plan 06 (INV-01 / INV-02 / D-167-01) — AcceptInvitePage tests.
 *
 * Locks the /invite accept-landing contract that App.tsx routes to at
 * `window.location.pathname === "/invite"` (a guarded window.location branch, no url router):
 *   - an UNAUTHENTICATED invitee sees the invite-branded auth (SignIn/SignUp), NOT an accept;
 *   - an AUTHENTICATED invitee's FIRST session calls acceptInvitation(token) ONCE with the raw
 *     token read from the URL, then shows a join confirmation (INV-02);
 *   - an idempotent already-accepted re-accept (joined=false) reads as "already a member";
 *   - a missing token and an expired/revoked (ApiError 409) / invalid (404) token surface
 *     HONEST messages, never a raw error or crash.
 *
 * `@/lib/api` is mocked so the component never loads the real supabase-bearing client; the
 * `user` + auth actions arrive as props (App supplies them from useAuth). window.location is
 * stubbed per-test to thread the ?token=… into the component's URLSearchParams capture and to
 * absorb the post-accept redirect.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import type { User } from "@supabase/supabase-js"

vi.mock("@/lib/api", () => ({
  acceptInvitation: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
      this.name = "ApiError"
    }
  },
}))

import { AcceptInvitePage } from "./AcceptInvitePage"
import { acceptInvitation, ApiError } from "@/lib/api"

const acceptMock = vi.mocked(acceptInvitation)

const FAKE_USER = { id: "u-1", email: "invitee@acme.test" } as unknown as User
const assignMock = vi.fn()
const realLocation = window.location

function stubLocation(search: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      assign: assignMock,
      search,
      pathname: "/invite",
      href: `http://localhost/invite${search}`,
    },
  })
}

function makeProps(overrides: Partial<React.ComponentProps<typeof AcceptInvitePage>> = {}) {
  return {
    user: null as User | null,
    onSignIn: vi.fn().mockResolvedValue(undefined),
    onSignUp: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.sessionStorage.clear()
  stubLocation("?token=tok-abc")
})

afterEach(() => {
  window.sessionStorage.clear()
  Object.defineProperty(window, "location", { configurable: true, value: realLocation })
})

describe("AcceptInvitePage — unauthenticated invitee (INV-01)", () => {
  it("renders the invite-branded auth (identifier-first SignIn) and does NOT accept yet", () => {
    render(<AcceptInvitePage {...makeProps({ user: null })} />)
    expect(screen.getByText(/you've been invited/i)).toBeInTheDocument()
    // Phase 168: the SignInForm is identifier-first — the resting CTA is "Continue" (the
    // password field + "Sign In" reveal only after the domain lookup). Its presence proves
    // the auth form rendered for the unauthenticated invitee.
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument()
    expect(acceptMock).not.toHaveBeenCalled()
  })
})

describe("AcceptInvitePage — authenticated accept (INV-02)", () => {
  it("calls acceptInvitation with the URL token exactly once and confirms the join", async () => {
    acceptMock.mockResolvedValue({ org_id: "org-1", role: "member", joined: true })
    render(<AcceptInvitePage {...makeProps({ user: FAKE_USER })} />)

    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith("tok-abc"))
    expect(acceptMock).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(screen.getByText(/you've joined the organization/i)).toBeInTheDocument(),
    )
  })

  it("reads an idempotent already-accepted re-accept (joined=false) as already-a-member", async () => {
    acceptMock.mockResolvedValue({ org_id: "org-1", role: "member", joined: false })
    render(<AcceptInvitePage {...makeProps({ user: FAKE_USER })} />)

    await waitFor(() =>
      expect(screen.getByText(/already belong to this organization/i)).toBeInTheDocument(),
    )
  })
})

describe("AcceptInvitePage — honest failure states", () => {
  it("shows an honest missing-token message when the link carries no token", () => {
    stubLocation("")
    render(<AcceptInvitePage {...makeProps({ user: FAKE_USER })} />)
    expect(screen.getByText(/missing its token/i)).toBeInTheDocument()
    expect(acceptMock).not.toHaveBeenCalled()
  })

  it("shows an honest expired/revoked message on a 409", async () => {
    acceptMock.mockRejectedValue(new ApiError("nope", 409))
    render(<AcceptInvitePage {...makeProps({ user: FAKE_USER })} />)
    await waitFor(() =>
      expect(screen.getByText(/expired or been revoked/i)).toBeInTheDocument(),
    )
  })

  it("shows an honest invalid-link message on a 404", async () => {
    acceptMock.mockRejectedValue(new ApiError("nope", 404))
    render(<AcceptInvitePage {...makeProps({ user: FAKE_USER })} />)
    await waitFor(() =>
      expect(screen.getByText(/invite link is invalid/i)).toBeInTheDocument(),
    )
  })
})
