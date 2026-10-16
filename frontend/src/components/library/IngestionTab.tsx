/**
 * Phase 217.1 plan 03 (LIB-02 / D-217.1-05) — the Ingestion tab body, restructured.
 *
 * ⭐ SCREEN 008 WINS OVER SCREEN 006. The Ingestion tab body is restructured into a
 * nested Tabs with four sub-tabs: Add files · In progress · Needs attention · History.
 * The nested Tabs uses the shipped `Tabs` primitive — the exact nesting
 * `KnowledgeHealthPage.tsx` already does for its `By Document / By Query` sub-strip
 * inside the `Low Confidence` tab.
 *
 * ⭐ ADD FILES — the hero dropzone + folder picker. The Wave 1 dropzone is relocated
 * under `Add files` with `variant="hero"` (the sketch's `.dropbig` shape: cloud icon,
 * Drop files here, or, Choose files button, formats list). The `UploadFolderPicker` is
 * mounted beside it, wired to the same `folderId`/`folderName` state already threaded
 * from `LibraryPage`.
 *
 * ⭐ IN PROGRESS / NEEDS ATTENTION / HISTORY — the existing queue, Needs-attention
 * markup, and the six-stage aggregate stay mounted under their respective sub-tabs
 * unchanged. Plan 04 fills the History body.
 *
 * ⭐ THE SUB-TAB STATE IS LOCAL. `useState` inside `IngestionTab` — never in
 * `librarySelection`'s reducer. The action-set count stays at 6.
 *
 * ⛔ NO PROGRESS ARITHMETIC OF ANY KIND (D-217-19).
 * ⭐ 284-03 (FIX-11 / D-13 / R-04 / R-08): ITS NUMBERS ARE THE SUMMARY'S, ITS LISTS ARE SERVER PAGES.
 *    The cards, the counts and the rate-limit banner read `GET /library/summary` (handed down by
 *    the page, never re-fetched here). Queue, Needs attention and History each read ONE
 *    `GET /documents?status=…` page when their sub-tab is open (History by `updated_at`), paged
 *    with the shipped `PaginationControls`. Loading, failed and empty are three states: an empty
 *    sentence renders only after a successful answer (SEED-248). ⛔ No number here is a page length.
 * ⛔ NO SECOND STATUS VOCABULARY. Every stage word comes from `TERM_MAP`.
 */
import React, { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { IngestionStrip } from "@/components/ingestion/IngestionStrip"
import { DocumentUpload } from "@/components/ingestion/DocumentUpload"
import {
  type IngestionStageKey,
} from "@/components/ingestion/ingestionStages"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"
import { classifyIngestionError } from "@/components/library/ingestionErrorVocabulary"
import { formatBytes } from "@/lib/formatBytes"
import { listDocumentsPage, reingestDocument } from "@/lib/api"
import type { Document, DocumentListParams, LibrarySummary } from "@/types"
import type { LibraryLoadState } from "@/hooks/useLibraryDocuments"
import { UploadFolderPicker } from "@/components/library/ingestion/UploadFolderPicker"
import { ConnectedSourceSection } from "@/components/sources/ConnectedSourceSection"
import {
  SourceReaderStatement,
  WatchedFoldersSection,
} from "@/components/sources/WatchedFoldersSection"
import { useSourceAttention } from "@/hooks/useSourceAttention"
import { IngestionPauseBanner } from "@/components/ingestion/IngestionPauseBanner"
import { IngestionBatchLane } from "@/components/ingestion/IngestionBatchLane"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"
import { PaginationControls } from "@/components/health/PaginationControls"

/** BUG-260923-02 — rows per page. 284-03: Queue and Needs attention page the same way (S7). */
const LIST_PAGE_SIZE = 25
import {
  cardForStage,
  PIPELINE_CARDS,
  CARD_LABEL,
  type PipelineCardId,
} from "@/components/library/ingestion/pipelineGroups"

/** One pipeline card: how many in-flight documents are at this group of stages. */
function PipelineCard({
  cardId,
  count,
  unknown,
}: {
  cardId: PipelineCardId
  /** `null` until the summary has answered (284-03, D-12). */
  count: number | null
  /** What a `null` count reads: "…" while loading, "—" after a failure (UI-SPEC S7). */
  unknown: string
}) {
  const isPopulated = count !== null && count > 0
  return (
    <div
      data-stage-card={cardId}
      className={cn(
        "group relative flex min-w-0 flex-1 flex-col gap-1 rounded-xl border p-3 shadow-sm card-interactive overflow-hidden transition-all duration-200",
        isPopulated
          ? "border-primary/40 bg-gradient-to-b from-primary/10 to-card/50 shadow-primary/5"
          : "border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-sm",
      )}
    >
      {/* Subtle top accent line for active cards */}
      {isPopulated && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
      )}
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-xs font-medium text-foreground">
          {CARD_LABEL[cardId]}
        </span>
        {isPopulated && (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        )}
      </div>
      <span className={cn("font-mono text-lg font-bold tabular-nums", isPopulated ? "text-primary" : "text-foreground")}>
        {count === null ? unknown : <AnimatedNumber value={count.toLocaleString()} />}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {count === 1 ? "file here now" : "files here now"}
      </span>
    </div>
  )
}

