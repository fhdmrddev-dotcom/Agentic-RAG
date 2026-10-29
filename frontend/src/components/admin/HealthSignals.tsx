// ─────────────────────────────────────────────────────────────────────────────
// Phase 146 Plan 05 (ADMIN-01) — the Overview health block (four plain signals).
//
// Renders the four REAL /admin/backpressure values under plain labels (D-07 /
// sketch 061-B copy), each with a one-line subtext. The raw field name is revealed
// beside each label ONLY when `showTechnical` is true — the LANG-01 two-audience
// reveal, born plain at 146.
//
//   anyio_threadpool_depth  → "Server capacity"
//   redis_active_runs       → "Agents working"
//   postgres_pool_in_use    → "Database connections"
//   per_worker_run_count    → "Work spread"
//
// Phase 147 Plan 07 (ADMIN-02 / 064-B) — the additive dependency-health row.
// Below the four backpressure signals we now render three dependency probes from
// the additive `signals.dependencies` payload (D-078-08): Redis / Database /
// Code sandbox, each a status dot honestly mapping the probe state:
//
//   up (fast)                   → success (green)
//   up but latency > threshold  → slow (amber)      — a working-but-degraded dep
//   down                        → destructive (red)
//   sandbox state === "off"     → NEUTRAL grey + "off by config"  (Pitfall 6 —
//                                 a deliberately-disabled sandbox is NEVER red)
//   dependencies absent / null  → neutral "—" placeholder (older backend / loading)
//
// Phase 300 (D-12 / UI-SPEC S5) — a FOURTH dependency tile, "Email", from the additive
// `dependencies.email` (the app mailer's mode + the newest outbox outcome). Its words
// live in `emailView` below; only "Last send failed" is red.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell (Plan 06) owns the fetch
// and the `showTechnical` toggle state and passes both down. A null `signals`
// (loading / not-yet-fetched) renders a calm dimmed placeholder — never a crash.
// ─────────────────────────────────────────────────────────────────────────────
import type { BackpressureSignals } from "@/lib/api"
import { cn } from "@/lib/utils"

interface HealthSignalsProps {
  /** The four raw signals from `GET /admin/backpressure`; null while loading. */
  signals: BackpressureSignals | null
  /** When true, reveal the raw field name beside each plain label (⌥ reveal). */
  showTechnical: boolean
}

interface SignalView {
  /** The plain, human-readable label (the default audience). */
  label: string
  /** A one-line plain subtext grounding the number. */
  sub: string
  /** The raw backpressure field name, revealed under ⌥ Technical names. */
  field: string
  /** The formatted value string. */
  value: string
}

// The plain-label mapping is the single source of truth for both the live and the
// placeholder rows, so the labels + fields always match 1:1 to the real payload.
const SIGNAL_ORDER: ReadonlyArray<Pick<SignalView, "label" | "sub" | "field">> = [
  { label: "Server capacity", sub: "parallel tasks in use right now", field: "anyio_threadpool_depth" },
  { label: "Agents working", sub: "chats with an agent running right now", field: "redis_active_runs" },
  { label: "Database connections", sub: "connections in use", field: "postgres_pool_in_use" },
  { label: "Work spread", sub: "runs on this server worker", field: "per_worker_run_count" },
]

function valueFor(field: string, s: BackpressureSignals): string {
  switch (field) {
    case "anyio_threadpool_depth":
      return `${s.anyio_threadpool_depth.borrowed} / ${s.anyio_threadpool_depth.total}`
    case "redis_active_runs":
      return `${s.redis_active_runs}`
    case "postgres_pool_in_use":
      return `${s.postgres_pool_in_use}`
    case "per_worker_run_count":
      return `${s.per_worker_run_count}`
    default:
      return "—"
  }
}

// ── Phase 147 Plan 07 (ADMIN-02) — dependency-health probes ──────────────────
// Any dependency answering slower than this (while still "up") reads as SLOW
// (amber) rather than green — a working-but-degraded dependency the operator
// should notice before it goes fully down. Tuned generously; the honest thing is
// "responds but sluggish", not a hard SLA.
const SLOW_LATENCY_MS = 500

/** One probe entry as it arrives on `signals.dependencies` (all three share the
 *  shape; `sandbox` additionally carries the "off" state). */
interface DepProbe {
  state: "off" | "up" | "down"
  latency_ms: number | null
}

