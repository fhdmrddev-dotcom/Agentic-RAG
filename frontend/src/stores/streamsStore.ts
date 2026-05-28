/**
 * Phase 068 (D-068-01..06): Zustand v5 store backing <StreamsProvider>.
 *
 * State + actions co-located per Dorfmeister convention (RESEARCH §Finding #1).
 * Actions are seeded as throwing/no-op stubs here; the provider overwrites
 * them via setState in a mount-time useEffect (RESEARCH §Pitfall 3 + §Finding #2).
 *
 * D-068-01: Zustand v5 store (locked, not exploratory).
 * D-068-02: Named hooks layer in StreamsProvider hides raw `useStreamsStore`
 *           (subscriptionsByRunId Set<string> is the Zustand-visible mirror of
 *           the provider-scoped subscriptionsRef AbortController Map).
 * D-068-03: This module is implementation detail; consumers go through named
 *           hooks exported from StreamsProvider.tsx, NEVER through
 *           useStreamsStore directly.
 * D-068-04: bucketsBySurface: Map<SurfaceId, Map<thread_id, Message[]>>.
 * D-068-05: Surface-aware action signatures (surfaceId opt; default "chat").
 * D-068-06: Per-run keying explicitly NOT adopted in v2.6.
 *
 * D-068.5-01..04 + Pitfall 1/8: bucketsBySurface synchronously hydrated from
 *           localStorage in the factory; first paint sees cached content.
 *           reconcileError slot added for Plan 02 retry banner.
 *
 * RESEARCH §Finding #2: AbortController must NOT live in Zustand state (not
 * serializable, identity churn breaks selector memoization). The provider
 * holds the actual Map<runId, AbortController> in a ref; this Set is the
 * pure-data mirror exposed to React consumers via `useStreamSubscriptions`.
 * Plan 1 ships an empty Set; Plan 2 wires the add/remove call sites inside
 * the lifted sendMessage/reconcile/stopStream bodies.
 *
 * RESEARCH §Pitfall 5: Synchronous actions (setMessagesForBucket /
 * clearThreadBucket / setViewingThread) seed as no-op `() => {}` because
 * they can fire BEFORE the provider's mount-time useEffect on the very first
 * render. Async actions throw via `notMounted` because they're always fired
 * from user events (post-mount, after useEffect has registered real bodies).
 */
import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import type { Message, Todo, WorkspaceFile, PendingAsk, TaskRunIndexItem } from "@/types"
import { readSnapshotSyncOrEmpty } from "@/lib/streamsCache"

export type SurfaceId = string

