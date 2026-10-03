/**
 * Phase 271-03 Task 3 (FIND-01 / D-07 / P-05 / P-09 / T-217-35) — the Find column set of the
 * shared document list.
 *
 * ⛔ THE SHED INVARIANT is the reason this suite exists: `LibraryPage`'s `SHED_COLUMNS_3_TO_5`
 * hides columns 3-5 BY POSITION when the detail panel opens, so Find must keep exactly seven
 * cells in a fixed order — chevron · Name · Document type · Added by · Date · Status · Actions —
 * and browse must render byte-identically to what shipped.
 *
 * Assertions read rendered TEXT and order (the 270 D-11 rule), never test ids.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"

import type { Document, DocumentSearchRow, Folder } from "@/types"
import documentRowSrc from "../DocumentRow.tsx?raw"

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

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    fetchDocumentVersions: vi.fn().mockResolvedValue([]),
    restoreDocumentVersion: vi.fn(),
    reingestDocument: vi.fn(),
    getDocumentDownloadUrl: vi.fn(),
  }
})

import { TooltipProvider } from "@/components/ui/tooltip"
import { DocumentList } from "../DocumentList"
import { hasVersions } from "../DocumentRow"

const folders: Folder[] = [
  { id: "f-contracts", user_id: "user-1", name: "Contracts", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
  { id: "f-2019", user_id: "user-1", name: "2019", parent_id: "f-contracts", is_org_shared: false, created_at: "", updated_at: "" },
]

function row(overrides: Partial<DocumentSearchRow> = {}): DocumentSearchRow {
  return {
    id: "d1",
    user_id: "user-1",
    folder_id: "f-2019",
    filename: "Acme MSA 2019.pdf",
    file_path: "user-1/acme.pdf",
    file_size: 2048,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 3,
    content_hash: "h",
    metadata: { document_type: "Contract", date: "2019-03-04" },
    created_at: "2024-02-10T12:00:00Z",
    updated_at: "2024-02-10T12:00:00Z",
    version_number: 2,
    is_latest: true,
    version_count: 2,
    has_earlier: true,
    ...overrides,
  }
}

const ADDED = { label: "Added", field: "created_at" } as const

function renderList(props: Partial<React.ComponentProps<typeof DocumentList>>) {
  return render(
    <TooltipProvider>
      <DocumentList
        documents={[row()]}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
        currentUserId="user-1"
        folders={folders}
        {...props}
      />
    </TooltipProvider>,
  )
}

function mainRows(): HTMLTableRowElement[] {
  return Array.from(document.querySelectorAll("table:not([data-version-history]) > tbody > tr"))
}

const SHORT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }

function shortDate(iso: string): string {
  // A date-only value is a calendar date, not an instant: it must not shift a day in a
  // timezone west of UTC, so the expectation builds it in LOCAL time (as the row must).
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso)
  return d.toLocaleDateString(undefined, SHORT)
}

afterEach(() => {
  cleanup()
})

describe("Find column set — seven cells, fixed order", () => {
  it("renders the seven Find headers, the Date header named by the active sort", () => {
    renderList({ columns: "find", findDateColumn: ADDED })
    const headers = Array.from(document.querySelectorAll("thead th")).map((th) => th.textContent)
    expect(headers).toEqual(["", "Name", "Document type", "Added by", "Added", "Status", "Actions"])
  })

  it("names another date column when the sort uses it", () => {
    renderList({
      columns: "find",
      findDateColumn: { label: "Modified in the file", field: "source_modified_at" },
    })
    expect(document.querySelectorAll("thead th")[4].textContent).toBe("Modified in the file")
  })

  it("every row has exactly seven <td> in find mode and in browse mode", () => {
    const docs = [row(), row({ id: "d2", is_latest: false, version_number: 1, version_count: 2 })]
    renderList({ documents: docs, columns: "find", findDateColumn: ADDED })
    expect(mainRows()).toHaveLength(2)
    for (const tr of mainRows()) expect(tr.querySelectorAll(":scope > td")).toHaveLength(7)
    cleanup()
    renderList({ documents: docs, folderId: undefined })
    expect(mainRows()).toHaveLength(2)
    for (const tr of mainRows()) expect(tr.querySelectorAll(":scope > td")).toHaveLength(7)
  })

  it("never re-filters Find rows by folder", () => {
    renderList({ columns: "find", findDateColumn: ADDED, folderId: undefined })
    expect(screen.getByText("Acme MSA 2019.pdf")).toBeInTheDocument()
    cleanup()
    // Even a folder id handed in by mistake cannot hide a cross-folder result.
    renderList({ columns: "find", findDateColumn: ADDED, folderId: "f-elsewhere" })
    expect(screen.getByText("Acme MSA 2019.pdf")).toBeInTheDocument()
  })
})

describe("Find row cells", () => {
  it("cells 3-5 read Document type, Added by and the Date (created_at)", () => {
    renderList({ columns: "find", findDateColumn: ADDED })
    const tds = mainRows()[0].querySelectorAll(":scope > td")
    expect(tds[2].textContent).toBe("Contract")
    expect(tds[3].textContent).toBe("You")
    expect(tds[4].textContent).toBe(shortDate("2024-02-10T12:00:00Z"))
    expect(tds[4].querySelector("time")?.getAttribute("dateTime")).toBe("2024-02-10T12:00:00Z")
  })

  it("Added by names a connection first", () => {
    renderList({
      documents: [row({ source_connection_id: "c1", source_connection_name: "Drive Finance" })],
      columns: "find",
      findDateColumn: ADDED,
    })
    expect(mainRows()[0].querySelectorAll(":scope > td")[3].textContent).toBe(
      "Drive Finance (connected source)",
    )
  })

  it("a missing document type and a missing date read 'not recorded' in italic — never 0, never a substitute", () => {
    renderList({
      documents: [row({ metadata: {}, source_modified_at: null })],
      columns: "find",
      findDateColumn: { label: "Modified in the file", field: "source_modified_at" },
    })
    const tds = mainRows()[0].querySelectorAll(":scope > td")
    for (const cell of [tds[2], tds[4]]) {
      const nr = within(cell as HTMLElement).getByText("not recorded")
      expect(nr.className).toContain("italic")
      expect(cell.textContent).not.toContain("0")
    }
    // The added date exists on the row and must NOT be substituted for the missing fact.
    expect(tds[4].textContent).not.toContain(shortDate("2024-02-10T12:00:00Z"))
  })

  it("the Date in the document column reads metadata.date", () => {
    renderList({
      columns: "find",
      findDateColumn: { label: "Date in the document", field: "document_date" },
    })
    expect(mainRows()[0].querySelectorAll(":scope > td")[4].textContent).toBe(shortDate("2019-03-04"))
  })
})

describe("the name cell's second line", () => {
  it("carries the folder path and the neutral history tag on a latest row", () => {
    renderList({ columns: "find", findDateColumn: ADDED })
    const nameCell = mainRows()[0].querySelectorAll(":scope > td")[1] as HTMLElement
    expect(within(nameCell).getByText("/Contracts/2019")).toBeInTheDocument()
    const tag = within(nameCell).getByText("v2 · 2 versions")
    expect(tag.className).toContain("border-border")
    expect(tag.className).toContain("text-muted-foreground")
    expect(tag.className).not.toContain("text-warning")
    // The shipped folder pill is replaced, not duplicated.
    expect(within(nameCell).queryByText("2019")).not.toBeInTheDocument()
  })

  it("reads 'Not in a folder' for a root document", () => {
    renderList({ documents: [row({ folder_id: null })], columns: "find", findDateColumn: ADDED })
    const nameCell = mainRows()[0].querySelectorAll(":scope > td")[1] as HTMLElement
    expect(within(nameCell).getByText("Not in a folder")).toBeInTheDocument()
  })

  it("marks an older version in warning", () => {
    renderList({
      documents: [row({ is_latest: false, version_number: 1, version_count: 2 })],
      columns: "find",
      findDateColumn: ADDED,
    })
    const nameCell = mainRows()[0].querySelectorAll(":scope > td")[1] as HTMLElement
    const tag = within(nameCell).getByText("v1 · older version")
    expect(tag.className).toContain("text-warning")
    expect(tag.className).toContain("border-warning/30")
  })

  it("a single-version latest row carries no tag", () => {
    renderList({
      documents: [row({ version_number: 1, version_count: 1, has_earlier: false })],
      columns: "find",
      findDateColumn: ADDED,
    })
    const nameCell = mainRows()[0].querySelectorAll(":scope > td")[1] as HTMLElement
    expect(nameCell.textContent).not.toMatch(/version/)
  })

  it("the second line sits in the name cell, which survives the 3-5 shed", () => {
    renderList({ columns: "find", findDateColumn: ADDED })
    const second = screen.getByText("/Contracts/2019").parentElement as HTMLElement
    expect(second.className).toContain("text-xs")
    expect(second.className).toContain("text-muted-foreground")
    expect(second.closest("td")).toBe(mainRows()[0].querySelectorAll(":scope > td")[1])
  })
})

describe("browse is unchanged", () => {
  it("columns absent and columns='browse' render byte-identical tables", () => {
    const docs: Document[] = [row(), row({ id: "d2", folder_id: null, version_number: 1 })]
    const a = renderList({ documents: docs, folderId: undefined })
    const htmlA = a.container.querySelector("table")?.outerHTML
    cleanup()
    const b = renderList({ documents: docs, folderId: undefined, columns: "browse" })
    const htmlB = b.container.querySelector("table")?.outerHTML
    expect(htmlA).toBeTruthy()
    expect(htmlB).toBe(htmlA)
  })

  it("browse still shows the shipped headers", () => {
    renderList({})
    const headers = Array.from(document.querySelectorAll("thead th")).map((th) => th.textContent)
    expect(headers).toEqual(["", "Filename", "Type", "Size", "Chunks", "Status", "Actions"])
  })
})

describe("P-05 — the chevron is unchanged", () => {
  it("hasVersions still reads version_number > 1", () => {
    expect(hasVersions(row({ version_number: 1, is_latest: false }))).toBe(false)
    expect(hasVersions(row({ version_number: 2 }))).toBe(true)
    expect(documentRowSrc).toContain("return (doc.version_number ?? 1) > 1")
  })

  it("an older v1 row has no chevron even though its lineage has two versions", () => {
    renderList({
      documents: [row({ is_latest: false, version_number: 1, version_count: 2 })],
      columns: "find",
      findDateColumn: ADDED,
    })
    expect(screen.queryByRole("button", { name: /version history/i })).not.toBeInTheDocument()
  })
})

// 271-VERIFICATION F-2 — POST /documents/{id}/reingest is latest-gated (404 on an older row,
// which the list only logged), and PATCH /documents/{id}/move moves ONE row out of its
// lineage's folder. So an older row offers neither, and says why in words. Delete stays:
// the version delete removes exactly that row and promotes nothing (documents.py:1855-1886).
describe("F-2 — an older-version row offers only what works on it", () => {
  it("an older row has no Re-ingest and no Move, says why in words, and keeps Download and Delete", () => {
    renderList({
      documents: [row({ id: "old", is_latest: false, version_number: 1, version_count: 2 })],
      columns: "find",
      findDateColumn: ADDED,
    })
    const actions = mainRows()[0].querySelectorAll("td")[6] as HTMLElement
    expect(within(actions).queryByRole("button", { name: "Re-ingest document" })).toBeNull()
    expect(within(actions).queryByRole("button", { name: "Move to folder" })).toBeNull()
    expect(actions).toHaveTextContent("Older version: re-ingest and move work on the latest")
    expect(within(actions).getByRole("button", { name: "Delete document" })).toBeInTheDocument()
    expect(within(actions).getByRole("button", { name: /Download/ })).toBeInTheDocument()
  })

  it("a latest row keeps every action and carries no older-version line", () => {
    renderList({ documents: [row()], columns: "find", findDateColumn: ADDED })
    const actions = mainRows()[0].querySelectorAll("td")[6] as HTMLElement
    expect(within(actions).getByRole("button", { name: "Re-ingest document" })).toBeInTheDocument()
    expect(within(actions).getByRole("button", { name: "Move to folder" })).toBeInTheDocument()
    expect(actions).not.toHaveTextContent("Older version")
  })
})
