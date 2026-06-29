/**
 * SEED-098 Change 2 — bottom-of-run-card de-duplication.
 *
 * This suite previously guarded the per-message `stickyBottomLabel` cache that
 * powered the loose bottom italic `Preparing code…/Synthesizing answer…` echo
 * below the run card (Phase 075 D-075-14). SEED-098 Change 2 DELETES that echo:
 * the RunCard header strip (RunStatusStrip) already carries the live verb +
 * timer, so the bottom echo was a pure duplicate. The `stickyLabelRef /
 * computedLabel / stickyBottomLabel` computation is gone with it.
 *
 * What this suite now asserts:
 *   (i)  NO loose bottom italic echo renders during a streaming run with tools
 *        (the duplicate is gone) — for both the normal and the parallel-run
 *        silent-window case.
 *   (ii) Terminal-state copy still renders, but now ONLY from the Square block
 *        (`timed_out` → "Agent reached time limit"; stopped → "Response
 *        stopped"). The Square block's italic lives inside a `<div>`; the
 *        removed echo lived inside a `<span>` — so the two helpers below
 *        disambiguate on the parent tag without brittle position selectors.
 *
 * Queries are scoped inside `data-testid="assistant-message"`.
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

/** The SEED-098-removed bottom echo lived in `<span class="italic">` whose
 *  PARENT was a `<span>`. After the deletion no such span-parent italic echo
 *  should render for a streaming run with tools — this helper must return null.
 *  Joins any survivors so a regression surfaces the offending text. */
function stickyEchoText(): string | null {
  const msg = screen.getByTestId("assistant-message")
  const italics = within(msg).queryAllByText((_, el) =>
    Boolean(el?.classList.contains("italic")),
  )
  const stickySpans = italics.filter((el) => el.parentElement?.tagName === "SPAN")
  const texts = stickySpans.map((el) => el.textContent?.trim() ?? "").filter((t) => t.length > 0)
  return texts.length ? texts.join(" | ") : null
}

/** The terminal Square block renders `<span class="italic">` inside a `<div>`. */
function terminalBlockText(): string | null {
  const msg = screen.getByTestId("assistant-message")
  const italics = within(msg).queryAllByText((_, el) =>
    Boolean(el?.classList.contains("italic")),
  )
  const divSpans = italics.filter((el) => el.parentElement?.tagName === "DIV")
  const texts = divSpans.map((el) => el.textContent?.trim() ?? "").filter((t) => t.length > 0)
  if (texts.length === 0) return null
  if (texts.length > 1)
    throw new Error(`terminalBlockText: multiple terminal italic labels: ${JSON.stringify(texts)}`)
  return texts[0]
}

describe("MessageItem — SEED-098 Change 2: loose bottom echo removed; terminal copy preserved", () => {
  it("no bottom italic echo renders during a streaming run with tools (the duplicate is gone)", () => {
    const message = makeMessage({
      runStatus: "streaming",
      tool_calls: [runningTool("execute_code")],
    })
    renderWithTooltip(<MessageItem message={message} isStreaming={true} />)
    // RunCard header strip carries the live verb + timer now — no loose echo.
    expect(stickyEchoText()).toBeNull()
  })

  it("no bottom echo in the parallel-run silent window (isStreaming=false, runStatus='streaming')", () => {
    // The case the old sticky cache existed for. There is simply no bottom echo
    // to retain anymore — the panel header owns the live state.
    const message = makeMessage({
      runStatus: "streaming",
      tool_calls: [{ ...runningTool("execute_code"), status: "done" }],
    })
    renderWithTooltip(<MessageItem message={message} isStreaming={false} />)
    expect(stickyEchoText()).toBeNull()
  })

  it("terminal 'Agent reached time limit' still renders in the Square block (timed_out)", () => {
    const message = makeMessage({
      runStatus: "timed_out",
      tool_calls: [{ ...runningTool("execute_code"), status: "done" }],
    })
    renderWithTooltip(<MessageItem message={message} isStreaming={false} />)
    expect(terminalBlockText()).toBe("Agent reached time limit")
    // And no span-parent echo duplicate of it.
    expect(stickyEchoText()).toBeNull()
  })

  it("terminal 'Response stopped' still renders in the Square block (stopped)", () => {
    const message = makeMessage({
      stopped: true,
      tool_calls: [{ ...runningTool("execute_code"), status: "done" }],
    })
    renderWithTooltip(<MessageItem message={message} isStreaming={false} />)
    expect(terminalBlockText()).toBe("Response stopped")
  })
})
