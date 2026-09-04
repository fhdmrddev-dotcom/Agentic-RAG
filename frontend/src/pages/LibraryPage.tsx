import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useReducer,
  useRef,
  type ReactNode,
} from "react"
import { Folder, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, X } from "lucide-react"
import { DocumentUpload } from "@/components/ingestion/DocumentUpload"
import { DocumentList } from "@/components/ingestion/DocumentList"
import { DocumentDetailPanel } from "@/components/metadata/DocumentDetailPanel"
import { FolderBreadcrumb } from "@/components/ingestion/FolderBreadcrumb"
import { FolderDetail } from "@/components/ingestion/FolderDetail"
import { FolderTree } from "@/components/ingestion/FolderTree"
import { FilterBar } from "@/components/ingestion/FilterBar"
import { ViewsGroup } from "@/components/ingestion/ViewsGroup"
import { ViewsTab } from "@/components/library/ViewsTab"
import { IngestionTab } from "@/components/library/IngestionTab"
import { IndexingTab } from "@/components/library/IndexingTab"
import { HealthTab } from "@/components/library/HealthTab"
import { LibraryStatTiles } from "@/components/library/LibraryStatTiles"
import { LibraryBreadcrumb } from "@/components/library/LibraryBreadcrumb"
import { DocumentsPager } from "@/components/library/DocumentsPager"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useCitationNavOptional } from "@/lib/citationNav"
import { cn } from "@/lib/utils"
import { EMPTY_FILTER } from "@/types"
import type { Document, MetadataFieldDef, SavedView, ViewFilter } from "@/types"
import type { ActiveView } from "@/App"
import {
  activeFolderId,
  activeViewId,
  initialLibraryState,
  libraryReducer,
  type LibraryAction,
  type LibraryState,
  type LibraryTab,
} from "./librarySelection"

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
// ⛔ STORED STATE — NOT renamed with the page (Phase 217 SC#1). The literal is a
// sessionStorage key; renaming it silently resets every user's pinned sidebar.
const SIDEBAR_PIN_KEY = "documents.sidebar.pinnedExpanded"

// ⛔ POSITIONAL AND LOAD-BEARING — DO NOT EDIT THE SELECTORS (T-217-35).
// Column-shedding (D-114-17, net-new): hide the Type/Size/Chunks columns (3rd–5th cells of
// the list table — FIXED order chevron·Filename·Type·Size·Chunks·Status·Actions), keeping
// Filename + Status + Actions. Applied (a) when the detail panel is open beside the list and
// (b) on mobile (<768px), where the full 7-column table would otherwise force a horizontal
// scroll. Scoped to the list table via an arbitrary descendant variant so no shared CSS file
// is touched.
// ⚠ The column ORDER this depends on is fixed in `DocumentList.tsx:349-355`, a file this one
// does NOT import — so a reorder there silently sheds the wrong three columns here. The rule
// was hoisted to a named constant at Phase 217-09 so the two surfaces that mount the list
// (the Documents tab and the Views tab) share ONE copy of it rather than two.
const SHED_COLUMNS_3_TO_5 =
  "[&_table_th:nth-child(n+3):nth-child(-n+5)]:hidden [&_table_td:nth-child(n+3):nth-child(-n+5)]:hidden"

// Phase 217.1-06 — the tab's display name, for the breadcrumb suffix. Five members only;
// a sixth key is the same schema change as a sixth trigger (D-217-15).
const TAB_LABELS: Record<LibraryTab, string> = {
  documents: "Documents",
  views: "Views",
  ingestion: "Ingestion",
  indexing: "Indexing",
  health: "Health",
}

// ── The page's own reducer ────────────────────────────────────────────────────────────
//
// ⭐ ONE SOURCE OF SELECTION TRUTH (D-217-12 / SC#5). `libraryReducer` (plan 05) owns every
// selection transition; this wrapper delegates to it untouched and adds exactly one action
// the leaf cannot express.
//
// ⚠ WHY THE WRAPPER EXISTS, MEASURED RATHER THAN ASSUMED: `LibraryState.folderSheetOpen` is
// declared by the leaf and CLEARED by `SELECT_FOLDER` / `SELECT_VIEW`, but **no action in
// `LibraryAction` sets it to `true`** and `initialLibraryState` starts it `false`. It is a
// one-way CLOSE signal with no opener, so a page that dispatched only leaf actions could
// never open the mobile folder sheet. The opener is composed HERE, at the page boundary,
// rather than by editing the leaf — whose 25-case suite asserts the action set is exactly
// six. The state stays ONE object; nothing about the selection is decided outside the leaf.
type LibState = LibraryState<ViewFilter, SavedView>
type PageAction =
  | LibraryAction<ViewFilter, SavedView>
  | { type: "SET_FOLDER_SHEET"; open: boolean }

