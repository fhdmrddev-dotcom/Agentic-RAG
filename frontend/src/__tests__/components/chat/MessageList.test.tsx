/**
 * Phase 068.5 (Plan 01 — Wave 0): RED test stubs for `MessageList.tsx` empty-state
 * skeleton branch.
 *
 * Tests D-068.5-11 (cold-load 3-bubble skeleton with shimmer) + D-068.5-12
 * (skeleton clears the instant the first message renders).
 *
 * RED at task start (MessageSkeleton + empty-state ternary don't exist yet);
 * GREEN at Task 4 end.
 */
import { describe, it, expect, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import { MessageList } from "@/components/chat/MessageList"
import type { Message } from "@/types"

// jsdom lacks scrollIntoView; stub it so MessageList's auto-scroll effect
// (`bottomRef.current?.scrollIntoView`) doesn't throw inside passive effects.
beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = function () {}
  }
})

const NOW = "2026-05-13T00:00:00Z"

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "user",
    content: "Hello",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

describe("Phase 068.5 — MessageList skeleton", () => {
  it("renders <MessageSkeleton/> (data-testid='message-skeleton') when isLoading AND messages.length === 0", () => {
    // Phase 068.5 Gap-01: skeleton requires BOTH isLoading=true AND empty
    // messages. Empty + not-loading = new chat → no skeleton.
    render(<MessageList messages={[]} isStreaming={false} isLoading={true} />)
    expect(screen.getByTestId("message-skeleton")).toBeInTheDocument()
  })

  it("does NOT render the skeleton when at least one message is present", () => {
    render(<MessageList messages={[makeMessage()]} isStreaming={false} isLoading={true} />)
    expect(screen.queryByTestId("message-skeleton")).toBeNull()
  })

  it("Gap-01: does NOT render the skeleton on empty list when isLoading is false (new chat / no fetch in flight)", () => {
    render(<MessageList messages={[]} isStreaming={false} isLoading={false} />)
    expect(screen.queryByTestId("message-skeleton")).toBeNull()
  })

  it("Gap-01: defaults isLoading to false — empty list with no prop renders no skeleton", () => {
    render(<MessageList messages={[]} isStreaming={false} />)
    expect(screen.queryByTestId("message-skeleton")).toBeNull()
  })
})
