/**
 * Phase 271 plan 02 (D-02 / UI-SPEC S5) — the Ask card: Ask is answered in chat.
 *
 * ⛔ The Library renders NO answer for a question — no list, no chunk, no passage. This card only
 * says where the answer lives and hands the question over. Its markup is asserted to carry no
 * list or table element at all, because the failure this prevents is a results list creeping in.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { AskHandoffCard } from "../AskHandoffCard"

describe("AskHandoffCard (D-02)", () => {
  it("states the title and body verbatim", () => {
    render(<AskHandoffCard question="" onAskInChat={vi.fn()} />)
    expect(screen.getByText("Ask is answered in chat")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Ask searches what your documents say and answers with cited passages. It does not list documents here.",
      ),
    ).toBeInTheDocument()
  })

  it("an empty question hides the question line and disables 'Open in chat'", () => {
    render(<AskHandoffCard question="   " onAskInChat={vi.fn()} />)
    expect(screen.queryByText(/your question:/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open in chat" })).toBeDisabled()
  })

  it("shows the question and hands it over exactly once on 'Open in chat'", () => {
    const onAskInChat = vi.fn()
    render(<AskHandoffCard question="What changed?" onAskInChat={onAskInChat} />)
    expect(screen.getByText("Your question: “What changed?”")).toBeInTheDocument()
    const button = screen.getByRole("button", { name: "Open in chat" })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(onAskInChat).toHaveBeenCalledTimes(1)
    expect(onAskInChat).toHaveBeenCalledWith("What changed?")
  })

  it("renders the handoff note", () => {
    render(<AskHandoffCard question="What changed?" onAskInChat={vi.fn()} />)
    expect(screen.getByText("Opens a new chat with your question ready to send.")).toBeInTheDocument()
  })

  it("WR-01: while a chat is being opened the button is disabled and cannot hand over twice", () => {
    const onAskInChat = vi.fn()
    render(<AskHandoffCard question="What changed?" onAskInChat={onAskInChat} pending />)
    const button = screen.getByRole("button", { name: "Open in chat" })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onAskInChat).not.toHaveBeenCalled()
  })

  it("WR-01: a failed create is said on the card in words, never only in the console", () => {
    render(<AskHandoffCard question="What changed?" onAskInChat={vi.fn()} failed />)
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't open a new chat. Try again.")
    expect(screen.getByRole("button", { name: "Open in chat" })).toBeEnabled()
  })

  it("⛔ contains no list or table markup — the Library lists nothing for a question", () => {
    const { container } = render(<AskHandoffCard question="What changed?" onAskInChat={vi.fn()} />)
    expect(container.querySelectorAll("ul, ol, li, table")).toHaveLength(0)
  })
})
