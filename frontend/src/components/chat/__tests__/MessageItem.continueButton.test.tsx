/**
 * BUG-260904-01 — the Continue button on the iteration-limit card must actually call the API.
 *
 * ⚠ **THE DEFECT THIS FILE EXISTS FOR WAS INVISIBLE TO EVERY EXISTING GUARD, AND THAT IS THE
 * FINDING.** `MessageItem.tsx` called `continueRun(workflowLock.runId)` with **no import of
 * `continueRun` anywhere in the file**, so clicking Continue threw
 * `ReferenceError: continueRun is not defined`, the surrounding `catch` logged it, the button
 * re-enabled, and the user saw a control that did nothing and said nothing.
 *
 * Two guards agreed it was fine while it was dead:
 *   1. `tsc` reported it — `TS2304: Cannot find name 'continueRun'` — but inside the project's
 *      66-error ACCEPTED BASELINE, so every gate read "no new errors" and nobody read the list.
 *   2. `WorkspacePanel.test.tsx:1218` asserts the call exists **as source text**
 *      (`expect(src).toMatch(/continueRun\(workflowLock\.runId\)/)`). A fence on the SHAPE of a
 *      call passes whether or not the symbol resolves.
 *
 * So this test does the one thing neither did: it RENDERS the card, CLICKS the button, and
 * asserts the module function was called. It was driven RED against the unfixed component
 * (`ReferenceError`) before the import was restored.
 *
 * MessageItem is rendered in isolation, following the harness in
 * `MessageItem.cancelledRun.test.tsx`: `@/lib/supabase` is stubbed because `@/lib/api` creates
 * its client at module load, and `useWorkflowLockForThread` is mocked to supply the cap-paused
 * lock that gates the card.
 */
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}))

// `vi.hoisted` because `vi.mock` factories are lifted above every const in this file.
const { continueRun } = vi.hoisted(() => ({
  continueRun: vi.fn().mockResolvedValue({ status: "ok" }),
}))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, continueRun }
})
const { requestProducerResubscribe } = vi.hoisted(() => ({ requestProducerResubscribe: vi.fn() }))
vi.mock("@/providers/producerResubscribeSignal", () => ({ requestProducerResubscribe }))

let lock: { runId: string; mode?: "harness" | "cap_paused"; capPaused: boolean; continuesRemaining: number } = {
  runId: "run-cap-1",
  capPaused: true,
  continuesRemaining: 2,
}
vi.mock("@/providers/StreamsProvider", () => ({
  useWorkflowLockForThread: () => lock,
  // ⚠ Phase 244 (244-05 T3): two more PURE store selectors are read by `MessageItem` for
  // D-244-22's sent-attachment chip. A partial mock factory leaves them `undefined` and the
  // component throws AT MOUNT — the `196-08` failure mode. Declared, not worked around.
  useWorkspaceFilesSnapshot: () => [],
  usePrecedingUserTurns: () => "|",
}))

import { MessageItem } from "../MessageItem"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Message } from "@/types"
import { useStreamsStore, markContinuing } from "@/stores/streamsStore"

afterEach(() => {
  cleanup()
  continueRun.mockClear()
  continueRun.mockResolvedValue({ status: "ok" })
  requestProducerResubscribe.mockClear()
  lock = { runId: "run-cap-1", capPaused: true, continuesRemaining: 2 }
  useStreamsStore.setState({ continuingThreads: new Set() })
})

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "m-1",
    thread_id: "t-1",
    user_id: "u-1",
    role: "assistant",
    content: "Partial answer before the cap.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Message
}

const renderItem = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>)

describe("BUG-260904-01 — the Continue button calls continueRun", () => {
  it("⭐ clicking Continue invokes continueRun with the lock's runId", async () => {
    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)

    const btn = screen.getByRole("button", { name: /continue/i })
    fireEvent.click(btn)

    await waitFor(() => expect(continueRun).toHaveBeenCalledTimes(1))
    expect(continueRun).toHaveBeenCalledWith("run-cap-1")
  })

  it("the tool-use-limit sentence renders with the card (the card is reachable at all)", () => {
    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)
    expect(screen.getByText("Reached the tool-use limit for this turn.")).toBeInTheDocument()
  })
})

// ── 292.1 (D-14 / D-07 copy): the Continue card reads Continuing… once a Continue is under way ──

