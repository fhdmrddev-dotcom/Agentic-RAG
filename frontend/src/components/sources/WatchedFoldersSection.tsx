/**
 * Phase 235 plan 10 (SURF-02 / LIB-10 · D-235-11 / D-235-12 / D-235-13 / D-235-14 / D-235-16) —
 * WHAT A WATCHED SOURCE SAYS IT DID.
 *
 * ── ⭐ VARIANT B SHIPS (operator, 2026-09-06) ────────────────────────────────────────
 *
 * A HEALTHY source is ONE LINE and opens on click — 50% less visible text at rest, which is
 * the whole question the sketch asked. ⛔ A source that has STOPPED, is PAUSED, or could not
 * be read here is a full card and is NEVER collapsed: hiding the one row that needs a person
 * behind a disclosure is the silence `LIB-10` forbids.
 *
 * ── WHAT THIS FILE REPLACED, AND WHY EACH ONE WAS A DEFECT ───────────────────────────
 *
 *  1. `Last check error: {watch.last_error}` rendered a `str(exc)` column VERBATIM
 *     (`watch_service.py:196`) — a provider dict, a URL carrying a token fragment and an
 *     exception class, shown to a person whose only question was *"why did my folder stop?"*
 *     (T-235-12 / T-235-33). The raw column now reaches ONE place: `sourceFailureSentence`,
 *     whose pass-through requires POSITIVE PROOF OF PLAINNESS before anything survives it.
 *  2. `isDisconnected` decided the whole banner by SUBSTRING-SNIFFING that same string. The
 *     verdict is the SERVER's now (D-235-05), with the vocabulary leaf's classifier as the
 *     fallback for a row whose `last_error` predates the classifier.
 *  3. The Sync feedback announced that a check had been PUT ON A TIMETABLE — it described the
 *     REQUEST, not the outcome (`BUG-260906-02`). That word is gone from this file entirely;
 *     `/sources/watches/{id}/sync` answers `asked` or `refused`, and this file renders
 *     whichever it was. ⛔ An optimistic present-tense progress claim is forbidden too — it is
 *     a politer version of the same overclaim.
 *  4. The Reconnect control fell back to assigning a settings path onto the browser's own
 *     location object, and that was the LIVE path, because `IngestionTab` mounts this
 *     component with no `onNavigateToConnections`. This app has NO ROUTER (`SEED-185`), so it
 *     was a full page reload onto a path that renders the chat home (T-235-36). It is deleted.
 *     When no navigator is supplied the Reconnect control is ABSENT rather than dead.
 *
 *  5. The status pill was TWO parallel five-arm ternaries over the same conditions — a sixth
 *     state needed two edits and could disagree with itself. It is ONE lookup now.
 *
 * ⚠ The three forbidden literals behind (3) and (4) are deliberately NOT spelled anywhere in
 *   this file, comment included — the fences that enforce them read this source as TEXT, and a
 *   literal inside a docblock is still a literal (Pitfall 8, which plan 04 lost time to twice
 *   and which was driven RED here, deliberately, before this paragraph was believed).
 *
 * ── ⛔ THE COLOUR RULE (BUILD-CONTRACT §4 / sketch 233 §9) ───────────────────────────
 *
 * A SOURCE STATE gets the WARNING token and never the alarm one. A folder that stopped
 * syncing is not an emergency, and spending the alarm colour on it leaves nothing for one.
 * The shipped code applied the alarm token to the FAILED status arm of the status pill, and
 * the composition fence caught it on its first run. The state now reads as glyph + label +
 * colour, never colour alone. (A Delete button carrying that token is a different thing — an
 * irreversible ACTION rather than a state — and stays legal.)
 *
 * ⚠ The comparison expression the fence greps for is deliberately NOT spelled anywhere in
 *   this file, comment included: the fence reads this source as TEXT and a literal inside a
 *   docblock is still a literal (Pitfall 8 — driven RED here once before it was believed).
 *
 * ── ⛔ THE PINNED SURF-01 SENTENCE ──────────────────────────────────────────────────
 *
 * `checked every {N} minutes` is a Phase 234 invariant. It renders byte-identically below,
 * with its own comment intact. Do not reword it. ⚠ The two SURF-01 words that would claim a
 * push subscription remain forbidden anywhere in this file, comment included — there is no
 * webhook, so nothing here may imply one.
 *
 * ── ⚠ WHERE THE VERDICT COMES FROM, AND WHY IT IS A PROP ────────────────────────────
 *
 * `readerRunning` and `stoppedSources` are PASSED IN, not polled here. `useSourceAttention`
 * is mounted ONCE by `IngestionTab` and threaded down, so twelve cards cost one poller rather
 * than twelve (T-235-13). This component derives NO verdict of its own (D-235-05).
 */

