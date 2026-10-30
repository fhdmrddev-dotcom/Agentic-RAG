/**
 * Phase 304-05 (D-01, D-30; UI-SPEC §1b) — the first choice of a new key: what is it for?
 *
 * A radiogroup of two tiles with the shipped Expires control's roving tabindex. The MCP tile is
 * absent when the deployment can't make AI tool keys (D-30), and disabled with the org sentence
 * when an admin switched MCP off for the organisation.
 */
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ApiKeyKind, McpOff } from "@/lib/api/apiKeys"
import { ApiKeyKindChoice } from "../ApiKeyKindChoice"

function Harness({ off = null, onChange }: { off?: McpOff | null; onChange?: (k: ApiKeyKind) => void }) {
  const [v, setV] = useState<ApiKeyKind | null>(null)
  return (
    <ApiKeyKindChoice
      value={v}
      autoFocus
      onChange={(k) => {
        setV(k)
        onChange?.(k)
      }}
      mcp={{ available: true, off }}
    />
  )
}

describe("304-05 ApiKeyKindChoice", () => {
  it("a radiogroup named by the question; nothing chosen; focus on the first tile", () => {
    render(<Harness />)
    const group = screen.getByRole("radiogroup", { name: "What is this key for?" })
    const [mcp, wf] = within(group).getAllByRole("radio")
    expect(mcp).toHaveAccessibleName(/For an AI tool \(MCP\)/)
    expect(wf).toHaveAccessibleName(/For a workflow integration/)
    expect(mcp).toHaveAttribute("aria-checked", "false")
    expect(wf).toHaveAttribute("aria-checked", "false")
    expect(within(mcp).getByText("Claude Code, Cursor or VS Code searches and reads your knowledge as you.")).toBeInTheDocument()
    expect(within(wf).getByText("n8n, a script or a scheduler starts the published workflows you pick.")).toBeInTheDocument()
    expect(document.activeElement).toBe(mcp)
    expect(mcp).toHaveAttribute("tabindex", "0")
    expect(wf).toHaveAttribute("tabindex", "-1")
  })

  it("arrow keys move and select; a click selects", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.keyboard("{ArrowRight}")
    const [mcp, wf] = screen.getAllByRole("radio")
    expect(onChange).toHaveBeenLastCalledWith("workflow")
    expect(wf).toHaveAttribute("aria-checked", "true")
    expect(document.activeElement).toBe(wf)
    await user.keyboard("{ArrowLeft}")
    expect(onChange).toHaveBeenLastCalledWith("mcp")
    await user.click(wf)
    expect(onChange).toHaveBeenLastCalledWith("workflow")
    expect(mcp).toHaveAttribute("aria-checked", "false")
  })

  it("org switch off: the MCP tile is disabled with the org sentence and cannot be chosen", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness off="org" onChange={onChange} />)
    const [mcp, wf] = screen.getAllByRole("radio")
    expect(mcp).toHaveAttribute("aria-disabled", "true")
    expect(within(mcp).getByText("MCP access is switched off for this organisation by an admin.")).toBeInTheDocument()
    expect(within(mcp).queryByText(/searches and reads your knowledge/)).toBeNull()
    // focus starts on the first tile that can be chosen, and arrows skip the disabled one
    expect(document.activeElement).toBe(wf)
    await user.click(mcp)
    expect(onChange).not.toHaveBeenCalled()
    wf.focus()
    await user.keyboard("{ArrowLeft}")
    expect(onChange).toHaveBeenLastCalledWith("workflow")
  })

  it("not available on this deployment: renders nothing (D-30)", () => {
    const { container } = render(
      <ApiKeyKindChoice value={null} onChange={() => {}} mcp={{ available: false, off: "deployment" }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
