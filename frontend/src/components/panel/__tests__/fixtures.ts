/**
 * Phase 087 Plan 01 Task 3 — shared Wave 0 test fixtures + hook-mock factories.
 *
 * Every panel test file imports from here so the wire contract is defined ONCE.
 * The mock payloads mirror the backend JSON byte-for-byte (the same shapes the
 * Phase 087 components will parse), and the hook-mock factories return the
 * `{ data, isLoading, error, reconcile }` contract the Phase 086 hooks expose
 * (StreamsProvider.tsx:1758-1837) so downstream plans can mock the hooks without
 * re-deriving the shape.
 *
 * These are GREEN-only Wave 0 scaffolding: the components under test
 * (WorkspacePanel, FilePreview, CsvTablePreview, PendingAskCard, VersionDiff,
 * TodosSection, Seam renderers) are NOT built yet — each downstream plan flips
 * its own `it.todo(...)` placeholders to live assertions when it lands the
 * component, using these fixtures as the input.
 */
import { vi } from "vitest"
import type {
  Todo,
  WorkspaceFile,
  PendingAsk,
  WorkspaceVersion,
  WorkspaceFileContentInline,
  WorkspaceFileContentBucket,
  WorkspaceDiff,
} from "@/types"

// ── Todos (PANEL-02) ────────────────────────────────────────────────────────
export const mockTodos: Todo[] = [
  {
    id: "todo-1",
    content: "Read the source dataset",
    status: "completed",
    parent_id: null,
    order_index: 0,
  },
  {
    id: "todo-2",
    content: "Compute the Q3 rollup",
    status: "in_progress",
    parent_id: null,
    order_index: 1,
  },
  {
    id: "todo-3",
    content: "Write summary.md",
    status: "pending",
    parent_id: null,
    order_index: 2,
  },
]

// ── Workspace files (PANEL-03) ────────────────────────────────────────────────
export const mockWorkspaceFiles: WorkspaceFile[] = [
  {
    id: "file-md",
    path: "summary.md",
    size_bytes: 2148,
    mime_type: "text/markdown",
    version: 3,
  },
  {
    id: "file-py",
    path: "analysis.py",
    size_bytes: 1024,
    mime_type: "text/x-python",
    version: 2,
  },
  {
    id: "file-csv",
    path: "rollup.csv",
    size_bytes: 412,
    mime_type: "text/csv",
    version: 1,
  },
  {
    id: "file-png",
    path: "chart.png",
    size_bytes: 51200,
    mime_type: "image/png",
    version: 1,
  },
  {
    id: "file-bin",
    path: "deck.pptx",
    size_bytes: 5_242_880,
    mime_type:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    version: 1,
  },
]

// ── File content builders (PANEL-03, D-02 two-shape) ──────────────────────────
/** Inline content payload (small text files: md/code/csv/txt). */
export const mockContentInline = (
  mime: string,
  content = "# Summary\n\nThe Q3 rollup is complete.\n",
  path = "summary.md",
): WorkspaceFileContentInline => ({
  id: "file-md",
  path,
  size_bytes: content.length,
  mime_type: mime,
  storage_type: "inline",
  content,
})

/** Bucket content payload (binary/large: image/pptx). `signedUrl` may be null
 *  (best-effort signing — Pitfall 5: null → calm "no preview · Download"). */
export const mockContentBucket = (
  signedUrl: string | null,
  mime = "image/png",
  path = "chart.png",
): WorkspaceFileContentBucket => ({
  id: "file-png",
  path,
  size_bytes: 51200,
  mime_type: mime,
  storage_type: "bucket",
  signed_url: signedUrl,
})

// ── ask_user pending prompts (PANEL-04) ───────────────────────────────────────
/** GET-reconciled prompt — carries `run_id` (REQUIRED to POST the answer).
 *  096-04: the card's countdown now derives from `created_at` — keep it FRESH
 *  at module load so pending-state tests don't mount already-expired (the old
 *  static 2026-05-29 date would read as a long-dead prompt). */
export const mockPendingAskWithRunId: PendingAsk = {
  tool_call_id: "tc-ask-1",
  prompt: "Which dataset should I use for the Q3 rollup?",
  options: ["prod_sales_2026", "staging_sales"],
  timeout_seconds: 300,
  message_id: "msg-ask-1",
  run_id: "run-ask-1",
  created_at: new Date().toISOString(),
}

