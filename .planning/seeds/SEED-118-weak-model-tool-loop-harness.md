---
seed_id: SEED-118
title: Harness weak models against wasted tool-call loops — dedup guard + earlier force-answer + per-model iteration budget
status: open
planted: 2026-07-15
phase_origin: "Operator observation 2026-07-15 (out-of-band during Phase 153 close): DeepSeek thread df282a55 iterated to the 15-iteration cap (14 tool calls, mostly repeated read_document on the same doc) and then returned an EMPTY response. Working-as-designed safety net fired, but the whole run was wasted tokens + a dead-end answer. Operator asked to queue it as a seed rather than expand scope of 153."
category: agent-loop control — cross-provider tool-use quality; iteration budgeting + redundant-call suppression
related_bugs: []
related_seeds:
  - SEED-088 (dynamic model registry / live discovery) — adjacent: the registry is where a per-model iteration budget / tool-quality tier would live as data, not code
related_phases:
  - Phase 153 (inline-citations) — origin context; weak models that loop also UNDER-cite (retrieve 21 chunks, mark 0), so this and citation density share a root cause
related_memories: [feedback_multi_provider_behavior_variance, feedback_no_cross_provider_regressions, feedback_separate_per_feature_safe_by_construction, feedback_provider_uniform_ux, feedback_openrouter_is_experimental]
priority: medium
---

# SEED-118 — Harness weak models against wasted tool-call loops

## The problem (observed 2026-07-15)

Weaker models (DeepSeek observed; likely other OpenRouter/OSS models) burn the entire agent-loop
iteration budget on **redundant** tool calls and then produce nothing useful. Concrete run:

- Thread `df282a55` — reached `max_iterations = 15` (`agent_loop.py:1241`), made **14 tool calls**,
  most of them `read_document` on the SAME document repeatedly.
- Final iteration forced `tool_choice = "none"` (`agent_loop.py:1795-1796`, `force_no_tools` on the last
  iteration) — the intended safety net — but the model still returned an **empty** answer
  (`agent_loop.py:2706` `if not full_content:` branch → the "empty response after N iterations" fallback).
- Footer showed 21 retrieved sources; **zero** inline citation markers (D-07) — the model retrieved a lot
  and attributed nothing.

Net: a full run's worth of tokens spent, a dead-end answer, and no grounded citations. The loop cap did
its job (prevented an infinite loop) but did nothing to prevent the **waste** that led up to it.

## Why a seed, not a quick fix

The current control is a single blunt lever — a global `max_iterations` (15 general / 8 explorer) plus a
force-answer on the final iteration. It is provider-uniform on purpose (shared path — [[feedback_provider_uniform_ux]]),
so any harness must NOT fork the shared loop per `provider ==` ([[feedback_no_cross_provider_regressions]],
[[feedback_separate_per_feature_safe_by_construction]]). The right levers are behavioral/registry-driven,
which is real design work:

## Suggested shape (advice, not decided)

1. **Redundant-call guard.** Detect when the model requests a tool call it already made this run with
   identical (or near-identical) args (e.g. `read_document(doc_id=X)` twice) and short-circuit: return a
   cached result annotated "you already read this" instead of re-executing, or count it against an earlier
   force-answer. This alone would have collapsed the df282a55 run from 14 calls to ~2.
2. **Escalate force-answer earlier on stall.** Instead of only forcing `tool_choice="none"` on the LAST
   iteration, trip it early when the loop is clearly stuck (N consecutive redundant/duplicate calls, or no
   new information gained). A stall detector, not just a hard cap.
3. **Per-model iteration budget (registry-driven).** A strong native model may deserve 15; a weak OSS model
   that tends to thrash may do better capped lower with an earlier force-answer. Store as a registry marker
   (mirrors SEED-088 / the "by measurement not by name" discipline) — never a hardcoded id list.
4. **Honest empty-run UX.** When the loop force-answers empty (`:2706`), the current fallback copy is generic.
   Consider surfacing *why* (hit the tool-call budget without converging) so the user knows to retry or switch
   models — ties into BUG-260712-01 (killed-wf empty card) territory.
5. **Measure before tuning.** Any budget/guard change must be validated cross-provider (SC#10) — the failure
   mode is provider-specific (DeepSeek/OpenRouter observed) so evidence-first, adjust at the service/loop
   boundary, keep native providers byte-identical. [[feedback_multi_provider_behavior_variance]].

## Re-open triggers

- A weak model exhausts the 15-iteration cap with redundant tool calls again (observe a repeat of df282a55), OR
- `/gsd:discuss-phase` on any agent-loop / tool-orchestration phase — surface this seed there, OR
- v3.4 milestone sweep — decide whether loop-harness / per-model budgets are in-scope, OR
- operator reports "the model spun on tools and gave me nothing" for any provider.

## Evidence

- Thread `df282a55` (2026-07-15): 15 iterations, 14 tool calls (mostly repeated `read_document`), empty answer,
  footer=21 sources / inline markers=0.
- `backend/app/services/agent_loop.py:1241` (`max_iterations = 15`), `:1745` (loop), `:1795-1796`
  (`force_no_tools` on final iteration → `tool_choice="none"`), `:2706` (empty-response fallback).
- Related: SEED-119 (citation footer noise) shares the "weak model under-attributes" root cause.
