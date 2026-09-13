/**
 * Phase 243 Plan 04 (CHAT-01 / D-243-02) — the reasoning body's TAIL TREATMENT, fenced at
 * BOTH ends of the measured spread.
 *
 * The acceptance bar is a FILE: `.planning/sketches/234-the-thinking-block/index.html` §V1
 * (`:139-145` the clamp, the fade and the control; `:335-337` the self-removal rule). The
 * MECHANISM is the shipped sketch-050 one — `UserMessageBubble.tsx:26-64`, four moves:
 * measure in `useLayoutEffect`, clamp while collapsed, fade only while clamped, and ⭐ GATE
 * THE CONTROL ON MEASURED OVERFLOW so it removes itself rather than sitting inert.
 *
 * ⛔ WHY THE MECHANISM IS COPIED AND NOT MOUNTED, measured rather than asserted: `UserBubble`
 * is hard-bound to the violet user bubble in four places — a literal `[-webkit-line-clamp:7]`
 * (`:43`), a fade matched to the bubble's gradient (`:53`), a `text-white/80` control (`:60`)
 * and its own `Read more` / `Show less` copy (`:62`). There is no `useClamp` hook, no
 * `<Clamp>` component and no shared clamp module anywhere in `frontend/src`.
 * ⛔ The two OTHER clamps in the tree are the WRONG ones to copy: `skills/tuner/CandidateCard.tsx:104`
 * and `CitationCard.tsx:196-205` both mount their toggle UNCONDITIONALLY, so it sits inert on
 * short text — exactly what D-243-02 forbids on the median 198-char body. §3 is the case that
 * distinguishes the right clamp from those two.
 *
 * ── D-243-03's 170× SPREAD IS THE POINT ────────────────────────────────────────────────────
 * Measured on this machine's corpus: median 198 chars, max 33,713. A suite that exercises one
 * end has not exercised the design, so both ends are cases here.
 *
 * ── THE jsdom CAVEAT, SOLVED THE WAY THIS TREE ALREADY SOLVES IT ───────────────────────────
 * jsdom does not lay out, so `scrollHeight` is 0 and the real `useLayoutEffect` measure never
 * trips on its own. `src/__tests__/components/MessageItem.clamp.test.tsx:44-59` spies on the
 * `HTMLElement.prototype.scrollHeight` getter to force the PRODUCTION branch rather than
 * adding a test-only prop, and this suite does the same. Live behaviour on a real browser is
 * the phase's manual UAT.
 *
 * ⚠ THE MEASURE IS `scrollHeight > CLAMP_MAX_PX`, NOT `scrollHeight > clientHeight`, and the
 * difference is observable: comparing against `clientHeight` requires the cap to be APPLIED
 * before it can be measured, which would leave the cap class on a 198-char body forever. The
 * sketch's `chars < 700` is a PROXY for this measurement, not a second rule — §4 is the case
 * that proves the implementation measures rather than counts.
 */
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageItem } from "@/components/chat/MessageItem"
import type { Message } from "@/types"

const NOW = new Date().toISOString()

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-clamp-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: "Assistant response text",
    created_at: NOW,
    updated_at: NOW,
    model: "deepseek-reasoner",
    provider: "deepseek",
    tool_calls: [],
    ...overrides,
  } as Message
}

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

/** THE TAIL — the measured maximum end of the spread. */
const REASONING_LONG = Array.from(
  { length: 435 },
  (_, i) => `Step ${i + 1}: weighing the retrieved passage against the question asked, again.`,
).join("\n")

/** THE MEDIAN — one short paragraph, the common case (D-243-03: 198 chars). */
const REASONING_MEDIAN = [
  "The user is asking about the retention policy.",
  "I should search the knowledge base for the current document before answering,",
  "because the policy was revised and my memory is not a source I can cite.",
].join("\n")

