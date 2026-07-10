/**
 * BUG-260626-01 (+ its siblings) — collapse same-runId duplicate assistant
 * messages before any consumer reads the chat bucket.
 *
 * In the live / just-completed window of a multi-run thread the chat bucket can
 * transiently hold TWO assistant messages with the same `runId`: the
 * in-place-completed `temp-…` placeholder AND the persisted/reconciled row.
 * Every consumer that walks the raw bucket then double-counts that run:
 *   - MessageList keys assistant rows `run-${runId}` → React duplicates/omits
 *     subtrees (duplicated GENERATED FILES panels, source-doc bleed).
 *   - useDerivedPanel flat-maps `tool_calls` across all bucket messages →
 *     `dedupToolCalls` can't merge the temp copy (carries `clientKey`) with the
 *     persisted copy (DB-reconstructed, no `clientKey`) → the "DERIVED FROM
 *     ACTIVITY" todos render each step twice.
 *
 * Deduping at the bucket-read seam fixes BOTH (and any future consumer) from one
 * place. This is the SHARED home for the dedup that originally lived inline in
 * MessageList.tsx.
 *
 * Semantics (order-preserving):
 *   - assistant message WITH a runId → keyed by runId; the FIRST occurrence is
 *     kept, but a kept `temp-…` row is REPLACED by its persisted twin when the
 *     twin arrives (so the swap stays remount-free for MessageList's key).
 *   - everything else (user rows, assistant rows without a runId such as harness
 *     answers) passes through untouched.
 *
 * Pure logic — no React, no hooks. Importable from component and store code.
 */
import type { Message } from "@/types"

export function dedupMessagesByRunId(messages: Message[]): Message[] {
  const result: Message[] = []
  const runIdToIndex = new Map<string, number>()
  for (const msg of messages) {
    const runKey = msg.role === "assistant" && msg.runId ? msg.runId : null
    if (!runKey) {
      result.push(msg)
      continue
    }
    const existingIdx = runIdToIndex.get(runKey)
    if (existingIdx === undefined) {
      runIdToIndex.set(runKey, result.length)
      result.push(msg)
    } else {
      const existing = result[existingIdx]
      const existingIsTemp = typeof existing.id === "string" && existing.id.startsWith("temp-")
      const incomingIsTemp = typeof msg.id === "string" && msg.id.startsWith("temp-")
      // Replace a kept temp with its persisted twin; otherwise keep the first.
      if (existingIsTemp && !incomingIsTemp) result[existingIdx] = msg
    }
  }
  return result
}
