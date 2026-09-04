/**
 * Phase 167 Plan 06 (INV-01 / INV-02 / D-167-01) — the `/invite` accept-invite landing.
 *
 * An invitee opens the emailed/copied `/invite?token=…` link. If they are not yet
 * authenticated they sign IN (existing account → additively join as a 2nd org, D-167-01)
 * or sign UP (fresh → the mig-105 trigger mints their personal org, then the accept
 * additively joins the inviting org). On their FIRST authenticated session the page calls
 * `acceptInvitation(token)` ONCE (INV-02) — idempotent + re-runnable server-side (Plan 01/02:
 * advisory lock + ON CONFLICT DO NOTHING), so it converges whether GoTrue email-confirmation
 * is on or off (RESEARCH OQ1). The raw token is captured from the URL and mirrored into
 * sessionStorage so it survives an email-confirm reload that drops the query string.
 *
 * On success the page redirects to the app root (`window.location.assign("/")`) so the
 * shipped 166 OrgProvider re-probes on a fresh mount and the org switcher (renders at 2+
 * orgs) shows both the invitee's personal org and the org they just joined — NO new switcher
 * code (D-167-01). Expired / revoked / invalid / already-a-member outcomes surface a plain,
 * honest message, never a raw error.
 *
 * Routing (no url router): App.tsx renders this at `window.location.pathname === "/invite"`,
 * BEFORE the `!user` AuthPage return, mirroring the shipped `/setup` precedent — so an
 * unauthenticated invitee gets the invite-branded auth and an already-authenticated visitor
 * still lands on the accept flow (not straight into ChatLayout).
 *
 * Brand shell cloned verbatim from AuthPage.tsx (org-indigo `primary` + violet orbs; the
 * reserved operator warning tint is never used here).
 */
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { User } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { AuthCardShell } from "@/components/auth/AuthCardShell"
import { HonestNotice } from "@/components/auth/HonestNotice"
import { SignInForm } from "@/components/auth/SignInForm"
import { SignUpForm } from "@/components/auth/SignUpForm"
import { acceptInvitation, ApiError, ACTIVE_ORG_STORAGE_KEY } from "@/lib/api"

interface Props {
  /** The authenticated user (or null when signed out) — supplied by App's useAuth. When this
   *  resolves non-null, the page fires the accept once. */
  user: User | null
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
}

/** sessionStorage key so the raw invite token survives an email-confirm round-trip that
 *  drops the URL query string (RESEARCH OQ1). Same-origin, transient, single-use. */
const PENDING_TOKEN_KEY = "pending-invite-token"

/**
 * Capture the raw token ONCE: prefer the live URL, fall back to a token persisted from an
 * earlier visit (survives an email-confirm reload). Mirrors any URL token into sessionStorage.
 */
function captureToken(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get("token")
  try {
    if (fromUrl) {
      window.sessionStorage.setItem(PENDING_TOKEN_KEY, fromUrl)
      return fromUrl
    }
    return window.sessionStorage.getItem(PENDING_TOKEN_KEY)
  } catch {
    // private-mode / SSR: the URL token is the load-bearing carrier.
    return fromUrl
  }
}

type AcceptState =
  | { kind: "auth" }
  | { kind: "accepting" }
  | { kind: "joined" }
  | { kind: "already" }
  | { kind: "missing" }
  | { kind: "error"; message: string }

