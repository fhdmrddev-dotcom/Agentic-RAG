/**
 * Phase 137 Plan 05 Task 3 (PANEL-01) — EvalsTab container spec.
 *
 * Exercises the lifted machinery + the composed leaves through the REAL leaf
 * components with a fully-mocked `@/lib/api`:
 *   (1) a running run shows live per-arm progress but NO mid-run verdict (T-137-04);
 *   (2) onEvalComplete triggers a durable getEvalRun readout (the DB is authoritative);
 *   (3) switching skillId clears the prior readout AND the prior case list
 *       (the BUG-260701-02 skill-switch guard);
 *   (4) a rating click hits rateEvalResult THEN re-fetches getEvalRun
 *       (endpoint-then-refetch, never optimistic — T-137-04);
 *   (5) the casesById thread renders the run-history per-case detail PROMPT-FIRST
 *       (the case prompt, never the uuid — BUG-260701-02) and feeds the stepper count.
 *
 * Authored fresh (MEMORY project_frontend_vitest_rot) — no import from a rotted sibling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor, within, act } from "@testing-library/react"
import type { EvalResult, EvalRun, PublishGate, TestCase } from "@/types"

const getProviders = vi.fn()
const startEvalRun = vi.fn()
const getEvalRun = vi.fn()
const listEvalRuns = vi.fn()
const subscribeToRun = vi.fn()
const rateEvalResult = vi.fn()
const proposeImprovement = vi.fn()
const listProposals = vi.fn()
const getProposal = vi.fn()
const approveProposal = vi.fn()
const rejectProposal = vi.fn()
const rerunProposalReeval = vi.fn()
const forcePromoteProposal = vi.fn()
const getPublishGate = vi.fn()
const listTestCases = vi.fn()
const createTestCase = vi.fn()
const updateTestCase = vi.fn()
const deleteTestCase = vi.fn()

vi.mock("@/lib/api", () => ({
  getProviders: (...a: unknown[]) => getProviders(...(a as [])),
  startEvalRun: (...a: unknown[]) => startEvalRun(...(a as [string, unknown])),
  getEvalRun: (...a: unknown[]) => getEvalRun(...(a as [string, string])),
  listEvalRuns: (...a: unknown[]) => listEvalRuns(...(a as [string])),
  subscribeToRun: (...a: unknown[]) => subscribeToRun(...(a as unknown[])),
  rateEvalResult: (...a: unknown[]) => rateEvalResult(...(a as [string, string, unknown])),
  proposeImprovement: (...a: unknown[]) => proposeImprovement(...(a as [string, string])),
  listProposals: (...a: unknown[]) => listProposals(...(a as [string])),
  getProposal: (...a: unknown[]) => getProposal(...(a as [string, string])),
  approveProposal: (...a: unknown[]) => approveProposal(...(a as [string, string])),
  rejectProposal: (...a: unknown[]) => rejectProposal(...(a as [string, string])),
  rerunProposalReeval: (...a: unknown[]) => rerunProposalReeval(...(a as [string, string])),
  forcePromoteProposal: (...a: unknown[]) => forcePromoteProposal(...(a as [string, string])),
  getPublishGate: (...a: unknown[]) => getPublishGate(...(a as [string])),
  listTestCases: (...a: unknown[]) => listTestCases(...(a as [string])),
  createTestCase: (...a: unknown[]) => createTestCase(...(a as [string, unknown])),
  updateTestCase: (...a: unknown[]) => updateTestCase(...(a as [string, unknown])),
  deleteTestCase: (...a: unknown[]) => deleteTestCase(...(a as [string])),
}))

import { EvalsTab } from "./EvalsTab"

// Loosely-typed captured stream callbacks so a test can drive the eval_* events.
type EvalCbs = {
  onEvalCaseStarted: (e: { testCaseId: string; variant: string }) => void
  onEvalCaseDone: (e: { testCaseId: string; variant: string; status: string }) => void
  onEvalComplete: () => void
  onTerminal: (kind: string, err?: string) => void
}
let streamCbs: EvalCbs | null = null

const PROVIDERS = {
  active: "openai",
  active_model: "gpt-x",
  providers: [{ id: "openai", name: "OpenAI", models: ["gpt-x"], is_active: true }],
}

function mkCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: "tc-aaaa-1111-bbbb-2222",
    skill_id: "skill-1",
    user_id: "user-1",
    prompt: "Summarize the doc",
    expected_behavior: "returns a concise summary",
    order_index: 0,
    name: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  }
}

function mkRun(overrides: Partial<EvalRun> = {}): EvalRun {
  return {
    id: "run-1",
    skill_id: "skill-1",
    skill_version_id: "ver-1",
    user_id: "user-1",
    provider: "openai",
    model: "gpt-x",
    status: "completed",
    case_count: 1,
    error: null,
    created_at: "2026-07-02T00:00:00Z",
    completed_at: "2026-07-02T00:01:00Z",
    passed_count: 1,
    measured_count: 1,
    verdict_summary: null,
    // Phase 137.1 (EVAL-05 / mig 085) — matrix grouping + gate-feeder flag (single run).
    matrix_group_id: null,
    feeds_gate: false,
    ...overrides,
  }
}

function mkResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    id: "res-1",
    eval_run_id: "run-1",
    test_case_id: "tc-aaaa-1111-bbbb-2222",
    user_id: "user-1",
    variant: "with_skill",
    provider: "openai",
    model: "gpt-x",
    output: "A concise summary.",
    status: "completed",
    error: null,
    input_tokens: 100,
    output_tokens: 50,
    created_at: "2026-07-02T00:00:30Z",
    verdict_state: "graded",
    verdict_passed: true,
    verdict_score: 0.9,
    verdict_reason: "meets the bar",
    judge_model: "claude-judge",
    rating: null,
    // Phase 137.1 (EVAL-05 / mig 085) — advisory-only per-arm fields (Plan 09 renders).
    duration_ms: null,
    case_feedback: null,
    ...overrides,
  }
}

function mkGate(overrides: Partial<PublishGate> = {}): PublishGate {
  return {
    met: false,
    state: "never_evaled",
    measured: null,
    passed: null,
    passing_run_id: null,
    reason: "Run an eval on the current version.",
    last_override: null,
    ...overrides,
  }
}

afterEach(() => cleanup())

describe("EvalsTab — lifted machinery + composed leaves (137-05 Task 3)", () => {
  beforeEach(() => {
    streamCbs = null
    getProviders.mockReset().mockResolvedValue(PROVIDERS)
    startEvalRun.mockReset().mockResolvedValue({ run_id: "run-1" })
    getEvalRun.mockReset().mockResolvedValue({ eval_run: mkRun(), eval_results: [mkResult()] })
    listEvalRuns.mockReset().mockResolvedValue([])
    subscribeToRun.mockReset().mockImplementation((...a: unknown[]) => {
      streamCbs = a[2] as EvalCbs
      return Promise.resolve()
    })
    rateEvalResult.mockReset().mockResolvedValue({ eval_result_id: "res-1", rating: "up" })
    proposeImprovement.mockReset().mockResolvedValue(null)
    listProposals.mockReset().mockResolvedValue([])
    getProposal.mockReset().mockResolvedValue(null)
    approveProposal.mockReset().mockResolvedValue({ re_eval_run_id: "run-2" })
    rejectProposal.mockReset().mockResolvedValue(null)
    rerunProposalReeval.mockReset().mockResolvedValue({ re_eval_run_id: "run-2" })
    forcePromoteProposal.mockReset().mockResolvedValue(null)
    getPublishGate.mockReset().mockResolvedValue(mkGate())
    listTestCases.mockReset().mockResolvedValue([mkCase()])
    createTestCase.mockReset().mockResolvedValue(mkCase())
    updateTestCase.mockReset().mockResolvedValue(mkCase())
    deleteTestCase.mockReset().mockResolvedValue(undefined)
  })

  it("(1) a running run shows live per-arm progress but NO mid-run verdict", async () => {
    render(<EvalsTab skillId="skill-1" skillVersion={2} />)

    // Cases loaded via CaseEditor (the container's single source).
    await screen.findByText("Summarize the doc")

    fireEvent.click(screen.getByRole("button", { name: /run eval/i }))
    await waitFor(() => expect(subscribeToRun).toHaveBeenCalled())

    // Drive one live per-arm start (no verdict event).
    await act(async () => {
      streamCbs!.onEvalCaseStarted({ testCaseId: "tc-aaaa-1111-bbbb-2222", variant: "with_skill" })
    })

    // Expand the live (top) run row.
    const row = await screen.findByTestId("run-row-run-1")
    fireEvent.click(within(row).getByRole("button"))

    const live = screen.getByTestId("run-live")
    // Prompt-first even in the live body (casesById threaded), showing progress only.
    expect(live.textContent).toContain("Summarize the doc")
    expect(live.textContent).toContain("with_skill")
    expect(live.textContent).toContain("running")
    // The no-mid-run-verdict lock: no PASS/FAIL while streaming.
    expect(screen.getByText(/Verdicts land when the run finalizes/i)).toBeInTheDocument()
    expect(screen.queryByText("PASS")).toBeNull()
    expect(screen.queryByText("FAIL")).toBeNull()
  })

  it("(2) onEvalComplete triggers a durable getEvalRun readout", async () => {
    render(<EvalsTab skillId="skill-1" skillVersion={2} />)
    await screen.findByText("Summarize the doc")

    fireEvent.click(screen.getByRole("button", { name: /run eval/i }))
    await waitFor(() => expect(subscribeToRun).toHaveBeenCalled())

    getEvalRun.mockClear()
    await act(async () => {
      streamCbs!.onEvalComplete()
    })

    await waitFor(() => expect(getEvalRun).toHaveBeenCalledWith("skill-1", "run-1"))
  })

  it("(2b) run finalize refetches the publish gate AND notifies the shell (137-UAT gap)", async () => {
    const onGateStale = vi.fn()
    render(<EvalsTab skillId="skill-1" skillVersion={2} onGateStale={onGateStale} />)
    await screen.findByText("Summarize the doc")

    fireEvent.click(screen.getByRole("button", { name: /run eval/i }))
    await waitFor(() => expect(subscribeToRun).toHaveBeenCalled())

    // The init effect fetched the gate once; the finalize edge must fetch it AGAIN so
    // the stepper leaves "never_evaled" without a page reload — and ping the shell so
    // the header strip (the other home of the one truth-teller) refreshes too.
    getPublishGate.mockClear()
    await act(async () => {
      streamCbs!.onTerminal("done")
    })

    await waitFor(() => expect(getPublishGate).toHaveBeenCalledWith("skill-1"))
    expect(onGateStale).toHaveBeenCalled()
  })

  it("(3) switching skillId clears the prior readout AND the prior case list", async () => {
    listEvalRuns.mockImplementation(async (sid: string) => (sid === "skill-1" ? [mkRun()] : []))
    listTestCases.mockImplementation(async (sid: string) => (sid === "skill-1" ? [mkCase()] : []))

    const { rerender } = render(<EvalsTab skillId="skill-1" skillVersion={2} />)

    // The prior skill's case prompt + run row are present.
    await screen.findByText("Summarize the doc")
    await screen.findByTestId("run-row-run-1")

    rerender(<EvalsTab skillId="skill-2" skillVersion={1} />)

    await waitFor(() => {
      expect(screen.queryByText("Summarize the doc")).toBeNull() // prior cases cleared
      expect(screen.queryByTestId("run-row-run-1")).toBeNull() // prior readout cleared
    })
  })

  it("(4) a rating click hits rateEvalResult THEN re-fetches getEvalRun", async () => {
    listEvalRuns.mockResolvedValue([mkRun()])

    render(<EvalsTab skillId="skill-1" skillVersion={2} />)
    const row = await screen.findByTestId("run-row-run-1")

    // Expand the finished run -> RunCaseDetail with the thumbs controls.
    fireEvent.click(within(row).getByRole("button"))
    const thumbUp = await screen.findByLabelText("Thumbs up")

    getEvalRun.mockClear()
    fireEvent.click(thumbUp)

    await waitFor(() =>
      expect(rateEvalResult).toHaveBeenCalledWith("skill-1", "res-1", "up"),
    )
    // Endpoint-then-refetch: the durable readout is re-fetched (never optimistic).
    await waitFor(() => expect(getEvalRun).toHaveBeenCalledWith("skill-1", "run-1"))
  })

  it("(5) the casesById thread renders the per-case detail prompt-first (not the uuid) + feeds the stepper count", async () => {
    listEvalRuns.mockResolvedValue([mkRun()])

    render(<EvalsTab skillId="skill-1" skillVersion={2} />)
    const row = await screen.findByTestId("run-row-run-1")

    // The stepper Cases node reads the container-owned count (1 case loaded).
    expect(await screen.findByText("1 ready")).toBeInTheDocument()

    fireEvent.click(within(row).getByRole("button"))

    const cases = await screen.findByTestId("run-cases")
    // Prompt-first per-case label (D-11), never the raw uuid.
    expect(within(cases).getByTestId("case-prompt").textContent).toContain("Summarize the doc")
    expect(within(cases).queryByText(/tc-aaaa-1111/)).toBeNull()
  })
})
