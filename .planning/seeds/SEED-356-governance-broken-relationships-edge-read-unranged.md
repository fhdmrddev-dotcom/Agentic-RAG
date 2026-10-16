---
seed_id: SEED-356
title: "GET /document-governance/broken-relationships pages its answer but reads every relationship edge unranged first — silently cut at 1,000 edges"
created: 2026-10-16
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "The next phase that edits backend/app/api/document_governance.py; OR a caller (or the operator) holds more than 1,000 document relationships; OR the governance-health page's broken-link count is reported as wrong."
trigger_paths: ["backend/app/api/document_governance.py", "backend/app/services/document_relationship_service.py"]
trigger_surfaces: ["library", "admin"]
migration_note:
relates_to: ["Phase 284 (FIX-11, D-23 layer 1 — backend/tests/unit/test_284_route_inventory.py PAGED_WITH_A_KNOWN_UNRANGED_READ)", "Phase 119 (governance health)", "SEED-355 (the agent kb browse, same class)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-356: The broken-relationships edge read is unranged

## The finding

`GET /document-governance/broken-relationships` declares `offset` / `limit` (through
`Depends(_pagination_params)`), so it reads as PAGED to Phase 284's route inventory. But its helper
first reads **every** edge the caller owns —
`supabase.table("document_relationships").select("id, source_doc_id, target_doc_id, rel_type").eq("user_id", caller).execute()`
(`backend/app/api/document_governance.py:154-159`), with no `.range()` — and only then pages the
broken ones in Python. PostgREST's `max_rows` (1,000) cuts that read silently, so a caller with more
than 1,000 edges gets a broken-link list computed over an arbitrary 1,000 of them, and its total is
wrong without saying so. Each edge also costs a per-endpoint resolve, so the read is the expensive
half too.

Phase 284 did not fix it: it is a governance surface, not one of the Library list / Find / picker
surfaces FIX-11 names. It is recorded in `test_284_route_inventory.py`'s
`PAGED_WITH_A_KNOWN_UNRANGED_READ` with this seed, so the route reads as paged by its parameters
while the fence still names the read inside it.

## Why it matters

The governance-health page reports broken relationships as a number and a list. Above 1,000 edges
both are silently partial, and "no broken links" can be false. Nobody has 1,000 edges today as far
as anyone has measured — this is a known ceiling, not an observed failure.

## When to surface

Any phase editing `backend/app/api/document_governance.py`; a caller with more than 1,000
relationships; or a report that the broken-link count is wrong.

## Scope estimate

Small to Medium: walk the edges with `count="exact"` + `.range()` (the 271 `_fetch_all` shape, now in
`retrieval_scope.py`), or push the "endpoint has no readable latest" test into SQL so only broken
edges are read and paged there.

## Breadcrumbs

- `backend/app/api/document_governance.py:154-159` (the unranged edge read), `:345-349` (`_pagination_params`)
- `backend/tests/unit/test_284_route_inventory.py` — `PAGED_WITH_A_KNOWN_UNRANGED_READ`
- 284-RESEARCH.md §Route Inventory, row `GET /document-governance/broken-relationships`
