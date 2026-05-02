---
phase: 059-sse-architecture-refactor
verified: 2026-05-02T12:00:00Z
status: human_needed
score: 3/4 must-haves verified (1 architecturally present but automated evidence is vacuous)
overrides_applied: 0
re_verification: null  # The pre-existing 059-VERIFICATION.md was a manual checklist (D-059-08 deliverable), not a prior verification report — this is the first goal-backward verification of phase 059
gaps: []
human_verification:
  - test: "Live two-tab DevTools cancellation latency check (procedure already documented in the phase's manual checklist appendix below)"
    expected: "Within 1 second of closing Tab A mid-stream, backend logs show CancelledError on the agent task and zero further LLM API requests fire"
    why_human: "The automated test (test_agent_task_cancels_on_disconnect) is structurally incapable of exercising mid-stream cancellation — httpx ASGITransport buffers the response and does not deliver `http.disconnect` to the ASGI app on context-manager exit. The producer runs to natural completion before disconnect; the count_after==0 assertion is trivially true. Empirical proof: instrumenting asyncio.Queue.put shows all 5 slow-chunk delta puts complete BEFORE t_disconnect fires, plus the post-stream done/stream_end/SENTINEL puts also fire at t_disconnect. The architectural mitigations (sse-starlette EventSourceResponse, asyncio.Queue, agent_runner producer task, shielded persist, CancelledError raise) are all WIRED correctly in code, but Success Criterion 3 (cancellation within 1s under real disconnect) has only structural evidence, not behavioral evidence. Human runbook in 059-VERIFICATION.md (manual checklist, lines 32-118) is the only path to confirm CONCUR-02 behaviorally."
  - test: "Stop button regression check — verify partial-response persistence still works when the user clicks Stop mid-stream"
    expected: "Clicking Stop mid-stream causes the assistant message to persist whatever content was generated up to that point; no further LLM tokens generated"
    why_human: "Same mechanism as tab-close (frontend AbortController triggers HTTP connection abort → ASGI disconnect → producer cancelled → shielded persist). The wiring is correct but the automated test does not exercise the abort path with real network semantics. Manual confirmation needed via the chat UI."
---

# Phase 059: SSE Architecture Refactor Verification Report

**Phase Goal:** The SSE handler exits cleanly on client disconnect within 1 second and the agent loop is cancelled, eliminating wasted LLM tokens after tab close, F5, or network drop.
**Verified:** 2026-05-02
**Status:** human_needed
**Re-verification:** No — initial verification (the file at `059-VERIFICATION.md` produced by Plan 03 is a manual two-tab DevTools checklist deliverable, not a verifier report; this report supersedes it as the top-level assessment and treats the checklist as one input)

---

## Goal Achievement

### Observable Truths

| #   | Truth (from ROADMAP Success Criteria)                                                                                                                                       | Status                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1   | Streaming endpoint uses `asyncio.Queue` producer/consumer pattern: agent loop runs as background task; SSE handler only consumes the queue and yields events.               | VERIFIED                | `backend/app/api/threads.py:520` declares `queue: asyncio.Queue = asyncio.Queue(maxsize=100)`. Line 522 defines `async def agent_runner()` (the background producer). Line 1810 creates the task: `task = asyncio.create_task(agent_runner())`. Lines 1812-1836 define `event_consumer()` which awaits `queue.get()` in a `while True` loop and yields `{"data": payload}` to sse-starlette. 41 `await queue.put(...)` calls confirmed (40 producer puts + 1 sentinel).                                                                                                                                                          |
| 2   | Custom `SSEStreamingResponse` subclass replaced by `sse-starlette`'s `EventSourceResponse` with `request.is_disconnected()` polling for active disconnect detection.        | VERIFIED (with caveat)  | `backend/app/responses.py` is DELETED (confirmed `[ ! -f ... ]` check). `backend/app/api/threads.py:11` imports `from sse_starlette import EventSourceResponse`. Line 1838 returns `EventSourceResponse(event_consumer(), ping=15)`. **Caveat:** sse-starlette 2.4.1 uses `await receive()` listening for ASGI `http.disconnect` (see `sse_starlette/sse.py:176-182` `_listen_for_disconnect`), NOT `request.is_disconnected()` polling. The criterion's mention of `is_disconnected()` reflects an older Starlette pattern; the canonical sse-starlette pattern is event-driven, which is functionally equivalent (and superior). |
| 3   | On client disconnect (tab close / F5 / network drop), agent task receives `CancelledError` within 1 s; no further LLM API calls fire; `CancelledError` is re-raised after cleanup. | UNCERTAIN (BEHAVIORAL)  | **Structural evidence: PASS.** `threads.py:1804-1805` re-raises CancelledError after `asyncio.shield(_shielded_persist())` (the prior `pass` is gone). Sentinel push at line 1807 in outermost finally. `event_consumer` finally calls `task.cancel()` then awaits the task, line 1828-1836. **Behavioral evidence: NOT PROVEN.** See "Behavioral Spot-Check" below — the automated test (`test_agent_task_cancels_on_disconnect`) does not actually trigger mid-stream cancellation under httpx ASGITransport; the producer runs to natural completion before t_disconnect, so the assertion is trivially true.        |
| 4   | Stop button (existing v2.4 behavior) and partial-response persistence via `asyncio.shield` continue to work — STREAM-01/STREAM-03 do not regress.                          | UNCERTAIN (BEHAVIORAL)  | **Structural evidence: PASS.** `threads.py:1799-1803` wraps `_persist_assistant_message` in `asyncio.shield(...)`. Frontend `useMessages.ts` Stop button calls `abortControllerRef.current?.abort()` (line 39-40) — same mechanism that triggers ASGI disconnect. **Behavioral evidence: NOT EXERCISED.** No automated test for Stop button behavior; the smoke test (`test_normal_stream_unchanged`) covers happy-path wire format only. STREAM-01 is not defined in REQUIREMENTS.md (likely a roadmap-only label); STREAM-03 is in Future Requirements (deferred). |

