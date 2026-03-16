/**
 * Tests for MessageItem component.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MessageItem } from "@/components/chat/MessageItem"
import type { Message } from "@/types"

const NOW = new Date().toISOString()

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "user",
    content: "Hello world",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

describe("MessageItem – user messages", () => {
  it("renders the message content", () => {
    render(<MessageItem message={makeMessage({ content: "Hello world" })} />)
    expect(screen.getByText("Hello world")).toBeInTheDocument()
  })

  it("aligns user message to the right (justify-end)", () => {
    const { container } = render(
      <MessageItem message={makeMessage({ role: "user" })} />,
    )
    const wrapper = container.querySelector("div")
    expect(wrapper?.className).toContain("justify-end")
  })

  it("does not show the bot icon for user messages", () => {
    const { container } = render(
      <MessageItem message={makeMessage({ role: "user" })} />,
    )
    // Bot icon has a parent with bg-primary; user icon has bg-muted
    // We check the icon wrapper count: user messages only have 1 avatar div (right)
    const avatarDivs = container.querySelectorAll(".rounded-full")
    expect(avatarDivs).toHaveLength(1)
  })

  it("applies primary background for user messages", () => {
    const { container } = render(
      <MessageItem message={makeMessage({ role: "user", content: "Hi" })} />,
    )
    // Find the bubble div
    const bubble = container.querySelector(".bg-primary.text-primary-foreground")
    expect(bubble).toBeInTheDocument()
  })
})

describe("MessageItem – assistant messages", () => {
  it("renders the message content", () => {
    render(
      <MessageItem message={makeMessage({ role: "assistant", content: "I can help!" })} />,
    )
    expect(screen.getByText("I can help!")).toBeInTheDocument()
  })

  it("aligns assistant message to the left (justify-start)", () => {
    const { container } = render(
      <MessageItem message={makeMessage({ role: "assistant" })} />,
    )
    const wrapper = container.querySelector("div")
    expect(wrapper?.className).toContain("justify-start")
  })

  it("shows the bot icon for assistant messages", () => {
    const { container } = render(
      <MessageItem message={makeMessage({ role: "assistant" })} />,
    )
    // Bot icon parent has bg-primary class
    const botIconWrapper = container.querySelector(".bg-primary")
    expect(botIconWrapper).toBeInTheDocument()
  })

  it("applies muted background for assistant messages", () => {
    const { container } = render(
      <MessageItem message={makeMessage({ role: "assistant", content: "Sure" })} />,
    )
    const bubble = container.querySelector(".bg-muted")
    expect(bubble).toBeInTheDocument()
  })
})

describe("MessageItem – streaming state", () => {
  it("shows thinking indicator when streaming with empty content", () => {
    render(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "" })}
        isStreaming={true}
      />,
    )
    expect(screen.getByText(/thinking/i)).toBeInTheDocument()
  })

  it("shows cursor when streaming with non-empty content", () => {
    const { container } = render(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Partial" })}
        isStreaming={true}
      />,
    )
    // The cursor is a span with animate-pulse
    const cursor = container.querySelector(".animate-pulse")
    expect(cursor).toBeInTheDocument()
  })

  it("does not show streaming indicators when not streaming", () => {
    const { container } = render(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Done" })}
        isStreaming={false}
      />,
    )
    const cursor = container.querySelector(".animate-pulse")
    expect(cursor).not.toBeInTheDocument()
  })
})
