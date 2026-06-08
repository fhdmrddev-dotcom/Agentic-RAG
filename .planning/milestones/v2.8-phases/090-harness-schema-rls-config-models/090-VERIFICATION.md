---
phase: 090-harness-schema-rls-config-models
verified: 2026-05-31T00:00:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Phase 090: Harness Schema + RLS + Config Models — Verification Report

**Phase Goal:** The Postgres substrate for workflows exists — versioned immutable-on-publish definitions, run/phase tables, an audit trail — all RLS-scoped via the proven FK chain, with typed Pydantic models that parse the phase-config JSONB.
**Verified:** 2026-05-31T00:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC#1 | Migrations 056–059 create the 4 tables + `threads.active_workflow_run_id`; applied via SQL editor; `full-schema.sql` regenerated | VERIFIED | `full-schema.sql` (2398 lines) contains all 4 tables + `active_workflow_run_id` FK to `workflow_runs`; commits `3c0a4700` + `a08cf725` capture the regen after 059 and after 060 respectively |
| SC#2 | `workflow_definitions` is immutable-on-publish: `UNIQUE(slug,version)` + `BEFORE UPDATE` trigger (raises SQLSTATE 23514 on post-publish update) + `ON DELETE RESTRICT` FK | VERIFIED | Trigger function `workflow_definitions_block_published_update()` present in `full-schema.sql` (line 226) keyed on `OLD.status = 'published'` with `ERRCODE = 'check_violation'`; `ON DELETE RESTRICT` confirmed at line 1682; live blocks A/B/C all PASS per 090-03-SUMMARY |
| SC#3 | Cross-user reads of `workflow_runs`, `workflow_phases`, and `harness_audit` are denied by RLS (FK chain through `threads.user_id`); `harness_audit` is INSERT-only | VERIFIED | `full-schema.sql` confirms: `workflow_runs` 1-hop RLS (`SELECT user_id FROM threads WHERE id = thread_id`), `workflow_phases` 2-hop JOIN RLS, `harness_audit` has only SELECT + INSERT policies (no UPDATE/DELETE); live blocks D/E PASS per 090-03-SUMMARY |
| SC#4 | `threads.deep_mode_metadata` NOT created; every new table carries `org_id uuid NULL` | VERIFIED | Grep of `full-schema.sql` returns 0 hits for `deep_mode_metadata`; `org_id` column confirmed on all 4 tables (harness_audit line 437, workflow_definitions line 696, workflow_phases line 721, workflow_runs line 745) with matching comments; live block F PASS |
| SC#5 | `app/models/harness.py` Pydantic models parse a seed workflow and reject malformed config with a structured error | VERIFIED | `pytest tests/unit/test_harness_models.py -v` exits 0 — **8/8 passed** (confirmed live run in this verification session): `test_valid_seed_parses`, `test_extra_key_rejected`, `test_wrong_phase_type_rejected`, `test_each_phase_config_validates[programmatic/llm_single/llm_agent/llm_batch_agents/llm_human_input]` |

**Score:** 5/5 ROADMAP truths verified

### Plan must-haves (merged from all 3 PLANs)

| # | Must-Have | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `WorkflowDefinition.model_validate()` parses a valid seed workflow's phases JSONB into typed phase configs | VERIFIED | `test_valid_seed_parses` PASS; 5-phase VALID_SEED with all phase types resolves to correct concrete subclasses |
| 2 | A malformed phase config (unknown key) raises `ValidationError` (D-07 extra='forbid') | VERIFIED | `test_extra_key_rejected` PASS; `_StrictBase` carries `ConfigDict(extra="forbid")` confirmed in `harness.py:27` |
| 3 | A wrong `phase_type` discriminator raises `ValidationError` | VERIFIED | `test_wrong_phase_type_rejected` PASS; `Field(discriminator="phase_type")` confirmed at `harness.py:70` |
| 4 | `workflow_definitions` has UNIQUE(slug,version), owner+global RLS, immutable-on-publish trigger | VERIFIED | `056_workflow_definitions.sql` lines 29, 41-65, 81-99; trigger keyed on `OLD.status = 'published'` |
| 5 | `workflow_runs` FK to `workflow_definitions` is `ON DELETE RESTRICT`; 1-hop RLS via threads.user_id | VERIFIED | `057_workflow_runs.sql:17` + `full-schema.sql:1682`; 4 RLS policies with `SELECT user_id FROM threads WHERE id = thread_id` |
| 6 | `harness_audit` has SELECT + INSERT RLS policies only — no UPDATE/DELETE (INSERT-only) | VERIFIED | `059_harness_audit_and_threads_col.sql` creates exactly 2 policies; `full-schema.sql` lines 1804 + 2009 confirm only those 2; live block E PASS |
| 7 | `threads` gains `active_workflow_run_id`; `deep_mode_metadata` NOT added | VERIFIED | `full-schema.sql:634` + `1626`; zero hits for `deep_mode_metadata` in `full-schema.sql`; live block F PASS |
| 8 | Every new table carries `org_id uuid NULL` with no FK | VERIFIED | Confirmed on all 4 tables in `full-schema.sql` with forward-compat COMMENT; block F PASS |

