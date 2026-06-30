---
id: BUG-260701-01
title: Agent-loop assistant prefill 400s on prefill-rejecting models (claude-sonnet-5, 4.6+ family) — surfaces on eval without-skill arm
reported: 2026-07-01
surface: Agentic-RAG
severity: major
status: deferred
affected_areas: [backend/agent-loop, cross-provider/anthropic, skills/eval]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-100]
re_open_trigger: "Routed at Phase 134 discuss (2026-07-01): 134 surfaces this HONESTLY as 'baseline errored — not measured' but does NOT fix it (the fix touches the shared agent-loop/gateway path = D-14 red line, so it gets its own focused phase). Re-open when SEED-100 (cross-provider eval-hardening phase) enters planning — strip/skip assistant-prefill for prefill-unsupported models at the gateway/adapter boundary per model capability. ALSO re-open immediately if the assistant-prefill 400 reproduces in Deep/Explorer chat on any Claude 4.6+/5 model (this is a shared-loop bug, not eval-only)."
reproduces_on:
  branch: develop
  commit: 362672fb
  date: 2026-07-01
---

# BUG-260701-01: agent-loop assistant prefill 400s on prefill-rejecting models

## What we observed

Running a Phase-133 eval on `claude-sonnet-5` (just registered): the WITH-skill arm
completed normally (built the docx, 21,258 in / 1,646 out), but the **WITHOUT-skill
arm failed** with:

`BadRequestError: 400 — {'type':'invalid_request_error','message':'This model does not support assistant message prefill. ...'}`

The eval runner handled it correctly (per-arm `failed` + truncated error; run still
`completed`). The failure is in the **shared agent loop**, not the eval router.

## Why it matters

Major: assistant-message prefill (a trailing assistant turn) was **removed on the
Claude 4.6+/5 family** (Opus 4.6/4.7/4.8, Sonnet 4.6, **Sonnet 5**, Fable 5) — it
returns a 400. The agent loop's empty-catalog / baseline path apparently emits a
prefill, so any prefill-rejecting model breaks on that path. This is a shared-loop
cross-provider compat issue that will widen as newer Anthropic models become the
default. (Note: earlier evals on `claude-haiku-4-5` / `gemini-3.5-flash` returned an
empty "no response after 2 iterations" on the without-skill arm rather than a prefill
400 — so the prefill is conditional/path-dependent; needs tracing which branch emits
it and why sonnet-5 hits it while haiku didn't.)

## Hypothesized cause

The agent loop (or a baseline/explorer-style path) appends a trailing assistant
message as a prefill to steer output. Newer Anthropic models 400 on that. HYPOTHESIS —
needs the exact request payload from the without-skill arm + a grep for assistant-turn
prefill construction in `agent_loop.py` / the provider gateway adapter. Fix belongs at
the gateway/adapter boundary (D-14): strip/skip prefill for models whose capability
says prefill-unsupported, never fork the shared path.

## Surface classification

`Agentic-RAG` — backend agent-loop / provider-gateway. Cross-checked at GSD touchpoints.

## Suggested routing

- **Fold into:** the dedicated cross-provider eval-hardening phase (SEED-100).
- **Plant as seed:** SEED-100 (eval cross-provider robustness + user-facing clarity).
- **External — note only:** no

## Workarounds

Use the WITH-skill output only on prefill-rejecting models, or run baseline evals on a
model that still tolerates the path. Not a crash — contained per-arm.

## Reference / evidence links

- Phase 133 live eval on `claude-sonnet-5` (2026-07-01), run `9c7bace9-…`.
- Claude-API reference: assistant prefill removed on Claude 4.6+/5 family (400).
- Related: BUG-260630-01 (DeepSeek without-skill `reasoning_content` 400) — same "baseline arm trips a provider-specific request-shape rule" pattern.
