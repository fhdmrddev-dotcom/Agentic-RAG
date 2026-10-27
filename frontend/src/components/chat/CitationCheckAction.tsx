/**
 * Phase 294-05 (DEC-03, D-13, D-16, D-17, D-20a) — the citation-check action in the References
 * footer header (sketch 294 A).
 *
 * States, in order of precedence:
 *   · availability not known yet           → nothing (no flash of a button that may not apply)
 *   · a check is running                   → "Checking N citations…" (disabled)
 *   · a stored result                      → one count pill per non-zero verdict + Re-check, and
 *                                            "checked by <engine> · saved with this answer · <time>"
 *   · available, nothing stored            → "Check citations · <engine>"
 *   · unavailable                          → the ⓘ reason line instead of the button (D-16);
 *                                            stored pills still render above it
 *   · a failed POST                        → one fixed line; stored pills stay (D-17)
 *
 * It reads ONLY the citation-check store, and asks for this message's stored check once, on
 * mount, through the store's batched `ensure` (one GET per thread view, T-294-28). Nothing here
 * runs a check except the click (D-13). Mounted by `CitationList` as a SIBLING of the fold
 * trigger, never inside it, so there is no nested button and it is visible while folded.
 */
import { useEffect, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useCitationCheck, useCitationCheckStore } from "@/stores/citationCheckStore"
import { engineFor } from "@/components/settings/rerankEngines"
import { relativeBand } from "@/components/workflows/library/relativeChanged"
import {
  VERDICT_META,
  VERDICT_ORDER,
  availabilityReason,
  checkErrorLine,
} from "./citationVerdicts"

interface Props {
  messageId: string
  /** The answer's source count (`citations.length`), for "Checking N sources…". */
  citationCount: number
}

const BUTTON_CLASSES =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-0.5 text-xs text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-default disabled:opacity-60 disabled:hover:border-border disabled:hover:text-foreground"

export function CitationCheckAction({ messageId, citationCount }: Props) {
  const availability = useCitationCheckStore((s) => s.availability)
  const inFlight = useCitationCheckStore((s) => s.inFlight[messageId] === true)
  const errorCode = useCitationCheckStore((s) => s.errors[messageId] ?? null)
  const ensure = useCitationCheckStore((s) => s.ensure)
  const run = useCitationCheckStore((s) => s.run)
  const result = useCitationCheck(messageId)

  useEffect(() => {
    ensure(messageId)
  }, [ensure, messageId])

  if (!availability) return null

  const reasonLine = availabilityReason(availability)
  const when = result ? relativeBand(result.checked_at) : null

  let control: ReactNode
  if (inFlight) {
    control = (
      <button type="button" disabled className={BUTTON_CLASSES}>
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none"
        />
        {/* 296-04 (294-IN-08): the count is the answer's sources, so the word is "source". */}
        Checking {citationCount} source{citationCount !== 1 ? "s" : ""}…
      </button>
    )
  } else if (reasonLine) {
    control = (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span aria-hidden="true">ⓘ</span>
        <span>{reasonLine}</span>
      </span>
    )
  } else if (result) {
    control = (
      <button type="button" className={BUTTON_CLASSES} onClick={() => void run(messageId)}>
        Re-check
      </button>
    )
  } else {
    control = (
      <button type="button" className={BUTTON_CLASSES} onClick={() => void run(messageId)}>
        Check citations{" "}
        <span className="text-muted-foreground">· {engineFor(availability.engine)?.shortName ?? availability.engine}</span>
      </button>
    )
  }

  return (
    <div data-testid="citation-check-action" className="ml-auto flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {result &&
          VERDICT_ORDER.filter((v) => result.counts[v] > 0).map((v) => {
            const meta = VERDICT_META[v]
            return (
              <span
                key={v}
                data-testid="citation-verdict-pill"
                data-verdict={v}
                className={cn("rounded-full px-2 py-px font-mono text-[10px] tabular-nums", meta.pillClass)}
              >
                <span aria-hidden="true">{meta.glyph}</span> {result.counts[v]} {meta.word.toLowerCase()}
              </span>
            )
          })}
        {control}
      </div>
      {result && (
        <span className="font-mono text-[10px] text-muted-foreground">
          checked by {engineFor(result.engine)?.shortName ?? result.engine} · saved with this answer
          {when ? ` · ${when}` : ""}
        </span>
      )}
      {errorCode && !inFlight && (
        <span role="status" className="text-xs text-[hsl(0_80%_80%)]">
          {checkErrorLine(errorCode, availability)}
        </span>
      )}
    </div>
  )
}
