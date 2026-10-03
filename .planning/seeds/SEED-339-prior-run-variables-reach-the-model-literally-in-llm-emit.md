---
seed_id: SEED-339
title: "`{{prior_run.*}}` is never filled in for an `llm_emit` step — the step that writes the deliverable sends the literal placeholder to the model"
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Any phase whose files_modified names backend/app/services/harness/phase_types.py or forced_emit.py; OR any phase that picks up SEED-167 (living register / update-in-place); OR a stateful workflow's deliverable mentions '{{prior_run' or ignores last run's output."
trigger_paths: ["backend/app/services/harness/phase_types.py", "backend/app/services/forced_emit.py", "backend/app/services/harness_engine.py"]
trigger_surfaces: ["harness", "workflow"]
migration_note:
relates_to: ["SEED-167 (stateful workflows; its STATE-READ half shipped in Phase 205)", "Phase 205 STATE-01", "docs/history/v3.8-document-intelligence-automations-connectors.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-339: `{{prior_run.*}}` stays literal in `llm_emit`

## The finding

Phase 205 (STATE-01) lets a stateful workflow read its own last output through
`{{prior_run.output}}`, `{{prior_run.id}}` and `{{prior_run.created_at}}`. The resolver is
`_interpolate_prior_run_variables` (`backend/app/services/harness/phase_types.py:215`). Measured
2026-10-04, it is called by three executors only:

| Executor | Call site |
|---|---|
| `_exec_llm_single` | `phase_types.py:802` |
| `_exec_llm_agent` | `phase_types.py:881` |
| `_exec_llm_batch_agents` | `phase_types.py:980` |
| **`_exec_llm_emit`** | **none.** `phase_types.py:1496-1501` builds `system_prompt = phase.config.prompt + _skill_block(...) + _wired_services_block(ctx) + _retry_suffix(ctx)`, with no interpolation |

So in an `llm_emit` step (the only step that produces a typed deliverable), the model receives the
text `{{prior_run.output}}` itself. The v3.8 close recorded this ("stateful variables reach 3 of 7
executors, missing `llm_emit`"). The tree still has it.

## Why it matters

The living-register use case in SEED-167 (read last week's register, update it, emit the new one) puts
`{{prior_run.output}}` in exactly the step that writes the register. Today that step cannot see the
previous version, and nothing fails: the model either invents a prior state or treats the placeholder as
text. The run looks like it worked.

## When to surface

The next phase that edits `phase_types.py` or `forced_emit.py`, or any phase that picks up SEED-167.

## Scope estimate

Small. Apply the same `_interpolate_prior_run_variables(phase.config.prompt, ctx.prior_run)` call (and
the stateful framing the other three attach) in `_exec_llm_emit`. Add a test that drives an emit step
with a non-empty `ctx.prior_run` and asserts the placeholder is absent from the prompt the provider
receives. Keep the cold-start baseline notice.

## Breadcrumbs

- `docs/history/v3.8-document-intelligence-automations-connectors.md` (Gaps: "Stateful variables reach 3 of 7 executors")
- `.planning/seeds/SEED-167-incremental-stateful-workflows-living-register.md` `status_note`
