---
id: BUG-260701-01
title: Agent-loop assistant prefill 400s on prefill-rejecting models (claude-sonnet-5, 4.6+ family) — surfaces on eval without-skill arm
reported: 2026-07-01
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/agent-loop, cross-provider/anthropic, skills/eval]
folded_into: "137.1"
verified_closed_by: "137.1-06 — FIXED. The Anthropic adapter (open_anthropic_stream) strips a trailing assistant prefill for supports_assistant_prefill:False Claude models (sonnet-5, opus-4-6/4-7/4-8, sonnet-4-6). Boundary-only (D-14): agent_loop.py/threads.py untouched, Deep byte-identical for prefill-tolerating models. Reproduced deterministically through 2026-07-02 (5x 'This model does not support assistant message prefill' on claude-sonnet-5/opus-4-8 without_skill arm per eval_results)."
related_seeds: [SEED-100]
re_open_trigger: "Routed at Phase 134 discuss (2026-07-01): 134 surfaces this HONESTLY as 'baseline errored — not measured' but does NOT fix it (the fix touches the shared agent-loop/gateway path = D-14 red line, so it gets its own focused phase). Re-open when SEED-100 (cross-provider eval-hardening phase) enters planning — strip/skip assistant-prefill for prefill-unsupported models at the gateway/adapter boundary per model capability. ALSO re-open immediately if the assistant-prefill 400 reproduces in Deep/Explorer chat on any Claude 4.6+/5 model (this is a shared-loop bug, not eval-only). || Folded at /gsd:discuss-phase 137.1 (2026-07-04) per this trigger (SEED-100 entered planning): re-test post-f47d6736 FIRST; if still live, fix at gateway/adapter boundary (D-14)."
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

## Resolution (Phase 137.1-06 — 2026-07-04)

**Live re-verify (DB evidence, not assumption):** the `without_skill` arm on `claude-sonnet-5` + `claude-opus-4-8` failed with `This model does not support assistant message prefill` **5 times** across 2026-06-30 → 2026-07-02 (`eval_results.error`), with **no clean run since** on that tier — a deterministic model-capability mismatch, NOT flaky. (Contrast: `claude-haiku-4-5` completed cleanly — it still accepts prefills.)

**Fix (adapter boundary only — D-14):**
- `config.py` MODEL_CAPABILITIES: additive `"supports_assistant_prefill": False` on the Claude 4.6+/5 family (sonnet-5, opus-4-6/4-7/4-8, sonnet-4-6). Absent flag ⇒ `True` ⇒ unchanged for older Claude + every other provider.
- `provider_gateway/anthropic.py` `open_anthropic_stream`: `_strip_unsupported_assistant_prefill` drops a trailing `role:"assistant"` prefill when the model's capability says unsupported. Returns a NEW list (never mutates `request.messages`); `agent_loop.py`/`threads.py` untouched (`git diff --name-only` verified). Because it lives in the shared adapter, it also protects Deep/Explorer chat on those models.
- Regression + Deep-mode-unchanged (byte-identical) assertions in `test_provider_gateway_seam.py`.
