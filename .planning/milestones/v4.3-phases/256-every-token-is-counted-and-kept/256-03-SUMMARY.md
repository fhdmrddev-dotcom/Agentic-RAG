---
phase: 256-every-token-is-counted-and-kept
plan: 03
subsystem: metering
tags: [METER-05, tokens, finalize, producer-shell, eval-rollup, D-256-08]
requires:
  - "256-01 (site 3 closed; persist_run_usage owns the workflow_runs grain)"
provides:
  - "Four producer shells finalize with the segment box's real token totals"
  - "The eval job's companion runs row carries BOTH graded arms' spend"
  - "Five new missing-usage warnings, one shared identifier-only literal, all BEFORE their finalize"
affects:
  - "backend/app/api/runs.py"
  - "backend/app/services/harness/publish_service.py"
  - "backend/app/services/scheduler_service.py"
  - "backend/app/services/eval_runner_service.py"
tech-stack:
  added: []
  patterns:
    - "run_producer.py:229-247 — measure, WARN, then write (copied at four sites)"
    - "harness_engine.py:3078-3112 (256-01's site 3) — the in-repo precedent for the shell shape"
    - "eval_runner_service.py:852-855 — a run-LOCAL accumulator declared above the loop (shape only)"
key-files:
  created:
    - "backend/tests/unit/test_256_producer_shells.py"
    - "backend/tests/unit/test_256_eval_usage_rollup.py"
  modified:
    - "backend/app/api/runs.py"
    - "backend/app/services/harness/publish_service.py"
    - "backend/app/services/scheduler_service.py"
    - "backend/app/services/eval_runner_service.py"
decisions:
  - "D-256-08 honoured: the four remaining shells fixed; site 3 was 256-01's, site 7 stays REGISTERED (SEED-299)"
  - "The eval WITHOUT arm's SPEND is counted; its VERDICT still is not — a spend rollup does not inherit a verdict narrowing"
  - "The eval judge shot is NOT counted: decided, commented in the source, registered in SEED-300"
  - "The eval accumulator is THREADED DOWN as an argument, not returned — widening the 3-tuple would fuse spend into with_outcomes"
  - "Two comment rewordings were made so the plan's literal grep criteria can be run verbatim (see 'The two grep criteria that forced a reword')"
metrics:
  base_sha: "383beb3f58c9322ae5ba5726082acc5eb5b88dd3"
  tasks: 2
  commits: 4
  new_test_cases: 57
  completed: 2026-09-19
---

# Phase 256 Plan 03: The Producer Shells and the Eval Rollup Summary

**Five `finally:` blocks stopped throwing away a number that was already measured.** Four
producer shells now read the live segment box (`ctx.run_usage_box`) instead of writing the
literal `input_tokens=None`, and the eval job — which has no box at all, and never could —
gets a run-local accumulator summing **both** paid arms of every case.

**Base SHA asserted:** `383beb3f58c9322ae5ba5726082acc5eb5b88dd3`. The worktree started on
`658cb8547` (the default branch) and was reset; the bootstrap ran first, with a literal path.

## Commits

| Commit | Gate | Message |
|---|---|---|
| `a9c94b802` | RED | `test(256-03): RED for the four producer shells that drop the token count` |
| `3b273dacf` | GREEN | `fix(256-03): four producer shells write the segment's real token totals` |
| `7e1e89fc5` | RED | `test(256-03): RED for the eval job's run-level token rollup` |
| `ad13a2586` | GREEN | `fix(256-03): eval jobs finalize with the real spend of BOTH graded arms` |

Diffstat against base — **exactly the plan's `files_modified`, nothing else**:

```
45   4  backend/app/api/runs.py
85   4  backend/app/services/eval_runner_service.py
22   2  backend/app/services/harness/publish_service.py
24   2  backend/app/services/scheduler_service.py
363  0  backend/tests/unit/test_256_eval_usage_rollup.py
658  0  backend/tests/unit/test_256_producer_shells.py
```

`STATE.md` and `ROADMAP.md` are untouched. No `frontend/` file, no migration, no package
install (`requirements.txt` / `package.json` absent from the diff — T-256-SC clear).

---

## The arithmetic, per file (D-256-13 — the numbers, not the adjective)

