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
import type { Message, Citation } from "@/types"

afterEach(() => cleanup())

/** A minimal chunk citation for the Phase 153-05 cited-render non-regression tests. */
function makeCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    document_id: "doc-1",
    filename: "alpha.pdf",
    chunk_index: 3,
    passage: "A grounded passage.",
    similarity: 0.63,
    is_full_doc: false,
    ...overrides,
  }
}

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

describe("MessageItem — Phase 153-05 cited render routing (G-5 additive, D-12/D-14)", () => {
  it("non-cited assistant message renders via MarkdownRenderer — NO markers, NO absence ⓘ (byte-identical)", () => {
    const { container } = renderMessage(
      assistantMessage({ runStatus: "completed", content: "Just general knowledge, no sources." }),
    )
    // The shared MarkdownRenderer path renders the prose.
    expect(screen.getByText("Just general knowledge, no sources.")).toBeInTheDocument()
    // No cited markdown was mounted → no inline markers.
    expect(container.querySelector("sup.citation-marker")).toBeNull()
    // The absence-as-signal ⓘ (mounted only on the cited branch) is absent here.
    expect(screen.queryByText("Unmarked claims read as general knowledge")).not.toBeInTheDocument()
    // No References footer without a citation set.
    expect(screen.queryByText(/References ·/)).not.toBeInTheDocument()
  })

  it("a user message stays byte-identical on the shared path — NO markers even when the text contains [1]", () => {
    const { container } = renderMessage(
      assistantMessage({ role: "user", content: "does [1] mean anything here?" }),
    )
    expect(screen.getByTestId("user-message")).toBeInTheDocument()
    expect(container.querySelector("sup.citation-marker")).toBeNull()
  })

  it("a settled cited assistant message routes to CitedMarkdown — [1] upgrades to an interactive marker", () => {
    const { container } = renderMessage(
      assistantMessage({
        runStatus: "completed",
        content: "Grounded fact [1].",
        citations: [makeCitation()],
      }),
    )
    const marker = container.querySelector<HTMLElement>("sup.citation-marker")
    expect(marker).not.toBeNull()
    expect(marker).toHaveAttribute("data-citation-marker", "1")
    // The numbered References footer renders when a citation set exists (D-06).
    expect(screen.getByText(/References ·/)).toBeInTheDocument()
  })

  it("a cited assistant message with NO markers degrades to footer-only — no markers, footer present (D-06/D-07)", () => {
    const { container } = renderMessage(
      assistantMessage({
        runStatus: "completed",
        content: "A plain grounded answer with no inline markers.",
        citations: [makeCitation()],
      }),
    )
    // CitedMarkdown's base render is byte-identical to MarkdownRenderer — no markers.
    expect(container.querySelector("sup.citation-marker")).toBeNull()
    // The footer still renders (retrieval ran) — no provider worse than today.
    expect(screen.getByText(/References ·/)).toBeInTheDocument()
  })
})
