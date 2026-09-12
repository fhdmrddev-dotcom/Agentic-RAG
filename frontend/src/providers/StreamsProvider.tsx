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
  // Phase 188 Plan 04 (D-188-22) — one durable workflow_phases row, as the wire
  // sends it. The LIVE reconcile branch below joins these onto its positional
  // skeleton by `phase_index` to recover the REAL step identity.
  type WorkflowPhaseState,
} from "@/lib/api"
import { usePanelReconcile } from "@/hooks/usePanelReconcile"
// Phase 166 (D-166-07/08): the org-context bridge. OrgProvider mounts ABOVE this
// provider (App.tsx), so an org switch is observable here via the non-throwing
// useOrgOptional — StreamsProvider stays renderable outside an OrgProvider (tests,
// storybook) where it returns null and the teardown effect is inert.
import { useOrgOptional } from "@/providers/OrgProvider"
import {
  useStreamsStore,
  type SurfaceId,
  type StreamsState,
  type WorkflowLock,
} from "@/stores/streamsStore"
import { makeThrottle, makeAccumulatingCoalescer } from "@/lib/throttle"
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
// Phase 188 Plan 05 (SPEC Req 8 / D-188-02): the ONE phase-state derivation. The
// `DB_PHASE_STATUS` map used to be declared in this file; it now lives in `lib/` with
// the total function that owns its fallback, so the developer panel and the business
// canvas cannot drift. This file consumes the derivation and re-derives nothing.
import { phaseStatusFromDb } from "@/lib/phaseState"
// BUG-260626-01 (+ sibling): collapse same-runId temp/persisted twins at the
// bucket-read seam so useDerivedPanel's flat-map doesn't double-count a run.
import { dedupMessagesByRunId } from "@/lib/dedupMessages"
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

// ── Phase 145-05 (FND-01, D-145-03/04/05) — client inactivity watchdog ──────────
// ONE shared setInterval (~5s tick) sweeps the streamingThreads set; a per-thread
// inactivity window N (~20s) that RESETS on every stream event decides when to
// fire the READ-ONLY getSnapshot probe. The window is short/tunable because the
// watchdog only RECONCILES, never kills (D-145-05) — the authoritative kill of a
// dead producer is the backend stale-sweep (STALE_TIMEOUT=2400s), NOT this belt.
// A false fire during a legit silent-reasoning gap is one cheap read that returns
// "still streaming" → no-op (threat T-145-05-02: accept).
const WATCHDOG_TICK_MS = 5_000 // shared-interval tick cadence
const WATCHDOG_INACTIVITY_MS = 20_000 // per-thread N: quiet-for-this-long → probe

// Phase 194.1 Plan 03 (R2 / CONTEXT D-07) — the stop climb-down window. R2's
// acceptance is three points, not one: the reading is still "stopping" at 7s, it
// has climbed down by 8s, and it NEVER appears for a cancel that resolved at 2s.
// A single at-8s assertion passes a 1ms timeout, which is why all three are
// fenced. The timer is keyed BY THREAD (never by run), so a thread whose run id
// could not be resolved still climbs down.
const STOP_TIMEOUT_MS = 8000

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

/**
 * Phase 138-04 (RUN-01 live-surfacing) — reconcile the Workspace TODOS panel on
 * a genuinely-clean run terminal so the 138-02 backend-committed
 * "(run ended — not completed)" marker surfaces LIVE, with NO thread-switch and
 * NO refresh (VERIFICATION.md must-have #5 / Scenario B).
 *
 * The 138-02 finalizer writes the marker to the todos table BEFORE the clean
 * terminal sentinel fires (DB-verified twice via psycopg2), so a fetch-on-
 * terminal guarantees the marker appears live — robust regardless of whether the
 * finalize-time `todo_updated` SSE was delivered/applied. This is the project's
 * own architecture rule (CLAUDE.md D-v2.5-03): Realtime is a best-effort hint,
 * NOT a source of truth — always reconcile via fetch. The GET is the source of
 * truth, so we ALWAYS re-fetch on a clean terminal (never gated on whether the
 * local todos store is non-empty or the SSE landed).
 *
 * Mirrors the `onRunCompleted` fire-and-forget workspace-refetch analog
 * (~950 below): reuse the existing `getThreadTodos` GET + `replaceTodosForThread`
 * store action (NO new fetch machinery, NO new route/component/package — the
 * marker rides on `content`, D-01, so TodosSection is untouched). No
 * AbortController: the write is keyed by the captured owning `threadId`, so a
 * resolve that lands after a thread-switch updates its OWN thread's slot and
 * never corrupts the viewed thread (Pitfall 6).
 *
 * Clean-completion gate: only "done"/"reader_done" reconcile — this mirrors the
 * 138-02 two-clause finalizer gate (the marker is written ONLY on a genuinely-
 * clean completion; on cancelled/error/timed_out nothing changed on the backend,
 * so there is nothing to surface). Best-effort: the fetch+replace is wrapped so
 * the helper NEVER throws — a callers' fire-and-forget invocation cannot reject
 * into the byte-locked onTerminal handler.
 *
 * Exported for unit tests (mirrors `_isTransientStreamEnd` / `_reattachAfterTransient`
 * export-for-tests pattern; driven directly in StreamsProvider.test.tsx).
 */
