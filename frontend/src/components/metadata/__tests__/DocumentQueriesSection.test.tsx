/** Phase 217.1-15 (Task 1) — DocumentQueriesSection RETRIEVAL summary tests. */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { DocumentQueriesSection } from "../DocumentQueriesSection"

const mockListQueries = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api", () => ({
  listDocumentQueries: mockListQueries,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  query_text: "test query",
  asked_at: new Date().toISOString(),
  via: null,
  similarity: 0.75,
  ...overrides,
})

describe("DocumentQueriesSection RETRIEVAL summary", () => {
  it("renders Times found with exact count below the cap", async () => {
    mockListQueries.mockResolvedValue([makeRow(), makeRow(), makeRow()])
    render(<DocumentQueriesSection docId="d-1" />)
    const times = await screen.findByText("3")
    expect(times).toBeTruthy()
  })

  it("renders Times found with 100+ at the cap", async () => {
    const rows = Array.from({ length: 100 }, (_, i) =>
      makeRow({ query_text: `q${i}`, asked_at: new Date(Date.now() - i * 60000).toISOString() }),
    )
    mockListQueries.mockResolvedValue(rows)
    render(<DocumentQueriesSection docId="d-1" />)
    const capped = await screen.findByText("100+")
    expect(capped).toBeTruthy()
  })

  it("renders Average relevance as a percentage over non-null similarities", async () => {
    mockListQueries.mockResolvedValue([
      makeRow({ similarity: 0.75 }),
      makeRow({ similarity: 0.85 }),
      makeRow({ similarity: null }),
    ])
    render(<DocumentQueriesSection docId="d-1" />)
    const avg = await screen.findByText("80%")
    expect(avg).toBeTruthy()
  })

  it("renders 'not recorded yet' when all similarities are null", async () => {
    mockListQueries.mockResolvedValue([
      makeRow({ similarity: null }),
      makeRow({ similarity: null }),
    ])
    render(<DocumentQueriesSection docId="d-1" />)
    const nr = await screen.findByText("not recorded yet")
    expect(nr).toBeTruthy()
  })

  it("renders Last question from the most recent row", async () => {
    const d1 = new Date(Date.now() - 60000).toISOString()
    const d2 = new Date(Date.now()).toISOString()
    mockListQueries.mockResolvedValue([
      makeRow({ query_text: "second question", asked_at: d2 }),
      makeRow({ query_text: "first question", asked_at: d1 }),
    ])
    render(<DocumentQueriesSection docId="d-1" />)
    // The RETRIEVAL summary shows the last question as a truncated span
    await screen.findByText("Times found")
    // Use getAllByText and assert at least one match
    const matches = screen.getAllByText(/second question/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it("renders Last found as a formatted date", async () => {
    const date = new Date("2026-08-15").toISOString()
    mockListQueries.mockResolvedValue([makeRow({ asked_at: date })])
    render(<DocumentQueriesSection docId="d-1" />)
    await screen.findByText("Times found")
    // The locale-dependent date format is rendered — just check something date-like
    const lf = screen.getAllByText(/2026/)
    expect(lf.length).toBeGreaterThanOrEqual(1)
  })

  it("renders all four RETRIEVAL labels", async () => {
    mockListQueries.mockResolvedValue([makeRow()])
    render(<DocumentQueriesSection docId="d-1" />)
    await screen.findByText("Times found")
    expect(screen.getByText("Last question")).toBeTruthy()
    expect(screen.getByText("Last found")).toBeTruthy()
    expect(screen.getByText("Average relevance")).toBeTruthy()
  })
})

describe("FoundPerWeekSparkline", () => {
  it("renders when data is available", async () => {
    mockListQueries.mockResolvedValue([
      makeRow({ asked_at: new Date(Date.now()).toISOString() }),
      makeRow({ asked_at: new Date(Date.now() - 3 * 86400000).toISOString() }),
    ])
    render(<DocumentQueriesSection docId="d-1" />)
    const sparkline = await screen.findByText(/FOUND PER WEEK/)
    expect(sparkline).toBeTruthy()
  })
})