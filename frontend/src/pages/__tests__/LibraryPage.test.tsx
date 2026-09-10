/**
 * Integration tests for LibraryPage two-panel layout.
 *
 * Renamed from `src/__tests__/components/IngestionPage.test.tsx` at Phase 217 SC#1 —
 * the file moved and the page title changed; the surface did not.
 *
 * ── Phase 217-09: THE SHELL, NOT THE REDUCER ───────────────────────────────────────────
 * `src/pages/__tests__/librarySelection.test.ts` already proves every reducer transition
 * exhaustively (25 cases). These cases prove the WIRING — that both renderings of the
 * selection are handed the same value, that there are five tabs (Health added at 217.1-12),
 * and that the dropzone landed on the landing tab. They assert through the DOM on purpose:
 * a passing reducer suite says nothing about a page that forgot to call it.
 *
 * Mocks:
 * - @/hooks/useDocuments — returns sample documents with folder_id fields
 * - @/hooks/useFolders — returns sample folders
 * - @/lib/supabase — prevents real auth/channel calls
 * - @/lib/api — PARTIAL (importOriginal), so only the five functions this page and its
 *   children actually call are stubbed and every other export stays real
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Document, Folder, SavedView } from "@/types"

// ── Mock hooks ─────────────────────────────────────────────────────────────────
const {
  mockUseDocuments,
  mockUseFolders,
  mockListViews,
  mockResolveView,
  mockResolveAdHoc,
  mockListMetadataFields,
  mockGetReembedProgress,
  mockGetIndexSummary,
} = vi.hoisted(() => ({
  mockUseDocuments: vi.fn(),
  mockUseFolders: vi.fn(),
  mockListViews: vi.fn(),
  mockResolveView: vi.fn(),
  mockResolveAdHoc: vi.fn(),
  mockListMetadataFields: vi.fn(),
  mockGetReembedProgress: vi.fn(),
  mockGetIndexSummary: vi.fn(),
}))

// ⚠ PARTIAL mock. `@/lib/api` is a re-export barrel with ~12 domain modules behind it; a
// full replacement would have to declare every symbol the page's children import, and the
// one it forgot would throw at MOUNT with a message about a missing export rather than
// about the missing edit (the failure mode Phase 196-08 recorded across nine suites).
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    listViews: mockListViews,
    resolveView: mockResolveView,
    resolveAdHoc: mockResolveAdHoc,
    listMetadataFields: mockListMetadataFields,
    getReembedProgress: mockGetReembedProgress,
    getIndexSummary: mockGetIndexSummary,
  }
})

vi.mock("@/hooks/useDocuments", () => ({
  useDocuments: mockUseDocuments,
}))

vi.mock("@/hooks/useFolders", () => ({
  useFolders: mockUseFolders,
}))

// ── Mock Supabase (prevent real network calls) ─────────────────────────────────
// ⚠ [Rule 1 — Phase 217 SC#1] `SUPABASE_CLIENT_REHYDRATED` is NOT optional. `useAuth.ts:3`
// imports it as a named export and `:51` passes it to `addEventListener`; a mock factory
// that omits it makes vitest throw at MOUNT, so every case in this file fails before it
// asserts anything. The suite was RED at HEAD for exactly this reason and nobody saw it —
// it is in NEITHER count-gate knob, so the gate has never executed it (plan 12 adopts it).
vi.mock("@/lib/supabase", () => ({
  SUPABASE_CLIENT_REHYDRATED: "supabase:client-rehydrated",
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
  },
}))

// ── Sample data ────────────────────────────────────────────────────────────────
const sampleFolders: Folder[] = [
  {
    id: "folder-1",
    user_id: "user-1",
    name: "Research",
    parent_id: null,
    is_org_shared: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "folder-2",
    user_id: "user-1",
    name: "Reports",
    parent_id: null,
    is_org_shared: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]

const sampleDocuments: Document[] = [
  {
    id: "doc-1",
    user_id: "user-1",
    folder_id: "folder-1",
    filename: "research.pdf",
    file_path: "/uploads/research.pdf",
    file_size: 1024,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 10,
    content_hash: "abc123",
    metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "doc-2",
    user_id: "user-1",
    folder_id: null,
    filename: "root-doc.txt",
    file_path: "/uploads/root-doc.txt",
    file_size: 512,
    mime_type: "text/plain",
    status: "completed",
    error_message: null,
    chunk_count: 2,
    content_hash: "def456",
    metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]

// Two saved views, because one view cannot show a NON-VACUITY control: "the selected row
// carries the selected styling" is worthless unless some other row provably does not.
const sampleViews: SavedView[] = [
  {
    id: "view-1",
    user_id: "user-1",
    name: "Quarterly reports",
    filter_expr: { op: "and", conditions: [] },
    is_system_global: false,
  },
  {
    id: "view-2",
    user_id: "user-1",
    name: "Signed contracts",
    filter_expr: { op: "and", conditions: [] },
    is_system_global: false,
  },
]

function renderPage(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

/** NavRow marks selection with a class, not with `aria-current` — so the assertion reads
 *  the class, and every use is paired with a control row that must NOT carry it. */
