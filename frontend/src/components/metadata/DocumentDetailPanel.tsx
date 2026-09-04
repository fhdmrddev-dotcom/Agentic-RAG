/**
 * Phase 112 Plan 04 Task 1 — DocumentDetailPanel (the META-02/META-05 user surface).
 *
 * The net-new right-side push/split document-detail panel (sketch 027 winner A +
 * sketch 028 winner A; see references/document-detail-panel.md + sources/
 * 028-confidence-and-edit/GROUNDING.md). It is the SHARED SHELL that Phases 117
 * (Relationships) and 118 (Classification) will plug accordion sections into — but
 * this phase ships ONLY the Metadata section (honesty: no inert REL/CLASS/Versions
 * stubs signposting unbuilt features).
 *
 * The Metadata section reuses the PanelSection accordion DIRECTLY (no new accordion),
 * renders the UNION of the 7 built-ins + enabled custom field defs (never raw
 * `Object.keys(metadata)`, always ignoring `_`-prefixed keys), each row carrying a
 * ConfidenceChip (Plan 03) with its honest states + an InlineEdit (Plan 04 Task 1).
 *
 * The honesty contract is load-bearing: the "🛡 Saved · audit logged" receipt renders
 * ONLY inside the `await updateDocumentMetadata(...)` success branch — never before /
 * without the write returning, because Plan 01's route is what writes the audit row.
 * The error path is the honest inverse (role=alert "your change wasn't recorded").
 *
 * a11y: panel-scoped AA tokens ONLY (never the global --muted-foreground 3.59:1);
 * the receipt is role=status aria-live=polite, the error is role=alert (assertive);
 * the save animation is motion-safe (the receipt STILL renders when motion is off);
 * closing the panel restores focus to the caller's trigger row; mobile (<768px)
 * renders as a bottom-sheet (reusing the WorkspacePanel sheet shape).
 */
import { useEffect, useRef, useState } from "react"
import { X, ShieldCheck } from "lucide-react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { PanelSection } from "@/components/panel/PanelSection"
import { RelationshipsSection } from "@/components/relationships/RelationshipsSection"
import { ClassificationSection } from "@/components/classification/ClassificationSection"
import { DocumentContentSection } from "./DocumentContentSection"
import { DocumentChunksSection } from "./DocumentChunksSection"
import { DocumentTablesSection } from "./DocumentTablesSection"
import { DocumentImagesSection } from "./DocumentImagesSection"
import { DocumentQueriesSection } from "./DocumentQueriesSection"
import { TakeoffSection } from "./TakeoffSection"
import { ConfidenceChip, TIER } from "./ConfidenceChip"
import { InlineEdit, type InlineFieldType } from "./InlineEdit"
import { updateDocumentMetadata, listMetadataFields } from "@/lib/api"
import { usePlainLabel } from "@/lib/termMap"
import { getFileIcon } from "@/lib/fileIcons"
import { cn } from "@/lib/utils"
import type { Document, MetadataFieldDef } from "@/types"

const MOBILE_BREAKPOINT = 768

/** Inline mobile hook — the project convention (WorkspacePanel.tsx:59-71). */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT,
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return isMobile
}

// The 7 Phase 111 built-ins, in schema order (default sort — GROUNDING.md). Each
// carries its display label + the InlineEdit control type. `topics` edits as a
// comma-text input in v1 (RESEARCH Open Q2). NEVER iterate raw metadata keys —
// the field set is this list ∪ the enabled custom defs.
interface FieldRow {
  key: string
  label: string
  type: InlineFieldType
  options?: string[] | null
}

const BUILTIN_FIELDS: FieldRow[] = [
  { key: "title", label: "Title", type: "title" },
  { key: "author", label: "Author", type: "author" },
  { key: "date", label: "Date", type: "date" },
  { key: "document_type", label: "Type", type: "string" },
  { key: "topics", label: "Topics", type: "topics" },
  { key: "language", label: "Language", type: "string" },
  { key: "summary", label: "Summary", type: "summary" },
]

const BUILTIN_KEYS = new Set(BUILTIN_FIELDS.map((f) => f.key))

