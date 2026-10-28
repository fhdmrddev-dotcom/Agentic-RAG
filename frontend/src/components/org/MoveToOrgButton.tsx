/**
 * Phase 298-05 (ORG-06 / D-19 / UI-D15) — "Move to <Org>…" for a Root document, in the detail
 * panel's header beside Download (not on `DocumentRow`: that row is icon-only and full).
 *
 * Renders NOTHING (absent, never disabled) unless the document is a LATEST Root document
 * (`folder_id` null, not an earlier version), the signed-in person owns it, and they belong to
 * 2+ orgs. At 2-3 orgs one outline button per other org; at 4+ one "Move to another
 * organization…". The button owns its sheet (it is not inside a menu, so nothing unmounts it).
 *
 * After a successful move, closing the sheet calls `onMoved` — the panel passes its own `onClose`,
 * so the detail panel closes once the person has seen "Moved to <Org> · recorded", while the list
 * drops the row on its refetch (never optimistically).
 */
import { useRef, useState } from "react"
import { ArrowRightLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOrgOptional } from "@/providers/OrgProvider"
import { moveTargets } from "@/lib/elsewhereCounts"
import type { OrgMembership } from "@/lib/api/admin"
import type { Document } from "@/types"
import { MoveToOrgSheet } from "./MoveToOrgSheet"
import { MOVE_TO_ANOTHER_ORG, moveToMenuLabel } from "./orgItemsCopy"

export interface MoveToOrgButtonProps {
  document: Document
  /** The signed-in person's id; absent → not owned → nothing renders (fail closed). */
  currentUserId?: string
  /** Called when the sheet closes after a successful move. */
  onMoved?: () => void
}

export function MoveToOrgButton({ document, currentUserId, onMoved }: MoveToOrgButtonProps) {
  const org = useOrgOptional()
  const [chosen, setChosen] = useState<OrgMembership[] | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const targets = moveTargets(org?.orgs, org?.activeOrgId ?? null)
  const eligible =
    targets.length > 0 &&
    document.folder_id === null &&
    document.is_latest !== false &&
    !!currentUserId &&
    document.user_id === currentUserId
  if (!eligible) return null

  const buttons: { label: string; to: OrgMembership[] }[] =
    targets.length >= 3
      ? [{ label: MOVE_TO_ANOTHER_ORG, to: targets }]
      : targets.map((t) => ({ label: moveToMenuLabel(t.name), to: [t] }))

  return (
    <div ref={anchorRef} tabIndex={-1} className="flex min-w-0 flex-wrap items-center gap-2 outline-none">
      {buttons.map((b) => (
        <Button
          key={b.label}
          type="button"
          variant="outline"
          size="sm"
          aria-label={b.label}
          onClick={() => setChosen(b.to)}
          className="max-w-full"
        >
          <ArrowRightLeft className="mr-2 h-3.5 w-3.5 flex-none" aria-hidden="true" />
          <span className="truncate">{b.label}</span>
        </Button>
      ))}
      {chosen ? (
        <MoveToOrgSheet
          kind="document"
          itemId={document.id}
          itemName={document.filename}
          targets={chosen}
          open
          onOpenChange={(o) => {
            if (!o) setChosen(null)
          }}
          onMovedClose={onMoved}
          returnFocusFallback={anchorRef}
        />
      ) : null}
    </div>
  )
}
