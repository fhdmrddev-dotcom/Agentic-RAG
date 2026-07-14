---
id: BUG-260714-02
title: OpenRouter tool-calling returns 404 "No endpoints found that can handle the requested parameters" (tool-agnostic)
reported: 2026-07-14
surface: OpenRouter
severity: major
status: open
affected_areas: [provider/openrouter, chat/tool-calls]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 9fa7f7d8
  date: 2026-07-14
---

# BUG-260714-02: OpenRouter tool-enabled requests 404 with "No endpoints found that can handle the requested parameters"

## What we observed

During the Phase 151 live cross-provider UAT, any tool-using prompt routed through **OpenRouter** failed with:

> The provider returned an error: Error code: 404 - {'error': {'message': 'No endpoints found that can handle the requested parameters. To learn more about provider routing, visit: https://openrouter.ai/docs/guides/routing/provider-selection', 'code': 404}}

Reproduced on **two different OpenRouter models** — `nvidia/nemotron-3-ultra-550b-a55b` and `deepseek/deepseek-v4-pro`. Critically, it is **tool-agnostic**: a plain `search_documents` call (a tool that predates Phase 151 by many phases) throws the **identical 404** on the same model. So this is not caused by the Phase-151 tools and not schema-specific — it's OpenRouter's provider routing rejecting the tool-enabled request for these model endpoints.

## Why it matters

OpenRouter is one of the four SC#10 cross-provider axes, and its whole value is fanning out to many models. If tool-enabled requests 404 for common OpenRouter models, the OpenRouter provider is effectively unusable for the agent's core (tool-driven) chat — every agentic turn fails. Major for anyone relying on OpenRouter; mitigated by OpenRouter being the project's explicitly *experimental* provider.

## Hypothesized cause

OpenRouter's `provider-selection` routing can't find an endpoint for the chosen model that advertises support for the request's parameter set (which includes `tools`). Likely one of: (a) our request sends a param combination (tool_choice / parallel_tool_calls / response_format / a provider-preferences field) that filters out all endpoints for these models; (b) the specific model ids route only to endpoints without tool support; (c) a stale OpenRouter model list where the listed ids no longer have tool-capable endpoints. Needs the exact outbound request body we send to OpenRouter to confirm which param triggers the empty routing set. Hypothesis, not verified.

## Surface classification

`OpenRouter` (external/experimental provider). Per the routing rule, external-surface reports are observability notes surfaced to the user, not auto-folded into app phases. BUT the root cause may be in *our* OpenRouter request construction (param set we send), so it is worth a scoped code investigation before dismissing as purely external — treat as "external-noted with a code-side hypothesis."

## Suggested routing

- **Fold into in-flight phase:** n/a (not Phase 151 — proven pre-existing + tool-agnostic)
- **Defer to future phase / milestone:** a scoped OpenRouter tool-routing investigation (only if native-safe + low-complexity per the OpenRouter-is-experimental policy)
- **Plant as seed:** candidate if OpenRouter parity becomes a priority
- **External — note only:** partially — surface to user; investigate our request params before deciding it's OpenRouter-side

## Workarounds (prompt-side, code-side, or UI-side)

Use a native provider for tool-driven chat (Anthropic / OpenAI / Google all verified working with the agent tools). OpenRouter remains usable only for non-tool prompts, if at all, until routing is fixed.

## Reference / evidence links

- Phase 151 UAT: `.planning/phases/151-agent-file-tools/151-HUMAN-UAT.md` (row 1)
- OpenRouter routing docs: https://openrouter.ai/docs/guides/routing/provider-selection
- To confirm: capture the exact outbound JSON we POST to OpenRouter (tools + tool_choice + any provider preferences) from backend logs, then bisect which param empties the endpoint set.
