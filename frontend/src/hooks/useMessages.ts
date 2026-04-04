import { useState, useCallback, useRef } from "react"
import type { Message, ToolCall, OutputLine, OutputFile } from "../types"
import { getMessages, streamMessage } from "../lib/api"

interface UseMessages {
  messages: Message[]
  isStreaming: boolean
  loadMessages: (threadId: string) => Promise<void>
  sendMessage: (threadId: string, content: string, model?: string, onTitleUpdate?: (title: string) => void, agentMode?: string, provider?: string) => Promise<void>
}

function makeTempId() {
  return `temp-${Date.now()}-${Math.random()}`
}

export function useMessages(): UseMessages {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const isSendingRef = useRef(false)

  const loadMessages = useCallback(async (threadId: string) => {
    const data = await getMessages(threadId)
    setMessages(data)
  }, [])

  const sendMessage = useCallback(async (threadId: string, content: string, model?: string, onTitleUpdate?: (title: string) => void, agentMode?: string, provider?: string) => {
    if (isSendingRef.current) return
    isSendingRef.current = true

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

    try {
      await streamMessage(
      threadId,
      content,
      (delta) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)),
        )
      },
      () => {
        setIsStreaming(false)
      },
      model,
      provider,
      onTitleUpdate,
      // onToolStart
      (name, args) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const newTool: ToolCall = { name, args, status: "running", startedAt: Date.now() }
            return { ...m, tool_calls: [...(m.tool_calls ?? []), newTool] }
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
    )
    } catch {
      setIsStreaming(false)
    } finally {
      isSendingRef.current = false
    }
  }, [])

  return { messages, isStreaming, loadMessages, sendMessage }
}
