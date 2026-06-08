---
phase: 090-harness-schema-rls-config-models
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - backend/app/models/harness.py
  - backend/tests/unit/test_harness_models.py
  - supabase/migrations/056_workflow_definitions.sql
  - supabase/migrations/057_workflow_runs.sql
  - supabase/migrations/058_workflow_phases.sql
  - supabase/migrations/059_harness_audit_and_threads_col.sql
  - supabase/verify_090.sql
  - supabase/verify_090_run.sql
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 090: Code Review Report

**Reviewed:** 2026-05-31T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 090 is a clean, well-documented Postgres substrate plus the first
strict-parse Pydantic layer in the codebase. The schema mirrors established
ownership/RLS precedents (017_skills, 030_missing_tables audit_log,
054_workspace_files, 055_todos) faithfully, and the design intent is captured
inline at every non-obvious decision point. The immutable-on-publish trigger is
correct (keys on `OLD.status`, distinct SQLSTATE 23514, fires before
`set_updated_at` by alphabetical trigger ordering), the INSERT-only audit policy
set is correct (absence of UPDATE/DELETE policies = RLS denial), the `is_global =
false` INSERT guard correctly closes T-090-06, the DELETE RESTRICT FK is in
place, and the Pydantic discriminated union with `extra='forbid'` is structured
correctly and covered by tests. The live `verify_090_run.sql` self-reporting grid
is excellent — it is self-contained, transactional, and asserts on SQLSTATEs
rather than prose.

No Critical issues. The Warnings are mostly authorization-completeness gaps that
the phase inherits from its precedents (missing `WITH CHECK` on UPDATE policies)
plus two test-coverage gaps where a verify block does not actually exercise the
guard it claims. The Info items are documentation/consistency nits.

## Warnings

### WR-01: UPDATE policies have no `WITH CHECK` — a user can move a row out of their own scope

**File:** `supabase/migrations/056_workflow_definitions.sql:59-61`, `supabase/migrations/057_workflow_runs.sql:44-46`, `supabase/migrations/058_workflow_phases.sql:59-67`
**Issue:** Every UPDATE policy supplies only a `USING` clause and no `WITH CHECK`.
In Postgres RLS, `USING` gates which rows are *visible to update*, but `WITH
CHECK` gates the *post-update row values*. With no `WITH CHECK`, the `USING`
predicate is reused for the old row only — the new row is unconstrained. Concrete
consequences:

- `workflow_definitions`: an owner can `UPDATE ... SET created_by = '<other-user>'`,
  silently transferring ownership of their definition to another user (or to the
  seed system user). They can also flip `is_global = true` on UPDATE — the
  carefully-built INSERT guard (`WITH CHECK (... AND is_global = false)`, line 57)
  is bypassed because UPDATE has no equivalent check. A user could INSERT a private
  draft, then UPDATE it to `is_global = true`, defeating T-090-06 entirely. (The
  block-published trigger only stops this once `status='published'`; a draft can be
  freely promoted to global.)
- `workflow_runs`: an owner can `UPDATE ... SET thread_id = '<other-users-thread>'`.
  The `USING` check passes against the OLD `thread_id` (their own), and with no
  `WITH CHECK` the new `thread_id` is accepted, attaching their run to a foreign
  thread.
- `workflow_phases`: same shape via the 2-hop chain.

This is the same gap present in the 017_skills / 055_todos precedents this phase
mirrors, so it is not a regression — but the `is_global=true` self-promotion path
specifically undermines the T-090-06 control this phase explicitly added.
**Fix:** Add a matching `WITH CHECK` to each UPDATE policy. For
`workflow_definitions` the check must also re-assert the global guard:
```sql
CREATE POLICY "Users can update own workflow definitions"
  ON public.workflow_definitions FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by AND is_global = false);
```
For `workflow_runs` / `workflow_phases`, repeat the same FK-chain predicate in
`WITH CHECK` as in `USING`. If intentionally deferred to match precedent, record
the `is_global` self-promotion path as a known T-090-06 residual in DECISIONS so
Phase 091/092 (which consume `is_global`) do not assume it is closed.

### WR-02: verify_090_run.sql Block D never proves RLS *enforcement* — it queries through a path RLS does not gate

