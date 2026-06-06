/**
 * Phase 075.7 Plan 02/03 — RunCard.test.tsx
 *
 * Per CONTEXT D-13: vitest specs are authored alongside source files but
 * execution is deferred (TS-gate + Plan 03 Playwright cover behavior at
 * runtime). This file MUST type-check; runtime test execution is
 * deferred-items logged.
 *
 * Behavior cases covered (per PLAN.md <behavior>):
 *  PLAN 02 (visual frame):
 *   1. memo wrap — RunCard.tsx declares `export const RunCard = memo(function RunCard(...))`
 *   2. R-1 acceptance — renders `<div data-testid="run-card">` for tool-bearing turns
 *   3. R-5 partial — sticky-header element has classes `sticky top-0 z-10 backdrop-blur-md`
 *   4. Brand-pulse — avatar carries `animate-brandPulse` IFF runStatus === "streaming"
 *   5. Timer — displays `{elapsed}.{tenths}s` in font-mono, recomputes during streaming
 *   6. Iteration counter — displays `Step {iterationCount + 1}` IFF iterationCount != null
 *   7. Active-glow — outer frame has border-primary/35 + shadow IFF streaming + hasTools
 *   8. Progress shimmer — `<div className="tool-progress-bar" />` IFF streaming
 *   9. Narration interleave — body renders ToolCallPanel (existing logic preserved)
 *  10. No new keyframes — grep for `@keyframes` in RunCard.tsx returns 0
 *  PLAN 03 (auto-collapse + click-to-expand):
 *  11. Auto-collapse (DB-loaded historical): mount with runStatus="completed" + tools →
 *      collapsed-row visible by default, full body NOT rendered.
 *  12. Streaming → expanded: mount with runStatus="streaming" + tools → body visible,
 *      collapsed-row NOT visible.
 *  13. Click-to-expand: collapsed-row click flips expanded → body re-renders.
 *  14. Header no-op while streaming (D-08): tabIndex=-1 + aria-expanded=true while streaming.
 *  15. Status-word mapping: completed → "done", failed → "failed", etc.
 *  16. Terminal + no tools: body still renders (R-6 — no auto-collapse when no tools).
 */
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { RunCard } from "./RunCard"
import type { Message } from "@/types"

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    role: "assistant",
    content: "",
    created_at: new Date().toISOString(),
    tool_calls: [
      {
        id: "tc-1",
        name: "execute_code",
        args: { code: "print(1)" },
        status: "running",
        startedAt: Date.now() - 1000,
      },
    ],
    runStatus: "streaming",
    iterationCount: 0,
    ...overrides,
  } as unknown as Message
}

