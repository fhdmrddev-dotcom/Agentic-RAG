/**
 * Phase 294-05 Task 2 (DEC-03, D-14, D-17, D-20a, D-23, T-294-25/26) — the verdict on the marker.
 *
 * Sketch 294 A: after a check, each checked `[n]` marker keeps its numeral and gains the verdict
 * glyph and the verdict's style. Claim k decorates the k-th upgraded marker ONLY when the claim's
 * `n` equals that marker's `n` (Pitfall 7: on a mismatch the marker stays unchecked, so absence
 * stays absence). Unchecked markers, and every answer without `checkMessageId`, render as today.
 *
 * Also here: the References-header mount in `CitationList` (one action, a sibling of the fold
 * trigger), the CSS block in `index.css`, and the MessageItem source fence (D-23).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

const api = vi.hoisted(() => ({ getCitationChecks: vi.fn(), runCitationCheck: vi.fn() }))
vi.mock("@/lib/api/citationChecks", () => api)

import messageItemSource from "../MessageItem.tsx?raw"
import { CitedMarkdown } from "../CitedMarkdown"
import { CitationList } from "../CitationList"
import { CITATION_MARKER_ATTR, CitationNavProvider } from "@/lib/citationNav"
import { useCitationCheckStore } from "@/stores/citationCheckStore"
import type { CitationCheckResult, CitationClaimResult } from "@/lib/api/citationChecks"
import type { Citation } from "@/types"

/**
 * ⚠ `index.css` IS READ THROUGH node:fs, NOT `?raw` — measured on this suite's first GREEN run:
 * under vitest `test.css` is false, so `index.css?raw` resolves to "" and the CSS case failed
 * with `expected '' to contain …`. Same remedy as `ui/__tests__/tabsContrast.test.ts:50-80`.
 */
const nodeFs = await vi.importActual<{ readFileSync(path: string, encoding: string): string }>("node:fs")
const SRC_ROOT = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/src/components/chat/__tests__/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error(`fence cannot locate its own subtree in: ${here}`)
  return `${here.slice(0, at)}/src/`
})()
const cssSource = nodeFs.readFileSync(`${SRC_ROOT}index.css`, "utf8")

beforeAll(async () => {
  await import("@/lib/api/citationChecks")
})

afterEach(() => {
  cleanup()
  api.getCitationChecks.mockReset()
  api.runCitationCheck.mockReset()
})

function citations(k: number): Citation[] {
  return Array.from({ length: k }, (_, i) => ({
    document_id: `doc-${i + 1}`,
    filename: `f${i + 1}.pdf`,
    chunk_index: i,
    passage: `Passage ${i + 1}.`,
    similarity: 0.5,
    is_full_doc: false,
  }))
}

function resultWith(claims: Partial<CitationClaimResult>[]): CitationCheckResult {
  return {
    version: 1,
    engine: "jev",
    model: "typesafe/jev-1.14",
    checked_at: "2026-10-20T12:00:00Z",
    claims: claims.map((c, i) => ({
      ordinal: i,
      n: 1,
      sentence: "s",
      verdict: "supported",
      confidence: 0.9,
      ...c,
    })) as CitationClaimResult[],
    counts: { supported: 0, partly_supported: 0, not_supported: 0, contradicted: 1, couldnt_check: 0 },
    usage: { input_tokens: 1, cost_usd: 0 },
  }
}

function store(id: string, r: CitationCheckResult) {
  useCitationCheckStore.setState((s) => ({ byMessage: { ...s.byMessage, [id]: r } }))
}

const CONTENT = "Revenue rose [1]. Costs fell [2]. Margins held [2]."

function renderCited(content = CONTENT, checkMessageId?: string, k = 2) {
  return render(
    <CitationNavProvider>
      <CitedMarkdown content={content} citations={citations(k)} checkMessageId={checkMessageId} />
    </CitationNavProvider>,
  )
}

const markers = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLElement>(`[${CITATION_MARKER_ATTR}]`))
const isDecorated = (el: HTMLElement) =>
  [...el.classList].some((c) => c.startsWith("citation-marker--v-")) || !!el.querySelector(".citation-marker__verdict")

describe("ordinals", () => {
  it("every upgraded marker carries its 0-based DOM index", () => {
    const { container } = renderCited()
    expect(markers(container).map((m) => m.getAttribute("data-citation-ordinal"))).toEqual(["0", "1", "2"])
  })
})

