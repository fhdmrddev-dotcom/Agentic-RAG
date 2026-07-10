/**
 * Phase 137.1 Plan 10 (EVAL-05 / sketch 060-A) — EngineHealthCard tests.
 *
 * The engine-health tile board: one ✓/✗ tile per CONFIGURED provider (logo +
 * representative model), staleness ALWAYS shown, a "Run sweep" button that POSTs the
 * skill-less smoke sweep, a ✗ tile's VERBATIM provider error demoted below the grid,
 * and the resolvable D-03 deep-link — a tile click opens an inline run-detail section
 * fed by getEvalRunById and rendered via the reused RunCaseDetail leaf.
 *
 * Honesty locks asserted here:
 *   - The "ENGINE health ≠ model quality" subtitle is present (D-01/D-02).
 *   - Staleness renders amber-when-old and green-after-sweep (D-04).
 *   - "Run sweep" calls runEngineSweep, then the board reflects the fresh result.
 *   - A ✗ tile surfaces the verbatim provider error (never engine-shaped).
 *   - The deep-link RESOLVES: getEvalRunById(run_id) is called and RunCaseDetail
 *     content renders inline — never a dead run_id.
 *   - On-demand only: getEngineHealth is fetched once on mount (no background poll).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EngineHealthCard, hasInFlight } from "./EngineHealthCard"
import { getEngineHealth, runEngineSweep, getEvalRunById } from "@/lib/api"
import type { EngineHealthBoard, EngineHealthTile, EvalResult, EvalRunReadout } from "@/types"

vi.mock("@/lib/api", () => ({
  getEngineHealth: vi.fn(),
  runEngineSweep: vi.fn(),
  getEvalRunById: vi.fn(),
}))

const mockGetHealth = vi.mocked(getEngineHealth)
const mockRunSweep = vi.mocked(runEngineSweep)
const mockGetRun = vi.mocked(getEvalRunById)

const OLD_TS = "2020-01-01T00:00:00Z"

function board(overrides: Partial<EngineHealthBoard> = {}): EngineHealthBoard {
  return {
    swept_at: OLD_TS,
    tiles: [
      { provider: "openai", model: "gpt-5.4-mini", healthy: true, error: null, run_id: "run-openai", last_swept_at: OLD_TS },
      { provider: "anthropic", model: "claude-sonnet-4-6", healthy: true, error: null, run_id: "run-anthropic", last_swept_at: OLD_TS },
      { provider: "google", model: "gemini-2.5-flash", healthy: false, error: "401 Unauthorized: missing GOOGLE_API_KEY", run_id: null, last_swept_at: OLD_TS },
    ],
    ...overrides,
  }
}

function makeResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    id: "res-1",
    eval_run_id: "run-openai",
    test_case_id: "smoke-1",
    user_id: "user-1",
    variant: "with_skill",
    provider: "openai",
    model: "gpt-5.4-mini",
    output: "smoke output text",
    status: "completed",
    error: null,
    input_tokens: 100,
    output_tokens: 30,
    created_at: "2026-07-04T00:00:00Z",
    verdict_state: "graded",
    verdict_passed: true,
    verdict_score: 0.91,
    verdict_reason: "smoke passed",
    judge_model: "claude-opus-4-8",
    rating: null,
    duration_ms: 1200,
    case_feedback: null,
    ...overrides,
  }
}

function readout(): EvalRunReadout {
  return {
    eval_run: {
      id: "run-openai",
      skill_id: "00000000-0000-0000-0000-000000000000",
      skill_version_id: "ver-smoke",
      user_id: "user-1",
      provider: "openai",
      model: "gpt-5.4-mini",
      status: "completed",
      case_count: 1,
      error: null,
      created_at: "2026-07-04T00:00:00Z",
      completed_at: "2026-07-04T00:01:00Z",
      passed_count: 1,
      measured_count: 1,
      verdict_summary: null,
      matrix_group_id: null,
      feeds_gate: false,
    },
    eval_results: [
      makeResult({ id: "res-with", variant: "with_skill" }),
      makeResult({ id: "res-without", variant: "without_skill", output: "no-skill output" }),
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetHealth.mockResolvedValue(board())
  mockRunSweep.mockResolvedValue(board({ swept_at: new Date().toISOString() }))
  mockGetRun.mockResolvedValue(readout())
})

describe("EngineHealthCard — 060-A tile board (D-01..D-04)", () => {
  it("renders one ✓/✗ tile per configured provider with its representative model", async () => {
    render(<EngineHealthCard />)
    await screen.findByTestId("engine-staleness")

    expect(screen.getByTestId("engine-tile-openai")).toBeInTheDocument()
    expect(screen.getByTestId("engine-tile-anthropic")).toBeInTheDocument()
    expect(screen.getByTestId("engine-tile-google")).toBeInTheDocument()
    // Representative model shown per tile.
    expect(screen.getByText("gpt-5.4-mini")).toBeInTheDocument()
    expect(screen.getByText("gemini-2.5-flash")).toBeInTheDocument()
    // Healthy vs failed marks.
    expect(screen.getByTestId("engine-mark-healthy-openai")).toBeInTheDocument()
    expect(screen.getByTestId("engine-mark-failed-google")).toBeInTheDocument()
    // N/total header.
    expect(screen.getByText(/2\/3 engines healthy/i)).toBeInTheDocument()
  })

  it("renders the ENGINE health ≠ model quality subtitle (load-bearing semantics)", async () => {
    render(<EngineHealthCard />)
    await screen.findByTestId("engine-staleness")
    expect(screen.getByText(/ENGINE health ≠ model quality/i)).toBeInTheDocument()
  })

  it("demotes a ✗ tile's VERBATIM provider error below the grid (never engine-shaped)", async () => {
    render(<EngineHealthCard />)
    await screen.findByTestId("engine-staleness")
    const err = screen.getByTestId("engine-error-google")
    expect(within(err).getByText("401 Unauthorized: missing GOOGLE_API_KEY")).toBeInTheDocument()
  })

  it("shows staleness amber when old, and green just-now after a sweep", async () => {
    const user = userEvent.setup()
    render(<EngineHealthCard />)
    const stale = await screen.findByTestId("engine-staleness")
    // Old board → amber (not fresh).
    expect(stale).toHaveAttribute("data-fresh", "false")
    expect(stale.textContent).toMatch(/ago/i)

    // Run sweep → runEngineSweep returns a just-now board → green fresh.
    await user.click(screen.getByRole("button", { name: /run sweep/i }))
    await waitFor(() =>
      expect(screen.getByTestId("engine-staleness")).toHaveAttribute("data-fresh", "true"),
    )
    expect(screen.getByTestId("engine-staleness").textContent).toMatch(/just now/i)
  })

  it("'Run sweep' POSTs runEngineSweep", async () => {
    const user = userEvent.setup()
    render(<EngineHealthCard />)
    await screen.findByTestId("engine-staleness")
    await user.click(screen.getByRole("button", { name: /run sweep/i }))
    await waitFor(() => expect(mockRunSweep).toHaveBeenCalledTimes(1))
  })

  it("RESOLVES the tile deep-link: click fetches getEvalRunById and renders RunCaseDetail inline", async () => {
    const user = userEvent.setup()
    render(<EngineHealthCard />)
    await screen.findByTestId("engine-staleness")

    await user.click(screen.getByTestId("engine-tile-openai"))

    await waitFor(() => expect(mockGetRun).toHaveBeenCalledWith("run-openai"))
    // The deep-link RESOLVES to a rendered view — RunCaseDetail content is visible.
    const detail = await screen.findByTestId("engine-tile-detail")
    expect(within(detail).getAllByTestId("run-case-detail").length).toBeGreaterThan(0)
    expect(within(detail).getByText(/no-skill output/i)).toBeInTheDocument()
  })

  it("renders an honest inline error when the detail fetch fails (never a dead link)", async () => {
    const user = userEvent.setup()
    mockGetRun.mockRejectedValueOnce(new Error("run not found"))
    render(<EngineHealthCard />)
    await screen.findByTestId("engine-staleness")

    await user.click(screen.getByTestId("engine-tile-openai"))
    const err = await screen.findByTestId("engine-tile-detail-error")
    expect(err.textContent).toMatch(/run not found/i)
  })

  it("is on-demand only — getEngineHealth is fetched once on mount (no background poll)", async () => {
    render(<EngineHealthCard />)
    await screen.findByTestId("engine-staleness")
    // A background scheduler would call getEngineHealth repeatedly; on-demand fetches once.
    expect(mockGetHealth).toHaveBeenCalledTimes(1)
  })

  it("shows an honest-empty message when never swept with no tiles", async () => {
    mockGetHealth.mockResolvedValue({ swept_at: null, tiles: [] })
    render(<EngineHealthCard />)
    await screen.findByTestId("engine-staleness")
    expect(screen.getByText(/no sweep yet/i)).toBeInTheDocument()
    expect(screen.getByTestId("engine-staleness")).toHaveAttribute("data-fresh", "false")
  })
})

// 137.1 UAT fix — the sweep route returns "freshly running" and the arms grade 10-20s
// later, so onRunSweep must keep polling until every tile is terminal. This predicate is
// the stop-condition; a regression here would freeze the board on the 0/N early snapshot.
describe("hasInFlight — the running-poll stop-condition", () => {
  const tile = (o: Partial<EngineHealthTile>): EngineHealthTile => ({
    provider: "openai",
    model: "m",
    healthy: false,
    error: null,
    run_id: "r",
    last_swept_at: null,
    ...o,
  })

  it("is true while any arm is still running (healthy=false, no error yet) → keep polling", () => {
    expect(hasInFlight({ swept_at: null, tiles: [tile({ healthy: false, error: null })] })).toBe(true)
    // A mix of graded + still-running is still in-flight.
    expect(
      hasInFlight({ swept_at: null, tiles: [tile({ healthy: true }), tile({ provider: "google" })] }),
    ).toBe(true)
  })

  it("is false once every tile is terminal (healthy OR carries an error) → stop polling", () => {
    expect(
      hasInFlight({
        swept_at: null,
        tiles: [tile({ healthy: true }), tile({ provider: "google", healthy: false, error: "401 Unauthorized" })],
      }),
    ).toBe(false)
  })

  it("is false for an honest-empty board or null (nothing to wait for)", () => {
    expect(hasInFlight({ swept_at: null, tiles: [] })).toBe(false)
    expect(hasInFlight(null)).toBe(false)
  })
})
