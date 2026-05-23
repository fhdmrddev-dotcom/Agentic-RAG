/**
 * Plan 075.4-04 D-075.4-SC#6 — React.memo MessageItem regression test.
 *
 * Verifies:
 *   1. MessageItem skips re-render when parent re-renders with byte-identical
 *      `message` prop and ref-stable callbacks.
 *   2. MessageItem DOES re-render when `message` prop changes by reference.
 *   3. MessageItem is structurally wrapped in React.memo ($$typeof check).
 *
 * Strategy: spy on `marked.parse` (called inside MarkdownRenderer's useMemo).
 * When MessageItem.memo skips a re-render, MarkdownRenderer doesn't mount/
 * re-execute, so marked.parse is NOT called. When memo invalidates,
 * MarkdownRenderer DOES re-run useMemo for new content, and marked.parse fires.
 * marked.parse is a strict proxy for MessageItem render-count under these
 * conditions.
 */
import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { useState } from "react"

// vi.hoisted spies — see MarkdownRenderer.memo.test.tsx for the pattern.
const mocks = vi.hoisted(() => ({
  markedParse: vi.fn((input: string) => `<p>${input}</p>`),
  sanitize: vi.fn((input: string) => input),
}))

vi.mock("marked", () => ({
  marked: {
    parse: mocks.markedParse,
    setOptions: () => undefined,
  },
}))

vi.mock("dompurify", () => ({
  default: { sanitize: mocks.sanitize },
}))

// Import AFTER vi.mock; vitest hoists vi.mock factories above imports.
// eslint-disable-next-line import/first
import { TooltipProvider } from "@/components/ui/tooltip"
// eslint-disable-next-line import/first
import { MessageItem } from "@/components/chat/MessageItem"
// eslint-disable-next-line import/first
import type { Message } from "@/types"

const NOW = new Date().toISOString()

function makeAssistantMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: "Hello world from assistant",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

describe("MessageItem React.memo regression (Plan 075.4-04 SC#6)", () => {
  it("does NOT re-render the markdown body when parent re-renders with byte-identical message + stable callbacks", () => {
    mocks.markedParse.mockClear()
    mocks.sanitize.mockClear()

    const message = makeAssistantMessage()
    const stableOnSend = vi.fn()
    const stableOnResume = vi.fn()

    function Parent() {
      const [counter, setCounter] = useState(0)
      return (
        <>
          <button data-testid="counter-bump" onClick={() => setCounter((c) => c + 1)}>
            bump {counter}
          </button>
          <MessageItem
            message={message}
            isStreaming={false}
            onSendMessage={stableOnSend}
            onResume={stableOnResume}
          />
        </>
      )
    }

    const { getByTestId } = render(
      <TooltipProvider>
        <Parent />
      </TooltipProvider>,
    )

    // Initial render: marked.parse fired once via MarkdownRenderer inside
    // the assistant content branch of MessageItem.
    const initialCalls = mocks.markedParse.mock.calls.length
    expect(initialCalls).toBeGreaterThanOrEqual(1)

    // Trigger parent re-renders WITHOUT changing message identity or callbacks.
    fireEvent.click(getByTestId("counter-bump"))
    fireEvent.click(getByTestId("counter-bump"))
    fireEvent.click(getByTestId("counter-bump"))

    // Memo skips MessageItem re-render → MarkdownRenderer's useMemo never
    // re-evaluates the deps → marked.parse not called again.
    expect(mocks.markedParse).toHaveBeenCalledTimes(initialCalls)
  })

  it("DOES re-render when message prop changes by reference", () => {
    mocks.markedParse.mockClear()
    mocks.sanitize.mockClear()

    const stableOnSend = vi.fn()
    const stableOnResume = vi.fn()

    function Parent({ msg }: { msg: Message }) {
      return (
        <MessageItem
          message={msg}
          isStreaming={false}
          onSendMessage={stableOnSend}
          onResume={stableOnResume}
        />
      )
    }

    const msgA = makeAssistantMessage({ id: "a", content: "first content" })
    const msgB = makeAssistantMessage({ id: "b", content: "different content" })

    const { rerender } = render(
      <TooltipProvider>
        <Parent msg={msgA} />
      </TooltipProvider>,
    )
    const initialCalls = mocks.markedParse.mock.calls.length

    rerender(
      <TooltipProvider>
        <Parent msg={msgB} />
      </TooltipProvider>,
    )

    // New message ref + new content → memo invalidates → MarkdownRenderer
    // re-runs useMemo on the new content → marked.parse fires again.
    expect(mocks.markedParse.mock.calls.length).toBeGreaterThan(initialCalls)
  })

  it("MessageItem is wrapped in React.memo (structural check via $$typeof)", () => {
    // React.memo returns an exotic component object with
    // $$typeof === Symbol.for("react.memo"). Asserting this structurally
    // protects against future refactors that accidentally unwrap the memo.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exotic = MessageItem as any
    expect(exotic).toBeDefined()
    // memo() returns an object (not a function). The $$typeof is the
    // canonical React-internal marker for memo'd components.
    expect(typeof exotic).toBe("object")
    expect(exotic.$$typeof).toBe(Symbol.for("react.memo"))
  })
})
