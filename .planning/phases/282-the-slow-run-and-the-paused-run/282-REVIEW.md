---
phase: 282-the-slow-run-and-the-paused-run
reviewed: 2026-10-15T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - backend/app/api/admin.py
  - backend/app/config.py
  - backend/app/services/agent_loop.py
  - backend/app/services/anthropic_service.py
  - backend/app/services/forced_emit.py
  - backend/app/services/google_service.py
  - backend/app/services/openai_service.py
  - backend/app/services/provider_gateway/anthropic.py
  - backend/app/services/provider_gateway/dispatcher.py
  - backend/app/services/provider_gateway/google.py
  - backend/app/services/provider_gateway/openai_compat.py
  - backend/app/services/provider_gateway/openai_responses.py
  - backend/app/services/run_producer.py
  - backend/app/services/task_service.py
  - frontend/src/components/admin/ModelRegistryTab.tsx
  - frontend/src/components/panel/PendingAskCard.tsx
  - frontend/src/components/panel/WorkspacePanel.tsx
  - frontend/src/lib/api/admin.ts
  - frontend/src/setupTests.ts
  - frontend/src/stores/askDraftStore.ts
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: partially_fixed
fixed_at: 2026-10-15
---

# Phase 282: Code Review Report

**Reviewed:** 2026-10-15
**Depth:** standard (scoped to the `d1ba70553..HEAD` hunks and the code they call)
**Files Reviewed:** 20
**Status:** issues_found

## Summary

FIX-06 (per-model timeout reaching every client, off-loop OpenAI-family open, 1800 s ceiling, 900 s
self-hosted default) and FIX-07 (one ask draft, panel-home pointer, APG radio keys) were reviewed
against D-01..D-30. The 87 backend tests matching `282` pass (`pytest tests/unit -k 282`: 87 passed).

The main defect is in the retry policy. `max_retries` is chosen from the **registry vendor** of the
model id. The endpoint is chosen from the **routing provider**, and so is the timeout default in the
same call. So an LM Studio or Ollama model that is not in the registry, under the slug shapes those
servers actually use (`qwen/qwen3-30b-a3b`, `gpt-oss-20b`, `deepseek-r1:14b`), gets the cloud
retry count of 2 against the local GPU. I measured this with the live resolver; it is not inferred.

The open guard is shielded. A timed-out open keeps running in its worker thread, so those retries
fire after the run has already been classified `timed_out`. The same guard creates two new failure
paths outside the agent loop: sub-agents record a blank error, and forced-emit treats a timeout as a
rung failure and moves on to the next rung. The env-override tier also drops values above the
lowered 1800 ceiling, while the DB tier clamps them.

The frontend changes are sound overall. The store GC uses `subscribeWithSelector` correctly, and the
panel-home refcount is mount-equals-visible on both the desktop and the mobile-sheet branches,
which I verified in `WorkspacePanel.tsx:586-641`. The one robustness gap is a silent integer
truncation in the Add-model Timeout field.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Self-hosted retry policy keys on the registry vendor, not the endpoint. Local models get cloud retries, and they fire after the run has timed out

**File:** `backend/app/services/provider_gateway/openai_compat.py:517-530`, `backend/app/services/task_service.py:275-280,307`, `backend/app/services/agent_loop.py:2634-2646`
**Issue:**
`open_openai_compat_stream` derives `max_retries` from `request.active_provider_name`. Both callers
fill that field with the registry-derived adapter provider, not with the provider the client is
pointed at:
- `agent_loop.py:2637` sets `_adapter_provider = _active_cap.get("provider")`.
- `task_service.py:280` sets `_cap.get("provider")`, which is resolved with no hint at all.

`get_llm_client` builds its endpoint from `user_settings.active_provider` / `llm_base_url`
(`openai_service.py:1468-1472`). The timeout default in the same call is keyed on the routing
provider too (`get_per_call_timeout_async(..., provider=active_provider_name)`). So one call gives
two different answers to "is this self-hosted?".

Measured with the shipped resolver, using the provider hint `lmstudio`:

