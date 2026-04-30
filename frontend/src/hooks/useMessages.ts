import { useState, useCallback, useRef } from "react"
import type { Message, ToolCall, OutputFile } from "../types"
import { getMessages, streamMessage } from "../lib/api"
import { supabase } from "../lib/supabase"

interface UseMessages {
  messages: Message[]
  isStreaming: boolean
  fallbackNotice: string | null
  loadMessages: (threadId: string) => Promise<void>
  sendMessage: (threadId: string, content: string, model?: string, onTitleUpdate?: (title: string) => void, agentMode?: string, provider?: string) => Promise<void>
  stopStreaming: () => void
  abortStream: () => void
  clearMessages: () => void
  subscribeToThread: (threadId: string) => void
  unsubscribeFromThread: () => void
  setViewingThread: (threadId: string | null) => void
}

function makeTempId() {
  return `temp-${Date.now()}-${Math.random()}`
}

export function useMessages(): UseMessages {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null)
  const isSendingRef = useRef(false)
  const sendGenerationRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const stoppedByUserRef = useRef(false)
  const streamingThreadIdRef = useRef<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const threadChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isStreamingRef = useRef(false)
  const activeThreadIdRef = useRef<string | null>(null)
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cancels any in-flight getMessages fetch when a newer loadMessages call starts.
  // This unblocks navigation when the backend is slow (e.g. SSE occupying the worker).
  const loadAbortRef = useRef<AbortController | null>(null)

  // ──────────────────────────────────────────────────────────────────────────
  // FIX 1: loadMessages — guard against cross-thread overwrites
  //
  // PROBLEM: When user navigates Thread A → Thread B while A is streaming:
  //   1. ChatArea effect fires clearMessages() + loadMessages(B)
  //   2. sendMessage's finally block fires loadMessages(A) (closure capture)
  //   3. Both fetches race. If A's response arrives second, it overwrites B's
  //      messages with A's data — user sees wrong thread or blank screen.
  //
  // FIX: Capture activeThreadIdRef AFTER the await (not before). If the active
  // thread changed while the fetch was in-flight, discard the result entirely.
  // The generation check is kept as a secondary guard for same-thread races.
  // ──────────────────────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (threadId: string) => {
    // Cancel any previous in-flight fetch — this unblocks navigation when the
    // backend is slow (e.g. Thread A's SSE occupying the FastAPI worker queue).
    loadAbortRef.current?.abort()
    const controller = new AbortController()
    loadAbortRef.current = controller

    const generation = sendGenerationRef.current
    try {
      const data = await getMessages(threadId, controller.signal)

      // Guard: discard if user navigated to a different thread while in-flight.
      // activeThreadIdRef is ONLY written by setViewingThread (navigation), never
      // by loadMessages — so it reliably reflects the user's current thread.
      if (activeThreadIdRef.current !== threadId) return

      setMessages((prev) => {
        if (isSendingRef.current && streamingThreadIdRef.current === threadId) return prev
        if (sendGenerationRef.current !== generation) return prev
        return data
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return  // cancelled by newer load
      console.error("loadMessages failed:", err)
    }
  }, [])

  // setViewingThread is the ONLY place activeThreadIdRef is written.
  // Called from ChatArea's effect before abortStream/clearMessages/loadMessages,
  // so the ref always reflects the user's current thread when any async guard runs.
  const setViewingThread = useCallback((threadId: string | null) => {
    activeThreadIdRef.current = threadId
  }, [])

  const stopStreaming = useCallback(() => {
    stoppedByUserRef.current = true
    abortControllerRef.current?.abort()
  }, [])

  const abortStream = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  // ──────────────────────────────────────────────────────────────────────────
  // FIX 2: clearMessages — DON'T abort the stream here
  //
  // PROBLEM: clearMessages() was calling abortControllerRef.current?.abort()
  // which kills the SSE connection. When ChatArea's thread-switch effect
  // calls clearMessages() then abortStream() separately, the abort fires
  // inside clearMessages AND triggers sendMessage's finally block, which
  // then calls loadMessages(oldThreadId) — racing with the new thread.
  //
  // FIX: clearMessages only clears state. Aborting is the caller's job
  // (ChatArea calls abortStream() explicitly). This separates concerns:
  // clearMessages = wipe UI state, abortStream = kill network.
  // ──────────────────────────────────────────────────────────────────────────
  const clearMessages = useCallback(() => {
    setMessages([])
    setIsStreaming(false)
    isStreamingRef.current = false
    isSendingRef.current = false
  }, [])

  const subscribeToThread = useCallback((threadId: string) => {
    if (threadChannelRef.current) {
      supabase.removeChannel(threadChannelRef.current)
      threadChannelRef.current = null
    }

    const channelName = `thread-always-on-${threadId}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          if (isStreamingRef.current) return

          // GUARD: Don't reload if user already navigated to a different thread.
          // Without this, a late INSERT from Thread A would trigger loadMessages(A)
          // even though the user is now viewing Thread B.
          if (activeThreadIdRef.current !== threadId) return

          if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
          reloadTimerRef.current = setTimeout(() => {
            reloadTimerRef.current = null
            loadMessages(threadId).catch(console.error)
          }, 300)
        }
      )
      .subscribe()

    threadChannelRef.current = channel
  }, [])

  const unsubscribeFromThread = useCallback(() => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current)
      reloadTimerRef.current = null
    }
    if (threadChannelRef.current) {
      supabase.removeChannel(threadChannelRef.current)
      threadChannelRef.current = null
    }
  }, [])

  const sendMessage = useCallback(async (threadId: string, content: string, model?: string, onTitleUpdate?: (title: string) => void, agentMode?: string, provider?: string) => {
    if (isSendingRef.current) return
    isSendingRef.current = true
    sendGenerationRef.current += 1
    streamingThreadIdRef.current = threadId

    // Optimistic user message
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

    // Placeholder assistant message for streaming
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
    }
    setMessages((prev) => [...prev, assistantMsg])
    setIsStreaming(true)
    isStreamingRef.current = true
    const controller = new AbortController()
    abortControllerRef.current = controller

    // Per-stream Realtime channel for SSE drop recovery
    const channelName = `messages-thread-${threadId}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          if (isStreamingRef.current) return
          // GUARD: Don't process if user navigated away from this thread
          if (activeThreadIdRef.current !== threadId) return

          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as Message
            setMessages((prev) => {
              if (newMsg.role === "assistant") {
                const tempIdx = prev.findIndex(
                  (m) => m.role === "assistant" && m.id.startsWith("temp-")
                )
                if (tempIdx !== -1) {
                  const next = [...prev]
                  next[tempIdx] = newMsg
                  return next
                }
              }
              if (prev.some((m) => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
          } else if (payload.eventType === "UPDATE") {
            const updatedMsg = payload.new as Message
            setMessages((prev) =>
              prev.map((m) => m.id === updatedMsg.id ? updatedMsg : m)
            )
          }
        }
      )
      .subscribe()
    channelRef.current = channel

    try {
      await streamMessage(
      threadId,
      content,
      (delta) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isPlanning: false, content: m.content + delta } : m)),
        )
      },
      () => {
        setIsStreaming(false)
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, isPlanning: false } : m)
        )
      },
      model,
      provider,
      onTitleUpdate,
      // onToolPreparing
      (name: string, index: number) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const preparingId = `preparing-${index}`
            const alreadyPreparing = (m.tool_calls ?? []).some((tc) => tc.id === preparingId)
            if (alreadyPreparing) return m
            const preparingEntry: ToolCall = {
              id: `preparing-${index}`,
              name,
              args: {},
              status: "preparing",
              startedAt: undefined,
            }
            return { ...m, isPlanning: false, tool_calls: [...(m.tool_calls ?? []), preparingEntry] }
          }),
        )
      },
      // onToolStart
      (name, args) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const existingCalls = m.tool_calls ?? []
            const preparingIdx = existingCalls.findIndex(
              (tc) => tc.name === name && tc.status === "preparing"
            )
            let updatedCalls: ToolCall[]
            if (preparingIdx !== -1) {
              updatedCalls = existingCalls.map((tc, i) =>
                i === preparingIdx
                  ? { ...tc, args, status: "running" as const, startedAt: Date.now() }
                  : tc
              )
            } else {
              updatedCalls = [...existingCalls, { id: `running-${Date.now()}`, name, args, status: "running" as const, startedAt: Date.now() }]
            }
            return { ...m, isPlanning: false, tool_calls: updatedCalls }
          }),
        )
      },
      // onToolEnd
      (name, result) => {
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
      (filename, task) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, sub_agent: { filename, task, content: "", status: "running" } }
              : m,
          ),
        )
      },
      // onSubAgentDelta
      (text) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId || !m.sub_agent) return m
            return { ...m, sub_agent: { ...m.sub_agent, content: m.sub_agent.content + text } }
          }),
        )
      },
      // onSubAgentDone
      () => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId || !m.sub_agent) return m
            return { ...m, sub_agent: { ...m.sub_agent, status: "done" } }
          }),
        )
      },
      // onSkillActivated
      (skillName) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const newActivation = {
              type: 'skill_activation' as const,
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
      // onCodeExecutionStart
      undefined,
      // onCodeStdout
      (content: string) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const updated = (m.tool_calls ?? []).map((tc) =>
              tc.name === "execute_code" && tc.status === "running"
                ? { ...tc, outputLines: [...(tc.outputLines ?? []), { kind: "stdout" as const, content }] }
                : tc
            )
            return { ...m, tool_calls: updated }
          })
        )
      },
      // onCodeStderr
      (content: string) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const updated = (m.tool_calls ?? []).map((tc) =>
              tc.name === "execute_code" && tc.status === "running"
                ? { ...tc, outputLines: [...(tc.outputLines ?? []), { kind: "stderr" as const, content }] }
                : tc
            )
            return { ...m, tool_calls: updated }
          })
        )
      },
      // onCodeExecutionComplete
      (exitCode: number, durationMs: number, outputFiles: OutputFile[], error?: string) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const updated = (m.tool_calls ?? []).map((tc) =>
              tc.name === "execute_code" && tc.status === "running"
                ? { ...tc, exitCode, executionDurationMs: durationMs, outputFiles, errorMessage: error }
                : tc
            )
            return { ...m, tool_calls: updated }
          })
        )
      },
      agentMode,
      // onSources
      (sources) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, sources } : m)
        )
      },
      // onCitations
      (citations) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, citations } : m)
        )
      },
      // onConfidence
      (level, avgSimilarity, disclaimer) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, confidence: { level, avg_similarity: avgSimilarity, disclaimer } } : m)
        )
      },
      // onSuggestions
      (questions) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, suggestions: questions } : m)
        )
      },
      // onPlanning
      () => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, isPlanning: true } : m)
        )
      },
      // onIterationStart
      (iteration: number) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, iterationCount: iteration } : m,
          ),
        )
      },
      // onFallbackModel
      (original: string, fallback: string) => {
        setFallbackNotice(`Model ${original} unavailable — using ${fallback}.`)
        setTimeout(() => setFallbackNotice(null), 4000)
      },
      controller.signal,
    )
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.error(err)
      }
    } finally {
      abortControllerRef.current = null
      isSendingRef.current = false
      streamingThreadIdRef.current = null
      setIsStreaming(false)
      isStreamingRef.current = false

      // ────────────────────────────────────────────────────────────────────
      // FIX 3: Tear down per-stream channel IMMEDIATELY
      //
      // The 2s delay created a window where two Realtime channels (per-stream
      // + always-on) coexisted, both calling loadMessages and racing each other.
      // The always-on subscription (threadChannelRef) handles recovery.
      // ────────────────────────────────────────────────────────────────────
      const channelToRemove = channelRef.current
      channelRef.current = null
      if (channelToRemove) {
        supabase.removeChannel(channelToRemove)
      }

      // Clear planning flag
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, isPlanning: false } : m)
      )

      const wasStoppedByUser = stoppedByUserRef.current

      if (wasStoppedByUser) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const hasActiveTools = m.tool_calls?.some(
              (tc) => tc.status === "running" || tc.status === "preparing"
            )
            if (!hasActiveTools) return m
            return {
              ...m,
              tool_calls: m.tool_calls!.map((tc) =>
                tc.status === "running" || tc.status === "preparing"
                  ? { ...tc, status: "interrupted" as const }
                  : tc
              ),
            }
          })
        )
      }

      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1]
        if (lastMsg?.id === assistantId) {
          return prev.map((m) =>
            m.id === assistantId
              ? { ...m, ...(wasStoppedByUser ? { stopped: true } : {}) }
              : m
          )
        }
        return prev
      })

      stoppedByUserRef.current = false
      // NOTE: We intentionally do NOT call loadMessages here after stream completion.
      // Fetching the DB version caused raw tool-result JSON (stored in message content
      // by the backend) to appear inline in the chat, replacing the clean streaming
      // format. The streaming messages in state are correct as-is. The canonical DB
      // version will be fetched naturally when the user navigates away and returns.
    }
  }, [loadMessages])

  return { messages, isStreaming, fallbackNotice, loadMessages, sendMessage, stopStreaming, abortStream, clearMessages, subscribeToThread, unsubscribeFromThread, setViewingThread }
}
