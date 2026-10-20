/**
 * Phase 294-05 (DEC-03, D-13, D-15, T-294-28) — THE ONE HOME for citation-check results in chat.
 *
 * `byMessage` holds each assistant message's stored check (a reload or another device shows it
 * without paying again, D-15); `availability` is the latest server answer on whether a check can
 * run right now (D-16). Both arrive in ONE batched GET per thread view: every `ensure(id)` made in
 * the same tick is queued and flushed once per microtask into requests of at most 100 ids (the
 * server's cap), and an id already loaded or queued never asks again. `run(id)` is the only POST,
 * and only a click calls it (D-13: never automatic).
 *
 * ⚠ WHY THIS IS NOT IN `streamsStore.ts`: that file FIRES under G-5, and no other slice reads a
 * citation check, so it gets its own small module (the `askDraftStore.ts` precedent).
 *
 * ⚠ WHY THE CLIENT IS IMPORTED LAZILY, AND NOT AT THE TOP. `setupTests.ts` imports this module to
 * register `resetCitationChecks`, and a module a setup file imports is cached before any test
 * file's `vi.mock` is registered. A static import here would pull `lib/api/_core` (and Supabase)
 * into that cache, and every suite that mocks `@/lib/api/_core` would silently get the real one.
 * MEASURED 2026-10-20, not feared: one setup-file import of `lib/api/runEvidence` turned all 3
 * `runEvidence.test.ts` cases red. So the client is loaded on first use, which also keeps it out
 * of the chat bundle until a check is needed.
 *
 * ⚠ STABLE REFERENCES: `useCitationCheck` returns `null` (one value) when nothing is stored, never
 * a fresh object per call, so zustand v5 selectors cannot loop.
 *
 * Tests: `setupTests.ts` calls `resetCitationChecks()` after every case, because a module singleton
 * outlives `cleanup()`.
 */
import { create } from "zustand"
import type { CitationCheckAvailability, CitationCheckResult } from "@/lib/api/citationChecks"

/** The server's per-GET cap (`api/citation_checks.py` MAX_IDS_PER_GET). */
const MAX_IDS_PER_GET = 100

interface CitationCheckState {
  byMessage: Record<string, CitationCheckResult>
  availability: CitationCheckAvailability | null
  inFlight: Record<string, true>
  /** A fixed error CODE per message (`in_flight`, `off`, `not_found`, `rejected`, `failed` …),
   *  worded by `citationVerdicts.checkErrorLine`; server text is never stored or rendered. */
  errors: Record<string, string>
  ensure: (id: string) => void
  run: (id: string) => Promise<void>
}

const loadClient = () => import("@/lib/api/citationChecks")

/** Ids loaded or queued — the dedupe set. Module state, emptied by `resetCitationChecks`. */
let requested = new Set<string>()
let queue: string[] = []
let flushScheduled = false
/** Bumped by reset so a request in flight across a reset cannot write into the fresh state. */
let generation = 0

function without<T>(record: Record<string, T>, id: string): Record<string, T> {
  if (!(id in record)) return record
  const next = { ...record }
  delete next[id]
  return next
}

/** A fixed code for a failed POST: the server's 409 reason when it gave one, else by status. */
function errorCodeOf(e: unknown): string {
  const err = e as { status?: unknown; reason?: unknown } | null
  if (err && typeof err.reason === "string" && err.reason) return err.reason
  if (err?.status === 404) return "not_found"
  if (err?.status === 422) return "rejected"
  return "failed"
}

export const useCitationCheckStore = create<CitationCheckState>()((set) => {
  const flush = () => {
    flushScheduled = false
    const ids = queue
    queue = []
    if (ids.length === 0) return
    const gen = generation
    const forget = (chunk: string[]) => {
      // Absence stays absence: nothing is shown, and a later ensure() may ask again.
      if (gen === generation) for (const id of chunk) requested.delete(id)
    }
    void loadClient().then(
      ({ getCitationChecks }) => {
        for (let i = 0; i < ids.length; i += MAX_IDS_PER_GET) {
          const chunk = ids.slice(i, i + MAX_IDS_PER_GET)
          getCitationChecks(chunk).then(
            (resp) => {
              if (gen !== generation) return
              set((s) => ({ byMessage: { ...s.byMessage, ...resp.checks }, availability: resp.availability }))
            },
            () => forget(chunk),
          )
        }
      },
      () => forget(ids),
    )
  }

  return {
    byMessage: {},
    availability: null,
    inFlight: {},
    errors: {},
    ensure: (id) => {
      if (!id || requested.has(id)) return
      requested.add(id)
      queue.push(id)
      if (!flushScheduled) {
        flushScheduled = true
        queueMicrotask(flush)
      }
    },
    run: async (id) => {
      const gen = generation
      requested.add(id)
      set((s) => ({ inFlight: { ...s.inFlight, [id]: true }, errors: without(s.errors, id) }))
      try {
        const { runCitationCheck } = await loadClient()
        const result = await runCitationCheck(id)
        if (gen !== generation) return
        set((s) => ({ byMessage: { ...s.byMessage, [id]: result } }))
      } catch (e) {
        if (gen !== generation) return
        set((s) => ({ errors: { ...s.errors, [id]: errorCodeOf(e) } }))
      } finally {
        if (gen === generation) set((s) => ({ inFlight: without(s.inFlight, id) }))
      }
    },
  }
})

/** The stored check for one message, or `null` (the same value every time) when there is none. */
export function useCitationCheck(id: string | undefined): CitationCheckResult | null {
  return useCitationCheckStore((s) => (id ? (s.byMessage[id] ?? null) : null))
}

/** Empty every check, availability, in-flight mark and error. Called by setupTests.ts. */
export function resetCitationChecks(): void {
  generation += 1
  requested = new Set()
  queue = []
  flushScheduled = false
  useCitationCheckStore.setState({ byMessage: {}, availability: null, inFlight: {}, errors: {} })
}
