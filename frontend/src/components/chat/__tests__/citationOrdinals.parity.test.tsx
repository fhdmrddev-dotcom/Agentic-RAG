/**
 * Phase 294-03 (DEC-03, Pitfall 7) — the backend's claim ordinals ARE the markers the chat renders.
 *
 * `backend/app/services/citation_claims.py` numbers every in-range `[n]` it will judge (its
 * `ordinal`). Plan 05 decorates the k-th upgraded marker with claim k's verdict, so the two must
 * agree. The shared fixture (`backend/tests/unit/fixtures/citation_ordinals_v1.json`, read here via
 * `?raw` and by pytest from disk) pins both halves: this file renders each case through the
 * CURRENT CitedMarkdown, exactly as MessageItem feeds it (`dedupParagraphs(content)`), and reads the
 * upgraded markers' `n` in DOM order.
 *
 * It was written against an unmodified CitedMarkdown on purpose: it pins what users see TODAY, so a
 * later render change that moves a marker reds here instead of mis-decorating a verdict.
 */
import { describe, expect, it, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"
import fixtureRaw from "../../../../../backend/tests/unit/fixtures/citation_ordinals_v1.json?raw"
import { CitedMarkdown } from "../CitedMarkdown"
import { dedupParagraphs } from "../messageText"
import { CITATION_MARKER_ATTR, CitationNavProvider } from "@/lib/citationNav"
import type { Citation } from "@/types"

afterEach(cleanup)

interface OrdinalCase {
  id: string
  content: string
  n_sources: number
  expected: number[]
  deduped?: string
}

const FIXTURE = JSON.parse(fixtureRaw) as { version: number; cases: OrdinalCase[] }

function citations(k: number): Citation[] {
  return Array.from({ length: k }, (_, i) => ({
    document_id: `doc-${i + 1}`,
    filename: `f${i + 1}.pdf`,
    chunk_index: i,
    passage: "A source passage.",
    similarity: 0.5,
    is_full_doc: false,
  }))
}

function renderedMarkers(content: string, k: number): HTMLElement[] {
  const { container } = render(
    <CitationNavProvider>
      <CitedMarkdown content={dedupParagraphs(content)} citations={citations(k)} />
    </CitationNavProvider>,
  )
  return Array.from(container.querySelectorAll<HTMLElement>(`[${CITATION_MARKER_ATTR}]`))
}

function renderedMarkerNs(content: string, k: number): number[] {
  return renderedMarkers(content, k).map((el) => parseInt(el.getAttribute(CITATION_MARKER_ATTR) ?? "", 10))
}

describe("citation ordinals — the shared fixture", () => {
  it("NON-VACUITY — version 1 with at least 9 cases, and some case renders markers", () => {
    expect(FIXTURE.version).toBe(1)
    expect(FIXTURE.cases.length).toBeGreaterThanOrEqual(9)
    expect(renderedMarkerNs(FIXTURE.cases[0].content, FIXTURE.cases[0].n_sources).length).toBeGreaterThan(0)
  })

  for (const c of FIXTURE.cases) {
    it(`${c.id}: dedupParagraphs matches the backend port's expectation`, () => {
      expect(dedupParagraphs(c.content)).toBe(c.deduped ?? c.content)
    })

    it(`${c.id}: upgraded markers in DOM order == expected ordinals`, () => {
      expect(renderedMarkerNs(c.content, c.n_sources)).toEqual(c.expected)
    })

    // Phase 294-05 (Task 2): plan 05 decorates claim k onto the marker whose
    // data-citation-ordinal is k, so the attribute must be the 0-based DOM index and the
    // (ordinal, n) pairs must be the backend's (ordinal, expected[ordinal]).
    it(`${c.id}: data-citation-ordinal is the DOM index and (ordinal, n) == the backend pairs`, () => {
      const pairs = renderedMarkers(c.content, c.n_sources).map((el) => [
        parseInt(el.getAttribute("data-citation-ordinal") ?? "", 10),
        parseInt(el.getAttribute(CITATION_MARKER_ATTR) ?? "", 10),
      ])
      expect(pairs).toEqual(c.expected.map((n, ordinal) => [ordinal, n]))
    })
  }
})
