// ─────────────────────────────────────────────────────────────────────────────
// Control Room — the Audit tab (ADMIN-01 / 062-A / D-08).
//
// The honest minimal full-history view: every operator action, newest-first, with
// the ✎ write mark reads carry no mark. It is deliberately MINIMAL — a plain
// scrollable list, NO search / NO date filters / NO CSV export. Those richer
// browser affordances are a later, dedicated governance surface — a calm
// "coming soon" note names them without promising a date (and never a roadmap
// number, T-146-10).
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell (ControlRoomPage) owns
// the single audit fetch (a generous full-history limit) + the refresh honesty
// beat, and threads the rows down. This card only renders `rows` — mirroring the
// RecentActionsCard leaf pattern so the Overview preview and this full view can
// never structurally diverge (both read the SAME shell-held feed).
// ─────────────────────────────────────────────────────────────────────────────
import type { OperatorAuditRow } from "@/lib/api"

interface AuditTabProps {
  /** The full recent-actions ledger feed, newest-first (`created_at DESC`). */
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

/** The honest minimal full-history audit view (no filters/CSV — deferred). */
export function AuditTab({ rows }: AuditTabProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="rounded-[10px] border border-border bg-card px-4 py-3.5">
        <div className="mb-2.5 flex items-center gap-2">
          <h2 className="font-headline text-base font-bold text-foreground">Audit log</h2>
          <span className="rounded-md bg-success/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-success">
            live
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground/70">
            No actions yet — everything an operator does here lands here.
          </p>
        ) : (
          <div className="flex flex-col">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-baseline gap-2.5 border-b border-border/40 py-2 text-sm last:border-b-0"
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

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/40 pt-2 text-xs text-muted-foreground/70">
          <span>Who did what, and when — every operator action, no exceptions.</span>
          <span className="ml-auto rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
            search, date filters &amp; export coming soon
          </span>
        </div>
      </div>
    </div>
  )
}
