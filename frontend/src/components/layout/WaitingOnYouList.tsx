/**
 * Phase 301-03 (NOTE-01 / NOTE-05 · D-05..D-10, D-17, D-28, D-29; UI-SPEC S2) — the list the
 * "Waiting on you" control opens: every run waiting on this person, waited longest first, one row
 * each naming the workflow, the org, what is needed and how long it has waited.
 *
 * A SIBLING of `AttentionPopover`, never a branch inside it: the Library popover is a door to
 * Library health, this list is a door to runs, and the two marks never merge (D-12).
 *
 * ⛔ Rows are DropdownMenuItems (UI-D1). Radix Menu cancels Tab inside its content, so a plain
 *   button here could not be reached from the keyboard; a menu item is reached with arrow keys,
 *   Home/End and typeahead, and activates on Enter or Space.
 * ⛔ Selecting a row calls `condition.onOpen()` (→ openRun(run_id)) and nothing else. It never
 *   changes the active org and never builds a URL: for a run in another org, 299's LinkGate asks
 *   Stay / Switch (D-08).
 * ⛔ No dismiss, mark-read, snooze or clear control (D-09). The row leaves when the run stops
 *   waiting, and the list learns that by refetching.
 * ⛔ Every word comes from `waitingVocabulary`. Names render as React text only; no question
 *   text, run id or ISO time reaches the screen (T-301-18, T-301-20).
 * ⚠ The minute tick lives HERE, and Radix mounts this content only while the list is open, so a
 *   closed list costs the shell nothing (T-301-22).
 */
import { useEffect, useState } from "react"
import { CircleCheck, MessageCircleQuestion } from "lucide-react"

import { DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import { SyrelLoader } from "@/components/ui/SyrelLoader"
import { OrgAvatar } from "@/components/org/OrgIdentity"
import { cn } from "@/lib/utils"

import type { WaitingCondition, WaitingStatus } from "./attentionConditions"
import {
  WAITING_COPY,
  kindWords,
  moreLine,
  orgInitial,
  originWords,
  waitedPhrase,
} from "./waitingVocabulary"

interface Props {
  /** The waiting rows, in the server's order (waited longest first). */
  conditions: readonly WaitingCondition[]
  /** The server's count of ALL open notices — may exceed the rows returned. */
  total: number
  status: WaitingStatus
  side: "top" | "right" | "bottom" | "left"
  align: "start" | "center" | "end"
  sideOffset: number
  /** Width and height override (the drawer passes its own width). */
  className?: string
  /** Called on select, before the run opens (the drawer closes itself here). */
  onAfterSelect?: () => void
}

const LINE = "px-2 py-2 text-sm text-muted-foreground"

function Sep() {
  return <span aria-hidden="true">{" · "}</span>
}

export function WaitingOnYouList({
  conditions,
  total,
  status,
  side,
  align,
  sideOffset,
  className,
  onAfterSelect,
}: Props) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  let body: React.ReactNode
  if (status === "loading") {
    body = <SyrelLoader size="section" label={WAITING_COPY.loading} className={LINE} />
  } else if (status === "failed") {
    body = <div className={LINE}>{WAITING_COPY.failed}</div>
  } else if (conditions.length === 0) {
    body = (
      <div data-testid="waiting-empty" className={LINE}>
        {WAITING_COPY.empty}
      </div>
    )
  } else {
    body = conditions.map((condition) => {
      const title = condition.title.trim() ? condition.title : WAITING_COPY.untitledWorkflow
      const orgName = condition.orgName.trim() ? condition.orgName : WAITING_COPY.unnamedOrg
      const origin = originWords(condition.origin)
      const Glyph = condition.kind === "approval" ? CircleCheck : MessageCircleQuestion
      return (
        <DropdownMenuItem
          key={condition.id}
          data-testid="waiting-row"
          className="items-start gap-2 py-2"
          onSelect={() => {
            onAfterSelect?.()
            condition.onOpen()
          }}
        >
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-warning/15 text-warning"
          >
            <Glyph className="!h-3.5 !w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-foreground">{title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-1 text-xs leading-normal text-muted-foreground">
              <OrgAvatar size="xs" initial={orgInitial(condition.orgName)} />
              <span>{orgName}</span>
              <Sep />
              <span>{kindWords(condition.kind)}</span>
              <Sep />
              <span>{waitedPhrase(condition.since, now)}</span>
              {origin && (
                <>
                  <Sep />
                  <span>{origin}</span>
                </>
              )}
            </span>
          </span>
        </DropdownMenuItem>
      )
    })
  }

  const showRows = status !== "loading" && status !== "failed" && conditions.length > 0
  const more = showRows && total > conditions.length ? total - conditions.length : 0

  return (
    <DropdownMenuContent
      side={side}
      align={align}
      sideOffset={sideOffset}
      data-testid="waiting-popover"
      className={cn("w-80 max-h-[min(480px,var(--radix-dropdown-menu-content-available-height))]", className)}
    >
      <DropdownMenuLabel>{WAITING_COPY.header}</DropdownMenuLabel>
      {body}
      {more > 0 && (
        <div data-testid="waiting-more" className="px-2 py-2 text-xs text-muted-foreground">
          {moreLine(more)}
        </div>
      )}
      {status === "stale" && (
        <div data-testid="waiting-stale" className="px-2 py-2 text-xs text-muted-foreground">
          {WAITING_COPY.stale}
        </div>
      )}
    </DropdownMenuContent>
  )
}
