/**
 * Phase 244-08 (T-244-05-05 / OPEN-2) — THE EXPIRED CHIP IS REACHABLE AFTER A RELOAD.
 *
 * ⛔ THE DEFECT. `244-05`'s declared mitigation is verbatim: *"the chip must say `No longer
 * available`, never disappear."* The `expired` arm was BUILT (`ChatAttachmentChip.tsx:206-219`)
 * and could not render after a reload, because `GET /threads/{id}/workspace/files` filtered
 * expired rows away server-side — so `attachmentsForMessage` found nothing for that row and the
 * chip vanished from the old transcript. `ChatAttachmentChip.states.test.tsx` was green
 * throughout, because it hands the component an expired row DIRECTLY; nothing tested whether a
 * row could ever GET there. **A component test cannot see a missing supply line.**
 *
 * ── ⭐ THE SHAPE OF THE FIX, AND WHY IT IS TWO HOOKS AND NOT TWO FETCHES ────────────────────
 *
 * `workspaceFilesByThread` is ONE store slice with THREE readers:
 *
 *   · `useWorkspaceFiles`         -> the PANEL (`FilesSection`, `WorkspacePanel`) — fetches
 *   · `useWorkspaceFilesSnapshot` -> the TRANSCRIPT (`MessageItem`) — pure read, no fetch
 *
 * Giving the transcript its own fetch was rejected by 244-05 for a measured reason recorded at
 * `StreamsProvider.tsx:4002`: `MessageItem` renders once per message, so a fetching hook there
 * is N fetches per thread mount. So the SLICE carries everything and the PANEL filters — the
 * expiry decision moves from the server to the reader that cares, which is the same shape
 * `chatAttachmentState` already uses (derive from `expires_at`, never from a passed flag).
 *
 * ⛔ WHAT THE TOMBSTONE IS NOT. Case 3 is the negative: the panel must NOT list an expired row.
 * Without it, "the transcript can see expired files" and "expired files came back everywhere"
 * are the same green — and the panel offers a PREVIEW, whose content route 404s, so a listed
 * expired row there is a broken affordance, not an honest one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, cleanup } from "@testing-library/react"

const { mockGetThreadWorkspaceFiles } = vi.hoisted(() => ({
  mockGetThreadWorkspaceFiles: vi.fn(),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getThreadWorkspaceFiles: mockGetThreadWorkspaceFiles,
    getThreadTodos: vi.fn().mockResolvedValue([]),
    getThreadPendingAsks: vi.fn().mockResolvedValue([]),
    getThreadPhases: vi.fn().mockResolvedValue([]),
    getActiveRuns: vi.fn().mockResolvedValue([]),
  }
})

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

import { StreamsProvider } from "@/providers/StreamsProvider"
import { useWorkspaceFiles, useWorkspaceFilesSnapshot } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import type { WorkspaceFile } from "@/types"

/**
 * ⛔ THE WRAPPER IS LOAD-BEARING, AND ITS ABSENCE IS THE TRAP `244-05` SHIPPED.
 *
 * `usePanelReconcile` writes through `s.actions.replaceWorkspaceFilesForThread`, and
 * `streamsStore.ts:463` initialises that — with the other ten panel actions — as a SYNCHRONOUS
 * NO-OP STUB, which `StreamsProvider` overwrites on mount. A `renderHook` with no provider
 * therefore fetches, resolves, calls a function that does nothing, and reports an empty slice.
 *
 * ⚠ THAT IS INDISTINGUISHABLE FROM THE FEATURE BEING BROKEN. It is exactly how `244-05`
 * shipped a textbook-looking RED whose cases would have failed over a CORRECT implementation
 * too. Case 4 below is the positive control that caught it here: it asserts a NULL-expiry agent
 * file survives, which must be true before and after this fix — so its failing meant the
 * harness was wrong, not the code.
 */
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StreamsProvider>{children}</StreamsProvider>
)

const THREAD = "thread-tomb"

/** An attachment whose 24h TTL ran out yesterday — the row an old transcript must still name. */
const EXPIRED: WorkspaceFile = {
  id: "wf-expired",
  path: "/abc12345-Meridian-Q4.docx",
  size_bytes: 20481,
  mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  created_at: "2026-09-10T09:00:00Z",
  updated_at: "2026-09-10T09:00:00Z",
  kind: "template_input",
  expires_at: "2026-09-11T09:00:00Z",
} as WorkspaceFile

