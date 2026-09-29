---
phase: 256-every-token-is-counted-and-kept
plan: 04
subsystem: harness / metering
tags: [METER-06, forced-emit, token-accounting, hot-file-ledger, tdd]
requires:
  - "256-01: db.workflows.TOKEN_COVERAGE_LEGS, persist_run_usage, CircuitBreaker.absorb_usage_box"
  - "256-02: the hot-file ledger rows for task_service / circuit_breaker / run_producer"
provides:
  - "forced_emit._drain returns (content, tool_calls, finish_reason, input_tokens, output_tokens)"
  - "forced_emit()'s result dict carries LADDER token totals on BOTH exits"
  - "_exec_llm_emit folds the emit leg's spend into ctx.run_usage_box on success AND failure"
  - "TOKEN_COVERAGE_LEGS == ('agent','single','batch','emit') — the 4th and last leg"
  - "backend/app/services/forced_emit.py's FIRST hot-file-ledger row, in both registers"
affects:
  - "Phase 257 / METER-07: workflow_runs.token_coverage now claims 'emit'; the NULL triple has a written reading"
tech-stack:
  added: []
  patterns:
    - "the two-arm usage reader mirrored in shape from task_service._drain:414-430"
    - "int | None accumulators — a measured 0 and an absent measurement are different facts"
    - "accumulator declared ABOVE the retry loop so failed attempts still count"
key-files:
  created:
    - backend/tests/unit/test_256_forced_emit_usage.py
    - backend/tests/unit/test_256_llm_emit_rollup.py
  modified:
    - backend/app/services/forced_emit.py
    - backend/app/services/harness/phase_types.py
    - backend/app/services/harness_engine.py
    - backend/app/db/workflows.py
    - backend/tests/unit/test_256_persist_run_usage.py
    - backend/tests/unit/test_256_finish_run_unchanged.py
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
decisions:
  - "D-256-11 / D-256-12 honoured: the emit leg is COUNTED, and every rung counts — failed ones included"
  - "One placement served both arms: _record_run_usage sits immediately after the forced_emit call, so the early failure return flows through it. NEW BRANCHES: 0"
  - "RESEARCH.md's two-call-site claim for _failure() is REFUTED — one site, measured"
  - "The four ledger rows 256-03 could not reach were ADOPTED, re-derived rather than copied"
metrics:
  tasks: 3
  commits: 6
  duration: one session
  completed: 2026-09-19
---

# Phase 256 Plan 04: Count the Last Uncounted Provider Call — Summary

`forced_emit` drove the same gateway as every other LLM leg, received the same `usage` /
`usage_delta` frames, and dropped both — so every `llm_emit` phase in every published workflow was
real, billed spend that no column in this product could see. Two arms mirrored into the existing
drain, two function-local ints above the rung loop, one recording call, and the two prose registers
that still claimed the hole was open.

**Base SHA asserted: `383beb3f58c9322ae5ba5726082acc5eb5b88dd3`.** The worktree came up on the
stale default branch (`merge-base` read `658cb8547`), so `git reset --hard` to the required base ran
before anything else. `bash scripts/bootstrap-worktree.sh` was the first action, with a literal path.

---

## Commits

| # | hash | message |
|---|---|---|
| 1 | `ab752ed80` | `test(256-04)` RED fences for the forced-emit token leg |
| 2 | `da8c92147` | `feat(256-04)` count the forced-emit leg, and make both registers true |
| 3 | `ebd7b26fd` | `test(256-04)` re-derive the finish_run call-site positions (line shift only) |
| 4 | `63e6e3160` | `docs(256-04)` re-derive four rows 256-03 could not reach |
| 5 | `c53b25146` | `docs(256-04)` reword two comments that inflated their own grep |
| 6 | `40ca6ca20` | `docs(256-04)` re-derive forced_emit's own row on the shipping HEAD |

⭐ **O-6 is satisfied in commit 2, verifiably:** `git diff --stat HEAD~1 HEAD` on that commit shows
`backend/app/services/forced_emit.py`, `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` together, alongside
`TOKEN_COVERAGE_LEGS`'s fourth member and 256-01's coverage-legs test. The file's first edit, its
first ledger row and the coverage claim it earns all landed in one commit; none preceded another.

