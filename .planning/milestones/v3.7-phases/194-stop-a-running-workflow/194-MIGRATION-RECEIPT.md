---
phase: 194-stop-a-running-workflow
plan: 12
artifact: migration-receipt
migration: supabase/migrations/119_workflow_phases_cancelled.sql
applied_on: 2026-08-16
applied_to: "local dev only — postgresql://postgres:postgres@127.0.0.1:54322/postgres"
cloud_applied: false
---

# Phase 194 — Migration 119 apply receipt

> **What this file is for.** `194-12` is the plan that takes migration 119 from *authored* to
> *applied*, and 194-02 explicitly deferred the F-7 / F-8 RED observations to here because every
> test in `backend/tests/test_migration_119.py` green-skipped while the constraint was unapplied.
> **A green-skip is not a passing fence.** This receipt is the evidence that it is one now.

---

## Apply

**Date:** 2026-08-16
**Target DSN:** `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (the local dev
Supabase Postgres — **local only**)
**Applied by:** the orchestrator, committed as `33eeb270`
**File applied:** `supabase/migrations/119_workflow_phases_cancelled.sql`, unmodified
(`md5 92fa45ce5ef9be252a227380667505d1`, `git status` clean)

### How it was applied — and what was NOT run

The migration file's **own statements were executed verbatim** against the live local Postgres
via `psycopg2` with `autocommit=True`, so the file's own `BEGIN` / `COMMIT` pair governed the
transaction. That is the **SQL-editor path**: one session, one transaction, the constraint either
the old six-literal one or the new seven-literal one and never absent (migration 115's WR-01
rule).

> ⛔ **Neither `supabase db push` nor `supabase db reset` was run.** Both wipe local dev data and
> CLAUDE.md forbids them outright. The 496 live `workflow_phases` rows — and everything else in
> the operator's dev database — are the proof: a reset would have emptied them.

⚠ The plan writes Task 1 as a `checkpoint:human-verify` for the operator. The operator explicitly
instructed the orchestrator to apply migrations itself while respecting the project rules, so the
checkpoint was discharged by the orchestrator rather than waived. **The rules it had to respect —
SQL-editor path, no `db push`, no `db reset`, no `--reset`, no hand-edit of `full-schema.sql`,
nothing applied to cloud — were all honoured and are each evidenced below.**

### BEFORE — captured before the apply

```
pg_get_constraintdef:
CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text, 'recorded_not_sent'::text])))

status counts:
active  3
completed  423
failed  41
pending  23
recorded_not_sent  5
skipped  1
total workflow_phases rows: 496
```

### AFTER — captured after the apply

```
pg_get_constraintdef:
CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text, 'recorded_not_sent'::text, 'cancelled'::text])))

