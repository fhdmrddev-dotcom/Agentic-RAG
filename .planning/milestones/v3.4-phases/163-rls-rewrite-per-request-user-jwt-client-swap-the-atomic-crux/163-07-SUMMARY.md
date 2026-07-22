---
phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
plan: 07
subsystem: auth
tags: [rls, multi-tenancy, user-jwt, documents, folders, dm-cluster, org_id, TEN-02, D-03, D-05, D-14]

# Dependency graph
requires:
  - phase: 163-01
    provides: get_user_supabase / get_user_pg_connection / get_service_role_supabase factories
  - phase: 163-05
    provides: migrations 107 (TEN-04 chunk/skill org_id) + 108 (37-table membership RLS rewrite) APPLIED + inert
  - phase: 163-06
    provides: the get_user_supabase_client FastAPI-injectable adapter + the request-seam swap pattern + the conftest mirror
provides:
  - "TEN-02 (ADVANCED, not complete): the DOCUMENTS / DM cluster request handlers (documents/folders/document_views/document_relationships/classification_rules/metadata_fields/kb + the clean document_governance handlers) now enforce RLS via the per-request user-JWT client — RLS becomes the primary gate on document/folder CRUD"
  - "The preserved global branches proven under the user-JWT client: folder_is_globally_visible (recursive SECDEF) resolves the full global subtree; is_global own+global SELECT policies on document_views/classification_rules/metadata_field_definitions"
  - "The documents-cluster D-05 carve-out pattern: request-scoped inline DB/storage on the user-JWT client + a second service_supabase=Depends(get_supabase) for the detached BackgroundTask ingestion pipeline (pdf_extraction_runs has no authenticated INSERT policy)"
affects: [163-08, 163-09, 163-10, 164, 165]

# Tech tracking
tech-stack:
  added: []   # no new package
  patterns:
    - "Request-seam client swap (reused from plan 06): Depends(get_supabase) -> Depends(get_user_supabase_client) on the request handler; the conftest mirror makes it test-transparent"
    - "D-05 detached-BackgroundTask-writer carve-out: a second `service_supabase: Client = Depends(get_supabase)` param routes _upload_pipeline / ingest_document / background write_audit_entry to service-role (the ingest pipeline writes pdf_extraction_runs, which has RLS enabled but NO authenticated INSERT policy)"
    - "Classified service-role exceptions (grep-gate `commented exceptions only`): the audit_log analytics surface (knowledge_health), the cross-user existence probe (document_governance broken-relationships), and the cross-user operator reads (governance_service) legitimately keep service-role — the plan's `aggregate call that needs cross-user scope` carve-out"

key-files:
  created: []
  modified:
    - backend/app/api/documents.py
    - backend/app/api/folders.py
    - backend/app/api/document_views.py
    - backend/app/api/document_relationships.py
    - backend/app/api/classification_rules.py
    - backend/app/api/metadata_fields.py
    - backend/app/api/kb.py
    - backend/app/api/document_governance.py
    - backend/app/api/knowledge_health.py
    - backend/app/services/governance_service.py

