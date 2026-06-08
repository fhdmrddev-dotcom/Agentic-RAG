---
phase: 090-harness-schema-rls-config-models
plan: 01
subsystem: harness-config
tags: [pydantic, discriminated-union, strict-parsing, rls, verification, schema]
requires:
  - "Phase 090 migrations 056-059 (authored by Plan 02; verify_090.sql runs against them in Plan 03)"
provides:
  - "app.models.harness — WorkflowDefinition / PhaseSpec / PhaseConfig (5-member discriminated union) / ValidatorSpec, all extra='forbid'"
  - "test_harness_models.py — the only mocked-pytest verification for phase 090 (SC#5 / D-07)"
  - "supabase/verify_090.sql — 6-block live-DB gate (SC#1/#2/#3/#4 + HARNESS-06), run by Plan 03"
affects:
  - "Phase 091 (harness engine) consumes WorkflowDefinition.model_validate() to parse workflow_definitions.definition JSONB"
tech-stack:
  added: []
  patterns:
    - "Pydantic v2 discriminated union: Annotated[Union[...], Field(discriminator='phase_type')] (first in codebase)"
    - "ConfigDict(extra='forbid') strict parsing (D-07 — first strict-parse model in codebase)"
    - "Live-DB SQL verification script with -- EXPECT: comment lines + SQLSTATE assertions (first verify_*.sql in repo)"
key-files:
  created:
    - backend/app/models/harness.py
    - backend/tests/unit/test_harness_models.py
    - supabase/verify_090.sql
  modified: []
decisions:
  - "D-07: phase-config models use extra='forbid' (strict) — unknown/typo'd/injected key raises ValidationError before the 091 engine consumes it"
  - "Per-phase field names kept as the RESEARCH §Pattern 6 skeleton (PROVISIONAL per A1; Phase 091 may refine). The 5 phase_type literals + 4 validator kinds are FIRM."
  - "verify_090.sql authored before migrations exist (Wave 0 gate); it is a script artifact only — Plan 03 runs it against live Supabase (autonomous:false)."
metrics:
  duration: "~20 min"
  completed: "2026-05-30"
  tasks: 3
  files: 3
---

# Phase 090 Plan 01: Harness Config Models + Verification Artifacts Summary

