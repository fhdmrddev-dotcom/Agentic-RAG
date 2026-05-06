---
phase: 066-adaptive-run-timeouts-lifecycle-states
plan: 03-frontend-lifecycle-ui
subsystem: frontend/lifecycle-ui, sse-parser, message-rendering
tags: [phase-066, lifecycle, timeouts, frontend, sse-wire, message-item]
status: complete
dependency_graph:
  requires:
    - "Plan 01 backend split (commits 9d967af + 68e1897): runs.status 5-value CHECK live, MessageResponse Pydantic Literal extended, threads.py TERMINAL_TYPES + _RUN_STATUS_TO_TERMINAL_TYPE extended, TimeoutError → status='timed_out'"
    - "frontend/src/types/index.ts existing Message type with runStatus 4-value union (Phase 063)"
    - "frontend/src/lib/api.ts existing subscribeToRun parser + StreamCallbacks.onTerminal 3-kind union"
    - "frontend/src/hooks/useMessages.ts existing 2 onTerminal override callsites (sendMessage + reconcile, Phase 063.1)"
    - "frontend/src/components/chat/MessageItem.tsx existing Resume button (failed-only) + 'Response stopped' banner (cancelled-only)"
  provides:
    - "Message.runStatus 5-value union including 'timed_out'"
    - "api.ts getMessages mapper accepts run_status='timed_out' from backend"
    - "StreamCallbacks.onTerminal 4-kind union (done | error | cancelled | timed_out)"
    - "subscribeToRun parser dispatches t === 'timed_out' SSE events to onTerminal('timed_out')"
    - "useMessages.ts onTerminal overrides handle 'timed_out' kind in BOTH sendMessage and reconcile callsites"
    - "MessageItem.tsx Resume button gates on (failed || timed_out) per D-066-09"
    - "MessageItem.tsx banner copy switches on runStatus: timed_out → 'Agent reached time limit', cancelled/stopped → 'Response stopped' (D-066-10)"
    - "MessageItem.tsx secondary post-content stopped indicator also keys on runStatus === 'timed_out' (Rule-2 deviation — prevents contradictory banners)"
  affects:
    - "Phase 066 Plan 04 (integration tests will assert frontend wire-format match — backend emits {type:'timed_out'}, frontend dispatches to onTerminal('timed_out'))"
    - "Phase 066 Plan 05 (live UAT: with ENABLE_TEST_FIXTURES=1 force a synthetic timeout and verify both banner copy AND Resume button visibility)"
tech-stack:
  added: []
  patterns:
    - "Type-safe discriminated terminal-kind union extension — union literal addition forces TypeScript to surface all unhandled callsites at compile time (T-066-09 mitigation)"
    - "Banner-copy switch keyed on runStatus with stopped fallback for legacy pre-runStatus rows (D-063.1-15 compatibility)"
    - "Dual surface update — primary banner (in-content) + secondary indicator (post-content) keep copy in sync to prevent contradictory UX (Rule-2 mitigation continuation)"
key-files:
  created: []
  modified:
    - "frontend/src/types/index.ts (line 97-98 — Message.runStatus union 4 → 5 values, Phase 066 D-066-04 doc reference)"
    - "frontend/src/lib/api.ts (line 73 — getMessages mapper Pydantic mirror; lines 168-172 — StreamCallbacks.onTerminal kind union 3 → 4; lines 379-389 — subscribeToRun parser adds t === 'timed_out' branch BEFORE cancelled)"
    - "frontend/src/hooks/useMessages.ts (line 561-577 sendMessage onTerminal — 5th 'timed_out' branch sets stopped:true; line 791-815 reconcile onTerminal — 5th 'timed_out' branch sets runStatus only, no stopped)"
    - "frontend/src/components/chat/MessageItem.tsx (line 97-112 Resume gating extends to timed_out + aria-label updated to 'Resume run'; line 128-141 banner switch on runStatus; line 151-165 secondary post-content indicator now also recognizes timed_out — Rule-2 deviation)"
decisions:
  - "Banner copy choice (D-066-10): 'Agent reached time limit' — concise, user-friendly, fits Aether Intelligence design system voice. Verified no conflicting precedent. Alternatives considered: 'Agent timeout', 'System time limit reached' (rejected as jargon / verbose)."
  - "aria-label for Resume button updated from 'Resume failed run' to 'Resume run' (LOCKED in plan revision). Rationale: with gating now on (failed || timed_out), the original label would announce 'Resume failed run' for timed_out messages — inaccurate. Shorter 'Resume run' label matches the visible button text exactly."
  - "Secondary stopped indicator (MessageItem.tsx:151-165) updated as Rule-2 deviation — plan only required line 130-145 banner update, but the secondary indicator at line 151 ALSO renders 'Response stopped' via {message.stopped && !isStreaming}. sendMessage path sets stopped: true on timed_out (per plan Subtask 2a) → without the secondary update, a timed_out message would show 'Agent reached time limit' (in-content banner) AND 'Response stopped' (bottom indicator) simultaneously OR show only 'Response stopped' (when content present, in-content branch suppressed). Threat T-066-11 mitigation continuation."
  - "Reconcile path keeps existing convention: timed_out branch does NOT set stopped:true (matches the cancelled branch). MessageItem banner keys on runStatus first, so the banner renders correctly via runStatus regardless of stopped flag."
