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
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onStartRename: (id: string, currentName: string) => void
  onCommitRename: (id: string, newName: string) => void
  onCancelRename: () => void
  onStartDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
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
        sharedLabel="Shared with org"
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
      {isDeleting && (
        <div className="ml-8 py-2 px-2 text-xs text-muted-foreground flex items-center gap-2 flex-wrap bg-destructive/5 rounded-md mt-1">
          <span>
            Delete <strong>{node.name}</strong>? This will permanently delete the folder and all documents inside it.
          </span>
          <div className="flex gap-1.5 mt-1 w-full">
            <Button
              variant="destructive"
              size="sm"
              className="h-6 text-xs px-2.5"
              onClick={() => onConfirmDelete(node.id)}
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
