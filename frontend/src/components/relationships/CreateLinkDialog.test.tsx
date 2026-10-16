/**
 * Phase 117 Plan 04 Task 2 — CreateLinkDialog behavior tests.
 *
 * Asserts the locked picker contract (sketch 035-A + D-117-4):
 *  - self (sourceDocId) is NEVER a candidate option;
 *  - a doc already linked OUTGOING with the chosen rel_type is excluded;
 *  - switching the rel-type chip RE-DERIVES the candidate set (the excluded doc
 *    re-appears under a different type — per-type exclusion);
 *  - confirm is disabled until a target is chosen;
 *  - an error from createRelationship renders the dialog error line.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Document, DocumentSearchRequest, DocumentSearchResponse, RelationshipRow } from "@/types"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

// 284-04 (D-15 / R-05): the dialog no longer downloads the library — it type-aheads against
// `POST /document-search`. The list client stays mocked so a regression back to it is SEEN
// (it must be called zero times); the search mock answers like the server: a name match, newest
// first, `limit` rows, and the exact `total`.
const listDocuments = vi.fn<() => Promise<Document[]>>()
const createRelationship = vi.fn()
const searchDocuments = vi.fn<(body: DocumentSearchRequest) => Promise<DocumentSearchResponse>>()
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listDocuments: (...a: unknown[]) => listDocuments(...(a as [])),
    createRelationship: (...a: unknown[]) => createRelationship(...(a as [])),
  }
})
vi.mock("@/lib/api/documents", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/documents")>("@/lib/api/documents")
  return { ...actual, searchDocuments: (body: DocumentSearchRequest) => searchDocuments(body) }
})

import { CreateLinkDialog } from "./CreateLinkDialog"
import { ApiError } from "@/lib/api"

/** The server's answer for `docs`: a case-insensitive name match, `limit` rows, exact total. */
function serverAnswer(all: Document[]) {
  return async (body: DocumentSearchRequest): Promise<DocumentSearchResponse> => {
    const q = (body.name ?? "").toLowerCase()
    const hits = all.filter((d) => d.filename.toLowerCase().includes(q))
    return {
      documents: hits.slice(body.offset, body.offset + body.limit).map((d) => ({
        ...d,
        version_count: 1,
        has_earlier: false,
        source_connection_name: null,
      })),
      total: hits.length,
      older_matches: 0,
      sort: body.sort,
      offset: body.offset,
      limit: body.limit,
    }
  }
}

const PICKER_BODY = {
  filter_expr: { op: "and", conditions: [] },
  name: null,
  version: "latest",
  sort: "added_desc",
  offset: 0,
  limit: 20,
  include_archived: true,
}

function mkDoc(id: string, filename: string): Document {
  return {
    id,
    user_id: "user-1",
    folder_id: null,
    filename,
    file_path: `u/${id}/${filename}`,
    file_size: 1,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 1,
    content_hash: "h",
    metadata: null,
    created_at: "2026-06-20T00:00:00Z",
    updated_at: "2026-06-20T00:00:00Z",
  }
}

const docs: Document[] = [
  mkDoc("doc-1", "subject.pdf"), // self
  mkDoc("doc-2", "already-superseded.pdf"), // already linked with supersedes
  mkDoc("doc-3", "free.pdf"),
]

// doc-2 is already linked OUTGOING with rel_type "supersedes".
const existingOutgoing: RelationshipRow[] = [
  {
    document_id: "doc-2",
    filename: "already-superseded.pdf",
    rel_type: "supersedes",
    direction: "outgoing",
    label: "supersedes",
    relationship_id: "rel-1",
  },
]

