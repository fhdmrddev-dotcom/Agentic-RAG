/**
 * Phase 068 (D-068-01..08, L-068-01..07): <StreamsProvider> — provider-scoped
 * refs + mount-time action registration + reconcile listeners. Wraps the
 * authenticated React tree below the auth gate (D-068-02 / RESEARCH §Finding #4).
 *
 * D-068-01: Zustand v5 store is the substrate; this component owns the
 *           non-serializable handles (AbortController Map, cursor Map,
 *           in-flight bit, streaming/active thread ids).
 * D-068-02: Named-hook layer (useThreadMessages / useStreamActions /
 *           useStreamSubscriptions / useViewingThread) hides raw
 *           useStreamsStore from consumers.
 * D-068-03: useStreamsStore is implementation detail. External callers MUST
 *           use the named hooks below.
 * D-068-04: bucketsBySurface immutable-replace via nested Map cloning.
 * D-068-05: Surface-aware (surfaceId default = "chat").
 * D-068-06: NO per-run keying in v2.6.
 * D-068-07: Reconcile listeners (visibilitychange / focus / pageshow) attach
 *           inside this provider's mount useEffect; ChatArea.tsx:162-187
 *           still has its block — Plan 3 deletes it; pre-Plan-3 the L-068-02
 *           in-flight lock makes the double-attach safe (RESEARCH §Pitfall 4).
 * D-068-08: Listeners gate on activeThreadIdRef.current — no thread arg
 *           captured at attach time (mirrors ChatArea but reads the ref).
 *
 * L-068-01: Branch D-3 guard predicate (clearThreadBucket refuses to wipe a
 *           bucket whose thread is currently being streamed into; lifted
 *           VERBATIM from useMessages.ts:589-598).
 * L-068-02: reconcile in-flight lock — top-of-function bail + try/finally.
 *           Real body lifts in Plan 2; Plan 1 ships a no-op shell so the
 *           ChatArea listener block + this provider's listener block can
 *           coexist safely until Plan 3 deletes ChatArea's listeners.
 * L-068-03: activeThreadIdRef has EXACTLY ONE writer (setViewingThread).
 *           This file should contain ONE assignment expression; grep verifies
 *           that (acceptance criterion in PLAN.md).
 *
 * RESEARCH §Finding #1: EMPTY_ARRAY is module-level so atomic selectors get
 *                       a stable reference for empty buckets — no re-render.
 * RESEARCH §Finding #2: Actions register via useStreamsStore.setState in the
 *                       mount-time useEffect, closing over provider-scoped refs.
 *                       AbortController never enters Zustand state; the
 *                       subscriptionsByRunId Set<string> mirror does.
 * RESEARCH §Pitfall 3: Action registration runs in useEffect (after first
 *                      paint). Synchronous actions ship as no-op stubs in the
 *                      store; async actions throw notMounted. Safe.
 * RESEARCH §Pitfall 5: Throwing stubs surface pre-mount usage instantly.
 */
import { useEffect, useRef, type PropsWithChildren } from "react"
import type { Message } from "@/types"
import {
  useStreamsStore,
  type SurfaceId,
  type StreamsState,
} from "@/stores/streamsStore"

// RESEARCH §Finding #1: module-level constant gives every empty-bucket subscriber
// the SAME reference, so React/useSyncExternalStore skips re-render when the
// selector result is shallow-equal across stores.
const EMPTY_ARRAY: Message[] = []

