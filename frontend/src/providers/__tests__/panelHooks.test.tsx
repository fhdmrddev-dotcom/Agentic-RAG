/**
 * Phase 086 Plan 02 Task 3 — integration backstop for the agent-panel data layer.
 *
 * Covers the failure modes reachable by automated tests (SC#10 axes 1-3 per
 * CLAUDE.md "UAT scoreboard recipe" — Plan-05 E2E backstop pattern). Axis 4
 * (long-message) + the full cross-provider matrix stay MANUAL in
 * 086-VALIDATION.md (provider-specific wire behavior can't be unit-mocked).
 *
 * Failure-criteria cross-reference (086-VALIDATION.md <failure_criteria>):
 *   FC#1 — panel event must NOT re-render chat (bucket selector ref stable).
 *   FC#3 — legacy analyze_document sub_agent_* must keep routing to onSubAgentStart.
 *   FC#4 — Phase 085 task tool sub_agent_* (sub_run_id present) must route to onTaskStart.
 *   FC#5 — rapid thread-switch must abort the in-flight reconcile (no cross-thread bleed).
 *   FC#6 — ask_user_response must remove the pending ask by tool_call_id.
 *   FC#9 — each panel SSE event must route to its callback with verified field names.
 *  D-086-13 — per-hook error isolation via composite key `${threadId}:${hookId}`.
 *
 * The dispatch layer (FC#3/#4/#6/#9) is exercised through the REAL `subscribeToRun`
 * SSE parser (mockSseFetch drives raw wire bytes) feeding the REAL
 * `makeStreamCallbacks` defaults — so the assertion is end-to-end:
 * raw SSE byte -> api.ts demux -> makeStreamCallbacks default -> store Map.
 * The hook layer (FC#1/#5 + D-086-13) is exercised through renderHook over the
 * 4 named hooks with the api.ts GET helpers mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Todo, WorkspaceFile, PendingAsk, TaskRunIndexItem } from "@/types"

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
//    test for FC#3/#4/#6/#9) + makeStreamCallbacks bridge; override only the 4
//    panel GET helpers (so the hook reconcile path is deterministic) and the
//    chat reconcile/load helpers (so the provider mount doesn't hit the network).
const {
  mockGetThreadTodos,
  mockGetThreadWorkspaceFiles,
  mockGetThreadPendingAsks,
  mockGetThreadTasks,
} = vi.hoisted(() => ({
  mockGetThreadTodos: vi.fn(),
  mockGetThreadWorkspaceFiles: vi.fn(),
  mockGetThreadPendingAsks: vi.fn(),
  mockGetThreadTasks: vi.fn(),
}))

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    // Keep real subscribeToRun (SSE parser under test).
    getThreadTodos: mockGetThreadTodos,
    getThreadWorkspaceFiles: mockGetThreadWorkspaceFiles,
    getThreadPendingAsks: mockGetThreadPendingAsks,
    getThreadTasks: mockGetThreadTasks,
    // Provider mount fires reconcile/loadMessages on setViewingThread — stub so
    // the panel-hook tests don't touch the chat snapshot network path.
    getSnapshot: vi.fn().mockResolvedValue({ messages: [], active_runs: [] }),
    getMessages: vi.fn().mockResolvedValue([]),
    getActiveRuns: vi.fn().mockResolvedValue([]),
  }
})

import { subscribeToRun, type StreamCallbacks } from "@/lib/api"
import {
  makeStreamCallbacks,
  StreamsProvider,
  useTodos,
  useWorkspaceFiles,
  useAskUserPrompt,
  useTasks,
} from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import { readTodosSyncOrEmpty, readTasksSyncOrEmpty } from "@/lib/streamsCache"

const THREAD_A = "thread-A"
const THREAD_B = "thread-B"
const ASSISTANT_ID = "assistant-1"

// ── SSE wire-byte helper (port of api.test.ts:644-663) ────────────────────────
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

// makeStreamCallbacks wires panel events into the store; setMessages is the
// chat-bucket writer (irrelevant to panel events, but required by the factory).
function panelCallbacks(threadId: string): StreamCallbacks {
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
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// Provider wrapper — mounting <StreamsProvider> registers the 11 real action
// bodies (Plan 086-02 Task 1) so the makeStreamCallbacks defaults + hooks route
// into live Map mutations instead of the no-op store stubs.
function withProvider(threadId: string | null) {
  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StreamsProvider>{children}</StreamsProvider>
    ),
    initialProps: { threadId },
  }
}

describe("Phase 086 panel — dispatch routing (real SSE demux -> store)", () => {
  // The provider must be mounted so action bodies are registered before we drive
  // SSE events. We render a throwaway hook under the provider, then run SSE.
  function mountProvider() {
    return renderHook(() => useTodos(null), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <StreamsProvider>{children}</StreamsProvider>
      ),
    })
  }

  it("FC#4: sub_agent_start WITH sub_run_id routes to onTaskStart (NOT onSubAgentStart)", async () => {
    mountProvider()
    const onSubAgentStart = vi.fn()
    const cbs: StreamCallbacks = {
      ...panelCallbacks(THREAD_A),
      onSubAgentStart, // legacy spy — must NOT fire for the task variant
    }
    const wire =
      'data: {"type":"sub_agent_start","sub_run_id":"sub-1","description":"crunch","tools":["execute_code"],"max_steps":5}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-1", "0", cbs)
    })
    // onTaskStart wrote a task row into the store; onSubAgentStart did NOT fire.
    const tasks = useStreamsStore.getState().tasksByThread.get(THREAD_A) ?? []
    expect(tasks).toHaveLength(1)
    expect(tasks[0].sub_run_id).toBe("sub-1")
    expect(tasks[0].status).toBe("running")
    expect(onSubAgentStart).not.toHaveBeenCalled()
  })

  it("FC#3: sub_agent_start WITHOUT sub_run_id routes to legacy onSubAgentStart (NOT onTaskStart)", async () => {
    mountProvider()
    const onSubAgentStart = vi.fn()
    const cbs: StreamCallbacks = { ...panelCallbacks(THREAD_A), onSubAgentStart }
    const wire =
      'data: {"type":"sub_agent_start","filename":"report.pdf","task":"summarize"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-1", "0", cbs)
    })
    // Legacy 2-arg call fired; NO task row was created.
    expect(onSubAgentStart).toHaveBeenCalledWith("report.pdf", "summarize")
    expect(useStreamsStore.getState().tasksByThread.get(THREAD_A) ?? []).toHaveLength(0)
  })

  it("FC#3/#4: both sub_agent variants on the SAME thread + delta stays unchanged", async () => {
    mountProvider()
    const onSubAgentStart = vi.fn()
    const onSubAgentDelta = vi.fn()
    const cbs: StreamCallbacks = {
      ...panelCallbacks(THREAD_A),
      onSubAgentStart,
      onSubAgentDelta,
    }
    const wire =
      // task variant
      'data: {"type":"sub_agent_start","sub_run_id":"sub-9","description":"d","tools":[],"max_steps":3}\n\n' +
      // legacy variant
      'data: {"type":"sub_agent_start","filename":"f.pdf","task":"t"}\n\n' +
      // delta must keep routing to onSubAgentDelta untouched
      'data: {"type":"sub_agent_delta","content":"chunk"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-1", "0", cbs)
    })
    expect(useStreamsStore.getState().tasksByThread.get(THREAD_A)).toHaveLength(1)
    expect(onSubAgentStart).toHaveBeenCalledWith("f.pdf", "t")
    expect(onSubAgentDelta).toHaveBeenCalledWith("chunk")
  })

  it("FC#9: each panel SSE event routes to its store Map with verified field names", async () => {
    mountProvider()
    const cbs = panelCallbacks(THREAD_A)
    // Phase 088-05 (D-16): workspace_file_written now carries `id` (the persisted
    // workspace_files row id) so the live panel can fetch content/versions/diff by
    // id without a refresh. The store keys by `path` but threads the id through.
    const wire =
      'data: {"type":"todo_updated","todos":[{"id":"t1","content":"do it","status":"pending","parent_id":null,"order_index":0}]}\n\n' +
      'data: {"type":"workspace_file_written","id":"wf-1","path":"out/a.txt","size_bytes":12,"mime_type":"text/plain","version":1}\n\n' +
      'data: {"type":"ask_user_prompt","tool_call_id":"call-1","prompt":"ok?","options":["y","n"],"timeout_seconds":60}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-1", "0", cbs)
    })
    const st = useStreamsStore.getState()
    expect(st.todosByThread.get(THREAD_A)?.[0].id).toBe("t1")
    expect(st.workspaceFilesByThread.get(THREAD_A)?.[0].path).toBe("out/a.txt")
    // D-16 regression: the row id must survive the SSE→store path (an empty/absent
    // id is what caused `/files//content` → 404 in the live no-refresh flow).
    expect(st.workspaceFilesByThread.get(THREAD_A)?.[0].id).toBe("wf-1")
    expect(st.pendingAsksByThread.get(THREAD_A)?.[0].tool_call_id).toBe("call-1")
  })

  it("D-16: a later id-less workspace_file_written for the same path never clobbers a known id", async () => {
    mountProvider()
    const cbs = panelCallbacks(THREAD_A)
    // First write carries the id (post-088-05 backend); a hypothetical replayed /
    // legacy event for the SAME path arrives without one — the store must preserve
    // the already-known id (defensive merge in setWorkspaceFileForThread).
    const wire =
      'data: {"type":"workspace_file_written","id":"wf-9","path":"out/b.txt","size_bytes":3,"mime_type":"text/plain","version":1}\n\n' +
      'data: {"type":"workspace_file_written","path":"out/b.txt","size_bytes":6,"mime_type":"text/plain","version":2}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-1", "0", cbs)
    })
    const files = useStreamsStore.getState().workspaceFilesByThread.get(THREAD_A) ?? []
    expect(files).toHaveLength(1)
    expect(files[0].id).toBe("wf-9") // preserved
    expect(files[0].version).toBe(2) // but the rest of the update applied
  })

  it("FC#6: ask_user_response removes the pending ask by tool_call_id", async () => {
    mountProvider()
    const cbs = panelCallbacks(THREAD_A)
    const wire =
      'data: {"type":"ask_user_prompt","tool_call_id":"call-1","prompt":"q","options":[],"timeout_seconds":30}\n\n' +
      'data: {"type":"ask_user_prompt","tool_call_id":"call-2","prompt":"q2","options":[],"timeout_seconds":30}\n\n' +
      'data: {"type":"ask_user_response","tool_call_id":"call-1"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-1", "0", cbs)
    })
    const asks = useStreamsStore.getState().pendingAsksByThread.get(THREAD_A) ?? []
    expect(asks.map((a) => a.tool_call_id)).toEqual(["call-2"])
  })

  it("FC#1: a panel event does NOT change the chat bucket selector reference (no chat re-render)", async () => {
    mountProvider()
    // Seed a chat bucket so there's a concrete reference to compare.
    act(() => {
      useStreamsStore
        .getState()
        .actions.setMessagesForBucket("chat", THREAD_A, [])
    })
    const before = useStreamsStore.getState().bucketsBySurface
    const cbs = panelCallbacks(THREAD_A)
    const wire =
      'data: {"type":"workspace_file_written","path":"x.txt","size_bytes":1,"mime_type":"text/plain"}\n\n' +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await act(async () => {
      await subscribeToRun("run-1", "0", cbs)
    })
    // PANEL-06: bucketsBySurface ref is UNCHANGED — panel events never touch it.
    expect(useStreamsStore.getState().bucketsBySurface).toBe(before)
    // ...but the panel Map DID update.
    expect(useStreamsStore.getState().workspaceFilesByThread.get(THREAD_A)).toHaveLength(1)
  })
})

describe("Phase 086 panel — hooks reconcile + abort + error isolation", () => {
  it("useTodos reconciles on mount and exposes data (never undefined)", async () => {
    mockGetThreadTodos.mockResolvedValue([
      { id: "t1", content: "x", status: "pending", parent_id: null, order_index: 0 },
    ])
    const { result } = renderHook(({ threadId }) => useTodos(threadId), withProvider(THREAD_A))
    // data is always an array (EMPTY constant fallback before fetch resolves).
    expect(Array.isArray(result.current.data)).toBe(true)
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(mockGetThreadTodos).toHaveBeenCalled()
    expect(result.current.data[0].id).toBe("t1")
  })

  it("useTodos with null threadId never fetches and returns the stable EMPTY array", async () => {
    const { result } = renderHook(({ threadId }) => useTodos(threadId), withProvider(null))
    expect(result.current.data).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(mockGetThreadTodos).not.toHaveBeenCalled()
  })

  it("FC#5: rapid thread-switch aborts the in-flight fetch and shows no cross-thread bleed", async () => {
    // Capture the signal handed to the A fetch so we can assert it was aborted.
    let capturedSignalA: AbortSignal | undefined
    mockGetThreadTodos.mockImplementation(
      (tid: string, signal?: AbortSignal) =>
        new Promise<Todo[]>((resolve) => {
          if (tid === THREAD_A) {
            capturedSignalA = signal
            // Never resolve A — the switch must abort it before it lands.
          } else {
            resolve([
              { id: "b1", content: "B", status: "pending", parent_id: null, order_index: 0 },
            ])
          }
        }),
    )
    const { result, rerender } = renderHook(
      ({ threadId }) => useTodos(threadId),
      withProvider(THREAD_A),
    )
    // Switch A -> B before A's fetch resolves.
    act(() => rerender({ threadId: THREAD_B }))
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    // A's controller was aborted on cleanup (L-068-02).
    expect(capturedSignalA?.aborted).toBe(true)
    // B's data is keyed under B; A never received B's data.
    expect(useStreamsStore.getState().todosByThread.get(THREAD_B)).toHaveLength(1)
    expect(useStreamsStore.getState().todosByThread.get(THREAD_A) ?? []).toHaveLength(0)
  })

  it("D-086-13: a files-500 sets only `${thread}:files`; todos still populate", async () => {
    mockGetThreadTodos.mockResolvedValue([
      { id: "t1", content: "x", status: "pending", parent_id: null, order_index: 0 },
    ])
    mockGetThreadWorkspaceFiles.mockRejectedValue(new Error("500 internal"))
    const todos = renderHook(({ threadId }) => useTodos(threadId), withProvider(THREAD_A))
    const files = renderHook(
      ({ threadId }) => useWorkspaceFiles(threadId),
      withProvider(THREAD_A),
    )
    await waitFor(() => expect(todos.result.current.data).toHaveLength(1))
    await waitFor(() => expect(files.result.current.error).not.toBeNull())
    const errs = useStreamsStore.getState().reconcileErrors
    expect(errs.has(`${THREAD_A}:files`)).toBe(true)
    expect(errs.has(`${THREAD_A}:todos`)).toBe(false)
    // Todos hook is unaffected by the files failure.
    expect(todos.result.current.error).toBeNull()
    expect(todos.result.current.data[0].id).toBe("t1")
  })

  it("useAskUserPrompt surfaces a PendingAsk[] (array) from reconcile", async () => {
    mockGetThreadPendingAsks.mockResolvedValue([
      { tool_call_id: "c1", prompt: "go?", options: [], timeout_seconds: 30 },
      { tool_call_id: "c2", prompt: "stop?", options: [], timeout_seconds: 30 },
    ])
    const { result } = renderHook(
      ({ threadId }) => useAskUserPrompt(threadId),
      withProvider(THREAD_A),
    )
    await waitFor(() => expect(result.current.data).toHaveLength(2))
    expect(result.current.data.map((a) => a.tool_call_id)).toEqual(["c1", "c2"])
  })

  it("useTasks reconciles task rows by sub_run_id", async () => {
    mockGetThreadTasks.mockResolvedValue([
      {
        sub_run_id: "s1",
        parent_run_id: "r1",
        status: "completed",
        model: "gpt",
        provider: "openai",
      },
    ])
    const { result } = renderHook(({ threadId }) => useTasks(threadId), withProvider(THREAD_A))
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.data[0].sub_run_id).toBe("s1")
  })
})

// WR-04 (260529-0sc): end-to-end write-path regression. Proves the panel
// todo/task Maps actually reach the localStorage snapshot via the throttled
// write in StreamsProvider useEffect #4. This is RED against the pre-fix code
// (writeNow omitted the 4th/5th args + the subscription watched bucketsBySurface
// only, so panel-Map mutations never triggered a write) and GREEN after the fix.
describe("Phase 086 panel — WR-04 localStorage write-path persistence", () => {
  it("persists todosByThread/tasksByThread to the snapshot so readback is non-empty", () => {
    // getCurrentUserIdSync scans localStorage for an `sb-*-auth-token` whose JSON
    // has `.user.id`. The supabase mock is NOT sufficient — writeSnapshotToLocalStorage
    // reads localStorage directly. Seed AFTER beforeEach's localStorage.clear().
    localStorage.setItem(
      "sb-test-auth-token",
      JSON.stringify({ user: { id: "user-1" } }),
    )

    // Fake timers make the 500ms throttle deterministic; scoped to this test only.
    vi.useFakeTimers()
    try {
      // Mounting registers the 11 real action bodies AND useEffect #4's subscription.
      const { unmount } = renderHook(() => useTodos(null), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <StreamsProvider>{children}</StreamsProvider>
        ),
      })

      // setViewingThread is the sole writer of activeThreadIdRef.current — without
      // it writeNow early-returns on `!streamingTid && !activeTid`. (getSnapshot/
      // getMessages/getActiveRuns are stubbed by the top-of-file mock.)
      act(() => {
        useStreamsStore.getState().actions.setViewingThread(THREAD_A)
      })

      const todo: Todo = {
        id: "t1",
        content: "persist me",
        status: "pending",
        parent_id: null,
        order_index: 0,
      }
      const task: TaskRunIndexItem = {
        sub_run_id: "s1",
        parent_run_id: "r1",
        status: "completed",
        model: "gpt",
        provider: "openai",
      }
      act(() => {
        useStreamsStore.getState().actions.replaceTodosForThread(THREAD_A, [todo])
        useStreamsStore.getState().actions.replaceTasksForThread(THREAD_A, [task])
      })

      // Flush the 500ms throttle via the live subscription path.
      act(() => {
        vi.advanceTimersByTime(600)
      })

      const persistedTodos = readTodosSyncOrEmpty()
      const persistedTasks = readTasksSyncOrEmpty()
      expect(persistedTodos.get(THREAD_A)).toHaveLength(1)
      expect(persistedTodos.get(THREAD_A)?.[0].id).toBe("t1")
      expect(persistedTasks.get(THREAD_A)).toHaveLength(1)
      expect(persistedTasks.get(THREAD_A)?.[0].sub_run_id).toBe("s1")

      unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})
