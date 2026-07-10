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
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RunHistory } from "./RunHistory"
import { getEvalAggregate } from "@/lib/api"
import type { EvalResult, EvalRun, TestCase } from "@/types"

// Plan 09: the matrix card's aggregation footer fetches getEvalAggregate on mount.
// Mock it here — every finished+expanded matrix triggers the fetch, so a safe default
// (empty configs) is set in beforeEach; the footer tests override per-case.
vi.mock("@/lib/api", () => ({
  getEvalAggregate: vi.fn(),
}))
const mockGetAggregate = vi.mocked(getEvalAggregate)

beforeEach(() => {
  mockGetAggregate.mockReset()
  mockGetAggregate.mockResolvedValue({ configs: [] })
})

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
    // Phase 137.1 (EVAL-05 / mig 085) — single runs carry no group + never feed the gate.
    matrix_group_id: null,
    feeds_gate: false,
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
    // Phase 137.1 (EVAL-05 / mig 085) — advisory-only fields (Plan 09 renders them).
    duration_ms: null,
    case_feedback: null,
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

describe("RunHistory — 058-A matrix grouped card + 059-A determinate bar (EVAL-05)", () => {
  // Three arms of one matrix run: same matrix_group_id, one gate-feeder.
  function matrixArms(overrides: Partial<EvalRun> = {}): EvalRun[] {
    return [
      makeRun({ id: "arm-oa", provider: "openai", model: "gpt-5.4-mini", matrix_group_id: "grp-1", feeds_gate: true, ...overrides }),
      makeRun({ id: "arm-an", provider: "anthropic", model: "claude-haiku-4-5", matrix_group_id: "grp-1", feeds_gate: false, ...overrides }),
      makeRun({ id: "arm-gg", provider: "google", model: "gemini-3-flash", matrix_group_id: "grp-1", feeds_gate: false, ...overrides }),
    ]
  }

  it("collapses N same-group runs into ONE resting matrix card (anti-flood): sub-rows hidden until expand", async () => {
    const user = userEvent.setup()
    render(<RunHistory {...baseProps} runs={matrixArms()} />)

    // One resting card, not three flat rows.
    const card = screen.getByTestId("matrix-card-grp-1")
    expect(card).toBeInTheDocument()
    expect(within(card).getByText(/Matrix run/)).toBeInTheDocument()
    // Header count summary (middot-agnostic): "3 configs" + "3 cases".
    expect(card.textContent).toMatch(/3 configs/)
    expect(card.textContent).toMatch(/3 cases/)
    // Collapsed → the arm sub-rows are NOT in the DOM yet.
    expect(screen.queryByTestId("run-row-arm-oa")).toBeNull()
    expect(screen.queryByTestId("run-row-arm-an")).toBeNull()

    // Expand the card → the three 055-B sub-rows appear.
    await user.click(screen.getByRole("button", { name: /matrix run/i }))
    expect(screen.getByTestId("run-row-arm-oa")).toBeInTheDocument()
    expect(screen.getByTestId("run-row-arm-an")).toBeInTheDocument()
    expect(screen.getByTestId("run-row-arm-gg")).toBeInTheDocument()
  })

  it("shows EXACTLY ONE '▣ feeds gate' chip (off feeds_gate) + states the gate semantics once", async () => {
    const user = userEvent.setup()
    render(<RunHistory {...baseProps} runs={matrixArms()} />)
    await user.click(screen.getByRole("button", { name: /matrix run/i }))

    // Exactly one gate chip across all sub-rows (the feeds_gate=true arm).
    expect(screen.getAllByTestId("feeds-gate-chip")).toHaveLength(1)
    // The chip lives on the gate-feeder arm's row.
    const gateRow = screen.getByTestId("run-row-arm-oa")
    expect(within(gateRow).getByTestId("feeds-gate-chip")).toBeInTheDocument()
    // The header names the gate provider once with the analysis-only semantics.
    const semantics = screen.getByTestId("matrix-gate-semantics")
    expect(semantics.textContent).toMatch(/gate reads[\s\S]*openai[\s\S]*only/i)
    expect(semantics.textContent).toMatch(/analysis-only/i)
  })

  it("a matrix with a running arm defaults open + renders a determinate unit bar (done/(case_count*2+1)), no mid-run verdict", () => {
    // One case done (2 arm-units), one case in flight (with_skill running) → done=2, total=3*2+1=7.
    render(
      <RunHistory
        {...baseProps}
        runs={matrixArms({ status: "running", passed_count: null, measured_count: null })}
        liveByRun={{
          "arm-oa": {
            "tc1:with_skill": "completed",
            "tc1:without_skill": "completed",
            "tc2:with_skill": "running",
          },
        }}
      />,
    )
    // Running matrix defaults expanded → the gate arm's determinate bar is present.
    const gateRow = screen.getByTestId("run-row-arm-oa")
    const bar = within(gateRow).getByTestId("determinate-bar")
    expect(bar).toHaveAttribute("aria-valuenow", "2")
    expect(bar).toHaveAttribute("aria-valuemax", "7")
    // Caption reflects the pure FE math (2/7 ≈ 29%) and shows NO pass/fail verdict.
    expect(bar.textContent).toMatch(/2\/7/)
    expect(bar.textContent).not.toMatch(/\bPASS\b/)
    expect(bar.textContent).not.toMatch(/\bFAIL\b/)
  })

  it("does NOT render a determinate bar on a finished (non-running) matrix arm", async () => {
    const user = userEvent.setup()
    render(<RunHistory {...baseProps} runs={matrixArms()} />)
    await user.click(screen.getByRole("button", { name: /matrix run/i }))
    const gateRow = screen.getByTestId("run-row-arm-oa")
    expect(within(gateRow).queryByTestId("determinate-bar")).toBeNull()
  })

  it("still renders a single (non-matrix) run as a top-level row — no card", () => {
    render(<RunHistory {...baseProps} runs={[makeRun({ id: "solo" })]} />)
    expect(screen.getByTestId("run-row-solo")).toBeInTheDocument()
    expect(screen.queryByTestId(/^matrix-card-/)).toBeNull()
    expect(screen.queryByTestId("feeds-gate-chip")).toBeNull()
  })
})

