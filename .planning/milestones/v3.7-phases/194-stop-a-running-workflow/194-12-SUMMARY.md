---
phase: 194-stop-a-running-workflow
plan: 12
subsystem: schema
tags: [migration, workflow_phases, cancel, live-db-gate, deploy-artifact]
requires:
  - "supabase/migrations/119_workflow_phases_cancelled.sql (authored by 194-02)"
  - "backend/tests/test_migration_119.py (the live-DB gate, authored by 194-02)"
  - "the live local Postgres at 127.0.0.1:54322"
provides:
  - "workflow_phases_status_check admitting SEVEN literals on the live local database"
  - "the F-7 / F-8 RED observations 194-02 explicitly deferred to this plan"
  - "supabase/full-schema.sql regenerated from the live schema (one-line diff)"
  - ".planning/phases/194-stop-a-running-workflow/194-MIGRATION-RECEIPT.md"
affects:
  - "plan 194-13 (the four-row heal) — inherits a MEASURED 3-vs-2 discrepancy on status='active'"
  - "the cloud migration-parity window — 119 is NOT applied to cloud"
tech-stack:
  added: []
  patterns:
    - "drive a live-DB fence RED inside a rolled-back DDL transaction (Postgres DDL is transactional)"
    - "import the real test module and hand it a fake pool over the planted connection, instead of re-typing the test body"
    - "NOT VALID to reproduce the greenfield case when live rows themselves refuse the plant"
key-files:
  created:
    - ".planning/phases/194-stop-a-running-workflow/194-MIGRATION-RECEIPT.md"
  modified:
    - "supabase/full-schema.sql (regenerated at 33eeb270, one line)"
decisions:
  - "The plan's literal F-7 plant is impossible on a populated DB — the live rows refuse it; NOT VALID reproduces the greenfield case the fence actually guards"
  - "The plan's literal F-8 plant SKIPS rather than reds — the fence's own applied-probe short-circuits it; 194-02's owed sentence-in-the-ARRAY plant is the real one"
  - "Eleven plants, not two — assert short-circuits and both gated tests carry three independent clauses"
  - "The 3-vs-2 active-row discrepancy is carried forward to 194-13 as a MEASUREMENT to redo, not a number to inherit"
metrics:
  duration: "~45 min"
  completed: 2026-08-16
  tasks: 3
  commits: 1
---

# Phase 194 Plan 12: Apply migration 119 and prove it on the live database — Summary

`workflow_phases_status_check` now admits **seven** literals on the live local Postgres, all six
shipped ones verified individually; `backend/tests/test_migration_119.py` **executes instead of
skipping** (3 passed); F-7, F-8 and V-14a were each watched to FAIL against **eleven** real DDL
plants inside rolled-back transactions, with the database proved byte-unchanged after every one;
and `supabase/full-schema.sql` carries the constraint in a **one-line** diff.

## What shipped

| Task | Artifact | Commit |
|---|---|---|
| 1 | migration 119 applied to the live local DB + `full-schema.sql` regenerated | `33eeb270` (orchestrator, pre-existing) |
| 2 | `194-MIGRATION-RECEIPT.md` — apply evidence, gate output, 11 RED observations, rollback proofs | `6ccad7aa` |
| 3 | `## Regeneration` section: diff stat, the full one-line hunk, `check-deploy-drift.sh` PASS | `6ccad7aa` (same file) |

⚠ **Task 3 produced no second commit, and the reason is stated rather than left to be inferred.**
Its `files_modified` artifact — `supabase/full-schema.sql` — was already regenerated and committed
at `33eeb270`; its *verification* output belongs in `194-MIGRATION-RECEIPT.md`, the same single file
Task 2 creates. Splitting one file across two commits would have meant committing a receipt with a
placeholder section in it. Both tasks' evidence is in one commit, and this note is here so the
commit count cannot later read as a skipped task.

## Task 1 — NOT re-run

Per the orchestrator's instruction, Task 1 (a `checkpoint:human-verify`) was already discharged and
committed as `33eeb270`. **Nothing was re-applied and the operator was not asked to re-apply it.**
All four of its outputs are recorded **verbatim** in the receipt's `## Apply` section, together with:

