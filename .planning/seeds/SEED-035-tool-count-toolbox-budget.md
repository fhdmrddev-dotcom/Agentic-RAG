---
seed_id: SEED-035
title: Tool Count Budget — Investigate >20 Tools on Google + Smaller-Model Tool Selection Accuracy
status: planted
planted: 2026-05-28
planted_by: orchestrator (discuss-phase 085)
trigger_when: Google or DeepSeek/Moonshot tool-selection accuracy on the 24-tool toolbox drops below 90% in UAT (measured by failed-tool-pick / wrong-tool-pick events in LangSmith)
priority: medium
tags: [tool-calling, cross-provider, google, deepseek, moonshot, system-prompt]
surface: Agentic-RAG
---

# SEED-035: Tool Count Budget — Investigate >20 Tools

## Context

Phase 085 brings the General-Mode tool count to **24** (16 existing + 5 workspace from Phase 084 + 3 new from Phase 085: `write_todos`, `task`, `ask_user`).

Google's official function-calling guidance recommends staying at or below 20 tools to maintain selection accuracy. Anecdotal evidence from the wider LLM community suggests the same threshold matters for smaller open-weight models (DeepSeek, Moonshot, GLM).

Phase 075.4 already validated cross-provider tool-calling at the v2.6 toolbox size with explicit `tool_use_uniformity` E2E coverage — but that was at 21 tools, marginally over the soft limit. v2.7 pushes to 24.

## Why deferred

Phase 085's "zero-risk, max capability" framing chose to keep the 3 new tools as distinct entry points rather than consolidate. Reasoning:
- Multi-action tools (`workspace(action='write'|'read'|...)`) are a known anti-pattern with Anthropic and Google
- Consolidating the 5 workspace tools shipped in Phase 084 would be a regression on clean per-tool schemas
- The KB tools (ls/tree/grep/glob/read_document) have shipped + been UAT-tested since v1.0 — consolidating risks regressions across all KB-touching tests

Treating the >20 threshold as a SEED rather than a blocking constraint.

## Re-open trigger

Promote this SEED to a phase when **any** of:
1. UAT shows Google or DeepSeek/Moonshot tool-selection accuracy below 90% on the 24-tool toolbox (measured by failed/wrong tool picks in LangSmith over a 50-sample window)
2. Operator manually observes "agent picks the wrong tool" or "agent skips the obvious tool" across multiple sessions on the same provider
3. Adding any further tools in v2.8+ would push past 26

## Likely shape if promoted

Three possible directions, picked by evidence:
1. **Tool-set scoping by intent** — system-prompt-driven tool subsets (e.g., RAG questions get search tools only). Closest match to MCP's tool-selection-by-purpose pattern.
2. **Consolidate KB tools** — single `kb(action='ls'|'tree'|'grep'|'glob'|'read')` tool. Drops total by 4. Requires migrating Phase 075.4 UAT coverage to the new shape.
3. **Provider-conditional toolbox** — strong-tool providers (OpenAI/Anthropic) see the full 24; weaker providers (DeepSeek/Moonshot/GLM) get a curated 16-tool subset. Risky — diverges UX across providers, contradicts `feedback_provider_uniform_ux`.

## Related

- `feedback_multi_provider_behavior_variance` — provider differences are first-class
- SEED-034 — system prompt revision for cross-provider tool use (overlapping concern)
- Phase 075.4 E2E scenario 6 — cross-provider iteration-count parity (the venue where degraded tool-pick accuracy would surface)
- Google function-calling guidance: https://ai.google.dev/gemini-api/docs/function-calling#best_practices (citing operator soft limit of 20)
