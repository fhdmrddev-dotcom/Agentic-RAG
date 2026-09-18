---
seed_id: SEED-025
title: Sandbox execution telemetry — track Python/code-execution success-after-retry, failure patterns, and per-skill exec stats invisible in current LangSmith view
status: planted
planted: 2026-05-17
phase_origin: 073-asyncpg-pool-integration (user-observed during post-073 testing — pptx skill code-exec failure self-corrected by agent but never surfaced in observability)
related_seeds: [SEED-002, SEED-023, SEED-024]
relates_to:
  - `backend/app/services/sandbox_service.py` — Docker `llm-sandbox` execution path (gated by SANDBOX_ENABLED)
  - `backend/app/api/threads.py` — agent-loop tool-call dispatch for Python execution
  - LangSmith trace structure — sandbox executions appear as nested tool-call sub-traces inside the parent agent run; if the parent run succeeds (because the agent self-corrects after failed exec), the failed exec never appears in a "failed runs" query
  - Phase 073 `runs.input_tokens` / `output_tokens` columns — telemetry foundation that should extend to sandbox exec metrics
  - SEED-002 — Skill Studio Milestone Preparation (skills + eval surface will need exec telemetry to score skill quality)

re_open_triggers:
  - Any user report of "the agent's first Python attempt failed but it retried and worked" — already triggered organically 2026-05-17 (pptx skill, PIE chart `ValueError`, self-corrected on retry)
  - When SEED-002 Skill Studio milestone (v3.0) plans the skill eval rubric — per-skill exec success rate + retry count are first-class eval metrics
  - When v3.1 admin shell plans the active-runs / observability dashboard — sandbox exec rate is a load + reliability signal
  - When the operator reports a skill that "feels flaky" but runs nominally complete — exec retry rate is the missing visibility

priority: medium
suggested_phase: v3.0 (Skill Studio) primary owner — exec telemetry is a prerequisite for skill quality eval. Could pre-stage in v2.6 Phase 077 (Multi-Worker Validation Harness — natural pair with backpressure telemetry) if Skill Studio scope grows.
surface: Agentic-RAG
trigger_when: unset
---

# SEED-025 — Sandbox execution telemetry

## What we observed

A user-driven chat 2026-05-17 invoked the `pptx` skill on the "Fahed Mrad dissertation" document. The agent's flow:

1. Loaded `pptx` skill ✓
2. Analyzed source PDF ✓
3. Wrote slide-by-slide outline ✓
4. Attempted Python execution → **`ValueError` at `add_chart(slide, XL_CHART_TYPE.PIE, ...)`** (malformed PIE chart args)
5. Wrote corrected Python on retry ✓
6. Generated `fahed_mrad_dissertation_defense.pptx` ✓ (113.5 KB)

The user saw both the failure and the recovery in their chat UI. **Neither event landed in any queryable telemetry surface.** Specifically:

- `runs` table — only records the parent agent run (which succeeded). No row for the failed sandbox exec.
- `runs.error` — NULL because the parent didn't fail.
- LangSmith — the failed exec appears as a nested tool-call sub-trace inside an otherwise-successful root run; a "failed runs" query (which I just ran for the user) won't surface it.
- Backend logs — `print()` traces may or may not be captured depending on Docker stdout flow.

So a class of "the agent tried, failed, tried again, succeeded" is **completely invisible in operations data** — exactly the class of failure that a skill author would want to see to know "my skill is fragile; first-try success rate is 40%."

## Why this matters

Three downstream consumers need this data:

1. **Skill quality eval (v3.0 Skill Studio).** SEED-002 plans Skill Studio as the headline of v3.0. A skill author needs to see: "of the last 100 invocations of `pptx`, 73% succeeded first try, 22% succeeded on retry, 5% failed entirely." Without exec-level telemetry, skill quality is unmeasurable.
2. **Operator admin shell (v3.1).** Per v3.1 PRD §Theme F (`audit_log` browser) and active-runs view — sandbox exec rate is a load signal that informs `--workers N` decisions. A burst of retries means the sandbox is overloaded OR an upstream model dropped quality OR a skill has a bug.
3. **Cost truth (v3.4 spend caps).** Phase 073 just gave us `runs.input_tokens` / `output_tokens` — but a retry costs another full LLM call's tokens. Without exec telemetry, `runs.output_tokens` understates real cost for retry-heavy runs.

## What "good" looks like

### Piece 1 — `sandbox_executions` table (mirror of `pdf_extraction_runs`)

