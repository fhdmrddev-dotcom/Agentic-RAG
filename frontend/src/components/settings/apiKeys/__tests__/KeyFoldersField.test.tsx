/**
 * Phase 304-05 (D-08, D-22, D-23; UI-SPEC §1c row 4) — narrowing an MCP key to folders.
 *
 * All folders is the default. Only these folders opens a tree of nested native checkboxes in a
 * group (not an ARIA tree): a ticked folder includes its subtree, shared folders say so and start
 * unticked, and mail / synced folders wait for "Include mail and synced sources" (one control owns
 * D-23's exclusion).
 */
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { PickableFolder } from "@/lib/api/apiKeys"
import type { FolderMode } from "../mcpKeyFacts"
import { KeyFoldersField } from "../KeyFoldersField"
import { makeFolder } from "./fixtures"

const FOLDERS: PickableFolder[] = [
  makeFolder({ id: "c", name: "Contracts" }),
  makeFolder({ id: "c1", name: "2026", parent_id: "c" }),
  makeFolder({ id: "c1a", name: "Q4", parent_id: "c1" }),
  makeFolder({ id: "h", name: "HR policies", shared: true }),
  makeFolder({ id: "m", name: "Mailbox", source: "mail" }),
  makeFolder({ id: "s", name: "Drive sync", source: "synced" }),
]

function Harness({
  folders = FOLDERS,
  external = false,
  failed = false,
  onRetry = () => {},
  initialMode = "all",
}: {
  folders?: PickableFolder[] | null
  external?: boolean
  failed?: boolean
  onRetry?: () => void
  initialMode?: FolderMode
}) {
  const [mode, setMode] = useState<FolderMode>(initialMode)
  const [ticked, setTicked] = useState<string[]>([])
  return (
    <>
      <KeyFoldersField
        orgName="Acme"
        folders={folders}
        failed={failed}
        onRetry={onRetry}
        mode={mode}
        onModeChange={setMode}
        ticked={ticked}
        onTickedChange={setTicked}
        external={external}
      />
      <output data-testid="ticked">{ticked.join(",")}</output>
    </>
  )
}

describe("304-05 KeyFoldersField", () => {
  it("All folders I can see in {org} is chosen by default, with its hint and no tree", () => {
    render(<Harness />)
    const group = screen.getByRole("radiogroup", { name: "Folders" })
    expect(within(group).getByRole("radio", { name: "All folders I can see in Acme" })).toHaveAttribute("aria-checked", "true")
    expect(within(group).getByRole("radio", { name: "Only these folders" })).toHaveAttribute("aria-checked", "false")
    expect(
      screen.getByText(
        "Includes folders shared with the whole organisation. Mail and synced sources are left out unless you include them below.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).toBeNull()
  })

  it("Only these folders opens the tree; ticking a folder includes its subtree", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole("radio", { name: "Only these folders" }))
    const tree = screen.getByRole("group", { name: "Only these folders" })
    expect(screen.getByText("Subfolders are included, also ones made later.")).toBeInTheDocument()
    expect(screen.getByText("0 folders ticked")).toBeInTheDocument()
    await user.click(within(tree).getByRole("checkbox", { name: /Contracts/ }))
    const child = within(tree).getByRole("checkbox", { name: /^2026/ })
    const grand = within(tree).getByRole("checkbox", { name: /^Q4/ })
    for (const box of [child, grand]) {
      expect(box).toBeChecked()
      expect(box).toBeDisabled()
      expect(box).toHaveAccessibleDescription("included")
    }
    expect(screen.getByTestId("ticked")).toHaveTextContent("c")
    expect(screen.getByText("1 folder ticked")).toBeInTheDocument()
  })

  it("shared folders say so and start unticked", async () => {
    const user = userEvent.setup()
    render(<Harness initialMode="only" />)
    const hr = screen.getByRole("checkbox", { name: /HR policies/ })
    expect(hr).not.toBeChecked()
    expect(hr).toBeEnabled()
    expect(hr.closest("label")).toHaveTextContent("shared with the org")
    await user.click(hr)
    expect(hr).toBeChecked()
  })

  it("mail and synced folders wait for the external tick, and say why", () => {
    const { rerender } = render(<Harness initialMode="only" />)
    const mail = screen.getByRole("checkbox", { name: /Mailbox/ })
    const sync = screen.getByRole("checkbox", { name: /Drive sync/ })
    expect(mail).toBeDisabled()
    expect(sync).toBeDisabled()
    expect(mail).toHaveAccessibleDescription("tick Include mail and synced sources first")
    expect(mail.closest("label")).toHaveTextContent("mail")
    expect(sync.closest("label")).toHaveTextContent("synced")
    rerender(<Harness initialMode="only" external />)
    expect(screen.getByRole("checkbox", { name: /Mailbox/ })).toBeEnabled()
  })

  it("a filter appears above more than 12 folders", async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: 13 }, (_, i) => makeFolder({ id: `f${i}`, name: `Folder ${String(i).padStart(2, "0")}` }))
    render(<Harness folders={many} initialMode="only" />)
    const filter = screen.getByRole("textbox", { name: "Filter folders" })
    await user.type(filter, "folder 1")
    expect(screen.getAllByRole("checkbox")).toHaveLength(3)
  })

  it("no filter at 12 folders or fewer", () => {
    render(<Harness initialMode="only" />)
    expect(screen.queryByRole("textbox", { name: "Filter folders" })).toBeNull()
  })

  it("loading, failed with Retry, and none visible", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const { rerender } = render(<Harness folders={null} initialMode="only" />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading your folders…")
    rerender(<Harness folders={null} failed onRetry={onRetry} initialMode="only" />)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load your folders.")
    await user.click(within(alert).getByRole("button", { name: "Retry" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    rerender(<Harness folders={[]} initialMode="only" />)
    expect(screen.getByText("You can't see any folders in Acme yet.")).toBeInTheDocument()
  })
})
