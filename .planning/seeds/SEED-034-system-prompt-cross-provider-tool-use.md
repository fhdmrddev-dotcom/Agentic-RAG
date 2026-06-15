---
id: SEED-034
title: Per-Provider Prompt Strategy & New-Model Compatibility Assurance (cross-provider tool-use quality)
status: planted
planted: 2026-05-27
updated: 2026-05-29
planted_by: operator
trigger_when: >
  PRIMARY — surface at Phase 088 (Cross-Cutting Verification + Accessibility) discuss-phase:
  088 already runs the 4-axis cross-provider UAT, so measure per-provider tool-use reliability
  there with evidence, then decide fold-vs-dedicated-phase. SECONDARY — surface at v2.8
  new-milestone planning as a candidate REQ (v2.8 = agent harness + plugins per the v2.7 PRD
  split) if the architecture/implementation is bigger than 088 can absorb.
priority: high
tags: [system-prompt, tool-use, cross-provider, provider-compat, model-onboarding, agent-quality, competitive-advantage, provider-docs-first, evidence-based, RAG]
related_seeds: [SEED-028, SEED-031, SEED-032, SEED-009, SEED-010, SEED-035]
related_bugs: [BUG-260529-01]
---

# SEED-034: Per-Provider Prompt Strategy & New-Model Compatibility Assurance

## The idea (operator, 2026-05-29)

We support many providers, each with many models, and we stay open to adding new models as
each provider releases them. Two intertwined goals:

1. **Per-provider compatibility assurance** — when a new model is added for a provider, it
   should *naturally* work at full capability (tool use, streaming, reasoning, structured
   output) with no silent degradation. Today there's no systematic gate that proves this.
2. **Prompt strategy** — there is exactly **one shared system prompt** for all providers, yet
   each provider has its own execution model, prompting best-practices, and tool-calling
   conventions/documentation. We want the best practical way to honor those differences and
   push each model/provider to its **maximum capability** — without over-engineering and
   without breaking the strong cross-provider behavior we already have.

Guiding constraints (operator): practical not over-engineered; evidence-based decisions using
all available tooling; preserve competitive advantage (the multi-provider value prop); maximize
compatibility + accuracy; keep the app error/failure-free.

## Current architecture (confirmed 2026-05-29)

- Shared prompt: `backend/app/services/openai_service.py` defines `SYSTEM_PROMPT` and
  `EXPLORER_SYSTEM_PROMPT`.
- `backend/app/api/threads.py:1512-1596` builds a single `active_system_prompt` (shared base +
  appended context notes: folder scope, catalog, memory, disabled-tools) and sends it
  **identically to every provider**. There is no per-provider prompt variation today.
- Provider services (`openai_service`, `anthropic_service`, `google_service`, sub-agent/task
  services) already translate their native streaming/tool primitives into the shared SSE
  vocabulary — the "one UX, four adapters" pattern. The `active_system_prompt` assembly point
  is the natural injection site for any per-provider prompt overlay.
- Models are routed via the `MODEL_CAPABILITIES` registry (per CLAUDE.md) — the natural home
  for per-model/provider capability flags that could also drive prompt selection.

## Evidence the gap is real (fresh — v2.7 Phase 086 UAT, 2026-05-29)

Cross-provider UAT (Chrome MCP) of the new agent tools, same prompt across providers:

- **Strong tool-callers** (OpenAI gpt-5.4-mini, Anthropic claude-opus-4-6, DeepSeek
  deepseek-v4-flash, Moonshot kimi-k2.6, OpenRouter glm/gemma/deepseek-r1, Google
  gemini-3.5-flash): invoked `write_todos` correctly, persisted as expected.
- **Google gemini-2.5-flash**: *narrated* making a todo list without ever emitting the tool
  call (DB: 0 todos, no tool_calls). → operator decision: **focus Google on 3.x+ models;
  deprioritize the 2.5 series.**
- **Free OpenRouter llama-3.3-70b**: emitted the `todos` arg as a JSON **string** and looped;
  this also tripped a backend robustness bug (now fixed — `BUG-260529-01`). Capable OpenRouter
  models were fine. Illustrates provider/model **arg-shape variance**, a sibling of prompt
  variance.

Earlier evidence (original seed, 2026-05-27): DeepSeek/Kimi/GLM sometimes answered factual
document questions from training data instead of calling `search_documents` / `query_tables`,
where OpenAI/Anthropic reliably searched.

Net: tool-use reliability and arg-shape conformance vary by provider AND by model tier — the
single shared prompt is tuned for the strongest models and under-serves weaker/newer ones.

## Approaches to evaluate (decide with evidence — do NOT pre-commit)

