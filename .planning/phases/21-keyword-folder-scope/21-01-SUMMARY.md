---
phase: 21-keyword-folder-scope
plan: 01
status: complete
completed: 2026-04-10
---

## What was built

Fixed a correctness bug where folder-scoped threads returned keyword search results from outside the scoped folder subtree.

- `_keyword_search()` in `backend/app/services/retrieval_service.py` now accepts `folder_ids` and passes it as `p_folder_ids` to the `keyword_search_chunks` RPC
- `search_documents()` passes `folder_ids` to both `_vector_search` and `_keyword_search` — they were previously mismatched (vector scoped, keyword unscoped)
- Migration `020_keyword_search_folder_scope.sql` — updated `keyword_search_chunks` RPC to accept and apply `p_folder_ids` filter

## Key files
- `backend/app/services/retrieval_service.py`
- `supabase/migrations/020_keyword_search_folder_scope.sql`

## Verification
- Committed in d996f9f
- DB confirms both overloads of `keyword_search_chunks` present (old without p_folder_ids, new with)
- Migration applied to production DB
