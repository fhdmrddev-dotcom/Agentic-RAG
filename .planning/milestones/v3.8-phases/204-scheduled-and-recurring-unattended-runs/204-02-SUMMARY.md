---
phase: 204-scheduled-and-recurring-unattended-runs
plan: 02
subsystem: backend/run-lifecycle
tags: [SCHED-02, circuit-breaker, spend-cap, token-budget, duration-limit, unattended, migration-125]
requires:
  - "204-01 run_lifecycle.cancel_workflow_run_internals (the ONE broadcast site)"
  - "204-01 harness_engine cancellation_watch (the in-flight killer this composes with)"
  - "task_service._sub_usage cross-iteration accumulator (Phase 093 D-17)"
provides:
  - "services/circuit_breaker.CircuitBreaker + CircuitBreakerTrippedError + duration_watch"
  - "db.workflows.record_circuit_breaker_trip / load_run_budget"
  - "run_task_sub_agent returns input_tokens / output_tokens (additive)"
  - "ctx.run_usage_box — the run-level cumulative token channel"
  - "migration 125: workflow_runs.metadata + the 25th harness_audit kind"
affects:
  - "every harness run: two budget checks per phase + one sentinel task when a duration cap is set"
  - "204-03's scheduler, which writes max_tokens_per_run / max_duration_seconds into workflow_runs.metadata"
tech-stack:
  added: []
  patterns:
    - "compose-the-one-stop-path (D-204-03)"
    - "cumulative usage_box + additive record_tokens"
    - "asynccontextmanager sentinel that TRIPS rather than kills"
key-files:
  created:
    - backend/app/services/circuit_breaker.py
    - backend/tests/unit/test_scheduler_circuit_breaker.py
    - supabase/migrations/125_circuit_breaker_trip.sql
  modified:
    - backend/app/services/harness_engine.py
    - backend/app/db/workflows.py
    - backend/app/services/task_service.py
    - backend/app/services/harness/phase_types.py
    - backend/tests/test_harness_engine.py
    - backend/tests/unit/test_audit_event_registration.py
    - backend/tests/unit/test_harness_audit_102.py
    - backend/tests/unit/test_harness_audit_emit.py
decisions:
  - "D-204-06/07 implemented; trip_breaker COMPOSES cancel_workflow_run_internals — no second stop path"
  - "The duration cap is enforced IN-FLIGHT by a per-phase sentinel that trips and lets wave 1's cancellation_watch do the killing"
  - "The trip raises CircuitBreakerTrippedError from OUTSIDE the phase try — the 194 cancel_phase AST fence stays at exactly 1"
  - "Both durable writes are best-effort at the caller; the halt never depends on the bookkeeping"
  - "load_run_budget FAILS OPEN — an unapplied migration disarms the cap rather than killing every run"
  - "The token half IS wired, for 3 of 4 LLM phase types; llm_emit is NOT counted (forced_emit measures no usage anywhere)"
metrics:
  duration: ~2h
  tasks: 3
  completed: 2026-08-24
---

# Phase 204 Plan 02: Spend-Cap + Duration Circuit Breaker (SCHED-02) Summary

Two hard ceilings for a run nobody is watching — a cumulative token budget and a
wall-clock deadline — enforced by a breaker that **composes** wave 1's cancel brake rather
than writing a second stop path, and whose duration half kills a **hung** phase in flight
rather than waiting for a boundary it will never reach.

## What shipped

| Commit | What |
|---|---|
| `daf6c123` | `circuit_breaker.py` (the leaf); `db/workflows.py` gains `record_circuit_breaker_trip` + `load_run_budget` + the 25th audit kind; **migration 125** |
| `7c56dc77` | `harness_engine.run_workflow` integration; the token source wired through `task_service.py` + `harness/phase_types.py` |
| `6bfb28a4` | `tests/unit/test_scheduler_circuit_breaker.py` — 37 cases |
| `812d4c8b` | the two hard-pinned audit-kind counts, 24 → 25 |

**Mechanism.** Three enforcement sites, and the suite asserts none is redundant:

- **Phase boundary** — sited immediately after wave 1's cancel brake, for the identical
  argument: below that line the engine writes a durable `active` row, emits to the browser
  and calls a provider. It is the HARD FLOOR that makes *"zero further LLM provider calls
  or phase executions"* true. It is also the only site that catches a **resumed** run whose
  budget was already blown, and a `skip_to_phase` cycle, which `continue`s past the end of
  the loop body without ever completing a phase.
