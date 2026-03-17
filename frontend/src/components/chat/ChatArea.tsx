import { useEffect, useState } from "react"
import { MessageList } from "./MessageList"
import { MessageInput } from "./MessageInput"
import { useMessages } from "@/hooks/useMessages"
import { listModels } from "@/lib/api"
import type { Thread } from "@/types"
import { Sparkles } from "lucide-react"

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

  const inputBar = (
    <MessageInput
      onSend={handleSend}
      disabled={isStreaming}
      models={models}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
    />
  )

  if (!thread) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm px-6">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h2 className="font-semibold text-lg">How can I help you?</h2>
              <p className="text-sm text-muted-foreground">
                Ask me anything, or upload documents and I'll answer based on their content.
              </p>
            </div>
          </div>
        </div>
        {inputBar}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b px-6 py-3 bg-background/80 backdrop-blur-sm">
        <h2 className="font-medium text-sm truncate text-foreground">{thread.title}</h2>
      </div>
      <MessageList messages={messages} isStreaming={isStreaming} />
      {inputBar}
    </div>
  )
}
