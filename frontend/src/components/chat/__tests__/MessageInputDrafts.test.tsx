import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MessageInput, _resetComposerDraftsForTest } from "../MessageInput"

// 099-08 follow-up: per-thread composer drafts (Slack-style).
// The composer saves unsent text per thread on switch and restores it on
// return; a new chat always starts empty; sending consumes the draft.

function renderComposer(threadId: string | null, onSend = vi.fn()) {
  return {
    onSend,
    ...render(<MessageInput onSend={onSend} disabled={false} threadId={threadId} />),
  }
}

const textarea = () => screen.getByRole("textbox") as HTMLTextAreaElement

describe("099-08 per-thread composer drafts", () => {
  beforeEach(() => {
    _resetComposerDraftsForTest()
  })

  it("clears the box when switching to a new chat, and restores the draft on return", () => {
    const { rerender, onSend } = renderComposer("thread-A")
    fireEvent.change(textarea(), { target: { value: "half-typed prompt for A" } })
    expect(textarea().value).toBe("half-typed prompt for A")

    // switch to a brand-new chat (no thread yet) → box must be EMPTY
    rerender(<MessageInput onSend={onSend} disabled={false} threadId={null} />)
    expect(textarea().value).toBe("")

    // switch back to thread A → draft restored
    rerender(<MessageInput onSend={onSend} disabled={false} threadId="thread-A" />)
    expect(textarea().value).toBe("half-typed prompt for A")
  })

  it("keeps drafts independent across two threads", () => {
    const { rerender, onSend } = renderComposer("thread-A")
    fireEvent.change(textarea(), { target: { value: "draft A" } })

    rerender(<MessageInput onSend={onSend} disabled={false} threadId="thread-B" />)
    expect(textarea().value).toBe("")
    fireEvent.change(textarea(), { target: { value: "draft B" } })

    rerender(<MessageInput onSend={onSend} disabled={false} threadId="thread-A" />)
    expect(textarea().value).toBe("draft A")

    rerender(<MessageInput onSend={onSend} disabled={false} threadId="thread-B" />)
    expect(textarea().value).toBe("draft B")
  })

  it("sending consumes the draft — it does not reappear after a round-trip", () => {
    const { rerender, onSend } = renderComposer("thread-A")
    fireEvent.change(textarea(), { target: { value: "send me" } })
    fireEvent.keyDown(textarea(), { key: "Enter" })
    // ⚠ THE SECOND ARGUMENT IS PHASE 216's, and it is `undefined` rather than absent:
    // `onSend(trimmed, activeConnectorIds.length > 0 ? activeConnectorIds : undefined)`.
    // `toHaveBeenCalledWith('x')` compares the whole argument LIST, so a call carrying a
    // trailing `undefined` does not match a one-argument expectation — which is why these
    // two cases have been red since that phase, over a change that has nothing to do with
    // drafts. Asserted with the second argument named, so a future third one fails loudly
    // rather than silently.
    expect(onSend).toHaveBeenCalledWith("send me", undefined)
    expect(textarea().value).toBe("")

    // away and back — no resurrected draft
    rerender(<MessageInput onSend={onSend} disabled={false} threadId={null} />)
    rerender(<MessageInput onSend={onSend} disabled={false} threadId="thread-A" />)
    expect(textarea().value).toBe("")
  })

  it("an unsent new-chat draft survives a detour to another thread", () => {
    const { rerender, onSend } = renderComposer(null)
    fireEvent.change(textarea(), { target: { value: "typed before any thread exists" } })

    rerender(<MessageInput onSend={onSend} disabled={false} threadId="thread-A" />)
    expect(textarea().value).toBe("")

    rerender(<MessageInput onSend={onSend} disabled={false} threadId={null} />)
    expect(textarea().value).toBe("typed before any thread exists")
  })

  it("restores a stashed send-drop draft via the prefill seam even after a send cleared the box", () => {
    // Phase 176-04 RENDER-03 (D-10.2): MessageInput clears the composer
    // synchronously on send (setValue("") + composerDraftsByThread.delete). When a
    // send takes the non-dispatch early-return, ChatArea feeds the stashed
    // failedSendDrafts value back through `prefillMessage`; the composer must
    // re-populate from prefillMessage even though it was JUST cleared, so the user
    // never loses the message. This is the load-bearing restore that closes the loop.
    const onSend = vi.fn()
    const onClearPrefill = vi.fn()
    const { rerender } = render(
      <MessageInput
        onSend={onSend}
        disabled={false}
        threadId="thread-A"
        prefillMessage={null}
        onClearPrefill={onClearPrefill}
      />,
    )

    // Type + send → the box is cleared synchronously by handleSend.
    fireEvent.change(textarea(), { target: { value: "dropped message" } })
    fireEvent.keyDown(textarea(), { key: "Enter" })
    expect(onSend).toHaveBeenCalledWith("dropped message", undefined)
    expect(textarea().value).toBe("")

    // The send-drop recovery restores the stashed draft through the prefill seam.
    rerender(
      <MessageInput
        onSend={onSend}
        disabled={false}
        threadId="thread-A"
        prefillMessage="dropped message"
        onClearPrefill={onClearPrefill}
      />,
    )
    expect(textarea().value).toBe("dropped message")
    // The prefill effect consumes the value once (onClearPrefill fires so it does
    // not re-fill on every subsequent render).
    expect(onClearPrefill).toHaveBeenCalled()
  })
})
