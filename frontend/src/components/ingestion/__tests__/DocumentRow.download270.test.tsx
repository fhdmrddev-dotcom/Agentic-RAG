/**
 * Phase 270 (270-04) — the list row's Download action and the per-version Download in the history.
 * Asserts rendered TEXT and ORDER, never testids (D-11).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, within, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Document } from "@/types"
import libraryPageSrc from "@/pages/LibraryPage.tsx?raw"
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

const fetchDocumentVersions = vi.fn()
const restoreDocumentVersion = vi.fn()
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    fetchDocumentVersions: (...a: unknown[]) => fetchDocumentVersions(...a),
    restoreDocumentVersion: (...a: unknown[]) => restoreDocumentVersion(...a),
    getDocumentDownloadUrl: vi.fn(),
  }
})

const startDocumentDownload = vi.fn()
vi.mock("@/lib/documentDownload", async () => {
  const actual = await vi.importActual<typeof import("@/lib/documentDownload")>(
    "@/lib/documentDownload",
  )
  return { ...actual, startDocumentDownload: (...a: unknown[]) => startDocumentDownload(...a) }
})

import { TooltipProvider } from "@/components/ui/tooltip"
import { DocumentRow } from "../DocumentRow"

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: "d-3",
    user_id: "user-1",
    folder_id: null,
    filename: "report.pdf",
    file_path: "u/d-3/report.pdf",
    file_size: 1024,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 3,
    content_hash: "h",
    metadata: {},
    created_at: "2026-06-18T00:00:00Z",
    updated_at: "2026-06-18T00:00:00Z",
    version_number: 3,
    is_latest: true,
    ...overrides,
  } as Document
}

function renderRow(doc: Document, isExpanded = false) {
  return render(
    <TooltipProvider>
      <table>
        <tbody>
          <DocumentRow
            doc={doc}
            maxChunkCount={5}
            isExpanded={isExpanded}
            onToggleExpand={vi.fn()}
            reingesting={false}
            onReingest={vi.fn()}
            onMove={vi.fn()}
            onDeleteRequest={vi.fn()}
            onRefresh={vi.fn()}
            currentUserId="user-1"
          />
        </tbody>
      </table>
    </TooltipProvider>,
  )
}

beforeEach(() => {
  startDocumentDownload.mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("DocumentRow — Phase 270 Download", () => {
  it("renders seven td and puts Download first in the Actions cell, before re-ingest/move/delete", () => {
    renderRow(makeDoc())
    const cells = document.querySelectorAll("tbody tr:first-child td")
    expect(cells).toHaveLength(7)
    const buttons = within(cells[6] as HTMLElement).getAllByRole("button")
    expect(buttons[0].textContent).toContain("Download v3 (latest)")
    expect(buttons[0].getAttribute("aria-label")).toBe("Download v3 (latest) — report.pdf")
    expect(buttons.slice(1).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Re-ingest document",
      "Move to folder",
      "Delete document",
    ])
  })

  it("reads plain 'Download' for a single-version row", () => {
    renderRow(makeDoc({ version_number: 1, is_latest: true }))
    const cell = document.querySelectorAll("tbody tr:first-child td")[6] as HTMLElement
    expect(within(cell).getAllByRole("button")[0].textContent?.trim()).toBe("Download")
  })

  it("a row with no stored file reads 'Not stored here' (disabled) and still has seven td", () => {
    renderRow(makeDoc({ file_path: "", version_number: 1 }))
    const cells = document.querySelectorAll("tbody tr:first-child td")
    expect(cells).toHaveLength(7)
    const first = within(cells[6] as HTMLElement).getAllByRole("button")[0]
    expect(first.textContent).toContain("Not stored here")
    expect((first as HTMLButtonElement).disabled).toBe(true)
  })

  it("labels every version-history row's own Download, and fetches that row's version", async () => {
    const v3 = makeDoc({ id: "d-3", version_number: 3, is_latest: true })
    const v2 = makeDoc({ id: "d-2", version_number: 2, is_latest: false })
    const v1 = makeDoc({ id: "d-1", version_number: 1, is_latest: false })
    fetchDocumentVersions.mockResolvedValue([v3, v2, v1])
    const user = userEvent.setup()
    renderRow(v3, true)

    const table = await screen.findByRole("table", { name: "Version history" })
    const rows = within(table).getAllByRole("row").slice(1)
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByRole("button", { name: /Download v3 \(latest\)/ })).toBeTruthy()
    expect(within(rows[0]).getByText("Current")).toBeTruthy()
    expect(
      within(rows[1]).getByRole("button", { name: /Download v2 \(viewed, not latest\)/ }),
    ).toBeTruthy()
    expect(within(rows[1]).getByText("Restore")).toBeTruthy()
    expect(
      within(rows[2]).getByRole("button", { name: /Download v1 \(viewed, not latest\)/ }),
    ).toBeTruthy()

    await user.click(
      within(rows[1]).getByRole("button", { name: /Download v2 \(viewed, not latest\)/ }),
    )
    await waitFor(() => expect(startDocumentDownload).toHaveBeenCalledTimes(1))
    expect(startDocumentDownload).toHaveBeenCalledWith(v2)
    expect((startDocumentDownload.mock.calls[0][0] as Document).id).toBe("d-2")
  })
})

// 270 UAT F-1: LibraryPage's column shed is a CSS rule, so jsdom cannot evaluate it. A source fence pins
// the two halves that must stay together: the shed excludes the nested history table, and that table
// carries the marker. Dropping either half hides per-version Download (and Restore) while a panel is open.
describe("version history survives the column shed", () => {
  it("the shed selector excludes the nested version-history table", () => {
    const shed = libraryPageSrc.match(/const SHED_COLUMNS_3_TO_5 =\s*"([^"]+)"/)?.[1] ?? ""
    expect(shed).toContain(":not([data-version-history])")
    expect(shed).not.toMatch(/\[&_table_t[hd]:nth-child/) // the old descendant form reached the nested table
  })

  it("the nested history table carries the marker the shed excludes", () => {
    expect(documentRowSrc).toMatch(/aria-label="Version history"[^>]*data-version-history/)
  })
})
