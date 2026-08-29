/**
 * ⭐ THE SKETCH-COMPOSITION FENCE — Phase 217.1 SC#1 / D-217.1-09.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────────────────
 * Phase 217 shipped against a contract that pinned WORDS — the page title, the column
 * order, the six stage labels — and every one of those assertions was green while four of
 * the five tabs carried none of the sketch's furniture. **A contract that cannot name a
 * MISSING BLOCK cannot tell "built" from "not built yet".** This suite is that contract's
 * missing half: for every block the sketch draws, it asserts the built tab renders an
 * element carrying the matching hook.
 *
 * ⚠ IT IS SUPPOSED TO BE RED WHEN IT LANDS, AND ITS RED RUN IS THE DELIVERABLE.
 *   `.planning/phases/217.1-the-library-exactly-as-sketched/217.1-BASELINE.md` records that
 *   run verbatim. A guard nobody has seen fire is not a guard, and a guard adopted green on
 *   a tree it never failed on has proved nothing about its own wiring.
 *
 * ⛔ IT IS **NOT** IN `scripts/vitest-count-gate.cjs` — neither `TARGETS` nor `BASELINE`.
 *   The gate's contract is *zero failing, forever*; adopting a deliberately-red suite would
 *   make every subsequent plan's gate red for reasons it did not cause. The phase's FINAL
 *   wave (217.1-18) adopts it, once each wave has turned its own blocks green.
 *
 * ── THE CONTRACT IS IMPORTED, NEVER TRANSCRIBED ────────────────────────────────────────
 * `sketchComposition.json` is written by `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs --emit`
 * from the sketch's OWN `data-block="…"` markers. Hand-listing the blocks here would
 * reintroduce exactly the staleness the emitter exists to prevent.
 *
 * ⚠ THE IMPORT IS THE IN-PACKAGE COPY, not a `?raw` reach across the repo boundary into
 *   `.planning/sketches/` — which `/gsd:complete-milestone` ARCHIVES.
 *   `argumentVocabulary.test.ts:58` still carries that residual unpaid; this suite does not
 *   repeat it. §1 below is the character-floor control that residual's own docblock demands:
 *   a moved or misnamed import can resolve EMPTY rather than throwing, and a contract of
 *   zero blocks makes every assertion below pass over nothing.
 *
 * ── THE HOOK CONVENTION ────────────────────────────────────────────────────────────────
 * `data-testid="<screen>-<block-kind>"`, e.g. `documents-stat-tiles`, `health-coverage-ring`.
 * `data-testid` is the house convention at ~1500 occurrences and the Library surface already
 * uses it this way (`views-tab`, `ingestion-tab`, `indexing-tab`, `library-sidebar`).
 * ⚠ `data-block` is the SKETCH's marker and must never appear in the build.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Document, Folder, SavedView } from "@/types"
import composition from "../__generated__/sketchComposition.json"

// ── Mocks ──────────────────────────────────────────────────────────────────────
// ⚠ PARTIAL mock of `@/lib/api`. It is a re-export barrel with ~12 domain modules behind
// it; a full replacement has to declare every symbol every child imports, and the one it
// forgets throws at MOUNT with a message about a missing export rather than about the
// missing block — the failure mode Phase 196-08 recorded across nine suites, and the one
// thing that would make this suite's RED unreadable.
const {
  mockUseDocuments,
  mockUseFolders,
  mockListViews,
  mockResolveView,
  mockResolveAdHoc,
  mockListMetadataFields,
  mockGetReembedProgress,
} = vi.hoisted(() => ({
  mockUseDocuments: vi.fn(),
  mockUseFolders: vi.fn(),
  mockListViews: vi.fn(),
  mockResolveView: vi.fn(),
  mockResolveAdHoc: vi.fn(),
  mockListMetadataFields: vi.fn(),
  mockGetReembedProgress: vi.fn(),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    listViews: mockListViews,
    resolveView: mockResolveView,
    resolveAdHoc: mockResolveAdHoc,
    listMetadataFields: mockListMetadataFields,
    getReembedProgress: mockGetReembedProgress,
  }
})

vi.mock("@/hooks/useDocuments", () => ({ useDocuments: mockUseDocuments }))
vi.mock("@/hooks/useFolders", () => ({ useFolders: mockUseFolders }))

// ⚠ `SUPABASE_CLIENT_REHYDRATED` is NOT optional — `useAuth.ts:3` imports it as a named
// export and passes it to `addEventListener`; a factory that omits it throws at mount.
vi.mock("@/lib/supabase", () => ({
  SUPABASE_CLIENT_REHYDRATED: "supabase:client-rehydrated",
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
    removeChannel: vi.fn(),
  },
}))

// ── Sample data ────────────────────────────────────────────────────────────────
const sampleFolders: Folder[] = [
  {
    id: "folder-1",
    user_id: "user-1",
    name: "Engineering",
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
    filename: "architecture_v2_final.pdf",
    file_path: "/uploads/architecture_v2_final.pdf",
    file_size: 2400000,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 412,
    content_hash: "abc123",
    metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "doc-2",
    user_id: "user-1",
    folder_id: "folder-1",
    filename: "supplier_terms_2026.pdf",
    file_path: "/uploads/supplier_terms_2026.pdf",
    file_size: 840000,
    mime_type: "application/pdf",
    status: "processing",
    error_message: null,
    chunk_count: 0,
    content_hash: "def456",
    metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "doc-3",
    user_id: "user-1",
    folder_id: null,
    filename: "legacy_export.csv",
    file_path: "/uploads/legacy_export.csv",
    file_size: 12400000,
    mime_type: "text/csv",
    status: "failed",
    error_message: "The file had a character we could not store.",
    chunk_count: 0,
    content_hash: "ghi789",
    metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]

const sampleViews: SavedView[] = [
  {
    id: "view-1",
    user_id: "user-1",
    name: "Needs review",
    filter_expr: { op: "and", conditions: [] },
    is_system_global: false,
  },
  {
    id: "view-2",
    user_id: "user-1",
    name: "Recently added",
    filter_expr: { op: "and", conditions: [] },
    is_system_global: false,
  },
]

function renderUI(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

/** The emitted contract, typed only as far as this suite reads it. */
type Composition = Record<
  string,
  { blocks: { kind: string; heading: string | null; atoms: string[] }[]; buttons: string[] }
