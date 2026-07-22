/**
 * Phase 168 Plan 06 Task 2 (SSO-01 / D-168-02 / T-168-07) — identifier-first SignInForm tests.
 *
 * The login form reworks to identifier-first: a resting email field + "Continue" that routes
 * the email's domain (GET /org/sso/route). A domain with an ACTIVE SSO connection redirects to
 * the IdP (signInWithSSO); every other case — including ANY route-lookup failure — reveals the
 * retained password field so NO user is ever locked out (SC#3, fail-open).
 *
 * The routing gate locks these beats:
 *   1. at rest, only the email field + "Continue" render (the password field is hidden);
 *   2. an SSO domain ({ sso: true }) → signInWithSSO(domain), NO password reveal;
 *   3. a non-SSO domain ({ sso: false }) → password reveal + "Sign In" relabel + the retained
 *      password onSubmit(email, password) fallback fires;
 *   4. a getSsoRoute FAILURE (403 / network / outage) FAILS OPEN → password reveal, never a
 *      blanked or locked form (T-168-07);
 *   5. a signInWithSSO redirect failure surfaces the "couldn't start SSO" copy, form usable;
 *   6. the secondary "Sign in with SSO" escape-hatch link is present.
 *
 * getSsoRoute (api) + signInWithSSO (useAuth) are the only network seams — both mocked.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SignInForm } from "./SignInForm"
import { getSsoRoute } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"

vi.mock("@/lib/api", () => ({
  getSsoRoute: vi.fn(),
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}))

const signInWithSSO = vi.fn<(domain: string) => Promise<void>>()
const onSubmit = vi.fn<(email: string, password: string) => Promise<void>>()
const onSwitch = vi.fn()

function renderForm() {
  return render(<SignInForm onSubmit={onSubmit} onSwitch={onSwitch} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  signInWithSSO.mockResolvedValue(undefined)
  onSubmit.mockResolvedValue(undefined)
  vi.mocked(useAuth).mockReturnValue({
    signInWithSSO,
  } as unknown as ReturnType<typeof useAuth>)
})

describe("SignInForm — identifier-first login (SSO-01 / D-168-02)", () => {
  it("at rest shows only the email field + Continue (the password field is hidden)", () => {
    renderForm()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument()
    // The 3-second-read resting state — the password Input is not in the DOM before Continue.
    expect(screen.queryByLabelText(/password/i)).toBeNull()
  })

  it("routes an SSO domain to signInWithSSO on Continue (no password reveal)", async () => {
    vi.mocked(getSsoRoute).mockResolvedValue({ sso: true })
    renderForm()
    await userEvent.type(screen.getByLabelText(/email/i), "user@ssocorp.com")
    await userEvent.click(screen.getByRole("button", { name: /continue/i }))

    expect(vi.mocked(getSsoRoute)).toHaveBeenCalledWith("ssocorp.com")
    await waitFor(() => expect(signInWithSSO).toHaveBeenCalledWith("ssocorp.com"))
    // An SSO domain redirects to the IdP — the password field never reveals.
    expect(screen.queryByLabelText(/password/i)).toBeNull()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("reveals the password field for a non-SSO domain and submits the password (SC#3)", async () => {
    vi.mocked(getSsoRoute).mockResolvedValue({ sso: false })
    renderForm()
    await userEvent.type(screen.getByLabelText(/email/i), "user@nopwd.com")
    await userEvent.click(screen.getByRole("button", { name: /continue/i }))

    const pwd = await screen.findByLabelText(/password/i)
    expect(pwd).toBeInTheDocument()
    // The CTA relabels to "Sign In" (today's password path, unchanged).
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument()

    await userEvent.type(pwd, "hunter2")
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }))
    // The RETAINED password fallback fires with the typed credentials.
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("user@nopwd.com", "hunter2"))
    expect(signInWithSSO).not.toHaveBeenCalled()
  })

  it("FAILS OPEN to the password field when the route lookup fails (T-168-07)", async () => {
    // A 403 / network error / route-service outage — the lookup itself rejects.
    vi.mocked(getSsoRoute).mockRejectedValue(new Error("route service unavailable"))
    renderForm()
    await userEvent.type(screen.getByLabelText(/email/i), "user@outage.com")
    await userEvent.click(screen.getByRole("button", { name: /continue/i }))

    // Fail open: the password field reveals so the user can STILL sign in — never a lockout.
    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument()
    // The form is not blanked — the email field is still present.
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(signInWithSSO).not.toHaveBeenCalled()
  })

  it("surfaces the redirect-failed copy when signInWithSSO throws, keeping the form usable", async () => {
    vi.mocked(getSsoRoute).mockResolvedValue({ sso: true })
    signInWithSSO.mockRejectedValue(new Error("redirect failed"))
    renderForm()
    await userEvent.type(screen.getByLabelText(/email/i), "user@ssocorp.com")
    await userEvent.click(screen.getByRole("button", { name: /continue/i }))

    expect(await screen.findByText(/couldn't start sso sign-in/i)).toBeInTheDocument()
    // Never blanked — the email field is still usable.
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it("renders the 'Sign in with SSO' escape-hatch link (secondary path)", () => {
    renderForm()
    expect(screen.getByRole("button", { name: /sign in with sso/i })).toBeInTheDocument()
  })
})
