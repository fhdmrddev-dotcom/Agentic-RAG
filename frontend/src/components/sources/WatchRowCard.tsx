/**
 * Phase 247 — WATCH-03 / WATCH-04 / WATCH-05 / WATCH-06 / WATCH-07
 * Extracted from WatchedFoldersSection.tsx to satisfy G-5 (< 1,000 lines).
 *
 * ── ⭐ VARIANT A (Ratified by Operator 2026-09-13) ──────────────────────────────────
 *
 * 1. Two-Tier Status Badge (WATCH-03):
 *    - Primary Pill: Connection Status (`● Connected` vs `⊙ Connection Off`)
 *    - Primary Pill: read from `CONNECTION_PILL_FOR_CAUSE` — ⚠ CORRECTED in Phase 252
 *      (W-1 / D-29): this line used to describe a two-value binary, and that binary rendered
 *      `● Connected` for a revoked token. The pill is a TABLE LOOKUP now, not two hardcoded
 *      pills behind one comparison.
 *    - Secondary Pill: Run Outcome (`● Reading` vs `⚠ Stopped`). ⚠ CORRECTED in Phase 252
 *      (W-2 / D-28): a rate-limit reading was listed here and is DELETED. No cause in the
 *      taxonomy means rate-limited, so the claim could never be justified from evidence — and
 *      the status number is not re-quoted here, because the acceptance greps count literals
 *      over this source and cannot tell code from a comment.
 * 2. Non-Collapsing Row-Level Sync (WATCH-04):
 *    - Row-level spinner and ONE inline outcome slot, rendering what the sync endpoint
 *      actually said. ⚠ CORRECTED in Phase 252 plan 03 (SC#4 / D-15..D-18) — this line used to
 *      quote a hardcoded success tag carrying a change count, and that literal WAS the defect:
 *      it claimed completion where the parent only QUEUES, printed a count no response carries,
 *      and could render beside the server's refusal. **Nothing replaces the count.**
 *    - ⚠ The literal is NOT re-quoted anywhere in this file, not even to record its removal:
 *      the plan's own acceptance greps and this file's `?raw` fences count occurrences over the
 *      source and cannot tell code from a comment. The verbatim strings live in
 *      `252-03-SUMMARY.md`, where no grep mistakes them for a live one.
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
  CONNECTION_PILL_FOR_CAUSE,
  CONTROL_FOR_CAUSE,
  COPY,
  type ConnectionPillTone,
  FILE_FAILURE_HEADING,
  FILE_FAILURE_MORE,
  FILE_FAILURE_SCOPE_NOTE,
  FILE_FAILURE_SUMMARY,
  SENTENCE_FOR_CAUSE,
  SENTENCE_FOR_FILE_FAILURE,
  UNKNOWN_SOURCE_FAILURE_SENTENCE,
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

/**
 * ⭐ W-1 (D-29) — the connection pill's TONE to its Tailwind classes.
 *
 * The WORDS live in `sourceHealthVocabulary` with every other sentence this surface says; only
 * the styling lives here, beside `STATE_PRESENTATION` which is the same split. ⛔ Keyed by
 * `ConnectionPillTone`, so a new tone cannot be added without a class — and a new CAUSE needs
 * no edit here at all, which is the point.
 */
