/**
 * Phase 294-05 Task 2 (DEC-03, D-14, D-17) — the peek's verdict section.
 *
 * Hover peeks and click pins (075); for a checked marker the peek adds ONE section between the
 * passage and the footer: the glyph (aria-hidden) + the verdict WORD, the confidence as a raw
 * number with 2 decimals (or "no verdict"), and the verdict's fixed one-line reason. Without a
 * verdict the peek renders exactly as before.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { CitationPeek } from "../CitationPeek"
import { CitationNavProvider } from "@/lib/citationNav"
import { VERDICT_META } from "../citationVerdicts"
import type { Citation } from "@/types"

afterEach(cleanup)

const CITATION: Citation = {
  document_id: "doc-2",
  filename: "SOC-2 Report.pdf",
  chunk_index: 2,
  passage: "CC6.1 — Exception noted: 2 of 25 sampled terminations were not deprovisioned.",
  similarity: 0.66,
  is_full_doc: false,
}

function peek(verdict?: { verdict: string; confidence: number | null }) {
  return render(
    <CitationNavProvider>
      <CitationPeek
        citation={CITATION}
        n={2}
        anchorRect={{ bottom: 10, left: 10 }}
        pinned={false}
        onPin={vi.fn()}
        onClose={vi.fn()}
        verdict={verdict}
      />
    </CitationNavProvider>,
  )
}

const section = () => document.body.querySelector<HTMLElement>('[data-testid="citation-peek-verdict"]')

describe("CitationPeek — verdict section", () => {
  it("contradicted 0.87: word, raw confidence, the fixed reason; the source line and passage stay", () => {
    peek({ verdict: "contradicted", confidence: 0.87 })
    const s = section()!
    expect(s).not.toBeNull()
    expect(s.textContent).toContain("Contradicted")
    expect(s.textContent).toContain("confidence 0.87")
    expect(s.textContent).toContain(VERDICT_META.contradicted.reason)
    expect(s.querySelector('[aria-hidden="true"]')!.textContent).toBe("✕")
    expect(screen.getByText(CITATION.passage!)).toBeInTheDocument()
    expect(document.body.textContent).toContain("Chunk 3 · 0.66")
  })

  it("the section sits between the passage and the footer", () => {
    peek({ verdict: "supported", confidence: 0.93 })
    const passage = screen.getByText(CITATION.passage!)
    const s = section()!
    expect(passage.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const open = screen.getByRole("button", { name: /Open document/ })
    expect(s.compareDocumentPosition(open) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("couldn't check shows 'no verdict', never a number", () => {
    peek({ verdict: "couldnt_check", confidence: null })
    const s = section()!
    expect(s.textContent).toContain("Couldn't check")
    expect(s.textContent).toContain("no verdict")
    expect(s.textContent).not.toMatch(/confidence \d/)
  })

  it("D-17 — an unknown verdict reads as couldn't check, and its confidence is not shown", () => {
    peek({ verdict: "bogus", confidence: 0.99 })
    const s = section()!
    expect(s.textContent).toContain("Couldn't check")
    expect(s.textContent).not.toContain("Supported")
    expect(s.textContent).not.toContain("0.99")
  })

  it("no verdict → no section (the peek renders as before)", () => {
    peek()
    expect(section()).toBeNull()
  })
})
