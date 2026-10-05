/**
 * Phase 270 (270-04) — the panel's placement of the Download control and the File section.
 * Asserts rendered TEXT and document ORDER, never testids (D-11).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Document } from "@/types"

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

const listMetadataFields = vi.fn()
const listRelationships = vi.fn()
const listDocuments = vi.fn()
const getDocumentDownloadUrl = vi.fn()
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listMetadataFields: (...a: unknown[]) => listMetadataFields(...a),
    listRelationships: (...a: unknown[]) => listRelationships(...a),
    listDocuments: (...a: unknown[]) => listDocuments(...a),
    getDocumentDownloadUrl: (...a: unknown[]) => getDocumentDownloadUrl(...a),
  }
})

import { DocumentDetailPanel } from "../DocumentDetailPanel"

const baseDoc: Document = {
  id: "doc-a",
  user_id: "user-1",
  folder_id: null,
  filename: "quarterly-report.pdf",
  file_path: "u/doc-a/quarterly-report.pdf",
  file_size: 12345,
  mime_type: "application/pdf",
  status: "completed",
  error_message: null,
  chunk_count: 5,
  content_hash: "abc",
  metadata: { title: "Q3 Report" },
  created_at: "2026-06-18T00:00:00Z",
  updated_at: "2026-06-18T00:00:00Z",
  version_number: 3,
  is_latest: true,
} as Document

beforeEach(() => {
  listMetadataFields.mockResolvedValue([])
  listRelationships.mockResolvedValue({
    subject: { document_id: "doc-a", filename: "quarterly-report.pdf" },
    total: 0,
    documents: [],
  })
  listDocuments.mockResolvedValue([])
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function follows(a: Element, b: Element) {
  return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe("DocumentDetailPanel — Phase 270 placement", () => {
  it("shows a labelled Download in the header, after the close button in tab order", () => {
    render(<DocumentDetailPanel doc={baseDoc} onClose={vi.fn()} />)
    const close = screen.getByRole("button", { name: "Close document details" })
    const dl = screen.getByRole("button", { name: /^Download v3 \(latest\)$/ })
    expect(dl.textContent).toContain("Download v3 (latest)")
    expect(follows(close, dl)).toBe(true)
    const fileHead = screen.getByRole("button", { name: /^File/ })
    expect(follows(dl, fileHead)).toBe(true)
  })

  it("File is the first section, open at rest with eight labels, above Details", () => {
    render(<DocumentDetailPanel doc={baseDoc} onClose={vi.fn()} />)
    const fileHead = screen.getByRole("button", { name: /^File/ })
    expect(fileHead.getAttribute("aria-expanded")).toBe("true")
    for (const label of [
      "File type",
      "File size",
      "Pages",
      "Created in the file",
      "Last modified in the file",
      "Author in the file",
      "Added to Syrel",
      "Added by",
    ]) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    const detailsHead = screen.getByRole("button", { name: /^Details/ })
    expect(follows(fileHead, detailsHead)).toBe(true)
  })

  it("reads 'You' with currentUserId, and 'name not available' without", () => {
    const { unmount } = render(
      <DocumentDetailPanel doc={baseDoc} onClose={vi.fn()} currentUserId="user-1" />,
    )
    expect(screen.getByText("You")).toBeTruthy()
    unmount()
    render(<DocumentDetailPanel doc={baseDoc} onClose={vi.fn()} />)
    expect(screen.getByText("name not available")).toBeTruthy()
  })

  it("clears a visible download error when the panel switches to another document", async () => {
    getDocumentDownloadUrl.mockRejectedValue(new Error("boom"))
    const user = userEvent.setup()
    const { rerender } = render(<DocumentDetailPanel doc={baseDoc} onClose={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /^Download v3 \(latest\)$/ }))
    await waitFor(() =>
      expect(screen.getByText("Download failed. Check your connection and try again.")).toBeTruthy(),
    )
    rerender(
      <DocumentDetailPanel
        doc={{ ...baseDoc, id: "doc-b", filename: "other.pdf" }}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByText("Download failed. Check your connection and try again.")).toBeNull()
  })

  it("keeps the connected-source banner below the header and above the File section", () => {
    const connDoc = {
      ...baseDoc,
      source_connection_id: "conn-1",
      source_connection_name: "Drive",
    } as Document
    render(<DocumentDetailPanel doc={connDoc} onClose={vi.fn()} />)
    const banner = screen.getByText(
      "Placed here by a connected source, not uploaded by a person.",
    )
    const dl = screen.getByRole("button", { name: /^Download v3 \(latest\)$/ })
    const fileHead = screen.getByRole("button", { name: /^File/ })
    expect(follows(dl, banner)).toBe(true)
    expect(follows(banner, fileHead)).toBe(true)
  })

  it("puts no href anywhere in the panel from the download control", () => {
    const { container } = render(<DocumentDetailPanel doc={baseDoc} onClose={vi.fn()} />)
    const dl = screen.getByRole("button", { name: /^Download v3 \(latest\)$/ })
    expect(dl.closest("a")).toBeNull()
    expect(dl.parentElement?.querySelector("[href]")).toBeNull()
    expect(container.querySelectorAll("a[href^='http']").length).toBe(0)
  })
})
