---
phase: 147-operator-control-plane
plan: 07
subsystem: ui
tags: [react, tailwind, shadcn, lobehub-icons, admin, operator, active-runs, kill-run, health-probes, presentational-leaf]

# Dependency graph
requires:
  - phase: 147-06
    provides: "lib/api.ts Control Plane client contract — ActiveRun type (incl. not_responding), killRun, getAdminActiveRuns (.runs unwrap), BackpressureSignals.dependencies"
  - phase: 146
    provides: "the /admin shell + HealthSignals presentational leaf + OperatorBand amber-band idiom + status-dot pattern"
provides:
  - "HealthSignals extended with a dependency-health row (Redis / Database / Code sandbox) rendering honest up/slow/down/off status dots"
  - "ActiveRunsSection — the 064-B live active-runs surface: cross-provider run cards, live-ticking elapsed, kind badges, victim-naming confirm-sheet Kill, honest Cancelling→Cancelled (no optimistic removal), calm empty/null states"
affects: [147-09, control-room-page, admin-shell, operator-control-plane]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentational-leaf discipline: props in, DOM out; null → calm dimmed placeholder; the shell owns fetch/poll/state (mirrors HealthSignals/OperatorBand)"
    - "Client-side live-elapsed tick: seed from unix started_at, setInterval(1s) cleared on unmount, reads Date.now() (D-07 — no server poll to tick)"
    - "Honest async-cancel two-state: no optimistic removal — the killed card stays and overlays Cancelling…→Cancelled in place; the stalled-run branch reads 'recovered a stuck run'"
    - "Victim-naming destructive-confirm via the existing Radix Sheet primitive (who / model / elapsed named before the action fires)"

key-files:
  created:
    - "frontend/src/components/admin/ActiveRunsSection.tsx"
    - "frontend/src/components/admin/__tests__/ActiveRunsSection.test.tsx"
  modified:
    - "frontend/src/components/admin/HealthSignals.tsx"

key-decisions:
  - "Zombie-heal wording derived from the SERVER-derived not_responding boolean captured at Confirm time (killedStuck) — not_responding is the honest client-visible proxy for the stalled/zombie-heal path; killRun():Promise<void> carries no terminal reason, so this is a legitimate derivation, not a client-side guess"
  - "Slow (amber) dependency state is a client derivation from latency_ms > 500ms while state==='up'; the wire only carries up/down/off — slow/unknown are display-only"
  - "Reused the shared providerLogo(@lobehub) resolver + Bot fallback exactly as the chat RunCard does — never placeholder art (RDD 43 / ICON CONVENTION)"

patterns-established:
  - "Dependency-health dot: off/unknown are NEUTRAL (muted), never destructive — a deliberately-disabled sandbox is grey + 'off by config' (Pitfall 6)"
  - "Per-card kill lifecycle (idle→cancelling→cancelled/error) owned locally so the card transitions in place; the parent runs[] list is never mutated"

requirements-completed: [ADMIN-02]

# Metrics
duration: 13min
completed: 2026-07-11
---

# Phase 147 Plan 07: Active-Runs & Health Monitoring Surfaces Summary

**Dependency-health dots (up/slow/down/off) on HealthSignals + the 064-B ActiveRunsSection — calm cross-provider run cards with live client-ticked elapsed, @lobehub provider marks, kind badges, a victim-naming confirm-sheet Kill, and honest Cancelling→Cancelled (no optimistic removal, stalled runs read "recovered a stuck run").**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-07-11T10:12Z
- **Completed:** 2026-07-11T10:25Z
- **Tasks:** 2
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- **HealthSignals dependency dots** — additive Redis / Database / Code sandbox probes read from `signals.dependencies` and render honest status dots: `up`→green, `up but latency>500ms`→amber "Slow", `down`→red, sandbox `state==="off"`→NEUTRAL grey + "off by config" (never red, Pitfall 6). Absent/null dependencies render a neutral "—" placeholder (older backend / loading) and never crash. The four backpressure signals + the `showTechnical` raw-field reveal are unchanged.
- **ActiveRunsSection (064-B)** — a presentational leaf (`{ runs, onKill }`) rendering each run as a calm card: real `@lobehub` provider mark (shared `providerLogo`, Bot fallback for unmapped), user (email or masked), model, a live-ticking elapsed (client math from `started_at`, 1s tick cleared on unmount — D-07), and a kind badge (chat/workflow/eval/tuner — D-01). `long-running` chip past 8 min (client math); highlighted `not responding` chip from the server-derived boolean.
- **Victim-naming Kill + honest cancel** — killable runs open a confirm Sheet naming who/model/elapsed ("End {user}'s run on {model}, {elapsed} in — cancels immediately, recorded with your name"); the run is NOT cancelled until Confirm. The killed card does NOT vanish — it overlays Cancelling… → Cancelled·recorded in place (no optimistic removal). A stalled (`not_responding`) run reads "Recovering a stuck run…" → "Cancelled · recovered a stuck run". Eval/tuner (`killable:false`) render no Kill and honest "Ends on its own" copy. Empty → calm "No runs in flight"; null → dimmed placeholder.
- **10 component tests green** covering killable-vs-bounded affordances, victim-naming (no immediate cancel), no-optimistic-removal, recovered-stuck wording, elapsed-from-started_at, empty state, not-responding tag both ways, long-running tag, provider-mark resolver vs Bot fallback, and null placeholder.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend HealthSignals with dependency-health dots** — `4f29413b` (feat)
2. **Task 2: ActiveRunsSection — 064-B cards + confirm-sheet Kill + honest cancel states** — `05222b3d` (feat, component + tests)

