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
// leaf holds the local FILTER state (the 029-A chip strip) and renders. The
// operator source filters + paginates client-side over the ≤200 loaded rows; the
// platform source is server-paginated — the shell refetches on every filter/page
// change (a recorded `audit.view_platform` read each time; SC#4: viewing user
// activity is itself in the ledger).
//
// FILTER GRAMMAR (029-A / FilterBar heritage): action-type + date-preset chips with
// popover editors, a live match count (amber at zero — the trust cue), and, on the
// platform source, a per-user chip set by clicking a user in a row. Plain-first
// action labels (Documents / Chat & agent / Organizing / Other) with the raw
// `action_type` codes revealed behind the shared ⌥ Technical names toggle.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react"
import { Download, Eye, X } from "lucide-react"

import type { OperatorAuditRow, PlatformAuditFilters, PlatformAuditPage } from "@/lib/api"
import { cn } from "@/lib/utils"
import { TechnicalNamesToggle } from "./TechnicalNamesToggle"

/** The two ledgers the one browser reads (067-A source switch). */
export type AuditSource = "operator" | "platform"

type DatePreset = "all" | "today" | "7d" | "30d" | "custom"

/** The local, source-scoped filter state (029-A). `actionTypes` are raw codes (the
 *  UI shows plain-first labels); `since`/`until` are the resolved half-open ISO
 *  window; `userId` is the platform-only click-to-filter scope. */
interface AuditFilters {
  actionTypes: string[]
  datePreset: DatePreset
  since: string | null
  until: string | null
  userId: string | null
}

const EMPTY_FILTERS: AuditFilters = {
  actionTypes: [],
  datePreset: "all",
  since: null,
  until: null,
  userId: null,
}

/** Client-side page size for the operator source (the shell loads the full ≤200
 *  history once; this leaf pages over it). The platform source is server-paged. */
const OPERATOR_PAGE_SIZE = 25

// ── Plain-first vocabularies (067-A) ─────────────────────────────────────────
type ActionGroup = "Documents" | "Chat & agent" | "Organizing" | "Other"
const GROUP_ORDER: readonly ActionGroup[] = ["Documents", "Chat & agent", "Organizing", "Other"]

/** The platform `audit_log` 19-action vocabulary (migs 030/071) → plain label + group.
 *  This is the ONLY place the raw code → plain-language mapping lives (067-A). */
