# Phase 058: Backend SSE Concurrency Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 058-backend-sse-concurrency-fix
**Areas discussed:** Wrap scope & boundary, Helper abstraction vs inline, AnyIO limiter wiring, Verification & gate-to-merge

---

## Wrap scope & boundary

| Option | Description | Selected |
|--------|-------------|----------|
| SSE-path closure | Wrap `event_stream` body + the pre-stream user INSERT (threads.py:511) + every helper/service the SSE path reaches: `fetch_visible_folders`, `load_user_settings`, `retrieval_service`, `sub_agent_service`, `sql_service`, `multimodal_service`, audit writes from tool calls. Matches research §A2 + 057-DEFERRAL's "audit any `.execute()` in tool dispatch paths." | ✓ |
| Surgical (event_stream only) | Wrap only direct `.execute()` calls inside the `event_stream` generator + the pre-stream INSERT. Smallest diff but misses tool-path blocks — likely to require a 058.1 follow-up. | |
| Backend-wide | Wrap every `.execute()` across all 14 files (152 sites). Most consistent, ~150 mechanical changes. Higher review burden, more chance of regression. | |
| SSE-path closure + non-SSE high-traffic | Recommended scope plus `documents.py` / `skills.py` / `knowledge_health.py` upload/list endpoints. Middle ground; not necessary to satisfy CONCUR-01. | |

**User's choice:** SSE-path closure
**Notes:** Aligns with the research recommendation and meets SC1 without scope creep. Non-SSE endpoints to be migrated incrementally as touched.

---

## Helper abstraction vs inline

| Option | Description | Selected |
|--------|-------------|----------|
| Helper | One shared helper `aexec(query)` in a shared utils module. Call sites: `data = await aexec(supabase.table(...).select(...).eq(...))`. ~30 import changes; symmetric with the queue producer/consumer pattern Phase 059 will use; easy to swap to async client later. | ✓ |
| Inline | Each call site spells out `await run_in_threadpool(query.execute)` explicitly. No new module, but ~30 noisy call sites and easy to forget on future additions. | |
| Helper + lint guard | Helper plus a grep-based pre-commit check that flags raw `.execute()` inside `async def` in SSE-path files. More setup; protects against regression in 059+ work. | |
| Decorator/patch on `.execute()` | Monkey-patch `SyncSingleRequestBuilder.execute` so it returns a coroutine. Zero call-site changes, but breaks every other endpoint's sync `.execute()` calls. Not viable. | |

**User's choice:** Helper
**Notes:** Selected the preview showing `aexec` wrapping `query.execute` and call site reading `await aexec(supabase.table('threads').select('folder_id').eq('id', thread_id).single())`.

---

## AnyIO limiter wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Lifespan startup + env | Bump inside the existing `lifespan()` at `main.py:50`. Add `anyio_thread_tokens: int = 200` to `Settings` (matches the existing `pydantic-settings` `env_file` pattern). Forward-compat for prod tuning. | ✓ |
| Lifespan startup, hardcoded 200 | Bump inside `lifespan()` with literal `200`. Simplest possible diff. No new config surface; tuning later requires a code change. | |
| Module-level at import | Set the limiter at module level in `main.py` alongside the existing `_patch_postgrest_maybe_single()` call. Side-effect-on-import; tests that import main re-trigger it. | |

**User's choice:** Lifespan startup + env
**Notes:** Selected the preview showing `lifespan()` setting `anyio.to_thread.current_default_thread_limiter().total_tokens = settings.anyio_thread_tokens` plus a `Settings.anyio_thread_tokens: int = 200` field.

---

## Verification & gate-to-merge

| Option | Description | Selected |
|--------|-------------|----------|
| Integration test + manual smoke | pytest+httpx async test that starts a long-running SSE stream (mocked LLM) and asserts a concurrent `GET /threads/{B}/messages` completes in <1s. Plus a 2-minute manual two-tab DevTools checklist in `058-VERIFICATION.md`. CI gate; deterministic. | ✓ |
| Manual checklist only | `058-VERIFICATION.md` documents a two-tab DevTools timing checklist. No automated gate; no protection against future regression. | |
| Block 058 on 062 harness | Don't merge 058 until the chrome-in-browser MCP harness from Phase 062 exists. Inverts the dependency — 062 is parallel-able with 058 per ROADMAP. | |
| Backend unit test of wrap presence + manual smoke | A grep-style test that asserts no raw `.execute()` inside `async def` in SSE-path files + manual smoke. Lighter than integration test but only proves the wrap is in place, not GET <1s during a real stream. | |

**User's choice:** Integration test + manual smoke
**Notes:** Selected the preview showing `tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse` with `assert elapsed < 1.0` against a slow-mock LLM.

---

## Claude's Discretion

- Exact location of the `aexec` helper module (`backend/app/utils/db.py` vs `backend/app/db.py` vs adding to `dependencies.py`).
- Helper signature: `aexec(query)` calling `query.execute` vs `aexec(fn)` accepting `query.execute`.
- For each helper currently using `.execute()` (`fetch_visible_folders`, `load_user_settings`, etc.): convert helper to `async def` and wrap inside, OR keep sync and wrap at call site via `await run_in_threadpool(helper, ...)`. Planner audits per helper.
- Mock-LLM mechanism for the integration test (env flag, fixture, dependency override).

## Deferred Ideas

- Backend-wide `.execute()` audit (~150 sites outside the SSE path).
- Lint guard / pre-commit grep for raw `.execute()` inside `async def` — reconsider in 059.
- Migration to `asyncpg` or async Supabase client — already tracked as CONCUR-03.
- Browser-MCP cross-tab scenario script — covered by Phase 062.
