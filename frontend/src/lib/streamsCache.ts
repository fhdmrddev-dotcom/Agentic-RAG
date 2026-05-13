/**
 * Phase 068.5: Surface-keyed localStorage snapshot helper.
 *
 * Mirrors `bucketsBySurface: Map<SurfaceId, Map<string, Message[]>>` 1:1 on
 * disk so hydrate is a structural assign, not a transformation
 * (L-068.5-03 invariant — round-trip preserves shape exactly).
 *
 * Decisions / invariants honored:
 *   - D-068.5-01: localStorage snapshot for F5 resilience.
 *   - D-068.5-02: 5–10 thread cap per surface, LRU by lastAccessedAt.
 *   - D-068.5-03: Throttle target (provider useEffect #4 calls writeSnapshotToLocalStorage
 *                 every ~500ms; the throttle lives in the provider, not here).
 *   - D-068.5-04: Surface-keyed; future v3.0 eval pane inherits resilience for free.
 *   - L-068.5-03: bucketsBySurface shape unchanged across the round-trip.
 *
 * Pitfall closures:
 *   - Pitfall 1 / Pitfall 8: readSnapshotSyncOrEmpty() is synchronous; called
 *     inside the Zustand store factory so the first paint sees cached content
 *     (NOT inside useEffect — that would land AFTER first paint and flash).
 *   - Pitfall 4 (iOS Safari private mode / Quota exhaustion): writeSnapshotToLocalStorage
 *     wraps setItem in try { } catch (QuotaExceededError) { evict-half + retry-once };
 *     on second throw, console.warn + silent fall-through (in-memory bucket still works).
 *
 * Canonical reference: 068.5-RESEARCH.md §Code Examples lines 607-703.
 */
import type { Message } from "@/types"
import type { SurfaceId } from "@/stores/streamsStore"

export const STREAMS_CACHE_KEY = "agentic-rag.streams.v1" as const
export const STREAMS_CACHE_VERSION = 1 as const
export const STREAMS_CACHE_MAX_THREADS_PER_SURFACE = 10 as const

interface SerializedThreadEntry {
  messages: Message[]
  lastAccessedAt: number
}

interface SerializedSnapshot {
  version: number
  surfaces: Record<SurfaceId, Record<string, SerializedThreadEntry>>
}

/**
 * Synchronous read of the snapshot from localStorage. Never throws — any
 * parse failure / version drift / missing key returns an empty Map.
 *
 * Pitfall 1 / Pitfall 8 closure: called inside the Zustand store factory so
 * the FIRST paint sees cached content, not the empty Map.
 */
