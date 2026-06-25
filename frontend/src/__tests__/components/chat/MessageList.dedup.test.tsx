/**
 * BUG-260626-01 regression — MessageList must collapse same-runId duplicates
 * before render.
 *
 * Root cause (Phase 123 SC#10 Axis-2 lived UAT, 2026-06-26): in the
 * live/just-completed window of a MULTI-RUN thread the chat bucket can
 * transiently hold TWO assistant messages with the SAME runId — the
 * in-place-completed `temp-…` placeholder AND the persisted/reconciled row.
 * Both are keyed `run-${runId}`, so React duplicated/omitted subtrees
 * (duplicated GENERATED FILES panels, KB source-doc bleed; console: "two
 * children with the same key, run-…").
 *
 * The fix dedups by runId before `.map()`, preferring the persisted (non-temp)
 * row. These tests pin that behavior. MessageItem is mocked to a minimal marker
 * so we can count rendered rows by id/runId deterministically (the sibling
 * MessageList.test.tsx renders the REAL MessageItem for its chip tests; mocking
 * it here in a separate file keeps the two concerns isolated).
 */
import { describe, it, expect, beforeAll, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { Message } from "@/types"

// Mock MessageItem to a minimal marker carrying the rendered id + runId so we
// can assert exactly how many rows survive the dedup, and which one is kept.
vi.mock("@/components/chat/MessageItem", () => ({
  MessageItem: ({ message }: { message: Message }) => (
    <div data-testid="mi" data-id={message.id} data-runid={message.runId ?? ""} />
  ),
}))

// Imported AFTER the mock so MessageList picks up the mocked MessageItem.
import { MessageList } from "@/components/chat/MessageList"

// jsdom lacks scrollIntoView; MessageList's auto-scroll effect calls it.
beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = function () {}
  }
})

const NOW = "2026-06-26T00:00:00Z"

function asst(overrides: Partial<Message> = {}): Message {
  return {
    id: "a-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: "x",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

function user(overrides: Partial<Message> = {}): Message {
  return {
    id: "u-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "user",
    content: "hi",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

describe("BUG-260626-01 — MessageList dedups same-runId temp + persisted rows", () => {
  it("renders exactly ONE row when a temp placeholder and its persisted twin share a runId", () => {
    render(
      <MessageList
        isStreaming={false}
        messages={[
          asst({ id: "real-uuid", runId: "R", runStatus: "completed" }),
          asst({ id: "temp-123", runId: "R", runStatus: "completed" }),
        ]}
      />
    )
    const rows = screen.getAllByTestId("mi")
    expect(rows).toHaveLength(1)
    // keeps the persisted (non-temp) row regardless of array order
    expect(rows[0].getAttribute("data-id")).toBe("real-uuid")
  })

  it("keeps the persisted row even when the temp placeholder appears FIRST in the array", () => {
    render(
      <MessageList
        isStreaming={false}
        messages={[
          asst({ id: "temp-123", runId: "R", runStatus: "completed" }),
          asst({ id: "real-uuid", runId: "R", runStatus: "completed" }),
        ]}
      />
    )
    const rows = screen.getAllByTestId("mi")
    expect(rows).toHaveLength(1)
    expect(rows[0].getAttribute("data-id")).toBe("real-uuid")
  })

  it("preserves a lone streaming temp when no persisted twin exists yet", () => {
    render(
      <MessageList
        isStreaming={true}
        messages={[asst({ id: "temp-123", runId: "R", runStatus: "streaming" })]}
      />
    )
    const rows = screen.getAllByTestId("mi")
    expect(rows).toHaveLength(1)
    expect(rows[0].getAttribute("data-id")).toBe("temp-123")
  })

  it("does NOT collapse two assistant messages with DIFFERENT runIds", () => {
    render(
      <MessageList
        isStreaming={false}
        messages={[asst({ id: "a1", runId: "R1" }), asst({ id: "a2", runId: "R2" })]}
      />
    )
    expect(screen.getAllByTestId("mi")).toHaveLength(2)
  })

  it("does NOT dedup rows without a runId (user rows / harness answers keep their own keys)", () => {
    render(
      <MessageList
        isStreaming={false}
        messages={[
          user({ id: "u1" }),
          asst({ id: "h1", runId: undefined }),
          asst({ id: "h2", runId: undefined }),
        ]}
      />
    )
    expect(screen.getAllByTestId("mi")).toHaveLength(3)
  })
})