---

## The md5 chain — four digests, first and last identical

| # | digest | state |
|---|---|---|
| base | `4e55aeef1b6646338f90d38e77f9d427` | `forced_emit.py` at `383beb3f5`, before any edit |
| **#1 (pre-plant)** | **`a74e0a9f8d00f137931fd6c37154654a`** | the real implementation, green |
| #2 (plant A) | `c36bf88d573badc4e7ec6b6557eeb130` | accumulators initialised to `0` |
| **#1 restored** | **`a74e0a9f8d00f137931fd6c37154654a`** | ✅ byte-identical |
| #3 (plant B) | `bc81b4543201944e04a7880c22bc0048` | ladder accumulators moved INSIDE the rung loop |
| **#4 (restored)** | **`a74e0a9f8d00f137931fd6c37154654a`** | ✅ byte-identical to #1 |

⛔ **The restore was NOT `git checkout -- <file>`.** A pristine copy was taken to the scratchpad
before the first plant and copied back, then md5-verified. The sibling plan 256-03 learned the
expensive way that `git checkout -- <file>` restores from the **index**, silently discarding an
uncommitted GREEN edit along with the planted defect. A file-copy restore cannot do that, and the
md5 is what proves it did not.

⚠ **A LATER commit (5) deliberately changed this file again** — a comment reword — so
`md5sum` today reads `82e47f4fd02b0e191d7ff5d05ddaac74`. The chain above is closed and intact; the
reword is a separate, dated, comment-only change and is called out rather than left to look like
plant residue.

---

## Task 1 — `forced_emit`: two drain arms, a ladder accumulator, both exits

### RED, from a TARGETED run (never a full-gate figure — the ceiling has zero headroom)

`pytest tests/unit/test_256_forced_emit_usage.py -q` → **`14 failed, 2 passed`**

The two that passed are the structural negative fences (no module-level accumulator, no token value
in a log format string); they are true at base by construction and stay true after — which is what a
negative fence is for.

### Planted violation A — `0`-initialised accumulators

`in_tok: int | None = None` → `= 0`. Result: **`4 failed, 12 passed`**

```
FAILED test_drain_handles_a_usage_delta_arriving_first
FAILED test_drain_yields_none_when_the_provider_emitted_no_usage_at_all
FAILED test_a_ladder_that_measured_nothing_reports_none_not_zero
FAILED test_a_failed_ladder_that_measured_nothing_also_reports_none
```

⭐ **Every other case stayed green under the plant**, which is the useful part: the twelve cases that
assert real numbers cannot see this defect at all. Only a case that asserts *the absence of a
measurement* can, and `openai_compat.py:482-494` makes that the **common** path for six of the eight
providers — so this is the arm most likely to be "simplified" by a future reader and the one that
would cost the most.

### Planted violation B — accumulators moved inside the rung loop

Result: **`4 failed, 12 passed`**

```
FAILED test_a_three_rung_descent_sums_every_shot_the_provider_served
FAILED test_an_exhausted_ladder_still_reports_its_spend
FAILED test_a_raising_rung_does_not_lose_the_surviving_rungs_spend
FAILED test_a_truncated_rung_is_still_a_billed_rung
```

⭐ **The single-rung success case stayed GREEN under this plant.** A test suite that only exercised
the happy path would have shipped a counter that under-reports a three-rung descent by 3× — on
precisely the runs that cost the most — and looked fully covered doing it.

### GREEN

`pytest tests/unit/test_256_forced_emit_usage.py -q` → **`16 passed`**

Existing suites (`test_forced_emit.py`, `test_103_forced_emit_strict.py`,
`test_111_1_forced_emit_local.py`, `test_llm_emit_executor.py`, `test_196_emit_tier_two_layer_pin.py`,
`test_eval_forced_emit.py`) → **`1 failed, 71 passed`**. The one failure is
`test_forced_emit_judge_verdict_unmocked`, **present in the committed 71-name baseline set** — an
inherited red, and (per `SEED-301`) one of the tests that makes real billed provider calls.

