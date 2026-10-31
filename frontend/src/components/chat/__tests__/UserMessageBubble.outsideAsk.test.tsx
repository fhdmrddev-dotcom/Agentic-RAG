// @vitest-environment jsdom
/**
 * Phase 306-04 (D-32 / D-28; 306-UI-SPEC §Surface 6, §How we'd know the UI failed 3) — an ask's
 * question bubble shows the QUESTION, never the scaffolding around it.
 *
 * * The stored message stays the TRUST-03 envelope (the model needs it on every later turn); only
 *   the display unwraps it. The bubble renders the question text and one note: a Bot mark and
 *   "Asked from an AI tool. In this chat the agent only searches and reads your documents."
 * * The 7-line clamp measures the QUESTION: a short question shows no "Read more"; a long one
 *   clamps, and the note sits after "Read more".
 * * ⛔ Any other message renders BYTE-IDENTICALLY — pinned by the plain bubble's HTML captured on
 *   the plan base (`PLAIN_BUBBLE_AT_BASE`, green against 4aef4374b in the RED commit).
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import fixtureRaw from "../../../../../backend/tests/fixtures/phase306/ask_envelope.json?raw"
import bubbleRaw from "../UserMessageBubble.tsx?raw"
import { UserBubble } from "../UserMessageBubble"

const fixture = JSON.parse(fixtureRaw) as { question: string; envelope: string }
const NOTE = "Asked from an AI tool. In this chat the agent only searches and reads your documents."

const PLAIN_BUBBLE_AT_BASE =
  '<div class="relative" data-testid="user-bubble"><p class="whitespace-pre-wrap break-words [display:-webkit-box] [-webkit-line-clamp:7] [-webkit-box-orient:vertical] overflow-hidden">What does our remote-work policy say about Fridays?</p></div>'

/** jsdom lays nothing out: force the overflow branch for text longer than `limit` characters. */
function fakeLayout(limit: number) {
  const proto = HTMLElement.prototype
  const sh = Object.getOwnPropertyDescriptor(proto, "scrollHeight")
  const ch = Object.getOwnPropertyDescriptor(proto, "clientHeight")
  Object.defineProperty(proto, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return (this.textContent ?? "").length > limit ? 400 : 100
    },
  })
  Object.defineProperty(proto, "clientHeight", { configurable: true, get: () => 100 })
  return () => {
    if (sh) Object.defineProperty(proto, "scrollHeight", sh)
    else delete (proto as unknown as Record<string, unknown>).scrollHeight
    if (ch) Object.defineProperty(proto, "clientHeight", ch)
    else delete (proto as unknown as Record<string, unknown>).clientHeight
  }
}

let restore: (() => void) | null = null
afterEach(() => {
  cleanup()
  restore?.()
  restore = null
})

describe("UserBubble — an ask from an AI tool (306-04)", () => {
  it("shows the question and the note, never the envelope", () => {
    render(<UserBubble content={fixture.envelope} />)
    const bubble = screen.getByTestId("user-bubble")
    expect(bubble.textContent).not.toContain("<external_input")
    expect(bubble.textContent).not.toContain("[SYSTEM NOTICE")
    expect(bubble.querySelector("p")!.textContent).toBe(
      fixture.question.replace(/<\/\s*external_input/gi, "&lt;/external_input"),
    )
    const notes = screen.getAllByText(NOTE)
    expect(notes).toHaveLength(1)
    const note = notes[0]
    expect(note.className).toBe("mt-2 pt-2 border-t border-white/25 flex items-start gap-1 text-xs text-white")
    const icon = note.querySelector("svg")!
    expect(icon.getAttribute("aria-hidden")).toBe("true")
    expect(icon.getAttribute("class")).toContain("lucide-bot")
  })

  it("a short question shows no Read more, even though the envelope is long", () => {
    restore = fakeLayout(fixture.envelope.length - 1)
    render(<UserBubble content={fixture.envelope} />)
    expect(screen.queryByText("Read more")).toBeNull()
    expect(screen.getByText(NOTE)).toBeInTheDocument()
  })

  it("a long question clamps, and the note sits after Read more", () => {
    restore = fakeLayout(50)
    const long = "Why ".repeat(60)
    const envelope = fixture.envelope.replace(
      /^(<external_input source="mcp" field="question">\n)[\s\S]*?(\n<\/external_input>\n)/,
      `$1${long}$2`,
    )
    render(<UserBubble content={envelope} />)
    const more = screen.getByText("Read more")
    const note = screen.getByText(NOTE)
    expect(more.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("a plain message renders exactly as on the base, with no note", () => {
    render(<UserBubble content={fixture.question.split("\n")[0]} />)
    expect(screen.getByTestId("user-bubble").outerHTML).toBe(PLAIN_BUBBLE_AT_BASE)
    expect(screen.queryByText(NOTE)).toBeNull()
  })

  it("the clamp, fade and toggle code are unchanged; the effect measures what is shown", () => {
    expect(bubbleRaw).toContain("outsideAskQuestion(")
    expect(bubbleRaw).toContain("[-webkit-line-clamp:7]")
    expect(bubbleRaw).toContain('{expanded ? "Show less" : "Read more"}')
  })
})
