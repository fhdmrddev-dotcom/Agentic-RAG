---
seed_id: SEED-386
title: An agent step pinned to a model runs on that model — across providers, and on the same provider (the owner's default outranks the pin today)
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next phase whose files_modified names backend/app/services/task_service.py (_resolve_sub_agent_effective_model / resolve_sub_agent_model_safely), backend/app/services/sub_agent_models.py or harness/phase_types.py's _exec_llm_agent; or an author pins an agent step and reports it ran elsewhere. Touches Deep's task() resolver too — cross-provider UAT (SC#10) required.
trigger_paths: ["backend/app/services/task_service.py", "backend/app/services/sub_agent_models.py", "backend/app/services/harness/phase_types.py"]
trigger_surfaces: ["workflow", "harness", "provider"]
migration_note:
relates_to: ["296-INVENTORY 293-F-4", "296-06 c2a8f6ace (emit path routed; agent path told via a model_fallback notice)", "test_296_step_inputs_and_routing.py::test_f4_measure_the_agent_step_resolver_swaps_a_cross_provider_pin_silently"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-386: Agent steps run on the model they pin

## The finding

296-06 measured `_resolve_sub_agent_effective_model` (via `resolve_sub_agent_model_safely`) on an
`llm_agent` step:

- a CROSS-provider pin (`gpt-5.6-luna` on a DeepSeek owner) is swapped to the owner's model
  (`deepseek-v4-pro`), silently before 296;
- a SAME-provider pin (`gpt-5.6-luna` on an OpenAI owner whose `llm_model` is `gpt-5.5`) is ALSO
  swapped: the owner's `llm_model` outranks the pin.

296-06 (`c2a8f6ace`) routed the EMIT path to the pinned model's provider, and made the agent path
TELL the truth: one `model_fallback` sub-step and one `policy_applied` row, "This step asked for
{model}, which runs on another provider, so it ran on {used} instead." Routing agent steps (and
honouring a same-provider pin) is a capability that also changes Deep's `task()` resolver, so it is
this seed (D-03).

## Why it matters

An author who pins a stronger or cheaper model for one agent step does not get it. They are now told.

## When to surface

Any change to the sub-agent resolver, or an author report.

## Scope estimate

Medium: a pinned model resolves its own provider credentials (the forced-emit path already does this
for a cross-provider shot) and outranks the owner's `llm_model`; Deep's `task()` keeps today's
behaviour unless it passes a pin. Needs the full native roster.

## Breadcrumbs

- 296-06-SUMMARY row 293-F-4 agent (measured); Deferred "Seed owed to 296-05".
