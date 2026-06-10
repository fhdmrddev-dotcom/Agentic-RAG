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
    expect(onSend).toHaveBeenCalledWith("send me")
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
})