export function StreamsProvider({ children }: PropsWithChildren) {
  // ---- Provider-scoped refs (D-068-01: handles, not display state) ----
  // Lifted VERBATIM from useMessages.ts:417-447 shape (single source of truth
  // for in-flight handles). Plan 2 ports the real sendMessage/reconcile bodies
  // that read/write these.
  const subscriptionsRef = useRef<Map<string, AbortController>>(new Map())
  const lastSeenOffsetRef = useRef<Map<string, string>>(new Map())
  const reconcileInFlightRef = useRef(false)
  const streamingThreadIdRef = useRef<string | null>(null)
  const activeThreadIdRef = useRef<string | null>(null)

  // ---- useEffect #1: register real action implementations (Pattern 4) ----
  // RESEARCH §Pitfall 3 + §Finding #2: actions are registered post-mount so
  // they close over the refs above. Plan 1 ships:
  //   - real setMessagesForBucket (immutable nested-Map replace per Pattern 3)
  //   - real clearThreadBucket (verbatim L-068-01 Branch D-3 guard predicate)
  //   - real setViewingThread (L-068-03 sole writer)
  //   - real reconcile SHELL (L-068-02 in-flight lock + no-op body — Plan 2 fills it)
  //   - LIFT-IN-PLAN-2 stubs for sendMessage/stopStream/resumeFromFailed/loadMessages
  useEffect(() => {
    useStreamsStore.setState({
      actions: {
        // --- D-068-04 / RESEARCH §Pattern 3: immutable nested-Map replace ---
        setMessagesForBucket: (surface, threadId, updater) => {
          useStreamsStore.setState((state) => {
            const surfMap = state.bucketsBySurface.get(surface) ?? new Map<string, Message[]>()
            const prev = surfMap.get(threadId) ?? EMPTY_ARRAY
            const updated =
              typeof updater === "function"
                ? (updater as (p: Message[]) => Message[])(prev)
                : updater
            const nextSurf = new Map(surfMap)
            nextSurf.set(threadId, updated)
            const nextBuckets = new Map(state.bucketsBySurface)
            nextBuckets.set(surface, nextSurf)
            return { bucketsBySurface: nextBuckets }
          })
        },

        // --- L-068-01 Branch D-3 guard predicate (VERBATIM from
        //     useMessages.ts:589-598) — refuse to wipe a bucket whose thread
        //     is currently being streamed into. Predicate text matches the
        //     acceptance-criterion grep regex exactly. ---
        clearThreadBucket: (surface) => {
          const tid = activeThreadIdRef.current
          if (tid && tid !== streamingThreadIdRef.current) {
            useStreamsStore.setState((state) => {
              const surfMap = state.bucketsBySurface.get(surface)
              if (!surfMap || !surfMap.has(tid)) return {}
              const nextSurf = new Map(surfMap)
              nextSurf.delete(tid)
              const nextBuckets = new Map(state.bucketsBySurface)
              nextBuckets.set(surface, nextSurf)
              return {
                bucketsBySurface: nextBuckets,
                isStreaming: false,
              }
            })
          }
        },

        // --- L-068-03: SOLE WRITER of activeThreadIdRef ---
        // This is the ONLY assignment expression to that ref in this file —
        // verified by acceptance-criterion grep. Plan 2's runtime test hammers
        // mid-await navigation against this contract.
        setViewingThread: (threadId) => {
          activeThreadIdRef.current = threadId
          useStreamsStore.setState({ viewedThreadId: threadId })
        },

        // --- L-068-02: reconcile in-flight lock shell. Body is a no-op in
        //     Plan 1; Plan 2 ports the real reconcile body inside the
        //     try/finally. The lock must already work in Plan 1 so the
        //     double-attach (ChatArea + this provider) coexists safely
        //     pre-Plan-3 (RESEARCH §Pitfall 4). ---
        reconcile: async (_threadId, _surfaceId = "chat") => {
          if (reconcileInFlightRef.current) return
          reconcileInFlightRef.current = true
          try {
            // LIFT-IN-PLAN-2: real reconcile body (active-runs fetch + per-run
            // resubscribe via subscribeToRun) ports here. The surrounding
            // try/finally and reconcileInFlightRef lock are the L-068-02 shape.
          } finally {
            reconcileInFlightRef.current = false
          }
        },

        // --- LIFT-IN-PLAN-2 stubs (keep throwing-notMounted shape) ---
        // Plan 2 replaces these four with the real bodies lifted from
        // useMessages.ts (sendMessage / stopStreaming / resumeFromFailed /
        // loadMessages). Wiring subscriptionsByRunId mirror updates and
        // subscriptionsRef AbortController storage happens inside those
        // ports — Plan 1 leaves the mirror as the empty Set seeded by the store.
        sendMessage: async () => {
          // LIFT-IN-PLAN-2
          throw new Error("sendMessage not yet wired (Plan 068-02 will port from useMessages.ts)")
        },
        stopStream: async () => {
          // LIFT-IN-PLAN-2
          throw new Error("stopStream not yet wired (Plan 068-02 will port from useMessages.ts)")
        },
        resumeFromFailed: async () => {
          // LIFT-IN-PLAN-2
          throw new Error("resumeFromFailed not yet wired (Plan 068-02 will port from useMessages.ts)")
        },
        loadMessages: async () => {
          // LIFT-IN-PLAN-2
          throw new Error("loadMessages not yet wired (Plan 068-02 will port from useMessages.ts)")
        },
      },
    })
    // Touch all refs to satisfy lint and document the closure (they're read
    // by the actions registered above and the listeners below).
    void subscriptionsRef
    void lastSeenOffsetRef
  }, [])

  // ---- useEffect #2: reconcile listeners (D-068-07 / D-068-08) ----
  // RESEARCH §Finding #8: attached ONCE on provider mount; no [thread?.id] dep
  // (the listeners gate on activeThreadIdRef.current at fire time — not at
  // attach time — so we never re-attach). Coexists with the legacy
  // ChatArea.tsx:162-187 listener block during the Plan 1 → Plan 3 window;
  // the L-068-02 in-flight lock above makes the double-attach safe
  // (RESEARCH §Pitfall 4). Plan 3 deletes the ChatArea block.
  useEffect(() => {
    const tryReconcile = () => {
      const tid = activeThreadIdRef.current
      if (!tid) return
      useStreamsStore
        .getState()
        .actions.reconcile(tid)
        .catch(console.error)
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") tryReconcile()
    }
    const onFocus = () => tryReconcile()
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) tryReconcile()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onFocus)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [])

  // ---- useEffect #3: unmount cleanup (mirror of useMessages.ts:1209-1214) ----
  useEffect(() => {
    const subs = subscriptionsRef.current
    return () => {
      for (const ctrl of subs.values()) ctrl.abort()
      subs.clear()
    }
  }, [])

  return <>{children}</>
}