describe("RunHistory — 058-A aggregation footer + analyst notes (D-07/D-08)", () => {
  // Finished matrix arms (default makeRun status = "completed") so the footer renders
  // AT FINALIZE when the card is expanded.
  function finishedMatrix(): EvalRun[] {
    return [
      makeRun({ id: "arm-oa", provider: "openai", model: "gpt-5.4-mini", matrix_group_id: "grp-1", feeds_gate: true }),
      makeRun({ id: "arm-an", provider: "anthropic", model: "claude-haiku-4-5", matrix_group_id: "grp-1" }),
    ]
  }

  it("renders a 1-run config as 'first run — no spread yet' with NO numeric σ (verbatim from the server)", async () => {
    const user = userEvent.setup()
    mockGetAggregate.mockResolvedValue({
      configs: [
        {
          provider: "openai",
          model: "gpt-5.4-mini",
          run_count: 1,
          with_mean: 0.8,
          without_mean: 0.5,
          with_stddev: null, // server withholds spread at run_count < 2
          delta: 0.3,
          analyst_notes: [],
        },
      ],
    })
    render(<RunHistory {...baseProps} runs={finishedMatrix()} />)
    await user.click(screen.getByRole("button", { name: /matrix run/i }))

    const footer = await screen.findByTestId("matrix-aggregation-footer")
    expect(footer.textContent).toMatch(/first run — no spread yet/)
    // The single-run mean shows; there is NO "± <number>" spread rendered.
    expect(footer.textContent).toMatch(/0\.80/)
    expect(footer.textContent).not.toMatch(/±\s*0\.\d/)
    // getEvalAggregate was called with the arms' shared skill_id.
    expect(mockGetAggregate).toHaveBeenCalledWith("skill-1")
  })

  it("renders a 2+-run config WITH a numeric σ + the Δ skill-lift, both verbatim from the server", async () => {
    const user = userEvent.setup()
    mockGetAggregate.mockResolvedValue({
      configs: [
        {
          provider: "openai",
          model: "gpt-5.4-mini",
          run_count: 3,
          with_mean: 0.82,
          without_mean: 0.4,
          with_stddev: 0.05, // server provides spread at run_count >= 2
          delta: 0.42,
          analyst_notes: [],
        },
      ],
    })
    render(<RunHistory {...baseProps} runs={finishedMatrix()} />)
    await user.click(screen.getByRole("button", { name: /matrix run/i }))

    const footer = await screen.findByTestId("matrix-aggregation-footer")
    expect(footer.textContent).toMatch(/0\.82/)
    expect(footer.textContent).toMatch(/±\s*0\.05/)
    expect(footer.textContent).not.toMatch(/first run — no spread yet/)
    // Δ = the SERVER delta rendered with an explicit sign (not client-computed).
    expect(footer.textContent).toMatch(/\+0\.42/)
    expect(footer.textContent).toMatch(/skill lift/)
  })

  it("renders deterministic analyst notes VERBATIM from the server payload (no client phrasing)", async () => {
    const user = userEvent.setup()
    const NOTE_A = "Non-discriminating: every config passed both arms on this case."
    const NOTE_B = "Flaky variance: with-skill scores swing widely across runs."
    mockGetAggregate.mockResolvedValue({
      configs: [
        {
          provider: "openai",
          model: "gpt-5.4-mini",
          run_count: 2,
          with_mean: 0.7,
          without_mean: 0.6,
          with_stddev: 0.2,
          delta: 0.1,
          analyst_notes: [NOTE_A, NOTE_B],
        },
      ],
    })
    render(<RunHistory {...baseProps} runs={finishedMatrix()} />)
    await user.click(screen.getByRole("button", { name: /matrix run/i }))

    await screen.findByTestId("matrix-aggregation-footer")
    // The exact server strings render — the component invents no phrasing.
    expect(screen.getByText(NOTE_A)).toBeInTheDocument()
    expect(screen.getByText(NOTE_B)).toBeInTheDocument()
    expect(screen.getAllByTestId("analyst-note")).toHaveLength(2)
  })

  it("does NOT render the aggregation footer while any matrix arm is still running", () => {
    // A running matrix defaults open, but aggregation lands only AT FINALIZE.
    render(
      <RunHistory
        {...baseProps}
        runs={finishedMatrix().map((r) => ({ ...r, status: "running" as const, passed_count: null, measured_count: null }))}
      />,
    )
    expect(screen.queryByTestId("matrix-aggregation-footer")).toBeNull()
    expect(mockGetAggregate).not.toHaveBeenCalled()
  })
})
