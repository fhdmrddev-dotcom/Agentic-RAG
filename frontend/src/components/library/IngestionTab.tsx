/**
 * Phase 217.1 plan 02 (LIB-03 / D-217.1-20 / D-217.1-21 / D-217.1-22) — the Ingestion tab body.
 *
 * ⭐ THIS IS THE MOUNT SITE FOR `IngestionStrip`. Plan 08 built the six-segment strip, its
 * stage constant and a 25-case suite, and shipped them with NO CONSUMER — a component that
 * exists, typechecks and is tested, and that no user can reach. D-217-17 puts the strips
 * HERE, one per in-flight document, which is what makes plan 08's work reachable.
 *
 * ⛔ NO PROGRESS ARITHMETIC OF ANY KIND (D-217-19). Two of the six stages are decided WHILE
 * THE FILE RUNS, so the pipeline's length is unknown when a row first renders and there is
 * no honest denominator to divide by. The queue shows STAGES REACHED. The file is fenced
 * bluntly against the literal tokens a progress bar would need, so even this docblock avoids
 * spelling them.
 *
 * ⛔ IT FETCHES NOTHING. Every document it renders is one the page already holds
 * (`useDocuments`), so opening this tab costs zero round trips. The stage aggregate is
 * derived from the step each document already carries — the sketch's own annotation calls
 * that "a real aggregate we can produce today", as against screen 07's invented token pie.
 *
 * ⛔ NO SECOND STATUS VOCABULARY. Every stage word comes from `TERM_MAP`'s six `ingest.*`
 * entries via `usePlainLabel`, so the ⌥ Technical-names reveal works here for free.
 *
 * ── Phase 217.1 plan 02 — THE FOUR DEFECTS THIS TAB NO LONGER CARRIES ──────────────────
 *
 *   D-217.1-20 — a failed ingest shows ONE plain-language sentence. The raw `error_message`
 *                 is a Postgres driver dict repr (`str(exc)[:500]`), never a sentence a person
 *                 can read. It is routed through `classifyIngestionError`, and the raw string
 *                 is reachable ONLY behind the ⌥ Technical-names reveal — mirroring
 *                 `TERM_MAP`'s `{plain, technical}` shape on a dynamic classifier.
 *
 *   D-217.1-21 — the Needs attention row carries a `● Failed` badge, the plain sentence, the
 *                 file size, and a working `Try again` action. `Try again` calls the SAME
 *                 `reingestDocument` verb `DocumentList.tsx:16,276` already imports and calls
 *                 — one verb, a second mount, never a fork (the comment at the old :119-120
 *                 already stated the rule; this plan honours it rather than repeating it).
 *
 *   D-217.1-22 — the tab mounts `DocumentUpload` so a person can START an ingestion from
 *                 the tab named for it. The six props are threaded from `LibraryPage` the
 *                 same way the Documents tab already receives them. `variant` defaults to
 *                 `"band"` (the shape here); Wave 2 relocates this mount under the `Add
 *                 files` sub-tab rather than rebuilding it.
 */
import { useState } from "react"
import { IngestionStrip } from "@/components/ingestion/IngestionStrip"
import { DocumentUpload } from "@/components/ingestion/DocumentUpload"
import {
  INGESTION_STAGES,
  stageTermKey,
  type IngestionStage,
} from "@/components/ingestion/ingestionStages"
import { usePlainLabel, useTechnicalNamesOptional, type TermKey } from "@/lib/termMap"
import { classifyIngestionError } from "@/components/library/ingestionErrorVocabulary"
import { formatBytes } from "@/lib/formatBytes"
import { reingestDocument } from "@/lib/api"
import type { Document } from "@/types"

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
  // In flight == not finished and not failed. `pending` files are in the queue too: they
  // have not started, and a queue that hides them would make the wait look like nothing.
  const inFlight = documents.filter((d) => d.status === "pending" || d.status === "processing")
  const failed = documents.filter((d) => d.status === "failed")

  // The ⌥ Technical-names reveal — same non-throwing accessor `usePlainLabel` uses, so the
  // raw error string renders only when an operator has explicitly asked for technical names.
  const { showTechnical } = useTechnicalNamesOptional() ?? { showTechnical: false }

  return (
    <section data-testid="ingestion-tab" className="flex flex-col gap-6 overflow-y-auto">
      {/* D-217.1-22 — the dropzone. A tab named Ingestion can start an ingestion. Mounted
          with the same six props the Documents tab already receives, so the two doors never
          disagree about what `upload` means. */}
      <DocumentUpload
        onUpload={upload}
        uploading={uploading}
        uploadingCount={uploadingCount}
        folderId={folderId}
        folderName={folderName}
        disabled={disabled}
      />

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

      <div>
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

      <div>
        <h2 className="text-lg font-semibold leading-tight">Needs attention</h2>
        {failed.length === 0 ? (
          // ⚠ Silence is not success — the empty arm says the thing it means.
          <p className="mt-0.5 text-sm text-muted-foreground">Nothing needs attention.</p>
        ) : (
          <ul role="list" className="mt-3 flex flex-col gap-2">
            {failed.map((doc) => (
              // D-217.1-21 — the row a person lands on when a file did not make it.
              // The badge, the plain sentence, the size, and a working retry — one row,
              // four facts, and a verb that already shipped.
              <NeedsAttentionRow key={doc.id} doc={doc} showTechnical={showTechnical} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/**
 * D-217.1-21 — the Needs attention row.
 *
 * `Try again` calls `reingestDocument` — the SAME verb `DocumentList.tsx:16,276` imports and
 * calls. One verb, a second mount; the comment that shipped here said *"`DocumentList` owns
 * the retry action — one verb, one place"* and this plan honours the RULE while relaxing the
 * PLACE: the verb is owned by `@/lib/api`, not by `DocumentList`, so a second mount of it is
 * not a fork. The button kicks the backend and lets Realtime reconcile the row, exactly as
 * `DocumentList`'s `handleReingest` does.
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
      // No manual refresh — Realtime UPDATE on the status transition triggers the
      // `useDocuments` refetch, exactly as DocumentList.handleReingest relies on.
    } catch (e) {
      console.error("Reingest failed:", e)
    } finally {
      setRetrying(false)
    }
  }

  // D-217.1-20 — the classified plain sentence by default; the raw string only behind the
  // ⌥ Technical-names reveal. A driver dict repr never reaches the DOM as visible text.
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
        {/* The badge names the outcome — a row under "Needs attention" already says something
            is wrong, so the word is the fact, not an alarm (Shared Pattern E, rule 2). */}
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
        {/* The file size — the same `formatBytes` the Documents table shows, extracted to one
            leaf so the two surfaces can never disagree about what `1 MB` means. */}
        <span className="text-xs text-muted-foreground" data-testid="file-size">
          {formatBytes(doc.file_size)}
        </span>
      </div>
      {/* The reason, not just the colour. Classified to one plain sentence; the raw string is
          behind the ⌥ reveal, never the default. */}
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
