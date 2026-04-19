import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { CitationCard } from "./CitationCard"
import type { Citation } from "@/types"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface Props {
  citations: Citation[]
}

export function CitationList({ citations }: Props) {
  const [open, setOpen] = useState(false)
  if (!citations.length) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
      <CollapsibleTrigger asChild>
        <button
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
      </CollapsibleTrigger>
      <CollapsibleContent
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-top-1 data-[state=closed]:slide-out-to-top-1 duration-200 ease-in-out"
      >
        <div className="mt-2 flex flex-col gap-2">
          {citations.map((c, i) => (
            <CitationCard
              key={`${c.document_id}-${c.chunk_index ?? "full"}-${i}`}
              citation={c}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
