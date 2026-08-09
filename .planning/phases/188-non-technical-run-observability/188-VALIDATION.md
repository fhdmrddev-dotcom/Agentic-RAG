---
phase: 188
slug: non-technical-run-observability
status: draft
nyquist_compliant: true
wave_0_complete: true
phase_gates_measured: 2026-08-05
created: 2026-08-05
---

# Phase 188 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `188-RESEARCH.md` §"Validation Architecture" — every number below was **measured at `db086240`**, not inherited.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Frontend: `vitest` + `@testing-library/react` (+ `vitest-axe` where a11y applies) · Backend: `pytest` (`backend/venv`), `TestClient` + `monkeypatch` |
| **Config file** | `frontend/vitest.config.*` — but **the gate** is `scripts/vitest-count-gate.cjs` (two knobs: `TARGETS` = what RUNS, `BASELINE` = what's PINNED) |
| **Quick run command** | `node scripts/vitest-count-gate.cjs` |
| **Full suite command** | `cd frontend && npx vitest run` (⚠ carries pre-existing rot **outside** the gate's blast radius) + `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q -p no:randomly` |
| **Typecheck** | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — must stay at **33** errors, NOT 0. The root config checks **zero** files. |
| **Estimated runtime** | count gate ~120 s · typecheck ~30 s · backend canvas/gate suites ~20 s · full backend suite ~6 min |

**Measured baselines that every gate is diffed against (do not re-derive, do not assume):**

| Baseline | Measured value at `db086240` |
|---|---|
| Frontend count gate | **2196 tests / 0 failing / 946 pinned** — green |
| `tsc -p tsconfig.app.json` | **33** pre-existing errors, **0** in `components/workflows` |
| Backend full suite | **211 failed / 3296 passed** (`pytest tests/ -q -p no:randomly`, deterministic across two runs) |

> ⚠ **Scope correction (orchestrator, 2026-08-05).** `188-RESEARCH.md` states that session memory's
> *"~62-red backend suite"* is **REFUTED** by the 211 figure. That framing is a **scope confusion, not
> a refutation**: the 62-red measurement was `pytest tests/unit -q` (62 failed / 1700 passed, Phase 187
> round 5); the 211 figure is `pytest tests/ -q -p no:randomly` over the **whole** `tests/` tree. A
> subset being 62-red and its superset being 211-red are consistent. **Use 211 as the full-suite
> non-attribution baseline** (that part is correct and is what `188-01` records) — but do not conclude
> the `tests/unit` async-mock rot was imagined, and do not cite "REFUTED" in any summary.
| Backend canvas/gate suites | `test_revert_byte_identical.py` + `test_182_canvas_gate.py` = **12 passed** |
| ⚠ `test_thread_workflow_endpoint.py` | **1 of 7 RED at HEAD** — this is the suite fencing the endpoint the run surface reads. Record it; do not attribute it to this phase. |
| Unpinned but running | `PhaseNode.test.tsx` (13) · `PhaseNodeCard.test.tsx` (68) — they RUN but are **not pinned**; this phase should pin them. |
| Outside `TARGETS` entirely | `src/lib/**`, `src/components/panel/**`, `src/pages/**` — a new file there is **silently never run** unless `TARGETS` is extended. |

---

## Measured baselines — recorded at plan 188-01, before any production edit

> Measured on **2026-08-05** at the working tree as it stood after 188-01 tasks 1–2 (which touch
> `scripts/vitest-count-gate.cjs` only) and **before any file under `frontend/src` or `backend/app`
> was modified by this phase**. Every figure below is the command's own printed output — none is
> inherited from `188-RESEARCH.md`, and none is hand-counted. Where a figure differs from the
> `db086240` value already recorded above, BOTH are kept and the current one is named.
>
> These are what the phase-close **non-attribution diff** is taken against. Non-attribution is
> proved by diffing the recorded failure SET, never by a rollback run (T-188-01-02).

### 1. Frontend count gate — POST-task-1/2

```
node scripts/vitest-count-gate.cjs
```

| Figure | Measured now | At `db086240` | Which is current |
|---|---|---|---|
| `total` | **2206** | 2196 | **2206** — task 1 brought `PhaseReconcile.test.tsx` (2) and `PhaseTimeline.test.tsx` (8) into `TARGETS`, so they now EXECUTE. +10 is exactly 2 + 8; no other suite's count moved. |
| `failed` | **0** | 0 | unchanged |
| `pinned total` | **1037** | 946 | **1037** — task 2 pinned four suites: `PhaseNodeCard.test.tsx` 68, `PhaseNode.test.tsx` 13, `PhaseTimeline.test.tsx` 8, `PhaseReconcile.test.tsx` 2. 946 + 91 = 1037. `BASELINE_TOTAL` remains the computed reduce. |
| pinned files present | **26/26** | 22/22 | **26/26** — grew by exactly the 4 entries added. |

All four pin values were read from the script's own printed `actual` column across **two agreeing
runs**, never hand-counted (unsound under `it.each`). The `PhaseNodeCard.test.tsx` pin was then
**observed biting**: one whole `it(` block deleted → exit 1, `[count-decrease] PhaseNodeCard.test.tsx
— pinned 68, ran 67 (-1)` at `failed 0`, then restored. Raw output in `188-01-SUMMARY.md`.

### 2. Frontend typecheck

```
cd frontend && npx tsc --noEmit -p tsconfig.app.json
```

**33 errors.** Matches the `db086240` figure. ⚠ The passing gate for every later task is
**"still 33"**, NOT 0 — the 33 are pre-existing (the tail one is a `StreamsState` /
`viewedThreadId: string | null` vs `null` widening in the streams store). And the `-p tsconfig.app.json`
flag is load-bearing: the root `tsconfig.json` is `{"files": [], "references": [...]}` and therefore
checks **zero** files, so a bare `npx tsc --noEmit` reports 0 errors while checking nothing.

### 3. Backend full suite — THE non-attribution baseline

```
cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q -p no:randomly
```

**211 failed · 3296 passed · 19 skipped · 5 xfailed · 9 xpassed · 1 error** in **308.39 s (5 m 08 s)**.
Identical to the `db086240` measurement. This is the baseline the phase-close non-attribution diff
is taken against.

Full `tests/` baseline = **211 failed / 3296 passed**; the separate `tests/unit` async-mock rot
figure (62 failed / 1700 passed, measured at Phase 187 round 5 with `pytest tests/unit -q`) is a
**different, narrower measurement and is not contradicted by this one** — a subset at 62-red and its
superset at 211-red are consistent. Do not treat the narrower figure as overturned, and do not
describe it as such in any summary.

> ⚠ Use `./venv/Scripts/python.exe -m pytest`. `source venv/Scripts/activate` does not take in the
> Bash tool and falls through to a system python missing `pydantic_settings`.

### 4. Backend canvas / byte-identity gate suites

```
cd backend && ./venv/Scripts/python.exe -m pytest tests/test_revert_byte_identical.py tests/test_182_canvas_gate.py -q
```

**12 passed** in 1.83 s. Matches the expected 12. This is the honest gate for the SPEC's
byte-identity criterion, and it is **green today** — so any red here later belongs to this phase.

### 5. ⚠ Pre-existing RED in the endpoint the run surface reads

```
cd backend && ./venv/Scripts/python.exe -m pytest tests/test_thread_workflow_endpoint.py -q
```

**1 failed · 6 passed** in 1.12 s — the 1-of-7 RED, recorded here **by name and failing assertion**
because this suite fences `GET /threads/{id}/workflow`, which the run surface reads:

| Field | Value |
|---|---|
| Failing test | `tests/test_thread_workflow_endpoint.py::test_thread_workflow_state_shape` |
| Failing assertion | `assert body["locked"] is True` → `E assert False is True` (`test_thread_workflow_endpoint.py:99`) |
| Note | The endpoint answers **HTTP 200** and the full key shape is present (the loop over `thread_id … continues_remaining` passes, as does `body["mode"] == "harness"`). Only the `locked` value disagrees. |

**This RED pre-dates every line this phase writes.** It must not be attributed to Phase 188, and
Phase 188 must not be credited with fixing it unless a plan deliberately does so.

### 6. Other pre-existing reds in the adjacent canvas suites

```
cd backend && ./venv/Scripts/python.exe -m pytest tests/test_181_flip_on.py tests/test_182_grounding_bundle.py -q
```

**3 failed · 10 passed** in 1.64 s — matching `188-RESEARCH.md`'s 1 and 2 respectively:

| Suite | Failing tests |
|---|---|
| `test_181_flip_on.py` | `test_canvas_ping_200_after_flip_on` (1) |
| `test_182_grounding_bundle.py` | `test_grounding_bundle_returns_server_sourced_palette`, `test_grounding_bundle_fields_come_from_the_bundle` (2) |

---

## Phase gates — measured at plan 188-12

> Measured on **2026-08-05**, at the tree after every one of plans 188-01 … 188-11 had landed and after
> 188-12 task 1 re-pinned the count gate. Nine gates, each shown with the **literal command** and its own
> printed result. Nothing below is inherited, assumed, or carried over from a plan summary.
>
> **Phase base commit = `93bbfc87`** (`docs(sketch-152-154)…`), the parent of `42d517b9`, which is the first
> Phase-188 commit. Every `<phase-base>..HEAD` range below uses it. It was cross-checked against the
> `db086240` baseline commit recorded above: both bases give **identical** numstat and migration results, so
> the choice of base is not doing any work in these figures.

### 1. Frontend count gate — the deletion guard

```
node scripts/vitest-count-gate.cjs
```

**exit 0** · `total 2421 · failed 0 · pinned total 2421` · **45/45 pinned files present**, every per-file
delta `0`.

| Figure | Now | At 188-01 | Note |
|---|---|---|---|
| `total` | **2421** | 2206 | +215 — the phase's own suites plus the growth in the four it inherited |
| `failed` | **0** | 0 | the gate's standing requirement |
| `pinned total` | **2421** | 1037 | 188-12 pinned **every file the gate executes** at its measured `actual` |
| pinned files | **45/45** | 26/26 | +19 (4 authored by this phase, 15 inherited and running with no pin at all) |

`pinned total == total` — **the gate now carries ZERO slack.** Before this plan it carried 1384 tests of it,
and `PhaseReconcile.test.tsx` was pinned at **2** while running **12**: every falsification test Phase 188
wrote sat inside that ten-case gap, deletable with the gate green. That is the Phase-187 "verification truth
14" failure, and five separate 188 plans (02/04/05/06/07/08) flagged it as owed before this one closed it.

**The pin was observed BITING**, not asserted. One whole `it(` block deleted from
`frontend/src/lib/phaseState.test.ts`:

```
  total                                      2421    2420      -1
  total 2420  ·  failed 0  ·  pinned total 2421
--------------------------------------------------------------
RESULT: COUNT GATE VIOLATED (2 reason(s))
  FAIL  [total-below-baseline] total 2420 < pinned 2421.
  FAIL  [count-decrease] phaseState.test.ts — pinned 34, ran 33 (-1). A test was deleted or skipped away.
```

Gate exit **1** at `failed 0` — the count decrease was the only signal, which is the whole point. Restored
with `git checkout -- frontend/src/lib/phaseState.test.ts`; `git status --porcelain` on that path is empty and
the gate is green again at 2421 / 2421 / failed 0. Note the zero-slack pin now fires **two** reasons rather
than one: `[total-below-baseline]` has become a live signal instead of a formality.

### 2. Frontend typecheck

```
cd frontend && npx tsc --noEmit -p tsconfig.app.json
```

**33 errors** — **exactly** the Plan-01 baseline. Unmoved. The tail error is still the
`StreamsState` / `viewedThreadId: string | null` vs `null` widening in the streams store, verbatim as
recorded at 188-01.

⚠ The passing gate is **"still 33"**, not 0. `-p tsconfig.app.json` is load-bearing: the root `tsconfig.json`
is `{"files": [], "references": [...]}` and checks **zero** files, so a bare `npx tsc --noEmit` reports 0
errors while checking nothing.

### 3. Frontend build

```
cd frontend && npx vite build
```

**exit 0** — `✓ built in 6.88s`.

Recorded separately from (2) on purpose: **`vite` skips `tsc`**, so "the build passed" is never a typecheck
claim in this project (MEMORY: `project_deployment_vercel_frontend`).

⚠ **One phase-attributable warning, recorded rather than fixed:**

```
[INEFFECTIVE_DYNAMIC_IMPORT] Warning: src/components/workflows/WorkflowCanvas.tsx is dynamically
imported by src/pages/WorkflowBuilderPage.tsx but also statically imported by
src/pages/WorkflowRunPage.tsx, dynamic import will not move module into another chunk.
```

`WorkflowRunPage.tsx` (188-08) imports `WorkflowCanvas` **statically**, which defeats the lazy split
`WorkflowBuilderPage` had. Not a correctness defect and not a gate failure — a bundle-shape regression: the
canvas now ships in the main chunk for every user, including those who never open a workflow. Out of scope
here (the fix is a `lazy()` at the run page, which is a render-path change 188-12 has no mandate to make).
**Re-open trigger:** the next plan that touches `WorkflowRunPage.tsx`'s imports, or any bundle-size work.

### 4. Backend — the suites this phase owns

```
cd backend && ./venv/Scripts/python.exe -m pytest tests/test_188_workflow_run_read.py tests/test_182_canvas_gate.py tests/test_revert_byte_identical.py -q
```

**20 passed**, exit **0**, in 2.32 s. Per file: `test_188_workflow_run_read.py` **6** ·
`test_182_canvas_gate.py` **8** · `test_revert_byte_identical.py` **6**.

Plan 01 measured the two pre-existing files at **12 passed** before any edit. 12 → 20 is **+8**, and that
figure is load-bearing for gate (5) below.

### 5. Backend full suite — non-attribution by DIFFING the failure set

```
cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q -p no:randomly
```

**211 failed · 3304 passed · 19 skipped · 5 xfailed · 9 xpassed · 1 error** in **337.11 s (5 m 37 s)**.

| Outcome | Plan-01 baseline | Now | Δ |
|---|---|---|---|
| failed | 211 | **211** | **0** |
| passed | 3296 | **3304** | **+8** |
| skipped | 19 | 19 | 0 |
| xfailed | 5 | 5 | 0 |
| xpassed | 9 | 9 | 0 |
| error | 1 | 1 | 0 |

**Non-attribution is proved by diffing the failure set. No rollback run was performed, and a rollback run
would not have been accepted as evidence (T-188-01-02 / T-188-12-02).** Five independent checks:

1. **The failure count is unmoved at 211**, and the extracted `FAILED tests/…` node ids number exactly
   **211 unique** lines, with **1** `ERROR tests/…` — matching the baseline's 1 error
   (`tests/integration/test_077_cross_cancel.py::test_cross_worker_cancel_via_zombie_heal`).
2. **Zero failures or errors in any file this phase created or modified.** Grepping the failure set for
   `test_188_workflow_run_read` / `test_182_canvas_gate` / `test_revert_byte_identical` returns **nothing**.
3. **The `+8` is fully accounted for and leaves no residue.** Gate (4) measures those same three files at
   12 → 20 = +8. The whole-suite passed delta is +8. Every added test passes; nothing else changed verdict
   in aggregate.
4. **The four named pre-existing reds are present by exact node id**, unchanged from the Plan-01 record:
   ```
   FAILED tests/test_thread_workflow_endpoint.py::test_thread_workflow_state_shape
   FAILED tests/test_181_flip_on.py::test_canvas_ping_200_after_flip_on
   FAILED tests/test_182_grounding_bundle.py::test_grounding_bundle_fields_come_from_the_bundle
   FAILED tests/test_182_grounding_bundle.py::test_grounding_bundle_returns_server_sourced_palette
   ```
   `test_thread_workflow_endpoint.py` is still exactly **1 of 7** — the suite fencing
   `GET /threads/{id}/workflow`, which the run surface reads.
5. **The backend diff is strictly ADDITIVE, so no pre-existing path can have changed behaviour.** The whole
   phase touched six backend files:
   ```
   backend/app/api/workflow_runs.py          247   0   (net-new module)
   backend/app/main.py                         2   1   (one import name + one include_router)
   backend/app/middleware/canvas_gate.py      20   2   (one frozenset member + comments)
   backend/tests/test_182_canvas_gate.py      71   6
   backend/tests/test_188_workflow_run_read.py 468  0   (net-new)
   backend/tests/test_revert_byte_identical.py  96  0
   ```
   The only production edits are a new module, a new router mounted at a **new prefix**, and one new
   **template** member of `CANVAS_GATED_PATHS` for a path that did not previously exist. `canvas_gate.py`
   appears in failing tracebacks only at line 194 (`__call__`), an unchanged ASGI pass-through frame present
   for every request in every suite — a stack frame, not a cause.

**The 211-failure set, fingerprinted by file** — recorded here because Plan 01 recorded only the *totals*,
which is why this diff had to lean on (5) rather than on a name-level set comparison. **This is the
name-level record the next phase diffs against.** 70 files, summing to 211:

```
tests/integration/test_059_disconnect.py                    2
tests/integration/test_061_producer_survives_disconnect.py  1
tests/integration/test_061_runs_table.py                    1
tests/integration/test_061_ttl.py                           2
tests/integration/test_062_delete_happy.py                  1
tests/integration/test_062_delete_zombie.py                 1
tests/integration/test_062_multi_consumer_fanout.py         1
tests/integration/test_062_redis_down.py                    1
tests/integration/test_062_stream_replay.py                 1
tests/integration/test_063_1_messages_runs_join.py          1
tests/integration/test_063_post_contract.py                 2
tests/integration/test_063_post_then_subscribe.py           1
tests/integration/test_066_langsmith_clean.py               2
tests/integration/test_066_per_call_timer.py                4
tests/integration/test_066_sse_terminal.py                  2
tests/integration/test_066_terminal_classification.py       3
tests/integration/test_067_4_suggestion_emit.py             2
tests/integration/test_075_4_terminal_race.py               1
tests/integration/test_075_code_stdout_progressive.py       4
tests/integration/test_075_snapshot.py                      1
tests/integration/test_075_tool_args_progress.py            1
tests/integration/test_077_multi_worker.py                  2
tests/integration/test_089_agent_loop_result_seam.py        1
tests/integration/test_110_dm_schema.py                     5
tests/integration/test_111_1_match_filters_stale.py         1
tests/integration/test_111_field_def_scoping.py             1
tests/integration/test_132_test_cases.py                    5
tests/integration/test_139_description_proposals.py         5
tests/integration/test_163_rls_dm.py                        1
tests/integration/test_163_rls_workflow_eval.py             1
tests/integration/test_extraction_dispatcher.py             3
tests/integration/test_skill_tuner_routes.py               16
tests/integration/test_skills_lint.py                       3
tests/integration/test_threads.py                           4
tests/integration/test_threads_skills.py                   11
tests/test_096_askuser_cleanup.py                           2
tests/test_096_ci_workflow_regression.py                    3
tests/test_098_scope_governance.py                          1
tests/test_150_cipher.py                                    1
tests/test_181_flip_on.py                                   1
tests/test_182_grounding_bundle.py                          2
tests/test_agent_loop_catalog_override.py                   3
tests/test_dual_mode_wiring.py                             15
tests/test_eval_runner.py                                   3
tests/test_evals_router.py                                  2
tests/test_harness_gates.py                                 1
tests/test_harness_templates.py                             5
tests/test_knowledge_health.py                              1
tests/test_mdl_verification.py                              5
tests/test_provider_router.py                               4
tests/test_run_reconciler.py                                1
tests/test_skill_proposals_router.py                        4
tests/test_thread_workflow_endpoint.py                      1
tests/unit/test_061_consumer.py                             1
tests/unit/test_071_1_threadpool_sweep.py                   1
tests/unit/test_075_4_unknown_provider_error.py             1
tests/unit/test_111_1_reembed_kickoff.py                    4
tests/unit/test_db_runs.py                                  3
tests/unit/test_explorer_agent.py                           6
tests/unit/test_extraction_service.py                       2
tests/unit/test_forced_emit.py                              1
tests/unit/test_get_model_capability_inference.py           1
tests/unit/test_lifespan.py                                 3
tests/unit/test_module7_tools.py                            2
tests/unit/test_multimodal_query.py                         5
tests/unit/test_phase56_iteration_start.py                  1
tests/unit/test_retrieval_service.py                       15
tests/unit/test_sandbox_service.py                          3
tests/unit/test_sql_service.py                             12
tests/unit/test_streaming_reliability.py                    1
```

> ✅ **The "~62-red" question is now settled by measurement, and the answer is SCOPE, not refutation.**
> The seventeen `tests/unit/…` rows above sum to **exactly 62** (1+1+1+4+3+6+2+1+1+3+2+5+1+15+3+12+1). The
> Phase-187-round-5 figure of "62 failed" was `pytest tests/unit -q`; the 211 figure is the whole `tests/`
> tree. A subset at 62-red and its superset at 211-red are not merely *consistent* — they are the **same
> failures, counted over two different scopes**. The word "REFUTED" is wrong and must not be used of it.

### 6. `WorkflowCanvas.tsx` — the G-5 diff cap, over the WHOLE PHASE

```
git diff --numstat 93bbfc87..HEAD -- frontend/src/components/workflows/WorkflowCanvas.tsx
```

Raw output, verbatim:

```
13	2	frontend/src/components/workflows/WorkflowCanvas.tsx
```

**13 insertions / 2 deletions** against the pinned cap of **≤ 15 / ≤ 4**. ✅ Within cap, with 2 insertions and
2 deletions still unspent.

Measured over the **whole phase range**, not one plan's commit — which is the point of the gate: 188-07 spent
the budget, and any later plan that had quietly widened the file would show here and nowhere else. It does
not; the same range measured from `db086240` gives byte-identical output.

⚠ **The `PlaneEditingLayer` / `EDIT_AFFORDANCE` extraction (185-10) is STILL OWED.** 188-07 deferred it
deliberately — that layer serves *editing*, which run-visualisation never touches, and lifting it risks the
live ESM cycle (`WorkflowCanvas` imports `FlowEdge`'s VALUE at module scope for the `edgeTypes` map, so the
extracted module must not import back). **Deferring is a decision, not a closure.** Due at the next
`WorkflowCanvas.tsx` FEATURE touch.

### 7. Zero migrations — SPEC failure condition #10

```
git diff --name-only 93bbfc87..HEAD -- supabase/migrations/
```

Output: *(empty — the command printed nothing at all)*

**Zero migration files added, modified or deleted by this phase.** The run read is a pure read over
`workflow_runs` / `workflow_phases` / `workflow_definitions` as they already exist; SPEC's `retrying` problem
was resolved at zero migrations by *refusing to paint it* rather than by widening the DB CHECK.

### 8. Deployment-artifact drift

```
bash scripts/check-deploy-drift.sh
```

**exit 0** — `RESULT: PASS — the one-box deploy artifacts are in sync.` All four checks `ok`:
preset keys (44 allowlisted omissions), seed list (9 runbook migrations, highest 089), sandbox tag
(`agentic-rag-sandbox:101.1` consistent), compose structural check.

**Confirmed, not assumed** — this phase adds no env var, no seed migration, no bundled service and no sandbox
tag change, and the script agrees. The two `WARN`s are pre-existing and non-blocking: the seed-like migrations
it names are all ≤ 113 and every one pre-dates this phase, and `docker compose` is unavailable in this shell
(CI runs the authoritative parse).

### 9. G-7 gap-closure round cap

```
node scripts/check-gap-closure-rounds.cjs 188
```

**exit 0**:

```
G-7 gap-closure round cap — 188-non-technical-run-observability
  plans: 13 total · 0 gap-closure

G-7 clear — no gap-closure plans in this phase.
```

**Zero rounds have run.** Recorded now rather than at the first `gaps_found`, so that number is *derived from
the repository* when it matters instead of eyeballed under pressure. Per CLAUDE.md G-7 the cap bites at **2**
rounds; the phase has 2 in hand.

---

## What is still OWED at the close of 188-12

Recorded as debt, not as done — a gate record that lists only what passed is not a record.

| Owed | Where it lives | Who closes it |
|---|---|---|
| The **8-row SC#10 cross-provider board** (script + board authored, rows not driven) | `188-UAT.md` · `scripts/sc10_188_run_board.py` | plan **188-13** |
| The five **Manual-Only** verifications below (colour-off legibility, G-4 lived-experience run watch, the `🕐 Tomorrow` moment, `.docx` download-only, SC#10) | § Manual-Only Verifications | operator UAT |
| `PlaneEditingLayer` / `EDIT_AFFORDANCE` extraction from `WorkflowCanvas.tsx` | 185-10 → deferred by 188-07 | next FEATURE touch of that file |
| `WorkflowCanvas` bundle-split regression (§ Phase gates 3) | `WorkflowRunPage.tsx` static import | next import/bundle-size touch |
| The run band does not re-read after mount (188-10's note) | `WorkflowRunPage.tsx` | a later plan, if the band should follow the stream's terminal event |

---

## Sampling Rate

- **After every task commit:** `node scripts/vitest-count-gate.cjs` + `npx tsc --noEmit -p tsconfig.app.json` (expect **33**)
- **After every plan wave:** the above, plus `pytest tests/test_revert_byte_identical.py tests/test_182_canvas_gate.py tests/test_188_workflow_run_read.py -q`
- **Before `/gsd:verify-work`:** count gate green with **every new pin present**; full backend suite run once and diffed against the recorded **211**-failure baseline; both falsification REDs pasted verbatim into their plan summaries; the 8-row SC#10 board complete
- **Max feedback latency:** ~150 seconds (count gate + typecheck)

---

## Per-Task Verification Map

> Seeded **by requirement** — the planner filled `Task ID` / `Plan` / `Wave` when plans were authored, and the
> executor flipped `Status`. **Filled in from measurement at plan 188-12 on 2026-08-05**, not from intention:
> every ✅ below means the row's named command was actually executed on that date and passed. The `Wave` column
> now carries the wave the work ACTUALLY landed in (the seeded 1/2/3/4 were the pre-plan estimate; the phase
> executed in 11 waves), and the `File Exists` column is re-read from disk rather than left at its W0 value.
>
> ⚠ **How the frontend rows were run.** Each named `npx vitest run <file>` is executed as a member of
> `node scripts/vitest-count-gate.cjs`'s `TARGETS` set — the gate runs those exact files and prints a per-file
> count. `failed 0` with the file's `actual` at its pin is therefore the same evidence the standalone command
> would give, plus the deletion guard. The per-file counts are in § Phase gates 1.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-T2 | **188-05** | 4 | RUNVIZ-01 (Req 1 parity) | — | N/A | unit (pure fn) | `npx vitest run src/lib/phaseState.test.ts` | ✅ (34, **pinned 188-12**) | ✅ green |
| 06-T3 | **188-06** | 5 | RUNVIZ-01 (Req 1 seal invariance, **all 7 readings**) | — | N/A | render | `npx vitest run src/components/workflows/PhaseNodeCard.test.tsx` | ✅ (105, pinned — was 68) | ✅ green |
| 07-T3 | **188-07** | 6 | RUNVIZ-01 (Req 2 no harness vocabulary) | T-188-XSS | authored strings render as plain React text children — never `dangerouslySetInnerHTML` | source grep + render | `npx vitest run src/components/workflows/PhaseNode.test.tsx` | ✅ (25, pinned — was 13) | ✅ green |
| 02-T1 / 05-T2 | **188-02** (RED) → **188-05** (moved into the lib) | 2 → 4 | RUNVIZ-02 (Req 3 `?? "done"`) — **observe RED first** | — | N/A | unit | `npx vitest run src/lib/phaseState.test.ts` | ✅ (34, pinned) | ✅ green (RED observed in 188-02; **D-188-05-A**: the plan's literal `?? "done"` expression measured NOT total and was replaced by an own-property guard) |
| 02-T1 | **188-02** | 2 | RUNVIZ-02 (Req 3 — ⚠ **the second, REACHABLE fail-open**: `finalizeAllPhasesForThread` sweeps `pending` → `done`) — **observe RED first** | — | N/A | unit (store) | `npx vitest run src/components/panel/__tests__/PhaseReconcile.test.tsx` | ✅ (12, **pinned 188-12** — was pinned 2 while running 12; every case here sat in that slack) | ✅ green |
| 05-T2 | **188-05** | 4 | RUNVIZ-02 (Req 4 paintable ⊆ reconcilable) | — | N/A | unit (property) | `npx vitest run src/lib/phaseState.test.ts` | ✅ (34, pinned) | ✅ green |
| 08-T3 | **188-08** | 7 | RUNVIZ-02 (Req 4 mid-run reconcile identity) | — | N/A | integration (RTL) | `npx vitest run src/pages/WorkflowRunPage.test.tsx` | ✅ (60, **pinned 188-12**) | ✅ green |
| 07-T3 | **188-07** | 6 | RUNVIZ-01 (Req 5 waiting words ≠ badge, not a tense variant) | — | N/A | render + grep | `npx vitest run src/components/workflows/PhaseNode.test.tsx` | ✅ (25, pinned) | ✅ green |
| 08-T3 / 09-T3 | **188-08** (page) → **188-09** (the layout branch that makes it structural) | 7 → 8 | RUNVIZ-03 (Req 6 no chat nav, no message list, no composer) | — | N/A | integration | `npx vitest run src/pages/WorkflowRunPage.test.tsx` + `src/components/layout/ChatLayout.launch.test.tsx` | ✅ (60 · 12, both **pinned 188-12**) | ✅ green |
| 09-T3 | **188-09** | 8 | RUNVIZ-03 (Req 6 thread still created + still anchors the run) | — | N/A | integration (wire) | `npx vitest run src/components/layout/ChatLayout.launch.test.tsx` — asserts `createThread` + `postMessage` called and the nav target is the run, not chat | ✅ (12, pinned) | ✅ green |
| 08-T3 | **188-08** | 7 | RUNVIZ-03 (Req 7 terminal run re-opens, no stream) | T-188-IDOR | owner-scoped SELECT + 404-on-miss | integration | `npx vitest run src/pages/WorkflowRunPage.test.tsx`; server half `pytest tests/test_188_workflow_run_read.py -q` | ✅ (60 · 6 backend) | ✅ green |
| 10-T3 | **188-10** | 9 | RUNVIZ-03 (Req 7 deliverable listed + downloadable) | — | N/A | integration | same file (mock `useWorkspaceFiles` + `downloadWorkspaceFile`) | ✅ (60 — grew 45 → 60 in this plan) | ✅ green |
| 08-T3 | **188-08** | 7 | RUNVIZ-03 (Req 7 elapsed labelled with its anchor; `claimed_at = null` shows **no** clock) | — | N/A | render | same file | ✅ (60, pinned) | ✅ green |
| 05-T2 | **188-05** | 4 | RUNVIZ-01 (Req 8 one derivation, zero local re-derivations) | — | N/A | source grep fence | `npx vitest run src/lib/phaseState.test.ts` (`FORBIDDEN_SYMBOLS` pattern, per `DescribeKbPicker.test.tsx`) | ✅ (34, pinned) | ✅ green |
| 07-T2 (spent) / 12-T2 (measured) | **188-07** → **188-12** | 6 → 10 | Req 8 `WorkflowCanvas.tsx` diff cap | — | N/A | shell | `git diff --numstat 93bbfc87..HEAD -- frontend/src/components/workflows/WorkflowCanvas.tsx` | n/a | ✅ green — **13 / 2** over the WHOLE phase, against ≤ 15 / ≤ 4 (§ Phase gates 6) |
| 03-T1/T3 | **188-03** | 2 | SPEC — new route 404s when `visual_workflow_canvas` off | T-188-ROUTE-DISCLOSE | flag resolved **before** auth; anonymous/invalid/banned fold into the same 404; body byte-identical `{"detail":"Not Found"}` | backend | `pytest tests/test_188_workflow_run_read.py tests/test_182_canvas_gate.py tests/test_revert_byte_identical.py -q` | ✅ (20 passed, exit 0) | ✅ green |
| 03-T2 | **188-03** | 2 | SPEC — route absent from `/openapi.json` when off | T-188-OPENAPI | path **template** registered in `CANVAS_GATED_PATHS` | backend | `pytest tests/test_182_canvas_gate.py -q` | ✅ (8 passed — the **exact-set** assertion holds with the new template member) | ✅ green |
| 12-T2 | **188-12** | 10 | SPEC — zero migrations | — | N/A | shell | `git diff --name-only 93bbfc87..HEAD -- supabase/migrations/` is empty | n/a | ✅ green (§ Phase gates 7) |
| 11-T1/T2 (authored) · 13-T1 (driven) | **188-11** → **188-13** | 10 → 11 | SC#10 — 8 rows, each PASS or ⛔-with-reason | — | N/A | script + DB read | `python scripts/sc10_188_run_board.py` — roster derived by executing `MODEL_CAPABILITIES` (61 models → 8 provider groups); verdicts read from `workflow_runs` / `workflow_phases` | ✅ script + board exist | ⬜ **MANUAL — has a home**: `188-UAT.md`, driven by plan **188-13**. Requires live provider keys; not settleable by this plan |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Every row is ✅ except one, and that one is an explicitly manual row with a named home** (`188-UAT.md`,
driven by 188-13) — which is the condition under which `nyquist_compliant: true` is set in the frontmatter.
⚠ Read that flag for what it is: it says the validation *strategy* samples every requirement with a command
that has actually been run, **not** that the phase's manual UAT is complete. Five Manual-Only rows (below)
and the eight-row SC#10 board are still owed and are named as owed.

---

## Wave 0 Requirements

- [ ] `frontend/src/lib/phaseState.ts` + `frontend/src/lib/phaseState.test.ts` — the shared derivation and its parity / total-function / subset / grep-fence tests (RUNVIZ-01, RUNVIZ-02)
- [ ] `frontend/src/pages/WorkflowRunPage.test.tsx` — the run-surface integration suite (RUNVIZ-03)
- [ ] `backend/tests/test_188_workflow_run_read.py` — the new route's ownership, 404-when-off, and shape tests
- [ ] **`scripts/vitest-count-gate.cjs` — extend `TARGETS` to include `src/lib/`, `src/components/panel/__tests__/` and `src/pages/`.** ⚠ **Load-bearing.** These directories are outside `TARGETS` today, so a new test file there is *silently never run*. A suite that does not run cannot fail, and a phase whose falsification tests never execute has proved nothing.
- [ ] **Extend `BASELINE`** to pin the new counts **and** the two already-running-but-unpinned suites (`PhaseNode.test.tsx` 13, `PhaseNodeCard.test.tsx` 68). Pinning is a separate knob from running — pin both.
- [ ] Record the pre-existing `test_thread_workflow_endpoint.py` 1-of-7 RED **before** any edit, so it can be proven non-attributable.

*No framework install needed — vitest and pytest are both in tree.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **"Colour off" legibility** — all seven readings remain distinguishable with colour disabled | RUNVIZ-01 | Sketch 153's explicit acceptance test; a machine can assert the arc geometry differs but not that a human can *read* it | Launch a run with `visual_workflow_canvas` on; apply a greyscale filter (DevTools rendering → emulate `achromatopsia`); confirm all seven readings separate by shape alone |
| **G-4 lived-experience run watch** — watch a real multi-phase run end to end on the run surface | RUNVIZ-01/02/03 | The documented UAT-gap pattern: regressions hide in slow streams. Wire format + screenshot are insufficient | Chrome MCP drives a real published workflow launch; watch ≥3 phase transitions; refresh mid-run and confirm no reading changes; reach terminal; open the deliverable |
| **The `🕐 Tomorrow` moment** — navigate away, come back, find the run and its file | RUNVIZ-03 | Tests the bidirectional seam (D-188-13), which only exists as a user journey | Launch → navigate to Chat → find the run's thread in history → follow "Open the run" → confirm spine, final state, and deliverable all render with no live stream |
| **`.docx` deliverable is download-only, and says so** | RUNVIZ-03 | `FilePreview` routes DOCX/PPTX/XLSX/PDF to a download fallback; the surface must not promise a preview | Run a workflow whose `llm_emit` produces `.docx`; confirm it is listed, downloads in one click, and no broken preview pane renders |
| **SC#10 — 8-row cross-provider board** | SC#10 | Requires live provider keys; a keyless row **silently looks like a pass** | ⚠ **Probe API-key availability per provider FIRST.** Then drive each row with a per-request `provider`. ⚠ **Per-request `model` does NOT reach a harness phase** (`ctx.model` reads `user_settings.llm_model`); only `provider` does. `phase.config.model` beats everything. `override_provider` fails **silently** without a key. Record each row PASS or ⛔-with-reason + blocking id; never omit |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — **including the `TARGETS`/`BASELINE` extension** (`TARGETS` at 188-01/05/08/09/10; `BASELINE` completed at **188-12**, which is where the two-knob gap actually closed)
- [x] No watch-mode flags
- [x] Feedback latency < 150s (count gate ~120 s + typecheck ~25 s)
- [x] Both falsification tests observed **RED against unmodified HEAD** and the raw output recorded (`188-02-SUMMARY.md`; the reachable-fail-open half is fenced by `PhaseReconcile.test.tsx`, which only became *deletion-guarded* at 188-12)
- [x] `nyquist_compliant: true` set in frontmatter — with the caveat stated under the per-task map: it means every requirement is sampled by a command that has actually run, **not** that manual UAT is complete
- [x] Nine phase gates measured and recorded with their literal commands (§ Phase gates — measured at plan 188-12)
- [x] At least one pin observed producing `[count-decrease]` on a genuinely deleted `it(` block, then restored
- [ ] SC#10 board driven — **OWED**, plan 188-13
- [ ] Five Manual-Only verifications — **OWED**, operator UAT

**Approval:** automated half signed off at 188-12 (2026-08-05). Manual half pending — see
§ What is still OWED at the close of 188-12.
