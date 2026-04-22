# Phase 37: Knowledge Health Dashboard — Backend - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Build `GET /knowledge-health/summary` — a metrics API that derives four document health signals from `audit_log` and `messages` tables, enforcing RLS so users only see their own data.

Delivers: most-retrieved, never-retrieved, low-confidence, and stale document lists (top-10 each).
Backend only. Phase 38 builds the frontend view that consumes this endpoint.

</domain>

<decisions>
## Implementation Decisions

### Low-Confidence Data Source

- **D-01:** Derive low-confidence documents from the `messages` table — join `messages.source_refs` (JSONB array with document_id) against `messages.confidence_avg_similarity`. No migration needed; data exists from Phase 26.
- **D-02:** Threshold for "low-confidence": avg similarity < 0.40. Matches the existing `_compute_confidence` Low boundary from Phase 26. Consistent framing — documents that consistently produce Low-confidence responses.
- **D-03:** Window for low-confidence aggregation: last 30 days (same as most-retrieved).

### Staleness Definition

- **D-04:** Staleness uses the `is_latest=True` document row's `created_at`. Re-uploading a new version resets the clock — correctly treats re-ingested documents as fresh.
- **D-05:** The 90-day threshold is configurable via query param: `?stale_days=N` (default 90). Lets Phase 38 expose a UI control without a backend change. No user settings migration needed.

### API Response Shape

- **D-06:** Each document entry in the summary is a lightweight object:
  - `document_id`, `filename`, `folder_id`, `created_at`, `file_size`
  - Plus metric-specific field: `retrieval_count` (most-retrieved), `avg_similarity` (low-confidence), `last_retrieved_at` (most-retrieved), `days_stale` (stale)
  - Enough for Phase 38 to render rows with Delete / Re-ingest / Move action buttons without over-fetching.
- **D-07:** Most-retrieved and low-confidence metrics use a 30-day window. Consistent with existing audit log filter presets.

### Never-Retrieved Scope

- **D-08:** "Never-retrieved" = documents with zero `search.query` audit entries referencing their `document_id`, all-time. True dead weight — the actionable case for deletion or review.

### Endpoint

- **D-09:** Single summary endpoint: `GET /knowledge-health/summary`. Returns four arrays: `most_retrieved`, `never_retrieved`, `low_confidence`, `stale`. Top-10 per category. `stale_days` query param (default 90).
- **D-10:** New router registered in `main.py` following existing pattern. File: `backend/app/api/knowledge_health.py`.
- **D-11:** RLS enforced via `user_id = current_user["id"]` filter on all queries — users only see their own documents/messages.

### Performance

- **D-12:** Target < 2s for libraries up to 10,000 documents. Use Supabase Python client (no raw SQL). If aggregation is slow, compound index on `audit_log(user_id, action_type, created_at)` can be added in the migration.

### Claude's Discretion

- Exact SQL aggregation strategy vs Python-side aggregation for `most_retrieved` — use whichever the Supabase client handles more naturally.
- Whether to add a Postgres index in this phase or defer to Phase 38 if performance is acceptable in testing.
- Error handling style (consistent with existing endpoints).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing audit infrastructure
- `backend/app/api/audit.py` — Existing audit log read endpoints; filter helpers and `_apply_filters` pattern to reuse
- `backend/app/services/audit_service.py` — `write_audit_entry`, `VALID_ACTION_TYPES`, audit metadata schema for `search.query` (`query_text`, `document_ids`)

### Confidence/similarity data
- `backend/app/api/threads.py` (lines ~555–580) — How `confidence_avg_similarity` and `source_refs` are persisted into messages; `_compute_confidence` thresholds (≥0.55 = High, ≥0.40 = Medium, <0.40 = Low)

### Document versioning (is_latest pattern)
- `backend/app/api/documents.py` — `is_latest=True` filter pattern for active documents (Phase 28)

### Router registration
- `backend/app/main.py` — Existing `include_router` calls to follow

### Requirements
- `.planning/REQUIREMENTS.md` §Knowledge Health Dashboard (HLTH-01 through HLTH-04)
- `.planning/ROADMAP.md` §Phase 37 — success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `audit.py:_apply_filters()` — User-id + since + action_type filter helper; reuse or extend for health queries
- `audit.py:_since_to_dt()` — 7d/30d/90d string-to-datetime converter; reuse for `?window=30d` equivalent
- `app/dependencies.py` — `get_current_user`, `get_supabase` dependency pattern used by all routers
- `audit_service.py:VALID_ACTION_TYPES` — Frozenset of valid action types; `search.query` is the relevant one

### Established Patterns
- Router file at `backend/app/api/<name>.py` with `APIRouter(prefix="/...", tags=[...])`
- `current_user["id"]` for RLS filtering; never trust client-supplied user_id
- `supabase.table(...).select(...).eq("user_id", user_id).execute()` — standard Supabase query pattern
- Fire-and-forget audit writes via `asyncio.create_task()` (not applicable here — this phase only reads)
- All active documents: filter with `.eq("is_latest", True)` (Phase 28 versioning)

### Integration Points
- `messages` table: columns `user_id`, `confidence_avg_similarity` (float), `source_refs` (JSONB array of citation objects with `document_id`)
- `audit_log` table: columns `user_id`, `action_type`, `metadata` (JSONB with `document_ids` array for `search.query`), `created_at`
- `documents` table: columns `id`, `filename`, `user_id`, `folder_id`, `created_at`, `file_size`, `is_latest`

</code_context>

<specifics>
## Specific Ideas

- The `source_refs` JSONB array in messages stores citation objects like `{"document_id": "...", "document_name": "...", "passage": "...", "avg_similarity": ...}`. The `document_id` field is the join key for low-confidence aggregation.
- For most-retrieved: unnest `audit_log.metadata->'document_ids'` (JSONB array) and count by document_id, filtering `action_type = 'search.query'` and `created_at >= now() - 30 days`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 037-knowledge-health-dashboard-backend*
*Context gathered: 2026-04-18*
