---
phase: 256-every-token-is-counted-and-kept
verified: 2026-09-19T00:47:54Z
verification_mode: self-verified   # ⛔ AGENTS.md §6.3 — this session BUILT phase 256. NOT the independent review.
independent_review: owed           # reviewer = gemini; evidence posted at BUS-272
status: verified
score: 4/4 success criteria verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  previous_report: 256-VERIFICATION-round0.md.bak
  verified_head: c908161f4
  round: 1
  gaps_closed:
    - "SC#1 / METER-03 — the three ordinary run_workflow returns (pause_run, fail_run, dangling skip_to) now flow THROUGH one unconditional flush at harness_engine.py:2320 before any outcome arm"
    - "SC#4 / METER-06 — both in-run judge shots are counted (validator_kinds.py:629 into the run box; publish_service.py:458 onto the golden run's workflow_runs row), so the four-leg token_coverage marker became TRUE rather than lowered (D-256-18 Option A)"
  gaps_remaining: []
  regressions: []
  regression_checked:
    - "SC#2 — phase_types.py:768 _record_run_usage rollup intact; test_256_token_sum_narrowing.py green"
    - "SC#3 — api/runs.py:700 and :1372 still write input_tokens=_in_tok; no new input_tokens=None call site"
deferred:  # addressed in a later milestone phase — NOT actionable gaps
  - truth: "An application read path projects workflow_runs.input_tokens / output_tokens / token_coverage back to a caller"
    addressed_in: "Phase 257"
    evidence: "Phase 257 SC#4 — 'An operator can see spend in dollars for a single run and totalled per org, and the same view states what it cannot see' (METER-07). Phase 257's Depends-on line names 256 for exactly this ordering. The durable row carries the values today (verified in supabase/full-schema.sql); no SELECT in backend/app projects them yet, by design."
  - truth: "WR-02 (file-scoped disposition fence), WR-03 (hardcoded _SHELL_FUNCTIONS), WR-04 (judge tokens now bind max_tokens_per_run, unregistered), IN-01 (one-sided delta writes NULL→0)"
    addressed_in: "Phase 257"
    evidence: "Triaged and sequenced at the round-1 review (256-REVIEW-round1.md). All four are durability-of-the-guard findings, not wrong behaviour today; re-raising them here would manufacture a round 2 that G-7 forbids (gate re-run: G-7 clear, 1 of 2 rounds)."
human_verification:   # ⚠ OWED, and closing the phase with them owed is a stated DECISION — not a claim that everything ran
  - test: "RUN THIS ONE FIRST. Drive a real two-phase harness run whose phase 1 calls ask_user, let the gate elapse so the run takes the pause arm, then RESTART the backend process and SELECT id, input_tokens, output_tokens, token_coverage FROM workflow_runs WHERE id = <run_id>."
    expected: "Non-NULL input_tokens/output_tokens equal to what phase 1 actually billed, and token_coverage = {agent,single,batch,emit}. A NULL means the UPDATE never reached Postgres."
    why_human: "SC#1's clause 'after the process restarts' cannot be proven by a unit test, and test_256_run_exit_usage_flush.py's own docstring disclaims it verbatim: 'WHAT THIS SUITE DOES NOT PROVE: that the statement is accepted by Postgres; that the value survives a process boundary.' The suite asserts the SQL the pool was HANDED, not the SQL Postgres ACCEPTED — in particular that a Python list binds to token_coverage's text[] has never been exercised live."
  - test: "Drive ONE publish gauntlet to the QUAL-01 judge stage against a REAL provider (no forced_emit patch), and compare the provider's reported usage for that shot against the delta persisted onto the golden run's workflow_runs row."
    expected: "The persisted delta equals the provider's reported input/output tokens for the served shot(s)."
    why_human: "Round 1 shipped NO live cross-provider UAT of a judge shot's reported usage — every case in test_256_judge_usage_counted.py patches forced_emit and supplies its own numbers. So the wiring is proven end-to-end but the FIDELITY of the number to what the provider actually reported is not, and CLAUDE.md's cross-provider rule says conventions do not transfer 1:1 between providers."
