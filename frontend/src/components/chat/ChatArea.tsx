import { useEffect, useState } from "react"
import { MessageList } from "./MessageList"
import { MessageInput } from "./MessageInput"
import { useMessages } from "@/hooks/useMessages"
import { listModels } from "@/lib/api"
import type { Thread } from "@/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Props {
  thread: Thread | null
  onCreateThread: () => Promise<Thread>
}

export function ChatArea({ thread, onCreateThread }: Props) {
  const { messages, isStreaming, loadMessages, sendMessage } = useMessages()
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>("")

  useEffect(() => {
    listModels()
      .then(({ models, default: def }) => {
        setModels(models)
        setSelectedModel(def)
      })
      .catch(console.error)
  }, [])

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
    await sendMessage(activeThread.id, content, selectedModel || undefined)
  }

  const modelSelector = models.length > 1 && (
    <Select value={selectedModel} onValueChange={setSelectedModel}>
      <SelectTrigger className="h-7 text-xs w-auto max-w-[220px] border-0 bg-muted/50 focus:ring-0">
        <SelectValue placeholder="Model" />
      </SelectTrigger>
      <SelectContent>
        {models.map((m) => (
          <SelectItem key={m} value={m} className="text-xs">
            {m}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

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
      <div className="border-b px-6 py-3 flex items-center justify-between gap-4">
        <h2 className="font-medium text-sm truncate">{thread.title}</h2>
        {modelSelector}
      </div>
      <MessageList messages={messages} isStreaming={isStreaming} />
      <MessageInput onSend={handleSend} disabled={isStreaming} />
    </div>
  )
}