**Score:** 8/8 plan must-haves verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/harness.py` | PhaseConfig discriminated union (5 phase types) + ValidatorSpec + PhaseSpec + WorkflowDefinition, all extra='forbid' | VERIFIED | 96 lines; `_StrictBase` with `extra="forbid"`; all 5 phase types with `Literal` discriminators; `Field(discriminator="phase_type")`; imports cleanly (`python -c "..."` → `ok`) |
| `backend/tests/unit/test_harness_models.py` | 4 test cases, 8 collected (5 from parametrize), no Supabase client import | VERIFIED | 8/8 PASS confirmed in live pytest run; `pytest.raises(ValidationError)` in 2 tests; `@pytest.mark.parametrize` over 5 phase types; zero `from app.db` or Supabase client import |
| `supabase/verify_090.sql` | 6-block live-DB verification script | VERIFIED | File exists; all 6 blocks A–F present with SQLSTATE references (23514/23503/23505), `request.jwt.claims`, `pg_policies`, `information_schema` |
| `supabase/verify_090_run.sql` | Auto-reporting single-paste verification companion (added in Plan 03) | VERIFIED | File exists; self-contained; seeds own data; uses `SET ROLE authenticated`; prints PASS/FAIL grid; ROLLBACKs; block G regression added post-WR-01 |
| `supabase/migrations/056_workflow_definitions.sql` | workflow_definitions table + RLS + trigger + seed | VERIFIED | 152 lines; all required elements confirmed by grep and live apply |
| `supabase/migrations/057_workflow_runs.sql` | workflow_runs + RESTRICT FK + 1-hop RLS | VERIFIED | 59 lines; `ON DELETE RESTRICT` on `definition_id`; 4 RLS policies confirmed |
| `supabase/migrations/058_workflow_phases.sql` | workflow_phases + 2-hop RLS + composite index | VERIFIED | 86 lines; 4 RLS policies with `JOIN workflow_runs wr ON wr.thread_id = t.id`; `idx_workflow_phases_run` index confirmed |
| `supabase/migrations/059_harness_audit_and_threads_col.sql` | INSERT-only harness_audit + threads column | VERIFIED | 65 lines; plain `run_id uuid` (no REFERENCES); exactly SELECT + INSERT policies; `ADD COLUMN active_workflow_run_id`; no `deep_mode_metadata` |
| `supabase/migrations/060_harness_update_with_check.sql` | UPDATE WITH CHECK guards (WR-01 code-review fix) | VERIFIED | 55 lines; re-creates UPDATE policies for workflow_definitions (with `is_global = false`), workflow_runs, workflow_phases; applied live (commit `912433f0`); reflected in `full-schema.sql` |
| `supabase/full-schema.sql` | Regenerated single-file deploy artifact (4 tables + trigger + RLS + threads column) | VERIFIED | 2398 lines; all 4 tables present; `workflow_definitions_block_published_update` function; `ON DELETE RESTRICT` FK; WITH CHECK on update policies for all 3 tables; `active_workflow_run_id` on threads; `deep_mode_metadata` absent |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `test_harness_models.py` | `harness.py` | `from app.models.harness import WorkflowDefinition` | WIRED | Import confirmed at line 28-36 of test file |
| `WorkflowDefinition` | `PhaseConfig` discriminated union | `PhaseSpec.config` field + `Field(discriminator="phase_type")` | WIRED | `harness.py:86` wires `config: PhaseConfig` using the discriminated union at line 62-71 |
| `workflow_runs.definition_id` | `workflow_definitions.id` | FK `ON DELETE RESTRICT` | WIRED | `057_workflow_runs.sql:17`; `full-schema.sql:1682`; live block B confirms RESTRICT behavior (23503) |
| `workflow_phases` RLS | `threads.user_id` | 2-hop JOIN through `workflow_runs` | WIRED | `058_workflow_phases.sql:39-77`; `full-schema.sql:2267-2283` confirms 2-hop JOIN in SELECT + UPDATE policies |
| `threads.active_workflow_run_id` | `workflow_runs.id` | FK `ON DELETE SET NULL` | WIRED | `059_harness_audit_and_threads_col.sql:61`; `full-schema.sql:1625-1626` confirms FK constraint |
| `056` INSERT guard | is_global self-promotion prevention | `WITH CHECK (auth.uid() = created_by AND is_global = false)` | WIRED | `full-schema.sql:1839` (INSERT) + `1930` (UPDATE); migration 060 extended the guard to UPDATE; live block G confirms 42501 denial |

---

## Data-Flow Trace (Level 4)

Not applicable — this is a schema + Pydantic models phase with no frontend rendering or live data pipeline. The data flows (migration → live DB → Pydantic parse) were verified via live-DB SQL (verify_090_run.sql) and mocked pytest respectively.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `harness.py` imports without error | `python -c "from app.models.harness import WorkflowDefinition, PhaseConfig, ValidatorSpec; print('ok')"` | `ok` | PASS |
| All 8 model tests pass | `pytest tests/unit/test_harness_models.py -v` | `8 passed, 1 warning` | PASS |
| `full-schema.sql` contains all 4 new tables | grep in `full-schema.sql` | `harness_audit`, `workflow_definitions`, `workflow_phases`, `workflow_runs` — all present | PASS |
| `full-schema.sql` has `active_workflow_run_id` and no `deep_mode_metadata` | grep | `active_workflow_run_id` at lines 634, 1210, 1626; `deep_mode_metadata` — 0 hits | PASS |
| Immutable-on-publish trigger present in schema | grep `block_published` in `full-schema.sql` | Function + trigger both present (lines 223-236, 1354-1357) | PASS |
| Live-DB blocks A–G (verify_090_run.sql) | Operator-run in Supabase SQL editor | All 8 blocks PASS — recorded in 090-03-SUMMARY.md | PASS |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| HARNESS-02 | 090-01, 090-02, 090-03 | Workflow definitions are versioned and immutable-on-publish (`UNIQUE(slug,version)` + `BEFORE UPDATE` trigger + FK `ON DELETE RESTRICT`) | SATISFIED | Trigger in `056` (SQLSTATE 23514 on post-publish UPDATE); RESTRICT FK in `057`; UNIQUE in `056`; live blocks A/B/C PASS |
| HARNESS-06 | 090-01, 090-02, 090-03 | Every phase transition, gate result, and tool refusal recorded to an INSERT-only `harness_audit` trail | SATISFIED | `harness_audit` created in `059` with SELECT + INSERT policies only (no UPDATE/DELETE); event_type CHECK includes `phase_transition`, `gate_passed`, `gate_failed`, `tool_refused`; live block E PASS |

No orphaned requirements — REQUIREMENTS.md maps exactly HARNESS-02 and HARNESS-06 to Phase 090, both satisfied.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `verify_090.sql` | 75 | `status='running'` not in the `workflow_runs` CHECK set (code review WR-03) | Warning | Fixed by migration 060 review; `verify_090_run.sql` (the authoritative live gate) correctly uses `'active'`; `verify_090.sql` is now the secondary manual script |
| `harness.py` | 45-54 | Provisional `max_steps`, `max_parallel_agents`, `merge_strategy` fields lack int bounds / Literal constraints (code review IN-01/IN-02) | Info | Documented PROVISIONAL per RESEARCH A1; intentional deferral to Phase 091; not a runtime blocker |
| `harness.py` | 78 | `ValidatorSpec.config: dict` is untyped (intentionally schemaless at this layer, code review IN-03) | Info | Intentional design; per-kind validation is Phase 091's scope |
| `057_workflow_runs.sql` | 20 | `current_phase_id uuid` has no FK and no explaining comment (code review WR-04) | Info | Not fixed in this phase; Phase 091 (engine) owns the integrity invariant; no runtime impact in 090 |

No anti-patterns classify as blockers. The WR-03 stale-status issue in `verify_090.sql` does not affect the authoritative live verification gate (`verify_090_run.sql`).

---

## Human Verification Required

None. All success criteria were verified either by automated pytest (SC#5) or by the operator-run live-DB gate (`verify_090_run.sql`, all 8 blocks A–G PASS, documented in 090-03-SUMMARY.md). This phase has no UI surface and no external service integration.

---

## Gaps Summary

No gaps. All 5 ROADMAP success criteria and all 8 plan must-haves are verified. The code-review warnings (WR-01 through WR-04) were addressed: WR-01 (UPDATE WITH CHECK) was fixed via migration 060 applied live; WR-02 (verify block D direct-PK queries) and WR-03 (status='running' → 'active') were fixed in `verify_090_run.sql`; WR-04 (undocumented `current_phase_id`) is an info-level item deferred to Phase 091 per design intent. The pre-existing ~98 pytest failures in unrelated test files (e.g., `test_sql_service` async drift) predate this phase and are not caused by it.

---

_Verified: 2026-05-31T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
