/**
 * Phase 274 plan 03 Task 2 (D-10 amended) — the no-Root, searchable, full-path folder listbox.
 *
 * Sketch 274's winner A draws a searchable list of FULL folder paths (parents dim, leaf bold),
 * single-select, and — the point of the amendment — NO Root option: an unset folder is a refusal,
 * never a silent top-level save. It is a listbox, so it carries 035-A's combobox obligation:
 * `role=combobox` + `aria-activedescendant`, `role=listbox`, `role=option` + `aria-selected`, and
 * a keyboard walk. It returns a folder id to its owner and commits NOTHING itself.
 */
import { useState } from "react"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { FolderPathListbox } from "../FolderPathListbox"
import { COPY } from "../saveToLibraryCopy"
import type { Folder } from "@/types"

function folder(id: string, name: string, parent_id: string | null): Folder {
  return {
    id,
    user_id: "u-1",
    name,
    parent_id,
    is_org_shared: false,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  }
}

// Deliberately NOT in path order, so the sort is exercised.
const FOLDERS: Folder[] = [
  folder("s3", "Pricing", "s2"),
  folder("s1", "Suppliers", null),
  folder("c2", "Active suppliers", "c1"),
  folder("s2", "Meridian", "s1"),
  folder("c1", "Contracts", null),
]

function Harness({
  folders = FOLDERS,
  onChange = vi.fn(),
  initial = null,
}: {
  folders?: Folder[]
  onChange?: (id: string | null) => void
  initial?: string | null
}) {
  const [value, setValue] = useState<string | null>(initial)
  return (
    <FolderPathListbox
      folders={folders}
      value={value}
      onChange={(id) => {
        setValue(id)
        onChange(id)
      }}
    />
  )
}

describe("FolderPathListbox", () => {
  it("lists every folder as a full path, sorted, and offers NO Root", () => {
    render(<Harness />)
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(5)
    expect(options.map((o) => o.textContent)).toEqual([
      "Contracts",
      "Contracts/Active suppliers",
      "Suppliers",
      "Suppliers/Meridian",
      "Suppliers/Meridian/Pricing",
    ])
    for (const o of options) expect(o.textContent).not.toMatch(/root/i)
  })

  it("the leaf is bold and the parents are muted", () => {
    render(<Harness />)
    const pricing = screen.getAllByRole("option")[4]
    const leaf = within(pricing).getByText("Pricing")
    expect(leaf.className).toMatch(/font-semibold|font-bold/)
    const parents = within(pricing).getByText("Suppliers/Meridian/")
    expect(parents.className).toMatch(/muted/)
  })

  it("filters by a case-insensitive substring of the FULL path", () => {
    render(<Harness />)
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "meri" } })
    expect(screen.getAllByRole("option")).toHaveLength(2)
  })

  it("a query that matches nothing shows the no-match line and no options", () => {
    render(<Harness />)
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } })
    expect(screen.queryAllByRole("option")).toHaveLength(0)
    expect(screen.getByRole("status").textContent).toBe(COPY.netNew.noFolderMatches)
  })

  it("ArrowDown x2 then Enter chooses the SECOND visible folder and marks it selected", () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const input = screen.getByRole("combobox")
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith("c2")
    const second = screen.getAllByRole("option")[1]
    expect(second.getAttribute("aria-selected")).toBe("true")
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("false")
  })

  it("ArrowUp from the top wraps to the last option", () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const input = screen.getByRole("combobox")
    fireEvent.keyDown(input, { key: "ArrowUp" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onChange).toHaveBeenCalledWith("s3")
  })

  it("wires the APG combobox: expanded, controls the listbox, active descendant follows the walk", () => {
    render(<Harness />)
    const input = screen.getByRole("combobox")
    const listbox = screen.getByRole("listbox")
    expect(input.getAttribute("aria-expanded")).toBe("true")
    expect(input.getAttribute("aria-controls")).toBe(listbox.id)
    expect(listbox.id).not.toBe("")
    expect(input.getAttribute("aria-activedescendant")).toBeNull()
    fireEvent.keyDown(input, { key: "ArrowDown" })
    const first = screen.getAllByRole("option")[0]
    expect(input.getAttribute("aria-activedescendant")).toBe(first.id)
    expect(first.id).not.toBe("")
  })

  it("clicking an option selects it", () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const meridian = screen.getAllByRole("option")[3]
    fireEvent.mouseDown(meridian)
    expect(onChange).toHaveBeenCalledWith("s2")
    expect(screen.getAllByRole("option")[3].getAttribute("aria-selected")).toBe("true")
  })

  it("typing does NOT clear an existing pick", () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} initial="s3" />)
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "contr" } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("no folders at all → the no-folders line and no options", () => {
    render(<Harness folders={[]} />)
    expect(screen.queryAllByRole("option")).toHaveLength(0)
    expect(screen.getByRole("status").textContent).toBe(COPY.netNew.noFolders)
  })

  it("the search box uses the sketch's placeholder", () => {
    render(<Harness />)
    expect(screen.getByRole("combobox").getAttribute("placeholder")).toBe(COPY.a.search)
  })
})
