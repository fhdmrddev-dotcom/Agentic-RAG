// ─────────────────────────────────────────────────────────────────────────────
// Phase 158 Plan 09 (DEPLOY-02 / UI-SPEC §1, D-15) — the first-run setup-token gate.
//
// The FIRST screen of the install wizard, before any step. Mirrors the AuthPage
// centered-card shell (`pages/AuthPage.tsx:15-43`) + the SignInForm field/error
// markup. The operator reads a one-time setup token from `docker compose logs
// backend` and pastes it here; the token then gates every `/setup/*` write
// (D-15 — a pre-auth surface with NO RLS backstop, so the token is the sole
// access authority).
//
// SECURITY (T-158-10): the token is a secret. It is entered into a MASKED input
// (`type=password` + Eye/EyeOff — the ProviderPicker pattern the threat model
// mandates) and is NEVER echoed back in full — the only place it is displayed is
// the success line, masked to its last 4 (`maskToLast4`).
//
// VALIDATION: the light `postDetect()` probe is the cheapest token-gated write —
// a 2xx proves the token AND its DetectResult doubles as step-1's env orientation
// (D-08), so the wizard host gets both from this single call. A 401 = bad/expired
// token (destructive inline); a 429 = rate-limited (amber inline + a brief disable).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Copy, Check, KeyRound, Loader2 } from "lucide-react"
import { postDetect, SetupApiError, type DetectResult } from "@/lib/setupApi"
import { cn } from "@/lib/utils"

/** The command the operator runs to surface the token — rendered in a copyable mono chip. */
const LOGS_COMMAND = "docker compose logs backend"

/** Mask a token to its last 4 characters — the ONLY form the token is ever echoed in
 *  (T-158-10: never render the full token string anywhere). */
function maskToLast4(token: string): string {
  const t = token.trim()
  if (t.length <= 4) return "····"
  return `····${t.slice(-4)}`
}

interface SetupTokenGateProps {
  /**
   * Emit the accepted token + the light detect probe result up to the wizard host.
   * The validation probe IS the first env-detect (D-08), so the host stores both and
   * hands `detect` straight to the EnvironmentDetectCard — no second round-trip.
   */
  onTokenAccepted: (token: string, detect: DetectResult) => void
}

type GateState =
  | { kind: "idle" }
  | { kind: "validating" }
  | { kind: "error"; tone: "bad" | "rate-limited"; message: string }
  | { kind: "success"; last4: string }

export function SetupTokenGate({ onTokenAccepted }: SetupTokenGateProps) {
  const [token, setToken] = useState("")
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const [state, setState] = useState<GateState>({ kind: "idle" })

  const validating = state.kind === "validating"
  const rateLimited = state.kind === "error" && state.tone === "rate-limited"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = token.trim()
    if (!trimmed || validating || rateLimited) return
    setState({ kind: "validating" })
    try {
      // The light detect probe is the cheapest token-gated write — a 2xx proves the
      // token; its DetectResult doubles as step-1's env orientation (D-08).
      const detect = await postDetect(trimmed)
      setState({ kind: "success", last4: maskToLast4(trimmed) })
      onTokenAccepted(trimmed, detect)
    } catch (err) {
      if (err instanceof SetupApiError && err.status === 429) {
        setState({
          kind: "error",
          tone: "rate-limited",
          message: "Too many tries. Wait about a minute, then paste the token again.",
        })
        // Brief disable, then re-enable so the operator can retry (the server enforces
        // the real rate limit; this just paces the UI).
        window.setTimeout(
          () =>
            setState((s) =>
              s.kind === "error" && s.tone === "rate-limited" ? { kind: "idle" } : s,
            ),
          5000,
        )
        return
      }
      const message =
        err instanceof SetupApiError && err.status !== 401 && err.message
          ? err.message
          : "That token didn't match. Copy the whole token line from your backend logs and paste it again."
      setState({ kind: "error", tone: "bad", message })
    }
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(LOGS_COMMAND)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the command is visible in the chip regardless */
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Background gradient orbs — the AuthPage entry-shell language. */}
      <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" aria-hidden="true" />

      <Card className="ghost-border relative z-10 w-full max-w-md bg-card/80 shadow-xl shadow-black/5 backdrop-blur-sm">
        <CardHeader className="space-y-4 pb-2 text-center">
          <div className="flex justify-center">
            <div className="gradient-primary flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg shadow-primary/25">
              <KeyRound className="h-7 w-7 text-white" aria-hidden="true" />
            </div>
          </div>
          <div>
            <CardTitle className="font-headline text-xl font-semibold">Let's set up your workspace</CardTitle>
            <CardDescription className="mt-1.5">
              Paste the setup token from your server logs to begin.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Where the token comes from — a copyable mono command chip. */}
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
              <p className="mb-1.5 leading-relaxed">
                Run this on your server and copy the line that starts with{" "}
                <span className="font-semibold text-foreground">Setup token:</span>
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate font-mono text-[11px] text-foreground/90">{LOGS_COMMAND}</code>
                <button
                  type="button"
                  onClick={copyCommand}
                  aria-label="Copy the logs command"
                  className="flex-none rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup-token">Setup token</Label>
              <div className="relative flex items-center">
                <Input
                  id="setup-token"
                  type={show ? "text" : "password"}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value)
                    if (state.kind === "error") setState({ kind: "idle" })
                  }}
                  placeholder="Paste your setup token"
                  className="pr-9 font-mono"
                  aria-invalid={state.kind === "error"}
                  aria-describedby={state.kind === "error" ? "setup-token-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide value" : "Show value"}
                  className="absolute right-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {show ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {state.kind === "error" && (
              <p
                id="setup-token-error"
                role="alert"
                className={cn(
                  "text-sm",
                  state.tone === "rate-limited" ? "text-amber-600 dark:text-amber-400" : "text-destructive",
                )}
              >
                {state.message}
              </p>
            )}

            {state.kind === "success" && (
              <p role="status" className="flex items-center gap-1.5 text-sm text-success">
                <Check className="h-4 w-4" aria-hidden="true" />
                Setup session active · <span className="font-mono">{state.last4}</span>
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={validating || rateLimited || token.trim().length === 0}
            >
              {validating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking…
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
