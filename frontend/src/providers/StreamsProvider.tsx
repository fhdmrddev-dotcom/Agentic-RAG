/**
 * Phase 068 (D-068-01..08, L-068-01..07): <StreamsProvider> — provider-scoped
 * refs + mount-time action registration + reconcile listeners. Wraps the
 * authenticated React tree below the auth gate (D-068-02 / RESEARCH §Finding #4).
 *
 * D-068-01: Zustand v5 store is the substrate; this component owns the
 *           non-serializable handles (AbortController Map, cursor Map,
 *           in-flight bit, streaming/active thread ids).
 * D-068-02: Named-hook layer (useThreadMessages / useStreamActions /
 *           useStreamSubscriptions / useViewingThread) hides raw
 *           useStreamsStore from consumers.
 * D-068-03: useStreamsStore is implementation detail. External callers MUST
 *           use the named hooks below.
 * D-068-04: bucketsBySurface immutable-replace via nested Map cloning.
 * D-068-05: Surface-aware (surfaceId default = "chat").
 * D-068-06: NO per-run keying in v2.6.
 * D-068-07: Reconcile listeners (visibilitychange / focus / pageshow) attach
 *           inside this provider's mount useEffect; ChatArea.tsx:162-187
 *           still has its block — Plan 3 deletes it; pre-Plan-3 the L-068-02
 *           in-flight lock makes the double-attach safe (RESEARCH §Pitfall 4).
 * D-068-08: Listeners gate on activeThreadIdRef.current — no thread arg
 *           captured at attach time (mirrors ChatArea but reads the ref).
 *
 * L-068-01: Branch D-3 guard predicate (clearThreadBucket refuses to wipe a
 *           bucket whose thread is currently being streamed into; lifted
 *           VERBATIM from useMessages.ts:589-598).
 * L-068-02: reconcile in-flight lock — top-of-function bail + try/finally.
 *           Plan 2 Task 2b ports the real body inside the try/finally; Plan 1
 *           shipped a no-op shell so coexistence with ChatArea listeners is safe.
 * L-068-03: activeThreadIdRef has EXACTLY ONE writer (setViewingThread).
 *           Plan 2 Task 2c extends setViewingThread to ALSO fire reconcile when
 *           threadId is non-null — without adding a second assignment to the
 *           ref. Sole-writer grep gate remains at exactly 1.
 * L-068-04: makeStreamCallbacks factory captures surfaceId via closure
 *           (RESEARCH §Finding #7). Deltas route to the run's OWNING thread
 *           bucket (captured via closure) regardless of viewing thread — which is
 *           what lets concurrent background streams coexist (SEED-055).
 * L-068-05: reconcile's for-loop runId-match dedup (m.runId equals run.run_id)
 *           reuses the existing placeholder's id as the assistantId.
 * L-068-06: loadMessages MERGE 3-clause filter preserves live in-flight temp
 *           placeholders (startsWith('temp-') && m.runId && !dbRunIds.has(m.runId)).
 * L-068-07: subscriptionsRef.current.delete(runId) fires inside onTerminal,
 *           NOT inside the promise .finally() chain (safety-net finally still
 *           allowed). subscriptionsByRunId Zustand mirror tracks add/remove.
 *
 * RESEARCH §Finding #1: EMPTY_ARRAY is module-level so atomic selectors get
 *                       a stable reference for empty buckets — no re-render.
 * RESEARCH §Finding #2: Actions register via useStreamsStore.setState in the
 *                       mount-time useEffect, closing over provider-scoped refs.
 *                       AbortController never enters Zustand state; the
 *                       subscriptionsByRunId Set<string> mirror does.
 * RESEARCH §Pitfall 3: Action registration runs in useEffect (after first
 *                      paint). Synchronous actions ship as no-op stubs in the
 *                      store; async actions throw notMounted. Safe.
 * RESEARCH §Pitfall 5: Throwing stubs surface pre-mount usage instantly.
 */
import { useEffect, useMemo, useRef, type PropsWithChildren, type MutableRefObject } from "react"
import type {
  Message,
  ToolCall,
  OutputFile,
  SourceReference,
  Citation,
  Todo,
  WorkspaceFile,
  PendingAsk,
  TaskRunIndexItem,
  Phase,
} from "@/types"
import {
  getMessages,
  postMessage,
  subscribeToRun,
  getActiveRuns,
  getSnapshot,
  cancelRun,
  getThreadTodos,
  getThreadWorkspaceFiles,
  getThreadPendingAsks,
  getThreadTasks,
  getThreadWorkflow,
  ApiError,
  type StreamCallbacks,
  type ThreadSnapshot,
} from "@/lib/api"
import { usePanelReconcile } from "@/hooks/usePanelReconcile"
import {
  useStreamsStore,
  type SurfaceId,
  type StreamsState,
  type WorkflowLock,
} from "@/stores/streamsStore"
import { makeThrottle } from "@/lib/throttle"
import { writeSnapshotToLocalStorage } from "@/lib/streamsCache"
import { makeToolKey } from "@/lib/toolKey"
// Phase 095.1 Plan 02 (D-095.1-01/02): the deterministic activity-derived
// workspace-panel selector (Plan 01). `useDerivedPanel` is a PURE read over the
// viewing thread's persisted chat tool_calls — it consumes these, never re-rolls
// the gate/derive logic.
import {
  shouldPopulate,
  deriveWorkspacePanel,
  type DerivedPanelItem,
} from "@/lib/workspacePanel"
// Phase 092-07 (Facet C): the Continue affordance (MessageItem) fires this signal
// with the FRESH producer_run_id from the /continue 200 body; the provider
// re-subscribes that thread's producer stream (additive, per-thread keyed).
import { subscribeProducerResubscribe } from "@/providers/producerResubscribeSignal"

// RESEARCH §Finding #1: module-level constant gives every empty-bucket subscriber
// the SAME reference, so React/useSyncExternalStore skips re-render when the
// selector result is shallow-equal across stores.
const EMPTY_ARRAY: Message[] = []

// Phase 086 Plan 02 (D-086-05) — module-level EMPTY constants for the 4 panel
// hooks. Same rationale as EMPTY_ARRAY: a per-thread Map miss (or null threadId)
// returns the SAME stable reference, so useSyncExternalStore skips re-render and
// PANEL-06 (panel events never re-render chat) holds structurally.
const EMPTY_TODOS: Todo[] = []
const EMPTY_FILES: WorkspaceFile[] = []
const EMPTY_ASKS: PendingAsk[] = []
const EMPTY_TASKS: TaskRunIndexItem[] = []
// Phase 094 Plan 02 (PANEL-08/09) — stable EMPTY ref for the panel-only phase
// timeline hook. A per-thread Map miss (or null threadId) returns this SAME
// reference so useSyncExternalStore skips re-render (PANEL-09 structural).
const EMPTY_PHASES: Phase[] = []
// Phase 095.1 Plan 02 (D-095.1-01/02) — stable EMPTY ref for the activity-derived
// workspace panel selector. Returned (same rationale as EMPTY_TODOS) whenever the
// thread is null OR the smart gate does not pass, so reading useDerivedPanel never
// forces a chat re-render (PANEL-06 / FC#1 isolation).
const EMPTY_DERIVED: DerivedPanelItem[] = []

// Phase 096-05 (D-09 — BUG-260530-01): cap held-open streaming fetches at a
// thread-keyed LRU pool. One held-open fetch per active run saturates the
// browser's 6-per-host HTTP/1.1 connection cap (uvicorn serves HTTP/1.1), so
// with ~6 concurrent runs every navigation's reconcile GETs queue 15-30s behind
// the streams. Pool = 3 (the viewed thread + the 2 most-recently-viewed
// background threads) leaves 3 connections free for normal traffic. Evicted
// threads keep executing server-side; returning to one re-attaches via the
// EXISTING reconcile path with replay from the retained cursor (D-11).
const STREAM_POOL_SIZE = 3

// WR-04 fix (260529-0sc): the persistence trigger set now includes the panel
// todo/task Maps. This equalityFn returns true (= "no change, skip") ONLY when
// all three watched refs are unchanged, so a reference change in bucketsBySurface
// OR todosByThread OR tasksByThread fires the throttled write. PANEL-06 isolation
// is preserved: these are the *persistence trigger* refs only — the chat MessageList
// selectors still read bucketsBySurface exclusively and a panel-Map mutation never
// touches the chat bucket reference (see test FC#1).
const persistTriggerEqual = (
  a: readonly [unknown, unknown, unknown],
  b: readonly [unknown, unknown, unknown],
): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]

/**
 * Phase 075.1 Plan 01: widened from the Phase 075 buffer_expired-only filter
 * (was `_isTransientBufferExpired`). A "transient stream end" is any SSE
 * close that arrives while the backend snapshot says the run is still
 * streaming. We probe /snapshot to decide.
 *
 * Triggers (any of these may be transient):
 *   - kind === "error" + errorPayload starts with "buffer_expired"
 *     (preserved from Phase 075 D-075-13)
 *   - kind === "error" + any other errorPayload (NEW — generic error
 *     fall-through; covers OpenRouter / Anthropic / OpenAI mid-stream
 *     wire closures that previously flipped runStatus to "failed")
 *   - kind === "done" + at least one tool_call.status in {running, preparing}
 *     (NEW — premature done before tool results land; B-260519-03 OpenRouter
 *     "Resume mid-stream" repro)
 *   - kind === "reader_done" (NEW — plain reader.done surfaced from
 *     api.ts:477 defensive close; was silent pre-Plan-01 because api.ts
 *     emitted onTerminal("done") on raw reader-close, which the helper
 *     short-circuited before the snapshot probe)
 *
 * Returns false (= terminal) on:
 *   - kind in {cancelled, timed_out} (explicit user/backend terminal —
 *     never transient)
 *   - kind === "done" with no running/preparing tool_calls (genuine
 *     completion stays terminal — short-circuits before the snapshot probe)
 *   - snapshot fetch failure (fail-safe; D-075-04 invariant preserved)
 *   - snapshot says run is not in active_runs OR not status:"streaming"
 *
 * Called BEFORE any state mutation in both onTerminal handlers (Phase 075
 * RESEARCH Pitfall 5: prevent Resume button flicker — the snapshot probe
 * MUST happen before flipping the streaming-flag off; Plan 075.4-01 changed
 * that flag from the legacy global boolean into a per-thread Set delete).
 *
 * Exported for unit tests; the rest of the StreamsProvider surface stays
 * private behind named hooks (D-068-03).
 */
export async function _isTransientStreamEnd(
  kind: "done" | "error" | "cancelled" | "timed_out" | "reader_done",
  errorPayload: string | undefined,
  threadId: string,
  runId: string,
  toolCalls: ToolCall[] | undefined,
): Promise<ThreadSnapshot | null> {
  // Phase 075.2 Plan 01 Task 1 (D-075.2-03): return ThreadSnapshot | null
  // instead of boolean so callers can thread the snapshot to
  // _reattachAfterTransient without a second getSnapshot probe (eliminates
  // the WR-02 two-probe race where the run can terminate between the
  // transient-filter probe and the reattach probe, falling back to cursor 0
  // and replaying tool_start events — the suspected trigger for
  // BUG-260521-01's first-tool duplicate card).

  // Explicit terminals are never transient — short-circuit without touching
  // the network. Both branches map to a final runStatus on the consumer side.
  if (kind === "cancelled" || kind === "timed_out") return null

  // For kind === "done", only treat as transient when running/preparing tools
  // are still open (premature done before tool results land). Genuine
  // completions short-circuit before the snapshot probe — saves a round-trip
  // on the happy path.
  if (kind === "done") {
    const stillWorking = (toolCalls ?? []).some(
      (tc) => tc.status === "running" || tc.status === "preparing",
    )
    if (!stillWorking) return null
  }
  // kind === "error" and kind === "reader_done" both proceed to the snapshot
  // probe unconditionally (any errorPayload value triggers the probe — the
  // snapshot is the source of truth, NOT the error string).
  // errorPayload is intentionally read by consumers (buffer_expired hook for
  // the loadMessages fallback) but never gates the decision here.
  void errorPayload

  const snapshot = await getSnapshot(threadId).catch(() => null)
  if (!snapshot) return null
  const isStreaming = snapshot.active_runs.some(
    (r) => r.run_id === runId && r.status === "streaming",
  )
  return isStreaming ? snapshot : null
}

/**
 * Phase 075.1 Plan 01 Task 2: shared snapshot-probe-and-reattach helper.
 *
 * Called by BOTH onTerminal handlers (reconcile + sendMessage) AFTER
 * `_isTransientStreamEnd` returned true. Responsibilities:
 *   1. Re-fetch /snapshot (the transient filter already probed, but it
 *      could have been called more than 100 ms ago; treat that probe as
 *      "decision" and this fetch as "fresh cursor seed").
 *   2. Seed lastSeenOffsetRef from `snapshot.since_cursors[runId]` ONLY
 *      when the ref has no entry for the runId yet (D-075-01: server
 *      cursors are first-attach defaults; client cursors win on
 *      subsequent reconnects).
 *   3. Invoke the caller-supplied `reattach(runId, since)` to open a
 *      fresh SSE subscription via the existing subscribeToRun machinery.
 *
 * Returns true on successful reattach; false on snapshot failure (caller
 * MUST fall through to the terminal-flip behavior to avoid leaving the
 * placeholder stuck in "streaming" state).
 */
export async function _reattachAfterTransient(
  snapshot: ThreadSnapshot,
  threadId: string,
  runId: string,
  lastSeenOffsetRef: MutableRefObject<Map<string, string>>,
  reattach: (runId: string, since: string) => void,
): Promise<boolean> {
  // Phase 075.2 Plan 01 Task 1 (D-075.2-03): snapshot threaded in by
  // the caller; the second internal getSnapshot probe has been DELETED.
  // Eliminates the WR-02 race window where the run can terminate between
  // probes, falling back to cursor "0" and replaying every tool_start
  // event for the run (suspected BUG-260521-01 trigger).
  // threadId is retained for context/logging parity with the caller.
  void threadId
  const seedCursor = snapshot.since_cursors[runId]
  if (seedCursor && !lastSeenOffsetRef.current.has(runId)) {
    lastSeenOffsetRef.current.set(runId, seedCursor)
  }
  const since = lastSeenOffsetRef.current.get(runId) ?? "0"
  reattach(runId, since)
  return true
}

function makeTempId() {
  return `temp-${Date.now()}-${Math.random()}`
}

// Phase 068 (L-068-04): bucket-routing factory for SSE callbacks; surfaceId
// captured by closure (RESEARCH §Finding #7). Source: useMessages.ts:35-378.
// Body is byte-identical to the pre-lift implementation — only the
// `setMessages` signature changes (thread-bound writer; the surfaceId binds at
// the call site that constructs this factory, not in lib/api.ts).
type ThreadBoundSetMessages = (
  updater: Message[] | ((prev: Message[]) => Message[]),
) => void

/**
 * Phase 075.1 Plan 03 Task 1 — exported for unit tests covering the Anthropic
 * mixed text + tool_use content-block ordering reducer (B-260519-01). The full
 * <StreamsProvider> surface stays private behind named hooks (D-068-03); this
 * single internal factory is hoisted to the module's public surface ONLY so
 * `StreamsProvider.anthropic-ordering.test.ts` can drive each callback directly
 * without spinning up the full provider render tree (mirrors Plan 01's
 * `_isTransientStreamEnd` export-for-tests pattern; avoids the pre-existing
 * waitFor-timeout flakes in streamsProvider.test.tsx).
 *
 * REDUCER INVARIANT (locked by anthropic-ordering tests):
 * Every callback below that calls `setMessages((prev) => prev.map((m) => ...))`
 * MUST preserve `m.content` via spread. Only `onDelta` may mutate content, and
 * only by appending (`content: m.content + delta`). Any other callback that
 * returns `{ ...m, content: "" }` or `{ ...m, content: <something else> }` is
 * a regression — Anthropic's interleaved text + tool_use stream relies on this
 * invariant to keep accumulating text across tool blocks.
 */
