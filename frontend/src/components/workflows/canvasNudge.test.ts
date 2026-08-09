/**
 * Phase 184-07 Task 1 — canvasNudge tests.
 *
 * Proves the four claims the C-local decision rests on, and one of them (R3's *"a
 * nudge produces zero network requests"*) at the level where it is structurally true
 * rather than merely observed:
 *
 *   1. ROUND TRIP — a nudge written is a nudge read, per user and per draft.
 *   2. ISOLATION — two users and two drafts never see each other's map, and "Tidy up"
 *      clears exactly one key (T-184-07-01).
 *   3. THE UNSAVED DRAFT PERSISTS NOTHING — `localStorage.length` is unchanged after a
 *      write with no draft id, so there is no orphan-key bucket to garbage-collect.
 *   4. DEGRADE, NEVER CRASH — a corrupt entry, a non-numeric value, a throwing read and
 *      an exhausted quota each resolve honestly (T-184-07-03).
 *
 * Structural analog: `hooks/useResizablePanel.test.ts` (the storage-test shape) plus
 * `definitionOps.test.ts`'s belt-and-braces network proof — a `?raw` source fence (the
 * module cannot NAME a request seam) and a whole-suite spy (nothing it calls opens one).
 * Both halves carry positive controls, because an assertion that has only ever passed
 * is not evidence.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
  type MockInstance,
} from "vitest"

import canvasNudgeSource from "./canvasNudge?raw"
import {
  CANVAS_NUDGE_KEY_PREFIX,
  canvasNudgeKey,
  clearNudges,
  readNudges,
  writeNudge,
} from "./canvasNudge"

/**
 * R3's whole-suite tripwire. Installed once, asserted LAST. The equivalent spy in
 * `definitionOps.test.ts` was falsified with a planted call, so the wrapper is known to
 * be live under jsdom rather than vacuously absent.
 */
let fetchSpy: MockInstance

beforeAll(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch")
})

afterAll(() => {
  fetchSpy.mockRestore()
})

/**
 * Plant a Supabase auth-token entry in the shape `getCurrentUserIdSync()` reads
 * (`streamsCache.ts:64-78`: an `sb-<ref>-auth-token` key whose JSON carries `user.id`).
 * Signing in as a DIFFERENT id is how the two-user isolation case is driven.
 */
const signIn = (userId: string): void => {
  localStorage.setItem(
    "sb-testproject-auth-token",
    JSON.stringify({ user: { id: userId } }),
  )
}

/** Every durable key this module owns, for counting. */
const nudgeKeys = (): string[] =>
  Object.keys(localStorage).filter((k) => k.startsWith(CANVAS_NUDGE_KEY_PREFIX))

beforeEach(() => {
  localStorage.clear()
  // Empty the module-level session bucket so one test's in-memory nudge cannot leak
  // into the next — the bucket is module state, and the module is imported once.
  clearNudges(null)
})

// ── The key namespace ──────────────────────────────────────────────────────────

describe("canvasNudge — the key namespace", () => {
  it("resolves the documented user + draft scoped shape", () => {
    expect(CANVAS_NUDGE_KEY_PREFIX).toBe("agentic-rag.canvas-nudge.v1")
    expect(canvasNudgeKey("u1", "d1")).toBe("agentic-rag.canvas-nudge.v1.u1.d1")
  })

  it("gives two users different keys and two drafts different keys", () => {
    expect(canvasNudgeKey("u1", "d1")).not.toBe(canvasNudgeKey("u2", "d1"))
    expect(canvasNudgeKey("u1", "d1")).not.toBe(canvasNudgeKey("u1", "d2"))
  })
})

// ── Round trip ─────────────────────────────────────────────────────────────────

describe("canvasNudge — round trip", () => {
  beforeEach(() => signIn("user-a"))

  it("reads back an entry it wrote", () => {
    writeNudge("draft-1", "search", 42)
    expect(readNudges("draft-1")).toEqual({ search: 42 })
  })

  it("keeps two slugs side by side", () => {
    writeNudge("draft-1", "search", 42)
    writeNudge("draft-1", "deliver", -18)
    expect(readNudges("draft-1")).toEqual({ search: 42, deliver: -18 })
  })

  it("overwrites a second write to the same slug", () => {
    writeNudge("draft-1", "search", 42)
    writeNudge("draft-1", "search", 7)
    expect(readNudges("draft-1")).toEqual({ search: 7 })
  })

  it("stores the map under exactly ONE key", () => {
    writeNudge("draft-1", "search", 42)
    writeNudge("draft-1", "deliver", -18)
    expect(nudgeKeys()).toEqual([canvasNudgeKey("user-a", "draft-1")])
  })

  it("returns a fresh object — a caller cannot mutate the stored map", () => {
    writeNudge("draft-1", "search", 42)
    const first = readNudges("draft-1")
    first.search = 999
    expect(readNudges("draft-1")).toEqual({ search: 42 })
  })

  it("returns {} for a draft that has never been nudged", () => {
    expect(readNudges("draft-never-touched")).toEqual({})
  })

  it("ignores a non-finite dy and an empty slug rather than storing an unreadable value", () => {
    writeNudge("draft-1", "search", Number.NaN)
    writeNudge("draft-1", "search", Number.POSITIVE_INFINITY)
    writeNudge("draft-1", "", 12)
    expect(readNudges("draft-1")).toEqual({})
    expect(nudgeKeys()).toEqual([])
  })
})

