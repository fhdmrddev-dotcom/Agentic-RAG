// ─────────────────────────────────────────────────────────────────────────────
// Phase 158 Plan 10 (DEPLOY-02 / UI-SPEC §5, D-11) — bootstrap the first operator.
//
// Create the FIRST admin account directly (the AuthPage sign-up markup): email +
// password + confirm. Plain framing — "This is your admin login" — because the
// audience is a non-developer operator, not someone who knows what "operator" or
// "service role" means. On submit the token-gated `postOperator()` creates the
// Supabase auth user (via the freshly-bound service-role key) + upserts the
// operator row (D-11), so the operator can log in as operator on their FIRST login
// — no signup gap, no restart.
//
// GATING (D-11): Continue is gated on a valid email + matching passwords + a
// minimum length. A confirm-mismatch is an inline DESTRUCTIVE message; a weak (but
// above-minimum) password is an AMBER advisory — never a hard block beyond the
// minimum. The password-strength hint is a slim determinate bar + word (the eval
// RunBar thin-bar analog), client-side + advisory only.
//
// HONESTY: a GoTrue password-policy rejection (400) renders the server's message
// VERBATIM (never a generic "failed"); a duplicate email resolves to an honest
// "already exists — you can log in as operator after setup" (idempotent re-entry,
// D-14), not an error.
//
// SECURITY (T-158-10 / T-158-06): the password + confirm are MASKED (type=password);
// no field renders the secret in full; there is NO raw-HTML injection sink anywhere
// (every message renders as plain React text).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, Loader2, Check, ShieldCheck } from "lucide-react"
import { postOperator, SetupApiError, type OperatorBody } from "@/lib/setupApi"
import { cn } from "@/lib/utils"

/** The advisory-but-gating minimum password length. The ONLY hard block on strength
 *  (a weak-above-minimum password is an amber advisory, never blocked — D-11). */
const MIN_PASSWORD_LENGTH = 8

/** A permissive client-side email shape check (the server is the real authority). */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** A slim client-side strength heuristic → a 0–4 score + word + fill width/tone for
 *  the determinate bar (the RunBar thin-bar analog). Advisory only — it never gates
 *  beyond the minimum length. */
function scorePassword(pw: string): { score: number; label: string; pct: number; tone: string } {
  if (!pw) return { score: 0, label: "—", pct: 0, tone: "bg-muted-foreground/30" }
  let score = 0
  if (pw.length >= MIN_PASSWORD_LENGTH) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  score = Math.min(score, 4)
  const label = ["Very weak", "Weak", "Fair", "Good", "Strong"][score]
  const tone = [
    "bg-destructive",
    "bg-amber-500",
    "bg-amber-400",
    "bg-primary",
    "bg-success",
  ][score]
  return { score, label, pct: (score / 4) * 100, tone }
}

interface OperatorBootstrapStepProps {
  /** The setup token — creating the operator is a token-gated write (D-15). */
  token: string
  /** The operator email — host-owned so the finalize step persists it to
   *  `operator_emails` (re-seedable across restarts, D-11). */
  email: string
  onEmailChange: (email: string) => void
  /** The bound infra the server needs to reach Supabase + create the auth user
   *  (from the Connect step — not yet finalized/persisted at this point). */
  bind?: Pick<OperatorBody, "supabase_url" | "supabase_service_role_key" | "postgres_dsn">
  /** Advance to the provider step once the operator account exists (created OR a
   *  pre-existing duplicate — both are a green light, idempotent re-entry D-14). */
  onCreated: () => void
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "creating" }
  | { kind: "error"; message: string }
  | { kind: "created"; alreadyExists: boolean }