import { useEffect, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Folder,
  HardDrive,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  deleteWatch,
  listSyncRuns,
  listWatches,
  purgeWatchFiles,
  triggerWatchSync,
  updateWatch,
  type ConnectorWatch,
  type StoppedSource,
  type SyncRun,
} from "@/lib/api/sources"
import { useFolders } from "@/hooks/useFolders"
import { relativeBand } from "@/components/workflows/library/relativeChanged"
import { CreateWatchModal } from "./CreateWatchModal"
import { RunHistoryList } from "./RunHistoryList"
import { isQuiet } from "./runHistoryFold"
import {
  CONTROL_FOR_CAUSE,
  COPY,
  SENTENCE_FOR_CAUSE,
  classifySourceFailure,
  sourceFailureSentence,
  type SourceFailureCause,
} from "./sourceHealthVocabulary"
import { cn } from "@/lib/utils"

/**
 * ⭐ D-235-12 — THE INSTANCE-LEVEL TRUTH, SAID ONCE.
 *
 * Exported from here and mounted by `IngestionTab` ABOVE its sub-tabs, so it is stated once
 * for the whole instance and cannot be mistaken for a claim about one source. Marking every
 * watch stopped when the reader is off was REJECTED: the rail badge would then count N broken
 * sources when nothing is wrong with any of them.
 *
 * ⚠ Two audiences, two sentences, ONE condition. `COPY.readerOffMember` names no mechanism;
 * the operator half is a SEPARATELY MARKED element and is the vocabulary leaf's one deliberate
 * exception to its no-mechanism rule. The env-var literal lives in that leaf, never here.
 *
 * It renders NOTHING when the reader is running, so a person on a healthy instance sees
 * exactly the surface they saw before.
 */
export function SourceReaderStatement({ readerRunning }: { readerRunning: boolean }) {
  if (readerRunning) return null
  return (
    <div
      data-testid="sources-instance-statement"
      className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <span>{COPY.readerOffMember}</span>
        <span data-testid="sources-instance-statement-operator" className="text-[11px] opacity-80">
          {COPY.readerOffOperator}
        </span>
      </div>
    </div>
  )
}

/**
 * The five states a watched source can be in, from this surface's point of view.
 *
 *   • `healthy`  — reading, and the reader is live. THE ONLY collapsible state.
 *   • `waiting`  — nothing is wrong with it; the instance's reader is switched off (D-235-12).
 *                  Collapsible too: it is not broken, and the banner above owns that truth.
 *   • `paused`   — a person paused it. Not reading, so not the one-line case.
 *   • `stopped`  — the SERVER says it stopped reading, or the row's own status says it failed.
 *   • `degraded` — this row could not be read HERE (SEED-239 / D-235-13). Never skipped.
 */
type SourceState = "healthy" | "waiting" | "paused" | "stopped" | "degraded"

/**
 * ⭐ ONE lookup, replacing the two parallel five-arm ternaries. A sixth state adds a row here
 * and edits nothing else — which is the same shape `CONTROL_FOR_CAUSE` uses one file over.
 *
 * ⛔ Every non-healthy tone is AMBER (the warning token). No source state is ever styled with
 * the alarm token; see the docblock.
 */
