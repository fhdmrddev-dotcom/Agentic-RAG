---
phase: 256-every-token-is-counted-and-kept
reviewed: 2026-09-19T00:00:00Z
depth: standard
diff_base: 772f53354
diff_head: 6b3d3a59e
files_reviewed: 10
files_reviewed_list:
  - backend/app/db/workflows.py
  - backend/app/services/circuit_breaker.py
  - backend/app/services/harness_engine.py
  - backend/app/api/runs.py
  - backend/app/services/harness/publish_service.py
  - backend/app/services/scheduler_service.py
  - backend/app/services/eval_runner_service.py
  - backend/app/services/forced_emit.py
  - backend/app/services/harness/phase_types.py
  - supabase/migrations/182_workflow_runs_token_totals.sql
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 256: Code Review Report

**Reviewed:** 2026-09-19
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The six invariants the brief names were each checked against the files as they stand at
`6b3d3a59e`, and **five of the six hold**:

- `persist_run_usage` really does ADD (`db/workflows.py:2116-2126`, `COALESCE(col,0) + $2/$3`),
  never SET — verified in the statement text, not in a SUMMARY.
- `absorb_usage_box` really does clamp its returned delta (`circuit_breaker.py:176-177`,
  `max(0, …)` on both), and it has **exactly one** caller in `backend/app`
  (`harness_engine.py:1928`), which tuple-unpacks. The `None → (0,0)` widening cannot have
  changed a truthiness test anywhere, because no boolean test on it exists.
- Idempotency against the twice-per-phase drive is real, and it is real for the stated reason:
  the delta is watermark-derived, so the second call in a phase yields `(0,0)` and
  `persist_run_usage`'s first line returns before touching the database.
- No `COALESCE(..., 0)` exists on any READ side — because no read side exists yet at all
  (`grep input_tokens backend/app` returns writers and accumulators only).
- No cross-table sum and no un-narrowed `runs` aggregation exists anywhere in `backend/app` or in
  `supabase/migrations/`. Fence 1 guards the future one.
- The reorder above the `armed` guard is behaviour-preserving for the trip, by the arithmetic the
  plan claims: `check_limits` (`circuit_breaker.py:191-205`) guards both arms on `is not None`, and
  `breaker` is read nowhere else in `harness_engine.py` except inside `_enforce_budget` and at
  `:2124` (`duration_watch`). SQL is `$1..$4` parameterised throughout; no injection surface.

**The sixth invariant does not hold, and it is the headline finding.** `token_coverage` is claimed
as a three-state column, but the middle state is unreachable, and — more seriously — the *populated*
state over-claims: it asserts complete four-leg coverage on runs whose in-run judge validator spend
is measured and then dropped (CR-02).

And underneath the invariants, the durability property SC#1 is bought at the phase boundary only:
**three ordinary, non-exceptional exits from the phase loop return without ever reaching the
persist**, so the last executed phase's spend is lost from `workflow_runs` permanently (CR-01). One
of those exits is the human-gate pause — a first-class shipped feature and the same feature METER-05
site 1 exists to serve.

---

## Critical Issues

### CR-01: A paused, failed or dangling-skip run loses its last phase's spend from `workflow_runs`, permanently and silently

**File:** `backend/app/services/harness_engine.py:2308`, `:2336`, `:2377` (returns) vs `:2605` (the persist)

**Issue:**
The only site that persists to `workflow_runs` is `_enforce_budget` (`harness_engine.py:1928-1930`),
called at exactly two places: `:2036` (`phase_boundary`, at the TOP of the loop body, **before** the
phase runs) and `:2605` (`phase_completed`, at the BOTTOM).

Three ordinary control-flow `return`s sit between the phase's execution and `:2605`:

| line | outcome | when |
|---|---|---|
| `2308` | `pause_run` | a human gate elapsed unanswered — `PhaseOutcome("pause_run", …)` raised at `:1114` **after** `_execute_phase` ran and spent tokens |
| `2336` | `fail_run` | a phase exhausted its gate retries — i.e. the phase that ran the LLM **several times** |
| `2377` | dangling skip target | `skip_to_phase` names a slug that is not in the run |

Each returns from `run_workflow` without absorbing the phase that just ran. The spend is sitting in
`ctx.run_usage_box` at that moment, and the breaker's watermark has not moved, so nothing has been
written for it.

