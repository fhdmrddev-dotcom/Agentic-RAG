---
phase: 090
slug: harness-schema-rls-config-models
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 090 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio (`asyncio_mode=auto`) [VERIFIED: backend/pytest.ini] |
| **Config file** | `backend/pytest.ini` (`testpaths = tests`) |
| **Quick run command** | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_harness_models.py -x` |
| **Full suite command** | `cd backend && venv/Scripts/python.exe -m pytest` |
| **Estimated runtime** | ~2s (model unit tests) / full suite per existing baseline |

> **CRITICAL CONSTRAINT:** `backend/tests/conftest.py` builds a fully-mocked Supabase client [VERIFIED]. There is NO live-DB fixture. RLS, immutability-trigger, and DELETE-RESTRICT behavior **cannot** be verified by standard pytest — those SCs are verified against the **live local Supabase** via a `supabase/verify_090.sql` script / SQL-editor checklist. Only the Pydantic `model_validate()` strict-parse test runs in plain mocked pytest.

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/unit/test_harness_models.py -x` (pure-Python, fast)
- **After every plan wave:** Run full `pytest` suite (the new models file must not break imports)
- **Before `/gsd:verify-work`:** Full pytest GREEN **AND** `supabase/verify_090.sql` run against the live local Supabase (RLS denial, immutability refusal, DELETE-RESTRICT refusal, INSERT-only policy presence, table/column introspection) all confirmed
- **Max feedback latency:** ~5 seconds (unit) / manual for live-DB checks

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| SC#5 / D-07 | models | — | HARNESS-02 (config), SC#5 | T-malformed-config (V5) | `WorkflowDefinition.model_validate(seed)` parses valid seed; unknown key / wrong `phase_type` raises `ValidationError` | unit | `pytest tests/unit/test_harness_models.py -x` | ❌ W0 | ⬜ pending |
| HARNESS-02 a | migrations | — | HARNESS-02 | T-published-tamper (Tampering) | UPDATE on published definition REFUSED (trigger raises) | live-DB SQL | `verify_090.sql`: publish row, UPDATE → expect raise | ❌ W0 | ⬜ pending |
| HARNESS-02 b | migrations | — | HARNESS-02 | T-published-tamper | DELETE of a definition referenced by a run REFUSED (FK RESTRICT) | live-DB SQL | insert run ref, DELETE def → FK violation 23503 | ❌ W0 | ⬜ pending |
| HARNESS-02 c | migrations | — | HARNESS-02 | T-published-tamper | `UNIQUE(slug, version)` rejects duplicate | live-DB SQL | insert two rows same (slug,version) → 23505 | ❌ W0 | ⬜ pending |
| SC#3 | migrations | — | SC#3 (RLS) | T-cross-user-read (Info Disclosure / V4) | Cross-user SELECT of runs/phases/audit denied | live-DB SQL (two auth contexts) | connect as user B, SELECT user A's run → 0 rows | ❌ W0 | ⬜ pending |
| HARNESS-06 | migrations | — | HARNESS-06 | T-audit-tamper (Repudiation) | `harness_audit` has NO UPDATE/DELETE policy (INSERT-only) | live-DB SQL | query `pg_policies` → only SELECT+INSERT; UPDATE denied | ❌ W0 | ⬜ pending |
| SC#1 | migrations | — | SC#1 | — | All 4 tables + `threads.active_workflow_run_id` exist; `deep_mode_metadata` does NOT; every table has `org_id uuid NULL` | live-DB introspection | query `information_schema.tables` / `.columns` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_harness_models.py` — Pydantic model tests: valid seed parses; `extra='forbid'` rejects unknown key; wrong `phase_type` rejected; each of the 5 phase configs validates. Covers SC#5 / D-07. Runs in mocked pytest (no DB needed).
- [ ] `supabase/verify_090.sql` (or documented SQL-editor checklist) — live-DB verification script: immutability refusal, DELETE RESTRICT, UNIQUE collision, cross-user RLS denial, INSERT-only policy presence, table/column introspection (incl. `deep_mode_metadata` absence + `org_id` presence). This is the **`autonomous: false` human-run verification** — pasted into the SQL editor against the live local DB.

*Optional: `backend/tests/integration/test_090_harness_rls.py` only if a live-DB connection fixture is introduced. Existing integration tests use the mock client; the SQL-script path is recommended to avoid scope creep.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration apply | SC#1 | CLAUDE.md forbids `db push`/`db reset`; migrations applied by hand via Supabase SQL editor | Paste `056`–`059` into SQL editor in order; then `bash scripts/regenerate-full-schema.sh`; commit both |
| Immutability refusal | HARNESS-02 | No live-DB pytest fixture (conftest mocks Supabase) | Run `verify_090.sql` block A in SQL editor; expect trigger raise |
| DELETE RESTRICT refusal | HARNESS-02 | Same | `verify_090.sql` block B; expect FK 23503 |
| Cross-user RLS denial | SC#3 | Requires two auth contexts against live DB | `verify_090.sql` block C using two `auth.uid()` contexts; expect 0 rows |
| INSERT-only audit | HARNESS-06 | Policy introspection on live DB | `verify_090.sql` block D: `pg_policies` shows only SELECT+INSERT |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (live-DB SCs covered by `verify_090.sql` manual gate)
- [ ] Wave 0 covers all MISSING references (`test_harness_models.py` + `verify_090.sql`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s (unit)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
