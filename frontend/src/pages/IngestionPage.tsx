import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Folder, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, X } from "lucide-react"
import { DocumentUpload } from "@/components/ingestion/DocumentUpload"
import { DocumentList } from "@/components/ingestion/DocumentList"
import { DocumentDetailPanel } from "@/components/metadata/DocumentDetailPanel"
import { FolderBreadcrumb } from "@/components/ingestion/FolderBreadcrumb"
import { FolderDetail } from "@/components/ingestion/FolderDetail"
import { FolderTree } from "@/components/ingestion/FolderTree"
import { FilterBar } from "@/components/ingestion/FilterBar"
import { ViewsGroup } from "@/components/ingestion/ViewsGroup"
import { ReembedSearchPointer } from "@/components/settings/ReembedStatusCard"
import { useDocuments } from "@/hooks/useDocuments"
import { useFolders } from "@/hooks/useFolders"
import { useAuth } from "@/hooks/useAuth"
import {
  listMetadataFields,
  listViews,
  resolveView,
  resolveAdHoc,
  updateView,
} from "@/lib/api"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { EMPTY_FILTER } from "@/types"
import type { Document, MetadataFieldDef, SavedView, ViewFilter } from "@/types"
import type { ActiveView } from "@/App"

// Mirrors the local hook in WorkspacePanel/DocumentDetailPanel (768px = the app's
// mobile breakpoint). On the Documents page it drives two things: hiding the fixed
// 288px folder tree (reachable via a bottom-sheet instead) and collapsing the
// push/split grid to a single full-width column so the list never gets crushed.
const MOBILE_BREAKPOINT = 768

// Above this width the page is roomy enough to show the Folders+Views sidebar AND
// the 430px detail panel AND a usable (column-shed) list at the same time — so the
// panel-open auto-collapse to a rail is NOT applied. That collapse (D-114-17, sketch
// 032-A) was designed for the ≤~1440px "4-column crunch"; on a wide screen it only
// hides the folders for no benefit. Below this width the rail behavior still earns
// its keep (the list would otherwise be crushed beside the panel).
const WIDE_BREAKPOINT = 1536

// Phase 114 (D-114-17): the sidebar→rail collapse is user-pinnable + session-
// persisted (mirrors the workspace-panel collapse-to-rail precedent). The pin
// records the user's MANUAL intent so auto-collapse on panel-open doesn't yo-yo.
const SIDEBAR_PIN_KEY = "documents.sidebar.pinnedExpanded"

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

function useIsWide(): boolean {
  const [isWide, setIsWide] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= WIDE_BREAKPOINT,
  )
  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= WIDE_BREAKPOINT)
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return isWide
}