export async function _reconcileTodosOnTerminal(
  threadId: string,
  kind: "done" | "error" | "cancelled" | "timed_out" | "reader_done",
): Promise<void> {
  // Clean-completion gate FIRST: on a non-clean terminal the backend wrote
  // nothing, so there is nothing to surface — no fetch, no store write.
  if (kind !== "done" && kind !== "reader_done") return
  try {
    // ALWAYS fetch on a clean terminal — the GET is the source of truth
    // (D-v2.5-03), never gated on the best-effort todo_updated SSE.
    const todos = await getThreadTodos(threadId)
    useStreamsStore.getState().actions.replaceTodosForThread(threadId, todos)
  } catch (err) {
    // Best-effort self-heal — a failed/slow refetch is non-fatal (the panel's
    // own thread-switch/mount reconcile remains the floor). Never throw into
    // the fire-and-forget terminal caller.
    console.error("Phase 138-04 todos terminal reconcile failed:", err)
  }
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
/**
 * Phase 243 Plan 03 (CHAT-02 / D-243-15) — how long the delta path may hold text before
 * it repaints. ⚠ PICKED DELIBERATELY, AND THE NUMBER IS THE DECISION.
 *
 * Measured premise: the backend emits ONE `delta` SSE event per provider chunk and does
 * NOT batch (`backend/app/services/agent_loop.py` — `_emit(redis, run_id, 'delta', ...)`,
 * no coalescing anywhere on that path), so the client sees the raw provider token
 * cadence. At a realistic 30-100 tok/s that is a delta every 10-33 ms, and every one of
 * them used to be one `setMessages` and therefore one run of `MessageList.tsx:141-176`.
 *
 * 60 ms is ~3.6 frames at 60 Hz: text still flows visibly, while the repaint rate stops
 * tracking the token rate (a 3-6x reduction across that band). It is deliberately NOT
 * the cache writer's 500 ms (`makeThrottle(writeNow, 500)`, `:3525`) — half a second of
 * nothing before a reply starts is a pause the reader can feel.
 *
 * ⚠ The first delta is NOT delayed at all: the coalescer has a leading edge, so the
 * worst-case first-paint cost is 0 ms and the worst case for any LATER delta is 60 ms.
 * Fenced by `streamsProvider_243_cadence.test.tsx` §6, and this constant is pinned by §8.
 */
export const DELTA_COALESCE_MS = 60

export function makeStreamCallbacks(opts: {
  assistantId: string
  threadId: string
  // Title cross-wiring fix (parallel chats): the consumer receives the run's
  // OWNING threadId so the title lands on the right chat even under concurrent
  // runs / fast nav. makeStreamCallbacks injects it (the wire StreamCallbacks
  // below still receives title-only).
  onTitleUpdate?: (threadId: string, title: string) => void
  setMessages: ThreadBoundSetMessages
}): StreamCallbacks & { flushDeltas: () => void } {
  const { assistantId, threadId, onTitleUpdate, setMessages } = opts
  // D-067-03: closure-tracked iteration counter, stamped onto each ToolCall
  // created in onToolPreparing/onToolStart. Updated on every iteration_start
  // SSE event BEFORE setMessages.
  let currentIteration = 0

  // -- Phase 243 Plan 03 (CHAT-02 / D-243-15) - the coalesced delta path --------------
  //
  // ⛔ PRODUCER-SIDE, AND THE REASON IS D-243-04 RATHER THAN HABIT. `MessageList.tsx`'s
  // one effect (`:141-176`) has `messages` in its dep array, so it re-runs on EVERY
  // `setMessages` and, while streaming and pinned, scrolls. The repaint cadence and the
  // scroll behaviour are therefore the same line of code, and only reducing how often
  // `setMessages` fires reduces how often that effect runs. A consumer-side
  // `useDeferredValue` in `ThinkingBlock` would coalesce the FOLD's repaint and leave
  // the scroll effect running per token - CHAT-02 closed and CHAT-03 untouched, which is
  // precisely the "fixed one and re-broke the other" failure the ROADMAP names.
  //
  // ⛔ THE BUFFER LIVES HERE, BESIDE `currentIteration`, AND NOT IN THE COALESCER'S
  // ARGUMENTS. `makeThrottle` is last-write-wins (`lib/throttle.ts:19,28`) and the
  // accumulation used to live inside the updater (`m.content + delta`), so wrapping
  // these callbacks in it would silently DROP TOKENS while every cadence measurement
  // still looked right. `makeAccumulatingCoalescer` takes no arguments at all for that
  // reason; there is nothing for a window to discard. Fenced by
  // `streamsProvider_243_cadence.test.tsx` §2 / §3.
  //
  // ⛔ THE UPDATE SHAPE IS UNCHANGED. Still one `prev.map` returning a NEW array with a
  // NEW object for the target row - `MessageItem.tsx:213-219` records that the `memo`
  // contract depends on replace-not-push identity. Coalescing the CADENCE is in scope;
  // mutating in place is D-243-08's red line.
  let pendingContent = ""
  let pendingReasoning = ""
  let sawContentDelta = false

  // -- Phase 243 Plan 04 (D-243-13) - the MEASURED reasoning span -----------------------
  //
  // ⛔ THE SKETCH COMPUTES THIS NUMBER FROM THE CHARACTER COUNT AND THAT IS A DEMO
  // AFFORDANCE, NOT A DESIGN DECISION. Porting it would ship a duration derived from string
  // length - the same sin as the `count` `FoldTrigger` already forbids for reasoning
  // ("no countable unit ... inventing one would be fabricated precision"), one unit over.
  //
  // ⛔ AND THERE IS NO PERSISTED SOURCE TO SWAP IN. `messages.reasoning_content` is the only
  // reasoning column - no started/completed timestamps exist anywhere in the model - and
  // `RunCard`'s elapsed machinery measures the WHOLE RUN, every tool call included, which is
  // wrong by construction for "thought for" on any tool-bearing turn. So it is measured HERE,
  // live, and when it is not known the label simply carries no number (`RunCard.tsx:181-186`'s
  // honesty rule). ⛔ No migration: this value is client-only and a reloaded message has none.
  //
  // ⛔ THE START IS STAMPED IN THE RAW CALLBACK, ABOVE THE COALESCER. Reading it inside
  // `applyPendingDeltas` would date the span from the WINDOW that flushed the first delta
  // rather than from the delta itself - late by up to `DELTA_COALESCE_MS`, and wrong in a way
  // no later measurement could recover.
  //
  // ⛔ NO TIMER, NO TICK. The label is a SETTLED value, written when a burst closes. A
  // live-ticking span would re-introduce exactly the per-token repaint CHAT-02 just removed.
  //
  // ⚠⚠ AMENDED BY 243-06 (review finding HI-1), AND THE ORIGINAL FORM IS DESCRIBED HERE
  // RATHER THAN SILENTLY REPLACED, because it shipped and a later reader must see the trade.
  // 243-04 measured `Date.now() - reasoningStartMs` at the first CONTENT delta. Nothing
  // closed the span at a tool boundary, and `agent_loop.py:2078-2100` emits `reasoning_delta`
  // then `tool_preparing` with NO content delta required between them — the ordinary shape for
  // a reasoning model that thinks and then calls a tool with no preamble. DRIVEN
  // (`§10g`): 100 ms of reasoning either side of a 40 s tool reported **40100**, and the fold
  // read "Thought for 40 seconds". ⛔ That is precisely what D-243-13 forbids — it rejects
  // `RunCard`'s whole-run elapsed BECAUSE it "includes every tool call" — reproduced through a
  // different variable, and it passed every honesty fence because the number really was a
  // clock reading. A clock reading of the wrong interval is still a fabrication.
  //
  // ⭐ SO THE INTERVAL IS THE REASONING STREAM ITSELF: `reasoningLastMs - reasoningStartMs`,
  // and ONLY a reasoning delta moves either end. No interleaving of any kind — tool, sub-agent,
  // code output, approval wait, ask_user — can inflate a burst, because none of them is a
  // reasoning delta. That is strictly stronger than the alternative the review offered (close
  // the span at `onToolPreparing` / `onToolStart`), which still bills the argument-streaming
  // window and is defeated by any future long-running callback nobody remembered to hook.
  //
  // ⛔ AND A BURST IS BOUNDED BY ANY STREAM EVENT THAT IS NOT A REASONING DELTA — stated ONCE,
  // in the negative, in the generic wrapper below, for the same reason the buffer drain is
  // (`:1339`): 47 callbacks and a 48th arriving from a phase that never read this comment.
  // ⚠ THE FAILURE DIRECTION OF THAT RULE IS DELIBERATE. If some event ever does interleave
  // inside a real reasoning stream, every burst becomes one delta and the label loses its
  // number — it can never GAIN a wrong one. Absence is D-243-13's own fallback.
  //
  // ⭐ AND THE VALUE IS A TOTAL, NOT A FIRST BURST (243-06's stated semantics decision).
  // A reasoning model that calls tools thinks ONCE PER ITERATION, so multi-burst is the
  // ordinary shape for exactly the models this label is for, and the fold at rest shows EVERY
  // burst's text. A number measuring only the first burst would under-report the body sitting
  // next to it. Each burst closes and ADDS; the tool time between bursts is excluded by
  // construction rather than by a hook. Driven by §10h: 5 s + 40 s tool + 10 s ⇒ 15 s.
  //
  // ⛔ AND A ZERO-LENGTH BURST WRITES NOTHING. One reasoning delta is a single OBSERVATION,
  // not an interval — we saw the stream at one instant and know nothing about its duration,
  // and the silence after it belongs to whatever came next. D-243-13 point 2 is the answer:
  // when it is not honestly known, show NO duration. Fenced by §10i.
  let reasoningStartMs: number | null = null
  let reasoningLastMs = 0
  let reasoningTotalMs = 0
  let pendingReasoningMs: number | undefined

  /** Close the OPEN burst and add it to the running total. Idempotent — after a close there is
   *  no open burst, so a second call does nothing until the next reasoning delta opens one. */
  const closeReasoningSpan = () => {
    if (reasoningStartMs === null) return
    const burstMs = reasoningLastMs - reasoningStartMs
    reasoningStartMs = null
    if (burstMs <= 0) return
    reasoningTotalMs += burstMs
    pendingReasoningMs = reasoningTotalMs
  }

  const applyPendingDeltas = () => {
    const content = pendingContent
    const reasoning = pendingReasoning
    // The measured span rides the SAME update rather than adding a `setMessages` of its own -
    // it is written at most once per run, at a moment when a flush is already happening.
    const spanMs = pendingReasoningMs
    if (!content && !reasoning && spanMs === undefined) return
    pendingContent = ""
    pendingReasoning = ""
    pendingReasoningMs = undefined
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? {
              ...m,
              // `isPlanning` clears only on CONTENT - reasoning is not an answer.
              ...(content ? { isPlanning: false, content: m.content + content } : {}),
              ...(reasoning ? { reasoningContent: (m.reasoningContent ?? "") + reasoning } : {}),
              ...(spanMs !== undefined ? { reasoningMs: spanMs } : {}),
            }
          : m,
      ),
    )
  }

  const coalesceDeltas = makeAccumulatingCoalescer(applyPendingDeltas, DELTA_COALESCE_MS)

  const raw: StreamCallbacks & { flushDeltas: () => void } = {
    onDelta: (delta) => {
      // D-243-13: reasoning ENDS when the answer begins. Taken here, in the RAW callback, at
      // the moment the content delta actually arrived.
      // ⚠ 243-06 (HI-1): on EVERY content delta, not only the first. A later iteration can
      // open a second burst, and the answer beginning again closes it — the guard used to be
      // `if (!sawContentDelta)` and would have left that burst open until the terminal.
      closeReasoningSpan()
      pendingContent += delta
      coalesceDeltas()
      if (!sawContentDelta) {
        // ⚠ The planning -> answering transition is a STATE CHANGE, not a token, and
        // it must paint at once or the working badge lingers for up to a window. If no
        // window was open the call above already fired on the leading edge and this
        // flush is a no-op; if reasoning had opened one, this drains it NOW. Either way
        // it costs at most one extra `setMessages` per run, exactly once.
        sawContentDelta = true
        coalesceDeltas.flush()
      }
    },
    // Phase 076.2 D-01: accumulate DeepSeek reasoning_content deltas on message.
    // Same accumulation pattern as onDelta for content - now through the same buffer,
    // so interleaved content and reasoning land in ONE `setMessages` rather than two.
    onReasoningDelta: (delta) => {
      // D-243-13: the START, on the first reasoning delta of a BURST and nowhere else — and
      // the END, moved forward by every delta of that burst (243-06 / HI-1). These two are the
      // only writes to either end of the interval, which is what makes the measurement
      // un-inflatable by anything that is not reasoning.
      const now = Date.now()
      if (reasoningStartMs === null) reasoningStartMs = now
      reasoningLastMs = now
      pendingReasoning += delta
      coalesceDeltas()
    },
    onDone: () => {
      // D-243-13: reasoning that never yielded a content delta still ENDS - here.
      closeReasoningSpan()
      // ⛔ FLUSH FIRST. Anything still buffered belongs to this run and must land before
      // the terminal bookkeeping, or a snapshot is taken over a half-applied buffer.
      coalesceDeltas.flush()
      // ⚠ `flush()` applies only when a window was OPEN (`throttle.ts` - it returns early
      // with nothing pending), so a span closed on a quiet terminal edge would otherwise never
      // land. It rides the bookkeeping update that always runs instead.
      const spanMs = pendingReasoningMs
      pendingReasoningMs = undefined
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, isPlanning: false, ...(spanMs !== undefined ? { reasoningMs: spanMs } : {}) }
            : m,
        ),
      )
    },
    onTerminal: () => {
      // Default no-op — caller wraps to flip runStatus and handle buffer_expired.
      // ⚠ Phase 243: the flush is ALSO here, as the backstop for a terminal that arrives
      // without a `done` (error / abort). The three call sites flush at the TOP of their
      // wrapper as well, because each wrapper runs a body BEFORE it calls this one and
      // some of those bodies reconcile the message from the server - a flush that landed
      // afterwards would append the buffered tail onto replaced content.
      coalesceDeltas.flush()
    },
    /**
     * Phase 243 Plan 03 (CHAT-02) - drain the coalesced delta buffer NOW.
     *
     * Exposed because all three `onTerminal` call sites REPLACE `callbacks.onTerminal`
     * with a wrapper that calls the original LAST (`:1551`, `:1999`, `:2473`). The
     * buffer has to be drained before those wrapper bodies run, not after.
     */
    flushDeltas: () => coalesceDeltas.flush(),
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
    // Phase 149 Plan 09 (D-149-10): stamp the honest disabled-model fallback notice on the
    // streaming assistant message ONLY (id === assistantId), mirroring onSkillActivated. The
    // backend `message` already names BOTH models; MessageItem renders it inline. Pre-fix this
    // event had no consumer → the user saw a silent model swap (the UAT Test-7 root cause).
    onModelDisabledFallback: (disabledModel, fallbackModel, message) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id !== assistantId
            ? m
            : { ...m, modelFallbackNotice: { disabledModel, fallbackModel, message } },
        ),
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
    onCodeExecuting: (toolIndex: number, elapsedSeconds: number, phase?: string) => {
      void toolIndex
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const updated = (m.tool_calls ?? []).map((tc) =>
            tc.name === "execute_code" && tc.status === "running"
              ? { ...tc, elapsedSeconds, ...(phase ? { codePhase: phase } : {}) }
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
      healed?: { stdout: string; stderr: string },
    ) => {
      // WR-02 (176): a healed re-run streams NO code_stdout/code_stderr deltas, so the
      // live outputLines still hold the FIRST run's pre-heal error text (e.g. a
      // ModuleNotFoundError). When the completion carries the healed run of record,
      // REPLACE outputLines with it — split into per-line entries to match the
      // streamed/reload-reconstruct shape — so the card never shows stale error text
      // under a success badge. Guarded on `healed` → the normal path leaves
      // outputLines untouched (byte-identical, G-5 shared render path intact).
      const healedLines: { kind: "stdout" | "stderr"; content: string }[] | undefined = healed
        ? [
            ...(healed.stdout || "").split("\n").filter(Boolean).map((content) => ({ kind: "stdout" as const, content })),
            ...(healed.stderr || "").split("\n").filter(Boolean).map((content) => ({ kind: "stderr" as const, content })),
          ]
        : undefined
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const updated = (m.tool_calls ?? []).map((tc) =>
            tc.name === "execute_code" && tc.status === "running"
              ? {
                  ...tc,
                  exitCode,
                  executionDurationMs: durationMs,
                  outputFiles,
                  errorMessage: error,
                  ...(healedLines !== undefined ? { outputLines: healedLines } : {}),
                }
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
    onToolApprovalRequired: (approval) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const existingCalls = m.tool_calls ?? []
          const toolFullName = `${approval.serviceId}__${approval.toolName}`
          const matchingIdx = existingCalls.findIndex(
            (tc) => tc.name === toolFullName || tc.name === approval.toolName,
          )
          const approvalCall: ToolCall = {
            id: approval.callId,
            name: toolFullName,
            args: approval.args,
            status: "interrupted",
            sub_agent: undefined,
          }
          const updatedCalls =
            matchingIdx >= 0
              ? existingCalls.map((tc, i) => (i === matchingIdx ? { ...tc, ...approvalCall } : tc))
              : [...existingCalls, approvalCall]
          return {
            ...m,
            tool_calls: updatedCalls,
            toolApproval: approval,
          }
        }),
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
        .actions.updateTaskStatusForThread(threadId, subRunId, status, summary ?? ""),
    // Phase 092 (CONT-01 / D-07 — SC#3): live cap_paused SSE → set the OWNING
    // thread's lock to capPaused so the inline Continue card appears out-of-band
    // (the durable carrier row is filtered from /messages — BUG-260528-01).
    // Closes over the factory's `threadId` (the owning thread), so a background
    // thread's cap_paused never touches the viewed thread's lock.
    // ── Phase 244-13 (UAT gap G-1 / review WR-07) — WRITE SITE 1 of 6, and the ONLY
    //    one with no answer on the wire. The `cap_paused` SSE carries `runId` +
    //    `continuesRemaining` and NOTHING about mode, so this value is an INFERENCE
    //    with a reason rather than a fact off the wire: INHERIT whatever this thread's
    //    lock already says, and default to `"cap_paused"`.
    //    ⛔ Do NOT hard-code `"harness"` here (it did until 2026-09-12): a DEEP run
    //    that hits its iteration cap mid-stream arrives through THIS callback, and the
    //    old value made it read as a live workflow — the phantom run line G-1 measured,
    //    by its live route rather than by the reconcile.
    //    ⚠ The inference is exactly as strong as the two writes that could have put a
    //    harness lock on this thread: the kickoff seed (`:2539`) and the reconcile
    //    (`:2343`). Both are harness-only, so an existing `"harness"` is evidence.
    //    ⛔ And it is the reachable half of WR-07: keeping `"harness"` here is what stops
    //    a harness run that caps from UNLOCKING the composer mid-run (`ChatArea.tsx:140`).
    onCapPaused: (info) =>
      useStreamsStore.getState().actions.setWorkflowLockForThread(threadId, {
        runId: info.runId,
        mode:
          useStreamsStore.getState().workflowLockByThread.get(threadId)?.mode === "harness"
            ? "harness"
            : "cap_paused",
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
    // 101.1 review WR-01: an honest emit failure terminalizes its phase as FAILED
    // (the engine no longer emits phase_completed for it). Flip the card to failed
    // so the sweeps (finalizeEarlierPhasesForThread / finalizeAllPhasesForThread) —
    // which skip terminal statuses — never repaint a "✓ Complete" pill over the
    // emitFailure alert. Closure threadId (PANEL-09); phasesByThread only.
    onPhaseFailed: (phase, _phaseIndex, failure) =>
      useStreamsStore
        .getState()
        .actions.setPhaseStatusForThread(threadId, phase, "failed", { error: failure }),
    // 189 review CR-02: a governed external-action phase RECORDED its intent and sent
    // nothing. Flip the card to its OWN terminal, for the same reason onPhaseFailed
    // above does: both sweeps (finalizeEarlierPhasesForThread from the NEXT phase's
    // onPhaseStarted, finalizeAllPhasesForThread from onRunCompleted) act on exactly
    // {running, retrying} and skip every terminal — so leaving this card `running` was
    // not "unresolved until reconcile", it was "✓ Complete within milliseconds", mid-run,
    // for any step that is not the last. `"recorded-not-sent"` is an existing
    // Phase["status"] member with its STATUS_META row ("↛ Not sent"), its canvasReading
    // arm ("Not sent — recorded") and its milestoneFor sentence already shipped; this
    // handler is the only thing that was missing between the DB truth and the live view.
    // Closure threadId (PANEL-09); phasesByThread only.
    onPhaseRecordedNotSent: (phase) =>
      useStreamsStore
        .getState()
        .actions.setPhaseStatusForThread(threadId, phase, "recorded-not-sent"),
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
        // 244-08: the SECOND filler of this slice, and it must ask for the same rows as the
        // first. A self-heal that fetched the GATED listing would quietly drop every expired
        // attachment from the transcript on the next harness completion — the defect
        // T-244-05-05 names, re-entering by a path nobody was looking at.
        getThreadWorkspaceFiles(threadId, undefined, { includeExpired: true })
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

  // ⛔ EVERY STRUCTURAL EVENT DRAINS THE TEXT BUFFER FIRST, AND THIS IS A CORRECTNESS
  // REQUIREMENT RATHER THAN TIDINESS — it was found by a DRIVEN RED, not by reading.
  //
  // Anthropic's normalized stream INTERLEAVES text and tool_use blocks
  // (`StreamsProvider.anthropic-ordering.test.ts`, B-260519-01):
  //   delta(text1) -> tool_use(0) -> delta(text2) -> tool_use(1) -> delta(text3)
  // With the deltas coalesced, `text3` can still be sitting in the buffer when the tool
  // block that FOLLOWS it is written — so the transcript would show a tool card above
  // text the reader has not been shown yet, and a run that ends on a tool event would
  // drop its tail entirely. Measured: without this, those two ordering cases fail with
  // `expected 'text1text2' to be 'text1text2text3'`.
  //
  // ⚠ WRAPPED GENERICALLY RATHER THAN CALLBACK BY CALLBACK, and that is the decision.
  // This factory returns 47 callbacks; an explicit flush in each is both invasive and
  // forgettable, and the 48th — added by a phase that never read this comment — would
  // silently re-open the defect. The rule is stated ONCE, and it is the negative form:
  // the ONLY things that do not flush are the two callbacks that FILL the buffer.
  // ⚠ 243-06 (HI-1) — THE SAME NEGATIVE RULE NOW CARRIES A SECOND OBLIGATION, and it is
  // deliberately stated in the SAME place rather than in a second list that could drift from
  // this one: a structural event also CLOSES the open reasoning burst (see the span block at
  // `:466`). `onDelta` is excluded here and closes the burst itself; `onReasoningDelta` is what
  // opens and extends one; `flushDeltas` is a drain, not an event.
  const FILLS_THE_BUFFER = new Set(["onDelta", "onReasoningDelta", "flushDeltas"])
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) =>
      typeof value !== "function" || FILLS_THE_BUFFER.has(key)
        ? [key, value]
        : [
            key,
            (...args: unknown[]) => {
              closeReasoningSpan()
              coalesceDeltas.flush()
              return (value as (...a: unknown[]) => unknown)(...args)
            },
          ],
    ),
    // One cast, at one place: the mapping preserves every key and every arity, and
    // `Object.fromEntries` cannot express that in the type system.
  ) as StreamCallbacks & { flushDeltas: () => void }
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
  // Phase 176-04 (RENDER-03 / D-10.1): a SIBLING to sendingThreadsRef marking threads
  // whose send is INTENDED but not yet dispatched. ChatArea pre-marks a fresh thread
  // here (via markThreadPendingSend) BEFORE setViewingThread fires its reconcile, so
  // the preserve-guard (sendInFlightOnThisThread) preserves the optimistic temp across
  // that nav reconcile even in the window before sendMessage adds to sendingThreadsRef.
  // CRITICAL: this ref is intentionally NOT checked by sendMessage's duplicate-guard
  // (:1807 checks ONLY sendingThreadsRef), so the pending flag does not false-early-
  // return the real send. Cleared in lockstep with sendingThreadsRef (the send finally
  // + the non-dispatch early-return).
  const pendingSendThreadsRef = useRef<Set<string>>(new Set())
  // Phase 145-05 (D-145-05): per-thread last-stream-event epoch-ms. Stamped on
  // every streamingThreads add (send / reattach / reconcile-derive) and reset on
  // each stream event (onCursor); read by the inactivity watchdog (useEffect #3)
  // to decide when a quiet run warrants a read-only getSnapshot probe. An absent
  // entry reads as "immediately stale" (probe on the next tick) — safe, because
  // the probe is read-only and no-ops when the run is still streaming.
  const lastEventAtRef = useRef<Map<string, number>>(new Map())
  // Phase 194.1 Plan 03 (R2 / D-05 / D-07): per-thread `window.setTimeout` handles
  // for the stop climb-down. THE HANDLE LIVES HERE AND NOT IN THE STORE, per
  // `streamsStore.ts:22-27` — a timer handle is a non-serializable handle exactly
  // like an AbortController, and the shipped pattern is `subscriptionsRef` (:1178)
  // ↔ `subscriptionsByThread`. The pure-data mirrors are `stoppingThreads` /
  // `stopNotConfirmed`. Provider-scoped, so it OUTLIVES every mount: `App.tsx:253-313`
  // wraps <StreamsProvider> above the page switch, which is D-06's argument made
  // structural — navigating away mid-stop cannot restore a pressable Stop.
  const stopTimersRef = useRef<Map<string, number>>(new Map())
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

  // ── Phase 194.1 Plan 03 (R1 + R2 — D-05 / D-06 / D-07) — the two stop helpers ──
  //
  // `stopStream` and `stopThread` are DECLARED byte-mirror resolvers (:2387-2389
  // says so on purpose). Both call the SAME two functions below so they cannot
  // drift — the press-record and the climb-down are one mechanism with two
  // entrances, which is Phase 194 D-08 (*four mounts, ONE mechanism*) made
  // structural rather than a matter of discipline.
  //
  // Both close over refs only, so the mount-time instance captured by useEffect #1
  // stays correct for the provider's whole life.

  /** R2's climb-down. Fires ONCE, `STOP_TIMEOUT_MS` after the FIRST press.
   *
   *  ⚠ D-07: keyed BY THREAD, never by run. A Stop whose run id could not be
   *  resolved at all — the R6 no-id arm, a thread never opened this session —
   *  must still climb down, and a run-keyed timer has nothing to key on there.
   *
   *  This is the ONLY route back to a pressable Stop. Sketch 168-B's losing arm
   *  ("no disabled button, because no button") is load-bearing, not a nicety: with
   *  the control REMOVED while stopping, a stop that never resolves would strand
   *  the user with no control at all if this did not fire. */
  const disarmStopTimer = (threadId: string) => {
    const handle = stopTimersRef.current.get(threadId)
    if (handle !== undefined) window.clearTimeout(handle)
    stopTimersRef.current.delete(threadId)
  }

  const stopWindowExpired = (threadId: string) => {
    disarmStopTimer(threadId)
    useStreamsStore.setState((s) => {
      const stopping = new Set(s.stoppingThreads)
      stopping.delete(threadId)
      const unconfirmed = new Set(s.stopNotConfirmed)
      unconfirmed.add(threadId)
      return { stoppingThreads: stopping, stopNotConfirmed: unconfirmed }
    })
  }

  /** R1's press-record. SYNCHRONOUS and unconditional — it runs before the bucket
   *  scan, before the frame read, before any await. A press acknowledged one
   *  microtask later is still a press acknowledged after the user stopped looking,
   *  and R6's frame read makes the "later" a whole round trip. That is the whole
   *  reason R1 and R6 belong in ONE provider change.
   *
   *  ⚠ A SECOND PRESS DOES NOT RE-ARM. The existing handle is left alone, so the
   *  window is measured from the FIRST press — otherwise a user who pressed twice
   *  would wait LONGER for the truth than one who pressed once. */
  const recordStopPress = (threadId: string) => {
    useStreamsStore.setState((s) => {
      const stopping = new Set(s.stoppingThreads)
      stopping.add(threadId)
      const unconfirmed = new Set(s.stopNotConfirmed)
      unconfirmed.delete(threadId)
      return { stoppingThreads: stopping, stopNotConfirmed: unconfirmed }
    })
    if (stopTimersRef.current.has(threadId)) return
    stopTimersRef.current.set(
      threadId,
      window.setTimeout(() => stopWindowExpired(threadId), STOP_TIMEOUT_MS),
    )
  }

  /** Clear the whole stopping slice for one thread, and DISARM its timer.
   *
   *  ⚠ The `clearTimeout` is the half that is easy to omit and impossible to see
   *  omitted: without it, a run that terminated at t+2s still raises "not
   *  confirmed" at t+8s — i.e. the surface would report an unconfirmed stop about
   *  a stop that WAS confirmed. That is a NEW lie, in the one phase whose subject
   *  is an honest Stop, and it is fenced by the t+2000 case in
   *  `StreamsProvider.stopping.test.ts`. */
  const clearStopStateForThread = (threadId: string) => {
    disarmStopTimer(threadId)
    useStreamsStore.setState((s) => {
      if (
        !s.stoppingThreads.has(threadId) &&
        !s.stopNotConfirmed.has(threadId) &&
        !s.harnessKickoffThreads.has(threadId)
      ) {
        return {}
      }
      const stopping = new Set(s.stoppingThreads)
      stopping.delete(threadId)
      const unconfirmed = new Set(s.stopNotConfirmed)
      unconfirmed.delete(threadId)
      const kickoff = new Set(s.harnessKickoffThreads)
      kickoff.delete(threadId)
      return {
        stoppingThreads: stopping,
        stopNotConfirmed: unconfirmed,
        harnessKickoffThreads: kickoff,
      }
    })
  }

  // ── Phase 194.1 Plan 03 (R6 — CONTEXT D-09b / D-12 / D-14) — ONE run-id resolver ──
  //
  // The live message bucket FIRST, the thread's workflow frame as a FALLBACK ONLY.
  //
  // ⚠ DO NOT REVERSE THE ORDER. The bucket path yields the PRODUCER `runs.run_id`;
  // the frame path yields a `workflow_runs.id`, which `DELETE /runs/{id}` accepts
  // only via `194-11`'s slower Step-1b dual-id fallback. Reversing them would
  // change the id type on EVERY Deep stop — a needless behaviour change on a
  // surface this phase has no business on. Both are bare uuids, so a swap
  // typechecks and then resolves nothing, and `api.ts::cancelRun` deliberately
  // SWALLOWS 404: the failure would be a silent success.
  //
  // ⚠ D-12 — REJECTED ALTERNATIVE, recorded here so it is not re-proposed as a
  // "cheaper" fix: a store field stamped at kickoff to serve R6. It is a LIVE-ONLY
  // reading of a DURABLE fact, and a live-only reading is precisely why
  // `BUG-260610-01` is two months old (174 D1). Two sources of truth for one fact
  // is the defect, not the fix. `GET /threads/{id}/workflow` is the durable one:
  // owner-scoped (ownership-gated 404), ungated (`threads.py:1036` — NOT on the
  // canvas-gated `workflow_runs` router), and it already resolves anchor-then-latest
  // via `last_workflow_run_id`, which SURVIVES the anchor NULL that `finish_run`
  // writes in the same transaction as the terminal status.
  //
  // ⚠ D-14 is satisfied BY CONSTRUCTION rather than by sequencing luck: this
  // fallback and R5's kickoff gate land in the SAME plan, so `stopThread` never
  // spends a moment with no run-id source at all.
  const resolveStopRunId = async (threadId: string): Promise<string | undefined> => {
    const bucket = useStreamsStore.getState().bucketsBySurface.get("chat")?.get(threadId) ?? []
    const streamingMsg = [...bucket]
      .reverse()
      .find((m) => m.role === "assistant" && m.runStatus === "streaming")
    if (streamingMsg?.runId) return streamingMsg.runId
    try {
      const frame = await getThreadWorkflow(threadId)
      return frame.active_workflow_run_id ?? frame.last_workflow_run_id ?? undefined
    } catch (err) {
      // A failed frame read falls THROUGH to the no-id arm; it must never throw
      // out of a click handler. Only the error's CLASS is logged — never its
      // message, which could carry a URL or a server body (T-194.1-03-01).
      console.warn(
        "Stop: the thread's workflow frame could not be read for thread",
        threadId,
        "— error class:",
        err instanceof Error ? err.name : "unknown",
      )
      return undefined
    }
  }

  /** The honest no-id arm, shared by both resolvers.
   *
   *  ⚠ IT CLAIMS ONLY WHAT HAS BEEN ESTABLISHED. The retired wording asserted a
   *  CAUSE — *"the run had not finished registering (the pre-stamp window)"* — that
   *  the code had not checked and, with the frame read in place, is usually FALSE.
   *  What is established is exactly two things: no run id could be resolved from
   *  either the live message bucket or the thread's workflow frame, and nothing was
   *  cancelled. It names the thread id and the condition and NOTHING ELSE
   *  (T-194.1-03-01, inherited verbatim from T-194-08-04: no message content, no
   *  auth header, no run output), and it is worded distinctly from the
   *  `"Stop failed:"` catch so the two conditions stay separable in a log.
   *
   *  It also CLIMBS DOWN AT ONCE. A press that provably cancelled nothing must not
   *  sit showing `⊘ Stopping this run…` for eight seconds — the whole subject of
   *  this phase is that the surface says only true things about a Stop. */
  const stopResolvedNoRunId = (threadId: string) => {
    console.warn(
      "Stop resolved no run id for thread",
      threadId,
      "— no streaming run id in the live message bucket and none on the thread's workflow frame. Nothing was cancelled.",
    )
    stopWindowExpired(threadId)
  }

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
      const callbacks = makeStreamCallbacks({
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
        // Phase 145-05 (D-145-05): stream event → reset the watchdog clock.
        lastEventAtRef.current.set(threadId, Date.now())
      }
      const originalOnTerminal = callbacks.onTerminal
      callbacks.onTerminal = (kind, errorPayload) => {
        // ⛔ Phase 243 (CHAT-02): drain the coalesced delta buffer BEFORE this wrapper
        // body runs. It reconciles / snapshots the message, and a flush that landed
        // afterwards would append the buffered tail onto replaced content.
        callbacks.flushDeltas()
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

        // Phase 176-04 (RENDER-03 / D-10.1): pre-mark a thread pending-send. ChatArea
        // calls this BEFORE setViewingThread on a fresh thread so the nav reconcile's
        // preserve-guard sees the in-flight intent and keeps the optimistic temp.
        // Adds ONLY to pendingSendThreadsRef — never sendingThreadsRef — so
        // sendMessage's duplicate-guard is untripped and the real send dispatches.
        // Released alongside sendingThreadsRef (send finally + non-dispatch early-return).
        markThreadPendingSend: (threadId) => {
          pendingSendThreadsRef.current.add(threadId)
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
              // ── Phase 244-11 (SHELL-01 / UAT gap G-3) — RECORD THE FAILURE, DO NOT
              //    SWALLOW IT.
              //
              // Driven 2026-09-12: GET /threads/{id}/snapshot returned 503 on 2 of 4
              // observed calls, and the chat surface said NOTHING — header fine, composer
              // fine, transcript silently incomplete. A sweep of every leaf element for
              // /unavailable|error|failed|retry|try again|something went wrong/i returned
              // ZERO matches. The console.error above WAS the entire handler, and
              // `lib/api/threads.ts:1063`'s docstring already claimed otherwise
              // ("the StreamsProvider consumer routes via its existing error handler").
              //
              // ⛔ 244-14 (review WR-04) — THE ABORT ARM THAT USED TO SIT HERE IS DELETED,
              // AND ITS DELETION IS THE HONEST OPTION OF THE TWO. It read
              // `if (err instanceof DOMException && err.name === "AbortError") return`, and
              // all three of its claims were wrong at once:
              //   1. UNREACHABLE. `getSnapshot(threadId, signal?)` takes an OPTIONAL signal
              //      and the call below passes NONE, so nothing can abort this fetch.
              //   2. THE JUSTIFICATION NAMED A MECHANISM THE CODE DOES NOT HAVE. It said a
              //      thread switch "cancels an in-flight snapshot"; the in-flight protection
              //      here is `reconcileInFlightRef`, which DROPS the second reconcile — it
              //      does not abort the first.
              //   3. NARROWER THAN THE WRITER IT CLAIMED TO MIRROR. `loadMessages` tests both
              //      `Error.name` AND a duck-typed `{ name }` (:3241-3242), because the shape
              //      differs between jsdom, undici and the browser.
              // A guard for a state the product cannot produce is dead code carrying a false
              // sentence, and its test was a control over a branch nothing can reach.
              // ⛔ THE OBLIGATION IS NOW ENFORCED INSTEAD OF GUESSED: if a signal is ever
              // threaded into the `getSnapshot` call below, restore the SHIPPED two-shape
              // abort guard IN THE SAME COMMIT. `streamsProvider_244_snapshot_failure.test.tsx`
              // Test 3 fails the moment that call grows a second argument, which is a fence
              // that CAN fire — unlike the control it replaced.
              // ⛔ The EXACT shipped write from the loadMessages failure path (:3209-3215),
              // reused rather than re-invented: two writers of one slice that differ is how
              // slices drift here. It lands in the per-thread `reconcileErrors` Map
              // (D-075.4-A1), which `useReconcileErrorForThread` already feeds to
              // ChatArea's shipped amber banner — Retry and dismiss included. No new slice,
              // no new renderer, no automatic retry, and `Retry-After` is deliberately NOT
              // consumed (that would be a new behaviour, not a gap fix — see
              // deferred-items.md).
              //
              // ⚠ 244-14 (CR-01) — THE THIRD HALF OF THE COPIED WRITER IS DELIBERATELY NOT
              // TAKEN, and the reason is measured rather than stylistic. `loadMessages`
              // retries ONCE at 1s before it raises (:3243, D-068.5-09). Doing that here
              // would hold `reconcileInFlightRef` — a GLOBAL flag, not a per-thread one
              // (:1470/:1942) — for that whole second, and `reconcile` early-returns while it
              // is held. A thread switch during the sleep would therefore DROP the new
              // thread's reconcile entirely: the person lands on a conversation that never
              // reconciles at all, which is a worse failure than a banner they can dismiss.
              // ⛔ So the banner raises on attempt 0, BY DECISION. Make the in-flight guard
              // per-thread first if a retry is ever wanted here — see deferred-items.md.
              useStreamsStore.setState((s) => ({
                reconcileErrors: new Map(s.reconcileErrors).set(
                  threadId,
                  err instanceof Error ? err : new Error(String(err)),
                ),
              }))
              return
            }

            // ── Phase 244-14 (CR-01) — THE OTHER HALF OF THE WRITER THIS ARM COPIED.
            //
            // `244-11` reused the loadMessages FAILURE write above and left its
            // CLEAR-ON-SUCCESS behind (:3232-3238, which lives in `loadMessages` and not
            // here). ⛔ `reconcile` IS THE THREAD-OPEN PATH — `loadMessages` runs only from
            // `handleRetryReconcile`, the `buffer_expired` arm and the stream-terminal
            // `finally` — so on an ordinary open there was NO writer that could clear the
            // entry, and one transient 503 painted the banner for the life of the session.
            //
            // ⛔ AND THE SECOND FAILURE IS WORSE THAN THE FIRST: once the transcript hydrates,
            // `ChatArea.tsx:712-717` picks its sentence off `messages.length` and flips to
            // "Couldn't load latest messages. Showing cached version." OVER FRESHLY FETCHED
            // CONTENT — a claim ABOUT THE SCREEN that is false, which is the exact thing
            // `244-11`'s own docblock says it exists to prevent.
            //
            // The `has` guard keeps the steady state free: no `setState`, so no subscriber
            // wakes on the overwhelmingly common clean open. Byte-for-byte the shipped
            // loadMessages clear, on purpose — two writers of one slice that differ is how
            // slices drift here. Driven by `streamsProvider_244_snapshot_failure.test.tsx`
            // Test 2b, which starts DIRTY through this very arm.
            if (useStreamsStore.getState().reconcileErrors.has(threadId)) {
              useStreamsStore.setState((s) => {
                const next = new Map(s.reconcileErrors)
                next.delete(threadId)
                return { reconcileErrors: next }
              })
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
              // Phase 176-04 (RENDER-03 / D-10.1): honor the sibling pending-send ref
              // too, so a reconcile fired between ChatArea's pre-mark and sendMessage's
              // own sendingThreadsRef.add still preserves the fresh-thread optimistic
              // temp. Composes with the 176-01 untyped-temp supersededByPersisted branch
              // below (a temp with a persisted twin still drops; only the preserve
              // WINDOW widens, never the drop rule).
              const sendInFlightOnThisThread =
                sendingThreadsRef.current.has(threadId) || pendingSendThreadsRef.current.has(threadId)
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
                    // BUG-260626-01: also require the DB to NOT yet hold this runId.
                    // After a transient-done→reattach re-adds the runId to
                    // subscriptionsRef, the bare subscription survival kept the
                    // completed temp even once its persisted twin arrived in the
                    // snapshot → two same-runId rows → duplicate React key
                    // (MessageList `run-${runId}`) → duplicated GENERATED FILES
                    // panels / source-doc bleed. Drop the temp the moment its
                    // persisted twin exists. Harness is unaffected (its persisted
                    // answer returns runId=undefined, so dbRunIds never holds it;
                    // the streaming arm still governs harness temps).
                    (subscriptionsRef.current.has(m.runId) && !dbRunIds.has(m.runId)) ||
                    (!dbRunIds.has(m.runId) && m.runStatus === "streaming")
                  )
                }
                // Phase 176 RENDER-01 (D-05 option b / D-06) + WR-01: a single send
                // must render exactly ONE user bubble. Drop the untyped user temp ONLY
                // once the snapshot holds its OWN persisted twin, matched by IDENTITY —
                // the real message_id stamped as `registeredUserMsgId` when postMessage
                // resolved (send path below). The PRIOR guard matched on CONTENT + a
                // cross-clock `created_at >=` inequality, which was skew-fragile: the
                // temp's created_at is the CLIENT clock while the persisted row's is the
                // SERVER clock, so a client-ahead skew made the genuine twin compare
                // "older" → the temp was NOT superseded → a duplicate user bubble that
                // persisted to reload (WR-01). Identity is skew-free AND immune to any
                // backend content trim/normalization. The 075.7 / D-06 preserve is
                // intact: a still-in-flight temp with no registeredUserMsgId yet has no
                // CONFIRMED twin → preserved (never stop preserving temps); its twin is
                // deduped on the send path by the same message_id identity.
                const supersededByPersisted =
                  m.registeredUserMsgId !== undefined &&
                  snapshot.messages.some(
                    (s) => !s.id.startsWith("temp-") && s.id === m.registeredUserMsgId,
                  )
                return sendInFlightOnThisThread && !supersededByPersisted
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

            // ── Phase 145-05 (U7 / Pattern 2 / D-145-01, FND-01) ──────────────
            // Reconcile-DERIVE streamingThreads from the AUTHORITATIVE
            // snapshot.active_runs. Before this, streamingThreads was written ONLY
            // by the send path (add :1715, reattach re-add :1852, finally-delete
            // :2020) and reconcile() never touched it, so a missed-terminal SSE
            // left a permanent phantom Stop until a full reload (RESEARCH A3).
            // Deriving here makes the Stop button agree with runs.status in BOTH
            // directions through the EXISTING selectors with zero call-site
            // changes: Direction A (delete when no run is streaming) and Direction
            // B (re-add when a still-active run is reconciled). runs.status is
            // truth (D-v2.5-03 reconcile-via-fetch); the local flag never decides.
            // Pitfall 1: the delete is guarded by sendingThreadsRef so an
            // in-flight send is never clobbered (mirrors clearThreadBucket:1302).
            // Per-thread only — never touches another thread's membership (D-145-13).
            const hasStreamingRun = activeRuns.some((r) => r.status === "streaming")
            const wasStreaming = useStreamsStore.getState().streamingThreads.has(threadId)
            if (hasStreamingRun && !wasStreaming) {
              lastEventAtRef.current.set(threadId, Date.now())
              useStreamsStore.setState((s) => ({
                streamingThreads: new Set(s.streamingThreads).add(threadId),
              }))
            } else if (
              !hasStreamingRun &&
              wasStreaming &&
              !sendingThreadsRef.current.has(threadId)
            ) {
              useStreamsStore.setState((s) => {
                const next = new Set(s.streamingThreads)
                next.delete(threadId)
                return { streamingThreads: next }
              })
              lastEventAtRef.current.delete(threadId)
            }

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

              const callbacks = makeStreamCallbacks({
                assistantId: targetId,
                threadId,
                setMessages: setMessagesForBucketBound(surfaceId, threadId),
              })
              const originalOnTerminal = callbacks.onTerminal
              callbacks.onTerminal = async (kind, errorPayload) => {
                // ⛔ Phase 243 (CHAT-02): drain the coalesced delta buffer BEFORE this wrapper
                // body runs. It reconciles / snapshots the message, and a flush that landed
                // afterwards would append the buffered tail onto replaced content.
                callbacks.flushDeltas()
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
                // Phase 138-04 (RUN-01 live-surfacing): on the TRUE terminal
                // (post transient-reattach return), fire-and-forget a todos
                // reconcile so the 138-02 "(run ended — not completed)" marker
                // surfaces LIVE with no thread-switch/refresh. Clean-completion
                // gate lives in the helper; not awaited (never blocks teardown);
                // best-effort (.catch belt-and-suspenders — the helper swallows).
                void _reconcileTodosOnTerminal(threadId, kind).catch(() => {})
                // Phase 176 RENDER-02 (D-07): mirror the send-path onTerminal
                // content-reconcile (:2004-2027) onto the mount/reconcile path so a
                // BACKGROUNDED parallel-thread run un-folds its final answer LIVE on
                // switch-back with no reload. message.content is the accumulated
                // narration+answer blob (onDelta only APPENDS — the :358 invariant);
                // the backend persists only the clean final answer. On a clean Deep
                // terminal, swap JUST this run's assistant content to the persisted
                // answer so StreamingNarration's fold gives way to a clean answer.
                // Keyed on run.run_id (this path's runId — registeredRunId is
                // undefined here; Pitfall 2). Content-ONLY (preserves tool_calls /
                // suggestions / output-files / runStatus), far lighter than a full
                // loadMessages replace; the .finally() loadMessages floor remains the
                // reload-time backstop (D-v2.5-03). SEED-094 (backend stray last-line)
                // stays OUT (D-09) — this faithfully renders whatever was persisted.
                // ⚠ 243-06 (MD-4) — THIS GATE USED TO READ `kind === "done" || kind === "reader_done"`,
                // AND 243-05 TURNED THAT NARROWING INTO A USER-VISIBLE DEFECT. The original is
                // named here rather than silently widened. Before 243-05 a FAILED run's interim
                // narration stayed folded inside `StreamingNarration`; that arm is now deleted, so
                // the raw blob renders as the answer, with the answer's own renderers — and
                // PERMANENTLY, because a failed run never reached this reconcile at all. Every
                // terminal kind now reconciles; the list is spelled in full so it is total over the
                // `kind` union rather than a negation that a sixth kind would silently join.
                // ⛔ THE `!answer.content` GUARD BELOW IS WHAT MAKES THAT SAFE, and it is the whole
                // reason this is not a one-word change: a cancelled or errored run may have
                // persisted NOTHING, and overwriting a visible blob with an empty string would
                // replace a bad answer with no answer — a strictly worse failure than the one
                // being fixed.
                if (["done", "reader_done", "error", "cancelled", "timed_out"].includes(kind)) {
                  const rid = run.run_id
                  getMessages(threadId)
                    .then((persisted) => {
                      const answer = persisted.find(
                        (m) => m.runId === rid && m.role === "assistant",
                      )
                      // ⛔ 243-06 (MD-4): `!answer.content` is load-bearing, not defensive —
                      // see the gate's note. An empty persisted answer must leave the
                      // visible text alone rather than blank it.
                      if (!answer || !answer.content) return
                      useStreamsStore
                        .getState()
                        .actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
                          prev.map((m) =>
                            m.runId === rid &&
                            m.role === "assistant" &&
                            m.content !== answer.content
                              ? { ...m, content: answer.content }
                              : m,
                          ),
                        )
                    })
                    .catch(() => {})
                }
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
                // Phase 145-05 (D-145-05): stream event → reset the watchdog clock.
                lastEventAtRef.current.set(threadId, Date.now())
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
                    // 244-13 — WRITE SITE 2 of 6. Genuinely harness, and said EXPLICITLY
                    // rather than left to a default: this arm requires a live, non-stale
                    // `active_workflow_run_id`, which is the server's own definition of
                    // harness (`threads.py:1195`).
                    mode: "harness",
                    // ⛔ ALWAYS `false` ON THIS BRANCH — 244-14 (review WR-02), MIRRORED FROM
                    // `ChatArea.tsx`'s site (T-244-03-01 / 244-08). This read the server's flag
                    // through while the OTHER mount-time writer of the SAME key, on the SAME
                    // branch of the SAME GET, hard-coded `false`. Both fire on every thread
                    // open; whichever settled last won; nothing ordered them. After `244-13`
                    // the surviving consequence is WR-01's — whether a genuine live harness run
                    // renders the Continue card was decided by a promise race.
                    // ⚠ FAIL-CLOSED IS THE DIRECTION, not just the agreement: a harness run
                    // paused at its own cap keeps the composer locked, so the person clicks
                    // Cancel instead of typing into a composer the server will 409. Unlocking
                    // during a live harness run is the elevation `T-244-03-01` names.
                    // Fenced by `__tests__/providers/workflowLockWriters.lockstep.test.ts`,
                    // which compares the two sites' expressions rather than trusting a comment.
                    capPaused: false,
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
                } else if (wf.cap_paused) {
                  const runId = (wf.active_workflow_run_id || wf.latest_producer_run_id || "") as string
                  if (runId) {
                    actions.setWorkflowLockForThread(threadId, {
                      runId,
                      // 244-13 — WRITE SITE 3 of 6, and usually a DEEP cap-pause. DERIVED
                      // FROM THE WIRE, never from `capPaused`: the server already answers
                      // this question at `threads.py:1195` and re-deriving it client-side
                      // from `active_workflow_run_id` would be a second derivation of one
                      // fact — which is how these two registers drifted apart (G-1).
                      mode: wf.mode === "harness" ? "harness" : "cap_paused",
                      capPaused: true,
                      continuesRemaining: wf.continues_remaining,
                    })
                  } else {
                    actions.clearWorkflowLockForThread(threadId)
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
          if (sendingThreadsRef.current.has(threadId)) {
            // Phase 176-04 RENDER-03 (D-10.2 / D-11): the duplicate-guard non-dispatch
            // path USED to return SILENTLY — so if a fresh-thread reconcile race ever
            // routed the real send through here, the user's just-typed message vanished
            // with no trace (BUG-260603-01, the intermittent silent send-drop). Honesty
            // guarantee: stash the dropped draft + a quiet retry hint through the EXISTING
            // 099-08 recovery seam (the SAME reconcileErrors + failedSendDrafts store
            // shape as the ApiError rollback below). ChatArea's
            // `prefillMessage={failedDraft ?? …}` restores the composer text and the
            // per-thread banner surfaces the hint — the user never loses a message even
            // if a race fires. The hint is an ApiError (400) so the existing banner
            // renders its custom message (a plain Error would show the misleading
            // "Couldn't load latest messages" copy) and hides the misleading reload-Retry
            // (400 ∈ NON_RETRYABLE) — the composer prefill is the real retry affordance.
            // No new toast/error channel (D-11). The successful-dispatch path and the
            // ApiError rollback are untouched.
            useStreamsStore.setState((s) => ({
              reconcileErrors: new Map(s.reconcileErrors).set(
                threadId,
                new ApiError("Couldn't send — tap to retry", 400),
              ),
              failedSendDrafts: new Map(s.failedSendDrafts).set(threadId, content),
            }))
            // Phase 176-04 (RENDER-03 / D-10.1): release the pending flag — this send
            // will not dispatch, so its pre-mark must not linger (mirrors the finally).
            pendingSendThreadsRef.current.delete(threadId)
            return
          }
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
          // ── Phase 194.1 Plan 03 (R5 — CONTEXT D-13) — THE HARNESS GATE ─────
          //
          // A harness kickoff inserts ZERO assistant nodes. `opts.workflowDefinitionId`
          // is the signal `sendMessage` ALREADY receives and the one Deep never
          // sets — the store's own JSDoc on this opt says so verbatim: "Omitted on
          // a Deep send (byte-identical)". So Deep enters the same branch it
          // entered before this commit, and 174 D-14's byte-identity holds BY
          // CONSTRUCTION rather than by test.
          //
          // ⚠ TWO REJECTED ALTERNATIVES, recorded so they are not re-litigated:
          //  - The RENDER-LEVEL rule ("the assistant renders only when it has
          //    content") is closer to R5's literal wording and is REJECTED: it
          //    changes what DEEP renders during its own first-token window, which
          //    is out of this phase's scope entirely.
          //  - HIDING the node with CSS is REJECTED: R5's acceptance is *zero
          //    assistant nodes in the transcript*, and a hidden node is still in
          //    the transcript, still in the bucket, and still the thing every
          //    `m.id === assistantId` map writes onto. That is why the fence
          //    COUNTS nodes rather than measuring visibility.
          //
          // ⚠ `assistantId` STAYS DECLARED and stays the identity every later arm
          // keys on. The `finally` chain is a no-op over an absent id (every write
          // there is `m.id === assistantId`) and is deliberately UNTOUCHED. The two
          // arms that are NOT harmless over an absent id — the 403 kill-switch and
          // the network-failure flip — are repaired in their own place below
          // (CONTEXT D-23); this gate would ship a NEW SILENCE without them.
          if (!opts?.workflowDefinitionId) {
            useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => [
              ...prev,
              assistantMsg,
            ])
          } else {
            // The run's liveness, marked SYNCHRONOUSLY — in the same tick as the
            // user-message insert and the `streamingThreads` add below, with ZERO
            // round trips. R5's acceptance is "no interval showing a prompt with no
            // run instrument"; a fetch-driven liveness signal would fail it by one
            // kickoff RTT, and the shipped lock seed cannot serve here because it
            // needs `run_id` back from the POST. Cleared by the SAME
            // slice-transition subscription that clears the stopping slice.
            useStreamsStore.setState((s) => ({
              harnessKickoffThreads: new Set(s.harnessKickoffThreads).add(threadId),
            }))
          }
          // Plan 075.4-01 D-075.4-A1: per-thread streamingThreads.
          useStreamsStore.setState((s) => ({
            streamingThreads: new Set(s.streamingThreads).add(threadId),
          }))
          // Phase 145-05 (D-145-05): seed the watchdog activity clock at send.
          lastEventAtRef.current.set(threadId, Date.now())

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
              // Phase 216 (CHAT-05 / CHAT-06): active connector IDs for this turn.
              activeConnectorIds: opts?.activeConnectorIds,
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
                // 244-13 — WRITE SITE 4 of 6. Genuinely harness by construction: this
                // branch is gated on `opts.workflowDefinitionId`, which a Deep send
                // never sets.
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
            useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => {
              // Phase 176 WR-01: a reconcile can race AHEAD of this resolve and merge
              // the persisted user twin (id === message_id) into the bucket while the
              // temp is still untyped. Blindly swapping the temp id to message_id would
              // then mint a SECOND row with the same id (duplicate user bubble +
              // duplicate React key). If the twin is already present, DROP the temp
              // instead of swapping; otherwise swap its id to the real message_id (the
              // WR-04 contract) AND stamp registeredUserMsgId so any later reconcile
              // dedups it by IDENTITY (skew-free), never the old created_at compare.
              const persistedTwinPresent = prev.some(
                (x) => x.role === "user" && !x.id.startsWith("temp-") && x.id === message_id,
              )
              return prev
                .filter((m) => !(m.id === userMsg.id && persistedTwinPresent))
                .map((m) => {
                if (m.id === userMsg.id)
                  return { ...m, id: message_id, registeredUserMsgId: message_id }
                if (m.id === assistantId)
                  return {
                    ...m,
                    runId: run_id,
                    model: resolvedModel ?? undefined,
                    provider: resolvedProvider ?? undefined,
                    // Phase 174-04 (STATE-04 / D-11): anchor the run-strip timer to a
                    // stable wall-clock baseline so a nav-back remount keeps climbing
                    // instead of reseeding elapsed from component mount (a multi-minute
                    // workflow run reading "28s"). The kickoff POST response carries no
                    // started_at (verified :1807-1818), so we use client send-time; the
                    // persisted runs.started_at enrich (api.ts started_at→startedAt)
                    // corrects any drift ≤ one RTT on the next hydrate. RunCard.tsx:122
                    // (runStartMs = startedAt ?? created_at) is the already-correct 095.1
                    // consumer — this stamps its SOURCE, no consumer edit, no backend
                    // field (D-14: Deep byte-identical; the stamp is additive).
                    startedAt: new Date().toISOString(),
                  }
                return m
              })
            })

            // Step 2: open the GET stream and dispatch SSE events to per-message-id callbacks.
            const callbacks = makeStreamCallbacks({
              assistantId,
              threadId,
              onTitleUpdate: opts?.onTitleUpdate,
              setMessages: setMessagesForBucketBound(surfaceId, threadId),
            })

            const originalOnTerminal = callbacks.onTerminal
            callbacks.onTerminal = async (kind, errorPayload) => {
              // ⛔ Phase 243 (CHAT-02): drain the coalesced delta buffer BEFORE this wrapper
              // body runs. It reconciles / snapshots the message, and a flush that landed
              // afterwards would append the buffered tail onto replaced content.
              callbacks.flushDeltas()
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
                      // BUG-260707-01: also RESTORE streamingThreads here. The
                      // sendMessage `finally` (below) unconditionally deletes threadId
                      // from streamingThreads when the awaited subscribeToRun resolves
                      // at a transient stream-end. subscribeToRun calls onTerminal
                      // WITHOUT await (api.ts) and returns immediately, so the finally
                      // runs BEFORE this reattach body — delete-then-readd nets to
                      // "present". Without this, isStreaming (= streamingThreads.has(
                      // tid)) reads false for the REST of the reattached run, so the
                      // composer flips Stop→Send and the 👍/👎 feedback buttons appear
                      // mid-run (MessageItem.tsx:451). Mirrors the proven
                      // subscriptionsByThread delete-then-readd lifecycle above.
                      useStreamsStore.setState((s) => ({
                        subscriptionsByThread: _addRunToThread(s.subscriptionsByThread, threadId, rid),
                        streamingThreads: new Set(s.streamingThreads).add(threadId),
                      }))
                      // Phase 145-05 (D-145-05/10): a transient reattach counts as
                      // fresh activity — reset the watchdog clock so the belt does
                      // not immediately probe a run that just re-attached.
                      lastEventAtRef.current.set(threadId, Date.now())
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
              // Phase 138-04 (RUN-01 live-surfacing): same fire-and-forget todos
              // reconcile as the reconcile-path onTerminal — surface the 138-02
              // "(run ended — not completed)" marker LIVE on the true terminal
              // (post transient-reattach return). Clean-completion gate lives in
              // the helper; not awaited; best-effort (.catch — helper swallows).
              void _reconcileTodosOnTerminal(threadId, kind).catch(() => {})
              // BUG-260707-03 (final answer stays folded live): message.content is
              // the ACCUMULATED narration+answer blob (onDelta only APPENDS — the
              // :358 invariant), but the backend persists only the clean final
              // answer (last iteration). While runStatus === "streaming" the
              // StreamingNarration folds that blob to a gist; the final answer
              // streams in as the blob's tail and is folded with it, only
              // "resolving" on a later reload. On a clean Deep terminal, reconcile
              // JUST this run's assistant content to the persisted answer so the
              // fold gives way to a clean, separated answer LIVE (no reload). Scoped
              // to the ONE message's content — preserves tool_calls / suggestions /
              // output-files / runStatus, far lighter than a full loadMessages
              // replace. Fire-and-forget; a slow/failed fetch just leaves the
              // reload-time reconcile as the floor (D-v2.5-03: reconcile via fetch).
              // Keyed by the OWNING threadId so a resolve landing after a
              // thread-switch updates its own bucket, never the viewed thread.
              // ⚠ 243-06 (MD-4) — THIS GATE USED TO READ `kind === "done" || kind === "reader_done"`,
              // AND 243-05 TURNED THAT NARROWING INTO A USER-VISIBLE DEFECT. The original is
              // named here rather than silently widened. Before 243-05 a FAILED run's interim
              // narration stayed folded inside `StreamingNarration`; that arm is now deleted, so
              // the raw blob renders as the answer, with the answer's own renderers — and
              // PERMANENTLY, because a failed run never reached this reconcile at all. Every
              // terminal kind now reconciles; the list is spelled in full so it is total over the
              // `kind` union rather than a negation that a sixth kind would silently join.
              // ⛔ THE `!answer.content` GUARD BELOW IS WHAT MAKES THAT SAFE, and it is the whole
              // reason this is not a one-word change: a cancelled or errored run may have
              // persisted NOTHING, and overwriting a visible blob with an empty string would
              // replace a bad answer with no answer — a strictly worse failure than the one
              // being fixed.
              if (["done", "reader_done", "error", "cancelled", "timed_out"].includes(kind)) {
                const rid = registeredRunId
                if (rid) {
                  getMessages(threadId)
                    .then((persisted) => {
                      const answer = persisted.find(
                        (m) => m.runId === rid && m.role === "assistant",
                      )
                      // ⛔ 243-06 (MD-4): `!answer.content` is load-bearing, not defensive —
                      // see the gate's note. An empty persisted answer must leave the
                      // visible text alone rather than blank it.
                      if (!answer || !answer.content) return
                      useStreamsStore
                        .getState()
                        .actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
                          prev.map((m) =>
                            m.runId === rid &&
                            m.role === "assistant" &&
                            m.content !== answer.content
                              ? { ...m, content: answer.content }
                              : m,
                          ),
                        )
                    })
                    .catch(() => {})
                }
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
              // Phase 145-05 (D-145-05): stream event → reset the watchdog clock.
              lastEventAtRef.current.set(threadId, Date.now())
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
            } else if (err instanceof ApiError && err.status === 403) {
              // Phase 174 Plan 03 (STATE-01b / D-04 / D-05 / sketch 129-C amber tier):
              // an administrative block — the workflows kill-switch (workflow_kickoff.py:200
              // "Workflows are currently disabled by the administrator") or the app-layer ban,
              // both raised as a 403 BEFORE any run/message is inserted. This is NOT a failure
              // (red) and NOT the 400/409 rollback-banner path — it is 129-C's AMBER tier.
              // DIVERGE from the 409/400 rollback shape: KEEP the user bubble, and REPLACE the
              // empty assistant placeholder with an honest in-chat amber notice carrying the
              // server's message verbatim (rendered as React text, never HTML — T-174-03-01).
              // Keyed narrowly to status===403 and placed BEFORE the generic ApiError branch
              // so the 400 disabled-skill + 409 workflow-lock rollback paths stay byte-identical
              // (D-05). No run_id / runs query — the 403 fires before any INSERT (Pitfall 5).
              //
              // ── Phase 194.1 Plan 03 (R5 / CONTEXT D-23) — THE HONESTY REPAIR ──
              // R5 stops inserting the optimistic placeholder on a harness kickoff,
              // and this arm WROTE ONTO THAT PLACEHOLDER BY ID. Left as a bare
              // `map`, it would become a NO-OP OVER AN ABSENT NODE — and since
              // `workflow_kickoff.py:200` is raised on the harness path and ONLY the
              // harness path, silencing it here silences the administrator's
              // kill-switch EVERYWHERE. So: INSERT the notice-bearing node when the
              // placeholder was skipped, instead of mapping onto one that is not
              // there. Same `assistantId`, so identity is unchanged downstream.
              //
              // ⚠ A REFUSED KICKOFF IS NOT A RUNNING KICKOFF. A node that exists
              // ONLY to carry a refusal does not reinstate the surface the duplicate
              // avatar was drawn on (BUG-260610-01): it carries no `runStatus:
              // "streaming"`, no empty streaming body and no live instrument — it is
              // a message, not a placeholder. That distinction is what keeps R5's
              // "zero assistant nodes" acceptance true of a RUNNING kickoff.
              useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
                prev.some((m) => m.id === assistantId)
                  ? prev.map((m) =>
                      m.id === assistantId ? { ...m, blockedNotice: { message: err.message } } : m,
                    )
                  : [...prev, { ...assistantMsg, runStatus: undefined, blockedNotice: { message: err.message } }],
              )
              // D-04: guarantee the composer is never left locked. The kickoff lock is only
              // seeded AFTER run_id (a 403 never gets there), so this is a defensive no-op in
              // the common case — keyed by the OWNING threadId closure (A25 per-thread
              // isolation), never a global flag, so a parallel Thread B is untouched.
              useStreamsStore.getState().actions.clearWorkflowLockForThread(threadId)
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
              //
              // ── Phase 194.1 Plan 03 (R5 / CONTEXT D-23) — THE HONESTY REPAIR ──
              // The second of the two arms that rode on the placeholder. Without
              // this, a harness kickoff that fails the NETWORK is COMPLETELY SILENT
              // — no node, no notice, no console-visible surface change — because
              // the `map` would run over an absent id. Measured RED at BASELINE §8
              // and again in this plan's own task-4 commit, which shipped the gate
              // without this repair on purpose.
              //
              // ⚠ Same rule as the 403 arm above: a FAILED kickoff is not a RUNNING
              // kickoff. The inserted node carries `runStatus: "failed"` and never
              // `"streaming"`, so it is a failure receipt rather than a reinstated
              // placeholder.
              useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
                prev.some((m) => m.id === assistantId)
                  ? prev.map((m) => (m.id === assistantId ? { ...m, runStatus: "failed" } : m))
                  : [...prev, { ...assistantMsg, runStatus: "failed" as const }],
              )
            }
          } finally {
            abortControllerRef.current = null
            // SEED-055: release THIS thread's send slot (per-thread; other threads'
            // in-flight sends are unaffected).
            sendingThreadsRef.current.delete(threadId)
            // Phase 176-04 (RENDER-03 / D-10.1): release the sibling pending flag in
            // lockstep — the send has resolved/aborted, so the fresh-thread pre-mark
            // is done. Deleting a non-present key is a no-op on the non-fresh path.
            pendingSendThreadsRef.current.delete(threadId)
            // Plan 075.4-01 D-075.4-A1: per-thread streamingThreads delete.
            // This is the AUTHORITATIVE streaming-end write — clearThreadBucket
            // no longer writes here (D-075.4-A1 invariant; see L:617).
            useStreamsStore.setState((s) => {
              const next = new Set(s.streamingThreads)
              next.delete(threadId)
              return { streamingThreads: next }
            })
            // Phase 145-05 (D-145-05): drop the watchdog clock in lockstep with the
            // streamingThreads delete. On a TRANSIENT stream-end this runs BEFORE
            // the reattach re-add (subscribeToRun fires onTerminal WITHOUT await),
            // which re-stamps it — so a still-live reattached run keeps its clock.
            lastEventAtRef.current.delete(threadId)
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
          // Phase 194.1 Plan 03 (R1): the press, recorded synchronously and BEFORE
          // any network work. Byte-mirrored in `stopThread` below.
          recordStopPress(stid)
          // ── Phase 194.1 Plan 03 (R6) ──────────────────────────────────────
          // Bucket FIRST, thread workflow frame as the fallback. See
          // `resolveStopRunId` for the ordering argument, D-12's rejected
          // alternative and D-14. This arm is `stopThread`'s exact mirror — the
          // two resolvers share the resolver AND the no-id arm, so they cannot
          // drift, which is the whole reason CONTEXT D-22 exists.
          const runId = await resolveStopRunId(stid)
          if (!runId) {
            stopResolvedNoRunId(stid)
            return
          }
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
          // Phase 194.1 Plan 03 (R1): the press, recorded synchronously and BEFORE
          // any network work. Byte-mirrored in `stopStream` above.
          recordStopPress(threadId)
          // ── Phase 194.1 Plan 03 (R6) ──────────────────────────────────────
          // Bucket FIRST, thread workflow frame as the fallback. See
          // `resolveStopRunId` for the ordering argument, D-12's rejected
          // alternative and D-14. `stopStream` above calls the SAME resolver and
          // the SAME no-id arm, so the two byte-mirror resolvers cannot drift.
          const runId = await resolveStopRunId(threadId)
          // ── Phase 194-08 (T-194-08-01): the PRE-STAMP WINDOW ──────────────
          // Was a bare `if (!runId) return`, and that return was a SILENT
          // no-op. `sendMessage` inserted the optimistic assistant placeholder
          // with `runStatus: "streaming"` and NO `runId`, and only stamped
          // `runId: run_id` once the kickoff POST resolved.
          // A Stop pressed between those two points matched the scan, read an
          // undefined id, and returned having done nothing — with no evidence
          // in the console, in a log capture, or on the surface.
          //
          // The window is ONE kickoff round trip, but the silence compounds
          // with the server side: `api.ts::cancelRun` deliberately swallows 404
          // (correct for its own purpose — a run another tab already
          // cancelled), so the neighbouring failure mode is silent too. In a
          // phase whose subject is an HONEST Stop, a silent success is worse
          // than a visible failure.
          //
          // The GUARD IS UNCHANGED — `cancelRun` is still never called with a
          // falsy id. Only the silence is removed.
          //
          // ── ⚠ THE 194-08 RE-OPEN TRIGGER IS **DISCHARGED** BY 194.1 R1 + R6 ──
          //
          // ⚠ SUPERSEDED — the original text is quoted VERBATIM below rather than
          // deleted, because a deferral that lives only in a deleted comment is
          // exactly as invisible as one that was never written (193.2 WR-05):
          //
          //   "⚠ REJECTED ALTERNATIVE, recorded so a future reader finds a
          //    decision rather than an omission. 194-RESEARCH § B offered a second
          //    option: DISABLE the Stop control until the id lands. It was
          //    rejected as out of proportion — it reaches into the composer's
          //    shipped `disabled` logic and changes a control's behaviour during a
          //    one-RTT window on EVERY run, Deep included, to close a gap measured
          //    in one round trip. RE-OPEN TRIGGER: a second sighting of a Stop
          //    lost in the pre-stamp window (a UAT row, a bug report, or this warn
          //    appearing in a real log capture). At that point disabling the
          //    control — or queueing the intent until the stamp lands — becomes
          //    the proportionate fix and this comment is its starting point."
          //
          // The trigger fired (`BUG-260816-01`) and BOTH halves are now answered,
          // and by something better than the option 194-08 had on the table:
          //   - R1: the control is **REMOVED** while stopping, not disabled — so a
          //     second press is impossible BY CONSTRUCTION rather than discouraged,
          //     and nothing reaches into the composer's shipped `disabled` logic.
          //     Sketch 168-B: no disabled button, because no button.
          //   - R6: the id no longer depends on the stamp at all. The frame read
          //     resolves a run the bucket has never seen, so the pre-stamp WINDOW
          //     is no longer a window in which the id is unavailable.
          // What remains owed is NOT this: it is L-01 (a producer on the other
          // worker writing `completed` over the cancel — `db/workflows.py:1458-1463`),
          // which is a SERVER-side terminal-guard problem and has its own phase.
          if (!runId) {
            stopResolvedNoRunId(threadId)
            return
          }
          // ⚠ `stoppedByUserRef` is set only BELOW the guard, and that ordering
          // is load-bearing rather than incidental: the ref is what makes
          // onTerminal stamp `stopped: true` and render "Response stopped"
          // (:2333-2364). Setting it on a path that cancelled nothing would be
          // the same lie one layer up — the surface would claim the user
          // stopped a run that ran to completion. Verified at HEAD: the shipped
          // order was already correct, so this is a pin, not a fix.
          //
          // ⚠ 194.1 R6 makes this ordering MORE load-bearing, not less: the
          // resolution above is now TWO sources (bucket, then frame), so there are
          // two ways to arrive here with nothing to cancel. The ref stays BELOW
          // both of them, and the no-id arm returns without ever touching it.
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
              .actions.sendMessage(threadId, userMsg.content, {
                surfaceId,
                model: failedMessage.model,
                provider: failedMessage.provider,
              })
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
                    // BUG-260626-01: require !dbRunIds.has on the subscription arm
                    // too, so a reattached completed temp is dropped the instant its
                    // persisted twin is fetched (prevents the duplicate-runId →
                    // duplicate-key duplicated-render). Harness unaffected (returns
                    // runId=undefined → not in dbRunIds; streaming arm governs it).
                    ((subscriptionsRef.current.has(m.runId) && !dbRunIds.has(m.runId)) ||
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
        // ── Phase 244-15 (SHELL-03 / UAT gap G-8) — THE SETTLE PATH. IT RELEASES ONLY. ──
        //
        // ⛔ THIS IS DELIBERATELY NOT A SEVENTH `setWorkflowLockForThread` WRITER, and that
        // is this path's central design constraint rather than a stylistic preference. Six
        // sites write that key; two of them are fenced against each other by
        // `__tests__/providers/workflowLockWriters.lockstep.test.ts` because they had already
        // drifted apart once (`244-08` / `244-13` / `244-14` CR-01). A reader who adds a
        // `setWorkflowLockForThread` call inside this action is re-opening `G-1`: they would be
        // introducing a seventh derivation of one fact, from a path nobody orders against the
        // other six. If a lock needs SETTING, the mount reconcile and the SSE already do it.
        //
        // WHY IT EXISTS. The designed cross-home settle for an answered approval is the
        // `ask_user_response` SSE (→ `removePendingAskForThread`, :1168). On the WORKFLOW path
        // the client is not subscribed to that run's stream, so the SSE never lands, nothing
        // re-reads the thread's workflow state, and `workflowLockByThread` keeps a lock the
        // server dropped — a `live` run line with a climbing 1s clock and a composer disabled
        // on "Workflow running — Cancel to switch back", over a finished run. Driven in a real
        // browser, `244-UAT.md` § R2-4.
        //
        // ⚠ FETCH-BASED, NOT A SECOND OPTIMISTIC UPDATE — `D-v2.5-03`, verbatim: *Realtime is
        // a hint, not truth — always reconcile via fetch*. A second optimistic mechanism that
        // can drift from the first IS the defect being fixed.
        //
        // ⚠ AND IT NEVER POLLS. One GET per human answer, bounded by the number of answers.
        // `ThreadRunLine.tsx`'s D-11 rule binds: WorkflowRunPage already owns the polling
        // concern. Fenced (with the no-seventh-writer rule) by
        // `__tests__/providers/streamsProvider_244_settle_ask.test.tsx` Test 8.
        releaseSettledWorkflowLock: (threadId) => {
          if (!threadId) return
          void (async () => {
            let wf: Awaited<ReturnType<typeof getThreadWorkflow>>
            try {
              wf = await getThreadWorkflow(threadId)
            } catch (err) {
              // Swallowed for `refreshPhaseSpineAfterStop`'s stated reason: the surface was
              // ALREADY stale, and a rejected background read must never surface as an error
              // nobody can act on — least of all from a click handler inside a card that has
              // no error boundary (`BUG-260529-03`). Writing nothing is the honest outcome:
              // we could not read, so we do not know, so we do not guess.
              console.warn("[StreamsProvider] settle read after answer failed", err)
              return
            }
            // THE TWO SHIPPED GUARDS, READ OFF THE WIRE AND NOT RE-DERIVED. These are the
            // exact conditions of the two `setWorkflowLockForThread` arms in this file's own
            // mount reconcile (:2411 and :2447) — quoted by reference on purpose, because a
            // second client-side derivation of one fact is how these registers drift.
            const liveAnchor = !!(
              wf.locked &&
              !wf.lock_is_stale &&
              wf.active_workflow_run_id
            )
            const capPaused = !!wf.cap_paused
            if (liveAnchor || capPaused) {
              // ⛔ RELEASE NOTHING. Unlocking the composer during a live harness run is the
              // elevation `T-244-03-01` names; a cap-paused lock is a lock the person still
              // needs (`244-08`). Fail-closed is the DIRECTION, not merely the agreement.
              //
              // Re-attach the live producer shell instead — the identical arm the mount
              // reconcile owns at :2440, idempotent per `subscribeProducerStream`'s docblock.
              // This is what lets the SHIPPED terminal handler clear the lock when the run
              // really ends, instead of this path inventing a second terminal route.
              if (wf.latest_producer_run_id) {
                subscribeProducerStreamRef.current?.(threadId, wf.latest_producer_run_id)
              }
              return
            }
            // The server has dropped the anchor (or calls it stale — the shipped F2 self-heal
            // reading). Release, in this order.
            //
            // ⚠ `clearStopStateForThread` AND NOT A HAND-WRITTEN SET DELETE.
            // `useHarnessLiveForThread` (:4711) has TWO disjuncts —
            // `harnessKickoffThreads.has(tid) || lock?.mode === "harness"` — so clearing only
            // the lock leaves the run line reading `live` with its 1s `setInterval` clock on a
            // dead run. That function is the SHIPPED writer of `harnessKickoffThreads` (it also
            // clears `stoppingThreads` / `stopNotConfirmed` and disarms the stop timer, all
            // correct here: the server has just said the run is over). Two writers of one slice
            // that differ is how slices drift in this file.
            useStreamsStore.getState().actions.clearWorkflowLockForThread(threadId)
            clearStopStateForThread(threadId)
            refreshPhaseSpineAfterStop(threadId)
          })()
        },
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
        //
        // Phase 188 Plan 02 (RUNVIZ-02 / Req 3 / Req 4) — `pending` LEFT the predicate,
        // and the sentence directly above is the argument for it. The 098-UAT reason
        // for this sweep is a MISSED `phase_completed` for a phase that DID run, so the
        // legitimate stragglers are exactly {running, retrying}; `pending` was never one
        // of them, and it is REACHABLE. `skip_to_phase` marks ONLY the current phase
        // (`harness_engine.py:1561-1563`) — every phase between it and the jump target
        // keeps `status='pending'` in `workflow_phases` for the life of the run, and
        // nothing ever revisits them. So on any skip-bearing workflow this sweep painted
        // a step that NEVER RAN as Complete, while a reconcile rebuilt from those same
        // rows restored "Not started": the live view and the reload disagreed about
        // whether work happened, which is precisely what Req 4 forbids. A never-ran
        // `pending` at run completion is a terminal truth by the same logic that already
        // protects failed/skipped, not a straggler to be tidied. Falsified first, RED
        // observed on unmodified source, in `panel/__tests__/PhaseReconcile.test.tsx`
        // (D-188-09) — with positive controls that the running/retrying sweep survives,
        // so this narrowing cannot be mistaken for disabling the sweep.
        finalizeAllPhasesForThread: (threadId) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.phasesByThread)
            const prev = next.get(threadId)
            if (!prev || prev.length === 0) return {}
            let changed = false
            const swept = prev.map((p) => {
              if (p.status === "running" || p.status === "retrying") {
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

  // ---- useEffect #1b (Phase 194.1 Plan 03, R1/R2/R5): the ONE stopping clear ----
  //
  // ⚠ KEYED ON THE `streamingThreads` SLICE TRANSITION, NOT ON `onTerminal`, AND
  // THAT CHOICE IS THE WHOLE POINT OF THIS EFFECT.
  //
  // `onTerminal` is WRAPPED TWICE — once on the reconcile/re-subscribe path
  // (:1662-1663 as measured at the plan-set SHA) and once on the send path
  // (:2057-2058) — and even between them it covers only TWO of the FOUR routes a
  // thread can leave `streamingThreads` by. All four, by line at that same SHA:
  //
  //   #1 :2304-2311  the sendMessage `finally` — "the AUTHORITATIVE streaming-end
  //                  write" (covered by onTerminal)
  //   #2 :1599-1602  the reconcile-DERIVE delete from snapshot.active_runs
  //                  (NOT covered — no terminal event fires at all)
  //   #3 :3007-3010  the inactivity watchdog's silent-finalize
  //                  (NOT covered — D-145-04 finalizes SILENTLY, on purpose)
  //   #4 :3222-3225  the org-switch teardown (NOT covered)
  //
  // #2 and #3 are EXACTLY the missed-terminal cases Phase 145 exists to close. A
  // clear keyed on `onTerminal` would therefore leave `⊘ Stopping this run…` on
  // screen forever on precisely the runs whose terminal went missing — the failure
  // mode this phase is about, reintroduced one layer up. One subscription over the
  // slice every one of the four routes writes covers all four by construction.
  //
  // ⚠ THE L-01 BOUNDARY, stated here and nowhere weaker. At the shipped
  // `WORKER_COUNT=2`, on roughly half of stops a producer on the OTHER worker
  // writes `completed` over the cancel (`backend/app/db/workflows.py:1458-1463` —
  // `finish_run` has no terminal guard; Phase 194 SC#2, FAILED). With the clear
  // keyed here, the surface will show `⊘ Stopping this run…` and then
  // `✓ Complete`. **THAT IS CORRECT AND MUST NOT BE SPECIAL-CASED.** Nothing in
  // this file may suppress, delay or rewrite the terminal reading because a thread
  // had been stopping; a dedicated fence in `StreamsProvider.stopping.test.ts`
  // reds against exactly that change. The lie is a BOUNDARY to state, never a
  // defect to hide.
  //
  // ⚠ CORRECTED 2026-08-16, and the superseded sentence is kept rather than
  // deleted: this comment read "RUN-01 stays UNTICKED until the separate L-01
  // phase ships". **RUN-01 IS NOW TICKED**, on a change that landed after this
  // was written — the `finish_run` terminal guard (`9dbd57f5`), which refuses to
  // let a far-worker producer write `completed` over a user's `cancelled`. So the
  // ✓ Complete reading described above is now RARE rather than routine.
  // ⚠ WHAT HAS NOT CHANGED, and is why this whole block stays: **the producer
  // still keeps running.** The guard fixed the REPORT, not the work. This file
  // must still never suppress a terminal reading, and the fence still reds
  // against it. The remaining L-01 work is routed to the automations milestone
  // with THE FIRST SCHEDULED RUN as its trigger.
  useEffect(() => {
    const unsubscribe = useStreamsStore.subscribe(
      (s) => s.streamingThreads,
      (next) => {
        const { stoppingThreads, stopNotConfirmed, harnessKickoffThreads } =
          useStreamsStore.getState()
        // The union, because a harness kickoff that was never STOPPED still owes
        // its liveness mark a clear when the run ends (R5).
        for (const t of new Set([
          ...stoppingThreads,
          ...stopNotConfirmed,
          ...harnessKickoffThreads,
        ])) {
          if (!next.has(t)) {
            clearStopStateForThread(t)
            refreshPhaseSpineAfterStop(t)
          }
        }
      },
    )
    return () => {
      unsubscribe()
      // Symmetric cleanup (Pattern S3): no timer may outlive the provider.
      for (const handle of stopTimersRef.current.values()) window.clearTimeout(handle)
      stopTimersRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ---- useEffect #3 (Phase 145-05, D-145-03/04/05, FND-01): inactivity watchdog ----
  // ONE shared setInterval (~5s) sweeps the streamingThreads set. For each thread
  // whose last stream event is older than the inactivity window N (~20s, reset on
  // every onCursor + streamingThreads add), fire a READ-ONLY getSnapshot probe —
  // the _isTransientStreamEnd-style active_runs check (:194-236), NOT the full
  // reconcile() action (which re-derives buckets + re-attaches; RESEARCH
  // anti-pattern). On a confirmed-terminal verdict, SILENTLY finalize (D-145-04):
  // delete the thread from streamingThreads (guarded by sendingThreadsRef —
  // Pitfall 1) AND flip the live placeholder's runStatus to "completed" via the
  // done→completed branch of the terminal-flip map (:1562 / :1873). No banner, no
  // "reconnecting" state. While still streaming it is a no-op (fixes the phantom
  // Stop with the tab open — U7). The watchdog only RECONCILES, never kills
  // (D-145-05); the authoritative kill of a dead producer is the backend sweep.
  // The visibility/focus belt (#2) now heals Direction A on tab-focus for free,
  // because reconcile() derives streamingThreads.
  useEffect(() => {
    const finalizeThreadSilently = (threadId: string, snapshot?: ThreadSnapshot) => {
      // Pitfall 1: never finalize a thread with an in-flight send.
      if (sendingThreadsRef.current.has(threadId)) return
      useStreamsStore.setState((s) => {
        if (!s.streamingThreads.has(threadId)) return {}
        const next = new Set(s.streamingThreads)
        next.delete(threadId)
        return { streamingThreads: next }
      })
      // Silent terminal-flip of the live placeholder(s). No runError / banner /
      // reconnecting copy (D-145-04). Per-thread only.
      //
      // WR-01 (Phase 145 review): derive the HONEST terminal status from the persisted
      // run_status the SAME getSnapshot already fetched (snapshot.messages, enriched via
      // _enrich_messages_with_runs) instead of hardcoding "completed". A run that
      // genuinely failed / was cancelled / timed out while its thread was backgrounded
      // must not be shown as a successful "completed" turn — that cuts against the
      // phase's lifecycle-honesty goal. Fall back to "completed" only when the persisted
      // status is unknown or still reads "streaming" (a snapshot inconsistency — we still
      // must not leave the placeholder live).
      useStreamsStore
        .getState()
        .actions.setMessagesForBucket("chat", threadId, (prev) =>
          prev.map((m) => {
            if (m.role !== "assistant" || m.runStatus !== "streaming") return m
            const persisted = snapshot?.messages.find((pm) => pm.runId === m.runId)
            const finalStatus =
              persisted?.runStatus && persisted.runStatus !== "streaming"
                ? persisted.runStatus
                : ("completed" as const)
            return { ...m, runStatus: finalStatus }
          }),
        )
      lastEventAtRef.current.delete(threadId)
    }

    const probeThread = async (threadId: string) => {
      let snapshot: ThreadSnapshot
      try {
        // READ-ONLY probe (reconcile-via-fetch, D-v2.5-03) — trust runs.status,
        // never the local flag.
        snapshot = await getSnapshot(threadId)
      } catch {
        // Fail-safe (mirrors _isTransientStreamEnd / reconciler Pitfall 6): never
        // finalize on an unverifiable read — the next tick / tab-focus retries.
        return
      }
      const stillStreaming = snapshot.active_runs.some((r) => r.status === "streaming")
      if (stillStreaming) {
        // No-op: refresh the clock so a long, legitimately-silent reasoning gap is
        // not re-probed on every tick (one cheap read, then quiet).
        lastEventAtRef.current.set(threadId, Date.now())
        return
      }
      // WR-01: pass the just-fetched snapshot so the finalize picks the HONEST persisted
      // terminal status (failed / cancelled / timed_out) instead of a blanket "completed".
      finalizeThreadSilently(threadId, snapshot)
    }

    const tick = () => {
      const streaming = useStreamsStore.getState().streamingThreads
      if (streaming.size === 0) return
      const now = Date.now()
      for (const threadId of streaming) {
        // A thread mid-send owns its own streaming-end write (send-path finally).
        if (sendingThreadsRef.current.has(threadId)) continue
        const last = lastEventAtRef.current.get(threadId) ?? 0
        if (now - last <= WATCHDOG_INACTIVITY_MS) continue
        // Stamp optimistically so a slow probe is not re-fired on the next tick.
        lastEventAtRef.current.set(threadId, now)
        void probeThread(threadId)
      }
    }

    const intervalId = setInterval(tick, WATCHDOG_TICK_MS)
    return () => clearInterval(intervalId)
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

  // ---- useEffect #5 (Phase 166 D-166-08): org-switch stream teardown ----
  // OrgProvider mounts ABOVE this provider (App.tsx / D-166-07), so an org switch is
  // observable here via useOrgOptional (null outside an OrgProvider → this effect is inert,
  // so the standalone StreamsProvider tests are byte-unchanged). On a REAL org change (not
  // the initial mount), tear down every in-flight subscription so no stale old-org SSE frame
  // repopulates a bucket, then clear the viewed thread's bucket in each active surface
  // THROUGH the existing 067.5-guarded `clearThreadBucket` action (its mid-stream-send
  // predicate at :1340 is preserved verbatim — a thread with a send in flight is NEVER
  // wiped). This is the SAME guarded action looped across surfaces; it is NOT a
  // new bucket-wipe path (G-5: minimal surface-area change in this hot file). The new org's
  // thread LIST is refetched by ChatLayout (Plan 05, keyed on the same activeOrgId); the
  // `X-Org-Id` header is already the new org synchronously (OrgProvider → setActiveOrgId), so
  // the isolation boundary is the server-validated fetch (D-v2.5-03: Realtime is best-effort,
  // never the boundary). We deliberately do NOT re-reconcile the stale viewed thread here — a
  // fetch of the OLD thread under the NEW header could re-populate old-org data; the user
  // reconciles to the new org by navigating the refetched list.
  const activeOrgId = useOrgOptional()?.activeOrgId ?? null
  const prevOrgRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const prev = prevOrgRef.current
    prevOrgRef.current = activeOrgId
    // Skip the initial mount (undefined → first value) and any no-op re-render: only an
    // actual SWITCH tears down.
    if (prev === undefined || prev === activeOrgId) return
    // 1) Tear down in-flight subscriptions AND their store mirrors IN LOCKSTEP (WR-02). A
    //    caller-initiated abort is a SILENT return in subscribeToRun (api.ts — an AbortError
    //    fires NO onTerminal), so the store mirrors that onTerminal would clean are never
    //    cleaned by the abort alone. Exactly like the enforceStreamPool evictor (:1204-1208),
    //    we must replicate the onTerminal remove pair ourselves: subscriptionsRef.delete +
    //    _removeRunFromThread. The pre-WR-02 teardown copied the UNMOUNT-cleanup shape
    //    (abort-all + subscriptionsRef.clear only) — fine on unmount (the whole store is
    //    discarded) but on a LIVE switch it left subscriptionsByThread holding stale old-org
    //    run ids AND streamingThreads holding the old-org thread, so the inactivity watchdog
    //    kept probing getSnapshot(oldThread) under the NEW X-Org-Id — a permanent phantom
    //    "streaming" state plus a wasted cross-org 404 every ~20s, forever.
    const byThread = useStreamsStore.getState().subscriptionsByThread
    for (const [ownerThreadId, runIds] of byThread) {
      for (const runId of runIds) {
        subscriptionsRef.current.get(runId)?.abort()
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
    // Belt-and-suspenders: abort + drop any controller NOT tracked in the per-thread mirror
    // so no in-flight subscription survives the switch (the unmount-cleanup guarantee).
    for (const ctrl of subscriptionsRef.current.values()) ctrl.abort()
    subscriptionsRef.current.clear()
    // Clear streamingThreads for the torn-down threads so the watchdog stops probing the old
    // org's threads. Guarded by sendingThreadsRef so a thread with a send IN FLIGHT is never
    // finalized here — the send-path finally owns its own streamingThreads.delete (the 067.5
    // per-thread contract; same guard predicate as clearThreadBucket at :1340).
    useStreamsStore.setState((s) => {
      const next = new Set(s.streamingThreads)
      for (const t of s.streamingThreads) if (!sendingThreadsRef.current.has(t)) next.delete(t)
      return { streamingThreads: next }
    })
    // 2) Clear each active surface's viewed-thread bucket THROUGH the existing guarded action.
    const actions = useStreamsStore.getState().actions
    for (const surface of useStreamsStore.getState().bucketsBySurface.keys()) {
      actions.clearThreadBucket(surface)
    }
  }, [activeOrgId])

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
    // BUG-260626-01 sibling: in the live/just-completed window the bucket holds
    // BOTH a `temp-…` placeholder and its persisted twin for the same runId.
    // Flat-mapping tool_calls across both double-counts the run (dedupToolCalls
    // can't merge them — the temp copy carries clientKey, the DB-reconstructed
    // copy doesn't), so the derived todos render each step twice. Collapse the
    // twin first with the SAME helper MessageList uses (keeps the persisted row).
    const allToolCalls = dedupMessagesByRunId(messages).flatMap((m) => m.tool_calls ?? [])
    if (!shouldPopulate(allToolCalls)) return EMPTY_DERIVED
    return deriveWorkspacePanel(allToolCalls)
  }, [threadId, messages])
}

/**
 * Phase 244-08 (T-244-05-05) — the ONE fetch that fills `workspaceFilesByThread`.
 *
 * ⛔ A NAMED MODULE-SCOPE FUNCTION, NOT AN INLINE ARROW. `usePanelReconcile` takes `fetcher`
 * into a `useCallback` dependency list; a new closure every render would re-run the reconcile
 * effect on every render, which is one fetch per keystroke on a thread with a live stream.
 *
 * ⚠ IT ASKS FOR EXPIRED ROWS ON PURPOSE. The slice feeds BOTH the panel and the transcript, and
 * the transcript must be able to say a file WAS attached after its TTL ran out — the
 * repudiation `T-244-05-05` names. The panel filters them back out in `useWorkspaceFiles`; the
 * bytes stay unreachable either way, because the content route keeps its own expiry gate.
 */
function fetchWorkspaceFilesIncludingExpired(
  threadId: string,
  signal?: AbortSignal,
): Promise<WorkspaceFile[]> {
  return getThreadWorkspaceFiles(threadId, signal, { includeExpired: true })
}

/**
 * Is this row past its TTL? ⚠ DERIVED FROM `expires_at`, never from a server-supplied flag —
 * the same rule `chatAttachmentState` uses for the chip, stated once per layer rather than
 * invented twice. A NULL expiry (every agent-written file) is never expired.
 *
 * ⚠ AN UNPARSEABLE DATE IS NOT EXPIRED. `NaN <= Date.now()` is false, and that is the polarity
 * we want: a row we cannot read the expiry of keeps showing in the panel rather than silently
 * disappearing from it. `expiryCaption` made the same call for the same reason (199 CR WR-02).
 */
function isExpiredFile(f: WorkspaceFile): boolean {
  if (!f.expires_at) return false
  const at = new Date(f.expires_at).getTime()
  return !Number.isNaN(at) && at <= Date.now()
}

export function useWorkspaceFiles(threadId: string | null): {
  data: WorkspaceFile[]
  isLoading: boolean
  error: Error | null
  reconcile: () => Promise<void>
} {
  const all = useStreamsStore((s) =>
    threadId ? (s.workspaceFilesByThread.get(threadId) ?? EMPTY_FILES) : EMPTY_FILES,
  )
  // ⭐ Phase 244-08 (T-244-05-05) — THE PANEL FILTERS; THE SLICE CARRIES EVERYTHING.
  //
  // The slice now holds expired rows, because the TRANSCRIPT needs them: an attachment past
  // its TTL must still be nameable in an old conversation (`No longer available`) instead of
  // silently vanishing. The PANEL has no honest use for one — it offers a preview, and the
  // per-file content route still refuses an expired row (404) — so a listed tombstone here is
  // a broken affordance. One slice, two readers, and the reader that cares decides.
  //
  // ⚠ MEMOISED ON THE SLICE, NOT FILTERED INSIDE THE SELECTOR. A `.filter()` in the
  // `useStreamsStore` selector mints a new array every render, and `useSyncExternalStore`
  // compares by identity — every stream delta would re-render `FilesSection` and
  // `WorkspacePanel`, which is the PANEL-06 isolation this file is built around. The slice is
  // replaced wholesale (never mutated), so its identity is a sound memo key. Fenced by case 5
  // of `providers/__tests__/expiredAttachmentTombstone.test.tsx`.
  const data = useMemo(
    () => (all.some(isExpiredFile) ? all.filter((f) => !isExpiredFile(f)) : all),
    [all],
  )
  const replace = useStreamsStore((s) => s.actions.replaceWorkspaceFilesForThread)
  const { isLoading, error, reconcile } = usePanelReconcile<WorkspaceFile>({
    threadId,
    hookId: "files",
    fetcher: fetchWorkspaceFilesIncludingExpired,
    replace,
  })
  return { data, isLoading, error, reconcile }
}

/**
 * Phase 244 (244-05 T3 / SHELL-04) — A PURE READ of a thread's workspace files. NO FETCH.
 *
 * ⛔ `useWorkspaceFiles` above cannot be used here and the reason is a real cost, not a style
 * preference: it runs `usePanelReconcile`, which FETCHES. `MessageItem` is rendered once per
 * message, so calling it from a transcript row would fire one reconcile per row — N fetches for
 * an N-message thread, on every mount. This selector reads the same slice the panel already
 * reconciles into and adds no traffic at all.
 *
 * ⚠ It is a named hook rather than a raw `useStreamsStore` call at the consumer, because D-068-03
 * makes the store an implementation detail: external callers go through this layer. The selector
 * returns the SAME array identity until the slice is replaced wholesale (the store never mutates
 * in place), so a `memo`'d consumer does not re-render on unrelated stream traffic.
 */
export function useWorkspaceFilesSnapshot(threadId: string | null): WorkspaceFile[] {
  return useStreamsStore((s) =>
    threadId ? (s.workspaceFilesByThread.get(threadId) ?? EMPTY_FILES) : EMPTY_FILES,
  )
}

/**
 * Phase 244 (244-05 T3) — the `created_at` of the TWO user messages immediately preceding
 * `messageId`, most-recent first, joined by `|`. Either side may be empty.
 *
 * ⛔ A STRING, NOT AN OBJECT OR AN ARRAY, AND THAT IS LOAD-BEARING. A zustand selector compares
 * with `Object.is`, so returning `{ lower, upper }` or `[a, b]` builds a fresh identity on EVERY
 * store write and re-renders the consumer on every stream delta — the precise cost
 * `MessageItem`'s `React.memo` (075.4-04) exists to avoid. A joined string compares by value.
 *
 * ⛔ WHY NOT THE MESSAGE LIST. Same reason, one step further: handing a transcript row the
 * messages ARRAY — as a prop or as a selector result — reinstates the per-delta re-render for
 * every row in the thread. ⛔ And not a PROP either: threading it from `MessageList` would put
 * the association rule in the list's render path and create a second place that has to agree
 * about it.
 *
 * TWO values rather than one because both callers need a WINDOW: a user row bounds
 * `(previous user turn, itself]`, and an assistant row bounds `(the turn before that, the turn it
 * answers]`. One selector, one pass, one stable value.
 */
export function usePrecedingUserTurns(
  threadId: string | null,
  messageId: string,
  surfaceId: SurfaceId = "chat",
): string {
  return useStreamsStore((s) => {
    if (!threadId) return "|"
    const msgs = s.bucketsBySurface.get(surfaceId)?.get(threadId)
    if (!msgs) return "|"
    let prev = ""
    let prevPrev = ""
    for (const m of msgs) {
      if (m.id === messageId) break
      if (m.role === "user") {
        prevPrev = prev
        prev = m.created_at
      }
    }
    return `${prev}|${prevPrev}`
  })
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
// Phase 188 Plan 05 (SPEC Req 8 / D-188-02): the Phase-098-UAT `DB_PHASE_STATUS` map
// MOVED to `@/lib/phaseState` — verbatim, with its provenance comment — and this file
// now imports `phaseStatusFromDb` instead. The map is unchanged; only its address is.

/**
 * Phase 194.1 UAT issue 6 — REFRESH THE PHASE SPINE WHEN A RUN LEAVES STREAMING.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT, and it was a MISSING TRIGGER rather than a wrong status
 * ─────────────────────────────────────────────────────────────────────────────
 * Driven by the operator on 2026-08-16: after a Stop, the chat read
 * `⊘ Stopped by you` while the workspace panel went on reading
 * `gather-usage — Running` / `● Working` indefinitely. Two surfaces of one app
 * disagreeing about whether a run was going.
 *
 * Both ends of the wire were already correct and that was MEASURED, not assumed:
 * Phase 194's `cancel_active_phases` writes `cancelled`, and `DB_PHASE_STATUS`
 * maps it to its own client member (`lib/phaseState.ts`, the 7th literal, added
 * by migration 119). What was missing is that **nothing re-read it**.
 * `usePanelReconcile`'s refresh effect is keyed on `[threadId]` ONLY — its own
 * docblock says *"fires ONLY on thread-switch + the manual `reconcile()` escape
 * hatch"* — and a cancel TEARS DOWN THE SSE STREAM, so no terminal phase event
 * arrives either. The panel simply kept the last thing it had heard.
 *
 * ⚠ The diagnosis was confirmed by a DISCRIMINATING PREDICTION made before the
 * row was driven: *"if this is right, navigating away and back will show the
 * panel correcting itself."* It did — `gather-usage — Stopped`, `■ Stopped`.
 * Same state, same data; the only difference was a trigger firing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT LIVES IN THE STOPPING-CLEAR SUBSCRIPTION AND NOWHERE ELSE
 * ─────────────────────────────────────────────────────────────────────────────
 * The loop above already walks exactly the threads that need this — the union of
 * `stoppingThreads ∪ stopNotConfirmed ∪ harnessKickoffThreads` — at exactly the
 * moment they leave `streamingThreads`, and it does so over the SLICE every one
 * of the four exit routes writes (see effect #1b's docblock). A run that ends
 * NORMALLY is not in that union and does not need this: its `phase_completed`
 * SSE already updated the store. **So the refresh is scoped to the runs whose
 * terminal events went missing, which is precisely the defect.**
 *
 * ⚠ SCOPED TO THE VIEWED THREAD ON PURPOSE. A background thread's panel is not
 * on screen, and the shipped thread-switch reconcile refreshes it the moment it
 * becomes visible — so fetching for it would be work nobody can see.
 *
 * ⚠ THIS DOES NOT TOUCH THE TERMINAL READING, and effect #1b's L-01 boundary
 * still binds unchanged. This re-reads `workflow_phases` from the server; it does
 * not suppress, delay or rewrite what the run says about itself. When L-01 fires
 * — a producer on the other worker writing `completed` over the cancel — this
 * will surface the phase as `cancelled` beside a `✓ Complete` run, which is the
 * disagreement HONESTLY RENDERED and must not be smoothed over.
 *
 * ⚠ BEST-EFFORT BY CONTRACT, and the honest limit is stated rather than implied:
 * the server write and this read are not ordered with respect to each other, so a
 * refetch that loses the race reads the pre-cancel row. The shipped
 * thread-switch reconcile remains the backstop it always was — this makes the
 * common case right, it does not make the read authoritative. A failure is
 * swallowed for the same reason: the panel was already stale, and a rejected
 * background fetch must never surface as an error the user cannot act on.
 *
 * ⚠ SECOND CALLER SINCE 244-15 (G-8): the `releaseSettledWorkflowLock` settle path calls it
 * on the release arm, after the server has confirmed the thread's workflow anchor is gone.
 * THE CONTRACT IS UNCHANGED — viewed-thread-scoped, best-effort, swallow-on-failure — and it
 * is named here rather than left for the next reader to discover. There is deliberately no
 * second phase-spine refresher and no rename: one concern, one home.
 */
function refreshPhaseSpineAfterStop(threadId: string): void {
  if (useStreamsStore.getState().viewedThreadId !== threadId) return
  void reconcilePhases(threadId)
    .then((phases) => {
      // Re-check: the user may have navigated away during the fetch, and the
      // thread they moved TO has already reconciled itself on the switch.
      if (useStreamsStore.getState().viewedThreadId !== threadId) return
      useStreamsStore.getState().actions.replacePhasesForThread(threadId, phases)
    })
    .catch((err) => {
      console.warn("[StreamsProvider] phase-spine refresh after stop failed", err)
    })
}

async function reconcilePhases(threadId: string, signal?: AbortSignal): Promise<Phase[]> {
  const wf = await getThreadWorkflow(threadId, signal)
  // Live/ACTIVE harness run → the forward-only skeleton floor: total_phases rows, the
  // current one running, with the REAL step identity overlaid from `wf.phases`.
  //
  // Phase 188 Plan 04 (RUNVIZ-01 / D-188-22) — BUG-260609-04 closed at its root. This
  // comment used to read "slugs are unknown ahead of live phase_started, so non-current
  // rows carry positional placeholders the live events replace". THAT PREMISE IS FALSE,
  // and it is measured, not argued: `create_workflow_run`
  // (`backend/app/db/workflows.py:206-214`) inserts EVERY `workflow_phases` row at run
  // CREATION, all `pending`, inside one transaction — and it is the ONLY
  // `INSERT INTO workflow_phases` anywhere in `backend/app`. `GET /threads/{id}/workflow`
  // resolves `phases_source_run_id = active_workflow_run_id` FIRST, so `slug`,
  // `phase_index`, `status` and `phase_type` arrive for every position of a LIVE run too.
  // The real names were always on the wire; this branch was discarding them and painting
  // `phase-0` at the operator (the exact render the bug report screenshotted).
  //
  // The overlay is therefore COMPLETE, not partial. D-188-22's hedge — "keep the
  // total_phases floor for rows the harness has not inserted yet" — describes a case that
  // cannot occur. `total_phases` stays the array length as defence in depth ONLY; it is
  // not load-bearing (it equals `len(phases)` whenever the anchor is set,
  // `threads.py:1100-1101`). The `?? placeholder` tails below are kept for the same
  // reason, and are exercised by a positive control rather than assumed.
  //
  // THE JOIN KEY IS `phase_index`, NEVER the slug: the very value this branch can emit as
  // a placeholder cannot also be the key that repairs it. Same reasoning as the
  // BUG-260609-01 by-INDEX sweep above. (188-04 read `byIndex.get(i)` twice rather than
  // hoisting it, specifically so the status line stayed byte-identical in that diff. CR-06
  // changes the status line, so that reason has expired and the lookup is hoisted.)
  //
  // STATUS IS NOT OVERLAID WHOLESALE — the identity overlay carries `slug` and
  // `phaseType`, and the positional derivation remains a FORWARD-ONLY floor. Overlaying
  // status wholesale is the regression 188-04 refused: the derivation is in some cases
  // MORE advanced than the rows, and a lagging row would drag `PhaseTimeline`'s shipped
  // counter (`PhaseTimeline.tsx:115-127`) backward — strictly worse than the cosmetic
  // defect being closed (T-188-04-01). The floor guard in
  // `panel/__tests__/PhaseReconcile.test.tsx` fences that, with a fixture holding every DB
  // row at `pending` while the counter has already advanced.
  //
  // ⚠ CR-06 (Phase 188 review) — BUT THE FLOOR MAY ONLY ADVANCE AN *UNRESOLVED* ROW.
  // Plan 02 narrowed `finalizeAllPhasesForThread` because "on any skip-bearing workflow
  // this sweep painted a step that NEVER RAN as Complete, while a reconcile rebuilt from
  // those same rows restored 'Not started': the live view and the reload disagreed —
  // precisely what Req 4 forbids." The identical fail-open survived one function away, in
  // this branch's own `i < current ? "done"`.
  //
  // Measured, not argued: `harness_engine.py`'s skip branch calls `skip_phase(pool,
  // phase_id)` (the row becomes `skipped`) and then `i = target_i; continue`, so every row
  // between it and the target keeps `pending` and nothing revisits them. And
  // `advance_current_phase` is called at ONE site, AFTER `complete_phase`/`fail_phase`,
  // and NOT on the skip branch — so the cursor can be parked ON the skipped row (which
  // painted it `running`: a jumped-over step reported as executing right now) or already
  // past it (which painted it `done`). Both were wrong; a reload restored `Skipped` for
  // both.
  //
  // THE RULE, stated once: a DB row the engine has already RESOLVED — `done`, `failed`,
  // `skipped`, or a status this client cannot name — is a terminal truth the positional
  // counter must not overwrite. Only an UNRESOLVED row (`pending` / `active`, i.e. the lag
  // the floor exists for) takes the positional value. That keeps the floor forward-only
  // (the guard fixture is all-`pending`, so it is untouched) while making the live view
  // agree with the reload it will be replaced by. `unknown` is included for Req 3's
  // reason one level up: a status we cannot name may never be upgraded to success.
  if (wf.mode === "harness" && !wf.lock_is_stale) {
    const total = wf.total_phases ?? 0
    if (total <= 0) return []
    const current = wf.current_phase_index ?? 0
    const byIndex = new Map<number, WorkflowPhaseState>(
      (wf.phases ?? []).map((r) => [r.phase_index, r]),
    )
    return Array.from({ length: total }, (_, i): Phase => {
      const row = byIndex.get(i)
      const positional: Phase["status"] =
        i < current ? "done" : i === current ? "running" : "pending"
      const db = row ? phaseStatusFromDb(row.status) : undefined
      // `pending` / `running` are the UNRESOLVED readings — those, and only those, defer
      // to the floor. Everything else is a resolution the engine already wrote down.
      const resolved = db != null && db !== "pending" && db !== "running"
      // ⚠ F2 (UAT 2026-08-05) — AND THE FLOOR MAY NEVER UPGRADE AN EARLIER ROW TO `done`.
      //
      // CR-06 taught the floor to respect a RESOLVED row. It did not cover the rows a skip
      // leaves BEHIND: `harness_engine.py` jumps `i = target_i` and every row in between
      // keeps `pending` forever, unresolved, with the cursor now past it. Those took the
      // positional value and read `done` — a step that never ran, reported Complete. That is
      // SPEC failure #2, and Req 3's rule in one line: success may never be inferred from the
      // ABSENCE of an event, and a `pending` row before the cursor is exactly that absence.
      //
      // It is also Req 4, measured: `reconcilePhases` picks between two derivations on
      // `wf.lock_is_stale`, and that flag was observed `true` on a run still `active` (an
      // `llm_human_input` phase ends its producer run while the workflow run continues). So
      // the same rows read `done` early and `Not started` later — the reading changed with no
      // state change behind it. The two branches now agree by construction.
      //
      // The floor keeps its actual job: advancing the CURRENT row to `running` ahead of the
      // DB write. What it loses is the right to call an earlier unresolved row finished. The
      // cost is a sub-second lag in the ordinary case (a row completed but not yet written
      // reads `running` rather than `done`, and self-corrects on the next poll) — the correct
      // trade against claiming a success that never happened. The Phase-094 counter guard is
      // untouched: that floor is over `current_phase_index`, not over these statuses.
      const floored: Phase["status"] = i < current && db != null ? db : positional
      return {
        slug:
          row?.slug ??
          (i === current ? (wf.current_phase_slug ?? `phase-${i}`) : `phase-${i}`),
        phaseIndex: i,
        phaseType: row?.phase_type ?? "unknown",
        status: resolved ? db : floored,
        subAgents: [],
        pendingAsk: null,
        // ── 214 (STEP-04 / STEP-05 / D-214-23) — the step's identity and its failure reason.
        // ⚠ ADDED KEYS ONLY. This literal is deliberately field-by-field and must NOT become a
        // spread of `row`: the wire's own spellings (`phase_index`, `status`) would land on a
        // `Phase` and break the status arithmetic the F2 / CR-06 comment above protects.
        // ⚠ `row` is `undefined` for a filler index the server sent no row for, so those get
        // `undefined` for all four — correctly. An absent identity is a fact, not a value to
        // invent. (The four status-arithmetic identifiers above are deliberately NOT named in
        // this comment: the plan's acceptance criterion greps the diff for them to prove no
        // status logic moved, and prose quoting one would fail the check it exists to pass —
        // measured here, on the first run of that grep.)
        failureReason: row?.failure_reason,
        toolName: row?.tool_name,
        capability: row?.capability,
        serviceName: row?.service_name,
      }
    })
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
      phaseType: r.phase_type ?? "unknown",
      // Phase 188 Plan 02 (RUNVIZ-02 / Req 3 / D-188-08): the fallback below WAS the
      // literal `done` — an unrecognised server status READ AS SUCCESS. (Spelled that
      // way here on purpose: a grep for the old fallback token must return zero over
      // this file, and a comment quoting it would keep the guard vacuous — 187-24.)
      // Every DB value is mapped
      // today, which is exactly the argument under which the publish gauntlet shipped
      // its `findIndex → -1` fail-open and painted an unknown `blocked_stage` as 8/8
      // green. Third occurrence of the same lesson: fail CLOSED on a state we cannot
      // name. Falsified first (`panel/__tests__/PhaseReconcile.test.tsx`, RED observed
      // on unmodified source), with a positive control that `completed` still maps.
      //
      // Phase 188 Plan 05: the map lookup AND its fallback moved bodily into the total
      // `phaseStatusFromDb` (`lib/phaseState.ts`). That is the point of the extraction
      // — a fallback at each call site is a fallback that can be got wrong at each
      // call site; there is now exactly one.
      status: phaseStatusFromDb(r.status),
      subAgents: [],
      pendingAsk: null,
      // ── 214 (STEP-04 / STEP-05 / D-214-23) — THE SECOND LITERAL, mapped in the SAME commit.
      // ⚠ TWO BRANCHES, TWO LITERALS, AND NEITHER USES A SPREAD. Widening one alone is the
      // identical defect one branch over, and it would typecheck: an unmapped field is
      // structurally `undefined` on every panel surface forever. Both branches are asserted
      // separately in `panel/__tests__/PhaseReconcile.test.tsx`, and a structural fence there
      // requires these two literals to declare the SAME key set — which is what catches the
      // NEXT field rather than only these four.
      failureReason: r.failure_reason,
      toolName: r.tool_name,
      capability: r.capability,
      serviceName: r.service_name,
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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 194.1 Plan 03 (R1 / R2 / R5 — D-05 / D-06 / D-07) — the stopping readers.
//
// Appended BELOW the shipped selectors per the :3601-3603 convention ("additions
// go BELOW (alphabetical) so the existing 4 stay grep-stable"), alphabetical
// among themselves.
//
// ⚠ ALL THREE RETURN A PRIMITIVE, and that is a correctness property rather than
// a taste one. Zustand's default equality is `Object.is`; a selector returning a
// fresh object or a Set re-renders EVERY subscriber on every unrelated store
// write (`:3293` records that churn hazard by name). A boolean re-renders only
// the mount whose value actually flipped — which is what makes four Stop mounts
// on one thread cheap.
// ─────────────────────────────────────────────────────────────────────────────

/** True when a harness run is LIVE for this thread — by either of the two
 *  readings, which cover different windows and neither is sufficient alone:
 *
 *   - `harnessKickoffThreads` is stamped SYNCHRONOUSLY at kickoff (R5), so it
 *     covers the round trip BEFORE the lock is seeded (`:1981`, which needs
 *     `run_id` back from the POST).
 *   - `workflowLockByThread` covers a run REJOINED by the mount reconcile after
 *     navigation, where no kickoff happened in this session at all.
 *
 *  ⚠ Returns a BOOLEAN, never the lock object. Handing back the record would
 *  both leak the `WorkflowLock.runId` two-id landmine (see its JSDoc in
 *  `streamsStore.ts`) to callers that have no business resolving ids, and give
 *  every consumer an object-identity dependency this selector does not need. */
/** ⛔ CORRECTED BY PHASE 244-13 (UAT gap G-1) — THE SECOND DISJUNCT WAS A PRESENCE TEST,
 *  AND IT BECAME WRONG WITHOUT THIS FILE BEING TOUCHED. The original read:
 *
 *      s.harnessKickoffThreads.has(threadId) || s.workflowLockByThread.has(threadId)
 *
 *  i.e. it treated ANY non-null lock as *"a harness run is live"*. That was TRUE for as
 *  long as the lock was harness-only — and `244-03` made the SERVER populate the lock for a
 *  cap-paused DEEP run (`threads.py:1237-1276`). A server change reached a client consumer
 *  written against the old invariant, and the result was measured on screen: a live
 *  `data-run-line-state="live"` receipt reading the harness activity string, 41px under an
 *  amber card saying the run was stopped, on a thread that has never had a workflow — plus
 *  a 1s `setInterval` clock (`ThreadRunLine.tsx:243-249`) ticking for it.
 *
 *  ⛔ The test is now on the lock's MODE, which says what the lock IS (see `WorkflowLock`'s
 *  own JSDoc in `streamsStore.ts`). `harnessKickoffThreads` is UNCHANGED and still
 *  load-bearing — it covers the synchronous pre-lock kickoff window. */
export const useHarnessLiveForThread = (threadId: string | null): boolean =>
  useStreamsStore((s) =>
    threadId
      ? s.harnessKickoffThreads.has(threadId) ||
        s.workflowLockByThread.get(threadId)?.mode === "harness"
      : false,
  )

/** True when this thread's stop passed the 8s window with no terminal (R2). The
 *  Stop control is pressable again alongside this reading — the climb-down is the
 *  ONLY route back to a pressable Stop (sketch 168-B's losing arm, load-bearing). */
export const useStopNotConfirmedForThread = (threadId: string | null): boolean =>
  useStreamsStore((s) => (threadId ? s.stopNotConfirmed.has(threadId) : false))

/** True from the synchronous instant Stop is pressed until the run reaches a
 *  terminal by ANY route, or the 8s window expires (R1 + R2). */
export const useStoppingForThread = (threadId: string | null): boolean =>
  useStreamsStore((s) => (threadId ? s.stoppingThreads.has(threadId) : false))