const PLATFORM_ACTION_META: Record<string, { label: string; group: ActionGroup }> = {
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

/** Prettify a platform `action_type` code for a row label; unknown codes fall back
 *  to the raw code (honest — never invents a label for a code we do not know). */
function platformLabel(code: string): string {
  return PLATFORM_ACTION_META[code]?.label ?? code
}

/** Plain labels for the operator ledger's own action codes (the `flag.*.*` family is
 *  matched by prefix; anything unmapped shows its raw code — no invented labels). */
const OPERATOR_ACTION_LABELS: Record<string, string> = {
  "control_plane.visit": "Opened the Control Plane",
  "health.view": "Viewed system health",
  "maintenance.set": "Toggled maintenance mode",
  "run.kill": "Ended a run",
  "audit.view": "Viewed the audit log",
  "audit.view_platform": "Viewed platform activity",
  "audit.export": "Exported audit entries",
  "user.disable": "Disabled a user",
  "user.enable": "Re-enabled a user",
  "operator.grant": "Granted operator access",
  "operator.revoke": "Removed operator access",
  "visibility.set": "Changed feature visibility",
}

function operatorActionLabel(code: string): string {
  if (code.startsWith("flag.")) return "Changed a capability switch"
  return OPERATOR_ACTION_LABELS[code] ?? code
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

function fmtDay(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/** A short, non-identifying handle for a platform row's acting user (metadata only —
 *  no email is joined server-side). Clicking it filters-to-them (067-A). */
function shortUser(userId: string | null): string {
  if (!userId) return "unknown user"
  return userId.length > 8 ? `${userId.slice(0, 8)}…` : userId
}

/** Resolve a preset into the half-open `[since, until)` UTC window the API expects.
 *  Days are treated as UTC so the input round-trips exactly (no TZ off-by-one). */
function resolvePreset(preset: Exclude<DatePreset, "custom">): { since: string | null; until: string | null } {
  if (preset === "all") return { since: null, until: null }
  const now = new Date()
  if (preset === "today") {
    const s = new Date(now)
    s.setUTCHours(0, 0, 0, 0)
    return { since: s.toISOString(), until: null }
  }
  const days = preset === "7d" ? 7 : 30
  const s = new Date(now.getTime() - days * 86_400_000)
  return { since: s.toISOString(), until: null }
}

/** The plain-language resolved-window readout under the date chip (030-A heritage). */
function windowReadout(f: AuditFilters): string {
  switch (f.datePreset) {
    case "all":
      return "all time"
    case "today":
      return "today"
    case "7d":
      return "the last 7 days"
    case "30d":
      return "the last 30 days"
    case "custom": {
      if (f.since && f.until) return `${fmtDay(f.since)} – ${fmtDay(f.until)}`
      if (f.since) return `since ${fmtDay(f.since)}`
      if (f.until) return `until ${fmtDay(f.until)}`
      return "a custom range"
    }
  }
}

const DATE_CHIP_LABEL: Record<DatePreset, string> = {
  all: "any time",
  today: "today",
  "7d": "last 7 days",
  "30d": "last 30 days",
  custom: "custom range",
}

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
  /** Export EXACTLY the filtered platform set as CSV (067-A). The shell calls the
   *  recorded `audit.export` endpoint; this promise REJECTS on the over-cap 413 so the
   *  leaf shows the "narrow the filter" refusal instead of a partial download. */
  onExportPlatform: (filters: PlatformAuditFilters) => Promise<void>
  /** The shared ⌥ two-audience reveal (LANG-01) — raw `action_type` codes behind it. */
  showTechnical: boolean
  onToggleTechnical: () => void
}

/** CSV-escape one field (quote-wrap + double any inner quotes). */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/** Build a CSV of the operator ledger's filtered rows (the operator source export is
 *  client-side — these are the operator's OWN actions, already in the ledger; there is
 *  no cross-user read to record). The platform export is the recorded server endpoint. */
function operatorCsv(rows: OperatorAuditRow[]): string {
  const lines = [["timestamp", "action", "label", "is_write"].join(",")]
  for (const r of rows) {
    lines.push([csvField(r.created_at), csvField(r.action), csvField(r.label), r.is_write ? "true" : "false"].join(","))
  }
  return lines.join("\n")
}

/** Trigger a browser download of an in-memory CSV blob (mirrors the api.ts idiom). */
function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** The 067-A audit browser — source switch + chip filters + paged table over both ledgers. */
export function AuditTab({
  source,
  onSourceChange,
  operatorRows,
  platformResult,
  platformLoading,
  onQueryPlatform,
  onExportPlatform,
  showTechnical,
  onToggleTechnical,
}: AuditTabProps) {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [openChip, setOpenChip] = useState<"action" | "date" | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Flipping the source resets the filter (the two ledgers have different vocab) +
  // paging + any open popover, in one batched update (no stale intermediate fetch).
  function switchSource(next: AuditSource) {
    setFilters(EMPTY_FILTERS)
    setPage(1)
    setOpenChip(null)
    setExportError(null)
    onSourceChange(next)
  }

  // Any filter change resets to page 1 (the count/pager reflect the new narrowing).
  function applyFilters(next: AuditFilters) {
    setFilters(next)
    setPage(1)
    setOpenChip(null)
    setExportError(null)
  }

  const platformFilters = useMemo<PlatformAuditFilters>(
    () => ({
      userId: filters.userId,
      actionTypes: filters.actionTypes,
      since: filters.since,
      until: filters.until,
    }),
    [filters],
  )

  // Platform source is server-paged: (re)ask the shell for a page whenever the
  // source is platform or the filters/page change. Each call records a deliberate
  // `audit.view_platform` read server-side (SC#4). Operator source is client-side.
  useEffect(() => {
    if (source === "platform") onQueryPlatform(platformFilters, page)
  }, [source, platformFilters, page, onQueryPlatform])

  // The action-type option groups depend on the source: the platform vocabulary is the
  // fixed 4-group plain-first map; the operator vocabulary is derived from the codes
  // actually present in the loaded ledger (grouped under one heading).
  const actionGroups = useMemo<{ group: string; options: { code: string; label: string }[] }[]>(() => {
    if (source === "platform") {
      return GROUP_ORDER.map((g) => ({
        group: g,
        options: Object.entries(PLATFORM_ACTION_META)
          .filter(([, m]) => m.group === g)
          .map(([code, m]) => ({ code, label: m.label })),
      })).filter((grp) => grp.options.length > 0)
    }
    const codes = Array.from(new Set(operatorRows.map((r) => r.action))).sort()
    return [{ group: "Operator actions", options: codes.map((code) => ({ code, label: operatorActionLabel(code) })) }]
  }, [source, operatorRows])

  // Operator source filters + pages client-side over the loaded ledger (ISO-UTC
  // string compare is chronologically correct for the half-open window).
  const operatorFiltered = useMemo(
    () =>
      operatorRows.filter((r) => {
        if (filters.actionTypes.length && !filters.actionTypes.includes(r.action)) return false
        if (filters.since && r.created_at < filters.since) return false
        if (filters.until && r.created_at >= filters.until) return false
        return true
      }),
    [operatorRows, filters],
  )

  const operatorTotalPages = Math.max(1, Math.ceil(operatorFiltered.length / OPERATOR_PAGE_SIZE))
  const operatorPageRows = operatorFiltered.slice((page - 1) * OPERATOR_PAGE_SIZE, page * OPERATOR_PAGE_SIZE)

  const platformRows = platformResult?.entries ?? []
  const platformHasMore = platformResult?.has_more ?? false

  const matchCount = source === "operator" ? operatorFiltered.length : platformRows.length
  const isZero = matchCount === 0 && !platformLoading

  const canPrev = page > 1
  const canNext = source === "operator" ? page < operatorTotalPages : platformHasMore

  const dateActive = filters.datePreset !== "all"
  const actionActive = filters.actionTypes.length > 0

  function toggleActionType(code: string) {
    const has = filters.actionTypes.includes(code)
    applyFilters({
      ...filters,
      actionTypes: has ? filters.actionTypes.filter((c) => c !== code) : [...filters.actionTypes, code],
    })
    // Keep the popover open for multi-select — re-open after applyFilters closed it.
    setOpenChip("action")
  }

  function setPreset(preset: Exclude<DatePreset, "custom">) {
    const { since, until } = resolvePreset(preset)
    applyFilters({ ...filters, datePreset: preset, since, until })
  }

  function setCustomFrom(day: string) {
    const since = day ? `${day}T00:00:00.000Z` : null
    applyFilters({ ...filters, datePreset: "custom", since })
    setOpenChip("date")
  }

  function setCustomTo(day: string) {
    // Half-open window: `until` is the START of the day AFTER the picked "to" day, so
    // the picked day is fully included.
    const until = day ? new Date(new Date(`${day}T00:00:00.000Z`).getTime() + 86_400_000).toISOString() : null
    applyFilters({ ...filters, datePreset: "custom", until })
    setOpenChip("date")
  }

  const customFromValue = filters.since ? filters.since.slice(0, 10) : ""
  const customToValue = filters.until
    ? new Date(new Date(filters.until).getTime() - 86_400_000).toISOString().slice(0, 10)
    : ""

  // Export button copy names the LIVE match count (067-A CSV honesty). When the
  // platform total is not fully known (has_more), the button honestly says "all
  // matching" and the server receipt names the exact count in the ledger.
  const exportLabel = exporting
    ? "Exporting…"
    : source === "platform" && platformHasMore
      ? "Export all matching entries"
      : `Export ${matchCount} ${matchCount === 1 ? "entry" : "entries"}`

  async function handleExport() {
    setExportError(null)
    if (source === "operator") {
      // The operator's own actions — a client-side CSV of exactly the filtered set.
      downloadCsv("operator-audit.csv", operatorCsv(operatorFiltered))
      return
    }
    setExporting(true)
    try {
      await onExportPlatform(platformFilters)
    } catch (err) {
      // The shell rejects with an ApiError-shaped `status`; 413 is the over-cap refusal
      // (the server recorded NOTHING and sent no file — never a partial download).
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? Number((err as { status: unknown }).status)
          : 0
      setExportError(
        status === 413
          ? "Too many rows — narrow the filter, then export again."
          : "Export failed — please try again.",
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl w-full px-6 py-6">
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
                  onClick={() => switchSource(s)}
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
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || matchCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-accent px-3 py-1 text-xs text-muted-foreground transition-colors enabled:hover:border-muted-foreground/40 enabled:hover:text-foreground disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {exportLabel}
          </button>
        </div>

        {/* Cross-user reading is visible, never silent (SC#4 — the threat made legible). */}
        {source === "platform" && (
          <p className="mb-2.5 flex items-center gap-1.5 rounded-md bg-amber-400/10 px-2.5 py-1.5 text-[11px] text-amber-600/90 dark:text-amber-400/80">
            <Eye className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
            Looking at user activity is itself recorded.
          </p>
        )}

        {/* Over-cap / failed export refusal — surfaced, never a partial download. */}
        {exportError && (
          <p className="mb-2.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive" role="alert">
            {exportError}
          </p>
        )}

        {/* 029-A chip strip: Show [action type] [when] [+ user?] · N entries match. */}
        <div className="relative mb-1.5 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Show</span>

          {/* Action-type chip. */}
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
                {actionActive
                  ? `${filters.actionTypes.length} action${filters.actionTypes.length > 1 ? "s" : ""}`
                  : "any action"}
              </button>
              {actionActive && (
                <button
                  type="button"
                  aria-label="Clear action-type filter"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => applyFilters({ ...filters, actionTypes: [] })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>

            {openChip === "action" && (
              <div className="absolute left-0 top-full z-30 mt-2 max-h-72 w-64 overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-lg">
                {actionGroups.every((g) => g.options.length === 0) ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">No actions to filter yet.</p>
                ) : (
                  actionGroups.map((grp) => (
                    <div key={grp.group} className="mb-1.5 last:mb-0">
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {grp.group}
                      </p>
                      {grp.options.map((opt) => {
                        const checked = filters.actionTypes.includes(opt.code)
                        return (
                          <button
                            key={opt.code}
                            type="button"
                            onClick={() => toggleActionType(opt.code)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-accent/50"
                          >
                            <span
                              className={cn(
                                "flex h-3.5 w-3.5 flex-none items-center justify-center rounded border text-[9px]",
                                checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                              )}
                              aria-hidden="true"
                            >
                              {checked ? "✓" : ""}
                            </span>
                            <span className="flex-1 text-foreground">{opt.label}</span>
                            {showTechnical && (
                              <code className="font-mono text-[10px] text-muted-foreground">{opt.code}</code>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ))
                )}
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
                {DATE_CHIP_LABEL[filters.datePreset]}
              </button>
              {dateActive && (
                <button
                  type="button"
                  aria-label="Clear date filter"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => applyFilters({ ...filters, datePreset: "all", since: null, until: null })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>

            {openChip === "date" && (
              <div className="absolute left-0 top-full z-30 mt-2 w-56 rounded-lg border border-border bg-popover p-2 shadow-lg">
                <div className="flex flex-col gap-0.5">
                  {(["today", "7d", "30d", "all"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPreset(p)}
                      className={cn(
                        "rounded-md px-2 py-1 text-left text-xs hover:bg-accent/50",
                        filters.datePreset === p ? "font-semibold text-primary" : "text-foreground",
                      )}
                    >
                      {p === "all" ? "All time" : DATE_CHIP_LABEL[p]}
                    </button>
                  ))}
                </div>
                <div className="mt-2 border-t border-border/60 pt-2">
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Custom range
                  </p>
                  <div className="flex flex-col gap-1.5 px-1">
                    <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      From
                      <input
                        type="date"
                        value={customFromValue}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      To
                      <input
                        type="date"
                        value={customToValue}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </span>

          {/* Per-user chip (platform only — set by clicking a user in a row). */}
          {source === "platform" && filters.userId && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 py-1 pl-3 pr-1.5 text-xs">
              <span className="font-medium">user {shortUser(filters.userId)}</span>
              <button
                type="button"
                aria-label="Clear user filter"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => applyFilters({ ...filters, userId: null })}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}

          {/* Live match count — amber at zero (the 067-A trust cue). */}
          <span
            className={cn(
              "ml-auto tabular-nums text-xs",
              isZero ? "text-amber-500" : "text-muted-foreground",
            )}
            data-testid="audit-match-count"
            data-zero={isZero ? "true" : "false"}
          >
            {source === "platform" && platformLoading && platformRows.length === 0
              ? "loading…"
              : `${matchCount}${platformHasMore ? "+" : ""} ${matchCount === 1 ? "entry" : "entries"} match`}
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

        {/* Resolved-window readout (030-A heritage) — always honest about the span. */}
        <p className="mb-2.5 text-[11px] text-muted-foreground">Showing {windowReadout(filters)}.</p>

        {/* The paged table — one row shape per source (067-A HTML structures). */}
        {source === "operator" ? (
          operatorFiltered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {operatorRows.length === 0
                ? "No actions yet — everything an operator does here lands here."
                : "No operator actions match these filters."}
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
                    <code className="flex-none rounded bg-muted/60 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {row.action}
                    </code>
                  )}
                  <span className="ml-auto flex-none tabular-nums text-xs text-muted-foreground">
                    {formatWhen(row.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : platformRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {platformLoading ? "Loading platform activity…" : "No platform activity matches these filters."}
          </p>
        ) : (
          <div className="flex flex-col">
            {platformRows.map((row) => (
              <div
                key={row.id}
                className="flex items-baseline gap-2.5 border-b border-border/40 py-2 text-sm last:border-b-0"
              >
                <span className="flex-none tabular-nums text-xs text-muted-foreground">
                  {formatWhen(row.created_at)}
                </span>
                <button
                  type="button"
                  onClick={() => applyFilters({ ...filters, userId: row.user_id })}
                  disabled={!row.user_id}
                  title={row.user_id ? "Filter to this user" : undefined}
                  className="flex-none font-mono text-xs text-muted-foreground hover:text-primary hover:underline disabled:cursor-default disabled:no-underline"
                >
                  {shortUser(row.user_id)}
                </button>
                <span className="text-foreground">{platformLabel(row.action_type)}</span>
                {showTechnical && (
                  <code className="flex-none rounded bg-muted/60 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
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
        <div className="mt-2.5 flex items-center justify-center gap-3 border-t border-border/40 pt-2 text-xs text-muted-foreground">
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

        <div className="mt-2.5 border-t border-border/40 pt-2 text-xs text-muted-foreground">
          Who did what, and when — every operator action, no exceptions.
        </div>
      </div>
    </div>
  )
}