**File:** `supabase/verify_090_run.sql:84-96`
**Issue:** Block D impersonates user B and then counts user A's rows with queries
like `SELECT count(*) FROM workflow_runs wr JOIN threads t ON ... WHERE t.user_id
= v_a`. RLS on `workflow_runs` is `auth.uid() = (SELECT user_id FROM threads WHERE
id = thread_id)`. Under user B's claims this filters `workflow_runs` to B's own
rows — so the count is 0. But the count is *also* 0 if RLS were broken, because
the explicit `WHERE t.user_id = v_a` plus the join would still need RLS-visible
`workflow_runs` rows. The test passes whether or not RLS is enforced on the rows
it cares about, as long as B owns no runs against A's threads (which is always
true). More importantly, the `threads` table's own RLS likely hides A's thread
from B, so the JOIN drops the row regardless of `workflow_runs` RLS. The block
demonstrates "B sees 0" but does not isolate *which* table's RLS produced the 0.
A genuinely broken `workflow_runs` policy (e.g. `USING (true)`) would still report
PASS because the `threads` join still filters.
**Fix:** Query each protected table *directly by its primary key* (the known
`v_run` / phase id / `v_audit`) without joining through `threads`, e.g.
`SELECT count(*) FROM workflow_runs WHERE id = v_run;` — that count is 1 iff
`workflow_runs` RLS leaks to B, 0 iff it correctly denies. This isolates the
table-under-test's policy from `threads` RLS. Same fix for the phases and audit
counts.

### WR-03: workflow_runs status CHECK and the WorkflowDefinition Pydantic statuses can drift silently

**File:** `supabase/migrations/057_workflow_runs.sql:18-19` and `backend/app/models/harness.py:94`
**Issue:** `workflow_runs.status` allows
`active|paused|completed|failed|cancelled`; `workflow_phases.status` allows
`pending|active|completed|failed|skipped`; the Pydantic `WorkflowDefinition.status`
allows `draft|published`. These are three independent string-literal sets with no
shared source of truth. The verify scripts insert `'running'`
(`verify_090.sql:75` Block B uses `status 'running'`) which is **not** in the
`workflow_runs` CHECK set (`active|paused|completed|failed|cancelled`) — so
Block B in `verify_090.sql` would fail the CHECK constraint at INSERT time, never
reaching the DELETE it means to test. The self-contained `verify_090_run.sql`
correctly uses `'active'` (line 69), so the live grid passed; but the hand-run
`verify_090.sql:75` is wrong and would error before its assertion.
**Fix:** Change `verify_090.sql:75` `'running'` → `'active'`. Separately, when
Phase 091 introduces the engine, derive these status literals from a single shared
enum/constant so the SQL CHECK and any future Python run-status model cannot drift.

### WR-04: `workflow_runs.current_phase_id` is an unconstrained free uuid with no documented intent

**File:** `supabase/migrations/057_workflow_runs.sql:20`
**Issue:** `current_phase_id uuid` carries no FK to `workflow_phases(id)` and no
comment explaining why (contrast `harness_audit.run_id` at 059:16 and every
`org_id`, which document the deliberate no-FK choice inline). A reader cannot tell
whether the missing FK is intentional (chicken-and-egg: phases are created after
the run) or an oversight. Without a FK or an application-level invariant, the
engine (091) can set `current_phase_id` to a phase belonging to a *different* run
or a deleted phase, and nothing rejects it.
**Fix:** Either add `REFERENCES workflow_phases(id) ON DELETE SET NULL` (phases
are created post-run, so the FK is satisfiable as long as the engine writes the
phase row before advancing the pointer), or add an inline comment matching the
`run_id`/`org_id` convention explaining the deliberate no-FK and naming Phase 091
as the integrity owner.

## Info

### IN-01: PROVISIONAL phase-config fields lack constraints the engine will likely need

