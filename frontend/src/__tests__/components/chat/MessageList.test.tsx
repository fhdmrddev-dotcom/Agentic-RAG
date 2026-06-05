/**
 * Phase 068.5 (Plan 01 — Wave 0): RED test stubs for `MessageList.tsx` empty-state
 * skeleton branch.
 *
 * Tests D-068.5-11 (cold-load 3-bubble skeleton with shimmer) + D-068.5-12
 * (skeleton clears the instant the first message renders).
 *
 * RED at task start (MessageSkeleton + empty-state ternary don't exist yet);
 * GREEN at Task 4 end.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest"
import { render, screen, act } from "@testing-library/react"
import type { ReactNode } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageList } from "@/components/chat/MessageList"
import type { Message } from "@/types"

// MessageItem renders Radix tooltips on the assistant bubble; provide the
// TooltipProvider context the D-03 chip tests need (they render real
// assistant messages, unlike the skeleton tests above which render empty/user).
function renderML(ui: ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

// A flushable requestAnimationFrame queue for the D-03 scroll tests: the
// follow-scroll hook clears its programmatic-scroll flag on a rAF, and jsdom
// never auto-flushes rAF. We queue callbacks and run them on demand.
let rafQueue: FrameRequestCallback[] = []
function flushRaf() {
  const q = rafQueue
  rafQueue = []
  q.forEach((cb) => cb(0))
}

// jsdom lacks scrollIntoView; stub it so MessageList's auto-scroll effect
// (`bottomRef.current?.scrollIntoView`) doesn't throw inside passive effects.
beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = function () {}
  }
})

const NOW = "2026-05-13T00:00:00Z"

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "user",
    content: "Hello",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

describe("Phase 068.5 — MessageList skeleton", () => {
  it("renders <MessageSkeleton/> (data-testid='message-skeleton') when isLoading AND messages.length === 0", () => {
    // Phase 068.5 Gap-01: skeleton requires BOTH isLoading=true AND empty
    // messages. Empty + not-loading = new chat → no skeleton.
    render(<MessageList messages={[]} isStreaming={false} isLoading={true} />)
    expect(screen.getByTestId("message-skeleton")).toBeInTheDocument()
  })

  it("does NOT render the skeleton when at least one message is present", () => {
    render(<MessageList messages={[makeMessage()]} isStreaming={false} isLoading={true} />)
    expect(screen.queryByTestId("message-skeleton")).toBeNull()
  })

  it("Gap-01: does NOT render the skeleton on empty list when isLoading is false (new chat / no fetch in flight)", () => {
    render(<MessageList messages={[]} isStreaming={false} isLoading={false} />)
    expect(screen.queryByTestId("message-skeleton")).toBeNull()
  })

  it("Gap-01: defaults isLoading to false — empty list with no prop renders no skeleton", () => {
    render(<MessageList messages={[]} isStreaming={false} />)
    expect(screen.queryByTestId("message-skeleton")).toBeNull()
  })
})

/**
 * Phase 095 Plan 04 (D-03) — the floating "↓ Jump to live" chip wiring.
 *
 * MessageList wires `useFollowScroll` over the Radix viewport and renders the
 * floating chip (reusing the ONE RunStatusStrip) ONLY on scroll-away during a
 * live run. These cases drive the real viewport scroll geometry to prove:
 *   - scroll-UP during streaming → the chip renders (the pin released).
 *   - scroll-to-bottom → the chip hides + follow re-arms.
 * (095-VALIDATION.md → D-03 pass condition.)
 */
function setViewportGeometry(
  vp: HTMLElement,
  geom: { scrollHeight: number; clientHeight: number; scrollTop: number },
) {
  Object.defineProperty(vp, "scrollHeight", { value: geom.scrollHeight, configurable: true })
  Object.defineProperty(vp, "clientHeight", { value: geom.clientHeight, configurable: true })
  // scrollTop is writable on real elements; jsdom keeps it at 0 — define it.
  Object.defineProperty(vp, "scrollTop", { value: geom.scrollTop, writable: true, configurable: true })
}

