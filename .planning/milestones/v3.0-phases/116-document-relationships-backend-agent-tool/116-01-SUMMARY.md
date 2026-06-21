---
phase: 116-document-relationships-backend-agent-tool
plan: 01
subsystem: api
tags: [relationships, pydantic, supabase, postgrest, idempotency, migration, pytest, tdd]

# Dependency graph
requires:
  - phase: 110-dm-foundations
    provides: "document_relationships table (RLS user-scoped) + relationship.create/.delete in the live audit_log CHECK"
  - phase: 113-virtual-folders-filter-compiler
    provides: "document_view_service.py (the _client/_uid/own-scoped-delete clone target) + document_view.py (Literal-discriminator model)"
  - phase: 115-virtual-folders-agent-tool
    provides: "the one-core-no-fork extraction precedent + test_115_tool_global_leak.py (the two-user leak-proof harness)"
provides:
  - "RelationshipCreate (Literal rel_type → 422 at parse) + RelationshipResponse models"
  - "document_relationship_service.py: _resolve_readable_latest shared resolver, idempotent 23505-catch create, own-scoped delete, _uid guard verbatim"
  - "supabase/migrations/075_document_relationships_idempotency_index.sql (FILE only — additive partial unique index, un-applied)"
  - "10 Wave-0 test scaffolds (4 unit + 6 integration) incl. the non-vacuous two-user mask proof"