status counts:
active  3
completed  423
failed  41
pending  23
recorded_not_sent  5
skipped  1
```

### The comparison — LITERAL BY LITERAL, not by counting

The plan's acceptance criterion is explicit that counting is not enough: a re-typed `ARRAY[…]` is
exactly where a shipped literal gets silently dropped, and six-into-seven arithmetic cannot see a
swap. Each of the six shipped literals was confirmed present in the AFTER definition
**individually**:

| shipped literal | in BEFORE | in AFTER | verdict |
|---|---|---|---|
| `pending` | yes | yes | survives |
| `active` | yes | yes | survives |
| `completed` | yes | yes | survives |
| `failed` | yes | yes | survives |
| `skipped` | yes | yes | survives |
| `recorded_not_sent` | yes | yes | survives |
| `cancelled` | **no** | **yes** | **added** |

```
ADDED   = ['cancelled']
REMOVED = []
```

**Per-status row counts: byte-identical before and after.** A widening `ALTER` touches no row, and
a moved count would have meant something other than this migration ran.

**VERDICT: PASS.**

### ⚠ This discharges plan 194-02's own recorded caveat

`194-02-SUMMARY.md` § *Fence observations* records, in its own words, that its F-8 green
**"proves LESS than it looks"**: the display sentence was refused by the OLD six-literal
constraint too, so nothing about the post-migration constraint followed from it. 194-02 stated
outright that *"194-12 still owes F-8's real RED — a plant that puts the sentence into the
`ARRAY[…]` — and this green may not be quoted in its place."*

**That plant is P5b below, it was driven, and it red.** The display sentence is now refused by the
**new seven-literal constraint**, and the assertion finally distinguishes what it claims to.

### ⚠ A DISCREPANCY CARRIED FORWARD TO PLAN 194-13 — DO NOT ASSUME IT AWAY

`workflow_phases` holds **THREE** rows at `status = 'active'`. `194-CONTEXT.md` **D-17** describes
**TWO** orphan `workflow_phases` rows stuck `active` under already-FAILED runs.

**Three is not two.** The third row may be a legitimately in-flight phase, a later orphan, or D-17
may simply have under-counted. Nothing in this plan resolves it, and nothing in this plan touched
it — **⛔ plan 194-12 healed no data row; the heal is 194-13's, in its own serialized wave.**

> **Plan 194-13 MUST MEASURE this rather than inherit either number.** A heal written against a
> hard-coded expectation of two rows will either miss one or, worse, be written to expect a count
> it never checked. Re-derive with
> `SELECT id, workflow_run_id, status FROM public.workflow_phases WHERE status = 'active'` joined
> against `workflow_runs.status`, and record what the third row actually is.

---

## Task 2 — V-14 and V-15 on the live DB

### The gate now EXECUTES rather than skipping

```
cd backend && venv/Scripts/python.exe -m pytest tests/test_migration_119.py -x -q
...                                                                      [100%]
3 passed, 1 warning in 0.27s
```

Zero skips, zero failures. Re-run after all eleven plants below: **`3 passed`**, unchanged.

The three cases are `test_cancelled_is_admitted` (V-14a), `test_the_display_sentence_is_rejected`
(V-15 / F-8) and `test_all_seven_statuses_are_admitted_one_literal_at_a_time` (V-14b / F-7).

### Reference state read at the start of Task 2

```
pg_get_constraintdef:
CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text, 'recorded_not_sent'::text, 'cancelled'::text])))