- the apply method — the migration file's own statements executed against
  `postgresql://postgres:postgres@127.0.0.1:54322/postgres` via `psycopg2` with `autocommit=True`,
  so the file's own `BEGIN`/`COMMIT` governed the transaction (the SQL-editor path);
- ⛔ the explicit statement that **neither `supabase db push` nor `supabase db reset` was run**;
- the **literal-by-literal** comparison as a seven-row table — `ADDED = ['cancelled']`,
  `REMOVED = []`, per-status counts byte-identical, **VERDICT: PASS**.

## The fence work — eleven plants, six clauses, two findings

**Method.** Every plant is DDL inside a transaction that is rolled back. The test bodies were **not
re-typed**: `test_migration_119.py` was imported and its **real coroutines called**, handed a fake
pool whose `acquire()` yields the connection already inside the planted transaction, so asyncpg
turns each test's own `conn.transaction()` into a SAVEPOINT and their internal rollbacks behave
exactly as under pytest. A **CONTROL-0** run put all three cases through that same harness
unplanted first — all PASSED — so no later RED can be an artefact of the harness.

**Why eleven and not the plan's two.** `assert` short-circuits. `test_all_seven_statuses_…` has
three independent clauses and `test_the_display_sentence_is_rejected` has three; the plan's two
plants would have left four clauses with **no RED observation at all** — which is exactly what
`194-10` measured about its own plan, shipping six plants where two were required and finding four
of them load-bearing. `194-03`'s four required plants all red on the *same* clause. Both lessons are
honoured here by targeting each clause separately.

| Plant | Fence | Clause targeted | Observed |
|---|---|---|---|
| P1-a | F-7 | the plan's literal wording | ⚠ **the plant itself was REFUSED by Postgres** — see Finding 1 |
| P1-b | F-7 | per-literal loop | **FAILED** at `probe-4` naming `skipped` |
| P2-b | F-7 | per-literal loop, different literal | **FAILED** at `probe-5` naming `recorded_not_sent` |
| P3 | F-7 | the unknown-status refusal | **FAILED** — `DID NOT RAISE` |
| P4 | F-7 | `len(ADMITTED_STATUSES) == 7` | **FAILED** — fires before any DB access |
| P5a | F-8 | the plan's literal wording | ⚠ **SKIPPED, not red** — see Finding 2 |
| P5b | F-8 | the INSERT must raise | **FAILED** — `DID NOT RAISE` |
| P6 | F-8 | the constraint NAME, alone | **FAILED** — named `wf_phases_probe_len_check` |
| P7 | F-8 | the SQLSTATE, alone | **FAILED** — `got 22001` |
| P8 | V-14a | the `active` → `cancelled` UPDATE | **FAILED** — SC#3's failure mode asserted directly |
| P9 | V-14a | the INSERT at the new status | **FAILED** |

**WHICH cases failed was read, never just how many** — every row above names the test and quotes its
actual failure line, per the 194-06 lesson (it found one of its own fences vacuous on the RED run
precisely by reading which cases failed).

### ⚠ FINDING 1 — the plan's literal F-7 plant is IMPOSSIBLE on a populated database

The plan says *"re-add it omitting `'skipped'::text`"*. Postgres **refused the plant**:
`check constraint "workflow_phases_status_check" of relation "workflow_phases" is violated by some
row` — the live table holds 1 `skipped` row and 5 `recorded_not_sent` rows, so the new constraint
fails validation against existing data.

That is migration 115's rule 4 stated by the database itself, and it is a **real defence the fence
does not provide**. ⚠ **But it exists only where live rows exist.** A greenfield database restored
from `supabase/full-schema.sql` is EMPTY: the omission applies cleanly and the fence is the only
thing between a dropped literal and a broken vocabulary. So the plant was re-driven with
`NOT VALID`, which skips the existing-row scan while still enforcing on new writes — reproducing
the greenfield case faithfully. It then red at `probe-4` naming `skipped`, and the slug is the
load-bearing half: `phase_index=4` means indices **0-3 inserted first**, which a collapsed
assertion could never have shown. Both readings are recorded; the impossible one is not deleted.

### ⚠ FINDING 2 — the plan's literal F-8 plant produces a SKIP, not a RED

