---
phase: 148-governance-audit-users-feature-visibility
plan: 06
subsystem: backend-admin-endpoints
tags: [ADMIN-03, VIS-01, admin-router, audit-browse, csv-export, user-disable-enable, operator-grant-revoke, visibility-set, no-rls-backstop, SC4]
requires:
  - "148-04 (governance_service: query_platform_audit, export_platform_audit_csv + AuditExportTooLarge, list_users_roster; operator_service: grant_operator, revoke_operator)"
  - "148-02 (user_settings.set_feature_visibility atomic JSONB writer; require_visible; _is_banned app-layer ban seam)"
  - "148-03 (migration 098 applied to the live LOCAL DB — app_settings.feature_visibility seeded)"
  - "147 (run_lifecycle._cancel_run_internals shared cancel/zombie-heal discipline; admin.py kill delegation shape; operator_audit_floor)"
  - "146 (require_operator router gate — byte-identical 404, no RLS backstop; write_operator_audit floor)"
provides:
  - "GET /admin/platform-audit — recorded cross-user audit browse (audit.view_platform, is_write=False, server-owned label)"
  - "GET /admin/platform-audit/export — capped CSV; audit.export names the EXACT count on success, records NOTHING on over-cap refuse"
  - "GET /admin/users — floor-exempt roster read"
  - "POST /admin/users/{id}/disable — self-guard 409 + GoTrue ban 876600h + in-flight cancel via _cancel_run_internals + user.disable"
  - "POST /admin/users/{id}/enable — ban_duration=none + user.enable"
  - "POST/DELETE /admin/users/{id}/operator — grant/revoke delegating to operator_service (self-revoke 409 preserved)"
  - "PUT /admin/visibility — allowlist-validated feature+audience → set_feature_visibility → visibility.set"
affects:
  - "backend/app/api/admin.py (the ONLY file — +8 endpoints + 3 helpers on the existing operator router)"
tech-stack:
  added: []   # zero new packages (composes 148-04/02 + 147 + starlette.run_in_threadpool, all present)
  patterns:
    - "thin controller: validate -> delegate to the 148-04 service / 148-02 writer / 147 kill internals -> stamp the server-owned audit floor row"
    - "record-only-on-success receipt: audit.export state is stamped AFTER the count is known; a refused export raises before that line, and the floor's post-yield write is skipped (exception re-thrown at yield) — no receipt (set_flag failure-path discipline)"
    - "self-lockout wall server-side: disable refuses str(user_id)==operator id with 409 BEFORE any GoTrue mutation; revoke delegates to the service's own self-revoke 409"
    - "module-attribute call sites (governance_service.query_platform_audit) so the service layer stays swappable/patchable; get_supabase()/get_redis() called as bare module names for the GoTrue ban + cancel"
    - "reuse-never-reimplement: disable's in-flight cancel loops the victim's non-terminal runs and delegates each to the SHARED _cancel_run_internals (D-062 discipline)"
key-files:
  created: []
  modified:
    - backend/app/api/admin.py
decisions:
  - "Skipped requirements.mark-complete for ADMIN-03 + VIS-01 — this plan wires the operator ENDPOINTS but the roster/disable/CSV/visibility UI lands in 148-07/08/09 and VIS-01 nav gating + graceful bounce are frontend; marking complete now would be a false green (STATE.md explicitly holds both Pending until the full feature ships). Mirrors 148-02/04's substrate-not-complete posture."
  - "disable's active-runs lookup filters the runs table (status <> ALL(terminal[])) rather than reading Redis runs:active — the controller test's FakeRedis.zrange returns [] by design, and the durable Postgres runs.status is the authoritative in-flight record (147 posture); each non-terminal run is handed to the shared cancel helper."
  - "GoTrue ban uses the module-level get_supabase() call (not Depends(get_supabase)) so the blocking admin write targets the same service-role client the tests patch at app.api.admin.get_supabase; the audit floor keeps its own Depends(get_supabase) -> the shared mock, so ban vs. audit-write hit the correct clients."
  - "PUT /admin/visibility rejects a bad feature/audience with 400 (plan wording) — distinct from set_flag's 422 for an unknown flag key; both guard BEFORE any write."
metrics:
  duration: ~25m
  tasks_completed: 3
  files_touched: 1
  completed: 2026-07-11
---

