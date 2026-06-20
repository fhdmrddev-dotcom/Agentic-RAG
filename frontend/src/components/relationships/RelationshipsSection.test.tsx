/**
 * Phase 117 Plan 04 Task 1 — RelationshipsSection behavior tests.
 *
 * Asserts the load-bearing contract of the locked sketch + CONTEXT:
 *  - grouped render: Outgoing subgroup BEFORE Incoming, with correct inverse labels;
 *  - honest-states matrix: empty ≠ loading ≠ error, each a distinct render;
 *  - the masked "no access" row is present, is NOT an error/empty, never leaks an id;
 *  - re-fetch-after-mutation: a remove triggers a SECOND listRelationships call
 *    (no optimistic splice), and there is NO "Undo" control anywhere (D-117-9).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, within, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { RelatedDocumentsResponse } from "@/types"

// ── Mock Supabase auth so the real api.ts module-load never builds a real client. ──
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

// ── Partial-mock the api client: list/create/delete observable; everything else real. ──
const listRelationships = vi.fn<() => Promise<RelatedDocumentsResponse>>()
const deleteRelationship = vi.fn<() => Promise<void>>()
const createRelationship = vi.fn()
const listDocuments = vi.fn().mockResolvedValue([])
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listRelationships: (...a: unknown[]) => listRelationships(...(a as [])),
    deleteRelationship: (...a: unknown[]) => deleteRelationship(...(a as [])),
    createRelationship: (...a: unknown[]) => createRelationship(...(a as [])),
    listDocuments: (...a: unknown[]) => listDocuments(...(a as [])),
  }
})

import { RelationshipsSection } from "./RelationshipsSection"

const populated: RelatedDocumentsResponse = {
  subject: { document_id: "doc-1", filename: "subject.pdf" },
  total: 3,
  documents: [
    {
      document_id: "doc-2",
      filename: "old-policy.pdf",
      rel_type: "supersedes",
      direction: "outgoing",
      label: "supersedes",
      relationship_id: "rel-out-1",
    },
    {
      document_id: "doc-3",
      filename: "appendix.pdf",
      rel_type: "references",
      direction: "incoming",
      label: "referenced_by",
      relationship_id: "rel-in-1",
    },
    {
      // masked "no access" row — document_id null, mask string, still removable.
      document_id: null,
      filename: "linked document (no access)",
      rel_type: "amends",
      direction: "incoming",
      label: "amended_by",
      relationship_id: "rel-in-2",
    },
  ],
}

beforeEach(() => {
  listRelationships.mockResolvedValue(populated)
  deleteRelationship.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("RelationshipsSection — grouped render + inverse labels", () => {
  it("renders the Outgoing subgroup BEFORE the Incoming subgroup", async () => {
    render(<RelationshipsSection docId="doc-1" />)
    await screen.findByText("old-policy.pdf")
    const outgoing = screen.getByText("Outgoing")
    const incoming = screen.getByText("Incoming")
    // Outgoing appears earlier in DOM order than Incoming (fixed order — D-117-5).
    expect(outgoing.compareDocumentPosition(incoming) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("uses the verbatim verb for outgoing rows and the INVERSE label for incoming rows", async () => {
    render(<RelationshipsSection docId="doc-1" />)
    await screen.findByText("old-policy.pdf")
    // outgoing supersedes → "Supersedes"; incoming references → "Referenced by".
    expect(screen.getByText("Supersedes")).toBeInTheDocument()
    expect(screen.getByText("Referenced by")).toBeInTheDocument()
    // incoming amends → "Amended by" (on the masked row).
    expect(screen.getByText("Amended by")).toBeInTheDocument()
  })
})

describe("RelationshipsSection — honest states (empty ≠ loading ≠ error)", () => {
  it("loading is a role=status skeleton, not an error", async () => {
    // Hold the promise open to observe the loading state.
    let resolve!: (v: RelatedDocumentsResponse) => void
    listRelationships.mockReturnValueOnce(new Promise<RelatedDocumentsResponse>((r) => (resolve = r)))
    render(<RelationshipsSection docId="doc-1" />)
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    resolve(populated)
    await screen.findByText("old-policy.pdf")
  })

  it("empty renders 'No relationships yet' + an Add link affordance — NOT an error", async () => {
    listRelationships.mockResolvedValueOnce({
      subject: { document_id: "doc-1", filename: "subject.pdf" },
      total: 0,
      documents: [],
    })
    render(<RelationshipsSection docId="doc-1" />)
    expect(await screen.findByText(/No relationships yet/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /add link/i })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("error renders role=alert 'Couldn't load relationships' — distinct from empty", async () => {
    listRelationships.mockRejectedValueOnce(new Error("boom"))
    render(<RelationshipsSection docId="doc-1" />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(/load relationships/i)
    expect(screen.queryByText(/No relationships yet/i)).not.toBeInTheDocument()
  })
})

describe("RelationshipsSection — masked 'no access' row", () => {
  it("renders the mask string and never leaks an id, but stays removable", async () => {
    render(<RelationshipsSection docId="doc-1" />)
    await screen.findByText("linked document (no access)")
    // It is not an error/empty.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    // The masked row still carries a remove control (you own the edge — D-117-2).
    expect(
      screen.getByRole("button", { name: /remove amended by link to linked document \(no access\)/i }),
    ).toBeInTheDocument()
  })
})

describe("RelationshipsSection — re-fetch-not-optimistic + NO Undo (D-117-9)", () => {
  it("a remove re-fetches (second listRelationships call), never optimistically splices", async () => {
    const user = userEvent.setup()
    render(<RelationshipsSection docId="doc-1" />)
    await screen.findByText("old-policy.pdf")
    expect(listRelationships).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: /remove supersedes link to old-policy.pdf/i }))

    await waitFor(() => expect(deleteRelationship).toHaveBeenCalledWith("rel-out-1"))
    // The authoritative list is re-fetched after the mutation (not an optimistic splice).
    await waitFor(() => expect(listRelationships).toHaveBeenCalledTimes(2))
  })

  it("renders NO 'Undo' control anywhere (an Undo would lie about reversibility)", async () => {
    render(<RelationshipsSection docId="doc-1" />)
    await screen.findByText("old-policy.pdf")
    expect(screen.queryByText(/undo/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument()
  })

  it("the remove control carries an accessible name and lives within its row", async () => {
    render(<RelationshipsSection docId="doc-1" />)
    const row = (await screen.findByText("old-policy.pdf")).closest("li")
    expect(row).not.toBeNull()
    const remove = within(row as HTMLElement).getByRole("button", {
      name: /remove supersedes link to old-policy.pdf/i,
    })
    expect(remove).toHaveAttribute("aria-label")
  })
})
