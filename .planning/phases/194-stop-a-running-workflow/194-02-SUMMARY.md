---
phase: 194-stop-a-running-workflow
plan: 02
subsystem: schema
tags: [migration, workflow_phases, cancel, live-db-gate]
requires:
  - "public.workflow_phases (table + workflow_phases_status_check, pre-existing)"
  - "supabase/migrations/115_workflow_phases_recorded_not_sent.sql (the shape and the header rules)"
  - "backend/tests/test_migration_115.py (the scaffold)"
provides:
  - "supabase/migrations/119_workflow_phases_cancelled.sql — the CHECK widening 6 -> 7 with 'cancelled' (AUTHORED, applied nowhere)"
  - "backend/tests/test_migration_119.py — the live-DB gate for V-14 / V-15"
  - "the 'cancelled' phase-status literal that plan 194-04's phase-terminalize writer needs"
affects:
  - "plan 194-12 (the operator apply + the F-7/F-8 RED observations this plan explicitly does NOT claim)"
  - "plan 194-04 (the sixth phase-status writer)"
tech-stack:
  added: []
  patterns:
    - "mig-115 CHECK-widening shape: BEGIN/COMMIT + DROP CONSTRAINT IF EXISTS + = ANY (ARRAY[...]) with ::text"
    - "live-DB gate with exactly two clean skips and a pg_constraint applied-probe"
    - "per-literal loop instead of a collapsed assertion (the 193.2 short-circuit lesson)"
key-files:
  created:
    - "supabase/migrations/119_workflow_phases_cancelled.sql"
    - "backend/tests/test_migration_119.py"
  modified: []
decisions:
  - "D-04 recorded IN THE SCHEMA, not only in CONTEXT: reusing failed/skipped was rejected as dishonest"
  - "D-17 inherited verbatim from mig 115 — the column stores the SLUG; the display sentence is refused"
  - "mig 115's db/workflows.py writer pointer is STALE and the correction is recorded BESIDE it, never over it"
  - "F-7/F-8's RED observations are 194-12's, and the docstring says so, so a green-skip can never read as a passing fence"
metrics:
  duration: "~35 min"
  completed: 2026-08-16
  tasks: 2
  commits: 2
---

# Phase 194 Plan 02: Migration 119 + its live-DB gate — Summary

Authored `supabase/migrations/119_workflow_phases_cancelled.sql` (widens
`workflow_phases_status_check` from six literals to seven by adding `cancelled`, in migration
115's exact shape) and `backend/tests/test_migration_119.py` (the live-DB gate: a seven-literal
per-literal positive control plus a `23514`-and-constraint-name negative control). **Nothing was
applied to any database** — the apply is plan 194-12.

## What shipped

| Task | Artifact | Commit |
|---|---|---|
| 1 | `supabase/migrations/119_workflow_phases_cancelled.sql` (131 L) | `8f53fcb3` |
| 2 | `backend/tests/test_migration_119.py` (363 L) | `e70c5016` |

### Task 1 — the migration

The DDL body is migration 115's `:110-122` with exactly one element added, inside one
`BEGIN;` / `COMMIT;` pair:

- `ALTER TABLE public.workflow_phases DROP CONSTRAINT IF EXISTS workflow_phases_status_check;`
- `ADD CONSTRAINT ... CHECK (status = ANY (ARRAY[...]))` with all six shipped literals re-added
  verbatim (`pending`, `active`, `completed`, `failed`, `skipped`, `recorded_not_sent`) plus
  `cancelled`.

All four of mig 115's rules are carried with **its own stated reason**, not merely copied:
`BEGIN`/`COMMIT` (WR-01 — without it a dropped session leaves the table with *no* CHECK at all,
fail-open and silently), `DROP CONSTRAINT IF EXISTS` (re-paste safety, house style 048/063),
`= ANY (ARRAY[…])` with `::text` rather than `IN (…)` (the form `pg_dump` regenerates, so the
`full-schema.sql` diff stays ~1 line), and re-adding every shipped literal verbatim (a re-typed
`ARRAY` is where a literal gets silently dropped and orphans every row using it).