| File | `input_tokens=None` | `logger.warning(` | warn-literal | `try:` | `def ` | new fns | `finalize_run_terminal(` |
|---|---|---|---|---|---|---|---|
| `backend/app/api/runs.py` | **2 → 0** | 5 → **7** | 0 → **2** | 23 → 23 | 10 → 10 | **0** | 0 → 0 |
| `backend/app/services/harness/publish_service.py` | **1 → 0** | 9 → **10** | 0 → **1** | 16 → 16 | 23 → 23 | **0** | 0 → 0 |
| `backend/app/services/scheduler_service.py` | **1 → 0** | 1 → **2** | 0 → **1** | 8 → 8 | 8 → 8 | **0** | **1 → 1** |
| `backend/app/services/eval_runner_service.py` | **1 → 0** | 3 → **4** | 0 → **1** | 15 → 15 | 27 → 27 | **0** | 0 → 0 |

- **`+1` warning per file** — five new call sites in total, all the one shipped literal.
- **Zero new functions and zero new `try` blocks** at every site. The only new branch per
  site is the single `if` the warning needs.
- **`finalize_run_terminal(` in `scheduler_service.py` is `1` before and `1` after.** Site 5
  was not "normalised" to `finalize_run`; a swap would have left the run in `runs:active`
  as a GHOST with a live Kill button (`scheduler_service.py:282-286`).
- **`workflow_runs` in `api/runs.py`: 21 → 22**, and the `+1` is a **comment** saying the
  cumulative grain is NOT written here. Proven mechanically rather than asserted: the
  parametrised fence `test_no_shell_started_writing_the_workflow_grain` strips comments and
  asserts no `persist_run_usage(` **call** and no import of it in any of the three files.

**The token-read shape, at all five sites, checked by the plan's exact grep:**

```
grep -cE '\.get\("input_tokens", 0\)|\.get\('input_tokens', 0\)|input_tokens"\) or 0|\.get\("output_tokens", 0\)|output_tokens"\) or 0'
  app/api/runs.py:0
  app/services/harness/publish_service.py:0
  app/services/scheduler_service.py:0
  app/services/eval_runner_service.py:0
```

No default, no `or 0`. An absent key stays `None` all the way to the column (D-256-06):
`NULL` means *never measured*, `0` means *measured as zero*, and collapsing them is what
would make an uninstrumented run indistinguishable from a free one in Phase 257's dollars.

---

## Task 2 — the eval path

### Threading approach chosen, and why

**A run-local `usage_acc: dict` threaded DOWN as an argument** (`run_eval_job` →
`_run_arm` → `_run_arm_body`), *not* a widened return tuple.

| | threaded accumulator (chosen) | widened 3-tuple (rejected) |
|---|---|---|
| `return` statements in `_run_arm_body` | **1 → 1** (unchanged) | 1 → 1, but the tuple's shape changes |
| `with_outcomes` | untouched, still `list[tuple[str, str, bool \| None]]` | must be sliced at the append, or it starts carrying spend |
| WITHOUT arm at `:901-908` | return still discarded; the accumulator rides down | the discarded return must be captured and split |
| new signature params | 2 (`usage_acc=None` on two functions, default-off) | 0, but 2 unpack sites and 1 annotation change |

`256-PATTERNS.md` §7 is explicit that solving this by making `with_outcomes` carry tokens
would *"fuse two rollups with different denominators into one list"* — the exact thing the
comment at `:852-855` exists to prevent. Threading keeps the verdict channel and the spend
channel separate by construction, and `usage_acc=None` leaves both functions byte-identical
for any caller that does not pass it.

**Where the fold happens:** immediately after the `finally: duration_ms = …` that closes the
loop call, **above** the D-04 grading gate. The provider billed for the arm whether or not
the judge could grade it, so an errored or empty arm's measured tokens still belong in the
run's spend.

### The two decisions this task owed

