/**
 * Phase 112 Plan 04 Task 3 — DocumentDetailPanel a11y contract (AC11).
 *
 * The frontend Wave-0 home for the WCAG 2.1 AA + honest-states automatable core.
 * Asserts (per GROUNDING.md a11y checklist + the plan):
 *   - no aXe AA violations on a representative panel (High / Med / Low / unscored-
 *     Extracted / Edited / absent fields),
 *   - the save receipt is role=status aria-live=polite; the error is role=alert,
 *   - every ConfidenceChip state renders a visible WORD (never colour-alone),
 *   - an unscored field NEVER renders the text "High",
 *   - under a simulated prefers-reduced-motion the save receipt STILL renders,
 *   - the accordion head is a <button aria-expanded aria-controls> + role=region body.
 *
 * Keyboard-sweep + greyscale-triage stay documented manual-only (VALIDATION.md).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import type { Document, MetadataFieldDef } from "@/types"

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

// ── Partial-mock the api client: listMetadataFields + updateDocumentMetadata are
//    observable + deterministic; everything else stays real. The Phase 117
//    RelationshipsSection now mounts inside the panel and fires its own
//    listRelationships fetch — mock it to settle deterministically (empty) so the
//    section's honest-states (role=status loading / role=alert error) don't bleed
//    into these Metadata-focused assertions. ──
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

// A representative document spanning every field state.
const doc: Document = {
  id: "doc-1",
  user_id: "user-1",
  folder_id: null,
  filename: "quarterly-report.pdf",
  file_path: "u/doc-1/quarterly-report.pdf",
  file_size: 12345,
  mime_type: "application/pdf",
  status: "completed",
  error_message: null,
  chunk_count: 5,
  content_hash: "abc",
  metadata: {
    title: "Q3 Report", // High (0.96)
    author: "Jane Doe", // Med (0.63)
    document_type: "report", // Low (0.41)
    language: "en", // unscored → Extracted (no _confidence entry)
    summary: "A manual override", // Edited (_source user)
    // date + topics absent → empty "add" affordance
    _confidence: { title: 0.96, author: 0.63, document_type: 0.41 },
    _source: { summary: "user" },
  },
  created_at: "2026-06-18T00:00:00Z",
  updated_at: "2026-06-18T00:00:00Z",
}

beforeEach(() => {
  listMetadataFields.mockResolvedValue([])
  updateDocumentMetadata.mockResolvedValue(doc)
  // Relationships section settles to a deterministic empty (no stray status/alert).
  listRelationships.mockResolvedValue({
    subject: { document_id: "doc-1", filename: "quarterly-report.pdf" },
    total: 0,
    documents: [],
  })
  listDocuments.mockResolvedValue([])
  // jsdom has no matchMedia — default to "motion allowed" (no reduce).
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

describe("DocumentDetailPanel a11y (AC11) — WCAG 2.1 AA + honest states", () => {
  it("renders no aXe AA violations across all field states", async () => {
    const { container } = render(<DocumentDetailPanel doc={doc} onClose={vi.fn()} />)
    // Wait for the metadata-fields fetch to settle (custom defs filtered).
    await waitFor(() => expect(listMetadataFields).toHaveBeenCalled())
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it("the accordion head is a <button aria-expanded aria-controls> + role=region body", async () => {
    render(<DocumentDetailPanel doc={doc} onClose={vi.fn()} />)
    // Phase 154 Plan 02: the section header now reads plainly ("Details") by
    // default via the term-map, so the accordion's accessible name is /details/i.
    // Anchor to the start so the section header ("Details" + count) is matched, not
    // the panel's "Close document details" control (which also contains "details").
    const head = await screen.findByRole("button", { name: /^details/i })
    expect(head).toHaveAttribute("aria-expanded")
    expect(head).toHaveAttribute("aria-controls")
    expect(screen.getByRole("region", { name: /details/i })).toBeInTheDocument()
  })

  it("every ConfidenceChip state renders a visible WORD (never colour-alone)", async () => {
    render(<DocumentDetailPanel doc={doc} onClose={vi.fn()} />)
    await screen.findByRole("region", { name: /details/i })
    const chips = screen.getAllByTestId("confidence-chip")
    // Each chip carries a word: High / Med / Low / Extracted / Edited.
    for (const chip of chips) {
      expect(chip.textContent?.trim().length).toBeGreaterThan(0)
    }
    // The full word set is present.
    expect(screen.getByText(/High/)).toBeInTheDocument()
    expect(screen.getByText(/Med/)).toBeInTheDocument()
    expect(screen.getByText(/Low/)).toBeInTheDocument()
    expect(screen.getByText(/Extracted/)).toBeInTheDocument()
    expect(screen.getByText(/Edited/)).toBeInTheDocument()
  })

  it("an unscored field NEVER renders the text 'High'", async () => {
    // A doc whose ONLY field is unscored (value, no _confidence) → must be Extracted.
    const unscoredDoc: Document = {
      ...doc,
      metadata: { language: "en" },
    }
    render(<DocumentDetailPanel doc={unscoredDoc} onClose={vi.fn()} />)
    await screen.findByRole("region", { name: /details/i })
    expect(screen.getByText(/Extracted/)).toBeInTheDocument()
    expect(screen.queryByText(/High/)).not.toBeInTheDocument()
  })

  it("the save receipt is role=status aria-live=polite (only after a successful PATCH)", async () => {
    const user = userEvent.setup()
    render(<DocumentDetailPanel doc={doc} onClose={vi.fn()} onReconcile={vi.fn()} />)
    await screen.findByRole("region", { name: /details/i })

    // No receipt before any edit (honesty: never optimistic).
    expect(screen.queryByRole("status")).not.toBeInTheDocument()

    // Edit the Title (High) field → Enter → await the mocked PATCH 200.
    await user.click(screen.getByRole("button", { name: /edit title/i }))
    const input = screen.getByRole("textbox", { name: /edit title/i })
    await user.clear(input)
    await user.type(input, "Q3 Report Final")
    await user.keyboard("{Enter}")

    await waitFor(() => expect(updateDocumentMetadata).toHaveBeenCalledWith("doc-1", "title", "Q3 Report Final"))
    const receipt = await screen.findByRole("status")
    expect(receipt).toHaveAttribute("aria-live", "polite")
    expect(receipt).toHaveTextContent(/saved · audit logged/i)
  })

  it("the error receipt is role=alert (assertive) when the PATCH fails", async () => {
    const user = userEvent.setup()
    updateDocumentMetadata.mockRejectedValueOnce(new Error("boom"))
    render(<DocumentDetailPanel doc={doc} onClose={vi.fn()} />)
    await screen.findByRole("region", { name: /details/i })

    await user.click(screen.getByRole("button", { name: /edit author/i }))
    const input = screen.getByRole("textbox", { name: /edit author/i })
    await user.clear(input)
    await user.type(input, "New Author")
    await user.keyboard("{Enter}")

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(/wasn't recorded/i)
    // No success receipt on a failed write.
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("the save receipt STILL renders under a simulated prefers-reduced-motion", async () => {
    // Simulate reduced motion: matchMedia('(prefers-reduced-motion: reduce)') → matches.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    const user = userEvent.setup()
    render(<DocumentDetailPanel doc={doc} onClose={vi.fn()} onReconcile={vi.fn()} />)
    await screen.findByRole("region", { name: /details/i })

    await user.click(screen.getByRole("button", { name: /edit title/i }))
    const input = screen.getByRole("textbox", { name: /edit title/i })
    await user.clear(input)
    await user.type(input, "Reduced Motion Title")
    await user.keyboard("{Enter}")

    // The receipt is gated by motion-safe: in CSS only — it must still RENDER.
    const receipt = await screen.findByRole("status")
    expect(receipt).toHaveTextContent(/saved · audit logged/i)
  })
})
