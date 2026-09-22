# Phase 256: Every Token Is Counted And Kept — Research

**Researched:** 2026-09-18
**Domain:** token accounting / run finalization / Postgres accumulation — a MEASUREMENT job, zero external libraries
**Confidence:** HIGH on Q1/Q2/Q3 and the write seam (all source-measured, file:line). MEDIUM on Q4 (source-measured for the code path; the per-provider *wire* behaviour of `include_usage` on moonshot/minimax/zhipu is NOT measurable from source and needs a live probe).
**Measured at:** `git HEAD = e78cf5e63` — ⚠ **NOT `772f53354`.** The tree has advanced 5 commits since CONTEXT.md's stated base. Every triple and line number below is at `e78cf5e63`.

> **No WebSearch / WebFetch was used.** Every claim below is `[VERIFIED: source read]` against this
> working tree, or explicitly flagged `[ASSUMED]` / `[COULD NOT MEASURE]`. No package is installed by
> this phase, so the Package Legitimacy Audit and Standard Stack sections are omitted by construction —
> there is nothing to slopcheck.

---

<user_constraints>
## User Constraints (from 256-CONTEXT.md)

### Locked Decisions — verbatim headings, D-256-01 … D-256-16

- **D-256-01** A producer run's persisted number is INCLUSIVE of every descendant; SC#2's "exactly one place" is a **READ rule** — any org/thread total sums only rows `WHERE parent_run_id IS NULL`.
- **D-256-02** SC#2 discharged as a HIERARCHY; a fence must fail on a summing site that omits the `parent_run_id IS NULL` narrowing and must be **driven RED against a planted un-narrowed SUM**.
- **D-256-03** `workflow_runs` is AUTHORITATIVE for a harness run; the `runs` producer shell carries ITS SEGMENT only. ⛔ Never sum across the two tables.
- **D-256-04** Totals persisted AFTER EVERY PHASE, at the existing breaker absorb point (`harness_engine.py:1875`, inside `_enforce_budget`).
- **D-256-05** New one-home writer `persist_run_usage(pool, run_id, delta)` in `backend/app/db/workflows.py`. ⛔ `finish_run` byte-unchanged. ⛔ No inline SQL in `harness_engine.py`.
- **D-256-06** Migration 182 adds `input_tokens integer NULL` + `output_tokens integer NULL` to `workflow_runs`. ⛔ NOT `NOT NULL DEFAULT 0`.
- **D-256-07** SC#4 discharged by a COVERAGE MARKER COLUMN on `workflow_runs`.
- **D-256-08** METER-05 covers FIVE producer-shell sites (1-5 FIX; #6 measure-then-decide; #7 REGISTER).
- **D-256-09** `workflow_runs` ACCUMULATES BY ADDITION AT THE DATABASE, never by SET; the per-phase write must be a DELTA; reuse `absorb_usage_box`'s subtraction.
- **D-256-10** `max_tokens_per_run` is really per-SEGMENT. NAME IT, DO NOT FIX IT.
- **D-256-11** METER-06: COUNT it, do not register it — ~10 lines mirroring an existing drain.
- **D-256-12** EVERY RUNG OF THE RECOVERY LADDER COUNTS, including failed rungs.
- **D-256-13** G-5 fires on SEVEN files; discharge BY CONSTRUCTION; add the missing `forced_emit.py` row to BOTH registers in the same commit; arithmetic in the SUMMARY.
- **D-256-14** Frontend baseline captured and NON-DETERMINISTIC. ⛔ Do not quote `failed 0` as "green at base".
- **D-256-15** Backend baseline is **71** with ZERO headroom; the SET is committed (71 lines, verified present).
- **D-256-16** G-8 — target **3-5 plans**.

### Claude's Discretion (this research recommends; the planner decides)
1. Exact name + type of the coverage-marker column. Constraint: Phase 257 reads it per-run **and** aggregates "which runs are not fully covered" per-org **without a scan**. → §Migration 182.
2. Whether the `parent_run_id IS NULL` fence is a pytest-AST fence or a narrower grep-shaped guard. Constraint: driven RED against a planted un-narrowed SUM, plant proven removed. → §Fences To Build.
3. Which register receives D-256-10 and the failed-rung breakdown. → §Register Entries Owed.
4. Plan decomposition inside the 3-5 target. → §Plan-Ordering Consequences.

### Deferred Ideas (OUT OF SCOPE — do not research, do not plan)
Fixing `max_tokens_per_run` to mean per-run · breaking failed-ladder spend into its own field ·
recovering a stranded Deep chat run's count (site #7) · renaming `max_tokens_per_run` ·
cache-read / reasoning-token breakdown. **And, by ROADMAP:** any rate table, any `cost_usd`, any
token→USD conversion, any operator spend view — that is Phase 257.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research support |
|----|-------------------------------|------------------|
| **METER-03** | A workflow / harness run **persists** its token totals — `workflow_runs` gains token columns and the harness's existing in-memory box is rolled up at finalize. | §Migration 182 (exact DDL, verified 16 columns / zero token columns / `org_id NOT NULL`) · §The Write Seam (`persist_run_usage` signature + delta) · ⛔ **§Q2-B: the chosen write point is UNREACHABLE for interactive runs as written** — this is the single biggest plan input in this document. |
| **METER-04** | Sub-agent token usage rolls up to the producer run instead of vanishing. | Already written: `phase_types.py:768 _record_run_usage` (read in full below). The phase's work is the **READ rule** + its fence. §Q3 (the sweep) · §Fences To Build #1. |
| **METER-05** | A chat run that paused for `ask_user` or was continued keeps its token count — the `input_tokens=None` finalize sites write real totals. | §The Five Producer Shells — all five verified to have a live, mutated `ctx.run_usage_box` in scope. Shape to copy is `run_producer.py:230-247`, **not** `run_lifecycle.py:386` (§Corrections). Plus a **NEW measured defect**: the boot reconciler can null out already-written real totals (§Open/Measured Defect R-1). |
| **METER-06** | The `llm_emit` / `forced_emit` blind spot is either counted or registered. | §Q4 — `forced_emit._drain` (`:516-578`) verified to have **no** `usage` / `usage_delta` arms; the same `open_stream` gateway supplies them. Two existing `_record_run_usage` call-site precedents at `phase_types.py:917` and `:1028`. `_failure()` at `:194-203` must also carry the keys (D-256-12). |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | Bearing on this phase |
|---|---|
| Python backend must use a `venv` | Every `pytest` invocation runs in `backend/` with the venv. |
| Backend baseline gate: `pytest tests/unit -q --continue-on-collection-errors`, ceiling **71**, zero headroom | §Test Strategy. ⛔ Diff the SET (`256-BASELINE-backend-failing-set.txt`, 71 lines — verified). |
| No LangChain / LangGraph, raw SDK only | Nothing in this phase touches provider SDKs beyond reading two already-canonical event names. |
| `None` ≠ `0`, do not coalesce | Binds migration 182 (nullable), `absorb_usage_box`'s `if not box: return`, and the METER-06 drain's `int \| None` initialisation. |
| All tables need RLS | `workflow_runs` already has 4 policies, all `org_id`-gated + thread-owner. A column add inherits them. |
| One-home DB writers in `backend/app/db/`; no SQL in services | D-256-05. |
| Migrations are `<digits>_name.sql`; apply by **pasting into the Supabase SQL editor**, never `db push`/`db reset`; then `bash scripts/regenerate-full-schema.sh` **without** `--reset` | §Migration 182. |
| `scripts/full-schema-supplement.sql` is the hand-mirror of every migration ACL; `get_advisors(security)` is a deploy-parity step | §Migration 182 — **measured: 182 owes NOTHING to the supplement.** Reason and proof below. |
| The Extension Contract (Phase 255) — nothing resolvable from data/config/a DB row | `persist_run_usage` is a module-level `async def` called from one site; the coverage marker is **data written by code**, never a key that resolves a writer. No registry is touched. `scripts/check-extension-contract.cjs` watches six files; this phase modifies **one** of them (`harness/phase_types.py`) and adds no dynamic dispatch there. |
| G-5 hot-file ledger | §Q5 / §G-5 Arithmetic. |
| `.planning/config.json`: `nyquist_validation: false` | ⇒ the Validation Architecture section is **deliberately omitted**. `security_enforcement: true`, `tdd_mode: true`, `code_review: standard`, `inline_plan_threshold: 4`. |

**Project skills:** the only skill present is `.claude/skills/sketch-findings-agentic-rag`. ROADMAP marks
Phase 256 **UI hint: no** and nothing in scope renders. **Not loaded, deliberately** — reading it would
be cost with no bearing.

---

## The Four Questions

### Q1 — Does `eval_runner_service.py:946` have a reachable usage box?

> ### **VERDICT: FIX — but NOT via `ctx.run_usage_box`, which is measurably absent from the entire eval path. The reachable carrier is a LOCAL accumulator across arms, and it is a DIFFERENT shape from sites 1-5. The planner must not copy the producer-shell shape here.**

**`run_usage_box` has exactly ONE writer in the whole backend.** Exhaustive:

```
$ grep -rn "run_usage_box" --include=*.py backend/app
phase_types.py:752   def _run_usage_box(ctx) -> dict | None:        # reader
phase_types.py:764       box = getattr(ctx, "run_usage_box", None)  # reader
phase_types.py:783 / :829                                          # readers
harness_engine.py:1844   ctx.run_usage_box = {}                    # ← THE ONLY WRITER
harness_engine.py:1875   breaker.absorb_usage_box(getattr(ctx, "run_usage_box", None))
```

`eval_runner_service` never calls `run_workflow`. It builds its own `RunContext` per arm
(`eval_runner_service.py:561-576`) and calls `run_agent_loop` directly (`:592`). No `run_usage_box`
is ever set on it. `_run_usage_box`'s own docstring names this case: *"a Deek run, a unit stub and a
publish golden run all reach these executors with a ctx that has no box — they get `None`"*
(`phase_types.py:758-762`).

**But the counts ARE measured, one level up, and they are already in scope two frames from the
broken finalize:**

| Step | file:line | What exists |
|---|---|---|
| per-arm totals measured | `eval_runner_service.py:593-594` | `in_tok = result.input_tokens_total` / `out_tok = result.output_tokens_total` from `AgentLoopResult` |
| per-arm totals PERSISTED | `eval_runner_service.py:682-683` | into `eval_results.input_tokens` / `.output_tokens` (migration 080) |
| the return that DROPS them | `eval_runner_service.py:702` | `return (variant, verdict_state, verdict_passed)` — a 3-tuple; the tokens are discarded here |
| the outer collector | `eval_runner_service.py:855`, `:869` | `with_outcomes: list[tuple[str, str, bool \| None]]` — the same 3-tuple, appended per WITH arm |
| the broken finalize | `eval_runner_service.py:938-948` | in the job's `finally:`, `finalize_run(..., input_tokens=None, output_tokens=None)` on the **companion `runs` row** |

**So the FIX is available and is the cheapest of the six:** widen `_run_arm`'s return (or pass a
run-level `dict` accumulator down, mirroring the `usage_box` idiom), sum in `run_eval_job`, and hand
the totals to the `finally`'s `finalize_run`. No new bookkeeper, no ctx plumbing.

⚠ **Two decisions the planner owes, which nothing in CONTEXT.md settles:**

1. **The WITHOUT arm was PAID FOR.** `eval_runner_service.py:901-908` runs the baseline arm and its
   docstring says *"its verdict is persisted + streamed but does NOT count toward the rollup (OQ3) —
   return intentionally ignored."* That is correct for a **verdict** rollup and wrong for a **spend**
   rollup: **you were billed for both arms.** D-256-12's own logic ("you were billed for each one the
   provider served") says the companion run's token total must include BOTH arms. The current code
   throws the WITHOUT arm's return away entirely, so this is a real (small) plumbing decision, not a
   copy.
2. **The judge shot is a THIRD paid call per arm** (`_judge_eval_answer`, `:648`) and its usage is
   not measured anywhere. If it is not counted, the coverage marker for an eval run must say so.
   ⚠ **This is a NEW hole this research found and no decision covers it.** Cheapest honest answer:
   count the two agent-loop arms, and record `judge` as *absent* in the coverage marker rather than
   silently folding it in. (See §Register Entries Owed, R-4.)