// ── T-184-07-01: user scoping ──────────────────────────────────────────────────

describe("canvasNudge — user scoping (a shared origin must not leak a layout)", () => {
  it("does not show user A's nudges to user B on the same draft", () => {
    signIn("user-a")
    writeNudge("draft-1", "search", 42)
    expect(readNudges("draft-1")).toEqual({ search: 42 })

    signIn("user-b")
    expect(readNudges("draft-1")).toEqual({})

    writeNudge("draft-1", "search", -30)
    expect(readNudges("draft-1")).toEqual({ search: -30 })

    signIn("user-a")
    expect(readNudges("draft-1")).toEqual({ search: 42 })
  })

  it("keeps the two users' entries under two distinct keys", () => {
    signIn("user-a")
    writeNudge("draft-1", "search", 42)
    signIn("user-b")
    writeNudge("draft-1", "search", -30)

    expect(nudgeKeys().sort()).toEqual(
      [canvasNudgeKey("user-a", "draft-1"), canvasNudgeKey("user-b", "draft-1")].sort(),
    )
  })
})

// ── Draft scoping + "Tidy up" ──────────────────────────────────────────────────

describe("canvasNudge — draft scoping and Tidy up", () => {
  beforeEach(() => signIn("user-a"))

  it("does not show one draft's nudges on another draft", () => {
    writeNudge("draft-a", "search", 42)
    writeNudge("draft-b", "search", -30)
    expect(readNudges("draft-a")).toEqual({ search: 42 })
    expect(readNudges("draft-b")).toEqual({ search: -30 })
  })

  it("clears THIS workflow's key only — a sibling draft survives", () => {
    writeNudge("draft-a", "search", 42)
    writeNudge("draft-b", "search", -30)

    clearNudges("draft-a")

    expect(readNudges("draft-a")).toEqual({})
    expect(readNudges("draft-b")).toEqual({ search: -30 })
    expect(nudgeKeys()).toEqual([canvasNudgeKey("user-a", "draft-b")])
  })

  it("never touches another user's key", () => {
    signIn("user-b")
    writeNudge("draft-a", "search", -30)
    signIn("user-a")
    writeNudge("draft-a", "search", 42)

    clearNudges("draft-a")

    expect(readNudges("draft-a")).toEqual({})
    signIn("user-b")
    expect(readNudges("draft-a")).toEqual({ search: -30 })
  })

  it("is a no-op on a draft that has no key", () => {
    expect(() => clearNudges("draft-never-touched")).not.toThrow()
    expect(nudgeKeys()).toEqual([])
  })
})

// ── The unsaved-draft rule: persist NOTHING ────────────────────────────────────

describe("canvasNudge — an unsaved draft (no id) persists nothing", () => {
  beforeEach(() => signIn("user-a"))

  it("round-trips in memory while creating ZERO storage keys", () => {
    const before = localStorage.length

    writeNudge(null, "search", 42)
    writeNudge(null, "deliver", -18)

    expect(readNudges(null)).toEqual({ search: 42, deliver: -18 })
    expect(localStorage.length).toBe(before)
    expect(nudgeKeys()).toEqual([])
  })

  it("does not leak the session bucket into a real draft's map", () => {
    writeNudge(null, "search", 42)
    expect(readNudges("draft-1")).toEqual({})
  })

  it("clears the session bucket without creating or removing a key", () => {
    writeNudge(null, "search", 42)
    const before = localStorage.length

    clearNudges(null)

    expect(readNudges(null)).toEqual({})
    expect(localStorage.length).toBe(before)
  })

  it("falls back to memory when NO user id resolves, rather than writing an unscoped key", () => {
    localStorage.clear() // signed out — `getCurrentUserIdSync()` returns null
    const before = localStorage.length

    writeNudge("draft-1", "search", 42)

    expect(localStorage.length).toBe(before)
    expect(nudgeKeys()).toEqual([])
    expect(readNudges("draft-1")).toEqual({ search: 42 })
  })
})

// ── T-184-07-03: degrade, never crash ──────────────────────────────────────────