export function makeStreamCallbacks(opts: {
  assistantId: string
  threadId: string
  // Title cross-wiring fix (parallel chats): the consumer receives the run's
  // OWNING threadId so the title lands on the right chat even under concurrent
  // runs / fast nav. makeStreamCallbacks injects it (the wire StreamCallbacks
  // below still receives title-only).
  onTitleUpdate?: (threadId: string, title: string) => void
  setMessages: ThreadBoundSetMessages
}): StreamCallbacks {
  const { assistantId, threadId, onTitleUpdate, setMessages } = opts
  // D-067-03: closure-tracked iteration counter, stamped onto each ToolCall
  // created in onToolPreparing/onToolStart. Updated on every iteration_start
  // SSE event BEFORE setMessages.
  let currentIteration = 0
  return {
    onDelta: (delta) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isPlanning: false, content: m.content + delta } : m,
        ),
      )
    },
    // Phase 076.2 D-01: accumulate DeepSeek reasoning_content deltas on message.
    // Same accumulation pattern as onDelta for content.
    onReasoningDelta: (delta) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, reasoningContent: (m.reasoningContent ?? "") + delta }
            : m,
        ),
      )
    },
    onDone: () => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isPlanning: false } : m)),
      )
    },
    onTerminal: () => {
      // Default no-op — caller wraps to flip runStatus and handle buffer_expired.
    },
    // Inject the run's OWNING threadId (closure) so a generated title is applied
    // to THIS run's chat — not whatever thread the user is viewing when the title
    // SSE arrives (the cross-wiring under parallel chats / fast nav).
    onTitleUpdate: onTitleUpdate ? (title: string) => onTitleUpdate(threadId, title) : undefined,
    onToolPreparing: (name: string, index: number) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const preparingId = `preparing-${currentIteration}-${index}`
          const alreadyPreparing = (m.tool_calls ?? []).some((tc) => tc.id === preparingId)
          if (alreadyPreparing) return m
          // Phase 075.9 T2: stamp the stable client-side key at first
          // observation. Independent of `preparingId` / future `tc.id`
          // mutations across the preparing→running transition. Provider
          // is not currently surfaced through callbacks (callback factory
          // would need provider routing context); falls back to "unknown",
          // which is fine — `messageId + name + observedAt + index` is
          // already collision-stable within a single assistant message.
          const clientKey = makeToolKey({
            messageId: assistantId,
            name,
            observedAt: Date.now(),
            index,
          })
          const preparingEntry: ToolCall = {
            id: preparingId,
            clientKey,
            name,
            args: {},
            status: "preparing",
            startedAt: undefined,
            iteration: currentIteration,
          }
          // Plan 03 Task 1 invariant: `content` is INTENTIONALLY omitted —
          // spread preserves the in-progress assistant text accumulated by
          // prior onDelta calls. Anthropic's mixed text + tool_use ordering
          // (anthropic_service.py:194-259) requires this preservation so that
          // text streamed BEFORE a tool_use block isn't lost when the block
          // opens.
          return { ...m, isPlanning: false, tool_calls: [...(m.tool_calls ?? []), preparingEntry] }
        }),
      )
    },
    onToolArgsProgress: (toolIndex: number, _name: string, totalArgsBytesSoFar: number, codeSoFar?: string) => {
      // T-260523-09 (2026-05-23): update argsBytesStreamed on the matching
      // preparing entry so the UI can render "Generating ... (X.X KB)"
      // during the long code-generation pauses. Match by the same
      // `preparing-${index}` id onToolPreparing assigned. Use Math.max so
      // out-of-order replay events can't make the badge tick backwards.
      //
      // 075.6 Plan 02 / Req #5: 4th param `codeSoFar` carries the FULL
      // cumulative args text (NOT the 5 KB tail). Apply longer-string-wins
      // on tc.argsCodeText parallel to the existing Math.max byte-counter
      // branch. The `tc.status === "preparing"` filter below structurally
      // closes the late-event race (RESEARCH Pitfall 7): a tool_args_progress
      // arriving AFTER onToolStart finds no matching preparing entry and is
      // a no-op.
      const preparingId = `preparing-${currentIteration}-${toolIndex}`
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const calls = m.tool_calls ?? []
          const idx = calls.findIndex((tc) => tc.id === preparingId && tc.status === "preparing")
          if (idx === -1) return m
          const tc = calls[idx]
          const next = Math.max(tc.argsBytesStreamed ?? 0, totalArgsBytesSoFar)
          const nextCode =
            codeSoFar != null && codeSoFar.length > (tc.argsCodeText ?? '').length
              ? codeSoFar
              : tc.argsCodeText
          const noChange = next === (tc.argsBytesStreamed ?? 0) && nextCode === tc.argsCodeText
          if (noChange) return m
          const updated = calls.map((c, i) =>
            i === idx ? { ...c, argsBytesStreamed: next, argsCodeText: nextCode } : c,
          )
          return { ...m, tool_calls: updated }
        }),
      )
    },
    onToolStart: (name, args) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const existingCalls = m.tool_calls ?? []
          const preparingIdx = existingCalls.findIndex(
            (tc) => tc.name === name && tc.status === "preparing",
          )
          let updatedCalls: ToolCall[]
          if (preparingIdx !== -1) {
            updatedCalls = existingCalls.map((tc, i) =>
              i === preparingIdx
                ? {
                    ...tc,
                    args,
                    status: "running" as const,
                    startedAt: Date.now(),
                    iteration: tc.iteration ?? currentIteration,
                    // 075.6 Plan 02 / Req #5: clear argsCodeText on
                    // tool_start so post-start renders read from the
                    // source-of-truth tc.args.code (panel collapses + drops
                    // cached streaming text; final args parsed by tool_start
                    // win). Per CONTEXT.md Claude's Discretion.
                    argsCodeText: undefined,
                  }
                : tc,
            )
          } else {
            // Phase 075.2 Plan 01 Task 2 (D-075.2-01): idempotency-on-replay
            // guard — scoped to currentIteration so multi-batch same-name
            // tool calls (e.g., execute_code on iterations 1,2,3,4) each get
            // their own entry. Replay of the SAME iteration's tool_start still
            // no-ops correctly (same name + same iteration + already finalized).
            const finalizedIdx = existingCalls.findIndex(
              (tc) => tc.name === name && tc.iteration === currentIteration && (tc.status === "running" || tc.status === "done"),
            )
            if (finalizedIdx !== -1) {
              updatedCalls = existingCalls  // no-op; same iteration+name entry already exists
            } else {
              // Phase 075.9 T2: stamp the stable client-side key at first
              // observation. Some providers skip the preparing event and go
              // straight to tool_start (this branch), so the key must be
              // stamped here too. Uses the current array length as the
              // tie-break `index` so two same-name + same-millisecond
              // tool_start events on the same message can't collide.
              const observedAt = Date.now()
              const clientKey = makeToolKey({
                messageId: assistantId,
                name,
                observedAt,
                index: existingCalls.length,
              })
              updatedCalls = [
                ...existingCalls,
                {
                  id: `running-${observedAt}`,
                  clientKey,
                  name,
                  args,
                  status: "running" as const,
                  startedAt: observedAt,
                  iteration: currentIteration,
                },
              ]
            }
          }
          // Plan 03 Task 1 invariant: `content` is INTENTIONALLY omitted —
          // spread preserves accumulated text. See onToolPreparing for the
          // Anthropic mixed text + tool_use ordering rationale.
          return { ...m, isPlanning: false, tool_calls: updatedCalls }
        }),
      )
    },
    // Phase 075.2 Plan 01 Task 2 (D-075.2-04 / WR-01): optional `id`
    // parameter for tool_call_id matching. When present, matches by
    // tc.id === id (deterministic for future parallel-tool support).
    // When absent (today's wire shape per RESEARCH §Q1), falls back to
    // tc.name === name (byte-identical to pre-change behavior).
    // Backend wire-up of tool_call_id is intentionally out-of-scope
    // for this phase; the frontend ships id-ready as a no-op until
    // a future phase lights the wire-side plumbing.
    onToolEnd: (name, result, id) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const updated = (m.tool_calls ?? []).map((tc) =>
            (id ? tc.id === id : tc.name === name) && tc.status === "running"
              ? { ...tc, status: "done" as const, endedAt: Date.now(), result: result ?? tc.result }
              : tc,
          )
          return { ...m, tool_calls: updated }
        }),
      )
    },
    // Phase 095 Plan 03 Task 1 (D-05 root fix): the legacy analyze_document
    // sub-agent now stamps onto its OWNING tool_call entry instead of a
    // separate single-slot message-scoped sub_agent field. That single slot
    // was the dual-render ROOT: it rendered once as the tool body (via the
    // owner's tc.sub_agent on reconcile) AND once via the message-scoped
    // fallback in ToolCallPanel, so the read/summarize content visibly doubled
    // and never self-healed (it was stable state, not the 075.2 transient-id
    // race — a separate root, and that transient fix is left fully untouched).
    //
    // The fix mirrors onToolStart's makeToolKey discipline: find the running
    // analyze_document owner and set tc.sub_agent on THAT entry, preserving
    // its existing clientKey. If no owner exists yet (sub_agent_start arrived
    // before tool_start for some provider ordering), create the owner entry
    // here with ONE stable makeToolKey identity from frame 1. Provider-agnostic
    // and additive — m.content and the four terminal kinds are untouched, and
    // the closure is scoped to the OWNING threadId (no global flag, no
    // cross-thread write).
    //
    // helper: locate the tool_call this sub-agent belongs to (the most recent
    // running/preparing analyze_document — the legacy sub-agent owner).
    onSubAgentStart: (filename, task) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const calls = m.tool_calls ?? []
          // Find the most recent running/preparing analyze_document owner.
          let ownerIdx = -1
          for (let i = calls.length - 1; i >= 0; i--) {
            const tc = calls[i]
            if (
              tc.name === "analyze_document" &&
              (tc.status === "running" || tc.status === "preparing")
            ) {
              ownerIdx = i
              break
            }
          }
          if (ownerIdx !== -1) {
            // Stamp onto the existing owner, preserving its clientKey identity.
            const updated = calls.map((tc, i) =>
              i === ownerIdx
                ? { ...tc, sub_agent: { filename, task, content: "", status: "running" as const } }
                : tc,
            )
            return { ...m, tool_calls: updated }
          }
          // No owner yet (sub_agent_start before tool_start) — create the
          // analyze_document owner entry with ONE stable identity from frame 1,
          // mirroring onToolStart's makeToolKey stamp (443-448).
          const observedAt = Date.now()
          const clientKey = makeToolKey({
            messageId: assistantId,
            name: "analyze_document",
            observedAt,
            index: calls.length,
          })
          const ownerEntry: ToolCall = {
            id: `running-${observedAt}`,
            clientKey,
            name: "analyze_document",
            args: {},
            status: "running",
            startedAt: observedAt,
            iteration: currentIteration,
            sub_agent: { filename, task, content: "", status: "running" },
          }
          return { ...m, tool_calls: [...calls, ownerEntry] }
        }),
      )
    },
    onSubAgentDelta: (text) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const calls = m.tool_calls ?? []
          // Append to the OWNING tool_call's sub_agent.content (the most recent
          // entry that carries a running sub_agent). Immutable copy-then-mutate.
          // This is a NEW-field append — m.content is never touched (preserves
          // the onDelta content-append invariant).
          let ownerIdx = -1
          for (let i = calls.length - 1; i >= 0; i--) {
            if (calls[i].sub_agent && calls[i].sub_agent!.status === "running") {
              ownerIdx = i
              break
            }
          }
          if (ownerIdx === -1) return m
          const updated = calls.map((tc, i) =>
            i === ownerIdx
              ? { ...tc, sub_agent: { ...tc.sub_agent!, content: tc.sub_agent!.content + text } }
              : tc,
          )
          return { ...m, tool_calls: updated }
        }),
      )
    },
    onSubAgentDone: () => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const calls = m.tool_calls ?? []
          // Flip the owning tool_call's sub_agent status → done.
          let ownerIdx = -1
          for (let i = calls.length - 1; i >= 0; i--) {
            if (calls[i].sub_agent && calls[i].sub_agent!.status === "running") {
              ownerIdx = i
              break
            }
          }
          if (ownerIdx === -1) return m
          const updated = calls.map((tc, i) =>
            i === ownerIdx
              ? { ...tc, sub_agent: { ...tc.sub_agent!, status: "done" as const } }
              : tc,
          )
          return { ...m, tool_calls: updated }
        }),
      )
    },
    onSkillActivated: (skillName) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const newActivation = {
            type: "skill_activation" as const,
            skillName,
            occurredAt: Date.now(),
          }
          return {
            ...m,
            activatedSkill: skillName,
            activatedSkills: [...(m.activatedSkills ?? []), newActivation],
          }
        }),
      )
    },
    onSkillLoaded: (skillName, description) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const activations = m.activatedSkills
          if (!activations || activations.length === 0) return m
          let updated = false
          const next = activations
            .slice()
            .reverse()
            .map((act) => {
              if (!updated && act.skillName === skillName) {
                updated = true
                return { ...act, description }
              }
              return act
            })
            .reverse()
          if (!updated) return m
          return { ...m, activatedSkills: next }
        }),
      )
    },
    onCodeExecutionStart: undefined,
    onCodeExecuting: (toolIndex: number, elapsedSeconds: number) => {
      void toolIndex
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const updated = (m.tool_calls ?? []).map((tc) =>
            tc.name === "execute_code" && tc.status === "running"
              ? { ...tc, elapsedSeconds }
              : tc,
          )
          return { ...m, tool_calls: updated }
        }),
      )
    },
    onCodeStdout: (content: string) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const updated = (m.tool_calls ?? []).map((tc) =>
            tc.name === "execute_code" && tc.status === "running"
              ? { ...tc, outputLines: [...(tc.outputLines ?? []), { kind: "stdout" as const, content }] }
              : tc,
          )
          return { ...m, tool_calls: updated }
        }),
      )
    },
    onCodeStderr: (content: string) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const updated = (m.tool_calls ?? []).map((tc) =>
            tc.name === "execute_code" && tc.status === "running"
              ? { ...tc, outputLines: [...(tc.outputLines ?? []), { kind: "stderr" as const, content }] }
              : tc,
          )
          return { ...m, tool_calls: updated }
        }),
      )
    },
    onCodeExecutionComplete: (
      exitCode: number,
      durationMs: number,
      outputFiles: OutputFile[],
      error?: string,
    ) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const updated = (m.tool_calls ?? []).map((tc) =>
            tc.name === "execute_code" && tc.status === "running"
              ? { ...tc, exitCode, executionDurationMs: durationMs, outputFiles, errorMessage: error }
              : tc,
          )
          return { ...m, tool_calls: updated }
        }),
      )
    },
    // Phase 075.1 Plan 04 Atom E (B-260519-11 + BUG-260514-01) — pinned
    // final-outputs panel. Reducer stamps the cumulative file list onto the
    // assistant message; MessageItem renders the panel below the per-cell
    // delta outputs in each execute_code tool card. The reducer never
    // mutates `m.content` (Plan 03 invariant — only onDelta appends).
    onFinalOutputFiles: (files: { filename: string; url?: string; size?: number; is_hero?: boolean }[]) => {
      // Phase 095 Plan 05 (D-08): the additive `is_hero` flag rides through the
      // existing full-replace stamp untouched — MessageItem groups heroes above
      // a collapsible Working files group.
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, finalOutputFiles: files } : m)),
      )
    },
    onSources: (sources: SourceReference[]) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, sources } : m)),
      )
    },
    onCitations: (citations: Citation[]) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, citations } : m)),
      )
    },
    onConfidence: (level, avgSimilarity, disclaimer) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, confidence: { level, avg_similarity: avgSimilarity, disclaimer } }
            : m,
        ),
      )
    },
    onSuggestions: (questions: string[]) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, suggestions: questions } : m)),
      )
    },
    onPlanning: () => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isPlanning: true } : m)),
      )
    },
    onIterationStart: (iteration: number) => {
      currentIteration = iteration
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, iterationCount: iteration } : m)),
      )
    },
    onFallbackModel: (original: string, fallback: string) => {
      // Plan 075.4-01 D-075.4-A1: per-thread fallbackNotice. Copy-then-mutate
      // the Map so React/Zustand sees a fresh reference. Closure-captured
      // threadId from opts means we never write to the wrong thread's key.
      const notice = `Model ${original} unavailable — using ${fallback}.`
      useStreamsStore.setState((s) => ({
        fallbackNotices: new Map(s.fallbackNotices).set(threadId, notice),
      }))
      setTimeout(() => {
        useStreamsStore.setState((s) => {
          const next = new Map(s.fallbackNotices)
          next.delete(threadId)
          return { fallbackNotices: next }
        })
      }, 4000)
    },
    // ────────────────────────────────────────────────────────────────────────
    // Phase 086 Plan 02 (PATTERNS §6 / PANEL-06) — 7 panel default handlers.
    // Unlike every handler above (which writes to the chat-message bucket via
    // `setMessages`), these write to the dedicated per-thread panel Maps via the
    // store actions, so live SSE panel events update the 4 Maps WITHOUT touching
    // bucketsBySurface (chat selectors never re-render). Each closes over the
    // factory's `threadId` (L-068-04) — both call sites already pass it in opts,
    // so there is NO call-site signature change. The getState().actions
    // indirection mirrors setMessagesForBucketBound (StreamsProvider.tsx:709-712).
    // ────────────────────────────────────────────────────────────────────────
    onTodoUpdated: (todos) =>
      useStreamsStore.getState().actions.replaceTodosForThread(threadId, todos),
    onWorkspaceFileWritten: (file) =>
      useStreamsStore.getState().actions.setWorkspaceFileForThread(threadId, file),
    onWorkspaceFileDeleted: (path) =>
      useStreamsStore.getState().actions.removeWorkspaceFileForThread(threadId, path),
    onAskUserPrompt: (ask) =>
      useStreamsStore.getState().actions.addPendingAskForThread(threadId, ask),
    onAskUserResponse: (toolCallId) =>
      useStreamsStore.getState().actions.removePendingAskForThread(threadId, toolCallId),
    onTaskStart: (subRunId, description, tools, maxSteps) =>
      useStreamsStore.getState().actions.setTaskForThread(threadId, {
        sub_run_id: subRunId,
        // parent_run_id is not carried on the SSE bookend; the GET reconcile
        // (panel.py:156) is the authoritative source. Seed empty so the wire
        // type is satisfied; reconcile overwrites with the canonical row.
        parent_run_id: "",
        status: "running",
        model: "",
        provider: "",
        description,
        tools,
        max_steps: maxSteps,
      }),
    onTaskDone: (subRunId, status, summary) =>
      useStreamsStore
        .getState()
        .actions.updateTaskStatusForThread(threadId, subRunId, status, summary),
    // Phase 092 (CONT-01 / D-07 — SC#3): live cap_paused SSE → set the OWNING
    // thread's lock to capPaused so the inline Continue card appears out-of-band
    // (the durable carrier row is filtered from /messages — BUG-260528-01).
    // Closes over the factory's `threadId` (the owning thread), so a background
    // thread's cap_paused never touches the viewed thread's lock.
    onCapPaused: (info) =>
      useStreamsStore.getState().actions.setWorkflowLockForThread(threadId, {
        runId: info.runId,
        mode: "harness",
        capPaused: true,
        continuesRemaining: info.continuesRemaining,
      }),
    // ────────────────────────────────────────────────────────────────────────
    // Phase 094 Plan 02 (PANEL-08 / PANEL-09) — harness phase-lifecycle demux.
    // Each closes over the factory's `threadId` (the OWNING thread, Pitfall 6),
    // so a background harness run's phase events can NEVER corrupt the viewed
    // thread's timeline. They write phasesByThread ONLY — never bucketsBySurface
    // (PANEL-09: the chat selector useThreadMessages reads bucketsBySurface
    // exclusively → zero chat re-renders). Provider-agnostic (honest producer
    // events, no provider branching).
    // ────────────────────────────────────────────────────────────────────────
    onPhaseStarted: (p) => {
      // BUG-260609-01 mid-run honesty fix: a LATER phase going live is durable proof
      // the EARLIER phases finished (sequential engine — phase N can't start until
      // N-1 completed + advanced, harness_engine.py:963/973/994). Sweep any earlier
      // phase still running/retrying → done BY INDEX before appending the new row.
      // Index-matched so it survives a missed phase_completed AND a placeholder-slug
      // mismatch (the two ways the live draft→done flip is lost across the ask_user
      // pause / a consumer reattach). The finalizeAllPhasesForThread terminal sweep
      // remains the run_completed floor. Closure threadId (PANEL-09); phasesByThread only.
      const _actions = useStreamsStore.getState().actions
      _actions.finalizeEarlierPhasesForThread(threadId, p.phaseIndex)
      _actions.appendPhaseForThread(threadId, {
        slug: p.phase,
        phaseIndex: p.phaseIndex,
        phaseType: p.phaseType,
        status: "running",
        subAgents: [],
        pendingAsk: null,
      })
    },
    onPhaseCompleted: (phase) =>
      useStreamsStore.getState().actions.setPhaseStatusForThread(threadId, phase, "done"),
    onPhaseTransition: (from, _to, via) => {
      // A skip_to_phase routing marks the FROM phase skipped (it was bypassed by
      // a gate's on_failure='skip_to_phase'). A normal advance is a no-op on
      // status (the from-phase already flipped to done via phase_completed).
      if (via === "skip_to_phase")
        useStreamsStore.getState().actions.setPhaseStatusForThread(threadId, from, "skipped")
    },
    onGateFailed: (g) =>
      // Non-terminal gate failure → the phase is retrying (the engine will
      // re-attempt). A TERMINAL gate failure is followed by run_failed, which
      // flips the active phase to failed below — so retrying here is correct for
      // every attempt; run_failed overrides on exhaustion.
      useStreamsStore.getState().actions.setPhaseStatusForThread(threadId, g.phase, "retrying", {
        attempt: g.attempt,
        error: g.error,
      }),
    onRunFailed: (reason) =>
      // Mark the latest RUNNING/RETRYING phase failed (the one that was active
      // when the run died), carrying the reason. The store body resolves "the
      // active phase" by scanning for the last non-terminal row.
      useStreamsStore
        .getState()
        .actions.setPhaseStatusForThread(threadId, "", "failed", { error: reason }),
    onRunCompleted: (status) => {
      // Phase 098-UAT run-honesty fix (A): a phase flips running→done ONLY when its
      // own phase_completed SSE lands live. Across the ask_user pause / a consumer
      // reattach, an earlier phase's completed can be missed — leaving it stuck
      // "running" forever (this handler was previously a no-op, and the terminal
      // reconcile floor returns []; neither corrects it in-session). On a SUCCESSFUL
      // completion the DB ground truth is every phase completed, so sweep any
      // lingering non-terminal phase for THIS owning thread to done. A failed/
      // cancelled run is left alone (onRunFailed owns it) so a real failure is never
      // masked as done. Closure threadId (PANEL-09); phasesByThread only.
      if (status === "completed")
        useStreamsStore.getState().actions.finalizeAllPhasesForThread(threadId)
      // Phase 101.1-09 (gap 4 frontend): on a SUCCESSFUL harness terminal, refetch
      // the workspace files so a just-persisted deliverable's file + phase status
      // self-heal WITHOUT an F5 (the UAT log showed FILES fetched ~2 min BEFORE the
      // emit's row existed and never refetched → "No files yet" until refresh).
      // Scoped to the OWNING threadId (PANEL-09 closure). run_completed is a
      // HARNESS-ONLY event (Deep never emits it), so a Deep completion never reaches
      // here — no guard needed beyond the status==="completed" check. The Plan-08
      // snapshot degrade ensures this refetch path doesn't 503 on a GC'd buffer.
      if (status === "completed") {
        getThreadWorkspaceFiles(threadId)
          .then((files) =>
            useStreamsStore.getState().actions.replaceWorkspaceFilesForThread(threadId, files),
          )
          .catch(() => {
            // Best-effort self-heal — a failed refetch is non-fatal (the panel's
            // own mount/visibility reconcile remains the floor); never throw into
            // the SSE consumer.
          })
      }
    },
    // ────────────────────────────────────────────────────────────────────────
    // Phase 101.1-09 (gap 6 / GAP-C / D-11) — the phase_substep demux Plan 04
    // deferred. ADDITIVE + PANEL-ONLY: writes phasesByThread (like the 094
    // lifecycle demux), NEVER bucketsBySurface — the chat selector reads
    // bucketsBySurface exclusively → Deep byte-identical, no chat re-render.
    // Closes over the factory threadId (Pitfall 6 — a background run never
    // corrupts the viewed thread's rail). PhaseCard already renders emitSubStep/
    // emitFailure (Plan 04) — this populates them from the wire. One shared event
    // for every provider (no provider branch — D-14).
    // ────────────────────────────────────────────────────────────────────────
    onPhaseSubstep: (sub) =>
      useStreamsStore
        .getState()
        .actions.setPhaseEmitSubstepForThread(threadId, sub.phase, sub.phaseIndex, {
          emitSubStep: sub.status,
          emitFailure: sub.failure,
        }),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan 075.4-01 D-075.4-A1 — per-thread state mutation helpers.
