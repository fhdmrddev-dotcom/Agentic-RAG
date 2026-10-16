---
phase: 282-the-slow-run-and-the-paused-run
plan: 01
subsystem: provider-gateway
tags: [timeout, max_retries, provider-clients, gateway, event-loop, model-registry, tdd, bug-260916-01, bug-261015-02]

requires:
  - phase: 262
    provides: Model Registry capability columns + the PATCH bound guard (_MODEL_CAP_INT_BOUNDS)
  - phase: 092.5
    provides: provider_gateway dispatcher + GatewayRequest envelope
provides:
  - "_LLM_CALL_TIMEOUT_MAX_S = 1800 with a boot check against the run watchdog"
  - "llm_max_retries_for(provider) beside _SELF_HOSTED_PROVIDERS (0 self-hosted, 2 cloud)"
  - "every LLM client family built with the per-model budget (OpenAI-compat, Responses, Anthropic, Google)"
  - "GatewayRequest.timeout_s plumbed from agent_loop, forced_emit and task_service"
  - "the OpenAI-family open runs off the event loop under one deadline shared with the drain"
  - "the 422 sentence naming the watchdog, the run-failure sentence naming model/N/Registry, the Registry help line"
affects: [282-03, provider-gateway, model-registry, agent-loop]

tech-stack:
  added: []
  patterns:
    - "Timeout/retry values go into the SDK CONSTRUCTOR before wrap_openai, never re-derived after"
    - "Off-loop open: asyncio.to_thread + shield + timeout_at(deadline) + late-close done-callback"
    - "stream.budget_deadline stamped by the dispatcher, read by the drain helper (call sites unchanged)"

key-files:
  created:
    - backend/tests/unit/test_282_timeout_bound.py
    - backend/tests/unit/test_282_client_timeouts.py
    - backend/tests/unit/test_282_open_off_loop.py
    - backend/tests/unit/test_282_slow_stub_scaled.py
  modified:
    - backend/app/config.py
    - backend/app/api/admin.py
    - backend/app/services/run_producer.py
    - backend/app/services/openai_service.py
    - backend/app/services/anthropic_service.py
    - backend/app/services/google_service.py
    - backend/app/services/provider_gateway/dispatcher.py
    - backend/app/services/provider_gateway/openai_compat.py
    - backend/app/services/provider_gateway/openai_responses.py
    - backend/app/services/provider_gateway/anthropic.py
    - backend/app/services/provider_gateway/google.py
    - backend/app/services/agent_loop.py
    - backend/app/services/forced_emit.py
    - backend/app/services/task_service.py
    - frontend/src/lib/api/admin.ts
    - frontend/src/components/admin/ModelRegistryTab.tsx
    - backend/tests/test_196_emit_tier_overlay.py
    - backend/tests/unit/test_openai_service.py
    - frontend/src/components/admin/__tests__/ModelRegistryTab.test.tsx

key-decisions:
  - "The timeout 422 uses one sentence for every out-of-range value (0, negative, above max), with the watchdog reason; other int columns keep their old sentence"
  - "The off-loop open also closes a late stream when the RUN IS CANCELLED during the open (except BaseException), not only on the guard timeout"
  - "timeout_at(None) is used for no-budget callers, so both paths share one shielded code path"
  - "MODEL_TIMEOUT_HELP_LINE lives in lib/api/admin.ts, imported directly by the component (no re-export added to lib/api.ts)"

patterns-established:
  - "A per-model budget travels on GatewayRequest.timeout_s and is forwarded to a client only when set (lambda fakes and no-budget callers stay byte-identical)"

requirements-completed: [FIX-06]

duration: ~50min
completed: 2026-10-15
---

# Phase 282 Plan 01: The operator's timeout reaches every LLM client Summary

**The per-model timeout is now what every provider SDK client is built with (OpenAI-compat, Responses, Anthropic, Google). Retries are 0 for self-hosted and 2 for cloud, and the ceiling is 1800 s because the 2400 s run watchdog cannot honour more. The OpenAI-family stream open moved off the event loop and shares one deadline with the drain, so a slow server no longer freezes the worker (BUG-261015-02).**

## Performance

- **Duration:** about 50 min (base capture about 09:55Z, last commit 10:37Z, gate done 10:43Z)
- **Tasks:** 3/3 (TDD: RED commit before GREEN on each)
- **Files modified:** 19 (4 test files created)

## PHASE_BASE and base files