export function OperatorBootstrapStep({
  token,
  email,
  onEmailChange,
  bind,
  onCreated,
}: OperatorBootstrapStepProps) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [state, setState] = useState<SubmitState>({ kind: "idle" })

  const emailValid = isValidEmail(email)
  const strength = scorePassword(password)
  const minMet = password.length >= MIN_PASSWORD_LENGTH
  // A confirm-mismatch is a hard, DESTRUCTIVE block (only once the operator has
  // started typing the confirmation — never scold an empty field).
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword
  // A weak-but-above-minimum password is an AMBER advisory (never a hard block).
  const weakAdvisory = minMet && strength.score <= 1
  const creating = state.kind === "creating"

  // Continue is gated on: a valid email + the minimum length + matching passwords.
  const canSubmit = emailValid && minMet && password === confirmPassword && !creating

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setState({ kind: "creating" })
    try {
      const result = await postOperator(token, {
        email: email.trim(),
        password,
        ...bind,
      })
      setState({ kind: "created", alreadyExists: result.already_exists })
    } catch (err) {
      // A GoTrue password-policy rejection (400) carries its message in `detail`
      // — render it VERBATIM so the operator sees the real rule, not a generic fail.
      const message =
        err instanceof SetupApiError
          ? err.message
          : "Couldn't create the admin account. Check the details and try again."
      setState({ kind: "error", message })
    }
  }

  // ── Success: the account exists — a beat to read, then Continue. ──────────────
  if (state.kind === "created") {
    return (
      <section aria-label="Create your admin login" className="space-y-5">
        <div>
          <h2 className="font-headline text-xl font-semibold text-foreground">Create your admin login</h2>
        </div>
        <div
          role="status"
          className="flex items-start gap-3 rounded-[10px] border border-success/40 bg-success/10 p-4"
        >
          <Check className="mt-0.5 h-5 w-5 flex-none text-success" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-success">
              {state.alreadyExists ? "This admin account already exists" : "Admin account created"}
            </p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              You can log in as operator right after setup with{" "}
              <span className="font-mono text-foreground">{email.trim()}</span>.
            </p>
          </div>
        </div>
        <Button onClick={onCreated} className="w-full sm:w-auto">
          Continue
        </Button>
      </section>
    )
  }

  return (
    <section aria-label="Create your admin login" className="space-y-5">
      <div>
        <h2 className="font-headline text-xl font-semibold text-foreground">Create your admin login</h2>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
          <span>
            This is your <span className="font-semibold text-foreground">admin login</span> — you'll use
            it to sign in and open the Admin area.
          </span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-[10px] border border-border bg-card/40 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="operator-email">Email</Label>
          <Input
            id="operator-email"
            type="email"
            value={email}
            onChange={(e) => {
              onEmailChange(e.target.value)
              if (state.kind === "error") setState({ kind: "idle" })
            }}
            placeholder="you@example.com"
            autoComplete="email"
            spellCheck={false}
            aria-invalid={email.length > 0 && !emailValid}
          />
          {email.length > 0 && !emailValid && (
            <p className="text-[12px] text-muted-foreground">Enter a valid email address.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="operator-password">Password</Label>
          <div className="relative flex items-center">
            <Input
              id="operator-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (state.kind === "error") setState({ kind: "idle" })
              }}
              placeholder="Choose a strong password"
              autoComplete="new-password"
              spellCheck={false}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Password-strength hint — a slim determinate bar + word (RunBar thin-bar
              analog). Advisory only; the WORD carries the meaning (never colour-alone). */}
          {password.length > 0 && (
            <div className="space-y-1 pt-0.5">
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Password strength"
                aria-valuemin={0}
                aria-valuemax={4}
                aria-valuenow={strength.score}
                aria-valuetext={strength.label}
              >
                <div
                  className={cn("h-full rounded-full transition-all", strength.tone)}
                  style={{ width: `${Math.max(strength.pct, 8)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Strength: <span className="font-medium text-foreground">{strength.label}</span>
                {!minMet && ` · at least ${MIN_PASSWORD_LENGTH} characters`}
              </p>
            </div>
          )}
          {weakAdvisory && (
            <p role="status" className="text-[12px] text-amber-600 dark:text-amber-400">
              This password is weak — a longer one is safer, but you can continue.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="operator-confirm">Confirm password</Label>
          <Input
            id="operator-confirm"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (state.kind === "error") setState({ kind: "idle" })
            }}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            spellCheck={false}
            aria-invalid={mismatch}
            aria-describedby={mismatch ? "operator-confirm-error" : undefined}
          />
          {mismatch && (
            <p id="operator-confirm-error" role="alert" className="text-[12px] text-destructive">
              Passwords don't match.
            </p>
          )}
        </div>

        {state.kind === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}

        <div className="space-y-1.5">
          <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> Creating…
              </>
            ) : (
              "Create admin account"
            )}
          </Button>
          {!canSubmit && !creating && (
            <p className="text-[11px] text-muted-foreground">
              Enter a valid email and matching passwords (at least {MIN_PASSWORD_LENGTH} characters) to
              continue.
            </p>
          )}
        </div>
      </form>
    </section>
  )
}
