---
phase: 256-every-token-is-counted-and-kept
plan: 01
subsystem: harness-metering
tags: [meter-03, meter-04, meter-05, durability, migration, circuit-breaker]
requires:
  - "workflow_runs (migration 057)"
  - "CircuitBreaker.absorb_usage_box (Phase 204)"
  - "ctx.run_usage_box (Phase 093 D-17)"
provides:
  - "workflow_runs.input_tokens / .output_tokens / .token_coverage (migration 182)"
  - "db.workflows.persist_run_usage — the ONE home of the token write"
  - "db.workflows.TOKEN_COVERAGE_LEGS — the coverage marker constant"
  - "CircuitBreaker.absorb_usage_box -> tuple[int, int] (the clamped delta)"
  - "idx_workflow_runs_org_coverage_incomplete — the per-org access path"
affects:
  - "Phase 257 METER-07 reads token_coverage rather than prose"
  - "plan 256-04 appends 'emit' to TOKEN_COVERAGE_LEGS in the same commit as the drain arms"
tech-stack:
  added: []
  patterns:
    - "additive DB accumulation (COALESCE(col,0) + $n) with a (0,0) no-op guard"
    - "@> array containment in a PARTIAL INDEX PREDICATE — first use in this repo"
    - "cross-process durability proof: subprocess.Popen child with its OWN real asyncpg pool"
key-files:
  created:
    - supabase/migrations/182_workflow_runs_token_totals.sql
    - backend/tests/unit/test_256_persist_run_usage.py
    - backend/tests/unit/test_256_finish_run_unchanged.py
    - backend/tests/unit/test_256_enforce_budget_persist.py
    - backend/tests/unit/test_256_producer_shell_site3.py
    - backend/tests/integration/test_256_migration_182.py
    - backend/tests/integration/test_256_persist_restart.py
  modified:
    - backend/app/db/workflows.py
    - backend/app/services/circuit_breaker.py
    - backend/app/services/harness_engine.py
decisions:
  - "D-256-04 was implemented AS CORRECTED, not as written: the persist sits ABOVE `if not breaker.armed: return`"
  - "Fence 3 asserts per-FILE call COUNTS first and file:line second — the positions rotted inside this same plan"
  - "supabase/full-schema.sql regeneration is OWED and could not run in this worktree (two independent blockers, both measured)"
metrics:
  tasks: 4
  commits: 8
  completed: 2026-09-18
---

# Phase 256 Plan 01: Every Token Is Counted And Kept — Durable Run Totals Summary

A harness run's token total is now durable: migration 182 gives `workflow_runs` three
nullable columns, `persist_run_usage` ADDs a per-phase delta at the database, and
`_enforce_budget` was reordered so that write happens **above** the `armed` guard — without
which METER-03 would have persisted nothing for any interactive run.

**Base SHA asserted:** `902701e89f4b05d58124e3b5a205face93632485` on `develop`.
⚠ The worktree spawned on the stale default branch — `git merge-base` read `658cb8547`, so an
explicit `git reset --hard` to the required base ran before any work. `scripts/bootstrap-worktree.sh`
ran first, as required, and reported `BOOTSTRAP OK`.

---

## What shipped

| Task | What | Commit |
|---|---|---|
| 1 | migration 182 authored | `af78fe54d` |
| 1 | live-DB shape gate (8 cases) | `c388adf8c` |
| 2 | RED: the write seam + Fence 3 | `a9cbca38e` |
| 2 | GREEN: `persist_run_usage`, widened `absorb_usage_box` | `ea36bddd0` |
| 3 | RED: disarmed-run persist + METER-05 site 3 | `01edb2d8f` |
| 3 | GREEN: the reorder, site 3, the prose-rot correction | `801011259` |
| 4 | SC#1 across a real process boundary | `f7f12ebbe` |
| — | Fence 3 correction (it fired on its own plan) | `7b5cbf419` |

---

## Migration 182 — applied, and by whom

⚠ **ATTRIBUTION, stated the way it happened rather than the way the plan wrote it.** The plan
required the OPERATOR to paste the file into the local Supabase SQL editor. What actually
happened: **the operator explicitly directed the orchestrator to apply it** ("you apply it"), and
the orchestrator applied it **over a direct local asyncpg connection** to
`postgresql://postgres:postgres@localhost:54322/postgres`, statement-for-statement from the
committed file — body first, then the index separately so a `@>` rejection could be isolated.
⛔ `supabase db push` and `supabase db reset` were NOT used and remain forbidden. This executor
did not apply it and did not probe the DB before the confirmation.

