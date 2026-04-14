import { useState, useMemo } from "react"
import { DocumentUpload } from "@/components/ingestion/DocumentUpload"
import { DocumentList } from "@/components/ingestion/DocumentList"
import { FolderBreadcrumb } from "@/components/ingestion/FolderBreadcrumb"
import { FolderDetail } from "@/components/ingestion/FolderDetail"
import { FolderTree } from "@/components/ingestion/FolderTree"
import { useDocuments } from "@/hooks/useDocuments"
import { useFolders } from "@/hooks/useFolders"
import { useAuth } from "@/hooks/useAuth"
import { TooltipProvider } from "@/components/ui/tooltip"

export function IngestionPage() {
  const { user } = useAuth()
  const { documents, uploading, uploadingCount, upload, deleteDoc, loadDocuments } = useDocuments()
  const { folders, createFolder, renameFolder, deleteFolder, toggleGlobal } = useFolders()
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  // Derive selected folder name for upload label
  const selectedFolderName = useMemo(() => {
    if (selectedFolderId === null) return null
    const folder = folders.find((f) => f.id === selectedFolderId)
    return folder?.name ?? null
  }, [selectedFolderId, folders])

  const selectedFolder = useMemo(() => {
    if (selectedFolderId === null) return null
    return folders.find((f) => f.id === selectedFolderId) ?? null
  }, [selectedFolderId, folders])

  const canUploadToFolder = !selectedFolderId || !selectedFolder || selectedFolder.user_id === user?.id

  const folderDocuments = useMemo(() => {
    if (selectedFolderId === null) return []
    return documents.filter((d) => d.folder_id === selectedFolderId)
  }, [selectedFolderId, documents])

  const subfolderCount = useMemo(() => {
    if (selectedFolderId === null) return 0
    return folders.filter((f) => f.parent_id === selectedFolderId).length
  }, [selectedFolderId, folders])

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-y-auto p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-headline font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Upload documents to give the AI context for your conversations.
          </p>
        </div>

        <div className="flex flex-row gap-6 flex-1 min-h-0">
          {/* Left panel: Folder Tree */}
          <div className="w-72 shrink-0 flex flex-col overflow-y-auto rounded-xl bg-card/50 ghost-border p-3">
            <FolderTree
              folders={folders}
              selectedFolderId={selectedFolderId}
              currentUserId={user?.id ?? ""}
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
              <>
                <FolderBreadcrumb
                  folders={folders}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={setSelectedFolderId}
                />
                {selectedFolder && (
                  <FolderDetail
                    folder={selectedFolder}
                    documents={folderDocuments}
                    subfolderCount={subfolderCount}
                  />
                )}
              </>
            )}
            <DocumentUpload
              onUpload={upload}
              uploading={uploading}
              uploadingCount={uploadingCount}
              folderId={selectedFolderId}
              folderName={selectedFolderName}
              disabled={!canUploadToFolder}
            />

            <DocumentList
              documents={documents}
              onDelete={deleteDoc}
              onRefresh={loadDocuments}
              folderId={selectedFolderId}
              currentUserId={user?.id ?? ""}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
