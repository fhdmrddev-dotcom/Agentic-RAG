/**
 * Phase 153 Plan 05 (CITE-01) — CitedMarkdown: the reused marked+DOMPurify
 * pipeline + a post-mount marker upgrade + the peek/flash wiring.
 *
 * Covers (RESEARCH §"Pattern 2" + Pitfalls 2/3/6, UI-SPEC §Marker Contract):
 *   - Base render is byte-identical to MarkdownRenderer for plain markdown (the
 *     shared render path is unchanged — G-5 / D-14).
 *   - In-range `[n]` (n ∈ [1, citations.length]) upgrades to a TRUSTED interactive
 *     `<sup>` (role=button, tabindex=0, aria-label with filename, data-citation-marker)
 *     — an OWNED document.createElement node, so its attributes are never stripped
 *     by DOMPurify (Pitfall 3 / V5).
 *   - Out-of-range `[9]` (only 2 citations) and `[0]` stay LITERAL text (D-07).
 *   - `[n]` inside a fenced code block / inline `code` is NOT upgraded and a
 *     markdown link is not corrupted (Pitfall 2).
 *   - Activating a marker opens the CitationPeek and flashes the matching
 *     `data-citation-row` (the marker→row direction of the bidirectional link).
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { ReactNode } from "react"
import { CitedMarkdown } from "../CitedMarkdown"
import { MarkdownRenderer } from "../MarkdownRenderer"
import type { Citation } from "@/types"
import { CitationNavProvider } from "@/lib/citationNav"

afterEach(cleanup)

function makeCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    document_id: "doc-1",
    filename: "alpha.pdf",
    chunk_index: 3,
    passage: "A representative grounded passage.",
    similarity: 0.63,
    is_full_doc: false,
    ...overrides,
  }
}

const TWO: Citation[] = [
  makeCitation({ document_id: "doc-1", filename: "alpha.pdf" }),
  makeCitation({ document_id: "doc-2", filename: "beta.md", chunk_index: 1 }),
]

function wrap(children: ReactNode) {
  return <CitationNavProvider>{children}</CitationNavProvider>
}

function renderCited(content: string, citations: Citation[] = TWO, extra?: ReactNode) {
  return render(
    wrap(
      <>
        {extra}
        <CitedMarkdown content={content} citations={citations} />
      </>,
    ),
  )
}

describe("CitedMarkdown — reused pipeline (base render unchanged, G-5/D-14)", () => {
  it("produces byte-identical HTML to MarkdownRenderer for plain markdown (no markers)", () => {
    const content = "Hello **world**, this is grounded prose.\n\nA second paragraph."
    const a = render(<MarkdownRenderer content={content} />)
    const base = a.container.querySelector(".markdown")!.innerHTML
    cleanup()
    const b = renderCited(content, [])
    const cited = b.container.querySelector(".markdown")!.innerHTML
    expect(cited).toBe(base)
  })
})

describe("CitedMarkdown — marker upgrade (D-07 / V5 / Pitfall 3)", () => {
  it("upgrades in-range [1] and [2] to owned interactive <sup> nodes", () => {
    const { container } = renderCited("Revenue rose [1] sharply [2].", TWO)
    const markers = container.querySelectorAll("sup.citation-marker")
    expect(markers.length).toBe(2)

    const first = markers[0] as HTMLElement
    // Interactive attributes set programmatically on the createElement node —
    // present after mount (proving DOMPurify did not strip them, Pitfall 3).
    expect(first.getAttribute("role")).toBe("button")
    expect(first.getAttribute("tabindex")).toBe("0")
    expect(first.getAttribute("data-citation-marker")).toBe("1")
    expect(first.getAttribute("aria-label")).toContain("alpha.pdf")

    const second = markers[1] as HTMLElement
    expect(second.getAttribute("data-citation-marker")).toBe("2")
    expect(second.getAttribute("aria-label")).toContain("beta.md")
  })

  it("range-checks: out-of-range [9] and [0] stay LITERAL text (only in-range upgrade)", () => {
    const { container } = renderCited("Claim [9] and [0] and grounded [1].", TWO)
    const markers = container.querySelectorAll("sup.citation-marker")
    // Only [1] is in range → exactly one marker.
    expect(markers.length).toBe(1)
    expect((markers[0] as HTMLElement).getAttribute("data-citation-marker")).toBe("1")
    // The out-of-range tokens remain as plain text.
    expect(container.textContent).toContain("[9]")
    expect(container.textContent).toContain("[0]")
  })
})

describe("CitedMarkdown — code-span & link skip (Pitfall 2)", () => {
  it("does NOT upgrade [1] inside a fenced code block", () => {
    const content = "Grounded [1].\n\n```\narr[1] = other[1]\n```\n"
    const { container } = renderCited(content, TWO)
    // The prose [1] became a marker…
    const markers = container.querySelectorAll("sup.citation-marker")
    expect(markers.length).toBe(1)
    // …but the code block keeps its literal [1] and holds no marker.
    const pre = container.querySelector("pre")!
    expect(pre.textContent).toContain("arr[1]")
    expect(pre.querySelector("[data-citation-marker]")).toBeNull()
  })

  it("does not corrupt a markdown link and skips [n] inside inline code", () => {
    const content = "See [1] at [docs](https://example.com) and `code[1]`."
    const { container } = renderCited(content, TWO)
    // The link is intact.
    const a = container.querySelector("a")!
    expect(a.getAttribute("href")).toBe("https://example.com")
    expect(a.textContent).toBe("docs")
    // Inline code keeps its literal [1] (no marker inside <code>).
    const code = container.querySelector("code")!
    expect(code.textContent).toContain("code[1]")
    expect(code.querySelector("[data-citation-marker]")).toBeNull()
    // Exactly one marker overall (the prose [1]); the link + inline code are skipped.
    expect(container.querySelectorAll("sup.citation-marker").length).toBe(1)
  })
})

describe("CitedMarkdown — activation opens the peek + flashes the footer row", () => {
  it("clicking a marker opens the CitationPeek and blooms the matching data-citation-row", () => {
    const row = <div data-citation-row="1" data-testid="row-1" />
    const { container } = renderCited("Grounded [1].", TWO, row)

    const marker = container.querySelector<HTMLElement>('sup[data-citation-marker="1"]')!
    fireEvent.click(marker)

    // The peek portal mounts (CitationPeek stamps the `citation-peek` class).
    expect(document.querySelector(".citation-peek")).not.toBeNull()
    // The matching footer row blooms (marker→row direction via flashCitationRow).
    expect(screen.getByTestId("row-1").classList.contains("citation-ref-flash")).toBe(true)
  })
})
