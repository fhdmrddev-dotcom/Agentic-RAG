---
phase: 164-secdef-audit-cross-org-isolation-test-suite
plan: 01
subsystem: testing
tags: [postgres, rls, security-definer, pgvector, cross-org-isolation, pytest, asyncpg, supabase]

# Dependency graph
requires:
  - phase: 163-rls-rewrite-user-jwt-swap
    provides: "_rls_harness (open_user_conn / assert_auth_uid / as_user_supabase_txn / requires_pg), two_orgs_two_users fixture, membership-RLS baseline (mig 108/109)"
  - phase: 161-org-dept-role-schema
    provides: "current_user_org_ids() SECDEF membership resolver + org tables"
provides:
  - "backend/tests/integration/test_v3_4_org_isolation.py — the named v3.4 milestone exit gate (18 tests)"
  - "A proven-RED anchor (test_definer_ignores_spoofed_match_user_id) demonstrating the pre-164 spoofed-match_user_id cross-org leak"
  - "A pg_proc DEFINER audit (prosecdef + pinned search_path) over all four SECDEF functions"
  - "A non-vacuous two-org chunk + shared-folder fixture (two_orgs_chunks_and_shared_folder) extending the 163 fixtures"
  - "The D-164-04 text-to-SQL/grep arbitration (query_user_documents user-context vs leak-conn) proving the connection is the gate, not the deleted regex"
