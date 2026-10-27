---
seed_id: SEED-373
title: On the forced-final round, send `tools` with `tool_choice "none"` instead of omitting `tools`, so models stop writing tool calls as text at the cap
created: 2026-10-24
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Text-form tool calls at the cap keep appearing on a board or in production after 292.1 (a `text_tool_markup` WARNING on a forced-final round), OR the next phase whose files_modified names openai_service.py, google_service.py or openai_responses.py and changes the final-round request."
trigger_paths: ["**/openai_service.py", "**/google_service.py", "**/openai_responses.py"]
trigger_surfaces: ["chat", "provider"]
migration_note:
relates_to: ["Phase 292.1 (text-form tool calls at the cap)", "BUG-261024-03", "SEED-372", "backend/app/services/openai_service.py", "backend/app/services/google_service.py", "backend/app/services/provider_gateway/openai_responses.py"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-373: Send tools with tool_choice "none" on the final round

## The finding

When the agent loop reaches its round cap it makes one forced-final request with no tools. The
request does this by OMITTING the `tools` parameter rather than sending it with
`tool_choice: "none"`. Three omission sites, measured on `develop` 2026-10-24:

- `backend/app/services/openai_service.py:2502` — `tools` is only set in the `tool_choice == "auto"`
  arm, so a `"none"` round sends no tools.
- `backend/app/services/google_service.py:443` — `google_tools = ... if (tools and not force_no_tools) else []`.
- `backend/app/services/provider_gateway/openai_responses.py:507` — `tool_choice "auto"` (and the
  tools) only when `not request.force_no_tools`.

A model that was mid-task and is suddenly given no tool list sometimes writes its next call as text
instead (the DeepSeek DSML of BUG-261024-03). OpenRouter's own documentation states: *"The `tools`
parameter must be included in every request"* — so an omitted list on a conversation that already
carries tool calls is outside what OpenRouter documents.

Phase 292.1 fixed the CONSEQUENCE provider-blind: text-form calls are parsed (DSML) or detected and
worded (F4-F6), and the cap pause fires either way. It did NOT change the request, by decision.

## Why it matters

It would reduce text-form leaks at the source, mostly on OpenRouter. Nobody pays today, because
292.1 makes a text-form call at the cap pause correctly. The cost of not doing it is the model
spending its final round writing a call it cannot make, instead of a final answer.

## Why it was deferred

It changes every provider's final request on the SHARED request path (the D-14 byte-identity red
line): Anthropic forbids tool use under `none` with thinking in some configurations, Gemini and the
Responses API have their own `none` semantics, and every native adapter would send a different body
than it does today. Provider-docs-first applies per provider before this ships (292.1-RESEARCH.md
Open Question 3, orchestrator ruling 3).

## When to surface

- A board or a production log still shows text-form tool calls on forced-final rounds after 292.1.
- Any phase whose `files_modified` names one of the three omission files and touches the
  final-round request.

## Scope estimate

Medium. Small code change per adapter; the work is the per-provider documentation check and a
cross-provider UAT board proving no provider now errors or calls a tool under `none`.

## Breadcrumbs

- 292.1-RESEARCH.md: Pitfall 1 (the forced-final round sends no tools) and Open Question 3.
- 292.1-RESEARCH.md "Standard Stack → Alternatives Considered" row for this exact change.
- SEED-372: the forms 292.1 detects but does not parse.
