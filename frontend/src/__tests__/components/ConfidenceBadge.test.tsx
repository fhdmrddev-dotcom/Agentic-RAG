import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ConfidenceBadge } from "@/components/chat/ConfidenceBadge"
import type { ConfidenceResult } from "@/types"

function makeConfidence(overrides: Partial<ConfidenceResult> = {}): ConfidenceResult {
  return {
    level: "high",
    avg_similarity: 0.85,
    disclaimer: null,
    ...overrides,
  }
}

describe("ConfidenceBadge", () => {
  it("renders 'High confidence' with green colour class", () => {
    const { container } = render(<ConfidenceBadge confidence={makeConfidence({ level: "high" })} />)
    expect(screen.getByText(/high confidence/i)).toBeInTheDocument()
    const badge = container.querySelector(".text-green-500")
    expect(badge).toBeInTheDocument()
  })

  it("renders 'Medium confidence' with amber colour class", () => {
    const { container } = render(<ConfidenceBadge confidence={makeConfidence({ level: "medium" })} />)
    expect(screen.getByText(/medium confidence/i)).toBeInTheDocument()
    const badge = container.querySelector(".text-amber-500")
    expect(badge).toBeInTheDocument()
  })

  it("renders 'Low confidence' with red colour class", () => {
    const { container } = render(<ConfidenceBadge confidence={makeConfidence({ level: "low" })} />)
    expect(screen.getByText(/low confidence/i)).toBeInTheDocument()
    const badge = container.querySelector(".text-red-500")
    expect(badge).toBeInTheDocument()
  })

  it("renders disclaimer text when present", () => {
    render(<ConfidenceBadge confidence={makeConfidence({ level: "low", disclaimer: "Please verify with source documents." })} />)
    expect(screen.getByText("Please verify with source documents.")).toBeInTheDocument()
  })

  it("does not render disclaimer when null", () => {
    render(<ConfidenceBadge confidence={makeConfidence({ disclaimer: null })} />)
    expect(screen.queryByText(/please verify/i)).not.toBeInTheDocument()
  })
})