export const CONNECTION_PILL_CLASS: Record<ConnectionPillTone, string> = {
  connected: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  attention: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
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

/**
 * ⭐ D-15 / SC#4 — WHAT ONE "Sync now" CLICK ACTUALLY PRODUCED.
 *
 * The card used to invent its outcome from a literal while the PARENT already held the real
 * verdict in its own `refusals` / `pendingAsks` state. This type is how the parent's truth
 * reaches the card, and it is the ONLY thing the card renders about a click.
 *
 * ⛔ THERE IS NO `changes` FIELD, AND THERE MUST NOT BE ONE. `WatchSyncResponse`
 * (`lib/api/sources.ts:117-126`) carries `status`, `message`, `next_run_at?`,
 * `next_check_within_seconds?` and `reader_running?` — **no change count**. Any number this
 * card printed would be invented, which is exactly what the deleted count literal was.
 */
export type WatchSyncOutcome =
  /** The ask was recorded. `says` is the parent's shipped `COPY.asked(withinPhrase(...))`. */
  | { kind: "queued"; says: string }
  /** The server DECLINED. `says` is its own `res.message` — never reworded here. */
  | { kind: "refused"; says: string }
  /** The call threw. `says` is the caught message. */
  | { kind: "failed"; says: string }

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
  /**
   * ⛔ The card never calls the sync endpoint itself. `WatchedFoldersSection` owns the
   * refusal/pending state, and a second caller would be a second writer of one slice.
   */
  onSyncNow: (watch: ConnectorWatch) => Promise<WatchSyncOutcome>
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
  const [syncOutcome, setSyncOutcome] = useState<WatchSyncOutcome | null>(null)

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
      // ⭐ D-15 — the card RENDERS the parent's verdict. It no longer authors one.
      setSyncOutcome(await onSyncNow(watch))
    } catch (err: any) {
      // ⚠ D-18, AND IT IS DELIBERATELY NOT THE FIX FOR TODAY'S CONTRADICTION — the parent's
      //   widened return is. D-04 measured that `WatchedFoldersSection.handleSyncNow`
      //   try/catches into `setError` and never rejects, so this arm cannot fire on the
      //   shipped parent. It exists because that swallow is precisely what made the card's
      //   optimism invisible: a FUTURE caller that does reject must not leave a stale reading
      //   standing.
      setSyncOutcome({ kind: "failed", says: err?.message || UNKNOWN_SOURCE_FAILURE_SENTENCE })
    } finally {
      setIsSyncing(false)
    }
  }

  /**
   * ⭐ D-16 — ONE OUTCOME SLOT, DERIVED FROM ONE VALUE.
   *
   * The card used to carry TWO independent renderers: `syncOutcome` in the toolbar and a
   * separate refusal-guarded block near the foot. One click could therefore put a refusal and
   * a success on the same card at once — B-4's headline, and the suite reproduced it verbatim.
   * **Two slots with a rule is how the pair drifted apart; one slot cannot.**
   *
   * ⚠ The `refusal` prop is still read: it survives a re-render and a list reload, so a refusal
   *   the parent recorded before this mount is still shown. It is a FALLBACK into the one slot,
   *   never a second slot.
   */
  const syncLine: WatchSyncOutcome | null =
    syncOutcome ?? (refusal ? { kind: "refused", says: refusal } : null)

  // ── Variant A Two-Tier Status Badge ────────────────────────────────────────────────
  /**
   * ⭐ W-1 (D-29) — THE PILL READS THE CAUSE, BY TABLE LOOKUP.
   *
   * This used to be a ONE-CAUSE BINARY — an equality test against the switched-off cause alone,
   * with a ternary picking one of two hardcoded pills — so it rendered `● Connected` for a
   * REVOKED token and for REJECTED app credentials, the two causes that mean the authorisation
   * is gone. ⛔ There is deliberately no ternary on the cause here: a new cause adds a ROW to
   * `CONNECTION_PILL_FOR_CAUSE`, never an `if` in this file.
   * ⚠ The deleted expression is described and NOT quoted — the plan's acceptance greps count
   *   literals over this source and cannot tell code from a comment. It is written out verbatim
   *   in `252-03-SUMMARY.md` instead, where nothing mistakes it for a live one.
   *
   * ⚠ It reads the RESOLVED `cause` (`:184`), not `stopped?.cause`, so a watch carrying only a
   *   `last_error` is read too — which is the case the binary could never see.
   */
  const pill = CONNECTION_PILL_FOR_CAUSE[cause]
  const connectionPill = (
    <span
      data-testid="sources-connection-pill"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border",
        CONNECTION_PILL_CLASS[pill.tone],
      )}
    >
      <span aria-hidden="true">{pill.glyph}</span> {pill.label}
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
      {/* ⭐ W-2 (D-28) — THE RATE-LIMIT CLAIM IS GONE, AND NOTHING REPLACES IT.
          The deleted guard was a CONJUNCTION OF TWO IDENTICAL TESTS: it compared the resolved
          cause to the catch-all transport cause, AND re-derived that same cause from the
          watch's stored error string and compared it to the same value. But the resolved cause
          ALREADY DEFAULTS to that second expression (see its declaration above), so when
          `stopped`
          was absent the two conjuncts were the same test and the guard collapsed to a single
          comparison against the CATCH-ALL. A provider 5xx, a DNS failure and a socket timeout
          therefore all rendered a rate-limit reading, sending an operator to the wrong remedy
          for an outage.
          ⛔ MEASURED, NOT ASSUMED — NO CAUSE IN THE TAXONOMY MEANS RATE-LIMITED. The backend
          status table maps the rate-limit status onto the same catch-all transport cause as
          408/500/502/503/504, and the client mirror holds the rate-limit tells in the SAME
          regex alternation as timeouts and 5xx. A rate-limited failure is therefore
          INDISTINGUISHABLE from an outage downstream of classification, so no vocabulary row
          could be keyed on it honestly. The pin lives in `sourceHealthVocabulary.test.ts`.
          ⛔ Do NOT invent a cause to bring the reading back: a label nothing can justify is
          worse than no label. If the classifier ever gains a genuine rate-limit cause, the
          reading returns as a ROW in `sourceHealthVocabulary`, never as a guard here.
          ⚠ The deleted expression and the status number are described rather than quoted —
            the plan's acceptance greps count literals over this source and cannot tell code
            from a comment. Both are verbatim in `252-03-SUMMARY.md`. */}
      {presentation.label}
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
                {/* ⭐ D-16 — THE ONE OUTCOME SLOT. Styled by `kind`; there is no second
                    renderer.
                    ⚠ `sources-refusal` is kept as the testid of the REFUSED reading because
                      `WatchedFoldersSection.history.test.tsx:329-330` scopes by it — measured
                      with `grep -rn "sources-refusal" frontend/src`, not assumed.
                    ⛔ `says` can be SERVER-CONTROLLED TEXT (`res.message`). It renders as a
                      React child and is therefore auto-escaped — never through a raw-HTML
                      injection prop (TM-252-15).
                    ⚠ That prop is NOT NAMED here on purpose: this file's own `?raw` fence
                      (`WatchedFoldersSection.test.tsx`) counts the literal over the source and
                      cannot tell code from a comment. Writing it, even to forbid it, reds the
                      guard — Pitfall 8, measured when this comment did exactly that. */}
                {syncLine && (
                  <span
                    data-testid={
                      syncLine.kind === "refused" ? "sources-refusal" : "sources-sync-outcome"
                    }
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded border",
                      syncLine.kind === "queued"
                        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        : "text-muted-foreground bg-muted/40 border-border/60",
                    )}
                  >
                    {syncLine.says}
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
