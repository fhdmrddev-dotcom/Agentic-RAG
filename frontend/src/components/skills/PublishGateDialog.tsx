import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getPublishGate } from "@/lib/api"
import type { PublishGate } from "@/types"

interface Props {
  skillId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (override: boolean) => Promise<void>
  /** Phase 137-07 (PANEL-01 / sketch 057 MAP / D-06): the net-new "Review evals →"
   *  navigator on the UNMET branch — opens the Studio's Evals tab for this skill so
   *  the gate is discoverable from the publish flow (closes the "gate only in the
   *  dialog" gap). Threaded App → ChatLayout → SkillsPage → SkillCard → here. */
  onReviewEvals?: (skillId: string) => void
}

/**
 * Phase 136 (GATE-01 / D-05) — the THIN publish-gate confirm dialog on the
 * "Share globally" (private→global) action. It renders the SERVER-computed gate
 * status only (`getPublishGate`) — never any client-side gate math (D-07). It is
 * deliberately undesigned: AlertDialog primitives only, no new design-system
 * chrome (Phase 137 / PANEL-01 owns the designed experience). Force-publish just
 * echoes `override=true`; the server remains the gate and records the override.
 */

/** Honest per-state copy for the UNMET branch (D-05). `passed` is met and never
 *  rendered through this map. */
const UNMET_COPY: Record<PublishGate["state"], string> = {
  never_evaled:
    "This skill has never been evaled — run an eval on its current version to publish.",
  latest_failed: "The latest eval run failed on the current version.",
  passed_on_older_version:
    "The last passing eval was on an older version — re-eval the current version to publish.",
  passed: "",
}

export function PublishGateDialog({ skillId, open, onOpenChange, onConfirm, onReviewEvals }: Props) {
  const [gate, setGate] = useState<PublishGate | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // Refetch-not-optimistic: pull fresh server gate status every time the dialog
  // opens; never trust a stale/optimistic client value (T-135-04 / D-07).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setGate(null)
    setLoadError(null)
    setConfirmError(null)
    setLoading(true)
    getPublishGate(skillId)
      .then((g) => {
        if (!cancelled) setGate(g)
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load the publish gate. Try again.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, skillId])

  const handleConfirm = async (override: boolean) => {
    setConfirming(true)
    setConfirmError(null)
    try {
      await onConfirm(override)
      onOpenChange(false)
    } catch (e) {
      // The server is the gate: a direct/racey call can still 409 (PublishGateError)
      // or fail — surface it inline and keep the dialog open (evidence stays visible).
      setConfirmError(e instanceof Error ? e.message : "Failed to publish. Try again.")
    } finally {
      setConfirming(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Share this skill globally?</AlertDialogTitle>
          <AlertDialogDescription>
            Sharing makes this skill available to everyone. An eval must pass on the
            current version before it can be published.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking the publish gate…
          </div>
        )}

        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        {/* MET → satisfied X/N status (echoes the eval surface's honesty readout). */}
        {gate && gate.met && (
          <p className="text-sm font-medium text-foreground">
            Eval passed {gate.passed}/{gate.measured} on the current version.
          </p>
        )}

        {/* UNMET → honest reason + pointer to run an eval + explicit force affordance. */}
        {gate && !gate.met && (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-foreground">{UNMET_COPY[gate.state]}</p>
            {gate.reason && <p className="text-xs text-muted-foreground">{gate.reason}</p>}
            <p className="text-xs text-muted-foreground">
              Run an eval from this skill's Evals section, then try again — or force
              publish anyway below.
            </p>

            {/* Phase 137-07 (sketch 057 MAP / D-06): the one net-new discoverability
                link — jump straight to the Studio's Evals tab. UNMET branch only. */}
            {onReviewEvals && (
              <button
                type="button"
                className="mt-0.5 inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
                onClick={() => onReviewEvals(skillId)}
              >
                Review evals →
              </button>
            )}
          </div>
        )}

        {confirmError && <p className="text-sm text-destructive">{confirmError}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>

          {gate && gate.met && (
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/30"
              disabled={confirming}
              onClick={(e) => {
                e.preventDefault()
                void handleConfirm(false)
              }}
            >
              Publish
            </AlertDialogAction>
          )}

          {gate && !gate.met && (
            <AlertDialogAction
              disabled={confirming}
              onClick={(e) => {
                e.preventDefault()
                void handleConfirm(true)
              }}
            >
              Force publish anyway
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
