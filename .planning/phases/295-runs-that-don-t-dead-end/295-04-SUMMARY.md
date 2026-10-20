---
phase: 295-runs-that-don-t-dead-end
plan: 04
subsystem: harness-engine
tags: [run-end-truth, cancel, resume, reconciler, prior-output, emit-failure, g-5, seed-297]
requires:
  - phase: 295-01
    provides: "engine_ask seam (RETIRED registry for moved bodies)"
  - phase: 295-03
    provides: "run_handoff leaf, durable engine ask, consume-on-re-drive, engine_ask_fakes"
  - phase: 295-05
    provides: "run_read_wire end_reason reader (reads run_failed and policy_applied/run_cancelled)"
provides:
  - "run_handoff.handoff_text: a human step hands over question AND answer; an unsourced output its note (next model only)"
  - "run_handoff.claim_failure_message / surface_unless_engine_owns / surface_if_engine_owned: one failure, one message (D-23)"
  - "run_handoff.end_run: the ONE guarded terminal write (UPDATE ... WHERE status = ANY(...) RETURNING id, user_id), then finish_run, then the words"
  - "run_handoff.resume_with_terminalize / fail_unloadable_definition / resume_shell_status / expire_unless_paused"
  - "run_handoff.record_stop (D-19), record_failed_end (F2), finish_golden_run + golden_end_reason (golden finally)"
  - "run_reconciler._reconcile_workflow_runs (D-21, SEED-297 shape)"
  - "test_295_prior_output_answer.py, test_295_truthful_run_ends.py (49 cases)"
affects: [295-07 (ledger rows + live S6/S7 proof), harness_engine, phase_types, human_input, engine_ask, api/runs, run_lifecycle, run_producer, run_reconciler, publish_service]
tech-stack:
  added: []
  patterns:
    - "A new terminal end claims the row with a guarded UPDATE ... RETURNING and only the winner writes words (a phase failure, finish_run, the audit)"
    - "Every new branch lives in the run_handoff leaf; the hot files spend call lines only"
key-files:
  created:
    - backend/tests/unit/test_295_prior_output_answer.py
    - backend/tests/unit/test_295_truthful_run_ends.py
  modified:
    - backend/app/services/harness/run_handoff.py
    - backend/app/services/harness/phase_types.py
    - backend/app/services/harness/human_input.py
    - backend/app/services/harness/engine_ask.py
    - backend/app/services/harness_engine.py
    - backend/app/api/runs.py
    - backend/app/services/run_lifecycle.py
    - backend/app/services/run_producer.py
    - backend/app/services/run_reconciler.py
    - backend/app/services/harness/publish_service.py
    - backend/tests/unit/test_281_engine_cause_precedence.py
    - backend/tests/unit/test_256_finish_run_unchanged.py
    - backend/tests/unit/test_295_engine_ask_seam.py
    - backend/tests/integration/test_214_argument_seams.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "295-04: the D-19 Stop reason is written only where the person is KNOWN (the owner's cancel_run, both arms); the circuit breaker composes the same cancel and names nobody; a live-producer Stop that the producer's escape wins first records no Stop reason (no name is ever guessed)"
  - "295-04: a resumed run that escapes with an error also fails its still-active step with the same words (the _fail_redrive precedent), so the run page says why; a cancel leaves the step to the engine's own cancel_phase"
  - "295-04: F2 keeps its unconditional finish_run byte-for-byte; record_failed_end claims the failed end FIRST and never raises, so the cancel-honesty and anchor-clear behaviour cannot change"
  - "295-04: the reconciler's last step is the latest by completed_at, then phase_index; cancelled -> cancelled (no run_failed), anything else -> failed + the reconciler sentence"
  - "295-04: 295-03's residual (b), the second action_risk_pending row on an armed re-drive, is RECORDED, not fixed: the fix is a branch inside the armed block of _run_phase_with_gates (If ceiling +0) and that block is the ledger's owed seam"
