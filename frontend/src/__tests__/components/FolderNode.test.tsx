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
    is_org_shared: false,
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
  currentUserId: "user-1",
  onSelect: vi.fn(),
  onToggleExpand: vi.fn(),
  onStartRename: vi.fn(),
  onCommitRename: vi.fn(),
  onCancelRename: vi.fn(),
  onStartDelete: vi.fn(),
  onConfirmDelete: vi.fn(),
  onCancelDelete: vi.fn(),
  onCreateSubfolder: vi.fn(),
  creatingInParentId: null,
  onCreateCommit: vi.fn(),
  onCreateCancel: vi.fn(),
  onToggleOrgShared: vi.fn(),
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
      <FolderNodeComponent node={makeNode({ is_org_shared: false })} {...defaultProps} />
    )
    // Folder icon is present (lucide renders as svg)
    const svgs = container.querySelectorAll("svg")
    expect(svgs.length).toBeGreaterThan(0)
  })

  it("shows global badge when is_org_shared=true", () => {
    const { container } = renderWithTooltip(
      <FolderNodeComponent
        node={makeNode({ is_org_shared: true })}
        {...defaultProps}
      />
    )
    // Redesign uses a "G" badge instead of a Globe icon
    const globalBadge = container.querySelector(".rounded-full")
    expect(globalBadge).toBeInTheDocument()
    expect(globalBadge?.textContent).toBe("G")
  })

  it("does not show global badge when is_org_shared=false", () => {
    const { container } = renderWithTooltip(
      <FolderNodeComponent
        node={makeNode({ is_org_shared: false })}
        {...defaultProps}
      />
    )
    const globalBadges = container.querySelectorAll(".rounded-full")
    const hasGBadge = Array.from(globalBadges).some((el) => el.textContent === "G")
    expect(hasGBadge).toBe(false)
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
      screen.getByText(/permanently delete the folder and all documents inside it/i)
    ).toBeInTheDocument()
  })

  it("applies selected highlight class when node is selected", () => {
    const { container } = renderWithTooltip(
      <FolderNodeComponent
        node={makeNode()}
        {...defaultProps}
        selectedFolderId="node-1"
      />
    )
    // Redesign uses bg-primary/10 for selected highlight
    const row = container.querySelector(".bg-primary\\/10")
    expect(row).toBeInTheDocument()
  })

  // Phase 114 (D-114-13/8): per-folder counts render on every row, not just Root.
  it("renders a per-folder document count when provided", () => {
    renderWithTooltip(
      <FolderNodeComponent
        node={makeNode()}
        {...defaultProps}
        folderDocumentCounts={{ "node-1": 12 }}
      />
    )
    expect(screen.getByText("12")).toBeInTheDocument()
  })

  it("renders a 0 count when the folder has no documents in the count map", () => {
    renderWithTooltip(
      <FolderNodeComponent node={makeNode()} {...defaultProps} folderDocumentCounts={{}} />
    )
    expect(screen.getByText("0")).toBeInTheDocument()
  })

  it("renders recursive children when expanded", () => {
    const parent = makeNode({
      id: "node-1",
      name: "Parent",
      children: [makeNode({ id: "child-1", name: "Nested child" })],
    })
    renderWithTooltip(
      <FolderNodeComponent
        node={parent}
        {...defaultProps}
        expandedIds={new Set(["node-1"])}
      />
    )
    // Recursion preserved: the child row renders when the parent is expanded.
    expect(screen.getByText("Nested child")).toBeInTheDocument()
  })

  // ── Phase 266-04 (D-266-13) — an installed Expert's folder names where it came from ─────────
  // The provenance rides NavRow's EXISTING `sharedLabel` tooltip; NavRow itself is not edited.
  // ⚠ SUPERSEDED by 266-05 (UI-3): NavRow WAS edited — it gained the optional `caption` prop the
  // at-rest note renders through. The line above is kept, not overwritten (266 review WR-08).

  async function revealSharedLabel(): Promise<string[]> {
    const pill = screen.getByText("G")
    fireEvent.mouseEnter(pill)
    fireEvent.focus(pill)
    const labels = await screen.findAllByText(/^Shared with org/)
    return labels.map((l) => l.textContent ?? "")
  }

  it("266: a shared folder with provenance reads 'Shared with org · from Financial Analyzer'", async () => {
    renderWithTooltip(
      <FolderNodeComponent
        node={makeNode({ is_org_shared: true })}
        {...defaultProps}
        folderProvenance={{ "node-1": "from Financial Analyzer" }}
      />,
    )
    const labels = await revealSharedLabel()
    expect(labels).toContain("Shared with org · from Financial Analyzer")
  })

  it("266: without a provenance entry the label is exactly 'Shared with org'", async () => {
    renderWithTooltip(
      <FolderNodeComponent
        node={makeNode({ is_org_shared: true })}
        {...defaultProps}
        folderProvenance={{ "other-folder": "from Financial Analyzer" }}
      />,
    )
    const labels = await revealSharedLabel()
    expect(labels).toContain("Shared with org")
    expect(labels.join("|")).not.toContain("Financial Analyzer")
  })

  it("266: a provenance entry on a NON-shared folder renders no shared label at all", () => {
    const { container } = renderWithTooltip(
      <FolderNodeComponent
        node={makeNode({ is_org_shared: false })}
        {...defaultProps}
        folderProvenance={{ "node-1": "from Financial Analyzer" }}
      />,
    )
    expect(screen.queryByText("G")).toBeNull()
    expect(container.textContent).not.toContain("Financial Analyzer")
  })

  // ── 266-05 UAT fix (operator, 2026-09-25): the note was tooltip-only on the "G" pill, and the
  // operator did not see it in the Library. The four tests above pass ONLY after a simulated hover,
  // which is why they stayed green over an invisible note. The note must be VISIBLE at rest.
  it("266 UAT: the provenance note is visible on the row WITHOUT hovering", () => {
    renderWithTooltip(
      <FolderNodeComponent
        node={makeNode({ is_org_shared: true })}
        {...defaultProps}
        folderProvenance={{ "node-1": "from Financial Analyzer" }}
      />,
    )
    const caption = screen.getByTestId("navrow-caption")
    expect(caption).toHaveTextContent("from Financial Analyzer")
    expect(caption).toBeVisible()
    // WR-08: jsdom loads no Tailwind, so toBeVisible() cannot see a utility class that hides the
    // note. Assert no unprefixed hiding utility on the caption or any ancestor up to the root.
    const HIDING = new Set(["hidden", "sr-only", "invisible", "opacity-0"])
    for (let el: HTMLElement | null = caption; el; el = el.parentElement) {
      const hiding = (el.getAttribute("class") ?? "").split(/\s+/).filter((t) => HIDING.has(t))
      expect(hiding, `<${el.tagName.toLowerCase()} class="${el.getAttribute("class")}">`).toEqual([])
    }
  })

  it("266 UAT: a folder with no provenance entry renders no caption line", () => {
    renderWithTooltip(
      <FolderNodeComponent
        node={makeNode({ is_org_shared: true })}
        {...defaultProps}
        folderProvenance={{ "other-folder": "from Financial Analyzer" }}
      />,
    )
    expect(screen.queryByTestId("navrow-caption")).toBeNull()
  })

  it("266: the provenance map is forwarded to recursive children", async () => {
    const parent = makeNode({
      id: "node-1",
      name: "Parent",
      children: [makeNode({ id: "child-1", name: "Installed", is_org_shared: true })],
    })
    renderWithTooltip(
      <FolderNodeComponent
        node={parent}
        {...defaultProps}
        expandedIds={new Set(["node-1"])}
        folderProvenance={{ "child-1": "from Financial Analyzer" }}
      />,
    )
    const labels = await revealSharedLabel()
    expect(labels).toContain("Shared with org · from Financial Analyzer")
  })
})
