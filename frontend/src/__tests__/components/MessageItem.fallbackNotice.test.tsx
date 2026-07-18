/**
 * Phase 149 Plan 09 Task 2 (D-149-10 frontend half) — the disabled-model fallback notice.
 *
 * Reproduces the UAT Test-7 root cause: the backend already emits a
 * `model_disabled_fallback` SSE event naming BOTH the disabled model and the org-default
 * fallback, but the frontend had ZERO handler — the event was dropped and the user
 * experienced a SILENT model swap (the exact outcome D-149-10 bans).
 *
 * This locks the render half of the fix: when an assistant message carries
 * `modelFallbackNotice` (stamped by StreamsProvider from the SSE event), MessageItem
 * renders an inline honest notice showing the backend `message` string — which names BOTH
 * models. A message WITHOUT the field renders nothing extra (the enabled path is
 * byte-identical).
 *
 * Harness mirrors MessageItem.finalOutputs.test.tsx so the two files stay independent.
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

const DISABLED = "claude-haiku-4-5-20251001"
const FALLBACK = "MiniMax-M2.5-highspeed"
const FALLBACK_MESSAGE = `${DISABLED} was disabled by your administrator — this reply used ${FALLBACK}.`

describe("MessageItem — disabled-model fallback notice (D-149-10)", () => {
  it("renders an inline honest notice naming BOTH models when modelFallbackNotice is set", () => {
    const m = makeMessage({
      content: "Here is your answer.",
      modelFallbackNotice: {
        disabledModel: DISABLED,
        fallbackModel: FALLBACK,
        message: FALLBACK_MESSAGE,
      },
    } as Partial<Message>)

    renderWithTooltip(<MessageItem message={m} isStreaming={false} />)

    const notice = screen.getByTestId("model-fallback-notice")
    expect(notice).toBeTruthy()
    // BOTH the disabled model AND the fallback model must appear (the reproduced UAT
    // failure was a SILENT swap — the user must see which model was disabled AND which
    // one actually replied).
    expect(notice.textContent).toContain(DISABLED)
    expect(notice.textContent).toContain(FALLBACK)
  })

  it("renders the notice even before any content has streamed (tied to the reply, not gated on content)", () => {
    const m = makeMessage({
      content: "",
      modelFallbackNotice: {
        disabledModel: DISABLED,
        fallbackModel: FALLBACK,
        message: FALLBACK_MESSAGE,
      },
    } as Partial<Message>)

    renderWithTooltip(<MessageItem message={m} isStreaming />)
    const notice = screen.getByTestId("model-fallback-notice")
    expect(notice.textContent).toContain(DISABLED)
    expect(notice.textContent).toContain(FALLBACK)
  })

  it("renders NOTHING extra when modelFallbackNotice is absent (enabled path byte-identical)", () => {
    const m = makeMessage({ content: "A normal reply." })
    renderWithTooltip(<MessageItem message={m} isStreaming={false} />)
    expect(screen.queryByTestId("model-fallback-notice")).toBeNull()
  })
})