---

# Phase 256: Every Token Is Counted And Kept — Verification Report (round 1)

**Phase Goal:** No run loses its token count. A harness run, a run that spawned sub-agents, and a
chat run that paused for `ask_user` or was continued all finish with real, persisted totals — and
any remaining hole is named in a register rather than left silent.

**Verified:** 2026-09-19 · **HEAD:** `c908161f4` · **Status:** `verified` (4/4)
**Re-verification:** Yes — after gap-closure round 1. The 2/4 verdict this replaces is preserved at
`256-VERIFICATION-round0.md.bak`.

⛔ **THIS IS NOT THE INDEPENDENT REVIEW.** Per `AGENTS.md` §6.3, the session that BUILT phase 256
also wrote this report, so it is a **self-verification**. The independent reviewer is **gemini**, and
the round-1 evidence is posted at **BUS-272**. Nothing below should be read as a second pair of eyes.

⭐ **Method: goal-backward against SOURCE.** Every verdict below names a `file:line` and states what
would have to change to make it false. No claim is carried from a SUMMARY, a PLAN or the round-1
review; where the review had already measured something, it is re-derived here by a different
instrument (AST rather than grep, or a live test run rather than a quoted count).

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, verbatim)

| # | Truth | Status | Evidence (file:line) |
|---|-------|--------|----------------------|
| 1 | A completed workflow / harness run has its token totals **persisted** — `workflow_runs` carries them, and re-reading the run after the process restarts returns the same totals the in-memory ceiling saw during the run (METER-03). | ✓ **VERIFIED** (automated; one live row owed) | `harness_engine.py:2320` — an unconditional `await _flush_run_usage()` at `while`-body statement level, **AST-confirmed** to sit after the phase `Try` (2108-2282) and **above** all three arms: `If 2369` (pause), `If 2386` (fail), `If 2414` (skip_to). |
| 2 | A run that spawned sub-agents reports totals that **include** the sub-agent usage: the producer run's number accounts for its children, and a sub-agent's tokens appear in exactly one place rather than twice or nowhere (METER-04). | ✓ **VERIFIED — still holds** (regression check only) | `phase_types.py:768 _record_run_usage` sums a completed sub-agent's totals into the parent's `ctx.run_usage_box`, unchanged by round 1; `test_256_token_sum_narrowing.py` green in this session's own run. Round 1 was fenced not to touch this and did not. |
| 3 | A chat run that paused for `ask_user` and was answered, and a chat run that was continued, both finish carrying real token counts — neither finalize site writes `input_tokens=None` (METER-05). | ✓ **VERIFIED — still holds** (regression check only) | `api/runs.py:700` and `:1372` (the two SC#3 names, +23/+41 lines from round 0's `:677`/`:1331`) both write `input_tokens=_in_tok`. `grep -rn "input_tokens=None" backend/app` → 2 hits, both non-call-sites: `run_lifecycle.py:369` (default parameter) and `run_reconciler.py:245` (the registered SEED-299 hole). |
| 4 | The `llm_emit` / `forced_emit` usage is **either** included in the persisted totals **or** named in a register entry with a concrete re-open trigger — and which of the two is true is discoverable from the run's own totals, not from someone's memory (METER-06). | ✓ **VERIFIED** (automated; one live row owed) | Both in-run judge shots counted: `validator_kinds.py:629` (`_record_run_usage` **above** the failure arm at `:631`) and `publish_service.py:458` (`persist_run_usage` onto `golden_run_id`, **above** `_safe_audit` and the `_block` return). The remaining 8 of 10 sites carry a disposition; the one REGISTERED site has a concrete trigger in `SEED-300`. |

**Score: 4/4.**

---

## SC#1 — verified, and how it can be broken

**What makes it true.** Round 0 failed this on a precise property: *a run that PAUSES on a human
gate, FAILS after exhausting gate retries, or dies on a dangling `skip_to` target is a run, and the
phase that ran immediately before each of those three returns was never persisted.* That property is
now closed, and I confirmed it by **AST over `run_workflow`** rather than by reading the comment that
claims it:

```
While at 1982 - 2681 (col 4)          # the phase loop
  ...
  Try   2108 - 2282  (col 8)          # the phase executes HERE
  Expr  2320         (col 8)          # await _flush_run_usage()   ← unconditional, statement level
  If    2369 - 2383  (col 8)          # pause_run arm   → return 2383
  If    2386 - 2411  (col 8)          # fail_run arm    → return 2411
  If    2414 - 2454  (col 8)          # skip_to arm     → return 2452 / continue 2454
```

Every `Return`/`Continue`/`Break` reachable in that loop body, enumerated by AST and sorted against
the flush line:

| node | line | vs flush | what it is |
|---|---|---|---|
| `Continue` | 1990 | before | loop **top** — phase already `completed`/`skipped`, nothing ran, nothing to lose |
| `Return` | 2058 | before | loop **top** — the cross-worker cancel brake, **above** `_enforce_budget("phase_boundary")` at `:2073` and above the phase `Try` |
| `Return` | 2383 | **after** | pause arm ✓ |
| `Return` | 2411 | **after** | fail arm ✓ |
| `Return` | 2452 / `Continue` 2454 | **after** | dangling / taken `skip_to` ✓ |

The two pre-flush exits sit above the phase's execution in that iteration, so nothing unflushed can
be lost through them — the previous iteration's spend was already flushed at `:2320` (and again at
`_enforce_budget("phase_completed")`, `:2680`).

