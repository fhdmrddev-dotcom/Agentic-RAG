---
phase: 304-personal-mcp-keys-that-act-as-you
plan: 01
subsystem: database / security (RLS narrowing)
tags: [migrations, rls, org-narrowing, security]
requires: []
provides:
  - "migration 220: api_keys kind/folder_ids/tools/include_external + 5 CHECKs, widened column grant, 'mcp' origin literal, app_settings.mcp_enabled + organizations.mcp_enabled"
  - "migration 221: GUC-narrowed current_user_org_ids(), routed current_user_has_permission + 6 policies, organizations destructive-privilege revokes"
  - "app.security.acting_org.current_acting_org (leaf ContextVar)"
  - "app.security.acting_member: acting_org_scope, acting_as, acting_member_connection"
  - "app.services.acting_member_reads.list_acting_folders(conn)"
affects: [304-03, 304-04, 305, 306]
tech-stack:
  added: []
  patterns:
    - "transaction-local GUC (set_config(..., true)) set from a server-only ContextVar to narrow RLS"
    - "counterfactual live test: restore the pre-migration objects in a rolled-back txn and show the arm fails"
key-files:
  created:
    - supabase/migrations/220_api_keys_kind_and_mcp_switches.sql
    - supabase/migrations/221_acting_org_narrowing.sql
    - scripts/check-migration-220-live.py
    - scripts/check-migration-221-live.py
    - scripts/explain-acting-org.py
    - backend/app/security/acting_org.py
    - backend/app/security/acting_member.py
    - backend/app/services/acting_member_reads.py
    - backend/tests/unit/test_304_migrations_static.py
    - backend/tests/unit/test_304_acting_reads_fence.py
    - backend/tests/integration/test_304_acting_org_rls_live.py
    - .planning/phases/304-personal-mcp-keys-that-act-as-you/evidence/explain-acting-org.txt
    - .planning/phases/304-personal-mcp-keys-that-act-as-you/deferred-items.md
  modified:
    - backend/app/dependencies.py
    - scripts/full-schema-supplement.sql
    - supabase/full-schema.sql
decisions:
  - "list_acting_folders keeps the (conn) contract 304-03/304-04 name; the caller for owner masking comes from auth.uid() in the same statement, never an argument"
  - "Supplement keeps mig 215's api_keys block as history and appends a 220 block after it (the bootstrap ends on the superset) instead of replacing the 215 line, so test_293_migration_215 stays green"
  - "EXPLAIN gate asserts loops <= 1 (a node reporting 'never executed' is 0 evaluations), i.e. at most once per statement, never per row"
metrics:
  duration: "~2h 10m"
  completed: 2026-10-31
  tasks: 3
  files: 16
---

# Phase 304 Plan 01: Acting-org narrowing (migrations 220/221, acting connection) Summary

A personal MCP key can now act as its owner in exactly one org. Migration 221 makes `current_user_org_ids()` intersect membership with a transaction-local `app.acting_org_id` GUC. The function is redeclared with byte-identical attributes, so with the GUC unset every plan matches today's. The GUC only narrows: a non-member org yields nothing. The membership readers that bypassed the function (`current_user_has_permission` plus six policies) now route through it. On the Python side there is a leaf ContextVar, a single 4-line `dependencies.py` hunk that binds the GUC, an acting-member connection, and the first narrowed read.

**Base:** worktree started on `4bc4a872f` (master). It was reset to the plan base `fc98a7d23b2bdc77ea4c71294bbb29de2871c4a3` before any work.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Migrations 220 + 221, applied to the local DB, live checks, regenerated schema, supplement mirror | RED `22625c363` · GREEN `8f38654d9` |
| 2 | Acting-org ContextVar, the `dependencies.py` edit, `acting_member.py`, `list_acting_folders` | RED `a19add3ed` · GREEN `46609f81e` |
| 3 | Live RLS suite, committed EXPLAIN gate + evidence, backend baseline | `5e31f4dc4` (suite) · `3291478cb` (EXPLAIN + evidence) |

## Verification (all run in this worktree)

- `test_304_migrations_static.py` + `test_293_migration_215.py`: **44 passed**. The static test was committed failing (20 failed) before the SQL existed.
- `check-migration-220-live.py` printed `220 live`, exit 0. `check-migration-221-live.py` printed `221 live`, exit 0. Both migrations were applied twice to confirm they are idempotent.
- `check-schema-acl-parity.cjs`: `mirrored: 416/416`, **OK**. `check-greenfield-privileges.py`: **OK** (152 table/column ACL statements replayed on a DB bootstrapped from `full-schema.sql`).
- `full-schema.sql` was regenerated with no reset. It contains `app.acting_org_id` ×2 and `api_keys_mcp_expiry_check` ×1, and its diff holds 220/221 content only.
- `test_304_acting_reads_fence.py` + `test_293_key_auth.py`: **40 passed**. The fence test was committed failing (13 failed, 1 passed) first. The one pass was the "unset issues today's three statements" regression guard, which is true before and after.
- Every unit file that imports `app.dependencies` (114 files): 1908 passed, 7 failed. Five of the failures fail identically against the base `dependencies.py`. The other two are the known `test_cross_worker_cancellation` flake, which passes in isolation with the edit.
- `dependencies.py`: numstat `10 0` (6 docblock lines, 1 import, 3 code lines). `set_config('app.acting_org_id', $1, true)` appears ×1. `acting_org.py` has 0 `app.` imports.
- `test_304_acting_org_rls_live.py -rs`: **13 passed, 0 skipped**.
- `scripts/explain-acting-org.py`: exit 0, **GATE PASSED**. `InitPlan` appears 0 times in the script.

### EXPLAIN verdict (verbatim, `evidence/explain-acting-org.txt`)

