/**
 * Phase 275 plan 02 Task 3 (S10 / D-14 / D-15 / D-17) — EVERY DELETE DOOR SHOWS THE SERVER'S REASON.
 *
 * ⛔ THE GAP. A held document is refused by the server with a 409 and a readable sentence. But the
 * three delete clients threw a bare `Error("Failed to delete …")`, so every door said
 * `Delete failed. Please try again.` — and "try again" is exactly the wrong advice for a legal hold.
 *
 * ⭐ THE CONTRACT, end to end — the REAL client runs against a stubbed `fetch`, so the chain under
 * test is `server 409 → ApiRefusal → the door's notice`, not a mock of the middle:
 *   · deleteDocument / deleteFolder / purgeWatchFiles reject with a typed `ApiRefusal`
 *     (status, title, message), never a bare Error — on a 409 AND on a 500;
 *   · the document delete dialog swaps its Delete buttons for the amber notice with ONE Close;
 *   · the folder inline confirm swaps its two buttons for the notice, and the folder stays;
 *   · the watch section shows the server's sentence in its existing error line.
 * Assertions read RENDERED WORDS (a presence assertion cannot see content drift).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
      refreshSession: vi.fn(),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    fetchDocumentVersions: vi.fn().mockResolvedValue([]),
    restoreDocumentVersion: vi.fn(),
    reingestDocument: vi.fn(),
    getDocumentDownloadUrl: vi.fn(),
    listConnectorConnections: vi.fn().mockResolvedValue([]),
  }
})

// Partial-actual: the section's READS are stubbed; `purgeWatchFiles` stays the REAL client.
vi.mock("@/lib/api/sources", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/sources")>("@/lib/api/sources")
  return {
    ...actual,
    listWatches: vi.fn(),
    listSyncRuns: vi.fn().mockResolvedValue([]),
    getSourceHealth: vi.fn().mockResolvedValue([]),
    getWatch: vi.fn(),
    triggerWatchSync: vi.fn(),
    updateWatch: vi.fn(),
    deleteWatch: vi.fn(),
    createWatch: vi.fn(),
  }
})

vi.mock("@/hooks/useFolders", () => ({
  useFolders: () => ({ folders: [{ id: "lib-folder-1", name: "Procurement Invoices", is_org_shared: false }] }),
}))

import { TooltipProvider } from "@/components/ui/tooltip"
import { ApiRefusal } from "@/lib/api/refusal"
import { deleteDocument, deleteFolder } from "@/lib/api/documents"
import * as sourcesApi from "@/lib/api/sources"
import { DocumentList } from "@/components/ingestion/DocumentList"
import { FolderNode } from "@/components/ingestion/FolderNode"
import { FolderTree } from "@/components/ingestion/FolderTree"
import { WatchedFoldersSection } from "@/components/sources/WatchedFoldersSection"
import type { Document, Folder } from "@/types"
import type { FolderNode as FolderNodeType } from "@/lib/folderTree"

const MEMBER_DOC = "This document is on legal hold. Ask an org admin if you think it should be released."
const FOLDER_SENTENCE = "This folder has 2 documents on legal hold. Nothing was deleted. Ask an org admin."
const PURGE_SENTENCE = "1 of this watch's missing files are on legal hold. Nothing was purged. Ask an org admin."

function holdResponse(message: string, heldCount: number | null = 1): Response {
  return new Response(
    JSON.stringify({ detail: { code: "legal_hold", title: "Can't delete.", message, held_count: heldCount } }),
    { status: 409, headers: { "Content-Type": "application/json" } },
  )
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("confirm", vi.fn(() => true))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ── the clients ──────────────────────────────────────────────────────────────────────────

describe("delete clients reject with a typed ApiRefusal", () => {
  it("deleteDocument: a 409 carries the server's title and sentence", async () => {
    fetchMock.mockResolvedValue(holdResponse(MEMBER_DOC))
    const err = await deleteDocument("d1").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiRefusal)
    expect((err as ApiRefusal).status).toBe(409)
    expect((err as ApiRefusal).title).toBe("Can't delete.")
    expect((err as ApiRefusal).message).toBe(MEMBER_DOC)
  })

  it("deleteDocument: a non-JSON 500 is an ApiRefusal with the old fallback, never a bare Error", async () => {
    fetchMock.mockResolvedValue(new Response("Internal Server Error", { status: 500 }))
    const err = await deleteDocument("d1", "all").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiRefusal)
    expect((err as ApiRefusal).status).toBe(500)
    expect((err as ApiRefusal).message).toBe("Failed to delete document")
  })

  it("deleteFolder: a 409 carries the folder sentence", async () => {
    fetchMock.mockResolvedValue(holdResponse(FOLDER_SENTENCE, 2))
    const err = await deleteFolder("f1").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiRefusal)
    expect((err as ApiRefusal).status).toBe(409)
    expect((err as ApiRefusal).message).toBe(FOLDER_SENTENCE)
  })

  it("deleteFolder: a non-JSON 500 is an ApiRefusal with the old fallback", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }))
    const err = await deleteFolder("f1").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiRefusal)
    expect((err as ApiRefusal).message).toBe("Failed to delete folder")
  })

  it("purgeWatchFiles: a 409 carries the purge sentence; a 500 is still typed", async () => {
    fetchMock.mockResolvedValueOnce(holdResponse(PURGE_SENTENCE))
    const err = await sourcesApi.purgeWatchFiles("w1").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiRefusal)
    expect((err as ApiRefusal).status).toBe(409)
    expect((err as ApiRefusal).message).toBe(PURGE_SENTENCE)

    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }))
    const err500 = await sourcesApi.purgeWatchFiles("w1").catch((e: unknown) => e)
    expect(err500).toBeInstanceOf(ApiRefusal)
    expect((err500 as ApiRefusal).status).toBe(500)
  })
})

// ── the document delete dialog ───────────────────────────────────────────────────────────

const DOC = {
  id: "d1",
  user_id: "user-1",
  folder_id: null,
  filename: "Acme MSA 2019.pdf",
  file_path: "user-1/acme.pdf",
  file_size: 2048,
  mime_type: "application/pdf",
  status: "completed",
  error_message: null,
  chunk_count: 3,
  content_hash: "h",
  metadata: {},
  created_at: "2024-02-10T12:00:00Z",
  updated_at: "2024-02-10T12:00:00Z",
  version_number: 1,
  is_latest: true,
} as unknown as Document

function renderList(onDelete: (id: string, scope?: "version" | "all") => Promise<void>) {
  return render(
    <TooltipProvider>
      <DocumentList documents={[DOC]} onDelete={onDelete} onRefresh={vi.fn()} currentUserId="user-1" />
    </TooltipProvider>,
  )
}

describe("DocumentList — the delete dialog shows the refusal", () => {
  it("a 409 replaces the Delete buttons with the amber notice and exactly one Close", async () => {
    fetchMock.mockResolvedValue(holdResponse(MEMBER_DOC))
    renderList((id, scope) => deleteDocument(id, scope))
    fireEvent.click(screen.getByRole("button", { name: "Delete document" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    const notice = await within(dialog).findByRole("alert")
    expect(notice).toHaveTextContent("Can't delete.")
    expect(notice).toHaveTextContent(MEMBER_DOC)
    expect(within(notice).getAllByRole("button")).toHaveLength(1)
    expect(within(notice).getByRole("button", { name: "Close" })).toBeInTheDocument()
    // no Delete button survives, and the generic failure never shows
    expect(within(dialog).queryByRole("button", { name: /^Delete/ })).toBeNull()
    expect(dialog).not.toHaveTextContent("Delete failed. Please try again.")

    fireEvent.click(within(notice).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("a non-409 failure still says Delete failed. Please try again.", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }))
    renderList((id, scope) => deleteDocument(id, scope))
    fireEvent.click(screen.getByRole("button", { name: "Delete document" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }))
    await waitFor(() => expect(dialog).toHaveTextContent("Delete failed. Please try again."))
    expect(within(dialog).queryByRole("alert")).toBeNull()
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeInTheDocument()
  })
})

// ── the folder inline confirm ────────────────────────────────────────────────────────────

function makeNode(): FolderNodeType {
  return {
    id: "f1",
    user_id: "user-1",
    name: "Contracts",
    parent_id: null,
    is_org_shared: false,
    created_at: "",
    updated_at: "",
    children: [],
  }
}

const nodeProps = {
  depth: 0,
  selectedFolderId: null,
  expandedIds: new Set<string>(),
  editingId: null,
  creatingInParentId: null,
  currentUserId: "user-1",
  onSelect: vi.fn(),
  onToggleExpand: vi.fn(),
  onStartRename: vi.fn(),
  onCommitRename: vi.fn(),
  onCancelRename: vi.fn(),
  onStartDelete: vi.fn(),
  onCreateSubfolder: vi.fn(),
  onCreateCommit: vi.fn(),
  onCreateCancel: vi.fn(),
  onToggleOrgShared: vi.fn(),
}

describe("FolderNode — the inline confirm shows the refusal", () => {
  it("a 409 replaces Delete + Cancel with the notice and one Close; the folder stays", async () => {
    fetchMock.mockResolvedValue(holdResponse(FOLDER_SENTENCE, 2))
    const onCancelDelete = vi.fn()
    render(
      <TooltipProvider>
        <FolderNode
          node={makeNode()}
          {...nodeProps}
          deletingId="f1"
          onConfirmDelete={(id) => deleteFolder(id)}
          onCancelDelete={onCancelDelete}
        />
      </TooltipProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    const notice = await screen.findByRole("alert")
    expect(notice).toHaveTextContent("Can't delete.")
    expect(notice).toHaveTextContent(FOLDER_SENTENCE)
    expect(within(notice).getAllByRole("button")).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull()
    expect(screen.getByText("Contracts")).toBeInTheDocument()

    fireEvent.click(within(notice).getByRole("button", { name: "Close" }))
    expect(onCancelDelete).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
  })
})

describe("FolderTree — keeps the confirm open so the refusal can be read", () => {
  it("Folder options → Delete → Delete shows the server's sentence in the tree", async () => {
    fetchMock.mockResolvedValue(holdResponse(FOLDER_SENTENCE, 2))
    const folders: Folder[] = [
      { id: "f1", user_id: "user-1", name: "Contracts", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
    ]
    const onDeleteFolder = vi.fn((id: string) => deleteFolder(id))
    render(
      <TooltipProvider>
        <FolderTree
          folders={folders}
          selectedFolderId={null}
          currentUserId="user-1"
          onSelectFolder={vi.fn()}
          onCreateFolder={vi.fn()}
          onRenameFolder={vi.fn()}
          onDeleteFolder={onDeleteFolder}
          onToggleOrgShared={vi.fn()}
        />
      </TooltipProvider>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Folder options" }))
    await user.click(await screen.findByRole("menuitem", { name: /Delete/ }))
    await user.click(screen.getByRole("button", { name: "Delete" }))
    const notice = await screen.findByRole("alert")
    expect(notice).toHaveTextContent(FOLDER_SENTENCE)
    expect(onDeleteFolder).toHaveBeenCalledWith("f1")
    expect(screen.getByText("Contracts")).toBeInTheDocument()
  })
})

// ── the watch section's purge ────────────────────────────────────────────────────────────

describe("WatchedFoldersSection — a refused purge shows the server's sentence", () => {
  it("the section's existing error line carries the 409 sentence, never the generic failure", async () => {
    const WATCH = {
      id: "watch-1",
      user_id: "user-1",
      connection_id: "conn-1",
      connection_name: "Google Drive (Finance)",
      service_id: "google",
      source_folder_id: "gdrive-fld-1",
      source_folder_name: "Q3 Vendor Bills",
      library_folder_id: "lib-folder-1",
      interval_minutes: 30,
      is_active: true,
      last_run_at: new Date(Date.now() - 4 * 60_000).toISOString(),
      last_status: "success",
      item_count: 14,
    }
    vi.mocked(sourcesApi.listWatches).mockResolvedValue([WATCH] as never)
    vi.mocked(sourcesApi.getWatch).mockResolvedValue({ ...WATCH, items: [] } as never)
    fetchMock.mockResolvedValue(holdResponse(PURGE_SENTENCE))

    render(<WatchedFoldersSection />)
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByText("Q3 Vendor Bills")).toBeInTheDocument())
    await user.click(screen.getAllByTestId("sources-source-line")[0].querySelector("button")!)
    await user.click(screen.getAllByRole("button", { name: /purge missing files/i })[0])

    await waitFor(() => expect(document.body).toHaveTextContent(PURGE_SENTENCE))
    expect(document.body).not.toHaveTextContent("Failed to purge missing files.")
  })
})