**The mechanism is one home, and it is idempotent by construction, not by a guard:**
- `harness_engine.py:1888-1919 _flush_run_usage` = `breaker.absorb_usage_box(getattr(ctx, "run_usage_box", None))` → `persist_run_usage(...)`, and it is the **only** absorb caller in `backend/app` (grep: 1 call, 1 definition).
- `circuit_breaker.py:173-179` — `if not box: return (0,0)`; delta is `max(0, total - watermark)` and `record_tokens` **mutates** the watermark, so a second call on an unchanged box yields `(0,0)`.
- `db/workflows.py:2161` — `if not input_delta and not output_delta: return`, before `pool.execute`.
- `db/workflows.py:2163-2172` — `UPDATE workflow_runs SET input_tokens = COALESCE(input_tokens,0) + $2, output_tokens = COALESCE(output_tokens,0) + $3, token_coverage = $4 WHERE id = $1`. **ADD, not SET** — which is what makes the per-segment reset at `:1884` survivable.

**To make it FALSE:** delete `harness_engine.py:2320`. The pause arm then returns at `:2383`, which is
**297 lines above** `_enforce_budget("phase_completed")` at `:2680`, so no persist is reachable — round 0's
defect verbatim. **Is that guarded?** Yes, behaviourally: `test_256_run_exit_usage_flush.py` drives the
**real** `run_workflow` (real `_enforce_budget`, real `CircuitBreaker`, real `persist_run_usage`; only the
phase executor and the pool are replaced) and asserts the SQL the pool was handed — `assert writes` plus
`(total_in, total_out) == (_HALF, _TOKENS - _HALF)` plus `args[0] == run_id`. Deleting `:2320` fails it on
`assert writes`. ⭐ The pause fixture deliberately carries **no `budget=`** (the interactive shape), which
is what makes it able to see the disarmed case that a budgeted fixture passed over once before.

**Measured live in this session:** `pytest tests/unit/test_256_run_exit_usage_flush.py tests/unit/test_256_judge_usage_counted.py -q` → **35 passed**.

**What is NOT proven, stated rather than implied.** The suite asserts the statement the pool was
**handed**, never the statement Postgres **accepted**, and never that the value survives a process
boundary — its own docstring says so verbatim. That is human-verification row 1 above, and it is the
row to run **first**. Two residuals are registered rather than hidden: a phase that **crashes or is
cancelled** mid-work still loses its delta (a `try`/`finally` around the loop was explicitly rejected
in-source because an unshielded `await` in a `finally` changes which exception leaves the engine on a
user Stop) — `SEED-300` residual #5, with a trigger.

---

## SC#4 — verified, and how it can be broken