New telemetry table, populated by `sandbox_service.py` on every Python exec call:

```sql
create table sandbox_executions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id),
  user_id uuid not null,
  skill_slug text,                -- null if ad-hoc exec
  attempt_number int not null,    -- 1 = first try, 2+ = retry
  status text not null,           -- 'succeeded' | 'failed' | 'timed_out'
  error_class text,               -- 'ValueError', 'ImportError', etc. (truncated)
  error_message text,             -- first 500 chars
  duration_ms int not null,
  stdout_bytes int,
  stderr_bytes int,
  output_files int,               -- count of files produced
  created_at timestamptz default now()
);

create index on sandbox_executions(run_id);
create index on sandbox_executions(skill_slug, status, created_at desc);
create index on sandbox_executions(user_id, created_at desc);
```

RLS: users see their own rows; operator role sees all (v3.1 admin shell foundation).

### Piece 2 — Per-skill success metrics

Derived view + admin UI surface:

```sql
create view sandbox_skill_health as
select
  skill_slug,
  count(*) as total_execs,
  count(*) filter (where status = 'succeeded' and attempt_number = 1) as first_try_success,
  count(*) filter (where status = 'succeeded' and attempt_number > 1) as retry_success,
  count(*) filter (where status = 'failed') as failed,
  round(100.0 * count(*) filter (where status = 'succeeded' and attempt_number = 1) / count(*), 1) as first_try_pct,
  avg(duration_ms)::int as avg_duration_ms,
  max(created_at) as last_invoked
from sandbox_executions
where created_at > now() - interval '7 days'
group by skill_slug;
```

Skill authors (in v3.0 Skill Studio) consume this directly: "my `pptx` skill first-try success is 73%; the top error is `ValueError` at chart config. Time to fix my prompt template."

### Piece 3 — Retry-aware cost in `runs`

When a run retries Python exec N times, all N LLM-call costs already flow through Phase 073's `runs.input_tokens` / `output_tokens` summation (D-073-07 multi-iteration SUM semantics). The new exec telemetry doesn't change that — it just makes it possible to attribute "of your $0.12 run cost, $0.04 was a single retry on a flaky skill."

## Minimum viable slice

**MV-1 (small phase or fold into Phase 077):** Schema + sandbox_service.py wiring (Piece 1). Migration adds the table; sandbox_service writes rows on every exec call; no UI yet. Immediate value: queryable data for skill authors who write SQL.

**MV-2 (v3.0 Skill Studio scope):** Skill author UI consumes the `sandbox_skill_health` view (Piece 2). Each skill in the marketplace shows a health badge derived from this.

**MV-3 (v3.1 admin shell scope):** Operator dashboard renders sandbox exec rate alongside backpressure metrics. Surfaces "your sandbox is at 80% retry rate for the last hour" as a red flag.

## Out of scope (won't open here)

- Replaying failed sandbox execs (debugging tool — separate seed candidate)
- Skill version-pinning based on health scores (SEED-002 / v3.0 owns)
- Cross-user aggregate skill health (privacy — needs RLS exemption design; v3.2 multi-tenancy owns)

## Spike candidates before commitment

1. **`sandbox_service.py` instrumentation point** — confirm the right hook is "after Docker container exits" vs. "in agent-loop tool-call dispatcher." Decision affects whether the `run_id` linkage is straightforward or needs threading.
2. **Retry detection contract** — does the agent loop explicitly signal "this is a retry of the prior exec" or does telemetry have to infer it from `previous_exec_failed AND same parent run`? Cleaner if the dispatcher annotates explicitly.
3. **Stdout/stderr size cap** — large outputs (huge tracebacks, file dumps) shouldn't blow up the `sandbox_executions` row. Just store byte counts + first 500 chars of error.

## Cross-links to Phase 073 patterns

This seed should mirror Phase 073's wiring exactly:
- Migration: schema delta (per Phase 073's pattern of additive-only columns)
- Service hook: on-success + on-fail callbacks (mirror `_on_chunk_openai` / `_on_chunk_anthropic` shape from Plan 03)
- Closure-level accumulator: count + duration aggregation in the agent loop, written via a typed helper (mirror `app.db.runs.finalize_run` from Plan 02)
- Test gate: real-Postgres binding test against local :54322 (mirror Plan 04's `test_073_concurrency.py`)
- Logging contract: identifier-only (T-073-04 pattern — `run=%s skill=%s status=%s`; never log raw stdout/stderr)