// The six `DocumentUpload` props `LibraryPage` already computes for the Documents tab.
// Threaded unchanged so the Ingestion tab can start an upload without re-deriving them.
export interface IngestionTabProps {
  /** 284-03 (D-13): `GET /library/summary` — the cards, counts and banner. `null` until answered. */
  summary: LibrarySummary | null
  summaryState: LibraryLoadState
  /** "Try again" on the counts. */
  onRetrySummary?: () => void
  /** The Library's debounced change hint (D-08) — the open list refetches on it, silently. */
  changeTick?: number
  /** `useDocuments().upload` — the page-level upload handler. */
  upload: (file: File, folderId?: string | null) => Promise<{ isDuplicate: boolean }>
  /** True while one or more uploads are in flight. */
  uploading: boolean
  /** How many uploads are in flight (for the "Uploading N files…" label). */
  uploadingCount?: number
  /** The folder a new upload lands in, or null for Root. */
  folderId?: string | null
  /** The folder's display name, or null for Root. */
  folderName?: string | null
  /** True when the current user cannot upload to this folder (read-only / shared). */
  disabled?: boolean
  /**
   * Opens the Connections surface, for a stopped source whose ONE control is "Reconnect".
   *
   * ⛔ WITHOUT THIS PROP THE CONTROL DOES NOT RENDER AT ALL. `WatchedFoldersSection` gates on
   * `canReconnect={Boolean(onNavigateToConnections)}` and `showFix` is
   * `control.action !== "reconnect" || canReconnect` — so every reconnect-shaped cause
   * (`token_revoked`, `connection_disabled`) silently loses its button. Phase 235 shipped in
   * exactly that state: the cause→control map was correct DATA and no user could press it,
   * which is SC#2's "offers one control that fixes it" failing invisibly.
   *
   * The app has NO ROUTER (`SEED-185`), so this is a callback, never a URL.
   */
  onNavigateToConnections?: () => void
}

