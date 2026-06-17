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
import { ConfidenceChip } from "./ConfidenceChip"
import { InlineEdit, type InlineFieldType } from "./InlineEdit"
import { updateDocumentMetadata, listMetadataFields } from "@/lib/api"
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

/** The D-05 display tiers (mirror ConfidenceChip's hardcoded TIER). Used only to
 *  count LOW fields for the PanelSection warn badge + the tentative-value styling.
 *  NOT the retrieval confidence_bucket (0.54/0.38) — a different system. */
const LOW_TIER = 0.5

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

      {/* Sections — ONLY Metadata this phase (117/118 add theirs to this shell). */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PanelSection
          title="Metadata"
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
      </div>
    </div>
  )

  // Mobile (<768px): bottom-sheet (reuse the WorkspacePanel:233 shape).
  if (isMobile) {
    return (
      <aside role="complementary" aria-label="Document details">
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
      role="complementary"
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
