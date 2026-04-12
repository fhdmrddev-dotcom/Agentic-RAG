import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CitationCard } from "@/components/chat/CitationCard"
import type { Citation } from "@/types"

function makeCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    document_id: "doc-1",
    filename: "report.pdf",
    chunk_index: 2,
    passage: "This is a sample passage that contains relevant information extracted from the source document for citation purposes.",
    similarity: 0.85,
    is_full_doc: false,
    ...overrides,
  }
}

describe("CitationCard", () => {
  it("renders the filename", () => {
    render(<CitationCard citation={makeCitation()} />)
    expect(screen.getByText("report.pdf")).toBeInTheDocument()
  })

  it("renders chunk label as 1-based index", () => {
    render(<CitationCard citation={makeCitation({ chunk_index: 2 })} />)
    expect(screen.getByText("Chunk 3")).toBeInTheDocument()
  })

  it("renders 'Full document' label when is_full_doc is true", () => {
    render(<CitationCard citation={makeCitation({ is_full_doc: true, chunk_index: null, passage: null })} />)
    expect(screen.getByText("Full document")).toBeInTheDocument()
  })

  it("truncates passage by default (line-clamp applied)", () => {
    const { container } = render(<CitationCard citation={makeCitation()} />)
    const passage = container.querySelector(".line-clamp-2")
    expect(passage).toBeInTheDocument()
  })

  it("has an expand toggle button", () => {
    render(<CitationCard citation={makeCitation()} />)
    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument()
  })

  it("removes line-clamp after clicking expand toggle", async () => {
    const user = userEvent.setup()
    const { container } = render(<CitationCard citation={makeCitation()} />)
    await user.click(screen.getByRole("button", { name: /show more/i }))
    const passage = container.querySelector(".line-clamp-2")
    expect(passage).not.toBeInTheDocument()
  })

  it("does not render passage or toggle when passage is null", () => {
    render(<CitationCard citation={makeCitation({ passage: null })} />)
    expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument()
  })
})
