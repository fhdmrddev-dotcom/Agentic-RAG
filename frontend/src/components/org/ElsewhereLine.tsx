/**
 * Phase 298-05 (ORG-06 / D-17 / UI-D4..UI-D7) — "N more … in <Org> · Switch" under a narrowed list.
 *
 * A list narrowed to the active org would otherwise hide, silently, the person's own items in
 * their other orgs. This line says how many, per org, and Switch takes them there (the same
 * `switchOrg` the profile menu calls — no navigation, no remount; the view's lists re-fetch).
 *
 * ⛔ A HINT, NEVER A PROMISE (UI-D6). Every non-answer renders NOTHING: while loading, at 0, for a
 * solo user, outside an OrgProvider, with no active org, on a failed read (the store warns once).
 * No state ever renders "0 more".
 *
 * ⚠ THE WRAPPER IS ALWAYS MOUNTED, EMPTY, with `aria-live="polite"`, so an updated count after a
 * move is announced, and so Switch can move focus to it BEFORE the button unmounts (UI-D7: focus
 * never drops to <body>). The list's gutter (`className`) applies only to the inner block, so an
 * empty wrapper takes no space.
 *
 * Words come from `orgItemsCopy.ts`; org names render as React text (never HTML), truncated
 * visually past ~24 characters with the whole name kept in the DOM text and the button's name.
 *
 * ⚠ IT ALSO HOSTS THE ROW MENUS' MOVE SHEET (298-05 Task 3). A row's "Move to <Org>…" lives in a
 * dropdown whose content unmounts when it closes, so the sheet is rendered here — the one element
 * every list with a move home already mounts once (the Library line for folders, the Workflows line
 * for drafts) — and focus falls back to this wrapper when the opener left with the moved item.
 */
import { useRef } from "react"
import { cn } from "@/lib/utils"
import { useOrgOptional } from "@/providers/OrgProvider"
import { useElsewhereCounts } from "@/lib/elsewhereCounts"
import { SWITCH, elsewhereLead, switchToLabel, type ElsewhereKind } from "./orgItemsCopy"
import { MoveToOrgSheetHost } from "./MoveToOrgSheet"

/** The row-menu moves this list's line hosts (298-05 Task 3): the sheet must outlive the menu. */
const HOSTS: Partial<Record<ElsewhereKind, readonly ("folder" | "draft")[]>> = {
  library: ["folder"],
  workflows: ["draft"],
}

export interface ElsewhereLineProps {
  kind: ElsewhereKind
  /** The list's own gutter (e.g. `px-2 mb-2`), applied only when there is a line to show. */
  className?: string
}

const NO_MEMBERSHIPS: readonly unknown[] = []

export function ElsewhereLine({ kind, className }: ElsewhereLineProps) {
  const org = useOrgOptional()
  const activeOrgId = org?.activeOrgId ?? null
  const memberships = org?.orgs ?? NO_MEMBERSHIPS
  const { status, orgs } = useElsewhereCounts(activeOrgId, memberships.length >= 2)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const lines =
    status === "ready"
      ? orgs.flatMap((o) => {
          if (o.org_id === activeOrgId) return []
          const lead = elsewhereLead(kind, o)
          return lead === null ? [] : [{ o, lead }]
        })
      : []

  const hosts = HOSTS[kind]
  return (
    <>
      {hosts ? <MoveToOrgSheetHost kinds={hosts} returnFocusFallback={wrapperRef} /> : null}
      <div ref={wrapperRef} tabIndex={-1} aria-live="polite" data-testid={`elsewhere-${kind}`} className="outline-none">
        {lines.length > 0 ? (
          <div className={cn("flex flex-col gap-1", className)}>
            {lines.map(({ o, lead }) => (
              <p key={o.org_id} data-testid="elsewhere-row" className="text-[12px] leading-normal text-muted-foreground">
                {lead}
                {" in "}
                <span className="inline-block max-w-[12rem] truncate align-bottom">{o.org_name}</span>
                <span className="whitespace-nowrap">
                  {" · "}
                  <button
                    type="button"
                    aria-label={switchToLabel(o.org_name)}
                    onClick={() => {
                      wrapperRef.current?.focus()
                      org?.switchOrg(o.org_id)
                    }}
                    className="min-h-6 rounded-sm px-1 font-semibold text-primary hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {SWITCH}
                  </button>
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </>
  )
}
