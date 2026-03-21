/**
 * Integration tests for IngestionPage two-panel layout.
 *
 * Mocks:
 * - @/hooks/useDocuments — returns sample documents with folder_id fields
 * - @/hooks/useFolders — returns sample folders
 * - @/lib/supabase — prevents real auth/channel calls
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Document, Folder } from "@/types"

// ── Mock hooks ─────────────────────────────────────────────────────────────────
const { mockUseDocuments, mockUseFolders } = vi.hoisted(() => ({
  mockUseDocuments: vi.fn(),
  mockUseFolders: vi.fn(),
}))

vi.mock("@/hooks/useDocuments", () => ({
  useDocuments: mockUseDocuments,
}))

vi.mock("@/hooks/useFolders", () => ({
  useFolders: mockUseFolders,
}))

// ── Mock Supabase (prevent real network calls) ─────────────────────────────────
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
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
    is_global: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "folder-2",
    user_id: "user-1",
    name: "Reports",
    parent_id: null,
    is_global: false,
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

function renderPage(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe("IngestionPage", () => {
  beforeEach(() => {
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
  })

  it("renders heading 'Documents'", async () => {
    const { IngestionPage } = await import("@/pages/IngestionPage")
    renderPage(<IngestionPage />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Documents")
  })

  it("renders two-panel layout with FolderTree and DocumentUpload", async () => {
    const { IngestionPage } = await import("@/pages/IngestionPage")
    renderPage(<IngestionPage />)
    // Folder tree panel: "Folders" section label
    expect(screen.getByText("Folders")).toBeInTheDocument()
    // Upload component with "Upload to Root" (default — no folder selected)
    expect(screen.getByText("Upload to Root")).toBeInTheDocument()
  })

  it("DocumentUpload shows 'Upload to Root' when no folder selected", async () => {
    const { IngestionPage } = await import("@/pages/IngestionPage")
    renderPage(<IngestionPage />)
    expect(screen.getByText("Upload to Root")).toBeInTheDocument()
  })

  it("DocumentList shows only root documents when Root is selected (default)", async () => {
    // Default state: selectedFolderId = null → Root → show folder_id === null docs
    const { IngestionPage } = await import("@/pages/IngestionPage")
    renderPage(<IngestionPage />)
    // root-doc.txt has folder_id null so it should show
    expect(screen.getByText("root-doc.txt")).toBeInTheDocument()
    // research.pdf is in folder-1, not root, should not show
    expect(screen.queryByText("research.pdf")).not.toBeInTheDocument()
  })
})
