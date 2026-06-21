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
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Document, RelationshipRow } from "@/types"

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

const listDocuments = vi.fn<() => Promise<Document[]>>()
const createRelationship = vi.fn()
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listDocuments: (...a: unknown[]) => listDocuments(...(a as [])),
    createRelationship: (...a: unknown[]) => createRelationship(...(a as [])),
  }
})

import { CreateLinkDialog } from "./CreateLinkDialog"
import { ApiError } from "@/lib/api"

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
