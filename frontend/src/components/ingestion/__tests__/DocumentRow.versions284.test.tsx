/**
 * Phase 284-03 Task 3 (FIX-11 / D-17 / UI-SPEC S10) — the version history reads ONE bounded page
 * and says when it is showing part: "{M} versions, showing {N}", below the table, only when N < M.
 * When every version is shown no line renders. Asserts rendered TEXT (D-11 of 270).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { Document, DocumentVersionPage } from "@/types"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

const fetchDocumentVersionsPage = vi.fn<(id: string, page?: { offset?: number; limit?: number }) => Promise<DocumentVersionPage>>()
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    fetchDocumentVersionsPage: (...a: unknown[]) => fetchDocumentVersionsPage(...(a as [string])),
    restoreDocumentVersion: vi.fn(),
    getDocumentDownloadUrl: vi.fn(),
  }
})

import { TooltipProvider } from "@/components/ui/tooltip"
import { DocumentRow } from "../DocumentRow"

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: "d-head",
    user_id: "user-1",
    folder_id: null,
    filename: "report.pdf",
    file_path: "u/d-head/report.pdf",
    file_size: 1024,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 3,
    content_hash: "h",
    metadata: {},
    created_at: "2026-06-18T00:00:00Z",
    updated_at: "2026-06-18T00:00:00Z",
    version_number: 120,
    is_latest: true,
    ...overrides,
  } as Document
}

function versions(n: number): Document[] {
  return Array.from({ length: n }, (_, i) =>
    makeDoc({ id: `v-${i}`, version_number: 120 - i, is_latest: i === 0 }),
  )
}

function renderExpanded(doc: Document) {
  return render(
    <TooltipProvider>
      <table>
        <tbody>
          <DocumentRow
            doc={doc}
            maxChunkCount={5}
            isExpanded
            onToggleExpand={vi.fn()}
            reingesting={false}
            onReingest={vi.fn()}
            onMove={vi.fn()}
            onDeleteRequest={vi.fn()}
            onRefresh={vi.fn()}
            currentUserId="user-1"
          />
        </tbody>
      </table>
    </TooltipProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("DocumentRow — the version history is one bounded page (S10)", () => {
  it("reads the first 50 through the page client", async () => {
    fetchDocumentVersionsPage.mockResolvedValue({ versions: versions(3), total: 3, offset: 0, limit: 50 })
    renderExpanded(makeDoc())
    await screen.findByRole("table", { name: "Version history" })
    expect(fetchDocumentVersionsPage).toHaveBeenCalledTimes(1)
    expect(fetchDocumentVersionsPage).toHaveBeenCalledWith("d-head", { offset: 0, limit: 50 })
  })

  it("says '{M} versions, showing {N}' below the table when it shows part", async () => {
    fetchDocumentVersionsPage.mockResolvedValue({ versions: versions(50), total: 120, offset: 0, limit: 50 })
    renderExpanded(makeDoc())
    const table = await screen.findByRole("table", { name: "Version history" })
    const line = screen.getByText("120 versions, showing 50")
    expect(line.className).toContain("text-xs")
    expect(line.className).toContain("text-muted-foreground")
    // Below the table, not above it.
    expect(table.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("renders no line when every version is shown", async () => {
    fetchDocumentVersionsPage.mockResolvedValue({ versions: versions(3), total: 3, offset: 0, limit: 50 })
    renderExpanded(makeDoc())
    await screen.findByRole("table", { name: "Version history" })
    expect(screen.queryByText(/versions, showing/)).toBeNull()
  })
})
