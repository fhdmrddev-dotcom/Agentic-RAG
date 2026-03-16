import { useEffect } from "react"
import { MessageList } from "./MessageList"
import { MessageInput } from "./MessageInput"
import { useMessages } from "@/hooks/useMessages"
import type { Thread } from "@/types"

interface Props {
  thread: Thread | null
  onCreateThread: () => Promise<Thread>
}

export function ChatArea({ thread, onCreateThread }: Props) {
  const { messages, isStreaming, loadMessages, sendMessage } = useMessages()

  useEffect(() => {
    if (thread) {
      loadMessages(thread.id).catch(console.error)
    }
  }, [thread, loadMessages])

  const handleSend = async (content: string) => {
    let activeThread = thread
    if (!activeThread) {
      activeThread = await onCreateThread()
    }
    await sendMessage(activeThread.id, content)
  }

  if (!thread) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          <div className="text-center space-y-2">
            <p className="text-2xl">👋</p>
            <p>Select a chat or start a new one</p>
          </div>
        </div>
        <MessageInput onSend={handleSend} disabled={isStreaming} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-3">
        <h2 className="font-medium text-sm truncate">{thread.title}</h2>
      </div>
      <MessageList messages={messages} isStreaming={isStreaming} />
      <MessageInput onSend={handleSend} disabled={isStreaming} />
    </div>
  )
}
