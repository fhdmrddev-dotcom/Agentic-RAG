/**
 * Phase 275 plan 04 Task 1 (S6 / S7 / S9 / S10 / D-04 / D-17 / D-21 / planning flag 2) — what the
 * Library tells every reader about retention, driven through the REAL page.
 *
 * Each case prices a lived failure:
 *   · a row that shows three chips, or a chip for a calm document (absence is the calm state);
 *   · a member's folder line naming the matter (D-17);
 *   · archived rows mixed into browse with no way to see that they are hidden — or a browse
 *     toggle that disagrees with Find's `Include archived` chip (one state, D-04);
 *   · each component re-reading retention on its own (planning flag 2: ONE batched read);
 *   · a held document whose Delete opens the normal confirm and only fails after a click (S10).
 * Assertions read RENDERED WORDS — a presence assertion cannot see content drift.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TooltipProvider } from "@/components/ui/tooltip"
import type { Document, Folder } from "@/types"
import type { DocumentStatesResponse, RetentionDocumentState, RetentionFolderState } from "@/lib/api/retention"

const {
  mockUseDocuments,
  mockUseFolders,
  mockSearchDocuments,
  mockGetDocumentStates,
} = vi.hoisted(() => ({
  mockUseDocuments: vi.fn(),
  mockUseFolders: vi.fn(),
  mockSearchDocuments: vi.fn(),
  mockGetDocumentStates: vi.fn(),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    listViews: vi.fn().mockResolvedValue([]),
    resolveView: vi.fn().mockResolvedValue({ documents: [], total: 0 }),
    resolveAdHoc: vi.fn().mockResolvedValue({ documents: [], total: 0 }),
    resolveFilterCount: vi.fn().mockResolvedValue(0),
    listMetadataFields: vi.fn().mockResolvedValue([]),
    getReembedProgress: vi.fn().mockResolvedValue({
      status: "idle", total: 0, re_embedded: 0, remaining: 0, model: "m", updated_at: null,
    }),
    getIndexSummary: vi.fn().mockResolvedValue({
      vectors: 0, chunks_total: 0, documents_without_vectors: 0, last_indexed: null, model: "m",
      dimensions: 1536, provider: "openai", folders: [],
    }),
    getHealthOverview: vi.fn().mockResolvedValue({
      total_documents: 1, retrieved_this_month: 1, never_retrieved_count: 0, high_confidence_rate: 0.9,
    }),
    getRetrievalTrend: vi.fn().mockResolvedValue([]),
    getNeverRetrieved: vi.fn().mockResolvedValue([]),
    getLowConfidenceQueries: vi.fn().mockResolvedValue([]),
    getStaleDocs: vi.fn().mockResolvedValue([]),
    getGovBroken: vi.fn().mockResolvedValue([]),
    getGovUnclassified: vi.fn().mockResolvedValue([]),
    getGovLowConfidence: vi.fn().mockResolvedValue([]),
    listCheckedQueries: vi.fn().mockResolvedValue([]),
    listConnectorConnections: vi.fn().mockResolvedValue([]),
    fetchDocumentVersions: vi.fn().mockResolvedValue([]),
  }
})

vi.mock("@/lib/api/documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/documents")>()
  return { ...actual, searchDocuments: mockSearchDocuments }
})

// Partial actual: the client's types and ApiRefusal stay real; only the batched read is stubbed.
vi.mock("@/lib/api/retention", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/retention")>()
  return { ...actual, getDocumentStates: mockGetDocumentStates }
})

vi.mock("@/lib/api/sources", () => ({
  listWatches: vi.fn().mockResolvedValue([]),
  getWatch: vi.fn().mockResolvedValue(null),
  createWatch: vi.fn(),
  updateWatch: vi.fn(),
  deleteWatch: vi.fn(),
  triggerWatchSync: vi.fn(),
  purgeWatchFiles: vi.fn(),
  listSyncRuns: vi.fn().mockResolvedValue([]),
  getSourceHealth: vi.fn().mockResolvedValue({ stopped: [], reader_running: true, poll_interval_seconds: 60 }),
}))

vi.mock("@/hooks/useDocuments", () => ({ useDocuments: mockUseDocuments }))
vi.mock("@/hooks/useFolders", () => ({ useFolders: mockUseFolders }))

vi.mock("@/components/metadata/DocumentDetailPanel", () => ({
  DocumentDetailPanel: ({ doc }: { doc: Document }) => <aside aria-label="Document details">{`panel:${doc.filename}`}</aside>,
}))

vi.mock("@/lib/supabase", () => ({
  SUPABASE_CLIENT_REHYDRATED: "supabase:client-rehydrated",
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
    removeChannel: vi.fn(),
  },
}))

import { LibraryPage } from "@/pages/LibraryPage"
import { RetentionRowChips } from "../RetentionChip"
import { RetentionFolderLine } from "../RetentionFolderLine"

beforeEach(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

const FOLDERS: Folder[] = [
  {
    id: "folder-1", user_id: "user-1", name: "Contracts", parent_id: null, is_org_shared: false,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  },
]

function doc(over: Partial<Document>): Document {
  return {
    id: "doc-1", user_id: "user-1", folder_id: null, filename: "x.pdf", file_path: "/uploads/x.pdf",
    file_size: 1024, mime_type: "application/pdf", status: "completed", error_message: null,
    chunk_count: 10, content_hash: "abc", metadata: { document_type: "Contract" },
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...over,
  } as Document
}

const HELD = doc({ id: "doc-held", filename: "Halvorsen Supply Agreement.pdf" })
const PLAIN = doc({ id: "doc-plain", filename: "Atlas kickoff deck.pdf" })
const ARCHIVED = doc({
  id: "doc-arch", filename: "Invoice INV-0412.pdf", archived_at: "2026-09-14T02:00:00Z",
  archived_policy_name: "Finance invoices",
})

function state(over: Partial<RetentionDocumentState> & { document_id: string }): RetentionDocumentState {
  return { held: false, archived: false, can_unarchive: false, section: { kind: "none" }, ...over }
}

const MEMBER_STATES: DocumentStatesResponse = {
  documents: [
    // A MEMBER payload: held, with the member line and NO hold_names key (D-17).
    state({ document_id: "doc-held", chip: "on_hold", held: true, hold_line: "On legal hold. Ask an org admin.", section: { kind: "hold" } }),
    state({ document_id: "doc-plain", section: { kind: "not_due", policy_name: "Contracts", due_at: "2030-01-01", rule_text: "Kept 10 years after the document date, then archived." } }),
  ],
  folders: [],
  can_manage: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseDocuments.mockReturnValue({
    documents: [HELD, PLAIN, ARCHIVED],
    uploading: false,
    uploadingCount: 0,
    upload: vi.fn().mockResolvedValue({ isDuplicate: false }),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    loadDocuments: vi.fn().mockResolvedValue(undefined),
  })
  mockUseFolders.mockReturnValue({
    folders: FOLDERS,
    createFolder: vi.fn(), renameFolder: vi.fn(), deleteFolder: vi.fn(), toggleOrgShared: vi.fn(),
  })
  mockSearchDocuments.mockResolvedValue({ documents: [], total: 0, older_matches: 0 })
  mockGetDocumentStates.mockResolvedValue(MEMBER_STATES)
})

function renderPage() {
  return render(
    <TooltipProvider>
      <LibraryPage onAskInChat={vi.fn()} />
    </TooltipProvider>,
  )
}

const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement

// ── S6: the row chips ─────────────────────────────────────────────────────────────────────────

describe("RetentionRowChips — at most one retention chip and one source chip (S6 / D-21)", () => {
  it("renders the server's chip word and its source chip, and nothing more", () => {
    render(<RetentionRowChips state={state({ document_id: "d", chip: "on_hold", source_chip: "deleted_at_source", held: true })} />)
    const chips = screen.getAllByTestId("retention-chip")
    expect(chips).toHaveLength(2)
    expect(chips[0]).toHaveTextContent("On hold")
    expect(chips[1]).toHaveTextContent("Deleted at source")
  })

  it("every server chip value maps to its UI-SPEC word", () => {
    const words: Array<[RetentionDocumentState["chip"], string]> = [
      ["on_hold", "On hold"], ["archived", "Archived"], ["delete_pending", "Delete pending"],
      ["archives_tonight", "Archives tonight"], ["in_review", "In review"],
      ["policies_disagree", "Policies disagree"], ["no_date", "No date"],
    ]
    for (const [chip, word] of words) {
      const { unmount } = render(<RetentionRowChips state={state({ document_id: "d", chip })} />)
      expect(screen.getByTestId("retention-chip")).toHaveTextContent(word)
      unmount()
    }
    for (const [source, word] of [
      ["deleted_at_source", "Deleted at source"], ["no_longer_shared", "No longer shared at source"],
      ["source_disconnected", "Source disconnected"],
    ] as const) {
      const { unmount } = render(<RetentionRowChips state={state({ document_id: "d", source_chip: source })} />)
      expect(screen.getByTestId("retention-chip")).toHaveTextContent(word)
      unmount()
    }
  })

  it("absence is the calm state: no state, or a state with no chip, renders nothing", () => {
    const { container, rerender } = render(<RetentionRowChips state={undefined} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<RetentionRowChips state={state({ document_id: "d", section: { kind: "not_due" } })} />)
    expect(container).toBeEmptyDOMElement()
  })
})

// ── S7: the folder line ───────────────────────────────────────────────────────────────────────

describe("RetentionFolderLine — the selected folder's policy and hold (S7 / D-17 / D-23)", () => {
  const OWN: RetentionFolderState = {
    folder_id: "f", held: true, hold_names: ["Halvorsen v. Halden & Co."],
    policy: {
      kind: "own", policy_id: "p", policy_name: "Finance invoices", action: "archive",
      kept_for_text: "7 years after the document date", rule_text: "",
    },
  }

  it("admin: the policy sentence, the Archive tag and the hold line naming the matter", () => {
    render(<RetentionFolderLine state={OWN} canManage />)
    const line = screen.getByTestId("retention-folder-line")
    expect(line).toHaveTextContent("This folder: kept 7 years after the document date, then archived.")
    expect(line).toHaveTextContent("Everything in this folder is on legal hold — Halvorsen v. Halden & Co.")
    expect(within(line).getByText("Archive")).toBeInTheDocument()
  })

  it("member: the hold line is EXACTLY the D-17 sentence and names no matter", () => {
    const member: RetentionFolderState = { folder_id: "f", held: true }
    render(<RetentionFolderLine state={member} canManage={false} />)
    const line = screen.getByTestId("retention-folder-line")
    expect(within(line).getByText("Everything in this folder is on legal hold.")).toBeInTheDocument()
    expect(line.textContent).not.toContain("—")
  })

  it("an inherited policy names where it comes from (D-23); a delete policy says who approves", () => {
    render(
      <RetentionFolderLine
        canManage
        state={{
          folder_id: "f", held: false,
          policy: {
            kind: "inherited", policy_id: "p", policy_name: "Expired contracts", action: "delete",
            kept_for_text: "10 years after the document date", rule_text: "", from_folder_path: "/Contracts",
          },
        }}
      />,
    )
    expect(screen.getByTestId("retention-folder-line")).toHaveTextContent(
      "This folder: kept 10 years after the document date, then deleted after an admin approves. (from “Expired contracts” on /Contracts)",
    )
  })

  it("renders nothing for a folder with no policy and no hold", () => {
    const { container } = render(<RetentionFolderLine state={{ folder_id: "f", held: false }} canManage />)
    expect(container).toBeEmptyDOMElement()
  })
})

// ── the page: one read, the hidden line, the shared toggle, the pre-open refusal ──────────────

describe("LibraryPage — retention in browse (S9 / S10 / planning flag 2)", () => {
  it("issues ONE batched document-states read for the visible rows and threads the chip into the row", async () => {
    renderPage()
    await waitFor(() => expect(within(rowOf("Halvorsen Supply Agreement.pdf")).getByText("On hold")).toBeInTheDocument())
    expect(mockGetDocumentStates).toHaveBeenCalledTimes(1)
    const body = mockGetDocumentStates.mock.calls[0][0] as { document_ids: string[]; folder_ids: string[] }
    expect([...body.document_ids].sort()).toEqual(["doc-held", "doc-plain"])
    expect(body.folder_ids).toEqual([])
    // The calm row carries no chip.
    expect(within(rowOf("Atlas kickoff deck.pdf")).queryByTestId("retention-chip")).toBeNull()
  })

  it("hides archived rows behind '1 archived document hidden · Show', and Show is the SAME state as Find's chip", async () => {
    renderPage()
    expect(screen.queryByText("Invoice INV-0412.pdf")).toBeNull()
    const line = screen.getByTestId("archived-hidden-line")
    expect(line).toHaveTextContent("1 archived document hidden · Show")
    expect(screen.getByRole("button", { name: "Include archived" })).toBeInTheDocument()

    await userEvent.click(within(line).getByRole("button", { name: "Show" }))
    expect(screen.getByText("Invoice INV-0412.pdf")).toBeInTheDocument()
    expect(screen.getByTestId("archived-hidden-line")).toHaveTextContent("Showing 1 archived document · Hide")
    // ONE state: Find's chip flipped with it.
    expect(screen.getByText("Archived: included")).toBeInTheDocument()

    await userEvent.click(within(screen.getByTestId("archived-hidden-line")).getByRole("button", { name: "Hide" }))
    expect(screen.queryByText("Invoice INV-0412.pdf")).toBeNull()
    expect(screen.getByRole("button", { name: "Include archived" })).toBeInTheDocument()
  })

  it("a held document's Delete opens straight into the refusal — the member sentence, one Close, no Delete", async () => {
    renderPage()
    const row = rowOf("Halvorsen Supply Agreement.pdf")
    await waitFor(() => expect(within(row).getByText("On hold")).toBeInTheDocument())
    await userEvent.click(within(row).getByRole("button", { name: "Delete document" }))
    const dialog = await screen.findByRole("dialog")
    const alert = within(dialog).getByRole("alert")
    expect(alert).toHaveTextContent(
      "Can't delete. This document is on legal hold. Ask an org admin if you think it should be released.",
    )
    // ONE Close inside the refusal (the dialog's own ✕ is the shipped shell, not the notice).
    expect(within(alert).getAllByRole("button")).toHaveLength(1)
    expect(within(alert).getByRole("button", { name: "Close" })).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: /^Delete$/ })).toBeNull()
  })

  it("a calm document's Delete still opens the normal confirm", async () => {
    renderPage()
    const row = rowOf("Atlas kickoff deck.pdf")
    await waitFor(() => expect(mockGetDocumentStates).toHaveBeenCalled())
    await userEvent.click(within(row).getByRole("button", { name: "Delete document" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).queryByRole("alert")).toBeNull()
    expect(within(dialog).getByRole("button", { name: /^Delete$/ })).toBeInTheDocument()
  })

  it("a failed read keeps the page usable and invents no chip", async () => {
    mockGetDocumentStates.mockRejectedValue(new Error("boom"))
    renderPage()
    await waitFor(() => expect(mockGetDocumentStates).toHaveBeenCalled())
    expect(screen.getByText("Halvorsen Supply Agreement.pdf")).toBeInTheDocument()
    expect(screen.queryAllByTestId("retention-chip")).toHaveLength(0)
  })
})
