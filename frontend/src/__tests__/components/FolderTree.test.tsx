/**
 * Tests for FolderTree component.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { FolderTree } from "@/components/ingestion/FolderTree"
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
