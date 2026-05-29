/**
 * Phase 087 Plan 03 Task 2 — FilePreview per-type routing contract
 * (PANEL-03, D-02).
 *
 * FilePreview fetches content via getWorkspaceFileContent on mount, then routes
 * by storage_type + mime/ext:
 *   inline md   → MarkdownRenderer
 *   inline code → ShikiCode (A1 — the live highlighter, NOT react-syntax-highlighter)
 *   inline csv  → CsvTablePreview
 *   bucket image + non-null signed_url → <img>
 *   bucket null-url / binary / too-large → calm "No preview available · Download"
 *
 * The two heavy child renderers are mocked to thin sentinels so this suite
 * asserts ROUTING, not their internals (those have their own tests). The
 * content fetch is mocked at the api boundary.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { WorkspaceFile } from "@/types"
import { mockContentInline, mockContentBucket } from "./fixtures"

const getWorkspaceFileContent = vi.fn()
vi.mock("@/lib/api", () => ({
  getWorkspaceFileContent: (...args: unknown[]) => getWorkspaceFileContent(...args),
}))

vi.mock("@/components/chat/MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}))

vi.mock("@/components/chat/tool-bodies/ShikiCode", () => ({
  ShikiCode: ({ code, language }: { code: string; language: string }) => (
    <div data-testid="shiki-code" data-language={language}>
      {code}
    </div>
  ),
}))

// eslint-disable-next-line import/first
import { FilePreview } from "@/components/panel/FilePreview"

const fileFor = (over: Partial<WorkspaceFile>): WorkspaceFile => ({
  id: "file-x",
  path: "summary.md",
  size_bytes: 100,
  mime_type: "text/markdown",
  version: 1,
  ...over,
})

describe("FilePreview (PANEL-03) — per-type routing + graceful fallback", () => {
  beforeEach(() => {
    getWorkspaceFileContent.mockReset()
  })

  it("inline + text/markdown → renders via MarkdownRenderer (reuse, not re-add)", async () => {
    getWorkspaceFileContent.mockResolvedValue(
      mockContentInline("text/markdown", "# Hi\n"),
    )
    render(
      <FilePreview
        threadId="thread-1"
        file={fileFor({ path: "summary.md", mime_type: "text/markdown" })}
        onBack={() => {}}
      />,
    )
    expect(await screen.findByTestId("markdown-renderer")).toHaveTextContent("# Hi")
  })

  it("inline + code mime (text/x-python) → renders via ShikiCode with language from path", async () => {
    getWorkspaceFileContent.mockResolvedValue(
      mockContentInline("text/x-python", "print('hi')\n", "analysis.py"),
    )
    render(
      <FilePreview
        threadId="thread-1"
        file={fileFor({ path: "analysis.py", mime_type: "text/x-python" })}
        onBack={() => {}}
      />,
    )
    const node = await screen.findByTestId("shiki-code")
    expect(node).toHaveTextContent("print('hi')")
    expect(node).toHaveAttribute("data-language", "python")
  })

  it("inline + application/json → renders via ShikiCode with language json", async () => {
    getWorkspaceFileContent.mockResolvedValue(
      mockContentInline("application/json", '{"a":1}', "data.json"),
    )
    render(
      <FilePreview
        threadId="thread-1"
        file={fileFor({ path: "data.json", mime_type: "application/json" })}
        onBack={() => {}}
      />,
    )
    const node = await screen.findByTestId("shiki-code")
    expect(node).toHaveAttribute("data-language", "json")
  })

  it("inline + text/csv → renders via CsvTablePreview", async () => {
    getWorkspaceFileContent.mockResolvedValue(
      mockContentInline("text/csv", "a,b\n1,2\n", "rollup.csv"),
    )
    const { container } = render(
      <FilePreview
        threadId="thread-1"
        file={fileFor({ path: "rollup.csv", mime_type: "text/csv" })}
        onBack={() => {}}
      />,
    )
    await waitFor(() => expect(container.querySelector("table")).toBeInTheDocument())
  })

  it("bucket + image mime + non-null signed_url → frames the signed URL in an <img>", async () => {
    getWorkspaceFileContent.mockResolvedValue(
      mockContentBucket("https://signed.example/chart.png", "image/png", "chart.png"),
    )
    const { container } = render(
      <FilePreview
        threadId="thread-1"
        file={fileFor({ path: "chart.png", mime_type: "image/png" })}
        onBack={() => {}}
      />,
    )
    await waitFor(() => {
      const img = container.querySelector("img")
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute("src", "https://signed.example/chart.png")
    })
  })

  it("bucket + image mime + signed_url === null → calm 'No preview available · Download' fallback (Pitfall 5)", async () => {
    getWorkspaceFileContent.mockResolvedValue(
      mockContentBucket(null, "image/png", "chart.png"),
    )
    const { container } = render(
      <FilePreview
        threadId="thread-1"
        file={fileFor({ path: "chart.png", mime_type: "image/png" })}
        onBack={() => {}}
      />,
    )
    expect(await screen.findByText(/No preview available/i)).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
  })

  it("bucket + binary mime (pptx) → calm 'No preview available · Download' fallback", async () => {
    getWorkspaceFileContent.mockResolvedValue(
      mockContentBucket(
        "https://signed.example/deck.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "deck.pptx",
      ),
    )
    render(
      <FilePreview
        threadId="thread-1"
        file={fileFor({
          path: "deck.pptx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        })}
        onBack={() => {}}
      />,
    )
    expect(await screen.findByText(/No preview available/i)).toBeInTheDocument()
  })

  it("renders a '‹ Files' back button that returns to the file list (full-replace drill-in, D1)", async () => {
    getWorkspaceFileContent.mockResolvedValue(mockContentInline("text/markdown"))
    const onBack = vi.fn()
    render(
      <FilePreview threadId="thread-1" file={fileFor({})} onBack={onBack} />,
    )
    const back = await screen.findByRole("button", { name: /Files/i })
    await userEvent.setup().click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("Escape key also calls onBack", async () => {
    getWorkspaceFileContent.mockResolvedValue(mockContentInline("text/markdown"))
    const onBack = vi.fn()
    render(<FilePreview threadId="thread-1" file={fileFor({})} onBack={onBack} />)
    await screen.findByTestId("markdown-renderer")
    await userEvent.setup().keyboard("{Escape}")
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("never uses dangerouslySetInnerHTML on raw file content (XSS — T-087-04)", async () => {
    // FilePreview routes raw content ONLY through MarkdownRenderer (sanitizes),
    // ShikiCode (escapes), CsvTablePreview/<pre>/<img> (plain) — it must never
    // inject raw content as HTML itself. (Static guarantee verified by grep in
    // the plan's acceptance criteria; this asserts the routed render is safe.)
    getWorkspaceFileContent.mockResolvedValue(
      mockContentInline("text/plain", "<script>alert(1)</script>", "notes.txt"),
    )
    const { container } = render(
      <FilePreview
        threadId="thread-1"
        file={fileFor({ path: "notes.txt", mime_type: "text/plain" })}
        onBack={() => {}}
      />,
    )
    await waitFor(() => expect(getWorkspaceFileContent).toHaveBeenCalled())
    expect(container.querySelector("script")).toBeNull()
  })
})