/** The derived, display-facing dependency status. `slow` + `unknown` are CLIENT
 *  derivations (latency threshold / absent payload) — never wire states. */
type DepStatus = "up" | "slow" | "down" | "off" | "unknown"

// Plain labels + the raw `dependencies.<key>` field revealed under ⌥ Technical.
const DEP_ORDER: ReadonlyArray<{
  key: "redis" | "supabase" | "sandbox" | "email"
  label: string
  sub: string
}> = [
  { key: "redis", label: "Redis", sub: "in-memory run buffer" },
  { key: "supabase", label: "Database", sub: "Postgres, storage & auth" },
  { key: "sandbox", label: "Code sandbox", sub: "Docker code execution" },
  { key: "email", label: "Email", sub: "email delivery" },
]

// ── Phase 300 (D-12 / UI-SPEC S5) — the app mailer, as the operator sees it ───
// Additive `signals.dependencies.email` (health_probe.probe_email). It is wider than
// the three probes above (mode / provider / last outcome), so it is typed HERE and
// read off the payload — this leaf stays the one home of every tile word. Only a
// real failure (or, 300-REVIEW IN-04, a transport that cannot send: "Can't send") is red:
// Off, Held back, Test mode and Ready are neutral, and skipped
// or suppressed sends never reach this tile as failures (the probe does not read them).
interface EmailProbe {
  state: "up" | "down" | "off"
  mode?: "off" | "held_back" | "test" | "live"
  provider?: "none" | "resend" | "smtp"
  last_sent_at?: string | null
  last_failure_at?: string | null
  last_failure_reason?: string | null
  latency_ms?: null
  /** 300-REVIEW IN-04: the mailer's sentence for a transport that cannot send on config alone
   *  (no sender address, key or host). Absent on an older backend. */
  config_problem?: string | null
}

interface EmailView {
  dot: string
  value: string
  sub: string
}

const EMAIL_PROVIDER_WORD: Record<string, string> = {
  resend: "Resend",
  smtp: "your mail server",
}

/** The server's timestamp, absolute (never a fabricated "just now"). */
function when(iso: string): string {
  return new Date(iso).toLocaleString()
}

function emailView(probe: EmailProbe | null | undefined, loading: boolean): EmailView {
  if (loading || !probe) {
    return { dot: "bg-muted-foreground/25", value: "—", sub: "email delivery" }
  }
  const mode = probe.mode ?? (probe.state === "off" ? "off" : "live")
  if (mode === "off" || probe.provider === "none") {
    return { dot: "bg-muted-foreground/40", value: "Off", sub: "Not set up. Invitation links are copied by hand" }
  }
  if (mode === "held_back") {
    return {
      dot: "bg-muted-foreground/40",
      value: "Held back",
      sub: "Not production and no test address, so emails are only logged",
    }
  }
  const provider = EMAIL_PROVIDER_WORD[probe.provider ?? ""] ?? "your mail server"
  if (probe.config_problem) {
    // IN-04: named before the first send, never "Ready".
    return { dot: "bg-destructive", value: "Can't send", sub: `via ${provider}: ${probe.config_problem}` }
  }
  if (probe.state === "down") {
    const at = probe.last_failure_at ? `, ${when(probe.last_failure_at)}` : ""
    const reason = probe.last_failure_reason ?? "the email could not be sent."
    return { dot: "bg-destructive", value: "Last send failed", sub: `via ${provider}${at}: ${reason}` }
  }
  if (mode === "test") {
    return { dot: "bg-muted-foreground/40", value: "Test mode", sub: "Every email goes to the test address" }
  }
  if (probe.last_sent_at) {
    return { dot: "bg-success", value: "Sending", sub: `via ${provider}, last sent ${when(probe.last_sent_at)}` }
  }
  return { dot: "bg-muted-foreground/25", value: "Ready", sub: `via ${provider}, nothing sent yet` }
}

/** Map a probe (or its absence) to a display status. `off` is honored FIRST so a
 *  deliberately-disabled sandbox can never fall through to a red "down" (Pitfall 6). */
function depStatus(probe: DepProbe | undefined | null): DepStatus {
  if (!probe) return "unknown"
  if (probe.state === "off") return "off"
  if (probe.state === "down") return "down"
  // state === "up": a high latency reads as slow, not healthy.
  if (probe.latency_ms != null && probe.latency_ms > SLOW_LATENCY_MS) return "slow"
  return "up"
}

