/**
 * Phase 153 Plan 04 (CITE-01) — CitationPeek hover-peek → click-to-pin popover.
 *
 * Covers the net-new click-through peek the 075-A sketch locked (UI-SPEC
 * §"Click-through Contract" + §"Accessibility"):
 *   - Chunk variant (SC#2): head `[n] {filename}`, the passage snippet, and a
 *     footer `{loc}` (Chunk N · similarity 2dp) + `↗ Open document`.
 *   - Full-doc variant (D-10): head + a "Full document" affordance line with NO
 *     chunk snippet and NO similarity score; footer = `↗ Open document` only.
 *   - Calm degrade (D-04): a null/short passage on a chunk citation renders head
 *     + Open document with the snippet omitted — NEVER an error banner or red text.
 *   - Open document routes through the owner-scoped `useCitationNav().openDocument`.
 *   - Pin/a11y: the pin toggle's accessible name flips `Pin citation {n}` ↔
 *     `Unpin citation {n}`; a pinned peek is `role="dialog" aria-modal="false"`
 *     labelled by its head; Esc invokes onClose.
 *   - Positioning clamps `left` to `viewportWidth − 340` (UI-SPEC positioning).
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { afterEach } from "vitest"
import type { ReactNode } from "react"
import { CitationPeek } from "../CitationPeek"
import type { Citation } from "@/types"
import { CitationNavProvider } from "@/lib/citationNav"

afterEach(cleanup)

function makeCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    document_id: "doc-1",
    filename: "alpha.pdf",
    chunk_index: 3,
    passage: "A representative grounded passage from the retrieved source.",
    similarity: 0.63,
    is_full_doc: false,
    ...overrides,
  }
}

type PeekProps = Parameters<typeof CitationPeek>[0]

function renderPeek(
  props: Partial<PeekProps> = {},
  selectDocument = vi.fn(),
  navigate = vi.fn(),
): { selectDocument: ReturnType<typeof vi.fn>; onPin: ReturnType<typeof vi.fn>; onClose: ReturnType<typeof vi.fn> } {
  const onPin = vi.fn()
  const onClose = vi.fn()
  const full: PeekProps = {
    citation: makeCitation(),
    n: 3,
    anchorRect: { bottom: 100, left: 120 } as DOMRect,
    pinned: false,
    onPin,
    onClose,
    ...props,
  }
  const wrap = (children: ReactNode) => (
    <CitationNavProvider navigate={navigate} selectDocument={selectDocument}>
      {children}
    </CitationNavProvider>
  )
  render(wrap(<CitationPeek {...full} />))
  return { selectDocument, onPin, onClose }
}

const peekEl = () => document.querySelector<HTMLElement>(".citation-peek") as HTMLElement

describe("CitationPeek — chunk variant (SC#2)", () => {
  it("renders head [n] {filename}, the passage snippet, and loc + Open document", () => {
    renderPeek({ citation: makeCitation(), n: 3 })
    // head number keyed 1:1 to the marker
    expect(screen.getByText("[3]")).toBeInTheDocument()
    expect(screen.getByText("alpha.pdf")).toBeInTheDocument()
    // passage snippet is shown for a chunk citation
    expect(
      screen.getByText("A representative grounded passage from the retrieved source."),
    ).toBeInTheDocument()
    // location: chunk (1-based) + similarity (2dp)
    expect(screen.getByText(/Chunk 4/)).toBeInTheDocument()
    expect(screen.getByText(/0\.63/)).toBeInTheDocument()
    // Open document CTA
    expect(screen.getByRole("button", { name: /Open document/ })).toBeInTheDocument()
  })

  it("appends the version suffix when version_number > 1", () => {
    renderPeek({ citation: makeCitation({ version_number: 2 }) })
    expect(screen.getByText(/alpha\.pdf/)).toHaveTextContent("(v2)")
  })
})

describe("CitationPeek — full-doc variant (D-10)", () => {
  it("shows a 'Full document' affordance with NO snippet and NO similarity score", () => {
    renderPeek({
      citation: makeCitation({
        document_id: "doc-full",
        filename: "whole.docx",
        is_full_doc: true,
        chunk_index: null,
        passage: null,
        similarity: 0.9, // present, but MUST NOT render for a full-doc peek (D-10)
      }),
      n: 2,
    })
    expect(screen.getByText(/Full document/)).toBeInTheDocument()
    // No chunk snippet, no similarity score, no "Chunk N"
    expect(screen.queryByText(/Chunk/)).not.toBeInTheDocument()
    expect(screen.queryByText("0.90")).not.toBeInTheDocument()
    // Open document is still present
    expect(screen.getByRole("button", { name: /Open document/ })).toBeInTheDocument()
  })
})

describe("CitationPeek — calm degrade on missing passage (D-04)", () => {
  it("renders head + Open document with the snippet omitted, no error/red text", () => {
    renderPeek({ citation: makeCitation({ passage: null }), n: 1 })
    // head + Open document remain
    expect(screen.getByText("[1]")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Open document/ })).toBeInTheDocument()
    // No error chrome (calm-instrument): no alert role, no error/unavailable copy
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByText(/error|unavailable|failed/i)).not.toBeInTheDocument()
    // No destructive/red styling anywhere in the peek
    expect(peekEl().querySelector('[class*="destructive"]')).toBeNull()
    expect(peekEl().querySelector('[class*="text-red"]')).toBeNull()
  })

  it("also omits the snippet for an empty/whitespace passage", () => {
    renderPeek({ citation: makeCitation({ passage: "   " }), n: 1 })
    expect(screen.getByRole("button", { name: /Open document/ })).toBeInTheDocument()
    // the whitespace passage is not rendered as a snippet paragraph
    expect(peekEl().querySelector("p.italic")).toBeNull()
  })
})

describe("CitationPeek — Open document routes through owner-scoped nav", () => {
  it("calls openDocument(document_id) via the nav context", () => {
    const selectDocument = vi.fn()
    renderPeek({ citation: makeCitation({ document_id: "doc-xyz" }) }, selectDocument)
    fireEvent.click(screen.getByRole("button", { name: /Open document/ }))
    // CitationNavProvider.openDocument fires the injected selectDocument(documentId)
    expect(selectDocument).toHaveBeenCalledWith("doc-xyz")
  })
})

describe("CitationPeek — pin toggle accessible name + Esc (a11y)", () => {
  it("names the pin control 'Pin citation {n}' when unpinned", () => {
    const { onPin } = renderPeek({ n: 5, pinned: false })
    const pin = screen.getByRole("button", { name: "Pin citation 5" })
    expect(pin).toBeInTheDocument()
    fireEvent.click(pin)
    expect(onPin).toHaveBeenCalledTimes(1)
  })

  it("flips the pin control name to 'Unpin citation {n}' when pinned", () => {
    renderPeek({ n: 5, pinned: true })
    expect(screen.getByRole("button", { name: "Unpin citation 5" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pin citation 5" })).not.toBeInTheDocument()
  })

  it("marks a pinned peek role=dialog aria-modal=false labelled by its head", () => {
    renderPeek({ pinned: true, citation: makeCitation({ filename: "beta.md" }) })
    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "false")
    // labelled by the head — accessible name resolves to the filename
    expect(dialog).toHaveAccessibleName(/beta\.md/)
  })

  it("does NOT trap focus — an unpinned peek carries no dialog role (non-blocking)", () => {
    renderPeek({ pinned: false })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("invokes onClose when Escape is pressed", () => {
    const { onClose } = renderPeek({ pinned: true })
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe("CitationPeek — positioning (UI-SPEC)", () => {
  it("clamps left to viewportWidth − 340 when the anchor sits near the right edge", () => {
    renderPeek({ anchorRect: { bottom: 100, left: 5000 } as DOMRect })
    const expectedLeft = Math.max(8, Math.min(5000, window.innerWidth - 340))
    expect(peekEl().style.left).toBe(`${expectedLeft}px`)
  })

  it("positions below the anchor (top = bottom + scrollY + 8) without clamping a left-edge anchor", () => {
    renderPeek({ anchorRect: { bottom: 100, left: 120 } as DOMRect })
    const el = peekEl()
    expect(el.style.top).toBe(`${100 + (window.scrollY || 0) + 8}px`)
    expect(el.style.left).toBe("120px")
  })
})