/** The D-05 LOW/MED boundary, single-sourced from ConfidenceChip's TIER (IN-02).
 *  Used only to count LOW fields for the PanelSection warn badge + the tentative-
 *  value styling, so the warn count can never drift from the chip rendering.
 *  NOT the retrieval confidence_bucket (0.54/0.38) — a different system. */
const LOW_TIER = TIER.MED

interface FieldState {
  row: FieldRow
  value: unknown
  score?: number
  source?: "user" | "extracted"
  empty: boolean
  isLow: boolean
}

/** Build the render-ordered field set: built-ins first (schema order), then enabled
 *  custom defs. Always ignores `_`-prefixed keys; never enumerates raw metadata. */
function buildFieldRows(customDefs: MetadataFieldDef[]): FieldRow[] {
  const customRows: FieldRow[] = customDefs
    .filter((d) => d.enabled && !d.field_key.startsWith("_") && !BUILTIN_KEYS.has(d.field_key))
    .map((d) => ({
      key: d.field_key,
      label: d.field_key,
      type: d.field_type as InlineFieldType,
      options: d.options,
    }))
  return [...BUILTIN_FIELDS, ...customRows]
}

function resolveFieldState(row: FieldRow, metadata: Document["metadata"]): FieldState {
  const value = metadata?.[row.key]
  const score = metadata?._confidence?.[row.key]
  const source = metadata?._source?.[row.key]
  const empty =
    value == null ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "string" && value.trim() === "")
  const isLow =
    !empty && source !== "user" && typeof score === "number" && score < LOW_TIER
  return { row, value, score, source, empty, isLow }
}

export interface DocumentDetailPanelProps {
  /** The selected document (carries `.metadata`). */
  doc: Document
  /** Close the panel; the caller restores focus to the row trigger. */
  onClose: () => void
  /** Reconcile after an edit — Realtime is best-effort (D-v2.5-03), so the parent
   *  re-fetches documents. Optional in tests. */
  onReconcile?: () => void
}