function fireScroll(vp: HTMLElement) {
  act(() => {
    // The mount auto-scroll effect flags a programmatic scroll and schedules a
    // rAF to clear it. jsdom never auto-flushes rAF, so flush any pending frames
    // before the user scroll — otherwise `onScroll` would skip the release,
    // mistaking the user scroll for our own auto-follow. (In the browser the rAF
    // clears within ~16ms, well before a real user scroll.)
    flushRaf()
    vp.dispatchEvent(new Event("scroll"))
  })
}

function makeAssistant(overrides: Partial<Message> = {}): Message {
  return makeMessage({ id: "a-1", role: "assistant", content: "thinking…", ...overrides })
}

describe("Phase 095 Plan 04 — MessageList follow-but-release chip (D-03)", () => {
  beforeEach(() => {
    rafQueue = []
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length as unknown as number
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    rafQueue = []
  })

  function renderStreaming() {
    const utils = renderML(
      <MessageList messages={[makeAssistant()]} isStreaming={true} />,
    )
    // BL-05 attaches the scroll listener on a rAF; flush microtasks/frames so the
    // viewport listener is live before we dispatch scroll events.
    const vp = utils.container.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement
    return { ...utils, vp }
  }

  it("does NOT render the Jump-to-live chip while pinned at the bottom (default)", () => {
    const { vp } = renderStreaming()
    setViewportGeometry(vp, { scrollHeight: 1000, clientHeight: 500, scrollTop: 500 }) // dist 0
    fireScroll(vp)
    expect(screen.queryByTestId("jump-to-live-chip")).toBeNull()
  })

  it("scroll-up during streaming → the Jump-to-live chip renders", () => {
    const { vp } = renderStreaming()
    setViewportGeometry(vp, { scrollHeight: 1000, clientHeight: 500, scrollTop: 100 }) // dist 400 > 120
    fireScroll(vp)
    const chip = screen.getByTestId("jump-to-live-chip")
    expect(chip).toBeInTheDocument()
    expect(chip).toHaveTextContent("Jump to live")
    // reuses the ONE RunStatusStrip (no second strip)
    expect(chip.querySelector("[data-testid='run-status-strip']")).not.toBeNull()
  })

  it("scroll back to bottom → the chip hides + follow re-arms", () => {
    const { vp } = renderStreaming()
    // release
    setViewportGeometry(vp, { scrollHeight: 1000, clientHeight: 500, scrollTop: 100 })
    fireScroll(vp)
    expect(screen.getByTestId("jump-to-live-chip")).toBeInTheDocument()
    // re-arm
    setViewportGeometry(vp, { scrollHeight: 1000, clientHeight: 500, scrollTop: 500 })
    fireScroll(vp)
    expect(screen.queryByTestId("jump-to-live-chip")).toBeNull()
  })

  it("NOT streaming → no chip even when scrolled up (the chip is a live-run affordance)", () => {
    const { container } = renderML(
      <MessageList messages={[makeAssistant()]} isStreaming={false} />,
    )
    const vp = container.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement
    setViewportGeometry(vp, { scrollHeight: 1000, clientHeight: 500, scrollTop: 100 })
    fireScroll(vp)
    expect(screen.queryByTestId("jump-to-live-chip")).toBeNull()
  })

  it("clicking the chip re-pins (hides the chip)", () => {
    const { vp } = renderStreaming()
    setViewportGeometry(vp, { scrollHeight: 1000, clientHeight: 500, scrollTop: 100 })
    fireScroll(vp)
    const chip = screen.getByTestId("jump-to-live-chip")
    act(() => {
      chip.click()
    })
    expect(screen.queryByTestId("jump-to-live-chip")).toBeNull()
  })
})