```
VERDICT: A == B for all 12 statements: True; every current_user_org_ids() node loops=1 (or never executed), never per row: True; function unchanged: True
GATE PASSED
```
The org sets were A/B = both orgs, C = {member org}, D = {other org}, E = {}. The subject was resolved by query: `046ac4e2…`, role `member` in `9042e46f…`, also in `0074ea41…`.

### Backend baseline (D-15 gate 2 / D-43), verbatim

```
Summary:        70 failed, 10778 passed, 1 skipped, 2 xfailed, 2 xpassed, 58 warnings in 563.01s (0:09:23)
[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).
```
70 failures, the same count research measured before the change. That includes the two `test_cross_worker_cancellation` failures, the order-dependent flake recorded in 231/232-MEASUREMENTS (BUS-117). Both pass in isolation with this plan's edit. **No failure is this plan's.**

## How each RLS arm was driven RED

The suite runs against the schema that is already applied, so the narrowing arms needed proof that they can fail. Two counterfactual tests ship with the suite as permanent tests:

1. `test_counterfactual_every_routed_arm_fails_under_the_old_schema` restores the **pre-221** `current_user_org_ids()`, `current_user_has_permission` and the expert policies inside one rolled-back transaction, then sets the acting GUC to X. The function returns {X, Y}. All 10 tables show Y's seeded rows. `current_user_has_permission(Y, 'org:manage')` is still true. So every "acting X hides Y" assertion would fail there. The test then confirms the live `pg_get_functiondef` is unchanged.
2. `test_counterfactual_routing_only_the_function_still_leaks_experts` keeps the **new** function but restores the **old** six-policy reads. The function narrows to {X}, but `expert_bundles` and `expert_grants` still show Y. This is the R-05b finding, driven live, and it proves the policy route-through is what closes those two tables.

The arms that are non-vacuous by construction: unset shows both orgs (asserted before any narrowing), U is `member`/`org-admin` and never the owner, and the shared folders belong to co-members V and W.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] `regenerate-full-schema.sh` could not find the stack from a worktree**
- `supabase status` derives the project id from the directory name (`agent-…`), and there is no `supabase/config.toml`, so the script exited with "Supabase is not running locally".
- Fix: ran it with `SUPABASE_WORKDIR="C:/Vibe Apps/Agentic RAG"` so the CLI resolves `supabase_db_Agentic_RAG`. The output was still written into the worktree. No script change.

**2. [Rule 1 - Bug] `check-migration-221-live.py` compared `provolatile` to `"s"`**
- asyncpg returns `"char"` as bytes (`b's'`), so the check read FAIL on a correct function. It now accepts both. Fixed before commit.

**3. [Rule 1 - Bug] EXPLAIN gate counted `(never executed)` nodes as a loops failure**
- In variants with no qualifying rows (for example E), some SubPlans never run. That is 0 evaluations, which still satisfies "at most once per statement". The assertion is now `loops <= 1`, and the evidence reports how many nodes executed.

**4. [Plan wording] Supplement: appended a 220 block instead of replacing the 215 line**
- Replacing it would break `test_293_migration_215::test_supplement_mirrors_the_table_narrowing`, which the plan's own verify runs. The 220 block runs after 215's, so the bootstrap ends on the superset. ACL parity and greenfield are both green.

**5. [Plan wording] `list_acting_folders` SQL selects `auth.uid() AS caller_id`**
- Owner masking needs the caller, and 304-03/304-04 call `list_acting_folders(conn)` with no user argument. The caller is read from the connection's own claims in the same single statement, so no argument can name a different user.

**6. [Safety] The anon role-level EXECUTE call was replaced by a catalog check.** See Findings F-1.

## Findings (logged in `deferred-items.md`, not fixed here)

- **F-1 (high, needs the operator):** on the local stack, `SET LOCAL ROLE anon; SELECT public.current_user_org_ids()` **crashed a Postgres backend and put the cluster into recovery**. It did not return "permission denied". This happened in the first suite run and once more in an isolated probe. The cluster recovered on its own with data intact. Fixtures left by the crashed run were removed by exact id. I did not establish whether this predates 221, because every attempt restarts the shared cluster. If it reproduces through PostgREST (`/rpc/current_user_org_ids` with the anon key), it is an unauthenticated DoS. Recommended: reproduce on a disposable Postgres with the server log. The anon EXECUTE arm is now pinned by `has_function_privilege` in the suite and in the 221 live check.
- **F-2 (low):** `model_rates_insert_policy`'s role arm tests `role IN ('admin','owner')`, but `org_members_role_check` allows neither. Only `service_role` can insert org rates, which fails closed. 221 kept the arm byte-identical, as D-39 requires.

## Owed (not this plan's to do)

- **Cloud paste of 220/221 is owed with Phase 305.** The operator does it under per-action approval, then runs `get_advisors(security)` (D-30, D-33). 221 must be live before the 304 backend boots there, and 220 before the key routes write `kind`.
- Hot-file ledger triples and sections for the three new modules are filled by 304-06 Task 2. `check-hot-file-ledger.cjs` reports OK for this phase.

## Known Stubs

None. `acting_member_reads.py` ships one read by design; 304-03 adds the rest.

## Threat Flags

None beyond the plan's threat model. T-304-01..10 are each mitigated and pinned by a live or static arm. F-1 is a pre-existing surface (the function was already in `public` and already anon-revoked), recorded above.

## Self-Check: PASSED

- All 13 created files and 3 modified files exist (checked with `git show --stat` per commit).
- Commits `22625c363`, `8f38654d9`, `a19add3ed`, `46609f81e`, `5e31f4dc4` and `3291478cb` are present in `git log`.
- STATE.md and ROADMAP.md are untouched. The local-DB lock was released after the baseline.
