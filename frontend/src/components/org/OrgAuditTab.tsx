// ─────────────────────────────────────────────────────────────────────────────
// Phase 166 Plan 03 (ADMIN-04 / D-166-04 / sketch 080-A) — the org audit list.
//
// The user-side, LIGHTER cut of the operator `AuditTab`: a single-ledger list over
// the org-scoped `audit_log` (list + chip filters), with the operator ledger switch
// and the CSV export STRIPPED (D-166-04 — CSV is deferred within-phase). It reuses
// the 067-A plain-first action vocabulary + the 029-A chip-filter strip + the ⌥
// two-audience raw-code reveal, re-tinted from the operator warning color to
// org-indigo (the one exception: the "at zero" match-count trust cue stays amber —
// that is a semantic warning color, not zone chrome).
//
// LOAD-BEARING HONESTY (T-166-08): the server returns a `scope` flag. When
// `scope === "own"` (the caller lacks `org:audit_view`) the tab renders an explicit
// "you see only your own activity" banner ABOVE the own-only rows — NEVER a silent
// empty list. The tab renders exactly the rows + scope the server returned; it
// cannot widen visibility (there is no client-side "show everyone").
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell (Plan 04) owns the guarded
// fetch + paging; this leaf holds only the transient popover-open state and reports
// filter/page intent. The ⌥ value is prop-controlled so the shell can move ONE
// shared `useTechnicalNames` value across the band + this reveal.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from "react"
import { Eye, X } from "lucide-react"

import type { OrgAuditFilters, OrgAuditPage, OrgAuditRow } from "@/lib/api"
import { cn } from "@/lib/utils"
import { TechnicalNamesToggle } from "@/components/admin/TechnicalNamesToggle"

// ── Plain-first vocabulary (067-A) — the raw audit_log code → plain label + group.
//    Copied from the operator AuditTab (the SAME audit_log vocabulary; a shared export
//    would touch a file outside this plan's surface). ─────────────────────────────
type ActionGroup = "Documents" | "Chat & agent" | "Organizing" | "Other"
const GROUP_ORDER: readonly ActionGroup[] = ["Documents", "Chat & agent", "Organizing", "Other"]

const ACTION_META: Record<string, { label: string; group: ActionGroup }> = {
  "document.upload": { label: "Uploaded a document", group: "Documents" },
  "document.delete": { label: "Deleted a document", group: "Documents" },
  "metadata.update": { label: "Edited document details", group: "Documents" },
  "classification.apply": { label: "Classified a document", group: "Documents" },
  "search.query": { label: "Searched documents", group: "Chat & agent" },
  "code.execute": { label: "Ran code", group: "Chat & agent" },
  "skill.load": { label: "Loaded a skill", group: "Chat & agent" },
  "thread.create": { label: "Started a chat", group: "Chat & agent" },
  "thread.delete": { label: "Deleted a chat", group: "Chat & agent" },
  "memory.remember": { label: "Saved a memory", group: "Chat & agent" },
  "memory.recall": { label: "Recalled a memory", group: "Chat & agent" },
  "view.create": { label: "Created a view", group: "Organizing" },
  "view.delete": { label: "Deleted a view", group: "Organizing" },
  "relationship.create": { label: "Linked documents", group: "Organizing" },
  "relationship.delete": { label: "Unlinked documents", group: "Organizing" },
  "classification.rule.create": { label: "Created a classification rule", group: "Organizing" },
  "metadata.field.create": { label: "Added a metadata field", group: "Organizing" },
  "settings.update": { label: "Changed settings", group: "Other" },
  "feedback.submit": { label: "Sent feedback", group: "Other" },
}

/** Prettify an `action_type` for a row label; unknown codes fall back to the raw
 *  code (honest — never invents a label for a code we do not know). */
function actionLabel(code: string): string {
  return ACTION_META[code]?.label ?? code
}

// Phase 167-02: invitation lifecycle rows reuse action_type='settings.update' + a
// metadata.event discriminator (the audit_log CHECK enum has no invitation type, and
// 167-CONTEXT forbids a migration). Render the honest event label so the org Audit tab
// is truthful — NEVER a bare "Changed settings" for an invitation write.
const INVITE_EVENT_LABEL: Record<string, string> = {
  "invitation.send": "Invitation sent",
  "invitation.resend": "Invitation resent",
  "invitation.revoke": "Invitation revoked",
  "invitation.accept": "Invitation accepted",
}

/** The row's plain label — an invitation metadata.event wins over the generic
 *  settings.update action label so invitation writes read honestly (Phase 167). */
