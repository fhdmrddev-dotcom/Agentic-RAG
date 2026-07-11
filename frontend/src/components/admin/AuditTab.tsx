// ─────────────────────────────────────────────────────────────────────────────
// Control Room — the Audit tab (ADMIN-03 / 067-A / D-08).
//
// The 067-A one-browser-two-sources audit surface: a locked source switch between
// BOTH ledgers — Operator actions (`operator_audit_log`, this operator's own
// governance actions, the ✎ write-mark receipt) and Platform activity (the
// cross-user `audit_log` — every user's REAL activity, the 19-action vocabulary of
// migs 030/071). ONE filter / pagination / CSV grammar on both; never a second
// platform-activity page (What-to-Avoid #1).
//
// SPLIT OF CONCERNS (148-PATTERNS): the shell (ControlRoomPage) OWNS the fetch
// (`onQueryPlatform`, guarded by alive.current) + the operator ledger feed; this
// leaf holds the local FILTER state and renders. The operator source filters +
// paginates client-side over the ≤200 loaded rows; the platform source is
// server-paginated (the shell refetches on every filter/page change — a recorded
// `audit.view_platform` read each time, SC#4: viewing user activity is itself in
// the ledger).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"

import type { OperatorAuditRow, PlatformAuditFilters, PlatformAuditPage } from "@/lib/api"
import { cn } from "@/lib/utils"
import { TechnicalNamesToggle } from "./TechnicalNamesToggle"

/** The two ledgers the one browser reads (067-A source switch). */
export type AuditSource = "operator" | "platform"

/** Client-side page size for the operator source (the shell loads the full ≤200
 *  history once; this leaf pages over it). The platform source is server-paged. */
const OPERATOR_PAGE_SIZE = 25

