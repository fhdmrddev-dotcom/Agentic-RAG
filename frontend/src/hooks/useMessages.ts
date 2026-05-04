import { useState, useCallback, useRef, useEffect } from "react"
import type { Message, ToolCall, OutputFile, SourceReference, Citation } from "../types"
// eslint-disable-next-line prettier/prettier
import { getMessages, postMessage, subscribeToRun, getActiveRuns, cancelRun, type StreamCallbacks } from "../lib/api"

interface UseMessages {
  messages: Message[]
  isStreaming: boolean
  fallbackNotice: string | null
  loadMessages: (threadId: string) => Promise<void>
  sendMessage: (
    threadId: string,
    content: string,
    model?: string,
    onTitleUpdate?: (title: string) => void,
    agentMode?: string,
    provider?: string,
  ) => Promise<void>
  /** Phase 063 (D-063-03): server-side Stop via DELETE /runs/{rid}; now async. */
  stopStreaming: () => Promise<void>
  /** Kept for loadMessages-cancel paths only (D-060-03 invariants). NOT used for stream cancellation in Phase 063. */
  abortStream: () => void
  clearMessages: () => void
  setViewingThread: (threadId: string | null) => void
  /** Phase 063 (Pattern 2): on (re)connect — fetches active-runs in PARALLEL with loadMessages and reattaches placeholder + SSE consumer for any in-flight runs not already in subscriptionsRef. */
  reconcile: (threadId: string) => Promise<void>
  /** Phase 063 (Pattern 4 / D-063-04): re-POSTs the user message immediately preceding the failed assistant message. Explicit user intent only — never auto-fired. */
  resumeFromFailed: (failedMessage: Message) => Promise<void>
}

function makeTempId() {
  return `temp-${Date.now()}-${Math.random()}`
}

/** Phase 063: shared callback factory for both sendMessage and reconcile. Builds a
 * StreamCallbacks bag whose setMessages map-updates target a specific assistant
 * message id (assistantId / placeholderId). The body mirrors the legacy
 * POST-stream callback wiring one-for-one — same setMessages map-update shape
 * for every event type — so MessageItem rendering is unchanged.
 *
 * onTerminal is ALWAYS provided (Phase 062 TERMINAL_TYPES contract). The caller
 * (sendMessage / reconcile) wraps this to flip runStatus + handle Pitfall 8
 * buffer_expired fallback BEFORE calling our internal default (which is a no-op).
 */