**Applied cleanly: YES.**

⭐ **THE `@>` PREDICATE WAS ACCEPTED — the `[ASSUMED]` is now MEASURED, and it is a NEW IN-REPO
PRECEDENT.** `256-RESEARCH.md` A1/U-2 flagged it `[ASSUMED]` and `256-PATTERNS.md` gap G-b
measured that **no `@>` appears in any index predicate anywhere in this repo, and no partial index
over an array exists at all** — the ten-plus `@>` hits are `jsonb` containment inside RPC bodies.
**No arity fallback was needed**; the migration file is byte-identical to what was committed at
`af78fe54d`. Postgres normalised the predicate to:

```
CREATE INDEX idx_workflow_runs_org_coverage_incomplete ON public.workflow_runs
  USING btree (org_id, created_at DESC)
  WHERE ((token_coverage IS NULL) OR (NOT (token_coverage @> ARRAY['agent'::text, 'single'::text, 'batch'::text, 'emit'::text])))
```

**The next phase that wants a negative-question index should not re-litigate this.** The
`array_length(...) < 4` fallback — which hard-codes ARITY instead of MEMBERS, and would read four
WRONG legs as complete — was never used and is not in the file.

### Operator's measurements, quoted rather than re-asserted

```
PRE columns: []
PRE indexes: ['idx_workflow_runs_thread', 'idx_workflow_runs_user_id', 'workflow_runs_pkey']
BODY APPLIED OK (ALTER + 3 COMMENTs)
INDEX APPLIED OK -- @> predicate ACCEPTED
POST columns: [{'column_name': 'input_tokens', 'data_type': 'integer', 'is_nullable': 'YES', 'column_default': None},
               {'column_name': 'output_tokens', 'data_type': 'integer', 'is_nullable': 'YES', 'column_default': None},
               {'column_name': 'token_coverage', 'data_type': 'ARRAY', 'is_nullable': 'YES', 'column_default': None}]
COLUMN COMMENTS PRESENT: 3
workflow_runs row count (data preserved): 283
```

### Independently re-measured here (a builder should not read its own gate from a claim)

```
{'total': 283, 'in_nonnull': 0, 'out_nonnull': 0, 'cov_nonnull': 0}
obj_description count: 3
```

⭐ **All 283 pre-existing rows sit with all three columns NULL**, which is *"no instrumented leg
ever reported usage for this run"* reading honestly with **no date arithmetic and no memory** —
D-256-07 / SC#4 working, checkable today rather than asserted.

### File-level acceptance, measured

| Check | Required | Measured |
|---|---|---|
| filename matches `^[0-9]+_.*\.sql$`, no letter suffix | yes | ✅ `182_workflow_runs_token_totals.sql` |
| `grep -c "NOT NULL"` | `0` | ✅ `0` |
| `grep -c "DEFAULT"` | `0` | ✅ `0` |
| `grep -c "COMMENT ON COLUMN"` | `3` | ✅ `3` |
| `grep -c "parent_run_id IS NULL"` | ≥ `1` | ✅ `4` |

⚠ Writing the header comments required **avoiding the literal strings** `NOT NULL` and `DEFAULT`
entirely, including inside the prose that explains why neither is used. The rationale is worded
as *"no nullability constraint here, and no zero fallback value"*.

### The ACL / supplement tail — RUN, and the verdicts verbatim

```
schema ACL parity — migrations scanned: 149 · FUNCTION: 61 statement(s) in 5 file(s) → 61 tuple(s)
  · TABLE/COLUMN: 32 statement(s) in 12 file(s) → 72 tuple(s) · mirrored: 133/133
  · tail: 653 lines · md5 da9c561634d417ebd289bedf07b75f69
  table/column statements per migration: 118 (4) · 126 (1) · 127 (1) · 128 (1) · 129 (3) · 150 (1)
    · 151 (2) · 156 (6) · 168 (3) · 169 (3) · 172 (3) · 177 (4)
schema ACL parity OK — every function AND table/column ACL in supabase/migrations/ is mirrored in the supplement.
```

```
greenfield privileges OK -- 149 migrations scanned, 32 table/column ACL statements replayed,
every expectation measured as the granted role on a database bootstrapped from supabase/full-schema.sql alone.
```

