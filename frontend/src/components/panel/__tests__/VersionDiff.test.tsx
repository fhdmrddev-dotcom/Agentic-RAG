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


describe("parseUnifiedDiff — the line-number gutter (Phase 200, sketch `run-panel-parts.html`)", () => {
  /** A hunk starting at line 12 on BOTH sides — the sheet's own 12 / 13 / 14 / 15. */
  const DIFF = ["@@ -12,4 +12,5 @@", " context-a", "-removed", "+added-one", "+added-two", " context-b", ""].join("\n")

  it("numbers a context line on BOTH sides — it exists in both files", () => {
    const lines = parseUnifiedDiff(DIFF)
    expect(lines[1]).toMatchObject({ kind: "context", oldLine: 12, newLine: 12 })
  })

  it("a DELETION carries only its before-file position — it has none in the after file", () => {
    // ⚠ NOT A DETAIL. Giving a deleted line an after-file number would point a reader at
    // whatever now occupies that position, which is a different line entirely.
    const lines = parseUnifiedDiff(DIFF)
    expect(lines[2]).toMatchObject({ kind: "del", oldLine: 13 })
    expect(lines[2].newLine).toBeUndefined()
  })

  it("an ADDITION carries only its after-file position — it had none in the before file", () => {
    const lines = parseUnifiedDiff(DIFF)
    expect(lines[3]).toMatchObject({ kind: "add", newLine: 13 })
    expect(lines[3].oldLine).toBeUndefined()
    expect(lines[4]).toMatchObject({ kind: "add", newLine: 14 })
  })

  it("the two counters advance INDEPENDENTLY, which is the whole reason both are carried", () => {
    // After one deletion and two additions the sides have diverged: the trailing context
    // line is 14 in the before file and 15 in the after file. A single counter cannot say
    // this, and a gutter built from one would be wrong for every line past the first change.
    const lines = parseUnifiedDiff(DIFF)
    expect(lines[5]).toMatchObject({ kind: "context", oldLine: 14, newLine: 15 })
  })

  it("hunk and file-header rows are numbered NEITHER — they are not lines of the file", () => {
    const lines = parseUnifiedDiff("--- v2\n+++ v3\n@@ -12,4 +12,5 @@\n context\n")
    for (const i of [0, 1, 2]) {
      expect(lines[i].oldLine).toBeUndefined()
      expect(lines[i].newLine).toBeUndefined()
    }
    // NON-VACUITY: the header really did seed the counters for the body below it.
    expect(lines[3]).toMatchObject({ oldLine: 12, newLine: 12 })
  })

  it("reads the COUNT-LESS single-line hunk form difflib emits", () => {
    const lines = parseUnifiedDiff("@@ -7 +9 @@\n context\n")
    expect(lines[1]).toMatchObject({ oldLine: 7, newLine: 9 })
  })

  it("⚠ NO HUNK HEADER MEANS NO NUMBERS — never a count that starts at 1 and is wrong", () => {
    // A plausible-looking wrong line number is worse than a blank gutter: a reader would
    // use it to find the line in the real file. So a malformed diff renders unnumbered.
    const lines = parseUnifiedDiff(" context\n+added\n")
    expect(lines[0].oldLine).toBeUndefined()
    expect(lines[0].newLine).toBeUndefined()
    expect(lines[1].newLine).toBeUndefined()
    // ...and a CORRUPT header does not silently re-base the lines after it either.
    const corrupt = parseUnifiedDiff("@@ garbage @@\n context\n")
    expect(corrupt[1].oldLine).toBeUndefined()
  })

  it("a SECOND hunk re-seeds both counters rather than continuing the first", () => {
    const two = parseUnifiedDiff("@@ -1,1 +1,1 @@\n a\n@@ -40,1 +42,1 @@\n b\n")
    expect(two[1]).toMatchObject({ oldLine: 1, newLine: 1 })
    expect(two[3]).toMatchObject({ oldLine: 40, newLine: 42 })
  })

  it("leaves `kind`, `text` and `sign` exactly as they shipped", () => {
    // The numbers were ADDED to the shape; nothing about what a reader sees was rewritten.
    const lines = parseUnifiedDiff(DIFF)
    expect(lines.map((l) => l.kind)).toEqual([
      "hunk",
      "context",
      "del",
      "add",
      "add",
      "context",
    ])
    expect(lines[2]).toMatchObject({ text: "removed", sign: "−" })
    expect(lines[3]).toMatchObject({ text: "added-one", sign: "+" })
  })
})
