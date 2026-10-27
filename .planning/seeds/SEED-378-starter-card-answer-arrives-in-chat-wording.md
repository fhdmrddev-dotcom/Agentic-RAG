---
seed_id: SEED-378
title: The starter card should say the answer arrives in the chat (needs a sketch; reverses a pinned card decision)
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next phase that changes the workflow library card or the starter shelf copy, or the operator rules on the 287 wording. G-2 applies — /gsd:sketch before planning.
trigger_paths: ["frontend/src/components/workflows/library/WorkflowCard.tsx", "frontend/src/components/workflows/library/libraryVocabulary.ts"]
trigger_surfaces: ["workflow", "chat"]
migration_note:
relates_to: ["296-INVENTORY 287-V-6", "287-VERIFICATION human_needed row 'Rule on the starter-card wording'"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-378: Starter card wording — "the answer arrives in chat"

## The finding

287-VERIFICATION left one design ruling open: whether a starter card should say that starting it
puts the answer in the chat. It was not shipped because it reverses a pinned card design decision.

## Why it matters

A person starting a starter from the library may not expect to be taken to a chat. Small, but it is
the first thing a new user meets.

## When to surface

Any change to the library card or starter shelf copy, or an operator ruling.

## Scope estimate

Small in code, but needs a sketch (G-2) because it changes a card design contract.

## Breadcrumbs

- 287-VERIFICATION.md frontmatter, human_needed list.
