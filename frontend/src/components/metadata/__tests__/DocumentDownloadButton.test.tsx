/**
 * Phase 270 (270-03) — DocumentDownloadButton: every state in visible words.
 * Asserts rendered TEXT and roles, never testid presence (D-11).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act, fireEvent } from "@testing-library/react"
import type { Document } from "@/types"

const startDocumentDownload = vi.fn()

vi.mock("@/lib/documentDownload", async () => {
  const actual = await vi.importActual<typeof import("@/lib/documentDownload")>("@/lib/documentDownload")
  return { ...actual, startDocumentDownload: (...a: unknown[]) => startDocumentDownload(...a) }
})
vi.mock("@/lib/api", () => {
  class DownloadError extends Error {
    readonly status: number | "network"
    constructor(status: number | "network", message: string) {
      super(message)
      this.status = status
      this.name = "DownloadError"
    }
  }
  return { getDocumentDownloadUrl: vi.fn(), DownloadError }
})

import { DownloadError } from "@/lib/api"
import { VersionMismatchError } from "@/lib/documentDownload"
import { DocumentDownloadButton } from "../DocumentDownloadButton"

function makeDoc(over: Partial<Document> = {}): Document {
  return {
    id: "d1",
    user_id: "u1",
    folder_id: null,
    filename: "contract.pdf",
    file_path: "u1/d1/contract.pdf",
    file_size: 1000,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 1,
    content_hash: "h",
    version_number: 3,
    is_latest: true,
    metadata: null,
    created_at: "2026-09-30T10:00:00Z",
    updated_at: "2026-09-30T10:00:00Z",
    ...over,
  } as Document
}

beforeEach(() => {
  startDocumentDownload.mockReset()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("DocumentDownloadButton — idle", () => {
  it("panel density: words, weight, height, no href, no title", () => {
    const { container } = render(<DocumentDownloadButton doc={makeDoc()} density="panel" />)
    const btn = screen.getByRole("button", { name: "Download v3 (latest)" })
    expect(btn).toHaveTextContent("Download v3 (latest)")
    expect(btn.className).toContain("font-semibold")
    expect(btn.className).toContain("h-8")
    expect(btn.className).not.toContain("font-medium")
    expect(container.querySelectorAll("[href]")).toHaveLength(0)
    expect(container.querySelectorAll("[title]")).toHaveLength(0)
  })

  it("row density: aria-label carries the filename; visible text stays the label", () => {
    render(<DocumentDownloadButton doc={makeDoc()} density="row" />)
    const btn = screen.getByRole("button", { name: "Download v3 (latest) — contract.pdf" })
    expect(btn).toHaveTextContent("Download v3 (latest)")
    expect(btn.className).toContain("font-normal")
    expect(btn.className).toContain("h-7")
    expect(btn.className).not.toContain("font-medium")
  })
})

describe("DocumentDownloadButton — preparing / started", () => {
  it("shows Preparing while pending (panel and row words differ)", async () => {
    startDocumentDownload.mockReturnValue(new Promise(() => {}))
    const { unmount } = render(<DocumentDownloadButton doc={makeDoc()} density="panel" />)
    fireEvent.click(screen.getByRole("button"))
    const btn = screen.getByRole("button")
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute("aria-busy", "true")
    expect(btn).toHaveTextContent("Preparing download…")
    unmount()
    render(<DocumentDownloadButton doc={makeDoc()} density="row" />)
    fireEvent.click(screen.getByRole("button"))
    expect(screen.getByRole("button")).toHaveTextContent("Preparing…")
  })

  it("passes the SAME doc object the label was derived from", async () => {
    startDocumentDownload.mockResolvedValue(undefined)
    const doc = makeDoc()
    render(<DocumentDownloadButton doc={doc} density="panel" />)
    fireEvent.click(screen.getByRole("button"))
    expect(startDocumentDownload).toHaveBeenCalledWith(doc)
  })

  it("panel: 'Download started' receipt in a polite status, gone after 4 s", async () => {
    startDocumentDownload.mockResolvedValue(undefined)
    render(<DocumentDownloadButton doc={makeDoc()} density="panel" />)
    fireEvent.click(screen.getByRole("button"))
    await flush()
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Download started")
    expect(status).toHaveAttribute("aria-live", "polite")
    act(() => {
      vi.advanceTimersByTime(4100)
    })
    expect(screen.queryByText("Download started")).toBeNull()
  })

  it("row: no receipt", async () => {
    startDocumentDownload.mockResolvedValue(undefined)
    render(<DocumentDownloadButton doc={makeDoc()} density="row" />)
    fireEvent.click(screen.getByRole("button"))
    await flush()
    expect(screen.queryByText("Download started")).toBeNull()
  })
})

describe("DocumentDownloadButton — errors", () => {
  const noAccess = "You don't have access to this file, so no download link was created."

  it("panel: error persists past 10 s, cleared on next click", async () => {
    startDocumentDownload.mockRejectedValueOnce(new DownloadError(404, "x"))
    render(<DocumentDownloadButton doc={makeDoc()} density="panel" />)
    fireEvent.click(screen.getByRole("button"))
    await flush()
    expect(screen.getByRole("alert")).toHaveTextContent(noAccess)
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(screen.getByRole("alert")).toHaveTextContent(noAccess)
    startDocumentDownload.mockReturnValueOnce(new Promise(() => {}))
    fireEvent.click(screen.getByRole("button"))
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("row: same sentence, clears after 6 s", async () => {
    startDocumentDownload.mockRejectedValueOnce(new DownloadError(404, "x"))
    render(<DocumentDownloadButton doc={makeDoc()} density="row" />)
    fireEvent.click(screen.getByRole("button"))
    await flush()
    expect(screen.getByRole("alert")).toHaveTextContent(noAccess)
    act(() => {
      vi.advanceTimersByTime(6100)
    })
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("version mismatch reads its own sentence", async () => {
    startDocumentDownload.mockRejectedValueOnce(new VersionMismatchError(3))
    render(<DocumentDownloadButton doc={makeDoc()} density="panel" />)
    fireEvent.click(screen.getByRole("button"))
    await flush()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The file returned was not v3. Nothing was downloaded.",
    )
  })
})

describe("DocumentDownloadButton — not stored (D-06)", () => {
  it("panel: dashed disabled control + reason line naming the connection, wired by aria-describedby", () => {
    render(
      <DocumentDownloadButton
        doc={makeDoc({ file_path: "", source_connection_name: "Team Drive" })}
        density="panel"
      />,
    )
    const btn = screen.getByRole("button")
    expect(btn).toBeDisabled()
    expect(btn.className).toContain("border-dashed")
    expect(btn.className).toContain("disabled:opacity-100")
    expect(btn).toHaveTextContent("Download")
    const reason = screen.getByText("File lives in Team Drive, not stored here.")
    expect(btn.getAttribute("aria-describedby")).toBe(reason.id)
    fireEvent.click(btn)
    expect(startDocumentDownload).not.toHaveBeenCalled()
  })

  it("row: 'Not stored here', never calls the mint", () => {
    render(<DocumentDownloadButton doc={makeDoc({ file_path: "" })} density="row" />)
    const btn = screen.getByRole("button")
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent("Not stored here")
    expect(btn.className).toContain("border-dashed")
    fireEvent.click(btn)
    expect(startDocumentDownload).not.toHaveBeenCalled()
  })

  it("no connection name -> generic connected-source sentence", () => {
    render(<DocumentDownloadButton doc={makeDoc({ file_path: "" })} density="panel" />)
    expect(screen.getByText("File lives in a connected source, not stored here.")).toBeInTheDocument()
  })

  it("no word is title-only", () => {
    const { container } = render(
      <DocumentDownloadButton doc={makeDoc({ file_path: "" })} density="panel" />,
    )
    expect(container.querySelectorAll("[title]")).toHaveLength(0)
  })
})
