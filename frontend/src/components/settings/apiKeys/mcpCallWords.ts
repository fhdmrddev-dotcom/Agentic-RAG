/**
 * Phase 305-03 (KEY-07; D-53 / Pitfall 7; UI-SPEC §Surface 3) — what one AI tool key's call reads as.
 *
 * `apiKeyFacts.callWords` / `callDetailLine` delegate here for an MCP key (one early return each).
 * PURE: no React, no fetch. A sibling of `mcpKeyFacts.ts` rather than part of it, because that module
 * is copy-free by contract (304-05, fenced by its own test) and this one exists to spell words.
 *
 * ONE reason vocabulary, shared with the backend (`app/mcp/audit.py`, `app/mcp/limits.py`):
 *   refused   `rate_limited:read` · `rate_limited:expensive` · `tool_not_granted`
 *             · `limiter_unavailable` · `maintenance` (the last two keep their shipped words)
 *   answered  outcome `ok` · `error` · `redaction_blocked`
 *
 * ⚠ A call that was not answered NEVER reads with a tick: an unknown outcome shows its raw code
 *   (the 293 rule). `null` means "not an MCP-specific case — use the shipped 293/304 words".
 */
import type { ApiKeyCall } from "@/lib/api/apiKeys"
import { API_KEYS_COPY, fillCopy } from "./apiKeysCopy"
import type { CallContext } from "./apiKeyFacts"
import { MCP_KEY_COPY } from "./mcpKeyCopy"

const C = API_KEYS_COPY
const M = MCP_KEY_COPY

function limitFigure(call: ApiKeyCall, fromList: number | undefined): number | null {
  const v = call.detail?.limit
  if (typeof v === "number" && Number.isFinite(v)) return v
  return typeof fromList === "number" ? fromList : null
}

function refusalWords(call: ApiKeyCall, ctx: CallContext): string | null {
  const reason = call.reason ?? ""
  if (reason === "tool_not_granted") {
    return call.tool ? fillCopy(M.calls.notGranted, { tool: call.tool }) : M.calls.notGrantedBare
  }
  if (reason.startsWith("rate_limited:")) {
    const searches = reason === "rate_limited:expensive"
    const N = limitFigure(call, searches ? ctx.limits?.searches_per_minute : ctx.limits?.reads_per_minute)
    if (N === null) return C.calls.overBare
    return fillCopy(searches ? M.calls.overSearches : C.calls.overReads, { N })
  }
  return null
}

/** The result words of an MCP call, or `null` to fall through to the shipped 293/304 words. */
export function mcpCallWords(call: ApiKeyCall, ctx: CallContext): { ok: boolean; text: string } | null {
  if (call.ok) return { ok: true, text: fillCopy(C.calls.ok, { words: M.calls.answered }) }
  if (call.outcome === "redaction_blocked") return { ok: false, text: M.calls.withheld }
  if (call.outcome === "error") return { ok: false, text: M.calls.failed }
  const refused = refusalWords(call, ctx)
  if (refused !== null) return { ok: false, text: fillCopy(C.calls.refused, { words: refused }) }
  if (call.reason) return null // a 293/304 reason: the shipped words
  if (call.outcome && call.outcome !== "refused" && call.outcome !== "limited") {
    return { ok: false, text: fillCopy(M.calls.unknownOutcome, { outcome: call.outcome }) }
  }
  return call.outcome === "limited"
    ? { ok: false, text: fillCopy(C.calls.refused, { words: C.calls.overBare }) }
    : null
}

/** The tapped bar's one line, and each bar's accessible name: `{time} · {tool or —} · {result}`. */
export function mcpCallDetailLine(call: ApiKeyCall, time: string, words: string): string {
  return [time, call.tool ?? M.activity.noTool, words].join(C.activity.separator)
}
