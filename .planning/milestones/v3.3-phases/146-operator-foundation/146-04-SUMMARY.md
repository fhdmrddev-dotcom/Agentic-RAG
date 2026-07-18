---
phase: 146-operator-foundation
plan: 04
subsystem: frontend-api
tags: [frontend, api-client, react-hook, operator-probe, 404-non-discoverable, vitest, control-room]

# Dependency graph
requires:
  - phase: 146-02 (operator gate + audit floor)
    provides: "live GET /admin/me (probe, floor-exempt) + GET /admin/backpressure + GET /admin/audit, all router-gated by require_operator (byte-identical 404 to non-operators)"
provides:
  - "getOperatorProbe(): OperatorIdentity|null — the 404→null probe that drives the D-07 non-discoverable nav (404 → render nothing)"
  - "getBackpressure(): BackpressureSignals — the four live health signals for the Control Room Overview"
  - "getOperatorAudit(limit?): OperatorAuditRow[] — the recent-actions ledger feed"
  - "OperatorIdentity / BackpressureSignals / OperatorAuditRow TypeScript types — the interface Plans 05 & 06 consume without re-exploring"
  - "useOperatorProbe(): one-shot mount probe hook exposing { isOperator, identity, loading } (render-only, not the security authority)"
affects: [146-05, 146-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "404→null probe idiom (getTunerLatest, api.ts:3388) reused for getOperatorProbe — a 404 is 'not an operator, render nothing', never a thrown error"
    - "Plain authed GET idiom (listThreads, api.ts:46) reused for getBackpressure + getOperatorAudit"
    - "One-shot fetch-on-mount hook (useSkills, useEffect + alive-ref) exposing a boolean render flag"
    - "Client render flag is NOT a security boundary — the backend 404 gate is the sole authority (Pitfall 13); documented in code comments on both api.ts and the hook"

key-files:
  created:
    - frontend/src/hooks/useOperatorProbe.ts
    - frontend/src/hooks/useOperatorProbe.test.ts
  modified:
    - frontend/src/lib/api.ts

key-decisions:
  - "getOperatorProbe copies the getTunerLatest 404→null idiom verbatim (res.status === 404 → return null) so a non-operator's probe yields null and the nav stays byte-identical (D-07)"
  - "The probe / hook decide RENDERING ONLY; a forged isOperator=true reaches no data because every /admin call is independently 404-gated server-side (Pitfall 13) — stated in comments on both files"
  - "getOperatorAudit takes an optional limit → ?limit= (encodeURIComponent), matching the /admin/audit feed contract"
  - "The hook treats any probe error (auth/network), not just 404/null, as isOperator=false — fail-closed for rendering; the backend gate is still the real authority"

requirements-completed: [ADMIN-01]

# Metrics
duration: 2min
completed: 2026-07-10
---

# Phase 146 Plan 04: Control Room Frontend Data Layer Summary

**The interface-first frontend data layer for the Control Room: `getOperatorProbe()` (the `getTunerLatest` 404→null idiom that drives the D-07 non-discoverable nav), `getBackpressure()` + `getOperatorAudit()` plain authed GETs, their three TypeScript types, and a one-shot `useOperatorProbe` hook exposing `{ isOperator, identity, loading }` — render-only, with the backend 404 gate documented as the sole authority (Pitfall 13).**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-10T22:05:50Z
- **Completed:** 2026-07-10T22:07:36Z
- **Tasks:** 2/2 (all auto)
- **Files modified:** 3 (2 created + 1 modified)

## Accomplishments

- **The probe (the D-07 keystone for the frontend):** `getOperatorProbe()` calls `GET /admin/me` and returns the `OperatorIdentity` on 200, `null` on 404 — copying the `getTunerLatest` 404→null idiom exactly (`res.status === 404 → return null`). A non-operator's probe yields `null`, so the nav renders nothing and stays byte-identical to today (non-discoverable contract). Any non-404 non-ok status throws `ApiError`.
- **The health + ledger GETs:** `getBackpressure()` (`GET /admin/backpressure` → the four raw signals) and `getOperatorAudit(limit?)` (`GET /admin/audit` → the recent-actions feed) are plain authed GETs on the `listThreads` idiom, both behind the router's 404 gate. `getOperatorAudit` threads an optional `limit` through `?limit=` (`encodeURIComponent`).
- **The interface Plans 05 & 06 consume:** `OperatorIdentity` `{id,email,granted_at}`, `BackpressureSignals` `{anyio_threadpool_depth:{borrowed,total}, redis_active_runs, postgres_pool_in_use, per_worker_run_count}`, and `OperatorAuditRow` `{id, action, label, is_write, target_type, target_id, created_at}` are all exported — Plans 05/06 wire the shell/nav against these without re-exploring the backend contract.
- **The one-shot probe hook:** `useOperatorProbe()` runs the probe once on mount (`useEffect` with an empty dep array + an `alive` ref guarding setState-after-unmount, matching the SkillStudioPage pattern) and returns `{ isOperator: identity !== null, identity, loading }`. Identity present → `isOperator` true; a `null`/404 (or any probe error) → `isOperator` false (fail-closed for rendering).
- **Security documented in code:** both `api.ts` and the hook carry a SECURITY NOTE stating the probe/flag decides RENDERING ONLY and the backend `require_operator` 404 gate is the sole authority — a forged `isOperator=true` reveals nothing and reaches no data (Pitfall 13 / T-146-06).
- **Contract test green (2/2):** `useOperatorProbe.test.ts` mocks `getOperatorProbe` and pins both branches — 200 → `isOperator` true + identity populated; `null` (404) → `isOperator` false + identity `null`, each asserting the probe fires exactly once.

## Task Commits

Each task was committed atomically:

1. **Task 1: api.ts — getOperatorProbe (404→null), getBackpressure, getOperatorAudit + types** — `f24792df` (feat)
2. **Task 2: useOperatorProbe hook + contract test** — `40a24096` (feat)

## Files Created/Modified

- `frontend/src/lib/api.ts` (modified) — added `OperatorIdentity`/`BackpressureSignals`/`OperatorAuditRow` types + `getOperatorProbe` (404→null), `getBackpressure`, `getOperatorAudit`, under a SECURITY NOTE header
- `frontend/src/hooks/useOperatorProbe.ts` (new) — one-shot mount probe hook, alive-ref guarded, render-only comment (Pitfall 13)
- `frontend/src/hooks/useOperatorProbe.test.ts` (new) — vitest contract test pinning 200→true / 404→false

## Decisions Made

- **404→null verbatim from getTunerLatest** — the probe reuses the shipped 404-branch idiom exactly so the non-operator path is a `null` resolve (render nothing), never a thrown error that a caller might surface. This is what makes the surface non-discoverable on the client (D-07).
- **Render-only, fail-closed** — the hook maps `identity !== null` → `isOperator`, and treats ANY probe rejection (auth/network as well as 404/null) as `isOperator=false`. Rendering fails closed; the backend gate remains the real authority (Pitfall 13).
- **Optional `limit` on the audit feed** — `getOperatorAudit(limit?)` matches the `/admin/audit` contract's optional cap; encoded via `encodeURIComponent`.
- **Test mocks the api module, not the network** — following the Wave-0 "no vitest hook-test analog" gap, the test `vi.mock`s `@/lib/api` and drives the two resolve branches, keeping it minimal and deterministic (no fetch/jsdom network).

## Deviations from Plan

None — plan executed exactly as written. Both tasks' actions, verifications, and acceptance criteria were met with no auto-fixes required (Rules 1–4 not triggered) and no authentication gates encountered.

## Issues Encountered

None during planned work. Verification note: the frontend vitest suite has ~14–17 pre-existing rotted failures in unrelated files (documented, SEED-056); per the SCOPE BOUNDARY rule those are out of scope. This plan's own gate — `npx vitest run src/hooks/useOperatorProbe.test.ts` — is green (2/2), and `tsc --noEmit` reports no error in `api.ts` or the hook.

## Known Stubs

None. All three api functions hit live, router-gated backend endpoints (Plan 02) and the hook wires a real probe. There is no hardcoded/mock data — the empty-render path is a deliberate `null` (the D-07 non-operator contract), not a placeholder.

## Threat Flags

None. The only security-relevant surface introduced is the client probe/flag, which is exactly the plan's `<threat_model>` register: T-146-06 (client-forged flag — mitigated by the independent server-side 404 gate; documented in code) and T-146-02 (probe distinguishing operator vs non-operator — the 404→null path emits no signal that the surface exists). No new trust boundary, no network endpoint, no package install (T-146-SC N/A).

## Next Phase Readiness

- **Plans 05 & 06 unblocked:** the `getOperatorProbe`/`getBackpressure`/`getOperatorAudit` functions, their `OperatorIdentity`/`BackpressureSignals`/`OperatorAuditRow` types, and the `useOperatorProbe` hook are the interface those plans consume to build the probe-gated shield (NavPanel), the ActiveView entry, and the ControlRoomPage shell (band + health + ledger).
- No blockers.

---
*Phase: 146-operator-foundation*
*Completed: 2026-07-10*

## Self-Check: PASSED

- Files: `frontend/src/lib/api.ts`, `frontend/src/hooks/useOperatorProbe.ts`, `frontend/src/hooks/useOperatorProbe.test.ts` all present
- Commits: `f24792df`, `40a24096` both found in git log
- Task 2 contract test 2/2 green; `tsc --noEmit` clean for api.ts + the hook
