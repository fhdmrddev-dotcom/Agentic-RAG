/**
 * Phase 123 Plan 05 Task 2a (TRIG-01) — ProviderScoreboard + CandidateCard tests.
 *
 * The load-bearing, no-analog contract (sketch 042-A provider-set adaptivity band +
 * RESEARCH Pattern 4). These assertions are the ORDERING GATE for Task 2b — they MUST
 * be GREEN before the case-editor / live-run compose proceeds.
 *
 * ProviderScoreboard (T-123-05-01 honesty):
 *  - N-column = the org's configured targets: a 3-provider set renders EXACTLY 3
 *    columns; a 1-provider set renders ONE column with NO "degraded"/"missing"
 *    affordance (single-provider is the CLEAN baseline, not a degraded mode).
 *  - a provider NOT in the target set NEVER renders (a score you can't act on is a
 *    fabricated measurement).
 *  - EVERY cell shows BOTH a fires (should-trigger recall) AND a no-false (should-NOT
 *    precision) sub-score — neither hidden to hover / a hidden aggregate.
 *  - OpenRouter and a native provider (zhipu / z-ai) render as DISTINCT columns.
 *
 * CandidateCard (T-123-05-02 author-confirm, no auto-apply):
 *  - shows the candidate's held-out score.
 *  - selecting "Use" reveals an explicit diff-confirm strip (old vs new); confirming
 *    calls onConfirm (which wraps updateSkill) — nothing auto-applies.
 */
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { ProviderScoreboard } from "./ProviderScoreboard"
import type { TunerCell } from "@/lib/api"

function cell(provider: string, model: string, fires: number, noFalse: number, score: number): TunerCell {
  return { provider, model, axes: { fires, no_false: noFalse }, score, measured: true, error_count: 0 }
}

/** An UNMEASURED cell (123.1-06 sentinel): every classify call raised → measured:false,
 *  score:null, both axes null, a positive error_count. TT-12 render half (Plan 08 Task 1). */
function unmeasuredCell(provider: string, model: string, errorCount: number): TunerCell {
  return {
    provider,
    model,
    axes: { fires: null, no_false: null },
    score: null,
    measured: false,
    error_count: errorCount,
  }
}

describe("ProviderScoreboard — N-column provider-set adaptivity (042-A)", () => {
  it("a 3-provider target set renders EXACTLY 3 columns", () => {
    const cells = [
      cell("openai", "gpt-5.4-mini", 0.9, 0.85, 0.875),
      cell("anthropic", "claude-haiku-4-5", 0.95, 0.9, 0.925),
      cell("google", "gemini-3.5-flash", 0.8, 0.75, 0.775),
    ]
    render(<ProviderScoreboard cells={cells} />)
    const columns = screen.getAllByTestId("scoreboard-cell")
    expect(columns).toHaveLength(3)
  })

  it("a 1-provider target set renders ONE column with NO degraded/missing affordance (clean baseline)", () => {
    const cells = [cell("anthropic", "claude-haiku-4-5", 0.92, 0.88, 0.9)]
    render(<ProviderScoreboard cells={cells} />)
    const columns = screen.getAllByTestId("scoreboard-cell")
    expect(columns).toHaveLength(1)
    // single-provider is the CLEAN baseline — never a degraded / missing label.
    const board = screen.getByTestId("provider-scoreboard")
    expect(board.textContent).not.toMatch(/degraded/i)
    expect(board.textContent).not.toMatch(/missing/i)
    expect(board.textContent).not.toMatch(/unavailable/i)
  })

  it("a provider NOT in the target set never renders (no fabricated column)", () => {
    const cells = [
      cell("openai", "gpt-5.4-mini", 0.9, 0.85, 0.875),
      cell("anthropic", "claude-haiku-4-5", 0.95, 0.9, 0.925),
    ]
    render(<ProviderScoreboard cells={cells} />)
    const board = screen.getByTestId("provider-scoreboard")
    // google was never a target → its label must not appear anywhere.
    expect(board.textContent?.toLowerCase()).not.toContain("google")
    expect(board.textContent?.toLowerCase()).not.toContain("gemini")
    expect(screen.getAllByTestId("scoreboard-cell")).toHaveLength(2)
  })

  it("EVERY cell shows BOTH a fires AND a no-false sub-score (never a hidden aggregate)", () => {
    const cells = [
      cell("openai", "gpt-5.4-mini", 0.9, 0.85, 0.875),
      cell("anthropic", "claude-haiku-4-5", 0.95, 0.9, 0.925),
    ]
    render(<ProviderScoreboard cells={cells} />)
    for (const el of screen.getAllByTestId("scoreboard-cell")) {
      // both sub-scores are LABELED in each cell (the false-fire rail is never hidden).
      expect(within(el).getByTestId("cell-fires")).toBeTruthy()
      expect(within(el).getByTestId("cell-no-false")).toBeTruthy()
      expect(el.textContent?.toLowerCase()).toContain("fires")
      expect(el.textContent?.toLowerCase()).toContain("no-false")
    }
  })

  it("OpenRouter and a native provider (z-ai / zhipu) render as DISTINCT columns", () => {
    const cells = [
      cell("openrouter", "z-ai/glm-5.1", 0.7, 0.6, 0.65),
      cell("zhipu", "glm-5.1", 0.85, 0.8, 0.825),
    ]
    render(<ProviderScoreboard cells={cells} />)
    const columns = screen.getAllByTestId("scoreboard-cell")
    expect(columns).toHaveLength(2)
    const board = screen.getByTestId("provider-scoreboard")
    expect(board.textContent?.toLowerCase()).toContain("openrouter")
    expect(board.textContent?.toLowerCase()).toContain("zhipu")
  })
})

