/**
 * Phase 217 Plan 10 Task 3 (LIB-04 / D-217-04 / T-217-38) — the two new detail sections
 * cost NOTHING until they are opened.
 *
 * ⭐ THE CRITERION THIS SUITE EXISTS FOR: `PanelSection` defaults `defaultOpen = true`
 * and the three shipped mounts rely on that default, so copying the shipped
 * `RelationshipsSection` mount verbatim would have fired a request for the document's
 * full parsed text — potentially megabytes — the instant anybody clicked a row. The
 * lazy mechanism is `PanelSection.tsx:94` rendering children only when open; there is no
 * `onOpenChange` prop to hang anything off, so the ONLY thing standing between the
 * product and that regression is one prop on two mounts. This suite is what makes
 * dropping it loud.
 *
 * ⚠ D-217-25c — THE COLD-OPEN COUNT IS ONE, NOT ZERO, AND THIS SUITE ASSERTS THE HONEST
 * NUMBER. `DocumentDetailPanel.tsx` omits `defaultOpen` on the Relationships mount, so
 * `RelationshipsSection` inherits `true` and fetches on mount today. That is shipped
 * behaviour Phase 217 deliberately leaves alone (changing it is a props edit this plan's
 * own fence forbids). So: the FIVE NEW sections add ZERO, and a suite claiming the panel
 * fires nothing at all would be refuted by the first person to open the network tab.
 *
 * ⚠ `@/lib/api` is mocked at THE BARREL PATH, which is what the components import.
 * Mocking `@/lib/api/documents` would leave the real barrel in place, the components
 * would resolve the real functions through it, and every mock here would be unreachable
 * while the suite still went green.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react"
import type { Document, DocumentChunkRow, DocumentContentResponse, MetadataFieldDef } from "@/types"

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
// ⚠ These two carry their real ARGUMENT types, unlike the four above. The cases below
// assert on `mock.calls[n][0]` (the document id) and `[n][1]` (the paging opts), and a
// zero-arg generic makes every call tuple `[]` — so those assertions would not typecheck
// and, worse, a nullable index read would have silently allowed asserting nothing.
const getDocumentContent =
  vi.fn<(id: string, opts?: { startLine?: number; endLine?: number }) => Promise<DocumentContentResponse>>()
const listDocumentChunks = vi.fn<(id: string) => Promise<DocumentChunkRow[]>>()

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listMetadataFields: (...a: unknown[]) => listMetadataFields(...(a as [])),
    updateDocumentMetadata: (...a: unknown[]) => updateDocumentMetadata(...(a as [])),
    listRelationships: (...a: unknown[]) => listRelationships(...(a as [])),
    listDocuments: (...a: unknown[]) => listDocuments(...(a as [])),
    getDocumentContent: (...a: unknown[]) =>
      getDocumentContent(...(a as [string, { startLine?: number; endLine?: number }?])),
    listDocumentChunks: (...a: unknown[]) => listDocumentChunks(...(a as [string])),
  }
})

import { DocumentDetailPanel } from "../DocumentDetailPanel"

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc-lazy-1",
    user_id: "user-1",
    folder_id: null,
    filename: "spec.pdf",
    file_path: "u/doc-lazy-1/spec.pdf",
    file_size: 4096,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 3,
    content_hash: "hash-1",
    extractor: "docling",
    metadata: { title: "The spec" },
    created_at: "2026-08-29T00:00:00Z",
    updated_at: "2026-08-29T00:00:00Z",
    ...overrides,
  }
}

function contentEnvelope(over: Partial<DocumentContentResponse> = {}): DocumentContentResponse {
  return {
    document_id: "doc-lazy-1",
    filename: "spec.pdf",
    total_lines: 3,
    content: "alpha\nbeta\ngamma",
    start_line: 1,
    end_line: 3,
    has_more: false,
    ...over,
  }
}

/** Every `PanelSection` head is a real `<button aria-expanded>`; its accessible text is
 *  the title plus (once loaded) a count badge. Returns the TITLE WORDS only, so a badge
 *  appearing later cannot silently change what the order fence is comparing. */