describe("canvasNudge — the defensive read", () => {
  beforeEach(() => signIn("user-a"))

  it("returns {} for a corrupt entry rather than throwing", () => {
    localStorage.setItem(canvasNudgeKey("user-a", "draft-1"), "{not json")
    expect(() => readNudges("draft-1")).not.toThrow()
    expect(readNudges("draft-1")).toEqual({})
  })

  it("drops non-numeric and non-finite values, keeping the good ones", () => {
    localStorage.setItem(
      canvasNudgeKey("user-a", "draft-1"),
      JSON.stringify({ search: "42", deliver: 12, ask: null, write: true }),
    )
    expect(readNudges("draft-1")).toEqual({ deliver: 12 })
  })

  it("returns {} for a stored value that is not an object", () => {
    localStorage.setItem(canvasNudgeKey("user-a", "draft-1"), JSON.stringify([1, 2, 3]))
    expect(readNudges("draft-1")).toEqual({})
    localStorage.setItem(canvasNudgeKey("user-a", "draft-1"), JSON.stringify(null))
    expect(readNudges("draft-1")).toEqual({})
  })

  it("returns {} when the storage read itself throws", () => {
    // Plant a SESSION entry first. If `readNudges` returned the in-memory bucket here,
    // this assertion would see `ghost` — so passing proves the module's OWN catch fired
    // rather than the no-key fallback quietly standing in for it.
    writeNudge(null, "ghost", 99)

    const realGetItem = Storage.prototype.getItem
    const getSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(function (this: Storage, key: string): string | null {
        if (key.startsWith(CANVAS_NUDGE_KEY_PREFIX)) throw new Error("storage unavailable")
        return realGetItem.call(this, key)
      })

    try {
      expect(() => readNudges("draft-1")).not.toThrow()
      expect(readNudges("draft-1")).toEqual({})
    } finally {
      getSpy.mockRestore()
    }
  })
})

describe("canvasNudge — the quota discipline", () => {
  beforeEach(() => signIn("user-a"))

  it("warns and falls through when the quota is exhausted — never throws", () => {
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError")
    })
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    try {
      expect(() => writeNudge("draft-1", "search", 42)).not.toThrow()
      expect(warnSpy).toHaveBeenCalledTimes(1)
    } finally {
      setSpy.mockRestore()
      warnSpy.mockRestore()
    }
  })

  it("does not warn on a write that succeeds", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      writeNudge("draft-1", "search", 42)
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it("clearNudges survives a throwing removeItem", () => {
    const rmSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage unavailable")
    })
    try {
      expect(() => clearNudges("draft-1")).not.toThrow()
    } finally {
      rmSpy.mockRestore()
    }
  })
})

// ── T-184-07-02: the source fence (the shipped `?raw` grep idiom) ──────────────

describe("canvasNudge — source purity (the ?raw grep, the shipped house idiom)", () => {
  it("imports neither the builder store, the canvas model, nor the API client", () => {
    expect(canvasNudgeSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    expect(canvasNudgeSource).not.toMatch(
      /from\s+["']@\/components\/workflows\/builderStore["']/,
    )
    expect(canvasNudgeSource).not.toMatch(
      /from\s+["']@\/components\/workflows\/canvasModel["']/,
    )
  })

  it("names no server seam and opens no network call", () => {
    expect(canvasNudgeSource).not.toMatch(/fetch\(/)
    expect(canvasNudgeSource).not.toMatch(/workflows\/validate/)
    expect(canvasNudgeSource).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
  })

  it("REUSES the shipped user-id resolver instead of re-deriving the auth-token read", () => {
    expect(canvasNudgeSource).toMatch(/from\s+["']@\/lib\/streamsCache["']/)
    expect(canvasNudgeSource).toMatch(/getCurrentUserIdSync/)
    // The G-5 half: the resolver is IMPORTED, never declared a second time here.
    // Deliberately NOT a blanket grep for the auth-token key name — the module's
    // docblock explains WHY the read is reused, and a fence that forced that sentence
    // to omit the thing it is about is the "a comment that lies" trap (D-ITEM-183-02).
    expect(canvasNudgeSource).not.toMatch(/function getCurrentUserIdSync/)
  })

  it("those fences are real — each regex matches its planted literal", () => {
    expect('const r = await fetch("/x")').toMatch(/fetch\(/)
    expect('import { x } from "@/lib/api"').toMatch(/from\s+["']@\/lib\/api["']/)
    expect('import { s } from "@/components/workflows/builderStore"').toMatch(
      /from\s+["']@\/components\/workflows\/builderStore["']/,
    )
    expect('import { m } from "@/components/workflows/canvasModel"').toMatch(
      /from\s+["']@\/components\/workflows\/canvasModel["']/,
    )
    expect("new EventSource(url)").toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
    expect("function getCurrentUserIdSync(): string | null {").toMatch(
      /function getCurrentUserIdSync/,
    )
  })
})

// ── The whole-suite network tripwire (must run LAST) ──────────────────────────

describe("canvasNudge — zero network calls across the entire suite", () => {
  it("the fetch spy recorded exactly 0 calls", () => {
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(fetchSpy.mock.calls).toHaveLength(0)
  })
})
