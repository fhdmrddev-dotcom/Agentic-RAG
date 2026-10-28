/**
 * Phase 298-05 (ORG-06 / D-19 / D-31 / UI-D15) — "Move to <Org>…" in a row's ⋯ menu.
 *
 * Mounted ONCE by a home (the Library `FolderNode` menu for an owned folder, the `WorkflowCardMenu`
 * for an owned draft). It decides its own eligibility and renders NOTHING otherwise — absent,
 * never disabled (org-admin D3): a solo user, a non-owner, or outside an OrgProvider. At 2-3 orgs
 * it renders one item per other org (by name); at 4+ one "Move to another organization…" and the
 * sheet asks which first. Every other blocker is the server's to state, in the sheet.
 *
 * ⚠ IT ONLY ASKS FOR THE SHEET (`openMoveSheet`). A dropdown menu's content UNMOUNTS when it
 * closes, so a sheet rendered here would die the moment it opened; `MoveToOrgSheetHost` (mounted
 * by the list's `ElsewhereLine`) renders it instead. So no home gains state for it.
 *
 * ⚠ Each item is a `DropdownMenuItem`, which keeps `WorkflowCardMenu`'s WR-03
 * `aria-required-children` sweep green.
 */
import { ArrowRightLeft } from "lucide-react"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useOrgOptional } from "@/providers/OrgProvider"
import { moveTargets, openMoveSheet } from "@/lib/elsewhereCounts"
import type { OrgMembership } from "@/lib/api/admin"
import type { FolderNode } from "@/lib/folderTree"
import { MOVE_TO_ANOTHER_ORG, moveToMenuLabel } from "./orgItemsCopy"

export interface MoveToOrgMenuItemProps {
  kind: "folder" | "draft"
  itemId: string
  itemName: string
  /** The home's one read of ownership (a non-owner sees nothing). */
  owned: boolean
  /** A folder's node, so a move whose subtree holds the selection can say so (Library → Root). */
  subtree?: FolderNode
  selectedId?: string | null
}

function holds(node: FolderNode | undefined, id: string | null | undefined): boolean {
  if (!node || !id) return false
  return node.id === id || node.children.some((c) => holds(c, id))
}

export function MoveToOrgMenuItem({ kind, itemId, itemName, owned, subtree, selectedId }: MoveToOrgMenuItemProps) {
  const org = useOrgOptional()
  const activeOrgId = org?.activeOrgId ?? null
  const targets = moveTargets(org?.orgs, activeOrgId)
  if (!owned || targets.length === 0) return null

  const open = (to: OrgMembership[]) =>
    openMoveSheet({
      kind,
      itemId,
      itemName,
      targets: to,
      openedIn: activeOrgId,
      holdsSelection: kind === "folder" ? holds(subtree, selectedId) : undefined,
    })

  if (targets.length >= 3) {
    return (
      <DropdownMenuItem
        aria-label={MOVE_TO_ANOTHER_ORG}
        onClick={(e) => {
          e.stopPropagation()
          open(targets)
        }}
      >
        <ArrowRightLeft className="mr-2 h-3.5 w-3.5 flex-none" aria-hidden="true" />
        <span className="truncate">{MOVE_TO_ANOTHER_ORG}</span>
      </DropdownMenuItem>
    )
  }
  return (
    <>
      {targets.map((t) => (
        <DropdownMenuItem
          key={t.org_id}
          aria-label={moveToMenuLabel(t.name)}
          onClick={(e) => {
            e.stopPropagation()
            open([t])
          }}
        >
          <ArrowRightLeft className="mr-2 h-3.5 w-3.5 flex-none" aria-hidden="true" />
          <span className="truncate">{moveToMenuLabel(t.name)}</span>
        </DropdownMenuItem>
      ))}
    </>
  )
}
