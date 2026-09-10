/**
 * Phase 232 (SRC-01 / SRC-02 / D-232-03) — Source Folder Picker.
 *
 * Interactive tree component for hierarchical folder and shared drive selection.
 * Adheres to the callback-only contract (onSelectFolder), persisting nothing into
 * connection configuration (reconciled with SEED-146 and Phase 234 watches).
 */

import { useState, useEffect, useCallback } from "react"
import {
  ChevronRight,
  ChevronDown,
  Folder,
  HardDrive,
  Loader2,
  AlertCircle,
  RefreshCw,
  Check,
} from "lucide-react"
import { browseSourceFolders, type SourceNode } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface SelectedFolder {
  folderId: string
  folderName: string
  driveId?: string | null
  driveName?: string | null
}

export interface SourceFolderPickerProps {
  connectionId: string
  selectedFolderId?: string | null
  onSelectFolder?: (folder: SelectedFolder) => void
  className?: string
}

interface TreeNodeProps {
  node: SourceNode
  connectionId: string
  depth: number
  selectedFolderId?: string | null
  expandedIds: Set<string>
  childrenMap: Record<string, SourceNode[]>
  loadingMap: Record<string, boolean>
  parentDriveName?: string | null
  onToggleExpand: (node: SourceNode) => void
  onSelect: (node: SourceNode, driveName?: string | null) => void
}

function TreeNode({
  node,
  connectionId,
  depth,
  selectedFolderId,
  expandedIds,
  childrenMap,
  loadingMap,
  parentDriveName,
  onToggleExpand,
  onSelect,
}: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id)
  const isLoading = !!loadingMap[node.id]
  const children = childrenMap[node.id] || []
  const isSelected = selectedFolderId === node.id

  const isDrive = node.kind === "drive"
  const currentDriveName = isDrive ? node.name : parentDriveName

  // Virtual containers or nodes with known children can expand
  const canExpand = node.has_children !== false

  return (
    <div className="flex flex-col select-none" role="treeitem" aria-expanded={canExpand ? isExpanded : undefined} aria-selected={isSelected}>
      <div
        className={cn(
          "flex items-center gap-1.5 py-1.5 px-2 rounded-md transition-colors cursor-pointer text-sm group",
          isSelected
            ? "bg-primary/10 text-primary font-medium border border-primary/30"
            : "hover:bg-muted/70 text-foreground border border-transparent",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node, currentDriveName)}
        data-testid={`folder-row-${node.id}`}
        aria-selected={isSelected}
      >
        {/* Expand / collapse chevron */}
        <button
          type="button"
          aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          className={cn(
            "p-0.5 rounded hover:bg-muted-foreground/20 text-muted-foreground transition-transform",
            !canExpand && "opacity-0 pointer-events-none",
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(node)
          }}
          data-testid={`expand-btn-${node.id}`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* Kind Icon */}
        {isDrive ? (
          <HardDrive className="w-4 h-4 text-blue-500 shrink-0" />
        ) : (
          <Folder className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary" : "text-amber-500")} />
        )}

        {/* Node Name */}
        <span className="truncate flex-1">{node.name}</span>

        {/* Selected mark */}
        {isSelected && <Check className="w-4 h-4 text-primary shrink-0 mr-1" />}
      </div>

      {/* Render children recursively when expanded */}
      {isExpanded && (
        <div role="group" className="flex flex-col">
          {children.length === 0 && !isLoading ? (
            <div
              className="py-1 text-xs text-muted-foreground italic"
              style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
            >
              No subfolders
            </div>
          ) : (
            children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                connectionId={connectionId}
                depth={depth + 1}
                selectedFolderId={selectedFolderId}
                expandedIds={expandedIds}
                childrenMap={childrenMap}
                loadingMap={loadingMap}
                parentDriveName={currentDriveName}
                onToggleExpand={onToggleExpand}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function SourceFolderPicker({
  connectionId,
  selectedFolderId,
  onSelectFolder,
  className,
}: SourceFolderPickerProps) {
  const [roots, setRoots] = useState<SourceNode[]>([])
  const [childrenMap, setChildrenMap] = useState<Record<string, SourceNode[]>>({})
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})
  const [loadingRoots, setLoadingRoots] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRoots = useCallback(async () => {
    if (!connectionId) return
    setLoadingRoots(true)
    setError(null)
    try {
      const resp = await browseSourceFolders(connectionId)
      setRoots(resp.items || [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to browse root folders"
      setError(message)
    } finally {
      setLoadingRoots(false)
    }
  }, [connectionId])

  useEffect(() => {
    fetchRoots()
  }, [fetchRoots])

  const handleToggleExpand = async (node: SourceNode) => {
    const nextExpanded = new Set(expandedIds)
    if (nextExpanded.has(node.id)) {
      nextExpanded.delete(node.id)
      setExpandedIds(nextExpanded)
      return
    }

    nextExpanded.add(node.id)
    setExpandedIds(nextExpanded)

    // Load child folders if not already loaded
    if (!childrenMap[node.id]) {
      setLoadingMap((prev) => ({ ...prev, [node.id]: true }))
      try {
        const resp = await browseSourceFolders(connectionId, node.id)
        setChildrenMap((prev) => ({ ...prev, [node.id]: resp.items || [] }))
      } catch (err: unknown) {
        console.error(`Failed to load children for folder ${node.id}`, err)
      } finally {
        setLoadingMap((prev) => ({ ...prev, [node.id]: false }))
      }
    }
  }

  const handleSelect = (node: SourceNode, driveName?: string | null) => {
    if (!onSelectFolder) return
    onSelectFolder({
      folderId: node.id,
      folderName: node.name,
      driveId: node.drive_id,
      driveName: driveName || (node.kind === "drive" ? node.name : null),
    })
  }

  if (loadingRoots) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 text-muted-foreground", className)} data-testid="folder-picker-loading">
        <Loader2 className="w-5 h-5 animate-spin mb-2" />
        <span className="text-xs">Loading folders…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm flex flex-col gap-2", className)} data-testid="folder-picker-error">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">Failed to load folder hierarchy</span>
        </div>
        <p className="text-xs opacity-90">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchRoots}
          className="self-start mt-1 gap-1.5 text-xs h-7"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  if (roots.length === 0) {
    return (
      <div className={cn("py-6 text-center text-xs text-muted-foreground", className)} data-testid="folder-picker-empty">
        No folders or drives found for this connection.
      </div>
    )
  }

  return (
    <div
      role="tree"
      aria-label="Source Folder Tree"
      className={cn("flex flex-col gap-0.5 overflow-y-auto max-h-80 border rounded-md p-1.5 bg-background", className)}
      data-testid="folder-picker-tree"
    >
      {roots.map((rootNode) => (
        <TreeNode
          key={rootNode.id}
          node={rootNode}
          connectionId={connectionId}
          depth={0}
          selectedFolderId={selectedFolderId}
          expandedIds={expandedIds}
          childrenMap={childrenMap}
          loadingMap={loadingMap}
          parentDriveName={rootNode.kind === "drive" ? rootNode.name : null}
          onToggleExpand={handleToggleExpand}
          onSelect={handleSelect}
        />
      ))}
    </div>
  )
}