describe("ProviderScoreboard — D-02/D-12 vertical rows + magnitude bar + combined score", () => {
  it("renders as a vertical flex-column container, NOT a fixed repeat(N,1fr) horizontal grid", () => {
    const cells = [
      cell("openai", "gpt-5.4-mini", 0.9, 0.85, 0.875),
      cell("anthropic", "claude-haiku-4-5", 0.95, 0.9, 0.925),
    ]
    render(<ProviderScoreboard cells={cells} />)
    const board = screen.getByTestId("provider-scoreboard")
    // vertical rows — the container is a flex column, never a repeat(N,1fr) grid.
    expect(board.className).toContain("flex-col")
    expect(board.getAttribute("style") ?? "").not.toContain("repeat(")
  })

  it("8 cells render 8 legible vertical rows (no horizontal cram)", () => {
    const cells = [
      cell("openai", "gpt-5.4-mini", 0.9, 0.85, 0.875),
      cell("anthropic", "claude-haiku-4-5", 0.95, 0.9, 0.925),
      cell("google", "gemini-3.5-flash", 0.8, 0.75, 0.775),
      cell("openrouter", "z-ai/glm-5.1", 0.7, 0.6, 0.65),
      cell("zhipu", "glm-5.1", 0.85, 0.8, 0.825),
      cell("moonshot", "kimi-k2", 0.6, 0.55, 0.575),
      cell("minimax", "minimax-m3", 0.5, 0.45, 0.475),
      cell("deepseek", "deepseek-v3", 0.65, 0.7, 0.675),
    ]
    render(<ProviderScoreboard cells={cells} />)
    expect(screen.getAllByTestId("scoreboard-cell")).toHaveLength(8)
    // every row carries a magnitude bar — 8 rows → 8 bars.
    expect(screen.getAllByTestId("scoreboard-bar")).toHaveLength(8)
  })

  it("each row renders a magnitude bar whose width is derived from the server cell.score", () => {
    const cells = [cell("openai", "gpt-5.4-mini", 0.9, 0.8, 0.42)]
    render(<ProviderScoreboard cells={cells} />)
    const bar = screen.getByTestId("scoreboard-bar")
    // the inner fill width is score * 100% — driven by the server combined score, never recomputed.
    const fill = bar.querySelector("[data-testid='scoreboard-bar-fill']") as HTMLElement
    expect(fill).toBeTruthy()
    expect(fill.style.width).toBe("42%")
  })

  it("renders the leading combined-score number (cell.score) per row", () => {
    const cells = [cell("anthropic", "claude-haiku-4-5", 0.95, 0.9, 0.93)]
    render(<ProviderScoreboard cells={cells} />)
    const scoreEl = screen.getByTestId("cell-score")
    // the leading number is the server-computed combined score, 2dp.
    expect(scoreEl.textContent).toContain("0.93")
  })

  it("KEEPS both honest sub-scores (fires + no-false) visible on every row alongside the bar", () => {
    const cells = [
      cell("openai", "gpt-5.4-mini", 0.9, 0.85, 0.875),
      cell("anthropic", "claude-haiku-4-5", 0.95, 0.9, 0.925),
    ]
    render(<ProviderScoreboard cells={cells} />)
    for (const row of screen.getAllByTestId("scoreboard-cell")) {
      expect(within(row).getByTestId("cell-fires")).toBeTruthy()
      expect(within(row).getByTestId("cell-no-false")).toBeTruthy()
      // the bar is a SIBLING of the honest sub-scores — never replacing them.
      expect(within(row).getByTestId("scoreboard-bar")).toBeTruthy()
    }
  })
})

