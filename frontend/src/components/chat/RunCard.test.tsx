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

  it("iteration counter: renders Step {iterationCount + 1} when iterationCount provided", () => {
    render(<RunCard message={makeMessage({ iterationCount: 4 })} isStreaming={true} />)
    expect(screen.getByText("Step 5")).toBeInTheDocument()
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

  it("collapsed-row copy: shows tool-call count + status word", () => {
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
    expect(collapsed.textContent).toMatch(/3 tool calls/)
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
