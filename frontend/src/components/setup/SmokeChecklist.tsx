// ─────────────────────────────────────────────────────────────────────────────
// Phase 158 Plan 10 (DEPLOY-02 / UI-SPEC §7-§8, D-13/D-14) — the smoke checklist.
//
// The green-checklist that IS the finalize gate (D-13). Five HealthSignals-style
// rows (dot + plain label + sub + verbatim reason on fail) resolved from SERVER
// TRUTH — a row is green ONLY when the server says so; a not-yet-run row is NEUTRAL
// (never optimistically green). REUSES the HealthSignals dot vocabulary + the
// PublishGauntlet gated-verdict discipline (the `canPublish` disabled-until gate +
// the `PublishingNotice` elapsed clock).
//
// THE ONLY GATE (mirrors PublishGauntlet's `canPublish`): all-green unlocks the
// single `Finalize setup` CTA; ANY red BLOCKS it, leading with the row's
// plain-language fix + a "Back to fix" jump to the owning step (idempotent
// re-entry, D-14). No screen ever advances on an un-passed check.
//
// FINALIZE (D-05/D-14): Finalize opens the irreversible-lock confirmation ("This
// locks first-run setup…"); on confirm the token-gated `postFinalize()` writes the
// dual marker. The SERVER re-runs smoke (158-06) and refuses a non-green finalize
// (a 409) — the client all-green gate is UX, not the wall (T-158-02). While saving,
// the §8 in-flight panel reassures the box may re-initialize its connections.
//
// SECURITY (T-158-02 / T-158-10): the client gate is advisory (the server re-smokes);
// the submitted config is masked upstream; there is NO raw-HTML sink here.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Lock, ShieldAlert } from "lucide-react"
import {
  postSmoke,
  postFinalize,
  SetupApiError,
  type SmokeBody,
  type FinalizeBody,
  type SmokeResult,
  type FinalizeResult,
  type SmokeCheckId,
  type ProbeResult,
} from "@/lib/setupApi"
import { cn } from "@/lib/utils"

/** The five server-truth rows, in order. `owner` is the human name of the step a red
 *  row jumps back to (idempotent re-entry, D-14); `fix` is its plain-language cure. */
const CHECK_ROWS: ReadonlyArray<{
  id: SmokeCheckId
  label: string
  sub: string
  fix: string
  owner: string
}> = [
  {
    id: "supabase_auth",
    label: "Supabase auth reachable",
    sub: "The login service answers",
    fix: "Check the Supabase URL and keys on the Connect step.",
    owner: "Connect",
  },
  {
    id: "postgres_schema",
    label: "Database + schema present",
    sub: "Postgres is reachable and set up",
    fix: "Check the connection string, and run the setup SQL if the database is empty.",
    owner: "Connect",
  },
  {
    id: "redis_ping",
    label: "Redis responds",
    sub: "The run buffer answers a ping",
    fix: "Check the Redis URL on the Connect step.",
    owner: "Connect",
  },
  {
    id: "provider_key",
    label: "Provider key works",
    sub: "The assistant model accepts your key",
    fix: "Check the provider key on the Provider step.",
    owner: "Provider",
  },
  {
    id: "operator_row",
    label: "Admin account exists",
    sub: "Your operator login is set up",
    fix: "Create the admin account on the Operator step.",
    owner: "Operator",
  },
]

interface SmokeChecklistProps {
  /** The setup token — smoke + finalize are token-gated writes (D-15). */
  token: string
  /** The submitted config the 5-way smoke probes server-side (the finalize gate). */
  smoke: SmokeBody
  /** The full config finalize commits (RE-smoked server-side — never trusted). */
  finalize: FinalizeBody
  /** Jump back to the wizard step that owns a failing check (idempotent, D-14). */
  onBackToFix: (target: SmokeCheckId) => void
  /** Emitted once finalize succeeds — the host transitions to the lock-out surface. */
  onFinalized: (result: FinalizeResult) => void
}

type SmokeState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: SmokeResult }
  | { kind: "error"; message: string }

type FinalizeState =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "saving" }
  | { kind: "error"; message: string }

