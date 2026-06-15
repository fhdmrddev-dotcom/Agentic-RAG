/**
 * Phase 101.1-09 (gap 6 + gap 4 frontend) — the phase_substep demux + the
 * terminal workspace refetch.
 *
 * Mirrors phaseHooks.test.tsx: partial-mock @/lib/api to keep the REAL
 * subscribeToRun + makeStreamCallbacks (the demux under test), overriding only
 * the GET helpers so the provider mount stays off the network. Replays raw SSE
 * wire frames through the REAL line parser.
 *
 * Task 2 (gap 6, panel-only additive):
 *   - a `phase_substep` SSE populates Phase.emitSubStep / emitFailure on the
 *     OWNING thread's phasesByThread row (the existing rail renders them).
 *   - PANEL-09: the demux writes phasesByThread ONLY — bucketsBySurface ref is
 *     UNCHANGED (zero chat re-render, Deep byte-identical).
 *   - Pitfall 6 isolation: a background thread's phase_substep never touches the
 *     viewed thread's rail.
 *
 * Task 3 (gap 4 frontend half):
 *   - a harness terminal (run_completed "completed") triggers a workspace-files
 *     refetch for the owning thread (a just-persisted deliverable appears w/o F5).
 *   - the refetch is scoped to the owning threadId.
 *   - a Deep (non-harness) completion does NOT trigger the workspace refetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Todo, WorkspaceFile, PendingAsk, TaskRunIndexItem, Phase } from "@/types"

// ── Mock Supabase auth so module load + getAuthHeaders don't reach a real URL ──
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

// ── Partial-mock @/lib/api: keep the REAL subscribeToRun + makeStreamCallbacks;
//    override only the panel GET helpers so the provider mount + the gap-4
//    terminal refetch don't hit the network. ──
const {
  mockGetThreadTodos,
  mockGetThreadWorkspaceFiles,
  mockGetThreadPendingAsks,
  mockGetThreadTasks,
  mockGetThreadWorkflow,
} = vi.hoisted(() => ({
  mockGetThreadTodos: vi.fn(),
  mockGetThreadWorkspaceFiles: vi.fn(),
  mockGetThreadPendingAsks: vi.fn(),
  mockGetThreadTasks: vi.fn(),
  mockGetThreadWorkflow: vi.fn(),
}))

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    getThreadTodos: mockGetThreadTodos,
    getThreadWorkspaceFiles: mockGetThreadWorkspaceFiles,
    getThreadPendingAsks: mockGetThreadPendingAsks,
    getThreadTasks: mockGetThreadTasks,
    getThreadWorkflow: mockGetThreadWorkflow,
    getSnapshot: vi.fn().mockResolvedValue({ messages: [], active_runs: [] }),
    getMessages: vi.fn().mockResolvedValue([]),
    getActiveRuns: vi.fn().mockResolvedValue([]),
  }
})

import { subscribeToRun, type StreamCallbacks } from "@/lib/api"
import { makeStreamCallbacks, StreamsProvider, useTodos } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"

const THREAD_A = "thread-A"
const THREAD_B = "thread-B"
const ASSISTANT_ID = "assistant-1"

// ── SSE wire-byte helper (port of phaseHooks.test.tsx) ────────────────────────
function mockSseFetch(chunks: string[], status = 200) {
  const encoder = new TextEncoder()
  const queue = chunks.map((c) => encoder.encode(c))
  const body = {
    getReader() {
      return {
        async read() {
          const next = queue.shift()
          if (next === undefined) return { done: true, value: undefined }
          return { done: false, value: next }
        },
      }
    },
  }
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, body })
}

function phaseCallbacks(threadId: string): StreamCallbacks {
  return makeStreamCallbacks({
    assistantId: ASSISTANT_ID,
    threadId,
    setMessages: () => {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000")
  localStorage.clear()
  mockGetThreadWorkspaceFiles.mockResolvedValue([])
  mockGetThreadWorkflow.mockResolvedValue({ mode: "deep", phases: null })
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    fallbackNotices: new Map<string, string>(),
    reconcileErrors: new Map<string, Error>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
    todosByThread: new Map<string, Todo[]>(),
    workspaceFilesByThread: new Map<string, WorkspaceFile[]>(),
    pendingAsksByThread: new Map<string, PendingAsk[]>(),
    tasksByThread: new Map<string, TaskRunIndexItem[]>(),
    phasesByThread: new Map<string, Phase[]>(),
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function mountProvider() {
  return renderHook(() => useTodos(null), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StreamsProvider>{children}</StreamsProvider>
    ),
  })
}

// Seed a fill phase so phase_substep has a row to patch.
function seedFillPhase(threadId: string) {
  act(() => {
    useStreamsStore.getState().actions.appendPhaseForThread(threadId, {
      slug: "fill",
      phaseIndex: 1,
      phaseType: "llm_emit",
      status: "running",
      subAgents: [],
      pendingAsk: null,
    })
  })
}

describe("Phase 101.1-09 gap 6 — phase_substep demux (panel-only, additive)", () => {
  it("a phase_substep populates Phase.emitSubStep on the owning thread (and PANEL-09: bucketsBySurface ref unchanged)", async () => {
    mountProvider()
    seedFillPhase(THREAD_A)
    act(() => {
      useStreamsStore.getState().actions.setMessagesForBucket("chat", THREAD_A, [])
    })
    const before = useStreamsStore.getState().bucketsBySurface
    const cbs = phaseCallbacks(THREAD_A)
    const wire =
      'data: {"type":"phase_substep","phase":"fill","phase_index":1,"status":"validating"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-1", "0", cbs)
    })
    // PANEL-09: the chat bucket ref is UNCHANGED — phase_substep never touches it.
    expect(useStreamsStore.getState().bucketsBySurface).toBe(before)
    // The fill phase row got emitSubStep="validating".
    const phases = useStreamsStore.getState().phasesByThread.get(THREAD_A) ?? []
    const fill = phases.find((p) => p.slug === "fill")
    expect(fill?.emitSubStep).toBe("validating")
  })

  it("a phase_substep failure populates Phase.emitFailure (failed-as-failed)", async () => {
    mountProvider()
    seedFillPhase(THREAD_A)
    const cbs = phaseCallbacks(THREAD_A)
    const wire =
      'data: {"type":"phase_substep","phase":"fill","phase_index":1,"failure":"citation_gate_rejected"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-1", "0", cbs)
    })
    const fill = (useStreamsStore.getState().phasesByThread.get(THREAD_A) ?? []).find(
      (p) => p.slug === "fill",
    )
    expect(fill?.emitFailure).toBe("citation_gate_rejected")
  })

  it("Pitfall 6 isolation: a background thread's phase_substep never touches the viewed thread", async () => {
    mountProvider()
    seedFillPhase(THREAD_A)
    seedFillPhase(THREAD_B)
    const beforeB = useStreamsStore.getState().phasesByThread.get(THREAD_B)
    const cbs = phaseCallbacks(THREAD_A)
    const wire =
      'data: {"type":"phase_substep","phase":"fill","phase_index":1,"status":"rendering"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-A", "0", cbs)
    })
    // THREAD_A got the sub-step...
    const fillA = (useStreamsStore.getState().phasesByThread.get(THREAD_A) ?? []).find(
      (p) => p.slug === "fill",
    )
    expect(fillA?.emitSubStep).toBe("rendering")
    // ...and THREAD_B is untouched (same ref, no emitSubStep).
    const afterB = useStreamsStore.getState().phasesByThread.get(THREAD_B)
    expect(afterB).toBe(beforeB)
    expect(afterB?.[0].emitSubStep).toBeUndefined()
  })

  it("setPhaseEmitSubstepForThread store action patches ONLY phasesByThread (no bucketsBySurface write)", () => {
    mountProvider()
    seedFillPhase(THREAD_A)
    const beforeBuckets = useStreamsStore.getState().bucketsBySurface
    act(() => {
      useStreamsStore
        .getState()
        .actions.setPhaseEmitSubstepForThread(THREAD_A, "fill", 1, {
          emitSubStep: "validated",
        })
    })
    expect(useStreamsStore.getState().bucketsBySurface).toBe(beforeBuckets)
    const fill = (useStreamsStore.getState().phasesByThread.get(THREAD_A) ?? []).find(
      (p) => p.slug === "fill",
    )
    expect(fill?.emitSubStep).toBe("validated")
  })
})

describe("Phase 101.1-09 gap 4 (frontend) — terminal workspace refetch", () => {
  it("a harness run_completed 'completed' refetches workspace files for the owning thread", async () => {
    mountProvider()
    const cbs = phaseCallbacks(THREAD_A)
    const wire =
      'data: {"type":"phase_started","phase":"fill","phase_index":0,"phase_type":"llm_emit"}\n\n' +
      'data: {"type":"run_completed","status":"completed"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-A", "0", cbs)
    })
    // The just-persisted deliverable self-heals: getThreadWorkspaceFiles was
    // invoked for THIS owning thread (scoped).
    expect(mockGetThreadWorkspaceFiles).toHaveBeenCalled()
    const calledThreads = mockGetThreadWorkspaceFiles.mock.calls.map((c) => c[0])
    expect(calledThreads).toContain(THREAD_A)
  })

  it("a non-completed (failed) run does NOT trigger the workspace refetch", async () => {
    mountProvider()
    mockGetThreadWorkspaceFiles.mockClear()
    const cbs = phaseCallbacks(THREAD_A)
    const wire =
      'data: {"type":"run_failed","reason":"boom"}\n\n' +
      'data: {"type":"run_completed","status":"failed"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-A", "0", cbs)
    })
    // run_completed with status!=="completed" must not refetch (gap 4 guard).
    const calledThreads = mockGetThreadWorkspaceFiles.mock.calls.map((c) => c[0])
    expect(calledThreads).not.toContain(THREAD_A)
  })
})
