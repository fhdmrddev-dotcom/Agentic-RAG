---
phase: 174-run-state-lifecycle-honesty
reviewed: 2026-07-22T19:40:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - frontend/src/lib/toolMeta.ts
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/lib/dedupMessages.ts
  - frontend/src/types/index.ts
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
status: clean
---

# Phase 174: Code Review Report

**Reviewed:** 2026-07-22T19:40:00Z
**Depth:** deep (cross-file: catch-branch siblings, dedup adjacency, call-site derivation, isStreaming source, all `outerBannerLabel` callers)
**Files Reviewed:** 5 production files (125 insertions / 3 deletions)
**Status:** clean

## Summary

All five phase-specific correctness concerns were traced end-to-end against live source. The change is genuinely additive at the render/derive seam and holds every invariant the plan-checker and the SPEC demanded. No BLOCKER, HIGH, or MEDIUM defect was found. Four LOW/INFO quality notes follow.

**Verification of the flagged risk areas (all PASS):**

1. **Dedup adjacency (`dedupMessages.ts`) — the plan-checker's original blocker: RESOLVED.** The same-send collapse can NOT erase a STATE-01b amber `blockedNotice` row or a `runStatus:'failed'` placeholder. The dropped row is *always* the current `msg`, and it is only ever dropped inside `if (isCollapsiblePreRunPlaceholder(msg))`, whose predicate excludes both `blockedNotice` and `runStatus === "failed"`. A blockedNotice/failed row therefore (a) can never be the dropped `msg`, and (b) when it is the `prev` of a following collapsible placeholder, `isCollapsiblePreRunPlaceholder(prev)` is false → the following placeholder is kept. I hand-traced 3+ adjacent placeholders (collapse to first), interleaved user rows (no collapse — the "different send" barrier), a blockedNotice row as the first of an adjacent pair, and both orderings of `[amber, placeholder]` / `[placeholder, amber]`: in every case the amber/failed row and any legitimately-distinct placeholder survive. The double-mount always appends the original `assistantId` placeholder first (line 1784) and any race-inserted twin later, so the collapse keeps the row that subsequently receives the `runId + startedAt` stamp (line 1856-1878) — self-consistent.

2. **403 catch branch (`StreamsProvider.tsx`) — D-05 scope guard: HELD.** The diff is purely additive (`git` range confirms 0 deletions in the 409 / generic-400 / network branches). The new `else if (err instanceof ApiError && err.status === 403)` is correctly ordered *after* the 409 branch and *before* the generic `ApiError` branch, so 400/409/network stay byte-identical. `err.message` renders as React text children (`<span>{message.blockedNotice.message}</span>`), never `dangerouslySetInnerHTML` — XSS-safe. `clearWorkflowLockForThread(threadId)` uses the owning-thread closure (per-thread `workflowLockByThread`), so a parallel Thread B is untouched. The composer is not left stuck (lock cleared; `streamingThreads` cleared in `finally`).

3. **STATE-03 (`toolMeta.ts` + `MessageItem.tsx`) — D-14 byte-identical: HELD.** The default path (`reasoningActive = false`) returns the identical strings; the only other source caller, `RunCard.tsx:343`, passes three positional args so it inherits both defaults (`isHarness=false`, `reasoningActive=false`) and is unchanged. The derive `!message.content && !!message.reasoningContent` cannot false-fire on Anthropic/Google (they never populate `reasoningContent`), and cannot get stuck after content starts: the enclosing branch (`MessageItem.tsx:635`, the `else` of `message.content ? …`) only renders while `!message.content`, and the derive additionally re-checks `!message.content`.

4. **STATE-04 `startedAt` (`StreamsProvider.tsx`):** additive stamp alongside `runId/model/provider`, typed as ISO string to match the pre-existing `Message.startedAt?: string` (types/index.ts:179 — the field already existed from Phase 095.1; only `blockedNotice` is a new type field). RunCard's `startedAt ?? created_at` consumer is unedited; the timer machinery (`runStartMs`/`frozenEndRef`) is not perturbed.

## Info

### IN-01: 403-blocked assistant placeholder retains `runStatus: "streaming"`

