import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { SuggestionPills } from "@/components/chat/SuggestionPills"

describe("SuggestionPills", () => {
  it("renders nothing when questions array is empty (SUG-01 empty state)", () => {
    const onSelect = vi.fn()
    const { container } = render(<SuggestionPills questions={[]} onSelect={onSelect} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders a button for each question (SUG-01 render up to 3 pills)", () => {
    const questions = ["What is precision?", "How does RRF work?", "Show an example"]
    render(<SuggestionPills questions={questions} onSelect={vi.fn()} />)
    expect(screen.getAllByRole("button")).toHaveLength(3)
    expect(screen.getByRole("button", { name: "What is precision?" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "How does RRF work?" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Show an example" })).toBeInTheDocument()
  })

  it("renders the 'Follow-up:' section label above the pill row (UI-SPEC copywriting)", () => {
    render(<SuggestionPills questions={["q1"]} onSelect={vi.fn()} />)
    expect(screen.getByText("Follow-up:")).toBeInTheDocument()
  })

  it("calls onSelect with the clicked question text (SUG-02 click-to-submit)", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const questions = ["What is precision?", "How does RRF work?"]
    render(<SuggestionPills questions={questions} onSelect={onSelect} />)
    await user.click(screen.getByRole("button", { name: "How does RRF work?" }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith("How does RRF work?")
  })

  it("renders fewer than 3 pills when fewer questions are provided (graceful clamp)", () => {
    render(<SuggestionPills questions={["only one"]} onSelect={vi.fn()} />)
    expect(screen.getAllByRole("button")).toHaveLength(1)
  })
})
