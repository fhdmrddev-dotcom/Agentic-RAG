/**
 * Phase 128 Plan 03 Task 2 (TDP-02) — unit tests for `preparingDescription(tc)`
 * in the shared `src/lib/providerLogo.tsx` helper (D-05: one module, not two).
 *
 * The helper surfaces a tool's `description` DURING the `preparing` window —
 * before `tool_start` — by reading the partial-JSON `tc.argsCodeText` (the
 * parsed `tc.args` stays `{}` until `tool_start`; research Pitfall 1). It
 * prefers a parsed `tc.args.description` once present, falls back to the
 * partial-JSON text (full parse then a targeted regex), returns `null` when
 * nothing is on the wire, and NEVER throws in this render-path mapper (every
 * `JSON.parse` is try/catch → null — the `seamCardPayloadFor` rule).
 *
 * Pure value assertions, no JSX (mirrors the sibling `model-info.test.ts`).
 */
import { describe, it, expect } from "vitest"
import { preparingDescription } from "@/lib/providerLogo"
import type { ToolCall } from "@/types"

function makeToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    name: "execute_code",
    args: {},
    status: "preparing",
    ...overrides,
  } as ToolCall
}

describe("preparingDescription", () => {
  // Test 1 — parsed args preferred (running/done, or an atomic provider).
  it("returns the parsed tc.args.description when present and non-empty", () => {
    const tc = makeToolCall({
      args: { description: "render a chart" },
      status: "running",
    })
    expect(preparingDescription(tc)).toBe("render a chart")
  })

  // Test 2 — partial-JSON extraction during preparing (truncated, no closing brace).
  it("extracts description from a truncated partial-JSON argsCodeText", () => {
    const tc = makeToolCall({
      args: {},
      status: "preparing",
      argsCodeText: '{"description":"render a chart"',
    })
    expect(preparingDescription(tc)).toBe("render a chart")
  })

  // Test 3 — full-parse path (complete JSON object).
  it("extracts description via full JSON.parse when argsCodeText is complete", () => {
    const tc = makeToolCall({
      args: {},
      status: "preparing",
      argsCodeText: '{"description":"hello","code":"x=1"}',
    })
    expect(preparingDescription(tc)).toBe("hello")
  })

  // Test 4 — honest null: partial JSON with no description key.
  it("returns null when argsCodeText carries no description key", () => {
    const tc = makeToolCall({
      args: {},
      status: "preparing",
      argsCodeText: '{"code":"x=1"',
    })
    expect(preparingDescription(tc)).toBeNull()
  })

  // Test 5 — honest null: nothing on the wire.
  it("returns null when args is empty and argsCodeText is undefined", () => {
    const tc = makeToolCall({ args: {}, status: "preparing", argsCodeText: undefined })
    expect(preparingDescription(tc)).toBeNull()
  })

  // Test 6 — never throws on garbage (malformed mid-key).
  it("returns null and does not throw on malformed argsCodeText", () => {
    const tc = makeToolCall({
      args: {},
      status: "preparing",
      argsCodeText: '{"descr',
    })
    expect(() => preparingDescription(tc)).not.toThrow()
    expect(preparingDescription(tc)).toBeNull()
  })
})
