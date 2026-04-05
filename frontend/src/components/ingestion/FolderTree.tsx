import { useState } from "react"
import { Plus, Folder as FolderIcon, FolderOpen } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { buildFolderTree } from "@/lib/folderTree"
import { FolderNode } from "./FolderNode"
import { FolderCreateInput } from "./FolderCreateInput"
import type { Folder } from "@/types"

interface FolderTreeProps {
  folders: Folder[]
  selectedFolderId: string | null
  currentUserId: string
  onSelectFolder: (id: string | null) => void
  onCreateFolder: (name: string, parentId: string | null, isGlobal?: boolean) => Promise<Folder>
  onRenameFolder: (id: string, name: string) => Promise<void>
  onDeleteFolder: (id: string) => Promise<void>
  onToggleGlobal: (id: string) => Promise<void>
}

export function FolderTree({
  folders,
  selectedFolderId,
  currentUserId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleGlobal,
}: FolderTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [creatingInParentId, setCreatingInParentId] = useState<
    string | "root" | null
  >(null)

  const tree = buildFolderTree(folders)

  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleStartRename = (id: string, currentName: string) => {
    void currentName
    setEditingId(id)
  }

  const handleCommitRename = async (id: string, newName: string) => {
    if (!newName) {
      setEditingId(null)
      return
    }
    setEditingId(null)
    try {
      await onRenameFolder(id, newName)
    } catch (err) {
      console.error("Could not save name:", err)
    }
  }

  const handleCancelRename = () => {
    setEditingId(null)
  }

  const handleStartDelete = (id: string) => {
    setDeletingId(id)
  }

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(null)
    try {
      await onDeleteFolder(id)
    } catch (err) {
      console.error("Could not delete folder:", err)
    }
  }

  const handleCancelDelete = () => {
    setDeletingId(null)
  }

  const handleCreateSubfolder = (parentId: string) => {
    // Auto-expand the parent so the new input is visible
    setExpandedIds((prev) => new Set([...prev, parentId]))
    setCreatingInParentId(parentId)
  }

  const handleCreateCommit = async (name: string, isGlobal: boolean) => {
    const parentId =
      creatingInParentId === "root" ? null : creatingInParentId ?? null
    setCreatingInParentId(null)
    try {
      await onCreateFolder(name, parentId, isGlobal)
    } catch (err) {
      console.error("Could not create folder:", err)
    }
  }

  const handleCreateCancel = () => {
    setCreatingInParentId(null)
  }

  const isRootSelected = selectedFolderId === null
  const RootIcon = isRootSelected ? FolderOpen : FolderIcon

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          Folders
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              onClick={() =>
                setCreatingInParentId(selectedFolderId ?? "root")
              }
            >
              <Plus className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>New Folder</TooltipContent>
        </Tooltip>
      </div>

      {/* Root node */}
      <div
        className={[
          "flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors duration-150",
          isRootSelected
            ? "bg-primary/10 text-primary font-medium shadow-sm shadow-primary/5"
            : "hover:bg-accent/60",
        ].join(" ")}
        onClick={() => onSelectFolder(null)}
      >
        <div className="h-4 w-4 shrink-0" />
        <RootIcon className={isRootSelected ? "h-4 w-4 shrink-0 text-primary" : "h-4 w-4 shrink-0 text-amber-500/70"} />
        <span className="text-sm truncate flex-1">Root</span>
      </div>

      {/* Create input at root level */}
      {creatingInParentId === "root" && (
        <FolderCreateInput
          depth={0}
          onCommit={handleCreateCommit}
          onCancel={handleCreateCancel}
        />
      )}

      {/* Tree body or empty state */}
      {folders.length === 0 && creatingInParentId === null ? (
        <div className="text-center py-6">
          <p className="text-sm font-medium">No folders yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create a folder to organize your documents.
          </p>
        </div>
      ) : (
        tree.map((node) => (
          <FolderNode
            key={node.id}
            node={node}
            depth={0}
            selectedFolderId={selectedFolderId}
            expandedIds={expandedIds}
            editingId={editingId}
            deletingId={deletingId}
            creatingInParentId={creatingInParentId}
            currentUserId={currentUserId}
            onSelect={onSelectFolder}
            onToggleExpand={handleToggleExpand}
            onStartRename={handleStartRename}
            onCommitRename={handleCommitRename}
            onCancelRename={handleCancelRename}
            onStartDelete={handleStartDelete}
            onConfirmDelete={handleConfirmDelete}
            onCancelDelete={handleCancelDelete}
            onCreateSubfolder={handleCreateSubfolder}
            onCreateCommit={handleCreateCommit}
            onCreateCancel={handleCreateCancel}
            onToggleGlobal={onToggleGlobal}
          />
        ))
      )}
    </div>
  )
}
