---
phase: 230
slug: the-durable-ingestion-queue
verdict: pass  # SC#1 driven; Defect B driven 2026-09-05 — no unexercised claim remains
verifier: claude
verifier_role: reviewer
method: driven — every figure below re-measured, none read from a claim
date: 2026-09-05
base_commit: e243a0142
head_commit: 43bf7ac70
blocking_findings: 0  # both closed and re-driven
corrections_owed: 0  # both closed at 43bf7ac70
independent_verifier_absent_for: []
sc1_driven: true  # RE-DRIVEN 2026-09-05 — PASSES
---

# Phase 230 — Reviewer Verification

> ⚠ **THIS SECTION IS THE FIRST PASS AND IS SUPERSEDED — read *Re-verification after `43bf7ac70`* at
> the bottom for the current verdict.** It is kept verbatim rather than rewritten, because what the
> findings WERE is the record of why the fixes exist.
>
> **Current verdict: PASS on every reviewer finding** (all four closed at `43bf7ac70`), with **SC#1's
> behavioural half still not driven** and two pre-existing gate problems routed away from this phase
> (BUS-114, BUS-117).
>
> **First-pass verdict was `revise`.** Two blocking findings, one correction owed, one criterion (SC#1)
> not yet driven. The queue's *mechanism* is sound and pre-flight G-1 is genuinely closed; what failed
> was the **paused** state the phase exists to introduce, which could not render.

⚠ **BUS-112 claimed completion in one sentence with no evidence and no `230-VERIFICATION.md`.**
Every figure in this file was re-measured by the reviewer. Where a number disagreed with a document,
the measurement is recorded and the document is corrected — never the reverse.

---

## 1. What passes — independently re-run

| Check | Command | Result |
|---|---|---|
| Backend unit baseline | `pytest tests/unit -q --continue-on-collection-errors` | **71 failed / 3526 passed / 2 xfailed / 2 xpassed / 0 collection errors** — at the ceiling, **+29 passing** vs Phase 229 |
| Phase 230's own suites | the 5 files named in `230-VALIDATION.md` | **28 passed** |
| Named-test existence | `--collect-only` | **11 tests collected**; every `-k` selector in the validation matrix resolves to a real test |
| Migration 153 **live in the DB** | `asyncpg` against `:54322` | table present · `relrowsecurity = true` · 4 indexes incl. `idx_ingestion_jobs_stale` · **0 job rows** |
| Ingestion baseline | same | **77 completed documents, 0 pending/processing/failed** — any stuck row after this phase is provably its own |
| CLAUDE.md size gate | `node scripts/check-claude-md-size.cjs` | **107,501 chars**, OK |
| Deploy drift | `bash scripts/check-deploy-drift.sh` | **PASS, 0 drift** |

### ⭐ Pre-flight G-1 is genuinely closed — the finding that mattered

The pre-flight's blocking G-1 was *"`claimed_at` is written and never read; SC#1 has no mechanism."*
It now has one, and it is **wired**, not merely written:

- `reclaim_stale_ingestion_claims()` exists in `backend/app/db/ingestion_jobs.py` and **reads**
  `claimed_at`.
- `backend/app/main.py` lifespan calls `await _ingestion_queue.run_stale_sweep()` **before**
  `_ingestion_queue.start()` — a boot-time sweep, which is the correct ordering for restart survival.
- `idx_ingestion_jobs_stale ON (status, claimed_at) WHERE status = 'processing'` backs it, and is
  live in the database.

**This is the structural half of SC#1 and it is satisfied.** The behavioural half is not yet driven —
see §5.

---

## 2. ⛔ BLOCKING 1 — the paused pipeline strip renders nothing

**The state this phase exists to introduce is the one state the UI cannot draw.**

Phase 230 widened the status union at `frontend/src/types/index.ts:513`:

```diff
-  status: "pending" | "processing" | "completed" | "failed"
+  status: "pending" | "processing" | "completed" | "failed" | "paused"
```

`segmentState()` at `frontend/src/components/ingestion/IngestionStrip.tsx:90` is an **exhaustive
`switch (doc.status)` with no `paused` arm and no `default`**. TypeScript flags it:

```
src/components/ingestion/IngestionStrip.tsx(94,4): error TS2366:
  Function lacks ending return statement and return type does not include 'undefined'.
```

**Runtime consequence, traced through the render path:**

1. `segmentState(...)` falls through → returns `undefined`
2. `SEGMENT_CLASS[undefined]` (`IngestionStrip.tsx:153`) → `undefined`
3. `data-state={state}` → the attribute is omitted

So **every segment of the six-stage strip renders with no state class and no `data-state`** for a
paused document. It is mounted for in-flight rows at `DocumentRow.tsx:394`.

⚠ **`IngestionStrip.tsx` is byte-unchanged by this phase** — the break is remote, caused by the type
widening. That is exactly why a widened union needs its arms swept, not just its writers.

**Fix:** add a `paused` arm to `segmentState()`. It is a real design decision, not a cast — a paused
document has genuinely reached some stages, so the honest rendering is most likely `done` up to
`ingestion_step` and `pending` after, i.e. the `processing` arm without the `active` pulse. **Do not
silence this with a `default` that returns `"pending"`** — that would claim no stage completed.

---

## 3. ⛔ BLOCKING 2 — the count gate is red, and one failure is new

```
total 7435  ·  failed 3  ·  pinned total 6702
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 3 test(s) failed — the gate requires 0.
```

Per the SEED-171 procedure, filenames were taken from the gate's **own persisted JSON report before
any re-run**, then each was classified by running it in a worktree at the base commit `e243a0142`.

| Failing test | Base-commit result | Verdict |
|---|---|---|
| `src/pages/__tests__/LibraryPage.test.tsx › the Ingestion tab MOUNTS the stage strip for an in-flight document` | **PASSES** | ⛔ **NEW — Phase 230's** |
| `src/components/ingestion/__tests__/IngestionStrip.test.tsx › non-vacuity 3/3 — EXACTLY six distinct ingestion_step writes` | **FAILS identically** | ℹ️ inherited, not this phase's |
| `src/components/ingestion/__tests__/IngestionStrip.test.tsx › ⭐ the six stages are in the backend's WRITE ORDER` | **FAILS identically** | ℹ️ inherited, not this phase's |

⚠ **None of the three is a SEED-171 flake.** All are deterministic, and none is one of SEED-171's five
cap-independent suites. The cap was **not** adjusted and did not need to be.

### 3a. The new one

```
TestingLibraryElementError: Found multiple elements with the text: in-flight.pdf
```

`IngestionBatchLane` renders the active file name (`IngestionBatchLane.tsx:11` — *"Active file name
being embedded"*) directly above a queue row that already displays it, so the filename now appears
**twice** in the Ingestion tab. `LibraryPage.test.tsx` is **byte-unchanged** by this phase.

⭐ **This is worth a design answer, not only a test fix.** Sketch 227 variant B mounts the lane *above
rows already in Ingestion › In progress*. Whether the lane should repeat the filename of a row
directly beneath it is an operator-visible question. Resolve the duplication in the UI, then update
the assertion — **not** the reverse.

### 3b. The inherited two — and why nobody caught them

`IngestionStrip.test.tsx:39` imports **live backend source**:

```ts
import documentsPySource from "../../../../../backend/app/api/documents.py?raw"
```

It asserts the frontend's six-stage list matches every `"ingestion_step": "<name>"` write in
`documents.py`. That file currently contains **seven** distinct writes — `chunking`, `embedding`,
`extracting`, `extracting_images`, `extracting_tables`, `failed`, `metadata` — and has since **before
`bec877152`** (Phase 229's commit). Measured at four revisions; the count is 7 at all of them.

⚠ **THE METHODOLOGY FINDING.** `229-VERIFICATION.md` recorded: *"frontend untouched
(`git diff --numstat`), so the vitest gate cannot be affected — deliberately not run rather than
skipped."* **That inference is unsound in this repo**, because `?raw` fences make a backend-only diff
able to turn the frontend gate red. The fence was already red when that sentence was written.

**Not Phase 230's to fix**, but it must be routed rather than left silent — it means the count gate
has been unreachable-green across at least two phase closes.

---

## 4. ⚠ Corrections owed

### 4a. `tsc` regressed 66 → 68, both errors this phase's

The baseline was **not** taken on trust. Measured in a worktree at `e243a0142` with the same command
Phase 228 used (`tsc -p tsconfig.app.json`): **exactly 66**. At HEAD: **68**.

```
NEW (in HEAD, not in base):
  src/components/ingestion/IngestionStrip.tsx(94,4): error TS2366   ← §2, the blocking one
  src/components/ingestion/__tests__/IngestionBatchLane.test.tsx(38,11): error TS6133:
      'container' is declared but its value is never read.
FIXED (in base, not in HEAD): (none)
```

Worktree torn down with `scripts/teardown-worktree.sh`; source `venv` and `node_modules` asserted
intact.

⚠ **Do not measure this with `npx tsc --noEmit` alone** — `frontend/tsconfig.json` is a solution file
(`"files": []`, references only), so that command reports **0 errors while checking zero files**.

### 4b. SC#2's "max 3 concurrent jobs" is per-process, not global

`backend/app/config.py` — Phase 230's own knob, whose comment is honest:

```python
# Concurrency limit per worker process (asyncio.Semaphore).
ingest_max_concurrent_jobs: int = 3
```

`asyncio.Semaphore` is per-process, and **`WORKER_COUNT=2` is the default** (`backend/.env.example:76`,
and multi-worker uvicorn is the documented default per D-PRD-12). **The shipped global cap is
therefore 6, not 3.**

`230-VALIDATION.md` states SC#2 as *"under semaphore cap (max 3 concurrent jobs)"*, and
`test_concurrency_bounding_with_semaphore` exercises a single service instance — so both the criterion
and its test read as a global guarantee the code does not make. **This cap is what protects against
provider 429s (QUEUE-05), so the gap is not cosmetic.**

**Choose one and say which:** (a) restate SC#2 as a per-worker cap and set the default to
`ceil(target / WORKER_COUNT)`, or (b) make the bound global by claiming against the table — the
`FOR UPDATE SKIP LOCKED` claim already gives you a cross-process mechanism.

---

## 5. Not driven — SC#1's behavioural half

**SC#1 (survive a restart) has NOT been driven end-to-end**, and this file does not claim it has.
`test_lost_worker_crash_recovery` proves the sweeper's logic; it does not prove a real uvicorn restart
mid-batch leaves zero rows stranded. Killing the operator's running backend is disruptive and was not
done unilaterally.

⭐ **Conditions for the drive are ideal right now and will not stay that way:** the dev DB holds
**77 completed / 0 jobs**, so **any row left in `processing` after the drive is provably this phase's**.

**The drive, when authorised:** upload a multi-file batch → kill uvicorn mid-flight → restart → assert
every document reaches `completed` and `select count(*) from ingestion_jobs where status='processing'`
is 0.

---

## 6. Verdict

| # | Finding | Severity | Owner |
|---|---|---|---|
| 1 | `paused` has no arm in `segmentState()`; the strip renders unstyled for the state this phase adds | ⛔ blocking | gemini |
| 2 | `LibraryPage.test.tsx` fails — batch lane duplicates the filename of the row beneath it | ⛔ blocking | gemini |
| 3 | `tsc` 66 → 68 (both this phase's; one is finding 1) | ⚠ correction | gemini |
| 4 | SC#2's concurrency cap is per-worker; shipped global cap is 6, not 3 | ⚠ correction | gemini |
| 5 | `IngestionStrip` ordered fence red since before Phase 229 — inherited, and it makes the gate unreachable-green | ℹ️ route it | operator |
| 6 | SC#1 not driven end-to-end | ⏸ owed | claude, on operator go-ahead |

**Findings 1–4 must close before Phase 230 can be verified.** Finding 1 is the one that matters: the
phase's headline user-visible state currently renders as nothing.


---

# Re-verification after `43bf7ac70` (2026-09-05, Claude — DRIVEN)

**All four findings CLOSE.** Re-measured, not read from BUS-115's claim.

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | `paused` had no arm in `segmentState()` | ✅ **closed** | arm added at `IngestionStrip.tsx:118`; returns `done` up to `ingestion_step` and `pending` after, **with no `active` pulse** — the honest rendering, not a `default` that would claim no stage completed |
| 2 | `LibraryPage.test.tsx` — batch lane duplicated the filename | ✅ **closed** | count gate **3 → 2 failures**; the LibraryPage failure is gone |
| 3 | `tsc` 66 → 68 | ✅ **closed** | **exactly 66**, and `comm` against the base error set is **empty in both directions** — nothing new, nothing silenced |
| 4 | SC#2's cap was per-process | ✅ **closed** | now a genuine **global** bound (below) |

### Finding 4's fix is the right shape — option (b), and it holds up

`claim_due_ingestion_jobs` takes `pg_advisory_xact_lock(4230230)`, counts live `status='processing'`
rows, and claims only up to the remaining global slots. That is a real cross-process bound, not a
restatement.

⭐ **The failure mode I went looking for is already handled.** A global cap counted from
`status='processing'` can be permanently consumed by rows belonging to a **dead** worker — the queue
would then stall until a restart. It does not, because `ingestion_queue_service.py:171` re-runs
`run_stale_sweep()` **every 60 s inside the tick loop**, not only at boot. Worst case a slot is held
for `lease_timeout_seconds` (300) + 60, then reclaimed.

### The deletion in finding 2 was checked against the locked sketch, not just the test

The fix removed `activeFileName` from `IngestionBatchLane` entirely. **That is correct, not lossy:**
`.planning/sketches/227-the-paused-queue-and-its-refusal/README.md` never specifies naming the active
file — the row was an addition beyond locked variant B. Removing it **restores** sketch fidelity.
⚠ Recorded because "fix the duplication" could equally have been satisfied by deleting the wrong half.

### Gates re-run

| Gate | Result |
|---|---|
| Phase 230's 5 suites | **30 passed** (+2 — the new global-bound tests) |
| `tsc -p tsconfig.app.json` | **66**, zero delta vs base |
| vitest count gate | total 7435 · **failed 2** — both the *inherited* `IngestionStrip` fence failures (BUS-114). Phase 230's own failure is gone. |
| backend unit | **72 failed / 3527 passed / 0 collection errors** — see the correction below |

---

## ⚠ CORRECTION TO THIS FILE'S OWN FIRST PASS — the backend baseline is NOT deterministic

**§1 above recorded `71 failed / 3526 passed` and presented it as the measurement. That number does
not reproduce, and the original is kept rather than overwritten because the instability is the
finding.**

Measured three further times, failure lists captured and diffed rather than counted:

| Run | Tree | Result |
|---|---|---|
| 1 (§1 above) | `010bc2f71` | **71 failed** |
| 2 | `43bf7ac70` (HEAD) | **72 failed** |
| 3 | `010bc2f71` in a worktree — **the same commit as run 1** | **72 failed** |
| 4 | `43bf7ac70` (HEAD) | **72 failed** |

⭐ **`comm` on the run-3 and run-4 failure lists is EMPTY IN BOTH DIRECTIONS — the failure SETS are
identical.** So **`43bf7ac70` introduced no backend regression**; runs 1 and 3 differ on byte-identical
code.

**The unstable test is `tests/unit/test_cross_worker_cancellation.py::test_a_late_producer_finalize_may_not_write_failed_over_a_cancel`**, and its mechanism is visible in the report:

```
_pytest/unraisableexception.py:33: RuntimeWarning:
    coroutine 'handle_query_tables' was never awaited
```

An unraisable warning is surfaced at **garbage-collection time** and attributed to whichever test is
running when GC fires — so it is order- and timing-dependent by construction. Confirmed: the file
passes **28/28 in isolation on three consecutive runs**, and fails only inside the full suite.

⛔ **CONSEQUENCE FOR THE GATE, not just for this phase.** `CLAUDE.md` fixes the ceiling at
**`failed <= 71` with explicitly zero headroom**. A baseline that oscillates 71↔72 on an unchanged tree
means **the gate can fail on a clean checkout, and a phase can be blamed for a flake it did not
cause.** This phase came within one GC timing of exactly that. The ceiling needs either the flake fixed
(`handle_query_tables` awaited or its warning filtered) or the ceiling restated as 72 — **an operator
decision, since CLAUDE.md forbids weakening it without authorisation.** Routed on **BUS-117**.

---

## Verdict after re-verification

**PASS on everything the reviewer raised.** Two items remain, neither of them Phase 230's defect:

1. ⏸ **SC#1's behavioural half is still NOT driven** — no real restart mid-batch has been performed.
   The phase cannot be called verified against its headline criterion until it is. Conditions remain
   ideal (**77 completed / 0 job rows**).
2. ℹ️ **The inherited `IngestionStrip` fence** keeps the count gate at `failed 2` (BUS-114), and the
   **backend baseline flake** keeps it at 72 (BUS-117). Both predate this phase; both must be routed
   rather than absorbed into it.


---

# SC#1 DRIVEN — 2026-09-05 — ⛔ **IT FAILS**

**Operator authorised the drive. The backend was killed mid-batch for real. SC#1 does not hold, and
two new blocking defects were found that every unit test in this phase passes over.**

## What was done

| Step | Detail |
|---|---|
| Pre-state | **77 completed documents, 0 ingestion_jobs** — a provably clean slate |
| Auth | a throwaway user (`sc1drive+230@example.com`) via the Admin API — the operator's own account was never used |
| Batch | 20 files × 290 KB (~5.6 MB) of chunkable text, uploaded over HTTP to the real `POST /documents/upload` |
| Kill | `Stop-Process -Force` on the **whole uvicorn tree** while **2 jobs sat in `status='processing'`** (`0eee828a` at `chunks_embedded`, `ad0524ac` at `tables_embedded`), then confirmed **port 8000 FREE** |
| Restart | same command the operator was running (`uvicorn app.main:app --reload`) |
| Observation | polled the queue every 10 s until it drained |

⚠ A first attempt with 12 small files was **discarded as inconclusive** — the queue drained faster than
the kill could land. The bigger batch is what made the restart land inside real work.

## What happened

```
[t+200s] {'completed': 18, 'processing': 2}
        processing 0eee828a chunks_embedded  by worker-4e185278 age=313s  <-- DEAD WORKER
        processing ad0524ac tables_embedded  by worker-4e185278 age=288s  <-- DEAD WORKER
[t+210s] {'completed': 18, 'failed': 1, 'processing': 1}
[t+270s] {'completed': 18, 'failed': 2}

QUEUE DRAINED at t+270s
jobs: {'failed': 2, 'completed': 18}   ·   stuck in processing: 0   ·   retry_count>0: 2
sc2 docs: {'completed': 6, 'processing': 2}
```

✅ **The sweeper itself WORKS.** Both dead-worker claims were reclaimed the moment their `claimed_at`
crossed the 300 s lease — visible in the age column at reclaim. G-1's mechanism is real.

⛔ **But the reclaimed files never completed. They were retried and FAILED — twice each.**
Of 8 accepted uploads, **6 completed and the 2 that were in flight at the kill failed.**
SC#1 requires *"completes all files"*. **It does not.**

⛔ **And the documents are STILL `processing`, permanently.**

```
doc 68d5f8b4 sc2_01.txt  status=processing  step=embedding  err=None   (job failed, retry 2/3)
doc 750708df sc2_03.txt  status=processing  step=embedding  err=None   (job failed, retry 2/3)
```

SC#1's own words are *"zero files stuck in processing."* The **jobs** table is clean; the **documents**
table is not. The user-visible Library shows two files ingesting forever, with no error.

---

## ⛔ DEFECT A — `progress` is corrupt on every job, and it breaks resumption

```
last_error : 'list' object has no attribute 'get'
error_type : AttributeError
```

`splice_document` (`ingest_splice.py:289-290`) resumes with:

```python
prog = progress or initial_progress or {}
chunk_offset = int(prog.get("chunk_offset", 0))
```

`progress` comes back as a **list**. Read straight from the database:

```
2d74df17 completed  pgtype=jsonb  pytype=str
  value='[{}, "{\"chunk_offset\": 0}", "{\"chunk_offset\": 0}"]'
40094203 completed  pgtype=jsonb  pytype=str
  value='[{}, "{\"chunk_offset\": 0}", ..., "{\"chunk_offset\": 50}", "{\"chunk_offset\": 100}", ...]'
```

**The cause is one line** — `update_job_progress` (`backend/app/db/ingestion_jobs.py`):

```sql
progress = progress || $3::jsonb        --  $3 is bound as a Python str
```

The parameter lands as a jsonb **string scalar**, not an object. In Postgres, `jsonb || <scalar>`
promotes **both operands to arrays and concatenates** — so every update *appends* instead of merging,
and the checkpoint becomes an ever-growing array of JSON strings.

⚠ **THIS IS THE FIFTH TIME THIS PROJECT HAS HIT THE jsonb STRING-SCALAR TRAP.** The register already
records four columns with the same defect (`workflow_phases.output` was the fourth, and it silently
killed Phase 200's per-step count). **The docstring says "Merge … into ingestion_jobs.progress" and the
SQL does not merge.**

**Consequences beyond the restart:**
- **SC#4 (checkpointed resumption) is non-functional**, not merely untested. `chunk_offset` is never
  read back successfully — the only path that reads it crashes.
- **The corruption is universal, not restart-specific.** *Every* completed job above carries the same
  malformed array. It is silent until something reads it.

⭐ **Why the whole suite missed it:** the unit tests pass a real `dict` into `splice_document` directly
and never round-trip `progress` through Postgres. **The one thing the DB round-trip changes is the one
thing that breaks.** A green `test_checkpointed_chunk_resumption` proves the arithmetic, not the column.

**Fix:** bind the patch so it lands as an object — `progress || $3::text::jsonb`, or register a jsonb
codec on the pool. Then **assert the round-tripped type**, not just the value: a test that reads
`progress` back from the database and asserts `isinstance(prog, dict)` is the guard that was missing.

---

## ⛔ DEFECT B — a permanently failed job never marks its document failed

`backend/app/db/ingestion_jobs.py` contains **zero references to `documents`** — verified by grep. So
when `record_job_failure` gives up, it writes `ingestion_jobs.status='failed'` and **nothing** updates
`documents.status`. The row keeps whatever the pipeline last set (`processing`, `ingestion_step='embedding'`)
and `error_message` stays `NULL`.

**User-visible result: a file that will never finish, presented as still working, with no error.** That
is the exact condition SC#1 forbids, and it is independent of Defect A — *any* permanent job failure
produces it.

⚠ **It also defeats this phase's own paused/refusal UI.** `DocumentStatusBadge` and the strip can only
render what `documents.status` says; a failed job that leaves the document `processing` can never
surface as failed no matter how good the component is.

**Fix:** `record_job_failure` must write the document terminal state in the **same transaction** as the
job's, and carry `last_error` into `documents.error_message`.

---

## Verdict

**SC#1 is NOT met. Phase 230 returns to `revise`.**

| # | Finding | Severity |
|---|---|---|
| A | `progress` written as a jsonb string-scalar, appended not merged; resumption crashes with `AttributeError`. SC#4 non-functional. **5th occurrence of a known trap.** | ⛔ blocking |
| B | A permanently failed job leaves `documents.status='processing'` with a NULL error, forever | ⛔ blocking |

⭐ **What this drive proves about method, and it is the reason it was insisted on:** every gate was
green. 30/30 phase tests, 66 tsc, drift 0, migration live, sweeper wired, `test_lost_worker_crash_recovery`
passing. **The headline criterion still failed the first time a real process was killed.** The
structural half of SC#1 (G-1) was genuinely closed; the behavioural half was never true.

**Re-drive after the fix** — the recipe is in *What was done* above, and the same clean-slate condition
can be recreated by deleting the test rows.


---

# SC#1 RE-DRIVEN after the defect fixes — ✅ **IT PASSES**

Same recipe as the failing drive: clean slate (**77 completed docs, 0 jobs**), throwaway user, 20 × 290 KB
files, **whole uvicorn tree hard-killed with a job in `status='processing'`**, restart, poll to drain.

## The moment that decides it

```
[t+290s] {'completed': 13, 'processing': 1}
        processing 666eb08d tables_embedded  by worker-d6a747c3 age=343s   <- dead worker, past the 300s lease
[t+300s] {'completed': 13, 'processing': 1}
        processing 666eb08d chunks_embedded  by worker-aa1ca16a age=9s     <- RECLAIMED by a NEW worker
[t+310s] {'completed': 14}

QUEUE DRAINED at t+310s
jobs: {'completed': 14}   ·   stuck in processing: 0   ·   retry_count>0: 1
```

⭐ **Read the stage column across the reclaim: `tables_embedded` → `chunks_embedded`.** The job did not
restart from zero — **it resumed from its checkpoint**, which is the behaviour that was impossible before,
because reading the checkpoint is exactly what used to raise `AttributeError`.

⭐ **Zero failed.** In the failing drive the two in-flight jobs went `failed` and their documents were
stranded at `processing` forever. This time the in-flight job **completed**.

## Defect A — fixed, and proven at the strongest available level

```
=== the reclaimed job's progress ===
  job 666eb08d retry=1 jsonb_typeof=object
    progress = {"chunk_offset": 450}

=== ALL job progress types ===
  object: 14
```

**`jsonb_typeof` is `object` on all 14 jobs** — previously it was a string-scalar array on every row.
And the reclaimed job carries a real `{"chunk_offset": 450}`, so **SC#4 checkpointed resumption is
functional for the first time**, not merely untested.

⭐ **Gemini's fix is better than the one the review asked for.** I recommended `$n::text::jsonb`; the
shipped fix is that **plus a self-healing `CASE`** that coerces an already-corrupt non-object `progress`
back to `{}` before merging. So **existing corrupt rows heal on their next write** rather than only new
rows being correct — the review named the leak, the builder also drained the pool.

## ⚠ Defect B is present in code but was NOT EXERCISED by this drive

`ingestion_jobs.py` now updates `documents` at two sites (lease exhaustion `:175`, permanent failure
`:341`), where it previously referenced `documents` zero times. **But zero jobs failed in this run**, so
the failure→document-status path never executed.

**Recorded as unexercised, never as verified.** The fix is structurally present and correct on reading;
it has not been observed running. A drive that forces a permanent failure would close this.

## ⚠ NEW, MINOR — a document can be minted with no job, and is then orphaned

```
sc2_02.txt   doc=pending   step=None   *** NO JOB ROW ***
```

The kill landed **between** minting the `documents` row and enqueueing its `ingestion_jobs` row, so the
document exists with nothing that will ever process it. **Mint-then-enqueue is not atomic.**

✅ **This does NOT block SC#1**, and the reason is measured rather than argued: the client received
`ConnectionResetError` for `sc2_02` — **it was never accepted**. Of the **14 uploads that returned 201,
all 14 completed.** SC#1's *"completes all files"* is satisfied for every file the user was told was taken.

⚠ **But it is a real Library-hygiene defect**: a document sits at `pending` forever, visible, with nothing
to advance it. It is the inbound twin of Defect B — *"a row whose worker never comes"* rather than *"a row
whose worker gave up"*. **Filed rather than fixed**; the natural home is the same transaction boundary
Defect B's fix already established.

## Verdict

| Criterion | Result |
|---|---|
| **SC#1** — batch survives restart, all files complete, zero stuck in `processing` | ✅ **PASS, driven** |
| **SC#4** — checkpointed resumption | ✅ **PASS** — resumed at `chunk_offset: 450`, stage `tables_embedded` → `chunks_embedded` |
| Defect A — jsonb string-scalar | ✅ **fixed, proven** (`jsonb_typeof = object` × 14) |
| Defect B — failed job leaves document `processing` | ⚠ **fixed in code, NOT exercised** — no job failed this run |
| Orphaned document (no job row) | ⚠ **new, minor** — does not block SC#1; filed |

**Phase 230's blocking findings are all closed.** What remains against this phase is the unexercised
Defect B path and one minor new hygiene defect — plus the two pre-existing gate problems routed away from
this phase (BUS-114 inherited fence, BUS-117 backend baseline flake).


---

# Defect B — DRIVEN 2026-09-05, and it PASSES

The SC#1 re-drive left exactly one honest gap: **zero jobs failed, so the failure→document path was
never observed running.** This file recorded that as *implemented, not exercised*, with a re-open
trigger. **The trigger has now been executed rather than left standing.**

**Method.** A probe document (`status='processing'`, `ingestion_step='embedding'`) and its job were
inserted with `retry_count = max_retries - 1`, so the next failure could only be **permanent** rather
than another retry. `record_job_failure(..., is_transient=True)` was then called against the real
`asyncpg` pool — the production function, not a stub.

```
BEFORE  doc.status='processing'  error_message=None
record_job_failure returned: 'failed'
AFTER   job.status='failed' retry=3
AFTER   doc.status='failed'  error_message='defect B probe — forced permanent failure'
```

✅ **The document followed the job**, and `error_message` carried through — so a permanently failed
ingestion is now visible as failed in the Library instead of sitting at `processing` forever, which
is the defect the SC#1 drive originally exposed.

Probe rows deleted; the corpus is back to **77 completed / 0 ingestion_jobs**.

## What remains against Phase 230 — and none of it is an unexercised claim

| Item | State |
|---|---|
| SC#1 restart survival | ✅ driven |
| SC#4 checkpointed resumption | ✅ driven (`chunk_offset: 450`) |
| Defect A — jsonb string scalar | ✅ driven |
| Defect B — document follows the job | ✅ **driven (this section)** |
| Orphaned document (mint-then-enqueue not atomic) | ⚠ minor, filed, does not block SC#1 |
| `BUS-114` inherited fence · `BUS-117` baseline flake | ⛔ **operator decisions, not this phase's** |