**File:** `frontend/src/providers/StreamsProvider.tsx:2092-2095`
**Issue:** The 403 branch stamps `blockedNotice` but leaves the placeholder's `runStatus` at its kickoff value `"streaming"` (set at line 1782). The row is actually terminal (blocked, no run will ever exist). This has **no observable impact today**: `isStreaming` is derived from `streamingThreads.has(threadId)` (via `useStreamingForThread`, StreamsProvider.tsx:3256) — which the `finally` block clears — not from `message.runStatus`; the terminal-indicator render (MessageItem.tsx:694) keys on `stopped`/`timed_out`/`cancelled`, not `streaming`; and `stopStream`/`stopThread` bail because the row carries no `runId`. So the row renders cleanly as amber-block + avatar. It is flagged only as an internal state-honesty inconsistency in a phase whose whole thesis is honest run-state.
**Fix:** Optional — for internal cleanliness, set a terminal-ish value in the same map, e.g. `{ ...m, blockedNotice: { message: err.message }, runStatus: "failed" }`. Note this would require re-verifying the dedup regression (a `failed` row is already excluded from collapse, so the invariant still holds), and is strictly a tidiness change, not a fix for any observed defect.

### IN-02: `startedAt` stamp shifts the Deep live-timer baseline by ~one RTT (intended, self-correcting)

**File:** `frontend/src/providers/StreamsProvider.tsx:1875`
**Issue:** The stamp applies to every send (Deep and workflow), so a Deep run's *live* RunCard timer now anchors to `startedAt` (client time *after* the kickoff POST returns) instead of the previous `created_at` (client time when the optimistic placeholder was inserted at line 1779). The gap is the `postMessage` round-trip (~50-200 ms locally), so the live Deep timer shows marginally less elapsed than before. It is self-correcting: on the next hydrate the persisted `runs.started_at` enrich (`api.ts started_at→startedAt`) overwrites the client anchor with the authoritative server start. This is not a D-14 fork (additive render field, applied uniformly, no shared-path change) — noting it only because it does touch the Deep-mode *live render*, and `startedAt` (nearer the true server run-start) is arguably more accurate than `created_at`.
**Fix:** None required. If strict Deep live-timer parity were ever asserted by a pixel/snapshot test, gate the stamp on `opts?.workflowDefinitionId`; the current uniform stamp is simpler and correct.

### IN-03: 403 path does not stash the blocked send's draft for composer recovery

**File:** `frontend/src/providers/StreamsProvider.tsx:2092-2101`
**Issue:** The generic-400 branch stashes `failedSendDrafts` so the composer can re-prefill the typed prompt; the 403 branch does not. Per D-04 this is deliberate — the 403 keeps the *user bubble* visible in-chat instead of rolling it back into an editable draft. Consequence: on a full cold reload the blocked (never-persisted) user + amber bubbles disappear and the text is unrecoverable. Because the block is an administrator kill-switch, an immediate re-send would 403 again, so the missing recovery affordance is low value.
**Fix:** None required (intended per D-04). If desired, additionally call `failedSendDrafts.set(threadId, content)` in the 403 branch so the prompt survives a reload — purely a UX nicety.

### IN-04: Defensive `clearWorkflowLockForThread` could clear a still-valid prior lock in a rare mid-run kill-switch-toggle edge

**File:** `frontend/src/providers/StreamsProvider.tsx:2101`
**Issue:** The lock-clear is documented as a common-case no-op (the kickoff lock is only seeded *after* `run_id`, which a 403 never reaches). The only way it clears a *live* lock is: a prior workflow run on the same thread is active (thread locked) AND a new send somehow reaches a 403. In practice a locked thread's new send is refused at 409 (workflow-lock) before it can reach the 403 kill-switch path, and a real terminal `onTerminal` re-clears the lock regardless, so this is not reachable with current server ordering. Flagged only as a latent assumption (matches RESEARCH A25 acknowledgement) should the 403/409 precedence ever change server-side.
**Fix:** None required. If the ordering assumption is ever weakened, gate the clear on "no active run for this thread" before clearing.

---

## Structural Findings (fallow)

No `<structural_findings>` block was provided with this review; none to reconcile.

---

_Reviewed: 2026-07-22T19:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
