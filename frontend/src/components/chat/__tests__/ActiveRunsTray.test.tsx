/**
 * Phase 194 Plan 08 (RUN-01 / V-08) — the cross-thread active-runs tray.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ A STALE CLAIM, CORRECTED AND RECORDED BESIDE THE ORIGINAL
 * ─────────────────────────────────────────────────────────────────────────────
 * `194-VALIDATION.md` row V-08 names this file and marks it "✅ extend".
 * MEASURED at the phase's base: it did not exist, and `ActiveRunsTray` had NO
 * dedicated suite anywhere in the repository — its only coverage was incidental,
 * through `ChatHistoryColumn.test.tsx`, which mounts the tray as a child and
 * asserts nothing about it. So V-08 is a Wave-0 **CREATE**, not an extend. The
 * original wording is quoted rather than overwritten so a reader can see what
 * changed it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS PINS
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount 3 of SC#1 — and it is mount 3 that makes SC#1's "stoppable from OUTSIDE
 * its thread" property real. The tray is the only surface that can stop a
 * backgrounded run without navigating into it.
 *
 * The load-bearing property is D-08's "four mounts, ONE mechanism", already
 * written into the component's own docblock (`ActiveRunsTray.tsx:25-26`):
 *
 *     Every Stop routes through the one durable cancel path (`stopThread` →
 *     DELETE /runs/{id}); nothing here invents new backend behavior.
 *
 * That is not tidiness. `WorkflowLock.runId` carries a `workflow_runs.id` on two
 * of its four write sites while `DELETE /runs/{id}` accepts only the producer
 * `runs.run_id`, and `api.ts::cancelRun` swallows 404 — so a second, local
 * cancel path on this surface would be free to resolve the wrong id and SUCCEED
 * SILENTLY. Routing through `stopThread` keeps that landmine unreachable from
 * here by construction. This suite drives that RED against a real plant.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE REAL PROVIDER, NOT THE MOCKED ONE
 * ─────────────────────────────────────────────────────────────────────────────
 * `ChatHistoryColumn.test.tsx:26-30` mocks `@/providers/StreamsProvider`
 * wholesale and hands `useStreamingThreadIds` a hand-built Set. That is the
 * right shape THERE (the column is what is under test) and the wrong shape here:
 * a pre-seeded Set proves only that a listed id renders. V-08's sentence is
 * "a harness thread APPEARS IN `useStreamingThreadIds()` so `ActiveRunsTray`
 * lists it" — so membership has to be driven by the same `streamingThreads` add
 * that `sendMessage` performs (`StreamsProvider.tsx:1942-1944`), or a future
 * change that skips the add for harness kickoffs would not red anywhere.
 *
 * `stopThread` is then swapped for a spy ON the live store's actions object
 * AFTER mount, which is what lets the one-mechanism assertion be exact: with the
 * durable path stubbed out, ANY `cancelRun` call can only have come from this
 * component.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Thread } from "@/types"

const {
  mockPostMessage,
  mockSubscribeToRun,
  mockGetMessages,
  mockGetActiveRuns,
  mockGetSnapshot,
  mockCancelRun,
} = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockGetSnapshot: vi.fn(),
  mockCancelRun: vi.fn(),
}))

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return {
    ApiError: actual.ApiError,
    postMessage: mockPostMessage,
    subscribeToRun: mockSubscribeToRun,
    getMessages: mockGetMessages,
    getActiveRuns: mockGetActiveRuns,
    getSnapshot: mockGetSnapshot,
    cancelRun: mockCancelRun,
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

import { StreamsProvider, useStreamActions } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import type { StreamCallbacks } from "@/lib/api"
import { ActiveRunsTray } from "../ActiveRunsTray"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import traySource from "../ActiveRunsTray.tsx?raw"

const ISO = new Date("2026-08-16T10:00:00.000Z").toISOString()
function mkThread(id: string, title: string): Thread {
  return {
    id,
    user_id: "u",
    title,
    folder_id: null,
    created_at: ISO,
    updated_at: ISO,
  } as Thread
}

const THREADS: Thread[] = [
  mkThread("thread-A", "Quarterly close workflow"),
  mkThread("thread-B", "Contract review workflow"),
  mkThread("thread-idle", "Not running"),
]

/** Mount the tray inside the REAL provider. */
function renderTray() {
  return render(
    <StreamsProvider>
      <ActiveRunsTray threads={THREADS} />
    </StreamsProvider>,
  )
}

