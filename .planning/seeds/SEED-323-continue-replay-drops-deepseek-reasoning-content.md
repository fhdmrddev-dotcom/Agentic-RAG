---
seed_id: SEED-323
title: A Continue that replays dropped tool calls fails 400 on DeepSeek thinking mode (reasoning_content not passed back)
created: 2026-09-29
surface: Agentic-RAG
status: answered
partial: false
status_note: "Answered 2026-10-24 by Phase 292.1: the cap carrier keeps reasoning_content and the Continue replay passes it back; native DeepSeek (deepseek-v4-pro) Continues that replay queued calls completed with no 400 on the board (runs 18175e3e, 2ef2050e, db1bf671) and in G4-2 / G4-3."
trigger_when: Any phase touching the Continue path (agent_loop.py's dropped-tool-call replay, runs.py continue_run, run_producer.spawn_continuation_run) or DeepSeek reasoning handling
trigger_paths: ["**/agent_loop.py", "backend/app/api/runs.py", "backend/app/services/run_producer.py", "backend/app/services/provider_gateway/openai_compat.py"]
trigger_surfaces: ["chat", "provider"]
migration_note:
relates_to: ["268", "268-UAT-LOG.md D-1", "SEED-324"]
folded_into: "292.1"
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

## 2026-10-24 — Answered by Phase 292.1

A native DeepSeek Continue that replays queued calls now completes. Phase 292.1 (plan 01) keeps the
original turn's `reasoning_content` on the cap carrier and passes it back in the replayed assistant
turn. Measured on the live local stack (`deepseek-v4-pro`, provider `deepseek`, cap forced to 2):

- Board row run `18175e3e-bf41-42c2-a5ba-b5c17aa02e3e`: text-pause, carrier `search_documents`,
  Continue 200 on the same run, `continues_used` 0→1, queued `search_documents` ran first, then
  `execute_code`, ended `completed`. No 400.
- Long-message run `2ef2050e-d0ad-4bf2-9bbb-64d38aaa56d1` and parallel-thread run
  `db1bf671-c4da-4613-b092-db4513f6754f`: the same, `completed`.
- G4-2 (thread `9f2fd306`, run `5c95a0d4`) and G4-3 (thread `e158de50`, run `0b0ffc47`) in Chrome:
  carrier with `reasoning_content`, Continue → `completed`.

The same class on Gemini (`thought_signature`) was found by the board as D-UAT-1 and fixed in 292.1
(`7e169517c` → `f3816732a`). Evidence:
`.planning/phases/292.1-tool-limit-continue-that-always-fires-bug-261024-03/292.1-VALIDATION.md`.
