// ─────────────────────────────────────────────────────────────────────────────
// Phase 147 Plan 08 (FLAG-01 / sketch 065-A) — the capability kill-switch grid.
//
// The four fail-closed capability switches (web search / code sandbox /
// self-improvement / workflows) as a 2×2 card grid (mirrors the HealthSignals
// grid leaf). The 065-A weight rule: OFF is NOT a neutral preference — the card
// goes ARMED (red/destructive tint + an "off for everyone" tag + a concrete
// impact line). ON is calm/neutral. A kill-switch reads as consequential because
// turning it off affects real people right now.
//
// Graded friction (065-A): capability switches flip DIRECTLY — no confirm dialog.
// Emergency speed is the point; the platform-wide maintenance switch (its own
// amber MaintenancePanel) is the one that arms-to-confirm.
//
// Impact copy honesty (checker WARNING 2): `ActiveRun` carries NO per-run
// tool-usage signal, so the sketch's exact per-tool counts ("2 runs using code…")
// CANNOT be computed for web/sandbox/self-improve — those render the plain,
// count-free fallback impact. The ONLY derivable count today is the workflows
// switch (count of active workflow runs), which the shell passes as a prop. We
// NEVER fabricate a number — a count-based line renders only when a count prop is
// actually supplied.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell owns the flag state +
// the write callback (`onToggle` → lib/api `setFlag`) + the `showTechnical`
// reveal; this leaf renders the control and reports the intended next value.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react"
import { cn } from "@/lib/utils"

/** The four capability flags this grid controls — the FLAG-01 subset of `FlagKey`
 *  (maintenance is a different KIND of power → the separate MaintenancePanel). */
export type CapabilityKey =
  | "web_search_enabled"
  | "sandbox_enabled"
  | "self_improve_enabled"
  | "workflows_enabled"

interface CapabilityGridProps {
  /** The live on/off state of each capability (from the shell's settings fetch). */
  flags: Record<CapabilityKey, boolean>
  /**
   * Best-effort impact COUNTS, keyed by capability. Only supply a count where it
   * is honestly derivable — today that is `workflows_enabled` (count of active
   * workflow runs). A capability with no count renders the plain fallback impact;
   * a fabricated number is never shown.
   */
  impactCounts?: Partial<Record<CapabilityKey, number>>
  /** Flip a capability — direct, no confirm (065-A emergency speed). The shell
   *  wires this to `setFlag(key, value)`; resolves on success, rejects on failure. */
  onToggle: (key: CapabilityKey, value: boolean) => Promise<void>
  /** When true, reveal the raw flag key beside the plain label (⌥ LANG-01 reveal). */
  showTechnical: boolean
}

interface CapabilityDef {
  key: CapabilityKey
  /** The plain, human-readable name (the default audience). */
  label: string
  /** A one-line plain description of what the capability does. */
  sub: string
  /** The count-free armed impact line shown when OFF and no count is available. */
  fallbackImpact: string
  /** The count-based armed impact line — supplied only where honestly derivable. */
  countImpact?: (n: number) => string
}

// 2×2 grid order (065-A). Every fallback impact is count-FREE — we only claim a
// number where the shell can honestly derive one (workflows).
const CAPABILITIES: ReadonlyArray<CapabilityDef> = [
  {
    key: "web_search_enabled",
    label: "Web search",
    sub: "The agent can search the live web.",
    fallbackImpact: "In-flight searches get a plain refusal on their next call.",
  },
  {
    key: "sandbox_enabled",
    label: "Code sandbox",
    sub: "The agent can run code in a sandbox.",
    fallbackImpact: "In-flight code calls get a plain refusal on their next call.",
  },
  {
    key: "self_improve_enabled",
    label: "Self-improvement",
    sub: "The agent can save new skills for later.",
    fallbackImpact: "No new skills can be saved until this is back on.",
  },
  {
    key: "workflows_enabled",
    label: "Workflows",
    sub: "Users can launch automated workflows.",
    fallbackImpact: "New workflow launches are blocked.",
    countImpact: (n) =>
      `${n} running workflow${n === 1 ? "" : "s"} will finish; new launches are blocked.`,
  },
]

/** The 065-A 2×2 armed-OFF capability grid with direct-flip switches. */
export function CapabilityGrid({
  flags,
  impactCounts,
  onToggle,
  showTechnical,
}: CapabilityGridProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {CAPABILITIES.map((cap) => (
        <CapabilityCard
          key={cap.key}
          def={cap}
          on={flags[cap.key]}
          count={impactCounts?.[cap.key]}
          onToggle={onToggle}
          showTechnical={showTechnical}
        />
      ))}
    </div>
  )
}

/** One capability card. Owns only its transient write state (busy/error); the
 *  flag value itself is the shell's source of truth (no optimistic local flag). */
function CapabilityCard({
  def,
  on,
  count,
  onToggle,
  showTechnical,
}: {
  def: CapabilityDef
  on: boolean
  count: number | undefined
  onToggle: (key: CapabilityKey, value: boolean) => Promise<void>
  showTechnical: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // OFF is the armed state (065-A): red tint + tag + concrete impact. The impact
  // line prefers the honest count when one is supplied; otherwise the count-free
  // fallback — a number is NEVER fabricated.
  const armed = !on
  const impact =
    count != null && def.countImpact ? def.countImpact(count) : def.fallbackImpact

  async function handleToggle() {
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      // Direct flip — the intended next value is the inverse. No confirm (065-A).
      await onToggle(def.key, !on)
    } catch {
      // The shell owns the flag; on failure it simply stays put. Surface a quiet
      // retry affordance rather than pretending the flip landed.
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      data-capability={def.key}
      data-armed={String(armed)}
      className={cn(
        "rounded-[10px] border px-3.5 py-3 transition-colors",
        armed
          ? "border-destructive/50 bg-destructive/[0.06]"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            {def.label}
            {armed && (
              <span className="flex-none rounded-md border border-destructive/40 bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                off for everyone
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {def.sub}
          </div>
          {showTechnical && (
            <div
              className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground"
              title={def.key}
            >
              {def.key}
            </div>
          )}
        </div>

        <CapabilitySwitch
          on={on}
          busy={busy}
          label={def.label}
          onToggle={handleToggle}
        />
      </div>

      {/* The armed impact line — the "this affects real people right now" beat.
          Present ONLY when OFF (ON is calm/neutral, no impact copy). */}
      {armed && (
        <div className="mt-2 text-[11px] font-medium leading-snug text-destructive">
          {impact}
        </div>
      )}

      {failed && (
        <div className="mt-1.5 text-[11px] text-destructive" role="status">
          Couldn&rsquo;t update — try again.
        </div>
      )}
    </div>
  )
}

/** The direct-flip switch. A plain accessible toggle (role="switch"): ON reads
 *  calm/neutral (capability available), OFF reads armed (destructive track). */
function CapabilitySwitch({
  on,
  busy,
  label,
  onToggle,
}: {
  on: boolean
  busy: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        on ? "bg-primary/70" : "bg-destructive/70",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          on ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  )
}
