/**
 * Phase 301-03 (NOTE-01 · D-01, D-02, D-03; UI-SPEC S1, S3) — the "Waiting on you" control: on the
 * 58px rail directly under New chat (variant "rail"), and as a row in the phone's drawer (variant
 * "drawer"). Both open the same list (`WaitingOnYouList`).
 *
 * ⛔ PRESENTATIONAL. It fetches nothing and subscribes to nothing; the shell's one read
 *   (`useWaitingRunConditions`, via ChatLayout's producers) hands it the conditions and the status.
 * ⛔ It never changes the active org. A row calls its own onOpen (→ openRun), and 299's LinkGate
 *   handles a run in another org (D-08).
 * ⛔ ALWAYS PRESENT (D-01): it renders at zero, while loading and after a failure — only the pill
 *   comes and goes, and the pill shows only an ANSWERED total above 0 (never a 0, never while
 *   loading, never dropped by a failed refresh that followed a real count — D-17).
 * ⚠ The pill is the server's TOTAL (it can exceed the rows returned), never the row count (UI-D6).
 * ⚠ The icon is not tinted amber (UI-D3): in the light theme amber text on the sidebar is under
 *   3:1. The amber pill is the only signal, exactly like the Library item.
 */
import { Hourglass } from "lucide-react"

import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { waitingTotal, type WaitingCondition, type WaitingStatus } from "./attentionConditions"
import { WaitingOnYouList } from "./WaitingOnYouList"
import { WAITING_COPY, countSentence, pillText } from "./waitingVocabulary"

interface Props {
  variant: "rail" | "drawer"
  /** The rail's width (rail variant only). */
  expanded?: boolean
  conditions: readonly WaitingCondition[]
  /** Omitted → rows mean answered, none means still loading. */
  status?: WaitingStatus
  /** Called when a row is selected (the drawer closes itself). */
  onAfterSelect?: () => void
}

// The Library badge's class string (NavPanel.tsx), verbatim, so the two marks read as one family.
const PILL =
  "min-w-[18px] h-[18px] px-1 rounded-full bg-warning text-warning-foreground text-[10px] font-bold leading-[18px] text-center"

export function WaitingOnYouControl({ variant, expanded = false, conditions, status, onAfterSelect }: Props) {
  const effective: WaitingStatus = status ?? (conditions.length > 0 ? "answered" : "loading")
  const total = waitingTotal(conditions)
  const counted = (effective === "answered" || effective === "stale") && total > 0
  const name = countSentence(counted ? total : null)

  if (variant === "drawer") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={name}
            data-testid="drawer-waiting-row"
            className={cn(
              "w-full min-h-11 flex items-center gap-2 px-4 rounded-lg text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              counted && "bg-warning/10",
            )}
          >
            <Hourglass className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span>{WAITING_COPY.label}</span>
            {counted && (
              <span aria-hidden="true" className={cn(PILL, "ml-auto")}>
                {pillText(total)}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <WaitingOnYouList
          conditions={conditions}
          total={total}
          status={effective}
          side="bottom"
          align="start"
          sideOffset={4}
          className="w-[min(320px,calc(100vw-32px))]"
          onAfterSelect={onAfterSelect}
        />
      </DropdownMenu>
    )
  }

  const button = (
    <button
      type="button"
      aria-label={name}
      data-testid="rail-waiting-trigger"
      className={cn(
        // RailItem's geometry (NavPanel.tsx), verbatim, so it lines up with New chat and the nav.
        "relative flex items-center h-10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        expanded ? "w-full justify-start gap-3 px-3" : "w-10 justify-center",
        "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 data-[state=open]:bg-accent/40 data-[state=open]:text-sidebar-foreground",
      )}
    >
      <Hourglass className="w-5 h-5 shrink-0" aria-hidden="true" />
      {expanded && <span className="text-sm font-medium truncate">{WAITING_COPY.label}</span>}
      {counted && (
        <span
          data-testid="rail-waiting-badge"
          aria-hidden="true"
          className={cn("absolute", PILL, expanded ? "right-3 top-1/2 -translate-y-1/2" : "-top-1 -right-1")}
        >
          {pillText(total)}
        </span>
      )}
    </button>
  )

  return (
    <DropdownMenu>
      {expanded ? (
        <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
      ) : (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            {name}
          </TooltipContent>
        </Tooltip>
      )}
      <WaitingOnYouList
        conditions={conditions}
        total={total}
        status={effective}
        side="right"
        align="start"
        sideOffset={8}
        onAfterSelect={onAfterSelect}
      />
    </DropdownMenu>
  )
}
