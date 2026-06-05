---
phase: 095-chat-tool-card-unification
plan: 02
subsystem: ui
tags: [react, vitest, typescript, timer, step-count, run-status-strip, honesty-fix]

# Dependency graph
requires:
  - phase: 095-01
    provides: "unifiedStepCount(message) — the D-04 single source of truth this plan wires into all 3 RunCard count sites + the RunStatusStrip"
  - phase: 083
    provides: "MessageList key={run-${runId}} remount guard — D-06 derives elapsed from created_at, REINFORCING the 083 temp-id→DB-id fix (never regressing it)"
provides:
  - "RunStatusStrip — the ONE '⏱ elapsed · Step N · activity' strip with a placement prop (header | floating); Plans 03/04 reuse the floating placement"
  - "D-06 persistent timer in RunCard — continuous wall-clock elapsed from created_at, frozen only at a true terminal; never vanishes (closes BUG-260528-01)"
  - "D-04 unified count in RunCard — header title, strip Step N, and collapsed-row all read unifiedStepCount; the step label now survives next-day reopen"
affects: [095-03, 095-04, RunCard, RunStatusStrip]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stable-start-ts timer derivation: elapsed = (frozenEnd ?? now) - Date.parse(created_at), recomputed each tick (not an accumulator) → immune to background-tab setInterval throttling and temp-id→DB-id remounts (D-06)"
    - "Single-source-of-truth wiring: all three RunCard count sites import one unifiedStepCount derivation instead of forking raw length / iterationCount+1 (D-04)"
    - "One component, two placement wrappers: RunStatusStrip renders identical segment markup under a header | floating placement prop (build-once rule, SKETCH-CONSISTENCY §B)"

key-files:
  created:
    - "frontend/src/components/chat/RunStatusStrip.tsx — the one ⏱ elapsed · Step N · activity strip (placement prop)"
  modified:
    - "frontend/src/components/chat/RunCard.tsx — D-06 timer derivation + D-04 count unification + hosts RunStatusStrip (header placement)"
    - "frontend/src/components/chat/RunCard.test.tsx — 7 new D-06/D-04 cases; 2 stale assertions retargeted to the new steps copy"

key-decisions:
  - "D-06 elapsed derives from Date.parse(message.created_at), NOT performance.now() — the stable wall-clock baseline survives the 083 temp-id→DB-id remount and actively REINFORCES that fix (RESEARCH A2)"
  - "Timer renders continuously whenever Number.isFinite(startMs); the '{(isStreamingNow || elapsedMs > 0)}' vanish gate is GONE — freeze captured once at the streaming→terminal edge via frozenEndRef"
  - "All three count sites read unifiedStepCount(message); iterationCount is destructured to a panel-only alias (panelIterationCount) so no visible step number reads it AND the ToolCallPanel Round-N divider still works"
  - "Relabeled 'N tools'/'N tool calls' → 'N steps' per SKETCH-CONSISTENCY; 2 stale RunCard.test.tsx assertions (Step 5 from iterationCount; '3 tool calls') retargeted to the deduped count + steps copy (Rule 1 — the relabel/relocation made them stale)"
  - "Compact 'Xm Ys' elapsed form once a run crosses a minute (sketch shows 3m12s) so a long Kimi/Moonshot run never reads an unwieldy 192.4s"

patterns-established:
  - "Never-vanishes is a timer-derivation code change, not a placement choice — render continuously from a stable start-ts, freeze only on a true terminal"
  - "The strip and the cards can never disagree because they read the same unifiedStepCount integer"

requirements-completed: [CHAT-04]

# Metrics
duration: 14min
completed: 2026-06-05
---

# Phase 095 Plan 02: RunCard Honesty Fixes + RunStatusStrip Summary

**The two RunCard-internal honesty fixes — a D-06 persistent timer that derives elapsed from `created_at` and never vanishes (closing BUG-260528-01), and a D-04 unified step count wired into all three RunCard count sites — plus the ONE `RunStatusStrip` that composes them, built so the strip and the cards can never disagree.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-05T19:09:15Z
- **Completed:** 2026-06-05T19:17:00Z
- **Tasks:** 2 (both `type=auto`)
- **Files created:** 1 (RunStatusStrip.tsx)
- **Files modified:** 2 (RunCard.tsx + RunCard.test.tsx)

