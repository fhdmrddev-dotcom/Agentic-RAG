---
id: BUG-260825-03
title: "OpenRouter returns 404 'No endpoints found that can handle the requested parameters' — we send a parameter the chosen model's providers cannot serve"
reported: 2026-08-25
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/providers, openrouter, model-registry, tool-calling]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production (cloud)
  commit: unknown — reported from the deployed cloud build
  date: 2026-08-25
---

# BUG-260825-03: OpenRouter 404 — no endpoint can serve the parameters we send

## What we observed

Operator report, verbatim:

```
The provider returned an error: Error code: 404 - {'error': {'message': 'No endpoints found
that can handle the requested parameters. To learn more about provider routing, visit:
https://openrouter.ai/docs/guides/routing/provider-selection', 'code': 404}}
```

⚠ **Not captured, and needed:** which MODEL was selected, and what the app was doing (plain chat /
tool call / structured output / workflow step). The answer changes the fix.

## What this error actually means

This is **not** "model not found" and **not** an auth failure. OpenRouter returns it when the model
exists but **no provider endpoint behind it supports the combination of parameters in the request**.
Our request is refused as a whole rather than downgraded.

The parameters this app sends that most commonly trigger it, in order of likelihood:

1. **`tools` / function calling.** Many OpenRouter-hosted models have no tool-capable endpoint at
   all. ⚠ Directly relevant: this project's own registry records that **every OpenRouter row is
   `native_tools: False`** — OpenRouter is the *non-native* tool path here. If a code path decides an
   OpenRouter model is tool-capable and attaches `tools`, this 404 is the expected result.
2. **`response_format: {"type": "json_schema", ...}`** — strict structured output. Built at
   `openai_service.py:1852-1880` under `strict_response_format`. Very few OpenRouter endpoints serve
   it, and asking for it is all-or-nothing.
3. **`parallel_tool_calls`** — attached around `openai_service.py:1896` unless the provider is on a
   deny-list. Another parameter many endpoints simply do not accept.
4. **`max_tokens` above every endpoint's ceiling.** `openai_service.py:1331` records
   `"openrouter": 32768` with the comment *"passes through; most hosted models support 32k+"* —
   ⚠ **"most" is doing real work in that sentence**, and a model whose endpoints cap lower would 404.

## Why it matters

The failure is total and opaque to the person using it: they picked a model from a list the app
offered them, and got a provider error naming a routing doc. Nothing in the message says *which*
parameter was refused, so it is unactionable without reading our own source.

There is also a governance angle: an OpenRouter model that silently cannot do tool calls will fail
*differently* depending on whether a given turn happens to need a tool — which reads as flakiness
rather than as an unsupported configuration.

## What we still need (first triage step)

1. **The model id** that produced it, and whether the turn involved a tool call or structured output.
2. Whether it reproduces on a plain, tool-free chat turn with the same model. If it does NOT, the
   cause is parameter (1)/(3); if it does, look at (2)/(4).
3. The outbound request body from `logging_sink.py` / LangSmith for the failing call — that names the
   offending parameter directly and ends the guessing.

## Proposed fix direction (not yet scoped)

- **Do not "fix" this by dropping parameters globally.** Removing strict structured output or tools
  across the board would degrade every provider to fix one, and this project's standing rule is to
  keep provider-specific handling **at the service boundary, never on the shared path**.
- The honest shapes are: (a) resolve OpenRouter capability per model from the registry and refuse to
  attach parameters that row cannot serve; and/or (b) send OpenRouter's `provider` routing preference
  so it selects a capable endpoint instead of refusing; and/or (c) surface a *named* refusal to the
  person — *"this model cannot use tools"* — rather than relaying a raw 404.
- ⚠ **Provider-docs-first applies here** (CLAUDE.md standing rule): read OpenRouter's own
  provider-selection documentation before choosing between (a), (b) and (c), and cross-check against
  what our registry actually records for the failing model. Conventions do not transfer between
  providers.