beforeEach(() => {
  listDocuments.mockResolvedValue(docs)
  searchDocuments.mockImplementation(serverAnswer(docs))
  createRelationship.mockResolvedValue({
    id: "new-rel",
    source_doc_id: "doc-1",
    target_doc_id: "doc-3",
    rel_type: "references",
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderDialog(overrides?: Partial<React.ComponentProps<typeof CreateLinkDialog>>) {
  const onCreated = vi.fn()
  const onClose = vi.fn()
  render(
    <CreateLinkDialog
      open
      sourceDocId="doc-1"
      sourceFilename="subject.pdf"
      existingOutgoing={existingOutgoing}
      onClose={onClose}
      onCreated={onCreated}
      {...overrides}
    />,
  )
  return { onCreated, onClose }
}

describe("CreateLinkDialog — candidate exclusion (D-117-4)", () => {
  it("never lists self (sourceDocId) as a candidate", async () => {
    renderDialog()
    await screen.findByRole("listbox")
    expect(screen.queryByRole("option", { name: /subject\.pdf/i })).not.toBeInTheDocument()
  })

  it("excludes a doc already linked OUTGOING with the chosen rel_type", async () => {
    renderDialog()
    await screen.findByRole("listbox")
    const user = userEvent.setup()
    // Default type is "references" — doc-2 (already-superseded) is NOT excluded yet.
    expect(screen.getByRole("option", { name: /already-superseded\.pdf/i })).toBeInTheDocument()
    // Switch to "Supersedes" — now doc-2 IS excluded (already linked with that type).
    await user.click(screen.getByRole("button", { name: /^supersedes$/i }))
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: /already-superseded\.pdf/i })).not.toBeInTheDocument(),
    )
    // free.pdf remains a valid candidate under Supersedes.
    expect(screen.getByRole("option", { name: /free\.pdf/i })).toBeInTheDocument()
  })

  it("switching the rel-type RE-OPENS an excluded doc as a candidate (per-type re-derive)", async () => {
    renderDialog()
    const user = userEvent.setup()
    await screen.findByRole("listbox")
    // Under Supersedes, doc-2 is excluded.
    await user.click(screen.getByRole("button", { name: /^supersedes$/i }))
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: /already-superseded\.pdf/i })).not.toBeInTheDocument(),
    )
    // Switch to References — doc-2 re-appears (not linked with THIS type).
    await user.click(screen.getByRole("button", { name: /^references$/i }))
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /already-superseded\.pdf/i })).toBeInTheDocument(),
    )
  })

  it("shows the honest per-type exclusion note when docs are hidden for the chosen type", async () => {
    renderDialog()
    const user = userEvent.setup()
    await screen.findByRole("listbox")
    await user.click(screen.getByRole("button", { name: /^supersedes$/i }))
    expect(await screen.findByText(/already linked with this type/i)).toBeInTheDocument()
  })
})

describe("CreateLinkDialog — confirm gating + create", () => {
  it("confirm is disabled until a target is chosen", async () => {
    renderDialog()
    await screen.findByRole("listbox")
    const confirm = screen.getByRole("button", { name: /add link/i })
    expect(confirm).toBeDisabled()
    const user = userEvent.setup()
    await user.click(screen.getByRole("option", { name: /free\.pdf/i }))
    await waitFor(() => expect(confirm).toBeEnabled())
  })

  it("confirm calls createRelationship(source, target, type) then onCreated", async () => {
    const { onCreated } = renderDialog()
    const user = userEvent.setup()
    await screen.findByRole("listbox")
    await user.click(screen.getByRole("option", { name: /free\.pdf/i }))
    await user.click(screen.getByRole("button", { name: /add link/i }))
    await waitFor(() =>
      expect(createRelationship).toHaveBeenCalledWith("doc-1", "doc-3", "references"),
    )
    expect(onCreated).toHaveBeenCalled()
  })
})