1. ⭐ **The WITHOUT arm IS counted.** `with_outcomes` deliberately counts the WITH arm only
   (`:852-855`, OQ3) — correct for a **verdict denominator**, wrong for a **spend total**,
   because the provider served both arms and billed for both (D-256-12's own logic). The
   fence `test_the_without_arm_is_counted_and_is_not_thrown_away` drives `[(0,0), (77,7)]`
   and requires `77`; a rollup that had inherited the narrowing would read `0`.
2. ⛔ **The judge shot is NOT counted — decided, not forgotten.** `_judge_eval_answer`
   (`:648`) is a third paid call per graded arm whose usage is measured **nowhere** in the
   codebase; counting it would mean instrumenting the forced-emit seam, which is a different
   file and a different requirement. **Registered in `SEED-300`**, named in the source beside
   the accumulator (`grep -c "SEED-300"` → `1`), and pinned twice: once by a source fence
   requiring the register reference, once behaviourally —
   `test_the_judge_shot_is_not_folded_into_the_rollup` asserts the rollup equals the two
   arms' loop totals **exactly**, so a silently-folded third source could not pass.

### The fences the eval task carries

| Fence | Result |
|---|---|
| `grep -c "run_usage_box" eval_runner_service.py` | **0** — its ONE writer is `harness_engine.py:1864` inside `run_workflow`, which this service never calls |
| module-global token state (`^_[a-z_]*tokens\|^[A-Z_]+_TOKENS`) | **0**, plus a runtime scan of `vars(module)` and a line-level LHS scan (T-256-17) |
| two concurrent jobs | `asyncio.gather` of two jobs → `200` and `2`, not `202` |
| `eval_results` (migration 080) | **0 added/removed diff lines** mention it; the per-arm writes still receive `(10,1),(20,2)` in a drive |

---

## Counterfactuals — every new fence was driven RED against a planted defect

A guard nobody has seen fire is not a guard. Three were planted, observed failing, and the
source restored.

| Fence | Planted defect | Result | Restore proof |
|---|---|---|---|
| `test_no_shell_started_writing_the_workflow_grain` | `await persist_run_usage(pool, run_id, 1, 1)` above `finalize_run_terminal` in `scheduler_service.py` | **FAILED** `[app/services/scheduler_service.py]` | md5 `0fe949ca1d928d36c9ce4bc9f8015d82` before and after |
| `test_the_eval_path_never_reaches_for_ctx_run_usage_box` | `usage_acc = getattr(object(), 'run_usage_box', None) or {}` | **FAILED** | md5 `dd9035d9b538b29748cba469c05a0e22` before and after |
| `test_there_is_no_module_global_token_accumulator` | `_RUN_TOKENS: dict = {}` at module scope | **FAILED** | same restore |

**Both RED gates were recorded from TARGETED runs, never from a full-gate figure** (D-256-15,
zero headroom): task 1 RED was `23 failed, 18 passed` with every one of the four drives
reaching the real `finally` and reading the literal (`assert None == 1234` at all four
sites); task 2 RED was `9 failed, 5 passed` with the companion row reading `(None, None)`
where the two arms measured `(33, 3)`.

### ⚠ A restore method that was WRONG, recorded because it cost a silent revert

The first counterfactual was restored with **`git checkout -- <file>`**, and that **discarded
the uncommitted GREEN edit along with the plant** — `git checkout --` restores from the
index, not from a working state. It was caught only because the next grep read
`input_tokens=None: 1` and `runs.usage missing: 0` on a file that had just been green. The
site-5 edit was re-applied and re-verified (md5 back to `0fe949ca…`).

⛔ **For an uncommitted file, copy it to the scratchpad first and restore from the copy.**
The two eval counterfactuals were done that way and are provably byte-identical. This is the
same class as the project's existing lesson that `git checkout -- <dir>` is not a restore.

---

## The two grep criteria that forced a reword (a deviation, stated as one)

Two of the plan's acceptance criteria are **literal greps over a whole file**, and in both
cases my first implementation satisfied the *intent* while failing the *grep* — because the
comment explaining the rule contained the very token the grep forbids.

| Criterion | First cut | Why it failed | Resolution |
|---|---|---|---|
| `grep -c "run_usage_box" eval_runner_service.py` → `0` | a comment reading *"⛔ NOT `ctx.run_usage_box` — its only writer is `harness_engine.py:1864`"* | the warning label IS the forbidden token | reworded to *"the harness's run-level usage box"*, keeping the line number and the reason |
| `grep -c "input_tokens=None"` → `0` | a comment quoting the literal it had just removed | same | reworded to *"hardcode a NULL usage"* |

A third, milder case: the accumulation seed was first written with the canonical in-repo
idiom `(usage_acc.get("input_tokens") or 0) + int(in_tok)` — the exact shape of
`phase_types._record_run_usage:786-789`. It is semantically correct (it runs only when the
arm measured something, so it can never turn an unmeasured job into `0`), but it matches the
plan's forbidden `or 0` pattern. **Rewritten explicitly** rather than exempted:

```python
if in_tok is not None:
    _prev_in = usage_acc.get("input_tokens")
    usage_acc["input_tokens"] = int(in_tok) if _prev_in is None else _prev_in + int(in_tok)
```

⚠ **Worth naming for the phase, because it is a rule-design finding rather than a coding one:**
a grep-checkable rule and a self-documenting comment pull against each other, and this plan
resolved it three times in favour of the grep. That is the right call for an *auditable* rule —
a rule needing a case-by-case exemption is a rule nobody can run — but it means the warning
labels in these files now describe the forbidden identifier instead of naming it. The fences
themselves are unaffected: they still red on any real reintroduction.

---

## Verification

### 1. Targeted suites (per task)

```
tests/unit/test_256_producer_shells.py + test_token_accumulator_missing_usage.py  →  46 passed
tests/unit/test_256_eval_usage_rollup.py + test_eval_forced_emit.py
  + test_196_judge_model_db_backed.py                                             →  36 passed
```

New cases collected across the two files: **57**.

### 2. ⛔ THE BACKEND BASELINE — SET-DIFFED IN BOTH DIRECTIONS, NEVER COUNTED

```
71 failed, 5005 passed, 2 xfailed, 2 xpassed, 45 warnings in 391.33s
```

Names extracted with `grep "^FAILED"`, `\r` stripped, cut at `" - "` (not on whitespace),
`sort -u` — then `comm` against `256-BASELINE-backend-failing-set.txt`:

```
mine=71  base=71
--- APPEARED (in mine, not baseline) ---
--- VANISHED (in baseline, not mine) ---
```

**Both directions empty. The failing SET is byte-identical to the committed 71 names.**
Nothing appeared, so nothing is owed an explanation; nothing vanished, so no baseline name
was accidentally repaired-or-hidden. ⚠ `SEED-301`'s known flake
(`test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments`, which makes
two real billed OpenAI calls) did **not** appear in this run — recorded as an observation, not
as evidence that it is fixed.

### 3. Nearest existing suites to the touched seams

```
test_scheduler_circuit_breaker.py  test_085_task_service.py  test_db_runs.py
test_244_cap_paused_lock_bound.py  test_196_judge_model_db_backed.py
test_256_producer_shell_site3.py                    →  3 failed, 110 passed
```

All three failures are `tests/unit/test_db_runs.py::{test_insert_run_passes_args_positionally,
test_insert_assistant_message_sql_shape, test_insert_assistant_message_optional_fields_none}`
and **all three are present verbatim in the committed 71-name baseline** — inherited, and
confirmed so by the full-suite set diff above rather than by inspection.

### 4. `node scripts/check-hot-file-ledger.cjs 256` — **exit 1**, and it is NOT this plan's row

```
scan list: 290 rows · subject: 29 files · watched: 9
G-5 CANNOT FIRE ON 1 FILE(S) — they have no ledger row:
  [no-row] backend/app/services/forced_emit.py   (named by 256-04-PLAN.md)
```

All four files this plan modifies **have** rows. The single `[no-row]` is
`backend/app/services/forced_emit.py`, named by **plan 256-04**, which owns that file,
`CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` and is running in parallel. ⛔ This plan did not
edit either register — that would have collided with the sibling's worktree.

**Re-derived triples for this plan's four files (post-commit, including this plan's own
commits), so the phase close can apply them in one edit:**

