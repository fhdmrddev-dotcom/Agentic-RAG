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
// Phase 100-06: FilesSection now reads setWorkspaceFileForThread off the
// stream actions to optimistically reconcile an upload (D-01). The action is a
// no-op spy here — the upload-reconcile path is exercised live (G-4 UAT), and
// the render tests below only need the hook to resolve without throwing.
const setWorkspaceFileForThread = vi.fn()
vi.mock("@/providers/StreamsProvider", () => ({
  useWorkspaceFiles: (...a: unknown[]) => useWorkspaceFiles(...a),
  useViewingThread: (...a: unknown[]) => useViewingThread(...a),
  useStreamActions: () => ({ setWorkspaceFileForThread }),
}))

// Phase 100-06: stub the upload client so importing FilesSection never reaches
// the real fetch path (the button-click upload flow is a live G-4 UAT row).
vi.mock("@/lib/api", () => ({
  uploadWorkspaceTemplate: vi.fn(),
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
    // Phase 100-06: the "Upload template" button (D-01) is now the first tab
    // stop above the listbox — tab past it to reach the roving-tabindex active
    // row, then Enter opens the preview (the keyboard contract is unchanged).
    await user.tab() // Upload template button
    await user.tab() // roving-tabindex active row
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

// ════════════════════════════════════════════════════════════════════════════
// Phase 100 Plan 01 Task 3 — D-02 template render stubs (TMPL-01).
//
// The badge / countdown / amber / per-extension-icon render contract for an
// ephemeral template row. These assert the TARGET markup Plan 100-06 builds:
//   - kind="template_input" + expires_at (24h out) -> "Template" badge +
//     /expires in \d+h/ caption
//   - expires_at < 1h out -> amber needs-attention class on the caption
//   - .docx/.pptx/.xlsx template -> a distinct per-extension icon (not FileIcon)
//   - NO kind/expires_at (agent file) -> NO badge, NO countdown (D-11 RED LINE)
//
// The 3 not-yet-built behaviors are `it.skip(... // TODO Plan 100-06)` so this
// suite collects + stays green at baseline; Plan 100-06 un-skips them as it
// lands the markup. The agent-file "no badge" guard is GREEN NOW (the current
// component renders no badge for any file — queryByText("Template") is null).
//
// `WorkspaceFile` gains `kind`/`expires_at` in Plan 100-06; until then the
// template fixtures carry those fields via a cast so this file type-checks today.
// ════════════════════════════════════════════════════════════════════════════
describe("FilesSection (TMPL-01 / D-02) — ephemeral template badge + countdown", () => {
  // A template uploaded ~24h ago-window: expires_at is 24h in the FUTURE.
  const templateFile = {
    id: "file-tmpl",
    path: "risk-register.docx",
    size_bytes: 18_344,
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    version: 1,
    kind: "template_input",
    expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  } as unknown as WorkspaceFile

  // A template expiring in under an hour — drives the amber needs-attention cue.
  const expiringSoonFile = {
    ...templateFile,
    id: "file-tmpl-soon",
    path: "soon.pptx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  } as unknown as WorkspaceFile

  // An ordinary agent-written file: NO kind, NO expires_at (the D-11 baseline).
  const agentFile = {
    id: "file-agent",
    path: "analysis.py",
    size_bytes: 1024,
    mime_type: "text/x-python",
    version: 2,
  } as unknown as WorkspaceFile

  beforeEach(() => {
    useViewingThread.mockReturnValue("thread-1")
  })

  it("agent file (no kind/expires_at) renders NO Template badge, NO countdown (D-11)", () => {
    // GREEN NOW: the current component renders no badge for any file, so an
    // agent file must show neither the badge nor a countdown caption. This
    // pins the D-11 RED LINE — templates are optional everywhere, agent files
    // are byte-identical.
    useWorkspaceFiles.mockReturnValue({
      data: [agentFile],
      isLoading: false,
      error: null,
      reconcile: vi.fn(),
    })
    render(<FilesSection />)
    expect(screen.queryByText("Template")).toBeNull()
    expect(screen.queryByText(/expires in/i)).toBeNull()
  })

  it("template file renders a Template badge + /expires in \\d+h/ caption", () => {
    // Plan 100-06: FilesSection renders the badge + countdown for a
    // kind='template_input' row with a future expires_at.
    useWorkspaceFiles.mockReturnValue({
      data: [templateFile],
      isLoading: false,
      error: null,
      reconcile: vi.fn(),
    })
    render(<FilesSection />)
    expect(screen.getByText("Template")).toBeInTheDocument()
    expect(screen.getByText(/expires in \d+h/i)).toBeInTheDocument()
  })

  it("a soon-to-expire template caption carries the amber needs-attention class", () => {
    // Plan 100-06: the countdown caption gets the amber needs-attention color
    // when expires_at is < 1h out (sketch D-02 / sketch-016).
    useWorkspaceFiles.mockReturnValue({
      data: [expiringSoonFile],
      isLoading: false,
      error: null,
      reconcile: vi.fn(),
    })
    render(<FilesSection />)
    const caption = screen.getByText(/expires in/i)
    expect(caption.className).toMatch(/amber/)
  })

  it("a docx/pptx/xlsx template renders a distinct per-extension icon (not FileIcon)", () => {
    // Plan 100-06: iconFor() returns a per-extension office icon for the OOXML
    // template mime types (sketch-016 per-extension icons).
    useWorkspaceFiles.mockReturnValue({
      data: [templateFile],
      isLoading: false,
      error: null,
      reconcile: vi.fn(),
    })
    render(<FilesSection />)
    // WR-07 (100-REVIEW): scope the query to the ROW — the upload affordance
    // renders a lucide-upload svg ABOVE the listbox, so container.querySelector
    // grabbed the wrong icon and the assertion was vacuous (stayed green even if
    // iconFor regressed to the generic FileIcon). docx -> FileText.
    const row = screen.getByRole("option")
    const icon = row.querySelector("svg")
    expect(icon?.classList.contains("lucide-file-text")).toBe(true)
    expect(icon?.classList.contains("lucide-file")).toBe(false)
  })
})
