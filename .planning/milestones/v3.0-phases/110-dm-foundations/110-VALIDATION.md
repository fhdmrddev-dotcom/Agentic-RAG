---
phase: 110
slug: dm-foundations
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-15
validated: 2026-06-15
---

# Phase 110 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `110-RESEARCH.md` § "Validation Architecture" (HIGH confidence, anchors re-read at HEAD).
> **The headline gate is SC#4 — a LIVE audit INSERT+SELECT round-trip for all 8 action types (no mocks). This is the D-102 "static would false-green" lesson made into a test.**

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (`asyncio_mode = auto`) — already present `[VERIFIED: backend/pytest.ini]` |
| **Config file** | `backend/pytest.ini` (`testpaths = tests`) |
| **Live-DB harness precedent** | `backend/tests/integration/test_092_harness_audit_live.py` (copy verbatim: DSN, `PG_AVAILABLE` skipif, function-scoped `pg_pool`, seeded `auth.users` + FK-safe teardown) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/integration/test_110_dm_audit_live.py tests/integration/test_110_audit_drift_guard.py -x` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest -x` |
| **DSN (live local Supabase)** | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (env override `POSTGRES_DSN`) `[VERIFIED: test_092:42-45]` |
| **Estimated runtime** | ~20–40 seconds (quick); full suite per existing baseline |

**Precondition for live tests:** local Supabase up on `:54322` AND migration `071_dm_foundations.sql` applied via the SQL editor. Without these, the live integration tests `skip` (PG_AVAILABLE guard) rather than false-pass.

---

## Sampling Rate

- **After every task commit:** Run the **quick run command** (the two live audit tests) — proves the enum lockstep at every step.
- **After every plan wave:** Run the **full suite command**.
- **Before `/gsd:verify-work`:** Full suite must be green (with `:54322` up + migration 071 applied).
- **Max feedback latency:** ~40 seconds.

**The SC#4 sample is ALL 8 action types — not a representative subset.** Each is an independent string in a closed CHECK; one missing from the migration is a silent audit hole for exactly that action. The 8 strings ARE the population; the parametrized test exercises every one. This is the single place where under-sampling = a shipped governance hole.

