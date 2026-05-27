---
id: BUG-260527-01
title: Title generation fails on DeepSeek/Moonshot, partial on Google (few letters or one word)
reported: 2026-05-27
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [backend/streaming, backend/providers]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 0850053
  date: 2026-05-27
---

# BUG-260527-01: Title generation fails on DeepSeek/Moonshot, partial on Google

## What we observed

- **DeepSeek / Moonshot (Kimi):** Thread titles stay as "New Chat" — title generation produces no usable output.
- **Google (Gemini):** Thread titles are truncated to a few letters or a single word instead of a 4-6 word title.
- **OpenAI / Anthropic:** Title generation works correctly.

Title generation was working before the Phase 076.1/076.2 provider integration changes. The regression coincides with sub-agent model routing changes where title gen started using `_SUB_AGENT_MODEL_DEFAULTS` per provider instead of inheriting the user's selected main model.

## Why it matters

Every new chat shows "New Chat" instead of a meaningful title on 4+ providers. Users scanning their thread list can't distinguish conversations. Minor severity because the chat content is unaffected, but it's a daily-use friction.

## Hypothesized cause

`generate_thread_title` at `threads.py:975-1034` resolves the title model via:
1. `user_settings.sub_agent_model` or `settings.sub_agent_model` (override)
2. `_SUB_AGENT_MODEL_DEFAULTS` per provider — `deepseek-v4-flash`, `kimi-k2.6`, `glm-4-flash`, `gemini-2.5-flash`
3. Fallback: user's main model

The sub-agent defaults for single-model providers (DeepSeek, Moonshot, MiniMax, GLM) may not handle the title prompt correctly — either API errors, refusals, or empty responses. Google's `gemini-2.5-flash` with `max_tokens: 30` may be interpreting the token budget differently (characters vs tokens) or stopping after one word.

## Proposed fix

Create a `_TITLE_MODEL_DEFAULTS` dict or add per-provider logic:
- **Single-model providers (DeepSeek, Moonshot, MiniMax, GLM):** Use the user's main model for title gen — no cost savings from a "smaller" model since they're the same tier.
- **Multi-model providers (OpenAI, Anthropic, Google):** Keep current sub-agent model routing, but investigate Google's truncation (may need `max_tokens` bump or different token param).

Scope: `/gsd:fast` or `/gsd:quick` — ~10 lines of config change + cross-provider UAT.
