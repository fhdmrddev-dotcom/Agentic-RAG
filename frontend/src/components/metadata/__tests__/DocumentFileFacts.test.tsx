/**
 * Phase 270 (270-03) — DocumentFileFacts: eight labelled rows, "not recorded" honesty.
 * Asserts rendered TEXT (D-11), never testids.
 */
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import type { Document } from "@/types"
import { DocumentFileFacts } from "../DocumentFileFacts"

function makeDoc(over: Partial<Document> = {}): Document {
  return {
    id: "d1",
    user_id: "u1",
    folder_id: null,
    filename: "contract.pdf",
    file_path: "u1/d1/contract.pdf",
    file_size: 2411724,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 1,
    content_hash: "h",
    version_number: 1,
    is_latest: true,
    metadata: null,
    created_at: "2026-09-30T10:00:00Z",
    updated_at: "2031-01-01T10:00:00Z",
    ...over,
  } as Document
}

const LABELS = [
  "File type",
  "File size",
  "Pages",
  "Created in the file",
  "Last modified in the file",
  "Author in the file",
  "Added to Agentic RAG",
  "Added by",
]

function ddFor(container: HTMLElement, label: string): HTMLElement {
  const dts = Array.from(container.querySelectorAll("dt"))
  const dt = dts.find((d) => d.textContent === label)
  if (!dt) throw new Error(`no dt ${label}`)
  return dt.nextElementSibling as HTMLElement
}

describe("DocumentFileFacts — structure", () => {
  it("renders exactly the eight labels in fixed order", () => {
    const { container } = render(<DocumentFileFacts doc={makeDoc()} />)
    expect(Array.from(container.querySelectorAll("dt")).map((d) => d.textContent)).toEqual(LABELS)
  })
})

describe("DocumentFileFacts — pre-270 document", () => {
  const footnote =
    "These facts are read from the file when it is added. This file was added before they were recorded, or its type does not carry them. Re-ingest it to read them."

  it("reads 'not recorded' for the four file facts and never falls back to created_at", () => {
    const { container } = render(<DocumentFileFacts doc={makeDoc()} />)
    for (const l of ["Pages", "Created in the file", "Last modified in the file", "Author in the file"]) {
      const dd = ddFor(container, l)
      expect(within(dd).getByText("not recorded")).toBeInTheDocument()
      expect(dd.textContent).not.toMatch(/2026/)
    }
    expect(container.textContent).not.toMatch(/0 pages/)
    expect(container.textContent).not.toMatch(/0 B/)
    expect(screen.getByText(footnote)).toBeInTheDocument()
  })

  it("never renders updated_at", () => {
    const { container } = render(<DocumentFileFacts doc={makeDoc()} />)
    expect(container.textContent).not.toMatch(/2031/)
  })
})

describe("DocumentFileFacts — recorded facts", () => {
  it("renders pages, dates in <time dateTime>, author; no footnote", () => {
    const doc = makeDoc({
      page_count: 12,
      source_created_at: "2019-03-12T14:03:00Z",
      source_modified_at: "2020-05-01T09:00:00Z",
      source_author: "Ada",
    })
    const { container } = render(<DocumentFileFacts doc={doc} />)
    expect(ddFor(container, "Pages")).toHaveTextContent("12 pages")
    const created = ddFor(container, "Created in the file")
    expect(created.textContent).toMatch(/2019/)
    expect(created.querySelector("time")?.getAttribute("dateTime")).toBe("2019-03-12T14:03:00Z")
    expect(ddFor(container, "Last modified in the file").textContent).toMatch(/2020/)
    expect(ddFor(container, "Author in the file")).toHaveTextContent("Ada")
    expect(screen.queryByText(/Re-ingest it to read them/)).toBeNull()
  })

  it("singular page, and zero / non-positive facts read 'not recorded'", () => {
    const one = render(<DocumentFileFacts doc={makeDoc({ page_count: 1 })} />)
    expect(ddFor(one.container, "Pages")).toHaveTextContent("1 page")
    expect(ddFor(one.container, "Pages").textContent).not.toMatch(/pages/)
    one.unmount()
    const zero = render(<DocumentFileFacts doc={makeDoc({ page_count: 0, file_size: 0 })} />)
    expect(within(ddFor(zero.container, "Pages")).getByText("not recorded")).toBeInTheDocument()
    expect(within(ddFor(zero.container, "File size")).getByText("not recorded")).toBeInTheDocument()
  })

  it("formats file size and type", () => {
    const { container } = render(<DocumentFileFacts doc={makeDoc()} />)
    expect(ddFor(container, "File size")).toHaveTextContent("2.3 MB")
    const type = ddFor(container, "File type")
    expect(type).toHaveTextContent("PDF")
    expect(type).toHaveTextContent("application/pdf")
  })

  it("no extension -> the MIME string alone", () => {
    const { container } = render(
      <DocumentFileFacts doc={makeDoc({ filename: "README", mime_type: "text/plain" })} />,
    )
    const type = ddFor(container, "File type")
    expect(type).toHaveTextContent("text/plain")
    expect(type.textContent).not.toMatch(/README/i)
  })
})

describe("DocumentFileFacts — Added to / Added by", () => {
  it("suffixes the version only above v1", () => {
    const v3 = render(<DocumentFileFacts doc={makeDoc({ version_number: 3 })} />)
    expect(ddFor(v3.container, "Added to Agentic RAG")).toHaveTextContent("· when v3 was added")
    v3.unmount()
    const v1 = render(<DocumentFileFacts doc={makeDoc({ version_number: 1 })} />)
    expect(ddFor(v1.container, "Added to Agentic RAG").textContent).not.toMatch(/when v/)
  })

  it("names who added it without ever showing an email", () => {
    const you = render(<DocumentFileFacts doc={makeDoc()} currentUserId="u1" />)
    expect(ddFor(you.container, "Added by")).toHaveTextContent("You")
    you.unmount()

    const named = render(
      <DocumentFileFacts
        doc={makeDoc({ source_connection_id: "c1", source_connection_name: "Team Drive" })}
        currentUserId="other"
      />,
    )
    expect(ddFor(named.container, "Added by")).toHaveTextContent("Team Drive (connected source)")
    named.unmount()

    // 270 UAT G4-4a: a connected source files documents under the user who connected it, so the
    // SAME user viewing it must still read the connection, never "You".
    const ownConnected = render(
      <DocumentFileFacts
        doc={makeDoc({ user_id: "u1", source_connection_id: "c1", source_connection_name: "Microsoft 365" })}
        currentUserId="u1"
      />,
    )
    expect(ddFor(ownConnected.container, "Added by")).toHaveTextContent("Microsoft 365 (connected source)")
    expect(ddFor(ownConnected.container, "Added by").textContent).not.toMatch(/You/)
    ownConnected.unmount()

    const unnamed = render(
      <DocumentFileFacts doc={makeDoc({ source_connection_id: "c1", source_connection_name: null })} currentUserId="other" />,
    )
    expect(ddFor(unnamed.container, "Added by")).toHaveTextContent("a connected source")
    unnamed.unmount()

    const other = render(<DocumentFileFacts doc={makeDoc({ user_id: "bob@example.com" })} currentUserId="u1" />)
    expect(ddFor(other.container, "Added by")).toHaveTextContent("name not available")
    expect(other.container.textContent).not.toMatch(/@/)
  })
})
