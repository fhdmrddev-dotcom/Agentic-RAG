import { useState, useMemo, useEffect } from "react"
import { Folder } from "lucide-react"
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
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ActiveView } from "@/App"

// Mirrors the local hook in WorkspacePanel/DocumentDetailPanel (768px = the app's
// mobile breakpoint). On the Documents page it drives two things: hiding the fixed
// 288px folder tree (reachable via a bottom-sheet instead) and collapsing the
// push/split grid to a single full-width column so the list never gets crushed.
const MOBILE_BREAKPOINT = 768

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT,
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return isMobile
}

export function IngestionPage({ onNavigate }: { onNavigate?: (view: ActiveView) => void } = {}) {
  const { user } = useAuth()
  const { documents, uploading, uploadingCount, upload, deleteDoc, loadDocuments } = useDocuments()
  const { folders, createFolder, renameFolder, deleteFolder, toggleGlobal } = useFolders()
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  // Phase 112 (D-01): the open document for the right-side push/split detail panel.
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const isMobile = useIsMobile()
  // Mobile only: the folder tree lives in a bottom-sheet (desktop shows it inline).
  const [folderSheetOpen, setFolderSheetOpen] = useState(false)

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

  // The folder tree is rendered identically on desktop (inline sidebar) and mobile
  // (bottom-sheet) — define it once. Selecting a folder also dismisses the mobile
  // sheet (harmless on desktop, where the sheet is never open).
  const folderTreeEl = (
    <FolderTree
      folders={folders}
      selectedFolderId={selectedFolderId}
      currentUserId={user?.id ?? ""}
      rootDocumentCount={rootDocumentCount}
      onSelectFolder={(id) => {
        setSelectedFolderId(id)
        setFolderSheetOpen(false)
      }}
      onCreateFolder={createFolder}
      onRenameFolder={renameFolder}
      onDeleteFolder={deleteFolder}
      onToggleGlobal={toggleGlobal}
    />
  )

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
          {/* Left panel: Folder Tree — desktop only. Below 768px it would eat the
              full width and crush the document list, so it hides here and is reached
              via the "Folders" bottom-sheet trigger inside the list column. */}
          <div className="hidden md:flex w-72 shrink-0 flex-col overflow-y-auto rounded-xl bg-card/50 ghost-border p-3">
            {folderTreeEl}
          </div>

          {/* Right region: push/split grid (D-01). The list shrinks but stays
              visible (minmax(0,1fr)) while a fixed 430px detail-panel track mounts
              when a document is selected. On mobile the detail panel is a bottom-sheet
              (portal, out of flow), so the grid stays a single full-width column. */}
          <div
            className="grid flex-1 min-h-0 min-w-0 gap-6"
            style={{
              gridTemplateColumns:
                !isMobile && selectedDoc ? "minmax(0,1fr) 430px" : "minmax(0,1fr)",
            }}
          >
            {/* Document list column */}
            <div className="flex flex-col overflow-y-auto space-y-6 min-w-0">
              {/* Mobile-only folder access — opens the tree as a bottom-sheet. */}
              <button
                type="button"
                onClick={() => setFolderSheetOpen(true)}
                className="md:hidden flex items-center gap-2 rounded-xl bg-card/50 ghost-border px-3 py-2.5 text-sm font-medium text-foreground"
              >
                <Folder className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span>Folders</span>
                <span className="ml-auto text-muted-foreground">
                  {selectedFolderName ?? "Root"}
                </span>
              </button>
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

        {/* Mobile folder navigation — the desktop sidebar lives here as a
            bottom-sheet below 768px. */}
        <Sheet open={folderSheetOpen} onOpenChange={setFolderSheetOpen}>
          <SheetContent side="bottom" className="max-h-[80vh] p-3">
            {folderTreeEl}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  )
}
