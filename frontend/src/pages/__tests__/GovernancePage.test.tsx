/**
 * Phase 119 Plan 02 Task 3 — GovernancePage behavior tests (DGOV-01 / DGOV-02).
 *
 * Locks the Governance top-level home of Plan 02:
 *  - DGOV-01: the 3 stacked signal cards (broken / unclassified / low-confidence)
 *    each render a positive "all clear" empty state on total:0, and each fetch
 *    fires EXACTLY ONCE per card — the D-119-9 initializedTabsRef no-refetch-loop
 *    guard (the regression BUG-260516-02 caused).
 *  - DGOV-02: each signal row is a pure link-out — clicking a row opens the
 *    document's DocumentDetailPanel, with NO write endpoint called (read-only,
 *    D-119-6); the rows expose no inline delete/reingest/move controls.
 *  - Refresh re-fires the 3 fetches (the init-ref clears).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Document } from "@/types"

// The 3 governance fetch helpers (the page under test) + the single doc-list
// fetch (the page resolves a clicked id to its full Document for the panel).
const getGovBroken = vi.fn()
const getGovUnclassified = vi.fn()
const getGovLowConfidence = vi.fn()
const listDocuments = vi.fn()

// Write endpoints the DocumentDetailPanel subtree COULD call — stubbed so we can
// assert the link-out never triggers a mutation (DGOV-02 read-only). The panel +
// its Relationships/Classification sections also call read fns on mount; stub all.
const updateDocumentMetadata = vi.fn()
const acceptClassification = vi.fn()
const dismissClassification = vi.fn()
const moveDocument = vi.fn()
const deleteRelationship = vi.fn()
const createRelationship = vi.fn()
const listMetadataFields = vi.fn()
const listRelationships = vi.fn()

vi.mock("@/lib/api", () => {
  // Declared INSIDE the factory — the factory is hoisted above module scope, so a
  // top-level class would not be initialized yet (ReferenceError).
  class FakeApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  }
  return {
    getGovBroken: (...a: unknown[]) => getGovBroken(...a),
    getGovUnclassified: (...a: unknown[]) => getGovUnclassified(...a),
    getGovLowConfidence: (...a: unknown[]) => getGovLowConfidence(...a),
    listDocuments: (...a: unknown[]) => listDocuments(...a),
    // panel subtree reads/writes — stubbed
    updateDocumentMetadata: (...a: unknown[]) => updateDocumentMetadata(...a),
    acceptClassification: (...a: unknown[]) => acceptClassification(...a),
    dismissClassification: (...a: unknown[]) => dismissClassification(...a),
    moveDocument: (...a: unknown[]) => moveDocument(...a),
    deleteRelationship: (...a: unknown[]) => deleteRelationship(...a),
    createRelationship: (...a: unknown[]) => createRelationship(...a),
    listMetadataFields: (...a: unknown[]) => listMetadataFields(...a),
    listRelationships: (...a: unknown[]) => listRelationships(...a),
    ApiError: FakeApiError,
  }
})

import { GovernancePage } from "../GovernancePage"
import { default as userEventReal } from "@testing-library/user-event"

const emptyPage = { items: [], total: 0, offset: 0, limit: 10 }

const docA: Document = {
  id: "doc-a",
  user_id: "user-1",
  folder_id: null,
  filename: "quarterly-report.pdf",
  file_path: "p/quarterly-report.pdf",
  file_size: 1024,
  mime_type: "application/pdf",
  status: "completed",
  error_message: null,
  chunk_count: 3,
  content_hash: "h",
  is_latest: true,
  metadata: { title: "Quarterly Report", _confidence: { title: 0.4 } } as Document["metadata"],
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
}

function renderPage() {
  return render(
    <TooltipProvider>
      <GovernancePage />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  getGovBroken.mockReset()
  getGovUnclassified.mockReset()
  getGovLowConfidence.mockReset()
  listDocuments.mockReset()
  updateDocumentMetadata.mockReset()
  acceptClassification.mockReset()
  dismissClassification.mockReset()
  moveDocument.mockReset()
  deleteRelationship.mockReset()
  createRelationship.mockReset()
  listMetadataFields.mockReset()
  listRelationships.mockReset()

  // Default: all signals empty (the common "all clear" steady state).
  getGovBroken.mockResolvedValue(emptyPage)
  getGovUnclassified.mockResolvedValue(emptyPage)
  getGovLowConfidence.mockResolvedValue(emptyPage)
  listDocuments.mockResolvedValue([docA])
  // panel subtree reads degrade to empty
  listMetadataFields.mockResolvedValue([])
  listRelationships.mockResolvedValue({ subject: null, total: 0, documents: [] })
})

describe("GovernancePage", () => {
  it("renders 3 stacked signal cards", async () => {
    renderPage()
    await waitFor(() => expect(getGovBroken).toHaveBeenCalled())
    expect(screen.getByText("Broken relationships")).toBeInTheDocument()
    expect(screen.getByText("Unclassified documents")).toBeInTheDocument()
    expect(screen.getByText("Low-confidence metadata")).toBeInTheDocument()
  })

  it("shows a positive 'all clear' empty state per card on total:0 — and fires EXACTLY ONCE per card (no refetch loop, D-119-9)", async () => {
    renderPage()
    // Let the effects settle.
    await waitFor(() => {
      expect(getGovBroken).toHaveBeenCalled()
      expect(getGovUnclassified).toHaveBeenCalled()
      expect(getGovLowConfidence).toHaveBeenCalled()
    })
    // The positive empty headings render (the "all clear" state).
    await screen.findByText("No broken links")
    expect(screen.getByText("Nothing to triage")).toBeInTheDocument()
    expect(screen.getByText("Metadata looks solid")).toBeInTheDocument()

    // THE no-refetch-loop assertion (BUG-260516-02): an empty (total:0) response
    // must NOT re-trigger the fetch — exactly one call per endpoint after settle.
    // Give any errant loop a chance to fire, then assert the count stayed at 1.
    await new Promise((r) => setTimeout(r, 80))
    expect(getGovBroken).toHaveBeenCalledTimes(1)
    expect(getGovUnclassified).toHaveBeenCalledTimes(1)
    expect(getGovLowConfidence).toHaveBeenCalledTimes(1)
  })

  it("link-out: clicking a low-confidence row opens DocumentDetailPanel for that doc, with NO write endpoint called (DGOV-02 / D-119-6)", async () => {
    const user = userEventReal.setup()
    getGovLowConfidence.mockResolvedValue({
      items: [{ document_id: "doc-a", filename: "quarterly-report.pdf", folder_id: null, low_fields: { title: 0.4 }, min_confidence: 0.4 }],
      total: 1,
      offset: 0,
      limit: 10,
    })
    renderPage()

    // The row renders inside the low-confidence card.
    const row = await screen.findByRole("button", { name: /open quarterly-report\.pdf/i })
    await user.click(row)

    // The DocumentDetailPanel mounts (it renders the filename as its title/heading).
    await waitFor(() => {
      const hits = screen.getAllByText("quarterly-report.pdf")
      // the row + the panel header → at least 2 occurrences once the panel mounts
      expect(hits.length).toBeGreaterThanOrEqual(2)
    })

    // Read-only: no write endpoint fired on the link-out (D-119-6).
    expect(moveDocument).not.toHaveBeenCalled()
    expect(acceptClassification).not.toHaveBeenCalled()
    expect(dismissClassification).not.toHaveBeenCalled()
    expect(updateDocumentMetadata).not.toHaveBeenCalled()
    expect(deleteRelationship).not.toHaveBeenCalled()
  })

  it("rows expose no inline delete/reingest/move controls (D-119-6 read-only)", async () => {
    getGovUnclassified.mockResolvedValue({
      items: [{ document_id: "doc-a", filename: "quarterly-report.pdf", folder_id: null, suggested_folder_name: "Reports" }],
      total: 1,
      offset: 0,
      limit: 10,
    })
    renderPage()
    const row = await screen.findByRole("button", { name: /open quarterly-report\.pdf/i })
    const scope = within(row)
    expect(scope.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument()
    expect(scope.queryByRole("button", { name: /re-ingest|reingest/i })).not.toBeInTheDocument()
    expect(scope.queryByRole("button", { name: /move/i })).not.toBeInTheDocument()
  })

  it("Refresh re-fires the 3 fetches (the init-ref clears, D-119-9)", async () => {
    const user = userEventReal.setup()
    renderPage()
    await waitFor(() => expect(getGovBroken).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole("button", { name: /refresh/i }))

    await waitFor(() => {
      expect(getGovBroken).toHaveBeenCalledTimes(2)
      expect(getGovUnclassified).toHaveBeenCalledTimes(2)
      expect(getGovLowConfidence).toHaveBeenCalledTimes(2)
    })
  })
})
