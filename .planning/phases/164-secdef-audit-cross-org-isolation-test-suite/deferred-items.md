# Phase 164 — Deferred / Out-of-Scope Discoveries

Items discovered during execution that are OUT OF SCOPE for the plan they were found in
(per the executor scope-boundary rule: log, do not fix). Not caused by the current task's changes.

## Discovered during Plan 164-02 (SEED-091 owner-nulling)

### D-164-02-A — Two pre-existing 163 RLS suite failures (live-DB state, disjoint from 164-02)

- **Discovered during:** Plan 164-02 verification (`pytest tests/integration -k "163" -q` → 2 failed / 101 passed).
- **Failing tests:**
  - `tests/integration/test_163_rls_dm.py::test_global_rule_renders_for_comember_not_cross_org`
  - `tests/integration/test_163_rls_workflow_eval.py::test_global_workflow_def_renders_for_comember_not_cross_org`
- **Symptom:** a global `classification_rules` (resp. `workflow_definitions`) row seeded in org A is visible to a cross-org user B over the asyncpg user-context — `assert crossorg_sees == 0` fails with `1 == 0`. The tests assert membership must gate the `is_global` branch on those tables post-163.
- **Why out of scope for 164-02:** Plan 164-02 touches ONLY the Python serialize paths (folders / skills / views list endpoints) + three Pydantic model loosens. It changes NO DB object, NO RLS policy, NO migration, and none of the `classification_rules` / `workflow_definitions` tables. The failing assertions are raw `SELECT count(*)` over asyncpg with zero execution path through the 164-02 diff (verified: `git show --name-only 07840986` = 7 serialize/model files only). The failures reproduce independent of this plan (live local-DB RLS state).
- **Likely root cause / owner:** the live local DB's RLS on `classification_rules` / `workflow_definitions` still allows cross-org visibility of `is_global` rows for co-members — an RLS/membership-gate concern (migration territory: the 108/109 membership rewrite coverage or the 164 migration-110 / later 166-167 org-membership work), NOT a serialize concern. Route to whoever owns the RLS gate on those two tables.
- **Action taken:** none (logged, not fixed — scope boundary). Does not block 164-02: the SEED-091 unit gate (`tests/test_seed091_owner_nulling.py`) is DB-independent and passes 6/6.