| model id | resolved provider | `llm_max_retries_for` |
|---|---|---|
| `qwen/qwen3-30b-a3b` | `openrouter` | 2 |
| `openai/gpt-oss-20b` | `openrouter` | 2 (without a DB row) |
| `gpt-oss-20b` | `openai` | 2 |
| `deepseek-r1:14b` | `deepseek` | 2 |

These are LM Studio's and Ollama's own slug shapes, and an unregistered LM Studio model is exactly
D-27's motivating case (G-4 row 4).

How it fails: the local server holds headers back while it processes the prompt (BUG-261015-02's
measured header wait). Then:
1. The `_open_off_loop` guard fires at the budget, and the run ends `timed_out`.
2. The shielded worker thread is still inside `create()`. Its httpx read timeout fires a moment
   later.
3. The OpenAI SDK retries `APITimeoutError` twice, each attempt with the full 900 s budget.

Result: up to about 30 more minutes of the same prompt queued on the operator's GPU after the UI
has said the run is over. That is the exact failure D-19 set retries to 0 to prevent. The Model
Registry help line (`frontend/src/lib/api/admin.ts:618`, "Local models … are tried once") is false
for these models.

**Fix:** Key the retry class on the provider that chose the endpoint, and keep the adapter provider
only for `<think>`/usage normalization:
```python
# openai_compat.py
_routing = (request.user_settings.active_provider if request.user_settings else None) \
    or request.active_provider_name
"max_retries": llm_max_retries_for(_routing)
```
Cleaner: add an explicit `routing_provider` field to `GatewayRequest`, set it from
`active_provider_name` / `_provider` at the three consumers, and pin it with a test using
`qwen/qwen3-30b-a3b` under `lmstudio`.

## Warnings

### WR-01: The shielded open thread outlives the guard. SDK retries and executor-queued opens still hit the provider after `timed_out`

**File:** `backend/app/services/provider_gateway/dispatcher.py:193-217`
**Issue:**
`asyncio.shield(task)` means that when `timeout_at` fires, the worker thread keeps running.
`_close_late_stream` closes the stream only once `create()` finally returns. I drove this with a
0.2 s budget and a 0.6 s open: `TimeoutError` was raised at 0.2 s, and the thread ran on to 0.6 s
and was then closed.

Consequences:
- **Cloud (`max_retries=2`):** a header wait that outlives the guard makes the SDK re-send the full
  prompt up to twice more, each with a full budget. These are billable requests for a run that is
  already terminal.
- **Executor queueing:** `asyncio.to_thread` uses the default executor (`min(32, cpu+4)` threads
  with no `set_default_executor` anywhere). Every streaming drain already holds a thread from that
  pool (`agent_loop.py:588`). Under load an open can sit in the queue while its deadline, computed
  before the hop, runs down. If the run times out while the open is still queued, the shielded work
  item **still starts afterwards** and opens a real request that nobody will read.

**Fix:** Give the thread a cancellation signal, and make the in-thread attempt count unable to
outlive the guard:
```python
cancelled = threading.Event()
def _guarded_open(req):
    if cancelled.is_set():
        raise asyncio.CancelledError()  # never start a request for a dead run
    return _open_openai_family(req)
task = asyncio.ensure_future(asyncio.to_thread(_guarded_open, request))
try: ...
except BaseException:
    cancelled.set(); task.add_done_callback(_close_late_stream); raise
```
In addition, either build the open with `max_retries=0` and let the app-level retry own it, or cap
the client timeout at the remaining deadline so an SDK retry cannot start after the guard has fired.

### WR-02: A sub-agent killed by the new open guard records a blank error

**File:** `backend/app/services/task_service.py:303,901-907`
**Issue:** The 282 open guard raises a bare `TimeoutError()`. I confirmed that `str(e) == ''` by
driving `_open_off_loop`. The sub-agent's catch-all stores `error_msg = str(e)` and the summary
`f"Sub-agent failed: {e}"`. So:
- `runs.error` for the sub-run is `""`.
- The parent model is told `"Sub-agent failed: "` with no reason.

This failure path is new in 282, and it contradicts D-22's goal that a timeout names the model and
where to change the limit.

