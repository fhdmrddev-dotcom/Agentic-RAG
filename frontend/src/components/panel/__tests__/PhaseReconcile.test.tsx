/**
 * Phase 094 Plan 03 — INV-4 (the D-v2.5-03 reconcile-is-the-floor anti-drift rule,
 * DATA-CONTRACT §3(c)/§6 LOADING). Flips the Plan-01 Wave 0 RED scaffold GREEN.
 *
 * On mount the reconcile seeds `current_phase_index` + `total_phases`; thereafter
 * LIVE events mutate forward but NEVER move the "Phase i / N" counter backward.
 *
 * INV-4:
 *   - seed reconcile {current_phase_index:1, total_phases:3} (the fxRunRunning
 *     reconcileSeed) → the full 3-row skeleton renders BEFORE any further live
 *     event (the mount spinner-killer) with "Phase 2 / 3".
 *   - a regressing live phase_started{phase_index:0} arriving AFTER never moves
 *     the rendered "Phase i / N" backward.
 *
 * We drive the timeline through controlled `usePhases`/`useTasks` mocks (the same
 * `Phase[]` the reconcilePhases adapter + the live demux produce), re-rendering
 * with a regressing array to assert the counter floor holds.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { Phase } from "@/types"
import { fxRunRunningReconcileSeed } from "@/test-fixtures/harness094"

// Controlled hook state — the timeline reads usePhases/useTasks + getThreadWorkflow.
const hookState: { phases: Phase[] } = { phases: [] }

vi.mock("@/providers/StreamsProvider", () => ({
  usePhases: () => ({ data: hookState.phases, isLoading: false, error: null, reconcile: vi.fn() }),
  useTasks: () => ({ data: [], isLoading: false, error: null, reconcile: vi.fn() }),
  useViewingThread: () => "thread-recon",
}))

// getThreadWorkflow supplies the run-level frame (definition_name / run_status).
const { mockGetThreadWorkflow } = vi.hoisted(() => ({ mockGetThreadWorkflow: vi.fn() }))
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, getThreadWorkflow: mockGetThreadWorkflow }
})

import { PhaseTimeline } from "../PhaseTimeline"

/** Build the reconcile-floor skeleton the adapter produces (DATA-CONTRACT §3c). */
function skeleton(currentPhaseIndex: number, totalPhases: number): Phase[] {
  return Array.from({ length: totalPhases }, (_, i): Phase => ({
    slug: `phase-${i}`,
    phaseIndex: i,
    phaseType: "unknown",
    status: i < currentPhaseIndex ? "done" : i === currentPhaseIndex ? "running" : "pending",
    subAgents: [],
    pendingAsk: null,
  }))
}

beforeEach(() => {
  hookState.phases = []
  mockGetThreadWorkflow.mockResolvedValue({
    mode: "harness",
    definition_name: "X",
    run_status: "running",
    current_phase_index: fxRunRunningReconcileSeed.current_phase_index,
    total_phases: fxRunRunningReconcileSeed.total_phases,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("Phase 094 — reconcile floor / forward-only counter (INV-4)  [owner: Plan 03]", () => {
  it("the full N-phase skeleton renders from total_phases alone (3 rows) before any further live event", () => {
    // The reconcilePhases adapter seeds total_phases=3 rows on mount (the seed
    // gives current_phase_index:1, total_phases:3 → 3 rows: done, running, pending).
    hookState.phases = skeleton(
      fxRunRunningReconcileSeed.current_phase_index,
      fxRunRunningReconcileSeed.total_phases,
    )
    render(<PhaseTimeline threadId="thread-recon" />)

    // 3 phase rows render from total_phases alone — NOT a spinner.
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(3)
    // The honest "Phase 2 / 3" counter (current_phase_index 1 → ordinal 2).
    expect(screen.getByText("Phase 2 / 3")).toBeInTheDocument()
  })

  it("a regressing live phase_started{phase_index:0} never moves Phase i/N backward", () => {
    hookState.phases = skeleton(1, 3) // active = index 1 → "Phase 2 / 3"
    const { rerender } = render(<PhaseTimeline threadId="thread-recon" />)
    expect(screen.getByText("Phase 2 / 3")).toBeInTheDocument()

    // A regressing event flips the active row back to index 0 (running) — the
    // counter must NOT regress to "Phase 1 / 3" (reconcile is the floor).
    const regressed = skeleton(3, 3).map((p, i): Phase =>
      i === 0 ? { ...p, status: "running" } : { ...p, status: "pending" },
    )
    hookState.phases = regressed
    rerender(<PhaseTimeline threadId="thread-recon" />)

    // The counter holds its floor — never "Phase 1 / 3".
    expect(screen.queryByText("Phase 1 / 3")).not.toBeInTheDocument()
    expect(screen.getByText("Phase 2 / 3")).toBeInTheDocument()
  })
})
