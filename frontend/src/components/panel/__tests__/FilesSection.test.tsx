/**
 * Phase 087 Plan 03 Task 3 — FilesSection list + drill-in (PANEL-03).
 *
 * Asserts: file rows render with formatBytes·v{version} meta; keyboard +
 * mouse both open the preview (full-replace drill-in, D1); listbox/option a11y
 * roles are present. FilePreview is mocked to a thin sentinel (its own routing
 * is covered by FilePreview.test.tsx); the two Phase 086 hooks are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { mockWorkspaceFiles } from "./fixtures"

const useWorkspaceFiles = vi.fn()
const useViewingThread = vi.fn()
vi.mock("@/providers/StreamsProvider", () => ({
  useWorkspaceFiles: (...a: unknown[]) => useWorkspaceFiles(...a),
  useViewingThread: (...a: unknown[]) => useViewingThread(...a),
}))

vi.mock("@/components/panel/FilePreview", () => ({
  FilePreview: ({ file, onBack }: { file: { path: string }; onBack: () => void }) => (
    <div data-testid="file-preview">
      preview:{file.path}
      <button onClick={onBack}>‹ Files</button>
    </div>
  ),
}))

// eslint-disable-next-line import/first
import { FilesSection } from "@/components/panel/FilesSection"

describe("FilesSection (PANEL-03) — list rows + drill-in", () => {
  beforeEach(() => {
    useWorkspaceFiles.mockReturnValue({
      data: mockWorkspaceFiles,
      isLoading: false,
      error: null,
      reconcile: vi.fn(),
    })
    useViewingThread.mockReturnValue("thread-1")
  })

  it("renders a listbox with one option row per workspace file", () => {
    render(<FilesSection />)
    expect(screen.getByRole("listbox", { name: /Workspace files/i })).toBeInTheDocument()
    expect(screen.getAllByRole("option")).toHaveLength(mockWorkspaceFiles.length)
    expect(screen.getByText("summary.md")).toBeInTheDocument()
  })

  it("shows formatBytes · v{version} meta per row", () => {
    render(<FilesSection />)
    // summary.md = 2148 bytes → 2.1 KB · v3
    expect(screen.getByText(/2\.1 KB · v3/)).toBeInTheDocument()
  })

  it("clicking a row full-replaces the list with the FilePreview drill-in", async () => {
    render(<FilesSection />)
    await userEvent.setup().click(screen.getByText("summary.md"))
    expect(screen.getByTestId("file-preview")).toHaveTextContent("preview:summary.md")
    // list is replaced — no more option rows
    expect(screen.queryByRole("option")).toBeNull()
  })

  it("Enter on a focused row opens the preview (keyboard path, no mouse-only)", async () => {
    render(<FilesSection />)
    const user = userEvent.setup()
    await user.tab() // focus the roving-tabindex active row
    await user.keyboard("{Enter}")
    expect(screen.getByTestId("file-preview")).toBeInTheDocument()
  })

  it("‹ Files back from the preview returns to the list", async () => {
    render(<FilesSection />)
    const user = userEvent.setup()
    await user.click(screen.getByText("analysis.py"))
    expect(screen.getByTestId("file-preview")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Files/i }))
    expect(screen.getAllByRole("option").length).toBe(mockWorkspaceFiles.length)
  })

  // Phase 088-01 (D-13a) — structural a11y regression gate. Populated listbox
  // (role=listbox + role=option rows + the new aria-selected={isActive}) AND the
  // empty state. axe = STRUCTURE only (Pitfall 5 — contrast is Plan 05 / Chrome MCP).
  it("has no axe violations (populated listbox — role=option + aria-selected)", async () => {
    const { container } = render(<FilesSection />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no axe violations (empty state)", async () => {
    useWorkspaceFiles.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      reconcile: vi.fn(),
    })
    const { container } = render(<FilesSection />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
