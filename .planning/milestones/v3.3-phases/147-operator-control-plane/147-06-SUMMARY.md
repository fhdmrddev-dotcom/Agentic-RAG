---
phase: 147-operator-control-plane
plan: 06
subsystem: ui
tags: [react, typescript, api-client, admin, control-plane, chat-display, vitest]

# Dependency graph
requires:
  - phase: 146-operator-foundation
    provides: "BackpressureSignals + getBackpressure/getOperatorAudit envelope-unwrap idiom in api.ts; the /admin router 404-gate posture"
  - phase: 147-01
    provides: "FullSettingsResponse gains self_improve_enabled/workflows_enabled/maintenance_mode + /health maintenance boolean (backend contract this client reads)"
  - phase: 147-02
    provides: "GET /admin/runs {runs:[]} + POST /admin/runs/{id}/kill + POST /admin/control-plane/record (backend this client calls)"
  - phase: 147-03
    provides: "PUT /admin/flags write endpoint (backend this client calls)"
provides:
  - "Control Plane frontend client contract: ActiveRun type, FlagKey union, additive BackpressureSignals.dependencies"
  - "Client fns: getAdminActiveRuns / killRun / setFlag / recordControlPlaneEvent / getMaintenanceStatus"
  - "FullAppSettings extended with the 3 net-new flag booleans (Control Room grid flag-read source)"
  - "BUG-260710-01/-02 closed: persistent cancelled-run honesty (render-derive) — the D-03 victim self-cancel display"
affects: [147-07, 147-08, 147-09, ActiveRunsSection, CapabilityGrid, MaintenancePanel, ControlRoomPage, HealthSignals, maintenance-banner]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-only client type extension (optional dependencies field; back-compat with a backend that has not shipped the field yet)"
    - "Envelope-unwrap client fn (getAdminActiveRuns unwraps {runs:[]} like getOperatorAudit unwraps {entries:[]})"
    - "Public /health flag read for a non-admin surface (end users are 404 on /admin — the banner reads the public probe)"
    - "Render-derive of persistent lifecycle state from the already-persisted runStatus — no shared streaming-path fork (G-5 hot file safe)"

key-files:
  created:
    - frontend/src/components/chat/__tests__/MessageItem.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/chat/MessageItem.tsx

key-decisions:
  - "Content-gated the new cancelled clause on the bottom stopped-indicator (runStatus==='cancelled' && !!content) so an empty early-cancel gets ONLY the 'cancelled — no output yet' affordance, never a double indicator"
  - "getMaintenanceStatus swallows all errors → false (best-effort, never falsely announce maintenance; also tolerates a backend that has not yet shipped the /health field)"
  - "New MessageItem test lives at src/components/chat/__tests__/MessageItem.test.tsx (co-located), separate from the pre-existing src/__tests__/components/MessageItem.test.tsx"

patterns-established:
  - "Additive-optional client type extension keeps a shipped-before-backend client type-safe"
  - "Render-only lifecycle honesty derives from persisted runStatus (survives reload) without touching StreamsProvider/useMessages"

requirements-completed: [ADMIN-02]

# Metrics
duration: 15min
completed: 2026-07-11
---

# Phase 147 Plan 06: Control Plane Client Contract + Cancelled-Run Honesty Summary

