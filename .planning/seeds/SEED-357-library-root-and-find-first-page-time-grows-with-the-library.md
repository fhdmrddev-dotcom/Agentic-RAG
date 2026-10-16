---
seed_id: SEED-357
title: "Library Root and Find page 1 take 2.5x longer at 50k than at 10k — the exact count and the top-25 sort both scan every latest row the user owns"
created: 2026-10-16
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "An account (or org) in production passes 10,000 latest documents; OR the Library's first page or Find page 1 is reported slow; OR the next phase that edits supabase/migrations for the documents table or backend/app/api/documents.py's list handler."
trigger_paths: ["backend/app/api/documents.py", "backend/app/services/document_search_service.py", "supabase/migrations/"]
trigger_surfaces: ["library"]
migration_note: "The fix is most likely an index (a new numbered migration, applied in production before the backend that relies on it)."
relates_to: ["Phase 284 (FIX-11, SC#1 / D-22 — 284-MEASUREMENTS.md 'AFTER — verdict per D-22 criterion')", "BUG-261014-07 (closed by 284)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-357: Root and Find page 1 grow with the library

## The finding (measured in Phase 284, 2026-10-16)

After Phase 284 the Library is correct at 50,000 documents and its response size is flat (26 KB per
first page at both 10k and 50k). Time is flat for a folder page and for the summary, but **not** for
the two surfaces whose total is an exact `count(*)` over a large set:

| surface | 10k | 50k (quiet host) | ratio |
|---|---|---|---|
| `GET /documents` Root page 1 | 185.6 ms | 470.7 ms | 2.54x |
| `POST /document-search` page 1 | 192.8 ms | 499.4 ms | 2.59x |
| `GET /documents` Big page 1 / last | 133.1 / 136.4 ms | 192.9 / 189.0 ms | 1.45x / 1.39x |
| `GET /library/summary` | 84.3 ms | 122.6 ms | 1.45x |

`EXPLAIN ANALYZE` as `authenticated` at 10k: the Root count is a Bitmap Heap Scan over every latest
row the user owns (`documents_latest_idx` on `(user_id, is_latest)`), then the view / RLS predicate
per row (count 25.2 ms, page 22.8 ms in SQL). The page sorts the whole Root set to pick 25 rows. Under
contention (an unrelated process holding a core) Root page 1 read 622-680 ms at 50k.

Phase 284's D-22 acceptance asked for first-page time at 50k within 1.5x of 10k. Root and Find missed
it, and ROADMAP SC#1 ("neither grows with the library") is met on size but only partly on time.

## The likely fix

1. A partial index matching the Root / created-order shape, e.g. `documents (user_id, created_at DESC, id DESC) WHERE is_latest AND folder_id IS NULL`
   (and the `updated_desc` twin if that order is used), so the page is an index walk that stops at 25.
2. The count stays exact (that is FIX-11's whole point) and is linear by nature. Either accept it
   (it is ~25 ms of SQL at 10k), or take the Root count from the summary's GROUPING SETS read the page
   already makes, so the list request skips `count=exact`. 284-04 measured ~250 ms of API-layer handling
   around an exact count at 50k against ~40 ms in SQL; find that before adding an index.
3. Re-run `scripts/measure-library-284.py` at 10k and 50k on a quiet host. Accept when Root and Find
   page 1 are within 1.5x.

## Why it is a seed and not a fix in 284

Found at the phase's orchestrator checkpoint, after the code was merged. The fix needs a new migration
and therefore another production step before the backend deploy. That is new scope in a checkpoint.
Production today holds 178 documents in total (read-only MCP, 2026-10-16), so nobody is near the
numbers above.