// Status → dot color. `off` and `unknown` are NEUTRAL (muted) — the off branch
// MUST NOT use the destructive/red class (Pitfall 6 acceptance).
const DEP_DOT: Record<DepStatus, string> = {
  up: "bg-success",
  slow: "bg-amber-400",
  down: "bg-destructive",
  off: "bg-muted-foreground/40",
  unknown: "bg-muted-foreground/25",
}

// Status → plain word. "off by config" is the calm, non-alarming label a disabled
// sandbox wears; a null/absent payload reads as a neutral em-dash placeholder.
const DEP_STATUS_LABEL: Record<DepStatus, string> = {
  up: "Healthy",
  slow: "Slow",
  down: "Down",
  off: "off by config",
  unknown: "—",
}

// ── Phase 150 (SEC-01 / D-150-02) — at-rest secrets encryption state ──────────
// The three honest wire states map onto the EXISTING dependency vocabulary
// (Pitfall 6 — a deliberate no-key config is NEUTRAL grey, NEVER red):
//   encrypted → success (green)     — secret keys are ciphertext at rest
//   plaintext → NEUTRAL grey        — no key set (a deliberate config, not a fault)
//   error     → destructive (red)   — genuine decrypt failures (columns_unreadable)
//               and/or lingering plaintext under an active key (columns_plaintext —
//               a swallowed sweep). The red label NAMES whichever count is present.
//   unknown   → NEUTRAL grey         — a key is active but ZERO secret values were
//               observed (an empty / cold-cache row — WR-02). NEVER green: a DB outage
//               returns {} without raising, so a false "Encrypted" is exactly the bug.
//   absent / loading → NEUTRAL unknown placeholder (older backend / not-yet-fetched)
type SecretsState = "encrypted" | "plaintext" | "error" | "unknown"

/** The secrets probe as it arrives on `signals.secrets_encryption` (optional —
 *  a backend that has not shipped Plan 150-05 omits it entirely). */
interface SecretsProbe {
  state: "encrypted" | "plaintext" | "error" | "unknown"
  columns_unreadable?: number
  columns_plaintext?: number
}

// State → dot color. `plaintext` (no key) + `unknown` are NEUTRAL (muted) — they
// MUST NOT use the destructive/red class (Pitfall 6 acceptance): only a genuine
// `error` is red. `plaintext` reuses the same grey the sandbox-off state wears.
const SECRETS_DOT: Record<SecretsState, string> = {
  encrypted: "bg-success",
  plaintext: "bg-muted-foreground/40",
  error: "bg-destructive",
  unknown: "bg-muted-foreground/25",
}

/** Map the secrets probe (or its absence) to a plain label. The `error` label is
 *  derived HONESTLY from whichever counter(s) the payload carries — never a
 *  fabricated number. */
function secretsLabel(probe: SecretsProbe | undefined | null): string {
  if (!probe) return "—"
  if (probe.state === "encrypted") return "Encrypted"
  if (probe.state === "plaintext") return "Plaintext (no key set)"
  if (probe.state === "unknown") return "Status unavailable"
  // error: name the unreadable and/or not-encrypted counts.
  const unreadable = probe.columns_unreadable ?? 0
  const plaintext = probe.columns_plaintext ?? 0
  if (unreadable && plaintext) return `${unreadable} unreadable, ${plaintext} not encrypted`
  if (unreadable) return `${unreadable} secret${unreadable === 1 ? "" : "s"} unreadable`
  if (plaintext) return `${plaintext} secret${plaintext === 1 ? "" : "s"} not encrypted`
  return "Encryption error"
}

/** The one-line plain subtext grounding the secrets state. */
function secretsSub(probe: SecretsProbe | undefined | null): string {
  if (!probe) return "secret keys at rest"
  if (probe.state === "encrypted") return "Secret keys encrypted at rest"
  if (probe.state === "plaintext") return "Set a key to encrypt secrets at rest"
  if (probe.state === "unknown") return "Couldn't confirm secrets at rest"
  return "Secret keys need attention"
}

