---
phase: 067-frontend-streaming-ux-fix
status: partial
reviewed_at: 2026-05-07T15:45:00Z
project_level_approval: approved
---

# Phase 067 — HUMAN-UAT Scoreboard

## Summary

Phase 067 closed the 5-issue carry-forward dossier (UX-067-01..05) from Phase 066's
live UAT and re-ran Phase 066 Plan 05 Task 2 protocol verbatim to attempt SC#6 closure.

**Outcome:**
- All five UX fixes (UX-067-01..05) verified live via Chrome MCP — green.
- SC#6 closure is **partial**: frontend banner + Resume button + DB lifecycle state all green, but the LangSmith ChatOpenAI sub-trace still shows `GeneratorExit` at `run_helpers.py:1680` — the exact line the D-066-11 invariant requires absent. Escalated as **Gap-007**.

Real-time first-paint of streaming agent events restored; "Saving response…"
fallback removed; tool-call iteration boundaries surfaced via "Step N" gradient
dividers; backend Redis-consumer cancellation logging cleaned up; obsolete
`RUN_HARD_TIMEOUT_SECONDS` stopgap confirmed already absent from operator-facing surfaces.

## Pre-flight Environment

| Property | Value |
|----------|-------|
| Frontend | http://localhost:5173/ — UP |
| Backend | http://localhost:8000/health — UP, Redis: ok |
| Test login | fhdmrd@gmail.com / 123456 |
| Active model (LLM_MODEL env default) | `gpt-5.4` |
| `LLM_CALL_TIMEOUT_OVERRIDES` (during SC#6 protocol) | `gpt-5.4=10` (reverted post-test) |

## Success Criteria Scoreboard

| SC | Description | Status | Evidence |
|----|-------------|--------|----------|
| UX-067-01 | Real-time first-paint of streaming agent events (no manual refresh) | green | Chrome MCP: run `213740c9-fa29-423d-be00-5ca1d16653f2` — first SSE delta visible (`Step 1 — Running code`) within ~1s of submit; placeholder + streaming text rendered progressively. |
| UX-067-02 | "Saving response…" never appears mid-stream | green | Chrome MCP `evaluate_script` `Array.from(document.querySelectorAll('span.italic')).map(e=>e.textContent).filter(t=>t.includes('Saving'))` returned `[]` across 4 separate runs spanning the full streaming lifecycle (initial paint, mid-stream, terminal flip). |
| UX-067-03 | F5 mid-stream reattaches via replay-tail; refresh is recovery, not workaround | green | Chrome MCP: F5 fired during clockmaking essay run `1ddd4bda-38e6-41c3-a6f4-94e1adc7da46` at ~T+17s (textLen=3123 streaming). Post-refresh thread navigation rendered the full ~9000-char essay with NO duplicate assistant bubbles. |
| UX-067-04 | Tab refresh produces no `redis.exceptions.TimeoutError` traceback in backend log | green | uvicorn terminal scrollback after F5 during Astrid lighthouse run `566d1583-4db5-43d5-89af-df1f4bc19e7a`: zero `redis.exceptions.TimeoutError` lines, zero `Traceback (most recent call last)` lines from `runs.py` xread paths. The new `logger.info(...)` line is filtered by default app log level (WARNING) but the negative evidence — absence of forced-traceback `logger.exception()` output — confirms Plan 067-03's `RedisTimeoutError` handler is firing. |
| UX-067-05 | Multi-iteration agent runs surface "Step N" iteration-boundary dividers | green | Chrome MCP: run `e59815c8-a2e6-4778-9c01-d9826ba9a91a` ("ostrich" multi-iteration prompt) — `document.querySelectorAll('[data-testid="iteration-divider"]').length` returned 1; divider text "Step 2"; `data-iteration` attribute = "1"; first child of tool-call panel was NOT an iteration-divider (Pitfall 4 invariant — no divider above first iteration). Screenshot: `uat-evidence-step2-divider.png`. |
| SC#6 (Phase 066 closure) | Synthetic per-call timeout produces banner + Resume + clean LangSmith trace | **partial** | Frontend (✓): banner "Agent reached time limit" + Resume button rendered via Chrome MCP (run `7558735c-3a2f-446f-b678-2c735be91871`). Resume click re-POSTed → new run `cf9caaee-35ec-489e-b1d4-04d6ce96ef2c`. Supabase (✓): `runs.status='timed_out'`, `runs.error='timed_out: 10s per-call deadline exceeded at iteration 0 (model=gpt-5.4)'`, `started_at`/`completed_at` populated. Screenshot: `uat-evidence-sc6-banner-resume.png`. **LangSmith (✗):** sub-trace `f40572ae-61a3-4cfd-9c19-fe88e9feaed8` exception column shows `GeneratorExit` at `run_helpers.py:1680` (`yield from self.__ls__gen__`) — exact line D-066-11 invariant requires absent. See Gap-007. |

## Evidence detail

### UX-067-01 + 02 + 03 + 05 (Chrome MCP runs)

| Run | Purpose | run_id | Result |
|-----|---------|--------|--------|
| Run 1 | Multi-step Python (single iteration) | `213740c9-fa29-423d-be00-5ca1d16653f2` | ✓ first-paint, no Saving response, completed cleanly |
| Run 2 | Random animal prompt (multi-iteration) | `e59815c8-a2e6-4778-9c01-d9826ba9a91a` | ✓ "Step 2" divider rendered; data-iteration="1"; first-iteration has no divider above |
| Run 3 | Clockmaking essay (no tools, long stream) | `1ddd4bda-38e6-41c3-a6f4-94e1adc7da46` | ✓ F5 mid-stream → thread navigation → full essay restored, no dup bubble |
| Run 4 | Astrid lighthouse (UX-067-04 trigger) | `566d1583-4db5-43d5-89af-df1f4bc19e7a` | ✓ F5 during stream, uvicorn log shows no Traceback |

**evaluate_script proof for UX-067-02:** `[]` (empty array — no `Saving response` matches anywhere in the DOM at any point in the streaming lifecycle).

**Pitfall 4 verification (UX-067-05):** `panel.children[0]?.getAttribute('data-testid')` returned `null` (not `"iteration-divider"`) — confirms no divider above the first tool call.

### UX-067-04 (uvicorn terminal evidence)

User-pasted scrollback after F5 during Astrid run `566d1583-4db5-43d5-89af-df1f4bc19e7a`:

```
INFO:     127.0.0.1:61185 - "POST /threads/68702519-b097-4372-bff0-faf3d870fd02/messages HTTP/1.1" 201 Created
INFO:     127.0.0.1:61185 - "OPTIONS /runs/566d1583-4db5-43d5-89af-df1f4bc19e7a/stream?since=0 HTTP/1.1" 200 OK
INFO:     127.0.0.1:61185 - "GET /runs/566d1583-4db5-43d5-89af-df1f4bc19e7a/stream?since=0 HTTP/1.1" 200 OK
INFO:     127.0.0.1:65140 - "OPTIONS /threads HTTP/1.1" 200 OK
INFO:     127.0.0.1:52754 - "OPTIONS /settings/providers HTTP/1.1" 200 OK
INFO:     127.0.0.1:65140 - "OPTIONS /folders HTTP/1.1" 200 OK
INFO:     127.0.0.1:52754 - "OPTIONS /threads HTTP/1.1" 200 OK
INFO:     127.0.0.1:65140 - "OPTIONS /settings/providers HTTP/1.1" 200 OK
```

- Gate 1 (no `redis.exceptions.TimeoutError`): **PASS** — 0 matches
- Gate 3 (no `Traceback (most recent call last)`): **PASS** — 0 matches
- Gate 2 (canonical `consumer disconnected` INFO line visible): NOT VISIBLE — the app's module loggers (`app.api.runs`) default to WARNING under the user's uvicorn config, so the new INFO line `replay_tail_consumer xread (tail phase) socket timeout for run X (consumer disconnected; xread cancellation-equivalent)` is filtered. **The negative evidence (Gates 1 + 3) is the dominant signal:** before Plan 067-03, the same F5 would have logged `logger.exception(...)` which always emits a Traceback regardless of log level. Zero Tracebacks observed → Plan 067-03's `RedisTimeoutError`-aware handler is firing as designed.

### SC#6 closure (run_id `7558735c-3a2f-446f-b678-2c735be91871`)

**Protocol executed:**
1. User added `LLM_CALL_TIMEOUT_OVERRIDES=gpt-5.4=10` to `backend/.env` and restarted uvicorn.
2. Chrome MCP submitted slow long-form essay prompt at `2026-05-07T15:33:52.825Z`.
3. Backend per-call timer fired at `iteration 0` (model produced ~600 chars before 10s deadline).
4. Frontend rendered terminal state.
5. Chrome MCP clicked Resume → new run created.
6. User reverted env line and restarted uvicorn.

**Frontend evidence (Chrome MCP DOM snapshot):**
- `data-testid="assistant-message"` element visible
- StaticText "Agent reached time limit" present (banner)
- Button "Resume run" present and clickable (uid 14_15)

**Supabase `public.runs` row:**
```
run_id:       7558735c-3a2f-446f-b678-2c735be91871
status:       timed_out
started_at:   2026-05-07T15:33:53.067175+00:00
completed_at: 2026-05-07T15:34:07.822155+00:00
error:        timed_out: 10s per-call deadline exceeded at iteration 0 (model=gpt-5.4)
message_id:   12661ea3-0656-40a9-a599-a5f29bf79f68
```
Elapsed: ~14.7s (10s budget + ~4.7s wrapper / cleanup overhead).

**Resume verification:**
- POST `/threads/fb9d2f7c-101e-4ebc-84a3-8ae1aca269da/messages` (reqid=553) → 201
- GET `/runs/cf9caaee-35ec-489e-b1d4-04d6ce96ef2c/stream` (reqid=554) → 200
- New SSE stream established → original prompt re-submitted with conversation context

**LangSmith trace inspection:**
- ChatOpenAI sub-trace id: `f40572ae-61a3-4cfd-9c19-fe88e9feaed8`
- start_time: `2026-05-07T15:33:54.128068+00:00`
- end_time: `2026-05-07T15:34:07.792595+00:00`
- exception column:
  ```
  GeneratorExit()

  Traceback (most recent call last):
    File "C:\Vibe Apps\Agentic RAG\backend\venv\Lib\site-packages\langsmith\run_helpers.py", line 1680, in __iter__
      yield from self.__ls__gen__
  GeneratorExit
  ```

**Gate result:** `GeneratorExit` IS present at the exact line (`run_helpers.py:1680`) the plan's D-066-11 invariant requires absent. SC#6 LangSmith hygiene sub-criterion **fails**. See Gap-007.

## Gaps

### Gap-007 — D-066-11 `stream.close()` invariant violated under synthetic-timeout conditions

**Discovered:** 2026-05-07 during Phase 067 Plan 05 Task 4 SC#6 closure attempt.

**Symptom:** When the per-call timer fires (LLM call exceeds budget), the LangSmith `ChatOpenAI` sub-trace records `GeneratorExit` at `run_helpers.py:1680` (`yield from self.__ls__gen__`) instead of a clean `TimeoutError`. Phase 066 D-066-11 was supposed to prevent this by ensuring `stream.close()` runs cleanly *before* the timeout cancellation propagates to the LangSmith `@traceable` decorator's async generator wrapper.

**Evidence:** ChatOpenAI sub-trace `f40572ae-61a3-4cfd-9c19-fe88e9feaed8` (run_id `7558735c-3a2f-446f-b678-2c735be91871`).

**Why Phase 066's automated test passed but live failed:**
- `test_066_langsmith_clean.py` is a unit test of the wrapper logic in isolation; it doesn't exercise the full async generator-cancellation pathway under a real `asyncio.timeout` in production code.
- The Phase 066 9m02s live UAT run (`95e3447c-cf9b-448b-9e0d-22c30e40670d`) hit the *clean-completion* path (stream finished via end-of-stream), not the timeout-cancellation path — D-066-11's invariant was never actually exercised in that run.
- Phase 067 Plan 05's synthetic-timeout protocol is the FIRST live exercise of the D-066-11 path under real cancellation, and it surfaces the latent bug.

**Status:** open — escalated to a follow-on focused fix phase (likely 068 or higher).

**Disposition:** Phase 068 (or whatever orchestrator assigns) should:
1. Reproduce the failure in an integration test that wraps a real LangSmith `@traceable` decorator with `asyncio.timeout` and asserts no `GeneratorExit` in the trace exception column.
2. Audit the actual stream-close ordering in `agent_runner.py` against D-066-11's stated invariant — likely the close-before-cancel ordering isn't actually being enforced, or the langsmith-py wrapper can't be closed cleanly from outside.
3. Either fix the invariant or formally retire D-066-11 if the langsmith-py library can't preserve clean exception type under timeout cancellation.

**Impact:** SC#6 closure is partial (4-of-5 sub-criteria green). User-facing UX is fully working — banner + Resume + DB lifecycle state all correct. Only LangSmith trace hygiene under timeout is degraded.

## Sign-off

**Project-level:** **approved** (Phase 063.1 / 066 precedent — project-level approval is decoupled from UAT-file status; Plans 01-04 deliver their architectural fixes cleanly, all five UX-067-* issues are green, and SC#6 partial closure escalates the remaining gap as Gap-007 with concrete reproducer evidence).

**UAT file:** **partial** (5-of-6 SCs fully green; SC#6 partial — frontend + DB green, LangSmith trace hygiene red → Gap-007).

- [x] UX-067-01 — Real-time first-paint live-verified
- [x] UX-067-02 — "Saving response…" absence verified across all stream phases
- [x] UX-067-03 — F5 mid-stream + thread navigation = full message restored, no duplicates
- [x] UX-067-04 — Zero `redis.exceptions.TimeoutError` Tracebacks after tab-refresh test
- [x] UX-067-05 — `data-testid="iteration-divider"` count ≥ 1 with `Step N` label, no divider above first iteration
- [~] SC#6 — frontend + Supabase verified live; LangSmith trace hygiene red → Gap-007
- [x] backend/.env reverted post-test (no residual `LLM_CALL_TIMEOUT_OVERRIDES`)

**Carry-forward to follow-on phase:**
1. **Gap-007** — D-066-11 `stream.close()` invariant violated under synthetic-timeout conditions; reproducer + LangSmith trace evidence captured above. Needs focused phase to either fix or formally retire the invariant.
