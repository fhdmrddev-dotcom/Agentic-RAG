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
  // downloadWorkspaceFile is async — return a resolved promise so the handler's
  // `.catch()` has a promise to attach to (the real helper always returns one).
  mockDownload.mockResolvedValue(undefined)
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


describe("FilePreview — the copy control (Phase 200, sketch `run-panel-parts.html`)", () => {
  /** A plain-text file, which routes to the `text` inline arm. */
  const TEXT_FILE = {
    id: "file-txt",
    path: "/notes.txt",
    size_bytes: 12,
    mime_type: "text/plain",
    version: 1,
    created_at: "",
    updated_at: "",
  } as WorkspaceFile

  const TEXT_CONTENT = {
    storage_type: "inline",
    mime_type: "text/plain",
    content: "the whole file",
  } as unknown as WorkspaceFileContent

  it("offers a copy control over an INLINE preview", async () => {
    mockGetContent.mockResolvedValue(TEXT_CONTENT)
    render(<FilePreview threadId={THREAD} file={TEXT_FILE} onBack={vi.fn()} />)
    const btn = await screen.findByTestId("preview-copy")
    expect(btn).toBeTruthy()
    // Named for assistive tech — the glyph alone says nothing.
    expect(btn.getAttribute("aria-label")).toBe("Copy file contents")
  })

  it("copies the WHOLE content and says so", async () => {
    mockGetContent.mockResolvedValue(TEXT_CONTENT)
    // ORDER IS LOAD-BEARING - `userEvent.setup()` INSTALLS ITS OWN `navigator.clipboard`
    // stub, so a spy planted before it is silently replaced and the assertion below then
    // measures user-event's stub instead of the component. Measured, not predicted: the
    // first draft planted first and read `expected "vi.fn()" to be called with [...]`.
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    })
    render(<FilePreview threadId={THREAD} file={TEXT_FILE} onBack={vi.fn()} />)
    await user.click(await screen.findByTestId("preview-copy"))

    expect(writeText).toHaveBeenCalledWith("the whole file")
    await waitFor(() => {
      expect(screen.getByTestId("preview-copy").textContent).toContain("Copied")
    })
  })

  it("⚠ SAYS SO WHEN IT FAILS — a silent no-op is worse than no control at all", async () => {
    // `navigator.clipboard` is undefined outside a secure context and its write REJECTS
    // when the document is not focused. A control that quietly does nothing in those cases
    // leaves the person believing they hold the text.
    mockGetContent.mockResolvedValue(TEXT_CONTENT)
    // See the ordering note above - plant AFTER setup, or user-event's stub wins.
    const user = userEvent.setup()
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    })
    render(<FilePreview threadId={THREAD} file={TEXT_FILE} onBack={vi.fn()} />)
    await user.click(await screen.findByTestId("preview-copy"))

    await waitFor(() => {
      expect(screen.getByTestId("preview-copy").textContent).toContain("Copy failed")
    })
    // ...and it does NOT flash the success word.
    expect(screen.getByTestId("preview-copy").textContent).not.toContain("Copied")
  })

  it("survives a MISSING clipboard entirely, and reports rather than throwing", async () => {
    mockGetContent.mockResolvedValue(TEXT_CONTENT)
    // See the ordering note above - plant AFTER setup, or user-event's stub wins.
    const user = userEvent.setup()
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true })
    render(<FilePreview threadId={THREAD} file={TEXT_FILE} onBack={vi.fn()} />)
    await user.click(await screen.findByTestId("preview-copy"))

    await waitFor(() => {
      expect(screen.getByTestId("preview-copy").textContent).toContain("Copy failed")
    })
  })

  it("⚠ offers NO copy control on the no-preview fallback — there is nothing to copy", async () => {
    // The binary arm renders the download fallback. An offer to copy "the content" there
    // would copy nothing, or bytes a person cannot read.
    mockGetContent.mockResolvedValue({
      storage_type: "inline",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      content: "",
    } as unknown as WorkspaceFileContent)
    render(<FilePreview threadId={THREAD} file={file()} onBack={vi.fn()} />)
    // NON-VACUITY: the fallback really did render.
    await screen.findByRole("button", { name: /download/i })
    expect(screen.queryByTestId("preview-copy")).toBeNull()
  })
})