---

### Q2 — Is the per-phase ADD write single-writer?

This question has **two halves, and the second half is the most important finding in this document.**

#### Q2-A — concurrency

> ### **VERDICT: NOT single-writer — but an ADD is the CORRECT arithmetic under the concurrency that actually exists, and the real idempotency hazard is a REPEATED call, not a racing one. The cheapest safe shape needs NO key, NO lock and NO upsert: derive the delta from the breaker's own watermark, which makes a repeated call write `0`.**

**What `claim_run` is, measured.** `backend/app/db/workflows.py:2282-2325` — a CAS on a
`claimed_at` **lease**, `harness_resume_lease_seconds = 300` (`config.py:1421`):

```sql
UPDATE workflow_runs SET claimed_at = now()
WHERE id = $1 AND status IN ('active','paused')
  AND (claimed_at IS NULL OR claimed_at < now() - make_interval(secs => $2))
RETURNING id
```

It has exactly **two** call sites — both on RESUME paths: `api/runs.py:634` (the ask_user re-drive)
and `harness_engine.py:2949` (the boot sweep). **The fresh-run launch takes no claim at all**, and
that is measured, not inferred: `models/thread.py:421-423` records *"5 of 181 `workflow_runs` carry
`claimed_at` and **0 of 149 COMPLETED rows do** — `claim_run`'s CAS lease is the distributed-worker
path and **the in-process producer never takes it**."*

**Can two producers reach `_enforce_budget` for the same `run_id`?** The narrowing guards are real
and mostly hold:

| Path | Guard | Verdict |
|---|---|---|
| ask_user re-drive (`api/runs.py:611-635`) | `WHERE wr.status = 'paused'` + `claim_run` | **Cannot race a live producer** — `api/runs.py:582` states the reason: *"an `active` run already has a producer"*. |
| boot sweep (`harness_engine.py:2938-2949`) | `find_resumable_runs` (status `active`/`paused`) + `claim_run` | ⚠ **CAN race.** A fresh producer left `claimed_at` NULL, so the CAS matches on `claimed_at IS NULL` even while that producer is alive. Worker B rebooting while worker A drives an `active` run will claim it and re-drive. |
| lease expiry | `claimed_at < now() - 300s` | ⚠ **CAN race.** A single phase legitimately exceeding 300 s (the registry carries `llm_call_timeout_seconds` up to **900** — `config.py:352`, `:380`, `:405`) makes the run re-claimable while its producer is still working. |
| the STOP path | `finish_run`'s L-01 guard | **MEASURED concurrent**: `db/workflows.py:2229-2233` — *"at the shipped `WORKER_COUNT=2`, a Stop landing on worker A writes `cancelled` while worker B's still-running producer reaches its success arm … **on roughly HALF of all stops**"*, and `:2242-2243` — *"the far-worker producer **KEEPS RUNNING**"*. Stop calls `finish_run`, not `_enforce_budget`, so it does not itself double-add — but it proves two live processes on one run is a shipped reality, not a hypothetical. |

