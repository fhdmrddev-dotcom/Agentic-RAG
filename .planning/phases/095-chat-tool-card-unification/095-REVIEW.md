---
phase: 095-chat-tool-card-unification
reviewed: 2026-06-05T20:27:39Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - backend/app/services/agent_loop.py
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/components/chat/MessageList.tsx
  - frontend/src/components/chat/OutputFileCard.tsx
  - frontend/src/components/chat/RunCard.tsx
  - frontend/src/components/chat/RunStatusStrip.tsx
  - frontend/src/components/chat/ToolCallPanel.tsx
  - frontend/src/hooks/useFollowScroll.ts
  - frontend/src/lib/api.ts
  - frontend/src/lib/fileIcon.tsx
  - frontend/src/lib/stepCount.ts
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/types/index.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 095: Code Review Report

**Reviewed:** 2026-06-05T20:27:39Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 095 ("chat tool-card unification") is a careful, largely additive UI-consolidation pass over the chat run surface: a single per-extension `fileIcon` module, a single `unifiedStepCount`/`dedupToolCalls` source, a never-vanishes `RunStatusStrip`, a follow-but-release scroll hook, a hero/working output-files split, the D-05 sub-agent dual-render root fix, and a D-08 backend hero tag.

**The two highest-risk surfaces are clean.** The shared streaming/SSE path holds: `agent_loop.py`'s `final_output_files` emit and the `_mapMessageResponse` reload path add only an additive `is_hero` key with the event name and existing fields untouched — older frontends ignore it, so there is no cross-provider break. `StreamsProvider.tsx`'s sub-agent reducers were rewritten to stamp onto the owning `tool_call` but stay scoped to `assistantId` (no global flag, no cross-thread write) and never touch `m.content`. **XSS is clean**: `fileIcon`, the OutputFileCard hero render, and `RunStatusStrip` all render model/sandbox-derived strings (filename, activity verb) as React text children — no `dangerouslySetInnerHTML`, no `innerHTML`, no markup interpolation; the filename only ever surfaces as a parsed extension label. **D-08 is presentation-only as required**: `is_hero` is never passed to `downloadSandboxOutput` (which takes only `relativeUrl` + `filename`), so it cannot reach the owner-fenced re-sign download path.

Three behavioral warnings remain, all on correctness rather than security: (1) the new RunCard timer shows an inflated elapsed for reloaded terminal runs; (2) the persisted-vs-live hero set can disagree across multi-cell runs, producing multiple heroes on reopen where the live render showed one; (3) the `onSubAgentStart` fallback can collide with a later real `tool_start`. Info items cover the floating-chip elapsed not ticking, a minor defensive-access inconsistency, and a dead `nodeStateOf` branch.

## Warnings

### WR-01: RunCard timer shows inflated elapsed on reloaded terminal runs

**File:** `frontend/src/components/chat/RunCard.tsx:105-145`
**Issue:** The D-06 timer rewrite derives `elapsedMs = (frozenEndRef.current ?? now) - startMs` where `startMs = Date.parse(message.created_at)`. For a **reloaded terminal run**, `isStreamingNow` is false on first render, so the freeze branch sets `frozenEndRef.current = Date.now()` (the page-load instant, today) while `startMs` is the original run-start (`created_at`, possibly days ago). The rendered label therefore becomes "time from run-start until page-load" — e.g. `1440m 0s` for a chat reopened the next day — instead of the run's actual duration. The old `performance.now()` impl avoided this by simply not showing a timer on reload (the `elapsedMs > 0` gate was false). The RunCard comment claims the change "survives next-day reopen" and reinforces 083 — true for `stepCount`, but the *timer* regresses on reload because the `Message` type carries no persisted run-end/duration timestamp to clamp the freeze to (confirmed: `types/index.ts` has `created_at` only; no `finished_at`/duration on `Message`).
**Fix:** Gate the header/collapsed-row elapsed to live runs (or to the same-session terminal edge) until a persisted run duration exists:
```ts
// Only render an elapsed label when the value reflects THIS session's run.
// frozenEndRef is only trustworthy if it was captured during a live stream
// in this session — track that, or hide elapsed on cold-loaded terminals.
const elapsedIsTrustworthy = isStreamingNow || capturedDuringThisSession.current
const elapsedLabel = elapsedIsTrustworthy ? formatElapsed(elapsedMs) : null
// ...and render the RunStatusStrip/elapsed spans only when elapsedLabel != null.
```
Alternatively, persist a run duration (ms) onto the message and compute `elapsedMs = frozenDurationMs` on reload, falling back to the live derivation only while streaming.

### WR-02: Persisted hero set can diverge from the live final hero across multi-cell runs