**"Unchanged" here is a measurement:** the twelve-file ACL list is still `118 · 126 · 127 · 128 ·
129 · 150 · 151 · 156 · 168 · 169 · 172 · 177` — **182 did not join it**, exactly as RESEARCH.md
predicted. Re-derived independently rather than inherited:

- `grep -rn "GRANT.*workflow_runs\|workflow_runs.*GRANT" supabase/full-schema.sql supabase/migrations/` → **0 hits**
- `grep -c "workflow_runs" scripts/full-schema-supplement.sql` → **0**

So **182 owes `scripts/full-schema-supplement.sql` NOTHING.** It adds no env var and no seed row,
so nothing in `deploy/onebox.env.example` or `docs/OPERATOR.md` moves — confirmed by
`bash scripts/check-deploy-drift.sh` → **`RESULT: PASS`** (2 pre-existing non-blocking WARNs, and
182 is *not* among the seed-like migrations it lists).

⛔ **CLOUD PARITY IS OWED at the next operator-gated production push, with
`get_advisors(security)` in the checklist** (T-256-08; BUG-260911-01's lesson is that every gate in
this project reads through the service role, so nothing in the suite ever requests as `anon`).
182 is local-only until then. Out of scope here; recorded so the deploy-parity list inherits it.

---

## ⛔ OWED AND NOT DONE: `supabase/full-schema.sql` was NOT regenerated

This is the one acceptance criterion this plan does not close, and the reason is structural rather
than a judgement call. **Two independent blockers, both measured, neither bypassable from here:**

1. **`scripts/regenerate-full-schema.sh` cannot run from ANY git worktree.** The Supabase CLI
   derives its project ref from the working directory's base name and the repo tracks no
   `supabase/config.toml`, so inside this worktree `supabase status` fails with:
   `failed to inspect container health: Error response from daemon: No such container: supabase_db_agent-a3c1a348fd949dbdf`.
   The script's own precondition check then exits with
   `Error: Supabase is not running locally. Start it with 'supabase start'.` — while the stack is
   in fact running perfectly (every other DB-touching gate in this plan connected to `:54322`).
   ⭐ **This is a NEW finding about the worktree workflow, not about this migration:** any future
   plan that ships a migration from a worktree hits it.
2. **`docker` is DENIED to this executor.** The script dumps via `docker exec … pg_dump`;
   `docker ps` returns `Permission to use Bash with command docker ps … has been denied`. There is
   no host `pg_dump` or `psql` on PATH either (`which pg_dump psql` → both absent), so there is no
   fallback that does not hand-assemble the artifact — and `full-schema.sql` must **never** be
   hand-edited.

**What is owed, exactly:** run `bash scripts/regenerate-full-schema.sh` **WITHOUT `--reset`** from
the **main working tree** after this branch merges, then confirm
`grep -c "token_coverage" supabase/full-schema.sql` ≥ `2` (column + index predicate) and commit the
script's output only. ⛔ The artifact is derived from the LIVE DB, which already carries 182, so
the result does not depend on who runs it — but it must be run.

⚠ **Nothing else in this plan depends on it.** `check-greenfield-privileges.py` bootstraps a
database **from `full-schema.sql` alone** and passed, which is evidence the artifact is still
internally consistent — it is simply one migration behind.

---

## The arithmetic (D-256-13) — every count, before and after

### Task 2 — `circuit_breaker.py` and `db/workflows.py`

| Measurement | Before | After |
|---|---|---|
| `grep -c "^async def \|^def " backend/app/db/workflows.py` | **35** | **36** (`+1` exactly) |
| `grep -c "def absorb_usage_box" circuit_breaker.py` | 1 | 1 |
| `grep -c "tuple\[int, int\]" circuit_breaker.py` | 0 | **1** |
| `CircuitBreaker` non-property methods | **9** | **9** |
| all `^    (async )?def ` in `circuit_breaker.py` | 13 | 13 |
| `grep -cE "f\"\"\"\|f'\|%s" db/workflows.py` | 6 | **6** (no new f-string SQL) |
| `grep -c '\$4' db/workflows.py` | 5 | **7** |
| `grep -rn "await finish_run(" backend/app/ \| wc -l` | **5** | **5** |
| new state / new imports in `circuit_breaker.py` | — | **0 / 0** |
| branches inside `absorb_usage_box` | 1 | **1** |

