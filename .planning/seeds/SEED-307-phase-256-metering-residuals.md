---
seed_id: SEED-307
title: Phase 256 metering residuals — fences blind to a Python-side sum, NULL/zero ambiguity, errored eval arms, NULL finalize defaults
created: 2026-09-24
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching run token persistence or the spend views (db/workflows.py persist_run_usage, circuit_breaker.py, eval_runner_service.py, run_lifecycle.py, db/rates.py, publish_service.py). Phase 268 (METER-08) fires on it.
trigger_paths: ["backend/app/db/workflows.py", "backend/app/services/circuit_breaker.py", "backend/app/services/eval_runner_service.py", "backend/app/services/run_lifecycle.py", "backend/app/db/rates.py", "backend/app/services/harness/publish_service.py", "backend/app/services/harness_engine.py", "backend/tests/unit/test_256_*.py"]
trigger_surfaces: [harness, admin]
migration_note:
relates_to: ["256", "257", "268", SEED-300, R265-256-02, R265-256-03, R265-256-04, R265-256-05, R265-256-06, R265-256-08, UAT-265-256-3-OBS]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-307: Phase 256 metering residuals

## The finding

These come from 265-REVIEW-256.md and the Phase 265 UAT log:

- R265-256-02: fence 1 does not catch a Python-side `sum()` over an un-narrowed SELECT.
- R265-256-03: the `persist_run_usage` call inside `_enforce_budget` is now redundant, and no test covers it.
- R265-256-04: IN-01 is still present. The record says "addressed_in: Phase 257", and that is false. When only one side is measured, the other side is persisted as 0 instead of NULL.
- R265-256-05: an eval arm that raises contributes no tokens, which contradicts its own comment.
- R265-256-06: the zombie sweep at `run_lifecycle.py:607` writes NULL tokens through a default parameter, and the SC#3 grep cannot see it.
- R265-256-08 (PLAUSIBLE): publish-judge spend reaches `workflow_runs` but never the org spend view.
- UAT-265-256-3-OBS (info): LangSmith labels an OpenAI judge call "ChatDeepseek".

## Why it matters

Each one either makes the dollar figure quietly lower than the truth or makes the trace harder to audit. None of them is large on its own.

## When to surface

See `trigger_when`. Check this against SEED-300 first, to avoid a duplicate.

## Scope estimate

Medium: six small backend changes plus their fences. Several touch G-5 hot files (`harness_engine.py`, `db/workflows.py`).

## Breadcrumbs

265-REVIEW-256.md · 265-UAT-LOG.md § 256 row 3.