/** Pure-SSE prompt (A2 / Pitfall 1) — `run_id` ABSENT. Submit must be gated /
 *  trigger a reconcile until run_id is filled (Plan 05 owns the gate). */
export const mockPendingAskNoRunId: PendingAsk = {
  tool_call_id: "tc-ask-2",
  prompt: "Should I include the staging rows?",
  options: [],
  timeout_seconds: 300,
}

// ── Versions (PANEL-07) ───────────────────────────────────────────────────────
export const mockVersions: WorkspaceVersion[] = [
  { id: "ver-3", version: 3, size_bytes: 2148, created_at: "2026-05-29T10:05:00Z" },
  { id: "ver-2", version: 2, size_bytes: 1980, created_at: "2026-05-29T10:03:00Z" },
  { id: "ver-1", version: 1, size_bytes: 1500, created_at: "2026-05-29T10:01:00Z" },
]

// ── Diff (PANEL-07) ───────────────────────────────────────────────────────────
/** Realistic unified-diff string (difflib.unified_diff output): file headers,
 *  a hunk header, context, one deletion, one addition. VersionDiff parses this
 *  client-side line-by-line (no diff library). */
export const mockDiffString =
  "--- v2\n+++ v3\n@@ -1,5 +1,7 @@\n context line\n-old line\n+new line\n+another new line\n more context\n"

export const mockDiffNonTruncated: WorkspaceDiff = {
  path: "summary.md",
  from_version: 2,
  to_version: 3,
  delta: {
    format: "unified",
    diff: mockDiffString,
    stats: { additions: 2, deletions: 1 },
    truncated: false,
  },
  stats: { additions: 2, deletions: 1 },
}

/** Backend truncates at 500 diff lines and sets truncated:true (Pitfall 4) —
 *  the UI must surface a "diff truncated" notice; the ⤢ overlay shows the SAME
 *  (still-truncated) payload, no second fetch. */
export const mockDiffTruncated: WorkspaceDiff = {
  path: "bigfile.py",
  from_version: 1,
  to_version: 2,
  delta: {
    format: "unified",
    diff: mockDiffString,
    stats: { additions: 250, deletions: 250 },
    truncated: true,
  },
  stats: { additions: 250, deletions: 250 },
}

// ── CSV strings (PANEL-03, D-01) ──────────────────────────────────────────────
/** Valid 3-row CSV including a quoted field containing a comma — CsvTablePreview
 *  must parse the quoted comma as ONE cell, not split it. */
export const mockCsvValid =
  'name,region,total\n"Acme, Inc.",West,1200\nBeta LLC,East,980\nGamma,North,1450\n'

/** Malformed CSV (ragged rows / unbalanced quote) — CsvTablePreview must fall
 *  back to the calm "No preview available · Download" notice, never crash. */
export const mockCsvMalformed = 'name,region,total\n"unterminated,West\nBeta,East\n'

// ── Hook-mock factories ───────────────────────────────────────────────────────
/** The shared return contract of every Phase 086 panel hook
 *  (StreamsProvider.tsx:1758-1837): `data` is NEVER undefined (stable EMPTY-ref
 *  fallback), plus loading/error/reconcile. */
export interface MockPanelHookReturn<T> {
  data: T
  isLoading: boolean
  error: Error | null
  reconcile: ReturnType<typeof vi.fn>
}

/** Build a mock hook return for any panel hook. Defaults: not loading, no error,
 *  a no-op `reconcile` spy. Downstream plans pass their fixture array as `data`. */
export function makeHookReturn<T>(
  data: T,
  overrides: Partial<MockPanelHookReturn<T>> = {},
): MockPanelHookReturn<T> {
  return {
    data,
    isLoading: false,
    error: null,
    reconcile: vi.fn(),
    ...overrides,
  }
}

export const mockUseTodos = (todos: Todo[] = mockTodos) => makeHookReturn(todos)
export const mockUseWorkspaceFiles = (files: WorkspaceFile[] = mockWorkspaceFiles) =>
  makeHookReturn(files)
export const mockUseAskUserPrompt = (asks: PendingAsk[] = [mockPendingAskWithRunId]) =>
  makeHookReturn(asks)
/** `useViewingThread()` returns `string | null` (not the hook-return contract). */
export const mockViewingThread = (threadId: string | null = "thread-1") => threadId
