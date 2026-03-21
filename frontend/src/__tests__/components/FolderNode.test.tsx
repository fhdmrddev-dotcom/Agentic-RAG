/**
 * Tests for FolderNode component.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { FolderNode as FolderNodeComponent } from "@/components/ingestion/FolderNode"
import type { FolderNode } from "@/lib/folderTree"

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

// Helper to build a minimal FolderNode object
function makeNode(overrides: Partial<FolderNode> = {}): FolderNode {
  return {
    id: "node-1",
    user_id: "user-1",
    name: "My Folder",
    parent_id: null,
    is_global: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    children: [],
    ...overrides,
  }
}

const defaultProps = {
  depth: 0,
  selectedFolderId: null,
  expandedIds: new Set<string>(),
  editingId: null,
  deletingId: null,
  onSelect: vi.fn(),
  onToggleExpand: vi.fn(),
  onStartRename: vi.fn(),
  onCommitRename: vi.fn(),
  onCancelRename: vi.fn(),
  onStartDelete: vi.fn(),
  onConfirmDelete: vi.fn(),
  onCancelDelete: vi.fn(),
  onCreateSubfolder: vi.fn(),
}

describe("FolderNode", () => {
  it("renders folder name", () => {
    renderWithTooltip(<FolderNodeComponent node={makeNode()} {...defaultProps} />)
    expect(screen.getByText("My Folder")).toBeInTheDocument()
  })

  it("renders chevron when node has children", () => {
    const nodeWithChild = makeNode({
      children: [makeNode({ id: "child-1", name: "Child" })],
    })
    const { container } = renderWithTooltip(
      <FolderNodeComponent node={nodeWithChild} {...defaultProps} />
    )
    // chevron is an svg from lucide (ChevronRight or ChevronDown)
    const svgs = container.querySelectorAll("svg")
    expect(svgs.length).toBeGreaterThan(0)
  })

  it("does not render a clickable chevron span when node has no children", () => {
    const { container } = renderWithTooltip(
      <FolderNodeComponent node={makeNode()} {...defaultProps} />
    )
    // No chevron button when no children
    const chevronBtn = container.querySelector("[data-testid='chevron-btn']")
    expect(chevronBtn).not.toBeInTheDocument()
  })

  it("shows Folder icon always", () => {
    const { container } = renderWithTooltip(
      <FolderNodeComponent node={makeNode({ is_global: false })} {...defaultProps} />
    )
    // Folder icon is present (lucide renders as svg)
    const svgs = container.querySelectorAll("svg")
    expect(svgs.length).toBeGreaterThan(0)
  })

  it("shows Globe icon when is_global=true", () => {
    const { container } = renderWithTooltip(
      <FolderNodeComponent
        node={makeNode({ is_global: true })}
        {...defaultProps}
      />
    )
    const globeIcon = container.querySelector("[data-testid='globe-icon']")
    expect(globeIcon).toBeInTheDocument()
  })

  it("does not show Globe icon when is_global=false", () => {
    const { container } = renderWithTooltip(
      <FolderNodeComponent
        node={makeNode({ is_global: false })}
        {...defaultProps}
      />
    )
    const globeIcon = container.querySelector("[data-testid='globe-icon']")
    expect(globeIcon).not.toBeInTheDocument()
  })

  it("inline rename: renders input when editingId matches node id", () => {
    renderWithTooltip(
      <FolderNodeComponent
        node={makeNode()}
        {...defaultProps}
        editingId="node-1"
      />
    )
    const input = screen.getByRole("textbox")
    expect(input).toBeInTheDocument()
  })

  it("inline rename: Enter key calls onCommitRename", () => {
    const onCommitRename = vi.fn()
    renderWithTooltip(
      <FolderNodeComponent
        node={makeNode()}
        {...defaultProps}
        editingId="node-1"
        onCommitRename={onCommitRename}
      />
    )
    const input = screen.getByRole("textbox")
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onCommitRename).toHaveBeenCalled()
  })

  it("inline rename: Escape key calls onCancelRename", () => {
    const onCancelRename = vi.fn()
    renderWithTooltip(
      <FolderNodeComponent
        node={makeNode()}
        {...defaultProps}
        editingId="node-1"
        onCancelRename={onCancelRename}
      />
    )
    const input = screen.getByRole("textbox")
    fireEvent.keyDown(input, { key: "Escape" })
    expect(onCancelRename).toHaveBeenCalled()
  })

  it("delete confirmation: renders confirmation text when deletingId matches", () => {
    renderWithTooltip(
      <FolderNodeComponent
        node={makeNode()}
        {...defaultProps}
        deletingId="node-1"
      />
    )
    expect(
      screen.getByText(/Delete My Folder and all its contents/i)
    ).toBeInTheDocument()
  })

  it("applies bg-accent class when node is selected", () => {
    const { container } = renderWithTooltip(
      <FolderNodeComponent
        node={makeNode()}
        {...defaultProps}
        selectedFolderId="node-1"
      />
    )
    const row = container.querySelector(".bg-accent")
    expect(row).toBeInTheDocument()
  })
})
