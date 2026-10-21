/**
 * Phase 295 gap round 1 (295-08 / SEED-361 / 295-VALIDATION.md S1) — a PAUSED workflow run's
 * pending ask stays answerable in the chat thread's homes.
 *
 * The defect, measured live by 295-07 on runs `3ec118a2` / `108bb381`: the Workspace panel showed
 * a paused run's ask as "RETIRED · The run was stopped, so this question no longer needs an
 * answer", with Send disabled, while the run page offered the answer. A paused run has no live
 * producer, so `GET /threads/{id}/workflow` reports `lock_is_stale: true` and the client never
 * sets the workflow lock; the stack's `runIsOver = lock == null && phases.length > 0` then read
 * true for a run that is waiting on the person.
 *
 * The fix reads the run status the provider's phase reconcile already fetches (one store field,
 * `workflowRunStatusByThread`), so these cases seed THAT field and never a new fetch.
 *
 * The guard is pinned in both directions: a stopped run still retires its ask, and a Deep thread
 * (no phases) never does.
 *
 * Mocks copied from `PendingAskStack.oneInput.test.tsx` (allow-list StreamsProvider factory). The
 * STORE module is not mocked, which is how the stack reads the run status in production.
 */
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { mockPendingAskWithRunId } from "./fixtures"
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
  return {
    ...actual,
    answerAskUser: vi.fn().mockResolvedValue(undefined),
  }
})

const THREAD = "thread-paused"

const hookState: { asks: PendingAsk[] } = { asks: [] }
const stackState: { lock: null; phases: unknown[] } = { lock: null, phases: [] }

vi.mock("@/providers/StreamsProvider", () => ({
  useViewingThread: () => THREAD,
  useAskUserPrompt: () => ({
    data: hookState.asks,
    isLoading: false,
    error: null,
    reconcile: vi.fn().mockResolvedValue(undefined),
  }),
  useWorkflowLockForThread: () => stackState.lock,
  usePhases: () => ({ data: stackState.phases, isLoading: false, error: null, reconcile: vi.fn() }),
}))

import { PAUSED_WAITING_LINE, PendingAskStack, RUN_STOPPED_RETIREMENT_LINE } from "../PendingAskCard"
import { useStreamsStore } from "@/stores/streamsStore"
import { useAskDraftStore } from "@/stores/askDraftStore"

beforeAll(() => {
  // Radix Select needs these in jsdom (the AskFolderChoice.test.tsx precedent).
  Element.prototype.scrollIntoView = vi.fn()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
})

/** Seed the ONE store field the fix reads: the run status off the thread's workflow read. */
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

/** One step of a workflow run: the human/approval step the run is paused on. */
const HUMAN_STEP = {
  slug: "approve-send",
  phaseIndex: 1,
  phaseType: "llm_human_input",
  status: "running",
  subAgents: [],
  pendingAsk: null,
}

/** An armed-approval style ask: it has a deadline, so the 289 paused line has a clock to replace. */
const approvalAsk: PendingAsk = {
  ...mockPendingAskWithRunId,
  tool_call_id: "tc-approval",
  prompt: "Send the summary email to the client?",
  options: ["Approve", "Reject"],
  timeout_seconds: 300,
}

/** The found-nothing pause, as the server sends it (295-03): no deadline, three worded choices. */
const foundNothingAsk: PendingAsk = {
  ...mockPendingAskWithRunId,
  tool_call_id: "tc-found-nothing",
  prompt: "The search found nothing in Contracts. What should the run do?",
  options: ["Search another folder", "Continue without sources", "Stop the run"],
  timeout_seconds: null,
  engine_pause: {
    kind: "found_nothing",
    phase: "search-kb",
    continue_allowed: true,
    locked: false,
    folders: [
      { id: "f-leases", name: "Leases", depth: 0 },
      { id: "f-hr", name: "HR", depth: 1 },
    ],
  },
} as PendingAsk

const sendButton = () => screen.getByRole("button", { name: "Send Answer" }) as HTMLButtonElement