/** Format an elapsed-seconds count as `Ns` / `Nm SSs` (the PublishingNotice clock). */
function formatClock(sec: number): string {
  const mm = Math.floor(sec / 60)
  const ss = sec % 60
  return mm > 0 ? `${mm}m ${String(ss).padStart(2, "0")}s` : `${ss}s`
}

/** One smoke row → the HealthSignals dot vocabulary, always with a WORD beside the
 *  dot (never colour-alone). A not-yet-run row is NEUTRAL grey; a running row shows
 *  "checking…"; a resolved row is green/red from server truth only. */
function SmokeRow({
  label,
  sub,
  fix,
  owner,
  probe,
  running,
  onBackToFix,
}: {
  label: string
  sub: string
  fix: string
  owner: string
  probe: ProbeResult | null
  running: boolean
  onBackToFix: () => void
}) {
  // Honesty lock: green ONLY on `state: "up"` server truth. Absent probe = neutral.
  const status: "up" | "down" | "checking" | "neutral" = running
    ? "checking"
    : probe
      ? probe.state === "up"
        ? "up"
        : "down"
      : "neutral"
  const dot =
    status === "up"
      ? "bg-success"
      : status === "down"
        ? "bg-destructive"
        : status === "checking"
          ? "bg-amber-400 motion-safe:animate-pulse"
          : "bg-muted-foreground/40"
  const word =
    status === "up"
      ? "Passed"
      : status === "down"
        ? "Couldn't verify"
        : status === "checking"
          ? "Checking…"
          : "Not checked yet"
  const wordTone =
    status === "up" ? "text-success" : status === "down" ? "text-destructive" : "text-muted-foreground"

  return (
    <li className="rounded-[10px] border border-border bg-card px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className={cn("mt-1 h-2 w-2 flex-none rounded-full", dot)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <span className={cn("text-[12px] font-medium", wordTone)}>{word}</span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</p>
          {/* A red row leads with the plain-language fix, then the verbatim server
              reason (one glance away), then the Back-to-fix jump (D-14). */}
          {status === "down" && (
            <div className="mt-2 space-y-1.5">
              <p className="text-[12px] leading-snug text-foreground">{fix}</p>
              {probe?.reason && (
                <p className="font-mono text-[11px] text-destructive">Reason: {probe.reason}</p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onBackToFix}
                className="h-7 text-[12px]"
              >
                Back to fix — {owner} step
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

export function SmokeChecklist({ token, smoke, finalize, onBackToFix, onFinalized }: SmokeChecklistProps) {
  const [smokeState, setSmokeState] = useState<SmokeState>({ kind: "idle" })
  const [finalizeState, setFinalizeState] = useState<FinalizeState>({ kind: "idle" })
  const [elapsed, setElapsed] = useState(0)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const running = smokeState.kind === "running"
  const saving = finalizeState.kind === "saving"
  const busy = running || saving
  const result = smokeState.kind === "done" ? smokeState.result : null
  // The ONLY gate (mirrors PublishGauntlet's `canPublish`): every row green, on
  // server truth — a stale result is invalidated the moment finalize is in flight.
  const canFinalize = !!result && result.all_green && !busy

  // Elapsed-seconds ticker — runs while EITHER the smoke run or the finalize save is
  // in flight, so the operator can SEE the server op is alive (PublishingNotice).
  useEffect(() => {
    if (!busy) return
    setElapsed(0)
    const started = Date.now()
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [busy])

  // Focus the confirm button when the irreversible-lock confirmation opens (a11y).
  useEffect(() => {
    if (finalizeState.kind === "confirming") confirmRef.current?.focus()
  }, [finalizeState.kind])

  async function runChecks() {
    if (busy) return
    setFinalizeState({ kind: "idle" })
    setSmokeState({ kind: "running" })
    try {
      const res = await postSmoke(token, smoke)
      setSmokeState({ kind: "done", result: res })
    } catch (err) {
      const message =
        err instanceof SetupApiError ? err.message : "Couldn't run the checks. Try again in a moment."
      setSmokeState({ kind: "error", message })
    }
  }

  async function confirmFinalize() {
    setFinalizeState({ kind: "saving" })
    try {
      const res = await postFinalize(token, finalize)
      onFinalized(res)
    } catch (err) {
      // A 409 = the server re-ran smoke and refused a non-green finalize (T-158-02).
      const message =
        err instanceof SetupApiError
          ? err.message
          : "Couldn't finalize. Re-run the checks and try again."
      setFinalizeState({ kind: "error", message })
      // A refused finalize means the server's truth diverged — clear the stale pass.
      setSmokeState({ kind: "idle" })
    }
  }

  return (
    <section aria-label="Final checks" className="space-y-5">
      <div>
        <h2 className="font-headline text-xl font-semibold text-foreground">Final checks</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run the checks below. Every one must pass before you can finalize — each is verified on the
          server, not guessed here.
        </p>
      </div>

      {/* The five server-truth rows. */}
      <ul role="status" className="space-y-2">
        {CHECK_ROWS.map((row) => (
          <SmokeRow
            key={row.id}
            label={row.label}
            sub={row.sub}
            fix={row.fix}
            owner={row.owner}
            probe={result ? result.checks[row.id] : null}
            running={running}
            onBackToFix={() => onBackToFix(row.id)}
          />
        ))}
      </ul>

      {smokeState.kind === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {smokeState.message}
        </p>
      )}

      {/* The live elapsed clock while a server op runs (PublishingNotice analog,
          reduced-motion-gated). Announced politely; the clock text carries it. */}
      {busy && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-[10px] border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-[12px] text-amber-600 dark:text-amber-400"
        >
          <span className="flex items-center gap-2 font-medium">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
            {saving ? "Saving your configuration…" : "Running the checks…"}
          </span>
          <span data-testid="smoke-elapsed" className="flex-none font-mono tabular-nums">
            {formatClock(elapsed)} elapsed
          </span>
        </div>
      )}

      {/* The §8 in-flight reassurance — the box may re-initialize its connections. */}
      {saving && (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Your box may briefly re-initialize its connections to pick up the new settings. Please don't
          close the tab — this finishes on its own.
        </p>
      )}

      {/* The irreversible-lock confirmation (D-14). Leads with words; Confirm/Cancel. */}
      {finalizeState.kind === "confirming" && (
        <div
          role="alertdialog"
          aria-label="Finalize setup"
          className="space-y-3 rounded-[10px] border border-primary/40 bg-primary/10 p-4"
          onKeyDown={(e) => {
            if (e.key === "Escape") setFinalizeState({ kind: "idle" })
          }}
        >
          <div className="flex items-start gap-2.5">
            <Lock className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
            <p className="text-[13px] leading-relaxed text-foreground">
              This <span className="font-semibold">locks first-run setup</span>. After this,
              configuration changes happen in <span className="font-semibold">Admin</span>, not here.
              Ready to finish?
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button ref={confirmRef} type="button" onClick={confirmFinalize} className="sm:w-auto">
              Yes, finalize setup
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFinalizeState({ kind: "idle" })}
              className="sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {finalizeState.kind === "error" && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-destructive/40 bg-destructive/10 p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-none text-destructive" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-destructive">Finalize was refused</p>
            <p className="text-[12px] leading-relaxed text-muted-foreground">{finalizeState.message}</p>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Re-run the checks — the server verifies everything again before it locks.
            </p>
          </div>
        </div>
      )}

      {/* The action row: Run checks always available; Finalize is the ONLY gate —
          disabled until every row is green on server truth (mirrors canPublish). */}
      {finalizeState.kind !== "confirming" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={runChecks} disabled={busy} className="sm:w-auto">
            {running ? (
              <>
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> Checking…
              </>
            ) : result ? (
              "Re-run checks"
            ) : (
              "Run checks"
            )}
          </Button>

          <Button
            type="button"
            onClick={() => setFinalizeState({ kind: "confirming" })}
            disabled={!canFinalize}
            title={canFinalize ? undefined : "Every check must pass before you can finalize."}
            className="sm:w-auto"
          >
            <Lock className="h-4 w-4" aria-hidden="true" /> Finalize setup
          </Button>

          {result && !result.all_green && (
            <p className="w-full text-[12px] text-muted-foreground">
              Fix the red checks above, then re-run — Finalize unlocks when every check passes.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