**Score:** 3/4 truths verified; 2 of those (truths 3 and 4) have only structural verification, not behavioral.

---

### Required Artifacts

| Artifact                                                | Expected                                                                              | Status              | Details                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/requirements.txt`                              | sse-starlette==2.4.1 + pytest-timeout>=2.4.0 pinned                                   | VERIFIED            | Line 2: `sse-starlette==2.4.1`. Line 20: `pytest-timeout>=2.4.0`. `venv/Scripts/python -c "import sse_starlette; print(sse_starlette.__version__)"` reports `2.4.1`.                                                                |
| `backend/app/api/threads.py`                            | Refactored `send_message` with queue + producer + consumer + EventSourceResponse      | VERIFIED            | All structural greps pass: 0 `yield f"data:`, 0 `from app.responses`, 0 `stop_event`, 1 `asyncio.Queue(maxsize=100)`, 1 `EventSourceResponse(event_consumer(), ping=15)`, 1 `asyncio.create_task(agent_runner`, 1 `await queue.put(None)` sentinel, 1 `except CancelledError: raise` (the shielded-persist site).         |
| `backend/app/responses.py`                              | DELETED                                                                               | VERIFIED            | File does not exist. `import app.responses` raises ModuleNotFoundError. No surviving importers in `backend/app` or `backend/tests`.                                                                                                |
| `backend/tests/integration/test_059_disconnect.py`      | Two passing tests asserting Invariants I1-I4                                          | VERIFIED (artifact) — see CR-03 caveat in spot-check section | File exists (259 lines). Two tests collected, both pass green: `test_agent_task_cancels_on_disconnect` and `test_normal_stream_unchanged`. Helpers (`LLMCallCounter`, `_slow_chunks`, `_make_counted_chat`, `_read_then_disconnect`) all importable. Combined run with 058's regression test exits 0 (3/3 pass in 5.77s). |
| `.planning/phases/059-sse-architecture-refactor/059-VERIFICATION.md` (manual checklist) | Manual two-tab DevTools timing checklist mirroring 058 format (D-059-08 deliverable) | VERIFIED (then superseded) | Plan 03 created the checklist as the user runbook for 059 (153 lines, mirrors 058's section structure). This file is now overwritten by the present verification report; the runbook content is preserved in the appendix below. |

---

### Key Link Verification

| From                                              | To                                                | Via                                                                          | Status     | Details                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/app/api/threads.py`                      | `sse_starlette.EventSourceResponse`               | `from sse_starlette import EventSourceResponse` + `EventSourceResponse(event_consumer(), ping=15)` return | WIRED      | Line 11 import + line 1838 return statement.                                                                                                                                                                                                                                  |
| `event_consumer` (consumer finally)               | `agent_runner` task                               | `task.cancel()` on disconnect; `await task` with `except CancelledError: pass` | WIRED      | Lines 1828-1833. Consumer finally cancels producer task and awaits it; the structural wiring of "consumer disconnect → producer cancellation" is correct. (Whether the consumer's finally is actually triggered by ASGI http.disconnect under httpx ASGITransport is the empirical question — see spot-check.) |
| `agent_runner` outer finally                      | queue                                             | `await queue.put(None)` sentinel                                             | WIRED      | Line 1807 — the LAST queue op, in outermost finally. **Risk noted in CR-01:** under back-pressure when consumer has already exited, `await queue.put(None)` could itself block (queue maxsize=100); however this only matters if the queue is full at cancel time, which the current test scenario does not exercise. |
| `agent_runner` inner finally                      | `_persist_assistant_message`                      | `asyncio.shield(_shielded_persist())` wrapped in `try/except CancelledError: raise` | WIRED      | Lines 1799-1805. Shielded persist defined and invoked; CancelledError re-raised post-shield.                                                                                                                                                                                  |
| Frontend `useMessages.ts` Stop button             | Backend SSE disconnect path                       | `abortControllerRef.current?.abort()` → HTTP connection abort → ASGI disconnect | WIRED (structurally) | Frontend uses standard fetch + AbortController; the abort closes the connection, which uvicorn/Starlette translate to `http.disconnect`. Same wiring path as tab close — if the cancellation contract works for tab close, it works for Stop. (No phase 059 test for Stop specifically.) |

---

### Data-Flow Trace (Level 4)

| Artifact                                                     | Data Variable                  | Source                                                                | Produces Real Data                                          | Status                |
| ------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------- |
| `agent_runner` producer in `threads.py`                      | SSE event payloads             | `create_adaptive_streaming_chat(...)` LLM stream + tool execution paths | YES (untouched by refactor)                                 | FLOWING               |
| `event_consumer` in `threads.py`                             | `payload = await queue.get()`  | `agent_runner` puts                                                   | YES (in production); in test, real puts arrive              | FLOWING               |
| `EventSourceResponse(event_consumer(), ping=15)`             | SSE wire bytes                 | `event_consumer` yields `{"data": payload}` dicts                     | YES — sse-starlette frames as `data: {payload}\n\n`         | FLOWING               |
| Disconnect signal: `await receive()` in sse-starlette        | `http.disconnect` ASGI message | uvicorn / Starlette transport layer                                   | YES in production; **NO under httpx ASGITransport in tests** | DISCONNECTED IN TESTS |

The last row is the critical Level-4 finding: in production (uvicorn), `http.disconnect` flows from the transport to sse-starlette's `_listen_for_disconnect` and the cancellation chain runs. Under httpx ASGITransport, the test never delivers that message — the producer runs to natural completion. So the data path "real client disconnect → producer CancelledError" is wired in code but not exercised by the test suite.

---

### Behavioral Spot-Checks

| Behavior                                                                          | Command                                                                                                                                                | Result                                                                  | Status                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------- |
| App imports cleanly with refactored threads.py                                    | `cd backend && venv/Scripts/python -c "from app.api.threads import router; from app.main import app"`                                                  | exit 0; "app loads OK"                                                  | PASS                                  |
| sse-starlette 2.4.1 importable                                                    | `venv/Scripts/python -c "import sse_starlette; print(sse_starlette.__version__)"`                                                                      | `2.4.1`                                                                 | PASS                                  |
| `responses.py` is gone                                                            | `[ -f backend/app/responses.py ]`                                                                                                                      | false (file deleted)                                                    | PASS                                  |
| 058 regression guard intact                                                       | `pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse -v`                                                             | PASSED                                                                  | PASS                                  |
| 059 disconnect test passes (D-059-06 merge gate)                                  | `pytest tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect -v`                                                            | PASSED in ~3s                                                           | PASS (artifact); see CR-03 below      |
| 059 smoke test (wire format unchanged)                                            | `pytest tests/integration/test_059_disconnect.py::test_normal_stream_unchanged -v`                                                                     | PASSED in <1s                                                           | PASS                                  |
| **CR-03 reproduction**: Does the disconnect test actually exercise cancellation?  | Instrument `asyncio.Queue.put`; observe whether producer puts continue AFTER `t_disconnect` (cancelled) or all puts complete by t_disconnect (natural). | **All slow-chunk puts complete before t_disconnect; final `done`, `stream_end`, and SENTINEL puts fire at t_disconnect (natural completion).** | FAIL — test passes for wrong reason   |

#### CR-03 Reproduction Detail

Instrumented `asyncio.Queue.put` during the test run and recorded:

```
t_disc=+3.031s  (the moment _read_then_disconnect returns — proxy for "client disconnect")
puts BEFORE disconnect: 5
  iteration_start +1.516s
  delta +1.828s   (chunk 1)
  delta +2.125s   (chunk 2)
  delta +2.422s   (chunk 3)
  delta +2.719s   (chunk 4)
puts AFTER disconnect: 4
  delta +3.031s        (chunk 5 — the LAST slow chunk)
  done +3.031s         (post-stream done event — agent_runner finished naturally)
  stream_end +3.031s   (post-stream end event — agent_runner finished naturally)
  SENTINEL +3.031s     (outer finally — agent_runner exit)
```

Diagnosis:
- The test uses `count=5` slow chunks at 0.3s each = 1.5s of streaming + post-stream overhead.
- httpx `ASGITransport` buffers the entire ASGI response into `body_parts` before returning a Response object (httpx 0.27.x). `client.stream(...).aiter_lines()` reads from a BUFFERED body, not a live ASGI stream.
- `_read_then_disconnect` returns when the FIRST `data:` line is observable in the buffered output. The agent_runner has already fully completed by then; the `await receive()` in sse-starlette's `_listen_for_disconnect` never gets a `http.disconnect` message because the response completed naturally.
- `counter.count_after(t_disconnect) == 0` is trivially true: `_make_counted_chat` is invoked once per agent ITERATION, the test only runs ONE iteration, so the only LLM call is recorded at iteration_start (+1.516s). After t_disconnect, no further iterations happen because the slow stream emitted `done` — same as if cancellation had worked, but for the wrong reason.
- The I4 assertion (`role=='assistant'` insert exists) succeeds via the NORMAL completion path (`_persist_assistant_message` invoked from the inner try block on stream completion), NOT via the shielded path that this phase's mitigation is supposed to exercise.

This means **Success Criterion 3 has structural code evidence but no behavioral test evidence**.

---

### Requirements Coverage

| Requirement | Source Plan(s)                | Description                                                                                                            | Status                | Evidence                                                                                                                                                                                                                                                                                                       |
| ----------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CONCUR-02   | 059-01-PLAN, 059-02-PLAN, 059-03-PLAN | When the SSE client disconnects (tab close, F5, network drop), the backend agent task is cancelled within 1 second — no wasted LLM tokens. | NEEDS HUMAN           | Architectural mitigation is wired (queue + EventSourceResponse + shielded persist + CancelledError raise). REQUIREMENTS.md is already marked `[x]`. The automated D-059-06 merge gate is structurally inadequate (CR-03). The phase's own manual two-tab DevTools checklist (now in the appendix below) is the only path to confirm the 1-second behavior with real network semantics. |

No orphaned requirements: REQUIREMENTS.md maps only CONCUR-02 to phase 059, and all three plans declare CONCUR-02 in their `requirements:` frontmatter.

---

### Anti-Patterns Found

| File                                                       | Line(s)        | Pattern                                                                                                          | Severity       | Impact                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/app/api/threads.py`                               | 1807           | `await queue.put(None)` in outer finally on a bounded queue — could block under back-pressure if consumer exited | WARNING        | CR-01 from code review. In real disconnect, consumer breaks `while True` then awaits the task; producer's outer finally runs `await queue.put(None)` on a queue the consumer is no longer draining. If queue is full at cancel time, this put receives a re-raised CancelledError and never enqueues; sentinel ordering becomes dependent on cancel timing. Not a current-test failure but architectural fragility. |
| `backend/app/api/threads.py`                               | 729-732        | `try/except Exception: logger.error` in `_persist_assistant_message` swallows persist failures silently           | WARNING        | CR-02 partial. Failures of the shielded persist log-and-return; the outer finally proceeds as if persist succeeded. Acceptable for graceful degradation but invisible to the cancellation gate.                                                                                                                                                                  |
| `backend/app/api/threads.py`                               | 1330           | `loop = asyncio.get_event_loop()` (deprecated since 3.10)                                                         | WARNING        | CR review WR-04. Will emit DeprecationWarning on 3.12+ and may raise in future Python. Local fix: use `asyncio.get_running_loop()`.                                                                                                                                                                                                                              |
| `backend/app/api/threads.py`                               | 1132, 1201, 1521, 1565, 1566, 1609 | `asyncio.create_task(...)` with no reference retention                                                | WARNING        | WR-05. Audit-log and memory-write fire-and-forget tasks may be GC'd mid-execution; recommended to use `BackgroundTasks` or a module-level task set. Not introduced by this phase but co-located in the modified function.                                                                                                                                          |
| `backend/tests/integration/test_059_disconnect.py`         | (entire file)  | Test architecture cannot exercise the contract it claims to test                                                  | BLOCKER (CR-03) | Test passes for the wrong reason. See behavioral spot-check above. Mitigation: convert to a uvicorn-in-thread harness OR switch to a direct asyncio.Task cancellation harness that bypasses ASGI; OR fold the assertion into the manual checklist and downgrade the automated test to a wire-format/regression smoke. |
| `backend/tests/integration/test_059_disconnect.py`         | 27-37          | Cross-imports private symbols from `test_058_concurrency.py`                                                      | INFO (IN-04)   | Coupling tests via `_`-prefixed helpers. Documented as deliberate Option 1 deferral; with 059 already being the second consumer, extraction to `_sse_helpers.py` is overdue but non-blocking.                                                                                                                                                                  |
| `backend/tests/integration/test_059_disconnect.py`         | 43-62          | Autouse fixture mutates sse-starlette private module state                                                        | INFO (WR-07)   | `AppStatus.should_exit_event = None` is a workaround for sse-starlette's per-test loop-binding issue. Fragile to sse-starlette version bumps; pinned to ==2.4.1 mitigates.                                                                                                                                                                                       |

**Severity calibration:** CR-03 is BLOCKER for the GOAL (CONCUR-02 behavioral confirmation), not for the artifact (the test passes and the architectural code is correct). The recommended resolution is a human verification pass against the manual checklist; the test does not need to be rewritten before the phase can be considered substantially complete, but the verification status MUST reflect that the automated gate does not cover the cancellation contract.

---

### Human Verification Required

#### 1. Live two-tab DevTools cancellation latency check

**Test:** Follow the manual checklist procedure preserved in the appendix below — run uvicorn locally, open the chat UI, send a long-response prompt, close the tab after ~2 seconds of streaming, and inspect the backend log.
**Expected:** Within 1 second of tab close, the backend log shows `CancelledError` on the agent_runner task and zero further LLM API requests fire.
**Why human:** The automated test is structurally incapable of triggering mid-stream cancellation under httpx ASGITransport (CR-03 reproduction above). Only a real HTTP server + real client tab close exercises the disconnect path that sse-starlette's `_listen_for_disconnect` listens on. This is the canonical CONCUR-02 acceptance criterion as written in REQUIREMENTS.md.

#### 2. Stop button regression check

**Test:** Send a long-response prompt; click Stop in the chat UI before the stream finishes; verify the assistant message persists with whatever content was generated, the Stop label flips appropriately, and no further tokens stream after the click.
**Expected:** Partial assistant message visible in the thread; backend log shows agent_runner cancelled; the message row in `messages` table has `role='assistant'` and the partial content.
**Why human:** Frontend AbortController triggers connection abort which translates to ASGI disconnect — same path as tab close. No automated test covers the Stop button specifically. The `useMessages.ts` Stop wiring is structurally present (line 38-41) but the end-to-end behavior under the new backend architecture must be confirmed in the UI.

---

### Gaps Summary

There are **no missing artifacts and no missing wiring**. All four ROADMAP success criteria have structural code evidence:

1. asyncio.Queue producer/consumer pattern: present and correct.
2. EventSourceResponse with event-driven disconnect detection (sse-starlette's idiomatic pattern, equivalent to `is_disconnected()` polling but more efficient): present and correct.
3. CancelledError raise after shielded persist + queue sentinel + consumer cancels producer: present and correct.
4. Stop button + shielded persist wiring: present and correct.

The **gap is in evidence of behavior**, not in code. The automated D-059-06 merge gate test passes but does not actually exercise the cancellation contract because httpx ASGITransport buffers responses and never delivers `http.disconnect` to the ASGI app on context-manager exit. The plan-03 SUMMARY acknowledges this in its "Plan-vs-reality mismatch" section but treats it as a Rule 1 deviation rather than a verification gap.

The phase team correctly anticipated this by producing a manual two-tab DevTools checklist (D-059-08 deliverable) — this is the binding evidence path for CONCUR-02. The status `human_needed` reflects that the manual checklist must be EXECUTED by a human against a running uvicorn + browser, not just published.

**Recommendation:** Either (a) execute the manual checklist now and record results in the appendix, or (b) plan a Phase 059.5 to convert the automated test to a uvicorn-in-thread harness so future regressions of the cancellation contract are caught in CI. Option (a) is sufficient to advance to Phase 060.

---

## Appendix — Original Manual Verification Checklist (preserved from 059-VERIFICATION.md, plan-03 deliverable D-059-08)

The following is the human runbook produced by Plan 03 as the binding manual verification for CONCUR-02. It is the canonical procedure to confirm Success Criterion 3 (1-second cancellation) behaviorally. Until this checklist is executed and results recorded, the phase status is `human_needed`.

### CI Gate (Automated — Originally Claimed Binding)

```bash
cd backend && venv/Scripts/python.exe -m pytest \
  tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect -v
```

This test passes (exit 0) — but per CR-03 above, it does not actually exercise mid-stream cancellation. Treat it as a wire-format and structural regression guard, not as proof of the 1-second cancellation contract.

### Manual Two-Tab DevTools Timing Checklist (BINDING for CONCUR-02)

Estimated time: 2 minutes.

#### Setup

- [ ] Backend running: `uvicorn app.main:app --reload` (single worker — do NOT use `--workers N`)
- [ ] Frontend running: `npm run dev` or equivalent
- [ ] Logged in as a test user with at least one thread containing several messages
- [ ] Backend terminal/log window visible so `CancelledError` lines and assistant-persist log lines can be observed in real time

#### Procedure

**Tab A — Start a streaming response and disconnect:**

1. Open the application in Tab A.
2. Open Chrome / Edge / Firefox DevTools → Network tab → filter by `XHR` or `Fetch`.
3. Open the backend's terminal/log window so you can watch for `CancelledError` log lines as they arrive.
4. In Tab A, send a message that will trigger a long LLM response (e.g. "Write a 1000-word essay about asyncio cancellation semantics").
5. Observe the SSE stream begin — DevTools shows the `POST /threads/{id}/messages` request as `(pending)` with a streaming response visible in the Response panel.
6. After ~2 seconds of streaming, **close the tab** (Cmd+W / Ctrl+W). Note the wall-clock time of the close (or use a stopwatch).

**Backend log inspection — measure cancellation latency:**

7. Switch to the backend's terminal.
8. Wait up to 1 second after the tab close.
9. Search the log output for:
   - A `CancelledError` traceback (the producer task being cancelled), OR
   - The assistant-message persist log line (the shielded DB write completing).
10. Confirm that within 1 second of the tab close, the LLM API request count stops incrementing (no further `openai`/`anthropic`/`openrouter` calls fire).

#### Expected Result

| Metric                                              | Pre-059 (broken)                        | Post-059 (fixed)                          | Your result   |
| --------------------------------------------------- | --------------------------------------- | ----------------------------------------- | ------------- |
| Time from tab close to `CancelledError` in logs     | Variable (sometimes never)              | < 1 second                                | [fill in]     |
| New LLM API calls fired AFTER tab close             | Up to N more (one per agent iteration)  | 0                                         | [fill in]     |
| Assistant message persisted in `messages` table     | May or may not (race condition)         | Yes (shielded persist always completes)   | [fill in]     |

#### Pass Criteria

- [ ] Within 1 second of closing Tab A, the backend log shows `CancelledError` (or the producer's `finally` cleanup messages) and ceases all LLM calls.
- [ ] Querying `messages` for the test thread shows an assistant row was persisted (even though the client never received the full response).
- [ ] No `OSError` or transport-error tracebacks appear in the log (sse-starlette handles disconnect cleanly; if you see OSError tracebacks, that's a regression — the deleted `_SilentSSEIterator` was suppressing them and a re-introduction would mask real bugs).

#### Fail Action

If cancellation propagation exceeds 1 second OR new LLM calls keep firing after tab close:

1. Confirm `backend/app/responses.py` is deleted.
2. Verify `grep -A1 "except asyncio.CancelledError" backend/app/api/threads.py | grep -q "raise"` returns truthy.
3. Verify `grep -c "EventSourceResponse(event_consumer(), ping=15)" backend/app/api/threads.py` returns `1`.
4. Re-run the automated CI gate test to confirm whether the test environment also reproduces the regression.
5. File a 059-blocker if the automated test also regresses.

#### Notes (Pitfall 5 caveat)

> The persisted assistant message in Postgres may have characters beyond what the client saw on screen before the tab closed. CONCUR-02 explicitly accepts this — the shielded persist captures whatever `full_content` had accumulated by the time cancellation landed, which can include tokens that were buffered in the queue but never flushed to the client.

---

_Verified: 2026-05-02_
_Verifier: Claude (gsd-verifier)_
