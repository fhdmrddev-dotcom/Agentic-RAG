/**
 * Phase 075.1 Plan 03 Task 2 — MessageItem sticky bottom-indicator cache reset.
 *
 * Phase 075 D-075-14 introduced a per-component `stickyLabelRef` that retains
 * the last non-null `outerBannerLabel(...)` value across silent windows inside
 * long tool calls (matplotlib renders, sandbox time.sleep, etc.) so the bottom
 * indicator doesn't go blank.
 *
 * Phase 075 used the provider-level `isStreaming` prop as the cache reset
 * trigger. That breaks under parallel runs on the same surface (B-260519-07
 * indicator portion): when ANY run completes, `isStreaming` flips false and
 * the sticky cache resets for THIS message — even when this message's own
 * `runStatus` is still "streaming".
 *
 * Plan 03 changes the reset trigger to per-message `runStatus`. The literal
 * codebase enum values (frontend/src/types/index.ts:113) are:
 *   "streaming" | "completed" | "failed" | "cancelled" | "timed_out"
 *
 * Decision matrix locked by these tests (per PLAN.md Tests 1-4 + bonus
 * regression checks for the terminal-banner branches that Plan 03 does NOT
 * touch but which sit immediately downstream of stickyBottomLabel):
 *
 *   | isStreaming | runStatus    | Sticky label rendered? | Test |
 *   | ----------- | ------------ | ---------------------- | ---- |
 *   | false       | "streaming"  | YES (parallel-run)     | 1    |
 *   | true        | "completed"  | NO (reset)             | 2    |
 *   | true        | "streaming"  | YES (D-075-14 classic) | 3    |
 *   | true        | undefined    | NO (legacy → terminal) | 4    |
 *
 * We scope all queries inside `data-testid="assistant-message"` to avoid
 * collisions with duplicate copies of the same string elsewhere in the JSX
 * (e.g., "Agent reached time limit" appears in both stickyBottomLabel and the
 * post-content Square block; "Running code…" appears in both stickyBottomLabel
 * and the active-tool indicator when message.content is non-empty).
 */
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageItem } from "@/components/chat/MessageItem"
import type { Message, ToolCall } from "@/types"

const NOW = new Date().toISOString()

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: "",
    created_at: NOW,
    updated_at: NOW,
    tool_calls: [],
    ...overrides,
  }
}

function runningTool(name: string): ToolCall {
  return {
    id: `running-${name}`,
    name,
    args: {},
    status: "running",
    startedAt: Date.now(),
  }
}

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

/** Locate the stickyBottomLabel `<span class="italic">{stickyBottomLabel}</span>`
 *  rendered inside the hasAnyTools branch (lines ~177-196 of MessageItem.tsx).
 *
 *  The terminal-banner post-content block (lines 205-212) ALSO renders an
 *  italic span with the same text for runStatus="timed_out" / "cancelled" —
 *  but it lives inside a `<div>` wrapper, whereas the stickyBottomLabel span
 *  lives inside a `<span>` wrapper (line 180). We filter on the parent's tag
 *  to disambiguate without coupling to brittle position selectors.
 *
 *  Returns the textContent of the sticky span, or null if the span doesn't
 *  exist or contains an empty string. */
function stickyLabelText(): string | null {
  const msg = screen.getByTestId("assistant-message")
  const italics = within(msg).queryAllByText((_, el) =>
    Boolean(el?.classList.contains("italic")),
  )
  // Keep only italic spans whose parent is a <span> (the stickyBottomLabel
  // location) — drops the post-content Square block (parent is a <div>).
  const stickySpans = italics.filter((el) => el.parentElement?.tagName === "SPAN")
  const texts = stickySpans.map((el) => el.textContent?.trim() ?? "").filter((t) => t.length > 0)
  if (texts.length === 0) return null
  if (texts.length > 1) throw new Error(`stickyLabelText: multiple sticky-position italic labels found: ${JSON.stringify(texts)}`)
  return texts[0]
}

