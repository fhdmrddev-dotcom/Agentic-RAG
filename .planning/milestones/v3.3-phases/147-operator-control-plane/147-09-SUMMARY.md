---
phase: 147-operator-control-plane
plan: 09
subsystem: ui
tags: [react, admin, operator, control-plane, vitest, polling, maintenance-banner]

# Dependency graph
requires:
  - phase: 147-06
    provides: "api.ts client seam — getBackpressure/getAdminActiveRuns/killRun/setFlag/getSettings/recordControlPlaneEvent/getMaintenanceStatus + ActiveRun/BackpressureSignals/FlagKey/FullAppSettings types"
  - phase: 147-07
    provides: "HealthSignals (dependency dots) + ActiveRunsSection (victim-naming Kill, no optimistic removal)"
  - phase: 147-08
    provides: "CapabilityGrid (armed-OFF switches + impactCounts) + MaintenancePanel (arm-to-confirm)"
provides:
  - "Recomposed ControlRoomPage — D-08 five-tab band IA (Overview promoted to live Control Plane landing tab)"
  - "The 063-B composed scroll: pinned vitals -> Health -> Active runs -> Controls -> Activity, from the plan-07/08 leaves"
  - "D-07 poll/visit discipline: one visit-row on mount, silent ~10s auto-poll that pauses on hidden tab, manual refresh records"
  - "End-user app-wide maintenance banner outside /admin, sourced from the public /health flag"
