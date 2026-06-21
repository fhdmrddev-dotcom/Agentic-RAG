/**
 * Phase 119 Plan 02 Task 1 — GovernanceRow (the DGOV-02 link-out-only row).
 *
 * Clones ONLY the row chrome from HealthDocumentRow (file icon + truncated
 * filename + a metric chip slot). It is read-only by construction (D-119-6): it
 * ships no inline delete / re-ingest / move controls and imports none of the
 * document-mutation client helpers or the move dialog — the WHOLE row is a single
 * link-out that calls onOpen(docId). Governance navigates; it never mutates (the
 * fix actions live in the document's DocumentDetailPanel sections).
 *
 * a11y: the row is a real <button> (keyboard-operable + focus-visible), with an
 * aria-label naming the document and the navigate intent. When docId is null
 * (a broken edge whose openable end is gone) the row renders disabled — there is
 * nothing to open.
 */
import { getFileIcon } from "@/lib/fileIcons"
import { cn } from "@/lib/utils"

interface Props {
  /** The document to open on click. Null = nothing openable (e.g. a broken edge
   *  whose surviving end is also gone) → the row is disabled. */
  docId: string | null
  filename: string
  /** Optional metric chip (e.g. the low-confidence ConfidenceChip or a suggested-folder hint). */
  chip?: React.ReactNode
  onOpen: (id: string) => void
}

export function GovernanceRow({ docId, filename, chip, onOpen }: Props) {
  const disabled = docId === null
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (docId !== null) onOpen(docId)
      }}
      aria-label={disabled ? `${filename} — no document to open` : `Open ${filename}`}
      className={cn(
        "group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted/20 cursor-pointer",
      )}
    >
      <span className="shrink-0">{getFileIcon(filename)}</span>
      <span className="text-sm font-medium truncate flex-1">{filename}</span>
      {chip}
    </button>
  )
}
