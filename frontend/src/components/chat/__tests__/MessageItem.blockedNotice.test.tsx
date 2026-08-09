/**
 * Phase 174 Plan 03 Task 1 (STATE-01b / D-04 / D-06) — the honest administrative-block
 * amber bubble.
 *
 * Reproduces BUG-260712-01: a workflow launch refused by the workflows kill-switch
 * (an `ApiError.status===403` raised BEFORE any run/message is inserted) used to leave a
 * workflow title with a BLANK body — a silent empty card that reads as "something broke".
 *
 * This locks the RENDER half of the fix: when an assistant message carries `blockedNotice`
 * (stamped by StreamsProvider's catch from the server's `ApiError.message`), MessageItem
 * renders an amber in-chat notice (sketch 129-C administrative-block tier) showing the
 * server string VERBATIM as React text children only (never dangerouslySetInnerHTML —
 * A23/T-174-03-01 XSS-safe). A message WITHOUT the field renders nothing extra (the
 * non-blocked path is byte-identical). The amber classes are the exact `model-fallback-notice`
 * primitive (D-06 — no bespoke amber CSS).
 *
 * Harness mirrors MessageItem.fallbackNotice.test.tsx so the two files stay independent.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageItem } from "@/components/chat/MessageItem"
import type { Message } from "@/types"

const NOW = new Date().toISOString()

function renderWithTooltip(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: "",
    created_at: NOW,
    updated_at: NOW,
    tool_calls: [],
    ...overrides,
  } as Message
}

const BLOCK_MESSAGE = "Workflows are currently disabled by the administrator"

describe("MessageItem — administrative-block amber notice (STATE-01b / D-04)", () => {
  it("renders the amber blocked-notice carrying the server message VERBATIM when blockedNotice is set", () => {
    const m = makeMessage({
      content: "",
      blockedNotice: { message: BLOCK_MESSAGE },
    } as Partial<Message>)

    renderWithTooltip(<MessageItem message={m} isStreaming={false} />)

    const notice = screen.getByTestId("blocked-notice")
    expect(notice).toBeTruthy()
    // The server refusal string renders verbatim (never client-hardcoded copy).
    expect(notice.textContent).toContain(BLOCK_MESSAGE)
  })

  it("reuses the model-fallback-notice amber primitive classes (D-06 — no bespoke CSS)", () => {
    const m = makeMessage({
      content: "",
      blockedNotice: { message: BLOCK_MESSAGE },
    } as Partial<Message>)

    renderWithTooltip(<MessageItem message={m} isStreaming={false} />)

    const notice = screen.getByTestId("blocked-notice")
    // A7: the exact amber tier classes — border-amber-400/30 bg-amber-400/10 text-amber-400/90.
    expect(notice.className).toContain("border-amber-400/30")
    expect(notice.className).toContain("bg-amber-400/10")
    expect(notice.className).toContain("text-amber-400/90")
  })

  it("renders the server string as plain text — never as raw HTML (A23 XSS-safe)", () => {
    // If the notice ever routed through dangerouslySetInnerHTML, the <b> would parse
    // into a real element; as React text children the angle brackets survive literally.
    const XSS_PROBE = "Blocked <b>by</b> the administrator"
    const m = makeMessage({
      content: "",
      blockedNotice: { message: XSS_PROBE },
    } as Partial<Message>)

    renderWithTooltip(<MessageItem message={m} isStreaming={false} />)

    const notice = screen.getByTestId("blocked-notice")
    // The literal markup survives as text — no injected <b> element.
    expect(notice.textContent).toContain(XSS_PROBE)
    expect(notice.querySelector("b")).toBeNull()
  })

  it("renders NOTHING extra when blockedNotice is absent (non-blocked path byte-identical)", () => {
    const m = makeMessage({ content: "A normal reply." })
    renderWithTooltip(<MessageItem message={m} isStreaming={false} />)
    expect(screen.queryByTestId("blocked-notice")).toBeNull()
  })
})
