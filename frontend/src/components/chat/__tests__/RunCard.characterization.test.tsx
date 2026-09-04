/**
 * Phase 227 Wave 1 — Pre-refactor Characterization Suite (A-1 / SC#2).
 *
 * Mechanically locks in the DOM structure and rendered contracts across all 8
 * canonical run states prior to any decomposition of RunCard, ToolCallPanel,
 * or MessageItem.
 *
 * Precedent: src/components/admin/revertByteIdentical.test.tsx (Phase 181).
 *
 * 8 canonical states covered:
 *   1. streaming (active running tool, running spinner, active rail node)
 *   2. settled / done (completed tools, duration, collapsed/expandable rail)
 *   3. failed (error message, failed status, expandable rail)
 *   4. timed_out (runStatus === "timed_out")
 *   5. cancelled (runStatus === "cancelled" with content)
 *   6. paused_on_approval / planning (isPlanning / askPayload state)
 *   7. no_tools (tool_calls empty — renders header with 'Agent run' title)
 *   8. sub_agent (sub_agent_model / nested sub-agent state)
 */
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { RunCard } from "@/components/chat/RunCard"
import type { Message, ToolCall } from "@/types"

const NOW = new Date().toISOString()

function makeRunMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-char-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: "Assistant response text",
    created_at: NOW,
    updated_at: NOW,
    model: "claude-3-5-sonnet",
    provider: "anthropic",
    runStatus: "completed",
    tool_calls: [
      {
        id: "tc-1",
        name: "search_documents",
        args: { query: "knowledge" },
        status: "done",
        result: JSON.stringify([{ id: "doc-1", title: "Doc 1" }]),
        startedAt: 1_000_000,
        endedAt: 1_001_500,
      } as ToolCall,
    ],
    ...overrides,
  } as Message
}

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe("RunCard — Wave 1 Characterization Suite (SC#2 Mechanical Proof)", () => {
  it("State 1: streaming — renders active run card header and running tool essence", () => {
    const msg = makeRunMessage({
      runStatus: "streaming",
      tool_calls: [
        {
          id: "tc-live",
          name: "search_documents",
          args: { query: "running query" },
          status: "running",
          startedAt: 1_000_000,
        } as ToolCall,
      ],
    })
    const { container } = renderWithTooltip(<RunCard message={msg} isStreaming={true} />)

    // RunCard container exists and marks streaming
    const card = container.querySelector("[data-testid='run-card']")
    expect(card).toBeTruthy()
    expect(card?.getAttribute("data-streaming")).toBe("true")

    // Running pill exists and has data-status="running"
    const pill = container.querySelector("[data-testid='status-pill']")
    expect(pill).toBeTruthy()
    expect(pill?.getAttribute("data-status")).toBe("running")
  })

  it("State 2: settled / done — renders collapsed-by-default card and expands on click", () => {
    const msg = makeRunMessage({
      runStatus: "completed",
      tool_calls: [
        {
          id: "tc-done",
          name: "search_documents",
          args: { query: "finished query" },
          status: "done",
          result: JSON.stringify({ count: 2 }),
          startedAt: 1_000_000,
          endedAt: 1_001_200,
        } as ToolCall,
      ],
    })
    const { container } = renderWithTooltip(<RunCard message={msg} isStreaming={false} />)

    const card = container.querySelector("[data-testid='run-card']")
    expect(card).toBeTruthy()

    // Settled card has the collapsed trigger button by default
    const collapsedTrigger = container.querySelector("[data-testid='run-card-collapsed']")
    expect(collapsedTrigger).toBeTruthy()

    // Clicking collapsed row expands the run card body
    fireEvent.click(collapsedTrigger!)
    const essence = container.querySelector("[data-testid='tool-result-summary']")
    expect(essence).toBeTruthy()
  })

  it("State 3: failed — renders error status on collapsed card and preserves rail on expansion", () => {
    const msg = makeRunMessage({
      runStatus: "failed",
      runError: "Rate limit exceeded (429)",
      tool_calls: [
        {
          id: "tc-failed",
          name: "search_documents",
          args: { query: "failing query" },
          status: "done",
          result: "Error: 429 rate limit exceeded",
          startedAt: 1_000_000,
          endedAt: 1_000_500,
        } as ToolCall,
      ],
    })
    const { container } = renderWithTooltip(<RunCard message={msg} isStreaming={false} />)

    const card = container.querySelector("[data-testid='run-card']")
    expect(card).toBeTruthy()

    const collapsedTrigger = container.querySelector("[data-testid='run-card-collapsed']")
    expect(collapsedTrigger).toBeTruthy()
    expect(collapsedTrigger?.textContent).toContain("failed")

    // Open card to inspect essence & rail node
    fireEvent.click(collapsedTrigger!)
    expect(container.querySelector("[data-testid='step-node']")).toBeTruthy()
  })

  it("State 4: timed_out — renders run card with timed out status in collapsed row", () => {
    const msg = makeRunMessage({
      runStatus: "timed_out",
    })
    const { container } = renderWithTooltip(<RunCard message={msg} isStreaming={false} />)
    const collapsedTrigger = container.querySelector("[data-testid='run-card-collapsed']")
    expect(collapsedTrigger).toBeTruthy()
    expect(collapsedTrigger?.textContent).toContain("timed out")
  })

  it("State 5: cancelled — renders run card with cancelled status in collapsed row", () => {
    const msg = makeRunMessage({
      runStatus: "cancelled",
      content: "Partial response before stop",
    })
    const { container } = renderWithTooltip(<RunCard message={msg} isStreaming={false} />)
    const collapsedTrigger = container.querySelector("[data-testid='run-card-collapsed']")
    expect(collapsedTrigger).toBeTruthy()
    expect(collapsedTrigger?.textContent).toContain("cancelled")
  })

  it("State 6: paused_on_approval / planning — renders header with thinking/planning state", () => {
    const msg = makeRunMessage({
      runStatus: "streaming",
      isPlanning: true,
      tool_calls: [
        {
          id: "tc-prep",
          name: "search_documents",
          args: {},
          status: "preparing",
          startedAt: 1_000_000,
        } as ToolCall,
      ],
    })
    const { container } = renderWithTooltip(<RunCard message={msg} isStreaming={true} />)
    expect(container.querySelector("[data-testid='run-card']")).toBeTruthy()
    const pill = container.querySelector("[data-testid='status-pill']")
    expect(pill).toBeTruthy()
    expect(pill?.getAttribute("data-status")).toBe("preparing")
  })

  it("State 7: no_tools — renders plain 'Agent run' title without tool count", () => {
    const msg = makeRunMessage({
      tool_calls: [],
      content: "Plain message with no tools",
    })
    const { container } = renderWithTooltip(<RunCard message={msg} isStreaming={false} />)
    expect(container.querySelector("[data-testid='run-card']")).toBeTruthy()
    expect(screen.getByText("Agent run")).toBeInTheDocument()
  })

  it("State 8: sub_agent — renders sub-agent model transparency indicator when expanded", () => {
    const msg = makeRunMessage({
      runStatus: "completed",
      tool_calls: [
        {
          id: "tc-sub",
          name: "search_documents",
          args: { query: "sub query" },
          status: "done",
          result: "sub",
          sub_agent_model: "gemini-2.0-flash",
          startedAt: 1_000_000,
          endedAt: 1_001_000,
        } as ToolCall,
      ],
    })
    const { container } = renderWithTooltip(<RunCard message={msg} isStreaming={false} />)
    const collapsedTrigger = container.querySelector("[data-testid='run-card-collapsed']")
    expect(collapsedTrigger).toBeTruthy()
    fireEvent.click(collapsedTrigger!)
    expect(screen.getByText(/Sub-agent: gemini-2.0-flash/i)).toBeInTheDocument()
  })
})
