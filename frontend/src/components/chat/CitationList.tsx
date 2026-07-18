import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { CitationCard } from "./CitationCard"
import type { Citation } from "@/types"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface Props {
  citations: Citation[]
  /**
   * Canonical open-by-default contract (D-06/D-07): `true` when the settled
   * message has ≥1 valid in-range inline marker, so the footer opens by default;
   * `false` (the default) preserves today's collapsed behavior for the
   * footer-only / no-marker degradation. The 153-05 producer (MessageItem) passes
   * this SAME prop name — it is the ONE canonical open-state prop (no alias).
   */
  defaultOpen?: boolean
  /**
   * Optional container scoping the row→marker flash to a single message's marker
   * host (threaded to each row; the 153-05 producer supplies it). Defaults to
   * document scope inside `flashCitationMarker`.
   */
  flashContainer?: ParentNode | null
}

export function CitationList({ citations, defaultOpen = false, flashContainer }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  if (!citations.length) return null

  const count = citations.length

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
          References · {count} source{count !== 1 ? "s" : ""}
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
              n={i + 1}
              flashContainer={flashContainer}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
