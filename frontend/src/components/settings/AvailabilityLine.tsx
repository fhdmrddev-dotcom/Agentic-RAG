/**
 * Phase 221 plan 02 (D-221-04) — one line saying what will not work, and what to do.
 *
 * ⚠ **A `ready` APPLICATION RENDERS NOTHING — `null`, not an empty element.** Silence is
 * the healthy state. The 2026-08-31 noise audit deleted twelve items that each said
 * nothing; six availability lines all reading "fine" would put them straight back. The
 * suite asserts the element is ABSENT (query returns null), never that it is empty, because
 * an empty element still occupies a row and still costs a reader a glance.
 *
 * ⚠ **THE LINK IS RENDERED ONLY WHERE A DESTINATION HELPS.** `api_off` gets an anchor to
 * the Google Cloud console — the exact page that switches that API on. `scope_missing` gets
 * a sentence and no anchor, because the console cannot grant a scope and a link there would
 * be a confident wrong answer.
 *
 * ⚠ **`unknown` NEVER SAYS "switched off".** Not knowing is not a fact about somebody's
 * Cloud project, and rendering it as one is the refusal-names-the-wrong-cause defect that
 * this whole phase exists to remove.
 */

import { cn } from "@/lib/utils"
import type { ApplicationAvailability } from "./applicationAvailability"

export interface AvailabilityLineProps {
  availability: ApplicationAvailability | null | undefined
}

/** `api_off` and `scope_missing` are things to fix; `unknown` is merely not known. The
 *  first two earn the warning colour, the third stays quiet — a muted line for a muted
 *  claim. */
const TONE: Record<string, string> = {
  api_off: "text-amber-600 dark:text-amber-500",
  scope_missing: "text-amber-600 dark:text-amber-500",
  unknown: "text-muted-foreground",
}

export function AvailabilityLine({ availability }: AvailabilityLineProps) {
  // ⚠ Both arms return null, and they are separate on purpose: `ready` is "measured and
  // fine", absent is "not measured". Neither renders, but conflating them in the source
  // would invite a future author to render one of them.
  if (!availability) return null
  if (availability.state === "ready" || !availability.remedy) return null

  const { sentence, action } = availability.remedy

  return (
    <div
      data-testid={`application-availability-${availability.app}`}
      data-state={availability.state}
      className={cn(
        "flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 border-t border-border bg-muted/30 px-2.5 py-1.5 text-[11px] leading-snug",
        TONE[availability.state] ?? "text-muted-foreground",
      )}
    >
      <span data-testid={`availability-sentence-${availability.app}`}>{sentence}</span>
      {action.href ? (
        <a
          data-testid={`availability-link-${availability.app}`}
          href={action.href}
          target="_blank"
          // ⚠ `noopener` is the security half and is not optional on a `_blank` link to a
          // vendor page; `noreferrer` keeps our URL out of their logs.
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {action.label} ↗
        </a>
      ) : (
        <span className="font-medium">{action.label}</span>
      )}
    </div>
  )
}

export default AvailabilityLine
