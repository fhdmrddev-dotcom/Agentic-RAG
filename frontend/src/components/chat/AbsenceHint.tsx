/**
 * Phase 153 Plan 05 (CITE-01) — the absence-as-signal ⓘ (074-A; tiered-guidance
 * rule #13). A quiet, NON-BLOCKING affordance under a cited answer that teaches
 * the honesty contract: unmarked prose reads as the model's general knowledge,
 * only retrieved claims carry a citation. It is deliberately NOT a banner — no
 * `role="alert"`/`role="banner"`, no always-open block, no modal/focus-trap — it
 * is one inline row + a keyboard-reachable ⓘ that reveals the teaching copy via
 * the EXISTING Radix tooltip primitive (no new package).
 *
 * Self-guards to cited messages: returns null when the message has no citations
 * (parity with the marker/footer render condition) — MessageItem mounts it once
 * under the answer body on the settled cited-assistant branch only (G-5 additive).
 *
 * Copy is the VERBATIM UI-SPEC §Copywriting contract (static strings — no model
 * or user input flows in, so there is no injection surface). Color honors UI-SPEC
 * §Color rule #6: the ⓘ dot rests dim and brightens to `--primary` on hover/focus;
 * the meaningful inline label uses `--muted-foreground` (AA) — the dim token is
 * reserved for the ⓘ dot rest state alone, never for the label or body text.
 */
import { Info } from "lucide-react"
import type { Citation } from "@/types"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface Props {
  /** The message's citation set. When empty/absent, the hint renders nothing. */
  citations?: Citation[] | null
}

export function AbsenceHint({ citations }: Props) {
  // Self-guard → parity with the marker/footer condition (the ⓘ teaches
  // absence-as-signal precisely when markers may be present).
  if (!citations?.length) return null

  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Icon-only trigger → MUST carry an accessible name. The dot rests dim
              and brightens to --primary on hover/focus (UI-SPEC §Color rule #6). */}
          <button
            type="button"
            aria-label="About citations"
            className="inline-flex shrink-0 items-center rounded text-[hsl(var(--muted-foreground-dim))] transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        {/* Non-blocking, keyboard-reachable, never a banner by construction. */}
        <TooltipContent side="top" className="max-w-xs text-xs font-normal leading-relaxed">
          <p>
            <span className="font-semibold">Unmarked sentences are the model's general knowledge.</span> Only claims grounded in what the agent retrieved this run carry a citation. No citation = not from your documents.
          </p>
        </TooltipContent>
      </Tooltip>
      <span>Unmarked claims read as general knowledge</span>
    </div>
  )
}
