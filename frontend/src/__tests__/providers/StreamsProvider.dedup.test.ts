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

  // ⚠ This id was hard-coded four times and had been stale since `91accf0f3` (Phase 076.1,
  // 2026-05-26), which made dedup ITERATION-AWARE for multi-batch runs — the id gained an
  // iteration segment — and did not touch this file. The CODE is the correct side. Named once
  // here so the next format change rots ONE line, not four.
  //
  // ⛔ TWO of the four uses PASSED the stale id to `onToolEnd`, which is why this read as a
  // product defect: the id-match missed, the entry stayed "running", and the failure said
  // onToolEnd no longer flips to done. One of those two asserts only content preservation, so
  // it stayed GREEN while its "full sequence" silently contained no matching tool_end.
  const PREPARING_ID = `preparing-0-0`

  it("D-075.2-01: replayed tool_start after preparing->running is a no-op (no duplicate entry)", () => {
    const { callbacks, current } = makeHarness()
    callbacks.onToolPreparing!("execute_code", 0)
    callbacks.onToolStart!("execute_code", { code: "x" })
    expect(current().tool_calls).toHaveLength(1)
    expect(current().tool_calls![0].status).toBe("running")
    expect(current().tool_calls![0].id).toBe(PREPARING_ID)
    // Simulate WR-02 cursor-0 replay: tool_start fires again
    callbacks.onToolStart!("execute_code", { code: "x" })
    expect(current().tool_calls).toHaveLength(1)
    expect(current().tool_calls![0].status).toBe("running")
    expect(current().tool_calls![0].id).toBe(PREPARING_ID)
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
    callbacks.onToolEnd!("execute_code", "result-1", PREPARING_ID)
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
    callbacks.onToolEnd!("execute_code", "result-1", PREPARING_ID)
    // Every snapshot in the trace preserved m.content verbatim
    for (const snap of snapshots) {
      expect(snap[0].content).toBe(startingContent)
    }
  })
})

describe("StreamsProvider — Phase 095 Plan 03 D-05 sub-agent zero-duplicate root fix", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function countSubAgents(m: Message): number {
    return (m.tool_calls ?? []).filter((tc) => tc.sub_agent != null).length
  }

  it("stamps the sub-agent onto the OWNING analyze_document tool_call — exactly ONE sub-agent block, never a second message-scoped slot", () => {
    const { callbacks, current } = makeHarness()
    // The agent calls analyze_document; tool_start lands its owner entry.
    callbacks.onToolStart!("analyze_document", { document_id: "doc-1" })
    expect(current().tool_calls).toHaveLength(1)
    const ownerKey = current().tool_calls![0].clientKey
    expect(ownerKey).toBeTruthy()

    // WHILE that tool runs, the legacy sub_agent_* bookend events fire.
    callbacks.onSubAgentStart!("thesis.pdf", "summarize chapter 3")
    callbacks.onSubAgentDelta!("Chapter 3 covers ")
    callbacks.onSubAgentDelta!("the methodology.")
    callbacks.onSubAgentDone!()

    // EXACTLY ONE tool_call carries the sub-agent — no separate slot, no second
    // entry. One SubAgentBlock would render (the dual-render ROOT is gone).
    expect(current().tool_calls).toHaveLength(1)
    expect(countSubAgents(current())).toBe(1)
    // It is stamped onto the SAME owner (clientKey identity preserved).
    expect(current().tool_calls![0].clientKey).toBe(ownerKey)
    expect(current().tool_calls![0].name).toBe("analyze_document")
    const sa = current().tool_calls![0].sub_agent!
    expect(sa.filename).toBe("thesis.pdf")
    expect(sa.task).toBe("summarize chapter 3")
    expect(sa.content).toBe("Chapter 3 covers the methodology.")
    expect(sa.status).toBe("done")
    // The legacy single-slot message.sub_agent is NOT written by the live path.
    expect(current().sub_agent).toBeUndefined()
  })

  it("creates a stable-identity owner entry when sub_agent_start arrives BEFORE tool_start (provider ordering)", () => {
    const { callbacks, current } = makeHarness()
    // sub_agent_start arrives first — no owner yet. Create one with ONE stable
    // makeToolKey identity from frame 1 (mirrors onToolStart).
    callbacks.onSubAgentStart!("report.docx", "extract findings")
    expect(current().tool_calls).toHaveLength(1)
    expect(current().tool_calls![0].name).toBe("analyze_document")
    expect(current().tool_calls![0].clientKey).toBeTruthy()
    expect(current().tool_calls![0].sub_agent!.status).toBe("running")

    callbacks.onSubAgentDelta!("Finding 1.")
    callbacks.onSubAgentDone!()
    // Still exactly ONE entry, ONE sub-agent — no duplicate.
    expect(current().tool_calls).toHaveLength(1)
    expect(countSubAgents(current())).toBe(1)
    expect(current().tool_calls![0].sub_agent!.content).toBe("Finding 1.")
    expect(current().tool_calls![0].sub_agent!.status).toBe("done")
  })

  it("content-append invariant: sub_agent stamping never touches m.content", () => {
    const { callbacks, current, snapshots } = makeHarness()
    const startingContent = current().content
    callbacks.onToolStart!("analyze_document", { document_id: "doc-2" })
    callbacks.onSubAgentStart!("a.pdf", "t")
    callbacks.onSubAgentDelta!("body text")
    callbacks.onSubAgentDone!()
    for (const snap of snapshots) {
      expect(snap[0].content).toBe(startingContent)
    }
  })

  it("per-thread demux: THREAD_A sub_agent_start leaves THREAD_B's message bucket untouched", () => {
    // Two independent reducers, each closing over its OWN assistantId/threadId.
    let messagesA: Message[] = [
      { ...initialAssistantMessage(), id: "assistant-A", thread_id: "thread-A" },
    ]
    let messagesB: Message[] = [
      { ...initialAssistantMessage(), id: "assistant-B", thread_id: "thread-B" },
    ]
    const cbA = makeStreamCallbacks({
      assistantId: "assistant-A",
      threadId: "thread-A",
      setMessages: (u) => {
        messagesA = typeof u === "function" ? u(messagesA) : u
      },
    })
    const cbB = makeStreamCallbacks({
      assistantId: "assistant-B",
      threadId: "thread-B",
      setMessages: (u) => {
        messagesB = typeof u === "function" ? u(messagesB) : u
      },
    })
    // Drive a full sub-agent sequence on THREAD_A only.
    cbA.onToolStart!("analyze_document", { document_id: "doc-A" })
    cbA.onSubAgentStart!("a.pdf", "task A")
    cbA.onSubAgentDelta!("A content")
    cbA.onSubAgentDone!()
    // THREAD_A populated.
    expect(messagesA[0].tool_calls).toHaveLength(1)
    expect(messagesA[0].tool_calls![0].sub_agent!.content).toBe("A content")
    // THREAD_B is COMPLETELY untouched — no bleed.
    expect(messagesB[0].tool_calls).toHaveLength(0)
    expect(messagesB[0].sub_agent).toBeUndefined()
    // Also feed a B sub_agent — A must not change.
    cbB.onToolStart!("analyze_document", { document_id: "doc-B" })
    cbB.onSubAgentStart!("b.pdf", "task B")
    cbB.onSubAgentDelta!("B content")
    expect(messagesB[0].tool_calls![0].sub_agent!.content).toBe("B content")
    expect(messagesA[0].tool_calls![0].sub_agent!.content).toBe("A content")
  })
})
