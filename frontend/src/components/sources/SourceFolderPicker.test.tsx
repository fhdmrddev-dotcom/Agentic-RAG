/**
 * Phase 232 (SRC-01 / SRC-02) — SourceFolderPicker Unit Tests.
 *
 * Tests hierarchical folder tree rendering, expanding/collapsing, lazy child loading,
 * folder selection callback contract, error states, and empty states.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SourceFolderPicker } from "./SourceFolderPicker"
import * as api from "@/lib/api"
import type { SourceNode } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    browseSourceFolders: vi.fn(),
  }
})

const mockBrowseSourceFolders = vi.mocked(api.browseSourceFolders)

const ROOT_NODES: SourceNode[] = [
  {
    id: "my_drive",
    name: "My Drive",
    kind: "drive",
    drive_id: null,
    has_children: true,
  },
  {
    id: "shared_drives",
    name: "Shared Drives",
    kind: "drive",
    drive_id: null,
    has_children: true,
  },
]

const SHARED_DRIVES_CHILDREN: SourceNode[] = [
  {
    id: "drive-team",
    name: "Engineering Team Drive",
    kind: "drive",
    drive_id: "drive-team",
    has_children: true,
  },
]

const TEAM_DRIVE_CHILDREN: SourceNode[] = [
  {
    id: "folder-arch",
    name: "Architecture Specs",
    kind: "folder",
    drive_id: "drive-team",
    parent_id: "drive-team",
    has_children: false,
  },
]

describe("SourceFolderPicker", () => {
  beforeEach(() => {
    mockBrowseSourceFolders.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("renders loading state then root folders on mount", async () => {
    mockBrowseSourceFolders.mockResolvedValueOnce({
      items: ROOT_NODES,
      next_page_token: null,
    })

    render(<SourceFolderPicker connectionId="conn-123" />)

    expect(screen.getByTestId("folder-picker-loading")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText("My Drive")).toBeInTheDocument()
      expect(screen.getByText("Shared Drives")).toBeInTheDocument()
    })

    expect(mockBrowseSourceFolders).toHaveBeenCalledWith("conn-123")
  })

  it("expands a folder node lazily and displays its children", async () => {
    const user = userEvent.setup()

    mockBrowseSourceFolders.mockImplementation(async (_connId, folderId) => {
      if (!folderId) {
        return { items: ROOT_NODES, next_page_token: null }
      }
      if (folderId === "shared_drives") {
        return { items: SHARED_DRIVES_CHILDREN, next_page_token: null }
      }
      if (folderId === "drive-team") {
        return { items: TEAM_DRIVE_CHILDREN, next_page_token: null }
      }
      return { items: [], next_page_token: null }
    })

    render(<SourceFolderPicker connectionId="conn-123" />)

    await waitFor(() => {
      expect(screen.getByText("Shared Drives")).toBeInTheDocument()
    })

    // Click chevron to expand Shared Drives
    const expandSharedBtn = screen.getByTestId("expand-btn-shared_drives")
    await user.click(expandSharedBtn)

    await waitFor(() => {
      expect(screen.getByText("Engineering Team Drive")).toBeInTheDocument()
    })
    expect(mockBrowseSourceFolders).toHaveBeenCalledWith("conn-123", "shared_drives")

    // Expand the child Engineering Team Drive
    const expandTeamBtn = screen.getByTestId("expand-btn-drive-team")
    await user.click(expandTeamBtn)

    await waitFor(() => {
      expect(screen.getByText("Architecture Specs")).toBeInTheDocument()
    })
    expect(mockBrowseSourceFolders).toHaveBeenCalledWith("conn-123", "drive-team")
  })

  it("collapses an expanded node when toggle is clicked again", async () => {
    const user = userEvent.setup()

    mockBrowseSourceFolders.mockImplementation(async (_connId, folderId) => {
      if (!folderId) {
        return { items: ROOT_NODES, next_page_token: null }
      }
      if (folderId === "shared_drives") {
        return { items: SHARED_DRIVES_CHILDREN, next_page_token: null }
      }
      return { items: [], next_page_token: null }
    })

    render(<SourceFolderPicker connectionId="conn-123" />)

    await waitFor(() => {
      expect(screen.getByText("Shared Drives")).toBeInTheDocument()
    })

    const expandBtn = screen.getByTestId("expand-btn-shared_drives")
    await user.click(expandBtn)

    await waitFor(() => {
      expect(screen.getByText("Engineering Team Drive")).toBeInTheDocument()
    })

    // Click again to collapse
    await user.click(expandBtn)

    expect(screen.queryByText("Engineering Team Drive")).not.toBeInTheDocument()
  })

  it("calls onSelectFolder with correct folder and drive metadata when clicked", async () => {
    const user = userEvent.setup()
    const handleSelect = vi.fn()

    mockBrowseSourceFolders.mockResolvedValueOnce({
      items: ROOT_NODES,
      next_page_token: null,
    })

    render(
      <SourceFolderPicker
        connectionId="conn-123"
        onSelectFolder={handleSelect}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText("My Drive")).toBeInTheDocument()
    })

    const myDriveRow = screen.getByTestId("folder-row-my_drive")
    await user.click(myDriveRow)

    expect(handleSelect).toHaveBeenCalledWith({
      folderId: "my_drive",
      folderName: "My Drive",
      driveId: null,
      driveName: "My Drive",
    })
  })

  it("indicates currently selected folder", async () => {
    mockBrowseSourceFolders.mockResolvedValueOnce({
      items: ROOT_NODES,
      next_page_token: null,
    })

    render(
      <SourceFolderPicker
        connectionId="conn-123"
        selectedFolderId="my_drive"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText("My Drive")).toBeInTheDocument()
    })

    const myDriveRow = screen.getByTestId("folder-row-my_drive")
    expect(myDriveRow.className).toContain("bg-primary/10")
    expect(myDriveRow.getAttribute("aria-selected")).toBe("true")
  })

  it("renders error state when root fetch fails and allows retry", async () => {
    const user = userEvent.setup()

    mockBrowseSourceFolders.mockRejectedValueOnce(new Error("Network connection dropped"))

    render(<SourceFolderPicker connectionId="conn-123" />)

    await waitFor(() => {
      expect(screen.getByTestId("folder-picker-error")).toBeInTheDocument()
      expect(screen.getByText("Network connection dropped")).toBeInTheDocument()
    })

    // Setup success for retry
    mockBrowseSourceFolders.mockResolvedValueOnce({
      items: ROOT_NODES,
      next_page_token: null,
    })

    const retryBtn = screen.getByRole("button", { name: /retry/i })
    await user.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByText("My Drive")).toBeInTheDocument()
    })
  })

  it("renders empty state when source has no folders", async () => {
    mockBrowseSourceFolders.mockResolvedValueOnce({
      items: [],
      next_page_token: null,
    })

    render(<SourceFolderPicker connectionId="conn-123" />)

    await waitFor(() => {
      expect(screen.getByTestId("folder-picker-empty")).toBeInTheDocument()
      expect(
        screen.getByText("No folders or drives found for this connection."),
      ).toBeInTheDocument()
    })
  })
})
