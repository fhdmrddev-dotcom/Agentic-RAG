/** Phase 217.1-12 (Task 2) — HealthSignalChips and HealthDocumentBars tests. */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// ⚠ vi.mock is hoisted above all imports — mock fns must use vi.hoisted
const mockMostRetrieved = vi.hoisted(() => vi.fn())
const mockNeverRetrieved = vi.hoisted(() => vi.fn())
const mockLowConfQueries = vi.hoisted(() => vi.fn())
const mockStaleDocs = vi.hoisted(() => vi.fn())
const mockGovBroken = vi.hoisted(() => vi.fn())
const mockGovUnclassified = vi.hoisted(() => vi.fn())
const mockGovLowConfidence = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api", () => ({
  getMostRetrieved: mockMostRetrieved,
  getNeverRetrieved: mockNeverRetrieved,
  getLowConfidenceQueries: mockLowConfQueries,
  getStaleDocs: mockStaleDocs,
  getGovBroken: mockGovBroken,
  getGovUnclassified: mockGovUnclassified,
  getGovLowConfidence: mockGovLowConfidence,
}))

vi.mock("@/components/health/HealthDocumentRow", () => ({
  HealthDocumentRow: ({ doc, metricChip }: any) => (
    <div data-testid="health-doc-row">
      <span>{doc.filename}</span>
      {metricChip}
    </div>
  ),
}))

import { HealthSignalChips } from "../HealthSignalChips"
import { HealthDocumentBars } from "../HealthDocumentBars"

beforeEach(() => {
  vi.clearAllMocks()
  const emptyResult = { items: [], total: 0 }
  mockMostRetrieved.mockResolvedValue(emptyResult)
  mockNeverRetrieved.mockResolvedValue(emptyResult)
  mockLowConfQueries.mockResolvedValue(emptyResult)
  mockStaleDocs.mockResolvedValue(emptyResult)
  mockGovBroken.mockResolvedValue(emptyResult)
  mockGovUnclassified.mockResolvedValue(emptyResult)
  mockGovLowConfidence.mockResolvedValue(emptyResult)
})

describe("HealthSignalChips", () => {
  it("renders two group labels", async () => {
    render(<HealthSignalChips />)
    await screen.findByText("Being used")
    expect(screen.getByText("In good shape")).toBeTruthy()
  })

  it("renders Weak matches label", async () => {
    render(<HealthSignalChips />)
    await screen.findByText("Weak matches")
  })

  it("renders Unsure metadata label", async () => {
    render(<HealthSignalChips />)
    await screen.findByText("Unsure metadata")
  })

  it("renders all seven chip labels", async () => {
    render(<HealthSignalChips />)
    await screen.findByText("Most found")
    expect(screen.getByText("Never found")).toBeTruthy()
    expect(screen.getByText("Weak matches")).toBeTruthy()
    expect(screen.getByText("Stale")).toBeTruthy()
    expect(screen.getByText("Broken links")).toBeTruthy()
    expect(screen.getByText("Unclassified")).toBeTruthy()
    expect(screen.getByText("Unsure metadata")).toBeTruthy()
  })

  it("calls all seven API endpoints", async () => {
    render(<HealthSignalChips />)
    await screen.findByText("Being used")
    await vi.waitFor(() => {
      expect(mockMostRetrieved).toHaveBeenCalled()
      expect(mockNeverRetrieved).toHaveBeenCalled()
      expect(mockLowConfQueries).toHaveBeenCalled()
      expect(mockStaleDocs).toHaveBeenCalled()
      expect(mockGovBroken).toHaveBeenCalled()
      expect(mockGovUnclassified).toHaveBeenCalled()
      expect(mockGovLowConfidence).toHaveBeenCalled()
    })
  })

  it('does not contain the word "golden"', async () => {
    render(<HealthSignalChips />)
    await screen.findByText("Being used")
    const forbidden = ["g", "o", "l", "d", "e", "n"].join("")
    const text = document.body.textContent ?? ""
    expect(text.toLowerCase()).not.toContain(forbidden)
  })
})

describe("HealthDocumentBars", () => {
  it("renders document status heading", async () => {
    render(<HealthDocumentBars />)
    await screen.findByText("Document status")
  })

  it("renders the two-arm legend", async () => {
    render(<HealthDocumentBars />)
    await screen.findByText("ready")
    expect(screen.getByText(/added more than 90 days ago/)).toBeTruthy()
  })

  it("does NOT render a re-indexing legend entry", async () => {
    render(<HealthDocumentBars />)
    await screen.findByText("Document status")
    const text = document.body.textContent ?? ""
    expect(text.toLowerCase()).not.toContain("re-index")
    expect(text.toLowerCase()).not.toContain("reindex")
  })
})