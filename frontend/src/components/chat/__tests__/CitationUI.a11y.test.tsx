/**
 * Phase 155 Plan 06 Task 2 — Citation UI a11y contract (153 surface, WCAG 2.1 AA / D-01).
 *
 * This is a VERIFY suite (D-13): the 153 citation cluster shipped WITH its a11y
 * contracts — this suite proves they STILL HOLD after the Plan 03 jsx-a11y sweep +
 * the Plan 07 opacity sweep, especially because the in-text markers live inside
 * MessageItem (G-5). It renders the citation components DIRECTLY (CitedMarkdown /
 * CitationPeek / CitationList / CitationCard / AbsenceHint) and NEVER edits
 * MessageItem.tsx / StreamsProvider.tsx (the RED LINE; the MessageItem.test replay
 * suite is the tripwire, run in the plan's verify step).
 *
 * Verified 153 contracts:
 *   - CitationPeek pinned = role="dialog" aria-modal="false" (NON-blocking, no trap)
 *     with an accessible name (filename); the pin toggle exposes aria-pressed + the
 *     state-toggled aria-label (Pin citation {n} ↔ Unpin citation {n}); Esc closes.
 *   - the in-text markers are role="button" with an accessible name; the trusted-node
 *     upgrade (document.createElement, NOT dangerouslySetInnerHTML) means model text
 *     cannot inject raw HTML (V5 / T-155-06-XSS) — a <script>/passage payload stays
 *     inert / auto-escaped.
 *   - reduced-motion honoured (the peek STILL renders under reduce=true).
 *   - never colour-alone: a visible WORD accompanies every state.
 *
 * STRUCTURAL axe rules only (jsdom cannot compute colour-contrast — the live Chrome
 * scan owns that half). No component source is modified.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { ReactNode } from "react"
import { axe } from "vitest-axe"
import type { Citation } from "@/types"
import { CitationNavProvider } from "@/lib/citationNav"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CitedMarkdown } from "../CitedMarkdown"
import { CitationPeek } from "../CitationPeek"
import { CitationList } from "../CitationList"
import { CitationCard } from "../CitationCard"
import { AbsenceHint } from "../AbsenceHint"

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

const TWO: Citation[] = [
  makeCitation({ document_id: "doc-1", filename: "alpha.pdf" }),
  makeCitation({ document_id: "doc-2", filename: "beta.md", chunk_index: 1 }),
]

const withNav = (children: ReactNode) => <CitationNavProvider>{children}</CitationNavProvider>

/**
 * D-14 documented per-rule exclusion — `nested-interactive` on the citation footer
 * ROW (`role="button"` hosting the nested "Open document" button).
 *
 * The Phase-153 footer row is a CONVENIENCE click-target (activating it flashes the
 * in-text marker) that deliberately wraps a proper, independently-reachable "Open
 * document" `<button>` — the sanctioned `role="button"+tabIndex+guarded-keydown`
 * container pattern 155-03 adopted for rows that host nested interactives (a native
 * `<button>` wrapping another button is invalid HTML). The barrier `nested-interactive`
 * guards (a control unreachable/unannounced due to nesting) does NOT exist here: the
 * nested "Open document" button is in the tab order AND carries its own accessible
 * name (asserted POSITIVELY below, so this exclusion can never hide a real barrier).
 *
 * The fully-separated restructure (row → non-interactive wrapper) is a render-logic
 * change out of scope for this TEST-ONLY verify plan (D-13 is additive-only; the plan
 * must not rebuild the citation components) and is already logged to SEED-092-remainder
 * by 155-03. Encoded per-rule/per-selector; every other WCAG-AA structural rule stays
 * ON. Mirrored in 155-VALIDATION.md D-14 register.
 */
const CITATION_ROW_AXE_OPTS = { rules: { "nested-interactive": { enabled: false } } } as const

