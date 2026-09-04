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

// ── Phase 217.1 plan 05 — the seam extraction ──────────────────────────────────────────

describe("DocumentList — the seven-column table survives the DocumentRow extraction", () => {
  it("renders exactly 7 <th> in order chevron/Filename/Type/Size/Chunks/Status/Actions", () => {
    renderList([makeDoc("d-1")])
    const headers = document.querySelectorAll("thead th")
    expect(headers).toHaveLength(7)
    // Columns 2-7 carry text; column 1 is the empty chevron column.
    expect(headers[1].textContent).toBe("Filename")
    expect(headers[2].textContent).toBe("Type")
    expect(headers[3].textContent).toBe("Size")
    expect(headers[4].textContent).toBe("Chunks")
    expect(headers[5].textContent).toBe("Status")
    expect(headers[6].textContent).toBe("Actions")
  })

  it("the <th> class string stays px-4 py-3 … (the A1/A2 shed reads it)", () => {
    renderList([makeDoc("d-1")])
    const headers = document.querySelectorAll("thead th")
    for (let i = 1; i < headers.length; i++) {
      expect(headers[i].className).toContain("px-4 py-3")
    }
  })

  it("a row renders exactly seven <td> — the nth-child shed depends on it", () => {
    renderList([makeDoc("d-1")])
    const cells = document.querySelectorAll("tbody tr:first-child td")
    expect(cells).toHaveLength(7)
  })
})

describe("DocumentList — the folder tag pill (D-217.1-31)", () => {
  const folders = [
    {
      id: "f-legal",
      user_id: "user-1",
      name: "Legal",
      parent_id: null,
      is_org_shared: false,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
  ]

  it("a row whose folder_id resolves renders the folder-name pill", () => {
    const doc = makeDoc("d-1", { folder_id: "f-legal" })
    render(
      <TooltipProvider>
        <DocumentList documents={[doc]} onDelete={vi.fn()} onRefresh={vi.fn()} currentUserId="user-1" folders={folders} />
      </TooltipProvider>,
    )
    const pill = screen.getByTestId("folder-pill")
    expect(pill.textContent).toBe("Legal")
  })

  it("a row with folder_id: null renders the Root pill — never Uncategorized", () => {
    const doc = makeDoc("d-1", { folder_id: null })
    render(
      <TooltipProvider>
        <DocumentList documents={[doc]} onDelete={vi.fn()} onRefresh={vi.fn()} currentUserId="user-1" folders={folders} />
      </TooltipProvider>,
    )
    const pill = screen.getByTestId("folder-pill")
    expect(pill.textContent).toBe("Root")
    expect(screen.queryByText("Uncategorized")).not.toBeInTheDocument()
  })
})

describe("DocumentList — chunk proportion bar (LIB-03)", () => {
  it("the Chunks cell renders the proportion bar with the tabular count", () => {
    renderList([makeDoc("d-1", { chunk_count: 12 }), makeDoc("d-2", { chunk_count: 6 })])
    const bars = screen.getAllByTestId("chunk-proportion-bar")
    expect(bars).toHaveLength(2)
    // The highest count (12) is the bar's denominator.
    expect(bars[0].textContent).toContain("12")
    expect(bars[1].textContent).toContain("6")
  })

  it("value 0 renders a visible empty track, never a missing element", () => {
    renderList([makeDoc("d-1", { chunk_count: 0 })])
    const bar = screen.getByTestId("chunk-proportion-bar")
    expect(bar).toBeInTheDocument()
    expect(bar.textContent).toContain("0")
  })
})

describe("DocumentList — the Status cell (strip for processing, sentence for failed)", () => {
  it("a processing row renders the inline six-stage IngestionStrip", () => {
    renderList([makeDoc("d-1", { status: "processing", ingestion_step: "embedding" })])
    expect(screen.getByTestId("ingestion-strip")).toBeInTheDocument()
  })

  it("a failed row renders the classified sentence, never the raw dict", () => {
    renderList([
      makeDoc("d-1", {
        status: "failed",
        error_message: '{"code": "23505", "message": "duplicate key value violates unique constraint"}',
      }),
    ])
    const sentence = screen.getByTestId("row-failure-sentence")
    expect(sentence.textContent).toContain("already in your library")
    expect(sentence.textContent).not.toContain("23505")
  })

  it("a completed row still renders the DocumentStatusBadge", () => {
    renderList([makeDoc("d-1", { status: "completed" })])
    expect(screen.queryByTestId("ingestion-strip")).not.toBeInTheDocument()
    expect(screen.queryByTestId("row-failure-sentence")).not.toBeInTheDocument()
  })
})
