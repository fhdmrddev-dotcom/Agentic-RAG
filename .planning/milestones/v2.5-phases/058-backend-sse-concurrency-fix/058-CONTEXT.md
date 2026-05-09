# Phase 058: Backend SSE Concurrency Fix - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Make a streaming agent on Thread A stop blocking other authenticated requests on the same uvicorn worker. Concretely: wrap every blocking sync `supabase-py` `.execute()` call reachable from the SSE path with `starlette.concurrency.run_in_threadpool`, and raise the AnyIO default thread limiter from 40 to 200 tokens at app startup. Single-worker dev preserved.

**In scope:** the `event_stream` generator at `backend/app/api/threads.py:520`, its pre-stream user-message INSERT at `threads.py:511`, and every helper/service the SSE path reaches: `fetch_visible_folders`, `load_user_settings`, `retrieval_service`, `sub_agent_service`, `sql_service`, `multimodal_service`, and any audit writes triggered from tool calls.

**Out of scope (belongs to other phases):**
- `asyncio.Queue` + background-task architecture, `sse-starlette`, `request.is_disconnected()` polling — Phase 059.
- Frontend `setViewingThread` / `AbortController` race fixes — Phase 060.
- `visibilitychange` / `pageshow` reconnect handlers — Phase 061.
- Browser-MCP scenario harness — Phase 062 (parallel-able with 058).
- Migration to `asyncpg` / async Supabase client — deferred (CONCUR-03).

</domain>

<decisions>
## Implementation Decisions

### Wrap scope & boundary
- **D-058-01:** Wrap closure = SSE-path. The wrap covers `event_stream` + the pre-stream INSERT + every helper/service the SSE path reaches. NOT a backend-wide audit (152 sites) and NOT surgical-only (event_stream alone leaves tool-path blocks). Matches research §A2 + 057-DEFERRAL: "audit any `.execute()` in tool dispatch paths." Non-SSE endpoints (`documents.py`, `skills.py`, `knowledge_health.py`, etc.) are explicitly NOT touched in 058 — they can be migrated incrementally as touched in future work.
- **D-058-02:** The pre-stream user-message INSERT at `threads.py:511` is included in the wrap. It runs synchronously before the `StreamingResponse` is returned and currently blocks the request handler briefly; wrapping it ensures the cross-tab GET is unblocked even during the initial INSERT window.

### Helper abstraction
- **D-058-03:** Introduce one shared helper, e.g. `backend/app/utils/db.py::aexec(query)`:
  ```python
  from starlette.concurrency import run_in_threadpool

  async def aexec(query):
      return await run_in_threadpool(query.execute)
  ```
  Call sites become `data = await aexec(supabase.table('x').select('*').eq(...))` — clean, ~30 import changes, symmetric with the queue producer/consumer pattern Phase 059 will use, and easy to swap to async client later (CONCUR-03).
- **D-058-04:** Inline `await run_in_threadpool(query.execute)` is rejected — too noisy at call sites and easy to forget on future additions.
- **D-058-05:** No lint guard / pre-commit grep added in 058. Reconsider in 059 if regressions appear.
- **D-058-06:** Monkey-patching `.execute()` to return a coroutine is rejected — would break 152 sync call sites outside the SSE path.

### AnyIO limiter wiring
- **D-058-07:** Bump the AnyIO default thread limiter from 40 → 200 inside the existing `lifespan()` startup at `backend/app/main.py:50`. Add `anyio_thread_tokens: int = 200` to `Settings` in `backend/app/config.py` (matches the existing `pydantic-settings` `env_file` pattern at `config.py:129`) so the value is env-overridable without a code change.
  ```python
  # main.py lifespan
  import anyio
  anyio.to_thread.current_default_thread_limiter().total_tokens = (
      settings.anyio_thread_tokens
  )
  ```
- **D-058-08:** Module-level limiter set is rejected (re-imports during tests can re-trigger the side effect; lifespan is the canonical FastAPI startup hook).

### Verification & gate-to-merge
- **D-058-09:** Phase merges only after a pytest+httpx integration test passes:
  ```python
  # tests/integration/test_058_concurrency.py
  async def test_cross_tab_unblocked_during_sse():
      async with httpx.AsyncClient(app=app, base_url=...) as c:
          sse_task = asyncio.create_task(
              consume_sse(c, thread_a_id, slow_mock_llm=True))
          t0 = time.monotonic()
          r = await c.get(f"/threads/{thread_b_id}/messages")
          elapsed = time.monotonic() - t0
          assert elapsed < 1.0, f"GET took {elapsed:.2f}s"
          assert r.status_code == 200
          sse_task.cancel()
  ```
  The mock LLM yields slowly so the SSE stream stays open while the GET races. The test runs in CI on every change.
- **D-058-10:** Add a 2-minute manual two-tab DevTools timing checklist to `058-VERIFICATION.md` for human confirmation against a real LLM (not mocked). Documented but not gating.
- **D-058-11:** 058 is NOT blocked on Phase 062 — research and ROADMAP confirm 062 is parallel-able. The integration test is the gate; the browser-MCP harness is for the harder reconnect scenarios in 061.

