---
phase: 256-every-token-is-counted-and-kept
round: 1
gap_closure_round: 1
reviewed: 2026-09-19T00:00:00Z
depth: deep
diff_base: 8a59851451a61a23a543e5627db29b184c57ee57~1
diff_head: 1a2e602575b18c2ec2c33a5df316ae5655d30411
files_reviewed: 8
files_reviewed_list:
  - backend/app/services/harness_engine.py
  - backend/app/services/harness/validator_kinds.py
  - backend/app/services/harness/publish_service.py
  - backend/app/db/workflows.py
  - backend/tests/unit/test_256_run_exit_usage_flush.py
  - backend/tests/unit/test_256_judge_usage_counted.py
  - backend/tests/unit/test_256_producer_shells.py
  - backend/tests/unit/test_256_finish_run_unchanged.py
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
round0_findings_closed: [CR-01, CR-02]
---

# Phase 256 round 1: Code Review Report

**Reviewed:** 2026-09-19
**Depth:** deep (cross-file: engine → breaker → writer; validator → phase_types; publish stage → writer)
**Files Reviewed:** 8 (4 source, 4 test)
**Status:** issues_found — **0 BLOCKER**

## Summary

**Both round-0 criticals are CLOSED in the source, and I verified each against the code rather than
against the SUMMARY.** No BLOCKER was found: I can construct no input or state that makes this
round's code produce a wrong number, a lost delta on the three arms it names, a double-book, a
crash, or a grain violation. The four warnings are all about the **durability of the closure** —
guards that cannot fire for the case they claim to cover — not about wrong behaviour today. On
correctness grounds a round 2 is **not** owed.

### The four questions the orchestrator asked, answered from source

**1. The narrowed fence (`test_256_producer_shells.py`) — the reasoning is CORRECT. Do NOT revert
the fence.** I tested the executor's position rather than adopting it, and it survives:

- `golden_run_id` really is a `workflow_runs` row — `create_workflow_run(...)` at
  `publish_service.py:1597`, inside `_drive_golden_run`. `_producer_id` really is the separate
  `runs` shell (`uuid4()` at `:1620`, `insert_run`/`finalize_run` at `:1625`/`:1718`).
- The QUAL-01 stage really is OUTSIDE the shell: `_drive_golden_run` is a module-level `def` at
  `:1473` and the judge runs at `:425-431` inside `publish_workflow` (`:64`), after
  `asyncio.wait_for(_drive_golden_run(...))` returned at `:298` **and** after that function's
  `finally` (`:1700-1731`) already read `ctx.run_usage_box` and called `finalize_run` on
  `_producer_id`. There is genuinely no ctx and no live box at `:458`.
- `golden_run_id` cannot be `None` at `:458`: every path between `:298` and `:425` that leaves it
  unset returns via `_block` first (`:316`, `:332`, `:367`, `:400`).
- **No grain is mixed.** The new write targets `golden_run_id` only; `_producer_id` is not named in
  the call. The file-scoped form of the fence did forbid the write D-256-18 mandates.

**Did the narrowing hide a real grain violation? No — measured, not assumed.** I enumerated every
function in the three subject files that calls `insert_run(` / `finalize_run(` / `create_workflow_run(`
and checked each against the narrowed fence's line coverage:

| file | lines the narrowed fence still scans | shell-like functions left OUTSIDE coverage |
|---|---|---|
| `app/api/runs.py` | 593 / 1736 (34%) | **none** — `_wake` (`:656-707`) and `_harness_continuation` (`:1295-1379`), both METER-05 finalize sites, are NESTED inside `continue_run` / `_redrive_paused_workflow_run` and are fully covered |
| `app/services/harness/publish_service.py` | 259 / 1939 (13%) | **none** |
| `app/services/scheduler_service.py` | 110 / 421 (26%) | **none** |

So today the narrowing is precise. **What can slip past that could not before** is stated in
**WR-03** — and the `assert shells, ...` guard is *not* sufficient protection against it.

**2. Idempotency of `_flush_run_usage()` — holds, on both halves, re-derived not inherited.**
- `circuit_breaker.py:173` `if not box: return (0, 0)` → a `None` box, an empty box, and a ctx with
  no `run_usage_box` attribute (`getattr(..., None)` at `harness_engine.py:1916`) all produce no
  statement.
- `circuit_breaker.py:174-179` computes `d = max(0, total - self.<watermark>)` and then
  `record_tokens(d_in, d_out)` MUTATES the watermark, so a second call on an unchanged box returns
  `(0, 0)`.
