---
phase: 167-invitations-roles-greenlists-jit-per-user-prefs
plan: 03
subsystem: auth
tags: [feature-visibility, greenlists, rbac, jsonb, fastapi, rls, glean-precedence]

# Dependency graph
requires:
  - phase: 148-operator-ux (VIS-01)
    provides: feature_audience + require_visible + set_feature_visibility + GET /features (the ONE swappable audience boundary this plan extends)
  - phase: 166-org-shell (ADMIN-01/02)
    provides: get_active_org_id stashing request.state.org_role + get_user_pg_connection (user-JWT/RLS reads)
  - phase: 167-01
    provides: the org invitation/roster surface the greenlisted roles resolve against
provides:
  - "feature_audience recognizes the 'role' audience enum (zero migration — the mig-098 JSONB shape)"
  - "resolve_feature_access: the Glean precedence-merge greenlist resolver (highest-role-wins primary + union secondary groups, fail-closed)"
  - "resolve_caller_role: request.state.org_role-first caller-role resolver with a highest-membership-role fallback"
  - "require_visible extended in place with a role branch (operator + everyone no-ops byte-identical)"
  - "GET /features resolves the SAME greenlist so hide == refuse"
  - "PUT /admin/visibility accepts audience='role' + allowlist-validated roles[]"
affects: [167-04-per-user-prefs, greenlist-groups-table-future-phase, org-admin-visibility-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extend-never-fork: one _feature_record parse path shared by feature_audience + resolve_feature_access (D-167-06)"
    - "Fail-closed greenlist resolution: unknown/malformed record or unresolved role -> deny, never raise"
    - "Caller-role resolution prefers the 166-validated request.state.org_role; a user-JWT/RLS fallback picks the highest membership role"

key-files:
  created:
    - backend/tests/test_167_greenlist.py
  modified:
    - backend/app/models/user_settings.py
    - backend/app/dependencies.py
    - backend/app/api/features.py
    - backend/app/api/admin.py

key-decisions:
  - "Followed RESEARCH Pattern 3 verbatim: role grant is exact-membership on the greenlisted roles[] (not a hierarchy expansion); 'highest-role-wins' resolves the CALLER's single effective role across memberships, then exact-matches the greenlist"
  - "roles[]/groups[] are always serialized into the JSONB record (even for everyone/operators, as empty arrays) — matches the plan's serialization shape; harmless since resolve_feature_access is only reached for the 'role' audience"
  - "resolve_caller_role added as a shared public helper in dependencies.py (imported by features.py) rather than duplicating role resolution in two places"

patterns-established:
  - "Pattern 1: _feature_record — the single dict-or-str-guarded read (Pitfall 5) shared by every feature-visibility consumer"
  - "Pattern 2: the /features map bool is derived through the SAME resolve_feature_access the gate uses, so the UI hide and the API 403 can never disagree"

requirements-completed: [VIS-01]

# Metrics
duration: 27min
completed: 2026-07-21
---

# Phase 167 Plan 03: Role Greenlists Summary

**Generalized the binary feature-visibility (`{audience: everyone|operators}`) into per-feature role greenlists (`{audience: role, roles:[...]}`) by extending the ONE resolver — `feature_audience` + `resolve_feature_access` + `require_visible` + the `/features` map + `set_feature_visibility` + `PUT /admin/visibility` — with a fail-closed Glean precedence-merge and ZERO migration.**

## Performance

- **Duration:** ~27 min
- **Started:** 2026-07-21T19:28:00Z
- **Completed:** 2026-07-21T19:55:34Z
- **Tasks:** 2
- **Files modified:** 4 (+1 test file created)

## Accomplishments
- `feature_audience` now recognizes a third audience enum value `"role"` with the SAME cold-default fail-safe posture — no DDL, the mig-098 JSONB column shape absorbs it.
- `resolve_feature_access(feature, caller_role, caller_groups)` — the pure in-memory Glean precedence-merge: `everyone→True`, `operators→False` (operator no-op handled upstream), `role→` exact-membership on `roles[]` OR union against `groups[]`, everything else (unknown/malformed/missing) → safe-deny. Never raises.
- `require_visible` extended IN PLACE (still exactly one `def require_visible`) — a role branch after the operator + everyone no-ops (both byte-identical); the caller's role resolves via `resolve_caller_role` (prefers 166's `request.state.org_role`, else highest membership role on a user-JWT/RLS read), fail-closed to the existing 403.
- `GET /features` derives each bool through the SAME `resolve_feature_access`, so the UI hide and the API refusal can never disagree (hide == refuse).
- `PUT /admin/visibility` accepts `audience='role'` + a `roles[]` greenlist validated against the 4-tier `_VISIBILITY_ROLES` set (400 before any write — free-text roles never reach the JSONB codec).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend feature_audience + set_feature_visibility to the 'role' audience + precedence-merge resolver** — `48569fd5` (feat)
2. **Task 2 (TDD RED): failing greenlist gate/map/write tests** — `8d848842` (test)
3. **Task 2 (TDD GREEN): wire role greenlist into require_visible + /features + admin write** — `995a4df1` (feat)

