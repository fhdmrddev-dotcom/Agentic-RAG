import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import React from "react"
import { MessageItem } from "../MessageItem"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Message } from "@/types"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    continueRun: vi.fn().mockResolvedValue({ status: "ok" }),
  }
})

vi.mock("@/providers/StreamsProvider", () => ({
  useWorkflowLockForThread: () => null,
  // ⚠ Phase 244 (244-05 T3): two more PURE store selectors are read by `MessageItem` for
  // D-244-22's sent-attachment chip. A partial mock factory leaves them `undefined` and the
  // component throws AT MOUNT — the `196-08` failure mode. Declared, not worked around.
  useWorkspaceFilesSnapshot: () => [],
  usePrecedingUserTurns: () => "|",
}))

afterEach(() => {
  cleanup()
})

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "m-failed-1",
    thread_id: "t-1",
    user_id: "u-1",
    role: "assistant",
    content: "Something failed mid-turn.",
    runStatus: "failed",
    model: "claude-3-5-sonnet",
    provider: "anthropic",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Message
}

const renderItem = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>)

describe("BUG-260818-01 & BUG-260818-02 — Retry turn button and model/provider preservation", () => {
  it("renders 'Retry turn' button on failed assistant messages", () => {
    renderItem(<MessageItem message={makeMessage({ runStatus: "failed" })} />)

    const btn = screen.getByTestId("retry-turn-button")
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent("Retry turn")
    expect(btn).toHaveAttribute("aria-label", "Retry turn")
    expect(screen.queryByRole("button", { name: /^resume$/i })).not.toBeInTheDocument()
  })

  it("renders 'Retry turn' button on timed_out assistant messages", () => {
    renderItem(<MessageItem message={makeMessage({ runStatus: "timed_out" })} />)

    const btn = screen.getByTestId("retry-turn-button")
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent("Retry turn")
  })

  it("clicking 'Retry turn' invokes onResume callback with the message carrying model and provider", () => {
    const onResume = vi.fn()
    const msg = makeMessage({
      model: "deepseek-chat",
      provider: "deepseek",
      runStatus: "failed",
    })

    renderItem(<MessageItem message={msg} onResume={onResume} />)

    const btn = screen.getByTestId("retry-turn-button")
    fireEvent.click(btn)

    expect(onResume).toHaveBeenCalledTimes(1)
    expect(onResume).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "m-failed-1",
        model: "deepseek-chat",
        provider: "deepseek",
      })
    )
  })

  it("does not render Retry turn on completed or cancelled messages", () => {
    const { unmount } = renderItem(<MessageItem message={makeMessage({ runStatus: "completed" })} />)
    expect(screen.queryByTestId("retry-turn-button")).not.toBeInTheDocument()
    unmount()

    renderItem(<MessageItem message={makeMessage({ runStatus: "cancelled" })} />)
    expect(screen.queryByTestId("retry-turn-button")).not.toBeInTheDocument()
  })
})