describe("MessageItem sticky bottom-indicator (Plan 03 Task 2 — runStatus-driven reset)", () => {
  it("Test 1 (parallel-run repro): isStreaming=false + runStatus='streaming' → sticky retains label across silent windows", () => {
    // Initial render: a single execute_code tool is running → label is
    // "Running code…" via outerBannerLabel. The Plan 03 fix gates retention
    // on runStatus==='streaming' (not isStreaming), so even with
    // isStreaming=false the message-level streaming state keeps the label.
    const messageWithTool = makeMessage({
      runStatus: "streaming",
      tool_calls: [runningTool("execute_code")],
    })
    const { rerender } = renderWithTooltip(
      <MessageItem message={messageWithTool} isStreaming={false} />,
    )
    expect(stickyLabelText()).toBe("Running code…")

    // Silent window: tool flips to "done" so outerBannerLabel transitions to
    // "Synthesizing answer…" (hasAnyTools && !activeTool branch). Message
    // runStatus is still "streaming"; sticky cache MUST keep updating and
    // never reset to empty.
    const messageInSilentWindow = makeMessage({
      runStatus: "streaming",
      tool_calls: [{ ...runningTool("execute_code"), status: "done" }],
    })
    rerender(
      <TooltipProvider>
        <MessageItem message={messageInSilentWindow} isStreaming={false} />
      </TooltipProvider>,
    )
    expect(stickyLabelText()).toBe("Synthesizing answer…")
  })

  it("Test 2: isStreaming=true + runStatus='completed' → sticky resets (no italic label rendered)", () => {
    // This message is terminally completed even though the surface still
    // streams. Plan 03 resets the sticky cache on runStatus terminal — so
    // no italic label should render in the bottom-indicator branch.
    // (content: "" prevents the active-tool / planning branches that also
    // render italic spans from triggering.)
    const message = makeMessage({
      runStatus: "completed",
      tool_calls: [{ ...runningTool("execute_code"), status: "done" }],
    })
    renderWithTooltip(<MessageItem message={message} isStreaming={true} />)
    // hasAnyTools=true, content="", isMessageStreaming=false (post-Plan-03)
    // → computedLabel=null and stickyLabelRef.current=null → stickyBottomLabel
    // falls through both branches and renders null inside the italic span,
    // which produces an empty span (no text). stickyLabelText() returns null.
    expect(stickyLabelText()).toBeNull()
  })

  it("Test 3 (classic D-075-14): isStreaming=true + runStatus='streaming' + tool running → sticky retains", () => {
    const message = makeMessage({
      runStatus: "streaming",
      tool_calls: [runningTool("execute_code")],
    })
    renderWithTooltip(<MessageItem message={message} isStreaming={true} />)
    expect(stickyLabelText()).toBe("Running code…")
  })

  it("Test 4: isStreaming=true + runStatus=undefined (legacy DB-loaded row) → treated as terminal (no sticky)", () => {
    // Legacy row loaded from DB before runStatus was added (Phase 063
    // D-063-04 backfilled DB rows, but undefined is still observable for
    // historical messages without run metadata). Plan 03 treats undefined as
    // terminal (matches Phase 075's isStreaming==false branch behavior).
    const message = makeMessage({
      // runStatus intentionally omitted (undefined)
      tool_calls: [runningTool("execute_code")],
    })
    renderWithTooltip(<MessageItem message={message} isStreaming={true} />)
    expect(stickyLabelText()).toBeNull()
  })

  it("Regression: runStatus='timed_out' + content empty → bottom indicator shows 'Agent reached time limit'", () => {
    // Plan 03 does NOT modify the timed_out / cancelled / stopped branches at
    // lines 87-91 of MessageItem.tsx — but it does swap the gating signal
    // there from `isStreaming` to `isMessageStreaming`. This regression check
    // ensures the terminal branches still fire for the matching runStatus
    // values when isStreaming=false (matches the post-D-075-14 behavior).
    // content empty so only the hasAnyTools branch's italic span renders.
    const message = makeMessage({
      runStatus: "timed_out",
      tool_calls: [{ ...runningTool("execute_code"), status: "done" }],
    })
    renderWithTooltip(<MessageItem message={message} isStreaming={false} />)
    expect(stickyLabelText()).toBe("Agent reached time limit")
  })

  it("Regression: runStatus='cancelled' + content empty → bottom indicator shows 'Response stopped'", () => {
    const message = makeMessage({
      runStatus: "cancelled",
      tool_calls: [{ ...runningTool("execute_code"), status: "done" }],
    })
    renderWithTooltip(<MessageItem message={message} isStreaming={false} />)
    expect(stickyLabelText()).toBe("Response stopped")
  })
})