- `db/workflows.py:2161` `if not input_delta and not output_delta: return` — returns before
  `pool.execute`.
- **Mutated between the two calls:** the second call returns exactly the new increment, and the SQL
  is `COALESCE(col,0) + $n` (ADD, not SET), so the total is right. Verified behaviourally by
  `test_a_completed_run_still_writes_exactly_once_per_phase` and
  `test_a_pause_after_a_completed_phase_issues_no_second_write`.
- **`if not d_in and not d_out` vs `if not (d_in or d_out)`:** logically identical (De Morgan); the
  spelling does not matter. **What does matter is the one-sided case**, and that is **IN-01**.

**3. The publish accumulation across 3 attempts — correct on every point asked.**
- Accumulators declared **above** the loop: `_judge_in`/`_judge_out` at `:1837-1838`, loop at `:1839`.
- Initialised `None`, never `0` (D-256-06). ✓
- A **failed** attempt's tokens land: the accumulation at `:1879-1884` sits after the inner
  `try/except … continue` and **above** the verdict check / `break` at `:1886`. Driven by
  `test_the_publish_judge_reports_its_spend_on_a_FAILED_verdict_too` → `box == {"input_tokens": 21,
  "output_tokens": 9}` for three failed shots of 7/3.
- The fold at `:1898` sits above all three remaining return paths, including
  `{"failure": last_failure}`.
- The persist at `:458` is **above** the `_block` return (`stage="judge"` at `:485`) and above
  `_safe_audit` at `:465`, so a **blocked** gauntlet does record its spend.
- A shot that RAISES contributes nothing — correctly, `forced_emit` returned no dict. Named as a
  residual, not papered over.

