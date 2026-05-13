/**
 * Phase 068.5 (Plan 01 — Wave 0): RED test stubs for `frontend/src/lib/streamsCache.ts`.
 *
 * Tests the surface-keyed localStorage snapshot helper that mirrors
 * `bucketsBySurface: Map<SurfaceId, Map<string, Message[]>>` (L-068.5-03 shape
 * invariant) and provides:
 *   - Synchronous-read closure for Pitfall 1/8 (readSnapshotSyncOrEmpty)
 *   - Trailing-edge write target with per-surface LRU + QuotaExceededError fallback
 *   - Version-drift recovery (drops the key on shape mismatch)
 *   - Parse-failure graceful empty (never throws)
 *
 * Canonical reference: 068.5-RESEARCH.md §Code Examples lines 607-703.
 *
 * RED at task start (file doesn't exist); GREEN at Task 3 end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
// RED — implements in Task 3
import {
  readSnapshotSyncOrEmpty,
  writeSnapshotToLocalStorage,
  STREAMS_CACHE_KEY,
  STREAMS_CACHE_VERSION,
} from "@/lib/streamsCache"
import type { Message } from "@/types"

const NOW = "2026-05-13T00:00:00Z"

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-A",
    user_id: "user-1",
    role: "user",
    content: "Hello",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

describe("Phase 068.5 — streamsCache: serialize round-trip", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("write + read returns a structurally-equal Map", () => {
    const buckets = new Map<string, Map<string, Message[]>>()
    const chatMap = new Map<string, Message[]>()
    chatMap.set("thread-A", [makeMessage({ id: "m1" }), makeMessage({ id: "m2" })])
    chatMap.set("thread-B", [makeMessage({ id: "m3" })])
    buckets.set("chat", chatMap)

    writeSnapshotToLocalStorage(buckets)
    const out = readSnapshotSyncOrEmpty()

    expect(out.get("chat")?.get("thread-A")?.map((m) => m.id)).toEqual(["m1", "m2"])
    expect(out.get("chat")?.get("thread-B")?.map((m) => m.id)).toEqual(["m3"])
  })
})

describe("Phase 068.5 — streamsCache: LRU eviction (per-surface 10 cap)", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("evicts oldest threads by lastAccessedAt when surface exceeds 10 threads", () => {
    // Write 12 threads in order; lastAccessedAt is set to the `now` arg uniformly,
    // so we write them in 12 separate `now` ticks to establish a clear ordering.
    const buckets = new Map<string, Map<string, Message[]>>()
    const chatMap = new Map<string, Message[]>()
    for (let i = 0; i < 12; i++) {
      chatMap.set(`thread-${i}`, [makeMessage({ id: `m-${i}` })])
    }
    buckets.set("chat", chatMap)

    // Single write: per-surface eviction keeps the 10 most recently accessed.
    // Since all share the same `now` arg, we expect the implementation to keep
    // any 10; for a deterministic test we write threads incrementally with
    // ascending `now` values so the "oldest 2" are well-defined.
    let now = 1_000
    for (let i = 0; i < 12; i++) {
      const single = new Map<string, Map<string, Message[]>>()
      const surfMap = new Map<string, Message[]>()
      surfMap.set(`thread-${i}`, [makeMessage({ id: `m-${i}` })])
      // Merge with what's already on disk (read back first).
      const onDisk = readSnapshotSyncOrEmpty()
      const merged = onDisk.get("chat") ?? new Map<string, Message[]>()
      merged.set(`thread-${i}`, [makeMessage({ id: `m-${i}` })])
      single.set("chat", merged)
      writeSnapshotToLocalStorage(single, now)
      now += 100
    }

    const out = readSnapshotSyncOrEmpty()
    const chatSurvivors = out.get("chat")
    expect(chatSurvivors).toBeDefined()
    expect(chatSurvivors!.size).toBe(10)
    // The two oldest (thread-0, thread-1) should be evicted.
    expect(chatSurvivors!.has("thread-0")).toBe(false)
    expect(chatSurvivors!.has("thread-1")).toBe(false)
    expect(chatSurvivors!.has("thread-11")).toBe(true)
  })
})

describe("Phase 068.5 — streamsCache: L-068.5-03 shape invariant", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("deserialized snapshot is Map<SurfaceId, Map<string, Message[]>>, not plain object", () => {
    const buckets = new Map<string, Map<string, Message[]>>()
    const chatMap = new Map<string, Message[]>()
    chatMap.set("thread-A", [makeMessage({ id: "m1" })])
    buckets.set("chat", chatMap)

    writeSnapshotToLocalStorage(buckets)
    const out = readSnapshotSyncOrEmpty()

    expect(out).toBeInstanceOf(Map)
    expect(out.get("chat")).toBeInstanceOf(Map)
    expect(Array.isArray(out.get("chat")?.get("thread-A"))).toBe(true)
  })
})

describe("Phase 068.5 — streamsCache: version drift recovery", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns empty Map AND removes the key when stored version mismatches", () => {
    localStorage.setItem(
      STREAMS_CACHE_KEY,
      JSON.stringify({ version: 999, surfaces: {} }),
    )
    expect(localStorage.getItem(STREAMS_CACHE_KEY)).not.toBeNull()

    const out = readSnapshotSyncOrEmpty()
    expect(out).toBeInstanceOf(Map)
    expect(out.size).toBe(0)
    expect(localStorage.getItem(STREAMS_CACHE_KEY)).toBeNull()
    // STREAMS_CACHE_VERSION export is the source of truth — sanity-check.
    expect(STREAMS_CACHE_VERSION).toBe(1)
  })
})

describe("Phase 068.5 — streamsCache: QuotaExceededError fallback", () => {
  let setItemSpy: ReturnType<typeof vi.spyOn> | null = null

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    if (setItemSpy) {
      setItemSpy.mockRestore()
      setItemSpy = null
    }
  })

  it("evicts oldest half and retries setItem after QuotaExceededError", () => {
    // First setItem throws QuotaExceededError; second setItem succeeds.
    setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("quota", "QuotaExceededError")
      })
    // Subsequent calls fall through to the real implementation.

    const buckets = new Map<string, Map<string, Message[]>>()
    const chatMap = new Map<string, Message[]>()
    for (let i = 0; i < 4; i++) {
      chatMap.set(`thread-${i}`, [makeMessage({ id: `m-${i}` })])
    }
    buckets.set("chat", chatMap)

    writeSnapshotToLocalStorage(buckets)

    // Two setItem calls (first throws, second succeeds after eviction).
    expect(setItemSpy).toHaveBeenCalledTimes(2)
  })
})

describe("Phase 068.5 — streamsCache: parse failure returns empty Map", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns new Map() and does NOT throw when localStorage payload is invalid JSON", () => {
    localStorage.setItem(STREAMS_CACHE_KEY, "not-json{{{")
    let result: Map<unknown, unknown> | null = null
    expect(() => {
      result = readSnapshotSyncOrEmpty()
    }).not.toThrow()
    expect(result).toBeInstanceOf(Map)
    expect(result!.size).toBe(0)
  })
})
