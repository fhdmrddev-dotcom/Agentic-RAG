/**
 * Phase 112 Plan 04 Task 1 — InlineEdit Wave-0 suite (AC10).
 *
 * Co-located with the component it exercises. Asserts the FolderNode-pattern
 * contract with @testing-library/user-event:
 *   - click-to-edit swaps the value to a control,
 *   - Enter saves (calls onCommit with the new value),
 *   - Esc cancels (value unchanged + focus restored to the trigger),
 *   - editing an empty/absent field adds a value (the "Not extracted — add" path).
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { InlineEdit } from "./InlineEdit"

describe("InlineEdit (AC10) — honest inline metadata edit", () => {
  it("click-to-edit swaps the value to an editable control", async () => {
    const user = userEvent.setup()
    render(
      <InlineEdit field="title" fieldType="title" value="Old Title" onCommit={vi.fn()} />,
    )
    // Display mode: a button with the value.
    const trigger = screen.getByRole("button", { name: /edit title/i })
    expect(trigger).toHaveTextContent("Old Title")

    await user.click(trigger)
    // Editing mode: an input control labelled for the field.
    const input = screen.getByRole("textbox", { name: /edit title/i })
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue("Old Title")
  })

  it("Enter saves the changed value (calls onCommit with the new value)", async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(
      <InlineEdit field="title" fieldType="title" value="Old Title" onCommit={onCommit} />,
    )
    await user.click(screen.getByRole("button", { name: /edit title/i }))
    const input = screen.getByRole("textbox", { name: /edit title/i })
    await user.clear(input)
    await user.type(input, "New Title")
    await user.keyboard("{Enter}")

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith("title", "New Title")
  })

  it("does NOT call onCommit when the value is unchanged (Enter on a clean edit)", async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(
      <InlineEdit field="title" fieldType="title" value="Same" onCommit={onCommit} />,
    )
    await user.click(screen.getByRole("button", { name: /edit title/i }))
    await user.keyboard("{Enter}")
    expect(onCommit).not.toHaveBeenCalled()
  })

  it("Esc cancels: no commit, value unchanged, focus restored to the trigger", async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(
      <InlineEdit field="author" fieldType="author" value="Jane Doe" onCommit={onCommit} />,
    )
    const trigger = screen.getByRole("button", { name: /edit author/i })
    await user.click(trigger)
    const input = screen.getByRole("textbox", { name: /edit author/i })
    await user.clear(input)
    await user.type(input, "Someone Else")
    await user.keyboard("{Escape}")

    // No commit fired.
    expect(onCommit).not.toHaveBeenCalled()
    // Back to display mode, original value intact.
    const restored = await screen.findByRole("button", { name: /edit author/i })
    expect(restored).toHaveTextContent("Jane Doe")
    // Focus restored to the trigger (FolderNode behaviour).
    expect(restored).toHaveFocus()
  })

  it("WR-04: blur WITHOUT Enter does NOT commit — clicking away abandons the draft", async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(
      <>
        <InlineEdit
          field="summary"
          fieldType="summary"
          value="Extracted summary"
          onCommit={onCommit}
        />
        {/* A sibling focus target outside the control — like another row / the close button. */}
        <button type="button">elsewhere</button>
      </>,
    )
    await user.click(screen.getByRole("button", { name: /edit summary/i }))
    const textarea = screen.getByRole("textbox", { name: /edit summary/i })
    await user.clear(textarea)
    await user.type(textarea, "half-typed replacement")
    // Move focus away WITHOUT pressing Enter — an accidental click elsewhere.
    await user.click(screen.getByRole("button", { name: /elsewhere/i }))

    // The extracted value must NOT be overwritten — no commit, no audit row.
    expect(onCommit).not.toHaveBeenCalled()
    // Dropped back to display mode with the original value intact.
    const restored = await screen.findByRole("button", { name: /edit summary/i })
    expect(restored).toHaveTextContent("Extracted summary")
  })

  it("WR-04: Cmd/Ctrl+Enter on the summary Textarea commits exactly once", async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(
      <InlineEdit
        field="summary"
        fieldType="summary"
        value="Old"
        onCommit={onCommit}
      />,
    )
    await user.click(screen.getByRole("button", { name: /edit summary/i }))
    const textarea = screen.getByRole("textbox", { name: /edit summary/i })
    await user.clear(textarea)
    await user.type(textarea, "New summary")
    await user.keyboard("{Control>}{Enter}{/Control}")

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith("summary", "New summary")
  })

  it("editing an empty/absent field adds a value (the 'Not extracted — add' path)", async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(
      <InlineEdit field="author" fieldType="author" value={undefined} onCommit={onCommit} />,
    )
    // Empty state: a focusable "add" affordance (never colour-alone — has a word).
    const addBtn = screen.getByRole("button", { name: /add author/i })
    expect(addBtn).toHaveTextContent(/not extracted — add/i)

    await user.click(addBtn)
    const input = screen.getByRole("textbox", { name: /edit author/i })
    await user.type(input, "Added Author")
    await user.keyboard("{Enter}")

    expect(onCommit).toHaveBeenCalledWith("author", "Added Author")
  })
})