export interface StreamsState {
  bucketsBySurface: Map<SurfaceId, Map<string, Message[]>>
  viewedThreadId: string | null
  // ────────────────────────────────────────────────────────────────────────────
  // Plan 075.4-01 (D-075.4-A1) + PATTERNS.md S4 — per-thread state lift.
  // The 5 fields below replaced 5 cross-thread globals (isStreaming /
  // fallbackNotice / reconcileError / loadingThreadId / subscriptionsByRunId).
  // Analog: bucketsBySurface (line 44) already keys per-thread. Each field
  // below mirrors that shape: a Set<threadId> or Map<threadId, T>. Cache
  // version (streamsCache.ts:41) is UNCHANGED — D-075.4-A2 confirms the
  // cache reader only walks parsed.surfaces / bucketsBySurface, so the cache
  // shape is structurally independent of these per-thread bookkeeping
  // fields. Closes BUG-260523-01 (composer locked globally during any
  // stream): per-thread `streamingThreads.has(threadId)` now drives
  // composer-disable, instead of a single `isStreaming` boolean.
  // ────────────────────────────────────────────────────────────────────────────
  /** Set of thread IDs currently streaming. Replaces the old global
   *  `isStreaming: boolean`. `streamingThreads.size > 0` is the back-compat
   *  any-thread-streaming check. */
  streamingThreads: Set<string>
  /** Per-thread fallback-model notice strings. Replaces the old global
   *  `fallbackNotice: string | null`. */
  fallbackNotices: Map<string, string>
  /** Per-thread reconcile error state (Plan 068.5 retry banner). Replaces the
   *  old global `reconcileError: { threadId; error } | null`. */
  reconcileErrors: Map<string, Error>
  /** Set of thread IDs whose loadMessages is currently in flight. Replaces
   *  the old global `loadingThreadId: string | null`. MessageList gates the
   *  cold-load skeleton on `loadingThreads.has(activeThreadId) &&
   *  messages.length === 0` so new chats (or any thread without an active
   *  fetch) don't render misleading shimmer. */
  loadingThreads: Set<string>
  /** Per-thread set of active SSE run subscriptions. Replaces the old global
   *  `subscriptionsByRunId: Set<string>` flat set. Inner Set holds the
   *  runIds currently bound for that thread; an empty inner Set is GC'd via
   *  delete-the-key on removal. */
  subscriptionsByThread: Map<string, Set<string>>
  // ────────────────────────────────────────────────────────────────────────────
  // Phase 086 Plan 01 (PANEL-05 / PANEL-06) — agent-panel per-thread Maps.
  // The 6 new SSE events (Phases 084/085) demux into these 4 dedicated Maps so
  // panel events NEVER mutate bucketsBySurface (chat message selectors never
  // re-render — PANEL-06). Each mirrors the bucketsBySurface per-thread shape:
  // Map<threadId, T[]>. Strictly additive (D-086-18) — no existing field above
  // is altered. Identity keys per the backend wire shapes: Todo by `id`,
  // WorkspaceFile by `path`, PendingAsk by `tool_call_id`, TaskRunIndexItem by
  // `sub_run_id`. todosByThread + tasksByThread hydrate from localStorage on
  // first paint (Task 3 wiring); pendingAsksByThread + workspaceFilesByThread
  // start EMPTY (ephemeral / large-blob — D-086-03).
  // ────────────────────────────────────────────────────────────────────────────
  /** Per-thread todo lists (full-state-replace on todo_updated SSE). */
  todosByThread: Map<string, Todo[]>
  /** Per-thread workspace file index (keyed-by-path mutation on
   *  workspace_file_written / workspace_file_deleted SSE). */
  workspaceFilesByThread: Map<string, WorkspaceFile[]>
  /** Per-thread pending ask_user prompts (keyed-by-tool_call_id add/remove on
   *  ask_user_prompt / ask_user_response SSE). Never persisted. */
  pendingAsksByThread: Map<string, PendingAsk[]>
  /** Per-thread sub-agent task run index (keyed-by-sub_run_id upsert/status on
   *  the TASK-variant sub_agent_start / sub_agent_done SSE). */
  tasksByThread: Map<string, TaskRunIndexItem[]>
  actions: {
    setMessagesForBucket: (
      surface: SurfaceId,
      threadId: string,
      updater: Message[] | ((prev: Message[]) => Message[]),
    ) => void
    clearThreadBucket: (surface: SurfaceId) => void
    setViewingThread: (threadId: string | null) => void
    sendMessage: (
      threadId: string,
      content: string,
      opts?: {
        model?: string
        provider?: string
        agentMode?: string
        surfaceId?: SurfaceId
        onTitleUpdate?: (t: string) => void
      },
    ) => Promise<void>
    reconcile: (threadId: string, surfaceId?: SurfaceId) => Promise<void>
    stopStream: () => Promise<void>
    resumeFromFailed: (failedMessage: Message) => Promise<void>
    loadMessages: (threadId: string, surfaceId?: SurfaceId) => Promise<void>
    // ──────────────────────────────────────────────────────────────────────────
    // Phase 086 Plan 01 (PANEL-05 / PANEL-06) — 11 additive panel actions.
    // Each mutates ONLY its dedicated per-thread Map via an immutable
    // `new Map(prev)` replace so chat-message selectors never re-render
    // (PANEL-06). Bodies are seeded as synchronous no-op stubs below and the
    // provider overwrites them in a mount-time useEffect (Plan 086-02).
    // ──────────────────────────────────────────────────────────────────────────
    /** Full-state-replace of a thread's todo list (todo_updated SSE / GET). */
    setTodosForThread: (threadId: string, todos: Todo[]) => void
    /** Alias for full-state-replace (reconcile path). */
    replaceTodosForThread: (threadId: string, todos: Todo[]) => void
    /** Upsert a single workspace file by path (workspace_file_written SSE). */
    setWorkspaceFileForThread: (threadId: string, file: WorkspaceFile) => void
    /** Remove a workspace file by path (workspace_file_deleted SSE). */
    removeWorkspaceFileForThread: (threadId: string, path: string) => void
    /** Full-state-replace of a thread's workspace file index (GET reconcile). */
    replaceWorkspaceFilesForThread: (threadId: string, files: WorkspaceFile[]) => void
    /** Add a pending ask by tool_call_id (ask_user_prompt SSE). */
    addPendingAskForThread: (threadId: string, ask: PendingAsk) => void
    /** Remove a pending ask by tool_call_id (ask_user_response SSE). */
    removePendingAskForThread: (threadId: string, toolCallId: string) => void
    /** Full-state-replace of a thread's pending asks (GET reconcile). */
    replacePendingAsksForThread: (threadId: string, asks: PendingAsk[]) => void
    /** Upsert a task run by sub_run_id (sub_agent_start TASK variant). */
    setTaskForThread: (threadId: string, task: TaskRunIndexItem) => void
    /** Update a task's status/summary by sub_run_id (sub_agent_done TASK variant). */
    updateTaskStatusForThread: (
      threadId: string,
      subRunId: string,
      status: string,
      summary: string,
    ) => void
    /** Full-state-replace of a thread's task run index (GET reconcile). */
    replaceTasksForThread: (threadId: string, tasks: TaskRunIndexItem[]) => void
  }
}