function makeStreamCallbacks(opts: {
  assistantId: string
  threadId: string
  onTitleUpdate?: (title: string) => void
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  setFallbackNotice: React.Dispatch<React.SetStateAction<string | null>>
}): StreamCallbacks {
  const { assistantId, onTitleUpdate, setMessages, setFallbackNotice } = opts
  return {
    onDelta: (delta) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isPlanning: false, content: m.content + delta } : m,
        ),
      )
    },
    onDone: () => {
      // Clear planning flag when stream ends — prevents stuck spinner
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isPlanning: false } : m)),
      )
    },
    onTerminal: () => {
      // Default no-op — caller wraps to flip runStatus and handle buffer_expired.
    },
    onTitleUpdate,
    // onToolPreparing — D-01/D-02 (Phase 56.1): creates a "preparing" placeholder entry
    // immediately when the tool name is known, before arguments finish streaming.
    onToolPreparing: (name: string, index: number) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m
          // Deduplicate on the synthetic id (preparing-{index}), not on name.
          // Keying on name silently drops the second tool_preparing for same-named parallel calls.
          const preparingId = `preparing-${index}`
          const alreadyPreparing = (m.tool_calls ?? []).some((tc) => tc.id === preparingId)
          if (alreadyPreparing) return m
          const preparingEntry: ToolCall = {
            id: preparingId,
            name,
            args: {},
            status: "preparing",
            startedAt: undefined,
          }
          return { ...m, isPlanning: false, tool_calls: [...(m.tool_calls ?? []), preparingEntry] }
        }),
      )
    },
    // onToolStart — clear planning flag; upgrade preparing entry to running, or append if none
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
            // Upgrade the preparing entry to running in place (preserves ordering)
            updatedCalls = existingCalls.map((tc, i) =>
              i === preparingIdx
                ? { ...tc, args, status: "running" as const, startedAt: Date.now() }
                : tc,
            )
          } else {
            // No preparing entry — append new running entry (fallback for race/reconnect).
            // Include a stable id so tool_end's name-match still works if it tries to match by id.
            updatedCalls = [
              ...existingCalls,
              {
                id: `running-${Date.now()}`,
                name,
                args,
                status: "running" as const,
                startedAt: Date.now(),
              },
            ]
          }
          return { ...m, isPlanning: false, tool_calls: updatedCalls }
        }),
      )
    },
    // onToolEnd
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
    // onSubAgentStart
    onSubAgentStart: (filename, task) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, sub_agent: { filename, task, content: "", status: "running" } }
            : m,
        ),
      )
    },
    // onSubAgentDelta
    onSubAgentDelta: (text) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId || !m.sub_agent) return m
          return { ...m, sub_agent: { ...m.sub_agent, content: m.sub_agent.content + text } }
        }),
      )
    },
    // onSubAgentDone
    onSubAgentDone: () => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId || !m.sub_agent) return m
          return { ...m, sub_agent: { ...m.sub_agent, status: "done" } }
        }),
      )
    },
    // onSkillActivated — Phase 56 D-08/D-09: append to ordered activatedSkills array
    // for inline rendering in ToolCallPanel. Legacy activatedSkill field retained
    // for backward compat with components that read the single-value form.
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
    // onCodeExecutionStart — no-op (tool_start already created the ToolCall entry)
    onCodeExecutionStart: undefined,
    // onCodeStdout
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
    // onCodeStderr
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
    // onCodeExecutionComplete — sets data fields only; tool_end will set status="done"
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
    // onSources
    onSources: (sources: SourceReference[]) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, sources } : m)),
      )
    },
    // onCitations
    onCitations: (citations: Citation[]) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, citations } : m)),
      )
    },
    // onConfidence
    onConfidence: (level, avgSimilarity, disclaimer) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, confidence: { level, avg_similarity: avgSimilarity, disclaimer } }
            : m,
        ),
      )
    },
    // onSuggestions — ephemeral, like confidence (not persisted)
    onSuggestions: (questions: string[]) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, suggestions: questions } : m)),
      )
    },
    // onPlanning — agent finished one tool-call round, deciding next action
    onPlanning: () => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isPlanning: true } : m)),
      )
    },
    // onIterationStart — Phase 56 D-03/D-04: increment Step N counter on each loop pass
    onIterationStart: (iteration: number) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, iterationCount: iteration } : m)),
      )
    },
    // onFallbackModel — sub-agent retried with provider default after 404
    onFallbackModel: (original: string, fallback: string) => {
      setFallbackNotice(`Model ${original} unavailable — using ${fallback}.`)
      setTimeout(() => setFallbackNotice(null), 4000)
    },
  }
}

