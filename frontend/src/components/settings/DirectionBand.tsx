/**
 * Phase 221 (D-221-03) — the direction band. A label and a count.
 *
 * ⛔ **THIS COMPONENT RENDERS NOTHING INTERACTIVE, AND THAT IS A SAFETY PROPERTY RATHER
 * THAN A LAYOUT CHOICE.** Read this before adding anything to it.
 *
 * The reference design the operator brought — Claude.ai's connector screen — puts a
 * connection-style `Needs approval` dropdown on EVERY group it draws, including
 * *Read-only tools · 22*. One click there sets twenty-two grants at once, keyed on
 * direction. Our ROADMAP forbids exactly that, in these words:
 *
 *   > "Two gates, and they must differ: grant-time (per-tool, human, once) is where the
 *   > industry approves a read; run-time (D-19, armed) is ours and is stricter than any
 *   > engine studied. **The run-time gate may key on direction; the grant-time gate must
 *   > NOT**, because a read is exactly where prompt injection enters."
 *
 * A poisoned search result is the attack. *Allow all reads* is its front door. So the band
 * GROUPS AND COUNTS; the bulk posture control lives one level up on the APPLICATION, where
 * the axis is the product and not the direction.
 *
 * ⚠ `DirectionBand.contract.test.tsx` asserts zero `button`, zero `[role="group"]` and zero
 * `[aria-pressed]` in this component's output. That assertion was DRIVEN RED against a
 * planted posture control and restored — a guard nobody has seen fire is not a guard.
 *
 * ⚠ It is also never rendered speculatively: `toolGroups.ts` returns `bands: null` both
 * when a direction is unknown (D-221-11) and when an application has only one direction,
 * because a lone band over every action in a group distinguishes nothing.
 */

import { cn } from "@/lib/utils"
import { GRANTS_COPY } from "./grantsVocabulary"
import type { Direction } from "./toolGroups"

export interface DirectionBandProps {
  direction: Direction
  count: number
  /** True when this band sits at the top of a single-application connector, where there is
   *  no application header above it to separate it from the card edge (D-221-09). */
  flush?: boolean
}

export function DirectionBand({ direction, count, flush = false }: DirectionBandProps) {
  const isWrite = direction === "write"
  return (
    <div
      data-testid={`direction-band-${direction}`}
      data-direction={direction}
      className={cn(
        "flex items-center gap-2 bg-muted/50 px-2.5 py-1.5",
        !flush && "border-t border-border",
      )}
    >
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wider",
          isWrite ? "text-warning" : "text-muted-foreground",
        )}
      >
        {isWrite ? GRANTS_COPY.BAND_CHANGES : GRANTS_COPY.BAND_READS}
      </span>
      <span
        data-testid={`direction-band-count-${direction}`}
        className="text-[10px] tabular-nums text-muted-foreground/80"
      >
        {count}
      </span>
    </div>
  )
}

export default DirectionBand
