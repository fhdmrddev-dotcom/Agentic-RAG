---
id: BUG-260825-03
title: "OpenRouter returns 404 'No endpoints found that can handle the requested parameters' — we send a parameter the chosen model's providers cannot serve"
reported: 2026-08-25
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/providers, openrouter, model-registry, tool-calling]
folded_into: null
verified_closed_by: "260825 triage — fixed in 4d7d690f (cause located in our own request body; NOT yet driven against live OpenRouter)"
related_seeds: []
re_open_trigger: "a 404 'No endpoints found' still reaches a person after 4d7d690f — the fix was derived from OpenRouter's docs + our request body and unit-driven, never run against the live provider, because the failing model id was never captured"
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

---

## RESOLUTION — 2026-08-25. The cause is in OUR request body, and it is named in OpenRouter's own docs.

Commit `4d7d690f`. Provider-docs-first, as the standing rule requires: OpenRouter's
provider-selection documentation was read **before** choosing between (a), (b) and (c), and
then cross-checked against `MODEL_CAPABILITIES` and the actual bytes we send.

### ⭐ WHAT THE DOCS SAY, AND WHY IT SETTLES IT

> **Default (lenient):** when `require_parameters` is `false` — the default — providers that
> lack support for a parameter **simply ignore it** and the request proceeds.
> **Strict:** `require_parameters: true` means *"only use providers that support all
> parameters in your request"* — which can trigger a 404 when no provider matches.

**We set `require_parameters: true` on every `quality`-strategy OpenRouter tool call.**
`openai_service.py`, inside the `openrouter` + `quality` double-gate, alongside two more
narrowing devices applied in the same breath:

| Narrowing we apply | Effect on the candidate endpoint set |
|---|---|
| `extra_body.provider = {"require_parameters": True}` | every parameter in the body becomes a hard filter |
| `model` suffixed `:exacto` | routes to one specific endpoint variant |
| `extra_body.plugins = [{"id": "response-healing"}]` | a further capability requirement |
| `parallel_tool_calls: False` | ⚠ **an optimisation that `require_parameters` promoted into a REQUIREMENT** |

The intersection of those four is frequently EMPTY, and an empty intersection is exactly the
404 the operator saw. **The default lenient behaviour would have answered the turn.**

### ⚠ THE CONTRADICTION UNDERNEATH IT — measured, and now pinned by a test

All **9** OpenRouter rows in `MODEL_CAPABILITIES` record **`native_tools: False`**. Yet
`resolve_calling_mode` returns `CallingMode.NATIVE` for OpenRouter under both the `quality`
and `native` strategies, **without consulting that field** — so `tools` is attached to models
our own registry calls the non-native tool path. That is why this 404 is reachable at all.
`test_every_openrouter_registry_row_records_native_tools_false` fails the day a row claims
otherwise, so the contradiction cannot be quietly forgotten.

### The fix — all three of the report's shapes, in the order they matter

**(a) Stop over-constraining.** `require_parameters` is KEPT — D-129-02 wants it, and an
upstream that silently drops the tool schema is worse than a refusal — but
`parallel_tool_calls` is now popped on that path. We only ever send it to *disable* parallel
calls; requiring an endpoint to support it shrank the set for no benefit. **Scoped inside the
openrouter + quality gate**, asserted by a test that the pop sits below that gate and that a
non-OpenRouter call still carries the parameter exactly as before.

**(b) Let OpenRouter route.** On that one 404 signature, the call retries **exactly once**
with the three routing PREFERENCES stripped — `:exacto`, the plugin, and the `provider`
block. None of them changes the answer; all of them narrow the routing. `tools`,
`tool_choice`, `messages` and any unrelated `extra_body` key (DeepSeek's `thinking` block)
all survive the retry, and the caller's dict is not mutated.

**(c) A NAMED refusal.** If the retry also 404s, the model genuinely has no tool-capable
endpoint and the exception propagates to `classify_provider_error`, which now returns a new
`no_endpoint_for_parameters` kind:

> *This model can't be used with tools on OpenRouter — none of the providers hosting it
> accept the tool-calling request this app sends, so the request was refused outright rather
> than answered without tools. Pick a different model, or set the OpenRouter tool strategy to
> "xml" in Settings to use prompt-based tools with this one.*

⚠ **404 previously fell through `_classify_status` to `unknown`, and `unknown` is the ONE
kind that interpolates the raw provider payload** — which is precisely how a routing-doc URL
came to be rendered in a chat window. The new kind is narrow by construction: 404 **and**
both signature substrings present in the **structured body**, never `str(exc)` (the
T-175-03-02 guard), so an unrelated 404 keeps its prior classification and a crafted message
cannot force it. Both are asserted.

⚠ **We deliberately do NOT retry without `tools`.** Answering a tool-shaped turn with a
tool-less model degrades the answer silently; a named refusal is the honest outcome.

### On parameters 2 and 4 of the report's list

- **`response_format` json_schema (strict):** built only under `strict_response_format`,
  which is set only for `emit_tier == "force_strict"` shots — **OpenAI-only by measurement**,
  so it is not reached on an OpenRouter chat turn. Left untouched.
- **`max_tokens: 32768`:** per the docs the real ceiling is *context length minus prompt
  length*, and exceeding it is a 400, not this 404. **Unimplicated, and left alone rather
  than changed blind.** ⚠ The comment's *"most hosted models support 32k+"* is still doing
  real work, and every OpenRouter row records `context_window_tokens: None`, so nothing
  clamps against a real context window. Not this bug; worth its own look.

### ⚠ WHAT IS OWED — this fix has NOT been driven against live OpenRouter

The failing **model id was never captured**, and neither was the turn type. The cause was
located by reading OpenRouter's documentation against our own request body, and the fix is
covered by 23 unit cases (`backend/tests/unit/test_openrouter_routing_404.py`) — including a
guard that the duplicated 404 predicate in `openai_service` and the one in
`provider_gateway.errors` agree on the same exception, since the dependency graph forbids
importing one into the other. **One live OpenRouter run with a tool-capable prompt is the
first thing to do**, and the re-open trigger above says so.