### The arithmetic, not the adjective

| | before | after |
|---|---|---|
| `_drain` `elif` arms | 6 | **8** |
| `grep -c "usage_delta" forced_emit.py` | 0 | **3** (1 arm + 2 prose) |
| `grep -cE "in_tok(: int \| None)? = 0"` | 0 | **0** ⛔ |
| `return` statements in `forced_emit` itself | 2 | **2** |
| new functions | — | **0** |
| new `try`/`except` blocks | — | **0** |
| new function-local state | — | **exactly 2 ints** |
| `_failure(` call sites | 1 | **1** |
| module-level accumulators | 0 | **0** |
| whole-file `return ` count | 22 | **23** |

### ⚠ CORRECTION recorded BESIDE its original — `_failure()` has ONE call site, not two

`256-RESEARCH.md` §Q4 states, verbatim, that `_failure` is reached *"from the exhausted-ladder floor
**AND from a raised-exception backstop**"*. **Measured: the helper has this `def` and exactly one
call, at what is now `:578`.** The raised-exception arm sets `last_failure` and `continue`s — it
never calls the helper. The original claim is preserved in the function's own docstring rather than
deleted, because a reader who trusted it would thread the ladder totals twice and then hunt for a
second site that does not exist. **The change was cheaper than RESEARCH implied**, and the invariant
it leaves behind is written down: a second call site would have to thread the totals again.

---

## Task 2 — `_exec_llm_emit` records into the run box, on the failure path too

### RED → GREEN

`pytest tests/unit/test_256_llm_emit_rollup.py -q` → **`4 failed, 4 passed`** → **`8 passed`**

### One placement served both arms — NEW BRANCHES: 0

The call sits **immediately after** `result = await forced_emit(...)`. Every arm below it — the
state-(a) early `return _emit_failure_output(...)`, the citation-gate reject, the render failure and
the success return — flows through it. No branch, no duplication, no second home for the addition.

⭐ It is also *inside* the per-attempt retry loop, which is correct and deliberate: each attempt is a
fresh, separately-billed ladder.

| | before | after |
|---|---|---|
| `_record_run_usage(` in `phase_types.py` | 3 (def + 2 sites) | **4** (def + 3 sites) |
| `importlib\|eval(\|exec(\|__import__` | 0 | **0** (unchanged) |
| new branches in `_exec_llm_emit` | — | **0** |
| new functions / new state | — | **0 / 0** |
| `git diff … \| grep -c "def _record_run_usage"` | — | **0** (the summer is byte-untouched) |

### Gates

- `node scripts/check-extension-contract.cjs` → **exit 0**, `all 6 files conform to closed-core
  contract (0 violations)`
- `pytest tests/unit/test_255_extension_contract_guard.py …` (6 `phase_types`-touching suites) →
  **`1 failed, 105 passed`**; the one failure is `test_200_1_phase_output_shape.py::
  test_this_plan_wrote_no_migration`, **in the committed baseline set** (256-01 wrote migration 182)
- `pytest tests/test_harness_engine.py -q` (⚠ in `tests/`, OUTSIDE the canonical gate, so a red there
  is invisible to the 71-name baseline) → **`61 passed`**

---

## Task 3 — making the registers true

### (a) `TOKEN_COVERAGE_LEGS` — the fourth and last leg

`("agent", "single", "batch")` → **`("agent", "single", "batch", "emit")`**, in commit 2, the same
commit as the drain arms. 256-01's `test_token_coverage_legs_claims_only_the_legs_that_have_shipped`
was updated in that same commit — visibly, in a diff, with the previous assertion quoted in the
docstring — and a `len(...) == 4` assertion added beside it.

**U-5's reading is written next to the constant**, including the two words the plan required:
the NULL triple means *"no instrumented leg reported usage for this run"* and ⛔ **must never be read
as `$0.00`** by Phase 257. The reason the reading was chosen — it preserves the delta-derived
idempotency that lets `persist_run_usage` be safe with no key, no lock and no upsert, and adds zero
branches — is recorded there too, so 257 inherits the *why*, not just the rule.

