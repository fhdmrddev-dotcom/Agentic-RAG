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
 *           (RESEARCH §Finding #7). Deltas route to streamingThreadIdRef's
 *           bucket regardless of viewing thread.
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
import { useEffect, useRef, type PropsWithChildren, type MutableRefObject } from "react"
import type {
  Message,
  ToolCall,
  OutputFile,
  SourceReference,
  Citation,
} from "@/types"
import {
  getMessages,
  postMessage,
  subscribeToRun,
  getActiveRuns,
  getSnapshot,
  cancelRun,
  type StreamCallbacks,
  type ThreadSnapshot,
} from "@/lib/api"
import {
  useStreamsStore,
  type SurfaceId,
  type StreamsState,
} from "@/stores/streamsStore"
import { makeThrottle } from "@/lib/throttle"
import { writeSnapshotToLocalStorage } from "@/lib/streamsCache"
import { makeToolKey } from "@/lib/toolKey"

// RESEARCH §Finding #1: module-level constant gives every empty-bucket subscriber
// the SAME reference, so React/useSyncExternalStore skips re-render when the
// selector result is shallow-equal across stores.
const EMPTY_ARRAY: Message[] = []

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
  onTitleUpdate?: (title: string) => void
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
    onTitleUpdate,
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
    onSubAgentStart: (filename, task) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, sub_agent: { filename, task, content: "", status: "running" } }
            : m,
        ),
      )
    },
    onSubAgentDelta: (text) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId || !m.sub_agent) return m
          return { ...m, sub_agent: { ...m.sub_agent, content: m.sub_agent.content + text } }
        }),
      )
    },
    onSubAgentDone: () => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId || !m.sub_agent) return m
          return { ...m, sub_agent: { ...m.sub_agent, status: "done" } }
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
    onFinalOutputFiles: (files: { filename: string; url?: string }[]) => {
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

export function StreamsProvider({ children }: PropsWithChildren) {
  // ---- Provider-scoped refs (D-068-01: handles, not display state) ----
  // Lifted VERBATIM from useMessages.ts:417-447 shape (single source of truth
  // for in-flight handles).
  const subscriptionsRef = useRef<Map<string, AbortController>>(new Map())
  const lastSeenOffsetRef = useRef<Map<string, string>>(new Map())
  const reconcileInFlightRef = useRef(false)
  const streamingThreadIdRef = useRef<string | null>(null)
  const activeThreadIdRef = useRef<string | null>(null)
  // Phase 068 (Task 2a): additional refs lifted from useMessages.ts for sendMessage.
  const isSendingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const loadAbortRef = useRef<AbortController | null>(null)
  const stoppedByUserRef = useRef(false)
  const resumeInFlightRef = useRef(false)

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
          if (tid && tid !== streamingThreadIdRef.current) {
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
              const sendInFlightOnThisThread =
                isSendingRef.current && streamingThreadIdRef.current === threadId
              const liveTempPlaceholders = prev.filter((m) => {
                if (!m.id.startsWith("temp-")) return false
                if (m.runId) {
                  return !dbRunIds.has(m.runId) || subscriptionsRef.current.has(m.runId)
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
          } finally {
            // Phase 063.1 (D-063.1-11 / Gap-005): ALWAYS reset in finally.
            reconcileInFlightRef.current = false
          }
        },

        // Phase 068 (L-068-04 + L-068-07): bucket-routing on streaming
        // thread; cleanup on onTerminal. Source: useMessages.ts:673-939.
        sendMessage: async (threadId, content, opts) => {
          const surfaceId: SurfaceId = opts?.surfaceId ?? "chat"
          if (isSendingRef.current) return
          isSendingRef.current = true
          streamingThreadIdRef.current = threadId

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
            const { message_id, run_id } = await postMessage(threadId, content, {
              model: opts?.model,
              provider: opts?.provider,
              agentMode: opts?.agentMode,
            })
            registeredRunId = run_id

            // D-067-01: reserve subscription slot BEFORE the runId-stamping setMessages.
            // L-068-07 (open side): track in subscriptionsByThread mirror.
            // Plan 075.4-01 D-075.4-A1: per-thread subscriptionsByThread.
            subscriptionsRef.current.set(run_id, controller)
            useStreamsStore.setState((s) => ({
              subscriptionsByThread: _addRunToThread(s.subscriptionsByThread, threadId, run_id),
            }))

            // WR-04 fix: swap temp user id for real, stamp run_id on assistant placeholder.
            useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
              prev.map((m) => {
                if (m.id === userMsg.id) return { ...m, id: message_id }
                if (m.id === assistantId) return { ...m, runId: run_id }
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

            await subscribeToRun(run_id, "0", callbacks, controller.signal)
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
              // Caller-initiated abort.
            } else {
              console.error("sendMessage failed:", err)
              useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, runStatus: "failed" } : m,
                ),
              )
            }
          } finally {
            abortControllerRef.current = null
            isSendingRef.current = false
            streamingThreadIdRef.current = null
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
          // Pitfall 3: derive run_id from streaming bucket (or fall back to
          // viewing bucket). RESEARCH §Pattern 5: read via getState().
          const stid = streamingThreadIdRef.current ?? activeThreadIdRef.current
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
              // Phase 068.5 Gap-02: scope to streamingThreadIdRef so cross-thread
              // cold-load reconciles (A streaming, user clicks unvisited D) merge
              // into the target bucket instead of bailing globally and leaving
              // MessageSkeleton stuck. The un-stamped placeholder window is
              // bounded to the sending thread, so this guard only matters there.
              if (isSendingRef.current && streamingThreadIdRef.current === threadId) return
              // L-068-06 / L-068.5-02: MERGE 3-clause filter preserves live in-flight
              // temp placeholders. Predicate (BYTE-IDENTICAL from useMessages.ts:644-649):
              //   m.id.startsWith('temp-') && m.runId && !dbRunIds.has(m.runId)
              useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => {
                const dbRunIds = new Set(data.filter((m) => m.runId).map((m) => m.runId))
                const liveTempPlaceholders = prev.filter(
                  (m) =>
                    m.id.startsWith("temp-") &&
                    m.runId &&
                    // Keep when DB doesn't have this runId yet OR a live SSE
                    // consumer is still bound via this runId (CR-01 fix).
                    (!dbRunIds.has(m.runId) || subscriptionsRef.current.has(m.runId)),
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
      const streamingTid = streamingThreadIdRef.current
      const activeTid = activeThreadIdRef.current
      // If neither ref points anywhere (early-render), skip persistence — nothing
      // meaningful to cache yet. The hydrate path at mount still works because
      // it reads the existing snapshot before any write fires.
      if (!streamingTid && !activeTid) return
      writeSnapshotToLocalStorage(state.bucketsBySurface, Date.now(), (_surface, tid) =>
        tid === streamingTid || tid === activeTid,
      )
    }
    const throttledWrite = makeThrottle(writeNow, 500)
    throttledWriteRef.current = throttledWrite
    // B-02 fix: selector-bound subscription — only fires when bucketsBySurface
    // reference changes, NOT on every reconcileErrors / streamingThreads /
    // subscriptionsByThread / loadingThreads / viewedThreadId / fallbackNotices
    // setState. Avoids wasted serialization on bookkeeping state.
    // (Plan 075.4-01 D-075.4-A1: comment updated for per-thread field names.)
    // Requires `subscribeWithSelector` middleware in the store factory.
    const unsubscribe = useStreamsStore.subscribe(
      (state) => state.bucketsBySurface,
      () => {
        throttledWrite(useStreamsStore.getState())
      },
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

export const useLoadingForThread = (threadId: string | null): boolean =>
  useStreamsStore((s) => (threadId ? s.loadingThreads.has(threadId) : false))

export const useReconcileErrorForThread = (threadId: string | null): Error | null =>
  useStreamsStore((s) => (threadId ? (s.reconcileErrors.get(threadId) ?? null) : null))

export const useFallbackNoticeForThread = (threadId: string | null): string | null =>
  useStreamsStore((s) => (threadId ? (s.fallbackNotices.get(threadId) ?? null) : null))