describe("decoration (sketch 294 A)", () => {
  it("claim {ordinal 1, n 2, contradicted, 0.87} decorates marker 1 only", () => {
    store("m", resultWith([{ ordinal: 1, n: 2, verdict: "contradicted", confidence: 0.87 }]))
    const { container } = renderCited(CONTENT, "m")
    const [m0, m1, m2] = markers(container)
    expect(m1.classList.contains("citation-marker--v-contradicted")).toBe(true)
    const glyph = m1.querySelector(".citation-marker__verdict")!
    expect(glyph.textContent).toBe("✕")
    expect(glyph.getAttribute("aria-hidden")).toBe("true")
    expect(m1.getAttribute(CITATION_MARKER_ATTR)).toBe("2")
    expect(m1.textContent).toBe("2✕")
    expect(m1.getAttribute("aria-label")).toBe("Citation 2: f2.pdf — Contradicted, confidence 0.87")
    for (const m of [m0, m2]) expect(isDecorated(m)).toBe(false)
    expect(m0.getAttribute("aria-label")).toBe("Citation 1: f1.pdf")
  })

  it("T-294-26 — a claim whose n differs from the marker's n leaves the marker unchecked", () => {
    store("m", resultWith([{ ordinal: 0, n: 2, verdict: "supported", confidence: 0.99 }]))
    const { container } = renderCited(CONTENT, "m")
    expect(markers(container).some(isDecorated)).toBe(false)
  })

  it("D-17 — an unknown verdict renders as couldn't check, never supported", () => {
    store("m", resultWith([{ ordinal: 0, n: 1, verdict: "bogus" as never, confidence: 0.99 }]))
    const { container } = renderCited(CONTENT, "m")
    const m0 = markers(container)[0]
    expect(m0.classList.contains("citation-marker--v-couldnt_check")).toBe(true)
    expect(m0.classList.contains("citation-marker--v-supported")).toBe(false)
    expect(m0.getAttribute("aria-label")).toBe("Citation 1: f1.pdf — Couldn't check")
  })

  it("couldn't check carries no confidence; a 2-decimal raw confidence otherwise", () => {
    store(
      "m",
      resultWith([
        { ordinal: 0, n: 1, verdict: "couldnt_check", confidence: null },
        { ordinal: 1, n: 2, verdict: "partly_supported", confidence: 0.6149 },
      ]),
    )
    const { container } = renderCited(CONTENT, "m")
    const [m0, m1] = markers(container)
    expect(m0.getAttribute("aria-label")).toBe("Citation 1: f1.pdf — Couldn't check")
    expect(m1.getAttribute("aria-label")).toBe("Citation 2: f2.pdf — Partly supported, confidence 0.61")
  })

  it("without checkMessageId, a stored result is never applied", () => {
    store("m", resultWith([{ ordinal: 0, n: 1, verdict: "contradicted" }]))
    const { container } = renderCited(CONTENT)
    expect(markers(container).some(isDecorated)).toBe(false)
  })

  it("a result arriving after mount decorates in place and the hover peek still opens", () => {
    const { container } = renderCited(CONTENT, "m")
    const before = markers(container)
    expect(before.some(isDecorated)).toBe(false)
    act(() => store("m", resultWith([{ ordinal: 2, n: 2, verdict: "supported", confidence: 0.93 }])))
    const after = markers(container)
    expect(after[2]).toBe(before[2]) // same node: not rebuilt, listeners intact
    expect(after[2].classList.contains("citation-marker--v-supported")).toBe(true)
    fireEvent.mouseOver(after[2])
    const peek = document.body.querySelector(".citation-peek")
    expect(peek).not.toBeNull()
    expect(peek!.textContent).toContain("Supported")
    expect(peek!.textContent).toContain("confidence 0.93")
  })

  it("a re-check that changes the verdict replaces the old decoration", () => {
    store("m", resultWith([{ ordinal: 0, n: 1, verdict: "contradicted", confidence: 0.8 }]))
    const { container } = renderCited(CONTENT, "m")
    act(() => store("m", resultWith([{ ordinal: 0, n: 1, verdict: "supported", confidence: 0.95 }])))
    const m0 = markers(container)[0]
    expect(m0.classList.contains("citation-marker--v-contradicted")).toBe(false)
    expect(m0.classList.contains("citation-marker--v-supported")).toBe(true)
    expect(m0.querySelectorAll(".citation-marker__verdict")).toHaveLength(1)
    expect(m0.getAttribute("aria-label")).toBe("Citation 1: f1.pdf — Supported, confidence 0.95")
  })

  it("a content change that rebuilds the markers re-applies the decoration", () => {
    store("m", resultWith([{ ordinal: 0, n: 1, verdict: "contradicted", confidence: 0.8 }]))
    const { container, rerender } = renderCited(CONTENT, "m")
    rerender(
      <CitationNavProvider>
        <CitedMarkdown content={`${CONTENT} More.`} citations={citations(2)} checkMessageId="m" />
      </CitationNavProvider>,
    )
    expect(markers(container)[0].classList.contains("citation-marker--v-contradicted")).toBe(true)
  })

  it("the peek of an unchecked marker has no verdict section", () => {
    const { container } = renderCited(CONTENT, "m")
    fireEvent.mouseOver(markers(container)[0])
    expect(document.body.querySelector(".citation-peek")).not.toBeNull()
    expect(document.body.querySelector('[data-testid="citation-peek-verdict"]')).toBeNull()
  })
})

