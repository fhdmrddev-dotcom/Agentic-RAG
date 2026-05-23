/**
 * Phase 075.4 Plan 01 D-075.4-A3 — per-thread state regression coverage;
 * inherited by Phase 082 per FORWARD-REF #2.
 *
 * Lifts the 5 cross-thread globals (streamingThreads / loadingThreads /
 * reconcileErrors / fallbackNotices / subscriptionsByThread) into per-thread
 * Map/Set keys; this file is the binding gate that asserts cross-thread
 * isolation at the Zustand-store layer.
 *
 * Closes BUG-260523-01 (composer locked globally during any stream) at the
 * data-layer level: useStreamingForThread("thread-a") MAY be true while
 * useStreamingForThread("thread-b") is false. ChatArea.tsx Task 3 wires this
 * into the actual UI composer disable.
 *
 * These tests do NOT depend on mockGetActiveRuns (Phase 075 D-075-02 swapped
 * reconcile to getSnapshot; pre-existing reconcile-path tests using
 * mockGetActiveRuns are RED at HEAD — see 075.4-deferred-items.md
 * D-075.4-01-DEFER-1). Per-thread state assertions exercise the store
 * directly via setState/getState + the 4 new thread-scoped selectors.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useStreamsStore } from "@/stores/streamsStore"
import {
  useStreamingForThread,
  useLoadingForThread,
  useReconcileErrorForThread,
  useFallbackNoticeForThread,
} from "@/providers/StreamsProvider"

beforeEach(() => {
  // Plan 075.4-01 D-075.4-A1: per-thread fields reset to fresh empties.
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    fallbackNotices: new Map<string, string>(),
    reconcileErrors: new Map<string, Error>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — Two threads streaming in parallel: streamingThreads.has() true for
//          both; useStreamingForThread() selector reflects per-thread isolation
//          (true for the streaming threads, false for a third unrelated thread).
// ─────────────────────────────────────────────────────────────────────────────
describe("Phase 075.4 D-075.4-A3 — streamingThreads cross-thread isolation", () => {
  it("two threads streaming in parallel: streamingThreads.has both true; cross-thread false", () => {
    useStreamsStore.setState((s) => ({
      streamingThreads: new Set(s.streamingThreads).add("thread-a").add("thread-b"),
    }))

    const state = useStreamsStore.getState()
    expect(state.streamingThreads.has("thread-a")).toBe(true)
    expect(state.streamingThreads.has("thread-b")).toBe(true)
    expect(state.streamingThreads.has("thread-c")).toBe(false)
    expect(state.streamingThreads.size).toBe(2)
  })

  it("useStreamingForThread() returns true for each streaming thread; false for unrelated", () => {
    useStreamsStore.setState((s) => ({
      streamingThreads: new Set(s.streamingThreads).add("thread-a").add("thread-b"),
    }))

    const { result: rA } = renderHook(() => useStreamingForThread("thread-a"))
    const { result: rB } = renderHook(() => useStreamingForThread("thread-b"))
    const { result: rC } = renderHook(() => useStreamingForThread("thread-c"))
    const { result: rNull } = renderHook(() => useStreamingForThread(null))

    expect(rA.current).toBe(true)
    expect(rB.current).toBe(true)
    expect(rC.current).toBe(false)
    expect(rNull.current).toBe(false)
  })

  it("BUG-260523-01 close-out: composer disable derived per-thread (selector)", () => {
    // Thread A is streaming; Thread B is NOT.
    useStreamsStore.setState((s) => ({
      streamingThreads: new Set(s.streamingThreads).add("thread-a"),
    }))

    const { result: composerA } = renderHook(() => useStreamingForThread("thread-a"))
    const { result: composerB } = renderHook(() => useStreamingForThread("thread-b"))

    // The actual close-out for BUG-260523-01: Thread A composer disabled,
    // Thread B composer NOT disabled even though a stream is alive globally.
    expect(composerA.current).toBe(true)
    expect(composerB.current).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — subscriptionsByThread isolation: run added to thread-a's inner Set
//          does NOT show up in thread-b's. GC: inner-Set-empty-then-delete-key
//          drops the threadId entry when its last run terminates.
// ─────────────────────────────────────────────────────────────────────────────
describe("Phase 075.4 D-075.4-A3 — subscriptionsByThread cross-thread isolation + GC", () => {
  it("run added to thread-a's inner Set; thread-b's inner Set unaffected", () => {
    useStreamsStore.setState((s) => {
      const next = new Map(s.subscriptionsByThread)
      const inner = new Set<string>()
      inner.add("run-1")
      next.set("thread-a", inner)
      return { subscriptionsByThread: next }
    })

    const state = useStreamsStore.getState()
    expect(state.subscriptionsByThread.get("thread-a")?.has("run-1")).toBe(true)
    // Cross-thread: thread-b has no entry at all (undefined).
    expect(state.subscriptionsByThread.get("thread-b")).toBeUndefined()
    expect(state.subscriptionsByThread.get("thread-b")?.has("run-1") ?? false).toBe(false)
  })

  it("inner-Set-empty-then-delete-key GC removes the threadId entry when last run terminates", () => {
    // Seed two runs on thread-a, one on thread-b.
    useStreamsStore.setState((s) => {
      const next = new Map(s.subscriptionsByThread)
      const innerA = new Set<string>(["run-1", "run-2"])
      const innerB = new Set<string>(["run-3"])
      next.set("thread-a", innerA)
      next.set("thread-b", innerB)
      return { subscriptionsByThread: next }
    })

    // Helper that mirrors _removeRunFromThread in StreamsProvider.tsx.
    const remove = (threadId: string, runId: string) => {
      useStreamsStore.setState((s) => {
        const innerCur = s.subscriptionsByThread.get(threadId)
        if (!innerCur || !innerCur.has(runId)) return {}
        const next = new Map(s.subscriptionsByThread)
        const inner = new Set(innerCur)
        inner.delete(runId)
        if (inner.size === 0) next.delete(threadId)
        else next.set(threadId, inner)
        return { subscriptionsByThread: next }
      })
    }

    // Remove run-1 from thread-a — entry survives (run-2 still alive).
    remove("thread-a", "run-1")
    expect(useStreamsStore.getState().subscriptionsByThread.has("thread-a")).toBe(true)
    expect(useStreamsStore.getState().subscriptionsByThread.get("thread-a")?.has("run-2")).toBe(true)

    // Remove run-2 — thread-a inner Set goes empty, GC drops the key.
    remove("thread-a", "run-2")
    expect(useStreamsStore.getState().subscriptionsByThread.has("thread-a")).toBe(false)
    expect(useStreamsStore.getState().subscriptionsByThread.get("thread-a")).toBeUndefined()

    // Thread-b untouched throughout.
    expect(useStreamsStore.getState().subscriptionsByThread.get("thread-b")?.has("run-3")).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — reconcileErrors per-thread isolation: errors stored under threadId
//          key; useReconcileErrorForThread() returns the right thread's error,
//          null for any other thread.
// ─────────────────────────────────────────────────────────────────────────────
describe("Phase 075.4 D-075.4-A3 — reconcileErrors per-thread isolation", () => {
  it("reconcileErrors.get returns the thread's error; cross-thread returns null", () => {
    const errA = new Error("thread-a network failure")
    useStreamsStore.setState((s) => ({
      reconcileErrors: new Map(s.reconcileErrors).set("thread-a", errA),
    }))

    const state = useStreamsStore.getState()
    expect(state.reconcileErrors.get("thread-a")).toBe(errA)
    expect(state.reconcileErrors.get("thread-b") ?? null).toBeNull()
  })

  it("useReconcileErrorForThread selector mirrors the per-thread isolation", () => {
    const errA = new Error("thread-a network failure")
    useStreamsStore.setState((s) => ({
      reconcileErrors: new Map(s.reconcileErrors).set("thread-a", errA),
    }))

    const { result: rA } = renderHook(() => useReconcileErrorForThread("thread-a"))
    const { result: rB } = renderHook(() => useReconcileErrorForThread("thread-b"))
    const { result: rNull } = renderHook(() => useReconcileErrorForThread(null))

    expect(rA.current).toBe(errA)
    expect(rB.current).toBeNull()
    expect(rNull.current).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — fallbackNotices per-thread isolation + loadingThreads selector
//          coverage. Mirrors the streamingThreads test for the other Set field.
// ─────────────────────────────────────────────────────────────────────────────
describe("Phase 075.4 D-075.4-A3 — fallbackNotices + loadingThreads per-thread isolation", () => {
  it("fallbackNotices per-thread isolation via useFallbackNoticeForThread", () => {
    useStreamsStore.setState((s) => ({
      fallbackNotices: new Map(s.fallbackNotices).set(
        "thread-a",
        "Model gpt-5.4 unavailable — using gpt-5.x.",
      ),
    }))

    const { result: rA } = renderHook(() => useFallbackNoticeForThread("thread-a"))
    const { result: rB } = renderHook(() => useFallbackNoticeForThread("thread-b"))

    expect(rA.current).toBe("Model gpt-5.4 unavailable — using gpt-5.x.")
    expect(rB.current).toBeNull()
  })

  it("loadingThreads per-thread isolation via useLoadingForThread", () => {
    useStreamsStore.setState((s) => ({
      loadingThreads: new Set(s.loadingThreads).add("thread-a"),
    }))

    const { result: rA } = renderHook(() => useLoadingForThread("thread-a"))
    const { result: rB } = renderHook(() => useLoadingForThread("thread-b"))

    expect(rA.current).toBe(true)
    expect(rB.current).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — composite cross-thread invariant: ALL 5 lifted globals stay
//          independent under simultaneous mutations on different threadIds.
//          This is the strongest binding gate for D-075.4-A1 (no cross-thread
//          bleed across the 5 fields).
// ─────────────────────────────────────────────────────────────────────────────
describe("Phase 075.4 D-075.4-A3 — composite cross-thread invariant (all 5 fields)", () => {
  it("simultaneous mutations on thread-a and thread-b stay isolated across all 5 fields", () => {
    // Mutate every field for thread-a only.
    useStreamsStore.setState((s) => ({
      streamingThreads: new Set(s.streamingThreads).add("thread-a"),
      loadingThreads: new Set(s.loadingThreads).add("thread-a"),
      fallbackNotices: new Map(s.fallbackNotices).set("thread-a", "A-notice"),
      reconcileErrors: new Map(s.reconcileErrors).set("thread-a", new Error("A-err")),
      subscriptionsByThread: (() => {
        const next = new Map(s.subscriptionsByThread)
        next.set("thread-a", new Set(["run-a-1"]))
        return next
      })(),
    }))

    // Mutate every field for thread-b only.
    useStreamsStore.setState((s) => ({
      streamingThreads: new Set(s.streamingThreads).add("thread-b"),
      loadingThreads: new Set(s.loadingThreads).add("thread-b"),
      fallbackNotices: new Map(s.fallbackNotices).set("thread-b", "B-notice"),
      reconcileErrors: new Map(s.reconcileErrors).set("thread-b", new Error("B-err")),
      subscriptionsByThread: (() => {
        const next = new Map(s.subscriptionsByThread)
        next.set("thread-b", new Set(["run-b-1"]))
        return next
      })(),
    }))

    const state = useStreamsStore.getState()

    // Assert thread-a sees ONLY its own values.
    expect(state.streamingThreads.has("thread-a")).toBe(true)
    expect(state.loadingThreads.has("thread-a")).toBe(true)
    expect(state.fallbackNotices.get("thread-a")).toBe("A-notice")
    expect(state.reconcileErrors.get("thread-a")?.message).toBe("A-err")
    expect(state.subscriptionsByThread.get("thread-a")?.has("run-a-1")).toBe(true)
    // Cross-thread: thread-a does NOT see thread-b's runId.
    expect(state.subscriptionsByThread.get("thread-a")?.has("run-b-1") ?? false).toBe(false)

    // Assert thread-b sees ONLY its own values.
    expect(state.streamingThreads.has("thread-b")).toBe(true)
    expect(state.loadingThreads.has("thread-b")).toBe(true)
    expect(state.fallbackNotices.get("thread-b")).toBe("B-notice")
    expect(state.reconcileErrors.get("thread-b")?.message).toBe("B-err")
    expect(state.subscriptionsByThread.get("thread-b")?.has("run-b-1")).toBe(true)
    expect(state.subscriptionsByThread.get("thread-b")?.has("run-a-1") ?? false).toBe(false)

    // Mutating thread-a's streamingThreads delete must NOT affect thread-b.
    useStreamsStore.setState((s) => {
      const next = new Set(s.streamingThreads)
      next.delete("thread-a")
      return { streamingThreads: next }
    })
    const after = useStreamsStore.getState()
    expect(after.streamingThreads.has("thread-a")).toBe(false)
    expect(after.streamingThreads.has("thread-b")).toBe(true)
  })
})