export function DocumentDetailPanel({ doc, onClose, onReconcile }: DocumentDetailPanelProps) {
  const isMobile = useIsMobile()
  const [customDefs, setCustomDefs] = useState<MetadataFieldDef[]>([])
  // Per-field transient save/error receipts keyed by field_key.
  const [savedField, setSavedField] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<string | null>(null)
  // The Relationships section owns its own fetch; it lifts its loaded total up so the
  // PanelSection can show a count badge (null = not yet loaded → no badge).
  const [relTotal, setRelTotal] = useState<number | null>(null)
  // The Classification section reads metadata._classification (no own fetch); it lifts
  // its pending-suggestion count up (1 when a "suggested" exists, else 0).
  const [classCount, setClassCount] = useState<number | null>(null)
  // Phase 217 — the two new sections lift their totals the same way, so the accordion
  // shows a count once (and only once) the section has actually been opened and read.
  // `null` = never loaded → no badge, which is the honest state for a lazy section.
  const [contentLines, setContentLines] = useState<number | null>(null)
  const [chunkTotal, setChunkTotal] = useState<number | null>(null)
  const [tableTotal, setTableTotal] = useState<number | null>(null)
  const [imageTotal, setImageTotal] = useState<number | null>(null)
  const [queryTotal, setQueryTotal] = useState<number | null>(null)
  const [takeoffTotal, setTakeoffTotal] = useState<number | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // GET /metadata-fields on mount → filter enabled === true client-side (matches
  // read_enabled_field_defs; RESEARCH Open Q5). A failure degrades to built-ins only.
  useEffect(() => {
    let alive = true
    listMetadataFields()
      .then((defs) => {
        if (alive) setCustomDefs(defs)
      })
      .catch(() => {
        if (alive) setCustomDefs([])
      })
    return () => {
      alive = false
    }
  }, [])

  // Focus the close control on open (focus management; closing restores to the
  // trigger via the parent's selectedDocId reset → the row regains focusability).
  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  // Reset the relationships + classification counts when the open document changes so
  // a stale badge never shows during the new doc's fetch (each section re-derives on
  // docId change).
  useEffect(() => {
    setRelTotal(null)
    setClassCount(null)
    setContentLines(null)
    setChunkTotal(null)
    // ⚠ CR-01 (217 review): plan 11 added Tables / Images / Found-by and did NOT extend this
    // reset. The panel is never remounted (LibraryPage passes `doc` with no `key`) and a COLLAPSED
    // PanelSection does not render its child, so a section opened on doc A kept its badge count
    // forever after switching to doc B — including on a doc where the section does not apply.
    // The open-section case self-corrected on re-fetch, which is why the existing test missed it.
    setTableTotal(null)
    setImageTotal(null)
    setQueryTotal(null)
    setTakeoffTotal(null)
  }, [doc.id])

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
    },
    [],
  )

  const fieldRows = buildFieldRows(customDefs)
  const fieldStates = fieldRows.map((row) => resolveFieldState(row, doc.metadata))
  // The warn-count = LOW + EMPTY fields (the needs-review signal — GROUNDING triage).
  const lowPlusEmpty = fieldStates.filter((f) => f.isLow || f.empty).length

  async function handleCommit(field: string, value: unknown) {
    setErrorField(null)
    try {
      // The audit row is written by Plan 01's route — only on a 200 do we claim
      // "audit logged". NEVER optimistically (T-112-04-01).
      await updateDocumentMetadata(doc.id, field, value)
      setSavedField(field)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSavedField(null), 4000)
      // Reconcile (Realtime is best-effort, D-v2.5-03).
      onReconcile?.()
    } catch {
      // Honest inverse: the value wasn't recorded.
      setErrorField(field)
      setSavedField(null)
    }
  }

  const body = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[hsl(var(--panel-border))] px-4 py-3">
        <span className="flex-none" aria-hidden="true">
          {getFileIcon(doc.filename)}
        </span>
        <span className="min-w-0 flex-1 truncate font-headline text-sm font-semibold text-foreground">
          {doc.filename}
        </span>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close document details"
          className="ml-auto grid h-7 w-7 flex-none place-items-center rounded-md text-panel-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Sections, in the D-217-25a order: Details (112) · Text · Chunks (both 217-10)
          · Tables · Images · Found by (217-11) · Relationships (117) · Classification
          (118). The five 217 sections are INSERTED between Details and Relationships. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* SEED-227 — the images this document has that were never read. Rendered ONLY
            when the backend stamped `_images`, which it does only on truncation, so the
            quiet case stays quiet. ⚠ Says "were read", past tense, against the ceiling
            that applied AT INGESTION: raising the setting now does not go back and read
            the rest, and a present-tense sentence here would promise that it had. */}
        {doc.metadata?._images && (
          <div className="mx-4 mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            This document has {doc.metadata._images.total} images. The first{" "}
            {doc.metadata._images.read} were read — the rest are not searchable. Re-upload
            it after raising the limit in Settings to read them all.
          </div>
        )}
        <PanelSection
          // Phase 154 Plan 02 (LANG-01 / Surface B): plain "Details" by default,
          // "Metadata" under the reveal — via the single-source term-map (D-02).
          title={usePlainLabel("doc.metadata_section")}
          warn={lowPlusEmpty > 0}
          count={lowPlusEmpty}
          defaultOpen
        >
          <div className="flex flex-col gap-3 px-4 pt-1">
            {fieldStates.map((fs) => (
              <FieldRowView
                key={fs.row.key}
                state={fs}
                saved={savedField === fs.row.key}
                errored={errorField === fs.row.key}
                onCommit={handleCommit}
              />
            ))}
          </div>
        </PanelSection>

        {/* Phase 220 (TAKEOFF-04) — CAD Drawing Takeoff & Grounded Quantities BOQ */}
        {(doc.filename.toLowerCase().endsWith(".dxf") || !!doc.metadata?._takeoff) && (
          <PanelSection
            title="Takeoff"
            count={takeoffTotal ?? undefined}
            defaultOpen
          >
            <div className="px-4 pt-1 pb-3">
              <TakeoffSection
                doc={doc}
                onTotalChange={setTakeoffTotal}
                onRefresh={onReconcile}
              />
            </div>
          </PanelSection>
        )}

        {/* ── Phase 217 (LIB-04 / D-217-04 / D-217-25a) — the document's OWN content, ──
            INSERTED between Details and Relationships, never appended after them. The
            reading order is: what we know about it (Details) → what is IN it (Text,
            Chunks) → how it relates to everything else (Relationships, Classification).
            Appending would put the document's own text below two sections about OTHER
            documents.

            ⚠ The three shipped mounts MOVE DOWN and their PROPS DO NOT CHANGE. That is
            the fence exactly: a relocation alters no prop.

            ⛔ THE CLOSED-BY-DEFAULT PROP ON THE TWO MOUNTS BELOW IS THE ENTIRE LAZY
            MECHANISM. `PanelSection.tsx:94` renders children only when open and
            `PanelSection` has NO `onOpenChange` / `onToggle` prop, so a section that
            fetches in a bare `useEffect` costs nothing until the accordion is clicked —
            and costs a request on every document open the moment the prop is dropped.
            `/content` can be megabytes.

            ⚠ The prop's literal is deliberately NOT written in this comment: the fence
            COUNTS occurrences file-wide and expects one per mount, so prose about the
            rule would let the count pass on comments alone. Measured, not feared — this
            paragraph originally spelled it and made the count read 3 for 2 mounts.

            ⚠ D-217-25b — the title is `Text`, NOT `Details`: the shipped metadata
            section's plain label is already `Details` (`termMap.ts:90`), and the same
            word twice over two unrelated surfaces is how a vocabulary stops being one. */}
        <PanelSection title="Text" count={contentLines ?? undefined} defaultOpen={false}>
          <DocumentContentSection
            docId={doc.id}
            extractor={doc.extractor}
            onTotalChange={setContentLines}
          />
        </PanelSection>

        <PanelSection title="Chunks" count={chunkTotal ?? undefined} defaultOpen={false}>
          <DocumentChunksSection docId={doc.id} onTotalChange={setChunkTotal} />
        </PanelSection>

        {/* -- Phase 217 Plan 11 (LIB-04 / D-217-25a) - the three that CLOSE the order. --
            The final sequence is Details - Text - Chunks - Tables - Images - Found by -
            Relationships - Classification: what we know about it, then what is IN it,
            then how it is USED, then how it relates to other documents. These three go
            directly after Chunks and BEFORE Relationships; Relationships and
            Classification move down and their PROPS do not change, which is the fence
            exactly - a relocation alters no prop.

            D-217-25b - the titles are the literal strings below. `Found by`, never
            `Queries` and never `Retrieval`: sketch 218's own SIGNAL_RENAMES already turns
            `Most Retrieved` into `Most found`, and a third word for one concept is how a
            vocabulary stops being one. And never `Details`, which is the shipped metadata
            section's plain label (`termMap.ts:90`).

            All three carry the closed-by-default prop, for the same reason the two above
            do: `PanelSection.tsx:94` renders children only when open, so a section that
            fetches in a bare `useEffect` costs nothing until it is clicked. The prop's
            literal is deliberately absent from this comment - the fence COUNTS
            occurrences file-wide, so prose about the rule would let the count pass on
            comments alone (measured in 217-10).

            The tables and images sections are handed the document row itself, not just
            its id: they need `tables_stage_applies` / `table_count` to choose WHICH of
            their three empty sentences is true, and those fields are already on the row
            the panel holds - so it costs no extra request. */}
        <PanelSection title="Tables" count={tableTotal ?? undefined} defaultOpen={false}>
          <DocumentTablesSection docId={doc.id} doc={doc} onTotalChange={setTableTotal} />
        </PanelSection>

        <PanelSection title="Images" count={imageTotal ?? undefined} defaultOpen={false}>
          <DocumentImagesSection docId={doc.id} doc={doc} onTotalChange={setImageTotal} />
        </PanelSection>

        <PanelSection title="Found by" count={queryTotal ?? undefined} defaultOpen={false}>
          <DocumentQueriesSection docId={doc.id} onTotalChange={setQueryTotal} />
        </PanelSection>

        {/* Relationships (Phase 117 REL-02) — the section owns its own fetch +
            re-fetch (D-117-9); it lifts the loaded total up for the count badge. */}
        <PanelSection
          title="Relationships"
          count={relTotal ?? undefined}
        >
          <RelationshipsSection
            docId={doc.id}
            filename={doc.filename}
            onTotalChange={setRelTotal}
          />
        </PanelSection>

        {/* Classification (Phase 118 CLASS-03/UX-01) — reads the on-upload suggestion
            off metadata._classification (no own fetch); accept/dismiss/Undo re-fetch
            via onReconcile (not optimistic). Lifts the pending count for the badge. */}
        <PanelSection
          title="Classification"
          count={classCount ?? undefined}
        >
          <ClassificationSection
            docId={doc.id}
            suggestion={doc.metadata?._classification}
            onChanged={onReconcile}
            onTotalChange={setClassCount}
          />
        </PanelSection>
      </div>
    </div>
  )

  // Mobile (<768px): bottom-sheet (reuse the WorkspacePanel:233 shape).
  if (isMobile) {
    return (
      <aside aria-label="Document details">
        <Sheet open onOpenChange={(o) => { if (!o) onClose() }}>
          <SheetContent side="bottom" className="max-h-[80vh] p-0" hideCloseButton>
            {body}
          </SheetContent>
        </Sheet>
      </aside>
    )
  }

  // Desktop: fills the push/split grid column IngestionPage sizes (430px).
  return (
    <aside
      aria-label="Document details"
      className="flex h-full min-h-0 flex-col overflow-hidden border-l border-[hsl(var(--panel-border))] bg-[hsl(var(--panel-surface))]"
    >
      {body}
    </aside>
  )
}

