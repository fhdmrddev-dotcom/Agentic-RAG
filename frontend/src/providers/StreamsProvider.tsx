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
import { useEffect, useRef, type PropsWithChildren } from "react"
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

// RESEARCH §Finding #1: module-level constant gives every empty-bucket subscriber
// the SAME reference, so React/useSyncExternalStore skips re-render when the
// selector result is shallow-equal across stores.
const EMPTY_ARRAY: Message[] = []

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

function makeStreamCallbacks(opts: {
  assistantId: string
  threadId: string
  onTitleUpdate?: (title: string) => void
  setMessages: ThreadBoundSetMessages
}): StreamCallbacks {
  const { assistantId, onTitleUpdate, setMessages } = opts
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
          const preparingId = `preparing-${index}`
          const alreadyPreparing = (m.tool_calls ?? []).some((tc) => tc.id === preparingId)
          if (alreadyPreparing) return m
          const preparingEntry: ToolCall = {
            id: preparingId,
            name,
            args: {},
            status: "preparing",
            startedAt: undefined,
            iteration: currentIteration,
          }
          return { ...m, isPlanning: false, tool_calls: [...(m.tool_calls ?? []), preparingEntry] }
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
                  }
                : tc,
            )
          } else {
            updatedCalls = [
              ...existingCalls,
              {
                id: `running-${Date.now()}`,
                name,
                args,
                status: "running" as const,
                startedAt: Date.now(),
                iteration: currentIteration,
              },
            ]
          }
          return { ...m, isPlanning: false, tool_calls: updatedCalls }
        }),
      )
    },
    onToolEnd: (name, result) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          const updated = (m.tool_calls ?? []).map((tc) =>
            tc.name === name && tc.status === "running"
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
      useStreamsStore.setState({
        fallbackNotice: `Model ${original} unavailable — using ${fallback}.`,
      })
      setTimeout(() => useStreamsStore.setState({ fallbackNotice: null }), 4000)
    },
  }
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
                isStreaming: false,
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

            // Hydrate messages bucket — same MERGE 3-clause filter as
            // loadMessages used so live in-flight temp placeholders are
            // preserved across the swap (L-068-06 / L-068.5-02 carryover).
            // Predicate is byte-identical to loadMessages's filter.
            useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => {
              const dbRunIds = new Set(snapshot.messages.filter((m) => m.runId).map((m) => m.runId))
              const liveTempPlaceholders = prev.filter(
                (m) =>
                  m.id.startsWith("temp-") &&
                  m.runId &&
                  (!dbRunIds.has(m.runId) || subscriptionsRef.current.has(m.runId)),
              )
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
              useStreamsStore.setState((s) => ({
                subscriptionsByRunId: new Set(s.subscriptionsByRunId).add(run.run_id),
              }))

              const callbacks: StreamCallbacks = makeStreamCallbacks({
                assistantId: targetId,
                threadId,
                setMessages: setMessagesForBucketBound(surfaceId, threadId),
              })
              const originalOnTerminal = callbacks.onTerminal
              callbacks.onTerminal = (kind, errorPayload) => {
                useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => {
                  if (!prev.some((m) => m.id === targetId)) return prev
                  return prev.map((m) => {
                    if (m.id !== targetId) return m
                    if (kind === "done") return { ...m, runStatus: "completed" }
                    if (kind === "error") return { ...m, runStatus: "failed" }
                    if (kind === "timed_out") return { ...m, runStatus: "timed_out" }
                    // kind === "cancelled"
                    return { ...m, runStatus: "cancelled" }
                  })
                })
                // L-068-07: cleanup on onTerminal (BL-03 fix).
                subscriptionsRef.current.delete(run.run_id)
                useStreamsStore.setState((s) => {
                  const next = new Set(s.subscriptionsByRunId)
                  next.delete(run.run_id)
                  return { subscriptionsByRunId: next }
                })
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
                  if (subscriptionsRef.current.has(run.run_id)) {
                    subscriptionsRef.current.delete(run.run_id)
                    useStreamsStore.setState((s) => {
                      const next = new Set(s.subscriptionsByRunId)
                      next.delete(run.run_id)
                      return { subscriptionsByRunId: next }
                    })
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
          useStreamsStore.setState({ isStreaming: true })

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
            // L-068-07 (open side): track in subscriptionsByRunId mirror.
            subscriptionsRef.current.set(run_id, controller)
            useStreamsStore.setState((s) => ({
              subscriptionsByRunId: new Set(s.subscriptionsByRunId).add(run_id),
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
            callbacks.onTerminal = (kind, errorPayload) => {
              useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) => {
                if (!prev.some((m) => m.id === assistantId)) return prev
                return prev.map((m) => {
                  if (m.id !== assistantId) return m
                  if (kind === "done") return { ...m, runStatus: "completed" }
                  if (kind === "error") return { ...m, runStatus: "failed" }
                  if (kind === "timed_out") return { ...m, runStatus: "timed_out", stopped: true }
                  // kind === "cancelled"
                  return { ...m, runStatus: "cancelled", stopped: true }
                })
              })
              // L-068-07: BL-03 fix — subscriptionsRef cleanup belongs in
              // onTerminal, NOT the finally chain. Mirror updates alongside.
              if (registeredRunId) {
                subscriptionsRef.current.delete(registeredRunId)
                const runIdToRemove = registeredRunId
                useStreamsStore.setState((s) => {
                  const next = new Set(s.subscriptionsByRunId)
                  next.delete(runIdToRemove)
                  return { subscriptionsByRunId: next }
                })
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
            useStreamsStore.setState({ isStreaming: false })
            // L-068-07 safety net: only delete if entry still present (catch
            // paths where onTerminal didn't fire).
            if (registeredRunId && subscriptionsRef.current.has(registeredRunId)) {
              subscriptionsRef.current.delete(registeredRunId)
              const runIdToRemove = registeredRunId
              useStreamsStore.setState((s) => {
                const next = new Set(s.subscriptionsByRunId)
                next.delete(runIdToRemove)
                return { subscriptionsByRunId: next }
              })
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
          useStreamsStore.setState({ loadingThreadId: threadId })
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
              if (useStreamsStore.getState().reconcileError?.threadId === threadId) {
                useStreamsStore.setState({ reconcileError: null })
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
              useStreamsStore.setState({
                reconcileError: {
                  threadId,
                  error: err instanceof Error ? err : new Error(String(err)),
                },
              })
            }
          }
          try {
            await tryFetch(0)
          } finally {
            // Phase 068.5 Gap-01: clear the loading marker, but ONLY if we're
            // still the owner of it — a concurrent load may have started for
            // a different thread and clobbered our setState above.
            if (useStreamsStore.getState().loadingThreadId === threadId) {
              useStreamsStore.setState({ loadingThreadId: null })
            }
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
    // reference changes, NOT on every reconcileError / isStreaming /
    // subscriptionsByRunId / loadingThreadId / viewedThreadId / fallbackNotice
    // setState. Avoids wasted serialization on bookkeeping state.
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
export const useIsStreaming = (): boolean =>
  useStreamsStore((state) => state.isStreaming)

// useStreamSubscriptions reads from the Zustand-visible `subscriptionsByRunId`
// mirror.
export const useStreamSubscriptions = (runId: string): boolean =>
  useStreamsStore((state) => state.subscriptionsByRunId.has(runId))
