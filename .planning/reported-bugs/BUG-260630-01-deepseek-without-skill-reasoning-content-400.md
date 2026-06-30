---
id: BUG-260630-01
title: DeepSeek without-skill eval arm fails with reasoning_content 400
reported: 2026-06-30
surface: Agentic-RAG
severity: minor
status: deferred
affected_areas: [backend/provider-gateway, cross-provider/deepseek, skills/eval]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-100]
re_open_trigger: "Routed at Phase 134 discuss (2026-07-01): 134 surfaces this HONESTLY as 'baseline errored — not measured' but does NOT fix it (the fix belongs at the DeepSeek adapter/sanitizer boundary = D-14 red line). Re-open when SEED-100 (cross-provider eval-hardening phase) enters planning — fix the DeepSeek reasoning_content message-shape on the empty-catalog baseline arm at the adapter boundary."
reproduces_on:
  branch: develop
  commit: 306dd2d4
  date: 2026-06-30
---

# BUG-260630-01: DeepSeek without-skill eval arm fails with reasoning_content 400

## What we observed

During Phase 133 live SC#10 UAT (eval runner across the full native roster), the
**DeepSeek** provider (`deepseek-v4-flash`) eval run:

- **WITH-skill arm** → `completed` (122,718 input tokens; produced a real docx).
- **WITHOUT-skill arm** → `failed` with:
  `BadRequestError: Error code: 400 - {'error': {'message': 'The \`reasoning_content\` in the t...` (truncated to ≤200 chars by the eval error-truncation guard).

All other native providers (OpenAI, Anthropic, Google, OpenRouter, Moonshot, GLM/zhipu, MiniMax) completed both arms cleanly. The eval runner itself behaved correctly — it recorded `failed` + a truncated error and the run still completed (D-06 honest-failure path).

## Why it matters

Minor: it's one provider's one arm, and the eval surfaces it honestly rather than crashing. But it means a DeepSeek with-vs-without eval can't compute a clean A/B (the baseline arm is missing), and it hints at a DeepSeek message-format edge that may affect normal DeepSeek chat in some empty/short-context shapes.

## Hypothesized cause

DeepSeek's API rejects a `reasoning_content` field in the messages payload under some condition the without-skill (empty-catalog) arm hits — likely an assistant/message-reconstruction shape where a prior `reasoning_content` is echoed back into the request. Matches the known "DeepSeek reasoning-content / reasoning-truncation trap" (see cross-provider memories). HYPOTHESIS, not yet root-caused — needs a captured DeepSeek request payload from the without-skill arm.

## Surface classification

`Agentic-RAG` — backend provider-gateway / DeepSeek adapter. Cross-checked at GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** n/a (Phase 133 verified passed; this is a DeepSeek-specific edge, not the eval routing)
- **Defer to future phase / milestone:** a cross-provider hardening / DeepSeek-adapter pass (provider-gateway boundary; D-14 — keep the fix at the adapter/sanitizer, never the shared path)
- **Plant as seed:** n/a (tracked as this bug)
- **External — note only:** no

## Workarounds

Use a different provider for DeepSeek-class evals, or run only the WITH arm. The error is contained (per-arm failed + truncated message); it does not crash the run.

## Reference / evidence links

- Phase 133 live UAT (2026-06-30), eval run on `deepseek/deepseek-v4-flash`.
- Related: cross-provider memories on DeepSeek reasoning-content handling; provider-gateway adapter boundary (D-14).