interface AuditTabProps {
  /** Which ledger is shown (067-A). The shell owns the state; this leaf flips it. */
  source: AuditSource
  onSourceChange: (source: AuditSource) => void
  /** The operator ledger feed, newest-first — this operator's own actions (062-A). */
  operatorRows: OperatorAuditRow[]
  /** The current server page of the cross-user platform browse (null until first
   *  fetched — the platform source is only read once the operator switches to it). */
  platformResult: PlatformAuditPage | null
  /** True while the shell is fetching a platform page (honest in-flight state). */
  platformLoading: boolean
  /** Ask the shell to (re)fetch the platform browse with these filters + page. The
   *  shell owns the guarded fetch; this leaf calls it when its filter/page changes. */
  onQueryPlatform: (filters: PlatformAuditFilters, page: number) => void
  /** The shared ⌥ two-audience reveal (LANG-01) — raw `action_type` codes behind it. */
  showTechnical: boolean
  onToggleTechnical: () => void
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

/** A short, non-identifying handle for a platform row's acting user (metadata only —
 *  no email is joined server-side). Clicking it will filter-to-them (Task 2). */
function shortUser(userId: string | null): string {
  if (!userId) return "unknown user"
  return userId.length > 8 ? `${userId.slice(0, 8)}…` : userId
}

/** The 067-A audit browser — source switch + paged table over both ledgers. */
export function AuditTab({
  source,
  onSourceChange,
  operatorRows,
  platformResult,
  platformLoading,
  onQueryPlatform,
  showTechnical,
  onToggleTechnical,
}: AuditTabProps) {
  const [page, setPage] = useState(1)

  // Reset to page 1 whenever the source flips (the two ledgers page independently).
  useEffect(() => {
    setPage(1)
  }, [source])

  // Platform source is server-paged: (re)ask the shell for a page whenever the source
  // is platform or the page changes. Empty filters here (Task 1 has no filter UI yet —
  // the 029-A chip strip lands in Task 2); the shell records `audit.view_platform`.
  useEffect(() => {
    if (source === "platform") onQueryPlatform({}, page)
  }, [source, page, onQueryPlatform])

  // Operator source pages client-side over the full loaded ledger.
  const operatorTotalPages = Math.max(1, Math.ceil(operatorRows.length / OPERATOR_PAGE_SIZE))
  const operatorPageRows = operatorRows.slice((page - 1) * OPERATOR_PAGE_SIZE, page * OPERATOR_PAGE_SIZE)

  const platformRows = platformResult?.entries ?? []
  const platformHasMore = platformResult?.has_more ?? false

  const matchCount = source === "operator" ? operatorRows.length : platformRows.length
  const isZero = matchCount === 0 && !platformLoading

  const canPrev = page > 1
  const canNext = source === "operator" ? page < operatorTotalPages : platformHasMore

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="rounded-[10px] border border-border bg-card px-4 py-3.5">
        {/* Header: title + source switch + ⌥ Technical names. */}
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <h2 className="font-headline text-base font-bold text-foreground">Audit log</h2>
            <span className="rounded-md bg-success/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-success">
              live
            </span>
          </div>

          {/* Source switch (067-A `.source-switch`) — one browser, two ledgers. */}
          <div
            role="tablist"
            aria-label="Audit source"
            className="inline-flex rounded-md border border-border bg-muted p-[3px]"
          >
            {(["operator", "platform"] as const).map((s) => {
              const on = source === s
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => onSourceChange(s)}
                  className={cn(
                    "rounded-[6px] px-3 py-1 text-xs transition-colors",
                    on
                      ? "bg-card font-semibold text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s === "operator" ? "Operator actions" : "Platform activity"}
                </button>
              )
            })}
          </div>

          <span className="flex-1" />
          <TechnicalNamesToggle enabled={showTechnical} onToggle={onToggleTechnical} />
        </div>

        {/* Live match count (amber at zero — the 067-A trust cue). */}
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span
            className={cn("tabular-nums", isZero ? "text-amber-500" : "text-muted-foreground")}
            data-testid="audit-match-count"
            data-zero={isZero ? "true" : "false"}
          >
            {source === "platform" && platformLoading && platformRows.length === 0
              ? "loading…"
              : `${matchCount}${platformHasMore ? "+" : ""} ${matchCount === 1 ? "entry" : "entries"}`}
          </span>
        </div>

        {/* The paged table — one row shape per source (067-A HTML structures). */}
        {source === "operator" ? (
          operatorRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground/70">
              No actions yet — everything an operator does here lands here.
            </p>
          ) : (
            <div className="flex flex-col">
              {operatorPageRows.map((row) => (
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
                  {showTechnical && (
                    <code className="flex-none rounded bg-muted/60 px-1 py-0.5 font-mono text-[10px] text-muted-foreground/70">
                      {row.action}
                    </code>
                  )}
                  <span className="ml-auto flex-none tabular-nums text-xs text-muted-foreground/70">
                    {formatWhen(row.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : platformRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground/70">
            {platformLoading ? "Loading platform activity…" : "No platform activity matches."}
          </p>
        ) : (
          <div className="flex flex-col">
            {platformRows.map((row) => (
              <div
                key={row.id}
                className="flex items-baseline gap-2.5 border-b border-border/40 py-2 text-sm last:border-b-0"
              >
                <span className="flex-none tabular-nums text-xs text-muted-foreground/70">
                  {formatWhen(row.created_at)}
                </span>
                <span className="flex-none font-mono text-xs text-muted-foreground">
                  {shortUser(row.user_id)}
                </span>
                <span className="text-foreground">{row.action_type}</span>
                {showTechnical && (
                  <code className="flex-none rounded bg-muted/60 px-1 py-0.5 font-mono text-[10px] text-muted-foreground/70">
                    {row.action_type}
                  </code>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pager — ‹ Prev · page i of N · Next › (067-A). N is known for the operator
            source (client-paged); the platform source shows the current page + a Next
            gated on the server has_more (no fabricated total — SC#4 no full-tenant leak). */}
        <div className="mt-2.5 flex items-center justify-center gap-3 border-t border-border/40 pt-2 text-xs text-muted-foreground/70">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md px-2 py-1 transition-colors enabled:hover:bg-accent/40 enabled:hover:text-foreground disabled:opacity-40"
          >
            ‹ Prev
          </button>
          <span className="tabular-nums">
            {source === "operator" ? `page ${page} of ${operatorTotalPages}` : `page ${page}`}
          </span>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md px-2 py-1 transition-colors enabled:hover:bg-accent/40 enabled:hover:text-foreground disabled:opacity-40"
          >
            Next ›
          </button>
        </div>

        <div className="mt-2.5 border-t border-border/40 pt-2 text-xs text-muted-foreground/70">
          Who did what, and when — every operator action, no exceptions.
        </div>
      </div>
    </div>
  )
}
