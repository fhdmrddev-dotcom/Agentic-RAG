import { useState } from "react"
import { Plus, Folder as FolderIcon, FolderOpen } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { buildFolderTree } from "@/lib/folderTree"
import { FolderNode } from "./FolderNode"
import { NavRow } from "./NavRow"
import { FolderCreateInput } from "./FolderCreateInput"
import { ApiRefusal } from "@/lib/api/refusal"
import { SyrelLoader } from "@/components/ui/SyrelLoader"
import { LOADING_FOLDERS } from "@/components/org/orgItemsCopy"
import { ElsewhereLine } from "@/components/org/ElsewhereLine"
import type { Folder } from "@/types"

interface FolderTreeProps {
  folders: Folder[]
  selectedFolderId: string | null
  currentUserId: string
  rootDocumentCount?: number
  /** Per-folder document counts keyed by folder id (Phase 114 D-114-13/8). Threaded
   *  to every FolderNode so counts render on every row, not just Root. */
  folderDocumentCounts?: Record<string, number>
  /** Phase 266 (D-266-13): provenance notes keyed by folder id, threaded to every FolderNode
   *  exactly as `folderDocumentCounts` is — pure prop-threading, nothing read here. */
  folderProvenance?: Record<string, string>
  onSelectFolder: (id: string | null) => void
  onCreateFolder: (name: string, parentId: string | null, isOrgShared?: boolean) => Promise<Folder>
  onRenameFolder: (id: string, name: string) => Promise<void>
  onDeleteFolder: (id: string) => Promise<void>
  onToggleOrgShared: (id: string) => Promise<void>
  /** Phase 298-04 (UI-D8): the active org's folders are not answered yet (first load or an org
   *  switch). The tree body says so instead of "No folders yet"; Root stays, its count omitted. */
  loading?: boolean
}

export function FolderTree({
  folders,
  selectedFolderId,
  currentUserId,
  rootDocumentCount,
  folderDocumentCounts,
  folderProvenance,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleOrgShared,
  loading = false,
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
    // WR-07: NavRow now only commits a NON-empty trimmed name (a blank name keeps the
    // editor open with a hint on Enter, or is an explicit cancel on blur), so this
    // path always receives a real name. The guard stays as defense-in-depth: a blank
    // here is treated as a no-op cancel (close the editor, no rename).
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

  // Phase 275 (S10 / D-15): the confirm stays open until the delete answers, so a 409 hold
  // refusal can be RETHROWN to the FolderNode that renders it in place of its buttons. Any other
  // failure closes the confirm and logs, exactly as before.
  const handleConfirmDelete = async (id: string) => {
    try {
      await onDeleteFolder(id)
      setDeletingId(null)
    } catch (err) {
      if (err instanceof ApiRefusal && err.status === 409) throw err
      setDeletingId(null)
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

  const handleCreateCommit = async (name: string, isOrgShared: boolean) => {
    const parentId =
      creatingInParentId === "root" ? null : creatingInParentId ?? null
    setCreatingInParentId(null)
    try {
      await onCreateFolder(name, parentId, isOrgShared)
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
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Folders
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="New folder"
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              onClick={() =>
                setCreatingInParentId(selectedFolderId ?? "root")
              }
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>New Folder</TooltipContent>
        </Tooltip>
      </div>

      {/* 298-05 (D-17 / UI-D4): your folders + Root documents in your other orgs, above Root. */}
      <ElsewhereLine kind="library" className="px-2 mb-2" />

      {/* Root node — also renders through the shared NavRow (D-114-13). It already
          had a count; now it shares the same row as every folder. */}
      <NavRow
        icon={RootIcon}
        name="Root"
        count={rootDocumentCount}
        isSelected={isRootSelected}
        onSelect={() => onSelectFolder(null)}
      />

      {/* Create input at root level */}
      {creatingInParentId === "root" && (
        <FolderCreateInput
          depth={0}
          onCommit={handleCreateCommit}
          onCancel={handleCreateCancel}
        />
      )}

      {/* Tree body, loading line (298-04 UI-D8) or empty state */}
      {loading ? (
        <SyrelLoader size="section" label={LOADING_FOLDERS} className="px-2 py-3 text-xs text-muted-foreground" />
      ) : folders.length === 0 && creatingInParentId === null ? (
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
            folderDocumentCounts={folderDocumentCounts}
            folderProvenance={folderProvenance}
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
            onToggleOrgShared={onToggleOrgShared}
          />
        ))
      )}
    </div>
  )
}
