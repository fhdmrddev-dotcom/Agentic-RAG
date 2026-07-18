---
phase: 149-model-registry-discovery
plan: 09
subsystem: ui
tags: [sse, streaming, react, fastapi, model-registry, provider-routing, honesty]

# Dependency graph
requires:
  - phase: 149-model-registry-discovery
    provides: "backend model_disabled_fallback SSE emit + _resolve_enabled_model seam (plan 06); admin model registry (plan 05-07); DB-aware calling-mode override (plan 08)"
provides:
  - "frontend consumer for the model_disabled_fallback SSE event (previously dropped) — StreamCallbacks.onModelDisabledFallback"
  - "inline honest chat notice in MessageItem naming BOTH the disabled model and the org-default fallback (D-149-10)"
  - "runs.provider re-resolved to the effective (fallback) model's provider before register_run_start (bookkeeping honesty)"
affects: [150-secrets-at-rest, 153-inline-citations, MessageItem, StreamsProvider, threads.py]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSE informational-event pass-through: api.ts dispatch branch (no return) → StreamsProvider message-stamp → MessageItem inline render, mirroring skill_activated"
    - "G-5 minimal additive guard on threads.py: pure helper (_reresolve_fallback_provider) + a notice-gated re-resolve block, no restructure of the if/else provider block"

key-files:
  created:
    - "frontend/src/__tests__/components/MessageItem.fallbackNotice.test.tsx"
  modified:
    - "backend/app/api/threads.py"
    - "backend/tests/test_149_fallback_notice.py"
    - "frontend/src/lib/api.ts"
    - "frontend/src/providers/StreamsProvider.tsx"
    - "frontend/src/types/index.ts"
    - "frontend/src/components/chat/MessageItem.tsx"

key-decisions:
  - "Fallback notice stamps the message (persistent, reply-tied) rather than migrating to the existing thread-level auto-clearing amber toast — the two mechanisms serve different lifetimes (checker info #2)"
  - "Provider re-resolve extracted to a pure helper (_reresolve_fallback_provider) so it is unit-testable without driving the full send_message handler — additive, does NOT restructure the existing provider if/else block"
  - "The re-resolve guards 'unknown'/None capability → keeps the pre-fallback provider unchanged, so a garbage capability never yanks the recorded provider"

patterns-established:
  - "Informational SSE branches carry no `return` in the api.ts ladder so cursor-advance still fires"
  - "Notice renders as a SIBLING of the content-gated block so it shows even before any delta streams (tied to the reply, not gated on content)"

requirements-completed: [MODEL-01]

# Metrics
duration: 8min
completed: 2026-07-12
---

# Phase 149 Plan 09: Silent-Fallback Gap Closure Summary

**Wired the already-emitted `model_disabled_fallback` SSE event through the frontend (api.ts → StreamsProvider → MessageItem) as an inline notice naming both models, and re-resolved `runs.provider` to the effective fallback model — closing the UAT Test-7 silent-swap + provider-bookkeeping gaps (D-149-10).**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-12T20:25:27+04:00
- **Completed:** 2026-07-12T16:33:21Z
- **Tasks:** 2 (both TDD — RED then GREEN)
- **Files modified:** 6 (1 created)

## Accomplishments
- The disabled-model swap is now honest end-to-end: the backend event that was silently dropped (`rg model_disabled_fallback frontend/src` = 0 hits before) is consumed and rendered as an inline notice naming BOTH the disabled model and the org-default fallback.
- A disabled-model fallback run now records the provider that actually served it (`runs.provider` re-resolved from the effective model) — a MiniMax-served fallback no longer records `provider='anthropic'`.
- Both fixes are strictly additive: the no-fallback / enabled path is byte-identical end-to-end (no notice stamped, no notice rendered, no provider re-resolve), and the G-5 hot file `threads.py` took a minimal in-place guard (no refactor, no per-provider fork, shared SSE emitter untouched).

## Task Commits

Each task was committed atomically (TDD: test → impl):

