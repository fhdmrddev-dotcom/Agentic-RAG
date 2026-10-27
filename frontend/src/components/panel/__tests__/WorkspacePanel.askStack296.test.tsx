/**
 * Phase 296-04 (BUG-261025-03, the UI half — D-02, D-24) — the Workspace panel's pending-ask stack
 * on a workflow run that is still waiting.
 *
 * Reported: three `EXPIRED · No response within 10:00 — agent stopped` cards beside a live
 * `NEEDS YOU` card, on a run that was still waiting for the person. The backend half (the boot
 * sweep re-asking the same step) is 296-02's. This suite holds the two UI arms:
 *
 *   (a) two unanswered harness prompts for the SAME workflow run render exactly one card, the
 *       newest. A Deep `ask_user` run can ask twice in parallel tool calls, so Deep prompts are
 *       never de-duplicated.
 *   (b) a harness prompt whose clock has passed, while its run is non-terminal, never says
 *       `agent stopped`. The run is still waiting, so the card keeps its answer control.
 *
 * The stack is rendered as the panel mounts it (`home="panel"`), over the same allow-list mocks
 * as `PendingAskStack.pausedRun.test.tsx`. The STORE is not mocked: the run status is read there.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import type { PendingAsk } from "@/types"

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

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, answerAskUser: vi.fn().mockResolvedValue(undefined) }
})

const THREAD = "thread-296-asks"

const hookState: { asks: PendingAsk[]; reconcile: ReturnType<typeof vi.fn> } = {
  asks: [],
  reconcile: vi.fn().mockResolvedValue(undefined),
}
const stackState: { lock: null; phases: unknown[] } = { lock: null, phases: [] }

vi.mock("@/providers/StreamsProvider", () => ({
  useViewingThread: () => THREAD,
  useAskUserPrompt: () => ({
    data: hookState.asks,
    isLoading: false,
    error: null,
    reconcile: hookState.reconcile,
  }),
  useWorkflowLockForThread: () => stackState.lock,
  usePhases: () => ({ data: stackState.phases, isLoading: false, error: null, reconcile: vi.fn() }),
}))

import { PAUSED_WAITING_LINE, PendingAskStack } from "../PendingAskCard"
import { useStreamsStore } from "@/stores/streamsStore"
import { useAskDraftStore } from "@/stores/askDraftStore"

function setRunStatus(status: string | null | undefined) {
  const next = new Map<string, string | null>()
  if (status !== undefined) next.set(THREAD, status)
  useStreamsStore.setState({ workflowRunStatusByThread: next })
}

afterEach(() => {
  vi.clearAllMocks()
  hookState.asks = []
  stackState.lock = null
  stackState.phases = []
  setRunStatus(undefined)
  useAskDraftStore.setState(useAskDraftStore.getInitialState(), true)
})

const HUMAN_STEP = {
  slug: "approve",
  phaseIndex: 0,
  phaseType: "llm_human_input",
  status: "running",
  subAgents: [],
  pendingAsk: null,
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

/** The run `1e932094` shape: one workflow run, re-asked by re-drives, each with a new tool call id. */
function harnessAsk(tcid: string, createdAt: string, prompt: string): PendingAsk {
  return {
    tool_call_id: tcid,
    prompt,
    options: ["Approve", "Reject"],
    timeout_seconds: 600,
    message_id: `msg-${tcid}`,
    run_id: "wr-1e932094",
    created_at: createdAt,
  }
}

const OLDEST = harnessAsk("tc-1", minutesAgo(70), "Approve the draft? (first ask)")
const MIDDLE = harnessAsk("tc-2", minutesAgo(67), "Approve the draft? (second ask)")
const NEWEST = harnessAsk("tc-3", minutesAgo(1), "Approve the draft? (latest ask)")

describe("296-04 / BUG-261025-03 (a) — one card per waiting workflow run", () => {
  it("three unanswered prompts for the same run render exactly one card, the newest", () => {
    hookState.asks = [OLDEST, MIDDLE, NEWEST]
    stackState.phases = [HUMAN_STEP]
    setRunStatus("active")
    render(<PendingAskStack home="panel" />)
    expect(screen.getByText(NEWEST.prompt)).toBeInTheDocument()
    expect(
      screen.queryByText(OLDEST.prompt),
      "a superseded ask for the same run is still on the panel",
    ).not.toBeInTheDocument()
    expect(screen.queryByText(MIDDLE.prompt)).not.toBeInTheDocument()
    expect(screen.queryByText(/agent stopped/)).not.toBeInTheDocument()
  })

  it("a paused run: the same three prompts still render one card", () => {
    hookState.asks = [OLDEST, MIDDLE, NEWEST]
    stackState.phases = [HUMAN_STEP]
    setRunStatus("paused")
    render(<PendingAskStack home="panel" />)
    expect(screen.getAllByRole("button", { name: "Send Answer" })).toHaveLength(1)
  })

  it("Deep (no workflow run on the thread): two asks from one run both stay", () => {
    const deepA: PendingAsk = { ...OLDEST, created_at: minutesAgo(1), prompt: "Deep question A" }
    const deepB: PendingAsk = { ...NEWEST, prompt: "Deep question B" }
    hookState.asks = [deepA, deepB]
    stackState.phases = []
    render(<PendingAskStack home="panel" />)
    expect(screen.getByText("Deep question A")).toBeInTheDocument()
    expect(screen.getByText("Deep question B")).toBeInTheDocument()
  })

  it("two different workflow runs keep one card each", () => {
    const otherRun: PendingAsk = { ...MIDDLE, run_id: "wr-other", created_at: minutesAgo(1) }
    hookState.asks = [otherRun, NEWEST]
    stackState.phases = [HUMAN_STEP]
    setRunStatus("active")
    render(<PendingAskStack home="panel" />)
    expect(screen.getByText(otherRun.prompt)).toBeInTheDocument()
    expect(screen.getByText(NEWEST.prompt)).toBeInTheDocument()
  })
})

describe("296-04 / BUG-261025-03 (b) — a waiting run's ask never says `agent stopped`", () => {
  it("the clock has passed and the run is active (re-driven): the card keeps its answer control", () => {
    hookState.asks = [OLDEST]
    stackState.phases = [HUMAN_STEP]
    setRunStatus("active")
    const { container } = render(<PendingAskStack home="panel" />)
    expect(
      container.textContent ?? "",
      "a live workflow run's ask read as if the agent had stopped",
    ).not.toContain("agent stopped")
    expect(screen.getByText(PAUSED_WAITING_LINE)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send Answer" })).toBeInTheDocument()
  })

  it("Deep: a clock expiry keeps today's wording (unchanged)", () => {
    hookState.asks = [{ ...OLDEST, prompt: "Deep expired question" }]
    stackState.phases = []
    const { container } = render(<PendingAskStack home="panel" />)
    expect(container.textContent ?? "").toContain("agent stopped")
  })
})
