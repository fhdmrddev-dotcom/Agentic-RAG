---
seed_id: SEED-061
title: Context engineering lift — history summarization, poisoning/clash defenses, context-quality telemetry (post-production planned update)
status: planted
planted: 2026-06-07
phase_origin: assessment session 2026-06-06/07 (.planning/research/rag-architecture-assessment-2026-06-06.md §5 topic 5)
category: C — post-production planned update (operator directive 2026-06-07 — document-only, do NOT build pre-production)
related_seeds: [SEED-026, SEED-020]
relates_to:
  - "`CONTEXT-MANAGEMENT.md` (repo root) — Options A/C/D/E already documented + deliberately deferred at PRD-reset (prd-reset/SUMMARY.md §B 'acceptable defers'); this seed is their re-surfacing vehicle"
  - "`backend/app/services/context_window.py::trim_messages_to_fit` + `context_window_reserve_recent` — trimming EXISTS (drops oldest); summarization does NOT (compressing instead of dropping)"
  - "`backend/app/services/agent_loop.py:1036-1053` — progressive disclosure ALREADY SHIPPED (skills catalog + load_skill on demand, SKIL-09)"
  - "TOOL-05 max_tools budget (Phase 091) — 'context confusion' mitigation already shipped"
re_open_triggers:
  - Production deployment milestone opens (post-v3.x go-live hardening pass)
  - User complaint about long-thread quality degradation — agent forgets early-thread facts, contradicts itself, or derails after a hallucinated tool result ("context poisoning" signature)
  - Token-cost optimization becomes a milestone theme (CONTEXT-MANAGEMENT.md options re-open)
  - Any phase adds long-running autonomous workflows where threads routinely exceed the trim window
priority: low now / high post-production
suggested_phase: post-production planned update — candidate for a "production hardening" or cost-optimization milestone; NOT for v2.8/v2.9
surface: Agentic-RAG
trigger_when: unset
---

# SEED-061 — Context engineering lift

## What already exists (do not rebuild)

The 2026-06-07 assessment verified the app already implements MORE of the
"context engineering" playbook than expected:

| Pattern (synthesis §5) | Status |
|---|---|
| Context-window trimming | ✅ `trim_messages_to_fit` pre-loop, reserve-recent knob |
| Progressive disclosure of skills | ✅ catalog + `load_skill` on demand (SKIL-09) |
| Limited/structured tool sets | ✅ TOOL-05 `max_tools` budget + per-phase harness whitelists |
| Just-in-time retrieval | ✅ tools fetch on demand; nothing preloaded into context |

## The actual gaps (all post-production)

1. **History summarization** — trimming DROPS old messages; the synthesis
   recommends compressing them (rolling summary of evicted turns) so long
   threads keep early facts. Touches the shared agent-loop path → red-line
   territory; needs eval coverage before anyone touches it.
2. **Context poisoning / clash defenses** — no mechanism detects a hallucinated
   tool result or contradictory retrieved chunks persisting across iterations.
   Realistic shape: contradiction check at retrieval merge, or grounding
   metadata on tool results. Heavy; pairs with the v3.0 groundedness-Auditor
   idea (assessment §4 guardrails row).
3. **Context-quality telemetry** — no measurement of where in-context info
   lives (rot-zone analysis), trim frequency, or tokens-by-source breakdown.
   Cheapest first step and the natural prerequisite: measure before defending.
   Pairs with SEED-026 (error handling / observability lift).

## Vibe-coder plain summary

Long conversations degrade LLMs: stuff in the middle gets ignored, one bad
hallucination can stick around and poison later steps. We already do the big
defenses (trim old history, load skills only when needed, cap tool count). What
we don't do: *summarize* what we trim (so old facts survive), detect poisoned/
contradictory context, or measure any of this. All of it is post-production
work — park it until the app is live and long-thread complaints or token bills
make it worth the shared-path risk.