⭐ **And here is why this is far less alarming than D-256-09's warning reads.** Under a genuine
double-drive **both producers run the same incomplete phase and BOTH PAY THE PROVIDER.** `run_workflow`
skips `completed`/`skipped` phases (`harness_engine.py:1890-1897`) and re-runs the `active` one from
the top; `_resume_run`'s docstring confirms *"an `llm_agent` re-run forks a fresh `sub_run_id`"*
(`:2905-2907`). **So two ADDs of two real deltas is the TRUTHFUL total, and a SET would be the wrong
one** — it would report half the money actually spent. D-256-09's choice of ADD is not merely safe
here; it is the only honest arithmetic. **Say this in the plan**, because the naive reading ("ADD is
unsafe under concurrency") points the opposite way.

**The genuine hazard is a REPEATED call for ONE payment**, and there are exactly three sources:
(a) an asyncpg retry where the `UPDATE` actually committed; (b) `_enforce_budget` being invoked twice
without the box advancing — and it **is** invoked twice per iteration of the phase loop
(`harness_engine.py:1978` `phase_boundary` and `:2547` `phase_completed`); (c) a future third call site.

> ⛔ **THE ANSWER, AND IT COSTS NOTHING: derive the delta from `CircuitBreaker`'s own watermark and
> skip the write when the delta is `(0, 0)`.** `absorb_usage_box` already computes exactly
> `total_in - self.input_tokens` (`circuit_breaker.py:164`). A second `_enforce_budget` on an
> unchanged box therefore yields `0` — the write is **idempotent by construction against repetition**,
> with no phase key, no sequence, no advisory lock and no `ON CONFLICT`. This is strictly better than
> any key-based scheme, and it is why the "attempt-unique key" worry does not bind.

⚠ **On the key question specifically, since it was asked:** there IS a plausible-looking key —
`workflow_phases.id` — and it is **NOT attempt-unique.** `run_workflow` re-runs an `active` phase
**on the same row** (it is an index-driven loop over `ordered`, `harness_engine.py:1886-1897`); no
attempt counter is written per phase. `workflow_runs.continues_used` (migration 063) counts
Continues, not phase retries. So a `(run_id, phase_id)` upsert would **suppress the second real
payment** of a retried phase — worse than the double-book it set out to prevent. **Do not use it.**

#### Q2-B — ⛔ THE WRITE POINT IS UNREACHABLE FOR EVERY INTERACTIVE RUN

> ### **VERDICT: D-256-04's chosen site is behind a guard that only SCHEDULED runs pass. As literally specified, METER-03 / SC#1 would persist nothing for an interactive harness run — which is nearly all of them. The plan MUST move the persist above the `armed` early-return.**

```
backend/app/services/harness_engine.py
1873:        if not breaker.armed:
1874:            return                                  ← EVERY interactive run returns HERE
1875:        breaker.absorb_usage_box(getattr(ctx, "run_usage_box", None))   ← D-256-04's write point
1876:        _tripped, _reason = breaker.check_limits()
```

`breaker.armed` is `True` only when a ceiling is configured (`circuit_breaker.py:128-130`). The
ceiling comes from `getattr(ctx, "max_tokens_per_run", None) or _budget["max_tokens_per_run"]`
(`harness_engine.py:1818-1819`), and **both sources are empty for an interactive run:**

- `load_run_budget`'s own docstring, `db/workflows.py:2518-2520`: *"204-03's scheduler writes the two
  limits into `workflow_runs.metadata` when it mints an unattended run; **an interactive run has none
  and gets a disarmed breaker.**"*
- `grep -rn "max_tokens_per_run" backend/app` → **11 files, and every write is a `workflow_schedules`
  path** (`db/schedules.py`, `models/schedule.py:147` default `500_000`, `api/schedules.py:130`,
  `scheduler_service.py:143/153/188`, `db/workflows.py:2508`). **Nothing anywhere assigns
  `ctx.max_tokens_per_run`.**
- `load_run_budget` also **fails OPEN** (`:2522-2530`) — a DB blip or an unapplied migration 125
  returns empty limits and disarms the breaker, so even a scheduled run can arrive disarmed.

**The fix is a reorder, and it is provably behaviour-preserving** — which makes it exactly the kind
of by-construction claim D-256-13 demands:

```python
async def _enforce_budget(where: str) -> None:
    breaker.absorb_usage_box(getattr(ctx, "run_usage_box", None))   # moved ABOVE the guard
    await persist_run_usage(pool, run_id, delta)                     # the new write, guarded on delta != (0,0)
    if not breaker.armed:
        return
    _tripped, _reason = breaker.check_limits()
    ...
```

Proof the trip decision is untouched: on a disarmed breaker `max_tokens` and `max_duration_seconds`
are both `None`, so `check_limits` returns `(False, None)` unconditionally
(`circuit_breaker.py:188-193`) — the `armed` guard is a short-circuit, never a semantic. And
`absorb_usage_box` mutates only the breaker's own counters, which a disarmed breaker never reads.
**Arithmetic for the SUMMARY: branch count in `_enforce_budget` 3 → 3, `await` count 1 → 2, new
state 0.**

⚠ **The corollary, which the plan must state out loud:** with the reorder, `persist_run_usage` runs
on **every** harness phase boundary of **every** run — that is one extra `UPDATE` per phase. On the
existing loop that is 2 calls per phase (`:1978`, `:2547`), of which the second will almost always
have a `(0,0)` delta and be skipped. Measured cost: ≤ 1 real `UPDATE` per phase.

---

### Q3 — ⛔ THE LANDMINE. Do any shipped queries SUM `runs.input_tokens` / `output_tokens` without the `parent_run_id IS NULL` narrowing?

> ### **VERDICT: NO — and the reason is stronger and more surprising than "none found": NOTHING IN THIS CODEBASE AGGREGATES THOSE COLUMNS AT ALL. There is no SUM, no total, no per-thread / per-org / per-user roll-up, in Python or in SQL, anywhere. The double-count landmine D-256-01 worried about DOES NOT EXIST TODAY, so the sweep imposes NO plan ordering.**

**What was searched — the terms, so "none found" is auditable.** Every command run from
`C:/Vibe Apps/Agentic RAG`:

```bash
# 1. SQL aggregation over the two columns, all casings + COALESCE wrapping
grep -rn "SUM(input_tokens\|SUM(output_tokens\|sum(input_tokens\|sum(output_tokens\
\|SUM(COALESCE(input\|SUM(COALESCE(output\|sum(coalesce(input" backend/app/      # → 0 hits (exit 1)

# 2. EVERY sum(/SUM( in the backend, then eyeballed for token fields
grep -rn "SUM(\|sum(" --include=*.py backend/app/                                # → 23 hits, ZERO over tokens
                                                                                 #   (similarity scores, file sizes,
                                                                                 #    doc rows, costs in takeoff/matcher)

# 3. every mention of either column, grouped by file
grep -rn "input_tokens\|output_tokens" backend/app/ | sed 's/:.*//' | sort | uniq -c

# 4. the narrowing clause itself
grep -rn "parent_run_id IS NULL\|parent_run_id is null\|parent_run_id IS NOT NULL" --include=*.py backend/app/

# 5. SQL side — migrations, full-schema, the supplement
grep -rn "input_tokens\|output_tokens" supabase/migrations/ scripts/*.sql
grep -rn "sum(" supabase/*.sql supabase/migrations/*.sql | grep -i token           # → 0 hits

# 6. frontend, in case a total is computed client-side
grep -rn "input_tokens\|inputTokens\|output_tokens\|outputTokens" frontend/src/ --include=*.ts --include=*.tsx

# 7. the db layer specifically
grep -rn "input_tokens\|output_tokens" backend/app/db/
```

**The evidence table asked for:**

| file:line | What it does with token columns | SUMs? | Narrowed? | Does filling the shells change its result? | What the plan must do |
|---|---|---|---|---|---|
| `backend/app/db/runs.py:104-122` (`finalize_run`) | **WRITES** `input_tokens = $6` (unconditional SET) | no | n/a | n/a — it is the writer | ⚠ see **R-1** below: an unconditional SET is an overwrite hazard |
| `backend/app/db/runs.py:58`, `:90-91`, `:96` | signature + docstring only | no | n/a | no | nothing |
| `backend/app/api/runs.py:677/678`, `:1331/1332` | passes literal `None` (METER-05 sites 1-2) | no | n/a | n/a | FIX |
| `backend/app/services/run_producer.py:230-247` | reads its own in-memory totals, passes them to `finalize_run_terminal` / `finalize_run` | no | n/a | no | **copy this shape** |
| `backend/app/services/run_lifecycle.py:369`, `:386-395` | `input_tokens=None` **default param** + pass-through | no | n/a | no | nothing (see §Corrections) |
| `backend/app/services/eval_runner_service.py:434/465/593-594/682-683` | per-arm writes to **`eval_results`** (a different table) | no | n/a | no | Q1's fix is additive |
| `backend/app/services/harness/phase_types.py:768-787` (`_record_run_usage`) | in-memory `+=` into the ctx box | in memory only | n/a | no | nothing |
| `backend/app/services/circuit_breaker.py:140-164` | in-memory `+=` and one subtraction | in memory only | n/a | no | **reuse this** |
| `backend/app/services/task_service.py:414-455` | in-memory per-turn `+=` into the caller's box | in memory only | n/a | no | **mirror this** |
| `backend/app/api/admin.py` (7 hits), `backend/app/api/settings.py` (5), `backend/app/config.py` (74) | ALL `max_output_tokens` / `sub_agent_max_output_tokens` — model caps, unrelated columns | no | n/a | no | nothing |
| `frontend/src/components/skills/studio/RunCaseDetail.tsx:199-201` | renders `r.input_tokens ?? "—"` for ONE `eval_results` row | no (per-row) | n/a | no (different table) | nothing |

**The four "known narrowed sites" are NOT token sums**, and that matters:

| Site | What it actually is |
|---|---|
| `backend/app/api/workflows.py:1772` | `LEFT JOIN runs r … AND r.parent_run_id IS NULL` inside `delete_workflow_cascade` — stops the join binding `producer_id` to a **sub-agent** so the cascade cancels the right task. **Selects no token column.** |
| `backend/app/api/runs.py:1563` | the same join in the cancel **fallback** (CR-01). **Selects no token column.** |
| `backend/app/api/threads.py:384`, `:468` | `.is_("parent_run_id","null")` on the **active-runs / reconcile** selects, so a sub-agent `run_id` never reaches the client. **Select no token column.** |
| `backend/app/api/panel.py:259-271` | ⛔ **selects `sub_run_id, started_at, completed_at, status, model, provider, parent_run_id` — and NO token columns at all.** |

**Consequences for the plan (this is the part that changes what gets built):**

1. ⭐ **D-256-01's "that narrowing is not new" is TRUE about the CLAUSE and MISLEADING about the
   CONTEXT.** The four cited sites are *anti-sub-agent-identity* guards, not token reads. There is no
   existing correct token total for METER-05 to break. **The sweep is DONE — it imposes no ordering.**
2. ⭐ **D-256-02's fence therefore has ZERO current subjects, which makes its positive control
   MANDATORY rather than merely good practice.** A fence over an empty set is the textbook vacuous
   pass this project has recorded twice. See §Fences To Build #1 — it must assert its matcher fires
   on an in-test haystack, exactly as `test_189_no_egress.py:20-28` does.
3. ⚠ **`panel.py:243-274` cannot be cited as "a shipped surface that reads child tokens"** — measured,
   it reads none. D-256-01 is still right for the reason given (a tree is not a double count), but
   the supporting evidence in CONTEXT.md is wrong. See §Corrections.
4. ⭐ **Phase 257 is the FIRST consumer**, which is the good news: the read rule can be established
   **before** any reader exists, so the fence guards the future rather than retrofitting the past.

---

### Q4 — Does `forced_emit`'s gateway stream actually emit `usage` for every provider?

> ### **VERDICT: The EVENT CONTRACT is uniform (`events.py` declares `usage` / `usage_delta` for all providers) but the EMISSION is synthesized per-adapter in THREE different places, and a shot CAN complete emitting no usage at all — proven at `openai_compat.py:485`, which emits the event ONLY when a usage payload was seen. So the drain mirror MUST initialise `int | None` and persist `None`, never `0`. Both existing absorbers already handle an empty box correctly — verified, not assumed.**

**The roster, DERIVED not retyped.** From `MODEL_CAPABILITIES` in `backend/app/config.py`
(`Counter` over `"provider": "…"`): `openai` 17 · `openrouter` 9 · `minimax` 8 · `zhipu` 8 ·
`anthropic` 7 · `google` 7 · `moonshot` 3 · `deepseek` 2 (+ one `unknown` sentinel). **Eight real
providers — matches CLAUDE.md.** `emit_tier` values present: `force_strict`, `force`, `coerce`;
`coerce` appears **only on moonshot** (`config.py:430-432`).

**`forced_emit` uses the SAME gateway as `task_service`** — `forced_emit.py:50` imports
`open_stream`, and `:464` calls `stream, calling_mode = await open_stream(provider, req)`, drained at
`:465`. So identical events arrive; `_drain` simply has no arm for them.

**Where usage is synthesized, per provider:**

| Provider(s) | Adapter | `usage` emitted at | `usage_delta` | Shape |
|---|---|---|---|---|
| `anthropic` | `provider_gateway/anthropic.py` → `anthropic_service.stream_anthropic` | **`anthropic_service.py:234-238`** (on `message_start`; `input_tokens` known, `output_tokens` ≈ 0) | **`:343-347`** | two-event; `output_tokens` ramps via the delta |
| `google` | `provider_gateway/google.py` → `google_service.stream_google` | **`google_service.py:492`** | **`:496-499`** (`max(0, cur_out - last)`) | cumulative-per-chunk, converted to a delta |
| `openai`, `openrouter`, `deepseek`, `moonshot`, `minimax`, `zhipu` (the `else` branch, `dispatcher.py:117-127`) | `provider_gateway/openai_compat.py` | **`:485-494`, at STREAM END only** | **never** — this adapter emits no `usage_delta` | one terminal event carrying the accumulated totals (+ `reasoning_tokens`) |

**Can a shot complete with NO usage event? YES, and it is source-proven, not inferred:**

```
openai_compat.py:140-142   u = getattr(chunk, "usage", None)
                           if u is None:
                               return input_total, output_total, reasoning_total     # unchanged

openai_compat.py:485       if input_tokens_total is not None or output_tokens_total is not None:
openai_compat.py:486-494       yield {"type": "usage", ...}
openai_compat.py:482-484   # comment, verbatim: "Only emit when a usage payload was seen."
```

So: no `chunk.usage` on any chunk ⇒ the totals stay `None` ⇒ **no `usage` event at all** ⇒ the box
stays `{}`. The app *asks* for it — `openai_service.py:1916` sets
`kwargs["stream_options"] = {"include_usage": True}` **unconditionally for every provider** — but
`include_usage` is an OpenAI extension, and whether moonshot / minimax / zhipu / a given OpenRouter
upstream honours it is **[COULD NOT MEASURE]** from source. Two of the three native adapters are also
conditional (`anthropic_service.py:234` reads `getattr(m,"usage",None)`; `google_service.py:492` sits
inside a usage-present branch), so the `None` path is live on every provider, not just the compat six.

⭐ **The project already knows this happens and has a test for it:**
`backend/tests/unit/test_token_accumulator_missing_usage.py` — *"the provider drops the trailing usage
chunk (Pitfall 3), the accumulator stays at (None, None)"*, plus a `logger.warning` contract that
**must not contain token values**. That file is the canonical analog for METER-06's new cases.

**Where the `{}`-vs-`None` distinction must be preserved in the ten-line mirror — and both existing
absorbers are ALREADY CORRECT (read, not assumed):**

| Absorber | Code | Verdict |
|---|---|---|
| `circuit_breaker.absorb_usage_box` | `circuit_breaker.py:160-161` — `if not box: return` | ✅ `{}` is falsy ⇒ no-op. An empty box adds nothing and, once the delta is derived from the same watermark, **produces no write**. |
| `phase_types._record_run_usage` | `phase_types.py:783-787` — `if input_tokens:` / `if output_tokens:` | ✅ `None` **and** `0` both add nothing. Its docstring says so: *"`None` ADDS NOTHING. A provider that emitted no usage must not be read as zero; the two are different facts."* |
| `task_service._stream_one_iteration` | `task_service.py:452-455` — `if _in_tok is not None:` | ✅ the `is not None` test is the load-bearing one: a genuine measured **0** DOES get written into the box, while an absent measurement does not. |

**Therefore the METER-06 mirror is, precisely:**

1. `forced_emit._drain` (`:516`) — initialise `in_tok: int | None = None`, `out_tok: int | None = None`
   and add the **two arms copied verbatim from `task_service.py:414-430`** (the `usage` arm and the
   `usage_delta` arm, including the `if in_tok is None` first-event branch). Widen the return 3-tuple
   → 5-tuple. ⛔ **Never initialise to `0`** — that is the exact `None`-vs-`0` collapse D-256-06 forbids,
   one layer up.
2. `forced_emit` (`:318`) — accumulate across **every rung** into two `int | None` locals declared
   **above** the rung loop (D-256-12: you were billed for each shot the provider served). Attach them
   to **both** exits: the success return at `:491-500` **and** `_failure()` at `:194-203`. ⚠ `_failure`
   is called from the exhausted-ladder floor (`:507`) **and** from a raised-exception backstop, so it
   must take the totals as parameters rather than default them.
3. `phase_types._exec_llm_emit` — one line, mirroring the two existing precedents **verbatim**:
   `_record_run_usage(ctx, result.get("input_tokens"), result.get("output_tokens"))`.
   Precedents: `phase_types.py:917` and `phase_types.py:1028`. ⚠ It must fire on the **failure** path
   too — the early `return _emit_failure_output(...)` at `:1592` currently exits before any recording
   could happen.

---

## Plan-Ordering Consequences

| # | Constraint | Why |
|---|---|---|
| **O-1** | ⭐ **Q3 imposes NO ordering.** There is no existing token aggregation to break, so METER-05 (filling the shells) does **not** have to wait for a sweep. | §Q3 — measured zero aggregation sites. |
| **O-2** | ⛔ **The `_enforce_budget` reorder (Q2-B) MUST land in the SAME plan as the `persist_run_usage` call, and before any test asserts SC#1.** A plan that adds the writer without the reorder ships a writer that never fires for an interactive run, and its test would pass only against a scheduled-run fixture. | `harness_engine.py:1873-1875`. |
| **O-3** | **Migration 182 must be APPLIED (SQL editor) before any plan whose tests touch `workflow_runs.input_tokens`.** It is an operator step, not a code step. Then `bash scripts/regenerate-full-schema.sh` (no `--reset`) in the same plan. | CLAUDE.md migration rule. |
| **O-4** | **The coverage-marker WRITE must land with (or after) the leg it claims.** A run whose marker says `emit` before METER-06 ships is a lie in a column built to prevent lies (D-256-07 / SC#4). Cheapest: the marker's value is assembled from a single module-level constant that METER-06's plan extends in the same commit as the drain arms. | D-256-07. |
| **O-5** | **The D-256-02 fence can be authored FIRST and is GREEN from birth** (zero current violations) — so its RED drive is entirely against a planted violation. Author it in Wave 0 with the plant/removal evidence, never at the close. | §Q3 consequence 2. |
| **O-6** | **The `forced_emit.py` ledger row must be added in the SAME COMMIT as the first edit to that file**, to `docs/HOT-FILE-LEDGER.md` scan list **and** its own section, plus the CLAUDE.md scan-list row. The gate fires `[no-row]` otherwise. | §G-5. |

### A 4-plan shape that fits G-8 (recommendation, not a decision)

| Plan | Scope | Files | Can it share a worktree? |
|---|---|---|---|
| **256-01** | Migration 182 + `persist_run_usage` + the `_enforce_budget` reorder + the delta return from `absorb_usage_box` | `supabase/migrations/182_*.sql`, `db/workflows.py`, `harness_engine.py`, `circuit_breaker.py` | — |
| **256-02** | METER-05: the five producer shells + the `run_producer.py:231` missing-usage warning mirrored at each | `api/runs.py`, `harness_engine.py` (site 3), `harness/publish_service.py`, `scheduler_service.py` | ⛔ **shares `harness_engine.py` with 256-01** — either merge into 256-01 or sequence it |
| **256-03** | METER-06: the drain arms + the ladder accumulator + the `_exec_llm_emit` line + the `forced_emit.py` ledger row | `forced_emit.py`, `harness/phase_types.py`, `docs/HOT-FILE-LEDGER.md`, `CLAUDE.md` | ✅ disjoint from 256-01/02 |
| **256-04** | The D-256-02 fence (RED-driven), Q1's eval accumulator, the coverage-marker write, and the four register entries | `tests/unit/test_256_*.py`, `eval_runner_service.py`, `.planning/seeds/` | ✅ disjoint |

⚠ **256-01 and 256-02 both edit `harness_engine.py`** — worktree-incompatible. Either fold them into
one plan (my recommendation: **3 plans**, with 256-01 absorbing 256-02) or run them strictly in
sequence. Nothing else in this phase collides.

---

## The Write Seam

### `persist_run_usage` — signature and body

```python
# backend/app/db/workflows.py — a NEW module-level async def. finish_run stays byte-unchanged.
async def persist_run_usage(
    pool: asyncpg.Pool,
    run_id: UUID,
    *,
    input_delta: int | None,
    output_delta: int | None,
) -> None:
    """ADD one phase's token delta onto workflow_runs (D-256-05 / D-256-09).

    ⛔ ADD, NEVER SET. ctx.run_usage_box resets to {} on every _resume_run
    (harness_engine.py:1844), so each segment sees only its own spend; a SET would
    make the last segment's total the whole run's total.

    ⛔ A (0, 0) or (None, None) delta WRITES NOTHING. NULL means never measured and 0
    means measured as zero; a no-op call must not turn the first into the second.
    This is also what makes the write IDEMPOTENT AGAINST REPETITION: the delta comes
    from CircuitBreaker's own watermark, so a second _enforce_budget on an unchanged
    box yields (0, 0) and never reaches the UPDATE.

    ⚠ NOT value-identity-safe, unlike finish_run (its docstring, :2191-2199) — an ADD
    is order-independent but not repeat-safe, which is exactly why the (0,0) guard
    above is load-bearing rather than an optimisation.
    """
    if not input_delta and not output_delta:
        return
    await pool.execute(
        """
        UPDATE workflow_runs
        SET input_tokens  = COALESCE(input_tokens, 0)  + $2,
            output_tokens = COALESCE(output_tokens, 0) + $3
        WHERE id = $1
        """,
        run_id,
        int(input_delta or 0),
        int(output_delta or 0),
    )
```

⚠ **One consequence to state in the plan:** `COALESCE(input_tokens,0) + $n` turns the first write
`NULL → n`, which is correct, and means **a run that never reaches a phase boundary keeps `NULL`** —
the D-256-06 distinction survives end-to-end. ⛔ **Do not add `NOT NULL DEFAULT 0`** to make the
`COALESCE` unnecessary; the `COALESCE` exists precisely so the column can stay nullable.

### The delta derivation — reused from `absorb_usage_box`, quoted verbatim

```python
# backend/app/services/circuit_breaker.py:150-164  (the CURRENT code — do not reimplement)
def absorb_usage_box(self, box: dict | None) -> None:
    """Sync from a CUMULATIVE ``usage_box`` — the shipped accumulator idiom. …
    the box holds RUN-CUMULATIVE totals while ``record_tokens`` is ADDITIVE. This does the
    subtraction in ONE place — the breaker — rather than making the hot engine file
    carry delta bookkeeping it would have to get right."""
    if not box:
        return
    total_in  = max(0, int(box.get("input_tokens")  or 0))
    total_out = max(0, int(box.get("output_tokens") or 0))
    self.record_tokens(total_in - self.input_tokens, total_out - self.output_tokens)
```

**The mechanism, concretely:** the watermark is the breaker's own `self.input_tokens` /
`self.output_tokens` (initialised `0` at `:117-118`). The delta is `box_total - watermark`.
`record_tokens` (`:140-148`) then advances the watermark by that delta, clamping negatives to zero
(*"a usage box that went BACKWARDS … means the box was reset under us, and subtracting from a spend
counter is never the safe direction"*).

⛔ **THE PHASE MUST NOT WRITE A SECOND BOOKKEEPER.** The minimal change is to make
`absorb_usage_box` **return the delta it just recorded**:

```python
def absorb_usage_box(self, box: dict | None) -> tuple[int, int]:
    if not box:
        return (0, 0)                     # ← {} and None both yield a no-op delta
    total_in  = max(0, int(box.get("input_tokens")  or 0))
    total_out = max(0, int(box.get("output_tokens") or 0))
    d_in  = max(0, total_in  - self.input_tokens)
    d_out = max(0, total_out - self.output_tokens)
    self.record_tokens(d_in, d_out)
    return (d_in, d_out)
```

**Arithmetic for the by-construction claim:** `circuit_breaker.py` — methods 9 → 9, branches in
`absorb_usage_box` 1 → 1, new state 0, new imports 0; only the return type widens from `None` to
`tuple[int,int]`. Existing callers ignore returns, so every one is byte-compatible.
⚠ **Verify the `max(0, …)` clamp is preserved on the returned delta** — `record_tokens` clamps
internally today, so extracting `d_in`/`d_out` **must** clamp at the same place or a backwards box
would hand `persist_run_usage` a negative and the DB would subtract real spend.

### The idempotency answer (Q2), stated for the plan

| Hazard | Answer | Cost |
|---|---|---|
| `_enforce_budget` called twice per phase (`:1978`, `:2547`) with an unchanged box | delta is `(0,0)` → `persist_run_usage` returns before the `UPDATE` | zero |
| a retried `UPDATE` that already committed | same: the box has not advanced, so a re-derived delta is `(0,0)`. ⚠ But a retry **inside** one `persist_run_usage` call would re-add — so **do not add a retry loop** to this writer; let the exception propagate to `_enforce_budget`'s caller (which is what every other write here does) | zero |
| two producers genuinely double-driving one phase | **both paid; both ADDs are correct** (§Q2-A) | zero |
| an attempt-keyed upsert | ⛔ **REJECTED** — no attempt-unique key exists and `workflow_phases.id` is reused across retries, so it would suppress a real second payment | — |

---

## Migration 182

### Verified preconditions

| Claim | Verdict |
|---|---|
| `workflow_runs` has 16 columns | ✅ **VERIFIED** — `supabase/full-schema.sql`: `id, thread_id, definition_id, status, current_phase_id, org_id, created_at, updated_at, claimed_at, inputs, model, continues_used, user_id, is_golden_run, definition_snapshot, metadata` = **16**. |
| zero token columns | ✅ **VERIFIED** — no `input_tokens` / `output_tokens` in the DDL; `grep` over `supabase/migrations/` finds them only in `035_runs_table.sql` and `080_eval_runs_and_results.sql`. |
| `workflow_runs` carries `org_id` | ✅ **VERIFIED** — `org_id uuid NOT NULL`. The per-org aggregate is possible. |
| `182` is the next free number | ✅ **VERIFIED** — `181_revoke_public_secdef_functions.sql` is the highest; 148 numbered files; `ls \| grep -E '^[0-9]+[a-z]'` → **no letter-suffixed siblings**. |
| existing indexes on `workflow_runs` | ⚠ **only two**: `idx_workflow_runs_thread (thread_id)` and `idx_workflow_runs_user_id (user_id)`. **There is NO `org_id` index**, so Phase 257's per-org query has none today regardless of the marker's type. 182 is the natural place to add one. |
| `runs` column types to mirror | `input_tokens integer` / `output_tokens integer`, both nullable — **exactly** what D-256-06 specifies. |

### The coverage marker — recommendation with the reason

The constraint is the whole decision: **per-run read AND per-org "which runs are not fully covered"
without a scan.** Measured against that:

| Type | Per-run read | Per-org "not fully covered" | Verdict |
|---|---|---|---|
| `text` CSV (`'agent,single,batch,emit'`) | trivial | `<>` on text; **order-sensitive** — `'emit,agent'` and `'agent,emit'` become two values for one fact, so the app must canonically sort forever or the query silently misses rows | ⛔ rejected — a correctness trap for a cosmetic saving |
| `jsonb` | fine | negation over `@>` is not GIN-indexable; and CONTEXT.md's own Deferred list already rejected jsonb here *"because Phase 257 must aggregate per org"* | ⛔ rejected |
| enum array (`token_coverage_kind[]`) | fine | same negation problem as `text[]`, **plus** every new counting leg becomes a `CREATE TYPE … ADD VALUE` migration that cannot run in a transaction with other DDL on some Postgres paths | ⛔ rejected — the enum buys type safety and costs migration flexibility |
| **`text[]`** | fine — `= ANY`, `@>`, and it renders directly | ✅ with a **partial btree index** whose predicate carries the complete set; negation is not GIN-indexable but a *partial index* sidesteps that entirely by indexing only the incomplete rows | ⭐ **RECOMMENDED** |

**Why `text[]` + partial index wins:** "not fully covered" is a **small, sparse** population — the
rows you want are the exception. A partial index stores only those rows, so the per-org query is an
index-only narrowing over a tiny relation and never touches a covered run. Array containment `@>` is
`IMMUTABLE`, which is what a partial-index predicate requires.

**The cost, stated rather than hidden:** the complete-set literal lives **inside the index
predicate**, so adding a *fifth* counting leg later requires one migration to `DROP` and re-`CREATE`
the index. That is one migration with no data change, and it buys an index that answers the question
without a scan. ⚠ **[ASSUMED — verify at plan time by test-applying the DDL locally]** that Postgres
accepts `@>` with an array literal in an index predicate; it is immutable by catalogue, but the plan
should paste-and-verify rather than trust this line.

### Exact DDL

```sql
-- 182: workflow_runs token totals + coverage marker (Phase 256 / METER-03, D-256-06, D-256-07)
--
-- ⛔ NULLABLE, NOT `NOT NULL DEFAULT 0`. NULL = never measured; 0 = measured as zero.
--    CLAUDE.md: "a provider that emitted no usage is a DIFFERENT fact from one that used zero
--    tokens — do not coalesce." Collapsing them makes an uninstrumented run indistinguishable
--    from a free one, which is the exact defect Phase 257 exists to prevent ($0.00 for an
--    unrated model). `integer`, mirroring public.runs exactly (035_runs_table.sql:30-31) so the
--    same grain reads the same in both tables.
--
-- ⛔ D-256-03: workflow_runs is AUTHORITATIVE for a harness run; the `runs` producer shell
--    carries ITS SEGMENT only. Different grains, both honest. NEVER SUM ACROSS THE TWO.
--
-- ⛔ D-256-01 READ RULE: any org-level or thread-level total over `runs` sums only rows
--    WHERE parent_run_id IS NULL — a parent row is INCLUSIVE of its descendants.

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS input_tokens   integer,
  ADD COLUMN IF NOT EXISTS output_tokens  integer,
  ADD COLUMN IF NOT EXISTS token_coverage text[];

COMMENT ON COLUMN public.workflow_runs.input_tokens IS
  'Phase 256 (METER-03). Cumulative input tokens for this harness run, ACCUMULATED BY ADDITION at every phase boundary by db.workflows.persist_run_usage (never SET — ctx.run_usage_box resets per run SEGMENT at harness_engine.py:1844). NULLABLE and deliberately so: NULL means never measured, 0 means measured as zero. Do not coalesce. This is the WORKFLOW grain; runs.input_tokens on the producer shell is the SEGMENT grain (D-256-03) — never sum across the two tables.';

COMMENT ON COLUMN public.workflow_runs.output_tokens IS
  'Phase 256 (METER-03). See input_tokens. Same writer, same grain, same NULL-vs-0 rule.';

COMMENT ON COLUMN public.workflow_runs.token_coverage IS
  'Phase 256 (D-256-07 / SC#4). WHICH COUNTING LEGS this run''s totals actually include, e.g. {agent,single,batch,emit}. A run persisted before a leg shipped reads honestly as NOT covering it, FOREVER, with no date arithmetic and no memory — inferring coverage from created_at vs a ship date IS "someone''s memory" encoded as a comparison, which SC#4 forbids. NULL = a pre-182 run (coverage unknown, which is a THIRD state and not the same as empty). Phase 257''s METER-07 "what it cannot see" view reads THIS COLUMN, never hand-written prose.';

-- The per-org "which runs are not fully covered" query, WITHOUT a scan (D-256-07's hard
-- constraint). PARTIAL: only incomplete rows are indexed, so the covered majority costs
-- nothing and the negation GIN cannot serve is sidestepped.
-- ⚠ The complete set is a LITERAL here. Adding a fifth counting leg means DROP + re-CREATE
--    this index in a new migration — one migration, no data change. That is the price of an
--    index that can answer a NEGATIVE question.
CREATE INDEX IF NOT EXISTS idx_workflow_runs_org_coverage_incomplete
  ON public.workflow_runs (org_id, created_at DESC)
  WHERE token_coverage IS NULL
     OR NOT (token_coverage @> ARRAY['agent','single','batch','emit']::text[]);
```

### The ACL / supplement / advisor tail

> ### **MEASURED: migration 182 owes NOTHING to `scripts/full-schema-supplement.sql`. Here is the proof, because "nothing owed" is exactly the kind of claim this project has been burned by.**

1. **`workflow_runs` has no explicit GRANT or REVOKE anywhere.** `grep -n "GRANT.*workflow_runs\|workflow_runs.*GRANT" supabase/full-schema.sql` → **0 hits**. It relies on Supabase's project-init blanket table grants plus its four RLS policies.
2. **Table-level privileges are inherited by a new column; column-level ones are not.** The `connector_connections` trap (migration 118, `full-schema.sql:7576` `GRANT SELECT ( … )`) bit precisely because grants there were enumerated **per column**. `workflow_runs` has none, so `ADD COLUMN` needs no grant.
3. **The supplement mentions `workflow_runs` zero times** (`grep -n "workflow_runs" scripts/full-schema-supplement.sql` → 0 hits), and its own maintenance header lists the twelve migrations that carry table grants — **182 would not join that list.** Re-derived with the header's own command: table-level `GRANT`/`REVOKE` appear in `118, 126, 127, 128, 129, 150, 151, 156, 168, 169, 172, 177` — twelve files, seven tables, none of them `workflow_runs`.
4. ⚠ **`pg_dump --no-privileges` means an index and a comment ARE captured but a privilege is not.** 182 adds no privilege, so `regenerate-full-schema.sh` (no `--reset`) captures 100% of it.

**What 182 DOES owe:**

- [ ] Paste into the **Supabase SQL editor** (local), then `bash scripts/regenerate-full-schema.sh` **without** `--reset`. ⛔ Never `supabase db push` / `db reset`.
- [ ] ⛔ **Never hand-edit `supabase/full-schema.sql`.**
- [ ] Run `node scripts/check-schema-acl-parity.cjs` and `backend/venv/Scripts/python scripts/check-greenfield-privileges.py` — the two executable halves the supplement header names. Both should be unchanged; **record that they were run**, because "unchanged" is a measurement and not an assumption.
- [ ] `node scripts/check-deploy-drift.sh` / the `deploy-artifacts` rule: 182 adds no env var and no seed row, so nothing in `deploy/onebox.env.example` or `docs/OPERATOR.md` moves. State it.
- [ ] **Cloud parity is operator-gated and OWED at the next production push**, with `get_advisors(security)` in the checklist (CLAUDE.md standing rule after BUG-260911-01). 182 is local-only until then.

---

## Fences To Build

### Fence 1 — the `parent_run_id IS NULL` narrowing (D-256-02)

**Recommended shape: a pytest **AST** fence over `backend/app`, not a grep-shaped guard.** Reason:
the thing to detect is *"a query that aggregates a token column of `runs` without the narrowing"* —
that is a property of a SQL **string** assembled across concatenated literals (which is exactly how
`api/runs.py:1558-1566` and `api/workflows.py:1755-1774` build theirs). A line-oriented grep cannot
see a `SUM(` on one line and a missing `WHERE` clause four lines down; an AST walk that collects
`ast.Constant` string pieces per call and joins them can. `test_189_no_egress.py` proves a
token-grep fence is viable for *presence*; this fence is about a **conjunction**, which needs the AST.

| Property | Value |
|---|---|
| **What it asserts** | For every string literal (including implicitly-concatenated and f-string parts) under `backend/app/**/*.py` that contains both a token-column name (`input_tokens` / `output_tokens`) and an aggregation token (`SUM(` / `sum(` / `count(` over `runs`), the same joined statement also contains `parent_run_id IS NULL`. Plus: the supabase-py builder form (`.is_("parent_run_id","null")` alongside a token select). |
| **The planted violation that drives it RED** | Add a single method to `backend/app/db/runs.py`:<br>`await pool.fetchrow("SELECT SUM(input_tokens) AS t FROM runs WHERE org_id = $1", org_id)`<br>— no `parent_run_id` clause. Gate must exit non-zero and **name the file and the line**. |
| **How the plant is proven removed** | ⛔ Not by timing, and not by "I deleted it" — the Phase 255 `emitters.py` incident is why. **`md5sum` the file before planting, after planting (must differ), and after removal (must be byte-identical to the first)**, and record all three digests in the plan SUMMARY. The precedent for md5-proved restoration in this repo: `backend/tests/unit/services/sources/test_240_contract_unchanged.py`. |
| ⛔ **The vacuity control is MANDATORY, not optional** | §Q3 measured **zero** current aggregation sites, so this fence's subject set is **empty** and it would pass over nothing. Copy `test_189_no_egress.py:20-28` exactly: drive the matcher against an **in-test haystack that DOES contain a violation**, and assert the walk **visited a plausible number of files** (`>= 150` `.py` files under `backend/app` — measured: the ledger gate parses 287 rows over a comparable tree, and the app has well over 150 modules). ⚠ That file also records its own matcher being **falsified by its own control** (`\bmcp\b` does not match `MCPClient`) — budget for the same. |
| **Closest existing analog to copy** | **`backend/tests/unit/test_189_no_egress.py`** — Case A is a source-walk fence with two independent vacuity guards and it was *"authored in Wave 0 and OBSERVED RED before any source existed."* Second-closest, for the AST mechanics over a registry: **`backend/tests/unit/test_255_extension_contract_guard.py`** (imports `ast`, walks six named `TRIGGER_FILES`). |

### Fence 2 — METER-06's counting is wired (not merely present)

| Property | Value |
|---|---|
| **What it asserts** | (a) `forced_emit._drain` handles **both** `usage` and `usage_delta` — asserted **behaviourally**, by driving `_drain` over a fake event stream, **not** by grepping for the arm names. ⛔ *"Presence assertions cannot see content drift"* — a `elif et == "usage": pass` would satisfy a grep. (b) A stream that emits **no** usage yields `(None, None)`, never `(0, 0)`. (c) A **multi-rung** run accumulates across rungs (D-256-12), including one whose earlier rung FAILED. (d) `_failure()`'s dict carries the token keys. |
| **The planted violation** | Change the `usage` arm's initialisation from `None` to `0`; case (b) must go RED. Separately, move the accumulator inside the rung loop; case (c) must go RED. |
| **How the plant is proven removed** | md5 before/plant/after, as above. |
| **Closest analog** | **`backend/tests/unit/test_token_accumulator_missing_usage.py`** — it is literally this assertion one module over (*"the accumulator stays at (None, None)"*), and it also pins a `logger.warning` **format string** while asserting it contains **no token values** (T-073-04). Reuse both ideas. |

### Fence 3 — `finish_run` is byte-unchanged (D-256-05)

| Property | Value |
|---|---|
| **What it asserts** | `db/workflows.py`'s `finish_run` source is byte-identical to its base-commit form, and its call-site count is **7** across **4** files. |
| **Why it is worth a fence at all** | D-256-05 makes "byte-unchanged" a *decision*, and this repo's own history is that a decision in prose is not a guard. `run_lifecycle.py`'s section in `docs/HOT-FILE-LEDGER.md` records the precedent shape: needles written *"without their opening parenthesis so the needle counts CALLS, not mentions."* |
| **Cheapest form** | An `ast`-extracted function source compared to a committed digest, plus an `ast.Call` count over the four caller modules. No plant needed — the plant is any edit to `finish_run`, which the plan will not make. ⚠ So drive it RED once, deliberately, by adding a whitespace-only change, and restore. |

### Fence 4 — the `_enforce_budget` reorder did not move the trip decision

| Property | Value |
|---|---|
| **What it asserts** | A **disarmed** breaker (`max_tokens=None, max_duration_seconds=None`) absorbs a non-empty box, `persist_run_usage` is called with a real delta, and `check_limits` is **never reached** / `trip_breaker` is never called. Symmetrically: an **armed** breaker still trips at exactly its ceiling with `>=` semantics. |
| **Why** | This is the one place the phase changes control flow. The arithmetic claim ("the guard is a short-circuit, never a semantic") must be an executed test, not a paragraph. |
| **Closest analog** | **`backend/tests/unit/test_scheduler_circuit_breaker.py`** and **`backend/tests/unit/test_scheduler_breaker_seam.py`** — both already construct `CircuitBreaker` directly and exercise `absorb_usage_box`. |

---

## Test Strategy Under A Hard Gate

**The gate:** `pytest tests/unit -q --continue-on-collection-errors`, run in `backend/` with the
venv. Ceiling **71 failed**, **zero headroom**. The SET is committed:
`.planning/phases/256-every-token-is-counted-and-kept/256-BASELINE-backend-failing-set.txt` —
**verified 71 lines.** ⛔ **Diff the SET, never the count** (memory: *"capture the SET, never a tail"*).

### Where the relevant tests already live — real files, verified present

| Surface | Existing test file(s) | In the gate? |
|---|---|---|
| `db/workflows.py` | `tests/unit/test_workflows_updated_at.py`, `tests/unit/test_stateful_workflows.py`, `tests/unit/test_published_workflow_ownership.py` | ✅ `tests/unit/` |
| `db/runs.py` (`finalize_run`) | **`tests/unit/test_db_runs.py`** | ✅ |
| `CircuitBreaker` / `absorb_usage_box` | **`tests/unit/test_scheduler_circuit_breaker.py`**, **`tests/unit/test_scheduler_breaker_seam.py`**, `tests/unit/test_085_task_service.py` | ✅ |
| `harness_engine` | ⚠ **`tests/test_harness_engine.py`** — **`tests/`, NOT `tests/unit/`.** It is therefore **OUTSIDE the canonical gate**. A RED drive placed there is invisible to the baseline. ⛔ **New `harness_engine` cases go in `tests/unit/`.** | ❌ |
| `forced_emit` | **`tests/unit/test_forced_emit.py`**, `tests/unit/test_103_forced_emit_strict.py`, `tests/unit/test_111_1_forced_emit_local.py`, `tests/unit/test_eval_forced_emit.py`, `tests/unit/test_llm_emit_executor.py` | ✅ |
| token accumulation / `None`-vs-`0` | **`tests/unit/test_token_accumulator_missing_usage.py`** (+ `_openai`, `_anthropic`, `_multi_iter`) | ✅ |
| migration shape | `tests/integration/test_120_migration.py`, `tests/integration/test_140_migration_091.py`, `tests/integration/test_061_runs_table.py` — ⚠ **`tests/integration/`, outside the unit gate**; they need a live DB | ❌ |
| AST/source fences | `tests/unit/test_189_no_egress.py`, `tests/unit/test_255_extension_contract_guard.py`, `tests/unit/test_190_egress.py` (+ ~28 more importing `ast`) | ✅ |

### How a RED drive is proven RED without adding to the 71

The mechanism this project uses, and it works because a RED drive is **transient**:

1. **Capture the SET first, from a clean tree:**
   `pytest tests/unit -q --continue-on-collection-errors 2>&1 | grep -c "^FAILED"` for the count and
   `grep "^FAILED"` for the **names** — ⛔ never `| tail`.
2. **Author the new test file. Run ONLY it:** `pytest tests/unit/test_256_<name>.py -x`. It fails.
   **That is the RED, and it is recorded from a targeted run — it never enters a full-gate figure.**
3. **Plant the violation, run only the fence, record non-zero. Remove, run again, record zero.**
   Record the three md5 digests.
4. **Implement. Run the targeted file green. THEN run the full gate ONCE**, at the wave close, and
   **diff the SET against the 71 names** — `comm -13` both directions, so a name that *left* the set
   is visible too (a disappeared failure is also a change and must be explained).
5. ⛔ **A new test authored RED and left RED at the wave close is a +1 above 71 and breaks the gate.**
   The only legal residue is a test that passes.

⚠ **`tdd_mode: true`, so the RED drive is not optional.** And per G-8's own carve-out, the TDD RED
drives, the verifier, the security review and the migration discipline are the four things that may
**never** be cut to hit the plan count.

---

## The Five Producer Shells (D-256-08 sites 1-5)

**All five verified: the `ctx` object is in scope in the `finally`, and `run_workflow` mutated
`ctx.run_usage_box` IN PLACE at `harness_engine.py:1844`. None of the five is demoted to REGISTER.**

| # | Site | Object carrying the box | Verified how | Writer used | Notes |
|---|---|---|---|---|---|
| 1 | `api/runs.py:677-678` | `ctx` from `_build_resume_context(dict(row), redis, pool)` (`:657`); `_pid = getattr(ctx,"producer_run_id",None)` at `:664` | read `:611-690` — the `finally` closes over `ctx`, which was passed to `_resume_run` at `:661` | `db.runs.finalize_run` | ask_user re-drive |
| 2 | `api/runs.py:1331-1332` | `wf_ctx`, built in-line and passed to `run_workflow` at `:1312-1315` | read `:1280-1338` — `finally` at `:1319` is in the same closure | `_finalize_run` (aliased `db.runs.finalize_run`) | continuation |
| 3 | `harness_engine.py:3051-3052` | `ctx = await _build_resume_context(run, redis, pool)` (`:3024`), passed to `_resume_run` at `:3035`; `_pid` read at `:3040` | read `:3024-3057` | `db.runs.finalize_run` | boot-sweep resume |
| 4 | `publish_service.py:1671-1672` | `ctx` built at `:1600-1638` (`is_golden_run=True`), passed to `run_workflow` at `:1647` | read `:1640-1677` | `finalize_run` | ⭐ a golden run is real money — FIX is right |
| 5 | `scheduler_service.py:296-297` | `ctx`, passed to `run_workflow` at `:274`; `pid` read at `:279` with an explicit `if ctx is not None` | read `:250-303` | ⚠ **`finalize_run_terminal`, NOT `finalize_run`** — `:282-286` explains why (the DB-only writer would leave the run in `runs:active` as a GHOST) | handle `ctx is None` |

**The shape to copy — `run_producer.py:230-247`, and it includes the WARNING:**

```python
# backend/app/services/run_producer.py:230-247  (VERBATIM — this is the pattern)
if _input_tokens_total is None and _output_tokens_total is None:
    logger.warning(
        "runs.usage missing for run=%s provider=%s model=%s",
        run_id, resolved_provider, resolved_model,
    )
if terminal_status != "cap_paused":
    await finalize_run_terminal(
        pool=..., redis=redis, run_id=run_id, thread_id=...,
        status=terminal_status, error=terminal_error,
        completed_at=datetime.now(timezone.utc), message_id=...,
        input_tokens=_input_tokens_total,      # ← real totals
        output_tokens=_output_tokens_total,
    )
```

⚠ The missing-usage warning is a **contract**, not decoration — `db/runs.py:96-99`: *"Callers that
detect this case MUST emit `logger.warning('runs.usage missing for run=%s provider=%s model=%s', …)`
BEFORE calling finalize_run with None/None."* ⛔ **Five of the five sites currently violate that
documented contract**, and mirroring the warning is part of the fix, not an extra.

**At each of the five, the value to pass is:**

```python
_box = getattr(ctx, "run_usage_box", None) or {}
_in  = _box.get("input_tokens")      # int or None — NEVER `or 0`
_out = _box.get("output_tokens")
```

⛔ **Never `_box.get("input_tokens", 0)` and never `or 0`.** An absent key must stay `None` all the
way to the column (D-256-06). ⭐ And this is **grain-correct** for D-256-03: the box holds the
SEGMENT's spend (reset at `:1844`), each of these shells is a per-segment `runs` row, so writing the
segment box onto the segment shell is exactly right.

---

## Corrections To Inherited Claims

> Recorded **beside** the original, never overwriting it — the project's standing rule.

### C-1 — ⛔ `256-CONTEXT.md` D-256-04: the chosen write point is unreachable for interactive runs

- **Original (D-256-04), verbatim:** *"Totals are persisted AFTER EVERY PHASE, at the existing breaker absorb point (`harness_engine.py:1875`, inside `_enforce_budget`). This is the only option that satisfies SC#1's 're-reading the run after the process restarts' literally."*
- **MEASURED:** `harness_engine.py:1873-1874` is `if not breaker.armed: return`, **above** line 1875. `breaker.armed` requires a configured ceiling; `load_run_budget`'s docstring (`db/workflows.py:2518-2520`) states *"an interactive run has none and gets a disarmed breaker"*; and `grep -rn "max_tokens_per_run" backend/app` shows every writer is a `workflow_schedules` path with **nothing assigning `ctx.max_tokens_per_run`**.
- **The decision is still RIGHT** — the absorb point is the correct *place*. What is wrong is the *line*: the persist must sit **above** the `armed` guard, not at `:1875`. Without that, SC#1 fails for every interactive harness run.

### C-2 — `256-CONTEXT.md` <code_context>: `panel.py:243-274` does NOT read child tokens

- **Original, verbatim:** *"`backend/app/api/panel.py:243-274` — renders per-sub-agent rows via `parent_run_id`. ⚠ A shipped surface that reads child tokens."*
- **MEASURED:** its `SELECT` is `r.run_id AS sub_run_id, r.started_at, r.completed_at, r.status, r.model, r.provider, r.parent_run_id` (`panel.py:259-263`). **No token column.** The *structural* claim (sub-agents really do write `runs` rows with `parent_run_id`) stands and D-256-01 is unaffected; the *evidence* does not.

### C-3 — D-256-01: "that narrowing is not new" is true about the clause, misleading about the context

- **Original:** *"That narrowing is not new — `api/workflows.py:1772` and `api/runs.py:1563` already use it."*
- **MEASURED:** both are **cancel/reconcile joins**, not token reads, and neither selects a token column (§Q3). **No shipped query aggregates `runs.input_tokens` anywhere.** So D-256-01's read rule has **no precedent to lean on and no existing subject** — which raises rather than lowers the bar on Fence 1's vacuity control.

### C-4 — D-256-13: `scheduler_service.py` ALREADY HAS a ledger row; and a FOURTH firing file with no row was missed

- **Original:** *"Also touched and not yet firing, **rows to be added at the touch** … `backend/app/services/scheduler_service.py` (5 / 2 / 399), `backend/app/services/run_reconciler.py` (3 / 2 / 325), `backend/app/services/circuit_breaker.py` (1 / 1 / 331)."*
- **MEASURED** by running the gate, not by reading the table — `node scripts/check-hot-file-ledger.cjs --files …` over all thirteen candidates:
  ```
  scan list: 287 rows · subject: 13 files · watched: 13
  G-5 CANNOT FIRE ON 4 FILE(S) — they have no ledger row:
    [no-row] backend/app/services/circuit_breaker.py
    [no-row] backend/app/services/forced_emit.py
    [no-row] backend/app/services/run_reconciler.py
    [no-row] backend/app/services/task_service.py        ← NOT NAMED BY D-256-13
  ```
  - **`scheduler_service.py` HAS a row** — `docs/HOT-FILE-LEDGER.md:10585` (scan list) **and** `:8661` (its own section). No row is owed.
  - ⛔ **`task_service.py` measures `19 / 10 / 958` — FIRING at 10 phases, absent from BOTH registers for its entire life.** This is `config.py`'s failure repeating for at least the fourth time. It is the file METER-06 *mirrors from* (read-only), so the gate will not demand it if no plan modifies it — but by the `LibraryCloudImport.tsx` / `settingsSearchPayload.ts` precedent (*an absent row is invisible to G-5 at any count*) **the row should be added here anyway.**

### C-5 — D-256-08: `run_lifecycle.py:386` is not "a call site that already passes real totals"

- **Original:** *"`backend/app/services/run_producer.py:249` and `backend/app/services/run_lifecycle.py:386` — the two call sites that **already pass real totals**. Copy their shape at the five broken sites."*
- **MEASURED:** `run_lifecycle.py:386-395` is the body of `finalize_run_terminal`, which **forwards whatever it was given**, and its own parameters default to `input_tokens=None` (`:369-370`). It is a pass-through, not a source of totals. **The only site that sources real totals is `run_producer.py:230-247`** — which also carries the missing-usage warning the five broken sites all lack. **Copy `run_producer.py:230-247`, not `run_lifecycle.py:386`.**

### C-6 — `256-PREFLIGHT.md` §2's vacuous-pass warning: the gate does NOT pass vacuously with no PLAN.md — it exits 2

- **Original:** *"⚠ 255 showed the ledger gate can pass vacuously (`watched: 0`) when a phase only *reads* its hot files. 256 MODIFIES them, so the gate will actually bite here. Run `node scripts/check-hot-file-ledger.cjs 256` **before planning**, not after."*
- **MEASURED, run right now:**
  ```
  $ node scripts/check-hot-file-ledger.cjs 256
  FATAL: no *-PLAN.md in C:\Vibe Apps\Agentic RAG\.planning\phases\256-every-token-is-counted-and-kept
  EXIT=2
  ```
  **Exit 2 is a harness error, not a pass.** The advice ("run it before planning") is therefore not actionable in phase-number mode until a PLAN.md exists — ⭐ **use `--files` mode instead**, which is what produced C-4. ⚠ The 255 vacuous-pass risk is real but different: it needs a PLAN.md whose `files_modified` names nothing watched. **Verify `watched: N` is non-zero in the gate's own output** at the first PLAN.md, and never read a bare exit 0.

### C-7 — `256-PREFLIGHT.md` §4: two `input_tokens=None` sites

Already corrected by D-256-08 to seven. **Re-confirmed independently at `e78cf5e63`:** `grep -rn "input_tokens=None" backend/app` → 7 argument sites (`api/runs.py:677`, `:1331`, `harness_engine.py:3051`, `publish_service.py:1671`, `scheduler_service.py:296`, `eval_runner_service.py:946`, `run_reconciler.py:245`) + 1 default parameter (`run_lifecycle.py:369`). **D-256-08 is accurate; the PREFLIGHT is not.** Recorded so the count is confirmed by a second measurement rather than inherited.

### C-8 — CONTEXT.md's Base SHA is stale

- **Original:** *"Base SHA: `772f53354` on `develop`."*
- **MEASURED:** `git rev-parse --short HEAD` → **`e78cf5e63`** — five commits later (`c2ffdaad7` touches `PausedRunCue`, plus four bus/docs commits). Every triple and line number in this document is at `e78cf5e63`. ⛔ **A plan asserting HEAD must assert the SHA it actually starts from** (memory: *agent worktrees start on the DEFAULT branch*).

---

## G-5 Arithmetic (D-256-13)

**Re-derived at `e78cf5e63`** with CLAUDE.md's own recipe, six-digit dated quick-task buckets dropped:

| File | D-256-13 said | **Measured `e78cf5e63`** | Row? | G-5 |
|---|---|---|---|---|
| `backend/app/services/harness_engine.py` | 54 / 20 / 3135 | **54 / 20 / 3135** ✅ | ✅ | FIRES |
| `backend/app/services/harness/phase_types.py` | 53 / 26 / 2937 | **53 / 26 / 2937** ✅ | ✅ | FIRES |
| `backend/app/db/workflows.py` | 48 / 25 / 2585 | **48 / 25 / 2585** ✅ | ✅ | FIRES |
| `backend/app/api/runs.py` | 38 / 17 / 1695 | **38 / 17 / 1695** ✅ | ✅ | FIRES |
| `backend/app/services/harness/publish_service.py` | 25 / 11 / 1810 | ⚠ **26 / 11 / 1810** — commits **+1** | ✅ | FIRES |
| `backend/app/services/eval_runner_service.py` | 12 / 7 / 959 | **12 / 7 / 959** ✅ | ✅ | FIRES |
| **`backend/app/services/forced_emit.py`** | 8 / 5 / 578 | **8 / 5 / 578** ✅ | ⛔ **NO ROW** | FIRES |
| `backend/app/services/scheduler_service.py` | 5 / 2 / 399 | **5 / 2 / 399** ✅ | ✅ **HAS ONE** (C-4) | no (2) |
| `backend/app/services/run_reconciler.py` | 3 / 2 / 325 | **3 / 2 / 325** ✅ | ⛔ NO ROW | no (2) |
| `backend/app/services/circuit_breaker.py` | 1 / 1 / 331 | **1 / 1 / 331** ✅ | ⛔ NO ROW | no (1) |
| `backend/app/services/task_service.py` | *not named* | **19 / 10 / 958** | ⛔ **NO ROW** | ⛔ **FIRES** |
| `backend/app/services/run_producer.py` | *not named* | **5 / 3 / 749** (row says `3 / 2 / 693`, verdict `below`) | ✅ stale | ⛔ **NOW FIRES** |
| `backend/app/services/run_lifecycle.py` | *not named* | **8 / 4 / 748** (row says `6 / 3 / 459`) | ✅ stale | FIRES |

**⚠ Four rows found stale in one pass, and one of them reads a verdict that is now WRONG** —
`run_producer.py`'s cell says *"below"* while the file measures 3 phases, i.e. **at the threshold**.
A row that is present and wrong answers the auditor and stops the audit; that is this ledger's own
recurring finding.

### The gate, and whether it passes vacuously

Measured — see **C-6**. In phase-number mode with no PLAN.md it **exits 2 (`FATAL`)**, not 0. In
`--files` mode it exits **1** and names four files. ⛔ At the first PLAN.md, **read the `watched: N`
line**, not the exit code, because 255's vacuous pass was `watched: 0` with exit 0.

### The by-construction claim, as ARITHMETIC (the 249-02 precedent)

**Each plan's SUMMARY must record these, before and after:**

| File | Counts to record |
|---|---|
| `db/workflows.py` | module-level `async def` count (**+1**, the new writer); `finish_run` source md5 (**unchanged**); `finish_run(` call sites across the repo (**7 → 7**, in 4 files) |
| `harness_engine.py` | `_enforce_budget` branch count (**3 → 3**); its `await` count (**1 → 2**); call sites of `_enforce_budget` (**2 → 2**, `:1978` / `:2547`); `ctx.run_usage_box =` assignments (**1 → 1**); inline SQL statements (**0 → 0**) |
| `circuit_breaker.py` | method count (**9 → 9**); `absorb_usage_box` branch count (**1 → 1**); new state fields (**0**); return type `None → tuple[int,int]` |
| `forced_emit.py` | `_drain` `elif` arms (**+2**); `return` statements in `forced_emit` (**2 → 2**); new functions (**0**); new state (**2 module-local ints in one function**) |
| `harness/phase_types.py` | `_record_run_usage(` call sites (**2 → 3**); new functions (**0**); new branches (**0**) |
| `api/runs.py` · `publish_service.py` · `scheduler_service.py` | literal `input_tokens=None` occurrences (**5 → 0** across the five sites); new branches (**0**); new `logger.warning` call sites (**+1 each**, the documented missing-usage contract) |

⛔ **"Honoured by construction" without these numbers is an adjective.** D-256-13 says so and the
249-02 precedent (*state hooks 9→9, effect hooks 10→10*) is the bar.

---

## Register Entries Owed

All four use `.planning/seeds/TEMPLATE.md`'s contract. ⛔ Check each before committing:
`node scripts/check-seeds-register.cjs --files .planning/seeds/SEED-NNN-<slug>.md`.
⛔ `trigger_surfaces` is a **closed 15-word enum** — a word outside it matches nothing forever.
Relevant members here: `harness`, `workflow`, `provider`, `chat`, `admin`, `settings`.
**Allocate ids via `/gsd:capture --seed`'s `max(id)+1`** — the register parsed **303/303** at base, so
do not hand-pick a number.

### R-1 — ⛔ A NEW MEASURED DEFECT, and it is squarely inside this phase's goal sentence

> **The boot reconciler can OVERWRITE already-persisted real token totals with `NULL`.**

Chain, all source-measured:
- `run_producer.py:249-257` finalizes a **`cap_paused`** run with **real totals** via `finalize_run` (deliberately not `finalize_run_terminal`, so the row stays in `runs:active`).
- `db/runs.py:104-122` — `finalize_run` does an **unconditional** `SET input_tokens = $6`. A second call with `None` **nulls the column**.
- `run_reconciler.py:84` — `_NON_TERMINAL_CHAT_STATUSES = ["streaming", "cap_paused"]`; `:217` uses the full list when `include_cap_paused` is true.
- `run_reconciler.py:101` — `include_cap_paused: bool = True` (the **default**).
- `main.py:434-436` — the **BOOT** sweep calls `reconcile_orphaned_runs(pool=…, redis=…, supabase=…)` with **no `include_cap_paused`**, i.e. **True**. (The periodic sweep at `:490` correctly passes `False`.)
- `run_reconciler.py:236-247` then calls `finalize_run_terminal(..., input_tokens=None, output_tokens=None)`.

⇒ **A `cap_paused` chat run that carries real totals, whose stream has gone stale, loses them at the
next backend restart.** That is *"a run loses its token count"* — the exact sentence this phase is
named for — and no decision covers it.

Two legitimate dispositions, and the planner must pick one explicitly:
- **(a) FIX, ~2 lines:** make `finalize_run`'s token write conditional (`input_tokens = COALESCE($6, input_tokens)`). ⚠ That **changes a shipped writer with 7-plus callers** and would silently make a genuine `None`-after-a-value un-writable — a semantic change, not a patch. **I do not recommend it inside this phase.**
- **(b) REGISTER**, with a concrete trigger. ⭐ **Recommended** — it is the phase's own thesis (a named hole beats a silent one) and it keeps `finalize_run`'s semantics untouched, consistent with D-256-05's posture on `finish_run`.

```yaml
seed_id: SEED-NNN
title: "The boot reconciler NULLs a cap_paused run's already-persisted token totals — finalize_run's unconditional SET, measured at Phase 256"
created: 2026-09-18
surface: Agentic-RAG
status: planted
trigger_when: >
  Any phase that (a) edits db/runs.py finalize_run's UPDATE statement, (b) edits
  run_reconciler.py's candidate status set or its finalize call, (c) changes
  main.py's boot reconcile call arguments, or (d) makes a cap_paused run's token
  total load-bearing for money — which Phase 257's METER-07 per-run dollar view does.
trigger_paths:
  - "backend/app/db/runs.py"
  - "backend/app/services/run_reconciler.py"
  - "backend/app/main.py"
trigger_surfaces: [chat, harness, admin]
relates_to: ["backend/app/services/run_producer.py:249", "backend/app/db/runs.py:104", "backend/app/services/run_reconciler.py:236", "backend/app/main.py:434", "256"]
```

### R-2 — D-256-10: `max_tokens_per_run` is really per-SEGMENT

⭐ **A NEW plan-bearing refinement measured here:** the setting is not merely per-segment — it is
**per-SCHEDULE and nothing else.** `grep -rn "max_tokens_per_run" backend/app` → every writer is a
`workflow_schedules` path (`models/schedule.py:147`, default `500_000`, ceiling `MAX_TOKENS_CEILING`);
**no interactive run can configure it at all**, and nothing assigns `ctx.max_tokens_per_run`. So the
cap is (a) per segment and (b) unreachable outside the scheduler. Both halves belong in the entry.

```yaml
seed_id: SEED-NNN
title: "max_tokens_per_run is really max_tokens_per_SEGMENT, and it only exists on a SCHEDULE — a run resumed five times can spend 5x its ceiling, and no interactive run has one at all"
created: 2026-09-18
surface: Agentic-RAG
status: planted
trigger_when: >
  The first operator report of a resumed or continued run exceeding its configured
  ceiling; OR any phase that touches CircuitBreaker ceiling semantics, the
  ctx.run_usage_box reset at harness_engine.py:1844, load_run_budget, or that offers
  a token ceiling on an INTERACTIVE run. Fixing it means seeding the breaker from the
  persisted workflow_runs.input_tokens on resume, which Phase 256 makes possible for
  the first time by persisting that number.
trigger_paths:
  - "backend/app/services/circuit_breaker.py"
  - "backend/app/services/harness_engine.py"
  - "backend/app/models/schedule.py"
  - "backend/app/db/schedules.py"
trigger_surfaces: [harness, workflow, admin, settings]
relates_to: ["backend/app/services/harness_engine.py:1844", "backend/app/services/harness_engine.py:1818", "backend/app/db/workflows.py:2514", "SEED-074", "256"]
```

### R-3 — D-256-08 site #7: a stranded Deep chat run's count is unknowable

⭐ **Verified genuinely REGISTER, and a nuance worth recording:** `run_reconciler.py:217-247` only
touches **non-terminal** rows, so site #7 can never overwrite a completed run's real total. Its
`input_tokens=None` is **honest** — the producer process is gone and the in-memory box died with it.

```yaml
seed_id: SEED-NNN
title: "A stranded Deep chat run's token count is unrecoverable — run_reconciler.py:245 writes NULL because the in-memory usage box died with the producer process"
created: 2026-09-18
surface: Agentic-RAG
status: planted
trigger_when: >
  Any phase that adds MID-STREAM token persistence to the chat path (a per-turn or
  per-iteration write of the usage box to runs.input_tokens rather than only at
  finalize) — which is the only thing that would make this number knowable. Also
  fires if METER-07 reports an unacceptable share of orphaned runs as uncounted.
trigger_paths:
  - "backend/app/services/run_reconciler.py"
  - "backend/app/services/task_service.py"
  - "backend/app/services/run_producer.py"
trigger_surfaces: [chat, harness]
relates_to: ["backend/app/services/run_reconciler.py:245", "backend/app/services/task_service.py:451", "256"]
```

### R-4 — the failed-rung breakdown, the eval WITHOUT arm, and the eval JUDGE shot

⭐ **Three holes, one entry, and the third is NEW** (found by this research — §Q1). The judge shot
(`eval_runner_service.py:648 _judge_eval_answer`) is a paid provider call whose usage is measured
**nowhere**, so an eval run's total is incomplete even after Q1's fix. **Its coverage marker must
say so**, which is what makes this a register entry rather than a silent gap.

```yaml
seed_id: SEED-NNN
title: "Three token holes that survive Phase 256: forced_emit's failed-rung spend is not broken out, and an eval run's judge shot is not counted at all"
created: 2026-09-18
surface: Agentic-RAG
status: planted
trigger_when: >
  Phase 257's METER-07 "what it cannot see" view is built and an operator asks WHY a
  retry-heavy workflow costs what it costs; OR any phase that adds a per-rung or
  per-call cost breakdown; OR any phase that makes an eval run's cost operator-visible
  (the judge shot is billed and counted nowhere, so an eval total is low by one call
  per graded arm).
trigger_paths:
  - "backend/app/services/forced_emit.py"
  - "backend/app/services/eval_runner_service.py"
  - "backend/app/services/harness/phase_types.py"
trigger_surfaces: [harness, workflow, provider, skills]
relates_to: ["backend/app/services/forced_emit.py:318", "backend/app/services/eval_runner_service.py:648", "backend/app/services/eval_runner_service.py:901", "256"]
```

### R-5 — SEED-074's status flip (⛔ a seed is answered by EDITING the seed)

`.planning/seeds/SEED-074-workflow-harness-token-usage-rollup.md` reads **`status: planted`** —
verified in its frontmatter. At this phase's close it must be edited, and **its body is measurably
stale in three specific places**, which the edit should record rather than overwrite:

| SEED-074 says | Measured `e78cf5e63` |
|---|---|
| *"`harness_engine.py:1413-1421` … the only `finalize_run` call in the engine"* | The line numbers have moved; the producer-shell finalize in the engine is now at **`harness_engine.py:3044-3053`**. |
| *"`sub_agent_service.py` (no rollup of per-sub-agent usage into the producer/workflow run)"* | ⛔ **FALSE since Phase 093/204.** `phase_types.py:768 _record_run_usage` sums each completed sub-agent into the run-level box, and `:829` threads the box into the sub-agent spawn. `256-PREFLIGHT.md` §3 already flagged this; confirming it independently. |
| *"Decide the storage shape … (b) add a per-phase usage table"* | Resolved by **D-256-06 as option (a)**, columns on `workflow_runs`. The per-phase table is **not** built; ⚠ say so explicitly so a future reader does not take the seed's preference for a decision. |

**Recommended status:** `partially-answered` with `partial: true` — METER-03/04/05/06 close the
persistence + rollup arms, but the seed's **step 4 cross-provider parity check** (real cross-provider
workflow runs, full native roster) is **NOT discharged by this phase** — nothing here drives a live
provider. `folded_into: "256"`. ⛔ **Not `answered`**, and not `shipped`.

⛔ **`SEED-073` is untouched** — it is METER-01/02 = Phase 257. Nothing here builds a rate table.

⚠ **Re-run `node scripts/check-seeds-register.cjs --phase 256` AFTER the first PLAN.md exists.** At
base it reported **0 matched over 303/303 parsed** and the gate says itself that this is an artefact:
the phase declares no surfaces yet. Unswept figures, ⛔ **never summed**: **134** carry no
`trigger_when` at all · **114** carry prose a sweep cannot match.

---

## Security Domain

`security_enforcement: true`. This phase writes integers and a string array to a table the caller
already owns; it adds no route, no input parsing and no new external call.

### Applicable ASVS categories

| Category | Applies | Standard control, as it already exists here |
|---|---|---|
| **V2 Authentication** | no | No new endpoint. Every touched path is already behind `get_current_user` / a service-role writer. |
| **V3 Session Management** | no | Untouched. |
| **V4 Access Control** | **yes** | `workflow_runs` has four RLS policies, all `org_id IN (SELECT current_user_org_ids())` **AND** thread-owner (`full-schema.sql:7104-7137`). A new column inherits them. ⚠ `persist_run_usage` runs on the **service-role pool** (`get_pg_pool`), which **BYPASSRLS** — so `WHERE id = $1` is the whole access boundary. The `run_id` comes from the engine's own loop, never from a request body. **State this in the plan**; it is the posture `finish_run` already has. |
| **V5 Input Validation** | **yes** | The deltas are `int(x or 0)` from an in-process dict, never user input. ⛔ **Parameterised SQL only** (`$1/$2/$3`) — no f-string on SQL (T-091-03, and `claim_run`'s docstring names the rule). Pydantic is not needed: nothing crosses a wire. |
| **V6 Cryptography** | no | No secret, no token (in the credential sense), no hashing. ⚠ Word collision only: "token" here is a billing unit. |
| **V7 Error Handling / Logging** | **yes** | ⛔ **The missing-usage `logger.warning` MUST NOT contain token VALUES** — `test_token_accumulator_missing_usage.py`'s module docstring pins this as **T-073-04**: the format string is asserted **not** to contain `"tokens="`, `"value="` or `"usage_dict"`. The five new warning call sites inherit that constraint. |

### Known threat patterns for this stack

| Pattern | STRIDE | Mitigation already in place / owed |
|---|---|---|
| SQL injection via a run id | Tampering | Parameterised `$1` (mandatory; no f-string SQL). |
| Cross-tenant token disclosure | Information disclosure | Existing 4 RLS policies, `org_id`-gated. ⚠ The new index is on `(org_id, …)`, which **helps** rather than widens. |
| A service-role writer reaching another org's row | Elevation | `WHERE id = $1` where `$1` is engine-internal. ⛔ **Do not add an org-less `UPDATE … WHERE thread_id` variant.** |
| Spend-figure repudiation (a run under-reporting what it cost) | Repudiation | The *whole phase*. ⛔ Its security-relevant failure mode is a **silent** `0` where the truth is *unknown* — which is why `None ≠ 0` is a security property here, not a style preference. |
| An unauthenticated read of the new column | Info disclosure | ⚠ **BUG-260911-01's lesson: every gate in this project reads through the SERVICE ROLE, so nothing in the suite ever requests as `anon`.** ⛔ `get_advisors(security)` belongs in the 182 deploy-parity checklist (already listed in §Migration 182). |

---

## Open / Could Not Measure

| # | Hole | What would close it |
|---|---|---|
| **U-1** | **Whether moonshot / minimax / zhipu / a given OpenRouter upstream actually honours `stream_options.include_usage`.** `openai_service.py:1916` sets it for every provider; `openai_compat.py:485` emits nothing when no payload arrived. Source cannot tell which providers comply. | A live one-shot per provider with a key configured, reading whether a `usage` event arrived. ⭐ **Not a blocker:** the `None` path is correct either way, and the coverage marker is exactly the mechanism for recording an honest gap. **Do not manufacture a scoreboard with unverified attribution** (memory: *243 CLOSED — cross-provider board ABANDONED*). |
| **U-2** | **Whether Postgres accepts `@>` with an array literal in a partial-index predicate on this server version.** Immutable by catalogue, but unverified against the live DB. | Paste the 182 DDL into the local Supabase SQL editor and read the result — which the migration route requires anyway. If it is refused, fall back to `WHERE token_coverage IS NULL OR array_length(token_coverage, 1) < 4` (⚠ which hard-codes the arity instead of the members — a worse trade, so try `@>` first). |
| **U-3** | **The exact live rate of the boot-reconciler NULL-overwrite (R-1).** Source-proven reachable; frequency unmeasured. | `SELECT count(*) FROM runs WHERE status='failed' AND error LIKE 'failed: orphaned%' AND input_tokens IS NULL;` — ⭐ **runnable NOW via the Supabase MCP read path, which needs no approval.** Worth one query before the plan decides fix-vs-register. |
| **U-4** | **Whether `absorb_usage_box`'s widened return breaks any caller.** Its only production caller is `harness_engine.py:1875`; test callers are in `test_scheduler_circuit_breaker.py` / `test_scheduler_breaker_seam.py` / `test_085_task_service.py`. Widening a return from `None` is backward-compatible in Python, but a test asserting `is None` on the return would break. | `grep -n "absorb_usage_box" backend/tests -r` and read each assertion. One minute at plan time. ⚠ Any such assertion is a **legitimate** change, not a baseline regression — but it must be named, because a changed test is how a gate quietly stops guarding. |
| **U-5** | **What the coverage marker should say for a run with NO LLM phase at all** (e.g. an all-`programmatic` workflow). `{}` claims "covers nothing"; `NULL` claims "unknown"; `{agent,single,batch,emit}` would be vacuously true. | A decision, not a measurement. ⭐ My recommendation: the marker records the legs the **instrumentation** covers, not the legs the run **used** — so an all-programmatic run gets the full current set and a real `0`/`0` total, which is honest and keeps Phase 257's aggregate free of false negatives. **The plan must state which reading it chose** or Phase 257 will guess. |
| **U-6** | **Gemini's reviewer baselines.** CONTEXT.md line 7: *"⛔ No source work until gemini confirms its baselines are captured (AGENTS.md 6.1); docs-only work is safe meanwhile."* `.agent-bus` shows BUS-258/259/265/267/268 answered on this subject, but whether the gate is formally released is a coordination fact, not a code fact. | Read `.agent-bus/OPEN.md` before the first source edit. **Planning and research are docs-only and therefore safe.** |

---

## Sources

### Primary (HIGH — read directly in this working tree at `e78cf5e63`)
- `backend/app/services/harness_engine.py:1805-1890`, `:1978`, `:2547`, `:2900-2975`, `:3010-3060`
- `backend/app/services/circuit_breaker.py:86-194`
- `backend/app/db/workflows.py:2169-2345`, `:2450-2590`
- `backend/app/db/runs.py:82-122`
- `backend/app/services/harness/phase_types.py:740-800`, `:829`, `:917`, `:1028`, `:1407-1600`
- `backend/app/services/forced_emit.py:40-52`, `:179-204`, `:460-520`, `:516-578`
- `backend/app/services/task_service.py:400-470`
- `backend/app/services/provider_gateway/{events.py:106-117, dispatcher.py:87-127, openai_compat.py:120-160/465-494}`
- `backend/app/services/{anthropic_service.py:229-347, google_service.py:469-499, openai_service.py:1896-1916}`
- `backend/app/services/{eval_runner_service.py:434-702/855-948, run_producer.py:230-258, run_lifecycle.py:360-398, run_reconciler.py:84-252, scheduler_service.py:140-303}`
- `backend/app/services/harness/publish_service.py:1600-1678`
- `backend/app/api/{runs.py:575-700/1280-1345/1540-1580, workflows.py:1755-1785, threads.py:375-478, panel.py:235-285}`
- `backend/app/main.py:428-500`; `backend/app/config.py:344-460`, `:1415-1435`; `backend/app/models/thread.py:410-440`
- `supabase/full-schema.sql` (`public.runs`, `public.workflow_runs`, indexes, 4 RLS policies, the GRANT block)
- `supabase/migrations/` (148 files, `181` highest, no letter suffixes); `scripts/full-schema-supplement.sql:1-50`
- `scripts/check-hot-file-ledger.cjs:1-90`; `docs/HOT-FILE-LEDGER.md` (scan list, 287 rows)
- `backend/tests/unit/{test_189_no_egress.py, test_255_extension_contract_guard.py, test_token_accumulator_missing_usage.py}`
- `.planning/config.json`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` §256/§257, `.planning/seeds/{SEED-074…, TEMPLATE.md}`, `CLAUDE.md`

### Tool invocations whose output is quoted verbatim
- `git rev-parse --short HEAD` → `e78cf5e63`
- the CLAUDE.md G-5 triple recipe, 13 files
- `node scripts/check-hot-file-ledger.cjs 256` → `FATAL … EXIT=2`
- `node scripts/check-hot-file-ledger.cjs --files <13 files>` → `EXIT=1`, four `[no-row]`
- the seven Q3 sweep greps (listed in full in §Q3 so "none found" is auditable)
- `python` over `config.py` → the provider `Counter` and the `emit_tier` set

### Secondary / Tertiary
**None.** No WebSearch, no WebFetch, no Context7 — this was a measurement job and nothing here
needed an external source. ⚠ The one place a doc citation would have been appropriate (U-2, Postgres
partial-index predicate immutability) is left explicitly `[ASSUMED]` with a one-command verification,
because paste-and-verify against the live DB is cheaper and stronger than a doc quote.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Postgres accepts `@>` with an array literal in a partial-index predicate on this server version | Migration 182 / U-2 | The index DDL is refused at paste time. **Detected immediately** (the SQL editor errors); fallback named. |
| A2 | `stream_options.include_usage` is honoured by moonshot / minimax / zhipu / the OpenRouter upstreams | Q4 / U-1 | Those providers' emit spend reads `NULL` rather than a number. **Not a defect** — it is the honest state and the coverage marker records it. |
| A3 | No test asserts `absorb_usage_box(...) is None` | U-4 | One existing unit test goes red and must be updated in the same plan. One grep closes it. |
| A4 | `WORKER_COUNT=2` remains the shipped default | Q2-A | If it becomes 1, the concurrency analysis is strictly conservative — the conclusion (ADD is correct, delta-from-watermark is idempotent) does not change. |
| A5 | Nothing outside `backend/` and `frontend/src/` aggregates these columns (no external BI tool, no Metabase, no operator SQL saved elsewhere) | Q3 | An out-of-repo consumer could double-count. **Unknowable from this repo** — but Phase 257 is the first in-repo consumer, which bounds the exposure. |

## Metadata

**Confidence breakdown:**
- **Q1** HIGH — the box's single writer was established exhaustively; the eval path's locals were read line by line.
- **Q2-A** HIGH on the mechanism (every guard read; `claim_run`'s lease semantics are in its own docstring; the `finish_run` interleave is *measured* by a prior phase). MEDIUM on the live *frequency* of a double-drive — nothing in source gives a rate.
- **Q2-B** HIGH and this is the load-bearing one — three independent confirmations (the guard's position, `load_run_budget`'s own docstring, the exhaustive `max_tokens_per_run` grep).
- **Q3** HIGH — seven distinct search strategies over backend, frontend and SQL; the four cited "positive controls" were opened and found to select no token column.
- **Q4** HIGH on the code path (all three adapters' emit sites read; the "only emit when seen" comment is verbatim). MEDIUM on per-provider wire compliance — U-1.
- **Migration 182** HIGH — column list, `org_id`, migration numbering, index inventory and the *absence* of any `workflow_runs` GRANT all directly verified.
- **G-5 arithmetic** HIGH — re-derived with CLAUDE.md's own recipe and cross-checked by running the gate rather than reading the table.
- **Coverage-marker recommendation** MEDIUM — the reasoning is sound and the tradeoff is stated, but it is a design judgement with one unverified DDL assumption (A1).

**Research date:** 2026-09-18
**Valid until:** ⛔ **The line numbers in this document are valid at `e78cf5e63` and nowhere else.**
This project's own repeated finding is that a figure written at a phase's close goes stale on the next
commit. Re-derive before quoting — every command needed is in §Sources.
