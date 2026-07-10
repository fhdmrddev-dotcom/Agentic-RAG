---
id: SEED-097
status: planted
planted: 2026-06-29
planted_during: v3.2 Phase 132 plan-phase (plan-checker Dimension 10 warning on the new skill_test_cases router)
trigger_when: A perf/scaling pass on the FastAPI backend, OR any phase that adds a new router and wants to do it right, OR observed event-loop stalls under multi-worker load
scope: Medium
related: [[feedback_separate_per_feature_safe_by_construction]] (root-cause over band-aid)
re_open_trigger: v3.3 Operator UX / scale-hardening, or first observed async-handler latency spike
---

# SEED-097: Backfill `run_in_threadpool` across sync-supabase-in-async handlers

## Why this matters

CLAUDE.md **D-v2.5-01** is explicit: "Do not run blocking I/O (e.g. `supabase-py` calls) directly inside async handlers — wrap with `run_in_threadpool`." But the prevailing convention in `backend/app/api/skills.py` (and likely sibling routers) calls the **sync** supabase client directly inside `async def` handlers, which blocks the uvicorn event loop. With multi-worker uvicorn the default (`WORKER_COUNT=2`) and the project targeting org-scale, this is a latent throughput ceiling: every blocking DB call freezes that worker's loop for the duration.

This is a **codebase-wide** tech-debt pattern, not a single-route bug — so fixing it one router at a time (e.g. forcing the new Phase 132 `skill_test_cases` router to diverge) would create inconsistency without fixing the real problem. **Phase 132 deliberately matched the prevailing convention** (plan-checker WARNING accepted) and deferred the holistic fix here.

## Scope of the fix

1. Audit every `async def` route handler that calls the sync supabase client directly (start: `skills.py`, `skill_test_cases.py` (new in 132), then sweep `backend/app/api/*.py`).
2. Wrap blocking supabase calls in `fastapi.concurrency.run_in_threadpool` (or convert the helpers to a consistent threadpool-wrapped data-access layer).
3. Verify no behavior change; add/adjust tests; measure event-loop responsiveness under concurrent load before/after.

## When to surface

At a backend perf/scale-hardening pass (v3.3+ Operator UX or earlier if latency is observed). Pairs naturally with any "add a new router" phase as the moment to also correct the prevailing pattern. Low correctness risk; medium breadth.
