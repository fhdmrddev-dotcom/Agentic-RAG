---
seed_id: SEED-384
title: Give a step set to "must prove it" by hand (escalated) a real knowledge-base search tool, so the citations check can run on it
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The operator asks for hand-escalated steps to be checked, or the next phase whose files_modified names backend/app/services/harness/grounding.py's effective-phase logic or harness/engine_ask.py's escalated lock. A capability decision (296 D-03), routed via /gsd:discuss-phase.
trigger_paths: ["backend/app/services/harness/grounding.py", "backend/app/services/harness/engine_ask.py", "backend/app/services/harness/validator_kinds.py", "frontend/src/components/workflows/GovernanceSection.tsx", "frontend/src/components/workflows/canvasModel.ts"]
trigger_surfaces: ["workflow", "harness", "retrieval"]
migration_note:
relates_to: ["296-CONTEXT D-04 (amended, option c)", "BUG-261021-05", "296-07 ef2832f46 (option b: the seal stops claiming a check for escalated)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-384: An escalated step needs a real search tool before it can be checked

## The finding

A step reads `escalated` only when it has NO knowledge-base tool (`grounding.py`). Research for 296
measured that enforcing the citations check on it is impossible as written: `retrieved_and_cited`
fails at once on empty citations, and an escalated step is locked so "continue without sources" is
gone (`engine_ask.py`). Every escalated step would fail every run and every publish trial. 296 took
D-04 option (b) in 296-07 (`ef2832f46`): the seal, the gate row and the attached-gate line no longer
claim a check for `escalated`, and the step says "Marked to prove its sources, but this step can't
search your documents, so nothing is checked when it runs." Option (c), giving such a step a search
tool so it CAN be checked, is this seed.

## Why it matters

An author who marks a step "must prove it" by hand gets an honest "nothing is checked", not the proof
they asked for.

## When to surface

An operator request, or a change to the effective-phase / escalated-lock logic.

## Scope estimate

Medium: grant `search_documents` (scoped to the workflow's folders) to an escalated step, then let the
existing gate run; the 0-escalated-steps local measurement means no saved workflow changes.

## Breadcrumbs

- 296-RESEARCH (D-04 measurement); BUG-261021-05 report.
