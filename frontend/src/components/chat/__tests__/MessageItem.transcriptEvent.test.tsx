/**
 * Phase 267 plan 04 (PACK-23 / PACK-24 · D-267-09 / D-267-15 / D-267-23) — MessageItem gains ONE
 * early return, and nothing else about the transcript changes.
 *
 *   • an allowlisted system row (expert_changed / expert_handoff) → the event card, no bubble;
 *   • ANY OTHER system row → nothing at all (T-267-41: `context_truncated`, `ask_user_*` and the
 *     like must never surface as an assistant bubble);
 *   • a user row carrying the handoff marker → the handoff card, never the user bubble;
 *   • a plain user row → the shipped bubble, unchanged.
 *
 * ⛔ G-5 BY ARITHMETIC. The `?raw` fence below counts, with comments stripped, exactly one
 * `<ExpertEventCard` and one `<HandoffCard` in MessageItem.tsx and the SAME hook counts as the
 * phase base (`useState` 3 · `useEffect` 0 · every `use*(` call 7, measured at de74d1470).
 *
 * ⛔ MessageList: a trailing event row must not steal "the last assistant message" — the two role
 * reads skip system rows, so the suggestions still attach to the real answer.
 */
import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import expertChangedRaw from "../../../../../backend/tests/fixtures/phase267/expert_changed.json?raw"
// @ts-ignore — Vite `?raw` import.
import expertHandoffRaw from "../../../../../backend/tests/fixtures/phase267/expert_handoff.json?raw"
// @ts-ignore — Vite `?raw` import.
import handoffMarkerRaw from "../../../../../backend/tests/fixtures/phase267/handoff_marker.json?raw"
import type { Message } from "@/types"
import { stripComments } from "@/lib/stripComments.testutil"

const { mockGetThreadWorkflow } = vi.hoisted(() => ({ mockGetThreadWorkflow: vi.fn() }))
vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return { ...actual, getThreadWorkflow: mockGetThreadWorkflow }
})

import { MessageItem } from "../MessageItem"
import { MessageList } from "../MessageList"

beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = function () {}
  mockGetThreadWorkflow.mockResolvedValue({ locked: false })
})

const NOW = "2026-09-25T14:32:00Z"

function msg(overrides: Partial<Message>): Message {
  return {
    id: "m-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "user",
    content: "Hello there",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

const eventRow = (payload: unknown, id = "ev-1"): Message =>
  msg({
    id,
    role: "system",
    content: "Financial Analyzer → HR Advisor. Now: HR Policies. Dropped: Financial Reports & Filings.",
    tool_calls: [JSON.parse(payload as string)] as unknown as Message["tool_calls"],
  })

function renderT(ui: ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe("MessageItem — the one early return", () => {
  it("(1) an expert_changed row renders the event card and no assistant bubble text", () => {
    renderT(<MessageItem message={eventRow(expertChangedRaw)} />)
    expect(screen.getByTestId("expert-event-card")).toBeInTheDocument()
    expect(screen.getByText("Financial Analyzer → HR Advisor")).toBeVisible()
    // the row's `content` sentence is for the database, never for the screen
    expect(screen.queryByText(/Now: HR Policies\./)).toBeNull()
    expect(screen.queryByTestId("user-message")).toBeNull()
  })

  it("(2) an expert_handoff row renders the same card with its Here line", () => {
    renderT(<MessageItem message={eventRow(expertHandoffRaw)} />)
    expect(screen.getByTestId("expert-event-card")).toBeInTheDocument()
    expect(screen.getByText("Financial Analyzer stays")).toBeVisible()
  })

  it("(3) a system row whose kind is NOT allowlisted renders nothing at all", () => {
    const { container } = renderT(
      <MessageItem
        message={msg({
          role: "system",
          content: "[context truncated — 12 earlier messages were summarised]",
          tool_calls: [{ kind: "context_truncated" }] as unknown as Message["tool_calls"],
        })}
      />,
    )
    expect(container.textContent).toBe("")
  })

  it("(4) a system row with no tool_calls renders nothing either", () => {
    const { container } = renderT(<MessageItem message={msg({ role: "system", content: "raw system text" })} />)
    expect(container.textContent).toBe("")
  })

  it("(5) a user row carrying the handoff marker renders the handoff card, not the bubble", () => {
    renderT(
      <MessageItem
        message={msg({
          content: "Handed off from “Q3 board prep”\n- ACME Q3 invoices",
          tool_calls: [JSON.parse(handoffMarkerRaw as string)] as unknown as Message["tool_calls"],
        })}
      />,
    )
    expect(screen.getByTestId("handoff-card")).toBeInTheDocument()
    expect(screen.queryByTestId("user-message")).toBeNull()
  })

  it("(6) a plain user row is the shipped bubble, unchanged", () => {
    renderT(<MessageItem message={msg({ content: "Plain question" })} />)
    const bubble = screen.getByTestId("user-message")
    expect(bubble.className).toBe("flex justify-end py-2 animate-fadeSlideUp")
    expect(bubble.textContent).toContain("Plain question")
    expect(screen.queryByTestId("handoff-card")).toBeNull()
    expect(screen.queryByTestId("expert-event-card")).toBeNull()
  })
})

describe("MessageItem.tsx source fence (G-5, comments stripped)", () => {
  it("(7) exactly one mount of each card, and hook counts equal the phase base", async () => {
    const src = stripComments((await import("../MessageItem.tsx?raw")).default as string)
    expect(src.length).toBeGreaterThan(1000)
    expect([...src.matchAll(/<ExpertEventCard\b/g)]).toHaveLength(1)
    expect([...src.matchAll(/<HandoffCard\b/g)]).toHaveLength(1)
    expect([...src.matchAll(/transcriptEventOf\(/g)].length).toBeGreaterThanOrEqual(1)
    // base (de74d1470): useState 3 · useEffect 0 · every hook call 7
    expect([...src.matchAll(/\buseState\s*[<(]/g)]).toHaveLength(3)
    expect([...src.matchAll(/\buseEffect\s*\(/g)]).toHaveLength(0)
    expect([...src.matchAll(/\buse[A-Z]\w*\s*[<(]/g)]).toHaveLength(7)
  })
})

describe("MessageList — a trailing event row is not 'the last message'", () => {
  it("(8) suggestions still attach to the assistant answer when an event row follows it", () => {
    const messages: Message[] = [
      msg({ id: "u-1", content: "What changed?" }),
      msg({
        id: "a-1",
        role: "assistant",
        content: "Here is the answer.",
        suggestions: ["Follow-up one?"],
        runStatus: "completed",
      }),
      eventRow(expertChangedRaw, "ev-2"),
    ]
    renderT(
      <MessageList
        messages={messages}
        isStreaming={false}
        onSendMessage={() => {}}
        showSuggestions
      />,
    )
    expect(screen.getByTestId("expert-event-card")).toBeInTheDocument()
    expect(screen.getByText("Follow-up one?")).toBeInTheDocument()
  })
})
