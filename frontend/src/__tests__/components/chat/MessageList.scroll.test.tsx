/**
 * Phase 243 Plan 03 Task 1 (D-243-05 / D-243-16) — THE SCROLL EFFECT'S FIRST
 * BEHAVIOURAL COVERAGE.
 *
 * ⛔ WHY THIS IS A NEW FILE AND NOT A NEW `describe` IN `MessageList.test.tsx`.
 * That file's `beforeAll` (`:61-65`) installs `HTMLElement.prototype.scrollIntoView`
 * as a **no-op**, tree-wide. Nothing mounted under it can see how many times
 * `MessageList.tsx:141-176` scrolls, or with which `behavior`. So every claim ever
 * made about this effect — including "the extraction changed no pixel" — has been an
 * assertion rather than a measurement. Here the stub is a **spy**.
 *
 * ⛔ AND WHY THE THREAD IS LONG. The ROADMAP names *"verified once by hand and never
 * on a thread with fifty messages"* as a failure mode of this exact surface. Every
 * case below runs on `LONG_THREAD_SIZE` messages, not a 3-message fixture.
 *
 * ⚠ THE GESTURE RULE, inherited verbatim from `MessageList.test.tsx:126-145`: a person
 * scrolling produces a GESTURE and then the scroll event it causes. A bare `scroll`
 * with no input before it is something no human can produce — so `userScroll()` always
 * dispatches both. The ONE case that dispatches a bare `scroll` is §3, and that is its
 * entire point: it is modelling an event the reader did **not** produce.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageList } from "@/components/chat/MessageList"
import { PROGRAMMATIC_SCROLL_SETTLE_MS, USER_GESTURE_WINDOW_MS } from "@/hooks/useFollowScroll"
import type { Message } from "@/types"

// The ONE mocked wire call — `ThreadRunLine` reads `GET /threads/{id}/workflow`.
// ⚠ SPREADS the real module: `MessageItem`'s subtree pulls many other `@/lib/api`
// exports and a hand-picked factory would break this file for a reason no assertion
// here would explain (`MessageList.test.tsx:30-33` records that trap).
const { mockGetThreadWorkflow } = vi.hoisted(() => ({ mockGetThreadWorkflow: vi.fn() }))
vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return { ...actual, getThreadWorkflow: mockGetThreadWorkflow }
})

const NOW = "2026-09-11T00:00:00Z"
/** ⚠ Quoted in the SUMMARY. The ROADMAP's failure mode is a fifty-message thread. */
const LONG_THREAD_SIZE = 54

function makeLongThread(lastAssistantContent = "tokens so far"): Message[] {
  const out: Message[] = []
  for (let i = 0; i < LONG_THREAD_SIZE - 1; i++) {
    out.push({
      id: `m-${i}`,
      thread_id: "thread-1",
      user_id: "user-1",
      role: i % 2 === 0 ? "user" : "assistant",
      content: `message ${i} — a paragraph of real transcript, long enough to be worth scrolling back to read.`,
      created_at: NOW,
      updated_at: NOW,
    })
  }
  out.push({
    id: "a-live",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: lastAssistantContent,
    created_at: NOW,
    updated_at: NOW,
    runId: "run-live",
  } as Message)
  return out
}

function withPreparingTool(messages: Message[]): Message[] {
  const copy = messages.slice()
  const last = { ...copy[copy.length - 1] } as Message
  last.tool_calls = [{ name: "search_documents", args: {}, status: "preparing", id: "preparing-0" }]
  // ⚠ RunCard only mounts its ToolCallPanel body when `runStatus === "streaming"`
  // (`RunCard.tsx:70,93` — a terminal run with tools mounts COLLAPSED). A `preparing`
  // tool can only exist on a live run anyway, so this is the faithful fixture, not a prop
  // added to make a selector resolve.
  ;(last as { runStatus?: string }).runStatus = "streaming"
  copy[copy.length - 1] = last
  return copy
}

/** A token arrived: a NEW array holding a NEW last-message object. Identity is the signal. */
function withMoreTokens(messages: Message[], moreText: string): Message[] {
  const copy = messages.slice()
  const last = copy[copy.length - 1]
  copy[copy.length - 1] = { ...last, content: last.content + moreText }
  return copy
}

let rafQueue: FrameRequestCallback[] = []
function flushRaf() {
  const q = rafQueue
  rafQueue = []
  q.forEach((cb) => cb(0))
}

