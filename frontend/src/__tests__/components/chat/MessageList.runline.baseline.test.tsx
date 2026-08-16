/**
 * Phase 194.1 Plan 01 (Wave 1) — THE TRANSCRIPT'S SILENCE AFTER A STOP.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MEASURES
 * ─────────────────────────────────────────────────────────────────────────────
 * `BUG-260816-02` as a MEASUREMENT rather than a report: a stopped workflow
 * thread shows no trace of the stop. Render a transcript and the thread simply
 * ends at the prompt — no `Stopped by you`, no `⊘`, no run line of any kind.
 *
 * D-15 mounts a new list-level component here in two states (live / stopped).
 * Every absence below is a BEFORE for that mount, captured while it is still
 * true.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ THE HARNESS SHAPE IS THE POINT, NOT A CONVENIENCE
 * ─────────────────────────────────────────────────────────────────────────────
 * `renderML()` is `MessageList.test.tsx:20-23`'s shape: a bare `TooltipProvider`
 * and **NO `StreamsProvider`**. So "the streaming store is empty" here is
 * STRUCTURAL — there is no store to arrange — rather than arranged.
 *
 * That is exactly the property R4's central fence depends on (174 D1: *derived
 * from persisted state, never from live streaming state*). A later plan that
 * quietly wraps this harness in a `StreamsProvider` to make its new line render
 * would destroy the only evidence that the line is persisted-derived — and the
 * suite would still be green. **Pinning the harness shape here is what stops
 * that**, and the last case in this file asserts it directly rather than
 * trusting the import list.
 */
import { describe, it, expect, beforeAll, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { ReactNode } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageList } from "@/components/chat/MessageList"
import type { Message } from "@/types"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import messageListSource from "@/components/chat/MessageList.tsx?raw"

/** `MessageList.test.tsx:20-23`, reproduced deliberately rather than imported:
 *  a bare TooltipProvider and NO StreamsProvider. */
function renderML(ui: ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = function () {}
  }
})

const NOW = "2026-08-16T10:00:00.000Z"

