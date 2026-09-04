import { cn } from "@/lib/utils"
import { TERM_MAP, usePlainLabel, type TermKey } from "@/lib/termMap"

interface Props {
  status: "pending" | "processing" | "completed" | "failed" | "paused"
  /** Phase 56 D-13: granular sub-status; only consulted while status='processing'. */
  ingestionStep?: string | null
}

const styles: Record<Props["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-500/30",
}

export function DocumentStatusBadge({ status, ingestionStep }: Props) {
  // Phase 154 Plan 02 (LANG-01 / Surface A): route the DISPLAY label through the
  // term-map — plain by default, today's technical words under the reveal toggle.
  // The `status`/`ingestionStep` ENUMS the backend emits are UNTOUCHED (D-02a):
  // `styles[status]` (below) still keys on the raw `status`, never the label.
  //
  // Hooks can't be conditional, so compute ONE term key unconditionally, then call
  // usePlainLabel once. While processing, prefer the granular `ingest.<step>` key
  // when it exists in the map; otherwise (no/unknown step) fall back to the plain
  // `status.processing` label — never a raw key.
  const termKey: TermKey =
    status === "processing"
      ? `ingest.${ingestionStep}` in TERM_MAP
        ? (`ingest.${ingestionStep}` as TermKey)
        : "status.processing"
      : (`status.${status}` as TermKey)
  const label = usePlainLabel(termKey)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status],
      )}
    >
      {status === "processing" && (
        <span className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
      )}
      {label}
    </span>
  )
}