// =============================================================================
// Named hooks — D-068-02 / RESEARCH §Pattern 2 (atomic selectors only)
// External callers consume these; useStreamsStore is implementation detail.
// =============================================================================

export const useThreadMessages = (
  threadId: string | null,
  surfaceId: SurfaceId = "chat",
): Message[] =>
  useStreamsStore((state) =>
    threadId ? state.bucketsBySurface.get(surfaceId)?.get(threadId) ?? EMPTY_ARRAY : EMPTY_ARRAY,
  )

export const useViewingThread = (): string | null =>
  useStreamsStore((state) => state.viewedThreadId)

export const useStreamActions = (): StreamsState["actions"] =>
  useStreamsStore((state) => state.actions)

// useStreamSubscriptions reads from the Zustand-visible `subscriptionsByRunId`
// mirror (declared in streamsStore.ts; initial value: empty Set). The
// AbortController Map itself lives in provider-scoped `subscriptionsRef`
// (RESEARCH §Finding #2 — AbortController must NOT be in Zustand state).
// Plan 2 wires the mirror updates inside sendMessage/reconcile/stopStream
// (subscribe → setState add; onTerminal → setState delete).
export const useStreamSubscriptions = (runId: string): boolean =>
  useStreamsStore((state) => state.subscriptionsByRunId.has(runId))
