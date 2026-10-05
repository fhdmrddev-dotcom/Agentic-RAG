---
seed_id: SEED-346
title: Agent-loop behaviour honesty — honour "do this step by step", end a cycle with a summary rather than an action list, and bound runaway tool loops (v3.5 STRETCH Phase 180, never built)
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "The step-by-step / summary / over-iteration behaviour becomes a recurring daily-use complaint, or a paying or prospective user flags it; OR any reliability phase whose files_modified names agent_loop.py or anthropic_service.py; OR any of the three deferred reported bugs below is reproduced again."
trigger_paths: ["backend/app/services/agent_loop.py", "backend/app/services/anthropic_service.py", "backend/app/services/tool_dispatcher.py"]
trigger_surfaces: ["chat", "provider"]
migration_note:
relates_to: [".planning/v3.5-STRETCH-CARRYFORWARD.md § 180 (LOOP-01..03)", "reported-bugs: agent-ignores-step-by-step-request-no-todo-loop (deferred), anthropic-end-of-cycle-shows-actions-not-summary (deferred), anthropic-excessive-tool-iterations-on-multi-step-tasks (deferred)", "SEED-052", "SEED-094 (closed)", "SEED-118", "docs/history/v3.5-ux-consolidation-and-chat-polish.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-346: the agent should follow step-by-step requests and stop spinning

## The finding

v3.5 deferred three STRETCH phases. Two map onto existing seeds (178 polish onto SEED-045/058/119/105/039;
179 plain language onto SEED-085). The third, **Phase 180 Agent-Loop Behaviour Honesty**, was flagged at
close as *the priority revive* and maps onto no seed:

- **LOOP-01** the agent honours an explicit "do this step by step" / todo-loop request instead of
  collapsing it into one turn;
- **LOOP-02** an Anthropic cycle ends with a user-facing summary, not a raw list of actions;
- **LOOP-03** excessive tool iterations on multi-step tasks are bounded and honest.

It owns three reported bugs, all still `status: deferred` on 2026-10-04:
`agent-ignores-step-by-step-request-no-todo-loop`, `anthropic-end-of-cycle-shows-actions-not-summary`,
`anthropic-excessive-tool-iterations-on-multi-step-tasks`. The other bugs the carry-forward listed moved on
(BUG-260722-02 is `folded`; SEED-094, which covered BUG-260626-02/03, is `closed`); re-check those before
counting them.

## Why it matters

This is the everyday "the agent didn't listen / rambled / kept going" class of annoyance, and it hits every
chat, not one feature. The plan exists only in a carry-forward file that no sweep reads.

## When to surface

A recurring complaint about any of the three behaviours, or any reliability phase on `agent_loop.py` /
`anthropic_service.py`.

## Scope estimate

Medium, careful. Both files are G-5 hot files; changes stay at the provider service boundary and never fork
the shared Deep path. Provider-docs-first for Anthropic end-of-cycle behaviour; full eight-row
cross-provider UAT. Consider one phase per LOOP item if decomposition is large.

## Breadcrumbs

- `.planning/v3.5-STRETCH-CARRYFORWARD.md` lines 21-31
- `.planning/reported-bugs/` (the three files above)