status counts:
active               3
completed            423
failed               41
pending              23
recorded_not_sent    5
skipped              1
TOTAL                496
```

Byte-identical to Task 1's AFTER. This is the value every rollback proof below is compared against.

---

## The RED observations

**How the plants were driven, and why it is not a re-typed test body.** Every plant is DDL applied
inside a transaction that is **rolled back** — Postgres DDL is transactional, so the database is
byte-unchanged afterwards, and this receipt *proves* that rather than asserting it by re-reading
`pg_get_constraintdef` **and** the per-status counts after every single plant.

The test bodies were **not re-typed**. `backend/tests/test_migration_119.py` was imported and its
**real test coroutines were called**, handed a fake pool whose `acquire()` yields the connection
already inside the planted transaction. asyncpg turns each test's own `conn.transaction()` into a
SAVEPOINT, so their internal rollbacks still behave exactly as under pytest, and the outer
`ROLLBACK` undoes the plant.

**CONTROL-0 — the three cases against the UNPLANTED live constraint, run through the same
harness first, so a later RED cannot be an artefact of the harness:**

| test | verdict |
|---|---|
| `test_cancelled_is_admitted` | **PASSED** |
| `test_the_display_sentence_is_rejected` | **PASSED** |
| `test_all_seven_statuses_are_admitted_one_literal_at_a_time` | **PASSED** |

### Why there are eleven plants and not two

The plan requires two RED observations. Eleven were driven, and the extra nine are load-bearing
rather than ceremonial, for a reason this phase has already measured twice:

- **`assert` short-circuits.** `194-10` shipped six plants where its plan required two and *four
  were load-bearing*, because the plan's two would have left four clauses with **no RED
  observation at all**. `test_all_seven_statuses_…` has **three** independent clauses and
  `test_the_display_sentence_is_rejected` has **three**; a plant that reds the first leaves the
  rest unobserved.
- **`194-03`'s four required plants all red on the SAME clause** — multi-clause fences need a
  plant that reds EACH clause independently.
- **`194-08`'s plant C and `194-11`'s realistic-world case each failed to red**, and investigating
  rather than recording the pass found fences that could not fire. **Two plants here failed to
  red, and both are written up as findings below rather than smoothed away.**

---

### F-7 — `test_all_seven_statuses_are_admitted_one_literal_at_a_time`

#### ⚠ FINDING 1 — the plan's literal F-7 plant is IMPOSSIBLE on this database, and that is itself evidence

The plan says: *"drop the constraint and re-add it **omitting `'skipped'::text`**"*. Driven
literally (**P1-a**), **the plant itself was refused by Postgres:**

```sql
ALTER TABLE public.workflow_phases DROP CONSTRAINT IF EXISTS workflow_phases_status_check;
ALTER TABLE public.workflow_phases ADD CONSTRAINT workflow_phases_status_check CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'recorded_not_sent'::text, 'cancelled'::text]));
```

```
asyncpg.exceptions.CheckViolationError: check constraint "workflow_phases_status_check" of relation "workflow_phases" is violated by some row
```

**Why:** the live table already holds rows at that status — `skipped` **1**,
`recorded_not_sent` **5** — so Postgres validates the new constraint against existing data and
refuses. This is a **real, independent defence that the fence does not provide**, and it is
precisely migration 115's rule 4 stated by the database itself: *"a re-typed `ARRAY[…]` is where a
shipped literal gets silently dropped, which would orphan every existing row using it."*

⚠ **But that defence exists ONLY where live rows exist.** On a greenfield database restored from
`supabase/full-schema.sql` the table is EMPTY, the omission applies cleanly, and **the fence is the
only thing standing between a dropped literal and a broken vocabulary.** That greenfield case is
exactly the case the fence is for — so the plant was re-driven with `NOT VALID`, which skips the
existing-row scan while still enforcing on new writes, reproducing the greenfield situation
faithfully. Both readings are recorded; the impossible one is not deleted.

#### P1-b (PLAN-REQUIRED, greenfield-faithful route) — clause 1, the per-literal loop

```sql
ALTER TABLE public.workflow_phases DROP CONSTRAINT IF EXISTS workflow_phases_status_check;
ALTER TABLE public.workflow_phases ADD CONSTRAINT workflow_phases_status_check CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'recorded_not_sent'::text, 'cancelled'::text])) NOT VALID;
```

`pg_get_constraintdef` while planted:
`CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'recorded_not_sent'::text, 'cancelled'::text]))) NOT VALID`
Applied-probe `_migration_119_applied` while planted: **`True`** — the skip did not fire, so the
assertions were genuinely reached.

| test | verdict |
|---|---|
| `test_all_seven_statuses_are_admitted_one_literal_at_a_time` | **FAILED** |

```
File "backend\tests\test_migration_119.py", line 345, in test_all_seven_statuses_are_admitted_one_literal_at_a_time
    row_id = await _insert_phase(conn, run_id, org_id, status, phase_index=idx)
