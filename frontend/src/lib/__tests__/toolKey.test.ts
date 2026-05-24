/**
 * Phase 075.9 Task 1 — tests for the stable client-side tool key util.
 *
 * Coverage:
 *  - distinct keys for same name + provider but different message ids
 *  - identical keys for same observation (same provider, message, name,
 *    observedAt)
 *  - index disambiguates collisions when every other field matches
 *  - provider/messageId defaults ("unknown" / "no-msg") render deterministic
 *    keys even when the caller is missing fields
 */
import { describe, it, expect } from "vitest"
import { makeToolKey } from "../toolKey"

describe("makeToolKey", () => {
  it("produces distinct keys for the same tool name + provider but different message ids", () => {
    const k1 = makeToolKey({
      provider: "openai",
      messageId: "msg-a",
      name: "execute_code",
      observedAt: 1_700_000_000_000,
    })
    const k2 = makeToolKey({
      provider: "openai",
      messageId: "msg-b",
      name: "execute_code",
      observedAt: 1_700_000_000_000,
    })
    expect(k1).not.toBe(k2)
  })

  it("produces identical keys for the same observation (deterministic)", () => {
    const opts = {
      provider: "anthropic",
      messageId: "msg-a",
      name: "search_documents",
      observedAt: 1_700_000_000_500,
      index: 2,
    }
    const k1 = makeToolKey(opts)
    const k2 = makeToolKey(opts)
    expect(k1).toBe(k2)
  })

  it("index disambiguates collisions when all other fields match", () => {
    const base = {
      provider: "openrouter",
      messageId: "msg-x",
      name: "execute_code",
      observedAt: 1_700_000_000_750,
    } as const
    const k0 = makeToolKey({ ...base, index: 0 })
    const k1 = makeToolKey({ ...base, index: 1 })
    expect(k0).not.toBe(k1)
  })

  it("falls back to 'unknown' / 'no-msg' defaults when provider or messageId are missing", () => {
    const k1 = makeToolKey({
      name: "ls",
      observedAt: 1_700_000_001_000,
    })
    const k2 = makeToolKey({
      provider: null,
      messageId: null,
      name: "ls",
      observedAt: 1_700_000_001_000,
    })
    // Both call sites should produce the same string — defaults are stable.
    expect(k1).toBe(k2)
    expect(k1).toContain("unknown")
    expect(k1).toContain("no-msg")
  })

  it("omits the trailing index segment when index is undefined", () => {
    const k = makeToolKey({
      provider: "google",
      messageId: "msg-q",
      name: "web_search",
      observedAt: 1_700_000_002_000,
    })
    // pipe-joined parts: provider | messageId | name | observedAt | (empty)
    expect(k.endsWith("|")).toBe(true)
    expect(k.split("|")).toHaveLength(5)
  })
})
