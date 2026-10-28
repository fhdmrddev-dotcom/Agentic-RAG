/**
 * Phase 298-05 (ORG-06 / D-19 / D-21 / D-31 / UI-D15 / UI-D19) — the move on its three homes, and
 * what happens after it.
 *
 *   · Library folder: the FolderNode ⋯ menu offers "Move to <Org>…" for an owned folder at 2+ orgs;
 *     the sheet opens from the tree's own elsewhere-line host (the menu's content unmounts).
 *   · Root document: the detail panel's header, beside Download; closing the moved sheet closes
 *     the panel (its own onClose).
 *   · Workflow draft: the card's ⋯ menu, drafts only — never a published or a starter row.
 *   · After the server's 200: the folder list, the Library page + summary and the drafts feed
 *     re-ask; the moved item stays on screen until THAT answer removes it (no optimistic vanish);
 *     a folder move whose subtree held the selection sends the Library back to Root.
 *
 * Driven through the real components and hooks; only the network is faked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

const org = vi.hoisted(() => ({
  value: null as null | { activeOrgId: string | null; orgs: { org_id: string; name: string; role: string }[]; switchOrg: () => void },
}))
vi.mock("@/providers/OrgProvider", () => ({ useOrgOptional: () => org.value }))

const client = vi.hoisted(() => ({ getMovePreview: vi.fn(), moveOrgItem: vi.fn(), getElsewhereCounts: vi.fn() }))
vi.mock("@/lib/api/orgItems", () => client)

const api = vi.hoisted(() => ({
  listFolders: vi.fn(),
  listMetadataFields: vi.fn(),
  listViews: vi.fn(),
  listRelationships: vi.fn(),
  listDocuments: vi.fn(),
  listPublishedWorkflows: vi.fn(),
  listStarterWorkflows: vi.fn(),
  listDraftWorkflows: vi.fn(),
}))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, ...api, deleteWorkflowDraft: vi.fn(), deleteWorkflowCascade: vi.fn(), getWorkflowDeletePreview: vi.fn() }
})
vi.mock("@/lib/api/experts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/experts")>()
  return { ...actual, listExpertInstalls: vi.fn().mockResolvedValue([]) }
})
vi.mock("@/lib/supabase", () => {
  const channel = { on: () => channel, subscribe: () => channel }
  return {
    supabase: {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" }, access_token: "t" } } }) },
      channel: () => channel,
      removeChannel: vi.fn(),
    },
  }
})

import { TooltipProvider } from "@/components/ui/tooltip"
import { FolderTree } from "@/components/ingestion/FolderTree"
import { useFolders } from "@/hooks/useFolders"
import { useLibraryOrgSwitch } from "@/hooks/useLibraryOrgSwitch"
import { useWorkflowLibraryFeeds } from "@/components/workflows/library/useWorkflowLibraryFeeds"
import { DocumentDetailPanel } from "@/components/metadata/DocumentDetailPanel"
import { WorkflowCard, type WorkflowCardProps } from "@/components/workflows/library/WorkflowCard"
import type { LibraryRow, Provenance } from "@/components/workflows/library/libraryRow"
import { OWN_SHARED, OWN_YOURS } from "@/components/workflows/library/libraryVocabulary"
import { ElsewhereLine } from "@/components/org/ElsewhereLine"
import { noteMoved } from "@/lib/elsewhereCounts"
import { setActiveOrgId } from "@/lib/api/_core"
import type { Document, Folder } from "@/types"
import type { MovePreview } from "@/lib/api/orgItems"

const PERSONAL = { org_id: "A", name: "Personal", role: "owner" }
const ACME = { org_id: "B", name: "Acme Legal", role: "member" }

function folder(id: string, name: string, over: Partial<Folder> = {}): Folder {
  return { id, user_id: "u1", name, parent_id: null, is_org_shared: false, created_at: "", updated_at: "", ...over }
}

function preview(kind: MovePreview["kind"], id: string, name: string, over: Partial<MovePreview["counts"]> = {}): MovePreview {
  return {
    kind,
    item_id: id,
    item_name: name,
    from_org: { id: "A", name: "Personal" },
    to_org: { id: "B", name: "Acme Legal" },
    counts: { subfolders: 0, documents: 3, earlier_versions: 0, past_runs: 0, ...over },
    refusals: [],
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const treeProps = {
  selectedFolderId: null,
  currentUserId: "u1",
  onSelectFolder: vi.fn(),
  onCreateFolder: vi.fn().mockResolvedValue({}),
  onRenameFolder: vi.fn().mockResolvedValue(undefined),
  onDeleteFolder: vi.fn().mockResolvedValue(undefined),
  onToggleOrgShared: vi.fn().mockResolvedValue(undefined),
}

async function openFolderMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  const row = screen.getByText(name).closest("[class*='group']") as HTMLElement | null
  const trigger = within(row ?? document.body).getAllByRole("button", { name: "Folder options" })[0]
  await user.click(trigger)
  return screen.findByRole("menu")
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
  client.getMovePreview.mockReset()
  client.moveOrgItem.mockReset()
  client.getElsewhereCounts.mockReset().mockResolvedValue([])
  api.listMetadataFields.mockResolvedValue([])
  api.listViews.mockResolvedValue([])
  api.listRelationships.mockResolvedValue({ subject: { document_id: "d", filename: "x" }, total: 0, documents: [] })
  api.listDocuments.mockResolvedValue([])
  api.listPublishedWorkflows.mockResolvedValue([])
  api.listStarterWorkflows.mockResolvedValue([])
  api.listDraftWorkflows.mockResolvedValue([])
  setActiveOrgId("A")
  org.value = { activeOrgId: "A", orgs: [PERSONAL, ACME], switchOrg: vi.fn() }
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

// ── Library folder ───────────────────────────────────────────────────────────────────────────
describe("the Library folder home (FolderNode ⋯ menu)", () => {
  it("an owned folder at 2 orgs offers 'Move to Acme Legal…' after Share, before Delete; the menu widens", async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <FolderTree {...treeProps} folders={[folder("f1", "Q3 Contracts")]} />
      </TooltipProvider>,
    )
    const menu = await openFolderMenu(user, "Q3 Contracts")
    const items = within(menu).getAllByRole("menuitem").map((i) => i.textContent)
    expect(items).toEqual(["Rename", "Share with org", "Move to Acme Legal…", "Delete"])
    expect(menu.className).toContain("has-[[data-move-item]]:w-56")
  })

  it("someone else's folder, and a solo user, are never offered it", async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <TooltipProvider>
        <FolderTree {...treeProps} folders={[folder("f1", "Shared one", { user_id: "u2" })]} />
      </TooltipProvider>,
    )
    let menu = await openFolderMenu(user, "Shared one")
    expect(within(menu).queryByText(/Move to/)).toBeNull()
    await user.keyboard("{Escape}")
    unmount()
    org.value = { activeOrgId: "A", orgs: [PERSONAL], switchOrg: vi.fn() }
    render(
      <TooltipProvider>
        <FolderTree {...treeProps} folders={[folder("f1", "Q3 Contracts")]} />
      </TooltipProvider>,
    )
    menu = await openFolderMenu(user, "Q3 Contracts")
    expect(within(menu).queryByText(/Move to/)).toBeNull()
  })

  it("choosing it opens the sheet for THAT folder (hosted by the tree's elsewhere line, outside the menu)", async () => {
    client.getMovePreview.mockResolvedValue(preview("folder", "f1", "Q3 Contracts", { subfolders: 2, documents: 14 }))
    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <FolderTree {...treeProps} folders={[folder("f1", "Q3 Contracts")]} />
      </TooltipProvider>,
    )
    const menu = await openFolderMenu(user, "Q3 Contracts")
    await user.click(within(menu).getByRole("menuitem", { name: "Move to Acme Legal…" }))
    expect(await screen.findByText("This folder, 2 subfolders and 14 documents move to Acme Legal.")).toBeInTheDocument()
    expect(screen.queryByRole("menu")).toBeNull()
    expect(client.getMovePreview).toHaveBeenCalledWith("folder", "f1", "B")
  })

  it("after the 200 the folder leaves the tree ONLY on the refetch's answer", async () => {
    const moved = folder("f1", "Q3 Contracts")
    const stays = folder("f2", "Stays")
    api.listFolders.mockResolvedValueOnce([moved, stays])
    const refetch = deferred<Folder[]>()
    api.listFolders.mockReturnValueOnce(refetch.promise)
    client.getMovePreview.mockResolvedValue(preview("folder", "f1", "Q3 Contracts"))
    client.moveOrgItem.mockResolvedValue(preview("folder", "f1", "Q3 Contracts"))
    function Harness() {
      const { folders, loading } = useFolders()
      return <FolderTree {...treeProps} folders={folders} loading={loading} />
    }
    const user = userEvent.setup()
    const { container } = render(
      <TooltipProvider>
        <Harness />
      </TooltipProvider>,
    )
    expect(await within(container).findByText("Q3 Contracts")).toBeInTheDocument()
    const menu = await openFolderMenu(user, "Q3 Contracts")
    await user.click(within(menu).getByRole("menuitem", { name: "Move to Acme Legal…" }))
    await user.click(await screen.findByRole("button", { name: "Move to Acme Legal" }))
    expect(await screen.findByText("Moved to Acme Legal · recorded")).toBeInTheDocument()
    await waitFor(() => expect(api.listFolders).toHaveBeenCalledTimes(2))
    // Re-asked, not yet answered: the row is still there (no optimistic vanish).
    expect(within(container).getByText("Q3 Contracts")).toBeInTheDocument()
    await act(async () => refetch.resolve([stays]))
    expect(within(container).queryByText("Q3 Contracts")).toBeNull()
    expect(within(container).getByText("Stays")).toBeInTheDocument()
  })
})

// ── Library selection reset ─────────────────────────────────────────────────────────────────
describe("useLibraryOrgSwitch — a move resets only what moved (UI-D19)", () => {
  it("a folder move whose subtree held the selection returns to Root and closes the panel", async () => {
    const dispatch = vi.fn()
    const setSelectedDocId = vi.fn()
    renderHook(() => useLibraryOrgSwitch({ dispatch, setSelectedDocId }))
    act(() => noteMoved({ kind: "folder", id: "f1", holdsSelection: true }))
    expect(dispatch).toHaveBeenCalledWith({ type: "SELECT_FOLDER", folderId: null })
    expect(setSelectedDocId).toHaveBeenCalledWith(null)
  })

  it("a folder move elsewhere in the tree, or a document move, leaves the selection alone", async () => {
    const dispatch = vi.fn()
    const setSelectedDocId = vi.fn()
    renderHook(() => useLibraryOrgSwitch({ dispatch, setSelectedDocId }))
    act(() => noteMoved({ kind: "folder", id: "f9", holdsSelection: false }))
    act(() => noteMoved({ kind: "document", id: "d1" }))
    act(() => noteMoved({ kind: "draft", id: "w1" }))
    expect(dispatch).not.toHaveBeenCalled()
    expect(setSelectedDocId).not.toHaveBeenCalled()
  })
})

// ── Root document ─────────────────────────────────────────────────────────────────────────────
function rootDoc(over: Partial<Document> = {}): Document {
  return {
    id: "doc-1",
    user_id: "u1",
    folder_id: null,
    filename: "MSA.pdf",
    file_path: "u1/doc-1/MSA.pdf",
    file_size: 100,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 1,
    content_hash: "h",
    metadata: {},
    is_latest: true,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...over,
  } as Document
}

describe("the Root document home (DocumentDetailPanel header)", () => {
  it("an owned latest Root document shows the button in the Download row; moved + Close closes the panel", async () => {
    client.getMovePreview.mockResolvedValue(preview("document", "doc-1", "MSA.pdf", { documents: 1, earlier_versions: 2 }))
    client.moveOrgItem.mockResolvedValue(preview("document", "doc-1", "MSA.pdf"))
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<DocumentDetailPanel doc={rootDoc()} onClose={onClose} currentUserId="u1" />)
    const button = screen.getByRole("button", { name: "Move to Acme Legal…" })
    const download = screen.getByRole("button", { name: /download/i })
    expect(button.closest(".pb-3")).toBe(download.closest(".pb-3"))
    await user.click(button)
    expect(await screen.findByText("“MSA.pdf” and its 2 earlier versions move to Acme Legal.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Move to Acme Legal" }))
    expect(await screen.findByText("Moved to Acme Legal · recorded")).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("a document in a folder, an earlier version, or someone else's: no button", () => {
    const { unmount } = render(<DocumentDetailPanel doc={rootDoc({ folder_id: "f1" })} onClose={vi.fn()} currentUserId="u1" />)
    expect(screen.queryByRole("button", { name: /Move to/ })).toBeNull()
    unmount()
    const b = render(<DocumentDetailPanel doc={rootDoc({ is_latest: false })} onClose={vi.fn()} currentUserId="u1" />)
    expect(screen.queryByRole("button", { name: /Move to/ })).toBeNull()
    b.unmount()
    render(<DocumentDetailPanel doc={rootDoc({ user_id: "u2" })} onClose={vi.fn()} currentUserId="u1" />)
    expect(screen.queryByRole("button", { name: /Move to/ })).toBeNull()
  })
})

// ── Workflow draft ───────────────────────────────────────────────────────────────────────────
const DEF = {
  slug: "contract-review",
  version: 1,
  inputs: [{ key: "kickoff_prompt" }],
  phases: [{ slug: "read", phase_index: 0, config: { phase_type: "llm_agent" } }],
}
const rowOf = (provenance: Provenance, over: Partial<LibraryRow> = {}): LibraryRow => ({
  id: `row-${provenance}`,
  slug: `contract-review-${provenance}`,
  name: "Contract review",
  version: 1,
  def: DEF as unknown as LibraryRow["def"],
  provenance,
  isMine: provenance === "starter" ? false : true,
  updatedAt: "2026-10-12T09:30:15Z",
  lastRunAt: undefined,
  lastRunStatus: undefined,
  hasAnyRun: undefined,
  source: { id: `row-${provenance}`, slug: `contract-review-${provenance}`, name: "Contract review" } as unknown as LibraryRow["source"],
  ...over,
})
const ROOT: Record<Provenance, string> = { published: "published-card", starter: "starter-card", draft: "draft-card" }

function renderCard(row: LibraryRow) {
  const props: WorkflowCardProps = {
    row,
    folderName: null,
    onRun: vi.fn(),
    onOpen: vi.fn(),
    onRunLog: vi.fn(),
    onSchedule: vi.fn(),
    onForkNewVersion: vi.fn(),
    onForkStarter: vi.fn(),
    onDeleted: vi.fn(),
    identity: { own: row.isMine === false ? OWN_SHARED : OWN_YOURS, segs: [], ofN: null, when: "changed 2 weeks ago" },
    now: Date.parse("2026-10-28T12:00:00Z"),
  }
  render(
    <>
      <ElsewhereLine kind="workflows" />
      <WorkflowCard {...props} />
    </>,
  )
  return screen.getByTestId(ROOT[row.provenance])
}

async function openCardMenu(card: HTMLElement) {
  const user = userEvent.setup()
  await user.click(within(card).getByRole("button", { name: /workflow actions/i }))
  return { user, menu: await screen.findByRole("menu") }
}

describe("the workflow draft home (WorkflowCardMenu)", () => {
  it("a draft offers it, as a menuitem (WR-03), and the sheet opens from the list's host", async () => {
    client.getMovePreview.mockResolvedValue(preview("draft", "row-draft", "Contract review", { documents: 0, past_runs: 3 }))
    const { user, menu } = await openCardMenu(renderCard(rowOf("draft")))
    const item = within(menu).getByRole("menuitem", { name: "Move to Acme Legal…" })
    const allowed = new Set(["menuitem", "menuitemradio", "menuitemcheckbox", "group", "separator"])
    for (const child of Array.from(menu.children)) expect(allowed.has(child.getAttribute("role") ?? "")).toBe(true)
    await user.click(item)
    expect(await screen.findByText("This draft moves to Acme Legal.")).toBeInTheDocument()
    expect(screen.getByText("Its 3 earlier runs stay in Personal.")).toBeInTheDocument()
    expect(client.getMovePreview).toHaveBeenCalledWith("draft", "row-draft", "B")
  })

  it.each(["published", "starter"] as const)("a %s row NEVER offers it (D-31)", async (provenance) => {
    const { menu } = await openCardMenu(renderCard(rowOf(provenance)))
    expect(within(menu).queryByText(/Move to/)).toBeNull()
  })
})

describe("useWorkflowLibraryFeeds — a move re-asks the drafts", () => {
  it("noteMoved re-reads the drafts feed (the moved draft leaves on that answer)", async () => {
    function useFeeds() {
      const [project] = useState<string | null>(null)
      return useWorkflowLibraryFeeds({ selectedProjectId: project })
    }
    renderHook(() => useFeeds())
    const before = api.listDraftWorkflows.mock.calls.length
    act(() => noteMoved({ kind: "draft", id: "row-draft" }))
    await waitFor(() => expect(api.listDraftWorkflows.mock.calls.length).toBe(before + 1))
  })
})
