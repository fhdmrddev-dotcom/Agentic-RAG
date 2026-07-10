/**
 * Phase 137 Plan 03 Task 1 (PANEL-01 / EVAL-03 / EVAL-04) — RunCaseDetail tests.
 *
 * RunCaseDetail is the per-case body of an expanded eval run (sketch 055-B). It
 * renders, prompt-first (D-11 — the fix for BUG-260701-02), the two arms
 * WITH_SKILL and WITHOUT_SKILL side-by-side, each carrying the honest judge
 * verdict chip (PASS / FAIL / "not measured" / "judge error" — D-04) + score +
 * reason + token counts, and a "Your rating" thumbs control that is a DISTINCT
 * truth from the judge verdict (never blended). It is pure presentational — no
 * mocks; every input is a prop.
 *
 * Honesty locks asserted here (D-04):
 *   - PASS/FAIL render only for verdict_state "graded"; not_measured / judge_error
 *     render as neutral text and carry NO fail (destructive) styling.
 *   - The prompt (from the TestCase prop) leads; the test-case uuid is NEVER a label.
 *   - A null testCase (case deleted after the run) renders a neutral fallback line,
 *     never the raw uuid.
 *   - Thumbs use aria-pressed and toggle through onRate (choosing the same rating
 *     clears it to null).
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RunCaseDetail } from "./RunCaseDetail"
import type { EvalResult, TestCase } from "@/types"

function makeCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: "tc-uuid-abcdef01",
    skill_id: "skill-1",
    user_id: "user-1",
    prompt: "Summarize the quarterly risks as a register",
    expected_behavior: "Produces a structured register with likelihood and impact",
    order_index: 0,
    name: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  }
}

function makeResult(
  variant: "with_skill" | "without_skill",
  overrides: Partial<EvalResult> = {},
): EvalResult {
  return {
    id: `res-${variant}`,
    eval_run_id: "run-1",
    test_case_id: "tc-uuid-abcdef01",
    user_id: "user-1",
    variant,
    provider: "anthropic",
    model: "claude-haiku-4-5",
    output: `${variant} output text`,
    status: "completed",
    error: null,
    input_tokens: 1200,
    output_tokens: 640,
    created_at: "2026-07-01T00:00:00Z",
    verdict_state: "graded",
    verdict_passed: true,
    verdict_score: 0.92,
    verdict_reason: `judge reason for ${variant}`,
    judge_model: "claude-opus-4-8",
    rating: null,
    // Phase 137.1 (EVAL-05 / mig 085) — advisory-only fields (Plan 09 renders them).
    duration_ms: null,
    case_feedback: null,
    ...overrides,
  }
}

describe("RunCaseDetail — honest verdicts + side-by-side arms + labeled thumbs (D-04)", () => {
  it("renders PASS and FAIL from verdict_state=graded", () => {
    render(
      <RunCaseDetail
        testCase={makeCase()}
        results={[
          makeResult("with_skill", { verdict_passed: true }),
          makeResult("without_skill", { id: "res-wo", verdict_passed: false, verdict_score: 0.3 }),
        ]}
        onRate={vi.fn()}
      />,
    )
    expect(screen.getByTestId("verdict-chip-with_skill").textContent).toContain("PASS")
    expect(screen.getByTestId("verdict-chip-without_skill").textContent).toContain("FAIL")
  })

  it("renders 'not measured' as neutral (excluded, never failed) — no fail styling", () => {
    render(
      <RunCaseDetail
        testCase={makeCase()}
        results={[
          makeResult("with_skill", {
            verdict_state: "not_measured",
            verdict_passed: null,
            verdict_score: null,
            status: "failed",
            error: "provider 400 · invalid_tool_arguments",
            output: "",
          }),
          makeResult("without_skill", { id: "res-wo" }),
        ]}
        onRate={vi.fn()}
      />,
    )
    const chip = screen.getByTestId("verdict-chip-with_skill")
    expect(chip.textContent).toMatch(/not measured/i)
    // D-04 honesty: not_measured is excluded, NOT colored/styled as a fail.
    expect(chip.className).not.toContain("destructive")
  })

  it("renders 'judge error' as neither-pass-nor-fail — no fail styling", () => {
    render(
      <RunCaseDetail
        testCase={makeCase()}
        results={[
          makeResult("with_skill", {
            verdict_state: "judge_error",
            verdict_passed: null,
            verdict_score: null,
          }),
          makeResult("without_skill", {
            id: "res-wo",
            verdict_state: "judge_error",
            verdict_passed: null,
            verdict_score: null,
          }),
        ]}
        onRate={vi.fn()}
      />,
    )
    const chip = screen.getByTestId("verdict-chip-with_skill")
    expect(chip.textContent).toMatch(/judge error/i)
    expect(chip.className).not.toContain("destructive")
  })

  it("renders both WITH and WITHOUT arms side-by-side", () => {
    render(
      <RunCaseDetail
        testCase={makeCase()}
        results={[makeResult("with_skill"), makeResult("without_skill", { id: "res-wo" })]}
        onRate={vi.fn()}
      />,
    )
    const withArm = screen.getByTestId("arm-with_skill")
    const woArm = screen.getByTestId("arm-without_skill")
    expect(within(withArm).getByText(/^with skill$/i)).toBeInTheDocument()
    expect(within(woArm).getByText(/^without skill$/i)).toBeInTheDocument()
  })

  it("leads with the prompt from the TestCase (D-11) and never shows the case uuid", () => {
    const { container } = render(
      <RunCaseDetail
        testCase={makeCase({ id: "tc-uuid-DEADBEEF", prompt: "My unique prompt text" })}
        results={[
          makeResult("with_skill", { test_case_id: "tc-uuid-DEADBEEF" }),
          makeResult("without_skill", { id: "res-wo", test_case_id: "tc-uuid-DEADBEEF" }),
        ]}
        onRate={vi.fn()}
      />,
    )
    expect(screen.getByText("My unique prompt text")).toBeInTheDocument()
    expect(container.textContent).not.toContain("tc-uuid-DEADBEEF")
  })

  it("renders a neutral fallback (never the uuid) when testCase is null", () => {
    const { container } = render(
      <RunCaseDetail
        testCase={null}
        results={[
          makeResult("with_skill", { test_case_id: "tc-uuid-GONE0001" }),
          makeResult("without_skill", { id: "res-wo", test_case_id: "tc-uuid-GONE0001" }),
        ]}
        onRate={vi.fn()}
      />,
    )
    expect(screen.getByText(/this test case was removed/i)).toBeInTheDocument()
    expect(container.textContent).not.toContain("tc-uuid-GONE0001")
  })

  it("thumbs use aria-pressed and clicking calls onRate with toggle semantics", async () => {
    const user = userEvent.setup()
    const onRate = vi.fn()
    render(
      <RunCaseDetail
        testCase={makeCase()}
        results={[
          makeResult("with_skill", { id: "res-with", rating: "up" }),
          makeResult("without_skill", { id: "res-wo", rating: null }),
        ]}
        onRate={onRate}
      />,
    )
    const withRating = screen.getByTestId("rating-with_skill")
    const up = within(withRating).getByRole("button", { name: /thumbs up/i })
    const down = within(withRating).getByRole("button", { name: /thumbs down/i })
    // aria-pressed reflects the current rating (up).
    expect(up).toHaveAttribute("aria-pressed", "true")
    expect(down).toHaveAttribute("aria-pressed", "false")
    // Clicking the active thumb toggles it OFF (clears to null).
    await user.click(up)
    expect(onRate).toHaveBeenCalledWith("res-with", null)
    // Clicking the other thumb sets that rating.
    await user.click(down)
    expect(onRate).toHaveBeenCalledWith("res-with", "down")
  })
})

describe("RunCaseDetail — 059-A advisory case_feedback + ⏱ duration (EVAL-05d/e)", () => {
  it("renders a non-empty case_feedback as a violet '◇ Judge on this case' advisory — distinct from PASS/FAIL, captioned never-blocks, verdict untouched", () => {
    render(
      <RunCaseDetail
        testCase={makeCase()}
        results={[
          makeResult("with_skill", {
            verdict_passed: true,
            case_feedback: "The without-skill answer already covered the rubric, so this case did not discriminate.",
          }),
          makeResult("without_skill", { id: "res-wo", verdict_passed: true }),
        ]}
        onRate={vi.fn()}
      />,
    )
    const advisory = screen.getByTestId("case-feedback")
    expect(advisory.textContent).toMatch(/Judge on this case/i)
    expect(advisory.textContent).toMatch(/did not discriminate/i)
    // Advisory vocabulary — captioned "feedback only — never blocks the run".
    expect(advisory.textContent).toMatch(/feedback only — never blocks the run/i)
    // Violet (info) — NEVER a verdict tone (emerald/destructive/amber are verdicts).
    const html = advisory.outerHTML
    expect(html).toMatch(/accent-violet/)
    expect(html).not.toMatch(/destructive|emerald|amber/)
    // The verdict badge is UNCHANGED (honesty lock) — PASS still reads PASS, and the
    // advisory is not a verdict chip.
    expect(screen.getByTestId("verdict-chip-with_skill").textContent).toContain("PASS")
  })

  it("renders per-arm ⏱ duration beside the token line only when duration_ms is set", () => {
    render(
      <RunCaseDetail
        testCase={makeCase()}
        results={[
          makeResult("with_skill", { duration_ms: 1840 }),
          makeResult("without_skill", { id: "res-wo", duration_ms: null }),
        ]}
        onRate={vi.fn()}
      />,
    )
    const dur = screen.getByTestId("duration-with_skill")
    expect(dur.textContent).toMatch(/⏱/)
    expect(dur.textContent).toMatch(/1840ms/)
    // The without arm carries null duration → no ⏱ segment.
    expect(screen.queryByTestId("duration-without_skill")).toBeNull()
  })

  it("renders NO advisory block when case_feedback is null on every arm", () => {
    render(
      <RunCaseDetail
        testCase={makeCase()}
        results={[
          makeResult("with_skill", { case_feedback: null }),
          makeResult("without_skill", { id: "res-wo", case_feedback: null }),
        ]}
        onRate={vi.fn()}
      />,
    )
    expect(screen.queryByTestId("case-feedback")).toBeNull()
  })
})