describe("CreateLinkDialog — error line (MoveToFolderDialog shape)", () => {
  it("renders the transient 'try again' line on a non-422 (network/5xx) failure", async () => {
    // A generic Error (no ApiError status) is the transient path → "try again".
    createRelationship.mockRejectedValueOnce(new Error("network"))
    const { onCreated } = renderDialog()
    const user = userEvent.setup()
    await screen.findByRole("listbox")
    await user.click(screen.getByRole("option", { name: /free\.pdf/i }))
    await user.click(screen.getByRole("button", { name: /add link/i }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(/action failed/i)
    expect(alert).toHaveTextContent(/try again/i)
    // The dialog did NOT report success on a failed create.
    expect(onCreated).not.toHaveBeenCalled()
  })

  it("renders a non-retry 'can't be created' line on a permanent 422 (WR-03)", async () => {
    // A 422 is a permanent rejection (self-link / unseeable / forged type) — the
    // dialog must NOT tell the user to "try again".
    createRelationship.mockRejectedValueOnce(new ApiError("Failed to create link", 422))
    const { onCreated } = renderDialog()
    const user = userEvent.setup()
    await screen.findByRole("listbox")
    await user.click(screen.getByRole("option", { name: /free\.pdf/i }))
    await user.click(screen.getByRole("button", { name: /add link/i }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(/can.t be created/i)
    // Crucially, a permanent rejection does NOT imply a retry.
    expect(alert).not.toHaveTextContent(/try again/i)
    expect(onCreated).not.toHaveBeenCalled()
  })
})

// ── 284-04 (D-15 / R-05 / UI-SPEC S11) — the picker searches on the server ─────────────────────
describe("CreateLinkDialog — server typeahead (284-04)", () => {
  it("opening issues ZERO list-client calls and ONE search: the 20 most recent, archived included", async () => {
    renderDialog()
    await screen.findByRole("option", { name: /free\.pdf/i })
    expect(listDocuments).not.toHaveBeenCalled()
    expect(searchDocuments).toHaveBeenCalledTimes(1)
    expect(searchDocuments).toHaveBeenCalledWith(PICKER_BODY)
  })

  it("typing searches by name after 250 ms, one call for a burst of keystrokes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderDialog()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await vi.advanceTimersByTimeAsync(260)
      expect(searchDocuments).toHaveBeenCalledTimes(1)
      await user.type(screen.getByRole("combobox"), "inv")
      await vi.advanceTimersByTimeAsync(200)
      expect(searchDocuments).toHaveBeenCalledTimes(1) // still inside the 250 ms window
      await vi.advanceTimersByTimeAsync(60)
      expect(searchDocuments).toHaveBeenCalledTimes(2)
      expect(searchDocuments).toHaveBeenLastCalledWith({ ...PICKER_BODY, name: "inv" })
    } finally {
      vi.useRealTimers()
    }
  })

  it("a slow earlier answer never overwrites a newer one", async () => {
    let releaseFirst!: () => void
    searchDocuments.mockImplementationOnce(
      (body) => new Promise((r) => (releaseFirst = () => r(serverAnswer(docs)(body) as never))),
    )
    renderDialog()
    const user = userEvent.setup()
    await waitFor(() => expect(searchDocuments).toHaveBeenCalledTimes(1))
    await user.type(screen.getByRole("combobox"), "free")
    expect(await screen.findByRole("option", { name: /free\.pdf/i })).toBeInTheDocument()
    releaseFirst() // the stale empty-query answer lands last
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByRole("option", { name: /already-superseded\.pdf/i })).not.toBeInTheDocument()
  })

  it("the chosen document stays chosen and named after a later search no longer returns it", async () => {
    renderDialog()
    const user = userEvent.setup()
    await user.click(await screen.findByRole("option", { name: /free\.pdf/i }))
    // Every later search answers nothing — the pick must survive as an OBJECT, not a lookup.
    searchDocuments.mockImplementation(serverAnswer([]))
    await waitFor(() => expect(searchDocuments).toHaveBeenLastCalledWith({ ...PICKER_BODY, name: "free.pdf" }))
    await waitFor(() => expect(screen.queryByRole("option", { name: /free\.pdf/i })).not.toBeInTheDocument())
    expect(screen.getByText(/→/)).toHaveTextContent("subject.pdf References → free.pdf")
    expect(screen.getByRole("button", { name: /add link/i })).toBeEnabled()
  })

  it("more matches than shown says so after the list", async () => {
    const many = Array.from({ length: 30 }, (_, i) => mkDoc(`m${i}`, `memo-${i}.pdf`))
    searchDocuments.mockImplementation(serverAnswer(many))
    renderDialog()
    await screen.findByRole("option", { name: "memo-0.pdf" })
    expect(screen.getAllByRole("option")).toHaveLength(20)
    expect(screen.getByRole("status")).toHaveTextContent(
      "More documents match. Type more of the name to narrow.",
    )
  })

  it("a failed search says so with Try again (never 'Could not load documents.'), and retries", async () => {
    searchDocuments.mockRejectedValueOnce(new Error("down"))
    renderDialog()
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn’t search documents.")
    expect(screen.queryByText("Could not load documents.")).toBeNull()
    await userEvent.setup().click(within(alert).getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("option", { name: /free\.pdf/i })).toBeInTheDocument()
    expect(searchDocuments).toHaveBeenCalledTimes(2)
  })
})
