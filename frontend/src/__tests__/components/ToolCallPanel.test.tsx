/**
 * Phase 075.6 Plan 03 / Req #7 — step-list collapse + iteration-divider
 * preservation tests for ToolCallPanel.
 *
 * Updated for Phase 095 Plan 06 (GAP-095-01 fold-all + GAP-095-03 un-gate):
 *   The prior single shared `stepsCollapsed` boolean — where ONE click on any
 *   collapsed summary row expanded ALL finished cards (the #1 felt bug) — is
 *   replaced by a per-step `expandedSteps` Set keyed on the same `stepKeyOf`
 *   identity the rail/dedup use. Expanding ONE finished essence row reveals
 *   ONLY that row's body; the others stay one-line essence rows. The >=3
 *   collapse gate is gone — EVERY finished step before the active one folds to
 *   an essence row (Focus Mode from step 1). Each expanded earlier step can
 *   re-fold independently (the Set shrinks for that key only). The
 *   iteration-divider preservation invariant (Pitfall 6 / Landmine L5) is
 *   unchanged.
 *
 * Covers the per-step invariants:
 *   1. 5 done + 1 active across iter-0+iter-1+iter-2 → 5 per-step essence
 *      rows + the active step row; the iteration divider above the active
 *      step still fires (prevToolIteration from the LAST collapsed item).
 *   2. Clicking ONE essence row expands ONLY that row's body — the other
 *      essence rows stay folded (closes GAP-095-01).
 *   3. Clicking a second essence row expands it too; the first stays expanded
 *      (the Set grows).
 *   4. A single finished step before the active tool STILL folds to an
 *      essence row (proves the >=3 un-gate, GAP-095-03).
 *   5. A per-row re-collapse affordance returns one expanded row to its
 *      essence (the Set shrinks for that key only).
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

describe("ToolCallPanel — 095 Plan 06 per-step expand (GAP-095-01 + un-gate)", () => {
  it("folds 5 done + 1 active into 5 per-step essence rows + active row by default", () => {
    const toolCalls: ToolCall[] = [
      mkDoneTool({ id: "t1", iteration: 0 }),
      mkDoneTool({ id: "t2", iteration: 0 }),
      mkDoneTool({ id: "t3", iteration: 0 }),
      mkDoneTool({ id: "t4", iteration: 1 }),
      mkDoneTool({ id: "t5", iteration: 1 }),
      mkActiveTool({ id: "t6", iteration: 2 }),
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // 5 per-step essence rows for the finished steps before the active one.
    const summaries = container.querySelectorAll("[data-testid='step-summary-row']")
    expect(summaries.length).toBe(5)
    // First still-collapsed row carries the iteration-min hint.
    expect(summaries[0]?.getAttribute("data-iteration-min")).toBe("0")

    // The old aggregate row no longer exists.
    expect(container.querySelectorAll("[data-testid='collapsed-steps-summary']").length).toBe(0)

    // The iteration divider above the active step (iter-2) still fires because
    // prevToolIteration is derived from the LAST collapsed item (iter-1).
    const dividers = container.querySelectorAll("[data-testid='iteration-divider']")
    expect(dividers.length).toBe(1)
    expect(dividers[0]?.getAttribute("data-iteration")).toBe("2")
  })

  it("expands ONLY the clicked essence row — the others stay folded (GAP-095-01)", () => {
    const toolCalls: ToolCall[] = [
      mkDoneTool({ id: "t1", iteration: 0 }),
      mkDoneTool({ id: "t2", iteration: 0 }),
      mkDoneTool({ id: "t3", iteration: 0 }),
      mkDoneTool({ id: "t4", iteration: 1 }),
      mkDoneTool({ id: "t5", iteration: 1 }),
      mkActiveTool({ id: "t6", iteration: 2 }),
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // Pre-click: 5 essence rows present.
    expect(container.querySelectorAll("[data-testid='step-summary-row']").length).toBe(5)

    // Click the FIRST essence row.
    const firstSummary = container.querySelector("[data-testid='step-summary-row']") as HTMLButtonElement | null
    expect(firstSummary).toBeTruthy()
    fireEvent.click(firstSummary!)

    // Post-click: only ONE row expanded → 4 essence rows remain (the others
    // stay folded). This is the core fold-all fix: NOT all 5 expand.
    expect(container.querySelectorAll("[data-testid='step-summary-row']").length).toBe(4)
  })

  it("clicking a second essence row expands it too; the first stays expanded (the Set grows)", () => {
    const toolCalls: ToolCall[] = [
      mkDoneTool({ id: "t1", iteration: 0 }),
      mkDoneTool({ id: "t2", iteration: 0 }),
      mkDoneTool({ id: "t3", iteration: 0 }),
      mkDoneTool({ id: "t4", iteration: 1 }),
      mkDoneTool({ id: "t5", iteration: 1 }),
      mkActiveTool({ id: "t6", iteration: 2 }),
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // Expand the first essence row → 4 remain.
    fireEvent.click(container.querySelector("[data-testid='step-summary-row']") as HTMLButtonElement)
    expect(container.querySelectorAll("[data-testid='step-summary-row']").length).toBe(4)

    // Expand the next still-folded essence row → 3 remain (both stay expanded).
    fireEvent.click(container.querySelector("[data-testid='step-summary-row']") as HTMLButtonElement)
    expect(container.querySelectorAll("[data-testid='step-summary-row']").length).toBe(3)
  })

  it("folds a SINGLE finished step before the active tool — proves the >=3 un-gate (GAP-095-03)", () => {
    const toolCalls: ToolCall[] = [
      mkDoneTool({ id: "t1", iteration: 0 }),
      mkActiveTool({ id: "t2", iteration: 0 }),
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // 1 finished step → it STILL folds to an essence row (no >=3 gate).
    expect(container.querySelectorAll("[data-testid='step-summary-row']").length).toBe(1)
  })

  it("re-collapses one expanded earlier step back to its essence (the Set shrinks for that key only)", () => {
    const toolCalls: ToolCall[] = [
      mkDoneTool({ id: "t1", iteration: 0 }),
      mkDoneTool({ id: "t2", iteration: 0 }),
      mkActiveTool({ id: "t3", iteration: 0 }),
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // 2 finished steps fold (un-gated).
    expect(container.querySelectorAll("[data-testid='step-summary-row']").length).toBe(2)

    // Expand the first → 1 essence row remains, and a per-row re-collapse
    // control appears for the expanded step.
    fireEvent.click(container.querySelector("[data-testid='step-summary-row']") as HTMLButtonElement)
    expect(container.querySelectorAll("[data-testid='step-summary-row']").length).toBe(1)
    const recollapse = container.querySelector("[data-testid='step-recollapse']") as HTMLButtonElement | null
    expect(recollapse).toBeTruthy()

    // Click the re-collapse control → the row folds back to its essence (2 again).
    fireEvent.click(recollapse!)
    expect(container.querySelectorAll("[data-testid='step-summary-row']").length).toBe(2)
  })
})

describe("ToolCallPanel — 095 Plan 06 Task 2: single essence line for finished cards", () => {
  it("rests a finished (all-done) card as ONE essence row — result, not args + separate result", () => {
    // No active tool → activeIndex === -1 → the all-done / reload case.
    const toolCalls: ToolCall[] = [
      mkDoneTool({ id: "t1", iteration: 0 }),
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // The resting state is ONE essence/result line (the tool-result-summary
    // element), not a separate head-row-with-args plus a separate result row.
    const essences = container.querySelectorAll("[data-testid='tool-result-summary']")
    expect(essences.length).toBe(1)
    // The essence carries the result arrow, not the args-in-quotes summary as a
    // separate visible row.
    expect(essences[0]?.textContent).toMatch(/→/)
  })

  it("clicking the essence line expands the finished card's full body", () => {
    const toolCalls: ToolCall[] = [
      {
        name: "execute_code",
        id: "x1",
        args: { code: "print(2)" },
        status: "done",
        result: JSON.stringify({ stdout: "2", exit_code: 0 }),
        startedAt: 1_700_000_000_000,
        endedAt: 1_700_000_000_100,
        iteration: 0,
      } as ToolCall,
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // At rest: essence line, no editor body.
    expect(container.querySelectorAll("[data-testid='tc-editor']").length).toBe(0)
    const essence = container.querySelector("[data-testid='tool-result-summary']") as HTMLButtonElement | null
    expect(essence).toBeTruthy()

    // Click → the full execute_code body (editor) renders.
    fireEvent.click(essence!)
    expect(container.querySelectorAll("[data-testid='tc-editor']").length).toBe(1)
  })
})

describe("ToolCallPanel — SEED-098 Change 1: active tools rest as the unified essence line", () => {
  it("active running tool rests as one essence line by default — heavy body collapsed, reveals on click", () => {
    const toolCalls: ToolCall[] = [
      {
        name: "execute_code",
        id: "run1",
        args: { code: "print(2)" },
        argsCodeText: "print(2)",
        status: "running",
        startedAt: 1_700_000_000_000,
        iteration: 0,
      } as ToolCall,
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)

    // The running merged pill is present at rest (data-status="running").
    const pill = container.querySelector("[data-testid='status-pill'][data-status='running']")
    expect(pill).toBeTruthy()

    // The heavy live body (the Shiki editor inset) is NOT rendered at rest —
    // the active tool folds to the calm one-line essence (no flicker).
    expect(container.querySelectorAll("[data-testid='tc-editor']").length).toBe(0)

    // Clicking the active essence row reveals the live streaming body, exactly
    // like clicking a finished row reveals its result.
    const btn = pill!.closest("button") as HTMLButtonElement | null
    expect(btn).toBeTruthy()
    fireEvent.click(btn!)
    expect(container.querySelectorAll("[data-testid='tc-editor']").length).toBe(1)
  })

  it("running essence shows the Variant B merged live pill (verb + live duration in ONE chip)", () => {
    const toolCalls: ToolCall[] = [
      {
        name: "search_documents",
        id: "run2",
        args: { query: "x" },
        status: "running",
        startedAt: Date.now() - 3200,
        iteration: 0,
      } as ToolCall,
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)
    const pill = container.querySelector("[data-testid='status-pill'][data-status='running']")
    expect(pill).toBeTruthy()
    // verb + live duration merged into ONE chip.
    expect(pill!.textContent).toMatch(/running/i)
    expect(pill!.textContent).toMatch(/·/)
    expect(pill!.textContent).toMatch(/3\.\ds/)
  })

  it("preparing tool rests as an essence line with the merged preparing pill (KB when argsBytesStreamed > 0)", () => {
    const toolCalls: ToolCall[] = [
      {
        name: "search_documents",
        id: "prep1",
        args: {},
        status: "preparing",
        argsBytesStreamed: 2048,
        iteration: 0,
      } as ToolCall,
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)
    const pill = container.querySelector("[data-testid='status-pill'][data-status='preparing']")
    expect(pill).toBeTruthy()
    expect(pill!.textContent).toMatch(/preparing/i)
    expect(pill!.textContent).toMatch(/2\.0 KB/)
  })

  it("preparing tool with no argsBytesStreamed: pill shows just the preparing verb", () => {
    const toolCalls: ToolCall[] = [
      {
        name: "search_documents",
        id: "prep2",
        args: {},
        status: "preparing",
        iteration: 0,
      } as ToolCall,
    ]
    const { container } = renderWithTooltip(<ToolCallPanel toolCalls={toolCalls} />)
    const pill = container.querySelector("[data-testid='status-pill'][data-status='preparing']")
    expect(pill).toBeTruthy()
    expect(pill!.textContent).toMatch(/preparing/i)
    expect(pill!.textContent).not.toMatch(/KB/)
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
    // Phase 095 Plan 06: the 2 finished steps before the active one fold to
    // one-line essence rows (Focus Mode from step 1), so only the active step
    // renders its full StepRow rail node at rest. Expand the essence rows to
    // see all 3 rails — the snum numbering + node-state mapping is the point.
    let summary = container.querySelector("[data-testid='step-summary-row']") as HTMLButtonElement | null
    while (summary) {
      fireEvent.click(summary)
      summary = container.querySelector("[data-testid='step-summary-row']") as HTMLButtonElement | null
    }
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
    // Phase 095 Plan 06 (GAP-095-03 essence): a DONE execute_code now rests as
    // a single essence line, not the full editor body. Expand it to reveal the
    // editor — dedup must still leave exactly ONE card/editor (not two).
    const essence = container.querySelector("[data-testid='tool-result-summary']") as HTMLButtonElement | null
    expect(essence).toBeTruthy()
    fireEvent.click(essence!)
    // Exactly one execute_code body rendered (the execute_code body has a
    // tc-editor inset only when args.code is present — both entries have
    // it, but dedup should leave only one).
    const editors = container.querySelectorAll("[data-testid='tc-editor']")
    expect(editors.length).toBe(1)
  })
})
