/**
 * Phase 101.1-09 (gap 3) — FilePreview Download wiring.
 *
 * The Fallback rendered at the inline-default / bucket-non-image / error call
 * sites now receives an onDownload prop that calls downloadWorkspaceFile with
 * the resolved file id + the basename of file.path. The Download button is
 * present and clicking it invokes the helper (the deliverable is reachable —
 * UAT Test 2 screenshot 203002: Download was dead text).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { WorkspaceFile, WorkspaceFileContent } from "@/types"

// ── Mock the api module: stub the content fetch + the new download helper ──
const { mockGetContent, mockDownload } = vi.hoisted(() => ({
  mockGetContent: vi.fn(),
  mockDownload: vi.fn(),
}))
vi.mock("@/lib/api", () => ({
  getWorkspaceFileContent: mockGetContent,
  downloadWorkspaceFile: mockDownload,
  getThreadWorkspaceFiles: vi.fn().mockResolvedValue([]),
}))

import { FilePreview } from "./FilePreview"

const THREAD = "thread-1"

function file(overrides: Partial<WorkspaceFile> = {}): WorkspaceFile {
  return {
    id: "file-xyz",
    path: "/risk-register.docx",
    size_bytes: 37000,
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    version: 1,
    created_at: "",
    updated_at: "",
    ...(overrides as WorkspaceFile),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => cleanup())

describe("FilePreview Download wiring (gap 3 — deliverable reachable from the panel)", () => {
  it("renders a Download button on the inline-binary fallback and invokes downloadWorkspaceFile with id + basename", async () => {
    // A 37 KB docx is stored INLINE but classifies as a non-text fallback (the
    // mime_type is binary), so the inline-default Fallback renders.
    const content: WorkspaceFileContent = {
      id: "file-xyz",
      path: "/risk-register.docx",
      size_bytes: 37000,
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storage_type: "inline",
      content: "PK (binary)",
    }
    mockGetContent.mockResolvedValue(content)

    render(<FilePreview threadId={THREAD} file={file()} onBack={() => {}} />)

    const btn = await screen.findByRole("button", { name: /download/i })
    expect(btn).toBeTruthy()

    await userEvent.click(btn)
    await waitFor(() =>
      expect(mockDownload).toHaveBeenCalledWith(THREAD, "file-xyz", "risk-register.docx"),
    )
  })

  it("renders a Download button on the bucket-non-image fallback and wires the helper", async () => {
    const content: WorkspaceFileContent = {
      id: "file-xyz",
      path: "/deliverable.pptx",
      size_bytes: 90000,
      mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      storage_type: "bucket",
      signed_url: null,
    }
    mockGetContent.mockResolvedValue(content)

    render(
      <FilePreview
        threadId={THREAD}
        file={file({ path: "/deliverable.pptx", mime_type: content.mime_type })}
        onBack={() => {}}
      />,
    )

    const btn = await screen.findByRole("button", { name: /download/i })
    await userEvent.click(btn)
    await waitFor(() =>
      expect(mockDownload).toHaveBeenCalledWith(THREAD, "file-xyz", "deliverable.pptx"),
    )
  })

  it("renders a Download button on the error/no-content fallback", async () => {
    mockGetContent.mockRejectedValue(new Error("boom"))
    render(<FilePreview threadId={THREAD} file={file()} onBack={() => {}} />)
    const btn = await screen.findByRole("button", { name: /download/i })
    expect(btn).toBeTruthy()
  })
})
