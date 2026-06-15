/**
 * Phase 094 Plan 02 (PANEL-08 / PANEL-09) — integration backstop for the
 * harness phase-timeline data layer.
 *
 * Flips the Plan-01 Wave-0 RED scaffold GREEN. Mirrors `panelHooks.test.tsx`
 * (the raw-SSE → REAL `subscribeToRun` → store integration backstop): partial-
 * mock `@/lib/api` to keep the REAL `subscribeToRun` + `makeStreamCallbacks`
 * (the demux under test), overriding only the GET helpers (incl. the new
 * `getThreadWorkflow` reconcile floor) so the provider mount stays off the
 * network. Replays the shared DATA-CONTRACT §7 fixtures from
 * `@/test-fixtures/harness094` (single source of truth — never re-author a wire
 * frame).
 *
 * The two binding invariants:
 *
 *   INV-1 (PANEL-09 reference-identity): a phase event MUST NOT change the chat
 *     bucket selector ref — `const before = bucketsBySurface`; replay
 *     `fxPhaseLlmAgent` through the REAL `subscribeToRun`; assert
 *     `expect(bucketsBySurface).toBe(before)` AND `phasesByThread.get(THREAD_A)`
 *     got the phase (running → done). (Mirror of panelHooks FC#1 @292-313,
 *     swapping the workspace_file_written fixture for a phase fixture.)
 *
 *   INV-5 (cross-thread isolation, Pitfall 6 per-thread keying): replaying
 *     `phase_started` on THREAD_A's callbacks while THREAD_B has its own phases
 *     MUST leave THREAD_B's `phasesByThread` untouched (the demux default closes
 *     over the OWNING threadId, never the viewed thread / a global flag).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Todo, WorkspaceFile, PendingAsk, TaskRunIndexItem, Phase } from "@/types"
import { fxPhaseLlmAgent } from "@/test-fixtures/harness094"

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

// ── Partial-mock @/lib/api: keep the REAL subscribeToRun (the SSE demux under
//    test) + makeStreamCallbacks bridge; override only the panel GET helpers
//    (incl. getThreadWorkflow — the new phasesByThread reconcile floor) so the
//    provider mount doesn't hit the network. ──
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
    // Keep real subscribeToRun (SSE parser under test) + makeStreamCallbacks.
    getThreadTodos: mockGetThreadTodos,
    getThreadWorkspaceFiles: mockGetThreadWorkspaceFiles,
    getThreadPendingAsks: mockGetThreadPendingAsks,
    getThreadTasks: mockGetThreadTasks,
    getThreadWorkflow: mockGetThreadWorkflow,
    // Provider mount fires reconcile/loadMessages on setViewingThread — stub so
    // these tests don't touch the chat snapshot network path.
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

// ── SSE wire-byte helper (port of panelHooks.test.tsx:93-108) ─────────────────
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

// makeStreamCallbacks wires phase events into the store via the demux defaults
// (closing over threadId — the OWNING thread). setMessages is the chat-bucket
// writer (irrelevant to phase events, but required by the factory).
function phaseCallbacks(threadId: string): StreamCallbacks {
  return makeStreamCallbacks({
    assistantId: ASSISTANT_ID,
    threadId,
    setMessages: () => {},
  })
}

// Reset store + auth env between tests so per-thread Maps don't leak.
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000")
  localStorage.clear()
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

describe("Phase 094 — phasesByThread demux (real SSE -> store)  [owner: Plan 02]", () => {
  // Mount the provider so the 14 real action bodies (incl. the 3 phase mutators)
  // are registered before we drive SSE; otherwise the makeStreamCallbacks
  // defaults route into the no-op store stubs.
  function mountProvider() {
    return renderHook(() => useTodos(null), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <StreamsProvider>{children}</StreamsProvider>
      ),
    })
  }

  it("INV-1 (PANEL-09): a phase event does NOT change the chat bucket selector ref; phasesByThread.get(THREAD_A) gets the phase (replay fxPhaseLlmAgent)", async () => {
    mountProvider()
    // Seed a chat bucket so there's a concrete reference to compare.
    act(() => {
      useStreamsStore.getState().actions.setMessagesForBucket("chat", THREAD_A, [])
    })
    const before = useStreamsStore.getState().bucketsBySurface
    const cbs = phaseCallbacks(THREAD_A)
    // fxPhaseLlmAgent: phase_started(llm_agent) → sub_agent_start → sub_agent_done
    // → phase_completed. Append a stream_end so the reader terminates cleanly.
    const wire = [...fxPhaseLlmAgent, 'data: {"type":"stream_end"}\n\n'].join("")
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-1", "0", cbs)
    })
    // PANEL-09: bucketsBySurface ref is UNCHANGED — phase events never touch it.
    expect(useStreamsStore.getState().bucketsBySurface).toBe(before)
    // ...but the panel phase Map DID update: one phase, running → done.
    const phases = useStreamsStore.getState().phasesByThread.get(THREAD_A) ?? []
    expect(phases).toHaveLength(1)
    expect(phases[0].slug).toBe("research")
    expect(phases[0].phaseType).toBe("llm_agent")
    expect(phases[0].status).toBe("done")
  })

  it("INV-5 (Pitfall 6 isolation): phase_started on THREAD_A's callbacks leaves THREAD_B's phasesByThread untouched (per-thread keying)", async () => {
    mountProvider()
    // THREAD_B already has a phase timeline of its own.
    act(() => {
      useStreamsStore.getState().actions.appendPhaseForThread(THREAD_B, {
        slug: "b-phase",
        phaseIndex: 0,
        phaseType: "programmatic",
        status: "running",
        subAgents: [],
        pendingAsk: null,
      })
    })
    const beforeB = useStreamsStore.getState().phasesByThread.get(THREAD_B)
    // Drive a phase event through THREAD_A's callbacks (the OWNING thread).
    const cbs = phaseCallbacks(THREAD_A)
    const wire =
      'data: {"type":"phase_started","phase":"a-phase","phase_index":0,"phase_type":"llm_single"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-A", "0", cbs)
    })
    // THREAD_A got its phase...
    expect(useStreamsStore.getState().phasesByThread.get(THREAD_A)).toHaveLength(1)
    expect(useStreamsStore.getState().phasesByThread.get(THREAD_A)?.[0].slug).toBe("a-phase")
    // ...and THREAD_B is completely untouched (same array ref, same content).
    const afterB = useStreamsStore.getState().phasesByThread.get(THREAD_B)
    expect(afterB).toBe(beforeB)
    expect(afterB).toHaveLength(1)
    expect(afterB?.[0].slug).toBe("b-phase")
  })
})
