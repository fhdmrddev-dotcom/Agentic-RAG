---
seed_id: SEED-332
title: Find's relationship and folder side-reads are not paged or strict, so "exact total or fail loud" does not hold for them
created: 2026-10-03
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: A library, org or relationship set large enough to approach the PostgREST 1000-row cap (a folder subtree or one document's relationships past ~900 rows), or the next phase that touches document_search_service.py.
trigger_paths: ["backend/app/services/document_search_service.py", "backend/app/services/document_relationship_service.py"]
trigger_surfaces: []
migration_note:
relates_to: ["271-REVIEW.md WR-03", "WR-05 (version-count semantics vs the Older versions list)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-332: Find side-reads are not exact-or-loud

## The finding

The main candidate read raises a 503 on a short page. The three relationship reads are not paged and the folder reads
are not in strict mode, so a folder past the row cap returns zero rows with no error. WR-05 (open, needs a decision):
"has earlier versions" and the "N versions" tag count older versions of a shared document that Older versions will
never list (A3 / P-03: own rows only).

## Why it matters

A wrong-but-quiet answer is the one failure Find exists to avoid. Not reachable at current data sizes; reachable at
org scale.
