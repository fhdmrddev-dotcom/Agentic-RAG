---
id: BUG-260708-01
title: DeepSeek leaks native tool-call markup into chat; strip shipped, re-parse-to-execute still needed
reported: 2026-07-08
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/streaming, provider/deepseek, agent-loop, skills]
folded_into: 175
verified_closed_by: null
related_seeds: [SEED-034]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 8d414574
  date: 2026-07-08
---

# BUG-260708-01: DeepSeek tool-call markup leak — re-parse-to-execute follow-up

## What we observed

Thread `5a86a9fd` (user "hi" → "generate executive report", chat model
`deepseek-v4-flash`, 2026-07-08). On a long turn (26 prior tool calls) DeepSeek
emitted its FINAL `execute_code` call as **plain text in the content channel** using
its native markup instead of the structured `tool_calls` delta:

```
<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="execute_code">
<｜｜DSML｜｜parameter name="code" string="true">…~16 KB…</｜｜DSML｜｜parameter>
…
```

(`｜` = U+FF5C fullwidth pipe.) The OpenAI-compat normalizer (`openai_compat.py`)
treats `delta.content` as visible assistant text, so all ~16 KB of raw markup was
persisted as the assistant message and rendered in the chat — AND the tool never
executed (the final PDF was never generated).

**A strip mitigation is already shipped** (commit `2f18f870`,
`_strip_deepseek_tool_markup` + `test_openai_compat_dsml_strip.py`): the raw markup
can no longer render. This bug tracks the REMAINING half — re-parsing the leaked
markup into a real tool call so it actually executes.

## Why it matters

Major: even with the strip, a leaked DeepSeek turn ends gracefully but **silently
incomplete** — the tool the model intended to run (here, PDF generation) does not
execute, so the user gets no result and no error. The trigger is more likely on long
tool-chains, which is exactly when skills do the most work.

## Hypothesized cause

DeepSeek provider quirk: the model degrades into "text-mode" tool calls (emitting its
native `<｜｜DSML｜｜…>` markup as content) instead of populating the structured
`tool_calls` delta, observed after many tool calls in one turn. Not our regression —
`openai_compat.py` was untouched since Phases 101.1/092.5, and Phase 142's reshape
correctly passed the run's genuine errors through unchanged. Shortening turns (fixing
the upstream embeddings 429 + steering skills to installed libs) makes it rarer but
does not eliminate it.

## Surface classification

`Agentic-RAG` — the leak originates in a provider (DeepSeek) but the fix surface is
our streaming normalizer + agent loop. Route through app phases.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** a small provider-gateway phase — buffer the
  `<｜｜DSML｜｜tool_calls>` block, parse `invoke name` + `parameter` entries into a
  synthetic structured tool call, inject into the finish event's `tool_calls`. Hot
  shared-path gateway → wants real tests (partial-chunk buffering, malformed markup,
  interaction with the `<think>` strip and the 5 KB tool_args boundary).
- **Plant as seed:** correlate with SEED-034 (system-prompt cross-provider tool-use).
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

- Strip guard already prevents the dirty render (shipped).
- Prefer a non-DeepSeek model (OpenAI/Anthropic/Google emit structured tool calls
  reliably) for skills that produce long multi-tool turns.
- Keep turns short: fix the embeddings 429 (fewer fallback searches) and steer skills
  to installed libraries (fewer retry code-runs).

## Reference / evidence links

- DB thread `5a86a9fd-4557-47ed-b13b-410d6bc8853d`, assistant msg
  `dcf1b29e-82a0-4fda-8e8c-dbdacdd236ba` (content = raw markup).
- Strip fix: commit `2f18f870`; guard `_strip_deepseek_tool_markup` in
  `backend/app/services/provider_gateway/openai_compat.py`.
- Memory: `reference_deepseek_dsml_leak_and_sandbox_libs`.
