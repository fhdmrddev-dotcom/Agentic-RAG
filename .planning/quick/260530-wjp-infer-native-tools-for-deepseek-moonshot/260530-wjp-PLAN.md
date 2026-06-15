---
quick_id: 260530-wjp
description: Infer native tools for deepseek/moonshot/minimax/zhipu + strip <think> leak
created: 2026-05-30
mode: quick
---

# Quick Task 260530-wjp: Cross-provider native-tools inference fix

## Problem

zhipu (GLM) and minimax narrated — and even fabricated — tool calls as plain text instead of executing them (workspace files never created, no real tool round-trips). Root cause, proven with code + DB + provider-docs + live evidence:

- `MODEL_CAPABILITIES` (backend/app/config.py) is an exact, case-sensitive dict. On a miss, `_build_inferred_defaults` set `native_tools = provider in _BIG_3_PROVIDERS` (openai/anthropic/google only) → zhipu/minimax/deepseek/moonshot misses got `native_tools=False`.
- `native_tools=False` → `openai_service.py` runs structured mode and never sends the `tools` param → the model narrates the call as text → the agent loop sees no `tool_calls` and halts.
- The user's selectable model ids missed the registry: zhipu `glm-4-plus`/`glm-4-flash` (registry has `glm-4.5/4.6/4.7/5/5.1`), minimax `minimax-m2.7` lowercase (registry has PascalCase `MiniMax-M2.7`).
- All four providers DO support OpenAI-compatible function calling (official docs verified). The live `/models` probe confirmed every served zhipu/minimax/deepseek/moonshot model resolves through the registry or inference.

Also: minimax/zhipu leaked `<think>…</think>` reasoning into visible message content (the strip set only covered moonshot/deepseek).

## Tasks

### Task 1 — Scope native-tools inference to the OpenAI-compatible native providers
- **files:** backend/app/config.py
- **action:** Add `_NATIVE_TOOL_PROVIDERS` frozenset (`_BIG_3_PROVIDERS | {deepseek, moonshot, minimax, zhipu}`); switch `_build_inferred_defaults` `native_tools` from `provider in _BIG_3_PROVIDERS` to `provider in _NATIVE_TOOL_PROVIDERS`. ollama/openrouter intentionally stay `False`.
- **verify:** `get_model_capability('minimax-m2.7'|'glm-4-plus')['native_tools'] is True`; `get_model_capability('llama3.2'|'meta-llama/...')['native_tools'] is False`.
- **done:** registry-miss ids on the 7 native-tool providers infer `native_tools=True`; ollama/openrouter unchanged.

### Task 2 — Strip `<think>` for minimax/zhipu
- **files:** backend/app/services/agent_loop.py
- **action:** Add `"minimax"` and `"zhipu"` to the `<think>`-strip provider set (the `if active_provider_name in (...)` content filter).
- **verify:** minimax/zhipu inline `<think>…</think>` routes to reasoning_content, not visible content.
- **done:** no `<think>` leak in visible assistant messages for minimax/zhipu.

### Task 3 (data, not git) — Canonical, newest-first model lists
- **action:** `app_settings.provider_model_lists` updated directly in the DB: zhipu → `[glm-5.1, glm-5, glm-4.7, glm-4.6, glm-4.5-air]`; minimax → `[MiniMax-M2.7, MiniMax-M2.7-highspeed, MiniMax-M2.5-highspeed]`; deepseek/moonshot reordered newest-first. (Data change — read per-request, no restart, not a git artifact.)

## Verification (done live)

- minimax-m2.7 (registry miss): real `workspace_write → {"status":"ok","path":"/verify-fix.md",...}` + file in workspace panel (was: fabricated text, no file).
- zhipu glm-4-plus (registry miss): real `search_documents` calls with timing (was: narrated text).
- `py_compile` passes on both files; ollama/openrouter confirmed still `native_tools=False` (no over-broadening).

## Out of scope (captured elsewhere)
- Title-gen budget starvation → earmarked Phase 093 (see memory project-title-gen-deepseek-moonshot-broken).
- Thread-switch hang (HTTP/1.1 6-conn cap × per-run streams) → separate fix.
- Operator model/capability UI → SEED-040.