asyncpg.exceptions.CheckViolationError: new row for relation "workflow_phases" violates check constraint "workflow_phases_status_check"
DETAIL:  Failing row contains (e243e4ec-..., c961eec4-..., 4, probe-4, skipped, {}, 17a9371a-..., 2026-08-16 00:37:10.597115+00, 2026-08-16 00:37:10.597115+00).
```

**It NAMES `skipped`, which is what the plan required** — and the slug `probe-4` is the load-bearing
half: `phase_index` 4 means **indices 0-3 inserted successfully first**. A collapsed assertion over
an `all(…)` of the seven would have short-circuited at index 0 and named nothing. **The
per-literal loop is what makes the failure observable, and this is the observation.**

#### P2-b — clause 1 again, on a DIFFERENT literal

Same shape, omitting `recorded_not_sent` instead. **FAILED**, at `probe-5`:

```
asyncpg.exceptions.CheckViolationError: new row for relation "workflow_phases" violates check constraint "workflow_phases_status_check"
DETAIL:  Failing row contains (1681b0ce-..., b5173efe-..., 5, probe-5, recorded_not_sent, {}, de75f3d0-..., ...).
```

**Why a second plant on the same clause is not redundant:** it proves the failure message carries
the **actual offender** rather than a fixed string, and that the loop reaches index **5** — i.e.
all five preceding literals inserted first. One plant naming `skipped` is consistent with a
message that always says `skipped`.

#### P3 — clause 2, the unknown-status refusal

`assert` short-circuits, so P1/P2 leave this clause with **no RED observation at all**. Planted a
constraint that admits anything while still naming `cancelled` (so the applied-probe does not
skip):

```sql
ALTER TABLE public.workflow_phases ADD CONSTRAINT workflow_phases_status_check CHECK (status IS NOT NULL OR status = 'cancelled'::text);
```

| test | verdict |
|---|---|
| `test_all_seven_statuses_are_admitted_one_literal_at_a_time` | **FAILED** |

```
File "backend\tests\test_migration_119.py", line 353, in test_all_seven_statuses_are_admitted_one_literal_at_a_time
    with pytest.raises(asyncpg.PostgresError) as exc:
Failed: DID NOT RAISE <class 'asyncpg.exceptions._base.PostgresError'>
```

The closed-vocabulary clause fires on its own. A constraint widened into a free-text column is
caught.

#### P4 — clause 3, `len(ADMITTED_STATUSES) == 7`

This clause runs **before any DB access**, so no DDL can reach it. Driven in-process by rebinding
the module attribute to the six-tuple — **no source edit, no DDL**:

| test | verdict |
|---|---|
| `test_all_seven_statuses_are_admitted_one_literal_at_a_time` | **FAILED** |

```
File "backend\tests\test_migration_119.py", line 330, in test_all_seven_statuses_are_admitted_one_literal_at_a_time
    assert len(ADMITTED_STATUSES) == 7, (
AssertionError: migration 119 takes the vocabulary from six to seven; if this tuple is not seven long the fence is measuring the wrong thing (got ('pending', 'active', 'completed', 'failed', 'skipped', 'recorded_not_sent'))
```

**All three F-7 clauses have now been watched to fail INDEPENDENTLY.**

---

### F-8 — `test_the_display_sentence_is_rejected`

#### ⚠ FINDING 2 — the plan's literal F-8 plant produces a SKIP, not a RED

The plan says: *"in a rolled-back transaction, DROP the constraint entirely and re-run the same
INSERT → it must now SUCCEED."* Driven literally (**P5a**):

| test | verdict |
|---|---|
| `test_the_display_sentence_is_rejected` | **SKIPPED** |

```
migration 119 NOT applied - workflow_phases_status_check does not yet admit 'cancelled'. This green-skip is EXPECTED UNTIL PLAN 194-12 APPLIES IT ...
```

**Why:** the fence's own applied-probe `_migration_119_applied` reads `pg_constraint` and returns
`False` when the constraint is **absent**, so dropping it entirely makes the test skip before it
reaches a single assertion. **The plan's own plant is short-circuited by the fence's own guard** —
had this been recorded as "the plant did not red, moving on", the F-8 clause would have shipped
with no RED observation while the receipt claimed one. **A plant that fails to red is a finding,
not a formality** (194-08 / 194-11). It is written up here and the real plant follows.

#### P5b (194-02's OWED plant) — clause 1, the INSERT must raise

The plant 194-02 actually named: **the display SENTENCE added to the `ARRAY[…]` as an eighth
literal** — exactly the misreading of D-17 this control exists to catch. The probe still sees
`cancelled`, so no skip fires.

```sql
ALTER TABLE public.workflow_phases ADD CONSTRAINT workflow_phases_status_check CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text, 'recorded_not_sent'::text, 'cancelled'::text, 'Run cancelled — no deliverable produced'::text]));
```

| test | verdict |
|---|---|
| `test_the_display_sentence_is_rejected` | **FAILED** |

```
File "backend\tests\test_migration_119.py", line 284, in test_the_display_sentence_is_rejected
    with pytest.raises(asyncpg.PostgresError) as exc:
