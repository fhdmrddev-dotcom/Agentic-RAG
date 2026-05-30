---
phase: 090
phase_name: "harness-schema-rls-config-models"
project: "Agentic RAG"
generated: "2026-05-31"
counts:
  decisions: 5
  lessons: 6
  patterns: 5
  surprises: 4
missing_artifacts:
  - "090-UAT.md (none — phase used an autonomous:false human-verify gate, not a UAT cycle)"
---

# Phase 090 Learnings: Harness Schema + RLS + Config Models

## Decisions

### Migrations are self-sufficient — never assume a prior seed migration ran
056 seeds its own `auth.users` system user (`…0001`) inline via the same idempotent
`INSERT … ON CONFLICT (id) DO NOTHING` that `018` uses, rather than FK-depending on `018`
having been applied.

**Rationale:** The global-seed row FK'd `created_by` to the `018` skills seed-user, which was
absent in the live DB → `FK violation 23503` on first apply. The seed mechanism was "Claude's
Discretion" per CONTEXT, so making 056 stand alone was in-scope and removes a hidden ordering dependency.
**Source:** 090-03-SUMMARY.md (Task 1 deviation), commit `eaa9e779`

### Amend already-applied schema with a forward migration, not by editing the applied file
The WR-01 security fix shipped as a NEW migration `060_harness_update_with_check.sql`
(DROP+CREATE the three UPDATE policies with `WITH CHECK`), not by editing 056–059.

**Rationale:** 056–059 were already applied to the live DB. Editing an applied migration makes the
file and the DB diverge (re-running it fails on `CREATE TABLE … already exists`). A forward migration
keeps the SQL-editor apply path clean and reproducible.
**Source:** 090-REVIEW.md (WR-01), 090-03-SUMMARY.md, commit `912433f0`

### `is_global` is guarded on BOTH INSERT and UPDATE (stricter than the skills precedent)
Regular users can only author `is_global = false` definitions; globals come only from the seed
migration. Enforced by `WITH CHECK (auth.uid() = created_by AND is_global = false)` on the INSERT
policy (056) AND the UPDATE policy (060).

**Rationale:** "Any user can publish a global workflow everyone sees" is undesirable, and the operator
role tier that would relax it is deferred to v2.9 (D-03). The 017 skills precedent allows self-set
globals; this phase deliberately chose the lower-risk option (b).
**Source:** 090-CONTEXT.md (T-090-06), 090-02-PLAN.md threat_model, 090-REVIEW.md WR-01

### Integrate a divergent-base worktree by cherry-pick, not merge
Wave 1 executor commits were brought onto `v2.5-dev` by cherry-picking the specific feat/test/docs
commits, not by merging the worktree branches.

**Rationale:** The worktrees forked from `57cbe4ef` (the v2.7→master merge), which is NOT an ancestor
of `v2.5-dev`. A `git merge` would have dragged the v2.7 release-PR merge commits into the dev branch.
Cherry-pick applies patches without ancestry; since all work products are net-new files, the picks were clean.
**Source:** 090-02-SUMMARY.md (worktree-base note), session execution

### Audit `event_type` is `text + CHECK`, not a Postgres ENUM
**Rationale:** Cheap to `ALTER` when Phase 091 adds event kinds; a real ENUM requires heavier migration.
Provisional set coordinated with the 091 engine.
**Source:** 090-02 (059 migration), 090-03-SUMMARY.md downstream notes

---

## Lessons

### `USING` without `WITH CHECK` on an UPDATE policy is an escalation hole
An INSERT-side guard (`is_global = false`) is insufficient on its own: without a matching `WITH CHECK`
on UPDATE, a user could INSERT a private draft then `UPDATE … SET is_global = true` to escalate it to a
global row everyone sees. The block-published trigger doesn't help — it only fires once `status='published'`,
and drafts promote freely.

**Context:** Code review WR-01; closed by migration 060. Live Block G now proves the promotion is denied (42501).
**Source:** 090-REVIEW.md (WR-01)

### The pytest harness mocks Supabase — DB-enforced behavior needs a separate live-DB gate
`backend/tests/conftest.py` builds a fully-mocked Supabase client. RLS, the immutable-on-publish trigger,
DELETE RESTRICT, UNIQUE, and INSERT-only audit CANNOT be verified in pytest. The only automated pytest is
the pure-Python Pydantic model test; everything DB-enforced is verified by a SQL script run against the live DB.

**Context:** Drove the plan shape — Wave 1 authors, an `autonomous:false` operator gate applies + verifies live.
**Source:** 090-RESEARCH.md (Pitfall 1), 090-VALIDATION.md, 090-03-SUMMARY.md

### RLS verification must query the target table DIRECTLY, not join through a parent
Block D originally counted user A's rows by joining through `threads`, so `threads` RLS produced the 0
regardless of whether the runs/phases/audit policies worked — a broken `USING (true)` would still report PASS.
Fix: query each table by its own PK.

**Context:** Code review WR-02; the corrected Block D queries `workflow_runs`/`phases`/`audit` directly.
**Source:** 090-REVIEW.md (WR-02)

### The Supabase SQL editor runs a pasted script in ONE transaction
A failure mid-script (the 056 seed FK violation) rolled back the entire migration — nothing was created —
so the edited file could be re-run cleanly from the top without "already exists" errors.

**Context:** Made the 056 fix-and-re-run loop trivial.
**Source:** session execution (Step 1 re-apply)

