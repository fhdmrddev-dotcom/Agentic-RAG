/**
 * Phase 092 Plan 07 (Facet C) — producer re-subscribe signal (additive wiring).
 *
 * After a Harness Continue (POST /runs/{id}/continue), the backend mints a FRESH
 * producer `runs` row (the original producer stream EXPIREd) and returns its id in
 * the 200 body as `producer_run_id`. The Continue button lives in the G-5 hot file
 * MessageItem.tsx, but the SSE subscription machinery (subscriptionsRef +
 * subscribeToRun) is component-scoped inside StreamsProvider.
 *
 * Re-plumbing the subscription refs out to MessageItem would touch the streaming
 * substrate beyond "fire a pulse". Instead this tiny module-level event bus keeps
 * the wiring ADDITIVE + per-thread keyed (BUG-260523-01 — the payload carries the
 * owning threadId so the provider only re-attaches that thread; never a global
 * flag): MessageItem's Continue handler calls requestProducerResubscribe(threadId,
 * producerRunId) on the 200 response; StreamsProvider subscribes and re-subscribes
 * GET /runs/{producer_run_id}/stream for that thread (idempotent — won't
 * double-subscribe an already-subscribed id). No new dependency; no shared Zustand
 * selector that would re-render chat. Mirrors panelOpenSignal.ts.
 */
export interface ProducerResubscribe {
  threadId: string
  producerRunId: string
}

type Listener = (payload: ProducerResubscribe) => void

const listeners = new Set<Listener>()

/** Ask StreamsProvider to re-subscribe a thread's fresh producer stream (called
 *  from the chat-side Continue affordance after a 200 producer_run_id). */
export function requestProducerResubscribe(payload: ProducerResubscribe): void {
  for (const fn of listeners) fn(payload)
}

/** StreamsProvider subscribes; returns an unsubscribe fn for effect cleanup. */
export function subscribeProducerResubscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