# Phase 148 Plan 06: Operator Admin Endpoints (audit browse/export + users disable/enable + grant/revoke + visibility set) Summary

**One-liner:** The 8 thin operator controllers that make ADMIN-03 + the VIS-01 write real — a recorded cross-user `platform-audit` browse + capped self-recording CSV export, a floor-exempt users roster, a self-guarded GoTrue disable that reuses the shared `_cancel_run_internals` in-flight cancel, a restorative enable, operator grant/revoke delegating to the lockout-proof service, and an allowlist-guarded `visibility` set — all added to the EXISTING `admin.py` router so they inherit the byte-identical 404 default-deny gate (no RLS backstop), each composing (never re-implementing) the 148-04 services + 148-02 writer + 147 kill internals with a server-owned audit-floor row.

## What Was Built

**Task 1 — Platform-audit browse + capped CSV export (commit `3055196d`):**
- `GET /admin/platform-audit?user_id?&action_type[]?&since?&until?&page?&page_size` — delegates to `governance_service.query_platform_audit`; floor-attached with `audit_is_write=False`, server-owned label "Viewed platform activity", action `audit.view_platform`. 1-based pagination; the service clamps `page_size` ≤ 100 (no full-tenant leak — the query/scope/cap safety lives in 148-04, this controller only delegates + records).
- `GET /admin/platform-audit/export` (same filters) — delegates to `export_platform_audit_csv`, returning `(StreamingResponse, count)`. On SUCCESS it stamps `audit.export` with `f"Exported {count} audit entries ({filter summary})"` naming the EXACT count. On over-cap it catches the domain `AuditExportTooLarge` and maps it to a 413 — the `audit_*` state is never reached and the raised exception is re-thrown into the floor's `yield`, so the floor SKIPS its write (the `set_flag` failure-path discipline): a refused export leaves NO receipt.

**Task 2 — Users roster + disable + enable (commit `fcd8a65d`):**
- `GET /admin/users?page?&page_size` — floor-EXEMPT poll read (the `/runs` precedent, D-07); delegates to `list_users_roster`.
- `POST /admin/users/{user_id}/disable` — self-guard FIRST (`str(user_id) == operator id` → 409 BEFORE any mutation, Pitfall 7); then the GoTrue ban with the EXACT literal `"876600h"` (Pitfall 2 — day/year units rejected) via `run_in_threadpool` (blocking httpx, D-v2.5-01); then `_cancel_inflight_runs` fetches the victim's non-terminal `runs` and delegates each to the SHARED `run_lifecycle._cancel_run_internals` (reuse, never re-implement). Floor: 064-B victim-naming label + `user.disable`.
- `POST /admin/users/{user_id}/enable` — GoTrue `{"ban_duration": "none"}` via `run_in_threadpool`; floor `user.enable`; restorative + direct (no in-flight cancel, no self-guard).
- Helpers added: `_lookup_user_email` (best-effort victim naming, falls back to "a user"), `_cancel_inflight_runs`.