describe("295-08 — a paused workflow run's ask is answerable in the chat thread (SEED-361)", () => {
  it("panel home: no lock + phases + run paused → NOT retired, Send enabled, the paused line shows", async () => {
    const user = userEvent.setup()
    hookState.asks = [approvalAsk]
    stackState.phases = [HUMAN_STEP]
    setRunStatus("paused")
    const { container } = render(<PendingAskStack home="panel" />)

    const text = container.textContent ?? ""
    expect(text).not.toContain("Retired")
    expect(text).not.toContain(RUN_STOPPED_RETIREMENT_LINE)
    expect(screen.getByText(approvalAsk.prompt)).toBeInTheDocument()
    expect(screen.getByText(PAUSED_WAITING_LINE)).toBeInTheDocument()

    await user.click(screen.getByRole("radio", { name: /Approve/ }))
    const btn = sendButton()
    expect(btn.disabled).toBe(false)
    expect(btn.getAttribute("aria-disabled")).toBe("false")
  })

  it("chat home: the found-nothing pause shows its three choices and the folder chooser", async () => {
    const user = userEvent.setup()
    hookState.asks = [foundNothingAsk]
    stackState.phases = [{ ...HUMAN_STEP, slug: "search-kb", phaseIndex: 0, phaseType: "llm_single" }]
    setRunStatus("paused")
    const { container } = render(<PendingAskStack />)

    expect(container.textContent ?? "").not.toContain("Retired")
    const group = screen.getByRole("radiogroup")
    for (const label of foundNothingAsk.options ?? []) {
      expect(within(group).getByText(label)).toBeInTheDocument()
    }
    // The chooser appears only once the search choice is selected (295-06).
    expect(screen.queryByText("Folder to search")).not.toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: /Search another folder/ }))
    expect(screen.getByText("Folder to search")).toBeInTheDocument()
    // Send waits for a folder, as on the run page.
    expect(sendButton().disabled).toBe(true)
    await user.click(screen.getByLabelText("Folder to search"))
    await user.click(await screen.findByRole("option", { name: "Leases" }))
    expect(sendButton().disabled).toBe(false)
  })

  it("chat pointer: with a panel home mounted, a paused run's ask still gets its pointer", () => {
    hookState.asks = [approvalAsk]
    stackState.phases = [HUMAN_STEP]
    setRunStatus("paused")
    render(
      <>
        <PendingAskStack home="panel" />
        <PendingAskStack />
      </>,
    )
    expect(screen.getAllByTestId("ask-pointer")).toHaveLength(1)
    expect(screen.getAllByRole("button", { name: "Send Answer" })).toHaveLength(1)
  })
})

describe("295-08 — the retirement guard still holds in both directions", () => {
  it("no lock + phases + run cancelled → the ask is RETIRED with the stop sentence, no Send", () => {
    hookState.asks = [approvalAsk]
    stackState.phases = [HUMAN_STEP]
    setRunStatus("cancelled")
    const { container } = render(<PendingAskStack home="panel" />)
    expect(container.textContent ?? "").toContain("Retired")
    expect(screen.getByText(RUN_STOPPED_RETIREMENT_LINE)).toBeInTheDocument()
    // The retired arm keeps Send visible and dead on both axes, with no chips to choose from.
    expect(sendButton().disabled).toBe(true)
    expect(sendButton().getAttribute("aria-disabled")).toBe("true")
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
  })

  it("no lock + phases + no run status (the anchor is gone) → still RETIRED", () => {
    hookState.asks = [approvalAsk]
    stackState.phases = [HUMAN_STEP]
    setRunStatus(null)
    const { container } = render(<PendingAskStack home="panel" />)
    expect(container.textContent ?? "").toContain("Retired")
    expect(sendButton().disabled).toBe(true)
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
  })

  it("no lock + phases + the store has never heard of the thread → still RETIRED (unchanged default)", () => {
    hookState.asks = [approvalAsk]
    stackState.phases = [HUMAN_STEP]
    const { container } = render(<PendingAskStack home="panel" />)
    expect(container.textContent ?? "").toContain("Retired")
  })

  it("a Deep thread (no phases) never retires, whatever the run status reads", () => {
    hookState.asks = [approvalAsk]
    stackState.phases = []
    setRunStatus("cancelled")
    const { container } = render(<PendingAskStack home="panel" />)
    expect(container.textContent ?? "").not.toContain("Retired")
    expect(screen.getByRole("button", { name: "Send Answer" })).toBeInTheDocument()
    // And a Deep ask is not a paused run: the clock stays, the paused line does not appear.
    expect(screen.queryByText(PAUSED_WAITING_LINE)).not.toBeInTheDocument()
  })
})
