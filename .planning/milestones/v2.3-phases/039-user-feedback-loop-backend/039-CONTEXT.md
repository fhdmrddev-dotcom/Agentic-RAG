# Phase 39: User Feedback Loop — Backend - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the backend for user feedback on assistant responses: `message_feedback` table (migration 028), `POST /feedback` to submit ratings, `GET /feedback/stats` for aggregate stats, and audit log integration. Backend only — Phase 40 builds the UI.

Delivers: immutable per-message ratings, optional reason enum, overall positive rate (all-time), top-5 most-downvoted documents (30-day window), and audit trail for all feedback submissions.

</domain>

<decisions>
## Implementation Decisions

### Feedback Mutability
- **D-01:** Ratings are truly permanent — no DELETE or PUT endpoint. UNIQUE(message_id, user_id) constraint enforces one rating per message per user, ever. Simplest schema; no soft-delete column needed.
- **D-02:** If a user submits feedback on a message they've already rated, the POST returns a 409 Conflict.

### Stats Time Windows
- **D-03:** `GET /feedback/stats` overall positive rate is **all-time** (total thumbs-up / total ratings ever). Gives a stable, meaningful baseline.
- **D-04:** Most-downvoted documents use the **last 30 days** window — consistent with Phase 37 knowledge health windows and Phase 40 dashboard expectations.

### Audit Integration
- **D-05:** Action type string: `feedback.submit` — follows the existing dotted namespace convention (`search.query`, `memory.remember`). Add to `VALID_ACTION_TYPES` in `audit_service.py`.
- **D-06:** Audit metadata: `{"message_id": <str>, "rating": "positive"|"negative", "reason": <str|null>}`.
- **D-07:** Audit write is fire-and-forget via `asyncio.create_task()` — same pattern as all other audit writes.

### Most-Downvoted Document Attribution
- **D-08:** A downvote is attributed to **all documents in `messages.source_refs`** for that message. If a message cited 3 documents, all 3 get +1 downvote count. Captures every potentially-at-fault document.
- **D-09:** Messages with empty `source_refs` (pure-reasoning, no RAG) are excluded from document attribution — there are no documents to attribute to.
- **D-10:** Aggregation query: join `message_feedback` → `messages` via `message_id`, unnest `source_refs` JSONB array, filter `rating = 'negative'` and `created_at >= now() - 30 days`, count downvotes per `document_id`, join to `documents` for filename, top-5 by count.

### Table & Endpoint Design
- **D-11:** New table: `message_feedback` with columns `id`, `user_id`, `message_id`, `rating` (enum: positive/negative), `reason` (enum: wrong_answer/not_from_documents/incomplete/other, nullable), `created_at`. UNIQUE(message_id, user_id). RLS: users can INSERT and SELECT their own rows only.
- **D-12:** `POST /feedback` body: `{message_id: uuid, rating: "positive"|"negative", reason?: string}`. Returns 201 on success, 409 if already rated.
- **D-13:** `GET /feedback/stats` response: `{positive_rate: float, total_ratings: int, downvoted_documents: [{document_id, filename, folder_id, downvote_count}]}`.
- **D-14:** New router: `backend/app/api/feedback.py` with `APIRouter(prefix="/feedback", tags=["feedback"])`, registered in `main.py`.
- **D-15:** Migration file: `028_message_feedback.sql` — creates table, RLS policies, UNIQUE constraint. Add index on `(user_id, created_at)` for stats queries.

### Claude's Discretion
- Whether to use a Postgres-level ENUM type for `rating` and `reason` columns, or VARCHAR with a CHECK constraint.
- Whether the top-5 most-downvoted aggregation runs Python-side or as a Supabase RPC — use whichever is cleaner given existing patterns.
- Exact error response format for 409 Conflict (consistent with existing endpoint error shapes).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing audit infrastructure
- `backend/app/services/audit_service.py` — `write_audit_entry`, `VALID_ACTION_TYPES` (add `feedback.submit` here), fire-and-forget pattern
- `backend/app/api/audit.py` — `_apply_filters`, `_since_to_dt` helpers; pattern for reading audit_log

### Router and dependency patterns
- `backend/app/dependencies.py` — `get_current_user`, `get_supabase` dependency injection
- `backend/app/main.py` — `include_router` registration pattern

### Source refs data shape
- `backend/app/api/threads.py` (lines ~533–564) — `source_refs` JSONB array structure: `{"document_id": str, "filename": str, ...}`; `confidence_avg_similarity` field

### Document versioning
- `backend/app/api/documents.py` — `is_latest=True` filter for active documents (needed for document attribution join)

### Migration precedents
- `supabase/migrations/026_user_memory.sql` — recent migration for reference on table/RLS/trigger pattern

### Requirements
- `.planning/REQUIREMENTS.md` §FB-01 through FB-03 (Phase 39 requirements)
- `.planning/ROADMAP.md` §Phase 39 — success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `audit_service.py:write_audit_entry()` — drop-in audit write; add `feedback.submit` to VALID_ACTION_TYPES
- `audit.py:_since_to_dt()` — reuse for 30-day window in stats query
- `app/dependencies.py:get_current_user, get_supabase` — standard FastAPI dependency injection

### Established Patterns
- Router file: `backend/app/api/<name>.py` with `APIRouter(prefix="/...", tags=[...])`
- RLS filter: `.eq("user_id", current_user["id"])` — never trust client-supplied user_id
- Supabase Python client: `.table(...).select(...).eq(...).execute()`
- Audit writes: `asyncio.create_task(write_audit_entry(...))` — fire-and-forget, never await

### Integration Points
- `messages` table: `id`, `user_id`, `source_refs` (JSONB), `confidence_avg_similarity`
- `audit_log` table: `user_id`, `action_type`, `metadata` (JSONB), `created_at`
- `documents` table: `id`, `filename`, `folder_id`, `user_id`, `is_latest`
- `main.py`: add `from app.api.feedback import router as feedback_router` + `app.include_router(feedback_router)`

</code_context>

<specifics>
## Specific Ideas

- `source_refs` structure in messages: `[{"document_id": "uuid", "filename": "...", "passage": "...", "avg_similarity": 0.xx}]`. Use `document_id` as the join key for attribution.
- For the most-downvoted query: filter negative ratings in the last 30 days, join to messages, unnest source_refs JSONB, group by document_id, count, join to documents for filename. Top-5 by count.
- The `reason` enum values (from Phase 40 spec): `wrong_answer`, `not_from_documents`, `incomplete`, `other`. Use snake_case to match Python conventions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 039-user-feedback-loop-backend*
*Context gathered: 2026-04-18*