⚠ **THE "9 → 9" FIGURE NEEDED A DERIVATION, and it is published rather than asserted.** A naive
`grep -cE "^    (async )?def "` reads **13**, not 9. The plan's 9 is `CircuitBreaker`'s
**non-property** methods: `__init__`, `record_tokens`, `absorb_usage_box`, `elapsed_seconds`,
`remaining_seconds`, `check_limits`, `measurements`, `trip_breaker`, `duration_watch`. Adding the
three `@property` accessors gives 12 for the class, plus `CircuitBreakerTrippedError.__init__`
gives the 13 the grep reports. **Unchanged on every reading.**

### Task 3 — `harness_engine.py`

| Measurement | Before | After |
|---|---|---|
| `_enforce_budget` branch count (AST: If/For/While/Try/IfExp) | **2** | **2** |
| `_enforce_budget` `await` count (AST) | **1** | **2** |
| `_enforce_budget` call sites | **2** (`:1978`, `:2547`) | **2** (`:2016`, `:2585`) |
| `ctx.run_usage_box = ` assignments | 1 | **1** |
| `grep -cE "SELECT \|UPDATE \|INSERT "` (inline SQL) | **12** | **12** |
| `grep -c "cancel_phase("` (the Phase-194 fence) | **1** | **1** |
| `grep -c "input_tokens=None"` | **2** | **0** |
| `grep -c "runs.usage missing for run=%s provider=%s model=%s"` | 0 | **1** |
| `grep -c "llm_emit.. PHASES ARE NOT COUNTED"` (256-04 owns it) | 1 | **1** |
| new functions / new state | — | **0 / 0** |

⚠ **A COUNTING-CONVENTION CORRECTION, recorded beside the original rather than over it.** The plan
specifies `_enforce_budget` branches **"3 → 3"**. An AST walk counting `If`/`For`/`While`/`Try`/
`IfExp` nodes measures **2 → 2** (`if not breaker.armed`, `if not _tripped`). The plan's third
"branch" is presumably the `raise`/early-`return` counted as a path. **The invariant the figure
exists to protect — that the count is UNCHANGED — holds on either convention**, and the derivation
is published so the next reader does not have to guess which one produced the 3.

**Mechanical assertion of the reorder (asserted, not eyeballed):**

```
$ grep -n "persist_run_usage(" backend/app/services/harness_engine.py   → 1909
$ grep -n "if not breaker.armed:" backend/app/services/harness_engine.py → 1912
$ awk '/persist_run_usage\(/{p=NR} /if not breaker.armed:/{a=NR} END{exit !(p>0 && p<a)}' … ; echo $?
0
```

---

## Fence 3 — `finish_run` is byte-unchanged, PROVED

**The three md5 digests of `backend/app/db/workflows.py` (digest 1 == digest 3):**

| Stage | md5 |
|---|---|
| 1. pre-plant | `19ea63ecefba9c03727ecc1a530429aa` |
| 2. planted (whitespace-only edit inside `finish_run`) | `51799a96682399424abb36b483df1656` |
| 3. restored (`git checkout -- <that one file>`) | `19ea63ecefba9c03727ecc1a530429aa` |

**The RED drive, with exit codes:** fence green from birth (`4 passed`, exit 0) → plant → **exit 1,
`test_finish_run_source_is_byte_unchanged` FAILED** → restore → `4 passed`, exit 0. The plant was
whitespace only, which is the hardest case for a digest fence to catch and the easiest for a
reviewer to wave through.

**`finish_run`'s AST-extracted source digest is IDENTICAL before and after the whole plan:**
`2a3a1c4543f5a80c55d25a8d0e1bd1e0` (7,631 chars), re-measured after every commit landed — even
though `db/workflows.py` itself now digests `57dd95ee…`.

### ⚠ THE CALL-SITE FIGURE — the correction, recorded BESIDE D-256-05's original

> **D-256-05 and `256-RESEARCH.md` both state: *"7 call sites across 4 files"*.**

**MEASURED at this plan's base, `grep -rn "await finish_run(" backend/app/` returns FIVE call
sites across THREE files:**

```
backend/app/api/workflows.py:1802
backend/app/services/harness_engine.py:2257
backend/app/services/harness_engine.py:2298
backend/app/services/harness_engine.py:2580
backend/app/services/run_lifecycle.py:521
```

The other `finish_run(` hits are the `def` itself (`db/workflows.py:2169`) and four prose mentions
in docstrings/comments. **The DECISION the figure supports — leave `finish_run` alone — is
unaffected.** The figure is wrong, and the fence asserts the re-derived set, never the inherited
count.

