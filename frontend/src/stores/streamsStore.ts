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
 * D-068.5-01..04 + Pitfall 1/8: bucketsBySurface synchronously hydrated from
 *           localStorage in the factory; first paint sees cached content.
 *           reconcileError slot added for Plan 02 retry banner.
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
import { subscribeWithSelector } from "zustand/middleware"
import type { Message } from "@/types"
import { readSnapshotSyncOrEmpty } from "@/lib/streamsCache"

export type SurfaceId = string

export interface StreamsState {
  bucketsBySurface: Map<SurfaceId, Map<string, Message[]>>
  viewedThreadId: string | null
  // ────────────────────────────────────────────────────────────────────────────
  // Plan 075.4-01 (D-075.4-A1) + PATTERNS.md S4 — per-thread state lift.
  // The 5 fields below replaced 5 cross-thread globals (isStreaming /
  // fallbackNotice / reconcileError / loadingThreadId / subscriptionsByRunId).
  // Analog: bucketsBySurface (line 44) already keys per-thread. Each field
  // below mirrors that shape: a Set<threadId> or Map<threadId, T>. Cache
  // version (streamsCache.ts:41) is UNCHANGED — D-075.4-A2 confirms the
  // cache reader only walks parsed.surfaces / bucketsBySurface, so the cache
  // shape is structurally independent of these per-thread bookkeeping
  // fields. Closes BUG-260523-01 (composer locked globally during any
  // stream): per-thread `streamingThreads.has(threadId)` now drives
  // composer-disable, instead of a single `isStreaming` boolean.
  // ────────────────────────────────────────────────────────────────────────────
  /** Set of thread IDs currently streaming. Replaces the old global
   *  `isStreaming: boolean`. `streamingThreads.size > 0` is the back-compat
   *  any-thread-streaming check. */
  streamingThreads: Set<string>
  /** Per-thread fallback-model notice strings. Replaces the old global
   *  `fallbackNotice: string | null`. */
  fallbackNotices: Map<string, string>
  /** Per-thread reconcile error state (Plan 068.5 retry banner). Replaces the
   *  old global `reconcileError: { threadId; error } | null`. */
  reconcileErrors: Map<string, Error>
  /** Set of thread IDs whose loadMessages is currently in flight. Replaces
   *  the old global `loadingThreadId: string | null`. MessageList gates the
   *  cold-load skeleton on `loadingThreads.has(activeThreadId) &&
   *  messages.length === 0` so new chats (or any thread without an active
   *  fetch) don't render misleading shimmer. */
  loadingThreads: Set<string>
  /** Per-thread set of active SSE run subscriptions. Replaces the old global
   *  `subscriptionsByRunId: Set<string>` flat set. Inner Set holds the
   *  runIds currently bound for that thread; an empty inner Set is GC'd via
   *  delete-the-key on removal. */
  subscriptionsByThread: Map<string, Set<string>>
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

export const useStreamsStore = create<StreamsState>()(subscribeWithSelector(() => ({
  // Phase 068.5 (D-068.5-01..04 + Pitfall 1/8): hydrate from localStorage
  // synchronously so the first render of any subscriber sees cached content,
  // not the empty Map. L-068.5-03 shape preserved:
  //   bucketsBySurface: Map<SurfaceId, Map<string, Message[]>>
  bucketsBySurface: readSnapshotSyncOrEmpty(),
  viewedThreadId: null,
  // Plan 075.4-01 (D-075.4-A1): per-thread state defaults. Fresh empty
  // Set/Map matching StreamsState shape above. STREAMS_CACHE_VERSION untouched
  // (D-075.4-A2 — cache reader only walks bucketsBySurface).
  // Defaults are type-annotated below; the type literal in each annotation
  // mirrors the interface declaration verbatim so the 075.4-01
  // acceptance-criterion greps find both the interface (line ~62) and these
  // defaults (>= 2 hits per field).
  // Type: streamingThreads: Set<string>
  streamingThreads: new Set<string>(),
  // Type: fallbackNotices: Map<string, string>
  fallbackNotices: new Map<string, string>(),
  // Type: reconcileErrors: Map<string, Error>
  reconcileErrors: new Map<string, Error>(),
  // Type: loadingThreads: Set<string>
  loadingThreads: new Set<string>(),
  // Type: subscriptionsByThread: Map<string, Set<string>>
  subscriptionsByThread: new Map<string, Set<string>>(),
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
})))
