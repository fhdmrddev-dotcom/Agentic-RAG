/**
 * Phase 075.2 Plan 01 Task 2 — unit tests for the `makeStreamCallbacks` reducer
 * dedup invariant (BUG-260521-01) and the WR-01 onToolEnd id-match (D-075.2-04).
 *
 * BUG-260521-01: The first tool of a run transiently renders TWO cards on all
 * three providers (OpenAI gpt-4.1, Anthropic claude-sonnet-4-6, OpenRouter).
 * Suspected mechanism (per RESEARCH §Q1): WR-02 reattach replays tool_start
 * for a tool whose preparing entry already moved to running -> the else-branch
 * at StreamsProvider.tsx:298-309 appends a fresh `running-${Date.now()}` entry
 * instead of treating the replay as a no-op. The reducer-side fix (D-075.2-01)
 * is idempotency-on-replay: same-name + status in {running, done} -> no-op.
 *
 * WR-01 (D-075.2-04): onToolEnd today matches by name + status===running, so
 * it stamps the first matching entry "done". Adding an optional id parameter
 * makes the matcher prefer tc.id === id when present (backend wire-up deferred
 * per orchestrator scope; frontend ships id?:string default-undefined for
 * future parallel-tool support).
 *
 * Tests follow the harness pattern from StreamsProvider.anthropic-ordering.test.ts.
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

describe("StreamsProvider — BUG-260521-01 reducer dedup + WR-01 id-match", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("D-075.2-01: replayed tool_start after preparing->running is a no-op (no duplicate entry)", () => {
    const { callbacks, current } = makeHarness()
    callbacks.onToolPreparing!("execute_code", 0)
    callbacks.onToolStart!("execute_code", { code: "x" })
    expect(current().tool_calls).toHaveLength(1)
    expect(current().tool_calls![0].status).toBe("running")
    expect(current().tool_calls![0].id).toBe("preparing-0")
    // Simulate WR-02 cursor-0 replay: tool_start fires again
    callbacks.onToolStart!("execute_code", { code: "x" })
    expect(current().tool_calls).toHaveLength(1)
    expect(current().tool_calls![0].status).toBe("running")
    expect(current().tool_calls![0].id).toBe("preparing-0")
  })

  it("D-075.2-01: second distinct tool index creates a separate entry (replay-idempotency does not collapse legitimate tools)", () => {
    const { callbacks, current } = makeHarness()
    callbacks.onToolPreparing!("execute_code", 0)
    callbacks.onToolStart!("execute_code", { code: "x" })
    callbacks.onToolEnd!("execute_code", "result-1")
    // Second tool — same name, distinct index — must produce a separate entry
    callbacks.onToolPreparing!("execute_code", 1)
    callbacks.onToolStart!("execute_code", { code: "y" })
    expect(current().tool_calls).toHaveLength(2)
    expect(current().tool_calls![0].status).toBe("done")
    expect(current().tool_calls![1].status).toBe("running")
  })

  it("D-075.2-04: onToolEnd(name, result, id) flips the entry whose tc.id === id", () => {
    const { callbacks, current } = makeHarness()
    callbacks.onToolPreparing!("execute_code", 0)
    callbacks.onToolStart!("execute_code", { code: "x" })
    callbacks.onToolEnd!("execute_code", "result-1", "preparing-0")
    expect(current().tool_calls![0].status).toBe("done")
    expect(current().tool_calls![0].result).toBe("result-1")
  })

  it("D-075.2-04 back-compat: onToolEnd without id matches by name (unchanged behavior)", () => {
    const { callbacks, current } = makeHarness()
    callbacks.onToolPreparing!("execute_code", 0)
    callbacks.onToolStart!("execute_code", { code: "x" })
    callbacks.onToolEnd!("execute_code", "result-2")
    expect(current().tool_calls![0].status).toBe("done")
    expect(current().tool_calls![0].result).toBe("result-2")
  })

  it("Plan 03 Task 1 invariant: m.content preserved across the full sequence", () => {
    const { callbacks, current, snapshots } = makeHarness()
    const startingContent = current().content
    callbacks.onToolPreparing!("execute_code", 0)
    callbacks.onToolStart!("execute_code", { code: "x" })
    callbacks.onToolStart!("execute_code", { code: "x" })  // replay no-op
    callbacks.onToolEnd!("execute_code", "result-1", "preparing-0")
    // Every snapshot in the trace preserved m.content verbatim
    for (const snap of snapshots) {
      expect(snap[0].content).toBe(startingContent)
    }
  })
})
