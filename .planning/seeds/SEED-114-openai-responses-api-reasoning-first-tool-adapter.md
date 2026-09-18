---
seed_id: SEED-114
title: OpenAI /v1/responses adapter for reasoning-first models — enable function tools + reasoning together (GPT-5.6 Sol/Terra/Luna and successors)
status: open
planted: 2026-07-11
phase_origin: "Operator investigation 2026-07-11 (out-of-band during Phase 147): the hand-added GPT-5.6 models 400 on every tool-enabled chat. Live-API bisect pinned the cause — OpenAI forbids function tools + non-'none' reasoning_effort on /v1/chat/completions for reasoning-first models; it wants /v1/responses. Operator asked to queue it as a bug + seed rather than hack mid-147."
category: provider adapter — OpenAI service boundary; new endpoint path (Responses API) for reasoning-first tool use
related_bugs:
  - BUG-260711-02 (.planning/reported-bugs/BUG-260711-02-gpt56-reasoning-tools-chat-completions-400.md) — the concrete failure this seed fixes
related_seeds:
  - SEED-088 (dynamic model registry / live discovery) — adjacent: SEED-088 makes NEW models appear; SEED-114 makes reasoning-first ones actually RUN with tools. Distinct concerns.
related_phases:
  - Phase 149 (Model Registry & Discovery, MODEL-01/MODEL-02) — natural discuss-phase to surface this; but the fix is adapter code, not registry data
  - v3.3 milestone sweep — candidate CORE/STRETCH item
related_memories: [project_gpt56_hand_added_seed088, feedback_provider_docs_first, feedback_multi_provider_behavior_variance, feedback_no_cross_provider_regressions, feedback_separate_per_feature_safe_by_construction]
priority: medium
surface: Agentic-RAG
trigger_when: unset
---

# SEED-114 — OpenAI Responses-API adapter for reasoning-first tool-using models

## The problem (confirmed 2026-07-11)

OpenAI's reasoning-first line (GPT-5.6 Sol/Terra/Luna, and this will recur for future reasoning models)
**rejects function tools whenever `reasoning_effort` is not `'none'` on the legacy `/v1/chat/completions`
endpoint.** Exact API error:

> `Function tools with reasoning_effort are not supported for gpt-5.6-sol in /v1/chat/completions.`
> `To use function tools, use /v1/responses or set reasoning_effort to 'none'.`

Our entire OpenAI-compat path is built on `client.chat.completions.create(stream=True)`
(`openai_service.py:1665`) and always passes the toolbox on the NATIVE path. So these models are unusable in
the agent today (full detail + bisect: BUG-260711-02).

## Why a seed, not a quick fix

The two cheap stopgaps each lose something real:
- **`reasoning_effort:'none'`** → tools work but the reasoning that makes Sol valuable is OFF. Neuters the model.
- **`native_tools:False`** (XML tool path) → keeps reasoning, registry-only, but the prompt-injected tool
  path is measurably less reliable than native tool_use.

The RIGHT fix is a real adapter addition: a **`/v1/responses` code path** for reasoning-first OpenAI models
that keeps BOTH native tools AND reasoning. That is genuine work — the Responses API differs from chat
completions in request shape, streaming event schema, and tool-call surfacing — so it must be planned, not
patched inline.

## Suggested shape (advice, not decided)

1. **Capability flag, registry-driven.** Add a registry marker (e.g. `tool_endpoint: "responses"` or
   `reasoning_first: True`) so the adapter chooses the endpoint per model — never a hardcoded id list
   (mirrors the D-122-04 "by measurement, not by name" discipline; [[feedback_separate_per_feature_safe_by_construction]]).
2. **Isolated Responses path at the service boundary.** New request builder + streaming translator that maps
   `/v1/responses` events into the SAME shared SSE vocabulary the chat path emits — the shared chunk/SSE path
   (threads.py `_on_chunk_openai`) and every non-OpenAI provider stay byte-identical (D-14 RED LINE;
   [[feedback_no_cross_provider_regressions]]).
3. **Provider-docs-first + live cross-provider UAT.** Read OpenAI's own Responses API docs, then verify against
   real runs (streaming, multi-tool, forced-emit/strict json_schema, parallel-thread) per SC#10 — reasoning
   models + forced structured emit is the risky corner. [[feedback_provider_docs_first]].
4. **Honest error until then.** The current `bad_request` copy is generic ("model parameter error"); consider
   a clearer hint for this specific 400 so a user selecting a reasoning-first model isn't left guessing.

## Re-open triggers

- `/gsd:discuss-phase 149` (Model Registry & Discovery) — surface this seed there; registry work will expose
  more reasoning-first models that hit the same wall, OR
- v3.3 milestone CORE/STRETCH sweep — decide whether the Responses adapter is in-scope this milestone, OR
- OpenAI ships another reasoning-first model that 400s the same way (the id list will keep growing), OR
- operator asks to make GPT-5.6 usable with tools (upgrade one of the BUG-260711-02 stopgaps A/B/C to the real path).

## Evidence

- BUG-260711-02 (bisect, exact error, screenshot of allowed models)
- `backend/app/services/openai_service.py:1531-1665` (chat.completions request builder)
- Origin memory: `project_gpt56_hand_added_seed088`
