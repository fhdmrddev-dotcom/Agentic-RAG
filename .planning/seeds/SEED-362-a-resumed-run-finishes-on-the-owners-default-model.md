---
seed_id: SEED-362
title: A paused workflow run that is answered finishes on the OWNER'S DEFAULT model, not the model it started on, and nothing on the run records the switch
created: 2026-10-19
surface: Agentic-RAG
status: answered
partial: false
status_note: "ANSWERED by Phase 296: the kickoff records the run's provider in workflow_runs.metadata in the same INSERT (296-02 create_workflow_run(provider=) + 296-06 04618f10e passing it from the in-app kickoff), and a resumed / re-driven run continues on workflow_runs.model + that provider, never the owner's current default (296-02 RED 0d3d4d8d0, GREEN bf8a4467b). LIVE check owed after a backend restart: at 296-05 the running :8000 predated the 296-06 merge (its /openapi.json lacked 296-06's schemas), so no live run carried metadata.provider; scripts/run-296-board.py --resume-model is the re-run (it asserts the RECORD — model + metadata.provider — because the resume shell's runs row is the placeholder 'unknown' by design and nothing else names the model)."
trigger_when: "The next phase touching harness_engine._build_resume_context or the resume sweep; or any per-run model guarantee (cost, compliance, 'this run used model X'); or a report that a resumed run's output reads in a different model's voice."
trigger_paths: ["backend/app/services/harness_engine.py", "backend/app/services/sub_agent_models.py", "backend/app/api/runs.py"]
trigger_surfaces: ["harness", "provider", "workflow"]
migration_note:
relates_to: ["SEED-360", ".planning/phases/289-the-run-page-and-its-evidence/289-VALIDATION.md (scoreboard row d)", ".planning/phases/289-the-run-page-and-its-evidence/289-RESEARCH.md (Not fixed)"]
folded_into: "296"
renumbered_from: null
renumbered_because: null
---

# SEED-362: a resumed run changes model without saying so

## Measured (289-05, 2026-10-19)

Ten workflow runs were started with a per-request `model` + `provider` (gpt-5.6-sol, gemini-3.5-flash,
deepseek-v4-pro, glm-5.2, MiniMax-M3, kimi-k2.6, z-ai/glm-5.2, and three deepseek-v4-pro axis rows),
left to pause on a human step, and answered one at a time. In the `:8000` log, every provider request
after each run's `re-drove paused run <id>` line went to **`api.deepseek.com`**, the owner's default
(`app_settings.llm_model = deepseek-v4-flash`). The OpenAI-started run included.

- `workflow_runs.model` still reads the per-request id, so the record says the run used gpt-5.6-sol.
- The resume shell's `runs` row says `model = unknown`, `provider = unknown` (a deliberate placeholder).
- Cause: `_build_resume_context` resolves `resolve_workflow_ctx_model(owner settings)`
  (`harness_engine.py`), not `workflow_runs.model`.

## Why it matters

The evidence report (Phase 289) shows `run.model` as the run's model. After a pause, that is true
for the steps before the pause only. A per-provider run is silently finished by another provider,
which defeats the cross-provider scoreboard's own premise and any "this run used model X" claim.

## What would close it

Resolve the resumed ctx model from `workflow_runs.model` (and its provider) when present, falling back
to the owner default only when the run recorded none. Re-drive the 289 roster's row (d) to prove it.
