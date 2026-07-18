// ─────────────────────────────────────────────────────────────────────────────
// Phase 158 Plan 09 (DEPLOY-02 / UI-SPEC §2, D-08) — the light env-detect tiles.
//
// Read-only, orienting, LIGHT (D-08 — not heavy auto-discovery). Clones the
// `admin/HealthSignals.tsx` read-only tile markup (dot + label + one-line sub) and
// its status-dot vocabulary VERBATIM (never colour-alone; off/unknown is NEUTRAL
// grey, NEVER red — Pitfall 6). It only tells the operator where they stand; it
// changes nothing.
//
// The four tiles come straight from the token-gate's `postDetect()` result
// (in_docker / store_present / db_reachable / redis_reachable). Because detect is a
// LIGHT orientation and the operator has not bound any credentials yet, a `false`
// reads NEUTRAL ("No" / "Not yet") — never a red failure. A null result (not yet
// probed) reads a neutral em-dash on every tile.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The host owns the fetch (the gate's
// probe) and the step machine; this leaf renders the tiles + a single Continue CTA.
// ─────────────────────────────────────────────────────────────────────────────
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DetectResult } from "@/lib/setupApi"

/** Display status → dot colour, reusing the HealthSignals vocabulary. `up` = green;
 *  `off` (a false-but-not-a-failure signal) + `unknown` (not probed) are NEUTRAL —
 *  they MUST NOT use the destructive/red class (Pitfall 6). */
type TileStatus = "up" | "off" | "unknown"

const DOT: Record<TileStatus, string> = {
  up: "bg-success",
  off: "bg-muted-foreground/40",
  unknown: "bg-muted-foreground/25",
}

interface DetectTile {
  key: keyof DetectResult
  label: string
  sub: string
  /** The plain word when the signal is present (true). */
  yes: string
  /** The plain word when absent (false) — neutral, never an alarm. */
  no: string
}

const TILES: readonly DetectTile[] = [
  { key: "in_docker", label: "Running in Docker", sub: "detected from the container environment", yes: "Yes", no: "No" },
  { key: "store_present", label: "Existing config found", sub: "a saved setup file on this box", yes: "Found", no: "None yet" },
  { key: "db_reachable", label: "Database reachable", sub: "a pre-set Postgres answered", yes: "Reachable", no: "Not yet" },
  { key: "redis_reachable", label: "Redis reachable", sub: "a pre-set Redis answered", yes: "Reachable", no: "Not yet" },
]

interface EnvironmentDetectCardProps {
  /** The light detect probe (from the token gate's validation call). `null` = not yet
   *  probed → every tile reads a neutral em-dash (never red). */
  detect: DetectResult | null
  onContinue: () => void
}

export function EnvironmentDetectCard({ detect, onContinue }: EnvironmentDetectCardProps) {
  return (
    <section aria-label="Environment detection" className="space-y-4">
      <div>
        <h2 className="font-headline text-xl font-semibold text-foreground">What we found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This just orients the next steps — nothing is changed yet.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="status" aria-live="polite">
        {TILES.map((t) => {
          // detect null (unknown) → neutral em-dash; true → green "yes" word; false →
          // NEUTRAL "no" word (a not-yet-bound signal is never a red failure — D-08).
          const value = detect ? detect[t.key] : null
          const status: TileStatus = value === null ? "unknown" : value ? "up" : "off"
          const word = value === null ? "—" : value ? t.yes : t.no
          return (
            <div key={t.key} className="rounded-[10px] border border-border bg-card px-3.5 py-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden="true" className={cn("h-1.5 w-1.5 flex-none rounded-full", DOT[status])} />
                {t.label}
              </div>
              <div className="text-sm font-semibold leading-tight text-foreground">{word}</div>
              <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{t.sub}</div>
            </div>
          )
        })}
      </div>

      <Button onClick={onContinue} className="w-full sm:w-auto">
        Continue
      </Button>
    </section>
  )
}
