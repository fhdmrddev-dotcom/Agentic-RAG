/**
 * Phase 117 Plan 04 Task 1 — RelationshipsSection a11y contract (SC#3 WCAG 2.1 AA).
 *
 * Asserts the NON-negotiable a11y contract locked by the fidelity audit:
 *  - no aXe AA violations across populated / empty / loading / error / masked;
 *  - loading is role="status", error is role="alert" (distinct from empty);
 *  - the remove ✕ carries an accessible name and is NOT hidden behind hover-only
 *    (the control is in the a11y tree, reachable; the coarse-pointer always-on rule
 *    lives in index.css — the audit's #1 fix);
 *  - opening the create dialog exposes the typeahead combobox roles
 *    (combobox + listbox + option + aria-activedescendant wiring).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import type { RelatedDocumentsResponse, Document } from "@/types"

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

const listRelationships = vi.fn<() => Promise<RelatedDocumentsResponse>>()
const deleteRelationship = vi.fn<() => Promise<void>>()
const createRelationship = vi.fn()
const listDocuments = vi.fn<() => Promise<Document[]>>()
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

const candidateDocs: Document[] = [
  {
    id: "doc-9",
    user_id: "user-1",
    folder_id: null,
    filename: "candidate.pdf",
    file_path: "u/doc-9/candidate.pdf",
    file_size: 1,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 1,
    content_hash: "h",
    metadata: null,
    created_at: "2026-06-20T00:00:00Z",
    updated_at: "2026-06-20T00:00:00Z",
  },
]

const populated: RelatedDocumentsResponse = {
  subject: { document_id: "doc-1", filename: "subject.pdf" },
  total: 2,
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
  listDocuments.mockResolvedValue(candidateDocs)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("RelationshipsSection a11y — WCAG 2.1 AA across states", () => {
  it("no aXe AA violations — populated (with a masked row)", async () => {
    const { container } = render(<RelationshipsSection docId="doc-1" />)
    await screen.findByText("old-policy.pdf")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe AA violations — empty", async () => {
    listRelationships.mockResolvedValueOnce({
      subject: { document_id: "doc-1", filename: "subject.pdf" },
      total: 0,
      documents: [],
    })
    const { container } = render(<RelationshipsSection docId="doc-1" />)
    await screen.findByText(/No relationships yet/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe AA violations — error", async () => {
    listRelationships.mockRejectedValueOnce(new Error("boom"))
    const { container } = render(<RelationshipsSection docId="doc-1" />)
    await screen.findByRole("alert")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("loading is role=status and error is role=alert (distinct)", async () => {
    let resolve!: (v: RelatedDocumentsResponse) => void
    listRelationships.mockReturnValueOnce(
      new Promise<RelatedDocumentsResponse>((r) => (resolve = r)),
    )
    const { container } = render(<RelationshipsSection docId="doc-1" />)
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
    resolve(populated)
    await screen.findByText("old-policy.pdf")
  })
})

describe("RelationshipsSection a11y — remove ✕ reachable + named", () => {
  it("the remove ✕ has an accessible name (icon-only control, not colour/hover alone)", async () => {
    render(<RelationshipsSection docId="doc-1" />)
    await screen.findByText("old-policy.pdf")
    const remove = screen.getByRole("button", {
      name: /remove supersedes link to old-policy.pdf/i,
    })
    // The control is in the a11y tree (queryable by role+name) — never hover-gated
    // out of it. The coarse-pointer always-on visual rule is in index.css.
    expect(remove).toBeVisible()
    // The masked row's remove is ALSO reachable.
    expect(
      screen.getByRole("button", { name: /remove amended by link to linked document \(no access\)/i }),
    ).toBeInTheDocument()
  })
})

describe("RelationshipsSection a11y — typeahead combobox roles (via the dialog)", () => {
  it("opening Add link exposes combobox + listbox + option + aria-activedescendant", async () => {
    const user = userEvent.setup()
    render(<RelationshipsSection docId="doc-1" filename="subject.pdf" />)
    await screen.findByText("old-policy.pdf")
    await user.click(screen.getByRole("button", { name: /add link/i }))

    const combobox = await screen.findByRole("combobox")
    expect(combobox).toHaveAttribute("aria-expanded")
    expect(combobox).toHaveAttribute("aria-controls")

    // The candidate listbox + options render.
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument())
    expect(screen.getByRole("option", { name: /candidate.pdf/i })).toBeInTheDocument()

    // Arrow-down sets aria-activedescendant on the input (highlighted option).
    combobox.focus()
    await user.keyboard("{ArrowDown}")
    await waitFor(() => expect(combobox).toHaveAttribute("aria-activedescendant"))
  })
})