export function AcceptInvitePage({ user, onSignIn, onSignUp }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  // Capture once (a useState initializer runs a single time) — URL → sessionStorage fallback.
  const [token] = useState<string | null>(captureToken)
  const [state, setState] = useState<AcceptState>(() =>
    !token ? { kind: "missing" } : user ? { kind: "accepting" } : { kind: "auth" },
  )
  // Fire the accept AT MOST ONCE per authed session (guards re-renders + the StrictMode
  // double-invoke; the server accept is idempotent regardless — T-167-21).
  const firedRef = useRef(false)

  useEffect(() => {
    if (!user || !token || firedRef.current) return
    firedRef.current = true
    setState({ kind: "accepting" })
    ;(async () => {
      try {
        const result = await acceptInvitation(token)
        // The token is single-use server-side — drop the persisted copy.
        try {
          window.sessionStorage.removeItem(PENDING_TOKEN_KEY)
        } catch {
          /* private-mode — nothing was persisted */
        }
        // Land the invitee IN the org they just joined (not their auto-created personal
        // org). Seed the active-org id BEFORE the redirect so OrgProvider re-mounts with
        // the invited org active — otherwise the join is invisible behind the switcher.
        if (result.org_id) {
          try {
            window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, result.org_id)
          } catch {
            /* private-mode — the switcher still exposes the new membership */
          }
        }
        setState({ kind: result.joined ? "joined" : "already" })
        // Redirect to the app root so OrgProvider re-probes on a fresh mount and the 166
        // switcher renders both orgs (D-167-01). A brief pause lets the invitee see the confirm.
        window.setTimeout(() => window.location.assign("/app"), 1500)
      } catch (err) {
        // Honest, user-facing messages — never a raw error string.
        let message =
          "We couldn't accept this invitation. Please ask whoever invited you to send a fresh link."
        if (err instanceof ApiError) {
          if (err.status === 404) {
            message =
              "This invite link is invalid. Please ask whoever invited you for a fresh link."
          } else if (err.status === 409) {
            message =
              "This invitation has expired or been revoked. Please ask whoever invited you to resend it."
          }
        }
        setState({ kind: "error", message })
      }
    })()
  }, [user, token])

  const goToApp = () => window.location.assign("/app")

  // The state-specific sub-headline + card body. The brand shell is shared below.
  let subhead = ""
  let body: ReactNode = null

  switch (state.kind) {
    case "auth":
      subhead = "Sign in or create an account to join the organization."
      body =
        mode === "signin" ? (
          <SignInForm onSubmit={onSignIn} onSwitch={() => setMode("signup")} />
        ) : (
          <SignUpForm onSubmit={onSignUp} onSwitch={() => setMode("signin")} />
        )
      break
    case "accepting":
      subhead = "Joining the organization…"
      // In-progress → the indigo spinner (HonestNotice progress). Copy verbatim.
      body = <HonestNotice severity="progress">Accepting your invitation…</HonestNotice>
      break
    case "joined":
      subhead = "You're in!"
      // Positive terminal → the green check (HonestNotice success). Copy verbatim.
      body = (
        <HonestNotice severity="success">
          You've joined the organization. Taking you to the app…
        </HonestNotice>
      )
      break
    case "already":
      subhead = "You're already a member"
      body = (
        <HonestNotice severity="success">
          You already belong to this organization. Taking you to the app…
        </HonestNotice>
      )
      break
    case "missing":
      subhead = "This invite link looks incomplete"
      // D-12: a recoverable dead-end ("ask for a fresh link") — CALM (Info, muted), never the
      // alarming red warning glyph. Copy verbatim; the Go-to-app affordance stays.
      body = (
        <div className="space-y-4">
          <HonestNotice severity="calm">
            This invite link is missing its token. Please ask whoever invited you for a fresh link.
          </HonestNotice>
          <Button variant="outline" className="w-full" onClick={goToApp}>
            Go to the app
          </Button>
        </div>
      )
      break
    case "error":
      subhead = "We couldn't accept this invite"
      // D-12: the 404 (invalid) / 409 (expired-or-revoked) / generic messages are ALL recoverable
      // "ask for a fresh link" dead-ends — CALM, not red. The honest copy (:116-124) is unchanged.
      body = (
        <div className="space-y-4">
          <HonestNotice severity="calm">{state.message}</HonestNotice>
          <Button variant="outline" className="w-full" onClick={goToApp}>
            Go to the app
          </Button>
        </div>
      )
      break
  }

  return (
    <AuthCardShell title="You've been invited" subhead={subhead}>
      {body}
    </AuthCardShell>
  )
}
