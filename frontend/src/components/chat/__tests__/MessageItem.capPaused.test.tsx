import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import React from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Message } from "@/types"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}))

const { continueRun } = vi.hoisted(() => ({
  continueRun: vi.fn().mockResolvedValue({ status: "ok" }),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, continueRun }
})

let mockLock: {
  runId: string
  mode: "harness"
  capPaused: boolean
  continuesRemaining: number
} | null = null

vi.mock("@/providers/StreamsProvider", () => ({
  useWorkflowLockForThread: () => mockLock,
}))

import { MessageItem } from "../MessageItem"

afterEach(() => {
  cleanup()
  continueRun.mockClear()
  mockLock = null
})

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "m-paused-1",
    thread_id: "t-1",
    user_id: "u-1",
    role: "assistant",
    content: "Partial analysis before iteration cap.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Message
}

const renderItem = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>)

describe("BUG-260818-03 — Durable cap_paused Continue affordance across reloads", () => {
  it("renders Continue card when workflowLock carries capPaused from reconcile", () => {
    mockLock = {
      runId: "run-deep-cap-456",
      mode: "harness",
      capPaused: true,
      continuesRemaining: 2,
    }

    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)

    expect(screen.getByText(/Reached the iteration limit/i)).toBeInTheDocument()
    const continueBtn = screen.getByTestId("continue-run")
    expect(continueBtn).toBeInTheDocument()
  })

  it("clicking Continue button calls continueRun with the reconciled runId", async () => {
    mockLock = {
      runId: "run-deep-cap-456",
      mode: "harness",
      capPaused: true,
      continuesRemaining: 2,
    }

    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)

    const continueBtn = screen.getByTestId("continue-run")
    fireEvent.click(continueBtn)

    await waitFor(() => expect(continueRun).toHaveBeenCalledTimes(1))
    expect(continueRun).toHaveBeenCalledWith("run-deep-cap-456")
  })

  it("shows stop message and no continue button when continuesRemaining is 0", () => {
    mockLock = {
      runId: "run-deep-cap-456",
      mode: "harness",
      capPaused: true,
      continuesRemaining: 0,
    }

    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)

    expect(
      screen.getByText(/Reached the Continue limit — this run is stopped/i)
    ).toBeInTheDocument()
    expect(screen.queryByTestId("continue-run")).not.toBeInTheDocument()
  })

  it("does not render Continue card when not the last assistant message", () => {
    mockLock = {
      runId: "run-deep-cap-456",
      mode: "harness",
      capPaused: true,
      continuesRemaining: 2,
    }

    renderItem(<MessageItem message={makeMessage()} isLastAssistant={false} />)

    expect(screen.queryByTestId("continue-run")).not.toBeInTheDocument()
    expect(screen.queryByText(/Reached the iteration limit/i)).not.toBeInTheDocument()
  })

  it("does not render Continue card when lock is cleared (normal unpaused state)", () => {
    mockLock = null

    renderItem(<MessageItem message={makeMessage()} isLastAssistant />)

    expect(screen.queryByTestId("continue-run")).not.toBeInTheDocument()
  })
})
