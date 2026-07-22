---
id: BUG-260722-01
title: Thread titles on reasoning providers (DeepSeek/Kimi/MiniMax/GLM/Gemini) are degenerate — first-few-words-of-prompt, not an LLM summary
reported: 2026-07-22
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [backend/title-generation, cross-provider-parity, provider/deepseek, provider/moonshot, provider/google, provider/minimax, provider/zhipu]
folded_into: 175
verified_closed_by: null
related_seeds: [SEED-126]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 9fb810df
  date: 2026-07-22
---

# BUG-260722-01: Reasoning-provider thread titles degenerate to first-few-words-of-prompt

## What we observed

Operator report (2026-07-22, during Phase 175 discuss): title generation *works* (no crash, no "New Chat" stuck state) on all providers, BUT on several providers — **Google/Gemini, DeepSeek, Kimi (moonshot), and others** — the generated title is **not a meaningful LLM summary**. Instead it is just the **first few words of the user's own prompt**, verbatim. OpenAI / Anthropic (non-reasoning tiers) produce real 4-6 word summary titles.

## Why it matters

Minor / quality + cross-provider-parity. The title is *honest* (it comes from the user's message) and better than the old bare "New Chat", but it's a degraded experience on exactly the reasoning-first providers: the chat sidebar reads as truncated prompt fragments rather than legible summaries. It's an uneven cross-provider experience, on-theme for the v3.5 cross-provider fidelity work.

## Hypothesized cause

**CONFIRMED by code read** (`backend/app/services/thread_title.py`), not just hypothesis:

- `generate_thread_title` asks the model for a 4-6 word title, then `_clean_llm_title` (`:82-96`) **rejects** the output and falls back to `_derive_title_from_message` (`:70-79` — first line, first ~8 words, ≤50 chars of the *prompt*) whenever the model returns empty / `<think>`-only / a refusal / >60 chars.
- For reasoning providers the title-token budget is **deliberately tiny** — `_title_max_tokens = 160 if provider == "google" else 30` (`:145`) — with the explicit comment (`:139-144`) that reasoning models (deepseek/moonshot/minimax/zhipu) "would burn any larger budget on hidden reasoning while BLOCKING the producer spawn — so we keep their budget small (fast empty return) and let `_clean_llm_title` fall back to a derived title."
- Title-gen is **awaited INLINE before the agent producer task spawns** (`maybe_autotitle_thread`, `:247` awaited before producer create_task) — hence the intentional small budget to protect run-start latency.

So the degenerate title is the **`_derive_title_from_message` fallback firing by design**: the reasoning model spends its tiny title budget on hidden `<think>` reasoning → empty content after `_strip_think_blocks` → derived-from-prompt title. It was itself the prior fix (closed report `title-generation-broken-deepseek-moonshot-google.md` — it replaced the worse bare "New Chat").

## Surface classification

`Agentic-RAG` — our own title-gen subsystem + per-provider budget/param tradeoff. Cross-checked at `/gsd:discuss-phase`.

## Suggested routing

- **Fold into in-flight phase:** **Phase 175** (XPROV-04 — folded 2026-07-22 at discuss-phase). The clean fix is a sibling of XPROV-01: tell the reasoning model *"don't reason, just title"* (reasoning-off on the title call) so the small budget yields a real title — provider-docs-first, per-provider `reasoning_effort:'none'`-or-equivalent support, scoped to providers where the docs confirm it's safe; the rest keep today's honest derived-title fallback (no regression).
- **Defer to future phase / milestone:** the per-provider title-model **selector** in Settings → **SEED-126** (net-new config surface, out of this cleanup phase).
- **Plant as seed:** SEED-126.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

- Use a non-reasoning model (OpenAI/Anthropic non-reasoning tier) for the first message of a thread to get a real summary title.
- Rename the thread manually.

## Reference / evidence links

- `backend/app/services/thread_title.py:70-96` (`_derive_title_from_message` / `_clean_llm_title`), `:139-159` (per-provider budget + title call), `:247` (inline await before producer spawn).
- Related closed report: `.planning/reported-bugs/title-generation-broken-deepseek-moonshot-google.md` (the prior "stuck on New Chat" fix that introduced the derived fallback).
- Sibling decision: XPROV-01 (`backend/app/services/openai_service.py` reasoning-param control) — Phase 175 CONTEXT.md D-01.
- SEED-126 (per-provider title-model + fallback selector).
