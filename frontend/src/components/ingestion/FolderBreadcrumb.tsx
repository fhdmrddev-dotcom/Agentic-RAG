import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Folder } from "@/types"

interface Props {
  folders: Folder[]
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
}

/**
 * Builds the ancestor path from the flat folders list by walking parent_id links.
 * Returns an ordered array from root to the selected folder.
 */
function buildPath(folders: Folder[], selectedFolderId: string | null): Folder[] {
  if (selectedFolderId === null) return []
  const byId = new Map(folders.map((f) => [f.id, f]))
  const path: Folder[] = []
  let current = byId.get(selectedFolderId)
  while (current) {
    path.unshift(current)
    current = current.parent_id ? byId.get(current.parent_id) : undefined
  }
  return path
}

export function FolderBreadcrumb({ folders, selectedFolderId, onSelectFolder }: Props) {
  const path = buildPath(folders, selectedFolderId)

  // Don't render anything when at root and no folder is selected
  if (selectedFolderId === null && path.length === 0) return null

  return (
    <nav
      aria-label="Folder path"
      className="flex items-center gap-0.5 text-sm text-muted-foreground flex-wrap"
    >
      {/* Root segment */}
      <button
        onClick={() => onSelectFolder(null)}
        className={cn(
          "flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:text-foreground hover:bg-muted/50",
          selectedFolderId === null ? "text-foreground font-medium" : ""
        )}
      >
        <Home className="w-3.5 h-3.5" />
        <span>Root</span>
      </button>

      {path.map((folder) => (
        <span key={folder.id} className="flex items-center gap-0.5">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
          <button
            onClick={() => onSelectFolder(folder.id)}
            className={cn(
              "rounded px-1.5 py-0.5 transition-colors hover:text-foreground hover:bg-muted/50 max-w-[160px] truncate",
              selectedFolderId === folder.id ? "text-foreground font-medium" : ""
            )}
            title={folder.name}
          >
            {folder.name}
          </button>
        </span>
      ))}
    </nav>
  )
}