describe("292.1 — the Continue card's Continuing… state", () => {
  it("1: a Deep pause reads the tool-use-limit sentence; a press calls continueRun once, then Continuing…", async () => {
    lock = { runId: "run-cap-1", mode: "cap_paused", capPaused: true, continuesRemaining: 2 }
    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)
    expect(screen.getByText("Reached the tool-use limit for this turn.")).toBeInTheDocument()
    const btn = screen.getByTestId("continue-run")
    expect(btn).toHaveTextContent("Continue (2 left)")

    fireEvent.click(btn)

    await waitFor(() => expect(continueRun).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId("continue-run")).toHaveTextContent("Continuing…"))
    expect(screen.getByTestId("continue-run")).toBeDisabled()
    expect(useStreamsStore.getState().continuingThreads.has("t-1")).toBe(true)
    fireEvent.click(screen.getByTestId("continue-run"))
    expect(continueRun).toHaveBeenCalledTimes(1)
  })

  it("2: a thread already continuing (typed continue) shows Continuing… and no clickable Continue", () => {
    lock = { runId: "run-cap-1", mode: "cap_paused", capPaused: true, continuesRemaining: 2 }
    markContinuing("t-1")
    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)
    const btn = screen.getByTestId("continue-run")
    expect(btn).toHaveTextContent("Continuing…")
    expect(btn).toBeDisabled()
    expect(screen.queryByText(/Continue \(2 left\)/)).not.toBeInTheDocument()
  })

  it("3: a refused continueRun still shows the exhausted sentence and marks nothing", async () => {
    lock = { runId: "run-cap-1", mode: "cap_paused", capPaused: true, continuesRemaining: 1 }
    continueRun.mockResolvedValue({ status: "refused" })
    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)
    fireEvent.click(screen.getByTestId("continue-run"))
    await waitFor(() =>
      expect(
        screen.getByText("Reached the Continue limit — this run is stopped. Start a new message to keep going."),
      ).toBeInTheDocument(),
    )
    expect(useStreamsStore.getState().continuingThreads.has("t-1")).toBe(false)
  })

  it("3b: the harness exhausted sentence is unchanged", () => {
    lock = { runId: "run-cap-1", mode: "harness", capPaused: true, continuesRemaining: 0 }
    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)
    expect(
      screen.getByText(
        "Reached the Continue limit — this run is stopped. Cancel the workflow to start something new.",
      ),
    ).toBeInTheDocument()
  })
})

// ── 292.1 UAT (run 5549031c): a Deep Continue re-attaches the SAME run's stream ──────────────
// A Deep Continue keeps its run id and returns no producer_run_id, and the first segment's stream
// already ended with `done` — so nothing listened to the continuation. The 200 now carries
// `stream_since` (the buffer's tail before the continuation spawned); the card hands it to the
// provider through the same per-thread signal the Harness re-drive uses.
describe("292.1 UAT — a Deep Continue asks to follow the same run from stream_since", () => {
  it("4: a Deep 200 with stream_since requests the SAME run id from that offset", async () => {
    lock = { runId: "run-cap-1", mode: "cap_paused", capPaused: true, continuesRemaining: 2 }
    continueRun.mockResolvedValue({
      status: "ok", run_id: "run-cap-1", continues_used: 1, continues_remaining: 2,
      stream_since: "1729765841000-7",
    })
    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)
    fireEvent.click(screen.getByTestId("continue-run"))
    await waitFor(() => expect(requestProducerResubscribe).toHaveBeenCalledTimes(1))
    expect(requestProducerResubscribe).toHaveBeenCalledWith({
      threadId: "t-1",
      producerRunId: "run-cap-1",
      since: "1729765841000-7",
    })
  })

  it("5: the Harness re-drive still follows its fresh producer, with no offset", async () => {
    lock = { runId: "wf-1", mode: "harness", capPaused: true, continuesRemaining: 2 }
    continueRun.mockResolvedValue({
      status: "ok", run_id: "wf-1", continues_used: 1, continues_remaining: 2, producer_run_id: "prod-9",
    })
    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)
    fireEvent.click(screen.getByTestId("continue-run"))
    await waitFor(() => expect(requestProducerResubscribe).toHaveBeenCalledTimes(1))
    expect(requestProducerResubscribe).toHaveBeenCalledWith({ threadId: "t-1", producerRunId: "prod-9" })
  })

  it("6: a Deep 200 with no stream_since (an older backend) requests nothing", async () => {
    lock = { runId: "run-cap-1", mode: "cap_paused", capPaused: true, continuesRemaining: 2 }
    continueRun.mockResolvedValue({ status: "ok", run_id: "run-cap-1", continues_used: 1, continues_remaining: 2 })
    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)
    fireEvent.click(screen.getByTestId("continue-run"))
    await waitFor(() => expect(continueRun).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    expect(requestProducerResubscribe).not.toHaveBeenCalled()
  })
})
