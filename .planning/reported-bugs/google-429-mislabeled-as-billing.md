---
id: BUG-260606-01
title: 429 rate-limit mislabeled as "billing / insufficient credits" by over-broad keyword classifier
reported: 2026-06-06
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/agent-loop, backend/provider-gateway, frontend/error-display]
folded_into: "095.1"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 4497ce06
  date: 2026-06-06
---

# BUG-260606-01: 429 rate-limit mislabeled as "billing / insufficient credits"

## What we observed

Running a multi-step code prompt on Google (gemini-3.5-flash) returned the user-facing
error: *"API billing or rate-limit error: your account has insufficient credits or has
hit a usage limit. Please check your provider's billing dashboard."* The operator
doubted it was a billing issue. Reproduced live (Chrome-MCP, 2026-06-06): the run ends
`failed` with that message + a "Resume run" button. DB cross-check (authenticated API):
the run's persisted `tool_calls` = `[]`, status `failed` — it died before any tool call.

## Why it matters

`gemini-3.5-flash` is a valid, correctly-registered model (config.py:231, native_tools=True)
— so the message actively misleads: it tells the user to check billing when the real cause
is a free-tier per-minute (RPM/TPM) rate limit. Cross-provider: the same shared classifier
mislabels any provider's 429. Wrong diagnosis → wrong user action.

## Hypothesized cause

CONFIRMED (code + live + DB cross-evidence). Over-broad keyword classifier at
`backend/app/services/agent_loop.py:2251` fires when ANY of
`("credit balance","billing","quota","insufficient_quota","rate limit","rate_limit")`
appears in the **stringified** exception. Google's 429 RESOURCE_EXHAUSTED `__str__`
(`google/genai/errors.py:66`) contains "quota" + "billing" + rate-limit wording, so it
hits the billing branch. 429 is not in `_is_transient_provider_error` (only 502/503/529),
so it isn't retried either. Classification is done on `str(e)`, never on the structured
`.code`/`.status` that all three SDK error classes expose.

## Surface classification

`Agentic-RAG` — our error classifier. Cross-checked at discuss-phase.

## Suggested routing

- **Fold into in-flight phase:** 095.1 (Cross-Provider Run Honesty & Workspace Parity)
- **Defer:** n/a
- **Plant as seed:** n/a
- **External — note only:** no

Fix direction: classify on structured status code at the per-provider gateway boundary
(092.5) — 429 / RESOURCE_EXHAUSTED → distinct rate-limit message with retry guidance,
ordered BEFORE the billing branch; keep true credit-balance errors → billing message.
Provider-scoped, not shared keyword-soup.

## Workarounds

Wait and retry, or switch to a paid key / different model.

## Reference / evidence links

- agent_loop.py:2242-2255 (classifier); config.py:231 (model registered); google/genai/errors.py:66
- Investigation workflow wf_cc00e76e-8bb (2026-06-06); [[project_095_cross_provider_uat_findings]]
