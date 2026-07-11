---
phase: 148-governance-audit-users-feature-visibility
plan: 04
subsystem: backend-governance-service
tags: [ADMIN-03, audit-browse, csv-export, users-roster, operator-grant-revoke, no-rls-backstop, SC4]
requires:
  - "148-02 (governance substrate: require_visible gate factory, feature_audience resolver, ban seam — this plan builds the cross-user read/write core alongside it)"
  - "migration 095 operator_users.granted_by column (Phase 146 — populated by grant_operator)"
  - "operator_service pool-access + lazy get_pg_pool import discipline (Phase 146)"
provides:
  - "governance_service.query_platform_audit — parameterized, scoped, always-paginated cross-user audit_log browse (SC#4 no-full-tenant-leak)"
  - "governance_service.export_platform_audit_csv — COUNT-first capped CSV; refuses over 50000 via AuditExportTooLarge; returns (StreamingResponse, exact count)"
  - "governance_service.list_users_roster — one-join roster with honest last-active + doc/chat counts + is_operator"
  - "operator_service.grant_operator — idempotent grant populating granted_by = acting operator (D-01)"
  - "operator_service.revoke_operator — lockout-proof revoke (409 on self-revoke BEFORE the delete)"
affects:
  - "backend/app/api/admin.py (148-06 wires these helpers into +7 operator endpoints — NOT touched here)"
tech-stack:
  added: []   # zero new packages (stdlib csv/io/json + asyncpg + fastapi already present)
  patterns:
    - "NULL-guarded $N binds for every filter — user scope / action_type text[] ANY / half-open [since, until) window (no string-interpolated SQL)"
    - "page_size clamped <= 100 at the service boundary — an over-cap request is clamped, never passed through"
    - "COUNT-first refuse-if-exceeded CSV cap (AuditExportTooLarge) — the export refusal PROPAGATES; the browse read swallows-and-logs"
    - "honest last-active — last_sign_in_at NULL preserved as None, ORDER BY ... DESC NULLS LAST"
    - "idempotent ON CONFLICT DO UPDATE SET granted_by = EXCLUDED.granted_by re-stamps provenance"
    - "self-revoke guard raises BEFORE any pool access (server is the lockout wall, not the UI tooltip)"
key-files:
  created:
    - backend/app/services/governance_service.py
  modified:
    - backend/app/services/operator_service.py
decisions:
  - "Skipped requirements.mark-complete for ADMIN-03 — 148-04 is the service layer only (query builders + CSV + roster + grant/revoke are not yet CALLED by any router until 148-06 wires the +7 admin endpoints, and the roster/disable/enable UI lands in 148-07). Marking complete now would be a false green; ADMIN-03 completes at phase verify-work. Mirrors 148-02's substrate-not-complete posture."
  - "CSV export returns the COUNT-probe value as the exact count (not len(rows)) — it is the authoritative filtered-set size that gates the cap and that 148-06 stamps onto audit.export; the belt-and-suspenders LIMIT (== the cap) never truncates a validated under-cap set."
  - "Both cross-user READS (query_platform_audit, list_users_roster) swallow-and-log to [] (best-effort feed, mirrors get_recent_operator_audit); only the export REFUSAL propagates as a deliberate 4xx."
metrics:
  duration: ~12m
  tasks_completed: 3
  files_touched: 2
  completed: 2026-07-11
---

# Phase 148 Plan 04: Governance Service Layer (audit browse + capped CSV + roster + grant/revoke) Summary

**One-liner:** The SC#4-sensitive cross-user read/write core — a parameterized, explicitly-scoped, always-paginated `query_platform_audit` (never an unbounded `SELECT *`), a COUNT-first `export_platform_audit_csv` that REFUSES over 50000 rows rather than dumping the tenant, a one-join `list_users_roster` with honest never-fabricated last-active, and idempotent `grant_operator` / lockout-proof `revoke_operator` membership writers — the thin unit-tested layer that keeps the 148-06 `admin.py` controllers slim and makes the no-full-tenant-leak + lockout-proof guarantees by construction.

## What Was Built

**Task 1 — Platform audit query builder + capped CSV (`backend/app/services/governance_service.py`, commit `3531da1c`):**
- `query_platform_audit(user_id, action_types, since, until, page_size, offset)` — RESEARCH §Pattern 3 verbatim: a `_AUDIT_WHERE` of NULL-guarded `$N` binds (`$1::uuid IS NULL OR user_id=$1` scope; `$2::text[] IS NULL OR action_type = ANY($2)`; half-open `created_at >= $3 AND created_at < $4`), `ORDER BY created_at DESC LIMIT $5 OFFSET $6`. Column list is a code constant (`_AUDIT_COLUMNS`) — no `SELECT *`. `page_size` clamped to `[1, 100]` via `_clamp_page_size` (an over-cap 5000 request is clamped, never bound). `user_id=None` -> the deliberate all-users cross-user read; a value -> single-user scope. Swallow-and-log posture (best-effort browse feed → `[]`).
- `export_platform_audit_csv(...)` — COUNT-first with the SAME WHERE via `pool.fetchval`; over `_CSV_MAX_ROWS` (50000) raises `AuditExportTooLarge(count)` ("Too many rows (N) — narrow the filter") — never a silent truncate. Under cap it streams the filtered rows via stdlib `csv.writer` + `io.StringIO` + `StreamingResponse` (the `audit.py:95-112` shape, minus the owner `.eq(user_id)` filter, plus a cross-user `user_id` column) and returns `(StreamingResponse, count)`. The refusal PROPAGATES (deliberate 4xx); it does NOT swallow like the browse read.

