/**
 * Phase 275 plan 04 Task 1 (S8 / D-17 / D-19 / D-21 / B-NEW-1) — the detail panel's Retention
 * section: one sentence per server state, the member's hold line, and the admin's Un-archive.
 *
 * Each case prices a lived failure:
 *   · a member shown a matter name, reason or placer (D-17) — fed a REAL member payload, which
 *     has no `hold_names` key at all, and the DOM is searched for any matter word;
 *   · an archived document whose sentence loses its policy's name once that policy is removed
 *     (B-NEW-1: the snapshot name is what renders);
 *   · Un-archive offered to someone the server did not allow (D-19), or a failure that says nothing;
 *   · the section reading retention on its own (planning flag 2: the state is a prop).
 * Assertions read RENDERED WORDS.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { Document } from "@/types"
import type { RetentionDocumentState } from "@/lib/api/retention"
import { ApiRefusal } from "@/lib/api/refusal"

const { mockUnarchive, mockGetDocumentStates } = vi.hoisted(() => ({
  mockUnarchive: vi.fn(),
  mockGetDocumentStates: vi.fn(),
}))

vi.mock("@/lib/api/retention", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/retention")>()
  return { ...actual, unarchiveDocument: mockUnarchive, getDocumentStates: mockGetDocumentStates }
})

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" }, access_token: "token" } } }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listMetadataFields: vi.fn().mockResolvedValue([]),
    listRelationships: vi.fn().mockResolvedValue({ subject: { document_id: "d", filename: "f" }, total: 0, documents: [] }),
    listDocuments: vi.fn().mockResolvedValue([]),
    getDocumentDownloadUrl: vi.fn(),
  }
})

import { RetentionSection } from "../RetentionSection"
import { DocumentDetailPanel } from "@/components/metadata/DocumentDetailPanel"

const DOC = {
  id: "doc-1", user_id: "user-1", folder_id: null, filename: "Halvorsen Supply Agreement.pdf",
  file_path: "u/doc-1/x.pdf", file_size: 1000, mime_type: "application/pdf", status: "completed",
  error_message: null, chunk_count: 3, content_hash: "h", metadata: {}, created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z", is_latest: true,
} as Document

function state(over: Partial<RetentionDocumentState>): RetentionDocumentState {
  return { document_id: "doc-1", held: false, archived: false, can_unarchive: false, section: { kind: "none" }, ...over }
}

const fmt = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso)
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  })
})

describe("RetentionSection — the hold (D-17)", () => {
  it("member: EXACTLY 'On legal hold. Ask an org admin.' then the second line — and no hold name anywhere", () => {
    // The real member payload shape: no `hold_names` key (response_model_exclude_none).
    const member = state({ held: true, chip: "on_hold", hold_line: "On legal hold. Ask an org admin.", section: { kind: "hold" } })
    expect("hold_names" in member).toBe(false)
    render(<RetentionSection doc={DOC} state={member} canManage={false} />)
    const section = screen.getByTestId("retention-section")
    const lines = within(section).getAllByText(/.+/, { selector: "p" }).map((p) => p.textContent)
    expect(lines).toEqual(["On legal hold. Ask an org admin.", "It can't be deleted until the hold is released."])
    expect(section.textContent).not.toMatch(/Halvorsen v\.|placed by|“/)
  })

  it("member: even a leaked hold_names value is never rendered on the member branch", () => {
    const leaked = state({ held: true, hold_names: ["Secret matter"], hold_line: "x", section: { kind: "hold" } })
    render(<RetentionSection doc={DOC} state={leaked} canManage={false} />)
    expect(screen.getByTestId("retention-section").textContent).not.toContain("Secret matter")
  })

  it("admin: the server's own hold line, naming the matter and the placer", () => {
    const line = "On legal hold — “Halvorsen v. Halden & Co.”, placed by Amira Sato on 3 Aug 2026. It can't be deleted or disposed of until the hold is released."
    render(<RetentionSection doc={DOC} state={state({ held: true, hold_line: line, hold_names: ["Halvorsen v. Halden & Co."], section: { kind: "hold" } })} canManage />)
    expect(screen.getByText(line)).toBeInTheDocument()
  })
})

describe("RetentionSection — one sentence per state (S8)", () => {
  const cases: Array<[string, RetentionDocumentState["section"], string]> = [
    ["delete pending", { kind: "delete_pending", policy_name: "Expired contracts", due_at: "2024-03-02" },
      `Due for deletion under “Expired contracts” since ${fmt("2024-03-02")}. Waiting for an org admin to approve.`],
    ["archives tonight", { kind: "archives_tonight", policy_name: "Finance invoices", due_at: "2024-11-20" },
      `Due under “Finance invoices” since ${fmt("2024-11-20")}: archived at tonight's sweep.`],
    ["in review", { kind: "in_review", policy_name: "Personnel records", due_at: "2024-02-01" },
      `Due under “Personnel records” since ${fmt("2024-02-01")}: listed for a person to decide.`],
    ["no date", { kind: "no_date", policy_name: "Finance invoices" },
      "“Finance invoices” counts from the document date, and this document has none, so nothing will happen to it. Set a document date to fix that."],
    ["disagree", { kind: "disagree", policy_name: "Finance invoices", other_policy_name: "All finance" },
      "“Finance invoices” and “All finance” disagree about this document, so nothing will happen to it until one of them changes."],
    ["kept", { kind: "kept", policy_name: "Expired contracts", kept_by: "Amira Sato", kept_at: "2026-10-12T10:00:00Z" },
      `Kept by Amira Sato on ${fmt("2026-10-12T10:00:00Z")} under “Expired contracts”. The policy skips it until the policy or the document changes.`],
    ["not due", { kind: "not_due", policy_name: "Finance invoices", due_at: "2032-04-08", rule_text: "Kept 7 years after the document date, then archived." },
      `Kept 7 years after the document date, then archived. Due ${fmt("2032-04-08")} (“Finance invoices”).`],
    ["none", { kind: "none" }, "No retention policy applies. It is kept until someone deletes it."],
  ]
  for (const [label, section, sentence] of cases) {
    it(`${label}`, () => {
      render(<RetentionSection doc={DOC} state={state({ section })} canManage />)
      expect(screen.getByTestId("retention-section")).toHaveTextContent(sentence)
    })
  }

  it("the source-state sentence renders BELOW the retention sentence (D-21)", () => {
    render(<RetentionSection doc={DOC} state={state({ source_chip: "deleted_at_source", section: { kind: "none" } })} canManage={false} />)
    const text = screen.getByTestId("retention-section").textContent ?? ""
    const retentionAt = text.indexOf("No retention policy applies.")
    const sourceAt = text.indexOf("Deleted at source. Chat no longer answers from it. It still opens and downloads here.")
    expect(retentionAt).toBeGreaterThanOrEqual(0)
    expect(sourceAt).toBeGreaterThan(retentionAt)
  })
})

describe("RetentionSection — archived, and Un-archive (B-NEW-1 / D-19)", () => {
  const archived = state({
    archived: true, chip: "archived", can_unarchive: true,
    section: { kind: "archived", policy_name: "Finance invoices (removed)", archived_at: "2026-09-14T02:00:00Z" },
  })

  it("names the policy from the SNAPSHOT — still readable after that policy is removed", () => {
    render(<RetentionSection doc={DOC} state={archived} canManage />)
    expect(screen.getByTestId("retention-section")).toHaveTextContent(
      `Archived ${fmt("2026-09-14T02:00:00Z")} by the “Finance invoices (removed)” policy. Chat no longer answers from it. It still opens, downloads and shows up with “Include archived”.`,
    )
  })

  it("no Un-archive button unless the server says can_unarchive", () => {
    render(<RetentionSection doc={DOC} state={{ ...archived, can_unarchive: false }} canManage={false} />)
    expect(screen.queryByRole("button", { name: "Un-archive" })).toBeNull()
  })

  it("success: the sentence turns and a ✎ receipt is recorded; the page is told to re-read", async () => {
    mockUnarchive.mockResolvedValue({ document_id: "doc-1", name: "x", policy_name: "Finance invoices", skip_written: true })
    const onUnarchived = vi.fn()
    render(<RetentionSection doc={DOC} state={archived} canManage onUnarchived={onUnarchived} />)
    await userEvent.click(screen.getByRole("button", { name: "Un-archive" }))
    expect(await screen.findByText("Un-archived by you just now. “Finance invoices” skips it until the policy or the document changes.")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("✎ Un-archived · recorded")
    expect(mockUnarchive).toHaveBeenCalledWith("doc-1")
    expect(onUnarchived).toHaveBeenCalledTimes(1)
  })

  it("failure: role=alert 'Couldn't un-archive. Nothing changed.' and no receipt", async () => {
    mockUnarchive.mockRejectedValue(new ApiRefusal(409, "", "Not archived."))
    render(<RetentionSection doc={DOC} state={archived} canManage />)
    await userEvent.click(screen.getByRole("button", { name: "Un-archive" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't un-archive. Nothing changed.")
    expect(screen.queryByRole("status")).toBeNull()
  })
})

describe("275-REVIEW IN-06 — copy edges in the section", () => {
  it("a keep whose actor is unknown reads 'a former member', never 'Kept by not recorded'", () => {
    render(<RetentionSection doc={DOC} state={state({ section: { kind: "kept", policy_name: "Expired contracts", kept_at: "2026-10-12T10:00:00Z" } })} canManage />)
    const section = screen.getByTestId("retention-section")
    expect(section).toHaveTextContent("Kept by a former member on")
    expect(section).not.toHaveTextContent("Kept by not recorded")
  })

  it("an admin whose hold line did not arrive gets the admin sentence, not the member's 'Ask an org admin.'", () => {
    render(<RetentionSection doc={DOC} state={state({ held: true, section: { kind: "hold" } })} canManage />)
    const section = screen.getByTestId("retention-section")
    expect(section).toHaveTextContent("This document is on legal hold. Release the hold in Org admin → Retention first.")
    expect(section).not.toHaveTextContent("Ask an org admin.")
  })
})

describe("275-REVIEW F-WR-06 — an un-archive in flight never lands on another document", () => {
  const archivedA = state({
    archived: true, chip: "archived", can_unarchive: true,
    section: { kind: "archived", policy_name: "Finance invoices", archived_at: "2026-09-14T02:00:00Z" },
  })
  const DOC_B = { ...DOC, id: "doc-2", filename: "Brightwater Office Lease.pdf" } as Document
  const stateB = state({ document_id: "doc-2", section: { kind: "none" } })

  it("success after switching to B: B shows no receipt; the page is still told to re-read", async () => {
    let resolve: (v: unknown) => void = () => {}
    mockUnarchive.mockImplementation(() => new Promise((r) => { resolve = r }))
    const onUnarchived = vi.fn()
    const { rerender } = render(<RetentionSection doc={DOC} state={archivedA} canManage onUnarchived={onUnarchived} />)
    await userEvent.click(screen.getByRole("button", { name: "Un-archive" }))
    rerender(<RetentionSection doc={DOC_B} state={stateB} canManage onUnarchived={onUnarchived} />)
    resolve({ document_id: "doc-1", name: "x", policy_name: "Finance invoices", skip_written: true })
    await waitFor(() => expect(onUnarchived).toHaveBeenCalledTimes(1)) // A WAS un-archived: re-read
    expect(screen.queryByText(/Un-archived by you just now/)).toBeNull()
    expect(screen.queryByRole("status")).toBeNull()
    expect(screen.getByTestId("retention-section")).toHaveTextContent("No retention policy applies.")
  })

  it("failure after switching to B: B shows no alert", async () => {
    let reject: (e: unknown) => void = () => {}
    mockUnarchive.mockImplementation(() => new Promise((_, r) => { reject = r }))
    const { rerender } = render(<RetentionSection doc={DOC} state={archivedA} canManage />)
    await userEvent.click(screen.getByRole("button", { name: "Un-archive" }))
    rerender(<RetentionSection doc={DOC_B} state={stateB} canManage />)
    reject(new Error("x"))
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole("alert")).toBeNull()
  })
})

describe("275-REVIEW F-WR-07 — a held document that is also archived says both", () => {
  const ARCHIVED_DOC = {
    ...DOC, archived_at: "2026-09-14T02:00:00Z", archived_policy_name: "Finance invoices",
  } as Document
  const heldArchived = (over: Partial<RetentionDocumentState> = {}) =>
    state({ held: true, archived: true, chip: "on_hold", can_unarchive: true, section: { kind: "hold" }, ...over })
  const archivedSentence = `Archived ${fmt("2026-09-14T02:00:00Z")} by the “Finance invoices” policy. Chat no longer answers from it. It still opens, downloads and shows up with “Include archived”.`

  it("admin: the hold line, then the archived sentence beneath it, and Un-archive is offered", () => {
    const line = "On legal hold — “Halvorsen v. Halden & Co.”, placed by Amira Sato on 3 Aug 2026. It can't be deleted or disposed of until the hold is released."
    render(<RetentionSection doc={ARCHIVED_DOC} state={heldArchived({ hold_line: line })} canManage />)
    const text = screen.getByTestId("retention-section").textContent ?? ""
    expect(text.indexOf(line)).toBeGreaterThanOrEqual(0)
    expect(text.indexOf(archivedSentence)).toBeGreaterThan(text.indexOf(line))
    expect(screen.getByRole("button", { name: "Un-archive" })).toBeInTheDocument()
  })

  it("member: the exact member lines, then the archived sentence; no button", () => {
    render(<RetentionSection doc={ARCHIVED_DOC} state={heldArchived({ can_unarchive: false })} canManage={false} />)
    const section = screen.getByTestId("retention-section")
    expect(section).toHaveTextContent("On legal hold. Ask an org admin.")
    expect(section).toHaveTextContent(archivedSentence)
    expect(screen.queryByRole("button", { name: "Un-archive" })).toBeNull()
  })
})

describe("DocumentDetailPanel — the Retention section sits directly after File and reads no state itself", () => {
  it("renders 'Retention' right after 'File', from the prop, without calling document-states", async () => {
    render(
      <DocumentDetailPanel
        doc={DOC}
        onClose={vi.fn()}
        retention={{ state: state({ section: { kind: "none" } }), canManage: false }}
      />,
    )
    await waitFor(() => expect(screen.getByText("No retention policy applies. It is kept until someone deletes it.")).toBeInTheDocument())
    const headings = screen.getAllByRole("button").map((b) => b.textContent ?? "")
    const fileAt = headings.findIndex((t) => t.startsWith("File"))
    const retentionAt = headings.findIndex((t) => t.startsWith("Retention"))
    expect(fileAt).toBeGreaterThanOrEqual(0)
    expect(retentionAt).toBe(fileAt + 1)
    expect(mockGetDocumentStates).not.toHaveBeenCalled()
  })

  it("no retention prop → no Retention section (other mounts unchanged)", () => {
    render(<DocumentDetailPanel doc={DOC} onClose={vi.fn()} />)
    expect(screen.queryByText("No retention policy applies. It is kept until someone deletes it.")).toBeNull()
  })
})
