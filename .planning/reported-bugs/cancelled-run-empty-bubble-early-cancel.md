---
id: BUG-260710-02
title: Cancelling a run before its first visible token persists an empty assistant bubble (avatar only)
reported: 2026-07-10
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/chat-display, backend/streaming, provider/deepseek]
folded_into: "174"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 273090ed
  date: 2026-07-10
---

# BUG-260710-02: Cancelling before first visible token leaves an empty assistant bubble

## What we observed

During Phase 145 live SC#10 UAT (Test 3 — live Stop per provider):

1. Start a streaming run on **DeepSeek** (deepseek-v4-flash).
2. Click **Stop** early (~7s in), while the model is still in its pre-first-token "thinking" phase.
3. **Actual:** after cancel + navigation, the assistant message is EMPTY — only the Assistant avatar shows, no text.
4. **Expected:** either the partial content it generated, OR a clear "cancelled — no output yet" affordance — not a silent empty bubble that looks broken.

DB ground truth (identifier-only): DeepSeek cancelled run `64cebee7` → `runs.status='cancelled'`, correctly ZREM'd from `runs:active`, but its persisted assistant message `7fcc704c` has **content_len=0, tool_calls=0, reasoning_len=0** — a genuinely empty row. By contrast the other providers cancelled in the same session persisted non-empty content (OpenAI 1606, MiniMax 2009, Zhipu 513, Moonshot 253 chars). So this is specific to cancelling BEFORE the first visible token.

## Why it matters

Honesty/UX gap: an empty assistant bubble reads as "something broke," when in fact the user simply stopped the run before any content existed. Edge-case (requires a very early cancel) but user-visible. Minor — no data loss, run state is correct.

## Hypothesized cause

Two compounding factors (hypothesis, not yet code-confirmed):
1. On early cancel, the producer's finalize persists whatever partial assistant content exists — which is an empty string when no visible token was emitted yet.
2. DeepSeek specifically is slow-to-first-token and its earliest output is internal markup that the `openai_compat` strip guard removes (see `reference_deepseek_dsml_leak_and_sandbox_libs`), so the visible buffer is still empty at ~7s.
The renderer then draws an empty bubble instead of suppressing it or labelling it. Phase 145 did NOT change message persistence (only the terminal status writer), so this predates 145.

## Surface classification

`Agentic-RAG` — this app's chat display + streaming finalize. Cross-checked at GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** n/a — outside Phase 145's executed scope (backend cancel writer + streaming-state derive, both verified). Operator elected (2026-07-10) NOT to reopen 145.
- **Defer to future phase / milestone:** same focused chat display-honesty frontend phase as BUG-260710-01 — suppress or label an empty cancelled/failed bubble.
- **Plant as seed:** n/a (folds with 260710-01).
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

Let a run stream at least a token or two before hitting Stop; the partial content then persists and renders normally.

## Reference / evidence links

- Found during Phase 145 UAT: `.planning/phases/145-run-lifecycle-honesty-threads-py-extraction-stretch/145-HUMAN-UAT.md` (Test 3).
- DeepSeek first-token/DSML behavior: memory `reference_deepseek_dsml_leak_and_sandbox_libs`.
- Sibling finding same session: BUG-260710-01 (stop indicator lost on navigation).