- **Phase completed** — because the boundary check alone would let the **last** phase's
  breach go unrecorded: that run falls out of the loop into the success terminal and
  reports `completed`. No further money is at risk there, but a breach with no trip record
  is exactly the *audit evasion* threat.
- **In-flight duration sentinel** — `breaker.duration_watch(...)` on the **same
  `async with` line** as `cancellation_watch`. This is the only thing that can kill a
  **hung** phase on a deadline, and it is required by the threat's own wording ("hanging
  network requests or third-party deadlocks"). Measured: with the sentinel removed (CF-B)
  the suite ran **5.6 s → 24.9 s**, because the hung phase was no longer killed and ran to
  the harness's own 20 s `wait_for`. That is the threat measured rather than asserted.

**The sentinel cancels nothing itself.** It calls `trip_breaker`, whose
`cancel_workflow_run_internals` broadcasts; the `cancellation_watch` entered immediately to
its left then cancels the in-flight task through the identical path a human Stop takes.
Order on that line is load-bearing — the listener is entered first, so it is already
subscribed when the sentinel starts.

## Is the token half genuinely wired? **YES — and I verified the handover's read before building on it**

The pre-flight's measurement was **correct in every particular**, and I confirmed each half
independently rather than inheriting it:

- `backend/app/services/harness/` really does contain only 2 `usage` references, both in
  `publish_service.py`, both `input_tokens=None`.
- `task_service._sub_usage` really is a cross-iteration SUM, really is fed by
  `_stream_one_iteration`, and really is persisted to `runs.input_tokens/output_tokens` on
  finalize.
- **The gap really was the return value**, and I checked it structurally rather than by
  eye: `ast` says `run_task_sub_agent` has **exactly one `Return`**, and its dict did not
  carry the counts. The totals were measured, persisted, and then discarded at the boundary.

**So the counts existed all along and nothing could see them.** The fix is the smallest
correct one and it has an exact precedent **inside the same function**: F7 (092-07) widened
this identical return dict additively for identical reasons — *"Existing callers … ignore
these extra keys — additive, no behavior change."*

**Coverage, stated exactly rather than as "wired":**

| Phase type | Provider seam | Counted? |
|---|---|---|
| `llm_agent` | `run_task_sub_agent` | ✅ via the widened return |
| `llm_batch_agents` | `gather(run_task_sub_agent × N)` | ✅ every branch, folded after the gather (not inside `_one`, so N coroutines do not race one plain dict) |
| `llm_single` | `_stream_one_iteration` | ✅ the run box is passed straight through — it was previously passed **nothing**, so this type's usage was discarded entirely |
| `llm_emit` | `forced_emit` | ❌ **NOT COUNTED** |

⚠ **`llm_emit` is the honest gap and it is named rather than hidden.**
`backend/app/services/forced_emit.py` contains **zero** occurrences of `usage` — it does
not measure its own spend anywhere, so no box can be handed to it. Wiring it means
instrumenting the forcing seam and the gateway beneath it: a different file and a different
plan. The three types that ARE counted are the three that loop or stream; a sealed single
shot is the one that structurally cannot run away.

**This is a real ceiling that really trips, not a Phase-200 SC#3 no-op** —
`test_the_token_ceiling_is_reached_through_the_real_executor_seam` drives the shipped
`_exec_llm_agent` against a patched `run_task_sub_agent` and goes red when the hand-off is
broken (CF-C), and CF-D goes red when the return dict is narrowed back.

## What the plan assumed wrongly

### 1. ⚠ `workflow_runs.metadata` DOES NOT EXIST — and the plan writes to it twice

Task 1 says the breaker *"updates `workflow_runs.metadata` with circuit breaker trip
details"*; D-204-07 repeats it; must_have truth 4 depends on it. **Measured against the
schema on disk: there is no such column and there never has been.** `057` created the
table; `062`, `063`, `064`, `070`, `105` and `122` are every `ALTER` since, and not one
adds it.

Left as written, the first real trip would have raised `UndefinedColumnError` — a safety
mechanism that passes every unit test, reads as armed, and cannot record the one event it
exists for. **Migration 125 creates it**: `ADD COLUMN IF NOT EXISTS metadata jsonb`,
nullable with no default, so the `ADD COLUMN` is catalog-only and rewrites no rows (122's
own argument for `definition_snapshot`); the writer `COALESCE`s, because `NULL || anything`
is `NULL` in Postgres and without it every trip on a pre-125 row would write nothing and
report success.