/** A live agent-written file: NULL expiry, so it passes every gate and must be unaffected. */
const AGENT_FILE: WorkspaceFile = {
  id: "wf-agent",
  path: "/output/chart.png",
  size_bytes: 4096,
  mime_type: "image/png",
  created_at: "2026-09-11T10:00:00Z",
  updated_at: "2026-09-11T10:00:00Z",
  kind: "workspace_write",
} as WorkspaceFile

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useStreamsStore.setState({ workspaceFilesByThread: new Map() })
})

afterEach(() => cleanup())

describe("T-244-05-05 — an expired attachment leaves a tombstone the transcript can render", () => {
  it("1 — the panel's fetch ASKS for expired rows, so the slice can hold one", async () => {
    mockGetThreadWorkspaceFiles.mockResolvedValue([AGENT_FILE, EXPIRED])
    renderHook(() => useWorkspaceFiles(THREAD), { wrapper })

    await waitFor(() => expect(mockGetThreadWorkspaceFiles).toHaveBeenCalled())

    // ⚠ Read the ACTUAL argument, never `toHaveBeenCalledWith` against a guess — the fetcher
    // is handed to `usePanelReconcile`, which supplies its own AbortSignal in between.
    const opts = mockGetThreadWorkspaceFiles.mock.calls[0]?.[2]
    expect(opts?.includeExpired).toBe(true)
  })

  // ⚠ CASE 2 IS A CHARACTERIZATION, NOT RED EVIDENCE — said plainly rather than counted with
  // the others. The CLIENT already passes every row the wire sends straight into the slice, so
  // this case was GREEN before the fix: the disappearance happens one layer down, where the
  // SERVER filtered the row away before it could ever be fetched (that half is RED in
  // `backend/tests/unit/test_244_08_expired_attachment_is_a_tombstone.py`). It is here because
  // the client half is the one a future refactor would break silently — a `.filter()` added to
  // the snapshot hook, or `expires_at` dropped from the select, and the tombstone is gone again
  // with the backend still perfectly correct.
  it("2 — the TRANSCRIPT's snapshot hook sees the expired row", async () => {
    mockGetThreadWorkspaceFiles.mockResolvedValue([AGENT_FILE, EXPIRED])
    const panel = renderHook(() => useWorkspaceFiles(THREAD), { wrapper })
    await waitFor(() => expect(panel.result.current.isLoading).toBe(false))

    const { result } = renderHook(() => useWorkspaceFilesSnapshot(THREAD), { wrapper })
    await waitFor(() =>
      expect(result.current.map((f) => f.id)).toContain("wf-expired"),
    )
    // The field the chip derives its state from must survive the trip.
    expect(result.current.find((f) => f.id === "wf-expired")?.expires_at).toBeTruthy()
  })

  it("3 — the PANEL's hook does NOT, so an expired row is never offered for preview", async () => {
    mockGetThreadWorkspaceFiles.mockResolvedValue([AGENT_FILE, EXPIRED])
    const { result } = renderHook(() => useWorkspaceFiles(THREAD), { wrapper })

    await waitFor(() => expect(result.current.data.length).toBeGreaterThan(0))
    expect(result.current.data.map((f) => f.id)).toEqual(["wf-agent"])
    expect(result.current.data.map((f) => f.id)).not.toContain("wf-expired")
  })

  it("4 — a NULL-expiry agent file is untouched on both sides (the positive control)", async () => {
    // Without this, cases 2 and 3 would pass just as happily on a tree where the panel had
    // simply stopped listing anything at all.
    mockGetThreadWorkspaceFiles.mockResolvedValue([AGENT_FILE])
    const { result } = renderHook(() => useWorkspaceFiles(THREAD), { wrapper })

    await waitFor(() => expect(result.current.data.length).toBe(1))
    expect(result.current.data[0].id).toBe("wf-agent")

    const snap = renderHook(() => useWorkspaceFilesSnapshot(THREAD), { wrapper })
    expect(snap.result.current.map((f) => f.id)).toEqual(["wf-agent"])
  })

  it("5 — the panel's filtered array keeps a STABLE identity across re-renders", async () => {
    // ⛔ NOT A STYLE POINT. `useWorkspaceFiles` returns a store-selector result; filtering
    // inside the selector would mint a new array every render and re-render every consumer on
    // every unrelated stream delta. `FilesSection` and `WorkspacePanel` both read this.
    mockGetThreadWorkspaceFiles.mockResolvedValue([AGENT_FILE, EXPIRED])
    const { result, rerender } = renderHook(() => useWorkspaceFiles(THREAD), { wrapper })

    await waitFor(() => expect(result.current.data.length).toBe(1))
    const first = result.current.data
    rerender()
    expect(result.current.data).toBe(first)
  })
})