export function IngestionTab({
  summary,
  summaryState,
  onRetrySummary,
  changeTick = 0,
  upload,
  uploading,
  uploadingCount,
  folderId,
  folderName,
  disabled,
  onNavigateToConnections,
}: IngestionTabProps) {
  // ── LOCAL sub-tab state — never in librarySelection's reducer ─────────────────
  const [subTab, setSubTab] = useState<string>("add-files")

  // Local upload folder state for the folder picker.
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(folderId ?? null)
  const [uploadFolderName, setUploadFolderName] = useState<string>(folderName ?? "Root")

  // ── 284-03 (D-13 / R-04) — every number is the summary's; `null` until it has answered ──
  // In flight = pending + processing (`paused` is not a stored status, R-04).
  const inFlightCount = summary === null ? null : summary.status.pending + summary.status.processing

  // The ⌥ Technical-names reveal.
  const { showTechnical } = useTechnicalNamesOptional() ?? { showTechnical: false }

  // ⭐ Phase 235 (D-235-12) — THE ONE READER OF THE SERVER'S SOURCE VERDICT ON THIS TAB.
  //
  // Mounted here, ONCE, and threaded down. Twelve source cards each calling the hook would be
  // twelve pollers of the same endpoint (T-235-13); one call is the whole cost. Nothing is
  // derived from it here — `stopped` is the server's verdict, passed through untouched
  // (D-235-05), and `readerRunning` is the LIVE reader rather than the config flag (D-235-21).
  const { readerRunning, stopped } = useSourceAttention()

  return (
    <section data-testid="ingestion-tab" className="flex flex-col gap-6 overflow-y-auto">
      <div data-testid="sources-body-ingestion" className="flex flex-col gap-6">
        {/* ⭐ D-235-12 — THE INSTANCE-LEVEL TRUTH, STATED ONCE, ABOVE EVERY SUB-TAB.
            The same shape as the `ConnectedSourceSection` mount below: ONE import, ONE mount,
            ZERO branches. The component renders NOTHING when the reader is running, so a
            person on a healthy instance sees exactly the surface they saw before.
            ⛔ It does NOT belong on a row. The banner owns platform-wide truth; a row owns only
            what is true of that row. Marking every watch stopped when the server's reader is
            switched off was rejected — the rail badge would then count N broken sources when
            nothing is wrong with any of them. */}
        <SourceReaderStatement readerRunning={readerRunning} />
      {/* ── THE FOUR SUB-TABS ──────────────────────────────────────────────────── */}
      <Tabs value={subTab} onValueChange={setSubTab} data-testid="ingestion-subnav">
        {/* ⚠ `text-xs` on every child trigger. The `tabs.tsx` primitive defaults to `text-sm`
            (14px) while sketch 231-A's PARENT tabs are `text-xs` (12px) — so the children were
            rendering LARGER than their parents, which reads as an inverted hierarchy and is what
            the operator saw. The sketch has the child marginally smaller than the parent
            (.76rem vs .79rem); this matches that direction with the two sizes the app has. */}
        <TabsList className="mb-4 [&>button]:text-xs [&>button]:px-2.5 [&>button]:py-1">
          <TabsTrigger value="add-files">Add files</TabsTrigger>
          {/* ⭐ Sketch 231-A — the live count badge. The header pill and this badge are the SAME
              FACT AT TWO SCALES, derived from the same `inFlight` predicate, so they cannot
              disagree: the pill says a run is happening, the tab says how much is left, and the
              pill's click lands here. ⛔ A control that lights up and goes nowhere is what the
              sketch's own variant C had to fix. */}
          <TabsTrigger value="in-progress" data-testid="subtab-in-progress">
            In progress
            {inFlightCount !== null && inFlightCount > 0 && (
              <span
                data-testid="in-progress-badge"
                /* ⛔ aria-hidden, and that is deliberate rather than lazy. Without it the tab's
                   ACCESSIBLE NAME becomes "In progress 3" and every `getByRole("tab", {name:
                   "In progress"})` breaks — six cases did, measured. The count is not lost to a
                   screen reader: the In-progress body states it in words ("N files"). A badge
                   may decorate a control's name; it may not RENAME it. */
                aria-hidden="true"
                className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-1.5 text-[10px] tabular-nums text-sky-400"
              >
                <span className="h-1 w-1 rounded-full bg-sky-400 animate-pulse" />
                {inFlightCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="needs-attention">Needs attention</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ── ADD FILES — the hero dropzone + folder picker ─────────────────── */}
        <TabsContent value="add-files" data-testid="ingestion-subtab-add-files">
          <div className="flex flex-col gap-4">
            {/* 217.1-18 — the contract's `.dropbig` block hook. */}
            <div data-testid="ingestion-dropbig">
              <DocumentUpload
                onUpload={upload}
                uploading={uploading}
                uploadingCount={uploadingCount}
                folderId={uploadFolderId}
                folderName={uploadFolderName}
                disabled={disabled}
                variant="hero"
              />
            </div>
            {/* 217.1-18 — the contract's `folder-picker` block hook. */}
            <div className="flex items-center gap-2" data-testid="ingestion-folder-picker">
              <UploadFolderPicker
                onSelect={(id, name) => {
                  setUploadFolderId(id)
                  setUploadFolderName(name)
                }}
                selectedFolderId={uploadFolderId}
              />
            </div>
            {/* Phase 233 (D-233-06) — the connected-source door. ONE child element: the section
                owns the connection picker, the source folder tree and the preview, so this tab
                gains a mount and no branch. It renders NOTHING when no source-capable connection
                exists, so a person with no connections sees exactly the surface they saw before. */}
            <ConnectedSourceSection
              destinationFolderId={uploadFolderId}
              destinationFolderName={uploadFolderName}
            />
            <WatchedFoldersSection
              destinationFolderId={uploadFolderId}
              readerRunning={readerRunning}
              stoppedSources={stopped}
              onNavigateToConnections={onNavigateToConnections}
            />
          </div>
        </TabsContent>

        {/* ── IN PROGRESS — the pipeline row + queue table ──────────────── */}
        <TabsContent value="in-progress" data-testid="ingestion-subtab-in-progress">
          <InProgressBody
            summary={summary}
            summaryState={summaryState}
            onRetrySummary={onRetrySummary}
            changeTick={changeTick}
          />
        </TabsContent>

        {/* ── NEEDS ATTENTION — the same rows, re-mounted behind a sub-tab ────── */}
        <TabsContent value="needs-attention" data-testid="ingestion-subtab-needs-attention">
          <NeedsAttentionBody changeTick={changeTick} showTechnical={showTechnical} />
        </TabsContent>

        {/* ── HISTORY — completed and failed, grouped by date ───────────────────── */}
        <TabsContent value="history" data-testid="ingestion-subtab-history">
          <HistoryBody changeTick={changeTick} />
        </TabsContent>
      </Tabs>
      </div>
    </section>
  )
}

/**
 * D-217.1-21 — the Needs attention row.
 *
 * `Try again` calls `reingestDocument` — the SAME verb `DocumentList.tsx` imports and
 * calls. One verb, a second mount; the verb is owned by `@/lib/api`, not by `DocumentList`,
 * so a second mount of it is not a fork.
 */
function NeedsAttentionRow({
  doc,
  showTechnical,
}: {
  doc: Document
  showTechnical: boolean
}) {
  const [retrying, setRetrying] = useState(false)

  async function handleRetry() {
    setRetrying(true)
    try {
      await reingestDocument(doc.id)
    } catch (e) {
      console.error("Reingest failed:", e)
    } finally {
      setRetrying(false)
    }
  }

  const reason = showTechnical
    ? (doc.error_message ?? "It stopped, and no reason was recorded.")
    : classifyIngestionError(doc.error_message, doc.filename)

  return (
    <li
      data-testid="needs-attention-row"
      data-doc-id={doc.id}
      className="flex flex-col gap-2 rounded-xl bg-destructive/5 border border-destructive/30 px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          data-testid="failed-badge"
          className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
        >
          <span aria-hidden="true">●</span>
          Failed
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={doc.filename}>
          {doc.filename}
        </span>
        <span className="text-xs text-muted-foreground" data-testid="file-size">
          {formatBytes(doc.file_size)}
        </span>
      </div>
      <span className="text-xs text-muted-foreground" data-testid="failure-reason">
        {reason}
      </span>
      <IngestionStrip document={doc} />
      <div className="flex justify-end">
        <button
          type="button"
          data-testid="try-again"
          onClick={handleRetry}
          disabled={retrying}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {retrying ? "Retrying…" : "Try again"}
        </button>
      </div>
    </li>
  )
}

// ── 284-03 (D-12 / D-13 / R-08 / UI-SPEC S7) — the three lists read server pages ─────────────

type ListStatus = Extract<DocumentListParams["status"], "in_flight" | "failed" | "done">

/**
 * ONE `GET /documents?status=…` page, mounted only while its sub-tab is open (so a Library at
 * rest costs nothing here). `null` total until answered; a stale answer is dropped; a change hint
 * (`changeTick`) refetches silently. A shrinking list clamps the page back into range
 * (BUG-260923-02's rule, now on the server's total).
 */
function usePagedStatusList(status: ListStatus, changeTick: number) {
  const [offset, setOffset] = useState(0)
  const [rows, setRows] = useState<Document[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [state, setState] = useState<LibraryLoadState>("loading")
  const [attempt, setAttempt] = useState(0)
  const reqRef = useRef(0)

  useEffect(() => {
    const myReq = ++reqRef.current
    const params: DocumentListParams =
      status === "done"
        ? { status: "done", order: "updated_desc", offset, limit: LIST_PAGE_SIZE }
        : { status, offset, limit: LIST_PAGE_SIZE }
    listDocumentsPage(params).then(
      (res) => {
        if (myReq !== reqRef.current) return
        if (res.total > 0 && offset >= res.total) {
          setOffset(Math.floor((res.total - 1) / LIST_PAGE_SIZE) * LIST_PAGE_SIZE)
          return
        }
        setRows(res.documents)
        setTotal(res.total)
        setState("ready")
      },
      () => {
        if (myReq !== reqRef.current) return
        setState("error")
      },
    )
  }, [status, offset, attempt, changeTick])

  const retry = useCallback(() => {
    if (total === null) setState("loading")
    setAttempt((n) => n + 1)
  }, [total])

  return { rows, total, state, offset, setOffset, retry }
}

/** The cold-load block: 3 bars, `sr-only` "Loading files" (UI-SPEC §Loading vocabulary). */
function ListLoading() {
  return (
    <div role="status" aria-live="polite" className="mt-3 flex flex-col gap-2">
      <span className="sr-only">Loading files</span>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden="true" className="h-10 w-full animate-pulse rounded-md bg-border/30" />
      ))}
    </div>
  )
}