### 2. ⚠ `circuit_breaker_tripped` needs a MIGRATION, not just a Python literal

Registering the kind in `_AUDIT_EVENT_TYPES` alone does not fix anything — it MOVES the
failure from a `ValueError` before the INSERT to a Postgres `23514` during it. That is
BUG-260731-02 verbatim, the bug that killed `workflow_runs.id = 80c8823d`. Migration 125
therefore widens `harness_audit_event_type_check` **24 → 25** in the same commit, and
`test_audit_event_registration.py`'s G2 fence pins the two sets equal in both directions.

⚠ **NEITHER HALF OF MIGRATION 125 HAS BEEN APPLIED TO THE LIVE DB.** That is an operator
action under the CLAUDE.md rule (paste into the Supabase SQL editor — never
`supabase db push`/`db reset`), followed by `bash scripts/regenerate-full-schema.sh` with
no `--reset`, committing both. **Until it is applied, a trip records nothing** — see the
fail-open note under *What this does NOT prove*. `124` belongs to `204-03`; the numbers are
disjoint on purpose and the two migrations are independent.

### 3. The plan's `break` would have shipped 204-01's defect again

Task 2 says *"invoke `trip_breaker(...)` and break immediately"*. 204-01 already measured
what `break` costs in this loop: the statements after it are
`finish_run(pool, run_id, "completed")`, a `run_completed` audit row,
`_surface_final_answer` and a `run_completed` SSE frame. A run killed for overspending
would tell the browser it succeeded. The plan's own next clause (*"raising
`CircuitBreakerTrippedError`"*) is the right one and is what shipped —
`test_a_tripped_run_never_reports_completed` goes red on the plant (CF-A), along with five
others.

### 4. The plan did not say where the trip must be raised FROM, and that turned out to matter

`_enforce_budget` is called from **outside** the phase `try`. Raising from inside it would
take the `except BaseException` escape arm, which calls `cancel_phase` — and the shipped
Phase-194 fence AST-counts `cancel_phase` call sites in `harness_engine.py` at **exactly
one**. 204-01 hit that fence and answered by removing a write rather than re-baselining;
this plan avoided it by siting the raise, and the fence **passes unedited**. It would also
have flipped a phase row that legitimately COMPLETED to `cancelled`.

## Deviations from Plan

### 1. [Rule 2 — Missing critical functionality] Migration 125, outside `files_modified`

Both durable homes the plan's must-haves name did not exist. Covered in full above.
**Declared as a deviation because it is a schema change and it carries an operator
obligation that no test can discharge.**

### 2. [Rule 3 — Blocking] `task_service.py` + `harness/phase_types.py`, outside `files_modified`

The handover flagged this route and asked for it to be declared. Without these two files
`max_tokens_per_run` is a ceiling nothing can raise.

- `task_service.py`: **`+2` keys on one return dict**, plus its comment. Precedented by F7
  in the same function. `None` is preserved and not coalesced to `0` — a provider that
  emitted no usage is a different fact from one that used zero, and only the first deserves
  the `runs.usage missing` warning that function already logs.
- `harness/phase_types.py` (a **G-5 hot file**): honoured by construction — two small
  module-level helpers and three one-line call sites. No existing function was
  restructured; the `usage_box` kwarg on `_exec_llm_single` fills a parameter that has been
  on `_stream_one_iteration`'s signature since Phase 093 and was simply never passed.

### 3. [Rule 3 — Blocking] Four shipped test sites needed updating — each checked against precedent

⚠ **None of these is a re-baseline.** Each was verified to be the same edit a prior phase
made for the same reason, and the precedent commit is named:

| Site | Why | Precedent |
|---|---|---|
| `test_harness_engine.py` — two `_fake_stream` fakes | They did not model `usage_box`, a **shipped** parameter since Phase 093. An under-specified fake raises `TypeError` at the call — the `196-08` mock-completeness shape. Accepting it models the real signature; it widens no contract. | mock completeness |
| `test_audit_event_registration.py` — G2's positive control | Its fixture is a **frozen snapshot of the 114 CHECK**, so every kind added after 114 is legitimately "missing from SQL" there. `190-03` (`ed53a909`) made this identical edit for `external_action_sent`. The property is preserved and now exercised on **two** detections rather than one. ⚠ It stays `==` and was deliberately **not** loosened to `in` — `==` is what catches an OVER-reporting parser, which is the false green the whole file exists to prevent. | `ed53a909` |
| `test_harness_audit_102.py` + `test_harness_audit_emit.py` — two hardcoded counts | Both say **in their own comments** that they are bumped in lockstep with `_AUDIT_EVENT_TYPES`. | `0e5a62a9` — *"bump the two hard-pinned audit-kind counts 23 -> 24 in lockstep"*, the same two files |

