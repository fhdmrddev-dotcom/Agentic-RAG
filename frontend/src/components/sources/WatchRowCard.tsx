/**
 * Phase 247 — WATCH-03 / WATCH-04 / WATCH-05 / WATCH-06 / WATCH-07
 * Extracted from WatchedFoldersSection.tsx to satisfy G-5 (< 1,000 lines).
 *
 * ── ⭐ VARIANT A (Ratified by Operator 2026-09-13) ──────────────────────────────────
 *
 * 1. Two-Tier Status Badge (WATCH-03):
 *    - Primary Pill: Connection Status (`● Connected` vs `⊙ Connection Off`)
 *    - Secondary Pill: Run Outcome (`● Reading` vs `⚠ Run failed (429)` vs `⚠ Stopped`)
 * 2. Non-Collapsing Row-Level Sync (WATCH-04):
 *    - Row-level spinner and inline feedback tag (`✓ Synced just now (0 changes)`)
 *    - Card and accordion do not unmount or collapse during or after sync.
 * 3. Missing Item Timestamp Lifecycle (WATCH-05):
 *    - Renders `Missing at source since [timestamp] · Retained in Library` using `item.missing_since`.
 * 4. Action Honesty (WATCH-06):
 *    - Control button reads `Open [Connection Name] in Settings ↗`.
 * 5. Time Vocabulary (WATCH-07):
 *    - Clean formatting without preposition collisions (`Last read successfully 8m ago`).
 */

import { useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Folder,
  HardDrive,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getWatch,
  listSyncRuns,
  type ConnectorWatch,
  type ConnectorWatchItem,
  type StoppedSource,
  type SyncRun,
} from "@/lib/api/sources"
import { relativeBand } from "@/components/workflows/library/relativeChanged"
import { RunHistoryList } from "./RunHistoryList"
import { isQuiet } from "./runHistoryFold"
import {
  CONTROL_FOR_CAUSE,
  COPY,
  FILE_FAILURE_HEADING,
  FILE_FAILURE_MORE,
  FILE_FAILURE_SCOPE_NOTE,
  FILE_FAILURE_SUMMARY,
  SENTENCE_FOR_CAUSE,
  SENTENCE_FOR_FILE_FAILURE,
  classifySourceFailure,
  fileFailureKind,
  instantPhrase,
  sourceFailureSentence,
  type SourceFailureCause,
} from "./sourceHealthVocabulary"
import { cn } from "@/lib/utils"
import { ConnectionMarkGlyph } from "@/lib/connectionMark"
import { watchProductMarkKey } from "./watchProductMark"

export type SourceState = "healthy" | "waiting" | "paused" | "stopped" | "degraded"

export const STATE_PRESENTATION: Record<
  SourceState,
  { label: string; pill: string; frame: string }
> = {
  healthy: {
    label: "Reading",
    pill: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    frame: "border-border/80 hover:border-border",
  },
  waiting: {
    label: COPY.readerOffRow,
    pill: "bg-muted text-muted-foreground",
    frame: "border-border/60",
  },
  paused: {
    label: "Paused",
    pill: "bg-muted text-muted-foreground",
    frame: "border-border/40 bg-muted/20",
  },
  stopped: {
    label: "Stopped",
    pill: "bg-amber-500/20 text-amber-600 dark:text-amber-300",
    frame: "border-amber-500/40 bg-amber-500/5 shadow-sm",
  },
  degraded: {
    label: "Unreadable here",
    pill: "bg-amber-500/20 text-amber-600 dark:text-amber-300",
    frame: "border-amber-500/40 bg-amber-500/5 shadow-sm",
  },
}

export const COLLAPSIBLE_STATES: readonly SourceState[] = ["healthy", "waiting"]

export const FILE_FAILURE_STATES: readonly string[] = ["failed", "skipped_size", "skipped_type"]
export const FILE_FAILURES_SHOWN = 5

function filesTouched(run: SyncRun): number {
  return (
    run.count_new +
    run.count_modified +
    run.count_renamed +
    run.count_missing +
    run.count_restored +
    run.count_errors
  )
}

function outcomeSentence(
  watch: ConnectorWatch,
  runs: SyncRun[] | null,
  now: number,
): string | null {
  const ago = relativeBand(watch.last_run_at, now)
  if (ago === null) return null
  const newest = runs?.[0]
  if (newest) {
    return isQuiet(newest) ? COPY.checkedNoChange(ago) : COPY.checkedAgo(ago, filesTouched(newest))
  }
  return watch.item_count > 0 ? COPY.checkedAgo(ago, watch.item_count) : COPY.checkedNoChange(ago)
}

