/**
 * Phase 235 plan 10 (SURF-02 / LIB-10 · D-235-11 / D-235-12 / D-235-13 / D-235-14 / D-235-16) —
 * WHAT A WATCHED SOURCE SAYS IT DID.
 * Phase 247 — Extracted WatchRowCard.tsx to satisfy G-5 (< 1,000 lines).
 * Non-collapsing sync now (WATCH-04) and Variant A Two-Tier Status Badges (WATCH-03).
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
  Folder,
  HardDrive,
  Loader2,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  deleteWatch,
  listWatches,
  purgeWatchFiles,
  triggerWatchSync,
  updateWatch,
  type ConnectorWatch,
  type StoppedSource,
} from "@/lib/api/sources"
import { useFolders } from "@/hooks/useFolders"
import { CreateWatchModal } from "./CreateWatchModal"
import {
  CONTROL_FOR_CAUSE,
  COPY,
  type SourceFailureCause,
} from "./sourceHealthVocabulary"
import { cn } from "@/lib/utils"
import {
  WatchRowCard as WatchRow,
  type SourceState,
  type WatchSyncOutcome,
} from "./WatchRowCard"

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

  // ⚠ WATCH-04: Non-collapsing sync now and background polling.
  // `loading = true` is set ONLY on initial load. Subsequent refreshes update state in-place.
  const loadWatches = async (initial = false) => {
    try {
      if (initial) setLoading(true)
      const data = await listWatches()
      setWatches(data)
      setError(null)
    } catch (err: any) {
      setError(err?.message || "Failed to load watched folders.")
    } finally {
      if (initial) setLoading(false)
    }
  }

  useEffect(() => {
    loadWatches(true)
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
      loadWatches(false)
    }, PENDING_REFRESH_MS)
    return () => clearInterval(id)
  }, [pendingAsks])

  /**
   * ⭐ D-15 / SC#4 — IT NOW RETURNS WHAT IT ALREADY KNEW.
   *
   * ⚠ Every state write below is UNCHANGED, deliberately. D-04 measured that this function was
   * already correct — it branches on `res.status === "refused"`, records the refusal or the
   * queued sentence, and try/catches into `setError`. **Its only fault was that the card never
   * heard the verdict**, so the card invented `✓ Synced just now (0 changes)` beside it.
   * This is an addition to the RETURN TYPE, not a rewrite of the behaviour.
   */
  const handleSyncNow = async (watch: ConnectorWatch): Promise<WatchSyncOutcome> => {
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
        await loadWatches(false)
        // ⛔ The server's OWN words, never reworded here.
        return { kind: "refused", says: res.message }
      }
      setRefusals((prev) => {
        const next = { ...prev }
        delete next[watch.id]
        return next
      })
      // ⚠ The queued sentence is built ONCE and used twice — the pending state and the card's
      //   outcome slot read the same expression, so they cannot disagree. ⛔ Do not re-author
      //   this sentence in the card.
      const says = COPY.asked(withinPhrase(res.next_check_within_seconds))
      setPendingAsks((prev) => ({ ...prev, [watch.id]: { at: Date.now(), says } }))
      await loadWatches(false)
      return { kind: "queued", says }
    } catch (err: any) {
      const says = err?.message || "Failed to trigger sync."
      setError(says)
      return { kind: "failed", says }
    } finally {
      setActionInProgress(null)
    }
  }

  const handleToggleActive = async (watch: ConnectorWatch) => {
    setActionInProgress(watch.id)
    try {
      await updateWatch(watch.id, { is_active: !watch.is_active })
      await loadWatches(false)
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
      await loadWatches(false)
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
      await loadWatches(false)
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
          loadWatches(false)
          setFeedbackMessage("Watched folder successfully added.")
        }}
        defaultDestinationFolderId={destinationFolderId}
      />
    </div>
  )
}
