import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HonestNotice } from "@/components/auth/HonestNotice"
import { getSsoRoute } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"

interface Props {
  onSubmit: (email: string, password: string) => Promise<void>
  onSwitch: () => void
}

// Phase 168 (SSO-01 / D-168-02): identifier-first login. The resting form is a 3-second read —
// ONE email field + "Continue". On Continue the email's domain is looked up (GET /org/sso/route);
// a domain with an ACTIVE SSO connection redirects to the IdP (signInWithSSO), every other case
// reveals the RETAINED password field. Crucially, ANY route-lookup failure (403 / network /
// outage) FAILS OPEN to the password field — a route outage must degrade to password login, never
// a lockout (T-168-07 / SC#3). getSsoRoute is a pre-auth bare fetch; signInWithSSO comes from
// useAuth (the password path onSubmit is untouched).
export function SignInForm({ onSubmit, onSwitch }: Props) {
  const { signInWithSSO } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  // "email" = the resting identifier step (Continue); "password" = the revealed password step
  // (Sign In). Once revealed, the form never re-hides the password — the user stays unlocked.
  const [phase, setPhase] = useState<"email" | "password">("email")
  // D-13: display-only. True ONLY when the reveal came from a route-lookup OUTAGE (the
  // handleContinue catch), so the revealed password field can carry a reassuring calm note.
  // Gates NOTHING — the fail-open reveal behavior is byte-frozen (T-168-07 / SC#3).
  const [degraded, setDegraded] = useState(false)

  // The identifier step: route the domain, or fail OPEN to the password field.
  const handleContinue = async () => {
    const domain = email.split("@")[1]?.toLowerCase()
    if (!domain) {
      // No parseable domain — nothing to route on; reveal the password field.
      setPhase("password")
      return
    }
    let sso = false
    try {
      const route = await getSsoRoute(domain)
      sso = route.sso
    } catch {
      // FAIL OPEN: a 403 / network error / route-service outage degrades to password login —
      // reveal the password field so the user can STILL sign in; never blank or lock the form.
      // D-13: mark THIS reveal as an outage-degrade so it carries a reassuring calm note (the
      // non-SSO reveal below is a NORMAL reveal, not a degrade — no note there).
      setDegraded(true)
      setPhase("password")
      return
    }
    if (sso) {
      try {
        await signInWithSSO(domain) // redirects to the IdP on success (leaves the page)
      } catch {
        // The redirect failed — surface the copy AND reveal the password so the user can still
        // sign in with a password (SC#3); never blank the form.
        setError("We couldn't start SSO sign-in. Try again, or sign in with your password.")
        setPhase("password")
      }
    } else {
      // No active SSO for this domain — reveal the retained password fallback (D-168-02).
      setPhase("password")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      if (phase === "email") {
        await handleContinue()
      } else {
        await onSubmit(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed")
    } finally {
      setLoading(false)
    }
  }

  // The secondary escape hatch — force SSO for the typed email's domain (IdP-initiated /
  // no-domain-match edge cases). Surfaces the redirect-failed copy on error; never blanks.
  const handleSsoEscape = async () => {
    setError("")
    const domain = email.split("@")[1]?.toLowerCase()
    if (!domain) {
      setError("Enter your work email above, then choose Sign in with SSO.")
      return
    }
    setLoading(true)
    try {
      await signInWithSSO(domain)
    } catch {
      setError("We couldn't start SSO sign-in. Try again, or sign in with your password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
      </div>
      {phase === "password" && (
        <div className="space-y-2 animate-fadeSlideUp">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>
      )}
      {/* D-13: the outage-degrade is legible, never a lockout — a calm reassurance, not an error. */}
      {phase === "password" && degraded && (
        <HonestNotice severity="calm">
          Nothing's wrong with your account — sign-in routing is temporarily unavailable, so you can
          sign in with your password.
        </HonestNotice>
      )}
      {error && <HonestNotice severity="error">{error}</HonestNotice>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : phase === "email" ? "Continue" : "Sign In"}
      </Button>
      <p className="text-center">
        <button
          type="button"
          onClick={handleSsoEscape}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Sign in with SSO
        </button>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <button type="button" onClick={onSwitch} className="underline hover:text-foreground">
          Sign up
        </button>
      </p>
    </form>
  )
}