Failed: DID NOT RAISE <class 'asyncpg.exceptions._base.PostgresError'>
```

**The INSERT succeeded once the sentence was admitted** — which is the plan's stated property, and
which discharges 194-02's owed observation. **D-17 is now an executable, RED-observed fence: a
migration that puts display prose into the constraint is caught.**

#### P6 — clause 3, the CONSTRAINT NAME, red INDEPENDENTLY of the SQLSTATE

`23514` is **every** CHECK on the table, and the whole point of the second assertion is that the
refusal came from **this** one. Planted the sentence into `workflow_phases_status_check` *and*
added a second, differently-named CHECK that still refuses it:

```sql
ALTER TABLE public.workflow_phases ADD CONSTRAINT wf_phases_probe_len_check CHECK (length(status) <= 20);
```

| test | verdict |
|---|---|
| `test_the_display_sentence_is_rejected` | **FAILED** |

```
File "backend\tests\test_migration_119.py", line 290, in test_the_display_sentence_is_rejected
    assert "workflow_phases_status_check" in str(
AssertionError: the rejection must come from workflow_phases_status_check, not from some other constraint; asyncpg reported CheckViolationError('new row for relation "workflow_phases" violates check constraint "wf_phases_probe_len_check"')
```

Clause 1 **passed** and clause 2 (`23514`) **passed** under this plant, and clause 3 red alone —
which is the only way to show the name assertion is not shadowed by the SQLSTATE one.

#### P7 — clause 2, the SQLSTATE, red independently of clauses 1 and 3

Planted the sentence into the constraint and narrowed the column type so the 38-character sentence
fails with `22001` (string truncation) instead of a check violation:

```sql
ALTER TABLE public.workflow_phases ALTER COLUMN status TYPE varchar(20);
```

| test | verdict |
|---|---|
| `test_the_display_sentence_is_rejected` | **FAILED** |

```
File "backend\tests\test_migration_119.py", line 286, in test_the_display_sentence_is_rejected
    assert exc.value.sqlstate == "23514", (
AssertionError: storing the display sentence 'Run cancelled — no deliverable produced' must raise the workflow_phases_status_check CHECK (23514); got 22001
```

Clause 1 passed (it did raise), clause 2 red alone. **All three F-8 clauses have now been watched
to fail INDEPENDENTLY.**

---

### V-14a — `test_cancelled_is_admitted` (not required by the plan; driven anyway)

Its two clauses are the two write paths, and **a CHECK constraint cannot distinguish INSERT from
UPDATE**, so no constraint plant can ever red them separately. Triggers can.

#### P8 — clause 2, the `active` → `cancelled` UPDATE

`BEFORE UPDATE` trigger rewriting `NEW.status := 'failed'`:

| test | verdict |
|---|---|
| `test_cancelled_is_admitted` | **FAILED** |

```
File "backend\tests\test_migration_119.py", line 241, in test_cancelled_is_admitted
    assert await conn.fetchval(
AssertionError: an active phase must be able to transition INTO cancelled - that is the write the cancel path performs on the single in-flight phase (D-07). Without it the row stays 'active' forever under a run marked 'cancelled', which is SC#3's failure mode
```

**This is the clause that matters most to the phase** — it is SC#3's failure mode asserted
directly, and until now nothing had watched it fail.

#### P9 — clause 1, the INSERT at the new status

`BEFORE INSERT` trigger returning `NULL`, so `RETURNING id` yields nothing:

| test | verdict |
|---|---|
| `test_cancelled_is_admitted` | **FAILED** |

```
File "backend\tests\test_migration_119.py", line 231, in test_cancelled_is_admitted
    assert inserted is not None, (
AssertionError: an INSERT at status='cancelled' must be admitted by workflow_phases_status_check after migration 119
```

---

## The database is provably unchanged by the plants

The plan is explicit that *"a rolled-back DDL transaction is safe by design, and the receipt is
what proves it was actually rolled back."* After **every one** of the eleven plants,
`pg_get_constraintdef` and the per-status counts were re-read:

| plant | constraint byte-identical to Task 1's AFTER | counts identical |
|---|---|---|
| P1-a | YES | YES |
| P1-b | YES | YES |
| P2-b | YES | YES |
| P3 | YES | YES |
| P4 | YES | YES |
| P5a | YES | YES |
| P5b | YES | YES |
| P6 | YES | YES |
| P7 | YES | YES |
| P8 | YES | YES |
| P9 | YES | YES |

**Final state, read after all plants:**

```
pg_get_constraintdef:
CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text, 'recorded_not_sent'::text, 'cancelled'::text])))