requirements-completed: [RUN-01, RUN-02, RUN-04]
duration: "~3h40m"
completed: 2026-10-21
---

# Phase 295 Plan 04: Truthful run ends Summary

**A person's answer now reaches the next step, an unsourced output is flagged to the next model only, one failed emit writes one chat message naming the real cause, a Stop ends `cancelled` with "Stopped by <name>.", and every escape path (a resumed run, an unloadable definition, a golden run, an F2 producer escape, a stranded active row) ends terminal with a recorded reason, through one guarded write in the `run_handoff` leaf.**

## Performance

- **Duration:** ~3h40m
- **Tasks:** 3 (each a TDD RED commit then a GREEN commit)
- **Files modified:** 18 (2 new test files)

## Accomplishments

- **BUG-261020-01 (D-10 / D-11 / D-46).** `_prior_output_text` maps `run_handoff.handoff_text`. The 289 Run A shape (KB, then approve, then wrap) now hands the wrap step `Question asked: Approve the note?` / `The person answered: Yes`. An empty answer reads `(no answer)`. An output carrying `unsourced` is prefixed by a note saying it was accepted without sources and must not be presented as sourced. `_latest_phase_text` skips human outputs, so an external action after KB, summary, approve sends the summary, never the approval question, and never the note.
- **BUG-261015-01 (D-23).** `claim_failure_message(ctx, phase)` at the top of `_run_phase_with_gates` sets `ctx.engine_owns_failure_message = bool(phase.validators)`. The executor's per-attempt surface goes through `surface_unless_engine_owns`. The two engine arms that never surfaced (valid `skip_to`, completed-with-failure) call `surface_if_engine_owned` once. Driven through the real `run_workflow` loop and the real wrapper: a validated emit that fails twice and then fails the run writes **1** message (it wrote 3), and that message is the composed cause. A phase without validators keeps its own single message (D-50).
- **D-14 / D-44.** The `gate_failed` audit's `validator_error` is `cause if diagnosed else gate.error_message`. No audit row or message for a diagnosed failure carries `citations_required` or `no field_map on output`. `test_281`'s pin was re-pinned by name, with its reason in the test body.
- **D-49.** A `{kind: "cancel"}` payload in an author `ask_user` wait (`engine_ask`) or a human-step window (`human_input`) raises `CancelledError`, like the shutdown sentinel. It never becomes `fail_run` "aborted by user", and a human step is never completed with `answer: ""`. `if payload is None:` is unchanged in both.
- **D-41 / D-20.** `_resume_run` awaits `resume_with_terminalize(run_workflow(...))`. A `CancelledError` ends the row `cancelled` (no `run_failed`). Any other escape ends it `failed`, fails the still-active step, and writes ONE `run_failed` with words (never the exception text). Both then re-raise. A graceful shutdown writes nothing. An already-terminal run is never rewritten. The sweep's unloadable definition ends `failed` with "This run could not continue after a restart: its workflow could not be loaded." and the loop moves on. The resume shell reads `resume_shell_status(escape)` (cancelled, not completed) in the sweep and in `_wake`.
- **295-03 residual (a), fixed.** The sweep's cleanup calls `expire_unless_paused`, so a re-drive that paused AGAIN (another folder found nothing, or a human step asked again) keeps its new prompt. Any other end expires exactly as before.
- **D-19.** `cancel_workflow_run_internals(..., stopped_by=...)` calls `run_handoff.record_stop(pool, run, stopped_by, policy="run_cancelled")` before its own `finish_run`. When a person's Stop wins, ONE `policy_applied {policy: "run_cancelled", reason: "Stopped by <display name>."}` is written (fallback "Stopped by the person who started this run.", never an email). `api/runs.py` passes `stopped_by=current_user["id"]` on the no-producer arm and into `_cancel_run_internals` (forwarded to Step 3b). The operator Kill and the circuit breaker pass nothing. There is no new audit kind.
- **D-20, golden and F2.** `_drive_golden_run`'s `finally` calls `finish_golden_run` after the shell finalise. A still-live golden row ends `failed` with "The trial run stopped because of an error (<Type>)." or "...did not finish within its time limit, so it was stopped." plus ONE `run_failed`. It never raises. F2 calls `record_failed_end` before its unchanged `finish_run`: only the winner of a `failed` end writes ONE `run_failed`.
- **D-21 (SEED-297 shape).** `_reconcile_workflow_runs` runs under the same reconcile lock. It finalises `active` runs whose every step is terminal and whose row is older than `harness_resume_lease_seconds`: `cancelled` when the last step was cancelled, else `failed` + "Finalised by the reconciler: its steps had ended.". It expires their prompts. `paused` / `cap_paused` are never candidates, and no SQL it sends names a usage or total column. Read-only, against the local DB, its query parses and selects exactly the two stuck runs (`51924c91…`, `a77ed2c0…`), both last-step `cancelled`, so the next boot ends them `cancelled`.
- **D-43.** The 2026-08-28 leak's real path is found: a seed that failed after its `workflow_runs` INSERT left the fixture before its `yield`, so the teardown never ran. The seed is now `_seed_rows`, which removes what it wrote before it raises. A new integration test plants that failure and finds 0 rows left. The historical rows are not touched. **Measured 2026-10-21 (read-only): the 15 rows are no longer in the local DB** (0 runs on a "phase 214-14 seam thread"), so someone removed them after research measured them on 2026-10-20.