**Task 3 — Operator grant/revoke + visibility set (commit `b5adbc36`):**
- `POST /admin/users/{user_id}/operator` — delegates to `operator_service.grant_operator(user_id, acting_id)` (granted_by populated, idempotent); floor `operator.grant`.
- `DELETE /admin/users/{user_id}/operator` — delegates to `revoke_operator(user_id, acting_id)` (the self-revoke 409 lives in the service, before any DELETE); floor `operator.revoke`.
- `PUT /admin/visibility {feature, audience}` — validates `feature` against the four-key code allowlist AND `audience` against `{everyone, operators}`, rejecting a bad value with 400 BEFORE any write (SQLi-safe, mirrors `set_flag`'s `_FLAG_KEYS` guard); then `set_feature_visibility` (atomic JSONB `||` merge); floor `visibility.set`.

## Verification

- **The 3 controller-level RED targets OWNED by this plan are now GREEN:** `test_148_view_platform_recorded.py` (3 — `audit.view_platform` recorded is_write=False, successful export records `audit.export` with the exact count, refused over-cap export records nothing), `test_148_disable.py` (2 — self-disable 409 before any mutation, ban `876600h` + `_cancel_run_internals` call + `user.disable`), `test_148_enable.py` (1 — `ban_duration=none` + `user.enable`). Also re-ran the 148-04-owned `test_148_operator_grant.py` (2) + `test_148_csv_export.py` (2) as delegation non-regression checks — GREEN.
- **Full `test_148_*.py` sweep ALL GREEN — no remaining backend RED stubs:** `venv/Scripts/python -m pytest tests/test_148_*.py tests/test_146_operator_gate.py -q` → **37 passed**. This closes the wave-4 controller stubs the 148-04 summary flagged (disable / enable / view_platform_recorded).
- **146/147 backstop intact:** `test_146_operator_gate.py` green — the byte-identical 404 default-deny + the `_derive_action`/`_WRITE_METHODS` fallback (which references `/admin/users` as a path string only) are unaffected; no new endpoint re-adds `require_operator` (all inherit the router gate).
- **App boots clean:** the full backend suite ran to completion (`2271 passed`), confirming the +8 endpoints + new imports (`governance_service`, `set_feature_visibility`, `grant_operator`, `revoke_operator`, `run_in_threadpool`, `datetime`, `Query`) introduce no import-time regression.

## Deviations from Plan

None — Tasks 1–3 executed exactly as written (no Rule 1/2/3 auto-fixes needed). Three in-scope judgment calls are recorded under `decisions`: (a) skipped `requirements.mark-complete` for ADMIN-03/VIS-01 (frontend still pending — false-green avoidance, per the 148-02/04 precedent and STATE.md's explicit Pending hold); (b) disable's in-flight-cancel reads the durable Postgres `runs` table rather than Redis `runs:active` (matches the controller test's FakeRedis and the 147 durable-record posture); (c) the GoTrue ban uses the module-level `get_supabase()` call so the blocking admin write and the audit-floor write hit the correct clients.

## Pre-existing Suite State (out of scope — NOT caused by this plan)

The first full-suite run of the phase surfaced **187 pre-existing failures across 72 distinct test files** (e.g. `test_skill_tuner_routes`, `test_retrieval_service`, `test_sql_service`, `test_threads_skills`, `test_dual_mode_wiring`, many `tests/integration/*`). These are ambient rot / live-service-dependent tests that predate this session — the failure signatures are unrelated to governance (`coroutine not awaited`, `embed_texts`/`rpc` mock-call-count rot, integration tests needing seeded Postgres/Redis). **Proven out of scope:** (i) this plan's only change is `backend/app/api/admin.py`; (ii) a grep confirmed **zero** of the 72 failing files import `admin.py`; (iii) the app boots and all 148/146 governance tests pass. Per the SCOPE BOUNDARY rule these were NOT touched. They align with the known backend/frontend test-rot notes (MEMORY: `project_frontend_vitest_rot`, `project_e2e_suite_rotted`) and are flagged here for the phase verifier, not fixed.

## Known Stubs

None. All 8 endpoints are wired to their real service/writer/kill collaborators and covered by the GREEN controller tests (or the delegation + full-suite gate for grant/revoke/visibility per the plan's wave-ownership split). The roster/CSV/disable/visibility UI that consumes these endpoints lands in 148-07/08/09 — that is the planned next slice, not a stub in this plan.

## Threat Flags

None. All security-relevant surface introduced (the two no-RLS-backstop cross-user reads, the GoTrue disable/enable writes, the in-flight cancel, the grant/revoke membership writes, the visibility JSONB write) was enumerated in the plan's `<threat_model>` (T-148-01 Information Disclosure, T-148-02 Elevation, T-148-04 Denial of Service, T-148-03 Tampering, T-148-06 Integrity, T-148-SC accept) and mitigated as specified: server-owned recorded reads, the exact-count / refuse-writes-nothing export receipt, the self-guard 409 before any mutation, the code-allowlist feature/audience validation before the atomic merge, and reuse of the shared cancel discipline. No new trust-boundary schema change beyond the planned endpoints.

## Self-Check: PASSED

- File: FOUND `backend/app/api/admin.py` (8 new 148-06 routes present).
- Commits: FOUND `3055196d` (platform-audit browse + export), FOUND `fcd8a65d` (users roster + disable + enable), FOUND `b5adbc36` (grant/revoke + visibility set).
- Tests: `test_148_*.py` + `test_146_operator_gate.py` → 37 passed (all owned controller RED targets GREEN; no backend RED stubs remain).

---
*Phase: 148-governance-audit-users-feature-visibility*
*Completed: 2026-07-11*
