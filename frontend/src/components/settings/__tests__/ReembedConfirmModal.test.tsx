import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ReembedConfirmModal } from "../ReembedConfirmModal"

/**
 * The gate must tell the two cases APART, because they are different acts:
 *
 *   model-only change -> reembed_service walks stale chunks and overwrites them one
 *                        batch at a time. Old vectors survive until replaced. The
 *                        "non-destructive" reassurance is TRUE.
 *
 *   DIMENSIONS change -> the job's first act is resize_embedding_column(new_dim), an
 *                        `ALTER … TYPE vector(n) USING NULL` that destroys every vector
 *                        in document_chunks (and, from mig 167, skill_embeddings) BEFORE
 *                        the loop runs. Search returns nothing until the job finishes.
 *
 * Until 2026-09-05 the modal rendered the non-destructive copy for BOTH, so the
 * reassurance was strongest exactly where the danger was. These cases pin the fix, and
 * each was driven RED against the pre-fix component before being committed green.
 */

const base = {
  open: true,
  chunkCount: 6017,
  targetModel: "text-embedding-qwen3-embedding-0.6b",
  targetDims: 1024,
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
}

describe("ReembedConfirmModal — model-only change", () => {
  it("keeps the non-destructive promise, and never claims deletion", () => {
    render(<ReembedConfirmModal {...base} dimsChanged={false} />)

    expect(screen.getByText(/Resumable & non-destructive/i)).toBeInTheDocument()
    expect(screen.getByText(/Search quality dips/i)).toBeInTheDocument()
    // The destructive vocabulary must be absent — this is the half that was wrong.
    expect(screen.queryByText(/deleted immediately/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Search returns nothing/i)).not.toBeInTheDocument()
  })

  it("titles the act as a re-embed and labels the button accordingly", () => {
    render(<ReembedConfirmModal {...base} dimsChanged={false} />)
    expect(screen.getByText("This will re-embed your library")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Re-embed now/i })).toBeInTheDocument()
  })
})

describe("ReembedConfirmModal — dimensions change (destructive)", () => {
  it("says vectors are deleted, and withdraws the non-destructive promise", () => {
    render(<ReembedConfirmModal {...base} dimsChanged currentDims={1536} />)

    expect(screen.getByText(/deleted immediately/i)).toBeInTheDocument()
    expect(screen.getByText(/Search returns nothing/i)).toBeInTheDocument()
    // The false reassurance must be GONE, not merely joined by a warning.
    expect(screen.queryByText(/Resumable & non-destructive/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Search quality dips/i)).not.toBeInTheDocument()
  })

  it("names the width change in both directions so the loss is legible", () => {
    render(<ReembedConfirmModal {...base} dimsChanged currentDims={1536} />)
    expect(screen.getByText("Vector width")).toBeInTheDocument()
    expect(screen.getByText("1536d → 1024d")).toBeInTheDocument()
  })

  it("titles the act as a deletion and says so on the button", () => {
    render(<ReembedConfirmModal {...base} dimsChanged currentDims={1536} />)
    expect(screen.getByText("This deletes every search vector first")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Delete vectors & re-embed/i }),
    ).toBeInTheDocument()
  })

  it("still reads honestly when the previous width is unknown", () => {
    // currentDims can be null if settings had not loaded — the copy must degrade to a
    // one-sided statement, never render "nulld → 1024d" or silently claim no change.
    render(<ReembedConfirmModal {...base} dimsChanged currentDims={null} />)
    expect(screen.getByText("→ 1024d")).toBeInTheDocument()
    expect(screen.getByText(/deleted immediately/i)).toBeInTheDocument()
  })
})

describe("ReembedConfirmModal — closed", () => {
  it("renders nothing when not open", () => {
    const { container } = render(
      <ReembedConfirmModal {...base} open={false} dimsChanged currentDims={1536} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
