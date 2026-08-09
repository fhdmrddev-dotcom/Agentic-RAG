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

/**
 * Phase 174-04 (STATE-04 / D-12): a "collapsible pre-runId placeholder" is the
 * EMPTY optimistic assistant row a `sendMessage` inserts before the kickoff POST
 * stamps a runId (StreamsProvider.tsx:1772/:1856). The mount / first-SSE race can
 * leave TWO of these for the SAME send in the bucket at once → two avatars
 * (BUG-260610-01, reproduces on fast OpenAI = a race, not latency).
 *
 * The predicate is deliberately NARROW so the same-send twin is the ONLY thing
 * that ever collapses:
 *   - assistant role, NO runId (still in the pre-runId window)
 *   - a `temp-` id (a genuine optimistic placeholder — a persisted harness answer
 *     without a runId carries a REAL id and is therefore NEVER collapsible)
 *   - EMPTY content (a mount placeholder, not an answer)
 *   - NOT a STATE-01b amber row (`blockedNotice`) and NOT a failed-send row
 *     (`runStatus === "failed"`) — both are PERMANENT temp/no-runId assistant rows
 *     (174-03 / the network-catch) that MUST survive a later send's placeholder.
 * A collapse fires only when TWO such rows are ADJACENT in the kept output (no
 * intervening user row — a genuinely different send always inserts a user row
 * between its placeholders), and both sides pass the predicate. This is never a
 * blind "any two temp rows" rule.
 */
function isCollapsiblePreRunPlaceholder(m: Message): boolean {
  return (
    m.role === "assistant" &&
    !m.runId &&
    typeof m.id === "string" &&
    m.id.startsWith("temp-") &&
    !m.content &&
    !m.blockedNotice &&
    m.runStatus !== "failed"
  )
}

export function dedupMessagesByRunId(messages: Message[]): Message[] {
  const result: Message[] = []
  const runIdToIndex = new Map<string, number>()
  for (const msg of messages) {
    const runKey = msg.role === "assistant" && msg.runId ? msg.runId : null
    if (!runKey) {
      // STATE-04 (D-12): collapse ONLY the same-send pre-runId double-mount twin —
      // an EMPTY temp/no-runId assistant placeholder immediately following ANOTHER
      // one in the kept output (adjacent, no intervening user row). Keep the FIRST
      // (the original placeholder inserted at send-time, which later receives the
      // runId + startedAt stamp), drop the adjacent duplicate. Everything else
      // (amber/failed rows, harness answers, user rows, lone placeholders) passes
      // through untouched.
      if (isCollapsiblePreRunPlaceholder(msg)) {
        const prev = result[result.length - 1]
        if (prev && isCollapsiblePreRunPlaceholder(prev)) continue
      }
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