function setViewportGeometry(
  vp: HTMLElement,
  geom: { scrollHeight: number; clientHeight: number; scrollTop: number },
) {
  Object.defineProperty(vp, "scrollHeight", { value: geom.scrollHeight, configurable: true })
  Object.defineProperty(vp, "clientHeight", { value: geom.clientHeight, configurable: true })
  Object.defineProperty(vp, "scrollTop", { value: geom.scrollTop, writable: true, configurable: true })
}

/** dist = scrollHeight - scrollTop - clientHeight. 120 is FOLLOW_SCROLL_THRESHOLD. */
function atBottom(vp: HTMLElement) {
  setViewportGeometry(vp, { scrollHeight: 40_000, clientHeight: 800, scrollTop: 39_200 }) // dist 0
}
function nudgedUp(vp: HTMLElement) {
  setViewportGeometry(vp, { scrollHeight: 40_000, clientHeight: 800, scrollTop: 39_140 }) // dist 60 — still "near bottom"
}
function scrolledWellUp(vp: HTMLElement) {
  setViewportGeometry(vp, { scrollHeight: 40_000, clientHeight: 800, scrollTop: 30_000 }) // dist 9200
}

/** A person scrolling: the wheel event, then the scroll it causes. */
function userScroll(vp: HTMLElement, direction: "up" | "down") {
  act(() => {
    flushRaf()
    vp.dispatchEvent(new WheelEvent("wheel", { deltaY: direction === "up" ? -120 : 120 }))
    vp.dispatchEvent(new Event("scroll"))
  })
}

/** A scroll event with NO input before it — by construction, not the reader. */
function unattributedScroll(vp: HTMLElement) {
  act(() => {
    vp.dispatchEvent(new Event("scroll"))
  })
}

