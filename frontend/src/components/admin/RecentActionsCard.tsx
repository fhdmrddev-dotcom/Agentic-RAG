// ─────────────────────────────────────────────────────────────────────────────
// Phase 146 Plan 05 (ADMIN-01) — the ledger-is-receipt card.
//
// The always-on "Recent operator actions" card — the 062-A winner (D-08). The
// ledger IS the receipt: every operator action lands as a new TOP row where you
// can see it happen. NO toasts, NO running counter (062 rejected variants B + C).
//
//   - Each row shows the plain-sentence `label` (never the raw `action` code).
//   - A WRITE row (`is_write` true) carries a leading ✎ mark; a view (read) does not.
//   - New rows arrive `created_at DESC` from the feed → newest first, no re-sort here.
//   - A new top row slides in (restrained motion) via keying on `row.id`, so only the
//     freshly-added node animates — existing rows keep their identity and stay still.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell (Plan 06) owns the fetch
// and the re-fetch-after-refresh honesty beat; this card only renders `rows`.
// ─────────────────────────────────────────────────────────────────────────────
import type { OperatorAuditRow } from "@/lib/api"

interface RecentActionsCardProps {
  /** The recent-actions ledger feed, newest-first (`created_at DESC`). */
  rows: OperatorAuditRow[]
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** The always-on ledger receipt card (062-A / D-08). */
export function RecentActionsCard({ rows }: RecentActionsCardProps) {
  return (
    <div className="rounded-[10px] border border-border bg-card px-4 py-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <h3 className="font-headline text-base font-bold text-foreground">Recent operator actions</h3>
        <span className="rounded-md bg-success/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-success">
          live
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground/70">
          No actions yet — everything you do here lands here.
        </p>
      ) : (
        <div className="flex flex-col">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex animate-toolSlideIn items-baseline gap-2.5 border-b border-border/40 py-2 text-sm last:border-b-0"
            >
              {row.is_write && (
                <>
                  <span className="sr-only">Change: </span>
                  <span aria-hidden="true" className="flex-none text-amber-400" title="a change was written">
                    ✎
                  </span>
                </>
              )}
              <span className="flex-none text-foreground">{row.label}</span>
              <span className="ml-auto flex-none tabular-nums text-xs text-muted-foreground/70">
                {formatWhen(row.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2.5 border-t border-border/40 pt-2 text-xs text-muted-foreground/70">
        Everything an operator does here is recorded automatically.
      </div>
    </div>
  )
}
