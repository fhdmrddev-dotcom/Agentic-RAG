---
phase: 230
slug: the-durable-ingestion-queue
verdict: revise
verifier: claude
verifier_role: reviewer
method: driven — every figure below re-measured, none read from a claim
date: 2026-09-05
base_commit: e243a0142
head_commit: 010bc2f71
blocking_findings: 2
corrections_owed: 1
independent_verifier_absent_for: []
sc1_driven: false
---

# Phase 230 — Reviewer Verification

> **Verdict: `revise`.** Two blocking findings, one correction owed, one criterion (SC#1) not yet
> driven. The queue's *mechanism* is sound and pre-flight G-1 is genuinely closed; what fails is the
> **paused** state the phase exists to introduce, which currently cannot render.

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
