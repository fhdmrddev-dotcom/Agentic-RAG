/**
 * Phase 068 (D-068-01..06): Zustand v5 store backing <StreamsProvider>.
 *
 * State + actions co-located per Dorfmeister convention (RESEARCH §Finding #1).
 * Actions are seeded as throwing/no-op stubs here; the provider overwrites
 * them via setState in a mount-time useEffect (RESEARCH §Pitfall 3 + §Finding #2).
 *
 * D-068-01: Zustand v5 store (locked, not exploratory).
 * D-068-02: Named hooks layer in StreamsProvider hides raw `useStreamsStore`
 *           (subscriptionsByRunId Set<string> is the Zustand-visible mirror of
 *           the provider-scoped subscriptionsRef AbortController Map).
 * D-068-03: This module is implementation detail; consumers go through named
 *           hooks exported from StreamsProvider.tsx, NEVER through
 *           useStreamsStore directly.
 * D-068-04: bucketsBySurface: Map<SurfaceId, Map<thread_id, Message[]>>.
 * D-068-05: Surface-aware action signatures (surfaceId opt; default "chat").
 * D-068-06: Per-run keying explicitly NOT adopted in v2.6.
 *
 * RESEARCH §Finding #2: AbortController must NOT live in Zustand state (not
 * serializable, identity churn breaks selector memoization). The provider
 * holds the actual Map<runId, AbortController> in a ref; this Set is the
 * pure-data mirror exposed to React consumers via `useStreamSubscriptions`.
 * Plan 1 ships an empty Set; Plan 2 wires the add/remove call sites inside
 * the lifted sendMessage/reconcile/stopStream bodies.
 *
 * RESEARCH §Pitfall 5: Synchronous actions (setMessagesForBucket /
 * clearThreadBucket / setViewingThread) seed as no-op `() => {}` because
 * they can fire BEFORE the provider's mount-time useEffect on the very first
 * render. Async actions throw via `notMounted` because they're always fired
 * from user events (post-mount, after useEffect has registered real bodies).
 */
import { create } from "zustand"
import type { Message } from "@/types"

export type SurfaceId = string

export interface StreamsState {
  bucketsBySurface: Map<SurfaceId, Map<string, Message[]>>
  viewedThreadId: string | null
  isStreaming: boolean
  fallbackNotice: string | null
  subscriptionsByRunId: Set<string>
  actions: {
    setMessagesForBucket: (
      surface: SurfaceId,
      threadId: string,
      updater: Message[] | ((prev: Message[]) => Message[]),
    ) => void
    clearThreadBucket: (surface: SurfaceId) => void
    setViewingThread: (threadId: string | null) => void
    sendMessage: (
      threadId: string,
      content: string,
      opts?: {
        model?: string
        provider?: string
        agentMode?: string
        surfaceId?: SurfaceId
        onTitleUpdate?: (t: string) => void
      },
    ) => Promise<void>
    reconcile: (threadId: string, surfaceId?: SurfaceId) => Promise<void>
    stopStream: () => Promise<void>
    resumeFromFailed: (failedMessage: Message) => Promise<void>
    loadMessages: (threadId: string, surfaceId?: SurfaceId) => Promise<void>
  }
}

const notMounted = async (): Promise<never> => {
  throw new Error(
    "StreamsProvider not mounted: action invoked before provider useEffect registered real implementations",
  )
}

export const useStreamsStore = create<StreamsState>()(() => ({
  bucketsBySurface: new Map(),
  viewedThreadId: null,
  isStreaming: false,
  fallbackNotice: null,
  subscriptionsByRunId: new Set<string>(),
  actions: {
    setMessagesForBucket: () => {},
    clearThreadBucket: () => {},
    setViewingThread: () => {},
    sendMessage: notMounted,
    reconcile: notMounted,
    stopStream: notMounted,
    resumeFromFailed: notMounted,
    loadMessages: notMounted,
  },
}))