>
const CONTRACT = composition as unknown as Composition

/** The five screens the sketch draws and this phase builds. `v-d` (the detail panel) is
 *  verified by its own suite in Wave 8 and is deliberately not a tab body. */
const SCREENS = ["documents", "views", "ingestion", "indexing", "health"] as const

/** `data-testid="<screen>-<kind>"` — the one hook convention, stated once. */
const hook = (screen: string, kind: string) => `${screen}-${kind}`

describe("sketch-composition fence — §1 the contract itself", () => {
  // ⚠ THE NON-VACUITY CONTROL. A moved or misnamed JSON import can resolve to an empty
  // object rather than throwing, and an empty contract makes every case below vacuously
  // green — a fence that fires on nothing, which is the failure this whole phase exists
  // to stop happening a second time.
  it("resolves to a non-empty object", () => {
    expect(CONTRACT).toBeTypeOf("object")
    expect(Object.keys(CONTRACT).length).toBeGreaterThan(0)
  })

  it("carries all five screens", () => {
    for (const screen of SCREENS) expect(Object.keys(CONTRACT)).toContain(screen)
  })

  it("carries a character floor of real content", () => {
    expect(JSON.stringify(CONTRACT).length).toBeGreaterThan(1200)
  })

  it("names at least three blocks on every screen", () => {
    for (const screen of SCREENS) {
      expect(CONTRACT[screen].blocks.length).toBeGreaterThanOrEqual(3)
    }
  })
})

