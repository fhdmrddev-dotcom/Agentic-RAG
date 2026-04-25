import { useState, useCallback, useRef } from "react"
import type { Message, ToolCall, OutputLine, OutputFile } from "../types"
import { getMessages, streamMessage } from "../lib/api"

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
    const controller = new AbortController()
    abortControllerRef.current = controller

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
      },
      model,
      provider,
      onTitleUpdate,
      // onToolStart — clear planning flag when a new tool fires
      (name, args) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const newTool: ToolCall = { name, args, status: "running", startedAt: Date.now() }
            return { ...m, isPlanning: false, tool_calls: [...(m.tool_calls ?? []), newTool] }
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
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, activatedSkill: skillName }
              : m,
          ),
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

      const wasStoppedByUser = stoppedByUserRef.current

      // Mark running tool calls as "interrupted" if the user stopped the stream
      if (wasStoppedByUser) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.role !== "assistant") return m
            const hasRunning = m.tool_calls?.some((tc) => tc.status === "running")
            if (!hasRunning) return m
            return {
              ...m,
              tool_calls: m.tool_calls!.map((tc) =>
                tc.status === "running"
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
          } else {
            setTimeout(() => {
              stoppedByUserRef.current = false
              loadMessages(threadId).catch(console.error)
            }, 800)
          }
          return updated
        }

        // Safety net: if the stream ended but assistant message has no text content
        // (SSE connection dropped before final delta events arrived), reload from DB
        const sseDrop = lastMsg?.role === "assistant" && !lastMsg?.content
        const racedEmpty = prev.length === 0
        if (sseDrop || racedEmpty) {
          setTimeout(() => {
            stoppedByUserRef.current = false
            loadMessages(threadId).catch(console.error)
          }, 1500)
        }
        stoppedByUserRef.current = false
        return prev
      })
    }
  }, [loadMessages])

  return { messages, isStreaming, fallbackNotice, loadMessages, sendMessage, stopStreaming, abortStream, clearMessages }
}
