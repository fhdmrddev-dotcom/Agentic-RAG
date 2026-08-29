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
import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { IngestionStrip } from "@/components/ingestion/IngestionStrip"
import { DocumentUpload } from "@/components/ingestion/DocumentUpload"
import {
  INGESTION_STAGES,
  stageTermKey,
  type IngestionStage,
} from "@/components/ingestion/ingestionStages"
import { usePlainLabel, type TermKey } from "@/lib/termMap"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"
import { classifyIngestionError } from "@/components/library/ingestionErrorVocabulary"
import { formatBytes } from "@/lib/formatBytes"
import { reingestDocument } from "@/lib/api"
import type { Document } from "@/types"
import { UploadFolderPicker } from "@/components/library/ingestion/UploadFolderPicker"

/** One aggregate card: how many documents are at this stage RIGHT NOW. */
function StageCount({ stage, count }: { stage: IngestionStage; count: number }) {
  const label = usePlainLabel(stageTermKey(stage) as TermKey)
  return (
    <div
      data-stage-card={stage.key}
      className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl bg-card/50 ghost-border px-3 py-2.5"
    >
      <span className="truncate text-xs font-medium text-foreground" title={label}>
        {label}
      </span>
      <span className="font-mono text-lg font-bold text-foreground">{count}</span>
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

  // In flight == not finished and not failed.
  const inFlight = documents.filter((d) => d.status === "pending" || d.status === "processing")
  const failed = documents.filter((d) => d.status === "failed")

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
            <DocumentUpload
              onUpload={upload}
              uploading={uploading}
              uploadingCount={uploadingCount}
              folderId={uploadFolderId}
              folderName={uploadFolderName}
              disabled={disabled}
              variant="hero"
            />
            <div className="flex items-center gap-2">
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

        {/* ── IN PROGRESS — the queue + stage aggregate ──────────────────────── */}
        <TabsContent value="in-progress" data-testid="ingestion-subtab-in-progress">
          <div>
            <h2 className="text-lg font-semibold leading-tight">Where every file is right now</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              A count of the files sitting at each stage of the pipeline.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {INGESTION_STAGES.map((stage) => (
                <StageCount
                  key={stage.key}
                  stage={stage}
                  count={
                    documents.filter(
                      (d) => d.status === "processing" && d.ingestion_step === stage.key,
                    ).length
                  }
                />
              ))}
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-semibold leading-tight">The queue</h2>
            {inFlight.length === 0 ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Nothing is being read right now.
              </p>
            ) : (
              <ul role="list" className="mt-3 flex flex-col gap-2">
                {inFlight.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-col gap-2 rounded-xl bg-card/50 ghost-border px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={doc.filename}>
                      {doc.filename}
                    </span>
                    <div className="w-full sm:max-w-[420px] sm:flex-1">
                      <IngestionStrip document={doc} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* ── NEEDS ATTENTION — the same rows, re-mounted behind a sub-tab ────── */}
        <TabsContent value="needs-attention" data-testid="ingestion-subtab-needs-attention">
          <div>
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

        {/* ── HISTORY — placeholder shell for Plan 04 ────────────────────────── */}
        <TabsContent value="history" data-testid="ingestion-subtab-history">
          <div>
            <h2 className="text-lg font-semibold leading-tight">History</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Recently completed and failed uploads.
            </p>
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
    : classifyIngestionError(doc.error_message)

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