### ⭐ THE FENCE FIRED ON ITS OWN PLAN, and that is the most useful thing it did

The full-gate run caught `test_the_finish_run_call_site_set_is_unchanged` failing at `+1` over the
locked 71 — **because this plan's own reorder and site-3 fix added 38 lines above those three
calls**, moving `:2257 / :2298 / :2580` to `:2295 / :2336 / :2618`. Per-file counts never changed;
only positions did.

⚠ **This is the rot-mode a `file:line` pin has, and it surfaced inside the very plan that wrote the
pin.** Left as specified it would false-red on every future unrelated edit to a 3,200-line hot
file. The fence now asserts, in order:

1. **the per-FILE call COUNTS** — `{api/workflows.py: 1, services/harness_engine.py: 3,
   run_lifecycle.py: 1}`. This is the real D-256-05 guard and it is stable under unrelated edits.
2. **the file:line set** — the plan's literal pin, with a failure message stating that a
   counts-pass plus a positions-fail is a **line shift** (bookkeeping: re-derive and update),
   never a new caller.

Both the original line numbers and the new ones are in the test file, neither overwriting the
other. Fence 3 also carries two vacuity controls: the extracted segment must start with
`async def finish_run(` and exceed 2,000 chars, and the call-site walk must visit ≥ 150 `.py` files
under `backend/app/` (a collapsed walk would make a green assertion meaningless).

---

## ⭐ The finding that justifies this plan's shape: D-256-04 named an unreachable write point

`harness_engine.py:1873` was `if not breaker.armed: return`, sitting **above** the `:1875` absorb
point D-256-04 names, and `CircuitBreaker.armed` is *"is either ceiling configured?"*. An
interactive harness run configures neither. **METER-03 implemented literally would have persisted
nothing for nearly every harness run in the product** — and a suite written against a scheduled-run
fixture would have been green over it.

**The RED proved it rather than arguing it:**
`test_a_disarmed_interactive_run_persists_its_token_delta` **FAILED** against the pre-reorder code
(targeted run: `8 failed, 8 passed`, exit 1), together with
`test_a_tripped_run_still_persists_the_spend_that_killed_it` and
`test_the_twice_per_phase_enforcement_writes_once_per_phase`. Meanwhile
`test_an_armed_run_at_its_ceiling_still_trips_identically` was **green before and after** — which is
the point: the scheduled path was never broken, and that is exactly why the defect could have
shipped.

**The reorder is behaviour-preserving for the trip, by arithmetic rather than by sampling:** on a
disarmed breaker `max_tokens` and `max_duration_seconds` are both `None`, and **both arms of
`check_limits` guard on `is not None`**, so it returns `(False, None)` unconditionally
(`circuit_breaker.py:188-193`). The `armed` guard is a **short-circuit, never a semantic**.
`absorb_usage_box` mutates only the breaker's own counters, which a disarmed breaker never reads.
No `try` was added around the persist — that would add a branch to a function whose branch count is
itself fenced, and could convert the raised `CircuitBreakerTrippedError` into a path that reaches
the `cancel_phase` escape arm.

---

## METER-05 site 3, and the prose rot beside it

`harness_engine.py`'s boot-sweep resume producer shell hardcoded a NULL usage, so **every resumed
run's segment read as "never measured"** while the box on `ctx` had been measuring it all along. It
now reads `_box.get("input_tokens")` / `.get("output_tokens")` with **no default and no `or 0`** —
an absent key stays `None` all the way to the column (D-256-06) — and emits the shipped
identifier-only warning `"runs.usage missing for run=%s provider=%s model=%s"` **before** the
finalize, honouring `db/runs.py:93-99`'s contract. The site-3 suite asserts the format string is
the exact shipped literal and that none of `tokens=`, `value=`, `usage_dict` appears near the call
(T-073-04 / T-256-07), plus a **vacuity control**: no warning is emitted when usage *was* measured.

**Grain (D-256-03):** the box holds the SEGMENT's spend and this shell is a per-segment `runs` row,
so segment-onto-segment is correct here. The cumulative `workflow_runs` figure is written only by
`persist_run_usage`, at the phase boundary.