affects: [148-users-access, 149-model-registry, 150-secrets, operator-control-plane-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shell owns fetch/poll/state, threads it to presentational leaves (ActiveRunsSection/CapabilityGrid/MaintenancePanel)"
    - "setInterval + visibilitychange-pause auto-poll with an alive-ref unmount guard; silent (floor-exempt) polls vs one deliberate visit/refresh record"
    - "Factory-mock @/lib/api in the ControlRoomPage test (only runtime-used fns; types are erased); fake-timers + advanceTimersByTimeAsync for the hidden-tab poll assertion"

key-files:
  created:
    - frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx
  modified:
    - frontend/src/components/admin/ControlRoomPage.tsx
    - frontend/src/App.tsx

key-decisions:
  - "Locked-tab descriptions name the arriving capability (Users & Access / Model Registry / Secrets) with NO phase number in body copy (T-146-10)"
  - "Flags read via the existing getSettings() — no new flags GET endpoint (checker-narrowed contract)"
  - "impactCounts supplies ONLY workflows_enabled (active workflow-run count) and only once runs has loaded — never a fabricated number"
  - "Maintenance banner is a fixed top strip (byte-identical DOM when OFF; ChatLayout stays h-screen, unedited — G-5 additive)"

patterns-established:
  - "D-07 poll/visit: silent auto-poll GETs never record; only the mount visit-row and the manual refresh write to the ledger"
  - "End-user public-flag banner: read /health, never /admin (end users are 404 there)"

requirements-completed: [ADMIN-02, FLAG-01]

# Metrics
duration: ~25min
completed: 2026-07-11
---

# Phase 147 Plan 09: Control Plane Assembly Summary

**Recomposed ControlRoomPage into the live five-tab Control Plane (D-08) — the 063-B pinned-vitals scroll wiring the plan-07/08 leaves with D-07 silent auto-poll + one visit-row — plus an app-wide end-user maintenance banner sourced from the public /health flag.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-11T10:23:00Z (approx)
- **Completed:** 2026-07-11T10:48:17Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- Promoted the 146 "Overview" tab into the live **Control Plane** landing tab and re-authored the band-tab IA to the sketch-066 five tabs (Control Plane · Users & Access 🔒 · Model Registry 🔒 · Secrets 🔒 · Audit log). "System Controls" dissolves into the body; "AI Models"/"API Keys" became the renamed locked tabs. Health lives in exactly one place.
- Composed the locked **063-B scroll** from the shipped leaves: a sticky pinned-vitals header (amber/red-capable, hosting ⌥ Technical names + ↻ Refresh) → `HealthSignals` → `ActiveRunsSection` → `CapabilityGrid` + separate `MaintenancePanel` → the Activity ledger with **"View all ›" → Audit tab**.
- Wired the **D-07 poll/visit discipline** replacing the 146 one-shot read: one `recordControlPlaneEvent("visit")` on mount, a silent ~10s `setInterval` auto-poll of backpressure + active-runs that **pauses on `visibilitychange` (hidden)** and clears on unmount (alive-ref guard preserved), and a manual ↻ that re-fetches + records `"refresh"` + pulses the band marker. Kill/flag/maintenance writes re-fetch the affected data.
- Mounted an app-wide **end-user maintenance banner** at the App/ChatLayout seam, reading the public `/health` `maintenance` flag via `getMaintenanceStatus()` — never an `/admin` route (T-147-15). Renders nothing when OFF (byte-identical DOM) or on any read failure.

## Task Commits

Each task was committed atomically:

1. **Task 1: Recompose ControlRoomPage (D-08 promote + 063-B scroll + D-07 poll/visit + tests)** — `19cddc30` (feat)
2. **Task 2: End-user maintenance banner (outside admin, public /health flag)** — `6876770d` (feat)

## Files Created/Modified
- `frontend/src/components/admin/ControlRoomPage.tsx` — Recomposed shell: five-tab IA, composed 063-B scroll, D-07 auto-poll + visit/refresh recording, Kill/flag/maintenance handlers, getSettings()-sourced flags, workflows-only impactCounts.
- `frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx` — 6 tests: five-tab IA + Overview-promoted landing, composed scroll (Health/Active runs/switches/Platform state), exactly-one-visit + no-record-on-poll, hidden-tab poll pause (fake timers), "View all ›" → Audit, honest locked-tab refusal (no phase number).
- `frontend/src/App.tsx` — `MaintenanceBanner` (public-/health poll, fixed amber strip, resilient default) mounted above ChatLayout.

## Decisions Made
- **Fixed-strip maintenance banner (not an in-flow wrapper).** ChatLayout's root is `flex h-screen`; wrapping it in a flex column would push its 100vh past the viewport. A `fixed top-0` strip keeps the OFF path byte-identical and avoids editing ChatLayout (G-5 additive route wiring only). Standard maintenance-bar pattern for a rare, deliberately-disruptive state.
- **Flag defaults `?? true` while settings load** — keeps the CapabilityGrid byte-identical to "everything enabled" before the fetch resolves; not a stub (real values arrive from `getSettings()`).
- **impactCounts only for workflows, only when `runs != null`** — honors the 147-08 checker-narrowed contract (ActiveRun carries no per-run tool signal); no fabricated numbers.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Both leaves and the api.ts seam were already built and committed on `develop`; this was pure wiring. The one design constraint (ChatLayout's hardcoded `h-screen` vs. an in-flow banner) was resolved with a fixed strip so the OFF path stays byte-identical — noted under Decisions, not a deviation.

## Verification
- `npm run test -- ControlRoomPage` → **6/6 green**; full `src/components/admin` suite → **22/22 green** (ControlRoomPage 6 + ActiveRunsSection 10 + CapabilityGrid 6 — no regression).
- `npx tsc --noEmit` → **ControlRoomPage.tsx and App.tsx both clean** (no new errors).
- Acceptance greps: `getSettings` used in ControlRoomPage (no new flags GET); retired tab labels appear only in the header comment, never in the TABS array; `getMaintenanceStatus` used in App.tsx with "read-only" copy and **zero** `/admin` client-fn calls (all `/admin` matches are comment prose).

## Known Stubs
None — all surfaces wire real data (`getSettings`/`getBackpressure`/`getAdminActiveRuns`/`getOperatorAudit`/`getMaintenanceStatus`). The locked-tab "coming soon" copy is intentional design; those tabs light up in Phases 148 (Users & Access), 149 (Model Registry), and 150 (Secrets).

## User Setup Required
None - no external service configuration required (all backend endpoints + migration 097 landed in prior waves).

## Next Phase Readiness
- Wave 3 assembly complete: the three sketch winners read as one Control Plane instrument (sketch 066).
- Ready for phase verification / live UAT: mount the Control Plane (expect exactly one "Opened the Control Plane" ledger row), scroll (pinned vitals stay pinned, can go amber/red on a poll), hide the tab (polling pauses), flip a capability/maintenance (writes record + re-fetch), and confirm the end-user banner appears for a non-operator when maintenance is ON.
- The locked Users & Access / Model Registry / Secrets tabs are the honest entry points for Phases 148/149/150.

## Self-Check: PASSED

- FOUND: `frontend/src/components/admin/ControlRoomPage.tsx`
- FOUND: `frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx`
- FOUND: `frontend/src/App.tsx`
- FOUND: `.planning/phases/147-operator-control-plane/147-09-SUMMARY.md`
- FOUND commit: `19cddc30` (Task 1)
- FOUND commit: `6876770d` (Task 2)

---
*Phase: 147-operator-control-plane*
*Completed: 2026-07-11*