//
// All 19 write sites that pre-Plan 075.4 mutated `subscriptionsByRunId`
// (flat Set<runId>) now route through these helpers, which copy-then-mutate
// the per-thread `subscriptionsByThread: Map<threadId, Set<runId>>` shape.
// Inner-Set-empty-then-delete-key GC keeps the outer Map free of stale
// per-thread entries once all runs on a thread terminate.
//
// Helpers return the NEXT state slice (not the full state), so callers fold
// them into a Zustand setState partial via `{ subscriptionsByThread: next }`.
// ─────────────────────────────────────────────────────────────────────────────
function _addRunToThread(
  current: Map<string, Set<string>>,
  threadId: string,
  runId: string,
): Map<string, Set<string>> {
  const next = new Map(current)
  const innerCur = next.get(threadId) ?? new Set<string>()
  const inner = new Set(innerCur)
  inner.add(runId)
  next.set(threadId, inner)
  return next
}

function _removeRunFromThread(
  current: Map<string, Set<string>>,
  threadId: string,
  runId: string,
): Map<string, Set<string>> {
  const innerCur = current.get(threadId)
  if (!innerCur || !innerCur.has(runId)) return current
  const next = new Map(current)
  const inner = new Set(innerCur)
  inner.delete(runId)
  if (inner.size === 0) {
    // GC: drop the threadId key when its Set goes empty so size==0
    // queries stay correct without scanning every thread.
    next.delete(threadId)
  } else {
    next.set(threadId, inner)
  }
  return next
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 092 (MODE-01/02 — SC#3) — per-thread workflow-lock copy-then-mutate
// helpers. EXACT shape as _addRunToThread / _removeRunFromThread above (new Map
// → set / GC delete-the-key). NEVER a global boolean — a global flag here is the
// BUG-260523-01-class regression (Thread A's workflow locking Thread B). Returns
// the NEXT Map so callers fold it into a setState partial.
// ─────────────────────────────────────────────────────────────────────────────
function _setWorkflowLock(
  current: Map<string, WorkflowLock>,
  threadId: string,
  lock: WorkflowLock,
): Map<string, WorkflowLock> {
  const next = new Map(current)
  next.set(threadId, lock)
  return next
}

function _clearWorkflowLock(
  current: Map<string, WorkflowLock>,
  threadId: string,
): Map<string, WorkflowLock> {
  if (!current.has(threadId)) return current
  const next = new Map(current)
  // GC: drop the key entirely on unlock — absence of a key IS "Deep/unlocked",
  // so size stays correct without a sentinel.
  next.delete(threadId)
  return next
}

export function StreamsProvider({ children }: PropsWithChildren) {
  // ---- Provider-scoped refs (D-068-01: handles, not display state) ----
  // Lifted VERBATIM from useMessages.ts:417-447 shape (single source of truth
  // for in-flight handles).
  const subscriptionsRef = useRef<Map<string, AbortController>>(new Map())
  const lastSeenOffsetRef = useRef<Map<string, string>>(new Map())
  const reconcileInFlightRef = useRef(false)
  const activeThreadIdRef = useRef<string | null>(null)
  // Phase 096-05 (D-09): most-recently-viewed thread ids, most-recent first,
  // deduped, capped at ~10 entries. Feeds the LRU-3 keep-set (viewed thread +
  // first STREAM_POOL_SIZE-1 MRU entries). A ref — never display state.
  const mruThreadsRef = useRef<string[]>([])
  // Phase 068 (Task 2a): additional refs lifted from useMessages.ts for sendMessage.
  // SEED-055 (true concurrent chats): the send guard is now PER-THREAD. The old
  // single global `isSendingRef` boolean + single-slot `streamingThreadIdRef` were
  // replaced by `sendingThreadsRef` — the Set of thread ids with a send currently in
  // flight. A send into thread B is therefore no longer blocked by thread A streaming
  // (the old global mutex silently DROPPED it — BUG-260603-01 mechanism #1). The Set
  // is added at the guard (synchronously, before the optimistic placeholders) and
  // deleted in the finally; the reconcile / loadMessages placeholder-preservation
  // guards read `.has(threadId)`, preserving the BUG-260521-01 wipe protection
  // per-thread. The reactive per-thread `streamingThreads` store Set (added/removed in
  // lockstep) still drives the composer's OWN-thread disable + Stop button.
  const sendingThreadsRef = useRef<Set<string>>(new Set())
  const abortControllerRef = useRef<AbortController | null>(null)
  const loadAbortRef = useRef<AbortController | null>(null)
  const stoppedByUserRef = useRef(false)
  const resumeInFlightRef = useRef(false)
  // Phase 092-07 (Facet C): the producer-stream re-subscribe closure, installed by
  // useEffect #1 (it closes over subscriptionsRef/lastSeenOffsetRef) and consumed
  // by the mount reconcile + the producer-resubscribe signal listener.
  const subscribeProducerStreamRef = useRef<
    ((threadId: string, producerRunId: string) => void) | null
  >(null)

  // Phase 068.5 D-068.5-03: throttled localStorage writer; hoisted into a ref
  // so the synchronous setViewingThread action body can call `.flush()` without
  // re-creating the throttle on every render. The actual writer is installed by
  // useEffect #4 below (Pattern S3: attach-then-symmetric-cleanup).
  const throttledWriteRef = useRef<(ReturnType<typeof makeThrottle> & { flush: () => void }) | null>(null)

  // ---- useEffect #1: register real action implementations (Pattern 4) ----
  // RESEARCH §Pitfall 3 + §Finding #2: actions are registered post-mount so
  // they close over the refs above.
  useEffect(() => {
    // Helper — surfaceId-bound writer for makeStreamCallbacks.
    const setMessagesForBucketBound =
      (surfaceId: SurfaceId, threadId: string): ThreadBoundSetMessages =>
      (updater) =>
        useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, updater)

    // ── Phase 096-05 (D-09 / BUG-260530-01): thread-keyed LRU-3 stream pool ──
    // The keep-set = {viewed thread} ∪ first (STREAM_POOL_SIZE - 1) MRU threads
    // (minus the viewed thread). EVERY stream-open site below is gated on
    // membership so no code path can ever leak a 4th held-open connection.
    const isThreadInStreamPool = (threadId: string | null): boolean => {
      if (threadId === null) return true // pre-navigation sends never blocked
      const viewed = activeThreadIdRef.current
      const keep = new Set<string>(
        [viewed, ...mruThreadsRef.current.filter((t) => t !== viewed)]
          .filter(Boolean)
          .slice(0, STREAM_POOL_SIZE) as string[],
      )
      return keep.has(threadId)
    }

    // Evict every subscription whose owning thread (reverse lookup via the
    // store's subscriptionsByThread mirror) is OUTSIDE the keep-set.
    //
    // api.ts:516-517 — AbortError is a SILENT return: NO onTerminal fires on a
    // caller-initiated abort, so the evictor must replicate the onTerminal
    // remove pair (StreamsProvider :subscribeProducerStream onTerminal shape)
    // itself: subscriptionsRef.delete + _removeRunFromThread, in lockstep.
    //
    // NEVER touch lastSeenOffsetRef — the cursor is the D-11 replay substrate:
    // returning to an evicted thread re-attaches via the existing reconcile
    // path, replaying from the retained cursor (client cursors win over the
    // snapshot's since_cursors re-seed).
    const enforceStreamPool = (viewedThreadId: string) => {
      const keep = new Set<string>(
        [viewedThreadId, ...mruThreadsRef.current.filter((t) => t !== viewedThreadId)]
          .filter(Boolean)
          .slice(0, STREAM_POOL_SIZE),
      )
      const byThread = useStreamsStore.getState().subscriptionsByThread
      for (const [ownerThreadId, runIds] of byThread) {
        if (keep.has(ownerThreadId)) continue
        for (const runId of runIds) {
          const controller = subscriptionsRef.current.get(runId)
          controller?.abort()
          subscriptionsRef.current.delete(runId)
          useStreamsStore.setState((s) => ({
            subscriptionsByThread: _removeRunFromThread(
              s.subscriptionsByThread,
              ownerThreadId,
              runId,
            ),
          }))
        }
      }
    }

    // Phase 092-07 (Facet C): re-subscribe a thread's FRESH producer stream so a
    // startup-sweep-resumed run (mount reconcile latest_producer_run_id) AND a
    // Harness Continue (the /continue 200 producer_run_id) re-attach their live
    // events with no page action. Per-thread keyed (BUG-260523-01), idempotent
    // (won't double-subscribe), additive — reuses the existing subscribeToRun
    // machinery + the chat-surface callbacks; touches no provider streaming branch.
    const subscribeProducerStream = (threadId: string, producerRunId: string) => {
      if (!threadId || !producerRunId) return
      // Idempotent: already attached → no-op.
      if (subscriptionsRef.current.has(producerRunId)) return
      // Phase 096-05 (D-09): pool-gate — skip opening (and the slot-reservation
      // write) for a thread outside the LRU-3 keep-set. The run keeps executing
      // server-side; reconcile re-attaches it when the thread is re-viewed.
      if (!isThreadInStreamPool(threadId)) return
      const surfaceId: SurfaceId = "chat"
      const controller = new AbortController()
      subscriptionsRef.current.set(producerRunId, controller)
      useStreamsStore.setState((s) => ({
        subscriptionsByThread: _addRunToThread(
          s.subscriptionsByThread,
          threadId,
          producerRunId,
        ),
      }))
      const callbacks: StreamCallbacks = makeStreamCallbacks({
        // No assistant placeholder to target — the resumed run's phase/sub-agent
        // events render in the panel via the shared callbacks; the chat transcript
        // is reconciled separately. Use the run id as the target id (harmless when
        // no placeholder matches).
        assistantId: producerRunId,
        threadId,
        setMessages: setMessagesForBucketBound(surfaceId, threadId),
      })
      callbacks.onCursor = (msId: string) => {
        lastSeenOffsetRef.current.set(producerRunId, msId)
      }
      const originalOnTerminal = callbacks.onTerminal
      callbacks.onTerminal = (kind, errorPayload) => {
        subscriptionsRef.current.delete(producerRunId)
        useStreamsStore.setState((s) => ({
          subscriptionsByThread: _removeRunFromThread(
            s.subscriptionsByThread,
            threadId,
            producerRunId,
          ),
        }))
        originalOnTerminal(kind, errorPayload)
      }
      subscribeToRun(
        producerRunId,
        lastSeenOffsetRef.current.get(producerRunId) ?? "0",
        callbacks,
        controller.signal,
      ).catch((err) => {
        if (!(err instanceof Error && err.name === "AbortError")) {
          console.error("producer re-subscribe failed:", err)
        }
        subscriptionsRef.current.delete(producerRunId)
      })
    }
    // expose to the reconcile action + the producer-resubscribe signal listener.
    subscribeProducerStreamRef.current = subscribeProducerStream

    useStreamsStore.setState({
      actions: {
        // --- D-068-04 / RESEARCH §Pattern 3: immutable nested-Map replace ---
        setMessagesForBucket: (surface, threadId, updater) => {
          useStreamsStore.setState((state) => {
            const surfMap = state.bucketsBySurface.get(surface) ?? new Map<string, Message[]>()
            const prev = surfMap.get(threadId) ?? EMPTY_ARRAY
            const updated =
              typeof updater === "function"
                ? (updater as (p: Message[]) => Message[])(prev)
                : updater
            const nextSurf = new Map(surfMap)
            nextSurf.set(threadId, updated)
            const nextBuckets = new Map(state.bucketsBySurface)
            nextBuckets.set(surface, nextSurf)
            return { bucketsBySurface: nextBuckets }
          })
        },

        // Phase 068 (L-068-01): Branch D-3 guard predicate (VERBATIM from
        // useMessages.ts:589-598) — refuse to wipe a bucket whose thread is
        // currently being streamed into. Predicate text matches the
        // acceptance-criterion grep exactly. Source: useMessages.ts:572-601.
        //
        // Plan 075.4-01 D-075.4-A1 NOTE: the Branch D-3 inequality predicate
        // BELOW is preserved verbatim per Phase 067.5 contract. The only change
        // inside the setState callback is dropping the now-obsolete global
        // streaming-flag return key: that global flip was a remnant from the
        // pre-067.5 wipe path (the bucket-wipe was assumed to imply a
        // streaming-end), but in the per-thread model the streaming-end SSE
        // handler in sendMessage's finally block owns the
        // streamingThreads.delete(tid) write authoritatively. Bucket deletion
        // is now structurally orthogonal to streaming-state membership.
        clearThreadBucket: (surface) => {
          const tid = activeThreadIdRef.current
          // SEED-055: refuse to wipe the active bucket if a send is in flight on it
          // (per-thread now — was `tid !== streamingThreadIdRef.current`).
          if (tid && !sendingThreadsRef.current.has(tid)) {
            useStreamsStore.setState((state) => {
              const surfMap = state.bucketsBySurface.get(surface)
              if (!surfMap || !surfMap.has(tid)) return {}
              const nextSurf = new Map(surfMap)
              nextSurf.delete(tid)
              const nextBuckets = new Map(state.bucketsBySurface)
              nextBuckets.set(surface, nextSurf)
              return {
                bucketsBySurface: nextBuckets,
              }
            })
          }
        },

        // Phase 068 (L-068-03): SOLE WRITER of activeThreadIdRef.
        // Plan 2 Task 2c extends this body to fire reconcile internally on
        // non-null threadId (RESEARCH §Finding #8 point 2 — mount-time-
        // reconcile-fire responsibility shifts here from ChatArea.tsx:165
        // post-lift). The activeThreadIdRef assignment count remains 1.
        setViewingThread: (threadId) => {
          // Phase 068.5 D-068.5-03 + rescope: flush the pending throttled
          // localStorage write BEFORE moving activeThreadIdRef so the snapshot
          // captures the OLD thread's bucket while it is still "active" under
          // the cache-write keepPredicate. Without this ordering, the predicate
          // would see the new threadId and drop the outgoing thread's data on
          // the floor (then on next render the outgoing thread's cache would
          // be stale until next visit).
          // No-op when no write is pending or before useEffect #4 has
          // installed the throttle (early-render path).
          throttledWriteRef.current?.flush()
          activeThreadIdRef.current = threadId
          useStreamsStore.setState({ viewedThreadId: threadId })
          // Phase 068 Task 2c (L-068-03 + RESEARCH §Finding #8 point 2):
          // mount-time-reconcile-fire responsibility lives here post-lift.
          // ChatArea.tsx:165 useEffect([thread?.id]) deleted by Plan 3 Task 2.
          // Sole writer of activeThreadIdRef.current preserved (assignment
          // count == 1). setViewingThread(null) is a no-op for reconcile
          // (D-068-08 listener-gate semantics extended to programmatic path).
          if (threadId !== null) {
            useStreamsStore
              .getState()
              .actions.reconcile(threadId)
              .catch((err) => {
                console.error("[StreamsProvider] reconcile from setViewingThread failed", err)
              })
            // Phase 096-05 (D-09): AFTER the reconcile fires — promote this
            // thread to the front of the MRU list (deduped, capped) and evict
            // every stream outside the LRU-3 keep-set. Navigation is the ONLY
            // eviction trigger; the viewed thread is always in the keep-set so
            // the reconcile above can never have its own attach evicted.
            mruThreadsRef.current = [
              threadId,
              ...mruThreadsRef.current.filter((t) => t !== threadId),
            ].slice(0, 10)
            enforceStreamPool(threadId)
          }
        },

        // Phase 068 (L-068-02 + L-068-05): reconcile in-flight lock +
        // runId-match dedup. Source: useMessages.ts:948-1144.
        // Phase 075 D-075-02: atomic swap — the parallel
        // Promise.all([getActiveRuns, loadMessages]) chain collapses into a
        // single getSnapshot() call. Server-derived since_cursors seed
        // lastSeenOffsetRef on first attach (D-075-01) so the per-run
        // subscribeToRun call picks up the seeded cursor automatically.
        reconcile: async (threadId, surfaceId = "chat") => {
          // Phase 063.1 (D-063.1-11 / Gap-005): top-of-function in-flight guard.
          if (reconcileInFlightRef.current) return
          reconcileInFlightRef.current = true
          try {
            let snapshot: ThreadSnapshot
            try {
              // Phase 075 D-075-02: ATOMIC SWAP — single round-trip replaces
              // the Promise.all([getActiveRuns, loadMessages]) chain.
              snapshot = await getSnapshot(threadId)
            } catch (err) {
              console.error("reconcile failed:", err)
              return
            }

            // Hydrate messages bucket. Phase 075.7 follow-up: widen the MERGE
            // predicate to also preserve temp placeholders that don't yet carry
            // a runId, provided a sendMessage is in flight on THIS thread.
            // sendMessage writes two optimistic placeholders synchronously
            // BEFORE awaiting postMessage (L:988-1018) and only stamps the
            // runId AFTER postMessage resolves (L:1047). A concurrent reconcile
            // fired from setViewingThread on a fresh thread races: if
            // getSnapshot resolves first, the original runId-required predicate
            // filtered both placeholders out and wiped the bucket, leaving every
            // subsequent SSE callback a no-op. Symmetric with loadMessages's
            // `if (isSendingRef.current && streamingThreadIdRef.current ===
            // threadId) return` at L:1316 — same intent, narrower scope
            // (preserve untyped temps instead of bailing completely).
            useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => {
              const dbRunIds = new Set(snapshot.messages.filter((m) => m.runId).map((m) => m.runId))
              // SEED-055: per-thread send-in-flight check (was
              // `isSendingRef.current && streamingThreadIdRef.current === threadId`).
              // Each thread's optimistic temps are now preserved on its OWN send,
              // so a reconcile on thread A no longer wipes A's temps while B streams.
              const sendInFlightOnThisThread = sendingThreadsRef.current.has(threadId)
              const liveTempPlaceholders = prev.filter((m) => {
                if (!m.id.startsWith("temp-")) return false
                if (m.runId) {
                  // BUG-260609-03 fix (symmetric with loadMessages): keep a runId-bearing
                  // temp only while genuinely in flight — subscribed, or still STREAMING
                  // and not yet persisted. A terminated, unsubscribed temp is a stale
                  // duplicate of the snapshot's persisted answer (harness answers return
                  // runId=undefined, so the old `!dbRunIds.has` survival orphaned it →
                  // double-render on reload). The untyped-temp branch below is untouched
                  // (it protects the 075.7 pre-stamp optimistic-placeholder race).
                  return (
                    subscriptionsRef.current.has(m.runId) ||
                    (!dbRunIds.has(m.runId) && m.runStatus === "streaming")
                  )
                }
                return sendInFlightOnThisThread
              })
              return [...snapshot.messages, ...liveTempPlaceholders]
            })

            // Phase 075 D-075-01: seed lastSeenOffsetRef from server cursors
            // ONLY for run_ids not already in the map (existing client
            // cursors win on subsequent reconciles).
            for (const [rid, cursor] of Object.entries(snapshot.since_cursors)) {
              if (!lastSeenOffsetRef.current.has(rid)) {
                lastSeenOffsetRef.current.set(rid, cursor)
              }
            }

            const activeRuns = snapshot.active_runs
            for (const run of activeRuns) {
              // Pitfall 3 cross-thread safety: only attach if this thread is still
              // the viewing thread when reconcile started.
              if (activeThreadIdRef.current !== threadId) return

              // Phase 063.1 (D-063.1-04 / Gap-001) / Phase 068 L-068-05:
              // runId-match dedup. RESEARCH §Pattern 5: read from current
              // bucket via getState() (replaces the messagesByThreadRef
              // mirror that pre-lift maintained).
              const threadMessages =
                useStreamsStore.getState().bucketsBySurface.get(surfaceId)?.get(threadId) ?? []
              const existingByRunId = threadMessages.find((m) => m.runId === run.run_id)
              const targetId = existingByRunId?.id ?? `temp-${run.run_id}`

              if (!existingByRunId) {
                const placeholder: Message = {
                  id: targetId,
                  thread_id: threadId,
                  user_id: "",
                  role: "assistant",
                  content: "",
                  created_at: run.started_at,
                  updated_at: run.started_at,
                  tool_calls: [],
                  runId: run.run_id,
                  runStatus: "streaming",
                }
                useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => {
                  if (prev.some((m) => m.id === targetId)) return prev
                  return [...prev, placeholder]
                })
              }

              // Phase 063.1 (D-063.1-09 / Gap-003): NARROWED short-circuit.
              if (subscriptionsRef.current.has(run.run_id)) continue

              // Phase 096-05 (D-09): pool-gate — never open (or reserve a slot
              // for) a stream whose thread is outside the LRU-3 keep-set. In
              // practice reconcile targets the viewed thread (always in-pool);
              // the gate is defensive so no future path leaks a 4th connection.
              if (!isThreadInStreamPool(threadId)) continue

              // WR-06 fix: RESERVE the subscription slot BEFORE firing subscribeToRun.
              const controller = new AbortController()
              subscriptionsRef.current.set(run.run_id, controller)
              // Plan 075.4-01 D-075.4-A1: per-thread subscriptionsByThread.
              useStreamsStore.setState((s) => ({
                subscriptionsByThread: _addRunToThread(s.subscriptionsByThread, threadId, run.run_id),
              }))

              const callbacks: StreamCallbacks = makeStreamCallbacks({
                assistantId: targetId,
                threadId,
                setMessages: setMessagesForBucketBound(surfaceId, threadId),
              })
              const originalOnTerminal = callbacks.onTerminal
              callbacks.onTerminal = async (kind, errorPayload) => {
                // Phase 075.1 Plan 01: widened transient-stream-end probe.
                // Read the placeholder's current tool_calls from the store so
                // the helper can detect "kind === 'done' with active tools".
                // RESEARCH §Pattern 5: read via getState() (no ref mirror).
                const currentBucket =
                  useStreamsStore.getState().bucketsBySurface.get(surfaceId)?.get(threadId) ?? []
                const currentToolCalls = currentBucket.find((m) => m.id === targetId)?.tool_calls
                // Phase 075.2 Plan 01 Task 1 (D-075.2-03): single-probe pattern.
                // _isTransientStreamEnd returns the threaded ThreadSnapshot | null,
                // which feeds _reattachAfterTransient so the helper does NOT call
                // getSnapshot a second time (eliminates the WR-02 two-probe race
                // on this reconcile path — mirror of the sendMessage-path edit).
                const transientSnapshot = await _isTransientStreamEnd(
                  kind,
                  errorPayload,
                  threadId,
                  run.run_id,
                  currentToolCalls,
                )
                if (transientSnapshot) {
                  // Phase 075.1 Task 2: re-attach instead of flipping
                  // runStatus. Build a fresh AbortController + reuse the
                  // already-bound callbacks so cursor handler + placeholder
                  // targeting carry over.
                  const reattached = await _reattachAfterTransient(
                    transientSnapshot,
                    threadId,
                    run.run_id,
                    lastSeenOffsetRef,
                    (rid: string, since: string) => {
                      // Phase 096-05 (D-09): pool-gate the transient re-attach
                      // — skip opening (and the slot reservation) when the
                      // owning thread left the LRU-3 keep-set mid-probe.
                      if (!isThreadInStreamPool(threadId)) return
                      const newController = new AbortController()
                      subscriptionsRef.current.set(rid, newController)
                      // Plan 075.4-01 D-075.4-A1: per-thread subscriptionsByThread.
                      useStreamsStore.setState((s) => ({
                        subscriptionsByThread: _addRunToThread(s.subscriptionsByThread, threadId, rid),
                      }))
                      // Fire-and-forget — same shape as the outer
                      // subscribeToRun() call below. Errors logged but not
                      // surfaced (the next reconcile cycle will retry).
                      subscribeToRun(rid, since, callbacks, newController.signal).catch(
                        (err) => {
                          if (!(err instanceof Error && err.name === "AbortError")) {
                            console.error("reconcile reattach subscribeToRun failed:", err)
                          }
                        },
                      )
                    },
                  )
                  if (reattached) return
                  // Phase 075.2 Plan 01 Task 1: _reattachAfterTransient now
                  // always returns true (no internal getSnapshot probe to
                  // fail). The `if (reattached) return` shape is preserved
                  // for symmetry but the fall-through is currently dead.
                }
                useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => {
                  if (!prev.some((m) => m.id === targetId)) return prev
                  return prev.map((m) => {
                    if (m.id !== targetId) return m
                    if (kind === "done") return { ...m, runStatus: "completed" }
                    if (kind === "error") return { ...m, runStatus: "failed", runError: errorPayload ?? undefined }
                    if (kind === "timed_out") return { ...m, runStatus: "timed_out", runError: errorPayload ?? undefined }
                    if (kind === "reader_done") return { ...m, runStatus: "completed" }
                    // kind === "cancelled"
                    return { ...m, runStatus: "cancelled", runError: errorPayload ?? undefined }
                  })
                })
                // L-068-07: cleanup on onTerminal (BL-03 fix).
                // Plan 075.4-01 D-075.4-A1: per-thread subscriptionsByThread.
                subscriptionsRef.current.delete(run.run_id)
                useStreamsStore.setState((s) => ({
                  subscriptionsByThread: _removeRunFromThread(s.subscriptionsByThread, threadId, run.run_id),
                }))
                if (errorPayload === "buffer_expired") {
                  useStreamsStore
                    .getState()
                    .actions.loadMessages(threadId, surfaceId)
                    .catch(console.error)
                }
                originalOnTerminal(kind, errorPayload)
              }

              // Phase 063.1 (D-063.1-01/02 / Gap-004): cursor advancement.
              callbacks.onCursor = (msId: string) => {
                lastSeenOffsetRef.current.set(run.run_id, msId)
              }

              subscribeToRun(
                run.run_id,
                lastSeenOffsetRef.current.get(run.run_id) ?? "0",
                callbacks,
                controller.signal,
              )
                .catch((err) => {
                  if (!(err instanceof Error && err.name === "AbortError")) {
                    console.error("reconcile subscribeToRun failed:", err)
                  }
                })
                .finally(() => {
                  // BL-03 safety net.
                  // Plan 075.4-01 D-075.4-A1: per-thread subscriptionsByThread.
                  if (subscriptionsRef.current.has(run.run_id)) {
                    subscriptionsRef.current.delete(run.run_id)
                    useStreamsStore.setState((s) => ({
                      subscriptionsByThread: _removeRunFromThread(s.subscriptionsByThread, threadId, run.run_id),
                    }))
                  }
                  // Pitfall 5 (terminal-time merge).
                  useStreamsStore
                    .getState()
                    .actions.loadMessages(threadId, surfaceId)
                    .catch(console.error)
                })
            }

            // Phase 092 (092-06 / F3 — SC#5 / D-v2.5-03): reconcile the per-thread
            // workflow lock from the AUTHORITATIVE GET /threads/{id}/workflow read
            // (Realtime/SSE is a hint, not truth). A reload mid-workflow rehydrates
            // the composer lock here; a stale/terminal anchor (F2 self-heal) CLEARS
            // it so the composer re-enables. Own try/catch — a workflow-state fetch
            // failure must NOT break message reconcile. Keyed by the OWNING
            // `threadId` (closure) — never a global flag (SC#3 / BUG-260523-01).
            if (activeThreadIdRef.current === threadId) {
              try {
                const wf = await getThreadWorkflow(threadId)
                const actions = useStreamsStore.getState().actions
                if (wf.locked && !wf.lock_is_stale && wf.active_workflow_run_id) {
                  actions.setWorkflowLockForThread(threadId, {
                    runId: wf.active_workflow_run_id,
                    mode: "harness",
                    capPaused: wf.cap_paused,
                    continuesRemaining: wf.continues_remaining,
                  })
                  // Phase 092-07 (Facet C, startup-sweep re-attach): when the
                  // workflow is live AND the backend reports a live producer runs
                  // row (latest_producer_run_id — the fresh shell a startup-sweep
                  // resume minted), re-subscribe its stream so the resumed run's
                  // events render with no page action. Per-thread keyed; idempotent.
                  if (wf.latest_producer_run_id) {
                    subscribeProducerStreamRef.current?.(
                      threadId,
                      wf.latest_producer_run_id,
                    )
                  }
                } else {
                  // Stale / terminal / Deep → unlock (honors the F2 self-heal).
                  actions.clearWorkflowLockForThread(threadId)
                }
              } catch (err) {
                console.error("reconcile workflow-state failed:", err)
              }
            }
          } finally {
            // Phase 063.1 (D-063.1-11 / Gap-005): ALWAYS reset in finally.
            reconcileInFlightRef.current = false
          }
        },

        // Phase 068 (L-068-04 + L-068-07): bucket-routing on streaming
        // thread; cleanup on onTerminal. Source: useMessages.ts:673-939.
        sendMessage: async (threadId, content, opts) => {
          const surfaceId: SurfaceId = opts?.surfaceId ?? "chat"
          // SEED-055 (true concurrent chats): per-thread guard. Block only a re-send
          // into a thread that is ALREADY sending (re-entrancy / double-submit) — a
          // send into a DIFFERENT thread proceeds CONCURRENTLY (the old global
          // `isSendingRef` boolean silently dropped it). Added synchronously here,
          // before the optimistic placeholders, so a fresh-thread reconcile's
          // preserve-guard sees it immediately.
          if (sendingThreadsRef.current.has(threadId)) return
          sendingThreadsRef.current.add(threadId)

          // Optimistic user message.
          const userMsg: Message = {
            id: makeTempId(),
            thread_id: threadId,
            user_id: "",
            role: "user",
            content,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => [
            ...prev,
            userMsg,
          ])

          // Optimistic assistant placeholder.
          const assistantId = makeTempId()
          const assistantMsg: Message = {
            id: assistantId,
            thread_id: threadId,
            user_id: "",
            role: "assistant",
            content: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tool_calls: [],
            runStatus: "streaming",
          }
          useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => [
            ...prev,
            assistantMsg,
          ])
          // Plan 075.4-01 D-075.4-A1: per-thread streamingThreads.
          useStreamsStore.setState((s) => ({
            streamingThreads: new Set(s.streamingThreads).add(threadId),
          }))

          const controller = new AbortController()
          abortControllerRef.current = controller

          let registeredRunId: string | null = null

          try {
            // Step 1: POST returns synchronously with {message_id, run_id} (D-063-01)
            // Phase 095.1-07 (GAP-2): the dispatch response now ALSO carries the
            // RESOLVED model/provider (aliased so they don't shadow the request
            // `opts?.model`/`opts?.provider`); we stamp them onto the assistant
            // placeholder below so attribution shows in the LIVE moment, not only
            // after a reload re-reads them via the Plan-03 enrich SELECT.
            const {
              message_id,
              run_id,
              model: resolvedModel,
              provider: resolvedProvider,
            } = await postMessage(threadId, content, {
              model: opts?.model,
              provider: opts?.provider,
              agentMode: opts?.agentMode,
              // Phase 092 (D-02): kickoff field — only present on a Harness send.
              workflowDefinitionId: opts?.workflowDefinitionId,
            })
            registeredRunId = run_id

            // Phase 092 (092-06 / F3 — SC#3): seed the per-thread workflow lock
            // at KICKOFF so the composer disables IMMEDIATELY on a Harness send,
            // not only when a cap_paused SSE arrives. Keyed by the OWNING
            // `threadId` (closure) — never a global flag (BUG-260523-01). A fresh
            // run has the full Continue budget (D-06: max 3/run); a real terminal
            // (onTerminal) or the mount reconcile clears/refreshes it.
            if (opts?.workflowDefinitionId && run_id) {
              useStreamsStore.getState().actions.setWorkflowLockForThread(threadId, {
                runId: run_id,
                mode: "harness",
                capPaused: false,
                continuesRemaining: 3,
              })
            }

            // D-067-01: reserve subscription slot BEFORE the runId-stamping setMessages.
            // L-068-07 (open side): track in subscriptionsByThread mirror.
            // Plan 075.4-01 D-075.4-A1: per-thread subscriptionsByThread.
            // Phase 096-05 (D-09): pool-gate — in practice the send-time thread
            // IS the viewed thread (always in-pool); the gate is defensive so a
            // future code path can't leak a 4th held-open connection. Computed
            // ONCE here (no awaits between reservation and the subscribe below)
            // so the reservation and the open stay consistent.
            const sendThreadInPool = isThreadInStreamPool(threadId)
            if (sendThreadInPool) {
              subscriptionsRef.current.set(run_id, controller)
              useStreamsStore.setState((s) => ({
                subscriptionsByThread: _addRunToThread(s.subscriptionsByThread, threadId, run_id),
              }))
            }

            // WR-04 fix: swap temp user id for real, stamp run_id on assistant placeholder.
            // Phase 095.1-07 (GAP-2): also stamp the RESOLVED model/provider so the
            // RunCard run-sub shows `{provider} · {model}` LIVE. Coerce null →
            // undefined to match the Message type (string | undefined, not | null).
            useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
              prev.map((m) => {
                if (m.id === userMsg.id) return { ...m, id: message_id }
                if (m.id === assistantId)
                  return {
                    ...m,
                    runId: run_id,
                    model: resolvedModel ?? undefined,
                    provider: resolvedProvider ?? undefined,
                  }
                return m
              }),
            )

            // Step 2: open the GET stream and dispatch SSE events to per-message-id callbacks.
            const callbacks: StreamCallbacks = makeStreamCallbacks({
              assistantId,
              threadId,
              onTitleUpdate: opts?.onTitleUpdate,
              setMessages: setMessagesForBucketBound(surfaceId, threadId),
            })

            const originalOnTerminal = callbacks.onTerminal
            callbacks.onTerminal = async (kind, errorPayload) => {
              // Phase 075.1 Plan 01: widened transient-stream-end probe.
              // sendMessage path uses `registeredRunId` (populated after the
              // POST returns); reconcile path uses `run.run_id`. Shared
              // helper guarantees the two sites agree on the decision matrix.
              if (registeredRunId) {
                // Read placeholder tool_calls from the store so the helper
                // can detect "kind === 'done' with active tools" (e.g.,
                // OpenRouter B-260519-03 premature-done scenario).
                const currentBucket =
                  useStreamsStore.getState().bucketsBySurface.get(surfaceId)?.get(threadId) ?? []
                const currentToolCalls = currentBucket.find((m) => m.id === assistantId)?.tool_calls
                // Phase 075.2 Plan 01 Task 1 (D-075.2-03): single-probe pattern.
                // Snapshot is threaded into _reattachAfterTransient so the
                // helper does NOT call getSnapshot again. See helper docstring.
                const transientSnapshot = await _isTransientStreamEnd(
                  kind,
                  errorPayload,
                  threadId,
                  registeredRunId,
                  currentToolCalls,
                )
                if (transientSnapshot) {
                  // Re-attach using the shared helper.
                  const reattached = await _reattachAfterTransient(
                    transientSnapshot,
                    threadId,
                    registeredRunId,
                    lastSeenOffsetRef,
                    (rid, since) => {
                      // Phase 096-05 (D-09): pool-gate the transient re-attach
                      // — skip opening (and the slot reservation) when the
                      // owning thread left the LRU-3 keep-set mid-probe.
                      if (!isThreadInStreamPool(threadId)) return
                      const newController = new AbortController()
                      subscriptionsRef.current.set(rid, newController)
                      // Plan 075.4-01 D-075.4-A1: per-thread subscriptionsByThread.
                      useStreamsStore.setState((s) => ({
                        subscriptionsByThread: _addRunToThread(s.subscriptionsByThread, threadId, rid),
                      }))
                      subscribeToRun(rid, since, callbacks, newController.signal).catch(
                        (err) => {
                          if (!(err instanceof Error && err.name === "AbortError")) {
                            console.error("sendMessage reattach subscribeToRun failed:", err)
                          }
                        },
                      )
                    },
                  )
                  if (reattached) return
                  // Phase 075.2 Plan 01 Task 1: _reattachAfterTransient now
                  // always returns true. Fall-through preserved for symmetry
                  // but currently dead.
                }
              }
              useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => {
                if (!prev.some((m) => m.id === assistantId)) return prev
                return prev.map((m) => {
                  if (m.id !== assistantId) return m
                  if (kind === "done") return { ...m, runStatus: "completed" }
                  if (kind === "error") return { ...m, runStatus: "failed", runError: errorPayload ?? undefined }
                  if (kind === "timed_out") return { ...m, runStatus: "timed_out", stopped: true, runError: errorPayload ?? undefined }
                  if (kind === "reader_done") return { ...m, runStatus: "completed" }
                  // kind === "cancelled"
                  return { ...m, runStatus: "cancelled", stopped: true, runError: errorPayload ?? undefined }
                })
              })
              // L-068-07: BL-03 fix — subscriptionsRef cleanup belongs in
              // onTerminal, NOT the finally chain. Mirror updates alongside.
              // Plan 075.4-01 D-075.4-A1: per-thread subscriptionsByThread.
              if (registeredRunId) {
                subscriptionsRef.current.delete(registeredRunId)
                const runIdToRemove = registeredRunId
                useStreamsStore.setState((s) => ({
                  subscriptionsByThread: _removeRunFromThread(s.subscriptionsByThread, threadId, runIdToRemove),
                }))
              }
              // Phase 092 (SC#3 / MODE-02): a TERMINAL kind unlocks the thread
              // (the lock-clear is also authoritative server-side — finish_run
              // clears the anchor; the mount reconcile is the source of truth).
              // cap_paused is NON-terminal and is delivered via onCapPaused, NOT
              // onTerminal — so the lock survives a pause and only clears here on
              // a real terminal (done / error / timed_out / cancelled / reader_done).
              useStreamsStore.getState().actions.clearWorkflowLockForThread(threadId)
              // Pitfall 8: TTL-expired buffer fallback.
              if (errorPayload === "buffer_expired") {
                useStreamsStore
                  .getState()
                  .actions.loadMessages(threadId, surfaceId)
                  .catch(console.error)
              }
              originalOnTerminal(kind, errorPayload)
            }

            // Phase 063.1 (D-063.1-01/02 / Gap-004): cursor advancement.
            callbacks.onCursor = (msId: string) => {
              lastSeenOffsetRef.current.set(run_id, msId)
            }

            // Phase 096-05 (D-09): same gate as the slot reservation above —
            // skip the held-open fetch when the thread is outside the pool
            // (the run keeps executing server-side; reconcile re-attaches it).
            if (sendThreadInPool) {
              await subscribeToRun(run_id, "0", callbacks, controller.signal)
            }
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
              // Caller-initiated abort.
            } else if (err instanceof ApiError && err.status === 409) {
              // Phase 092 (092-06 / F3): a 409 lock-refusal (MODE-02 server-side
              // Harness→Deep refusal). Roll back BOTH optimistic bubbles — the
              // user bubble AND the orphaned assistant placeholder — so no ghost
              // messages linger. Then surface a fixed, per-thread error banner
              // (T-092-06-03: a constant user-facing string, never the raw
              // server body). Keyed by the OWNING threadId — never a global flag.
              useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
                prev.filter((m) => m.id !== assistantId && m.id !== userMsg.id),
              )
              useStreamsStore.setState((s) => ({
                reconcileErrors: new Map(s.reconcileErrors).set(
                  threadId,
                  new ApiError(
                    "This thread is running a workflow — cancel it to send a Deep message.",
                    409,
                  ),
                ),
              }))
            } else if (err instanceof ApiError) {
              // 099-08 (UAT L10): a non-409 kickoff/send refusal (e.g. the 400
              // disabled-skill gate). Mirror the 409 rollback shape — drop BOTH
              // optimistic temps so reconcile (the preserve-guard ~1295-1319)
              // cannot resurrect a dead blank thread — but surface the SERVER's
              // descriptive detail (already a plain string from api.ts; rendered
              // as React text in ChatArea, never HTML → T-099-08-01). Stash the
              // typed prompt per-thread so the composer can recover it via the
              // existing prefill seam.
              useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
                prev.filter((m) => m.id !== assistantId && m.id !== userMsg.id),
              )
              useStreamsStore.setState((s) => ({
                reconcileErrors: new Map(s.reconcileErrors).set(threadId, err),
                failedSendDrafts: new Map(s.failedSendDrafts).set(threadId, content),
              }))
            } else {
              // genuine network / non-HTTP failure — unchanged swallow-to-failed-placeholder.
              console.error("sendMessage failed:", err)
              useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, runStatus: "failed" } : m,
                ),
              )
            }
          } finally {
            abortControllerRef.current = null
            // SEED-055: release THIS thread's send slot (per-thread; other threads'
            // in-flight sends are unaffected).
            sendingThreadsRef.current.delete(threadId)
            // Plan 075.4-01 D-075.4-A1: per-thread streamingThreads delete.
            // This is the AUTHORITATIVE streaming-end write — clearThreadBucket
            // no longer writes here (D-075.4-A1 invariant; see L:617).
            useStreamsStore.setState((s) => {
              const next = new Set(s.streamingThreads)
              next.delete(threadId)
              return { streamingThreads: next }
            })
            // L-068-07 safety net: only delete if entry still present (catch
            // paths where onTerminal didn't fire).
            // Plan 075.4-01 D-075.4-A1: per-thread subscriptionsByThread.
            if (registeredRunId && subscriptionsRef.current.has(registeredRunId)) {
              subscriptionsRef.current.delete(registeredRunId)
              const runIdToRemove = registeredRunId
              useStreamsStore.setState((s) => ({
                subscriptionsByThread: _removeRunFromThread(s.subscriptionsByThread, threadId, runIdToRemove),
              }))
            }

            // Always clear planning flag on stream end.
            useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, isPlanning: false } : m)),
            )

            const wasStoppedByUser = stoppedByUserRef.current

            if (wasStoppedByUser) {
              useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m
                  const hasActiveTools = m.tool_calls?.some(
                    (tc) => tc.status === "running" || tc.status === "preparing",
                  )
                  if (!hasActiveTools) return m
                  return {
                    ...m,
                    tool_calls: m.tool_calls!.map((tc) =>
                      tc.status === "running" || tc.status === "preparing"
                        ? { ...tc, status: "interrupted" as const }
                        : tc,
                    ),
                  }
                }),
              )
            }

            useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => {
              const lastMsg = prev[prev.length - 1]
              if (lastMsg?.id === assistantId) {
                return prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, ...(wasStoppedByUser ? { stopped: true } : {}) }
                    : m,
                )
              }
              return prev
            })

            stoppedByUserRef.current = false
          }
        },

        // Phase 068 (L-068-07 safety-net side): stopStream tears down
        // subscription; mirror remove. Source: useMessages.ts:477-495.
        stopStream: async () => {
          // SEED-055: Stop targets the VIEWED thread — the composer's Stop button
          // only renders on the thread you're watching (useStreamingForThread), and
          // under concurrency there is no single "streaming thread" to fall back to.
          // Was `streamingThreadIdRef.current ?? activeThreadIdRef.current`.
          const stid = activeThreadIdRef.current
          if (!stid) return
          const bucket =
            useStreamsStore.getState().bucketsBySurface.get("chat")?.get(stid) ?? []
          const streamingMsg = [...bucket]
            .reverse()
            .find((m) => m.role === "assistant" && m.runStatus === "streaming")
          const runId = streamingMsg?.runId
          if (!runId) return
          stoppedByUserRef.current = true
          try {
            await cancelRun(runId)
          } catch (err) {
            console.error("Stop failed:", err)
          }
        },

        // SEED-064 — stop the active run on ANY thread (not just the viewed one).
        // Mirrors stopStream but takes an explicit threadId so the sidebar Stop +
        // the cross-thread active-runs tray can cancel a backgrounded run without
        // navigating into it. Same durable cancel path (DELETE /runs/{id}); same
        // stopped-by-user marking so the terminal renders "Response stopped".
        stopThread: async (threadId: string) => {
          if (!threadId) return
          const bucket =
            useStreamsStore.getState().bucketsBySurface.get("chat")?.get(threadId) ?? []
          const streamingMsg = [...bucket]
            .reverse()
            .find((m) => m.role === "assistant" && m.runStatus === "streaming")
          const runId = streamingMsg?.runId
          if (!runId) return
          stoppedByUserRef.current = true
          try {
            await cancelRun(runId)
          } catch (err) {
            console.error("Stop failed (thread", threadId, "):", err)
          }
        },

        // Phase 068 (L-068-07): resume retries via sendMessage; mirror
        // semantics inherited. Source: useMessages.ts:1158-1190.
        resumeFromFailed: async (failedMessage) => {
          if (resumeInFlightRef.current) return
          resumeInFlightRef.current = true
          try {
            const surfaceId: SurfaceId = "chat"
            const threadId = failedMessage.thread_id
            const bucket =
              useStreamsStore.getState().bucketsBySurface.get(surfaceId)?.get(threadId) ?? []
            const idx = bucket.findIndex((m) => m.id === failedMessage.id)
            if (idx < 0) return
            let userMsg: Message | undefined
            for (let i = idx - 1; i >= 0; i--) {
              if (bucket[i].role === "user") {
                userMsg = bucket[i]
                break
              }
            }
            if (!userMsg) {
              console.warn("resumeFromFailed: no preceding user message for", failedMessage.id)
              return
            }
            await useStreamsStore
              .getState()
              .actions.sendMessage(threadId, userMsg.content, { surfaceId })
          } finally {
            resumeInFlightRef.current = false
          }
        },

        // Phase 068 (L-068-03 + L-068-06): post-await sole-writer guard +
        // MERGE 3-clause filter. Source: useMessages.ts:603-671.
        //
        // Phase 068.5 Plan 02 (D-068.5-08 + D-068.5-09): wraps the existing body
        // (L-068.5-02 MERGE 3-clause filter byte-identical inside) with a
        // silent-1s-then-banner retry shell. AbortError unchanged.
        // Banner state lives in `useStreamsStore.reconcileError`; ChatArea renders
        // the banner slot.
        loadMessages: async (threadId, surfaceId = "chat") => {
          // Phase 068.5 Gap-01: mark "this thread is currently loading" so
          // MessageList can distinguish "fetch in flight, show skeleton" from
          // "genuinely empty thread, hide skeleton." Cleared in the outer
          // finally below (covers success, abort, retry, final-failure paths).
          // Plan 075.4-01 D-075.4-A1: per-thread loadingThreads.
          useStreamsStore.setState((s) => ({
            loadingThreads: new Set(s.loadingThreads).add(threadId),
          }))
          const tryFetch = async (attempt: number): Promise<void> => {
            // D-060-03: cancel the previous in-flight getMessages fetch.
            loadAbortRef.current?.abort()
            const controller = new AbortController()
            loadAbortRef.current = controller
            try {
              const data = await getMessages(threadId, controller.signal)
              // L-068-03 / D-060-02: read activeThreadIdRef ONLY after await —
              // discards cross-thread responses.
              if (activeThreadIdRef.current !== threadId) return
              // Protect optimistic placeholders if a send is in flight on the same thread.
              // Phase 068.5 Gap-02 / SEED-055: per-thread guard — bail only if a send
              // is in flight on THIS thread (its optimistic temps aren't yet runId-
              // stamped). Cross-thread cold-load reconciles still merge normally. Was
              // `isSendingRef.current && streamingThreadIdRef.current === threadId`.
              if (sendingThreadsRef.current.has(threadId)) return
              // L-068-06 / L-068.5-02: MERGE 3-clause filter preserves live in-flight
              // temp placeholders. Predicate (BYTE-IDENTICAL from useMessages.ts:644-649):
              //   m.id.startsWith('temp-') && m.runId && !dbRunIds.has(m.runId)
              useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => {
                const dbRunIds = new Set(data.filter((m) => m.runId).map((m) => m.runId))
                const liveTempPlaceholders = prev.filter(
                  (m) =>
                    m.id.startsWith("temp-") &&
                    m.runId &&
                    // Keep a runId-bearing temp ONLY while genuinely in flight: a live
                    // SSE consumer is still bound, OR the run is still STREAMING and the
                    // DB hasn't returned it yet. BUG-260609-03 fix: the prior bare
                    // `!dbRunIds.has(m.runId)` survival orphaned a TERMINATED streamed
                    // copy forever for harness runs — the harness producer-shell leaves
                    // runs.message_id NULL (harness_engine.py:353-357) so the fetched
                    // answer comes back with runId=undefined, dbRunIds never holds the
                    // run_id, and the cached temp + the DB copy both rendered (double
                    // answer on reload, persisted). A terminated, unsubscribed temp is a
                    // stale duplicate of the just-fetched `data` answer → drop it (the
                    // answer is preserved in `data`). Deep is unaffected (its fetched msg
                    // carries runId, so it was already dropped via dbRunIds.has).
                    (subscriptionsRef.current.has(m.runId) ||
                      (!dbRunIds.has(m.runId) && m.runStatus === "streaming")),
                )
                return [...data, ...liveTempPlaceholders]
              })
              // Phase 068.5: clear any prior banner state on success (handles
              // transient outage recovery — first attempt fails, retry succeeds,
              // or user clicks Retry and the fresh fetch succeeds).
              // Plan 075.4-01 D-075.4-A1: per-thread reconcileErrors. The
              // threadId predicate is no longer needed — the Map key naturally
              // scopes the delete to the right thread.
              if (useStreamsStore.getState().reconcileErrors.has(threadId)) {
                useStreamsStore.setState((s) => {
                  const next = new Map(s.reconcileErrors)
                  next.delete(threadId)
                  return { reconcileErrors: next }
                })
              }
            } catch (err) {
              // Existing AbortError handling — early return, no retry, no banner.
              if (err instanceof Error && err.name === "AbortError") return
              if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError") return
              if (attempt === 0) {
                // D-068.5-09 + W-03 fix: silent single retry at 1s, bound to
                // the controller's AbortSignal so a thread switch / unmount /
                // user-initiated abort cancels the pending retry instead of
                // letting it fire stale into the new thread's fetch.
                try {
                  await new Promise<void>((resolve, reject) => {
                    const t = setTimeout(resolve, 1000)
                    const onAbort = () => {
                      clearTimeout(t)
                      reject(new DOMException("aborted", "AbortError"))
                    }
                    if (controller.signal.aborted) {
                      onAbort()
                      return
                    }
                    controller.signal.addEventListener("abort", onAbort, { once: true })
                  })
                } catch (waitErr) {
                  if (waitErr instanceof DOMException && waitErr.name === "AbortError") return
                  throw waitErr
                }
                return tryFetch(1)
              }
              // Second failure → banner (D-068.5-08 + D-068.5-09)
              // Plan 075.4-01 D-075.4-A1: per-thread reconcileErrors.
              useStreamsStore.setState((s) => ({
                reconcileErrors: new Map(s.reconcileErrors).set(
                  threadId,
                  err instanceof Error ? err : new Error(String(err)),
                ),
              }))
            }
          }
          try {
            await tryFetch(0)
          } finally {
            // Phase 068.5 Gap-01: clear the loading marker.
            // Plan 075.4-01 D-075.4-A1: per-thread loadingThreads. The
            // "still the owner" guard from the old global flag is no longer
            // meaningful because each thread now owns its own Set membership —
            // a concurrent load for a DIFFERENT thread cannot clobber this
            // thread's bit. Always delete this thread's entry on exit.
            useStreamsStore.setState((s) => {
              if (!s.loadingThreads.has(threadId)) return {}
              const next = new Set(s.loadingThreads)
              next.delete(threadId)
              return { loadingThreads: next }
            })
          }
        },

        // ────────────────────────────────────────────────────────────────────
        // Phase 086 Plan 02 (PATTERNS §2 / PANEL-06) — 11 panel action bodies.
        // Every body uses the immutable `new Map(prev)` clone-then-set discipline
        // (analog: setMessagesForBucket @717-731, delete-key @1386-1392) so the
        // outer Map ref always changes and subscribeWithSelector selectors stay
        // stable — chat-message selectors (which read bucketsBySurface) NEVER
        // re-render when a panel Map mutates. Identity keys per the backend wire
        // shapes: Todo by `id` (full-replace), WorkspaceFile by `path`, PendingAsk
        // by `tool_call_id`, TaskRunIndexItem by `sub_run_id`.
        // ────────────────────────────────────────────────────────────────────

        // --- todos: full-state-replace (todo_updated SSE / GET reconcile) ---
        replaceTodosForThread: (threadId, todos) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.todosByThread)
            next.set(threadId, todos)
            return { todosByThread: next }
          }),
        // setTodosForThread mirrors replace (the SSE `todos` array is the full
        // canonical list — there is no per-todo delta to merge).
        setTodosForThread: (threadId, todos) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.todosByThread)
            next.set(threadId, todos)
            return { todosByThread: next }
          }),

        // --- workspace files: keyed-by-`path` upsert / remove / full-replace ---
        setWorkspaceFileForThread: (threadId, file) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.workspaceFilesByThread)
            const prev = next.get(threadId) ?? EMPTY_FILES
            const idx = prev.findIndex((f) => f.path === file.path)
            // Phase 088-05 (D-16): the workspace_file_written SSE now carries the
            // persisted row `id`. DEFENSIVELY preserve a known id on the existing
            // entry if an incoming update for the same path is ever missing one
            // (legacy/replayed event) — never clobber a real id with undefined, or
            // the live panel would regress to fetching `/files//content` → 404.
            const merged =
              idx === -1
                ? file
                : { ...file, id: file.id ?? prev[idx].id }
            const updated =
              idx === -1
                ? [...prev, merged]
                : prev.map((f, i) => (i === idx ? merged : f))
            next.set(threadId, updated)
            return { workspaceFilesByThread: next }
          }),
        removeWorkspaceFileForThread: (threadId, path) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.workspaceFilesByThread)
            const prev = next.get(threadId) ?? EMPTY_FILES
            next.set(
              threadId,
              prev.filter((f) => f.path !== path),
            )
            return { workspaceFilesByThread: next }
          }),
        replaceWorkspaceFilesForThread: (threadId, files) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.workspaceFilesByThread)
            next.set(threadId, files)
            return { workspaceFilesByThread: next }
          }),

        // --- pending asks: keyed-by-`tool_call_id` add / remove / full-replace ---
        addPendingAskForThread: (threadId, ask) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.pendingAsksByThread)
            const prev = next.get(threadId) ?? EMPTY_ASKS
            // Idempotent on replay: drop any existing ask with the same
            // tool_call_id before appending the fresh one.
            const deduped = prev.filter((a) => a.tool_call_id !== ask.tool_call_id)
            next.set(threadId, [...deduped, ask])
            return { pendingAsksByThread: next }
          }),
        removePendingAskForThread: (threadId, toolCallId) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.pendingAsksByThread)
            const prev = next.get(threadId) ?? EMPTY_ASKS
            next.set(
              threadId,
              prev.filter((a) => a.tool_call_id !== toolCallId),
            )
            return { pendingAsksByThread: next }
          }),
        replacePendingAsksForThread: (threadId, asks) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.pendingAsksByThread)
            next.set(threadId, asks)
            return { pendingAsksByThread: next }
          }),

        // --- tasks: keyed-by-`sub_run_id` upsert / status-update / full-replace ---
        setTaskForThread: (threadId, task) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.tasksByThread)
            const prev = next.get(threadId) ?? EMPTY_TASKS
            const idx = prev.findIndex((t) => t.sub_run_id === task.sub_run_id)
            const updated =
              idx === -1
                ? [...prev, task]
                : // Merge so an upsert from the SSE bookend doesn't clobber
                  // fields the GET reconcile already populated.
                  prev.map((t, i) => (i === idx ? { ...t, ...task } : t))
            next.set(threadId, updated)
            return { tasksByThread: next }
          }),
        updateTaskStatusForThread: (threadId, subRunId, status, summary) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.tasksByThread)
            const prev = next.get(threadId) ?? EMPTY_TASKS
            next.set(
              threadId,
              prev.map((t) =>
                t.sub_run_id === subRunId ? { ...t, status, summary } : t,
              ),
            )
            return { tasksByThread: next }
          }),
        replaceTasksForThread: (threadId, tasks) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.tasksByThread)
            next.set(threadId, tasks)
            return { tasksByThread: next }
          }),
        // --- Phase 092 (SC#3): per-thread workflow-lock mutators ---
        // Copy-then-mutate via the _setWorkflowLock / _clearWorkflowLock helpers
        // (new Map → set / GC delete-the-key). Keyed strictly by the passed
        // threadId — never a global flag.
        setWorkflowLockForThread: (threadId, lock) =>
          useStreamsStore.setState((s) => ({
            workflowLockByThread: _setWorkflowLock(s.workflowLockByThread, threadId, lock),
          })),
        clearWorkflowLockForThread: (threadId) =>
          useStreamsStore.setState((s) => ({
            workflowLockByThread: _clearWorkflowLock(s.workflowLockByThread, threadId),
          })),
        // --- Phase 094 (PANEL-08/09): panel-only phase-timeline mutators ---
        // Copy-then-mutate the phasesByThread Map (new Map → set), keyed strictly
        // by the passed (OWNING) threadId. NEVER touch bucketsBySurface — the
        // chat selector useThreadMessages reads bucketsBySurface only, so a phase
        // mutation re-renders the panel timeline but NOT the chat (PANEL-09).
        appendPhaseForThread: (threadId, phase) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.phasesByThread)
            const prev = next.get(threadId) ?? EMPTY_PHASES
            // Idempotent: a genuine re-emit of a phase whose REAL slug is already
            // present is a no-op (replay/reconnect safety).
            if (prev.some((p) => p.slug === phase.slug)) return {}
            // IN-02: the reconcile floor seeds positional placeholder rows
            // (slug === `phase-${i}`, phaseType "unknown") because the real slugs
            // aren't known ahead of phase_started. When a live phase_started
            // carries the REAL slug for an index that still holds its placeholder,
            // REPLACE the skeleton row in place (by phaseIndex) instead of
            // appending — otherwise the timeline shows both `phase-1` (pending) and
            // `research` (running) for the same index. Forward-only counting is
            // preserved (the placeholder was running/pending; the live row carries
            // the true status). Any other case appends as before.
            const placeholderIdx = prev.findIndex(
              (p) => p.phaseIndex === phase.phaseIndex && p.slug === `phase-${p.phaseIndex}`,
            )
            if (placeholderIdx !== -1) {
              next.set(
                threadId,
                prev.map((p, i) =>
                  i === placeholderIdx ? { ...p, ...phase } : p,
                ),
              )
              return { phasesByThread: next }
            }
            next.set(threadId, [...prev, phase])
            return { phasesByThread: next }
          }),
        setPhaseStatusForThread: (threadId, slug, status, patch) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.phasesByThread)
            const prev = next.get(threadId) ?? EMPTY_PHASES
            if (prev.length === 0) return {}
            // An empty slug is the "active phase" sentinel (onRunFailed): target
            // the phase that was live when the run died. Otherwise match by slug.
            let targetIdx = -1
            if (slug === "") {
              // IN-01: prefer a GENUINELY-ACTIVE row (running/retrying) — the phase
              // actually executing when the run died. A trailing `pending` skeleton
              // row (seeded positionally by the reconcile floor) must NOT be
              // preferentially marked failed when an earlier phase actually failed.
              for (let i = prev.length - 1; i >= 0; i--) {
                const st = prev[i].status
                if (st === "running" || st === "retrying") {
                  targetIdx = i
                  break
                }
              }
              // No active row → fall back to the last `pending` (a run that died
              // before its first phase went live), then to the last row, so a
              // failure is never silently dropped.
              if (targetIdx === -1) {
                for (let i = prev.length - 1; i >= 0; i--) {
                  if (prev[i].status === "pending") {
                    targetIdx = i
                    break
                  }
                }
              }
              if (targetIdx === -1) targetIdx = prev.length - 1
            } else {
              targetIdx = prev.findIndex((p) => p.slug === slug)
            }
            if (targetIdx === -1) return {}
            next.set(
              threadId,
              prev.map((p, i) => (i === targetIdx ? { ...p, ...patch, status } : p)),
            )
            return { phasesByThread: next }
          }),
        replacePhasesForThread: (threadId, phases) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.phasesByThread)
            next.set(threadId, phases)
            return { phasesByThread: next }
          }),
        // Phase 101.1-09 (gap 6 / GAP-C / D-11): patch a phase's emitSubStep/
        // emitFailure from a phase_substep event. ADDITIVE + PANEL-ONLY — copies
        // phasesByThread (new Map → set), merges the patch onto the matching row,
        // and writes phasesByThread EXCLUSIVELY (never bucketsBySurface), exactly
        // like setPhaseStatusForThread. Match by slug; fall back to phaseIndex when
        // the slug is the reconcile placeholder (`phase-${i}`) — the same draft→
        // real-slug race the 094 demux handles. PhaseCard (Plan 04) renders the
        // populated fields → the live emit sub-step rail.
        setPhaseEmitSubstepForThread: (threadId, slug, phaseIndex, patch) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.phasesByThread)
            const prev = next.get(threadId) ?? EMPTY_PHASES
            if (prev.length === 0) return {}
            let targetIdx = prev.findIndex((p) => p.slug === slug)
            if (targetIdx === -1) targetIdx = prev.findIndex((p) => p.phaseIndex === phaseIndex)
            if (targetIdx === -1) return {}
            next.set(
              threadId,
              prev.map((p, i) => (i === targetIdx ? { ...p, ...patch } : p)),
            )
            return { phasesByThread: next }
          }),
        // Phase 098-UAT run-honesty fix (A): on a SUCCESSFUL run completion, sweep
        // any lingering non-terminal phase to "done". A phase flips running→done
        // ONLY when its own phase_completed SSE is observed live; across the
        // ask_user pause / a consumer reattach phase-0's completed can be missed,
        // and nothing else corrects it in-session (onRunCompleted was a no-op; the
        // terminal reconcile floor returned []). Mirror the DB ground truth (every
        // phase of a completed run IS completed). NEVER touch a phase that
        // legitimately ended failed/skipped — those are terminal truths, not
        // stragglers. Closure threadId only (PANEL-09); phasesByThread only.
        finalizeAllPhasesForThread: (threadId) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.phasesByThread)
            const prev = next.get(threadId)
            if (!prev || prev.length === 0) return {}
            let changed = false
            const swept = prev.map((p) => {
              if (p.status === "running" || p.status === "retrying" || p.status === "pending") {
                changed = true
                return { ...p, status: "done" as const }
              }
              return p
            })
            if (!changed) return {}
            next.set(threadId, swept)
            return { phasesByThread: next }
          }),
        // BUG-260609-01 mid-run fix: flip EARLIER phases (phaseIndex < beforeIndex)
        // still in {running,retrying} → done when a later phase goes live. By-INDEX
        // (survives a placeholder-slug mismatch); never touches skipped/failed/pending
        // or the current/later phases, so a real skip/failure is never masked.
        finalizeEarlierPhasesForThread: (threadId, beforeIndex) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.phasesByThread)
            const prev = next.get(threadId)
            if (!prev || prev.length === 0) return {}
            let changed = false
            const swept = prev.map((p) => {
              if (
                p.phaseIndex < beforeIndex &&
                (p.status === "running" || p.status === "retrying")
              ) {
                changed = true
                return { ...p, status: "done" as const }
              }
              return p
            })
            if (!changed) return {}
            next.set(threadId, swept)
            return { phasesByThread: next }
          }),
      },
    })
    // Touch all refs to satisfy lint and document the closure (they're read
    // by the actions registered above and the listeners below).
    void subscriptionsRef
    void lastSeenOffsetRef
  }, [])

  // ---- useEffect #2: reconcile listeners (D-068-07 / D-068-08) ----
  useEffect(() => {
    const tryReconcile = () => {
      const tid = activeThreadIdRef.current
      if (!tid) return
      useStreamsStore
        .getState()
        .actions.reconcile(tid)
        .catch(console.error)
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") tryReconcile()
    }
    const onFocus = () => tryReconcile()
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) tryReconcile()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onFocus)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [])

  // ---- useEffect #2b (092-07 Facet C): Continue producer re-subscribe ----
  // The Continue affordance fires requestProducerResubscribe(threadId, producerId)
  // on a Harness /continue 200 (the backend minted a fresh producer runs row).
  // Point the per-thread lock at the fresh id AND re-subscribe its live stream
  // (per-thread keyed; idempotent — won't double-subscribe).
  useEffect(() => {
    const unsubscribe = subscribeProducerResubscribe(({ threadId, producerRunId }) => {
      const actions = useStreamsStore.getState().actions
      const existing = useStreamsStore.getState().workflowLockByThread.get(threadId)
      if (existing) {
        actions.setWorkflowLockForThread(threadId, {
          ...existing,
          runId: producerRunId,
        })
      }
      subscribeProducerStreamRef.current?.(threadId, producerRunId)
    })
    return unsubscribe
  }, [])

  // ---- useEffect #3: unmount cleanup (mirror of useMessages.ts:1209-1214) ----
  useEffect(() => {
    const subs = subscriptionsRef.current
    return () => {
      for (const ctrl of subs.values()) ctrl.abort()
      subs.clear()
    }
  }, [])

  // ---- useEffect #4: throttled write to localStorage on bucket change (Phase 068.5 D-068.5-03) ----
  // Pattern S3 (PATTERNS.md): attach-then-symmetric-cleanup. Mirrors useEffect #2/#3 shape.
  // L-068.5-03 hydrate-and-write share the bucketsBySurface shape verbatim.
  //
  // Phase 068.5 rescope (Option C, 2026-05-14): the keepPredicate scopes
  // persistence to (streaming + currently-viewing) threads. Completed background
  // threads load from DB + skeleton; their cache writes were wasted churn.
  useEffect(() => {
    const writeNow = (state: StreamsState) => {
      // SEED-055: persist EVERY currently-streaming thread (was the single
      // streamingThreadIdRef slot) plus the viewed thread, so concurrent background
      // streams are all cached.
      const streaming = state.streamingThreads
      const activeTid = activeThreadIdRef.current
      // If nothing is streaming and no thread is viewed (early-render), skip
      // persistence — nothing meaningful to cache yet. The hydrate path at mount
      // still works because it reads the existing snapshot before any write fires.
      if (streaming.size === 0 && !activeTid) return
      writeSnapshotToLocalStorage(
        state.bucketsBySurface,
        Date.now(),
        (_surface, tid) => streaming.has(tid) || tid === activeTid,
        state.todosByThread,
        state.tasksByThread,
      )
    }
    const throttledWrite = makeThrottle(writeNow, 500)
    throttledWriteRef.current = throttledWrite
    // B-02 fix: selector-bound subscription — only fires when one of the watched
    // references changes, NOT on every reconcileErrors / streamingThreads /
    // subscriptionsByThread / loadingThreads / viewedThreadId / fallbackNotices
    // setState. Avoids wasted serialization on bookkeeping state.
    // (Plan 075.4-01 D-075.4-A1: comment updated for per-thread field names.)
    // WR-04 fix (260529-0sc): the trigger set now includes todosByThread +
    // tasksByThread so panel-Map mutations also fire the throttled persist (the
    // write-path that hydrates readTodosSyncOrEmpty/readTasksSyncOrEmpty on F5).
    // PANEL-06 chat-isolation is unaffected: these Maps are part of the *write
    // trigger* only — the chat MessageList selectors still read bucketsBySurface
    // exclusively, and a panel-Map mutation never changes the chat bucket ref.
    // Requires `subscribeWithSelector` middleware in the store factory.
    const unsubscribe = useStreamsStore.subscribe(
      (state) =>
        [state.bucketsBySurface, state.todosByThread, state.tasksByThread] as const,
      () => {
        throttledWrite(useStreamsStore.getState())
      },
      { equalityFn: persistTriggerEqual },
    )
    return () => {
      throttledWrite.flush()
      unsubscribe()
      throttledWriteRef.current = null
    }
  }, [])

  return <>{children}</>
}

