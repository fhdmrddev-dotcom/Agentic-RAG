import { useCallback, useEffect, useRef, useState } from "react"
import { MessageList } from "./MessageList"
import { MessageInput } from "./MessageInput"
import { useMessages } from "@/hooks/useMessages"
import { getMessages, getProviders } from "@/lib/api"
import type { Folder, Thread } from "@/types"
import { Folder as FolderIcon, Menu, Sparkles } from "lucide-react"

interface Provider {
  id: string
  name: string
  models: string[]
  is_active: boolean
}

interface Props {
  thread: Thread | null
  onCreateThread: (folderId?: string | null) => Promise<Thread>
  onTitleUpdate?: (title: string) => void
  folders: Folder[]
  prefillMessage?: string | null
  onClearPrefill?: () => void
  onOpenDrawer?: () => void
}

export function ChatArea({ thread, onCreateThread, onTitleUpdate, folders, prefillMessage, onClearPrefill, onOpenDrawer }: Props) {
  const { messages, isStreaming, fallbackNotice, loadMessages, sendMessage, stopStreaming, abortStream, clearMessages, subscribeToThread, unsubscribeFromThread } = useMessages()
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string>("")
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [agentMode, setAgentMode] = useState<"default" | "explorer">("default")
  const [scopeFolderId, setScopeFolderId] = useState<string | null>(null)
  const justCreatedThreadRef = useRef<string | null>(null)

  useEffect(() => {
    setAgentMode("default")
    setScopeFolderId(null)
  }, [thread?.id])

  useEffect(() => {
    getProviders()
      .then(({ active, active_model, providers: list }) => {
        setProviders(list)
        const activeProvider = list.find((p) => p.id === active) ?? list[0]
        if (activeProvider) {
          setSelectedProvider(activeProvider.id)
          setModels(activeProvider.models)
          const preferred = active_model && activeProvider.models.includes(active_model)
            ? active_model
            : (activeProvider.models[0] ?? "")
          setSelectedModel(preferred)
        }
      })
      .catch(console.error)
  }, [])

  // Update model list when provider changes
  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId)
    const p = providers.find((x) => x.id === providerId)
    if (p) {
      setModels(p.models)
      setSelectedModel(p.models[0] ?? "")
    }
  }

  // Ref to mirror isStreaming for use in stable callbacks without stale closures
  const isStreamingRef = useRef(false)
  isStreamingRef.current = isStreaming

  // Polling controller — cancelled on thread change or unmount
  const pollAbortRef = useRef<AbortController | null>(null)

  // FIX 5: Poll for a pending assistant response after F5 mid-stream.
  // After initial loadMessages, if the last message is role=user, the backend
  // may still be generating via asyncio.shield. Poll every 2s for up to 30s.
  // This replaces the unreliable 8s unconditional timer from Phase 057.
  const startPollForPendingResponse = useCallback((threadId: string) => {
    pollAbortRef.current?.abort()
    const abortCtrl = new AbortController()
    pollAbortRef.current = abortCtrl

    let attempts = 0
    const maxAttempts = 15 // 30 seconds at 2s intervals

    const poll = async () => {
      if (abortCtrl.signal.aborted) return
      try {
        const msgs = await getMessages(threadId)
        if (abortCtrl.signal.aborted) return
        const lastMsg = msgs[msgs.length - 1]
        if (lastMsg?.role === "assistant") {
          // Response arrived — loadMessages will update state with guards intact
          loadMessages(threadId).catch(console.error)
          return
        }
        attempts++
        if (attempts >= maxAttempts) return
        setTimeout(poll, 2000)
      } catch {
        // Network error — stop polling silently
      }
    }

    // Check after 1s to let the initial loadMessages setState settle
    setTimeout(async () => {
      if (abortCtrl.signal.aborted) return
      try {
        const msgs = await getMessages(threadId)
        if (abortCtrl.signal.aborted) return
        if (msgs[msgs.length - 1]?.role === "user") {
          poll()
        }
      } catch { /* ignore */ }
    }, 1000)
  }, [loadMessages])

  // FIX 4: Thread-switch effect — abort-first order, single dependency.
  //
  // Old order (clearMessages then abortStream) caused clearMessages to abort
  // the SSE as a side effect, triggering sendMessage's finally block before
  // the new thread's state was set up — racing loadMessages(threadA) against
  // loadMessages(threadB). Now clearMessages() does NOT abort (FIX 2), so we
  // call abortStream() explicitly first, then clear, then load.
  //
  // Dependency array is [thread?.id] only. All functions are stable
  // (useCallback with [] deps using refs internally). Listing them would cause
  // the effect to re-fire on every render if any future change adds a dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!thread) {
      clearMessages()
      unsubscribeFromThread()
      return
    }
    // Skip when handleSend just created this thread — sendMessage is already
    // streaming; clearMessages() here would wipe the optimistic messages.
    if (justCreatedThreadRef.current === thread.id) {
      justCreatedThreadRef.current = null
      return
    }

    // IMPORTANT: abort FIRST so sendMessage's finally runs with the old thread
    // context before we wipe state. clearMessages() no longer aborts (FIX 2).
    abortStream()
    clearMessages()

    const threadId = thread.id
    loadMessages(threadId)
      .then(() => startPollForPendingResponse(threadId))
      .catch(console.error)

    subscribeToThread(threadId)

    // FIX 5 (Symptom E): reload when user switches back to this tab.
    // Guard: skip during active streaming — SSE deltas are the source of truth;
    // fetching from DB would overwrite in-progress content with stale state.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isStreamingRef.current) {
        loadMessages(threadId).catch(console.error)
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      unsubscribeFromThread()
      pollAbortRef.current?.abort()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [thread?.id])

  const handleSend = async (content: string) => {
    let activeThread = thread
    if (!activeThread) {
      activeThread = await onCreateThread(scopeFolderId)
      justCreatedThreadRef.current = activeThread.id
    }
    await sendMessage(
      activeThread.id,
      content,
      selectedModel || undefined,
      onTitleUpdate,
      agentMode,
      selectedProvider || undefined,
    )
  }

  const inputBar = (
    <MessageInput
      onSend={handleSend}
      onStop={stopStreaming}
      disabled={isStreaming}
      providers={providers}
      selectedProvider={selectedProvider}
      onProviderChange={handleProviderChange}
      models={models}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      agentMode={agentMode}
      onAgentModeChange={setAgentMode}
      prefillMessage={prefillMessage}
      onClearPrefill={onClearPrefill}
    />
  )

  if (!thread) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Mobile nav trigger for welcome state */}
        <div className="md:hidden px-4 py-2 flex items-center border-b border-border/30">
          <button
            type="button"
            className="flex items-center justify-center w-11 h-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label="Open navigation"
            onClick={onOpenDrawer}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-5 max-w-md px-6 animate-fadeSlideUp">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="font-headline font-bold text-xl text-foreground">How can I help you?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ask me anything, or upload documents and I'll answer based on their content.
              </p>
            </div>
            {folders.length > 0 && (
              <div className="mt-3">
                <select
                  value={scopeFolderId ?? ""}
                  onChange={(e) => setScopeFolderId(e.target.value || null)}
                  className="text-sm rounded-lg px-4 py-2 bg-card text-foreground ghost-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                >
                  <option value="">All documents</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1.5">
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
      <div className="px-6 py-3 bg-background/80 backdrop-blur-md flex items-center gap-2.5 border-b border-border/30">
        {/* Mobile menu trigger */}
        <button
          type="button"
          className="md:hidden flex items-center justify-center w-11 h-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="Open navigation"
          onClick={onOpenDrawer}
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="font-headline font-semibold text-sm truncate text-foreground">{thread.title}</h2>
        {thread.folder_id && (
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
            <FolderIcon className="h-3 w-3" />
            {scopedFolder?.name ?? "Folder"}
          </span>
        )}
      </div>
      {fallbackNotice && (
        <div className="text-xs text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-md mx-3 my-1">
          {fallbackNotice}
        </div>
      )}
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        onSendMessage={handleSend}
        showSuggestions={agentMode !== "explorer"}
      />
      {inputBar}
    </div>
  )
}
