import { useEffect, useState } from "react"
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderOpen,
  Globe,
  Pencil,
  Plus,
  Trash2,
  MoreHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ApiRefusal } from "@/lib/api/refusal"
import { HoldRefusalNotice } from "@/components/retention/HoldRefusalNotice"
import { NavRow } from "./NavRow"
import { FolderCreateInput } from "./FolderCreateInput"
import type { FolderNode as FolderNodeType } from "@/lib/folderTree"

interface FolderNodeProps {
  node: FolderNodeType
  depth: number
  selectedFolderId: string | null
  expandedIds: Set<string>
  editingId: string | null
  deletingId: string | null
  creatingInParentId: string | "root" | null
  currentUserId: string
  /** Per-folder document counts keyed by folder id (Phase 114 D-114-13/8). Counts
   *  render on every row for parity with the mandated View count. Absent ids
   *  render gracefully as 0. */
  folderDocumentCounts?: Record<string, number>
  /** Phase 266 (D-266-13): provenance notes keyed by folder id — e.g. "from Financial Analyzer"
   *  for an installed Expert's folder. Appended to the EXISTING shared label, so it only ever
   *  shows on an org-shared folder; NavRow is not changed.
   *  ⚠ CORRECTED 2026-09-25 (266-05 UAT): NavRow WAS changed. Tooltip-only, the note was invisible
   *  to the operator. So it is also passed as NavRow's optional `caption`, a grey line visible at rest. */
  folderProvenance?: Record<string, string>
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onStartRename: (id: string, currentName: string) => void
  onCommitRename: (id: string, newName: string) => void
  onCancelRename: () => void
  onStartDelete: (id: string) => void
  /** Phase 275 (S10 / D-15): may return the delete's promise; a 409 refusal rejected from it is
   *  shown IN PLACE of the confirm buttons, and the folder stays. */
  onConfirmDelete: (id: string) => void | Promise<void>
  onCancelDelete: () => void
  onCreateSubfolder: (parentId: string) => void
  onCreateCommit: (name: string, isOrgShared: boolean) => void
  onCreateCancel: () => void
  onToggleOrgShared: (id: string) => void
}

export function FolderNode({
  node,
  depth,
  selectedFolderId,
  expandedIds,
  editingId,
  deletingId,
  creatingInParentId,
  currentUserId,
  folderDocumentCounts,
  folderProvenance,
  onSelect,
  onToggleExpand,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onStartDelete,
  onConfirmDelete,
  onCancelDelete,
  onCreateSubfolder,
  onCreateCommit,
  onCreateCancel,
  onToggleOrgShared,
}: FolderNodeProps) {
  const isSelected = node.id === selectedFolderId
  const isExpanded = expandedIds.has(node.id)
  const isEditing = editingId === node.id
  const isDeleting = deletingId === node.id
  // Phase 275 (S10 / D-15): the server's hold refusal for this folder's delete, if any.
  const [refusal, setRefusal] = useState<ApiRefusal | null>(null)
  // A refusal belongs to ONE confirm: when the confirm closes (Close, or another folder's delete
  // starting), it is cleared, so a later confirm never opens on a stale sentence.
  useEffect(() => {
    if (!isDeleting) setRefusal(null)
  }, [isDeleting])

  async function confirmDelete() {
    try {
      await onConfirmDelete(node.id)
    } catch (err) {
      if (err instanceof ApiRefusal && err.status === 409) setRefusal(err)
    }
  }
  const hasChildren = node.children.length > 0
  const isOwner = node.user_id === currentUserId
  const count = folderDocumentCounts?.[node.id] ?? 0

  const FolderIconComponent = isSelected && isExpanded ? FolderOpen : FolderIcon

  return (
    <div>
      {/* Row body delegates to the shared NavRow (Phase 114 D-114-13). The recursion,
          delete-confirm, and subfolder-create stay HERE in FolderNode. */}
      <NavRow
        icon={FolderIconComponent}
        name={node.name}
        count={count}
        depth={depth}
        isSelected={isSelected}
        isShared={node.is_org_shared}
        sharedLabel={
          folderProvenance?.[node.id]
            ? `Shared with org · ${folderProvenance[node.id]}`
            : "Shared with org"
        }
        caption={node.is_org_shared ? folderProvenance?.[node.id] : undefined}
        onSelect={() => onSelect(node.id)}
        isEditing={isEditing}
        onCommitRename={(newName) => onCommitRename(node.id, newName)}
        onCancelRename={onCancelRename}
        leading={
          hasChildren ? (
            <button
              data-testid="chevron-btn"
              aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
              className="h-4 w-4 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-transform duration-200"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand(node.id)
              }}
            >
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  isExpanded && "rotate-90",
                )}
              />
            </button>
          ) : undefined
        }
        actions={
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateSubfolder(node.id)
                  }}
                  aria-label="New subfolder"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New subfolder</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Folder options"
                >
                  <MoreHorizontal className="h-3 w-3" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onStartRename(node.id, node.name)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Rename
                </DropdownMenuItem>
                {isOwner && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleOrgShared(node.id)
                    }}
                  >
                    <Globe className="h-3.5 w-3.5 mr-2" />
                    {node.is_org_shared ? "Make private" : "Share with org"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onStartDelete(node.id)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Inline delete confirmation */}
      {isDeleting && refusal && (
        <HoldRefusalNotice
          className="ml-8 mt-1 text-xs"
          title={refusal.title}
          message={refusal.message}
          onClose={() => {
            setRefusal(null)
            onCancelDelete()
          }}
        />
      )}
      {isDeleting && !refusal && (
        <div className="ml-8 py-2 px-2 text-xs text-muted-foreground flex items-center gap-2 flex-wrap bg-destructive/5 rounded-md mt-1">
          <span>
            Delete <strong>{node.name}</strong>? This will permanently delete the folder and all documents inside it.
          </span>
          <div className="flex gap-1.5 mt-1 w-full">
            <Button
              variant="destructive"
              size="sm"
              className="h-6 text-xs px-2.5"
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2.5"
              onClick={onCancelDelete}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Inline subfolder create input */}
      {creatingInParentId === node.id && (
        <FolderCreateInput
          depth={depth + 1}
          onCommit={onCreateCommit}
          onCancel={onCreateCancel}
        />
      )}

      {/* Recursive children with smooth expand/collapse */}
      {isExpanded &&
        hasChildren &&
        node.children.map((child) => (
          <FolderNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedFolderId={selectedFolderId}
            expandedIds={expandedIds}
            editingId={editingId}
            deletingId={deletingId}
            creatingInParentId={creatingInParentId}
            currentUserId={currentUserId}
            folderDocumentCounts={folderDocumentCounts}
            folderProvenance={folderProvenance}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
            onStartRename={onStartRename}
            onCommitRename={onCommitRename}
            onCancelRename={onCancelRename}
            onStartDelete={onStartDelete}
            onConfirmDelete={onConfirmDelete}
            onCancelDelete={onCancelDelete}
            onCreateSubfolder={onCreateSubfolder}
            onCreateCommit={onCreateCommit}
            onCreateCancel={onCreateCancel}
            onToggleOrgShared={onToggleOrgShared}
          />
        ))}
    </div>
  )
}
