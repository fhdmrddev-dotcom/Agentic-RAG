/**
 * Phase 271 plan 02 (D-01 / UI-SPEC S5) — the Find documents | Ask mode switch.
 *
 * ⛔ A RADIOGROUP, NEVER A TABLIST. The Library header already owns the page's one tablist, and
 * 41+ cases query it by `getByRole("tab", { name })`; a second set of tabs would collide with
 * every one of them and would also tell a screen reader this is a page section, which it is not.
 */
import { describe, it, expect, vi } from "vitest"
import { useState } from "react"
import { render, screen, fireEvent } from "@testing-library/react"

import { FindModeSwitch, type FindMode } from "../FindModeSwitch"

function Harness({ initial = "find", onChange }: { initial?: FindMode; onChange?: (m: FindMode) => void }) {
  const [mode, setMode] = useState<FindMode>(initial)
  return (
    <FindModeSwitch
      value={mode}
      onChange={(m) => {
        onChange?.(m)
        setMode(m)
      }}
    />
  )
}

describe("FindModeSwitch — a radiogroup, never a tab (D-01)", () => {
  it("renders a radiogroup named 'Search mode' with two radios", () => {
    render(<FindModeSwitch value="find" onChange={vi.fn()} />)
    const group = screen.getByRole("radiogroup", { name: "Search mode" })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Find documents" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Ask" })).toBeInTheDocument()
    expect(screen.getAllByRole("radio")).toHaveLength(2)
  })

  it("⛔ no element carries role=tab", () => {
    const { container } = render(<FindModeSwitch value="find" onChange={vi.fn()} />)
    expect(screen.queryAllByRole("tab")).toHaveLength(0)
    expect(container.querySelector('[role="tab"], [role="tablist"]')).toBeNull()
  })

  it("marks the checked segment with aria-checked and the accent wash", () => {
    render(<FindModeSwitch value="ask" onChange={vi.fn()} />)
    const ask = screen.getByRole("radio", { name: "Ask" })
    const find = screen.getByRole("radio", { name: "Find documents" })
    expect(ask).toHaveAttribute("aria-checked", "true")
    expect(find).toHaveAttribute("aria-checked", "false")
    expect(ask.className).toContain("bg-primary/15")
    expect(ask.className).toContain("text-primary")
    expect(find.className).not.toContain("bg-primary/15")
  })

  it("roving tabindex — only the checked segment is in the tab order", () => {
    render(<FindModeSwitch value="find" onChange={vi.fn()} />)
    expect(screen.getByRole("radio", { name: "Find documents" })).toHaveAttribute("tabindex", "0")
    expect(screen.getByRole("radio", { name: "Ask" })).toHaveAttribute("tabindex", "-1")
  })

  it("ArrowRight from Find selects Ask and moves focus; ArrowLeft goes back", () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const find = screen.getByRole("radio", { name: "Find documents" })
    find.focus()
    fireEvent.keyDown(find, { key: "ArrowRight" })
    expect(onChange).toHaveBeenLastCalledWith("ask")
    const ask = screen.getByRole("radio", { name: "Ask" })
    expect(ask).toHaveFocus()
    expect(ask).toHaveAttribute("aria-checked", "true")

    fireEvent.keyDown(ask, { key: "ArrowLeft" })
    expect(onChange).toHaveBeenLastCalledWith("find")
    expect(screen.getByRole("radio", { name: "Find documents" })).toHaveFocus()
  })

  it("arrows wrap at either end", () => {
    const onChange = vi.fn()
    render(<Harness initial="ask" onChange={onChange} />)
    const ask = screen.getByRole("radio", { name: "Ask" })
    ask.focus()
    fireEvent.keyDown(ask, { key: "ArrowRight" })
    expect(onChange).toHaveBeenLastCalledWith("find")
  })

  it("a click selects the segment", () => {
    const onChange = vi.fn()
    render(<FindModeSwitch value="find" onChange={onChange} />)
    fireEvent.click(screen.getByRole("radio", { name: "Ask" }))
    expect(onChange).toHaveBeenCalledWith("ask")
  })
})
