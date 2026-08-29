/**
 * Tests for the DocumentList Move-to-folder row action (Phase 114 Plan 04, D-114-14).
 *
 * The action reuses the existing MoveToFolderDialog + PATCH /documents/{id}/move —
 * no drag-drop is built. These tests lock: the trigger renders with a "Move to
 * folder" tooltip, clicking it opens the dialog, and the row-click -> detail-panel
 * (onSelect) behavior is preserved (no regression).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DocumentList } from "@/components/ingestion/DocumentList"
import type { Document } from "@/types"

// The MoveToFolderDialog (mounted by DocumentList) calls listFolders on open and
// moveDocument on confirm; DocumentList itself imports fetch/restore/reingest.
vi.mock("@/lib/api", () => ({
  listFolders: vi.fn().mockResolvedValue([]),
  moveDocument: vi.fn().mockResolvedValue(undefined),
  fetchDocumentVersions: vi.fn().mockResolvedValue([]),
  restoreDocumentVersion: vi.fn().mockResolvedValue(undefined),
  reingestDocument: vi.fn().mockResolvedValue(undefined),
}))

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc-1",
    user_id: "user-1",
    folder_id: null,
    filename: "report.pdf",
    file_path: "/x/report.pdf",
    file_size: 2048,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 4,
    content_hash: "abc",
    version_number: 1,
    is_latest: true,
    metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

const defaultProps = {
  documents: [makeDoc()],
  onDelete: vi.fn(),
  onRefresh: vi.fn(),
  folderId: undefined,
  currentUserId: "user-1",
}

describe("DocumentList — Move to folder action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // The trigger carries the FolderInput icon; the "Move to folder" label is a Radix
  // tooltip rendered on hover (not eagerly in the DOM). Find the trigger by its icon.
  function getMoveButton(container: HTMLElement): HTMLButtonElement {
    const icon = container.querySelector("svg.lucide-folder-input")
    const btn = icon?.closest("button")
    if (!btn) throw new Error("Move-to-folder trigger not found")
    return btn as HTMLButtonElement
  }

  it("renders a 'Move to folder' trigger in the row action cluster", async () => {
    const { container } = renderWithTooltip(<DocumentList {...defaultProps} />)
    const moveBtn = getMoveButton(container)
    expect(moveBtn).toBeInTheDocument()
    // Hovering reveals the labeled tooltip (the accessible affordance).
    fireEvent.mouseEnter(moveBtn)
    fireEvent.focus(moveBtn)
    const labels = await screen.findAllByText("Move to folder")
    expect(labels.length).toBeGreaterThan(0)
  })

  it("clicking the trigger opens the MoveToFolderDialog", async () => {
    const { container } = renderWithTooltip(<DocumentList {...defaultProps} />)
    fireEvent.click(getMoveButton(container))

    // The dialog title appears once opened.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Move to folder" }),
      ).toBeInTheDocument()
    })
    // It is moving the clicked document by name (the dialog's "Moving:" line).
    expect(screen.getByText(/Moving:/)).toBeInTheDocument()
  })

  it("preserves the row-click -> detail-panel behavior (onSelect fires)", () => {
    const onSelect = vi.fn()
    renderWithTooltip(<DocumentList {...defaultProps} onSelect={onSelect} />)
    // Clicking the filename cell opens the detail panel (unchanged).
    fireEvent.click(screen.getByText("report.pdf"))
    expect(onSelect).toHaveBeenCalledWith("doc-1")
  })

  it("does not introduce drag-drop handlers (D-114-14: no drag-drop built)", () => {
    const { container } = renderWithTooltip(<DocumentList {...defaultProps} />)
    expect(container.querySelector("[draggable='true']")).toBeNull()
  })
})