The header additionally carries, per the plan: what the status **means** and D-04's rejection of
`failed`/`skipped` recorded *in the schema* rather than only in CONTEXT; D-17's slug rule; D-07/D-13's
completed-phases-untouched rule with the explicit statement that the migration **admits a literal and
does not authorise a bulk rewrite**; the D-06 apply story verbatim plus *"This plan (194-02) ONLY
AUTHORS the file — it is NOT applied here"*; and the ACCESS EXCLUSIVE / do-not-apply-to-cloud note.

**Verified acceptance:** file matches `^[0-9]+_[a-z0-9_]+\.sql$`; `ls supabase/migrations/ | grep -c "^119_"`
→ **1**, `^119[a-z]` → **0**; exactly **7** distinct `'<literal>'::text` values; `ALTER TABLE` count
**2**; `CREATE (TABLE|INDEX|POLICY)|GRANT|ENABLE ROW LEVEL` count **0**; `IN (` inside the DDL body
(from `BEGIN;` onward) **0**; `git diff --numstat -- supabase/full-schema.sql` **empty**.

### The stale pointer, corrected BESIDE the original

Migration 115's header (`:56-59`) says the phase-status literals live in *"the four UPDATEs in
`backend/app/db/workflows.py` (lines 965, 979, 1001, 1013)"*. **Both halves are wrong at HEAD and
both are corrected in 119's header without deleting 115's claim:**

- **The lines are stale by ~240.** Measured: `:965` and `:979` sit inside `count_foreign_runs_on_global`
  (def `:960`); `:1001` and `:1013` inside `load_run_phases` (def `:998`). Neither writes a phase status.
- **The count is wrong — there are FIVE writers, not four.** Re-derived at this commit with
  `grep -n "UPDATE workflow_phases SET status" backend/app/db/workflows.py`:
  `mark_phase_active` (def `:1202` → UPDATE `:1208`), `complete_phase` (`:1213` → `:1222`),
  `fail_phase` (`:1228` → `:1244`), `skip_phase` (`:1250` → `:1256`),
  `record_phase_not_sent` (`:1261` → `:1287`). 115's own new writer was the fifth and its header
  was written before it landed.

