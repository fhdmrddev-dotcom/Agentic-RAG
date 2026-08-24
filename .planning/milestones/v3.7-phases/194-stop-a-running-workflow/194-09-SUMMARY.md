---
phase: 194-stop-a-running-workflow
plan: 09
subsystem: backend-run-lifecycle
tags: [cancel, zombie-heal, workflow-runs, workflow-phases, RUN-01, SC#2, fences]
requires: ["194-01", "194-06"]
provides:
  - "backend/app/services/run_lifecycle.py::cancel_workflow_run_internals — the ONE exported workflow-side cancel composition (finish_run + cancel_active_phases), called by Step 3b and by plan 194-10's no-producer arm"
  - "Step 3b's workflow co-write, with the anchor READ ordered before the shipped 092-03 clear"
  - "eight validation rows (V-09..V-13, V-17..V-19) behind nine RED-driven fences"
affects: ["194-10", "194-11", "194-12", "194-13"]
tech-stack:
  added: []
  patterns: ["one-composition-two-callers", "per-op best-effort try/except (D-062-13)", "late-import at the call site", "call-ORDER assertions over source greps", "AST-scoped source fences", "value-scoped negative fences", "correct-beside-not-over"]
key-files:
  created: []
  modified:
    - backend/app/services/run_lifecycle.py
    - backend/tests/test_062_cancel_run.py
    - backend/tests/test_run_lifecycle.py
decisions:
  - "The composition is MOVED (not copied) from delete_workflow_cascade into one exported helper — D-08/D-10's 'one mechanism' on the server side"
  - "No is_app_shutting_down() gate on Step 3b, and the gate's IDENTIFIER is not spelled anywhere in run_lifecycle.py — so a raw grep counts 0 and any occurrence means the gate was ADDED"
  - "The shipped standalone 092-03 anchor clear is kept unchanged — the wf_id-is-None arm and the Deep path's no-op"
  - "V-10 is asserted by call ORDER, because against a MOCK the wf_id-is-None consequence does not reproduce"
  - "F-11's plant is the structural form (un-wrap the EXPIRE try) — it was constructible honestly, so the weaker form was not used"
metrics:
  tasks: 3
  commits: 4
  duration: ~75m
  completed: 2026-08-16
---

# Phase 194 Plan 09: Step 3b's workflow co-write Summary

The zombie arm now terminalizes **`workflow_runs` and its interrupted `workflow_phases` row**
through ONE exported composition — so a Stop that lands on the worker where the producer task is
dead is a real Stop, not a chat-side one. `WORKER_COUNT=2` with a **per-process `RUN_TASKS`** dict
makes that roughly **half of all missed Stops**, not an edge case.

**Plan 194-10's no-producer arm calls the SAME helper** rather than re-composing the two writes.

---

## Base assertion — the wrong-base streak continued and is now 6 out of 6 in this phase

```
git rev-parse --abbrev-ref HEAD  → worktree-agent-ae1c5c22675995017        (namespace OK)
git merge-base HEAD b096db88     → 3781a3fe4690a9619e619f4cc412bd37a7dafc52   ✗ WRONG BASE
git reset --hard b096db88        → HEAD is now at b096db88 chore: merge executor worktree (194-06)
git rev-parse HEAD               → b096db8881f00d5c8bf7c34d90ffd23e3057846e   ✓ BASE OK
```

Same wrong base (`3781a3fe`) every worktree in this phase has forked from. `bootstrap-worktree.sh`
ran as the first action and reported `BOOTSTRAP OK` (both junctions attached, both env files
copied). The dispatch brief predicted it; it happened.

---

## What was built

### Task 1 — the co-write + the exported composition (TDD: RED `7d931381` → GREEN `e306e55b`)

**`cancel_workflow_run_internals(*, pool, workflow_run_id)`** — `db.workflows.finish_run` with
status `'cancelled'`, then `db.workflows.cancel_active_phases`, both late-imported (S3), with the
supabase-string → `UUID` coercion the shipped Step 3b already applies to `thread_id`. It carries
**its own `try/except` + `logger.exception` and never raises**, so a second caller inherits the
D-062-13 discipline instead of having to remember it. Added to `__all__` with the reason written
beside it.

**Step 3b** gained, in this order: the anchor READ (own `try/except`) → `if wf_id:` → the helper →
**then** the byte-unchanged shipped 092-03 standalone clear.

| Property | How it is held |
|---|---|
| Read BEFORE the clear | `finish_run` keys its own clear on `active_workflow_run_id = $1`; if the standalone clear ran first the id is gone and the row is unreachable **forever** |
| Deep path byte-identical | the `if wf_id:` guard — a Deep run has `active_workflow_run_id IS NULL` |
| Never fails the cancel | per-op `try/except`; the discriminator returns regardless |
| Discriminator unchanged | still `"zombie_healed"` — D-11 inherited, not re-decided; no new user-facing verb |

**CONTEXT D-09 is corrected BESIDE its original wording, in the code**, because the correction
changes the argument rather than a detail. D-09 said *"the thread anchor is never cleared ⇒ the
thread is permanently wedged."* Measured, **the anchor IS cleared** (092-03, unconditionally, right
below). The gap is real and only the consequence was wrong — and the true one is worse in a
different way: `workflow_runs.status='active'` forever with **no anchor pointing at it**, invisible
to `find_resumable_runs` (which requires `t.active_workflow_run_id = wr.id`), so no sweep will ever
touch it while it still renders as a live run. **An orphaned lie, not a lock.**