It is then **unrecoverable**, because the next segment starts clean on both halves:
`ctx` is rebuilt by `_build_resume_context` (`harness_engine.py:2905`) or as a fresh `SimpleNamespace`
(`api/runs.py:1296`), `run_workflow` sets `ctx.run_usage_box = {}` at `harness_engine.py:1884`, and a
brand-new `CircuitBreaker` starts at `input_tokens = 0` (`circuit_breaker.py:117`). Nothing reads the
column back to re-seed anything.

Failure scenario, concrete: a two-phase workflow whose phase 1 is an `llm_agent` that calls
`ask_user`. Phase 1 burns 40 k tokens, the person steps away, the gate elapses, `:2308` returns. The
person answers an hour later; the re-drive re-runs phase 1 (another 40 k) and completes.
`workflow_runs.input_tokens` records **one** of those two segments. Phase 257 prices the run at half.
The `runs` producer shell does keep the lost segment (METER-05 sites 1/3 now write it) — but
D-256-03 explicitly forbids summing across `runs` and `workflow_runs`, and names `workflow_runs` as
authoritative for a harness run, so there is no legitimate read that recovers it.

`fail_run` is the worse arm of the two, for the reason D-256-12 already argues one layer down: a
phase reaches `fail_run` only after `_run_phase_with_gates` has exhausted its retries, so it is
precisely the most expensive phase whose spend is dropped — the same "under-report exactly the runs
that cost the most, invisibly" shape the phase forbids in `forced_emit`.

