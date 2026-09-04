import { useState } from "react"
import { CitationCard } from "./CitationCard"
import type { Citation } from "@/types"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { FoldTrigger } from "./FoldTrigger"

interface Props {
  citations: Citation[]
  /**
   * ⚠ SUPERSEDED 2026-09-03 (BUG-260902-07, Phase 224-05). The struck contract is kept
   * because it was DELIBERATE, not an oversight, and a later phase must not "restore" it.
   *
   * ~~Canonical open-by-default contract (D-06/D-07): `true` when the settled message has
   * ≥1 valid in-range inline marker, so the footer opens by default.~~
   *
   * Phase 153 paired numbered markers with an open footer so the two read as one object.
   * Measured 2026-09-02: a grounded answer normally HAS markers, so in ordinary use the
   * footer was open EVERY time and the collapsed state only ever appeared on the degraded
   * path — the operator's report was *"the sources should be by default folded ... this is
   * very bad user experience."* The producer now passes `false` unconditionally. The 153-05 producer (MessageItem) passes
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
      {/* Phase 224-05 (BUG-260902-07, second half): the trigger was `text-xs
          text-muted-foreground` + a bare 12px chevron — the lowest-contrast text in the
          message, sitting directly under body copy, so it read as a trailing sentence
          rather than a control. It now mounts the SHARED FoldTrigger, the same element
          the RunCard Thinking fold uses.
          ⚠ THE COPY IS UNCHANGED, AND THAT IS DELIBERATE. A first pass here rendered
          `References` + a mono count chip and broke three Phase 153 tests that pin the
          pluralized sentence. Those tests were RIGHT: the reported bug is the AFFORDANCE
          (`buried within the text and not highlighted`), not the wording, and swapping
          plain language for a chip is scope this bug never asked for. The full sentence
          rides in as the label, so the count stays visible while CLOSED — hiding how many
          sources there are would be a worse bug than the one being fixed. */}
      <CollapsibleTrigger asChild>
        <button aria-expanded={open}>
          <FoldTrigger open={open} label={`References · ${count} source${count !== 1 ? "s" : ""}`} />
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
