/**
 * Phase 304-05 (KEY-03, KEY-04; D-07, D-11, D-12, D-23; UI-SPEC §1c) — the MCP rows of the draft.
 *
 * SC2 / KEY-04: a new MCP key reads Read only, All folders, mail and synced sources left out, and a
 * 90-day expiry with no Never. Tool names and labels come only from the server's catalogue (D-11);
 * the client spells the three group headings and four preset names. Companions travel with their
 * lead (D-12) as disabled mirrors.
 */
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { McpToolRef, PickableFolder } from "@/lib/api/apiKeys"
import { MCP_DRAFT_DEFAULT, type McpDraft } from "../mcpKeyFacts"
import { McpKeyFields } from "../McpKeyFields"
import { MCP_CATALOGUE, makeFolder } from "./fixtures"

function Harness({
  catalogue = MCP_CATALOGUE,
  catalogueFailed = false,
  onRetryCatalogue = () => {},
  folders = [makeFolder({ id: "m", name: "Mailbox", source: "mail" }), makeFolder({ id: "p", name: "Projects" })],
  initial = MCP_DRAFT_DEFAULT,
}: {
  catalogue?: McpToolRef[] | null
  catalogueFailed?: boolean
  onRetryCatalogue?: () => void
  folders?: PickableFolder[] | null
  initial?: McpDraft
}) {
  const [value, setValue] = useState<McpDraft>(initial)
  return (
    <>
      <McpKeyFields
        orgName="Acme"
        catalogue={catalogue}
        catalogueFailed={catalogueFailed}
        onRetryCatalogue={onRetryCatalogue}
        folders={folders}
        foldersFailed={false}
        onRetryFolders={() => {}}
        value={value}
        onChange={setValue}
      />
      <output data-testid="draft">{JSON.stringify(value)}</output>
    </>
  )
}

const draft = () => JSON.parse(screen.getByTestId("draft").textContent ?? "{}") as McpDraft

describe("304-05 McpKeyFields — safe defaults (SC2 / KEY-04)", () => {
  it("Organisation fact, Read only, the three groups from the catalogue, ask and run unticked", () => {
    render(<Harness />)
    expect(screen.getByTestId("mcp-org")).toHaveTextContent("Acme")
    expect(
      screen.getByText("The key acts as you in this organisation only. To use another organisation, switch to it and make a key there."),
    ).toBeInTheDocument()
    const presets = screen.getByRole("radiogroup", { name: "Tools" })
    expect(within(presets).getAllByRole("radio").map((r) => r.textContent)).toEqual([
      "Read only",
      "Read and ask",
      "Read, ask and run workflows",
      "Choose tools",
    ])
    expect(within(presets).getByRole("radio", { name: "Read only" })).toHaveAttribute("aria-checked", "true")
    for (const g of ["Read", "Ask the agent", "Run workflows"]) expect(screen.getByRole("group", { name: g })).toBeInTheDocument()
    const read = screen.getByRole("group", { name: "Read" })
    expect(within(read).getByRole("checkbox", { name: /search_knowledge_base/ })).toBeChecked()
    expect(within(read).getByText("Search your knowledge base")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /^ask_agent/ })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: /^run_workflow/ })).not.toBeChecked()
    expect(
      screen.getByText(
        "Read only is the safe default. Ask lets the tool put questions to the agent as you. Run lets it start your published workflows as you.",
      ),
    ).toBeInTheDocument()
  })

  it("All folders, mail and synced sources unticked, 90 days with no Never, and the acts-as note", () => {
    render(<Harness />)
    expect(screen.getByRole("radio", { name: "All folders I can see in Acme" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("checkbox", { name: /Include mail and synced sources/ })).not.toBeChecked()
    const exp = screen.getByRole("radiogroup", { name: "Expires" })
    expect(within(exp).getAllByRole("radio").map((r) => r.textContent)).toEqual(["30 days", "90 days", "365 days"])
    expect(within(exp).getByRole("radio", { name: "90 days" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByText("AI tool keys always expire. You can revoke it any time before then.")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-acts-as")).toHaveTextContent(
      "This key acts as you in Acme. It sees what you see there, never more, and only within the folders and tools above.",
    )
  })
})

describe("304-05 McpKeyFields — tools", () => {
  it("a hand tick moves to Choose tools; the companion mirrors its lead, disabled", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole("checkbox", { name: /^ask_agent/ }))
    expect(screen.getByRole("radio", { name: "Choose tools" })).toHaveAttribute("aria-checked", "true")
    const answer = screen.getByRole("checkbox", { name: /^get_answer/ })
    expect(answer).toBeChecked()
    expect(answer).toBeDisabled()
    expect(answer).toHaveAccessibleDescription("comes with ask_agent")
    expect(screen.getByRole("checkbox", { name: /^list_workflows/ })).toHaveAccessibleDescription("comes with run_workflow")
    expect(screen.getByRole("checkbox", { name: /^list_workflows/ })).not.toBeChecked()
  })

  it("picking a preset overwrites the hand ticks", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole("checkbox", { name: /^read_document/ }))
    expect(screen.getByRole("checkbox", { name: /^read_document/ })).not.toBeChecked()
    await user.click(screen.getByRole("radio", { name: "Read, ask and run workflows" }))
    for (const t of MCP_CATALOGUE) expect(screen.getByRole("checkbox", { name: new RegExp(`^${t.name}`) })).toBeChecked()
    expect(draft().preset).toBe("run")
  })

  it("loading and failed catalogue states", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const { rerender } = render(<Harness catalogue={null} />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading the tools…")
    rerender(<Harness catalogue={null} catalogueFailed onRetryCatalogue={onRetry} />)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load the tools.")
    await user.click(within(alert).getByRole("button", { name: "Retry" }))
    expect(onRetry).toHaveBeenCalled()
  })
})

describe("304-05 McpKeyFields — the external tick owns connector-fed folders (D-23)", () => {
  it("unticking Include mail and synced sources unticks the mail folder", async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ ...MCP_DRAFT_DEFAULT, folderMode: "only" }} />)
    const external = screen.getByRole("checkbox", { name: /Include mail and synced sources/ })
    await user.click(external)
    await user.click(screen.getByRole("checkbox", { name: /Mailbox/ }))
    expect(draft().folderIds).toEqual(["m"])
    await user.click(external)
    expect(draft().folderIds).toEqual([])
    expect(screen.getByRole("checkbox", { name: /Mailbox/ })).toBeDisabled()
  })
})
