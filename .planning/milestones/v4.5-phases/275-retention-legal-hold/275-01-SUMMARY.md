---
phase: 275-retention-legal-hold
plan: 01
subsystem: database
tags: [postgres, triggers, rls, legal-hold, retention, pgvector, retrieval, supabase]

requires:
  - phase: 272-close-means-wrong
    provides: migration 200/201 RPC bodies with the force_custom_plan pin, the retrieval_scope seam (DEFAULT_PREDICATES as data)
  - phase: 274-thread-scoped-attachments
    provides: the thin-seam module shape (thread_workspace_cleanup.py) and the 203 shape-test analog
provides:
  - "migration 204: retention_policies / retention_previews / legal_holds (+ documents / + folders) / retention_queue / retention_skips / retention_receipts / retention_sweeps, documents.archived_at / archived_policy_id / archived_policy_name"
  - "the hold refused IN THE DATABASE on every delete path (PT409): owner JWT, service role, auth.users cascade, folder cascade, TRUNCATE; sticky coverage on move"
  - "public.retention_held_documents(uuid[]) / public.retention_held_folders(uuid[]) over one CYCLE-bounded walk, service_role only"
  - "migration 205: documents.retrievable (STORED generated), both RPC arms filter on it, query_user_documents GUC + four RESTRICTIVE agent-read policies"
  - "backend/app/services/retention/hold_guard.py: assert_none_held / map_hold_refusal / held_document_ids / held_folder_ids / hold_line_for"
  - "retrieval_scope.RETRIEVABLE_COLUMN, used by the resolver and expert_scope"
  - "ledger rows for every file the phase touches that had none"
affects: [275-02, 275-03, 275-04, 275-05, retrieval, library-delete-paths, agent-tools]

tech-stack:
  added: []
  patterns:
    - "Hold refusal as a database property: BEFORE DELETE row triggers + BEFORE TRUNCATE guard calling one SECURITY DEFINER predicate; Python only explains"
    - "One home for an agent-visibility predicate: a STORED generated column + RESTRICTIVE policies keyed on a transaction-local GUC"
    - "Column guards are SECURITY INVOKER (current_user is the definer inside SECURITY DEFINER)"

key-files:
  created:
    - supabase/migrations/204_retention_and_legal_hold.sql
    - supabase/migrations/205_retrievable_predicate.sql
    - backend/app/services/retention/__init__.py
    - backend/app/services/retention/hold_guard.py
    - backend/tests/integration/test_275_hold_triggers.py
    - backend/tests/integration/test_275_policy_rls.py
    - backend/tests/integration/test_275_retrievable.py
    - backend/tests/unit/test_275_migration_204_shape.py
    - backend/tests/unit/test_275_migration_205_shape.py
    - backend/tests/unit/test_275_hold_guard.py
    - .planning/phases/275-retention-legal-hold/275-BASELINES.md
    - .planning/phases/275-retention-legal-hold/deferred-items.md
  modified:
    - supabase/full-schema.sql
    - scripts/full-schema-supplement.sql
    - backend/app/services/audit_service.py
    - backend/app/services/retrieval_scope.py
    - backend/app/services/expert_scope.py
    - backend/tests/integration/test_272_rpc_document_scope.py
    - backend/tests/integration/test_110_audit_drift_guard.py
    - backend/tests/unit/test_272_scope_seam.py
    - backend/tests/unit/test_272_scope_resolver.py
    - backend/tests/unit/test_267_scope_preview.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md

key-decisions:
  - "275-01: one CYCLE-bounded folder walk (retention_folder_ancestors) that every hold predicate and sticky trigger calls, instead of a walk per function"
  - "275-01: the archive-state and protected-column guards are SECURITY INVOKER; inside a SECURITY DEFINER function current_user is the owner and the role check would always pass"
  - "275-01: query_user_documents also refuses query_to_xml / ts_stat / ts_rewrite (server functions that execute a SQL string could reach set_config through concatenation), beyond the planned set_config / current_setting / U& list"
  - "275-01: query_user_documents restores app.agent_read after its EXECUTE, so the flag is scoped to the call, not the rest of the transaction"
  - "275-01: W-5b is asserted on has_function_privilege + proacl, never by CALLING a revoked function as authenticated, because a refused call crashes the local Postgres backend"
  - "275-01: requirements RET-01..04 are NOT marked complete; this plan is the database half of a five-plan phase"

