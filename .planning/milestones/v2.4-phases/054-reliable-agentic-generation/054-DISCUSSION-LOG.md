# Phase 54: Reliable Agentic Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 054-reliable-agentic-generation
**Areas discussed:** Google SDK, AnthropicProvider placement, threads.py integration, Context trimming

---

## Google SDK

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm compat with a test | Phase 53 already fixed parallel_tool_calls and finish_reason normalization; no new dependency; verified end-to-end test documents the decision | ✓ |
| Native google-generativeai SDK | Full streaming event integration alongside Anthropic; two native SDKs in one phase; significant scope | |

**User's choice:** Confirm compat with test — native Google SDK deferred to a later phase.
**Notes:** User initially questioned why compat was recommended ("isn't it better to use each provider's native SDK?"). After presenting the scope trade-off (two full native SDK integrations in one phase), user chose: Anthropic native now, Google native later.

---

## AnthropicProvider Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New anthropic_service.py | openai_service.py already 849 lines; isolated concerns; clean import from threads.py | ✓ |
| Extend openai_service.py | All LLM code in one file; no import restructuring | |

**User's choice:** New `anthropic_service.py`.
**Notes:** No pushback — recommendation accepted.

---

## threads.py Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter pattern | anthropic_service.py yields normalized event dicts; agent loop unchanged | ✓ |
| Branch in threads.py | if active_provider == 'anthropic' takes a separate code path; duplicates loop logic | |

**User's choice:** Adapter pattern.
**Notes:** Preview shown for both options. User selected adapter with no pushback.

---

## Context Trimming

| Option | Description | Selected |
|--------|-------------|----------|
| Fully remove caps, trust trim_messages_to_fit | Replicates provider behavior; full results in messages; sliding-window only | ✓ |
| Provider-aware soft cap | No cap for native providers; original caps for OpenRouter/Ollama | |
| Larger global soft cap (32k chars) | Replaces old caps with higher limit | |

**User's choice:** Fully remove caps, trust `trim_messages_to_fit`.
**Notes:** User asked for recommendation and explanation of what providers actually do. After explanation (providers store full results, use sliding-window trimming, no character caps), user confirmed fully removing caps. Key quotes: "we want to do how providers advise", "budget is not a problem", "we do not want any failure".

---

## Claude's Discretion

- Exact internal event dict field names for the adapter (match whatever threads.py currently processes)
- How `_resolve_max_tokens` reads active_provider (use `user_settings.active_provider`)
- Read-only info row copy/formatting in Settings UI (follow existing patterns)

## Deferred Ideas

- Native google-generativeai SDK — future phase
- Multi-turn prompt caching (message history) — not needed for core fix
- Sub-agent architecture redesign — explicitly out of scope per SPEC.md
- LiteLLM migration — rejected in SPEC.md
