---
id: BUG-260828-04
title: The publish refusal is truncated on screen — the author cannot read why publish was refused
surface: Agentic-RAG
severity: high
status: open
folded_into: null
reported: 2026-08-28
reported_by: operator, driving Phase 214's G-4 checkpoint
affected_areas: [frontend/src/components/workflows/PublishGauntlet.tsx, frontend/src/components/workflows/PublishRefusalList.tsx]
re_open_trigger: n/a — open
---
# A refusal that cannot be read names nothing

The gate fired correctly (`ask_undeclared`), but the operator saw only:

> `phase 'act': the required argument 'to' is asked for at launch, but the wor`

The sentence ends mid-word. The full text is `…but the workflow declares no matching input`
(`backend/app/services/harness/reachability.py:190-193`).

⚠ Phase 214's own rule is that **a refusal is only honest if it names the next action**. A refusal
clipped before its last clause names neither the cause nor the action — functionally a generic
failure, which is exactly what `BUG-260815-06` describes and what 214-10 was built to end.

The operator also reported it as the ONLY message reachable on that screen, so the clipped line was
the entire explanation available.
