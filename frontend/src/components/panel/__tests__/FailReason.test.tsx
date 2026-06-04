/**
 * Phase 094 Plan 03 — INV-3b (the FRONTEND half of the RC-4 honesty contract,
 * DATA-CONTRACT §6 FAILED). Flips the Plan-01 Wave 0 RED scaffold GREEN.
 *
 * The timeline keys failure off `run_failed.reason` / terminal `gate_failed.error`,
 * NEVER the terminal `done` sentinel (which is wrongly `done` on a failed harness
 * run — the RC-4 bug). We replay the `fxRunFailed` / `fxRunFailedReasonUnknown`
 * wire fixtures (each ENDS with the wrong terminal `done`) through the REAL
 * normalizer (replayHarness) and assert the derived failing phase renders FAILED
 * with the reason — and the empty-reason case renders the explicit sentinel, never
 * an empty red card.
 *
 * INV-3b:
 *   - fxRunFailed → the failing phase row renders FAILED (not done) + surfaces the
 *     closed-taxonomy reason in a role="alert", despite the `done` sentinel.
 *   - fxRunFailedReasonUnknown (run_failed{reason:""}) → renders the verbatim
 *     "Failure reason not captured by the backend" sentinel.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { Phase } from "@/types"
import { fxRunFailed, fxRunFailedReasonUnknown } from "@/test-fixtures/harness094"

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

// Provider mount fires reconcile/loadMessages on setViewingThread — stub the
// chat-snapshot GETs so replayHarness's throwaway provider stays off the network.
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    getThreadTodos: vi.fn().mockResolvedValue([]),
    getThreadWorkspaceFiles: vi.fn().mockResolvedValue([]),
    getThreadPendingAsks: vi.fn().mockResolvedValue([]),
    getThreadTasks: vi.fn().mockResolvedValue([]),
    getThreadWorkflow: vi.fn().mockResolvedValue({ mode: "deep" }),
    getSnapshot: vi.fn().mockResolvedValue({ messages: [], active_runs: [] }),
    getMessages: vi.fn().mockResolvedValue([]),
    getActiveRuns: vi.fn().mockResolvedValue([]),
  }
})

import { replayFixture } from "./replayHarness"
import { PhaseCard } from "../PhaseCard"

const THREAD = "thread-fail"

let failedPhases: Phase[] = []
let reasonUnknownPhases: Phase[] = []

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000")
  localStorage.clear()
})

beforeAll(async () => {
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000")
  failedPhases = (await replayFixture(THREAD, fxRunFailed)).phases
  reasonUnknownPhases = (await replayFixture(THREAD, fxRunFailedReasonUnknown)).phases
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** The single phase in the fixture, which the run_failed sentinel marks failed. */
function failingPhase(phases: Phase[]): Phase {
  const p = phases.find((ph) => ph.status === "failed") ?? phases[phases.length - 1]
  expect(p).toBeDefined()
  return p
}

describe("Phase 094 — failure honesty (INV-3b / RC-4 frontend)  [owner: Plan 03]", () => {
  it("fxRunFailed renders FAILED (not done) despite the RC-4 terminal `done` sentinel", () => {
    const phase = failingPhase(failedPhases)
    // The normalizer keyed the failure off run_failed, NOT the trailing `done`.
    expect(phase.status).toBe("failed")

    render(<PhaseCard phase={phase} position={phase.phaseIndex} />)
    // The status atom reads "Failed" (real text, non-color-only) — never "Complete".
    expect(screen.getByText("Failed")).toBeInTheDocument()
    expect(screen.queryByText("Complete")).not.toBeInTheDocument()
    // The reason renders in a role="alert" (assertive), distinct from the announcer.
    const alert = screen.getByRole("alert")
    expect(alert).toBeInTheDocument()
    // gate_failed taxonomy → the validation-gate reason copy (attempt is real).
    expect(alert).toHaveTextContent(/Validation gate failed/i)
  })

  it('fxRunFailedReasonUnknown (run_failed{reason:""}) renders the reason_unknown sentinel "Failure reason not captured by the backend", never an empty red card', () => {
    const phase = failingPhase(reasonUnknownPhases)
    expect(phase.status).toBe("failed")
    // The error/reason is empty on the wire — the sentinel is the contract.
    expect((phase.error ?? "").trim()).toBe("")

    render(<PhaseCard phase={phase} position={phase.phaseIndex} />)
    const alert = screen.getByRole("alert")
    // The verbatim reason_unknown sentinel — NEVER an empty red card.
    expect(alert).toHaveTextContent(/Failure reason not captured by the backend/i)
  })
})