/** UNDER the sketch's ~700-char proxy, used by §4 to prove the gate is the MEASUREMENT. */
const REASONING_SHORT_BUT_TALL =
  "A narrow column can overflow on very little text. " +
  "This body is deliberately under the sketch's ~700-character figure."

/**
 * Force the production overflow branch. jsdom reports 0 with no layout engine; this makes
 * every element report a scrollHeight past the 300px clamp, so the REAL `useLayoutEffect`
 * measure in `ThinkingBlock` flips `overflowing` true exactly as a real browser would.
 */
function forceOverflow() {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(1200)
}

/** Open the fold. The clamp lives INSIDE it — see §5. */
function openFold(reasoning: string) {
  renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: reasoning })} />)
  fireEvent.click(screen.getByTestId("thinking-trigger"))
}

const CLAMP_TOKEN = "max-h-[300px]"
const control = () => screen.queryByTestId("thinking-clamp-toggle")
const bodyTokens = () => screen.getByTestId("thinking-body").className.split(/\s+/)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Phase 243 Plan 04 — the reasoning clamp (sketch 234 V1 / D-243-02)", () => {
  // ── §1 — THE TAIL END OF THE SPREAD ──────────────────────────────────────────────────────
  it("§1 — a 33 KB body clamps, fades, and offers a control reading exactly `Show all of it`", () => {
    forceOverflow()
    openFold(REASONING_LONG)
    // The fixture really is the measured end of the range, not a token long string.
    expect(REASONING_LONG.length).toBeGreaterThan(30_000)
    expect(bodyTokens()).toContain(CLAMP_TOKEN)
    expect(bodyTokens()).toContain("overflow-hidden")
    expect(screen.getByTestId("thinking-fade")).toBeInTheDocument()
    // ⭐ CONTENT, not a testid: the copy is the deliverable. `Show all of it` DOES NOT EXIST
    //    anywhere in this tree — it is NEW COPY from the sketch (`index.html:145`), and the
    //    shipped clamp says `Read more`. What is reused is the MECHANISM, never the string.
    expect(control()?.textContent).toBe("Show all of it")
  })

  it("§2 — clicking it expands: the cap goes, the fade goes, and the control says `Show less`", () => {
    forceOverflow()
    openFold(REASONING_LONG)
    fireEvent.click(screen.getByTestId("thinking-clamp-toggle"))
    expect(bodyTokens()).not.toContain(CLAMP_TOKEN)
    expect(bodyTokens().filter((t) => /^max-h-/.test(t))).toEqual([])
    expect(screen.queryByTestId("thinking-fade")).toBeNull()
    // ⚠ THE COLLAPSED-FORM LABEL IS A CHOICE THE SKETCH DOES NOT MAKE, SO IT IS MADE HERE AND
    //   PINNED: `Show less`, verbatim the shipped clamp's word (`UserMessageBubble.tsx:62`).
    //   Inventing a third phrase for the same gesture would be a second vocabulary.
    expect(control()?.textContent).toBe("Show less")
    // …and the whole body is readable now — the fixture's tail is on the page.
    expect(screen.getByTestId("thinking-body").textContent).toContain("Step 435:")
  })

  // ── §3 — THE MEDIAN END. ⭐ THE CASE THAT SEPARATES THE RIGHT CLAMP FROM THE TWO WRONG ONES ─
  it("§3 — the median 198-char body gets NO control at all, no fade and no cap — it removes itself", () => {
    // NO overflow spy: jsdom's 0 is the honest answer for a body that does not overflow.
    openFold(REASONING_MEDIAN)
    // Positive control FIRST — the body really rendered, so these three absences are measured
    // against a rendered subtree rather than against nothing.
    expect(screen.getByTestId("thinking-body").textContent).toContain("retention policy")
    // ⛔ ABSENT, not hidden. `CandidateCard` and `CitationCard` both mount their toggle
    //    unconditionally; D-243-02 forbids a control that sits inert on the common case, and a
    //    `toBeNull()` is the only assertion that can tell "gone" from "styled invisible".
    expect(control()).toBeNull()
    expect(screen.queryByTestId("thinking-fade")).toBeNull()
    expect(bodyTokens()).not.toContain(CLAMP_TOKEN)
    expect(bodyTokens()).not.toContain("overflow-hidden")
  })

  // ── §4 — MEASURED, NOT COUNTED ───────────────────────────────────────────────────────────
  it("§4 — a body UNDER the sketch's ~700-char figure still clamps when it MEASURES as overflowing", () => {
    forceOverflow()
    openFold(REASONING_SHORT_BUT_TALL)
    // The fixture is on the short side of the sketch's proxy…
    expect(REASONING_SHORT_BUT_TALL.length).toBeLessThan(700)
    // …and it clamps anyway, because the gate is the MEASUREMENT. ⚠ If a later implementation
    // hard-codes a character threshold instead, this case reds — and it must then be rewritten
    // to SAY that, never quietly relaxed to describe something else.
    expect(control()?.textContent).toBe("Show all of it")
    expect(bodyTokens()).toContain(CLAMP_TOKEN)
  })

  // ── §5 — THE FADE IS NOT VIOLET ──────────────────────────────────────────────────────────
  it("§5 — the fade runs to the message-body background, never to the user bubble's violet", () => {
    forceOverflow()
    openFold(REASONING_LONG)
    const fade = screen.getByTestId("thinking-fade")
    // `hsl(258 90% 66%)` is the END of the user bubble's 135° gradient (`index.css:199`) and is
    // legible ONLY on violet. Copying `UserMessageBubble.tsx:53` verbatim would have put a
    // violet band across an assistant message — which is precisely why the bubble cannot be
    // MOUNTED here and only its four moves are reused.
    expect(fade.className).not.toContain("hsl(258")
    expect(fade.className).toContain("from-background")
    expect(fade.className).toContain("pointer-events-none")
  })

  // ── §6 — NEVER A SCROLLER, IN EITHER STATE ───────────────────────────────────────────────
  it("§6 — the clamped body is a CAP WITH A REVEAL, not a nested scroller (CHAT-01)", () => {
    forceOverflow()
    openFold(REASONING_LONG)
    // ⭐ THE DISTINCTION CHAT-01 IS ACTUALLY ABOUT. `max-h-64 overflow-y-auto` put a scrollbar
    //    inside a scrolling conversation; a cap paired with a control that reveals the rest is
    //    the opposite affordance. So the fence is on the SCROLLING spellings, in the state
    //    where a height cap legitimately exists.
    for (const token of bodyTokens()) {
      expect(token).not.toMatch(/^overflow-(y-)?(auto|scroll)$/)
      expect(token).not.toMatch(/^overflow-x-(auto|scroll)$/)
    }
    // …and the cap is never present without the control that undoes it.
    expect(bodyTokens()).toContain(CLAMP_TOKEN)
    expect(control()).toBeInTheDocument()
  })

  // ── §7 — THE CLAMP LIVES INSIDE THE FOLD, AND THE FOLD IS UNTOUCHED ──────────────────────
  it("§7 — the control expands the body WITHIN the fold: it never opens or closes the fold itself", () => {
    forceOverflow()
    renderWithTooltip(
      <MessageItem message={makeMessage({ reasoningContent: REASONING_LONG })} />,
    )
    // ⛔ D-243-02: the fold default is UNCHANGED — closed at rest. Before any click the body,
    //    the clamp and the control are all absent, because the fold is shut.
    expect(screen.queryByTestId("thinking-body")).toBeNull()
    expect(control()).toBeNull()

    fireEvent.click(screen.getByTestId("thinking-trigger"))
    expect(screen.getByTestId("thinking-trigger").getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(screen.getByTestId("thinking-clamp-toggle"))
    // The fold is still open and still says it is open — the clamp control is a SECOND,
    // nested affordance and the two do not share state.
    expect(screen.getByTestId("thinking-trigger").getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByTestId("thinking-body")).toBeInTheDocument()
  })
})
