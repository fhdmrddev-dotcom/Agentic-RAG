/**
 * Phase 217.1 plan 06 (LIB-01) — `Library › <folder> › <tab>` breadcrumb.
 *
 * A thin composition: the already-shipped `FolderBreadcrumb` (already mounted at
 * `LibraryPage.tsx:518`) provides the folder segment; this wrapper adds the `Library`
 * prefix and the current tab label as the suffix. When no folder is selected,
 * `FolderBreadcrumb` renders null, so the crumb reads `Library › <tab>`.
 */
import { ChevronRight } from "lucide-react"
import { FolderBreadcrumb } from "@/components/ingestion/FolderBreadcrumb"
import type { Folder } from "@/types"

interface Props {
  folders: Folder[]
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  /** The active tab's display label, e.g. "Documents". */
  tabLabel: string
}

export function LibraryBreadcrumb({ folders, selectedFolderId, onSelectFolder, tabLabel }: Props) {
  return (
    <nav
      aria-label="Library breadcrumb"
      data-testid="library-breadcrumb"
      className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap"
    >
      <span className="font-medium text-foreground">Library</span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
      <FolderBreadcrumb
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={onSelectFolder}
      />
      {selectedFolderId !== null && (
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
      )}
      <span className="text-foreground">{tabLabel}</span>
    </nav>
  )
}
