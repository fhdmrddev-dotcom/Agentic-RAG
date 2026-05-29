/**
 * Phase 087 Plan 04 Task 2 — DiffExpandOverlay (PANEL-07, D4 / sketch 005).
 *
 * The opt-in WIDE diff view. The panel itself NEVER auto-widens (auto-widening
 * reflows the chat unpredictably — file-browser-and-diff.md D4 / "What to
 * Avoid"); this overlay is the ONLY wide affordance, user-triggered by the ⤢
 * button in VersionDiff.
 *
 * It receives the SAME parsed DiffLine[] that VersionDiff already fetched +
 * parsed — it does NO second fetch (D4 / Pitfall 4): the still-truncated payload
 * is shown as-is, with the same truncation notice.
 *
 * Reuses the repo's shadcn Dialog (Radix) → focus-trap + Escape + focus-restore
 * for free (no new dependency, no hand-rolled keydown handlers).
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DiffLine } from "@/lib/diffParse"
import { DiffLines } from "./DiffLines"

export interface DiffExpandOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Already-parsed lines from VersionDiff — NOT re-fetched here (D4). */
  lines: DiffLine[]
  truncated: boolean
  /** Human label, e.g. "Diff v2 to v3" — drives the dialog title + aria-label. */
  label: string
}

export function DiffExpandOverlay({
  open,
  onOpenChange,
  lines,
  truncated,
  label,
}: DiffExpandOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-3 p-0">
        <DialogHeader className="border-b border-border/60 px-4 py-3">
          <DialogTitle className="font-mono text-sm">{label}</DialogTitle>
        </DialogHeader>
        <div
          role="region"
          aria-label={label}
          className="max-h-[70vh] overflow-y-auto px-1 pb-3"
        >
          <DiffLines lines={lines} truncated={truncated} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default DiffExpandOverlay
