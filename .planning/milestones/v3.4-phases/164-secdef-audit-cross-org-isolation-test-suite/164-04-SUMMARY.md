---
phase: 164-secdef-audit-cross-org-isolation-test-suite
plan: 04
subsystem: database
tags: [rls, asyncpg, pgvector, security-definer, multi-tenancy, retrieval, text-to-sql, org-isolation]

# Dependency graph
requires:
  - phase: 163-rls-rewrite-user-jwt-client-swap
    provides: get_user_pg_connection / _apply_rls_user_context (uid-synthesized asyncpg user-context, no token → no mid-run expiry)
  - phase: 164-03 (migration 110)
    provides: the four org-scoped SECURITY DEFINER bodies + document_chunks PRAG-01 RLS widening (inert until this swap resolves auth.uid() in the producer)
  - phase: 164-01
    provides: the test_v3_4_org_isolation.py exit-gate legs (prag01_retrieval, definer, text_to_sql) that go GREEN here
provides:
  - Producer retrieval RPCs (match_document_chunks, keyword_search_chunks, match_skills) run over the asyncpg user-context
  - Text-to-SQL + grep query_user_documents path runs over the user-context (RLS-scoped)
  - Shared retrieval_service._call_as_user seam + _vector_literal pgvector-literal helper
  - _inject_user_id + _inject_user_id_for_grep DELETED (RLS is the cross-user gate)
  - The two-halves crux CLOSED — migration 110's org gate is now LIVE on the app path
