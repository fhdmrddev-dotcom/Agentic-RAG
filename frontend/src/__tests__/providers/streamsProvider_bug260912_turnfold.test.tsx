/**
 * BUG-260912-01 — `onTurnBoundary` moves a tool-calling turn's text out of the body.
 *
 * ⛔ THIS IS THE HALF THAT ACTUALLY MOVES THE TEXT. `ThinkingBlock.narration.test.tsx` proves
 * the fold RENDERS narration once a message has it; nothing there proves anything ever puts it
 * there. The defect lived exactly in this seam: `delta` appends to `content` and no event ever
 * took any of it back, so a five-tool run accumulated every "I'll start by…" the model wrote
 * while the PERSISTED row (measured on the live DB: 308 chars over 7 tool calls) held only the
 * final turn. These cases pin the live stream back into agreement with the row.
 *
 * ⚠ §3 IS THE ONE THAT WOULD HAVE BITTEN. `pendingContent` can hold a turn's tail inside an
 * open coalescing window; moving `m.content` without flushing first folds the HEAD of the turn
 * and then appends its TAIL to the next turn's body — narration leaking into the answer, a
 * worse version of the bug being fixed, and invisible to every other case here.
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

const THREAD_ID = "thread-bug260912"
const NOW = new Date().toISOString()

function makeHarness(assistantId = "assistant-bug260912") {
  let messages: Message[] = [
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
      isPlanning: true,
    } as Message,
  ]
  const setMessages = vi.fn((updater: Message[] | ((prev: Message[]) => Message[])) => {
    messages = typeof updater === "function" ? updater(messages) : updater
  })
  const callbacks = makeStreamCallbacks({ assistantId, threadId: THREAD_ID, setMessages })
  return { callbacks, setMessages, current: () => messages[0] }
}

/** Drain any open coalescing window. */
const settle = () => vi.advanceTimersByTime(DELTA_COALESCE_MS * 3)

describe("BUG-260912-01 — a tool-calling turn's text leaves the body", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("§1 moves the turn's text into narrationContent and empties the body", () => {
    const h = makeHarness()
    h.callbacks.onDelta("I'll start by searching the knowledge base.")
    settle()
    expect(h.current().content).toContain("I'll start by searching")

    h.callbacks.onTurnBoundary!()
    expect(h.current().content).toBe("")
    expect(h.current().narrationContent).toContain("I'll start by searching")
  })

  it("§2 leaves ONLY the final turn in the body across three tool turns", () => {
    // The reported shape: three narrated tool turns, then the answer.
    const h = makeHarness()
    for (const t of ["I'll start by searching.", "I found several documents.", "Now let me analyze."]) {
      h.callbacks.onDelta(t)
      settle()
      h.callbacks.onTurnBoundary!()
    }
    h.callbacks.onDelta("Here is your presentation.")
    settle()

    expect(h.current().content).toBe("Here is your presentation.")
    // ⛔ EVERY turn is kept — folded, never dropped. Losing it would be a different bug.
    expect(h.current().narrationContent).toContain("I'll start by searching.")
    expect(h.current().narrationContent).toContain("I found several documents.")
    expect(h.current().narrationContent).toContain("Now let me analyze.")
  })

  it("§3 flushes the coalescing window FIRST, so no tail leaks into the next turn", () => {
    // ⚠ No `settle()` here — the window is deliberately still OPEN when the boundary fires.
    const h = makeHarness()
    h.callbacks.onDelta("head of the narration ")
    h.callbacks.onDelta("and its tail.")
    h.callbacks.onTurnBoundary!()
    settle()

    expect(h.current().narrationContent).toContain("and its tail.")
    // The tail must NOT have survived into the answer.
    expect(h.current().content).not.toContain("and its tail.")
  })

  it("§4 separates turns by a BLANK LINE so they render as distinct paragraphs", () => {
    // `ThinkingBlock.toParagraphs` splits on a blank line. A single newline (or none) would
    // reproduce the `…in parallel.I found several…` run-on seam visible in the report.
    const h = makeHarness()
    h.callbacks.onDelta("First turn.")
    settle()
    h.callbacks.onTurnBoundary!()
    h.callbacks.onDelta("Second turn.")
    settle()
    h.callbacks.onTurnBoundary!()

    expect(h.current().narrationContent).toBe("First turn.\n\nSecond turn.")
  })

  it("§5 is INERT on a turn that narrated nothing — the row is untouched", () => {
    // ⛔ D-14 default-inert. A strong model calls its tool with no preamble; that turn must
    // produce no fold and no new object identity (MessageItem's memo contract, D-243-08).
    const h = makeHarness()
    const before = h.current()
    h.callbacks.onTurnBoundary!()
    expect(h.current()).toBe(before)
    expect(h.current().narrationContent).toBeUndefined()
  })

  it("§6 never claims a reasoning span it did not measure", () => {
    // Narration is not reasoning. A boundary closes any open burst but must not invent one.
    const h = makeHarness()
    h.callbacks.onDelta("Narrating, not reasoning.")
    settle()
    h.callbacks.onTurnBoundary!()
    expect(h.current().reasoningMs).toBeUndefined()
  })
})