### Verify-script status values must match the table's CHECK constraint
`verify_090.sql` used `status='running'`, which is not in the `workflow_runs` CHECK set
(`active|paused|completed|failed|cancelled`) — that reference block would error before its assertion.
The self-contained `verify_090_run.sql` used `'active'`, which is why the live run passed.

**Context:** Code review WR-03; latent bug in the committed reference artifact.
**Source:** 090-REVIEW.md (WR-03)

### Several `gsd-sdk` tracking verbs are absent in this SDK version
`roadmap.annotate-dependencies`, `check.decision-coverage-plan`, `roadmap.complete-phase`, and the
`state.begin-phase`/`state.planned-phase` arg parsing all failed or mis-parsed (the `--phase`/`--name`
tokens leaked into STATE.md). Tracking (ROADMAP checkboxes, STATE position) had to be updated by hand.

**Context:** Decision/coverage gates were satisfied via the plan-checker's Dimension-7 analysis instead;
ROADMAP/STATE completion markers were edited directly.
**Source:** session execution (plan-phase §13a, execute-phase completion)

---

## Patterns

### Single-paste, self-cleaning, auto-reporting verification script
For an operator-run live-DB gate: wrap everything in `BEGIN … ROLLBACK`, use a `TEMP TABLE … ON COMMIT DROP`
to collect PASS/FAIL rows, use `DO $$ … EXCEPTION WHEN <sqlstate> THEN $$` blocks to assert that expected
errors fire, use `SET ROLE authenticated` + `set_config('request.jwt.claims', …, true)` for REAL RLS testing
(the `postgres` superuser bypasses RLS), and `SELECT` the result grid as the final statement.

**When to use:** Any time a non-technical operator must verify DB-enforced behavior (RLS/triggers/constraints)
the test suite can't reach. Zero substitution, zero pollution (rollback), one paste, read the grid.
**Source:** supabase/verify_090_run.sql, 090-03-SUMMARY.md

### Copy-with-rename of proven RLS migrations
The ownership/global SELECT (017), 1-hop + 2-hop FK-chain RLS (054/055), and INSERT-only audit (030)
were copied verbatim with column renames — zero new RLS reasoning. The ONLY genuinely-new SQL was the
immutable-on-publish trigger.

**When to use:** Any new RLS-scoped table — find the closest shipped analog and copy its policy shapes
rather than re-deriving predicates.
**Source:** 090-PATTERNS.md, 090-RESEARCH.md

### Forward migration to harden an already-applied schema
When a security/correctness gap is found after migrations are live, ship a new numbered migration that
`DROP`/`CREATE`s the affected objects, rather than editing the applied file.

**When to use:** Post-apply fixes in a hand-applied (SQL-editor) migration workflow.
**Source:** supabase/migrations/060_harness_update_with_check.sql

### `WITH CHECK` mirrors `USING` on every mutating policy
For UPDATE policies, set `WITH CHECK` to the same predicate as `USING` (plus any value constraints like
`is_global = false`) so a user cannot move a row out of (or escalate it within) their own scope.

**When to use:** Every FK-chain or ownership RLS policy that allows UPDATE.
**Source:** 060 migration, 090-REVIEW.md (WR-01)

### Parallel executors in isolated worktrees, integrated by cherry-pick
Disjoint-file plans run as parallel `isolation="worktree"` executors; the orchestrator integrates by
inspecting each worktree branch and cherry-picking its feat/docs commits onto the active branch — robust
even when the worktree forked from a stale base.

**When to use:** Wave-parallel execution where worktree base divergence is possible (observed on this project).
**Source:** session execution (Wave 1 integration)

---

## Surprises

### Worktrees forked from a stale base 47 commits behind the active branch
Both Wave 1 worktrees were created off `57cbe4ef` (the v2.7→master merge), not `v2.5-dev` (the active
milestone branch). The executors correctly flagged it and refused to self-recover by force-rewinding.

**Impact:** Required cherry-pick integration instead of a straight merge; 090-01 had also pulled the phase
files into its worktree via `git merge v2.5-dev`. No work lost, but the standard worktree merge helper had to be bypassed.
**Source:** 090-01-SUMMARY.md, 090-02-SUMMARY.md (worktree-base notes)

### 056 FK-violated on first apply despite research assuming the 018 seed user
RESEARCH said globals "reuse the 018 seed user" — but that user wasn't present in the live DB, so the
seed INSERT raised 23503.

**Impact:** One fix-and-re-run cycle; led to the "self-sufficient migration" decision above.
**Source:** session execution (Step 1), commit `eaa9e779`

### A large pre-existing red test baseline unrelated to this phase
~98 pre-existing pytest failures (e.g. async `query_documents` missing `await` in `test_sql_service.py`)
predate Phase 090 and are unrelated to it (090 is purely additive; its new files are import-clean, 882 passes).

**Impact:** The regression signal is noisy — phase verification relied on the targeted harness-model test
(8/8) plus the live-DB gate rather than a green full suite. Logged in deferred-items.md, not fixed (out of scope).
**Source:** 090-01-SUMMARY.md, deferred-items.md

### Supabase Studio flags the temp table as a "no RLS" risk
Running `verify_090_run.sql` triggered a Studio warning about `_v090` lacking RLS — a false positive for a
session-scoped TEMP table that is dropped on rollback and never exposed via the API.

**Impact:** Operator confusion; resolved by confirming "Run without RLS" is the correct, harmless choice.
**Source:** session execution (Step 2 operator prompt)
