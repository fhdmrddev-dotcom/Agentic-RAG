/**
 * Phase 235 plan 09 (SURF-03 · D-235-04) — THE BADGE POPOVER. It is a DOOR.
 *
 * ── ⛔ IT CARRIES NO REPAIR CONTROL, IN EITHER SKETCH VARIANT ─────────────────────────
 *
 * The sketch's FIRST variant fork was fix-in-popover versus fix-on-card, and it was measured
 * UNFEELABLE: the two variants differed by 248 characters out of ~30,000, and the landing
 * screens were pixel-identical. The operator saw no difference and was right. It was settled
 * BY RULE instead — the fix keeps ONE home, on the source card, the same rule that put the run
 * history on the card and kept it out of Health (D-235-17). A second repair site buys two
 * clicks and costs the rule that decided every other placement in this phase.
 *
 * So this component names what is broken and leads to the place that explains it. The Health
 * row is where the person is offered the hop to the source. `NavPanel.badge.test.tsx` asserts
 * the absence of a repair control NEGATIVELY and BY NAME, because an absence nobody tested is
 * an absence that comes back.
 *
 * ── ⛔ NO URL, EVER (SEED-185) ────────────────────────────────────────────────────────
 *
 * Twelve views, zero addressable. The single action is a callback threaded from `App` through
 * `ChatLayout`; there is no location assignment and no hash in this file.
 *
 * ── ⚠ EVERY STRING COMES FROM THE VOCABULARY LEAF ─────────────────────────────────────
 *
 * This component writes no copy. `sourceHealthVocabulary` owns the words; the cause sentences
 * arrive already resolved on each condition.
 *
 * ── THE PRIMITIVE ─────────────────────────────────────────────────────────────────────
 *
 * The shipped shadcn dropdown (Radix Menu) — the SAME primitive `ProfileMenu` uses for the
 * other rail-anchored popover. ⛔ No package is installed by this plan (T-235-SC); there is no
 * `@radix-ui/react-popover` in this repo and adding one to draw a five-line panel would be a
 * dependency bought for nothing.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { COPY } from "@/components/sources/sourceHealthVocabulary"

import type { AttentionCondition } from "./attentionConditions"

interface Props {
  /** The conditions the shell resolved. Empty means this component renders nothing at all. */
  conditions: readonly AttentionCondition[]
  /** The one action: go to the place that explains it. A callback, never a location. */
  onOpenLibraryHealth: () => void
}

/**
 * ⚠ THE TRIGGER IS A SEPARATE CONTROL, NOT THE RAIL ITEM AND NOT THE BADGE SPAN.
 *
 * `RailItem` renders a `button` carrying `aria-label={label}`, and the decorative count lives
 * INSIDE it (`aria-hidden`, so the Library control is still named "Library"). A trigger nested
 * in that button would be invalid markup and would also navigate on click. So the trigger is a
 * sibling inside the rail item's `relative` wrapper, sized and positioned over the badge: the
 * count is what a person SEES, this is what they click and what a screen reader announces —
 * with the vocabulary's own sentence as its name.
 */
export function AttentionPopover({ conditions, onOpenLibraryHealth }: Props) {
  // Nothing is wrong → nothing renders. No empty shell, no all-clear chrome, no reserved space.
  if (conditions.length === 0) return null

  const label = COPY.badgeTitle(conditions.length)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          data-testid="rail-attention-trigger"
          className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/60"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={8}
        data-testid="rail-popover"
        className="w-72"
      >
        <DropdownMenuLabel>{COPY.popTitle}</DropdownMenuLabel>
        {conditions.map((condition) => (
          <div key={condition.id} data-testid="rail-pop-item" className="px-2 py-1.5">
            <div className="text-sm font-medium text-foreground">{condition.title}</div>
            <div className="text-xs text-muted-foreground">{condition.detail}</div>
          </div>
        ))}
        <DropdownMenuSeparator />
        {/* ⛔ THE ONLY CONTROL IN HERE. A plain button rather than a menu item, so it is
            reachable as a `button` by name — the shape the popover's contract asserts. */}
        <button
          type="button"
          data-testid="rail-open-health"
          onClick={onOpenLibraryHealth}
          className="w-full text-left text-sm rounded-sm px-2 py-1.5 text-primary hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {COPY.popOpenHealth}
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