**Fix:** Classify the timeout explicitly before the generic arm:
```python
except asyncio.TimeoutError:
    final_status = "error"
    error_msg = (f"timed_out: {effective_model} did not answer within {_budget} s, its per-call "
                 "timeout. You can change it in the Model Registry.")
    summary = f"Sub-agent failed: {error_msg}"
```
Better still, reuse `run_producer._timed_out_error`. Also make the generic arm fall back to
`type(e).__name__` when `str(e)` is empty.

### WR-03: forced_emit treats a per-call timeout as a rung failure, so it re-runs the prompt and stacks budgets past the watchdog

**File:** `backend/app/services/forced_emit.py:506,540-550`
**Issue:** The new budget makes the OpenAI-family open raise `TimeoutError`. The ladder's
`except Exception` turns that into `provider_error` and descends to the next rung, which sends the
same prompt again with a fresh, full budget.

- **Local model:** a model that timed out because it is busy (D-19's own premise) gets the identical
  prompt re-queued on the same GPU, up to two more times. The previous rung's request may still be
  in flight on the server.
- **Watchdog math:** D-21's 1800 s ceiling rests on "no single silent call outlasts the 2400 s
  watchdog". A ladder that descends after a timeout is two or three silent calls in a row (up to
  5400 s), so the run can be ended as dead by the watchdog mid-ladder.
- **Labelling:** the failure is reported as `provider_error`, not as a timeout.

**Fix:** Treat a timeout as terminal for the ladder:
```python
except asyncio.TimeoutError:
    return _failure(emit_tier, provider, forced=False, truncated=False,
                    failure_override="timed_out",
                    input_tokens=ladder_in_tok, output_tokens=ladder_out_tok)
except Exception:
    ...  # unchanged descent
```
If `_failure` has no `timed_out` code yet, add one.

### WR-04: Lowering the ceiling silently drops previously valid env overrides, while the DB tier clamps the same values

**File:** `backend/app/config.py:889-895` (with `:150-152`, `:931-941`)
**Issue:** `_LLM_CALL_TIMEOUT_MAX_S` went from 3600 to 1800. The env parser still **drops**
out-of-range entries. An operator with `LLM_CALL_TIMEOUT_OVERRIDES=my-local=2400`, valid before 282,
silently falls back after upgrade to the static value or the default: 300 s, or 900 s for
self-hosted. That is an 8× cut, signalled only by a warning log.

The DB tier added in the same phase (D-08) **clamps** a stored value above 1800 to 1800. Its stated
reason is "the operator chose a long timeout, so the nearest legal one honours that". The two tiers
now treat the same input in opposite ways.

**Fix:** Clamp in the env parser as well. Keep rejecting only non-integers and values below 1:
```python
if val > _LLM_CALL_TIMEOUT_MAX_S:
    logger.warning("...%r=%d exceeds %d; using %d", model_id, val, _LLM_CALL_TIMEOUT_MAX_S, _LLM_CALL_TIMEOUT_MAX_S)
    val = _LLM_CALL_TIMEOUT_MAX_S
```

### WR-05: The Add-model Timeout field silently truncates decimal and exponent input into a different, possibly tiny, legal timeout

**File:** `frontend/src/components/admin/ModelRegistryTab.tsx:1499-1502,1519-1520`
**Issue:** `numOrUndef` uses `parseInt(s, 10)`. The field is `type="number"`, which accepts `e`
notation and decimals:
- `"1e3"` becomes `1`, so the model is saved with a **1-second** timeout. Every run then ends
  `timed_out`, which is the T-066-05 DoS the bound exists to prevent.
- `"900.5"` becomes `900`.

All of these pass the server's `[1, 1800]` check, so the operator gets no error and no hint. The
form deliberately drops client-side `min`/`max` so the server's sentence is shown. That makes it
more important that the client sends what was typed, not a different number.

**Fix:** Send exact integers only, and let anything else reach the server or show an inline error:
```ts
function intOrUndef(s: string): number | undefined {
  if (s.trim() === "") return undefined
  const n = Number(s)
  return Number.isInteger(n) ? n : NaN   // NaN → show "Timeout must be a whole number of seconds."
}
```