const SELECTED_ROW_CLASS = "bg-primary/10"

function viewRow(scope: HTMLElement, name: string): HTMLElement {
  return within(scope).getByRole("button", { name })
}

describe("LibraryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseDocuments.mockReturnValue({
      documents: sampleDocuments,
      uploading: false,
      uploadingCount: 0,
      upload: vi.fn().mockResolvedValue({ isDuplicate: false }),
      deleteDoc: vi.fn().mockResolvedValue(undefined),
    })
    mockUseFolders.mockReturnValue({
      folders: sampleFolders,
      createFolder: vi.fn().mockResolvedValue({}),
      renameFolder: vi.fn().mockResolvedValue(undefined),
      deleteFolder: vi.fn().mockResolvedValue(undefined),
    })
    mockListViews.mockResolvedValue(sampleViews)
    mockListMetadataFields.mockResolvedValue([])
    mockResolveView.mockResolvedValue({ documents: [], total: 7 })
    mockResolveAdHoc.mockResolvedValue({ documents: [], total: 0 })
    // Idle: `ReembedStatusCard` renders null in this arm, which is exactly why the tab
    // needs facts of its own — an idle library must not show an empty Indexing tab.
    mockGetReembedProgress.mockResolvedValue({
      status: "idle",
      total: 224,
      re_embedded: 87,
      remaining: 137,
      model: "text-embedding-3-small",
      updated_at: null,
    })
    mockGetIndexSummary.mockResolvedValue({
      vectors: 224,
      chunks_total: 224,
      documents_without_vectors: 0,
      last_indexed: "2026-08-29T10:00:00Z",
      model: "text-embedding-3-small",
      dimensions: 1536,
      provider: "openai",
      folders: [],
    })
  })

  // Phase 217 SC#1: the page title is the BUILD-CONTRACT's `Library`, not the
  // shipped `Documents` it replaces.
  it("renders heading 'Library'", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Library")
  })

  it("does NOT still render the replaced heading 'Documents'", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent("Documents")
  })

  // Phase 217 SC#1: the subtitle names the PURPOSE, not the mechanism. Pinned
  // verbatim from the sketch contract (COPY.PAGE_SUB).
  it("renders the contract subtitle verbatim", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)
    expect(
      screen.getByText("What the agent can read, and how well it reads it."),
    ).toBeInTheDocument()
  })

  it("renders two-panel layout with FolderTree and DocumentUpload", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)
    // Folder tree panel: "Folders" section label.
    // Phase 114 Plan 06 composition renders "Folders" twice — the desktop
    // folder-tree section header (FolderTree) AND the md:hidden mobile
    // bottom-sheet trigger (LibraryPage). jsdom ignores the responsive
    // hide, so both sit in the DOM; assert the Folders surface is present.
    expect(screen.getAllByText("Folders").length).toBeGreaterThanOrEqual(1)
    // Upload control — visible label is "Upload"; the folder target ("Upload to
    // Root" by default) is the button's accessible name (aria-label).
    expect(screen.getByRole("button", { name: "Upload to Root" })).toBeInTheDocument()
  })

  it("DocumentUpload targets Root (accessible name) when no folder selected", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)
    expect(screen.getByRole("button", { name: "Upload to Root" })).toBeInTheDocument()
  })

  it("DocumentList shows only root documents when Root is selected (default)", async () => {
    // Default state: selectedFolderId = null → Root → show folder_id === null docs
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)
    // root-doc.txt has folder_id null so it should show
    expect(screen.getByText("root-doc.txt")).toBeInTheDocument()
    // research.pdf is in folder-1, not root, should not show
    expect(screen.queryByText("research.pdf")).not.toBeInTheDocument()
  })

  it("DocumentList shows folder documents when a folder is selected from the sidebar", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)
    // Click on the Research folder button
    const researchFolder = screen.getByRole("button", { name: /Research/ })
    fireEvent.click(researchFolder)
    // research.pdf (folder-1) is displayed
    expect(await screen.findByText("research.pdf")).toBeInTheDocument()
    // root-doc.txt is not in folder-1, so it is hidden
    expect(screen.queryByText("root-doc.txt")).not.toBeInTheDocument()
  })

  // ═══════════════════════════════════════════════════════════════════════════════════
  // Phase 217-09 — the SHELL's own criteria, asserted through the DOM
  // ═══════════════════════════════════════════════════════════════════════════════════

  /**
   * ⭐ SC#5, THE RENDERED VERSION.
   *
   * `librarySelection.test.ts` proves the reducer never holds a folder and a view at once.
   * That is a claim about a pure function. THIS is the claim about the page: the sidebar
   * `ViewsGroup` and the Views tab's `ViewsGroup` are handed the SAME `activeViewId(lib)`,
   * so no render exists in which they say different things.
   *
   * ⚠ Both halves are one case on purpose — "they agree when something is selected" and
   * "they agree when it is cleared" are the same claim, and splitting them would let a page
   * that only ever selects pass the half that matters least.
   */
  it("⭐ SC#5 — the sidebar mount and the Views tab mount can never disagree", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)

    const sidebar = await screen.findByTestId("library-sidebar")
    await within(sidebar).findByRole("button", { name: "Quarterly reports" })

    // ── select a view FROM THE SIDEBAR ──────────────────────────────────────────────
    fireEvent.click(viewRow(sidebar, "Quarterly reports"))

    // the tab followed the selection (D-217-14) — the Views body is now mounted
    const viewsTab = await screen.findByTestId("views-tab")
    expect(screen.getByRole("tab", { name: "Views" })).toHaveAttribute("aria-selected", "true")

    // BOTH renderings show the same row selected …
    expect(viewRow(sidebar, "Quarterly reports").className).toContain(SELECTED_ROW_CLASS)
    expect(viewRow(viewsTab, "Quarterly reports").className).toContain(SELECTED_ROW_CLASS)
    // … and the NON-VACUITY control: the other view is selected in neither.
    expect(viewRow(sidebar, "Signed contracts").className).not.toContain(SELECTED_ROW_CLASS)
    expect(viewRow(viewsTab, "Signed contracts").className).not.toContain(SELECTED_ROW_CLASS)

    // ── now click a FOLDER ──────────────────────────────────────────────────────────
    fireEvent.click(within(sidebar).getByRole("button", { name: "Research" }))

    // (a) the active tab is Documents
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    )
    // (b) neither mount still shows a selected view. The tab body is unmounted, so it is
    // re-entered and re-read rather than assumed — an absent mount proves nothing.
    expect(viewRow(sidebar, "Quarterly reports").className).not.toContain(SELECTED_ROW_CLASS)
    fireEvent.click(screen.getByRole("tab", { name: "Views" }))
    const viewsTabAgain = await screen.findByTestId("views-tab")
    expect(viewRow(viewsTabAgain, "Quarterly reports").className).not.toContain(
      SELECTED_ROW_CLASS,
    )
  })

  /**
   * D-217-15 (superseded by 217.1-12): the Health tab shipped with the merge that retires
   * KnowledgeHealthPage/GovernancePage. Five triggers, the count assertable by eye.
   */
  it("has exactly five tab triggers — Documents · Views · Ingestion · Indexing · Health (D-217-15)", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)

    const tabs = screen.getAllByRole("tab")
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Documents",
      "Views",
      "Ingestion",
      "Indexing",
      "Health",
    ])
    expect(tabs).toHaveLength(5)
  })

  /**
   * LIB-02 / SC#2 — the dropzone is on the LANDING tab, full width, and it names the folder
   * the file will land in. A dropzone on tab 3 is hunting, which is what SC#2 forbids.
   */
  it("LIB-02 — the dropzone is on the Documents tab, full width, naming its target", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)

    const dropzone = screen.getByRole("button", { name: "Upload to Root" })
    expect(dropzone).toBeInTheDocument()
    expect(dropzone.className).toContain("w-full")
    // It NAMES the target rather than trailing off — the named root, never a blank.
    expect(dropzone.textContent).toContain("Root")

    // And it tracks the selection: pick a folder, the band re-targets.
    // ⚠ MEASURED, not assumed: `@/lib/supabase` is mocked with `session: null`, so `useAuth`
    // yields no user and `selectedFolder.user_id === user?.id` is FALSE for every folder —
    // the band therefore renders its READ-ONLY arm here. That arm still names the folder
    // ("Only the folder owner can upload files to Research"), which is the LIB-02 property;
    // asserting only the writable label would have measured the auth mock, not the band.
    // The pattern is anchored so it cannot also match the sidebar's own "Research" row.
    const sidebar = screen.getByTestId("library-sidebar")
    fireEvent.click(within(sidebar).getByRole("button", { name: "Research" }))
    const retargeted = await screen.findByRole("button", {
      name: /^(Upload to|Read-only folder) Research$/,
    })
    expect(retargeted.textContent).toContain("Research")
  })

  /**
   * D-217-13 — the Views tab has content of its OWN. A tab whose body is an empty state
   * pointing at the sidebar is the cheapest mistake to find here and the most expensive to
   * find after it ships (the sketch's own README says so).
   */
  it("the Views tab is not hollow — it renders the picker with per-view counts", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)
    await screen.findByTestId("library-sidebar")

    fireEvent.click(screen.getByRole("tab", { name: "Views" }))
    const viewsTab = await screen.findByTestId("views-tab")

    expect(within(viewsTab).getByText("Saved views")).toBeInTheDocument()
    expect(within(viewsTab).getByRole("button", { name: "Quarterly reports" })).toBeInTheDocument()
    expect(within(viewsTab).getByRole("button", { name: "Signed contracts" })).toBeInTheDocument()
    // The counts are the content — one per row, resolved lazily by the shipped ViewsGroup.
    await waitFor(() => expect(within(viewsTab).getAllByText("7")).toHaveLength(2))
    // NOT an empty state.
    expect(within(viewsTab).queryByText("No saved views yet")).toBeNull()
  })

  /**
   * D-217-16 / D-217-22 — coverage is a COUNT, never a proportion. A bare proportion reads
   * as a quality grade; "87 of 224" cannot.
   */
  it("the Indexing tab renders the three cards' facts (Plan 10 composition), with no proportion", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)

    fireEvent.click(screen.getByRole("tab", { name: "Indexing" }))
    const indexing = await screen.findByTestId("indexing-tab")

    // Plan 10: the three cards compose over GET /library/index-summary (BE-2).
    expect(within(indexing).getByText("Vector store")).toBeInTheDocument()
    expect(within(indexing).getByText("Embedding model")).toBeInTheDocument()
    expect(within(indexing).getByText("Folders")).toBeInTheDocument()
    // ⛔ the whole rendered tab, not just the one node — no proportion anywhere.
    expect(indexing.textContent).not.toContain("%")
    // The active embedding model is named beside it (from the index-summary facts).
    expect(within(indexing).getByText("text-embedding-3-small")).toBeInTheDocument()
  })

  /**
   * ⭐ REACHABILITY. Plan 08 shipped `IngestionStrip` + `ingestionStages.ts` with a 25-case
   * suite and NO CONSUMER — a component no user could reach. D-217-17 puts it on this tab.
   * This case fails if that mount is ever removed, which is the only thing that would make
   * plan 08's work invisible again.
   */
  it("the Ingestion tab MOUNTS the stage strip for an in-flight document", async () => {
    mockUseDocuments.mockReturnValue({
      documents: [
        ...sampleDocuments,
        {
          ...sampleDocuments[1],
          id: "doc-3",
          filename: "in-flight.pdf",
          status: "processing",
          ingestion_step: "chunking",
        } as Document,
      ],
      uploading: false,
      uploadingCount: 0,
      upload: vi.fn().mockResolvedValue({ isDuplicate: false }),
      deleteDoc: vi.fn().mockResolvedValue(undefined),
    })

    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)

    fireEvent.click(screen.getByRole("tab", { name: "Ingestion" }))
    const ingestion = await screen.findByTestId("ingestion-tab")

    // Plan 03's sub-tab restructure: the in-flight queue lives under the
    // "In progress" sub-tab, not the default "Add files" one.
    fireEvent.mouseDown(within(ingestion).getByRole("tab", { name: "In progress" }))

    expect(within(ingestion).getByText("in-flight.pdf")).toBeInTheDocument()
    const strips = within(ingestion).getAllByTestId("ingestion-strip")
    expect(strips.length).toBeGreaterThan(0)
    expect(strips[0].getAttribute("data-status")).toBe("processing")
    // ⛔ D-217-19 — the queue shows stages, never a proportion.
    expect(ingestion.textContent).not.toContain("%")
  })
})