## Task Commits

| Task | RED | GREEN |
|---|---|---|
| 1: answer handoff, unsourced note, one failure message, D-14 audit | `9f0a34914` | `b23554309` |
| 2: cancel reads cancelled, resume terminalize, Stop reason, residual (a) | `71d90bd77` | `21078ca97` |
| 3: golden finally, F2 audit, workflow-run reconcile, test_214 seed | `b44601378` | `bfe4e49ac` (+ `2eb44f86f` refactor: the reconciler's sentence moved home) |

## TDD Gate Compliance

- **Task 1 RED:** 19 failed, 5 passed. The failures were the missing helpers, plus 3 and 2 messages where 1 is due, plus `validator_error` holding the validator text. The 5 that passed were plain-output fences. **GREEN:** the verify suites passed, with the one inherited `test_200::test_no_twenty_fifth_audit_kind_was_added`.
- **Task 2 RED:** 12 failed, 19 passed. The 19 include the Task 1 cases plus fences that hold at base (shutdown writes nothing, terminal is never rewritten, a clean resume writes nothing, a clean shell reads completed, a run that ended still expires, the timeout branch). **GREEN:** 31/31.
- **Task 3 RED:** 10 failed, 4 passed. The 4 are absence fences: a finalise error never masks the outcome, F2 cancelled, F2 already-ended, and T-214-14-05. The Task 3 helpers had been drafted before the RED commit, so they were set aside and the two touched files were restored to HEAD for the RED run. The drafts were restored only after the RED commit. **GREEN:** 66 passed across the plan's file and the `test_214` integration suite, run under the local-DB lock.
- No REFACTOR commit.

## G-5 record

Branch counts are from `ast.walk`, base `288e995a9` → HEAD `2eb44f86f`. Triples follow the CLAUDE.md recipe, with six-digit buckets dropped.

| File | Triple base → after | Module If / Try / IfExp / defs |
|---|---|---|
| `harness_engine.py` | 65/26/2926 → 67/26/2957 | 86/30/34/25 → 86/30/34/25 |
| ↳ `_run_phase_with_gates` | 561 → 567 L | If 15 → **15** · Try 4 → **4** · IfExp 7 → **8** (the D-14 expression; ceiling ≤ +1) |
| ↳ `run_workflow` | 1092 → 1098 L | If 19 → **19** · Try 12 → **12** · IfExp 6 → **6** |
| ↳ `_resume_run` | 11 → 15 L | If 0 → **0** · Try 0 → **0** |
| ↳ `resume_stranded_workflows` | 202 → 209 L | If 13 → **13** · Try 3 → **3** · IfExp 3 → **2** |
| `harness/phase_types.py` | 58/30/3052 → 59/30/3053 | If 113 → **113** · IfExp 20 → **19** · defs 55 → **55** |
| `harness/human_input.py` | 3/2/340 → 5/3/355 (**now FIRES**) | If 14 → 15 (the D-49 sibling) · Try 5 → 5 · IfExp 1 → 1 · defs 4 → 4 |
| `harness/engine_ask.py` | 4/1/1338 → 5/1/1344 | If 77 → 78 (the D-49 sibling) · Try 15 → 15 · IfExp 15 → 15 · defs 28 → 28 |
| `harness/run_handoff.py` (young) | 1/1/25 → 5/1/355 | If 0 → 20 · Try 0 → 10 · IfExp 1 → 5 · defs 1 → 17 (every new branch of this plan) |
| `api/runs.py` | 46/21/1893 → 47/21/1907 | If 56 → 56 · Try 26 → 26 · IfExp 32 → 31 · defs 12 → 12 |
| `run_lifecycle.py` | 9/5/756 → 10/6/776 | If 11 → 11 · Try 21 → 21 · IfExp 3 → 3 · defs 11 → 11 |
| `run_producer.py` | 23/11/1145 → 24/12/1150 | If 22 → 22 · Try 22 → 22 · IfExp 20 → 20 · defs 9 → 9 |
| `run_reconciler.py` | 3/2/325 → 5/3/406 (**now FIRES**) | If 14 → 15 · Try 6 → 8 · IfExp 3 → 4 · defs 9 → 10 (the one sweep, the `_reconcile_chat_runs` idiom) |
| `harness/publish_service.py` | 32/14/2001 → 33/15/2008 | If 70 → 70 · Try 17 → 17 · IfExp 24 → 24 · defs 23 → 23 |

Every `harness_engine.py` ceiling in the plan's must_haves is met. `phase_types.py` received exactly two call substitutions (`grep -c "handoff_text("` = 1, `grep -c "surface_unless_engine_owns("` = 1). `human_input.py` had no row in either document for its entire life. Its triple was re-derived BEFORE the edit (3 / 2 / 340; buckets `200`, `200.3`). Its scan-list row, its section in `docs/HOT-FILE-LEDGER.md` and a CLAUDE.md FIRING row landed in `b23554309` and were updated to 5 / 3 / 355 in `21078ca97`. `node scripts/check-claude-md-size.cjs` exits 0. **Owed to plan 07:** rows for `run_handoff.py` and `engine_ask.py` (both new to this phase), plus re-derived triples for the existing rows of the other eight files above. `run_reconciler.py` crossed into FIRING with this plan's touch; its row reads `3 / 2 / 325`.

## Backend unit gate (failing-id SET diff)

Command: `cd backend && venv/Scripts/python -m pytest tests/unit -q --continue-on-collection-errors -p no:cacheprovider -rf`, taken under the local-DB lock. IDs were taken with `grep ^FAILED | sed | sort -u` and compared with `comm`.

- **HEAD `bfe4e49ac`:** **70 failed, 8638 passed**, 1 skipped, 2 xfailed, 2 xpassed (70 ids). The ceiling is 71, so this is within it.
- **Base `288e995a9`:** 125 failed, 8498 passed, 16 errors. ⚠ This base was run from a `git archive` extract in the scratchpad, because a second worktree was not added. The extract has no `.git`, `.env` or `.planning`, so every test that diffs against a commit, or reads `.planning` or the env, fails there. Those are the 55 extra base ids (pure-move, byte-identical and seeds fences).
- **`comm -13` (new at HEAD): one id,** `test_retrieval_service::…test_returns_empty_list_when_rpc_data_is_none`. Its base twin is the same id with log text glued on (`…is_noneC:\Vibe`), the shape 295-01 and 295-03 recorded. **Net new failing ids: 0.**
- To cover what the extract could mask, every HEAD failure was checked against a real base cause. Each of the 70 sits in a suite already inherited at 295-01/03 (retrieval_service 15, sql_service 12, explorer_agent 6, multimodal_query 5, ...). The two non-obvious ones were run directly: `test_200_1::test_this_plan_wrote_no_migration` pins a migration list that predates 124, and the two `test_cross_worker_cancellation` F2 fences are order-dependent and red at base in the same file order.
- **Non-unit suites touching this plan's code** (16 files: resume, human gate, engine-ask re-drive, reconciler, cap-paused, lifecycle, cancel, kill, disable, delete cascade, askuser cleanup, dual-mode, harness_engine, L-01 guard, human-input baseline, thread workflow endpoint), with `-p no:randomly`: HEAD **25 failed / 254 passed**, base **25 failed / 254 passed**. `comm -3` on the two id sets is empty.
- **Integration:** `tests/integration/test_214_argument_seams.py` ran green against the local DB under the lock, including the new D-43 case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1: Bug] D-43's leak was not the teardown; it was the seed's failure exit.**
- **Found during:** Task 3.
- **Issue:** The teardown has existed since `7af6c28f0` and is correct. The 15 rows had no phases and kept their thread. That matches a seed which raised after its `workflow_runs` INSERT and so left before the `yield` (the file's own comment records the illegal-status first run). That exit leaks today too: it now raises an AssertionError instead of skipping.
- **Fix:** `_seed_rows` / `_seed_teardown`. The seed removes what it wrote before raising. A planted-failure integration test proves 0 rows are left.
- **Files:** `backend/tests/integration/test_214_argument_seams.py` · **Commit:** `bfe4e49ac`

**2. [Rule 1: Bug] A resumed run that escapes would have left its active step `active` under a `failed` run.**
- **Issue:** Wrapping `_resume_run` pre-empts `_wake`'s `_fail_redrive`, because its guarded write now loses. `_fail_redrive` was the code that failed the step.
- **Fix:** On the failed arm, `end_run(..., fail_active_phase=True)` fails the step with the same words.
- **Commit:** `21078ca97`

**3. [Rule 3: Blocking] F2's unconditional `finish_run` was kept, not replaced.**
- **Issue:** The two `test_cross_worker_cancellation` F2 fences pin `finish_run` being called with `cancelled` / `failed` through a `None` pool. A replacement whose write is gated on the guard would never reach `finish_run`.
- **Fix:** `record_failed_end` runs FIRST and never raises, so the shipped call is unchanged.
- **Commit:** `bfe4e49ac`

**4. [Rule 3] `test_256_finish_run_unchanged` gained a caller, recorded as a contract change.**
- `services/harness/run_handoff.py: 1`. Its reason is written in the COUNTS block. The positions were re-derived three times, with the counts unchanged for the existing files. `finish_run`'s digest is unchanged.

**5. [Plan file list] `test_250_reconciler_gate.py` and `tests/test_run_reconciler.py` were not edited.**
- `test_250` covers the producer's todo reconcile, which this plan does not touch.
- The new sweep's cases live in `test_295_truthful_run_ends.py`. They drive `_reconcile_workflow_runs` and `reconcile_orphaned_runs` directly, including the lock.
- `test_run_reconciler.py` stays green without edits. Its fake pool's status-filtered `fetch` returns no `active` rows.

**6. [Scope] The golden run's words use the escape's TYPE only.**
- A raised error reads "(RuntimeError)". The exception message is never stored (T-295-04-07).

### Residuals (named, with re-open triggers)

- **(b) from 295-03: the second `action_risk_pending` row on an armed re-drive.** Not fixed. Skipping the announce needs a branch inside the armed block of `_run_phase_with_gates`, whose `If` ceiling is +0, and that block is the ledger's owed `harness_engine.py` seam. The evidence report lists `action_risk_pending` as a recorded decision (`run_evidence._RECORDED_KINDS`), so an approved armed step shows it twice. **Re-open trigger:** the phase that takes the armed-block seam out of `_run_phase_with_gates`, or a UAT row that reads the duplicate on the evidence page.
- **D-19 on a live producer.** A Stop that reaches a live producer (Step 3a, `task.cancel()`) is ended by the producer's own escape (F2 or the resume terminalize). Neither knows who pressed Stop, so no "Stopped by" reason is written there, and 295-05's reader shows its no-reason sentence. Writing a fallback name there would also label a circuit-breaker trip as a person's Stop, because both arrive as the same cancellation. **Re-open trigger:** a Stop that carries its user id onto the Redis cancel broadcast (D-204-03's one stop path).
- **The 2 stuck local runs** end on the next backend boot (D-21). Their before rows are recorded above (read-only). The after rows are plan 07's S7 drive, because this plan does not run the reconciler against the operator's database.
- **SEED-297 is not answered.** The chat sweep's `finalize_run` NULL defect is untouched. The new sweep never calls `finalize_run`.
- **Inherited, not run:** the hanging files (`test_096_ci_workflow_regression`, `test_harness_gates::test_caps_step_and_wall_clock`, `test_harness_templates` e2e). `test_harness_templates.py -k "not end_to_end"` passed 5/5 (about 9 minutes, fixture-bound).
- **Inherited, red at base too:** `test_200::test_no_twenty_fifth_audit_kind_was_added`; `test_096_askuser_cleanup::test_pending_route_filters_dead_prompt_keeps_legacy`; 21 in `test_dual_mode_wiring` (identical IDs at base, measured); and the two `test_cross_worker_cancellation` F2 fences, which are order-dependent (green alone; red at base in the same file order).
- `graphify update .` was not run, because it would write `graphify-out/` inside a parallel worktree. The orchestrator should run it after the merge.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register.
- T-295-04-03/04: `paused`/`cap_paused` are excluded, the age guard is the lease, the write is guarded, and no total column is named (all tested).
- T-295-04-07: no exception text reaches a stored reason.
- T-295-04-08: the Stop reason is the display name or the fallback words, never an email.
- T-295-04-06: a cancel raises, and the timeout branch is unchanged.