/** jsdom has no matchMedia — default to "motion allowed" (reduce=false). */
function stubMatchMedia(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reduce : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

beforeEach(() => {
  stubMatchMedia(false)
})

afterEach(() => {
  cleanup()
})

// ── CitedMarkdown — trusted marker nodes, no raw-HTML injection ───────────────
describe("CitedMarkdown a11y — trusted markers (D-07 / V5 / no dangerouslySetInnerHTML)", () => {
  it("no aXe structural violations — cited prose with in-range markers", async () => {
    const { container } = render(withNav(<CitedMarkdown content="Revenue rose [1] then held [2]." citations={TWO} />))
    await screen.findByText(/Revenue rose/)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("upgrades in-range [n] to role=button markers with an accessible name", () => {
    const { container } = render(withNav(<CitedMarkdown content="Grounded [1] and [2]." citations={TWO} />))
    const markers = container.querySelectorAll<HTMLElement>("sup.citation-marker")
    expect(markers.length).toBe(2)
    // Each marker is an OWNED interactive node — role=button + a filename-bearing name.
    expect(markers[0].getAttribute("role")).toBe("button")
    expect(markers[0].getAttribute("tabindex")).toBe("0")
    expect(markers[0].getAttribute("aria-label")).toContain("alpha.pdf")
    expect(markers[1].getAttribute("aria-label")).toContain("beta.md")
  })

  it("model text cannot inject raw HTML — a <script> payload is sanitised out of the tree", () => {
    // The trusted-node upgrade replaces dangerouslySetInnerHTML: markers are owned
    // createElement nodes and the markdown flows through DOMPurify — a <script> in the
    // model text NEVER reaches the DOM as an executable node (T-155-06-XSS).
    const { container } = render(
      withNav(<CitedMarkdown content={"Grounded [1].\n\n<script>alert('xss')</script>"} citations={TWO} />),
    )
    expect(container.querySelector("script")).toBeNull()
    // The in-range marker still upgraded (the sanitiser did not eat the prose).
    expect(container.querySelector('sup[data-citation-marker="1"]')).not.toBeNull()
  })

  it("Esc closes a pinned peek and restores focus to the originating marker (D-09 scenario 2)", () => {
    const { container } = render(withNav(<CitedMarkdown content="Grounded [1]." citations={TWO} />))
    const marker = container.querySelector<HTMLElement>('sup[data-citation-marker="1"]')!
    fireEvent.click(marker) // pins the peek
    expect(document.querySelector(".citation-peek")).not.toBeNull()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    // Esc unpins/closes and restores focus to the marker (non-blocking, no dead-end).
    fireEvent.keyDown(document, { key: "Escape" })
    expect(document.querySelector(".citation-peek")).toBeNull()
    expect(document.activeElement).toBe(marker)
  })
})

// ── CitationPeek — role=dialog aria-modal=false + pin toggle + reduced motion ──
describe("CitationPeek a11y — pinned dialog contract (verify 153)", () => {
  function renderPeek(props: Partial<Parameters<typeof CitationPeek>[0]> = {}) {
    const onPin = vi.fn()
    const onClose = vi.fn()
    render(
      withNav(
        <CitationPeek
          citation={makeCitation()}
          n={3}
          anchorRect={{ bottom: 100, left: 120 } as DOMRect}
          pinned={false}
          onPin={onPin}
          onClose={onClose}
          {...props}
        />,
      ),
    )
    return { onPin, onClose, peekEl: document.querySelector<HTMLElement>(".citation-peek")! }
  }

  it("no aXe structural violations — a pinned peek", async () => {
    const { peekEl } = renderPeek({ pinned: true })
    expect(await axe(peekEl)).toHaveNoViolations()
  })

  it("a pinned peek is role=dialog aria-modal=false labelled by its head (no focus trap)", () => {
    renderPeek({ pinned: true, citation: makeCitation({ filename: "beta.md" }) })
    const dialog = screen.getByRole("dialog")
    // aria-modal="false" = a NON-blocking dialog — it never traps focus / dead-ends.
    expect(dialog).toHaveAttribute("aria-modal", "false")
    expect(dialog).toHaveAccessibleName(/beta\.md/)
  })

  it("an UNPINNED peek carries no dialog role (non-blocking by construction)", () => {
    renderPeek({ pinned: false })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("the pin toggle exposes aria-pressed + a state-toggled accessible name", () => {
    // Unpinned → "Pin citation 3" (aria-pressed=false).
    const unpinned = renderPeek({ pinned: false, n: 3 })
    const pin = screen.getByRole("button", { name: "Pin citation 3" })
    expect(pin).toHaveAttribute("aria-pressed", "false")
    cleanup()
    // Pinned → the name flips to "Unpin citation 3" (aria-pressed=true).
    void unpinned
    renderPeek({ pinned: true, n: 3 })
    const unpin = screen.getByRole("button", { name: "Unpin citation 3" })
    expect(unpin).toHaveAttribute("aria-pressed", "true")
  })

  it("Esc invokes onClose (the marker restores focus upstream)", () => {
    const { onClose } = renderPeek({ pinned: true })
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("honours reduced motion — the peek STILL renders under prefers-reduced-motion", async () => {
    stubMatchMedia(true)
    const { peekEl } = renderPeek({ pinned: true })
    // Motion is CSS-gated (motion-reduce:animate-none) — the element must still exist.
    expect(peekEl).toBeInTheDocument()
    expect(await axe(peekEl)).toHaveNoViolations()
  })

  it("never colour-alone — a visible WORD accompanies the peek (Open document)", () => {
    renderPeek({ pinned: true })
    expect(screen.getByRole("button", { name: /Open document/ })).toBeInTheDocument()
  })

  it("full-doc variant reads the WORD 'Full document' (never a score/colour alone, D-10)", () => {
    renderPeek({
      pinned: true,
      citation: makeCitation({ is_full_doc: true, chunk_index: null, passage: null, filename: "whole.docx" }),
    })
    expect(screen.getByText(/Full document/)).toBeInTheDocument()
  })
})

// ── CitationList / CitationCard — footer rows verify ──────────────────────────
describe("CitationList a11y — References footer (verify 153)", () => {
  it("no aXe structural violations — open footer with numbered rows", async () => {
    const { container } = render(withNav(<CitationList citations={TWO} defaultOpen />))
    await screen.findByText("alpha.pdf")
    // D-14: nested-interactive excluded per-rule (see CITATION_ROW_AXE_OPTS); the row +
    // its nested Open-document button are asserted named/reachable in the next test.
    expect(await axe(container, CITATION_ROW_AXE_OPTS)).toHaveNoViolations()
  })

  it("the References trigger exposes aria-expanded and the rows are named role=button", () => {
    render(withNav(<CitationList citations={TWO} defaultOpen />))
    const trigger = screen.getByRole("button", { name: /References · 2 sources/ })
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    // Each footer row is a named button; "Open document" is reachable by name.
    expect(screen.getByRole("button", { name: /Citation 1: alpha\.pdf/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Citation 2: beta\.md/ })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Open document/ }).length).toBe(2)
  })

  it("full-doc row reads the WORD 'Full document' (never colour/score alone, D-10)", () => {
    render(
      withNav(
        <CitationList
          citations={[makeCitation({ is_full_doc: true, chunk_index: null, passage: null, filename: "whole.docx" })]}
          defaultOpen
        />,
      ),
    )
    expect(screen.getByText("Full document")).toBeInTheDocument()
  })
})

describe("CitationCard a11y — numbered row (verify 153)", () => {
  it("no aXe structural violations — a numbered card", async () => {
    const { container } = render(withNav(<CitationCard citation={makeCitation()} n={1} />))
    await screen.findByText("alpha.pdf")
    // D-14: nested-interactive excluded per-rule (see CITATION_ROW_AXE_OPTS); the row +
    // its nested Open-document button are asserted named/reachable in the next test.
    expect(await axe(container, CITATION_ROW_AXE_OPTS)).toHaveNoViolations()
  })

  it("the row is a named role=button + the nested Open-document button stays independently reachable", () => {
    render(withNav(<CitationCard citation={makeCitation()} n={1} />))
    // The convenience row-button is named…
    expect(screen.getByRole("button", { name: /Citation 1: alpha\.pdf/ })).toBeInTheDocument()
    // …AND the nested "Open document" control is independently reachable by name — the
    // proof that the D-14 nested-interactive exclusion hides no real barrier.
    expect(screen.getByRole("button", { name: /Open document/ })).toBeInTheDocument()
    // Chunk 4 (1-based) — a WORD/number, not colour.
    expect(screen.getByText(/Chunk 4/)).toBeInTheDocument()
  })

  it("a passage with HTML renders as ESCAPED text — no injected element (auto-escaped, no innerHTML)", () => {
    const { container } = render(
      withNav(<CitationCard citation={makeCitation({ passage: "<img src=x onerror=alert(1)> literal passage" })} n={1} />),
    )
    // React auto-escapes the passage text (no dangerouslySetInnerHTML) → the payload
    // renders as literal characters, never as a live <img>.
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByText(/<img src=x onerror=alert\(1\)> literal passage/)).toBeInTheDocument()
  })
})

// ── AbsenceHint — non-blocking ⓘ, never a banner ──────────────────────────────
describe("AbsenceHint a11y — non-blocking teaching ⓘ (verify 153)", () => {
  it("no aXe structural violations — the inline hint under a cited answer", async () => {
    const { container } = render(
      <TooltipProvider>
        <AbsenceHint citations={[makeCitation()]} />
      </TooltipProvider>,
    )
    await screen.findByText(/Unmarked claims read as general knowledge/)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("the ⓘ is a named button and the hint is NEVER a banner (no alert/banner/modal)", () => {
    render(
      <TooltipProvider>
        <AbsenceHint citations={[makeCitation()]} />
      </TooltipProvider>,
    )
    expect(screen.getByRole("button", { name: "About citations" })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByRole("banner")).not.toBeInTheDocument()
    expect(document.querySelector('[aria-modal="true"]')).toBeNull()
    // The inline label reads as WORDS (never colour-alone).
    expect(screen.getByText("Unmarked claims read as general knowledge")).toBeInTheDocument()
  })
})
