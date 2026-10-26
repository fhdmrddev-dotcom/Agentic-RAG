// @vitest-environment jsdom
/**
 * Phase 289 plan 02 (TRUST-01 / D-09 / D-14a) — the sketch-B evidence line under a KB step.
 *
 * Asserted by exact CONTENT, never by testid presence: a presence assertion stays green while
 * the words drift (the 235 lesson). The acceptance bar is
 * `.planning/sketches/289-confidence-on-a-step/` variant B.
 */
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { StepEvidenceLine, type EvidenceLineConfidence } from "./StepEvidenceLine"
import { NO_MATCH_EXPLANATION } from "./evidenceVocabulary"

afterEach(cleanup)

const DISCLAIMER =
  "This answer is based on limited or weakly-matched evidence. Please verify with the source documents."

const conf = (over: Partial<EvidenceLineConfidence> = {}): EvidenceLineConfidence => ({
  level: "medium",
  avg_similarity: 0.47,
  disclaimer: null,
  passages: 6,
  kb_label: "Procurement KB",
  ...over,
})

describe("StepEvidenceLine — absence renders as absence (D-09)", () => {
  it("renders nothing for null or undefined", () => {
    const { container, rerender } = render(<StepEvidenceLine />)
    expect(container.innerHTML).toBe("")
    rerender(<StepEvidenceLine confidence={null} />)
    expect(container.innerHTML).toBe("")
  })

  it.each(["__proto__", "toString", "constructor", "hasOwnProperty", "bogus"])(
    "renders nothing for the unknown level %s (own() lookup)",
    (level) => {
      const { container } = render(
        <StepEvidenceLine confidence={conf({ level: level as EvidenceLineConfidence["level"] })} />,
      )
      expect(container.innerHTML).toBe("")
    },
  )
})

describe("StepEvidenceLine — the sketch-B words, exactly", () => {
  it("medium reads the winning sentence verbatim", () => {
    render(<StepEvidenceLine confidence={conf()} />)
    const line = screen.getByTestId("step-evidence-line")
    expect(line.textContent).toBe("Answered from Procurement KB · 6 passages · ● Medium · 0.47")
    expect(line.getAttribute("data-level")).toBe("medium")
  })

  it("the glyph is decorative and the score is tabular", () => {
    render(<StepEvidenceLine confidence={conf()} />)
    const glyph = screen.getByText("●")
    expect(glyph.getAttribute("aria-hidden")).toBe("true")
    const score = screen.getByText("· 0.47")
    expect(score.className).toContain("tabular-nums")
  })

  it("one passage is singular", () => {
    render(<StepEvidenceLine confidence={conf({ passages: 1 })} />)
    expect(screen.getByTestId("step-evidence-line").textContent).toBe(
      "Answered from Procurement KB · 1 passage · ● Medium · 0.47",
    )
  })

  it("high reads ✓ High", () => {
    render(<StepEvidenceLine confidence={conf({ level: "high", avg_similarity: 0.71, passages: 9 })} />)
    expect(screen.getByTestId("step-evidence-line").textContent).toBe(
      "Answered from Procurement KB · 9 passages · ✓ High · 0.71",
    )
  })

  it("low reads ⚠ Low and carries the server's disclaimer verbatim on a second line", () => {
    render(
      <StepEvidenceLine
        confidence={conf({ level: "low", avg_similarity: 0.31, passages: 3, disclaimer: DISCLAIMER })}
      />,
    )
    expect(screen.getByTestId("step-evidence-sentence").textContent).toBe(
      "Answered from Procurement KB · 3 passages · ⚠ Low · 0.31",
    )
    expect(screen.getByTestId("step-evidence-note").textContent).toBe(DISCLAIMER)
  })

  it("none reads 'Searched … nothing matched' plus the no-match explanation", () => {
    render(
      <StepEvidenceLine
        confidence={conf({ level: "none", avg_similarity: null, passages: 0 })}
      />,
    )
    expect(screen.getByTestId("step-evidence-sentence").textContent).toBe(
      "Searched Procurement KB · nothing matched · ○ No match found",
    )
    expect(screen.getByTestId("step-evidence-note").textContent).toBe(NO_MATCH_EXPLANATION)
    expect(NO_MATCH_EXPLANATION).toBe(
      "The knowledge base returned nothing for this step — its output is not drawn from the knowledge base.",
    )
  })

  it("a null score drops the score atom rather than printing NaN or 0", () => {
    render(<StepEvidenceLine confidence={conf({ avg_similarity: null })} />)
    expect(screen.getByTestId("step-evidence-line").textContent).toBe(
      "Answered from Procurement KB · 6 passages · ● Medium",
    )
  })

  it("medium and high carry no note line", () => {
    render(<StepEvidenceLine confidence={conf({ disclaimer: "should not show" })} />)
    expect(screen.queryByTestId("step-evidence-note")).toBeNull()
  })

  it("a hostile label renders as text, never as markup", () => {
    const hostile = "<img src=x onerror=alert(1)>"
    const { container } = render(<StepEvidenceLine confidence={conf({ kb_label: hostile })} />)
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByTestId("step-evidence-line").textContent).toContain(hostile)
  })
})