⚠ **THE `:1826` COMMENT WAS MEASURABLY FALSE and is corrected beside its original, never over it.**
It read: *"`harness/` contained two `usage` references in total, both `input_tokens=None`."*
Measured: **seven argument sites plus one default parameter** — `api/runs.py:677` and `:1331`, this
module's resume shell, `harness/publish_service.py`, `scheduler_service.py`,
`eval_runner_service.py` and `run_reconciler.py`. The quoted original is preserved in the source
with spaces around the `=` so the literal itself is gone from the file (which
`grep -c "input_tokens=None"` → `0` requires).

⛔ **The `llm_emit` comment at `:1837-1842` is UNTOUCHED** — plan 256-04 owns it by F-4 and must
move it in the same commit as the drain arms. Verified: `grep -c "llm_emit.. PHASES ARE NOT
COUNTED"` → `1`, before and after.

---

## SC#1 across a process boundary — and the gap, named

`backend/tests/integration/test_256_persist_restart.py` seeds a committed `workflow_runs` row,
writes two deltas through `persist_run_usage` over process A's own pool, **closes that pool**, then
spawns a **separate Python interpreter** which opens its **OWN real asyncpg pool** and prints the
row as a JSON line. The parent asserts the child's pid differs from its own and that it read
`200 / 50 / ['agent','single','batch']`.

⭐ **This combination did not exist in the repository** (`256-PATTERNS.md` gap G-a). The closest
analog, `test_239_settings_cross_worker_invalidation.py`, discloses in its own docstring that *"the
child read the real Postgres row (its pool is a stub)"* is exactly what it does **not** prove —
copying that stub would have produced a test proving a process boundary was crossed while proving
nothing about the database.

**The verbatim "does NOT prove" sentence from the module docstring:**

> WHAT THIS DOES **NOT** PROVE: that a total survives a ``kill -9``, an OOM kill or a power loss at
> an arbitrary instruction mid-phase, and that a worker whose in-flight transaction was never
> committed loses nothing. Process B here starts cleanly after process A finished its writes;
> nothing in this file interrupts a write in progress. SC#1's literal words are *"re-reading the run
> after the process restarts returns the same totals the in-memory ceiling saw"*, and the gap
> between that sentence and the property above is a crash, not a restart.

A case (`test_the_docstring_states_both_halves_of_the_claim`) pins that sentence, so a later edit
cannot quietly drop the limitation and leave SC#1 looking proven by a test that cannot reach it.

⚠ **`tests/integration/` is OUTSIDE `pytest tests/unit`**, so neither integration file is visible
to the 71-name baseline and neither can be this phase's only proof. The unit-level proofs are the
disarmed-breaker drive through the real engine and the statement-level assertions on the writer.

---

## Verification

### 1. Targeted suites

| Suite | Result |
|---|---|
| `tests/unit/test_256_persist_run_usage.py` + `test_256_finish_run_unchanged.py` | **14 passed** |
| `tests/unit/test_256_enforce_budget_persist.py` + `test_256_producer_shell_site3.py` | **16 passed** |
| all four Phase-256 unit suites together | **30 passed** |
| `tests/integration/test_256_migration_182.py` | **8 passed** |
| `tests/integration/test_256_persist_restart.py` | **3 passed** |
| `tests/unit/test_scheduler_circuit_breaker.py` + `test_scheduler_breaker_seam.py` + `test_085_task_service.py` | **93 passed** (pre-reorder) |
| `tests/unit/test_scheduler_circuit_breaker.py` + `test_scheduler_breaker_seam.py` | **50 passed** (post-reorder) |
| `tests/test_harness_engine.py` — ⚠ `tests/`, **outside** the canonical gate | **61 passed** |

The 93-case run confirms RESEARCH A3/U-4: **no caller reads `absorb_usage_box`'s return**, so
widening it from `None` to `tuple[int, int]` broke nothing.

### 2. ⛔ THE BACKEND BASELINE — the SET, diffed both ways

**FINAL RESULT: the failing set is BYTE-IDENTICAL to the locked 71 names, in both `comm`
directions — `APPEARED` empty, `VANISHED` empty.**

```
71 failed, 4936 passed, 2 xfailed, 2 xpassed, 44 warnings in 221.25s
=== APPEARED:  (none)
=== VANISHED:  (none)
```

⚠ **THE COUNT OSCILLATED ON A BYTE-IDENTICAL TREE, AND ONLY THE SET SETTLED IT.** Four full-gate
runs were needed and all four are published, because the oscillation is the finding:

| Run | Tree | Count | Set diff |
|---|---|---|---|
| 1 | before the Fence-3 fix | **72** | `+1` — `test_256_finish_run_unchanged.py::test_the_finish_run_call_site_set_is_unchanged`, a **REAL** fire (see above) |
| 2 | after `7b5cbf419`, clean | **71** | not captured — **my error**, corrected by re-running |
| 3 | same tree as run 2, clean | **72** | `+1` — `test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments` |
| 4 | same tree, clean | **71** | **empty both ways** ✅ |

⚠ **Runs 3 and 4 were on a BYTE-IDENTICAL tree** (`git status --short` empty, HEAD `7b5cbf419` on
both) and read 72 then 71. The name that appeared in run 3, `test_email_ingestion.py::
test_ingest_email_populates_metadata_and_attachments`, **passes in isolation** (`1 passed`, exit 0)
and lies entirely outside this plan's diff — `git diff --name-only <base> HEAD` names ten files,
none of them email-related. **Recorded as an observation, not as proof of innocence:** one green
sample of a flaky case proves nothing, and the honest statement is *provably unmodified by this
plan*, not *fine*. This is the same flake class the v4.2 production push hit (72 then 71 on re-run).

⛔ **Run 2's count was kept and its set thrown away — the exact mistake this project has already
paid for once.** It is recorded rather than hidden, and it was corrected by a fourth captured run
rather than by trusting the number.

Method: `grep "^FAILED"` → strip the `FAILED ` prefix, the ` - …` reason tail, an interleaved
`RuntimeWarning` that pytest glued onto one line, and CRLF → `sort -u` → `comm -13` / `comm -23`.
⚠ A first attempt diffed **without stripping CRLF** and reported *every* name as both appeared and
vanished — a false alarm worth naming, because it looks catastrophic and means nothing.

### 3. The other gates

