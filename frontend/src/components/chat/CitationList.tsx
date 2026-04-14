import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { CitationCard } from "./CitationCard"
import type { Citation } from "@/types"

interface Props {
  citations: Citation[]
}

export function CitationList({ citations }: Props) {
  const [open, setOpen] = useState(false)
  if (!citations.length) return null

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {citations.length} source{citations.length !== 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {citations.map((c, i) => (
            <CitationCard
              key={`${c.document_id}-${c.chunk_index ?? "full"}-${i}`}
              citation={c}
            />
          ))}
        </div>
      )}
    </div>
  )
}
