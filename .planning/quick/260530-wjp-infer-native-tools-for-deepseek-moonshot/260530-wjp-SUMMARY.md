---
quick_id: 260530-wjp
status: complete
completed: 2026-05-30
commit: d87047c1
---

# Summary: Cross-provider native-tools inference fix (260530-wjp)

## What changed

- **backend/app/config.py** — added `_NATIVE_TOOL_PROVIDERS` (`_BIG_3_PROVIDERS | {deepseek, moonshot, minimax, zhipu}`); `_build_inferred_defaults` now sets `native_tools = provider in _NATIVE_TOOL_PROVIDERS` for registry-miss models. ollama/openrouter stay `False` (intentional, verified).
- **backend/app/services/agent_loop.py** — added `minimax`/`zhipu` to the `<think>`-strip provider set.
- **DB (not git):** `app_settings.provider_model_lists` reordered to canonical, newest-first int'l ids (zhipu → glm-5.1…glm-4.5-air; minimax → MiniMax-M2.7…M2.5-highspeed; deepseek/moonshot newest-first).

## Why

Registry-miss model ids (zhipu `glm-4-plus`, minimax `minimax-m2.7`) fell to `native_tools=False` → structured mode → the `tools` param was never sent → models narrated/fabricated tool calls as text and the loop halted. The four providers all support OpenAI-compatible function calling (official docs + live `/models` verified). Closes the zhipu/minimax tool-calling + workspace breakage and the `<think>` content leak.

## Verification (live, post-restart)

- **minimax-m2.7** (registry miss): real `workspace_write → {"status":"ok","path":"/verify-fix.md","version":1,"size_bytes":14}`; file appeared in the workspace panel (before: fabricated text, "No workspace activity yet").
- **zhipu glm-4-plus** (registry miss): real `search_documents` tool calls with timing/results (before: narrated text).
- `python -m py_compile` passes on both files.
- Unit check: `minimax-m2.7`/`glm-4-plus`/`glm-4-flash` → `native_tools=True`; `llama3.2` (ollama) / `meta-llama/...` (openrouter) → `False`.
- Live `/models` probe: all served zhipu (7), minimax (7), deepseek (2), moonshot (9) models resolve to `native_tools=True`.

## Commit

`d87047c1` — fix(providers): infer native tools for deepseek/moonshot/minimax/zhipu + strip `<think>` leak

## Follow-ups (not in this task)

- **Title-gen** budget starvation on deepseek/moonshot/google/minimax → Phase 093 (memory: project-title-gen-deepseek-moonshot-broken).
- **Thread-switch hang** (HTTP/1.1 6-connection cap × one streaming fetch held per active run) → separate fix, next up.
- **Operator model/capability UI** (stop code-level edits) → SEED-040.
- Per-model tool-support edge cases (a model that genuinely lacks tools would now 400 instead of silently narrating) → registry curation pass / SEED-040.
