/**
 * Phase 268 (UI-SPEC §5.8) — two Blind Spots tiles about ATTRIBUTION, mounted into the shipped
 * `BlindSpotsCard` grid.
 *
 *   1. D-268-09: sub-agent tokens now roll up into their root, so org totals read HIGHER than
 *      they did before Phase 268. That rise is disclosed here, never slipped in silently.
 *   2. D-268-11: the "New chat with an Expert" handoff summary is one model call that is not a
 *      run, so its tokens are in no total on the page. Disclosed, not metered.
 *
 * ⛔ Neither tile has a button: no ledger filter lands on either population (the shipped CR-06
 * "no button, deliberately" rule). Light-theme contract (§4.3): hue steps are light/dark PAIRS on
 * one line — `expertThemeContrast.test.tsx` fences this file.
 */
import React from "react"
import { GitMerge, MessageSquareDashed } from "lucide-react"
import { EXPERT_SPEND_COPY as C } from "./expertSpendCopy"

const TILE = "rounded-lg bg-card/60 p-3 border border-border/50 flex flex-col justify-between gap-3"

export const AttributionDisclosures: React.FC = () => (
  <>
    <div className={TILE} data-testid="blind-spot-subagent">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <GitMerge className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          <span>{C.subagentTile.title}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{C.subagentTile.body}</p>
      </div>
      <span className="text-[11px] text-muted-foreground">{C.subagentTile.footer}</span>
    </div>

    <div className={TILE} data-testid="blind-spot-handoff">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <MessageSquareDashed className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span>{C.handoffTile.title}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{C.handoffTile.body}</p>
      </div>
      <span className="text-[11px] text-amber-700 dark:text-amber-300">{C.handoffTile.footer}</span>
    </div>
  </>
)
