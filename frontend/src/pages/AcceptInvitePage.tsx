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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SignInForm } from "@/components/auth/SignInForm"
import { SignUpForm } from "@/components/auth/SignUpForm"
import { Sparkles, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
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
        window.setTimeout(() => window.location.assign("/"), 1500)
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

  const goToApp = () => window.location.assign("/")

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
      body = (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Accepting your invitation…</span>
        </div>
      )
      break
    case "joined":
      subhead = "You're in!"
      body = (
        <div className="space-y-3 py-4 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            You've joined the organization. Taking you to the app…
          </p>
        </div>
      )
      break
    case "already":
      subhead = "You're already a member"
      body = (
        <div className="space-y-3 py-4 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            You already belong to this organization. Taking you to the app…
          </p>
        </div>
      )
      break
    case "missing":
      subhead = "This invite link looks incomplete"
      body = (
        <div className="space-y-4 py-4 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            This invite link is missing its token. Please ask whoever invited you for a fresh link.
          </p>
          <Button variant="outline" className="w-full" onClick={goToApp}>
            Go to the app
          </Button>
        </div>
      )
      break
    case "error":
      subhead = "We couldn't accept this invite"
      body = (
        <div className="space-y-4 py-4 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{state.message}</p>
          <Button variant="outline" className="w-full" onClick={goToApp}>
            Go to the app
          </Button>
        </div>
      )
      break
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background gradient orbs (cloned from AuthPage) */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

      <Card className="w-full max-w-md ghost-border bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5 relative z-10">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-headline font-bold">You've been invited</CardTitle>
            <CardDescription className="mt-1.5">{subhead}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
    </div>
  )
}
