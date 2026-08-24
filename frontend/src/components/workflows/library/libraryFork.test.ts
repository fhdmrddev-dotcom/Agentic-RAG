/**
 * Phase 192.1-03 Task 1 (LIB-05 — D-01 / D-22 / D-24, threats T-192.1-05) — the two pure
 * fork leaves, proved as ARITHMETIC.
 *
 * The `libraryFilter.test.ts` posture, and for its reason: both symbols under test are pure
 * module-scope functions that close over nothing, so nothing here renders and nothing here
 * needs a DOM. A substring predicate proved through a renderer is proved expensively and
 * incompletely.
 *
 * What is pinned:
 *  - `freshHash` keeps its SHAPE (6 chars of `[a-z0-9]`), because D-13's copy-fork regex
 *    `^(.*)-[a-z0-9]{6}$` reads it and the `UNIQUE(slug, version)` collision contract expects
 *    it. T-192.1-05: it is a uniqueness suffix, NOT a security token — an "upgrade" to
 *    `crypto.randomUUID()` breaks both readers, so the shape is asserted rather than assumed.
 *  - `isForkConflict` keeps its SUBSTRING test (D-22) — the 409 path, the non-409 path, and
 *    the two nullish inputs that must answer `false` without throwing.
 *  - The purity claim, in its mechanical form: no runtime import from the API client.
 */
import { describe, it, expect } from "vitest"
import libraryForkSource from "./libraryFork?raw"
import { freshHash, isForkConflict } from "./libraryFork"

// ── freshHash — the SHAPE is the contract (D-13, T-8, T-192.1-05) ────────────────────

describe("freshHash — a 6-character [a-z0-9] uniqueness suffix", () => {
  /** The EXACT shape D-13's copy-fork lineage regex reads back out of a forked slug. */
  const SHAPE = /^[a-z0-9]{6}$/

  it("POSITIVE CONTROL — the shape matcher rejects what it must reject", () => {
    // A matcher that accepts everything passes vacuously and looks exactly like one that holds.
    expect("abc12").not.toMatch(SHAPE) // too short
    expect("abc1234").not.toMatch(SHAPE) // too long
    expect("ABC123").not.toMatch(SHAPE) // upper case
    expect("ab-123").not.toMatch(SHAPE) // a separator is what the regex splits ON
    expect("6f1a0e").toMatch(SHAPE) // …and the legal spelling really passes
  })

  it("returns the shape on EVERY call, not merely on a lucky one", () => {
    // `Math.random().toString(36)` can fall short of 6 characters; the shipped loop is what
    // makes the shape unconditional, so it is exercised over many draws rather than one.
    for (let i = 0; i < 500; i++) {
      expect(freshHash()).toMatch(SHAPE)
    }
  })

  it("two calls differ — it is a uniqueness suffix, and a constant would not be one", () => {
    const draws = new Set(Array.from({ length: 200 }, () => freshHash()))
    // Not `=== 200`: a genuine collision over 36^6 is legal, if wildly improbable. What a
    // broken (constant) implementation looks like is a set of size 1.
    expect(draws.size).toBeGreaterThan(190)
  })

  it("T-192.1-05 — it is NOT a security token, and the source says so rather than drifting", () => {
    // The threat register's `accept` disposition, made mechanical: `crypto.randomUUID()` is
    // 36 characters with hyphens, so "upgrading" this breaks D-13's regex AND the collision
    // contract. The fence is the grep, because prose alone does not stop the upgrade.
    expect(libraryForkSource).not.toMatch(/randomUUID/)
    expect(libraryForkSource).not.toMatch(/\bcrypto\./)
  })
})

// ── isForkConflict — D-22: the substring test MOVES, it is not upgraded ──────────────

describe("isForkConflict — a 409 slug/version collision, classified by the message", () => {
  it("a 409 is a conflict", () => {
    expect(isForkConflict(new Error("POST /workflows failed (status 409)"))).toBe(true)
  })

  it("a 500 is not", () => {
    expect(isForkConflict(new Error("POST /workflows failed (status 500)"))).toBe(false)
  })

  it("nullish input answers false and does not throw", () => {
    // The starter loop calls this inside a `catch`, where `e` is `unknown` — a throw here
    // would replace a reported failure with an unreported one.
    expect(() => isForkConflict(null)).not.toThrow()
    expect(() => isForkConflict(undefined)).not.toThrow()
    expect(isForkConflict(null)).toBe(false)
    expect(isForkConflict(undefined)).toBe(false)
  })

  it("D-22 — WR-08's re-open trigger survived the move, verbatim", () => {
    // The predicate's fragility is recorded AT the predicate, not in a planning document that
    // the next author will not be reading when they touch `createWorkflowDraft`'s throw site.
    expect(libraryForkSource).toContain("WR-08")
    expect(libraryForkSource).toContain(
      "the next phase that touches `createWorkflowDraft`'s throw site replaces this",
    )
  })
})

// ── purity ───────────────────────────────────────────────────────────────────────────

describe("the module is pure — it imports NOTHING at runtime", () => {
  const VALUE_IMPORT_FROM_API = /^import\s+(?!type\b)[^\n]*from\s+["']@\/lib\/api["']/m

  it("POSITIVE CONTROL — the detector catches a value import of the API client", () => {
    expect('import { createWorkflowDraft } from "@/lib/api"').toMatch(VALUE_IMPORT_FROM_API)
    expect('import createWorkflowDraft from "@/lib/api"').toMatch(VALUE_IMPORT_FROM_API)
    // …and the legal spelling is NOT caught, or the assertion below is unsatisfiable.
    expect('import type { PublishedWorkflow } from "@/lib/api"').not.toMatch(VALUE_IMPORT_FROM_API)
  })

  it("the source carries no value import of the API client", () => {
    expect(libraryForkSource.length).toBeGreaterThan(0)
    expect(libraryForkSource).not.toMatch(VALUE_IMPORT_FROM_API)
  })

  it("it holds no React, no JSX and no DOM", () => {
    expect(libraryForkSource).not.toMatch(/from\s+["']react["']/)
    expect(libraryForkSource).not.toMatch(/document\./)
  })
})