describe("Phase 243 Plan 03 — MessageList's scroll effect, seen through a real spy", () => {
  let scrollIntoViewSpy: ReturnType<typeof vi.fn>
  let clock = 0

  beforeEach(() => {
    rafQueue = []
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length as unknown as number
    })
    // ⭐ THE SPY. `MessageList.test.tsx` installs a no-op here; this file installs
    // something that can count and can read the argument.
    scrollIntoViewSpy = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: scrollIntoViewSpy,
      writable: true,
      configurable: true,
    })
    clock = 5_000_000
    vi.spyOn(Date, "now").mockImplementation(() => clock)
  })
  afterEach(() => {
    vi.mocked(Date.now).mockRestore()
    vi.unstubAllGlobals()
    rafQueue = []
  })

  function mountStreaming(messages: Message[]) {
    const utils = render(
      <TooltipProvider>
        <MessageList messages={messages} isStreaming={true} />
      </TooltipProvider>,
    )
    const vp = utils.container.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement
    atBottom(vp)
    act(() => flushRaf()) // BL-05 attaches the listeners on a rAF
    scrollIntoViewSpy.mockClear() // the mount's own new-message scroll is not under test
    const rerenderStreaming = (next: Message[]) =>
      act(() => {
        utils.rerender(
          <TooltipProvider>
            <MessageList messages={next} isStreaming={true} />
          </TooltipProvider>,
        )
      })
    return { ...utils, vp, rerenderStreaming }
  }

  it("§0 — the fixture really is a long thread and the harness really is mounted", () => {
    const messages = makeLongThread()
    expect(messages).toHaveLength(LONG_THREAD_SIZE)
    expect(LONG_THREAD_SIZE).toBeGreaterThanOrEqual(50)
    const { vp } = mountStreaming(messages)
    expect(vp).not.toBeNull()
    expect(screen.getByText(/message 0 —/)).toBeInTheDocument()
  })

  it("§1 — PINNED + streaming: every token-cadence render scrolls, with behavior 'instant' at the bottom anchor", () => {
    let messages = makeLongThread()
    const { rerenderStreaming } = mountStreaming(messages)

    for (let i = 0; i < 8; i++) {
      messages = withMoreTokens(messages, ` t${i}`)
      rerenderStreaming(messages)
      clock += 40
    }

    // ⛔ THE COUNT IS THE MEASUREMENT. One scroll per token render, which is the
    // per-token cadence CHAT-02 is about.
    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(8)
    for (const call of scrollIntoViewSpy.mock.calls) {
      expect(call[0]).toEqual({ behavior: "instant" })
    }
  })

  it("§2 — a `preparing` tool element takes the SMOOTH branch (MessageList.tsx:171) — the ARGUMENT, not the branch's existence", () => {
    let messages = withPreparingTool(makeLongThread())
    const { rerenderStreaming } = mountStreaming(messages)
    expect(document.querySelector('[data-tool-status="preparing"]')).not.toBeNull()

    messages = withMoreTokens(messages, " more")
    rerenderStreaming(messages)

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" })
  })

  it("§3 — ⭐ THE RESIDUAL (D-243-05): a small nudge UP, then a scroll the reader did not cause, 1000 ms later", () => {
    // The reader nudges up 60px — still inside the 120px near-bottom threshold. This is
    // the shape that can reach the re-arm branch at all: a big scroll-away lands in the
    // RELEASE branch on every later event and therefore cannot show this.
    let messages = withPreparingTool(makeLongThread())
    const { vp, rerenderStreaming } = mountStreaming(messages)

    // Two tokens while pinned, each refreshing the hard clock to now + 900.
    messages = withMoreTokens(messages, " a")
    rerenderStreaming(messages)
    clock += 40
    messages = withMoreTokens(messages, " b")
    rerenderStreaming(messages)
    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2)

    const t = clock
    nudgedUp(vp)
    userScroll(vp, "up")
    expect(screen.getByTestId("jump-to-live-chip")).toBeInTheDocument()
    scrollIntoViewSpy.mockClear()

    // Past the 900 ms hard clock, inside the 1500 ms gesture window: the ~600 ms window.
    expect(1000).toBeGreaterThan(PROGRAMMATIC_SCROLL_SETTLE_MS)
    expect(1000).toBeLessThan(USER_GESTURE_WINDOW_MS)
    clock = t + 1000
    unattributedScroll(vp)

    // The reader released the pin and did nothing since. They must still be released…
    expect(screen.queryByTestId("jump-to-live-chip")).toBeInTheDocument()

    // …and the tokens that follow must not move them.
    for (let i = 0; i < 4; i++) {
      messages = withMoreTokens(messages, ` post${i}`)
      rerenderStreaming(messages)
      clock += 40
    }
    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(0)
  })

  it("§4 — a decisive scroll-away: zero further scrollIntoView for the rest of the run", () => {
    let messages = withPreparingTool(makeLongThread())
    const { vp, rerenderStreaming } = mountStreaming(messages)

    scrolledWellUp(vp)
    userScroll(vp, "up")
    expect(screen.getByTestId("jump-to-live-chip")).toBeInTheDocument()
    scrollIntoViewSpy.mockClear()

    for (let i = 0; i < 12; i++) {
      messages = withMoreTokens(messages, ` tok${i}`)
      rerenderStreaming(messages)
      clock += 40
    }
    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(0)
  })

  it("§5 — ⭐ THE MIRROR: after scrolling away, a deliberate flick back DOWN re-arms and following resumes", () => {
    let messages = makeLongThread()
    const { vp, rerenderStreaming } = mountStreaming(messages)

    scrolledWellUp(vp)
    userScroll(vp, "up")
    expect(screen.getByTestId("jump-to-live-chip")).toBeInTheDocument()

    // Much later, past every window, they come back to the live edge by hand.
    clock += 5_000
    atBottom(vp)
    userScroll(vp, "down")
    expect(screen.queryByTestId("jump-to-live-chip")).toBeNull()

    scrollIntoViewSpy.mockClear()
    messages = withMoreTokens(messages, " resumed")
    rerenderStreaming(messages)
    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1)
  })

  it("§6 — SETTLED (not streaming) + a new message: the bottom anchor, behavior 'smooth'", () => {
    const messages = makeLongThread()
    const utils = render(
      <TooltipProvider>
        <MessageList messages={messages} isStreaming={false} />
      </TooltipProvider>,
    )
    const vp = utils.container.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement
    atBottom(vp)
    act(() => flushRaf())
    scrollIntoViewSpy.mockClear()

    const withReply = messages.concat({
      id: "m-new",
      thread_id: "thread-1",
      user_id: "user-1",
      role: "user",
      content: "one more question",
      created_at: NOW,
      updated_at: NOW,
    } as Message)
    act(() => {
      utils.rerender(
        <TooltipProvider>
          <MessageList messages={withReply} isStreaming={false} />
        </TooltipProvider>,
      )
    })

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: "smooth" })
  })
})