// ── Phase 295-05 (RUN-01 / D-04 / UI-SPEC B.1) — the unsourced arm, asserted by its WORDS ──

const NOTE = "This output was kept without sources — it does not cite any document."
const mark = (continued_by = "Fahad Murad (you)") => ({ continued_by, at: "2026-10-20T12:30:00Z" })

describe("StepEvidenceLine — the unsourced mark (295-05, D-04)", () => {
  it("alone: the chip word, who continued, and the note sentence", () => {
    const { container } = render(<StepEvidenceLine unsourced={mark()} />)
    expect(container.textContent).toBe(
      `◌ Unsourced · continued by Fahad Murad (you)${NOTE}`,
    )
    expect(screen.getByText(/Unsourced/)).toBeTruthy()
    expect(screen.getByText(/continued by/)).toBeTruthy()
    expect(screen.getByText(NOTE)).toBeTruthy()
    expect(screen.queryByTestId("step-evidence-sentence")).toBeNull()
  })

  it("the ◌ glyph is decorative and differs from the no-match ○", () => {
    render(<StepEvidenceLine unsourced={mark()} />)
    const glyph = screen.getByText("◌")
    expect(glyph.getAttribute("aria-hidden")).toBe("true")
    expect("◌").not.toBe("○")
  })

  it("the chip is the bordered amber warning tone, never muted and never red", () => {
    render(<StepEvidenceLine unsourced={mark()} />)
    const chip = screen.getByText("◌").parentElement as HTMLElement
    expect(chip.textContent).toBe("◌ Unsourced")
    expect(chip.className).toContain("bg-[hsl(var(--warning)/0.12)]")
    expect(chip.className).toContain("text-[hsl(var(--warning))]")
    expect(chip.className).toContain("border-[hsl(var(--warning)/0.4)]")
    expect(chip.className).not.toContain("destructive")
    expect(screen.getByText(NOTE).className).toContain("italic")
  })

  it("with a confidence object the confidence sentence comes FIRST and the mark below it", () => {
    const { container } = render(
      <StepEvidenceLine confidence={conf({ level: "none", avg_similarity: null, passages: 0 })}
        unsourced={mark("the person who started this run")} />,
    )
    const text = container.textContent ?? ""
    const at = text.indexOf("Searched Procurement KB · nothing matched · ○ No match found")
    const markAt = text.indexOf("◌ Unsourced · continued by the person who started this run")
    expect(at).toBe(0)
    expect(markAt).toBeGreaterThan(at)
    expect(text.indexOf(NOTE)).toBeGreaterThan(markAt)
  })

  it("the confidence arm is byte-unchanged when there is no mark", () => {
    const { container: a } = render(<StepEvidenceLine confidence={conf()} />)
    const before = a.innerHTML
    cleanup()
    const { container: b } = render(<StepEvidenceLine confidence={conf()} unsourced={null} />)
    expect(b.innerHTML).toBe(before)
    expect(b.textContent).not.toContain("Unsourced")
  })

  it("neither present renders nothing", () => {
    const { container } = render(<StepEvidenceLine confidence={null} unsourced={null} />)
    expect(container.innerHTML).toBe("")
  })

  it("a hostile name renders as text, never as markup", () => {
    const hostile = "<img src=x onerror=alert(1)>"
    const { container } = render(<StepEvidenceLine unsourced={mark(hostile)} />)
    expect(container.querySelector("img")).toBeNull()
    expect(container.textContent).toContain(`continued by ${hostile}`)
  })
})
