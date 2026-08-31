import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { MessageList } from "./MessageList"
import { MessageInput } from "./MessageInput"
import { useMessages } from "@/hooks/useMessages"
import { useStreamsStore } from "@/stores/streamsStore"
import {
  useStreamingForThread,
  useLoadingForThread,
  useReconcileErrorForThread,
  useFallbackNoticeForThread,
  useFailedSendDraftForThread,
  useWorkflowLockForThread,
  useStreamActions,
} from "@/providers/StreamsProvider"
import {
  getThreadWorkflow,
  ApiError,
} from "@/lib/api"
import { useComposerModel } from "@/hooks/useComposerModel"
import type { Folder, Thread } from "@/types"
import { Folder as FolderIcon, Menu, Sparkles, PanelLeftOpen } from "lucide-react"

interface Props {
  thread: Thread | null
  onCreateThread: (folderId?: string | null) => Promise<Thread>
  onTitleUpdate?: (threadId: string, title: string) => void
  folders: Folder[]
  prefillMessage?: string | null
  onClearPrefill?: () => void
  onOpenDrawer?: () => void
  // Phase 156 REFINEMENT (operator 2026-07-16): reopens the folded-away chat-history
  // column (sketch Variant A #reopenA — the ▷ handle in the chat top-bar). Provided by
  // ChatLayout ONLY while the history is collapsed; undefined otherwise, so the handle
  // renders exactly when there's a hidden column to bring back.
  onReopenHistory?: () => void
}

