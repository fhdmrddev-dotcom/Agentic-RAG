/**
 * Phase 271-04 (D-04 / D-06 / D-07 / P-10) — the six structure editors behind Find's quick-add
 * chips. Each editor sets EXACTLY ONE condition; these cases assert the condition each one
 * emits, word for word, so a chip can never look set while sending something else (T-271-15).
 */
import type { ReactElement } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"
import type { DocumentSearchRequest, DocumentSearchResponse } from "@/types"

// 284-04 (D-15 / R-05 / UI-SPEC S12): the Relationship editor type-aheads against
// POST /document-search instead of reading the page's documents. The mock answers like the server:
// latest versions only for version "latest", a case-insensitive name match, `limit` rows, exact total.
const m = vi.hoisted(() => ({ searchDocuments: vi.fn() }))
vi.mock("@/lib/api/documents", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/documents")>("@/lib/api/documents")
  return { ...actual, searchDocuments: m.searchDocuments }
})

function answerFrom(pool: readonly Document[]) {
  return async (body: DocumentSearchRequest): Promise<DocumentSearchResponse> => {
    const q = (body.name ?? "").toLowerCase()
    const hits = pool
      .filter((d) => (body.version === "latest" ? d.is_latest !== false : true))
      .filter((d) => d.filename.toLowerCase().includes(q))
    return {
      documents: hits.slice(body.offset, body.offset + body.limit).map((d) => ({ ...d, version_count: 1, has_earlier: false })),
      total: hits.length,
      older_matches: 0,
      sort: body.sort,
      offset: body.offset,
      limit: body.limit,
    }
  }
}
import {
  AddedByEditor,
  DateEditor,
  DocumentTypeEditor,
  FolderEditor,
  RelationshipEditor,
  VersionEditor,
} from "@/components/library/find/StructurePopovers"
import { RELATIONSHIP_FILTER_VERBS } from "@/components/relationships/relationshipLabels"
import { summarizeDocuments } from "@/hooks/useLibraryDocuments"
import type { Document, Folder } from "@/types"

function doc(over: Partial<Document>): Document {
  return {
    id: "d",
    user_id: "u1",
    folder_id: null,
    filename: "f.pdf",
    file_path: "p",
    file_size: 1,
    mime_type: "application/pdf",
    status: "completed",
    created_at: "2024-02-10T10:00:00Z",
    updated_at: "2024-02-10T10:00:00Z",
    ...over,
  } as Document
}

function folder(id: string, name: string, parent_id: string | null = null): Folder {
  return {
    id,
    user_id: "u1",
    name,
    parent_id,
    is_org_shared: false,
    created_at: "",
    updated_at: "",
  }
}

const DOCS: Document[] = [
  doc({ id: "a", filename: "Acme MSA 2019.pdf", metadata: { document_type: "Contract" } as Document["metadata"] }),
  doc({ id: "b", filename: "Acme MSA 2021.pdf", metadata: { document_type: "Contract" } as Document["metadata"] }),
  doc({ id: "c", filename: "Board memo.docx", metadata: { document_type: "Memo" } as Document["metadata"] }),
  doc({ id: "old", filename: "Acme MSA 2019 (old).pdf", is_latest: false, version_number: 1 }),
  doc({
    id: "s1",
    filename: "Drive file.pdf",
    source_connection_id: "conn-1",
    source_connection_name: "Drive Finance",
  }),
  doc({
    id: "s2",
    filename: "Drive file 2.pdf",
    source_connection_id: "conn-1",
    source_connection_name: "Drive Finance",
  }),
]

// 284-01 (D-07 / R-03): Added by and Document type read the SUMMARY lists, not the documents.
// Derived from the same DOCS through `summarizeDocuments`, so every assertion below keeps its intent.
const SUMMARY = summarizeDocuments(DOCS)

beforeEach(() => {
  m.searchDocuments.mockReset()
  m.searchDocuments.mockImplementation(answerFrom(DOCS))
})

const SHELL = "w-72 rounded-lg border border-border bg-popover p-3 shadow-md space-y-3"