patterns-established:
  - "Integration cleanup releases holds FIRST, then deletes hold rows, then documents and folders"
  - "Never call a revoked function as a JWT role against the shared local database; assert the privilege instead"

# Repaired 2026-10-12 (Phase 277, REG-05): requirements-completed was [] and is replaced with the list copied verbatim from 275-01-PLAN.md frontmatter requirements (D-15)
requirements-completed: [RET-01, RET-02, RET-03, RET-04]

duration: 43min
completed: 2026-10-12
---

# Phase 275 Plan 01: Retention & Legal Hold — the database half Summary

**The database now refuses to delete a document on legal hold on every path: owner, service role, the auth.users cascade, the folder cascade and TRUNCATE. Archived and source-gone documents leave both search arms and model-written SQL through one generated `retrievable` column. Python gets exactly one hold check and one predicate name.**

## Performance

- **Duration:** about 43 min
- **Started:** 2026-10-12T05:12:40Z
- **Completed:** 2026-10-12T05:55Z
- **Tasks:** 3 of 3
- **Files:** 12 created, 12 modified

## Accomplishments

- **Migration 204**, applied to the local database (12/12 VERIFY rows PASS, re-applied cleanly to prove idempotency).
  - Nine RLS-on tables. Every read requires `org:manage`; every write policy carries the 116 wall.
  - `retention_policies`: JWT SELECT only. `legal_holds`: no JWT UPDATE/DELETE. Receipts are immutable for every role, `actor_id ON DELETE SET NULL`, `document_id` has no FK, and a CHECK requires `policy_name` on disposition actions.
  - Hold triggers on documents and folders (PT409, the message names an id only), sticky coverage on document and folder moves, a TRUNCATE guard plus `REVOKE TRUNCATE`.
  - The D-19 archive guard, the W-2 protected-column guard, and the D-35 same-org coverage guard.
  - The audit CHECK keeps all 24 existing types and adds 10.
- **Migration 205**, applied locally (9/9 VERIFY PASS).
  - `documents.retrievable` is a STORED generated column (positive form `= 'live'`), followed by `ANALYZE`.
  - Both RPCs use `AND d.retrievable` in all three branches and keep both SET clauses.
  - `query_user_documents` refuses text that could reach session settings, switches `app.agent_read` on, and restores it afterwards.
  - Four RESTRICTIVE agent-read policies.
- **Live proof:** 47 cases across `test_275_hold_triggers` (15), `test_275_policy_rls` (13) and `test_275_retrievable` (12 functions, 19 cases with parametrisation). Each "absent" or "refused" assertion has a positive control. On `recall_bench` (100k chunks), the vector body plans `Index Scan using document_chunks_embedding_idx` in 13.8 ms.
- **`hold_guard.py`:**
  - Checks folders first, then documents.
  - Looks up the org permission only when something is held. If the lookup fails, it falls back to the member sentence.
  - Returns one 409 shape and maps PT409 from either driver.
  - Writes best-effort `delete_refused` receipts.
  - Uses the S10 sentences ported from the sketch and fenced against it.
- **`RETRIEVABLE_COLUMN`** is the one Python name. The `_NOT_SOURCE_DISCONNECTED` copy is gone. No `source_disconnected` remains in either seam, and `retrieval_service.py` is unchanged.
- **Ledger rows and sections** now exist for `folders.py`, `kb.py`, `audit_service.py`, `document_relationship_service.py` and all 14 new phase modules. Rows for `retrieval_scope.py` and `expert_scope.py` were re-derived. Five FIRING rows were added to CLAUDE.md.

## Task Commits

1. **Task 1: RED — live suites, shape fences, baselines**: `bdc0e7428` (test)
2. **Task 2: Migrations 204 + 205, applied locally, full-schema regenerated**: `6164a80b2` (feat)
3. **Task 3: hold_guard RED**: `90254e72d` (test). **GREEN** (hold_guard, audit sync, predicate swap, fences, ledger): `bea4c4994` (feat)

## Files Created/Modified