⚠ **THE TWO COUNT PINS WERE INVISIBLE TO EVERY PHASE-SCOPED GATE AND WERE FOUND ONLY BY THE
BASE-VS-HEAD REGRESSION DIFF.** They live in neither `test_harness_engine.py`, nor the new
suite, nor `test_cross_worker_cancellation.py`, nor the plan's stated gate. Had I reported
the plan's gate plus "phase-scoped regression" and stopped, I would have shipped two red
tests and called the phase green. **The full-scope base-vs-HEAD comparison is what caught
them, and it is the reason to keep doing it rather than trusting a scoped run.**

### 4. [Process / Infrastructure] The worktree forked from the WRONG base

My worktree was created at `4d3968a9` ("Merge develop into master — .msg NUL fix"), **not**
at the dispatched base `9af9706e` — 8 commits behind and **divergent**. That tree contains
**no part of wave 1**: `broadcast_run_cancellation`, `is_run_cancelled`,
`cancellation_watch` and the `run_workflow` brake are all absent. Building there would have
produced a fully-green plan that silently re-implemented wave 1 on a stale trunk.

Caught by the HEAD assertion before any plan work, fixed with `git reset --hard` to the
dispatched SHA, and re-verified by grepping the three wave-1 symbols out of
`run_lifecycle.py` rather than assuming the reset took. **This is a repeating
infrastructure fault in this repo — assert the dispatched base SHA before reading the
plan, and verify a foundation symbol afterwards.**

## Threat-model coverage (the standing criterion for this phase)

All three mitigations have real assertions **and a driven counterfactual**. Phase 203 wrote
three and implemented none while every task passed.

| Threat | Cases | Counterfactual |
|---|---|---|
| **Runaway Cost** | `..._token_ceiling_stops_the_next_phase_from_executing`, `..._cannot_be_bypassed_by_a_phase_that_reports_no_usage`, `..._is_reached_through_the_real_executor_seam`, `..._resumed_run_whose_budget_was_already_blown_executes_nothing`, `run_task_sub_agent_returns_the_counts_it_has_always_measured` | CF-A, CF-C, CF-D |
| **Wall-Clock Stalls** | `..._duration_watch_kills_a_hung_phase_mid_flight`, `..._boundary_only_check_could_not_have_killed_the_hung_phase`, `..._sentinel_is_torn_down_on_every_exit_path` (3 paths), `..._deadline_is_absolute_across_phases_not_a_per_phase_timer`, `..._disarmed_breaker_creates_no_sentinel_task` | CF-B |
| **Audit Evasion** | `..._trip_record_is_written_before_the_run_is_terminalized`, `..._carries_the_exact_measurements`, `..._halt_survives_a_failed_trip_record`, `..._breaker_trips_exactly_once`, `..._metadata_write_hands_the_codec_a_plain_dict`, `..._writer_does_not_pre_encode_its_jsonb_parameter` | CF-E, CF-F |

**The acceptance is behavioural, as required.** The headline cases assert the **executor
entry log** (`provider.entered == ["p0"]`) and the **SQL write ORDER**, never
`status == 'cancelled'` — a breaker that wrote the column and let phase 2 run would pass a
status assertion and fail these. Non-vacuity is asserted in the other direction too:
`test_a_run_inside_its_budget_completes_all_phases_untouched` and
`test_an_unarmed_run_is_byte_identical_to_the_shipped_path` would fail against an engine
that had simply stopped running anything.

**Two AST fences carry positive controls**, because a counter that always returns 0 passes
every zero-assertion: the `json.dumps` fence controls against `create_workflow_run` (which
still legitimately pre-encodes `inputs`), and the `raise`-not-`break` fence asserts exactly
one `Raise` node plus zero `Break` nodes in `_enforce_budget`. ⚠ The `json.dumps` fence is
an **AST walk, not a regex** — `db/workflows.py`'s docstrings discuss `json.dumps` at
length and a naive `count` reads that prose as live code (the 187-24 trap).

