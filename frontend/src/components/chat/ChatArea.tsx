import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { MessageList } from "./MessageList"
import { MessageInput } from "./MessageInput"
import { useMessages } from "@/hooks/useMessages"
import { useStreamsStore } from "@/stores/streamsStore"
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
    resumeFromFailed,
  } = useMessages()
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string>("")
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [agentMode, setAgentMode] = useState<"default" | "explorer">("default")
  const [scopeFolderId, setScopeFolderId] = useState<string | null>(null)
  const justCreatedThreadRef = useRef<string | null>(null)

  // Phase 068.5 (D-068.5-08..10): retry banner state + manual retry + dismiss.
  // The silent-1s-then-banner retry policy lives in StreamsProvider's
  // loadMessages action body; this surface only reads reconcileError and
  // exposes Retry / Dismiss affordances over cached content (banner never
  // blanks the message list — L-068.5-01 / L-068.5-03 preserve cached data).
  const reconcileError = useStreamsStore((s) => s.reconcileError)
  // Phase 068.5 Gap-01: true when this thread has a loadMessages fetch in
  // flight. Passed to MessageList so the cold-load skeleton only renders when
  // we're actually waiting on data (not on new/empty threads with no fetch).
  const loadingThreadId = useStreamsStore((s) => s.loadingThreadId)
  const isLoadingThisThread = !!thread && loadingThreadId === thread.id
  const handleRetryReconcile = useCallback(() => {
    useStreamsStore.setState({ reconcileError: null })
    if (thread) {
      loadMessages(thread.id).catch(console.error)
    }
  }, [thread, loadMessages])
  const dismissReconcileError = useCallback(() => {
    useStreamsStore.setState({ reconcileError: null })
  }, [])

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

  // D-067.2-02 / Phase 068 D-068-07/D-068-08: useLayoutEffect commits the
  // activeThreadIdRef write SYNCHRONOUSLY (inside <StreamsProvider>'s
  // setViewingThread action) after DOM mutation but BEFORE any sibling
  // useEffect runs. Two guarantees flow from that:
  //   1. activeThreadIdRef.current === thread.id before the provider's
  //      reconciliation listeners can fire — the D-068-08 null-gate never
  //      spuriously short-circuits on a real thread switch.
  //   2. setViewingThread's own reconciliation fire (Phase 068 Task 2c —
  //      lives in StreamsProvider.tsx now, NOT in this component) sees the
  //      freshly written ref, so guardedSetMessages at the provider's
  //      bucket writer does NOT no-op the replay-from-offset-0 events on
  //      F5 / mid-stream navigation.
  // D-068-07 / D-068-08: reconciliation listeners + the per-thread-change
  // reconciliation fire live inside <StreamsProvider>; this component owns
  // only the setViewingThread call below (Phase 068 Plan 3 deleted
  // ChatArea's listener block — D-068-07 single-owner gate).
  // D-060-08: setViewingThread remains the SOLE writer of activeThreadIdRef
  // per D-060-01 (assignment count == 1, enforced by Plan 1 Task 3 grep gate).
  useLayoutEffect(() => {
    setViewingThread(thread?.id ?? null)
  }, [thread?.id])

  useEffect(() => {
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
    // D-063.1-07 / Gap-003 (PRESERVED — DO NOT RE-ADD abortStream() HERE):
    // abortStream() is DELIBERATELY NOT called in this effect. Letting the
    // in-flight sendMessage SSE consumer survive thread switch is load-bearing:
    // the consumer keeps writing through the guardedSetMessages no-op
    // (D-063.1-08) until the user navigates back. Cleanup of consumer-side
    // sockets remains owned by:
    //   1. loadAbortRef.current?.abort() inside loadMessages — cancels stale
    //      getMessages fetches; UNCHANGED.
    //   2. Hook unmount effect (useMessages.ts) — aborts all subscriptions
    //      on hook teardown (logout/route); UNCHANGED.
    //   3. onTerminal cleanup in sendMessage / reconcile — deletes from
    //      subscriptionsRef when SSE actually terminates server-side; UNCHANGED.
    // abortStream STAYS exported from useMessages — still used by genuine
    // timeout cases (loadMessages's loadAbortRef path).
    //
    // Phase 067.3 (D-067.3-R1-01) per-thread store now LIVE: useMessages.ts
    // holds messagesByThread: Map<string, Message[]>. Deltas write to their
    // streamingThreadIdRef bucket regardless of viewing thread; the visible
    // `messages` array derives via useMemo against viewedThreadId. The race
    // this comment used to flag (cross-thread switch loses streamed-into
    // thread's render) is structurally closed.
    //
    // Phase 068.5 (RESEARCH §Finding #5): clearMessages() DELETED here.
    // bucketsBySurface is per-thread keyed (Phase 067.3 D-067.3-R1-01) — the
    // new viewing thread reads from its own bucket entry; the old viewing
    // thread's bucket entry stays warm for switch-back. Branch D-3 guard at
    // StreamsProvider.tsx:411-427 protects streaming buckets; reconcile-merge
    // at the loadMessages call below (L-068.5-02 MERGE 3-clause filter)
    // replaces stale non-streaming non-temp DB rows on the server response.
    // The unconditional clearMessages() was the literal in-app cause of the
    // BUG-260513-01 blank window. Deletion regression cost: zero — no
    // existing test asserts the call (verified during Plan 01 authoring).
    loadMessages(thread.id).catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id])

  // Phase 068 Plan 3 (D-068-07 / D-068-08): the reconciliation listeners and
  // the per-thread-change reconciliation fire moved into <StreamsProvider>
  // (see StreamsProvider.tsx — the listener useEffect near the bottom of the
  // component, plus the setViewingThread action body). The provider is now
  // the SOLE owner of those listeners (Phase 063 Pattern 2 + CONTEXT.md
  // "Reconciliation Hook Ordering" mandate satisfied at the provider
  // boundary). The old WR-07/WR-08 ref indirection ChatArea used to keep
  // listener identities stable is obsolete: post-lift, `reconcile` is a
  // Zustand action with stable identity, and the listener wiring no longer
  // lives in this component anyway. The `reconcile` destructure was dropped
  // from the useMessages() call above — no remaining consumer in this file.

  const handleSend = async (content: string) => {
    let activeThread = thread
    if (!activeThread) {
      activeThread = await onCreateThread(scopeFolderId)
      justCreatedThreadRef.current = activeThread.id
      // D-067.2-01: synchronously align activeThreadIdRef BEFORE sendMessage
      // begins. sendMessage sets streamingThreadIdRef.current = threadId at
      // useMessages.ts:513 and the first onDelta arrives ms later;
      // guardedSetMessages at useMessages.ts:623-628 no-ops the delta unless
      // streamingThreadIdRef === activeThreadIdRef. Without this line the
      // useLayoutEffect at the top of this component does not fire until the
      // parent re-renders with the new `thread` prop (50-500ms after
      // onCreateThread resolves), and every delta in the gap is silently
      // dropped — the empty-until-end-of-run user-observable failure.
      setViewingThread(activeThread.id)
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
      {/* Phase 068.5 D-068.5-08..10: silent-1s-then-banner retry banner. Renders
          over cached content when loadMessages fails twice in a row. Dismissable
          (Retry re-fires reconcile; × clears state). Pattern S2 amber-400 chrome,
          sibling of fallbackNotice slot. threadId predicate prevents stale banner
          rendering on a thread different from the failing one. */}
      {reconcileError && reconcileError.threadId === thread?.id && (
        <div
          className="text-xs text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-md mx-3 my-1 flex items-center justify-between"
          data-testid="reconcile-error-banner"
          role="status"
          aria-live="polite"
        >
          <span>Couldn&apos;t load latest messages. Showing cached version.</span>
          <span className="flex gap-2 items-center">
            <button
              type="button"
              onClick={handleRetryReconcile}
              className="underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 rounded px-1"
              aria-label="Retry loading messages"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={dismissReconcileError}
              className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 rounded px-1"
              aria-label="Dismiss"
            >
              ×
            </button>
          </span>
        </div>
      )}
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        isLoading={isLoadingThisThread}
        onSendMessage={handleSend}
        showSuggestions={agentMode !== "explorer"}
        onResume={resumeFromFailed}
      />
      {inputBar}
    </div>
  )
}
