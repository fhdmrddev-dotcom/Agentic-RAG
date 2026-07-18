---
phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch
plan: 05
subsystem: ui
tags: [react, zustand, sse, streaming, run-lifecycle, watchdog, reconcile, vitest]

# Dependency graph
requires:
  - phase: 145-01
    provides: LIVE repro (A3 structural proof) confirming streamingThreads has no reconcile-derive; the missed-terminal phantom is load-bearing
provides:
  - reconcile-DERIVED streamingThreads from snapshot.active_runs (both directions, per-thread, send-guarded)
  - client inactivity watchdog (one shared ~5s interval, ~20s per-thread window, read-only getSnapshot probe)
  - silent terminal finalize on a missed-terminal verdict (no banner / no reconnecting state)
  - the tab-focus/visibility belt now heals Direction A for free
affects: [StreamsProvider, chat composer Stop button, MessageFeedback, run-lifecycle honesty, FND-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reconcile-via-fetch state derivation: streamingThreads is DERIVED from the authoritative runs.status (getSnapshot), never trusted as an independent local flag (D-v2.5-03)"
    - "Client inactivity watchdog: ONE shared setInterval over a per-thread activity clock; read-only probe that reconciles-not-kills"

key-files:
  created:
    - frontend/src/__tests__/providers/StreamsProvider.watchdog.test.ts
  modified:
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/__tests__/providers/StreamsProvider.transient.test.ts

key-decisions:
  - "streamingThreads is reconcile-derived from snapshot.active_runs in BOTH directions (Direction A delete / Direction B re-add) through the existing Stop selectors — zero call-site changes"
  - "The derive/watchdog delete is guarded by sendingThreadsRef (Pitfall 1) so an in-flight send is never clobbered"
  - "The watchdog only RECONCILES (read-only getSnapshot probe), never kills — the authoritative dead-producer kill stays the backend stale-sweep (D-145-05)"
  - "Silent finalize (D-145-04): delete + flip placeholder runStatus to completed via the done->completed terminal-flip map; no banner / no reconnecting copy"
  - "N (~20s inactivity) and the ~5s tick are named consts (WATCHDOG_INACTIVITY_MS / WATCHDOG_TICK_MS) so they are tunable"

patterns-established:
  - "Pattern 2 (U7): reconcile-derive streamingThreads from active_runs so the Stop button agrees with runs.status"
  - "Inactivity-watchdog belt: shared interval + per-thread lastEventAt clock, reset on onCursor + every streamingThreads add"

requirements-completed: [FND-01]

# Metrics
duration: 35min
completed: 2026-07-09
---

# Phase 145 Plan 05: Run-Lifecycle Honesty (Frontend Direction A) Summary

**streamingThreads is now reconcile-DERIVED from the authoritative runs.status (both directions) plus a read-only inactivity watchdog that silently finalizes a missed-terminal run — the phantom Stop clears with the tab open, and a still-live reconciled run re-shows Stop, through the existing selectors with zero call-site changes.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-09T18:14:00Z
- **Completed:** 2026-07-09T18:26:00Z
- **Tasks:** 2 (TDD: RED → GREEN)
- **Files modified:** 3 (1 source, 2 tests; 1 test file new)

## Accomplishments
- **Reconcile-derive (Pattern 2 / U7):** after every reconcile `getSnapshot`, `streamingThreads` is derived from `snapshot.active_runs` — Direction A deletes the thread when no run is streaming (phantom Stop clears), Direction B re-adds it when a still-active run is reconciled (Stop reappears). Guarded by `sendingThreadsRef` so an in-flight send is never clobbered (Pitfall 1).
- **Inactivity watchdog (useEffect #3):** ONE shared `setInterval` (~5s) sweeps the streaming set; a per-thread ~20s window (reset on every `onCursor` and every `streamingThreads` add) fires a READ-ONLY `getSnapshot` probe — not the full `reconcile()` action. On a confirmed-terminal verdict it silently finalizes; while still streaming it no-ops; on an unverifiable read it fails safe.
- **Silent finalize (D-145-04):** delete from `streamingThreads` (guarded) + flip the live placeholder's `runStatus` to `completed` via the existing done→completed terminal-flip map. No banner, no "reconnecting" state.
- **Belt reuse:** the existing visibility/focus reconcile belt now heals Direction A for free (reconcile derives `streamingThreads`); the transient reattach still restores `streamingThreads` mid-run (D-145-10), so the composer/feedback stay honest until `runs.status` is terminal.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Author the watchdog + reconcile-derive vitest (RED)** - `ceee6f96` (test)
2. **Task 2: Reconcile-derive streamingThreads + inactivity watchdog + silent finalize (GREEN)** - `5a61ece2` (feat)

_Task 2 was a single implementation commit (no separate refactor pass needed — the change slotted into the existing reconcile/onCursor/finally seams)._

## Files Created/Modified
- `frontend/src/providers/StreamsProvider.tsx` - Added `WATCHDOG_TICK_MS`/`WATCHDOG_INACTIVITY_MS` consts + `lastEventAtRef`; the reconcile-derive block (both directions, send-guarded); the inactivity watchdog `useEffect #3` (probe + silent finalize); activity stamping at the 3 `onCursor` sites, the send-path streamingThreads add, and the transient reattach re-add; watchdog-clock cleanup in the send finally.
- `frontend/src/__tests__/providers/StreamsProvider.watchdog.test.ts` - NEW: fake-timer watchdog (silent-finalize on terminal, no-op while streaming) + both-direction reconcile-derive (Direction A clear / Direction B re-add) + the `sendingThreadsRef` in-flight-send guard.
- `frontend/src/__tests__/providers/StreamsProvider.transient.test.ts` - Extended: hoisted `postMessage`/`subscribeToRun`/`getThreadWorkflow` stubs + a rendered D-145-10 test proving a transient `reader_done` → reattach keeps `streamingThreads` (composer stays Stop).

## Decisions Made
- Followed the plan's Pattern 2 exactly: the derive/watchdog delete is guarded by `sendingThreadsRef` (mirroring `clearThreadBucket:1302`) and the Stop selectors (`useStreamingForThread`/`useStreamingThreadIds`/`useIsStreaming`) keep their signatures — the fix flows through them with no call-site changes.
- Chose `onCursor` as the stream-event heartbeat for the per-thread activity clock (it fires on cursor advancement per streamed message). A long, legitimately-silent reasoning gap is protected because the watchdog probe is read-only and no-ops when the snapshot still shows a streaming run (one cheap read, then the clock refreshes).
- The watchdog flips a missed-terminal placeholder to `completed` (the done→completed branch); if the run actually errored, the next tab-focus/reconcile hydrates the true persisted status from `snapshot.messages`.

## Deviations from Plan

None - plan executed exactly as written (TDD RED → GREEN; both tasks landed as specified; no Rule 1-4 deviations required).

## Issues Encountered
- **Pre-existing tsc rot (out of scope):** `tsc -b` reports `TS6133: 'getActiveRuns' is declared but its value is never read` at `StreamsProvider.tsx:74`. This unused import predates this plan (only referenced in comments; my diff never touched it) and is consistent with the project's known state — `vite build` in CI skips `tsc`. Per the scope boundary this was NOT fixed. My changes introduce zero new type errors (verified by filtering `tsc -b` output to the touched files).
- **Baseline vitest rot (expected):** the provider suite has 13 pre-existing failures across `StreamsProvider.dedup.test.ts`, `streamsProvider.test.tsx`, and `streamsProvider_075_9_clientkey.test.tsx` (fail at baseline AND HEAD — SEED-056 class). After this plan the failing set is byte-identical (13 failed / 78 passed / 91 total) — no NEW regressions. The 6 new tests (5 watchdog + 1 transient D-145-10) all pass, and the at-risk passing files (067.5 regression, bug_260707_01, 075.7) still pass.

## Verification
- `cd frontend && npx vitest run src/__tests__/providers/StreamsProvider.watchdog.test.ts src/__tests__/providers/StreamsProvider.transient.test.ts` → **15 passed** (GREEN).
- Full provider suite: **13 failed | 78 passed (91)** — identical failure set to baseline (13 pre-existing rot), no new regressions.
- `grep setInterval` → exactly one shared watchdog interval (`setInterval(tick, WATCHDOG_TICK_MS)`); the probe uses read-only `getSnapshot`, not a new `reconcile()` per tick.
- `grep sendingThreadsRef` → new guard sites at the reconcile-derive delete, the silent-finalize, and the tick skip.
- No user-facing "reconnecting"/banner copy introduced (only code comments reference it, explicitly to say it is absent).
- Stop selectors (`useStreamingForThread` / `useStreamingThreadIds` / `useIsStreaming`) keep their signatures — no call-site changes elsewhere.

## Manual UAT (deferred to /gsd:verify-work — operator-driven)
Per `145-VALIDATION.md`, the live SC#10 matrix is operator-driven and NOT part of this plan's tasks: Direction A self-heals with the tab open (OpenAI), Direction B corrects a dead producer (DeepSeek + MiniMax, needs a backend restart), cancel per-provider, multi-tool does not trip the watchdog, parallel-thread isolation, and the long silent-reasoning gap does not false-kill. HMR caveat: re-test after a FRESH page load (a React provider change under HMR keeps stale module state).

## User Setup Required
None - no external service configuration required (frontend-only, no new packages, no schema/env changes).

## Next Phase Readiness
- Direction A frontend honesty is in place and unit-proven; it composes with the backend co-write owner (Plans 02-04) and the reconciler stream-age sweep independently (this plan depends only on the LIVE repro).
- The cross-worker cancel gap (Open Q1) remains FLAGGED, not fixed → SEED-109.
- Ready for the live SC#10 UAT matrix during `/gsd:verify-work`.

## Self-Check: PASSED
- FOUND: frontend/src/providers/StreamsProvider.tsx
- FOUND: frontend/src/__tests__/providers/StreamsProvider.watchdog.test.ts
- FOUND: frontend/src/__tests__/providers/StreamsProvider.transient.test.ts
- FOUND commit: ceee6f96 (Task 1, test/RED)
- FOUND commit: 5a61ece2 (Task 2, feat/GREEN)

---
*Phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch*
*Completed: 2026-07-09*
