---
id: BUG-260711-02
title: GPT-5.6 (Sol/Terra/Luna) 400s on every tool-enabled chat — reasoning_effort + function tools unsupported on /v1/chat/completions
reported: 2026-07-11
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/provider-openai, backend/agent-loop, model-registry]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-114, SEED-088]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 4f29413b
  date: 2026-07-11
---

# BUG-260711-02: GPT-5.6 unusable in the agent — function tools + reasoning_effort rejected on chat.completions

## What we observed

The three GPT-5.6 models (`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`), hand-added to the registry
2026-07-11, appear in the model picker but every chat fails with the app's honest `bad_request` copy:
**"Model parameter error — this model may not support the current configuration."** (`provider_gateway/errors.py:188`).

Root cause pinned via a live API bisect using the operator's own OpenAI key (read-only, in scratchpad):

1. The ids are CORRECT and GA. The operator's project (`proj-FBtCIoUoUX...`, "Fitness project") lists all
   three under **Allowed models** (green checks, screenshot 2026-07-11 14:16); `/v1/models` returns them;
   and a minimal `client.chat.completions.create(model="gpt-5.6-sol", messages=[...], max_completion_tokens=16)`
   returns `'pong'`.
2. Adding the app's real 26-tool toolbox reproduces the failure with the EXACT OpenAI error:

   > 400 — `"Function tools with reasoning_effort are not supported for gpt-5.6-sol in /v1/chat/completions.`
   > `To use function tools, use /v1/responses or set reasoning_effort to 'none'."`  (`param: reasoning_effort`)

Bisect result (gpt-5.6-sol): V0 minimal → OK · V1 +stream/stream_options → OK · V3 +tools+tool_choice=auto
→ **400 (above)** · V4 +parallel_tool_calls → same 400 · V5 full app request → same 400.
(Aside: a non-streaming 64k-`max_completion_tokens` call returned a 401 "insufficient permissions" — a
separate key/endpoint quirk, irrelevant to the streaming app path.)

## Why it matters

GPT-5.6 is a **reasoning-first** OpenAI line; OpenAI forbids combining function tools with a non-`'none'`
`reasoning_effort` on the legacy **`/v1/chat/completions`** endpoint. Our OpenAI adapter
(`openai_service.py:1665`, `client.chat.completions.create`) ALWAYS attaches the toolbox on the NATIVE path
(registry `native_tools: True`) and never sets `reasoning_effort`, so the model's default reasoning is active.
Because `get_tools()` always returns the always-on document/skill tools, **every** Deep chat carries tools →
**gpt-5.6 is 100% unusable in the agent today**. Older models (gpt-5.5, gpt-4.1, gpt-4o…) are unaffected —
they don't enforce this restriction. User-visible symptom: pick Sol/Terra/Luna, send anything, get a generic
"model parameter error" with no hint that the real issue is an endpoint/reasoning constraint.

## Hypothesized cause

**CONFIRMED (not hypothesis)** — live-API bisect above. Not the ids, not config.py, not the DB list, not
project scope, not token caps. It is a genuine OpenAI API capability boundary for reasoning-first models on
the chat.completions endpoint.

## Surface classification

`Agentic-RAG` — our OpenAI service-boundary adapter needs a reasoning-first path. The trigger (OpenAI's
endpoint rule) is external, but the fix is entirely ours (provider-scoped adapter work; D-14 RED LINE:
non-OpenAI providers must stay byte-identical).

## Suggested routing

- **Fold into in-flight phase:** n/a (do NOT hack mid-Phase-147).
- **Defer to future phase / milestone:** OpenAI-adapter / Responses-API work — adjacent to but distinct from
  Phase 149 (Model Registry & Discovery). Surface at `/gsd:discuss-phase 149` and at v3.3 milestone sweep.
- **Plant as seed:** **SEED-114** (OpenAI Responses-API adapter for reasoning-first tool-using models).
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

Until the adapter lands, GPT-5.6 cannot be used with tools. Three code paths, none free:
- **A (recommended, real work):** route reasoning-first OpenAI models through **`/v1/responses`** — keeps
  native tools AND reasoning; a genuine adapter addition (different streaming + tool-call parsing). → SEED-114.
- **B (quick stopgap):** set `reasoning_effort: 'none'` for gpt-5.6 on the chat.completions call — tools work,
  but reasoning is OFF (defeats Sol's flagship value). Provider/model-scoped, additive.
- **C (registry-only):** mark gpt-5.6 `native_tools: False` in `config.py` → app injects tools via the XML
  system-prompt path (no tools param → no conflict), reasoning stays on, but the prompt-injected tool path is
  less reliable than native tool_use.
- **Meanwhile:** use gpt-5.5 / gpt-5.5-pro for tool-using Deep chat; leave Sol/Terra/Luna unselected.

## Reference / evidence links

- Screenshot: `screenshots/screencapture-platform-openai-settings-proj-FBtCIoUoUX5nx5X5X6XfRkqw-limits-2026-07-11-14_16_55.png` (all 3 allowed)
- Request builder: `backend/app/services/openai_service.py:1531-1665` (native path always passes `tools` + `tool_choice="auto"`)
- Error copy: `backend/app/services/provider_gateway/errors.py:188` (bad_request mapping)
- Registry rows: `backend/app/config.py` MODEL_CAPABILITIES (`native_tools: True`, added 2026-07-11)
- Origin: memory `project_gpt56_hand_added_seed088`; evidence-first rule `feedback_provider_docs_first`