status counts:
active               3
completed            423
failed               41
pending              23
recorded_not_sent    5
skipped              1
TOTAL                496

status column type      : text
constraints on table    : workflow_phases_pkey, workflow_phases_status_check, workflow_phases_workflow_run_id_fkey
non-internal triggers   : workflow_phases_autofill_org_id, workflow_phases_set_updated_at
_p194_probe* functions  : 0
leftover probe-% phases : 0
leftover mig119-probe-% : 0
leftover probe users    : 0
```

Every artefact the plants created is gone, **verified rather than assumed**: the narrowed column
type is back to `text`, the extra `wf_phases_probe_len_check` is absent, the two probe triggers and
both `_p194_probe*` functions are absent (only the two shipped triggers remain), and the FK seed
chain (`auth.users` → `threads` → `workflow_definitions` → `workflow_runs` → `workflow_phases`)
left **zero** rows behind in any of its three probe-identifiable tables.

⛔ **No data row was healed.** The three `active` rows, the 41 `failed` and the single `skipped`
are exactly as Task 1 found them.

---

## Regeneration

`supabase/full-schema.sql` was regenerated by `bash scripts/regenerate-full-schema.sh`
**with NO `--reset`** and committed in `33eeb270`, alongside the apply. ⛔ `--reset` wipes the local
DB and is CI/release-only; the 496 surviving rows above are the evidence it was not passed.
⛔ The artifact was **never hand-edited** — the script is its only writer.

**`git diff --numstat` at `33eeb270`:**

```
1	1	supabase/full-schema.sql
```

**Exactly one line changed. The diff, in full:**

```diff
@@ -1972,7 +1972,7 @@ CREATE TABLE public.workflow_phases (
     org_id uuid NOT NULL,
     created_at timestamp with time zone DEFAULT now() NOT NULL,
     updated_at timestamp with time zone DEFAULT now() NOT NULL,
-    CONSTRAINT workflow_phases_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text, 'recorded_not_sent'::text])))
+    CONSTRAINT workflow_phases_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text, 'recorded_not_sent'::text, 'cancelled'::text])))
 );
