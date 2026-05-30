/**
 * Phase 087 Plan 04 — VersionDiff + parseUnifiedDiff (PANEL-07, D-04).
 *
 * Wave 0 (Plan 01) shipped this file as GREEN-only `it.todo(...)` contracts;
 * Plan 04 flips them to live tests as the parser + component land.
 *
 * 087-RESEARCH Open Question #1 (RESOLVED): the file→VersionDiff binding feeds
 * `getWorkspaceFileDiff(threadId, fileId, from, to)` and renders the parsed
 * `delta.diff` string client-side (no diff library — Pattern 2).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, within, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import {
  mockDiffNonTruncated,
  mockDiffTruncated,
  mockVersions,
  mockWorkspaceFiles,
} from "./fixtures"
import { parseUnifiedDiff } from "@/lib/diffParse"
import { VersionDiff } from "../VersionDiff"

// ── Mock the api client so VersionDiff's mount-time fetches are deterministic ──
vi.mock("@/lib/api", () => ({
  getWorkspaceFileVersions: vi.fn(),
  getWorkspaceFileDiff: vi.fn(),
}))
import { getWorkspaceFileVersions, getWorkspaceFileDiff } from "@/lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// Pure parser (Task 1) — the load-bearing unit, no React.
// ─────────────────────────────────────────────────────────────────────────────
describe("parseUnifiedDiff (PANEL-07, Pattern 2) — pure unified-diff string parser", () => {
  it("classifies '@@ …' lines as hunk headers", () => {
    const lines = parseUnifiedDiff("@@ -1,5 +1,7 @@\n")
    expect(lines[0]).toMatchObject({ kind: "hunk", text: "@@ -1,5 +1,7 @@" })
  })

  it("classifies '+' (not '+++') lines as additions (sign '+', leading '+' stripped)", () => {
    const lines = parseUnifiedDiff("+added\n")
    expect(lines[0]).toMatchObject({ kind: "add", text: "added", sign: "+" })
  })

  it("classifies '-' (not '---') lines as deletions (Unicode minus sign, leading '-' stripped)", () => {
    const lines = parseUnifiedDiff("-removed\n")
    expect(lines[0]).toMatchObject({ kind: "del", text: "removed", sign: "−" })
  })

  it("classifies '--- vN' / '+++ vN' as file headers (meta — not del/add)", () => {
    const lines = parseUnifiedDiff("--- v2\n+++ v3\n")
    expect(lines[0]).toMatchObject({ kind: "header", text: "--- v2" })
    expect(lines[1]).toMatchObject({ kind: "header", text: "+++ v3" })
  })

  it("classifies remaining lines as context (single leading space stripped)", () => {
    const lines = parseUnifiedDiff(" same\n")
    expect(lines[0]).toMatchObject({ kind: "context", text: "same" })
  })

  it("parses the full ordered sequence header,header,hunk,context,del,add", () => {
    const lines = parseUnifiedDiff(
      "--- v2\n+++ v3\n@@ -1,5 +1,7 @@\n ctx\n-old\n+new\n",
    )
    expect(lines.map((l) => l.kind)).toEqual([
      "header",
      "header",
      "hunk",
      "context",
      "del",
      "add",
    ])
  })

  it("returns [] for the empty string", () => {
    expect(parseUnifiedDiff("")).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// VersionDiff component (Task 3) — pills, in-column diff, truncation, ⤢ overlay.
// ─────────────────────────────────────────────────────────────────────────────
describe("VersionDiff (PANEL-07) — version pills + in-column diff + truncation + ⤢", () => {
  const file = mockWorkspaceFiles[0] // summary.md

  beforeEach(() => {
    vi.mocked(getWorkspaceFileVersions).mockResolvedValue(mockVersions)
    vi.mocked(getWorkspaceFileDiff).mockResolvedValue(mockDiffNonTruncated)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("defaults the comparison to the latest two versions (Compare v{n-1} ↔ v{n})", async () => {
    render(<VersionDiff threadId="thread-1" file={file} />)
    await waitFor(() =>
      expect(getWorkspaceFileDiff).toHaveBeenCalledWith(
        "thread-1",
        file.id,
        2, // n-1 (base)
        3, // n   (target)
        expect.anything(),
      ),
    )
  })

  it("renders version pills with red-base / green-target text+aria labels (D5, not color-only)", async () => {
    render(<VersionDiff threadId="thread-1" file={file} />)
    expect(await screen.findByLabelText(/base version 2/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/target version 3/i)).toBeInTheDocument()
  })

  it("renders the +N / −M summary from delta.stats", async () => {
    render(<VersionDiff threadId="thread-1" file={file} />)
    expect(await screen.findByText("+2")).toBeInTheDocument()
    expect(screen.getByText("−1")).toBeInTheDocument()
  })

  it("renders add lines with '+' gutter and del lines with '−' gutter (in-column diff)", async () => {
    render(<VersionDiff threadId="thread-1" file={file} />)
    const region = await screen.findByRole("region", { name: /Diff v2 to v3/i })
    expect(within(region).getByText("new line")).toBeInTheDocument()
    expect(within(region).getByText("old line")).toBeInTheDocument()
    // the hunk header is rendered
    expect(within(region).getByText("@@ -1,5 +1,7 @@")).toBeInTheDocument()
  })

  it("does NOT surface a truncation notice when delta.truncated === false", async () => {
    render(<VersionDiff threadId="thread-1" file={file} />)
    await screen.findByRole("region", { name: /Diff v2 to v3/i })
    expect(screen.queryByText(/diff truncated/i)).not.toBeInTheDocument()
  })

  it("surfaces a 'diff truncated at 500 lines' notice when delta.truncated === true (Pitfall 4)", async () => {
    vi.mocked(getWorkspaceFileDiff).mockResolvedValue(mockDiffTruncated)
    render(<VersionDiff threadId="thread-1" file={file} />)
    expect(await screen.findByText(/diff truncated at 500 lines/i)).toBeInTheDocument()
  })

  it("the ⤢ overlay shows the SAME payload — no second fetch (D4 / Pitfall 4)", async () => {
    const user = userEvent.setup()
    render(<VersionDiff threadId="thread-1" file={file} />)
    await screen.findByRole("region", { name: /Diff v2 to v3/i })

    const fetchCallsBefore = vi.mocked(getWorkspaceFileDiff).mock.calls.length
    await user.click(screen.getByRole("button", { name: /expand diff/i }))

    // a dialog appears showing the same parsed lines
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("new line")).toBeInTheDocument()
    // and NO additional diff fetch was made
    expect(vi.mocked(getWorkspaceFileDiff).mock.calls.length).toBe(fetchCallsBefore)
  })

  // Phase 088-01 (D-13a) — structural a11y regression gate. Wait for the diff
  // region to resolve so the version pills, the +N/−M summary, the new aria-live
  // announce, and the in-column diff are all rendered before asserting. axe =
  // STRUCTURE only (Pitfall 5 — contrast is Plan 05 / Chrome MCP).
  it("has no axe violations (populated diff — pills + +N/−M aria-live + in-column diff)", async () => {
    const { container } = render(<VersionDiff threadId="thread-1" file={file} />)
    await screen.findByRole("region", { name: /Diff v2 to v3/i })
    expect(await axe(container)).toHaveNoViolations()
  })
})
