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
import type { Message, Todo, WorkspaceFile, PendingAsk, TaskRunIndexItem, Phase, EmitSubStep, EmitFailure } from "@/types"
import { readSnapshotSyncOrEmpty, readTodosSyncOrEmpty, readTasksSyncOrEmpty } from "@/lib/streamsCache"

export type SurfaceId = string

/**
 * Phase 092 (MODE-01/02 — SC#3) — the per-thread workflow-lock record. Held in
 * `workflowLockByThread` keyed by the OWNING thread id. Presence of a key means
 * the thread is Harness-locked (a non-terminal workflow run owns its anchor);
 * absence means Deep (unlocked). `capPaused`/`continuesRemaining` carry the
 * Continue affordance state surfaced by the cap_paused SSE event + the
 * getThreadWorkflow reconcile.
 */
export interface WorkflowLock {
  /** The workflow_runs.id (active_workflow_run_id) that owns the lock. */
  runId: string
  mode: "harness"
  /** True when the run is cap_paused (a Continue card is pending). */
  capPaused: boolean
  /** Continues remaining (max_continues_per_run - continues_used, D-06). */
  continuesRemaining: number
}

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
  /** 099-08 (UAT L10): per-thread stashed prompt text from a kickoff/send
   *  refusal, so ChatArea can feed it back to the composer via the existing
   *  prefill seam. Cleared when consumed or when the banner is dismissed. */
  failedSendDrafts: Map<string, string>
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
  // ────────────────────────────────────────────────────────────────────────────
  // Phase 092 (MODE-01 / MODE-02 — SC#3, the single highest-regression-risk
  // surface). Per-thread keyed workflow-lock state. A thread holds a lock iff a
  // non-terminal Harness workflow run owns its `active_workflow_run_id` anchor.
  // MUST be a Map keyed by thread_id — NEVER a global boolean (a global flag here
  // is the BUG-260523-01-class regression: Thread A's workflow would lock Thread
  // B's composer). Mirrors the streamingThreads/subscriptionsByThread shape; the
  // useWorkflowLockForThread selector (StreamsProvider.tsx) reads it keyed by the
  // OWNING thread id (useMessages.ts:80-86 lesson). Populated by the mount-time
  // getThreadWorkflow reconcile (D-v2.5-03 source of truth) + the live SSE
  // (cap_paused / terminal); cleared (GC delete-the-key) on unlock. Ephemeral —
  // never persisted (reconciled from the backend on every mount).
  // ────────────────────────────────────────────────────────────────────────────
  /** Per-thread workflow lock. Absent key = Deep (unlocked). */
  workflowLockByThread: Map<string, WorkflowLock>
  // ────────────────────────────────────────────────────────────────────────────
  // Phase 094 Plan 02 (PANEL-08 / PANEL-09) — the panel-only harness phase
  // timeline slice. The 6 new harness lifecycle events (phase_started /
  // phase_completed / phase_transition / gate_failed / run_failed /
  // run_completed) — wire-emitted but DROPPED by api.ts today — demux into this
  // ONE Map so a phase event NEVER mutates bucketsBySurface (the chat selector
  // `useThreadMessages` reads bucketsBySurface EXCLUSIVELY → zero chat
  // re-renders, PANEL-09). Mirrors the tasksByThread/workflowLockByThread shape:
  // Map<threadId, Phase[]>, keyed by the OWNING thread id so a background harness
  // run cannot corrupt the viewed thread's timeline (the SC#10 parallel-thread
  // axis). EPHEMERAL — never persisted; reconciled from getThreadWorkflow on
  // every mount (mirrors pendingAsksByThread/workspaceFilesByThread, NOT
  // tasksByThread which persists). The chat side MUST NEVER read this Map.
  // ────────────────────────────────────────────────────────────────────────────
  /** Per-thread harness phase timeline (panel-only). Absent key = no phases. */
  phasesByThread: Map<string, Phase[]>
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
        onTitleUpdate?: (threadId: string, title: string) => void
        /** Phase 092 (MODE-01 / D-02) — Harness kickoff: when set, the backend
         *  creates a workflow run + the producer drives run_workflow. Omitted on
         *  a Deep send (byte-identical). */
        workflowDefinitionId?: string
      },
    ) => Promise<void>
    reconcile: (threadId: string, surfaceId?: SurfaceId) => Promise<void>
    stopStream: () => Promise<void>
    /** SEED-064 — stop the active run on a SPECIFIC thread (not just the viewed
     *  one). Powers the sidebar Stop + the cross-thread active-runs tray so a
     *  backgrounded run can be cancelled without navigating into its thread.
     *  No-op when the thread has no streaming run. */
    stopThread: (threadId: string) => Promise<void>
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
    // ──────────────────────────────────────────────────────────────────────────
    // Phase 092 (MODE-01/02 — SC#3) — per-thread workflow-lock mutators.
    // Both copy-then-mutate the workflowLockByThread Map (new Map → set / GC
    // delete-the-key). NEVER touch a global flag. Called from the mount-time
    // getThreadWorkflow reconcile (D-v2.5-03) + the live SSE (cap_paused /
    // terminal). No-op stubs here; the provider registers real bodies.
    // ──────────────────────────────────────────────────────────────────────────
    /** Set/replace a thread's workflow lock (mount reconcile + cap_paused SSE). */
    setWorkflowLockForThread: (threadId: string, lock: WorkflowLock) => void
    /** Clear a thread's workflow lock — GC delete-the-key (unlock / terminal). */
    clearWorkflowLockForThread: (threadId: string) => void
    // ──────────────────────────────────────────────────────────────────────────
    // Phase 094 Plan 02 (PANEL-08 / PANEL-09) — panel-only phase-timeline
    // mutators. Each copy-then-mutates the phasesByThread Map (new Map → set),
    // keyed by the OWNING thread id (cross-thread isolation). NEVER touch
    // bucketsBySurface. No-op stubs here; the provider registers real bodies in a
    // mount-time useEffect (panel SSE can fire BEFORE that registers — Pitfall 5,
    // so synchronous `() => {}` stubs, NOT notMounted).
    // ──────────────────────────────────────────────────────────────────────────
    /** Append a phase (phase_started) — no-op if its slug already present. */
    appendPhaseForThread: (threadId: string, phase: Phase) => void
    /** Patch a phase's status (+ optional fields) by slug (phase_completed /
     *  gate_failed / run_failed / phase_transition). */
    setPhaseStatusForThread: (
      threadId: string,
      slug: string,
      status: Phase["status"],
      patch?: Partial<Phase>,
    ) => void
    /** Full-state-replace of a thread's phase timeline (getThreadWorkflow reconcile). */
    replacePhasesForThread: (threadId: string, phases: Phase[]) => void
    /** Phase 101.1-09 (gap 6 / GAP-C / D-11) — patch a phase's emitSubStep/emitFailure
     *  by slug (or phaseIndex when the slug is a placeholder) from a phase_substep
     *  event. ADDITIVE + PANEL-ONLY: writes phasesByThread exclusively (never
     *  bucketsBySurface), mirroring setPhaseStatusForThread's immutable update. The
     *  PhaseCard render contract (Plan 04) consumes these fields. */
    setPhaseEmitSubstepForThread: (
      threadId: string,
      slug: string,
      phaseIndex: number,
      patch: { emitSubStep?: EmitSubStep; emitFailure?: EmitFailure },
    ) => void
    /** Phase 098-UAT run-honesty fix (A) — on a SUCCESSFUL run_completed, flip every
     *  non-terminal (running/retrying/pending) phase for the OWNING thread to "done".
     *  The DB ground truth for a completed run is every phase completed, so this
     *  self-heals a phase node stranded on "running" (its phase_completed SSE missed
     *  across the ask_user pause / a consumer reattach) WITHOUT a thread-switch.
     *  Scoped to the passed threadId (PANEL-09); writes phasesByThread ONLY. */
    finalizeAllPhasesForThread: (threadId: string) => void
    /** BUG-260609-01 mid-run fix — when a LATER phase goes live (phase_started for
     *  index N), flip every EARLIER phase (phaseIndex < N) still in {running,retrying}
     *  to "done". A sequential engine cannot start phase N until earlier phases
     *  finished, so this is a forward-only backstop for a missed phase_completed —
     *  matched BY INDEX so it survives a placeholder-slug mismatch. Never touches
     *  skipped/failed/pending or the current/later phases. Scoped to threadId
     *  (PANEL-09); writes phasesByThread ONLY. */
    finalizeEarlierPhasesForThread: (threadId: string, beforeIndex: number) => void
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
  // Type: failedSendDrafts: Map<string, string> (099-08 / UAT L10)
  failedSendDrafts: new Map<string, string>(),
  // Type: loadingThreads: Set<string>
  loadingThreads: new Set<string>(),
  // Type: subscriptionsByThread: Map<string, Set<string>>
  subscriptionsByThread: new Map<string, Set<string>>(),
  // Phase 086 Plan 01 (D-086-03): panel per-thread Map defaults. todos + tasks
  // hydrate from localStorage SYNCHRONOUSLY on first paint (same Pitfall 1/8
  // discipline as bucketsBySurface above — read inside the factory, not a
  // useEffect, so first paint sees cached content). pendingAsks +
  // workspaceFiles start EMPTY (ephemeral / large-blob — not persisted).
  // Type-annotation comment above each per D-075.4-A1 convention.
  // Type: todosByThread: Map<string, Todo[]>
  todosByThread: readTodosSyncOrEmpty(),
  // Type: workspaceFilesByThread: Map<string, WorkspaceFile[]>
  workspaceFilesByThread: new Map<string, WorkspaceFile[]>(),
  // Type: pendingAsksByThread: Map<string, PendingAsk[]>
  pendingAsksByThread: new Map<string, PendingAsk[]>(),
  // Type: tasksByThread: Map<string, TaskRunIndexItem[]>
  tasksByThread: readTasksSyncOrEmpty(),
  // Phase 092 (SC#3): per-thread workflow lock — fresh empty Map. Ephemeral
  // (never persisted); reconciled from getThreadWorkflow on every mount.
  // Type: workflowLockByThread: Map<string, WorkflowLock>
  workflowLockByThread: new Map<string, WorkflowLock>(),
  // Phase 094 Plan 02 (PANEL-08/09): per-thread harness phase timeline — fresh
  // empty Map. EPHEMERAL (no streamsCache/localStorage read — phases reconcile
  // from getThreadWorkflow on every mount, mirroring pendingAsksByThread, NOT
  // tasksByThread which persists). Panel-only — chat selectors never read it.
  // Type: phasesByThread: Map<string, Phase[]>
  phasesByThread: new Map<string, Phase[]>(),
  actions: {
    setMessagesForBucket: () => {},
    clearThreadBucket: () => {},
    setViewingThread: () => {},
    sendMessage: notMounted,
    reconcile: notMounted,
    stopStream: notMounted,
    stopThread: notMounted,
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
    // Phase 092 (SC#3): synchronous no-op stubs — the cap_paused SSE / reconcile
    // can fire before the provider's mount-time useEffect registers real bodies.
    setWorkflowLockForThread: () => {},
    clearWorkflowLockForThread: () => {},
    // Phase 094 Plan 02 (PANEL-08/09): synchronous no-op stubs — a harness
    // phase_* / gate_failed / run_failed SSE can fire BEFORE the provider's
    // mount-time useEffect registers real bodies (Pitfall 5 — NOT notMounted).
    appendPhaseForThread: () => {},
    setPhaseStatusForThread: () => {},
    replacePhasesForThread: () => {},
    setPhaseEmitSubstepForThread: () => {},
    finalizeAllPhasesForThread: () => {},
    finalizeEarlierPhasesForThread: () => {},
  },
})))
