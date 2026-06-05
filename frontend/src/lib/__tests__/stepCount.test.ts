/**
 * Phase 095 Plan 01 Task 1 — tests for the D-04 single-source-of-truth
 * step-count derivation.
 *
 * `unifiedStepCount(message)` + the extracted `dedupToolCalls()` are THE one
 * integer/array every consumer (RunCard step label, collapsed-row "N steps",
 * RunCard header, status strip, rail node count) reads in later plans — they
 * can never disagree. The dedup MUST be byte-identical to the canonical
 * ToolCallPanel.tsx:321-334 useMemo so the panel count and the headline count
 * never drift.
 *
 * Coverage (095-VALIDATION.md D-04 row):
 *  - empty / undefined / null input → []
 *  - 5 raw tool_calls where 2 share a clientKey → unifiedStepCount = 4
 *  - N deduped tools spread across M iterations → N (NOT M) — proves the
 *    count ignores iterationCount entirely (cross-provider-safe count)
 *  - DB-loaded message without clientKey but distinct name/startedAt →
 *    composite fallback `${name}-${startedAt}-${idx}` dedups correctly
 *  - dedup preserves first-occurrence ordering (same as ToolCallPanel)
 */
import { describe, it, expect } from "vitest"
import { dedupToolCalls, unifiedStepCount } from "../stepCount"
import type { ToolCall } from "@/types"

// Minimal ToolCall factory — only the fields the dedup key touches matter.
function tc(partial: Partial<ToolCall>): ToolCall {
  return {
    name: partial.name ?? "search_documents",
    args: partial.args ?? {},
    status: partial.status ?? "done",
    ...partial,
  }
}

describe("dedupToolCalls", () => {
  it("returns [] for undefined input", () => {
    expect(dedupToolCalls(undefined)).toEqual([])
  })

  it("returns [] for null input", () => {
    expect(dedupToolCalls(null)).toEqual([])
  })

  it("returns [] for an empty array", () => {
    expect(dedupToolCalls([])).toEqual([])
  })

  it("dedups on clientKey, preserving first-occurrence ordering", () => {
    const a = tc({ name: "search_documents", clientKey: "k1" })
    const dupOfA = tc({ name: "search_documents", clientKey: "k1", result: "second snapshot" })
    const b = tc({ name: "execute_code", clientKey: "k2" })
    const result = dedupToolCalls([a, dupOfA, b])
    expect(result).toHaveLength(2)
    // first occurrence kept (a, not dupOfA), ordering preserved
    expect(result[0]).toBe(a)
    expect(result[1]).toBe(b)
  })

  it("falls back to id when clientKey is absent", () => {
    const a = tc({ name: "read", id: "id-1" })
    const dupOfA = tc({ name: "read", id: "id-1" })
    const b = tc({ name: "read", id: "id-2" })
    expect(dedupToolCalls([a, dupOfA, b])).toHaveLength(2)
  })

  it("falls back to composite key (name-startedAt-idx) for DB-loaded messages without clientKey or id", () => {
    // distinct names/startedAt → distinct composite keys → no collapse
    const a = tc({ name: "search_documents", startedAt: 1000 })
    const b = tc({ name: "execute_code", startedAt: 2000 })
    const c = tc({ name: "read", startedAt: 3000 })
    expect(dedupToolCalls([a, b, c])).toHaveLength(3)
  })

  it("composite fallback keeps distinct entries that share name+startedAt via the index suffix", () => {
    // identical name + startedAt — the `idx` suffix makes them distinct keys,
    // so both survive (byte-identical to ToolCallPanel.tsx:321-334 semantics).
    const a = tc({ name: "search_documents", startedAt: 1000 })
    const b = tc({ name: "search_documents", startedAt: 1000 })
    expect(dedupToolCalls([a, b])).toHaveLength(2)
  })
})

describe("unifiedStepCount", () => {
  it("returns 0 for a message with no tool_calls", () => {
    expect(unifiedStepCount({})).toBe(0)
    expect(unifiedStepCount({ tool_calls: undefined })).toBe(0)
    expect(unifiedStepCount({ tool_calls: null })).toBe(0)
    expect(unifiedStepCount({ tool_calls: [] })).toBe(0)
  })

  it("counts 4 when a message has 5 raw tool_calls and 2 share a clientKey", () => {
    const message = {
      tool_calls: [
        tc({ name: "search_documents", clientKey: "k1" }),
        tc({ name: "search_documents", clientKey: "k1" }), // duplicate of k1
        tc({ name: "read", clientKey: "k2" }),
        tc({ name: "execute_code", clientKey: "k3" }),
        tc({ name: "write_todos", clientKey: "k4" }),
      ],
    }
    expect(unifiedStepCount(message)).toBe(4)
  })

  it("returns N (deduped tool count), NOT M (iteration count) — ignores iterationCount entirely", () => {
    // 3 distinct tools spread across 2 iterations. The deduped count is 3,
    // regardless of how many agent-loop iterations produced them. This is the
    // cross-provider-safe count (removes the iteration_start divergence).
    const message = {
      tool_calls: [
        tc({ name: "search_documents", clientKey: "k1", iteration: 0 }),
        tc({ name: "read", clientKey: "k2", iteration: 0 }),
        tc({ name: "execute_code", clientKey: "k3", iteration: 1 }),
      ],
      iterationCount: 1, // M = 2 iterations (0-based) — must be IGNORED
    }
    expect(unifiedStepCount(message)).toBe(3)
    expect(unifiedStepCount(message)).not.toBe(2) // not iterationCount + 1
  })

  it("dedups a DB-loaded message via the composite fallback", () => {
    const message = {
      tool_calls: [
        tc({ name: "search_documents", startedAt: 1000 }),
        tc({ name: "read", startedAt: 2000 }),
      ],
    }
    expect(unifiedStepCount(message)).toBe(2)
  })
})
