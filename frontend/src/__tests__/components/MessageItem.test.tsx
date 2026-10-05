/**
 * Tests for MessageItem component.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageItem } from "@/components/chat/MessageItem"
import type { Message } from "@/types"
import { useStreamsStore } from "@/stores/streamsStore"

const NOW = new Date().toISOString()

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "user",
    content: "Hello world",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe("MessageItem – user messages", () => {
  it("renders the message content", () => {
    renderWithTooltip(<MessageItem message={makeMessage({ content: "Hello world" })} />)
    expect(screen.getByText("Hello world")).toBeInTheDocument()
  })

  it("aligns user message to the right (justify-end)", () => {
    const { container } = renderWithTooltip(
      <MessageItem message={makeMessage({ role: "user" })} />,
    )
    const wrapper = container.querySelector("div")
    expect(wrapper?.className).toContain("justify-end")
  })

  it("does not show the bot icon for user messages", () => {
    const { container } = renderWithTooltip(
      <MessageItem message={makeMessage({ role: "user" })} />,
    )
    // Bot icon has a parent with gradient-primary; user icon has bg-muted
    // We check the icon wrapper count: user messages only have 1 avatar div (right)
    const avatarDivs = container.querySelectorAll(".rounded-full")
    expect(avatarDivs).toHaveLength(1)
  })

  it("applies primary background for user messages", () => {
    const { container } = renderWithTooltip(
      <MessageItem message={makeMessage({ role: "user", content: "Hi" })} />,
    )
    // Find the bubble div — redesign uses gradient-primary
    const bubble = container.querySelector(".gradient-primary")
    expect(bubble).toBeInTheDocument()
  })
})

describe("MessageItem – assistant messages", () => {
  it("renders the message content", () => {
    renderWithTooltip(
      <MessageItem message={makeMessage({ role: "assistant", content: "I can help!" })} />,
    )
    expect(screen.getByText("I can help!")).toBeInTheDocument()
  })

  it("aligns assistant message to the left (flex row with gap-3)", () => {
    const { container } = renderWithTooltip(
      <MessageItem message={makeMessage({ role: "assistant" })} />,
    )
    const wrapper = container.querySelector("div")
    expect(wrapper?.className).toContain("gap-3")
  })

  it("shows the bot icon for assistant messages", () => {
    renderWithTooltip(
      <MessageItem message={makeMessage({ role: "assistant" })} />,
    )
    // ~~Bot icon parent has gradient-primary class after redesign~~ — 276-06 (D-24/D-27):
    // the assistant mark is the Iris avatar (`.iris`) inside the same test id.
    const botIconWrapper = screen.getByTestId("assistant-bot-icon")
    expect(botIconWrapper.querySelector(".iris")).toBeInTheDocument()
  })

  it("applies text foreground for assistant messages", () => {
    const { container } = renderWithTooltip(
      <MessageItem message={makeMessage({ role: "assistant", content: "Sure" })} />,
    )
    // Assistant content uses text-foreground after redesign (no bg-muted bubble)
    const content = container.querySelector(".text-foreground")
    expect(content).toBeInTheDocument()
  })
})

describe("MessageItem – streaming state", () => {
  it("shows thinking indicator when streaming with empty content", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "" })}
        isStreaming={true}
      />,
    )
    expect(screen.getByText("Setting up agent…")).toBeInTheDocument()
  })

  it("shows cursor when streaming with non-empty content", () => {
    const { container } = renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Partial" })}
        isStreaming={true}
      />,
    )
    // The cursor is a span with animate-pulse
    const cursor = container.querySelector(".animate-pulse")
    expect(cursor).toBeInTheDocument()
  })

  it("does not show streaming indicators when not streaming", () => {
    const { container } = renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Done" })}
        isStreaming={false}
      />,
    )
    const cursor = container.querySelector(".animate-pulse")
    expect(cursor).not.toBeInTheDocument()
  })
})

// =============================================================================
// Phase 068.5 — ~~pulse class gating on runStatus~~ → Phase 276-06 (D-24 / D-27): the Iris
// avatar's state, read from `data-iris-state` on the SAME binding test id.
//
// RESEARCH §Finding #8 still holds: the codebase enum is the 5-value
// 'streaming' | 'completed' | 'failed' | 'cancelled' | 'timed_out'.
// ~~The pulse fires ONLY on 'streaming'~~ — reversed at 276-06: the pulse is gone and the
// Iris avatar is driven by `irisStateFor` (`irisState.ts`, the ONE home of the precedence
// order). The seven cases are migrated IN PLACE (same subjects, same count); each also proves
// the old gradient glyph is gone (no `.lucide-sparkles`). Tests 8-9 are new.
// =============================================================================
function irisAvatar(): HTMLElement {
  const botIcon = screen.getByTestId("assistant-bot-icon")
  expect(botIcon.querySelector(".iris")).not.toBeNull()
  expect(botIcon.querySelector(".lucide-sparkles")).toBeNull()
  return botIcon
}

describe("Phase 068.5 → 276-06 — the Iris avatar state on runStatus", () => {
  it("Test 1 — runStatus === 'streaming' with content → data-iris-state=streaming", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Streaming reply…", runStatus: "streaming" })}
      />,
    )
    expect(irisAvatar().getAttribute("data-iris-state")).toBe("streaming")
  })

  it("Test 2 — runStatus === 'completed' → idle", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Done.", runStatus: "completed" })}
      />,
    )
    expect(irisAvatar().getAttribute("data-iris-state")).toBe("idle")
  })

  it("Test 3 — runStatus === 'failed' → error", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Oops.", runStatus: "failed" })}
      />,
    )
    expect(irisAvatar().getAttribute("data-iris-state")).toBe("error")
  })

  it("Test 4 — runStatus === 'cancelled' → cancelled", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Stopped.", runStatus: "cancelled" })}
      />,
    )
    expect(irisAvatar().getAttribute("data-iris-state")).toBe("cancelled")
  })

  it("Test 5 — runStatus === 'timed_out' → error", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Timed out.", runStatus: "timed_out" })}
      />,
    )
    expect(irisAvatar().getAttribute("data-iris-state")).toBe("error")
  })

  it("Test 6 — runStatus === undefined (DB-loaded historical message) → idle", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Old message." })}
      />,
    )
    expect(irisAvatar().getAttribute("data-iris-state")).toBe("idle")
  })

  it("Test 7 — mutual exclusivity: 'failed' shows Resume button AND the avatar is settled in error", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Failed run.", runStatus: "failed" })}
        onResume={() => {}}
      />,
    )
    // Retry turn button is rendered for failed runs (BUG-260818-01 / L-068.5-04 / Phase 063/066 gate)
    expect(screen.getByRole("button", { name: /retry turn/i })).toBeInTheDocument()
    // The avatar reads error and is at rest (mutual exclusivity is structural)
    const avatar = irisAvatar()
    expect(avatar.getAttribute("data-iris-state")).toBe("error")
    expect(avatar.querySelector(".iris")!.getAttribute("data-motion")).toBe("rest")
  })

  it("Test 8 — pre-first-token: thinking; the spinner and three dots are gone, the activity words stay", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "", runStatus: "streaming" })}
        isStreaming={true}
      />,
    )
    expect(irisAvatar().getAttribute("data-iris-state")).toBe("thinking")
    const row = screen.getByTestId("assistant-message")
    expect(row.querySelector(".animate-dotBounce")).toBeNull()
    expect(row.querySelector(".animate-spin")).toBeNull()
    expect(screen.getByText("Setting up agent…")).toBeInTheDocument()
  })

  it("Test 9 — a cap-paused lock reads waiting on the LAST assistant row only; an earlier row stays idle", () => {
    useStreamsStore.setState({
      workflowLockByThread: new Map([
        ["thread-1", { runId: "run-cap-1", mode: "cap_paused", capPaused: true, continuesRemaining: 2 }],
      ]),
    })
    try {
      const last = renderWithTooltip(
        <MessageItem
          message={makeMessage({ role: "assistant", content: "Partial.", runStatus: "completed" })}
          isLastAssistant
        />,
      )
      expect(irisAvatar().getAttribute("data-iris-state")).toBe("waiting")
      last.unmount()

      renderWithTooltip(
        <MessageItem
          message={makeMessage({ id: "msg-0", role: "assistant", content: "Earlier.", runStatus: "completed" })}
          isLastAssistant={false}
        />,
      )
      expect(irisAvatar().getAttribute("data-iris-state")).toBe("idle")
    } finally {
      useStreamsStore.setState({ workflowLockByThread: new Map() })
    }
  })

  it("Test 10 — an EXHAUSTED cap pause (no Continue left) reads idle, not waiting (276-REVIEW B-WR-01)", () => {
    useStreamsStore.setState({
      workflowLockByThread: new Map([
        ["thread-1", { runId: "run-cap-1", mode: "cap_paused", capPaused: true, continuesRemaining: 0 }],
      ]),
    })
    try {
      renderWithTooltip(
        <MessageItem
          message={makeMessage({ role: "assistant", content: "Partial.", runStatus: "completed" })}
          isLastAssistant
        />,
      )
      expect(irisAvatar().getAttribute("data-iris-state")).toBe("idle")
    } finally {
      useStreamsStore.setState({ workflowLockByThread: new Map() })
    }
  })

  it("Test 11 — a finished row whose ask_user was left 'interrupted' by Stop settles to idle (276-REVIEW B-WR-01)", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({
          role: "assistant",
          content: "Stopped.",
          runStatus: "completed",
          tool_calls: [{ name: "ask_user", args: {}, status: "interrupted" }],
        })}
        isLastAssistant
      />,
    )
    expect(irisAvatar().getAttribute("data-iris-state")).toBe("idle")
  })
})

// =============================================================================
// Phase 174 Plan 02 — STATE-01a + STATE-02 terminal-state render invariants
// (VERIFY, not rebuild — D-01/D-02).
//
// The cancelled-no-output affordance (MessageItem.tsx:632-649) and the
// persistent "Response stopped" indicator (MessageItem.tsx:675-685) already
// exist (Phase 147 / D-03). These cases LOCK them under test so the sibling
// STATE-01b/03/04 edits in this phase — and any future MessageItem hot-file
// churn — cannot silently regress them. No production render is rebuilt.
//
// Both conditions derive PURELY from `message.runStatus` (+ `!!message.content`
// / `!isStreaming` gates). `runStatus` is the field the backend reload-derive
// populates on every hydrate: threads.py:350-353 zips `runs.status → run_status`
// keyed on the message's own `message_id` (so even the empty content_len=0
// early-cancel row is populated), and api.ts:_mapMessageResponse (:198) maps
// `run_status → runStatus` on every getMessages/getSnapshot. Asserting the
// render fires from `runStatus` alone is therefore the component-level proof of
// STATE-02's reload persistence: after a full cold reload the message carries
// the same `runStatus`, so the same indicator renders — no live-only state
// (`message.stopped`) required.
// =============================================================================
describe("Phase 174 — STATE-01a/02 terminal-state render (VERIFY, derives from runStatus)", () => {
  it("STATE-01a — empty-content cancelled run renders 'cancelled — no output yet' (data-testid=cancelled-no-output)", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "", runStatus: "cancelled", tool_calls: [] })}
        isStreaming={false}
      />,
    )
    // The DeepSeek-early-cancel empty row (content_len=0) must render an honest
    // affordance, never an avatar-only empty bubble (BUG-260710-02).
    const affordance = screen.getByTestId("cancelled-no-output")
    expect(affordance).toBeInTheDocument()
    expect(affordance.textContent).toContain("cancelled — no output yet")
  })

  it("STATE-01a guard — the empty-content cancelled row does NOT also render 'Response stopped' (mutual exclusion via !!content)", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "", runStatus: "cancelled", tool_calls: [] })}
        isStreaming={false}
      />,
    )
    // The bottom indicator is gated on `runStatus === 'cancelled' && !!content`,
    // so the empty row is handled ONLY by the "cancelled — no output yet"
    // affordance above — never a double indicator.
    expect(screen.queryByText("Response stopped")).toBeNull()
  })

  it("STATE-02 — a cancelled run WITH content renders the persistent 'Response stopped' indicator (reload-derived, not message.stopped)", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Here is a partial answer.", runStatus: "cancelled" })}
        isStreaming={false}
      />,
    )
    // `message.stopped` is LIVE-only and is NOT re-derived on reload; the
    // indicator gates additionally on `runStatus === 'cancelled'` so it survives
    // a full cold reload (BUG-260710-01 / Phase 147 D-03).
    expect(screen.getByText("Response stopped")).toBeInTheDocument()
  })

  it("STATE-02 guard — a cancelled run WITH content does NOT render the empty 'cancelled — no output yet' affordance", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Here is a partial answer.", runStatus: "cancelled" })}
        isStreaming={false}
      />,
    )
    expect(screen.queryByTestId("cancelled-no-output")).toBeNull()
  })

  it("STATE-02 — a timed_out run renders 'Agent reached time limit' (and not 'Response stopped')", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Partial output before the deadline.", runStatus: "timed_out" })}
        isStreaming={false}
      />,
    )
    expect(screen.getByText("Agent reached time limit")).toBeInTheDocument()
    expect(screen.queryByText("Response stopped")).toBeNull()
  })

  it("STATE-02 — the reload-derived indicator stays silent while the run is still streaming (gates on !isStreaming)", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Streaming partial…", runStatus: "cancelled" })}
        isStreaming={true}
      />,
    )
    // The persistent indicator is a TERMINAL (reload) marker, never a live one —
    // it must not fire on a still-streaming row.
    expect(screen.queryByText("Response stopped")).toBeNull()
  })
})
