---
seed_id: SEED-342
title: "`tool_floor_enabled` is still stored, authored and sent on every Expert, and nothing reads it since Phase 267"
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Any phase whose files_modified names backend/app/models/expert.py, backend/app/db/experts.py, expert_service.py or expert_authoring.py; OR the next migration that alters expert_bundles; OR anyone proposes making an Expert remove tools again."
trigger_paths: ["backend/app/models/expert.py", "backend/app/db/experts.py", "backend/app/services/expert_service.py", "backend/app/services/expert_authoring.py"]
trigger_surfaces: ["chat", "skills"]
migration_note:
relates_to: ["SEED-303 (an Expert adds scope, it does not replace it)", "D-267-02", "docs/history/v4.4-experts-that-actually-work.md", "docs/history/v4.3-what-you-can-actually-sell.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-342: retire the unread `tool_floor_enabled` column

## The finding

Phase 267 decided an Expert only adds tools and never removes them (D-267-02). The column that used to
switch the removal on was kept "for compatibility" and is now read by nothing. Measured 2026-10-04 it
still appears in:

- `backend/app/models/expert.py:57`, `:116` (field description: "not read since Phase 267")
- `backend/app/db/experts.py:88`, `:115`, `:139`, `:376` (insert / select / update)
- `backend/app/services/expert_service.py:28`, `:118`, `:618`
- `backend/app/services/expert_authoring.py:73`, `:140`, `:306`: the authoring prompt tells the model to
  always set it to true.

## Why it matters

Low today. A field that every author and every request carries, but that does nothing, is a trap for the
next person: it reads like a working control, and the authoring prompt spends a line on it. If removal of
tools is ever wanted again, it should come back as a deliberate design, not by someone wiring a dead flag.

## When to surface

The next phase that edits the Expert model, the Expert DB layer or the authoring prompt.

## Scope estimate

Small. Drop the field from the API models and the authoring prompt, stop writing it, then drop the column
in a numbered migration (applied by SQL editor, `full-schema.sql` regenerated). Check that no exported
Expert bundle or seed migration still sets it.

## Breadcrumbs

- `docs/history/v4.3-...md` status row "`restricted` Expert confines tools: Changed in v4.4"
- `.planning/seeds/SEED-303-an-expert-adds-scope-it-does-not-replace-it.md`
