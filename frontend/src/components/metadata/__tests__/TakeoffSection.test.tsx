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

vi.mock("@/lib/api", () => ({
  listDocuments: vi.fn(),
}))

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
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listDocuments).mockResolvedValue(mockRateDocs)
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
})