/** A harness that lets a hook consumer sit alongside the tray. */
let actions: ReturnType<typeof useStreamActions> | null = null
function ActionGrabber() {
  actions = useStreamActions()
  return null
}
function renderTrayWithActions() {
  return render(
    <StreamsProvider>
      <ActionGrabber />
      <ActiveRunsTray threads={THREADS} />
    </StreamsProvider>,
  )
}

function captureSse() {
  mockSubscribeToRun.mockImplementation(
    async (_runId: string, _since: string, _cb: StreamCallbacks) =>
      new Promise<void>(() => {}),
  )
}

/** Replace ONLY `stopThread` on the live store's actions with a spy. Everything
 *  else keeps working; the tray resolves it through `useStreamActions()`. */
function spyOnStopThread() {
  const spy = vi.fn()
  act(() => {
    useStreamsStore.setState((s) => ({ actions: { ...s.actions, stopThread: spy } }))
  })
  return spy
}

/** Put a thread into the streaming set WITHOUT a send. Used only where the
 *  membership itself is not what is under test (the Stop-all case needs two
 *  concurrent rows); the membership case below drives the REAL send path. */
function seedStreaming(...threadIds: string[]) {
  act(() => {
    useStreamsStore.setState((s) => {
      const next = new Set(s.streamingThreads)
      for (const t of threadIds) next.add(t)
      return { streamingThreads: next }
    })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  actions = null
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    fallbackNotices: new Map<string, string>(),
    reconcileErrors: new Map<string, Error>(),
    failedSendDrafts: new Map<string, string>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
    workflowLockByThread: new Map(),
  })
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue([])
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  mockCancelRun.mockResolvedValue(undefined)
  captureSse()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("V-08 — a harness thread is LISTED by the tray and stoppable from outside its thread", () => {
  it("a thread running a WORKFLOW reaches useStreamingThreadIds() via the real send, and the tray lists it", async () => {
    mockPostMessage.mockResolvedValueOnce({
      run_id: "producer-run-tray",
      message_id: "user-msg-tray",
    })
    renderTrayWithActions()

    // Nothing running → the tray renders NOTHING (`count === 0 → return null`).
    // Asserted first, so the positive assertion below cannot be satisfied by a
    // tray that was already on screen.
    expect(screen.queryByRole("button", { name: /run.* in progress/i })).toBeNull()

    await act(async () => {
      actions!.setViewingThread("thread-A")
    })
    let sendPromise!: Promise<void>
    await act(async () => {
      sendPromise = actions!.sendMessage("thread-A", "run the workflow", {
        workflowDefinitionId: "wf-def-1",
      })
    })
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())

    // The membership itself — the thing V-08 is a sentence about. This is the
    // `streamingThreads` add at StreamsProvider.tsx:1942-1944, driven by a real
    // harness kickoff and NOT hand-seeded.
    expect(useStreamsStore.getState().streamingThreads.has("thread-A")).toBe(true)

    // …and therefore the tray lists it.
    const counter = await screen.findByRole("button", { name: "1 run in progress" })
    expect(counter).toBeInTheDocument()
    await userEvent.click(counter)
    expect(screen.getByText("Quarterly close workflow")).toBeInTheDocument()
    // The thread that is NOT running must not be listed.
    expect(screen.queryByText("Not running")).toBeNull()
    void sendPromise
  })

  it("a row's Stop calls stopThread with THAT thread's id, exactly once", async () => {
    renderTray()
    seedStreaming("thread-B")
    const stopThread = spyOnStopThread()

    await userEvent.click(await screen.findByRole("button", { name: "1 run in progress" }))
    await userEvent.click(screen.getByRole("button", { name: "Stop run on Contract review workflow" }))

    expect(stopThread).toHaveBeenCalledTimes(1)
    expect(stopThread).toHaveBeenCalledWith("thread-B")
  })

  it("Stop all calls stopThread once per LISTED thread, and never for an idle one", async () => {
    renderTray()
    seedStreaming("thread-A", "thread-B")
    const stopThread = spyOnStopThread()

    await userEvent.click(await screen.findByRole("button", { name: "2 runs in progress" }))
    await userEvent.click(screen.getByRole("button", { name: "Stop all" }))

    expect(stopThread).toHaveBeenCalledTimes(2)
    expect(stopThread).toHaveBeenCalledWith("thread-A")
    expect(stopThread).toHaveBeenCalledWith("thread-B")
    expect(stopThread).not.toHaveBeenCalledWith("thread-idle")
  })

  it("D-08 ONE MECHANISM: the tray calls cancelRun ZERO times directly — per-row AND Stop-all", async () => {
    renderTray()
    seedStreaming("thread-A", "thread-B")
    const stopThread = spyOnStopThread()

    await userEvent.click(await screen.findByRole("button", { name: "2 runs in progress" }))
    await userEvent.click(screen.getByRole("button", { name: "Stop run on Quarterly close workflow" }))
    await userEvent.click(screen.getByRole("button", { name: "Stop all" }))

    // The durable path is stubbed, so any cancelRun call can ONLY have come
    // from this component. Three Stop gestures, zero direct cancels.
    expect(stopThread).toHaveBeenCalledTimes(3)
    expect(mockCancelRun).toHaveBeenCalledTimes(0)
  })

  it("SOURCE FENCE: no cancel call is written into ActiveRunsTray.tsx on ANY path", () => {
    // The runtime cases above only see the paths they click. This sweep covers
    // a cancel written onto a branch no test exercises.
    //
    // ⚠ Comments are stripped FIRST — and the honest scope of that is stated
    // rather than overclaimed. MEASURED at this commit:
    // `grep -c "cancelRun" ActiveRunsTray.tsx` → **0**, and the docblock says
    // "cancel path", not `cancelRun`. So for THIS needle the strip is
    // DEFENSIVE, not load-bearing today; it is kept because the bare-grep trap
    // (a needle matching the module's own prose, so a doc edit reds a fence
    // about wiring) has been tripped four times in Phase 194 alone, and because
    // `:25-26` is exactly the sort of docblock that acquires the literal
    // `cancelRun` the next time someone documents this rule more precisely.
    const stripped = traySource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")

    // POSITIVE CONTROL, and it runs before the absence clauses: an absence
    // assertion cannot detect its own blindness, so prove the haystack is real
    // and still contains the thing it is supposed to contain.
    expect(stripped.length).toBeGreaterThan(500)
    expect(stripped).toContain("streamActions.stopThread(")
    /**
     * ⚠ SUPERSEDED IN PLACE BY 194.1-05 TASK 2 — `toHaveLength(2)` → `(1)`. The
     * original figure is quoted here rather than overwritten (193.2 WR-05).
     *
     * SUPERSEDED (Phase 194):
     *   expect(stripped.match(/streamActions\.stopThread\(/g) ?? []).toHaveLength(2)
     *
     * The TWO were the per-row Stop and `Stop all`. The per-row Stop is now the
     * shared `<StopControl>`, which owns the dispatch, so this module's own call
     * count fell to ONE — `Stop all`, which is byte-untouched by decision (a bulk
     * control over N threads is not a per-thread mount; see the file's docblock).
     *
     * ⚠ THE COUNT IS KEPT EXACT RATHER THAN RELAXED TO `toBeGreaterThan(0)`, and
     * that is the whole value of this clause: an exact count is what would catch a
     * SECOND cancel path being added back to this file, which is the failure the
     * fence exists for. A loosened count would report green about exactly that.
     */
    expect(stripped.match(/streamActions\.stopThread\(/g) ?? []).toHaveLength(1)
    // …and the per-row Stop is genuinely still there, reached through the shared
    // component. Without this clause the lowered count above is equally consistent
    // with the per-row Stop having simply been DELETED.
    expect(stripped).toContain("<StopControl")
    expect(stripped.match(/<StopControl/g) ?? []).toHaveLength(1)

    // The absence clauses.
    expect(stripped).not.toContain("cancelRun")
    expect(stripped).not.toMatch(/from\s+"@\/lib\/api"/)
    expect(stripped).not.toMatch(/fetch\s*\(/)
  })
})
