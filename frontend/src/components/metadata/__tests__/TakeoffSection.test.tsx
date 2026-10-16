import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { TakeoffSection } from "../TakeoffSection"
import * as takeoffApi from "@/lib/api/takeoff"
import * as api from "@/lib/api"
import type { Document } from "@/types"

vi.mock("@/lib/api/takeoff", () => ({
  fetchDocumentTakeoff: vi.fn(),
  matchDocumentTakeoff: vi.fn(),
  resolveDocumentTakeoffItem: vi.fn(),
}))

// 284-04 (D-15 R-05 exception / UI-SPEC S14): the rate-sheet list is ONE bounded server page of
// spreadsheets — never the whole library filtered in the browser. 284-05 (D-16): the whole-list
// client no longer exists, so a regression back to it fails to compile and fails
// `libraryListFence.test.ts`; this suite pins that every read it makes is a bounded page.
vi.mock("@/lib/api", () => ({
  listDocumentsPage: vi.fn(),
  // 284-REVIEW WR-04: the saved rate sheet is read by id when it is not on the page.
  getDocument: vi.fn(),
}))

function page(documents: Document[], total = documents.length) {
  return { documents, total, offset: 0, limit: 50 }
}

describe("TakeoffSection Component (Phase 220, TAKEOFF-04)", () => {
  const mockDoc: Document = {
    id: "doc-cad-1",
    user_id: "user-1",
    filename: "structural_drawing.dxf",
    file_path: "user-1/doc-cad-1/structural_drawing.dxf",
    file_size: 1024,
    mime_type: "application/dxf",
    status: "completed",
    chunk_count: 10,
    created_at: "2026-08-30T10:00:00Z",
    updated_at: "2026-08-30T10:00:00Z",
    is_latest: true,
    version_number: 1,
    folder_id: null,
    error_message: null,
    content_hash: null,
    metadata: {
      _takeoff: {
        units: "mm",
        insunits_code: 4,
        refused: false,
        blocks: { W250x33: 5, C250x23: 3 },
        specs: ['1/2" GYPSUM BOARD'],
        boq: {
          totals: {
            total_estimated_cost: 12450.5,
            counted_items_cost: 12450.5,
            total_items: 3,
            matched_count: 2,
            ambiguous_count: 1,
            unpriced_count: 0,
          },
          refused: false,
          refusal_reason: null,
          units: "mm",
          items: [
            {
              item_key: "block:W250x33",
              category: "block",
              source_text: "W250x33",
              quantity: 5,
              unit: "m",
              rate_code: "ST-W250",
              description: "Wide flange steel beam W250x33",
              rate: 120.0,
              amount: 600.0,
              basis: "read",
              status: "matched",
              candidates: [],
            },
            {
              item_key: "spec:0",
              category: "spec",
              source_text: '1/2" GYPSUM BOARD',
              quantity: 1,
              unit: "m2",
              rate_code: null,
              description: '1/2" GYPSUM BOARD',
              rate: null,
              amount: null,
              basis: "ambiguous",
              status: "ambiguous",
              candidates: [
                { code: "CL-GYP", desc: "Suspended gypsum ceiling", unit: "m2", rate: 31.0 },
                { code: "GB-12", desc: "Gypsum board, taped", unit: "m2", rate: 18.75 },
              ],
            },
          ],
        },
      },
    },
  }

  const mockRateDocs: Document[] = [
    {
      id: "rates-1",
      user_id: "user-1",
      filename: "Master_Rate_Sheet.xlsx",
      file_path: "user-1/rates-1/Master_Rate_Sheet.xlsx",
      file_size: 2048,
      mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      status: "completed",
      chunk_count: 5,
      created_at: "2026-08-30T10:00:00Z",
      updated_at: "2026-08-30T10:00:00Z",
      is_latest: true,
      version_number: 1,
      folder_id: null,
      error_message: null,
      content_hash: null,
      metadata: {},
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listDocumentsPage).mockResolvedValue(page(mockRateDocs))
    vi.mocked(takeoffApi.fetchDocumentTakeoff).mockResolvedValue(mockDoc.metadata?._takeoff as any)
  })

  it("renders summary KPI cards with total cost, ambiguity count, and units", async () => {
    render(<TakeoffSection doc={mockDoc} />)

    expect(screen.getByText("$12,450.50")).toBeInTheDocument()
    expect(screen.getByText("1 need review")).toBeInTheDocument()
    expect(screen.getByText("mm")).toBeInTheDocument()
    expect(screen.getByText("W250x33")).toBeInTheDocument()
    expect(screen.getByText("READ (EXACT)")).toBeInTheDocument()
    expect(screen.getByText("NEEDS REVIEW")).toBeInTheDocument()
  })

  it("renders candidate dropdown for ambiguous item and resolves selection", async () => {
    const mockResolve = vi.mocked(takeoffApi.resolveDocumentTakeoffItem)
    mockResolve.mockResolvedValue({
      totals: {
        total_estimated_cost: 12469.25,
        counted_items_cost: 12450.5,
        total_items: 2,
        matched_count: 2,
        ambiguous_count: 0,
        unpriced_count: 0,
      },
      refused: false,
      refusal_reason: null,
      units: "mm",
      items: [
        {
          item_key: "spec:0",
          category: "spec",
          source_text: '1/2" GYPSUM BOARD',
          quantity: 1,
          unit: "m2",
          rate_code: "GB-12",
          description: "Gypsum board, taped",
          rate: 18.75,
          amount: 18.75,
          basis: "matched",
          status: "matched",
          candidates: [],
        },
      ],
    })

    render(<TakeoffSection doc={mockDoc} />)

    const select = screen.getByLabelText(/Resolve candidate for 1\/2" GYPSUM BOARD/i)
    expect(select).toBeInTheDocument()

    fireEvent.change(select, { target: { value: "GB-12" } })

    await waitFor(() => {
      expect(mockResolve).toHaveBeenCalledWith("doc-cad-1", "spec:0", "GB-12")
    })
  })

  it("displays unitless refusal warning when INSUNITS=0", async () => {
    const refusedDoc: Document = {
      ...mockDoc,
      metadata: {
        _takeoff: {
          units: "unitless",
          insunits_code: 0,
          refused: true,
          blocks: {},
          refusal_reason: "Refusing to convert lengths: this drawing declares NO units ($INSUNITS=0).",
        },
      },
    }
    vi.mocked(takeoffApi.fetchDocumentTakeoff).mockResolvedValue(refusedDoc.metadata?._takeoff as any)

    render(<TakeoffSection doc={refusedDoc} />)

    expect(await screen.findByText((content) => content.includes("Drawing Declares No Units"))).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes("Refusing to convert lengths"))).toBeInTheDocument()
  })

  // ── 284-04 (UI-SPEC S14): the five arms of the rate-sheet select ─────────────────────────
  const sheet = (i: number): Document => ({ ...mockRateDocs[0], id: `rates-${i}`, filename: `Rates ${i}.xlsx` })
  const rateSelect = () => screen.getByLabelText("Select reference rate sheet") as HTMLSelectElement

  it("reads ONE bounded spreadsheet page — never the whole library", async () => {
    render(<TakeoffSection doc={mockDoc} />)
    await waitFor(() => expect(api.listDocumentsPage).toHaveBeenCalledTimes(1))
    expect(api.listDocumentsPage).toHaveBeenCalledWith({ kind: "spreadsheet", offset: 0, limit: 50 })
    for (const [params] of vi.mocked(api.listDocumentsPage).mock.calls) {
      expect(params.limit).toBeLessThanOrEqual(50)
    }
  })

  it("while loading the select is disabled and reads 'Loading rate sheets…'", () => {
    vi.mocked(api.listDocumentsPage).mockReturnValue(new Promise(() => {}))
    render(<TakeoffSection doc={mockDoc} />)
    expect(rateSelect()).toBeDisabled()
    expect(rateSelect()).toHaveTextContent("Loading rate sheets…")
    expect(screen.queryByText("No Excel rate sheets found in Library")).toBeNull()
  })

  it("an answered empty page reads the shipped 'No Excel rate sheets found in Library'", async () => {
    vi.mocked(api.listDocumentsPage).mockResolvedValue(page([]))
    render(<TakeoffSection doc={mockDoc} />)
    expect(await screen.findByText("No Excel rate sheets found in Library")).toBeInTheDocument()
    expect(rateSelect()).toBeDisabled()
  })

  it("loaded: options in server order, the first auto-selected; more than 50 says how many exist", async () => {
    vi.mocked(api.listDocumentsPage).mockResolvedValue(page([sheet(1), sheet(2)], 73))
    render(<TakeoffSection doc={mockDoc} />)
    await screen.findByRole("option", { name: "Rates 1.xlsx" })
    expect(Array.from(rateSelect().options).map((o) => o.textContent)).toEqual(["Rates 1.xlsx", "Rates 2.xlsx"])
    expect(rateSelect()).toHaveValue("rates-1")
    expect(screen.getByText("Showing the 50 most recent of 73 spreadsheets.")).toBeInTheDocument()
  })

  it("a failed read is disabled with 'Couldn’t load rate sheets' and a Try again that reads again", async () => {
    vi.mocked(api.listDocumentsPage).mockRejectedValueOnce(new Error("down"))
    render(<TakeoffSection doc={mockDoc} />)
    expect(await screen.findByRole("option", { name: "Couldn’t load rate sheets" })).toBeInTheDocument()
    expect(rateSelect()).toBeDisabled()
    expect(screen.queryByText("No Excel rate sheets found in Library")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("option", { name: "Master_Rate_Sheet.xlsx" })).toBeInTheDocument()
    expect(api.listDocumentsPage).toHaveBeenCalledTimes(2)
  })

  // ── 284-REVIEW WR-04: the SAVED rate sheet is always shown, and Match only ever uses what the
  // select shows. The page is the 50 newest non-archived spreadsheets; the sheet a takeoff was
  // matched against can be older, or archived — before this, the select matched no option (blank
  // in Chrome, the first option elsewhere) while Match still sent the hidden saved id. ──
  const savedTakeoffDoc = (savedId: string): Document => ({
    ...mockDoc,
    metadata: {
      _takeoff: { ...(mockDoc.metadata?._takeoff as object), rate_sheet_document_id: savedId },
    },
  })

  it("a saved sheet outside the page is read by id, shown first and selected — and Match uses it", async () => {
    vi.mocked(api.listDocumentsPage).mockResolvedValue(page([sheet(1), sheet(2)], 73))
    vi.mocked(api.getDocument).mockResolvedValue({ ...mockRateDocs[0], id: "saved-old", filename: "Rates 2019.xlsx" })
    vi.mocked(takeoffApi.matchDocumentTakeoff).mockResolvedValue(
      (mockDoc.metadata?._takeoff as { boq: never }).boq,
    )
    render(<TakeoffSection doc={savedTakeoffDoc("saved-old")} />)
    await screen.findByRole("option", { name: "Rates 2019.xlsx" })
    expect(api.getDocument).toHaveBeenCalledWith("saved-old")
    expect(Array.from(rateSelect().options).map((o) => o.textContent)).toEqual([
      "Rates 2019.xlsx",
      "Rates 1.xlsx",
      "Rates 2.xlsx",
    ])
    expect(rateSelect()).toHaveValue("saved-old")
    fireEvent.click(screen.getByRole("button", { name: /Re-Match/ }))
    await waitFor(() => expect(takeoffApi.matchDocumentTakeoff).toHaveBeenCalledWith("doc-cad-1", "saved-old"))
  })

  it("an archived saved sheet says so in its option", async () => {
    vi.mocked(api.getDocument).mockResolvedValue({
      ...mockRateDocs[0],
      id: "saved-arch",
      filename: "Old Rates.xlsx",
      archived_at: "2026-09-01T00:00:00Z",
    })
    render(<TakeoffSection doc={savedTakeoffDoc("saved-arch")} />)
    expect(await screen.findByRole("option", { name: "Old Rates.xlsx (archived)" })).toBeInTheDocument()
    expect(rateSelect()).toHaveValue("saved-arch")
  })

  it("a saved sheet that is gone (404) says so, and the select and Match move to a shown sheet", async () => {
    const { DocumentListError } = await vi.importActual<typeof import("@/lib/api/documents")>("@/lib/api/documents")
    vi.mocked(api.getDocument).mockRejectedValue(new DocumentListError(404, "Couldn't load this document."))
    vi.mocked(takeoffApi.matchDocumentTakeoff).mockResolvedValue(
      (mockDoc.metadata?._takeoff as { boq: never }).boq,
    )
    render(<TakeoffSection doc={savedTakeoffDoc("deleted-sheet")} />)
    expect(await screen.findByText("The saved rate sheet is no longer available.")).toBeInTheDocument()
    expect(rateSelect()).toHaveValue("rates-1")
    fireEvent.click(screen.getByRole("button", { name: /Re-Match/ }))
    await waitFor(() => expect(takeoffApi.matchDocumentTakeoff).toHaveBeenCalledWith("doc-cad-1", "rates-1"))
  })

  it("a saved sheet ON the page costs no extra read", async () => {
    render(<TakeoffSection doc={savedTakeoffDoc("rates-1")} />)
    await screen.findByRole("option", { name: "Master_Rate_Sheet.xlsx" })
    expect(rateSelect()).toHaveValue("rates-1")
    expect(api.getDocument).not.toHaveBeenCalled()
  })

  it("Match is disabled while the select cannot show the sheet it would use", () => {
    vi.mocked(api.listDocumentsPage).mockReturnValue(new Promise(() => {}))
    render(<TakeoffSection doc={savedTakeoffDoc("saved-old")} />)
    expect(rateSelect()).toHaveTextContent("Loading rate sheets…")
    expect(screen.getByRole("button", { name: /Re-Match/ })).toBeDisabled()
  })
})
