/**
 * Phase 217 Plan 11 Task 3 (LIB-04 / D-217-01 / D-217-06 / T-217-42 / T-217-43 / T-217-45)
 * — the extracted tables render AS TABLES, hostile cell content is inert, and an EMPTY
 * result on a shared-folder document is pinned as CORRECT rather than left to be filed
 * as a defect by the next reader.
 *
 * ⚠ WHAT JSDOM CANNOT PROVE, SAID OUT LOUD. `getBoundingClientRect` is always zero in
 * jsdom and no stylesheet is applied, so NOTHING in this repo can assert that a wide
 * table is visually scrollable inside the 430px panel track. Case 1 therefore asserts the
 * CONTAINER CLASS (`overflow-x-auto`) — the mechanism — and never a computed width. The
 * lived property belongs to G-4 row **G4-5** (read a real extracted table in the real
 * panel), which stays OWED and is the only thing that proves the scroll.
 *
 * ⚠ `@/lib/api` is mocked at THE BARREL PATH, which is what the sections import. Mocking
 * `@/lib/api/documents` would leave the real barrel in place, the components would resolve
 * the real functions through it, and every mock here would be unreachable while the suite
 * still went green (the 217-10 finding, reused rather than rediscovered).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react"
import type {
  Document,
  DocumentImageRow,
  DocumentQueryRow,
  DocumentTableRow,
  MetadataFieldDef,
} from "@/types"

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
const listRelationships = vi.fn()
const listDocuments = vi.fn()
const getDocumentContent = vi.fn()
const listDocumentChunks = vi.fn()
const listDocumentTables = vi.fn<(id: string) => Promise<DocumentTableRow[]>>()
const listDocumentImages = vi.fn<(id: string) => Promise<DocumentImageRow[]>>()
const listDocumentQueries = vi.fn<(id: string) => Promise<DocumentQueryRow[]>>()

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listMetadataFields: (...a: unknown[]) => listMetadataFields(...(a as [])),
    listRelationships: (...a: unknown[]) => listRelationships(...(a as [])),
    listDocuments: (...a: unknown[]) => listDocuments(...(a as [])),
    getDocumentContent: (...a: unknown[]) => getDocumentContent(...(a as [])),
    listDocumentChunks: (...a: unknown[]) => listDocumentChunks(...(a as [])),
    listDocumentTables: (...a: unknown[]) => listDocumentTables(...(a as [string])),
    listDocumentImages: (...a: unknown[]) => listDocumentImages(...(a as [string])),
    listDocumentQueries: (...a: unknown[]) => listDocumentQueries(...(a as [string])),
  }
})

import { DocumentDetailPanel } from "../DocumentDetailPanel"

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc-tbl-1",
    user_id: "user-1",
    folder_id: null,
    filename: "quarterly.pdf",
    file_path: "u/doc-tbl-1/quarterly.pdf",
    file_size: 8192,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 5,
    content_hash: "hash-t",
    extractor: "docling",
    metadata: { title: "The quarterly" },
    created_at: "2026-08-29T00:00:00Z",
    updated_at: "2026-08-29T00:00:00Z",
    ...overrides,
  }
}

function table(over: Partial<DocumentTableRow> = {}): DocumentTableRow {
  return {
    id: "t1",
    page: 2,
    table_index: 0,
    headers: ["Region", "Q4"],
    rows: [
      ["EMEA", "1,204"],
      ["APAC", "980"],
    ],
    extractor: "docling",
    ...over,
  }
}

function openSection(title: string) {
  const head = screen
    .getAllByRole("button")
    .find((b) => b.hasAttribute("aria-expanded") && (b.textContent ?? "").startsWith(title))
  if (!head) throw new Error(`no PanelSection head titled "${title}"`)
  fireEvent.click(head)
  return head
}

function sectionTitlesInDomOrder(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("button[aria-expanded]"))
    .map((b) => (b.textContent ?? "").replace(/\d+(\/\d+)?$/, "").trim())
    .filter(Boolean)
}

beforeEach(() => {
  listMetadataFields.mockResolvedValue([])
  listRelationships.mockResolvedValue({
    subject: { document_id: "doc-tbl-1", filename: "quarterly.pdf" },
    total: 0,
    documents: [],
  })
  listDocuments.mockResolvedValue([])
  getDocumentContent.mockResolvedValue({
    document_id: "doc-tbl-1",
    filename: "quarterly.pdf",
    total_lines: 0,
    content: "",
    start_line: null,
    end_line: null,
    has_more: false,
  })
  listDocumentChunks.mockResolvedValue([])
  listDocumentTables.mockResolvedValue([])
  listDocumentImages.mockResolvedValue([])
  listDocumentQueries.mockResolvedValue([])
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

describe("Tables section — the extracted tables render AS TABLES", () => {
  it("renders a real <table> with one <th> per header and one <td> per cell, inside the scroll container", async () => {
    listDocumentTables.mockResolvedValue([table()])
    const { container } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()

    openSection("Tables")
    expect(await screen.findByText("EMEA")).toBeInTheDocument()

    const el = container.querySelector("table")
    expect(el).not.toBeNull()
    expect(within(el as HTMLElement).getAllByRole("columnheader")).toHaveLength(2)
    expect(el?.querySelectorAll("td")).toHaveLength(4)

    // ⚠ THE MECHANISM, NOT THE APPEARANCE. jsdom applies no stylesheet and every
    // getBoundingClientRect is zero, so "it scrolls sideways" is unprovable here. The
    // container class is what makes it scroll; G-4 row G4-5 is what proves it does.
    expect(el?.closest(".overflow-x-auto")).not.toBeNull()
  })

  it("⛔ shows no column-shedding rule — every column of the user's own table is rendered", async () => {
    // The Library's document list sheds columns positionally at narrow widths and is right
    // to; those columns are redundant metadata. These columns ARE the data.
    listDocumentTables.mockResolvedValue([
      table({
        headers: ["A", "B", "C", "D", "E", "F", "G"],
        rows: [["1", "2", "3", "4", "5", "6", "7"]],
      }),
    ])
    const { container } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()

    openSection("Tables")
    expect(await screen.findByText("G")).toBeInTheDocument()
    expect(container.querySelectorAll("th")).toHaveLength(7)
    expect(container.querySelectorAll("td")).toHaveLength(7)
  })

  it("⛔ renders a hostile cell as literal text — no element is created from it (T-217-42)", async () => {
    const payload = "<img src=x onerror=alert(1)>"
    listDocumentTables.mockResolvedValue([
      table({ headers: ["Note"], rows: [[payload]] }),
    ])
    const { container } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()

    openSection("Tables")
    expect(await screen.findByText(payload)).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
  })

  it("caps an oversized table BEFORE building the DOM and says so (T-217-43)", async () => {
    // 2001 rows > MAX_ROWS. If the cap were applied by rendering-then-truncating, this
    // assertion would still pass — so the row count is checked too.
    const rows = Array.from({ length: 2001 }, (_, i) => [String(i)])
    listDocumentTables.mockResolvedValue([table({ headers: ["n"], rows })])
    const { container } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()

    openSection("Tables")
    expect(await screen.findByText(/too large to preview/i)).toBeInTheDocument()
    expect(container.querySelectorAll("tr")).toHaveLength(0)
  })

  it("⭐ an EMPTY list on a document shared through someone else's folder is CORRECT, not a failure", async () => {
    // Migration 110:215-223 widened `document_chunks` SELECT to owner-OR-globally-visible-
    // folder; migration 108:180-189 left `document_tables` / `document_images` OWNER-ONLY.
    // So a document reached through another user's shared folder returns text and chunks
    // and an EMPTY table list. That is the policy working, and `list_documents` computes
    // `table_count` through the SAME user-JWT client, so the row's badge already reads 0.
    // The copy must therefore be the calm empty sentence and must NOT imply a permission
    // problem. This case exists so a future reader does not file it as a defect.
    listDocumentTables.mockResolvedValue([])
    render(
      <DocumentDetailPanel
        doc={makeDoc({ table_count: 0, tables_stage_applies: undefined })}
        onClose={() => {}}
      />,
    )
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()

    openSection("Tables")
    expect(await screen.findByText("No tables")).toBeInTheDocument()
    expect(screen.queryByText(/cannot see|permission|denied|not allowed/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("⭐ three empty situations read as three DIFFERENT claims (T-217-45 / M-5)", async () => {
    const seen: string[] = []

    // 1. the stage does not apply to this file type at all
    render(
      <DocumentDetailPanel
        doc={makeDoc({ tables_stage_applies: false, table_count: 0 })}
        onClose={() => {}}
      />,
    )
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()
    openSection("Tables")
    seen.push((await screen.findByText(/no tables/i)).textContent ?? "")
    cleanup()

    // 2. the stage ran and produced nothing
    render(
      <DocumentDetailPanel
        doc={makeDoc({ tables_stage_applies: true, table_count: 0 })}
        onClose={() => {}}
      />,
    )
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()
    openSection("Tables")
    seen.push((await screen.findByText(/no tables/i)).textContent ?? "")
    cleanup()

    // 3. the flag is ABSENT — unknown, and unknown gets the plain sentence
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()
    openSection("Tables")
    seen.push((await screen.findByText(/no tables/i)).textContent ?? "")

    expect(new Set(seen).size).toBe(3)
    expect(seen).toContain("This file type has no tables")
    expect(seen).toContain("No tables were extracted")
    expect(seen).toContain("No tables")
  })
})

describe("Images section — descriptions, and nothing that implies a picture", () => {
  it("renders each description with its figure and page", async () => {
    listDocumentImages.mockResolvedValue([
      { id: "i1", page: 2, image_index: 0, description: "A system diagram of the retrieval path." },
      { id: "i2", page: 7, image_index: 1, description: "A bar chart of six weeks of results." },
    ])
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()

    openSection("Images")
    expect(await screen.findByText(/system diagram of the retrieval path/)).toBeInTheDocument()
    expect(screen.getByText(/bar chart of six weeks/)).toBeInTheDocument()
    expect(screen.getByText(/figure 1/i)).toBeInTheDocument()
  })

  it("⛔ draws NO picture element — `document_images` stores no bytes, so there is nothing to draw", async () => {
    listDocumentImages.mockResolvedValue([
      { id: "i1", page: 1, image_index: 0, description: "A photograph of a whiteboard." },
      { id: "i2", page: 1, image_index: 1, description: "A screenshot of the settings page." },
    ])
    const { container } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()

    openSection("Images")
    // Non-vacuity: the descriptions ARE on screen, so the zero below is about the absence
    // of a picture rather than about the section having failed to render.
    expect(await screen.findByText(/photograph of a whiteboard/)).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("picture")).toBeNull()
    expect(container.querySelector("canvas")).toBeNull()
  })

  it("renders a hostile description as literal text (T-217-46 — model-authored text is still untrusted)", async () => {
    const payload = "<img src=x onerror=alert(2)>"
    listDocumentImages.mockResolvedValue([{ id: "i1", page: 1, image_index: 0, description: payload }])
    const { container } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()

    openSection("Images")
    expect(await screen.findByText(payload)).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
  })
})

describe("Found by — the questions, and the search that had no question", () => {
  it("lists the questions, counts repeats, and labels the 30-day window", async () => {
    listDocumentQueries.mockResolvedValue([
      { query_text: "What are the Q4 benchmarks?", asked_at: "2026-08-28T10:00:00Z", via: null },
      { query_text: "What are the Q4 benchmarks?", asked_at: "2026-08-27T10:00:00Z", via: null },
      { query_text: "chunk overlap rationale", asked_at: "2026-08-26T10:00:00Z", via: null },
    ])
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()

    openSection("Found by")
    expect(await screen.findByText(/What are the Q4 benchmarks\?/)).toBeInTheDocument()
    expect(screen.getByText(/chunk overlap rationale/)).toBeInTheDocument()
    // A list without frequency decides nothing: two identical rows collapse to one 2x.
    expect(screen.getByText(/2×/)).toBeInTheDocument()
    expect(screen.getByText(/3 searches in the last 30 days/i)).toBeInTheDocument()
  })

  it("⛔ a row with NO recorded question renders a worded alternative, and the absent-value word appears nowhere", async () => {
    listDocumentQueries.mockResolvedValue([
      { query_text: null, asked_at: "2026-08-28T10:00:00Z", via: "view" },
    ])
    const { container } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()

    openSection("Found by")
    expect(await screen.findByText("A saved view returned it")).toBeInTheDocument()
    // ⚠ The forbidden token is BUILT rather than written, so this assertion cannot be
    // satisfied by the literal appearing in this file's own source.
    const absentWord = ["un", "defined"].join("")
    expect(container.textContent ?? "").not.toContain(absentWord)
  })

  it("says so calmly when no search has returned this document", async () => {
    listDocumentQueries.mockResolvedValue([])
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()

    openSection("Found by")
    expect(await screen.findByText(/no searches have returned this document/i)).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})

describe("the panel's eight sections, in the D-217-25a order", () => {
  it("⭐ reads the FULL order from the rendered DOM, not from source order", async () => {
    // ⚠ Read from the DOM: a source grep would pass on a build that declared the sections
    // in order and rendered them somewhere else. Driven RED against a build that appends
    // the three new sections after Classification — see the plan's non-vacuity clause.
    const { container } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()

    expect(sectionTitlesInDomOrder(container)).toEqual([
      "Details",
      "Text",
      "Chunks",
      "Tables",
      "Images",
      "Found by",
      "Relationships",
      "Classification",
    ])
  })

  it("⛔ never says Queries or Retrieval — one concept, one word (D-217-25b)", async () => {
    const { container } = render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()

    const titles = sectionTitlesInDomOrder(container)
    expect(titles).toContain("Found by")
    expect(titles).not.toContain("Queries")
    expect(titles).not.toContain("Retrieval")
    expect(titles.filter((t) => t === "Details")).toHaveLength(1)
  })

  it("costs ZERO tables/images/queries requests until each accordion is clicked", async () => {
    render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)
    expect(await screen.findByText("The quarterly")).toBeInTheDocument()
    // Non-vacuity: the panel is UP and doing its normal work.
    expect(listMetadataFields).toHaveBeenCalled()

    expect(listDocumentTables).toHaveBeenCalledTimes(0)
    expect(listDocumentImages).toHaveBeenCalledTimes(0)
    expect(listDocumentQueries).toHaveBeenCalledTimes(0)

    openSection("Tables")
    await screen.findByText("No tables")
    expect(listDocumentTables).toHaveBeenCalledTimes(1)
    expect(listDocumentTables.mock.calls[0][0]).toBe("doc-tbl-1")
    // Opening one must not drag its neighbours along.
    expect(listDocumentImages).toHaveBeenCalledTimes(0)
    expect(listDocumentQueries).toHaveBeenCalledTimes(0)
  })
})
