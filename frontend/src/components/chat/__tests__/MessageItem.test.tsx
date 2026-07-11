/**
 * Phase 147-06 (ADMIN-02 / D-03) — persistent cancelled-run honesty.
 *
 * Durable regression coverage for the two folded cancelled-display bugs. Both
 * are RENDER-ONLY derives from the already-persisted `message.runStatus`; the
 * operator-Kill victim must see EXACTLY a self-cancel (D-03), so the victim's
 * cancelled display has to be honest across reload and on an empty early cancel.
 *
 *  - BUG-260710-01: a cancelled message with content lost its "Response stopped"
 *    indicator after navigating away and back (`message.stopped` is live-only and
 *    not re-derived on reload). The indicator must now persist from
 *    `runStatus === 'cancelled'`.
 *  - BUG-260710-02: cancelling before the first visible token persists a
 *    genuinely empty assistant row; the renderer drew an avatar-only empty bubble
 *    that reads as "broken". It must render a "cancelled — no output yet"
 *    affordance instead.
 *  - Regression: a normal completed message shows NEITHER affordance (the render
 *    is byte-identical to before when nothing is cancelled — G-5 / D-03 safe).
 *
 * MessageItem is rendered IN ISOLATION. Its only StreamsProvider dependency
 * (`useWorkflowLockForThread`) is mocked to null (no lock); `@/lib/supabase` is
 * stubbed because `@/lib/api` (imported for `continueRun`) creates the client at
 * module load. The content case renders MessageFeedback, whose Radix Tooltip
 * needs a TooltipProvider ancestor — so renders are wrapped in one.
 */
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

// ── Stub supabase (api.ts creates the client at module load) ──────────────────
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}))

// ── Mock the sole StreamsProvider dependency: no workflow lock on this thread ──
vi.mock("@/providers/StreamsProvider", () => ({
  useWorkflowLockForThread: () => null,
}))

import { MessageItem } from "../MessageItem"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Message } from "@/types"

afterEach(() => cleanup())

/** A reloaded (non-streaming) assistant message — the historical-message shape
 *  that flows from persisted `messages` rows, the exact reload path both bugs hit. */
function assistantMessage(overrides: Partial<Message>): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: "",
    created_at: "2026-07-11T00:00:00Z",
    updated_at: "2026-07-11T00:00:00Z",
    ...overrides,
  }
}

function renderMessage(message: Message) {
  return render(
    <TooltipProvider>
      <MessageItem message={message} isStreaming={false} />
    </TooltipProvider>,
  )
}

describe("MessageItem — persistent cancelled honesty (BUG-260710-01/-02)", () => {
  it("BUG-260710-02 — a cancelled message with EMPTY content renders the 'cancelled — no output yet' affordance, not an empty bubble", () => {
    renderMessage(assistantMessage({ runStatus: "cancelled", content: "" }))

    expect(screen.getByTestId("cancelled-no-output")).toBeInTheDocument()
    expect(screen.getByText("cancelled — no output yet")).toBeInTheDocument()
    // No double indicator: the empty-cancel affordance stands alone.
    expect(screen.queryByText("Response stopped")).not.toBeInTheDocument()
  })

  it("BUG-260710-01 — a cancelled message WITH content renders its content + the persistent 'Response stopped' indicator (survives reload)", () => {
    renderMessage(assistantMessage({ runStatus: "cancelled", content: "partial answer" }))

    // The persisted partial answer renders.
    expect(screen.getByText("partial answer")).toBeInTheDocument()
    // The stopped indicator is derived from runStatus (not live-only state).
    expect(screen.getByText("Response stopped")).toBeInTheDocument()
    // The empty-cancel affordance does NOT appear when there is content.
    expect(screen.queryByTestId("cancelled-no-output")).not.toBeInTheDocument()
  })

  it("regression — a normal completed message shows NEITHER the stopped indicator NOR the empty-cancel affordance (render byte-identical to before)", () => {
    renderMessage(assistantMessage({ runStatus: "completed", content: "all done" }))

    expect(screen.getByText("all done")).toBeInTheDocument()
    expect(screen.queryByText("Response stopped")).not.toBeInTheDocument()
    expect(screen.queryByTestId("cancelled-no-output")).not.toBeInTheDocument()
  })
})
