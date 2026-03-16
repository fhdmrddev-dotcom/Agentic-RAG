import { useState, useCallback } from "react"
import type { Message } from "../types"
import { getMessages, streamMessage } from "../lib/api"

interface UseMessages {
  messages: Message[]
  isStreaming: boolean
  loadMessages: (threadId: string) => Promise<void>
  sendMessage: (threadId: string, content: string) => Promise<void>
}

function makeTempId() {
  return `temp-${Date.now()}-${Math.random()}`
}

export function useMessages(): UseMessages {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  const loadMessages = useCallback(async (threadId: string) => {
    const data = await getMessages(threadId)
    setMessages(data)
  }, [])

  const sendMessage = useCallback(async (threadId: string, content: string) => {
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
    }
    setMessages((prev) => [...prev, assistantMsg])
    setIsStreaming(true)

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
    )
  }, [])

  return { messages, isStreaming, loadMessages, sendMessage }
}
