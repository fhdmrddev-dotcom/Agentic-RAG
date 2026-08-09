# Phase 185 — deferred / out-of-scope discoveries

Items found while executing this phase that are **not** caused by it and are **not** fixed here.

## Pre-existing backend unit-test rot (found during 185-02, 2026-07-29)

`cd backend && venv/Scripts/python -m pytest tests/unit -q` reports **62 failed / 1549 passed**
on the tree this plan started from. None of the failing files import `PhaseSpec`,
`GroundingBundle` or the workflows router in any way plan 185-02 touched — verified by
grepping all 17 failing files for `PhaseSpec|GroundingBundle|grounding_bundle|harness`
(one hit, `test_forced_emit.py`, whose failure is an **unmocked live provider call**
returning `emitted: None`, i.e. an environment/credential failure).

| File | Failures | Shape of the failure |
|---|---|---|
| `test_retrieval_service.py` | 15 | — |
| `test_sql_service.py` | 12 | `TypeError: argument of type 'coroutine' is not iterable` — a sync/async drift |
| `test_explorer_agent.py` | 6 | — |
| `test_multimodal_query.py` | 5 | — |
| `test_111_1_reembed_kickoff.py` | 4 | — |
| `test_sandbox_service.py` / `test_lifespan.py` / `test_db_runs.py` | 3 each | `test_db_runs`: positional-arg / SQL-shape counts (`assert 10 == 8`) |
| `test_module7_tools.py` / `test_extraction_service.py` | 2 each | — |
| 6 further files | 1 each | incl. `test_forced_emit.py` (live provider call) |

**Why not fixed here:** the executor scope boundary — only issues DIRECTLY caused by this
plan's changes are auto-fixed. This is the backend analog of the frontend vitest rot already
tracked as SEED-056.

**Re-open trigger:** the first phase that touches `retrieval_service` / `sql_service` /
`explorer_agent`, or a dedicated backend-suite-rot cleanup phase. Until then, phase
verification must scope its pytest runs (`-k "grounding or 185 or workflows or harness"`)
rather than asserting a globally green `tests/unit`.

## An armed checkpoint answered DURING a resume is asked once more (found during 185-05)

**What happens.** 185-05 Task 2 teaches the boot sweep to re-subscribe the SAME
`tool_call_id` (fix (a), L-7). When the person answers that resumed prompt,
`resume_pending_prompt` returns and the sweep proceeds to `_resume_run` → `run_workflow`,
which re-runs the still-`active` phase from the top. The pre-gate fires again, and
`_resolve_failure_with_ask_user` mints a **new** `tool_call_id` and asks a second time.

**Why it is not a defect this plan shipped.** It is strictly better than the pre-185-05
behaviour, which the sweep produced anyway (a fresh ask) *while leaving the old row
un-expired* — so `/pending` served a DEAD card alongside a live one. That is the failure
G-4 scenario 3 names, and it is closed: there is now exactly one live prompt at a time,
and it is always the one the run is listening to. The residue is an extra ask, never an
unreachable or an unanswerable card, and it is fail-CLOSED at every point (the step never
runs without an explicit approval).

**Why it is not fixed here.** Closing it means `_resolve_failure_with_ask_user` must read
the durable answer before minting a prompt — the same durable-answer short-circuit
`harness/phase_types._exec_llm_human_input` performs. That adds a DB read and a
resume-identity contract to the disposition seam: an architectural change (executor
Rule 4), outside this plan's three tasks and outside SPEC Req 9's wording.

**Re-open trigger:** the first live UAT where an operator answers an armed checkpoint
*after* a backend restart and is asked the same question twice — or Phase 188, which owns
the run surface and will render both asks. Whoever picks it up should also decide whether
the second ask should be suppressed or should carry the first answer as a receipt.

## Pre-existing frontend panel-suite rot (measured during 185-05, 2026-07-29)

`npx vitest run src/components/panel` reports **2 failed / 165 passed** at commit
`a4010b46` — i.e. BEFORE this plan's frontend task — both in
`src/components/panel/__tests__/PhaseTimeline.test.tsx` (`axe has no violations:
fxRunRunning` and `fxRunFailed`). Measured by reverting the four Task-3 files to HEAD and
re-running; after the task the same 2 fail and the total is 169 passed (+4, all new).
A third file (`FilePreview.test.tsx`) failed on ONE run and passed on the next two on an
unchanged tree — flaky, not a regression. Tracked against SEED-056; not touched.