## Info

### IN-01: The Space-key handler relies on `preventDefault()` on keydown to stop the keyup click

**File:** `frontend/src/components/panel/PendingAskCard.tsx:667-678`
**Issue:** On a `<button>`, Space activates on **keyup**. The handler selects on keydown and calls
`preventDefault()`, then relies on that to stop `onClick`'s toggle. Not every engine suppresses the
keyup click when keydown is prevented; Firefox has historically not done so. Where it is not
suppressed, Space on an unselected chip selects it on keydown and then toggles it back off on keyup,
which breaks D-24's "Space selects only". I have not verified this in a real Firefox; jsdom /
user-event cannot show it.
**Fix:** Also handle `onKeyUp` for `" "` with `e.preventDefault()`, or set a ref flag on keydown that
makes the next `onClick` a no-op.

### IN-02: The full card ignores the shared `settled` flag on remount

**File:** `frontend/src/components/panel/PendingAskCard.tsx:313,343`
**Issue:** `markSettled` records answered/expired in the store, but `PendingAskCard` starts from
local `useState("pending")`. Since 282, the chat card unmounts whenever the panel opens and remounts
when it collapses. If an ask is still in the slice after the panel card reached 404/409/expired, the
remounted chat card offers `Send Answer` again with an empty draft, and a no-`created_at` ask also
restarts its countdown at full length. Pre-282 the chat card was mounted at the same time and had
the same staleness, so this is not a regression in kind.
**Fix:** Seed `state` from `useAskSettled(tool_call_id)` (as `expired`) when the store already knows.

### IN-03: The timed-out text says "did not answer" even when the model streamed a partial answer

**File:** `backend/app/services/run_producer.py:72-78`
**Issue:** A drain-phase timeout, where the model was streaming but the total passed the budget,
renders "{model} did not answer within N s". The model did answer, just not completely.
**Fix:** "{model} did not finish within N s, its per-call timeout."

### IN-04: A tombstone re-add keeps the old row's timeout when the Timeout field is blank

**File:** `backend/app/api/admin.py:1385-1413`
**Issue:** For a removed model, the conflict arm `SET`s only the present columns. A blank Timeout
therefore leaves the tombstone's previous `llm_call_timeout_seconds` in place, possibly a pre-282
value above 1800 that the resolver will clamp. Meanwhile the form's placeholder promises the
default (300/900).
**Fix:** In the tombstone arm, write `NULL` for every `_ADD_MODEL_CAP_COLUMNS` entry that the body
omits.

## Fix log

Fixed 2026-10-15. Scope was Critical + Warning only; IN-01..IN-04 were left as they are.
Each finding was first driven RED by a unit test that failed on `3268b6228` because of the
defect. The fix came after that, and then the test was run green. Backend pins are in
`backend/tests/unit/test_282_review_fixes.py`; the WR-05 pin is in `ModelRegistryTab.test.tsx`.

| Finding | Outcome | Commit | What the RED test showed before the fix |
|---|---|---|---|
| CR-01 | **fixed** | `817cc2b3b` | A request with registry vendor `openrouter` and LM Studio routing got `max_retries` 2, not 0. So did `open_stream("ollama", …)` for an id the registry calls `deepseek`. |
| WR-01 | **partially fixed** (rest deferred) | `ff769333e` | With the thread hop held 0.3 s and a budget of 0.05 s, the open still started after `TimeoutError`. |
| WR-02 | **fixed** | `2cfae5911` | `runs.error` was `""` for a sub-agent whose open timed out. An exception with an empty message also recorded `""`. |
| WR-03 | **fixed** (label deferred) | `5d35ea1c9` | A `force_strict` ladder sent the prompt 3 times after a `TimeoutError`. |
| WR-04 | **fixed** | `40c51678e` | `my-local=2400` was dropped from the parsed overrides instead of clamped to 1800. |
| WR-05 | **fixed** | `4ad7ad089` | The Add form accepted `1e3` and `900.5` and sent `1` and `900`. |