export function ChatArea({ thread, onCreateThread, onTitleUpdate, folders, prefillMessage, onClearPrefill, onOpenDrawer, onReopenHistory }: Props) {
  // Plan 075.4-01 D-075.4-A1: useMessages still exposes the viewed-thread
  // values (isStreaming, fallbackNotice) for back-compat — but the composer
  // disabled prop and per-thread surfaces go through the direct selectors
  // below so cross-thread isolation is preserved regardless of which thread
  // is currently being viewed.
  const {
    messages,
    loadMessages,
    sendMessage,
    clearMessages,
    setViewingThread,
    resumeFromFailed,
  } = useMessages()
  // Phase 196 Plan 07 (D-18 / BUG-260718-04) — THE COMPOSER'S PROVIDER/MODEL MACHINE LIVES
  // IN THE LEAF HOOK IMPORTED AT THE TOP OF THIS FILE. Five useState declarations
  // (providers, selectedProvider, models, selectedModel, deprecatedModels), the
  // getProviders load effect and the provider-change handler all moved there, taking this
  // file's `useState` 7 → 2 and `useEffect` 4 → 3. That reduction is how G-5 is honoured on
  // the ledger's strongest frontend extraction case: by arithmetic, not by argument. Do not
  // move this state back, and do not add a per-thread effect here — the restore rung lives
  // in the hook precisely so this file's counts stay where they landed.
  //
  // ⚠ The hook's name is spelled in exactly two places in this file — the import and the
  // destructure immediately below — and deliberately NOT in this sentence, so a raw
  // `grep -c` stays DISCRIMINATING and reads 2. Do not "tidy" this by naming it here.
  const {
    providers,
    selectedProvider,
    models,
    selectedModel,
    setSelectedModel,
    deprecatedModels,
    handleProviderChange,
  } = useComposerModel(thread?.id ?? null, messages)
  const [agentMode, setAgentMode] = useState<"default" | "explorer">("default")
  const [scopeFolderId, setScopeFolderId] = useState<string | null>(null)
  const justCreatedThreadRef = useRef<string | null>(null)

  // Plan 075.4-01 D-075.4-A1: thread-scoped reads. The composer disable
  // (BUG-260523-01 close), MessageList streaming prop, and reconcile/
  // fallback banners all derive from THIS thread's state — Thread A
  // streaming no longer disables Thread B's composer.
  const isStreaming = useStreamingForThread(thread?.id ?? null)
  const fallbackNotice = useFallbackNoticeForThread(thread?.id ?? null)
  const reconcileError = useReconcileErrorForThread(thread?.id ?? null)
  // 099-08 (UAT L10): refusals the user cannot fix by retrying the SAME send —
  // the gate-refusal status set (400/403/404/422) + the 409 lock-refusal. The
  // banner hides Retry for these (Retry on a gate refusal is misleading).
  const NON_RETRYABLE = new Set([400, 403, 404, 409, 422])
  const hideRetry =
    reconcileError instanceof ApiError && NON_RETRYABLE.has(reconcileError.status)
  // 099-08 (UAT L10): the per-thread stashed prompt from a send refusal. When
  // present it pre-fills the composer (preferred over the parent prefill prop)
  // so the user's typed prompt is recoverable, then is cleared on consume.
  const failedDraft = useFailedSendDraftForThread(thread?.id ?? null)
  // Phase 092 (MODE-02 — SC#3): the per-thread workflow lock, keyed by the
  // OWNING thread id (thread?.id) — never viewedThreadId or a global flag, so a
  // background workflow on another thread cannot lock THIS composer. Drives the
  // disable-with-tooltip on both selectors (D-03/D-05).
  const workflowLock = useWorkflowLockForThread(thread?.id ?? null)
  const workflowLocked = workflowLock !== null
  const streamActions = useStreamActions()
  // Phase 068.5 Gap-01: true when this thread has a loadMessages fetch in
  // flight. Passed to MessageList so the cold-load skeleton only renders when
  // we're actually waiting on data (not on new/empty threads with no fetch).
  // Plan 075.4-01 D-075.4-A1: thread-scoped loadingThreads selector.
  const isLoadingThisThread = useLoadingForThread(thread?.id ?? null)
  const handleRetryReconcile = useCallback(() => {
    // Plan 075.4-01 D-075.4-A1: per-thread reconcileErrors — clear this
    // thread's entry only (no cross-thread bleed).
    if (thread) {
      useStreamsStore.setState((s) => {
        if (!s.reconcileErrors.has(thread.id)) return {}
        const next = new Map(s.reconcileErrors)
        next.delete(thread.id)
        return { reconcileErrors: next }
      })
      loadMessages(thread.id).catch(console.error)
    }
  }, [thread, loadMessages])
  const dismissReconcileError = useCallback(() => {
    // Plan 075.4-01 D-075.4-A1: per-thread reconcileErrors clear.
    if (!thread) return
    useStreamsStore.setState((s) => {
      const hasErr = s.reconcileErrors.has(thread.id)
      // 099-08 (UAT L10): clear the stashed draft symmetrically so dismissing
      // the banner does not leave a stale draft that re-fills the composer.
      const hasDraft = s.failedSendDrafts.has(thread.id)
      if (!hasErr && !hasDraft) return {}
      const patch: Partial<typeof s> = {}
      if (hasErr) {
        const next = new Map(s.reconcileErrors)
        next.delete(thread.id)
        patch.reconcileErrors = next
      }
      if (hasDraft) {
        const nextDrafts = new Map(s.failedSendDrafts)
        nextDrafts.delete(thread.id)
        patch.failedSendDrafts = nextDrafts
      }
      return patch
    })
  }, [thread])

  useEffect(() => {
    setAgentMode("default")
    setScopeFolderId(null)
  }, [thread?.id])

  // Phase 092 (SC#5 / D-v2.5-03): mount-time reconcile of the workflow lock +
  // Continue state from GET /threads/{id}/workflow — the SOURCE OF TRUTH, never
  // a stale Realtime/SSE hint. Runs on every thread switch. A locked, non-stale
  // run sets the per-thread lock (keyed by THIS thread id); a stale/terminal
  // anchor or Deep mode clears it. This is what survives a page reload (SC#5).
  useEffect(() => {
    const tid = thread?.id
    if (!tid) return
    const controller = new AbortController()
    getThreadWorkflow(tid, controller.signal)
      .then((state) => {
        if (controller.signal.aborted) return
        if (state.locked && !state.lock_is_stale && state.active_workflow_run_id) {
          streamActions.setWorkflowLockForThread(tid, {
            runId: state.active_workflow_run_id,
            mode: "harness",
            capPaused: state.cap_paused,
            continuesRemaining: state.continues_remaining,
          })
        } else {
          // Deep, or a stale/terminal anchor (SC#5 self-heal) — never leave a
          // dangling lock on this thread.
          streamActions.clearWorkflowLockForThread(tid)
        }
      })
      .catch((err) => {
        if (!(err instanceof Error && err.name === "AbortError")) {
          console.error("getThreadWorkflow reconcile failed:", err)
        }
      })
    return () => controller.abort()
  }, [thread?.id, streamActions])

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
    //
    // Phase 075.1 Plan 04 — Test 2 / MESSAGES-DEBUG agent's single-line fix
    // (Test 2 dual-`/messages` after `/snapshot` closure):
    // setViewingThread (in StreamsProvider) already fires reconcile internally
    // (StreamsProvider.tsx:495-501 — Phase 068 Task 2c). The prior
    // loadMessages(thread.id) here was a duplicate trigger producing a second
    // /messages request per thread switch. Snapshot-based reconcile is now
    // the sole data source post-Phase-075 — the dedicated /messages endpoint
    // is no longer called from ChatArea on mount. Retry handler at line ~61
    // still calls loadMessages for the manual Retry button — intentional.
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

  // Plan 075.4-04 D-075.4-SC#6 — stabilize callbacks for React.memo(MessageItem)
  // shallow-eq path. handleSend is the chat-input wired callback; onSendMessage
  // is the stable identity passed to MessageList → MessageItem (suggestion
  // pill onSelect). onResume mirrors the same useCallback-stabilization
  // pattern for the Resume button on failed/timed_out assistant messages.
  const handleSend = useCallback(async (content: string, activeConnectorIds?: string[]) => {
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
      //
      // Phase 176-04 (RENDER-03 / D-10.1): mark the just-created thread pending-send
      // BEFORE setViewingThread fires its reconcile, so that nav reconcile preserves
      // the optimistic temp sendMessage is about to write. markThreadPendingSend adds
      // ONLY to pendingSendThreadsRef (not sendingThreadsRef), so sendMessage's
      // duplicate-guard is untripped and the real send below still dispatches; the
      // provider releases the pending flag when the send resolves/aborts.
      streamActions.markThreadPendingSend(activeThread.id)
      setViewingThread(activeThread.id)
    }
    await sendMessage(
      activeThread.id,
      content,
      selectedModel || undefined,
      onTitleUpdate,
      agentMode,
      selectedProvider || undefined,
      undefined,
      activeConnectorIds,
    )
  }, [thread, scopeFolderId, onCreateThread, selectedModel, onTitleUpdate, agentMode, selectedProvider, sendMessage, setViewingThread, streamActions])

  // Plan 075.4-04 D-075.4-SC#6 — onSendMessage is the stable identity passed
  // to MessageList → MessageItem (SuggestionPills onSelect). Wraps handleSend
  // unchanged; rename-to-onSendMessage solely so the memo'd MessageItem sees a
  // ref-stable prop across parent re-renders.
  const onSendMessage = useCallback(
    (content: string) => { void handleSend(content) },
    [handleSend],
  )

  // Plan 075.4-04 D-075.4-SC#6 — onResume stabilization. resumeFromFailed
  // already has stable identity from the StreamsProvider Zustand action layer,
  // but wrapping in useCallback here makes the dependency contract explicit
  // and protects against future re-binding inside the provider.
  const onResume = useCallback(
    (message: Parameters<typeof resumeFromFailed>[0]) => resumeFromFailed(message),
    [resumeFromFailed],
  )

  // Plan 075.4-01 D-075.4-A1: thread-scoped composer enablement; closes
  // BUG-260523-01 at the `disabled` prop below. `isStreaming` here is the
  // value of useStreamingForThread(thread?.id ?? null) (declared at the top
  // of this component), so Thread A streaming will NOT disable Thread B's
  // composer.
  const inputBar = (
    <MessageInput
      onSend={handleSend}
      /* Phase 194.1 Plan 04 (RUN-01 / D-05/D-22) — THE STOP-DISPATCHER PROP IS GONE
         from this element. The composer's Stop is `StopControl` (written WITHOUT its
         JSX angle bracket on purpose — that token is a fence needle counting real
         mounts, and this page must contain zero), which calls
         `stopThread(threadId)` off the StreamsProvider store; this page no longer
         threads a dispatcher down, and `stopStreaming` is no longer destructured
         from `useMessages` above.

         ⚠ The prop's name is spelled nowhere in this file, including in this
         sentence explaining its absence — so a raw grep for it stays DISCRIMINATING
         and any occurrence means it came back. Same discipline as `MessageInput`'s
         `Props` docblock; do not "tidy" this by naming it.

         ⚠ `stopStream` itself SURVIVES on `useMessages`' action surface — removing
         it is a Deep-path change, deferred with the trigger *"a phase that touches
         `useMessages`' action surface"*. */
      disabled={isStreaming}
      threadId={thread?.id ?? null}
      providers={providers}
      selectedProvider={selectedProvider}
      onProviderChange={handleProviderChange}
      models={models}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      deprecatedModels={deprecatedModels}
      agentMode={agentMode}
      onAgentModeChange={setAgentMode}
      prefillMessage={failedDraft ?? prefillMessage}
      onClearPrefill={() => {
        // 099-08 (UAT L10): clear the stashed draft once the composer consumes
        // it so it pre-fills exactly once per refusal (not on every render).
        if (thread?.id) {
          useStreamsStore.setState((s) => {
            if (!s.failedSendDrafts.has(thread.id)) return {}
            const next = new Map(s.failedSendDrafts)
            next.delete(thread.id)
            return { failedSendDrafts: next }
          })
        }
        onClearPrefill?.()
      }}
      workflowLocked={workflowLocked}
    />
  )

  // Phase 156 REFINEMENT: the ▷ "Show chat history" handle (sketch #reopenA). Desktop-
  // only (mobile uses the drawer); rendered only when the history is collapsed
  // (onReopenHistory provided). Reused in both the welcome and the active-thread header.
  const reopenHistoryButton = onReopenHistory ? (
    <button
      type="button"
      onClick={onReopenHistory}
      title="Show chat history"
      aria-label="Show chat history"
      className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <PanelLeftOpen className="w-[18px] h-[18px]" aria-hidden="true" />
    </button>
  ) : null

  if (!thread) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Phase 156 REFINEMENT: desktop reopen handle for the welcome state — only when
            history is collapsed (so an empty chat can still bring the list back). */}
        {reopenHistoryButton && (
          <div className="hidden md:flex px-4 py-2 items-center border-b border-border/30">
            {reopenHistoryButton}
          </div>
        )}
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

            {/* Phase 216 (CAT-04): Starter Prompts */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => void handleSend("Search recent files in connected cloud storage and summarize key points")}
                className="text-xs bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full border border-border/50 transition-colors"
              >
                📁 Search connected files
              </button>
              <button
                type="button"
                onClick={() => void handleSend("Draft a team status update")}
                className="text-xs bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full border border-border/50 transition-colors"
              >
                💬 Draft a team update
              </button>
            </div>
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
        {/* Phase 156 REFINEMENT: the ▷ reopen-history handle (desktop, collapsed-only). */}
        {reopenHistoryButton}
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
        {/* Phase 087-08 (operator directive 2026-05-29): the chat-header
            "Toggle workspace" button was REMOVED. The workspace panel now has a
            single nav-style in-panel toggle (collapse-to-rail); the always-present
            rail's Expand control is the sole reopen-by-mouse affordance and hosts
            the pulsing-amber-dot pending indicator. No workspace control lives in
            the chat header. */}
      </div>
      {fallbackNotice && (
        <div className="text-xs text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-md mx-3 my-1">
          {fallbackNotice}
        </div>
      )}
      {/* Phase 068.5 D-068.5-08..10: silent-1s-then-banner retry banner. Renders
          over cached content when loadMessages fails twice in a row. Dismissable
          (Retry re-fires reconcile; × clears state). Pattern S2 amber-400 chrome,
          sibling of fallbackNotice slot.

          Plan 075.4-01 D-075.4-A1: thread-scoped useReconcileErrorForThread
          returns null for any thread other than thread?.id by construction
          (per-thread Map keyed by threadId), so the legacy
          threadId-equality predicate is no longer needed. The selector
          naturally scopes — no cross-thread bleed. */}
      {reconcileError && (
        <div
          className="text-xs text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-md mx-3 my-1 flex items-center justify-between"
          data-testid={
            reconcileError instanceof ApiError && reconcileError.status === 409
              ? "workflow-lock-error-banner"
              : "reconcile-error-banner"
          }
          role="status"
          aria-live="polite"
        >
          {/* 099-08 (UAT L10): any ApiError (the 409 lock copy OR a server gate
              detail, e.g. a disabled-skill 400) shows its server-provided
              message. Rendered as React text children — never HTML
              (T-099-08-01). A plain reconcile Error (no status) keeps the
              cached-version copy + Retry. */}
          <span>
            {reconcileError instanceof ApiError
              ? reconcileError.message
              : "Couldn't load latest messages. Showing cached version."}
          </span>
          <span className="flex gap-2 items-center">
            {!hideRetry && (
              <button
                type="button"
                onClick={handleRetryReconcile}
                className="underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 rounded px-1"
                aria-label="Retry loading messages"
              >
                Retry
              </button>
            )}
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
      {/* Phase 194.1 Plan 06 (RUN-01 / D-15) — `threadId` is the ONE prop this plan
          threads, and it is the SAME expression this file already computes for the
          composer one screen up and for every per-thread store selector at the top of
          the component. Reused rather than re-derived, so the transcript and the
          composer can never disagree about which thread they are looking at.

          It is what lets `MessageList` mount the run-anchored line at LIST level. No
          state is added here: the line owns its own read and its own clock, which is
          why this file's `useState` / `useEffect` counts were unmoved by Phase 194.1.

          ⚠ THE FIGURE THIS SENTENCE USED TO QUOTE — "unmoved at 7 / 4" — IS NO LONGER THE
          READING, and it is corrected here rather than left to rot, because on this file the
          measurement IS the guardrail: a stale count answers the next auditor with a number
          that was true once and stops the audit. Phase 196-07 took the composer's
          provider/model machine out to a leaf hook, so the counts are now `useState` 2 and
          `useEffect` 3. Re-derive them, never copy them forward. */}
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        isLoading={isLoadingThisThread}
        onSendMessage={onSendMessage}
        showSuggestions={agentMode !== "explorer"}
        onResume={onResume}
        threadId={thread?.id ?? null}
      />
      {inputBar}
    </div>
  )
}