1. **Task 1: Re-resolve provider for the effective fallback model** — `be005ce7` (test, RED) → `6dc1a8dd` (fix, GREEN)
2. **Task 2: Consume model_disabled_fallback SSE event + inline notice** — `77188d1f` (test, RED) → `464ac9c1` (feat, GREEN)

## Files Created/Modified
- `backend/app/api/threads.py` — added pure `_reresolve_fallback_provider` helper + a notice-gated re-resolve block before `register_run_start` (corrects `runs.provider` on a fallback).
- `backend/tests/test_149_fallback_notice.py` — extended with 3 tests: fallback records effective provider (minimax), garbage-capability guard, None-capability guard.
- `frontend/src/lib/api.ts` — added `onModelDisabledFallback` to `StreamCallbacks` + a dispatch branch (mirrors `skill_activated`, no return).
- `frontend/src/types/index.ts` — added `modelFallbackNotice?` to the assistant `Message` interface.
- `frontend/src/providers/StreamsProvider.tsx` — `onModelDisabledFallback` stamps `modelFallbackNotice` on the streaming assistant message only.
- `frontend/src/components/chat/MessageItem.tsx` — inline amber notice (data-testid `model-fallback-notice`) showing the backend `message` string when the field is set; nothing extra when absent.
- `frontend/src/__tests__/components/MessageItem.fallbackNotice.test.tsx` — new component test proving both model names render, the notice shows pre-content, and nothing renders when the field is absent.

## Verification
- `pytest tests/test_149_fallback_notice.py` — **9 passed** (6 pre-existing + 3 new).
- `npm run test -- MessageItem.fallbackNotice` — **3 passed**.
- `rg model_disabled_fallback frontend/src` — **4 hits** (api.ts, types, StreamsProvider, test) — the dropped-event bug is closed.
- `npx tsc -b` — **30 errors, identical to the known baseline** (21 SEED-056 `__tests__` rot + 9 React-19 drift, incl. the pre-existing TS6133 `getActiveRuns` in StreamsProvider.tsx:74). The 4 touched source files (MessageItem.tsx, api.ts, types/index.ts, StreamsProvider.tsx) introduce **zero new errors**.
- `npx vite build` — **exit 0**.

## Decisions Made
- Stamp the message (persistent, reply-tied notice) instead of migrating the existing thread-level auto-clearing amber toast — the two mechanisms serve different lifetimes (D-149-10 wording "this reply used modelY" demands a per-reply persistent notice).
- Extract the provider re-resolve to a pure helper (`_reresolve_fallback_provider`) for unit-testability without driving the full `send_message` handler; the existing if/else provider block is untouched.
- Render the notice as a sibling of the content-gated block so it appears even before content streams.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The `state.record-metric` SDK verb rejected the positional-arg form and was re-run with the flag form (`--phase/--plan/--duration/...`) — recorded successfully; not a plan issue.

## User Setup Required
None - no external service configuration required. (No new packages; T-149-SC "accept" holds — zero new package installs.)

## Next Phase Readiness
- D-149-10 is now honest end-to-end (frontend consumer + provider bookkeeping) — the SC#10 live cross-provider UAT (149-HUMAN-UAT.md Test 7) can now verify the inline notice + corrected `runs.provider` on a real disabled-model fallback.
- No blockers. The threads.py G-5 extraction refactor remains due (unchanged by this minimal guard).

## Threat Surface Scan
No new security-relevant surface beyond the plan's `<threat_model>` (T-149-26/27/28 all mitigated; T-149-SC accept — zero new packages). No new endpoints, auth paths, file access, or schema changes.

## Self-Check: PASSED
- Files created/modified verified present (all 7 committed across `be005ce7`, `6dc1a8dd`, `77188d1f`, `464ac9c1`).
- Commits verified in git log: `be005ce7`, `6dc1a8dd`, `77188d1f`, `464ac9c1` all exist on `develop`.

---
*Phase: 149-model-registry-discovery*
*Completed: 2026-07-12*
