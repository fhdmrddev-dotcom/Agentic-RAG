import { useState, useMemo } from "react"
import { DocumentUpload } from "@/components/ingestion/DocumentUpload"
import { DocumentList } from "@/components/ingestion/DocumentList"
import { DocumentDetailPanel } from "@/components/metadata/DocumentDetailPanel"
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
  // Phase 112 (D-01): the open document for the right-side push/split detail panel.
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)

  // Resolve the selected doc from the live documents array so it tracks edits +
  // re-fetches (loadDocuments reconcile). Falls back to closed if it disappears.
  const selectedDoc = useMemo(
    () => (selectedDocId === null ? null : documents.find((d) => d.id === selectedDocId) ?? null),
    [selectedDocId, documents],
  )

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

          {/* Right region: push/split grid (D-01). The list shrinks but stays
              visible (minmax(0,1fr)) while a fixed 430px detail-panel track mounts
              when a document is selected. The panel owns its own mobile bottom-sheet
              fallback (useIsMobile < 768) — on desktop only does the 430px track show. */}
          <div
            className="grid flex-1 min-h-0 min-w-0 gap-6"
            style={{
              gridTemplateColumns: selectedDoc ? "minmax(0,1fr) 430px" : "minmax(0,1fr)",
            }}
          >
            {/* Document list column */}
            <div className="flex flex-col overflow-y-auto space-y-6 min-w-0">
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
                onSelect={setSelectedDocId}
                selectedDocId={selectedDocId}
              />
            </div>

            {/* Detail panel track (desktop) — the panel renders a bottom-sheet on
                mobile internally, so this track is only meaningful ≥768px. */}
            {selectedDoc && (
              <DocumentDetailPanel
                doc={selectedDoc}
                onClose={() => setSelectedDocId(null)}
                onReconcile={loadDocuments}
              />
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
