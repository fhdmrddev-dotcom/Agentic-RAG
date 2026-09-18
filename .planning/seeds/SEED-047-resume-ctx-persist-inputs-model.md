---
seed_id: SEED-047
title: Resume context must rehydrate run inputs + model — persist them at workflow_runs creation
status: closed
closed: 2026-06-07 (v2.8 milestone audit close-out)
closed_evidence: "Fix landed across 092 (migration 063 persists workflow_runs.inputs/model at creation; kickoff_prompt threaded into wf_ctx + both resume ctxs) + 093 (resolve_workflow_ctx_model). Code-verified: harness_engine.py:1126-1178 rehydrates inputs from the durable wr.inputs row + resolves model via resolve_workflow_ctx_model(load_user_settings(owner)) — never model=''. Proof gate (096 EVAL-02 live kill-and-resume) PASSED 2026-06-07: all 3 kill points incl. the llm_agent leg (run 834b6a7e) completed post-restart with a real model."
planted: 2026-05-31
planted_by: orchestrator (091-08 gap-closure — 091-REVIEW WR-01/WR-02 deferral)
trigger_when: Phase 092 wires workflow-run creation — persist run inputs + model on the workflow_runs row so the resume ctx can rehydrate them; Phase 096 EVAL-02 (live kill-and-resume) is the proof gate
priority: medium
tags: [backend/harness, resumability, phase-091, phase-092, phase-096, workflow_runs]
surface: Agentic-RAG
---

# SEED-047: Resume Context — Persist Run Inputs + Model at Run Creation

## Context

The Phase 091 code review (`091-REVIEW.md`) surfaced two warnings on the resume path that could **not** be fixed inside Phase 091:

- **WR-01 — resume ctx is missing `inputs`.** `_build_resume_context` (harness_engine.py) builds a `SimpleNamespace` with `run_id/thread_id/current_user/redis/pool/emit/retry_feedback` but NOT `inputs`. `_exec_programmatic` reads `getattr(ctx, "inputs", None) or {}` to resolve top-level run inputs (e.g. the `literature_review` seed's `split_topic` reads `input_keys=["topic"]`). On resume, `run_inputs` is `{}`, so `split_topic` receives no `topic`, returns `{"sub_questions": []}`, and the downstream `llm_batch_agents` degrades to a single agent on the raw prompt. (A `programmatic` phase whose input came from a *prior completed phase* still works — it reads `accumulated_outputs`; only a top-level run input is lost.)

- **WR-02 — resume ctx is missing `model` / `user_settings` / `supabase`.** The resume ctx omits `user_settings`, `supabase`, `model`, `folder_subtree_ids`, `scoped_folder_path`, `spawn`, `per_run_task_semaphore`. `_exec_llm_single` / `_exec_llm_agent` read `getattr(ctx, "user_settings", None)` and `_effective_model` falls back to `""` when `ctx.model` is absent — so a resumed `llm_single` / `llm_agent` phase calls the LLM with `model=""` and `user_settings=None` (unsafe — fails or routes unpredictably). The `llm_human_input` durable-prompt insert also no-ops because `supabase` is None.

## Why deferred (not fixable in 091)

The proper fix requires persisting run inputs + model **at workflow_runs CREATION**, which does not exist in Phase 091 — there is **no `INSERT INTO workflow_runs` anywhere in `backend/app`** in this phase. Run creation and per-run context construction are owned by **Phase 092 (dual-mode + Continue)**. Fixing the resume ctx without a durable source to rehydrate from would just move the gap, so both warnings were deferred at 091-08 (the gap-closure plan that fixed CR-01/CR-02/WR-03/WR-04/WR-05/WR-06/IN-01).

The deterministic unit proof for resume *mechanics* (2-phase write, claim CAS, ask_user re-subscribe) stands — this seed is specifically about the resume *context payload* being complete enough for LLM / top-level-input phases.

## Re-open trigger

Promote / fold into **Phase 092** when run-creation is wired. Concretely:

1. Phase 092 run-creation must persist `workflow_runs.inputs` (the top-level run input map) AND `model` (the model the run was started with) on the row.
2. `_build_resume_context` rehydrates `inputs` + `model` (and ideally `user_settings`) from that row into the resume ctx, so a resumed `programmatic` phase gets its `topic` and a resumed `llm_*` phase re-runs with the SAME model as the original execution.
3. **Phase 096 EVAL-02 (live kill-and-resume)** is the proof gate — a real workflow killed mid-run and resumed must produce the same model + non-empty inputs, not a degraded single-agent fallback.

Until then, resumed LLM / top-level-input phases are a **known live-resume limitation** documented in 091-REVIEW.

## Likely shape if promoted

- Migration: ensure `workflow_runs` carries `inputs jsonb` + `model text` (check what Phase 092's run-creation already adds before adding columns).
- `create_run(...)` (Phase 092) writes `inputs` + `model` at INSERT.
- `_build_resume_context` SELECTs them back and seeds `ctx.inputs` / `ctx.model` / `ctx.user_settings`.
- EVAL-02 row in Phase 096 VALIDATION: kill a `literature_review`-style run after phase 1, resume, assert `split_topic` got `topic` and `llm_*` re-ran on the original model.
