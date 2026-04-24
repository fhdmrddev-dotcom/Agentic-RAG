---
phase: 037-knowledge-health-dashboard-backend
plan: "01"
subsystem: backend
tags: [knowledge-health, api, audit, documents, metrics]
dependency_graph:
  requires: [audit_log table, messages table, documents table, app.dependencies]
  provides: [GET /knowledge-health/summary endpoint]
  affects: [backend/app/main.py]
tech_stack:
  added: []
  patterns: [Python-side aggregation from JSONB, is_latest=True filter, empty-list guard before .in_()]
key_files:
  created:
    - backend/app/api/knowledge_health.py
  modified:
    - backend/app/main.py
decisions:
  - Python-side aggregation for most_retrieved and low_confidence (unnest JSONB doc_ids in Python, not SQL) — simpler with Supabase client
  - Empty top_ids guard before .in_() query to avoid Supabase rejecting empty-list queries
  - .lt() filter for stale documents (created_at < cutoff)
  - source_refs entry avg_similarity falls back to row confidence_avg_similarity when entry field missing
metrics:
  duration: 75s
  completed_date: "2026-04-18"
  tasks_completed: 2
  files_changed: 2
---

# Phase 37 Plan 01: Knowledge Health Backend Summary

**One-liner:** GET /knowledge-health/summary endpoint deriving four document health signals (most-retrieved, never-retrieved, low-confidence, stale) via Python-side aggregation over audit_log, messages, and documents tables with RLS enforcement.

## What Was Built

Created `backend/app/api/knowledge_health.py` — a new FastAPI router with one endpoint and four private helper functions:

- `_fetch_most_retrieved(supabase, user_id)` — queries audit_log for `search.query` actions in the last 30 days, unnests `metadata.document_ids` in Python using `defaultdict(int)`, sorts by count descending, fetches document metadata via `.in_()`, returns top-10 with `retrieval_count` and `last_retrieved_at`.
- `_fetch_never_retrieved(supabase, user_id)` — fetches all active documents and all audit_log `search.query` entries, builds a `retrieved_set` from all referenced doc_ids, returns documents absent from the set (all-time, no window).
- `_fetch_low_confidence(supabase, user_id)` — queries messages in the last 30 days with `source_refs`, accumulates per-document similarity scores, keeps documents with avg < 0.40, sorts ascending (worst first), fetches metadata, returns top-10.
- `_fetch_stale(supabase, user_id, stale_days)` — queries `is_latest=True` documents with `created_at < cutoff`, computes `days_stale` in Python via `datetime.fromisoformat`, sorts descending, returns top-10.

Registered the router in `backend/app/main.py` by adding `knowledge_health` to the import line and `app.include_router(knowledge_health.router)` after `audit.router`.

## Key Implementation Decisions

1. **Python-side aggregation** — The Supabase Python client does not support SQL GROUP BY / unnest natively. Both most_retrieved and low_confidence aggregate JSONB array contents in Python using `defaultdict`. Simpler and more testable than raw SQL.

2. **Empty-list guard before `.in_()`** — Both `_fetch_most_retrieved` and `_fetch_low_confidence` return `[]` early if there are no document IDs to look up. This prevents Supabase from receiving an empty `.in_()` query (which would error or return unexpected results).

3. **`.lt()` filter for stale** — `created_at < cutoff` maps directly to Supabase `.lt("created_at", cutoff)`. Correct for the "older than N days" semantic.

4. **source_refs fallback** — When a `source_refs` entry is missing its own `avg_similarity` field (some older message rows may not have per-citation scores), the code falls back to `row["confidence_avg_similarity"]`. Ensures backward compatibility with pre-Phase-26 rows.

5. **RLS via Python filter** — Every query includes `.eq("user_id", user_id)`. Users only see their own data. Consistent with all existing routers.

## Commits

- `7a6a6f7` — feat(037-01): create knowledge_health router with four metric queries
- `a497e8d` — feat(037-01): register knowledge_health router in main.py

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `backend/app/api/knowledge_health.py` exists and imports cleanly
- `backend/app/main.py` contains `knowledge_health` in import and `include_router` call
- `/knowledge-health/summary` present in app routes
- Constants `LOW_CONF_THRESHOLD=0.40`, `WINDOW_DAYS=30`, `TOP_N=10` verified
