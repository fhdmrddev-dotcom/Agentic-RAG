/**
 * Phase 243 Plan 03 Task 2 (CHAT-02 / D-243-15) — THE DELTA CADENCE FENCE.
 *
 * `makeStreamCallbacks`'s `onDelta` / `onReasoningDelta` call `setMessages` ONCE PER
 * TOKEN. Every one of those re-runs `MessageList.tsx:141-176` (`messages` is in its dep
 * array), which is why D-243-04 says the repaint cadence and the scroll behaviour are
 * one mechanism and may not be split.
 *
 * ⛔ THE COALESCING IS PRODUCER-SIDE, AND THE REASON IS D-243-04, NOT HABIT. A
 * consumer-side `useDeferredValue` in `ThinkingBlock` would coalesce the FOLD's repaint
 * and leave `setMessages` — and therefore `MessageList`'s effect — running per token:
 * CHAT-02's flicker criterion closed while CHAT-03 is untouched, which is exactly the
 * "fixed one and re-broke the other" failure the ROADMAP names.
 *
 * ⛔ AND THE SHARPEST TRAP IS NOT THE CADENCE, IT IS LOSSLESSNESS. `makeThrottle` is
 * LAST-WRITE-WINS (`throttle.ts:19,28`), and the accumulation currently lives INSIDE the
 * `setMessages` updater (`m.content + delta`). A naive wrap drops tokens — and every
 * cadence assertion in this file would still pass. §2 and §3 use individually
 * distinguishable deltas so a dropped one is visible rather than absorbed.
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

// IMPORTANT: import AFTER the mocks so the SUT module load is clean
// (`streamsProvider_075_9_clientkey.test.tsx:51-52`).
import { makeStreamCallbacks, DELTA_COALESCE_MS } from "@/providers/StreamsProvider"

/**
 * ⚠ Mirrored, not imported, so the arithmetic in the case names below is fixed text a
 * reader can check by hand. §8 pins it against the production constant — if the window
 * is ever retuned, §8 fails and the case names get re-derived rather than rotting.
 */
const WINDOW_MS = 60

const THREAD_ID = "thread-243"
const NOW = new Date().toISOString()

