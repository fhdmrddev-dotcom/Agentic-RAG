/**
 * Phase 298-05 (D-19 / D-31 / UI-D15) — who is OFFERED "Move to <Org>…".
 *
 * The control is ABSENT (never disabled — org-admin D3) for a solo user, a non-owner, outside an
 * OrgProvider, and on anything the client already knows cannot move. At 2-3 orgs there is one
 * item per other org, ordered by name; at 4+ they collapse into "Move to another organization…".
 * The menu item stays a `DropdownMenuItem` (the WR-03 `aria-required-children` sweep). The detail
 * panel's button follows the same rule for an owned, latest Root document.
 *
 * Every other blocker is the server's to state, in the sheet — eligibility here is a convenience.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const org = vi.hoisted(() => ({
  value: null as null | { activeOrgId: string | null; orgs: { org_id: string; name: string; role: string }[]; switchOrg: () => void },
}))
vi.mock("@/providers/OrgProvider", () => ({ useOrgOptional: () => org.value }))

const client = vi.hoisted(() => ({ getMovePreview: vi.fn(), moveOrgItem: vi.fn(), getElsewhereCounts: vi.fn() }))
vi.mock("@/lib/api/orgItems", () => client)

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoveToOrgMenuItem } from "../MoveToOrgMenuItem"
import { MoveToOrgButton } from "../MoveToOrgButton"
import { useOrgItemsStore } from "@/lib/elsewhereCounts"
import type { Document } from "@/types"
import type { FolderNode } from "@/lib/folderTree"

const PERSONAL = { org_id: "A", name: "Personal", role: "owner" }
const ACME = { org_id: "B", name: "Acme Legal", role: "member" }
const BETA = { org_id: "C", name: "Beta Co", role: "member" }
const ZETA = { org_id: "D", name: "Zeta Group", role: "member" }

function setOrgs(orgs: (typeof PERSONAL)[], active = "A") {
  org.value = { activeOrgId: active, orgs, switchOrg: vi.fn() }
}

async function renderInMenu(ui: React.ReactElement) {
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>Options</DropdownMenuTrigger>
      <DropdownMenuContent>{ui}</DropdownMenuContent>
    </DropdownMenu>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Options" }))
  return { user, menu: await screen.findByRole("menu") }
}

beforeEach(() => {
  setOrgs([PERSONAL, ACME])
  client.getMovePreview.mockReset()
})

describe("MoveToOrgMenuItem — eligibility (absent, never disabled)", () => {
  it("2 orgs + owner: ONE 'Move to Acme Legal…' menu item with the full name as its name", async () => {
    const { menu } = await renderInMenu(<MoveToOrgMenuItem kind="folder" itemId="f1" itemName="Q3 Contracts" owned />)
    const items = within(menu).getAllByRole("menuitem")
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent("Move to Acme Legal…")
    expect(items[0]).toHaveAccessibleName("Move to Acme Legal…")
    expect(items[0].querySelector("svg")).toHaveAttribute("aria-hidden", "true")
    expect(items[0].hasAttribute("aria-disabled")).toBe(false)
  })

  it("3 orgs: one item per other org, ordered by name, never the active org", async () => {
    setOrgs([PERSONAL, BETA, ACME])
    const { menu } = await renderInMenu(<MoveToOrgMenuItem kind="draft" itemId="d1" itemName="Contract review" owned />)
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Move to Acme Legal…",
      "Move to Beta Co…",
    ])
  })

  it("4+ orgs: collapses into ONE 'Move to another organization…'", async () => {
    setOrgs([PERSONAL, ACME, BETA, ZETA])
    const { menu } = await renderInMenu(<MoveToOrgMenuItem kind="folder" itemId="f1" itemName="Q3 Contracts" owned />)
    const items = within(menu).getAllByRole("menuitem")
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent("Move to another organization…")
  })

  it.each([
    ["a solo user", (): void => setOrgs([PERSONAL]), true],
    ["outside an OrgProvider", (): void => {
      org.value = null
    }, true],
    ["a non-owner", (): void => setOrgs([PERSONAL, ACME]), false],
  ] as const)("%s: absent", async (_label, arrange, owned) => {
    arrange()
    const { menu } = await renderInMenu(
      <>
        <MoveToOrgMenuItem kind="folder" itemId="f1" itemName="Q3 Contracts" owned={owned} />
        <span role="menuitem">Other</span>
      </>,
    )
    expect(within(menu).queryByText(/Move to/)).toBeNull()
  })

  it("choosing it opens the move for THAT item, tagged with the org it was opened in", async () => {
    const { user, menu } = await renderInMenu(<MoveToOrgMenuItem kind="folder" itemId="f1" itemName="Q3 Contracts" owned />)
    await user.click(within(menu).getByRole("menuitem", { name: "Move to Acme Legal…" }))
    expect(useOrgItemsStore.getState().moveRequest).toMatchObject({
      kind: "folder",
      itemId: "f1",
      itemName: "Q3 Contracts",
      targets: [ACME],
      openedIn: "A",
      holdsSelection: false,
    })
  })

  it("a folder whose SUBTREE holds the selected folder says so (the Library returns to Root)", async () => {
    const child: FolderNode = { id: "f2", user_id: "u", name: "Child", parent_id: "f1", is_org_shared: false, created_at: "", updated_at: "", children: [] }
    const node: FolderNode = { id: "f1", user_id: "u", name: "Q3 Contracts", parent_id: null, is_org_shared: false, created_at: "", updated_at: "", children: [child] }
    const { user, menu } = await renderInMenu(
      <MoveToOrgMenuItem kind="folder" itemId="f1" itemName="Q3 Contracts" owned subtree={node} selectedId="f2" />,
    )
    await user.click(within(menu).getByRole("menuitem", { name: "Move to Acme Legal…" }))
    expect(useOrgItemsStore.getState().moveRequest?.holdsSelection).toBe(true)
  })
})

function doc(over: Partial<Document> = {}): Document {
  return {
    id: "doc1",
    user_id: "u1",
    folder_id: null,
    filename: "MSA.pdf",
    is_latest: true,
    ...over,
  } as Document
}

describe("MoveToOrgButton — the Root document's move (detail panel)", () => {
  it("an owned latest Root document at 2 orgs: one outline 'Move to Acme Legal…' button", () => {
    render(<MoveToOrgButton document={doc()} currentUserId="u1" />)
    const b = screen.getByRole("button", { name: "Move to Acme Legal…" })
    expect(b.className).toContain("border")
    expect(b.className).not.toMatch(/destructive/)
  })

  it("4+ orgs: the collapsed 'Move to another organization…'", () => {
    setOrgs([PERSONAL, ACME, BETA, ZETA])
    render(<MoveToOrgButton document={doc()} currentUserId="u1" />)
    expect(screen.getByRole("button", { name: "Move to another organization…" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Move to Acme/ })).toBeNull()
  })

  it.each([
    ["in a folder", doc({ folder_id: "f1" }), "u1"],
    ["an earlier version", doc({ is_latest: false }), "u1"],
    ["someone else's", doc({ user_id: "u2" }), "u1"],
    ["with no signed-in id", doc(), undefined],
  ] as const)("%s: absent", (_label, d, uid) => {
    render(<MoveToOrgButton document={d} currentUserId={uid} />)
    expect(screen.queryByRole("button", { name: /Move to/ })).toBeNull()
  })

  it("a solo user: absent", () => {
    setOrgs([PERSONAL])
    render(<MoveToOrgButton document={doc()} currentUserId="u1" />)
    expect(screen.queryByRole("button", { name: /Move to/ })).toBeNull()
  })

  it("pressing it opens the sheet for this document (the preview is asked first)", async () => {
    client.getMovePreview.mockReturnValue(new Promise(() => {}))
    render(<MoveToOrgButton document={doc()} currentUserId="u1" />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Move to Acme Legal…" }))
    expect(await screen.findByText("Move to Acme Legal?")).toBeInTheDocument()
    expect(client.getMovePreview).toHaveBeenCalledWith("document", "doc1", "B")
  })
})