The **cross-worker interleave** is recorded beside the co-write on **ONE line each** (193.2-08: a
rule written WRAPPED failed its own literal `grep -q` and read as *"already fixed"*) — benign **by
value-identity, not by exclusion**, and the one prohibition that *is* the whole guard: the two
writes must never disagree.

### Task 2 — the scope fences (`3bd2f625`)

Five cases in `test_run_lifecycle.py`: the Deep-path zero-counts, **two independent** shutdown-gate
assertions, the Redis-outage contract, and the D-085-04 sentinel ordering.

### Task 3 — the phase-honesty fences (`1b4b7ae2`)

Two cases in `test_062_cancel_run.py`, asserted on the SQL and binds handed to a pool double that
**INTERPRETS** the predicate rather than merely recording it.

---

## Fences — nine RED observations, every one against a REAL production-source plant

Every plant was applied to production source, the suite run, the plant reverted **in a `finally:`**
(the 194-06 lesson — that prober crashed before its revert and left a plant behind), and the file
**md5-verified byte-identical** afterwards.

| # | Fence | Plant (real, in production source) | Cases that RED | md5 after revert |
|---|---|---|---|---|
| 1 | **F-2** (V-10) | `run_lifecycle.py` — anchor READ moved BELOW the shipped 092-03 clear | `…reads_the_anchor_before_the_shipped_clear` **only** (1 failed / 8 passed) | `09ee9545…` ✓ |
| 2 | **F-3** (V-11) | `run_lifecycle.py` — `if wf_id:` → `if True:` | `…deep_run_takes_step_3b_without_entering_the_workflow_branch` **only** (1/16) | `09ee9545…` ✓ |
| 3 | **F-4a** (V-12a) | `run_lifecycle.py` — `and not is_app_shutting_down()` added to the branch | `…step_3b_carries_no_app_shutdown_gate` **+ 3 Task-1 cases** (4/13) | `09ee9545…` ✓ |
| 4 | **F-4b** (V-12b) | `run_producer.py` — the gate DELETED from the F2 `if` | `…f2_terminalize_still_carries_the_app_shutdown_gate` **only** (1/16) | `88d53876…` ✓ |
| 5 | **F-11** | `run_lifecycle.py` — the `try/except` around `EXPIRE` **deleted** | `…redis_outage_cannot_fail_the_stop` **only** (1/16) | `09ee9545…` ✓ |
| 6 | **F-12** | `run_lifecycle.py` — `task.cancel()` moved **before** the sentinel publish | `…cancel_sentinel_is_published_before_task_cancel` **only** (1/16) | `09ee9545…` ✓ |
| 7 | **F-5** (V-18) | `db/workflows.py` — predicate widened to `status IN ('active','completed')` | `…leaves_completed_and_every_other_terminal_phase_untouched` + 2 in `test_workflow_phase_cancel.py` (3/22) | `e6332472…` ✓ |
| 8 | **F-6 / `'failed'`** (V-19) | `db/workflows.py` — `status='cancelled'` → `'failed'` | `…writes_the_failed_or_skipped_vocabulary` + 4 (5/20) | `e6332472…` ✓ |
| 9 | **F-6 / `'skipped'`** (V-19) | `db/workflows.py` — `status='cancelled'` → `'skipped'` | same 5 (5/20) | `e6332472…` ✓ |