function rowLabel(row: OrgAuditRow): string {
  const meta = row.metadata
  const event =
    meta && typeof meta === "object" ? (meta as Record<string, unknown>).event : undefined
  if (typeof event === "string" && event in INVITE_EVENT_LABEL) {
    return INVITE_EVENT_LABEL[event]
  }
  return actionLabel(row.action_type)
}

/** The `since` chip presets the backend understands (`_since_to_dt`: 7d/30d/90d). */
type DateChip = "all" | "7d" | "30d" | "90d"
const DATE_CHIP_LABEL: Record<DateChip, string> = {
  all: "any time",
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 90 days",
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

/** A short, non-identifying handle for a row's acting user (metadata only). */
function shortUser(userId: string | null): string {
  if (!userId) return "unknown user"
  return userId.length > 8 ? `${userId.slice(0, 8)}…` : userId
}

interface OrgAuditTabProps {
  /** The current server page of the org audit browse (null until first fetched). */
  result: OrgAuditPage | null
  /** True while the shell is fetching a page (honest in-flight state). */
  loading: boolean
  /** The active filter values (the shell owns the state + the guarded refetch). */
  filters: OrgAuditFilters
  onFiltersChange: (filters: OrgAuditFilters) => void
  /** Ask the shell for a different 1-based page (server-paged). */
  onPageChange: (page: number) => void
  /** The shared ⌥ two-audience reveal (LANG-01) — raw `action_type` codes behind it. */
  showTechnical: boolean
  onToggleTechnical: () => void
}

/** The lighter org audit browser — chip filters + paged list + RLS-honest degrade. */
export function OrgAuditTab({
  result,
  loading,
  filters,
  onFiltersChange,
  onPageChange,
  showTechnical,
  onToggleTechnical,
}: OrgAuditTabProps) {
  const [openChip, setOpenChip] = useState<"action" | "date" | null>(null)

  const entries = result?.entries ?? []
  const total = result?.total ?? 0
  const pageSize = result?.page_size ?? 50
  const currentPage = result?.page ?? 1
  const scope = result?.scope
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const activeDate: DateChip = (filters.since as DateChip) ?? "all"
  const actionType = filters.actionType ?? null
  const dateActive = activeDate !== "all"
  const actionActive = Boolean(actionType)

  const isZero = total === 0 && !loading

  const actionGroups = useMemo(
    () =>
      GROUP_ORDER.map((g) => ({
        group: g,
        options: Object.entries(ACTION_META)
          .filter(([, m]) => m.group === g)
          .map(([code, m]) => ({ code, label: m.label })),
      })).filter((grp) => grp.options.length > 0),
    [],
  )

  function setActionType(code: string) {
    // Single-select (the backend takes one `action_type`): re-clicking clears it.
    onFiltersChange({ ...filters, actionType: actionType === code ? null : code })
    setOpenChip(null)
  }

  function setDate(chip: DateChip) {
    onFiltersChange({ ...filters, since: chip === "all" ? null : chip })
    setOpenChip(null)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="rounded-[10px] border border-border bg-card px-4 py-3.5">
        {/* Header: title + ⌥ Technical names. No ledger switch, no CSV (lighter cut). */}
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <h2 className="font-headline text-base font-bold text-foreground">Activity</h2>
            <span className="rounded-md bg-success/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-success">
              live
            </span>
          </div>
          <span className="flex-1" />
          <TechnicalNamesToggle enabled={showTechnical} onToggle={onToggleTechnical} />
        </div>

        {/* RLS-honest degrade (T-166-08 / D-166-04): the caller lacks org:audit_view, so
            they see only their OWN rows — say so, never a silent empty list. */}
        {scope === "own" && (
          <p
            data-testid="org-audit-own-banner"
            role="status"
            className="mb-2.5 flex items-start gap-1.5 rounded-md border border-primary/25 bg-primary/[0.06] px-2.5 py-2 text-[11px] text-muted-foreground"
          >
            <Eye className="mt-0.5 h-3.5 w-3.5 flex-none text-primary" aria-hidden="true" />
            <span>
              You see only your own activity here. Seeing everyone&rsquo;s activity needs the
              audit-view permission — ask an org-admin.
            </span>
          </p>
        )}

        {/* 029-A chip strip: Show [action type] [when] · N entries match. */}
        <div className="relative mb-1.5 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Show</span>

          {/* Action-type chip (single-select). */}
          <span className="relative inline-flex items-center">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 text-xs",
                actionActive ? "border-primary/40 bg-primary/10 pr-1.5" : "border-border bg-card pr-3",
              )}
            >
              <button
                type="button"
                className="font-medium hover:text-primary"
                onClick={() => setOpenChip((c) => (c === "action" ? null : "action"))}
              >
                {actionActive ? actionLabel(actionType as string) : "any action"}
              </button>
              {actionActive && (
                <button
                  type="button"
                  aria-label="Clear action-type filter"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onFiltersChange({ ...filters, actionType: null })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>

            {openChip === "action" && (
              <div className="absolute left-0 top-full z-30 mt-2 max-h-72 w-64 overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-lg">
                {actionGroups.map((grp) => (
                  <div key={grp.group} className="mb-1.5 last:mb-0">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {grp.group}
                    </p>
                    {grp.options.map((opt) => {
                      const checked = actionType === opt.code
                      return (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={() => setActionType(opt.code)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-accent/50"
                        >
                          <span
                            className={cn(
                              "flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full border text-[9px]",
                              checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                            )}
                            aria-hidden="true"
                          >
                            {checked ? "•" : ""}
                          </span>
                          <span className="flex-1 text-foreground">{opt.label}</span>
                          {showTechnical && (
                            <code className="font-mono text-[10px] text-muted-foreground">{opt.code}</code>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </span>

          {/* Date chip. */}
          <span className="relative inline-flex items-center">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 text-xs",
                dateActive ? "border-primary/40 bg-primary/10 pr-1.5" : "border-border bg-card pr-3",
              )}
            >
              <button
                type="button"
                className="font-medium hover:text-primary"
                onClick={() => setOpenChip((c) => (c === "date" ? null : "date"))}
              >
                {DATE_CHIP_LABEL[activeDate]}
              </button>
              {dateActive && (
                <button
                  type="button"
                  aria-label="Clear date filter"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onFiltersChange({ ...filters, since: null })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>

            {openChip === "date" && (
              <div className="absolute left-0 top-full z-30 mt-2 w-48 rounded-lg border border-border bg-popover p-2 shadow-lg">
                <div className="flex flex-col gap-0.5">
                  {(["all", "7d", "30d", "90d"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setDate(p)}
                      className={cn(
                        "rounded-md px-2 py-1 text-left text-xs hover:bg-accent/50",
                        activeDate === p ? "font-semibold text-primary" : "text-foreground",
                      )}
                    >
                      {p === "all" ? "All time" : DATE_CHIP_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </span>

          {/* Live match count — amber at zero (the trust cue; kept as a warning color). */}
          <span
            className={cn(
              "ml-auto tabular-nums text-xs",
              isZero ? "text-amber-500" : "text-muted-foreground",
            )}
            data-testid="org-audit-match-count"
            data-zero={isZero ? "true" : "false"}
          >
            {loading && entries.length === 0
              ? "loading…"
              : `${total} ${total === 1 ? "entry" : "entries"} match`}
          </span>

          {/* Click-anywhere backdrop that closes an open popover. */}
          {openChip && (
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              className="fixed inset-0 z-20 cursor-default"
              onClick={() => setOpenChip(null)}
            />
          )}
        </div>

        {/* The paged list. */}
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {loading ? "Loading activity…" : "No activity matches these filters."}
          </p>
        ) : (
          <div className="flex flex-col">
            {entries.map((row) => (
              <div
                key={row.id}
                className="flex items-baseline gap-2.5 border-b border-border/40 py-2 text-sm last:border-b-0"
              >
                <span className="flex-none tabular-nums text-xs text-muted-foreground">
                  {formatWhen(row.created_at)}
                </span>
                <span className="flex-none font-mono text-xs text-muted-foreground">
                  {shortUser(row.user_id)}
                </span>
                <span className="text-foreground">{rowLabel(row)}</span>
                {showTechnical && (
                  <code className="flex-none rounded bg-muted/60 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {row.action_type}
                  </code>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pager — ‹ Prev · page i of N · Next › (server-paged; N from the scoped total). */}
        <div className="mt-2.5 flex items-center justify-center gap-3 border-t border-border/40 pt-2 text-xs text-muted-foreground">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            className="rounded-md px-2 py-1 transition-colors enabled:hover:bg-accent/40 enabled:hover:text-foreground disabled:opacity-40"
          >
            ‹ Prev
          </button>
          <span className="tabular-nums">
            page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="rounded-md px-2 py-1 transition-colors enabled:hover:bg-accent/40 enabled:hover:text-foreground disabled:opacity-40"
          >
            Next ›
          </button>
        </div>

        <div className="mt-2.5 border-t border-border/40 pt-2 text-xs text-muted-foreground">
          Who did what in your organization, and when.
        </div>
      </div>
    </div>
  )
}
