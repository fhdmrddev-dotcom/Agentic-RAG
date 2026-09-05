/**
 * Phase 153 Plan 03 (CITE-01) — References footer restructure.
 *
 * Covers the numbered `[n]` References footer contract (075-A / UI-SPEC
 * §"References Footer Contract"):
 *   - D-06: the footer ALWAYS renders when a citation set exists (never on an
 *     empty set), independent of whether inline markers exist.
 *   - D-07: open-by-default WHEN markers exist (the canonical `defaultOpen` prop —
 *     no `hasMarkers` alias); collapsed by default otherwise (today's behavior).
 *   - D-03: rows are numbered `[n]` (1-based) over the finalized `citations` order.
 *   - D-09/D-10: both chunk and full-doc rows render; a full-doc row shows
 *     "· Full document" with NO chunk index and NO similarity score.
 *   - The row→marker direction of the shared bidirectional flash (153-02):
 *     activating a row blooms its `[data-citation-marker]` via `flashCitationMarker`.
 *   - "Open document" routes through the owner-scoped `useCitationNav().openDocument`.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { CitationList } from "../CitationList"
import { CitationCard } from "../CitationCard"
import type { Citation } from "@/types"
import {
  CitationNavProvider,
  CITATION_ROW_ATTR,
  CITATION_MARKER_ATTR,
  CITATION_ACTIVE_CLASS,
} from "@/lib/citationNav"

function makeCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    document_id: "doc-1",
    filename: "alpha.pdf",
    chunk_index: 0,
    passage: "A representative grounded passage from the retrieved source.",
    similarity: 0.63,
    is_full_doc: false,
    ...overrides,
  }
}

const withNav = (children: ReactNode, selectDocument = vi.fn(), navigate = vi.fn()) => (
  <CitationNavProvider navigate={navigate} selectDocument={selectDocument}>
    {children}
  </CitationNavProvider>
)

describe("CitationList — D-06 footer always renders when a set exists", () => {
  it("returns null for an empty citation set", () => {
    const { container } = render(<CitationList citations={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the References header for a non-empty set regardless of markers", () => {
    render(<CitationList citations={[makeCitation()]} />)
    // header renders even with defaultOpen omitted (footer-only degradation, D-06)
    expect(
      screen.getByRole("button", { name: /References · 1 source$/ }),
    ).toBeInTheDocument()
  })
})

describe("CitationList — header copy + pluralization", () => {
  it("pluralizes 'sources' for a multi-source set", () => {
    render(<CitationList citations={[makeCitation(), makeCitation({ document_id: "doc-2" })]} />)
    expect(
      screen.getByRole("button", { name: /References · 2 sources/ }),
    ).toBeInTheDocument()
  })

  it("uses the singular 'source' for exactly one", () => {
    render(<CitationList citations={[makeCitation()]} />)
    expect(
      screen.getByRole("button", { name: /References · 1 source$/ }),
    ).toBeInTheDocument()
  })
})

describe("CitationList — open-by-default (D-06/D-07, canonical defaultOpen prop)", () => {
  it("opens by default WHEN markers exist (defaultOpen=true)", () => {
    render(<CitationList citations={[makeCitation()]} defaultOpen />)
    const trigger = screen.getByRole("button", { name: /References/ })
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    // content is mounted + visible when open
    expect(screen.getByText("alpha.pdf")).toBeInTheDocument()
  })

  it("stays collapsed by default WHEN no markers exist (defaultOpen omitted)", () => {
    render(<CitationList citations={[makeCitation()]} />)
    const trigger = screen.getByRole("button", { name: /References/ })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("alpha.pdf")).not.toBeInTheDocument()
  })
})

describe("CitationList — 1-based [n] numbering over citations order (D-03)", () => {
  it("threads n = i + 1 into each row, preserving order", () => {
    const { container } = render(
      <CitationList
        citations={[
          makeCitation({ document_id: "doc-1", filename: "alpha.pdf" }),
          makeCitation({ document_id: "doc-2", filename: "beta.md" }),
        ]}
        defaultOpen
      />,
    )
    const row1 = container.querySelector(`[${CITATION_ROW_ATTR}="1"]`) as HTMLElement
    const row2 = container.querySelector(`[${CITATION_ROW_ATTR}="2"]`) as HTMLElement
    expect(row1).toBeTruthy()
    expect(row2).toBeTruthy()
    expect(within(row1).getByText("[1]")).toBeInTheDocument()
    expect(within(row2).getByText("[2]")).toBeInTheDocument()
    expect(row1.textContent).toContain("alpha.pdf")
    expect(row2.textContent).toContain("beta.md")
  })
})

describe("CitationList — full-doc row (D-09/D-10)", () => {
  it("shows '· Full document' with no chunk index and no similarity score", () => {
    render(
      <CitationList
        citations={[
          makeCitation({
            document_id: "doc-full",
            filename: "whole.docx",
            is_full_doc: true,
            chunk_index: null,
            passage: null,
            similarity: 0.9, // present, but MUST NOT render for a full-doc row (D-10)
          }),
        ]}
        defaultOpen
      />,
    )
    expect(screen.getByText("Full document")).toBeInTheDocument()
    expect(screen.queryByText(/Chunk/)).not.toBeInTheDocument()
    expect(screen.queryByText("0.90")).not.toBeInTheDocument()
  })
})

describe("CitationList — row→marker bidirectional flash (153-02 contract)", () => {
  it("blooms the matching in-text marker when a row is activated", () => {
    const { container } = render(<CitationList citations={[makeCitation()]} defaultOpen />)
    // Simulate the in-text marker the 153-05 producer stamps.
    const marker = document.createElement("sup")
    marker.setAttribute(CITATION_MARKER_ATTR, "1")
    document.body.appendChild(marker)
    try {
      const row1 = container.querySelector(`[${CITATION_ROW_ATTR}="1"]`) as HTMLElement
      expect(marker.classList.contains(CITATION_ACTIVE_CLASS)).toBe(false)
      fireEvent.click(row1)
      expect(marker.classList.contains(CITATION_ACTIVE_CLASS)).toBe(true)
    } finally {
      document.body.removeChild(marker)
    }
  })
})

describe("CitationList — Open document routes through the owner-scoped nav", () => {
  it("calls openDocument(document_id) via the nav context", () => {
    const selectDocument = vi.fn()
    render(
      withNav(
        <CitationList citations={[makeCitation({ document_id: "doc-xyz" })]} defaultOpen />,
        selectDocument,
      ),
    )
    fireEvent.click(screen.getByRole("button", { name: /Open document/ }))
    expect(selectDocument).toHaveBeenCalledWith("doc-xyz")
  })
})

describe("CitationCard — un-numbered legacy render stays provider-free", () => {
  it("renders without n and without a nav provider (isolation contract)", () => {
    render(<CitationCard citation={makeCitation()} />)
    expect(screen.getByText("alpha.pdf")).toBeInTheDocument()
  })
})

describe("CitationCard — TRUST-04: machine-placed knowledge says so", () => {
  it("marks a citation that a connection placed, by NAME", () => {
    render(
      <CitationCard
        citation={makeCitation({
          source_connection_id: "conn-1",
          source_connection_name: "Engineering Drive",
        })}
      />,
    )
    expect(screen.getByTestId("citation-source-connection").textContent).toContain(
      "via Engineering Drive",
    )
  })

  it("⭐ ABSENCE IS THE SIGNAL — a person's upload carries NO mark", () => {
    // If every citation were marked, the mark would say nothing. An unadorned row is the
    // common case and must stay unadorned.
    render(<CitationCard citation={makeCitation()} />)
    expect(screen.queryByTestId("citation-source-connection")).toBeNull()
  })

  it("says 'a connection' rather than inventing a name it cannot resolve", () => {
    // A deleted connection nulls the id (D-4); a name may simply not be readable. Both are real
    // states, and neither licenses making one up.
    render(
      <CitationCard
        citation={makeCitation({ source_connection_id: "conn-9", source_connection_name: null })}
      />,
    )
    expect(screen.getByTestId("citation-source-connection").textContent).toContain(
      "via a connection",
    )
  })

  it("puts the provenance in real DOM text, not a title attribute", () => {
    render(
      <CitationCard
        citation={makeCitation({ source_connection_id: "c", source_connection_name: "Drive" })}
      />,
    )
    // A fact only a hover reveals is a fact assistive tech and touch users never get.
    expect(screen.getByTestId("citation-source-connection").getAttribute("title")).toBeNull()
  })
})