/** A page-level failure (DocumentsFindBody's treatment) — it says it is not the empty state. */
function LoadAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2"
    >
      <p className="text-sm text-destructive">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs text-primary hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
        >
          Try again
        </button>
      )}
    </div>
  )
}

const LIST_LOAD_ERROR = "Couldn’t load this list. This is a loading error, not an empty list."

function ListPager({ list }: { list: ReturnType<typeof usePagedStatusList> }) {
  if (list.total === null || list.total <= LIST_PAGE_SIZE) return null
  return (
    <PaginationControls offset={list.offset} limit={LIST_PAGE_SIZE} total={list.total} onChange={list.setOffset} />
  )
}

function isRateLimited(d: Document): boolean {
  const m = d.error_message?.toLowerCase()
  return Boolean(m && (m.includes("rate limit") || m.includes("429") || m.includes("quota")))
}

/** In progress: the banner, the four cards, the batch lane and the queue (layout unchanged). */
function InProgressBody({
  summary,
  summaryState,
  onRetrySummary,
  changeTick,
}: {
  summary: LibrarySummary | null
  summaryState: LibraryLoadState
  onRetrySummary?: () => void
  changeTick: number
}) {
  const queue = usePagedStatusList("in_flight", changeTick)

  // ── Pipeline card counts — fold the server's per-step counts into four cards ──────
  const stageCounts = new Map<PipelineCardId, number>()
  for (const cardId of PIPELINE_CARDS) stageCounts.set(cardId, 0)
  if (summary) {
    for (const [step, n] of Object.entries(summary.steps)) {
      const card = cardForStage(step as IngestionStageKey)
      if (card) stageCounts.set(card, (stageCounts.get(card) ?? 0) + n)
    }
  }
  const unknown = summaryState === "error" ? "—" : "…"

  const inFlightCount = summary === null ? null : summary.status.pending + summary.status.processing
  const completedCount = summary?.status.completed ?? 0
  const totalBatchCount = (inFlightCount ?? 0) + completedCount
  const isPaused = summary !== null && summary.rate_limited_in_flight > 0
  // The provider's own words, when the rate-limited row is on the queue page; never a second read.
  const pausedDoc = queue.rows.find(isRateLimited)

  return (
    <>
      {/* ── Refusal Banner (SC#3, closes BUG-260815-05) — sits at top of sub-tab ─────── */}
      {isPaused && (
        <div className="mb-5">
          <IngestionPauseBanner
            provider="OpenAI"
            statusCode={429}
            statusText="insufficient_quota"
            verbatimError={pausedDoc?.error_message || undefined}
            completedCount={completedCount}
            totalCount={totalBatchCount > 0 ? totalBatchCount : 340}
          />
        </div>
      )}

      {summaryState === "error" && summary === null && (
        <div className="mb-3">
          <LoadAlert message="Couldn’t load ingestion counts." onRetry={onRetrySummary} />
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold leading-tight">Where every file is right now</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          A count of the files sitting at each stage of the pipeline.
        </p>
        {/* ── THE FOUR-CARD PIPELINE ROW ──────────────────────────────────────── */}
        <div className="mt-3 flex items-center gap-2" data-testid="ingestion-stagecards">
          {PIPELINE_CARDS.map((cardId, i) => (
            <React.Fragment key={cardId}>
              <PipelineCard
                key={cardId}
                cardId={cardId}
                count={summary === null ? null : (stageCounts.get(cardId) ?? 0)}
                unknown={unknown}
              />
              {i < PIPELINE_CARDS.length - 1 && (
                <span className="text-muted-foreground/50 text-sm" aria-hidden="true">
                  ›
                </span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── THE BATCH LANE (Sketch 227 Variant B winner) ──────────────── */}
      {inFlightCount !== null && inFlightCount > 0 && (
        <div className="mt-6" data-testid="ingestion-batch-lane-wrapper">
          <IngestionBatchLane
            totalFiles={totalBatchCount > 0 ? totalBatchCount : inFlightCount}
            completedFiles={completedCount}
            isPaused={isPaused}
          />
        </div>
      )}

      {/* ── THE QUEUE TABLE ──────────────────────────────────────────────────── */}
      <div className="mt-6" data-testid="ingestion-queue">
        <h2 className="text-lg font-semibold leading-tight">
          The queue{" "}
          {inFlightCount !== null && inFlightCount > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              (<AnimatedNumber value={inFlightCount.toLocaleString()} /> {inFlightCount === 1 ? "file" : "files"})
            </span>
          )}
        </h2>
        {queue.state === "error" && <LoadAlert message={LIST_LOAD_ERROR} onRetry={queue.retry} />}
        {queue.state === "loading" && queue.total === null ? (
          <ListLoading />
        ) : queue.state === "ready" && queue.total === 0 ? (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Nothing is being read right now.
          </p>
        ) : queue.rows.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm" data-testid="queue-table">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Folder</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.rows.map((doc) => (
                  <tr key={doc.id} className="border-b border-border/50">
                    <td className="px-4 py-3 max-w-[200px] truncate" title={doc.filename}>
                      {doc.filename}
                    </td>
                    <td className="px-4 py-3">
                      {doc.status === "pending" ? (
                        <span className="text-muted-foreground">Waiting its turn</span>
                      ) : (
                        <div className="w-full max-w-[420px]">
                          <IngestionStrip document={doc} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      --
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatBytes(doc.file_size)}
                    </td>
                    <td className="px-4 py-3">
                      {/* Actions column reserved for future stop/retry */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ListPager list={queue} />
          </div>
        ) : null}
      </div>
    </>
  )
}

/** Needs attention: the failed documents, one page at a time. */
function NeedsAttentionBody({ changeTick, showTechnical }: { changeTick: number; showTechnical: boolean }) {
  const failed = usePagedStatusList("failed", changeTick)
  return (
    <div data-testid="ingestion-needs-attention">
      <h2 className="text-lg font-semibold leading-tight">Needs attention</h2>
      {failed.state === "error" && <LoadAlert message={LIST_LOAD_ERROR} onRetry={failed.retry} />}
      {failed.state === "loading" && failed.total === null ? (
        <ListLoading />
      ) : failed.state === "ready" && failed.total === 0 ? (
        <p className="mt-0.5 text-sm text-muted-foreground">Nothing needs attention.</p>
      ) : failed.rows.length > 0 ? (
        <>
          <ul role="list" className="mt-3 flex flex-col gap-2">
            {failed.rows.map((doc) => (
              <NeedsAttentionRow key={doc.id} doc={doc} showTechnical={showTechnical} />
            ))}
          </ul>
          <ListPager list={failed} />
        </>
      ) : null}
    </div>
  )
}

/** History: completed and failed, newest `updated_at` first (R-08). */
function HistoryBody({ changeTick }: { changeTick: number }) {
  const history = usePagedStatusList("done", changeTick)
  return (
    <div>
      <h2 className="text-lg font-semibold leading-tight">History</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Recently completed and failed uploads.
      </p>
      {history.state === "error" && <LoadAlert message={LIST_LOAD_ERROR} onRetry={history.retry} />}
      {history.state === "loading" && history.total === null ? (
        <ListLoading />
      ) : history.state === "ready" && history.total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing has been ingested yet.
        </p>
      ) : history.rows.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm" data-testid="history-table">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {history.rows
                .map((doc) => (
                  <tr key={doc.id} className="border-b border-border/50">
                    <td className="px-4 py-3 max-w-[300px] truncate" title={doc.filename}>
                      {doc.filename}
                    </td>
                    <td className="px-4 py-3">
                      {doc.status === "completed" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatBytes(doc.file_size)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(doc.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <ListPager list={history} />
        </div>
      ) : null}
    </div>
  )
}