## Counterfactuals driven (all against the COMMITTED tree)

⚠ 204-01 lost its own fix to a `git checkout` during a counterfactual. Every plant below
was made **after** its commit, against a scratchpad backup outside the watched tree, and
the tree was verified `git status --short` clean afterwards.

| | Plant | Red |
|---|---|---|
| CF-A | `raise CircuitBreakerTrippedError` → `return` | **6** cases, incl. `..._never_reports_completed` and `..._raises_from_outside_the_phase_escape_arm` |
| CF-B | `duration_watch` removed from the engine's `async with` | 1 — `..._kills_a_hung_phase_mid_flight`; **suite runtime 5.6 s → 24.9 s** |
| CF-C | `_exec_llm_agent` discards the sub-agent's usage | 1 — `..._reached_through_the_real_executor_seam` |
| CF-D | `run_task_sub_agent`'s return narrowed back | 1 — `..._returns_the_counts_it_has_always_measured` |
| CF-E | trip record moved AFTER the terminalize | 1 — `..._written_before_the_run_is_terminalized`. ⚠ **Both writes still happened**, so a presence-only assertion would have passed green; only the ORDER assertion caught it |
| CF-F | `json.dumps` re-introduced on the jsonb parameter | 2 — the behavioural check AND the AST fence, agreeing |

## Test figures

```
backend/tests/unit/test_scheduler_circuit_breaker.py -v     ->  37 passed     (plan gate)
backend/tests/test_harness_engine.py                        ->  61 passed
backend/tests/unit/test_cross_worker_cancellation.py        ->  28 passed     (wave 1, untouched)
backend/tests/unit/test_audit_event_registration.py         ->   6 passed
```

**NEW failures against base `9af9706e`: ZERO.** Measured the way wave 1 did it, not
assumed. Scope: `tests/unit` + `test_harness_engine.py` + `test_run_lifecycle.py`, run
twice with `-p no:randomly` — once at HEAD, once with the six touched sources restored via
`git checkout 9af9706e -- <files>` and the new suite excluded. Failing-test-id sets
compared with `comm`.

- HEAD, new suite excluded: **67 failing**
- base sources restored: **68 failing**
- `comm -23` (new at HEAD): **EMPTY**
- The one difference is `test_g2_python_allow_list_equals_sql_check`, failing only in the
  BASE run — a **restore artifact, not a real base failure**: the file-scoped restore puts
  base `_AUDIT_EVENT_TYPES` (24 kinds) against migration 125 still on disk (25 literals), a
  combination that exists in no commit. The two real sets are identical.

Full scope at HEAD including the new suite: **67 failed, 2605 passed, 2 xfailed, 2 xpassed**.
(The repo-wide backend baseline is ~65-69 pre-existing failures. The FIRST HEAD run read
**69** — those two extra were the hardcoded count pins, fixed in `812d4c8b`.)

## Hot-file ledger — re-derived, not copied forward

Three G-5-firing files were modified; all three are **honoured by construction** (additions
only, no restructuring). Triples measured with the CLAUDE.md recipe, six-digit dated
quick-task buckets excluded:

| File | CLAUDE.md row says | at base `9af9706e` | **at HEAD** | verdict |
|---|---|---|---|---|
| `backend/app/services/harness_engine.py` | `46 / 16 / 2567` | `50 / — / 2812` | **`51 / 18 / 2966`** | ⚠ **the row was STALE BEFORE THIS PLAN STARTED** — wave 1 moved it by 4 commits / 245 L and the cell was never updated. Gains an import, a breaker construction, one nested helper and three call sites |
| `backend/app/db/workflows.py` | `43 / 21 / 2194` | `43 / — / 2194` | **`44 / 22 / 2338`** | ⚠ the row was **CURRENT at this plan's base** and is stale only because this plan touched it — a measured non-touch by wave 1, which is a stronger statement than silence. No shipped SQL literal moved |
| `backend/app/services/harness/phase_types.py` | `40 / 17 / 2356` | — | **`42 / 18 / 2414`** | row was accurate at base. Two helpers + three call sites; no existing function restructured |