affects: [165 is_global retirement, 166 org-admin/X-Org-Id, 167 invitations, 171 permission-aware citations, retrieval_service, agent_loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared _call_as_user(uid, sql, *args) seam: run any producer DB call over get_user_pg_connection so DEFINER/INVOKER bodies resolve auth.uid()=caller (fail-closed on service-role: 0 rows)"
    - "pgvector over asyncpg: format embedding as '[...]'::public.vector literal (_vector_literal) since asyncpg registers only a jsonb codec"
    - "Cast uuid columns ::text in the RPC SELECT to keep dict shape byte-compatible with the old PostgREST JSON (str-keyed fusion/enrich/sim lookups)"

key-files:
  created: []
  modified:
    - backend/app/services/retrieval_service.py
    - backend/app/services/agent_loop.py
    - backend/app/services/sql_service.py
    - backend/app/api/kb.py
    - backend/tests/integration/test_kb.py

key-decisions:
  - "D-164-02: producer retrieval + text-to-SQL/grep run over the asyncpg get_user_pg_connection user-context via a shared _call_as_user seam — never the request JWT (expires mid-run) nor service-role (auth.uid()=NULL → 0 rows)"
  - "D-164-04: _inject_user_id + _inject_user_id_for_grep DELETED; RLS on the INVOKER query_user_documents is now the cross-user gate; _inject_folder_scope + SELECT-only/no-';' guards RETAINED; query_user_documents NOT made DEFINER"
  - "tool_dispatcher required no change: the RPC leg self-acquires the user-context inside retrieval_service; ctx.supabase is kept only for the non-RPC enrich/audit reads (Deep byte-identical, D-14)"

patterns-established:
  - "Producer DB-identity seam: _call_as_user(uid, sql, *args) over get_user_pg_connection — the reuse point for any future producer RPC that must resolve the caller's org"
  - "pgvector-literal + ::text-cast SELECT for asyncpg RPC parity with PostgREST JSON"

requirements-completed: [TEN-03, PRAG-01]

# Metrics
duration: 35min
completed: 2026-07-20
---

# Phase 164 Plan 04: Producer asyncpg Client-Swap Summary

**The producer's three retrieval RPCs + the text-to-SQL/grep `query_user_documents` path now run over the Phase-163 asyncpg user-context (shared `_call_as_user` seam), the two security-injection regexes are deleted, and migration 110's in-body org gate is LIVE on the app path — closing the two-halves crux (TEN-03 / TEN-05 / PRAG-01).**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-20T20:29Z (approx)
- **Completed:** 2026-07-20T20:45Z (approx)
- **Tasks:** 3
- **Files modified:** 5 (4 source + 1 test)

## Accomplishments
- `retrieval_service._vector_search` / `_keyword_search` swapped off `supabase.rpc` onto a shared `_call_as_user` helper that opens `get_user_pg_connection(None, {"id": user_id})` — so `match_document_chunks` / `keyword_search_chunks` resolve `auth.uid()=caller` and migration 110's org gate returns the caller's rows (not the 0-for-everyone service-role transient).
- `agent_loop` `match_skills` (skill-catalog relevance pre-filter) routed onto the same seam — the mig-109 FIX-A org gate (is_system UNIVERSAL outside the gate) now resolves the caller; no new `ToolContext` field, no request-JWT capture.
- `_inject_user_id` (sql_service) + `_inject_user_id_for_grep` (kb.py) DELETED; `query_user_documents` (INVOKER) now runs over the user-context so RLS scopes the arbitrary SELECT — `_inject_folder_scope` + the SELECT-only / no-`;` guards RETAINED.
- Full exit-gate suite `test_v3_4_org_isolation.py` **18/18 GREEN** (prag01_retrieval, all 4 definer legs, both text_to_sql legs); 163 crux not regressed; CONCUR-01 <1s.

## Task Commits

Each task was committed atomically:

1. **Task 1: Vector/keyword retrieval RPCs → user-context** - `172e54a7` (feat)
2. **Task 2: match_skills → user-context seam** - `fc4225f2` (feat)
3. **Task 3: Delete injection regexes; text-to-SQL + grep → user-context** - `6f3039ea` (feat)
4. **Task 3 follow-on: grep unit-test update for the new seam** - `11245a04` (test)

**Plan metadata:** (this SUMMARY + STATE + ROADMAP + REQUIREMENTS + deferred-items) committed separately.

## Files Created/Modified
- `backend/app/services/retrieval_service.py` - Added `_call_as_user` + `_vector_literal`; `_vector_search`/`_keyword_search` now call the DEFINER RPCs via positional `$n` args over the user-context (`$1::public.vector`, id/document_id `::text`).
- `backend/app/services/agent_loop.py` - `match_skills` RPC routed onto `_call_as_user`; `sim_by_id` str-keyed via `id::text`; imports `_call_as_user`/`_vector_literal`.
- `backend/app/services/sql_service.py` - `_inject_user_id` deleted; `query_documents` runs `query_user_documents` over `get_user_pg_connection` (`conn.fetchval`); `_inject_folder_scope` + guards kept; unused `aexec`/`get_globally_visible_folder_ids` imports removed.
- `backend/app/api/kb.py` - `_inject_user_id_for_grep` deleted; `grep_path`'s `query_user_documents` runs over the user-context; folder-tree resolution still uses `supabase`.
- `backend/tests/integration/test_kb.py` - 3 grep tests re-pointed at a stubbed user-context connection (`_patch_grep_rpc`) reflecting the deleted-regex contract.

## Decisions Made
- **tool_dispatcher unchanged:** `search_documents`/`query_documents`/`grep_path` handlers still pass `ctx.supabase`, but the RPC leg self-acquires the user-context inside the services; `ctx.supabase` remains only for the non-RPC `_enrich_with_filenames` filename join + audit writes. No provider-path fork (D-14 Deep byte-identical).
- **`fetch_full_document` left on the passed-in client:** its direct `document_chunks` reassembly-fallback read is already owner-scoped by an explicit `.eq("user_id", user_id)` filter (a D-14 belt-and-suspenders filter kept this milestone), so owner reads are not regressed and no user-context routing was needed there.
- **uuid `::text` casts:** required so `_rrf_fuse` / `_enrich_with_filenames` / `sim_by_id` keep matching the str ids that flow from the supabase-JSON catalog/documents queries (an asyncpg `uuid.UUID` key would silently miss those lookups).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] uuid-key mismatch from asyncpg return types**
- **Found during:** Task 1 & 2 (designing `_call_as_user`)
- **Issue:** asyncpg returns `uuid.UUID` objects for uuid columns, but the old `supabase.rpc` path returned str ids (PostgREST JSON). `_rrf_fuse`/`_enrich_with_filenames` (keyed on str `document_id` from the supabase documents query) and `sim_by_id` (matched against str skill ids from the catalog query) would silently miss every lookup → "Unknown" filenames + lost skill-similarity ranking.
- **Fix:** Cast `id`/`document_id` `::text` in the RPC SELECT so the returned dicts are str-keyed, byte-compatible with the old JSON shape.
- **Files modified:** retrieval_service.py, agent_loop.py
- **Verification:** prag01_retrieval + definer legs GREEN; test_kb 24/24.
- **Committed in:** `172e54a7`, `fc4225f2`

