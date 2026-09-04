/**
 * Phase 217.1-06 — stat tiles and breadcrumb tests (TDD RED).
 *
 * ⭐ The tiles are modeled on `HealthStatBar.tsx`'s label/value/description shape.
 * Every tile has an honest-unknown fallback arm — no sparkline, no zero.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { LibraryStatTiles } from "../LibraryStatTiles"
import { LibraryBreadcrumb } from "../LibraryBreadcrumb"
import type { Document, Folder } from "@/types"

// ── Mock API ──────────────────────────────────────────────────────────────────
const { mockGetReembedProgress, mockGetHealthOverview } = vi.hoisted(() => ({
  mockGetReembedProgress: vi.fn(),
  mockGetHealthOverview: vi.fn(),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    getReembedProgress: mockGetReembedProgress,
    getHealthOverview: mockGetHealthOverview,
  }
})

// ── Sample data ───────────────────────────────────────────────────────────────
const sampleDocs: Document[] = [
  {
    id: "doc-1",
    user_id: "u1",
    folder_id: "f1",
    filename: "a.pdf",
    file_path: "/a.pdf",
    file_size: 100,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 10,
    content_hash: "abc",
    metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "doc-2",
    user_id: "u1",
    folder_id: null,
    filename: "b.txt",
    file_path: "/b.txt",
    file_size: 50,
    mime_type: "text/plain",
    status: "completed",
    error_message: null,
    chunk_count: 2,
    content_hash: "def",
    metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]

const sampleFolders: Folder[] = [
  {
    id: "folder-1",
    user_id: "u1",
    name: "Research",
    parent_id: null,
    is_org_shared: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]

describe("LibraryStatTiles", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetReembedProgress.mockResolvedValue({
      status: "idle",
      total: 224,
      re_embedded: 87,
      remaining: 137,
      model: "text-embedding-3-small",
      updated_at: null,
    })
    mockGetHealthOverview.mockResolvedValue({
      health_score: 85,
      high_confidence_rate: 0.92,
      total_documents: 42,
      retrieved_this_month: 15,
      never_retrieved_count: 3,
      stale_count: 5,
      low_confidence_queries_count: 2,
      coverage_percent: 88,
      avg_confidence: 0.78,
    })
  })

  // ── CHUNKS ──────────────────────────────────────────────────────────────────
  it("CHUNKS renders the sum of chunk_count across documents", async () => {
    render(<LibraryStatTiles documents={sampleDocs} />)
    // 10 + 2 = 12
    expect(await screen.findByText("12")).toBeInTheDocument()
  })

  it("CHUNKS renders 'across N documents' description", async () => {
    render(<LibraryStatTiles documents={sampleDocs} />)
    expect(await screen.findByText("across 2 documents")).toBeInTheDocument()
  })

  it("CHUNKS renders with the label 'Chunks'", async () => {
    render(<LibraryStatTiles documents={sampleDocs} />)
    expect(await screen.findByText("Chunks")).toBeInTheDocument()
  })

  // ── VECTORS ─────────────────────────────────────────────────────────────────
  it("VECTORS renders the vector count from getReembedProgress", async () => {
    render(<LibraryStatTiles documents={sampleDocs} />)
    // 224 total vectors/chunks
    expect(await screen.findByText("224")).toBeInTheDocument()
  })

  it("VECTORS renders the model name as description", async () => {
    render(<LibraryStatTiles documents={sampleDocs} />)
    expect(await screen.findByText("text-embedding-3-small")).toBeInTheDocument()
  })

  it("VECTORS when fetch is unreachable renders the honest-unknown arm, never 0", async () => {
    mockGetReembedProgress.mockRejectedValue(new Error("network error"))
    render(<LibraryStatTiles documents={sampleDocs} />)
    expect(await screen.findByText("Not known yet")).toBeInTheDocument()
    // The value should NOT be 0
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })

  // ── FOUND BY A SEARCH ───────────────────────────────────────────────────────
  it("FOUND BY A SEARCH renders retrieved_this_month", async () => {
    render(<LibraryStatTiles documents={sampleDocs} />)
    expect(await screen.findByText("15")).toBeInTheDocument()
  })

  it("FOUND BY A SEARCH renders 'last 30 days' description", async () => {
    render(<LibraryStatTiles documents={sampleDocs} />)
    expect(await screen.findByText("last 30 days")).toBeInTheDocument()
  })

  it("FOUND BY A SEARCH when fetch is unreachable renders the honest-unknown arm, never 0", async () => {
    mockGetHealthOverview.mockRejectedValue(new Error("network error"))
    mockGetReembedProgress.mockRejectedValue(new Error("network error"))
    render(<LibraryStatTiles documents={sampleDocs} />)
    // "Not known yet" should appear (at least once across all tiles)
    const unknowns = await screen.findAllByText("Not known yet")
    expect(unknowns.length).toBeGreaterThanOrEqual(1)
    // The value should NOT be 0
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })

  // ── NO SPARKLINE ────────────────────────────────────────────────────────────
  it("no sparkline element (svg, polyline, or chart) is present in any tile", async () => {
    render(<LibraryStatTiles documents={sampleDocs} />)
    // Wait for the async tiles to settle
    await screen.findByText("Chunks")
    // No SVG elements
    expect(screen.queryByRole("img", { hidden: true })).toBeNull()
    // No sparkline/polyline elements
    const container = document.querySelector('[data-testid="documents-stat-tiles"]')
    expect(container).not.toBeNull()
    expect(container!.querySelector("svg")).toBeNull()
    expect(container!.querySelector("polyline")).toBeNull()
  })
})

describe("LibraryBreadcrumb", () => {
  it("renders Library > folder > tab when a folder is selected", () => {
    render(
      <LibraryBreadcrumb
        folders={sampleFolders}
        selectedFolderId="folder-1"
        onSelectFolder={vi.fn()}
        tabLabel="Documents"
      />,
    )
    // "Library" is the prefix
    expect(screen.getByText("Library")).toBeInTheDocument()
    // The folder name appears (via FolderBreadcrumb)
    expect(screen.getByText("Research")).toBeInTheDocument()
    // The tab label appears as the suffix
    expect(screen.getByText("Documents")).toBeInTheDocument()
  })

  it("renders Library > tab when no folder is selected (Root)", () => {
    render(
      <LibraryBreadcrumb
        folders={sampleFolders}
        selectedFolderId={null}
        onSelectFolder={vi.fn()}
        tabLabel="Documents"
      />,
    )
    expect(screen.getByText("Library")).toBeInTheDocument()
    expect(screen.getByText("Documents")).toBeInTheDocument()
    // Root is NOT shown when no folder is selected (FolderBreadcrumb returns null)
    expect(screen.queryByText("Root")).not.toBeInTheDocument()
  })

  it("renders with a different tab label", () => {
    render(
      <LibraryBreadcrumb
        folders={sampleFolders}
        selectedFolderId="folder-1"
        onSelectFolder={vi.fn()}
        tabLabel="Views"
      />,
    )
    expect(screen.getByText("Library")).toBeInTheDocument()
    expect(screen.getByText("Views")).toBeInTheDocument()
  })
})