/**
 * Phase 137 Plan 03 Task 2 (PANEL-01 / EVAL-03) — RunHistory tests.
 *
 * RunHistory is the 055-B "expandable rows" run list: each row = provider logo +
 * model + version binding + honest rollup, expanding IN PLACE to per-case
 * RunCaseDetail bodies fed the real TestCase via a casesById lookup (D-11). It is
 * a controlled, pure presentational component — the container (Plan 05) owns
 * expansion + data; every input is a prop.
 *
 * Honesty locks asserted here (D-04):
 *   - The rollup appends "· N not measured" when measured_count < case_count.
 *   - An interrupted run shows a banner + a re-run affordance, never a silent fail.
 *   - A running run shows live per-arm progress with NO mid-run pass/fail verdict.
 *   - Expanding groups results per case and threads casesById[test_case_id] into
 *     RunCaseDetail so the prompt (not the uuid) renders.
 *   - The D-09 "Propose an improvement?" nudge appears only when a finished run has
 *     >= 1 failed measured case.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RunHistory } from "./RunHistory"
import type { EvalResult, EvalRun, TestCase } from "@/types"

function makeCase(id: string, prompt: string): TestCase {
  return {
    id,
    skill_id: "skill-1",
    user_id: "user-1",
    prompt,
    expected_behavior: "expected",
    order_index: 0,
    name: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  }
}

function makeRun(overrides: Partial<EvalRun> = {}): EvalRun {
  return {
    id: "run-1",
    skill_id: "skill-1",
    skill_version_id: "ver-uuid-12345678",
    user_id: "user-1",
    provider: "openai",
    model: "gpt-5.4-mini",
    status: "completed",
    case_count: 3,
    error: null,
    created_at: "2026-07-01T10:00:00Z",
    completed_at: "2026-07-01T10:03:00Z",
    passed_count: 2,
    measured_count: 2,
    verdict_summary: null,
    ...overrides,
  }
}

function makeResult(
  runId: string,
  tcId: string,
  variant: "with_skill" | "without_skill",
  overrides: Partial<EvalResult> = {},
): EvalResult {
  return {
    id: `res-${runId}-${tcId}-${variant}`,
    eval_run_id: runId,
    test_case_id: tcId,
    user_id: "user-1",
    variant,
    provider: "openai",
    model: "gpt-5.4-mini",
    output: `${variant} output`,
    status: "completed",
    error: null,
    input_tokens: 1000,
    output_tokens: 300,
    created_at: "2026-07-01T10:00:00Z",
    verdict_state: "graded",
    verdict_passed: true,
    verdict_score: 0.9,
    verdict_reason: "reason",
    judge_model: "claude-opus-4-8",
    rating: null,
    ...overrides,
  }
}

const baseProps = {
  casesById: {},
  expandedRunId: null as string | null,
  onToggleExpand: vi.fn(),
  resultsByRun: {} as Record<string, EvalResult[]>,
  liveByCase: {} as Record<string, string>,
  onRate: vi.fn(),
  onRerun: vi.fn(),
  onProposeFromRun: vi.fn(),
}

describe("RunHistory — 055-B expandable rows + honest states (D-04/D-11)", () => {
  it("shows the honest rollup with '· N not measured' when measured_count < case_count", () => {
    render(
      <RunHistory
        {...baseProps}
        runs={[makeRun({ passed_count: 2, measured_count: 2, case_count: 3 })]}
      />,
    )
    expect(screen.getByText(/2\/2 passed[\s\S]*1 not measured/i)).toBeInTheDocument()
  })

  it("renders an interrupted run as a banner + re-run affordance; Re-run calls onRerun", async () => {
    const user = userEvent.setup()
    const onRerun = vi.fn()
    render(
      <RunHistory
        {...baseProps}
        runs={[makeRun({ id: "run-intr", status: "interrupted", passed_count: null, measured_count: null })]}
        expandedRunId="run-intr"
        onRerun={onRerun}
      />,
    )
    const banner = screen.getByTestId("run-interrupted")
    expect(within(banner).getByText(/this run was interrupted/i)).toBeInTheDocument()
    await user.click(screen.getByTestId("run-rerun"))
    expect(onRerun).toHaveBeenCalledWith("run-intr")
  })

  it("renders a running run's live per-arm progress with NO mid-run verdicts", () => {
    render(
      <RunHistory
        {...baseProps}
        runs={[makeRun({ id: "run-live", status: "running", passed_count: null, measured_count: null })]}
        casesById={{ tc1: makeCase("tc1", "Live prompt one") }}
        expandedRunId="run-live"
        liveByCase={{ "tc1:with_skill": "running", "tc1:without_skill": "queued" }}
      />,
    )
    const live = screen.getByTestId("run-live")
    expect(live.textContent).toMatch(/running/)
    expect(live.textContent).toMatch(/queued/)
    // No mid-run pass/fail verdict is ever shown (D-04). Case-sensitive: the
    // honesty note's lowercase "pass/fail" must NOT trip this guard.
    expect(live.textContent).not.toMatch(/\bPASS\b/)
    expect(live.textContent).not.toMatch(/\bFAIL\b/)
    expect(live.textContent).toMatch(/verdicts land when the run finalizes/i)
  })

  it("expands to one RunCaseDetail per case, prompt-first from casesById (never the uuid)", () => {
    const casesById = {
      "tc-uuid-AAA": makeCase("tc-uuid-AAA", "First prompt about vendor risk"),
      "tc-uuid-BBB": makeCase("tc-uuid-BBB", "Second prompt about migration"),
    }
    const resultsByRun = {
      "run-exp": [
        makeResult("run-exp", "tc-uuid-AAA", "with_skill"),
        makeResult("run-exp", "tc-uuid-AAA", "without_skill"),
        makeResult("run-exp", "tc-uuid-BBB", "with_skill"),
        makeResult("run-exp", "tc-uuid-BBB", "without_skill"),
      ],
    }
    const { container } = render(
      <RunHistory
        {...baseProps}
        runs={[makeRun({ id: "run-exp", case_count: 2, measured_count: 2, passed_count: 2 })]}
        casesById={casesById}
        expandedRunId="run-exp"
        resultsByRun={resultsByRun}
      />,
    )
    expect(screen.getAllByTestId("run-case-detail")).toHaveLength(2)
    expect(screen.getByText("First prompt about vendor risk")).toBeInTheDocument()
    expect(screen.getByText("Second prompt about migration")).toBeInTheDocument()
    // D-11: the raw test_case_id uuid never appears as a label.
    expect(container.textContent).not.toContain("tc-uuid-AAA")
    expect(container.textContent).not.toContain("tc-uuid-BBB")
  })

  it("shows the 'Propose an improvement?' nudge only when a finished run has a failed measured case", async () => {
    const user = userEvent.setup()
    const onProposeFromRun = vi.fn()
    render(
      <RunHistory
        {...baseProps}
        runs={[makeRun({ id: "run-fail", case_count: 1, measured_count: 1, passed_count: 0 })]}
        casesById={{ "tc-x": makeCase("tc-x", "Prompt X") }}
        expandedRunId="run-fail"
        resultsByRun={{
          "run-fail": [
            makeResult("run-fail", "tc-x", "with_skill", { verdict_passed: false, verdict_score: 0.3 }),
            makeResult("run-fail", "tc-x", "without_skill", { verdict_passed: false, verdict_score: 0.3 }),
          ],
        }}
        onProposeFromRun={onProposeFromRun}
      />,
    )
    await user.click(screen.getByTestId("run-propose"))
    expect(onProposeFromRun).toHaveBeenCalledWith("run-fail")
  })

  it("hides the propose nudge when all measured cases passed", () => {
    render(
      <RunHistory
        {...baseProps}
        runs={[makeRun({ id: "run-pass", case_count: 1, measured_count: 1, passed_count: 1 })]}
        casesById={{ "tc-y": makeCase("tc-y", "Prompt Y") }}
        expandedRunId="run-pass"
        resultsByRun={{
          "run-pass": [
            makeResult("run-pass", "tc-y", "with_skill", { verdict_passed: true }),
            makeResult("run-pass", "tc-y", "without_skill", { verdict_passed: true }),
          ],
        }}
      />,
    )
    expect(screen.queryByTestId("run-propose")).toBeNull()
  })

  it("renders a Bot fallback for an unmapped provider and toggles on row click", async () => {
    const user = userEvent.setup()
    const onToggleExpand = vi.fn()
    render(
      <RunHistory
        {...baseProps}
        runs={[makeRun({ id: "run-x", provider: "unknown" })]}
        onToggleExpand={onToggleExpand}
      />,
    )
    expect(screen.getByTestId("provider-fallback")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /gpt-5\.4-mini/i }))
    expect(onToggleExpand).toHaveBeenCalledWith("run-x")
  })
})
