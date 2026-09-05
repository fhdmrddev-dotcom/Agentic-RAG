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
 * ⛔ IT FETCHES NOTHING. Every document it renders is one the page already holds.
 * ⛔ NO SECOND STATUS VOCABULARY. Every stage word comes from `TERM_MAP`.
 */
import React, { useState } from "react"
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
import { reingestDocument } from "@/lib/api"
import type { Document } from "@/types"
import { UploadFolderPicker } from "@/components/library/ingestion/UploadFolderPicker"
import { IngestionPauseBanner } from "@/components/ingestion/IngestionPauseBanner"
import { IngestionBatchLane } from "@/components/ingestion/IngestionBatchLane"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"
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
}: {
  cardId: PipelineCardId
  count: number
}) {
  const isPopulated = count > 0
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
        <AnimatedNumber value={count} />
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
  documents: Document[]
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
}

export function IngestionTab({
  documents,
  upload,
  uploading,
  uploadingCount,
  folderId,
  folderName,
  disabled,
}: IngestionTabProps) {
  // ── LOCAL sub-tab state — never in librarySelection's reducer ─────────────────
  const [subTab, setSubTab] = useState<string>("add-files")

  // Local upload folder state for the folder picker.
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(folderId ?? null)
  const [uploadFolderName, setUploadFolderName] = useState<string>(folderName ?? "Root")

  // ── Pipeline card counts — fold the six stages into four cards ─────────────────
  const stageCounts = new Map<PipelineCardId, number>()
  for (const cardId of PIPELINE_CARDS) stageCounts.set(cardId, 0)
  for (const doc of documents) {
    if (doc.status === "processing" && doc.ingestion_step) {
      const card = cardForStage(doc.ingestion_step as IngestionStageKey)
      stageCounts.set(card, (stageCounts.get(card) ?? 0) + 1)
    }
  }

  // Completed + failed for the History tab.
  const historyDocs = documents.filter((d) => d.status === "completed" || d.status === "failed")
  const inFlight = documents.filter((d) => d.status === "pending" || d.status === "processing" || d.status === "paused")
  const completedDocs = documents.filter((d) => d.status === "completed")
  const failed = documents.filter((d) => d.status === "failed")

  const totalBatchCount = inFlight.length + completedDocs.length
  const pausedDoc = inFlight.find(
    (d) =>
      d.status === "paused" ||
      d.error_message?.toLowerCase().includes("rate limit") ||
      d.error_message?.toLowerCase().includes("429") ||
      d.error_message?.toLowerCase().includes("quota")
  )
  const isPaused = Boolean(pausedDoc)

  // The ⌥ Technical-names reveal.
  const { showTechnical } = useTechnicalNamesOptional() ?? { showTechnical: false }

  return (
    <section data-testid="ingestion-tab" className="flex flex-col gap-6 overflow-y-auto">
      {/* ── THE FOUR SUB-TABS ──────────────────────────────────────────────────── */}
      <Tabs value={subTab} onValueChange={setSubTab} data-testid="ingestion-subnav">
        <TabsList className="mb-4">
          <TabsTrigger value="add-files">Add files</TabsTrigger>
          <TabsTrigger value="in-progress">In progress</TabsTrigger>
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
          </div>
        </TabsContent>

        {/* ── IN PROGRESS — the pipeline row + queue table ──────────────── */}
        <TabsContent value="in-progress" data-testid="ingestion-subtab-in-progress">
          {/* ── Refusal Banner (SC#3, closes BUG-260815-05) — sits at top of sub-tab ─────── */}
          {isPaused && (
            <div className="mb-5">
              <IngestionPauseBanner
                provider="OpenAI"
                statusCode={429}
                statusText="insufficient_quota"
                verbatimError={pausedDoc?.error_message || undefined}
                completedCount={completedDocs.length}
                totalCount={totalBatchCount > 0 ? totalBatchCount : 340}
              />
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
                  <PipelineCard key={cardId} cardId={cardId} count={stageCounts.get(cardId) ?? 0} />
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
          {inFlight.length > 0 && (
            <div className="mt-6" data-testid="ingestion-batch-lane-wrapper">
              <IngestionBatchLane
                totalFiles={totalBatchCount > 0 ? totalBatchCount : inFlight.length}
                completedFiles={completedDocs.length}
                isPaused={isPaused}
              />
            </div>
          )}

          {/* ── THE QUEUE TABLE ──────────────────────────────────────────────────── */}
          <div className="mt-6" data-testid="ingestion-queue">
            <h2 className="text-lg font-semibold leading-tight">
              The queue{" "}
              {inFlight.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  (<AnimatedNumber value={inFlight.length} /> {inFlight.length === 1 ? "file" : "files"})
                </span>
              )}
            </h2>
            {inFlight.length === 0 ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Nothing is being read right now.
              </p>
            ) : (
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
                    {inFlight.map((doc) => (
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
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── NEEDS ATTENTION — the same rows, re-mounted behind a sub-tab ────── */}
        <TabsContent value="needs-attention" data-testid="ingestion-subtab-needs-attention">
          <div data-testid="ingestion-needs-attention">
            <h2 className="text-lg font-semibold leading-tight">Needs attention</h2>
            {failed.length === 0 ? (
              <p className="mt-0.5 text-sm text-muted-foreground">Nothing needs attention.</p>
            ) : (
              <ul role="list" className="mt-3 flex flex-col gap-2">
                {failed.map((doc) => (
                  <NeedsAttentionRow key={doc.id} doc={doc} showTechnical={showTechnical} />
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* ── HISTORY — completed and failed, grouped by date ───────────────────── */}
        <TabsContent value="history" data-testid="ingestion-subtab-history">
          <div>
            <h2 className="text-lg font-semibold leading-tight">History</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Recently completed and failed uploads.
            </p>
            {historyDocs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing has been ingested yet.
              </p>
            ) : (
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
                    {historyDocs
                      .sort(
                        (a, b) =>
                          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
                      )
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
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
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