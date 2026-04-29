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
}

function makeTempId() {
  return `temp-${Date.now()}-${Math.random()}`
}

export function useMessages(): UseMessages {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null)
  const isSendingRef = useRef(false)
  const sendGenerationRef = useRef(0)   // increments each send; loadMessages checks it hasn't changed
  const abortControllerRef = useRef<AbortController | null>(null)
  const stoppedByUserRef = useRef(false)
  const streamingThreadIdRef = useRef<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isStreamingRef = useRef(false)
  const activeThreadIdRef = useRef<string | null>(null)

  const stopStreaming = useCallback(() => {
    stoppedByUserRef.current = true
    abortControllerRef.current?.abort()
  }, [])

  const abortStream = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setIsStreaming(false)
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    isSendingRef.current = false
  }, [])

  const loadMessages = useCallback(async (threadId: string) => {
    activeThreadIdRef.current = threadId
    const generation = sendGenerationRef.current
    const data = await getMessages(threadId)
    setMessages((prev) => {
      // If a different thread is being requested, always allow the update
      // so thread switching works even during active streaming.
      if (streamingThreadIdRef.current && streamingThreadIdRef.current !== threadId) {
        return data
      }
      // Same thread: don't wipe optimistic messages if a send is in flight
      // or if a newer send started while this fetch was in-flight.
      if (isSendingRef.current) return prev
      if (sendGenerationRef.current !== generation) return prev
      return data
    })
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

    // D-03: Realtime subscription for SSE drop recovery.
    // Subscribes filtered to this thread only. Torn down in finally.
    // Only processes events when streaming is NOT active (isStreamingRef guard)
    // to avoid racing with the live SSE delta updates.
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
          // D-04: Realtime is recovery-only. Skip events while SSE stream is active —
          // SSE delta events handle live updates. Only process after SSE drops/ends.
          if (isStreamingRef.current) return

          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as Message
            setMessages((prev) => {
              // Replace the optimistic temp-id placeholder for assistant messages,
              // or deduplicate by id for user messages.
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
              // Deduplicate: skip if already present (normal path persisted it)
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
        // Clear planning flag when stream ends — prevents stuck spinner
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, isPlanning: false } : m)
        )
      },
      model,
      provider,
      onTitleUpdate,
      // onToolPreparing — D-01/D-02 (Phase 56.1): creates a "preparing" placeholder entry
      // immediately when the tool name is known, before arguments finish streaming.
      (name: string, index: number) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            // Deduplicate on the synthetic id (preparing-{index}), not on name.
            // Keying on name silently drops the second tool_preparing for same-named parallel calls.
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
      // onToolStart — clear planning flag; upgrade preparing entry to running, or append if none
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
              // Upgrade the preparing entry to running in place (preserves ordering)
              updatedCalls = existingCalls.map((tc, i) =>
                i === preparingIdx
                  ? { ...tc, args, status: "running" as const, startedAt: Date.now() }
                  : tc
              )
            } else {
              // No preparing entry — append new running entry (fallback for race/reconnect).
              // Include a stable id so tool_end's name-match still works if it tries to match by id.
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
      // onSkillActivated — Phase 56 D-08/D-09: append to ordered activatedSkills array
      // for inline rendering in ToolCallPanel. Legacy activatedSkill field retained
      // for backward compat with components that read the single-value form.
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
      // onCodeExecutionStart — no-op (tool_start already created the ToolCall entry)
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
      // onCodeExecutionComplete — sets data fields only; tool_end will set status="done"
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
      // onSuggestions — ephemeral, like confidence (not persisted)
      (questions) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, suggestions: questions } : m)
        )
      },
      // onPlanning — agent finished one tool-call round, deciding next action
      () => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, isPlanning: true } : m)
        )
      },
      // onIterationStart — Phase 56 D-03/D-04: increment Step N counter on each loop pass
      (iteration: number) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, iterationCount: iteration } : m,
          ),
        )
      },
      // onFallbackModel — sub-agent retried with provider default after 404
      (original: string, fallback: string) => {
        setFallbackNotice(`Model ${original} unavailable — using ${fallback}.`)
        setTimeout(() => setFallbackNotice(null), 4000)
      },
      controller.signal,
    )
    } catch (err) {
      // Swallow abort errors — user intentionally stopped
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.error(err)
      }
} finally {
      abortControllerRef.current = null
      isSendingRef.current = false
      streamingThreadIdRef.current = null
      setIsStreaming(false)
      isStreamingRef.current = false  // D-04: allow Realtime callbacks to process now

      // Phase 56 D-14/D-16: Delay channel teardown by 2000ms so a late-arriving
      // Realtime INSERT (the persisted assistant message from asyncio.shield in
      // Phase 55) can still be processed. isStreamingRef is already false (set just
      // above) so the guard no longer blocks the event.
      // Per 055-DEFERRAL.md "Recommended Approach": instrument with console.log first.
      const channelToRemove = channelRef.current
      channelRef.current = null
      if (channelToRemove) {
        setTimeout(() => {
          supabase.removeChannel(channelToRemove)
        }, 2000)
      }

      // Always clear planning flag on stream end
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, isPlanning: false } : m)
      )

      const wasStoppedByUser = stoppedByUserRef.current

      // Mark running or preparing tool calls as "interrupted" if the user stopped the stream
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
          const updated = prev.map((m) =>
            m.id === assistantId
              ? { ...m, ...(wasStoppedByUser ? { stopped: true } : {}) }
              : m
          )
          // Only reload from DB if the user is still on the same thread.
          // Skip the reload on navigation abort — the new thread's loadMessages
          // has already started.
          if (!wasStoppedByUser) {
            setTimeout(() => {
              stoppedByUserRef.current = false
            }, 0)
            // Fix E (D-STREAM-01/D-STREAM-02): Reload from DB after natural stream completion.
            // The Realtime INSERT fires while isStreamingRef=true and is blocked by the guard.
            // By the time isStreamingRef=false, the INSERT event is gone — so we pull from DB.
            // Guards per D-STREAM-02:
            //   activeThreadIdRef === threadId: user hasn't navigated to a different thread
            //   !stoppedByUserRef: stop path already persisted via asyncio.shield
            if (activeThreadIdRef.current === threadId && !stoppedByUserRef.current) {
              loadMessages(threadId).catch(console.error)
            }
          } else {
            setTimeout(() => {
              stoppedByUserRef.current = false
              loadMessages(threadId).catch(console.error)
            }, 800)
          }
          return updated
        }

        stoppedByUserRef.current = false
        return prev
      })
    }
  }, [loadMessages])

  return { messages, isStreaming, fallbackNotice, loadMessages, sendMessage, stopStreaming, abortStream, clearMessages }
}
