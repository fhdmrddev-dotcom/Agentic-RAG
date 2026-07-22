---
id: BUG-260714-01
title: GPT-5.6 Sol/Terra/Luna fail with "Model parameter error — may not support the current configuration"; no run starts
reported: 2026-07-14
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/model-registry, provider/openai, chat/streaming]
folded_into: 175
verified_closed_by: null
related_seeds: [SEED-088]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 9fa7f7d8
  date: 2026-07-14
---

# BUG-260714-01: GPT-5.6 (Sol/Terra/Luna) — model parameter error, no run starts

## What we observed

During the Phase 151 live cross-provider UAT, selecting **OpenAI → gpt-5.6-sol** and sending a normal tool-using prompt produced **no run card** and no background run. After ~30s the chat surfaced the inline error:

> "Model parameter error — this model may not support the current configuration."

with a **Resume** button. The network layer showed no successful streaming run. Switching the OpenAI model to **gpt-5.5** (same prompt, same thread) worked immediately (Run · 2 steps · done · 12.2s, both tools fired). So the failure is specific to the GPT-5.6 family, not to the prompt or the tools.

Not exhaustively re-tested per-tier, but the error text + the fact that gpt-5.6-sol is the default OpenAI selection means users landing on OpenAI hit a dead model out of the box.

## Why it matters

`gpt-5.6-sol` appears to be the default/first OpenAI model, so a user who picks OpenAI and sends anything gets a silent-ish failure (error text + no run) rather than an answer. Major because it blocks the entire OpenAI provider path at its default model until the user manually downgrades.

## Hypothesized cause

The GPT-5.6 Sol/Terra/Luna family was **hand-added on 2026-07-11** (see SEED-088 addendum + [[project_gpt56_hand_added_seed088]]) across the 5 config sites (`MODEL_CAPABILITIES`, `MODEL_CONTEXT_DEFAULTS`, `_MODEL_OUTPUT_DEFAULTS`, `model-info.ts`, the emit-tier tripwire). A "model parameter error" strongly suggests a request-parameter mismatch for these ids — e.g. `uses_max_completion_tokens` / `max_output` / reasoning-mode params sent that the real gpt-5.6 endpoint rejects, or a wrong/stale model id string. This is exactly the hand-edit-tax failure mode SEED-088 predicted. Hypothesis, not verified — needs the actual OpenAI 400 body from backend logs / LangSmith.

## Surface classification

`Agentic-RAG` — this is our own model-registry/request-construction, not an OpenAI-API defect. Cross-checked at GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** n/a (not a Phase 151 concern — the file tools work; this is model config)
- **Defer to future phase / milestone:** the SEED-088 dynamic-model-registry work (candidate for v3.4 config consolidation / a model-registry fix phase)
- **Plant as seed:** already covered by SEED-088
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

Pick any non-5.6 OpenAI model (gpt-5.5, gpt-5.4, gpt-4o, etc.) — all work. Or use a different provider (Anthropic/Google verified working).

## Reference / evidence links

- Phase 151 UAT: `.planning/phases/151-agent-file-tools/151-HUMAN-UAT.md` (row 1 note)
- SEED-088: `.planning/seeds/SEED-088-dynamic-model-registry-live-discovery-db-backed-ui-managed.md`
- To confirm root cause: backend uvicorn logs / LangSmith for the OpenAI 400 body when calling `gpt-5.6-sol`.
