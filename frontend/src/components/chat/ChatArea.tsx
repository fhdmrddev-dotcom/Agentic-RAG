import { useEffect, useRef, useState } from "react"
import { MessageList } from "./MessageList"
import { MessageInput } from "./MessageInput"
import { useMessages } from "@/hooks/useMessages"
import { getProviders } from "@/lib/api"
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
  const {
    messages,
    isStreaming,
    fallbackNotice,
    loadMessages,
    sendMessage,
    stopStreaming,
    clearMessages,
    setViewingThread,
    reconcile,
    resumeFromFailed,
  } = useMessages()
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

  useEffect(() => {
    // D-060-08: setViewingThread is the FIRST action — it must run before any concurrent
    // loadMessages resolution checks activeThreadIdRef. Sole writer per D-060-01.
    setViewingThread(thread?.id ?? null)
    if (!thread) {
      clearMessages()
      return
    }
    // Skip clear+load when handleSend just created this thread — sendMessage is
    // already streaming into it and clearMessages() would wipe the optimistic
    // messages, causing a blank chat.
    if (justCreatedThreadRef.current === thread.id) {
      justCreatedThreadRef.current = null
      return
    }
    // D-063.1-07 / Gap-003: abortStream() removed here. Lets the in-flight
    // sendMessage SSE consumer survive thread switch. The consumer keeps
    // writing through the guardedSetMessages no-op (D-063.1-08) until the
    // user navigates back. Cleanup of consumer-side sockets remains owned by:
    //   1. loadAbortRef.current?.abort() inside loadMessages — cancels stale
    //      getMessages fetches; UNCHANGED.
    //   2. Hook unmount effect (useMessages.ts:805-815) — aborts all
    //      subscriptions on hook teardown (logout/route); UNCHANGED.
    //   3. onTerminal cleanup in sendMessage / reconcile — deletes from
    //      subscriptionsRef when SSE actually terminates server-side; UNCHANGED.
    // abortStream STAYS exported from useMessages — still used by genuine
    // timeout cases (loadMessages's loadAbortRef path). Only THIS call site
    // is removed.
    clearMessages()
    loadMessages(thread.id).catch(console.error)
    // Phase 060 deletes the 8s fallback timer (D-060-07b) and the tab-visibility
    // listener (D-060-07c). Phase 061 reintroduces tab-switch + F5 recovery via the
    // proper polling/tab-visibility/pageshow mechanism on this clean foundation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id])

  // Phase 063 (Pattern 2 + CONTEXT.md "Reconciliation Hook Ordering"):
  // Mount + visibility/focus/pageshow triggers → reconcile via active-runs.
  // Pageshow MUST be additive to visibilitychange (Anti-Pattern: don't gate
  // reconcile on pageshow alone — older browsers and some mobile contexts
  // don't fire pageshow reliably). bfcache restore (event.persisted === true)
  // ALWAYS reconciles regardless of local state per CONTEXT.md mandate.
  //
  // WR-07 fix: route reconcile through a ref so the effect's dep array
  // does NOT include the function identity. Otherwise any future change
  // that recreates reconcile mid-stream would tear down + re-add the
  // visibility/focus/pageshow listeners and re-fire reconcile while the
  // previous one is still resolving.
  const reconcileRef = useRef(reconcile)
  useEffect(() => {
    reconcileRef.current = reconcile
  }, [reconcile])

  useEffect(() => {
    if (!thread?.id) return
    const tid = thread.id
    reconcileRef.current(tid).catch(console.error)

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        reconcileRef.current(tid).catch(console.error)
      }
    }
    const onFocus = () => reconcileRef.current(tid).catch(console.error)
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) reconcileRef.current(tid).catch(console.error)
    }

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onFocus)
    window.addEventListener("pageshow", onPageShow)

    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("pageshow", onPageShow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        onResume={resumeFromFailed}
      />
      {inputBar}
    </div>
  )
}