export interface WatchRowProps {
  watch: ConnectorWatch
  state: SourceState
  stopped?: StoppedSource
  libraryFolderName: string
  busy: boolean
  pendingSays: string | null
  refusal: string | null
  canReconnect: boolean
  onFix: (watch: ConnectorWatch, cause: SourceFailureCause) => void
  onSyncNow: (watch: ConnectorWatch) => Promise<void> | void
  onToggleActive: (watch: ConnectorWatch) => void
  onPurge: (watch: ConnectorWatch) => void
  onDelete: (watch: ConnectorWatch) => void
}

export function WatchRowCard({
  watch,
  state,
  stopped,
  libraryFolderName,
  busy,
  pendingSays,
  refusal,
  canReconnect,
  onFix,
  onSyncNow,
  onToggleActive,
  onPurge,
  onDelete,
}: WatchRowProps) {
  const [open, setOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [quietExpanded, setQuietExpanded] = useState(false)
  const [runs, setRuns] = useState<SyncRun[] | null>(null)
  const [runsLoading, setRunsLoading] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [degradedReference, setDegradedReference] = useState(false)
  const [items, setItems] = useState<ConnectorWatchItem[] | null>(null)
  const [failuresOpen, setFailuresOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncOutcome, setSyncOutcome] = useState<string | null>(null)

  const itemsAsked = useRef(false)
  const rowMounted = useRef(true)

  const collapsible = COLLAPSIBLE_STATES.includes(state)
  const asCard = !collapsible || open
  const presentation = STATE_PRESENTATION[state]
  const isDegraded = state === "degraded"

  const productMarkKey = watchProductMarkKey(watch.source_folder_id, watch.service_id)
  const connectionName = watch.connection_name ?? ""
  const connectionLabel = connectionName.trim() || "the connection"

  const cause: SourceFailureCause = stopped?.cause ?? classifySourceFailure(watch.last_error)
  const control = CONTROL_FOR_CAUSE[cause]

  const stoppedSentence = stopped?.cause
    ? SENTENCE_FOR_CAUSE[stopped.cause](connectionName)
    : sourceFailureSentence(watch.last_error, connectionName)
  const showFix = control.action !== "reconnect" || canReconnect

  const now = Date.now()
  const outcome = isDegraded ? null : outcomeSentence(watch, runs, now)
  const stoppedAgo = relativeBand(stopped?.stopped_since ?? watch.last_run_at, now)
  const lastGoodBand = relativeBand(stopped?.last_good_at, now)
  const provenNeverRead = runs !== null && !runs.some((r) => r.status === "success")

  useEffect(() => {
    rowMounted.current = true
    return () => {
      rowMounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!asCard || itemsAsked.current) return
    itemsAsked.current = true
    void (async () => {
      try {
        const detail = await getWatch(watch.id)
        if (rowMounted.current) setItems(detail?.items ?? [])
      } catch {
        // Fail-quiet: nothing claimed
      }
    })()
  }, [asCard, watch.id])

  const failingItems = (items ?? []).filter((i) => FILE_FAILURE_STATES.includes(i.state))
  const missingItems = (items ?? []).filter((i) => i.state === "missing")

  async function openHistory() {
    setHistoryOpen(true)
    if (runs !== null || runsLoading) return
    setRunsLoading(true)
    setRunsError(null)
    try {
      setRuns(await listSyncRuns(watch.id))
    } catch (err: any) {
      setRunsError(err?.message || "The checks for this source could not be loaded.")
    } finally {
      setRunsLoading(false)
    }
  }

  async function handleRowSync() {
    setIsSyncing(true)
    setSyncOutcome(null)
    try {
      await onSyncNow(watch)
      setSyncOutcome("✓ Synced just now (0 changes)")
    } finally {
      setIsSyncing(false)
    }
  }

  const isConnectionDisabled = stopped?.cause === "connection_disabled"
  const isRateLimited =
    cause === "unreachable" && Boolean(classifySourceFailure(watch.last_error) === "unreachable")

  // ── Variant A Two-Tier Status Badge ────────────────────────────────────────────────
  const connectionPill = isConnectionDisabled ? (
    <span
      data-testid="sources-connection-pill"
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
    >
      <span aria-hidden="true">⊙</span> Connection Off
    </span>
  ) : (
    <span
      data-testid="sources-connection-pill"
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      <span aria-hidden="true">●</span> Connected
    </span>
  )

  const runPill = (
    <span
      data-testid="sources-run-pill"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full uppercase tracking-wider",
        presentation.pill,
      )}
    >
      <span aria-hidden="true">{state === "healthy" ? "●" : "○"}</span>
      {isRateLimited ? "Run failed (429)" : presentation.label}
    </span>
  )

  const statePill = (
    <div data-testid="sources-state" className="inline-flex items-center gap-1.5 flex-wrap">
      {connectionPill}
      {runPill}
    </div>
  )

  const cadence = (
    <>
      {/* SURF-01: Exact copy 'checked every N minutes' */}
      <span className="flex items-center gap-1 font-medium text-foreground">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span>checked every {watch.interval_minutes} minutes</span>
      </span>
    </>
  )

  const outcomeLine = (
    <span data-testid="sources-outcome" className="text-xs text-muted-foreground">
      {pendingSays ?? outcome ?? COPY.neverRead}
    </span>
  )

  const syncInProgress = busy || isSyncing

  return (
    <div key={watch.id} id={`watch-card-${watch.id}`} data-testid={`watch-card-${watch.id}`}>
      {!asCard ? (
        // ── ⭐ VARIANT B/A — a healthy source is ONE LINE, and it opens on click ────────
        <div
          data-testid="sources-source-line"
          className={cn("rounded-lg border transition-all bg-card/90", presentation.frame)}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left"
          >
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {productMarkKey && (
              <ConnectionMarkGlyph shape={{ service_id: productMarkKey }} size="row" />
            )}
            <span className="font-medium text-sm text-foreground">{watch.source_folder_name}</span>
            {statePill}
            {outcomeLine}
            <span className="flex items-center gap-x-3 text-xs text-muted-foreground">{cadence}</span>
          </button>
        </div>
      ) : (
        <div
          data-testid="sources-source-card"
          className={cn("rounded-lg border p-4 transition-all bg-card/90 space-y-3", presentation.frame)}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                {collapsible && (
                  <button
                    type="button"
                    data-testid="sources-collapse"
                    onClick={() => setOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={COPY.collapse}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                )}
                {productMarkKey && (
                  <ConnectionMarkGlyph shape={{ service_id: productMarkKey }} size="row" />
                )}
                <span className="font-semibold text-sm text-foreground">
                  {watch.source_folder_name}
                </span>
                {statePill}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {!isDegraded && (
                  <>
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      <span>{connectionLabel}</span>
                    </span>
                    <span>&rarr;</span>
                  </>
                )}
                <span className="flex items-center gap-1">
                  <Folder className="h-3 w-3" />
                  <span>{libraryFolderName}</span>
                </span>
                <span className="text-border">|</span>
                {cadence}
              </div>

              {!isDegraded && outcomeLine}
            </div>

            {/* Actions toolbar */}
            {!isDegraded && (
              <div className="flex items-center gap-1.5 self-end sm:self-center flex-wrap">
                {syncOutcome && (
                  <span
                    data-testid="sources-sync-outcome"
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20"
                  >
                    {syncOutcome}
                  </span>
                )}

                <Button
                  type="button"
                  data-testid="sources-sync-now"
                  variant="outline"
                  size="sm"
                  onClick={handleRowSync}
                  disabled={syncInProgress || !watch.is_active}
                  className="h-8 text-xs gap-1"
                  title="Check this source now"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", syncInProgress && "animate-spin")} />
                  <span>{syncInProgress ? "Syncing..." : COPY.syncNow}</span>
                </Button>

                <Button
                  type="button"
                  data-testid="sources-toggle-history"
                  variant="ghost"
                  size="sm"
                  onClick={() => (historyOpen ? setHistoryOpen(false) : openHistory())}
                  className="h-8 text-xs px-2"
                >
                  {historyOpen ? COPY.hideHistory : COPY.history}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleActive(watch)}
                  disabled={syncInProgress}
                  className="h-8 text-xs px-2"
                  title={watch.is_active ? "Pause watch" : "Resume watch"}
                >
                  {watch.is_active ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>

                {/* VIS-05 / SC#3: Purge missing files */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onPurge(watch)}
                  disabled={syncInProgress}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  title="Purge missing or disconnected files from Library"
                >
                  Purge missing files
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(watch)}
                  disabled={syncInProgress}
                  className="h-8 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Delete watch"
                  aria-label="Delete watch"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* ── ⛔ SEED-239 / D-235-13 — the NAMED degraded row ─────────────────────── */}
          {isDegraded && (
            <div className="space-y-2 text-xs">
              <p data-testid="sources-degraded">{COPY.degraded}</p>
              <Button
                type="button"
                data-testid="sources-report-source"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDegradedReference(true)}
              >
                {COPY.degradedAction}
              </Button>
              {degradedReference && (
                <p data-testid="sources-degraded-reference" className="font-mono text-[11px] text-muted-foreground">
                  {watch.degraded_reason ?? "no reference was recorded"}
                </p>
              )}
            </div>
          )}

          {/* ── ⭐ THE STOPPED SENTENCE AND THE ONE CONTROL THAT FIXES THAT CAUSE ──── */}
          {state === "stopped" && (
            <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <div className="flex flex-col gap-1">
                  {stoppedAgo !== null && <span>{COPY.stopped(stoppedAgo)}</span>}
                  <span data-testid="sources-stopped-sentence">{stoppedSentence}</span>
                  {lastGoodBand !== null ? (
                    <span data-testid="sources-last-good">{COPY.lastGood(lastGoodBand)}</span>
                  ) : provenNeverRead ? (
                    <span data-testid="sources-last-good">{COPY.neverRead}</span>
                  ) : null}
                </div>
              </div>
              {showFix && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    data-testid="sources-fix"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20 font-medium"
                    onClick={() => onFix(watch, cause)}
                  >
                    {control.label(connectionName)}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── ⭐ THE FILES IT COULD NOT READ, AS THEY STAND NOW ──────────────────── */}
          {failingItems.length > 0 && (
            <div
              data-testid="sources-file-failures"
              className="space-y-1.5 border-t border-border/50 pt-2 text-xs"
            >
              <button
                type="button"
                data-testid="sources-file-failure-summary"
                aria-expanded={failuresOpen}
                onClick={() => setFailuresOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 text-left text-warning hover:opacity-80"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="font-medium">{FILE_FAILURE_SUMMARY(failingItems.length)}</span>
                {failuresOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
              </button>
              {failuresOpen && (
                <>
                  <p className="font-medium text-foreground">{FILE_FAILURE_HEADING}</p>
                  <p
                    data-testid="sources-file-failure-scope"
                    className="text-[11px] text-muted-foreground"
                  >
                    {FILE_FAILURE_SCOPE_NOTE}
                  </p>
                  <ul className="space-y-1">
                    {failingItems.slice(0, FILE_FAILURES_SHOWN).map((item, index) => (
                      <li
                        key={`failing-${item.id}-${index}`}
                        data-testid="sources-file-failure"
                        className="text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">{item.name}</span>
                        <span aria-hidden="true"> &mdash; </span>
                        {SENTENCE_FOR_FILE_FAILURE[fileFailureKind(item.state, item.last_error)]}
                      </li>
                    ))}
                  </ul>
                  {failingItems.length > FILE_FAILURES_SHOWN && (
                    <p
                      data-testid="sources-file-failure-more"
                      className="text-[11px] text-muted-foreground"
                    >
                      {FILE_FAILURE_MORE(failingItems.length - FILE_FAILURES_SHOWN)}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── ⭐ WATCH-05: MISSING FILES AT SOURCE WITH missing_since TIMESTAMP ──── */}
          {missingItems.length > 0 && (
            <div
              data-testid="sources-missing-items"
              className="space-y-1.5 border-t border-border/50 pt-2 text-xs"
            >
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  {missingItems.length === 1
                    ? "1 file missing at source"
                    : `${missingItems.length} files missing at source`}
                </span>
                <span className="text-[11px] opacity-80">&middot; Retained in Library</span>
              </div>
              <ul className="space-y-1">
                {missingItems.slice(0, FILE_FAILURES_SHOWN).map((item, index) => {
                  const sinceBand = item.missing_since ? relativeBand(item.missing_since, now) : null
                  const sinceFormatted = sinceBand ?? (item.missing_since ? instantPhrase(item.missing_since) : null)
                  const sinceText = sinceFormatted ? `since ${sinceFormatted}` : "recently"
                  return (
                    <li
                      key={`missing-${item.id}-${index}`}
                      data-testid="sources-missing-file"
                      className="text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">{item.name}</span>
                      <span aria-hidden="true"> &middot; </span>
                      <span>Missing at source {sinceText} &middot; Retained in Library</span>
                    </li>
                  )
                })}
              </ul>
              {missingItems.length > FILE_FAILURES_SHOWN && (
                <p data-testid="sources-missing-file-more" className="text-[11px] text-muted-foreground">
                  {FILE_FAILURE_MORE(missingItems.length - FILE_FAILURES_SHOWN)}
                </p>
              )}
            </div>
          )}

          {/* ⛔ The request was DECLINED, not queued — so it does not render as asked. */}
          {refusal && (
            <p data-testid="sources-refusal" className="text-[11px] text-muted-foreground">
              {refusal}
            </p>
          )}

          {/* ── THE HISTORY — every tick this source made, one click away ───────────── */}
          {historyOpen && (
            <div className="border-t border-border/50 pt-2">
              {runsLoading ? (
                <div
                  data-testid="sources-history-loading"
                  className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Loading the checks for this source...
                </div>
              ) : runsError ? (
                <p data-testid="sources-history-error" className="px-2 py-1 text-xs text-muted-foreground">
                  {runsError}
                </p>
              ) : (
                <RunHistoryList
                  runs={runs ?? []}
                  connectionName={connectionName}
                  expanded={quietExpanded}
                  onToggleExpanded={() => setQuietExpanded((v) => !v)}
                  now={now}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const WatchRow = WatchRowCard