**CR-01.** `GatewayRequest` has a new `routing_provider` field. `open_stream` stamps it from its
own first argument, which is the routing provider at all three callers: agent_loop's
`user_settings.active_provider`, task_service's `_provider`, and forced_emit's target provider,
whose endpoint forced_emit injects. Both OpenAI-family adapters now pick `max_retries` through
one method, `GatewayRequest.retries_provider()`. It checks routing provider, then
`user_settings.active_provider`, then the adapter provider. `active_provider_name` still keys
the `<think>` and usage normalisation, as before. The self-hosted predicate is still only
`_SELF_HOSTED_PROVIDERS`. With this fix, the Model Registry help line ("Local models … are tried
once") is true for the unregistered slugs in the table above.

**WR-01. Fixed:** a `threading.Event` is set when the guard exits. If the open is still queued
in the executor at that point, it raises `_OpenAbandoned` and never calls `create()`. So no
request is started for a run that has already ended. **Deferred:** an open that is already
inside `create()` when the guard fires still runs to the end, including the SDK's own retries.
After CR-01 this affects cloud providers only (`max_retries=2`), because self-hosted now gets 0
retries. Stopping an SDK retry that is already in flight needs a new mechanism, for example an
httpx request hook on the client that checks the flag. The only other option is to drop cloud
retries on this path, which reverses D-19's fast retry on 429/5xx. Both choices are bigger than
a review fix. Capping the client timeout at the remaining budget was also considered, and not
done: the retries start only after the guard fires, so a cap does not stop them. Re-open when
cloud spend after a `timed_out` run is observed, or when the client builder next changes.

**WR-02.** The open in `_stream_one_iteration` now attaches its budget to the `TimeoutError`
(`exc.budget_s`). `run_task_sub_agent` has its own `except TimeoutError` arm, which records
`run_producer._timed_out_error(budget, step, model)`. That is the same sentence the Deep run
records, so no new copy was written. The generic arm now falls back to `type(e).__name__` when
`str(e)` is empty. The budget is carried on the exception rather than looked up again, because
`test_282_local_timeout_default` pins exactly one `get_per_call_timeout_async` call site in
`task_service.py`.

**WR-03.** `except TimeoutError` now comes before the per-rung `except Exception`. It returns
the `_failure` floor at once and passes the ladder token totals explicitly (Phase 256 S-5). The
`_failure` docstring records that this is now a second call site. The 282 test that pinned the
old behaviour (`test_forced_emit_descends_on_an_open_guard_timeout`, which expected 2 calls) was
renamed `…ends_the_ladder…` and now expects 1 call. **Deferred: the label.** The failure value
is still `provider_error`, not `timed_out`. A new value would need a new `emit_cause` kind, its
sentence and Check line, and a check of every consumer of `failure`: phase_types, harness_engine,
publish_service, eval_runner, ingest_enrich. The behaviour (no re-send, no stacked budgets) is
the defect, and it is fixed. The step still reads "the model provider returned an error. Check
that this step's model provider is reachable."

**WR-04.** The env parser clamps a value above 1800 to 1800 and logs it. Values below 1 and
non-integers are still dropped.

**WR-05.** A non-blank Timeout must match `^-?\d+$`. Anything else stops in the form's
`role=alert` with "Timeout must be a whole number of seconds." and nothing is sent. The sign is
allowed so that 0 and -5 still reach the server's range sentence. A blank field still sends no
key. The count-gate pin for `ModelRegistryTab.test.tsx` was raised from 37 to 39 (measured,
39/39) in the same commit.

**Gates (2026-10-15):**
- `pytest tests/unit -k 282`: 101 passed.
- `check-backend-unit-baseline.cjs`: 71 failed, 7546 passed, 0 errors. The gate passed at the
  71 ceiling.
- `ModelRegistryTab.test.tsx` plus its a11y suite: 52/52 passed.
- `tsc -p tsconfig.app.json`: 103 lines, unchanged, none in `ModelRegistryTab.tsx`.
- No public API model changed, so the OpenAPI snapshot was not regenerated.

---

_Reviewed: 2026-10-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
