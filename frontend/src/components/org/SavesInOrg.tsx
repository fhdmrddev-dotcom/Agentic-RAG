/**
 * Phase 299-04 (D-18 / D-38 / UI-D11) — "Saves in {Org}" on a button that creates an item.
 *
 * Mounted ONCE by each of the three create buttons an item page offers: Run (`RunModal`), Tweak
 * (the card ⋯ menu's consequence line, as a trailing sentence) and Start a chat (the Expert
 * detail). It names the ACTIVE org, which equals the item's org on any page reached through the
 * switch-org prompt.
 *
 * ⛔ Renders NOTHING unless the person belongs to 2 or more orgs and the active org resolves to a
 *    name — a single-org person sees no change (UI-D11).
 * ⛔ A HINT, never the guarantee: the server's org guard (299-01, S8) refuses a mismatched save.
 * ⛔ Only on buttons that CREATE (never Stop, Answer, Save draft, Install or Copy link).
 * ⛔ Words from `orgItemsCopy.ts` only.
 */
import { useOrgOptional } from "@/providers/OrgProvider"
import { cn } from "@/lib/utils"
import { SAVES_IN_PREFIX } from "./orgItemsCopy"

export interface SavesInOrgProps {
  className?: string
  /** The trailing-sentence form, " Saves in {Org}.", for a line that already says something. */
  asSentence?: boolean
}

export function SavesInOrg({ className, asSentence = false }: SavesInOrgProps) {
  const org = useOrgOptional()
  const orgs = org?.orgs ?? []
  if (orgs.length < 2) return null
  const name = orgs.find((o) => o.org_id === org?.activeOrgId)?.name
  if (!name) return null
  if (asSentence) {
    return (
      <span className={className}>
        {` ${SAVES_IN_PREFIX}`}
        <span className="text-foreground">{name}</span>
        {"."}
      </span>
    )
  }
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {SAVES_IN_PREFIX}
      <span className="text-foreground">{name}</span>
    </p>
  )
}
