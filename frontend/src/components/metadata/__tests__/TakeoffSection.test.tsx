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
})