export function IngestionPage({ onNavigate }: { onNavigate?: (view: ActiveView) => void } = {}) {
  const { user } = useAuth()
  const { documents, uploading, uploadingCount, upload, deleteDoc, loadDocuments } = useDocuments()
  const { folders, createFolder, renameFolder, deleteFolder, toggleGlobal } = useFolders()
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  // Phase 114 (UX-01): a saved-view selection, MUTUALLY EXCLUSIVE with the folder
  // selection (state-based nav, NO react-router). Selecting a view clears the
  // folder selection and vice-versa.
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null)
  // Phase 114 (D-114-3): the view currently being EDITED. When set the FilterBar's
  // Save PATCHes this same view (updateView) instead of POSTing a new one; cleared
  // after a successful save and whenever the user starts composing ad-hoc again.
  const [editingView, setEditingView] = useState<SavedView | null>(null)
  // Phase 112 (D-01): the open document for the right-side push/split detail panel.
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const isMobile = useIsMobile()
  const isWide = useIsWide()
  // Mobile only: the folder tree lives in a bottom-sheet (desktop shows it inline).
  const [folderSheetOpen, setFolderSheetOpen] = useState(false)

  // ── Phase 114: the filter bar + Views group state ───────────────────────────
  const [customFields, setCustomFields] = useState<MetadataFieldDef[]>([])
  const [views, setViews] = useState<SavedView[]>([])
  // The controlled filter the FilterBar shows — loaded FROM a selected view or
  // composed ad-hoc (the SAME surface, D-114-1).
  const [filter, setFilter] = useState<ViewFilter>(EMPTY_FILTER)
  // The documents resolved by the active filter / selected view (drives the list
  // when a filter is active; null = "no active filter, show the folder view").
  const [filteredDocs, setFilteredDocs] = useState<Document[] | null>(null)
  // The own+global DISTINCT-deduped match count from the SAME resolve that fills the
  // list (114 CR-01: the page and the FilterBar share ONE resolve per filter change —
  // the bar no longer fires its own separate count round-trip). null while unknown.
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const filterReqId = useRef(0)

  // Load the field defs (for the operator menu) + the saved views once.
  useEffect(() => {
    listMetadataFields().then(setCustomFields).catch(() => setCustomFields([]))
    listViews().then(setViews).catch(() => setViews([]))
  }, [])

  const refreshViews = useCallback(() => {
    listViews().then(setViews).catch(() => {})
  }, [])

  // ── Phase 114 (D-114-17): sidebar→rail collapse on panel-open, pinnable ──────
  // Default-on collapse the first time the detail panel opens; respect a manual
  // re-expand (the pin), session-persisted so the choice survives reload.
  const [sidebarPinnedExpanded, setSidebarPinnedExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.sessionStorage.getItem(SIDEBAR_PIN_KEY) === "true"
  })
  useEffect(() => {
    try {
      window.sessionStorage.setItem(SIDEBAR_PIN_KEY, String(sidebarPinnedExpanded))
    } catch {
      /* sessionStorage may be unavailable (private mode) — non-fatal */
    }
  }, [sidebarPinnedExpanded])

  // Resolve the selected doc from the live documents array so it tracks edits +
  // re-fetches (loadDocuments reconcile). Falls back to closed if it disappears.
  const selectedDoc = useMemo(
    () => (selectedDocId === null ? null : documents.find((d) => d.id === selectedDocId) ?? null),
    [selectedDocId, documents],
  )

  // The sidebar collapses to a rail when the detail panel is open UNLESS the user
  // pinned it expanded. Mobile never rails (the sidebar is a bottom-sheet there).
  const panelOpen = !isMobile && selectedDoc !== null
  // On a wide screen there's room for the sidebar AND the panel, so keep the folders
  // visible when the panel opens (the rail only earns its keep at the ≤~1440px crunch
  // — sketch 032-A / D-114-17). Below WIDE_BREAKPOINT the rail behavior is unchanged.
  const sidebarRail = panelOpen && !sidebarPinnedExpanded && !isWide
  // The filter bar collapses to a summary chip when the panel is open (D-114-17).
  const [filterChipExpanded, setFilterChipExpanded] = useState(false)
  const filterActive = filter.conditions.length > 0

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

  // Phase 114 (D-114-13/8): per-folder document counts so every NavRow shows a
  // count (parity with the mandated View count). Sourced from the documents the
  // page already holds — no per-folder resolve call (would degrade at ~10k docs).
  const folderDocumentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const d of documents) {
      if (d.folder_id) counts[d.folder_id] = (counts[d.folder_id] ?? 0) + 1
    }
    return counts
  }, [documents])

  // ── Resolve an active filter into the list (the SAME surface for ad-hoc + saved,
  // D-114-1). A saved view resolves by id (`resolveView`); an UNSAVED ad-hoc filter
  // resolves via the stateless `resolveAdHoc` endpoint (114 CR-01) — NO transient
  // create/delete, NO audit pollution. This is the SINGLE resolve per filter change:
  // it fills the list AND captures the own+global match count, which the FilterBar
  // consumes (it no longer fires its own count round-trip). An empty filter clears
  // the override so the folder view shows again. ───────────────────────────────
  const resolveFilterIntoList = useCallback(async (f: ViewFilter, savedViewId?: string) => {
    if (f.conditions.length === 0) {
      setFilteredDocs(null)
      setMatchCount(null)
      return
    }
    const myReq = ++filterReqId.current
    try {
      const { documents: d, total } = savedViewId
        ? await resolveView(savedViewId)
        : await resolveAdHoc(f)
      // Ignore a stale resolve if a newer filter change superseded it.
      if (myReq === filterReqId.current) {
        setFilteredDocs(d ?? [])
        setMatchCount(total)
      }
    } catch {
      if (myReq === filterReqId.current) {
        setFilteredDocs(null)
        setMatchCount(null)
      }
    }
  }, [])

  // ── View / filter selection handlers (mutually exclusive with folders) ──────
  const handleSelectFolder = useCallback((id: string | null) => {
    setSelectedFolderId(id)
    setSelectedViewId(null) // mutually exclusive (UX-01)
    setEditingView(null) // leaving the view surface exits edit mode (D-114-3)
    setFilter(EMPTY_FILTER)
    setFilteredDocs(null)
    setFolderSheetOpen(false)
  }, [])

  const handleSelectView = useCallback((view: SavedView) => {
    setSelectedViewId(view.id)
    setSelectedFolderId(null) // mutually exclusive (UX-01)
    setEditingView(null) // viewing (not editing) — a Save here would be a new view
    setFilter(view.filter_expr) // load the filter back INTO the bar (D-114-1)
    setFolderSheetOpen(false)
    void resolveFilterIntoList(view.filter_expr, view.id)
  }, [resolveFilterIntoList])

  const handleEditView = useCallback((view: SavedView) => {
    // Edit reopens the bar pre-filled AND enters edit mode (D-114-3/9): the
    // FilterBar's Save now PATCHes this same view (editingView prop → updateView)
    // instead of POSTing a new one.
    setSelectedViewId(view.id)
    setSelectedFolderId(null)
    setEditingView(view)
    setFilter(view.filter_expr)
    void resolveFilterIntoList(view.filter_expr, view.id)
  }, [resolveFilterIntoList])

  // The FilterBar drives the list as conditions change (ad-hoc == saved). Editing
  // the bar drops the saved-view label (you are now composing, D-114-1). It does
  // NOT exit edit mode — an explicit "Edit view" still saves back to that view;
  // edit mode is cleared on save or on a context switch (select folder/view).
  const handleFilterChange = useCallback((next: ViewFilter) => {
    setFilter(next)
    setSelectedViewId(null)
    void resolveFilterIntoList(next)
  }, [resolveFilterIntoList])

  const handleViewSaved = useCallback((view: SavedView) => {
    refreshViews()
    setSelectedViewId(view.id)
    setEditingView(null) // save completed — back to viewing the saved row (D-114-3)
  }, [refreshViews])

  const handleRenameView = useCallback(async (id: string, name: string) => {
    await updateView(id, { name })
    setViews((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)))
  }, [])

  const handleDeletedView = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id))
    setEditingView((cur) => (cur?.id === id ? null : cur)) // can't edit a deleted view
    if (selectedViewId === id) {
      setSelectedViewId(null)
      setFilter(EMPTY_FILTER)
      setFilteredDocs(null)
    }
  }, [selectedViewId])

  // The sidebar groups (Folders + Views) are rendered identically on desktop
  // (inline) and mobile (bottom-sheet) — define once. The Views group sits below
  // the Folders tree, both built from the shared NavRow.
  const sidebarGroupsEl = (
    <div className="flex flex-col gap-5">
      <FolderTree
        folders={folders}
        selectedFolderId={selectedViewId === null ? selectedFolderId : null}
        currentUserId={user?.id ?? ""}
        rootDocumentCount={rootDocumentCount}
        folderDocumentCounts={folderDocumentCounts}
        onSelectFolder={handleSelectFolder}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        onToggleGlobal={toggleGlobal}
      />
      <ViewsGroup
        views={views}
        selectedViewId={selectedViewId}
        onSelectView={handleSelectView}
        onEditView={handleEditView}
        onRenameView={handleRenameView}
        onDeleted={handleDeletedView}
      />
    </div>
  )

  // When a filter/view is active the list shows the resolved set (folderId
  // undefined → DocumentList does no further folder filtering); otherwise it
  // shows the selected folder's documents.
  const listDocuments = filteredDocs !== null ? filteredDocs : documents
  const listFolderId = filteredDocs !== null ? undefined : selectedFolderId

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
          {/* Left panel: Folders + Views — desktop only. Below 768px it would eat
              the full width and crush the document list, so it hides here and is
              reached via the "Folders" bottom-sheet trigger inside the list column.
              Phase 114 (D-114-17): collapses to a ~50px icon rail when the detail
              panel opens (unless the user pinned it expanded). */}
          <div
            className={cn(
              "hidden md:flex shrink-0 flex-col overflow-y-auto rounded-xl bg-card/50 ghost-border transition-[width,padding] duration-300 ease-out",
              sidebarRail ? "w-[50px] p-2 items-center" : "w-72 p-3",
            )}
          >
            {sidebarRail ? (
              // Rail mode: a single expand affordance; the groups are hidden until
              // the user pins the sidebar open (D-114-17, the shared-shell rail
              // Phases 117/118 inherit).
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Expand sidebar"
                    onClick={() => setSidebarPinnedExpanded(true)}
                    className="h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Folders &amp; Views</TooltipContent>
              </Tooltip>
            ) : (
              <>
                {/* When the panel is open but pinned-expanded, offer a collapse
                    affordance so the user can reclaim the list width on demand.
                    Not offered on wide screens — there the sidebar always stays
                    expanded (the rail isn't used), so a collapse control would no-op. */}
                {panelOpen && !isWide && (
                  <div className="flex justify-end mb-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Collapse sidebar"
                          onClick={() => setSidebarPinnedExpanded(false)}
                          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                          <PanelLeftClose className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Collapse to rail</TooltipContent>
                    </Tooltip>
                  </div>
                )}
                {sidebarGroupsEl}
              </>
            )}
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
            {/* Document list column. When the detail panel is open the static
                7-column table is too wide beside the 430px panel, so we shed the
                Type/Size/Chunks columns via a scoped CSS wrapper (col order is
                fixed: chevron·Filename·Type·Size·Chunks·Status·Actions) — keeping
                Filename + Status + Actions (D-114-17, column-shedding net-new). */}
            <div
              className={cn(
                "flex flex-col overflow-y-auto space-y-4 min-w-0",
                // Column-shedding (D-114-17, net-new): when the panel is open hide
                // the Type/Size/Chunks columns (3rd–5th cells of the list table —
                // fixed order chevron·Filename·Type·Size·Chunks·Status·Actions),
                // keeping Filename + Status + Actions. Scoped to the list table via
                // an arbitrary descendant variant so no shared CSS file is touched.
                panelOpen &&
                  "[&_table_th:nth-child(n+3):nth-child(-n+5)]:hidden [&_table_td:nth-child(n+3):nth-child(-n+5)]:hidden",
              )}
            >
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

              {/* Folder / view header band — title + count on the LEFT; the upload
                  control fills the otherwise-empty top-right corner (best use of the
                  wide header row — previously a separate full-width upload block sat
                  below an empty corner). Upload is folder-scoped → omitted while a
                  saved view is the active surface (a view is a filter, not a target). */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {selectedViewId === null && selectedFolderId === null && (
                    <>
                      <h2 className="text-lg font-semibold leading-tight">Root</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Documents not assigned to a folder · {rootDocumentCount}{" "}
                        {rootDocumentCount === 1 ? "document" : "documents"}
                      </p>
                    </>
                  )}
                  {selectedViewId === null && selectedFolderId !== null && (
                    <>
                      <FolderBreadcrumb
                        folders={folders}
                        selectedFolderId={selectedFolderId}
                        onSelectFolder={handleSelectFolder}
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
                  {selectedViewId !== null && (
                    <>
                      <h2 className="text-lg font-semibold leading-tight">
                        {views.find((v) => v.id === selectedViewId)?.name ?? "View"}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Documents matching this saved filter.
                      </p>
                    </>
                  )}
                </div>

                {selectedViewId === null && (
                  <DocumentUpload
                    onUpload={upload}
                    uploading={uploading}
                    uploadingCount={uploadingCount}
                    folderId={selectedFolderId}
                    folderName={selectedFolderName}
                    disabled={!canUploadToFolder}
                    // Panel open → narrow header column → icon + short "Upload" only,
                    // so a long folder name can't overflow into the breadcrumb.
                    compact={panelOpen}
                  />
                )}
              </div>

              {/* Phase 114: the inline filter/view builder (D-114-1). Ad-hoc
                  filtering and a loaded saved view are the SAME surface. When the
                  detail panel is open the bar collapses to a summary chip to
                  reclaim room (D-114-17). */}
              {panelOpen && !filterChipExpanded ? (
                <button
                  type="button"
                  onClick={() => setFilterChipExpanded(true)}
                  className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {filterActive
                    ? `${filter.conditions.length} ${filter.conditions.length === 1 ? "filter" : "filters"}`
                    : "Filter"}
                </button>
              ) : (
                <div className="rounded-xl bg-card/30 ghost-border p-3">
                  {panelOpen && (
                    <div className="flex justify-end -mt-1 -mr-1 mb-1">
                      <button
                        type="button"
                        aria-label="Collapse filter bar"
                        onClick={() => setFilterChipExpanded(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <FilterBar
                    customFields={customFields}
                    value={filter}
                    onChange={handleFilterChange}
                    onViewSaved={handleViewSaved}
                    editingView={editingView}
                    matchCount={matchCount}
                  />
                </div>
              )}

              <DocumentList
                documents={listDocuments}
                onDelete={deleteDoc}
                onRefresh={loadDocuments}
                folderId={listFolderId}
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

        {/* Mobile folder + Views navigation — the desktop sidebar lives here as a
            bottom-sheet below 768px (both groups, internally sectioned). */}
        <Sheet open={folderSheetOpen} onOpenChange={setFolderSheetOpen}>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto p-3">
            {sidebarGroupsEl}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  )
}