// ── Phase 217.1 plan 06 — stat tiles, breadcrumb, and the client-side pager ─────────────

describe("LibraryPage — plan 06 furniture (LIB-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseDocuments.mockReturnValue({
      documents: sampleDocuments,
      uploading: false,
      uploadingCount: 0,
      upload: vi.fn().mockResolvedValue({ isDuplicate: false }),
      deleteDoc: vi.fn().mockResolvedValue(undefined),
    })
    mockUseFolders.mockReturnValue({
      folders: sampleFolders,
      createFolder: vi.fn().mockResolvedValue({}),
      renameFolder: vi.fn().mockResolvedValue(undefined),
      deleteFolder: vi.fn().mockResolvedValue(undefined),
    })
    mockListViews.mockResolvedValue(sampleViews)
    mockListMetadataFields.mockResolvedValue([])
    mockResolveView.mockResolvedValue({ documents: [], total: 7 })
    mockResolveAdHoc.mockResolvedValue({ documents: [], total: 0 })
    mockGetReembedProgress.mockResolvedValue({
      status: "idle",
      total: 224,
      re_embedded: 87,
      remaining: 137,
      model: "text-embedding-3-small",
      updated_at: null,
    })
  })

  it("renders the three stat tiles (CHUNKS / VECTORS / FOUND BY A SEARCH)", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)
    const tiles = await screen.findByTestId("documents-stat-tiles")
    // CHUNKS sums chunk_count over the two sample docs (10 + 2 = 12).
    expect(within(tiles).getByText("12")).toBeInTheDocument()
    // VECTORS from re-embed progress (total 224).
    expect(await within(tiles).findByText("224")).toBeInTheDocument()
  })

  it("⛔ renders NO breadcrumb — it duplicated the sidebar and the tab strip", async () => {
    // ⚠ REWRITTEN, NOT DELETED (sketch 231-A, operator-locked 2026-09-05). This case used to
    // assert the breadcrumb existed. The breadcrumb read `Library › Documents` while the sidebar
    // already said Library and the tab already said Documents — pure duplication costing ~38px
    // of a band that was already 48% empty. Inverting the assertion rather than removing it
    // keeps the deletion INTENTIONAL: a silently-dropped case reads as a case nobody wrote.
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)
    await screen.findByTestId("library-headerbar")
    expect(screen.queryByTestId("library-breadcrumb")).toBeNull()
    // …and the two facts it carried are still on screen, in the row that replaced it.
    const bar = screen.getByTestId("library-headerbar")
    expect(within(bar).getByText("Library")).toBeInTheDocument()
    expect(within(bar).getByRole("tab", { name: "Documents" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  })

  it("renders the client-side pager under the Documents table (rows-per-page + range + prev/next)", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)
    const pager = await screen.findByTestId("documents-tfoot")
    expect(within(pager).getByText(/Rows per page/)).toBeInTheDocument()
    // 1 sample root document → "1–1 of 1".
    expect(within(pager).getByText(/1–1 of 1/)).toBeInTheDocument()
  })

  it("the pager's 'list may be larger' arm renders at/above the 1000-row ceiling", async () => {
    // 1000 sample docs → capped arm.
    const many = Array.from({ length: 1000 }, (_, i) => ({
      ...sampleDocuments[1],
      id: `many-${i}`,
      filename: `doc-${i}.txt`,
    }))
    mockUseDocuments.mockReturnValue({
      documents: many,
      uploading: false,
      uploadingCount: 0,
      upload: vi.fn().mockResolvedValue({ isDuplicate: false }),
      deleteDoc: vi.fn().mockResolvedValue(undefined),
    })
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderPage(<LibraryPage />)
    const pager = await screen.findByTestId("documents-tfoot")
    expect(within(pager).getByText(/may be larger than shown/)).toBeInTheDocument()
  })
})