**Task 2 — Roster query (`backend/app/services/governance_service.py`, commit `3e345fa4`):**
- `list_users_roster(page_size, offset)` — one join (`_ROSTER_SQL`): `auth.users u LEFT JOIN operator_users o` + `LEFT JOIN (doc counts) d` + `LEFT JOIN (chat counts) t`, selecting `last_sign_in_at`, `banned_until`, `(o.user_id IS NOT NULL) AS is_operator`, coalesced `doc_count`/`chat_count`, `ORDER BY u.last_sign_in_at DESC NULLS LAST LIMIT $1 OFFSET $2`. `last_sign_in_at` NULL is PRESERVED as `None` (UI "never signed in") — never backfilled. `is_operator` derives from the `operator_users` join, not a JWT claim. Assumption A1 verified against `full-schema.sql`: `documents` and `threads` both carry `user_id`.

**Task 3 — Grant / revoke helpers (`backend/app/services/operator_service.py`, commit `f4ff5651`):**
- `grant_operator(target_id, acting_operator_id)` — copies `seed_operators_from_env`'s INSERT shape, swapping the env-bootstrap provenance (`NULL, 'env-bootstrap'`) for runtime provenance (`$2` acting operator, `'granted via roster'`) and adding `ON CONFLICT (user_id) DO UPDATE SET granted_by = EXCLUDED.granted_by` — idempotent AND re-stamps `granted_by` on a re-grant (D-01, mig 095 provenance).
- `revoke_operator(target_id, acting_operator_id)` — refuses self-revoke with `HTTPException(409, "You cannot remove your own operator access.")` FIRST, before any `get_pg_pool()` / DELETE (Pitfall 7 — the server is the lockout wall). Otherwise `DELETE FROM operator_users WHERE user_id = $1`. Past `operator_audit_log` history is untouched (plain-uuid `operator_user_id`, no FK — mig 095). Added the `from fastapi import HTTPException` import.

## Verification

- **The 5 service-level tests OWNED by this plan GREEN (10/10 run together):** `test_148_platform_audit_filters.py` (2), `test_148_platform_audit_scope.py` (3), `test_148_csv_export.py` (2), `test_148_roster.py::test_last_active_honesty` (1), `test_148_operator_grant.py` (2). Ran via `venv/Scripts/python -m pytest ... -q` → `10 passed`.
- **Controller-level tests stay RED as designed (owned by 148-06, wave 4):** `test_148_disable.py` (2), `test_148_enable.py` (1), `test_148_view_platform_recorded.py` (3) → 6 failed, all downstream. The wave-ownership split (VALIDATION.md revision) explicitly moves the `audit.export`-recorded / refused-writes-nothing and self-disable-409 assertions into these 148-06 files.
- **146/147 regression backstop GREEN (78/78):** no regression on the operator gate, seed, active-runs, flag, health, maintenance, kill, or workflows paths.
- **Full `test_148_*.py` sweep:** 21 passed / 10 failed — exactly 10 more green than 148-02's baseline (11 passed). The 10 remaining failures are all downstream Wave-0 stubs: `carveouts` + `effective_features` → 148-05; `disable` + `enable` + `view_platform_recorded` → 148-06. None are this plan's responsibility.

## Deviations from Plan

None — Tasks 1–3 executed exactly as written (no Rule 1/2/3 auto-fixes needed). One in-scope judgment call recorded under `decisions`: skipped `requirements.mark-complete` for ADMIN-03 because this service layer is not yet wired to any router (that is 148-06/07), mirroring 148-02's substrate-not-complete posture.

## Known Stubs

None in the harmful sense. `query_platform_audit`, `export_platform_audit_csv`, `list_users_roster`, `grant_operator`, and `revoke_operator` are built and fully unit-tested but not yet CALLED by any router/endpoint — this is by design for a service-layer plan (148-06 wires the +7 admin endpoints; 148-07 wires the roster/CSV UI). The plan's own goal (the reusable, unit-tested cross-user read/write core) is fully achieved; nothing here renders empty/placeholder data to a UI.

## Threat Flags

None. All security-relevant surface introduced (the no-RLS-backstop cross-user audit read, the capped CSV, the cross-user roster read, and the grant/revoke membership writes) was enumerated in the plan's `<threat_model>` (T-148-01 Information Disclosure, T-148-03 Tampering, T-148-04 Denial of Service, T-148-SC accept) and mitigated as specified: parameterized `$N` binds only, `page_size <= 100`, COUNT-first refuse-if-over-50000, and the self-revoke server guard before any mutation. No new endpoint or trust-boundary schema change beyond the planned service functions.

## Self-Check: PASSED

- Files: FOUND `backend/app/services/governance_service.py`, FOUND `backend/app/services/operator_service.py`.
- Commits: FOUND `3531da1c` (audit query + CSV), FOUND `3e345fa4` (roster), FOUND `f4ff5651` (grant/revoke).