**Extended `lib/api.ts` with the Control Plane types + client fns every Wave-2/3 admin component consumes, and fixed BUG-260710-01/-02 so an operator-Kill victim sees exactly a self-cancel (D-03) — a persistent "Response stopped" indicator across reload and an honest "cancelled — no output yet" affordance on an empty early cancel — both render-only in the G-5 hot file.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-11T08:29Z
- **Completed:** 2026-07-11T08:44Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- `BackpressureSignals` gains an optional additive `dependencies` field (redis/supabase/sandbox `up|down|off` + latency) — the 4 existing fields stay byte-identical (D-078-08).
- New `ActiveRun` interface (`not_responding` server-derived stalled signal, `killable`, unix `started_at` for client-side elapsed math) + `FlagKey` union.
- Five client fns wired to the Wave-2/3 backend contract: `getAdminActiveRuns` (unwraps `.runs`), `killRun`, `setFlag`, `recordControlPlaneEvent`, and `getMaintenanceStatus` (reads the PUBLIC `/health` boolean — the non-admin banner source).
- `FullAppSettings` extended with `self_improve_enabled` / `workflows_enabled` / `maintenance_mode` (the Control Room grid's flag-read source via existing `getSettings()`, no new flags GET).
- BUG-260710-01 closed: the stopped indicator now derives from `runStatus==='cancelled'` so it persists across reload (it was tied to live-only `message.stopped`).
- BUG-260710-02 closed: an empty-content cancelled row renders "cancelled — no output yet" instead of an avatar-only broken bubble.
- 3 durable Vitest cases (empty-cancel affordance, persistent Response-stopped, completed-message regression) — all green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend api.ts with the Control Plane contract (types + client fns)** — `75438335` (feat)
2. **Task 2: Fix BUG-260710-01/-02 — persistent cancelled honesty in MessageItem (render-only, G-5 safe)** — `8f0c0179` (fix)

_Note: Task 2's commit also carries the new test file + the deferred-items.md scope-boundary note._

## Files Created/Modified
- `frontend/src/lib/api.ts` — additive `BackpressureSignals.dependencies`; `ActiveRun` + `FlagKey`; `getAdminActiveRuns`/`killRun`/`setFlag`/`recordControlPlaneEvent`/`getMaintenanceStatus`; `FullAppSettings` + 3 flag booleans.
- `frontend/src/components/chat/MessageItem.tsx` — two render-only edits: the stopped-indicator guard now includes a content-gated `runStatus==='cancelled'` clause; a new `runStatus==='cancelled'` branch in the content ternary renders the empty-cancel affordance.
- `frontend/src/components/chat/__tests__/MessageItem.test.tsx` (NEW) — the 3 cancelled-honesty regression cases.
- `.planning/phases/147-operator-control-plane/deferred-items.md` (NEW) — logs the pre-existing SEED-056 rot found out of scope.

## Decisions Made
- **Content-gated the bottom stopped-indicator's cancelled clause** (`runStatus==='cancelled' && !!message.content`). Without the gate, an empty early-cancel would show BOTH "cancelled — no output yet" (content region) AND "Response stopped" (bottom) — a redundant double. The gate routes each cancel state to exactly one honest affordance. The pre-existing `message.stopped` term is untouched, so all prior behavior is byte-identical.
- **`getMaintenanceStatus` is best-effort, unauthed, fails to `false`.** End users are 404 on `/admin/*`, so the app-shell banner must read the public `/health` probe. Any failure (or a backend that has not yet shipped the additive `maintenance` field) resolves to `false` — the banner never falsely announces maintenance.
- **Additive-optional typing.** `dependencies` is `?` and the client tolerates a `/health` without `maintenance`, so this client is type-safe even though it ships in the same wave as (not strictly after) the backend fields it reads.

## Deviations from Plan

None — plan executed exactly as written. The one design refinement (content-gating the cancelled clause to prevent a double indicator) is within Task 2's stated behavior ("no double") and the plan's "matching the existing stopped-indicator styling" guidance, not a scope change.

## Issues Encountered
- **Pre-existing test rot (SEED-056), out of scope.** `npm run test -- MessageItem` also matches the older `src/__tests__/components/MessageItem.test.tsx`, whose `shows thinking indicator when streaming with empty content` case fails on `getByText(/thinking/i)`. Verified pre-existing by stashing this plan's `MessageItem.tsx` edit and re-running (the failure reproduces on untouched source). The failing branch (streaming, empty content) is evaluated before — and unaffected by — this plan's new cancelled branch. Logged to `deferred-items.md`; not fixed per the plan's acceptance note.

## User Setup Required
None — no external service configuration required. (The backend endpoints/columns/`/health` field this client calls are delivered by sibling plans 147-01/02/03 and their migration 097.)

## Known Stubs
None — every new client fn is wired to a real backend endpoint (delivered by sibling Wave-2/3 plans); the two MessageItem fixes render live persisted `runStatus`, no placeholder data.

## Next Phase Readiness
- The Wave-2/3 admin components (`ActiveRunsSection`, `CapabilityGrid`, `MaintenancePanel`, recomposed `ControlRoomPage`, `HealthSignals` dependency dots, and the end-user maintenance banner) can now import their client contract directly from `api.ts`.
- The D-03 victim self-cancel display is honest across reload and on empty early cancel — the operator-Kill path (Plan 147-02/04) can rely on it with zero new shared render surface.
- No blockers.

## Self-Check: PASSED

- Files verified present: `api.ts`, `MessageItem.tsx`, `MessageItem.test.tsx`, `147-06-SUMMARY.md`, `deferred-items.md`.
- Commits verified: `75438335` (Task 1), `8f0c0179` (Task 2).

---
*Phase: 147-operator-control-plane*
*Completed: 2026-07-11*