(The cancel brake at `:2021` is **not** affected — it returns before any phase work, and the previous
phase's delta was already persisted at `:2605`. That arm was checked and is clean.)

**Fix:** persist before every non-linear exit, not only at the loop bottom. The cheapest shape that
adds no new branch to `_enforce_budget` itself is a dedicated flush at the three returns:

```python
# harness_engine.py — before each of the three returns at :2308 / :2336 / :2377
_d_in, _d_out = breaker.absorb_usage_box(getattr(ctx, "run_usage_box", None))
await persist_run_usage(pool, run_id, input_delta=_d_in, output_delta=_d_out)
```

or, equivalently and with one site instead of three, wrap the `while` loop in
`try: … finally:` and put the same two lines in the `finally` (the persist is already idempotent
against repetition by its own watermark derivation, so a `finally` that runs after `:2605` writes
nothing). Whichever is chosen, drive it RED: a test that pauses on a human gate and asserts
`workflow_runs.input_tokens` is non-NULL fails against the code as it stands.

---

### CR-02: `token_coverage` claims complete four-leg coverage on runs whose in-run judge spend is measured and then discarded

**File:** `backend/app/db/workflows.py:94` (`TOKEN_COVERAGE_LEGS`) · `backend/app/services/harness/validator_kinds.py:592` · `backend/app/services/harness/publish_service.py:1779` · `supabase/migrations/182_workflow_runs_token_totals.sql:82-85`

**Issue:**
Plan 256-04 made `forced_emit._drain` return `(…, input_tokens, output_tokens)`
(`forced_emit.py:699-705`) and `forced_emit()` carry ladder totals on both exits
(`forced_emit.py:566-569`, `:584-587`). Exactly **one** of the ten `forced_emit` call sites in
`backend/app` consumes them — `phase_types.py:1586`. The other nine drop the tuple on the floor, and
**two of those nine run inside a harness run whose `workflow_runs` row this phase writes**:

- `validator_kinds.py:592` — `_validate_llm_judge_rubric`, a registered in-run validator
  (`@register_validator("llm_judge_rubric")`, `:513`) that fires on any phase configuring it. Real
  provider call, real key, `ctx` in scope, spend discarded.
- `publish_service.py:1779` — the publish-gauntlet judge, in a `for _attempt in range(3)` loop, so up
  to three billed shots per publish, all discarded.

That under-count is pre-existing. What is **new in this phase**, and what makes it a defect rather
than a known gap, is the claim laid on top of it: `persist_run_usage` writes
`token_coverage = ('agent','single','batch','emit')` — the complete set — on every run that persists
any delta (`db/workflows.py:2120`, `:2125`). Migration 182's partial index
(`182_workflow_runs_token_totals.sql:82-85`) then classifies that run as **fully covered** and
excludes it from `idx_workflow_runs_org_coverage_incomplete`, which is the exact access path
D-256-07 built for Phase 257's *"what it cannot see"* view. So a run with uncounted judge spend is
invisible to the one mechanism designed to surface uncounted spend — the failure SC#4 exists to
prevent, reproduced by the marker itself.

`SEED-300` does **not** cover this. Its hole #3 names `eval_runner_service.py:648` only; its
`relates_to` list contains no `validator_kinds.py` and no `publish_service.py`, and its `trigger_paths`
name neither file. So neither instance is registered anywhere.

**Fix:** pick one of two, and say which in the column's own comment:

```python
# Option A — count them, which is ~2 lines each and mirrors phase_types.py:1586 exactly:
# validator_kinds.py, after the forced_emit call at :592
from app.services.harness.phase_types import _record_run_usage  # or lift it to a shared module
_record_run_usage(ctx, result.get("input_tokens"), result.get("output_tokens"))
```

```python
# Option B — name the leg honestly, so the index can still answer the negative question:
TOKEN_COVERAGE_LEGS = ("agent", "single", "batch", "emit")   # judge/validator legs NOT included
# …and add "judge" to the migration predicate's literal set, so any run that did not
# report judge usage falls INTO idx_workflow_runs_org_coverage_incomplete.
```

Option A is strictly better here: the measurement already exists and is being thrown away two frames
from a function that would accept it. Option B without Option A leaves every judge-bearing run
permanently marked incomplete, which is honest but useless.

---

## Warnings

### WR-01: The breaker watermark advances before the durable write, so a failed persist both loses the delta forever and fails the run

**File:** `backend/app/services/harness_engine.py:1928-1931`

**Issue:** `absorb_usage_box` mutates `breaker.input_tokens` / `.output_tokens` (`circuit_breaker.py:178`)
and *then* the delta is handed to `persist_run_usage`. There is no transaction and no retry, and the
docstring at `:1932-1934` explicitly declines a `try` — with the stated reason that "a `try/except`
here would add a branch to a function whose branch count is itself fenced." Two consequences:

1. If the UPDATE raises (pool timeout, a Postgres blip, a connection reset), the watermark has
   already moved, so the next `_enforce_budget` computes a delta that **excludes** the failed write.
   The spend is lost permanently even if the run survives.
2. The exception propagates out of `run_workflow`. At the `:2036` call site that is before
   `mark_phase_active`; the callers (`scheduler_service.py:274`, `api/runs.py:1341`,
   `publish_service.py:1648`) all catch broadly and mark the run **failed**. So a token-accounting
   write can now kill an otherwise healthy run — two lines below `load_run_budget`, which
   deliberately *fails open* for exactly this reason (`harness_engine.py:1810-1813`).

A test's branch-count assertion is not a good reason to leave a money-losing failure mode in
production code; the fence should be re-baselined instead.

**Fix:** write first, then advance — or at minimum do not let the write kill the run:

```python
_box = getattr(ctx, "run_usage_box", None)
_d_in, _d_out = breaker.absorb_usage_box(_box)
try:
    await persist_run_usage(pool, run_id, input_delta=_d_in, output_delta=_d_out)
except Exception:  # noqa: BLE001 — accounting must never terminate a healthy run
    logger.warning("persist_run_usage failed for run=%s (delta lost)", run_id, exc_info=True)
```
and update the branch-count fence in the same commit, recording the re-baseline rather than
working around it.

### WR-02: Nothing in the gated unit suite ties `TOKEN_COVERAGE_LEGS` to migration 182's hard-coded index predicate

**File:** `supabase/migrations/182_workflow_runs_token_totals.sql:85` · `backend/app/db/workflows.py:93`

**Issue:** The partial index predicate spells the four legs as a SQL literal
(`ARRAY['agent','single','batch','emit']`) and the Python constant spells them again. The migration's
own comment names the obligation ("Adding a fifth counting leg means one migration that DROPs and
re-CREATEs this index"), but no gate enforces it:

- `backend/tests/unit/test_256_persist_run_usage.py:221` pins the constant to four legs — it never
  looks at the migration.
- `backend/tests/integration/test_256_migration_182.py:218` checks the predicate — but (a) it
  hard-codes `("agent","single","batch","emit")` rather than importing `TOKEN_COVERAGE_LEGS`, so it
  cannot detect drift, and (b) `tests/integration/` is **outside** `pytest tests/unit`, the canonical
  gate, as plan 256-01's own SUMMARY records.

Failure scenario: a fifth leg ships. The unit test fails, someone updates the constant, and the
migration is forgotten. Every run then fails `token_coverage @> ARRAY[4 legs]`… no — every run still
*satisfies* it, so every run reads as fully covered while the fifth leg is missing; or, if the
predicate is updated and the constant is not, the partial index matches every row and stops being
partial. Either way it is silent.

**Fix:** derive one from the other in the gated suite:

```python
# backend/tests/unit/test_256_coverage_legs_match_the_index.py
from pathlib import Path
from app.db.workflows import TOKEN_COVERAGE_LEGS

def test_the_index_predicate_names_exactly_the_shipped_legs():
    sql = Path("supabase/migrations/182_workflow_runs_token_totals.sql").read_text("utf-8-sig")
    for leg in TOKEN_COVERAGE_LEGS:
        assert f"'{leg}'" in sql, f"leg {leg!r} is claimed in code but absent from 182's predicate"
    assert sql.count("ARRAY['agent'") == 1  # one predicate, and it is the one we just checked
```
Drive it RED by adding a fifth leg to the constant before trusting it.

### WR-03: `token_coverage` is SET to the *current* constant on every write, so a run spanning a deploy is retro-claimed as fully covered

**File:** `backend/app/db/workflows.py:2120` (`"token_coverage = $4, "`)

**Issue:** The two token columns ADD; the marker SETs. A run that persisted three segments under a
three-leg build and is then resumed after a deploy that ships the fourth leg ends with
`token_coverage = {agent,single,batch,emit}` covering a total whose first three segments never
included emit spend. The column's whole promise — quoted in its own DB comment — is "a run persisted
before a leg shipped reads honestly as NOT covering it, **forever**, with no memory required". Under a
mid-run upgrade it does the opposite, and the over-claim is indistinguishable from an honest one.

This is not hypothetical: `resume_stranded_workflows` (`harness_engine.py:3082`) is a boot sweep, so
a worker restart *is* the normal way a run crosses a deploy boundary.

**Fix:** intersect rather than overwrite, so the marker can only ever shrink:

```sql
token_coverage = CASE
    WHEN token_coverage IS NULL THEN $4
    ELSE ARRAY(SELECT unnest(token_coverage) INTERSECT SELECT unnest($4::text[]))
END
```
and add a case pinning the intersect behaviour across two writes with different leg sets.

### WR-04: `SEED-300`'s hole #2 was closed inside this same phase and the seed still reads `status: planted`

**File:** `.planning/seeds/SEED-300-three-token-holes-surviving-phase-256.md:3`, `:60-66` vs `backend/app/services/eval_runner_service.py:971`

**Issue:** SEED-300 (planted by plan 256-02) states as a surviving hole: *"The eval WITHOUT arm was
paid for and its return is deliberately discarded… an eval run's recorded spend is low by one full
arm."* Plan 256-03 then **fixed exactly that** — `eval_runner_service.py:971` passes
`usage_acc=usage_acc` into the WITHOUT arm, and the comment two lines above says so explicitly. The
seed's title, body and `trigger_when` all still assert the hole is open, and `status` is `planted`.

CLAUDE.md's rule is unambiguous: *"A seed is answered by editing the seed… a seed that shipped but
still reads `planted` will be re-proposed forever"*, and *"`status:` frontmatter IS the index."* This
one will be re-proposed at every `/gsd:new-milestone` describing a hole that does not exist, which is
precisely the register-rot this project has paid for repeatedly.

**Fix:** edit the seed. Flip hole #2 to answered inline (recorded beside the original, per the
project's convention rather than overwritten), set `status: partially-answered` and
`status_note:` naming plan 256-03 and the line, and narrow `trigger_when` to holes #1 and #3.

### WR-05: Six stale `file:line` pins shipped, two of them inside durable DB column comments

**File:** `supabase/migrations/182_workflow_runs_token_totals.sql:16` · `:44` · `backend/app/db/workflows.py:2085` · `:2091` · `backend/app/api/runs.py:673`, `:1349` · `backend/app/services/harness/publish_service.py:1667` · `backend/app/services/scheduler_service.py:293` · `backend/app/services/harness_engine.py:1877`

**Issue:** Measured at `6b3d3a59e`:

| pin as written | measured |
|---|---|
| `ctx.run_usage_box` set at `harness_engine.py:1844` (migration comment + `persist_run_usage` docstring + the shipped `workflow_runs.input_tokens` COMMENT) | **`1884`** |
| `run_workflow` sets it, `harness_engine.py:1864` (four METER-05 site comments) | **`1884`** |
| `_enforce_budget` invoked at `harness_engine.py:1978` and `:2547` (`persist_run_usage` docstring) | **`2036`** and **`2605`** |

Two of these are inside `COMMENT ON COLUMN` bodies, so they are now stored in the live database and
in `supabase/full-schema.sql:2769` — correcting them costs another migration. This is the exact rot
mode plan 256-01's own Fence 3 fired on, mid-phase, and recorded as a lesson; the lesson was written
down and then not applied to the prose shipped beside it.

**Fix:** correct the seven source-comment pins now (cheap), and either accept the two DB comments as
known-stale with a note, or fix them in the next migration that touches `workflow_runs`. Better:
stop pinning a line number for a single assignment — `harness_engine.run_workflow` (naming the
function, which is stable) carries the same information and cannot rot on an unrelated insert.

### WR-06: A timed-out or errored eval arm contributes zero spend, while the comment above the accumulator claims otherwise

**File:** `backend/app/services/eval_runner_service.py:600-610` and `:632-638`

**Issue:** `in_tok` / `out_tok` are only assigned on the success path (`:602-603`). Both `except`
arms (`asyncio.TimeoutError` at `:604`, `Exception` at `:608`) leave them `None`, so the accumulator
block at `:632-638` adds nothing. The comment introducing that block says the opposite:

> *"the provider billed for this arm whether or not the judge could grade it, so an errored or empty
> arm's measured tokens still belong in the run's spend."*

A timed-out arm is the one that ran longest and cost most, and the remedy is already in the codebase:
`run_agent_loop` writes `result_sink["input_tokens_total"] / ["output_tokens_total"]`
(`agent_loop.py:3420-3421`) precisely so a caller can recover totals when the return value never
arrives — `run_producer.py:108-109` uses it. `_run_arm_body` does not pass a `result_sink`.

This is the same argument D-256-12 makes about failed rungs, not applied here.

**Fix:**

```python
_sink: dict = {}
try:
    result = await run_agent_loop(ctx, emit=_noop, emit_terminal=_noop, spawn=_spawn, result_sink=_sink)
    ...
except asyncio.TimeoutError as exc:
    ...
finally:
    if in_tok is None:
        in_tok = _sink.get("input_tokens_total")
        out_tok = _sink.get("output_tokens_total")
```
(verify the parameter name against `run_agent_loop`'s signature before wiring), and pin it with a
case that times an arm out and asserts non-zero accumulated spend.

---

## Info

### IN-01: `token_coverage`'s documented empty-array state is unreachable

**File:** `supabase/migrations/182_workflow_runs_token_totals.sql:70-72` · `backend/app/db/workflows.py:2125`

The column comment declares three distinct states, the middle being `{}` = *"reported, but covering
nothing"*. The only writer passes `list(TOKEN_COVERAGE_LEGS)`, a non-empty module constant, and the
`if not input_delta and not output_delta: return` guard means the row is never touched when there is
nothing to report. No code path can produce `{}`. The column is two-state in practice.
**Fix:** either delete the `{}` clause from the comment (and from Phase 257's reading), or make the
zero-delta case write `'{}'` deliberately — but not both, and not silently.

### IN-02: All five new producer-shell warnings log `provider=None` unconditionally

**File:** `backend/app/api/runs.py:687`, `:1361` · `backend/app/services/harness_engine.py:3117` · `backend/app/services/harness/publish_service.py:1680` · `backend/app/services/scheduler_service.py:302`

The warning is `getattr(ctx, "provider", None)`, and none of the four ctx builders sets a `provider`
attribute: `_build_resume_context` returns a `SimpleNamespace` with `model=` and no `provider=`
(`harness_engine.py:2905-2950`), `continue_run`'s inline namespace the same (`api/runs.py:1296-1331`),
`_drive_golden_run`'s the same (`publish_service.py:1610-1637`). `db/runs.py:93-99`'s contract asks
for the provider by name because it is the field that identifies *which* integration stopped
reporting usage; at these five sites it is always absent.
**Fix:** carry `provider` on the ctx bag (the shells already insert a `provider=` value into the
`runs` row at `harness_engine.py:2728`, so the value exists) or drop the field from the format string
rather than logging a permanent `None`.

### IN-03: A rung that raises loses its already-billed tokens, and D-256-12's "every rung counts" does not name the gap

**File:** `backend/app/services/forced_emit.py:519-531`

`_drain` returns its token pair only on a clean return; when `open_stream` or `_drain` raises, the
`except` arm at `:522` `continue`s and the tuple never existed. A provider that streamed some tokens
and then dropped the connection was billed for them, and they are gone. This is narrower than the
failed-rung case D-256-12 argues about (which *is* handled correctly — the fold at `:534-538` sits
above both `continue`s), but the module's prose asserts "every shot the provider actually served" and
this is one it does not count.
**Fix:** either accept it and say so in the same docstring that makes the claim, or have `_drain`
accumulate into a caller-supplied box (the `usage_box` idiom this repo already uses) so a mid-stream
raise still surrenders what it measured.

### IN-04: `persist_run_usage` ignores the UPDATE's row count

**File:** `backend/app/db/workflows.py:2116-2126`

`pool.execute` returns `UPDATE 0` when `run_id` names no row (a deleted run, a wrong grain passed by
a future caller). The function returns `None` either way, so a write that lands nowhere is
indistinguishable from one that lands. Every other invariant in this module is asserted loudly;
this one is not asserted at all.
**Fix:** `status = await pool.execute(...)` and `logger.warning("persist_run_usage matched no row for run=%s", run_id)` when it ends in `" 0"`.

### IN-05: The eval finalize's token read and warning sit outside the `try` that guards `finalize_run`

**File:** `backend/app/services/eval_runner_service.py:1005-1017`

At the other four shell sites the whole block (read → warn → finalize) is inside the `try` whose
`except Exception` keeps a finalize failure from escaping. Here the read and the `logger.warning` are
in the `finally` but *above* the inner `try`. Nothing in those three statements can realistically
raise (`dict.get` and a logger call), so this is a consistency note rather than a live defect — but
this is a `finally`, and anything raised there masks the original exception and skips the finalize
entirely.
**Fix:** move the two `.get()` calls and the warning inside the existing `try`, matching the other
four sites.

---

## What was checked and found clean

Stated plainly rather than padded:

- **SQL injection / parameterisation** — the one new statement is a single f-string-free literal with
  `$1..$4` bind parameters and `WHERE id = $1` as its whole access boundary. No new query text
  anywhere else in `db/workflows.py`. Nothing to report.
- **Log disclosure** — all six new `logger.warning` calls use the shipped identifier-only format
  string; no token value, no message content, no user data. Nothing to report.
- **The `absorb_usage_box` signature widening** — one caller, tuple-unpacks, no truthiness test
  anywhere in `backend/app`. Nothing to report.
- **The `_enforce_budget` reorder's effect on the armed path** — verified by reading `check_limits`
  (`circuit_breaker.py:191-205`): both arms are `is not None`-guarded, `armed` is a pure
  short-circuit, and `breaker` has no other reader in the module. The trip is unchanged.
- **The eval `usage_acc` race the brief asks about** — the WITH and WITHOUT arms are `await`ed
  sequentially inside one `for case in cases` loop (`eval_runner_service.py:936`, `:965`), so the
  dict has a single mutator at a time and `usage_acc` is function-local per job. No race.
- **Migration 182 grants / RLS** — `workflow_runs` carries no column-level GRANTs in any migration
  (the `connector_connections` trap from migration 118 does not repeat here), so the three new
  columns inherit the table's four policies. `supabase/full-schema.sql` has been regenerated and
  carries both the columns (`:2694`, `:2766-2783`) and the index (`:4326`), so plan 256-01's one
  owed acceptance criterion is now discharged.

---

_Reviewed: 2026-09-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
