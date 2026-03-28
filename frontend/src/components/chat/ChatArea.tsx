import { useEffect, useState } from "react"
import { MessageList } from "./MessageList"
import { MessageInput } from "./MessageInput"
import { useMessages } from "@/hooks/useMessages"
import { getSettings } from "@/lib/api"
import type { Folder, Thread } from "@/types"
import { Folder as FolderIcon, Sparkles } from "lucide-react"

interface Props {
  thread: Thread | null
  onCreateThread: (folderId?: string | null) => Promise<Thread>
  onTitleUpdate?: (title: string) => void
  folders: Folder[]
}

export function ChatArea({ thread, onCreateThread, onTitleUpdate, folders }: Props) {
  const { messages, isStreaming, loadMessages, sendMessage } = useMessages()
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [agentMode, setAgentMode] = useState<"default" | "explorer">("default")
  const [scopeFolderId, setScopeFolderId] = useState<string | null>(null)

  useEffect(() => {
    setAgentMode("default")
    setScopeFolderId(null)
  }, [thread?.id])

  useEffect(() => {
    getSettings()
      .then((s) => {
        setModels(s.available_models)
        setSelectedModel(s.llm_model)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (thread) {
      loadMessages(thread.id).catch(console.error)
    }
  }, [thread?.id, loadMessages])

  const handleSend = async (content: string) => {
    let activeThread = thread
    if (!activeThread) {
      activeThread = await onCreateThread(scopeFolderId)
    }
    await sendMessage(activeThread.id, content, selectedModel || undefined, onTitleUpdate, agentMode)
  }

  const inputBar = (
    <MessageInput
      onSend={handleSend}
      disabled={isStreaming}
      models={models}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      agentMode={agentMode}
      onAgentModeChange={setAgentMode}
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
            {folders.length > 0 && (
              <div className="mt-2">
                <select
                  value={scopeFolderId ?? ""}
                  onChange={(e) => setScopeFolderId(e.target.value || null)}
                  className="text-sm border rounded-md px-3 py-1.5 bg-background text-foreground"
                >
                  <option value="">All documents</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Scope this conversation to a specific folder
                </p>
              </div>
            )}
          </div>
        </div>
        {inputBar}
      </div>
    )
  }

  const scopedFolder = thread.folder_id ? folders.find((f) => f.id === thread.folder_id) : null

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b px-6 py-3 bg-background/80 backdrop-blur-sm flex items-center gap-2">
        <h2 className="font-medium text-sm truncate text-foreground">{thread.title}</h2>
        {thread.folder_id && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
            <FolderIcon className="h-3 w-3" />
            {scopedFolder?.name ?? "Folder"}
          </span>
        )}
      </div>
      <MessageList messages={messages} isStreaming={isStreaming} />
      {inputBar}
    </div>
  )
}
