# Phase 121 — Deferred Items

Out-of-scope discoveries logged during execution (per the executor scope-boundary rule). NOT fixed in this phase.

## Pre-existing full-suite Vitest failures (discovered Plan 02, 2026-06-22)

`cd frontend && npm run test` reports **27 failures across 14 files**. Confirmed **PRE-EXISTING** by restoring the `HEAD~2` (pre-Plan-02) versions of this plan's three test files and re-running a representative sample (`model-info.test.ts` + `streamsProvider.test.tsx` still failed — 11 failed). **None are files Phase 121 touched** — Plan 02 only added/edited the 3 `__tests__/` files (ChatAreaMode, ChatAreaBanner, ChatLayoutLaunch), all GREEN. Per the scope boundary these are NOT fixed here.

Failing files:

- `src/__tests__/components/IngestionPage.test.tsx` (2) — heading "Documents" / two-panel layout
- `src/__tests__/components/MessageItem.test.tsx` (1) — thinking indicator while streaming empty content
- `src/__tests__/components/Plan04.frontend.test.tsx` (1) — stdout/stderr terminal-output channel styling
- `src/__tests__/hooks/useMessages.test.ts` (1) — Row-11 empty-thread-until-refresh reconcile
- `src/__tests__/providers/StreamsProvider.dedup.test.ts` (2) — replayed tool_start no-op / onToolEnd id-match flip
- `src/__tests__/providers/streamsProvider.test.tsx` (~9) — argsCodeText reducer slice + Phase-068 reconcile-lock / listener-migration / 068.5 merge-filter cases
- `src/__tests__/providers/streamsProvider_075_9_clientkey.test.tsx` (1) — clientKey preservation across tool_end
- `src/components/workflows/PublishGauntlet.test.tsx` (1) — 4 HTTP outcomes render distinctly
- `src/components/panel/__tests__/PhaseTimeline.test.tsx` (several) — "Axe is already running" jest-axe concurrency flake
- `src/lib/model-info.test.ts` (1) — costTier values for known models

Disposition: **backlog (broader frontend test-health)** — candidate for a dedicated test-stabilization sweep. Does NOT block Phase 121 verify-work (this phase's oracles are all GREEN and isolated). The PhaseTimeline failures are a known jest-axe parallelism flake; the StreamsProvider/useMessages/model-info failures predate this milestone's IA work.