## Files Created/Modified

- `frontend/src/components/admin/HealthSignals.tsx` — added the additive dependency-health row (3 named probes + up/slow/down/off dot mapping + `off by config` neutral branch); four backpressure signals + `showTechnical` reveal preserved
- `frontend/src/components/admin/ActiveRunsSection.tsx` — new 064-B presentational leaf: run cards, live elapsed, kind badges, victim-naming confirm-sheet Kill, honest Cancelling→Cancelled/recovered, tags, empty/null states
- `frontend/src/components/admin/__tests__/ActiveRunsSection.test.tsx` — 10 tests locking the 064-B contract

## Decisions Made

- **Zombie-heal wording derived from `not_responding`.** The 064-B "recovered a stuck run" honesty must distinguish a clean cancel from a zombie-heal, but `killRun(): Promise<void>` (plan 06 contract) carries no terminal reason. `not_responding` is the SERVER-derived stalled-stream signal — the exact condition under which the backend's cancel path takes the zombie-heal branch — so capturing it at Confirm time (`killedStuck`) and using it for the terminal wording is an honest derivation, not a client-side guess. Documented so a future plan can swap to a killRun result reason if one is added.
- **"Slow" is a client derivation.** The wire `dependencies.*.state` is only `up|down|off`; a working-but-sluggish dependency (`state==="up"` with `latency_ms > 500`) is surfaced as amber "Slow" by the leaf. `slow`/`unknown` are display-only statuses, never wire values.
- **Reused `providerLogo` verbatim.** No hand-rolled logos — the same `@lobehub` resolver + Bot fallback the chat RunCard uses (ICON CONVENTION / RDD 43).

## Deviations from Plan

None — plan executed exactly as written. Both tasks implemented per the 064-B contract and the plan's presentational-leaf + interface constraints; zero new dependencies (@lobehub/icons + Radix Sheet already installed, matching threat register T-147-SC "accept: zero new deps").

## Issues Encountered

- **Two `export interface ActiveRun` in `frontend/src/lib/api.ts`** (legacy Phase-062 mirror at :231 with `started_at: string` + the Plan-147-06 admin shape at :3614 with `started_at: number`). TypeScript declaration-merges them; the project `tsc --noEmit` is GREEN at baseline and after this plan (confirmed by a throwaway `import type { ActiveRun }` probe resolving the admin fields with `started_at` usable as `number`), so the consumed type is correct today. It is a latent maintainability landmine (the two `started_at` types are structurally incompatible; a future edit could flip the merge into a hard `TS2717`). Out of scope for this plan (plan 07 only consumes the type; Wave-1 context says don't re-declare it) and not caused by this task — logged to `deferred-items.md` (§Plan 147-07) with a rename fix, not fixed here.

## Threat Flags

None — no new security surface. This plan is presentation-only over the already-404-gated `/admin` client contract (T-147-12 mitigation: Kill only calls the server-gated `killRun`; the client makes no trust decision). No new endpoints, auth paths, file access, or schema.

## User Setup Required

None — no external service configuration required. These are pure frontend leaves; the shell wiring (fetch/poll + `killRun` callback) lands in Plan 147-09 (ControlRoomPage recompose).

## Next Phase Readiness

- `HealthSignals` (dependency dots) and `ActiveRunsSection` are ready to mount in the Plan 147-09 ControlRoomPage recompose (063-B composition). The shell passes `signals` (already fetched via `getBackpressure`, now carrying `dependencies`), `runs` (via `getAdminActiveRuns`), and an `onKill={killRun}` callback down.
- Frontend `tsc --noEmit` clean; `ActiveRunsSection` tests 10/10 green.
- No blockers. Live SC#10 UAT for the Kill/run-state surface is owned by the phase VALIDATION.md (cross-provider × parallel-thread × long-message rows), exercised once the shell is wired in 147-09.

## Self-Check: PASSED

- FOUND: `frontend/src/components/admin/HealthSignals.tsx`
- FOUND: `frontend/src/components/admin/ActiveRunsSection.tsx`
- FOUND: `frontend/src/components/admin/__tests__/ActiveRunsSection.test.tsx`
- FOUND: `.planning/phases/147-operator-control-plane/147-07-SUMMARY.md`
- FOUND commit: `4f29413b` (Task 1 — HealthSignals dependency dots)
- FOUND commit: `05222b3d` (Task 2 — ActiveRunsSection + tests)

---
*Phase: 147-operator-control-plane*
*Completed: 2026-07-11*
