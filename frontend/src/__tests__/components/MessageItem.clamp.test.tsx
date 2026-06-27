/**
 * Phase 128 Plan 02 — CTC-04 user-prompt clamp (sketch 050-A / D-03).
 *
 * A long USER prompt collapses to a `-webkit-line-clamp:7` preview + a fade
 * matched to the violet end of the bubble's 135° gradient (hsl(258 90% 66%)) +
 * an inline "Read more" / "Show less" chip. SHORT user prompts render
 * byte-identically to today (no fade, no Read-more — gated on overflow). USER
 * prompts ONLY — the assistant branch is untouched.
 *
 * jsdom-no-layout caveat (128-PATTERNS.md § "Component (render) test scaffold"):
 * jsdom does not lay out, so `scrollHeight`/`clientHeight` are both 0 and the
 * real `useLayoutEffect` overflow-detect never trips on its own. To exercise the
 * REAL production overflow branch (rather than a test-only prop) we mock
 * `HTMLElement.prototype.scrollHeight` to exceed `clientHeight` for the
 * long-content tests, and leave it at the jsdom default (0) for the short-content
 * test. Live overflow behavior on a real browser is covered by the D-06 manual
 * UAT (Plan 05, long-message axis).
 */
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageItem } from "@/components/chat/MessageItem"
import type { Message } from "@/types"

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

/**
 * Force the overflow branch by making every element report a scrollHeight that
 * exceeds its clientHeight (jsdom reports 0/0 with no layout engine). This makes
 * the REAL `useLayoutEffect` measure in UserBubble flip `overflowing` true, so
 * the production fade + Read-more affordance render exactly as they would in a
 * real browser when the clamped <p> overflows.
 */
function forceOverflow() {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(400)
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(160)
}

const LONG_CONTENT = Array.from(
  { length: 40 },
  (_, i) => `Line ${i + 1}: this is a long pasted prompt that overflows the clamp.`,
).join("\n")

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Phase 128 CTC-04 — long user prompt clamps with Read more", () => {
  it("Test 1 — long content renders a Read more button", () => {
    forceOverflow()
    renderWithTooltip(
      <MessageItem message={makeMessage({ role: "user", content: LONG_CONTENT })} />,
    )
    expect(
      screen.getByRole("button", { name: /read more/i }),
    ).toBeInTheDocument()
  })

  it("Test 1b — clicking Read more toggles to Show less", () => {
    forceOverflow()
    renderWithTooltip(
      <MessageItem message={makeMessage({ role: "user", content: LONG_CONTENT })} />,
    )
    const btn = screen.getByRole("button", { name: /read more/i })
    fireEvent.click(btn)
    expect(
      screen.getByRole("button", { name: /show less/i }),
    ).toBeInTheDocument()
  })

  it("Test 2 — short content renders NO Read more button and keeps the pre-wrap <p>", () => {
    // No forceOverflow() → jsdom default scrollHeight 0 == clientHeight 0 → not overflowing.
    const { container } = renderWithTooltip(
      <MessageItem message={makeMessage({ role: "user", content: "Hi there" })} />,
    )
    expect(
      screen.queryByRole("button", { name: /read more/i }),
    ).toBeNull()
    // The <p> still carries the today-identical wrapping classes.
    const p = container.querySelector("p")
    expect(p?.className).toContain("whitespace-pre-wrap")
    expect(p?.className).toContain("break-words")
  })

  it("Test 3 — the fade overlay dissolves to the bubble violet (from-[hsl(258_90%_66%)]), not the page bg", () => {
    forceOverflow()
    const { container } = renderWithTooltip(
      <MessageItem message={makeMessage({ role: "user", content: LONG_CONTENT })} />,
    )
    const fade = container.querySelector('[class*="from-[hsl(258_90%_66%)]"]')
    expect(fade).not.toBeNull()
  })

  it("Test 4 — the assistant branch does NOT render the user-bubble clamp Read more", () => {
    forceOverflow()
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: LONG_CONTENT })}
      />,
    )
    // CTC-04 is USER prompts only — the assistant branch is untouched.
    expect(
      screen.queryByRole("button", { name: /read more/i }),
    ).toBeNull()
  })
})