metrics:
  duration: "~10 minutes (3 tasks: types/api + hook/component edits + commit; tsc compile gates passed twice)"
  completed_date: "2026-05-06"
  tasks_in_plan: 3
  tasks_completed: 3
  commits_landed: 1
---

# Phase 066 Plan 03: Frontend Lifecycle UI — Summary

Frontend mirror of Plan 01's backend lifecycle split: `runStatus`/`MessageStatus`-equivalent type extended to 5 values (`timed_out` added), SSE parser dispatches the new sentinel to `onTerminal("timed_out", error)`, both useMessages.ts override callsites handle the 5th kind, and MessageItem.tsx renders distinct UI — Resume button + "Agent reached time limit" banner — via D-066-09/10. Vitest deferred per Phase 063.1 plan precedent; gate is `tsc --noEmit` green (passed).

## Status

**Complete.** All 3 plan tasks landed in a single commit (`900e11a`):

- **Task 1** (types/index.ts + api.ts): `Message.runStatus` union extended; `getMessages` mapper Pydantic mirror extended; `StreamCallbacks.onTerminal` kind union extended; `subscribeToRun` parser adds `t === "timed_out"` branch BEFORE cancelled.
- **Task 2** (useMessages.ts + MessageItem.tsx): Both `onTerminal` override callsites add the 5th `timed_out` branch (sendMessage sets `stopped: true`, reconcile does not — per plan key_decisions). Resume button gating extends to `(failed || timed_out)`. Banner copy switches on `runStatus` keyed first to `timed_out` → "Agent reached time limit". aria-label updated to `"Resume run"` per the LOCKED plan revision.
- **Task 3** (commit): Single commit — `feat(066-03): frontend lifecycle UI for 'timed_out' ...` — touches exactly the 4 specified files. No backend files. No working-tree drift post-commit. `tsc --noEmit` green pre-commit and post-commit.

## What changed

### Files created

None.

### Files modified

- `frontend/src/types/index.ts` (line 97-98): `Message.runStatus` Pydantic-mirror union extended from 4 → 5 values: `"streaming" | "completed" | "failed" | "cancelled" | "timed_out"`. JSDoc comment updated to reference Phase 066 D-066-04 and D-066-09 (Resume button gating).
- `frontend/src/lib/api.ts`:
  - Line 73: getMessages inline-response shape's `run_status` literal extended to include `"timed_out"`. Inline comment cites D-066-04 + Plan 01 backend Pydantic Literal alignment.
  - Lines 168-172: `StreamCallbacks.onTerminal` kind union extended from 3 → 4 values: `"done" | "error" | "cancelled" | "timed_out"`. Multi-line JSDoc comment block above the field cites D-066-06 wire-format compatibility and D-066-09/10 hook-layer downstream contract.
  - Lines 379-389: `subscribeToRun` parser adds explicit `else if (t === "timed_out") { callbacks.onTerminal("timed_out", parsed.error as string | undefined); return; }` branch BEFORE the existing `cancelled` branch. Multi-line comment cites Plan 01 backend `_RUN_STATUS_TO_TERMINAL_TYPE` map at threads.py:90-94 and D-066-07 (error string format) / T-066-10 (no-render of error payload).
- `frontend/src/hooks/useMessages.ts`:
  - Lines 561-577 (sendMessage onTerminal override): 5th branch `if (kind === "timed_out") return { ...m, runStatus: "timed_out", stopped: true }` added BEFORE the cancelled fallback. Sets `stopped: true` so the bottom Stopped indicator renders. 4-line comment above `setMessages` block documents the parity-with-cancelled rationale.
  - Lines 791-815 (reconcile onTerminal override): 5th branch `if (kind === "timed_out") return { ...m, runStatus: "timed_out" }` added BEFORE the cancelled fallback. Does NOT set `stopped: true` (reconcile-path convention — re-attaches to a possibly-not-yet-stopped run, and stopped:true would mis-render mid-stream). 6-line comment above `setMessages` block documents the divergence from sendMessage.
