---
phase: 25-sub-agent-intelligence
plan: 01
subsystem: backend
tags: [sub-agent, context-window, model-selection, config, token-estimation]
dependency_graph:
  requires: []
  provides: [resolve_context_budget, _SUB_AGENT_MODEL_DEFAULTS, PROVIDER_CONTEXT_DEFAULTS]
  affects: [threads.py, sub_agent_service.py, context_window.py, config.py]
tech_stack:
  added: []
  patterns: [provider-aware defaults, 4-level model resolution, JSON token accuracy fix]
key_files:
  created:
    - backend/tests/unit/test_sub_agent_intelligence.py
  modified:
    - backend/app/config.py
    - backend/app/services/context_window.py
    - backend/app/services/sub_agent_service.py
    - backend/app/api/threads.py
decisions:
  - Sub-agent model defaults keyed by provider string matching llm_provider setting values
  - openrouter/ollama have empty string defaults — fall back to user model (routing unknown / local)
  - context_window_max_tokens=0 means auto (not "unlimited") — backwards-compatible sentinel
  - tool_calls JSON estimated at chars/3 not chars/4 — JSON punctuation overhead is real
metrics:
  duration: "2m 46s"
  completed_date: "2026-04-10"
  tasks_completed: 5
  files_modified: 5
---

# Phase 25 Plan 01: Sub-Agent Intelligence & Model-Aware Context Summary

## One-liner

Provider-aware context budgets (80k–200k by provider), cheap sub-agent model auto-selection (Haiku/GPT-5.4-nano/Gemini Flash), sub_agent_max_chars raised to 600k, and JSON token estimation corrected from chars/4 to chars/3.

## What Was Built

Three targeted correctness fixes addressing silent context overflow and unnecessary cost from the run-423e5603 incident analysis:

**1. config.py — Three config changes:**
- Added `PROVIDER_CONTEXT_DEFAULTS` module-level dict (outside Settings class) mapping provider names to context budgets: anthropic 120k, openai 200k, google 180k, openrouter 100k, ollama 80k
- Changed `context_window_max_tokens` from hardcoded `100000` to `0` — zero means auto-select from provider defaults; non-zero env var overrides all providers
- Added `sub_agent_model` env var (empty = auto-select cheapest) and raised `sub_agent_max_chars` from 100k to 600k chars (sub-agents have independent context windows — the old cap was protecting the wrong thing)

**2. context_window.py — resolve_context_budget + JSON fix:**
- Added `resolve_context_budget(active_provider)` function with 3-level priority: env override > per-provider default > 100k fallback
- Fixed `estimate_messages_tokens`: tool_calls JSON now estimated at `chars/3` not `chars/4` — JSON is punctuation-heavy so tokens are denser

**3. sub_agent_service.py — Model auto-selection:**
- Added `_SUB_AGENT_MODEL_DEFAULTS` dict: anthropic→Haiku 4.5, openai→GPT-5.4-nano, google→Gemini 2.5 Flash, openrouter/ollama→empty (fall back)
- Replaced single-line model resolution with 4-level logic: SUB_AGENT_MODEL env var > provider default > user's model > server default

**4. threads.py — Use resolve_context_budget:**
- Updated import to include `resolve_context_budget`
- Replaced both `max_tokens=settings.context_window_max_tokens` calls with `resolve_context_budget(user_settings.active_provider)`

**5. Validation tests (17 tests, all pass):**
- Model resolution: provider default, env override wins, unknown provider fallback
- resolve_context_budget: env override, all 5 providers, unknown fallback
- JSON token estimation accuracy verification

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | f3ce202 | feat(25-01): provider-aware config — PROVIDER_CONTEXT_DEFAULTS, sub_agent_model, sub_agent_max_chars 600k |
| 2 | 17adff5 | feat(25-01): context_window — resolve_context_budget + JSON token fix (chars/3) |
| 3 | 71d6b2a | feat(25-01): sub_agent_service — auto-select cheapest model per provider |
| 4 | 14013a4 | feat(25-01): threads — use resolve_context_budget for provider-aware trimming |
| 5 | d06b22e | test(25-01): unit tests for sub-agent intelligence and model-aware context |

## Impact Summary

| Metric | Before | After |
|--------|--------|-------|
| Sub-agent model (Anthropic) | claude-sonnet-4-6 ($3/1M) | claude-haiku-4-5 ($1/1M) — 3x cheaper |
| Sub-agent model (OpenAI) | user's model | gpt-5.4-nano ($0.20/1M) |
| Sub-agent model (Google) | user's model | gemini-2.5-flash ($0.30/1M) |
| Document sent to sub-agent | 100k chars (32% of 310k doc) | 600k chars (full doc if ≤600k) |
| Main agent budget (Anthropic) | 100k tokens | 120k tokens |
| Main agent budget (OpenAI) | 100k tokens | 200k tokens |
| Main agent budget (Google) | 100k tokens | 180k tokens |
| JSON tool_calls token estimate | chars/4 (undercount ~25%) | chars/3 (accurate for JSON) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all changes are fully wired.

## Self-Check: PASSED

- `backend/app/config.py` — FOUND (PROVIDER_CONTEXT_DEFAULTS dict, sub_agent_model, sub_agent_max_chars=600k, context_window_max_tokens=0)
- `backend/app/services/context_window.py` — FOUND (resolve_context_budget, chars/3 fix)
- `backend/app/services/sub_agent_service.py` — FOUND (_SUB_AGENT_MODEL_DEFAULTS, 4-level resolution)
- `backend/app/api/threads.py` — FOUND (resolve_context_budget imported and used in both trim sites)
- `backend/tests/unit/test_sub_agent_intelligence.py` — FOUND (17 tests, all pass)
- Commits: f3ce202, 17adff5, 71d6b2a, 14013a4, d06b22e — all verified in git log
