/**
 * Tests for DocumentStatusBadge component.
 *
 * Phase 154 Plan 02 (LANG-01 / Surface A): the badge now routes its DISPLAY label
 * through the term-map (`usePlainLabel`), so the DEFAULT (no provider / reveal OFF)
 * shows PLAIN copy ("Waiting"/"Working…"/"Ready"/"Couldn't process" and the plain
 * ingestion-step words), while the reveal ON (inside <TechnicalNamesProvider> with
 * localStorage "technical-names"="true") shows today's technical strings verbatim
 * ("pending"/"processing"/"completed"/"failed", "Chunking", "Embedding").
 *
 * The color classes + spinner are ENUM-keyed (`styles[status]`), NOT label-keyed —
 * they are byte-identical across both reveal states (D-05a / T-154-01).
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { DocumentStatusBadge } from "@/components/ingestion/DocumentStatusBadge"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"

describe("DocumentStatusBadge — plain default (reveal OFF)", () => {
  it("renders 'Waiting' plain label for pending status", () => {
    render(<DocumentStatusBadge status="pending" />)
    expect(screen.getByText("Waiting")).toBeInTheDocument()
  })

  it("applies yellow color classes for pending status", () => {
    const { container } = render(<DocumentStatusBadge status="pending" />)
    const badge = container.querySelector("span")
    expect(badge?.className).toContain("yellow")
  })

  it("renders 'Working…' plain label for processing status (no step)", () => {
    render(<DocumentStatusBadge status="processing" />)
    expect(screen.getByText("Working…")).toBeInTheDocument()
  })

  it("renders 'Splitting into sections' plain label for processing + chunking step", () => {
    render(<DocumentStatusBadge status="processing" ingestionStep="chunking" />)
    expect(screen.getByText("Splitting into sections")).toBeInTheDocument()
  })

  it("renders 'Making it searchable' plain label for processing + embedding step", () => {
    render(<DocumentStatusBadge status="processing" ingestionStep="embedding" />)
    expect(screen.getByText("Making it searchable")).toBeInTheDocument()
  })

  it("falls back to the 'Working…' plain label for an unknown processing step", () => {
    render(<DocumentStatusBadge status="processing" ingestionStep="totally-unknown" />)
    expect(screen.getByText("Working…")).toBeInTheDocument()
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

  it("renders 'Ready' plain label for completed status", () => {
    render(<DocumentStatusBadge status="completed" />)
    expect(screen.getByText("Ready")).toBeInTheDocument()
  })

  it("applies green color classes for completed status", () => {
    const { container } = render(<DocumentStatusBadge status="completed" />)
    const badge = container.querySelector("span")
    expect(badge?.className).toContain("green")
  })

  it("renders \"Couldn't process\" plain label for failed status", () => {
    render(<DocumentStatusBadge status="failed" />)
    expect(screen.getByText("Couldn't process")).toBeInTheDocument()
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

describe("DocumentStatusBadge — technical reveal ON (inside TechnicalNamesProvider)", () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  function renderRevealed(ui: React.ReactElement) {
    // The provider reads localStorage at mount (getInitial), so seed BEFORE render.
    window.localStorage.setItem("technical-names", "true")
    return render(<TechnicalNamesProvider>{ui}</TechnicalNamesProvider>)
  }

  it("reveals the raw enum 'pending' for pending status", () => {
    renderRevealed(<DocumentStatusBadge status="pending" />)
    expect(screen.getByText("pending")).toBeInTheDocument()
  })

  it("reveals the raw enum 'processing' for processing status (no step)", () => {
    renderRevealed(<DocumentStatusBadge status="processing" />)
    expect(screen.getByText("processing")).toBeInTheDocument()
  })

  it("reveals 'Chunking' for processing + chunking step", () => {
    renderRevealed(<DocumentStatusBadge status="processing" ingestionStep="chunking" />)
    expect(screen.getByText("Chunking")).toBeInTheDocument()
  })

  it("reveals 'Embedding' for processing + embedding step", () => {
    renderRevealed(<DocumentStatusBadge status="processing" ingestionStep="embedding" />)
    expect(screen.getByText("Embedding")).toBeInTheDocument()
  })

  it("reveals the raw enum 'completed' for completed status", () => {
    renderRevealed(<DocumentStatusBadge status="completed" />)
    expect(screen.getByText("completed")).toBeInTheDocument()
  })

  it("keeps color classes ENUM-keyed — byte-identical to the reveal-OFF render", () => {
    // Reveal OFF (bare) color class for `completed`.
    const off = render(<DocumentStatusBadge status="completed" />)
    const offClass = off.container.querySelector("span")?.className
    off.unmount()
    // Reveal ON color class for the SAME status.
    const on = renderRevealed(<DocumentStatusBadge status="completed" />)
    const onClass = on.container.querySelector("span")?.className
    // styles[status] uses the raw enum, never the displayed label → identical.
    expect(onClass).toBe(offClass)
    expect(onClass).toContain("green")
  })
})
