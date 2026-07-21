---
phase: 166-org-admin-shell-org-switcher-profile-menu-anchor
plan: 02
subsystem: ui
tags: [react, context-provider, multi-tenancy, org-admin, streams, vitest, tdd]

# Dependency graph
requires:
  - phase: 166-01-org-admin-backend
    provides: GET /org/me {org_id, role, can_manage, can_audit_view, memberships[]} + server-validated X-Org-Id + /org/members + /org/audit
  - phase: 067.5-streams-per-thread
    provides: the clearThreadBucket Branch-D3 guard (!sendingThreadsRef.current.has(tid) mid-stream predicate)
  - phase: 146-operator-control-room
    provides: useOperatorProbe / useEffectiveFeatures fail-closed probe pattern + TechnicalNamesProvider context shape
provides:
  - OrgProvider (active org + memberships + role + canManage/canAuditView + switchOrg) mounted OUTSIDE StreamsProvider
  - useOrg (throwing) + useOrgOptional (leaf) context accessors
  - useOrgPermissionsProbe — fail-closed per-session probe re-keyed on userId AND activeOrgId
  - X-Org-Id header auto-injection in api.ts getAuthHeaders (zero call-site churn) + getActiveOrgId/setActiveOrgId seam
  - getOrgPermissions / getOrgMembers / getOrgAudit typed API fns (OrgPermissions/OrgMember/OrgAuditPage)
  - StreamsProvider org-switch teardown effect reusing the 067.5 guarded clearThreadBucket
  - ActiveView union extended with "org-admin"
