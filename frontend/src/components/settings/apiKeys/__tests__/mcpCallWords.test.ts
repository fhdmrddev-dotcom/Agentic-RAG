/**
 * Phase 305-03 (KEY-07; D-53 / Pitfall 7; UI-SPEC §Surface 3) — what an AI tool key's call reads as.
 *
 * Read by the WORDS, through the public `callWords` / `callDetailLine` (which delegate to
 * `mcpCallWords` for an MCP key) and directly. ONE reason vocabulary, shared with the backend
 * (`app/mcp/audit.py`): refused `rate_limited:read` / `rate_limited:expensive` / `tool_not_granted`
 * / `limiter_unavailable` / `maintenance`; answered outcomes `ok` / `error` / `redaction_blocked`.
 * A call that was not answered never reads with a tick.
 */
import { describe, expect, it } from "vitest"
import type { ApiKeyCall } from "@/lib/api/apiKeys"
import { callDetailLine, callWords } from "../apiKeyFacts"
import { mcpCallWords } from "../mcpCallWords"
import mcpCallWordsRaw from "../mcpCallWords.ts?raw"
import { NOW, iso, makeKey, makeMcpKey } from "./fixtures"

const KEY = makeMcpKey({ revoked_at: iso(2026, 9, 6), expires_at: iso(2027, 0, 23) })
const LIMITS = { starts_per_minute: 10, reads_per_minute: 120, searches_per_minute: 30 }
const ctx = { key: KEY, limits: LIMITS, orgName: "Acme", now: NOW }

function call(over: Partial<ApiKeyCall> = {}): ApiKeyCall {
  return {
    at: iso(2026, 9, 25, 10, 42),
    verb: "read",
    workflow_id: null,
    workflow_name: null,
    run_id: null,
    ok: true,
    outcome: "ok",
    reason: null,
    detail: null,
    tool: "search_knowledge_base",
    ...over,
  }
}

const words = (c: ApiKeyCall, x: object = ctx) => callWords(c, x).text

describe("305-03 an MCP call's result words", () => {
  it("answered: ✓ answered (outcome ok or null)", () => {
    expect(callWords(call(), ctx)).toEqual({ ok: true, text: "✓ answered" })
    expect(words(call({ outcome: null }))).toBe("✓ answered")
  })

  it("withheld, failed and an unknown outcome never tick", () => {
    expect(callWords(call({ ok: false, outcome: "redaction_blocked" }), ctx)).toEqual({
      ok: false, text: "✕ withheld: it couldn't be checked for personal data",
    })
    expect(words(call({ ok: false, outcome: "error" }))).toBe("✕ failed: the tool couldn't finish")
    expect(words(call({ ok: false, outcome: "brand_new" }))).toBe("✕ brand_new")
  })

  it("305-REVIEW WR-04: a call the tool answered with an error (not available) never ticks", () => {
    // The client was told the call failed (isError), so the owner's row must not read answered.
    expect(callWords(call({ ok: false, outcome: "not_available" }), ctx)).toEqual({
      ok: false, text: "✕ not available: nothing this key can read there",
    })
    expect(callDetailLine(call({ tool: "read_document", ok: false, outcome: "not_available" }), ctx, NOW))
      .toBe("10:42 · read_document · ✕ not available: nothing this key can read there")
  })

  it("over the limit names the bucket and the figure: detail first, then the list's limits", () => {
    const over = (reason: string, detail: Record<string, unknown> | null = null) =>
      call({ ok: false, outcome: "refused", reason, detail })
    expect(words(over("rate_limited:expensive", { limit: 30 }))).toBe("✕ refused: over the limit: 30 searches a minute")
    expect(words(over("rate_limited:expensive"))).toBe("✕ refused: over the limit: 30 searches a minute")
    expect(words(over("rate_limited:read", { limit: 7 }))).toBe("✕ refused: over the limit: 7 reads a minute")
    expect(words(over("rate_limited:read"))).toBe("✕ refused: over the limit: 120 reads a minute")
    expect(words(over("rate_limited:expensive"), { key: KEY, now: NOW })).toBe("✕ refused: over the limit")
  })

  it("not granted names the tool, or says that tool", () => {
    expect(words(call({ ok: false, outcome: "refused", reason: "tool_not_granted" }))).toBe(
      "✕ refused: this key isn't allowed to use search_knowledge_base",
    )
    expect(words(call({ ok: false, outcome: "refused", reason: "tool_not_granted", tool: null }))).toBe(
      "✕ refused: this key isn't allowed to use that tool",
    )
  })

  it("the 293/304 reasons keep their shipped words on an MCP key", () => {
    const refused = (reason: string) => call({ ok: false, outcome: null, reason, tool: null })
    expect(words(refused("mcp_off_org"))).toBe("✕ refused: MCP access is switched off for this organisation")
    expect(words(refused("limiter_unavailable"))).toBe(
      "✕ refused: the limit check was unavailable; try again shortly",
    )
    expect(words(refused("revoked"))).toMatch(/^✕ refused: key revoked on /)
    expect(words(refused("something_else"))).toBe("✕ refused: something_else")
    expect(mcpCallWords(refused("mcp_off_org"), ctx)).toBeNull()
  })

  it("a workflow key's words are untouched (no delegation without kind mcp)", () => {
    const wf = { key: makeKey(), now: NOW }
    expect(callWords(call({ verb: "read", outcome: "ok" }), wf).text).toBe("✓ ok")
    expect(callWords(call({ verb: "read", outcome: null }), wf).text).toBe("✓ read")
  })

  it("the detail line is time · tool · result", () => {
    expect(callDetailLine(call(), ctx, NOW)).toBe("10:42 · search_knowledge_base · ✓ answered")
    expect(callDetailLine(call({ ok: false, outcome: "refused", reason: "rate_limited:expensive", detail: { limit: 30 } }), ctx, NOW))
      .toBe("10:42 · search_knowledge_base · ✕ refused: over the limit: 30 searches a minute")
    expect(callDetailLine(call({ tool: null, ok: false, outcome: null, reason: "mcp_off_org" }), ctx, NOW))
      .toBe("10:42 · — · ✕ refused: MCP access is switched off for this organisation")
  })

  it("imports no React", () => {
    expect(mcpCallWordsRaw).not.toMatch(/from "react"/)
  })
})