function userMessage(): Message {
  return {
    id: "msg-user-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "user",
    content: "Run the quarterly close workflow",
    created_at: NOW,
    updated_at: NOW,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 — the thread ends at the prompt (BUG-260816-02, measured)", () => {
  it("a one-user-message transcript renders NO stop trace of any kind", () => {
    const { container } = renderML(
      <MessageList messages={[userMessage()]} isStreaming={false} />,
    )
    const text = container.textContent ?? ""

    // The prompt itself IS there — so the absences below are absences in a
    // rendered transcript, not the absence of a render. Without this the three
    // assertions that follow would pass over an empty container.
    expect(text).toContain("Run the quarterly close workflow")

    expect(text).not.toContain("Stopped by you")
    expect(text).not.toContain("⊘")
    expect(screen.queryByTestId("thread-run-line")).toBeNull()
  })

  it("the same three absences hold with an assistant reply present", () => {
    const assistantReply: Message = {
      id: "msg-asst-1",
      thread_id: "thread-1",
      user_id: "",
      role: "assistant",
      content: "Starting the close.",
      created_at: NOW,
      updated_at: NOW,
      tool_calls: [],
      runStatus: "cancelled",
    } as Message

    const { container } = renderML(
      <MessageList messages={[userMessage(), assistantReply]} isStreaming={false} />,
    )
    const text = container.textContent ?? ""

    // ⚠ `runStatus: "cancelled"` is set on the assistant row and the transcript
    // STILL carries no run line. That is the sharp version of BUG-260816-02:
    // the persisted state to draw a stopped reading from is already present, and
    // nothing reads it at list level. D-15's component is what will.
    expect(text).not.toContain("Stopped by you")
    expect(screen.queryByTestId("thread-run-line")).toBeNull()
  })

  it("`⊘` is absent from an EMPTY transcript too (no stray chrome)", () => {
    const { container } = renderML(<MessageList messages={[]} isStreaming={false} />)
    expect(container.textContent ?? "").not.toContain("⊘")
    expect(screen.queryByTestId("thread-run-line")).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 — MessageList's Props carry NO threadId today (plan 07's before)", () => {
  /**
   * ⚠ THE LENGTH GUARD IS LOAD-BEARING. A `?raw` import resolving to an empty
   * string makes every `not.toMatch` below pass while measuring nothing — the
   * 192.1 failure, where a renamed module was swept against the empty string and
   * reported green.
   */
  it("the swept source is non-empty and is the right file", () => {
    const src = messageListSource as string
    expect(typeof src).toBe("string")
    expect(src.length).toBeGreaterThan(4000)
    expect(src).toContain("export function MessageList")
    // `wc -l` reads 234; `split("\n")` counts SEGMENTS and the file ends with a
    // trailing newline, so it is one more. Both are right about different
    // questions; `194.1-BASELINE.md` §3 publishes the `wc -l` figure.
    expect(src.split("\n").length).toBe(235)
  })

  it("the declared Props interface has no `threadId` member", () => {
    const src = messageListSource as string
    const match = src.match(/interface Props \{([\s\S]*?)\n\}/)
    expect(match).not.toBeNull()

    const body = match![1]
    expect(body.length).toBeGreaterThan(50)
    // The six shipped members, so this fence is anchored to a body it actually
    // parsed rather than to any block that happened to match.
    expect(body).toContain("messages: Message[]")
    expect(body).toContain("isStreaming: boolean")
    expect(body).toContain("onResume?")

    expect(body).not.toMatch(/\bthreadId\b/)
  })

  it("the same regex DOES find a planted threadId (positive control)", () => {
    const planted = (messageListSource as string).replace(
      "  messages: Message[]",
      "  messages: Message[]\n  threadId?: string | null",
    )
    const body = planted.match(/interface Props \{([\s\S]*?)\n\}/)![1]
    expect(body).toMatch(/\bthreadId\b/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 — the harness itself is pinned (R4's fence depends on it)", () => {
  /**
   * 174 D1: R4's reading is *derived from persisted state, never from live
   * streaming state*. The evidence for that is that this file renders
   * `MessageList` with NO `StreamsProvider` in the tree at all. A later plan
   * that adds one to make its new line render would silently retire the proof.
   *
   * Asserted on the module's OWN source rather than on a belief about the import
   * list above — a plan can add an import without anybody re-reading this
   * docblock.
   */
  it("this suite's source names no StreamsProvider", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — Vite `?raw` self-import.
    const selfSource = (await import("./MessageList.runline.baseline.test.tsx?raw")).default as string

    expect(selfSource.length).toBeGreaterThan(1000)

    // Occurrences in PROSE are expected (this very comment is one). What must be
    // zero is an IMPORT of it — the thing that would put it in the tree.
    const importHits =
      selfSource.match(/^\s*import[\s\S]{0,200}?["']@\/providers\/StreamsProvider["']/gm) ?? []
    expect(importHits).toHaveLength(0)

    // …and the positive control, so a green here is never a broken regex.
    const planted = `import { StreamsProvider } from "@/providers/StreamsProvider"\n${selfSource}`
    expect(
      (planted.match(/^\s*import[\s\S]{0,200}?["']@\/providers\/StreamsProvider["']/gm) ?? [])
        .length,
    ).toBe(1)
  })

  it("MessageList renders at all without a StreamsProvider — the structural claim", () => {
    // If MessageList ever begins reading the streaming store directly, this
    // throws rather than silently returning an empty tree, and THAT is the
    // regression R4's fence would otherwise absorb.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { container } = renderML(
      <MessageList messages={[userMessage()]} isStreaming={false} />,
    )
    expect(container.textContent).toContain("Run the quarterly close workflow")
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
    cleanup()
  })
})