describe("ProviderScoreboard — TT-12 honest unmeasured-cell render (Plan 08 Task 1)", () => {
  it("renders an unmeasured cell (measured:false / score:null) as 'could not measure' — never a fabricated number, bar, or sub-score", () => {
    const cells = [
      cell("openai", "gpt-5.4-mini", 0.9, 0.85, 0.875), // a MEASURED cell
      unmeasuredCell("moonshot", "kimi-k2", 9), // an all-error UNMEASURED cell
    ]
    render(<ProviderScoreboard cells={cells} />)

    const rows = screen.getAllByTestId("scoreboard-cell")
    expect(rows).toHaveLength(2)

    // The measured cell still shows its number + bar + both sub-scores.
    const measuredRow = rows.find((r) => r.textContent?.toLowerCase().includes("openai"))!
    expect(within(measuredRow).getByTestId("cell-score").textContent).toContain("0.88")
    expect(within(measuredRow).getByTestId("scoreboard-bar")).toBeTruthy()
    expect(within(measuredRow).queryByTestId("cell-unmeasured")).toBeNull()

    // The unmeasured cell renders the honest label — and does NOT render a numeric score,
    // a magnitude bar, or fires/no-false sub-scores (the exact fabrication TT-12 closes).
    const unmeasuredRow = rows.find((r) => r.textContent?.toLowerCase().includes("moonshot"))!
    expect(within(unmeasuredRow).getByTestId("cell-unmeasured")).toBeTruthy()
    expect(unmeasuredRow.textContent?.toLowerCase()).toContain("could not measure")
    expect(within(unmeasuredRow).queryByTestId("cell-score")).toBeNull()
    expect(within(unmeasuredRow).queryByTestId("scoreboard-bar")).toBeNull()
    expect(within(unmeasuredRow).queryByTestId("cell-fires")).toBeNull()
    expect(within(unmeasuredRow).queryByTestId("cell-no-false")).toBeNull()
    // provider·model is KEPT so the author sees WHICH column failed.
    expect(unmeasuredRow.textContent?.toLowerCase()).toContain("moonshot")
    expect(unmeasuredRow.textContent?.toLowerCase()).toContain("kimi-k2")
    // and the failure count is surfaced honestly.
    expect(unmeasuredRow.textContent).toContain("9")
  })

  it("renders an individually-null axis (one axis had no cases) as 'n/a' on an otherwise-measured cell", () => {
    // A cell measured on no-false but with NO should-fire cases: fires axis is null, but the
    // cell is still measured (score present) — it renders normally with 'n/a' for the empty axis.
    const cells: TunerCell[] = [
      {
        provider: "anthropic",
        model: "claude-haiku-4-5",
        axes: { fires: null, no_false: 0.9 },
        score: 0.9,
        measured: true,
        error_count: 0,
      },
    ]
    render(<ProviderScoreboard cells={cells} />)
    const row = screen.getByTestId("scoreboard-cell")
    // Still a measured row (no "could not measure"), with the empty axis honestly "n/a".
    expect(screen.queryByTestId("cell-unmeasured")).toBeNull()
    expect(within(row).getByTestId("cell-fires").textContent?.toLowerCase()).toContain("n/a")
    expect(within(row).getByTestId("cell-no-false").textContent).toContain("0.90")
  })
})
