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

const lock = {
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

afterEach(() => {
  cleanup()
  continueRun.mockClear()
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

  it("the iteration-limit sentence renders with the card (the card is reachable at all)", () => {
    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)
    expect(screen.getByText(/Reached the iteration limit/i)).toBeInTheDocument()
  })
})