key-decisions:
  - "documents.py HYBRID (Rule 2/D-05): the 11 request handlers swap to the user-JWT client for inline request-scoped work (owner SELECT/dedup/version/INSERT/UPDATE/DELETE + storage read/upload/delete — all owner-scoped RLS + owner-scoped storage.objects policies work under the user-JWT client), but upload/reingest/reextract/delete keep a commented `service_supabase=Depends(get_supabase)` for their DETACHED BackgroundTask writers. Justification: the ingest pipeline (_upload_pipeline/ingest_document) writes `pdf_extraction_runs`, which has RLS ENABLED but only a SELECT policy (mig 108) — a user-JWT client's INSERT would be silently denied. Mirrors plan 06's producer carve-out."
  - "knowledge_health.py kept ENTIRELY SERVICE-ROLE (classified exception): it reads `audit_log` (search.query events behind most-retrieved/never-retrieved/retrieval-trend/coverage), a table whose RLS is INSERT-only for authenticated (no SELECT policy) — a user-JWT client would read an EMPTY audit set and break the analytics. Owner-scoping stays the app-code `.eq(user_id)` gate (D-14). The plan's `aggregate/analytics call that needs service-role` carve-out."
  - "document_governance.py PARTIAL swap: the two clean owner-scoped-read handlers (unclassified, low-confidence) swap to the user-JWT client; broken-relationships stays SERVICE-ROLE (classified) because its `_latest_exists_anywhere` is a deliberate CROSS-USER existence probe (D-119-3 masking-vs-deletion) that must bypass RLS to tell an alive-elsewhere masked doc from a truly-deleted one."
  - "governance_service.py 3 raw-pool functions kept SERVICE-ROLE (classified): the all-users audit browse/export (NULL user_id = deliberate all-users read) + the auth.users roster are cross-user OPERATOR reads behind admin.py's require_operator gate (no RLS backstop by design). Converting them to get_user_pg_connection would RLS-restrict them to the operator's own rows and break the platform feed."
  - "Verify against the ACTUAL tests (Rule 3): the plan's `<automated>` commands name tests/test_documents.py / test_folders.py / test_classification_rules.py / test_metadata_fields.py which DO NOT EXIST — the real coverage is the tests/integration/test_11x cluster + tests/integration/test_kb.py + tests/test_knowledge_health.py. Ran those + the full test_163_* suite instead."

requirements-completed: []   # TEN-02 is phase-spanning: ADVANCED here (documents/DM cluster swapped) but completes after 163-08 (remaining routers) + the 163-09/10 CONCUR-01 benchmark. Kept Pending (163-01/06 precedent).

# Metrics
duration: ~45min
completed: 2026-07-19
---

# Phase 163 Plan 07: RLS User-JWT Client Swap — the Documents / DM Cluster Summary

**The documents / document-management cluster now enforces RLS via the per-request user-JWT client on the request-scoped CRUD path — RLS becomes the real gate on document/folder CRUD — while the preserved global branches (folder-global, is_global) still serve non-owners, the detached ingestion pipeline stays service-role (pdf_extraction_runs has no authenticated INSERT policy), and the audit_log analytics / cross-user probe / operator-roster reads keep a classified service-role carve-out. Retrieval RPCs are untouched (Phase 164).**

## Performance
- **Duration:** ~45 min
- **Tasks:** 2 (both `type="auto"`, no checkpoints)
- **Commits:** 2 per-task + this metadata commit

