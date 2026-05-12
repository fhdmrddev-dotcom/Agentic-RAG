/**
 * Phase 068 (STREAMS-PROVIDER-01): useMessages is now a THIN READER delegating
 * to <StreamsProvider> named hooks. Public `UseMessages` interface preserved
 * byte-identical so ChatArea.tsx:27-38 imports work without edit.
 *
 * Pre-lift size: 1229 LOC (refs + makeStreamCallbacks factory + sendMessage +
 * reconcile + loadMessages + stopStream + resumeFromFailed). Post-lift target:
 * < 100 LOC (RESEARCH §Recommendation #4 plan-checker assertion).
 *
 * isStreaming AUDIT (Plan 2 Task 3 — Branch A required):
 *   `grep -rn isStreaming frontend/src/components/` returns 22 hits across:
 *     - ChatArea.tsx:29 (destructure), :219 (<MessageInput disabled={isStreaming} />),
 *       :313 (<MessageList isStreaming={isStreaming} />)
 *     - MessageList.tsx:8 (Props), :15 (signature), :76, :79, :83 (scroll
 *       behaviour), :95 (<MessageItem isStreaming={isStreaming && isLastAssistant} />)
 *     - MessageItem.tsx:14,20,62,86,93,99,109,122,135,137,139,147,164,173,180
 *       (spinner / banner / suggestions gating)
 *     - ExecuteCodeBlock.tsx:103,131,255 (terminal spinner — UNRELATED to
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
  useIsStreaming,
} from "@/providers/StreamsProvider"

interface UseMessages {
  messages: Message[]
  isStreaming: boolean
  fallbackNotice: string | null
  loadMessages: (threadId: string) => Promise<void>
  sendMessage: (
    threadId: string,
    content: string,
    model?: string,
    onTitleUpdate?: (title: string) => void,
    agentMode?: string,
    provider?: string,
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
  const isStreaming = useIsStreaming()
  const actions = useStreamActions()
  return useMemo<UseMessages>(
    () => ({
      messages,
      isStreaming,
      fallbackNotice: null,
      loadMessages: (threadId) => actions.loadMessages(threadId, "chat"),
      sendMessage: (threadId, content, model, onTitleUpdate, agentMode, provider) =>
        actions.sendMessage(threadId, content, {
          model,
          provider,
          agentMode,
          onTitleUpdate,
          surfaceId: "chat",
        }),
      stopStreaming: actions.stopStream,
      abortStream: () => {}, // legacy no-op (D-063.1-07 — call site removed from ChatArea)
      clearMessages: () => actions.clearThreadBucket("chat"),
      setViewingThread: actions.setViewingThread,
      reconcile: (threadId) => actions.reconcile(threadId, "chat"),
      resumeFromFailed: actions.resumeFromFailed,
    }),
    [messages, isStreaming, actions],
  )
}
