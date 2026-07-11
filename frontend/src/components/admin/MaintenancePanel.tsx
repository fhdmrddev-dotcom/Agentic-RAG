// ─────────────────────────────────────────────────────────────────────────────
// Phase 147 Plan 08 (FLAG-01 / sketch 065-A) — the Platform-state maintenance panel.
//
// Maintenance / read-only mode is a DIFFERENT KIND of power from a single
// capability switch, so 065-A keeps it spatially apart: its own amber-framed
// "Platform state" panel (mirrors the OperatorBand amber band), visibly distinct
// from the CapabilityGrid — distinction by location.
//
// Graded friction (065-A): where capabilities flip directly for emergency speed,
// the platform-wide switch ARMS-TO-CONFIRM — the first click reveals an inline
// "Put the whole platform in read-only mode? · Confirm / Cancel" prompt, so a
// single stray click can never wedge the platform (T-147-16 fat-finger DoS).
//
// Consequence ≠ receipt (062-A): while maintenance is ON, a persistent
// PRESENT-TENSE consequence banner stays up ("the whole platform is read-only
// right now"). That is a live-state truth — distinct from the past-tense ledger
// receipt ("Turned ON maintenance mode") which lives in the Activity ledger, not
// here.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell owns the flag state +
// the write callback (`onSetMaintenance` → lib/api `setFlag("maintenance_mode", …)`);
// this panel renders the guarded control and reports the intended next value.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react"
import { AlertTriangle, Loader2, Power } from "lucide-react"

import { cn } from "@/lib/utils"

interface MaintenancePanelProps {
  /** Whether the platform is currently in maintenance / read-only mode. */
  maintenanceOn: boolean
  /** Flip maintenance after the operator confirms the armed prompt. The shell
   *  wires this to `setFlag("maintenance_mode", value)`; resolves on success. */
  onSetMaintenance: (value: boolean) => Promise<void>
}

/** The 065-A amber Platform-state panel: arm-to-confirm maintenance + a
 *  present-tense consequence banner distinct from the ledger receipt. */
export function MaintenancePanel({ maintenanceOn, onSetMaintenance }: MaintenancePanelProps) {
  // The arm-to-confirm state — the first click ARMS (does not flip); Confirm
  // flips, Cancel disarms. A single stray click never reaches onSetMaintenance.
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // The flip TARGETS the inverse of the current state; the armed prompt wording
  // follows the direction so it always names what is about to happen.
  const target = !maintenanceOn

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      await onSetMaintenance(target)
      setArmed(false)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Platform state"
      className="rounded-[10px] border border-amber-500/25 bg-gradient-to-b from-amber-500/[0.07] to-transparent px-4 py-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 flex-none text-amber-400" aria-hidden="true" />
            Platform state
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
            Users can read everything, but nothing new runs — no chats, workflows, or uploads.
          </p>
        </div>

        {/* The guarded trigger. When NOT armed, the first click only arms the
            confirm prompt below — it does NOT call onSetMaintenance. */}
        {!armed && (
          <button
            type="button"
            onClick={() => {
              setFailed(false)
              setArmed(true)
            }}
            className={cn(
              "inline-flex flex-none items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              maintenanceOn
                ? "border-border bg-accent text-foreground hover:bg-accent/80"
                : "border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25",
            )}
          >
            <Power className="h-3.5 w-3.5" aria-hidden="true" />
            {maintenanceOn ? "Bring the platform back online" : "Put the platform in read-only mode"}
          </button>
        )}
      </div>

      {/* Arm-to-confirm prompt (065-A graded friction). The second, deliberate
          step — Confirm flips, Cancel disarms. Direction-aware wording. */}
      {armed && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">
            {maintenanceOn
              ? "Bring the platform back online? Users can run things again."
              : "Put the whole platform in read-only mode? Everyone can still read; nothing new runs."}
          </p>
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setArmed(false)}
              disabled={busy}
              className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-400 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Confirm
            </button>
          </div>
        </div>
      )}

      {failed && (
        <div className="mt-2 text-[11px] text-destructive" role="status">
          Couldn&rsquo;t update maintenance mode — try again.
        </div>
      )}

      {/* Consequence banner (062-A): PRESENT-TENSE, persistent while ON. This is
          the live-state truth — distinct from the past-tense ledger receipt. */}
      {maintenanceOn && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-300"
        >
          <AlertTriangle className="h-4 w-4 flex-none" aria-hidden="true" />
          The whole platform is read-only right now.
        </div>
      )}
    </section>
  )
}
