---
seed_id: SEED-357
title: "Library Root and Find page 1 take 2.5x longer at 50k than at 10k — the exact count and the top-25 sort both scan every latest row the user owns"
created: 2026-10-16
surface: Agentic-RAG
status: answered
partial: false
status_note: |
  ANSWERED by Phase 284-06 (migration 208, 2026-10-16, local; production not yet applied).
  Quiet host (typeperf 12-16 %), HTTP median, 10k -> 50k:
    Root page 1  45.1 -> 55.6 ms = 1.23x   (BEFORE, same host: 135.3 -> 445.6 ms = 3.29x;
                                            284-05 run 1: 185.6 -> 470.7 ms = 2.54x)
    Find page 1  47.4 -> 67.2 ms = 1.42x   (BEFORE: 154.7 -> 465.7 ms = 3.01x; 284-05: 2.59x)
  SQL: the page node is flat (Root 0.82 -> 1.10 ms, Find 1.22 -> 1.22 ms). The exact count stays
  linear by design (FIX-11), now ~0.45 us/row (Root 2.6 -> 13.5 ms, Find 5.1 -> 22.7 ms).
  The cause was NOT "~250 ms of API-side handling". The API side is a flat ~40-60 ms, and the
  time was inside the one PostgREST statement:
    (a) the view's OR predicate allowed no ordered walk, and Root's embeds ran for every row;
    (b) the documents SELECT policy evaluated auth.uid() per row, re-parsing the JWT claims each time.
  Not fixed (recorded in 284-MEASUREMENTS.md "AFTER (208)"):
    - GET /library/summary 45.7 -> 88.1 ms = 1.93x (an exact aggregate over every row);
    - a deep page (Big LAST page) 69.1 -> 126.1 ms = 1.82x (linear in the OFFSET).
  Production order: 207 -> 208 -> get_advisors(security) -> backend -> frontend.
trigger_when: "An account (or org) in production passes 10,000 latest documents; OR the Library's first page or Find page 1 is reported slow; OR the next phase that edits supabase/migrations for the documents table or backend/app/api/documents.py's list handler."
trigger_paths: ["backend/app/api/documents.py", "backend/app/services/document_search_service.py", "supabase/migrations/"]
trigger_surfaces: ["library"]
migration_note: "The fix is most likely an index (a new numbered migration, applied in production before the backend that relies on it)."
relates_to: ["Phase 284 (FIX-11, SC#1 / D-22 — 284-MEASUREMENTS.md 'AFTER — verdict per D-22 criterion')", "BUG-261014-07 (closed by 284)"]
folded_into: "284-06 (migration 208 — supabase/migrations/208_library_page_index.sql)"
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