function makeHarness(assistantId = "assistant-243") {
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

/** Individually distinguishable, variable-length deltas. A dropped one is visible. */
function indexedDeltas(n: number, tag: string): string[] {
  return Array.from({ length: n }, (_, i) => `«${tag}${i}${".".repeat(i % 5)}»`)
}

describe("Phase 243 Plan 03 (CHAT-02) — the delta path coalesces, producer-side", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("§1 — 60 reasoning deltas spread over ~600 ms produce at most 1 + ceil(600/60) = 11 setMessages calls, not 60", () => {
    const { callbacks, setMessages } = makeHarness()
    const deltas = indexedDeltas(60, "r")

    for (const d of deltas) {
      callbacks.onReasoningDelta!(d)
      vi.advanceTimersByTime(10)
    }
    callbacks.onDone!()

    // ⛔ RED TODAY AT EXACTLY 1:1 — 60 deltas, 60 setMessages calls, plus onDone's own.
    expect(setMessages.mock.calls.length).toBeLessThanOrEqual(12)
    expect(setMessages.mock.calls.length).toBeLessThan(deltas.length)
  })

  it("§2 — ⛔ LOSSLESS: after the terminal flush the reasoning is the EXACT concatenation of all 60 deltas", () => {
    const { callbacks, current } = makeHarness()
    const deltas = indexedDeltas(60, "r")
    const expected = deltas.join("")

    for (const d of deltas) {
      callbacks.onReasoningDelta!(d)
      vi.advanceTimersByTime(10)
    }
    callbacks.onDone!()

    expect(current().reasoningContent).toBe(expected)
    expect(current().reasoningContent!.length).toBe(
      deltas.reduce((n, d) => n + d.length, 0),
    )
  })

  it("§3 — INTERLEAVED content and reasoning land in their own field, in order, with no cross-contamination", () => {
    const { callbacks, current } = makeHarness()
    const contentDeltas = indexedDeltas(30, "c")
    const reasoningDeltas = indexedDeltas(30, "r")

    for (let i = 0; i < 30; i++) {
      callbacks.onDelta!(contentDeltas[i])
      vi.advanceTimersByTime(7)
      callbacks.onReasoningDelta!(reasoningDeltas[i])
      vi.advanceTimersByTime(7)
    }
    callbacks.onDone!()

    expect(current().content).toBe(contentDeltas.join(""))
    expect(current().reasoningContent).toBe(reasoningDeltas.join(""))
    expect(current().content).not.toContain("«r")
    expect(current().reasoningContent).not.toContain("«c")
  })

  it("§4 — onDone leaves NOTHING buffered: the text is complete with no timer advance at all", () => {
    const { callbacks, current } = makeHarness()
    // Deltas delivered back-to-back inside a single window, so a trailing-only
    // coalescer would still be holding them when the stream ends.
    callbacks.onDelta!("alpha ")
    callbacks.onDelta!("beta ")
    callbacks.onReasoningDelta!("why-1 ")
    callbacks.onReasoningDelta!("why-2")
    callbacks.onDone!()

    expect(current().content).toBe("alpha beta ")
    expect(current().reasoningContent).toBe("why-1 why-2")
  })

  it("§5 — onTerminal ALSO flushes: an errored run keeps the text it had already streamed", () => {
    const { callbacks, current } = makeHarness()
    callbacks.onDelta!("partial answer ")
    callbacks.onReasoningDelta!("partial reasoning")
    callbacks.onTerminal!("error", undefined)

    expect(current().content).toBe("partial answer ")
    expect(current().reasoningContent).toBe("partial reasoning")
  })

  it("§6 — the FIRST delta paints immediately: no window elapses before the reader sees anything", () => {
    const { callbacks, setMessages, current } = makeHarness()
    callbacks.onDelta!("H")
    // ⚠ NOT ONE MILLISECOND ADVANCED. `makeThrottle` has no leading edge
    // (`throttle.ts:8-9`), so a naive reuse of it would fail here — which is the whole
    // reason the delta path gets its own primitive rather than the cache writer's.
    expect(setMessages).toHaveBeenCalledTimes(1)
    expect(current().content).toBe("H")
  })

  it("§7 — `isPlanning` clears on the FIRST CONTENT delta even when reasoning streamed first (the working badge must not linger)", () => {
    const { callbacks, current } = makeHarness()
    expect(current().isPlanning).toBe(true)

    callbacks.onReasoningDelta!("thinking about it")
    expect(current().isPlanning).toBe(true) // reasoning is not an answer

    callbacks.onDelta!("A")
    // Synchronously — not after a window, and not at the terminal flush.
    expect(current().isPlanning).toBe(false)
  })

  it("§8 — the window is a NAMED production constant, and it is the one these case names do arithmetic on", () => {
    expect(DELTA_COALESCE_MS).toBe(WINDOW_MS)
  })

  it("§9 — two runs accumulate INDEPENDENTLY: the buffer is per-instance closure state, never module state", () => {
    const a = makeHarness("assistant-A")
    const b = makeHarness("assistant-B")

    a.callbacks.onDelta!("AAA")
    b.callbacks.onDelta!("BBB")
    a.callbacks.onReasoningDelta!("ra")
    b.callbacks.onReasoningDelta!("rb")
    a.callbacks.onDone!()
    b.callbacks.onDone!()

    expect(a.current().content).toBe("AAA")
    expect(b.current().content).toBe("BBB")
    expect(a.current().reasoningContent).toBe("ra")
    expect(b.current().reasoningContent).toBe("rb")
  })

  // ===================================================================================
  // §10 - ADDED BY 243-04 (D-243-13). THE MEASURED REASONING SPAN.
  //
  // ⚠ THESE CASES LIVE HERE RATHER THAN IN `ThinkingBlock.characterization.test.tsx`, AND
  //   THAT IS A DEVIATION FROM 243-04's `files_modified`, RECORDED RATHER THAN ABSORBED. The
  //   stamp is delta-path behaviour and THIS file is the delta path's fence: it already owns
  //   the `makeStreamCallbacks` harness and the `@/lib/api` + `@/lib/supabase` module mocks
  //   that driving the provider requires. Importing the provider into the characterization
  //   net would have forced those same hoisted mocks onto 33 component cases that render
  //   `MessageItem` (which imports `@/lib/api`) - a much larger blast radius than the thing
  //   being tested. The LABEL arms are component behaviour and DID go in the net (§14).
  //
  // ⛔ THE STAMP IS TAKEN IN THE RAW CALLBACK, BEFORE THE COALESCER. A start read inside the
  //   coalesced flush would be late by up to one window, which at a 60 ms window is 1% of a
  //   6 s span - small, and wrong for a reason nobody could see afterwards.
  // ===================================================================================
  describe("§10 — the measured reasoning span (D-243-13)", () => {
    it("§10a — first reasoning delta to first CONTENT delta is measured onto the message", () => {
      const { callbacks, current } = makeHarness()
      callbacks.onReasoningDelta!("weighing the evidence")
      vi.advanceTimersByTime(6_000)
      callbacks.onReasoningDelta!(" some more")
      callbacks.onDelta!("The answer is")

      // ~6 s, not exact-equal: the harness advances fake timers, and an assertion on an exact
      // millisecond would pin the test to the coalescer's internals rather than to the span.
      expect(current().reasoningMs).toBeGreaterThanOrEqual(6_000)
      expect(current().reasoningMs).toBeLessThan(6_100)
    })

    it("§10b — `onDone` closes an OPEN span: reasoning that never yields a content delta still ends", () => {
      // ⚠ AMENDED BY 243-06 (HI-1), AND THE AMENDMENT IS THE SEMANTICS, NOT THE BEHAVIOUR.
      //    The case still fences exactly what its name says — a terminal with no content
      //    delta closes the span — but it now measures the REASONING STREAM (first delta to
      //    last delta) rather than the gap from the first reasoning delta to the answer, so
      //    it takes two deltas to describe an interval. §10i fences the one-delta form.
      const { callbacks, current } = makeHarness()
      callbacks.onReasoningDelta!("thought about it")
      vi.advanceTimersByTime(2_500)
      callbacks.onReasoningDelta!(" and said nothing")
      callbacks.onDone!()
      expect(current().reasoningMs).toBeGreaterThanOrEqual(2_500)
      expect(current().reasoningMs).toBeLessThan(2_600)
    })

    it("§10c — ⛔ NO REASONING, NO SPAN: a content-only run leaves the field ABSENT", () => {
      // ⭐ ABSENCE IS LOAD-BEARING HERE, not a tidiness preference: `ThinkingBlock` reads the
      //    ABSENCE of this field as "not honestly known" and falls back to a label with no
      //    number in it. A zero would be a measured claim that the model thought for no time.
      const { callbacks, current } = makeHarness()
      callbacks.onDelta!("straight to the answer")
      callbacks.onDone!()
      expect(current().reasoningMs).toBeUndefined()
    })

    it("§10d — the span is settled ONCE: later reasoning deltas do not re-open or extend it", () => {
      const { callbacks, current } = makeHarness()
      callbacks.onReasoningDelta!("first")
      vi.advanceTimersByTime(3_000)
      callbacks.onDelta!("answer begins")
      const settled = current().reasoningMs
      vi.advanceTimersByTime(30_000)
      callbacks.onReasoningDelta!("a late interleaved reasoning block")
      callbacks.onDone!()
      // ⛔ A span that kept growing would end up measuring the WHOLE RUN - exactly the value
      //    `RunCard` already computes and which D-243-13 rejects as "thought for", because it
      //    includes every tool call.
      expect(current().reasoningMs).toBe(settled)
    })

    it("§10e — two runs measure INDEPENDENTLY: the stamp is per-instance closure state", () => {
      const a = makeHarness("assistant-A")
      const b = makeHarness("assistant-B")
      // ⚠ Two deltas each (243-06 / HI-1): the span is the interval over which reasoning
      //    tokens were OBSERVED arriving, so one delta describes no interval (§10i).
      a.callbacks.onReasoningDelta!("a thinks")
      vi.advanceTimersByTime(1_000)
      b.callbacks.onReasoningDelta!("b thinks")
      vi.advanceTimersByTime(4_000)
      a.callbacks.onReasoningDelta!(" a still thinks")
      b.callbacks.onReasoningDelta!(" b still thinks")
      a.callbacks.onDelta!("a answers")
      b.callbacks.onDelta!("b answers")

      expect(a.current().reasoningMs).toBeGreaterThanOrEqual(5_000)
      expect(b.current().reasoningMs).toBeGreaterThanOrEqual(4_000)
      expect(b.current().reasoningMs).toBeLessThan(5_000)
    })

    it("§10h — RED DRIVE (HI-1, the multi-burst shape): thinking in TWO bursts around a 40 s tool sums to the thinking, not to the wall clock", () => {
      const { callbacks, current } = makeHarness()
      // Burst 1 — 5 s of reasoning tokens actually arriving.
      callbacks.onReasoningDelta!("first, I should establish what the user means. ")
      vi.advanceTimersByTime(5_000)
      callbacks.onReasoningDelta!("I will look it up.")
      callbacks.onToolPreparing!("search_documents", 0)
      callbacks.onToolStart!("search_documents", { query: "x" })
      vi.advanceTimersByTime(40_000)
      callbacks.onToolEnd!("search_documents", "…results…", "preparing-0-0")
      callbacks.onIterationStart!(2)
      // Burst 2 — 10 s more reasoning, on the next iteration, over the tool's output.
      callbacks.onReasoningDelta!("the results say X. ")
      vi.advanceTimersByTime(10_000)
      callbacks.onReasoningDelta!("So the answer is Y.")
      callbacks.onDelta!("The answer is Y.")
      callbacks.onDone!()

      // ⭐ 5 s + 10 s. The 40 s the tool ran is not thinking and is excluded BY CONSTRUCTION:
      //    only a reasoning delta moves either end of a burst.
      expect(current().reasoningMs).toBeGreaterThanOrEqual(15_000)
      expect(current().reasoningMs).toBeLessThan(15_100)
    })

    it("§10i — RED DRIVE (HI-1, the honesty rule): ONE reasoning delta is a single OBSERVATION, not an interval — no duration at all", () => {
      // ⛔ THE SPAN IS THE TIME REASONING TOKENS WERE OBSERVED ARRIVING. With exactly one
      //    delta we saw the stream at a single instant and know nothing about how long it
      //    took; the silence that follows belongs to whatever came next, which is the very
      //    conflation HI-1 is. D-243-13 point 2 answers it: when it is not honestly known,
      //    show NO duration. `thoughtForLabel(undefined)` then carries no digit.
      const { callbacks, current } = makeHarness()
      callbacks.onReasoningDelta!("thought about it and said nothing")
      vi.advanceTimersByTime(2_500)
      callbacks.onDone!()
      expect(current().reasoningMs).toBeUndefined()
    })

    it("§10g — RED DRIVE (HI-1): reasoning, then a 40 s TOOL, then the answer — the tool is not thinking", () => {
      const { callbacks, current } = makeHarness()
      callbacks.onReasoningDelta!("Let me check the docs.")
      vi.advanceTimersByTime(100)
      callbacks.onReasoningDelta!(" I will search.")
      // ⚠ NO CONTENT DELTA BETWEEN THE REASONING AND THE TOOL. That is not an edge case —
      //    `agent_loop.py:2078-2100` emits `reasoning_delta` and `tool_preparing` from the
      //    same elif chain with nothing required between them, which is the ordinary shape
      //    for a reasoning model that thinks and then calls a tool with no preamble.
      callbacks.onToolPreparing!("search_documents", 0)
      callbacks.onToolStart!("search_documents", { query: "x" })
      vi.advanceTimersByTime(40_000)
      callbacks.onToolEnd!("search_documents", "…results…", "preparing-0-0")
      callbacks.onIterationStart!(2)
      callbacks.onDelta!("Here is the answer.")
      callbacks.onDone!()

      expect(current().reasoningMs).toBeLessThan(5_000)
    })

    it("§10f — ⛔ NOT DERIVED FROM LENGTH: a 33 KB reasoning body measured in 1 s reports ~1 s", () => {
      // ⭐ THE MECHANICAL REFUSAL OF THE SKETCH'S DEMO AFFORDANCE, at the producer end. Under
      //    `index.html:338` this fixture would report ~187 seconds. The span is a CLOCK
      //    reading; the body's size has no vote.
      const { callbacks, current } = makeHarness()
      callbacks.onReasoningDelta!("x".repeat(33_712))
      vi.advanceTimersByTime(1_000)
      callbacks.onReasoningDelta!("x")
      callbacks.onDelta!("done thinking")
      expect(current().reasoningContent!.length).toBe(33_713)
      expect(current().reasoningMs).toBeGreaterThanOrEqual(1_000)
      expect(current().reasoningMs).toBeLessThan(1_100)
    })
  })
})
