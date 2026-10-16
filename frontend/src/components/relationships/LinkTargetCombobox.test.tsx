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
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
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

// ── 284-04 (D-15 / R-05 / UI-SPEC "Pickers on server search") — server mode ─────────────────
//
// With `onQueryChange` the owner searches on the SERVER: the box reports what is typed, shows the
// candidates it is handed as the answer (no client name filter — RESEARCH Pitfall 10: a typed `*`
// is a server wildcard the client filter would drop), and says what the search is doing in a line
// AFTER the listbox, never inside it.

function renderServer(props: Partial<React.ComponentProps<typeof LinkTargetCombobox>> = {}) {
  const onChoose = vi.fn()
  const onQueryChange = vi.fn()
  const onRetry = vi.fn()
  const view = render(
    <LinkTargetCombobox
      candidates={docs}
      excludeIds={new Set<string>()}
      value={null}
      onChoose={onChoose}
      placeholder="Type a document name"
      onQueryChange={onQueryChange}
      onRetry={onRetry}
      {...props}
    />,
  )
  return { onChoose, onQueryChange, onRetry, input: screen.getByRole("combobox"), ...view }
}

describe("LinkTargetCombobox — server mode (284-04)", () => {
  it("reports every keystroke and does NOT filter the answer by name on the client", async () => {
    const { input, onQueryChange } = renderServer()
    const user = userEvent.setup()
    await user.type(input, "zz*")
    expect(onQueryChange).toHaveBeenLastCalledWith("zz*")
    // Nothing is named "zz*", yet the server's answer is shown as given (capped at maxVisible).
    expect(screen.getAllByRole("option")).toHaveLength(8)
  })

  it("still never offers an excluded id", () => {
    renderServer({ excludeIds: new Set(["d0", "d1"]) })
    const names = screen.getAllByRole("option").map((o) => o.textContent)
    expect(names).not.toContain("report-00.pdf")
    expect(names).not.toContain("report-01.pdf")
  })

  it("searching with no rows yet: no options, no 'No matching documents', a Searching… status after the list", () => {
    const { container } = renderServer({ candidates: [], loading: true })
    const listbox = screen.getByRole("listbox")
    expect(within(listbox).queryAllByRole("option")).toHaveLength(0)
    expect(screen.queryByText("No matching documents")).toBeNull()
    expect(listbox).toHaveAttribute("aria-busy", "true")
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Searching…")
    expect(listbox.contains(status)).toBe(false)
    // the status line is the listbox's NEXT sibling, never a child of it
    expect(listbox.nextElementSibling).toBe(status)
    expect(container.querySelectorAll('[role="listbox"] [role="status"]')).toHaveLength(0)
  })

  it("searching with rows on screen keeps them, dimmed and aria-busy", () => {
    renderServer({ loading: true })
    const listbox = screen.getByRole("listbox")
    expect(within(listbox).getAllByRole("option")).toHaveLength(8)
    expect(listbox).toHaveAttribute("aria-busy", "true")
    expect(listbox.className).toContain("opacity-60")
    expect(screen.getByRole("status")).toHaveTextContent("Searching…")
  })

  it("more matches than shown: one plain line, no number", () => {
    renderServer({ hasMore: true })
    const listbox = screen.getByRole("listbox")
    expect(listbox).not.toHaveAttribute("aria-busy")
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("More documents match. Type more of the name to narrow.")
    expect(status.textContent).not.toMatch(/\d/)
    expect(listbox.nextElementSibling).toBe(status)
  })

  it("'No matching documents' only after a completed empty answer", () => {
    renderServer({ candidates: [], loading: false })
    expect(screen.getByText("No matching documents")).toBeInTheDocument()
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("a failed search says so after the list, keeps the previous options, and Try again retries", async () => {
    const { onRetry } = renderServer({ error: true })
    expect(screen.getAllByRole("option")).toHaveLength(8)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Couldn’t search documents.")
    expect(screen.getByRole("listbox").contains(alert)).toBe(false)
    await userEvent.setup().click(within(alert).getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("No matching documents")).toBeNull()
  })

  it("choosing reports the chosen name as the new query, and the keyboard walk is unchanged", async () => {
    const { input, onChoose, onQueryChange } = renderServer()
    const user = userEvent.setup()
    input.focus()
    await user.keyboard("{ArrowDown}{ArrowDown}")
    const options = screen.getAllByRole("option")
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id)
    await user.keyboard("{Enter}")
    expect(onChoose).toHaveBeenLastCalledWith(docs[1])
    expect(onQueryChange).toHaveBeenLastCalledWith(docs[1].filename)
  })
})