- `frontend/src/components/chat/MessageItem.tsx`:
  - Lines 97-112: Resume button condition extended from `message.runStatus === "failed"` to `(message.runStatus === "failed" || message.runStatus === "timed_out")`. Comment block updated to reference Phase 066 D-066-09. **aria-label updated from `"Resume failed run"` → `"Resume run"`** per the LOCKED plan revision (the original label would inaccurately announce "Resume failed run" for a timed_out message via screen reader).
  - Lines 128-141: Banner copy switch (in-content branch when `hasAnyTools && !content`) reordered: now keys on `runStatus === "timed_out"` first → `"Agent reached time limit"`; falls through to `runStatus === "cancelled" || message.stopped` → `"Response stopped"`; falls through to `"Saving response…"`. Inline comments cite D-066-10 and the legacy stopped-fallback compatibility per D-063.1-15.
  - Lines 151-165 (Rule-2 deviation): Secondary post-content Stopped indicator (`message.stopped && !isStreaming`) extended to ALSO render when `runStatus === "timed_out"`, with the inner `<span>` text switching on runStatus. Without this dual update, a timed_out message would render contradictory copy. 8-line comment block documents the rationale.

### Files deliberately NOT modified

- `frontend/src/components/chat/MessageItem.tsx` lines 1-77 (user message branch and assistant container shell).
- All other frontend files — Plan 03 scope is exactly the 4 files in the plan frontmatter.
- All backend files — Plan 03 is the frontend mirror of Plan 01 (which already landed).

## Verification

### Plan-level grep gates (Tasks 1, 2, 3)

| Gate | Result |
|------|--------|
| `runStatus?: "streaming" \| "completed" \| "failed" \| "cancelled" \| "timed_out"` in types/index.ts | PASS |
| `run_status?: "streaming" \| "completed" \| "failed" \| "cancelled" \| "timed_out" \| null` in api.ts | PASS |
| `onTerminal: (kind: "done" \| "error" \| "cancelled" \| "timed_out", ...)` in api.ts | PASS |
| `t === "timed_out"` parser branch present in api.ts | PASS |
| `kind === "timed_out"` appears 2x in useMessages.ts (sendMessage + reconcile) | PASS (`grep -c` returns 2) |
| `runStatus: "timed_out", stopped: true` in useMessages.ts (sendMessage path only) | PASS |
| `message.runStatus === "failed" \|\| message.runStatus === "timed_out"` Resume gating | PASS |
| `aria-label="Resume run"` present | PASS |
| `aria-label="Resume failed run"` ABSENT (replaced) | PASS (no matches) |
| `Agent reached time limit` string present in MessageItem.tsx | PASS (3 occurrences — primary banner + secondary indicator + comment) |
| `Response stopped` string preserved (cancelled path) | PASS (multiple occurrences kept) |
| `tsc --noEmit` exit-0 (Task 1 + Task 2 + Task 3 final) | PASS (zero output, zero errors) |

### TypeScript compile output

`cd frontend && npx tsc --noEmit` ran twice (post-Task-1+2 and post-commit). Both invocations exited with code 0 and produced no error output. The 5-value union, the 4-value onTerminal kind, and the 5-branch hook setMessages updaters all type-check cleanly. Strict mode is enabled (`tsconfig.app.json` has `"strict": true, "noUnusedLocals": true, "noUnusedParameters": true`) — no unused-variable false-positives from the comment-only additions.

### Commit gates

| Check | Result |
|-------|--------|
| Single commit landed | PASS (`900e11a`) |
| Subject contains `066-03` | PASS |
| Touches exactly 4 files (frontend/src/types/index.ts, frontend/src/lib/api.ts, frontend/src/hooks/useMessages.ts, frontend/src/components/chat/MessageItem.tsx) | PASS |
| No file deletions in commit | PASS (`git diff --diff-filter=D --name-only HEAD~1 HEAD` returns empty) |
| Branch is `worktree-agent-a9b3e446af1b1574f` (per-agent namespace) | PASS |
| HEAD merge-base with `d06f851` is `d06f851` (worktree base correct) | PASS |

## Self-Check: PASSED

- `frontend/src/types/index.ts` — FOUND with 5-value union at line 98
- `frontend/src/lib/api.ts` — FOUND with 5-value getMessages mapper, 4-value onTerminal kind, t === 'timed_out' parser branch
- `frontend/src/hooks/useMessages.ts` — FOUND with 2 `kind === "timed_out"` branches (lines 573, 812)
- `frontend/src/components/chat/MessageItem.tsx` — FOUND with extended Resume gating + banner switch + Rule-2 secondary indicator update
- Commit `900e11a` — FOUND on `worktree-agent-a9b3e446af1b1574f` branch (subject: `feat(066-03): frontend lifecycle UI for 'timed_out' — Resume gating + "Agent reached time limit" banner`)
- All 12 grep gates above returned PASS at SUMMARY-write time.
- `tsc --noEmit` green post-commit.

