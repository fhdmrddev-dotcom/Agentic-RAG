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

/** The four plain-labeled health signals with a raw-name reveal (D-07). */
export function HealthSignals({ signals, showTechnical }: HealthSignalsProps) {
  const loading = signals === null
  const views: SignalView[] = SIGNAL_ORDER.map((s) => ({
    ...s,
    value: loading ? "—" : valueFor(s.field, signals),
  }))

  return (
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
          <div className="mt-1 text-[11px] leading-snug text-muted-foreground/70">{v.sub}</div>
          {showTechnical && (
            <div className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground/60" title={v.field}>
              {v.field}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
