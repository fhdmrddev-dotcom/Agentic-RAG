/**
 * Phase 095 Plan 01 Task 1 — the D-04 single source of truth for the
 * step count, plus the shared dedup it is built on.
 *
 * `unifiedStepCount(message)` is the ONE integer behind every consumer that
 * reports "how many steps did the agent take":
 *   - RunCard's "Step N" label   (today: iterationCount + 1 — RunCard.tsx:132-135)
 *   - the collapsed-row "N steps" (today: raw tool_calls.length — RunCard.tsx:232-234)
 *   - the RunCard header "Run · N tools" (today: raw length — RunCard.tsx:129)
 *   - the honest status strip "Step N"
 *   - the unified status-node rail node count
 * In later plans (02/03/05) every one of those switches to `unifiedStepCount`
 * so they can never disagree (the D-04/D-05 honesty fix per SKETCH-CONSISTENCY §4).
 *
 * `dedupToolCalls()` is the EXACT dedup ToolCallPanel uses today
 * (ToolCallPanel.tsx:321-334), extracted VERBATIM into one shared helper so the
 * panel count and the headline count use byte-identical dedup (no drift). In
 * Plan 03, ToolCallPanel imports this instead of keeping its inline memoised
 * copy — the one dedup home.
 *
 * Why this also fixes the "Step N vanishes on next-day reopen" bug for free
 * (RESEARCH correction #5): the count derives from the DEDUPED `tool_calls.length`,
 * which IS persisted to the DB, unlike `iterationCount` which `_mapMessageResponse`
 * omits. A reopened chat keeps its honest step count instead of dropping to a
 * stale/empty value.
 *
 * Why deduped count, not iteration count (cross-provider safety): the deduped
 * tool count is provider-agnostic. `iterationCount` diverges across providers
 * because `iteration_start` SSE semantics differ — counting deduped tools
 * removes that divergence entirely (095-RESEARCH §"D-04").
 *
 * Pure logic — no React, no hooks. This module is deliberately importable from
 * non-component code.
 */
import type { ToolCall } from "@/types"

/**
 * Dedup a tool-call list, preserving first-occurrence ordering.
 *
 * Byte-identical to the canonical ToolCallPanel.tsx:321-334 derivation: a
 * `Set<string>` of seen keys, first occurrence pushed, duplicates dropped.
 * Key expression (same fallback chain): `tc.clientKey ?? tc.id ?? composite`,
 * where the composite is `${tc.name}-${tc.startedAt ?? ''}-${idx}`.
 *
 * The composite fallback exists only for the migration window — DB-loaded
 * historical messages and in-flight test fixtures lack a `clientKey` stamp.
 * Live-SSE tool calls always carry `clientKey`.
 *
 * @param toolCalls the raw tool-call list (may be undefined/null)
 * @returns the deduped list, first occurrence preserved (never null)
 */
export function dedupToolCalls(
  toolCalls: ToolCall[] | undefined | null,
): ToolCall[] {
  const seen = new Set<string>()
  const result: ToolCall[] = []
  ;(toolCalls ?? []).forEach((tc, idx) => {
    // REMOVE after migration window: composite fallback for tools without a
    // clientKey stamp (DB-loaded historical messages, in-flight test fixtures).
    // New live-SSE tools always have clientKey.
    const key = tc.clientKey ?? tc.id ?? `${tc.name}-${tc.startedAt ?? ""}-${idx}`
    if (seen.has(key)) return
    seen.add(key)
    result.push(tc)
  })
  return result
}

/**
 * The single D-04 step count: the number of DEDUPED tool calls on a message.
 *
 * Ignores `iterationCount` entirely (a message with N deduped tools spread
 * across M iterations returns N, not M) — the cross-provider-safe count.
 *
 * @param message any Message-shaped object that carries `tool_calls`
 * @returns the deduped tool count (0 when there are none)
 */
export function unifiedStepCount(message: {
  tool_calls?: ToolCall[] | null
}): number {
  return dedupToolCalls(message.tool_calls ?? undefined).length
}
