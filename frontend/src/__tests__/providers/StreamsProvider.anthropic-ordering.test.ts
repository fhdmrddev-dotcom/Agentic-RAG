/**
 * Phase 075.1 Plan 03 Task 1 — unit tests for the `makeStreamCallbacks` reducer
 * in `frontend/src/providers/StreamsProvider.tsx`, focused on Anthropic's
 * mixed text + tool_use content-block ordering (B-260519-01).
 *
 * Anthropic's normalized SSE stream INTERLEAVES text_delta and tool_use blocks
 * (see backend/app/services/anthropic_service.py:194-259). A single response
 * can be:
 *   delta(text1) → tool_preparing(idx=0) → tool_start(idx=0) → delta(text2)
 *     → tool_preparing(idx=1) → tool_start(idx=1) → delta(text3)
 *     → tool_end(idx=0) → tool_end(idx=1)
 *
 * The reducer MUST preserve `m.content` across every callback EXCEPT `onDelta`
 * (which appends). Any callback that returns `{ ...m, content: "" }` or
 * `{ ...m, content: undefined }` outside of onDelta is a regression of this
 * invariant — captured by Tests 1, 2, 4 below. Test 3 is a regression check
 * for OpenAI's simpler delta→tool→delta ordering.
 *
 * The reducer factory is module-exported alongside `_isTransientStreamEnd` so
 * tests can drive it directly without spinning up the full <StreamsProvider>
 * render tree (mirrors Plan 01's pattern; avoids the pre-existing waitFor flakes
 * in streamsProvider.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Message } from "@/types"

// Match useMessages.test.ts: stub @/lib/api fully (no importActual — eager
// Supabase client load fails without VITE_SUPABASE_URL in vitest env).
vi.mock("@/lib/api", () => ({
  getSnapshot: vi.fn(),
  getMessages: vi.fn(),
  postMessage: vi.fn(),
  subscribeToRun: vi.fn(),
  getActiveRuns: vi.fn(),
  cancelRun: vi.fn(),
}))

// Match useMessages.test.ts: stub supabase auth so module load doesn't reach
// a real Supabase URL.
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

// IMPORTANT: import AFTER the mocks so the SUT module loads cleanly.
import { makeStreamCallbacks } from "@/providers/StreamsProvider"

const ASSISTANT_ID = "assistant-1"
const THREAD_ID = "thread-1"
const NOW = new Date().toISOString()

function initialAssistantMessage(): Message {
  return {
    id: ASSISTANT_ID,
    thread_id: THREAD_ID,
    user_id: "user-1",
    role: "assistant",
    content: "",
    created_at: NOW,
    updated_at: NOW,
    tool_calls: [],
    runStatus: "streaming",
  }
}

/**
 * Test harness: build a `setMessages` function backed by a mutable array; the
 * factory's callbacks consume it just like the real provider does. After driving
 * a sequence of events we inspect the final message state.
 */
function makeHarness() {
  let messages: Message[] = [initialAssistantMessage()]
  const snapshots: Message[][] = []
  const setMessages: (
    updater: Message[] | ((prev: Message[]) => Message[]),
  ) => void = (updater) => {
    messages = typeof updater === "function" ? updater(messages) : updater
    // Deep-copy snapshot for invariant checks (content-loss detection).
    snapshots.push(messages.map((m) => ({ ...m, tool_calls: m.tool_calls ? [...m.tool_calls] : undefined })))
  }
  const callbacks = makeStreamCallbacks({
    assistantId: ASSISTANT_ID,
    threadId: THREAD_ID,
    setMessages,
  })
  const current = () => messages[0]
  return { callbacks, current, snapshots }
}

