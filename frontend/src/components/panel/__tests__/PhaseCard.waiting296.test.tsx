/**
 * Phase 296-04 (295-D-uat-02, UI-SPEC B) — a step that is running while its run is paused reads
 * `! Waiting` in amber, not `● Running`.
 *
 * Measured live in 295's UAT: the run waited on a person and the panel's active step kept saying
 * Running. The reading is DERIVED, never a new wire status: `PhaseTimeline` reads the run status
 * off the frame it already fetched and passes one optional prop; the card does not fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"

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

import { PhaseCard } from "../PhaseCard"
import { PhaseTimeline } from "../PhaseTimeline"
import { useStreamsStore } from "@/stores/streamsStore"
import type { Phase } from "@/types"

const THREAD = "thread-296-waiting"

function runningStep(over: Partial<Phase> = {}): Phase {
  return {
    slug: "approve-send",
    phaseIndex: 0,
    phaseType: "llm_human_input",
    status: "running",
    subAgents: [],
    pendingAsk: null,
    ...over,
  }
}

/** The accordion header holds the status atom (glyph + word). */
const header = (container: HTMLElement) => container.querySelector("button") as HTMLElement

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useStreamsStore.setState({ phasesByThread: new Map() })
})

describe("296-04 / 295-D-uat-02 — a running step on a paused run reads Waiting", () => {
  it.each(["paused", "cap_paused"])("run %s: the running step reads `! Waiting` in amber", (status) => {
    const { container } = render(
      <PhaseCard phase={runningStep()} position={0} runPaused={status === "paused" || status === "cap_paused"} />,
    )
    const head = header(container)
    expect(head.textContent ?? "").toContain("Waiting")
    expect(head.textContent ?? "").toContain("!")
    expect(head.textContent ?? "").not.toContain("Running")
    const word = Array.from(head.querySelectorAll("*")).find((el) => el.textContent === "Waiting")
    expect(word?.closest(".text-\\[hsl\\(var\\(--warning\\)\\)\\]")).not.toBeNull()
  })

  // 296 review FE-WR-01: the instruments follow the reading. A paused run's step shows ONLY the
  // Waiting reading — no "<slug> running" progressbar, no pulsing "Working" line, no aria-busy.
  it("run paused: no running progressbar, no Working line, no aria-busy (296 review FE-WR-01)", () => {
    const { container } = render(<PhaseCard phase={runningStep()} position={0} runPaused />)
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
    expect(screen.queryByLabelText("approve-send running")).toBeNull()
    expect(container.querySelector("[data-activity-line]")).toBeNull()
    expect(container.textContent ?? "").not.toContain("Working")
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
    expect(header(container).textContent ?? "").toContain("Waiting")
  })

  it("run active: the running step keeps its progressbar, Working line and aria-busy", () => {
    const { container } = render(<PhaseCard phase={runningStep()} position={0} runPaused={false} />)
    expect(screen.getByLabelText("approve-send running")).not.toBeNull()
    expect(container.querySelector("[data-activity-line]")?.textContent ?? "").toContain("Working")
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it("an active run: the same step still reads Running", () => {
    const { container } = render(<PhaseCard phase={runningStep()} position={0} runPaused={false} />)
    expect(header(container).textContent ?? "").toContain("Running")
    expect(header(container).textContent ?? "").not.toContain("Waiting")
  })

  it("no answer yet (prop absent): today's reading, Running", () => {
    const { container } = render(<PhaseCard phase={runningStep()} position={0} />)
    expect(header(container).textContent ?? "").toContain("Running")
  })

  it("a step that is not running keeps its own word on a paused run", () => {
    const { container } = render(
      <PhaseCard phase={runningStep({ status: "done" })} position={0} runPaused />,
    )
    expect(header(container).textContent ?? "").toContain("Complete")
    expect(header(container).textContent ?? "").not.toContain("Waiting")
  })

  it("PhaseTimeline derives it from the fetched frame, and announces nothing new", async () => {
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "Send the summary",
      run_status: "paused",
      current_phase_index: 0,
      total_phases: 1,
    })
    useStreamsStore.setState({ phasesByThread: new Map([[THREAD, [runningStep()]]]) })
    render(<PhaseTimeline threadId={THREAD} />)
    const list = screen.getByRole("list", { name: "Phases" })
    await waitFor(() => expect(list.textContent ?? "").toContain("Waiting"))
    expect(list.textContent ?? "").not.toContain("Running")
    // No live-region announcement per step: the timeline's polite announcer is not written.
    expect(screen.getByRole("status").textContent ?? "").not.toContain("Waiting")
  })

  it("PhaseTimeline: an active run's running step still reads Running", async () => {
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "Send the summary",
      run_status: "active",
      current_phase_index: 0,
      total_phases: 1,
    })
    useStreamsStore.setState({ phasesByThread: new Map([[THREAD, [runningStep()]]]) })
    render(<PhaseTimeline threadId={THREAD} />)
    await waitFor(() => expect(mockGetThreadWorkflow).toHaveBeenCalled())
    const list = screen.getByRole("list", { name: "Phases" })
    expect(list.textContent ?? "").toContain("Running")
    expect(list.textContent ?? "").not.toContain("Waiting")
  })
})