### The multi-clause requirement is PROVED, not claimed — in three independent places

- **F-4's two arms are provably two fences.** Plant (a) reds arm (a) and leaves arm (b) **green**;
  plant (b) reds arm (b) and leaves arm (a) **green**. Neither plant can red the other. 194-03
  shipped four REQUIRED plants that all red on the same clause, which would have left a second
  clause inert and indistinguishable from live — that is the failure this split measures away.
- **F-5 reds V-18 and leaves V-19 green; F-6 reds V-19.** Two different defects, two different
  fences, in both directions.
- **V-09 and V-17 are separate cases**, so a plant breaking the run write cannot hide behind the
  phase write or vice versa.

### ⚠ F-2's RED taught something the plan expected differently, and it is stated rather than smoothed

The plan predicted the V-10 assertion would red *"because `wf_id` is then `None`"*. **Against a MOCK
it is not.** A supabase double keeps returning whatever it was seeded with regardless of when it is
asked, so under the F-2 plant **V-09 and V-17 both stayed GREEN** — a `wf_id is not None` assertion
would have passed under exactly the defect it was meant to catch. **The recorded call ORDER is the
only thing that moves here**, which is why it is what is asserted, and the reasoning is written into
the double's own docstring so the next reader does not "simplify" it back. The plan's instruction to
assert by ORDER was right; its stated mechanism was not, and both are recorded.

### ⚠ A REGRESSION PIN was correctly GREEN on the RED run, read case-by-case rather than by count

Task 1's RED was **4 failed / 5 passed**. The 5th new case
(`…workflow_cowrite_preserves_the_shipped_arms`) asserts only things that were already true, so it
passing pre-change is correct: its job is to red if the co-write ever DAMAGES a shipped arm, not to
prove the co-write exists. Its docstring now says so, in the exact place a later reader would
otherwise mistake it for a vacuous fence. **Reading a RED run case-by-case is the only way that
distinction is visible** (194-06 caught a genuinely vacuous fence this way).

### ⚠ F-6's SCOPE PROOF is checked in-fence, not assumed

The plan asked for confirmation that the fence stays green with `db/workflows.py`'s legitimate
`failed`/`skipped` docblock prose in place. It does — and the fence now **asserts that the module
source still contains both words** while the composed value contains neither. If the prose ever
disappears, the fence fails loudly with a message saying it has stopped demonstrating anything,
rather than quietly becoming a tautology.

The expected slug is **derived from BOTH migrations by grep, never re-typed**: migration 119's
`'x'::text` literals below `BEGIN;` **minus** migration 115's, asserted to be exactly `{"cancelled"}`.
Scoping below `BEGIN;` is load-bearing — 119's header quotes all seven literals in prose, so a
whole-file scan would read the documentation as the constraint.

### ⚠ F-11 — which plant form was used, and the honest limit of the contract

The **structural** form the plan preferred: the `try/except` around Step 3b's `EXPIRE` was deleted
in production source, so a Redis op raises **outside** its try. It was constructible honestly, so
the weaker everything-inside-its-try form was not needed. **The honest limit is recorded in the
fence's docstring rather than papered over:** three of the four shipped Step-3b `except` clauses
catch `(RedisError, OSError)` and **not** bare `Exception`, so an arbitrary non-Redis exception from
a Redis client *would* escape. The fence therefore raises `RedisError` specifically — that is the
contract that actually ships.

---

## ⚠ An unrelated defect was MEASURED, not assumed: `_APP_SHUTTING_DOWN` leaks across tests

F-4a's plant red **three Task-1 cases in a different file**, which the plan did not predict. The
cause was probed directly rather than reasoned about:

```
BEFORE any client fixture: False
DURING client:             False
AFTER client teardown:     True
```

The shared `client` fixture is `with TestClient(app) as c:`, so its teardown runs the app lifespan's
shutdown handler (`app/main.py:511-512`), which sets the process-global `_APP_SHUTTING_DOWN` to
`True` **for the rest of the pytest process**. Every case in `test_062_cancel_run.py` after the
first therefore runs mid-"shutdown" — which is *why* the F-4a plant reached them, and is incidental
extra evidence for arm (a)'s property.

**Consequences honoured rather than exploited:** the arm-(a) fence saves and restores the **prior**
flag value instead of hard-resetting it to `False`, because a fence that silently repaired global
state other suites are running in would be changing the thing it is measuring. The leak is
**pre-existing and out of this plan's scope** — no production file was touched for it, and it is
recorded here so a later plan finds a measurement instead of a surprise.