// =============================================================================
// Named hooks — D-068-02 / RESEARCH §Pattern 2 (atomic selectors only)
// External callers consume these; useStreamsStore is implementation detail.
// =============================================================================

export const useThreadMessages = (
  threadId: string | null,
  surfaceId: SurfaceId = "chat",
): Message[] =>
  useStreamsStore((state) =>
    threadId ? state.bucketsBySurface.get(surfaceId)?.get(threadId) ?? EMPTY_ARRAY : EMPTY_ARRAY,
  )

// ─────────────────────────────────────────────────────────────────────────────
// Phase 086 Plan 02 (D-086-02 / D-086-09 / D-086-10 / PANEL-05 / PANEL-06) —
// the 4 agent-panel hooks Phase 087 imports. Each is a thin wrapper: a null-safe
// store selector (returns the matching module-level EMPTY constant on a Map miss
// or null threadId, so `data` is NEVER undefined and the empty ref is stable for
// PANEL-06) + usePanelReconcile for the thread-switch reconcile / isLoading /
// composite-error plumbing. The raw useStreamsStore is NEVER exported (D-086-02):
// these named hooks are the only consumer surface.
//
// Return contract (D-086-10): { data: T[]; isLoading; error; reconcile }.
// ─────────────────────────────────────────────────────────────────────────────
export function useTodos(threadId: string | null): {
  data: Todo[]
  isLoading: boolean
  error: Error | null
  reconcile: () => Promise<void>
} {
  const data = useStreamsStore((s) =>
    threadId ? (s.todosByThread.get(threadId) ?? EMPTY_TODOS) : EMPTY_TODOS,
  )
  const replace = useStreamsStore((s) => s.actions.replaceTodosForThread)
  const { isLoading, error, reconcile } = usePanelReconcile<Todo>({
    threadId,
    hookId: "todos",
    fetcher: getThreadTodos,
    replace,
  })
  return { data, isLoading, error, reconcile }
}

