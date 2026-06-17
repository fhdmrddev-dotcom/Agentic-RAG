import { useState, useMemo } from "react"
import { DocumentUpload } from "@/components/ingestion/DocumentUpload"
import { DocumentList } from "@/components/ingestion/DocumentList"
import { FolderBreadcrumb } from "@/components/ingestion/FolderBreadcrumb"
import { FolderDetail } from "@/components/ingestion/FolderDetail"
import { FolderTree } from "@/components/ingestion/FolderTree"
import { ReembedSearchPointer } from "@/components/settings/ReembedStatusCard"
import { useDocuments } from "@/hooks/useDocuments"
import { useFolders } from "@/hooks/useFolders"
import { useAuth } from "@/hooks/useAuth"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ActiveView } from "@/App"

export function IngestionPage({ onNavigate }: { onNavigate?: (view: ActiveView) => void } = {}) {
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

  const rootDocumentCount = useMemo(() => {
    return documents.filter((d) => d.folder_id == null).length
  }, [documents])

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-y-auto p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-headline font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Upload documents to give the AI context for your conversations.
          </p>
        </div>

        {/* Phase 111.1 follow-up #1: the slim "search is catching up" pointer.
            Self-fetches re-embed progress; auto-hides when remaining == 0. The
            deep-link switches to Settings and scrolls the status card into view. */}
        <div className="mb-4">
          <ReembedSearchPointer
            onViewProgress={
              onNavigate
                ? () => {
                    onNavigate("settings")
                    // Let the Settings view mount before scrolling its card in.
                    setTimeout(() => {
                      document
                        .getElementById("reembed-status-card")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }, 100)
                  }
                : undefined
            }
          />
        </div>

        <div className="flex flex-row gap-6 flex-1 min-h-0">
          {/* Left panel: Folder Tree */}
          <div className="w-72 shrink-0 flex flex-col overflow-y-auto rounded-xl bg-card/50 ghost-border p-3">
            <FolderTree
              folders={folders}
              selectedFolderId={selectedFolderId}
              currentUserId={user?.id ?? ""}
              rootDocumentCount={rootDocumentCount}
              onSelectFolder={setSelectedFolderId}
              onCreateFolder={createFolder}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              onToggleGlobal={toggleGlobal}
            />
          </div>

          {/* Right panel: Breadcrumb + Upload + Document List */}
          <div className="flex-1 flex flex-col overflow-y-auto space-y-6">
            {selectedFolderId === null && (
              <div>
                <h2 className="text-lg font-semibold">Root</h2>
                <p className="text-sm text-muted-foreground">Documents not assigned to a folder</p>
              </div>
            )}
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