⚠ **A correction to `194-PATTERNS.md` § 5, made on measurement.** PATTERNS lists the writers as
`:1202, :1213, :1228, :1250, :1287` — that set mixes four `def` lines with one `UPDATE` line
(`:1287` is `record_phase_not_sent`'s UPDATE; its `def` is `:1261`). The count of five is correct
and the derivation is corrected beside it, so the next reader is not surprised by their own grep.
119's header records both the `def` and the `UPDATE` line for each writer, and says outright that
these numbers **will** go stale the same way 115's did.

### Task 2 — the live-DB gate

Copied `test_migration_115.py`'s scaffold whole: the `_POSTGRES_TEST_DSN` default, `_pg_reachable` /
`_check_pg_available_sync` / `PG_AVAILABLE` / the module-level `skipif`, the FK seed chain
(`auth.users` → `threads` → `workflow_definitions` → `workflow_runs`, `org_id` synthetic since it is
NOT NULL with no FK), the outer `tx.rollback()` in a `finally`, and the nested savepoint around each
deliberate failure.

Three tests: `test_cancelled_is_admitted` (INSERT **and** the `active` → `cancelled` UPDATE the cancel
path actually performs), `test_the_display_sentence_is_rejected` (F-8), and
`test_all_seven_statuses_are_admitted_one_literal_at_a_time` (F-7).

**Verified acceptance:** `pytest tests/test_migration_119.py -q` exits **0** with **3 skipped**;
`pg_get_constraintdef` count **1** and no INSERT-based applied-probe; `for .* in .*STATUSES` count
**1**; `assert all(` count **0**; `23514` count **5**; `workflow_phases_status_check` count **10**;
exactly two skip *conditions* (one module `skipif`, one `_SKIP_UNAPPLIED` reason used at three call
sites); three `await tx.rollback()` in three `finally` blocks; the tuple measured at runtime is
**exactly 7** — `('pending','active','completed','failed','skipped','recorded_not_sent','cancelled')`
— and is DERIVED as `SHIPPED_STATUSES + (CANCELLED_SLUG,)` rather than re-typed, so the two lists
cannot drift.

The em-dash in `CANCELLED_DISPLAY_SENTENCE` was verified to be **U+2014** (`0x2014`) in the file, not
a hyphen — the console renders it as `?` under cp1252 and that would have been an easy silent miss.

**The skip that fired is skip 2, not skip 1.** That is the meaningful part: Postgres *was* reachable,
so `pg_get_constraintdef` genuinely ran and genuinely returned `False` for `cancelled`. A skip-1 run
would have proved nothing about the probe.

## Fence observations — what was and was NOT proved

The plan states explicitly that **F-7 and F-8's RED observations are NOT owed by 194-02** and are
owed by **194-12**, because every test skips before reaching an assertion while the migration is
unapplied. That is honoured, and the module docstring says so in its own words so that nobody can
later read the green-skip as a passing fence.

**One RED observation WAS available today and was taken**, because the alternative was shipping a
gate whose skip might have been caused by a probe that can never match (an inert fence by a different
route). The plant: the applied-probe's needle swapped from `CANCELLED_SLUG` to the literal
`"recorded_not_sent"` — a real edit to real production source in the gate's own probe, which makes the
skip stop firing and runs the test bodies against the **unapplied** six-literal constraint.

| | Observed |
|---|---|
| plant | `_migration_119_applied` needle → `"recorded_not_sent"` |
| md5 before | `0144299ba16df72d36d6221fdf40cc7b` |
| result | **2 failed, 1 passed** (was `3 skipped`) |
| `test_all_seven_statuses_...` | **FAILED at `phase_index=6`** — `CheckViolationError ... "workflow_phases_status_check" DETAIL: Failing row contains (..., probe-6, cancelled, ...)` |
| `test_cancelled_is_admitted` | FAILED — the new literal is genuinely absent today |
| `test_the_display_sentence_is_rejected` | **PASSED** |
| md5 after revert | `0144299ba16df72d36d6221fdf40cc7b` — **byte-identical** |
| re-run after revert | `3 skipped` (green-skip restored) |

What that buys, stated precisely rather than generously:

1. **The green-skip is caused by the absent `cancelled` literal**, not by a probe that never matches.
2. **The per-literal loop reaches and NAMES the offending literal.** It failed at index **6**, which
   means indices 0-5 — all six shipped literals — inserted successfully first. A collapsed assertion
   would have short-circuited at index 0 and named nothing. This is F-7's *property* demonstrated,
   though not against F-7's named plant (deleting `'skipped'::text` from the applied `ARRAY`, which
   requires the migration applied).
3. ⚠ **F-8 passing here proves LESS than it looks, and that is worth writing down.** The display
   sentence is refused by the OLD six-literal constraint too, so today's green says nothing about the
   post-migration constraint. **194-12 still owes F-8's real RED** — a plant that puts the sentence
   into the `ARRAY[…]` — and this green may not be quoted in its place.

**No live data was mutated by the plant run.** Verified after the fact with a read-only probe:
leftover `workflow_phases` rows matching `probe-%` → **0**; `workflow_definitions` matching
`mig119-probe-%` → **0**; `auth.users` matching `phase-194-%@test.local` → **0**. The failing INSERT
aborted the transaction and the `finally: await tx.rollback()` discarded the seed chain.

## Deviations from Plan

### 1. [Rule 1 - Bug] My own docstring made the `assert all(` fence fire against the file that obeys it

- **Found during:** Task 2, running the acceptance greps.
- **Issue:** The plan's criterion is a RAW `grep -c "assert all("` over the file expecting **0**. My
  first draft explained *why* the loop must not be collapsed by quoting the forbidden shape verbatim,
  so the grep returned **1** against a file containing zero collapsed assertions. The first fix
  re-introduced it a second time — by quoting the grep command itself inside the correction.
- **Fix:** The prose now names the shape without spelling it contiguously (``assert`` over an
  ``all(...)``), and a note records **both** mistakes rather than smoothing them away. Final
  `grep -c "assert all("` → **0**.
- **Why it is recorded rather than quietly fixed:** this is the same class of failure as `193.2-08`,
  where a verbatim rule written WRAPPED failed its own literal `grep -q` and read as *"already
  fixed"*, and as the `193.2` publish-service comment split across two lines. **A fence a machine
  reads literally must not be described literally inside its own subject.**