| Gate | Result |
|---|---|
| `node scripts/check-extension-contract.cjs` | ✅ **OK** — 6 closed-core trigger files, 0 violations. `TOKEN_COVERAGE_LEGS` is a DATA value written into a column; it resolves no writer, emitter, executor or validator. |
| `bash scripts/check-deploy-drift.sh` | ✅ **PASS** — 2 pre-existing non-blocking WARNs; 182 adds no env var and no seed row. |
| `node scripts/check-schema-acl-parity.cjs` | ✅ **OK** (verdict quoted verbatim above) |
| `backend/venv/Scripts/python scripts/check-greenfield-privileges.py` | ✅ **OK** (verdict quoted verbatim above) |
| `node scripts/check-hot-file-ledger.cjs 256` | ⚠ **EXIT 1**, and **`watched: 9`** — *not* vacuous (255's vacuous pass was `watched: 0`). Two `[no-row]`: `circuit_breaker.py` (this plan) and `forced_emit.py` (256-04). **Expected**: the plan states the `circuit_breaker.py` row is added by **256-02 in this same wave**, and the gate is phase-level, so it clears once 256-02 lands. ⛔ I did not touch `docs/HOT-FILE-LEDGER.md` — a sibling executor owns it. |
| Frontend `vitest-count-gate.cjs` | **DELIBERATELY NOT RUN.** This plan modifies zero files under `frontend/`, so it has no subject, and per D-256-14 the gate is non-deterministic at base — quoting `failed 0` as "green" would be false either way. |

### 4. Threat-model dispositions, checked rather than asserted

| Threat | Verdict |
|---|---|
| T-256-01 (SQL tampering) | `$1..$4` only; `grep -c '\$4'` 5 → 7; the f-string/`%s` count is unchanged at 6. A test asserts the statement contains none of `{`, `}`, `%s`, `' +`, `+ '`. |
| T-256-02 (RLS-bypassing pool) | `WHERE id = $1` is the whole boundary; a test asserts `thread_id` never appears in the statement. |
| T-256-03 (disclosure through a serializer) | `grep -rn "input_tokens\|output_tokens\|token_coverage" backend/app/models/ backend/app/api/workflows.py` → hits only in `models/eval_run.py` (a different table) and `models/user_settings.py` (max-output-tokens settings). **`api/workflows.py`: 0 hits.** 182 adds no route and no response model. |
| T-256-05 (overflow / negative) | Deltas are watermark-derived and `max(0, …)`-clamped **on the returned value**, driven by a backwards-box case. |
| T-256-06 (a run under-reporting) | The nullable DDL, the `(0,0)` no-op guard, the `.get()`-with-no-default rule, all pinned. |
| T-256-07 (log disclosure) | Identifier-only format string, asserted literally with a 400-char window scan for `tokens=` / `value=` / `usage_dict`. |
| T-256-SC (package legitimacy) | `git diff --numstat <base> HEAD -- backend/requirements.txt frontend/package.json` is **EMPTY**. No package installed; no checkpoint owed. |

---

## Deviations from Plan

### Auto-fixed

**1. [Rule 1 — Bug] Fence 3's `file:line` pin went stale inside its own plan**
- **Found during:** the full-gate run at the close of Task 3
- **Issue:** the plan specifies a `file:line` call-site set; this plan's own 38-line insertion above
  `harness_engine.py`'s three `finish_run` calls moved all three, producing a `+1` over the locked
  71-name ceiling.
- **Fix:** per-FILE call COUNTS asserted first (the real contract, stable under unrelated edits),
  the file:line set second with a message that distinguishes a line shift from a new caller. Both
  sets of line numbers recorded, neither overwriting the other.
- **Files:** `backend/tests/unit/test_256_finish_run_unchanged.py` · **Commit:** `7b5cbf419`

**2. [Rule 3 — Blocking] The migration's own prose could not contain `NOT NULL` or `DEFAULT`**
- The acceptance criteria require both greps to read `0`, including inside comments explaining why
  neither is used. Reworded to *"no nullability constraint here, and no zero fallback value"*.
- **Files:** `supabase/migrations/182_workflow_runs_token_totals.sql` · **Commit:** `af78fe54d`

**3. [Rule 3 — Blocking] `persist_run_usage` imported locally, not at module top**
- `harness_engine.py` already imports `load_run_budget` inside `run_workflow` under an explicit
  `# noqa: PLC0415 — module load-path rule`. The new import rides that same line rather than adding
  a top-level one. **Files:** `backend/app/services/harness_engine.py` · **Commit:** `801011259`

### Owed, not fixed

**4. `supabase/full-schema.sql` NOT regenerated** — two independent blockers, both measured. Full
detail in its own section above. **This is the plan's one unmet acceptance criterion.**

### Corrections recorded beside their originals (never over)

| Register | Said | Measured |
|---|---|---|
| D-256-05 / RESEARCH.md | `finish_run` has **7 call sites across 4 files** | **5 across 3** |
| `harness_engine.py:1826` | `harness/` had **two** `usage` references | **7 argument sites + 1 default parameter** |
| plan Task 3 | `_enforce_budget` branches **3 → 3** | **2 → 2** on an AST walk; unchanged on either convention |
| RESEARCH A1/U-2 · PATTERNS G-b | `@>` in an index predicate is `[ASSUMED]` | **ACCEPTED by Postgres — a new in-repo precedent** |

---

## Known Stubs

None. Every surface this plan touches is wired: the writer is called from the engine, the marker is
written from one constant, and the migration is applied.

---

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern and no new trust
boundary. The three new columns sit behind `workflow_runs`' four existing RLS policies, which a new
column inherits at the table level.

---

## Notes for plan 256-04

- `TOKEN_COVERAGE_LEGS` is `("agent", "single", "batch")`. Append `"emit"` **in the same commit as
  the forced-emit drain arms** (O-4), and update
  `test_256_persist_run_usage.py::test_token_coverage_legs_claims_only_the_legs_that_have_shipped`
  in that same commit — the assertion is written to be updated visibly rather than silently.
- The index predicate already names all four legs, so every run this phase writes correctly sits
  **inside** the incomplete-coverage index until `"emit"` ships. That is the marker being honest.
- `harness_engine.py:1837-1842`'s `llm_emit` comment is untouched and still reads `1`.

## Notes for plan 256-02

- `backend/app/services/circuit_breaker.py` still has **no ledger row**, and this plan modified it
  (`18 insertions, 3 deletions`). Re-derive the triple rather than copying: measured here at
  `1 commit / 1 phase / 331 lines` **before** this plan's edit.

---

## Self-Check: PASSED

All created files verified present on disk; all 8 commit hashes verified reachable from `HEAD`
(`af78fe54d`, `c388adf8c`, `a9cbca38e`, `ea36bddd0`, `01edb2d8f`, `801011259`, `f7f12ebbe`,
`7b5cbf419`). No `STATE.md` or `ROADMAP.md` modification — `git diff --name-only <base> HEAD`
names ten files and neither is among them.