## Accomplishments

- **D-06 persistent timer (the ROOT vanish fix).** Replaced the `performance.now()` baseline + the streaming-gated effect AND the exact `{(isStreamingNow || elapsedMs > 0)}` render gate with a continuous wall-clock derivation: `startMs = Date.parse(message.created_at)`, `elapsedMs = (frozenEndRef.current ?? now) - startMs` recomputed each 250ms tick (only while streaming). The timer renders CONTINUOUSLY whenever `Number.isFinite(startMs)` — regardless of `isStreamingNow` or `elapsedMs` — and freezes ONCE at the streaming→terminal edge via `frozenEndRef`. Because elapsed is recomputed `now - start` each tick (not an accumulator), background-tab `setInterval` throttling only coarsens the tick — it can never freeze or skew the value. A `Number.isFinite` guard falls back to NOT rendering elapsed (never NaN) when `created_at` is missing/unparseable. This closes BUG-260528-01 (Kimi/Moonshot timer vanish) and, by reading `created_at`, REINFORCES the 083 temp-id→DB-id fix instead of regressing it.
- **The one `RunStatusStrip`.** New `frontend/src/components/chat/RunStatusStrip.tsx` — a single `⏱ {elapsed} · Step {N} · {activity}` inline-flex strip with a `placement: "header" | "floating"` prop (identical segment markup under two wrappers, per SKETCH-CONSISTENCY §B "one component, two homes"). The header placement is wired into the RunCard header this plan; the floating placement (bottom live-chip styling) is provided for Plan 04's scroll-away "↓ Jump to live" home. Reuse-only CSS (`font-mono`, `tabular-nums`, the `animate-dotBounce` activity dot, the `.done` success modifier — no new keyframes). XSS-safe: the activity verb (`outerBannerLabel`, a controlled enum-derived string) renders as React text children, no `dangerouslySetInnerHTML`.
- **D-04 unified count across all three RunCard sites.** The header title (`Run · N steps`), the RunStatusStrip `Step N`, and the collapsed-row (`N steps`) ALL read `unifiedStepCount(message)` — the deduped, persisted count from Plan 01. They can never disagree. Relabeled "N tools"/"N tool calls" → "N steps" per the sketch. `iterationCount` is destructured to a panel-only alias so the ToolCallPanel Round-N divider still works, but no visible step number reads it. Because the count derives from the persisted `tool_calls` (which a DB reload reconstructs) and not the reload-omitted `iterationCount`, the step label now survives a next-day reopen (RESEARCH correction #5) and is cross-provider-safe.

## Task Commits

1. **Task 1 (artifact): the one RunStatusStrip** — `b9548e55` (feat) — `frontend/src/components/chat/RunStatusStrip.tsx`
2. **Tasks 1+2 (wiring): D-06 timer + D-04 unify all 3 count sites + tests** — `8e1ac415` (feat) — `RunCard.tsx` + `RunCard.test.tsx`

The two plan tasks both edit overlapping regions of `RunCard.tsx` (the strip's `stepCount` prop depends on Task 2's `unifiedStepCount`), so the RunCard wiring landed as one cohesive commit; the new RunStatusStrip component (Task 1's distinct artifact) is its own commit.

**Plan metadata:** (final commit — docs: complete plan)

## Files Created/Modified

- `frontend/src/components/chat/RunStatusStrip.tsx` (NEW) — `export function RunStatusStrip({ elapsedLabel, stepCount, activityVerb, placement })`; one strip, two placement wrappers; plain-text children only.
- `frontend/src/components/chat/RunCard.tsx` — D-06 timer derivation (created_at baseline, continuous render, frozenEndRef freeze, NaN guard, `formatElapsed` Xm Ys helper); D-04 `stepCount = unifiedStepCount(message)` driving the header title + collapsed-row + the hosted RunStatusStrip; the perf.now timer, the vanish gate, and the standalone `stepLabel` subtitle removed.
- `frontend/src/components/chat/RunCard.test.tsx` — 7 new cases (zero-elapsed-no-vanish, freeze-at-terminal, unparseable-created_at NaN guard, verb-streaming-only-then-gone, three-sites-agree-N≠M, DB-loaded-no-iterationCount-still-shows-Step-N) + 2 stale assertions retargeted.

## Decisions Made

- **`created_at`, not `performance.now()`** — the stable wall-clock baseline survives the 083 remount; using it REINFORCES BUG-260526-04 rather than regressing it (RESEARCH A2: the reconcile placeholder sets `created_at = run.started_at`).
- **Continuous render, freeze-once** — the vanish gate is removed entirely; `frozenEndRef` captures the freeze instant exactly once on the streaming→terminal edge (with a defensive re-arm if a remount re-enters streaming).
- **`panelIterationCount` alias** — `iterationCount` is destructured to a panel-only local and forwarded to ToolCallPanel's Round-N divider, so the in-panel iteration boundary still renders while no visible RunCard step number reads `message.iterationCount` (acceptance grep = 0).
- **Steps relabel + stale-test retarget** — relabeled the copy and retargeted the two assertions that asserted the OLD iterationCount-based "Step 5" and "3 tool calls" copy (Rule 1 — the relabel made them stale, the same maintenance pattern Plan 01 used).
- **Two comment rewordings** — two comment lines originally contained the literal tokens `elapsedMs > 0` (in prose describing the old gate) and `message.iterationCount`; reworded so the acceptance greps (`elapsedMs > 0` == 0, `message.iterationCount` == 0) stay literally clean — behavior unchanged.

## Deviations from Plan

None — plan executed exactly as written. The two stale-test retargets and the two comment rewordings are documentation/test-maintenance adjustments caused by the relabel/relocation the plan itself mandates (Rule 1), not behavioral deviations. No Rule 2/3/4 triggers.

## Authentication Gates

None.

## Deferred Issues

**Pre-existing frontend test flakiness (out of scope — NOT caused by this plan).** The full `npx vitest run` shows 17 failures across 7 files (`streamsProvider.test.tsx`, `streamsProvider_075_9_clientkey.test.tsx`, `StreamsProvider.dedup.test.ts`, `MessageItem.test.tsx`, `useMessages.test.ts`, `Plan04.frontend.test.tsx`, `model-info.test.ts`). **Proven pre-existing** by stashing all three of this plan's files and re-running: the same files fail identically on the clean baseline (15/15 on the first five files + 2/2 on the other two = the full 17). None reference RunCard/RunStatusStrip/stepCount. These are the documented flaky StreamsProvider/timing baseline cluster (project memory `project_e2e_suite_rotted`); not touched, not fixed here. This plan adds ZERO net-new failures.

## Known Stubs

None. The `placement="floating"` styling on RunStatusStrip is intentionally provided-but-not-yet-mounted — that is the plan's explicit forward contract ("this plan wires the header placement; Plans 03/04 reuse the floating placement"). The component + both placements are complete and correct; mounting the floating chip is Plan 04's scroll-away work. Tracked, intentional, resolved by the named downstream plan.

## User Setup Required

None.

## Next Phase Readiness

- **Plan 03/04 unblocked.** RunStatusStrip exists with the floating placement ready; the D-06 timer + D-04 count are live on RunCard. Plan 04 imports `RunStatusStrip` with `placement="floating"` for the bottom Jump-to-live chip.
- **Verification clean:** RunCard suite 23/23; `tsc -b` = 37 (baseline unchanged, zero net-new — zero errors reference the modified files); `vite build` exit 0 (only the pre-existing chunk-size advisory). All acceptance greps pass (perf.now=0, `elapsedMs > 0`=0, created_at≥1, RunStatusStrip export=1, placement≥1, no dangerouslySetInnerHTML, `message.iterationCount`=0, `unifiedStepCount`=5, PANEL-06 panel-store reads=0).
- **083 non-regression held:** MessageList `key={run-${msg.runId}}` untouched (file not edited); RunCard reads `created_at` not perf.now.

## Self-Check: PASSED

- Files: `RunStatusStrip.tsx` + `RunCard.tsx` + `RunCard.test.tsx` + this SUMMARY.md FOUND on disk.
- Commits: `b9548e55` (RunStatusStrip) + `8e1ac415` (RunCard wiring + tests) FOUND in git log.
- Tests: RunCard 23/23 green.
- `tsc -b` = 37 (zero net-new); `vite build` exit 0.
- Full-suite 17 failures all proven pre-existing on the clean baseline (stash-and-rerun).

---
*Phase: 095-chat-tool-card-unification*
*Completed: 2026-06-05*