**RLS sample (SC#1):** exercise the cross-user path on at least **2 of the 4 tables**, plus the nullable-`user_id` global-field path on `metadata_field_definitions` (the only table with the nullable-owner deviation). Two users: user B's SELECT of user A's private row returns 0 rows; user B's SELECT of a global (`is_global=true`) row returns it. The remaining two tables share the identical policy shape — schema-assert their policies match.

---

## Per-Task Verification Map

> Task IDs are bound by the planner; rows below are keyed by Success Criterion → test file. Every row maps to a Wave-0 test stub.

| SC / Req | Behavior (observable that proves PASS) | Threat Ref | Test Type | Automated Command | File Exists | Status |
|----------|----------------------------------------|------------|-----------|-------------------|-------------|--------|
| SC#4 / DMF-01 | For each of 8 new action types, a row is present after INSERT+SELECT against live `:54322` (raw asyncpg, **not** `write_audit_entry`). FAIL = `CheckViolationError` on INSERT or `None` on SELECT. | T-audit-integrity | integration (parametrized, 8 types) | `pytest tests/integration/test_110_dm_audit_live.py -x` | ✅ | ✅ green (8/8 live) |
| SC#2 / DMF-01 | Live CHECK enum = 19 types AND `VALID_ACTION_TYPES` = same 19 (subset both directions); `full-schema.sql` regenerated. | T-audit-drift | integration (bidirectional subset) | `pytest tests/integration/test_110_audit_drift_guard.py -x` | ✅ | ✅ green (2/2: subset + ==19) |
| SC#3 / DMF-01 | (a) CI subset test GREEN with migration applied, RED when `VALID_ACTION_TYPES` has a type absent from live CHECK; (b) boot guard `raise`s (crashes startup) against a stub pool returning a constraint def missing one type. | T-audit-drift | unit (boot raises) + integration (CI subset) | `pytest tests/test_110_boot_guard.py tests/integration/test_110_audit_drift_guard.py -x` | ✅ | ✅ green (boot 4/4: missing-type + constraint-absent raise, synced + extra-type pass) |
| SC#1 / DMF-02 | `pg_constraint`/`information_schema`: 4 tables, `rowsecurity = true`, each with nullable no-FK `org_id`; cross-user RLS (2 users) returns correct row sets; global-row visibility correct. | T-rls-leak / T-global-priv | integration (schema + RLS) | `pytest tests/integration/test_110_dm_schema.py -x` | ✅ | ✅ green (13/13: rls×4, org_id×4, policy-shape×4, 2-user isolation×2, global-vis×1) |
| SC#5 / DMF-03 | `SELECT document_management_enabled FROM app_settings WHERE id='global'` = `true`; `load_app_settings().document_management_enabled is True`; defensive helper returns True on a forced read exception (default-on guarantee). | T-flag-default | integration (column + read) + unit (default-on) | `pytest tests/integration/test_110_flag.py tests/test_110_flag_default.py -x` | ✅ | ✅ green (4/4: column + read chain + forced-exception default-on + bare default) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Live validation run 2026-06-15 (`:54322` up + migration 071 applied):** all 6 test files / **33 tests PASSED, 0 skipped, 0 failed** in 1.78s. `test_dm_table_select_policy_shape[document_relationships]` asserts the per-table user-scoped shape (no `is_global` — the authoritative DDL; see 110-VERIFICATION.md override). Every SC row is COVERED by a green automated test.

---

## Wave 0 Requirements

- [x] `tests/integration/test_110_dm_audit_live.py` — SC#4 parametrized live round-trip (8 types) — covers **DMF-01** ✅ 8/8 green
- [x] `tests/integration/test_110_audit_drift_guard.py` — SC#2/SC#3 CI bidirectional subset assertion — covers **DMF-01** ✅ 2/2 green
- [x] `tests/integration/test_110_dm_schema.py` — SC#1 table existence + RLS-enabled + nullable-no-FK `org_id` + 2-user cross-user RLS + global visibility — covers **DMF-02** ✅ 13/13 green
- [x] `tests/integration/test_110_flag.py` — SC#5 flag column + read through `UserEffectiveSettings` — covers **DMF-03** ✅ 2/2 green
- [x] `tests/test_110_boot_guard.py` — SC#3 boot-guard-raises unit test (stub pool, no live DB) — covers **DMF-01** ✅ 4/4 green
- [x] `tests/test_110_flag_default.py` — SC#5 default-on-on-failure unit test — covers **DMF-03** ✅ 2/2 green
- [x] Shared helper `audit_service.assert_action_types_synced(pool)` — single source of truth for BOTH the boot guard and the CI test (no second copy of the subset logic) ✅ verified (audit_service.py:29-54; consumed by main.py boot + drift CI test)
- [x] Extend the `test_092`-style fixture teardown to also `DELETE FROM audit_log WHERE user_id = $1` (FK-safe cleanup of seeded rows) ✅ verified (live run leaves no orphan rows; 33 tests re-runnable)

*Framework install: none — pytest + pytest-asyncio already present and used by the integration suite.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Apply migration `071_dm_foundations.sql` to the live local DB | DMF-01/02/03 | Project HARD RULE (CLAUDE.md): **never** `supabase db push`/`db reset` — paste the migration into the Supabase SQL editor (preserves dev data). Cannot be automated by the executor. | Operator pastes `supabase/migrations/071_dm_foundations.sql` into the Supabase SQL editor and runs it; confirms success. Task is `autonomous: false`. |
| Regenerate `supabase/full-schema.sql` | DMF-01/02 | Must run against the live DB after the migration is applied; depends on the manual apply above. | `bash scripts/regenerate-full-schema.sh` (no `--reset`); commit `071_dm_foundations.sql` + regenerated `full-schema.sql` together. Verify `full-schema.sql` CHECK now lists all 19 action types. |
| Boot hard-fail observed in a running backend | DMF-01 (SC#3) | The crash-on-drift behavior is also confirmable by the operator starting uvicorn against a deliberately-desynced state; the unit test covers it automatically, this is the lived-experience confirmation. | (Optional) Temporarily add an unmatched type to `VALID_ACTION_TYPES`, start uvicorn, observe loud boot failure, revert. Automated equivalent: `test_110_boot_guard.py`. |

---

## Validation Sign-Off

- [x] All SC rows have an `<automated>` verify (or an explicit Manual-Only entry with rationale)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all ❌ MISSING references (6 test files + 2 shared helpers/fixtures) — all 6 files present + green
- [x] No watch-mode flags (all commands use `-x`, run-once)
- [x] Feedback latency < 40s (quick run) — full 6-file run measured 1.78s
- [x] SC#4 exercises ALL 8 action types (population, not sample) — 8 parametrized cases, all green
- [x] SC#1 RLS test uses 2 distinct users and asserts both private-isolation and global-visibility — `test_rls_cross_user_isolation_*` (B sees 0, A sees 1) + `test_rls_global_metadata_field_visible_to_other_user`
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-06-15

---

## Validation Audit 2026-06-15

| Metric | Count |
|--------|-------|
| Requirements (SC rows) | 5 (DMF-01/02/03) |
| Gaps found | 0 |
| Resolved | 0 (none needed) |
| Escalated | 0 |
| Manual-only (documented w/ rationale) | 3 (migration apply, full-schema regen, lived boot-fail — all have automated equivalents where possible) |
| Automated tests green | 33/33 (live `:54322`, migration 071 applied) |

**Verdict: NYQUIST-COMPLIANT.** This VALIDATION.md was authored at plan time (all rows `⬜ pending / ❌ W0`); this audit (State A) ran the 6 Wave-0 test files live and updated every row to its true green status. No gap-fill (gsd-nyquist-auditor) was needed — every requirement already has a green automated test. The 3 manual-only items are legitimately non-automatable per the project HARD RULE (no `db push`/`db reset`) and carry automated equivalents. Cross-checked against 110-VERIFICATION.md (7/7) and 110-SECURITY.md (11/11 threats closed).

*Run by: Claude (gsd validate-phase, State A audit).*