### Claude's Discretion
- Exact directory and file location for the helper (`backend/app/utils/db.py` vs `backend/app/db.py` vs adding to `dependencies.py`) — planner picks based on import-graph fit.
- Whether the helper accepts a callable or a query object. Locked semantically as "wraps `.execute()`"; the planner decides if `aexec(query)` (calls `query.execute`) or `aexec(fn)` (caller passes `query.execute`) is more ergonomic for this codebase.
- Whether to also wrap a tiny number of synchronous helpers (e.g. `fetch_visible_folders` already exists as a sync function — wrap at call site vs make the helper async). Planner audits and decides per helper.
- Mock-LLM wiring for the integration test — pick whichever stub mechanism is least intrusive (env flag, fixture, dependency override).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research and prior-attempt context
- `.planning/research/058-sse-concurrency-research.md` — primary research synthesis. §A1–A5 cover sync-execute-blocks-event-loop, remediation patterns, canonical SSE architecture, why `--workers N` is wrong, and `is_disconnected()` semantics. §A2 explicitly flags the 40-thread AnyIO ceiling and shows the `current_default_thread_limiter().total_tokens = 200` pattern. **Decision matrix at the bottom is binding.**
- `.planning/milestones/v2.4-phases/057-sse-realtime-reconnect-fix/057-DEFERRAL.md` — two prior failed attempts. The "Backend FastAPI worker is single-threaded against SSE" section (§ "What Was Discovered During Browser Testing #2") shows the 30s-stuck-GET network evidence that CONCUR-01 reverses.

### Project-level decisions (PROJECT.md key decisions table)
- D-v2.5-01: `run_in_threadpool` chosen over `asyncio.to_thread` and full async client. **Locked.**
- D-v2.5-02: `--workers N` is NOT the answer. **Locked.**
- D-v2.5-03: Realtime is best-effort, not source of truth.
- D-v2.5-04: Phase 059 will refactor to `asyncio.Queue` + `sse-starlette` + `is_disconnected()`. 058 must NOT pre-empt this.

### Requirements
- `.planning/REQUIREMENTS.md` — CONCUR-01 (cross-tab GET <1s) maps to 058. Acceptance criteria are the authoritative success bar.

### Roadmap
- `.planning/ROADMAP.md` — Phase 058 success criteria 1–4 are reproduced here as decisions; the four numbered criteria in ROADMAP are binding.

### Codebase landmarks
- `backend/app/api/threads.py:511` — pre-stream user-message INSERT (in scope).
- `backend/app/api/threads.py:520` — `event_stream` generator (in scope).
- `backend/app/main.py:17–40` — existing `_patch_postgrest_maybe_single` monkey-patch on `SyncSingleRequestBuilder.execute`. The new `aexec` helper must coexist with this patch — both wrap `execute`, but the postgrest patch only intercepts a 204-error edge case and is orthogonal to the threadpool wrap.
- `backend/app/main.py:50` — existing `lifespan()` async context manager — the natural insertion point for the AnyIO limiter bump.
- `backend/app/config.py:128–283` — `Settings(BaseSettings)` with `pydantic-settings`/`env_file` — the natural insertion point for `anyio_thread_tokens`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lifespan` async context manager at `backend/app/main.py:50` — already exists, currently only handles sandbox shutdown. Add the AnyIO limiter setter on startup.
- `Settings` at `backend/app/config.py:128` — already uses `pydantic-settings` with `env_file=".env"`. Adding `anyio_thread_tokens: int = 200` is a one-line addition that lights up env-override automatically.
- `SyncSingleRequestBuilder.execute` patch precedent at `main.py:17–40` — confirms the codebase already accepts one centralized layer of indirection over `.execute()`. The new `aexec` helper is the second such layer (additive, not replacing).

### Established Patterns
- All Supabase calls today are sync `.execute()`, called inside `async def` handlers — the exact anti-pattern from research §A1.
- Helper functions like `fetch_visible_folders` (utils/folder_utils.py), `load_user_settings`, and the various `*_service` modules contain their own `.execute()` calls. Some helpers will need to become `async def` to allow the wrap to cross the helper boundary; the planner decides per helper.
- `event_stream` is an `async generator` — it CAN `await` between yields, so wrapping inline calls with `await aexec(...)` is mechanically straightforward.

### Integration Points
- `event_stream` (threads.py:520) → `retrieval_service` / `sub_agent_service` / `sql_service` / `multimodal_service` / `audit_service` (via tool dispatch). Each service has its own `.execute()` call sites that must be wrapped.
- `event_stream` → `fetch_visible_folders` (utils/folder_utils.py) → `.execute()`. Helper boundary decision: make the helper async and wrap inside, OR keep helper sync and wrap at the call site by `await run_in_threadpool(fetch_visible_folders, ...)`. Planner decides.
- The 152 `.execute()` calls in 14 files are NOT all in scope — only those reachable from `event_stream` are 058's territory.

</code_context>

<specifics>
## Specific Ideas

- Helper name: `aexec(query)` — short, paired with sync `.execute()`, reads naturally at call sites: `data = await aexec(supabase.table(...).select(...).eq(...))`.
- Integration test name and location: `tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse`. Single deterministic assertion: `elapsed < 1.0`.
- Settings field: `anyio_thread_tokens: int = 200`. Override via `ANYIO_THREAD_TOKENS=...` in `.env`.
- `058-VERIFICATION.md` includes the manual two-tab DevTools timing checklist alongside the automated test.

</specifics>

<deferred>
## Deferred Ideas

- **Backend-wide `.execute()` audit (~150 sites in `documents.py`, `skills.py`, `knowledge_health.py`, `feedback.py`, `kb.py`, `audit.py`, `folders.py`, etc.)** — out of 058 scope. Migrate incrementally as touched, or open a dedicated phase if regression evidence accumulates.
- **Lint guard / pre-commit grep for raw `.execute()` inside `async def`** — reconsider in 059 if regressions appear.
- **Migration to `asyncpg` or async Supabase client** — already tracked as CONCUR-03 in REQUIREMENTS.md "Future Requirements." Removes the 200-token ceiling entirely.
- **Browser-MCP cross-tab scenario** — Phase 062 will add it; not a blocker for 058 merge.

</deferred>

---

*Phase: 058-backend-sse-concurrency-fix*
*Context gathered: 2026-05-01*