export function readSnapshotSyncOrEmpty(): Map<SurfaceId, Map<string, Message[]>> {
  try {
    const raw = localStorage.getItem(STREAMS_CACHE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as SerializedSnapshot
    if (!parsed || typeof parsed !== "object" || parsed.version !== STREAMS_CACHE_VERSION) {
      // Version drift — drop the key entirely so a future shape change cannot
      // poison the read path.
      try {
        localStorage.removeItem(STREAMS_CACHE_KEY)
      } catch {
        /* ignore — read path must never throw */
      }
      return new Map()
    }
    const out = new Map<SurfaceId, Map<string, Message[]>>()
    const surfaces = parsed.surfaces ?? {}
    for (const [surface, threads] of Object.entries(surfaces)) {
      const surfMap = new Map<string, Message[]>()
      for (const [tid, entry] of Object.entries(threads as Record<string, SerializedThreadEntry>)) {
        if (entry && Array.isArray(entry.messages)) {
          surfMap.set(tid, entry.messages)
        }
      }
      out.set(surface, surfMap)
    }
    return out
  } catch {
    return new Map()
  }
}

/**
 * Trailing-edge write target. Serializes the bucketsBySurface Map to localStorage
 * under a single packed key, applies per-surface LRU cap, and falls back to
 * evict-half-and-retry on QuotaExceededError.
 *
 * `now` is parameterized for test determinism (default Date.now()). Per Pitfall 5:
 * v1 uses snapshot-time uniformly for lastAccessedAt; per-thread access-time is
 * a future refinement.
 */
export function writeSnapshotToLocalStorage(
  buckets: Map<SurfaceId, Map<string, Message[]>>,
  now: number = Date.now(),
): void {
  // Pitfall 5 mitigation (v1 hybrid):
  //   - For threads ALREADY on disk: preserve their lastAccessedAt so threads
  //     that haven't been touched since their first cache entry age naturally
  //     against newly-added threads.
  //   - For threads NEW to the cache: assign `now`.
  // This keeps the writer simple (no Map-reference plumbing through Zustand)
  // while giving the LRU eviction enough ordering signal to drop the
  // genuinely-oldest threads. Per-thread "I am viewing this thread NOW"
  // semantics (a real LRU update) are owned by setViewingThread's flush —
  // the flush re-runs this function; new threads from the in-memory bucket
  // get `now` here. A pure refresh of an existing thread's lastAccessedAt
  // is a future refinement.
  const priorRaw = (() => {
    try {
      return localStorage.getItem(STREAMS_CACHE_KEY)
    } catch {
      return null
    }
  })()
  let priorTimes: Map<string, Map<string, number>> | null = null
  if (priorRaw) {
    try {
      const priorParsed = JSON.parse(priorRaw) as SerializedSnapshot
      if (priorParsed && priorParsed.version === STREAMS_CACHE_VERSION) {
        priorTimes = new Map()
        for (const [surface, threads] of Object.entries(priorParsed.surfaces ?? {})) {
          const surfTimes = new Map<string, number>()
          for (const [tid, entry] of Object.entries(
            threads as Record<string, SerializedThreadEntry>,
          )) {
            if (entry && typeof entry.lastAccessedAt === "number") {
              surfTimes.set(tid, entry.lastAccessedAt)
            }
          }
          priorTimes.set(surface, surfTimes)
        }
      }
    } catch {
      priorTimes = null
    }
  }

  const snapshot: SerializedSnapshot = {
    version: STREAMS_CACHE_VERSION,
    surfaces: {},
  }
  for (const [surface, threads] of buckets) {
    const surfaceEntry: Record<string, SerializedThreadEntry> = {}
    const priorSurf = priorTimes?.get(surface)
    for (const [tid, messages] of threads) {
      // If we have a prior entry for this surface+thread, keep its
      // lastAccessedAt so it ages naturally — only NEW threads get `now`.
      const prior = priorSurf?.get(tid)
      surfaceEntry[tid] = {
        messages,
        lastAccessedAt: typeof prior === "number" ? prior : now,
      }
    }
    snapshot.surfaces[surface] = surfaceEntry
  }
  evictPerSurfaceIfOver(snapshot, STREAMS_CACHE_MAX_THREADS_PER_SURFACE)
  try {
    localStorage.setItem(STREAMS_CACHE_KEY, JSON.stringify(snapshot))
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      // Drop oldest half across all surfaces and retry once. If second throw,
      // give up — in-memory bucket still works; cache is disabled this session.
      evictOldestHalf(snapshot)
      try {
        localStorage.setItem(STREAMS_CACHE_KEY, JSON.stringify(snapshot))
      } catch {
        console.warn(
          "[streamsCache] quota exhausted after eviction; cache disabled this session",
        )
      }
    } else {
      console.warn("[streamsCache] write failed:", err)
    }
  }
}

/**
 * Per-surface LRU eviction: keep only the `maxPerSurface` most-recently
 * accessed threads (descending lastAccessedAt). v1 uses snapshot-time uniformly
 * so a single packed write keeps the most recent N writes; multi-tick writes
 * (e.g., the LRU eviction test) preserve correct ordering.
 */
function evictPerSurfaceIfOver(
  snapshot: SerializedSnapshot,
  maxPerSurface: number,
): void {
  for (const surface of Object.keys(snapshot.surfaces)) {
    const threads = snapshot.surfaces[surface]
    const entries = Object.entries(threads)
    if (entries.length <= maxPerSurface) continue
    entries.sort((a, b) => b[1].lastAccessedAt - a[1].lastAccessedAt)
    const kept: Record<string, SerializedThreadEntry> = {}
    for (const [tid, entry] of entries.slice(0, maxPerSurface)) {
      kept[tid] = entry
    }
    snapshot.surfaces[surface] = kept
  }
}

/**
 * Quota-exceeded last-resort fallback: drop the oldest half of every surface,
 * then retry the write. If the retry also throws, the caller swallows it.
 */
function evictOldestHalf(snapshot: SerializedSnapshot): void {
  for (const surface of Object.keys(snapshot.surfaces)) {
    const entries = Object.entries(snapshot.surfaces[surface])
    entries.sort((a, b) => b[1].lastAccessedAt - a[1].lastAccessedAt)
    const half = Math.ceil(entries.length / 2)
    const kept: Record<string, SerializedThreadEntry> = {}
    for (const [tid, entry] of entries.slice(0, half)) {
      kept[tid] = entry
    }
    snapshot.surfaces[surface] = kept
  }
}
