---
seed_id: SEED-377
title: Split backend/app/api/workflows.py's handlers by concern (the 286 D-05 target was missed)
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next phase whose files_modified names backend/app/api/workflows.py for anything beyond a one-statement touch; the ledger row reads "split OWED". Insert as a G-5 refactor phase before the feature.
trigger_paths: ["backend/app/api/workflows.py"]
trigger_surfaces: ["workflow"]
migration_note:
relates_to: ["296-INVENTORY 286-V-1", "Phase 286 (seams before features) D-05", "docs/HOT-FILE-LEDGER.md backend/app/api/workflows.py"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-377: Split `api/workflows.py` by concern

## The finding

Phase 286 moved the wire models out (`workflow_wire.py`) but did not reach its D-05 target of
splitting the handlers. The file measured `50/26/1699` after 296-06 (commits / phases / lines) and
still holds draft CRUD, publish, delete cascades, validate, bundle, describe and generate routes. 296
touched it twice (296-01 org stamp, 296-06 one `except` arm), each recorded as one-touch.

## Why it matters

Every touch is a G-5 override on a FIRING file. The next feature on it pays that again.

## When to surface

The next phase that needs more than one statement in `api/workflows.py`.

## Scope estimate

Medium: move-only extraction into per-concern routers with the pinned OpenAPI fixtures
(`test_286_*`) as the fence.

## Breadcrumbs

- 286 VERIFICATION V-1; 296-01 and 296-06 G-5 records.