Typed strict-parse config layer (Pydantic v2 discriminated union over 5 phase types, `extra='forbid'`) plus both phase-090 test artifacts: the only mocked-pytest test (SC#5 / D-07) and the 6-block `verify_090.sql` live-DB gate.

## What Was Built

**`backend/app/models/harness.py`** — the JSONB-parse layer for `workflow_definitions.definition`:
- `_StrictBase(BaseModel)` carrying `ConfigDict(extra="forbid")` — the FIRST strict-parse model in the codebase (D-07).
- 5 phase-config classes (`ProgrammaticPhaseConfig`, `LlmSinglePhaseConfig`, `LlmAgentPhaseConfig`, `LlmBatchAgentsPhaseConfig`, `LlmHumanInputPhaseConfig`), each with a `Literal[...]` `phase_type` discriminator.
- `PhaseConfig = Annotated[Union[...5...], Field(discriminator="phase_type")]`.
- `ValidatorSpec` (4 `kind` literals: json_schema / regex_match / workspace_file_exists / programmatic), `PhaseSpec`, `WorkflowDefinition`.
- Verified against pydantic 2.12.5: discriminator selects the right concrete class, unknown key + bad discriminator both raise `ValidationError`.

**`backend/tests/unit/test_harness_models.py`** — 4 test cases (8 collected, parametrized expands to 5), pure-Python, no Supabase client / conftest import:
- `test_valid_seed_parses` — 5-phase seed parses; each `.config` resolves to the expected concrete class.
- `test_extra_key_rejected` — unknown key raises `ValidationError` (D-07, threat T-090-01).
- `test_wrong_phase_type_rejected` — bad discriminator raises `ValidationError` (threat T-090-02).
- `test_each_phase_config_validates` — parametrized over all 5 phase types.

**`supabase/verify_090.sql`** — 6 labelled blocks A–F (the live-DB gate Plan 03 pastes into the SQL editor after migrations 056–059 apply):
- A: published-immutability trigger → SQLSTATE 23514 on post-publish UPDATE (draft→published allowed).
- B: DELETE RESTRICT on a referenced definition → 23503.
- C: `UNIQUE(slug, version)` collision → 23505.
- D: cross-user RLS denial via two auth contexts (`SET LOCAL "request.jwt.claims"`) → 0 rows.
- E: `harness_audit` INSERT-only (`pg_policies` shows only SELECT+INSERT; UPDATE denied).
- F: presence/absence introspection — 4 tables exist, `threads.active_workflow_run_id` present, `deep_mode_metadata` absent (D-12), `org_id` nullable on all 4 tables (D-11).

## How It Was Verified

- `harness.py` imports cleanly: `python -c "from app.models.harness import WorkflowDefinition, PhaseConfig, ValidatorSpec; print('ok')"` → `ok`.
- `pytest tests/unit/test_harness_models.py -x` → **8 passed** (the SC#5 / D-07 gate).
- Smoke test confirmed discriminator routing + extra-forbid + bad-discriminator rejection against pydantic 2.12.5.
- `verify_090.sql` acceptance grep: all 6 blocks A–F present; 23514 / 23503 / 23505, `request.jwt.claims`, `pg_policies`, `information_schema.columns`, `active_workflow_run_id`, `deep_mode_metadata` all present.

> **venv note:** the worktree has no `backend/venv` (gitignored, lives in the main tree). All pytest/import checks ran with the main repo's `backend/venv/Scripts/python.exe` (Python 3.12.6, pydantic 2.12.5) against the worktree's `backend/` as cwd — equivalent environment.

## Deviations from Plan

### Process deviation (worktree base)

The worktree was created from a stale base commit (`57cbe4ef`, the v2.7 release merge) that predated all phase-090 planning files. A non-destructive `git merge v2.5-dev` brought in the phase artifacts and current code (a `git reset --hard` was correctly blocked by the auto-mode classifier as a prohibited force-rewind; merge was used instead). No file conflicts. Not a plan-content deviation.

### Auto-fixed Issues

None — plan executed as written for all 3 tasks.

## Deferred Issues (out of scope)

Full-suite `pytest -q` reports `98 failed, 882 passed` — these are **pre-existing failures in files phase 090 does not touch** (e.g. `test_sql_service.py` calls the now-async `query_documents` without `await` → `coroutine never awaited`; stale-test-vs-async-code drift). The new additive files are import-clean (882 passes + clean collection prove no import breakage; `test_harness_models.py` 8/8 green). Logged to `deferred-items.md`. NOT fixed here per the executor scope boundary.

## Threat Surface

Both registered threats are mitigated and proven in mocked pytest:
- **T-090-01** (Tampering / V5, injected key in phase config) → `extra='forbid'`, proven by `test_extra_key_rejected`.
- **T-090-02** (spoofed `phase_type` discriminator) → discriminated union rejects, proven by `test_wrong_phase_type_rejected`.

No new security surface beyond the plan's threat model.

## Known Stubs

None. Per-phase field names inside the 5 phase configs are PROVISIONAL (RESEARCH A1) — Phase 091 may refine them — but the discriminator + `extra='forbid'` + union structure are LOCKED and fully functional. This is documented coordination, not a stub.

## Commits

- `8039a8b3` — feat(090-01): add harness Pydantic config models (discriminated union, extra=forbid)
- `6e9de1f0` — test(090-01): add harness model strict-parse tests (SC#5 / D-07)
- `d09702b6` — test(090-01): author verify_090.sql live-DB verification gate (6 blocks A-F)

## Self-Check: PASSED

All 3 created files + the SUMMARY exist on disk; all 3 task commits (8039a8b3, 6e9de1f0, d09702b6) exist in git history.