describe("makeStreamCallbacks reducer — Anthropic content-block ordering (Plan 03 Task 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("Test 1: interleaved delta → tool_use(0) → delta → tool_use(1) → delta → tool_ends preserves all text and tool order", () => {
    const { callbacks, current, snapshots } = makeHarness()

    // Mixed Anthropic ordering: 3 text deltas interleaved between 2 tool_use blocks.
    callbacks.onDelta("text1")
    callbacks.onToolPreparing!("search-documents", 0)
    callbacks.onToolStart!("search-documents", { query: "foo" })
    callbacks.onDelta("text2")
    callbacks.onToolPreparing!("analyze_document", 1)
    callbacks.onToolStart!("analyze_document", { document_id: "doc-1" })
    callbacks.onDelta("text3")
    callbacks.onToolEnd!("search-documents", "search-result-1")
    callbacks.onToolEnd!("analyze_document", "analyze-result-1")

    const m = current()
    // 3 text deltas accumulated in original order.
    expect(m.content).toBe("text1text2text3")
    // 2 tool calls, both terminal, in iteration order (preparing → running → done).
    expect(m.tool_calls).toHaveLength(2)
    expect(m.tool_calls![0].name).toBe("search-documents")
    expect(m.tool_calls![0].status).toBe("done")
    expect(m.tool_calls![0].result).toBe("search-result-1")
    expect(m.tool_calls![1].name).toBe("analyze_document")
    expect(m.tool_calls![1].status).toBe("done")
    expect(m.tool_calls![1].result).toBe("analyze-result-1")

    // CONTENT-LOSS INVARIANT: no intermediate snapshot may show empty content
    // after the first text delta landed. We snapshot AFTER each setMessages
    // call, so once content > "" once, it must never go backwards.
    let sawContent = false
    for (const snap of snapshots) {
      const msg = snap[0]
      if (sawContent) {
        // Once we've seen content, every subsequent snapshot's content MUST be a
        // superset of the previous (only onDelta mutates content, and only by
        // appending — every other callback must spread-preserve the existing
        // content value).
        expect(msg.content.length).toBeGreaterThan(0)
      }
      if (msg.content.length > 0) sawContent = true
    }
  })

  it("Test 2: pre-tool text concatenates with post-tool text — single tool sandwich", () => {
    const { callbacks, current } = makeHarness()

    callbacks.onDelta("hello")
    callbacks.onDelta(" world")
    callbacks.onToolPreparing!("execute_code", 0)
    callbacks.onToolStart!("execute_code", { code: "print(1)" })
    callbacks.onToolEnd!("execute_code", "1\n")
    callbacks.onDelta("done")

    const m = current()
    expect(m.content).toBe("hello worlddone")
    expect(m.tool_calls).toHaveLength(1)
    expect(m.tool_calls![0].name).toBe("execute_code")
    expect(m.tool_calls![0].status).toBe("done")
  })

  it("Test 3 (OpenAI regression): standard delta → tool → delta ordering still produces correct end-state", () => {
    const { callbacks, current } = makeHarness()

    // OpenAI ordering — single text segment, then tool, then more text.
    callbacks.onDelta("Let me search for that. ")
    callbacks.onToolPreparing!("search-documents", 0)
    callbacks.onToolStart!("search-documents", { query: "openai" })
    callbacks.onToolEnd!("search-documents", "result")
    callbacks.onDelta("Found it.")

    const m = current()
    expect(m.content).toBe("Let me search for that. Found it.")
    expect(m.tool_calls).toHaveLength(1)
    expect(m.tool_calls![0].status).toBe("done")
    expect(m.tool_calls![0].result).toBe("result")
  })

  it("Test 4: tool_args_progress events (Phase 075 D-075-09) do NOT interrupt text accumulation", () => {
    // The api.ts SSE parser has NO consumer for `tool_args_progress` (D-075-12 —
    // backend-only primitive; silent fallthrough in the parser). This test
    // confirms the invariant by interleaving direct callback fires of onDelta
    // around what would be a tool_args_progress no-op: text accumulates without
    // any callback-driven content reset.
    const { callbacks, current } = makeHarness()

    callbacks.onDelta("t1")
    // Simulate the time during which tool_args_progress events would arrive on
    // the wire. Because no callback consumes them, no reducer mutation happens
    // — the next onDelta must see content="t1" and append cleanly.
    // (The unknown-event-type fallthrough in api.ts:415-458 was verified by
    // `grep tool_args_progress frontend/src` returning zero hits.)
    callbacks.onToolPreparing!("execute_code", 0)
    callbacks.onDelta("t2")

    const m = current()
    expect(m.content).toBe("t1t2")
    // The preparing entry survives the second delta — Anthropic-ordering invariant.
    expect(m.tool_calls).toHaveLength(1)
    expect(m.tool_calls![0].status).toBe("preparing")
  })

  it("Invariant: every reducer return-object in makeStreamCallbacks preserves m.content via spread (no explicit overwrite)", () => {
    // Drive an event that exercises EVERY callback that mutates the assistant
    // message, then assert content survives unchanged (other than onDelta).
    const { callbacks, current } = makeHarness()

    callbacks.onDelta("preserved-text")
    const beforeContent = current().content
    expect(beforeContent).toBe("preserved-text")

    // Every callback below MUST preserve m.content unchanged.
    callbacks.onToolPreparing!("execute_code", 0)
    expect(current().content).toBe(beforeContent)

    callbacks.onToolStart!("execute_code", { code: "x" })
    expect(current().content).toBe(beforeContent)

    callbacks.onCodeExecuting!(0, 1.5)
    expect(current().content).toBe(beforeContent)

    callbacks.onCodeStdout!("hello\n")
    expect(current().content).toBe(beforeContent)

    callbacks.onCodeStderr!("warn\n")
    expect(current().content).toBe(beforeContent)

    callbacks.onCodeExecutionComplete!(0, 1500, [], undefined)
    expect(current().content).toBe(beforeContent)

    callbacks.onToolEnd!("execute_code", "result")
    expect(current().content).toBe(beforeContent)

    callbacks.onSources!([{ document_id: "d1", filename: "f1" }])
    expect(current().content).toBe(beforeContent)

    callbacks.onCitations!([])
    expect(current().content).toBe(beforeContent)

    callbacks.onConfidence!("high", 0.9, null)
    expect(current().content).toBe(beforeContent)

    callbacks.onSuggestions!(["q1"])
    expect(current().content).toBe(beforeContent)

    callbacks.onPlanning!(1)
    expect(current().content).toBe(beforeContent)

    callbacks.onIterationStart!(2)
    expect(current().content).toBe(beforeContent)

    callbacks.onSkillActivated!("skill-a")
    expect(current().content).toBe(beforeContent)

    callbacks.onDone()
    expect(current().content).toBe(beforeContent)
  })
})