describe("index.css — one block keyed only on the verdict classes", () => {
  it("NON-VACUITY — the real stylesheet was read", () => {
    expect(cssSource.length).toBeGreaterThan(8000)
  })

  it("every verdict class and the glyph class has a rule", () => {
    for (const v of ["supported", "partly_supported", "not_supported", "contradicted", "couldnt_check"]) {
      expect(cssSource).toContain(`.citation-marker--v-${v}`)
    }
    expect(cssSource).toContain(".citation-marker__verdict")
  })
})

describe("CitationList — the References-header mount", () => {
  it("with checkMessageId: exactly one action, beside (not inside) the trigger, visible while folded", async () => {
    api.getCitationChecks.mockResolvedValue({
      availability: { available: true, engine: "jev", reason: null },
      checks: {},
    })
    const { container } = render(
      <CitationNavProvider>
        <CitationList citations={citations(3)} checkMessageId="m" />
      </CitationNavProvider>,
    )
    const trigger = screen.getByRole("button", { name: /References · 3 sources/ })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    const action = await screen.findByRole("button", { name: "Check citations · Jev" })
    expect(container.querySelectorAll('[data-testid="citation-check-action"]')).toHaveLength(1)
    expect(trigger.contains(action)).toBe(false)
    expect(action.closest("button")).toBe(action)
  })

  it("without checkMessageId: no action and no request", async () => {
    const { container } = render(
      <CitationNavProvider>
        <CitationList citations={citations(3)} />
      </CitationNavProvider>,
    )
    await act(async () => {
      for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
    })
    expect(container.querySelector('[data-testid="citation-check-action"]')).toBeNull()
    expect(api.getCitationChecks).not.toHaveBeenCalled()
  })
})

describe("MessageItem — the D-23 source fence", () => {
  const src = messageItemSource
  it("hooks unchanged: useState 3 (two `useState(` + one `useState<`), useEffect 0", () => {
    expect((src.match(/\buseState[(<]/g) ?? []).length).toBe(3)
    expect((src.match(/\buseEffect\(/g) ?? []).length).toBe(0)
  })

  // BUG-261020-04 moved the settled guard into `usePersistedMessageId` (its own test pins the
  // streaming / temp / failed-send arms). The inline `temp-` guard WAS the bug: it hid the action
  // on every freshly finished answer until the thread was re-opened.
  it("exactly two checkMessageId props, both from the one settled-id hook", () => {
    expect((src.match(/checkMessageId=/g) ?? []).length).toBe(2)
    expect(src.split("checkMessageId={checkMessageId}").length - 1).toBe(2)
    expect(src.split("usePersistedMessageId(message, isStreaming)").length - 1).toBe(1)
  })

  it("the Props interface still has its 5 members", () => {
    const m = /^interface Props \{([\s\S]*?)^\}/m.exec(src)
    expect(m).not.toBeNull()
    const members = m![1].split("\n").filter((l) => /^\s{2}\w+\??:/.test(l))
    expect(members).toHaveLength(5)
  })
})
