/**
 * Phase 194.1 Plan 06 (RUN-01 / R4 / D-15) — THE elapsed formatter, hoisted rather
 * than copied a fourth time.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS MODULE EXISTS AT ALL
 * ─────────────────────────────────────────────────────────────────────────────
 * This tree already carried THREE elapsed formatters before this plan —
 * `RunCard.tsx`'s `formatElapsed`, `MessageList.tsx`'s `formatFloatingElapsed`,
 * and `WorkflowRunPage.tsx`'s `fmtElapsed` — and `ActiveRunsTray` consumes a
 * fourth reading through one of them. `194.1-RESEARCH.md`'s *Don't Hand-Roll*
 * table names a fourth as the thing NOT to write. So the run line built by this
 * plan takes the shipped one by MOVING it, not by re-deriving it.
 *
 * ⚠ THE BODY BELOW IS BYTE-IDENTICAL TO `WorkflowRunPage.tsx:195-201` AS IT
 * SHIPPED at `f9e55b6db33606fca77ee84ce8ef3da3153d09e2`. It was captured with
 * `git show <sha>:frontend/src/pages/WorkflowRunPage.tsx | sed -n 195,201p | od -c`
 * — i.e. READ out of the tree, never re-typed — and
 * `lib/__tests__/runStepCount.test.ts` asserts that byte-identity against the
 * same captured constant, so a later "tidy" of any of the three branches has to
 * argue with a test rather than with this comment.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DOCBLOCK THE FUNCTION CARRIED AT ITS OLD HOME — MOVED VERBATIM, WITH ITS
 * ONE NOW-FALSE SENTENCE MARKED RATHER THAN DELETED
 * ─────────────────────────────────────────────────────────────────────────────
 * `< 60s → 12s` · `< 60m → 4m 12s` · else `1h 06m`. NO date library is added for
 * one label, and none is wanted: the three branches below are the entire contract.
 *
 * ⚠ SUPERSEDED (194.1-06). The original opened:
 *
 *     "A local formatter sited next to its one consumer, in the house shape the
 *      panel's own file list uses for its byte figure"
 *
 * That sentence was TRUE when it was written and is FALSE as of this move: the
 * formatter now has two consumers (`WorkflowRunPage.tsx` and
 * `components/chat/ThreadRunLine.tsx`) and is no longer local to either. It is
 * quoted rather than deleted because a deleted sentence is exactly as invisible
 * as one that was never written (the 193.2 WR-05 lesson), and because the reason
 * it stopped being true — a SECOND consumer — is the whole justification for the
 * module.
 *
 * ⚠ The second half of the old docblock (the ⚠ about naming the panel component by
 * ROLE rather than by identifier) did NOT move with the function. It is a fence
 * about `WorkflowRunPage.tsx`'s import list, not about this formatter, and it stays
 * where the thing it guards is.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE MAY NEVER GROW INTO
 * ─────────────────────────────────────────────────────────────────────────────
 * It takes a DURATION IN MILLISECONDS and nothing else. It does not parse, it does
 * not know what its two anchors are, and it must never learn: `WorkflowRunPage`
 * anchors on `claimed_at ?? created_at` while the chat run line anchors on
 * `last_run_created_at`, and a formatter that knew which would be a second home
 * for a decision that belongs to each caller (`WorkflowRunPage.tsx:758-791` and
 * `ThreadRunLine.tsx` each state their own anchor, and each DISCLOSES it in words
 * beside the number).
 *
 * Pure logic — no React, no hooks, no JSX, and ZERO imports. That is what makes an
 * ESM cycle impossible by construction, mirroring `lib/phaseState.ts` and
 * `lib/stepCount.ts`.
 */
export function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${minutes}m ${String(total % 60).padStart(2, "0")}s`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`
}
