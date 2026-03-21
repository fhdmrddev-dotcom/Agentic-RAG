/**
 * Tests for FolderTree component.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FolderTree } from "@/components/ingestion/FolderTree"
import type { Folder } from "@/types"

// Sample folder data
const sampleFolders: Folder[] = [
  {
    id: "folder-1",
    user_id: "user-1",
    name: "Alpha",
    parent_id: null,
    is_global: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "folder-2",
    user_id: "user-1",
    name: "Beta",
    parent_id: null,
    is_global: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "folder-3",
    user_id: "user-1",
    name: "Child of Alpha",
    parent_id: "folder-1",
    is_global: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]

const defaultProps = {
  folders: sampleFolders,
  selectedFolderId: null,
  onSelectFolder: vi.fn(),
  onCreateFolder: vi.fn().mockResolvedValue({}),
  onRenameFolder: vi.fn().mockResolvedValue(undefined),
  onDeleteFolder: vi.fn().mockResolvedValue(undefined),
}

describe("FolderTree", () => {
  it("renders 'Root' node", () => {
    render(<FolderTree {...defaultProps} />)
    expect(screen.getByText("Root")).toBeInTheDocument()
  })

  it("renders folder tree from flat list (node names appear)", () => {
    render(<FolderTree {...defaultProps} />)
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Beta")).toBeInTheDocument()
  })

  it("shows empty state when no folders", () => {
    render(<FolderTree {...defaultProps} folders={[]} />)
    expect(screen.getByText("No folders yet")).toBeInTheDocument()
    expect(
      screen.getByText("Create a folder to organize your documents.")
    ).toBeInTheDocument()
  })

  it("Root node is highlighted (bg-accent) when no folder selected", () => {
    const { container } = render(
      <FolderTree {...defaultProps} selectedFolderId={null} />
    )
    // The Root row should have bg-accent
    const rootRow = screen.getByText("Root").closest(".bg-accent")
    expect(rootRow).toBeInTheDocument()
  })

  it("clicking a folder node calls onSelectFolder with folder id", () => {
    const onSelectFolder = vi.fn()
    render(<FolderTree {...defaultProps} onSelectFolder={onSelectFolder} />)
    fireEvent.click(screen.getByText("Alpha"))
    expect(onSelectFolder).toHaveBeenCalledWith("folder-1")
  })

  it("clicking Root calls onSelectFolder(null)", () => {
    const onSelectFolder = vi.fn()
    render(<FolderTree {...defaultProps} onSelectFolder={onSelectFolder} />)
    fireEvent.click(screen.getByText("Root"))
    expect(onSelectFolder).toHaveBeenCalledWith(null)
  })

  it("global folder shows Globe icon", () => {
    const { container } = render(<FolderTree {...defaultProps} />)
    // Beta is global — should have a Globe icon (data-testid='globe-icon')
    const globeIcons = container.querySelectorAll("[data-testid='globe-icon']")
    expect(globeIcons.length).toBeGreaterThan(0)
  })

  it("private folder does NOT show Globe icon for all-private tree", () => {
    const privateFolders: Folder[] = [
      {
        id: "pf-1",
        user_id: "user-1",
        name: "Private",
        parent_id: null,
        is_global: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]
    const { container } = render(
      <FolderTree {...defaultProps} folders={privateFolders} />
    )
    const globeIcons = container.querySelectorAll("[data-testid='globe-icon']")
    expect(globeIcons.length).toBe(0)
  })
})
