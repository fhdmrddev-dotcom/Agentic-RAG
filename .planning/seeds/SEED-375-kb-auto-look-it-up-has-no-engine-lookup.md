---
seed_id: SEED-375
title: A declared input set to "Look it up" (kb_auto) has no engine-side knowledge-base lookup
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The first phase whose files_modified names backend/app/services/harness/form_inputs.py or the launch-input vocabulary, or an operator/G-4 row reports a kb_auto field coming back blank. Route via /gsd:discuss-phase.
trigger_paths: ["backend/app/services/harness/form_inputs.py", "frontend/src/components/workflows/declaredInputsVocabulary.ts", "frontend/src/components/workflows/soulData.ts", "backend/app/services/harness/phase_types.py"]
trigger_surfaces: ["workflow", "harness", "retrieval"]
migration_note:
relates_to: ["296-INVENTORY 291-WR-06 (engine)", "Phase 291 deferred-items WR-06", "296-07 cd1aaefff (the UI half: Look it up shown as not available yet)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-375: "Look it up" (kb_auto) has no engine lookup

## The finding

A declared launch input can name its source as `kb_auto` ("Look it up"), but nothing in the engine
looks the value up: `form_inputs.py` overlays only user-typed values, so a `kb_auto` field reaches the
step blank. 296-07 (`cd1aaefff`) fixed the HONESTY half: the option is shown disabled with "not
available yet", and a saved `kb_auto` field is flagged. The capability itself was not built (296 D-03:
no capability in a debt close-out).

## Why it matters

Authors who want a field filled from their documents must type it or leave it to the step's prompt.
No one is misled any more; the feature is simply absent.

## When to surface

Any phase touching `form_inputs.py` or the declared-input vocabulary, or a UAT row showing a
`kb_auto` field blank.

## Scope estimate

Medium: a retrieval call per `kb_auto` field before the first step, with citations recorded like any
other KB value, plus re-enabling the option.

## Breadcrumbs

- 291 deferred-items WR-06; 296-INVENTORY row 291-WR-06 (engine half → seed).
- 296-07-SUMMARY, row 291-WR-06 UI.
