/**
 * Phase 307-03 (D-13) — the consent page's org field.
 *
 * One switched-on org is a read-only fact. Two or more are a radiogroup with arrow keys. A switched-off
 * org is NEVER hidden: its row is aria-disabled and carries the 304 sentence through
 * aria-describedby. Arrow keys skip a switched-off row.
 */
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ConsentOrg } from "@/lib/api/oauth"
import { ConsentOrgField } from "../ConsentOrgField"

const OFF = "MCP access is switched off for this organisation by an admin."
const A: ConsentOrg = { id: "a", name: "Acme Legal", mcp_off: null, active: false }
const B: ConsentOrg = { id: "b", name: "Beta Co", mcp_off: null, active: true }
const C: ConsentOrg = { id: "c", name: "Closed Ltd", mcp_off: "org", active: false }

function Harness({ orgs, initial, onChange }: { orgs: ConsentOrg[]; initial: string | null; onChange?: (id: string) => void }) {
  const [value, setValue] = useState<string | null>(initial)
  return (
    <ConsentOrgField
      orgs={orgs}
      value={value}
      onChange={(id) => {
        setValue(id)
        onChange?.(id)
      }}
    />
  )
}

describe("307-03 ConsentOrgField", () => {
  it("one switched-on org is a read-only fact, no control", () => {
    render(<Harness orgs={[A]} initial="a" />)
    expect(screen.queryByRole("radiogroup")).toBeNull()
    expect(screen.getByTestId("consent-org-fact")).toHaveTextContent("Acme Legal")
    expect(screen.getByText("Organisation")).toBeInTheDocument()
  })

  it("two or more are a radiogroup; the switched-off org is listed, disabled, and says why", () => {
    render(<Harness orgs={[A, B, C]} initial="b" />)
    const group = screen.getByRole("radiogroup", { name: "Organisation" })
    const radios = screen.getAllByRole("radio")
    expect(radios.map((r) => r.textContent)).toEqual(["Acme Legal", "Beta Co", `Closed Ltd${OFF}`])
    expect(group).toBeInTheDocument()
    const closed = screen.getByRole("radio", { name: /Closed Ltd/ })
    expect(closed).toHaveAttribute("aria-disabled", "true")
    const why = screen.getByText(OFF)
    expect(closed.getAttribute("aria-describedby")).toContain(why.id)
    expect(screen.getByRole("radio", { name: "Beta Co" })).toHaveAttribute("aria-checked", "true")
  })

  it("clicking a switched-off row changes nothing", async () => {
    const onChange = vi.fn()
    render(<Harness orgs={[A, B, C]} initial="a" onChange={onChange} />)
    await userEvent.click(screen.getByRole("radio", { name: /Closed Ltd/ }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("arrow keys move between switched-on orgs and skip a switched-off one", async () => {
    const onChange = vi.fn()
    render(<Harness orgs={[A, C, B]} initial="a" onChange={onChange} />)
    const acme = screen.getByRole("radio", { name: "Acme Legal" })
    acme.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(onChange).toHaveBeenLastCalledWith("b")
    expect(screen.getByRole("radio", { name: "Beta Co" })).toHaveFocus()
    expect(screen.getByRole("radio", { name: "Beta Co" })).toHaveAttribute("tabindex", "0")
    expect(acme).toHaveAttribute("tabindex", "-1")
  })

  it("a click on another org calls onChange with its id", async () => {
    const onChange = vi.fn()
    render(<Harness orgs={[A, B]} initial="a" onChange={onChange} />)
    await userEvent.click(screen.getByRole("radio", { name: "Beta Co" }))
    expect(onChange).toHaveBeenCalledWith("b")
  })
})
