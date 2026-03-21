import { useRef, useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  Globe,
  Pencil,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { FolderNode as FolderNodeType } from "@/lib/folderTree"

interface FolderNodeProps {
  node: FolderNodeType
  depth: number
  selectedFolderId: string | null
  expandedIds: Set<string>
  editingId: string | null
  deletingId: string | null
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onStartRename: (id: string, currentName: string) => void
  onCommitRename: (id: string, newName: string) => void
  onCancelRename: () => void
  onStartDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
  onCreateSubfolder: (parentId: string) => void
}

export function FolderNode({
  node,
  depth,
  selectedFolderId,
  expandedIds,
  editingId,
  deletingId,
  onSelect,
  onToggleExpand,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onStartDelete,
  onConfirmDelete,
  onCancelDelete,
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

  return (
    <div>
      <div style={{ paddingLeft: `${depth * 12}px` }}>
        <div
          className={[
            "flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer group",
            isSelected
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent",
          ].join(" ")}
          onClick={() => {
            if (!isEditing) onSelect(node.id)
          }}
        >
          {/* Chevron area */}
          {hasChildren ? (
            <button
              data-testid="chevron-btn"
              className="h-4 w-4 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand(node.id)
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <div className="h-4 w-4 shrink-0" />
          )}

          {/* Folder icon */}
          <FolderIcon className="h-4 w-4 shrink-0" />

          {/* Globe icon for global folders */}
          {node.is_global && (
            <Globe
              data-testid="globe-icon"
              className="h-4 w-4 shrink-0 text-muted-foreground"
            />
          )}

          {/* Name or inline rename input */}
          {isEditing ? (
            <input
              ref={editInputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => onCommitRename(node.id, editValue.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCommitRename(node.id, editValue.trim())
                if (e.key === "Escape") onCancelRename()
              }}
              className="flex-1 px-1 py-0.5 text-sm bg-background border rounded outline-none"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-sm truncate flex-1">{node.name}</span>
          )}

          {/* Hover action buttons */}
          {!isEditing && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      onStartRename(node.id, node.name)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rename</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      onStartDelete(node.id)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Inline delete confirmation */}
        {isDeleting && (
          <div className="ml-8 py-1 px-2 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>
              Delete {node.name} and all its contents? This cannot be undone.
            </span>
            <Button
              variant="destructive"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => onConfirmDelete(node.id)}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={onCancelDelete}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Recursive children */}
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
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
            onStartRename={onStartRename}
            onCommitRename={onCommitRename}
            onCancelRename={onCancelRename}
            onStartDelete={onStartDelete}
            onConfirmDelete={onConfirmDelete}
            onCancelDelete={onCancelDelete}
            onCreateSubfolder={() => {}}
          />
        ))}
    </div>
  )
}