**The test is that the four-leg marker became TRUE, not that its claim was lowered.** D-256-18
Option A was taken; Option B (narrow `TOKEN_COVERAGE_LEGS` + a second migration) was rejected and is
**not** treated as open here.

**Both in-run judge shots are now counted:**

| site | how it is counted | placement, verified |
|---|---|---|
| `validator_kinds.py:592` `_validate_llm_judge_rubric` (a `@register_validator("llm_judge_rubric")` taking `ctx`) | `_record_run_usage(ctx, result.get("input_tokens"), result.get("output_tokens"))` at **`:629`**, function-local import at `:627` (cycle: `phase_types.py:84` imports this module) | **above** the failure arm at `:631` — so a shot that produced no verdict, the EXPENSIVE outcome, is still counted. Recording below would bias the total invisibly. |
| `publish_service.py:1841` `_judge_golden_output` | accumulators `_judge_in`/`_judge_out` at `:1837-1838` **above** the 3-attempt loop at `:1839`, `None`-init (D-256-06), accumulation at `:1879-1884` **above** the verdict check/`break`; fold into the caller's box at `:1898` above all three remaining returns | caller `publish_workflow` supplies `usage_box=_judge_usage` at `:431` and persists at **`:458`** onto **`golden_run_id`** — above `_safe_audit` (`:462`) and above the `_block` return, so a **blocked** publish still records its money. |

⭐ **The grain is right and I checked it rather than accepting it:** the write targets
`golden_run_id`, a `workflow_runs` row created by `create_workflow_run` inside `_drive_golden_run`
(`:1473`), **never** `_producer_id` (the separate `runs` shell). D-256-03 forbids mixing them; the
call does not name `_producer_id`.

⭐ **And a hole I went looking for is not there.** `phase_types._run_usage_box`'s docstring says a
"publish golden run … reaches these executors with a ctx that has no box" — which would mean the
validator judge shot during a golden run is dropped while the golden run's row still gets a 4-leg
marker (CR-02's shape, reopened). **Measured false:** `_drive_golden_run` drives
`run_workflow` (`publish_service.py:1681`), and `run_workflow` sets `ctx.run_usage_box = {}`
unconditionally at `harness_engine.py:1884` (inside a `try/except (AttributeError, TypeError)` for
immutable unit stubs only). So the box exists on a golden run and the validator shot lands in it.
The docstring is stale on that clause; the behaviour is correct. **ℹ Info-level only** — a docstring,
not a code path.

**The "discoverable, not from someone's memory" half is structural, not prose.** Migration 182's
durable `COMMENT ON COLUMN public.workflow_runs.token_coverage` delegates the legs' meaning to the
constant verbatim — *"Written from ONE module-level constant, db.workflows.TOKEN_COVERAGE_LEGS"*
(confirmed in `supabase/full-schema.sql:2783`). So **growing what the `"emit"` leg covers cannot
falsify the durable comment**, which is precisely why Option A needed no second migration. The record
of which option was taken lives in that constant's own home (`db/workflows.py:95-135`), naming
Option A taken / Option B rejected / no fifth leg, with the reason.

**The disposition set is complete — my own enumeration, not the fence's.** AST-walked every
`Call` to `forced_emit` under `backend/app`, resolving each to its enclosing function:

| site | disposition | checked how |
|---|---|---|
| `harness/phase_types.py:1561 _exec_llm_emit` | COUNTED-INTO-RUN-BOX | wired at 256-04 |
| `harness/validator_kinds.py:592 _validate_llm_judge_rubric` | COUNTED-INTO-RUN-BOX | `:629`, above the failure arm |
| `harness/publish_service.py:1841 _judge_golden_output` | COUNTED-VIA-PERSIST | `:458` onto `golden_run_id` |
| `eval_runner_service.py:344 _judge_eval_answer` | **REGISTERED** | `grep -c "workflow_runs\|create_workflow_run"` in that file = **0** → an eval `runs` shell, **no `workflow_runs` row and therefore no `token_coverage` marker that could over-claim**. Named as `SEED-300` hole #3 with a concrete trigger. |
| `embedding_service.py:338` · `skill_proposer_service.py:392` · `skill_tuner_service.py:225/:283/:340` · `workflow_authoring.py:752` | NO-RUN ×6 | `grep -c "workflow_runs\|create_workflow_run\|insert_run(\|usage_box\|usage_acc"` = **0** in all four files |

**10 sites, 10 dispositions, and the one that is not counted is registered** — which is exactly the
"either / or" SC#4 grants, with the "which" discoverable from the column's own delegation chain.

**To make it FALSE:** delete `usage_box=_judge_usage` at `publish_service.py:431`. `_judge_usage`
stays `{}`, `if _judge_usage:` is False, no write is issued, and the 4-leg marker over-claims again.
**Is that guarded?** It is **now** — and it was not until `c908161f4`. That commit (WR-01) added two
behavioural cases driving the real `publish_workflow` to the judge stage with `persist_run_usage`
left REAL and the pool as recorder, asserting the write's **arguments** (`golden_run_id`, the real
numbers, the four-leg marker) on both a PASSED (1234/567) and a BLOCKED (3 shots of 7/3 → 21/9)
publish. ⭐ **Its RED drive is the finding, not the fix:** under the plant, **22 tests stayed green —
including both text fences — and only the two new cases fired.** File restored md5-identical
(`355987c1cffb5f135c9d63cc841e8f21` pre-plant and restored). That is *presence assertions cannot see
content drift*, paid for in this phase's own currency.