describe("every editor shares the shipped popover idiom", () => {
  const cases: Array<[string, (onCancel: () => void) => ReactElement]> = [
    ["Version", (c) => <VersionEditor onApply={vi.fn()} onCancel={c} />],
    ["Relationship", (c) => <RelationshipEditor onApply={vi.fn()} onCancel={c} />],
    ["Folder", (c) => <FolderEditor folders={[folder("f1", "Contracts")]} onApply={vi.fn()} onCancel={c} />],
    ["Added by", (c) => <AddedByEditor connections={SUMMARY.connections} onApply={vi.fn()} onCancel={c} />],
    ["Date", (c) => <DateEditor onApply={vi.fn()} onFilterCondition={vi.fn()} onCancel={c} />],
    ["Document type", (c) => <DocumentTypeEditor documentTypes={SUMMARY.document_types} onApply={vi.fn()} onCancel={c} />],
  ]
  it.each(cases)("%s: role=dialog with an aria-label, the shipped shell, Esc cancels", (name, make) => {
    const onCancel = vi.fn()
    render(make(onCancel))
    const dialog = screen.getByRole("dialog", { name })
    for (const cls of SHELL.split(" ")) expect(dialog.className).toContain(cls)
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(onCancel).toHaveBeenCalledTimes(1)
    for (const h of dialog.querySelectorAll("[data-section-heading]")) {
      expect(h.className).toContain("text-xs")
      expect(h.className).toContain("uppercase")
      expect(h.className).toContain("tracking-wider")
    }
  })
})

describe("VersionEditor (D-06 / D-07)", () => {
  it("offers the three versions with their helper lines verbatim", () => {
    render(<VersionEditor onApply={vi.fn()} onCancel={vi.fn()} />)
    const radios = screen.getAllByRole("radio")
    expect(radios.map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)).toEqual([
      "Latest versions",
      "Has earlier versions",
      "Older versions (superseded)",
    ])
    expect(screen.getByText("One row per document. Default.")).toBeInTheDocument()
    expect(screen.getByText("Latest rows that have older uploads in their history.")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Earlier uploads replaced by a newer version of the same document. This is version history, not a Supersedes link.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Latest versions" })).toBeChecked()
  })

  it("Apply emits the chosen version", () => {
    const onApply = vi.fn()
    render(<VersionEditor onApply={onApply} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole("radio", { name: "Older versions (superseded)" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onApply).toHaveBeenCalledWith("older")
  })
})

describe("RelationshipEditor (D-04)", () => {
  it("heads the 8 verbs, in table order, and the Phase 117 combobox over LATEST documents only", async () => {
    render(<RelationshipEditor onApply={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText("Documents that…")).toBeInTheDocument()
    expect(screen.getByText("…this document")).toBeInTheDocument()
    const radios = screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)
    expect(radios).toEqual(RELATIONSHIP_FILTER_VERBS.map((v) => v.label))
    const combo = screen.getByRole("combobox")
    expect(combo).toHaveAttribute("placeholder", "Type a document name")
    // 284-04: "latest only" is now the SERVER's version filter — asked for, then shown as answered.
    await screen.findByRole("option", { name: "Acme MSA 2019.pdf" })
    expect(m.searchDocuments).toHaveBeenCalledWith(expect.objectContaining({ version: "latest" }))
    const options = within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent)
    expect(options).not.toContain("Acme MSA 2019 (old).pdf")
    expect(options).toContain("Acme MSA 2019.pdf")
    expect(
      screen.getByText(
        "A link someone added between two documents. Older uploads of the same document are under Version.",
      ),
    ).toBeInTheDocument()
  })

  it("offers at most 8 candidates", async () => {
    const many = Array.from({ length: 12 }, (_, i) => doc({ id: `m${i}`, filename: `Doc ${i}.pdf` }))
    m.searchDocuments.mockImplementation(answerFrom(many))
    render(<RelationshipEditor onApply={vi.fn()} onCancel={vi.fn()} />)
    await screen.findByRole("option", { name: "Doc 0.pdf" })
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(8)
  })

  it("Apply is disabled until a verb AND a document are picked, then emits one condition", async () => {
    const onApply = vi.fn()
    render(<RelationshipEditor onApply={onApply} onCancel={vi.fn()} />)
    const apply = screen.getByRole("button", { name: "Apply" })
    expect(apply).toBeDisabled()
    fireEvent.click(screen.getByRole("radio", { name: "Is superseded by" }))
    expect(apply).toBeDisabled()
    fireEvent.mouseDown(await screen.findByRole("option", { name: "Acme MSA 2019.pdf" }))
    expect(apply).toBeEnabled()
    fireEvent.click(apply)
    expect(onApply).toHaveBeenCalledWith({
      verb: "superseded_by",
      documentId: "a",
      documentName: "Acme MSA 2019.pdf",
    })
  })
})

// ── 284-04 (D-15 / R-05 / UI-SPEC S12) — the Relationship editor searches on the server ────────
describe("RelationshipEditor — server typeahead (284-04)", () => {
  it("asks for the 20 most recent latest documents, archived included, and types ahead by name", async () => {
    render(<RelationshipEditor onApply={vi.fn()} onCancel={vi.fn()} />)
    await screen.findByRole("option", { name: "Acme MSA 2019.pdf" })
    expect(m.searchDocuments).toHaveBeenCalledWith({
      filter_expr: { op: "and", conditions: [] },
      name: null,
      version: "latest",
      sort: "added_desc",
      offset: 0,
      limit: 20,
      include_archived: true,
    })
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "board" } })
    await waitFor(() =>
      expect(m.searchDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ name: "board" })),
    )
    await waitFor(() =>
      expect(within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent)).toEqual([
        "Board memo.docx",
      ]),
    )
  })

  it("says when more documents match than the 8 shown", async () => {
    const many = Array.from({ length: 12 }, (_, i) => doc({ id: `m${i}`, filename: `Doc ${i}.pdf` }))
    m.searchDocuments.mockImplementation(answerFrom(many))
    render(<RelationshipEditor onApply={vi.fn()} onCancel={vi.fn()} />)
    await screen.findByRole("option", { name: "Doc 0.pdf" })
    expect(screen.getByRole("status")).toHaveTextContent("More documents match. Type more of the name to narrow.")
  })

  it("a failed search says so with Try again, and the retry searches again", async () => {
    m.searchDocuments.mockRejectedValueOnce(new Error("down"))
    render(<RelationshipEditor onApply={vi.fn()} onCancel={vi.fn()} />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn’t search documents.")
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("option", { name: "Acme MSA 2019.pdf" })).toBeInTheDocument()
    expect(m.searchDocuments).toHaveBeenCalledTimes(2)
  })
})