| File | ledger row at base | **re-derived at this close** |
|---|---|---|
| `backend/app/api/runs.py` | `38 / 17 / 1695` | **`39 / 18 / 1736`** |
| `backend/app/services/harness/publish_service.py` | `26 / 11 / 1810` (256-02's correction) | **`27 / 12 / 1830`** |
| `backend/app/services/scheduler_service.py` | (row present; not in the CLAUDE.md firing table) | **`6 / 3 / 421`** — ⚠ **3 phases: G-5 FIRES on the next touch** |
| `backend/app/services/eval_runner_service.py` | `12 / 7 / 959` | **`13 / 8 / 1040`** |

All four are **honoured by construction**: no new function, no new `try`, no new state, one
`if` per site, and the writer at each site unchanged.

### 5. `node scripts/check-extension-contract.cjs` — **exit 0**

```
extension contract gate OK — all 6 files conform to closed-core contract (0 violations).
```

This plan modifies none of the six trigger files.

### 6. Frontend — **SKIPPED, deliberately** (D-256-14)

Zero `frontend/` files modified, so `vitest-count-gate.cjs` has no subject. No figure is
quoted from it, because the gate is non-deterministic at base (`failed 3` then `failed 0` on
a byte-identical tree at cap 2) and a number quoted from an unrun gate is worse than none.

---

## Deviations from Plan

### 1. [Rule 3 — blocking] `git checkout --` discarded an uncommitted edit during a counterfactual

- **Found during:** Task 1, restoring after the planted `persist_run_usage` call.
- **Issue:** `git checkout -- app/services/scheduler_service.py` restored from the index,
  removing the GREEN site-5 edit along with the plant.
- **Fix:** re-applied the edit, re-ran (46 passed), and confirmed md5 `0fe949ca…` matched the
  pre-plant reading. Both later counterfactuals used a scratchpad copy instead.
- **Files modified:** `backend/app/services/scheduler_service.py` (restored to intended state).
- **Commit:** `3b273dacf`.

### 2. [Rule 3 — blocking] Two comment rewordings to satisfy literal grep criteria

Documented in full under *"The two grep criteria that forced a reword"*. No behaviour change;
the fences are unaffected. Committed in `3b273dacf` and `ad13a2586`.

### 3. [Rule 1 — bug, in my own test] The first grain fence fired on its own warning label

`test_no_shell_started_writing_the_workflow_grain` originally asserted
`"persist_run_usage" not in text` and went red on the comment that exists to *prevent* the
defect. Rewritten to strip comments and assert on a **call** or an **import**, then driven RED
against a planted call to prove it still fires. Commit `3b273dacf`.

---

## Authentication gates

None. No credential, no provider call, no network egress in either task.

## Known Stubs

None. Every value written reaches a real column; no placeholder, no hardcoded empty.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access and no schema change.
The five new log sites are the only new surface and are covered by T-256-14 in the plan's own
register (one shared identifier-only literal, pinned positively and negatively, with an
`isinstance(arg, int)` assertion at every call site so a token value cannot ride the line).

---

## What the next plan should know

1. **`scheduler_service.py` now measures 3 phases — G-5 FIRES on the next touch.** Its ledger
   row needs the `6 / 3 / 421` triple and a verdict; a phase that modifies it must read
   `docs/HOT-FILE-LEDGER.md` first.
2. **`SEED-300` is now referenced from shipped source** (`eval_runner_service.py`). If that
   seed is ever closed, the source comment is one of the registers that must move with it.
3. **Site 7 (`run_reconciler.py:245`) is still `input_tokens=None`, by decision** (SEED-299) —
   the process is gone, so a stranded run's count is genuinely unknowable in memory. A
   phase-level `grep -rn "input_tokens=None" backend/app` therefore returns **2**, not 0:
   `run_reconciler.py:245` (registered) and `run_lifecycle.py:369` (a default PARAMETER, not
   a site). Both are expected; neither is a gap.
4. **The `input_tokens=None` and `run_usage_box` greps are now zero-tolerance across these
   four files even in comments.** A future plan documenting these seams must describe the
   identifiers rather than spell them, or relax the fences deliberately with the reason in the
   test body — the retirement discipline this repo already requires.

## Self-Check: PASSED

Created files:

```
FOUND: backend/tests/unit/test_256_producer_shells.py
FOUND: backend/tests/unit/test_256_eval_usage_rollup.py
```

Commits (all four resolve in `git log`):

```
FOUND: a9c94b802   FOUND: 3b273dacf   FOUND: 7e1e89fc5   FOUND: ad13a2586
```
