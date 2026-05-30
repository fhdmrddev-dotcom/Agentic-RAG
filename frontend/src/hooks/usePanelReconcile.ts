/**
 * Phase 086 Plan 02 (D-086-13 / D-086-14 / D-086-15) — shared reconcile helper
 * for the 4 agent-panel hooks (useTodos / useWorkspaceFiles / useAskUserPrompt /
 * useTasks).
 *
 * The planner's Claude's-Discretion decision (PATTERNS §5) was to FACTOR this
 * single helper rather than inline 4 copies: PATTERNS flags the in-hook reconcile
 * useEffect as the single structurally-NEW shape (composed, not copied from one
 * analog) and the highest-care item. Concentrating the AbortController +
 * isLoading + composite-error-key plumbing here makes it testable in isolation
 * and removes 4x copy drift.
 *
 * Composed from two existing StreamsProvider patterns (NOT copied from one
 * source — there is no in-hook fetch analog):
 *   1. AbortController-per-fetch + post-await thread guard + reconcileErrors
 *      set/clear — the loadMessages action body (StreamsProvider.tsx:1348-1430).
 *   2. AbortController in effect cleanup (L-068-02 in-flight lock) —
 *      `return () => controller.abort()` (StreamsProvider.tsx:1483-1490).
 *
 * Deliberate exclusions:
 *   - NO visibilitychange/focus/pageshow listeners (D-086-15 — reconcile fires
 *     ONLY on thread-switch [threadId] + the manual `reconcile()` escape hatch).
 *   - Error is keyed by the COMPOSITE key `${threadId}:${hookId}` (D-086-13) so a
 *     failure in one hook's reconcile (e.g. workspace/files 500) never clobbers
 *     the other 3 hooks' error slots.
 */
import { useCallback, useEffect, useState } from "react"
import { useStreamsStore } from "@/stores/streamsStore"

export interface UsePanelReconcileResult {
  isLoading: boolean
  error: Error | null
  reconcile: () => Promise<void>
}

/**
 * @param threadId  The thread to reconcile against (null disables the effect).
 * @param hookId    Short tag for the composite reconcileErrors key (e.g. "todos").
 * @param fetcher   The api.ts GET helper (threadId, signal) => Promise<T[]>.
 * @param replace   The store action that atomically replaces this thread's inner
 *                  Map entry (resolved by the caller from useStreamsStore actions).
 */
export function usePanelReconcile<T>(opts: {
  threadId: string | null
  hookId: string
  fetcher: (threadId: string, signal?: AbortSignal) => Promise<T[]>
  replace: (threadId: string, data: T[]) => void
}): UsePanelReconcileResult {
  const { threadId, hookId, fetcher, replace } = opts

  // isLoading is local React state, true ONLY during an initial reconcile fetch
  // (D-086-10). It is NOT in Zustand state (it is per-mount ephemeral UI state).
  const [isLoading, setIsLoading] = useState(false)

  // Error read from the store via the COMPOSITE key (D-086-13). Reusing the
  // existing reconcileErrors Map keeps the failure-isolation surface in one
  // place; only the key string differs per hook (`${threadId}:${hookId}`).
  const error = useStreamsStore((s) =>
    threadId ? (s.reconcileErrors.get(`${threadId}:${hookId}`) ?? null) : null,
  )

  // Core reconcile: AbortController per call, post-await thread guard, replace on
  // success + clear composite error key, silent on AbortError, set composite
  // error key on any other failure. Shared by the manual escape hatch
  // (returned `reconcile`) and the thread-switch useEffect below.
  const runReconcile = useCallback(
    async (tid: string, signal: AbortSignal): Promise<void> => {
      const key = `${tid}:${hookId}`
      try {
        const data = await fetcher(tid, signal)
        // Post-await guard: drop the result if this fetch was aborted (the
        // controller's signal is the source of truth — a newer reconcile or a
        // thread-switch unmount already fired controller.abort()).
        if (signal.aborted) return
        replace(tid, data)
        // Clear any prior error for THIS composite key on success.
        if (useStreamsStore.getState().reconcileErrors.has(key)) {
          useStreamsStore.setState((s) => {
            const next = new Map(s.reconcileErrors)
            next.delete(key)
            return { reconcileErrors: next }
          })
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return
        if (
          err &&
          typeof err === "object" &&
          "name" in err &&
          (err as { name: string }).name === "AbortError"
        )
          return
        // Composite-key set (D-086-13): scoped to `${tid}:${hookId}` so a 500
        // on this hook never touches another hook's error slot.
        useStreamsStore.setState((s) => ({
          reconcileErrors: new Map(s.reconcileErrors).set(
            key,
            err instanceof Error ? err : new Error(String(err)),
          ),
        }))
      }
    },
    [hookId, fetcher, replace],
  )

  // Manual escape-hatch reconcile (D-086-14). Creates its own controller; no
  // isLoading flip (isLoading tracks the initial thread-switch fetch only).
  const reconcile = useCallback(async (): Promise<void> => {
    if (!threadId) return
    const controller = new AbortController()
    await runReconcile(threadId, controller.signal)
  }, [threadId, runReconcile])

  // Thread-switch reconcile: fires on [threadId] change, aborts the in-flight
  // fetch on cleanup (L-068-02). NO visibility/focus listeners (D-086-15).
  useEffect(() => {
    if (!threadId) {
      setIsLoading(false)
      return
    }
    const controller = new AbortController()
    setIsLoading(true)
    void runReconcile(threadId, controller.signal).finally(() => {
      // Only clear the spinner if this fetch wasn't superseded — the post-await
      // guard already discarded a stale result; the finally only flips loading
      // when the controller is still the live one for this mount.
      if (!controller.signal.aborted) setIsLoading(false)
    })
    return () => controller.abort()
  }, [threadId, runReconcile])

  return { isLoading, error, reconcile }
}
