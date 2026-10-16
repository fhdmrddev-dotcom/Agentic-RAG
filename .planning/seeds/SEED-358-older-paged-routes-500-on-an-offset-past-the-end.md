---
seed_id: SEED-358
title: "Four pre-284 paged routes still answer an offset past the end with a 500 (PostgREST PGRST103 / 416); Find's folder-subtree filter still puts an id list in the URL"
created: 2026-10-16
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "The next phase that edits backend/app/api/workflow_runs.py, backend/app/api/knowledge_health.py or backend/app/api/document_governance.py; OR any report of a 500 after paging or filtering; OR a folder subtree in Find with more than ~150 folders."
trigger_paths: ["backend/app/api/workflow_runs.py", "backend/app/api/knowledge_health.py", "backend/app/api/document_governance.py", "backend/app/services/document_search_service.py", "backend/app/utils/db.py"]
trigger_surfaces: ["library", "workflows", "admin"]
migration_note:
relates_to: ["Phase 284 review CR-01 (fixed for the Library routes by app.utils.db.aexec_page)", "Phase 284 review WR-02 (Kong rejects a request line over 8,192 bytes: 208 ids pass, 209 fail)", "BUG-261014-06", "SEED-356"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-358: the same PGRST103 hole in older paged routes, and one more URL id list

## The finding

Phase 284's review (CR-01) found that with `count="exact"` plus `.range()`, PostgREST answers an
offset past the end with **416 / `PGRST103`**. supabase-py raises that as `APIError`, and an
unhandled `APIError` is a 500. 284 fixed every Library route through one helper,
`app.utils.db.aexec_page`, which re-reads the count and returns an empty page. Proven live in
`test_284_offset_past_end_live.py`.

The review-fix executor found the identical hole in four routes that pre-date 284 and left them
unchanged:

- `backend/app/api/workflow_runs.py:631` (async; can adopt `aexec_page` as is)
- `backend/app/api/knowledge_health.py:142` and `:338` (sync; needs a sync twin of the helper)
- `backend/app/api/document_governance.py:241` (sync; same)

It also measured that local Kong rejects a request line over **8,192 bytes** (208 ids pass, 209
fail; cloud failed at 286 in BUG-261014-06). Find's **folder-subtree** filter still sends the
subtree's folder ids in the URL. That is bounded by folders, not documents, which is why 284's
request recorder exempts `folder_id` lists, but a very large subtree could still cross 8 KB. Not
measured.

## The fix

1. A sync `exec_page` twin beside `aexec_page`; route the four calls through the matching helper,
   each with a test that pages past the end (RED first).
2. Measure the folder-subtree URL against a seeded tree of ~200 folders. If it crosses the budget,
   express the subtree in SQL (as 284 did for the visible-set union) rather than as an `in.()` list.
