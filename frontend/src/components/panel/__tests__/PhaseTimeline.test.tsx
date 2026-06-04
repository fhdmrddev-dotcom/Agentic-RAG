/**
 * Phase 094 Plan 03 — INV-2 (the A11Y-03 axe gate + announcer/aria contracts).
 * Flips the Plan-01 Wave 0 RED scaffold GREEN.
 *
 * Drives the REAL data path: replay each DATA-CONTRACT §7 fixture through the REAL
 * subscribeToRun normalizer into the store (replayHarness), then render
 * PhaseTimeline reading the REAL usePhases/useTasks selectors over that store —
 * so a test exercises the live wire→Phase[]→render pipeline, not a stub.
 *
 * INV-2:
 *   - axe(container) has ZERO violations for fxRunRunning / fxRunFailed / fxRunDone
 *     / fxRunAskuserPaused / fxRunGatefailRetry, across 1-phase and N-phase shapes.
 *   - the role="status" announcer is PRESENT at load.
 *   - each PhaseCard's <button aria-expanded> flips on open/close (APG accordion).
 *   - the running phase row sets aria-busy=true; it is cleared (absent) when the
 *     run is terminal/done.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import {
  fxRunRunning,
  fxRunFailed,
  fxRunDone,
  fxRunAskuserPaused,
  fxRunGatefailRetry,
} from "@/test-fixtures/harness094"

// Mock Supabase auth so the REAL subscribeToRun (driven by replayHarness) never
// reaches a real URL — getAuthHeaders reads supabase.auth.getSession().
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

// Partial-mock @/lib/api: keep the REAL subscribeToRun (the SSE demux under test);
// override the panel GETs (incl. getThreadWorkflow, which PhaseTimeline calls for
// the run-level header frame) so the mount + replay stay off the network.
const { mockGetThreadWorkflow } = vi.hoisted(() => ({ mockGetThreadWorkflow: vi.fn() }))
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    getThreadTodos: vi.fn().mockResolvedValue([]),
    getThreadWorkspaceFiles: vi.fn().mockResolvedValue([]),
    getThreadPendingAsks: vi.fn().mockResolvedValue([]),
    getThreadTasks: vi.fn().mockResolvedValue([]),
    getThreadWorkflow: mockGetThreadWorkflow,
    getSnapshot: vi.fn().mockResolvedValue({ messages: [], active_runs: [] }),
    getMessages: vi.fn().mockResolvedValue([]),
    getActiveRuns: vi.fn().mockResolvedValue([]),
  }
})

import { replayFixture } from "./replayHarness"
import { PhaseTimeline } from "../PhaseTimeline"

const THREAD = "thread-tl"

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000")
  localStorage.clear()
  mockGetThreadWorkflow.mockResolvedValue({
    mode: "harness",
    definition_name: "X",
    run_status: "running",
    current_phase_index: 0,
    total_phases: null,
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

/** Replay a fixture into the store, then render the timeline over the real store. */
async function renderTimeline(fixture: string[]) {
  await replayFixture(THREAD, fixture)
  return render(<PhaseTimeline threadId={THREAD} />)
}

describe("Phase 094 — PhaseTimeline a11y + render states (INV-2)  [owner: Plan 03]", () => {
  it("axe has no violations: fxRunRunning", async () => {
    const { container } = await renderTimeline(fxRunRunning)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("axe has no violations: fxRunFailed", async () => {
    const { container } = await renderTimeline(fxRunFailed)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("axe has no violations: fxRunDone", async () => {
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "X",
      run_status: "completed",
      current_phase_index: 2,
      total_phases: 3,
    })
    const { container } = await renderTimeline(fxRunDone)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("axe has no violations: fxRunAskuserPaused", async () => {
    const { container } = await renderTimeline(fxRunAskuserPaused)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("axe has no violations: fxRunGatefailRetry + 1-phase + N-phase", async () => {
    // 1-phase (the gatefail-retry fixture is a single phase that ends done).
    const { container } = await renderTimeline(fxRunGatefailRetry)
    expect(await axe(container)).toHaveNoViolations()
    cleanup()
    // N-phase (the done fixture is a 3-phase run).
    const { container: c2 } = await renderTimeline(fxRunDone)
    expect(await axe(c2)).toHaveNoViolations()
  })

  it("sr-only role=status announcer is present at load", async () => {
    await renderTimeline(fxRunRunning)
    // ONE polite announcer, present at load (the visually-hidden region).
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("each PhaseCard button aria-expanded flips on open/close (APG accordion)", async () => {
    const user = userEvent.setup()
    // fxRunDone ends with all phases done → collapsed (aria-expanded=false),
    // togglable (terminal phases toggle). Pick the first phase's header button.
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "X",
      run_status: "completed",
      current_phase_index: 2,
      total_phases: 3,
    })
    await renderTimeline(fxRunDone)
    // Let the async getThreadWorkflow frame settle so a re-render can't race the
    // click (PhaseCard's local `open` persists, but we settle for determinism).
    await screen.findByText("Phase 3 / 3")
    const items = screen.getAllByRole("listitem")
    const firstBtn = within(items[0]).getByRole("button")
    expect(firstBtn).toHaveAttribute("aria-expanded", "false")
    await user.click(firstBtn)
    expect(firstBtn).toHaveAttribute("aria-expanded", "true")
    await user.click(firstBtn)
    expect(firstBtn).toHaveAttribute("aria-expanded", "false")
  })

  it("running phase row sets aria-busy=true, cleared on done/failed", async () => {
    // fxRunRunning leaves the last phase RUNNING → the <ol> is aria-busy.
    await renderTimeline(fxRunRunning)
    expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true")
    cleanup()

    // fxRunDone is terminal/completed → aria-busy is cleared (attribute absent).
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "X",
      run_status: "completed",
      current_phase_index: 2,
      total_phases: 3,
    })
    await renderTimeline(fxRunDone)
    expect(screen.getByRole("list")).not.toHaveAttribute("aria-busy")
  })
})