---

## Verification — every figure compared to `194-BASELINE.md`, never to RESEARCH or PATTERNS

| Gate | Baseline / expected | Measured now | Verdict |
|---|---|---|---|
| (c) cancel-path pytest (the 4 baseline files) | **12 passed** | **12 passed** (inside the 38 below) | ✅ unmoved |
| the 6 cancel-path files incl. the new suites | 26 passed / 3 skipped at my base | **38 passed, 3 skipped** | ✅ (+12 new cases; the 3 skips are mig 119 unapplied) |
| (d) backend unit rot, **BY NAME** | **62 failed / 2242 passed** | **62 failed / 2242 passed** | ✅ **0 NEW, 0 DISAPPEARED — set-identical** |
| `grep -c "is_app_shutting_down" run_lifecycle.py` | 0 | **0** | ✅ |
| `grep -c "finish_run(" run_lifecycle.py` | exactly ONE call site | **1** | ✅ |
| `git diff --numstat` on `run_producer.py` / `harness_engine.py` / `api/runs.py` | empty | **empty** | ✅ |
| diff scope | only `files_modified` | the 3 declared files | ✅ |
| deletions across the whole plan | — | **0** | ✅ no shipped line moved |

**The (d) comparison is against `194-BASELINE.md` § (d)'s published 62 names**, not against a
re-run — ⚠ a baseline recaptured *after* the plan's own edits is not a base, and comparing to one
would be circular. I made exactly that mistake mid-plan and caught it; the comparator now parses
the BASELINE list directly.

⚠ **And the by-name parser had to be corrected before it was believed, for the second time in this
phase.** 194-06 recorded pytest's truncated ` - ImportE...` suffix producing 8 phantom regressions.
Mine hit a **second spelling of the same trap**: under output interleaving a Windows path is glued
straight onto a node id with no separator, so `…does_not_reembed` + `C:` was absorbed into the
identifier and the **same test read as a NEW failure AND a DISAPPEARED one simultaneously**. The
comparator now cuts at the drive-letter pattern first. *A by-name comparison is only as good as its
parser.*

⚠ **Frontend gates (a) and (b) were NOT run, and that is a decision.** This plan touches **zero**
frontend files, so the count gate and `tsc` cannot move; running them would burn a vitest slot the
phase's parallel budget reserves for plans that can move them. The sibling agent (194-08) is the
frontend one.

⚠ **No migration was applied to any database.** No `supabase db push`, no `db reset`, no SQL-editor
paste, no edit to `full-schema.sql`. **No test in this plan seeds any table** — the asyncpg pool is
a fake in every case, both workflow writers are patched at `app.db.workflows`, and supabase is an
in-file double. That is what keeps it parallel-safe under CLAUDE.md rule 4 with a sibling agent
active.

---

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 2 — Correctness/honesty] Two acceptance-criterion greps were polluted by my own docblock**

- **Found during:** Task 1, checking the acceptance criteria after GREEN.
- **Issue:** `grep -c "is_app_shutting_down" run_lifecycle.py` returned **2** and `grep -c
  "finish_run("` returned **2** — both from prose I had written explaining the design. The criteria
  require **0** and **exactly one call site**. This is precisely the phase's own fence-discipline
  lesson #3 ("a bare-`grep` needle matches YOUR OWN DOCBLOCK"), which had already tripped 194-02
  twice, 194-03 once and 194-06 once — and it tripped here in **production source** rather than in a
  test.
- **Fix:** the gate's identifier is now spelled **nowhere** in `run_lifecycle.py`, including in the
  prose explaining its absence, with a one-line note saying so and why; and every docstring mention
  of the two writers omits its opening parenthesis so the needle counts CALLS, not mentions. The
  three-reason argument the plan asked to be recorded now lives in **the fence's docstring** in
  `test_run_lifecycle.py`, which is where Task 2 asked for it, with the production docstring pointing
  at it by test name.
- **Why this is the right resolution rather than a workaround:** it makes the needle
  **discriminating** — any occurrence at all now means the gate was ADDED. A needle that also matches
  the prose explaining the thing is absent cannot tell absence from presence.
- **Files:** `backend/app/services/run_lifecycle.py`
- **Commit:** `e306e55b`

