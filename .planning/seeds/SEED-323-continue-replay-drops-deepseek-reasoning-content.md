---
seed_id: SEED-323
title: A Continue that replays dropped tool calls fails 400 on DeepSeek thinking mode (reasoning_content not passed back)
created: 2026-09-29
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching the Continue path (agent_loop.py's dropped-tool-call replay, runs.py continue_run, run_producer.spawn_continuation_run) or DeepSeek reasoning handling
trigger_paths: ["**/agent_loop.py", "backend/app/api/runs.py", "backend/app/services/run_producer.py", "backend/app/services/provider_gateway/openai_compat.py"]
trigger_surfaces: ["chat", "provider"]
migration_note:
relates_to: ["268", "268-UAT-LOG.md D-1", "SEED-324"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-323: Continue replay drops DeepSeek's reasoning_content

## The finding

When a Continue consumes a cap-pause carrier, `agent_loop.py` (~:2114) appends a synthetic assistant
turn holding only `tool_calls`. DeepSeek thinking mode rejects it:
`400 — The reasoning_content in the thinking mode must be passed back to the API.` The user sees
*"Model parameter error"* and the run ends `failed`. The first segment's tokens are kept.

## Why it matters

`deepseek-v4-flash` is the app's global default model (`app_settings.llm_model`), so any real
cap-pause on the default config cannot be continued. Real pauses are rare: in the 2026-09-29 drive,
no provider reached `cap_paused` in 3 attempts.

## When to surface

Any phase whose `files_modified` touches the paths above, or that adds or changes a
reasoning-first provider. Research DeepSeek's own docs on multi-turn tool use with reasoning first
(provider-docs-first rule).

## Scope estimate

Small to Medium. The carrier would have to keep the original turn's `reasoning_content`, or the
replay would have to be shaped per provider at the service boundary.

## Breadcrumbs

268-UAT-LOG.md § "SC#1-continued — live drive 2026-09-29" (D-1). DeepSeek request ids
`dc34f511…`, `382a949e…`. A Continue WITHOUT a carrier completed fine on the same model (the
SC#1-continued PASS row), which isolates the fault to the replay.