affects: [116-02 REST surface, 116-03 agent tool get_related_documents, 116-04 migration apply + full-schema regen, 117 relationship panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared FastAPI-free resolver (_resolve_readable_latest) consumed in-process by both the write gate and the read tool — one core, no fork (RESEARCH OQ2 / 115 precedent)"
    - "Idempotent create via 23505-catch → re-fetch existing edge (D-116-6; documents.py:491-505 pattern, returning existing instead of raising 409)"
    - "EXACT own-or-global filename resolution (deliberately NOT the own-only + partial-ilike anti-pattern)"

key-files:
  created:
    - backend/app/models/document_relationship.py
    - backend/app/services/document_relationship_service.py
    - supabase/migrations/075_document_relationships_idempotency_index.sql
    - backend/tests/unit/test_116_tool_schema.py
    - backend/tests/unit/test_116_tool_wiring.py
    - backend/tests/unit/test_116_handler.py
    - backend/tests/unit/test_116_whitelist_guard.py
    - backend/tests/integration/test_116_relationship_crud.py
    - backend/tests/integration/test_116_idempotency.py
    - backend/tests/integration/test_116_audit_live.py
    - backend/tests/integration/test_116_version_stable.py
    - backend/tests/integration/test_116_tool_read.py
    - backend/tests/integration/test_116_tool_leak.py
  modified: []

key-decisions:
  - "rel_type is a Pydantic Literal over the 4 types → a forged type fails at parse (422); the DB CHECK (migration 071:68) is defense-in-depth"
  - "_resolve_readable_latest follows a creation-time id FORWARD to its latest (user_id, filename, is_latest=True) version (read-time follow-to-latest, D-116-1a) — renaming-to-latest is impossible today so filename+is_latest is the stable handle"
  - "Migration 075 is the ONLY race-immune idempotency guarantee; the 23505-catch handles the TOCTOU window the index collapses to one winner"
  - "Two source-grep tests (anti-pattern absence, zero bare .execute) forced rewording two docstrings that named resolve_document_id / .execute() literally — documented as Rule-1 fixes"

patterns-established:
  - "Pattern: shared in-process resolver core (no FastAPI import) callable by both REST gate and agent tool"
  - "Pattern: idempotent-create-returns-existing on the additive partial unique index"

requirements-completed: [REL-01, REL-03, REL-04]

# Metrics
duration: 12min
completed: 2026-06-20
---

# Phase 116 Plan 01: Document Relationships Substrate Summary

**Pydantic Literal-typed relationship models + a shared own-or-global latest-version resolver, idempotent 23505-catch create, own-scoped delete, the additive migration-075 idempotency-index FILE, and 10 Wave-0 test scaffolds (incl. the non-vacuous two-user mask proof).**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-20T10:09:01Z
- **Completed:** 2026-06-20T10:20:33Z
- **Tasks:** 2
- **Files modified:** 13 (12 created + 1 test un-xfailed)

## Accomplishments
- **The shared core, no fork:** `_resolve_readable_latest(doc_id_or_filename, caller, *, by_filename=False)` — a single FastAPI-free helper that maps a document handle (id or EXACT filename) to the caller's LATEST accessible version (own `is_latest=True` ∪ globally-visible-folder `is_latest=True`, mirroring `documents.py:535-561`). Plan 02 (create visible-both gate) and Plan 03 (leak-safe read tool) both call it in-process.
- **Idempotent create:** `create_relationship` inserts then catches any `23505` and re-fetches the existing edge (D-116-6) — never a duplicate, never a 409, never an error. Migration 075's additive partial unique index `(user_id, source_doc_id, target_doc_id, rel_type)` is the race-immune backstop (FILE only — Plan 04 applies it).
- **Own-scoped delete + parse-time gate:** `delete_relationship` is `.eq("user_id", caller)` → False on a cross-user miss (router → 404, no existence leak); `RelationshipCreate.rel_type` is a `Literal` over the 4 types → a forged 5th value is a parse-time 422.
- **10 Wave-0 scaffolds, suite exits 0:** 4 unit (`tool_schema`/`tool_wiring`/`handler`/`whitelist_guard`) + 6 integration (`relationship_crud`/`idempotency`/`audit_live`/`version_stable`/`tool_read`/`tool_leak`). `test_116_tool_schema.py` recursively rejects `anyOf`/`oneOf` AND multi-type `type` arrays (the a5b0b917 Gemini trap). `test_116_tool_leak.py` is the non-vacuous two-user mask proof cloned from the 115 leak harness.

## Task Commits

Each task was committed atomically:

1. **Task 1: 10 Wave-0 scaffolds + migration 075 file** - `9ec29971` (test)
2. **Task 2: models + service (shared resolver, idempotent create, own-scoped delete)** - `f9bce905` (feat / TDD-green)

_Note: Task 2 was tdd="true"; the Wave-0 behavior tests already existed (authored RED/xfail in Task 1), so Task 2 is the single GREEN implementation commit that un-xfailed the resolver/idempotency/delete/parse rows in `test_116_handler.py`._

## Files Created/Modified
- `backend/app/models/document_relationship.py` - `RelationshipCreate` (Literal rel_type) + `RelationshipResponse`; directionality + read-time-follow-to-latest contract in the docstring
- `backend/app/services/document_relationship_service.py` - `_client`/`_uid` (verbatim from `document_view_service`), `_resolve_readable_latest` + `_latest_by_filename`, `create_relationship` (23505-catch), `delete_relationship` (own-scoped)
- `supabase/migrations/075_document_relationships_idempotency_index.sql` - additive partial unique index, header naming Phase 116 / REL-01 / D-116-6 + the manual-apply rule (FILE only, un-applied)
- `backend/tests/unit/test_116_tool_schema.py` - recursive Gemini-trap rejection (no anyOf/oneOf, no multi-type arrays, two scalar-string subject fields)
- `backend/tests/unit/test_116_tool_wiring.py` - dual-registration (`_TOOL_REGISTRY` AND `get_tools`) RED scaffold
- `backend/tests/unit/test_116_handler.py` - tier-1 model/service rows (GREEN now) + tier-2 handler rows (xfail until Plan 03)
- `backend/tests/unit/test_116_whitelist_guard.py` - dispatch whitelist guard (refuse-when-excluded / dispatch-when-allowed / None=Deep)
- `backend/tests/integration/test_116_{relationship_crud,idempotency,audit_live,version_stable,tool_read,tool_leak}.py` - LIVE scaffolds, `_pg_reachable` 2s-timeout-guarded, xfail until Plan 02/03

## Decisions Made
- **rel_type as a closed Literal:** forged type → 422 at parse; the DB CHECK is defense-in-depth, never the primary gate.
- **Read-time follow-to-latest:** the resolver follows a creation-time id forward to the current `(user_id, filename, is_latest=True)` row — so a re-upload/restore never orphans a link. The stored ids are stable handles, not pinned reads.
- **Index + app-code both:** migration 075 is the only race-immune guarantee; the 23505-catch is the graceful-return half. Both ship (the index FILE here, the catch live now).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded two service docstrings that tripped source-grep acceptance tests**
- **Found during:** Task 2 (service implementation)
- **Issue:** `test_116_handler.py::test_resolver_does_not_reuse_partial_match_antipattern` greps the whole service source for the literal `resolve_document_id`; my docstring NAMED the anti-pattern (to document that I deliberately don't reuse it), so the naive substring grep failed even though the symbol is never imported/called. Same class for the "zero bare `.execute()`" acceptance grep — the module docstring contained the literal `.execute()`.
- **Fix:** Reworded both docstrings to describe the anti-pattern by behavior ("the own-only + partial-ilike filename lookup in `retrieval_service`") and the threadpool wrap without the literal `.execute()` token, so the source-grep correctly confirms the symbol/pattern is genuinely absent.
- **Files modified:** backend/app/services/document_relationship_service.py
- **Verification:** `grep -c resolve_document_id` → 0; `grep -c '\.execute()'` → 0; `test_116_handler.py` 5 passed / 2 xfailed.
- **Committed in:** `f9bce905` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a test-vs-docstring grep false-positive, no behavior change).
**Impact on plan:** Cosmetic docstring rewording only; the resolver, idempotency, and delete behavior are exactly as planned. No scope creep.

## Issues Encountered
None beyond the documented Rule-1 docstring rewording. The SEED-056 base-checkout net-new-failure proof ran clean: base unit suite = 60 failed / 943 passed; with-plan = 60 failed / 951 passed (the +8 passed are the new GREEN `test_116_handler` rows) → **net-new failures = 0**.

## User Setup Required
None - no external service configuration required this plan. Migration 075 is authored but NOT applied (Plan 04, BLOCKING, applies it to :54322 + regenerates `full-schema.sql`).

## Next Phase Readiness
- **Plan 02 (REST surface)** can clone `document_views.py` CRUD against this service: `create_relationship` (with the router-side visible-both gate calling `_resolve_readable_latest`) + own-scoped `delete_relationship` + the `relationship.create`/`.delete` audits (already live-enum, no migration).
- **Plan 03 (agent tool)** can build `_handle_get_related_documents` calling the SAME `_resolve_readable_latest` for leak-safe per-viewer masking; the schema (`GET_RELATED_DOCUMENTS_TOOL`) un-xfails `test_116_tool_schema`/`tool_wiring`/`handler` tier-2/`tool_read`/`tool_leak`.
- **Plan 04 (BLOCKING)** applies migration 075 + regenerates `full-schema.sql` (which makes the idempotency tests race-immune, not just SELECT-then-INSERT).
- No blockers.

## Self-Check: PASSED

All 14 created files verified present; all 3 commits (`9ec29971`, `f9bce905`, `443c5648`) verified in git log.

---
*Phase: 116-document-relationships-backend-agent-tool*
*Completed: 2026-06-20*