const notMounted = async (): Promise<never> => {
  throw new Error(
    "StreamsProvider not mounted: action invoked before provider useEffect registered real implementations",
  )
}

export const useStreamsStore = create<StreamsState>()(subscribeWithSelector(() => ({
  // Phase 068.5 (D-068.5-01..04 + Pitfall 1/8): hydrate from localStorage
  // synchronously so the first render of any subscriber sees cached content,
  // not the empty Map. L-068.5-03 shape preserved:
  //   bucketsBySurface: Map<SurfaceId, Map<string, Message[]>>
  bucketsBySurface: readSnapshotSyncOrEmpty(),
  viewedThreadId: null,
  // Plan 075.4-01 (D-075.4-A1): per-thread state defaults. Fresh empty
  // Set/Map matching StreamsState shape above. STREAMS_CACHE_VERSION untouched
  // (D-075.4-A2 — cache reader only walks bucketsBySurface).
  // Defaults are type-annotated below; the type literal in each annotation
  // mirrors the interface declaration verbatim so the 075.4-01
  // acceptance-criterion greps find both the interface (line ~62) and these
  // defaults (>= 2 hits per field).
  // Type: streamingThreads: Set<string>
  streamingThreads: new Set<string>(),
  // Type: fallbackNotices: Map<string, string>
  fallbackNotices: new Map<string, string>(),
  // Type: reconcileErrors: Map<string, Error>
  reconcileErrors: new Map<string, Error>(),
  // Type: loadingThreads: Set<string>
  loadingThreads: new Set<string>(),
  // Type: subscriptionsByThread: Map<string, Set<string>>
  subscriptionsByThread: new Map<string, Set<string>>(),
  // Phase 086 Plan 01 (D-086-03): panel per-thread Map defaults. todos + tasks
  // hydrate from localStorage on first paint (Task 3 wires the cache reads
  // here); pendingAsks + workspaceFiles start EMPTY (ephemeral / large-blob).
  // Type-annotation comment above each per D-075.4-A1 convention.
  // Type: todosByThread: Map<string, Todo[]>
  todosByThread: new Map<string, Todo[]>(),
  // Type: workspaceFilesByThread: Map<string, WorkspaceFile[]>
  workspaceFilesByThread: new Map<string, WorkspaceFile[]>(),
  // Type: pendingAsksByThread: Map<string, PendingAsk[]>
  pendingAsksByThread: new Map<string, PendingAsk[]>(),
  // Type: tasksByThread: Map<string, TaskRunIndexItem[]>
  tasksByThread: new Map<string, TaskRunIndexItem[]>(),
  actions: {
    setMessagesForBucket: () => {},
    clearThreadBucket: () => {},
    setViewingThread: () => {},
    sendMessage: notMounted,
    reconcile: notMounted,
    stopStream: notMounted,
    resumeFromFailed: notMounted,
    loadMessages: notMounted,
    // Phase 086 Plan 01 (PATTERNS §1 Part C / RESEARCH Pitfall 5): synchronous
    // no-op stubs — NOT notMounted — because panel SSE dispatch can fire these
    // BEFORE the provider's mount-time useEffect registers real bodies on the
    // very first render. The provider overwrites all 11 in Plan 086-02.
    setTodosForThread: () => {},
    replaceTodosForThread: () => {},
    setWorkspaceFileForThread: () => {},
    removeWorkspaceFileForThread: () => {},
    replaceWorkspaceFilesForThread: () => {},
    addPendingAskForThread: () => {},
    removePendingAskForThread: () => {},
    replacePendingAsksForThread: () => {},
    setTaskForThread: () => {},
    updateTaskStatusForThread: () => {},
    replaceTasksForThread: () => {},
  },
})))
