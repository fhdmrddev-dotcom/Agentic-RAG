---
id: BUG-260524-01
title: Google provider doesn't load Skills into the tool surface
reported: 2026-05-24
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [backend/skills, backend/providers/google, frontend/chat]
folded_into: 076.2
verified_closed_by: 076.2-03
related_seeds: []
re_open_trigger: "If debug logging shows skill tools missing from Google API request (grep for 'Google tool declarations' in backend logs)"
reproduces_on:
  branch: v2.5-dev
  commit: d7a2d75
  date: 2026-05-24
investigation_outcome: behavioral
---

# BUG-260524-01: Google provider doesn't load Skills into the tool surface

## What we observed

During the 2026-05-23 Phase 075.6 closeout UAT and immediately afterward, the operator noted that when the active provider is Google (e.g., `gemini-2.5-flash`), Skills do not appear to load into the agent's tool surface the way they do for Anthropic / OpenAI / OpenRouter. The Skills tab still lists the user's installed skills, but during a chat turn the agent does not invoke or surface them.

Other providers (Anthropic, OpenAI, OpenRouter, Ollama) appear unaffected.

No console errors visible from a quick Chrome MCP look during UAT — needs a focused repro to capture network/console evidence and the precise gap (e.g., backend never includes the skill tool definitions in the request to Google, or it does but the response isn't parsed correctly).

## Why it matters

Skills are a core differentiator of this app (per `CLAUDE.md` core value: "the agent acts as an AI colleague — it can be taught new behaviors that persist and can be shared"). A provider-asymmetric skills surface means users who pick Google for cost/speed reasons silently lose a headline capability. Severity: major (not blocking — Skills still work on the other 4 providers).

## Hypothesized cause

Hypotheses to verify, ordered by likelihood:

1. **Google adapter doesn't inject skill tool definitions into the request.** The Anthropic / OpenAI paths wrap skills into the `tools` array on each LLM call; the Google path (`google_service.py`) may have a different tool-wiring path or be missing the skill-injection step.
2. **Skills are injected but Google's function-call response shape is parsed differently and dropped.** The OpenAI-compat layer normalises function calls, but Google's native `function_call` Part shape may not be flowing into the skill-dispatch branch.
3. **Skill metadata uses a JSON Schema feature Google rejects.** Some skills may use schema constructs (`anyOf`, `oneOf`, recursive refs) that the Gemini API rejects with `400 Bad Request` — the response would silently drop the tool array.

## Surface classification

`Agentic-RAG` — internal to this app's backend wiring across `backend/app/services/google_service.py`, `backend/app/services/skills_service.py`, and `backend/app/api/threads.py` skill-tool-injection path.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 075.6 just closed; this is unrelated to its scope.
- **Defer to future phase / milestone:** v2.6 polish bundle OR a focused 075.x follow-up depending on triage outcome. Worth a quick spike before scheduling — if hypothesis #1 is correct the fix is ~30 lines.
- **Plant as seed:** no — this is a concrete bug with a concrete repro, not a strategy question.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

Switch provider to Anthropic / OpenAI / OpenRouter for skill-driven prompts. The Skills tab + skill management UI remains functional regardless of provider.

## Investigation Findings (Phase 076.2 Plan 03, 2026-05-26)

**Root cause: Behavioral, not code-level.** All three hypotheses were tested:

1. **Hypothesis 1 (code path) -- DISPROVEN.** Static analysis + debug logging confirms the complete tool pipeline: `get_tools(user_settings)` returns skill tools (load_skill, save_skill, read_skill_file) at `openai_service.py:513` -> `_g_tools` at `threads.py:1976` -> `stream_google(tools=_g_tools)` at `threads.py:1982-1984` -> `_convert_tools_to_google(tools)` at `google_service.py:341`. No provider-specific filtering drops skill tools.

2. **Hypothesis 2 (response parsing) -- NOT APPLICABLE.** The Google response handler (`_on_chunk_google` at `threads.py:1995`) populates `tool_calls_buffer` identically for all tool types. The shared tool dispatch at `threads.py:2485-2774` handles `load_skill`/`save_skill`/`read_skill_file` with no provider branching.

3. **Hypothesis 3 (schema rejection) -- DISPROVEN.** Skill tool schemas use only `{type: "object", properties: {...string fields...}, required: [...]}` -- no `additionalProperties`, `anyOf`, `oneOf`, or other Google-unsupported constructs. `_sanitize_schema_for_google` passes them through unchanged (verified via new debug logging).

**Conclusion:** Gemini models receive skill tool declarations but choose not to invoke them as readily as OpenAI/Anthropic models. This is model behavior, not a code defect. Severity downgraded from major to minor.

**Mitigations applied:**
- Debug logging added at `google_service.py:_convert_tools_to_google` (DEBUG level) showing tool count, names, and skill-specific schema before/after sanitization. Retained for ongoing observability.
- Bug report status set to `closed` with `re_open_trigger` for future regression detection.

**Deferred:** Per-provider system prompt tuning (e.g., adding "You have access to skills..." hint for Google) is out of scope per CONTEXT.md Deferred Ideas.

## Reference / evidence links

- Reported during Phase 075.6 closeout 2026-05-24 by operator (fhdmrd@gmail.com)
- Phase 075.6 itself was provider-uniform on the `tool_args_progress` wire format — this bug is orthogonal (skills tool *registration*, not tool *args streaming*).
- Files likely involved: `backend/app/services/google_service.py`, `backend/app/services/sub_agent_service.py`, `backend/app/api/threads.py` skill-tool-build path, frontend `Skills` page in `frontend/src/`.
- Investigation commit: Phase 076.2 Plan 03 (2026-05-26)
