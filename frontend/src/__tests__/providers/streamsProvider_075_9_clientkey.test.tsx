/**
 * Phase 075.9 T2 — regression test for the stable `tc.clientKey` stamp.
 *
 * The defect this guards against:
 *   - provider-emitted `tc.id` mutates across the preparing→running
 *     transition on some providers (Anthropic, OpenRouter occasional);
 *   - any UI surface that uses `tc.id` as a dedup / React-key source
 *     therefore sees TWO logical cards mid-stream until the reducer
 *     compacts.
 *
 * What the streams store now does:
 *   - stamps a stable `tc.clientKey` at first observation (preparing
 *     event OR — when the provider skips preparing — tool_start);
 *   - the spread on tool_start preserves it across the running flip,
 *     so the value at running time equals the value stamped at
 *     preparing time. Subsequent state mutations (tool_args_progress,
 *     tool_end, etc.) ALSO preserve it via spread.
 *
 * Failure criterion: if the assertion `keyAtPreparing === keyAtRunning`
 * is violated, every consumer using `tc.clientKey` as a Record / React
 * key WILL re-mount and the dedup fix WILL regress.
 *
 * Harness style matches StreamsProvider.dedup.test.ts (Plan 075.2) —
 * stub `@/lib/api` and `@/lib/supabase` so the SUT module load doesn't
 * reach a real Supabase URL.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
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

// IMPORTANT: import AFTER the mocks so SUT module load is clean.
import { makeStreamCallbacks } from "@/providers/StreamsProvider"

const ASSISTANT_ID = "assistant-075-9"
const THREAD_ID = "thread-075-9"
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

function makeHarness() {
  let messages: Message[] = [initialAssistantMessage()]
  const setMessages: (
    updater: Message[] | ((prev: Message[]) => Message[]),
  ) => void = (updater) => {
    messages = typeof updater === "function" ? updater(messages) : updater
  }
  const callbacks = makeStreamCallbacks({
    assistantId: ASSISTANT_ID,
    threadId: THREAD_ID,
    setMessages,
  })
  const current = () => messages[0]
  return { callbacks, current }
}

describe("StreamsProvider — Phase 075.9 T2 clientKey stamping", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("stamps a clientKey on the preparing entry at first observation", () => {
    const { callbacks, current } = makeHarness()
    callbacks.onToolPreparing!("execute_code", 0)
    const tc = current().tool_calls![0]
    expect(tc.status).toBe("preparing")
    expect(tc.clientKey).toBeDefined()
    expect(tc.clientKey).toContain("execute_code")
    expect(tc.clientKey).toContain(ASSISTANT_ID)
  })

  it("preserves clientKey across preparing → running transition (the dedup-fix invariant)", () => {
    const { callbacks, current } = makeHarness()
    callbacks.onToolPreparing!("analyze_document", 0)
    const keyAtPreparing = current().tool_calls![0].clientKey
    expect(keyAtPreparing).toBeDefined()
    // Simulate the buggy provider behavior: tc.id would mutate across this
    // transition, but clientKey MUST NOT.
    callbacks.onToolStart!("analyze_document", { document_id: "doc-1" })
    expect(current().tool_calls).toHaveLength(1)
    expect(current().tool_calls![0].status).toBe("running")
    const keyAtRunning = current().tool_calls![0].clientKey
    expect(keyAtRunning).toBe(keyAtPreparing)
  })

  it("preserves clientKey across tool_args_progress updates", () => {
    const { callbacks, current } = makeHarness()
    callbacks.onToolPreparing!("execute_code", 0)
    const keyAtPreparing = current().tool_calls![0].clientKey
    callbacks.onToolArgsProgress!(0, "execute_code", 1024, "print('hi')")
    const keyAfterProgress = current().tool_calls![0].clientKey
    expect(keyAfterProgress).toBe(keyAtPreparing)
    callbacks.onToolArgsProgress!(0, "execute_code", 2048, "print('hi')\nprint('again')")
    expect(current().tool_calls![0].clientKey).toBe(keyAtPreparing)
  })

  it("preserves clientKey across tool_end (preparing → running → done)", () => {
    const { callbacks, current } = makeHarness()
    callbacks.onToolPreparing!("search_documents", 0)
    const keyAtPreparing = current().tool_calls![0].clientKey
    callbacks.onToolStart!("search_documents", { query: "hello" })
    callbacks.onToolEnd!("search_documents", "[]", "preparing-0")
    expect(current().tool_calls![0].status).toBe("done")
    expect(current().tool_calls![0].clientKey).toBe(keyAtPreparing)
  })

  it("when provider skips preparing event, tool_start ALSO stamps a clientKey", () => {
    // Some providers (older OpenAI legacy paths, certain OpenRouter models)
    // skip the preparing-state SSE event entirely and emit tool_start as
    // the first observable. The fallback branch in onToolStart must stamp
    // the key too.
    const { callbacks, current } = makeHarness()
    callbacks.onToolStart!("web_search", { query: "weather" })
    const tc = current().tool_calls![0]
    expect(tc.status).toBe("running")
    expect(tc.clientKey).toBeDefined()
    expect(tc.clientKey).toContain("web_search")
  })

  it("two distinct tool indices on the same message produce distinct clientKeys", () => {
    const { callbacks, current } = makeHarness()
    callbacks.onToolPreparing!("execute_code", 0)
    callbacks.onToolStart!("execute_code", { code: "a" })
    callbacks.onToolEnd!("execute_code", "ok-a", "preparing-0")
    callbacks.onToolPreparing!("execute_code", 1)
    const k0 = current().tool_calls![0].clientKey
    const k1 = current().tool_calls![1].clientKey
    expect(k0).toBeDefined()
    expect(k1).toBeDefined()
    expect(k0).not.toBe(k1)
  })

  it("BUG-260521-01 dedup invariant still holds: replayed tool_start is a no-op (no second clientKey-bearing entry)", () => {
    const { callbacks, current } = makeHarness()
    callbacks.onToolPreparing!("execute_code", 0)
    callbacks.onToolStart!("execute_code", { code: "x" })
    expect(current().tool_calls).toHaveLength(1)
    const keyAfterFirstStart = current().tool_calls![0].clientKey
    // Simulate WR-02 cursor-0 replay
    callbacks.onToolStart!("execute_code", { code: "x" })
    expect(current().tool_calls).toHaveLength(1)
    // The single entry still has the SAME stable key — no fresh stamp.
    expect(current().tool_calls![0].clientKey).toBe(keyAfterFirstStart)
  })
})
