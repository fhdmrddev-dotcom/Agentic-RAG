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
// ⭐ BUG-260912-01 — the SAME vocabulary the Library's source surfaces read. A browse failure
// and a watch failure are the same fact about the same connection, so they must not acquire
// two different sentences; and `sourceFailureSentence` is also what keeps a provider's raw
// dict off this screen (it passes a string through only on positive proof of plainness).
import { sourceFailureSentence } from "./sourceHealthVocabulary"

export interface SelectedFolder {
  folderId: string
  folderName: string
  driveId?: string | null
  driveName?: string | null
}

export interface SourceFolderPickerProps {
  connectionId: string
  /** ⭐ BUG-260912-01 — the connection's display name, used ONLY to name it in a failure
   *  sentence. Optional: `sourceFailureSentence` degrades to "the connection" rather than
   *  printing a gap, so a caller that does not have the name still gets a true sentence. */
  connectionName?: string
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
  /** ⭐ BUG-260912-01 — PER NODE, never one shared string. A folder that could not be read
   *  says so on its own row; its siblings are unaffected and keep their own outcome. A single
   *  shared `error` would make one recoverable fault look like a whole-connection one. */
  errorMap: Record<string, string>
  parentDriveName?: string | null
  onToggleExpand: (node: SourceNode) => void
  onRetryChildren: (node: SourceNode) => void
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
  errorMap,
  parentDriveName,
  onToggleExpand,
  onRetryChildren,
  onSelect,
}: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id)
  const isLoading = !!loadingMap[node.id]
  const children = childrenMap[node.id] || []
  const childError = errorMap[node.id]
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
          {/* ── ⭐ BUG-260912-01 — ASKED FIRST, AND THE ORDER IS THE WHOLE FIX ──────────
              A load that FAILED and a folder that is EMPTY are different facts, and the
              empty-state below is a claim about the user's drive. Rendering it from a
              request that never got an answer is how a rejected client secret came to read
              as "No subfolders" — a person believed their Drive was empty, reconnected
              twice, and the real cause was only recoverable from a script. */}
          {childError ? (
            <div
              className="flex items-start gap-1.5 py-1.5 pr-2 text-xs text-destructive"
              style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
              data-testid={`folder-children-error-${node.id}`}
              role="alert"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="flex-1">{childError}</span>
              <button
                type="button"
                className="shrink-0 underline underline-offset-2 hover:no-underline"
                onClick={(e) => {
                  e.stopPropagation()
                  onRetryChildren(node)
                }}
                data-testid={`folder-children-retry-${node.id}`}
              >
                Retry
              </button>
            </div>
          ) : children.length === 0 && !isLoading ? (
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
                errorMap={errorMap}
                parentDriveName={currentDriveName}
                onToggleExpand={onToggleExpand}
                onRetryChildren={onRetryChildren}
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
  connectionName,
  selectedFolderId,
  onSelectFolder,
  className,
}: SourceFolderPickerProps) {
  const [roots, setRoots] = useState<SourceNode[]>([])
  const [childrenMap, setChildrenMap] = useState<Record<string, SourceNode[]>>({})
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})
  const [errorMap, setErrorMap] = useState<Record<string, string>>({})
  const [loadingRoots, setLoadingRoots] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  /** ⭐ BUG-260912-01 — ONE place turns a thrown thing into a sentence a person may read.
   *
   *  ⛔ It goes through the shared vocabulary rather than rendering `err.message`. The
   *  backend's browse route appends the provider's own words to its sentence, and on the
   *  2026-09-12 measurement those words were a JSON dict carrying an OAuth error code. The
   *  vocabulary passes a string through only on POSITIVE proof of plainness, so the worst
   *  case here is the honest fallback rather than a leak. */
  const asSentence = useCallback(
    (err: unknown): string =>
      sourceFailureSentence(
        err instanceof Error ? err.message : typeof err === "string" ? err : null,
        connectionName ?? "",
      ),
    [connectionName],
  )

  const fetchRoots = useCallback(async () => {
    if (!connectionId) return
    setLoadingRoots(true)
    setError(null)
    try {
      const resp = await browseSourceFolders(connectionId)
      setRoots(resp.items || [])
    } catch (err: unknown) {
      setError(asSentence(err))
    } finally {
      setLoadingRoots(false)
    }
  }, [connectionId, asSentence])

  useEffect(() => {
    fetchRoots()
  }, [fetchRoots])

  /** Load one node's children, recording the OUTCOME either way.
   *
   *  ⭐ BUG-260912-01 — the `catch` used to `console.error` and set nothing, which left
   *  `childrenMap[id]` undefined. The renderer read that as `[]` and printed "No subfolders":
   *  a claim about the user's drive, manufactured from a request that never got an answer.
   *  Every exit from this function now writes either children or a reason. */
  const loadChildren = useCallback(
    async (node: SourceNode) => {
      setLoadingMap((prev) => ({ ...prev, [node.id]: true }))
      setErrorMap((prev) => {
        if (!(node.id in prev)) return prev
        const next = { ...prev }
        delete next[node.id]
        return next
      })
      try {
        const resp = await browseSourceFolders(connectionId, node.id)
        setChildrenMap((prev) => ({ ...prev, [node.id]: resp.items || [] }))
      } catch (err: unknown) {
        // ⚠ The log line stays — it carries the detail the sentence deliberately does not.
        console.error(`Failed to load children for folder ${node.id}`, err)
        setErrorMap((prev) => ({ ...prev, [node.id]: asSentence(err) }))
      } finally {
        setLoadingMap((prev) => ({ ...prev, [node.id]: false }))
      }
    },
    [connectionId, asSentence],
  )

  const handleToggleExpand = async (node: SourceNode) => {
    const nextExpanded = new Set(expandedIds)
    if (nextExpanded.has(node.id)) {
      nextExpanded.delete(node.id)
      setExpandedIds(nextExpanded)
      return
    }

    nextExpanded.add(node.id)
    setExpandedIds(nextExpanded)

    // Load child folders if not already loaded. ⚠ A node that FAILED has no entry in
    // `childrenMap`, so it is re-asked on a later expand — which is the honest behaviour:
    // nothing was ever learned about it.
    if (!childrenMap[node.id]) {
      await loadChildren(node)
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
          errorMap={errorMap}
          parentDriveName={rootNode.kind === "drive" ? rootNode.name : null}
          onToggleExpand={handleToggleExpand}
          onRetryChildren={loadChildren}
          onSelect={handleSelect}
        />
      ))}
    </div>
  )
}