## Self-Check

## Self-Check: PASSED

- FOUND: `backend/tests/unit/test_295_prior_output_answer.py`, `backend/tests/unit/test_295_truthful_run_ends.py`, `backend/app/services/harness/run_handoff.py`
- FOUND commits: `9f0a34914`, `b23554309`, `71d90bd77`, `21078ca97`, `b44601378`, `bfe4e49ac`, `2eb44f86f`. `git diff --diff-filter=D 288e995a9 HEAD` is empty.
- Acceptance greps:
  - in `phase_types.py`: `handoff_text(` 1, `surface_unless_engine_owns(` 1
  - in `harness_engine.py`: `cause if diagnosed else gate.error_message` 1; `resume_with_terminalize(` 1 within 12 lines of `async def _resume_run`
  - in `run_handoff.py`: `^from app|^import app` 0; `except BaseException` 2
  - in `run_lifecycle.py`: `"run_cancelled"` 1
  - in `human_input.py`: `"cancel"` 0 → 2, and the `if payload is None:` line is unchanged
  - in `run_reconciler.py`: `async def _reconcile_workflow_runs` 1, `_reconcile_workflow_runs(pool)` 1, the reconciler sentence 1, and no `finalize_run` inside the sweep
  - in `run_producer.py`: `run_failed` 0 → 1
  - `git diff 288e995a9 -- backend/app/db/workflows.py` is empty (no audit kind added)
- STATE.md and ROADMAP.md were not touched.
