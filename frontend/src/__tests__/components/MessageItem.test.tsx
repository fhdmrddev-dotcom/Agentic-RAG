/**
 * Tests for MessageItem component.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
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

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe("MessageItem – user messages", () => {
  it("renders the message content", () => {
    renderWithTooltip(<MessageItem message={makeMessage({ content: "Hello world" })} />)
    expect(screen.getByText("Hello world")).toBeInTheDocument()
  })

  it("aligns user message to the right (justify-end)", () => {
    const { container } = renderWithTooltip(
      <MessageItem message={makeMessage({ role: "user" })} />,
    )
    const wrapper = container.querySelector("div")
    expect(wrapper?.className).toContain("justify-end")
  })

  it("does not show the bot icon for user messages", () => {
    const { container } = renderWithTooltip(
      <MessageItem message={makeMessage({ role: "user" })} />,
    )
    // Bot icon has a parent with gradient-primary; user icon has bg-muted
    // We check the icon wrapper count: user messages only have 1 avatar div (right)
    const avatarDivs = container.querySelectorAll(".rounded-full")
    expect(avatarDivs).toHaveLength(1)
  })

  it("applies primary background for user messages", () => {
    const { container } = renderWithTooltip(
      <MessageItem message={makeMessage({ role: "user", content: "Hi" })} />,
    )
    // Find the bubble div — redesign uses gradient-primary
    const bubble = container.querySelector(".gradient-primary")
    expect(bubble).toBeInTheDocument()
  })
})

describe("MessageItem – assistant messages", () => {
  it("renders the message content", () => {
    renderWithTooltip(
      <MessageItem message={makeMessage({ role: "assistant", content: "I can help!" })} />,
    )
    expect(screen.getByText("I can help!")).toBeInTheDocument()
  })

  it("aligns assistant message to the left (flex row with gap-3)", () => {
    const { container } = renderWithTooltip(
      <MessageItem message={makeMessage({ role: "assistant" })} />,
    )
    const wrapper = container.querySelector("div")
    expect(wrapper?.className).toContain("gap-3")
  })

  it("shows the bot icon for assistant messages", () => {
    const { container } = renderWithTooltip(
      <MessageItem message={makeMessage({ role: "assistant" })} />,
    )
    // Bot icon parent has gradient-primary class after redesign
    const botIconWrapper = container.querySelector(".gradient-primary")
    expect(botIconWrapper).toBeInTheDocument()
  })

  it("applies text foreground for assistant messages", () => {
    const { container } = renderWithTooltip(
      <MessageItem message={makeMessage({ role: "assistant", content: "Sure" })} />,
    )
    // Assistant content uses text-foreground after redesign (no bg-muted bubble)
    const content = container.querySelector(".text-foreground")
    expect(content).toBeInTheDocument()
  })
})

describe("MessageItem – streaming state", () => {
  it("shows thinking indicator when streaming with empty content", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "" })}
        isStreaming={true}
      />,
    )
    expect(screen.getByText(/thinking/i)).toBeInTheDocument()
  })

  it("shows cursor when streaming with non-empty content", () => {
    const { container } = renderWithTooltip(
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
    const { container } = renderWithTooltip(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "Done" })}
        isStreaming={false}
      />,
    )
    const cursor = container.querySelector(".animate-pulse")
    expect(cursor).not.toBeInTheDocument()
  })
})