/** A single metadata field row: decorative trust-gutter spine (col 1) + the value/
 *  InlineEdit + ConfidenceChip + the per-field save/error receipt. */
function FieldRowView({
  state,
  saved,
  errored,
  onCommit,
}: {
  state: FieldState
  saved: boolean
  errored: boolean
  onCommit: (field: string, value: unknown) => void
}) {
  const { row, value, score, source, empty, isLow } = state

  // Trust-gutter spine colour (decorative; the WORD in the chip carries meaning).
  const spineClass = empty
    ? "bg-border/40"
    : source === "user"
      ? "bg-primary/70"
      : isLow
        ? "bg-destructive/50"
        : typeof score === "number" && score >= 0.75
          ? "bg-[hsl(var(--panel-status-done)/0.6)]"
          : "bg-[hsl(var(--panel-status-active)/0.6)]"

  return (
    <div className="grid grid-cols-[2px_1fr] gap-3">
      {/* col 1: decorative trust-gutter spine */}
      <div aria-hidden="true" className={cn("rounded-full", spineClass)} />

      {/* col 2: label · chip · value/edit · receipt */}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-[0.06em] text-panel-muted-foreground">
            {row.label}
          </span>
          {/* No chip on an empty field (nothing was extracted to score). */}
          {!empty && <ConfidenceChip score={score} source={source} />}
        </div>

        <div
          className={cn(
            "min-w-0 text-sm text-foreground",
            // A Low value reads tentative (survives greyscale): italic + dim + ⚠.
            isLow && "flex items-start gap-1 italic text-panel-muted-foreground",
          )}
        >
          {isLow && (
            <span aria-hidden="true" className="mt-0.5 flex-none">
              ⚠
            </span>
          )}
          <InlineEdit
            field={row.key}
            fieldType={row.type}
            value={value}
            options={row.options}
            onCommit={onCommit}
          />
        </div>

        {/* Save receipt — ONLY rendered after a successful PATCH (handleCommit).
            role=status aria-live=polite; the animation is motion-safe so the
            receipt STILL renders (instantly) under prefers-reduced-motion. */}
        {saved && (
          <span
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-1 text-xs text-[hsl(var(--panel-status-done))] motion-safe:animate-fadeSlideUp"
          >
            <ShieldCheck aria-hidden="true" className="h-3 w-3" />
            Saved · audit logged
          </span>
        )}

        {/* Error receipt — the honest inverse. role=alert (assertive). */}
        {errored && (
          <span role="alert" className="text-xs text-[hsl(0_80%_80%)]">
            Couldn't save — your change wasn't recorded
          </span>
        )}
      </div>
    </div>
  )
}

export default DocumentDetailPanel
