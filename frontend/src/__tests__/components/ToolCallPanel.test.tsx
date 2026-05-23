/**
 * Phase 075.6 Plan 03 / Req #7 — step-list collapse + iteration-divider
 * preservation tests for ToolCallPanel.
 *
 * Covers three invariants:
 *   1. 5 done + 1 active across iter-0+iter-1+iter-2 → collapsed view renders
 *      1 summary row (data-testid="collapsed-steps-summary") + active step;
 *      the iteration divider above the active step still fires because
 *      prevToolIteration is derived from the LAST collapsed item (Pitfall 6 /
 *      Landmine L5 mitigation).
 *   2. Clicking the summary chevron expands to all 6 tool rows with EXACTLY
 *      2 iteration dividers (iter-0 → iter-1 between rows 3-4, iter-1 → iter-2
 *      between rows 5-6).
 *   3. Fewer than 3 completed tool calls preceding the active step → no
 *      collapse; all rows render individually; summary row absent.
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
    id: overrides.id,
    name: "search_documents",
    args: { query: `q-${overrides.id}` },
    status: "done",
    result: JSON.stringify([]),
    startedAt: 1_000_000 + Number(overrides.id.replace(/\D/g, "")) * 100,
    endedAt: 1_000_000 + Number(overrides.id.replace(/\D/g, "")) * 100 + 50,
    iteration: overrides.iteration,
    ...overrides,
  }
}

function mkActiveTool(overrides: Partial<ToolCall> & { id: string; iteration: number }): ToolCall {
  return {
    id: overrides.id,
    name: "search_documents",
    args: { query: `q-${overrides.id}` },
    status: "running",
    startedAt: 1_000_000 + Number(overrides.id.replace(/\D/g, "")) * 100,
    iteration: overrides.iteration,
    ...overrides,
  }
}

describe("ToolCallPanel — 075.6 Req #7 step-list collapse", () => {
  it("collapses 5 done + 1 active (iter-0+iter-1+iter-2) into a summary row + active row by default", () => {
    const toolCalls: ToolCall[] = [
      mkDoneTool({ id: "t1", iteration: 0 }),
      mkDoneTool({ id: "t2", iteration: 0 }),
      mkDoneTool({ id: "t3", iteration: 0 }),
      mkDoneTool({ id: "t4", iteration: 1 }),
      mkDoneTool({ id: "t5", iteration: 1 }),
      mkActiveTool({ id: "t6", iteration: 2 }),
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // Exactly 1 summary row in place of the 5 collapsed completed items.
    const summaries = container.querySelectorAll("[data-testid='collapsed-steps-summary']")
    expect(summaries.length).toBe(1)
    expect(summaries[0]?.getAttribute("data-iteration-min")).toBe("0")

    // The iteration divider above the active step (iter-2) still fires because
    // prevToolIteration is derived from the LAST collapsed item (iter-1).
    // Pitfall 6 / L5: the iter-N → iter-(N+1) boundary survives the collapse.
    const dividers = container.querySelectorAll("[data-testid='iteration-divider']")
    expect(dividers.length).toBe(1)
    expect(dividers[0]?.getAttribute("data-iteration")).toBe("2")
  })

  it("clicking the summary chevron expands to all 6 rows with EXACTLY 2 iteration dividers", () => {
    const toolCalls: ToolCall[] = [
      mkDoneTool({ id: "t1", iteration: 0 }),
      mkDoneTool({ id: "t2", iteration: 0 }),
      mkDoneTool({ id: "t3", iteration: 0 }),
      mkDoneTool({ id: "t4", iteration: 1 }),
      mkDoneTool({ id: "t5", iteration: 1 }),
      mkActiveTool({ id: "t6", iteration: 2 }),
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // Pre-click: collapsed (summary row present).
    expect(container.querySelectorAll("[data-testid='collapsed-steps-summary']").length).toBe(1)

    // Click the summary chevron to expand.
    const summaryButton = container.querySelector("[data-testid='collapsed-steps-summary'] button") as HTMLButtonElement | null
    expect(summaryButton).toBeTruthy()
    fireEvent.click(summaryButton!)

    // Post-click: summary row gone, all 6 tool items render.
    expect(container.querySelectorAll("[data-testid='collapsed-steps-summary']").length).toBe(0)

    // EXACTLY 2 iteration dividers in expanded view:
    //   between rows 3-4 (iter-0 → iter-1 boundary)
    //   between rows 5-6 (iter-1 → iter-2 boundary)
    // D-067-03 invariant: NEVER a divider above the first item (no divider for i === 0).
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

    // No summary row.
    expect(container.querySelectorAll("[data-testid='collapsed-steps-summary']").length).toBe(0)

    // No iteration dividers (all 3 share iteration 0).
    expect(container.querySelectorAll("[data-testid='iteration-divider']").length).toBe(0)
  })
})
