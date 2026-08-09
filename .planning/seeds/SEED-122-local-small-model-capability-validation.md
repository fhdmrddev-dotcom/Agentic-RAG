---
seed_id: SEED-122
title: Local / small-model capability validation — prove (or bound) tool-use, structured output, and RAG quality on <~4B and self-hosted models via the eval studio
status: open
planted: 2026-07-18
planted_during: v3.4 new-milestone (strategic Q&A — operator flagged their hardware caps at ~4B params and wants proof local models work across the app)
category: model quality / deployment flexibility — the local/on-prem tier's honesty gap
priority: medium
scope: Medium
related_seeds: [SEED-118, SEED-120, SEED-003, SEED-089]
related_memories: [project_v34_milestone_started, project_target_scale, project_provider_feature_fit_routing, project_embeddings_openai_spof]
re_open_trigger: "When a local-first / on-prem / air-gapped deployment is scoped, OR a customer requires validated small-model quality, OR the operator wants to certify a specific local model (Ollama/LM Studio) for production. Use the shipped Skill Eval Studio + cross-provider eval to run it."
---

# SEED-122 — Local / small-model capability validation

## Why This Matters

The app is **provider-agnostic and already supports local models** (Ollama, LM Studio, any OpenAI-compatible endpoint — wired through the model registry + embeddings picker). So "point an org at a local model" works *architecturally today* ([[SEED-120]]).

The **honest gap**: the app leans hard on capabilities that **small local models are weak at** — multi-step **tool-calling / agent loops**, **structured output** (Pydantic-forced emits, citations, field-maps), and grounded **RAG**. Whether a **<~4B-parameter** or otherwise small self-hosted model does these *well* is **unproven** — and the operator's own hardware caps at ~4B, so they can't personally validate the full stack on a capable local model.

This matters because **"runs locally / on-prem" is a first-class deployment tier and a competitive-advantage claim** (co-tenant → VPS → SaaS → on-prem/BYO). Shipping that tier without knowing which local models actually hold up risks an honesty failure ("we support local" but it silently degrades tool-use/citations).

## The lever we now own

v3.2/v3.3 shipped the **Skill Eval Studio + cross-provider eval matrix** (with-skill vs without, dual-arm judge, per-provider honest verdicts). That infra can **benchmark local models across real tasks** — tool-loop success, structured-output validity, citation faithfulness, RAG grounding — and produce an honest per-model capability verdict instead of a guess.

## Scope (when triggered)

1. A **local-model eval sweep**: run the representative task battery (tool-use, structured emit, RAG-with-citations, multi-step agent) across a set of local models (e.g. Llama/Qwen/Mistral small variants via Ollama) + a capable baseline.
2. Produce an **honest capability matrix** ("model X: tool-use PASS / structured-output PARTIAL / citations FAIL") feeding the model registry's capability facets (native_tools, strict_json, emit_tier).
3. Feed [[SEED-118]] (weak-model tool-loop harness) — small models that fail the loop get the dedup/early-force-answer/per-model-budget guardrails rather than silent failure.
4. Certify a **minimum viable local model** for each deployment tier; document the honest floor ("on-prem needs ≥ model Y for tool-use").

## Why NOT now

Needs a capable-hardware eval run (operator hardware-limited); not on the v3.4 isolation path. It's a validation/benchmark investigation, best run when the local/on-prem tier is actively scoped. The eval infra to do it already exists.

## Related
[[SEED-118]] (weak-model tool-loop harness — the mitigation for models that fail) · [[SEED-120]] (per-org local-model pointer — the feature this validates) · [[SEED-003]] (deployment flexibility — the local/on-prem tier) · [[SEED-089]] (embedding-dimensions / local embedding shapes).
