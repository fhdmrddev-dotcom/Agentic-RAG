/**
 * Phase 118 Plan 05 Task 2 — DocumentList row chip (sketch 036-A) behavior tests.
 *
 * The compact one-glance `→ folder ✓ ✕` chip lives on a list row ONLY when the doc
 * carries a "suggested" `metadata._classification` (zero new fetch — reads the existing
 * doc.metadata). The full provenance card lives in the panel (Task 1).
 *
 * Asserts:
 *  - chip renders for status==="suggested" (folder name + ✓ + ✕);
 *  - NO chip for no _classification AND for status==="accepted";
 *  - ✓ calls acceptClassification(doc.id); ✕ calls dismissClassification(doc.id);
 *  - on success the list reconciles (onRefresh) — re-fetch-not-optimistic;
 *  - a11y: ✓/✕ carry aria-label.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, within, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Document, ClassificationSuggestion } from "@/types"

// ── Mock Supabase auth so the real api.ts module-load never builds a real client. ──
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

// ── Partial-mock the api client: accept/dismiss observable; everything else real. ──
const acceptClassification = vi.fn<() => Promise<Document>>()
const dismissClassification = vi.fn<() => Promise<Document>>()
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    acceptClassification: (...a: unknown[]) => acceptClassification(...(a as [])),
    dismissClassification: (...a: unknown[]) => dismissClassification(...(a as [])),
  }
})

import { TooltipProvider } from "@/components/ui/tooltip"
import { DocumentList } from "./DocumentList"

function makeDoc(id: string, overrides: Partial<Document> = {}): Document {
  return {
    id,
    user_id: "user-1",
    folder_id: null,
    filename: `${id}.pdf`,
    file_path: `u/${id}/${id}.pdf`,
    file_size: 1024,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 3,
    content_hash: "h",
    metadata: null,
    created_at: "2026-06-21T00:00:00Z",
    updated_at: "2026-06-21T00:00:00Z",
    ...overrides,
  }
}

const suggested: ClassificationSuggestion = {
  rule_id: "rule-1",
  rule_name: "Acme Invoices Rule",
  condition_summary: 'document_type is "invoice"',
  suggested_folder_id: "folder-fin",
  suggested_folder_name: "Finance Inbox",
  status: "suggested",
}

const accepted: ClassificationSuggestion = {
  ...suggested,
  status: "accepted",
  prior_folder_id: "folder-inbox",
}

function renderList(docs: Document[], onRefresh = vi.fn()) {
  return render(
    <TooltipProvider>
      <DocumentList
        documents={docs}
        onDelete={vi.fn()}
        onRefresh={onRefresh}
        currentUserId="user-1"
      />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  acceptClassification.mockResolvedValue(makeDoc("d-1"))
  dismissClassification.mockResolvedValue(makeDoc("d-1"))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("DocumentList row chip — renders only for a suggested doc", () => {
  it("renders the chip (folder name + ✓ + ✕) for a status==='suggested' doc", () => {
    const doc = makeDoc("d-1", { metadata: { _classification: suggested } })
    renderList([doc])
    // The suggested folder name appears in the row chip.
    expect(screen.getByText(/Finance Inbox/)).toBeInTheDocument()
    // Both accept + dismiss controls present.
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument()
  })

  it("renders NO chip when the doc has no _classification", () => {
    const doc = makeDoc("d-1", { metadata: { title: "x" } })
    renderList([doc])
    expect(screen.queryByRole("button", { name: /accept classification/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /dismiss classification/i })).not.toBeInTheDocument()
  })

  it("renders NO chip when the suggestion is already accepted", () => {
    const doc = makeDoc("d-1", { metadata: { _classification: accepted } })
    renderList([doc])
    expect(screen.queryByRole("button", { name: /accept classification/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /dismiss classification/i })).not.toBeInTheDocument()
  })
})

describe("DocumentList row chip — wires ✓/✕ + reconciles", () => {
  it("✓ calls acceptClassification(doc.id) then onRefresh (re-fetch-not-optimistic)", async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    const doc = makeDoc("d-1", { metadata: { _classification: suggested } })
    renderList([doc], onRefresh)

    await user.click(screen.getByRole("button", { name: /accept/i }))

    await waitFor(() => expect(acceptClassification).toHaveBeenCalledWith("d-1"))
    await waitFor(() => expect(onRefresh).toHaveBeenCalled())
  })

  it("✕ calls dismissClassification(doc.id) then onRefresh", async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    const doc = makeDoc("d-1", { metadata: { _classification: suggested } })
    renderList([doc], onRefresh)

    await user.click(screen.getByRole("button", { name: /dismiss/i }))

    await waitFor(() => expect(dismissClassification).toHaveBeenCalledWith("d-1"))
    await waitFor(() => expect(onRefresh).toHaveBeenCalled())
  })
})

describe("DocumentList row chip — a11y", () => {
  it("✓ and ✕ carry an aria-label", () => {
    const doc = makeDoc("d-1", { metadata: { _classification: suggested } })
    renderList([doc])
    expect(screen.getByRole("button", { name: /accept/i })).toHaveAttribute("aria-label")
    expect(screen.getByRole("button", { name: /dismiss/i })).toHaveAttribute("aria-label")
  })

  it("the chip controls live within the document's own row", () => {
    const doc = makeDoc("d-1", { metadata: { _classification: suggested } })
    renderList([doc])
    const row = screen.getByText("d-1.pdf").closest("tr")
    expect(row).not.toBeNull()
    expect(
      within(row as HTMLElement).getByRole("button", { name: /accept/i }),
    ).toBeInTheDocument()
  })
})
