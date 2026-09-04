/**
 * SEED-227 — the panel tells the truth about images that were never read.
 *
 * The per-document vision ceiling has truncated silently since Phase 072: a document
 * with more images than the cap is indexed from the first N, reports a clean
 * ingestion, and no surface carries the fact. The backend now stamps
 * `metadata._images` ON TRUNCATION ONLY; these cases pin what the panel does with it.
 *
 * ⚠ The absence case is the one that matters most. `_images` is stamped only when
 * something was skipped, so a notice that rendered unconditionally would put a
 * warning on every document in the library and teach people to ignore it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { Document, MetadataFieldDef } from "@/types"

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

const listMetadataFields = vi.fn<() => Promise<MetadataFieldDef[]>>()
const updateDocumentMetadata = vi.fn<() => Promise<Document>>()
const listRelationships = vi.fn()
const listDocuments = vi.fn()
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listMetadataFields: (...a: unknown[]) => listMetadataFields(...(a as [])),
    updateDocumentMetadata: (...a: unknown[]) => updateDocumentMetadata(...(a as [])),
    listRelationships: (...a: unknown[]) => listRelationships(...(a as [])),
    listDocuments: (...a: unknown[]) => listDocuments(...(a as [])),
  }
})

import { DocumentDetailPanel } from "./DocumentDetailPanel"

function makeDoc(metadata: Document["metadata"]): Document {
  return {
    id: "doc-images-1",
    user_id: "user-1",
    folder_id: null,
    filename: "site-drawings.pdf",
    file_path: "u/doc-images-1/site-drawings.pdf",
    file_size: 999,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 5,
    content_hash: "abc",
    metadata,
    created_at: "2026-08-28T00:00:00Z",
    updated_at: "2026-08-28T00:00:00Z",
  }
}

beforeEach(() => {
  listMetadataFields.mockResolvedValue([])
  listRelationships.mockResolvedValue({
    subject: { document_id: "doc-images-1", filename: "site-drawings.pdf" },
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

describe("DocumentDetailPanel — unread images (SEED-227)", () => {
  it("names both numbers when the document was truncated", async () => {
    render(
      <DocumentDetailPanel
        doc={makeDoc({ _images: { total: 340, read: 100 } })}
        onClose={() => {}}
      />,
    )

    // Both figures must be present: the total is what makes the shortfall legible.
    // "100 of them were read" without the 340 says nothing an operator can act on.
    expect(await screen.findByText(/340 images/i)).toBeInTheDocument()
    expect(screen.getByText(/first\s+100/i)).toBeInTheDocument()
  })

  it("says nothing at all when every image was read", async () => {
    render(
      <DocumentDetailPanel
        doc={makeDoc({ title: "Site drawings" })}
        onClose={() => {}}
      />,
    )

    // Wait for the panel to settle before asserting an ABSENCE, or the assertion
    // passes simply because nothing has rendered yet.
    expect(await screen.findByText("Site drawings")).toBeInTheDocument()
    expect(screen.queryByText(/not searchable/i)).not.toBeInTheDocument()
  })

  it("speaks in the past tense about the ceiling that applied at ingestion", async () => {
    // ⚠ Raising the setting does NOT go back and read the rest. A present-tense
    // sentence here would promise a re-read that never happens, which is the same
    // class of untruth as the silence this replaced.
    render(
      <DocumentDetailPanel
        doc={makeDoc({ _images: { total: 12, read: 5 } })}
        onClose={() => {}}
      />,
    )

    const notice = await screen.findByText(/were read/i)
    expect(notice).toBeInTheDocument()
    expect(notice.textContent).toMatch(/re-upload/i)
  })
})
