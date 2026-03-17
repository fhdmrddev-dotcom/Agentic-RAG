/**
 * Tests for DocumentStatusBadge component.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { DocumentStatusBadge } from "@/components/ingestion/DocumentStatusBadge"

describe("DocumentStatusBadge", () => {
  it("renders 'pending' text for pending status", () => {
    render(<DocumentStatusBadge status="pending" />)
    expect(screen.getByText("pending")).toBeInTheDocument()
  })

  it("applies yellow color classes for pending status", () => {
    const { container } = render(<DocumentStatusBadge status="pending" />)
    const badge = container.querySelector("span")
    expect(badge?.className).toContain("yellow")
  })

  it("renders 'processing' text for processing status", () => {
    render(<DocumentStatusBadge status="processing" />)
    expect(screen.getByText("processing")).toBeInTheDocument()
  })

  it("renders a spinner element for processing status", () => {
    const { container } = render(<DocumentStatusBadge status="processing" />)
    // The spinner is a nested span with animate-spin class
    const spinner = container.querySelector(".animate-spin")
    expect(spinner).toBeInTheDocument()
  })

  it("applies blue color classes for processing status", () => {
    const { container } = render(<DocumentStatusBadge status="processing" />)
    const badge = container.querySelector("span")
    expect(badge?.className).toContain("blue")
  })

  it("renders 'completed' text for completed status", () => {
    render(<DocumentStatusBadge status="completed" />)
    expect(screen.getByText("completed")).toBeInTheDocument()
  })

  it("applies green color classes for completed status", () => {
    const { container } = render(<DocumentStatusBadge status="completed" />)
    const badge = container.querySelector("span")
    expect(badge?.className).toContain("green")
  })

  it("renders 'failed' text for failed status", () => {
    render(<DocumentStatusBadge status="failed" />)
    expect(screen.getByText("failed")).toBeInTheDocument()
  })

  it("applies red color classes for failed status", () => {
    const { container } = render(<DocumentStatusBadge status="failed" />)
    const badge = container.querySelector("span")
    expect(badge?.className).toContain("red")
  })

  it("does not render a spinner for non-processing statuses", () => {
    const { container } = render(<DocumentStatusBadge status="completed" />)
    const spinner = container.querySelector(".animate-spin")
    expect(spinner).not.toBeInTheDocument()
  })
})
