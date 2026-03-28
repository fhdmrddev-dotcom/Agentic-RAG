import { useState, useMemo } from "react"
import { DocumentUpload } from "@/components/ingestion/DocumentUpload"
import { DocumentList } from "@/components/ingestion/DocumentList"
import { FolderBreadcrumb } from "@/components/ingestion/FolderBreadcrumb"
import { FolderTree } from "@/components/ingestion/FolderTree"
import { useDocuments } from "@/hooks/useDocuments"
import { useFolders } from "@/hooks/useFolders"
import { TooltipProvider } from "@/components/ui/tooltip"

export function IngestionPage() {
  const { documents, uploading, uploadingCount, upload, deleteDoc } = useDocuments()
  const { folders, createFolder, renameFolder, deleteFolder, toggleGlobal } = useFolders()
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  // Derive selected folder name for upload label
  const selectedFolderName = useMemo(() => {
    if (selectedFolderId === null) return null
    const folder = folders.find((f) => f.id === selectedFolderId)
    return folder?.name ?? null
  }, [selectedFolderId, folders])

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-y-auto p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-muted-foreground mt-1">
            Upload documents to give the AI context for your conversations.
          </p>
        </div>

        <div className="flex flex-row gap-6 flex-1 min-h-0">
          {/* Left panel: Folder Tree — 260px fixed */}
          <div className="w-64 shrink-0 flex flex-col overflow-y-auto border rounded-lg bg-sidebar p-3">
            <FolderTree
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onCreateFolder={createFolder}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              onToggleGlobal={toggleGlobal}
            />
          </div>

          {/* Right panel: Breadcrumb + Upload + Document List */}
          <div className="flex-1 flex flex-col overflow-y-auto space-y-6">
            {selectedFolderId !== null && (
              <FolderBreadcrumb
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelectFolder={setSelectedFolderId}
              />
            )}
            <DocumentUpload
              onUpload={upload}
              uploading={uploading}
              uploadingCount={uploadingCount}
              folderId={selectedFolderId}
              folderName={selectedFolderName}
            />

            <DocumentList
              documents={documents}
              onDelete={deleteDoc}
              folderId={selectedFolderId}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