const STATE_PRESENTATION: Record<
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

/** Only these two states collapse to a line. Everything else is a full card, always. */
const COLLAPSIBLE_STATES: readonly SourceState[] = ["healthy", "waiting"]

/**
 * ⚠ The ONE place the shipped `last_status` set is read as a failure. Kept as a tiny helper so
 * the expression appears once and cannot drift between two branches.
 *
 * ⚠ The MEASURED production set is `{running, success, failed, paused}` (RESEARCH C-6). The
 * strings `completed` and `disconnected` are never written by the server.
 */
function isFailedStatus(status: string | null | undefined): boolean {
  return status === "failed"
}

/**
 * The state a row is in. ⛔ It derives no verdict of its own: the server's `stopped[]` is
 * consulted FIRST and passed through untouched (D-235-05). The row's own `failed` status is a
 * fallback only, for the window before the health probe has answered.
 */
function classifyWatch(
  watch: ConnectorWatch,
  stoppedById: Map<string, StoppedSource>,
  readerRunning: boolean,
): SourceState {
  // ⛔ D-235-13 — a row the server could not project is NAMED, never skipped and never an
  //    error page. A source that vanishes from its own list is the silence LIB-10 forbids.
  if (watch.degraded) return "degraded"
  if (stoppedById.has(watch.id)) return "stopped"
  if (!watch.is_active) return "paused"
  if (isFailedStatus(watch.last_status)) return "stopped"
  if (!readerRunning) return "waiting"
  return "healthy"
}

/**
 * How many files a tick acted on — all six counts, the errored ones included. A file the
 * reader tried and could not read is still a file this check dealt with.
 *
 * ⚠ Spelled here as well as in `RunHistoryList` because that module does not export it and is
 * not this plan's to edit. Whichever plan next touches both should hoist it into the fold leaf.
 */
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

/**
 * The pending window, in words. ⚠ It says what was ASKED and when the next pass is due —
 * never that work is happening, because nothing has happened yet.
 */
function withinPhrase(seconds: number | null | undefined): string {
  const n =
    typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
      ? Math.round(seconds)
      : null
  if (n === null) return "the next pass"
  if (n < 120) return `${n} seconds`
  return `${Math.round(n / 60)} minutes`
}

/**
 * ⭐ D-235-14 — THE OUTCOME, not the request.
 *
 * When the history has been fetched the newest stored tick is the truth: quiet ⇒ *"no
 * changes"*, otherwise the count of files that tick acted on. Before the history is fetched
 * (twelve cards must not fire twelve requests to render a list) the watch row's own
 * `item_count` stands in — the number of files this source carries.
 *
 * ⚠ `null` means the wire gave no readable instant. The caller renders `COPY.neverRead`
 * rather than inventing a time, which is `relativeBand`'s own recorded rule.
 */
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

export interface WatchedFoldersSectionProps {
  onNavigateToConnections?: () => void
  destinationFolderId?: string | null
  /**
   * The LIVE reader verdict, resolved once by the parent. Defaults to `true` so a mount that
   * cannot know does not accuse every source of waiting.
   */
  readerRunning?: boolean
  /** The server's stopped verdict, passed through untouched (D-235-05). */
  stoppedSources?: StoppedSource[]
  className?: string
}

/** How often the list re-asks while a Sync ask is outstanding, waiting for the tick to land. */
const PENDING_REFRESH_MS = 15_000

