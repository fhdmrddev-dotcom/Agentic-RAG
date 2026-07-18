import { useEffect, useRef, useState } from "react"
import { ArrowUpRight, ChevronDown, ChevronRight, FileText, FileCode } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Citation } from "@/types"
import {
  useCitationNavOptional,
  flashCitationMarker,
  CITATION_ROW_ATTR,
} from "@/lib/citationNav"

interface Props {
  citation: Citation
  /**
   * 1-based footer number, shared 1:1 with the inline marker (D-03). The backend
   * is the single source of numbering truth; `n` is threaded from `CitationList`
   * as `i + 1` over the finalized `citations` order. When omitted the card renders
   * in its legacy un-numbered form (isolated hosts / back-compat).
   */
  n?: number
  /**
   * Optional container scoping the row→marker flash to a single message's marker
   * host (passed by the 153-05 producer). Defaults to document scope — a
   * missing/invalid target is a no-op inside `flashCitationMarker`.
   */
  flashContainer?: ParentNode | null
}

function getFileType(filename: string): "pdf" | "docx" | "md" | "default" {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  if (ext === "pdf") return "pdf"
  if (ext === "docx" || ext === "doc") return "docx"
  if (ext === "md" || ext === "markdown") return "md"
  return "default"
}

function getAccentClasses(fileType: "pdf" | "docx" | "md" | "default") {
  switch (fileType) {
    case "pdf":
      return { gradient: "from-red-400/60 to-transparent", iconColor: "text-red-400" }
    case "docx":
      return { gradient: "from-blue-400/60 to-transparent", iconColor: "text-blue-400" }
    case "md":
      return { gradient: "from-purple-400/60 to-transparent", iconColor: "text-purple-400" }
    default:
      return { gradient: "from-muted-foreground/30 to-transparent", iconColor: "text-muted-foreground" }
  }
}

export function CitationCard({ citation, n, flashContainer }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [active, setActive] = useState(false)
  const activeTimer = useRef<number | null>(null)
  const nav = useCitationNavOptional()
  const hasPassage = !!citation.passage
  const fileType = getFileType(citation.filename)
  const { gradient, iconColor } = getAccentClasses(fileType)

  useEffect(
    () => () => {
      if (activeTimer.current) window.clearTimeout(activeTimer.current)
    },
    [],
  )

  // Row→marker direction (bidirectional flash contract, 153-02): activating the
  // row blooms its in-text marker and transiently marks the row aria-current.
  const handleRowActivate = () => {
    if (n == null) return
    flashCitationMarker(n, flashContainer)
    setActive(true)
    if (activeTimer.current) window.clearTimeout(activeTimer.current)
    activeTimer.current = window.setTimeout(() => setActive(false), 1700)
  }

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleRowActivate()
    }
  }

  // Location text mirrors the visual location line for the row's accessible name.
  const locationText = citation.is_full_doc
    ? ", full document"
    : citation.chunk_index != null
      ? `, chunk ${citation.chunk_index + 1}`
      : ""
  const rowAriaLabel = n != null ? `Citation ${n}: ${citation.filename}${locationText}` : undefined

  return (
    <div
      className={cn(
        "citation-ref-row flex gap-0 bg-muted/30 rounded-r-md py-2 text-xs transition-colors",
        n != null && "cursor-pointer hover:bg-accent",
      )}
      role={n != null ? "button" : undefined}
      tabIndex={n != null ? 0 : undefined}
      aria-label={rowAriaLabel}
      aria-current={n != null && active ? "true" : undefined}
      onClick={n != null ? handleRowActivate : undefined}
      onKeyDown={n != null ? handleRowKeyDown : undefined}
      {...(n != null ? { [CITATION_ROW_ATTR]: n } : {})}
    >
      {/* Gradient left-accent strip per D-01, D-02 */}
      <div className={cn("w-0.5 self-stretch rounded-l-sm flex-shrink-0 bg-gradient-to-b", gradient)} />
      {/* Card content */}
      <div className="pl-3 flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
          {/* [n] number — mono, 600, --primary (accent reserved), keyed 1:1 to the marker (D-03) */}
          {n != null && (
            <span className="font-mono font-semibold text-primary shrink-0" aria-hidden="true">
              [{n}]
            </span>
          )}
          {fileType === "md"
            ? <FileCode className={cn("w-3 h-3 flex-shrink-0", iconColor)} />
            : <FileText className={cn("w-3 h-3 flex-shrink-0", iconColor)} />
          }
          <span className="truncate">
            {citation.filename}
            {citation.version_number != null && citation.version_number > 1
              ? ` (v${citation.version_number})`
              : ""}
          </span>
          {/* Location — reuse the existing is_full_doc branch (D-09/D-10): a full-doc
              row shows "· Full document" with NO chunk index and NO similarity score;
              a chunk row shows "· Chunk N · {similarity}". */}
          <span className="text-muted-foreground shrink-0 inline-flex items-center gap-1">
            {citation.is_full_doc ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Full document</span>
              </>
            ) : citation.chunk_index != null ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Chunk {citation.chunk_index + 1}</span>
                {citation.similarity != null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{citation.similarity.toFixed(2)}</span>
                  </>
                )}
              </>
            ) : null}
          </span>
          {/* Open document — owner/RLS-scoped cross-view nav (T-153-03-02); the only
              other --primary-reserved element on the row besides [n]. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              nav?.openDocument(citation.document_id)
            }}
            className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-primary hover:underline transition-colors"
          >
            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
            Open document
          </button>
        </div>
        {/* Passage */}
        {hasPassage && (
          <div className="mt-1.5">
            <p
              className={cn(
                "text-muted-foreground italic leading-relaxed",
                !expanded && "line-clamp-2"
              )}
            >
              {citation.passage}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
              aria-expanded={expanded}
              aria-label={expanded ? "Show less" : "Show more"}
              className="flex items-center gap-1 mt-1 text-muted-foreground hover:text-muted-foreground transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronDown className="w-3 h-3" /> Show less
                </>
              ) : (
                <>
                  <ChevronRight className="w-3 h-3" /> Show more
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