export function useMessages(): UseMessages {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null)
  const isSendingRef = useRef(false)
  const sendGenerationRef = useRef(0)   // increments each send; loadMessages checks it hasn't changed
  const abortControllerRef = useRef<AbortController | null>(null)
  const loadAbortRef = useRef<AbortController | null>(null)
  const stoppedByUserRef = useRef(false)
  const streamingThreadIdRef = useRef<string | null>(null)
  const isStreamingRef = useRef(false)
  const activeThreadIdRef = useRef<string | null>(null)
  // Phase 063 (Pitfall 1): in-flight subscriptions keyed by run_id. Reconcile
  // short-circuits when the run_id is already a subscriptionsRef key —
  // guards against StrictMode double-mount + rapid visibilitychange/focus
  // double-fires opening duplicate consumers on the same run.
  const subscriptionsRef = useRef<Map<string, AbortController>>(new Map())
  // Phase 063.1 (D-063.1-01 / Gap-004): per-run replay cursor. Updated as each
  // delta SSE entry arrives (Redis Stream `id` field captured by the api.ts
  // parser and exposed via StreamCallbacks.onCursor). Hook-local Map; survives
  // tab switches and reconcile cycles within a page lifetime; F5 wipes it
  // (back to since='0' on reload — the runId-match dedup of D-063.1-04
  // handles the F5-replay flicker, not the offset cursor).
  const lastSeenOffsetRef = useRef<Map<string, string>>(new Map())
  // Phase 063.1 (D-063.1-11 / Gap-005): serialize concurrent reconcile calls.
  // Multi-tab activation fires BOTH visibilitychange + focus in <50ms; without
  // this guard the two reconciles race — A inserts the temp placeholder, B's
  // loadMessages overwrites it via setMessages(data), B's for-loop
  // short-circuits on subscriptionsRef.has(), net result: no placeholder
  // rendered despite SSE being open. Bool guard (not Map): only one viewing
  // thread at a time, so a single in-flight bit suffices. The active reconcile
  // picks up the latest state when it finishes; subsequent triggers fire a
  // fresh reconcile only AFTER the lock releases — coalescing, not skipping.
  // No debounce (rejected per CONTEXT.md): fragile against pageshow lateness
  // and adds latency to single legit triggers. Mirrors resumeInFlightRef
  // pattern at line 799 (same useRef(false) shape).
  const reconcileInFlightRef = useRef(false)

  // D-063-03: Stop is server-side via DELETE /runs/{rid}. The terminal
  // 'cancelled' sentinel arrives via the open SSE subscription; the parser
  // loop in subscribeToRun closes naturally on receiving it; cross-tab Stop
  // falls out for free because the sentinel propagates to all attached
  // consumers via the same Redis Stream. We do NOT abort the fetch — that
  // would only close the consumer-side socket; the producer would keep
  // running until natural completion or the 120s hard timeout (D-061-01).
  //
  // WR-03 fix: read latest messages from a ref instead of putting `messages`
  // in the dep array. Otherwise stopStreaming gets recreated on every token
  // delta and any closure that captured the previous reference goes stale.
  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const stopStreaming = useCallback(async () => {
    // Pitfall 3: derive run_id from message state (NOT a separate ref).
    // Refs lose track of the active run when the user navigates threads
    // and comes back; messages always reflect the latest streaming state.
    const streamingMsg = [...messagesRef.current]
      .reverse()
      .find((m) => m.role === "assistant" && m.runStatus === "streaming")
    const runId = streamingMsg?.runId
    if (!runId) return
    stoppedByUserRef.current = true
    try {
      await cancelRun(runId)
      // Server cancels the producer; terminal 'cancelled' sentinel arrives
      // via the still-open SSE in subscribeToRun. The onTerminal callback
      // inside sendMessage's closure handles UI update. Nothing more to do here.
    } catch (err) {
      console.error("Stop failed:", err)
    }
  }, [])

  const abortStream = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  // D-060-01: setViewingThread is the SOLE writer of activeThreadIdRef.
  // ChatArea (Plan 060-02) calls this as the first action of its thread-selection useEffect,
  // before clearMessages/abortStream/loadMessages, so the post-await guard inside
  // loadMessages (D-060-02) sees the new thread id when comparing.
  const setViewingThread = useCallback((threadId: string | null) => {
    activeThreadIdRef.current = threadId
  }, [])

  const clearMessages = useCallback(() => {
    // D-060-10: clearMessages is a pure state reset. The caller (ChatArea, plan 060-02)
    // is responsible for calling abortStream() first when it intends to cancel a stream.
    setMessages([])
    setIsStreaming(false)
    isSendingRef.current = false
  }, [])

  const loadMessages = useCallback(async (threadId: string) => {
    // D-060-03: cancel the previous in-flight getMessages fetch before issuing a new one.
    // The aborted fetch surfaces an AbortError that the catch below silently swallows.
    loadAbortRef.current?.abort()
    const controller = new AbortController()
    loadAbortRef.current = controller
    try {
      const data = await getMessages(threadId, controller.signal)
      // D-060-02: read activeThreadIdRef ONLY after await — discards cross-thread responses.
      // (setViewingThread, the sole writer, runs in ChatArea before any concurrent loadMessages
      // resolves; if the ref no longer matches threadId, this fetch's response is stale.)
      if (activeThreadIdRef.current !== threadId) return
      // Protect optimistic placeholders if a send is in flight on the same thread.
      if (isSendingRef.current) return
      // Phase 063.1 (D-063.1-12 / Gap-005): MERGE instead of REPLACE. Belt-and-
      // braces protection for any code path that calls loadMessages while a
      // reconcile-inserted temp-${run_id} placeholder is in flight (terminal-
      // time refetch in reconcile's outer .finally(), buffer_expired fallback
      // inside onTerminal, future code paths). The reconcile in-flight ref
      // (D-063.1-11) is the primary fix; this is the safety net. Preserves any
      // temp- placeholder whose runId is NOT yet a DB row (live in-flight run
      // that hasn't persisted yet); discards any temp- placeholder whose runId
      // IS already in the DB result (DB caught up; reconcile's runId-match
      // dedup at D-063.1-04 will route SSE deltas to the DB row, so preserving
      // the placeholder would cause a duplicate bubble — Test 6 invariant).
      // T-063.1-12 mitigation: the post-await thread-id guard above ensures
      // prev is already scoped to the current viewing thread; no cross-thread
      // leak possible. Order: DB rows first (sorted by created_at backend-
      // side), placeholders appended (most recent run_id by definition; React
      // keys on `id` are stable so no collision risk).
      setMessages((prev) => {
        const dbRunIds = new Set(
          data.filter((m) => m.runId).map((m) => m.runId),
        )
        const liveTempPlaceholders = prev.filter(
          (m) => m.id.startsWith("temp-") && m.runId && !dbRunIds.has(m.runId),
        )
        return [...data, ...liveTempPlaceholders]
      })
    } catch (err) {
      // D-060-11: silently swallow AbortError (mirrors sendMessage catch below).
      if (err instanceof Error && err.name === "AbortError") return
      throw err
    }
  }, [])

  const sendMessage = useCallback(async (
    threadId: string,
    content: string,
    model?: string,
    onTitleUpdate?: (title: string) => void,
    agentMode?: string,
    provider?: string,
  ) => {
    if (isSendingRef.current) return
    isSendingRef.current = true
    sendGenerationRef.current += 1
    streamingThreadIdRef.current = threadId

    // Optimistic user message — UNCHANGED from Phase 060 (makes the UI feel instant).
    const userMsg: Message = {
      id: makeTempId(),
      thread_id: threadId,
      user_id: "",
      role: "user",
      content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    // Optimistic assistant placeholder — extended with runId/runStatus per
    // RESEARCH Open Question 2. runId is filled in once postMessage returns.
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
    setMessages((prev) => [...prev, assistantMsg])
    setIsStreaming(true)
    isStreamingRef.current = true

    // Phase 063: AbortController is for the GET stream subscription ONLY for
    // genuine timeout cases (e.g., user navigates away — close the open SSE
    // without cancelling the run on the backend). Stop semantics use cancelRun
    // (D-063-03), NOT this AbortController.
    const controller = new AbortController()
    abortControllerRef.current = controller

    let registeredRunId: string | null = null

    try {
      // Step 1: POST returns synchronously with {message_id, run_id} (D-063-01)
      const { message_id, run_id } = await postMessage(threadId, content, {
        model,
        provider,
        agentMode,
      })
      registeredRunId = run_id

      // WR-04 fix: swap the optimistic user placeholder's temp id for the
      // real persisted user_message UUID returned from POST. Without this,
      // a Realtime upsert that arrives BEFORE the next loadMessages refetch
      // can side-by-side a duplicate persisted user message with the temp
      // placeholder. Also: stamp run_id onto the assistant placeholder so
      // Stop can find it via stopStreaming.
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === userMsg.id) return { ...m, id: message_id }
          if (m.id === assistantId) return { ...m, runId: run_id }
          return m
        }),
      )
      subscriptionsRef.current.set(run_id, controller)

      // Step 2: open the GET stream and dispatch SSE events to per-message-id callbacks.
      // The callbacks pattern mirrors the legacy POST-stream closure — same
      // setMessages map-update shape, but we now ALSO handle terminal events
      // explicitly via onTerminal (NEW vs the previous one-call orchestrator).
      //
      // Phase 063.1 (D-063.1-08 / Gap-003): gate sendMessage's per-event
      // setMessages on the streaming thread still being the one in view.
      // streamingThreadIdRef is set above (line 401) to threadId at send-start
      // and reset to null in the finally block. activeThreadIdRef tracks the
      // user's current viewing thread (D-060-01 sole writer). When they
      // diverge (user navigated away mid-stream), per-event setMessages is a
      // no-op; the in-flight SSE keeps writing through this still-live guard
      // and updates resume the moment the user navigates back (because
      // activeThreadIdRef === streamingThreadIdRef again). Mirrors reconcile's
      // WR-05 guardedSetMessages pattern (line 681-686).
      //
      // Critical: terminal-status flip (callbacks.onTerminal override below)
      // and the runId stamp (already executed line 457-463) use plain
      // setMessages — those must run regardless of viewing thread (the run
      // actually ended; the placeholder needs the correct runStatus when the
      // user navigates back). PATTERNS.md note line 134.
      const guardedSetMessages: typeof setMessages = ((
        update: Parameters<typeof setMessages>[0],
      ) => {
        if (streamingThreadIdRef.current !== activeThreadIdRef.current) return
        setMessages(update)
      }) as typeof setMessages

      const callbacks: StreamCallbacks = makeStreamCallbacks({
        assistantId,
        threadId,
        onTitleUpdate,
        setMessages: guardedSetMessages,
        setFallbackNotice,
      })

      // Override onTerminal to flip runStatus and clean up subscription map.
      const originalOnTerminal = callbacks.onTerminal
      callbacks.onTerminal = (kind, errorPayload) => {
        // Map TERMINAL_TYPES → runStatus enum value (literal-per-branch so future
        // greps for `runStatus: "<value>"` find every branch).
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            if (kind === "done") return { ...m, runStatus: "completed" }
            if (kind === "error") return { ...m, runStatus: "failed" }
            // kind === "cancelled"
            return { ...m, runStatus: "cancelled", stopped: true }
          }),
        )
        // BL-03 fix: subscriptionsRef cleanup belongs to the terminal event
        // (the moment the producer is actually done), NOT to sendMessage's
        // finally — otherwise reconcile() ticks during the still-draining
        // window can't see the subscription and open a duplicate consumer.
        if (registeredRunId) subscriptionsRef.current.delete(registeredRunId)
        // Pitfall 8: TTL-expired buffer (synthetic done with error='buffer_expired')
        // — fall back to loadMessages so the persisted assistant message renders.
        if (errorPayload === "buffer_expired") {
          loadMessages(threadId).catch(console.error)
        }
        originalOnTerminal(kind, errorPayload)
      }

      // Phase 063.1 (D-063.1-01/02 / Gap-004): cursor advancement. The api.ts
      // parser fires onCursor AFTER each successful event dispatch with the
      // most recent Redis Stream `id:` line value. We stash it in
      // lastSeenOffsetRef keyed by run_id so a subsequent reconcile cycle on
      // this run (e.g. tab switch + return) passes the cached cursor as the
      // `since` arg instead of replaying from "0". sendMessage itself starts
      // at "0" because this is a fresh run — the cursor only matters once a
      // RECONCILE re-attaches mid-run.
      callbacks.onCursor = (msId: string) => {
        lastSeenOffsetRef.current.set(run_id, msId)
      }

      await subscribeToRun(run_id, "0", callbacks, controller.signal)
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Caller-initiated abort (rare in 063 — only for navigate-away timeouts).
      } else {
        console.error("sendMessage failed:", err)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, runStatus: "failed" } : m,
          ),
        )
      }
    } finally {
      abortControllerRef.current = null
      isSendingRef.current = false
      streamingThreadIdRef.current = null
      setIsStreaming(false)
      isStreamingRef.current = false
      // BL-03 fix: do NOT delete subscriptionsRef entry here — onTerminal
      // (above) is the canonical cleanup point. Deleting in `finally` runs
      // before the SSE reader has actually closed in some edge cases and
      // lets reconcile() open a duplicate consumer for the still-live run.
      // On error/abort paths where onTerminal never fires, we still need a
      // safety net: delete only if the entry is still present AND no error
      // was a normal terminal (covered by the catch block flipping
      // runStatus to 'failed' which user can resume from).
      if (registeredRunId && subscriptionsRef.current.has(registeredRunId)) {
        // Safety net for catch paths where onTerminal didn't fire.
        // (Happy path already deleted in onTerminal.)
        subscriptionsRef.current.delete(registeredRunId)
      }

      // Always clear planning flag on stream end
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isPlanning: false } : m)),
      )

      const wasStoppedByUser = stoppedByUserRef.current

      // Mark running or preparing tool calls as "interrupted" if the user stopped the stream
      if (wasStoppedByUser) {
        setMessages((prev) =>
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

      // Apply stopped flag to the placeholder message (pure state update, no side effects)
      setMessages((prev) => {
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

      // Reset stopped ref outside any state updater so it runs exactly once
      stoppedByUserRef.current = false
      // CRITICAL Phase 060 invariant (Bug 3 guard): do NOT call loadMessages here.
      // SSE-built content stays canonical; reconcile + onTerminal handle merge.
    }
  }, [loadMessages])

  // Phase 063 (Pattern 2 + CONTEXT.md "Reconciliation Hook Ordering"): on
  // every (re)connect (mount, focus, visibilitychange, pageshow), query
  // active-runs IN PARALLEL with loadMessages (CONTEXT.md mandate: active-runs
  // MUST resolve before loadMessages settles, otherwise the local message
  // list will appear missing the in-flight assistant message until the next
  // reconcile tick). For each active run not already subscribed, synthesize
  // a placeholder assistant message and open subscribeToRun.
  const reconcile = useCallback(async (threadId: string) => {
    // Phase 063.1 (D-063.1-11 / Gap-005): top-of-function in-flight guard MUST
    // come BEFORE Promise.all dispatch. If a reconcile body is already running
    // (e.g. visibilitychange + focus fire in the same tick on multi-tab
    // activation), return immediately; the active reconcile picks up the
    // latest state when it finishes. The next legitimate trigger (the next
    // visibilitychange / focus / pageshow / mount) fires a fresh reconcile
    // AFTER the lock releases — coalescing, not permanent skip. Set the bit
    // synchronously BEFORE any await so the second call (also synchronous to
    // the same tick before its own await) reads `true` and bails.
    if (reconcileInFlightRef.current) return
    reconcileInFlightRef.current = true
    try {
      let activeRuns: Awaited<ReturnType<typeof getActiveRuns>>
      try {
        // CONTEXT.md "Reconciliation Hook Ordering": active-runs and messages MUST be fetched in parallel.
        const [runs] = await Promise.all([getActiveRuns(threadId), loadMessages(threadId)])
        activeRuns = runs
      } catch (err) {
        console.error("reconcile failed:", err)
        return
      }

      for (const run of activeRuns) {
      // Pitfall 3 cross-thread safety: only attach if this thread is still
      // the viewing thread when reconcile started; setViewingThread is the
      // sole writer (D-060-01). Kept at top of the iteration body — runs
      // BEFORE the dedup/insert so we don't write into a stale thread.
      if (activeThreadIdRef.current !== threadId) return

      // Phase 063.1 (D-063.1-04 / Gap-001): runId-match dedup. If a message
      // already in current state carries this run_id (e.g. post-F5 the LEFT
      // JOIN runs delivered a persisted assistant row with runId from
      // getMessages), reuse THAT message's id as the SSE callback target —
      // no second bubble. messagesRef.current is the current state (declared
      // at line 316-319 for stopStreaming's WR-03 fix; same pattern reused).
      const existingByRunId = messagesRef.current.find((m) => m.runId === run.run_id)
      const targetId = existingByRunId?.id ?? `temp-${run.run_id}`

      // Idempotent placeholder insert ONLY when no existing row found.
      // Deterministic temp-id — idempotent React reconciliation (Pitfall 1).
      // Same id across reconciles for the same run = StrictMode-safe.
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
        setMessages((prev) => {
          // Idempotent insert.
          if (prev.some((m) => m.id === targetId)) return prev
          return [...prev, placeholder]
        })
      }

      // Phase 063.1 (D-063.1-09 / Gap-003): NARROWED short-circuit. Pre-063.1
      // this `continue` lived ABOVE the placeholder insert, which meant
      // switching back to a thread mid-stream would skip the whole iteration
      // (no re-render of the assistant bubble) because subscriptionsRef
      // already had the run_id from sendMessage's still-live SSE consumer.
      // New behavior: ALWAYS render the placeholder/dedup; only skip the
      // subscribeToRun call itself when a live subscription already exists.
      // BL-03 invariant preserved: subscription cleanup remains owned by
      // onTerminal (and the .finally() safety net below).
      if (subscriptionsRef.current.has(run.run_id)) continue

      // WR-06 fix: RESERVE the subscription slot BEFORE firing subscribeToRun.
      // The previous order (insert → set → fire) left a synchronous window
      // where a StrictMode double-invoke could race past the has(run_id)
      // short-circuit and open a duplicate consumer. Setting first makes
      // subsequent reconcile ticks short-circuit deterministically.
      const controller = new AbortController()
      subscriptionsRef.current.set(run.run_id, controller)

      // WR-05 fix: gate live setMessages updates on the user still viewing
      // this thread. The placeholder INSERT above is fine to write in either
      // case (so it appears when the user navigates back), but per-event
      // updates from the consumer should NOT mutate visible state on a
      // different thread (Phase 060 D-060-01 invariant). State updates are
      // resumed automatically when the user navigates back via reconcile()
      // re-attaching to the same run (subscriptionsRef short-circuit
      // continues to gate duplicate consumers).
      const guardedSetMessages: typeof setMessages = ((
        update: Parameters<typeof setMessages>[0],
      ) => {
        if (activeThreadIdRef.current !== threadId) return
        setMessages(update)
      }) as typeof setMessages

      // Phase 063.1 (D-063.1-04): pass `targetId` (the dedup-resolved id) as
      // the assistantId so all event callbacks route SSE deltas to the
      // persisted DB row when one exists, not to a parallel temp placeholder.
      const callbacks: StreamCallbacks = makeStreamCallbacks({
        assistantId: targetId,
        threadId,
        setMessages: guardedSetMessages,
        setFallbackNotice,
      })
      const originalOnTerminal = callbacks.onTerminal
      callbacks.onTerminal = (kind, errorPayload) => {
        // Terminal status flip is unconditional (the run actually ended;
        // the placeholder needs the correct runStatus when the user
        // navigates back).
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== targetId) return m
            if (kind === "done") return { ...m, runStatus: "completed" }
            if (kind === "error") return { ...m, runStatus: "failed" }
            // kind === "cancelled"
            return { ...m, runStatus: "cancelled" }
          }),
        )
        // BL-03 fix: subscription cleanup belongs to the terminal event, not
        // the .finally() chain on the promise (which can race in StrictMode
        // double-invoke scenarios where the second reconcile sees the entry
        // already gone before its onTerminal merges state).
        subscriptionsRef.current.delete(run.run_id)
        if (errorPayload === "buffer_expired") {
          loadMessages(threadId).catch(console.error)
        }
        originalOnTerminal(kind, errorPayload)
      }

      // Phase 063.1 (D-063.1-01/02 / Gap-004): cursor advancement. Each
      // delta event from the api.ts parser carries the most recent Redis
      // Stream `id:` value via onCursor. Stash it in lastSeenOffsetRef
      // keyed by run_id so the next reconcile cycle re-attaching to this
      // run passes the cached cursor as `since` instead of replaying from
      // "0" (idempotent on the React side, but wasteful on the network).
      callbacks.onCursor = (msId: string) => {
        lastSeenOffsetRef.current.set(run.run_id, msId)
      }

      // Phase 063.1 (D-063.1-02): pass cached cursor (or "0" on first attach)
      // instead of hard-coding "0". Backend already accepts `since` per
      // Phase 062 (event_consumer clone with last_id=since) — no backend
      // change required for Gap-004 (D-063.1-03).
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
          // BL-03 safety net: if onTerminal didn't fire (AbortError, thrown
          // network error mid-stream, etc.), make sure the entry is removed
          // so the next reconcile tick can resubscribe instead of being
          // blocked by a stale Map key.
          if (subscriptionsRef.current.has(run.run_id)) {
            subscriptionsRef.current.delete(run.run_id)
          }
          // Pitfall 5 (terminal-time merge): SSE-built content stays canonical;
          // reload DB-only fields once at terminal so confidence_*, suggestions,
          // citations etc. land. loadMessages races against any Realtime upsert;
          // either wins benignly per Phase 060 invariants.
          loadMessages(threadId).catch(console.error)
        })
    }
    } finally {
      // Phase 063.1 (D-063.1-11 / Gap-005): ALWAYS reset in finally so the next
      // trigger isn't permanently locked out by an exception inside the body
      // (every early-return path above — the cross-thread guard at line 669,
      // the inner Promise.all catch at line 661 — flows through this finally
      // because they're inside the outer try). T-063.1-13 mitigation.
      reconcileInFlightRef.current = false
    }
  }, [loadMessages])

  // D-063-04: Resume = re-POST the original user message. The backend POST
  // inserts a duplicate user-message row + spawns a fresh run; matches
  // ChatGPT/Claude.ai "Regenerate" semantics. Explicit user intent only —
  // never auto-fired (D-v2.5-05).
  //
  // BL-06 fix: walk BACKWARD from the failed assistant message to find the
  // most recent user message rather than blindly indexing idx-1, which
  // breaks if any tool/system row was interleaved before the failure.
  // Also guards against double-click via an in-flight ref so a rapid
  // second click does not silently no-op against sendMessage's
  // isSendingRef gate (the user gets no feedback otherwise).
  const resumeInFlightRef = useRef(false)
  const resumeFromFailed = useCallback(async (failedMessage: Message) => {
    if (resumeInFlightRef.current) return
    const idx = messages.findIndex((m) => m.id === failedMessage.id)
    if (idx < 0) return
    // Walk backward to find the most recent user message before this failure.
    let userMsg: Message | undefined
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMsg = messages[i]
        break
      }
    }
    if (!userMsg) {
      console.warn("resumeFromFailed: no preceding user message for", failedMessage.id)
      return
    }
    resumeInFlightRef.current = true
    try {
      await sendMessage(failedMessage.thread_id, userMsg.content)
    } finally {
      resumeInFlightRef.current = false
    }
  }, [messages, sendMessage])

  // Hook unmount: abort all live subscriptions so we don't leak fetch readers.
  // The producers continue server-side per D-061-15; this only closes
  // consumer-side sockets. NEW in Phase 063 — pre-063 there was at most one
  // long-lived stream and abortControllerRef.abort() handled it; with
  // reconcile + multi-tab there can be N concurrent subscriptions per hook.
  //
  // D-063.1-10 audit (plan 063.1-03):
  //   Single hook consumer: ChatArea.tsx (line 39) — verified via grep.
  //   ChatArea mount lifetime: tied to App-level routing, NOT keyed on
  //   thread.id (thread switches via useEffect, not remount). So this
  //   unmount effect only fires on logout/route change.
  //   If a future surface adds a second consumer of this hook or keys
  //   ChatArea on thread.id, the cleanup semantics need re-review.
  useEffect(() => {
    return () => {
      for (const ctrl of subscriptionsRef.current.values()) ctrl.abort()
      subscriptionsRef.current.clear()
    }
  }, [])

  return {
    messages,
    isStreaming,
    fallbackNotice,
    loadMessages,
    sendMessage,
    stopStreaming,
    abortStream,
    clearMessages,
    setViewingThread,
    reconcile,
    resumeFromFailed,
  }
}
