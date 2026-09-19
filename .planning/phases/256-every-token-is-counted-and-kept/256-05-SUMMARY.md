---
phase: 256-every-token-is-counted-and-kept
plan: 05
subsystem: harness / metering
tags: [metering, tokens, workflow_runs, judge, forced_emit, gap-closure, registers]
gap_closure: true
gap_closure_round: 1
requires:
  - "harness_engine.run_workflow's phase loop and its CircuitBreaker (256-01/02)"
  - "db.workflows.persist_run_usage + TOKEN_COVERAGE_LEGS (256-02, migration 182)"
  - "forced_emit's ladder accumulators (256-04)"
  - "phase_types._record_run_usage (256-04, the one wired call site)"
provides:
  - "harness_engine._flush_run_usage — the ONE home of the durable token write, reached from 2 call sites"
  - "every exit from the phase loop persists the phase that just ran (pause_run / fail_run / dangling skip_to / completed)"
  - "both in-run judge shots' tokens reach a persisted total (D-256-18 Option A)"
  - "a ten-site forced_emit disposition SET fence that fails on an eleventh"
  - "the written-down meaning of the token_coverage \"emit\" leg, where the durable column comment points"
affects:
  - "Phase 257 METER-07 — the blind-spot view now reads a marker that is TRUE rather than over-claiming"
tech-stack:
  added: []
  patterns:
    - "one home + one unconditional call above the arm dispatch (the phase_types.py:1586 precedent, one layer up)"
    - "caller-supplied usage_box (the task_service / eval_runner_service house pattern) where no ctx exists"
    - "accumulators declared ABOVE a retry loop, initialised None never 0 (the forced_emit ladder precedent)"
    - "disposition SET fences over a re-derived call-site set, never a count"
key-files:
  created:
    - backend/tests/unit/test_256_run_exit_usage_flush.py
    - backend/tests/unit/test_256_judge_usage_counted.py
  modified:
    - backend/app/services/harness_engine.py
    - backend/app/services/harness/validator_kinds.py
    - backend/app/services/harness/publish_service.py
    - backend/app/db/workflows.py
    - backend/tests/unit/test_256_finish_run_unchanged.py
    - backend/tests/unit/test_256_producer_shells.py
    - .planning/seeds/SEED-300-three-token-holes-surviving-phase-256.md
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - .agent-bus/OPEN.md
decisions:
  - "D-256-18 Option A applied: COUNT the judge spend, so the four-leg token_coverage claim becomes TRUE rather than being lowered. Option B (narrowed legs + a second migration) stays REJECTED."
  - "No migration, no fifth leg. Migration 182's COMMENT ON COLUMN delegates the legs' meaning to db.workflows.TOKEN_COVERAGE_LEGS verbatim, so growing what a leg COVERS cannot falsify the durable comment."
  - "A try/finally around the phase loop was REJECTED (an unshielded await in a finally changes which exception leaves the engine on a user Stop); the crashed/cancelled-phase residual is registered in SEED-300 instead."
  - "tests/unit/test_256_producer_shells.py's grain fence NARROWED from FILE scope to SHELL-FUNCTION scope — the round's one judgement call, flagged to the reviewer as the thing to revert if disputed."
metrics:
  duration: ~3.5 h
  completed: 2026-09-19
  base_sha: a9cc2fbc43caf1c5242f460b6c8454e80423c155
  tasks: 3
  commits: 6
---

# Phase 256 Plan 05: Every Exit Counted, Both Judges Counted Summary

Closed the two ROADMAP criteria Phase 256 failed: one nested `_flush_run_usage` plus one
unconditional call above the outcome-arm dispatch makes every exit from the harness phase loop
persist the phase that just ran, and both in-run judge shots' tokens now reach a persisted total —
so the unconditional four-leg `token_coverage` marker stops over-claiming by becoming TRUE.