affects: [166-03-org-admin-shell, 166-04-members-audit-tabs, 166-05-profile-menu, 167-invitations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "X-Org-Id module-level read in getAuthHeaders: every authed call auto-carries the active org with zero call-site churn; server re-validates (D-166-06)"
    - "OrgProvider-above-StreamsProvider (D-166-07): the outer org context bridges the switch into the inner streams teardown via useOrgOptional"
    - "switchOrg sets the api header SYNCHRONOUSLY before flipping state so any activeOrgId-keyed child effect targets the NEW org (D-166-08)"
    - "Org-switch stream teardown loops the EXISTING 067.5-guarded clearThreadBucket across surfaces — never a new bucket-wipe path (G-5 hot file)"

key-files:
  created:
    - frontend/src/providers/OrgProvider.tsx
    - frontend/src/hooks/useOrgPermissionsProbe.ts
    - frontend/src/providers/OrgProvider.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/App.tsx

key-decisions:
  - "The org-switch teardown does NOT re-reconcile the stale viewed thread: a fetch of the OLD thread under the NEW X-Org-Id header could re-populate old-org data. The teardown aborts in-flight subscriptions + clears buckets; the reconcile-to-new-org is the ChatLayout thread-list refetch (Plan 05) + per-thread reconcile on navigation. Isolation boundary = the server-validated fetch (D-v2.5-03)."
  - "api.ts seeds _activeOrgId from localStorage at module load so the FIRST authed call after a reload already carries the rehydrated org; OrgProvider is the sole WRITER (localStorage + setActiveOrgId) and re-syncs on mount."
  - "OrgProvider runs the permissions probe INTERNALLY (single probe, keyed on userId+activeOrgId) — App does not double-host it this plan; the App-level probe for the NavPanel indigo shield is a later-plan concern."
  - "Composed-tree test renders the REAL StreamsProvider under OrgProvider (not OrgProvider in isolation) so the teardown effect actually fires and clearThreadBucket routing is observed end-to-end."

patterns-established:
  - "Org context mirrors the operator surface: useOperatorProbe → useOrgPermissionsProbe (fail-closed, render-only); TechnicalNamesProvider shape → OrgProvider"
  - "Hot-file (G-5) additive change: import useOrgOptional + one useEffect that loops the existing guarded action; the predicate line and sendingThreadsRef usage count (13) are byte-unchanged"

requirements-completed: [ADMIN-02, ADMIN-03]

# Metrics
duration: 30min
completed: 2026-07-21
---

# Phase 166 Plan 02: OrgProvider + Org-Switch Teardown + X-Org-Id Injection Summary

**The frontend org-context substrate — OrgProvider (active org + memberships + role + can_manage/can_audit_view + switchOrg) mounted OUTSIDE StreamsProvider, a fail-closed org-scoped permissions probe, X-Org-Id auto-injection on every authed call, and a G-5-safe org-switch stream teardown that reuses the shipped 067.5 clearThreadBucket guard.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-21T15:12:00Z (approx)
- **Completed:** 2026-07-21T15:42:03Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- **X-Org-Id injection (D-166-06):** `getAuthHeaders` now spreads `X-Org-Id` from a module-level active-org read (seeded from localStorage at load) — EVERY existing authed call auto-carries the header with zero call-site churn; the server re-validates it (Plan 01), so a forged/stale value reaches no data.
- **OrgProvider (D-166-07, ADMIN-03):** a TechnicalNamesProvider-shaped context exposing `{ activeOrgId, orgs, role, canManage, canAuditView, loading, switchOrg }` sourced from `GET /org/me`, mounted as the OUTERMOST wrapper above `<StreamsProvider>` in App.tsx. `useOrg()` (throws) + `useOrgOptional()` (leaf reads).
- **useOrgPermissionsProbe:** a near-verbatim clone of `useOperatorProbe`, re-keyed on `userId` AND `activeOrgId` (org-scoped perms re-probe on switch), fail-closed to `{ can_manage:false, can_audit_view:false, memberships:[] }` on any non-200 — render-only, the backend gate is the wall.
- **switchOrg teardown (D-166-08, ADMIN-02):** `switchOrg` syncs the api header SYNCHRONOUSLY then flips state; StreamsProvider's new additive effect (keyed on `activeOrgId`, read via `useOrgOptional`) aborts in-flight subscriptions and loops the EXISTING guarded `clearThreadBucket` across active surfaces — the `!sendingThreadsRef.current.has(tid)` predicate at line 1340 is byte-unchanged and the `sendingThreadsRef` usage count stays 13.
- **Org API client + types:** `getOrgPermissions` / `getOrgMembers` / `getOrgAudit` mirroring the Plan 01 backend contract exactly, with `OrgPermissions` / `OrgMembership` / `OrgMember` / `OrgMembersPage` / `OrgAuditRow` / `OrgAuditPage` types exported.
- **Composed-tree TDD test (5/5 green):** renders the REAL StreamsProvider under OrgProvider so the teardown is observed end-to-end (bucket cleared through the guard, header synced synchronously, localStorage persist/rehydrate, throwing vs optional accessor, 1-vs-2+ membership count).

## Task Commits

Each task was committed atomically:

1. **Task 1: X-Org-Id injection + org API fns + useOrgPermissionsProbe** - `1b781875` (feat)
2. **Task 2 (RED): failing composed-tree OrgProvider test** - `57513600` (test)
3. **Task 2 (GREEN): OrgProvider + switchOrg teardown + App mount** - `96fec51d` (feat)

_Task 2 is `tdd="true"`: the composed-tree test was committed failing (RED — module missing) then the implementation made it green (GREEN)._

## Files Created/Modified
- `frontend/src/lib/api.ts` - Module-level active-org (`getActiveOrgId`/`setActiveOrgId`, `ACTIVE_ORG_STORAGE_KEY`) seeded from localStorage; `getAuthHeaders` injects `X-Org-Id`; `getOrgPermissions`/`getOrgMembers`/`getOrgAudit` + org types.
- `frontend/src/hooks/useOrgPermissionsProbe.ts` - Fail-closed per-session org-permissions probe re-keyed on userId + activeOrgId (render-only; JSDoc security note).
- `frontend/src/providers/OrgProvider.tsx` - The org-context spine: state + localStorage persist/rehydrate + header sync + internal probe + `switchOrg`; `useOrg`/`useOrgOptional`.
- `frontend/src/providers/StreamsProvider.tsx` - Additive useEffect #5 (D-166-08): reads `useOrgOptional`, on a real switch aborts subscriptions + loops the existing guarded `clearThreadBucket`. Import of `useOrgOptional` added. Predicate + `sendingThreadsRef` count unchanged.
- `frontend/src/App.tsx` - Import + mount `<OrgProvider userId={user?.id ?? null}>` OUTSIDE `<StreamsProvider>`; `ActiveView` union extended with `"org-admin"`.
- `frontend/src/providers/OrgProvider.test.tsx` - Composed-tree suite (5 tests).

## Decisions Made
- **No stale-thread re-reconcile in the teardown.** Re-fetching the OLD viewed thread under the NEW `X-Org-Id` header could re-populate old-org data (breaking isolation). The teardown therefore aborts in-flight subscriptions (so no stale SSE frame repopulates a bucket) + clears buckets through the guard; the reconcile-to-new-org happens via ChatLayout's activeOrgId-keyed thread-list refetch (Plan 05) and the per-thread reconcile on navigation. The isolation boundary is the server-validated fetch (D-v2.5-03: Realtime is best-effort, never the boundary) — consistent with threat T-166-06.
- **api.ts seeds the active org from localStorage at module load** so the first authed call after a page reload already carries the rehydrated `X-Org-Id`, before OrgProvider's mount effect re-syncs it. OrgProvider remains the sole WRITER (localStorage + `setActiveOrgId`), keyed off the single `ACTIVE_ORG_STORAGE_KEY` exported from api.ts.
- **OrgProvider hosts the probe internally** (one probe, keyed on userId+activeOrgId). The App-level probe host for the NavPanel indigo rail shield (per PATTERNS) is deferred to the later UI plan; this plan only needs the context data layer.

## Deviations from Plan

None - plan executed exactly as written. The two load-bearing beats (X-Org-Id injection D-166-06, and the org-switch teardown reusing the 067.5 guard D-166-08) landed as specified; the StreamsProvider change is additive-only (39 insertions, 0 deletions) and the guard predicate is byte-unchanged.

## Issues Encountered
- **`sendingThreadsRef` grep count briefly went to 14.** My explanatory comment in the new StreamsProvider effect contained the literal token `!sendingThreadsRef.current.has(tid)`, which tripped the acceptance grep `grep -c "sendingThreadsRef" == 13`. Reworded the comment to reference the predicate by line (`:1340`) without the literal token — count is back to exactly 13; the guard code is untouched.

## User Setup Required
None - no external service configuration required. No new packages (clones of shipped providers/hooks + the existing supabase client). No migration (mig 104 substrate is sufficient — Plan 01).

## Known Stubs
None. OrgProvider is wired end-to-end to the real `GET /org/me` via the probe; the fail-closed default (`can_manage:false`, `memberships:[]`) is a deliberate security posture, not a placeholder. The org switcher UI, the org-admin shell, the Members/Audit tabs, and the profile menu are Plans 03–05 (this plan is the data layer they consume via `useOrg`/`useOrgOptional`).

## Verification
- `npx vitest run src/providers/OrgProvider.test.tsx` → 5/5 passed.
- `npx vitest run src/providers/StreamsProvider.test.tsx` → 11/11 passed (existing suite unaffected; teardown inert outside an OrgProvider).
- `npx tsc --noEmit` → exit 0.
- `grep -c "sendingThreadsRef" StreamsProvider.tsx` → 13 (unchanged); predicate at :1340 byte-unchanged; diff additive-only.
- App wiring: `<OrgProvider>` opening tag precedes `<StreamsProvider>` opening tag; `ActiveView` union contains `"org-admin"`.
- Regression: NavPanel / SetupWizard / ChatLayoutLaunch suites (App/ActiveView consumers) → 21/21 passed.

## Next Phase Readiness
- Plans 03–05 consume `useOrg()` / `useOrgOptional()` for the active org + memberships + role + `canManage`/`canAuditView`, and `switchOrg` (which owns the D-166-08 teardown) — no App→ChatLayout prop threading needed.
- The `X-Org-Id` header is live on every authed call; `getOrgMembers` / `getOrgAudit` are ready to back the Members and Audit tabs (Plan 04).
- Plan 05 wires ChatLayout's `loadThreads()` refetch on an effect keyed on `activeOrgId` (the header is already the new org synchronously, so it refetches the new org's threads).
- No blockers.

## Self-Check: PASSED
- `frontend/src/providers/OrgProvider.tsx` — FOUND (created)
- `frontend/src/hooks/useOrgPermissionsProbe.ts` — FOUND (created)
- `frontend/src/providers/OrgProvider.test.tsx` — FOUND (created)
- `frontend/src/lib/api.ts` / `StreamsProvider.tsx` / `App.tsx` — FOUND (modified)
- Commit `1b781875` (Task 1, feat) — FOUND
- Commit `57513600` (Task 2 RED, test) — FOUND
- Commit `96fec51d` (Task 2 GREEN, feat) — FOUND
- OrgProvider.test.tsx — 5/5 passed; StreamsProvider.test.tsx — 11/11 passed; tsc exit 0
- `sendingThreadsRef` count == 13; predicate at :1340 byte-unchanged
- No writes to STATE.md / ROADMAP.md — confirmed

---
*Phase: 166-org-admin-shell-org-switcher-profile-menu-anchor*
*Completed: 2026-07-21*
