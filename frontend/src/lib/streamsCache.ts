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
import type { Message, Todo, TaskRunIndexItem } from "@/types"
import type { SurfaceId } from "@/stores/streamsStore"

/**
 * Phase 068.5 B-01 fix (2026-05-14): the cache key is user-scoped so a shared
 * origin (dev machine with multiple test logins, kiosk, family device) can't
 * leak one user's chat content into another user's first paint. The legacy
 * key `STREAMS_CACHE_KEY` is preserved as a tombstone target so any prior
 * write under it is cleared on first read.
 *
 * Resolved key shape: `agentic-rag.streams.v1.<user_id>`.
 */
export const STREAMS_CACHE_KEY_PREFIX = "agentic-rag.streams.v1" as const
/** @deprecated B-01: legacy non-partitioned key. Cleared at module load. */
export const STREAMS_CACHE_KEY = "agentic-rag.streams.v1" as const
// Phase 086 Plan 01 (D-086-04): single minor bump 1 -> 2 to admit the two new
// persisted slots (todosByThread + tasksByThread). The read-path version guard
// drops ALL v1 keys on first read (closes failure mode #8 for the bump) — this
// also invalidates the chat-bucket cache, so users see a one-time cold reload of
// recent-thread chat scrollback (accepted; source-of-truth is the DB). Do NOT
// add separate version slots — one version covers the whole serialized shape.
export const STREAMS_CACHE_VERSION = 2 as const
/**
 * Per-surface LRU cap. Rescoped 2026-05-14 (Phase 068.5 follow-up) from 10 → 3:
 * the cache's load-bearing value is two threads (current-viewing + active-streaming)
 * + brief overlap during a switch. Caching all recent threads created localStorage
 * churn for completed threads whose source-of-truth lives in the DB anyway.
 */
export const STREAMS_CACHE_MAX_THREADS_PER_SURFACE = 3 as const

/**
 * B-01: Resolve the current Supabase user_id synchronously by scanning the
 * Supabase auth token storage key (`sb-<project_ref>-auth-token`). Returns
 * null if no session is present. Sync read is safe because Supabase's client
 * loads its session from localStorage at `createClient()` time (module load),
 * so by the time the streamsStore factory runs, the auth token is already on
 * disk (if the user is signed in).
 */
export function getCurrentUserIdSync(): string | null {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { user?: { id?: string } }
      const userId = parsed?.user?.id
      if (typeof userId === "string" && userId.length > 0) return userId
    }
  } catch {
    // Defensive — any localStorage read / JSON parse failure returns null.
  }
  return null
}

/**
 * Build the user-scoped cache key. Callers MUST resolve user_id first and
 * pass a non-empty string. Reads with no user_id should early-return empty
 * Map (see readSnapshotSyncOrEmpty), so this function is never called with
 * an empty user_id.
 */
export function streamsCacheKey(userId: string): string {
  return `${STREAMS_CACHE_KEY_PREFIX}.${userId}`
}

/**
 * B-01 tombstone clear: drops the legacy non-partitioned key if present.
 * Called once at module load to migrate users away from the leaky shape.
 * Idempotent + safe in all browser environments.
 */
function clearLegacyKey(): void {
  try {
    if (localStorage.getItem(STREAMS_CACHE_KEY) !== null) {
      localStorage.removeItem(STREAMS_CACHE_KEY)
    }
  } catch {
    /* localStorage unavailable — nothing to clear */
  }
}
clearLegacyKey()

/**
 * Drop the cache for a specific user — called from auth signOut so the next
 * user on a shared origin starts clean. Idempotent; no-op if the key doesn't
 * exist or the user has no cache.
 */
export function clearCacheForUser(userId: string): void {
  try {
    localStorage.removeItem(streamsCacheKey(userId))
  } catch {
    /* localStorage unavailable */
  }
}

interface SerializedThreadEntry {
  messages: Message[]
  lastAccessedAt: number
}