describe("RunCard", () => {
  it("R-1: renders data-testid=\"run-card\" for tool-bearing turns", () => {
    render(<RunCard message={makeMessage()} isStreaming={true} />)
    expect(screen.getByTestId("run-card")).toBeInTheDocument()
  })

  it("R-5 partial: sticky header has sticky top-0 z-10 backdrop-blur classes", () => {
    render(<RunCard message={makeMessage()} isStreaming={true} />)
    const card = screen.getByTestId("run-card")
    const header = card.querySelector("header")
    expect(header).not.toBeNull()
    expect(header!.className).toMatch(/sticky/)
    expect(header!.className).toMatch(/top-0/)
    expect(header!.className).toMatch(/z-10/)
    expect(header!.className).toMatch(/backdrop-blur/)
  })

  it("brand-pulse: avatar carries animate-brandPulse when runStatus === streaming", () => {
    render(<RunCard message={makeMessage({ runStatus: "streaming" })} isStreaming={true} />)
    const card = screen.getByTestId("run-card")
    const html = card.outerHTML
    expect(html).toMatch(/animate-brandPulse/)
  })

  it("brand-pulse: avatar does NOT carry animate-brandPulse when terminal", () => {
    render(<RunCard message={makeMessage({ runStatus: "completed" })} isStreaming={false} />)
    const card = screen.getByTestId("run-card")
    const html = card.outerHTML
    expect(html).not.toMatch(/animate-brandPulse/)
  })

  // Phase 095 Plan 02 (D-04): the step number is now driven by
  // unifiedStepCount(message) — the DEDUPED tool count — NOT iterationCount.
  // The fixture below has 3 deduped tools spread across iterationCount=4, so the
  // strip shows "Step 3" (the honest count), never "Step 5".
  it("D-04: Step number reads unifiedStepCount, NOT iterationCount", () => {
    render(
      <RunCard
        message={makeMessage({
          iterationCount: 4,
          tool_calls: [
            { id: "tc-1", name: "search_documents", args: {}, status: "running", startedAt: Date.now() },
            { id: "tc-2", name: "execute_code", args: {}, status: "running", startedAt: Date.now() },
            { id: "tc-3", name: "read_document", args: {}, status: "running", startedAt: Date.now() },
          ],
        } as Partial<Message>)}
        isStreaming={true}
      />,
    )
    const strip = screen.getByTestId("run-status-strip")
    expect(strip.textContent).toMatch(/Step 3/)
    expect(strip.textContent).not.toMatch(/Step 5/)
  })

  it("active-glow: outer frame has primary border + shadow during streaming", () => {
    render(<RunCard message={makeMessage({ runStatus: "streaming" })} isStreaming={true} />)
    const card = screen.getByTestId("run-card")
    expect(card.className).toMatch(/border-primary\/35/)
    expect(card.className).toMatch(/shadow-\[0_0_24px/)
  })

  it("active-glow: terminal turn uses neutral border", () => {
    render(<RunCard message={makeMessage({ runStatus: "completed" })} isStreaming={false} />)
    const card = screen.getByTestId("run-card")
    expect(card.className).toMatch(/border-border/)
    expect(card.className).not.toMatch(/border-primary\/35/)
  })

  it("progress shimmer: renders .tool-progress-bar when streaming", () => {
    render(<RunCard message={makeMessage({ runStatus: "streaming" })} isStreaming={true} />)
    const card = screen.getByTestId("run-card")
    expect(card.querySelector(".tool-progress-bar")).not.toBeNull()
  })

  it("progress shimmer: omitted when terminal", () => {
    render(<RunCard message={makeMessage({ runStatus: "completed" })} isStreaming={false} />)
    const card = screen.getByTestId("run-card")
    expect(card.querySelector(".tool-progress-bar")).toBeNull()
  })

  it("inner body: ToolCallPanel mounts during streaming (expanded by default)", () => {
    render(<RunCard message={makeMessage()} isStreaming={true} />)
    const card = screen.getByTestId("run-card")
    // ToolCallPanel renders a heading row + per-tool card stack; assert it's in DOM
    // by checking that the panel body container exists (the p-3 div is the body wrapper).
    expect(card.querySelector(".p-3")).not.toBeNull()
  })

  // ---- PLAN 03 cases ----

  it("auto-collapse: DB-loaded historical (terminal + tools) mounts collapsed", () => {
    render(
      <RunCard
        message={makeMessage({
          runStatus: "completed",
          tool_calls: [
            { id: "tc-1", name: "search_documents", args: { query: "q" }, status: "done", result: "[]" },
            { id: "tc-2", name: "execute_code", args: { code: "x" }, status: "done", result: "" },
          ],
        } as Partial<Message>)}
        isStreaming={false}
      />,
    )
    expect(screen.getByTestId("run-card-collapsed")).toBeInTheDocument()
    // Body should NOT be rendered when collapsed
    expect(screen.getByTestId("run-card").querySelector(".p-3")).toBeNull()
  })

  it("streaming + tools: collapsed-row NOT shown; body is rendered", () => {
    render(<RunCard message={makeMessage({ runStatus: "streaming" })} isStreaming={true} />)
    expect(screen.queryByTestId("run-card-collapsed")).toBeNull()
    expect(screen.getByTestId("run-card").querySelector(".p-3")).not.toBeNull()
  })

  it("click-to-expand: clicking collapsed-row reveals the body", () => {
    render(
      <RunCard
        message={makeMessage({
          runStatus: "completed",
          tool_calls: [
            { id: "tc-1", name: "search_documents", args: { query: "q" }, status: "done", result: "[]" },
          ],
        } as Partial<Message>)}
        isStreaming={false}
      />,
    )
    const collapsed = screen.getByTestId("run-card-collapsed")
    expect(screen.getByTestId("run-card").querySelector(".p-3")).toBeNull()
    fireEvent.click(collapsed)
    expect(screen.getByTestId("run-card").querySelector(".p-3")).not.toBeNull()
  })

  it("D-08 no-op while streaming: header tabIndex is -1 and aria-expanded=true", () => {
    render(<RunCard message={makeMessage({ runStatus: "streaming" })} isStreaming={true} />)
    const header = screen.getByTestId("run-card").querySelector("header") as HTMLElement
    expect(header.getAttribute("tabindex")).toBe("-1")
    expect(header.getAttribute("aria-expanded")).toBe("true")
  })

  it("D-08 no-op while streaming: header click does NOT collapse the body", () => {
    render(<RunCard message={makeMessage({ runStatus: "streaming" })} isStreaming={true} />)
    const card = screen.getByTestId("run-card")
    const header = card.querySelector("header") as HTMLElement
    fireEvent.click(header)
    // Body must still be rendered (click was a no-op per D-08)
    expect(card.querySelector(".p-3")).not.toBeNull()
    expect(screen.queryByTestId("run-card-collapsed")).toBeNull()
  })

  // Phase 095 Plan 02 (D-04): the collapsed-row copy was relabeled
  // "N tool calls" → "N steps" and now reads the SAME unifiedStepCount as the
  // header + strip (SKETCH-CONSISTENCY — the three sites can never disagree).
  it("collapsed-row copy: shows N steps (unifiedStepCount) + status word", () => {
    render(
      <RunCard
        message={makeMessage({
          runStatus: "failed",
          tool_calls: [
            { id: "tc-1", name: "search_documents", args: {}, status: "done", result: "" },
            { id: "tc-2", name: "execute_code", args: {}, status: "done", result: "" },
            { id: "tc-3", name: "read_document", args: {}, status: "done", result: "" },
          ],
        } as Partial<Message>)}
        isStreaming={false}
      />,
    )
    const collapsed = screen.getByTestId("run-card-collapsed")
    expect(collapsed.textContent).toMatch(/3 steps/)
    expect(collapsed.textContent).not.toMatch(/tool calls/)
    expect(collapsed.textContent).toMatch(/failed/)
  })

  it("terminal + no tools: NO collapsed-row, body still renders", () => {
    render(
      <RunCard
        message={makeMessage({ runStatus: "completed", tool_calls: [] })}
        isStreaming={false}
      />,
    )
    expect(screen.queryByTestId("run-card-collapsed")).toBeNull()
    // Without tools, RunCard still mounts (MessageItem gates that) but body is expanded
    expect(screen.getByTestId("run-card").querySelector(".p-3")).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Phase 095 Plan 02 — D-06 persistent timer + D-04 unified count
// ---------------------------------------------------------------------------

describe("RunCard — D-06 persistent timer (the never-vanishes fix)", () => {
  // The ROOT bug (BUG-260528-01): under the old `isStreamingNow || elapsedMs > 0`
  // gate, a run that flipped terminal before any 250ms tick had elapsedMs === 0
  // and the WHOLE timer vanished. The D-06 fix renders the strip continuously
  // whenever created_at parses, regardless of isStreamingNow / elapsedMs.
  it("timer is STILL rendered when a run flips terminal with zero elapsed (no vanish)", () => {
    const createdAt = new Date().toISOString() // ~now → elapsed ≈ 0
    render(
      <RunCard
        message={makeMessage({
          created_at: createdAt,
          runStatus: "completed", // terminal immediately; elapsedMs would be ~0
          tool_calls: [
            { id: "tc-1", name: "search_documents", args: {}, status: "done", result: "[]" },
          ],
        } as Partial<Message>)}
        isStreaming={false}
      />,
    )
    // The strip (which carries the ⏱ elapsed segment) must still be present.
    const strip = screen.getByTestId("run-status-strip")
    expect(strip).toBeInTheDocument()
    expect(strip.textContent).toMatch(/⏱/)
    // And it shows a real seconds value (never NaN), even at ~0 elapsed.
    expect(strip.textContent).toMatch(/\d+(\.\d+)?s/)
  })

  it("freezes elapsed at a terminal — the value does not keep growing after terminal", () => {
    // created_at 5s in the past; terminal NOW → the frozen elapsed ≈ 5s and is
    // recomputed as (frozenEnd - start), never (now - start) after freeze.
    const createdAt = new Date(Date.now() - 5000).toISOString()
    render(
      <RunCard
        message={makeMessage({
          created_at: createdAt,
          runStatus: "completed",
          tool_calls: [
            { id: "tc-1", name: "execute_code", args: {}, status: "done", result: "" },
          ],
        } as Partial<Message>)}
        isStreaming={false}
      />,
    )
    const strip = screen.getByTestId("run-status-strip")
    const match = strip.textContent?.match(/([\d.]+)s/)
    expect(match).not.toBeNull()
    const seconds = parseFloat(match![1])
    // Frozen near 5s (allow scheduling slack), and crucially BOUNDED — not the
    // unbounded wall-clock that an un-frozen now-baseline would keep growing.
    expect(seconds).toBeGreaterThanOrEqual(4.5)
    expect(seconds).toBeLessThan(10)
  })

  it("renders no elapsed segment when created_at is unparseable (never NaN)", () => {
    render(
      <RunCard
        message={makeMessage({
          // a deliberately unparseable created_at to exercise the Number.isFinite guard
          created_at: "not-a-date",
          runStatus: "completed",
          tool_calls: [
            { id: "tc-1", name: "execute_code", args: {}, status: "done", result: "" },
          ],
        } as Partial<Message>)}
        isStreaming={false}
      />,
    )
    // Number.isFinite(startMs) is false → the strip is not rendered at all,
    // and nothing renders "NaNs".
    expect(screen.queryByTestId("run-status-strip")).toBeNull()
    expect(screen.getByTestId("run-card").textContent).not.toMatch(/NaN/)
  })

  it("the activity verb shows while streaming and is gone (terminal) once done", () => {
    const streaming = render(
      <RunCard message={makeMessage({ runStatus: "streaming" })} isStreaming={true} />,
    )
    // streaming → strip carries a primary activity verb segment.
    expect(streaming.getByTestId("run-status-strip").textContent).toMatch(/Searching|Running|Thinking|Synthesizing|Setting up|Working/)
    streaming.unmount()

    const terminal = render(
      <RunCard
        message={makeMessage({
          runStatus: "completed",
          tool_calls: [
            { id: "tc-1", name: "execute_code", args: {}, status: "done", result: "" },
          ],
        } as Partial<Message>)}
        isStreaming={false}
      />,
    )
    // terminal → activityVerb is null → no live verb in the (header) strip.
    // The header strip lives inside the header element; the collapsed-row is a
    // separate surface. Read the header strip specifically.
    const header = terminal.getByTestId("run-card").querySelector("header")
    const headerStrip = header?.querySelector("[data-testid='run-status-strip']")
    expect(headerStrip).not.toBeNull()
    expect(headerStrip!.textContent).not.toMatch(/Searching|Running code|Synthesizing/)
  })
})

describe("RunCard — D-04 unified count agrees across all three sites", () => {
  it("header, strip, and collapsed-row all read the SAME unifiedStepCount (N, not M)", () => {
    // 2 deduped tools (by clientKey) but a duplicate 3rd entry → unifiedStepCount
    // dedups to 2; iterationCount=7 (M ≠ N). All sites must show 2.
    render(
      <RunCard
        message={makeMessage({
          runStatus: "completed",
          iterationCount: 7,
          tool_calls: [
            { id: "tc-1", clientKey: "k1", name: "search_documents", args: {}, status: "done", result: "" },
            { id: "tc-2", clientKey: "k2", name: "execute_code", args: {}, status: "done", result: "" },
            { id: "tc-3", clientKey: "k1", name: "search_documents", args: {}, status: "done", result: "" }, // dup of k1
          ],
        } as Partial<Message>)}
        isStreaming={false}
      />,
    )
    // Collapsed by default (terminal + tools) → header strip + collapsed-row visible.
    const header = screen.getByTestId("run-card").querySelector("header")!
    expect(header.textContent).toMatch(/Run · 2 steps/) // header title
    const headerStrip = header.querySelector("[data-testid='run-status-strip']")!
    expect(headerStrip.textContent).toMatch(/Step 2/) // strip
    expect(headerStrip.textContent).not.toMatch(/Step 7/) // never iterationCount
    const collapsed = screen.getByTestId("run-card-collapsed")
    expect(collapsed.textContent).toMatch(/2 steps/) // collapsed-row
  })

  it("DB-loaded message WITHOUT iterationCount still shows a Step number (next-day reopen fix)", () => {
    // Simulate a reloaded historical message: no iterationCount field at all,
    // but the persisted tool_calls survive → unifiedStepCount still works.
    const reloaded = makeMessage({
      runStatus: "completed",
      tool_calls: [
        { id: "tc-1", name: "search_documents", args: {}, status: "done", result: "" },
        { id: "tc-2", name: "read_document", args: {}, status: "done", result: "" },
      ],
    } as Partial<Message>)
    // strip iterationCount entirely (DB reload omits it)
    delete (reloaded as { iterationCount?: number }).iterationCount
    render(<RunCard message={reloaded} isStreaming={false} />)
    const header = screen.getByTestId("run-card").querySelector("header")!
    const headerStrip = header.querySelector("[data-testid='run-status-strip']")!
    expect(headerStrip.textContent).toMatch(/Step 2/)
  })
})

// ---------------------------------------------------------------------------
// Phase 095 Plan 07 — GAP-095-03 MED: single verb + calm title + run-sub
// ---------------------------------------------------------------------------

describe("RunCard — Plan 07 single verb (the activity verb lives in the strip, not the title)", () => {
  it("the activity verb renders EXACTLY ONCE in the header (in the strip, never the title line)", () => {
    // While streaming, a search_documents tool → the verb "Searching knowledge
    // base…". It must appear once total in the header (the strip), NOT twice
    // (the old double-verb bug rendered it in both the title and the strip).
    render(
      <RunCard
        message={makeMessage({
          runStatus: "streaming",
          tool_calls: [
            { id: "tc-1", name: "search_documents", args: {}, status: "running", startedAt: Date.now() },
          ],
        } as Partial<Message>)}
        isStreaming={true}
      />,
    )
    const header = screen.getByTestId("run-card").querySelector("header") as HTMLElement
    const verb = "Searching knowledge base"
    const occurrences = (header.textContent ?? "").split(verb).length - 1
    expect(occurrences).toBe(1)

    // And the single occurrence is INSIDE the strip, not the title.
    const strip = header.querySelector("[data-testid='run-status-strip']") as HTMLElement
    expect(strip.textContent).toMatch(/Searching knowledge base/)

    // The title line (first child div of the flex-1 column) must NOT carry the verb.
    const titleColumn = strip.parentElement as HTMLElement // the flex-1 min-w-0 column
    const titleLine = titleColumn.querySelector("div") as HTMLElement // first div = title
    expect(titleLine.textContent).not.toMatch(/Searching knowledge base/)
    // The title is a calm run identity (no activity verb).
    expect(titleLine.textContent).toMatch(/Run · 1 step|Agent run/)
  })

  it("the title is a calm run identity, NOT the verb, even between tools (synthesizing)", () => {
    // Between tools (no active tool, isPlanning false) the OLD title would read
    // "Synthesizing answer…" — the verb in the title. Now the title is calm.
    render(
      <RunCard
        message={makeMessage({
          runStatus: "streaming",
          isPlanning: false,
          tool_calls: [
            { id: "tc-1", name: "search_documents", args: {}, status: "done", result: "[]" },
          ],
        } as Partial<Message>)}
        isStreaming={true}
      />,
    )
    const strip = screen.getByTestId("run-status-strip") as HTMLElement
    const titleColumn = strip.parentElement as HTMLElement
    const titleLine = titleColumn.querySelector("div") as HTMLElement
    expect(titleLine.textContent).not.toMatch(/Synthesizing/)
    expect(titleLine.textContent).toMatch(/Run · 1 step|Agent run/)
  })
})

describe("RunCard — Plan 07 model·turn run-sub subline (restored from existing data)", () => {
  it("renders a `turn N` run-sub from iterationCount (turn = iterationCount + 1)", () => {
    render(
      <RunCard
        message={makeMessage({
          runStatus: "streaming",
          iterationCount: 0, // 0-based → turn 1
          tool_calls: [
            { id: "tc-1", name: "execute_code", args: {}, status: "running", startedAt: Date.now() },
          ],
        } as Partial<Message>)}
        isStreaming={true}
      />,
    )
    const header = screen.getByTestId("run-card").querySelector("header") as HTMLElement
    expect(header.textContent).toMatch(/turn 1/)
  })

  it("the run-sub turn number tracks a later iteration (iterationCount 2 → turn 3)", () => {
    render(
      <RunCard
        message={makeMessage({
          runStatus: "streaming",
          iterationCount: 2, // 0-based → turn 3
          tool_calls: [
            { id: "tc-1", name: "execute_code", args: {}, status: "running", startedAt: Date.now() },
          ],
        } as Partial<Message>)}
        isStreaming={true}
      />,
    )
    const header = screen.getByTestId("run-card").querySelector("header") as HTMLElement
    expect(header.textContent).toMatch(/turn 3/)
  })

  it("defaults to `turn 1` when iterationCount is absent (DB-loaded reopen)", () => {
    const reloaded = makeMessage({
      runStatus: "completed",
      tool_calls: [
        { id: "tc-1", name: "search_documents", args: {}, status: "done", result: "" },
      ],
    } as Partial<Message>)
    delete (reloaded as { iterationCount?: number }).iterationCount
    render(<RunCard message={reloaded} isStreaming={false} />)
    const header = screen.getByTestId("run-card").querySelector("header") as HTMLElement
    expect(header.textContent).toMatch(/turn 1/)
  })
})