_Note: Task 2 was `tdd="true"` → RED (test) then GREEN (feat). No refactor commit needed._

## Files Created/Modified
- `backend/app/models/user_settings.py` — `_feature_record` shared parse helper; `feature_audience` recognizes `"role"`; new `resolve_feature_access` precedence-merge; `set_feature_visibility` carries validated `roles[]`/`groups[]` through the same atomic `||` merge (stays service-role — global map).
- `backend/app/dependencies.py` — `_ROLE_RANK` + `_highest_role` + `resolve_caller_role`; `require_visible` extended with the role branch (operator/everyone carve-outs unchanged).
- `backend/app/api/features.py` — `get_effective_features` now takes `Request`, resolves the caller's role only when a governed feature is role-audience, derives each bool through `resolve_feature_access`.
- `backend/app/api/admin.py` — `_VISIBILITY_AUDIENCES` += `"role"`; new `_VISIBILITY_ROLES` allowlist; `VisibilityUpdate.roles: list[str]`; role validation (400) + role-aware audit label.
- `backend/tests/test_167_greenlist.py` — 15 tests covering the six D-167-06 behaviors (operator/everyone no-op, granted/ungranted role, precedence primary + union secondary, cold/unknown/malformed safe-deny, /features == gate, admin role accept + bad-role 400).

## Decisions Made
- **Grant semantics = exact membership, not hierarchy expansion.** RESEARCH Pattern 3 is verbatim: a `role`-audience feature is visible iff the caller's resolved role is literally in the greenlisted `roles[]` (or a group intersects). "Highest-role-wins" governs how the caller's SINGLE effective role is chosen when they hold 2+ memberships (`_highest_role`), not an implicit "higher roles inherit lower grants." This is the safest fail-closed reading and matches the shipped resolver example.
- **Always serialize `roles[]`/`groups[]` (empty for everyone/operators).** Matches the plan's stated record shape; harmless because `resolve_feature_access` only consults them on the `role` branch, which is only reached when `feature_audience == "role"`.
- **`resolve_caller_role` is a shared public helper in `dependencies.py`**, imported by `features.py`, so the gate and the map resolve the caller's role identically (no duplicate query path).

## Deviations from Plan

None - plan executed exactly as written. (Task 1's `resolve_feature_access` was shipped ahead of the Task 2 RED phase, so its unit tests were already green at RED time — expected, since the two tasks split the resolver from its wiring; the six Task-2 wiring tests were genuinely RED before the GREEN commit.)

## Issues Encountered
None. The `require_visible` closure signature had to keep working for the Phase-148 unit tests that call `_dep(current_user=...)` with no request — solved by giving `request: Request = None` a default (FastAPI still injects it by annotation at runtime; the pure-unit callers pass `None` and the role branch fails closed if a role can't be resolved).

## User Setup Required
None - no external service configuration required. **Zero migration** (D-167-06): the `feature_visibility` JSONB column (mig 098) already stores the extended `{audience: role, roles:[...]}` shape.

## Next Phase Readiness
- The greenlist resolver + write endpoint are live; a future org-admin visibility UI can call `PUT /admin/visibility` with `audience='role'`.
- Groups remain an empty, extensible set this phase (RESEARCH OQ2 — the groups table is deferred); `resolve_feature_access` already unions against `groups[]`, so a later groups phase only needs to populate `caller_groups`.
- Plan 04 (VIS-02 per-user prefs) is independent of this resolver.

## Self-Check: PASSED

All 5 code/test files present; all 3 task commits (`48569fd5`, `8d848842`, `995a4df1`) found in git. Test suite: `test_167_greenlist.py` (15) + `test_148_require_visible.py` (3) + `test_148_visibility_cold_default.py` (3) = 21 passed, 0 failed. Acceptance greps: `def require_visible` == 1, `def feature_audience|def set_feature_visibility` == 2, `resolve_feature_access` present in the require_visible closure, `_VISIBILITY_ROLES` gates the admin write.

---
*Phase: 167-invitations-roles-greenlists-jit-per-user-prefs*
*Completed: 2026-07-21*