The plan says *"DROP the constraint entirely and re-run the same INSERT → it must now SUCCEED"*.
Driven literally, the test **SKIPPED**: the fence's own applied-probe `_migration_119_applied` reads
`pg_constraint` and returns `False` when the constraint is absent, so the test skips before reaching
a single assertion. **The plan's own plant is short-circuited by the fence's own guard.**

Recorded as "the plant did not red, moving on", F-8 would have shipped with no RED observation while
the receipt claimed one — the inert-fence failure this project has hit five times in 193.2, four in
193.1, three in 192.1 and five in 190. **A plant that fails to red is a finding** (194-08's plant C,
194-11's realistic-world case). The real plant is the one **194-02 itself named and owed**: the
display sentence added to the `ARRAY[…]` as an eighth literal. It red with `DID NOT RAISE`.

### 194-02's caveat is discharged

`194-02-SUMMARY.md` recorded that its F-8 green *"proves LESS than it looks"* — the display sentence
was refused by the OLD six-literal constraint too — and stated that **194-12 still owes F-8's real
RED** and that its green *"may not be quoted in its place"*. **P5b is that plant, it was driven, and
it red.** D-17 is now an executable, RED-observed fence rather than a comment.

## The database is provably unchanged

`pg_get_constraintdef` **and** the per-status counts were re-read after **all eleven** plants —
byte-identical to Task 1's AFTER every time. Final read: 496 rows, the same six-status distribution,
`status` column type back to `text`, the extra probe constraint absent, both probe triggers and both
`_p194_probe*` functions absent (only the two shipped triggers remain), and **zero** leftover rows
across all three probe-identifiable tables (`workflow_phases` `probe-%`, `workflow_definitions`
`mig119-probe-%`, `auth.users` `phase-194-%@test.local`). Verified, not assumed.

⛔ **No data row was healed.** The three `active`, 41 `failed` and single `skipped` rows are exactly
as Task 1 found them.

## ⚠ Carried forward to plan 194-13 — a discrepancy, not a number

`workflow_phases` holds **THREE** rows at `status = 'active'`. `194-CONTEXT.md` **D-17** describes
**TWO** orphan rows stuck `active` under already-FAILED runs. Three is not two. The third may be a
legitimately in-flight phase, a later orphan, or D-17 may have under-counted. **194-13 owns the heal
and MUST MEASURE this rather than inherit either number** — a heal written against a hard-coded
expectation of two will either miss one or be written to expect a count it never checked. Recorded
in the receipt with the query to re-derive it.

## Deviations from Plan

### 1. [Rule 3 — Blocking] The plan's F-7 plant could not be applied; `NOT VALID` was used

Documented as Finding 1 above. Not a workaround: `NOT VALID` reproduces the greenfield database the
fence actually guards, and the plan's literal form is recorded with the error Postgres returned.

### 2. [Rule 2 — Missing critical] Nine plants added beyond the plan's two

The plan requires two RED observations. Six clauses across two gated tests, plus two on `V-14a`,
would otherwise have gone unobserved because `assert` short-circuits. This is the 194-10 pattern
applied deliberately rather than discovered afterwards.

### 3. [Rule 2 — Missing critical] `V-14a` was driven RED although the plan did not ask

`test_cancelled_is_admitted`'s second clause is **SC#3's failure mode asserted directly** — *"the
row stays `active` forever under a run marked `cancelled`"* — and nothing had ever watched it fail.
A CHECK cannot distinguish INSERT from UPDATE, so a constraint plant can never separate its two
clauses; `BEFORE UPDATE` / `BEFORE INSERT` triggers can, and did.

### 4. [Measurement] Task 1's checkpoint was discharged by the orchestrator, not the operator

Recorded in the receipt with the exact apply method and the explicit statement that no `db push` /
`db reset` ran. Every rule the checkpoint existed to protect is separately evidenced.

## Regression baselines — compared to `194-BASELINE.md`, never to RESEARCH

| Gate | Baseline (`743965a1`) | This plan | Moved? |
|---|---|---|---|
| `pytest tests/test_migration_119.py -x -q` | 3 **skipped** | **3 passed**, 0 skipped, 0 failed | ✅ the point of the plan |
| `pytest tests/unit -q` | 62 failed / 2242 passed / 2 xfailed / 2 xpassed | **62 / 2242 / 2 / 2** | no |
| cancel-path pytest (4 files) | 12 passed / 0 failed | **35 passed / 0 failed** | ⚠ grew, see below |
| `bash scripts/check-deploy-drift.sh` | (not in baseline) | **PASS, exit 0**, 2 pre-existing WARNs | — |

⚠ **The unit comparison is BY NAME, not by count** (SEED-056 / SEED-165). The 62 failing ids were
extracted from this run and `comm`-diffed against `194-BASELINE.md` § (d)'s published list:
**0 NEW, 0 DISAPPEARED, identical sets.**

⚠ **The cancel-path gate rose 12 → 35, and that is the suites GROWING.** Per-file, now vs. the case
count at `743965a1`: `test_062_cancel_run` **22** (was 4), `test_cancel_run` **2** (2),
`test_run_lifecycle` **8** (was 3), `test_migration_115` **3** (3) — `4+2+3+3 = 12`,
`22+2+8+3 = 35`. The `+23` is Phase 194's own plans 194-03 … 194-11 adding cases to files this gate
already watched. **Failures are the contract and they are 0 on both sides.** The earlier figure is
recorded beside the new one, never over it.

Frontend gates were not run — this plan touches no frontend file.

## Threat register — dispositions honoured

| Threat ID | How it is discharged |
|---|---|
| T-194-12-01 | SQL-editor path only; no `db push`, no `db reset`, no `--reset`. Per-status counts captured before, after the apply, and after **each of eleven** plants — identical throughout. 496 rows survive, which is itself the proof no reset ran. |
| T-194-12-02 | The plan ran ALONE on the main working tree; no sibling agent was active and none was dispatched. The ACCESS EXCLUSIVE lock blocked nothing. |
| T-194-12-03 | Single `BEGIN`/`COMMIT` pair — no window with the table unconstrained. F-7 proves all seven literals survive **per literal**, driven RED on two different ones. |
| T-194-12-04 | `full-schema.sql` regenerated by the script only, never hand-edited (`git status` clean, md5 recorded); the diff is **one line** and it is the constraint. |
| T-194-12-05 | Accepted and honoured — ⛔ **nothing applied to the cloud database**, no push to `master` or `production`. |
| T-194-12-SC | None owed — no package installed, nothing added to `requirements.txt`. |

## Constraints respected

- ⛔ No `supabase db push`, no `supabase db reset`, no `--reset` to `regenerate-full-schema.sh`.
- ⛔ `supabase/full-schema.sql` never hand-edited — verified unmodified in the working tree.
- ⛔ `supabase/migrations/119_workflow_phases_cancelled.sql` **not modified** — md5
  `92fa45ce5ef9be252a227380667505d1`, `git status` clean. A migration edited after apply is how a
  constraint ends up in a state no file describes.
- ⛔ `backend/tests/test_migration_119.py` **not modified** — the plants are external DDL, not source
  edits, so the gate that ships is byte-identical to the gate that was driven RED
  (md5 `786e25f415d92a31ff74cfb5a1fb948c`).
- ⛔ No data row healed; no cloud DB touched.
- ⛔ `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md` untouched — last commit on all three is `743965a1`,
  this phase's planning commit. No `gsd-sdk query state.*` / `roadmap.update-plan-progress` /
  `requirements.mark-complete` verb was invoked.
- ⛔ No `git worktree`, no `git reset`, no `git clean`, no `git stash` subcommand. Only the two files
  of this plan were staged, by explicit path; the pre-existing `.claude/` and `supabase/snippets/`
  modifications were left untouched.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or trust-boundary schema change — one
CHECK constraint widened by one literal; no RLS policy, grant, table, column or index touched.

## Self-Check

- `.planning/phases/194-stop-a-running-workflow/194-MIGRATION-RECEIPT.md` — **FOUND**
- `supabase/full-schema.sql` (constraint at `:1975`, seven literals) — **FOUND**
- commit `33eeb270` (Task 1, pre-existing) — **FOUND**
- commit `6ccad7aa` (Tasks 2 + 3) — **FOUND**
- `git diff --diff-filter=D HEAD~1 HEAD` — **empty** (no deletions)

## Self-Check: PASSED