**What is NOT proven, stated rather than implied.** Every judge case patches `forced_emit` and
supplies its own token numbers, so **no live cross-provider row has ever compared a judge shot's
provider-reported usage against the persisted delta.** The wiring is proven; the fidelity of the
number is not. That is human-verification row 2 above.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `harness_engine.py::_flush_run_usage` + its `:2320` call | one unconditional flush above every outcome arm | ✓ VERIFIED | AST-confirmed placement; 1 absorb caller; 2 `_flush_run_usage` callers (`:1968` inside `_enforce_budget`, `:2320` in the loop) |
| `db/workflows.py::persist_run_usage` | ADD writer, falsy-delta guard, parameterised | ✓ VERIFIED (unchanged) | `COALESCE(col,0) + $n` at `:2163-2172`; `$1..$4` only, `WHERE id = $1`; round 1 changed the **docstring** only (round-1 review proved `ast.dump` identical — I did not re-derive that, it is not load-bearing for any SC) |
| `db/workflows.py::TOKEN_COVERAGE_LEGS` | the home of the Option-A record | ✓ VERIFIED | `:135` unchanged as a 4-tuple; `:95-134` carries the Option A / Option B-rejected / no-fifth-leg record the durable comment delegates to |
| `validator_kinds.py` judge recording | `_record_run_usage` above the failure arm | ✓ VERIFIED | `:629` vs `:631` |
| `publish_service.py` QUAL-01 persist | on `golden_run_id`, above `_block` | ✓ VERIFIED | `:431` supply, `:455` guard, `:458` write, `:462` audit |
| `supabase/migrations/182_*.sql` + `full-schema.sql` | 3 nullable columns + marker + partial index | ✓ VERIFIED | columns + 3 `COMMENT ON COLUMN` bodies + `idx_workflow_runs_org_coverage_incomplete` all present in `full-schema.sql` (`:2766-2783`, `:4326`). **Zero `supabase/` changes in round 1** — no second migration, as D-256-18 requires. |
| `SEED-300` | residuals named with concrete triggers | ✓ VERIFIED | `status: partially-answered` (hole #2 flipped with in-source evidence); holes #1/#3 open with triggers; **three NEW residuals added by round 1** (#4 raised `forced_emit` shot, #5 crashed/cancelled phase, #6 pre-round-1 local rows), each with its own trigger; stale line pins corrected **beside** their originals |
| Guard modules | behavioural, not text-only | ✓ VERIFIED | `test_256_run_exit_usage_flush.py` + `test_256_judge_usage_counted.py` → **35 passed**; `test_256_token_sum_narrowing.py` + `test_256_producer_shells.py` + `test_256_finish_run_unchanged.py` → **59 passed** (both run live in this session) |

## Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `run_workflow` pause / fail / dangling-skip arms (`:2369`/`:2386`/`:2414`) | `persist_run_usage` | `_flush_run_usage()` at `:2320`, above all three | ✓ **WIRED** (round 0: ✗ NOT WIRED) |
| `_enforce_budget` (`:1968`) | `persist_run_usage` | same one home, still above the `armed` guard | ✓ WIRED (unchanged) |
| `validator_kinds.py:592` | `phase_types._record_run_usage` | `:629`, function-local import | ✓ **WIRED** (round 0: ✗ NOT WIRED) |
| `publish_service.py:1841` | `db.workflows.persist_run_usage` | `usage_box=_judge_usage` (`:431`) → `:458` on `golden_run_id` | ✓ **WIRED** (round 0: ✗ NOT WIRED) |
| `publish_workflow` **supplies** the box | the write at `:458` | `usage_box=` keyword | ✓ **WIRED and now GUARDED BEHAVIOURALLY** (`c908161f4` / WR-01) |
| `workflow_runs.token_coverage` | an application reader | — | ⧗ **DEFERRED to Phase 257** (METER-07) — the row carries the values; no `SELECT` projects them yet, by design |

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| `workflow_runs.input_tokens/output_tokens` | `_d_in`/`_d_out` | `breaker.absorb_usage_box(ctx.run_usage_box)` — the real production billing channel (`_MeteredProvider` bills through it in test, not a parallel pipe) | ✓ (real deltas, ADD-accumulated) | ✓ FLOWING |
| `workflow_runs.token_coverage` | `list(TOKEN_COVERAGE_LEGS)` | module constant, written in the same commit as the leg it names | ✓ | ✓ FLOWING |
| golden run's judge delta | `_judge_usage` | `_judge_golden_output`'s per-shot accumulation across **all served attempts**, failed ones included | ✓ | ✓ FLOWING |
| in-run validator judge delta | `ctx.run_usage_box` | `_record_run_usage` → flushed by `_flush_run_usage` | ✓ (box confirmed present on golden runs too) | ✓ FLOWING |

## Behavioural Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| SC#1 + SC#4 guards | `pytest tests/unit/test_256_run_exit_usage_flush.py tests/unit/test_256_judge_usage_counted.py -q` | **35 passed** | ✓ PASS |
| SC#2 + SC#3 fences | `pytest tests/unit/test_256_token_sum_narrowing.py tests/unit/test_256_producer_shells.py tests/unit/test_256_finish_run_unchanged.py -q` | **59 passed** | ✓ PASS |
| G-7 round cap | `node scripts/check-gap-closure-rounds.cjs 256` | `G-7 clear — 1 round(s) completed, no new capability built inside a closure round` (cap 2) | ✓ PASS |
| Hot-file ledger | `node scripts/check-hot-file-ledger.cjs 256` | `ledger gate OK — every watched file has a row` · `watched: 10` (non-vacuous) | ✓ PASS |
| Backend baseline | measured earlier this session | **71 failed / 5064 passed / 2 xfailed / 2 xpassed / 0 collection errors**; failing SET diffed against `256-BASELINE-backend-failing-set.txt` → **empty both directions**. 5064 = locked 5062 + WR-01's 2 cases. Ceiling (71) held with zero headroom. | ✓ PASS (confirmed, not re-run) |
| `test_200_human_gate_pause.py` | measured earlier this session | 1 failed / 16 passed; the failure (`test_no_twenty_fifth_audit_kind_was_added`, pinning `len(_AUDIT_EVENT_TYPES) == 24` against a real **26**) **proven INHERITED** at HEAD, at round-1 base `a9cc2fbc4` and at `9cba267e8`, having grown at `16cba8e05` (Phase 185). Both pause-arm source-slicing fences PASS. | ✓ PASS (inherited red, not new) |
| Live harness run + process restart | — | **NOT RUN** | ? SKIP → human row 1 |
| Live cross-provider judge usage | — | **NOT RUN** | ? SKIP → human row 2 |

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| METER-03 | harness run persists token totals, durable across restart | ✓ SATISFIED (live row owed) | `harness_engine.py:2320` + `db/workflows.py:2163-2172`; was BLOCKED at round 0 |
| METER-04 | sub-agent usage rolls up, counted exactly once | ✓ SATISFIED | `phase_types.py:768` + the `parent_run_id IS NULL` narrowing fence; untouched by round 1 |
| METER-05 | ask_user pause / continuation finalize with real totals | ✓ SATISFIED | `api/runs.py:700`, `:1372`; no new `input_tokens=None` call site |
| METER-06 | `forced_emit` spend counted or registered, discoverably | ✓ SATISFIED (live row owed) | 10/10 sites dispositioned; 2 judge sites newly counted; `SEED-300` carries the registered one; was BLOCKED at round 0 |

No orphaned requirement IDs against `.planning/REQUIREMENTS.md`.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `harness_engine.py` · `validator_kinds.py` · `publish_service.py` · `db/workflows.py` | — | `grep -n "TBD\|FIXME\|XXX"` → **clean in all four** (checked directly, not from SUMMARY) | — | none |
| `phase_types.py:760-762` | docstring | claims "a publish golden run … reaches these executors with a ctx that has no box" — **measured false**; `run_workflow:1884` sets the box unconditionally and the golden run goes through `run_workflow` (`publish_service.py:1681`) | ℹ Info | Prose rot only. The behaviour is the SAFE direction (the box exists, so the validator judge shot **is** counted on a golden run). Worth correcting on the next touch of that file; **not** an SC failure. |
| `test_256_judge_usage_counted.py` `_qual01_source()` | ~`:435-440` | still slices comments in (a text fence that cannot tell code from a comment) | ⚠ Warning | **WR-01's behavioural cases now carry the load**, so the weak fence is redundant rather than load-bearing. Named in the `c908161f4` commit body rather than left silent. |
| — | — | WR-02 / WR-03 / WR-04 / IN-01 | ⚠ Warning ×4 | Triaged and **sequenced into Phase 257** at the round-1 review. Re-raising them as SC failures would manufacture a round 2 that G-7 forbids; recorded in `deferred` above. |

---

## Verdict

**4/4. The phase goal is achieved.** Round 1 closed exactly the two criteria it was scoped to close
and did not disturb the two that were already met:

- **SC#1** was a *placement* defect and now has a *placement* fix — one unconditional flush that every
  outcome arm flows through, so a fifth arm added later is covered by construction rather than by
  whoever writes it remembering. AST-proven above all three returns; behaviourally guarded by a suite
  that drives the real engine and reads the SQL the pool was handed.
- **SC#4** was closed the way the operator ruled (D-256-18 Option A): **the four-leg claim became TRUE
  rather than being lowered.** Both in-run judge shots are counted, all ten `forced_emit` sites carry
  a disposition, the one uncounted site has no `workflow_runs` row to over-claim over and is
  registered in `SEED-300` with a concrete trigger, and the "which of the two is true" record lives
  in the constant the durable column comment already delegates to — so it survives without anyone's
  memory and without a second migration.

**Closing with two UAT rows owed is a DECISION, stated here, not a claim that everything ran.** The
automated path is proven end-to-end in-process; what no unit test in this phase can reach is (a)
that Postgres accepts the statement and the value survives a process boundary, and (b) that the
number persisted for a judge shot is the number a real provider reported. **Run human row 1 first** —
it is the cheaper of the two and it is the one SC#1's own wording names ("after the process
restarts"). The Supabase MCP read path makes its `SELECT` half free.

⛔ **Two standing reminders this report must not let pass as settled:** this is a **self-verification
by the session that built the phase** — gemini's independent review at **BUS-272** is still owed and
this document does not substitute for it; and **G-7 stands at 1 round of 2**, so the four sequenced
warnings belong to Phase 257, not to a round 2 here.

---

_Verified: 2026-09-19T00:47:54Z · HEAD `c908161f4`_
_Verifier: Claude (gsd-verifier) — **self-verified**, not independent (AGENTS.md §6.3)_
_Round-0 verdict preserved at `256-VERIFICATION-round0.md.bak`_