**File:** `backend/app/services/agent_loop.py:2060-2092`
**Issue:** The persisted `is_hero` flag is recomputed **per execute_code cell**: `_select_hero_filenames` runs over the cumulative `_previous_files_in_run.values()` *at that cell's point in time*, but is then applied to `_r.get("output_files", [])`, which is the **per-cell delta** (`tool_dispatcher.py:711` sets `output_file_list = delta_files`). In a run where file sizes grow across cells (cell 1 produces a small file that is "largest so far" → hero=True in its persisted record; cell 3 produces the real, larger deliverable → also hero=True in its record), `_mapMessageResponse` aggregates output_files across all execute_code tool_calls on reload and surfaces **multiple `is_hero=True` files**. The live `final_output_files` emit (lines 2119-2145) computes the hero set **once** over the full cumulative set and picks exactly one. Result: a reopened chat can show several "★ Your file" heroes where the live render showed one. Not a security or data-loss issue (re-rank/never-hide keeps every file downloadable), but it breaks the D-08 "single hero" contract on reload.
**Fix:** Compute the hero set once over the cumulative set and apply it consistently. Either stamp `is_hero` at emit time only and reconstruct the reload hero from the aggregated set in `_mapMessageResponse`, or, if per-cell persistence is required, clear stale hero flags so only the final cumulative hero survives reload:
```python
# In _mapMessageResponse (api.ts) OR at persist: re-derive the hero over the
# AGGREGATED output_files, not per-cell, so exactly one (the final largest)
# carries is_hero on reload — matching the live final_output_files emit.
```

### WR-03: `onSubAgentStart` fallback owner can collide with a later real `tool_start`

**File:** `frontend/src/providers/StreamsProvider.tsx:520-560`
**Issue:** When `sub_agent_start` arrives before `tool_start` (noted as "some provider ordering"), the fallback creates a synthetic `analyze_document` owner entry with `status: "running"` and `iteration: currentIteration`. If the real `tool_start` for the same `analyze_document` + same iteration then arrives, `onToolStart`'s idempotency guard (`StreamsProvider.tsx:430-432`) matches on `name === name && iteration === currentIteration && (status running|done)` — it finds the synthetic entry and **no-ops**, so the real tool's `args` are never attached to the owner row. The sub_agent body still renders (it lives on the synthetic entry), but the tool's args/result wiring for that row is dropped. Low probability (requires the out-of-order provider path) and the user-visible sub-agent content is preserved, but the owner row is left arg-less.
**Fix:** When the fallback creates the synthetic owner, mark it so `onToolStart` can adopt (merge args into) it rather than no-op, e.g. tag `id`/a flag the idempotency guard recognizes and updates in place instead of skipping:
```ts
// onToolStart: if the matched entry is a sub_agent-seeded placeholder,
// MERGE the real args/id into it instead of treating it as already-finalized.
const placeholderIdx = existingCalls.findIndex(
  (tc) => tc.name === name && tc.iteration === currentIteration &&
          tc.status === "running" && tc.sub_agent && tc.id?.startsWith("running-"),
)
if (placeholderIdx !== -1) { /* merge args+real id, keep clientKey + sub_agent */ }
```

## Info

### IN-01: Floating "Jump to live" chip elapsed does not tick between tokens

**File:** `frontend/src/components/chat/MessageList.tsx:30-47, 232-250`
**Issue:** `formatFloatingElapsed` calls `Date.now()` at render time, but the chip only re-renders when `messages` changes (per token). During a token-quiet stretch (a slow provider, a long tool call with no deltas), the chip's elapsed freezes until the next token arrives, so it can momentarily disagree with the header strip (which ticks on its own 250ms interval). Cosmetic; the header strip remains the authoritative timer.
**Fix:** If exact parity is desired, drive the chip from the same interval (lift a shared `now` or pass the header's `elapsedLabel` down). Otherwise document that the chip elapsed is best-effort.

### IN-02: Inconsistent defensive access in `_select_hero_filenames`

**File:** `backend/app/services/agent_loop.py:826-852`
**Issue:** The agent-declaration branch guards filename with `f.get("filename")`, but the requested-ext and fallback branches index `f["filename"]` directly. The harvest projection (`sandbox_service.py:299-304`) always populates `filename`, so a `KeyError` is not reachable today, but the mixed style invites a future regression if the meta shape ever changes upstream.
**Fix:** Use `f.get("filename")` consistently and skip dicts without a filename in the ext/fallback branches (e.g. `if f.get("filename")` guards), mirroring the declaration branch.

### IN-03: `nodeStateOf` queued branch is unreachable for the actual `ToolCall.status` union

**File:** `frontend/src/components/chat/ToolCallPanel.tsx:429-433`
**Issue:** `ToolCall.status` is `"running" | "done" | "interrupted" | "preparing"` (`types/index.ts:38`). `nodeStateOf` maps running/preparing→active and done/interrupted→done, so the `return "queued"` fallback is dead for the real type (the `"failed"` value exists only on `StatusPill.ToolStatus`, a separate type). Harmless defensive code, but worth a one-line note so a future reader doesn't expect a queued rail node to appear, and so a genuinely failed tool isn't silently rendered as a dim "queued" node if the unions ever converge.
**Fix:** Either drop the dead branch with a comment, or — if `ToolCall.status` ever gains `"failed"` — add an explicit error node state rather than falling through to `queued` (a failed step should not look pending).

---

_Reviewed: 2026-06-05T20:27:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
