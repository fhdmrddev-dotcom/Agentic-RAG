---
seed_id: SEED-086
title: Engaging visual representation of the multi-agent engine — orchestrator + specialist agents + judge/reviewer shown as a team/office/org-tree/layered "control room", not just a linear phase spine
status: planted
planted: 2026-06-14
phase_origin: "Phase 103 live UAT session 2026-06-14 — operator idea: 'our engine is very rich and comprehensive, we should think of an engaging way to represent this visually'"
category: UX / design exploration — a richer authoring + run visualization; design-first (sketch/spike), NOT a committed build
related_seeds: [SEED-085, SEED-051]
related_memories: [project_nl_workflow_authoring_vision, project_phase094_shipped, project_103_sketches, feedback_vibe_coder_communication]
re_open_triggers:
  - Before v2.9 Workflow Studio milestone closes — as a design exploration to lift the authoring + run surfaces above the current linear read-only spine.
  - Any phase that reworks the workflow RUN surface (the live execution view) or the Builder graph.
  - When llm_batch_agents (parallel fan-out) becomes a common authored pattern and the linear spine can't show "a team working at once".
priority: medium
surface: Agentic-RAG
trigger_when: unset
---

## The idea (operator's words)

"I always imagine agents that are working together and one is orchestrating, represented in some kind of tree, or office, or layers." The engine is genuinely rich — an orchestrator runs typed phases, an `llm_batch_agents` phase fans out a TEAM of parallel agents, `llm_agent` is an autonomous worker with tools, the publish gauntlet has an independent JUDGE + structural reviewers, `llm_human_input` is a human-in-the-loop pause. Today this is drawn as a flat vertical `phase_index` spine — accurate but unengaging; it hides the collaboration.

## What to explore (design-first, throwaway)

- A visual metaphor that makes the collaboration legible and engaging — candidates: an **org-chart TREE** (orchestrator → workers → judge), an **"office / team room"** (desks per role, an orchestrator coordinating, a reviewer/judge station), or **layered "control room" bands** (orchestration layer → worker layer → review/gate layer). Map the 6 real phase types + the publish judge/reviewers to roles.
- Honour what the SCHEMA actually supports (no fake edges — the 103 read-only-graph honesty rule): the spine is run-order `i→i+1` + the one dashed `skip_to_phase`; `llm_batch_agents` is the ONLY real fan-out (internal `max_parallel_agents`), the judge lives in the publish gauntlet. The richer visual must stay TRUTHFUL, not invent a DAG the engine can't run.
- Two moments to consider: the **authoring** view (what the workflow IS) and the **live run** view (who is working NOW) — the metaphor may differ per moment.

## How to approach it

- **Recommended: `/gsd:sketch`** — our established throwaway-HTML, multi-variant design tool (sketches 018-023 already cover the Builder/run surfaces). Produce 2-3 metaphor variants (tree / office / layers), pick a winner, then it becomes a future build phase.
- **Optional external inspiration: Google Stitch** (text-to-UI). A ready-to-paste Stitch prompt was drafted in the 2026-06-14 session (see the conversation / a future sketch README) — use it for moodboard/inspiration, then translate the winning direction into our Deep Midnight theme + the schema-truth constraints above. If a Stitch MCP is connected, Claude can drive it directly.

## Guardrail

Design exploration ONLY for now — do not build a heavy graph/animation engine mid-milestone. Capture the winning direction; schedule the build as its own phase. Must preserve the no-drag / no-fake-DAG / schema-truth honesty the 103 spine established.