**Base SHA built on: `a9cc2fbc43caf1c5242f460b6c8454e80423c155`** (asserted after a reset — the
worktree started on the default branch, the known trap; `git merge-base` read
`658cb8547588ba16572dee766b7a4ee4af7aaf61` before the correction).

## Commits

| # | Hash | Message |
|---|---|---|
| 1 | `8438680d6` | `test(256-05)`: RED for the phase-loop usage flush |
| 2 | `d24d47d48` | `feat(256-05)`: one flush site (CR-01 / SC#1) |
| 3 | `4225aac19` | `test(256-05)`: RED for counting both judge shots |
| 4 | `7ed44ab10` | `feat(256-05)`: count both judge shots (CR-02 / SC#4) |
| 5 | `2e3d98d85` | `docs(256-05)`: SEED-300 answered, five ledger rows re-derived |
| 6 | `cd6f15a00` | `docs(256-05)`: BUS-272 completion evidence to gemini |

TDD gate sequence: `test(...)` → `feat(...)` twice, in order. No `refactor(...)` commit — none was
needed.

---

## RED-first evidence

⛔ **Reported as two separate populations, because a case that was GREEN on first run is not
evidence and must not be counted as such.**

### Task 1 — 4 RED of 11 cases

Verbatim, from the run against the tree at the base commit:

```
E       AssertionError: A PAUSED RUN PERSISTED NOTHING. The phase billed real tokens and then
        the run returned from the pause arm, which is reached AFTER the phase-boundary
        enforcement and BEFORE the phase-completed one — so neither _enforce_budget call site
        ever sees this phase's spend, and ctx.run_usage_box is reset to {} on the next segment.
        This is CR-01.
E       assert []

E       AssertionError: A FAILED RUN PERSISTED NOTHING. fail_run is reached only after
        _run_phase_with_gates has exhausted its retries, so this is the most expensive phase
        whose spend was being dropped on the floor.
E       assert []

E       AssertionError: A RUN KILLED BY A DANGLING SKIP TARGET PERSISTED NOTHING — the third of
        CR-01's three ordinary returns.
E       assert []

E       AssertionError: no unconditional `await _flush_run_usage()` at statement level in the
        phase loop body — a flush nested inside an if/try only covers the arms someone
        remembered, which is the defect CR-01 found.
E       assert []
```

Verdict line: `4 failed, 7 passed`. Every red is `assert []` — no usage write was reachable from
the arm — which is red for the RIGHT reason and not a malformed fixture. The pause arm was proven
to be genuinely entered (`SET status = 'paused'` in the SQL log, `policy_applied` audit row).

⚠ **A first attempt at this file was red for the WRONG reason and is reported rather than
quietly fixed:** `HumanInputTimeout("...")` raised `TypeError: HumanInputTimeout.__init__() takes 1
positional argument but 2 were given` — its signature is keyword-only
(`tool_call_id=`, `timeout_seconds=`). Corrected before any implementation was written.

**The other 7 cases were GREEN pre-change and are REGRESSION PINS, not RED evidence:** the
N-phases→N-writes count, the watermark-idempotency case, the no-usage-then-pause case, the
no-box-ctx case, the armed-trip case, the one-home AST fence, and the branch-count fence.

### Task 2 — 12 RED of 22 cases

```
E       AssertionError: THE IN-RUN JUDGE SHOT'S TOKENS WERE NOT COUNTED. `forced_emit` reported
        them and the gate dropped them, while `token_coverage`'s `"emit"` leg claimed to cover
        every forced_emit-borne shot inside a harness run. This is CR-02.

E       AssertionError: A FAILED JUDGE SHOT'S BILLED TOKENS VANISHED. The recording must sit
        ABOVE the failure arm; below it, only the cheap outcomes are ever counted.

E       AssertionError: THE QUAL-01 STAGE PERSISTS NOTHING. `_judge_golden_output` has no ctx and
        no live run_usage_box (its golden run's box was closed and finalized by
        `_drive_golden_run`'s finally BEFORE this line), so the caller is the only place that can
        write the judge's spend. This is CR-02's publish half.

E       TypeError: _judge_golden_output() got an unexpected keyword argument 'usage_box'

E       AssertionError: `usage_box` must be KEYWORD-ONLY; kwonly args are
        ['definition', 'final_output', 'pool', 'owner_settings']

E       AssertionError: no `None`-initialised input-token accumulator found
```

Verdict line: `12 failed, 10 passed`. **The 10 that passed pre-change are pins**: the ten-site
disposition fence, the four-`NO-RUN`-hosts argument, the no-migration fence, the METER-05
`input_tokens=None` set, and the `persist_run_usage`-body fence.

### The two planted defects — a guard nobody has seen fire is not a guard

**Plant 1 — an eleventh `forced_emit` call site.** Created
`backend/app/services/_plant_eleventh_site.py` with one `await forced_emit(...)`:

```
E       AssertionError: the `forced_emit` call-site file SET changed.
E           appeared (needs a disposition): ['services/_plant_eleventh_site.py']
E           vanished: []
```

The fence fires and **names** the new site. **Removal proven by ABSENCE, not by timing:**
`ls` → `No such file or directory`; `find backend/app -name "_plant_eleventh_site*"` → empty;
`git status --short backend/app/services/` lists only the two intended modifications.

**Plant 2 — the validator's recording moved BELOW its failure arm** (the actual defect the
placement exists to prevent):

```
E       AssertionError: A FAILED JUDGE SHOT'S BILLED TOKENS VANISHED. ...
E       assert 636 < 630
E        +  where 636 = min([636])
E        +  and   630 = min([630])
```

Both the behavioural case and the AST ordering fence fired. **Removal proven by md5:**
`validator_kinds.py` = `93fe383607db0e6130933988531869ce` before the plant and after the restore.
`publish_service.py` = `355987c1cffb5f135c9d63cc841e8f21` before and after its own plant
(see the fence-narrowing section).

---

## By-construction arithmetic, per modified file

⛔ Counts, not adjectives (the `249-02` precedent).

| File | Property | Before → After |
|---|---|---|
| `harness_engine.py` | `_enforce_budget` `if` / `try` / loop | **2 / 0 / 0 → 2 / 0 / 0** |
| | `_flush_run_usage` def + calls (AST) | 0 → **1 def, 2 calls** (`defs:[1888] calls:[1968, 2320]`) |
| | `persist_run_usage` call sites in module | 1 → **1** (one home) |
| | `cancel_phase` / `finish_run` / escape-arm edits | **0 → 0** |
| `validator_kinds.py` | new branches | **0** (1 function-local import + 1 call) |
| | `PROGRAMMATIC_VALIDATOR_REGISTRY`, `EMITTER_REGISTRY`, `@register_validator` | **untouched** |
| `publish_service.py` | `_judge_golden_output` positional args | **`[]` → `[]`** (keyword-only throughout) |
| | new kw-only params | 4 → **5** (`usage_box: dict \| None = None`) |
| | accumulators | 0 → **2**, above the loop, `None`-initialised |
| | new stage word / `blocked_stage` / audit kind / migration | **0 → 0** |
| `db/workflows.py` | `persist_run_usage` body | **byte-unchanged** (AST-pinned) |
| | `TOKEN_COVERAGE_LEGS` | **`('agent','single','batch','emit')` → identical** |
| | non-comment lines changed | **0** — the change is comment-only |

---

## Backend failing SET diff — both directions, never a count

Canonical command, run in `backend/` with the venv:
`pytest tests/unit -q --continue-on-collection-errors`

**Verdict line, verbatim:**

```
71 failed, 5062 passed, 2 xfailed, 2 xpassed, 44 warnings in 225.67s (0:03:45)
```

Diffed as SETS against `.planning/phases/256-.../256-BASELINE-backend-failing-set.txt`
(`comm -13` / `comm -23`, `grep -c` for the counts):

```
=== ADDED (new failures — must be EMPTY) ===
(empty)
=== REMOVED (fixed since baseline) ===
(empty)
```

**0 collection errors** (the verdict line reports no `errors` term; the `ERROR` lines in the log
are captured logger output from PASSING tests, not collection failures).

⚠ **A TRAP THAT WOULD HAVE MADE THIS DIFF USELESS, and it fired on the first attempt:** the
baseline file is **CRLF**, so a naive `comm` against LF-normalised output reported **all 71 names
in BOTH directions** — which reads exactly like a catastrophe and means nothing. `tr -d '\r'` first.

**The intermediate readings are published because the trajectory is the evidence:**

| Point | failed | Added-direction diff |
|---|---|---|
| after Task 1 | **72** | `test_256_finish_run_unchanged.py::test_the_finish_run_call_site_set_is_unchanged` |
| after Task 2 (first pass) | **73** | 2 × `test_256_producer_shells.py[publish_service.py]` |
| final | **71** | **empty** |

Each was a real fence, and each is accounted for below rather than absorbed.

### The finish_run fence — its own sanctioned bookkeeping update

`test_the_finish_run_call_site_set_is_unchanged` failed with per-file **counts identical** and only
**positions moved** (`2315/2356/2638 → 2390/2431/2713`, +75 lines — exactly my insertion). That is
the case the fence's own docstring names: *"If (a) passed and this fails, ONLY line numbers moved …
That is a bookkeeping update: re-derive with `grep -rn "await finish_run(" backend/app/`, update
`_EXPECTED_CALL_SITES`, and say so in the commit."* Done, with each original recorded beside its
correction. **No caller appeared and none vanished** — the contract half was never red.

---

## ⚠ THE ROUND'S ONE JUDGEMENT CALL — a shipped fence was NARROWED

`tests/unit/test_256_producer_shells.py` fired twice on `publish_service.py`. **The plan never
mentioned this file**, so neither failure was anticipated. They were answered **differently**, and
the asymmetry matters:

**(a) `test_no_token_read_uses_a_default_or_an_or_zero` — answered in MY CODE, fence untouched.**
The rule is right (`NULL` means never measured, `0` means measured as zero — D-256-06). The first
draft used a truthiness fallback on a token key; respelled as `x if acc is None else acc + x`.
⚠ **The SECOND draft still failed, because a COMMENT of mine quoted the forbidden spelling
verbatim** and that fence is pure text with **no comment stripping** — while its sibling three
tests down *does* strip comments (`line.split("#", 1)[0]`). So the rule for this file is *do not
SPELL it*, prose included; the asymmetry is now documented in source.

**(b) `test_no_shell_started_writing_the_workflow_grain` — the fence was NARROWED from FILE scope
to SHELL-FUNCTION scope. This is the one change in this round a reviewer should scrutinise.**

The argument, in full, so it can be overturned:

* The fence's **own stated property** — its first docstring line and this module's header — is
  *"a segment shell must never write the cumulative total"* / *"no shell may start writing the
  workflow grain"*. **The unit is a SHELL, not a file.**
* In two of its three subject files those coincide. In `publish_service.py` they do **not**: the
  file hosts **both** a segment shell (`_drive_golden_run`, whose `finally` terminalizes the
  per-segment `runs` row `_producer_id`) **and** the workflow-grain owner (the QUAL-01 stage,
  holding `golden_run_id`, a `workflow_runs` row created inside that same shell).
* **So the file-scoped form forbade the CORRECT write.** D-256-18 (operator ruling, Option A)
  requires the publish judge's tokens to be counted, and measurement says the QUAL-01 stage is the
  **only** place that can write them — by the time the judge runs, `_drive_golden_run` has returned
  and its `finally` has already read `ctx.run_usage_box` and finalized the shell. There is no ctx
  and no live box.
* **No grain is mixed and nothing is summed across the two tables**, which is the entirety of what
  D-256-03 forbids. The write is additive, onto the same `workflow_runs` row the phase boundary
  already wrote to; `_producer_id` is untouched, pinned separately by
  `test_the_persist_targets_the_workflow_runs_grain_and_not_the_producer_shell`.
* **The narrowing was driven RED against the defect the fence was built for**, not assumed
  harmless: a `persist_run_usage` call planted inside `_drive_golden_run`'s body still fires it,
  **naming the shell** — `app/services/harness/publish_service.py:1483 imports the workflow_runs
  cumulative writer inside the segment shell '_drive_golden_run' (D-256-03)`. Plant removal
  md5-proved: `355987c1cffb5f135c9d63cc841e8f21` before and after.
* The fence's own history supports the move: it had **already been narrowed once** for the same
  class of over-breadth (from the bare identifier to *a call or an import*, *"a guard that reds on
  its own warning label"*).

⛔ **Alternatives considered and rejected.** Moving the persist to `api/workflows.py` (the only
caller of `publish_workflow`) would put a `workflow_runs` token write in an API route, require
threading the box out through the publish result dict (a wire-shape change), and land in a hot file
with an extraction already OWED. Using a different writer would duplicate the one-home writer.

**If the reviewer disagrees, the fence is the thing to revert — not the feature.** Flagged as such
in BUS-272.

---

## Hot-file ledger — re-derived triples, FOUR of five were STALE

Recipe run verbatim (six-digit dated quick-task buckets subtracted).

| File | CLAUDE.md row said | plan's 2026-09-19 pre-flight | **measured at this landing** | stale? |
|---|---|---|---|---|
| `harness_engine.py` | `54 / 20 / 3135` | `57 / 21 / 3215` | **`58 / 21 / 3290`** | **yes** |
| `harness/validator_kinds.py` | `14 / 6 / 762` | `14 / 6 / 762` | **`15 / 7 / 791`** | **yes** |
| `harness/publish_service.py` | `27 / 12 / 1830` | `27 / 12 / 1830` | **`28 / 12 / 1939`** | **yes** |
| `db/workflows.py` | `48 / 25 / 2585` | `50 / 26 / 2677` | **`52 / 26 / 2724`** | **yes** |
| `harness/phase_types.py` *(NOT modified)* | `53 / 26 / 2937` | `54 / 27 / 2954` | **`54 / 27 / 2954`** | yes — recorded as an observation |

⚠ **`validator_kinds.py` was stale in BOTH registers AT DIFFERENT VALUES** — `docs/HOT-FILE-LEDGER.md`'s
scan list read `12 / 5 / 749` while CLAUDE.md read `14 / 6 / 762`, against a measured `15 / 7 / 791`.
**That is worse than one stale row: a reader who cross-checks gets two confident answers and no
correct one.** Both are now corrected, and both originals are recorded beside the correction.

Every row and its detail-file section moved **in the same commit** (`2e3d98d85`), per the
same-commit sync rule; the verdict is in the capped cell and the reasons are in the section.

⚠ **`check-claude-md-size.cjs` FIRED on my own prose** — `[disposition-too-long] 213 chars (cap
200)` on the `phase_types.py` row — and was answered by shortening the cell, never by touching the
cap. A guard catching the author in the same turn is the guard working.

---

## Registers

**`SEED-300`** — `status: planted` → **`partially-answered`**, `partial: true`, with a
`status_note`. ⚠ `status:` IS the index; a note in the body would have been invisible to the sweep.

* **Hole #2 recorded CLOSED by plan 256-03, VERIFIED IN SOURCE rather than inherited from a
  SUMMARY:** `eval_runner_service.py:971` reads `usage_acc=usage_acc,  # Phase 256 (METER-05) —
  you were billed for this arm too`, and `:888` declares `usage_acc: dict = {}` above the loop with
  the keys-stay-absent note (D-256-06).
* **Stale `relates_to` pins corrected beside their originals:** `:648` → `:289` (the judge shot
  `_judge_eval_answer`), `:901` → `:971`; `:344` (its `forced_emit` call — the line hole #3 is
  actually about) and `:888` added.
* **Three residuals of THIS round added, each with a concrete trigger** (§4/§5/§6): the raised
  `forced_emit` rung (IN-03), the crashed/cancelled harness phase, and the pre-round-1 local-dev
  rows. `trigger_when` and `trigger_paths` were left otherwise intact — a narrowed trigger is a
  silent deletion.

**Seeds sweep (`--phase 256`) fires on exactly the ten seeds the plan predicted**, and the
disposition of only ONE was changed:

| Seed | Disposition this round |
|---|---|
| SEED-300 | **UPDATED** → `partially-answered`, hole #2 closed, 3 residuals added |
| SEED-266, 284, 290, 291, 292, 295, 296, 298, 301 | **LEAVE** — routed at the phase open; this round changes nothing for them. Editing a seed this round did not answer would be register churn dressed as diligence, and widening scope inside a closure round is what G-7 exists to stop. |

---

## Gate results — each one's own counts, never the exit code alone

| Gate | Result |
|---|---|
| backend unit (`tests/unit`) | **71 failed / 5062 passed / 2 xfailed / 2 xpassed / 0 collection errors**; failing SET diffs **empty both directions** |
| `backend/tests/` fences (invisible to the baseline) | **106 passed, 3 failed — all three PROVEN INHERITED** (below) |
| `tests/unit/test_256_token_sum_narrowing.py` (METER-04 Fence 1) | **12 passed** |
| `grep -rn "input_tokens=None" backend/app` (METER-05) | **exactly 2**: `run_lifecycle.py:369`, `run_reconciler.py:245` |
| `check-hot-file-ledger.cjs .../256-...` | **OK** — `scan list: 291 rows · subject: 32 files · watched: 10` (≥ 4, non-vacuous) |
| `check-claude-md-size.cjs` | **OK** — `108342 chars · 72.2% of limit · headroom 41658`; no `[duplicate-row]`, no `[malformed-row]` |
| `check-seeds-register.cjs` | **OK** — `308/308 parsed · 0 duplicate ids · 308/308 carry all 5 required keys` (non-collapsed) |
| `check-seeds-register.cjs --phase 256` | **OK** — 10 triggers fire, listed above |
| `check-gap-closure-rounds.cjs 256` | **G-7 clear** — `plans: 5 total · 1 gap-closure`, `highest explicit gap_closure_round: 1`, rounds completed **1** (cap 2), **no new capability** |
| `check-extension-contract.cjs` | **OK** — 6/6 closed-core files conform, 0 violations |
| `git status --short supabase/` | **empty**; `ls supabase/migrations/ \| grep -c "^18[3-9]"` → **0** |
| `git status --short frontend/` | **empty** — frontend untouched, so the vitest count gate was **not run** |
| `requirements*.txt` / `package.json` / lockfiles | **byte-unchanged** — T-256.05-SC holds; no package was installed |

⚠ **The two unswept seed figures, reported separately and NEVER summed** (the smaller number alone
is the comfortable lie that rule exists to end): **134 carry no `trigger_when` at all · 114 carry
prose but no structured trigger.**

### The three `backend/tests/` failures are INHERITED — proven by measurement, not by unchangedness

⛔ Established the way CLAUDE.md requires — by checking the modified source out **at the base
commit** and re-running, never by comparing against a number in a doc:

```
git checkout a9cc2fbc4 -- backend/app/services/harness_engine.py backend/app/db/workflows.py
pytest tests/test_200_human_gate_pause.py::test_no_twenty_fifth_audit_kind_was_added \
       tests/test_096_askuser_cleanup.py::test_pending_route_filters_dead_prompt_keeps_legacy \
       tests/test_120_origin_filter.py::...::test_phase_types_ask_user_prompt_tags_harness
→ 3 failed
```

All three fail **identically** with the source at the base. `test_no_twenty_fifth_audit_kind_was_added`
asserts `len(_AUDIT_EVENT_TYPES) == 24` against a measured **25** — a pre-existing drift; **this
plan added no audit kind.**

⚠ **Both pause-arm source-slicing fences PASS** — `test_the_pause_arm_does_none_of_the_three_forbidden_things`
and `test_write_lands_before_emit_in_the_pause_arm`. The new flush sits at `:2320`, **outside** the
sliced region entirely, which is one more reason the single-site shape was chosen.

⚠ **A METHOD MISTAKE OF MINE, RECORDED BECAUSE IT COST WORK:** `git checkout <base> -- <paths>`
**destroys uncommitted changes in those paths.** My Task-1 implementation edits were not yet
committed, so proving the inheritance wiped them and both had to be re-authored. **Commit first,
then check out the base.** (No `git stash` was used — it is shared across worktrees and forbidden
here.)

---

## Measurements that DISAGREED with the plan or its inputs

Every one is recorded **beside** the original, never over it.

| Claim | Source | Measured |
|---|---|---|
| `_enforce_budget` has **3** `if`s; expect 3/0/0 | 256-05 acceptance criteria | **2** `if`s (`armed` + `_tripped` short-circuits). 2 → 2 across the change. |
| `grep -c "_flush_run_usage"` reports **3** | 256-05 acceptance criteria | **4** — one hit is a DOCSTRING MENTION. Executable count is 3 (AST). **A grep cannot tell code from prose.** |
| Migration 182's delegating phrase: *"grep-verified, 1 hit each"* in the migration AND `full-schema.sql` | 256-05 `must_haves` | **0 hits in the migration, 1 in `full-schema.sql`** — the migration splits the sentence across two adjacent SQL literals which Postgres concatenates on apply. **The FACT holds; the stated verification method did not.** The fence normalises literals before matching. |
| `run_reconciler.py:236` | `256-VERIFICATION.md` | **`:245`** — `256-CONTEXT.md` D-256-08 was right. Confirmed independently here. |
| `validator_kinds.py` row agrees at `14 / 6 / 762` | 256-05 `<measured_corrections>` §5 | **stale, and stale in BOTH registers at DIFFERENT values** (`12/5/749` in the detail file). |
| `publish_service.py` / `harness_engine.py` / `db/workflows.py` pre-flight triples | 256-05 §5 | all three moved again by this plan's own landings; published as a trajectory. |
| `test_256_producer_shells.py` is not in scope | 256-05 (silence) | **two of its fences fired on `publish_service.py`** — one answered in code, one narrowed. |
| `HumanInputTimeout(str)` | my own first draft | keyword-only: `tool_call_id=`, `timeout_seconds=`. |

---

## Deviations from Plan

### Auto-fixed / measured-and-corrected

**1. [Rule 3 — blocking] `test_256_finish_run_unchanged.py` line pins re-derived**
- **Found during:** Task 1 (baseline SET diff, +1 name)
- **Issue:** the insertion shifted three `await finish_run(` positions by +75 lines
- **Fix:** the fence's OWN sanctioned bookkeeping update — per-file counts were identical, so no
  caller appeared or vanished; positions re-derived by grep, originals kept beside the corrections
- **Commit:** `d24d47d48`

**2. [Rule 3 — blocking] `test_no_token_read_uses_a_default_or_an_or_zero` answered in my code**
- **Issue:** a truthiness fallback on a token key, then (second draft) a COMMENT quoting the
  forbidden spelling into a fence that strips no comments
- **Fix:** accumulators respelled `x if acc is None else acc + x`; comment reworded. **Fence
  untouched.**
- **Commit:** `7ed44ab10`

**3. [Rule 4-adjacent — SURFACED, not silent] `test_no_shell_started_writing_the_workflow_grain`
narrowed from FILE to SHELL-FUNCTION scope.** Full argument in its own section above and in the
fence's docstring; flagged to the reviewer in BUS-272 as the thing to revert if disputed. **This is
the one change in this round that is a judgement rather than a measurement.**

**4. [method] the AST rewrite of my own ordering fence** — its first draft fired on the
implementation's comment, which legitimately quotes the failure arm. Rewritten with `ast`. Two
sub-traps measured: **a text fence cannot tell code from a comment**, and **`ast.unparse`
normalises string literals to single quotes**.

### Scope held

No new capability, column, endpoint, view, surface or migration. `TOKEN_COVERAGE_LEGS` is still a
4-tuple; `persist_run_usage`'s body is byte-unchanged; `supabase/` and `frontend/` are clean.
METER-04 and METER-05 were asserted intact, not rebuilt.

---

## What this round did NOT prove

⛔ Stated plainly, because a scoreboard that lists only what passed is not a scoreboard.

* **No `kill -9` mid-phase, and no proof a value survives a process boundary.** Every case here
  reads the SQL the pool was handed. `tests/integration/` was not run and is invisible to the
  71-name baseline.
* **No crashed/cancelled-phase durability.** A phase that raises or is cancelled mid-work still
  loses its delta from `workflow_runs`. The `try`/`finally` that would cover it was **rejected**
  with its reason written into source; the residual is `SEED-300` §5 with a trigger.
* **No raised-rung token recovery.** A `forced_emit` shot that raises returns no dict; nothing was
  manufactured for it (`SEED-300` §4 / IN-03).
* **No live cross-provider UAT of a judge shot's reported usage.** Every judge case patches
  `forced_emit` with a known token-bearing result, so this proves the plumbing carries what a
  provider reports — **not** that any of the eight providers reports it. No row of the 4-axis
  scoreboard was run.
* **No production evidence.** Migration 182 is in neither `origin/master` nor `origin/production`,
  so there was nothing in production to read; no Supabase MCP write was made or needed.
* **One green sample proves nothing about the flaky suites.** None of `SEED-171`'s five went red,
  but the frontend was untouched and the count gate was not run at all.
* **This plan's own verification is the BUILDER's.** Per AGENTS.md 6.3 the builder does not verify;
  gemini has the evidence at **BUS-272**. Nothing here should be read as an independent review.

---

## Self-Check: PASSED

Created files:

- FOUND: `backend/tests/unit/test_256_run_exit_usage_flush.py`
- FOUND: `backend/tests/unit/test_256_judge_usage_counted.py`
- FOUND: `.planning/phases/256-every-token-is-counted-and-kept/256-05-SUMMARY.md`

Commits (all present in `git log`):

- FOUND: `8438680d6` · FOUND: `d24d47d48` · FOUND: `4225aac19` · FOUND: `7ed44ab10`
- FOUND: `2e3d98d85` · FOUND: `cd6f15a00`

Plant removals:

- ABSENT: `backend/app/services/_plant_eleventh_site.py` (intended)
- md5 identical: `validator_kinds.py` `93fe383607db0e6130933988531869ce`
- md5 identical: `publish_service.py` `355987c1cffb5f135c9d63cc841e8f21`

⚠ **STATE.md and ROADMAP.md were NOT modified** — worktree mode; the orchestrator owns those writes.

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired data source was introduced.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change at a trust boundary.
The one new write reaches an existing parameterised writer (`$1..$4`, `WHERE id = $1`) whose body
was not edited; `T-256.05-01` through `-06` are all `mitigate` and all addressed above, and
`T-256.05-SC` holds (no package installed, every lockfile byte-unchanged).