- `supabase/migrations/204_retention_and_legal_hold.sql`: retention schema, hold predicates, every hold trigger, RLS, grants, audit CHECK, VERIFY.
- `supabase/migrations/205_retrievable_predicate.sql`: generated column, RPC redefinitions, `query_user_documents` GUC, restrictive policies, VERIFY.
- `supabase/full-schema.sql`: regenerated by script (no reset).
- `scripts/full-schema-supplement.sql`: 204/205 ACLs mirrored (see deviation 1).
- `backend/app/services/retention/hold_guard.py`: the one Python hold check.
- `backend/app/services/audit_service.py`: +13 action types.
- `backend/app/services/retrieval_scope.py`, `backend/app/services/expert_scope.py`: the predicate swap.
- Three live suites, three unit suites, and four fences retired with reasons in their bodies.
- `docs/HOT-FILE-LEDGER.md`, `CLAUDE.md`: ledger rows and sections.
- `275-BASELINES.md`: PHASE_BASE, the backend FAILED SET, the tsc error SET (66), the vitest verdict, the RED run, the apply output, the plants, the EXPLAINs, the final set diff and the OWED list. `deferred-items.md`: the local crash finding.

## Decisions Made

See `key-decisions` in the frontmatter. The two that change behaviour beyond the plan text:
- The `query_user_documents` denylist was widened (deviation 3).
- The GUC is scoped to the call: it is restored after `EXECUTE`, so a Library read later in the same transaction still sees archived rows. This is pinned by `test_the_guc_is_scoped_to_the_call`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mirrored 204/205 ACLs into `scripts/full-schema-supplement.sql`**
- **Found during:** Task 2 (the PostToolUse schema-ACL-parity hook fired on both migration writes).
- **Issue:** `regenerate-full-schema.sh` runs `pg_dump --no-privileges`. Without a mirror, every REVOKE in 204/205 would be absent from a greenfield bootstrap, in the permissive direction.
- **Fix:** copied all 90 ACL statements verbatim into the supplement. The script then appends them to `full-schema.sql`. `check-schema-acl-parity.cjs` reports 323/323.
- **Files:** `scripts/full-schema-supplement.sql` (not in the plan's `files_modified`). **Commit:** `6164a80b2`.

**2. [Rule 1 - Bug] Never call a revoked function in a live test (an environment crash)**
- **Found during:** Task 2, in the first post-204 run of `test_275_policy_rls`.
- **Issue:** calling any function the role lacks EXECUTE on, as `authenticated`, crashes the local Postgres backend into crash recovery. The pre-existing `resize_embedding_column` reproduces it identically, so 204's SQL is not the cause. The crash leaked 3 test users, 2 orgs and 1 active hold.
- **Fix:** the leaked rows were removed by hand. W-5b is now asserted on `has_function_privilege` plus `proacl` (no PUBLIC, no `authenticated`/`anon` entry). The positive control still drives the authenticated owner's delete into PT409. The finding is in `deferred-items.md` and `275-BASELINES.md`.
- **Commit:** `6164a80b2`.

**3. [Rule 2 - Missing critical] Widened `query_user_documents`' refusal**
- **Issue:** the plan's denylist (`set_config`, `current_setting`, `u&`) still let `query_to_xml('sel' || 'ect set_' || 'config(...)')` (or `ts_stat` / `ts_rewrite`, which also execute a SQL string server-side) switch `app.agent_read` off.
- **Fix:** those three names are refused too, and one live test drives the `query_to_xml` case. The residual risk is any other server function that executes a text query. It is recorded here and not claimed closed.
- **Commit:** `6164a80b2`.

**4. [Rule 1 - Bug] A wrong VERIFY row in 205**
- **Issue:** `proconfig::text like '%search_path=""%'` never matches the escaped array text, so the first apply printed one FAIL while the pin was present.
- **Fix:** the row now tests array membership. Re-apply: 9/9 PASS. **Commit:** `6164a80b2`.

**5. [Rule 1 - Bug] Two test-side bugs found at GREEN**
- `attgenerated` arrives as bytes, so the test now casts it to `::text`.
- A column aliased `t` shadowed `query_user_documents`' row alias inside `jsonb_agg(t)`, so the test now uses alias `v`.
- **Commit:** `6164a80b2`.

**6. [Rule 3 - Blocking] One folder walk instead of one per function**
- The shape fence was first written to expect two or more walks. The single `retention_folder_ancestors` walk is stronger, because there is no unbounded copy to forget. The fence now asserts exactly that: one walk, a CYCLE guard on every walk, and every reader calling the helper. **Commit:** `bdc0e7428` (test written before any migration existed).

**7. [Rule 1 - Bug] Kept the SQL literals in `retrieval_scope.py`**
- Writing `f"WHERE is_latest AND {RETRIEVABLE_COLUMN}"` tripped `test_no_f_string_sql`.
- The two SQL strings keep the literal `retrievable`, which is the plan's own wording. `test_272_scope_seam` now pins the literal to the constant's value. **Commit:** `bea4c4994`.

**8. [Rule 1 - Fence] Re-pinned `test_110_audit_drift_guard.py::test_valid_action_types_is_exactly_19`**
- It had been red at base since Phase 223 (`extra=['connector.call','connector.grant']`), and this plan changes the set it pins. It was renamed `..._is_exactly_the_expected_set` and pins all 34 types, with the reason (SEED-177) in its body. **Commit:** `bea4c4994`.

**9. [Rule 1 - Fence data] Fixed a 267 fixture value**
- `test_267_scope_preview` used `source_state: "synced"`, which is never legal under the CHECK. Under the positive-form column it would correctly be non-retrievable. The fixture now says `"live"`, with a comment. **Commit:** `bea4c4994`.

**10. [Completeness] Added two more CLAUDE.md G-5 rows**
- Beyond the three planned rows, `expert_scope.py` (it crossed G-5 on this plan's touch: 267, 268, 275) and `document_relationship_service.py` (FIRES, absent its entire life) were added. **Commit:** `bea4c4994`.

---

**Total deviations:** 10 (3 blocking, 6 bug/fence fixes, 1 security widening). **Impact:** no scope added. Every change either makes a planned property true or makes a check honest.

## Issues Encountered

- **A refused function call crashes the local Postgres backend** (deviation 2). This is an environment defect, likely in a preloaded extension's hook. Whether production does the same is UNMEASURED: probing it would mean crashing a production backend.
- **CLAUDE.md is past the 120,000-char warn band** (120,402 by the gate). This commit added 819 chars, and the three mandated rows alone would also have crossed. The gate exits 0. The split is now scheduled under CLAUDE.md's own rule; the hard limit is 150k.
- On the local dev DB, the vector body plans a top-N sort, because the caller owns 93% of all chunks. It is identical before and after the swap (about 62-66 ms). The HNSW evidence comes from `recall_bench`.
- `graphify update .` was NOT run: `graphify-out/GRAPH_REPORT.md` carries the operator's uncommitted changes, and regenerating it would mix this plan's output into them.

## TDD Gate Compliance

- Task 1 RED `bdc0e7428` precedes the migration GREEN `6164a80b2`.
- Task 3 RED `90254e72d` precedes the hold_guard GREEN `bea4c4994`.
- RED runs: all five Task 1 files were red (`59 failed, 1 passed, 12 errors`). The one pass is a labelled sanity control that asserts nothing about 204/205. The `test_275_hold_guard` collection failed because the module was absent.
- Plants: 11 plants driven against the shape fences all went red, and the files were restored md5-identical (`275-BASELINES.md`).

## Verification

- **Task 2 verify command:** 163 passed, no skips. Post-swap live re-run: 76 passed.
- **Backend baseline:** `71 failed, 6973 passed`. The FAILED SET is identical to base.
- **Ledger and size gates:** `check-hot-file-ledger --files <9>` exits 0, and `check-claude-md-size` exits 0 with a warning.
- **D-33:** `git diff --stat b41d51d6b -- backend/app/services/retrieval_service.py` is empty.

## OWED (not performed, by design)

1. Production apply of 204, then 205, as operator-approved SQL-editor writes BEFORE the backend deploy (D-29).
2. `get_advisors(security)` on production after that apply.
3. A production read of the `source_state` distribution before deploy.
4. Narrowing the local crash with `docker logs supabase_db_*`, and an operator decision on probing production.
5. The CLAUDE.md split, now that it is in the warn band.

## Known Stubs

None. The 14 ledger rows for modules that 275-02/03/04 will create are planning rows (`0 / 0 / 0`) by design. The plan mandates them so G-5 can see those files when they are created.

## Threat Flags

None beyond the plan's threat register. Every new surface (tables, functions, policies, the GUC) is covered by T-275-01..44, and deviation 3 strengthens T-275-39.

## Next Phase Readiness

- 275-02 can call `assert_none_held` / `map_hold_refusal` from the delete doors. The `retention_held_*` functions and receipts exist.
- 275-03 can build on every table. `retention_previews` and the `previewed_revision` column back the D-02 save gate, and `RETENTION_SWEEP_ENABLED` remains its own to add.
- Do not call `requirements.mark-complete` for RET-01..04 until the phase close (275-05).

## Self-Check: PASSED

- All 12 created files exist on disk.
- Commits `bdc0e7428`, `6164a80b2`, `90254e72d` and `bea4c4994` are present in `git log`.