/** The four plain-labeled health signals with a raw-name reveal (D-07). */
export function HealthSignals({ signals, showTechnical }: HealthSignalsProps) {
  const loading = signals === null
  const views: SignalView[] = SIGNAL_ORDER.map((s) => ({
    ...s,
    value: loading ? "—" : valueFor(s.field, signals),
  }))

  // The dependency probes ride the same `signals` payload additively; when the
  // backend has not shipped Plan 147-04 yet (or while loading) `dependencies` is
  // absent → every probe reads "unknown" (neutral placeholder), never a crash.
  const deps = signals?.dependencies

  // Phase 150 (SEC-01) — the secrets-at-rest state rides the SAME payload. When the
  // backend has not shipped Plan 150-05 yet (or while loading) it is absent →
  // the tile reads "unknown" (neutral placeholder), never red, never a crash.
  const secrets = signals?.secrets_encryption
  const secretsState: SecretsState = loading || !secrets ? "unknown" : secrets.state

  return (
    <div className="space-y-3">
      {/* The four backpressure signals — unchanged from Plan 146-05. */}
      <div
        className={cn(
          "grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4",
          loading && "opacity-40",
        )}
        aria-busy={loading}
      >
        {views.map((v) => (
          <div key={v.field} className="rounded-[10px] border border-border bg-card px-3.5 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rounded-full bg-success" />
              {v.label}
            </div>
            <div className="font-mono text-xl font-semibold leading-tight tabular-nums text-foreground">
              {v.value}
            </div>
            <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{v.sub}</div>
            {showTechnical && (
              <div className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground" title={v.field}>
                {v.field}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Phase 147 (ADMIN-02 / 064-B) — dependency-health dots (up/slow/down/off).
          300 (UI-D13): four columns at lg, the backpressure row's breakpoints. */}
      <div
        className={cn(
          "grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4",
          loading && "opacity-40",
        )}
        aria-busy={loading}
      >
        {DEP_ORDER.map((d) => {
          if (d.key === "email") {
            const email = (deps as { email?: EmailProbe } | undefined)?.email ?? null
            const view = emailView(email, loading)
            return (
              <div
                key={d.key}
                data-testid="dep-email"
                className="rounded-[10px] border border-border bg-card px-4 py-4"
              >
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span aria-hidden="true" className={cn("h-1.5 w-1.5 flex-none rounded-full", view.dot)} />
                  {d.label}
                </div>
                <div className="text-sm font-semibold text-foreground">{view.value}</div>
                <div className="mt-1 break-words text-[11px] text-muted-foreground">{view.sub}</div>
                {showTechnical && (
                  <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                    dependencies.email · {email?.provider ?? "—"}
                  </div>
                )}
              </div>
            )
          }
          const probe = deps?.[d.key] ?? null
          const status = loading ? "unknown" : depStatus(probe)
          return (
            <div key={d.key} className="rounded-[10px] border border-border bg-card px-3.5 py-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-1.5 flex-none rounded-full", DEP_DOT[status])}
                />
                {d.label}
              </div>
              <div className="text-sm font-semibold leading-tight text-foreground">
                {DEP_STATUS_LABEL[status]}
              </div>
              <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{d.sub}</div>
              {showTechnical && (
                <div
                  className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground"
                  title={`dependencies.${d.key}`}
                >
                  dependencies.{d.key}
                  {probe?.latency_ms != null ? ` · ${probe.latency_ms}ms` : ""}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Phase 150 (SEC-01 / D-150-02) — at-rest secrets encryption state. One tile
          mirroring the dependency markup: green encrypted / NEUTRAL plaintext-no-key
          (never red — Pitfall 6) / red error naming the unreadable+not-encrypted
          counts. Absent (older backend / loading) → neutral placeholder. */}
      <div
        className={cn(
          "grid grid-cols-1 gap-2.5 sm:grid-cols-3",
          loading && "opacity-40",
        )}
        aria-busy={loading}
      >
        <div className="rounded-[10px] border border-border bg-card px-3.5 py-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className={cn("h-1.5 w-1.5 flex-none rounded-full", SECRETS_DOT[secretsState])}
            />
            Secrets at rest
          </div>
          <div className="text-sm font-semibold leading-tight text-foreground">
            {secretsLabel(secrets)}
          </div>
          <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {secretsSub(secrets)}
          </div>
          {showTechnical && (
            <div
              className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground"
              title="secrets_encryption.state"
            >
              secrets_encryption.state
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