function pageReducer(state: LibState, action: PageAction): LibState {
  if (action.type === "SET_FOLDER_SHEET") {
    return { ...state, folderSheetOpen: action.open }
  }
  return libraryReducer<ViewFilter, SavedView>(state, action)
}

// ⛔ FIVE TABS: Documents, Views, Ingestion, Indexing, Health. Built incrementally through
// Phase 217.1 plans 03-12 — each tab body is a CHILD component with its own data fetching
// and state, so no conditional branch enters this component.

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

export function LibraryPage({ onNavigate }: { onNavigate?: (view: ActiveView) => void } = {}) {
  const { user } = useAuth()
  const { documents, uploading, uploadingCount, upload, deleteDoc, loadDocuments } = useDocuments()
  const { folders, createFolder, renameFolder, deleteFolder, toggleOrgShared } = useFolders()

  // ⭐ ONE reducer replaces `selectedFolderId`, `selectedViewId`, `editingView`, `filter` and
  // `folderSheetOpen` — five React state hooks and the five handlers that had to keep them
  // consistent by hand. The tab is PART of the selection, never a variable beside it.
  const [lib, dispatch] = useReducer(pageReducer, initialLibraryState)
  const tab = lib.selection.tab
  const selectedFolderId = activeFolderId(lib)
  const selectedViewId = activeViewId(lib)
  const editingView = lib.editingView
  // `null` in the leaf means "no filter composed" (it has zero imports and cannot name
  // EMPTY_FILTER). The equivalence is fenced by the leaf's own suite.
  const filter = lib.filter ?? EMPTY_FILTER

  // Phase 112 (D-01): the open document for the right-side push/split detail panel.
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const isMobile = useIsMobile()
  const isWide = useIsWide()

  // ── Phase 114: the filter bar + Views group state ───────────────────────────
  const [customFields, setCustomFields] = useState<MetadataFieldDef[]>([])
  const [views, setViews] = useState<SavedView[]>([])
  // The documents resolved by the active filter / selected view (drives the list
  // when a filter is active; null = "no active filter, show the folder view").
  // ⛔ NOT in the reducer, by decision: this is an ASYNC RESULT, not a selection.
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

  // Phase 153 (CITE-01 / SC#2 / T-153-02-01): consume the one-shot cross-view
  // "Open document" intent from a chat citation. We route it through the EXISTING
  // owner/RLS-scoped panel by pre-selecting the id and letting `selectedDoc`
  // resolve it from the user's OWN owner-scoped `documents` list — a document the
  // user cannot see simply never resolves, so there is NO new unscoped fetch by
  // raw document_id. Optional accessor so the page still renders in isolation
  // (no provider) in unit tests. One-shot: consume so re-opening / closing works.
  const citationNav = useCitationNavOptional()
  const pendingDocumentId = citationNav?.pendingDocumentId ?? null
  const consumePendingDocument = citationNav?.consumePendingDocument
  useEffect(() => {
    if (!pendingDocumentId) return
    setSelectedDocId(pendingDocumentId)
    consumePendingDocument?.()
  }, [pendingDocumentId, consumePendingDocument])

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

  // ── View / filter selection handlers ────────────────────────────────────────
  // ⭐ Each is now ONE dispatch plus, where the shipped handler also kicked an async
  // resolve, that resolve. Nothing here re-derives the mutual exclusion by hand: the
  // reducer already encodes every clear and every reset these handlers used to perform.
  const handleSelectFolder = useCallback((id: string | null) => {
    dispatch({ type: "SELECT_FOLDER", folderId: id })
    setFilteredDocs(null)
  }, [])

  const handleSelectView = useCallback((view: SavedView) => {
    dispatch({ type: "SELECT_VIEW", view })
    void resolveFilterIntoList(view.filter_expr, view.id)
  }, [resolveFilterIntoList])

  const handleEditView = useCallback((view: SavedView) => {
    // Edit reopens the bar pre-filled AND enters edit mode (D-114-3/9): the
    // FilterBar's Save now PATCHes this same view (editingView prop → updateView)
    // instead of POSTing a new one.
    dispatch({ type: "EDIT_VIEW", view })
    void resolveFilterIntoList(view.filter_expr, view.id)
  }, [resolveFilterIntoList])

  // The FilterBar drives the list as conditions change (ad-hoc == saved). Editing
  // the bar drops the saved-view label (you are now composing, D-114-1). It does
  // NOT exit edit mode — an explicit "Edit view" still saves back to that view.
  const handleFilterChange = useCallback((next: ViewFilter) => {
    dispatch({ type: "CHANGE_FILTER", filter: next })
    void resolveFilterIntoList(next)
  }, [resolveFilterIntoList])

  const handleViewSaved = useCallback((view: SavedView) => {
    refreshViews()
    // Save completed — back to VIEWING the saved row (D-114-3). One action does both
    // halves of what `setSelectedViewId` + `setEditingView(null)` used to do.
    dispatch({ type: "SELECT_VIEW", view })
  }, [refreshViews])

  const handleRenameView = useCallback(async (id: string, name: string) => {
    await updateView(id, { name })
    setViews((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)))
  }, [])

  const handleDeletedView = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id))
    dispatch({ type: "DELETE_VIEW", viewId: id })
    if (selectedViewId === id) setFilteredDocs(null)
  }, [selectedViewId])

  // The sidebar groups (Folders + Views) are rendered identically on desktop
  // (inline) and mobile (bottom-sheet) — define once. The Views group sits below
  // the Folders tree, both built from the shared NavRow.
  // ⭐ SC#5: `activeFolderId(lib)` and `activeViewId(lib)` replace the render-time ternary
  // this file used to carry on the FolderTree's `selectedFolderId` prop — it nulled the
  // folder whenever a view was loaded. That ternary was the SECOND encoding of the mutual
  // exclusion; the union carries it now, so the ternary is DELETED rather than moved, and
  // the Views TAB body below is handed the SAME `selectedViewId` this sidebar receives.
  const sidebarGroupsEl = (
    <div className="flex flex-col gap-5" data-testid="library-sidebar">
      <FolderTree
        folders={folders}
        selectedFolderId={selectedFolderId}
        currentUserId={user?.id ?? ""}
        rootDocumentCount={rootDocumentCount}
        folderDocumentCounts={folderDocumentCounts}
        onSelectFolder={handleSelectFolder}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        onToggleOrgShared={toggleOrgShared}
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
  // scopes to the selected folder's (or Root's) documents BEFORE paging.
  const folderScopedDocuments = useMemo(() => {
    if (filteredDocs !== null) return filteredDocs
    if (selectedFolderId === null) {
      return documents.filter((d) => d.folder_id == null)
    }
    return documents.filter((d) => d.folder_id === selectedFolderId)
  }, [filteredDocs, selectedFolderId, documents])

  const listDocuments = folderScopedDocuments
  const listFolderId = filteredDocs !== null ? undefined : selectedFolderId

  // Phase 217.1-06 (LIB-01) — the Documents tab's client-side pager state. The offset
  // keys off (folder, view, filter) changes so a navigation never strands a stale page.
  const [pageOffset, setPageOffset] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  useEffect(() => {
    setPageOffset(0)
  }, [selectedFolderId, filteredDocs])

  // ⛔ Client-side slice. `GET /documents` is unpaginated (documents.py:726-760), so the
  // denominator here is real — bounded by PostgREST's 1000-row ceiling, which the pager's
  // honest arm names (WR-04 / T-217.1-11a). Views' server-resolved list is NOT re-sliced
  // here — a saved view's row count is its own resolve, not the pager's business.
  const pagedDocuments =
    filteredDocs !== null ? listDocuments : listDocuments.slice(pageOffset, pageOffset + pageSize)

  // Phase 114: the inline filter/view builder (D-114-1). Ad-hoc filtering and a
  // loaded saved view are the SAME surface. When the detail panel is open the bar
  // collapses to a summary chip to reclaim room (D-114-17).
  const filterBarEl =
    panelOpen && !filterChipExpanded ? (
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
    )

  // The document surface — the push/split grid (D-01). The list shrinks but stays visible
  // (minmax(0,1fr)) while a fixed 430px detail-panel track mounts when a document is
  // selected. On mobile the detail panel is a bottom-sheet (portal, out of flow), so the
  // grid stays a single full-width column.
  // ⭐ ONE definition, mounted by the Documents tab and the Views tab. `lead` is the only
  // thing that differs between them, which is what keeps the tab shell from becoming the
  // tenth conditional branch inside this component (the ledger's named seam for this file).
  const documentSurface = (lead: ReactNode) => (
    <div
      className="grid flex-1 min-h-0 min-w-0 gap-6"
      style={{
        gridTemplateColumns: !isMobile && selectedDoc ? "minmax(0,1fr) 430px" : "minmax(0,1fr)",
      }}
    >
      <div
        className={cn(
          "flex flex-col space-y-4 min-w-0",
          (panelOpen || isMobile) && SHED_COLUMNS_3_TO_5,
          // On mobile the Filename column must be allowed to break a long
          // unbreakable name (e.g. "Fahed_Mrad_Defense_Presentation") instead of
          // forcing the table wider — otherwise shedding alone wouldn't remove
          // the horizontal scroll.
          isMobile &&
            "[&_table_td:nth-child(2)_button]:whitespace-normal [&_table_td:nth-child(2)_button]:[overflow-wrap:anywhere]",
        )}
      >
        {lead}
        {filterBarEl}
        <div data-testid="documents-doclist">
          <DocumentList
            documents={pagedDocuments}
            onDelete={deleteDoc}
            onRefresh={loadDocuments}
            folderId={listFolderId}
            currentUserId={user?.id ?? ""}
            onSelect={setSelectedDocId}
            selectedDocId={selectedDocId}
            folders={folders}
          />
        </div>
        {/* Phase 217.1-06 — the client-side pager (the sketch's table footer). Shown on
            the folder view only; a filter/view resolve carries its own server count. */}
        {filteredDocs === null && (
          <div data-testid="documents-tfoot">
            <DocumentsPager
              total={listDocuments.length}
              offset={pageOffset}
              limit={pageSize}
              onChange={(off, lim) => {
                setPageOffset(off)
                setPageSize(lim)
              }}
            />
          </div>
        )}
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
  )

  // The Documents tab's lead: the mobile folder trigger, the FULL-WIDTH DROPZONE, and the
  // folder header band. ⭐ LIB-02 / SC#2 — the dropzone is on the LANDING tab, so a person
  // can start an upload without hunting for it, and it is mounted ONCE so the accepted
  // formats cannot diverge between two copies.
  const documentsLead = (
    <>
      {/* Mobile-only folder access — opens the tree as a bottom-sheet. */}
      <button
        type="button"
        onClick={() => dispatch({ type: "SET_FOLDER_SHEET", open: true })}
        className="md:hidden flex items-center gap-2 rounded-xl bg-card/50 ghost-border px-3 py-2.5 text-sm font-medium text-foreground"
      >
        <Folder className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span>Folders</span>
        <span className="ml-auto text-muted-foreground">{selectedFolderName ?? "Root"}</span>
      </button>

      <DocumentUpload
        onUpload={upload}
        uploading={uploading}
        uploadingCount={uploadingCount}
        folderId={selectedFolderId}
        folderName={selectedFolderName}
        disabled={!canUploadToFolder}
      />

      {/* Phase 217.1-06 (LIB-01 / D-217.1 sparkline-drop) — CHUNKS · VECTORS · FOUND BY
          A SEARCH. Numbers stand alone; an unreachable source says so. */}
      <LibraryStatTiles documents={documents} />

      <div className="min-w-0">
        {selectedFolderId === null ? (
          <>
            <h2 className="text-lg font-semibold leading-tight">Root</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Documents not assigned to a folder · {rootDocumentCount}{" "}
              {rootDocumentCount === 1 ? "document" : "documents"}
            </p>
          </>
        ) : (
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
      </div>
    </>
  )

  // The Views tab's lead: the picker (its own real content, D-217-13) and, when a view is
  // loaded, the header naming it. ⛔ Upload is folder-scoped and is therefore NOT offered
  // here — a view is a filter, not a target.
  // "New view" — the card grid's affordance opens the SAME compose flow FilterBar's
  // onViewSaved path already drives: start composing an empty filter (drops any loaded
  // saved-view label) and make sure the bar is expanded, never a new modal (D-217.1-07).
  const handleNewView = useCallback(() => {
    dispatch({ type: "CHANGE_FILTER", filter: EMPTY_FILTER })
    setFilterChipExpanded(true)
  }, [])

  const viewsLead = (
    <>
      <ViewsTab
        views={views}
        selectedViewId={selectedViewId}
        onSelectView={handleSelectView}
        onEditView={handleEditView}
        onRenameView={handleRenameView}
        onDeleted={handleDeletedView}
        corpusCount={listDocuments.length}
        onNewView={handleNewView}
      />
      {selectedViewId !== null && (
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">
            {views.find((v) => v.id === selectedViewId)?.name ?? "View"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Documents matching this saved filter.
          </p>
        </div>
      )}
    </>
  )

  // The Folders+Views sidebar belongs to the two tabs that navigate documents. It is
  // deliberately OUTSIDE the tab bodies so the sidebar mount and the Views tab mount are
  // alive at the same moment — which is what makes "they can never disagree" observable.
  const showSidebar = tab === "documents" || tab === "views"

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-y-auto p-8">
        {/* ⛔ THE HOOK FOLLOWS THE ACTIVE TAB (217.1-18): the pagehead is ONE shared shell
            element, and the contract names it per-screen (`<screen>-pagehead`). Dynamic so
            `views-pagehead`/`health-pagehead` resolve when that tab is active. */}
        <div className="mb-6" data-testid={`${tab}-pagehead`}>
          <h1 className="text-2xl font-headline font-bold text-foreground">Library</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            What the agent can read, and how well it reads it.
          </p>
        </div>

        {/* Phase 217.1-06 — Library › <folder> › <tab> breadcrumb, composed from the
            already-shipped FolderBreadcrumb. Additive; never replaces the heading. */}
        <div className="mb-4">
          <LibraryBreadcrumb
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={handleSelectFolder}
            tabLabel={TAB_LABELS[tab]}
          />
        </div>

        {/* Phase 111.1 follow-up #1: the slim "search is catching up" pointer.
            Self-fetches re-embed progress; auto-hides when nothing is pending.
            Deep-links directly to the Indexing tab where ReembedStatusCard lives. */}
        <div className="mb-4">
          <ReembedSearchPointer
            onViewProgress={() => {
              dispatch({ type: "SELECT_TAB", tab: "indexing" })
              setTimeout(() => {
                document
                  .getElementById("reembed-status-card")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }, 100)
            }}
          />
        </div>

        {/* ⭐ THE TAB SHELL. `value` IS the reducer's selection and a trigger click
            dispatches SELECT_TAB — the tab bar reads and writes the same state as the
            sidebar, never its own. There is no reachable render in which the tab and the
            list beneath it disagree, because there is nothing for them to disagree with. */}
        <Tabs
          value={tab}
          onValueChange={(next) => dispatch({ type: "SELECT_TAB", tab: next as LibraryTab })}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* ⛔ FIVE TRIGGERS. Written out rather than mapped so the set is
              countable by eye and by grep. */}
          <TabsList className="self-start mb-4" data-testid={`${tab}-tabslist`}>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="views">Views</TabsTrigger>
            <TabsTrigger value="ingestion">Ingestion</TabsTrigger>
            <TabsTrigger value="indexing">Indexing</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
          </TabsList>

          <div className="flex flex-row gap-6 flex-1 min-h-0">
            {/* Left panel: Folders + Views — desktop only. Below 768px it would eat
                the full width and crush the document list, so it hides here and is
                reached via the "Folders" bottom-sheet trigger inside the list column.
                Phase 114 (D-114-17): collapses to a ~50px icon rail when the detail
                panel opens (unless the user pinned it expanded). */}
            {showSidebar && (
              <div
                data-testid="documents-sidebar"
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
            )}

            {/* Each tab owns its body. ⛔ The tab bar is NOT a conditional branch inside the
                document surface — the surface is defined once and the tabs choose a lead. */}
            <TabsContent
              value="documents"
              className="mt-0 flex flex-1 min-h-0 min-w-0 flex-col data-[state=inactive]:hidden"
            >
              {documentSurface(documentsLead)}
            </TabsContent>

            <TabsContent
              value="views"
              className="mt-0 flex flex-1 min-h-0 min-w-0 flex-col data-[state=inactive]:hidden"
            >
              {documentSurface(viewsLead)}
            </TabsContent>

            <TabsContent
              value="ingestion"
              className="mt-0 flex flex-1 min-h-0 min-w-0 flex-col data-[state=inactive]:hidden"
            >
              <IngestionTab
                documents={documents}
                upload={upload}
                uploading={uploading}
                uploadingCount={uploadingCount}
                folderId={selectedFolderId}
                folderName={selectedFolderName}
                disabled={!canUploadToFolder}
              />
            </TabsContent>

            <TabsContent
              value="indexing"
              className="mt-0 flex flex-1 min-h-0 min-w-0 flex-col data-[state=inactive]:hidden"
            >
              <IndexingTab onNavigate={onNavigate} />
            </TabsContent>

            <TabsContent
              value="health"
              className="mt-0 flex flex-1 min-h-0 min-w-0 flex-col data-[state=inactive]:hidden"
            >
              <HealthTab />
            </TabsContent>
          </div>
        </Tabs>

        {/* Mobile folder + Views navigation — the desktop sidebar lives here as a
            bottom-sheet below 768px (both groups, internally sectioned). */}
        <Sheet
          open={lib.folderSheetOpen}
          onOpenChange={(open) => dispatch({ type: "SET_FOLDER_SHEET", open })}
        >
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto p-3">
            {sidebarGroupsEl}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  )
}