// Phase 095.1 Plan 02 (D-095.1-01/02): the activity-derived workspace panel. A
// PURE read selector over the viewing thread's persisted chat tool_calls — it
// NEVER writes todosByThread (so the real write_todos precedence in TodosSection
// stays trivial) and NEVER mutates the chat bucket reference (PANEL-06 / FC#1).
// Reload-safe for free because tool_calls are DB truth reconstructed by
// _mapMessageResponse — the same derivation recomputes next-day.
//
// Implemented as OPTION (b) (RESEARCH Open-Q1 / A2): a panel-side read selector,
// NOT a cross-store write through replaceTodosForThread (option a). Chosen because
// writing derived items into the panel store from the chat path risks the PANEL-06
// isolation contract and muddies real-vs-derived precedence; a pure read keeps ONE
// clean precedence with zero cross-store write. Verified against FC#1.
//
// To avoid useSyncExternalStore churn (a selector returning a fresh array every
// render would re-run subscribers), the store selector returns the STABLE chat
// Message[] reference (changes only when the bucket changes), and the derivation
// is memoized over that ref — so the hook output identity is stable until the
// thread's tool activity actually changes.
export function useDerivedPanel(threadId: string | null): DerivedPanelItem[] {
  const messages = useStreamsStore((s) =>
    threadId ? (s.bucketsBySurface.get("chat")?.get(threadId) ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  )
  return useMemo(() => {
    if (!threadId) return EMPTY_DERIVED
    const allToolCalls = messages.flatMap((m) => m.tool_calls ?? [])
    if (!shouldPopulate(allToolCalls)) return EMPTY_DERIVED
    return deriveWorkspacePanel(allToolCalls)
  }, [threadId, messages])
}

export function useWorkspaceFiles(threadId: string | null): {
  data: WorkspaceFile[]
  isLoading: boolean
  error: Error | null
  reconcile: () => Promise<void>
} {
  const data = useStreamsStore((s) =>
    threadId ? (s.workspaceFilesByThread.get(threadId) ?? EMPTY_FILES) : EMPTY_FILES,
  )
  const replace = useStreamsStore((s) => s.actions.replaceWorkspaceFilesForThread)
  const { isLoading, error, reconcile } = usePanelReconcile<WorkspaceFile>({
    threadId,
    hookId: "files",
    fetcher: getThreadWorkspaceFiles,
    replace,
  })
  return { data, isLoading, error, reconcile }
}

// useAskUserPrompt surfaces a PendingAsk[] — parallel asks are possible
// (D-085-06), so reconcile REPLACES the inner Map atomically (D-086-08).
export function useAskUserPrompt(threadId: string | null): {
  data: PendingAsk[]
  isLoading: boolean
  error: Error | null
  reconcile: () => Promise<void>
} {
  const data = useStreamsStore((s) =>
    threadId ? (s.pendingAsksByThread.get(threadId) ?? EMPTY_ASKS) : EMPTY_ASKS,
  )
  const replace = useStreamsStore((s) => s.actions.replacePendingAsksForThread)
  const { isLoading, error, reconcile } = usePanelReconcile<PendingAsk>({
    threadId,
    hookId: "asks",
    fetcher: getThreadPendingAsks,
    replace,
  })
  return { data, isLoading, error, reconcile }
}

export function useTasks(threadId: string | null): {
  data: TaskRunIndexItem[]
  isLoading: boolean
  error: Error | null
  reconcile: () => Promise<void>
} {
  const data = useStreamsStore((s) =>
    threadId ? (s.tasksByThread.get(threadId) ?? EMPTY_TASKS) : EMPTY_TASKS,
  )
  const replace = useStreamsStore((s) => s.actions.replaceTasksForThread)
  const { isLoading, error, reconcile } = usePanelReconcile<TaskRunIndexItem>({
    threadId,
    hookId: "tasks",
    fetcher: getThreadTasks,
    replace,
  })
  return { data, isLoading, error, reconcile }
}

/**
 * Phase 094 Plan 02 (PANEL-08 / PANEL-09) — the panel-only harness phase
 * timeline hook. Mirrors useTasks: a thin null-safe phasesByThread selector +
 * usePanelReconcile for the mount reconcile floor.
 *
 * RECONCILE FLOOR (DATA-CONTRACT §3c / D-v2.5-03): the reconcile fetcher wraps
 * `getThreadWorkflow` (the authoritative ThreadWorkflowState — total_phases +
 * current_phase_index, the honest "Phase i / N" counter) and derives a Phase[]
 * SKELETON: total_phases rows, all pending, the current one running. On mount,
 * a reconnect mid-run shows "Phase 3 / 5, running" from durable DB state BEFORE
 * any live event arrives. LIVE events then advance phasesByThread forward; live
 * NEVER moves the counter backward (the reconcile is the floor). The fetcher is
 * a no-op (returns []) when the thread is Deep / has no run, so the skeleton
 * only appears for an actual harness run.
 */
// Phase 098-UAT run-honesty fix (B): map a DB-native workflow_phases.status to the
// Phase status union the PhaseCard renders verbatim (active→running, completed→done).
const DB_PHASE_STATUS: Record<string, Phase["status"]> = {
  pending: "pending",
  active: "running",
  completed: "done",
  failed: "failed",
  skipped: "skipped",
}

async function reconcilePhases(threadId: string, signal?: AbortSignal): Promise<Phase[]> {
  const wf = await getThreadWorkflow(threadId, signal)
  // Live/ACTIVE harness run → the existing forward-only skeleton floor (UNCHANGED):
  // total_phases rows, the current one running. Slugs are unknown ahead of live
  // phase_started (only current_phase_slug is known), so non-current rows carry
  // positional placeholder slugs the live events replace.
  if (wf.mode === "harness" && !wf.lock_is_stale) {
    const total = wf.total_phases ?? 0
    if (total <= 0) return []
    const current = wf.current_phase_index ?? 0
    return Array.from({ length: total }, (_, i): Phase => ({
      slug: i === current ? (wf.current_phase_slug ?? `phase-${i}`) : `phase-${i}`,
      phaseIndex: i,
      phaseType: "unknown",
      status: i < current ? "done" : i === current ? "running" : "pending",
      subAgents: [],
      pendingAsk: null,
    }))
  }
  // Phase 098-UAT run-honesty fix (B): NOT a live/active harness run. A COMPLETED
  // workflow run CLEARS the thread anchor (mode flips back to "deep"); a terminal
  // anchored run reports lock_is_stale. BOTH previously returned [] here and
  // BLANKED the timeline on revisit/reload of a finished workflow thread. When the
  // backend supplies the durable per-phase array (the thread has a workflow run in
  // its history), rebuild the HONEST historical timeline from it — real slugs +
  // statuses (active→running, completed→done); genuinely skipped/failed phases stay
  // honest, never masked as done. A pure-deep thread (never a workflow) carries
  // phases=null → [] (no timeline), unchanged.
  const rows = wf.phases ?? []
  if (rows.length === 0) return []
  return rows
    .slice()
    .sort((a, b) => a.phase_index - b.phase_index)
    .map((r): Phase => ({
      slug: r.slug,
      phaseIndex: r.phase_index,
      phaseType: "unknown",
      status: DB_PHASE_STATUS[r.status] ?? "done",
      subAgents: [],
      pendingAsk: null,
  }))
}

export function usePhases(threadId: string | null): {
  data: Phase[]
  isLoading: boolean
  error: Error | null
  reconcile: () => Promise<void>
} {
  const data = useStreamsStore((s) =>
    threadId ? (s.phasesByThread.get(threadId) ?? EMPTY_PHASES) : EMPTY_PHASES,
  )
  const replace = useStreamsStore((s) => s.actions.replacePhasesForThread)
  const { isLoading, error, reconcile } = usePanelReconcile<Phase>({
    threadId,
    hookId: "phases",
    // fetcher: getThreadWorkflow wrapped to derive the Phase[] reconcile floor.
    fetcher: reconcilePhases,
    replace,
  })
  return { data, isLoading, error, reconcile }
}

export const useViewingThread = (): string | null =>
  useStreamsStore((state) => state.viewedThreadId)

export const useStreamActions = (): StreamsState["actions"] =>
  useStreamsStore((state) => state.actions)

// Phase 068 Task 3: hoist isStreaming into Zustand state so chat UX
// (MessageInput disabled, MessageList scroll, MessageItem spinner) reads via
// this named hook. Plan 2 Task 3 audit confirmed live consumers across
// ChatArea/MessageList/MessageItem — Branch A (hoist) required.
//
// Plan 075.4-01 D-075.4-A1: back-compat any-thread-streaming check. New
// thread-scoped consumers should use `useStreamingForThread(threadId)` below;
// this hook is kept for legacy call sites that need "any stream alive."
export const useIsStreaming = (): boolean =>
  useStreamsStore((state) => state.streamingThreads.size > 0)

// useStreamSubscriptions reads from the per-thread `subscriptionsByThread`
// mirror — scans every thread's inner Set for the runId. Plan 075.4-01
// D-075.4-A1: this is O(threads) not O(1) but callers query a known runId
// rarely (per-message subscription gating), so the linear scan is acceptable.
export const useStreamSubscriptions = (runId: string): boolean =>
  useStreamsStore((state) => {
    for (const inner of state.subscriptionsByThread.values()) {
      if (inner.has(runId)) return true
    }
    return false
  })

// ─────────────────────────────────────────────────────────────────────────────
// Plan 075.4-01 D-075.4-A1 — thread-scoped selectors.
//
// Closes BUG-260523-01: consumers read per-thread state directly so Thread A
// streaming no longer gates Thread B's composer. Each selector returns null /
// false for `null` threadId so call sites can pass `thread?.id ?? null` without
// branching on the optional.
//
// Phase 082 (cross-cutting verification) inherits these as the canonical
// thread-scoped surface — additions go BELOW (alphabetical) so the existing
// 4 stay grep-stable.
// ─────────────────────────────────────────────────────────────────────────────
export const useStreamingForThread = (threadId: string | null): boolean =>
  useStreamsStore((s) => (threadId ? s.streamingThreads.has(threadId) : false))

// SEED-064 — cross-thread active-run surface (sidebar dots + active-runs tray).
//
// Returns the SET of thread ids with a live run. Selecting `streamingThreads`
// directly is reference-stable across token deltas (the Set is reassigned ONLY
// on stream start/stop — tokens never touch it), so consumers (NavPanel dots,
// the tray counter) re-render on start/stop, NOT on every streamed token.
export const useStreamingThreadIds = (): Set<string> =>
  useStreamsStore((s) => s.streamingThreads)

// Non-reactive read of a thread's live-run start epoch-ms (the streaming
// assistant message's startedAt, falling back to created_at). Read imperatively
// by the active-runs tray on its own 1s elapsed ticker so per-token bucket
// mutations never re-render anything. Returns null when nothing is streaming or
// the timestamp is unparseable.
export const getActiveRunStartMs = (threadId: string): number | null => {
  const bucket =
    useStreamsStore.getState().bucketsBySurface.get("chat")?.get(threadId) ?? []
  for (let i = bucket.length - 1; i >= 0; i--) {
    const m = bucket[i]
    if (m.role === "assistant" && m.runStatus === "streaming") {
      const raw = m.startedAt ?? m.created_at
      const t = raw ? Date.parse(raw) : NaN
      return Number.isNaN(t) ? null : t
    }
  }
  return null
}

export const useLoadingForThread = (threadId: string | null): boolean =>
  useStreamsStore((s) => (threadId ? s.loadingThreads.has(threadId) : false))

export const useReconcileErrorForThread = (threadId: string | null): Error | null =>
  useStreamsStore((s) => (threadId ? (s.reconcileErrors.get(threadId) ?? null) : null))

export const useFallbackNoticeForThread = (threadId: string | null): string | null =>
  useStreamsStore((s) => (threadId ? (s.fallbackNotices.get(threadId) ?? null) : null))

// 099-08 (UAT L10): per-thread stashed prompt from a send/kickoff refusal.
// ChatArea reads this keyed by the active thread and feeds it into the
// MessageInput prefill seam so the user's typed prompt is recoverable.
export const useFailedSendDraftForThread = (threadId: string | null): string | null =>
  useStreamsStore((s) => (threadId ? (s.failedSendDrafts.get(threadId) ?? null) : null))

// Phase 092 (MODE-01/02 — SC#3): the per-thread workflow-lock reader. Returns the
// lock record (or null) for the OWNING thread id. Every composer/selector
// `disabled` derivation MUST read this keyed by the thread the composer SENDS to
// (the owning thread, e.g. thread?.id), NEVER viewedThreadId or a global flag —
// a background workflow thread must not lock an unrelated thread's composer
// (useMessages.ts:80-86 lesson; the parallel-thread UAT is the binding gate).
// Copy-then-mutate keeps the per-key object reference stable, so Object.is
// equality re-renders only the threads whose lock actually changed.
export const useWorkflowLockForThread = (threadId: string | null): WorkflowLock | null =>
  useStreamsStore((s) => (threadId ? (s.workflowLockByThread.get(threadId) ?? null) : null))
