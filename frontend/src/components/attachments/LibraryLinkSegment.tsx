/**
 * Phase 274 plan 04 (D-11 / D-13 / D-15 / D-25) — THE AFTER-MARK: this chat file is ALSO in the
 * Library, and where.
 *
 * Sketch 274 winner A: the chip gains ONE segment — green `In Library · <leaf>` with a check mark
 * when this promote saved a copy, primary `Already in Library · <leaf>` when the same bytes were
 * already there (D-13). The panel row renders the FULL path visibly (`display="path"`), because
 * the sketch's own warning is that the tooltip must never be the only home of the path; the chip's
 * `title` and accessible name carry it too.
 *
 *   · `· indexing…` while the document is `pending | processing | paused`: the row exists before
 *     search can find it (sketch finding 2).
 *   · `· couldn't index` when ingestion `failed` (D-25, net-new): never `indexing…` forever.
 *
 * Clicking opens the document through the citation navigator; with no navigator in the tree it is
 * plain text rather than a button that does nothing. Every word comes from `COPY`; folder names
 * are React text nodes only (T-274-24).
 */
import { Check, Copy as CopyGlyph } from "lucide-react"
import type { LibraryLinkInfo } from "@/lib/api/attachments"
import { useCitationNavOptional } from "@/lib/citationNav"
import { cn } from "@/lib/utils"
import { COPY } from "./saveToLibraryCopy"

export interface LibraryLinkSegmentProps {
  link: LibraryLinkInfo
  /** The folder's own name, or null when the folder is not visible. */
  leaf: string | null
  /** The full ` › `-joined path, or null when the folder is not visible. */
  path: string | null
  /** `leaf` on the chip (full path in the tooltip), `path` on the panel row (full path visible). */
  display: "leaf" | "path"
}

const INDEXING = new Set(["pending", "processing", "paused"])

export function LibraryLinkSegment({ link, leaf, path, display }: LibraryLinkSegmentProps) {
  const nav = useCitationNavOptional()
  const saved = link.outcome === "saved"
  const word = saved ? COPY.shared.inLibrary : COPY.shared.alreadyInLibrary
  const folderText = display === "path" ? (path ?? leaf) : (leaf ?? path)
  const suffix =
    link.document_status === "failed"
      ? COPY.netNew.couldntIndex
      : INDEXING.has(link.document_status)
        ? COPY.shared.indexing
        : null

  const full = [word, path ?? leaf, suffix].filter(Boolean).join(" · ")
  const className = cn(
    "inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-px text-left font-medium",
    // The panel row shows the FULL path, so it wraps rather than truncating away the part a person needs.
    display === "path" && "whitespace-normal",
    saved ? "bg-success/15 text-success" : "bg-primary/10 text-primary",
    nav && "cursor-pointer transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  )

  const body = (
    <>
      {saved ? (
        <Check className="h-3 w-3 flex-none" aria-hidden="true" />
      ) : (
        <CopyGlyph className="h-3 w-3 flex-none" aria-hidden="true" />
      )}
      <span className={display === "path" ? "min-w-0 break-words" : "min-w-0 truncate"}>
        {word}
        {folderText && ` · ${folderText}`}
      </span>
      {suffix && (
        <span className="flex-none font-mono text-[0.66rem] font-normal text-muted-foreground">{` · ${suffix}`}</span>
      )}
    </>
  )

  if (!nav) {
    // A generic span may not carry `aria-label`, so the full path is spoken from hidden text when
    // only the leaf is visible.
    return (
      <span data-testid="library-link-segment" data-outcome={link.outcome} title={path ?? undefined} className={className}>
        {body}
        {display === "leaf" && path && path !== leaf && <span className="sr-only">{` (${path})`}</span>}
      </span>
    )
  }

  return (
    <button
      type="button"
      data-testid="library-link-segment"
      data-outcome={link.outcome}
      title={path ?? undefined}
      aria-label={full}
      onClick={(e) => {
        e.stopPropagation()
        nav.openDocument(link.document_id)
      }}
      className={className}
    >
      {body}
    </button>
  )
}

export default LibraryLinkSegment
