/**
 * Tests for FolderTree component.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { FolderTree } from "@/components/ingestion/FolderTree"
// Phase 298-05 (D-17 / UI-D4) — a one-line probe that proves WHERE the elsewhere line mounts. The
// real line renders nothing without 2+ orgs, so standing it in changes no other case here.
vi.mock("@/components/org/ElsewhereLine", () => ({
  ElsewhereLine: ({ kind, className }: { kind: string; className?: string }) => (
    <div data-testid="elsewhere-probe" data-kind={kind} data-class={className ?? ""} />
  ),
}))
import type { Folder } from "@/types"

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

// Sample folder data
const sampleFolders: Folder[] = [
  {
    id: "folder-1",
    user_id: "user-1",
    name: "Alpha",
    parent_id: null,
    is_org_shared: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "folder-2",
    user_id: "user-1",
    name: "Beta",
    parent_id: null,
    is_org_shared: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "folder-3",
    user_id: "user-1",
    name: "Child of Alpha",
    parent_id: "folder-1",
    is_org_shared: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]

const defaultProps = {
  folders: sampleFolders,
  selectedFolderId: null,
  currentUserId: "user-1",
  onSelectFolder: vi.fn(),
  onCreateFolder: vi.fn().mockResolvedValue({}),
  onRenameFolder: vi.fn().mockResolvedValue(undefined),
  onDeleteFolder: vi.fn().mockResolvedValue(undefined),
  onToggleOrgShared: vi.fn().mockResolvedValue(undefined),
}

describe("FolderTree", () => {
  it("renders 'Root' node", () => {
    renderWithTooltip(<FolderTree {...defaultProps} />)
    expect(screen.getByText("Root")).toBeInTheDocument()
  })

  it("renders the Root document count through the shared NavRow", () => {
    renderWithTooltip(<FolderTree {...defaultProps} rootDocumentCount={5} />)
    expect(screen.getByText("Root")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
  })

  it("renders per-folder counts on non-Root rows (D-114-13)", () => {
    renderWithTooltip(
      <FolderTree
        {...defaultProps}
        folderDocumentCounts={{ "folder-1": 8 }}
      />
    )
    // Alpha (folder-1) now shows a count, not just Root.
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("8")).toBeInTheDocument()
  })

  it("renders folder tree from flat list (node names appear)", () => {
    renderWithTooltip(<FolderTree {...defaultProps} />)
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Beta")).toBeInTheDocument()
  })

  it("shows empty state when no folders", () => {
    renderWithTooltip(<FolderTree {...defaultProps} folders={[]} />)
    expect(screen.getByText("No folders yet")).toBeInTheDocument()
    expect(
      screen.getByText("Create a folder to organize your documents.")
    ).toBeInTheDocument()
  })

  it("Root node is highlighted when no folder selected", () => {
    renderWithTooltip(
      <FolderTree {...defaultProps} selectedFolderId={null} />
    )
    // The Root row should have the primary background highlight after redesign
    const rootRow = screen.getByText("Root").closest(".bg-primary\\/10")
    expect(rootRow).toBeInTheDocument()
  })

  it("clicking a folder node calls onSelectFolder with folder id", () => {
    const onSelectFolder = vi.fn()
    renderWithTooltip(
      <FolderTree {...defaultProps} onSelectFolder={onSelectFolder} />
    )
    fireEvent.click(screen.getByText("Alpha"))
    expect(onSelectFolder).toHaveBeenCalledWith("folder-1")
  })

  it("clicking Root calls onSelectFolder(null)", () => {
    const onSelectFolder = vi.fn()
    renderWithTooltip(
      <FolderTree {...defaultProps} onSelectFolder={onSelectFolder} />
    )
    fireEvent.click(screen.getByText("Root"))
    expect(onSelectFolder).toHaveBeenCalledWith(null)
  })

  it("global folder shows global badge", () => {
    const { container } = renderWithTooltip(<FolderTree {...defaultProps} />)
    // Beta is global — should have a "G" badge after redesign
    const globalBadges = container.querySelectorAll(".rounded-full")
    const hasGBadge = Array.from(globalBadges).some((el) => el.textContent === "G")
    expect(hasGBadge).toBe(true)
  })

  it("private folder does NOT show Globe icon for all-private tree", () => {
    const privateFolders: Folder[] = [
      {
        id: "pf-1",
        user_id: "user-1",
        name: "Private",
        parent_id: null,
        is_org_shared: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]
    const { container } = renderWithTooltip(
      <FolderTree {...defaultProps} folders={privateFolders} />
    )
    const globeIcons = container.querySelectorAll("[data-testid='globe-icon']")
    expect(globeIcons.length).toBe(0)
  })
})

// ── Phase 298-04 (UI-D8) — the tree's own loading line on an org switch ─────────────────────
describe("FolderTree — loading (298-04)", () => {
  it("with loading true it says 'Loading folders…' and NEVER 'No folders yet'", () => {
    renderWithTooltip(<FolderTree {...defaultProps} folders={[]} loading />)
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Loading folders…")
    expect(status).toHaveAccessibleName("Loading folders…")
    expect(screen.queryByText("No folders yet")).toBeNull()
    expect(screen.queryByText("Create a folder to organize your documents.")).toBeNull()
  })

  it("keeps the Root row while loading, with its count omitted (never 0)", () => {
    renderWithTooltip(<FolderTree {...defaultProps} folders={[]} loading />)
    const root = screen.getByText("Root")
    expect(root).toBeInTheDocument()
    expect(root.closest("[role]")?.textContent ?? root.parentElement?.textContent).not.toMatch(/\d/)
  })

  it("renders no folder row while loading, even if stale folders are passed", () => {
    renderWithTooltip(<FolderTree {...defaultProps} loading />)
    expect(screen.queryByText("Alpha")).toBeNull()
    expect(screen.getByText("Loading folders…")).toBeInTheDocument()
  })

  it("with loading false and no folders the shipped empty sentence is unchanged", () => {
    renderWithTooltip(<FolderTree {...defaultProps} folders={[]} loading={false} />)
    expect(screen.getByText("No folders yet")).toBeInTheDocument()
    expect(screen.queryByText("Loading folders…")).toBeNull()
  })
})


// ── Phase 298-05 (D-17 / UI-D4) — the elsewhere line's mount point ──────────────────────────
describe("FolderTree — the elsewhere line (298-05)", () => {
  it("mounts ONE library line under the Folders header and above Root, in the tree's gutter", () => {
    renderWithTooltip(<FolderTree {...defaultProps} />)
    const probes = screen.getAllByTestId("elsewhere-probe")
    expect(probes).toHaveLength(1)
    expect(probes[0]).toHaveAttribute("data-kind", "library")
    expect(probes[0].getAttribute("data-class")).toContain("px-2")
    const header = screen.getByText("Folders")
    const root = screen.getByText("Root")
    expect(header.compareDocumentPosition(probes[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(probes[0].compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
