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

// ════════════════════════════════════════════════════════════════════════════
// Phase 195 Plan 05 Task 2 — the cases the CONVERSION made load-bearing.
//
// ADDITIONS ONLY. Not one title above this line was renamed and not one
// `expect` above it was weakened; the 11 shipped cases are the contract the
// conversion had to survive, and they did, unedited, at the task-1 commit.
//
// Every case below covers a property that had NO coverage anywhere in the tree
// before this phase, or that only became load-bearing when the row's markup
// moved into `components/files/FileRow.tsx`:
//
//   · arrow-key roving focus THROUGH the shared row (the ref-forwarding
//     INTEGRATION — `FileRow.test.tsx` unit-tests a ref passed TO the row;
//     nothing tested a ref passed to the row's CALLER-SUPPLIED CHILD)
//   · the mime-first branches, which now come from `fileIcon`'s `mimeType`
//     option instead of from a map this file's subject used to own
//   · the code-extension coverage — the 11 shipped cases exercise docx/pptx/xlsx
//     ONLY, so a whole category could regress invisibly
//   · the meta string, the panel's AA token, the full-path label and the row's
//     shipped padding — the four properties measured LIVE in `195-BASELINE.md`
//     that a "one row markup" unification could quietly converge away
//
// ⚠ EVERY COLOUR-ADJACENT ASSERTION IS ON A CLASS / TOKEN NAME, NEVER ON A
//   RESOLVED `rgb()`. jsdom renders the DARK theme, where `--muted-foreground`
//   and `--panel-muted-foreground` are IDENTICAL (`index.css:105`/`:151`, both
//   `220 16% 65%`) and diverge ONLY in light (`:30` `220 9% 46%` vs `:59`
//   `220 12% 40%`). `PanelSection.tsx:85` records WHY the panel token exists:
//   light `--muted-foreground` measured 4.01:1, BELOW the 4.5:1 AA floor. So a
//   resolved-colour assertion here would pass green while a light-theme contrast
//   regression shipped. Do not "improve" these into `toHaveStyle`.
//
// ⚠ EVERY CASE RENDERS EXACTLY ONCE. RTL's `screen`/`queryByText` are bound to
//   the SHARED `document.body`, not to a render result, so two renders in one
//   case make each read the other's tree (measured in 195-03, deviation 5).
// ════════════════════════════════════════════════════════════════════════════
describe("FilesSection (Phase 195-05) — the shared-row conversion contract", () => {
  /** The row's glyph, scoped to the ROW (the upload affordance renders its own
   *  svg ABOVE the listbox — the WR-07 lesson, restated so it is not re-learned). */
  const glyphOf = (row: HTMLElement) => row.querySelector("svg")

  /** Every span on the row that wraps an svg — the icon chain. */
  const iconSpansOf = (row: HTMLElement) =>
    Array.from(row.querySelectorAll("span")).filter((s) => s.querySelector("svg"))

  const mockFiles = (data: unknown[]) => {
    useWorkspaceFiles.mockReturnValue({
      data,
      isLoading: false,
      error: null,
      reconcile: vi.fn(),
    })
  }

  beforeEach(() => {
    useViewingThread.mockReturnValue("thread-1")
  })

  // ── 1. Arrow-key roving focus ──────────────────────────────────────────────
  it("ArrowDown moves focus to the next option row and ArrowUp returns (roving focus through the shared row)", async () => {
    // ⚠ THIS IS THE CASE THAT CATCHES A ROW SWALLOWING THE `ref`. The section
    // stores each row element in `rowRefs` (a Map) and the arrow handler calls
    // `.focus()` on the stored node. If the shared row dropped the caller's ref
    // callback, the Map would be empty, `?.focus()` would be a silent no-op, and
    // ArrowDown would stop moving focus — for KEYBOARD USERS ONLY, with every
    // other case in this file still green. `195-RESEARCH.md` names arrow-key
    // roving as one of two properties nothing in the tree covered.
    mockFiles([
      { id: "f1", path: "one.md", size_bytes: 100, mime_type: "text/markdown", version: 1 },
      { id: "f2", path: "two.md", size_bytes: 200, mime_type: "text/markdown", version: 1 },
    ])
    render(<FilesSection />)
    const user = userEvent.setup()
    const rows = screen.getAllByRole("option")
    expect(rows).toHaveLength(2)

    rows[0].focus()
    expect(document.activeElement).toBe(rows[0])

    await user.keyboard("{ArrowDown}")
    expect(document.activeElement).toBe(rows[1])

    await user.keyboard("{ArrowUp}")
    expect(document.activeElement).toBe(rows[0])
  })

  // ── 2. The mime-first branches ─────────────────────────────────────────────
  it("mime-first: an EXTENSIONLESS path with mime_type text/csv renders the table glyph", () => {
    // Before this phase these branches came from a mime-first map this file's
    // subject owned; they now come from `fileIcon`'s `mimeType` option, and the
    // option is only reached because every row passes `mimeType={file.mime_type}`.
    // Nothing pinned that prop, so dropping it would silently delete the whole
    // mime-first regime.
    mockFiles([{ id: "f-csv", path: "rollup", size_bytes: 412, mime_type: "text/csv", version: 1 }])
    render(<FilesSection />)
    expect(glyphOf(screen.getByRole("option"))?.classList.contains("lucide-table")).toBe(true)
  })

  it("mime-first: an EXTENSIONLESS path with mime_type image/png renders the image glyph", () => {
    mockFiles([{ id: "f-png", path: "chart", size_bytes: 51200, mime_type: "image/png", version: 1 }])
    render(<FilesSection />)
    expect(glyphOf(screen.getByRole("option"))?.classList.contains("lucide-image")).toBe(true)
  })

  // ── 3. The code-extension coverage the 11 shipped cases cannot see ─────────
  it("a .sql file renders the CODE glyph, not the default document glyph", () => {
    // ⚠ THE REGRESSION THIS PHASE ALMOST SHIPPED. The deleted local map carried a
    // 14-entry code-extension list; the shared module's map omitted NINE of them
    // (`tsx jsx mjs sh bash sql yml yaml css`), so every one of those files would
    // have fallen from the code glyph to the document default the moment the panel
    // adopted the shared module. Plan 195-03 added all nine. This case is the
    // panel-side proof that the fix reaches THIS surface — the 11 shipped cases
    // exercise docx/pptx/xlsx only and are structurally blind to it.
    // `mime_type` is deliberately `text/plain`, i.e. a mime that would resolve to
    // the DOCUMENT glyph on its own: the extension must outrank the bare `text/`
    // fallthrough, which is the panel's shipped order.
    mockFiles([{ id: "f-sql", path: "migrate.sql", size_bytes: 512, mime_type: "text/plain", version: 1 }])
    render(<FilesSection />)
    const icon = glyphOf(screen.getByRole("option"))
    expect(icon?.classList.contains("lucide-code")).toBe(true)
    expect(icon?.classList.contains("lucide-file-text")).toBe(false)
  })

  it("NEGATIVE CONTROL: an extension in NO map still renders the document default", () => {
    // Without this, the .sql case could not distinguish "the map carries sql"
    // from "the default happens to be Code".
    mockFiles([{ id: "f-zzz", path: "archive.zzz", size_bytes: 10, mime_type: "application/octet-stream", version: 1 }])
    render(<FilesSection />)
    expect(glyphOf(screen.getByRole("option"))?.classList.contains("lucide-file-text")).toBe(true)
  })

  // ── 4. The meta string is byte-identical ───────────────────────────────────
  it("the size + version meta renders as the single string \"376 B · v2\" in ONE element", () => {
    // The shipped contract (pre-conversion `FilesSection.tsx:265-268`) put both
    // halves in ONE span. Post-conversion it is assembled from the shared row's
    // `sizeBytes` + `metaSuffix`. `getByText` with an exact string joins only the
    // DIRECT text children of an element, so this passes ONLY if both halves are
    // still in the same element — splitting them across two spans reds it.
    mockFiles([{ id: "f-meta", path: "notes.txt", size_bytes: 376, mime_type: "text/plain", version: 2 }])
    render(<FilesSection />)
    expect(screen.getByText("376 B · v2")).toBeInTheDocument()
  })

  // ── 5. The glyph delta, as a PASSING case rather than as prose ─────────────
  it("DELIBERATE GLYPH CHANGE (Phase 195): an .xlsx row renders lucide-table, not lucide-file-spreadsheet", () => {
    // ⚠ READ THIS BEFORE FILING A BUG. Before Phase 195 this row rendered
    // `lucide-file-spreadsheet`; it now renders `lucide-table`. That is a
    // DELIBERATE, RECORDED change, not a regression.
    //
    // WHY: Phase 195 SC#2 is "no second file UI" — exactly ONE icon path in the
    // tree. This section used to carry its own ext/mime -> glyph map, a second
    // one lived on the run page and a third in `@/lib/fileIcon`. Phase 195 keeps
    // the DECLARED shared module (D-07) and deletes the other two, so the four
    // categories where the maps disagreed change glyph on this surface:
    //     tables   lucide-file-spreadsheet -> lucide-table
    //     code     lucide-file-code        -> lucide-code
    //     images   lucide-file-image       -> lucide-image
    //     unknown  lucide-file             -> lucide-file-text
    // Same category, different lucide glyph, VISIBLE. Recorded in
    // `fileIcon.tsx:47-59` and in `FilesSection.tsx`'s docblock; D-18 declined a
    // sketch for an already-design-reviewed surface, so this case IS the record.
    // docx/pptx glyphs are UNCHANGED, which is why the shipped template cases
    // stayed green.
    mockFiles([
      {
        id: "f-xlsx",
        path: "rollup.xlsx",
        size_bytes: 2048,
        mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
      },
    ])
    render(<FilesSection />)
    const icon = glyphOf(screen.getByRole("option"))
    expect(icon?.classList.contains("lucide-table")).toBe(true)
    expect(icon?.classList.contains("lucide-file-spreadsheet")).toBe(false)
  })

  // ── 6. The panel's AA token survived the unification ───────────────────────
  it("the row keeps the PANEL-scoped muted token on its icon and its meta, and never the global one", () => {
    // ⚠ THE ASSERTION THAT A DARK-THEME TEST CANNOT MAKE ANY OTHER WAY. Both
    // tokens resolve to the SAME colour in the shipped dark theme, so
    // `toHaveStyle`/`getComputedStyle` cannot tell them apart here — and the one
    // place they differ is LIGHT, where `--muted-foreground` measured 4.01:1,
    // below the AA floor (`PanelSection.tsx:85`). A "one row markup" unification
    // that converged this surface onto the global token would be invisible to
    // every dark-theme screenshot AND to every resolved-colour assertion, and
    // would ship a light-theme contrast regression. Hence: token NAMES.
    mockFiles([{ id: "f-tok", path: "notes.txt", size_bytes: 376, mime_type: "text/plain", version: 2 }])
    render(<FilesSection />)
    const row = screen.getByRole("option")

    const iconSpans = iconSpansOf(row)
    expect(iconSpans.length).toBeGreaterThan(0)
    expect(iconSpans.some((s) => s.classList.contains("text-panel-muted-foreground"))).toBe(true)
    iconSpans.forEach((s) => expect(s.classList.contains("text-muted-foreground")).toBe(false))

    const meta = screen.getByText("376 B · v2")
    expect(meta.classList.contains("text-panel-muted-foreground")).toBe(true)
    expect(meta.classList.contains("text-muted-foreground")).toBe(false)
  })

  // ── 7. The label is the FULL PATH, not the basename ────────────────────────
  it("the label is the FULL PATH in font-mono — the basename alone appears NOWHERE", () => {
    // Measured live on 2026-08-17 (`195-BASELINE.md` arm 3): the panel shows
    // `/Northwind-QBR-Template.docx` while the run page shows the basename. The
    // two densities differ ON PURPOSE and the shared row takes the label from its
    // CALLER for exactly that reason. Converging them would be a silent product
    // change, so the absence of the basename is asserted, not just the presence
    // of the path.
    mockFiles([
      {
        id: "f-path",
        path: "/reports/Q3/Northwind-QBR-Template.docx",
        size_bytes: 39660,
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        version: 1,
      },
    ])
    render(<FilesSection />)
    const label = screen.getByText("/reports/Q3/Northwind-QBR-Template.docx")
    expect(label.classList.contains("font-mono")).toBe(true)
    expect(screen.queryByText("Northwind-QBR-Template.docx")).toBeNull()
    // and the live-measured size formatting is KiB, unchanged: 39660/1024 = 38.7
    expect(screen.getByText("38.7 KB · v1")).toBeInTheDocument()
  })

  // ── 8. The row's shipped skin stayed on the row ────────────────────────────
  it("the option row keeps its shipped px-2.5 py-2 padding and cursor-pointer (the panel density, not the run one)", () => {
    // `195-BASELINE.md`: the panel row computes `8px 10px` and 38px tall; the run
    // page's row is `px-2 py-2` and 33px. Radix `mergeProps` JOINS `className`
    // rather than twMerging it, so the shared row deliberately carries LAYOUT
    // ONLY and every padding/border/ring class stays with this caller. If a
    // future edit moved padding into the shared row, the two surfaces would fight
    // over the same property and one would win by class order.
    mockFiles([{ id: "f-skin", path: "notes.txt", size_bytes: 376, mime_type: "text/plain", version: 2 }])
    render(<FilesSection />)
    const row = screen.getByRole("option")
    expect(row.classList.contains("px-2.5")).toBe(true)
    expect(row.classList.contains("py-2")).toBe(true)
    expect(row.classList.contains("cursor-pointer")).toBe(true)
    // the shared row's layout classes merged ON, they did not replace
    expect(row.classList.contains("flex")).toBe(true)
    expect(row.classList.contains("items-center")).toBe(true)
    expect(row.classList.contains("gap-2")).toBe(true)
    // ⚠ and the run page's tighter padding did NOT come along with the markup
    expect(row.classList.contains("px-2")).toBe(false)
  })

  // ── 9. Activation is PREVIEW, never download ───────────────────────────────
  it("activating a row opens the PREVIEW and renders no download affordance (the panel is not the run page)", async () => {
    // The shared row can render a download glyph, a spinner or the D-08 dead
    // affordance. The panel asks for NONE of them (`trailing="none"`) because its
    // activation is a drill-in preview, and the previewer is named HERE, never in
    // the shared row. `195-BASELINE.md` arm 3: run page = download, panel =
    // preview. Converging those would be a product change disguised as a refactor.
    mockFiles([{ id: "f-act", path: "notes.txt", size_bytes: 376, mime_type: "text/plain", version: 2 }])
    const { container } = render(<FilesSection />)
    const row = screen.getByRole("option")
    expect(row.querySelectorAll("a")).toHaveLength(0)
    expect(row.querySelectorAll("button")).toHaveLength(0)
    expect(row.querySelector(".lucide-download")).toBeNull()
    expect(row.querySelector("[aria-disabled='true']")).toBeNull()
    // container-scoped, NOT `screen` — see the shared-body warning in the header
    expect(container.querySelector("[data-testid='file-preview']")).toBeNull()
    // ⚠ `userEvent`, not a bare `row.click()`: the raw DOM call fires outside
    // `act(...)`, so React's state update is not flushed before the assertion and
    // the case reds for a reason that has nothing to do with its subject.
    await userEvent.setup().click(row)
    expect(container.querySelector("[data-testid='file-preview']")).not.toBeNull()
  })
})
