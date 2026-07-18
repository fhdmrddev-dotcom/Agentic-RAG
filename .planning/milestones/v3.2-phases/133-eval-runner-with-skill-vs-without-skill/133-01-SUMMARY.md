---
phase: 133-eval-runner-with-skill-vs-without-skill
plan: 01
subsystem: eval-persistence
tags: [migration, rls, pydantic, eval-runner, supabase]
requires:
  - "skill_versions table (mig 079, Phase 132 D-10 FK target)"
  - "skill_test_cases table (mig 079, Phase 132 D-10 FK target)"
provides:
  - "public.eval_runs table (one durable row per eval run, single provider/model — D-01/D-08)"
  - "public.eval_results table (one row per test_case × variant, provider-keyed — D-02/D-04)"
  - "StartEvalRunBody / EvalRunResponse / EvalResultResponse Pydantic models"
affects:
  - "supabase/full-schema.sql (regenerated — now contains eval_runs + eval_results)"
tech-stack:
  added: []
  patterns:
    - "owner-only RLS SELECT as defense-in-depth; service-role write + app-code .eq(user_id) as real gate (035/079 precedent)"
    - "durable run-audit status enum (running/completed/failed/cancelled/interrupted — 035 precedent)"
    - "flat single-typed Pydantic fields (str | None / int | None) — Gemini multi-type schema trap avoided"
key-files:
  created:
    - "supabase/migrations/080_eval_runs_and_results.sql"
    - "backend/app/models/eval_run.py"
  modified:
    - "supabase/full-schema.sql"
decisions:
  - "eval_runs.id doubles as the stream run_id (companion public.runs row uses the same UUID — no separate run_id column)"
  - "provider/model live on eval_runs (single-provider/run, D-01) AND are copied to eval_results (provider-keyed, D-02) so multi-provider fan-out is additive"
metrics:
  duration: "~15 min (excluding human-action checkpoint)"
  completed: "2026-06-30"
  tasks: 2
  files: 3
---

# Phase 133 Plan 01: Eval Runner Persistence Foundation Summary

Migration 080 lands the `eval_runs` + `eval_results` tables (the persistence layer Phase 132 D-09 deferred) with owner-only RLS, FK CASCADE traceability to `skill_versions`/`skill_test_cases` (D-10), provider-keyed results (D-02), and a `with_skill`/`without_skill` discriminator (D-04); plus the flat single-typed Pydantic request/response models the runner service + router will consume.

## What Was Built

**Task 1 — Migration 080 SQL + Pydantic models (commit `1a7eedee`)**
- `supabase/migrations/080_eval_runs_and_results.sql`:
  - `public.eval_runs` — `id` (PK, doubles as stream run_id), `skill_id` FK→skills CASCADE, `skill_version_id` FK→skill_versions CASCADE (D-10), `user_id` FK→auth.users CASCADE, `provider`/`model` (D-01), `status` CHECK in running/completed/failed/cancelled/interrupted default running (035 durable-audit precedent), `case_count`, `error`, `created_at`, `completed_at`. Indexes on every FK + user_id.
  - `public.eval_results` — `id` PK, `eval_run_id` FK→eval_runs CASCADE, `test_case_id` FK→skill_test_cases CASCADE (D-10), `user_id` FK CASCADE, `variant` CHECK in with_skill/without_skill (D-04), `provider`/`model` (D-02), `output` default '', `status` CHECK in completed/failed/timed_out/cancelled, `error`, `input_tokens`, `output_tokens`, `created_at`. Indexes on every FK + user_id.
  - RLS: both tables `ENABLE ROW LEVEL SECURITY`; owner-only SELECT policies `USING (auth.uid() = user_id)`; **no INSERT/UPDATE/DELETE policies** (service-role background task is the only writer — 035/079 precedent, T-133-EoP). `COMMENT ON TABLE` on both citing EVAL-02 + D-02/D-04/D-08 + Phase-132 D-10.
- `backend/app/models/eval_run.py`: `from __future__ import annotations`, plain `BaseModel`. `StartEvalRunBody {provider, model}` (skill_id/user_id from path + caller, never the body — T-132-07). `EvalRunResponse` + `EvalResultResponse` mirror every table column with flat single-typed fields (`str | None` / `int | None` / `datetime | None` — never a multi-type union, Gemini schema trap).

**Task 2 — Apply migration 080 (checkpoint:human-action, orchestrator-applied)**
- Orchestrator applied migration 080 to the live LOCAL DB via psycopg2 :54322 (NOT `db push`/`db reset` — dev data preserved, T-133-DATA).
- `SELECT to_regclass('public.eval_runs'), to_regclass('public.eval_results')` returned both non-null.
- `supabase/full-schema.sql` regenerated via `bash scripts/regenerate-full-schema.sh` (no `--reset`) and committed at `594ed328` — now contains `eval_runs` + `eval_results`.

## Verification

- `python -c "from app.models.eval_run import StartEvalRunBody, EvalRunResponse, EvalResultResponse"` exits 0 (re-confirmed after checkpoint).
- Migration acceptance greps: `CREATE TABLE public.eval_runs` = 1; `REFERENCES public.skill_versions` = 1; `REFERENCES public.skill_test_cases` = 1; `FOR SELECT USING (auth.uid() = user_id)` = 2; `FOR INSERT|UPDATE|DELETE` = 0; `with_skill` present.
- Both tables resolve via `to_regclass` on the live local DB (orchestrator-confirmed).
- `full-schema.sql` contains both `eval_runs` and `eval_results` (grep = 1 each).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan creates schema + models only (no UI, no data-source wiring); the runner service + router land in later plans of this phase.

## Self-Check: PASSED

- FOUND: supabase/migrations/080_eval_runs_and_results.sql
- FOUND: backend/app/models/eval_run.py
- FOUND: supabase/full-schema.sql contains eval_runs + eval_results
- FOUND commit: 1a7eedee (feat 133-01 — migration + models)
- FOUND commit: 594ed328 (chore 133-01 — full-schema regen)