interface SerializedSnapshot {
  version: number
  surfaces: Record<SurfaceId, Record<string, SerializedThreadEntry>>
  // Phase 086 Plan 01 (D-086-03): ONLY todos + tasks are persisted. pendingAsks
  // are ephemeral (a stale prompt restored on F5 would be misleading) and
  // workspaceFiles are large blobs (quota risk) — neither is cached. Both slots
  // are OPTIONAL so a v2 snapshot written before any panel data exists still
  // round-trips, and the read path tolerates their absence.
  todosByThread?: Record<string, Todo[]>
  tasksByThread?: Record<string, TaskRunIndexItem[]>
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
    // B-01: user-scoped key. No session → no cache (return empty Map; a
    // post-auth follow-up effect can re-hydrate once getSession resolves —
    // acceptable for the rare deep-link-before-auth case).
    const userId = getCurrentUserIdSync()
    if (!userId) return new Map()
    const key = streamsCacheKey(userId)
    const raw = localStorage.getItem(key)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as SerializedSnapshot
    if (!parsed || typeof parsed !== "object" || parsed.version !== STREAMS_CACHE_VERSION) {
      // Version drift — drop the key entirely so a future shape change cannot
      // poison the read path.
      try {
        localStorage.removeItem(key)
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
 * Phase 086 Plan 01: read the persisted parsed v2 snapshot for the current
 * user, applying the SAME version-guard + user-scoped key discipline as
 * readSnapshotSyncOrEmpty. Returns null on any failure / version drift / no
 * session — callers then return an empty Map. Private helper so the two panel
 * readers below don't each re-parse + re-guard.
 */
function readSnapshotParsedOrNull(): SerializedSnapshot | null {
  try {
    const userId = getCurrentUserIdSync()
    if (!userId) return null
    const key = streamsCacheKey(userId)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SerializedSnapshot
    if (!parsed || typeof parsed !== "object" || parsed.version !== STREAMS_CACHE_VERSION) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/**
 * Phase 086 Plan 01 (D-086-03): synchronous first-paint hydration of the
 * per-thread todo lists. Mirrors readSnapshotSyncOrEmpty's discipline (never
 * throws; version-guarded; user-scoped). Object -> Map rebuild keyed by
 * threadId. Called inside the Zustand store factory so the FIRST paint of any
 * panel subscriber sees cached todos.
 */
export function readTodosSyncOrEmpty(): Map<string, Todo[]> {
  try {
    const parsed = readSnapshotParsedOrNull()
    if (!parsed) return new Map()
    const out = new Map<string, Todo[]>()
    for (const [tid, todos] of Object.entries(parsed.todosByThread ?? {})) {
      if (Array.isArray(todos)) out.set(tid, todos)
    }
    return out
  } catch {
    return new Map()
  }
}

/**
 * Phase 086 Plan 01 (D-086-03): synchronous first-paint hydration of the
 * per-thread sub-agent task run index. Same discipline as readTodosSyncOrEmpty.
 */
export function readTasksSyncOrEmpty(): Map<string, TaskRunIndexItem[]> {
  try {
    const parsed = readSnapshotParsedOrNull()
    if (!parsed) return new Map()
    const out = new Map<string, TaskRunIndexItem[]>()
    for (const [tid, tasks] of Object.entries(parsed.tasksByThread ?? {})) {
      if (Array.isArray(tasks)) out.set(tid, tasks)
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
 *
 * Phase 068.5 rescope (Option C, 2026-05-14): `keepPredicate` lets the provider
 * scope persistence to (streaming + currently-viewing) threads only. Predicate
 * returns true for threads worth persisting, false to skip. When omitted, all
 * threads in the in-memory bucket are persisted (legacy behavior, used by tests).
 *
 * Phase 086 Plan 01 (D-086-03): two OPTIONAL trailing params let the provider
 * also persist the per-thread todo + task Maps in the same packed write. Both
 * are serialized as plain Object records (Map -> Record). pendingAsks +
 * workspaceFiles are intentionally NOT accepted here (ephemeral / large-blob).
 * Omitting both keeps the legacy chat-only write behavior (used by existing tests).
 */
export function writeSnapshotToLocalStorage(
  buckets: Map<SurfaceId, Map<string, Message[]>>,
  now: number = Date.now(),
  keepPredicate?: (surfaceId: SurfaceId, threadId: string) => boolean,
  todosByThread?: Map<string, Todo[]>,
  tasksByThread?: Map<string, TaskRunIndexItem[]>,
): void {
  // B-01: user-scoped key. No session → skip the write entirely (the
  // in-memory bucket still holds the data; cache hydrate on next mount only
  // runs after auth resolves anyway).
  const userId = getCurrentUserIdSync()
  if (!userId) return
  const key = streamsCacheKey(userId)
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
      return localStorage.getItem(key)
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
      // Phase 068.5 rescope: skip threads that aren't worth persisting (e.g.,
      // completed background threads whose source-of-truth is the DB).
      if (keepPredicate && !keepPredicate(surface, tid)) continue
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
  // Phase 086 Plan 01 (D-086-03): serialize the optional panel Maps as plain
  // Object records. Only written when the provider supplies them; absent slots
  // simply round-trip as undefined. No LRU/eviction applied — the per-thread
  // todo/task lists are small and bounded by the chat-bucket LRU upstream.
  if (todosByThread) {
    const todosRecord: Record<string, Todo[]> = {}
    for (const [tid, todos] of todosByThread) todosRecord[tid] = todos
    snapshot.todosByThread = todosRecord
  }
  if (tasksByThread) {
    const tasksRecord: Record<string, TaskRunIndexItem[]> = {}
    for (const [tid, tasks] of tasksByThread) tasksRecord[tid] = tasks
    snapshot.tasksByThread = tasksRecord
  }
  evictPerSurfaceIfOver(snapshot, STREAMS_CACHE_MAX_THREADS_PER_SURFACE)
  try {
    localStorage.setItem(key, JSON.stringify(snapshot))
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      // Drop oldest half across all surfaces and retry once. If second throw,
      // give up — in-memory bucket still works; cache is disabled this session.
      evictOldestHalf(snapshot)
      try {
        localStorage.setItem(key, JSON.stringify(snapshot))
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