- **A. Shared prompt, further tuned (cheapest).** Add universal, explicit tool-use directives
  to the one prompt (e.g. "For any question about uploaded documents/files, ALWAYS call
  search_documents/query_tables before answering"; "When asked to track steps, ALWAYS call
  write_todos"). Pros: zero new architecture. Cons: a prompt strong enough to force weak models
  may over-constrain strong ones; ceiling on per-provider optimization.
- **B. Shared base + per-provider overlay (likely the practical sweet spot).** Keep one base
  prompt; append a small provider-specific addendum at the `active_system_prompt` assembly
  point, keyed off the resolved provider/model. Fits the existing "one UX, N adapters" pattern;
  isolates provider quirks at the service boundary (consistent with the no-shared-path-breakage
  rule). Cons: N small deltas to maintain.
- **C. Fully separate prompts per provider (most control, most maintenance).** Highest
  divergence risk + upkeep; over-engineering risk — only if A/B prove insufficient.
- **D. Capability-matrix-driven (compose with A/B).** Extend `MODEL_CAPABILITIES` with
  per-model flags (tool-use strength, needs-explicit-tool-nudge, arg-shape quirks, reasoning
  format) and let those flags select prompt overlays + tool-description verbosity per call.
- **Tool descriptions**, not just the system prompt: weak models often need more explicit
  "when to use this tool" text in the tool schemas themselves (cross-cutting with A/B/D).

## Compatibility-assurance sub-thread (new-model onboarding)

- A repeatable **cross-provider eval harness**: same N canonical prompts (factual-doc-search,
  multi-tool write_todos+workspace, task sub-agent, ask_user) run across every provider/model;
  assert tool invocation + arg-shape + persistence. This is the evidence engine for every
  decision above and a regression gate when a new model is added.
- A **new-model onboarding checklist**: register in `MODEL_CAPABILITIES`, run the eval harness,
  record pass/fail per capability, set any needed overlay flag — so "added" means "validated at
  full capability," not "wired up and hoped for."
  - **Evidence-gate the `native_tools` flag (added 2026-05-31):** before flipping ANY model's
    `native_tools` override to `True` — especially an **ollama / local model** served via a
    heterogeneous endpoint — VALIDATE through this cross-provider eval harness that the model
    emits **real** tool calls, not narrated/faked ones. A model that confidently narrates tool
    use without emitting the call is worse than one we never sent tools to (zero execution,
    looks done). The flag flip must be **evidence-gated, not assumed**. The per-model write
    surface for these overrides is [[SEED-040]] (model-registry self-service); its 2026-05-31
    update names the ollama per-model `native_tools` toggle as the canonical Layer-2 use case.
- Pairs with `SEED-035` (tool-count/toolbox budget — Google warns >20 tools; weak models also
  degrade with large toolboxes) and `SEED-032` (deepseek reasoning-content round-trip).

## Provider-docs-first rule (applies WHENEVER any provider is touched)

This is the operating principle behind every approach above, and a standing rule beyond this
seed: **whenever work touches a provider, research that provider's OWN official documentation
first, then cross-check it against our application's actual behavior with comparative analysis
and real evidence.**

- Each provider has its own published guidance on **prompt engineering, orchestration, context
  management, skill use, and tool calls / tool use** (e.g. Anthropic tool-use + prompt
  guidelines, OpenAI function-calling + prompting guides, Google Gemini function-calling +
  thinking docs, DeepSeek/Moonshot/GLM API references). These do NOT transfer 1:1 — what's
  optimal for one provider can underperform or break another.
- Always pull the **canonical provider docs** (WebSearch/WebFetch/context7) for the specific
  capability being changed, then **compare against our measured reality** — DB/Supabase, backend
  logs, LangSmith traces, and live cross-provider UAT (Chrome MCP). Decisions are grounded in
  *provider docs + our own evidence*, never assumption.
- Concrete precedent this run: BUG-260529-01 (arg-shape variance) and gemini-2.5-flash's
  no-tool-call were caught by evidence (DB + logs + live UAT), not guesswork — that's the bar.
- Composes with project memory: investigate-with-tools-first, research-landscape-completeness,
  cross-provider-always-top-of-mind, multi-provider-behavior-variance.

## Why it matters

The multi-provider story IS the competitive advantage. If a user switches providers and tool
use silently degrades (or a newly-added model underperforms), the value prop breaks and trust
erodes. An evidence-based, low-maintenance per-provider strategy + a new-model validation gate
keeps every provider at maximum capability and keeps the app failure-free as the model roster
grows.

## Cross-links

- `BUG-260529-01` (closed) — write_todos crashed on a stringified `todos` arg from free llama;
  concrete instance of provider arg-shape variance.
- `SEED-028` native Google SDK split · `SEED-031` direct provider SDK integrations ·
  `SEED-032` deepseek reasoning-content round-trip · `SEED-009` claude haiku max-tokens cap ·
  `SEED-010` openrouter synthetic-timeout · `SEED-035` tool-count/toolbox budget.
- Project memory: provider-uniform-ux (one UX, N adapters); multi-provider-behavior-variance
  (fix at the service boundary, never the shared path); cross-provider-always-top-of-mind.

## Trigger

PRIMARY: surface at **Phase 088** discuss-phase — measure per-provider tool-use reliability in
the 4-axis UAT, then decide: fold a small prompt/tool-description tuning slice into 088 if the
fix is cheap (approach A), or carve a dedicated phase / push the architecture (approach B/D +
eval harness) to **v2.8** if it's bigger. SECONDARY: surface at v2.8 new-milestone planning as
a candidate REQ. Either way, do not let it slip silently — a pointer is planted in ROADMAP
Phase 088.
