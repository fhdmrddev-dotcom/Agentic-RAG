import { useRef, useState } from "react"
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
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onStartRename: (id: string, currentName: string) => void
  onCommitRename: (id: string, newName: string) => void
  onCancelRename: () => void
  onStartDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
  onCreateSubfolder: (parentId: string) => void
  onCreateCommit: (name: string, isGlobal: boolean) => void
  onCreateCancel: () => void
  onToggleGlobal: (id: string) => void
}

export function FolderNode({
  node,
  depth,
  selectedFolderId,
  expandedIds,
  editingId,
  deletingId,
  creatingInParentId,
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
  onToggleGlobal,
}: FolderNodeProps) {
  const isSelected = node.id === selectedFolderId
  const isExpanded = expandedIds.has(node.id)
  const isEditing = editingId === node.id
  const isDeleting = deletingId === node.id
  const hasChildren = node.children.length > 0

  const [editValue, setEditValue] = useState(node.name)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Reset edit value when editing starts
  if (isEditing && editValue !== node.name && editInputRef.current === null) {
    setEditValue(node.name)
  }

  const FolderIconComponent = isSelected && isExpanded ? FolderOpen : FolderIcon

  return (
    <div>
      <div className="relative" style={{ paddingLeft: `${depth * 16 + 4}px` }}>
        {/* Tree guide lines */}
        {depth > 0 && (
          <>
            {/* Vertical line from parent */}
            <div
              className="absolute top-0 bottom-0 border-l border-border/30"
              style={{ left: `${(depth - 1) * 16 + 16}px` }}
            />
            {/* Horizontal branch line */}
            <div
              className="absolute border-t border-border/30"
              style={{
                left: `${(depth - 1) * 16 + 16}px`,
                width: "10px",
                top: "50%",
              }}
            />
          </>
        )}

        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer group relative transition-colors duration-150",
            isSelected
              ? "bg-primary/10 text-primary font-medium shadow-sm shadow-primary/5"
              : "hover:bg-accent/60",
          )}
          onClick={() => {
            if (!isEditing) onSelect(node.id)
          }}
        >
          {/* Chevron area */}
          {hasChildren ? (
            <button
              data-testid="chevron-btn"
              className="h-4 w-4 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-transform duration-200"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand(node.id)
              }}
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  isExpanded && "rotate-90"
                )}
              />
            </button>
          ) : (
            <div className="h-4 w-4 shrink-0" />
          )}

          {/* Folder icon */}
          <FolderIconComponent
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              isSelected ? "text-primary" : "text-amber-500/70"
            )}
          />

          {/* Name or inline rename input */}
          {isEditing ? (
            <input
              ref={editInputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => onCommitRename(node.id, editValue.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  onCommitRename(node.id, editValue.trim())
                }
                if (e.key === "Escape") {
                  e.preventDefault()
                  onCancelRename()
                }
              }}
              className="flex-1 min-w-0 px-1.5 py-0.5 text-sm bg-background border border-primary/30 rounded-md outline-none focus:ring-1 focus:ring-primary/40"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm truncate flex-1 min-w-0">{node.name}</span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[200px]">
                <p className="break-words">{node.name}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Global badge */}
          {node.is_global && !isEditing && (
            <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              G
            </span>
          )}

          {/* Compact action area: New subfolder + More menu */}
          {!isEditing && (
            <div className="flex items-center gap-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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
                  >
                    <Plus className="h-3 w-3" />
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
                  >
                    <MoreHorizontal className="h-3 w-3" />
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
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleGlobal(node.id)
                    }}
                  >
                    <Globe className="h-3.5 w-3.5 mr-2" />
                    {node.is_global ? "Make private" : "Make global"}
                  </DropdownMenuItem>
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
            </div>
          )}
        </div>

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
      </div>

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
            onToggleGlobal={onToggleGlobal}
          />
        ))}
    </div>
  )
}
