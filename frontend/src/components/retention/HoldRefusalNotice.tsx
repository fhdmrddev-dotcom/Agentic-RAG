/**
 * Phase 275 (S10 / D-14 / D-15 / D-17) — the amber refusal box every delete door renders.
 *
 * A refusal is a visible SENTENCE, never a disabled button with a tooltip and never
 * "Delete failed. Please try again." The words are the server's (`hold_guard.py` builds them,
 * so a member never sees a matter name); this component only frames them: bold title, the
 * sentence, and ONE Close. Amber is the UI-SPEC's hold colour, with an explicit light shade
 * because `--warning` text fails AA on a light surface (UI-SPEC §Color).
 */
import { Button } from "@/components/ui/button"
import { RETENTION_COPY } from "./retentionCopy"

interface HoldRefusalNoticeProps {
  /** The server's lead, e.g. "Can't delete."; falls back to the ported title when empty. */
  title?: string
  /** The server's sentence, rendered as-is. */
  message: string
  onClose: () => void
  className?: string
}

export function HoldRefusalNotice({ title, message, onClose, className }: HoldRefusalNoticeProps) {
  const lead = title && title.trim() !== "" ? title : RETENTION_COPY.ported.refusalTitle
  return (
    <div
      role="alert"
      className={`rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-[hsl(32_90%_30%)] dark:text-warning ${className ?? ""}`}
    >
      <p>
        <strong className="font-semibold">{lead}</strong> {message}
      </p>
      <div className="mt-2 flex justify-end">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>
          {RETENTION_COPY.contract.close}
        </Button>
      </div>
    </div>
  )
}
