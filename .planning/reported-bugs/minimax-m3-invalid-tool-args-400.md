---
id: BUG-260607-03
title: MiniMax-M3 emits malformed tool-call arguments JSON — API rejects the round-trip with 400, run fails
reported: 2026-06-07
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [backend/provider-minimax, backend/tool-dispatch]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: "Reviewed at Phase 101 discuss-phase (2026-06-10, D-15): COVER + DOCUMENT, leave open. Overlaps Phase 101's full-native-roster field-map structured-output UAT (Cond 7) — the MiniMax row is exercised; it passes OR is documented as a known provider limitation (SC#4 'pass OR documented' + Cond 7 service-boundary rule). 101 does NOT own fixing MiniMax's malformed tool-arg JSON. The original trigger 'cross-provider workflow UAT surfaces it' is satisfied by this phase. Stays OPEN; re-route to a dedicated MiniMax service-boundary repair (args-JSON coercion/retry, provider-docs-first) when scoped."
reproduces_on:
  branch: v2.5-dev
  commit: 0af81c8e
  date: 2026-06-07
---

# BUG-260607-03: MiniMax-M3 malformed tool-args JSON → 400 → run failed

## What we observed

Run `2c711ee4` (MiniMax-M3, thread `b6800732`, 2026-06-07 17:37–17:40, heavy execute_code prompt): run failed after ~3 min with `BadRequestError: Error code: 400 — 'invalid params, invalid function arguments json'`. Final UI message: "*Model parameter error — this model may not support the current configuration.*" (the PROVIDER-ERR classifier's honest bad_request copy — classification worked as designed).

## Why it matters

MiniMax-M3 is one of the freshly-curated 096-08 registry models. If M3 regularly emits malformed function-call JSON on large code-writing args, it joins the known per-provider quirk family (GLM max_steps, Moonshot reasoning_content, MiniMax M2 `<think>`-strip) and needs a service-boundary guard (e.g., args-JSON repair/retry akin to the write_todos stringified-args coercion from BUG-260529-01).

## Hypothesized cause

Model-side: M3 truncated or mis-escaped a very large `execute_code.code` argument (the benchmark script). Hypothesis, not finding — needs the provider-docs-first pass (MiniMax official docs on function-calling limits) + a LangSmith trace of the offending call before any code change.

## Surface classification

`Agentic-RAG` (our hardening opportunity at the MiniMax service boundary) with an external component (model behavior).

## Suggested routing

- **Defer to future phase:** provider-hardening/eval pass (pairs with SEED-050 result-quality + the v2.9 feature-fit routing — same capability-table data source)
- **External — note only:** partially (model emission quality)

## Workarounds

Use MiniMax-M2.5-highspeed for code-heavy tasks; M3 fine for non-tool chat.

## Reference / evidence links

- runs row `2c711ee4` (error text) · curated registry: `backend/app/config.py` (096-08, 2026-06-07 provenance)
- Evidence-first rule: `feedback_provider_docs_first` / `feedback_multi_provider_behavior_variance`