affects: [164-02-migration-authoring, 164-03-migration-110-apply, 164-04-producer-client-swap, milestone-exit-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 red-then-green exit-gate scaffold: author the isolation matrix FIRST against the pre-fix DB so the red-anchor is provably RED before the fix lands"
    - "Non-user-context leak-conn RED-demonstration: run an INVOKER RPC over a plain (BYPASSRLS) pool connection to prove the connection identity — not a deleted regex — is the isolation gate"
    - "information_schema-driven every-user-facing-table matrix over BOTH DB paths (asyncpg + supabase-py bridge)"

key-files:
  created:
    - "backend/tests/integration/test_v3_4_org_isolation.py"
  modified: []

key-decisions:
  - "Requirements TEN-05/TEN-03/PRAG-01 NOT marked complete — this Wave-0 plan authors the exit gate + proves it RED; the reqs go GREEN only after Plan 03 (mig 110) + Plan 04 (client-swap)"
  - "DEFINER functions covered over asyncpg only — SupabaseTxnAdapter.rpc() is a record-only stub (cannot EXECUTE an RPC), so the supabase-py DB path is proven by the table matrix instead"
  - "PRAG-01 leg proves org-AND-folder-ACL scoping (a disjoint-org reader gets 0 even for A's is_global-folder chunk); the co-member POSITIVE folder-ACL proof is a Phase 166/167 forward gate"
  - "Red-anchor seed uses a UNIT vector (not a zero vector) — a zero-vector cosine distance is NaN and would false-green the anchor at 0 rows"

patterns-established:
  - "Fail-loud assert_auth_uid FIRST on every user connection (NULL auth.uid() false-passes isolation at 0 rows)"
  - "Positive control + isolation on the same connection so a 0-for-everyone bug fails loudly instead of false-greening"

requirements-completed: []  # TEN-05/TEN-03/PRAG-01 advanced (exit gate authored + proven-RED) but NOT complete — go GREEN after Plans 03/04

# Metrics
duration: ~35min
completed: 2026-07-20
---

# Phase 164 Plan 01: SECDEF Audit + Cross-Org Isolation Test Suite Summary

**Authored `test_v3_4_org_isolation.py` — the 18-test v3.4 cross-org isolation exit gate — as a Wave-0 red-then-green scaffold against the pre-164 DB: the spoofed-`match_user_id` red-anchor provably leaks user A's real chunk, and 10 secured invariants (every-table matrix on both DB paths, is_system universal, badge-spoof block, the text-to-SQL connection arbitration) hold GREEN.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-20T19:05Z (approx)
- **Completed:** 2026-07-20T19:35Z
- **Tasks:** 3
- **Files modified:** 1 (created)

## Accomplishments

- **The named milestone exit gate exists** — `test_v3_4_org_isolation.py` (707 lines, 18 tests) extends the shipped Phase-163 `two_orgs_two_users` + `_rls_harness` into an exhaustive two-org adversarial matrix: every user-facing table × both DB paths × all four SECDEF functions × X-Org-Id spoof × text-to-SQL/grep `query_user_documents` × PRAG-01 private-vs-shared retrieval.
- **The red-anchor is provably RED (non-vacuous):** as user B, calling `match_document_chunks` with a spoofed `match_user_id = A` returns user A's REAL seeded chunk (`assert 1 == 0` — leak). Migration 110's in-body org gate (keyed on `auth.uid() = B`) turns it GREEN.
- **The pg_proc DEFINER audit is RED for the two currently-unpinned retrieval fns** (`match_document_chunks`, `keyword_search_chunks` have no `search_path`) and GREEN for the two already-pinned (`match_skills`, `folder_is_globally_visible`) — auditing REAL live state.
- **The D-164-04 text-to-SQL arbitration is complete and non-vacuous:** `query_user_documents` (INVOKER) over the user-context returns 0 of A's rows (GREEN), and over a non-user-context leak-conn returns A's rows > 0 (GREEN demonstration) — proving the CONNECTION swap (Plan 04), not the deleted `_inject_user_id` regex, is the gate (RESEARCH Pitfall 4).

## Task Commits

Each task was committed atomically:

1. **Task 1: pg_proc DEFINER audit + non-vacuous chunk fixture + red-anchor** — `abead471` (test)
2. **Task 2: every-table matrix (both DB paths) + four-DEFINER legs + X-Org-Id spoof** — `be0231e1` (test)
3. **Task 3: text-to-SQL/grep leg (D-164-04) + PRAG-01 + platform-universal guards** — `dafec891` (test)

**Plan metadata:** see final `docs(164-01)` commit.

## Files Created/Modified

- `backend/tests/integration/test_v3_4_org_isolation.py` — the v3.4 cross-org isolation exit-gate matrix (18 tests): pg_proc audit, the spoofed-`match_user_id` red-anchor, the information_schema-driven every-table matrix (asyncpg + supabase-py), the four-DEFINER 0-cross-org legs, X-Org-Id spoof rejection, the text-to-SQL/grep `query_user_documents` user-context-vs-leak-conn arbitration, the PRAG-01 private-vs-shared retrieval leg, and the platform-universal / over-widening / badge-spoof guards. Includes the `two_orgs_chunks_and_shared_folder` fixture (private chunk per user + A's is_global folder/doc/chunk).

## Wave-0 RED/GREEN state (the designed outcome)

The suite is intentionally a mix of GREEN (secured invariants) and RED (leak-states that migration 110 + Plan 04 close). A RED suite here is the DESIGNED, CORRECT Wave-0 outcome, not a failure.

**10 GREEN — invariants secured by 163/mig-108/mig-109 or the connection-identity arbitration:**
- `test_definer_secdef_and_search_path_pinned[match_skills]`, `[folder_is_globally_visible]` — already pinned
- `test_table_matrix_asyncpg`, `test_table_matrix_supabase` — B reads 0 of A's rows across ~35 tables, both paths
- `test_definer_zero_cross_org[folder_is_globally_visible]` — A's non-global folder not widened
- `test_org_header_spoof_does_not_widen` — org from `current_user_org_ids()`, header inert
- `test_text_to_sql_query_user_documents_isolation`, `test_text_to_sql_grep_path_isolation` — user-context 0 A-rows + leak-conn >0 A-rows (both legs, non-vacuous)
- `test_is_system_stays_universal` — is_system built-in visible cross-org (mig-109 FIX-A guard)
- `test_badge_spoof_blocked` — self-set `is_system=true` rejected (42501, mig-109 WITH-CHECK)

**8 RED (by design — closed by mig 110 + Plan 04):**
- `test_definer_ignores_spoofed_match_user_id` — THE red-anchor (spoof leaks A's chunk)
- `test_definer_secdef_and_search_path_pinned[match_document_chunks]`, `[keyword_search_chunks]` — un-pinned search_path
- `test_definer_zero_cross_org[match_document_chunks]`, `[keyword_search_chunks]`, `[match_skills]` — spoofed match_user_id leaks A's rows
- `test_prag01_retrieval_isolation` — spoofed match_user_id leaks A's private + shared chunk pre-110
- `test_user_is_global_stays_org_scoped` — match_skills (no org gate yet) leaks A's is_global skill cross-org

Verification commands (reproducible):
- `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_v3_4_org_isolation.py --collect-only -q` → 18 tests, exit 0.
- `venv/Scripts/python.exe -m pytest tests/integration/test_v3_4_org_isolation.py::test_definer_ignores_spoofed_match_user_id -x` → FAILS: `cross-org leak: DEFINER trusted the spoofed match_user_id — user B retrieved user A's chunk(s) [...]` (RED proof).

## Decisions Made

- **Requirements TEN-05/TEN-03/PRAG-01 left un-marked (not complete).** This Wave-0 plan authors the exit gate and proves the anchors RED; the requirements are only satisfied when the suite goes GREEN after Plan 03 (migration 110) + Plan 04 (producer client-swap). Marking them complete now would misrepresent milestone state. `requirements.mark-complete` deliberately skipped.
- **DEFINER coverage is asyncpg-only; supabase-py path covered by the table matrix.** `SupabaseTxnAdapter.rpc()` (in `_reembed_adapter.py`) is a record-only stub — it does NOT execute the RPC (deliberately, so the re-embed resize call can't wipe live vectors). A supabase-path DEFINER assertion would be vacuous, so the supabase-py DB path is proven by `test_table_matrix_supabase` and DEFINER functions are exercised over `open_user_conn`. Documented in the `test_definer_zero_cross_org` docstring.
- **PRAG-01 leg asserts org-AND-folder-ACL isolation for the current disjoint-org topology.** In the shipped topology (disjoint personal orgs), the folder-ACL branch lives INSIDE the org gate, so a disjoint-org reader gets 0 even for A's is_global-folder chunk — matching the 163 `test_user_global_folder_and_its_document_stay_org_scoped` invariant and the milestone's rejection of cross-tenant broadcast. The POSITIVE folder-ACL proof (a co-member DOES see shared content) is a Phase 166/167 forward gate; the leg uses a spoofed match_user_id to retain the RED-then-green property.
- **Unit-vector seed, not zero-vector.** A zero-vector cosine distance is NaN and `1 - NaN > threshold` is false, which would false-green the red-anchor at 0 rows; the seed and query vectors are identical unit vectors (distance 0, similarity 1).

## Deviations from Plan

The plan was executed as written; two authoring realities required documented, in-scope adjustments (no scope change):

**1. [Rule 3 - Blocking-resolved] DEFINER supabase-path variant → asyncpg + table-matrix coverage**
- **Found during:** Task 2 (four-DEFINER legs)
- **Issue:** The plan's action text says "Add the supabase-path variant where the function is reachable via `.rpc(...)` through the adapter." But `SupabaseTxnAdapter.rpc()` is a record-only stub that never executes the RPC (by design, per `_reembed_adapter.py`) — a supabase-path DEFINER test would be vacuous, and modifying the shared adapter was out of bounds ("do NOT rebuild them").
- **Fix:** DEFINER functions are exercised over the asyncpg user-context; the supabase-py DB path is proven by `test_table_matrix_supabase`. Documented inline in the `test_definer_zero_cross_org` docstring.
- **Files modified:** `backend/tests/integration/test_v3_4_org_isolation.py`
- **Verification:** Both table-matrix paths PASS; the plan's hard acceptance (collect-only + both table-matrix paths + 4-fn parametrization) is satisfied.
- **Committed in:** `be0231e1` (Task 2 commit)

**2. [Rule 1 - Correctness] PRAG-01 shared-chunk assertion matches the actual org topology**
- **Found during:** Task 3 (PRAG-01 leg)
- **Issue:** The plan's prose implies a disjoint-org B "receives A's SHARED-folder chunk", but user `is_global` folders are org-scoped in the shipped topology (163 decision, kept until 166/167) — a disjoint-org reader must get 0, and asserting otherwise would encode the cross-tenant broadcast the milestone rejected.
- **Fix:** The leg asserts B receives NEITHER A's private NOR A's shared-folder chunk cross-org (org-AND-folder-ACL scoping), retains RED-then-green via a spoofed match_user_id, and documents the co-member positive proof as a 166/167 forward gate.
- **Files modified:** `backend/tests/integration/test_v3_4_org_isolation.py`
- **Verification:** Leg is RED pre-110 (spoof leaks), will go GREEN post-110; positive control (B sees its own chunk) passes.
- **Committed in:** `dafec891` (Task 3 commit)

---

**Total deviations:** 2 (1 blocking-resolved, 1 correctness) — both keep the suite honest and within the plan's hard acceptance criteria. No scope creep.

## Issues Encountered

- **2 pre-existing 163 failures are NOT a regression.** `pytest tests/integration -k "163" -q` reports `2 failed, 101 passed`: `test_163_rls_dm.py::test_global_rule_renders_for_comember_not_cross_org` and `test_163_rls_workflow_eval.py::test_global_workflow_def_renders_for_comember_not_cross_org`. These are co-member rendering tests, RED in the current disjoint-org topology (co-member scenarios land at 166/167). Confirmed pre-existing: my 3 commits touched ONLY `test_v3_4_org_isolation.py` (707 insertions, `git diff --stat abead471^..HEAD`); the `-k "163"` run deselects my file entirely (no "163" in its test names), so those failures execute with my code absent; both files were last modified in `8665b287` (test(163-03)), not by this plan.

## User Setup Required

None — no external service configuration; the suite runs against local Postgres :54322 via `@requires_pg` (skip-guarded).

## Next Phase Readiness

- **Plan 164-02/03 (migration 110):** the exit gate is the arbiter. Migration 110 must (a) add the in-body org predicate (`org_id = ANY(current_user_org_ids())` + within-org owner/folder-visibility branch) to `match_document_chunks` / `keyword_search_chunks`, (b) pin `search_path` on all four DEFINER fns, (c) keep `is_system` OUTSIDE the org gate for `match_skills` (mig-109 FIX-A), (d) widen `document_chunks` SELECT RLS for PRAG-01. Turning the 8 RED tests GREEN (without regressing the 10 GREEN) is the acceptance signal.
- **Plan 164-04 (producer client-swap):** its `-k "text_to_sql" -x` verify runs both text-to-SQL legs; the leak-conn demonstration is the guard that deleting `_inject_user_id` / `_inject_user_id_for_grep` is only safe once the tool DB path runs on the asyncpg user-context.
- **Blocker/concern:** none. The suite collects clean, the red-anchor is proven RED, and the crux suite is un-regressed by this plan.

## Self-Check: PASSED

- `backend/tests/integration/test_v3_4_org_isolation.py` — FOUND (707 lines).
- Commit `abead471` — FOUND (Task 1).
- Commit `be0231e1` — FOUND (Task 2).
- Commit `dafec891` — FOUND (Task 3).

---
*Phase: 164-secdef-audit-cross-org-isolation-test-suite*
*Completed: 2026-07-20*