**2. [Rule 1 — Bug] The by-name comparator reported phantom regressions**

- **Found during:** Task 1 verification.
- **Issue:** two tests appeared as BOTH new and disappeared — an interleaved Windows path glued onto
  the node id (a second spelling of 194-06's documented trap).
- **Fix:** cut at the drive-letter pattern before matching; re-run set-identical. The comparator is a
  scratchpad tool, not a repo file.
- **Commit:** n/a (tooling, outside the repo)

**3. [Rule 1 — Bug] The arm-(a) fence hard-reset a leaked global**

- **Found during:** Task 2, after probing the `_APP_SHUTTING_DOWN` leak.
- **Issue:** the fence restored the flag to `False` unconditionally, silently repairing process state
  other suites run in.
- **Fix:** save and restore the **prior** value; the reason is recorded in the docstring with the
  probe's three readings.
- **Commit:** `3bd2f625`

### Not a deviation, but recorded

⚠ **The plan's predicted mechanism for F-2's RED is wrong under mocks** — see the fences section.
The instruction (assert by ORDER) was right; the stated reason (`wf_id` becomes `None`) does not
reproduce against a double, and V-09/V-17 stayed green under the plant. Both are recorded.

⚠ **`grep -c "finish_run(" backend/app/services/run_lifecycle.py` returns 1, and that is by
construction rather than by luck** — the docstring deliberately writes the writer names without
their opening parenthesis. A later editor who "tidies" that will break the needle silently.

---

## Hot-file ledger measurement for `backend/app/services/run_lifecycle.py` (handed to plan 194-13)

`run_lifecycle.py` is **not** a row in `CLAUDE.md`'s ledger. Derived here so 194-13 inherits a
measurement rather than re-deriving one — *a hot file missing from the table is permanently
invisible to its own guardrail*.

```
git log --oneline -- backend/app/services/run_lifecycle.py | wc -l      → 4
git log --format=%s -- <file> | sed …| sort -u                          → 145  147  194   (3 buckets)
wc -l <file>                                                            → 437
git show b096db88:<file> | wc -l                                        → 299
```

> **⇒ `4 commits / 3 phases / 437 L` (299 at this plan's base).** **ZERO quick-task buckets** — the
> standard recipe returns exactly three and all three are real phases, unlike
> `WorkflowBuilderPage.tsx` / `api/workflows.py` / `publish_service.py`, whose recipes return
> `260809` / `260814` / `quick` alongside the phases.
>
> **G-5 status, stated in both readings so neither can be quoted as the other: TWO phases had
> touched this file before 194 (below the ≥3 threshold — G-5 did NOT fire when this plan was
> scoped), and THREE have touched it including 194 (at the threshold — G-5 fires from here on).**
> Honoured by construction either way, on a measured test rather than an argument: the plan added
> **one composition of two writes the file's own neighbour already performed**, at
> **138 insertions / 0 DELETIONS**. Zero deletions is what proves no shipped arm moved.
>
> The natural seam, named rather than implied: the two atomic chat co-writers
> (`register_run_start` / `finalize_run_terminal`) versus the three-step cancel discipline
> (`_cancel_run_internals`) versus the new workflow-side composition. **The next phase adding a
> genuinely SECOND concern here owes a refactor recommendation FIRST, and it inherits
> `4 / 3 / 437`.** ⚠ These three numbers go stale on the next commit that touches the file, which
> can be the same afternoon.

⚠ **This SUMMARY does not edit the `CLAUDE.md` row** — that file is not in this plan's
`files_modified`, and Phase 194's ledger deliverable (D-02) is plan 194-13's.

---

## Threat model — dispositions honoured

| Threat ID | Disposition | How |
|---|---|---|
| T-194-09-01 (EoP, `_cancel_run_internals`) | **transfer** | The new helper's docstring states explicitly that it performs **no ownership check** and names the CALLER as the enforcer (T-147-06), matching `_cancel_run_internals` and both `db/workflows.py` writers. Plan 194-10 adds the owner-scoped, anchor-confirmed gate for the new id shape. **The anchor read here deliberately omits the `.eq("user_id", …)` the `api/runs.py` precedent carries** — this helper is not an authorization boundary and must not pretend to be one. |
| T-194-09-02 (Tampering, `workflow_runs`/`workflow_phases`) | mitigated | Every write goes through `finish_run` / `cancel_active_phases` with `$N` binds; **no f-string reaches SQL** and this plan composes none. The `AND status='active'` predicate is fenced by F-5 against a real widened-predicate plant, behaviourally as well as by shape. |
| T-194-09-03 (DoS, a legitimate Stop) | mitigated | Every new op has its OWN `try/except` + `logger.exception`; the helper never raises. F-11 proves a Redis outage still returns `"zombie_healed"` **and still lands both Postgres writes**. |
| T-194-09-04 (Info disclosure, error paths) | mitigated | `logger.exception` only, with run/thread ids and no run content, prompt or provider payload; no stack trace reaches the client (T-062-03). |
| T-194-09-05 (Repudiation, restart-resumability) | mitigated | F-4's **two independently-driven plants** prove Step 3b carries no shutdown gate AND that F2 still does. Arm (b) is **AST-scoped**, so the docblocks that explain the gate cannot satisfy it. |
| T-194-09-06 (Tampering, a paused approval) | mitigated | F-12 pins `publish_cancel_sentinel` before `task.cancel()` by recorded call sequence — `BUG-260808-02`'s folded half. |
| T-194-09-SC (pip installs) | n/a | **No package added.** No `requirements.txt` change; the new tests import only stdlib + pytest + app modules. |

**No `GroundingBundle.degraded` surface is touched** — nothing in this plan imports, reads or writes
anything in `harness/grounding.py`, so the red line about `degraded` feeding `/validate` and the
publish gauntlet is untouched by construction.

---

## Known Stubs

None. The composition is complete and both callers' halves exist: Step 3b calls it here, and
`cancel_workflow_run_internals` is exported for plan 194-10's no-producer arm. **194-10 wiring
`api/runs.py` is this plan's explicit non-goal, not a stub.**

## Threat Flags

None. This plan opens no network endpoint, adds no auth path, no file access and no schema change.

---

## Files

| File | Change |
|---|---|
| `backend/app/services/run_lifecycle.py` | **+138 / −0** (the exported composition + Step 3b's anchor read, guard and call; the shipped standalone clear and all four shipped arms byte-untouched) |
| `backend/tests/test_062_cancel_run.py` | **+502 / −0** (5 co-write cases + 2 phase-honesty fences + the recording supabase and predicate-interpreting pool doubles) |
| `backend/tests/test_run_lifecycle.py` | **+370 / −0** (5 scope fences + the cancel-surface Redis and anchor doubles) |

**Zero deletions across the whole plan** — no shipped assertion was edited, which is the acceptance
criterion "`git diff` shows additions only", measured rather than claimed.

## Commits

- `7d931381` — `test(194-09): add failing cover for the zombie arm's workflow co-write`
- `e306e55b` — `feat(194-09): co-write the workflow run + its interrupted phase on the zombie arm`
- `3bd2f625` — `test(194-09): fence the Deep path, the shutdown-gate scope, Redis best-effort and D-085-04`
- `1b4b7ae2` — `test(194-09): fence completed-phase survival and the failed/skipped vocabulary`

## TDD Gate Compliance

RED (`test(…)` `7d931381`, **4 failed / 5 passed** — read case-by-case, the 5th being a regression
pin that is correctly green) → GREEN (`feat(…)` `e306e55b`, 9 passed) → no REFACTOR commit was owed.
Both gates present and in order. Tasks 2 and 3 are pure-fence tasks whose RED evidence is the eight
production-source plants above rather than a failing-first commit — each fence was observed to FAIL
against a real defect and then to pass on the restored tree.

## STATE / ROADMAP / REQUIREMENTS

**Untouched by design.** No `gsd-sdk query state.*`, no `roadmap.update-plan-progress`, no
`requirements.mark-complete` was invoked. `git diff --numstat b096db88 HEAD` names exactly three
files, all under `backend/` (this SUMMARY excepted). Nothing auto-flipped a REQ-ID or a roadmap
checkbox, so nothing needed reverting.

## Self-Check: PASSED

- `backend/app/services/run_lifecycle.py` — FOUND
- `backend/tests/test_062_cancel_run.py` — FOUND
- `backend/tests/test_run_lifecycle.py` — FOUND
- `7d931381` / `e306e55b` / `3bd2f625` / `1b4b7ae2` — all FOUND in `git log`
- working tree clean (`git status --short` empty before this SUMMARY); all three planted production
  files md5-identical to their pre-plant state (`09ee9545…`, `e6332472…`, `88d53876…`)