export function WatchedFoldersSection({
  onNavigateToConnections,
  destinationFolderId = null,
  readerRunning = true,
  stoppedSources,
  className,
}: WatchedFoldersSectionProps) {
  const { folders } = useFolders()
  const [watches, setWatches] = useState<ConnectorWatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  /** watch id → the instant Sync now was asked. Cleared when that watch's tick lands. */
  const [pendingAsks, setPendingAsks] = useState<Record<string, { at: number; says: string }>>({})
  /** watch id → the server's refusal sentence. The request was DECLINED, not queued. */
  const [refusals, setRefusals] = useState<Record<string, string>>({})

  const stoppedById = new Map((stoppedSources ?? []).map((s) => [s.watch_id, s]))

  const loadWatches = async () => {
    try {
      setLoading(true)
      const data = await listWatches()
      setWatches(data)
      setError(null)
    } catch (err: any) {
      setError(err?.message || "Failed to load watched folders.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWatches()
  }, [])

  // ── The pending ask clears when the SOURCE says so, never on a timer ───────────────
  // ⚠ D-235-16 — `asked` is replaced by the real outcome only once `last_run_at` has advanced
  //   PAST the click. A pending state that expired on its own would be a second overclaim.
  useEffect(() => {
    const ids = Object.keys(pendingAsks)
    if (ids.length === 0) return
    const landed = ids.filter((id) => {
      const watch = watches.find((w) => w.id === id)
      const t = Date.parse(watch?.last_run_at ?? "")
      return Number.isFinite(t) && t > pendingAsks[id].at
    })
    if (landed.length === 0) return
    setPendingAsks((prev) => {
      const next = { ...prev }
      for (const id of landed) delete next[id]
      return next
    })
  }, [watches, pendingAsks])

  // While an ask is outstanding the list re-asks the server, because the tick that answers it
  // happens elsewhere. The interval exists only while something is pending.
  useEffect(() => {
    if (Object.keys(pendingAsks).length === 0) return
    const id = setInterval(() => {
      loadWatches()
    }, PENDING_REFRESH_MS)
    return () => clearInterval(id)
  }, [pendingAsks])

  const handleSyncNow = async (watch: ConnectorWatch) => {
    setActionInProgress(watch.id)
    try {
      const res = await triggerWatchSync(watch.id)
      if (res.status === "refused") {
        // ⛔ The reader is off. Nothing was queued, so nothing may claim it was.
        setRefusals((prev) => ({ ...prev, [watch.id]: res.message }))
        setPendingAsks((prev) => {
          const next = { ...prev }
          delete next[watch.id]
          return next
        })
      } else {
        setRefusals((prev) => {
          const next = { ...prev }
          delete next[watch.id]
          return next
        })
        setPendingAsks((prev) => ({
          ...prev,
          [watch.id]: {
            at: Date.now(),
            says: COPY.asked(withinPhrase(res.next_check_within_seconds)),
          },
        }))
      }
      await loadWatches()
    } catch (err: any) {
      setError(err?.message || "Failed to trigger sync.")
    } finally {
      setActionInProgress(null)
    }
  }

  const handleToggleActive = async (watch: ConnectorWatch) => {
    setActionInProgress(watch.id)
    try {
      await updateWatch(watch.id, { is_active: !watch.is_active })
      await loadWatches()
    } catch (err: any) {
      setError(err?.message || "Failed to update watch status.")
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDelete = async (watch: ConnectorWatch) => {
    if (!window.confirm(`Stop watching "${watch.source_folder_name}"? Files in your Library will be retained.`)) {
      return
    }
    setActionInProgress(watch.id)
    try {
      await deleteWatch(watch.id)
      await loadWatches()
    } catch (err: any) {
      setError(err?.message || "Failed to delete watch.")
    } finally {
      setActionInProgress(null)
    }
  }

  const handlePurge = async (watch: ConnectorWatch) => {
    if (
      !window.confirm(
        `Purge missing files for "${watch.source_folder_name}"? Files that no longer exist at the external source will be permanently removed from your Library.`,
      )
    ) {
      return
    }
    setActionInProgress(watch.id)
    try {
      const res = await purgeWatchFiles(watch.id)
      setFeedbackMessage(res.message || `Purged missing files for ${watch.source_folder_name}.`)
      await loadWatches()
    } catch (err: any) {
      setError(err?.message || "Failed to purge missing files.")
    } finally {
      setActionInProgress(null)
    }
  }

  const getLibraryFolderName = (folderId?: string | null) => {
    if (!folderId) return "Root"
    const f = folders.find((item) => item.id === folderId)
    return f ? f.name : "Root"
  }

  /**
   * ⭐ D-235-11 — the cause resolves to ONE control, by TABLE LOOKUP. There is deliberately no
   * per-cause branch here: a new cause adds a row to `CONTROL_FOR_CAUSE` and edits nothing.
   *
   * ⛔ "Always Reconnect" was rejected — an OAuth dance cannot fix an unshared folder.
   * ⛔ "Always Retry" was rejected — SC#2's word is *fixes*, and Retry does not fix a revoked
   *    token.
   */
  const runFix = (watch: ConnectorWatch, cause: SourceFailureCause) => {
    const { action } = CONTROL_FOR_CAUSE[cause]
    if (action === "reconnect") {
      onNavigateToConnections?.()
      return
    }
    if (action === "repick_folder") {
      setModalOpen(true)
      return
    }
    handleSyncNow(watch)
  }

  return (
    <div className={cn("space-y-4 rounded-xl border border-border/70 bg-card/60 p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
            <HardDrive className="h-4 w-4 text-primary" />
            Watched Folders
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            External cloud folders that periodically sync documents into your Library.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setModalOpen(true)}
          className="gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Add Watched Folder</span>
        </Button>
      </div>

      {feedbackMessage && (
        <div className="p-2.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-xs hover:underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading watched folders...
        </div>
      ) : watches.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border/60 bg-muted/10">
          <Folder className="h-8 w-8 text-muted-foreground mb-2 stroke-[1.5]" />
          <p className="text-sm font-medium text-foreground">No watched folders configured</p>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            Connect a Google Drive folder to automatically ingest files into your Library on a regular schedule.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="mt-4 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Watch a Folder
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {watches.map((watch) => (
            <WatchRow
              key={watch.id}
              watch={watch}
              state={classifyWatch(watch, stoppedById, readerRunning)}
              stopped={stoppedById.get(watch.id)}
              libraryFolderName={getLibraryFolderName(watch.library_folder_id)}
              busy={actionInProgress === watch.id}
              pendingSays={pendingAsks[watch.id]?.says ?? null}
              refusal={refusals[watch.id] ?? null}
              canReconnect={Boolean(onNavigateToConnections)}
              onFix={runFix}
              onSyncNow={handleSyncNow}
              onToggleActive={handleToggleActive}
              onPurge={handlePurge}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <CreateWatchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          loadWatches()
          setFeedbackMessage("Watched folder successfully added.")
        }}
        defaultDestinationFolderId={destinationFolderId}
      />
    </div>
  )
}

interface WatchRowProps {
  watch: ConnectorWatch
  state: SourceState
  stopped?: StoppedSource
  libraryFolderName: string
  busy: boolean
  pendingSays: string | null
  refusal: string | null
  canReconnect: boolean
  onFix: (watch: ConnectorWatch, cause: SourceFailureCause) => void
  onSyncNow: (watch: ConnectorWatch) => void
  onToggleActive: (watch: ConnectorWatch) => void
  onPurge: (watch: ConnectorWatch) => void
  onDelete: (watch: ConnectorWatch) => void
}

/**
 * ONE source. A line when it is healthy and closed; a card when it is open, paused, stopped or
 * unreadable. ⚠ The outer wrapper carries `watch-card-{id}` as BOTH an `id` and a `data-testid`
 * on one line: plan 08's `handleGoToSource` scrolls with `getElementById`, which cannot address
 * a `data-testid`, and the shipped hook is what Phase 234's suites already assert.
 */
function WatchRow({
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

  const collapsible = COLLAPSIBLE_STATES.includes(state)
  const asCard = !collapsible || open
  const presentation = STATE_PRESENTATION[state]
  const isDegraded = state === "degraded"

  // ⚠ A degraded row's `connection_name`, `item_count`, `last_run_at` and `last_status` are
  //   MODEL DEFAULTS, not measurements (plan 07). Nothing below renders one of them as fact.
  const connectionName = watch.connection_name ?? ""
  const connectionLabel = connectionName.trim() || "the connection"
  // ⛔ T-235-12 / T-235-33 — the raw column reaches the vocabulary leaf and NOTHING ELSE. Both
  //   calls below are that leaf's own entry points: one answers WHICH CAUSE (so the table can
  //   pick the one control), the other answers WHAT TO SAY and refuses to pass a provider
  //   string through without positive proof of plainness. Neither result is the raw string.
  const cause: SourceFailureCause = stopped?.cause ?? classifySourceFailure(watch.last_error)
  const control = CONTROL_FOR_CAUSE[cause]
  // ⚠ When the SERVER named the cause its sentence is the table's, verbatim. When it did not,
  //   `sourceFailureSentence` resolves the same table for a recognised message and falls back
  //   HONESTLY for one it does not recognise — never a guess.
  const stoppedSentence = stopped?.cause
    ? SENTENCE_FOR_CAUSE[stopped.cause](connectionName)
    : sourceFailureSentence(watch.last_error, connectionName)
  const showFix = control.action !== "reconnect" || canReconnect

  const now = Date.now()
  const outcome = isDegraded ? null : outcomeSentence(watch, runs, now)
  const stoppedAgo = relativeBand(stopped?.stopped_since ?? watch.last_run_at, now)
  // ⚠ `/sources/health` reads `last_good_at` over a FIVE-ROW window (plan 06), so a null there
  //   does NOT mean "never succeeded". `neverRead` is claimed ONLY once the unbounded run list
  //   has been fetched and holds no success — otherwise this renders nothing at all.
  const lastGoodBand = relativeBand(stopped?.last_good_at, now)
  const provenNeverRead = runs !== null && !runs.some((r) => r.status === "success")

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

  const statePill = (
    <span
      data-testid="sources-state"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full uppercase tracking-wider",
        presentation.pill,
      )}
    >
      {/* The state reads as glyph + label + colour, never colour alone. */}
      <span aria-hidden="true">{state === "healthy" ? "●" : "○"}</span>
      {presentation.label}
    </span>
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

  return (
    <div key={watch.id} id={`watch-card-${watch.id}`} data-testid={`watch-card-${watch.id}`}>
      {!asCard ? (
        // ── ⭐ VARIANT B — a healthy source is ONE LINE, and it opens on click ────────
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
              <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <Button
                  type="button"
                  data-testid="sources-sync-now"
                  variant="outline"
                  size="sm"
                  onClick={() => onSyncNow(watch)}
                  disabled={busy || !watch.is_active}
                  className="h-8 text-xs gap-1"
                  title="Check this source now"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
                  <span>{COPY.syncNow}</span>
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
                  disabled={busy}
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
                  disabled={busy}
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
                  disabled={busy}
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
              {/* ⚠ There is no report ENDPOINT, and inventing one would be a control that goes
                  nowhere. What this reveals is the server's own machine-safe reference token
                  (`projection_failed:<ExceptionClass>` — plan 07 proves it carries no frame, no
                  exception text and no table name), so a person can quote it verbatim. */}
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

          {/* ⛔ The request was DECLINED, not queued — so it does not render as `asked`. */}
          {refusal && (
            <p data-testid="sources-refusal" className="text-[11px] text-muted-foreground">
              {refusal}
            </p>
          )}

          {/* ── THE HISTORY — every tick this source made, one click away ───────────── */}
          {historyOpen && (
            <div className="border-t border-border/50 pt-2">
              {runsLoading ? (
                // ⚠ SEED-248 — a surface that is still loading must SAY so. An empty list and
                //   "there is nothing" are indistinguishable, and they mean opposite things.
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
