/**
 * Phase 075.6 Plan 03 / Req #7 — step-list collapse + iteration-divider
 * preservation tests for ToolCallPanel.
 *
 * Updated for Phase 075.8 Task 4 (sketch 001 D3 — Focus Mode):
 *   The prior single aggregate "Show N earlier steps" summary row
 *   (data-testid="collapsed-steps-summary") is replaced by per-step
 *   inline result-summary rows (data-testid="step-summary-row"), one
 *   per collapsed past step. The iteration-divider preservation
 *   invariant (Pitfall 6 / Landmine L5) is unchanged.
 *
 * Covers three invariants:
 *   1. 5 done + 1 active across iter-0+iter-1+iter-2 → collapsed view
 *      renders 5 per-step summary rows + the active step row; the
 *      iteration divider above the active step still fires because
 *      prevToolIteration is derived from the LAST collapsed item
 *      (Pitfall 6 / Landmine L5 mitigation).
 *   2. Clicking any per-step summary row expands to all 6 tool rows
 *      with EXACTLY 2 iteration dividers (iter-0 → iter-1, iter-1 → iter-2).
 *   3. Fewer than 3 completed tool calls preceding the active step →
 *      no collapse; all rows render individually; per-step summary
 *      rows absent.
 */
import { describe, it, expect } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ToolCallPanel } from "@/components/chat/ToolCallPanel"
import type { ToolCall } from "@/types"

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

function mkDoneTool(overrides: Partial<ToolCall> & { id: string; iteration: number }): ToolCall {
  return {
    name: "search_documents",
    args: { query: `q-${overrides.id}` },
    status: "done",
    result: JSON.stringify([]),
    startedAt: 1_000_000 + Number(overrides.id.replace(/\D/g, "")) * 100,
    endedAt: 1_000_000 + Number(overrides.id.replace(/\D/g, "")) * 100 + 50,
    ...overrides,
  } as ToolCall
}

function mkActiveTool(overrides: Partial<ToolCall> & { id: string; iteration: number }): ToolCall {
  return {
    name: "search_documents",
    args: { query: `q-${overrides.id}` },
    status: "running",
    startedAt: 1_000_000 + Number(overrides.id.replace(/\D/g, "")) * 100,
    ...overrides,
  } as ToolCall
}

describe("ToolCallPanel — 075.6 Req #7 + 075.8 Task 4 step-list Focus Mode", () => {
  it("collapses 5 done + 1 active (iter-0+iter-1+iter-2) into 5 per-step summary rows + active row by default", () => {
    const toolCalls: ToolCall[] = [
      mkDoneTool({ id: "t1", iteration: 0 }),
      mkDoneTool({ id: "t2", iteration: 0 }),
      mkDoneTool({ id: "t3", iteration: 0 }),
      mkDoneTool({ id: "t4", iteration: 1 }),
      mkDoneTool({ id: "t5", iteration: 1 }),
      mkActiveTool({ id: "t6", iteration: 2 }),
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // Phase 075.8 Task 4: exactly 5 per-step summary rows replace the
    // 5 collapsed completed items (1 row each, not 1 aggregate row).
    const summaries = container.querySelectorAll("[data-testid='step-summary-row']")
    expect(summaries.length).toBe(5)
    // First row carries the iteration-min hint so future readers can see the
    // collapse window boundary without re-deriving it.
    expect(summaries[0]?.getAttribute("data-iteration-min")).toBe("0")

    // The old aggregate row no longer exists.
    expect(container.querySelectorAll("[data-testid='collapsed-steps-summary']").length).toBe(0)

    // The iteration divider above the active step (iter-2) still fires
    // because prevToolIteration is derived from the LAST collapsed item
    // (iter-1). Pitfall 6 / L5 — the iter-N → iter-(N+1) boundary survives
    // the per-step-summary collapse.
    const dividers = container.querySelectorAll("[data-testid='iteration-divider']")
    expect(dividers.length).toBe(1)
    expect(dividers[0]?.getAttribute("data-iteration")).toBe("2")
  })

  it("clicking a per-step summary row expands to all 6 rows with EXACTLY 2 iteration dividers", () => {
    const toolCalls: ToolCall[] = [
      mkDoneTool({ id: "t1", iteration: 0 }),
      mkDoneTool({ id: "t2", iteration: 0 }),
      mkDoneTool({ id: "t3", iteration: 0 }),
      mkDoneTool({ id: "t4", iteration: 1 }),
      mkDoneTool({ id: "t5", iteration: 1 }),
      mkActiveTool({ id: "t6", iteration: 2 }),
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // Pre-click: 5 summary rows present.
    expect(container.querySelectorAll("[data-testid='step-summary-row']").length).toBe(5)

    // Click the first summary row to expand.
    const firstSummary = container.querySelector("[data-testid='step-summary-row']") as HTMLButtonElement | null
    expect(firstSummary).toBeTruthy()
    fireEvent.click(firstSummary!)

    // Post-click: per-step summary rows gone, all 6 tool items render.
    expect(container.querySelectorAll("[data-testid='step-summary-row']").length).toBe(0)

    // EXACTLY 2 iteration dividers in expanded view:
    //   between rows 3-4 (iter-0 → iter-1 boundary)
    //   between rows 5-6 (iter-1 → iter-2 boundary)
    // D-067-03 invariant: NEVER a divider above the first item.
    const dividers = container.querySelectorAll("[data-testid='iteration-divider']")
    expect(dividers.length).toBe(2)
    const iterations = Array.from(dividers).map((d) => d.getAttribute("data-iteration"))
    expect(iterations).toEqual(["1", "2"])
  })

  it("does NOT collapse when fewer than 3 completed tool calls precede the active step", () => {
    const toolCalls: ToolCall[] = [
      mkDoneTool({ id: "t1", iteration: 0 }),
      mkDoneTool({ id: "t2", iteration: 0 }),
      mkActiveTool({ id: "t3", iteration: 0 }),
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // No per-step summary rows (collapse threshold N=3 not met).
    expect(container.querySelectorAll("[data-testid='step-summary-row']").length).toBe(0)
    // And no legacy aggregate row either.
    expect(container.querySelectorAll("[data-testid='collapsed-steps-summary']").length).toBe(0)

    // No iteration dividers (all 3 share iteration 0).
    expect(container.querySelectorAll("[data-testid='iteration-divider']").length).toBe(0)
  })
})
