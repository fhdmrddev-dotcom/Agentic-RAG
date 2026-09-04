/**
 * Phase 068 (STREAMS-PROVIDER-01): useMessages is now a THIN READER delegating
 * to <StreamsProvider> named hooks. Public `UseMessages` interface preserved
 * byte-identical so ChatArea.tsx:27-38 imports work without edit.
 *
 * Pre-lift size: 1229 LOC (refs + makeStreamCallbacks factory + sendMessage +
 * reconcile + loadMessages + stopStream + resumeFromFailed). Post-lift target:
 * < 100 LOC (RESEARCH §Recommendation #4 plan-checker assertion).
 *
 * Plan 075.4-01 D-075.4-A1: `isStreaming` + `fallbackNotice` are now THREAD-
 * SCOPED under the hood. The public destructure shape that ChatArea consumes
 * (`{ messages, isStreaming, fallbackNotice, ... }`) is preserved BYTE-
 * IDENTICAL — only the values it sees change from "any thread streaming?" to
 * "is the VIEWED thread streaming?" and from a global fallback notice to the
 * viewed thread's notice. Direct thread-scoped reads (e.g. ChatArea's composer
 * `disabled` prop at L:221) go through the new
 * `useStreamingForThread(thread?.id)` selector — which is the actual close-out
 * for BUG-260523-01 (composer locked globally during any stream). This hook's
 * `isStreaming` value would NOT close the bug if ChatArea continued to read it
 * — see ChatArea.tsx Task 3 for the L:221 rewrite.
 *
 * isStreaming AUDIT (Plan 2 Task 3 — Branch A required):
 *   `grep -rn isStreaming frontend/src/components/` returns 22 hits across:
 *     - ChatArea.tsx:29 (destructure), :219 (<MessageInput disabled={isStreaming} />),
 *       :313 (<MessageList isStreaming={isStreaming} />)
 *     - MessageList.tsx:8 (Props), :15 (signature), :76, :79, :83 (scroll
 *       behaviour), :95 (<MessageItem isStreaming={isStreaming && isLastAssistant} />)
 *     - MessageItem.tsx:14,20,62,86,93,99,109,122,135,137,139,147,164,173,180
 *       (spinner / banner / suggestions gating)
 *     - tool-bodies/ExecuteCodeBody.tsx (Phase 075.7 rename of the legacy
 *       execute-code wrapper) :103,131,255 (terminal spinner — UNRELATED to
 *       useMessages; reads from local `isRunning` prop)
 *   Conclusion: live consumers across MessageInput disable, MessageList scroll
 *   gating, MessageItem spinner/banner/suggestion gating. Branch A (hoist) is
 *   REQUIRED. Wiring: useIsStreaming() named hook in StreamsProvider reads
 *   `state.isStreaming`; sendMessage action toggles state at open/close (Task
 *   2a lift); thin reader returns the hook value verbatim.
 */
import { useMemo } from "react"
import type { Message } from "../types"
import {
  useThreadMessages,
  useStreamActions,
  useViewingThread,
  useStreamingForThread,
  useFallbackNoticeForThread,
} from "@/providers/StreamsProvider"

// Phase 092 (MODE-01/02 — SC#3): re-export the per-thread workflow-lock reader
// from the canonical StreamsProvider selector surface so chat-composer consumers
// (MessageInput) have a single import home alongside the other thread-scoped
// hooks. ALWAYS read it keyed by the OWNING thread id (the thread the composer
// sends to), never viewedThreadId or a global flag (useMessages.ts:80-86 lesson;
// the parallel-thread UAT is the SC#3 binding gate).
export { useWorkflowLockForThread } from "@/providers/StreamsProvider"
export type { WorkflowLock } from "@/stores/streamsStore"

interface UseMessages {
  messages: Message[]
  isStreaming: boolean
  fallbackNotice: string | null
  loadMessages: (threadId: string) => Promise<void>
  sendMessage: (
    threadId: string,
    content: string,
    model?: string,
    onTitleUpdate?: (threadId: string, title: string) => void,
    agentMode?: string,
    provider?: string,
    /** Phase 092 (MODE-01 / D-02) — Harness kickoff: the picked published-
     *  workflow id. When set, this send creates a workflow run; omitted on a
     *  Deep send (byte-identical). */
    workflowDefinitionId?: string,
    /** Phase 216 (CHAT-05 / CHAT-06): active connector IDs for this send turn. */
    activeConnectorIds?: string[],
  ) => Promise<void>
  /** Phase 063 (D-063-03): server-side Stop via DELETE /runs/{rid}; now async. */
  stopStreaming: () => Promise<void>
  /** Kept for loadMessages-cancel paths only (D-060-03 invariants). NOT used for stream cancellation in Phase 063. */
  abortStream: () => void
  clearMessages: () => void
  setViewingThread: (threadId: string | null) => void
  /** Phase 063 (Pattern 2): on (re)connect — fetches active-runs in PARALLEL with loadMessages and reattaches placeholder + SSE consumer for any in-flight runs not already in subscriptionsRef. */
  reconcile: (threadId: string) => Promise<void>
  /** Phase 063 (Pattern 4 / D-063-04): re-POSTs the user message immediately preceding the failed assistant message. Explicit user intent only — never auto-fired. */
  resumeFromFailed: (failedMessage: Message) => Promise<void>
}

export function useMessages(): UseMessages {
  const viewedThreadId = useViewingThread()
  const messages = useThreadMessages(viewedThreadId, "chat")
  // Plan 075.4-01 D-075.4-A1: thread-scoped reads. The `isStreaming` value
  // ChatArea destructures from this hook now means "is the VIEWED thread
  // streaming?" — closes BUG-260523-01 at this surface (the destructured prop
  // no longer reflects ANY-thread-streaming). For the composer `disabled` prop
  // in ChatArea (Task 3 / L:221), prefer the direct selector
  // `useStreamingForThread(thread?.id ?? null)` so the disable derives from
  // the OWNING thread id (not viewedThreadId), giving the correct behavior on
  // background-streaming threads. `fallbackNotice` becomes the viewed thread's
  // notice (null when there is no viewed thread).
  const isStreaming = useStreamingForThread(viewedThreadId)
  const fallbackNotice = useFallbackNoticeForThread(viewedThreadId)
  const actions = useStreamActions()
  return useMemo<UseMessages>(
    () => ({
      messages,
      isStreaming,
      fallbackNotice,
      loadMessages: (threadId) => actions.loadMessages(threadId, "chat"),
      sendMessage: (threadId, content, model, onTitleUpdate, agentMode, provider, workflowDefinitionId, activeConnectorIds) =>
        actions.sendMessage(threadId, content, {
          model,
          provider,
          agentMode,
          onTitleUpdate,
          surfaceId: "chat",
          // Phase 092 (D-02): forward the picked workflow id (undefined = Deep).
          workflowDefinitionId,
          activeConnectorIds,
        }),
      stopStreaming: actions.stopStream,
      abortStream: () => {}, // legacy no-op (D-063.1-07 — call site removed from ChatArea)
      clearMessages: () => actions.clearThreadBucket("chat"),
      setViewingThread: actions.setViewingThread,
      reconcile: (threadId) => actions.reconcile(threadId, "chat"),
      resumeFromFailed: actions.resumeFromFailed,
    }),
    [messages, isStreaming, fallbackNotice, actions],
  )
}
