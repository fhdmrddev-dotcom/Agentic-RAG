/**
 * Phase 271-04 (D-06 / T-271-16 / RESEARCH Pitfall 6) — Find can open an OLDER version, and the
 * panel says what it is instead of offering edits the server refuses.
 *
 * `PATCH /documents/{id}/metadata` is latest-only (documents.py:1981-1995): on a superseded row
 * it 404s. Before Find, the panel could only be reached from the latest-rows list, so it never
 * had to know. Now an older row is one click away, and an inline editor on it would turn every
 * save into "Couldn't save — your change wasn't recorded" with no reason given.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
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
const updateDocumentMetadata = vi.fn()
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listMetadataFields: (...a: unknown[]) => listMetadataFields(...a),
    listRelationships: (...a: unknown[]) => listRelationships(...a),
    updateDocumentMetadata: (...a: unknown[]) => updateDocumentMetadata(...a),
  }
})

import { DocumentDetailPanel } from "../DocumentDetailPanel"

const base: Document = {
  id: "doc-a",
  user_id: "user-1",
  folder_id: null,
  filename: "acme-msa.pdf",
  file_path: "u/doc-a/acme-msa.pdf",
  file_size: 12345,
  mime_type: "application/pdf",
  status: "completed",
  error_message: null,
  chunk_count: 5,
  content_hash: "abc",
  metadata: { title: "Acme MSA", author: "Legal" },
  created_at: "2026-06-18T00:00:00Z",
  updated_at: "2026-06-18T00:00:00Z",
} as Document

const NOTICE =
  "This is an older version (v1). It is version history: fields can only be changed on the latest version."

beforeEach(() => {
  vi.clearAllMocks()
  listMetadataFields.mockResolvedValue([])
  listRelationships.mockResolvedValue({
    subject: { document_id: "doc-a", filename: "acme-msa.pdf" },
    total: 0,
    documents: [],
  })
  updateDocumentMetadata.mockResolvedValue({})
})

const editControls = () => screen.queryAllByRole("button", { name: /^(Edit|Add) / })

describe("DocumentDetailPanel — an older version (Phase 271-04)", () => {
  it("states it is version history and offers no inline edit", async () => {
    render(
      <DocumentDetailPanel
        doc={{ ...base, is_latest: false, version_number: 1 }}
        onClose={vi.fn()}
      />,
    )
    const status = screen.getAllByRole("status").find((s) => s.textContent === NOTICE)
    expect(status).toBeTruthy()
    await waitFor(() => expect(listMetadataFields).toHaveBeenCalled())
    // The values are still READ: the title is on screen as text.
    expect(screen.getByText("Acme MSA")).toBeInTheDocument()
    expect(editControls()).toHaveLength(0)
    expect(updateDocumentMetadata).not.toHaveBeenCalled()
  })

  it.each([
    ["is_latest true", { is_latest: true, version_number: 2 }],
    ["is_latest undefined", {}],
  ])("%s: the panel is unchanged — no notice, edit controls present", async (_n, over) => {
    render(<DocumentDetailPanel doc={{ ...base, ...over }} onClose={vi.fn()} />)
    await waitFor(() => expect(listMetadataFields).toHaveBeenCalled())
    expect(screen.queryByText(/This is an older version/)).toBeNull()
    expect(editControls().length).toBeGreaterThan(0)
  })
})