describe("FolderEditor (SC#3)", () => {
  const FOLDERS = [folder("f1", "Contracts"), folder("f2", "2019", "f1"), folder("f3", "Memos")]

  it("lists the folders indented by depth, plus Not in a folder; Include subfolders is ON by default", () => {
    render(<FolderEditor folders={FOLDERS} onApply={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole("radio", { name: "Not in a folder" })).toBeInTheDocument()
    const child = screen.getByRole("radio", { name: "2019" })
    const parent = screen.getByRole("radio", { name: "Contracts" })
    const depth = (el: HTMLElement) => Number(el.closest("[data-depth]")?.getAttribute("data-depth"))
    expect(depth(parent)).toBe(0)
    expect(depth(child)).toBe(1)
    expect(screen.getByRole("checkbox", { name: "Include subfolders" })).toBeChecked()
  })

  it("Apply emits the folder with subfolders on, or off when unticked", () => {
    const onApply = vi.fn()
    render(<FolderEditor folders={FOLDERS} onApply={onApply} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole("radio", { name: "Contracts" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onApply).toHaveBeenLastCalledWith({ folderId: "f1", includeSubfolders: true })
    fireEvent.click(screen.getByRole("checkbox", { name: "Include subfolders" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onApply).toHaveBeenLastCalledWith({ folderId: "f1", includeSubfolders: false })
  })

  it("Not in a folder emits folderId null", () => {
    const onApply = vi.fn()
    render(<FolderEditor folders={FOLDERS} onApply={onApply} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole("radio", { name: "Not in a folder" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onApply).toHaveBeenCalledWith({ folderId: null, includeSubfolders: false })
  })
})

describe("AddedByEditor (T-271-11)", () => {
  it("offers You, one option per distinct connection, and Anyone else — never an email", () => {
    render(<AddedByEditor connections={SUMMARY.connections} onApply={vi.fn()} onCancel={vi.fn()} />)
    const names = screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)
    expect(names).toEqual(["You", "Drive Finance (connected source)", "Anyone else"])
    expect(document.body.textContent).not.toContain("@")
  })

  it("Apply emits kind me / connection / others", () => {
    const onApply = vi.fn()
    render(<AddedByEditor connections={SUMMARY.connections} onApply={onApply} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole("radio", { name: "You" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onApply).toHaveBeenLastCalledWith({ kind: "me", connectionId: null, label: "You" })
    fireEvent.click(screen.getByRole("radio", { name: "Drive Finance (connected source)" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onApply).toHaveBeenLastCalledWith({
      kind: "connection",
      connectionId: "conn-1",
      label: "Drive Finance (connected source)",
    })
    fireEvent.click(screen.getByRole("radio", { name: "Anyone else" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onApply).toHaveBeenLastCalledWith({ kind: "others", connectionId: null, label: "Anyone else" })
  })
})

describe("DateEditor (P-10)", () => {
  it("names WHOSE date, with the four 270 labels verbatim", () => {
    render(<DateEditor onApply={vi.fn()} onFilterCondition={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText("Which date")).toBeInTheDocument()
    const names = screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)
    expect(names).toEqual([
      "Date in the document",
      "Added to Syrel",
      "Created in the file",
      "Last modified in the file",
    ])
    const ops = Array.from((screen.getByLabelText("Condition") as HTMLSelectElement).options).map((o) => o.value)
    expect(ops).toEqual(["within_next", "older_than", "before", "after", "between"])
  })

  it("Added to Syrel between two dates dispatches a Find date (not a filter condition)", () => {
    const onApply = vi.fn()
    const onFilterCondition = vi.fn()
    render(<DateEditor onApply={onApply} onFilterCondition={onFilterCondition} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole("radio", { name: "Added to Syrel" }))
    fireEvent.change(screen.getByLabelText("Condition"), { target: { value: "between" } })
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2019-01-01" } })
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2019-12-31" } })
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onApply).toHaveBeenCalledWith({
      which: "added",
      op: "between",
      value: "2019-01-01",
      value2: "2019-12-31",
      unit: null,
    })
    expect(onFilterCondition).not.toHaveBeenCalled()
  })

  it("Last modified in the file older than N months uses the relative control", () => {
    const onApply = vi.fn()
    render(<DateEditor onApply={onApply} onFilterCondition={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole("radio", { name: "Last modified in the file" }))
    fireEvent.change(screen.getByLabelText("Condition"), { target: { value: "older_than" } })
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "months" } })
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ which: "source_modified", op: "older_than", unit: "months", value2: null }),
    )
  })

  it("Date in the document applies a ViewCondition on the metadata field `date` to the FILTER", () => {
    const onApply = vi.fn()
    const onFilterCondition = vi.fn()
    render(<DateEditor onApply={onApply} onFilterCondition={onFilterCondition} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole("radio", { name: "Date in the document" }))
    fireEvent.change(screen.getByLabelText("Condition"), { target: { value: "after" } })
    fireEvent.change(screen.getByLabelText("On date"), { target: { value: "2019-01-01" } })
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onFilterCondition).toHaveBeenCalledWith({ field: "date", op: "after", value: "2019-01-01" })
    expect(onApply).not.toHaveBeenCalled()
  })
})

describe("DocumentTypeEditor (P-10)", () => {
  it("offers the distinct recorded document types", () => {
    render(<DocumentTypeEditor documentTypes={SUMMARY.document_types} onApply={vi.fn()} onCancel={vi.fn()} />)
    const names = screen.getAllByRole("checkbox").map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)
    expect(names).toEqual(["Contract", "Memo"])
  })

  it("one pick → eq; several → one_of; both on the metadata field document_type", () => {
    const onApply = vi.fn()
    render(<DocumentTypeEditor documentTypes={SUMMARY.document_types} onApply={onApply} onCancel={vi.fn()} />)
    const apply = screen.getByRole("button", { name: "Apply" })
    expect(apply).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: "Contract" }))
    fireEvent.click(apply)
    expect(onApply).toHaveBeenLastCalledWith({ field: "document_type", op: "eq", value: "Contract" })
    fireEvent.click(screen.getByRole("checkbox", { name: "Memo" }))
    fireEvent.click(apply)
    expect(onApply).toHaveBeenLastCalledWith({
      field: "document_type",
      op: "one_of",
      values: ["Contract", "Memo"],
    })
  })
})

// ── 284-01 (D-07 / R-03 / UI-SPEC S12) — the two editors take bounded lists, with honest arms ──
describe("Added by and Document type read the summary lists", () => {
  it("Added by sorts the connection labels as before and names an unnamed connection", () => {
    render(
      <AddedByEditor
        connections={[
          { id: "c2", name: "Zeta Box", count: 1 },
          { id: "c3", name: null, count: 4 },
          { id: "c1", name: "Alpha Drive", count: 9 },
        ]}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const names = screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)
    expect(names).toEqual([
      "You",
      "Alpha Drive (connected source)",
      "Unnamed connection (connected source)",
      "Zeta Box (connected source)",
      "Anyone else",
    ])
  })

  it("Added by while the list loads says Loading… and offers no connection yet", () => {
    render(<AddedByEditor connections={[]} listState="loading" onApply={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading…")
    expect(screen.queryByText(/connected source/)).toBeNull()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("Added by after a failure says so, and Try again retries", () => {
    const onRetry = vi.fn()
    render(
      <AddedByEditor connections={[]} listState="error" onRetry={onRetry} onApply={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load this list.")
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("Document type while the list loads says Loading…, not No document types recorded yet", () => {
    render(<DocumentTypeEditor documentTypes={[]} listState="loading" onApply={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading…")
    expect(screen.queryByText("No document types recorded yet.")).toBeNull()
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0)
  })

  it("Document type after a failure says so, and Try again retries", () => {
    const onRetry = vi.fn()
    render(
      <DocumentTypeEditor documentTypes={[]} listState="error" onRetry={onRetry} onApply={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load this list.")
    expect(screen.queryByText("No document types recorded yet.")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
