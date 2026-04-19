import { useState } from "react"
import { ChevronDown, ChevronRight, FileText, FileCode } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Citation } from "@/types"

interface Props {
  citation: Citation
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

export function CitationCard({ citation }: Props) {
  const [expanded, setExpanded] = useState(false)
  const hasPassage = !!citation.passage
  const fileType = getFileType(citation.filename)
  const { gradient, iconColor } = getAccentClasses(fileType)

  return (
    <div className="flex gap-0 bg-muted/30 rounded-r-md py-2 text-xs">
      {/* Gradient left-accent strip per D-01, D-02 */}
      <div className={cn("w-0.5 self-stretch rounded-l-sm flex-shrink-0 bg-gradient-to-b", gradient)} />
      {/* Card content */}
      <div className="pl-3 flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
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
    </div>
  )
}