## Deviations from Plan

### [Rule 2 — Critical UX correctness] Secondary post-content "Stopped indicator" updated to recognize timed_out

- **Found during:** Task 2 read-through of MessageItem.tsx (lines 147-152 in pre-edit file)
- **Issue:** The plan's Subtask 2d only targets the in-content banner block at lines 130-145. But MessageItem.tsx has a SECOND surface — the after-content Stopped indicator at lines 151-157 (`{message.stopped && !isStreaming && (<div>...Response stopped</div>)}`) — that ALSO renders "Response stopped". Plan Subtask 2a sets `stopped: true` on the sendMessage path's `timed_out` branch. So:
  - Without the second update, a `timed_out` message **with content** would show `"Response stopped"` (bottom indicator fires; in-content branch suppressed because content is present) → contradicts D-066-10 ("timed_out → 'Agent reached time limit'").
  - Without the second update, a `timed_out` message **without content** would show `"Agent reached time limit"` (in-content banner) AND `"Response stopped"` (bottom indicator) simultaneously — contradictory UX.
- **Fix:** Extended the line 151-157 indicator condition from `(message.stopped && !isStreaming)` to `((message.stopped || message.runStatus === "timed_out") && !isStreaming)`, with the inner `<span>` text switching on `runStatus`. This keeps the secondary surface in sync with the primary banner switch. The "Response stopped" string remains for the cancelled / legacy-stopped path.
- **Files modified:** `frontend/src/components/chat/MessageItem.tsx` (lines 151-165 in post-edit file)
- **Threat connection:** This is T-066-11 mitigation continuation — the threat register flagged "Existing failed-state UX regresses because banner switch interferes" and required `grep -n "Response stopped"` to confirm the cancelled string is preserved (it is). The Rule-2 update extends that intent: prevent the timed_out path from accidentally rendering both copies.
- **No new tests added:** Vitest is deferred per Phase 063.1 precedent. Plan 05 live UAT will verify the dual-surface coherence end-to-end.
- **Commit:** `900e11a` (single Plan-03 commit per the plan's Task-3 spec).

### [No Rule violations beyond the above]

The Rule-2 fix is a tight scope extension (one element, kept under the same `<div>`-tree level as the banner change), not architectural. No Rule 1 (bug fix) or Rule 3 (blocking issue) was needed — the plan as written compiled cleanly; the Rule-2 update is for UX correctness completeness.

## Known Stubs

None. The "Agent reached time limit" copy is a final, user-visible string per D-066-10 (not a placeholder). The Resume button click handler is the unchanged `onResume?.(message)` callback; no stub there.

## Threat Flags

None. Plan 03 introduces no new network endpoints, auth paths, file access patterns, or trust-boundary surfaces. The frontend SSE parser change is the modeled change (T-066-09 mitigation: explicit `t === "timed_out"` branch ensures TypeScript surface coverage for all callers of the union, plus the Plan 05 UAT step). The error-payload non-render is the modeled mitigation (T-066-10: backend `error` string passes through to the hook layer for debugging but is NOT rendered in the UI — banner copy is the static "Agent reached time limit" string).

## Plan 05 UAT prerequisite

With `ENABLE_TEST_FIXTURES=1`, the live UAT MUST verify:

1. **Banner correctness:** Force a synthetic per-call timeout (e.g. fixture `slow_llm_response_seconds=2` against `per_call_budget=1`). The assistant message renders "Agent reached time limit" (NOT "Response stopped") in BOTH:
   - The in-content banner (line 130-145) when no content was emitted before timeout.
   - The post-content stopped indicator (line 151-165) when content was emitted before timeout.
2. **Resume button visibility:** The Resume button surfaces on the timed_out message (gating now `(failed || timed_out)`).
3. **Resume click behavior:** Clicking Resume on a `timed_out` message re-POSTs the original prompt with full conversation context (same code path as `failed` Resume — onResume callback unchanged).
4. **Cancelled path regression check:** A user-clicked Stop still renders "Response stopped" in both surfaces (cancelled path preserved).
5. **aria-label accessibility:** Screen-reader announces the Resume button as "Resume run" (verified via Chrome DevTools accessibility inspector).

## Commits landed (this plan)

| Task | Commit | Subject |
|------|--------|---------|
| 1+2+3 (combined per plan Task-3 spec) | `900e11a` | `feat(066-03): frontend lifecycle UI for 'timed_out' — Resume gating + "Agent reached time limit" banner` |

(SUMMARY.md doc commit is separate, tracked by the orchestrator's wave-merge.)
