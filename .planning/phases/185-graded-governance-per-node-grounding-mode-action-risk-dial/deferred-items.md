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