⚠ **`backend/app/services/task_service.py` HAS NO ROW IN THE LEDGER AT ALL, and it measures
`18 / 9 / 954`.** It fires G-5 at **nine phases** and has been invisible to its own
guardrail for its entire life — the same failure `ChatLayout.tsx` (21 phases) and
`config.py` (42) were found in. It is the single home of `_stream_one_iteration` **and**
`run_task_sub_agent`, so every harness LLM phase and the whole Deep sub-agent path reach
providers through it; a change here lands in **chat** as well as in workflows.
**Adding its row is owed by the next phase that modifies it**, under the same-commit sync
rule (a row here and a section in `docs/HOT-FILE-LEDGER.md`).

## What this does NOT prove

Stated plainly rather than left to be assumed, and written into the suite's own module
docstring:

- **Migration 125 is authored, NOT applied.** Nothing here runs against real Postgres, so
  the `metadata` column and the 25th CHECK literal are unexercised end-to-end. **Until it
  is applied, `record_circuit_breaker_trip` raises on both writes and is swallowed** — the
  run still halts correctly, but the trip leaves no durable record. SCHED-02's audit half
  is not closed until an operator applies it and `regenerate-full-schema.sh` runs.
- **`load_run_budget` FAILS OPEN, and the cost is real.** A database blip must not kill
  every in-flight run on every worker at once (the same argument `is_run_cancelled` makes
  for its own fail-open). But the consequence is that **an unapplied migration 125 silently
  DISARMS the spend cap** — the read raises, the budget resolves empty, and every run
  proceeds uncapped. It is logged at exception level with the run id, and it is the reason
  the migration is owed before any scheduled run exists. ⚠ *The audit half degrades to
  "unrecorded"; the enforcement half degrades to "off". They are different costs and the
  second is worse.*
- **`llm_emit` spend is invisible.** See the coverage table above.
- **The engine cases mock at `harness_engine._execute_phase`**, so the real `task_service` /
  provider bodies are not exercised there. One case
  (`..._reached_through_the_real_executor_seam`) drives the shipped `_exec_llm_agent`, which
  closes the executor half of that seam but not the provider half. A provider client that
  swallowed `CancelledError` internally would defeat the duration kill, and no unit test at
  this level can see it — inherited verbatim from 204-01's own stated limitation.
- **No live two-worker UAT.** The trip broadcasts on the same Redis keys a human Stop uses
  (asserted structurally and behaviourally), but a real `WORKER_COUNT=2` row is owed, as it
  was after wave 1.
- **No end-to-end run has ever tripped this breaker.** Every case is a unit drive.
- **The `>=` boundary is a choice, not a measurement.** A budget of 500 trips at exactly
  500. It is asserted, and it is the conservative direction for a spend cap.
- **`204-03` has not yet written the limits.** Nothing in the product populates
  `max_tokens_per_run` / `max_duration_seconds` today, so on the current tree the breaker is
  disarmed on every path — which is why
  `test_an_unarmed_run_is_byte_identical_to_the_shipped_path` exists.

## Threat Flags

None. No new network endpoint, no auth path, no file access. Migration 125's `metadata`
column sits on `workflow_runs`, whose four RLS policies (057) are predicate-only and name no
column list — so `ADD COLUMN` touches none of them and the 1-hop `threads.user_id` chain
still governs every read. The new audit kind rides `harness_audit`'s existing INSERT-only
RLS, so receipt immutability is unchanged. Both new `db/workflows.py` writers take a key and
no user-supplied filter; ownership is the caller's (T-147-06), matching every sibling in
that module.

## Self-Check: PASSED

- All 3 created files present on disk (`circuit_breaker.py`, the suite, migration 125).
- All 4 commits resolve: `daf6c123`, `7c56dc77`, `6bfb28a4`, `812d4c8b`.
- Task-1 acceptance symbols present: `class CircuitBreaker`, `def record_tokens`,
  `def check_limits`, `async def trip_breaker`.
- Task-2 acceptance: `CircuitBreaker(` constructed in `run_workflow`; both
  `_enforce_budget` call sites present; `duration_watch` on the phase `async with`.
- Task-3 acceptance: **37 passed**, 100%.
- ⚠ The shipped Phase-194 `cancel_phase` AST fence
  (`test_the_cancel_arm_is_the_harness_engines_alone_and_deep_never_enters_it`) **passes
  UNEDITED** — the count is still exactly 1.
- ⚠ Wave 1's 28 cases pass **unedited**.
- `git status --short` clean after every counterfactual; no file deletions in any commit of
  the range (`git diff --diff-filter=D 9af9706e..HEAD` empty).