**4. `validator_kinds.py` recording position — correct by line number.**
`_record_run_usage(ctx, …)` at **`:629`**, the failure arm `if result.get("failure") or
result.get("emitted") is None: return GateResult(False, …)` at **`:631`**. The `forced_emit` call is
at `:592-598`. Import is **function-local** at `:627`; the module's top-level imports are only `re`,
`datetime`, `pydantic` and `app.services.harness.validators`, so no module-level cycle was
introduced against `phase_types.py:84`'s `from app.services.harness.validator_kinds import
CITATION_MARKER_GUIDANCE`. `_record_run_usage` (`phase_types.py:768`) is a no-op when the ctx has no
box and `None`/`0` both add nothing.

### Other invariants I checked and found to hold

- **`db/workflows.py` really is non-executable-change-only.** Not asserted from the diff: I parsed
  both revisions, normalised every docstring to a sentinel, and compared `ast.dump` — **identical**.
  (Nuance: the SUMMARY's *"non-comment lines changed: 0"* is loose — `persist_run_usage`'s
  **docstring** changed too. No statement did.)
- **No new branch in `_enforce_budget`:** `if`/`try`/loop = 2/0/0 before and after; the flush is its
  first statement, still **above** `if not breaker.armed: return`. Pinned by AST at
  `test_enforce_budget_gained_no_branch`.
- **One home:** `persist_run_usage` is called from exactly one place in `harness_engine.py` (`:1917`,
  inside `_flush_run_usage`). `_flush_run_usage` def `:1888`, calls `:1968` and `:2320`.
- **Placement:** `:2320` is at 8-space `while`-body level, **outside** the phase `try`, after the
  `except BaseException … raise` closes at `:2281`, and **above** `pause_run` (`:2369`), `fail_run`
  (`:2386`) and `skip_to` (`:2414`). `outcome` is always bound there (the escape arm re-raises).
- **The breaker's trip point is unchanged.** `check_limits()` reads the watermark, and the watermark
  is updated by whichever flush absorbs first; `_enforce_budget("phase_completed")` (`:2680`) still
  checks the same value. Verified against the taken-`skip_to` `continue` at `:2454` (which skips
  `phase_completed`) and the boundary brake `return` above `:2073`.
- **No double count of the judge spend.** `forced_emit` takes no usage box and records nothing
  itself (`forced_emit.py:344-356` signature; `grep usage_box` → 2 prose hits only), so the single
  `_record_run_usage` call is the only consumer.
- **The `NO-RUN` dispositions are true, not asserted.** `grep -c "workflow_runs\|create_workflow_run\|insert_run(\|usage_box\|usage_acc"` is **0** in all four of `embedding_service.py`,
  `skill_proposer_service.py`, `skill_tuner_service.py`, `workflow_authoring.py`.
- **Blocking-I/O rule (D-v2.5-01) is not violated by the new write.** `persist_run_usage` awaits
  `asyncpg.Pool.execute`; nothing new is a sync `supabase-py` call. (`load_user_settings` at
  `publish_service.py:419` is a pre-existing sync read, unchanged by this round.)
- **No security surface.** The new write reaches the existing `$1..$4` parameterised statement with
  `WHERE id = $1`; no new endpoint, no interpolation, no secret, no `eval`, no traversal.
  `check-extension-contract.cjs` → `OK — 6/6 closed-core files conform, 0 violations`.

### Gates I re-ran myself (not inherited from the SUMMARY)

| Gate | My measurement |
|---|---|
| `pytest tests/unit -q --continue-on-collection-errors` | **71 failed / 5062 passed / 2 xfailed / 2 xpassed**; failing **SET** diffed with `comm` after `tr -d '\r'` → **ADDED empty, REMOVED empty** |
| the 4 in-scope test modules | **80 passed** |
| `tests/test_200_human_gate_pause.py` + 4 siblings (invisible to the baseline) | **3 failed / 106 passed**; all three inherited — `test_no_twenty_fifth_audit_kind_was_added` depends on `_AUDIT_EVENT_TYPES` in `db/workflows.py`, which the AST comparison above proves byte-equivalent, and the other two live in files this round never touched |
| `check-extension-contract.cjs` | OK |

---

## Warnings

### WR-01: CR-02's publish half is guarded by TEXT fences only — nothing drives `publish_workflow`, and dropping `usage_box=_judge_usage` from the call site keeps every test green

**Severity:** WARNING (high — the round's own headline deliverable can silently re-open)
**File:** `backend/app/services/harness/publish_service.py:431` (the wiring) ·
`backend/tests/unit/test_256_judge_usage_counted.py:443`, `:466` (the only guards)

**Issue:**
`grep -n "publish_workflow" backend/tests/unit/test_256_judge_usage_counted.py` returns **nothing**.
Every behavioural case in the new module calls `ps._judge_golden_output(...)` directly and passes
its own `usage_box=box`. So the guard chain for the publish half is:

1. `_judge_golden_output` fills a *supplied* box — **behaviourally driven** ✓
2. `publish_workflow` *supplies* a box (`usage_box=_judge_usage`, `:431`) — **guarded by nothing at
   all**. `grep -n "usage_box=\|_judge_usage" test_256_judge_usage_counted.py` returns three hits,
   all inside the tests' own direct calls.
3. `publish_workflow` writes it onto `golden_run_id` above `_block` — guarded only by two
   **source-text** fences that `str.index` over a raw slice **including comments**
   (`_qual01_source()` at `:435-440`).

**Failure scenario (concrete):** a later phase extracts the owner-settings + judge block of the
QUAL-01 stage into a helper and drops the `usage_box=_judge_usage` keyword. `_judge_usage` stays
`{}`; `if _judge_usage:` (`:455`) is False; **no usage write is ever issued** and every publish's
judge spend is lost again — while `test_the_qual01_stage_persists_the_judge_spend_above_the_block_return`
and `test_the_persist_targets_the_workflow_runs_grain_and_not_the_producer_shell` both stay **GREEN**,
because the `persist_run_usage(` call text and the `golden_run_id` argument are still literally
present. `token_coverage` then writes the four-leg marker over uncounted judge spend again — CR-02
verbatim, with a green suite. The `if _judge_usage:` guard at `:455` makes the failure doubly silent
(it is redundant with `persist_run_usage`'s own falsy-delta guard, so it only ever suppresses the
statement).

Compounding fragility: `_qual01_source()` slices comments in. A future comment containing the
literal `persist_run_usage(` would be found by `stage.index(...)` before the real call, so the
ordering assertion could hold over code where the persist has moved below `_block`. This is the
exact trap `test_the_validator_records_above_its_failure_arm`'s own docstring documents ("*a text
fence cannot tell code from a comment*") and answers with `ast` — the sibling fence three tests up
was not given the same treatment.

**Why this is avoidable rather than expensive:** `backend/tests/unit/test_publish_service.py`
already drives `publish_workflow(...)` **four times**, so the harness for a behavioural case
existed.

**Fix:** one behavioural case on the existing harness, asserting the *pool statement*, not the
source text:

```python
# test_256_judge_usage_counted.py — drive the CALLER, not the callee
async def test_the_qual01_stage_actually_issues_the_usage_write_on_a_blocked_publish(...):
    # patch app.services.forced_emit.forced_emit -> {"emitted": None, "failure": "x",
    #   "input_tokens": 7, "output_tokens": 3}  (a BLOCKED gauntlet)
    await ps.publish_workflow(...)          # the harness test_publish_service.py already builds
    writes = [c for c in pool.calls if "input_tokens = COALESCE(input_tokens, 0)" in c[0]]
    assert writes, "the QUAL-01 stage issued NO usage write — usage_box wiring is gone"
    assert writes[0][1][0] == golden_run_id   # the workflow_runs grain, not the runs shell
    assert (writes[0][1][1], writes[0][1][2]) == (21, 9)   # all three served shots
```

and re-spell the two source fences with `ast` (locate the `Call` node named `persist_run_usage`
inside `publish_workflow` and compare `lineno` against the `_block` call whose `stage` keyword is
`"judge"`), so prose about the code is invisible to them.

---

### WR-02: the `forced_emit` disposition fence is FILE-scoped while claiming SITE scope — an eleventh call site inside an already-listed file passes green

**Severity:** WARNING (medium)
**File:** `backend/tests/unit/test_256_judge_usage_counted.py:500-548`

**Issue:**
`_measured_forced_emit_files()` (`:515-525`) iterates lines, adds the **relative file path** to a
set, and `break`s on the first match — so it can never observe more than one site per file.
`_EXPECTED_FORCED_EMIT_SITES` is keyed by file (8 entries), and the assertion is
`measured == expected` over **file** sets.

The fence's own documentation claims strictly more than that:

> *"⛔ An ELEVENTH site anywhere under ``backend/app`` FAILS this fence until it is classified,
> which is the only mechanism that makes SC#4's *"discoverable, not from someone's memory"*
> survive."*

and the plan's acceptance criterion was *"the SET with a disposition per site, never a count"*. The
implementation is a set of **files**, so the eleventh-site claim is false for the eight files that
already carry a disposition.

**Failure scenario (concrete):** Phase 257 adds a second `forced_emit(...)` call inside
`backend/app/services/harness/publish_service.py` — say a cheap pre-judge triage shot — on a code
path that does not accumulate into `usage_box`. The measured file set is unchanged (that file is
already `COUNTED-VIA-PERSIST`), the fence is green, and `persist_run_usage` still writes the
unconditional four-leg `token_coverage`. The run is then **excluded** from
`idx_workflow_runs_org_coverage_incomplete`, which is the one access path METER-07's *"what it
cannot see"* view reads — i.e. a run with real uncounted spend is invisible to the mechanism built
to surface uncounted spend. That is CR-02's defect shape, re-entered through the file the round just
classified.

Note the same weakness applies in the reverse direction: `skill_tuner_service.py` carries **three**
sites today and the fence would not notice two of them disappearing.

**Fix:** key the map by `file:function` (or `file` → count + function names) and derive both halves:

```python
_EXPECTED_FORCED_EMIT_SITES = {
    "services/harness/publish_service.py::_judge_golden_output": "COUNTED-VIA-PERSIST",
    "services/harness/validator_kinds.py::_validate_llm_judge_rubric": "COUNTED-INTO-RUN-BOX",
    "services/skill_tuner_service.py::<fn1>": "NO-RUN", ...   # all ten
}
# derive with ast: for each Call whose func is Name('forced_emit'), walk up to the
# enclosing FunctionDef/AsyncFunctionDef and emit f"{rel}::{fn.name}".
```

Keep the SET assertion; only the grain of the key changes. Then the docstring's eleventh-site claim
becomes true.

---

### WR-03: `_SHELL_FUNCTIONS` is a hardcoded name list, and `assert shells` cannot detect the case that actually matters — a NEW shell in one of the three files

**Severity:** WARNING (medium)
**File:** `backend/tests/unit/test_256_producer_shells.py:641-647` (the map) · `:708` (the guard)

**Issue:**
The narrowing itself is right (see the Summary — verified, do **not** revert it). What is weak is
the *derivation*: `_SHELL_FUNCTIONS` is three hardcoded tuples of function names, and the only
protection against it going stale is `assert shells, f"{rel}: none of {...} found — re-derive the
set"`, which fires **only when every named shell in a file has vanished**. It therefore protects
against exactly one thing: a file whose whole named set was renamed or deleted.

It does **not** protect against the two cases that reopen D-256-03:

1. **A new shell function added to one of the three files** is simply not in the map, gets zero
   coverage, and produces no signal. Measured coverage dropped from 100% of file lines to
   **34% / 13% / 26%** (table in the Summary), so 66-87% of each subject file is now unscanned.
2. **In `app/api/runs.py` the map holds TWO names**, so renaming one (`continue_run` →
   `continue_run_v2`) leaves `shells` non-empty, the `assert` silent, and that shell's whole body —
   443 lines, containing a `runs`-shell `insert_run`/`finalize_run` pair — unfenced.

**Failure scenario (concrete):** a later phase adds `_drive_eval_run` to
`backend/app/services/scheduler_service.py` — another per-segment `runs` shell — and, wanting the
cumulative figure too, calls `persist_run_usage(pool, workflow_run_id, ...)` inside its `finally`.
The two grains are now summed from inside a segment shell, which is the entirety of what D-256-03
forbids and the entirety of what this fence was built to catch. Under the pre-round form it fired;
under the round-1 form it is green, because `_drive_run` is still present so `assert shells` is
satisfied.

**Fix:** derive the shell set structurally and pin it, so a new shell fails the fence until it is
classified (the same shape the disposition fence uses):

```python
def _derived_shells(rel):
    src = _read(rel); tree = ast.parse(src)
    return {
        n.name for n in ast.walk(tree)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
        and any(w in (ast.get_source_segment(src, n) or "")
                for w in ("insert_run(", "finalize_run("))
    }

def test_the_shell_set_is_still_the_pinned_one(rel):
    derived = _derived_shells(rel)          # today: exactly the nested + named ones
    assert derived <= set(_SHELL_FUNCTIONS[rel]) | _KNOWN_NESTED[rel], (
        f"{rel}: a shell-like function appeared that carries no disposition: "
        f"{sorted(derived - ...)}"
    )
```

(`_wake` and `_harness_continuation` are nested inside the two named shells today, so they are
already covered by line range — record that fact in the map's comment rather than leaving the next
reader to re-derive it, as I had to.)

---

### WR-04: the in-run judge validator's tokens now count against `max_tokens_per_run`, tightening a shipped safety control — recorded nowhere, fenced nowhere

**Severity:** WARNING (low-medium)
**File:** `backend/app/services/harness/validator_kinds.py:629` → `phase_types.py:768` →
`harness_engine.py:1916` → `circuit_breaker.py:179` → `circuit_breaker.py:193`

**Issue:**
`_record_run_usage(ctx, …)` writes into `ctx.run_usage_box`, and the ctx a validator receives **is
the run's ctx** — `harness_engine.py:723` imports `run_gates`, `validators.py:210` calls
`await fn(output, config, ctx)` with it. That box is what `CircuitBreaker.absorb_usage_box` reads,
and `record_tokens` feeds `cumulative_tokens`, which `check_limits()` compares against
`max_tokens` (`circuit_breaker.py:193`). So as of this round the `llm_judge_rubric` validator's
spend — **once per gate evaluation, i.e. once per retry attempt** — is enforced against the run's
ceiling. Before this round it was invisible to the breaker.

This is very likely the *correct* behaviour and follows directly from D-256-18 Option A ("every
token is counted"). The defect is that it is a change to an enforcement threshold that **no
register names**: the plan, the SUMMARY, the source comments and the `db/workflows.py` block all
describe the change as affecting *durable totals*, and none mentions the breaker. No test asserts
it either — every new judge case uses a ctx with a bare box and no breaker.

**Failure scenario (concrete):** a scheduled run configured `max_tokens_per_run = 20000` with an
`llm_judge_rubric` validator on each phase and `max_retries = 2`. Yesterday the judge shots were
free as far as the ceiling was concerned; today three judge shots per phase count. The run now
raises `CircuitBreakerTrippedError(REASON_TOKEN_BUDGET, …)` one or two phases earlier than the same
definition did before the upgrade, and the trip record's `measurements()` gives no way to tell that
validator overhead rather than phase work consumed the allowance. The operator sees a workflow that
"stopped working" after an upgrade with no changelog entry explaining it.

**Fix:** no code change to the wiring. (a) Record the consequence in one sentence where the ceiling
is documented — `circuit_breaker.py`'s `absorb_usage_box` docstring or the `TOKEN_COVERAGE_LEGS`
block already edited this round — and (b) add one case to
`backend/tests/unit/test_256_judge_usage_counted.py` that pins it deliberately, so it is a decision
rather than a side effect:

```python
async def test_the_in_run_judge_shot_counts_against_the_run_ceiling():
    # an ARMED breaker + a judge shot billing N tokens -> check_limits() trips
    # (D-256-18 Option A: judge spend is real spend, so it binds the ceiling too)
```

---

## Info

### IN-01: a one-sided delta flips a NULL token column to `0`, and `persist_run_usage`'s docstring claims the opposite

**Severity:** LOW (pre-existing writer behaviour; newly reachable through this round's publish path)
**File:** `backend/app/db/workflows.py:2161-2175`

**Issue:**
The guard is `if not input_delta and not output_delta: return`, so a delta with **one** side
non-zero passes. The statement then executes both columns unconditionally:

```sql
UPDATE workflow_runs SET
  input_tokens  = COALESCE(input_tokens, 0) + $2,
  output_tokens = COALESCE(output_tokens, 0) + $3,
  token_coverage = $4
WHERE id = $1
```

with `int(input_delta or 0)` → `0`. If `input_tokens` was `NULL` (never measured), the write makes
it `0` — *"measured as zero"* — which is precisely the collapse **D-256-06** forbids, and the same
docstring asserts it does not happen: *"``NULL`` means never measured and ``0`` means measured as
zero (D-256-06); the two are different facts and **this writer never coalesces one into the
other**."* It does.

**Newly reachable how:** `publish_service.py:461-462` passes
`input_delta=_judge_usage.get("input_tokens")`, which is `None` whenever `_judge_in` stayed `None` —
i.e. a judge shot whose provider reported completion tokens only. Combined with a golden run whose
phases reported nothing, the first write on that row sets `input_tokens = 0` and
`token_coverage = ('agent','single','batch','emit')` — a row that reads as fully covered and
free on the input side.

**Fix (not required this round — it is `persist_run_usage`'s body, which the round deliberately left
untouched, and the reachability is narrow):** either build the SET clause from the non-`None` sides
only, or — cheaper and honest — correct the docstring sentence so the register stops claiming a
property the SQL does not have. Whichever is chosen, say which; leaving the sentence as-is is the
one option that should not survive, because it is the sentence a later author will trust.

---

## Explicitly NOT findings (checked and cleared)

Recorded so a round 2 cannot be justified by re-raising them:

- **`db/workflows.py` is comment-only** — proven by AST comparison with docstrings normalised, not
  by reading the diff.
- **`test_the_flush_is_called_unconditionally_in_the_phase_loop`** does not assert the flush sits
  *above* the arm dispatch, only that it is at statement level in some `while` body of
  `run_workflow`. That gap is fully covered behaviourally by the pause / fail_run / dangling-skip
  cases, which each assert the persisted delta equals what the phase billed. Not a hole.
- **`test_enforce_budget_gained_no_branch`'s docstring** says "3 ``if``s" in its first paragraph and
  asserts `2`; the second paragraph records the measured correction. Cosmetic.
- **`int()` coercion** in the publish accumulators cannot raise on real data: `forced_emit`'s
  `in_tok`/`out_tok` are `int | None` by construction (`forced_emit.py:625-626`, `+=` on ints).
- **`test_256_finish_run_unchanged.py`'s line-pin update** is the bookkeeping update that fence's own
  docstring sanctions — per-file counts unchanged, positions `+75`, which matches the insertion
  exactly. No caller appeared or vanished.
- **Round-0's WR-01** (watermark advances before the durable write, no `try`) is not re-raised: the
  new site inherits the property rather than widening the class, and the decision to add no `try`
  is D-256-04/`_enforce_budget`'s recorded contract.

---

## Recommendation on G-7

This is round 1 of the 2 G-7 allows. **No BLOCKER exists and no ROADMAP success criterion is unmet
by the code**, so a round 2 is not owed. Every warning above is a *test-durability* item, and
**WR-01 is the only one I would not accept as-is**: it is a ~30-line behavioural case on a harness
that already exists (`test_publish_service.py`), it guards the round's own headline deliverable, and
without it the publish half of CR-02 can re-open with a green suite. That is `/gsd:fast`-shaped
(one test file, no source change). WR-02, WR-03 and WR-04 are legitimate follow-ups to sequence into
Phase 257, which is the phase that reads the `token_coverage` marker and is therefore the phase with
the motive to make its fences load-bearing.

---

_Reviewed: 2026-09-19_
_Reviewer: Claude (gsd-code-reviewer) — independent of the build_
_Depth: deep_