describe("sketch-composition fence — §2 positive controls", () => {
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

  // ⭐ THE SUITE MUST FAIL ON MISSING COMPOSITION, NEVER ON A BROKEN IMPORT PATH. A run in
  // which EVERY case is red is indistinguishable from a run whose mount harness is wrong,
  // so these two must be green in the RED baseline or the baseline proves nothing.
  it("the page renders its heading — the mount harness works", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderUI(<LibraryPage />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Library")
  })

  it("the four shipped tab triggers render — the tab bar is already built", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderUI(<LibraryPage />)
    for (const name of ["Documents", "Views", "Ingestion", "Indexing"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument()
    }
  })

  it("the shipped tab-body hooks render — `data-testid` is the right convention", async () => {
    const { IngestionTab } = await import("../IngestionTab")
    renderUI(<IngestionTab documents={sampleDocuments} />)
    expect(screen.getByTestId("ingestion-tab")).toBeInTheDocument()
  })
})

describe("sketch-composition fence — §3 every block the sketch draws", () => {
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

  /** Mount the live body for one screen. Each arm is the CURRENT tree's answer — which for
   *  `health` is "there is no such tab", and that is a correct RED assertion rather than an
   *  import error. `librarySelection.ts` types `LibraryTab` as the four that exist. */
  async function mountScreen(screen: string) {
    if (screen === "documents" || screen === "health") {
      const { LibraryPage } = await import("@/pages/LibraryPage")
      return renderUI(<LibraryPage />)
    }
    if (screen === "views") {
      const { ViewsTab } = await import("../ViewsTab")
      return renderUI(
        <ViewsTab
          views={sampleViews}
          selectedViewId={null}
          onSelectView={vi.fn()}
          onEditView={vi.fn()}
          onRenameView={vi.fn()}
          onDeleted={vi.fn()}
        />,
      )
    }
    if (screen === "ingestion") {
      const { IngestionTab } = await import("../IngestionTab")
      return renderUI(<IngestionTab documents={sampleDocuments} />)
    }
    const { IndexingTab } = await import("../IndexingTab")
    return renderUI(<IndexingTab />)
  }

  for (const screenName of SCREENS) {
    describe(`${screenName}`, () => {
      const blocks = CONTRACT[screenName]?.blocks ?? []

      for (const block of blocks) {
        it(`renders the \`${block.kind}\` block as [data-testid="${hook(screenName, block.kind)}"]`, async () => {
          await mountScreen(screenName)
          expect(screen.getByTestId(hook(screenName, block.kind))).toBeInTheDocument()
        })
      }

      // ⚠ HEALTH HAS NO TAB AT ALL, and that is asserted as its own case rather than left
      // implicit in ten missing blocks. `LibraryTab` is a four-member union; a fifth tab is
      // a schema change to the page's reducer, not a component that forgot a `data-testid`.
      if (screenName === "health") {
        it("mounts a Health tab at all", async () => {
          await mountScreen("health")
          expect(screen.getByRole("tab", { name: "Health" })).toBeInTheDocument()
        })
      }
    })
  }
})

describe("sketch-composition fence — §4 every named button", () => {
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

  // ⚠ THE INDEXING BUTTONS ARE OPERATOR-ONLY (D-217.1-27) and render as ABSENT for everyone
  // else — never as dead controls. This case therefore measures the SHAPE the contract
  // names; the wave that builds them owns the gate, and it will need a mock that grants
  // `model_management` before this can go green.
  for (const screenName of SCREENS) {
    const buttons = CONTRACT[screenName]?.buttons ?? []
    for (const label of buttons) {
      it(`${screenName} · offers the "${label}" control`, async () => {
        if (screenName === "views") {
          const { ViewsTab } = await import("../ViewsTab")
          renderUI(
            <ViewsTab
              views={sampleViews}
              selectedViewId={null}
              onSelectView={vi.fn()}
              onEditView={vi.fn()}
              onRenameView={vi.fn()}
              onDeleted={vi.fn()}
            />,
          )
        } else if (screenName === "ingestion") {
          const { IngestionTab } = await import("../IngestionTab")
          renderUI(<IngestionTab documents={sampleDocuments} />)
        } else if (screenName === "indexing") {
          const { IndexingTab } = await import("../IndexingTab")
          renderUI(<IndexingTab />)
        } else {
          const { LibraryPage } = await import("@/pages/LibraryPage")
          renderUI(<LibraryPage />)
        }
        expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
      })
    }
  }
})