- **PHASE_BASE:** `d1ba70553bc13a137bcac65889d1ceaf07189363`. The worktree started on `master` at `60ce3797c`, and was reset to the base before any work.
- Base files under `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-282/`:
  - `baseline_base_d1ba70553.log`, the full gate at base: 71 failed / 7445 passed, 0 errors. It ran before any test_282 file existed (`grep -c test_282` = 0).
  - `base_failed_d1ba70553.txt`: the 71-line failing set.
  - `root_base_d1ba70553.txt`, the root/integration set at base: 11 failed / 13 passed, plus the base `test_196` line (1 failed / 31 passed: `test_emit_tier_joined_the_patch_allowlist`, inherited `14 == 8`). `test_196` was measured from `git show d1ba70553:` into a temp copy because the RED commit had already edited it. The temp copy was deleted.
  - `tsc_base_d1ba70553_01.txt`: copied from 282-02's `tsc_base_d1ba70553_02.txt`, which has the same base. The tsc run in this worktree after the RED commit differed from it by exactly one line, the RED test's missing `MODEL_TIMEOUT_HELP_LINE` import, and nothing else.

## RED evidence

**Task 1** (`57bc838ab`): 27 failed / 31 passed. The intended reasons were:
```
FAILED test_282_timeout_bound.py::test_ceiling_is_1800_in_config_and_admin
FAILED ...::test_frontend_mirror_reads_1800
FAILED ...::test_self_hosted_providers_are_tried_once[ollama|lmstudio|custom|LMStudio]
FAILED ...::test_cloud_providers_keep_two_retries[openai|openrouter|anthropic|deepseek|google|None]
FAILED ...::test_db_tier_clamps_out_of_range[5000-1800|0-1|-5-1]
FAILED ...::test_boot_refuses_a_watchdog_at_or_below_the_ceiling
FAILED ...::test_timeout_above_ceiling_is_refused_with_the_reason
E       AttributeError: module 'app.services.run_producer' has no attribute '_timed_out_error'
FAILED test_196_emit_tier_overlay.py::test_out_of_range_int_is_422_before_any_write[zero|negative|above_max-llm_call_timeout_seconds]
```
`test_emit_tier_joined_the_patch_allowlist` also failed; it is inherited at base. In vitest, 1 failed / 32 passed (`shows the help line while the Timeout cell edits ...`). The 422-in-row case and the no-pre-block case passed at RED. They pin a path that already existed (RESEARCH R6), so they guard against regression and do not drive anything new.

**Task 2** (`ca3076732`): 18 failed / 3 passed. Every readback failed (`get_llm_client() got an unexpected keyword argument 'timeout_s'`, no `_anthropic_client` / `_google_client`, `GatewayRequest` had no `timeout_s`), and so did every source fence. The three that passed: the two no-budget forward-nothing cases (trivially true at base) and the help-line drift check, which Task 1 had just made true.

**Task 3** (`f50903e9e`): 7 failed / 9 passed:
```
MEASURED max_tick_gap_s=2.970 ticks=3          (2.0 s header delay — the loop froze)
E   openai.APITimeoutError: Request timed out.  (open escaped the budget: not a TimeoutError)
E   Failed: DID NOT RAISE <class 'TimeoutError'>   (late stream: no guard at all)
E   AttributeError: '_FakeStream' object has no attribute 'budget_deadline'
E   assert 84096 != 84096                        (no-budget open ran ON the loop thread)
E   AssertionError: drain ignored the shared deadline (10.014s)
FAILED test_282_slow_stub_scaled.py::test_self_hosted_timeout_is_one_request_at_the_setting (APITimeoutError)
```
⚠ **Honest note on the SCALED cases 1–2:** at Task 3 RED, the scaled cases for slow headers and the mid-stream gap already PASSED (2.296 s / 2.240 s, 1 hit each). Task 2 had already put the 3 s setting into the client constructor, which is the fix they prove. They could not be run RED at PHASE_BASE: `GatewayRequest(timeout_s=...)` is a TypeError there. Their RED is therefore the inequality, not a recorded run: with the SDK default patched to 1 s, a client built without the setting reads 1 s against a 2 s stub. The third scaled case was RED as recorded above.

## Readback values per client family (from the GREEN tests)