```

**Every hunk accounted for: there is one hunk, and it is the constraint widening.** That one-line
outcome is not luck — it is migration 119's rule 3 working as stated: `= ANY (ARRAY[…])` with
`::text` casts is the form `pg_dump` regenerates, so the artifact diff stays at one line instead of
a whole-constraint reformat. Had the migration used `IN (…)`, this hunk would have sprawled.

**Verified at HEAD:** `full-schema.sql:1975` carries the seven-literal constraint, byte-matching
what the live DB reports from `pg_get_constraintdef`; `grep -c workflow_phases_status_check` → **1**;
`git diff --numstat -- supabase/full-schema.sql` → **empty** (committed, working tree clean);
`md5 fb5b25ea94ec7043f812315e35814642`. `ls supabase/migrations/*.sql | wc -l` → **113** (112 before
119 landed).

### Deployment-artifact parity — CHECKED, not assumed

```
$ bash scripts/check-deploy-drift.sh
[1/4] preset keys       ok     no unclassified preset-key drift (allowlist covers 44 keys)
[2/4] seed list         ok     all 9 runbook seed migrations exist (highest listed: 089)
                        WARN   migration(s) above #089 carry seed-like INSERT/UPDATE: 093 094 098 104 105 106 107 111 113 118
[3/4] sandbox tag       ok     sandbox tag consistent everywhere: agentic-rag-sandbox:101.1
[4/4] compose parse     WARN   docker compose unavailable/denied here — CI runs the authoritative parse
                        ok     structural check: backend mounts setup_data:/data AND volumes declares setup_data

RESULT: PASS — the one-box deploy artifacts are in sync.
EXIT=0
```

**PASS, exit 0.** Both WARNs are pre-existing and non-blocking, and **neither names migration 119**.
No env var, bundled service or sandbox image tag changed in this phase, so the confirmation is
recorded rather than the expectation.

⚠ **One thing worth writing down about step [2/4]:** its seed-like-`INSERT`/`UPDATE` sweep did
**not** flag migration 119 — correctly, because 119 contains no data statement of any kind. That is
notable because a pre-flight guard run by the orchestrator on this very file **did** fire, matching
the word *UPDATE* inside 119's own comment block, and read as a refusal of the migration. Same
needle, opposite verdicts, and the comment-blind one was wrong. **This is the bare-`grep` trap that
has now bitten `194-02` twice, `194-03`, `194-06`, `194-09` and the orchestrator today: scope every
needle to executable content.**

---

## Cloud

⛔ **Migration 119 was NOT applied to the cloud database, and nothing in this phase pushes to
`master` or `production`.** It joins the standing migration-parity window (migration 115's own
precedent — migs 099 onward land together, in order). Live deploys are operator-triggered.

⚠ The `DROP`+`ADD CONSTRAINT` takes a brief **ACCESS EXCLUSIVE** lock on `workflow_phases`.
Immaterial on local dev; on cloud it belongs in the parity window, not mid-traffic.

---

## Regression gates — compared to `194-BASELINE.md`, never to RESEARCH

| Gate | Baseline (`743965a1`) | This plan | Moved? |
|---|---|---|---|
| `pytest tests/test_migration_119.py -x -q` | (green-skip: 3 skipped) | **3 passed, 0 skipped, 0 failed** | ✅ the point of the plan |
| `pytest tests/unit -q` | 62 failed / 2242 passed / 2 xfailed / 2 xpassed | **62 / 2242 / 2 / 2** | no |
| cancel-path pytest (4 files) | 12 passed / 0 failed | **35 passed / 0 failed** | ⚠ see below |

⚠ **The unit comparison is BY NAME, not by count** (SEED-056 / SEED-165 — a count cannot see one
failure being fixed while a different one appears). The 62 failing ids were extracted from this run
and `comm`-diffed against `194-BASELINE.md` § (d)'s published list: **0 NEW, 0 DISAPPEARED,
identical sets.**

⚠ **The cancel-path gate rose 12 → 35 and that is the suites GROWING, not the gate breaking.**
Per-file, now vs. the case count at `743965a1`: `test_062_cancel_run` **22** (was 4),
`test_cancel_run` **2** (was 2), `test_run_lifecycle` **8** (was 3), `test_migration_115` **3**
(was 3) — `4+2+3+3 = 12`, `22+2+8+3 = 35`. The `+23` is Phase 194's own plans 194-03 … 194-11
adding cases to files this gate already watched. **Failures are the contract, and they are 0 on
both sides.** The earlier figure is recorded beside the new one rather than over it.

Frontend gates were not run — this plan touches no frontend file.