- **Files modified:** `backend/tests/test_migration_119.py` · **Commit:** `e70c5016`

### 2. [Rule 3 - Blocking] The dispatched worktree base was WRONG and was corrected before any commit

- `git merge-base HEAD 3f2d5641` returned **`3781a3fe`**, not `3f2d5641` — the worktree had forked
  from the wrong base, the failure this repository measured **12/12 in Phase 192** and again on a
  single worktree on 2026-08-14.
- Corrected with `git reset --hard 3f2d5641` before any file was written. Post-reset `git rev-parse
  HEAD` → `3f2d564181d38216aea933672b7dd5ddf044b904`, clean tree, branch
  `worktree-agent-abda74407516aa36a`. **The standing rule that every executor must assert its base
  earned its keep again on this plan.**

### 3. [Measurement] `194-PATTERNS.md` § 5's writer line list mixes `def` and `UPDATE` lines

Recorded above and in the migration header. The count of five is right; `:1287` is a UPDATE line
whose `def` is `:1261`. Corrected beside, never over.

## Regression baselines — compared to `194-BASELINE.md`, never to RESEARCH

| Gate | Baseline (`743965a1`) | This plan | Moved? |
|---|---|---|---|
| cancel-path pytest (4 files) | 12 passed / 0 failed | **12 passed / 0 failed** | no |
| `pytest tests/unit -q` | 62 failed / 2242 passed / 2 xfailed / 2 xpassed | **62 / 2242 / 2 / 2** | no |
| `pytest tests/test_migration_119.py -q` | (file did not exist) | **exit 0, 3 skipped** | new |

⚠ **The unit comparison is BY NAME, not by count** (SEED-056 / SEED-165 — a count cannot see one
failure being fixed while a different one appears). The 62 failing test ids were extracted from this
run and `diff`ed against `194-BASELINE.md` § (d)'s published list: **identical, 0 new, 0 disappeared.**
Frontend gates were not run — this plan touches no frontend file.

## Threat register — dispositions honoured

| Threat ID | How it is discharged |
|---|---|
| T-194-02-01 | All six shipped literals re-added verbatim; the per-literal loop pins all seven and NAMES a dropped one (observed: it named `cancelled` at index 6). |
| T-194-02-02 | Single `BEGIN`/`COMMIT` pair — no window in which the table has no CHECK. ACCESS EXCLUSIVE note in the header; explicit do-NOT-apply-to-cloud-in-194. |
| T-194-02-03 | Every write inside a rolled-back transaction; deliberate failures in nested savepoints; applied-probe reads `pg_constraint`. **Measured zero leftover rows after the plant run.** |
| T-194-02-04 | Accepted — skip reasons carry only the well-known local dev DSN. |
| T-194-02-SC | Nothing installed. `asyncpg` and `pytest` already ship. |

## Known Stubs

None. Both artifacts are complete; the migration is deliberately **unapplied**, which is the plan's
stated output, not a stub.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or trust-boundary schema change —
the migration alters one CHECK constraint and touches no RLS policy, grant, table, column or index.

## Constraints respected

- ⛔ **Nothing applied to any database.** No `supabase db push`, no `db reset`, no psql apply, no
  `regenerate-full-schema.sh`. `supabase/full-schema.sql` is byte-unchanged.
- ⛔ `workflow_runs_status_check` untouched — verified at HEAD that it **already** admits `cancelled`
  (`057_workflow_runs.sql:19` created it that way; `063_dual_mode_continue.sql:55-57` re-asserted it).
  No migration is owed there.
- ⛔ `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` untouched — `git status` shows only the two
  `files_modified` artifacts across both commits. No `gsd-sdk query state.*` /
  `roadmap.update-plan-progress` / `requirements.mark-complete` verb was invoked.
- ⛔ No `git clean`, no `git stash`, no blanket reset outside the startup base assertion.

## Self-Check

- `supabase/migrations/119_workflow_phases_cancelled.sql` — **FOUND**
- `backend/tests/test_migration_119.py` — **FOUND**
- commit `8f53fcb3` — **FOUND**
- commit `e70c5016` — **FOUND**

## Self-Check: PASSED