### (b) The `harness_engine.py` comment

`grep -c "PHASES ARE NOT COUNTED"` → **1** (the original is QUOTED, not deleted) ·
`grep -c "CORRECTED.*256"` → **2**

⭐ **The original named its own re-open condition — *"a different file and a different plan"* — and
that plan turned out to be this one.** That is why it was worth quoting rather than erasing: a hole
that is named can be closed on schedule; the failure mode this project keeps paying for is the
register that silently stops being true. The correction names the full chain
(`_drain` arms → ladder accumulator → `_record_run_usage` → `run_usage_box` → `persist_run_usage`)
and explicitly **does not retire the original's closing reasoning**: a sealed single shot genuinely
cannot *run away*; what it could do, and did, was spend invisibly.

⚠ 256-01's `:1826` passage (the `input_tokens=None` site count) was **not re-edited** — it had
already landed in wave 1 and this plan's `files_modified` overlap was resolved by leaving it alone.

### (c) `forced_emit.py`'s first ledger row — re-derived three times, and that is the finding

| derivation | value | when |
|---|---|---|
| `256-CONTEXT.md` said | `8 / 5 / 578` | before the phase |
| re-derived at the plan's edit | `9 / 6 / 701` | mid-plan |
| **re-derived on the SHIPPING HEAD** | **`10 / 6 / 705`** | commit 6 |

```
git log --oneline -- backend/app/services/forced_emit.py | wc -l            → 10
git log --format=%s -- … | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u
                                                → 101.1 · 102 · 103 · 111.1 · 122 · 256 = 6
wc -l backend/app/services/forced_emit.py                                   → 705
```

**Verdict against CONTEXT's `8 / 5 / 578`: commits CONFIRMED (as of that moment), phases CONFIRMED,
lines CORRECTED.** ⚠ **No six-digit dated quick-task bucket appears in the list**, so nothing was
subtracted — the recipe's filter is a no-op here, stated rather than left ambiguous.

⭐ **THE ROW ROTTED TWICE INSIDE ONE SESSION, and nothing was wrong with either earlier derivation —
the file moved underneath them.** The second rot interval was **minutes**, caused by a comment-only
commit, by an author actively applying the rule. ⛔ The instruction that follows is therefore not
*"derive carefully"* but **"derive LAST, on the tree you are shipping"**; a triple written before the
final commit is provisional. That is now written into the file's ledger section.

⛔ **The absence was the finding, not the paperwork.** This file has been FIRING G-5 since Phase 122 —
five phases, eight commits — with **no row in either register for its entire life**, so G-5 was
ABSENT on it at any commit count, silently. The `[no-row]` line from
`check-hot-file-ledger.cjs 256` is what found it; the 290-row scan list had been complete and
readable the whole time.

### Ledger + size gate results

```
hot-file ledger — .planning/phases/256-every-token-is-counted-and-kept
  scan list: 291 rows · subject: 29 files · watched: 9
ledger gate OK — every watched file has a row.                                EXIT 0
```
⭐ **`watched: 9`, non-zero** — the pass is provably non-vacuous. **No `[no-row]` line at all.**
Before the row: `EXIT 1`, exactly one `[no-row]`, naming `backend/app/services/forced_emit.py`.

```
CLAUDE.md   107901 chars   71.9% of limit   headroom 42099   [OK]              EXIT 0
```
(107,212 at base → **107,901**, `+689`.) `grep -c "backend/app/services/forced_emit.py"`:
**CLAUDE.md 1 · docs/HOT-FILE-LEDGER.md 4.**

### ⚠ A REFINEMENT OF 256-02's FINDING ABOUT THE 200-CHAR CAP — it is NOT vacuous, it is MISPLACED

256-02 drove the disposition cap RED and reported it **vacuous**: a 260-char cell in `CLAUDE.md`
passed with exit 0. **Measured here, unprompted: the cap DOES fire — on `docs/HOT-FILE-LEDGER.md`.**
A 359-char cell in the detail file's scan list failed the gate immediately:

```
HOT-FILE LEDGER — 1 structural problem(s) in docs/HOT-FILE-LEDGER.md
  [disposition-too-long] line 10678  359 chars (cap 200)  backend/app/services/forced_emit.py
claude-md size gate FAILED — the ledger table is accumulating prose again.
```

So the guard binds to the table in the **detail** file, not to `CLAUDE.md`'s abridged copy — which is
exactly consistent with 256-02's observation that the script never opens the file whose header it
matches on. ⛔ **The practical consequence is unchanged and still needs hand-measuring:**
`CLAUDE.md`'s own cells are ungoverned. Both of this plan's `CLAUDE.md` cells were hand-measured with
`[...c].length` — **197** and **199** chars. The detail-file cell was trimmed to **200** after the
gate fired. ⛔ Not fixed here: out of scope, and a guard deserves its own review.

---

## Deviations from Plan

### [Rule 1 — Bug] The `finish_run` position fence went red, and I repaired it

**Found during:** the full backend gate. `test_256_finish_run_unchanged.py::
test_the_finish_run_call_site_set_is_unchanged` appeared in the failing set — a **+1 on a
zero-headroom ceiling**.

**Diagnosis, not assumption.** The fence has two parts and the split is what made this cheap:

- **part (a) — the per-file CALL COUNTS — stayed GREEN.** No new caller, no removed terminal write.
- **part (b) — the POSITIONS — failed:** `harness_engine.py` `:2295 / :2336 / :2618` →
  `:2315 / :2356 / :2638`. Exactly **+20**, which is the F-4 comment correction's line count.

**Fix:** re-derived with `grep -rn "await finish_run(" backend/app/` — the update the fence's own
docstring instructs — and updated `_EXPECTED_CALL_SITES`, keeping **both** earlier position sets
above the new one. `finish_run` itself is byte-unchanged and its AST digest never moved.

