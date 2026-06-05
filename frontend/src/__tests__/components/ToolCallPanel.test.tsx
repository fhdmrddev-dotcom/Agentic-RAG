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

describe("ToolCallPanel — Phase 095 Plan 03 Task 2: StepRail + Round-N divider", () => {
  it("renders the divider as 'Round N', never 'Step N' (D-04 relabel)", () => {
    // 3 done across iter-0 + 1 done in iter-1 + active iter-2 → 2 dividers
    // (iter-0→1, iter-1→2). The divider label must read "Round N".
    const toolCalls: ToolCall[] = [
      mkDoneTool({ id: "t1", iteration: 0 }),
      mkDoneTool({ id: "t2", iteration: 0 }),
      mkDoneTool({ id: "t3", iteration: 1 }),
      mkActiveTool({ id: "t4", iteration: 2 }),
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)
    // With 3 done before the active step, Focus Mode collapses past steps; the
    // divider above the active step still fires (Pitfall 6 / L5). Expand to see
    // both dividers.
    const summary = container.querySelector("[data-testid='step-summary-row']") as HTMLButtonElement | null
    if (summary) fireEvent.click(summary)

    const dividers = container.querySelectorAll("[data-testid='iteration-divider']")
    expect(dividers.length).toBeGreaterThanOrEqual(1)
    dividers.forEach((d) => {
      expect(d.textContent).toMatch(/Round \d+/)
      expect(d.textContent).not.toMatch(/Step \d+/)
    })
  })

  it("renders each deduped tool on a numbered status-node rail (snum + node)", () => {
    const toolCalls: ToolCall[] = [
      mkDoneTool({ id: "t1", iteration: 0 }),
      mkDoneTool({ id: "t2", iteration: 0 }),
      mkActiveTool({ id: "t3", iteration: 0 }),
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)
    // One rail node + one snum per deduped tool (3 tools → 3 of each).
    const nodes = container.querySelectorAll("[data-testid='step-node']")
    const snums = container.querySelectorAll("[data-testid='step-snum']")
    expect(nodes.length).toBe(3)
    expect(snums.length).toBe(3)
    // Numbering is 1-based and sequential.
    const numbers = Array.from(snums).map((s) => s.textContent)
    expect(numbers).toEqual(["1", "2", "3"])
    // The running tool's node is the ACTIVE state; the done tools are done.
    const states = Array.from(nodes).map((n) => n.getAttribute("data-node-state"))
    expect(states).toEqual(["done", "done", "active"])
  })

  it("dedups the rail: two snapshots of the same logical tool render ONE numbered row (D-05 structural)", () => {
    const stableClientKey = "anthropic|msg-1|search_documents|1700000000000|0"
    const toolCalls: ToolCall[] = [
      {
        name: "search_documents",
        id: "tu_a",
        clientKey: stableClientKey,
        args: { query: "x" },
        status: "preparing",
        iteration: 0,
      } as ToolCall,
      {
        name: "search_documents",
        id: "tu_b", // provider mutated the id
        clientKey: stableClientKey,
        args: { query: "x" },
        status: "running",
        startedAt: 1_700_000_000_500,
        iteration: 0,
      } as ToolCall,
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)
    // Shared dedup collapses them → exactly ONE rail node/snum (no dup row).
    expect(container.querySelectorAll("[data-testid='step-node']").length).toBe(1)
    expect(container.querySelectorAll("[data-testid='step-snum']")[0]?.textContent).toBe("1")
  })
})

describe("ToolCallPanel — Phase 075.9 T3 clientKey dedup", () => {
  // The defect this guards against (the "felt-experience" sub-agent dup):
  //
  //   On Anthropic + OpenRouter, the provider can mutate `tc.id` across
  //   the preparing→running transition. Two consecutive snapshots of the
  //   same logical tool then carry DIFFERENT `tc.id` values. The old
  //   dedup key `tc.id || ${name}-${startedAt}-${idx}` saw them as
  //   distinct → both cards rendered mid-stream.
  //
  //   The fix (T3): `deduplicatedToolCalls` now keys on `tc.clientKey ??
  //   tc.id ?? fallback`. The streams store stamps clientKey at first
  //   observation and never mutates it (see T2 regression test).
  //
  //   This test simulates the buggy provider directly: feed two tool
  //   entries with DIFFERENT `tc.id` values but the SAME `tc.clientKey`,
  //   asserting the dedup pass renders exactly ONE card across both.

  it("dedupes two snapshots of the same logical tool when tc.id differs but tc.clientKey is stable", () => {
    // Simulate the mid-stream state during the preparing→running flip:
    // the reducer would normally consolidate this into a single entry
    // via the spread, but if a parent snapshot pushed both states (rare
    // but observed on OpenRouter retry) the dedup pass MUST collapse them.
    const stableClientKey = "anthropic|msg-1|analyze_document|1700000000000|0"
    const toolCalls: ToolCall[] = [
      // Snapshot 1: preparing entry with provider id "tu_abc"
      {
        name: "analyze_document",
        id: "tu_abc",
        clientKey: stableClientKey,
        args: { document_id: "doc-1" },
        status: "preparing",
        iteration: 0,
      } as ToolCall,
      // Snapshot 2: running entry — provider mutated the id to "tu_def"
      // BUT the clientKey is still the stamped-at-creation value.
      {
        name: "analyze_document",
        id: "tu_def",
        clientKey: stableClientKey,
        args: { document_id: "doc-1" },
        status: "running",
        startedAt: 1_700_000_000_500,
        iteration: 0,
      } as ToolCall,
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // Exactly ONE rendered card for the analyze_document tool. Pre-T3,
    // the dedup loop would key on the two different tc.id values and
    // render both → the visible sub-agent-card dup defect.
    const rows = container.querySelectorAll("[data-testid='tc-active']")
    expect(rows.length).toBe(1)
  })

  it("falls back to tc.id when clientKey is missing (back-compat for DB-loaded historical messages)", () => {
    // DB-loaded historical tool calls don't have a clientKey stamp.
    // The fallback chain (clientKey > id > composite) must keep them
    // rendering. Two same-id entries STILL dedup to one (pre-existing
    // 075.1 / 075.2 behavior).
    const toolCalls: ToolCall[] = [
      {
        name: "execute_code",
        id: "tu_legacy_1",
        args: { code: "print(1)" },
        status: "done",
        result: JSON.stringify({ stdout: "1", exit_code: 0 }),
        startedAt: 1_700_000_000_000,
        endedAt: 1_700_000_000_100,
        iteration: 0,
      } as ToolCall,
      {
        // Duplicate of the same DB-loaded entry — provider replayed it.
        name: "execute_code",
        id: "tu_legacy_1",
        args: { code: "print(1)" },
        status: "done",
        result: JSON.stringify({ stdout: "1", exit_code: 0 }),
        startedAt: 1_700_000_000_000,
        endedAt: 1_700_000_000_100,
        iteration: 0,
      } as ToolCall,
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)
    // Exactly one execute_code body rendered (the execute_code body has a
    // tc-editor inset only when args.code is present — both entries have
    // it, but dedup should leave only one).
    const editors = container.querySelectorAll("[data-testid='tc-editor']")
    expect(editors.length).toBe(1)
  })
})