**File:** `backend/app/models/harness.py:46,52-54`
**Issue:** `max_steps: int = 10`, `max_parallel_agents: int = 5`,
`merge_strategy: str = "concat"` accept any int (including negative or zero) and
any string. `max_parallel_agents` is described as a "scaling cap" but a config of
`max_parallel_agents: -1` or `0` parses cleanly. These are documented PROVISIONAL
(per RESEARCH A1) so this is informational, but the engine in 091 will need
`ge=1` bounds and `merge_strategy` as a `Literal[...]`.
**Fix:** When 091 firms these up, add `Field(ge=1)` to the int caps and convert
`merge_strategy` to a `Literal["concat", ...]`. No action required in 090.

### IN-02: `ValidatorSpec.on_failure` is a free string encoding structured intent

**File:** `backend/app/models/harness.py:79`
**Issue:** `on_failure: str = "fail_run"` carries a mini-DSL
(`fail_run | retry | skip_to_phase:<slug>`) as an unvalidated string. A typo like
`"fail-run"` or `"skipto:x"` parses fine and only fails at engine-interpret time —
the opposite of the `extra='forbid'` philosophy stated in the module docstring.
**Fix:** When 091 owns execution, model the fixed cases as a `Literal` and the
parameterized `skip_to_phase:<slug>` as a validated pattern (or a small tagged
submodel). Informational for 090.

### IN-03: `ValidatorSpec.config` and phase `output` typed as bare `dict`

**File:** `backend/app/models/harness.py:78` and the JSONB `output` columns
**Issue:** `config: dict` is an untyped mapping; combined with `extra='forbid'` on
the surrounding models, this is the one place arbitrary keys are silently
accepted (by design, since validator configs are kind-specific). Worth a one-line
note that `config` shape is validated downstream by each validator `kind`, so
readers don't expect strict parsing here.
**Fix:** Add a comment on `config` clarifying it is intentionally schemaless at
this layer and validated per-`kind` in 091. No code change.

### IN-04: verify_090.sql Block A mixes a transaction-aborting RAISE with surrounding statements

**File:** `supabase/verify_090.sql:34-52`
**Issue:** Block A wraps the INSERT, the publish UPDATE, and the
expected-to-raise UPDATE in a single `BEGIN ... ROLLBACK`. In psql, the raising
UPDATE (line 48) aborts the transaction, so the trailing `ROLLBACK` is what
actually runs and the operator sees `25P02 current transaction is aborted` noise
if they paste the block whole. The inline comment ("Run this statement on its
own") acknowledges this but the block structure still invites a paste-all run.
The self-contained `verify_090_run.sql` solves this properly with a nested
`BEGIN ... EXCEPTION` sub-block; `verify_090.sql` is the now-secondary manual
script.
**Fix:** Optional — either wrap line 48 in a `DO $$ ... EXCEPTION WHEN
check_violation ... $$` like the run-script does, or strengthen the comment to
"paste lines 36-44 first, then line 48 alone." Low priority since the run-script
is the authoritative gate.

### IN-05: Seed comment references migration 018 but body says 056 is self-sufficient

**File:** `supabase/migrations/056_workflow_definitions.sql:148`
**Issue:** The inline comment on the `created_by` value says "seed system user
from 018_skill_creator_seed.sql", but the block header (lines 102-105) correctly
states 056 does NOT assume 018 has run and seeds the user itself. The line-148
comment is a stale cross-reference that contradicts the (correct) self-sufficiency
claim above it.
**Fix:** Change the line-148 comment to "seed system user inserted above
(idempotent; same UUID as 018)".

### IN-06: `is_global` workflow definitions are unreachable for UPDATE/DELETE by any normal user

**File:** `supabase/migrations/056_workflow_definitions.sql:59-65`
**Issue:** UPDATE/DELETE policies gate on `auth.uid() = created_by`. Global seed
definitions are owned by the seed system user (`...0001`), so no authenticated
user can ever UPDATE or DELETE them — correct and intentional for immutability,
but it means a global definition can only be changed by a superuser SQL-editor
session. Worth noting for Phase 091/092 (the "operator tier" deferred to v2.9 is
the intended escape hatch). Documented partially at lines 47-54; just flagging
the UPDATE/DELETE consequence is also covered.
**Fix:** None — behavior is correct. Note in DECISIONS that global-definition
mutation is superuser-only until the v2.9 operator tier lands.

---

_Reviewed: 2026-05-31T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