**Commit:** `ebd7b26fd`. **Files:** `backend/tests/unit/test_256_finish_run_unchanged.py` (⚠ not in
this plan's `files_modified` — declared here as a deviation).

⭐ **The two-part fence is the reason this took one step instead of an investigation.** Had part (a)
gone red too, re-baselining would have been a contract change wearing a bookkeeping costume; that
condition is now written into the constant's comment as a precondition for any future update.

### [Rule 1 — Bug] Two comments inflated their own grep

**Found during:** the acceptance greps. `grep -rn "[^_a-z]_failure(" backend/app/` returned **4 `.py`
lines**, where the criterion expects the `def` plus one call.

**Cause:** a docstring that explained how many call sites the helper has **wrote the grep pattern out
literally**, so it matched itself. A second hit came from the F-4 correction naming the helper in
prose.

**Fix:** the pattern is now **DESCRIBED** rather than written ("this helper's name preceded by a
non-identifier character and followed by an open paren"), with a parenthetical saying *why*; the
`harness_engine.py` line says "the honest-fail floor". Post-fix: **2 `.py` lines** — the `def` and
the one real call, unchanged from base. **Commit:** `c53b25146`. Comment-only; the `finish_run`
position fence and all targeted suites were re-run green immediately after.

⚠ This is the exact trap the wave coordinator relayed from 256-03, which hit it three times. **An
auditable rule beats a self-documenting comment** — recorded so the next plan writes its comments
that way from the start rather than discovering it a third time.

### [Additive, accepted] Four ledger rows handed over from plan 256-03

256-03 modified four files and has **neither register in its `files_modified`** — both belong to this
plan. It re-derived their triples after committing and handed them across the wave. **Adopted.**

⛔ **RE-DERIVED, NOT COPIED, and that distinction is the whole reason this is trustworthy.** Linked
worktrees share one object store, so 256-03's commits are reachable from here; each triple was
re-measured independently against its head `b3729994b`. **All four matched the hand-off exactly.**

| file | row said | re-derived | |
|---|---|---|---|
| `backend/app/api/runs.py` | 38 / 17 / 1695 | **39 / 18 / 1736** | |
| `backend/app/services/harness/publish_service.py` | 26 / 11 / 1810 | **27 / 12 / 1830** | |
| `backend/app/services/eval_runner_service.py` | 12 / 7 / 959 | **13 / 8 / 1040** | |
| `backend/app/services/scheduler_service.py` | 5 / 2 / 399 | **6 / 3 / 421** | ⚠ **crosses G-5** |

⭐ **`scheduler_service.py` is the one that mattered, and it was PRESENT AND WRONG.** Its scan-list
row read `no (2 phases)` and it had **no row at all** in `CLAUDE.md`'s firing table — because the
disposition said it needed none. At three phases it **FIRES**. Row corrected, verdict flipped, and
promoted into the firing table so the next phase naming that file meets a refactor recommendation
rather than a reassurance.

⛔ **No gate could have caught this.** `check-hot-file-ledger.cjs` fails a **MISSING** row; it never
re-derives a **PRESENT** one, so a stale `no (2 phases)` passes forever. The only thing that found it
was a sibling plan re-deriving the triples of files it had just edited and saying so out loud.

⚠ **Caveat stated rather than buried:** these were measured at 256-03's head, **not the merged tree**,
which does not exist yet. This plan modifies none of the four, so the content carries over — except
that a merge commit may add one to a commit count. The next phase to touch any of them must
re-derive on the merged trunk. **Commit:** `63e6e3160`.

---

## Verification

### ⛔ The backend baseline, SET-diffed in both directions

**Final run, on the exact shipping tree (HEAD `40ca6ca20`):**

```
71 failed, 4972 passed, 2 xfailed, 2 xpassed, 43 warnings in 254.80s (0:04:14)
```

`grep -c "^FAILED"` → **71** (counted with `grep -c`, ⛔ never with `| tail`).

```
mine: 71   base: 71
APPEARED (in mine, not in the committed baseline):
VANISHED (in the committed baseline, not in mine):
```

⭐ **Both directions EMPTY.** The failing set is byte-identical to the committed 71 names — nothing
appeared, and nothing vanished (a name that LEFT the set would need explaining too, and none did).

⭐ **SEED-301's billed-call flake (`test_email_ingestion.py::
test_ingest_email_populates_metadata_and_attachments`) did NOT appear in any of the three runs.**

**The three runs, published in order because the middle one is the finding:**

| run | tree | result | set diff |
|---|---|---|---|
| 1 | before the `finish_run` repair | `72 failed, 4971 passed, 2 xfailed, 2 xpassed` | **+1 appeared:** the `finish_run` position fence |
| 2 | after the repair | `71 failed, 4972 passed, 2 xfailed, 2 xpassed` | **byte-identical, both directions** |
| 3 | the shipping tree, `40ca6ca20` | `71 failed, 4972 passed, 2 xfailed, 2 xpassed` | **byte-identical, both directions** |

⚠ **Run 3 exists because run 2 was started BEFORE commit 5**, and a zero-headroom claim must be
measured on the tree that actually ships — not on one a comment-only commit behind. It cost four
minutes and it is the only run whose verdict is quoted as this plan's.

⚠ **I LOST THE FIRST RUN'S SET TO A `tail -40` AND HAD TO PAY FOR A SECOND SIX-MINUTE RUN.** The
`tail` kept the count and threw the set away, which is the one thing this project's own rule says not
to do. Recorded because the cost was real and the rule exists for exactly this.

**Three extraction traps hit, all three already documented and all three still bit:**

1. **CRLF.** Writing the extracted set with Python's default `open(...,'w')` on Windows appended
   `\r` to every line, so `comm` reported **every one of 72 names as both appeared and vanished**.
2. **The `RuntimeWarning` tail.** `test_sandbox_service.py::…::test_harvest_files_empty_output` had
   `C:\Vibe Apps\…RuntimeWarning: coroutine 'handle_query_tables' was never awaited` concatenated
   onto it **with no separator** — so a `sed 's/ - .*$//'` could not cut it and the name read as both
   appeared and vanished.
3. **Parametrised ids contain spaces** (`test_no_unwrapped_sync_calls_in_route[async def
   upload_document(]`), so splitting on whitespace destroys them.

The working extractor is `setdiff.py` in the scratchpad: split on `" - "`, cut at the first
`[A-Za-z]:\\`, `rstrip("\r\n")`, compare sets in memory with **no file round-trip**. ⭐ Doing the
whole diff inside one process is what removed trap 1 entirely.

### Everything else

| check | result |
|---|---|
| `pytest tests/unit/test_256_forced_emit_usage.py -q` | **16 passed** |
| `pytest tests/unit/test_256_llm_emit_rollup.py -q` | **8 passed** |
| `pytest tests/unit/test_256_persist_run_usage.py -q` | **10 passed** |
| `pytest tests/unit/test_256_finish_run_unchanged.py -q` | **4 passed** |
| `pytest tests/test_harness_engine.py -q` (outside the gate) | **61 passed** |
| `node scripts/check-extension-contract.cjs` | **exit 0** — 6/6 conform, 0 violations |
| `node scripts/check-hot-file-ledger.cjs 256` | **exit 0** — `watched: 9`, no `[no-row]` |
| `node scripts/check-claude-md-size.cjs` | **exit 0** — 107,901 chars, 71.9%, headroom 42,099 |
| `node scripts/check-seeds-register.cjs --phase 256` | **exit 0** — 308/308 parsed, **13 matched** |

**Seeds — the two unswept figures, ⛔ UNSUMMED as the rule requires:**
**134 carry no `trigger_when` at all** · **114 carry prose but no structured trigger.**

⚠ **`SEED-300` fired on this plan's own files** and names *"forced_emit's failed-rung spend is not
broken out"*. **This plan COUNTS failed-rung spend but does NOT BREAK IT OUT** — the ladder total is
one number, with no separate figure for what was spent on rungs that delivered nothing. That arm of
the seed is **narrowed, not closed**, and the seed was left byte-unchanged (not in `files_modified`).
Its other two arms (the eval WITHOUT arm's ignored return; the judge shot uncounted) are untouched
here.

**Frontend: SKIPPED, deliberately (D-256-14).** Zero `frontend/` files modified, so
`vitest-count-gate.cjs` has no subject. ⛔ Not run, and no figure is quoted from it.

---

## What a future reader should not have to rediscover

1. ⛔ **The accumulators initialise to `None`, never `0`** — a no-usage stream is the **common** path
   for six of eight providers, not an edge case. Plant A proves twelve of sixteen cases cannot see
   this defect.
2. ⛔ **They are declared ABOVE the rung loop.** Plant B proves the single-rung happy path cannot see
   that defect either.
3. ⛔ **`_failure()` has exactly one call site and it passes both totals explicitly.** A second would
   have to thread them again.
4. ⚠ **The recording in `_exec_llm_emit` sits above the failure return on purpose.** Below it, the
   totals would be biased downward by exactly the most expensive outcome — and a biased total still
   looks like a total.
5. ⚠ **Derive a ledger triple LAST, on the tree you are shipping.** This row rotted twice in one
   session, the second time in minutes, from a comment-only commit.

---

## Self-Check: PASSED

**Files claimed as created — all present on disk:**

```
FOUND: backend/tests/unit/test_256_forced_emit_usage.py
FOUND: backend/tests/unit/test_256_llm_emit_rollup.py
FOUND: .planning/phases/256-every-token-is-counted-and-kept/256-04-SUMMARY.md
```

**Commits claimed — all six resolve, and the count matches:**

```
git log --oneline 383beb3f5..HEAD | wc -l   → 6
40ca6ca20  c53b25146  63e6e3160  ebd7b26fd  da8c92147  ab752ed80
```

**Working tree at hand-off:** clean apart from this SUMMARY, which is committed immediately below.
⛔ `STATE.md` and `ROADMAP.md` were NOT touched — the orchestrator owns those writes.

**No files were deleted by any commit in this plan** (`git diff --diff-filter=D --name-only` over the
range returns nothing).