| Client | With budget 900 | Without budget |
|---|---|---|
| `get_llm_client` (OpenAI-compat / Responses), also through `wrap_openai` | `Timeout(connect=5.0, read=900, write=900, pool=900)`, `max_retries` as passed (lmstudio 0 / cloud 2) | `read=600, connect=5.0`, `max_retries=2` |
| `get_embedding_client` | n/a (no budget path) | `read=600, connect=5.0`, `max_retries=2` |
| `_anthropic_client` | `read=900, connect=5.0`, `max_retries=2` | `read=600`, `max_retries=2` |
| `_google_client` | `_api_client._http_options.timeout == 900000` (ms), `retry_options.attempts == 1` | `timeout is None` (today's bare client) |

## GREEN timings (Task 3, `4d54874f3`)

- Ticker max gap went from **2.970 s (RED)** to **0.065 s (GREEN)** over 48 ticks, with the stub holding headers for 2.0 s.
- The open guard: a 3 s header hold with `timeout_s=1` raises `TimeoutError` at **1.003 s**.
- SCALED (1 s SDK default < 2 s answer < 3 s setting):
  - headers held 2 s: completes `"hello"` in 2.290 s, **1 server hit**
  - 2 s gap between chunks: completes `"hello"` in 2.294 s, **1 server hit**
  - lmstudio, headers held 4 s: `TimeoutError` at **3.000 s**, **1 server hit** after waiting 2 s more for a would-be retry (SC#2).
- Late close: a stream that arrives 1.5 s into a 0.5 s guard is closed by the done-callback.
- forced_emit (W3, pinned): a `TimeoutError` from the open guard on each rung is caught by the existing per-rung `except Exception`. The `force` ladder tries both rungs (`non_strict_force`, `coerce`) and returns `{"emitted": None, "failure": "provider_error"}`. Nothing escapes. Each rung's request carries the resolved budget.
- task_service (recorded, not pinned): `_stream_one_iteration` awaits `open_stream` with no surrounding try. A guard `TimeoutError` propagates to the sub-agent caller the same way any provider error from `open_stream` does. No new handling was added.

## The two sentences, as the tests produce them

- **422** (`PATCH llm_call_timeout_seconds=1801`): `Timeout must be between 1 and 1800 seconds, because a longer call would outlast the run watchdog, which ends a run that has been silent for 2400 s. 1801 was not saved.` Nothing is written (`pool.calls` stays empty).
- **Run failure** (`_timed_out_error(900, 3, "qwen")`): `timed_out: 900s per-call deadline exceeded at iteration 3 (model=qwen). qwen did not answer within 900 s, its per-call timeout. You can change it in the Model Registry.`
- **Registry help line** (`MODEL_TIMEOUT_HELP_LINE`): `Between 1 and 1800 seconds. Local models and Google models are tried once. Other cloud providers retry quick failures up to 2 times.`

## AST deltas (PHASE_BASE vs HEAD)

| File | `ast.If`+`ast.IfExp` | defs | numstat |
|---|---|---|---|
| `backend/app/services/agent_loop.py` | 191 → 192 (**+1**) | 25 → 25 (**+0**) | +7 / -0: two `timeout_s=per_call_budget,` lines, plus 5 in the drain helper (3 code, 2 comment) |
| `backend/app/services/provider_gateway/dispatcher.py` | 6 → 9 (**+3**) | 2 → 5 (**+3**) | +99 / -35 |

- agent_loop.py stays within the plan's expectation (+1 conditional, +0 defs), so **no OV-282-01 is raised**. The two drain call sites and the `async with asyncio.timeout(timeout_seconds):` literal are unchanged. `test_061_hard_timeout.py` has no diff and is green.
- dispatcher.py adds **+3 defs, not the expected +2.** `_open_openai_family` (the moved body), `_open_off_loop`, and `_close_late_stream`: the late-close callback is a named module function rather than a closure. The +3 conditionals are the `deadline` IfExp, `if deadline is not None`, and the callback's early-return guard. 282-03 should carry this as measured.

## Backend gate (set diff)

- First HEAD run (`baseline_head_01.log`): **73 failed.** `comm -3` against base showed two new failures, `tests/unit/test_openai_service.py::TestGetLlmClient::test_returns_openai_client_when_no_base_url` and `::test_returns_client_with_custom_base_url_when_configured`. Both assert the exact `OpenAI(...)` kwargs, and the constructor now also gets the named timeout and retry count by design. They were fixed in `ff92ba85a` (Rule 1). The only other `comm` line was a log artifact: the same `test_retrieval_service` id with a RuntimeWarning glued onto the line.
- Re-run (`baseline_head_01b.log`): **71 failed / 7508 passed, 0 errors, GATE PASSED.** `comm -3` against the base set, with ids normalised, is empty apart from one more log artifact: the same `test_explorer_agent` id with a glued RuntimeWarning. The failing set is identical to PHASE_BASE.
- Root/integration set at HEAD (`root_head_01.txt`): 12 failed / 44 passed. These are the **same 12** as base: the 11 integration tests plus `test_196::test_emit_tier_joined_the_patch_allowlist`.
  - ⚠ The `test_066_*` integration suites are **red at base** (`ForeignKeyViolationError runs_thread_id_fkey` and missing `threads.web_search` attributes), so their `startswith("timed_out:")` pins exercise nothing right now. The prefix is pinned byte-for-byte by `test_282_timeout_bound.py::test_timed_out_error_keeps_prefix_and_names_the_setting` instead.
- Frontend: `tsc -p tsconfig.app.json` `comm -13` against base printed nothing (103 lines, the same set). vitest `src/components/admin/__tests__/` passed: 21 files, 200 tests.
- `node scripts/check-hot-file-ledger.cjs 282`: exit 0 (542 scan rows, 20 watched).
- Migrations: none added. The latest file is still `206_retention_hold_hardening.sql`.

## Deploy-parity grep

`grep RUN_STALE_SWEEP deploy/onebox.env.example docs/OPERATOR.md docker-compose.prod.yml backend/.env.example` matched nothing. No deploy artifact sets the watchdog, so the shipped default of 2400 applies everywhere and passes the new boot check (2400 > 1800 + 120). No env var was added or renamed. The local `backend/.env` could not be read (permission rule), but `Settings()` constructs in the test run, so it does not set a value ≤ 1920.

## D-21 live-row figures (carried from CONTEXT, not re-measured)

Local: 11 rows set, max 900. Production (MCP read 2026-10-15): 4 rows set, max 1200. **None is above 1800**, so the new ceiling makes no stored value unreachable, and the D-08 clamp changes nothing that exists today.

## Task Commits

1. **Task 1 RED:** `57bc838ab` (test): pin the 1800 ceiling, the retry rule, the clamp, the refusal and the timeout sentences
2. **Task 1 GREEN:** `d7467f4a9` (fix): the timeout ceiling names its reason and the retry rule is explicit
3. **Task 2 RED:** `ca3076732` (test): read the timeout and retries back from every built client
4. **Task 2 GREEN:** `46b95d72c` (fix): build every LLM client with the operator's timeout and a deliberate retry count
5. **Task 3 RED:** `f50903e9e` (test): a held-header stub freezes the loop and escapes the budget
6. **Task 3 GREEN:** `4d54874f3` (fix): open OpenAI-family streams off the event loop under the shared per-call deadline
7. **Gate fix:** `ff92ba85a` (fix): pin the explicit no-budget timeout and retries in the get_llm_client constructor tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two constructor-kwarg tests broke because of the intended design change**
- **Found during:** Task 3 wave gate (73 vs 71)
- **Issue:** `test_openai_service.py::TestGetLlmClient` asserted `OpenAI(api_key=...)` exactly. The constructor now also receives `timeout` and `max_retries` (D-03/D-23).
- **Fix:** The expected call now includes the named `NO_BUDGET_*` / `LLM_CONNECT_TIMEOUT_S` values, imported from config and not retyped.
- **Files modified:** `backend/tests/unit/test_openai_service.py`
- **Commit:** `ff92ba85a`

**2. [Rule 2 - Missing critical] A run cancelled during the open leaked the stream**
- **Found during:** Task 3 GREEN
- **Issue:** The plan's sketch closes a late stream only on the guard `TimeoutError`. A user Stop (CancelledError) during the open would also leave the thread's stream unclosed, and a cloud provider would keep generating and billing (T-282-04).
- **Fix:** `_open_off_loop` registers `_close_late_stream` on `except BaseException`. It uses `asyncio.timeout_at(None)` for no-budget callers, so that path is shielded and closed the same way.
- **Files modified:** `backend/app/services/provider_gateway/dispatcher.py`
- **Commit:** `4d54874f3`

**3. [Plan precision] The test_196 edit wraps the one assertion in an if/else**
- In place of the single `assert col in detail` line, an if/else asserts the timeout's sentence prefix and keeps `col in detail` for every other column. The lo/hi and no-write assertions are unchanged.

**4. [Plan precision] Stale `[1, 3600]` comments in config.py were corrected** (the env-parser docstring and the `llm_call_timeout_overrides` field comment) so the code no longer states the old bound.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema. The 422 text carries only the bound, the value and the watchdog seconds (T-282-06 accepted).

## Next Phase Readiness

- 282-03 owns the merged-tree ledger rows and CLAUDE.md cells. dispatcher.py measured +3 defs, not +2, and agent_loop.py stayed inside its budget (no OV-282-01).
- The live half (G-4 row 4 with LM Studio, D-26) is still owed to 282-03.

## Self-Check: PASSED

- FOUND: backend/tests/unit/test_282_timeout_bound.py, test_282_client_timeouts.py, test_282_open_off_loop.py, test_282_slow_stub_scaled.py
- FOUND commits: 57bc838ab, d7467f4a9, ca3076732, 46b95d72c, f50903e9e, 4d54874f3, ff92ba85a
