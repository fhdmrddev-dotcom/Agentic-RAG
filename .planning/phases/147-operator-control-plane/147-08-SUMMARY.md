---
phase: 147-operator-control-plane
plan: 08
subsystem: ui
tags: [react, tailwind, shadcn, admin, operator, kill-switches, feature-flags, maintenance-mode, flag-01]

# Dependency graph
requires:
  - phase: 147-06
    provides: "lib/api setFlag(key, value), the FlagKey union, getMaintenanceStatus(), and FullAppSettings extended with self_improve_enabled/workflows_enabled/maintenance_mode"
provides:
  - "CapabilityGrid: a 2×2 armed-OFF capability kill-switch grid (web search / code sandbox / self-improvement / workflows) with direct-flip switches + concrete impact copy"
  - "MaintenancePanel: an amber Platform-state panel with arm-to-confirm maintenance and a present-tense consequence banner distinct from the ledger receipt"
affects: [ControlRoomPage recompose, 147-09 shell wiring, 065-A capability control surface, future capability switches]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Armed-OFF capability card (065-A): OFF = destructive tint + off-for-everyone tag + concrete impact line; ON = calm/neutral"
    - "Graded friction: capabilities flip directly (emergency speed); the platform-wide switch arms-to-confirm"
    - "Impact-copy honesty: count-based only where a count prop is honestly derivable (workflows); plain count-free fallback otherwise — never fabricates a number"
    - "Presentational-leaf discipline: props in, DOM out; the shell owns state + the setFlag write callback"

key-files:
  created:
    - frontend/src/components/admin/CapabilityGrid.tsx
    - frontend/src/components/admin/MaintenancePanel.tsx
    - frontend/src/components/admin/__tests__/CapabilityGrid.test.tsx
  modified: []

key-decisions:
  - "impactCounts is a Partial<Record<CapabilityKey, number>> keyed by flag key — only workflows_enabled is derivable today; other keys stay absent and fall back to count-free copy (no per-run tool signal exists)"
  - "The direct-flip switch is a native role=switch button (no ui/switch component exists) — aria-checked + aria-label = capability label; disabled during the async write"
  - "Cards expose data-capability + data-armed test hooks so the armed-OFF state is asserted structurally, not by brittle class matching"
  - "Maintenance arm-to-confirm wording is direction-aware (arms ON when off, back-online when on) so the prompt always names what is about to happen"

patterns-established:
  - "Armed-OFF weight: a kill-switch is not a preference — OFF carries destructive styling + tag + impact"
  - "Consequence ≠ receipt (062-A): the present-tense maintenance banner is a live-state truth, separate from the past-tense ledger row"

requirements-completed: [FLAG-01]

# Metrics
duration: 12min
completed: 2026-07-11
---

# Phase 147 Plan 08: FLAG-01 Capability Controls Summary

**2×2 armed-OFF CapabilityGrid (direct-flip kill-switches + count-honest impact copy) plus an amber arm-to-confirm MaintenancePanel with a present-tense consequence banner, built against the locked 065-A sketch.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-11T14:30:00Z
- **Completed:** 2026-07-11T14:34:00Z
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments
- `CapabilityGrid` — the four fail-closed capability switches as a 2×2 grid mirroring the HealthSignals grid leaf; OFF reads ARMED (destructive tint + "off for everyone" tag + a concrete impact line), ON reads calm/neutral, and switches flip directly with no confirm (065-A emergency speed).
- Impact copy honors the checker's WARNING-2 narrowing: count-based only where honestly derivable (the workflows switch's active-run count), plain count-free fallback for web/sandbox/self-improve — a number is never fabricated.
- `MaintenancePanel` — a spatially-separate amber Platform-state panel (distinction by location) that arms-to-confirm before flipping maintenance and raises a persistent present-tense read-only banner distinct from the past-tense ledger receipt (consequence ≠ receipt).
- 6 new CapabilityGrid tests + full admin suite (16/16) green; both components typecheck clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: CapabilityGrid — 2×2 armed-OFF switches + concrete impact copy (direct flip)** - `1c018c17` (feat)
2. **Task 2: MaintenancePanel — amber Platform-state panel, arm-to-confirm, consequence banner** - `872073e3` (feat)

_Plan metadata commit follows this summary._

## Files Created/Modified
- `frontend/src/components/admin/CapabilityGrid.tsx` - 2×2 armed-OFF capability grid; direct-flip role=switch controls calling onToggle(key, invertedValue); count-honest impact copy; showTechnical raw-key reveal.
- `frontend/src/components/admin/MaintenancePanel.tsx` - amber Platform-state panel; arm-to-confirm maintenance flip; direction-aware prompt; persistent present-tense consequence banner while ON.
- `frontend/src/components/admin/__tests__/CapabilityGrid.test.tsx` - 6 tests: four switches render, direct-flip (no dialog) with inverted value, armed count-based impact, plain fallback with no fabricated number, calm ON card, technical-name reveal.

## Decisions Made
- Keyed `impactCounts` by `CapabilityKey` (the flag-key union) rather than short slugs, so the shell can pass `{ workflows_enabled: n }` straight from its active-run count without a mapping layer.
- Built the switch as a native `role="switch"` button (no `ui/switch` primitive exists in the shadcn set); ON tints the track primary/neutral, OFF tints it destructive, and the card carries the heavier armed weight.
- Added `data-capability` / `data-armed` attributes as stable structural test hooks so the armed-OFF assertion does not depend on exact Tailwind class strings.
- Left both components unwired to the shell — they are presentational leaves; `ControlRoomPage` recompose + `setFlag` wiring belongs to the shell plan (147-09), matching the PATTERNS presentational-leaf discipline.

## Deviations from Plan

None - plan executed exactly as written. The prop shape sketched as `impactCounts: { sandbox?: number, ... }` was implemented as `Partial<Record<CapabilityKey, number>>` (the "..." open-partial the plan indicated), with only the honestly-derivable workflows count exercised.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. These are presentational components consuming the already-live 147-06 client contract.

## Next Phase Readiness
- `CapabilityGrid` + `MaintenancePanel` are ready for the ControlRoomPage recompose (147-09): the shell supplies `flags` from its settings fetch, `impactCounts.workflows_enabled` from the active-run count, `onToggle`/`onSetMaintenance` wired to `setFlag`, and threads `showTechnical` down.
- No blockers. Both leaves are pure props-in/DOM-out and carry no fetch or auth logic (the server-side require_operator gate + PUT /admin/flags allowlist remain the sole authority boundary).

## Self-Check: PASSED

- Files verified on disk: CapabilityGrid.tsx, MaintenancePanel.tsx, CapabilityGrid.test.tsx, 147-08-SUMMARY.md — all FOUND.
- Commits verified in git log: `1c018c17` (Task 1), `872073e3` (Task 2) — all FOUND.

---
*Phase: 147-operator-control-plane*
*Completed: 2026-07-11*
