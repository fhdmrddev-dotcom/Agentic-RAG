import { useState } from "react"
import { ChevronDown, ChevronRight, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Citation } from "@/types"

interface Props {
  citation: Citation
}

export function CitationCard({ citation }: Props) {
  const [expanded, setExpanded] = useState(false)
  const hasPassage = !!citation.passage

  return (
    <div className="border-l-2 border-muted-foreground/30 pl-3 bg-muted/30 rounded-r-md py-2 text-xs">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
        <FileText className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{citation.filename}</span>
        <span className="text-muted-foreground/50 shrink-0">
          {citation.is_full_doc
            ? "Full document"
            : citation.chunk_index != null
              ? `Chunk ${citation.chunk_index + 1}`
              : ""}
        </span>
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
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? "Show less" : "Show more"}
            className="flex items-center gap-1 mt-1 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
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
  )
}
