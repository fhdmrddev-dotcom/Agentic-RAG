/**
 * Phase 271-03 Task 2 (D-04) — the Phase 117 typeahead, EXTRACTED so the Find Relationship
 * filter and the Add-link dialog mount ONE combobox (never a fork).
 *
 * Pins the APG wiring that moved verbatim out of `CreateLinkDialog.tsx`: the combobox and
 * listbox roles, `aria-controls` ONLY while the listbox is in the tree (WR-04), the
 * `aria-activedescendant` keyboard walk, Enter to choose, exclusion, and mouse-down choosing
 * without blurring the input first.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { LinkTargetCombobox } from "./LinkTargetCombobox"

const docs = Array.from({ length: 12 }, (_, i) => ({
  id: `d${i}`,
  filename: i === 3 ? "Acme MSA 2019.pdf" : `report-${String(i).padStart(2, "0")}.pdf`,
}))

afterEach(() => {
  cleanup()
})

function renderBox(props: Partial<React.ComponentProps<typeof LinkTargetCombobox>> = {}) {
  const onChoose = vi.fn()
  render(
    <LinkTargetCombobox
      candidates={docs}
      excludeIds={new Set<string>()}
      value={null}
      onChoose={onChoose}
      placeholder="Type a document name"
      {...props}
    />,
  )
  return { onChoose, input: screen.getByRole("combobox") }
}

describe("LinkTargetCombobox — roles", () => {
  it("is a list-autocomplete combobox with a placeholder", () => {
    const { input } = renderBox()
    expect(input).toHaveAttribute("aria-autocomplete", "list")
    expect(input).toHaveAttribute("placeholder", "Type a document name")
  })

  it("references the listbox in aria-controls ONLY while the listbox is visible (WR-04)", async () => {
    // A picked value with no typed text: the list is collapsed.
    const { input } = renderBox({ value: "d0" })
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute("aria-controls")
    expect(input).toHaveAttribute("aria-expanded", "false")

    const user = userEvent.setup()
    await user.type(input, "acme")
    const listbox = screen.getByRole("listbox")
    expect(input).toHaveAttribute("aria-controls", listbox.id)
    expect(input).toHaveAttribute("aria-expanded", "true")
  })
})

describe("LinkTargetCombobox — filtering", () => {
  it("shows at most maxVisible candidates (default 8)", () => {
    renderBox()
    expect(screen.getAllByRole("option")).toHaveLength(8)
  })

  it("honours an explicit maxVisible", () => {
    renderBox({ maxVisible: 3 })
    expect(screen.getAllByRole("option")).toHaveLength(3)
  })

  it("filters case-insensitively by typed name", async () => {
    const { input } = renderBox()
    const user = userEvent.setup()
    await user.type(input, "ACME")
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent("Acme MSA 2019.pdf")
  })

  it("never offers an excluded id", async () => {
    const { input } = renderBox({ excludeIds: new Set(["d3"]) })
    const user = userEvent.setup()
    await user.type(input, "acme")
    expect(screen.queryByRole("option", { name: /acme/i })).not.toBeInTheDocument()
    expect(screen.getByText("No matching documents")).toBeInTheDocument()
  })
})

describe("LinkTargetCombobox — keyboard and pointer", () => {
  it("ArrowDown / ArrowUp move aria-activedescendant; Enter chooses the active option", async () => {
    const { input, onChoose } = renderBox()
    const user = userEvent.setup()
    input.focus()
    expect(input).not.toHaveAttribute("aria-activedescendant")

    await user.keyboard("{ArrowDown}")
    const options = screen.getAllByRole("option")
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id)

    await user.keyboard("{ArrowDown}")
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id)

    await user.keyboard("{ArrowUp}")
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id)

    await user.keyboard("{Enter}")
    expect(onChoose).toHaveBeenLastCalledWith(docs[0])
    expect(input).toHaveValue(docs[0].filename)
  })

  it("mouse-down on an option chooses it without blurring the input first", () => {
    const { input, onChoose } = renderBox()
    input.focus()
    const option = screen.getByRole("option", { name: "report-01.pdf" })
    const ev = fireEvent.mouseDown(option)
    // `fireEvent` returns false when the handler called preventDefault — that is what keeps
    // focus in the input, so the choice lands before any blur handler runs.
    expect(ev).toBe(false)
    expect(onChoose).toHaveBeenCalledWith(docs[1])
    expect(document.activeElement).toBe(input)
  })

  it("typing after a pick clears it (onChoose(null))", async () => {
    const { input, onChoose } = renderBox({ value: "d1" })
    const user = userEvent.setup()
    await user.type(input, "a")
    expect(onChoose).toHaveBeenCalledWith(null)
  })
})