**2. [Rule 1 - Bug] 3 grep unit tests broke on the deleted-regex contract**
- **Found during:** Task 3 broad-regression sweep (`test_kb.py::TestGrep`)
- **Issue:** `test_grep_no_path` / `test_grep_with_path` / `test_grep_rls` mocked the old `supabase.rpc("query_user_documents")` builder; after routing grep's RPC through `get_user_pg_connection`, the mock was bypassed → the endpoint hit the real DB and returned 0 matches.
- **Fix:** Added `_patch_grep_rpc(rows)` (stubs `app.api.kb.get_user_pg_connection`) and re-pointed the 3 tests; `test_grep_rls`'s obsolete "regex user_id injection" premise re-documented as RLS-via-user-context (live proof lives in `test_v3_4_org_isolation.py::test_text_to_sql_grep_path_isolation`).
- **Files modified:** tests/integration/test_kb.py
- **Verification:** test_kb.py 24/24 GREEN.
- **Committed in:** `11245a04`

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs — correctness of the swap + its test contract). No scope creep; no architectural change.
**Impact on plan:** Both were necessary to land the swap correctly. The plan's `tool_dispatcher.py` (listed in files_modified) required no change — documented above.

## Issues Encountered
- **Baseline-verification misstep:** to prove the retrieval/sql unit-test failures were pre-existing, I briefly `git checkout`'d the baseline versions of `retrieval_service.py`/`sql_service.py`, which broke `agent_loop`'s HEAD import of `_call_as_user`. Immediately restored both files to HEAD (`git checkout HEAD -- ...`); no commit affected. Confirmed the rot instead via the `RuntimeWarning: coroutine ... was never awaited` signal (see Deferred Issues).

## Deferred Issues (out of scope — logged to `deferred-items.md`)
- **D-164-04-A:** 27 pre-existing async-not-awaited rot tests in `tests/unit/test_retrieval_service.py` + `tests/unit/test_sql_service.py` — sync `def test_` methods call `async` functions without `await` (coroutine body never runs). These have been async since Phase 073/SEED-065; the failures are identical before/after this swap. NOT a 164-04 regression. Proper fix = a test-file async migration (unrelated to the client-swap). Behavioral proof for the swapped path is the live `test_v3_4_org_isolation.py` (18/18) + `test_kb.py` (24/24).
- **D-164-04-B:** `tests/integration/test_111_1_match_filters_stale.py::test_stale_model_chunks_excluded` broke at **164-03** (migration 110 org-scoped `match_document_chunks`) — it queries the function over a plain `pg_pool.acquire()` connection (`auth.uid()`=NULL → 0 rows). Needs a user-context-connection update (the `open_user_conn` pattern), a 164-03 migration-contract cleanup. My Python changes never touch this test's direct-DB path.

## User Setup Required
None - no external service configuration required. (Cloud parity owed at next operator-gated push: migrations 099→110 + `SECRETS_ENCRYPTION_KEY`, in order — carried from 164-03, not new here.)

## Threat Surface Scan
No new network endpoints, auth paths, or schema changes introduced. This plan MOVES existing producer DB calls onto the RLS-enforced user-context (net reduction in trust surface: it retires the two fragile regex scopers in favor of RLS). Threat register dispositions honored: T-164-ID-03 (route text-to-SQL/grep onto the user-context before deleting the regex) and T-164-EoP-01 / T-164-DoS-04 (uid-synthesized asyncpg claims, no request JWT) are satisfied. No threat flags.

## Next Phase Readiness
- **Two-halves crux CLOSED:** migration 110 (SQL half, 164-03) + this producer swap (app half, 164-04) are both live; retrieval returns the caller's rows and cross-org isolation is enforced by RLS on the app path.
- **Ready for `/gsd:verify-work 164`** + the SC#10 4-axis live operator UAT (`164-VALIDATION.md`) before phase close.
- **TEN-05 exit gate** (`test_v3_4_org_isolation.py`) is GREEN and is re-run after 166/167/168 per the milestone plan.
- Two deferred test-debt items (D-164-04-A rot, D-164-04-B 164-03 contract) are logged for the verifier / a later cleanup — neither blocks the phase.

## Self-Check: PASSED
- Files modified (all FOUND): retrieval_service.py, agent_loop.py, sql_service.py, kb.py, test_kb.py
- Commits (all FOUND): `172e54a7`, `fc4225f2`, `6f3039ea`, `11245a04`

---
*Phase: 164-secdef-audit-cross-org-isolation-test-suite*
*Completed: 2026-07-20*