## Accomplishments
- **THE FLIP landed on the documents / DM cluster.** Request handlers across 8 API routers swapped `Depends(get_supabase)` (service-role, BYPASSRLS) → `Depends(get_user_supabase_client)` (per-request ANON-key + Bearer, RLS-ENFORCED): documents.py (11), folders.py (7), document_views.py (6), document_relationships.py (3), classification_rules.py (4), metadata_fields.py (4), kb.py (5), + document_governance.py (2 of 3). RLS (mig 108's membership predicates) is now the primary gate on document/folder CRUD.
- **The preserved global branches proven correct under the user-JWT client.** `folder_is_globally_visible` (a RECURSIVE SECURITY-DEFINER function) resolves the full global SUBTREE — matching the Python `is_in_global_subtree` — so `list_documents`, `fetch_visible_folders`, `get_globally_visible_folder_ids`, and all of kb.py (ls/tree/grep/glob/read) return own + global-folder docs for a non-owner unchanged. The `is_global` own+global SELECT policies on document_views / classification_rules / metadata_field_definitions keep global rules/fields/views visible to non-owners. `query_user_documents` (kb.grep) is SECURITY INVOKER, so it stays RLS-scoped under the user-JWT client.
- **D-05 detached-writer carve-out on the 4 BackgroundTask handlers.** upload/reingest/reextract/delete keep a commented `service_supabase=Depends(get_supabase)` for their detached `_upload_pipeline` / `ingest_document` / `write_audit_entry` tasks. Root cause discovered live: `pdf_extraction_runs` has RLS ENABLED but only a SELECT policy (mig 108) — the ingest pipeline's telemetry INSERT would be silently denied under a user-JWT client. Request-scoped inline DB + storage (owner-scoped `storage.objects` read/upload/delete policies) run on the RLS-enforced client.
- **Three classified service-role exceptions preserved (behavior byte-identical).** (1) `knowledge_health.py` reads `audit_log` (INSERT-only RLS for authenticated — no SELECT policy) → the whole module stays service-role with a module-docstring rationale + per-line markers. (2) `document_governance.py` broken-relationships keeps its cross-user existence probe (`_latest_exists_anywhere`, D-119-3 masking-vs-deletion) on service-role. (3) `governance_service.py`'s 3 raw-pool functions are cross-user OPERATOR reads (all-users audit + auth.users roster) behind `require_operator` — kept on the raw pool, classified.
- **Red lines held.** Retrieval SECDEF RPCs (match_document_chunks / keyword_search_chunks) untouched (Phase 164 boundary — they are not even called in this cluster). The `.eq("user_id")` belt-and-suspenders filters (D-14) and `run_in_threadpool` around every blocking supabase-py call (D-v2.5-01) are intact everywhere.

## Task Commits
1. **Task 1** — `a1c3acc6` (feat): documents/folders/document_views/document_relationships request handlers → user-JWT; documents.py 4 BackgroundTask handlers get the D-05 `service_supabase` carve-out.
2. **Task 2** — `307aab79` (feat): classification_rules/metadata_fields/kb → user-JWT; document_governance unclassified+low-confidence → user-JWT (broken-relationships classified service-role); knowledge_health + governance_service classified service-role.

## Verification
- **Full `test_163_*` suite: 95 passed** (unchanged before/after both tasks) — the shared adapter/seam + RLS harness still green through the swap.
- **Task 1 integration cluster: 43 passed + 5 xpassed, 0 failed** (test_112 patch/rls/custom-field/reextract-merge, test_113 view crud/global-leak/resolve, test_114 resolve-adhoc, test_116 relationship-crud/tool-leak, test_117 get-read/route-leak, test_118 accept/dismiss).
- **Task 2 integration cluster: 56 passed, 5 failed — all 5 PRE-EXISTING (zero net-new)** (test_118 rule-crud/rule-leak/ingest-suggest/ingest-real-splice, test_111 metadata-fields-crud/audit-field-create, test_kb, test_119 unclassified/broken/low-conf, test_knowledge_health).
- **App import smoke: OK** (no wiring/import breakage from the swaps).
- **Grep gates:** `Depends(get_supabase)` in the swapped files == 0 UNCOMMENTED (documents.py: 4 commented `service_supabase` carve-outs; document_governance.py: 1 commented; knowledge_health.py: 8 commented; folders/views/relationships/classification_rules/metadata_fields/kb: 0). Retrieval RPC grep shows only a comment reference in documents.py (no edit).

## Deviations from Plan

### Auto-fixed / Auto-decided Issues

**1. [Rule 2 - Missing critical functionality] documents.py D-05 carve-out for the detached ingestion pipeline**
- **Found during:** Task 1 (schema investigation)
- **Issue:** `pdf_extraction_runs` has RLS ENABLED but only a SELECT policy (mig 108) — no `authenticated` INSERT policy. The `_upload_pipeline` / `ingest_document` BackgroundTasks (which write telemetry rows there) would be silently denied under a naive full-swap to the user-JWT client, dropping ingestion telemetry.
- **Fix:** the 4 BackgroundTask-spawning handlers (upload/reingest/reextract/delete) keep a commented `service_supabase=Depends(get_supabase)` and route their detached writers to it; inline request-scoped work stays on the user-JWT client. Mirrors plan 06's producer carve-out + the plan's permitted "commented exception: background."
- **Files modified:** backend/app/api/documents.py — **Commit:** a1c3acc6

**2. [Rule 3 - Blocking / correctness] knowledge_health.py kept service-role (audit_log has no authenticated SELECT policy)**
- **Found during:** Task 2
- **Issue:** knowledge_health reads `audit_log` for the retrieval-analytics metrics; `audit_log` RLS is INSERT-only for authenticated. A user-JWT swap would make those reads return empty → broken dashboard.
- **Fix:** kept the whole module on service-role with a module-docstring rationale + per-injection markers (classified exception per the plan's "aggregate/analytics call that needs service-role"). Owner-scoping stays the app `.eq(user_id)` gate (D-14).
- **Files modified:** backend/app/api/knowledge_health.py — **Commit:** 307aab79

**3. [Rule 3 - Blocking / correctness] document_governance broken-relationships + governance_service kept service-role (cross-user scope)**
- **Found during:** Task 2
- **Issue:** `document_governance._latest_exists_anywhere` is a deliberate cross-user existence probe (D-119-3 masking-vs-deletion) and `governance_service`'s 3 raw-pool functions are all-users operator reads (audit browse/export + auth.users roster) — both would break under RLS.
- **Fix:** kept these on service-role, classified with comments (the plan's "leave aggregate calls that legitimately need cross-user scope on the hardened service-role"). The 2 clean owner-scoped document_governance handlers still swapped to user-JWT.
- **Files modified:** backend/app/api/document_governance.py, backend/app/services/governance_service.py — **Commit:** 307aab79

**4. [Rule 3 - Blocking] Plan verify commands name non-existent test files → ran the actual coverage**
- **Found during:** verification
- **Issue:** the plan's `<automated>` commands reference `tests/test_documents.py` / `test_folders.py` / `test_classification_rules.py` / `test_metadata_fields.py`, none of which exist (only `tests/test_knowledge_health.py` does). The real coverage lives in `tests/integration/test_11x_*` + `tests/integration/test_kb.py`.
- **Fix:** ran the actual relevant integration suites + `test_knowledge_health.py` + the full `test_163_*` suite; established a pre-change baseline to separate regressions from pre-existing rot.

### Pre-existing failures (NOT regressions — logged to deferred-items.md)
- `test_119_leak.py` ×3 (TestClient-vs-asyncpg loop isolation — documented pre-existing).
- `test_knowledge_health.py::test_never_retrieved_excludes_retrieved_docs` (in the pre-change baseline; knowledge_health is byte-unchanged by the swap).
- `test_111_field_def_scoping.py::test_scoped_read_excludes_other_users_private_field` — raw-asyncpg INSERT of a global row (`user_id=NULL`) hits `NotNullViolationError: null value in column "org_id"` (mig 105 NOT-NULL + mig 106 autofill can't derive org_id from a NULL user_id). The test never imports metadata_fields.py, so it is mathematically independent of the client swap. Candidate for Phase 165 / a test-seed refresh.

## Threat Flags
None — no new network endpoint, auth path, or trust-boundary schema surface beyond the plan's `<threat_model>` (T-163-07a/b/c + T-163-06b addressed; the SECDEF retrieval boundary is deliberately untouched — Phase 164).

## Known Stubs
None — this is a behavior-preserving client-construction swap; no placeholder data, no unwired components.

## Self-Check: PASSED
- Files: FOUND `163-07-SUMMARY.md` + all 10 modified source files present across the 2 task commits (4 + 6).
- Commits: FOUND `a1c3acc6` (Task 1), `307aab79` (Task 2).
- Gates: `test_163_*` 95/95 (before + after); Task 1 integration 43 passed / 0 failed; Task 2 integration 56 passed / 5 failed (all 5 pre-existing, proven zero net-new vs the pre-change baseline); app import OK; grep-gate `Depends(get_supabase)` == 0 uncommented in the swapped files; retrieval SECDEF RPCs untouched.