function sectionTitles(): string[] {
  return screen
    .getAllByRole("button", { expanded: false })
    .concat(screen.queryAllByRole("button", { expanded: true }))
    .map((b) => b.textContent ?? "")
    .map((t) => t.replace(/\d+(\/\d+)?$/, "").trim())
    .filter(Boolean)
}

/** The heads in DOM order (the two helpers above split by state; this one does not). */
function sectionTitlesInDomOrder(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("button[aria-expanded]"))
    .map((b) => (b.textContent ?? "").replace(/\d+(\/\d+)?$/, "").trim())
    .filter(Boolean)
}

function openSection(title: string) {
  const head = screen
    .getAllByRole("button")
    .find((b) => b.hasAttribute("aria-expanded") && (b.textContent ?? "").startsWith(title))
  if (!head) throw new Error(`no PanelSection head titled "${title}"`)
  fireEvent.click(head)
  return head
}

beforeEach(() => {
  listMetadataFields.mockResolvedValue([])
  listRelationships.mockResolvedValue({
    subject: { document_id: "doc-lazy-1", filename: "spec.pdf" },
    total: 0,
    documents: [],
  })
  listDocuments.mockResolvedValue([])
  getDocumentContent.mockResolvedValue(contentEnvelope())
  listDocumentChunks.mockResolvedValue([])
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

describe("detail sections are lazy — zero requests before the accordion is clicked", () => {
  it("fires NO content or chunks request on open, and exactly one on each expand", async () => {
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)

    // ── NON-VACUITY CONTROL ──────────────────────────────────────────────────────
    // "zero calls" is trivially satisfiable by a panel that failed to render at all,
    // so before believing the zero we prove the panel is UP and doing its normal work:
    // the metadata fetch that has always run on mount HAS run, and both accordion
    // heads are on screen and clickable.
    expect(await screen.findByText("The spec")).toBeInTheDocument()
    expect(listMetadataFields).toHaveBeenCalled()
    expect(sectionTitles()).toEqual(expect.arrayContaining(["Text", "Chunks"]))

    // ── THE CRITERION ────────────────────────────────────────────────────────────
    expect(getDocumentContent).toHaveBeenCalledTimes(0)
    expect(listDocumentChunks).toHaveBeenCalledTimes(0)

    // ── D-217-25c: the honest cold-open count is ONE, not zero ────────────────────
    // RelationshipsSection is mounted eagerly (shipped behaviour, deliberately left
    // alone) and fetches in a bare useEffect. Asserting it here keeps the phase's
    // must_have from drifting into a claim the network tab refutes.
    expect(listRelationships).toHaveBeenCalledTimes(1)

    openSection("Text")
    expect(await screen.findByText(/alpha/)).toBeInTheDocument()
    expect(getDocumentContent).toHaveBeenCalledTimes(1)
    expect(getDocumentContent.mock.calls[0][0]).toBe("doc-lazy-1")
    // Opening Text must not drag Chunks along with it.
    expect(listDocumentChunks).toHaveBeenCalledTimes(0)

    openSection("Chunks")
    await screen.findByText(/no indexed chunks/i)
    expect(listDocumentChunks).toHaveBeenCalledTimes(1)
    expect(listDocumentChunks.mock.calls[0][0]).toBe("doc-lazy-1")
  })

  it("keeps the eight sections in the D-217-25a order, read from the rendered DOM", async () => {
    // ⚠ Asserted from the DOM, not from the source: a source grep would pass on a build
    // that declared the sections in order and rendered them somewhere else.
    const { container } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The spec")).toBeInTheDocument()

    const titles = sectionTitlesInDomOrder(container)
    expect(titles.slice(0, 3)).toEqual(["Details", "Text", "Chunks"])
    expect(titles.slice(-2)).toEqual(["Relationships", "Classification"])
  })

  it("⛔ never titles a section 'Details' twice (D-217-25b)", async () => {
    const { container } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The spec")).toBeInTheDocument()
    const titles = sectionTitlesInDomOrder(container)
    expect(titles.filter((t) => t === "Details")).toHaveLength(1)
  })
})

describe("Text section — four honest arms", () => {
  it("renders the loading arm while the read is in flight", async () => {
    getDocumentContent.mockReturnValue(new Promise(() => {}))
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The spec")).toBeInTheDocument()

    openSection("Text")
    const status = await screen.findByText("Loading document text")
    expect(status.closest('[role="status"]')).toHaveAttribute("aria-live", "polite")
  })

  it("renders the error arm with a Try again control, distinct from empty", async () => {
    getDocumentContent.mockRejectedValue(new Error("boom"))
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The spec")).toBeInTheDocument()

    openSection("Text")
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toMatch(/couldn.t load/i)
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
    // ⚠ An error is NOT an empty result (D-117-10): the empty sentence must be absent.
    expect(screen.queryByText(/no text was extracted/i)).not.toBeInTheDocument()
  })

  it("renders a WORDED empty arm — different words from the error, and no alert", async () => {
    getDocumentContent.mockResolvedValue(contentEnvelope({ content: "", total_lines: 0 }))
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The spec")).toBeInTheDocument()

    openSection("Text")
    expect(await screen.findByText(/no text was extracted/i)).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument()
  })

  it("renders the text UNNUMBERED and names the extractor as its provenance", async () => {
    getDocumentContent.mockResolvedValue(
      contentEnvelope({ content: "first line\nsecond line\nthird line" }),
    )
    const { container } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The spec")).toBeInTheDocument()

    openSection("Text")
    const pre = await screen.findByText(/first line/)
    // ⛔ D-217-05: `read_path` numbers lines for the AGENT and NOT for a person. No line
    // may carry a `12: ` prefix — that decision was made at the other end of the wire
    // and re-adding it here would quietly undo it.
    for (const line of (pre.textContent ?? "").split("\n")) {
      expect(line).not.toMatch(/^\s*\d+:\s/)
    }
    // D-217-08 — which engine read the file changes what the text IS.
    expect(within(container).getByText("docling")).toBeInTheDocument()
  })

  it("offers Load more only when the server says there is more", async () => {
    getDocumentContent.mockResolvedValue(
      contentEnvelope({ content: "page one", total_lines: 900, end_line: 500, has_more: true }),
    )
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The spec")).toBeInTheDocument()

    openSection("Text")
    expect(await screen.findByRole("button", { name: /load more/i })).toBeInTheDocument()
    // The count comes off the envelope; it is never re-derived from the text length.
    expect(screen.getByText(/showing 500 of 900 lines/i)).toBeInTheDocument()

    // The continuation asks for the line AFTER the one the server said it served.
    getDocumentContent.mockResolvedValue(
      contentEnvelope({ content: "page two", total_lines: 900, start_line: 501, end_line: 900, has_more: false }),
    )
    fireEvent.click(screen.getByRole("button", { name: /load more/i }))
    expect(await screen.findByText(/page two/)).toBeInTheDocument()
    expect(getDocumentContent.mock.calls[1][1]).toEqual({ startLine: 501 })
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument()
  })
})

describe("Chunks section — four honest arms and the per-chunk model", () => {
  const chunk = (over: Partial<DocumentChunkRow> = {}): DocumentChunkRow => ({
    id: "c1",
    chunk_index: 0,
    content: "chunk text",
    embedding_model: "text-embedding-3-small",
    embedding_dimensions: 1536,
    ...over,
  })

  it("renders the loading arm while the read is in flight", async () => {
    listDocumentChunks.mockReturnValue(new Promise(() => {}))
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The spec")).toBeInTheDocument()

    openSection("Chunks")
    const status = await screen.findByText("Loading chunks")
    expect(status.closest('[role="status"]')).toHaveAttribute("aria-live", "polite")
  })

  it("renders the error arm with Try again, distinct from the empty arm", async () => {
    listDocumentChunks.mockRejectedValue(new Error("boom"))
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The spec")).toBeInTheDocument()

    openSection("Chunks")
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toMatch(/couldn.t load/i)
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
    expect(screen.queryByText(/no indexed chunks/i)).not.toBeInTheDocument()
  })

  it("⭐ shows the embedding model PER CHUNK, so a half-re-embedded document is legible", async () => {
    // D-217-08 — the whole reason this data is per-chunk. Two chunks of ONE document,
    // written with DIFFERENT models: that is what a re-embed in flight looks like, and
    // it is invisible everywhere else in the product.
    listDocumentChunks.mockResolvedValue([
      chunk({ id: "c1", chunk_index: 0, embedding_model: "text-embedding-3-small" }),
      chunk({ id: "c2", chunk_index: 1, embedding_model: "text-embedding-ada-002" }),
    ])
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The spec")).toBeInTheDocument()

    openSection("Chunks")
    expect(await screen.findByText(/text-embedding-3-small/)).toBeInTheDocument()
    expect(screen.getByText(/text-embedding-ada-002/)).toBeInTheDocument()
  })

  it("says so honestly when a chunk records no model at all", async () => {
    listDocumentChunks.mockResolvedValue([chunk({ embedding_model: null, embedding_dimensions: null })])
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The spec")).toBeInTheDocument()

    openSection("Chunks")
    // ⚠ A chunk with no recorded model must NOT borrow the current model's name.
    expect(await screen.findByText(/model not recorded/i)).toBeInTheDocument()
  })

  it("⛔ renders untrusted chunk text as literal text — no element is created from it", async () => {
    // T-217-37. A chunk is a slice of a file somebody uploaded; if any of it were
    // interpreted as markup, an uploaded document would be an XSS vector against the
    // person reading it.
    const payload = '<img src=x onerror=alert(1)>'
    listDocumentChunks.mockResolvedValue([chunk({ content: payload })])
    const { container } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The spec")).toBeInTheDocument()

    openSection("Chunks")
    expect(await screen.findByText(payload)).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
  })
})

describe("switching documents re-reads the OPEN section", () => {
  it("re-fetches for the new id and does not show the previous document's chunks", async () => {
    listDocumentChunks.mockResolvedValue([
      {
        id: "old-1",
        chunk_index: 0,
        content: "chunk from the FIRST document",
        embedding_model: "m1",
        embedding_dimensions: 1,
      },
    ])
    const { rerender } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The spec")).toBeInTheDocument()

    openSection("Chunks")
    expect(await screen.findByText(/FIRST document/)).toBeInTheDocument()
    expect(listDocumentChunks).toHaveBeenCalledTimes(1)

    listDocumentChunks.mockResolvedValue([
      {
        id: "new-1",
        chunk_index: 0,
        content: "chunk from the SECOND document",
        embedding_model: "m1",
        embedding_dimensions: 1,
      },
    ])
    rerender(
      <DocumentDetailPanel
        doc={makeDoc({ id: "doc-lazy-2", filename: "other.pdf", metadata: { title: "The other" } })}
        onClose={() => {}}
      />,
    )

    expect(await screen.findByText(/SECOND document/)).toBeInTheDocument()
    // ⚠ The stale row must be GONE, not merely outranked — a list that appended would
    // show one document's text under another document's name.
    expect(screen.queryByText(/FIRST document/)).not.toBeInTheDocument()
    expect(listDocumentChunks).toHaveBeenCalledTimes(2)
    expect(listDocumentChunks.mock.calls[1][0]).toBe("doc-lazy-2")
  })
})
