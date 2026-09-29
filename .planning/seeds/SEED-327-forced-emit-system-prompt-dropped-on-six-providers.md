---
seed_id: SEED-327
title: forced_emit's instructions never reach 6 of 8 providers (system_prompt dropped by the OpenAI-compat and Responses adapters) — likely root cause of 267 F-4
created: 2026-09-29
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "the operator schedules the F-4 / handoff-summariser fix; OR any phase whose files_modified names forced_emit.py, provider_gateway/openai_compat.py or provider_gateway/openai_responses.py; OR the next cross-provider structured-output failure"
trigger_paths: ["backend/app/services/forced_emit.py", "backend/app/services/provider_gateway/openai_compat.py", "backend/app/services/provider_gateway/openai_responses.py", "backend/app/api/threads.py"]
trigger_surfaces: []
migration_note:
relates_to: ["267", "267-REVIEW-INDEPENDENT.md CR-01", "267-VERIFICATION.md F-4", "SEED-034", "provider-docs-first rule"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-327: forced_emit's instructions never reach 6 of 8 providers

## The finding

`forced_emit` sends its instructions as the request's `system_prompt` (`forced_emit.py:283,304,506`). The OpenAI-compatible adapter builds its request from `messages` only and never reads that field (`openai_compat.py:513-521`); the Responses adapter never reads it either. DeepSeek, OpenAI, GLM, MiniMax, Kimi and OpenRouter therefore never see "3 to 6 bullets", "Do not invent", or the directive and schema added by the fallback attempt. Anthropic and Google do. Reproduced in 267's independent review by capturing both attempts for `deepseek-v4-flash` with a fake client: `roles=['user']` both times, and the fallback attempt runs with thinking on and no instruction.

Likely F-4 sequence (267 handoff 502 "This chat could not be summarised."): the forced attempt returns items that break the unenforced caps, the fallback gets no instruction and answers in prose, the route returns 502. A validation failure is never logged (`forced_emit.py:548-573`), so the cause is not in any backend log. Pre-existing; it affects every `forced_emit` caller, so it is already live in production.

## Why it matters

Every structured-emit path that relies on `forced_emit` silently runs without its guard rails on six of the eight providers. The handoff summary (untrusted text) also becomes a user message in the new thread (review WR-05), so the missing "Do not invent" guard matters.

## When to surface

The trigger conditions above. The fix touches a SHARED provider path, so it needs a live per-provider row (full native roster + OpenRouter, SC#10), read the providers' own docs first (provider-docs-first), and add the missing validation-failure log line.

## Scope estimate

Medium. The code change is small (carry the system prompt into the message list or the adapter's system slot per provider); the cost is the eight-provider live board and the provider-docs research.
