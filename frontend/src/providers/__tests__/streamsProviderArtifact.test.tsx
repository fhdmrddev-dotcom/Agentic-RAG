/**
 * Phase 273-05 (D-16) — the ONE StreamsProvider handler for agent-authored artifacts.
 *
 * `onArtifact` appends the record to the assistant message's `artifacts`, in arrival order,
 * deduped by id so a replayed frame (reconnect from an older cursor) REPLACES rather than
 * duplicates. It never touches `content` or `narrationContent`: an artifact is not answer text
 * and must not move the narration fold (BUG-260912-01's seam).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Message } from "@/types"

vi.mock("@/lib/api", () => ({
  getSnapshot: vi.fn(),
  getMessages: vi.fn(),
  postMessage: vi.fn(),
  subscribeToRun: vi.fn(),
  getActiveRuns: vi.fn(),
  cancelRun: vi.fn(),
}))

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

import { makeStreamCallbacks, DELTA_COALESCE_MS } from "@/providers/StreamsProvider"
import { chartBar, chartRedrawn, table16 } from "@/components/chat/artifacts/__tests__/fixtures"

const THREAD_ID = "thread-273-05"
const NOW = new Date().toISOString()

function makeHarness(assistantId = "assistant-273-05") {
  let messages: Message[] = [
    {
      id: "other",
      thread_id: THREAD_ID,
      user_id: "user-1",
      role: "user",
      content: "Chart revenue by region",
      created_at: NOW,
      updated_at: NOW,
    } as Message,
    {
      id: assistantId,
      thread_id: THREAD_ID,
      user_id: "user-1",
      role: "assistant",
      content: "",
      created_at: NOW,
      updated_at: NOW,
      tool_calls: [],
      runStatus: "streaming",
    } as Message,
  ]
  const setMessages = vi.fn((updater: Message[] | ((prev: Message[]) => Message[])) => {
    messages = typeof updater === "function" ? updater(messages) : updater
  })
  const callbacks = makeStreamCallbacks({ assistantId, threadId: THREAD_ID, setMessages })
  return { callbacks, assistant: () => messages[1], user: () => messages[0] }
}

const settle = () => vi.advanceTimersByTime(DELTA_COALESCE_MS * 3)

describe("onArtifact — append + dedupe by id, never touching the text", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("two artifacts with different ids append in arrival order", () => {
    const h = makeHarness()
    h.callbacks.onArtifact!(chartBar)
    h.callbacks.onArtifact!(table16)
    expect(h.assistant().artifacts).toEqual([chartBar, table16])
    // Only the assistant message is stamped.
    expect(h.user().artifacts).toBeUndefined()
  })

  it("a replayed id REPLACES in place rather than duplicating", () => {
    const h = makeHarness()
    h.callbacks.onArtifact!(chartBar)
    h.callbacks.onArtifact!(table16)
    const replay = { ...chartBar, label: "chart 1" }
    h.callbacks.onArtifact!(replay)
    const list = h.assistant().artifacts ?? []
    expect(list).toHaveLength(2)
    expect(list[0]).toBe(replay)
    expect(list[1]).toEqual(table16)
  })

  it("content and narrationContent are unchanged by the handler", () => {
    const h = makeHarness()
    h.callbacks.onDelta("Here is the breakdown.")
    settle()
    const before = h.assistant()
    h.callbacks.onArtifact!(chartRedrawn)
    settle()
    const after = h.assistant()
    expect(after.content).toBe(before.content)
    expect(after.content).toBe("Here is the breakdown.")
    expect(after.narrationContent).toBe(before.narrationContent)
    expect(after.artifacts).toEqual([chartRedrawn])
  })

  it("a delta still buffered in the coalescing window is not lost when an artifact lands", () => {
    const h = makeHarness()
    h.callbacks.onDelta("Revenue ")
    h.callbacks.onArtifact!(chartBar)
    h.callbacks.onDelta("grew.")
    settle()
    expect(h.assistant().content).toBe("Revenue grew.")
    expect(h.assistant().artifacts).toEqual([chartBar])
  })

  it("a record with no string id is still kept (the guard renders its notice), never dropped", () => {
    const h = makeHarness()
    h.callbacks.onArtifact!({ component: "chart" })
    expect(h.assistant().artifacts).toHaveLength(1)
  })
})
